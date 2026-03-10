import { useState, useEffect, useRef, useCallback } from "react";

const GREEN = "#22C55E", RED = "#EF4444", WHITE = "#FFFFFF";
const BORDER = "#1E1E1E", BG = "#000000", SURFACE = "#0C0C0C";
const FONT_URL = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap";
const STORAGE_KEY = "reserve_demo_v2";
const LOGO_KEY = "reserve_demo_logo_v2";

interface RepData { name: string; calls: number; shows: number; closes: number; revenue: number; installment: number; }
interface DashData {
  agencyName: string; clientName: string; monthlyGoal: number; currentCash: number;
  installments: number; totalCalls: number; showUps: number; noShows: number;
  closes: number; avgDeal: number; dayOfMonth: number; totalDaysInMonth: number;
  reps: RepData[]; trendCloses: number[]; trendCash: number[]; month: string; year: number;
}

const DEFAULT: DashData = {
  agencyName: "Apex Media Group", clientName: "Jordan Williams",
  monthlyGoal: 110000, currentCash: 78400, installments: 12000,
  totalCalls: 142, showUps: 98, noShows: 44, closes: 18, avgDeal: 6000,
  dayOfMonth: 21, totalDaysInMonth: 31,
  reps: [
    { name: "Marcus", calls: 58, shows: 42, closes: 9, revenue: 38400, installment: 6000 },
    { name: "Devon", calls: 47, shows: 31, closes: 6, revenue: 24000, installment: 4000 },
    { name: "Kayla", calls: 37, shows: 25, closes: 3, revenue: 16000, installment: 2000 },
  ],
  trendCloses: [1,2,1,3,2,1,2,2,3,1],
  trendCash: [6000,12000,6000,18000,12000,6000,12000,12000,18000,6000],
  month: "March", year: 2026,
};

function encodeData(d: DashData): string {
  try { return btoa(encodeURIComponent(JSON.stringify(d))); } catch { return ""; }
}
function decodeData(s: string): DashData | null {
  try { return { ...DEFAULT, ...JSON.parse(decodeURIComponent(atob(s))) }; } catch { return null; }
}
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
      {data.map((v, i) => <div key={i} style={{ flex: 1, background: i === data.length - 1 ? color : color + "33", borderRadius: 3, height: `${Math.max((v / max) * 100, 5)}%`, transition: "height 0.5s ease" }} />)}
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

function EditField({ label, value, onChange, prefix = "", type = "text", wide = false, small = false }: {
  label: string; value: string | number; onChange: (v: string) => void;
  prefix?: string; type?: string; wide?: boolean; small?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 8, color: "#666", letterSpacing: "0.12em", fontFamily: "'DM Mono'" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {prefix && <span style={{ fontSize: 11, color: "#555", fontFamily: "'DM Mono'" }}>{prefix}</span>}
        <input value={value} onChange={e => onChange(e.target.value)} type={type}
          style={{ background: "#0a0a0a", border: `1px solid ${GREEN}44`, color: WHITE, borderRadius: 6, padding: "6px 10px", fontSize: 11, fontFamily: "'DM Mono'", outline: "none", width: wide ? "100%" : small ? "70px" : "90px" }}
          onFocus={e => e.target.style.borderColor = GREEN}
          onBlur={e => e.target.style.borderColor = GREEN + "44"} />
      </div>
    </div>
  );
}

function TrendEditor({ label, values, onChange }: { label: string; values: number[]; onChange: (v: number[]) => void }) {
  return (
    <div>
      <div style={{ fontSize: 8, color: "#666", letterSpacing: "0.12em", fontFamily: "'DM Mono'", marginBottom: 6 }}>{label} (10 values, comma separated)</div>
      <input value={values.join(",")} onChange={e => onChange(e.target.value.split(",").map(v => num(v.trim())).slice(0, 10))}
        style={{ background: "#0a0a0a", border: `1px solid ${GREEN}44`, color: WHITE, borderRadius: 6, padding: "6px 10px", fontSize: 11, fontFamily: "'DM Mono'", outline: "none", width: "100%" }} />
    </div>
  );
}

export default function ReserveDemoDashboard() {
  const [data, setData] = useState<DashData>(loadData);
  const [logo, setLogo] = useState<string>(loadLogo);
  const [editMode, setEditMode] = useState(false);
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
    } else {
      document.exitFullscreen().then(() => setFullscreen(false));
    }
  }

  function showToast(msg: string) {
    setToast(msg); setToastVisible(true);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToastVisible(false), 2800);
  }

  function update(patch: Partial<DashData>) { setData(d => ({ ...d, ...patch })); }
  function updateRep(i: number, patch: Partial<RepData>) { setData(d => { const reps = [...d.reps]; reps[i] = { ...reps[i], ...patch }; return { ...d, reps }; }); }
  function addRep() { setData(d => ({ ...d, reps: [...d.reps, { name: "New Rep", calls: 0, shows: 0, closes: 0, revenue: 0, installment: 0 }] })); }
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

  function resetAll() { if (confirm("Reset everything to demo defaults?")) { setData(DEFAULT); setLogo(""); showToast("Reset to defaults"); } }

  const totalCash = data.currentCash + data.installments;
  const monthPct = pct(totalCash, data.monthlyGoal);
  const showRate = pct(data.showUps, data.totalCalls);
  const closeRate = pct(data.closes, data.showUps);
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

  const btnStyle = (active = false, danger = false): React.CSSProperties => ({
    background: active ? WHITE : "transparent",
    border: `1px solid ${danger ? RED + "44" : active ? WHITE : BORDER}`,
    color: active ? BG : danger ? RED : WHITE,
    borderRadius: 6, padding: "4px 12px", fontSize: 9, cursor: "pointer",
    fontFamily: "'DM Mono'", letterSpacing: "0.1em", fontWeight: active ? 700 : 400,
    transition: "all 0.15s",
  });

  return (
    <div ref={containerRef} style={{ fontFamily: "'DM Mono', monospace", background: BG, minHeight: "100vh", color: WHITE, position: fullscreen ? "fixed" : "relative", inset: fullscreen ? 0 : "auto", zIndex: fullscreen ? 9999 : "auto", overflowY: "auto" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes up { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
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
          <span style={{ fontSize: 9, color: "#444", marginLeft: 4 }}>All changes save to your browser automatically · Click DONE EDITING to present</span>
        </div>
      )}

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {editMode && (
          <div className="fade" style={{ background: SURFACE, border: `1px solid ${GREEN}22`, borderRadius: 14, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontSize: 9, color: GREEN, letterSpacing: "0.14em", marginBottom: 14 }}>LOGO</div>
              <div className="logo-drop" onDragOver={e => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
                style={{ border: `1px dashed ${isDragging ? GREEN : BORDER}`, borderRadius: 10, padding: "18px 24px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, background: isDragging ? GREEN + "08" : "transparent", transition: "all 0.2s", width: "fit-content" }}>
                {logo ? <img src={logo} alt="logo" style={{ height: 36, maxWidth: 140, objectFit: "contain", borderRadius: 4 }} /> : <div style={{ width: 36, height: 36, borderRadius: 8, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⬡</div>}
                <div>
                  <div style={{ fontSize: 10, color: WHITE, fontFamily: "'DM Mono'", marginBottom: 3 }}>{logo ? "Click or drag to replace logo" : "Click or drag to upload logo"}</div>
                  <div style={{ fontSize: 9, color: "#555", fontFamily: "'DM Mono'" }}>PNG, JPG, SVG · max 2MB</div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }} />
              </div>
            </div>
            <div style={{ height: 1, background: BORDER }} />
            <div>
              <div style={{ fontSize: 9, color: GREEN, letterSpacing: "0.14em", marginBottom: 14 }}>CORE NUMBERS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 14 }}>
                <EditField label="MONTHLY GOAL" value={data.monthlyGoal} onChange={v => update({ monthlyGoal: num(v) })} prefix="$" />
                <EditField label="NEW CASH" value={data.currentCash} onChange={v => update({ currentCash: num(v) })} prefix="$" />
                <EditField label="INSTALLMENTS" value={data.installments} onChange={v => update({ installments: num(v) })} prefix="$" />
                <EditField label="AVG DEAL" value={data.avgDeal} onChange={v => update({ avgDeal: num(v) })} prefix="$" />
                <EditField label="TOTAL CALLS" value={data.totalCalls} onChange={v => update({ totalCalls: num(v) })} />
                <EditField label="SHOW UPS" value={data.showUps} onChange={v => update({ showUps: num(v) })} />
                <EditField label="NO SHOWS" value={data.noShows} onChange={v => update({ noShows: num(v) })} />
                <EditField label="CLOSES" value={data.closes} onChange={v => update({ closes: num(v) })} />
              </div>
            </div>
            <div style={{ height: 1, background: BORDER }} />
            <div>
              <div style={{ fontSize: 9, color: GREEN, letterSpacing: "0.14em", marginBottom: 14 }}>TIME & LABELS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
                <EditField label="DAY OF MONTH" value={data.dayOfMonth} onChange={v => update({ dayOfMonth: num(v) })} small />
                <EditField label="DAYS IN MONTH" value={data.totalDaysInMonth} onChange={v => update({ totalDaysInMonth: num(v) })} small />
                <EditField label="MONTH NAME" value={data.month} onChange={v => update({ month: v })} />
                <EditField label="YEAR" value={data.year} onChange={v => update({ year: num(v) })} small />
              </div>
            </div>
            <div style={{ height: 1, background: BORDER }} />
            <div>
              <div style={{ fontSize: 9, color: GREEN, letterSpacing: "0.14em", marginBottom: 14 }}>TREND CHARTS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <TrendEditor label="DAILY CLOSES" values={data.trendCloses} onChange={v => update({ trendCloses: v })} />
                <TrendEditor label="DAILY CASH ($)" values={data.trendCash} onChange={v => update({ trendCash: v })} />
              </div>
            </div>
            <div style={{ height: 1, background: BORDER }} />
            <div>
              <div style={{ fontSize: 9, color: GREEN, letterSpacing: "0.14em", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>REP DATA</span>
                <button onClick={addRep} style={{ background: GREEN + "18", border: `1px solid ${GREEN}44`, color: GREEN, borderRadius: 6, padding: "4px 12px", fontSize: 9, cursor: "pointer", fontFamily: "'DM Mono'", letterSpacing: "0.08em" }}>+ ADD REP</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.reps.map((rep, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "170px repeat(5,1fr) 28px", gap: 10, alignItems: "end", padding: "12px 14px", background: "#070707", borderRadius: 8, border: `1px solid ${BORDER}` }}>
                    <EditField label="REP NAME" value={rep.name} onChange={v => updateRep(i, { name: v })} wide />
                    <EditField label="CALLS" value={rep.calls} onChange={v => updateRep(i, { calls: num(v) })} />
                    <EditField label="SHOWS" value={rep.shows} onChange={v => updateRep(i, { shows: num(v) })} />
                    <EditField label="CLOSES" value={rep.closes} onChange={v => updateRep(i, { closes: num(v) })} />
                    <EditField label="NEW CASH $" value={rep.revenue} onChange={v => updateRep(i, { revenue: num(v) })} />
                    <EditField label="INSTALLMENT $" value={rep.installment} onChange={v => updateRep(i, { installment: num(v) })} />
                    <button onClick={() => removeRep(i)} style={{ background: "transparent", border: `1px solid ${RED}22`, color: RED, borderRadius: 5, padding: "6px 4px", fontSize: 10, cursor: "pointer", height: 32, marginBottom: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
                {([["GAP", money(Math.max(0, data.monthlyGoal - totalCash))], ["CLOSES LEFT", closesNeeded], ["AVG DEAL", money(data.avgDeal)], ["CLOSES", data.closes]] as [string, string | number][]).map(([k, v]) => (
                  <div key={k}><div style={{ fontSize: 8, color: WHITE, letterSpacing: "0.14em", marginBottom: 3 }}>{k}</div><div style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, color: WHITE }}>{v}</div></div>
                ))}
              </div>
            </div>
          </div>
        </div>

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

        <div className="fade" style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, animationDelay: "0.08s" }}>
          <KpiCard label="TOTAL CALLS" value={data.totalCalls} sub="conducted" />
          <KpiCard label="SHOW UPS" value={data.showUps} sub={`${data.noShows} no-shows`} />
          <KpiCard label="SHOW RATE" value={showRate + "%"} sub={`${data.showUps} of ${data.totalCalls}`} color={showRate >= 70 ? GREEN : data.totalCalls > 0 ? RED : WHITE} />
          <KpiCard label="CLOSE RATE" value={closeRate + "%"} sub={`${data.closes} / ${data.showUps} shows`} color={closeRate >= 25 ? GREEN : data.showUps > 0 ? RED : WHITE} />
          <KpiCard label="NEW CASH" value={money(data.currentCash)} sub={data.month} color={GREEN} />
          <KpiCard label="INSTALLMENTS" value={money(data.installments)} sub={data.month} />
        </div>

        <div className="fade" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, animationDelay: "0.12s" }}>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "20px 22px" }}>
            <div style={{ fontSize: 9, color: WHITE, letterSpacing: "0.14em", marginBottom: 18 }}>REP LEADERBOARD — {data.month.toUpperCase()}</div>
            {data.reps.length === 0 && <div style={{ fontSize: 11, color: "#444" }}>No reps added yet — use Edit Mode to add.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {[...data.reps].sort((a, b) => (b.revenue + b.installment) - (a.revenue + a.installment)).map((r, i) => {
                const cr = pct(r.closes, r.shows); const sr = pct(r.shows, r.calls); const repTotal = r.revenue + r.installment;
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: i === 0 ? GREEN : WHITE, fontWeight: 500 }}>#{i + 1}</span>
                        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, color: WHITE }}>{r.name}</span>
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                        <span style={{ fontSize: 10, color: "#555" }}>{money(r.revenue)} new · {money(r.installment)} inst.</span>
                        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16, color: i === 0 ? GREEN : WHITE }}>{money(repTotal)}</span>
                      </div>
                    </div>
                    <Bar value={repTotal} max={maxRepRev} color={i === 0 ? GREEN : "#282828"} h={3} />
                    <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                      {([{ k: "Calls", v: r.calls, c: null }, { k: "Shows", v: r.shows, c: null }, { k: "Closes", v: r.closes, c: null }, { k: "Show%", v: sr + "%", c: sr >= 70 ? GREEN : RED }, { k: "CR%", v: cr + "%", c: cr >= 25 ? GREEN : RED }] as { k: string; v: string | number; c: string | null }[]).map(({ k, v, c }) => (
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
