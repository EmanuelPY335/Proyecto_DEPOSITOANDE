# backend/materiales.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text
from db import db, Material, Lote, Inventario, Deposito, EstadoInventario, Usuario
from datetime import datetime

materiales_bp = Blueprint("materiales", __name__)

# ---------------------------------------------------------
# 🛡️ HELPER: VERIFICACIÓN DE PERMISOS
# ---------------------------------------------------------
def tiene_permiso_materiales(tipo="lectura"):
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(current_user_id)
        if not usuario or not usuario.rol: return False
        
        # Superusuarios y Personal Inventario
        if usuario.rol.NOMBRE_ROL in ["Master_Admin", "Admin", "Personal_Inventario"]:
            return True

        # Verificación Dinámica
        sql = text("""
            SELECT 1 FROM permiso_x_rol pxr
            JOIN permiso p ON pxr.ID_PERMISO = p.ID_PERMISO
            WHERE pxr.ID_ROL = :id_rol AND p.NOMBRE_PERMISO = 'gestion_materiales'
        """)
        resultado = db.session.execute(sql, {'id_rol': usuario.ID_ROL}).fetchone()
        return True if resultado else False
    except Exception as e:
        print(f"Error permisos: {e}")
        return False

# -----------------------------------------------------------------
# 📦 RUTAS PRINCIPALES (Sin cambios mayores)
# -----------------------------------------------------------------
@materiales_bp.route("/materiales", methods=["GET"])
@jwt_required()
def get_materiales():
    if not tiene_permiso_materiales():
        return jsonify({"error": "Acceso denegado"}), 403
    try:
        materiales = Material.query.order_by(Material.CATEGORIA, Material.NOMBRE).all()
        return jsonify([m.to_dict() for m in materiales]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@materiales_bp.route("/materiales", methods=["POST"])
@jwt_required()
def create_material():
    if not tiene_permiso_materiales():
        return jsonify({"error": "Sin permisos"}), 403
    data = request.json
    try:
        if Material.query.filter_by(CODIGO_UNICO=data.get("codigo_unico")).first():
            return jsonify({"error": "Código único ya existe"}), 400
        nuevo = Material(
            CODIGO_UNICO=data.get("codigo_unico"),
            NOMBRE=data.get("nombre"),
            CANTIDAD=data.get("cantidad", 0),
            UNIDAD_MEDIDA=data.get("unidad_medida"),
            CATEGORIA=data.get("categoria"),
            STOCK_MINIMO=data.get("stock_minimo", 5)
        )
        db.session.add(nuevo)
        db.session.commit()
        return jsonify({"success": True, "message": "Creado"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@materiales_bp.route("/materiales/<int:id>", methods=["PUT", "DELETE"])
@jwt_required()
def modify_material(id):
    if not tiene_permiso_materiales():
        return jsonify({"error": "Sin permisos"}), 403
    try:
        material = Material.query.get(id)
        if not material: return jsonify({"error": "No encontrado"}), 404
        
        if request.method == "DELETE":
            db.session.delete(material)
            db.session.commit()
            return jsonify({"success": True, "message": "Eliminado"}), 200
            
        data = request.json
        if "cantidad" in data: material.CANTIDAD = float(data["cantidad"])
        if "nombre" in data: material.NOMBRE = data["nombre"]
        if "categoria" in data: material.CATEGORIA = data["categoria"]
        if "unidad_medida" in data: material.UNIDAD_MEDIDA = data["unidad_medida"]
        if "stock_minimo" in data: material.STOCK_MINIMO = float(data["stock_minimo"])
        db.session.commit()
        return jsonify({"success": True, "message": "Actualizado"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------------------------------------------
# 🚚 GESTIÓN DE LOTES (AQUÍ ESTÁ LA MAGIA DEL CÓDIGO ÚNICO)
# -----------------------------------------------------------------

@materiales_bp.route("/materiales/<int:id>/lotes", methods=["GET"])
@jwt_required()
def get_lotes_material(id):
    if not tiene_permiso_materiales():
        return jsonify({"error": "Acceso denegado"}), 403
    try:
        # Join Inventario -> Lote -> Deposito
        items = Inventario.query.join(Lote).filter(Lote.ID_MATERIAL == id).all()
        resultado = []
        for item in items:
            resultado.append({
                "id_inventario": item.ID_INVENTARIO,
                "lote_id": item.ID_LOTE,
                "codigo": item.lote.CODIGO,  # <--- ENVÍO DEL CÓDIGO AL FRONTEND
                "cantidad": item.CANTIDAD_ACTUAL,
                "fecha_ingreso": item.lote.FECHA_INGRESO.strftime('%Y-%m-%d'),
                "deposito": item.deposito.NOMBRE,
                "deposito_id": item.ID_DEPOSITO,
                "estado": item.estado.ESTADO_INVENTARIO if item.estado else "Disponible",
                "observaciones": item.lote.OBSERVACIONES
            })
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@materiales_bp.route("/lotes/ingreso", methods=["POST"])
@jwt_required()
def ingresar_lote():
    if not tiene_permiso_materiales():
        return jsonify({"error": "Sin permisos"}), 403
    data = request.json
    try:
        id_material = data.get("id_material")
        id_deposito = data.get("id_deposito")
        cantidad = float(data.get("cantidad", 0))
        fecha_str = data.get("fecha_ingreso")
        codigo_lote = data.get("codigo") # <--- RECIBIMOS EL CÓDIGO
        
        if cantidad <= 0: return jsonify({"error": "Cantidad inválida"}), 400

        # Crear Lote con el CÓDIGO
        nuevo_lote = Lote(
            ID_MATERIAL=id_material,
            FECHA_INGRESO=datetime.strptime(fecha_str, '%Y-%m-%d'),
            OBSERVACIONES=data.get("observaciones", "Recepción"),
            CODIGO=codigo_lote  # <--- GUARDAMOS EL CÓDIGO EN BD
        )
        db.session.add(nuevo_lote)
        db.session.flush()

        # Gestión Estado Inventario
        estado = EstadoInventario.query.filter_by(ESTADO_INVENTARIO="Disponible").first()
        if not estado:
            estado = EstadoInventario(ESTADO_INVENTARIO="Disponible")
            db.session.add(estado)
            db.session.flush()

        nuevo_inventario = Inventario(
            ID_DEPOSITO=id_deposito,
            ID_LOTE=nuevo_lote.ID_LOTE,
            ID_ESTADO_INVENTARIO=estado.ID_ESTADO_INVENTARIO,
            CANTIDAD_ACTUAL=cantidad
        )
        db.session.add(nuevo_inventario)

        material = Material.query.get(id_material)
        if material: material.CANTIDAD += cantidad

        db.session.commit()
        return jsonify({"success": True, "message": "Ingreso registrado"}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@materiales_bp.route("/inventario/<int:id>/estado", methods=["PUT"])
@jwt_required()
def cambiar_estado_inventario(id):
    if not tiene_permiso_materiales(): return jsonify({"error": "Sin permisos"}), 403
    data = request.json
    nuevo_estado = data.get("estado")
    try:
        item = Inventario.query.get(id)
        if not item: return jsonify({"error": "No encontrado"}), 404

        estado_db = EstadoInventario.query.filter_by(ESTADO_INVENTARIO=nuevo_estado).first()
        if not estado_db:
            estado_db = EstadoInventario(ESTADO_INVENTARIO=nuevo_estado)
            db.session.add(estado_db)
            db.session.flush()

        item.ID_ESTADO_INVENTARIO = estado_db.ID_ESTADO_INVENTARIO
        
        nota = f" | Estado -> {nuevo_estado} ({datetime.now().strftime('%d/%m')})"
        item.lote.OBSERVACIONES = (item.lote.OBSERVACIONES or "") + nota

        db.session.commit()
        return jsonify({"success": True, "message": "Estado actualizado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500