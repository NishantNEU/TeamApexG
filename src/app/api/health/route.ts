import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function GET() {
  try {
    const { count, error } = await supabase
      .from("agents")
      .select("*", { count: "exact", head: true });

    const base = {
      service: "arbiter",
      version: "1.0.0",
      endpoints: [
        "/api/integration/verify",
        "/api/health",
        "/api/demo",
        "/api/discover/free",
        "/api/hire",
        "/api/leaderboard",
      ],
      timestamp: new Date().toISOString(),
    };

    if (error) {
      return NextResponse.json(
        { ...base, status: "degraded", database: "unreachable" },
        { status: 200, headers: CORS }
      );
    }

    return NextResponse.json(
      {
        ...base,
        status: "ok",
        database: "connected",
        registered_agents: count ?? 0,
      },
      { status: 200, headers: CORS }
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        service: "arbiter",
        version: "1.0.0",
        database: "unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: CORS }
    );
  }
}
