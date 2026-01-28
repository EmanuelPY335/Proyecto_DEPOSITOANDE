// src/utils/api.js
const BASE_URL = "http://127.0.0.1:5000";

const getToken = () => {
  return sessionStorage.getItem("access_token");
};

export const apiFetch = async (endpoint, options = {}) => {
  const token = getToken();

  // --- URL segura ---
  let url;
  if (endpoint.startsWith("http")) {
    url = endpoint;
  } else {
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    url = `${BASE_URL}${cleanEndpoint}`;
  }

  // --- Headers seguros ---
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // --- Body seguro (si viene objeto, lo convertimos a JSON) ---
  let body = options.body;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  if (body !== undefined && body !== null && typeof body === "object" && !isFormData) {
    body = JSON.stringify(body);
  }

  const fetchOptions = {
    ...options,
    headers,
    ...(body !== undefined ? { body } : {}),
  };

  try {
    const response = await fetch(url, fetchOptions);

    // Sesión expirada
    if (response.status === 401 || response.status === 422) {
      sessionStorage.removeItem("access_token");
      window.location.href = "/login";
      throw new Error("Sesión expirada");
    }

    // Intentar leer respuesta como JSON o texto
    const contentType = response.headers.get("content-type") || "";
    let payload = null;

    try {
      if (contentType.includes("application/json")) {
        payload = await response.json();
      } else {
        const txt = await response.text();
        payload = txt ? { text: txt } : null;
      }
    } catch {
      payload = null;
    }

    // Manejo de error con mensaje REAL del backend
    if (!response.ok) {
      const msg =
        (payload && (payload.error || payload.msg || payload.message || payload.detail)) ||
        `HTTP ${response.status} ${response.statusText}`;
      throw new Error(msg);
    }

    // Si OK: devolver payload (si vino JSON) o null si vacío
    if (payload && typeof payload === "object" && "text" in payload) {
      // Si el backend devolvió texto, intentamos parsearlo si parece JSON
      const t = payload.text;
      if (!t) return null;
      try {
        return JSON.parse(t);
      } catch {
        return t;
      }
    }

    return payload ?? null;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
};
