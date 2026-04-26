"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// ---- Types ----

interface Agent {
  id: string;
  name: string;
  service_type: string;
  reputation_score: number;
  total_jobs_completed: number;
  total_jobs_failed: number;
  stake_sats: number;
}

interface Transaction {
  id: string;
  job_id: string | null;
  from_agent_id: string | null;
  to_agent_id: string | null;
  type: string;
  amount_sats: number;
  status: string;
  description: string | null;
  created_at: string;
}

interface NetworkStats {
  total_agents: number;
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  success_rate: number;
  avg_reputation: number;
  lightning: {
    total_sats_transacted: number;
    total_staked_sats: number;
    total_query_fees_sats: number;
    total_escrow_released_sats: number;
  };
}

// ---- Trust Tier Helpers ----

function getTierName(score: number): string {
  if (score >= 90) return "ELITE";
  if (score >= 75) return "TRUSTED";
  if (score >= 50) return "STANDARD";
  if (score >= 25) return "PROBATION";
  return "UNTRUSTED";
}

function getTierColor(score: number): string {
  if (score >= 90) return "#a855f7";
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#eab308";
  if (score >= 25) return "#f97316";
  return "#ef4444";
}

function getTransactionIcon(type: string): string {
  switch (type) {
    case "stake": return "🔒";
    case "escrow_hold": return "⏳";
    case "escrow_release": return "✅";
    case "escrow_refund": return "↩️";
    case "verification_fee": return "🔍";
    case "query_fee": return "🔎";
    case "slash": return "⚡";
    default: return "💰";
  }
}

function getTransactionColor(type: string): string {
  switch (type) {
    case "escrow_release": return "#22c55e";
    case "escrow_refund": return "#f97316";
    case "slash": return "#ef4444";
    case "verification_fee": return "#a855f7";
    case "stake": return "#3b82f6";
    default: return "#6b7280";
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export default function DashboardPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);
  const [flashAgentId, setFlashAgentId] = useState<string | null>(null);
  const [flashTxId, setFlashTxId] = useState<string | null>(null);

  // ---- Fetch Data ----

  const fetchAgents = useCallback(async () => {
    const res = await fetch("/api/discover/free?limit=50");
    const data = await res.json();
    if (data.success) {
      setAgents(data.results.agents);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setTransactions(data);
  }, []);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/stats");
    const data = await res.json();
    if (data.success) setStats(data.stats);
  }, []);

  // ---- Initial Load ----

  useEffect(() => {
    fetchAgents();
    fetchTransactions();
    fetchStats();
  }, [fetchAgents, fetchTransactions, fetchStats]);

  // ---- Realtime Subscriptions ----

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agents" },
        (payload) => {
          fetchAgents();
          if (payload.new && (payload.new as any).id) {
            setFlashAgentId((payload.new as any).id);
            setTimeout(() => setFlashAgentId(null), 2000);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "transactions" },
        (payload) => {
          fetchTransactions();
          fetchStats();
          if (payload.new && (payload.new as any).id) {
            setFlashTxId((payload.new as any).id);
            setTimeout(() => setFlashTxId(null), 2000);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAgents, fetchTransactions, fetchStats]);

  // ---- Demo Controls ----

  const runDemo = async (quality: string, serviceType: string) => {
    const key = `${quality}-${serviceType}`;
    setDemoLoading(key);
    try {
      await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_type: serviceType, quality }),
      });
    } catch (err) {
      console.error("Demo error:", err);
    }
    setDemoLoading(null);
  };

  // ---- Render ----

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "#e4e4e7",
        fontFamily: "var(--font-mono)",
      }}
    >
      {/* ========== HEADER ========== */}
      <header
        style={{
          borderBottom: "1px solid #1a1a2e",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(180deg, #0a0a12 0%, #050508 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span
              style={{
                fontSize: "20px",
                fontWeight: 800,
                letterSpacing: "3px",
                color: "#a855f7",
              }}
            >
              ARBITER
            </span>
          </Link>
          <span style={{ color: "#3f3f50", fontSize: "14px" }}>|</span>
          <span style={{ color: "#6b7280", fontSize: "13px" }}>
            Trust at machine speed
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#22c55e",
              display: "inline-block",
              animation: "pulse 2s infinite",
            }}
          />
          <span style={{ color: "#22c55e", fontSize: "12px" }}>LIVE</span>
        </div>
      </header>

      {/* ========== STATS BAR ========== */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1px",
          background: "#1a1a2e",
          margin: "0",
        }}
      >
        {[
          {
            label: "AGENTS",
            value: stats?.total_agents ?? "—",
            color: "#a855f7",
          },
          {
            label: "TOTAL JOBS",
            value: stats?.total_jobs ?? "—",
            color: "#3b82f6",
          },
          {
            label: "SUCCESS RATE",
            value: stats ? `${stats.success_rate}%` : "—",
            color: "#22c55e",
          },
          {
            label: "AVG REPUTATION",
            value: stats?.avg_reputation ?? "—",
            color: "#eab308",
          },
          {
            label: "SATS TRANSACTED",
            value: stats
              ? `⚡ ${stats.lightning.total_sats_transacted.toLocaleString()}`
              : "—",
            color: "#f59e0b",
          },
          {
            label: "ESCROW RELEASED",
            value: stats
              ? `⚡ ${stats.lightning.total_escrow_released_sats.toLocaleString()}`
              : "—",
            color: "#22c55e",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--bg-primary)",
              padding: "20px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#6b7280",
                letterSpacing: "1.5px",
                marginBottom: "8px",
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: 700,
                color: stat.color,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </section>

      {/* ========== MAIN GRID ========== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1px",
          background: "#1a1a2e",
          minHeight: "calc(100vh - 200px)",
        }}
      >
        {/* ---- LEFT: LEADERBOARD ---- */}
        <section style={{ background: "var(--bg-primary)", padding: "24px" }}>
          <h2
            style={{
              fontSize: "13px",
              color: "#6b7280",
              letterSpacing: "2px",
              marginBottom: "20px",
              fontWeight: 600,
            }}
          >
            AGENT LEADERBOARD
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {agents.map((agent, i) => (
              <div
                key={agent.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background:
                    flashAgentId === agent.id
                      ? "rgba(168, 85, 247, 0.15)"
                      : "#0a0a14",
                  border: `1px solid ${
                    flashAgentId === agent.id ? "#a855f7" : "#1a1a2e"
                  }`,
                  transition: "all 0.5s ease",
                }}
              >
                {/* Rank */}
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: i < 3 ? "#f59e0b" : "#3f3f50",
                    minWidth: "28px",
                    textAlign: "center",
                  }}
                >
                  {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>

                {/* Tier Badge */}
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    letterSpacing: "1px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: `${getTierColor(agent.reputation_score)}20`,
                    color: getTierColor(agent.reputation_score),
                    border: `1px solid ${getTierColor(agent.reputation_score)}40`,
                    minWidth: "72px",
                    textAlign: "center",
                  }}
                >
                  {getTierName(agent.reputation_score)}
                </span>

                {/* Name + Service */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#e4e4e7",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {agent.name}
                  </div>
                  <div style={{ fontSize: "11px", color: "#6b7280" }}>
                    {agent.service_type}
                  </div>
                </div>

                {/* Score */}
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 800,
                      color: getTierColor(agent.reputation_score),
                    }}
                  >
                    {agent.reputation_score}
                  </div>
                  <div style={{ fontSize: "10px", color: "#6b7280" }}>
                    {agent.total_jobs_completed}W / {agent.total_jobs_failed}L
                  </div>
                </div>

                {/* Stake */}
                <div
                  style={{
                    fontSize: "11px",
                    color: "#f59e0b",
                    minWidth: "60px",
                    textAlign: "right",
                  }}
                >
                  ⚡{agent.stake_sats}
                </div>
              </div>
            ))}

            {agents.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#3f3f50",
                }}
              >
                No agents registered yet. Seed some data first.
              </div>
            )}
          </div>
        </section>

        {/* ---- RIGHT: TRANSACTIONS + CONTROLS ---- */}
        <section
          style={{
            background: "var(--bg-primary)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Demo Controls */}
          <div style={{ marginBottom: "24px" }}>
            <h2
              style={{
                fontSize: "13px",
                color: "#6b7280",
                letterSpacing: "2px",
                marginBottom: "16px",
                fontWeight: 600,
              }}
            >
              DEMO CONTROLS
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              {/* Good Jobs */}
              {["summarizer", "code_review", "translator"].map((svc) => (
                <button
                  key={`good-${svc}`}
                  onClick={() => runDemo("good", svc)}
                  disabled={demoLoading !== null}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #1a3a1a",
                    background:
                      demoLoading === `good-${svc}`
                        ? "#1a3a1a"
                        : "#0a1a0a",
                    color: "#22c55e",
                    cursor: demoLoading ? "wait" : "pointer",
                    fontSize: "12px",
                    fontFamily: "inherit",
                    fontWeight: 600,
                    textAlign: "left",
                    transition: "all 0.2s",
                  }}
                >
                  {demoLoading === `good-${svc}` ? "Running..." : `✅ Good ${svc}`}
                </button>
              ))}

              {/* Bad Jobs */}
              {["summarizer", "code_review", "translator"].map((svc) => (
                <button
                  key={`bad-${svc}`}
                  onClick={() => runDemo("bad", svc)}
                  disabled={demoLoading !== null}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #3a1a1a",
                    background:
                      demoLoading === `bad-${svc}` ? "#3a1a1a" : "#1a0a0a",
                    color: "#ef4444",
                    cursor: demoLoading ? "wait" : "pointer",
                    fontSize: "12px",
                    fontFamily: "inherit",
                    fontWeight: 600,
                    textAlign: "left",
                    transition: "all 0.2s",
                  }}
                >
                  {demoLoading === `bad-${svc}` ? "Running..." : `❌ Bad ${svc}`}
                </button>
              ))}
            </div>

            <p
              style={{
                fontSize: "11px",
                color: "#3f3f50",
                marginTop: "8px",
              }}
            >
              Click to run a full job cycle: create → submit → AI verify → escrow settle → reputation update
            </p>
          </div>

          {/* Transaction Feed */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <h2
              style={{
                fontSize: "13px",
                color: "#6b7280",
                letterSpacing: "2px",
                marginBottom: "16px",
                fontWeight: 600,
              }}
            >
              TRANSACTION FEED
            </h2>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                maxHeight: "calc(100vh - 440px)",
                overflowY: "auto",
              }}
            >
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    background:
                      flashTxId === tx.id
                        ? "rgba(168, 85, 247, 0.1)"
                        : "#0a0a14",
                    border: `1px solid ${
                      flashTxId === tx.id ? "#a855f740" : "#1a1a2e"
                    }`,
                    transition: "all 0.5s ease",
                  }}
                >
                  <span style={{ fontSize: "16px" }}>
                    {getTransactionIcon(tx.type)}
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: getTransactionColor(tx.type),
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {tx.type.replace(/_/g, " ")}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#6b7280",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {tx.description || "—"}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color:
                          tx.type === "slash" || tx.type === "escrow_refund"
                            ? "#ef4444"
                            : "#f59e0b",
                      }}
                    >
                      {tx.type === "slash" ? "-" : ""}⚡{tx.amount_sats}
                    </div>
                    <div style={{ fontSize: "10px", color: "#3f3f50" }}>
                      {timeAgo(tx.created_at)}
                    </div>
                  </div>
                </div>
              ))}

              {transactions.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#3f3f50",
                  }}
                >
                  No transactions yet. Run a demo to see money flow.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
