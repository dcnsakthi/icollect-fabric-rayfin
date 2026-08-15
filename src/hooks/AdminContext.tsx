import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/hooks/AuthContext';
import {
  isAdminUser,
  listAdmins,
  type AppAdminRecord,
} from '@/services/adminService';

interface AdminContextValue {
  admins: AppAdminRecord[];
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export function AdminProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { user, isAuthenticated } = useAuth();
  const [admins, setAdmins] = useState<AppAdminRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setAdmins(await listAdmins());
    } catch {
      // A failed read must not lock everyone out of the app it configures,
      // so it falls back to the same state as an empty list.
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setAdmins([]);
      setLoading(false);
      return;
    }
    void refresh();
  }, [isAuthenticated, refresh]);

  const value = useMemo<AdminContextValue>(
    () => ({
      admins,
      isAdmin: isAdminUser(admins, user?.email),
      loading,
      refresh,
    }),
    [admins, user?.email, loading, refresh]
  );

  return (
    <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
  );
}

export function useAdmins(): AdminContextValue {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmins must be used within an AdminProvider');
  }
  return context;
}
