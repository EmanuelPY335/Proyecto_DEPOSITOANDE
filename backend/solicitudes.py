# backend/solicitudes.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required, verify_jwt_in_request
from flask_cors import cross_origin
from sqlalchemy import func
import datetime

# Asegúrate de tener todas estas importaciones en tu db.py
from db import (
    db,
    SolicitudStock,
    DetalleSolicitud,
    EstadoSolicitud,
    Usuario,
    Deposito,
    Material,
    Inventario,
    Lote,
    Notificacion,
    EstadoInventario,
    Rol,
    Empleado,
)

solicitudes_bp = Blueprint("solicitudes", __name__)

# --- UTILIDAD: Obtener IDs de Estado ---
def get_id_estado_pendiente():
    estado = EstadoSolicitud.query.filter(EstadoSolicitud.NOMBRE.ilike("Pendiente")).first()
    return estado.ID_ESTADO if estado else 1

def get_id_estado_rechazada():
    estado = EstadoSolicitud.query.filter(EstadoSolicitud.NOMBRE.ilike("Rechazada")).first()
    return estado.ID_ESTADO if estado else 5


# -------------------------------------------------------------------------
# RUTA 1: STOCK DISPONIBLE
# -------------------------------------------------------------------------
@solicitudes_bp.route("/api/solicitudes/stock-disponible/<int:id_material>", methods=["GET"])
def get_stock_disponible(id_material):
    try:
        verify_jwt_in_request()
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(current_user_id)

        mi_deposito_id = usuario.empleado.ID_DEPOSITO if (usuario and usuario.empleado and usuario.empleado.ID_DEPOSITO) else -1
        estado_disp = EstadoInventario.query.filter(EstadoInventario.ESTADO_INVENTARIO.ilike("Disponible")).first()
        id_estado_ok = estado_disp.ID_ESTADO_INVENTARIO if estado_disp else 1

        resultados = (
            db.session.query(
                Deposito.ID_DEPOSITO,
                Deposito.NOMBRE,
                Material.UNIDAD_MEDIDA,
                func.sum(Inventario.CANTIDAD_ACTUAL).label("total_stock"),
            )
            .join(Inventario, Deposito.ID_DEPOSITO == Inventario.ID_DEPOSITO)
            .join(Lote, Inventario.ID_LOTE == Lote.ID_LOTE)
            .join(Material, Lote.ID_MATERIAL == Material.ID_MATERIAL)
            .filter(Lote.ID_MATERIAL == id_material)
            .filter(Inventario.CANTIDAD_ACTUAL > 0)
            .filter(Inventario.ID_ESTADO_INVENTARIO == id_estado_ok)
            .filter(Deposito.ID_DEPOSITO != mi_deposito_id)
            .group_by(Deposito.ID_DEPOSITO, Deposito.NOMBRE, Material.UNIDAD_MEDIDA)
            .all()
        )

        lista = [
            {
                "id_deposito": r.ID_DEPOSITO,
                "nombre": r.NOMBRE,
                "unidad": r.UNIDAD_MEDIDA,
                "cantidad": float(r.total_stock),
            }
            for r in resultados
            if r.total_stock and float(r.total_stock) > 0
        ]
        return jsonify(lista), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------------------
# RUTA 2: CREAR SOLICITUD (Con notificación persistente al Destino)
# -------------------------------------------------------------------------
@solicitudes_bp.route("/api/solicitudes", methods=["POST"])
@cross_origin()
def crear_solicitud():
    print("--- INICIANDO CREACIÓN DE SOLICITUD ---")
    try:
        verify_jwt_in_request()
        current_user_id = get_jwt_identity()
        data = request.json or {}

        # 1. Validaciones
        usuario = Usuario.query.get(current_user_id)
        if not usuario or not usuario.empleado or not usuario.empleado.ID_DEPOSITO:
            return jsonify({"error": "Usuario sin depósito asignado."}), 400

        id_origen = int(usuario.empleado.ID_DEPOSITO)
        id_destino_raw = data.get("id_deposito_proveedor")
        items = data.get("items", []) or []

        if not id_destino_raw:
            return jsonify({"error": "Selecciona un depósito proveedor."}), 400

        id_destino = int(id_destino_raw)

        if not items:
            return jsonify({"error": "La solicitud está vacía."}), 400

        if id_origen == id_destino:
            return jsonify({"error": "No puedes solicitar a tu propio depósito."}), 400

        # 2. Crear Cabecera
        id_pendiente = get_id_estado_pendiente()
        nueva_solicitud = SolicitudStock(
            ID_DEPOSITO_SOLICITANTE=id_origen,
            ID_USUARIO_SOLICITANTE=current_user_id,
            ID_DEPOSITO_PROVEEDOR=id_destino,
            ID_ESTADO=id_pendiente,
            OBSERVACION_GENERAL=data.get("observacion", "") or "",
            FECHA_SOLICITUD=datetime.datetime.now(),
        )
        db.session.add(nueva_solicitud)
        db.session.flush()

        # 3. Crear Detalles
        for item in items:
            nuevo_detalle = DetalleSolicitud(
                ID_SOLICITUD=nueva_solicitud.ID_SOLICITUD,
                ID_MATERIAL=int(item["id_material"]),
                CANTIDAD=float(item["cantidad"]),
                OBSERVACION_ITEM=item.get("observacion", "") or "",
            )
            db.session.add(nuevo_detalle)

        db.session.commit()
        print(f"Solicitud #{nueva_solicitud.ID_SOLICITUD} creada.")

        # 4. NOTIFICACIONES PERSISTENTES (GUARDAR EN DB)
        # ✅ FIX: ahora se guarda para TODOS los destinatarios (antes solo el último)
        try:
            nombre_dep_origen = usuario.empleado.deposito.NOMBRE if usuario.empleado.deposito else "Un Depósito"
            total_items = len(items)

            destinatarios = (
                db.session.query(Usuario)
                .join(Usuario.rol)
                .join(Usuario.empleado, isouter=True)
                .filter(
                    (Rol.NOMBRE_ROL == "Master_Admin")
                    | ((Rol.NOMBRE_ROL == "Admin") & (Empleado.ID_DEPOSITO == id_destino))
                )
                .all()
            )

            for admin in destinatarios:
                notif = Notificacion(
                    ID_USUARIO=admin.ID_USUARIO,
                    MENSAJE=f"📦 Solicitud #{nueva_solicitud.ID_SOLICITUD}: {nombre_dep_origen} pide {total_items} items.",
                    LEIDA=False,
                    FECHA_CREACION=datetime.datetime.now(),
                    TIPO="solicitud.creada",
                    LINK_NOTI=f"/movimientos?tab=pedidos&highlight={nueva_solicitud.ID_SOLICITUD}",
                    DEPOSITO=nombre_dep_origen,
                    SENDER="Sistema",
                    META={"id_solicitud": nueva_solicitud.ID_SOLICITUD, "items": total_items},
                )
                db.session.add(notif)

            db.session.commit()
            print("✅ Notificaciones guardadas en DB para administradores.")

        except Exception as e_notif:
            db.session.rollback()
            print(f"⚠️ Error al notificar (pero la solicitud se creó): {e_notif}")

        return jsonify({"success": True, "message": "Pedido enviado correctamente."}), 201

    except Exception as e:
        db.session.rollback()
        print(f"ERROR FATAL: {e}")
        return jsonify({"error": f"Error servidor: {str(e)}"}), 500


# -------------------------------------------------------------------------
# RUTA 3: CONTEO (Badge)
# -------------------------------------------------------------------------
@solicitudes_bp.route("/api/notificaciones/conteo", methods=["GET"])
def get_notificaciones_conteo():
    try:
        verify_jwt_in_request()
    except:
        return jsonify({"error": "Auth"}), 401

    current_user_id = get_jwt_identity()
    try:
        usuario = Usuario.query.get(current_user_id)
        if not usuario or not usuario.empleado:
            return jsonify({"pedidos_pendientes": 0}), 200

        mi_deposito_id = usuario.empleado.ID_DEPOSITO
        id_pendiente = get_id_estado_pendiente()

        conteo = SolicitudStock.query.filter_by(
            ID_DEPOSITO_PROVEEDOR=mi_deposito_id,
            ID_ESTADO=id_pendiente,
        ).count()

        return jsonify({"pedidos_pendientes": conteo}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------------------
# RUTA 4: LISTAR PEDIDOS ENTRANTES (Para Admin B)
# -------------------------------------------------------------------------
@solicitudes_bp.route("/api/solicitudes/entrantes", methods=["GET"])
def get_pedidos_entrantes():
    try:
        verify_jwt_in_request()
    except:
        return jsonify({"error": "Token invalido"}), 401

    current_user_id = get_jwt_identity()
    try:
        usuario = Usuario.query.get(current_user_id)
        if not usuario or not usuario.empleado:
            return jsonify([]), 200

        mi_deposito_id = usuario.empleado.ID_DEPOSITO

        solicitudes = (
            SolicitudStock.query.filter_by(ID_DEPOSITO_PROVEEDOR=mi_deposito_id, ID_ESTADO=1)
            .order_by(SolicitudStock.FECHA_SOLICITUD.desc())
            .all()
        )

        resultado = []
        for s in solicitudes:
            items_desc = [f"{d.material.NOMBRE} ({d.CANTIDAD})" for d in (s.detalles or []) if getattr(d, "material", None)]
            resumen_texto = ", ".join(items_desc[:2])
            if len(items_desc) > 2:
                resumen_texto += f" y {len(items_desc) - 2} más..."

            nom_solicitante = (
                f"{s.usuario.empleado.NOMBRE} {s.usuario.empleado.APELLIDO}"
                if (getattr(s, "usuario", None) and getattr(s.usuario, "empleado", None))
                else "Desconocido"
            )

            resultado.append(
                {
                    "id_solicitud": s.ID_SOLICITUD,
                    "deposito_solicitante": s.dep_solicitante.NOMBRE if getattr(s, "dep_solicitante", None) else "N/A",
                    "solicitante_usuario": nom_solicitante,
                    "fecha": s.FECHA_SOLICITUD.strftime("%d/%m/%Y %H:%M") if s.FECHA_SOLICITUD else "",
                    "observacion": getattr(s, "OBSERVACION_GENERAL", "") or "",
                    "resumen": resumen_texto,
                    "items": [
                        {
                            "material": d.material.NOMBRE,
                            "cantidad": d.CANTIDAD,
                            "codigo": d.material.CODIGO_UNICO,
                            "observacion": getattr(d, "OBSERVACION_ITEM", "") or "",
                        }
                        for d in (s.detalles or [])
                        if getattr(d, "material", None)
                    ],
                }
            )

        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------------------------------------------------------------
# RUTA 5: RECHAZAR SOLICITUD (Con notificación persistente al Origen)
# -------------------------------------------------------------------------
@solicitudes_bp.route("/api/solicitudes/<int:id>/rechazar", methods=["PUT"])
@cross_origin()
@jwt_required()
def rechazar_solicitud(id):
    try:
        data = request.json or {}
        motivo = (data.get("motivo") or "Sin motivo especificado").strip()

        solicitud = SolicitudStock.query.get(id)
        if not solicitud:
            return jsonify({"error": "Solicitud no encontrada"}), 404

        id_rechazada = get_id_estado_rechazada()
        if solicitud.ID_ESTADO == id_rechazada:
            return jsonify({"error": "Ya rechazada"}), 400

        # ✅ Actualizar Estado
        solicitud.ID_ESTADO = id_rechazada
        solicitud.FECHA_CIERRE = datetime.datetime.now()

        obs_actual = solicitud.OBSERVACION_GENERAL or ""
        solicitud.OBSERVACION_GENERAL = f"{obs_actual} | [RECHAZADO]: {motivo}".strip(" |")

        # Datos para notificación (antes de commit)
        cant_items = len(getattr(solicitud, "detalles", []) or [])
        dep_solic = solicitud.dep_solicitante.NOMBRE if getattr(solicitud, "dep_solicitante", None) else ""
        dep_prov = solicitud.dep_proveedor.NOMBRE if getattr(solicitud, "dep_proveedor", None) else "Depósito proveedor"

        # ✅ Notificar al usuario SOLICITANTE
        msg = f"❌ Tu solicitud #{solicitud.ID_SOLICITUD} ({cant_items} items) fue RECHAZADA por {dep_prov}."
        if motivo:
            msg += f" Motivo: {motivo}"

        notif = Notificacion(
            ID_USUARIO=solicitud.ID_USUARIO_SOLICITANTE,
            MENSAJE=msg,
            LEIDA=False,
            FECHA_CREACION=datetime.datetime.now(),
            TIPO="solicitud.rechazada",
            LINK_NOTI=f"/movimientos?tab=pedidos&highlight={solicitud.ID_SOLICITUD}",
            DEPOSITO=dep_solic,
            SENDER=dep_prov,
            META={
                "id_solicitud": solicitud.ID_SOLICITUD,
                "motivo": motivo,
                "items": cant_items,
                "deposito_proveedor": dep_prov,
            },
        )
        db.session.add(notif)

        db.session.commit()

        print(f"✅ Notificación de rechazo guardada para usuario {solicitud.ID_USUARIO_SOLICITANTE}")
        return jsonify({"success": True, "message": "Solicitud rechazada y notificada"}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error rechazo: {e}")
        return jsonify({"error": str(e)}), 500
