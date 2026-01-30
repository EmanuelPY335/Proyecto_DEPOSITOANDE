# backend/materiales.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import text, or_, bindparam
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


def _fmt_date(d):
    try:
        return d.strftime('%Y-%m-%d') if d else None
    except:
        return None


# =========================================================
# ✅ NUEVO: Resolver sector/ubicación por inventario (bulk)
# =========================================================
def _bulk_sector_map_by_inventario(inv_ids):
    """
    Devuelve dict: { ID_INVENTARIO: {sector_codigo, sector_nombre, ubicacion_detalle} }
    Usa SQL directo para no depender de modelos nuevos.
    """
    if not inv_ids:
        return {}

    try:
        q = text("""
            SELECT
              inv.ID_INVENTARIO AS id_inventario,
              s.CODIGO AS sector_codigo,
              s.NOMBRE AS sector_nombre,
              inv.UBICACION_DETALLE AS ubicacion_detalle
            FROM inventario inv
            LEFT JOIN deposito_sector s ON s.ID_SECTOR = inv.ID_SECTOR
            WHERE inv.ID_INVENTARIO IN :ids
        """).bindparams(bindparam("ids", expanding=True))

        rows = db.session.execute(q, {"ids": inv_ids}).mappings().all()
        out = {}
        for r in rows:
            out[int(r["id_inventario"])] = {
                "sector_codigo": r.get("sector_codigo"),
                "sector_nombre": r.get("sector_nombre"),
                "ubicacion_detalle": r.get("ubicacion_detalle"),
            }
        return out
    except Exception as e:
        # Si aún no creaste tabla/columnas, no rompemos el endpoint:
        print("Sector map error (puede faltar migración):", e)
        return {}


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

        # ✅ NEW: traer sector/ubicación en bulk por inventario
        inv_ids = [int(i.ID_INVENTARIO) for i in items if i and i.ID_INVENTARIO]
        sector_map = _bulk_sector_map_by_inventario(inv_ids)

        resultado = []
        for item in items:
            loc = sector_map.get(int(item.ID_INVENTARIO), {}) if item and item.ID_INVENTARIO else {}

            resultado.append({
                "id_inventario": item.ID_INVENTARIO,
                "id_lote": item.ID_LOTE,
                "lote_id": item.ID_LOTE,  # por compatibilidad
                "codigo": item.lote.CODIGO,
                "cantidad": item.CANTIDAD_ACTUAL,
                "fecha_ingreso": _fmt_date(item.lote.FECHA_INGRESO),
                "deposito": item.deposito.NOMBRE,
                "deposito_id": item.ID_DEPOSITO,
                "estado": item.estado.ESTADO_INVENTARIO if item.estado else "Disponible",
                "observaciones": item.lote.OBSERVACIONES,

                # ✅ NUEVO: ubicación
                "sector_codigo": loc.get("sector_codigo"),
                "sector_nombre": loc.get("sector_nombre"),
                "ubicacion_detalle": loc.get("ubicacion_detalle"),
            })

        return jsonify(resultado), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@materiales_bp.route("/lotes/ingreso", methods=["POST"])
@jwt_required()
def ingresar_lote():
    if not tiene_permiso_materiales():
        return jsonify({"error": "Sin permisos"}), 403
    data = request.json or {}
    try:
        id_material = data.get("id_material")
        id_deposito = data.get("id_deposito")
        cantidad = float(data.get("cantidad", 0))
        fecha_str = data.get("fecha_ingreso")
        codigo_lote = data.get("codigo")

        # ✅ NUEVO (opcionales): ubicación inicial
        id_sector = data.get("id_sector")  # ideal
        ubicacion_detalle = (data.get("ubicacion_detalle") or "").strip() or None

        if cantidad <= 0:
            return jsonify({"error": "Cantidad inválida"}), 400

        nuevo_lote = Lote(
            ID_MATERIAL=id_material,
            FECHA_INGRESO=datetime.strptime(fecha_str, '%Y-%m-%d') if fecha_str else None,
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
        db.session.flush()

        # ✅ Guardar ubicación SIN depender del modelo (SQL directo)
        # (requiere migración: inventario.ID_SECTOR, inventario.UBICACION_DETALLE)
        if id_sector is not None or ubicacion_detalle is not None:
            try:
                q = text("""
                    UPDATE inventario
                    SET ID_SECTOR = :id_sector,
                        UBICACION_DETALLE = :ubic
                    WHERE ID_INVENTARIO = :id_inv
                """)
                db.session.execute(q, {
                    "id_sector": int(id_sector) if id_sector is not None else None,
                    "ubic": ubicacion_detalle,
                    "id_inv": int(nuevo_inventario.ID_INVENTARIO)
                })
            except Exception as e:
                # si no existe la migración todavía, no rompemos el ingreso
                print("No pude setear ubicación (puede faltar migración):", e)

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
    data = request.json or {}
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
# ✅ NUEVO: ACTUALIZAR UBICACIÓN (sector + detalle)
# =========================================================
@materiales_bp.route("/inventario/<int:id_inventario>/ubicacion", methods=["PUT"])
@jwt_required()
def actualizar_ubicacion_inventario(id_inventario):
    if not tiene_permiso_materiales():
        return jsonify({"error": "Sin permisos"}), 403

    usuario = _get_usuario_actual()
    if not usuario:
        return jsonify({"error": "No autorizado"}), 401

    rol_lower = _get_rol_nombre(usuario).lower()
    dep_user = _get_deposito_id(usuario)

    data = request.json or {}
    id_sector = data.get("id_sector")
    ubicacion_detalle = (data.get("ubicacion_detalle") or "").strip() or None

    try:
        inv = Inventario.query.get(id_inventario)
        if not inv:
            return jsonify({"error": "No encontrado"}), 404

        # scoping: no master -> solo su depósito
        if rol_lower != "master_admin":
            if not dep_user or int(inv.ID_DEPOSITO) != int(dep_user):
                return jsonify({"error": "Forbidden"}), 403

        # update directo
        q = text("""
            UPDATE inventario
            SET ID_SECTOR = :id_sector,
                UBICACION_DETALLE = :ubic
            WHERE ID_INVENTARIO = :id_inv
        """)
        db.session.execute(q, {
            "id_sector": int(id_sector) if id_sector is not None else None,
            "ubic": ubicacion_detalle,
            "id_inv": int(id_inventario)
        })

        # nota opcional en observaciones
        try:
            nota = f" | Ubicación -> sector:{id_sector or '-'} / {ubicacion_detalle or '-'} ({datetime.now().strftime('%d/%m')})"
            inv.lote.OBSERVACIONES = (inv.lote.OBSERVACIONES or "") + nota
        except:
            pass

        db.session.commit()
        return jsonify({"success": True}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# =========================================================
# ✅ NUEVO: DETALLE PARA BOTÓN "INFO" DEL LOTE (por inventario)
# =========================================================
@materiales_bp.route("/inventario/<int:id_inventario>/detalle", methods=["GET"])
@jwt_required()
def detalle_inventario(id_inventario):
    if not tiene_permiso_materiales():
        return jsonify({"error": "Sin permisos"}), 403

    try:
        inv = Inventario.query.get(id_inventario)
        if not inv:
            return jsonify({"error": "No encontrado"}), 404

        # sector/ubicación
        loc = _bulk_sector_map_by_inventario([int(id_inventario)]).get(int(id_inventario), {})

        mat = inv.lote.material if inv.lote else None
        data = {
            "id_inventario": inv.ID_INVENTARIO,
            "id_lote": inv.ID_LOTE,
            "codigo": inv.lote.CODIGO if inv.lote else None,
            "fecha_ingreso": _fmt_date(inv.lote.FECHA_INGRESO) if inv.lote else None,
            "deposito": inv.deposito.NOMBRE if inv.deposito else None,
            "deposito_id": inv.ID_DEPOSITO,
            "cantidad_disponible": inv.CANTIDAD_ACTUAL,
            "estado": inv.estado.ESTADO_INVENTARIO if inv.estado else "Disponible",
            "observaciones": inv.lote.OBSERVACIONES if inv.lote else None,

            "material_nombre": mat.NOMBRE if mat else None,
            "material_codigo": mat.CODIGO_UNICO if mat else None,
            "unidad_medida": mat.UNIDAD_MEDIDA if mat else None,

            "sector_codigo": loc.get("sector_codigo"),
            "sector_nombre": loc.get("sector_nombre"),
            "ubicacion_detalle": loc.get("ubicacion_detalle"),
        }
        return jsonify(data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =========================================================
# ✅ DELETE INVENTARIO (SOFT) + (PERMA SOLO MASTER)
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
