"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { installImpersonationFetchInterceptor } from "@/lib/impersonation/fetch-interceptor";
import { clearImpersonationPreviewCache } from "@/lib/impersonation/use-effective-session";

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

function readStoredImpersonation(): {
  roleId: string | null;
  roleCode: string | null;
  token: string | null;
} {
  if (typeof window === "undefined") {
    return { roleId: null, roleCode: null, token: null };
  }
  const token = sessionStorage.getItem("impersonationToken");
  const roleId = sessionStorage.getItem("impersonationRoleId");
  const roleCode = sessionStorage.getItem("impersonationRoleCode");
  if (token && roleId && roleCode) {
    return { token, roleId, roleCode };
  }
  return { roleId: null, roleCode: null, token: null };
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readStoredImpersonation);

  useEffect(() => {
    setState(readStoredImpersonation());
  }, []);

  useEffect(() => {
    installImpersonationFetchInterceptor(() =>
      typeof window === "undefined" ? null : sessionStorage.getItem("impersonationToken")
    );
  }, []);

  const clear = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("impersonationToken");
      sessionStorage.removeItem("impersonationRoleId");
      sessionStorage.removeItem("impersonationRoleCode");
    }
    clearImpersonationPreviewCache();
    setState({ roleId: null, roleCode: null, token: null });
  }, []);

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
