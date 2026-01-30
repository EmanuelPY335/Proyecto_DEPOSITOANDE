# backend/audit_service.py
from flask import request
from datetime import datetime
from db import db, Auditoria, Usuario

def registrar_auditoria(usuario_id, accion_corta, detalle_largo, tabla=None, id_registro=None, id_deposito_force=None):
    """
    Params:
        usuario_id: ID del usuario que ejecuta la acción.
        accion_corta: Código breve (ej: "LOGIN", "BAJA_STOCK").
        detalle_largo: Explicación humana (ej: "Se descontaron 5u del material X").
        tabla: Nombre de la tabla afectada (ej: "material").
        id_registro: ID del registro afectado.
        id_deposito_force: Si la acción ocurre en un depósito distinto al del usuario.
    """
    try:
        # 1. Obtener datos del usuario para la "Foto"
        usuario = Usuario.query.get(usuario_id)
        
        nombre_user = "Sistema/Desconocido"
        rol_user = "N/A"
        deposito_user_id = None
        nombre_deposito = "General"

        if usuario:
            # Intentar sacar nombre real
            if usuario.empleado:
                nombre_user = f"{usuario.empleado.NOMBRE} {usuario.empleado.APELLIDO}"
                deposito_user_id = usuario.empleado.ID_DEPOSITO
                if usuario.empleado.deposito:
                    nombre_deposito = usuario.empleado.deposito.NOMBRE
            else:
                nombre_user = usuario.CORREO

            # Sacar Rol
            if usuario.rol:
                rol_user = usuario.rol.NOMBRE_ROL

        # 2. Definir Depósito Final (Prioridad: forzado > usuario)
        final_dep_id = id_deposito_force if id_deposito_force else deposito_user_id
        
        # Si forzamos un ID de depósito y no tenemos el nombre, podríamos buscarlo, 
        # pero por rendimiento a veces basta con el ID o dejar el nombre del usuario.
        
        # 3. Obtener IP
        ip = request.remote_addr if request else "Local"

        # 4. Crear registro
        audit = Auditoria(
            ID_USUARIO=usuario_id,
            NOMBRE_USUARIO=nombre_user,
            ROL_MOMENTO=rol_user,
            
            ID_DEPOSITO=final_dep_id,
            NOMBRE_DEPOSITO=nombre_deposito,
            
            ACCION_REALIZADA=accion_corta,
            DETALLE=detalle_largo,
            
            TABLA_AFECTADA=tabla,
            ID_REGISTRO_AFECTADO=id_registro,
            
            IP_ADDRESS=ip,
            FECHA_HORA=datetime.now()
        )

        db.session.add(audit)
        db.session.commit()
        # print(f"📝 Audit: {accion_corta} - {nombre_user}")

    except Exception as e:
        print(f"❌ Error Audit Service: {e}")
        # No hacemos raise para no romper el flujo principal