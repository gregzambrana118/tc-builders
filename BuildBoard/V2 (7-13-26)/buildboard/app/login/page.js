"use client";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { Field, inputCls, btnPrimary } from "@/lib/ui";

export default function LoginPage() {
  const supabase = getSupabase();
  const [mode, setMode] = useState("signin"); // signin | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: 'error'|'info', text }

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim(), team_code: teamCode.trim() } },
        });
        if (error) throw error;
        if (data.session) {
          window.location.href = "/projects";
        } else {
          setMsg({ kind: "info", text: "Check your email to confirm your account, then sign in here." });
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        window.location.href = "/projects";
      }
    } catch (e) {
      const text = /invalid team code/i.test(e.message || "")
        ? "That team code isn't right. Ask your project admin for the current code."
        : e.message || "Something went wrong. Try again.";
      setMsg({ kind: "error", text });
    } finally {
      setBusy(false);
    }
  };

  const ready = mode === "signup"
    ? name.trim() && email.trim() && password.length >= 6 && teamCode.trim()
    : email.trim() && password;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-1">
          <span className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-amber-500 text-slate-900 font-black text-xl">B</span>
          <div>
            <div className="text-2xl font-bold tracking-tight leading-none">BuildBoard</div>
            <div className="text-xs text-stone-400 mt-1">Construction projects for your church team</div>
          </div>
        </div>

        <div className="mt-8 bg-stone-50 text-stone-800 rounded-2xl p-5 shadow-xl">
          <div className="flex gap-1.5 mb-4">
            {[["signin", "Sign in"], ["signup", "Join the team"]].map(([id, lbl]) => (
              <button key={id} onClick={() => { setMode(id); setMsg(null); }}
                className={"flex-1 px-3 py-1.5 rounded-full text-xs font-medium " + (mode === id ? "bg-slate-900 text-white" : "bg-white border border-stone-200 text-stone-600")}>
                {lbl}
              </button>
            ))}
          </div>

          {mode === "signup" && (
            <>
              <Field label="Your name">
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Greg Sanders" autoComplete="name" />
              </Field>
              <Field label="Team code">
                <input className={inputCls} value={teamCode} onChange={(e) => setTeamCode(e.target.value)} placeholder="From your project admin" autoCapitalize="characters" />
              </Field>
            </>
          )}
          <Field label="Email">
            <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" inputMode="email" />
          </Field>
          <Field label={mode === "signup" ? "Password (6+ characters)" : "Password"}>
            <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              onKeyDown={(e) => e.key === "Enter" && ready && submit()} />
          </Field>

          {msg && (
            <p className={"text-xs rounded-lg px-3 py-2 mb-3 " + (msg.kind === "error" ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-800")}>
              {msg.text}
            </p>
          )}

          <button className={btnPrimary + " w-full"} disabled={!ready || busy} onClick={submit}>
            {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </div>

        <p className="text-xs text-stone-500 mt-4 text-center leading-relaxed">
          New members join with the team code. The first account created becomes the admin.
        </p>
      </div>
    </div>
  );
}
