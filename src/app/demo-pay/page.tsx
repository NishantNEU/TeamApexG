"use client";

import { useState } from "react";
import Link from "next/link";

const SERVICES = [
  { key: "summarizer", label: "Summarizer", icon: "📝", desc: "Summarize a document" },
  { key: "code_review", label: "Code Review", icon: "💻", desc: "Review code quality" },
  { key: "translator", label: "Translator", icon: "🌐", desc: "Translate text" },
];

interface DemoResult {
  success: boolean;
  demo_flow: {
    step_1: string;
    step_2: string;
    step_3: string;
    step_4: string;
  };
  verification: {
    passed: boolean;
    score: number;
    reasoning: string;
    issues: string[];
  };
  agents: {
    buyer: string;
    seller: string;
    verifier: string;
  };
  job_id: string;
}

export default function DemoPage() {
  const [service, setService] = useState("summarizer");
  const [quality, setQuality] = useState<"good" | "bad">("good");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const STEPS = [
    "Creating job & holding escrow...",
    "Agent processing task...",
    "AI verifier scoring output...",
    "Settling escrow & updating reputation...",
  ];

  const runDemo = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    setStep(0);

    // Animate through steps while API runs
    const stepInterval = setInterval(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 900);

    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_type: service, quality }),
      });

      const data = await res.json();
      clearInterval(stepInterval);

      if (!res.ok) {
        setError(data.error ?? "Demo failed. Make sure agents are seeded.");
      } else {
        setStep(STEPS.length);
        setResult(data);
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const passed = result?.verification.passed;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-display)",
        padding: "40px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Back */}
      <div style={{ width: "100%", maxWidth: "680px", marginBottom: "32px" }}>
        <Link href="/" style={{ fontSize: "13px", color: "var(--text-muted)", textDecoration: "none" }}>
          ← Back to home
        </Link>
      </div>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "40px", maxWidth: "680px" }}>
        <p style={{
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
          color: "var(--accent-purple)",
          letterSpacing: "3px",
          marginBottom: "16px",
        }}>
          LIVE DEMO — NO REAL MONEY
        </p>
        <h1 style={{
          fontSize: "clamp(32px, 5vw, 52px)",
          fontWeight: 900,
          letterSpacing: "-1.5px",
          margin: "0 0 16px",
          background: "linear-gradient(135deg, #e4e4e7 0%, #a855f7 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          See Arbiter in Action
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "16px", lineHeight: 1.6, margin: 0 }}>
          Run a full job cycle — escrow, AI execution, verification, and settlement —
          in about 3 seconds. Pick a service and quality level below.
        </p>
      </div>

      {/* Config */}
      <div style={{
        width: "100%",
        maxWidth: "680px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "16px",
        padding: "28px",
        marginBottom: "20px",
      }}>
        {/* Service picker */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ fontSize: "12px", letterSpacing: "1.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "block", marginBottom: "12px" }}>
            SERVICE TYPE
          </label>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {SERVICES.map((s) => (
              <button
                key={s.key}
                onClick={() => setService(s.key)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: `1px solid ${service === s.key ? "var(--accent-purple)" : "var(--border-subtle)"}`,
                  background: service === s.key ? "rgba(168,85,247,0.12)" : "transparent",
                  color: service === s.key ? "var(--accent-purple)" : "var(--text-muted)",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: "var(--font-display)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                }}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quality picker */}
        <div style={{ marginBottom: "28px" }}>
          <label style={{ fontSize: "12px", letterSpacing: "1.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "block", marginBottom: "12px" }}>
            OUTPUT QUALITY
          </label>
          <div style={{ display: "flex", gap: "10px" }}>
            {[
              { key: "good", label: "Good output", desc: "Agent passes verification", color: "#22c55e" },
              { key: "bad", label: "Bad output", desc: "Agent fails + stake slashed", color: "#ef4444" },
            ].map((q) => (
              <button
                key={q.key}
                onClick={() => setQuality(q.key as "good" | "bad")}
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: `1px solid ${quality === q.key ? q.color + "80" : "var(--border-subtle)"}`,
                  background: quality === q.key ? q.color + "15" : "transparent",
                  color: quality === q.key ? q.color : "var(--text-muted)",
                  fontSize: "14px",
                  fontWeight: 600,
                  fontFamily: "var(--font-display)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textAlign: "left",
                }}
              >
                <div>{quality === q.key ? "◉" : "○"} {q.label}</div>
                <div style={{ fontSize: "11px", opacity: 0.7, marginTop: "3px", fontWeight: 400 }}>{q.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={runDemo}
          disabled={running}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "10px",
            border: "none",
            background: running
              ? "var(--bg-elevated)"
              : "linear-gradient(135deg, #7c3aed, #a855f7)",
            color: "#fff",
            fontSize: "16px",
            fontWeight: 700,
            fontFamily: "var(--font-display)",
            cursor: running ? "wait" : "pointer",
            letterSpacing: "0.5px",
            transition: "all 0.2s",
          }}
        >
          {running ? "Running demo..." : "⚡ Run Demo"}
        </button>
      </div>

      {/* Progress steps */}
      {(running || result) && (
        <div style={{
          width: "100%",
          maxWidth: "680px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "20px",
        }}>
          <div style={{ fontSize: "12px", letterSpacing: "1.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: "16px" }}>
            FLOW EXECUTION
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {STEPS.map((label, i) => {
              const done = step > i || !!result;
              const active = step === i && running;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    border: `2px solid ${done ? "#22c55e" : active ? "#a855f7" : "var(--border-subtle)"}`,
                    background: done ? "#22c55e20" : active ? "#a855f720" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    flexShrink: 0,
                    transition: "all 0.3s",
                  }}>
                    {done ? "✓" : active ? "●" : i + 1}
                  </div>
                  <span style={{
                    fontSize: "13px",
                    color: done ? "var(--text-primary)" : active ? "#a855f7" : "var(--text-muted)",
                    fontFamily: "var(--font-mono)",
                    transition: "color 0.3s",
                  }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          width: "100%",
          maxWidth: "680px",
          background: "#ef444415",
          border: "1px solid #ef444440",
          borderRadius: "12px",
          padding: "16px 20px",
          color: "#ef4444",
          fontSize: "14px",
          marginBottom: "20px",
        }}>
          ✗ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{
          width: "100%",
          maxWidth: "680px",
          background: "var(--bg-card)",
          border: `1px solid ${passed ? "#22c55e40" : "#ef444440"}`,
          borderRadius: "16px",
          padding: "28px",
          marginBottom: "20px",
        }}>
          {/* Verdict */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
            padding: "16px 20px",
            borderRadius: "10px",
            background: passed ? "#22c55e15" : "#ef444415",
          }}>
            <span style={{ fontSize: "32px" }}>{passed ? "✅" : "❌"}</span>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: passed ? "#22c55e" : "#ef4444" }}>
                {passed ? "Job Passed — Escrow Released" : "Job Failed — Stake Slashed"}
              </div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                AI Score: <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 700 }}>{result.verification.score}/100</span>
                {" · "}
                {result.agents.buyer} hired {result.agents.seller}
                {result.agents.verifier !== "none" && ` · verified by ${result.agents.verifier}`}
              </div>
            </div>
          </div>

          {/* Steps */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", letterSpacing: "1.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: "12px" }}>
              WHAT HAPPENED
            </div>
            {Object.values(result.demo_flow).map((s, i) => (
              <div key={i} style={{ display: "flex", gap: "12px", marginBottom: "8px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "#a855f7", minWidth: "20px", marginTop: "2px" }}>
                  0{i + 1}
                </span>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>

          {/* AI Reasoning */}
          <div style={{
            padding: "14px 16px",
            borderRadius: "8px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}>
            <div style={{ fontSize: "11px", letterSpacing: "1.5px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: "8px" }}>
              AI VERIFIER REASONING
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
              {result.verification.reasoning}
            </p>
            {result.verification.issues.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: "16px" }}>
                {result.verification.issues.map((issue, i) => (
                  <li key={i} style={{ fontSize: "12px", color: "#f97316", marginBottom: "4px" }}>{issue}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Run again */}
          <button
            onClick={() => { setResult(null); setStep(0); }}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              color: "var(--text-muted)",
              fontSize: "13px",
              fontFamily: "var(--font-display)",
              cursor: "pointer",
            }}
          >
            ↩ Run another demo
          </button>
        </div>
      )}
    </main>
  );
}
