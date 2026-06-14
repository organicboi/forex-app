"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomerInfo {
  name: string;
  business_name: string | null;
  logo_url: string | null;
  primary_color: string;
  base_currency: string;
}

interface ColumnDef {
  key: string;
  label: string;
  color: string;
  visible: boolean;
  order: number;
  is_builtin: boolean;
}

interface CurrencyRate {
  code: string;
  name: string;
  flag_path: string;
  decimal_places: number;
  buy: number;
  sell: number;
  transfer: number;
  extra_values?: Record<string, number>;
}

interface AdItem {
  id: string;
  file_url: string;
  file_type: "image" | "video";
  duration_seconds: number;
}

interface TVData {
  status: "ok" | "not_found" | "expired";
  layout?: string;
  branch_name?: string;
  screen_orientation?: string;
  customer?: CustomerInfo;
  currencies?: CurrencyRate[];
  ads?: AdItem[];
  ticker?: string[];
  template_columns?: ColumnDef[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const RATE_PAGE_INTERVAL_MS = 8000;
const ORANGE = "#ef6c21";
const INK = "#17131a";
const WHITE = "#ffffff";
const PAPER = "#f2eee8";
const BUY_COLOR = "#16a34a";
const SELL_COLOR = "#dc2626";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRate(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

function getOrCreateSessionKey(): string {
  const KEY = "tv_session_key";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const key = crypto.randomUUID();
    localStorage.setItem(KEY, key);
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

function useDateTime() {
  const [dt, setDt] = useState({ time: "", date: "" });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setDt({
        time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        date: now.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return dt;
}

// ─── Full-screen state screens ────────────────────────────────────────────────

function FullScreen({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: PAPER,
        fontFamily: "'Barlow', sans-serif",
        gap: "1.5vh",
      }}
    >
      <div style={{ fontSize: "clamp(20px, 2vw, 40px)", fontWeight: 700, color: INK }}>
        {title}
      </div>
      {body && (
        <div style={{ fontSize: "clamp(12px, 1vw, 20px)", color: "#756d78" }}>{body}</div>
      )}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@500;600;700&family=Roboto+Mono:wght@500;700&display=swap');`}</style>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LiveDisplay({ token }: { token: string | null }) {
  const [tvData, setTvData] = useState<TVData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratePage, setRatePage] = useState(0);
  const [ratesChanging, setRatesChanging] = useState(false);
  const [adIndex, setAdIndex] = useState(0);
  const { time, date } = useDateTime();
  const sessionKeyRef = useRef<string>("");

  // ── Data polling ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/tv/data?token=${encodeURIComponent(token)}`);
        const json: TVData = await res.json();
        if (!cancelled) setTvData(json);
      } catch {
        // keep stale data on network error
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    const t = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [token]);

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    sessionKeyRef.current = getOrCreateSessionKey();

    const beat = () => {
      fetch("/api/tv/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, session_key: sessionKeyRef.current }),
      }).catch(() => {});
    };

    beat();
    const t = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(t);
  }, [token]);

  // ── Derived values needed by hooks (computed before any early return) ──────
  const isPortrait = (tvData?.screen_orientation ?? "landscape") === "portrait";
  const RATES_PER_PAGE = isPortrait ? 8 : 7;
  const currencies = tvData?.currencies ?? [];
  const ads = tvData?.ads ?? [];
  const totalRatePages = Math.max(Math.ceil(currencies.length / RATES_PER_PAGE), 1);

  // ── Rate page cycling ─────────────────────────────────────────────────────
  useEffect(() => {
    if (currencies.length === 0) return;
    let transitionTimer: ReturnType<typeof setTimeout> | undefined;
    const pageTimer = setInterval(() => {
      setRatesChanging(true);
      transitionTimer = setTimeout(() => {
        setRatePage((p) => (p + 1) % totalRatePages);
        setRatesChanging(false);
      }, 350);
    }, RATE_PAGE_INTERVAL_MS);
    return () => {
      clearInterval(pageTimer);
      if (transitionTimer) clearTimeout(transitionTimer);
    };
  }, [totalRatePages, currencies.length]);

  // ── Ad cycling (timer for images; videos advance via onEnded) ────────────
  useEffect(() => {
    if (ads.length === 0) return;
    const currentAd = ads[adIndex];
    if (!currentAd || currentAd.file_type === "video") return;
    const duration = (currentAd.duration_seconds ?? 10) * 1000;
    const t = setTimeout(() => {
      setAdIndex((i) => (i + 1) % ads.length);
    }, duration);
    return () => clearTimeout(t);
  }, [adIndex, ads]);

  // ── Guard states ──────────────────────────────────────────────────────────
  if (!token) {
    return (
      <FullScreen
        title="Screen not configured"
        body="Add ?token=YOUR_SCREEN_TOKEN to the URL, or scan the QR code from your admin panel."
      />
    );
  }
  if (loading) {
    return <FullScreen title="Loading…" body="" />;
  }
  if (!tvData || tvData.status === "not_found") {
    return (
      <FullScreen
        title="Invalid token"
        body="This screen is not linked to any branch. Re-scan the QR code."
      />
    );
  }
  if (tvData.status === "expired") {
    return (
      <FullScreen
        title="Subscription expired"
        body="Please contact your service provider to renew."
      />
    );
  }

  // ── Display values ────────────────────────────────────────────────────────
  const customer = tvData.customer!;
  const ticker = tvData.ticker ?? [];
  const PURPLE = customer.primary_color || "#4c195a";
  const displayName = customer.business_name || customer.name;
  const branchName = tvData.branch_name ?? "";

  // Resolve visible columns from template or fall back to hardcoded defaults
  const visibleColumns: ColumnDef[] = tvData.template_columns
    ? tvData.template_columns.filter((c) => c.visible).sort((a, b) => a.order - b.order)
    : [
        { key: "buy",      label: "BUY",      color: BUY_COLOR,  visible: true, order: 0, is_builtin: true },
        { key: "sell",     label: "SELL",     color: SELL_COLOR, visible: true, order: 1, is_builtin: true },
        { key: "transfer", label: "TRANSFER", color: PURPLE,     visible: true, order: 2, is_builtin: true },
      ];

  const visibleRates = currencies.slice(ratePage * RATES_PER_PAGE, (ratePage + 1) * RATES_PER_PAGE);
  const rateSlots: Array<CurrencyRate | null> = [
    ...visibleRates,
    ...Array<null>(RATES_PER_PAGE - visibleRates.length).fill(null),
  ];
  const tickerItems = ticker.length > 0 ? ticker : ["Exchange rates shown are for reference only"];

  // ── Portrait-aware styles ──────────────────────────────────────────────────
  // In portrait, vw units become tiny (narrow screen) — swap to vh/vmin throughout.
  // Rate numbers also need to be capped by column width so they never overflow.

  const mainStyle: React.CSSProperties = isPortrait
    ? { minHeight: 0, display: "grid", gridTemplateColumns: "1fr", gridTemplateRows: "1fr 35%" }
    : { minHeight: 0, display: "grid", gridTemplateColumns: "64% 36%" };

  // Narrower currency column in portrait gives each rate column more room
  const colsGrid = isPortrait
    ? `1.1fr repeat(${visibleColumns.length}, 1fr)`
    : `1.3fr repeat(${visibleColumns.length}, 1fr)`;

  // Font capped so numbers fit: portrait width ÷ (col fraction × 6 chars × char-width-ratio)
  const ratesCellFontSize = isPortrait
    ? `clamp(14px, min(3.5vh, ${(30 / (1.1 + visibleColumns.length)).toFixed(1)}vw), 76px)`
    : "clamp(28px, 3.2vw, 88px)";

  const headerCellFontSize = isPortrait ? "clamp(12px, 1.7vh, 34px)" : "clamp(18px, 1.9vw, 42px)";
  const currencyCodeFontSize = isPortrait ? "clamp(15px, 2.3vh, 44px)" : "clamp(20px, 2.2vw, 54px)";
  const currencyNameFontSize = isPortrait ? "clamp(9px, 1.1vh, 17px)" : "clamp(12px, 1.1vw, 22px)";
  const flagWidth = isPortrait ? "clamp(24px, 2.1vh, 44px)" : "clamp(36px, 2.8vw, 58px)";

  const promotionPanelStyle: React.CSSProperties = isPortrait
    ? { ...promotionPanel, borderLeft: "none", borderTop: "3px solid #c0b8b0" }
    : promotionPanel;

  // Per-element portrait overrides (p-prefixed = portrait-aware computed style)
  const pScreen: React.CSSProperties = {
    ...screenStyle,
    gridTemplateRows: isPortrait ? "8vh 1fr 5.5vh" : "10vh 1fr 8vh",
  };
  const pHeader: React.CSSProperties = {
    ...header,
    padding: isPortrait ? "0 2vw" : "0 2.2vw",
    gap: isPortrait ? "1.5vw" : "2vw",
  };
  const pBrand: React.CSSProperties = {
    ...brand,
    gap: isPortrait ? "1.5vw" : "0.9vw",
  };
  const pLogoStyle: React.CSSProperties = {
    height: isPortrait ? "4vh" : "6vh",
    maxWidth: isPortrait ? "18vw" : "10vw",
    objectFit: "contain",
  };
  const pBrandName: React.CSSProperties = {
    ...brandName,
    fontSize: isPortrait ? "clamp(13px, 2.8vh, 24px)" : "clamp(18px, 1.6vw, 32px)",
  };
  const pHeaderTitle: React.CSSProperties = {
    ...headerTitle,
    fontSize: isPortrait ? "clamp(11px, 1.7vh, 20px)" : "clamp(20px, 1.8vw, 36px)",
    gap: isPortrait ? "0.8vh" : "0.65vw",
  };
  const pLiveDot: React.CSSProperties = {
    ...liveDot,
    width: isPortrait ? "1vh" : "0.8vw",
    height: isPortrait ? "1vh" : "0.8vw",
    minWidth: isPortrait ? "9px" : "12px",
    minHeight: isPortrait ? "9px" : "12px",
  };
  const pBranchInBrand: React.CSSProperties = {
    color: "#8c848e",
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: isPortrait ? "clamp(8px, 1.1vh, 14px)" : "clamp(11px, 0.95vw, 18px)",
    fontWeight: 700,
    letterSpacing: "0.14em",
    marginTop: "0.25vh",
  };
  const pClock: React.CSSProperties = {
    ...clock,
    minWidth: isPortrait ? "auto" : "8.6vw",
    paddingLeft: isPortrait ? "2.5vw" : "1.4vw",
  };
  const pClockTime: React.CSSProperties = {
    ...clockTime,
    fontSize: isPortrait ? "clamp(16px, 2.8vh, 38px)" : "clamp(26px, 2.4vw, 50px)",
  };
  const pClockDate: React.CSSProperties = {
    ...clockDate,
    fontSize: isPortrait ? "clamp(8px, 1.1vh, 14px)" : "clamp(12px, 1vw, 20px)",
  };
  const pRatesSection: React.CSSProperties = {
    ...ratesSection,
    padding: isPortrait ? "0.8vh 2vw 1vh" : "1.5vh 2.2vw 1.6vh",
  };
  const pTable: React.CSSProperties = {
    ...table,
    gridTemplateRows: isPortrait ? "5.5vh 0.6vh 1fr" : "7vh 0.8vh 1fr",
  };
  const pCurrencyCol: React.CSSProperties = {
    ...currencyColumn,
    gap: isPortrait ? "1.5vw" : "0.7vw",
  };
  const pTickerItem: React.CSSProperties = {
    ...tickerItem,
    fontSize: isPortrait ? "clamp(12px, 1.8vh, 24px)" : "clamp(16px, 1.8vw, 34px)",
    gap: isPortrait ? "5vw" : "2.4vw",
    paddingLeft: isPortrait ? "5vw" : "2.4vw",
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={pScreen}>
      {/* ── Header ── */}
      <header style={{ ...pHeader, borderBottomColor: ORANGE }}>
        {/* Brand + Branch */}
        <div style={pBrand}>
          {customer.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={customer.logo_url}
              alt=""
              style={pLogoStyle}
            />
          )}
          <div>
            <div style={{ ...pBrandName, color: PURPLE }}>{displayName}</div>
            {branchName && (
              <div style={pBranchInBrand}>{branchName.toUpperCase()}</div>
            )}
          </div>
        </div>

        {/* Centre title */}
        <div style={pHeaderTitle}>
          <span style={{ ...pLiveDot, backgroundColor: ORANGE }} />
          LIVE EXCHANGE RATES
        </div>

        {/* Right: clock */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <div style={{ ...pClock, borderLeftColor: PURPLE }}>
            <span style={{ ...pClockTime, color: PURPLE }}>{time}</span>
            <span style={pClockDate}>{date}</span>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={mainStyle}>
        {/* Rates */}
        <section style={pRatesSection}>
          <div style={pTable}>
            {/* Column headers */}
            <div style={{ ...tableHeader, borderBottomColor: PURPLE, gridTemplateColumns: colsGrid }}>
              <div style={{ ...headerCell, ...pCurrencyCol, fontSize: headerCellFontSize }}>CURRENCY</div>
              {visibleColumns.map((col) => (
                <div key={col.key} style={{ ...headerCell, color: col.color, fontSize: headerCellFontSize }}>
                  {col.label.toUpperCase()}
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div style={rateProgressTrack}>
              <div key={ratePage} style={{ ...rateProgress, backgroundColor: ORANGE }} />
            </div>

            {/* Rows */}
            <div
              style={{
                ...tableBody,
                gridTemplateRows: `repeat(${RATES_PER_PAGE}, minmax(0, 1fr))`,
                opacity: ratesChanging ? 0 : 1,
                transform: ratesChanging ? "translateY(1vh)" : "translateY(0)",
              }}
            >
              {rateSlots.map((rate, index) =>
                rate ? (
                  <div
                    key={rate.code}
                    style={{
                      ...rateRow,
                      gridTemplateColumns: colsGrid,
                      backgroundColor: index % 2 === 1 ? "rgba(23,19,26,0.045)" : "transparent",
                    }}
                  >
                    {/* Currency cell */}
                    <div style={{ ...rateCell, ...pCurrencyCol }}>
                      <Image
                        src={rate.flag_path}
                        alt=""
                        width={54}
                        height={36}
                        style={{ ...flagStyle, width: flagWidth }}
                        unoptimized
                      />
                      <div>
                        <div style={{ ...currencyCode, fontSize: currencyCodeFontSize }}>{rate.code}</div>
                        <div style={{ ...currencyName, fontSize: currencyNameFontSize }}>{rate.name}</div>
                      </div>
                    </div>

                    {/* Rate cells */}
                    {visibleColumns.map((col) => {
                      const value = col.is_builtin
                        ? (rate as unknown as Record<string, number>)[col.key] ?? 0
                        : rate.extra_values?.[col.key] ?? 0;
                      return (
                        <div
                          key={col.key}
                          style={{ ...rateCell, color: col.color, fontWeight: 800, textAlign: "right", fontSize: ratesCellFontSize }}
                        >
                          {formatRate(value, rate.decimal_places)}
                        </div>
                      );
                    })}
                  </div>
                ) : null,
              )}
            </div>
          </div>
        </section>

        {/* Ads panel */}
        <aside style={{ ...promotionPanelStyle, backgroundColor: "#211725" }}>
          {ads.length === 0 ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "clamp(14px,1.2vw,24px)", fontWeight: 700, letterSpacing: "0.1em" }}>
                {displayName.toUpperCase()}
              </div>
            </div>
          ) : (() => {
            const ad = ads[adIndex];
            if (!ad) return null;
            return (
              <div key={ad.id} style={promotionSlide}>
                {ad.file_type === "video" ? (
                  <video
                    src={ad.file_url}
                    autoPlay
                    muted
                    playsInline
                    onEnded={() => setAdIndex((i) => (i + 1) % ads.length)}
                    style={promotionMedia}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ad.file_url} alt="" style={promotionMedia} />
                )}
              </div>
            );
          })()}

        </aside>
      </main>

      {/* ── Ticker ── */}
      <footer style={footer}>
        <div style={tickerViewport}>
          <div style={tickerTrack}>
            {[...tickerItems, ...tickerItems].map((item, index) => (
              <span key={index} style={pTickerItem}>
                {item}
                <span style={{ color: ORANGE, fontWeight: 700 }}> /</span>
              </span>
            ))}
          </div>
        </div>

        {/* Powered by badge */}
        <div style={poweredByWrapper}>
          <span style={poweredByLabel}>Powered by</span>
          <div style={poweredByPill}>
            <Image
              src="/brand/brandLogo.png"
              alt="TechBiz Systems Services"
              width={90}
              height={30}
              style={poweredByLogo}
              unoptimized
            />
          </div>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@500;600;700&family=Roboto+Mono:wght@500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: ${PAPER}; }
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes rateProgress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.75); } }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const screenStyle: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
  display: "grid",
  gridTemplateRows: "10vh 1fr 8vh",
  backgroundColor: PAPER,
  color: INK,
  fontFamily: "'Barlow', sans-serif",
};

const header: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  alignItems: "center",
  gap: "2vw",
  padding: "0 2.2vw",
  backgroundColor: WHITE,
  borderBottom: `0.6vh solid`,
};

const brand: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.9vw",
};

const brandName: React.CSSProperties = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: "clamp(18px, 1.6vw, 32px)",
  fontWeight: 800,
  letterSpacing: "0.06em",
};

const headerTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.65vw",
  color: INK,
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: "clamp(20px, 1.8vw, 36px)",
  fontWeight: 700,
  letterSpacing: "0.06em",
  whiteSpace: "nowrap",
};

const liveDot: React.CSSProperties = {
  width: "0.8vw",
  height: "0.8vw",
  minWidth: "12px",
  minHeight: "12px",
  borderRadius: "50%",
  animation: "livePulse 2s ease-in-out infinite",
};


const clock: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: "8.6vw",
  paddingLeft: "1.4vw",
  borderLeft: "2px solid",
  lineHeight: 1,
};

const clockTime: React.CSSProperties = {
  fontFamily: "'Roboto Mono', monospace",
  fontSize: "clamp(26px, 2.4vw, 50px)",
  fontWeight: 700,
  letterSpacing: "0.02em",
};

const clockDate: React.CSSProperties = {
  marginTop: "0.7vh",
  color: "#756d78",
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: "clamp(12px, 1vw, 20px)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const ratesSection: React.CSSProperties = {
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  padding: "1.5vh 2.2vw 1.6vh",
  backgroundColor: PAPER,
};

const table: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "7vh 0.8vh 1fr",
};

const tableHeader: React.CSSProperties = {
  display: "grid",
  alignItems: "center",
  borderBottom: "0.5vh solid",
};

const headerCell: React.CSSProperties = {
  color: "#756d78",
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: "clamp(18px, 1.9vw, 42px)",
  fontWeight: 700,
  letterSpacing: "0.13em",
  textAlign: "right",
  overflow: "hidden",
};

const currencyColumn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.7vw",
  textAlign: "left",
  overflow: "hidden",
};

const tableBody: React.CSSProperties = {
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "repeat(7, minmax(0, 1fr))",
  transition: "opacity 350ms ease, transform 350ms ease",
};

const rateProgressTrack: React.CSSProperties = {
  overflow: "hidden",
  backgroundColor: "#b8afa8",
};

const rateProgress: React.CSSProperties = {
  width: "100%",
  height: "100%",
  transformOrigin: "left center",
  animation: `rateProgress ${RATE_PAGE_INTERVAL_MS}ms linear forwards`,
};

const rateRow: React.CSSProperties = {
  minHeight: 0,
  display: "grid",
  alignItems: "center",
  borderBottom: "2px solid #c0b8b0",
};

const rateCell: React.CSSProperties = {
  color: INK,
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: "clamp(28px, 3.2vw, 88px)",
  fontWeight: 800,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const flagStyle: React.CSSProperties = {
  width: "clamp(36px, 2.8vw, 58px)",
  height: "auto",
  maxHeight: "4.5vh",
  objectFit: "contain",
  flexShrink: 0,
  boxShadow: "0 0 0 1px rgba(23,19,26,0.12)",
};

const currencyCode: React.CSSProperties = {
  color: INK,
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: "clamp(20px, 2.2vw, 54px)",
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: "0.04em",
};

const currencyName: React.CSSProperties = {
  marginTop: "0.3vh",
  color: "#6b6070",
  fontFamily: "'Barlow', sans-serif",
  fontSize: "clamp(12px, 1.1vw, 22px)",
  fontWeight: 600,
};

const promotionPanel: React.CSSProperties = {
  minHeight: 0,
  position: "relative",
  overflow: "hidden",
  borderLeft: "3px solid #c0b8b0",
};

const promotionSlide: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  transition: "opacity 1s ease",
};

const promotionMedia: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
  objectFit: "cover",
};

const promotionFooter: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 2,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  minHeight: "7vh",
  padding: "0 3vw",
  color: WHITE,
  fontSize: "clamp(11px, 0.85vw, 18px)",
  fontWeight: 600,
  letterSpacing: "0.04em",
};

const promotionFooterText: React.CSSProperties = {
  opacity: 0.55,
  fontWeight: 500,
};

const footer: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  paddingLeft: "2.4vw",
  backgroundColor: INK,
  color: WHITE,
  overflow: "hidden",
};

const tickerViewport: React.CSSProperties = {
  overflow: "hidden",
  flex: 1,
};

const tickerTrack: React.CSSProperties = {
  display: "flex",
  width: "max-content",
  whiteSpace: "nowrap",
  animation: "ticker 36s linear infinite",
};

const tickerItem: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "2.4vw",
  paddingLeft: "2.4vw",
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: "clamp(16px, 1.8vw, 34px)",
  fontWeight: 700,
  letterSpacing: "0.05em",
};

const poweredByWrapper: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "clamp(2px, 0.4vh, 5px)",
  paddingLeft: "clamp(12px, 1.6vw, 28px)",
  paddingRight: "clamp(12px, 1.8vw, 32px)",
  borderLeft: "1px solid rgba(255,255,255,0.12)",
  flexShrink: 0,
};

const poweredByLabel: React.CSSProperties = {
  color: "rgba(255,255,255,0.45)",
  fontFamily: "'Barlow', sans-serif",
  fontSize: "clamp(7px, 0.6vw, 11px)",
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const poweredByPill: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
};

const poweredByLogo: React.CSSProperties = {
  height: "clamp(22px, 3.2vh, 38px)",
  width: "auto",
  objectFit: "contain",
  display: "block",
  filter: "brightness(0) invert(1)",
};
