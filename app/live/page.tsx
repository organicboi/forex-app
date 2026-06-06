"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface RateRow {
  flagSrc: string;
  code: string;
  name: string;
  buy: number;
  sell: number;
  transfer: number;
}

interface Promotion {
  id: number;
  imageUrl: string;
  eyebrow: string;
  headline: string;
  subline: string;
}

const RATES: RateRow[] = [
  { flagSrc: "/flags/in.svg", code: "INR", name: "Indian Rupee", buy: 0.04, sell: 0.048, transfer: 23.03 },
  { flagSrc: "/flags/pk.svg", code: "PKR", name: "Pakistani Rupee", buy: 0.016, sell: 0.016, transfer: 76.13 },
  { flagSrc: "/flags/bd.svg", code: "BDT", name: "Bangladeshi Taka", buy: 0.026, sell: 0.037, transfer: 33.85 },
  { flagSrc: "/flags/ph.svg", code: "PHP", name: "Philippine Peso", buy: 0.058, sell: 0.067, transfer: 15.8 },
  { flagSrc: "/flags/np.svg", code: "NPR", name: "Nepalese Rupee", buy: 0.022, sell: 0.032, transfer: 36.87 },
  { flagSrc: "/flags/lk.svg", code: "LKR", name: "Sri Lankan Rupee", buy: 0.01, sell: 0.01, transfer: 78.98 },
  { flagSrc: "/flags/id.svg", code: "IDR", name: "Indonesian Rupiah", buy: 0, sell: 0, transfer: 4315 },
  { flagSrc: "/flags/us.svg", code: "USD", name: "US Dollar", buy: 3.65, sell: 3.68, transfer: 3.673 },
  { flagSrc: "/flags/gb.svg", code: "GBP", name: "British Pound", buy: 4.62, sell: 4.68, transfer: 4.661 },
  { flagSrc: "/flags/eu.svg", code: "EUR", name: "Euro", buy: 4.01, sell: 4.06, transfer: 4.048 },
  { flagSrc: "/flags/cn.svg", code: "CNY", name: "Chinese Yuan", buy: 0.5, sell: 0.52, transfer: 0.514 },
  { flagSrc: "/flags/jp.svg", code: "JPY", name: "Japanese Yen", buy: 0.024, sell: 0.026, transfer: 0.025 },
  { flagSrc: "/flags/sa.svg", code: "SAR", name: "Saudi Riyal", buy: 0.975, sell: 0.99, transfer: 0.982 },
  { flagSrc: "/flags/kw.svg", code: "KWD", name: "Kuwaiti Dinar", buy: 11.94, sell: 12.2, transfer: 12.08 },
  { flagSrc: "/flags/qa.svg", code: "QAR", name: "Qatari Riyal", buy: 1.01, sell: 1.02, transfer: 1.014 },
  { flagSrc: "/flags/bh.svg", code: "BHD", name: "Bahraini Dinar", buy: 9.72, sell: 9.88, transfer: 9.802 },
  { flagSrc: "/flags/om.svg", code: "OMR", name: "Omani Rial", buy: 9.54, sell: 9.7, transfer: 9.618 },
  { flagSrc: "/flags/au.svg", code: "AUD", name: "Australian Dollar", buy: 2.4, sell: 2.44, transfer: 2.421 },
  { flagSrc: "/flags/ca.svg", code: "CAD", name: "Canadian Dollar", buy: 2.68, sell: 2.71, transfer: 2.694 },
  { flagSrc: "/flags/my.svg", code: "MYR", name: "Malaysian Ringgit", buy: 0.82, sell: 0.84, transfer: 0.831 },
];

const PROMOTIONS: Promotion[] = [
  {
    id: 1,
    imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=85",
    eyebrow: "MONEY TRANSFER",
    headline: "Send more home.",
    subline: "Competitive rates and reliable delivery.",
  },
  {
    id: 2,
    imageUrl: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=85",
    eyebrow: "TRAVEL MONEY",
    headline: "Ready before takeoff.",
    subline: "Reserve your foreign currency at the counter.",
  },
  {
    id: 3,
    imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&q=85",
    eyebrow: "BUSINESS SERVICES",
    headline: "FX built for business.",
    subline: "Ask our team about volume exchange rates.",
  },
];

const TICKER_ITEMS = [
  "Rates updated every 15 minutes",
  "Open daily from 8:00 AM to 10:00 PM",
  "More than 40 currencies available at the counter",
  "Ask our team for today's transfer offers",
];

const PROMOTION_INTERVAL_MS = 7000;
const RATE_PAGE_INTERVAL_MS = 8000;
const RATES_PER_PAGE = 10;

function formatRate(value: number) {
  if (value >= 1000) return value.toFixed(0);
  return value.toFixed(3);
}

function useDateTime() {
  const [dateTime, setDateTime] = useState({ time: "", date: "" });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setDateTime({
        time: now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        date: now.toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      });
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return dateTime;
}

export default function ForexDisplayPage() {
  const { time, date } = useDateTime();
  const [promotionIndex, setPromotionIndex] = useState(0);
  const [ratePage, setRatePage] = useState(0);
  const [ratesChanging, setRatesChanging] = useState(false);
  const totalRatePages = Math.ceil(RATES.length / RATES_PER_PAGE);

  useEffect(() => {
    const timer = setInterval(() => {
      setPromotionIndex((current) => (current + 1) % PROMOTIONS.length);
    }, PROMOTION_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let transitionTimer: ReturnType<typeof setTimeout> | undefined;
    const pageTimer = setInterval(() => {
      setRatesChanging(true);
      transitionTimer = setTimeout(() => {
        setRatePage((current) => (current + 1) % totalRatePages);
        setRatesChanging(false);
      }, 350);
    }, RATE_PAGE_INTERVAL_MS);

    return () => {
      clearInterval(pageTimer);
      if (transitionTimer) clearTimeout(transitionTimer);
    };
  }, [totalRatePages]);

  const visibleRates = RATES.slice(
    ratePage * RATES_PER_PAGE,
    (ratePage + 1) * RATES_PER_PAGE,
  );
  const rateSlots: Array<RateRow | null> = [
    ...visibleRates,
    ...Array<null>(RATES_PER_PAGE - visibleRates.length).fill(null),
  ];

  return (
    <div style={styles.screen}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <div>
            <div style={styles.brandName}>NOVA CURRENCY</div>
            <div style={styles.brandArabic}>نوفا للصرافة</div>
          </div>
        </div>

        <div style={styles.headerTitle}>
          <span style={styles.liveDot} />
          LIVE EXCHANGE RATES
        </div>

        <div style={styles.headerInfo}>
          <div style={styles.branch}>
            <span style={styles.infoLabel}>BRANCH</span>
            <span style={styles.infoValue}>CITY CENTRE</span>
          </div>
          <div style={styles.clock}>
            <span style={styles.clockTime}>{time}</span>
            <span style={styles.clockDate}>{date}</span>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.ratesSection}>
          <div style={styles.table}>
            <div style={styles.rateMeta}>
              <span style={styles.rateMetaItem}>
                <span style={styles.rateMetaLabel}>BASE</span>
                <span style={styles.rateMetaValue}>AED</span>
              </span>
              <span style={styles.rateMetaDivider} />
              <span style={styles.rateMetaItem}>
                <span style={styles.rateMetaLabel}>PAGE</span>
                <span style={styles.rateMetaValue}>
                  {String(ratePage + 1).padStart(2, "0")}&thinsp;/&thinsp;{String(totalRatePages).padStart(2, "0")}
                </span>
              </span>
            </div>

            <div style={styles.tableHeader}>
              <div style={{ ...styles.headerCell, ...styles.currencyColumn }}>CURRENCY</div>
              <div style={styles.headerCell}>BUY</div>
              <div style={styles.headerCell}>SELL</div>
              <div style={styles.headerCell}>TRANSFER</div>
            </div>

            <div style={styles.rateProgressTrack}>
              <div key={ratePage} style={styles.rateProgress} />
            </div>

            <div
              style={{
                ...styles.tableBody,
                opacity: ratesChanging ? 0 : 1,
                transform: ratesChanging ? "translateY(1vh)" : "translateY(0)",
              }}
            >
              {rateSlots.map((rate, index) =>
                rate ? (
                  <div key={rate.code} style={styles.rateRow}>
                    <div style={{ ...styles.rateCell, ...styles.currencyColumn }}>
                      <Image
                        src={rate.flagSrc}
                        alt=""
                        width={54}
                        height={36}
                        style={styles.flag}
                      />
                      <div>
                        <div style={styles.currencyCode}>{rate.code}</div>
                        <div style={styles.currencyName}>{rate.name}</div>
                      </div>
                    </div>
                    <div style={styles.rateCell}>{formatRate(rate.buy)}</div>
                    <div style={styles.rateCell}>{formatRate(rate.sell)}</div>
                    <div style={{ ...styles.rateCell, ...styles.transferCell }}>
                      {formatRate(rate.transfer)}
                    </div>
                  </div>
                ) : (
                  <div key={`empty-${index}`} style={styles.emptyRateRow} />
                ),
              )}
            </div>
          </div>
        </section>

        <aside style={styles.promotionPanel}>
          {PROMOTIONS.map((promotion, index) => (
            <div
              key={promotion.id}
              style={{
                ...styles.promotionSlide,
                opacity: index === promotionIndex ? 1 : 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={promotion.imageUrl} alt="" style={styles.promotionImage} />
              <div style={styles.promotionShade} />
              <div style={styles.promotionCopy}>
                <div style={styles.promotionEyebrow}>{promotion.eyebrow}</div>
                <div style={styles.promotionHeadline}>{promotion.headline}</div>
                <div style={styles.promotionSubline}>{promotion.subline}</div>
              </div>
            </div>
          ))}

          <div style={styles.promotionFooter}>
            <span style={styles.promotionFooterText}>Speak to our team</span>
            <span style={styles.promotionCount}>
              {String(promotionIndex + 1).padStart(2, "0")} / {String(PROMOTIONS.length).padStart(2, "0")}
            </span>
          </div>
        </aside>
      </main>

      <footer style={styles.footer}>
        <div style={styles.tickerViewport}>
          <div style={styles.tickerTrack}>
            {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, index) => (
              <span key={index} style={styles.tickerItem}>
                {item}
                <span style={styles.tickerSeparator}>/</span>
              </span>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: #f2eee8; }

        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        @keyframes rateProgress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}

const INK = "#17131a";
const PURPLE = "#4c195a";
const ORANGE = "#ef6c21";
const PAPER = "#f2eee8";
const WHITE = "#ffffff";

const styles: Record<string, React.CSSProperties> = {
  screen: {
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "10vh 1fr 5.5vh",
    backgroundColor: PAPER,
    color: INK,
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: "2vw",
    padding: "0 2.2vw",
    backgroundColor: WHITE,
    borderBottom: `0.6vh solid ${ORANGE}`,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "0.9vw",
  },
  brandName: {
    color: PURPLE,
    fontSize: "clamp(16px, 1.35vw, 28px)",
    fontWeight: "700",
    letterSpacing: "0.08em",
  },
  brandArabic: {
    marginTop: "0.25vh",
    color: "#756d78",
    fontSize: "clamp(10px, 0.7vw, 15px)",
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    gap: "0.65vw",
    color: INK,
    fontSize: "clamp(17px, 1.45vw, 30px)",
    fontWeight: "600",
    letterSpacing: "0.08em",
    whiteSpace: "nowrap",
  },
  liveDot: {
    width: "0.6vw",
    height: "0.6vw",
    minWidth: "9px",
    minHeight: "9px",
    backgroundColor: ORANGE,
    borderRadius: "50%",
  },
  headerInfo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "1.6vw",
  },
  branch: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    lineHeight: 1.15,
  },
  infoLabel: {
    color: "#8c848e",
    fontSize: "clamp(8px, 0.55vw, 12px)",
    fontWeight: "700",
    letterSpacing: "0.18em",
  },
  infoValue: {
    marginTop: "0.45vh",
    color: INK,
    fontSize: "clamp(13px, 1vw, 21px)",
    fontWeight: "700",
    letterSpacing: "0.06em",
  },
  clock: {
    display: "flex",
    flexDirection: "column",
    minWidth: "8.6vw",
    paddingLeft: "1.4vw",
    borderLeft: `2px solid ${PURPLE}`,
    lineHeight: 1,
  },
  clockTime: {
    color: PURPLE,
    fontFamily: "'DM Mono', monospace",
    fontSize: "clamp(24px, 2.25vw, 46px)",
    fontWeight: "500",
    letterSpacing: "0.02em",
  },
  clockDate: {
    marginTop: "0.7vh",
    color: "#756d78",
    fontSize: "clamp(8px, 0.62vw, 13px)",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  main: {
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "64% 36%",
  },
  ratesSection: {
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    padding: "1.5vh 2.2vw 1.6vh",
    backgroundColor: PAPER,
  },
  table: {
    flex: 1,
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "3vh 6vh 0.4vh 1fr",
  },
  rateMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "1vw",
  },
  rateMetaItem: {
    display: "flex",
    alignItems: "baseline",
    gap: "0.45vw",
  },
  rateMetaLabel: {
    color: "#9b929e",
    fontSize: "clamp(8px, 0.52vw, 11px)",
    fontWeight: "700",
    letterSpacing: "0.16em",
  },
  rateMetaValue: {
    color: PURPLE,
    fontFamily: "'DM Mono', monospace",
    fontSize: "clamp(11px, 0.85vw, 18px)",
    fontWeight: "500",
  },
  rateMetaDivider: {
    width: "1px",
    height: "1.4vh",
    backgroundColor: "#d8d1ca",
    alignSelf: "center",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "2fr repeat(3, 1fr)",
    alignItems: "center",
    borderBottom: `0.45vh solid ${PURPLE}`,
  },
  headerCell: {
    color: "#756d78",
    fontSize: "clamp(10px, 0.8vw, 17px)",
    fontWeight: "700",
    letterSpacing: "0.13em",
    textAlign: "right",
  },
  currencyColumn: {
    display: "flex",
    alignItems: "center",
    gap: "1vw",
    textAlign: "left",
  },
  tableBody: {
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "repeat(10, minmax(0, 1fr))",
    transition: "opacity 350ms ease, transform 350ms ease",
  },
  rateProgressTrack: {
    overflow: "hidden",
    backgroundColor: "#ded7d0",
  },
  rateProgress: {
    width: "100%",
    height: "100%",
    backgroundColor: ORANGE,
    transformOrigin: "left center",
    animation: `rateProgress ${RATE_PAGE_INTERVAL_MS}ms linear forwards`,
  },
  rateRow: {
    minHeight: 0,
    display: "grid",
    gridTemplateColumns: "2fr repeat(3, 1fr)",
    alignItems: "center",
    borderBottom: "1px solid #d8d1ca",
  },
  emptyRateRow: {
    borderBottom: "1px solid #d8d1ca",
  },
  rateCell: {
    color: INK,
    fontFamily: "'DM Mono', monospace",
    fontSize: "clamp(18px, 1.65vw, 48px)",
    fontWeight: "500",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  transferCell: {
    color: PURPLE,
    fontWeight: "700",
  },
  flag: {
    width: "clamp(38px, 2.8vw, 58px)",
    height: "auto",
    maxHeight: "4vh",
    objectFit: "contain",
    boxShadow: "0 0 0 1px rgba(23,19,26,0.12)",
  },
  currencyCode: {
    color: INK,
    fontFamily: "'DM Mono', monospace",
    fontSize: "clamp(17px, 1.5vw, 44px)",
    fontWeight: "700",
    lineHeight: 1,
  },
  currencyName: {
    marginTop: "0.45vh",
    color: "#4a4450",
    fontFamily: "'Inter', sans-serif",
    fontSize: "clamp(9px, 0.68vw, 14px)",
    fontWeight: "600",
  },
  promotionPanel: {
    minHeight: 0,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#211725",
  },
  promotionSlide: {
    position: "absolute",
    inset: 0,
    transition: "opacity 1s ease",
  },
  promotionImage: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
  },
  promotionShade: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(180deg, rgba(20,12,23,0.08) 20%, rgba(20,12,23,0.92) 100%)",
  },
  promotionCopy: {
    position: "absolute",
    left: "3vw",
    right: "3vw",
    bottom: "12vh",
    color: WHITE,
  },
  promotionEyebrow: {
    color: "#ff9a58",
    fontSize: "clamp(10px, 0.75vw, 16px)",
    fontWeight: "700",
    letterSpacing: "0.2em",
  },
  promotionHeadline: {
    maxWidth: "26vw",
    marginTop: "1.4vh",
    fontSize: "clamp(34px, 3.5vw, 72px)",
    fontWeight: "600",
    lineHeight: 0.98,
    letterSpacing: "-0.05em",
  },
  promotionSubline: {
    maxWidth: "25vw",
    marginTop: "2vh",
    color: "rgba(255,255,255,0.78)",
    fontSize: "clamp(13px, 1vw, 21px)",
    fontWeight: "500",
    lineHeight: 1.35,
  },
  promotionFooter: {
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
    backgroundColor: PURPLE,
    fontSize: "clamp(11px, 0.85vw, 18px)",
    fontWeight: "600",
    letterSpacing: "0.04em",
  },
  promotionFooterText: {
    opacity: 0.55,
    fontWeight: "500",
  },
  promotionCount: {
    color: "#ffad78",
    fontFamily: "'DM Mono', monospace",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    paddingLeft: "2.4vw",
    backgroundColor: INK,
    color: WHITE,
    overflow: "hidden",
  },
  tickerViewport: {
    overflow: "hidden",
    flex: 1,
  },
  tickerTrack: {
    display: "flex",
    width: "max-content",
    whiteSpace: "nowrap",
    animation: "ticker 36s linear infinite",
  },
  tickerItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: "2.4vw",
    paddingLeft: "2.4vw",
    fontSize: "clamp(10px, 0.78vw, 16px)",
    fontWeight: "600",
    letterSpacing: "0.03em",
  },
  tickerSeparator: {
    color: ORANGE,
    fontWeight: "700",
  },
};
