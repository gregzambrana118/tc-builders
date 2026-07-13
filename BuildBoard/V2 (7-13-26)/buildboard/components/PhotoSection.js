"use client";
import { useRef, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { logActivity } from "@/lib/activity";
import { uid } from "@/lib/ui";

const BUCKET = "task-photos";

/** Downscale big phone photos client-side so uploads stay fast on job-site signal. */
async function shrink(file, maxDim = 1600, quality = 0.82) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    return blob || file;
  } catch {
    return file; // fall back to the original if anything goes sideways
  }
}

export default function PhotoSection({ taskId, photos, canAdd, refetch }) {
  const { supabase, me, online } = useApp();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [viewing, setViewing] = useState(null);

  const urlFor = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const upload = async (files) => {
    if (!online) { setErr("You're offline — photos can't upload right now."); return; }
    setBusy(true); setErr(null);
    try {
      for (const file of files) {
        const blob = await shrink(file);
        const path = `${taskId}/${uid()}.jpg`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const { error: rowErr } = await supabase.from("task_photos").insert({ task_id: taskId, path, uploaded_by: me.id });
        if (rowErr) throw rowErr;
      }
      logActivity(supabase, me.id, "task.photo", `${me.name} added ${files.length} photo${files.length === 1 ? "" : "s"} to a task`);
      refetch();
    } catch (e) {
      setErr(e.message || "Upload failed. Try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removePhoto = async (p) => {
    if (!online) { setErr("You're offline — changes can't be saved right now."); return; }
    setErr(null);
    try {
      await supabase.from("task_photos").delete().eq("id", p.id);
      await supabase.storage.from(BUCKET).remove([p.path]);
      setViewing(null);
      refetch();
    } catch (e) { setErr(e.message || "Couldn't remove photo."); }
  };

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-stone-500">Photos</span>
        {canAdd && (
          <button onClick={() => inputRef.current?.click()} disabled={busy}
            className="text-xs text-amber-600 font-medium disabled:opacity-50">
            {busy ? "Uploading…" : "+ Add photos"}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple capture="environment" className="hidden"
        onChange={(e) => e.target.files?.length && upload(Array.from(e.target.files))} />

      {err && <p className="text-xs bg-rose-50 text-rose-700 rounded-lg px-3 py-2 mb-2">{err}</p>}

      {photos.length === 0 ? (
        <p className="text-xs text-stone-400">No photos yet.{canAdd ? " Snap the site, the problem, or the finished work." : ""}</p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {photos.map((p) => (
            <button key={p.id} onClick={() => setViewing(p)} className="aspect-square rounded-lg overflow-hidden border border-stone-200 bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlFor(p.path)} alt="Task photo" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-[60] bg-slate-900/90 flex flex-col items-center justify-center p-4" onClick={() => setViewing(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urlFor(viewing.path)} alt="Task photo" className="max-h-[80vh] max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
          <div className="flex gap-3 mt-3">
            {(viewing.uploaded_by === me.id || canAdd) && (
              <button onClick={(e) => { e.stopPropagation(); removePhoto(viewing); }} className="text-xs text-rose-300">Remove photo</button>
            )}
            <button className="text-xs text-stone-300">Tap anywhere to close</button>
          </div>
        </div>
      )}
    </div>
  );
}
