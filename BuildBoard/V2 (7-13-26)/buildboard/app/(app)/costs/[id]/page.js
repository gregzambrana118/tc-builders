"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApp, useTable } from "@/lib/AppContext";
import { logActivity } from "@/lib/activity";
import { money, uid, btnDanger, btnGhost, BAND_COLORS, BAND_KEYS, Spinner } from "@/lib/ui";

export default function CostSheetPage() {
  const { id } = useParams();
  const router = useRouter();
  const { supabase, me, can, online } = useApp();
  const [projects] = useTable("projects");
  const editable = can("costs.manage");

  const [s, setS] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("saved"); // saved | saving | error | offline
  const timer = useRef(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("cost_sheets").select("*").eq("id", id).single();
      if (data) setS(data);
      setLoaded(true);
    })();
  }, [supabase, id]);

  /* debounce writes so typing in a cell doesn't hammer the database */
  const commit = (next) => {
    setS(next);
    if (!editable) return;
    if (!online) { setSaveState("offline"); return; }
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { error } = await supabase.from("cost_sheets")
        .update({ name: next.name, project_id: next.project_id, categories: next.categories })
        .eq("id", id);
      setSaveState(error ? "error" : "saved");
    }, 600);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!loaded) return <Spinner label="Loading cost analysis…" />;
  if (!s) return <div className="text-sm text-stone-500 py-16 text-center">This cost analysis doesn't exist anymore.</div>;

  const catSubtotal = (c) => (c.items || []).reduce((sum, i) => sum + (Number(i.qty) || 0) * (Number(i.perUnit) || 0), 0);
  const grand = (s.categories || []).reduce((sum, c) => sum + catSubtotal(c), 0);

  const setName = (name) => commit({ ...s, name });
  const setProject = (project_id) => commit({ ...s, project_id: project_id || null });
  const addCategory = () => commit({ ...s, categories: [...s.categories, { id: uid(), name: "New Category", color: BAND_KEYS[s.categories.length % BAND_KEYS.length], items: [] }] });
  const updateCategory = (cid, patch) => commit({ ...s, categories: s.categories.map((c) => (c.id === cid ? { ...c, ...patch } : c)) });
  const removeCategory = (cid) => commit({ ...s, categories: s.categories.filter((c) => c.id !== cid) });
  const addItem = (cid) => updateCategory(cid, { items: [...s.categories.find((c) => c.id === cid).items, { id: uid(), name: "", qty: 1, unit: "ea", perUnit: 0 }] });
  const updateItem = (cid, iid, patch) => {
    const c = s.categories.find((x) => x.id === cid);
    updateCategory(cid, { items: c.items.map((i) => (i.id === iid ? { ...i, ...patch } : i)) });
  };
  const removeItem = (cid, iid) => {
    const c = s.categories.find((x) => x.id === cid);
    updateCategory(cid, { items: c.items.filter((i) => i.id !== iid) });
  };
  const deleteSheet = async () => {
    if (!online) return;
    await supabase.from("cost_sheets").delete().eq("id", id);
    logActivity(supabase, me.id, "costs.delete", `${me.name} deleted cost analysis "${s.name}"`, s.project_id);
    router.push("/costs");
  };

  const saveLabel = { saved: "Saved", saving: "Saving…", error: "Save failed — check connection", offline: "Offline — not saved" }[saveState];

  return (
    <div>
      <div className="flex items-center justify-between mb-3 no-print">
        <button onClick={() => router.push("/costs")} className="text-sm text-stone-500 hover:text-stone-800">‹ All cost analyses</button>
        <div className="flex items-center gap-3">
          {editable && <span className={"text-xs " + (saveState === "saved" ? "text-stone-400" : saveState === "saving" ? "text-sky-600" : "text-rose-600")}>{saveLabel}</span>}
          <button onClick={() => window.print()} className={btnGhost + " !px-3 !py-1.5 text-xs"}>Print / Save PDF</button>
        </div>
      </div>

      {/* print-only header for the board */}
      <div className="hidden print:block mb-3">
        <div className="text-lg font-bold text-slate-900">{s.name}</div>
        <div className="text-xs text-stone-500">
          {projects.find((p) => p.id === s.project_id)?.name || ""} · Prepared {new Date().toLocaleDateString()}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden print-sheet">
        <div className="bg-slate-900 text-white px-4 py-3 print:hidden">
          {editable ? (
            <input value={s.name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent text-white font-bold tracking-tight focus:outline-none" />
          ) : <div className="font-bold tracking-tight">{s.name}</div>}
          <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-300">
            <span>Linked to:</span>
            {editable ? (
              <select value={s.project_id || ""} onChange={(e) => setProject(e.target.value)} className="bg-slate-800 text-white rounded px-1.5 py-0.5 text-xs focus:outline-none">
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : <span className="text-white">{projects.find((p) => p.id === s.project_id)?.name || "None"}</span>}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-1 px-3 py-2 text-xs uppercase tracking-wide text-stone-400 border-b border-stone-200 bg-stone-50">
          <div className="col-span-6">Item</div>
          <div className="col-span-2 text-right">Qty</div>
          <div className="col-span-2 text-right">Per unit</div>
          <div className="col-span-2 text-right">Cost</div>
        </div>

        {s.categories.map((c) => (
          <div key={c.id}>
            <div className={"flex items-center gap-2 px-3 py-1.5 font-semibold text-sm " + BAND_COLORS[c.color]}>
              {editable ? (
                <>
                  <input value={c.name} onChange={(e) => updateCategory(c.id, { name: e.target.value })} className="flex-1 bg-transparent focus:outline-none font-semibold" />
                  <select value={c.color} onChange={(e) => updateCategory(c.id, { color: e.target.value })} className="bg-white/60 rounded text-xs px-1 py-0.5 focus:outline-none no-print">
                    {BAND_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <button onClick={() => removeCategory(c.id)} className="text-xs opacity-60 hover:opacity-100 px-1 no-print" title="Remove category">✕</button>
                </>
              ) : <span className="flex-1">{c.name}</span>}
            </div>

            {c.items.map((i) => {
              const cost = (Number(i.qty) || 0) * (Number(i.perUnit) || 0);
              return (
                <div key={i.id} className="grid grid-cols-12 gap-1 px-3 py-1.5 items-center border-b border-stone-100 text-sm">
                  <div className="col-span-6 min-w-0">
                    {editable ? (
                      <>
                        <input value={i.name} onChange={(e) => updateItem(c.id, i.id, { name: e.target.value })} placeholder="Item name" className="w-full text-sm focus:outline-none bg-transparent" />
                        <input value={i.unit} onChange={(e) => updateItem(c.id, i.id, { unit: e.target.value })} placeholder="unit" className="w-full text-xs text-stone-400 focus:outline-none bg-transparent" />
                      </>
                    ) : <div className="truncate">{i.name}<span className="text-xs text-stone-400 ml-1">{i.unit}</span></div>}
                  </div>
                  <div className="col-span-2">
                    {editable ? <input type="number" value={i.qty} onChange={(e) => updateItem(c.id, i.id, { qty: e.target.value })} className="w-full text-right font-mono text-sm focus:outline-none bg-stone-50 rounded px-1 py-0.5" />
                      : <div className="text-right font-mono">{i.qty}</div>}
                  </div>
                  <div className="col-span-2">
                    {editable ? <input type="number" step="0.01" value={i.perUnit} onChange={(e) => updateItem(c.id, i.id, { perUnit: e.target.value })} className="w-full text-right font-mono text-sm focus:outline-none bg-stone-50 rounded px-1 py-0.5" />
                      : <div className="text-right font-mono">{money(i.perUnit)}</div>}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <span className="font-mono text-sm text-slate-900">{money(cost)}</span>
                    {editable && <button onClick={() => removeItem(c.id, i.id)} className="text-stone-300 hover:text-rose-500 text-xs no-print" title="Remove">✕</button>}
                  </div>
                </div>
              );
            })}

            <div className="grid grid-cols-12 gap-1 px-3 py-1.5 items-center bg-stone-50 border-b border-stone-200">
              <div className="col-span-6">{editable && <button onClick={() => addItem(c.id)} className="text-xs text-amber-600 font-medium no-print">+ Add item</button>}</div>
              <div className="col-span-4 text-right text-xs text-stone-500 font-medium">{c.name} total</div>
              <div className="col-span-2 text-right font-mono font-semibold text-slate-900">{money(catSubtotal(c))}</div>
            </div>
          </div>
        ))}

        <div className="grid grid-cols-12 gap-1 px-3 py-3 items-center bg-rose-50">
          <div className="col-span-6">{editable && <button onClick={addCategory} className="text-xs text-amber-600 font-semibold no-print">+ Add category</button>}</div>
          <div className="col-span-4 text-right font-bold text-slate-900">Grand Total</div>
          <div className="col-span-2 text-right font-mono font-bold text-base text-slate-900">{money(grand)}</div>
        </div>
      </div>

      {editable && <button onClick={deleteSheet} className={btnDanger + " mt-4 no-print"}>Delete this cost analysis</button>}
    </div>
  );
}
