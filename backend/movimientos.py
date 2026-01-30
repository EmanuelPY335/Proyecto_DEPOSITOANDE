print("✅ CARGANDO movimientos.py desde:", __file__)
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from db import (
    db, Inventario, MovimientoMaterial, TipoMovimiento, Lote, Empleado, 
    Material, EstadoInventario, Usuario, Deposito, Vale, 
    OrdenTrabajo, Maquinaria, DepositoSector, Notificacion, AvanceOrden
)
from datetime import date, datetime # ✅ Aseguramos datetime para fecha de eliminación
from sqlalchemy.orm import joinedload

# --- IMPORTAMOS LA NUEVA SEGURIDAD ---
from roles_permisos import permission_required

movimientos_bp = Blueprint("movimientos", __name__)

# =========================================================
# 1. HISTORIAL UNIFICADO (RUTAS + INTERNOS COMPLETADOS)
# =========================================================
@movimientos_bp.route("/movimientos", methods=["GET"])
@jwt_required()
def get_movimientos():
    claims = get_jwt()
    user_id = int(claims.get("sub"))
    rol_nombre = claims.get("rol_nombre")
    
    usuario = Usuario.query.get(user_id)
    deposito_id_user = usuario.empleado.ID_DEPOSITO if (usuario and usuario.empleado) else None
    
    lista_final = []

    try:
        # A. OBTENER RUTAS (VALES EXTERNOS)
        query_vales = Vale.query.filter(Vale.ID_ESTADO_VALE >= 2)

        if rol_nombre == "Chofer":
            query_vales = query_vales.filter_by(ID_CHOFER=usuario.empleado.ID_EMPLEADO)
        elif rol_nombre not in ["Master_Admin"]:
            if deposito_id_user:
                query_vales = query_vales.filter(
                    (Vale.ID_DEPOSITO_ORIGEN == deposito_id_user) |
                    (Vale.ID_DEPOSITO_DESTINO == deposito_id_user)
                )

        vales = query_vales.order_by(Vale.FECHA_CREACION.desc()).all()

        for v in vales:
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

            cant_items = len(items_detalle)
            if cant_items == 0:
                titulo_material, dato_cantidad, dato_unidad, dato_lote = "Sin Carga", "-", "", "-"
            elif cant_items == 1:
                titulo_material = items_detalle[0]["material"]
                dato_cantidad = items_detalle[0]["cantidad"]
                dato_unidad = items_detalle[0]["unidad"]
                dato_lote = items_detalle[0]["lote"]
            else:
                titulo_material, dato_cantidad, dato_unidad, dato_lote = f"{cant_items} Items Variados", "-", "", "Varios"

            nombre_chofer = f"{v.chofer.NOMBRE} {v.chofer.APELLIDO}" if v.chofer else "Sin Asignar"
            info_vehiculo = f"{v.vehiculo.MARCA} ({v.vehiculo.MATRICULA})" if v.vehiculo else "N/A"
            estado_txt = v.estado.estado_vale if (v.estado and hasattr(v.estado, "estado_vale")) else "Desconocido"

            lista_final.append({
                "id": v.ID_VALE,
                "tipo_obj": "vale",
                "fecha": v.FECHA_CREACION.strftime('%d/%m/%Y'),
                "es_local": False,
                "deposito": v.origen.NOMBRE if v.origen else "N/A",
                "destino_final": v.destino.NOMBRE if v.destino else "N/A",
                "responsable": nombre_chofer,
                "vehiculo": info_vehiculo,
                "material": titulo_material,
                "lote": dato_lote,
                "cantidad": dato_cantidad,
                "unidad": dato_unidad,
                "estado_id": v.ID_ESTADO_VALE,
                "estado": estado_txt,
                "items": items_detalle
            })

        # B. OBTENER MOVIMIENTOS INTERNOS (DESDE ÓRDENES)
        # ✅ Filtramos solo las que NO están eliminadas
        query_ordenes = OrdenTrabajo.query.filter(
            OrdenTrabajo.TIPO_ORDEN == "Movimiento",
            OrdenTrabajo.ELIMINADA == False 
        )

        if rol_nombre not in ["Master_Admin"] and deposito_id_user:
            query_ordenes = query_ordenes.filter_by(ID_DEPOSITO=deposito_id_user)

        ordenes = query_ordenes.order_by(OrdenTrabajo.FECHA_INICIO.desc()).limit(50).all()

        for o in ordenes:
            maquinaria_nombre = "N/A"
            if o.ID_MAQUINARIA:
                maq = Maquinaria.query.get(o.ID_MAQUINARIA)
                if maq:
                    maquinaria_nombre = f"{maq.NOMBRE_MAQUI} ({maq.TIPO_MAQUI})"

            sector_destino_nombre = o.NUEVA_UBICACION or "N/A"
            if o.ID_SECTOR_DESTINO:
                sec = DepositoSector.query.get(o.ID_SECTOR_DESTINO)
                if sec:
                    sector_destino_nombre = f"{sec.NOMBRE} ({sec.CODIGO})"

            nombre_material = "Desconocido"
            codigo_lote = "-"
            unidad_medida = "u."
            codigo_material = "-"
            
            if o.ID_LOTE_OBJETIVO:
                lote_obj = Lote.query.get(o.ID_LOTE_OBJETIVO)
                if lote_obj:
                    codigo_lote = lote_obj.CODIGO
                    if lote_obj.material:
                        nombre_material = lote_obj.material.NOMBRE
                        unidad_medida = lote_obj.material.UNIDAD_MEDIDA
                        codigo_material = lote_obj.material.CODIGO_UNICO

            sector_origen_nombre = "Depósito / Recepción" 
            
            responsable = "Sin Asignar"
            if o.empleado:
                responsable = f"{o.empleado.NOMBRE} {o.empleado.APELLIDO}"

            item_unico = [{
                "codigo": codigo_material,
                "material": nombre_material,
                "cantidad": o.CANTIDAD_MOVIMIENTO,
                "unidad": unidad_medida,
                "lote": codigo_lote,
                "sector_destino": sector_destino_nombre
            }]

            lista_final.append({
                "id": o.ID_ORDEN, 
                "tipo_obj": "movimiento",
                "fecha": o.FECHA_INICIO.strftime('%d/%m/%Y') if o.FECHA_INICIO else "-",
                "es_local": True,
                "deposito": o.deposito.NOMBRE if o.deposito else "N/A",
                "destino_final": "Interno",
                "responsable": responsable,
                "maquinaria": maquinaria_nombre,
                "sector_origen": sector_origen_nombre,
                "sector_destino": sector_destino_nombre,
                "observaciones": o.DESCRIPCION,
                "estado": o.estado.ESTADO_ORDEN if o.estado else "Registrado",
                "material": nombre_material,
                "lote": codigo_lote,
                "cantidad": o.CANTIDAD_MOVIMIENTO,
                "unidad": unidad_medida,
                "items": item_unico
            })

        return jsonify(lista_final), 200

    except Exception as e:
        print(f"❌ Error get_movimientos: {e}")
        return jsonify({"error": str(e)}), 500


# =========================================================
# 2. TRANSFERENCIA ENTRE DEPOSITOS
# =========================================================
@movimientos_bp.route("/transferencia", methods=["POST"])
@permission_required("gestion_movimientos")
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
# 3. RUTAS DE BORRADO (SOFT DELETE UNIFICADO)
# =========================================================

@movimientos_bp.route("/movimientos/<int:id>/soft", methods=["PUT"])
@jwt_required()
def soft_delete_movimiento(id):
    claims = get_jwt()
    rol = (claims.get("rol_nombre") or "").strip()

    if rol not in ["Admin", "Master_Admin"]:
        return jsonify({"error": "No autorizado"}), 403

    try:
        mov = MovimientoMaterial.query.get(id)
        if mov:
            mov.ELIMINADO = True
            mov.FECHA_ELIMINADO = datetime.now()
            db.session.commit()
            return jsonify({"success": True, "message": "Movimiento ocultado (Soft Delete)"}), 200
        
        orden = OrdenTrabajo.query.get(id)
        if orden:
            orden.ELIMINADA = True
            db.session.commit()
            return jsonify({"success": True, "message": "Orden ocultada (Soft Delete)"}), 200

        return jsonify({"error": "Registro no encontrado"}), 404

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# ✅ CORRECCIÓN: AHORA "PERMA" DELETE TAMBIÉN HACE SOFT DELETE
# Esto evita el error 1451 de integridad referencial.
@movimientos_bp.route("/movimientos/<int:id>/perma", methods=["DELETE"])
@jwt_required()
def perma_delete_movimiento(id):
    claims = get_jwt()
    rol = (claims.get("rol_nombre") or "").strip()

    if rol != "Master_Admin":
        return jsonify({"error": "Solo Master_Admin puede realizar esta acción"}), 403

    try:
        # Caso A: Movimiento Simple
        mov = MovimientoMaterial.query.get(id)
        if mov:
            # Reversión de stock (Mantenemos la lógica de reversión si lo deseas, 
            # ya que el usuario 'Master' espera que se deshaga el movimiento)
            inventario = Inventario.query.filter_by(ID_LOTE=mov.ID_LOTE, ID_DEPOSITO=mov.ID_DEPOSITO).first()
            if inventario:
                if mov.ID_TIPO_MOVIMIENTO == 1: # Entrada -> Restamos
                    inventario.CANTIDAD_ACTUAL -= mov.CANTIDAD
                elif mov.ID_TIPO_MOVIMIENTO == 2: # Salida -> Sumamos
                    inventario.CANTIDAD_ACTUAL += abs(mov.CANTIDAD)

            # En lugar de delete(), hacemos Soft Delete
            mov.ELIMINADO = True
            mov.FECHA_ELIMINADO = datetime.now()
            # db.session.delete(mov) ❌ CAUSA DE ERROR FK
            
            db.session.commit()
            return jsonify({"success": True, "message": "Movimiento revertido y archivado (Soft Delete)"}), 200
        
        # Caso B: Orden de Trabajo (El que daba error)
        orden = OrdenTrabajo.query.get(id)
        if orden:
            # En lugar de intentar borrar y fallar por las notificaciones...
            # Simplemente la marcamos como eliminada.
            orden.ELIMINADA = True
            
            # db.session.delete(orden) ❌ CAUSA DE ERROR FK
            
            db.session.commit()
            return jsonify({"success": True, "message": "Orden eliminada exitosamente (Soft Delete)"}), 200

        return jsonify({"error": "Movimiento no encontrado"}), 404

    except Exception as e:
        db.session.rollback()
        print(f"❌ Error Soft/Perma Delete: {e}")
        return jsonify({"error": str(e)}), 500