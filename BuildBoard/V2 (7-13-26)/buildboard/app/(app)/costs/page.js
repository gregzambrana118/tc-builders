"use client";
import { useRouter } from "next/navigation";
import { useApp, useTable } from "@/lib/AppContext";
import { logActivity } from "@/lib/activity";
import { Header, Empty, btnPrimary, money } from "@/lib/ui";

export default function CostsPage() {
  const { supabase, me, can, online } = useApp();
  const [sheets, refetch] = useTable("cost_sheets");
  const [projects] = useTable("projects");
  const router = useRouter();
  const editable = can("costs.manage");

  const projById = (id) => projects.find((p) => p.id === id);
  const sheetTotal = (s) => (s.categories || []).reduce(
    (sum, c) => sum + (c.items || []).reduce((cs, i) => cs + (Number(i.qty) || 0) * (Number(i.perUnit) || 0), 0), 0);

  const addSheet = async () => {
    if (!online) return;
    const { data, error } = await supabase.from("cost_sheets")
      .insert({ name: "New Cost Analysis", project_id: projects[0]?.id || null, categories: [] })
      .select().single();
    if (!error && data) {
      logActivity(supabase, me.id, "costs.create", `${me.name} started a new cost analysis`, data.project_id);
      refetch();
      router.push("/costs/" + data.id);
    }
  };

  return (
    <div>
      <Header title="Cost Analysis" subtitle={sheets.length + " sheet" + (sheets.length === 1 ? "" : "s")}
        action={editable && <button className={btnPrimary} onClick={addSheet}>+ New</button>} />
      {sheets.length === 0 ? (
        <Empty msg="No cost analyses yet." sub={editable ? "Build one to estimate materials by category." : "Ask a lead to build one."} />
      ) : (
        <div className="space-y-2">
          {sheets.map((s) => (
            <button key={s.id} onClick={() => router.push("/costs/" + s.id)}
              className="w-full text-left bg-white rounded-xl border border-stone-200 p-3.5 hover:border-amber-300 shadow-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm text-slate-900 truncate">{s.name}</div>
                <div className="text-xs text-stone-500 truncate">
                  {projById(s.project_id)?.name || "No project linked"} · {(s.categories || []).length} categories
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs uppercase tracking-wide text-stone-400">Total</div>
                <div className="font-mono font-semibold text-slate-900">{money(sheetTotal(s))}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
