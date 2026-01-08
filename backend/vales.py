# backend/vales.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import uuid
# Importamos OrdenTrabajo y Empleado para poder usarlos
from db import db, Vale, DetalleVale, Notificacion, Usuario, Vehiculo, OrdenTrabajo, Empleado

vales_bp = Blueprint("vales", __name__)

@vales_bp.route("/vehiculos", methods=["GET"])
@jwt_required()
def get_vehiculos():
    try:
        vehiculos = Vehiculo.query.all()
        resultado = []
        for v in vehiculos:
            resultado.append({
                "id": v.ID_VEHICULO,
                "nombre": f"{v.MARCA} {v.MODELO} ({v.MATRICULA})"
            })
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@vales_bp.route("/vales", methods=["POST"])
@jwt_required()
def crear_vale():
    data = request.json
    current_user_id = get_jwt_identity()
    
    usuario = Usuario.query.get(current_user_id)
    if not usuario or usuario.rol.NOMBRE_ROL not in ["Master_Admin", "Personal_Inventario"]:
        return jsonify({"error": "No tienes permiso para crear traslados."}), 403

    try:
        route_group_id = f"R-{uuid.uuid4().hex[:8].upper()}"
        
        if not data.get('stops') or len(data['stops']) == 0:
            return jsonify({"error": "La ruta debe tener al menos una parada"}), 400

        created_vales = []
        total_items = 0

        # 1. CREAR VALES (Documentos de traslado)
        for stop in data['stops']:
            nuevo_vale = Vale(
                ID_USUARIO_CREADOR=current_user_id,
                ID_DEPOSITO_ORIGEN=data['id_origen'],
                ID_DEPOSITO_DESTINO=stop['id_destino'],
                ID_CHOFER=data['id_chofer'],
                ID_VEHICULO=data['id_vehiculo'],
                FECHA_CREACION=datetime.now(),
                ID_ESTADO_VALE=1, 
                OBSERVACIONES=data.get('observacion', ''),
                GRUPO_RUTA=route_group_id 
            )
            db.session.add(nuevo_vale)
            db.session.flush()

            for item in stop['items']:
                detalle = DetalleVale(
                    ID_VALE=nuevo_vale.ID_VALE,
                    ID_LOTE=item['id_lote'],
                    ID_MATERIAL=item['id_material'],
                    CANTIDAD_SOLICITADA=float(item['cantidad'])
                )
                db.session.add(detalle)
                total_items += 1
                
            created_vales.append(nuevo_vale.ID_VALE)

        # 2. CREAR ORDEN DE TRABAJO (Tarea para el chofer)
        id_chofer_empleado = data['id_chofer'] # El select envía ID_EMPLEADO
        
        nueva_orden = OrdenTrabajo(
            ID_EMPLEADO=id_chofer_empleado,
            ID_DEPOSITO=data['id_origen'], # Depósito base de la orden
            ID_ESTADO_ORDEN=1, # 1 = Pendiente
            TITULO=f"Ruta de Reparto {route_group_id}",
            DESCRIPCION=f"Realizar entrega de {total_items} items en {len(data['stops'])} destinos. Vehículo asignado.",
            PRIORIDAD="Alta",
            FECHA_INICIO=datetime.now(),
            TIPO_ORDEN="Logistica"
        )
        db.session.add(nueva_orden)
        db.session.flush()

        # 3. NOTIFICAR AL CHOFER (Con Link al Mapa)
        # Buscamos al usuario que corresponde a ese empleado chofer
        usuario_chofer = Usuario.query.filter_by(ID_EMPLEADO=id_chofer_empleado).first()
        
        if usuario_chofer:
            noti = Notificacion(
                ID_USUARIO=usuario_chofer.ID_USUARIO,
                MENSAJE=f"🚚 Nueva Ruta Asignada: {route_group_id}. Toca aquí para ver el mapa.",
                LEIDA=False,
                FECHA_CREACION=datetime.now(),
                ID_ORDEN=nueva_orden.ID_ORDEN,
                TIPO="Ruta",      # Icono especial
                LINK="/mapa"      # Redirección directa
            )
            db.session.add(noti)

        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": f"Ruta generada y orden #{nueva_orden.ID_ORDEN} creada.",
            "grupo_ruta": route_group_id,
            "orden_id": nueva_orden.ID_ORDEN
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error creando vale: {str(e)}") 
        return jsonify({"error": str(e)}), 500

# ... (Mantén el resto de las rutas igual: aprobar, confirmar, detalle, etc.)
@vales_bp.route("/vales/<int:id_vale>/aprobar_salida", methods=["PUT"])
@jwt_required()
def aprobar_salida(id_vale):
    return jsonify({"message": "Pendiente"}), 200

@vales_bp.route("/vales/<int:id_vale>/confirmar_recepcion", methods=["PUT"])
@jwt_required()
def confirmar_recepcion(id_vale):
    return jsonify({"message": "Pendiente"}), 200

@vales_bp.route("/vales/<int:id_vale>", methods=["GET"])
@jwt_required()
def get_detalle_vale(id_vale):
    return jsonify({"message": "Detalle"}), 200

@vales_bp.route("/vales/<int:id_vale>/anular", methods=["PUT"])
@jwt_required()
def anular_vale(id_vale):
    return jsonify({"message": "Anulado"}), 200

@vales_bp.route("/vales/<int:id_vale>", methods=["DELETE"])
@jwt_required()
def delete_vale_permanente(id_vale):
    return jsonify({"message": "Eliminado"}), 200