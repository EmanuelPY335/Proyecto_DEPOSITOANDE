# backend/update_codes.py
from main import app
from db import db, Lote
import random
from datetime import datetime

def generate_code(fecha_ingreso):
    # Usamos la fecha real del lote para el código
    if not fecha_ingreso:
        fecha_ingreso = datetime.now()
        
    fecha_str = fecha_ingreso.strftime('%y%m%d') # Ej: 240125
    random_str = random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ') + str(random.randint(100, 999))
    return f"L-{fecha_str}-{random_str}"

def update_null_codes():
    with app.app_context():
        print("🔄 Buscando lotes sin código...")
        
        # Buscamos lotes que tengan el código vacío o NULL
        lotes_sin_codigo = Lote.query.filter((Lote.CODIGO == None) | (Lote.CODIGO == "")).all()
        
        count = 0
        for lote in lotes_sin_codigo:
            new_code = generate_code(lote.FECHA_INGRESO)
            lote.CODIGO = new_code
            print(f"   -> Lote ID {lote.ID_LOTE} actualizado con: {new_code}")
            count += 1
            
        if count > 0:
            db.session.commit()
            print(f"✅ ¡Listo! Se actualizaron {count} lotes exitosamente.")
        else:
            print("👍 Todos los lotes ya tienen código. No se hicieron cambios.")

if __name__ == "__main__":
    update_null_codes()