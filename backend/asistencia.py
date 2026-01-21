# backend/asistencia.py - VERSIÓN FINAL SEGURA
import math
from flask import Blueprint, request, jsonify
from datetime import datetime, date
from sqlalchemy import func
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import db, Asistencia, Deposito, Empleado, Usuario

asistencia_bp = Blueprint('asistencia', __name__)

QR_SECRETO = "SISDEPO-ENTRADA-PRINCIPAL"

def calcular_distancia(lat1, lon1, lat2, lon2):
    """Calcula la distancia en metros entre dos coordenadas (Haversine)"""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 999999.0
    R = 6371000 # Radio de la Tierra en metros
    try:
        lat1, lon1, lat2, lon2 = float(lat1), float(lon1), float(lat2), float(lon2)
    except ValueError:
        return 999999.0
        
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2) * math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@asistencia_bp.route('/qr-marcar', methods=['POST'])
@jwt_required()
def marcar_asistencia():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data:
            return jsonify({"success": False, "msg": "No se recibieron datos JSON"}), 400

        qr_leido = data.get('qr_content')
        lat_usuario = data.get('latitud')
        lon_usuario = data.get('longitud')

        # 1. Validación de Datos Recibidos
        if not all([qr_leido, lat_usuario, lon_usuario]):
            return jsonify({"success": False, "msg": "Faltan datos de GPS o QR."}), 400

        if qr_leido != QR_SECRETO:
            return jsonify({"success": False, "msg": "Código QR incorrecto."}), 403

        # 2. Identificar al Empleado
        usuario = Usuario.query.get(user_id)
        if not usuario:
            return jsonify({"success": False, "msg": "Usuario no encontrado."}), 404
            
        # Buscamos el objeto empleado
        empleado_obj = None
        if usuario.empleado:
            empleado_obj = usuario.empleado
        else:
            empleado_obj = Empleado.query.get(user_id)
            
        if not empleado_obj:
            return jsonify({"success": False, "msg": "No tienes un perfil de empleado asociado."}), 404

        # 3. OBTENER EL DEPÓSITO ASIGNADO AL USUARIO (SEGURIDAD)
        # En lugar de buscar "cualquiera", buscamos SU depósito
        deposito_asignado = empleado_obj.deposito 
        
        if not deposito_asignado:
            return jsonify({
                "success": False, 
                "msg": "No tienes un depósito asignado. Contacta a RRHH."
            }), 403

        # 4. Validar Coordenadas del Depósito
        dep_lat = getattr(deposito_asignado, 'LATITUD', getattr(deposito_asignado, 'latitud', None))
        dep_lon = getattr(deposito_asignado, 'LONGITUD', getattr(deposito_asignado, 'longitud', None))

        if dep_lat is None or dep_lon is None or float(dep_lat) == 0:
            return jsonify({
                "success": False, 
                "msg": f"El depósito '{deposito_asignado.NOMBRE}' no tiene coordenadas configuradas."
            }), 500

        # 5. Calcular Distancia Real
        # Obtenemos el radio permitido (por defecto 80 metros)
        val_radio = getattr(deposito_asignado, 'RADIO_MTS', getattr(deposito_asignado, 'radio_mts', 80.0))
        radio_permitido = float(val_radio) if val_radio else 80.0

        distancia = calcular_distancia(lat_usuario, lon_usuario, dep_lat, dep_lon)

        print(f"DEBUG: Empleado: {empleado_obj.NOMBRE} | Deposito: {deposito_asignado.NOMBRE} | Dist: {distancia:.2f}m")

        if distancia > radio_permitido:
             return jsonify({
                "success": False, 
                "msg": f"Estás muy lejos de {deposito_asignado.NOMBRE}. Distancia: {int(distancia)}m (Máx: {int(radio_permitido)}m)."
            }), 403

        # 6. Registrar Asistencia
        hoy = date.today()
        ahora_datetime = datetime.now()

        # Verificar si ya marcó hoy
        registro = Asistencia.query.filter(
            Asistencia.ID_EMPLEADO == empleado_obj.ID_EMPLEADO,
            func.date(Asistencia.FECHA_HORA_ENTRADA) == hoy
        ).first()

        if registro:
            if registro.FECHA_HORA_SALIDA is None:
                registro.FECHA_HORA_SALIDA = ahora_datetime
                mensaje = f"👋 Salida registrada en {deposito_asignado.NOMBRE}. ¡Hasta mañana!"
            else:
                return jsonify({"success": False, "msg": "Ya has completado tu jornada de hoy."}), 400
        else:
            # Nueva entrada
            nuevo_registro = Asistencia(
                ID_EMPLEADO=empleado_obj.ID_EMPLEADO,
                FECHA_HORA_ENTRADA=ahora_datetime,
                LATITUD_MARCADO=lat_usuario,
                LONGITUD_MARCADO=lon_usuario,
                METODO='QR'
            )
            db.session.add(nuevo_registro)
            mensaje = f"🚀 Entrada registrada en {deposito_asignado.NOMBRE}. ¡Buen trabajo!"

        db.session.commit()
        return jsonify({"success": True, "msg": mensaje})

    except Exception as e:
        db.session.rollback()
        print(f"ERROR CRÍTICO: {e}")
        return jsonify({"success": False, "msg": f"Error interno: {str(e)}"}), 500