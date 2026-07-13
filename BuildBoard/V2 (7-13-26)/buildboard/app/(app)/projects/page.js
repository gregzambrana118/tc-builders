"use client";
import { useState } from "react";
import { useApp, useTable } from "@/lib/AppContext";
import { logActivity } from "@/lib/activity";
import {
  Header, Empty, Pill, Avatar, Modal, Field,
  inputCls, btnPrimary, btnGhost, btnDanger,
  PROJECT_STATUSES, STATUS_STYLE,
} from "@/lib/ui";

export default function ProjectsPage() {
  const { supabase, me, users, can, online } = useApp();
  const [projects, refetch] = useTable("projects");
  const [tasks] = useTable("tasks");
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState(null);

  const blank = { id: null, name: "", status: "Not Started", location: "", lead: me?.id || null, start_date: "", target_date: "", description: "" };
  const userById = (id) => users.find((u) => u.id === id);
  const canEdit = (p) => can("projects.editAny") || p.lead === me?.id;

  const guard = (fn) => async (...args) => {
    if (!online) { setErr("You're offline — changes can't be saved right now."); return; }
    setErr(null);
    try { await fn(...args); } catch (e) { setErr(e.message || "Couldn't save. Try again."); }
  };

  const save = guard(async (p) => {
    const row = {
      name: p.name.trim(), status: p.status, location: p.location,
      lead: p.lead || null, start_date: p.start_date || null,
      target_date: p.target_date || null, description: p.description,
    };
    if (p.id) {
      const { error } = await supabase.from("projects").update(row).eq("id", p.id);
      if (error) throw error;
      logActivity(supabase, me.id, "project.update", `${me.name} updated project "${row.name}"`, p.id);
    } else {
      const { data, error } = await supabase.from("projects").insert(row).select().single();
      if (error) throw error;
      logActivity(supabase, me.id, "project.create", `${me.name} created project "${row.name}"`, data?.id);
    }
    setEditing(null); refetch();
  });

  const remove = guard(async (id) => {
    const p = projects.find((x) => x.id === id);
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
    logActivity(supabase, me.id, "project.delete", `${me.name} deleted project "${p?.name || ""}"`);
    setEditing(null); refetch();
  });

  return (
    <div>
      <Header title="Projects" subtitle={projects.length + " total"}
        action={can("projects.create") && <button className={btnPrimary} onClick={() => setEditing(blank)}>+ New</button>} />

      {err && <p className="text-xs bg-rose-50 text-rose-700 rounded-lg px-3 py-2 mb-3">{err}</p>}

      {projects.length === 0 ? (
        <Empty msg="No projects yet." sub={can("projects.create") ? "Create your first one to get started." : "Ask an admin to add a project."} />
      ) : (
        PROJECT_STATUSES.map((st) => {
          const group = projects.filter((p) => p.status === st);
          if (!group.length) return null;
          return (
            <div key={st} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Pill className={STATUS_STYLE[st]}>{st}</Pill>
                <span className="text-xs text-stone-400">{group.length}</span>
              </div>
              <div className="space-y-2">
                {group.map((p) => {
                  const open = tasks.filter((t) => t.project_id === p.id && t.status !== "Done").length;
                  return (
                    <button key={p.id} onClick={() => setEditing(p)} className="w-full text-left bg-white rounded-xl border border-stone-200 p-3.5 hover:border-amber-300 shadow-sm">
                      <div className="font-semibold text-sm text-slate-900">{p.name}</div>
                      {p.location && <div className="text-xs text-stone-500 mt-0.5">{p.location}</div>}
                      <div className="flex items-center gap-3 mt-2.5 text-xs text-stone-500">
                        <span className="flex items-center gap-1"><Avatar user={userById(p.lead)} size="h-5 w-5" /> {userById(p.lead)?.name || "Unassigned"}</span>
                        {p.target_date && <span>· due {p.target_date}</span>}
                        <span className="ml-auto">{open} open task{open === 1 ? "" : "s"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {editing && (
        <ProjectEditor project={editing} users={users}
          readOnly={editing.id ? !canEdit(editing) : false}
          canDelete={editing.id && can("projects.delete")}
          onSave={save} onClose={() => setEditing(null)} onDelete={remove} />
      )}
    </div>
  );
}

function ProjectEditor({ project, users, readOnly, canDelete, onSave, onClose, onDelete }) {
  const [p, setP] = useState({ ...project, start_date: project.start_date || "", target_date: project.target_date || "" });
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  return (
    <Modal title={p.id ? (readOnly ? "Project" : "Edit project") : "New project"} onClose={onClose}
      footer={readOnly ? <button className={btnGhost} onClick={onClose}>Close</button> : (
        <>
          {canDelete && <button className={btnDanger + " mr-auto"} onClick={() => onDelete(p.id)}>Delete</button>}
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={!p.name.trim()} onClick={() => onSave(p)}>Save</button>
        </>
      )}>
      {readOnly && <p className="text-xs text-stone-500 bg-stone-100 rounded-lg px-3 py-2 mb-3">You can view this project but only its lead or an admin can edit it.</p>}
      <fieldset disabled={readOnly} className={readOnly ? "opacity-90" : ""}>
        <Field label="Project name"><input className={inputCls} value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Fellowship Hall Floor Reno" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status"><select className={inputCls} value={p.status} onChange={(e) => set("status", e.target.value)}>{PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Lead"><select className={inputCls} value={p.lead || ""} onChange={(e) => set("lead", e.target.value || null)}><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        </div>
        <Field label="Location"><input className={inputCls} value={p.location} onChange={(e) => set("location", e.target.value)} placeholder="Building / room" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date"><input type="date" className={inputCls} value={p.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
          <Field label="Target date"><input type="date" className={inputCls} value={p.target_date} onChange={(e) => set("target_date", e.target.value)} /></Field>
        </div>
        <Field label="Description"><textarea className={inputCls + " h-24 resize-none"} value={p.description} onChange={(e) => set("description", e.target.value)} placeholder="Scope, notes, details…" /></Field>
      </fieldset>
    </Modal>
  );
}
