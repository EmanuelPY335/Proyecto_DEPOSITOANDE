# backend/seed_materiales.py
import random
from faker import Faker
from datetime import datetime, timedelta
from main import app
from db import db, Deposito, Material, Lote, Inventario, EstadoInventario, DepositoSector

fake = Faker('es_ES')

# --- CONFIGURACIÓN DE DATOS REALES ---
MATERIALES_BASE = [
    # CONDUCTORES
    {"nombre": "Cable Preensamblado 25mm", "cat": "Conductores", "u": "m", "min": 100},
    {"nombre": "Cable Desnudo de Cobre 35mm", "cat": "Conductores", "u": "m", "min": 50},
    {"nombre": "Cable de Aluminio 50mm", "cat": "Conductores", "u": "m", "min": 200},
    # AISLADORES
    {"nombre": "Aislador de Porcelana MN-3", "cat": "Aisladores", "u": "unid", "min": 20},
    {"nombre": "Aislador Polimérico 15kV", "cat": "Aisladores", "u": "unid", "min": 15},
    {"nombre": "Cadena de Aisladores de Vidrio", "cat": "Aisladores", "u": "unid", "min": 10},
    # PROTECCIÓN
    {"nombre": "Pararrayos de Óxido Metálico 10kV", "cat": "Protección", "u": "unid", "min": 5},
    {"nombre": "Seccionador Fusible 15kV", "cat": "Protección", "u": "unid", "min": 8},
    {"nombre": "Fusible Tipo H 5A", "cat": "Protección", "u": "unid", "min": 50},
    # FERRETERÍA
    {"nombre": "Cruceta de Hierro 2.40m", "cat": "Ferretería", "u": "unid", "min": 10},
    {"nombre": "Perno Maquinado 1/2 x 6", "cat": "Ferretería", "u": "unid", "min": 100},
    {"nombre": "Abrazadera Doble Ajustable", "cat": "Ferretería", "u": "unid", "min": 30},
    # TRANSFORMADORES
    {"nombre": "Transformador 100kVA", "cat": "Equipos", "u": "unid", "min": 2},
    {"nombre": "Medidor Monofásico Digital", "cat": "Medición", "u": "unid", "min": 20},
]

ESTADOS = ["Disponible", "Dañado", "En Cuarentena", "Reservado"]
SECTORES_LETRAS = ["A", "B", "C", "D", "E"] # Pasillos

def sembrar_materiales():
    with app.app_context():
        print("\n--- 📦 INICIANDO SIEMBRA DE MATERIALES E INVENTARIO ---")

        # 1. Validar Depósitos
        depositos = Deposito.query.all()
        if not depositos:
            print("❌ ERROR: No hay depósitos. Ejecuta primero seed_depositos.py (o crea uno manual).")
            return

        print(f"📍 Encontrados {len(depositos)} depósitos. Generando stock para ellos...")

        # 2. Asegurar Estados de Inventario
        estado_disp = None
        for nombre_est in ESTADOS:
            est = EstadoInventario.query.filter_by(ESTADO_INVENTARIO=nombre_est).first()
            if not est:
                est = EstadoInventario(ESTADO_INVENTARIO=nombre_est)
                db.session.add(est)
                db.session.flush()
            if nombre_est == "Disponible":
                estado_disp = est

        # 3. Asegurar Sectores en Depósitos
        print("🏗️  Verificando/Creando sectores (Pasillos) en cada depósito...")
        sectores_map = {} # {id_deposito: [obj_sector, ...]}
        for dep in depositos:
            sectores_map[dep.ID_DEPOSITO] = []
            for letra in SECTORES_LETRAS:
                codigo = f"P-{letra}"
                sec = DepositoSector.query.filter_by(ID_DEPOSITO=dep.ID_DEPOSITO, CODIGO=codigo).first()
                if not sec:
                    sec = DepositoSector(
                        ID_DEPOSITO=dep.ID_DEPOSITO,
                        CODIGO=codigo,
                        NOMBRE=f"Pasillo {letra}",
                        ACTIVO=True
                    )
                    db.session.add(sec)
                    db.session.flush()
                sectores_map[dep.ID_DEPOSITO].append(sec)
        
        db.session.commit()

        # 4. Crear Materiales, Lotes e Inventario
        total_mats = 0
        total_lotes = 0
        
        for item in MATERIALES_BASE:
            # Verificar si existe material (por código o nombre)
            # Generamos un código único basado en hash simple para demo
            cod_unico = random.randint(100000, 999999) 
            
            mat = Material.query.filter_by(NOMBRE=item["nombre"]).first()
            if not mat:
                mat = Material(
                    CODIGO_UNICO=cod_unico,
                    NOMBRE=item["nombre"],
                    CANTIDAD=0, # Se recalculará
                    UNIDAD_MEDIDA=item["u"],
                    CATEGORIA=item["cat"],
                    STOCK_MINIMO=item["min"],
                    FACTOR_PUNTOS=random.choice([1, 2, 5, 10])
                )
                db.session.add(mat)
                db.session.flush()
                total_mats += 1
                print(f"   🔹 Nuevo Material: {mat.NOMBRE}")
            
            # Crear Lotes para este material (1 a 4 lotes por material)
            cant_lotes = random.randint(1, 4)
            stock_global = 0

            for _ in range(cant_lotes):
                # Generar lote
                fecha_ingreso = fake.date_between(start_date='-1y', end_date='today')
                codigo_lote = f"L{datetime.now().year}-{random.randint(1000,9999)}"
                
                lote = Lote(
                    ID_MATERIAL=mat.ID_MATERIAL,
                    FECHA_INGRESO=fecha_ingreso,
                    OBSERVACIONES=fake.sentence(nb_words=6),
                    CODIGO=codigo_lote
                )
                db.session.add(lote)
                db.session.flush()
                total_lotes += 1

                # Distribuir este lote en algunos depósitos (entre 1 y todos)
                depositos_destino = random.sample(depositos, k=random.randint(1, len(depositos)))
                
                for dep in depositos_destino:
                    cantidad = 0
                    # Lógica de cantidad según tipo
                    if item["u"] == "m":
                        cantidad = random.randint(50, 500) # Metros
                    else:
                        cantidad = random.randint(5, 100) # Unidades

                    # Elegir sector al azar
                    sectores_dep = sectores_map.get(dep.ID_DEPOSITO, [])
                    sector_actual = random.choice(sectores_dep) if sectores_dep else None
                    detalle_ubic = f"Estante {random.randint(1,5)}, Nivel {random.randint(1,4)}"

                    inventario = Inventario(
                        ID_DEPOSITO=dep.ID_DEPOSITO,
                        ID_LOTE=lote.ID_LOTE,
                        ID_ESTADO_INVENTARIO=estado_disp.ID_ESTADO_INVENTARIO,
                        CANTIDAD_ACTUAL=cantidad,
                        ID_SECTOR_ACTUAL=sector_actual.ID_SECTOR if sector_actual else None,
                        UBICACION_DETALLE=detalle_ubic
                    )
                    db.session.add(inventario)
                    stock_global += cantidad

            # Actualizar total del material
            mat.CANTIDAD += stock_global
            db.session.commit()

        print("------------------------------------------------")
        print(f"✅ ¡ÉXITO! Se procesaron {len(MATERIALES_BASE)} tipos de materiales.")
        print(f"📦 Se crearon {total_lotes} lotes distribuidos en los depósitos.")
        print("------------------------------------------------")

if __name__ == "__main__":
    sembrar_materiales()