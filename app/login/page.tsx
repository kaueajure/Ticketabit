"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, Ticket } from "lucide-react";
import { readApiJson } from "@/lib/client-http";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await readApiJson<{ ok?: boolean; error?: string }>(response);
      if (!response.ok) throw new Error(result.error ?? "Não foi possível entrar.");
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Não foi possível entrar.");
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark"><Ticket size={18} strokeWidth={2.3}/></span><strong>Ticketabit</strong></div>
        <div className="login-heading"><h1>Acesse sua conta</h1><p>Entre com seus dados para gerenciar os tickets.</p></div>
        <form onSubmit={submit}>
          <label className="login-field"><span>E-mail</span><div><Mail size={16}/><input type="email" autoComplete="email" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seuemail@empresa.com"/></div></label>
          <label className="login-field"><span>Senha</span><div><LockKeyhole size={16}/><input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha"/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="primary-button login-submit" disabled={loading}>{loading ? <><i/>Entrando...</> : "Entrar"}</button>
        </form>
        <p className="login-help">Problemas para acessar? Procure o administrador do sistema.</p>
      </section>
      <footer>© {new Date().getFullYear()} Ticketabit · Gestão de tickets</footer>
    </main>
  );
}
