"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppProvider, useApp } from "@/lib/AppContext";
import { Avatar, Spinner } from "@/lib/ui";
 
function Shell({ children }) {
  const { me, session, online, signOut } = useApp();
  const pathname = usePathname();
 
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
 
  if (session === undefined) return <Spinner label="Loading BuildBoard…" />;
  if (session === null) {
    // Cookie existed but the session is gone/expired — send them to sign in.
    if (typeof window !== "undefined") window.location.replace("/login");
    return <Spinner label="Redirecting to sign in…" />;
  }
  if (session && !me) return <Spinner label="Loading your profile…" />;
 
  const nav = [
    { href: "/projects", label: "Projects", icon: "▦" },
    { href: "/tasks", label: "Tasks", icon: "✓" },
    { href: "/costs", label: "Costs", icon: "$" },
    { href: "/activity", label: "Activity", icon: "◷" },
    { href: "/team", label: "Team", icon: "◍" },
  ];
 
  return (
    <div className="min-h-screen bg-stone-100 text-stone-800 flex flex-col">
      <header className="bg-slate-900 text-white no-print">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-7 w-7 rounded bg-amber-500 text-slate-900 font-black text-sm">B</span>
            <div>
              <div className="font-bold tracking-tight leading-none">BuildBoard</div>
              <div className="text-xs text-stone-400 leading-none mt-0.5">Church Construction</div>
            </div>
          </div>
          {me && (
            <button onClick={signOut} className="flex items-center gap-2 text-xs text-stone-300 hover:text-white">
              <Avatar user={me} size="h-7 w-7" />
              <span className="hidden sm:inline">{me.name}</span>
              <span className="text-stone-500">·</span><span>Sign out</span>
            </button>
          )}
        </div>
      </header>
 
      {!online && (
        <div className="bg-amber-100 text-amber-900 text-xs text-center py-1.5 px-4 no-print">
          You're offline — showing your last synced data. Changes can't be saved until you reconnect.
        </div>
      )}
 
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-5 pb-24">{children}</main>
 
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 no-print" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-3xl mx-auto grid grid-cols-5">
          {nav.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href}
                className={"flex flex-col items-center py-2.5 text-xs font-medium " + (active ? "text-amber-600" : "text-stone-400 hover:text-stone-600")}>
                <span className="text-lg leading-none mb-0.5">{n.icon}</span>{n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
 
export default function AppLayout({ children }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}