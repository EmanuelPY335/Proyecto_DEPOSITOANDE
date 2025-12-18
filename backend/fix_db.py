# Guardar como backend/fix_db_limite.py y ejecutar: python fix_db_limite.py
from main import app
from db import db
from sqlalchemy import text

with app.app_context():
    try:
        db.session.execute(text("ALTER TABLE orden_trabajo ADD COLUMN FECHA_LIMITE DATETIME NULL;"))
        db.session.commit()
        print("✅ Columna FECHA_LIMITE agregada con éxito.")
    except Exception as e:
        print(f"⚠️ Nota: {e}")