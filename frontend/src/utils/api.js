// src/utils/api.js
const BASE_URL = "http://127.0.0.1:5000"; 

const getToken = () => {
  return sessionStorage.getItem("access_token");
};

export const apiFetch = async (endpoint, options = {}) => {
  const token = getToken();
  
  // --- CORRECCIÓN ANTI-ERROR ---
  // Aseguramos que haya una barra entre BASE_URL y endpoint
  let url;
  if (endpoint.startsWith("http")) {
      url = endpoint;
  } else {
      // Si el endpoint no empieza con '/', lo agregamos
      const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
      url = `${BASE_URL}${cleanEndpoint}`;
  }
  // -----------------------------

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
      sessionStorage.removeItem("access_token");
      window.location.href = '/login'; 
      throw new Error("Sesión expirada");
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.msg || errorData.message || "Error en el servidor");
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;

  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};