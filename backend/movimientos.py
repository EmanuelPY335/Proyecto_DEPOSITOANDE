from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from flask_cors import cross_origin
from sqlalchemy import text
from db import db, Inventario, MovimientoMaterial, TipoMovimiento, Lote, Empleado, Material, EstadoInventario, Usuario, Deposito, Vale
from datetime import date, datetime

# --- IMPORTAMOS LA NUEVA SEGURIDAD ---
from roles_permisos import permission_required

movimientos_bp = Blueprint("movimientos", __name__)

# =========================================================
# 1. HISTORIAL UNIFICADO (AGRUPADO POR VALE/RUTA)
# =========================================================
# Ver historial es básico, lo dejamos abierto a quien tenga token,
# pero el filtrado interno (por depósito) protege la data sensible.
@movimientos_bp.route("/movimientos", methods=["GET"])
@jwt_required() 
def get_movimientos():
    claims = get_jwt()
    user_id = int(claims.get("sub"))
    rol_nombre = claims.get("rol_nombre")
    
    # Obtener el depósito del usuario actual
    usuario = Usuario.query.get(user_id)
    deposito_id_user = usuario.empleado.ID_DEPOSITO if (usuario and usuario.empleado) else None
    
    lista_final = []

    try:
        # ---------------------------------------------------------
        # A. OBTENER RUTAS (VALES) - Agrupadas
        # ---------------------------------------------------------
        query_vales = Vale.query.filter(Vale.ID_ESTADO_VALE >= 1) # Vales activos o históricos

        # Filtros por Rol
        if rol_nombre == "Chofer":
            query_vales = query_vales.filter_by(ID_CHOFER=usuario.empleado.ID_EMPLEADO)
        elif rol_nombre not in ["Master_Admin"]:
            # Admins/Personal ven lo que sale de su depósito o lo que llega a él
            if deposito_id_user:
                query_vales = query_vales.filter(
                    (Vale.ID_DEPOSITO_ORIGEN == deposito_id_user) | 
                    (Vale.ID_DEPOSITO_DESTINO == deposito_id_user)
                )

        vales = query_vales.order_by(Vale.FECHA_CREACION.desc()).all()

        for v in vales:
            # Construir lista de items del vale para el PDF/Modal
            items_detalle = []
            if v.detalles:
                for d in v.detalles:
                    items_detalle.append({
                        "codigo": d.material.CODIGO_UNICO if d.material else "-",
                        "material": d.material.NOMBRE if d.material else "Desconocido",
                        "cantidad": d.CANTIDAD_SOLICITADA,
                        "unidad": d.material.UNIDAD_MEDIDA if d.material else "u.",
                        "lote": d.lote.CODIGO if d.lote else "-"
                    })
            
            # Lógica de presentación para la tabla (Resumen)
            cant_items = len(items_detalle)
            
            if cant_items == 0:
                titulo_material = "Sin Carga"
                dato_cantidad = "-"
                dato_unidad = ""
                dato_lote = "-"
            elif cant_items == 1:
                # Si es 1, mostramos el detalle directo
                titulo_material = items_detalle[0]["material"]
                dato_cantidad = items_detalle[0]["cantidad"]
                dato_unidad = items_detalle[0]["unidad"]
                dato_lote = items_detalle[0]["lote"]
            else:
                # Si son varios, mostramos resumen
                titulo_material = f"{cant_items} Items Variados"
                dato_cantidad = "-" # Se ve en detalle
                dato_unidad = ""
                dato_lote = "Varios"

            # Nombre Chofer
            nombre_chofer = "Sin Asignar"
            if v.chofer:
                nombre_chofer = f"{v.chofer.NOMBRE} {v.chofer.APELLIDO}"

            # Vehículo
            info_vehiculo = "N/A"
            if v.vehiculo:
                info_vehiculo = f"{v.vehiculo.MARCA} ({v.vehiculo.MATRICULA})"

            lista_final.append({
                "id": v.ID_VALE, # ID real del Vale
                "tipo_obj": "vale", 
                "fecha": v.FECHA_CREACION.strftime('%d/%m/%Y'),
                "es_local": False, # Es ruta
                "deposito": v.origen.NOMBRE if v.origen else "N/A",
                "destino_final": v.destino.NOMBRE if v.destino else "N/A",
                "responsable": nombre_chofer,
                "vehiculo": info_vehiculo,
                
                # Datos para la tabla
                "material": titulo_material,
                "lote": dato_lote,
                "cantidad": dato_cantidad,
                "unidad": dato_unidad,
                
                # Datos completos para el PDF
                "items": items_detalle 
            })

        # ---------------------------------------------------------
        # B. OBTENER MOVIMIENTOS INTERNOS (SUELTOS)
        # ---------------------------------------------------------
        # Buscamos movimientos que NO tengan ID_VALE (para no duplicar los de arriba)
        query_movs = MovimientoMaterial.query.filter(MovimientoMaterial.ID_VALE == None)
        
        if rol_nombre not in ["Master_Admin"] and deposito_id_user:
            query_movs = query_movs.filter_by(ID_DEPOSITO=deposito_id_user)
            
        # Limitamos a 50 recientes para no saturar si hay muchos movimientos históricos
        movs = query_movs.order_by(MovimientoMaterial.FECHA_MOVIMIENTO.desc()).limit(50).all()

        for m in movs:
            # Creamos un array de 1 item para ser compatible con la estructura nueva
            item_unico = [{
                "codigo": m.lote.material.CODIGO_UNICO if m.lote and m.lote.material else "-",
                "material": m.lote.material.NOMBRE if m.lote and m.lote.material else "Desconocido",
                "cantidad": m.CANTIDAD,
                "unidad": m.lote.material.UNIDAD_MEDIDA if m.lote and m.lote.material else "u.",
                "lote": m.lote.CODIGO if m.lote else "-"
            }]

            responsable = "Sistema"
            if m.empleado:
                responsable = f"{m.empleado.NOMBRE} {m.empleado.APELLIDO}"

            lista_final.append({
                "id": m.ID_MOVIMIENTO, # ID del movimiento
                "tipo_obj": "movimiento",
                "fecha": m.FECHA_MOVIMIENTO.strftime('%d/%m/%Y'),
                "es_local": True, # Es interno
                "deposito": m.deposito.NOMBRE if m.deposito else "N/A",
                "destino_final": "Interno / Ajuste",
                "responsable": responsable,
                "vehiculo": "N/A",
                
                # Datos directos
                "material": item_unico[0]["material"],
                "lote": item_unico[0]["lote"],
                "cantidad": item_unico[0]["cantidad"],
                "unidad": item_unico[0]["unidad"],
                
                "items": item_unico
            })

        return jsonify(lista_final), 200

    except Exception as e:
        print(f"Error get_movimientos: {e}")
        return jsonify({"error": str(e)}), 500


# =========================================================
# 2. TRANSFERENCIA ENTRE DEPOSITOS (PROTEGIDO)
# =========================================================
@movimientos_bp.route("/transferencia", methods=["POST"])
@permission_required("gestion_movimientos") # <--- AQUI ESTA LA SEGURIDAD 🔒
def realizar_transferencia():
    claims = get_jwt()
    user_id = int(claims.get("sub"))
    
    usuario = Usuario.query.get(user_id)
    if not usuario or not usuario.empleado:
         return jsonify({"error": "Usuario no vinculado a un empleado."}), 400
    
    id_empleado_autor = usuario.empleado.ID_EMPLEADO
    data = request.json
    
    try:
        id_origen = int(data.get("id_deposito_origen"))
        id_destino = int(data.get("id_deposito_destino"))
        id_lote = int(data.get("id_lote"))
        cantidad = float(data.get("cantidad"))
        observacion = data.get("observacion", "")

        if cantidad <= 0: return jsonify({"error": "Cantidad > 0"}), 400
        if id_origen == id_destino: return jsonify({"error": "Origen y destino iguales"}), 400

        inv_origen = Inventario.query.filter_by(ID_DEPOSITO=id_origen, ID_LOTE=id_lote).first()
        if not inv_origen or inv_origen.CANTIDAD_ACTUAL < cantidad:
            return jsonify({"error": f"Stock insuficiente. Disp: {inv_origen.CANTIDAD_ACTUAL if inv_origen else 0}"}), 400

        def get_tipo(nombre):
            t = TipoMovimiento.query.filter_by(TIPO_MOVIMIENTO=nombre).first()
            if not t:
                t = TipoMovimiento(TIPO_MOVIMIENTO=nombre)
                db.session.add(t)
                db.session.flush()
            return t

        tipo_salida = get_tipo("Salida por Transferencia")
        tipo_entrada = get_tipo("Entrada por Transferencia")

        # 1. Restar Origen
        inv_origen.CANTIDAD_ACTUAL -= cantidad
        
        mov_salida = MovimientoMaterial(
            ID_TIPO_MOVIMIENTO=tipo_salida.ID_TIPO_MOVIMIENTO,
            ID_EMPLEADO=id_empleado_autor,
            ID_DEPOSITO=id_origen,
            ID_LOTE=id_lote,
            FECHA_MOVIMIENTO=date.today(),
            CANTIDAD=cantidad,
            OBSERVACIONES=f"Envío a Depósito #{id_destino}. {observacion}"
        )
        db.session.add(mov_salida)

        # 2. Sumar Destino
        inv_destino = Inventario.query.filter_by(ID_DEPOSITO=id_destino, ID_LOTE=id_lote).first()
        if inv_destino:
            inv_destino.CANTIDAD_ACTUAL += cantidad
        else:
            inv_destino = Inventario(
                ID_DEPOSITO=id_destino, ID_LOTE=id_lote,
                ID_ESTADO_INVENTARIO=inv_origen.ID_ESTADO_INVENTARIO, 
                CANTIDAD_ACTUAL=cantidad
            )
            db.session.add(inv_destino)

        mov_entrada = MovimientoMaterial(
            ID_TIPO_MOVIMIENTO=tipo_entrada.ID_TIPO_MOVIMIENTO,
            ID_EMPLEADO=id_empleado_autor,
            ID_DEPOSITO=id_destino, 
            ID_LOTE=id_lote,
            FECHA_MOVIMIENTO=date.today(),
            CANTIDAD=cantidad,
            OBSERVACIONES=f"Recepción desde Depósito #{id_origen}. {observacion}"
        )
        db.session.add(mov_entrada)

        db.session.commit()
        return jsonify({"success": True, "message": "Transferencia realizada."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# =========================================================
# 3. RUTAS DE BORRADO (PROTEGIDAS)
# =========================================================

@movimientos_bp.route("/movimientos/<string:id_compuesto>", methods=["DELETE"])
@permission_required("gestion_movimientos") # Solo quien gestiona puede hacer soft delete
@cross_origin()
def soft_delete_movimiento(id_compuesto):
    try:
        # Si el ID viene como "mov-123" o es solo número
        if isinstance(id_compuesto, str) and "-" in id_compuesto:
             tipo, id_real = id_compuesto.split("-")
             id_real = int(id_real)
        else:
             id_real = int(id_compuesto)

        mov = MovimientoMaterial.query.get(id_real)
        if mov:
            db.session.delete(mov) # O soft delete real
            db.session.commit()
            return jsonify({"success": True, "message": "Movimiento eliminado"}), 200
            
        return jsonify({"error": "Registro no encontrado"}), 404

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@movimientos_bp.route("/movimientos/<int:id>/perma", methods=["DELETE"])
@cross_origin()
# Este es peligroso: Solo el MASTER ADMIN o alguien con permiso 'eliminar_registros'
@permission_required("gestion_roles") # Usamos un permiso alto como ejemplo, o creas 'eliminar_registros'
def perma_delete_movimiento(id):
    try:
        mov = MovimientoMaterial.query.get(id)
        if not mov:
            return jsonify({"error": "Movimiento no encontrado"}), 404
        
        db.session.delete(mov)
        db.session.commit()
        return jsonify({"success": True, "message": "Eliminado permanentemente"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500