from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import db, Notificacion, Usuario, Vale, SolicitudStock
from datetime import datetime

notificaciones_bp = Blueprint('notificaciones', __name__)

# --- HELPERS (Calculan links para tus notificaciones viejas con NULL) ---
def obtener_link_por_tipo(mensaje, id_referencia=None):
    if not mensaje: return "#"
    msg_lower = mensaje.lower()
    if "ruta" in msg_lower: return "/Mapa"
    if any(x in msg_lower for x in ["orden", "tarea", "asignación"]): 
        return f"/ordenes-trabajo?id={id_referencia}" if id_referencia else "/ordenes-trabajo"
    if "solicitud" in msg_lower or "pedido" in msg_lower: return "/movimientos?tab=pedidos"
    return "#"

def detectar_tipo_visual(mensaje, tipo_bd=None):
    if tipo_bd: return tipo_bd
    if not mensaje: return "Info"
    msg_lower = mensaje.lower()
    if "rechaz" in msg_lower or "cancelad" in msg_lower: return "Alerta"
    if "ruta" in msg_lower: return "Ruta"
    if "solicitud" in msg_lower or "pedido" in msg_lower: return "Pedido"
    if "llegada" in msg_lower or "aprobada" in msg_lower: return "Check"
    if "orden" in msg_lower: return "Orden"
    if "vale" in msg_lower: return "Vale"
    return "Info"

# --- LÓGICA DE SINCRONIZACIÓN (Aquí guardamos en LINK_NOTI) ---
def sincronizar_eventos(usuario):
    rol_nombre = usuario.rol.NOMBRE_ROL
    mi_deposito_id = usuario.empleado.ID_DEPOSITO if usuario.empleado else None
    nuevas = []

    # 1. ADMINS: Solicitudes Pendientes
    if rol_nombre in ["Master_Admin", "Admin"]:
        q_sol = SolicitudStock.query.filter_by(ID_ESTADO=1)
        if rol_nombre == "Admin" and mi_deposito_id:
            q_sol = q_sol.filter_by(ID_DEPOSITO_PROVEEDOR=mi_deposito_id)
        
        for s in q_sol.all():
            link_ref = f"/movimientos?tab=pedidos&highlight={s.ID_SOLICITUD}"
            
            # Verificamos usando LINK_NOTI
            existe = Notificacion.query.filter_by(ID_USUARIO=usuario.ID_USUARIO, LINK_NOTI=link_ref).first()
            
            if not existe:
                cant = len(s.detalles)
                dep_nom = s.dep_solicitante.NOMBRE if s.dep_solicitante else "Depósito"
                nueva = Notificacion(
                    ID_USUARIO=usuario.ID_USUARIO,
                    MENSAJE=f"📦 Solicitud #{s.ID_SOLICITUD}: {dep_nom} pide {cant} items.",
                    TIPO="Pedido",
                    LEIDA=False,
                    FECHA_CREACION=s.FECHA_SOLICITUD,
                    LINK_NOTI=link_ref, # <-- AQUÍ USAMOS TU NOMBRE DE COLUMNA
                    STARRED=False
                )
                db.session.add(nueva)
                nuevas.append(nueva)

    # 2. CHOFERES: Rutas Asignadas
    if rol_nombre == "Chofer":
        rutas = Vale.query.filter_by(ID_CHOFER=usuario.ID_USUARIO, ID_ESTADO_VALE=2).all()
        for r in rutas:
            link_ref = f"/Mapa?ruta={r.ID_VALE}"
            existe = Notificacion.query.filter_by(ID_USUARIO=usuario.ID_USUARIO, LINK_NOTI=link_ref).first()

            if not existe:
                nueva = Notificacion(
                    ID_USUARIO=usuario.ID_USUARIO,
                    MENSAJE=f"🚚 Ruta Asignada #{r.GRUPO_RUTA} a {r.destino.NOMBRE}",
                    TIPO="Ruta",
                    LEIDA=False,
                    FECHA_CREACION=r.FECHA_CREACION,
                    LINK_NOTI=link_ref, # <-- AQUÍ TAMBIÉN
                    STARRED=False
                )
                db.session.add(nueva)
                nuevas.append(nueva)
    
    if nuevas:
        db.session.commit()

# ================= RUTAS =================

@notificaciones_bp.route('/notificaciones', methods=['GET'])
@jwt_required()
def get_notificaciones_menu():
    current_user_id = get_jwt_identity()
    usuario = Usuario.query.get(current_user_id)
    if not usuario: return jsonify([]), 404

    sincronizar_eventos(usuario)

    notis = Notificacion.query.filter_by(ID_USUARIO=current_user_id)\
        .order_by(Notificacion.FECHA_CREACION.desc()).limit(20).all()

    data = []
    for n in notis:
        # Lógica híbrida: Si LINK_NOTI es null, calculamos el link al vuelo
        link_final = n.LINK_NOTI if n.LINK_NOTI else obtener_link_por_tipo(n.MENSAJE)

        data.append({
            "id": n.ID_NOTIFICACION,
            "mensaje": n.MENSAJE,
            "leida": n.LEIDA,
            "fecha_display": n.FECHA_CREACION.strftime('%d/%m %H:%M'),
            "fecha_iso": n.FECHA_CREACION.isoformat(),
            "tipo": detectar_tipo_visual(n.MENSAJE, getattr(n, 'TIPO', None)),
            "link": link_final # Enviamos al frontend como "link" genérico
        })
    return jsonify(data), 200

@notificaciones_bp.route('/buzon', methods=['GET'])
@jwt_required()
def get_buzon_completo():
    current_user_id = get_jwt_identity()
    
    notis = Notificacion.query.filter_by(ID_USUARIO=current_user_id)\
        .order_by(Notificacion.FECHA_CREACION.desc()).limit(100).all()

    data = []
    for n in notis:
        # Lógica híbrida para registros viejos con NULL
        link_final = n.LINK_NOTI if n.LINK_NOTI else obtener_link_por_tipo(n.MENSAJE)

        data.append({
            "id": n.ID_NOTIFICACION,
            "mensaje": n.MENSAJE,
            "leida": n.LEIDA,
            "starred": getattr(n, 'STARRED', False),
            "fecha": n.FECHA_CREACION.strftime('%d/%m/%Y %H:%M'),
            "fecha_iso": n.FECHA_CREACION.isoformat(),
            "tipo": detectar_tipo_visual(n.MENSAJE, getattr(n, 'TIPO', None)),
            "link": link_final,
            "sender": "Sistema SISDEPO",
            "deposito": "" 
        })
    return jsonify(data), 200

# --- CRUD BÁSICO ---

@notificaciones_bp.route('/notificaciones/leer/<string:id_str>', methods=['PUT'])
@jwt_required()
def marcar_leida_menu(id_str):
    try:
        id_clean = id_str.replace("db-", "")
        n = Notificacion.query.get(int(id_clean))
        if n and n.ID_USUARIO == get_jwt_identity():
            n.LEIDA = True
            db.session.commit()
            return jsonify({"success": True})
    except: pass
    return jsonify({"error": "No encontrado"}), 404

@notificaciones_bp.route('/buzon/<int:id>/leer', methods=['PUT'])
@jwt_required()
def buzon_leer(id):
    n = Notificacion.query.get_or_404(id)
    n.LEIDA = True
    db.session.commit()
    return jsonify({"success": True})

@notificaciones_bp.route('/buzon/<int:id>/noleer', methods=['PUT'])
@jwt_required()
def buzon_noleer(id):
    n = Notificacion.query.get_or_404(id)
    n.LEIDA = False
    db.session.commit()
    return jsonify({"success": True})

@notificaciones_bp.route('/buzon/<int:id>/star', methods=['PUT'])
@jwt_required()
def buzon_star(id):
    n = Notificacion.query.get_or_404(id)
    if hasattr(n, 'STARRED'):
        n.STARRED = request.json.get('starred', True)
        db.session.commit()
    return jsonify({"success": True})

@notificaciones_bp.route('/buzon/<int:id>', methods=['DELETE'])
@jwt_required()
def buzon_delete(id):
    n = Notificacion.query.get_or_404(id)
    db.session.delete(n)
    db.session.commit()
    return jsonify({"success": True})

@notificaciones_bp.route('/buzon/batch', methods=['DELETE'])
@jwt_required()
def buzon_batch_delete():
    ids = request.json.get('ids', [])
    if ids:
        Notificacion.query.filter(Notificacion.ID_NOTIFICACION.in_(ids)).delete(synchronize_session=False)
        db.session.commit()
    return jsonify({"success": True})

@notificaciones_bp.route('/buzon/batch/read', methods=['PUT'])
@jwt_required()
def buzon_batch_read():
    ids = request.json.get('ids', [])
    if ids:
        Notificacion.query.filter(Notificacion.ID_NOTIFICACION.in_(ids)).update({Notificacion.LEIDA: True}, synchronize_session=False)
        db.session.commit()
    return jsonify({"success": True})