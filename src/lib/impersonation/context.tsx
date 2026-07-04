"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface ImpersonationContextValue {
  isImpersonating: boolean;
  roleId: string | null;
  roleCode: string | null;
  token: string | null;
  clear: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextValue>({
  isImpersonating: false,
  roleId: null,
  roleCode: null,
  token: null,
  clear: () => {},
});

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    roleId: string | null;
    roleCode: string | null;
    token: string | null;
  }>({ roleId: null, roleCode: null, token: null });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = sessionStorage.getItem("impersonationToken");
    const roleId = sessionStorage.getItem("impersonationRoleId");
    const roleCode = sessionStorage.getItem("impersonationRoleCode");
    if (token && roleId && roleCode) {
      setState({ token, roleId, roleCode });
    }
  }, []);

  const clear = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("impersonationToken");
      sessionStorage.removeItem("impersonationRoleId");
      sessionStorage.removeItem("impersonationRoleCode");
    }
    setState({ roleId: null, roleCode: null, token: null });
  };

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating: Boolean(state.token),
        roleId: state.roleId,
        roleCode: state.roleCode,
        token: state.token,
        clear,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  return useContext(ImpersonationContext);
}