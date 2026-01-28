# backend/materiales.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text, or_
from db import db, Material, Lote, Inventario, Deposito, EstadoInventario, Usuario
from datetime import datetime

materiales_bp = Blueprint("materiales", __name__)

# ---------------------------------------------------------
# 🛡️ HELPER: VERIFICACIÓN DE PERMISOS
# ---------------------------------------------------------
def tiene_permiso_materiales(tipo="lectura"):
    try:
        current_user_id = get_jwt_identity()
        # 👇 FIX: identity viene string en tu login
        try:
            current_user_id = int(current_user_id)
        except:
            pass

        usuario = Usuario.query.get(current_user_id)
        if not usuario or not usuario.rol:
            return False

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

def _get_usuario_actual():
    uid = get_jwt_identity()
    try:
        uid = int(uid)
    except:
        pass
    return Usuario.query.get(uid)

def _get_rol_nombre(usuario):
    try:
        return str(usuario.rol.NOMBRE_ROL) if usuario and usuario.rol else ""
    except:
        return ""

def _get_deposito_id(usuario):
    try:
        if usuario and usuario.empleado and usuario.empleado.ID_DEPOSITO:
            return int(usuario.empleado.ID_DEPOSITO)
    except:
        pass
    return None

# -----------------------------------------------------------------
# 📦 RUTAS PRINCIPALES (Sin cambios mayores)
# -----------------------------------------------------------------
@materiales_bp.route("/materiales", methods=["GET"])
@jwt_required()
def get_materiales():
    if not tiene_permiso_materiales():
        return jsonify({"error": "Acceso denegado"}), 403

    try:
        search_query = request.args.get('q', '').strip()

        query = Material.query

        # 1. FILTRADO (WHERE)
        if search_query:
            search_pattern = f"%{search_query}%"
            query = query.filter(
                or_(
                    Material.NOMBRE.ilike(search_pattern),
                    Material.CODIGO_UNICO.ilike(search_pattern)
                )
            )

        # 2. ORDENAMIENTO (ORDER BY)
        query = query.order_by(Material.CATEGORIA, Material.NOMBRE)

        # 3. LÍMITE (LIMIT)
        if search_query:
            query = query.limit(20)

        # 4. EJECUTAR
        materiales = query.all()

        return jsonify([m.to_dict() for m in materiales]), 200

    except Exception as e:
        print(f"Error buscando materiales: {e}")
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
            STOCK_MINIMO=data.get("stock_minimo", 5),
            FACTOR_PUNTOS=data.get("factor_puntos", 1)
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
        if not material:
            return jsonify({"error": "No encontrado"}), 404

        if request.method == "DELETE":
            db.session.delete(material)
            db.session.commit()
            return jsonify({"success": True, "message": "Eliminado"}), 200

        data = request.json
        if "cantidad" in data:
            material.CANTIDAD = float(data["cantidad"])
        if "nombre" in data:
            material.NOMBRE = data["nombre"]
        if "categoria" in data:
            material.CATEGORIA = data["categoria"]
        if "unidad_medida" in data:
            material.UNIDAD_MEDIDA = data["unidad_medida"]
        if "stock_minimo" in data:
            material.STOCK_MINIMO = float(data["stock_minimo"])
        db.session.commit()
        return jsonify({"success": True, "message": "Actualizado"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -----------------------------------------------------------------
# 🚚 GESTIÓN DE LOTES
# -----------------------------------------------------------------
@materiales_bp.route("/materiales/<int:id>/lotes", methods=["GET"])
@jwt_required()
def get_lotes_material(id):
    if not tiene_permiso_materiales():
        return jsonify({"error": "Acceso denegado"}), 403
    try:
        # ✅ NO mostrar "Eliminado" (soft delete)
        estado_elim = EstadoInventario.query.filter_by(ESTADO_INVENTARIO="Eliminado").first()

        query = Inventario.query.join(Lote).filter(Lote.ID_MATERIAL == id)
        if estado_elim:
            query = query.filter(Inventario.ID_ESTADO_INVENTARIO != estado_elim.ID_ESTADO_INVENTARIO)

        items = query.all()

        resultado = []
        for item in items:
            resultado.append({
                "id_inventario": item.ID_INVENTARIO,
                "lote_id": item.ID_LOTE,
                "codigo": item.lote.CODIGO,
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
        codigo_lote = data.get("codigo")

        if cantidad <= 0:
            return jsonify({"error": "Cantidad inválida"}), 400

        nuevo_lote = Lote(
            ID_MATERIAL=id_material,
            FECHA_INGRESO=datetime.strptime(fecha_str, '%Y-%m-%d'),
            OBSERVACIONES=data.get("observaciones", "Recepción"),
            CODIGO=codigo_lote
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
        return jsonify({"success": True, "message": "Ingreso registrado"}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@materiales_bp.route("/inventario/<int:id>/estado", methods=["PUT"])
@jwt_required()
def cambiar_estado_inventario(id):
    if not tiene_permiso_materiales():
        return jsonify({"error": "Sin permisos"}), 403
    data = request.json
    nuevo_estado = data.get("estado")
    try:
        item = Inventario.query.get(id)
        if not item:
            return jsonify({"error": "No encontrado"}), 404

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


# =========================================================
# ✅ NUEVO: DELETE INVENTARIO (SOFT) + (PERMA SOLO MASTER)
# =========================================================

@materiales_bp.route("/inventario/<int:id_inventario>", methods=["DELETE"])
@jwt_required()
def soft_delete_inventario(id_inventario):
    if not tiene_permiso_materiales():
        return jsonify({"error": "Sin permisos"}), 403

    usuario = _get_usuario_actual()
    if not usuario:
        return jsonify({"error": "No autorizado"}), 401

    rol = _get_rol_nombre(usuario)
    rol_lower = rol.lower()
    dep_user = _get_deposito_id(usuario)

    try:
        inv = Inventario.query.get(id_inventario)
        if not inv:
            return jsonify({"error": "No encontrado"}), 404

        # ✅ Admin/Personal_Inventario/roles no Master: solo su depósito
        if rol_lower != "master_admin":
            if not dep_user or int(inv.ID_DEPOSITO) != int(dep_user):
                return jsonify({"error": "Forbidden"}), 403

        # Estado "Eliminado"
        estado_elim = EstadoInventario.query.filter_by(ESTADO_INVENTARIO="Eliminado").first()
        if not estado_elim:
            estado_elim = EstadoInventario(ESTADO_INVENTARIO="Eliminado")
            db.session.add(estado_elim)
            db.session.flush()

        # Ajuste stock material (resta lo actual)
        qty = float(inv.CANTIDAD_ACTUAL or 0)
        try:
            mat = inv.lote.material if inv.lote else None
            if mat and qty > 0:
                mat.CANTIDAD = max(0, float(mat.CANTIDAD or 0) - qty)
        except:
            pass

        # Soft: 0 + estado eliminado
        inv.CANTIDAD_ACTUAL = 0
        inv.ID_ESTADO_INVENTARIO = estado_elim.ID_ESTADO_INVENTARIO

        # Nota en observaciones del lote
        try:
            nota = f" | Eliminado (soft) {datetime.now().strftime('%d/%m %H:%M')}"
            inv.lote.OBSERVACIONES = (inv.lote.OBSERVACIONES or "") + nota
        except:
            pass

        db.session.commit()
        return jsonify({"success": True, "mode": "soft"}), 200

    except Exception as e:
        db.session.rollback()
        print("soft_delete_inventario error:", e)
        return jsonify({"error": "Error en el servidor"}), 500


@materiales_bp.route("/inventario/<int:id_inventario>/perma", methods=["DELETE"])
@jwt_required()
def perma_delete_inventario(id_inventario):
    usuario = _get_usuario_actual()
    if not usuario:
        return jsonify({"error": "No autorizado"}), 401

    if _get_rol_nombre(usuario) != "Master_Admin":
        return jsonify({"error": "Solo Master_Admin"}), 403

    try:
        inv = Inventario.query.get(id_inventario)
        if not inv:
            return jsonify({"error": "No encontrado"}), 404

        qty = float(inv.CANTIDAD_ACTUAL or 0)
        try:
            mat = inv.lote.material if inv.lote else None
            if mat and qty > 0:
                mat.CANTIDAD = max(0, float(mat.CANTIDAD or 0) - qty)
        except:
            pass

        db.session.delete(inv)
        db.session.commit()
        return jsonify({"success": True, "mode": "perma"}), 200

    except Exception as e:
        db.session.rollback()
        print("perma_delete_inventario error:", e)
        return jsonify({"error": "Error en el servidor"}), 500
