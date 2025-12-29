# backend/seed_permisos.py
from main import app
from db import db

# Modelo simple para verificar existencia (Si no está en db.py, lo definimos temporalmente aqui)
# Asegúrate de que tu db.py tenga la clase Permiso mapeada correctamente.
from db import Permiso 

PERMISOS_BASE = [
    {"nombre": "ver_dashboard", "desc": "Acceso al panel principal y métricas"},
    {"nombre": "gestion_empleados", "desc": "Crear, editar y ver empleados"},
    {"nombre": "gestion_materiales", "desc": "Ver inventario, crear materiales y lotes"},
    {"nombre": "gestion_movimientos", "desc": "Realizar transferencias y recepciones"},
    {"nombre": "ver_mapa", "desc": "Acceso al rastreo GPS en tiempo real"},
    {"nombre": "gestion_ordenes", "desc": "Crear y asignar órdenes de trabajo"},
    {"nombre": "gestion_roles", "desc": "Configurar roles y permisos del sistema"},
    {"nombre": "reportar_daños", "desc": "Marcar stock como dañado o averiado"},
]

def sembrar_permisos():
    with app.app_context():
        print("--- 🌱 SEMBRANDO PERMISOS ---")
        conteo = 0
        for p in PERMISOS_BASE:
            existe = Permiso.query.filter_by(NOMBRE_PERMISO=p["nombre"]).first()
            if not existe:
                nuevo = Permiso(NOMBRE_PERMISO=p["nombre"], DESCRIPCION=p["desc"])
                db.session.add(nuevo)
                conteo += 1
        
        db.session.commit()
        print(f"✅ Se agregaron {conteo} nuevos permisos al sistema.")

if __name__ == "__main__":
    sembrar_permisos()