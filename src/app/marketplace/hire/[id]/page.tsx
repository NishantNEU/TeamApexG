"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import OutputRenderer from "@/components/OutputRenderer";

interface AgentProfile {
  id: string;
  name: string;
  service_type: string;
  description: string;
  reputation_score: number;
  total_jobs_completed: number;
  total_jobs_failed: number;
  stake_sats: number;
}

interface HireResult {
  success: boolean;
  job_id: string;
  agent: { name: string; service_type: string; reputation_score: number; trust_tier: string };
  work: { output: Record<string, any>; processing_time_ms: number };
  verification: { passed: boolean; score: number; reasoning: string };
  payment: { amount_sats: number; escrow_status: string; reputation_change: number };
}

const INPUT_CONFIGS: Record<string, { label: string; placeholder: string; fields: Array<{ key: string; label: string; type: "textarea" | "input"; placeholder: string }> }> = {
  summarizer: {
    label: "What should I summarize?",
    placeholder: "Paste text, article, or document content...",
    fields: [
      { key: "text", label: "Text to summarize", type: "textarea", placeholder: "Paste the text you want summarized here..." },
      { key: "max_length", label: "Max words", type: "input", placeholder: "100" },
    ],
  },
  code_review: {
    label: "What code should I review?",
    placeholder: "Paste your code...",
    fields: [
      { key: "code", label: "Code", type: "textarea", placeholder: "function add(a, b) {\n  return a + b;\n}" },
      { key: "language", label: "Language", type: "input", placeholder: "javascript" },
      { key: "focus", label: "Focus areas", type: "input", placeholder: "bugs, security, performance" },
    ],
  },
  translator: {
    label: "What should I translate?",
    placeholder: "Enter text to translate...",
    fields: [
      { key: "text", label: "Text", type: "textarea", placeholder: "Enter text to translate..." },
      { key: "source_language", label: "From", type: "input", placeholder: "English" },
      { key: "target_language", label: "To", type: "input", placeholder: "Spanish" },
    ],
  },
  data_analysis: {
    label: "What data should I analyze?",
    placeholder: "Paste data or describe your analysis need...",
    fields: [
      { key: "text", label: "Data / Context", type: "textarea", placeholder: "Paste data, numbers, or describe what you need analyzed..." },
      { key: "question", label: "Question", type: "input", placeholder: "What patterns or insights can you find?" },
    ],
  },
  general: {
    label: "What do you need?",
    placeholder: "Describe your task...",
    fields: [
      { key: "text", label: "Task", type: "textarea", placeholder: "Describe what you need done..." },
    ],
  },
};

const TIER_COLORS: Record<string, string> = {
  ELITE: "#a855f7", TRUSTED: "#22c55e", STANDARD: "#eab308", PROBATION: "#f97316", UNTRUSTED: "#ef4444",
};

function getTierName(score: number): string {
  if (score >= 90) return "ELITE";
  if (score >= 75) return "TRUSTED";
  if (score >= 50) return "STANDARD";
  if (score >= 25) return "PROBATION";
  return "UNTRUSTED";
}

export default function HirePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [inputData, setInputData] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "working" | "done">("idle");
  const [result, setResult] = useState<HireResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setAgent(data.agent);
      });
  }, [id]);

  const handleHire = async () => {
    if (!agent) return;
    setError(null);
    setStatus("working");
    setStep(1);

    const stepDelay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    await stepDelay(800);
    setStep(2);

    try {
      const payload: Record<string, any> = {};
      Object.entries(inputData).forEach(([key, val]) => {
        if (key === "max_length") {
          payload[key] = parseInt(val) || 100;
        } else {
          payload[key] = val;
        }
      });

      const res = await fetch("/api/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seller_agent_id: agent.id,
          input_data: payload,
          amount_sats: 500,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Hire failed");
        setStatus("idle");
        setStep(0);
        return;
      }

      setStep(3);
      await stepDelay(600);
      setStep(4);
      await stepDelay(600);
      setStep(5);

      setResult(data);
      setStatus("done");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setStatus("idle");
      setStep(0);
    }
  };

  if (!agent) {
    return (
      <main style={{ minHeight: "calc(100vh - var(--header-height))", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="shimmer-loading" style={{ width: "400px", height: "300px", borderRadius: "12px" }} />
      </main>
    );
  }

  const config = INPUT_CONFIGS[agent.service_type] || INPUT_CONFIGS.general;
  const tierColor = TIER_COLORS[getTierName(agent.reputation_score)] || "#6b7280";

  return (
    <main style={{ minHeight: "calc(100vh - var(--header-height))", maxWidth: "900px", margin: "0 auto", padding: "48px 32px" }}>

      {/* Agent Header */}
      <div className="animate-in stagger-1" style={{ marginBottom: "40px" }}>
        <Link href="/marketplace" style={{ color: "var(--text-muted)", fontSize: "13px", textDecoration: "none", display: "inline-block", marginBottom: "16px" }}>
          ← Back to Marketplace
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "56px", height: "56px", borderRadius: "12px",
              background: `${tierColor}15`, border: `2px solid ${tierColor}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px", fontWeight: 800, fontFamily: "var(--font-mono)", color: tierColor,
            }}
          >
            {agent.reputation_score}
          </div>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 800 }}>{agent.name}</h1>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "4px" }}>
              <span style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                {agent.service_type.replace("_", " ")}
              </span>
              <span style={{ fontSize: "10px", fontWeight: 700, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: "4px", background: `${tierColor}15`, color: tierColor, border: `1px solid ${tierColor}30` }}>
                {getTierName(agent.reputation_score)}
              </span>
              <span style={{ fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                {agent.total_jobs_completed}W / {agent.total_jobs_failed}L
              </span>
            </div>
          </div>
        </div>
        {agent.description && (
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "16px", lineHeight: 1.6 }}>
            {agent.description}
          </p>
        )}
      </div>

      {/* Input Form */}
      {status === "idle" && (
        <div className="animate-in stagger-2">
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>
            {config.label}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {config.fields.map((field) => (
              <div key={field.key}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", fontFamily: "var(--font-mono)" }}>
                  {field.label}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    value={inputData[field.key] || ""}
                    onChange={(e) => setInputData({ ...inputData, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    rows={6}
                    style={{
                      width: "100%", padding: "14px 16px", borderRadius: "8px",
                      background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                      color: "var(--text-primary)", fontSize: "14px", fontFamily: "var(--font-mono)",
                      resize: "vertical", outline: "none", transition: "border 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent-purple)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border-subtle)")}
                  />
                ) : (
                  <input
                    value={inputData[field.key] || ""}
                    onChange={(e) => setInputData({ ...inputData, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    style={{
                      width: "100%", padding: "12px 16px", borderRadius: "8px",
                      background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                      color: "var(--text-primary)", fontSize: "14px", fontFamily: "var(--font-mono)",
                      outline: "none", transition: "border 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent-purple)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border-subtle)")}
                  />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--accent-red)", fontSize: "13px" }}>
              {error}
            </div>
          )}

          {/* Payment info */}
          <div style={{ marginTop: "24px", padding: "16px 20px", borderRadius: "8px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Payment (held in escrow)</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>Released only if AI verifier approves output</div>
            </div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--accent-amber)", fontFamily: "var(--font-mono)" }}>
              ⚡ 500 sats
            </div>
          </div>

          <button
            onClick={handleHire}
            disabled={!Object.values(inputData).some((v) => v.trim())}
            style={{
              marginTop: "24px", width: "100%", padding: "16px",
              borderRadius: "8px", border: "none", fontSize: "15px",
              fontWeight: 700, fontFamily: "var(--font-display)",
              cursor: Object.values(inputData).some((v) => v.trim()) ? "pointer" : "not-allowed",
              background: Object.values(inputData).some((v) => v.trim()) ? "var(--accent-purple)" : "var(--bg-elevated)",
              color: Object.values(inputData).some((v) => v.trim()) ? "#fff" : "var(--text-muted)",
              transition: "all 0.2s",
            }}
          >
            Hire {agent.name} — Pay ⚡ 500 sats
          </button>
        </div>
      )}

      {/* Processing Steps */}
      {status === "working" && (
        <div className="animate-in" style={{ padding: "40px 0" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "32px" }}>Processing your task...</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { s: 1, label: "Escrow hold", desc: "500 sats locked in escrow" },
              { s: 2, label: `${agent.name} is working`, desc: "AI agent processing your task..." },
              { s: 3, label: "Verifying output", desc: "AI quality check in progress" },
              { s: 4, label: "Settling payment", desc: "Processing escrow settlement" },
            ].map((item) => (
              <div
                key={item.s}
                style={{
                  display: "flex", alignItems: "center", gap: "16px",
                  padding: "16px 20px", borderRadius: "8px",
                  background: step >= item.s ? "var(--bg-card)" : "transparent",
                  border: `1px solid ${step >= item.s ? "var(--border-subtle)" : "transparent"}`,
                  opacity: step >= item.s ? 1 : 0.3,
                  transition: "all 0.5s",
                }}
              >
                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%",
                  background: step > item.s ? "var(--accent-green)" : step === item.s ? "var(--accent-purple)" : "var(--bg-elevated)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px", color: "#fff", fontWeight: 700,
                  animation: step === item.s ? "pulse-glow 2s infinite" : "none",
                }}>
                  {step > item.s ? "✓" : item.s}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {status === "done" && result && (
        <div className="animate-in" style={{ padding: "40px 0" }}>
          {/* Verification status */}
          <div style={{
            padding: "24px", borderRadius: "12px", marginBottom: "24px",
            background: result.verification.passed ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${result.verification.passed ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: result.verification.passed ? "var(--accent-green)" : "var(--accent-red)" }}>
                  {result.verification.passed ? "✅ Verified & Paid" : "❌ Failed — Refunded"}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                  Quality score: {result.verification.score}/100 — {result.verification.reasoning}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "24px", fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--accent-amber)" }}>
                  ⚡ {result.payment.amount_sats}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {result.payment.escrow_status}
                </div>
              </div>
            </div>
          </div>

          {/* Agent output — beautifully rendered */}
          <div style={{ marginBottom: "24px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--text-secondary)" }}>
              AGENT OUTPUT
            </h3>
            <OutputRenderer
              service_type={result.agent.service_type}
              output={result.work.output}
            />
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px", fontFamily: "var(--font-mono)" }}>
              Processed in {result.work.processing_time_ms}ms
            </div>
          </div>

          {/* Payment breakdown */}
          <div style={{ marginBottom: "32px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--text-secondary)" }}>
              PAYMENT BREAKDOWN
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { label: "Escrow", value: `⚡ ${result.payment.amount_sats} sats`, status: result.payment.escrow_status, color: result.verification.passed ? "var(--accent-green)" : "var(--accent-red)" },
                { label: "Verification fee", value: "⚡ 50 sats", status: "paid to verifier", color: "var(--accent-purple)" },
                { label: "Reputation change", value: `${result.payment.reputation_change > 0 ? "+" : ""}${result.payment.reputation_change}`, status: `now ${result.agent.reputation_score}`, color: result.payment.reputation_change > 0 ? "var(--accent-green)" : "var(--accent-red)" },
              ].map((item) => (
                <div key={item.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "12px 16px", borderRadius: "6px",
                  background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                }}>
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>{item.label}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>{item.status}</span>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: item.color, fontSize: "14px" }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => { setStatus("idle"); setResult(null); setStep(0); setInputData({}); }}
              style={{
                flex: 1, padding: "14px", borderRadius: "8px", border: "none",
                background: "var(--accent-purple)", color: "#fff",
                fontSize: "14px", fontWeight: 700, cursor: "pointer",
                fontFamily: "var(--font-display)",
              }}
            >
              Hire Again
            </button>
            <Link
              href="/marketplace"
              style={{
                flex: 1, padding: "14px", borderRadius: "8px",
                background: "var(--bg-card)", color: "var(--text-secondary)",
                textDecoration: "none", fontSize: "14px", fontWeight: 600,
                textAlign: "center", border: "1px solid var(--border-subtle)",
                fontFamily: "var(--font-display)",
              }}
            >
              Back to Marketplace
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
