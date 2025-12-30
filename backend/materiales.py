# backend/materiales.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text
from db import db, Material, Lote, Inventario, Deposito, EstadoInventario, Usuario
from datetime import datetime

materiales_bp = Blueprint("materiales", __name__)

# ---------------------------------------------------------
# 🛡️ HELPER: VERIFICACIÓN DE PERMISOS (Dinámico)
# ---------------------------------------------------------
def tiene_permiso_materiales(tipo="lectura"):
    """
    Verifica si el usuario tiene permiso de 'gestion_materiales'.
    Master_Admin y Admin siempre pasan.
    Otros roles se verifican contra la BD.
    """
    try:
        current_user_id = get_jwt_identity()
        usuario = Usuario.query.get(current_user_id)

        if not usuario or not usuario.rol:
            return False

        nombre_rol = usuario.rol.NOMBRE_ROL

        # 1. Acceso Directo para Superusuarios
        if nombre_rol in ["Master_Admin", "Admin"]:
            return True
            
        # 2. Mantener compatibilidad con rol legacy si existe
        if nombre_rol == "Personal_Inventario":
            return True

        # 3. Verificación Dinámica en BD (Tu tabla permiso_x_rol)
        sql = text("""
            SELECT 1 
            FROM permiso_x_rol pxr
            JOIN permiso p ON pxr.ID_PERMISO = p.ID_PERMISO
            WHERE pxr.ID_ROL = :id_rol AND p.NOMBRE_PERMISO = 'gestion_materiales'
        """)
        
        resultado = db.session.execute(sql, {'id_rol': usuario.ID_ROL}).fetchone()
        
        if resultado:
            return True
            
        return False

    except Exception as e:
        print(f"Error verificando permisos materiales: {e}")
        return False

# -----------------------------------------------------------------
# 📦 RUTAS PRINCIPALES DE MATERIALES (Catálogo General)
# -----------------------------------------------------------------

@materiales_bp.route("/materiales", methods=["GET"])
@jwt_required()
def get_materiales():
    # Usamos la nueva verificación dinámica
    if not tiene_permiso_materiales():
        return jsonify({"error": "Acceso denegado. Se requiere permiso de gestión de materiales."}), 403

    try:
        materiales = Material.query.order_by(Material.CATEGORIA, Material.NOMBRE).all()
        return jsonify([m.to_dict() for m in materiales]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@materiales_bp.route("/materiales", methods=["POST"])
@jwt_required()
def create_material():
    if not tiene_permiso_materiales():
        return jsonify({"error": "No tienes permisos para crear materiales."}), 403

    data = request.json
    try:
        existe = Material.query.filter_by(CODIGO_UNICO=data.get("codigo_unico")).first()
        if existe:
            return jsonify({"error": "El código único ya existe."}), 400

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
        return jsonify({"success": True, "message": "Material creado correctamente."}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@materiales_bp.route("/materiales/<int:id>", methods=["PUT"])
@jwt_required()
def update_material(id):
    if not tiene_permiso_materiales():
        return jsonify({"error": "Sin permisos para editar."}), 403

    data = request.json
    try:
        material = Material.query.get(id)
        if not material:
            return jsonify({"error": "Material no encontrado."}), 404

        if "cantidad" in data: material.CANTIDAD = float(data["cantidad"])
        if "nombre" in data: material.NOMBRE = data["nombre"]
        if "categoria" in data: material.CATEGORIA = data["categoria"]
        if "unidad_medida" in data: material.UNIDAD_MEDIDA = data["unidad_medida"]
        if "stock_minimo" in data: material.STOCK_MINIMO = float(data["stock_minimo"])

        db.session.commit()
        return jsonify({"success": True, "message": "Actualizado."}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@materiales_bp.route("/materiales/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_material(id):
    # Ahora quien tenga el permiso 'gestion_materiales' puede eliminar
    # Si quisieras restringir DELETE solo a Admins, cambiarías esta línea.
    if not tiene_permiso_materiales():
        return jsonify({"error": "No tienes permisos para eliminar."}), 403

    try:
        material = Material.query.get(id)
        if not material: return jsonify({"error": "No encontrado"}), 404
        
        db.session.delete(material)
        db.session.commit()
        return jsonify({"success": True, "message": "Eliminado."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------------------------------------------
# 🚚 GESTIÓN DE LOTES E INVENTARIO (Detalle por Depósito)
# -----------------------------------------------------------------

# 1. VER LOS LOTES DE UN MATERIAL
@materiales_bp.route("/materiales/<int:id>/lotes", methods=["GET"])
@jwt_required()
def get_lotes_material(id):
    # Verificamos permiso también aquí para consistencia
    if not tiene_permiso_materiales():
        return jsonify({"error": "Acceso denegado"}), 403

    try:
        items = Inventario.query.join(Lote).filter(Lote.ID_MATERIAL == id).all()
        
        if not items:
            return jsonify([]), 200

        resultado = []
        for item in items:
            resultado.append({
                "id_inventario": item.ID_INVENTARIO,
                "lote_id": item.ID_LOTE,
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


# 2. RECEPCIÓN / ALTA DE MATERIAL
@materiales_bp.route("/lotes/ingreso", methods=["POST"])
@jwt_required()
def ingresar_lote():
    if not tiene_permiso_materiales():
        return jsonify({"error": "Sin permisos para ingresar stock."}), 403

    data = request.json
    try:
        id_material = data.get("id_material")
        id_deposito = data.get("id_deposito")
        cantidad = float(data.get("cantidad", 0))
        fecha_str = data.get("fecha_ingreso")
        
        if cantidad <= 0:
            return jsonify({"error": "La cantidad debe ser positiva"}), 400

        nuevo_lote = Lote(
            ID_MATERIAL=id_material,
            FECHA_INGRESO=datetime.strptime(fecha_str, '%Y-%m-%d'),
            OBSERVACIONES=data.get("observaciones", "Recepción Inicial")
        )
        db.session.add(nuevo_lote)
        db.session.flush()

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
        if material:
            material.CANTIDAD += cantidad

        db.session.commit()
        return jsonify({"success": True, "message": "Recepción registrada correctamente."}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@materiales_bp.route("/inventario/<int:id>/estado", methods=["PUT"])
@jwt_required()
def cambiar_estado_inventario(id):
    if not tiene_permiso_materiales():
        return jsonify({"error": "Sin permisos para modificar inventario."}), 403

    data = request.json
    nuevo_estado_nombre = data.get("estado")

    try:
        item = Inventario.query.get(id)
        if not item:
            return jsonify({"error": "Item no encontrado"}), 404

        estado_db = EstadoInventario.query.filter_by(ESTADO_INVENTARIO=nuevo_estado_nombre).first()
        if not estado_db:
            estado_db = EstadoInventario(ESTADO_INVENTARIO=nuevo_estado_nombre)
            db.session.add(estado_db)
            db.session.flush()

        item.ID_ESTADO_INVENTARIO = estado_db.ID_ESTADO_INVENTARIO
        
        observacion_extra = f" | Estado cambiado a {nuevo_estado_nombre} el {datetime.now().strftime('%d/%m/%Y')}"
        if item.lote.OBSERVACIONES:
            item.lote.OBSERVACIONES = (item.lote.OBSERVACIONES + observacion_extra)[:254]
        else:
            item.lote.OBSERVACIONES = observacion_extra

        db.session.commit()
        return jsonify({"success": True, "message": f"Estado actualizado a {nuevo_estado_nombre}"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500