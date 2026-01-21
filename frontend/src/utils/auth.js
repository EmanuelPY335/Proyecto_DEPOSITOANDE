// src/utils/auth.js

// Función auxiliar para decodificar el token sin librerías externas
function parseJwt (token) {
    try {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

export const getUser = () => {
  // 1. Intentamos leer el token real
  const token = sessionStorage.getItem("access_token");
  if (token) {
      const decoded = parseJwt(token);
      if (decoded) {
          // Normalizamos el ID (a veces viene como 'sub', 'id' o 'ID_USUARIO')
          // FORZAMOS QUE SIEMPRE HAYA UN 'ID_USUARIO'
          const idFinal = decoded.ID_USUARIO || decoded.id || decoded.sub;
          return { ...decoded, ID_USUARIO: idFinal };
      }
  }

  // 2. Fallback: Intentamos leer el objeto 'user' antiguo si existe
  const userStr = sessionStorage.getItem("user");
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch (e) {
      return null;
    }
  }
  return null;
};

export const hasPermission = (permisoRequerido) => {
    const userRole = sessionStorage.getItem("user_rol");
    if (userRole === "Master_Admin" || userRole === "Admin") {
        return true;
    }
    try {
        const storedPermisos = sessionStorage.getItem("user_permissions");
        if (!storedPermisos) return false;
        const permisos = JSON.parse(storedPermisos);
        return permisos.includes(permisoRequerido);
    } catch (error) {
        return false;
    }
};