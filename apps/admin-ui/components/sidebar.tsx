"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Table2, LogOut, Spade } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export function Sidebar() {
  const pathname = usePathname();
  const { agentId, role, logout } = useAuth();

  const navItems = [
    { href: "/tables", label: "My Tables", icon: Table2 },
  ];

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Spade className="h-5 w-5 text-primary" />
        <span className="font-semibold tracking-tight">Agent Poker</span>
      </div>

      {/* Profile Section */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border bg-sidebar-accent/30">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
          {agentId?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold truncate">{agentId ?? "Unknown"}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{role ?? "spectator"}</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href) || (item.href === "/tables" && pathname.startsWith("/table/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
