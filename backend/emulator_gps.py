# emulator_gps.py
import requests
import time
import random
from datetime import datetime, timezone

class GPSEmulator:
    def __init__(self, camion_id, backend_url):
        self.camion_id = camion_id
        self.backend_url = backend_url
        self.lat = -27.2924466
        self.lng = -55.868871
        
    def generate_gps_data(self):
        # 🔽 Cambia a variación MUY pequeña
        self.lat += random.uniform(-0.0001, 0.0001)  
        self.lng += random.uniform(-0.0001, 0.0001)  
        
        return {
            "camion_id": self.camion_id,
            "lat": round(self.lat, 7),  
            "lng": round(self.lng, 7), 
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
            print(f"✅ Datos enviados | Status: {response.status_code}")
        except Exception as e:
            print(f"❌ Error enviando datos: {e}")
    
    def run_emulation(self, interval=30):
        """Ejecuta la emulación cada X segundos"""
        while True:
            self.send_to_backend()
            time.sleep(interval)

# Uso
if __name__ == "__main__":
    emulator = GPSEmulator(1, "http://localhost:5000")
    print("🚀 Emulador GPS iniciado. Presiona Ctrl+C para detener.")
    try:
        emulator.run_emulation(interval=30)
    except KeyboardInterrupt:
        print("\n⏹️ Emulador detenido.")