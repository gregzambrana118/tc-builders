"use client";
import { useApp, useTable } from "@/lib/AppContext";
import { Header, Empty, Avatar } from "@/lib/ui";

const ICONS = {
  "project.create": "▦", "project.update": "▦", "project.delete": "▦",
  "task.create": "✓", "task.update": "✓", "task.status": "→", "task.delete": "✕", "task.photo": "▣",
  "costs.create": "$", "costs.delete": "$",
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  const d = Math.floor(s / 86400);
  if (d < 7) return d + "d ago";
  return new Date(ts).toLocaleDateString();
}

export default function ActivityPage() {
  const { users } = useApp();
  const [rows] = useTable("activity");
  const [projects] = useTable("projects");
  const recent = rows.slice(0, 100);

  const userById = (id) => users.find((u) => u.id === id);
  const projById = (id) => projects.find((p) => p.id === id);

  return (
    <div>
      <Header title="Activity" subtitle="What's happened across your projects" />
      {recent.length === 0 ? (
        <Empty msg="No activity yet." sub="Changes to projects, tasks, and cost sheets will show up here." />
      ) : (
        <div className="space-y-1.5">
          {recent.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-stone-200 px-3 py-2.5 shadow-sm flex items-start gap-3">
              <span className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full bg-stone-100 text-stone-500 text-sm">
                {ICONS[a.action] || "·"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-stone-800">{a.summary}</div>
                <div className="text-xs text-stone-400 mt-0.5">
                  {timeAgo(a.created_at)}
                  {a.project_id && projById(a.project_id) ? " · " + projById(a.project_id).name : ""}
                </div>
              </div>
              <Avatar user={userById(a.actor)} size="h-6 w-6" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
