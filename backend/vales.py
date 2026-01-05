# backend/vales.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from db import db, Vale, DetalleVale, EstadoVale, MovimientoMaterial, Notificacion
from roles_permisos import role_required # Tu decorador existente

vales_bp = Blueprint("vales", __name__)

# ---------------------------------------------------------
# 1. CREAR VALE (Personal Inventario prepara la carga)
# ---------------------------------------------------------
@vales_bp.route("/vales", methods=["POST"])
@jwt_required()
def crear_vale():
    """
    El personal de inventario recibe la orden, carga el camión (en sistema)
    y genera este Vale. Queda en estado 'Pendiente Aprobación'.
    """
    # TODO: Validar que el usuario sea Personal Inventario o Admin
    data = request.json
    
    try:
        # Aquí se capturan los datos básicos: Origen, Destino, Chofer, Vehiculo
        # Se crean los registros en tabla 'Vale' y 'DetalleVale'
        # Estado inicial = 1 (Pendiente)
        
        # TODO: Crear Notificación para el Admin del depósito Origen ("Tienes un vale por aprobar")
        
        return jsonify({"message": "Vale creado. Esperando aprobación de salida."}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 2. APROBAR SALIDA (Admin Origen) -> INICIO DE TRÁNSITO
# ---------------------------------------------------------
@vales_bp.route("/vales/<int:id_vale>/aprobar_salida", methods=["PUT"])
@jwt_required()
def aprobar_salida(id_vale):
    """
    El Admin revisa el vale. Si aprueba:
    1. Se descuenta el stock del depósito origen (Movimiento Salida).
    2. El estado cambia a 'En Tránsito'.
    3. Se registra fecha de salida.
    4. Se habilita el link al mapa GPS.
    """
    # TODO: Verificar que sea Admin del depósito origen
    
    try:
        # LÓGICA FUTURA:
        # - Buscar Lotes disponibles (FIFO o selección manual).
        # - Crear registros en MovimientoMaterial (Tipo: "Salida por Traslado").
        # - Actualizar estado Vale -> En Tránsito.
        
        return jsonify({"message": "Salida aprobada. Camión en ruta."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 3. CONFIRMAR LLEGADA (Admin Destino) -> FIN DE PROCESO
# ---------------------------------------------------------
@vales_bp.route("/vales/<int:id_vale>/confirmar_recepcion", methods=["PUT"])
@jwt_required()
def confirmar_recepcion(id_vale):
    """
    El camión llegó. El Admin destino verifica y aprueba.
    1. Se suma el stock al depósito destino (Movimiento Entrada).
    2. El estado cambia a 'Finalizado'.
    """
    # TODO: Verificar que sea Admin del depósito destino
    
    try:
        # LÓGICA FUTURA:
        # - Crear registros en MovimientoMaterial (Tipo: "Entrada por Traslado").
        # - Actualizar estado Vale -> Finalizado.
        
        return jsonify({"message": "Recepción confirmada. Inventario actualizado."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------
# 4. VER DETALLE Y MAPA
# ---------------------------------------------------------
@vales_bp.route("/vales/<int:id_vale>", methods=["GET"])
@jwt_required()
def get_detalle_vale(id_vale):
    """
    Muestra info del vale. Si está 'En Tránsito', devuelve también 
    la última ubicación GPS del vehículo asociado.
    """
    # TODO: Retornar JSON con datos del vale, chofer y items.
    # Si estado == En Tránsito, buscar en tabla 'registro_gps' la ultima lat/long del vehiculo.
    return jsonify({"message": "Detalle del vale"}), 200

# ---------------------------------------------------------
# 5. GESTIÓN DE ERRORES (ANULAR / BORRAR)
# ---------------------------------------------------------
@vales_bp.route("/vales/<int:id_vale>/anular", methods=["PUT"])
@jwt_required()
def anular_vale(id_vale):
    """
    Si hubo un error (camión averiado, error de carga).
    Debe revertir los movimientos de stock si ya habían salido.
    """
    # TODO: Lógica compleja de reversión de stock.
    return jsonify({"message": "Vale anulado"}), 200

@vales_bp.route("/vales/<int:id_vale>", methods=["DELETE"])
@jwt_required()
def delete_vale_permanente(id_vale):
    """
    Solo Master_Admin puede borrar historial permanentemente.
    """
    claims = get_jwt()
    if claims.get("rol_nombre") != "Master_Admin":
        return jsonify({"error": "Solo Master Admin puede eliminar registros históricos."}), 403
        
    # TODO: Borrar de la BD
    return jsonify({"message": "Registro eliminado permanentemente"}), 200