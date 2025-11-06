# emulator_gps.py
import requests
import time
import random
from datetime import datetime, timezone

class GPSEmulator:
    # --- CAMBIO: ID_VEHICULO en mayúscula ---
    def __init__(self, ID_VEHICULO, backend_url):
        self.ID_VEHICULO = ID_VEHICULO
        self.backend_url = backend_url
        self.lat = -27.2924466 # Coordenadas base
        self.lng = -55.868871 # Coordenadas base
        
    def generate_gps_data(self):
        self.lat += random.uniform(-0.0001, 0.0001)  
        self.lng += random.uniform(-0.0001, 0.0001)  
        
        # --- CAMBIO: Nombres de claves actualizados al SQL (MAYÚSCULAS) ---
        return {
            "ID_VEHICULO": self.ID_VEHICULO,
            "LATITUD": round(self.lat, 7),  
            "LONGITUD": round(self.lng, 7), 
            "timestamp": datetime.now(timezone.utc).isoformat() 
        }
    
    def send_to_backend(self):
        """Envía datos al backend"""
        data = self.generate_gps_data()
        try:
            response = requests.post(
                f"{self.backend_url}/api/gps/tracking",
                json=data,
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            print(f"✅ Datos GPS enviados | Vehículo: {self.ID_VEHICULO} | Status: {response.status_code}")
        except Exception as e:
            print(f"❌ Error enviando datos: {e}")
    
    def run_emulation(self, interval=30):
        """Ejecuta la emulación cada X segundos"""
        while True:
            self.send_to_backend()
            time.sleep(interval)

# Uso
if __name__ == "__main__":
    # ¡Asegúrate de tener un VEHICULO con ID_VEHICULO=1 en tu base de datos!
    emulator = GPSEmulator(3, "http://localhost:5000") 
    print("🚀 Emulador GPS iniciado (Vehículo 1). Presiona Ctrl+C para detener.")
    try:
        emulator.run_emulation(interval=30)
    except KeyboardInterrupt:
        print("\n⏹️ Emulador detenido.")