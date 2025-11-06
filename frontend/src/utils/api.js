// sisdepo/frontend/src/utils/api.js

/**
 * Obtiene el token de localStorage.
 */
const getToken = () => {
  return localStorage.getItem("access_token");
};

/**
 * Un 'fetch' wrapper que añade automáticamente el token JWT.
 * También maneja el error 401 (Token inválido/expirado)
 * redirigiendo al Login.
 */
export const apiFetch = async (url, options = {}) => {
  const token = getToken();
  
  // Prepara los headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers, // Permite sobreescribir headers si es necesario
  };

  // --- ESTA ES LA PARTE IMPORTANTE ---
  // Si tenemos token, lo añadimos a la cabecera de Autorización
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // --- FIN DE LA PARTE IMPORTANTE ---

  // Configura las opciones finales del fetch
  const fetchOptions = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, fetchOptions);

    // --- Manejo de errores de autenticación ---
    if (response.status === 401 || response.status === 422) { 
      // 401 = Token inválido o expirado
      // 422 = Token faltante (Unprocessable Entity)
      
      console.error("Error de Token (401/422):", response.status);
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_nombre");
      // Redirigir al login
      window.location.href = '/'; 
      throw new Error("Sesión expirada. Por favor, inicie sesión de nuevo.");
    }
    
    if (!response.ok) {
        // Intentar parsear el error del backend
        const errorData = await response.json();
        // Usamos data.message (de Flask) o data.error
        throw new Error(errorData.message || errorData.error || response.statusText);
    }

    // Si la respuesta no tiene contenido (ej. un PUT exitoso sin respuesta)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        
        // Manejar el caso de que la respuesta sea JSON pero esté vacía
        const text = await response.text();
        if (!text) {
            return null; // Devuelve null si el JSON está vacío
        }
        return JSON.parse(text); // Devuelve los datos JSON

    } else {
        return null; // Devuelve null si no hay JSON (ej. 204 No Content)
    }

  } catch (error) {
    console.error("Error en apiFetch:", error);
    // Re-lanzar el error para que el componente (Profile.jsx) lo atrape
    throw error; 
  }
};