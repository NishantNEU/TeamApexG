"use client";

import { useEffect, useState, use, Suspense } from "react";
import { useCheckoutSuccess } from "@moneydevkit/nextjs";
import Link from "next/link";
import OutputRenderer from "@/components/OutputRenderer";

interface HireResult {
  success: boolean;
  job_id: string;
  agent: { name: string; service_type: string; reputation_score: number; trust_tier: string };
  work: { output: Record<string, any>; processing_time_ms: number };
  verification: { passed: boolean; score: number; reasoning: string };
  payment: { amount_sats: number; escrow_status: string; reputation_change: number };
}

function HireSuccessContent({ id }: { id: string }) {
  const { isCheckoutPaidLoading, isCheckoutPaid } = useCheckoutSuccess();
  const [result, setResult] = useState<HireResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);

  const STEPS = [
    { label: "Payment confirmed", desc: "500 sats received via Lightning" },
    { label: "Agent working", desc: "AI processing your task..." },
    { label: "Verifying output", desc: "AI quality check in progress" },
    { label: "Settling escrow", desc: "Releasing payment to agent" },
  ];

  useEffect(() => {
    if (!isCheckoutPaid || result || running) return;

    const runJob = async () => {
      setRunning(true);
      setStep(1);

      // Retrieve input saved before checkout redirect
      const stored = sessionStorage.getItem(`hire_input_${id}`);
      const inputData = stored ? JSON.parse(stored) : {};
      sessionStorage.removeItem(`hire_input_${id}`);

      // Animate steps while API runs
      const stepInterval = setInterval(() => {
        setStep((s) => (s < STEPS.length ? s + 1 : s));
      }, 1000);

      try {
        const res = await fetch("/api/hire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seller_agent_id: id,
            input_data: inputData,
            amount_sats: 500,
          }),
        });

        clearInterval(stepInterval);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || "Job failed. Please contact support.");
        } else {
          setStep(STEPS.length + 1);
          setResult(data);
        }
      } catch (err: any) {
        clearInterval(stepInterval);
        setError(err.message || "Something went wrong");
      } finally {
        setRunning(false);
      }
    };

    runJob();
  }, [isCheckoutPaid, result, running, id]);

  // Payment verifying
  if (isCheckoutPaidLoading || isCheckoutPaid === null) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "40px", marginBottom: "16px", animation: "pulse 1.5s infinite" }}>⚡</div>
          <p style={{ color: "var(--text-muted)" }}>Verifying Lightning payment...</p>
        </div>
      </main>
    );
  }

  // Payment not confirmed
  if (!isCheckoutPaid) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>❌</div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>Payment Not Confirmed</h1>
          <p style={{ color: "var(--text-muted)", marginBottom: "24px" }}>Your Lightning payment could not be verified.</p>
          <Link href={`/marketplace/hire/${id}`} style={{ padding: "12px 28px", borderRadius: "8px", background: "var(--accent-purple)", color: "#fff", textDecoration: "none", fontWeight: 600 }}>
            Try Again
          </Link>
        </div>
      </main>
    );
  }

  // Running job / progress steps
  if (running || (!result && !error)) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: "560px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "32px", textAlign: "center" }}>
            Payment received — running your job
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {STEPS.map((item, i) => {
              const done = step > i + 1;
              const active = step === i + 1;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: "16px",
                  padding: "16px 20px", borderRadius: "10px",
                  background: done || active ? "var(--bg-card)" : "transparent",
                  border: `1px solid ${done ? "var(--border-subtle)" : active ? "var(--accent-purple)" : "transparent"}`,
                  opacity: step >= i + 1 ? 1 : 0.3,
                  transition: "all 0.5s",
                }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                    background: done ? "var(--accent-green)" : active ? "var(--accent-purple)" : "var(--bg-elevated)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px", color: "#fff", fontWeight: 700,
                    animation: active ? "pulse-glow 2s infinite" : "none",
                  }}>
                    {done ? "✓" : i + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{item.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  // Error
  if (error) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>⚠️</div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>Job Error</h1>
          <p style={{ color: "var(--accent-red)", marginBottom: "24px" }}>{error}</p>
          <Link href="/marketplace" style={{ padding: "12px 28px", borderRadius: "8px", background: "var(--accent-purple)", color: "#fff", textDecoration: "none", fontWeight: 600 }}>
            Back to Marketplace
          </Link>
        </div>
      </main>
    );
  }

  if (!result) return null;

  // Result
  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", maxWidth: "900px", margin: "0 auto", padding: "48px 32px" }}>

      {/* Verdict */}
      <div style={{
        padding: "24px", borderRadius: "12px", marginBottom: "28px",
        background: result.verification.passed ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
        border: `1px solid ${result.verification.passed ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: result.verification.passed ? "var(--accent-green)" : "var(--accent-red)" }}>
              {result.verification.passed ? "✅ Verified & Paid" : "❌ Failed — Refunded"}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "6px" }}>
              Quality score: <strong>{result.verification.score}/100</strong> — {result.verification.reasoning}
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

      {/* Output */}
      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px", color: "var(--text-muted)", letterSpacing: "1.5px", fontFamily: "var(--font-mono)" }}>
          AGENT OUTPUT
        </h3>
        <OutputRenderer service_type={result.agent.service_type} output={result.work.output} />
        <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px", fontFamily: "var(--font-mono)" }}>
          Processed in {result.work.processing_time_ms}ms · {result.agent.name} · rep {result.agent.reputation_score}
        </div>
      </div>

      {/* Payment breakdown */}
      <div style={{ marginBottom: "32px" }}>
        <h3 style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px", color: "var(--text-muted)", letterSpacing: "1.5px", fontFamily: "var(--font-mono)" }}>
          PAYMENT BREAKDOWN
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { label: "Escrow", value: `⚡ ${result.payment.amount_sats} sats`, note: result.payment.escrow_status, color: result.verification.passed ? "var(--accent-green)" : "var(--accent-red)" },
            { label: "Verification fee", value: "⚡ 50 sats", note: "paid to verifier", color: "var(--accent-purple)" },
            { label: "Reputation change", value: `${result.payment.reputation_change > 0 ? "+" : ""}${result.payment.reputation_change}`, note: `now ${result.agent.reputation_score}`, color: result.payment.reputation_change > 0 ? "var(--accent-green)" : "var(--accent-red)" },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: "6px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
              <div>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>{row.label}</span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>{row.note}</span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: row.color, fontSize: "14px" }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "12px" }}>
        <Link href={`/marketplace/hire/${id}`} style={{ flex: 1, padding: "14px", borderRadius: "8px", background: "var(--accent-purple)", color: "#fff", textDecoration: "none", fontSize: "14px", fontWeight: 700, textAlign: "center", fontFamily: "var(--font-display)" }}>
          Hire Again
        </Link>
        <Link href="/marketplace" style={{ flex: 1, padding: "14px", borderRadius: "8px", background: "var(--bg-card)", color: "var(--text-secondary)", textDecoration: "none", fontSize: "14px", fontWeight: 600, textAlign: "center", border: "1px solid var(--border-subtle)", fontFamily: "var(--font-display)" }}>
          Back to Marketplace
        </Link>
      </div>
    </main>
  );
}

export default function HireSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={
      <main style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "40px", animation: "pulse 1.5s infinite" }}>⚡</div>
      </main>
    }>
      <HireSuccessContent id={id} />
    </Suspense>
  );
}
