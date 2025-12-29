# backend/movimientos.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from db import db, Inventario, MovimientoMaterial, TipoMovimiento, Lote, Empleado, Material, EstadoInventario
from datetime import date, datetime

movimientos_bp = Blueprint("movimientos", __name__)

@movimientos_bp.route("/transferencia", methods=["POST"])
@jwt_required()
def realizar_transferencia():
    # 1. Obtener quién hace la transferencia
    claims = get_jwt()
    # Buscamos al empleado asociado al usuario logueado
    # Asumimos que claims["rol_id"] es el ID de ROL, necesitamos el ID de Usuario para hallar el empleado
    usuario_id = claims.get("sub") 
    
    # NOTA IMPORTANTE: Necesitamos el ID_EMPLEADO. 
    # Si tu token no lo tiene, lo buscamos via Usuario.
    # Aquí asumiremos que lo enviamos desde el front o lo buscamos así:
    from db import Usuario
    usuario = Usuario.query.get(usuario_id)
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

        # Validaciones básicas
        if cantidad <= 0:
            return jsonify({"error": "La cantidad debe ser mayor a 0."}), 400
        if id_origen == id_destino:
            return jsonify({"error": "Origen y destino deben ser diferentes."}), 400

        # 2. VALIDAR STOCK EN ORIGEN
        inv_origen = Inventario.query.filter_by(ID_DEPOSITO=id_origen, ID_LOTE=id_lote).first()
        
        if not inv_origen or inv_origen.CANTIDAD_ACTUAL < cantidad:
            return jsonify({"error": f"Stock insuficiente. Disponible: {inv_origen.CANTIDAD_ACTUAL if inv_origen else 0}"}), 400

        # 3. PREPARAR TIPOS DE MOVIMIENTO (Si no existen, se crean)
        def get_tipo(nombre):
            t = TipoMovimiento.query.filter_by(TIPO_MOVIMIENTO=nombre).first()
            if not t:
                t = TipoMovimiento(TIPO_MOVIMIENTO=nombre)
                db.session.add(t)
                db.session.flush()
            return t

        tipo_salida = get_tipo("Salida por Transferencia")
        tipo_entrada = get_tipo("Entrada por Transferencia")

        # 4. EJECUTAR RESTA (ORIGEN)
        inv_origen.CANTIDAD_ACTUAL -= cantidad
        
        # Registrar Salida
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

        # 5. EJECUTAR SUMA (DESTINO)
        inv_destino = Inventario.query.filter_by(ID_DEPOSITO=id_destino, ID_LOTE=id_lote).first()
        if inv_destino:
            inv_destino.CANTIDAD_ACTUAL += cantidad
        else:
            # Si es la primera vez que llega a este depósito
            inv_destino = Inventario(
                ID_DEPOSITO=id_destino,
                ID_LOTE=id_lote,
                ID_ESTADO_INVENTARIO=inv_origen.ID_ESTADO_INVENTARIO, 
                CANTIDAD_ACTUAL=cantidad
            )
            db.session.add(inv_destino)

        # Registrar Entrada
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
        return jsonify({"success": True, "message": "Transferencia realizada exitosamente."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error transferencia: {e}")
        return jsonify({"error": str(e)}), 500