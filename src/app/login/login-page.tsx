"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Plain email + password. No emails involved in signing in at all — a
  // magic-link flow was tried first, but mail providers auto-opening links
  // to scan them for safety kept burning the one-time link before the real
  // person clicked it. Fine for a small trusted group of 4 friends.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    // Try signing in first.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!signInError) {
      setLoading(false);
      router.push("/");
      router.refresh();
      return;
    }

    // If that failed because there's no account yet, create one.
    if (signInError.message.toLowerCase().includes("invalid login credentials")) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: displayName ? { display_name: displayName } : undefined,
        },
      });

      setLoading(false);
      if (signUpError) {
        setError(signUpError.message);
      } else {
        router.push("/");
        router.refresh();
      }
      return;
    }

    setLoading(false);
    setError(signInError.message);
  };

  return (
    <main
      className="relative min-h-screen flex items-center justify-center px-4 bg-cover bg-center"
      style={{ backgroundImage: "url('/login-bg.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-slate-900/80 border border-slate-700 shadow-2xl p-8 backdrop-blur">
        <h1 className="text-2xl font-bold text-white text-center tracking-tight">
          🏈 Who Ya Got?
        </h1>
        <p className="text-slate-400 text-center text-sm mt-1 mb-6">
          Sign in to make your picks
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Your name (first time only)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Paul"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              First time? Just pick any password here — it creates your account.
              Next time, use the same one to sign back in.
            </p>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2.5 transition"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
