"use client";
import React from "react";

/* ---------- constants (ported from prototype) --------------------- */
export const PROJECT_STATUSES = ["Not Started", "In Progress", "Blocked", "Done"];
export const TASK_STATUSES = ["To Do", "In Progress", "Blocked", "Done"];
export const PRIORITIES = ["Low", "Medium", "High"];
export const ROLES = ["admin", "lead", "member"];

export const STATUS_STYLE = {
  "Not Started": "bg-stone-200 text-stone-700",
  "To Do": "bg-stone-200 text-stone-700",
  "In Progress": "bg-sky-100 text-sky-800",
  Blocked: "bg-rose-100 text-rose-800",
  Done: "bg-emerald-100 text-emerald-800",
};
export const PRIORITY_STYLE = {
  Low: "bg-stone-100 text-stone-600",
  Medium: "bg-amber-100 text-amber-800",
  High: "bg-rose-100 text-rose-800",
};
export const AVATAR_COLORS = ["bg-rose-500", "bg-sky-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-teal-500", "bg-indigo-500", "bg-pink-500"];
export const BAND_COLORS = {
  emerald: "bg-emerald-100 text-emerald-900",
  amber: "bg-amber-100 text-amber-900",
  sky: "bg-sky-100 text-sky-900",
  rose: "bg-rose-100 text-rose-900",
  violet: "bg-violet-100 text-violet-900",
  slate: "bg-slate-200 text-slate-900",
};
export const BAND_KEYS = Object.keys(BAND_COLORS);

export const PERMISSIONS = [
  { key: "projects.create", label: "Create projects" },
  { key: "projects.editAny", label: "Edit any project" },
  { key: "projects.delete", label: "Delete projects" },
  { key: "tasks.create", label: "Create tasks" },
  { key: "tasks.editAny", label: "Edit any task" },
  { key: "costs.manage", label: "Build & edit cost analyses" },
  { key: "team.manage", label: "Add & manage team members" },
];

/* ---------- helpers ------------------------------------------------ */
export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2, 12);
export const money = (n) => "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const initials = (name) => (name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/* ---------- style strings ------------------------------------------ */
export const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 disabled:bg-stone-100";
export const btnPrimary = "inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 active:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50";
export const btnGhost = "inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100";
export const btnDanger = "inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50";

/* ---------- primitives --------------------------------------------- */
export function Pill({ children, className = "" }) {
  return <span className={"inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap " + className}>{children}</span>;
}

export function Avatar({ user, size = "h-7 w-7" }) {
  if (!user) return <span className={"inline-flex items-center justify-center rounded-full bg-stone-300 text-white text-xs font-semibold " + size}>—</span>;
  return <span className={"inline-flex items-center justify-center rounded-full text-white text-xs font-semibold " + AVATAR_COLORS[(user.color || 0) % AVATAR_COLORS.length] + " " + size}>{initials(user.name)}</span>;
}

export function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium text-stone-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-screen overflow-y-auto bg-stone-50 rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
          <h3 className="font-semibold text-sm tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-stone-300 hover:text-white text-xl leading-none px-2" aria-label="Close">×</button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="sticky bottom-0 px-4 py-3 bg-stone-100 border-t border-stone-200 flex gap-2 justify-end">{footer}</div>}
      </div>
    </div>
  );
}

export function Header({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <div className="text-xs text-stone-400 mt-0.5">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ msg, sub }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="text-sm font-medium text-stone-500">{msg}</div>
      {sub && <div className="text-xs text-stone-400 mt-1">{sub}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading…" }) {
  return <div className="min-h-[40vh] flex items-center justify-center text-stone-500 text-sm">{label}</div>;
}
