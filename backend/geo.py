import math

def calcular_distancia(lat1, lon1, lat2, lon2):
    """
    Calcula la distancia en metros entre dos coordenadas (Fórmula Haversine).
    Retorna 999999 si faltan datos para bloquear el acceso por seguridad.
    """
    if not lat1 or not lon1 or not lat2 or not lon2:
        return 999999.0

    R = 6371000  # Radio de la Tierra en metros
    
    # Convertir a float por seguridad
    try:
        lat1, lon1, lat2, lon2 = float(lat1), float(lon1), float(lat2), float(lon2)
    except ValueError:
        return 999999.0

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2) * math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c # Metros