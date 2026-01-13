// sisdepo/frontend/src/utils/api.js

/**
 * Obtiene el token de localStorage.
 */
// src/utils/api.js

// 1. Define la URL de tu backend aquí
const BASE_URL = "http://127.0.0.1:5000"; 

const getToken = () => {
  return sessionStorage.getItem("access_token");
};

export const apiFetch = async (endpoint, options = {}) => {
  const token = getToken();
  
  // 2. Construcción inteligente de la URL
  // Si el endpoint ya empieza con http, lo usamos tal cual. Si no, le pegamos el BASE_URL.
  const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, fetchOptions);

    if (response.status === 401 || response.status === 422) {
      console.error("Sesión expirada");
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("user_nombre");
      window.location.href = '/login'; // O la ruta de tu login
      throw new Error("Sesión expirada");
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || response.statusText);
    }

    // Manejo seguro de respuestas vacías
    const text = await response.text();
    return text ? JSON.parse(text) : null;

  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};