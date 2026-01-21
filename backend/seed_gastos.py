# sisdepo/backend/distribuir_gastos.py
from main import app
from db import db, Gasto, Deposito
import random

def distribuir_depositos():
    with app.app_context():
        print("🔄 Iniciando redistribución de gastos por depósito...")

        # 1. Definimos tus depósitos según el archivo SQL que subiste
        # ID 1: ANDE - Deposito Central (Asunción)
        # ID 2: ANDE - Sede Central (España)
        # ID 3: ANDE - Depósito Encarnación
        # ID 4: National Electricity (Pilar)
        # ID 5: ANDE Agencia Regional Ñeembucú
        
        # Agrupamos por zona para asignar con cierta lógica
        zona_asuncion = [1, 2]
        zona_encarnacion = [3]
        zona_pilar = [4, 5]
        
        todos_los_ids = [1, 2, 3, 4, 5]

        gastos = Gasto.query.all()
        total = len(gastos)
        
        print(f"📊 Procesando {total} registros...")

        for gasto in gastos:
            # Texto para buscar pistas de ubicación
            texto_completo = f"{(gasto.TITULO or '')} {(gasto.DESCRIPCION or '')}".lower()

            # --- LÓGICA DE ASIGNACIÓN ---
            
            # A. Si dice explícitamente la ciudad/zona, asignamos el ID correcto
            if "encarnación" in texto_completo or "itapúa" in texto_completo:
                gasto.ID_DEPOSITO = 3
            
            elif "pilar" in texto_completo or "ñeembucú" in texto_completo:
                gasto.ID_DEPOSITO = random.choice(zona_pilar)
            
            elif "asunción" in texto_completo or "central" in texto_completo or "españa" in texto_completo:
                gasto.ID_DEPOSITO = random.choice(zona_asuncion)
            
            # B. Si no dice nada, asignamos aleatoriamente para simular movimiento en todas las sucursales
            else:
                # Damos un poco más de peso a Asunción (IDs 1 y 2) por ser centrales
                # Probabilidad: 40% Asunción, 30% Encarnación, 30% Pilar
                rand = random.random()
                if rand < 0.4:
                    gasto.ID_DEPOSITO = random.choice(zona_asuncion)
                elif rand < 0.7:
                    gasto.ID_DEPOSITO = 3
                else:
                    gasto.ID_DEPOSITO = random.choice(zona_pilar)

        try:
            db.session.commit()
            print("✅ ¡Éxito! Gastos distribuidos correctamente.")
            print("   - Ahora puedes filtrar por 'Depósito Encarnación' o 'Pilar' y verás datos distintos.")
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error al guardar cambios: {e}")

if __name__ == "__main__":
    distribuir_depositos()