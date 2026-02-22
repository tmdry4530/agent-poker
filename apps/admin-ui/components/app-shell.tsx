"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";

/** Public routes (no auth, no sidebar) */
const PUBLIC_ROUTES = ["/", "/login"];

/** Authenticated routes accessible to spectators (prefix match) */
const SPECTATOR_ROUTES = ["/tables", "/table/"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname);
}

function isSpectatorRoute(pathname: string): boolean {
  return SPECTATOR_ROUTES.some((r) => pathname.startsWith(r));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Redirect admin-only routes to /tables
  useEffect(() => {
    if (!isPublicRoute(pathname) && !isSpectatorRoute(pathname)) {
      router.replace("/tables");
    }
  }, [pathname, router]);

  // Public pages: no sidebar, no auth
  if (pathname === "/login" || pathname === "/") {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </AuthGuard>
  );
}
