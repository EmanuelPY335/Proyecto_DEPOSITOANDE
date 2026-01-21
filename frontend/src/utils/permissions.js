// src/utils/permissions.js
export const checkPermission = (requiredPermission) => {
  const userRole = sessionStorage.getItem("user_rol");
  const storedPermisos = sessionStorage.getItem("user_permissions");
  const permisos = storedPermisos ? JSON.parse(storedPermisos) : [];
  
  if (userRole === "Master_Admin") return true;
  return permisos.includes(requiredPermission);
};

export const checkRole = (requiredRole) => {
  const userRole = sessionStorage.getItem("user_rol");
  return userRole === requiredRole;
};

export const checkMultiplePermissions = (requiredPermissions) => {
  const userRole = sessionStorage.getItem("user_rol");
  const storedPermisos = sessionStorage.getItem("user_permissions");
  const permisos = storedPermisos ? JSON.parse(storedPermisos) : [];
  
  if (userRole === "Master_Admin") return true;
  return requiredPermissions.some(perm => permisos.includes(perm));
};