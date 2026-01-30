from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import db, Gasto, CategoriaGasto, Vehiculo, Usuario, Deposito
from sqlalchemy import extract, desc
from roles_permisos import permission_required
from audit_service import registrar_auditoria

gastos_bp = Blueprint('gastos', __name__)

# --- GET: OBTENER GASTOS (CON FILTROS DE FECHA Y SEGURIDAD POR DEPÓSITO) ---
@gastos_bp.route('/gastos', methods=['GET'])
@permission_required("gestion_gastos")
@jwt_required()
def get_gastos():
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(current_user_id)

    if not usuario:
        return jsonify({"error": "Usuario no encontrado"}), 404

    # 1. Obtener parámetros de filtro (Mes y Año)
    mes = request.args.get('mes')
    year = request.args.get('year')

    # Iniciar la consulta base
    query = Gasto.query

    # 2. SEGURIDAD: FILTRADO POR DEPÓSITO
    # Si NO es Master Admin, restringimos la vista a su depósito asignado
    if usuario.rol.NOMBRE_ROL != "Master_Admin":
        if usuario.empleado and usuario.empleado.ID_DEPOSITO:
            # Esta es la línea clave: Filtra gastos que coincidan con el depósito del usuario
            query = query.filter(Gasto.ID_DEPOSITO == usuario.empleado.ID_DEPOSITO)
        else:
            # Si el usuario no tiene depósito asignado (raro), no ve nada por seguridad
            return jsonify([]), 200
    
    # (Si es Master_Admin, no entra al if y ve todo, o puedes agregar lógica para que elija depósito)

    # 3. APLICAR FILTROS DE FECHA (Si vienen en la URL)
    if mes and year:
        try:
            query = query.filter(extract('month', Gasto.FECHA) == int(mes))
            query = query.filter(extract('year', Gasto.FECHA) == int(year))
        except ValueError:
            pass # Si los datos no son números válidos, ignoramos el filtro

    # Ordenar por fecha descendente (más nuevo primero)
    gastos = query.order_by(desc(Gasto.FECHA)).all()

    # 4. FORMATEAR RESPUESTA
    resultado = []
    for g in gastos:
        # Obtener nombres relacionados
        nombre_cat = g.categoria.NOMBRE if g.categoria else "Sin Categoría"
        nombre_vehiculo = g.vehiculo.MATRICULA if g.vehiculo else None
        nombre_deposito = g.deposito.NOMBRE if g.deposito else "Sin Depósito" # Útil para el PDF

        # Colores para las categorías (Visual)
        color_badge = "#64748b" # Gris default
        cat_lower = nombre_cat.lower()
        if "viáticos" in cat_lower: color_badge = "#f59e0b" # Naranja
        elif "mantenimiento" in cat_lower: color_badge = "#ef4444" # Rojo
        elif "insumos" in cat_lower: color_badge = "#3b82f6" # Azul
        elif "servicios" in cat_lower: color_badge = "#10b981" # Verde

        resultado.append({
            "id": g.ID_GASTO,
            "titulo": g.TITULO,
            "descripcion": g.DESCRIPCION,
            "monto": g.MONTO,
            "fecha": g.FECHA.strftime('%d/%m/%Y %H:%M') if g.FECHA else "-",
            "fecha_iso": g.FECHA.strftime('%Y-%m-%d') if g.FECHA else "", # Para ordenar en tabla
            "categoria": nombre_cat,
            "categoria_id": g.ID_CATEGORIA,
            "vehiculo": nombre_vehiculo,
            "deposito": nombre_deposito, # Enviamos el nombre del depósito al frontend
            "color": color_badge
        })

    return jsonify(resultado), 200

# --- GET: DATOS AUXILIARES (CATEGORÍAS Y VEHÍCULOS) ---
@gastos_bp.route('/gastos/auxiliar', methods=['GET'])
@permission_required("gestion_gastos")
@jwt_required()
def get_auxiliares():
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(current_user_id)

    # Categorías
    categorias = CategoriaGasto.query.all()
    cats_data = [{"id": c.ID_CATEGORIA, "nombre": c.NOMBRE} for c in categorias]

    # Vehículos
    # Lógica: Master Admin ve todos, los demás solo los de su depósito (si la tabla vehiculo tiene ID_DEPOSITO)
    # Si Vehiculo no tiene ID_DEPOSITO, mostramos todos (o ajusta según tu modelo)
    query_veh = Vehiculo.query
    
    # Opcional: Filtrar vehículos por depósito si tu tabla Vehiculo tiene esa columna
    # if usuario.rol.NOMBRE_ROL != "Master_Admin" and usuario.empleado.ID_DEPOSITO:
    #    if hasattr(Vehiculo, 'ID_DEPOSITO'):
    #        query_veh = query_veh.filter_by(ID_DEPOSITO=usuario.empleado.ID_DEPOSITO)

    vehiculos = query_veh.all()
    vehs_data = [{"id": v.ID_VEHICULO, "nombre": f"{v.MARCA} - {v.MATRICULA}"} for v in vehiculos]

    return jsonify({
        "categorias": cats_data,
        "vehiculos": vehs_data
    }), 200

# --- POST: CREAR GASTO ---
# --- POST: CREAR GASTO (AUDITADO) ---
@gastos_bp.route('/gastos', methods=['POST'])
@permission_required("gestion_gastos")
@jwt_required()
def create_gasto():
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(current_user_id)
    data = request.json

    if not data.get('titulo') or not data.get('monto') or not data.get('categoria_id'):
        return jsonify({"error": "Faltan datos obligatorios"}), 400

    id_deposito_usuario = usuario.empleado.ID_DEPOSITO if usuario.empleado else None
    if usuario.rol.NOMBRE_ROL == "Master_Admin" and data.get('id_deposito'):
         id_deposito_usuario = data.get('id_deposito')

    nuevo_gasto = Gasto(
        TITULO=data['titulo'],
        DESCRIPCION=data.get('descripcion', ''),
        MONTO=data['monto'],
        FECHA=db.func.current_timestamp(),
        ID_CATEGORIA=data['categoria_id'],
        ID_USUARIO=current_user_id,
        ID_DEPOSITO=id_deposito_usuario,
        ID_VEHICULO=data.get('id_vehiculo') if data.get('id_vehiculo') else None
    )

    try:
        db.session.add(nuevo_gasto)
        db.session.commit()

        # ✅ AUDITORÍA INYECTADA
        registrar_auditoria(
            usuario_id=current_user_id,
            accion_corta="CREAR_GASTO",
            detalle_largo=f"Registró gasto: {data['titulo']} por {data['monto']} Gs.",
            tabla="gasto",
            id_registro=nuevo_gasto.ID_GASTO,
            id_deposito_force=id_deposito_usuario
        )

        return jsonify({"message": "Gasto registrado"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- DELETE: ELIMINAR GASTO (AUDITADO) ---
@gastos_bp.route('/gastos/<int:id>', methods=['DELETE'])
@permission_required("gestion_gastos")
@jwt_required()
def delete_gasto(id):
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(current_user_id)
    
    gasto = Gasto.query.get_or_404(id)

    es_master = usuario.rol.NOMBRE_ROL == "Master_Admin"
    es_mi_deposito = usuario.empleado and usuario.empleado.ID_DEPOSITO == gasto.ID_DEPOSITO

    if not es_master and not es_mi_deposito:
        return jsonify({"error": "No tienes permiso para eliminar este gasto"}), 403

    try:
        info_gasto = f"{gasto.TITULO} ({gasto.MONTO})"
        id_dep_gasto = gasto.ID_DEPOSITO
        
        db.session.delete(gasto)
        db.session.commit()

        # ✅ AUDITORÍA INYECTADA
        registrar_auditoria(
            usuario_id=current_user_id,
            accion_corta="BORRAR_GASTO",
            detalle_largo=f"Eliminó el gasto: {info_gasto}",
            tabla="gasto",
            id_registro=id,
            id_deposito_force=id_dep_gasto
        )

        return jsonify({"message": "Eliminado"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500