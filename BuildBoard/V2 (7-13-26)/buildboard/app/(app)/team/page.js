"use client";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import {
  Header, Avatar, Modal, Field,
  inputCls, btnPrimary, btnGhost, btnDanger,
  ROLES, PERMISSIONS,
} from "@/lib/ui";

export default function TeamPage() {
  const { supabase, me, users, roles, can, online } = useApp();
  const [editing, setEditing] = useState(null);
  const [showPerms, setShowPerms] = useState(false);
  const [teamCode, setTeamCode] = useState(null);
  const [err, setErr] = useState(null);
  const manage = can("team.manage");

  useEffect(() => {
    if (me?.role !== "admin") return;
    supabase.from("app_settings").select("team_code").eq("id", 1).single()
      .then(({ data }) => data && setTeamCode(data.team_code));
  }, [supabase, me]);

  const save = async (u) => {
    if (!online) { setErr("You're offline — changes can't be saved right now."); return; }
    setErr(null);
    const { error } = await supabase.from("profiles").update({ name: u.name.trim(), role: u.role }).eq("id", u.id);
    if (error) setErr(error.message);
    setEditing(null);
  };

  const remove = async (id) => {
    if (!online) { setErr("You're offline — changes can't be saved right now."); return; }
    setErr(null);
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) setErr(error.message);
    setEditing(null);
  };

  return (
    <div>
      <Header title="Team" subtitle={users.length + " member" + (users.length === 1 ? "" : "s")} />

      {err && <p className="text-xs bg-rose-50 text-rose-700 rounded-lg px-3 py-2 mb-3">{err}</p>}

      {me?.role === "admin" && teamCode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4">
          <div className="text-xs font-semibold text-amber-900 mb-0.5">Invite your crew</div>
          <div className="text-xs text-amber-800">
            Send them the app link and this team code: <span className="font-mono font-bold">{teamCode}</span>.
            They tap "Join the team" on the sign-in screen. New members start with the Member role — bump them here after they join.
          </div>
        </div>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="bg-white rounded-xl border border-stone-200 p-3 shadow-sm flex items-center gap-3">
            <Avatar user={u} size="h-9 w-9" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-slate-900">{u.name} {u.id === me?.id && <span className="text-xs text-stone-400">(you)</span>}</div>
              <div className="text-xs text-stone-400 capitalize">{u.role}</div>
            </div>
            {manage && <button onClick={() => setEditing(u)} className="text-xs text-stone-400 hover:text-stone-700">Edit</button>}
          </div>
        ))}
      </div>

      {me?.role === "admin" && (
        <div className="mt-6">
          <button onClick={() => setShowPerms((v) => !v)} className="w-full flex items-center justify-between bg-white rounded-xl border border-stone-200 p-3.5 shadow-sm">
            <div className="text-left">
              <div className="font-semibold text-sm text-slate-900">Role permissions</div>
              <div className="text-xs text-stone-500">Configure what leads and members can do</div>
            </div>
            <span className="text-stone-400">{showPerms ? "▲" : "▼"}</span>
          </button>
          {showPerms && <PermissionMatrix />}
        </div>
      )}

      {editing && (
        <UserEditor user={editing} canDelete={editing.id !== me?.id}
          onSave={save} onClose={() => setEditing(null)} onDelete={remove} />
      )}
    </div>
  );
}

function PermissionMatrix() {
  const { supabase, roles, online } = useApp();
  const [busyKey, setBusyKey] = useState(null);

  const toggle = async (role, key) => {
    if (!online || busyKey) return;
    setBusyKey(role + key);
    await supabase.from("role_permissions")
      .upsert({ role, perm: key, allowed: !(roles[role] && roles[role][key]) });
    setBusyKey(null);
  };

  return (
    <div className="mt-2 bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="grid grid-cols-12 gap-1 px-3 py-2 text-xs uppercase tracking-wide text-stone-400 bg-stone-50 border-b border-stone-200">
        <div className="col-span-6">Permission</div>
        <div className="col-span-2 text-center">Admin</div>
        <div className="col-span-2 text-center">Lead</div>
        <div className="col-span-2 text-center">Member</div>
      </div>
      {PERMISSIONS.map((p) => (
        <div key={p.key} className="grid grid-cols-12 gap-1 px-3 py-2 items-center border-b border-stone-100 text-sm">
          <div className="col-span-6 text-stone-700">{p.label}</div>
          <div className="col-span-2 text-center text-emerald-600">●</div>
          {["lead", "member"].map((role) => {
            const on = !!(roles[role] && roles[role][p.key]);
            return (
              <div key={role} className="col-span-2 flex justify-center">
                <button onClick={() => toggle(role, p.key)} role="switch" aria-checked={on}
                  disabled={busyKey === role + p.key}
                  className={"relative h-5 w-9 rounded-full transition-colors " + (on ? "bg-amber-500" : "bg-stone-300")}>
                  <span className={"absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all " + (on ? "left-4" : "left-0.5")} />
                </button>
              </div>
            );
          })}
        </div>
      ))}
      <p className="text-xs text-stone-400 px-3 py-2">Admins always have full access. Members can always update tasks assigned to them. These rules are enforced by the database, not just the app.</p>
    </div>
  );
}

function UserEditor({ user, canDelete, onSave, onClose, onDelete }) {
  const [u, setU] = useState(user);
  const set = (k, v) => setU((x) => ({ ...x, [k]: v }));
  return (
    <Modal title="Edit member" onClose={onClose}
      footer={<>
        {canDelete && <button className={btnDanger + " mr-auto"} onClick={() => onDelete(u.id)}>Remove</button>}
        <button className={btnGhost} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} disabled={!u.name.trim()} onClick={() => onSave(u)}>Save</button>
      </>}>
      <Field label="Name"><input className={inputCls} value={u.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" /></Field>
      <Field label="Role"><select className={inputCls} value={u.role} onChange={(e) => set("role", e.target.value)}>{ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}</select></Field>
      <div className="text-xs text-stone-500">Admin: full control · Lead: manage projects & costs · Member: works assigned tasks. Tune the details under Role permissions.</div>
      <p className="text-xs text-stone-400 mt-2">Removing a member deletes their profile; their account can no longer use the app. Their completed work stays on record.</p>
    </Modal>
  );
}
