import { useState, useEffect, useRef, useCallback } from "react";

const GREEN = "#22C55E", RED = "#EF4444", WHITE = "#FFFFFF", YELLOW = "#F59E0B";
const BORDER = "#1E1E1E", BG = "#000000", SURFACE = "#0C0C0C";
const FONT_URL = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap";
const STORAGE_KEY = "reserve_demo_v3";
const LOGO_KEY = "reserve_demo_logo_v2";

const REP_NAMES = ["Marcus","Devon","Kayla","Jordan","Tyler","Raine","Brian","Ash","Scott","Devin"];

interface RepData { name: string; calls: number; shows: number; closes: number; revenue: number; installment: number; tier: "top"|"mid"|"low"; }
interface DashData {
  agencyName: string; clientName: string; monthlyGoal: number; currentCash: number;
  installments: number; totalCalls: number; showUps: number; noShows: number;
  closes: number; avgDeal: number; dayOfMonth: number; totalDaysInMonth: number;
  reps: RepData[]; trendCloses: number[]; trendCash: number[]; month: string; year: number;
  showRate: number; closeRate: number;
}

interface CalcInputs {
  totalCash: string; showRate: string; closeRate: string; avgDeal: string;
  installmentPct: string; numReps: string; monthlyGoal: string; dayOfMonth: string; totalDaysInMonth: string;
  month: string; year: string; agencyName: string; clientName: string;
}

const DEFAULT: DashData = {
  agencyName: "Apex Media Group", clientName: "Jordan Williams",
  monthlyGoal: 110000, currentCash: 78400, installments: 12000,
  totalCalls: 142, showUps: 98, noShows: 44, closes: 18, avgDeal: 6000,
  showRate: 69, closeRate: 18,
  dayOfMonth: 21, totalDaysInMonth: 31,
  reps: [
    { name: "Marcus", calls: 58, shows: 42, closes: 9, revenue: 38400, installment: 6000, tier: "top" },
    { name: "Devon", calls: 47, shows: 31, closes: 6, revenue: 24000, installment: 4000, tier: "mid" },
    { name: "Kayla", calls: 37, shows: 25, closes: 3, revenue: 16000, installment: 2000, tier: "low" },
  ],
  trendCloses: [1,2,1,3,2,1,2,2,3,1],
  trendCash: [6000,12000,6000,18000,12000,6000,12000,12000,18000,6000],
  month: "March", year: 2026,
};

const DEFAULT_CALC: CalcInputs = {
  totalCash: "78400", showRate: "69", closeRate: "18", avgDeal: "6000",
  installmentPct: "13", numReps: "", monthlyGoal: "110000",
  dayOfMonth: "21", totalDaysInMonth: "31", month: "March", year: "2026",
  agencyName: "Apex Media Group", clientName: "Jordan Williams",
};

const TIER_WEIGHTS: Record<number, number[]> = {
  1: [1],
  2: [0.62, 0.38],
  3: [0.52, 0.31, 0.17],
  4: [0.42, 0.28, 0.20, 0.10],
  5: [0.38, 0.26, 0.18, 0.12, 0.06],
  6: [0.34, 0.24, 0.18, 0.13, 0.08, 0.03],
};
const TIER_LABELS: Record<number, ("top"|"mid"|"low")[]> = {
  1: ["top"],
  2: ["top","low"],
  3: ["top","mid","low"],
  4: ["top","top","mid","low"],
  5: ["top","top","mid","low","low"],
  6: ["top","top","mid","mid","low","low"],
};

function autoRepCount(totalCalls: number, daysElapsed: number, manualOverride: string): { repCount: number; callsPerRepPerDay: number; autoSet: boolean } {
  const manualVal = parseInt(manualOverride);
  const callsPerDay = totalCalls / Math.max(daysElapsed, 1);
  let bestRepCount = 3;
  let bestRemainder = Infinity;
  for (const target of [8, 9, 10]) {
    const rawReps = callsPerDay / target;
    const rounded = Math.min(Math.max(Math.round(rawReps), 1), 6);
    const remainder = Math.abs(rawReps - rounded);
    if (remainder < bestRemainder) { bestRemainder = remainder; bestRepCount = rounded; }
  }
  const finalReps = isNaN(manualVal) ? bestRepCount : Math.min(Math.max(manualVal, 1), 6);
  const actualCallsPerRepPerDay = callsPerDay / finalReps;
  return { repCount: finalReps, callsPerRepPerDay: Math.round(actualCallsPerRepPerDay * 10) / 10, autoSet: isNaN(manualVal) };
}

function generateReps(closes: number, avgDeal: number, installmentPct: number, showRate: number, closeRate: number, numReps: number): RepData[] {
  const n = Math.min(Math.max(numReps, 1), 6);
  const weights = TIER_WEIGHTS[n] || TIER_WEIGHTS[3];
  const tiers = TIER_LABELS[n] || TIER_LABELS[3];
  const totalRevenue = closes * avgDeal;
  const totalInstallments = Math.round(totalRevenue * (installmentPct / 100));
  const totalShows = closeRate > 0 ? Math.round(closes / (closeRate / 100)) : closes * 4;
  const totalCalls = showRate > 0 ? Math.round(totalShows / (showRate / 100)) : totalShows * 2;
  return weights.map((w, i) => ({
    name: REP_NAMES[i] || `Rep ${i+1}`,
    calls: Math.max(1, Math.round(totalCalls * w)),
    shows: Math.max(1, Math.round(totalShows * w)),
    closes: Math.max(1, Math.round(closes * w)),
    revenue: Math.round(totalRevenue * w),
    installment: Math.round(totalInstallments * w),
    tier: tiers[i],
  }));
}

function generateTrends(closes: number, avgDeal: number, dayOfMonth: number): { trendCloses: number[]; trendCash: number[] } {
  const avgClosesPerDay = closes / Math.max(dayOfMonth, 1);
  const trendCloses: number[] = [];
  const trendCash: number[] = [];
  for (let i = 0; i < 10; i++) {
    const variance = 0.4 + Math.random() * 1.2;
    const c = Math.max(0, Math.round(avgClosesPerDay * variance));
    trendCloses.push(c);
    trendCash.push(c * avgDeal);
  }
  return { trendCloses, trendCash };
}

function calculate(inputs: CalcInputs): DashData {
  const totalCash = parseFloat(inputs.totalCash) || 0;
  const showRate = parseFloat(inputs.showRate) || 70;
  const closeRate = parseFloat(inputs.closeRate) || 25;
  const avgDeal = parseFloat(inputs.avgDeal) || 6000;
  const installmentPct = parseFloat(inputs.installmentPct) || 13;
  const monthlyGoal = parseFloat(inputs.monthlyGoal) || 110000;
  const dayOfMonth = parseInt(inputs.dayOfMonth) || 15;
  const totalDaysInMonth = parseInt(inputs.totalDaysInMonth) || 31;
  const daysElapsed = Math.max(dayOfMonth - 1, 1);
  const installments = Math.round(totalCash * (installmentPct / 100));
  const newCash = totalCash - installments;
  const closes = avgDeal > 0 ? Math.round(newCash / avgDeal) : 0;
  const showUps = closeRate > 0 ? Math.round(closes / (closeRate / 100)) : closes * 4;
  const totalCalls = showRate > 0 ? Math.round(showUps / (showRate / 100)) : showUps * 2;
  const noShows = totalCalls - showUps;
  const { repCount } = autoRepCount(totalCalls, daysElapsed, inputs.numReps);
  const reps = generateReps(closes, avgDeal, installmentPct, showRate, closeRate, repCount);
  const { trendCloses, trendCash } = generateTrends(closes, avgDeal, dayOfMonth);
  return {
    agencyName: inputs.agencyName || DEFAULT.agencyName,
    clientName: inputs.clientName || DEFAULT.clientName,
    monthlyGoal, currentCash: newCash, installments, totalCalls, showUps, noShows,
    closes, avgDeal, showRate: Math.round(showRate), closeRate: Math.round(closeRate),
    dayOfMonth, totalDaysInMonth, reps, trendCloses, trendCash,
    month: inputs.month || "March", year: parseInt(inputs.year) || 2026,
  };
}

function encodeData(d: DashData): string { try { return btoa(encodeURIComponent(JSON.stringify(d))); } catch { return ""; } }
function decodeData(s: string): DashData | null { try { return { ...DEFAULT, ...JSON.parse(decodeURIComponent(atob(s))) }; } catch { return null; } }
function loadData(): DashData {
  const params = new URLSearchParams(window.location.search);
  const shared = params.get("d");
  if (shared) { const d = decodeData(shared); if (d) return d; }
  try { const v = localStorage.getItem(STORAGE_KEY); return v ? { ...DEFAULT, ...JSON.parse(v) } : DEFAULT; } catch { return DEFAULT; }
}
function saveData(d: DashData) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }
function loadLogo(): string { try { return localStorage.getItem(LOGO_KEY) || ""; } catch { return ""; } }
function saveLogo(v: string) { try { localStorage.setItem(LOGO_KEY, v); } catch {} }
function money(n: number) { return "$" + Math.round(n).toLocaleString("en-US"); }
function pct(a: number, b: number) { return b ? Math.round((a / b) * 100) : 0; }
function num(v: string) { const n = parseFloat(v.replace(/[^0-9.-]/g, "")); return isNaN(n) ? 0 : n; }

function Bar({ value, max, color = GREEN, h = 3 }: { value: number; max: number; color?: string; h?: number }) {
  const w = max ? Math.min((value / max) * 100, 100) : 0;
  return <div style={{ height: h, background: "#181818", borderRadius: 999, overflow: "hidden" }}><div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 999, transition: "width 0.7s ease" }} /></div>;
}

function SparkBars({ data, color = GREEN }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 40 }}>
      {data.map((v, i) => <div key={i} style={{ flex: 1, background: i === data.length - 1 ? color : color + "33", borderRadius: 3, height: `${Math.max((v / max) * 100, 5)}%` }} />)}
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ fontSize: 9, color: WHITE, letterSpacing: "0.14em", fontFamily: "'DM Mono'", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: color || WHITE, letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: WHITE, marginTop: 6, fontFamily: "'DM Mono'" }}>{sub}</div>}
    </div>
  );
}

function CalcField({ label, value, onChange, prefix = "", suffix = "", hint = "", placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; hint?: string; placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ fontSize: 8, color: "#888", letterSpacing: "0.12em", fontFamily: "'DM Mono'" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {prefix && <span style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono'" }}>{prefix}</span>}
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ background: "#080808", border: `1px solid ${GREEN}55`, color: WHITE, borderRadius: 7, padding: "8px 12px", fontSize: 13, fontFamily: "'DM Mono'", outline: "none", width: "100%", fontWeight: 500 }}
          onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.boxShadow = `0 0 0 2px ${GREEN}18`; }}
          onBlur={e => { e.target.style.borderColor = GREEN + "55"; e.target.style.boxShadow = "none"; }} />
        {suffix && <span style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono'" }}>{suffix}</span>}
      </div>
      {hint && <div style={{ fontSize: 8, color: "#444", fontFamily: "'DM Mono'" }}>{hint}</div>}
    </div>
  );
}

function EditField({ label, value, onChange, prefix = "", wide = false, small = false }: {
  label: string; value: string | number; onChange: (v: string) => void;
  prefix?: string; wide?: boolean; small?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 8, color: "#666", letterSpacing: "0.12em", fontFamily: "'DM Mono'" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {prefix && <span style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono'" }}>{prefix}</span>}
        <input value={value} onChange={e => onChange(e.target.value)}
          style={{ background: "#0a0a0a", border: `1px solid ${GREEN}33`, color: WHITE, borderRadius: 6, padding: "6px 10px", fontSize: 11, fontFamily: "'DM Mono'", outline: "none", width: wide ? "100%" : small ? "70px" : "90px" }}
          onFocus={e => e.target.style.borderColor = GREEN}
          onBlur={e => e.target.style.borderColor = GREEN + "33"} />
      </div>
    </div>
  );
}

export default function ReserveDemoDashboard() {
  const [data, setData] = useState<DashData>(loadData);
  const [calcInputs, setCalcInputs] = useState<CalcInputs>(DEFAULT_CALC);
  const [logo, setLogo] = useState<string>(loadLogo);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"calculator"|"manual">("calculator");
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState(""); const [toastVisible, setToastVisible] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = FONT_URL;
    document.head.appendChild(link);
  }, []);
  useEffect(() => { saveData(data); }, [data]);
  useEffect(() => { saveLogo(logo); }, [logo]);
  useEffect(() => {
    const handler = () => { if (!document.fullscreenElement) setFullscreen(false); };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setFullscreen(true)).catch(() => setFullscreen(true));
    } else { document.exitFullscreen().then(() => setFullscreen(false)); }
  }

  function showToast(msg: string) {
    setToast(msg); setToastVisible(true);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToastVisible(false), 2800);
  }

  function updateCalc(patch: Partial<CalcInputs>) { setCalcInputs(c => ({ ...c, ...patch })); }

  const liveRepPreview = (() => {
    const sr = parseFloat(calcInputs.showRate) || 70;
    const cr = parseFloat(calcInputs.closeRate) || 25;
    const tc = parseFloat(calcInputs.totalCash) || 0;
    const ip = parseFloat(calcInputs.installmentPct) || 13;
    const ad = parseFloat(calcInputs.avgDeal) || 6000;
    const day = parseInt(calcInputs.dayOfMonth) || 15;
    const daysElapsed = Math.max(day - 1, 1);
    const nc = tc * (1 - ip / 100);
    const closes = Math.round(nc / ad);
    const shows = Math.round(closes / (cr / 100));
    const calls = Math.round(shows / (sr / 100));
    return autoRepCount(calls, daysElapsed, calcInputs.numReps);
  })();

  function runCalculate() {
    const updatedInputs = { ...calcInputs, numReps: String(liveRepPreview.repCount) };
    setCalcInputs(updatedInputs);
    const result = calculate(updatedInputs);
    setData(result);
    showToast(`Dashboard generated — ${liveRepPreview.repCount} reps @ ${liveRepPreview.callsPerRepPerDay} calls/day`);
  }

  function update(patch: Partial<DashData>) { setData(d => ({ ...d, ...patch })); }
  function updateRep(i: number, patch: Partial<RepData>) { setData(d => { const reps = [...d.reps]; reps[i] = { ...reps[i], ...patch }; return { ...d, reps }; }); }
  function addRep() { setData(d => ({ ...d, reps: [...d.reps, { name: "New Rep", calls: 0, shows: 0, closes: 0, revenue: 0, installment: 0, tier: "mid" }] })); }
  function removeRep(i: number) { setData(d => ({ ...d, reps: d.reps.filter((_, idx) => idx !== i) })); }

  function handleShareLink() {
    const encoded = encodeData(data);
    const url = `${window.location.origin}${window.location.pathname}?d=${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true); showToast("Share link copied to clipboard");
      setTimeout(() => setCopySuccess(false), 3000);
    }).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = url; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      setCopySuccess(true); showToast("Share link copied to clipboard");
      setTimeout(() => setCopySuccess(false), 3000);
    });
  }

  const handleLogoFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { showToast("Please upload an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { showToast("Image must be under 2MB"); return; }
    const reader = new FileReader();
    reader.onload = e => { const result = e.target?.result as string; setLogo(result); showToast("Logo uploaded"); };
    reader.readAsDataURL(file);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0]; if (file) handleLogoFile(file);
  }

  function resetAll() {
    if (confirm("Reset everything to demo defaults?")) {
      setData(DEFAULT); setCalcInputs(DEFAULT_CALC); setLogo("");
      showToast("Reset to defaults");
    }
  }

  const totalCash = data.currentCash + data.installments;
  const monthPct = pct(totalCash, data.monthlyGoal);
  const showRate = data.showRate || pct(data.showUps, data.totalCalls);
  const closeRate = data.closeRate || pct(data.closes, data.showUps);
  const daysElapsed = Math.max(data.dayOfMonth - 1, 1);
  const daysRemaining = Math.max(data.totalDaysInMonth - data.dayOfMonth + 1, 1);
  const dailyActual = totalCash / daysElapsed;
  const dailyNeeded = (data.monthlyGoal - totalCash) / daysRemaining;
  const projectedEOM = Math.round(totalCash + dailyActual * daysRemaining);
  const expectedByNow = (data.monthlyGoal / data.totalDaysInMonth) * data.dayOfMonth;
  const pacingPct = Math.round((totalCash / expectedByNow) * 100);
  const isAhead = pacingPct >= 100;
  const closesPerDay = (data.closes / daysElapsed).toFixed(1);
  const closesPerDayNeeded = Math.ceil((data.monthlyGoal - totalCash) / data.avgDeal / daysRemaining);
  const callsPerClose = data.closes > 0 ? (data.totalCalls / data.closes).toFixed(1) : "—";
  const closesNeeded = Math.max(0, Math.ceil((data.monthlyGoal - totalCash) / data.avgDeal));
  const maxRepRev = Math.max(...data.reps.map(r => r.revenue + r.installment), 1);
  const tierColor = (t: string) => t === "top" ? GREEN : t === "mid" ? YELLOW : "#666";
  const tierLabel = (t: string) => t === "top" ? "TOP" : t === "mid" ? "AVG" : "LOW";

  const btnStyle = (active = false, danger = false): React.CSSProperties => ({
    background: active ? WHITE : "transparent",
    border: `1px solid ${danger ? RED + "44" : active ? WHITE : BORDER}`,
    color: active ? BG : danger ? RED : WHITE,
    borderRadius: 6, padding: "4px 12px", fontSize: 9, cursor: "pointer",
    fontFamily: "'DM Mono'", letterSpacing: "0.1em", fontWeight: active ? 700 : 400, transition: "all 0.15s",
  });

  // Live preview values
  const prevSr = parseFloat(calcInputs.showRate)||70, prevCr = parseFloat(calcInputs.closeRate)||25;
  const prevTc = parseFloat(calcInputs.totalCash)||0, prevIp = parseFloat(calcInputs.installmentPct)||13;
  const prevAd = parseFloat(calcInputs.avgDeal)||6000;
  const prevCloses = Math.round(prevTc*(1-prevIp/100)/prevAd);
  const prevShows = Math.round(prevCloses/(prevCr/100));
  const prevCalls = Math.round(prevShows/(prevSr/100));

  return (
    <div ref={containerRef} style={{ fontFamily: "'DM Mono', monospace", background: BG, minHeight: "100vh", color: WHITE, position: fullscreen ? "fixed" : "relative", inset: fullscreen ? 0 : "auto", zIndex: fullscreen ? 9999 : "auto", overflowY: "auto" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes up { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 ${GREEN}44} 70%{box-shadow:0 0 0 8px transparent} }
        .fade { animation: up 0.35s ease both; }
        input::placeholder { color: #333; }
        .logo-drop:hover { border-color: ${GREEN}88 !important; }
      `}</style>

      <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 99999, transition: "all 0.3s ease", opacity: toastVisible ? 1 : 0, transform: toastVisible ? "translateY(0)" : "translateY(14px)", pointerEvents: "none" }}>
        <div style={{ background: GREEN, color: BG, borderRadius: 8, padding: "11px 20px", fontSize: 11, fontFamily: "'DM Mono'", fontWeight: 700, letterSpacing: "0.08em", boxShadow: `0 4px 24px ${GREEN}55` }}>✓ {toast}</div>
      </div>

      <nav style={{ borderBottom: `1px solid ${BORDER}`, height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", position: "sticky", top: 0, zIndex: 50, background: "rgba(0,0,0,0.97)", backdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {logo ? (
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <img src={logo} alt="logo" style={{ height: 28, maxWidth: 120, objectFit: "contain", borderRadius: 4 }} />
              {editMode && <button onClick={() => setLogo("")} style={{ position: "absolute", top: -6, right: -6, background: RED, border: "none", borderRadius: "50%", width: 14, height: 14, fontSize: 8, cursor: "pointer", color: WHITE, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>}
            </div>
          ) : (
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN, boxShadow: `0 0 10px ${GREEN}80`, animation: "blink 2.5s ease infinite" }} />
          )}
          {editMode ? (
            <input value={data.agencyName} onChange={e => update({ agencyName: e.target.value })}
              style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.14em", background: "transparent", border: `1px solid ${GREEN}33`, borderRadius: 5, padding: "3px 8px", color: WHITE, outline: "none", width: 200 }} />
          ) : (
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.14em" }}>{data.agencyName}</span>
          )}
          <span style={{ color: BORDER }}>·</span>
          {editMode ? (
            <input value={data.clientName} onChange={e => update({ clientName: e.target.value })}
              style={{ fontSize: 9, letterSpacing: "0.14em", background: "transparent", border: `1px solid ${GREEN}33`, borderRadius: 5, padding: "3px 8px", color: WHITE, outline: "none", width: 160, fontFamily: "'DM Mono'" }} />
          ) : (
            <span style={{ fontSize: 9, color: WHITE, letterSpacing: "0.14em" }}>{data.clientName}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!editMode && (
            <>
              <button onClick={handleShareLink} style={{ ...btnStyle(copySuccess), borderColor: copySuccess ? GREEN + "88" : BORDER, color: copySuccess ? GREEN : WHITE }}>{copySuccess ? "✓ COPIED" : "⬡ SHARE LINK"}</button>
              <button onClick={toggleFullscreen} style={btnStyle(fullscreen)}>{fullscreen ? "⊡ EXIT FULLSCREEN" : "⊞ FULLSCREEN"}</button>
            </>
          )}
          {editMode && <button onClick={resetAll} style={btnStyle(false, true)}>RESET</button>}
          <button onClick={() => { setEditMode(!editMode); if (editMode) showToast("Presentation mode active"); }}
            style={{ ...btnStyle(editMode), background: editMode ? GREEN : "transparent", border: `1px solid ${editMode ? GREEN : BORDER}`, color: editMode ? BG : WHITE }}>
            {editMode ? "✓ DONE EDITING" : "✎ EDIT"}
          </button>
        </div>
      </nav>

      {editMode && (
        <div style={{ background: GREEN + "0d", borderBottom: `1px solid ${GREEN}22`, padding: "9px 24px", display: "flex", alignItems: "center", gap: 10, animation: "slideDown 0.2s ease" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, animation: "blink 1.2s ease infinite" }} />
          <span style={{ fontSize: 9, color: GREEN, letterSpacing: "0.14em" }}>EDIT MODE ACTIVE</span>
          <span style={{ fontSize: 9, color: "#444", marginLeft: 4 }}>Use the Calculator tab to auto-fill everything, or Manual tab to edit individual fields</span>
        </div>
      )}

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        {editMode && (
          <div className="fade" style={{ background: SURFACE, border: `1px solid ${GREEN}22`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: `1px solid ${BORDER}` }}>
              {(["calculator", "manual"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: "14px 20px", background: activeTab === tab ? GREEN + "10" : "transparent", border: "none", borderBottom: activeTab === tab ? `2px solid ${GREEN}` : "2px solid transparent", color: activeTab === tab ? GREEN : "#555", fontSize: 9, letterSpacing: "0.14em", cursor: "pointer", fontFamily: "'DM Mono'", fontWeight: activeTab === tab ? 700 : 400, transition: "all 0.15s" }}>
                  {tab === "calculator" ? "⚡ SMART CALCULATOR" : "✎ MANUAL EDIT"}
                </button>
              ))}
            </div>

            {activeTab === "calculator" && (
              <div style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: WHITE, fontFamily: "'Syne', sans-serif", fontWeight: 700, marginBottom: 3 }}>Enter your numbers — we'll build the whole dashboard</div>
                  <div style={{ fontSize: 9, color: "#555" }}>Rep count auto-calculates from call volume (8–10 calls/rep/day). Bell curve distribution applied automatically.</div>
                </div>

                <div
                  className="logo-drop"
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: `1px dashed ${isDragging ? GREEN : BORDER}`, borderRadius: 10, padding: "12px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: isDragging ? GREEN + "08" : "transparent", transition: "all 0.2s", width: "fit-content" }}>
                  {logo ? <img src={logo} alt="logo" style={{ height: 28, maxWidth: 120, objectFit: "contain", borderRadius: 4 }} /> : <div style={{ width: 28, height: 28, borderRadius: 6, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⬡</div>}
                  <div style={{ fontSize: 9, color: "#555", fontFamily: "'DM Mono'" }}>{logo ? "Replace logo" : "Upload logo"} · PNG/JPG/SVG</div>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
                  <CalcField label="AGENCY NAME" value={calcInputs.agencyName} onChange={v => updateCalc({ agencyName: v })} />
                  <CalcField label="CLIENT NAME" value={calcInputs.clientName} onChange={v => updateCalc({ clientName: v })} />
                  <CalcField label="MONTH" value={calcInputs.month} onChange={v => updateCalc({ month: v })} />
                  <CalcField label="YEAR" value={calcInputs.year} onChange={v => updateCalc({ year: v })} />
                </div>

                <div style={{ height: 1, background: BORDER }} />

                <div>
                  <div style={{ fontSize: 9, color: GREEN, letterSpacing: "0.14em", marginBottom: 14 }}>PERFORMANCE NUMBERS</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                    <CalcField label="TOTAL CASH COLLECTED" value={calcInputs.totalCash} onChange={v => updateCalc({ totalCash: v })} prefix="$" hint="New cash + installments combined" />
                    <CalcField label="SHOW RATE" value={calcInputs.showRate} onChange={v => updateCalc({ showRate: v })} suffix="%" hint="% of booked calls that show up" />
                    <CalcField label="CLOSE RATE" value={calcInputs.closeRate} onChange={v => updateCalc({ closeRate: v })} suffix="%" hint="% of shows that close" />
                    <CalcField label="AVG DEAL SIZE" value={calcInputs.avgDeal} onChange={v => updateCalc({ avgDeal: v })} prefix="$" hint="Average new cash per close" />
                  </div>
                </div>

                <div style={{ height: 1, background: BORDER }} />

                <div>
                  <div style={{ fontSize: 9, color: GREEN, letterSpacing: "0.14em", marginBottom: 14 }}>GOAL & TIME</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
                    <CalcField label="MONTHLY GOAL" value={calcInputs.monthlyGoal} onChange={v => updateCalc({ monthlyGoal: v })} prefix="$" />
                    <CalcField label="DAY OF MONTH" value={calcInputs.dayOfMonth} onChange={v => updateCalc({ dayOfMonth: v })} hint="Current day" />
                    <CalcField label="DAYS IN MONTH" value={calcInputs.totalDaysInMonth} onChange={v => updateCalc({ totalDaysInMonth: v })} />
                    <CalcField label="INSTALLMENT %" value={calcInputs.installmentPct} onChange={v => updateCalc({ installmentPct: v })} suffix="%" hint="% of total cash that's installments" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ fontSize: 8, color: "#888", letterSpacing: "0.12em", fontFamily: "'DM Mono'" }}>NUMBER OF REPS</div>
                      <input value={calcInputs.numReps} onChange={e => updateCalc({ numReps: e.target.value })} placeholder={String(liveRepPreview.repCount)}
                        style={{ background: "#080808", border: `1px solid ${GREEN}55`, color: WHITE, borderRadius: 7, padding: "8px 12px", fontSize: 13, fontFamily: "'DM Mono'", outline: "none", width: "100%", fontWeight: 500 }}
                        onFocus={e => { e.target.style.borderColor = GREEN; e.target.style.boxShadow = `0 0 0 2px ${GREEN}18`; }}
                        onBlur={e => { e.target.style.borderColor = GREEN + "55"; e.target.style.boxShadow = "none"; }} />
                      <div style={{ fontSize: 8, color: GREEN, fontFamily: "'DM Mono'", display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ background: GREEN + "18", border: `1px solid ${GREEN}33`, borderRadius: 4, padding: "1px 6px" }}>AUTO: {liveRepPreview.repCount}</span>
                        <span style={{ color: "#444" }}>{liveRepPreview.callsPerRepPerDay}/day</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: "#060606", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px" }}>
                  <div style={{ fontSize: 9, color: "#444", letterSpacing: "0.12em", marginBottom: 10 }}>WILL AUTO-CALCULATE →</div>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    {([
                      ["Total Calls", prevCalls],
                      ["Show Ups", prevShows],
                      ["Closes", prevCloses],
                      ["New Cash", money(Math.round(prevTc*(1-prevIp/100)))],
                      ["Installments", money(Math.round(prevTc*(prevIp/100)))],
                      [`${liveRepPreview.repCount} Reps`, `${liveRepPreview.callsPerRepPerDay} calls/rep/day`],
                    ] as [string, string|number][]).map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 8, color: "#444", letterSpacing: "0.1em", marginBottom: 3 }}>{k}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, fontFamily: "'Syne', sans-serif" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={runCalculate} style={{ background: GREEN, border: "none", color: BG, borderRadius: 9, padding: "14px 28px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Mono'", letterSpacing: "0.14em", fontWeight: 700, animation: "pulse 2s infinite", alignSelf: "flex-start" }}>
                  ⚡ GENERATE DASHBOARD
                </button>
              </div>
            )}

            {activeTab === "manual" && (
              <div style={{ padding: "24px 26px", display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ fontSize: 9, color: "#555" }}>Edit any field directly. Changes take effect immediately.</div>
                <div>
                  <div style={{ fontSize: 9, color: GREEN, letterSpacing: "0.14em", marginBottom: 14 }}>CORE NUMBERS</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
                    <EditField label="MONTHLY GOAL" value={data.monthlyGoal} onChange={v => update({ monthlyGoal: num(v) })} prefix="$" />
                    <EditField label="NEW CASH" value={data.currentCash} onChange={v => update({ currentCash: num(v) })} prefix="$" />
                    <EditField label="INSTALLMENTS" value={data.installments} onChange={v => update({ installments: num(v) })} prefix="$" />
                    <EditField label="AVG DEAL" value={data.avgDeal} onChange={v => update({ avgDeal: num(v) })} prefix="$" />
                    <EditField label="CLOSES" value={data.closes} onChange={v => update({ closes: num(v) })} />
                  </div>
                </div>
                <div style={{ height: 1, background: BORDER }} />
                <div>
                  <div style={{ fontSize: 9, color: GREEN, letterSpacing: "0.14em", marginBottom: 14 }}>CALL METRICS</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
                    <EditField label="TOTAL CALLS" value={data.totalCalls} onChange={v => update({ totalCalls: num(v) })} />
                    <EditField label="SHOW UPS" value={data.showUps} onChange={v => update({ showUps: num(v) })} />
                    <EditField label="NO SHOWS" value={data.noShows} onChange={v => update({ noShows: num(v) })} />
                    <EditField label="SHOW RATE %" value={data.showRate} onChange={v => update({ showRate: num(v) })} />
                    <EditField label="CLOSE RATE %" value={data.closeRate} onChange={v => update({ closeRate: num(v) })} />
                  </div>
                </div>
                <div style={{ height: 1, background: BORDER }} />
                <div>
                  <div style={{ fontSize: 9, color: GREEN, letterSpacing: "0.14em", marginBottom: 14 }}>TIME & LABELS</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                    <EditField label="DAY OF MONTH" value={data.dayOfMonth} onChange={v => update({ dayOfMonth: num(v) })} small />
                    <EditField label="DAYS IN MONTH" value={data.totalDaysInMonth} onChange={v => update({ totalDaysInMonth: num(v) })} small />
                    <EditField label="MONTH NAME" value={data.month} onChange={v => update({ month: v })} />
                    <EditField label="YEAR" value={data.year} onChange={v => update({ year: num(v) })} small />
                  </div>
                </div>
                <div style={{ height: 1, background: BORDER }} />
                <div>
                  <div style={{ fontSize: 9, color: GREEN, letterSpacing: "0.14em", marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
                    <span>REP DATA</span>
                    <button onClick={addRep} style={{ background: GREEN + "18", border: `1px solid ${GREEN}44`, color: GREEN, borderRadius: 6, padding: "4px 12px", fontSize: 9, cursor: "pointer", fontFamily: "'DM Mono'" }}>+ ADD REP</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {data.reps.map((rep, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 70px repeat(5,1fr) 28px", gap: 10, alignItems: "end", padding: "12px 14px", background: "#070707", borderRadius: 8, border: `1px solid ${BORDER}` }}>
                        <EditField label="NAME" value={rep.name} onChange={v => updateRep(i, { name: v })} wide />
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 8, color: "#666", letterSpacing: "0.1em" }}>TIER</div>
                          <select value={rep.tier} onChange={e => updateRep(i, { tier: e.target.value as "top"|"mid"|"low" })}
                            style={{ background: "#0a0a0a", border: `1px solid ${tierColor(rep.tier)}44`, color: tierColor(rep.tier), borderRadius: 6, padding: "6px 8px", fontSize: 10, fontFamily: "'DM Mono'", outline: "none", cursor: "pointer" }}>
                            <option value="top">TOP</option>
                            <option value="mid">AVG</option>
                            <option value="low">LOW</option>
                          </select>
                        </div>
                        <EditField label="CALLS" value={rep.calls} onChange={v => updateRep(i, { calls: num(v) })} />
                        <EditField label="SHOWS" value={rep.shows} onChange={v => updateRep(i, { shows: num(v) })} />
                        <EditField label="CLOSES" value={rep.closes} onChange={v => updateRep(i, { closes: num(v) })} />
                        <EditField label="NEW CASH $" value={rep.revenue} onChange={v => updateRep(i, { revenue: num(v) })} />
                        <EditField label="INSTALLMENT $" value={rep.installment} onChange={v => updateRep(i, { installment: num(v) })} />
                        <button onClick={() => removeRep(i)} style={{ background: "transparent", border: `1px solid ${RED}22`, color: RED, borderRadius: 5, padding: "6px 4px", fontSize: 10, cursor: "pointer", height: 32 }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GOAL CARD */}
        <div className="fade" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "22px 26px", position: "relative", overflow: "hidden", animationDelay: "0.04s" }}>
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `linear-gradient(90deg, ${monthPct >= 50 ? GREEN : RED}0A 0%, transparent 55%)`, width: `${monthPct}%`, transition: "width 1.2s ease" }} />
          <div style={{ position: "relative", display: "flex", gap: 36, alignItems: "center" }}>
            <div style={{ minWidth: 200 }}>
              <div style={{ fontSize: 9, color: WHITE, letterSpacing: "0.14em", marginBottom: 5 }}>TOTAL CASH — {data.month.toUpperCase()} {data.year}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: WHITE }}>{money(totalCash)}</div>
              <div style={{ fontSize: 10, color: WHITE, marginTop: 5 }}>of {money(data.monthlyGoal)} monthly goal</div>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <div><div style={{ fontSize: 8, color: "#555", letterSpacing: "0.1em", marginBottom: 2 }}>NEW CASH</div><div style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>{money(data.currentCash)}</div></div>
                <div><div style={{ fontSize: 8, color: "#555", letterSpacing: "0.1em", marginBottom: 2 }}>INSTALLMENTS</div><div style={{ fontSize: 13, fontWeight: 700, color: WHITE }}>{money(data.installments)}</div></div>
              </div>
            </div>
            <div style={{ width: 1, height: 72, background: BORDER, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 9, color: WHITE, letterSpacing: "0.12em" }}>TO {money(data.monthlyGoal)}/MONTH</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: monthPct >= 75 ? GREEN : monthPct >= 40 ? WHITE : RED }}>{monthPct}%</span>
              </div>
              <div style={{ height: 5, background: "#181818", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 999, width: `${Math.min(monthPct, 100)}%`, background: monthPct >= 75 ? GREEN : monthPct >= 40 ? WHITE : RED, transition: "width 1.2s ease" }} />
              </div>
              <div style={{ display: "flex", gap: 28, marginTop: 14 }}>
                {([["GAP", money(Math.max(0, data.monthlyGoal - totalCash))], ["CLOSES LEFT", closesNeeded], ["AVG DEAL", money(data.avgDeal)], ["CLOSES", data.closes]] as [string, string|number][]).map(([k, v]) => (
                  <div key={k}><div style={{ fontSize: 8, color: WHITE, letterSpacing: "0.14em", marginBottom: 3 }}>{k}</div><div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, color: WHITE }}>{v}</div></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* PACING CARD */}
        <div className="fade" style={{ background: SURFACE, border: `1px solid ${isAhead ? GREEN + "44" : RED + "44"}`, borderRadius: 14, padding: "20px 26px", animationDelay: "0.06s", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: isAhead ? GREEN : RED }} />
          <div style={{ fontSize: 8, color: WHITE, letterSpacing: "0.14em", marginBottom: 12 }}>MONTH PACING — {data.month.toUpperCase()} {data.year}</div>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <div style={{ minWidth: 160, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, paddingRight: 28, borderRight: `1px solid ${BORDER}` }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: isAhead ? GREEN + "18" : RED + "18", border: `1px solid ${isAhead ? GREEN + "55" : RED + "55"}`, borderRadius: 6, padding: "5px 10px", width: "fit-content" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: isAhead ? GREEN : RED, boxShadow: `0 0 8px ${isAhead ? GREEN : RED}` }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: isAhead ? GREEN : RED, fontFamily: "'Syne', sans-serif", letterSpacing: "0.05em" }}>{isAhead ? "AHEAD" : "BEHIND"}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: isAhead ? GREEN : RED, marginTop: 4 }}>{pacingPct}%</div>
              <div style={{ fontSize: 9, color: WHITE, letterSpacing: "0.06em" }}>of expected pace</div>
            </div>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", paddingLeft: 28 }}>
              {[
                { label: "DAYS LEFT", value: daysRemaining, sub: `of ${data.totalDaysInMonth} in month`, color: daysRemaining <= 5 ? RED : WHITE },
                { label: "MTD CASH", value: money(totalCash), sub: `day ${data.dayOfMonth} of ${data.totalDaysInMonth}`, color: WHITE },
                { label: "DAILY RUN RATE", value: money(Math.round(dailyActual)), sub: `need ${money(Math.round(dailyNeeded))}/day`, color: dailyActual >= dailyNeeded ? GREEN : RED },
                { label: "CLOSES/DAY", value: closesPerDay, sub: `need ${closesPerDayNeeded}/day`, color: parseFloat(closesPerDay) >= closesPerDayNeeded ? GREEN : RED },
                { label: "PROJ. MONTH END", value: money(projectedEOM), sub: projectedEOM >= data.monthlyGoal ? "✓ on track" : `gap: ${money(data.monthlyGoal - projectedEOM)}`, color: projectedEOM >= data.monthlyGoal ? GREEN : RED },
              ].map(({ label, value, sub, color }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", justifyContent: "center", borderRight: `1px solid ${BORDER}`, padding: "0 20px" }}>
                  <div style={{ fontSize: 8, color: WHITE, letterSpacing: "0.14em", marginBottom: 5 }}>{label}</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.01em" }}>{value}</div>
                  <div style={{ fontSize: 9, color: WHITE, marginTop: 4, letterSpacing: "0.04em" }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 8, color: WHITE, letterSpacing: "0.12em" }}>MONTH TIMELINE — DAY {data.dayOfMonth} / {data.totalDaysInMonth}</span>
              <span style={{ fontSize: 8, color: WHITE }}>calls/close: {callsPerClose}</span>
            </div>
            <div style={{ position: "relative", height: 6, background: "#181818", borderRadius: 999 }}>
              <div style={{ position: "absolute", top: -3, bottom: -3, left: `${(data.dayOfMonth / data.totalDaysInMonth) * 100}%`, width: 2, background: WHITE + "30", borderRadius: 1 }} />
              <div style={{ height: "100%", borderRadius: 999, width: `${Math.min((totalCash / data.monthlyGoal) * 100, 100)}%`, background: isAhead ? GREEN : RED, transition: "width 1s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontSize: 7, color: WHITE }}>$0</span>
              <span style={{ fontSize: 7, color: WHITE }}>{money(data.monthlyGoal / 2)}</span>
              <span style={{ fontSize: 7, color: WHITE }}>{money(data.monthlyGoal)}</span>
            </div>
          </div>
        </div>

        {/* KPI STRIP */}
        <div className="fade" style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, animationDelay: "0.08s" }}>
          <KpiCard label="TOTAL CALLS" value={data.totalCalls} sub="conducted" />
          <KpiCard label="SHOW UPS" value={data.showUps} sub={`${data.noShows} no-shows`} />
          <KpiCard label="SHOW RATE" value={showRate + "%"} sub={`${data.showUps} of ${data.totalCalls}`} color={showRate >= 70 ? GREEN : data.totalCalls > 0 ? RED : WHITE} />
          <KpiCard label="CLOSE RATE" value={closeRate + "%"} sub={`${data.closes} / ${data.showUps} shows`} color={closeRate >= 25 ? GREEN : data.showUps > 0 ? RED : WHITE} />
          <KpiCard label="NEW CASH" value={money(data.currentCash)} sub={data.month} color={GREEN} />
          <KpiCard label="INSTALLMENTS" value={money(data.installments)} sub={data.month} />
        </div>

        {/* BOTTOM GRID */}
        <div className="fade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, animationDelay: "0.12s" }}>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "20px 22px" }}>
            <div style={{ fontSize: 9, color: WHITE, letterSpacing: "0.14em", marginBottom: 18 }}>REP LEADERBOARD — {data.month.toUpperCase()}</div>
            {data.reps.length === 0 && <div style={{ fontSize: 11, color: "#444" }}>No reps — use Edit Mode to generate.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {[...data.reps].sort((a, b) => (b.revenue + b.installment) - (a.revenue + a.installment)).map((r, i) => {
                const cr = pct(r.closes, r.shows); const sr = pct(r.shows, r.calls); const repTotal = r.revenue + r.installment;
                const tc = tierColor(r.tier);
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: i === 0 ? GREEN : WHITE, fontWeight: 500 }}>#{i + 1}</span>
                        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: WHITE }}>{r.name}</span>
                        <span style={{ fontSize: 7, color: tc, border: `1px solid ${tc}44`, borderRadius: 4, padding: "1px 5px", letterSpacing: "0.1em" }}>{tierLabel(r.tier)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                        <span style={{ fontSize: 10, color: "#555" }}>{money(r.revenue)} new · {money(r.installment)} inst.</span>
                        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: i === 0 ? GREEN : WHITE }}>{money(repTotal)}</span>
                      </div>
                    </div>
                    <Bar value={repTotal} max={maxRepRev} color={i === 0 ? GREEN : "#282828"} h={3} />
                    <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                      {([{ k: "Calls", v: r.calls, c: null }, { k: "Shows", v: r.shows, c: null }, { k: "Closes", v: r.closes, c: null }, { k: "Show%", v: sr + "%", c: sr >= 70 ? GREEN : RED }, { k: "CR%", v: cr + "%", c: cr >= 25 ? GREEN : RED }] as { k: string; v: string|number; c: string|null }[]).map(({ k, v, c }) => (
                        <div key={k} style={{ fontSize: 10, color: WHITE }}>{k} <span style={{ color: c || "#999" }}>{v}</span></div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={{ fontSize: 9, color: WHITE, letterSpacing: "0.14em", marginBottom: 12 }}>DAILY CLOSES — {data.month.toUpperCase()}</div>
              <SparkBars data={data.trendCloses} color={GREEN} />
            </div>
            <div style={{ height: 1, background: BORDER }} />
            <div>
              <div style={{ fontSize: 9, color: WHITE, letterSpacing: "0.14em", marginBottom: 12 }}>DAILY NEW CASH — {data.month.toUpperCase()}</div>
              <SparkBars data={data.trendCash} color={GREEN} />
            </div>
            <div style={{ height: 1, background: BORDER }} />
            <div>
              <div style={{ fontSize: 9, color: WHITE, letterSpacing: "0.14em", marginBottom: 12 }}>BENCHMARKS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {([
                  { label: "Closes / month", cur: data.closes, target: Math.ceil(data.monthlyGoal / data.avgDeal), u: "" },
                  { label: "Show rate", cur: showRate, target: 75, u: "%" },
                  { label: "Close rate", cur: closeRate, target: 25, u: "%" },
                ]).map(({ label, cur, target, u }) => {
                  const ok = cur >= target;
                  return (
                    <div key={label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 10, color: WHITE }}>{label}</span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: ok ? GREEN : RED }}>{cur}{u}</span>
                          <span style={{ fontSize: 10, color: "#888" }}>/ {target}{u}</span>
                        </div>
                      </div>
                      <Bar value={cur} max={target * 1.5} color={ok ? GREEN : RED} h={2} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${BORDER}`, padding: "11px 24px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 8, color: "#888", letterSpacing: "0.14em" }}>{data.agencyName.toUpperCase()} — CONFIDENTIAL</span>
        <span style={{ fontSize: 8, color: "#888", letterSpacing: "0.1em" }}>{editMode ? "● EDIT MODE" : "PRESENTATION MODE"}</span>
      </div>
    </div>
  );
}
