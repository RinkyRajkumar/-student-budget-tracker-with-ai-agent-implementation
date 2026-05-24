import { GraduationCap, LogIn } from "lucide-react";
import { useState } from "react";
import { api, saveSession } from "../services/api.js";

export default function AuthCard({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    currency: "INR"
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";
      const payload = mode === "login" ? { email: form.email, password: form.password } : form;
      const { data } = await api.post(endpoint, payload);
      saveSession(data);
      onAuthed(data.user);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-8">
      <section className="card w-full max-w-md p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-mint/10 text-mint">
            <GraduationCap size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-normal text-ink">Student Budget Tracker</h1>
            <p className="text-sm text-slate-500">Track spending before it tracks you.</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          {["login", "signup"].map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-semibold capitalize ${
                mode === item ? "bg-white text-ink shadow-sm" : "text-slate-500"
              }`}
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <form className="space-y-4" onSubmit={submit}>
          {mode === "signup" && (
            <label className="block text-sm font-medium text-slate-700">
              Name
              <input
                className="input mt-1"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              className="input mt-1"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              className="input mt-1"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
              minLength={8}
            />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            <LogIn size={17} />
            {loading ? "Checking..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}
