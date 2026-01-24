
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import joinedload
from db import Vehiculo, db

vehiculos_bp = Blueprint("vehiculos", __name__)

@vehiculos_bp.route("/vehiculos", methods=["GET"])
@jwt_required()
def get_vehiculos():
    vehs = Vehiculo.query.options(joinedload(Vehiculo.estado_rel)).all()

    for v in vehs:
        print("✅ VEH:", v.ID_VEHICULO, v.MATRICULA, v.CAPACIDAD_PUNTOS, v.ID_ESTADO,
              (v.estado_rel.NOMBRE if v.estado_rel else None))

    return jsonify([{
        "ID_VEHICULO": v.ID_VEHICULO,
        "MATRICULA": v.MATRICULA,
        "MARCA": v.MARCA,
        "MODELO": v.MODELO,
        "ID_ESTADO": v.ID_ESTADO,
        "CAPACIDAD_PUNTOS": int(v.CAPACIDAD_PUNTOS or 0),
        "estado": (v.estado_rel.NOMBRE if v.estado_rel else "desconocido"),
    } for v in vehs]), 200




