# backend/asistencia.py
import math
from flask import Blueprint, request, jsonify
from datetime import datetime, date
from sqlalchemy import func
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import db, Asistencia, Deposito, Empleado, Usuario
from audit_service import registrar_auditoria

asistencia_bp = Blueprint("asistencia", __name__)

QR_SECRETO = "SISDEPO-ENTRADA-PRINCIPAL"


def calcular_distancia(lat1, lon1, lat2, lon2):
    """Calcula la distancia en metros entre dos coordenadas (Haversine)"""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 999999.0

    R = 6371000
    try:
        lat1, lon1, lat2, lon2 = float(lat1), float(lon1), float(lat2), float(lon2)
    except Exception:
        return 999999.0

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _to_iso(dt):
    try:
        return dt.isoformat() if dt else None
    except Exception:
        return None


def _get_empleado_from_usuario(usuario: Usuario, fallback_id=None):
    """
    Resuelve Empleado de forma robusta:
    1) usuario.empleado (relación)
    2) usuario.ID_EMPLEADO (columna FK si existe)
    3) fallback: Empleado.query.get(fallback_id) (modo legacy)
    """
    try:
        if usuario is not None:
            emp_rel = getattr(usuario, "empleado", None)
            if emp_rel and getattr(emp_rel, "ID_EMPLEADO", None):
                return emp_rel

            fk = getattr(usuario, "ID_EMPLEADO", None)
            if fk:
                emp_fk = Empleado.query.get(int(fk))
                if emp_fk and getattr(emp_fk, "ID_EMPLEADO", None):
                    return emp_fk
    except Exception:
        pass

    try:
        if fallback_id is not None:
            emp = Empleado.query.get(int(fallback_id))
            if emp and getattr(emp, "ID_EMPLEADO", None):
                return emp
    except Exception:
        pass

    return None


def _resolve_empleado_id(id_any):
    """
    Acepta ID_USUARIO o ID_EMPLEADO y devuelve ID_EMPLEADO real.
    Orden importante: primero Usuario (si está vinculado), luego Empleado directo.
    """
    if id_any is None:
        return None

    # 1) probar como Usuario (preferido)
    try:
        u = Usuario.query.get(int(id_any))
        if u:
            emp = _get_empleado_from_usuario(u, fallback_id=None)
            if emp and getattr(emp, "ID_EMPLEADO", None):
                return int(emp.ID_EMPLEADO)
            # si no hay relación, seguimos probando como empleado
    except Exception:
        pass

    # 2) probar como Empleado
    try:
        emp = Empleado.query.get(int(id_any))
        if emp and getattr(emp, "ID_EMPLEADO", None):
            return int(emp.ID_EMPLEADO)
    except Exception:
        pass

    return None


def _resolve_usuario_id_por_empleado(id_empleado):
    try:
        u = Usuario.query.filter_by(ID_EMPLEADO=int(id_empleado)).first()
        if u and getattr(u, "ID_USUARIO", None):
            return int(u.ID_USUARIO)
    except Exception:
        pass
    return None


def _asistencia_to_dict(a: Asistencia):
    if not a:
        return None

    eid = getattr(a, "ID_EMPLEADO", None)
    uid = _resolve_usuario_id_por_empleado(eid) if eid else None

    entrada = getattr(a, "FECHA_HORA_ENTRADA", None)
    salida = getattr(a, "FECHA_HORA_SALIDA", None)

    return {
        "id_asistencia": getattr(a, "ID_ASISTENCIA", None),
        "id_empleado": eid,
        "usuario_id": uid,
        "entrada_iso": _to_iso(entrada),
        "salida_iso": _to_iso(salida),
        "latitud": float(getattr(a, "LATITUD_MARCADO", 0) or 0),
        "longitud": float(getattr(a, "LONGITUD_MARCADO", 0) or 0),
        "metodo": getattr(a, "METODO", None) or "",
        "estado_hoy": "EN_JORNADA" if salida is None else "SALIO",
    }

@asistencia_bp.route("/qr-marcar", methods=["POST"])
@jwt_required()
def marcar_asistencia():
    try:
        user_id = get_jwt_identity()
        try:
            user_id_int = int(user_id)
        except Exception:
            user_id_int = user_id

        data = request.get_json()
        if not data:
            return jsonify({"success": False, "msg": "No se recibieron datos JSON"}), 400

        qr_leido = data.get("qr_content")
        lat_usuario = data.get("latitud")
        lon_usuario = data.get("longitud")

        if not all([qr_leido, lat_usuario, lon_usuario]):
            return jsonify({"success": False, "msg": "Faltan datos de GPS o QR."}), 400

        if qr_leido != QR_SECRETO:
            return jsonify({"success": False, "msg": "Código QR incorrecto."}), 403

        usuario = Usuario.query.get(user_id_int)
        if not usuario:
            return jsonify({"success": False, "msg": "Usuario no encontrado."}), 404

        empleado_obj = _get_empleado_from_usuario(usuario, fallback_id=user_id_int)
        if not empleado_obj:
            return jsonify({"success": False, "msg": "No tienes un perfil de empleado asociado."}), 404

        deposito_asignado = getattr(empleado_obj, "deposito", None)
        if not deposito_asignado:
            return jsonify({"success": False, "msg": "No tienes un depósito asignado. Contacta a RRHH."}), 403

        dep_lat = getattr(deposito_asignado, "LATITUD", getattr(deposito_asignado, "latitud", None))
        dep_lon = getattr(deposito_asignado, "LONGITUD", getattr(deposito_asignado, "longitud", None))

        if dep_lat is None or dep_lon is None or float(dep_lat) == 0:
            return jsonify({"success": False, "msg": f"El depósito '{deposito_asignado.NOMBRE}' no tiene coordenadas configuradas."}), 500

        val_radio = getattr(deposito_asignado, "RADIO_MTS", getattr(deposito_asignado, "radio_mts", 80.0))
        radio_permitido = float(val_radio) if val_radio else 80.0

        distancia = calcular_distancia(lat_usuario, lon_usuario, dep_lat, dep_lon)

        if distancia > radio_permitido:
            return jsonify({
                "success": False,
                "msg": f"Estás muy lejos de {deposito_asignado.NOMBRE}. Distancia: {int(distancia)}m (Máx: {int(radio_permitido)}m).",
            }), 403

        hoy = date.today()
        ahora_datetime = datetime.now()

        registro = Asistencia.query.filter(
            Asistencia.ID_EMPLEADO == empleado_obj.ID_EMPLEADO,
            func.date(Asistencia.FECHA_HORA_ENTRADA) == hoy
        ).first()

        tipo_accion = "ASISTENCIA_ENTRADA"
        detalle_accion = f"Marcó entrada en {deposito_asignado.NOMBRE}"

        if registro:
            if registro.FECHA_HORA_SALIDA is None:
                registro.FECHA_HORA_SALIDA = ahora_datetime
                mensaje = f"👋 Salida registrada en {deposito_asignado.NOMBRE}. ¡Hasta mañana!"
                tipo_accion = "ASISTENCIA_SALIDA"
                detalle_accion = f"Marcó salida en {deposito_asignado.NOMBRE}"
            else:
                return jsonify({"success": False, "msg": "Ya has completado tu jornada de hoy."}), 400
        else:
            nuevo_registro = Asistencia(
                ID_EMPLEADO=empleado_obj.ID_EMPLEADO,
                FECHA_HORA_ENTRADA=ahora_datetime,
                LATITUD_MARCADO=lat_usuario,
                LONGITUD_MARCADO=lon_usuario,
                METODO="QR",
            )
            db.session.add(nuevo_registro)
            mensaje = f"🚀 Entrada registrada en {deposito_asignado.NOMBRE}. ¡Buen trabajo!"

        db.session.commit()

        # ✅ AUDITORÍA INYECTADA
        registrar_auditoria(
            usuario_id=usuario.ID_USUARIO,
            accion_corta=tipo_accion,
            detalle_largo=detalle_accion,
            tabla="asistencia",
            id_registro=registro.ID_ASISTENCIA if registro else nuevo_registro.ID_ASISTENCIA,
            id_deposito_force=deposito_asignado.ID_DEPOSITO
        )

        return jsonify({"success": True, "msg": mensaje})

    except Exception as e:
        db.session.rollback()
        print(f"ERROR CRÍTICO: {e}")
        return jsonify({"success": False, "msg": f"Error interno: {str(e)}"}), 500


# =========================================================
# ✅ ENDPOINTS DE LECTURA
# =========================================================

@asistencia_bp.route("/resumen-hoy", methods=["GET"])
@jwt_required()
def resumen_hoy():
    """Devuelve la asistencia de HOY para todos los empleados (1 registro por empleado)"""
    try:
        hoy = date.today()

        regs = (
            Asistencia.query
            .filter(func.date(Asistencia.FECHA_HORA_ENTRADA) == hoy)
            .order_by(Asistencia.FECHA_HORA_ENTRADA.desc())
            .all()
        )

        seen = set()
        out = []
        for r in regs:
            eid = getattr(r, "ID_EMPLEADO", None)
            if not eid or eid in seen:
                continue
            seen.add(eid)
            out.append(_asistencia_to_dict(r))

        return jsonify(out), 200

    except Exception as e:
        print("❌ Error resumen_hoy:", e)
        return jsonify({"error": str(e)}), 500


@asistencia_bp.route("/empleado/<int:id_any>/hoy", methods=["GET"])
@jwt_required()
def asistencia_empleado_hoy(id_any):
    """Devuelve la asistencia de HOY de un empleado. id_any puede ser ID_USUARIO o ID_EMPLEADO."""
    try:
        id_empleado = _resolve_empleado_id(id_any)
        if not id_empleado:
            return jsonify({"success": True, "data": None}), 200

        hoy = date.today()
        r = (
            Asistencia.query
            .filter(
                Asistencia.ID_EMPLEADO == int(id_empleado),
                func.date(Asistencia.FECHA_HORA_ENTRADA) == hoy
            )
            .order_by(Asistencia.FECHA_HORA_ENTRADA.desc())
            .first()
        )

        return jsonify({"success": True, "data": _asistencia_to_dict(r) if r else None}), 200

    except Exception as e:
        print("❌ Error asistencia_empleado_hoy:", e)
        return jsonify({"error": str(e)}), 500


@asistencia_bp.route("/empleado/<int:id_any>/ultimas", methods=["GET"])
@jwt_required()
def asistencia_empleado_ultimas(id_any):
    """Devuelve últimas N asistencias del empleado. id_any puede ser ID_USUARIO o ID_EMPLEADO."""
    try:
        id_empleado = _resolve_empleado_id(id_any)
        if not id_empleado:
            return jsonify({"success": True, "items": []}), 200

        limit = request.args.get("limit", 10)
        try:
            limit = int(limit)
        except Exception:
            limit = 10
        limit = max(1, min(limit, 50))

        regs = (
            Asistencia.query
            .filter(Asistencia.ID_EMPLEADO == int(id_empleado))
            .order_by(Asistencia.FECHA_HORA_ENTRADA.desc())
            .limit(limit)
            .all()
        )

        out = [_asistencia_to_dict(r) for r in regs]
        return jsonify({"success": True, "items": out}), 200

    except Exception as e:
        print("❌ Error asistencia_empleado_ultimas:", e)
        return jsonify({"error": str(e)}), 500
