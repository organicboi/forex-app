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

interface CurrencyRate {
  code: string;
  name: string;
  flag_path: string;
  decimal_places: number;
  buy: number;
  sell: number;
  transfer: number;
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
  customer?: CustomerInfo;
  currencies?: CurrencyRate[];
  ads?: AdItem[];
  ticker?: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RATES_PER_PAGE = 10;
const RATE_PAGE_INTERVAL_MS = 8000;
const POLL_INTERVAL_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const ORANGE = "#ef6c21";
const INK = "#17131a";
const WHITE = "#ffffff";
const PAPER = "#f2eee8";

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
        fontFamily: "'Inter', sans-serif",
        gap: "1.5vh",
      }}
    >
      <div style={{ fontSize: "clamp(20px, 2vw, 40px)", fontWeight: 700, color: INK }}>
        {title}
      </div>
      {body && (
        <div style={{ fontSize: "clamp(12px, 1vw, 20px)", color: "#756d78" }}>{body}</div>
      )}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');`}</style>
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

  // ── Rate page cycling ─────────────────────────────────────────────────────
  const currencies = tvData?.currencies ?? [];
  const totalRatePages = Math.max(Math.ceil(currencies.length / RATES_PER_PAGE), 1);

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

  // ── Ad cycling (per-ad duration) ──────────────────────────────────────────
  const ads = tvData?.ads ?? [];
  useEffect(() => {
    if (ads.length === 0) return;
    const duration = (ads[adIndex]?.duration_seconds ?? 10) * 1000;
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
        body="Add ?token=YOUR_BRANCH_TOKEN to the URL, or scan the QR code from your admin panel."
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

  const visibleRates = currencies.slice(
    ratePage * RATES_PER_PAGE,
    (ratePage + 1) * RATES_PER_PAGE,
  );
  const rateSlots: Array<CurrencyRate | null> = [
    ...visibleRates,
    ...Array<null>(RATES_PER_PAGE - visibleRates.length).fill(null),
  ];

  const tickerItems = ticker.length > 0 ? ticker : ["Exchange rates shown are for reference only"];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={screen}>
      {/* ── Header ── */}
      <header style={{ ...header, borderBottomColor: ORANGE }}>
        {/* Brand */}
        <div style={brand}>
          {customer.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={customer.logo_url}
              alt=""
              style={{ height: "6vh", maxWidth: "10vw", objectFit: "contain" }}
            />
          )}
          <div>
            <div style={{ ...brandName, color: PURPLE }}>{displayName}</div>
          </div>
        </div>

        {/* Centre title */}
        <div style={headerTitle}>
          <span style={{ ...liveDot, backgroundColor: ORANGE }} />
          LIVE EXCHANGE RATES
        </div>

        {/* Right: branch + clock */}
        <div style={headerInfo}>
          {branchName && (
            <div style={branchBlock}>
              <span style={infoLabel}>BRANCH</span>
              <span style={infoValue}>{branchName.toUpperCase()}</span>
            </div>
          )}
          <div style={{ ...clock, borderLeftColor: PURPLE }}>
            <span style={{ ...clockTime, color: PURPLE }}>{time}</span>
            <span style={clockDate}>{date}</span>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={main}>
        {/* Rates */}
        <section style={ratesSection}>
          <div style={table}>
            {/* Meta row */}
            <div style={rateMeta}>
              <span style={rateMetaItem}>
                <span style={rateMetaLabel}>BASE</span>
                <span style={{ ...rateMetaValue, color: PURPLE }}>{customer.base_currency}</span>
              </span>
              <span style={rateMetaDivider} />
              <span style={rateMetaItem}>
                <span style={rateMetaLabel}>PAGE</span>
                <span style={{ ...rateMetaValue, color: PURPLE }}>
                  {String(ratePage + 1).padStart(2, "0")}&thinsp;/&thinsp;
                  {String(totalRatePages).padStart(2, "0")}
                </span>
              </span>
            </div>

            {/* Column headers */}
            <div style={{ ...tableHeader, borderBottomColor: PURPLE }}>
              <div style={{ ...headerCell, ...currencyColumn }}>CURRENCY</div>
              <div style={headerCell}>BUY</div>
              <div style={headerCell}>SELL</div>
              <div style={headerCell}>TRANSFER</div>
            </div>

            {/* Progress bar */}
            <div style={rateProgressTrack}>
              <div key={ratePage} style={{ ...rateProgress, backgroundColor: ORANGE }} />
            </div>

            {/* Rows */}
            <div
              style={{
                ...tableBody,
                opacity: ratesChanging ? 0 : 1,
                transform: ratesChanging ? "translateY(1vh)" : "translateY(0)",
              }}
            >
              {rateSlots.map((rate, index) =>
                rate ? (
                  <div key={rate.code} style={rateRow}>
                    <div style={{ ...rateCell, ...currencyColumn }}>
                      <Image
                        src={rate.flag_path}
                        alt=""
                        width={54}
                        height={36}
                        style={flagStyle}
                        unoptimized
                      />
                      <div>
                        <div style={currencyCode}>{rate.code}</div>
                        <div style={currencyName}>{rate.name}</div>
                      </div>
                    </div>
                    <div style={rateCell}>{formatRate(rate.buy, rate.decimal_places)}</div>
                    <div style={rateCell}>{formatRate(rate.sell, rate.decimal_places)}</div>
                    <div style={{ ...rateCell, ...transferCell, color: PURPLE }}>
                      {formatRate(rate.transfer, rate.decimal_places)}
                    </div>
                  </div>
                ) : (
                  <div key={`empty-${index}`} style={emptyRateRow} />
                ),
              )}
            </div>
          </div>
        </section>

        {/* Ads panel */}
        <aside style={{ ...promotionPanel, backgroundColor: "#211725" }}>
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
          ) : (
            ads.map((ad, index) => (
              <div
                key={ad.id}
                style={{
                  ...promotionSlide,
                  opacity: index === adIndex ? 1 : 0,
                  pointerEvents: index === adIndex ? "auto" : "none",
                }}
              >
                {ad.file_type === "video" ? (
                  <video
                    src={ad.file_url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    style={promotionMedia}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ad.file_url} alt="" style={promotionMedia} />
                )}
              </div>
            ))
          )}

          {ads.length > 1 && (
            <div style={{ ...promotionFooter, backgroundColor: PURPLE }}>
              <span style={promotionFooterText}>{displayName}</span>
              <span style={{ color: "#ffad78", fontFamily: "'DM Mono', monospace" }}>
                {String(adIndex + 1).padStart(2, "0")} / {String(ads.length).padStart(2, "0")}
              </span>
            </div>
          )}
        </aside>
      </main>

      {/* ── Ticker ── */}
      <footer style={footer}>
        <div style={tickerViewport}>
          <div style={tickerTrack}>
            {[...tickerItems, ...tickerItems].map((item, index) => (
              <span key={index} style={tickerItem}>
                {item}
                <span style={{ color: ORANGE, fontWeight: 700 }}> /</span>
              </span>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: ${PAPER}; }
        @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes rateProgress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      `}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const screen: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
  display: "grid",
  gridTemplateRows: "10vh 1fr 5.5vh",
  backgroundColor: PAPER,
  color: INK,
  fontFamily: "'Inter', sans-serif",
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
  fontSize: "clamp(16px, 1.35vw, 28px)",
  fontWeight: 700,
  letterSpacing: "0.08em",
};

const headerTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.65vw",
  color: INK,
  fontSize: "clamp(17px, 1.45vw, 30px)",
  fontWeight: 600,
  letterSpacing: "0.08em",
  whiteSpace: "nowrap",
};

const liveDot: React.CSSProperties = {
  width: "0.6vw",
  height: "0.6vw",
  minWidth: "9px",
  minHeight: "9px",
  borderRadius: "50%",
};

const headerInfo: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "1.6vw",
};

const branchBlock: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  lineHeight: 1.15,
};

const infoLabel: React.CSSProperties = {
  color: "#8c848e",
  fontSize: "clamp(8px, 0.55vw, 12px)",
  fontWeight: 700,
  letterSpacing: "0.18em",
};

const infoValue: React.CSSProperties = {
  marginTop: "0.45vh",
  color: INK,
  fontSize: "clamp(13px, 1vw, 21px)",
  fontWeight: 700,
  letterSpacing: "0.06em",
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
  fontFamily: "'DM Mono', monospace",
  fontSize: "clamp(24px, 2.25vw, 46px)",
  fontWeight: 500,
  letterSpacing: "0.02em",
};

const clockDate: React.CSSProperties = {
  marginTop: "0.7vh",
  color: "#756d78",
  fontSize: "clamp(8px, 0.62vw, 13px)",
  fontWeight: 600,
  textTransform: "uppercase",
};

const main: React.CSSProperties = {
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "64% 36%",
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
  gridTemplateRows: "3vh 6vh 0.4vh 1fr",
};

const rateMeta: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "1vw",
};

const rateMetaItem: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "0.45vw",
};

const rateMetaLabel: React.CSSProperties = {
  color: "#9b929e",
  fontSize: "clamp(8px, 0.52vw, 11px)",
  fontWeight: 700,
  letterSpacing: "0.16em",
};

const rateMetaValue: React.CSSProperties = {
  fontFamily: "'DM Mono', monospace",
  fontSize: "clamp(11px, 0.85vw, 18px)",
  fontWeight: 500,
};

const rateMetaDivider: React.CSSProperties = {
  width: "1px",
  height: "1.4vh",
  backgroundColor: "#d8d1ca",
  alignSelf: "center",
};

const tableHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr repeat(3, 1fr)",
  alignItems: "center",
  borderBottom: "0.45vh solid",
};

const headerCell: React.CSSProperties = {
  color: "#756d78",
  fontSize: "clamp(10px, 0.8vw, 17px)",
  fontWeight: 700,
  letterSpacing: "0.13em",
  textAlign: "right",
};

const currencyColumn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1vw",
  textAlign: "left",
};

const tableBody: React.CSSProperties = {
  minHeight: 0,
  display: "grid",
  gridTemplateRows: "repeat(10, minmax(0, 1fr))",
  transition: "opacity 350ms ease, transform 350ms ease",
};

const rateProgressTrack: React.CSSProperties = {
  overflow: "hidden",
  backgroundColor: "#ded7d0",
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
  gridTemplateColumns: "2fr repeat(3, 1fr)",
  alignItems: "center",
  borderBottom: "1px solid #d8d1ca",
};

const emptyRateRow: React.CSSProperties = {
  borderBottom: "1px solid #d8d1ca",
};

const rateCell: React.CSSProperties = {
  color: INK,
  fontFamily: "'DM Mono', monospace",
  fontSize: "clamp(18px, 1.65vw, 48px)",
  fontWeight: 500,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const transferCell: React.CSSProperties = {
  fontWeight: 700,
};

const flagStyle: React.CSSProperties = {
  width: "clamp(38px, 2.8vw, 58px)",
  height: "auto",
  maxHeight: "4vh",
  objectFit: "contain",
  boxShadow: "0 0 0 1px rgba(23,19,26,0.12)",
};

const currencyCode: React.CSSProperties = {
  color: INK,
  fontFamily: "'DM Mono', monospace",
  fontSize: "clamp(17px, 1.5vw, 44px)",
  fontWeight: 700,
  lineHeight: 1,
};

const currencyName: React.CSSProperties = {
  marginTop: "0.45vh",
  color: "#4a4450",
  fontFamily: "'Inter', sans-serif",
  fontSize: "clamp(9px, 0.68vw, 14px)",
  fontWeight: 600,
};

const promotionPanel: React.CSSProperties = {
  minHeight: 0,
  position: "relative",
  overflow: "hidden",
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
  fontSize: "clamp(10px, 0.78vw, 16px)",
  fontWeight: 600,
  letterSpacing: "0.03em",
};
