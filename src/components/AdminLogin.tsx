import React, { useState } from "react";

export default function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [token, setToken] = useState<string>("");

  const submit = (e: any) => {
    e.preventDefault();
    if (!token) return;
    // store token in sessionStorage for admin session
    try { sessionStorage.setItem("admin_token", token); } catch (e) {}
    onLogin(token);
  };

  return (
    <form onSubmit={submit} className="p-3 rounded bg-white/5">
      <h4 className="font-semibold mb-2">Admin Login</h4>
      <input placeholder="Enter admin token" value={token} onChange={(e) => setToken(e.target.value)} className="input mb-2" />
      <div className="flex gap-2">
        <button className="btn" type="submit">Sign In</button>
      </div>
    </form>
  );
}
