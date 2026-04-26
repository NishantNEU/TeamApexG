import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

// WARNING: This is for development/demo only. Remove or protect in production.

const DEMO_AGENTS = [
  {
    name: "SummarizerPro",
    service_type: "summarizer",
    description: "High-accuracy document summarization. Supports PDF, markdown, and plain text.",
    endpoint_url: "https://demo.arbiter.dev/agents/summarizer",
    reputation_score: 82,
    total_jobs_completed: 47,
    total_jobs_failed: 3,
    stake_sats: 500,
  },
  {
    name: "CodeAuditAI",
    service_type: "code_review",
    description: "Automated code review with security vulnerability detection.",
    endpoint_url: "https://demo.arbiter.dev/agents/code-audit",
    reputation_score: 91,
    total_jobs_completed: 124,
    total_jobs_failed: 2,
    stake_sats: 500,
  },
  {
    name: "PixelForge",
    service_type: "image_gen",
    description: "Fast image generation from text prompts. 512x512 in under 3 seconds.",
    endpoint_url: "https://demo.arbiter.dev/agents/pixelforge",
    reputation_score: 67,
    total_jobs_completed: 89,
    total_jobs_failed: 12,
    stake_sats: 500,
  },
  {
    name: "VerifyBot",
    service_type: "verifier",
    description: "Independent quality verification for agent outputs.",
    endpoint_url: "https://demo.arbiter.dev/agents/verifier",
    reputation_score: 95,
    total_jobs_completed: 203,
    total_jobs_failed: 1,
    stake_sats: 500,
  },
  {
    name: "DataCrunchAI",
    service_type: "data_analysis",
    description: "Analyzes CSV and JSON datasets. Returns insights and visualizations.",
    endpoint_url: "https://demo.arbiter.dev/agents/datacrunch",
    reputation_score: 74,
    total_jobs_completed: 31,
    total_jobs_failed: 5,
    stake_sats: 500,
  },
  {
    name: "LinguaAgent",
    service_type: "translator",
    description: "Multi-language translation with context awareness. 40+ languages.",
    endpoint_url: "https://demo.arbiter.dev/agents/lingua",
    reputation_score: 58,
    total_jobs_completed: 22,
    total_jobs_failed: 8,
    stake_sats: 500,
  },
];

export async function POST() {
  try {
    const results = [];

    for (const agentData of DEMO_AGENTS) {
      const agentId = uuidv4();

      const { data, error } = await supabase
        .from("agents")
        .insert({
          id: agentId,
          ...agentData,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        results.push({ name: agentData.name, status: "error", error: error.message });
      } else {
        await supabase.from("transactions").insert({
          job_id: null,
          from_agent_id: agentId,
          to_agent_id: null,
          type: "stake",
          amount_sats: 500,
          status: "completed",
          description: `Seed stake for ${agentData.name}`,
        });

        results.push({ name: agentData.name, id: agentId, status: "created" });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${results.filter((r) => r.status === "created").length} demo agents`,
      agents: results,
    });
  } catch (err) {
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
