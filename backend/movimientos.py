# backend/movimientos.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from db import db, Inventario, MovimientoMaterial, TipoMovimiento, Lote, Empleado, Material, EstadoInventario, Usuario, Deposito
from datetime import date, datetime

movimientos_bp = Blueprint("movimientos", __name__)

# --- 1. HISTORIAL UNIFICADO (NUEVO) ---
@movimientos_bp.route("/movimientos", methods=["GET"])
@jwt_required()
def get_historial_movimientos():
    claims = get_jwt()
    user_id = int(claims.get("sub"))
    rol_nombre = claims.get("rol_nombre")

    try:
        # Query base uniendo tablas para obtener nombres
        query = db.session.query(MovimientoMaterial)\
            .join(TipoMovimiento)\
            .join(Lote)\
            .join(Material)\
            .join(Empleado)\
            .join(Deposito)

        # Lógica de Filtrado por Depósito
        if rol_nombre != "Master_Admin":
            usuario = Usuario.query.get(user_id)
            if not usuario or not usuario.empleado or not usuario.empleado.ID_DEPOSITO:
                # Si no tiene depósito asignado, no ve movimientos
                return jsonify([]), 200
            
            mi_deposito_id = usuario.empleado.ID_DEPOSITO
            
            # Filtramos movimientos que ocurrieron en MI depósito
            # (Ya sea un movimiento interno, una salida desde aquí o una entrada hacia aquí)
            query = query.filter(MovimientoMaterial.ID_DEPOSITO == mi_deposito_id)

        # Ordenar: Más recientes primero
        movimientos = query.order_by(MovimientoMaterial.FECHA_MOVIMIENTO.desc(), MovimientoMaterial.ID_MOVIMIENTO.desc()).all()

        resultado = []
        for mov in movimientos:
            # Determinamos si es local o traslado basado en el nombre del tipo
            tipo_nombre = mov.tipo.TIPO_MOVIMIENTO
            es_local = "Interno" in tipo_nombre
            
            data = {
                "id": mov.ID_MOVIMIENTO,
                "fecha": mov.FECHA_MOVIMIENTO.strftime("%Y-%m-%d"),
                "tipo": tipo_nombre,
                "es_local": es_local,
                "material": mov.lote.material.NOMBRE,
                "codigo": mov.lote.material.CODIGO_UNICO,
                "lote": f"Lote #{mov.ID_LOTE}",
                "cantidad": mov.CANTIDAD,
                "unidad": mov.lote.material.UNIDAD_MEDIDA,
                "responsable": f"{mov.empleado.NOMBRE} {mov.empleado.APELLIDO}",
                "deposito": mov.deposito.NOMBRE,
                "observacion": mov.OBSERVACIONES
            }
            resultado.append(data)

        return jsonify(resultado), 200

    except Exception as e:
        print(f"Error historial movimientos: {e}")
        return jsonify({"error": str(e)}), 500

# --- 2. TRANSFERENCIA ENTRE DEPOSITOS (EXISTENTE) ---
@movimientos_bp.route("/transferencia", methods=["POST"])
@jwt_required()
def realizar_transferencia():
    claims = get_jwt()
    usuario_id = claims.get("sub") 
    
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

        if cantidad <= 0: return jsonify({"error": "Cantidad > 0"}), 400
        if id_origen == id_destino: return jsonify({"error": "Origen y destino iguales"}), 400

        # Validar Stock Origen
        inv_origen = Inventario.query.filter_by(ID_DEPOSITO=id_origen, ID_LOTE=id_lote).first()
        if not inv_origen or inv_origen.CANTIDAD_ACTUAL < cantidad:
            return jsonify({"error": f"Stock insuficiente. Disp: {inv_origen.CANTIDAD_ACTUAL if inv_origen else 0}"}), 400

        # Tipos de Movimiento
        def get_tipo(nombre):
            t = TipoMovimiento.query.filter_by(TIPO_MOVIMIENTO=nombre).first()
            if not t:
                t = TipoMovimiento(TIPO_MOVIMIENTO=nombre)
                db.session.add(t)
                db.session.flush()
            return t

        tipo_salida = get_tipo("Salida por Transferencia")
        tipo_entrada = get_tipo("Entrada por Transferencia")

        # Ejecutar Movimiento
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
            ID_DEPOSITO=id_destino, # Aquí se registra en el destino
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