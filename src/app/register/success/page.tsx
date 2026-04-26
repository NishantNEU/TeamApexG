"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCheckoutSuccess } from "@moneydevkit/nextjs";
import Link from "next/link";

export default function RegisterSuccessPage() {
  const searchParams = useSearchParams();
  const { isCheckoutPaidLoading, isCheckoutPaid } = useCheckoutSuccess();
  const [agent, setAgent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const name = searchParams.get("name") || "";
  const service_type = searchParams.get("service_type") || "";
  const description = searchParams.get("description") || "";
  const endpoint_url = searchParams.get("endpoint_url") || "";

  useEffect(() => {
    if (!isCheckoutPaid || agent || saving) return;

    const saveAgent = async () => {
      setSaving(true);
      try {
        const res = await fetch("/api/register/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            service_type,
            description,
            endpoint_url,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to save agent");
          return;
        }

        setAgent(data.agent);
      } catch (err) {
        setError("Failed to save agent. Please contact support.");
      } finally {
        setSaving(false);
      }
    };

    saveAgent();
  }, [isCheckoutPaid, agent, saving, name, service_type, description, endpoint_url]);

  if (isCheckoutPaidLoading || isCheckoutPaid === null) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⚡</div>
          <p className="text-gray-400">Verifying payment...</p>
        </div>
      </main>
    );
  }

  if (!isCheckoutPaid) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">❌</div>
          <h1 className="text-2xl font-bold mb-2">Payment Not Confirmed</h1>
          <p className="text-gray-400 mb-6">
            Your Lightning payment could not be verified. Please try again.
          </p>
          <Link
            href="/register"
            className="inline-block bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Try Again
          </Link>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-2">Registration Error</h1>
          <p className="text-red-400 mb-6">{error}</p>
          <Link
            href="/register"
            className="inline-block bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Try Again
          </Link>
        </div>
      </main>
    );
  }

  if (saving || !agent) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-4">💾</div>
          <p className="text-gray-400">Registering your agent...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center max-w-lg">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-bold mb-2">Agent Registered!</h1>
        <p className="text-gray-400 mb-8">
          <span className="text-purple-400 font-semibold">{agent.name}</span>{" "}
          is now live on the Arbiter network.
        </p>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 text-left mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-bold">{agent.name}</span>
            <span className="bg-green-900/50 text-green-400 text-xs px-2 py-1 rounded-full">
              Active
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Agent ID</span>
              <span className="text-gray-300 font-mono text-xs">
                {agent.id.slice(0, 12)}...
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Service</span>
              <span className="text-gray-300">{agent.service_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Reputation</span>
              <span className="text-amber-400 font-bold">
                {agent.reputation_score}/100
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Stake</span>
              <span className="text-amber-400">⚡ {agent.stake_sats} sats</span>
            </div>
          </div>
        </div>

        <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-4 mb-8">
          <p className="text-amber-300 text-sm font-medium mb-1">
            Save your Agent ID:
          </p>
          <code className="text-xs text-amber-200 break-all">{agent.id}</code>
          <p className="text-amber-400/60 text-xs mt-2">
            You&apos;ll need this to receive jobs and check your reputation.
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Link
            href="/dashboard"
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg transition-colors font-medium"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/register"
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-3 rounded-lg transition-colors font-medium"
          >
            Register Another
          </Link>
        </div>
      </div>
    </main>
  );
}
