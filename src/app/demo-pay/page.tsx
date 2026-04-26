"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PLANS = [
  {
    key: "register",
    label: "Register Agent",
    sats: 500,
    description: "Stake your agent on the Arbiter network",
    icon: "🤖",
    color: "#a855f7",
    bg: "#a855f715",
    border: "#a855f740",
  },
  {
    key: "hire",
    label: "Hire Agent",
    sats: 100,
    description: "Create a job and hold payment in escrow",
    icon: "⚡",
    color: "#f59e0b",
    bg: "#f59e0b15",
    border: "#f59e0b40",
  },
  {
    key: "query",
    label: "Query Network",
    sats: 10,
    description: "Search the agent marketplace",
    icon: "🔍",
    color: "#3b82f6",
    bg: "#3b82f615",
    border: "#3b82f640",
  },
];

export default function DemoPayPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; status: "success" | "error"; message: string } | null>(null);

  const handlePay = async (key: string) => {
    setLoading(key);
    setResult(null);

    try {
      let res: Response;

      if (key === "register") {
        res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Demo Agent",
            service_type: "general",
            description: "Live demo agent",
          }),
        });
      } else if (key === "hire") {
        // Use free endpoint for demo (no payment gate)
        res = await fetch("/api/request/free", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_type: "general",
            input_data: { text: "Demo job from the pay page" },
            amount_sats: 100,
          }),
        });
      } else {
        // query — paid discover
        res = await fetch("/api/discover");
      }

      // MDK 402 → redirect to checkout
      if (res.status === 402) {
        const data = await res.json();
        const checkoutUrl: string | undefined =
          data.checkoutUrl ?? data.checkout_url ?? data.url;

        if (checkoutUrl) {
          // Extract the checkout ID from the URL and use our /checkout/[id] page
          const checkoutId = checkoutUrl.split("/").pop()?.split("?")[0];
          if (checkoutId) {
            router.push(`/checkout/${checkoutId}`);
          } else {
            window.open(checkoutUrl, "_blank");
          }
          return;
        }
      }

      if (res.ok) {
        setResult({ key, status: "success", message: "Request succeeded (already paid or free)" });
      } else {
        const data = await res.json().catch(() => ({}));
        setResult({ key, status: "error", message: data.error ?? `HTTP ${res.status}` });
      }
    } catch (err: any) {
      setResult({ key, status: "error", message: err.message });
    } finally {
      setLoading(null);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-display)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      {/* Back */}
      <div style={{ position: "absolute", top: "24px", left: "24px" }}>
        <Link
          href="/"
          style={{
            fontSize: "13px",
            color: "var(--text-muted)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          ← Back
        </Link>
      </div>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚡</div>
        <h1
          style={{
            fontSize: "40px",
            fontWeight: 800,
            letterSpacing: "-1px",
            margin: "0 0 12px",
            background: "linear-gradient(135deg, #fff 0%, #a855f7 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Pay with Lightning
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "16px", margin: 0 }}>
          Real Bitcoin payments via the Lightning Network.
          <br />
          Each action stakes real sats on-chain.
        </p>
      </div>

      {/* Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
          width: "100%",
          maxWidth: "920px",
          marginBottom: "32px",
        }}
      >
        {PLANS.map((plan) => {
          const isLoading = loading === plan.key;
          const planResult = result?.key === plan.key ? result : null;

          return (
            <div
              key={plan.key}
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${planResult ? (planResult.status === "success" ? "#22c55e40" : "#ef444440") : "var(--border-subtle)"}`,
                borderRadius: "16px",
                padding: "28px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                transition: "border-color 0.3s",
              }}
            >
              {/* Icon + label */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  style={{
                    fontSize: "28px",
                    width: "52px",
                    height: "52px",
                    borderRadius: "12px",
                    background: plan.bg,
                    border: `1px solid ${plan.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {plan.icon}
                </span>
                <div>
                  <div
                    style={{
                      fontSize: "17px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {plan.label}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    {plan.description}
                  </div>
                </div>
              </div>

              {/* Price */}
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: "10px",
                  background: plan.bg,
                  border: `1px solid ${plan.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  Cost
                </span>
                <span
                  style={{
                    fontSize: "22px",
                    fontWeight: 800,
                    color: plan.color,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  ⚡ {plan.sats.toLocaleString()} sats
                </span>
              </div>

              {/* Result banner */}
              {planResult && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: planResult.status === "success" ? "#22c55e15" : "#ef444415",
                    border: `1px solid ${planResult.status === "success" ? "#22c55e40" : "#ef444440"}`,
                    fontSize: "13px",
                    color: planResult.status === "success" ? "#22c55e" : "#ef4444",
                  }}
                >
                  {planResult.status === "success" ? "✓ " : "✗ "}
                  {planResult.message}
                </div>
              )}

              {/* Button */}
              <button
                onClick={() => handlePay(plan.key)}
                disabled={isLoading || loading !== null}
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  border: "none",
                  background: isLoading
                    ? "var(--bg-elevated)"
                    : `linear-gradient(135deg, ${plan.color}cc, ${plan.color})`,
                  color: "#fff",
                  fontSize: "15px",
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  cursor: loading !== null ? "wait" : "pointer",
                  opacity: loading !== null && !isLoading ? 0.5 : 1,
                  transition: "all 0.2s",
                  letterSpacing: "0.5px",
                }}
              >
                {isLoading ? "Preparing invoice..." : `Pay ⚡ ${plan.sats} sats`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <p
        style={{
          fontSize: "13px",
          color: "var(--text-muted)",
          textAlign: "center",
          maxWidth: "500px",
          lineHeight: "1.6",
        }}
      >
        Powered by{" "}
        <span style={{ color: "#a855f7" }}>MoneyDevKit</span> + Lightning Network.
        Payments are processed instantly via L402 — no credit cards, no banks.
      </p>
    </main>
  );
}
