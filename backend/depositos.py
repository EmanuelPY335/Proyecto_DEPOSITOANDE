from flask import Blueprint, jsonify
from db import Deposito
# Asegúrate de NO importar ni usar jwt_required aquí

depositos_bp = Blueprint("depositos", __name__)

# NOTA: No agregamos @jwt_required porque esta ruta debe ser pública para el registro
@depositos_bp.route("/api/depositos", methods=["GET"])
def get_all_depositos():
    try:
        print("✅ Solicitud recibida en /api/depositos (PÚBLICA)")
        depositos = Deposito.query.filter_by(ESTADO_ACTIVO=True).order_by(Deposito.NOMBRE).all()
        
        # Si no tienes campo ESTADO_ACTIVO, usa esta línea en su lugar:
        # depositos = Deposito.query.order_by(Deposito.NOMBRE).all()

        return jsonify([d.to_dict() for d in depositos]), 200
    except Exception as e:
        print(f"❌ Error en get_all_depositos: {e}")
        return jsonify({"msg": "Error interno del servidor"}), 500