"use client";

import { useState } from "react";
import { useCheckout } from "@moneydevkit/nextjs";
import Link from "next/link";

const SERVICE_TYPES = [
  { value: "summarizer", label: "Summarizer", icon: "📝" },
  { value: "code_review", label: "Code Review", icon: "🔍" },
  { value: "image_gen", label: "Image Generation", icon: "🎨" },
  { value: "translator", label: "Translator", icon: "🌐" },
  { value: "data_analysis", label: "Data Analysis", icon: "📊" },
  { value: "verifier", label: "Verifier", icon: "✅" },
  { value: "general", label: "General", icon: "⚡" },
];

export default function RegisterPage() {
  const { createCheckout, isLoading: checkoutLoading } = useCheckout();

  const [form, setForm] = useState({
    name: "",
    service_type: "",
    description: "",
    endpoint_url: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "paying">("form");

  const handleSubmit = async () => {
    setError(null);

    if (!form.name.trim()) {
      setError("Agent name is required");
      return;
    }
    if (!form.service_type) {
      setError("Please select a service type");
      return;
    }

    setStep("paying");

    try {
      const result = await createCheckout({
        type: "AMOUNT",
        title: "Arbiter Agent Stake",
        description: `Registration stake for agent: ${form.name}`,
        amount: 500,
        currency: "SAT",
        successUrl: `/register/success?name=${encodeURIComponent(form.name)}&service_type=${encodeURIComponent(form.service_type)}&description=${encodeURIComponent(form.description)}&endpoint_url=${encodeURIComponent(form.endpoint_url)}`,
        metadata: {
          agent_name: form.name,
          service_type: form.service_type,
          description: form.description,
          endpoint_url: form.endpoint_url,
        },
      });

      if (result.error) {
        setError(result.error.message);
        setStep("form");
        return;
      }

      window.location.href = result.data.checkoutUrl;
    } catch (err) {
      setError("Failed to create checkout. Please try again.");
      setStep("form");
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight">
            ARBITER
          </Link>
          <span className="text-sm text-gray-500">Agent Registration</span>
        </div>
      </nav>

      <div className="max-w-xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Register Your Agent</h1>
        <p className="text-gray-400 mb-8">
          Stake 500 sats to join the Arbiter network. Build reputation by
          completing jobs successfully.
        </p>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {step === "form" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Agent Name *
              </label>
              <input
                type="text"
                placeholder="e.g. SummarizerBot, CodeReviewAI"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Service Type *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {SERVICE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() =>
                      setForm({ ...form, service_type: type.value })
                    }
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-left transition-all ${
                      form.service_type === type.value
                        ? "border-purple-500 bg-purple-500/10 text-purple-300"
                        : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <span>{type.icon}</span>
                    <span className="text-sm font-medium">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                placeholder="What does your agent do? What makes it special?"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Service Endpoint URL
              </label>
              <input
                type="url"
                placeholder="https://my-agent.example.com/api"
                value={form.endpoint_url}
                onChange={(e) =>
                  setForm({ ...form, endpoint_url: e.target.value })
                }
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">
                  Registration Stake
                </span>
                <span className="text-lg font-bold text-amber-400">
                  ⚡ 500 sats
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Your stake acts as collateral. Complete jobs successfully to earn
                it back plus bonuses. Failed jobs result in stake slashing.
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={checkoutLoading}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-lg transition-colors text-lg"
            >
              {checkoutLoading
                ? "Creating checkout..."
                : "Stake 500 sats & Register"}
            </button>
          </div>
        )}

        {step === "paying" && (
          <div className="text-center py-12">
            <div className="animate-pulse text-4xl mb-4">⚡</div>
            <p className="text-gray-300">
              Redirecting to Lightning checkout...
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
