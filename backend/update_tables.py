# backend/update_depositos_cols.py
from main import app
from db import db
from sqlalchemy import text

def agregar_columnas_geo():
    with app.app_context():
        print("--- Actualizando tabla Deposito ---")
        try:
            with db.engine.connect() as conn:
                # Agregamos LATITUD
                conn.execute(text("ALTER TABLE deposito ADD COLUMN LATITUD FLOAT NULL;"))
                print("Columna LATITUD agregada.")
                
                # Agregamos LONGITUD
                conn.execute(text("ALTER TABLE deposito ADD COLUMN LONGITUD FLOAT NULL;"))
                print("Columna LONGITUD agregada.")
                
                # Opcional: Ampliar la columna DIRECCION si era muy corta
                conn.execute(text("ALTER TABLE deposito MODIFY COLUMN DIRECCION VARCHAR(100);"))
                
                conn.commit()
            print("--- Actualización completada exitosamente ---")
        except Exception as e:
            print(f"Error (o las columnas ya existían): {e}")

if __name__ == "__main__":
    agregar_columnas_geo()