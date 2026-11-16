"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getQueryClient } from "../lib/query-client";
import {
  clearSharedDeviceSession,
  isPublicAppRoute,
  startCrossTabSessionSync,
} from "../lib/auth-hygiene";

export function SessionSyncListener({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const [invalidated, setInvalidated] = useState(false);

  useEffect(() => {
    const queryClient = getQueryClient();
    return startCrossTabSessionSync({
      queryClient,
      getPathname: () =>
        typeof window !== "undefined" ? window.location.pathname : "/",
      onInvalidate: () => {
        const currentPath =
          typeof window !== "undefined" ? window.location.pathname : "/";
        if (isPublicAppRoute(currentPath)) {
          void clearSharedDeviceSession(queryClient, { broadcast: false });
          return;
        }
        setInvalidated(true);
        void Promise.race([
          clearSharedDeviceSession(queryClient, { broadcast: false }),
          new Promise<void>((resolve) => {
            setTimeout(resolve, 400);
          }),
        ]).finally(() => {
          if (typeof window !== "undefined") {
            window.location.replace("/login");
          }
        });
      },
    });
  }, []);

  if (invalidated && !isPublicAppRoute(pathname)) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 text-center outline-none"
      >
        <p className="text-sm text-zinc-600">Cerrando sesión…</p>
      </main>
    );
  }

  return <>{children}</>;
}
