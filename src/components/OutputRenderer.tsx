"use client";

interface Props {
  service_type: string;
  output: Record<string, any>;
}

export default function OutputRenderer({ service_type, output }: Props) {
  switch (service_type) {
    case "summarizer":
      return <SummarizerOutput data={output} />;
    case "code_review":
      return <CodeReviewOutput data={output} />;
    case "translator":
      return <TranslatorOutput data={output} />;
    case "data_analysis":
      return <DataAnalysisOutput data={output} />;
    default:
      return <GenericOutput data={output} />;
  }
}

// ---- SUMMARIZER ----
function SummarizerOutput({ data }: { data: any }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Main summary */}
      <div
        style={{
          padding: "24px",
          borderRadius: "10px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderLeft: "3px solid var(--accent-purple)",
        }}
      >
        <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-purple)", marginBottom: "10px", letterSpacing: "1px" }}>
          SUMMARY
        </div>
        <p style={{ fontSize: "15px", lineHeight: 1.8, color: "var(--text-primary)" }}>
          {data.summary || "No summary generated."}
        </p>
      </div>

      {/* Key points */}
      {data.key_points && data.key_points.length > 0 && (
        <div style={{ padding: "20px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-cyan)", marginBottom: "12px", letterSpacing: "1px" }}>
            KEY POINTS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {data.key_points.map((point: string, i: number) => (
              <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <span style={{ color: "var(--accent-purple)", fontFamily: "var(--font-mono)", fontSize: "12px", marginTop: "2px" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  {point}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div style={{ display: "flex", gap: "16px" }}>
        {data.word_count && (
          <MetaBadge label="Words" value={data.word_count} />
        )}
        {data.confidence && (
          <MetaBadge label="Confidence" value={`${Math.round(data.confidence * 100)}%`} />
        )}
      </div>
    </div>
  );
}

// ---- CODE REVIEW ----
function CodeReviewOutput({ data }: { data: any }) {
  const severityColors: Record<string, string> = {
    critical: "var(--accent-red)",
    warning: "var(--accent-orange)",
    info: "var(--accent-blue)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Overall review */}
      <div
        style={{
          padding: "24px",
          borderRadius: "10px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderLeft: "3px solid var(--accent-cyan)",
        }}
      >
        <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-cyan)", marginBottom: "10px", letterSpacing: "1px" }}>
          REVIEW
        </div>
        <p style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--text-primary)" }}>
          {data.review || "No review generated."}
        </p>
      </div>

      {/* Issues */}
      {data.issues && data.issues.length > 0 && (
        <div style={{ padding: "20px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-orange)", marginBottom: "12px", letterSpacing: "1px" }}>
            ISSUES FOUND ({data.issues.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {data.issues.map((issue: any, i: number) => (
              <div
                key={i}
                style={{
                  padding: "14px 16px",
                  borderRadius: "8px",
                  background: "var(--bg-secondary)",
                  borderLeft: `3px solid ${severityColors[issue.severity] || "var(--text-muted)"}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: severityColors[issue.severity] || "var(--text-muted)", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
                    {issue.severity}
                  </span>
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.5, marginBottom: "6px" }}>
                  {issue.description}
                </p>
                {issue.fix && (
                  <p style={{ fontSize: "12px", color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
                    Fix: {issue.fix}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {data.suggestions && data.suggestions.length > 0 && (
        <div style={{ padding: "20px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-green)", marginBottom: "12px", letterSpacing: "1px" }}>
            SUGGESTIONS
          </div>
          {data.suggestions.map((s: string, i: number) => (
            <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
              <span style={{ color: "var(--accent-green)" }}>→</span>
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Score */}
      {data.score !== undefined && (
        <MetaBadge label="Code Score" value={`${data.score}/100`} />
      )}
    </div>
  );
}

// ---- TRANSLATOR ----
function TranslatorOutput({ data }: { data: any }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Translation */}
      <div
        style={{
          padding: "24px",
          borderRadius: "10px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderLeft: "3px solid var(--accent-green)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "1px" }}>
            {data.source_language || "?"}
          </span>
          <span style={{ color: "var(--accent-green)", fontSize: "14px" }}>→</span>
          <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-green)", letterSpacing: "1px" }}>
            {data.target_language || "?"}
          </span>
        </div>
        <p style={{ fontSize: "18px", lineHeight: 1.7, color: "var(--text-primary)", fontWeight: 500 }}>
          {data.translation || "No translation generated."}
        </p>
      </div>

      {/* Notes */}
      {data.notes && (
        <div style={{ padding: "14px 16px", borderRadius: "8px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", fontSize: "13px", color: "var(--text-secondary)" }}>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: "11px" }}>NOTE: </span>
          {data.notes}
        </div>
      )}

      {data.confidence && (
        <MetaBadge label="Confidence" value={`${Math.round(data.confidence * 100)}%`} />
      )}
    </div>
  );
}

// ---- DATA ANALYSIS ----
function DataAnalysisOutput({ data }: { data: any }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          padding: "24px",
          borderRadius: "10px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderLeft: "3px solid var(--accent-amber)",
        }}
      >
        <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-amber)", marginBottom: "10px", letterSpacing: "1px" }}>
          ANALYSIS
        </div>
        <p style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--text-primary)" }}>
          {data.analysis || "No analysis generated."}
        </p>
      </div>

      {data.insights && data.insights.length > 0 && (
        <div style={{ padding: "20px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-cyan)", marginBottom: "12px", letterSpacing: "1px" }}>
            INSIGHTS
          </div>
          {data.insights.map((insight: string, i: number) => (
            <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <span style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{insight}</span>
            </div>
          ))}
        </div>
      )}

      {data.recommendations && data.recommendations.length > 0 && (
        <div style={{ padding: "20px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-green)", marginBottom: "12px", letterSpacing: "1px" }}>
            RECOMMENDATIONS
          </div>
          {data.recommendations.map((rec: string, i: number) => (
            <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
              <span style={{ color: "var(--accent-green)" }}>→</span>
              <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{rec}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- GENERIC ----
function GenericOutput({ data }: { data: any }) {
  return (
    <div
      style={{
        padding: "24px",
        borderRadius: "10px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderLeft: "3px solid var(--accent-purple)",
      }}
    >
      <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-purple)", marginBottom: "10px", letterSpacing: "1px" }}>
        OUTPUT
      </div>
      <p style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
        {data.result || JSON.stringify(data, null, 2)}
      </p>
    </div>
  );
}

// ---- Helper: Meta Badge ----
function MetaBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: "8px 14px",
        borderRadius: "6px",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
        {label}
      </span>
      <span style={{ fontSize: "13px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}
