# backend/seed_data.py
from main import app
from db import db, EstadoVale, EstadoSolicitud, EstadoOrden

def seed_database():
    with app.app_context():
        print("🌱 Iniciando carga de datos maestros...")

        # 1. ESTADOS DE VALES (Traslados)
        estados_vale = [
            (1, "Pendiente Aprobación"),
            (2, "Aprobado / En Tránsito"),
            (3, "Finalizado / Recibido"),
            (4, "Rechazado / Anulado")
        ]
        
        print("   -> Verificando tabla 'estado_vale'...")
        for id_est, nombre in estados_vale:
            existe = EstadoVale.query.get(id_est)
            if not existe:
                # Usamos 'estado_vale' como definiste en tu db.py
                nuevo = EstadoVale(ID_ESTADO_VALE=id_est, estado_vale=nombre)
                db.session.add(nuevo)
                print(f"      + Creado: {nombre}")

        # 2. ESTADOS DE SOLICITUDES (Pedidos)
        estados_solicitud = [
            (1, "Pendiente"),
            (2, "En Proceso"),
            (3, "Completado"),
            (4, "Cancelado")
        ]
        print("   -> Verificando tabla 'estado_solicitud'...")
        for id_est, nombre in estados_solicitud:
            existe = EstadoSolicitud.query.get(id_est)
            if not existe:
                nuevo = EstadoSolicitud(ID_ESTADO=id_est, NOMBRE=nombre)
                db.session.add(nuevo)
                print(f"      + Creado: {nombre}")

        try:
            db.session.commit()
            print("✅ ¡Base de datos actualizada con éxito!")
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error al guardar: {str(e)}")

if __name__ == "__main__":
    seed_database()