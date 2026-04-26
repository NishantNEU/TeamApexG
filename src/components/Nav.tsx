"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Wallet from "./Wallet";

export default function Nav() {
  const pathname = usePathname();

  const links = [
    { href: "/marketplace", label: "Marketplace" },
    { href: "/dashboard", label: "Dashboard" },
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
