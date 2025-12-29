# backend/materiales.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from db import db, Material, Lote, Inventario, Deposito, EstadoInventario
from datetime import datetime

materiales_bp = Blueprint("materiales", __name__)

# -----------------------------------------------------------------
# 📦 RUTAS PRINCIPALES DE MATERIALES (Catálogo General)
# -----------------------------------------------------------------

@materiales_bp.route("/materiales", methods=["GET"])
@jwt_required()
def get_materiales():
    claims = get_jwt()
    rol = claims.get("rol_nombre")
    if rol not in ["Master_Admin", "Admin", "Personal_Inventario"]:
        return jsonify({"error": "Acceso denegado."}), 403

    try:
        materiales = Material.query.order_by(Material.CATEGORIA, Material.NOMBRE).all()
        return jsonify([m.to_dict() for m in materiales]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@materiales_bp.route("/materiales", methods=["POST"])
@jwt_required()
def create_material():
    claims = get_jwt()
    rol = claims.get("rol_nombre")
    if rol not in ["Master_Admin", "Admin", "Personal_Inventario"]:
        return jsonify({"error": "No tienes permisos."}), 403

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
    claims = get_jwt()
    if claims.get("rol_nombre") not in ["Master_Admin", "Admin", "Personal_Inventario"]:
        return jsonify({"error": "Sin permisos."}), 403

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
    claims = get_jwt()
    if claims.get("rol_nombre") not in ["Master_Admin", "Admin"]:
        return jsonify({"error": "Solo Gerentes pueden eliminar."}), 403

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

# 1. VER LOS LOTES DE UN MATERIAL (Vital para el modal de transferencias)
@materiales_bp.route("/materiales/<int:id>/lotes", methods=["GET"])
@jwt_required()
def get_lotes_material(id):
    try:
        # Buscamos el inventario asociado a los lotes de este material
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
                
                # DATOS DEL DEPÓSITO (Importantes para transferencias)
                "deposito": item.deposito.NOMBRE,
                "deposito_id": item.ID_DEPOSITO,  # <--- ESTO ES LO QUE NECESITABA EL FRONTEND

                "estado": item.estado.ESTADO_INVENTARIO if item.estado else "Disponible",
                "observaciones": item.lote.OBSERVACIONES
            })
        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# 2. RECEPCIÓN / ALTA DE MATERIAL (Crea Lote + Inventario)
@materiales_bp.route("/lotes/ingreso", methods=["POST"])
@jwt_required()
def ingresar_lote():
    claims = get_jwt()
    if claims.get("rol_nombre") not in ["Master_Admin", "Admin", "Personal_Inventario"]:
        return jsonify({"error": "Sin permisos."}), 403

    data = request.json
    try:
        # 1. Validar datos
        id_material = data.get("id_material")
        id_deposito = data.get("id_deposito")
        cantidad = float(data.get("cantidad", 0))
        fecha_str = data.get("fecha_ingreso") # Formato YYYY-MM-DD
        
        if cantidad <= 0:
            return jsonify({"error": "La cantidad debe ser positiva"}), 400

        # 2. Crear el Registro de Lote (Historia de origen)
        nuevo_lote = Lote(
            ID_MATERIAL=id_material,
            FECHA_INGRESO=datetime.strptime(fecha_str, '%Y-%m-%d'),
            OBSERVACIONES=data.get("observaciones", "Recepción Inicial")
        )
        db.session.add(nuevo_lote)
        db.session.flush() # Generar ID

        # 3. Buscar estado "Disponible" (o crearlo)
        estado = EstadoInventario.query.filter_by(ESTADO_INVENTARIO="Disponible").first()
        if not estado:
            estado = EstadoInventario(ESTADO_INVENTARIO="Disponible")
            db.session.add(estado)
            db.session.flush()

        # 4. Crear Inventario (Ubicación física)
        nuevo_inventario = Inventario(
            ID_DEPOSITO=id_deposito,
            ID_LOTE=nuevo_lote.ID_LOTE,
            ID_ESTADO_INVENTARIO=estado.ID_ESTADO_INVENTARIO,
            CANTIDAD_ACTUAL=cantidad
        )
        db.session.add(nuevo_inventario)

        # 5. Actualizar contador total (Para vista rápida)
        material = Material.query.get(id_material)
        if material:
            material.CANTIDAD += cantidad

        db.session.commit()
        return jsonify({"success": True, "message": "Recepción registrada correctamente."}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
# backend/materiales.py

@materiales_bp.route("/inventario/<int:id>/estado", methods=["PUT"])
@jwt_required()
def cambiar_estado_inventario(id):
    claims = get_jwt()
    # Solo encargados pueden reportar daños
    if claims.get("rol_nombre") not in ["Master_Admin", "Admin", "Personal_Inventario"]:
        return jsonify({"error": "Sin permisos."}), 403

    data = request.json
    nuevo_estado_nombre = data.get("estado") # Ej: "Dañado", "Cuarentena", "Disponible"

    try:
        item = Inventario.query.get(id)
        if not item:
            return jsonify({"error": "Item no encontrado"}), 404

        # Buscar ID del estado (o crearlo si no existe)
        estado_db = EstadoInventario.query.filter_by(ESTADO_INVENTARIO=nuevo_estado_nombre).first()
        if not estado_db:
            estado_db = EstadoInventario(ESTADO_INVENTARIO=nuevo_estado_nombre)
            db.session.add(estado_db)
            db.session.flush()

        item.ID_ESTADO_INVENTARIO = estado_db.ID_ESTADO_INVENTARIO
        
        # Opcional: Agregar observación al lote sobre el cambio
        observacion_extra = f" | Estado cambiado a {nuevo_estado_nombre} el {datetime.now().strftime('%d/%m/%Y')}"
        # Asegurarnos de no superar el largo de la columna
        if item.lote.OBSERVACIONES:
            item.lote.OBSERVACIONES = (item.lote.OBSERVACIONES + observacion_extra)[:254]
        else:
            item.lote.OBSERVACIONES = observacion_extra

        db.session.commit()
        return jsonify({"success": True, "message": f"Estado actualizado a {nuevo_estado_nombre}"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500