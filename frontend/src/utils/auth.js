// src/utils/auth.js

/**
 * Verifica si el usuario tiene permiso.
 * Regla: Master_Admin y Admin tienen acceso TOTAL siempre.
 * El resto depende de la lista de permisos.
 */
export const hasPermission = (permisoRequerido) => {
    const userRole = sessionStorage.getItem("user_rol");
    
    // 1. LLAVE MAESTRA: Si es Admin o Master, pasa siempre
    if (userRole === "Master_Admin" || userRole === "Admin") {
        return true;
    }

    // 2. Para otros roles, revisamos la lista específica
    try {
        const storedPermisos = sessionStorage.getItem("user_permissions");
        if (!storedPermisos) return false;
        
        const permisos = JSON.parse(storedPermisos);
        return permisos.includes(permisoRequerido);
    } catch (error) {
        console.error("Error verificando permisos:", error);
        return false;
    }
};