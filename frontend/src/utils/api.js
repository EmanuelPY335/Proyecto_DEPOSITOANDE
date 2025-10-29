// api.js

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

  // Si tenemos token, lo añadimos
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Configura las opciones finales del fetch
  const fetchOptions = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, fetchOptions);

    // --- Manejo de errores de autenticación ---
    if (response.status === 401) {
      // Token inválido o expirado
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_nombre");
      // Redirigir al login
      window.location.href = '/'; 
      throw new Error("Sesión expirada. Por favor, inicie sesión de nuevo.");
    }
    
    if (!response.ok) {
        // Intentar parsear el error del backend
        const errorData = await response.json();
        throw new Error(errorData.message || response.statusText);
    }

    // Si la respuesta no tiene contenido (ej. un POST exitoso)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json(); // Devuelve los datos JSON
    } else {
        return null; // Devuelve null si no hay JSON (ej. 204 No Content)
    }

  } catch (error) {
    console.error("Error en apiFetch:", error);
    // Re-lanzar el error para que el componente lo atrape
    throw error; 
  }
};