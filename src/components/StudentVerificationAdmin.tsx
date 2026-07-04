import React, { useEffect, useState } from "react";
import AdminLogin from "./AdminLogin";

export default function StudentVerificationAdmin() {
  const [items, setItems] = useState<any[]>([]);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = sessionStorage.getItem("admin_token");
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch("/api/admin/student-verifications", { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((d) => { if (d?.verifications) setItems(d.verifications); })
      .catch(() => {});
  }, [token]);

  const approve = async (id: string) => {
    if (!token) return;
    await fetch(`/api/admin/student-verifications/${id}/approve`, { method: "POST", headers: { "x-admin-token": token } });
    setItems((s) => s.filter((it) => it.id !== id));
  };

  const reject = async (id: string) => {
    if (!token) return;
    await fetch(`/api/admin/student-verifications/${id}/reject`, { method: "POST", headers: { "x-admin-token": token, "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Does not meet requirements" }) });
    setItems((s) => s.filter((it) => it.id !== id));
  };

  const handleLogin = (t: string) => {
    setToken(t);
  };

  const logout = () => {
    sessionStorage.removeItem("admin_token");
    setToken(null);
    setItems([]);
  };

  if (!token) {
    return (
      <div>
        <h3 className="text-lg font-bold mb-2">Admin Login</h3>
        <AdminLogin onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Student Verification Admin</h3>
        <button onClick={logout} className="btn">Logout</button>
      </div>
      {items.map((it) => (
        <div key={it.id} className="p-3 rounded bg-white/3">
          <div className="font-semibold">{it.full_name} — {it.college_name}</div>
          <div className="text-sm">{it.registered_email} • {it.mobile_number}</div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => approve(it.id)} className="btn">Approve</button>
            <button onClick={() => reject(it.id)} className="btn">Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}
