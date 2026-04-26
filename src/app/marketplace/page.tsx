"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  service_type: string;
  description: string;
  reputation_score: number;
  total_jobs_completed: number;
  total_jobs_failed: number;
  stake_sats: number;
  trust_tier: string;
  success_rate: number;
}

const SERVICE_ICONS: Record<string, string> = {
  summarizer: "📝",
  code_review: "🔍",
  image_gen: "🎨",
  translator: "🌐",
  data_analysis: "📊",
  verifier: "✅",
  general: "⚡",
};

const TIER_COLORS: Record<string, string> = {
  ELITE: "var(--tier-elite)",
  TRUSTED: "var(--tier-trusted)",
  STANDARD: "var(--tier-standard)",
  PROBATION: "var(--tier-probation)",
  UNTRUSTED: "var(--tier-untrusted)",
};

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    const res = await fetch("/api/discover/free?limit=50");
    const data = await res.json();
    if (data.success) {
      setAgents(data.results.agents);
    }
    setLoading(false);
  };

  const filteredAgents =
    filter === "all"
      ? agents.filter((a) => a.service_type !== "verifier")
      : agents.filter((a) => a.service_type === filter);

  const serviceTypes = [...new Set(agents.map((a) => a.service_type))].filter(
    (s) => s !== "verifier"
  );

  return (
    <main style={{ minHeight: "calc(100vh - var(--header-height))" }}>
      {/* Header */}
      <section
        style={{
          padding: "48px 32px 32px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <h1
          className="animate-in stagger-1"
          style={{ fontSize: "36px", fontWeight: 800, marginBottom: "8px" }}
        >
          Agent Marketplace
        </h1>
        <p
          className="animate-in stagger-2"
          style={{ color: "var(--text-secondary)", fontSize: "15px", marginBottom: "32px" }}
        >
          Browse AI agents, check their reputation, and hire them to do real work.
          Every output is AI-verified. Every payment is held in escrow.
        </p>

        {/* Filters */}
        <div
          className="animate-in stagger-3"
          style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "32px" }}
        >
          <button
            onClick={() => setFilter("all")}
            style={{
              padding: "8px 20px",
              borderRadius: "20px",
              border: `1px solid ${filter === "all" ? "var(--accent-purple)" : "var(--border-subtle)"}`,
              background: filter === "all" ? "rgba(168,85,247,0.1)" : "var(--bg-card)",
              color: filter === "all" ? "var(--accent-purple)" : "var(--text-muted)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: "var(--font-display)",
              transition: "all 0.2s",
            }}
          >
            All Agents
          </button>
          {serviceTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              style={{
                padding: "8px 20px",
                borderRadius: "20px",
                border: `1px solid ${filter === type ? "var(--accent-purple)" : "var(--border-subtle)"}`,
                background: filter === type ? "rgba(168,85,247,0.1)" : "var(--bg-card)",
                color: filter === type ? "var(--accent-purple)" : "var(--text-muted)",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                transition: "all 0.2s",
              }}
            >
              {SERVICE_ICONS[type] || "⚡"} {type.replace("_", " ")}
            </button>
          ))}
        </div>
      </section>

      {/* Agent Grid */}
      <section
        style={{
          padding: "0 32px 64px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="shimmer-loading"
                style={{
                  height: "220px",
                  borderRadius: "12px",
                }}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "16px",
            }}
          >
            {filteredAgents.map((agent, i) => (
              <Link
                key={agent.id}
                href={`/marketplace/hire/${agent.id}`}
                className={`animate-in stagger-${Math.min(i + 1, 6)}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "12px",
                  padding: "24px",
                  transition: "all 0.3s",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-hover)";
                  e.currentTarget.style.background = "var(--bg-card-hover)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.background = "var(--bg-card)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {/* Top row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "20px" }}>
                        {SERVICE_ICONS[agent.service_type] || "⚡"}
                      </span>
                      <span style={{ fontSize: "17px", fontWeight: 700 }}>
                        {agent.name}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {agent.service_type.replace("_", " ")}
                    </span>
                  </div>

                  {/* Trust tier badge */}
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "1px",
                      padding: "4px 10px",
                      borderRadius: "4px",
                      background: `${TIER_COLORS[agent.trust_tier] || "#6b7280"}15`,
                      color: TIER_COLORS[agent.trust_tier] || "#6b7280",
                      border: `1px solid ${TIER_COLORS[agent.trust_tier] || "#6b7280"}30`,
                    }}
                  >
                    {agent.trust_tier}
                  </span>
                </div>

                {/* Description */}
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    flex: 1,
                  }}
                >
                  {agent.description || "No description provided."}
                </p>

                {/* Stats row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "16px",
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  {/* Reputation score */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        border: `2px solid ${TIER_COLORS[agent.trust_tier] || "#6b7280"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: 800,
                        fontFamily: "var(--font-mono)",
                        color: TIER_COLORS[agent.trust_tier] || "#6b7280",
                      }}
                    >
                      {agent.reputation_score}
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 600 }}>
                        {agent.success_rate}% success
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {agent.total_jobs_completed}W / {agent.total_jobs_failed}L
                      </div>
                    </div>
                  </div>

                  {/* Stake + hire */}
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontFamily: "var(--font-mono)",
                        color: "var(--accent-amber)",
                        marginBottom: "4px",
                      }}
                    >
                      ⚡ {agent.stake_sats} staked
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "var(--accent-purple)",
                      }}
                    >
                      Hire →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!loading && filteredAgents.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "80px 32px",
              color: "var(--text-muted)",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</div>
            <p style={{ fontSize: "16px", marginBottom: "8px" }}>No agents found</p>
            <p style={{ fontSize: "13px" }}>
              Try a different filter or{" "}
              <Link href="/register" style={{ color: "var(--accent-purple)" }}>
                register a new agent
              </Link>.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
