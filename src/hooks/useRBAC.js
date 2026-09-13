import { useAuth } from '../context/AuthContext';

export const usePermission = (permission) => {
    const { hasPermission } = useAuth();
    return hasPermission(permission);
};

export const useRole = (role) => {
    const { user } = useAuth();
    return user?.role === role;
};
