# backend/update_db_gastos.py
from main import app
from db import db, CategoriaGasto
from sqlalchemy import text

def init_gastos():
    with app.app_context():
        print("🔄 Iniciando reparación de tablas de Gastos...")
        
        # 1. FORZAR LIMPIEZA: Eliminar tablas defectuosas si existen
        # Usamos text() para SQL directo
        try:
            with db.engine.connect() as conn:
                # Desactivamos chequeo de llaves foráneas temporalmente para evitar errores al borrar
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
                conn.execute(text("DROP TABLE IF EXISTS gasto")) 
                conn.execute(text("DROP TABLE IF EXISTS categoria_gasto"))
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
                conn.commit() # Confirmar cambios
            print("🗑️ Tablas antiguas eliminadas.")
        except Exception as e:
            print(f"⚠️ Nota limpieza: {e}")

        # 2. Crear tablas nuevas con la estructura CORRECTA (incluyendo 'NOMBRE')
        try:
            db.create_all() 
            print("✅ Tablas nuevas creadas correctamente.")
        except Exception as e:
            print(f"❌ Error creando tablas: {e}")
            return

        # 3. Sembrar Categorías por defecto
        categorias = [
            {"nombre": "Viáticos / Movilidad", "color": "#3b82f6"}, # Azul
            {"nombre": "Insumos Oficina", "color": "#10b981"},      # Verde
            {"nombre": "Mantenimiento", "color": "#f59e0b"},        # Naranja
            {"nombre": "Limpieza", "color": "#06b6d4"},            # Cyan
            {"nombre": "Servicios Básicos", "color": "#8b5cf6"},    # Violeta
            {"nombre": "Otros", "color": "#6b7280"}                 # Gris
        ]

        try:
            for cat in categorias:
                # Ahora sí funcionará porque la tabla es nueva y tiene la columna NOMBRE
                existe = CategoriaGasto.query.filter_by(NOMBRE=cat["nombre"]).first()
                if not existe:
                    nuevo = CategoriaGasto(NOMBRE=cat["nombre"], COLOR=cat["color"])
                    db.session.add(nuevo)
                    print(f"➕ Categoría creada: {cat['nombre']}")
            
            db.session.commit()
            print("🚀 Inicialización de Gastos completada con éxito.")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error insertando datos: {e}")

if __name__ == "__main__":
    init_gastos()