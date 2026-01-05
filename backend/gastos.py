# backend/gastos.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from db import db, Gasto, CategoriaGasto, Usuario, Deposito
from datetime import datetime
from sqlalchemy import func

gastos_bp = Blueprint("gastos", __name__)

# --- 1. OBTENER GASTOS ---
@gastos_bp.route("/gastos", methods=["GET"])
@jwt_required()
def get_gastos():
    claims = get_jwt()
    rol = claims.get("rol_nombre")
    user_id = int(claims.get("sub"))
    
    # Filtros de URL (mes, año)
    mes = request.args.get('mes', type=int)
    year = request.args.get('year', datetime.now().year, type=int)

    query = Gasto.query

    # Si NO es Master Admin, solo ve gastos de su propio depósito (si tiene)
    if rol != "Master_Admin":
        usuario = Usuario.query.get(user_id)
        if usuario.empleado and usuario.empleado.ID_DEPOSITO:
            query = query.filter(Gasto.ID_DEPOSITO == usuario.empleado.ID_DEPOSITO)
        else:
            # Si no tiene depósito (ej. usuario nuevo), ve solo lo suyo
            query = query.filter(Gasto.ID_USUARIO == user_id)

    # Filtro por fecha (opcional)
    if mes:
        query = query.filter(db.extract('month', Gasto.FECHA) == mes)
    
    if year:
        query = query.filter(db.extract('year', Gasto.FECHA) == year)

    # Ordenar por más reciente
    gastos = query.order_by(Gasto.FECHA.desc()).all()
    
    # Calcular Totales
    total = sum(g.MONTO for g in gastos)

    return jsonify({
        "data": [g.to_dict() for g in gastos],
        "total": total
    }), 200

# --- 2. CREAR GASTO ---
@gastos_bp.route("/gastos", methods=["POST"])
@jwt_required()
def create_gasto():
    data = request.json
    claims = get_jwt()
    user_id = int(claims.get("sub"))
    
    try:
        usuario = Usuario.query.get(user_id)
        id_deposito = usuario.empleado.ID_DEPOSITO if usuario.empleado else None

        # Si es Master Admin, puede que mande el depósito en el body
        if claims.get("rol_nombre") == "Master_Admin" and data.get("id_deposito"):
            id_deposito = data.get("id_deposito")

        nuevo_gasto = Gasto(
            TITULO=data.get("titulo"),
            DESCRIPCION=data.get("descripcion"),
            MONTO=float(data.get("monto")),
            FECHA=datetime.strptime(data.get("fecha"), "%Y-%m-%dT%H:%M") if data.get("fecha") else datetime.now(),
            ID_CATEGORIA=int(data.get("id_categoria")),
            ID_USUARIO=user_id,
            ID_DEPOSITO=id_deposito
        )

        db.session.add(nuevo_gasto)
        db.session.commit()

        return jsonify({"success": True, "message": "Gasto registrado exitosamente."}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- 3. ELIMINAR GASTO ---
@gastos_bp.route("/gastos/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_gasto(id):
    gasto = Gasto.query.get(id)
    if not gasto: return jsonify({"error": "No encontrado"}), 404
    
    # Validar permisos (Solo el creador o Admin pueden borrar)
    claims = get_jwt()
    user_id = int(claims.get("sub"))
    rol = claims.get("rol_nombre")

    if gasto.ID_USUARIO != user_id and rol not in ["Master_Admin", "Admin"]:
        return jsonify({"error": "No autorizado"}), 403

    db.session.delete(gasto)
    db.session.commit()
    return jsonify({"success": True}), 200

# --- 4. LISTAR CATEGORIAS ---
@gastos_bp.route("/gastos/categorias", methods=["GET"])
@jwt_required()
def get_categorias():
    cats = CategoriaGasto.query.all()
    return jsonify([{"id": c.ID_CATEGORIA, "nombre": c.NOMBRE} for c in cats]), 200