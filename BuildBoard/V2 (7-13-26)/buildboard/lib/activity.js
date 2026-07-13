"use client";
// Fire-and-forget activity logging. Never blocks the action it describes.
export async function logActivity(supabase, userId, action, summary, projectId = null) {
  try {
    await supabase.from("activity").insert({
      actor: userId, action, summary, project_id: projectId,
    });
  } catch (e) { /* logging must never break the app */ }
}
