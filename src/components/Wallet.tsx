"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Wallet() {
  const [stats, setStats] = useState({
    spent: 0,
    jobs_hired: 0,
    verified_passed: 0,
    verified_failed: 0,
  });

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel("wallet-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, () => {
        fetchStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchStats = async () => {
    const { data: holds } = await supabase
      .from("transactions")
      .select("amount_sats")
      .eq("type", "escrow_hold")
      .eq("status", "completed");

    const { data: refunds } = await supabase
      .from("transactions")
      .select("amount_sats")
      .eq("type", "escrow_refund")
      .eq("status", "completed");

    const { count: completed } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    const { count: failed } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed");

    const totalSpent = (holds || []).reduce((s, t) => s + t.amount_sats, 0);
    const totalRefunded = (refunds || []).reduce((s, t) => s + t.amount_sats, 0);

    setStats({
      spent: totalSpent - totalRefunded,
      jobs_hired: (completed || 0) + (failed || 0),
      verified_passed: completed || 0,
      verified_failed: failed || 0,
    });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "10px 18px",
        borderRadius: "8px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "15px" }}>⚡</span>
        <span
          style={{
            fontSize: "15px",
            fontWeight: 800,
            fontFamily: "var(--font-mono)",
            color: "var(--accent-amber)",
          }}
        >
          {stats.spent.toLocaleString()}
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          sats spent
        </span>
      </div>

      <div style={{ width: "1px", height: "20px", background: "var(--border-subtle)" }} />

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--accent-green)" }}>
          {stats.verified_passed}
        </span>
        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>passed</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--accent-red)" }}>
          {stats.verified_failed}
        </span>
        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>failed</span>
      </div>
    </div>
  );
}
