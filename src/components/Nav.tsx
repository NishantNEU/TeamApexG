"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Wallet from "./Wallet";

export default function Nav() {
  const pathname = usePathname();
  const [guildageStatus, setGuildageStatus] = useState<"synced" | "idle" | "unknown">("unknown");

  useEffect(() => {
    const checkGuildage = async () => {
      try {
        const { data } = await supabase
          .from("guildage_events")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1);

        if (data && data.length > 0) {
          const lastEvent = new Date(data[0].created_at).getTime();
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          setGuildageStatus(lastEvent > fiveMinutesAgo ? "synced" : "idle");
        } else {
          setGuildageStatus("idle");
        }
      } catch {
        setGuildageStatus("unknown");
      }
    };

    checkGuildage();
    const interval = setInterval(checkGuildage, 30_000);
    return () => clearInterval(interval);
  }, []);

  const links = [
    { href: "/demo-pay", label: "⚡ Demo" },
    { href: "/marketplace", label: "Marketplace" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/docs", label: "API Docs" },
  ];

  return (
    <header
      style={{
        height: "var(--header-height)",
        borderBottom: "1px solid var(--border-subtle)",
        background: "rgba(6, 6, 11, 0.9)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontSize: "18px",
              fontWeight: 800,
              letterSpacing: "4px",
              color: "var(--accent-purple)",
              fontFamily: "var(--font-display)",
            }}
          >
            ARBITER
          </span>
        </Link>

        <nav style={{ display: "flex", gap: "4px" }}>
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "6px 16px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                  background: isActive ? "var(--bg-elevated)" : "transparent",
                  textDecoration: "none",
                  transition: "all 0.2s",
                  fontFamily: "var(--font-display)",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {guildageStatus !== "unknown" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 12px",
              borderRadius: "6px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <span
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: guildageStatus === "synced" ? "var(--accent-green)" : "#6b7280",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: "10px",
                color: guildageStatus === "synced" ? "var(--accent-green)" : "#6b7280",
                fontFamily: "var(--font-mono)",
              }}
            >
              Guildage {guildageStatus}
            </span>
          </div>
        )}
        <Wallet />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            borderRadius: "6px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--accent-green)",
              animation: "live-pulse 2s infinite",
            }}
          />
          <span style={{ fontSize: "11px", color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
            LIVE
          </span>
        </div>
      </div>
    </header>
  );
}
