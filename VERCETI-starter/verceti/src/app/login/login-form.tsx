"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не вдалося увійти.");
    } finally {
      setLoading(false);
    }
  }

  return <form onSubmit={submit} style={{marginTop:24}}>
    <label style={{fontSize:11,color:"#b8b0c7"}}>Електронна пошта</label>
    <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/>
    <label style={{fontSize:11,color:"#b8b0c7"}}>Пароль</label>
    <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Ваш пароль"/>
    {error && <p style={{color:"#ff8f9f",fontSize:11}}>{error}</p>}
    <button className="btn" style={{width:"100%",marginTop:5}} disabled={loading}>{loading ? "Вхід..." : "Увійти"}</button>
  </form>;
}
