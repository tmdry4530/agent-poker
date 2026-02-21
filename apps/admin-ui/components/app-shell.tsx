"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { AuthGuard } from "@/components/auth-guard";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
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
