// src/utils/permissions.js (CORREGIDO)

const getUserRole = () => {
  // Busca user_rol O rol_nombre, y lo devuelve limpio
  const rawRole = sessionStorage.getItem("user_rol") || sessionStorage.getItem("rol_nombre") || "";
  return rawRole.trim();
};

export const checkPermission = (requiredPermission) => {
  const userRole = getUserRole();
  const storedPermisos = sessionStorage.getItem("user_permissions");
  const permisos = storedPermisos ? JSON.parse(storedPermisos) : [];
  
  // Convertimos a minúsculas para comparar seguro
  const roleLower = userRole.toLowerCase();

  // Aceptamos Master_Admin o Admin
  if (roleLower === "master_admin" || roleLower === "admin") return true;
  
  return permisos.includes(requiredPermission);
};

export const checkRole = (requiredRole) => {
  const userRole = getUserRole();
  return userRole.toLowerCase() === requiredRole.toLowerCase();
};

export const checkMultiplePermissions = (requiredPermissions) => {
  const userRole = getUserRole();
  const storedPermisos = sessionStorage.getItem("user_permissions");
  const permisos = storedPermisos ? JSON.parse(storedPermisos) : [];
  
  const roleLower = userRole.toLowerCase();

  if (roleLower === "master_admin" || roleLower === "admin") return true;
  
  return requiredPermissions.some(perm => permisos.includes(perm));
};