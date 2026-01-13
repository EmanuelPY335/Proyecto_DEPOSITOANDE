# Si no tienes un archivo específico, ponlo en app.py o crea uno nuevo
from flask import Blueprint, jsonify
from db import Deposito # Asegúrate de importar el modelo

depositos_bp = Blueprint("depositos", __name__)

@depositos_bp.route("/api/depositos", methods=["GET"])
def get_all_depositos():
    try:
        depositos = Deposito.query.all()
        # Usamos el método to_dict() que ya tienes definido en tu modelo Deposito
        return jsonify([d.to_dict() for d in depositos]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500