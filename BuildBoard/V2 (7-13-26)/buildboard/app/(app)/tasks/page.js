"use client";
import { useMemo, useState } from "react";
import { useApp, useTable } from "@/lib/AppContext";
import { logActivity } from "@/lib/activity";
import PhotoSection from "@/components/PhotoSection";
import {
  Header, Empty, Pill, Avatar, Modal, Field,
  inputCls, btnPrimary, btnGhost, btnDanger,
  TASK_STATUSES, PRIORITIES, STATUS_STYLE, PRIORITY_STYLE,
} from "@/lib/ui";

export default function TasksPage() {
  const { supabase, me, users, can, online } = useApp();
  const [tasks, refetch] = useTable("tasks");
  const [projects] = useTable("projects");
  const [photos, refetchPhotos] = useTable("task_photos");
  const [filter, setFilter] = useState(me?.role === "member" ? "mine" : "all");
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState(null);

  const blank = { id: null, title: "", project_id: projects[0]?.id || null, assignee_id: me?.id || null, status: "To Do", priority: "Medium", due_date: "", notes: "", depends_on: null };

  const userById = (id) => users.find((u) => u.id === id);
  const projById = (id) => projects.find((p) => p.id === id);
  const taskById = (id) => tasks.find((t) => t.id === id);
  const canEditTask = (t) => can("tasks.editAny") || t.assignee_id === me?.id;

  const visible = tasks.filter((t) => (filter === "mine" ? t.assignee_id === me?.id : filter === "open" ? t.status !== "Done" : true));

  const guard = (fn) => async (...args) => {
    if (!online) { setErr("You're offline — changes can't be saved right now."); return; }
    setErr(null);
    try { await fn(...args); } catch (e) { setErr(e.message || "Couldn't save. Try again."); }
  };

  const save = guard(async (t) => {
    const row = {
      title: t.title.trim(), project_id: t.project_id || null, assignee_id: t.assignee_id || null,
      status: t.status, priority: t.priority, due_date: t.due_date || null,
      notes: t.notes, depends_on: t.depends_on || null,
    };
    if (t.id) {
      const { error } = await supabase.from("tasks").update(row).eq("id", t.id);
      if (error) throw error;
      logActivity(supabase, me.id, "task.update", `${me.name} updated task "${row.title}"`, row.project_id);
    } else {
      const { data, error } = await supabase.from("tasks").insert(row).select().single();
      if (error) throw error;
      const who = row.assignee_id ? userById(row.assignee_id)?.name : "unassigned";
      logActivity(supabase, me.id, "task.create", `${me.name} created task "${row.title}" (${who})`, data?.project_id);
    }
    setEditing(null); refetch();
  });

  const remove = guard(async (id) => {
    const t = taskById(id);
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
    logActivity(supabase, me.id, "task.delete", `${me.name} deleted task "${t?.title || ""}"`, t?.project_id);
    setEditing(null); refetch();
  });

  const cycleStatus = guard(async (t) => {
    if (!canEditTask(t)) return;
    const i = TASK_STATUSES.indexOf(t.status);
    const next = TASK_STATUSES[(i + 1) % TASK_STATUSES.length];
    const { error } = await supabase.from("tasks").update({ status: next }).eq("id", t.id);
    if (error) throw error;
    logActivity(supabase, me.id, "task.status", `${me.name} moved "${t.title}" to ${next}`, t.project_id);
    refetch();
  });

  const photoCount = useMemo(() => {
    const m = {};
    for (const p of photos) m[p.task_id] = (m[p.task_id] || 0) + 1;
    return m;
  }, [photos]);

  return (
    <div>
      <Header title="Tasks" subtitle={visible.length + " shown"}
        action={can("tasks.create") && <button className={btnPrimary} onClick={() => setEditing(blank)}>+ New</button>} />

      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {[["mine", "My tasks"], ["open", "Open"], ["all", "All"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setFilter(id)} className={"px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap " + (filter === id ? "bg-slate-900 text-white" : "bg-white border border-stone-200 text-stone-600")}>{lbl}</button>
        ))}
      </div>

      {err && <p className="text-xs bg-rose-50 text-rose-700 rounded-lg px-3 py-2 mb-3">{err}</p>}

      {visible.length === 0 ? <Empty msg="Nothing here." sub={filter === "mine" ? "You have no tasks assigned." : "No tasks match this filter."} /> : (
        <div className="space-y-2">
          {visible.map((t) => {
            const editable = canEditTask(t);
            const dep = t.depends_on ? taskById(t.depends_on) : null;
            const waiting = dep && dep.status !== "Done";
            return (
              <div key={t.id} className="bg-white rounded-xl border border-stone-200 p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <button onClick={() => cycleStatus(t)} disabled={!editable} title={editable ? "Tap to advance status" : ""}
                    className={"shrink-0 " + (editable ? "cursor-pointer" : "cursor-default")}>
                    <Pill className={STATUS_STYLE[t.status]}>{t.status}</Pill>
                  </button>
                  <button onClick={() => setEditing(t)} className="flex-1 min-w-0 text-left">
                    <div className="font-medium text-sm text-slate-900 truncate">{t.title}</div>
                    <div className="text-xs text-stone-500 truncate">
                      {projById(t.project_id)?.name || "No project"}
                      {t.due_date ? " · due " + t.due_date : ""}
                      {photoCount[t.id] ? ` · ${photoCount[t.id]} photo${photoCount[t.id] === 1 ? "" : "s"}` : ""}
                    </div>
                  </button>
                  <Pill className={PRIORITY_STYLE[t.priority]}>{t.priority}</Pill>
                  <Avatar user={userById(t.assignee_id)} size="h-7 w-7" />
                </div>
                {dep && (
                  <div className={"mt-2 text-xs rounded-lg px-2.5 py-1.5 " + (waiting ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>
                    {waiting ? "⛓ Waiting on: " : "✓ Cleared to start — finished: "}{dep.title}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <TaskEditor task={editing} projects={projects} users={users} tasks={tasks} photos={photos}
          refetchPhotos={refetchPhotos}
          readOnly={editing.id ? !canEditTask(editing) : false}
          assignedOnly={editing.id ? (!can("tasks.editAny") && editing.assignee_id === me?.id) : false}
          canDelete={editing.id && can("tasks.editAny")}
          onSave={save} onClose={() => setEditing(null)} onDelete={remove} />
      )}
    </div>
  );
}

function TaskEditor({ task, projects, users, tasks, photos, refetchPhotos, readOnly, assignedOnly, canDelete, onSave, onClose, onDelete }) {
  const [t, setT] = useState({ ...task, due_date: task.due_date || "" });
  const set = (k, v) => setT((x) => ({ ...x, [k]: v }));
  const lockMeta = readOnly || assignedOnly;
  const depOptions = tasks.filter((x) => x.id !== t.id && x.project_id === t.project_id);

  return (
    <Modal title={t.id ? (readOnly ? "Task" : "Edit task") : "New task"} onClose={onClose}
      footer={readOnly ? <button className={btnGhost} onClick={onClose}>Close</button> : (
        <>
          {canDelete && <button className={btnDanger + " mr-auto"} onClick={() => onDelete(t.id)}>Delete</button>}
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={!t.title.trim()} onClick={() => onSave(t)}>Save</button>
        </>
      )}>
      {assignedOnly && <p className="text-xs text-stone-500 bg-stone-100 rounded-lg px-3 py-2 mb-3">This is your assigned task — you can update its status, notes, and photos.</p>}
      <Field label="Task"><input className={inputCls} value={t.title} disabled={lockMeta} onChange={(e) => set("title", e.target.value)} placeholder="What needs doing?" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Project"><select className={inputCls} value={t.project_id || ""} disabled={lockMeta} onChange={(e) => set("project_id", e.target.value || null)}><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Assignee"><select className={inputCls} value={t.assignee_id || ""} disabled={lockMeta} onChange={(e) => set("assignee_id", e.target.value || null)}><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status"><select className={inputCls} value={t.status} disabled={readOnly} onChange={(e) => set("status", e.target.value)}>{TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Priority"><select className={inputCls} value={t.priority} disabled={lockMeta} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Due date"><input type="date" className={inputCls} value={t.due_date} disabled={lockMeta} onChange={(e) => set("due_date", e.target.value)} /></Field>
      <Field label="Waiting on (must finish first)">
        <select className={inputCls} value={t.depends_on || ""} disabled={lockMeta} onChange={(e) => set("depends_on", e.target.value || null)}>
          <option value="">Nothing — can start anytime</option>
          {depOptions.map((x) => <option key={x.id} value={x.id}>{x.title}{x.status === "Done" ? " (done)" : ""}</option>)}
        </select>
      </Field>
      <Field label="Notes"><textarea className={inputCls + " h-20 resize-none"} value={t.notes} disabled={readOnly} onChange={(e) => set("notes", e.target.value)} placeholder="Updates, blockers…" /></Field>

      {t.id && (
        <PhotoSection taskId={t.id}
          photos={photos.filter((p) => p.task_id === t.id)}
          canAdd={!readOnly} refetch={refetchPhotos} />
      )}
      {!t.id && <p className="text-xs text-stone-400">Save the task first, then reopen it to add photos.</p>}
    </Modal>
  );
}
