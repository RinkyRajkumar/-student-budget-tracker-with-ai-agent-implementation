import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { loginUser, signupUser } from "../services/localAuth.js";
import SpendlyLoader from "./SpendlyLoader.jsx";

export function LoginPage({ onNavigate, onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const user = await loginUser(form);
      window.setTimeout(() => onLogin(user), 1000);
    } catch (err) {
      setIsLoading(false);
      setError(err.message);
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Login to continue to your student budget dashboard." onNavigate={onNavigate}>
      <SpendlyLoader show={isLoading} message="Securing your budget space..." />
      <form className="space-y-4" onSubmit={submit}>
        {error && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
        <label className="block text-sm font-semibold text-slate-300">Email<input className="input mt-2" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="block text-sm font-semibold text-slate-300">Password<input className="input mt-2" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <button className="btn-primary w-full py-3" disabled={isLoading}>Login <ArrowRight size={17} /></button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-400">
        New here? <button className="font-semibold text-violet-300" onClick={() => onNavigate("/signup")}>Create an account</button>
      </p>
    </AuthShell>
  );
}

export function SignupPage({ onNavigate, onSignup }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    setIsLoading(true);
    try {
      onSignup(await signupUser(form));
    } catch (err) {
      setIsLoading(false);
      setError(err.message);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Set up your profile before choosing your budget preferences." onNavigate={onNavigate}>
      <SpendlyLoader show={isLoading} message="Creating your Spendly space..." />
      <form className="space-y-4" onSubmit={submit}>
        {error && <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>}
        <label className="block text-sm font-semibold text-slate-300">Full name<input className="input mt-2" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="block text-sm font-semibold text-slate-300">Email<input className="input mt-2" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="block text-sm font-semibold text-slate-300">Password<input className="input mt-2" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <label className="block text-sm font-semibold text-slate-300">Confirm password<input className="input mt-2" type="password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} /></label>
        <button className="btn-primary w-full py-3" disabled={isLoading}>Continue to onboarding <ArrowRight size={17} /></button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-400">
        Already have an account? <button className="font-semibold text-violet-300" onClick={() => onNavigate("/login")}>Login</button>
      </p>
    </AuthShell>
  );
}

function AuthShell({ title, subtitle, children, onNavigate }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.28),transparent_30rem),#070816] px-4 py-10 text-slate-100">
      <section className="w-full max-w-md">
        <button className="btn-soft mb-4 px-3" onClick={() => onNavigate("/")}>
          <ArrowLeft size={16} /> Home
        </button>
        <div className="card p-5 md:p-6">
          <h1 className="text-3xl font-black tracking-normal">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </section>
    </main>
  );
}
