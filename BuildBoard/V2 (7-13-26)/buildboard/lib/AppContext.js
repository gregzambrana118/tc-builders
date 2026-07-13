"use client";
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase/client";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

/* ---- offline read cache (last good snapshot per key) -------------- */
export function cacheGet(key) {
  try { const v = localStorage.getItem("bb:" + key); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function cacheSet(key, value) {
  try { localStorage.setItem("bb:" + key, JSON.stringify(value)); } catch { /* full or unavailable */ }
}

/**
 * useTable — loads a table, caches it for offline reads, and refetches on
 * realtime changes. Returns [rows, refetch, fromCache].
 */
export function useTable(table, options = {}) {
  const { order = "created_at", ascending = false, enabled = true } = options;
  const supabase = getSupabase();
  const [rows, setRows] = useState(() => cacheGet(table) || []);
  const [fromCache, setFromCache] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from(table).select("*").order(order, { ascending });
    if (!error && data) { setRows(data); setFromCache(false); cacheSet(table, data); }
  }, [supabase, table, order, ascending]);

  useEffect(() => {
    if (!enabled) return;
    refetch();
    const channel = supabase
      .channel("rt-" + table)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, refetch, supabase, table]);

  return [rows, refetch, fromCache];
}

export function AppProvider({ children }) {
  const supabase = getSupabase();
  const [session, setSession] = useState(undefined); // undefined = loading
  const [online, setOnline] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const up = () => setOnline(true), down = () => setOnline(false);
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  const authed = !!session;
  const [users] = useTable("profiles", { order: "created_at", ascending: true, enabled: authed });
  const [permRows] = useTable("role_permissions", { order: "role", ascending: true, enabled: authed });

  const me = useMemo(
    () => (session ? users.find((u) => u.id === session.user.id) || null : null),
    [users, session]
  );

  const roles = useMemo(() => {
    const r = { lead: {}, member: {} };
    for (const row of permRows) {
      if (r[row.role]) r[row.role][row.perm] = row.allowed;
    }
    return r;
  }, [permRows]);

  const can = useCallback(
    (key) => {
      if (!me) return false;
      if (me.role === "admin") return true;
      return !!(roles[me.role] && roles[me.role][key]);
    },
    [me, roles]
  );

  const signOut = useCallback(async () => { await supabase.auth.signOut(); window.location.href = "/login"; }, [supabase]);

  const value = { supabase, session, me, users, roles, can, online, signOut };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
