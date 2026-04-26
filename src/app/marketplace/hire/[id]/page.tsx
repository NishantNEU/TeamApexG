"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useCheckout } from "@moneydevkit/nextjs";

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
  const { createCheckout, isLoading: checkoutLoading } = useCheckout();
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [inputData, setInputData] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "paying">("idle");
  const [error, setError] = useState<string | null>(null);

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
    setStatus("paying");

    // Build payload
    const payload: Record<string, any> = {};
    Object.entries(inputData).forEach(([key, val]) => {
      payload[key] = key === "max_length" ? parseInt(val) || 100 : val;
    });

    // Save input to sessionStorage so the success page can retrieve it
    sessionStorage.setItem(`hire_input_${id}`, JSON.stringify(payload));

    try {
      const result = await createCheckout({
        type: "AMOUNT",
        title: `Hire ${agent.name}`,
        description: `Pay to hire ${agent.name} for ${agent.service_type.replace("_", " ")}`,
        amount: 500,
        currency: "SAT",
        successUrl: `${window.location.origin}/marketplace/hire/${id}/success`,
        metadata: { agent_id: id, agent_name: agent.name },
      });

      if (result.error) {
        setError(result.error.message);
        setStatus("idle");
        return;
      }

      window.location.href = result.data.checkoutUrl;
    } catch (err: any) {
      setError(err.message || "Failed to create checkout. Please try again.");
      setStatus("idle");
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
  const hasInput = Object.values(inputData).some((v) => v.trim());

  return (
    <main style={{ minHeight: "calc(100vh - var(--header-height))", maxWidth: "900px", margin: "0 auto", padding: "48px 32px" }}>

      {/* Agent Header */}
      <div className="animate-in stagger-1" style={{ marginBottom: "40px" }}>
        <Link href="/marketplace" style={{ color: "var(--text-muted)", fontSize: "13px", textDecoration: "none", display: "inline-block", marginBottom: "16px" }}>
          ← Back to Marketplace
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "12px",
            background: `${tierColor}15`, border: `2px solid ${tierColor}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "20px", fontWeight: 800, fontFamily: "var(--font-mono)", color: tierColor,
          }}>
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

      {/* Redirecting to checkout */}
      {status === "paying" && (
        <div className="animate-in" style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px", animation: "pulse 1.5s infinite" }}>⚡</div>
          <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>Redirecting to Lightning checkout...</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>
            You'll scan a QR code to pay 500 sats via Lightning Network.
          </p>
        </div>
      )}

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
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>Released only if AI verifier approves the output</div>
            </div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--accent-amber)", fontFamily: "var(--font-mono)" }}>
              ⚡ 500 sats
            </div>
          </div>

          <button
            onClick={handleHire}
            disabled={!hasInput || checkoutLoading}
            style={{
              marginTop: "24px", width: "100%", padding: "16px",
              borderRadius: "8px", border: "none", fontSize: "15px",
              fontWeight: 700, fontFamily: "var(--font-display)",
              cursor: hasInput && !checkoutLoading ? "pointer" : "not-allowed",
              background: hasInput && !checkoutLoading ? "var(--accent-purple)" : "var(--bg-elevated)",
              color: hasInput && !checkoutLoading ? "#fff" : "var(--text-muted)",
              transition: "all 0.2s",
            }}
          >
            {checkoutLoading ? "Creating invoice..." : `Pay ⚡ 500 sats to Hire ${agent.name}`}
          </button>
        </div>
      )}
    </main>
  );
}
