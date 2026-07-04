import React, { useEffect, useState } from "react";

export default function StudentVerificationAdmin() {
  const [items, setItems] = useState<any[]>([]);

  const token = (window as any).__ADMIN_TOKEN || null;

  useEffect(() => {
    fetch("/api/admin/student-verifications", { headers: { "x-admin-token": token || "" } })
      .then((r) => r.json())
      .then((d) => { if (d?.verifications) setItems(d.verifications); })
      .catch(() => {});
  }, []);

  const approve = async (id: string) => {
    await fetch(`/api/admin/student-verifications/${id}/approve`, { method: "POST", headers: { "x-admin-token": token || "" } });
    setItems((s) => s.filter((it) => it.id !== id));
  };

  const reject = async (id: string) => {
    await fetch(`/api/admin/student-verifications/${id}/reject`, { method: "POST", headers: { "x-admin-token": token || "" }, body: JSON.stringify({ reason: "Does not meet requirements" }) });
    setItems((s) => s.filter((it) => it.id !== id));
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold">Student Verification Admin</h3>
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
