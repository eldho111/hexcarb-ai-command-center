"use client";

export function EngineOffline(props: { detail?: string }) {
  const { detail } = props;

  return (
    <div
      className="flex min-h-[80vh] items-center justify-center px-5"
      style={{ background: "var(--hc-page-bg)" }}
    >
      <div
        className="hc-card mx-auto w-full max-w-md p-10 text-center"
        style={{ background: "var(--hc-card-bg)" }}
      >
        {/* ── Hexagon Icon ──────────────────────────────────────── */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center">
          <svg
            width="72"
            height="72"
            viewBox="0 0 72 72"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer hex */}
            <path
              d="M36 4L64 20V52L36 68L8 52V20L36 4Z"
              stroke="var(--hc-accent)"
              strokeWidth="2"
              fill="none"
              opacity="0.4"
            />
            {/* Middle hex */}
            <path
              d="M36 16L52 25V43L36 52L20 43V25L36 16Z"
              stroke="var(--hc-accent)"
              strokeWidth="1.5"
              fill="none"
              opacity="0.6"
            />
            {/* Inner hex (filled) */}
            <path
              d="M36 26L44 31V41L36 46L28 41V31L36 26Z"
              fill="var(--hc-accent)"
              opacity="0.25"
              stroke="var(--hc-accent)"
              strokeWidth="1"
            />
            {/* Sleep icon - moon */}
            <path
              d="M39 32C39 35.866 35.866 39 32 39C32.768 39 33.5 38.87 34.18 38.63C36.42 37.82 38 35.62 38 33C38 30.38 36.42 28.18 34.18 27.37C33.5 27.13 32.768 27 32 27C35.866 27 39 30.134 39 34V32Z"
              fill="var(--hc-accent)"
              opacity="0.9"
            />
            {/* Z indicators */}
            <text
              x="42"
              y="30"
              fill="var(--hc-accent)"
              fontSize="8"
              fontWeight="700"
              fontFamily="monospace"
              opacity="0.7"
            >
              z
            </text>
            <text
              x="46"
              y="25"
              fill="var(--hc-accent)"
              fontSize="6"
              fontWeight="700"
              fontFamily="monospace"
              opacity="0.5"
            >
              z
            </text>
          </svg>
        </div>

        {/* ── Heading ───────────────────────────────────────────── */}
        <h1
          className="text-xl font-semibold tracking-tight"
          style={{ color: "var(--hc-heading)" }}
        >
          Engine is sleeping
        </h1>

        {/* ── Description ───────────────────────────────────────── */}
        <p
          className="mx-auto mt-3 max-w-xs text-sm leading-relaxed"
          style={{ color: "var(--hc-text-muted)" }}
        >
          The AI engine runs on a GPU server that may be paused to save
          resources.
        </p>

        {/* ── Action hint ───────────────────────────────────────── */}
        <div
          className="mx-auto mt-5 inline-flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-medium"
          style={{
            background: "var(--hc-bg-soft)",
            border: "1px solid var(--hc-border)",
            color: "var(--hc-accent)",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="var(--hc-accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 3V8L11 10" />
            <circle cx="8" cy="8" r="6.5" />
          </svg>
          Start your RunPod instance to bring the engine online.
        </div>

        {/* ── Detail message ────────────────────────────────────── */}
        {detail && (
          <p
            className="mt-4 text-xs"
            style={{ color: "var(--hc-text-muted)", opacity: 0.7 }}
          >
            {detail}
          </p>
        )}

        {/* ── Gold accent line ──────────────────────────────────── */}
        <div
          className="mx-auto mt-8 h-px w-16"
          style={{ background: "var(--hc-accent)", opacity: 0.35 }}
        />
      </div>
    </div>
  );
}
