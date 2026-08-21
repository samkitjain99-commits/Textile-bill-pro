import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, BarChart3, Calendar as CalendarIcon, Camera, Check, ChevronDown, ChevronUp, Clock, Download, Edit2, Eye, FileText, Filter, IndianRupee, Key, Landmark, LogOut, PieChart, Plus, Printer, Save, Search, Share2, Trash2, TrendingDown, TrendingUp, Upload, UserPlus, Users, X,
} from "lucide-react";

// Shared foundations used by the main app and by the lazily-loaded
// Dashboard and Data Analytics tabs. Anything both sides need — design
// tokens, formatters, the units registry, and small shared UI pieces —
// lives here, so neither side imports the other (which would defeat the
// code split by pulling the whole app back into that chunk).

const ink = "#1E2A44";      // deep indigo — headers, primary text

const inkSoft = "#4A5D8A";  // secondary indigo

const muted = "#8A8272";

const card = "#FFFFFF";

const paper = "#F6F3EC";    // warm parchment background

const hairline = "#E4DFD3";

const thread = "#DB9A3C";   // saffron — accent / primary action

const success = "#3F7D5C";

const danger = "#B5482F";

const inputStyle = { border: `1px solid ${hairline}`, color: ink, background: "#fff" };

const DEFAULT_UNITS = [
  { id: "u-yards", name: "Yards", abbr: "Yd", count: false },
  { id: "u-meter", name: "Meter", abbr: "Mtr", count: false },
  { id: "u-pcs", name: "Pcs", abbr: "pcs", count: true },
  { id: "u-gagra", name: "Gagra", abbr: "Gg", count: false },
  { id: "u-rida", name: "Rida", abbr: "Rd", count: false },
  { id: "u-rolls", name: "Rolls", abbr: "Rol", count: true },
];

// One-time cleanup for books saved before Gagra/Rida/Pcs/Rolls had short
// abbreviations — their `units` list already has the old values baked in
// (e.g. "Gagra" as its own abbreviation), so updating DEFAULT_UNITS alone
// doesn't reach existing companies. This only touches the built-in unit IDs,
// and only when the abbreviation still exactly matches the old default — a
// unit the person renamed themselves is left alone.
const STALE_BUILTIN_ABBR = { "u-pcs": "Pcs", "u-gagra": "Gagra", "u-rida": "Rida", "u-rolls": "Roll" };
function migrateUnitAbbrs(units) {
  const byId = Object.fromEntries(DEFAULT_UNITS.map((u) => [u.id, u.abbr]));
  return units.map((u) =>
    STALE_BUILTIN_ABBR[u.id] === u.abbr ? { ...u, abbr: byId[u.id] } : u
  );
}

let UNIT_LIST = DEFAULT_UNITS.slice();

let UNIT_OPTIONS = UNIT_LIST.map((u) => u.name);

let UNIT_ABBR = Object.fromEntries(UNIT_LIST.map((u) => [u.name, u.abbr]));

let COUNT_UNITS = new Set(UNIT_LIST.filter((u) => u.count).map((u) => u.name));

function applyUnits(list) {
  UNIT_LIST = (Array.isArray(list) && list.length ? list : DEFAULT_UNITS).slice();
  UNIT_OPTIONS = UNIT_LIST.map((u) => u.name);
  UNIT_ABBR = Object.fromEntries(UNIT_LIST.map((u) => [u.name, u.abbr || u.name]));
  COUNT_UNITS = new Set(UNIT_LIST.filter((u) => u.count).map((u) => u.name));
}

const toLocalISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fmtMoney = (n) =>
  "₹" + (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const fmtNum = (n) => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function fmtMoneyCompact(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(abs % 1e3 === 0 ? 0 : 1)}k`;
  return `${sign}${Math.round(abs)}`;
}

function parseDateFlexible(v) {
  if (v instanceof Date) return v;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  // YYYY-MM-DD (optionally with time)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // DD/MM/YYYY or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  // DD/MM/YY or DD-MM-YY (2-digit year assumed 2000s)
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (m) return new Date(2000 + Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeDate(v) {
  const d = parseDateFlexible(v);
  return d && !isNaN(d.getTime()) ? toLocalISO(d) : "";
}

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = parseDateFlexible(iso);
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtDateShort = (iso) => {
  if (!iso) return "";
  const d = parseDateFlexible(iso);
  if (!d || isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const todayISO = () => toLocalISO(new Date());

function csvEscape(v) {
  const str = String(v ?? "");
  return /[",\n\r]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

function downloadCsv(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const isCountUnit = (unit) => COUNT_UNITS.has(unit);

const isCancelledItem = (it) => !!it?.cancelled;

function lineAmount(it) {
  if (isCancelledItem(it)) return 0;
  const qty = Number(it.qty) || 0;
  const rate = Number(it.rate) || 0;
  const size = isCountUnit(it.unit) ? 1 : Number(it.size) || 0;
  return qty * rate * size;
}

function purchaseTotal(p) {
  const amt = Number(p.amount) || 0;
  if (amt > 0) return amt;
  if (Array.isArray(p.items) && p.items.length) {
    const items = p.items.reduce((s, it) => s + lineAmount(it), 0);
    // `amount` is normally authoritative and already includes other expenses;
    // this fallback only runs for records without it, so expenses are added
    // here too rather than being silently dropped.
    const expenses = (p.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return items + expenses;
  }
  return 0;
}

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function buildFYMonths(from, to) {
  if (!from || !to) return [];
  const months = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [ey, em] = to.slice(0, 7).split("-").map(Number);
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard++ < 60) {
    months.push({ key: `${y}-${String(m).padStart(2, "0")}`, label: `${MONTH_NAMES_SHORT[m - 1]} ${y}` });
    m++; if (m > 12) { m = 1; y++; }
  }
  return months;
}

function paymentAccountLabel(p) {
  const bankEligible = p.mode === "Bank" || p.mode === "Cheque";
  return bankEligible ? (p.bankName || p.mode) : (p.mode || "Cash");
}

function receiptAccountLabel(r) {
  return r.mode === "Bank" ? (r.bankName || "Bank") : r.mode;
}

function DateField({ value, onChange, className, style, placeholder = "dd/mm/yy" }) {
  const [text, setText] = useState(value ? fmtDateShort(value) : "");
  useEffect(() => { setText(value ? fmtDateShort(value) : ""); }, [value]);
  const nativeRef = useRef(null);
  // On a touch device the little calendar icon is a poor tap target, and a
  // tap on a date field nearly always means "show me a calendar" — so the
  // whole field opens the native picker (a full-size transparent date input
  // laid over it, which is far more reliable on iOS than calling
  // showPicker()). On mouse/desktop the field stays a text box you can type
  // into — much faster for backdating — with the icon as the calendar
  // affordance, so nothing is lost there.
  const touchFirst = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)")?.matches;
  const commit = (raw) => {
    const s = (raw || "").trim();
    if (!s) { onChange(""); return; }
    const iso = normalizeDate(s);
    if (iso) onChange(iso);
    else setText(value ? fmtDateShort(value) : ""); // revert if unparseable
  };
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(e.target.value); }}
        readOnly={touchFirst}
        className={className}
        style={{ ...style, width: "100%", boxSizing: "border-box", paddingRight: 30 }}
      />
      <button
        type="button"
        onClick={() => { if (nativeRef.current?.showPicker) nativeRef.current.showPicker(); else nativeRef.current?.focus(); }}
        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", color: muted, background: "transparent", padding: 0 }}
        tabIndex={-1}
        aria-label="Open calendar"
      >
        <CalendarIcon size={15} />
      </button>
      <input
        ref={nativeRef}
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={touchFirst
          ? { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }
          : { position: "absolute", right: 4, top: 0, width: 22, height: "100%", opacity: 0, pointerEvents: "none" }}
        tabIndex={-1}
        aria-label="Pick a date"
      />
    </div>
  );
}

function InlineSelect({ value, options, onChange, className, style, placeholder = "Select", disabled = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const selected = opts.find((o) => o.value === value);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        disabled={disabled}
        className={className}
        style={{ ...style, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, textAlign: "left", cursor: disabled ? "not-allowed" : "pointer", width: "100%" }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selected ? ink : muted }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={16} color={muted} style={{ flexShrink: 0 }} />
      </button>
      {open && !disabled && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
            background: "#fff", border: `1px solid ${hairline}`, borderRadius: 10,
            boxShadow: "0 8px 24px rgba(30,42,68,0.14)", maxHeight: 260, overflowY: "auto",
          }}
        >
          {opts.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="w-full text-left px-3 py-2"
              style={{ background: o.value === value ? "#FBF4E7" : "transparent", color: ink, fontSize: 13.5, fontWeight: o.value === value ? 600 : 400, borderBottom: `1px solid ${hairline}` }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchableSelect({ value, options, onChange, placeholder = "Select…", inputStyle, className }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const selectedLabel = options.find((o) => o.value === value)?.label || "";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setQuery(""); } };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()) || (o.sub || "").toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const pick = (v) => { onChange(v); setOpen(false); setQuery(""); };

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input
        type="text"
        value={open ? query : selectedLabel}
        placeholder={selectedLabel || placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
        className={className || "w-full px-3 py-2.5 rounded-lg text-sm outline-none"}
        style={{ ...inputStyle, width: "100%", boxSizing: "border-box", paddingRight: 30, color: selectedLabel && !open ? ink : undefined }}
      />
      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: muted, pointerEvents: "none" }}>
        <ChevronDown size={16} />
      </span>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 40,
            background: "#fff", border: `1px solid ${hairline}`, borderRadius: 10,
            boxShadow: "0 8px 24px rgba(30,42,68,0.14)", maxHeight: 260, overflowY: "auto",
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: "10px 12px", color: muted, fontSize: 13 }}>No matches</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o.value)}
                className="w-full text-left px-3 py-2"
                style={{
                  background: o.value === value ? "#FBF4E7" : "transparent",
                  borderBottom: `1px solid ${hairline}`,
                }}
              >
                <div style={{ color: ink, fontSize: 13.5, fontWeight: 600 }}>{o.label}</div>
                {o.sub ? <div style={{ color: muted, fontSize: 11 }}>{o.sub}</div> : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DateRangeBar({ from, to, setFrom, setTo, quickRangeDates }) {
  const [pf, setPf] = useState(from);
  const [pt, setPt] = useState(to);
  useEffect(() => { setPf(from); }, [from]);
  useEffect(() => { setPt(to); }, [to]);
  const inputStyle = { border: `1px solid ${hairline}`, color: ink, background: "#fff", minWidth: 0 };
  return (
    <div className="mb-4">
      <div className="flex items-end gap-1.5 mb-3">
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ color: muted, fontSize: 11, marginBottom: 3 }}>From</div>
          <DateField value={pf} onChange={setPf} className="px-1.5 py-2 rounded-lg text-xs outline-none" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
        </div>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ color: muted, fontSize: 11, marginBottom: 3 }}>To</div>
          <DateField value={pt} onChange={setPt} className="px-1.5 py-2 rounded-lg text-xs outline-none" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
        </div>
        <button
          onClick={() => { setFrom(pf); setTo(pt); }}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold shrink-0"
          style={{ background: ink, color: "#fff" }}
        >
          <Filter size={14} /> Filter
        </button>
        {(from || to || pf || pt) && (
          <button
            onClick={() => { setFrom(""); setTo(""); setPf(""); setPt(""); }}
            className="px-3 py-2 rounded-lg text-xs font-medium shrink-0"
            style={{ border: `1px solid ${hairline}`, color: muted, background: "#fff" }}
          >
            Clear
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[["current", "Current Month"], ["previous", "Previous Month"], ["fy", "Current Financial Year"]].map(([k, label]) => (
          <button
            key={k}
            onClick={() => { const r = quickRangeDates(k); setFrom(r.from); setTo(r.to); }}
            className="py-2 rounded-lg text-xs font-semibold"
            style={{ border: `1px solid ${hairline}`, color: inkSoft, background: card }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Shared foundations used by the main app and by the lazily-loaded
// Dashboard and Data Analytics tabs.
//
// This module exists so those two heavy tabs can live in their own files and
// be code-split out of the initial bundle. Anything both sides need — design
// tokens, formatters, the units registry, and the small shared UI pieces —
// lives here, so neither side has to import the other (which would defeat
// the split by pulling the whole app back into the chunk).

// ---------- design tokens ----------
const successBg = "#E7F1EB";
const dangerBg = "#FBEAE4";
const inputCls = "flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-sm outline-none";

const fontImport = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
`;

// ---------- units of measurement ----------



// ---------- formatters & helpers ----------


// Compact form for chart labels, where full figures would be too cramped —
// "100k" instead of "₹1,00,000".


const fmtDateTime = (ms) => {
  if (!ms) return "";
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} ${time}`;
};



function currentFYDates() {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    from: toLocalISO(new Date(startYear, 3, 1)),
    to: toLocalISO(new Date(startYear + 1, 2, 31)),
  };
}

function currentMonthDates() {
  const now = new Date();
  return {
    from: toLocalISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toLocalISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

// Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, ISO timestamps, or a Date.

// Normalize any supported date string to YYYY-MM-DD (local) for storage.


// Current calendar month as {from, to} local ISO strings — the default
// window for Sales, Purchases, Receipts, and Payments (was the full

// Indian FY (1 Apr – 31 Mar) helpers for the global year picker.
function currentFyStartYear() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}
function fyDatesFor(startYear) {
  return {
    from: toLocalISO(new Date(startYear, 3, 1)),
    to: toLocalISO(new Date(startYear + 1, 2, 31)),
  };
}
const fyLabel = (startYear) => `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;

// Years offered in the picker: every FY that actually has data, plus the
// current one and its neighbours, so a new book still has sensible choices.
function availableFyYears(collections) {
  const years = new Set();
  const cur = currentFyStartYear();
  years.add(cur);
  years.add(cur - 1);
  years.add(cur + 1);
  for (const rows of collections) {
    for (const r of rows || []) {
      const y = Number(String(r.date || "").slice(0, 4));
      const m = Number(String(r.date || "").slice(5, 7));
      if (y && m) years.add(m >= 4 ? y : y - 1);
    }
  }
  return [...years].sort((a, b) => b - a);
}
const uid = () => Math.random().toString(36).slice(2, 10);












// ---------- shared UI ----------
const InlineRow = ({ label, children }) => (
  <div className="flex items-center gap-2">
    <span style={{ width: 92, flexShrink: 0, fontSize: 13, color: muted }}>{label}</span>
    {children}
  </div>
);

function IconBtn({ children, onClick, title, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center rounded-md"
      style={{ width: 30, height: 30, color: danger ? "#B5482F" : inkSoft, background: "transparent" }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: card, border: `1px solid ${hairline}` }}>
      <div style={{ color: inkSoft, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", marginBottom: 12 }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Stitch({ color = hairline, margin = "0" }) {
  return (
    <div
      style={{
        height: 0,
        margin,
        borderTop: `2px dashed ${color}`,
        opacity: 0.9,
      }}
    />
  );
}

function SpoolBadge({ children }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-xs font-semibold"
      style={{
        width: 22,
        height: 22,
        background: thread,
        color: "#fff",
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      {children}
    </span>
  );
}






// ---------- design tokens ----------
function importedCreatedAt(dateStr, offset = 0) {
  const d = new Date(`${dateStr || todayISO()}T12:00:00`);
  const ms = isNaN(d.getTime()) ? Date.now() : d.getTime();
  return ms + offset;
}

// Prefer an explicit "Created" column from a re-imported export (round-trips
// the original creation timestamp exactly) — fall back to deriving one from
// the transaction date when the column is missing/blank/unparseable (e.g. a
// hand-built or third-party CSV that never had it).
function parseImportedCreatedAt(raw, fallbackDateStr, offset = 0) {
  if (raw) {
    const t = new Date(raw).getTime();
    if (!isNaN(t)) return t;
  }
  return importedCreatedAt(fallbackDateStr, offset);
}

// Ordered list of months (YYYY-MM key + display label) spanning a date range,
// so months with no activity still appear as zero rows in the Dashboard's
// monthly tables — matches the reference app's buildMonths().

// Legacy single-company key. Still read once, then migrated into a company.
const STORAGE_KEY = "textile-sales-data";
// Index of all companies: { companies: [{id,name,createdAt}], activeId }
const COMPANIES_KEY = "textile-bill-companies";
// Each company's books live under their own key.
const companyDataKey = (id) => `textile-sales-data:${id}`;

// ---------- FY-sharded storage ----------
// A single company's book is written across several keys instead of one:
//   :meta   -> customers, vendors, bankAccounts, counters (NOT year-scoped)
//   :fy2026 -> invoices/receipts/purchases/payments dated in FY 2026-27
// The reason is the storage backend: the localStorage shim used by the
// standalone builds caps each origin around 5 MB, and a few thousand
// invoices with line items blows past that as ONE value. Sharding keeps
// every individual write well under the limit.
//
// Everything is still loaded into memory together and merged back into the
// same single `book` shape the rest of the app expects — so balances,
// ledgers and reports continue to see full history. This is purely a
// storage-layout change, deliberately NOT a change to what's in scope:
// loading only the active year would silently break opening balances and
// outstanding amounts, which depend on prior-year activity.
const companyMetaKey = (id) => `textile-sales-data:${id}:meta`;
const companyFyKey = (id, fy) => `textile-sales-data:${id}:fy${fy}`;
const SHARD_INDEX_KEY = (id) => `textile-sales-data:${id}:shards`;

// Indian FY starting year for a date: 1 Apr 2026 -> 2026, 31 Mar 2026 -> 2025.
function fyOf(dateStr) {
  const s = String(dateStr || "");
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  if (!y || !m) return 0; // undated/malformed rows get their own bucket
  return m >= 4 ? y : y - 1;
}

const DATED_COLLECTIONS = ["invoices", "receipts", "purchases", "payments"];

// Split one book into { meta, shards: { [fy]: {...dated collections} } }.
function splitBookByFy(book) {
  const meta = {
    customers: book.customers || [],
    vendors: book.vendors || [],
    bankAccounts: book.bankAccounts || [],
    // Company-level master data — same category as customers/vendors, not
    // tied to any financial year, so it belongs in meta rather than a shard.
    units: book.units || [],
    shipFroms: book.shipFroms || [],
    counters: book.counters || { VCH: 0, CC: 0, PUR: 0, PAY: 0 },
  };
  const shards = {};
  for (const coll of DATED_COLLECTIONS) {
    for (const row of book[coll] || []) {
      const fy = fyOf(row.date);
      if (!shards[fy]) shards[fy] = { invoices: [], receipts: [], purchases: [], payments: [] };
      shards[fy][coll].push(row);
    }
  }
  return { meta, shards };
}

// Rebuild the single in-memory book from its shards.
function mergeBookFromShards(meta, shardList) {
  const book = {
    customers: meta?.customers || [],
    vendors: meta?.vendors || [],
    bankAccounts: meta?.bankAccounts || [],
    units: meta?.units || [],
    shipFroms: meta?.shipFroms || [],
    counters: meta?.counters || { VCH: 0, CC: 0, PUR: 0, PAY: 0 },
    invoices: [], receipts: [], purchases: [], payments: [],
  };
  for (const shard of shardList) {
    if (!shard) continue;
    for (const coll of DATED_COLLECTIONS) {
      if (Array.isArray(shard[coll])) book[coll].push(...shard[coll]);
    }
  }
  return book;
}

// A fresh, empty set of books.
// Work out the next-number counters from the documents themselves.
// A stored `counters` field can be missing (backups from the pro app don't
// carry one) or stale (rows added by CSV/QR import don't bump it), and
// trusting it then restarts numbering at 001 and collides with existing
// invoices. The documents are the reliable source: take the highest
// sequence number actually in use per series.
//
// Only simple `PREFIX-123` / `PREFIX-025R` numbers are counted. Legacy
// date-segmented ones (VCH-2606-D696, PUR-2607-5896) are deliberately
// ignored: their trailing digits are not a sequence, and treating them as
// one would jump the counter to absurd values (5896) and produce a huge gap
// in numbering.
function deriveCounters(book, stored) {
  const next = { ...(stored || {}) };
  const bump = (key, numText) => {
    const n = parseInt(numText, 10);
    if (!Number.isFinite(n)) return;
    if (!next[key] || n > next[key]) next[key] = n;
  };
  // Matches PREFIX-<digits> with an optional single-letter revision suffix,
  // and nothing else — so PREFIX-<date>-<digits> is skipped.
  const seq = (s) => {
    const m = String(s || "").match(/^[A-Za-z]+-(\d+)[A-Za-z]?$/);
    return m ? m[1] : null;
  };
  for (const inv of book.invoices || []) {
    const no = String(inv.invoiceNo || "");
    const series = inv.series || (no.startsWith("CC") ? "CC" : "VCH");
    const t = seq(no);
    if (t) bump(series, t);
  }
  for (const p of book.purchases || []) {
    const t = seq(p.billNo);
    if (t) bump("PUR", t);
  }
  for (const p of book.payments || []) {
    const t = seq(p.paymentNo);
    if (t) bump("PAY", t);
  }
  for (const r of book.receipts || []) {
    const t = seq(r.receiptNo);
    if (t) bump("RCP", t);
  }
  return { VCH: 0, CC: 0, PUR: 0, PAY: 0, ...next };
}

const emptyBook = () => ({
  customers: [], invoices: [], receipts: [], bankAccounts: [],
  vendors: [], purchases: [], payments: [],
  units: DEFAULT_UNITS.slice(),
  // "From" addresses printed on shipping labels — the business may dispatch
  // from more than one place, so this is a managed list picked per label.
  shipFroms: [],
  counters: { VCH: 0, CC: 0, PUR: 0, PAY: 0 },
});

// ---------- units of measurement (user-manageable) ----------
// Units are company data (see the Units screen), but they're needed by
// module-scope helpers like lineAmount and by deep print/PDF components that
// can't receive props. So the live list is mirrored into these module-level
// bindings via applyUnits() whenever the stored list changes; components read
// them fresh on each render, and every unit change re-renders the tree.



const emptyItem = () => ({ id: uid(), unit: "Yards", qty: "", size: "", rate: "" });
const emptyExpense = () => ({ id: uid(), label: "", pct: "", amount: "" });

// A "counted" unit (Pcs, Rolls, …) has no meaningful size dimension — size is
// treated as 1 and its input is disabled. Which units count is now part of
// the unit definition rather than hardcoded.

// A cancelled line stays on the document so the Sr numbers of the remaining
// lines never shift — physical goods are already numbered against them — but
// it contributes nothing. Zeroing it here means every total in the app
// (subtotals, invoice totals, ledgers, analytics, Tally) excludes it without
// each of those needing its own check.


// A purchase bill can hold multiple line items (like a sales invoice); items[]
// gives the line-item breakdown for display. The stored `amount` field is
// still what's authoritative for all financial math, though — it's kept in
// sync with the items sum at every write path (the multi-item entry form,
// CSV import, backup restore), and for backup-restored bills it can be
// larger than a raw items-sum since the source app's total may bake in
// discount/tax/other-expenses that our items[] shape doesn't carry per-line.
// items-sum is only used as a fallback when amount is missing entirely.

// ---------- invoice QR code: encode/decode ----------
// A QR code has a hard capacity ceiling (~2,950 bytes in byte mode at the
// largest practical version) — most invoices fit a full line-item encoding
// comfortably, but a big one (100+ items) can exceed it. Rather than fail
// silently, this always produces SOMETHING: a full-data code when the
// invoice fits, or a reference-only code (matching the same tradeoff India's
// GST e-invoice IRN QR codes make) when it doesn't. TBQR1 = full data,
// TBQR0 = reference-only. A single-character unit code keeps the encoding
// as compact as possible (Yards/Meter/Pcs/Gagra/Rida all start with a
// distinct letter, so no ambiguity).
const QR_UNIT_CODE = { Yards: "Y", Meter: "M", Pcs: "P", Gagra: "G", Rida: "R", Rolls: "L" };
const QR_UNIT_FROM_CODE = { Y: "Yards", M: "Meter", P: "Pcs", G: "Gagra", R: "Rida", L: "Rolls" };
const QR_MAX_BYTES = 2700; // safety margin under the ~2,953-byte hard ceiling

// Simple checksum (not cryptographic — just catches scan/transcription
// corruption): sum of char codes, base36, last 4 chars.
function qrChecksum(s) {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum = (sum + s.charCodeAt(i) * (i + 1)) % 0xfffffff;
  return sum.toString(36).slice(-4).padStart(4, "0");
}

function byteLen(s) {
  return new Blob([s]).size;
}

// Returns { text, mode: "full" | "ref" } — always produces an encodable
// string, degrading to reference-only if the full encoding won't fit.
function encodeInvoiceQr(invoice, customerName) {
  const esc = (s) => String(s ?? "").replace(/[|;:,]/g, " ").trim();
  const itemsPart = (invoice.items || [])
    .filter((it) => !isCancelledItem(it))
    .map((it) => `${QR_UNIT_CODE[it.unit] || "P"},${it.qty},${isCountUnit(it.unit) ? "" : it.size},${it.rate}`)
    .join(";");
  const expPart = (invoice.expenses || [])
    .filter((e) => Number(e.amount))
    .map((e) => `${esc(e.label)}:${e.amount}`)
    .join(",");
  const bodyFull = ["TBQR1", esc(invoice.invoiceNo), esc(customerName), invoice.date, esc(invoice.reference), itemsPart, expPart].join("|");
  const fullText = `${bodyFull}|${qrChecksum(bodyFull)}`;

  if (byteLen(fullText) <= QR_MAX_BYTES) {
    return { text: fullText, mode: "full" };
  }
  // Fallback: reference-only — enough to verify the invoice, not to rebuild
  // its line items (there isn't room).
  const bodyRef = ["TBQR0", esc(invoice.invoiceNo), esc(customerName), invoice.date, ""].join("|");
  return { text: `${bodyRef}|${qrChecksum(bodyRef)}`, mode: "ref" };
}

// Parses a scanned code back into a structured result. Returns
// { ok: false, error } on anything unrecognized or checksum-mismatched, so
// the scanner UI can show a clear reason rather than silently failing.
function decodeInvoiceQr(text) {
  const raw = String(text || "").trim();
  const parts = raw.split("|");
  if (parts.length < 2) return { ok: false, error: "Not a recognized invoice QR code." };
  const marker = parts[0];
  if (marker !== "TBQR1" && marker !== "TBQR0") return { ok: false, error: "Not a Textile Bill invoice QR code." };
  const checksum = parts[parts.length - 1];
  const body = parts.slice(0, -1).join("|");
  if (qrChecksum(body) !== checksum) return { ok: false, error: "Checksum mismatch — the code may be damaged or partially scanned." };

  if (marker === "TBQR0") {
    const [, invoiceNo, customerName, date] = parts;
    return { ok: true, mode: "ref", invoiceNo, customerName, date };
  }
  const [, invoiceNo, customerName, date, reference, itemsPart, expPart] = parts;
  const items = (itemsPart || "").split(";").filter(Boolean).map((chunk) => {
    const [u, qty, size, rate] = chunk.split(",");
    return { id: uid(), unit: QR_UNIT_FROM_CODE[u] || "Pcs", qty: qty || "", size: size || "", rate: rate || "" };
  });
  const expenses = (expPart || "").split(",").filter(Boolean).map((chunk) => {
    const idx = chunk.lastIndexOf(":");
    return { id: uid(), label: chunk.slice(0, idx), amount: chunk.slice(idx + 1) };
  });
  return { ok: true, mode: "full", invoiceNo, customerName, date, reference, items, expenses };
}

function packingRows(items) {
  return items.map((it, i) => {
    const qty = Number(it.qty) || 0;
    const rate = Number(it.rate) || 0;
    const isPcs = isCountUnit(it.unit);
    const size = isPcs ? 0 : Number(it.size) || 0;
    const abbr = UNIT_ABBR[it.unit] || it.unit;
    // A cancelled line keeps its Sr number on the printed document — that's
    // the whole point, since the physical goods are numbered against it — but
    // prints as CANCELLED with no figures.
    const off = isCancelledItem(it);
    return {
      sn: i + 1,
      cancelled: off,
      qty: off ? "" : qty,
      sizeDisplay: off ? "CANCELLED" : (isPcs ? "-" : `${size} ${abbr}`),
      totalQtyDisplay: off ? "" : (isPcs ? `${qty} Pcs` : `${qty * size} ${abbr}`),
      rate: off ? "" : rate,
      amount: lineAmount(it),
    };
  });
}

// ---------- CSV helpers (format matches the reference app's exports) ----------


// Generic text-file download (used for Tally XML export).
function downloadTextFile(text, filename, mime = "application/xml") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Escape a value for inclusion in Tally XML element text.
function xmlEscape(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Tally date format: YYYYMMDD.
function tallyDate(iso) {
  const d = parseDateFlexible(iso);
  if (!d || isNaN(d.getTime())) return "";
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

// Build a Tally Prime "Import Masters" XML for ledger accounts. Each account
// becomes a LEDGER master under its parent group (Sundry Debtors / Bank
// Accounts / etc.), carrying its opening balance.
function buildTallyLedgersXml(accounts, companyName = "") {
  const parentFor = (type) => {
    if (type === "Customer") return "Sundry Debtors";
    if (type === "Vendor") return "Sundry Creditors";
    if (type === "Bank") return "Bank Accounts";
    if (type === "Cash") return "Cash-in-Hand";
    if (type === "Sales") return "Sales Accounts";
    if (type === "Purchase") return "Purchase Accounts";
    if (type === "Income") return "Indirect Income";
    if (type === "Expense") return "Indirect Expenses";
    return "Sundry Debtors";
  };
  const appDate = tallyDate(currentFYDates().from); // 20xx0401
  const messages = accounts.map((a) => {
    const ob = Number(a.openingBalance) || 0;
    // Tally sign: Dr = negative, Cr = positive; 2 decimals.
    // Tally accepts several <ADDRESS> lines. Line 1 is the party's regular
    // address (the short label used across the app); anything below comes
    // from their shipping address, so the exported ledger carries the full
    // postal address rather than just the short label.
    const addrLines = [
      a.address,
      a.shipAddress,
      [[a.shipCity, a.shipState].filter(Boolean).join(", "), a.shipPin && `PIN ${a.shipPin}`].filter(Boolean).join(" — "),
    ].map((l) => String(l || "").trim()).filter(Boolean);
    const addrXml = (indent) => addrLines.length
      ? `\n${indent}<ADDRESS.LIST TYPE="String">` +
        addrLines.map((l) => `\n${indent} <ADDRESS>${xmlEscape(l)}</ADDRESS>`).join("") +
        `\n${indent}</ADDRESS.LIST>`
      : "";

    const signed = ob === 0 ? "" : (a.balanceType === "Cr" ? ob : -ob).toFixed(2);
    const isParty = a.type === "Customer" || a.type === "Vendor";
    const nm = xmlEscape(a.name);
    let body = "";
    // Field order matches the working reference file exactly.
    body += addrXml("      ");
    body += `\n      <MAILINGNAME.LIST TYPE="String">\n       <MAILINGNAME>${nm}</MAILINGNAME>\n      </MAILINGNAME.LIST>`;
    body += `\n      <COUNTRYNAME>India</COUNTRYNAME>`;
    body += `\n      <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>`;
    body += `\n      <PARENT>${xmlEscape(parentFor(a.type))}</PARENT>`;
    body += `\n      <LEDGERCONTACT>${nm}</LEDGERCONTACT>`;
    if (a.phone) {
      body += `\n      <LEDGERMOBILE>${xmlEscape(a.phone)}</LEDGERMOBILE>`;
      body += `\n      <LEDGERPHONE>${xmlEscape(a.phone)}</LEDGERPHONE>`;
    }
    if (a.email) body += `\n      <EMAIL>${xmlEscape(a.email)}</EMAIL>`;
    if (signed !== "") body += `\n      <OPENINGBALANCE>${signed}</OPENINGBALANCE>`;
    // LEDMAILINGDETAILS.LIST (address repeated here + applicable-from + country)
    body += `\n      <LEDMAILINGDETAILS.LIST>`;
    body += addrXml("       ");
    body += `\n       <APPLICABLEFROM>${appDate}</APPLICABLEFROM>`;
    body += `\n       <MAILINGNAME>${nm}</MAILINGNAME>`;
    body += `\n       <COUNTRY>India</COUNTRY>`;
    body += `\n      </LEDMAILINGDETAILS.LIST>`;
    // LANGUAGENAME.LIST
    body += `\n      <LANGUAGENAME.LIST>\n       <NAME.LIST TYPE="String">\n        <NAME>${nm}</NAME>\n       </NAME.LIST>\n       <LANGUAGEID>1033</LANGUAGEID>\n      </LANGUAGENAME.LIST>`;
    return `    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <LEDGER NAME="${nm}" ACTION="Create">${body}
     </LEDGER>
    </TALLYMESSAGE>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>All Masters</REPORTNAME>${companyName ? `\n    <STATICVARIABLES><SVCURRENTCOMPANY>${xmlEscape(companyName)}</SVCURRENTCOMPANY></STATICVARIABLES>` : ""}
   </REQUESTDESC>
   <REQUESTDATA>
${messages}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;
}

// Build a Tally Prime "Import Vouchers" XML from transaction rows.
// Each row is a Sales or Receipt voucher with two ledger entries (double
// entry). rows: [{ date, type, ref, party, otherLedger, amount }].
function buildTallyVouchersXml(vouchers, companyName = "") {
  const messages = vouchers.map((v) => {
    const amt = Number(v.amount) || 0;
    let vchType, partyEntry, otherEntry;
    if (v.type === "Sales") {
      vchType = "Sales";
      partyEntry = { ledger: v.party, amount: -amt, deemedPositive: "Yes" };       // Dr customer
      otherEntry = { ledger: v.otherLedger, amount: amt, deemedPositive: "No" };   // Cr Sales
    } else if (v.type === "Purchase") {
      vchType = "Purchase";
      partyEntry = { ledger: v.otherLedger, amount: -amt, deemedPositive: "Yes" }; // Dr Purchase A/c
      otherEntry = { ledger: v.party, amount: amt, deemedPositive: "No" };         // Cr vendor
    } else if (v.type === "Payment") {
      // A Discount-mode payment has no real cash/bank movement — it's a
      // write-off of part of what's owed — so Tally convention is a Journal
      // voucher, not a Payment voucher. Debit/credit placement is unchanged.
      vchType = v.isDiscount ? "Journal" : "Payment";
      partyEntry = { ledger: v.party, amount: -amt, deemedPositive: "Yes" };       // Dr vendor
      otherEntry = { ledger: v.otherLedger, amount: amt, deemedPositive: "No" };   // Cr Cash/Bank/Discount Received
    } else { // Receipt
      vchType = v.isDiscount ? "Journal" : "Receipt";
      partyEntry = { ledger: v.otherLedger, amount: -amt, deemedPositive: "Yes" }; // Dr Cash/Bank/Discount Allowed
      otherEntry = { ledger: v.party, amount: amt, deemedPositive: "No" };         // Cr customer
    }
    const partyLedger = v.party;
    const d = tallyDate(v.date);
    const entry = (e) => `      <ALLLEDGERENTRIES.LIST>\n       <LEDGERNAME>${xmlEscape(e.ledger)}</LEDGERNAME>\n       <ISDEEMEDPOSITIVE>${e.deemedPositive}</ISDEEMEDPOSITIVE>\n       <AMOUNT>${e.amount.toFixed(2)}</AMOUNT>\n      </ALLLEDGERENTRIES.LIST>`;
    return `    <TALLYMESSAGE xmlns:UDF="TallyUDF">
     <VOUCHER VCHTYPE="${vchType}" ACTION="Create">
      <DATE>${d}</DATE>
      <EFFECTIVEDATE>${d}</EFFECTIVEDATE>
      <VOUCHERTYPENAME>${vchType}</VOUCHERTYPENAME>
      <VOUCHERNUMBER>${xmlEscape(v.ref)}</VOUCHERNUMBER>
      <REFERENCE>${xmlEscape(v.ref)}</REFERENCE>
      <NARRATION>${xmlEscape(v.ref)}</NARRATION>
      <PARTYLEDGERNAME>${xmlEscape(partyLedger)}</PARTYLEDGERNAME>
${entry(partyEntry)}
${entry(otherEntry)}
     </VOUCHER>
    </TALLYMESSAGE>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>${companyName ? `\n    <STATICVARIABLES><SVCURRENTCOMPANY>${xmlEscape(companyName)}</SVCURRENTCOMPANY></STATICVARIABLES>` : ""}
   </REQUESTDESC>
   <REQUESTDATA>
${messages}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;
}

// Minimal CSV parser handling quoted fields; returns array of objects keyed
// by the header row.
function parseCsv(text) {
  const rows = [];
  let cur = [], field = "", inQuotes = false;
  const src = text.replace(/^\ufeff/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { cur.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      cur.push(field); field = "";
      if (cur.some((c) => c !== "")) rows.push(cur);
      cur = [];
    } else field += ch;
  }
  cur.push(field);
  if (cur.some((c) => c !== "")) rows.push(cur);
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// Rows per packing-list page, matching the Replit app's reference layout:
// 21 rows on the first page, 23 rows on every page after that.
//
// The LAST page is a different, tighter fit: it carries the rows *plus* the
// Sub-Total / Grand-Total / Remarks / page-number block, which runs to
// ~127px (vs. ~22px for the small "Page x/y" footer every other page has) —
// roughly 4-5 extra rows' worth of height. PACKING_LAST_PAGE_ROWS /
// PACKING_FIRST_LAST_PAGE_ROWS trim that page's row budget by that same
// 5-row margin below the base counts, so it doesn't spill onto a stray
// extra page. If real-world printing/PDF still shows the last page
// overflowing, tighten just these two — the base 21/23 counts should stay
// fixed to match the Replit reference.
const PACKING_FIRST_PAGE_ROWS = 21;
const PACKING_OTHER_PAGE_ROWS = 23;
const PACKING_LAST_PAGE_ROWS = 18; // continuation-style header + big footer
const PACKING_FIRST_LAST_PAGE_ROWS = 16; // page-1 header + big footer (single-page invoices)

function paginateRows(rows) {
  // Everything fits on one page: that page is both first and last, so it
  // carries the bigger page-1 header AND the full totals/remarks footer —
  // the least headroom of any page type.
  if (rows.length <= PACKING_FIRST_LAST_PAGE_ROWS) {
    return [rows];
  }

  const pages = [];
  let i = 0;
  let first = true;
  while (i < rows.length) {
    const size = first ? PACKING_FIRST_PAGE_ROWS : PACKING_OTHER_PAGE_ROWS;
    pages.push(rows.slice(i, i + size));
    i += size;
    first = false;
  }
  if (pages.length === 0) pages.push([]);

  // The page that ended up last carries the full footer, not just "Page
  // x/y" — if it's still near a full continuation page's row count, that
  // combination overflows a physical page. Rather than trimming rows off
  // that page (which would make it visibly shorter than every other content
  // page for no reason), give the footer its own trailing page instead, so
  // every content page keeps its full 21/23-row complement and the totals
  // simply print on the next sheet.
  const lastPage = pages[pages.length - 1];
  if (lastPage.length > PACKING_LAST_PAGE_ROWS) {
    pages.push([]);
  }
  return pages;
}

// Build a customer's T-format ledger: invoices debit, receipts credit,
// chronological with running balance. Shared by the detail view and prints.
function buildLedger(customer, invoices, receipts, invoiceTotal, window = {}) {
  const { from = "", to = "" } = window;
  let opening = (Number(customer.openingBalance) || 0) * (customer.openingBalanceType === "Cr" ? -1 : 1);
  const rawEntries = [
    ...invoices.map((inv) => ({
      date: inv.date,
      createdAt: inv.createdAt || 0,
      description: `Invoice ${inv.invoiceNo}`,
      debit: invoiceTotal(inv),
      credit: 0,
      invoice: inv,
    })),
    ...receipts.map((r) => ({
      date: r.date,
      createdAt: r.createdAt || 0,
      description: `Receipt ${r.receiptNo}${r.mode ? ` (${receiptAccountLabel(r)})` : ""}${r.reference ? ` · ${r.reference}` : ""}`,
      debit: 0,
      credit: Number(r.amount) || 0,
      invoice: null,
      receipt: r,
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
  // Window: entries before `from` roll into a brought-forward opening;
  // entries after `to` are excluded entirely.
  let openingLabel = "Opening Balance";
  let windowed = rawEntries;
  if (from) {
    for (const e of rawEntries) {
      if (e.date < from) opening += e.debit - e.credit;
    }
    windowed = windowed.filter((e) => e.date >= from);
    openingLabel = `Opening Balance (b/f ${fmtDate(from)})`;
  }
  if (to) windowed = windowed.filter((e) => e.date <= to);
  let running = opening;
  const entries = windowed.map((e) => {
    running += e.debit - e.credit;
    return { ...e, balance: running };
  });
  return {
    opening,
    openingLabel,
    entries,
    totalDebit: entries.reduce((t, e) => t + e.debit, 0),
    totalCredit: entries.reduce((t, e) => t + e.credit, 0),
    closing: running,
  };
}

// Vendor ledger: mirrors buildLedger's shape, but with the vendor accounting
// convention — vendors are creditors, so a purchase INCREASES what we owe
// (Credit) and a payment DECREASES it (Debit), the opposite of the customer
// ledger's invoice=Debit/receipt=Credit. Sign convention matches
// vendorOutstanding(): positive balance = Cr (payable).
function buildVendorLedger(vendor, purchases, payments, window = {}) {
  const { from = "", to = "" } = window;
  let opening = (Number(vendor.openingBalance) || 0) * (vendor.openingBalanceType === "Dr" ? -1 : 1);
  const rawEntries = [
    ...purchases.map((p) => ({
      date: p.date,
      createdAt: p.createdAt || 0,
      description: `Purchase ${p.billNo}`,
      debit: 0,
      credit: purchaseTotal(p),
      purchase: p,
    })),
    ...payments.map((p) => ({
      date: p.date,
      createdAt: p.createdAt || 0,
      description: `Payment ${p.paymentNo}${p.mode ? ` (${paymentAccountLabel(p)})` : ""}${p.reference ? ` · ${p.reference}` : ""}`,
      debit: Number(p.amount) || 0,
      credit: 0,
      purchase: null,
      payment: p,
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));
  // Window: entries before `from` roll into a brought-forward opening;
  // entries after `to` are excluded entirely.
  let openingLabel = "Opening Balance";
  let windowed = rawEntries;
  if (from) {
    for (const e of rawEntries) {
      if (e.date < from) opening += e.credit - e.debit;
    }
    windowed = windowed.filter((e) => e.date >= from);
    openingLabel = `Opening Balance (b/f ${fmtDate(from)})`;
  }
  if (to) windowed = windowed.filter((e) => e.date <= to);
  let running = opening;
  const entries = windowed.map((e) => {
    running += e.credit - e.debit;
    return { ...e, balance: running };
  });
  return {
    opening,
    openingLabel,
    entries,
    totalDebit: entries.reduce((t, e) => t + e.debit, 0),
    totalCredit: entries.reduce((t, e) => t + e.credit, 0),
    closing: running,
  };
}

function chunkSheets(pages) {
  const sheets = [];
  for (let i = 0; i < pages.length; i += 2) sheets.push(pages.slice(i, i + 2));
  return sheets;
}

// Print, naming the output. Browsers use document.title as the default
// filename in "Save as PDF", so we swap it in for the duration of the print
// and restore it afterwards (matches the real app's behaviour, where an
// invoice saves as e.g. "VCH-043.pdf").
function printDoc(filename) {
  if (!filename) { window.print(); return; }
  const previous = document.title;
  const safe = String(filename).replace(/[\\/:*?"<>|]+/g, "-").trim();
  document.title = safe || previous;
  const restore = () => {
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  window.print();
}

// Client-side PDF export, for browsers/webviews where window.print() does not
// reliably surface a system print / "Save as PDF" dialog (notably in-app
// browsers on iOS). Rasterises the same hidden `.print-sheet` copies that back
// the Print button — one image per physical A4-landscape page — and assembles
// them into a downloadable PDF with jsPDF, so both paths render from
// identical markup and never drift out of sync with each other.
const PDF_PAGE_W_MM = 297;
const PDF_PAGE_H_MM = 210;

// html2canvas-pro does not reliably draw gridlines on border-collapse:collapse
// tables — on each shared edge the collapsed border resolves to 0 on one of
// the two adjacent cells, so the captured PDF can come out missing gridlines
// even though the on-screen/print table looks fine. Switching the cloned
// table to the separate border model (right before capture, on a clone the
// user never sees) keeps every cell's own border intact; our cells already
// carry an explicit border on every side, so no per-cell reconstruction is
// needed like a collapsed table would require.
function applyPdfTableBorders(root) {
  root.querySelectorAll("table").forEach((table) => {
    table.style.borderCollapse = "separate";
    table.style.borderSpacing = "0";
  });
}

// Finds every currently-mounted `.print-area` (there's normally exactly one —
// each preview modal renders its own hidden copy alongside the on-screen
// preview — matching whatever `window.print()` would also pick up), and
// rasterises each `.print-sheet` inside them into a jsPDF document. Returns
// the jsPDF instance (not saved/downloaded) so callers can either trigger a
// download or hand it to the Web Share API.
async function buildPdfFromPrintAreas() {
  const areas = Array.from(document.querySelectorAll(".print-area"));
  if (areas.length === 0) return null;

  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  // The print-area copies are `display: none` outside @media print, and
  // html2canvas needs real layout (not just DOM) to capture — so reveal them
  // off-screen for the duration of the capture, then restore. Crucially, this
  // also fixes the container to the same A4-landscape design width the app
  // already uses for the on-screen paper preview (PACKING_DESIGN_W below,
  // matching PaperSheet's A4.landW): without an explicit width, a `position:
  // fixed` element with no `left`/`right` pairing falls back to an
  // unpredictable shrink-to-fit width, which throws off both the captured
  // aspect ratio (looks "portrait" once fit into a landscape PDF page) and,
  // combined with html2canvas needing accurate width/height/window* options
  // for off-screen elements, can clip rows below the fold entirely.
  const PACKING_DESIGN_W = 1122; // px @96dpi — same as A4.landW
  const restoreFns = areas.map((el) => {
    const prev = { display: el.style.display, position: el.style.position, left: el.style.left, top: el.style.top, zIndex: el.style.zIndex, width: el.style.width };
    el.style.display = "block";
    el.style.position = "fixed";
    el.style.left = "-10000px";
    el.style.top = "0";
    el.style.zIndex = "-1";
    el.style.width = `${PACKING_DESIGN_W}px`;
    return () => {
      el.style.display = prev.display;
      el.style.position = prev.position;
      el.style.left = prev.left;
      el.style.top = prev.top;
      el.style.zIndex = prev.zIndex;
      el.style.width = prev.width;
    };
  });

  try {
    const sheetEls = areas.flatMap((area) => {
      const sheets = Array.from(area.querySelectorAll(".print-sheet"));
      return sheets.length > 0 ? sheets : [area];
    });

    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    for (let i = 0; i < sheetEls.length; i++) {
      const target = sheetEls[i];
      // Measure the FULL rendered size (not just what's currently in the
      // viewport) and pass it explicitly — html2canvas can otherwise cap an
      // off-screen element's capture at a default/viewport-sized window,
      // silently cutting off rows past that height.
      const fullWidth = Math.max(target.scrollWidth, target.offsetWidth);
      const fullHeight = Math.max(target.scrollHeight, target.offsetHeight);
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: fullWidth,
        height: fullHeight,
        windowWidth: fullWidth,
        windowHeight: fullHeight,
        onclone: (_doc, el) => applyPdfTableBorders(el),
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const ratio = canvas.height / canvas.width;
      // Fit the captured sheet to the page: full width unless that would
      // overflow the page height, in which case fit by height and centre.
      let w = PDF_PAGE_W_MM;
      let h = w * ratio;
      if (h > PDF_PAGE_H_MM) {
        h = PDF_PAGE_H_MM;
        w = h / ratio;
      }
      const x = (PDF_PAGE_W_MM - w) / 2;
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, "JPEG", x, 0, w, h);
    }
    return pdf;
  } finally {
    restoreFns.forEach((fn) => fn());
  }
}

function safePdfFilename(filename) {
  const safe = String(filename || "Document").replace(/[\\/:*?"<>|]+/g, "-").trim();
  return `${safe || "Document"}.pdf`;
}

async function generatePdfFromPrintAreas(filename) {
  const pdf = await buildPdfFromPrintAreas();
  if (!pdf) return;
  pdf.save(safePdfFilename(filename));
}

// True when the browser supports sharing a file via the OS share sheet
// (WhatsApp, Email, etc.) — mainly mobile Chrome/Safari. Desktop browsers
// mostly don't, so the Share button is only shown where this is true.
function canShareFiles() {
  return typeof navigator !== "undefined" && !!navigator.share && !!navigator.canShare;
}

// Splitting sharing into two steps — prepare, then share — works around an
// iOS Safari quirk: it only allows navigator.share() when called immediately
// within the click that triggered it, and the PDF build below takes real
// time (rendering, several awaits), which is long enough for iOS to treat
// the original tap as expired. Calling share() after that silently fails
// there, falling back to a plain download that looks identical to Save
// PDF — exactly the bug this avoids. So: this function only builds the file
// and does not touch navigator.share() at all; the actual share happens in
// a second, separate tap (see the Share buttons below), which is a fresh
// user gesture with no async work before the share() call.
async function preparePdfForShare(filename) {
  const pdf = await buildPdfFromPrintAreas();
  if (!pdf) return null;
  const fname = safePdfFilename(filename);
  const blob = pdf.output("blob");
  let file;
  try {
    file = new File([blob], fname, { type: "application/pdf" });
  } catch {
    file = blob;
  }
  return { file, fname, pdf };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const blankDraft = (series, nextNo) => ({
  id: null,
  invoiceNo: `${series}-${String(nextNo).padStart(3, "0")}`,
  series,
  date: todayISO(),
  reference: "",
  customerId: "",
  items: [emptyItem()],
  expenses: [],
  status: "Unpaid",
});

// ---------- stitched divider, the app's signature motif ----------


// ---------- app users (admin-managed, in-app) ----------
// Simple client-side login: no backend, no external service — works on any
// static host (Vercel, Netlify, Firebase, plain Docker/nginx, anywhere)
// with zero setup beyond deploying. The user list itself lives in this
// browser's localStorage (separate from the business data) and is managed
// from the in-app Users screen (Admin role only) — add people, change
// roles, reset passwords, remove access, all without touching code.
//
// IMPORTANT: since there's no server, this is enforced entirely in the
// browser. Someone who opens dev tools can read the stored user list and
// its plaintext passwords, or just skip the check in the JS itself. This
// keeps casual or unauthorized people out, but it is NOT real security
// against someone deliberately trying to get in — that needs a real
// backend (e.g. Firebase Authentication).
const USERS_STORAGE_KEY = "textile-bill-users";
const AUTH_STORAGE_KEY = "textile-bill-auth";

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {}
  // First run (or corrupted/empty storage) — seed one default admin so
  // there's always at least one way in.
  const seeded = [{ id: uid(), username: "admin", password: "changeme", role: "Admin" }];
  try { localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(seeded)); } catch {}
  return seeded;
}

function saveUsers(users) {
  try { localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users)); } catch {}
}

// Catches any render error in the real app and shows it on screen instead
// of leaving a blank page with no clue what happened — this is what would
// otherwise make a crash right after signing in look like "nothing
// happens", since there was previously nothing to catch it.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Textile Bill crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: paper, padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 480, background: card, border: `1px solid ${hairline}`, borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ color: muted, fontSize: 13, marginBottom: 12 }}>
              The app hit an error and couldn't continue. The message below is the actual cause — sharing it is the fastest way to get it fixed.
            </p>
            <pre style={{ background: dangerBg, color: danger, fontSize: 11.5, padding: 10, borderRadius: 8, overflowX: "auto", whiteSpace: "pre-wrap", margin: 0 }}>
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: thread, color: ink }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Gates the real app behind the login above. This only controls who can
// *open* the app — data itself still lives in each browser's local storage
// as before, so logging in on a different device shows that device's own
// local data, not shared data.
export default function TextileSales() {
  const [users, setUsers] = useState(() => loadUsers());
  const [loggedInAs, setLoggedInAs] = useState(() => {
    try { return localStorage.getItem(AUTH_STORAGE_KEY) || null; } catch { return null; }
  });

  function persistUsers(next) {
    setUsers(next);
    saveUsers(next);
  }

  function handleLogin(username) {
    try { localStorage.setItem(AUTH_STORAGE_KEY, username); } catch {}
    setLoggedInAs(username);
  }
  function handleLogout() {
    try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch {}
    setLoggedInAs(null);
  }

  if (!loggedInAs) {
    return <LoginScreen users={users} onLogin={handleLogin} />;
  }
  return (
    <ErrorBoundary>
      <TextileSalesApp currentUsername={loggedInAs} users={users} onSetUsers={persistUsers} onSignOut={handleLogout} />
    </ErrorBoundary>
  );
}

function LoginScreen({ users, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    try {
      const match = users.find(
        (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password.trim()
      );
      if (match) {
        onLogin(match.username);
      } else {
        setError("Incorrect username or password.");
      }
    } catch (err) {
      // Surfaced on screen (not just the console) because checking dev
      // tools on a phone is often impractical — this way whatever actually
      // went wrong is visible without needing them.
      setError(`Sign-in error: ${err?.message || String(err)}`);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: paper, padding: 16 }}>
      <form
        onSubmit={handleSubmit}
        className="w-full"
        style={{ maxWidth: 360, background: card, border: `1px solid ${hairline}`, borderRadius: 16, padding: 28 }}
      >
        <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Textile Bill</h1>
        <p style={{ color: muted, fontSize: 13, marginBottom: 20 }}>Sign in to continue</p>

        {error && (
          <div style={{ background: dangerBg, color: danger, fontSize: 12.5, padding: "8px 10px", borderRadius: 8, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <div style={{ color: muted, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Username</div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            autoComplete="off"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: `1px solid ${hairline}`, color: ink, background: "#fff" }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: muted, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: `1px solid ${hairline}`, color: ink, background: "#fff" }}
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg font-semibold text-sm"
          style={{ background: thread, color: ink }}
        >
          Sign In
        </button>
      </form>
    </div>
  );
}

function TextileSalesApp({ currentUsername, users, onSetUsers, onSignOut }) {
  const currentUserRecord = users.find((u) => u.username.toLowerCase() === currentUsername.toLowerCase());
  const currentUserRole = currentUserRecord?.role || "User";
  const [loaded, setLoaded] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [payments, setPayments] = useState([]);
  const [units, setUnits] = useState(() => DEFAULT_UNITS.slice());
  const [shipFroms, setShipFroms] = useState([]);
  const [labelInvoice, setLabelInvoice] = useState(null); // invoice whose shipping label is open
  // O(1) lookup by id, rebuilt only when the underlying list changes — used
  // in place of `customers.find(c => c.id === x)` / `vendors.find(...)`
  // wherever that lookup happens per-row (list/print/report rendering did a
  // full linear scan per row before this, i.e. O(rows × customers)).
  const customerById = useMemo(() => {
    const m = new Map();
    for (const c of customers) m.set(c.id, c);
    return m;
  }, [customers]);
  const vendorById = useMemo(() => {
    const m = new Map();
    for (const v of vendors) m.set(v.id, v);
    return m;
  }, [vendors]);
  const [counters, setCounters] = useState({ VCH: 0, CC: 0, PUR: 0, PAY: 0 });

  const [module, setModule] = useState("dashboard"); // dashboard | analytics | sales | customers | receipts | ...
  const [view, setView] = useState("list"); // sales sub-view: list | form | detail
  const [customerView, setCustomerView] = useState("list"); // customers sub-view: list | detail
  const [viewingCustomerId, setViewingCustomerId] = useState(null);
  const [vendorView, setVendorView] = useState("list"); // vendors sub-view: list | detail
  const [viewingVendorId, setViewingVendorId] = useState(null);
  const [purchaseView, setPurchaseView] = useState("list"); // purchases sub-view: list | detail
  const [viewingPurchaseId, setViewingPurchaseId] = useState(null);
  const [editingCustomerId, setEditingCustomerId] = useState(null); // null = modal adds new
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showQrImport, setShowQrImport] = useState(false);
  // Seeds the ReceiptModal: an existing receipt (has `id`) when editing, or
  // a prefilled draft with no `id` when creating one against an invoice.
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [receiptRegPreview, setReceiptRegPreview] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  // Same idea for payments, so "Add Payment" on a purchase bill's detail
  // page can open the same modal the Payments tab uses.
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  // Global purchase modal, so "New Purchase" works from the vendor ledger
  // as well as from the Purchases tab.
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);

  function saveBankAccount(acc) {
    if (!acc.bankName?.trim()) return false;
    if (acc.id) {
      setBankAccounts((prev) => prev.map((b) => (b.id === acc.id ? acc : b)));
    } else {
      setBankAccounts((prev) => [...prev, { ...acc, id: uid() }]);
    }
    return true;
  }
  function deleteBankAccount(id) {
    setBankAccounts((prev) => prev.filter((b) => b.id !== id));
  }
  const [custSelected, setCustSelected] = useState([]); // customer ids ticked for printing
  const [custFrom, setCustFrom] = useState(currentFYDates().from);   // ledger window for customers tab
  const [custTo, setCustTo] = useState(currentFYDates().to);
  const [receiptFrom, setReceiptFrom] = useState(currentMonthDates().from);
  const [receiptTo, setReceiptTo] = useState(currentMonthDates().to);
  const [custSummaryPreview, setCustSummaryPreview] = useState(false);
  const [custSummaryPrint, setCustSummaryPrint] = useState(false);
  const [custLedgersPrint, setCustLedgersPrint] = useState(false);
  const [vendSelected, setVendSelected] = useState([]); // vendor ids ticked for printing
  const [vendFrom, setVendFrom] = useState(currentFYDates().from);   // ledger window for vendors tab
  const [vendTo, setVendTo] = useState(currentFYDates().to);
  const [vendSummaryPreview, setVendSummaryPreview] = useState(false);
  const [vendSummaryPrint, setVendSummaryPrint] = useState(false);
  const [vendLedgersPrint, setVendLedgersPrint] = useState(false);
  const [dashFrom, setDashFrom] = useState(currentFYDates().from);
  const [dashTo, setDashTo] = useState(currentFYDates().to);
  const [analyticsFrom, setAnalyticsFrom] = useState(currentFYDates().from);
  const [analyticsTo, setAnalyticsTo] = useState(currentFYDates().to);
  const [viewingId, setViewingId] = useState(null); // invoice id shown in detail view
  const viewingInvoice = useMemo(() => invoices.find((i) => i.id === viewingId), [invoices, viewingId]);
  const [draft, setDraft] = useState(null);
  const [printing, setPrinting] = useState(null);
  const [previewing, setPreviewing] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [seriesFilter, setSeriesFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState(currentMonthDates().from);
  const [dateTo, setDateTo] = useState(currentMonthDates().to);
  const [dateSortDir, setDateSortDir] = useState("desc"); // sales list date sort
  const [printSeparate, setPrintSeparate] = useState(false);

  // ---------- global financial-year picker ----------
  // Sets the working year for the whole app. It only drives the per-tab date
  // FILTERS (which each tab can still override) — it deliberately does NOT
  // scope balances or ledgers, since outstanding amounts depend on
  // prior-year history and would be wrong if limited to one year.
  const [activeFy, setActiveFy] = useState(currentFyStartYear());
  const fyYears = useMemo(
    () => availableFyYears([invoices, receipts, purchases, payments]),
    [invoices, receipts, purchases, payments]
  );
  function selectFy(startYear) {
    const y = Number(startYear);
    if (!y) return;
    const { from, to } = fyDatesFor(y);
    setActiveFy(y);
    // Push into every tab's filter so the whole app lines up on that year.
    setDateFrom(from); setDateTo(to);                 // sales list
    setCustFrom(from); setCustTo(to);                 // customers / ledgers
    setVendFrom(from); setVendTo(to);                 // vendors / ledgers
    setReceiptFrom(from); setReceiptTo(to);           // receipts
    setDashFrom(from); setDashTo(to);                 // dashboard
    setAnalyticsFrom(from); setAnalyticsTo(to);       // analytics
    // Purchases / Payments / Transaction Report keep their own local state;
    // they're told about the change through the fyWindow prop below.
  }
  const fyWindow = useMemo(() => fyDatesFor(activeFy), [activeFy]);
  const [printingRegister, setPrintingRegister] = useState(false);
  const [previewingRegister, setPreviewingRegister] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "", phone1: "", phone2: "", email: "", address: "",
    openingBalance: "", openingBalanceType: "Dr", openingBalanceDate: todayISO(),
  });
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const [error, setError] = useState("");
  const [pendingImport, setPendingImport] = useState(null); // { label, dupCount, newCount, onResolve(mode) }
  const [pendingRestore, setPendingRestore] = useState(null); // File awaiting confirmation
  const [pendingCloudRestore, setPendingCloudRestore] = useState(null); // {book, companyName, updatedAt} awaiting confirmation
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const [backupBannerDismissed, setBackupBannerDismissed] = useState(false); // dismissed for this session only
  const [backupSharePayload, setBackupSharePayload] = useState(null); // {file, fname} prepared, awaiting the confirming tap

  // ---------- multi-company ----------
  const [companies, setCompanies] = useState([]);           // [{id,name,createdAt}]
  const [activeCompanyId, setActiveCompanyId] = useState(null);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  // Guards the persist effect: only write once the book for the *current*
  // company has actually been loaded, so switching never cross-saves.
  const loadedCompanyRef = useRef(null);

  // Re-reads the last-backup timestamp whenever the active company changes,
  // since each company is backed up independently.
  useEffect(() => {
    if (!activeCompanyId) { setLastBackupAt(null); return; }
    try { setLastBackupAt(localStorage.getItem(`textile-bill-lastbackup-${activeCompanyId}`)); } catch { setLastBackupAt(null); }
    setBackupBannerDismissed(false);
  }, [activeCompanyId]);

  const saveTimer = useRef(null);

  const activeCompany = companies.find((c) => c.id === activeCompanyId) || null;
  const activeCompanyName = activeCompany?.name || "";

  // Push a book object into the individual state slices.
  const applyBook = useCallback((b) => {
    const book = b || emptyBook();
    const invoiceList = book.invoices || [];
    const receiptList = book.receipts || [];
    // Re-derive Paid/Unpaid from the receipts actually on file. The stored
    // status is a cached flag, and paths that load data wholesale (backup
    // restore, CSV/QR import) can carry one that disagrees with the
    // receipts — e.g. an invoice fully covered by a linked receipt still
    // showing Unpaid. The receipts are the source of truth.
    // invoiceTotal is defined further down the component, so the arithmetic
    // is inlined here rather than reordering the whole file.
    const totalOf = (inv) =>
      (inv.items || []).reduce((s, it) => s + lineAmount(it), 0) +
      (inv.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const covered = new Map();
    for (const r of receiptList) {
      if (!r.invoiceId) continue;
      covered.set(r.invoiceId, (covered.get(r.invoiceId) || 0) + (Number(r.amount) || 0));
    }
    setCustomers(book.customers || []);
    setInvoices(
      invoiceList.map((inv) => {
        const paid = covered.get(inv.id) || 0;
        const status = paid > 0 && paid >= totalOf(inv) ? "Paid" : "Unpaid";
        return status === inv.status ? inv : { ...inv, status };
      })
    );
    setReceipts(receiptList);
    setBankAccounts(book.bankAccounts || []);
    setVendors(book.vendors || []);
    setPurchases(book.purchases || []);
    setPayments(book.payments || []);
    setUnits(migrateUnitAbbrs(Array.isArray(book.units) && book.units.length ? book.units : DEFAULT_UNITS.slice()));
    setShipFroms(Array.isArray(book.shipFroms) ? book.shipFroms : []);
    setCounters(deriveCounters(book, book.counters));
  }, []);

  const readKey = async (key) => {
    try {
      const res = await window.storage.get(key, false);
      return res && res.value ? JSON.parse(res.value) : null;
    } catch (e) {
      return null; // missing key throws — treat as empty
    }
  };

  // Read a company's book. Prefers the FY-sharded layout; falls back to the
  // old single-key book so existing installs (and anything written by an
  // older build) still load. Returns null only if neither exists.
  const readBook = async (companyId) => {
    const shardIndex = await readKey(SHARD_INDEX_KEY(companyId));
    if (shardIndex && Array.isArray(shardIndex.fys)) {
      const meta = await readKey(companyMetaKey(companyId));
      const shards = await Promise.all(
        shardIndex.fys.map((fy) => readKey(companyFyKey(companyId, fy)))
      );
      return mergeBookFromShards(meta, shards);
    }
    return await readKey(companyDataKey(companyId)); // legacy layout
  };

  // Write a company's book as FY shards. Only shards whose contents actually
  // changed are rewritten, so editing one invoice doesn't re-serialise every
  // year — that's most of the saving at scale. Stale shards from a previous
  // save (e.g. the last row of a year was deleted) are emptied so they can't
  // resurrect rows on the next load.
  const shardCacheRef = useRef({ companyId: null, meta: "", fys: {} });
  const writeBookSharded = async (companyId, book) => {
    const { meta, shards } = splitBookByFy(book);
    const cache = shardCacheRef.current.companyId === companyId
      ? shardCacheRef.current
      : { companyId, meta: "", fys: {} };

    const metaJson = JSON.stringify(meta);
    if (metaJson !== cache.meta) {
      const ok = await window.storage.set(companyMetaKey(companyId), metaJson, false);
      if (!ok) throw new Error("meta write failed");
      cache.meta = metaJson;
    }

    const fys = Object.keys(shards);
    for (const fy of fys) {
      const json = JSON.stringify(shards[fy]);
      if (json === cache.fys[fy]) continue;
      const ok = await window.storage.set(companyFyKey(companyId, fy), json, false);
      if (!ok) throw new Error("shard write failed");
      cache.fys[fy] = json;
    }
    // Any FY we wrote previously but no longer have rows for.
    for (const fy of Object.keys(cache.fys)) {
      if (fys.includes(fy)) continue;
      const empty = JSON.stringify({ invoices: [], receipts: [], purchases: [], payments: [] });
      await window.storage.set(companyFyKey(companyId, fy), empty, false);
      cache.fys[fy] = empty;
    }

    const ok = await window.storage.set(SHARD_INDEX_KEY(companyId), JSON.stringify({ fys }), false);
    if (!ok) throw new Error("shard index write failed");
    shardCacheRef.current = { companyId, meta: cache.meta, fys: cache.fys };
  };

  // ---------- load: companies index (migrating legacy data if needed) ----------
  useEffect(() => {
    (async () => {
      try {
        let index = await readKey(COMPANIES_KEY);

        if (!index || !Array.isArray(index.companies) || index.companies.length === 0) {
          // First run on this device, or upgrading from the single-company build.
          const legacy = await readKey(STORAGE_KEY);
          const id = uid();
          const company = { id, name: "My Company", createdAt: Date.now() };
          const book = legacy && (legacy.customers || legacy.invoices) ? legacy : emptyBook();
          await writeBookSharded(id, book);
          index = { companies: [company], activeId: id };
          await window.storage.set(COMPANIES_KEY, JSON.stringify(index), false);
        }

        const activeId = index.companies.some((c) => c.id === index.activeId)
          ? index.activeId
          : index.companies[0].id;

        const book = await readBook(activeId);
        setCompanies(index.companies);
        setActiveCompanyId(activeId);
        applyBook(book);
        loadedCompanyRef.current = activeId;
      } catch (e) {
        // Storage unavailable — run with an in-memory book.
        const id = uid();
        setCompanies([{ id, name: "My Company", createdAt: Date.now() }]);
        setActiveCompanyId(id);
        applyBook(emptyBook());
        loadedCompanyRef.current = id;
      } finally {
        setLoaded(true);
      }
    })();
  }, [applyBook]);

  // Mirror the stored units into the module-level bindings that lineAmount,
  // the print components, and the unit dropdowns all read. useMemo (not
  // useEffect) so it runs during render, before children read the values —
  // an effect would leave one render showing the previous unit list.
  useMemo(() => applyUnits(units), [units]);

  // ---------- persist (debounced, per-company) ----------
  const persist = useCallback((next, companyId) => {
    if (!companyId) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await writeBookSharded(companyId, next);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1200);
      } catch (e) {
        setSaveState("idle");
        setError("Couldn't save — your changes are only on this screen right now.");
        setTimeout(() => setError(""), 4000);
      }
    }, 350);
  }, []);

  useEffect(() => {
    if (!loaded || !activeCompanyId) return;
    // Don't write until the book for THIS company has been loaded in, or we'd
    // stamp the previous company's data onto the newly selected one.
    if (loadedCompanyRef.current !== activeCompanyId) return;
    persist({ customers, invoices, receipts, bankAccounts, vendors, purchases, payments, units, shipFroms, counters }, activeCompanyId);
  }, [customers, invoices, receipts, bankAccounts, vendors, purchases, payments, units, shipFroms, counters, loaded, activeCompanyId, persist]);

  // ---------- company management ----------
  const writeIndex = async (list, activeId) => {
    try {
      await window.storage.set(COMPANIES_KEY, JSON.stringify({ companies: list, activeId }), false);
    } catch (e) {
      setError("Couldn't save the company list.");
      setTimeout(() => setError(""), 4000);
    }
  };

  async function switchCompany(id) {
    if (!id || id === activeCompanyId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current); // drop any pending write for the old book
    shardCacheRef.current = { companyId: null, meta: "", fys: {} };
    const book = await readBook(id);
    loadedCompanyRef.current = id;
    setActiveCompanyId(id);
    applyBook(book);
    await writeIndex(companies, id);
    // Reset any view state that refers to the old company's records.
    setViewingId(null); setDraft(null); setPrinting(null); setPreviewing(null);
    setSelected([]); setCustSelected([]); setViewingCustomerId(null);
    setModule("sales");
  }

  async function createCompany(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return false;
    if (companies.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("A company with that name already exists.");
      setTimeout(() => setError(""), 4000);
      return false;
    }
    const id = uid();
    const company = { id, name: trimmed, createdAt: Date.now() };
    try {
      shardCacheRef.current = { companyId: null, meta: "", fys: {} };
      await writeBookSharded(id, emptyBook());
    } catch (e) { /* storage may be unavailable; continue in memory */ }
    const list = [...companies, company];
    setCompanies(list);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    loadedCompanyRef.current = id;
    setActiveCompanyId(id);
    applyBook(emptyBook());
    await writeIndex(list, id);
    setViewingId(null); setDraft(null); setSelected([]); setCustSelected([]);
    setModule("sales");
    return true;
  }

  // Year-end carry-forward: creates a new company containing only the master
  // data (customers, vendors, banks, units, from-addresses) with each party's
  // closing balance as on `cutoff` becoming their opening balance. No
  // invoices, receipts, purchases or payments are copied — the old company
  // keeps the full history and stays readable, which is the point: the new
  // book starts small while nothing is lost.
  //
  // Balances are computed here rather than reusing customerBalances/
  // vendorBalances, because those follow the tab's own date filters and this
  // needs a specific cutoff regardless of what's on screen.
  function buildCarryForwardBook(cutoff) {
    const upTo = (d) => !cutoff || (d && d <= cutoff);

    const custBal = new Map();
    for (const c of customers) {
      custBal.set(c.id, (Number(c.openingBalance) || 0) * (c.openingBalanceType === "Cr" ? -1 : 1));
    }
    for (const i of invoices) {
      if (!custBal.has(i.customerId) || !upTo(i.date)) continue;
      custBal.set(i.customerId, custBal.get(i.customerId) + invoiceTotal(i));
    }
    for (const r of receipts) {
      if (!custBal.has(r.customerId) || !upTo(r.date)) continue;
      custBal.set(r.customerId, custBal.get(r.customerId) - (Number(r.amount) || 0));
    }

    const vendBal = new Map();
    for (const v of vendors) {
      vendBal.set(v.id, (Number(v.openingBalance) || 0) * (v.openingBalanceType === "Cr" ? -1 : 1));
    }
    for (const p of purchases) {
      if (!vendBal.has(p.vendorId) || !upTo(p.date)) continue;
      vendBal.set(p.vendorId, vendBal.get(p.vendorId) + purchaseTotal(p));
    }
    for (const pay of payments) {
      if (!vendBal.has(pay.vendorId) || !upTo(pay.date)) continue;
      vendBal.set(pay.vendorId, vendBal.get(pay.vendorId) - (Number(pay.amount) || 0));
    }

    // The new book opens the day after the cutoff.
    const openDate = (() => {
      const d = new Date(cutoff);
      d.setDate(d.getDate() + 1);
      return toLocalISO(d);
    })();

    const carryParty = (p, bal, defaultType) => {
      const rounded = Math.round(bal);
      return {
        ...p,
        openingBalance: rounded === 0 ? "" : String(Math.abs(rounded)),
        // Customers are debtors (+ = Dr), vendors creditors (+ = Cr); a
        // negative balance flips the side.
        openingBalanceType: rounded === 0 ? defaultType : (rounded > 0 ? defaultType : (defaultType === "Dr" ? "Cr" : "Dr")),
        openingBalanceDate: openDate,
      };
    };

    return {
      ...emptyBook(),
      customers: customers.map((c) => carryParty(c, custBal.get(c.id) || 0, "Dr")),
      vendors: vendors.map((v) => carryParty(v, vendBal.get(v.id) || 0, "Cr")),
      bankAccounts: bankAccounts.map((b) => ({ ...b })),
      units: units.map((u) => ({ ...u })),
      shipFroms: shipFroms.map((f) => ({ ...f })),
    };
  }

  async function carryForward(name, cutoff) {
    const trimmed = (name || "").trim();
    if (!trimmed) return false;
    if (companies.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("A company with that name already exists.");
      setTimeout(() => setError(""), 4000);
      return false;
    }
    const book = buildCarryForwardBook(cutoff);
    const id = uid();
    const company = { id, name: trimmed, createdAt: Date.now() };
    try {
      shardCacheRef.current = { companyId: null, meta: "", fys: {} };
      await writeBookSharded(id, book);
    } catch (e) { /* storage may be unavailable; continue in memory */ }
    const list = [...companies, company];
    setCompanies(list);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    loadedCompanyRef.current = id;
    setActiveCompanyId(id);
    applyBook(book);
    await writeIndex(list, id);
    setViewingId(null); setDraft(null); setSelected([]); setCustSelected([]);
    setModule("customers");
    return true;
  }

  async function renameCompany(id, name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return false;
    if (companies.some((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) {
      setError("A company with that name already exists.");
      setTimeout(() => setError(""), 4000);
      return false;
    }
    const list = companies.map((c) => (c.id === id ? { ...c, name: trimmed } : c));
    setCompanies(list);
    await writeIndex(list, activeCompanyId);
    return true;
  }

  async function deleteCompany(id) {
    if (companies.length <= 1) {
      setError("You need at least one company.");
      setTimeout(() => setError(""), 4000);
      return false;
    }
    const list = companies.filter((c) => c.id !== id);
    try {
      // Remove every key this company owns: the legacy single key, the meta
      // shard, the shard index, and one key per financial year.
      const idx = await readKey(SHARD_INDEX_KEY(id));
      const keys = [companyDataKey(id), companyMetaKey(id), SHARD_INDEX_KEY(id)];
      for (const fy of (idx?.fys || [])) keys.push(companyFyKey(id, fy));
      for (const k of keys) {
        if (window.storage.delete) await window.storage.delete(k, false);
        else await window.storage.set(k, JSON.stringify(null), false);
      }
    } catch (e) { /* best effort */ }
    setCompanies(list);
    if (id === activeCompanyId) {
      const nextId = list[0].id;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      shardCacheRef.current = { companyId: null, meta: "", fys: {} };
      const book = await readBook(nextId);
      loadedCompanyRef.current = nextId;
      setActiveCompanyId(nextId);
      applyBook(book);
      await writeIndex(list, nextId);
      setViewingId(null); setDraft(null); setSelected([]); setCustSelected([]);
      setModule("sales");
    } else {
      await writeIndex(list, activeCompanyId);
    }
    return true;
  }

  // ---------- derived ----------
  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        if (statusFilter !== "All" && inv.status !== statusFilter) return false;
        if (seriesFilter !== "All" && inv.series !== seriesFilter) return false;
        if (dateFrom && inv.date < dateFrom) return false;
        if (dateTo && inv.date > dateTo) return false;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const custName = customerById.get(inv.customerId)?.name || "";
          if (
            !inv.invoiceNo.toLowerCase().includes(q) &&
            !custName.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) {
          const cmp = a.date < b.date ? -1 : 1;
          return dateSortDir === "asc" ? cmp : -cmp;
        }
        // within same date, keep higher SR (newer) toward the top for desc
        const c = (b.createdAt || 0) - (a.createdAt || 0);
        return dateSortDir === "asc" ? -c : c;
      });
  }, [invoices, customers, search, statusFilter, seriesFilter, dateFrom, dateTo, dateSortDir]);

  const totals = useMemo(() => {
    const total = filteredInvoices.reduce((s, inv) => s + invoiceTotal(inv), 0);
    const unpaid = filteredInvoices
      .filter((i) => i.status === "Unpaid")
      .reduce((s, inv) => s + invoiceTotal(inv), 0);
    return { total, unpaid, count: filteredInvoices.length };
  }, [filteredInvoices]);

  // stable serial numbers: order of creation, oldest = 1
  const srnoMap = useMemo(() => {
    // Number by date (oldest = 1), tie-broken by creation order, so the
    // date-descending list shows SR counting cleanly downward like the real app.
    const ordered = [...invoices].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    const map = {};
    ordered.forEach((inv, i) => (map[inv.id] = i + 1));
    return map;
  }, [invoices]);

  function invoiceTotal(inv) {
    const items = inv.items.reduce((s, it) => s + lineAmount(it), 0);
    const exp = (inv.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return items + exp;
  }

  // ---------- actions ----------
  // Next number for a series, derived from the invoices that actually exist
  // rather than from the stored counter. The counter only ever moves up, so
  // it stays reserved even when the invoice that claimed a number is later
  // deleted or moved to the other series — which left gaps and skipped
  // numbers. Reading the live list means the next invoice always continues
  // from the last one genuinely saved in that series.
  //
  // Only plain PREFIX-<digits> numbers count (matching deriveCounters), so
  // date-segmented imports like VCH-2606-Z034 don't distort the sequence.
  function nextNoForSeries(series) {
    let max = 0;
    for (const inv of invoices) {
      const no = String(inv.invoiceNo || "");
      const invSeries = inv.series || (no.startsWith("CC") ? "CC" : "VCH");
      if (invSeries !== series) continue;
      const m = no.match(/^[A-Za-z]+-(\d+)[A-Za-z]?$/);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return max + 1;
  }

  function startNewInvoice() {
    const series = "VCH";
    setDraft(blankDraft(series, nextNoForSeries(series)));
    setView("form");
  }

  function editInvoice(inv) {
    setDraft(JSON.parse(JSON.stringify(inv)));
    setView("form");
  }

  function changeSeries(series) {
    // Same derivation as startNewInvoice — switching series mid-draft should
    // land on that series' real next number, not the stored counter's.
    const nextNo = nextNoForSeries(series);
    setDraft((d) => ({
      ...d,
      series,
      invoiceNo: `${series}-${String(nextNo).padStart(3, "0")}`,
    }));
  }

  function saveDraft() {
    if (!draft.customerId) {
      setError("Pick a customer before saving.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    if (!draft.invoiceNo.trim()) {
      setError("Invoice number can't be empty.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    const validItems = draft.items.filter(
      (it) =>
        (Number(it.qty) || 0) > 0 &&
        (Number(it.rate) || 0) > 0 &&
        (isCountUnit(it.unit) || (Number(it.size) || 0) > 0)
    );
    if (validItems.length === 0) {
      setError("Add at least one item with a quantity and rate.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    const toSave = { ...draft, items: validItems };

    if (toSave.id) {
      setInvoices((prev) => prev.map((i) => (i.id === toSave.id ? toSave : i)));
    } else {
      toSave.id = uid();
      toSave.createdAt = Date.now();
      setInvoices((prev) => [toSave, ...prev]);
      setCounters((prev) => ({
        ...prev,
        [toSave.series]: Math.max(
          prev[toSave.series] || 0,
          parseInt(toSave.invoiceNo.split("-")[1], 10) || 0
        ),
      }));
    }
    // If this edit was opened from the detail view, return there.
    setView(viewingId && toSave.id === viewingId ? "detail" : "list");
    setDraft(null);
  }

  function deleteInvoice(id) {
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    setSelected((prev) => prev.filter((sid) => sid !== id));
    setPendingDelete(null);
  }

  function toggleSelect(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }
  function toggleSelectAll(ids) {
    setSelected((prev) => (ids.every((id) => prev.includes(id)) ? [] : ids));
  }
  function bulkSetStatus(status) {
    setInvoices((prev) => prev.map((i) => (selected.includes(i.id) ? { ...i, status } : i)));
  }
  function bulkDelete() {
    setInvoices((prev) => prev.filter((i) => !selected.includes(i.id)));
    setSelected([]);
    setBulkDeleteConfirm(false);
  }

  function toggleStatus(inv) {
    setInvoices((prev) =>
      prev.map((i) => (i.id === inv.id ? { ...i, status: i.status === "Paid" ? "Unpaid" : "Paid" } : i))
    );
  }

  // Same idea as toggleStatus/reconcileInvoiceStatuses above, but for
  // purchase bills against the payments linked to them via purchaseId.
  function togglePurchaseStatus(p) {
    setPurchases((prev) =>
      prev.map((x) => (x.id === p.id ? { ...x, status: x.status === "Paid" ? "Unpaid" : "Paid" } : x))
    );
  }
  function reconcilePurchaseStatuses(purchaseList, paymentList) {
    const covered = new Map();
    const credit = (id, amt) => covered.set(id, (covered.get(id) || 0) + amt);
    for (const pay of paymentList || []) {
      if (Array.isArray(pay.allocations) && pay.allocations.length) {
        // A single combined payment covering several bills for the same
        // vendor — credit each bill only its own allocated share, not the
        // full payment amount.
        for (const a of pay.allocations) {
          if (a.purchaseId) credit(a.purchaseId, Number(a.amount) || 0);
        }
      } else if (pay.purchaseId) {
        credit(pay.purchaseId, Number(pay.amount) || 0);
      }
    }
    let changed = false;
    const next = (purchaseList || []).map((p) => {
      const paid = covered.get(p.id) || 0;
      const status = paid > 0 && paid >= purchaseTotal(p) ? "Paid" : "Unpaid";
      if (status === p.status) return p;
      changed = true;
      return { ...p, status };
    });
    return changed ? next : purchaseList;
  }

  const blankCustomerForm = () => ({
    name: "", phone1: "", phone2: "", email: "", address: "",
    // Separate from `address` (a short label used across the app for
    // grouping and display) — this is the full postal address a courier
    // needs, and is only used for shipping labels.
    shipName: "", shipAddress: "", shipCity: "", shipState: "", shipPin: "", shipPhone: "", transporter: "",
    openingBalance: "", openingBalanceType: "Dr", openingBalanceDate: todayISO(),
  });

  // Lightweight patch used by the shipping-label screen's inline editor —
  // updates just the shipping fields on one customer without touching the
  // full customer-edit modal's state (newCustomer/editingCustomerId), so the
  // two editing paths can't collide with each other.
  function updateCustomerShipping(customerId, patch) {
    setCustomers((prev) => prev.map((c) => (c.id === customerId ? { ...c, ...patch } : c)));
  }

  function saveCustomer() {
    if (!newCustomer.name.trim()) return;
    if (editingCustomerId) {
      setCustomers((prev) => prev.map((c) => (c.id === editingCustomerId ? { ...c, ...newCustomer } : c)));
    } else {
      const c = { id: uid(), createdAt: Date.now(), ...newCustomer };
      setCustomers((prev) => [...prev, c]);
      // If the modal was opened from the invoice form, select the new customer.
      setDraft((d) => (d ? { ...d, customerId: c.id } : d));
    }
    setNewCustomer(blankCustomerForm());
    setEditingCustomerId(null);
    setShowCustomerModal(false);
  }

  function openAddCustomer() {
    setEditingCustomerId(null);
    setNewCustomer(blankCustomerForm());
    setShowCustomerModal(true);
  }

  function openEditCustomer(c) {
    setEditingCustomerId(c.id);
    setNewCustomer({
      name: c.name || "", phone1: c.phone1 || "", phone2: c.phone2 || "",
      email: c.email || "", address: c.address || "",
      shipName: c.shipName || "", shipAddress: c.shipAddress || "", shipCity: c.shipCity || "",
      shipState: c.shipState || "", transporter: c.transporter || "",
      shipPin: c.shipPin || "", shipPhone: c.shipPhone || "",
      openingBalance: c.openingBalance || "", openingBalanceType: c.openingBalanceType || "Dr",
      openingBalanceDate: c.openingBalanceDate || todayISO(),
    });
    setShowCustomerModal(true);
  }

  // Bulk-delete Chart of Accounts rows by name. Customers with invoices/
  // receipts and banks referenced by receipts are skipped; system accounts
  // can never be deleted. Returns a short summary for messaging.
  function deleteAccountsByName(names) {
    const nameSet = new Set(names.map((n) => n.toLowerCase()));
    let deleted = 0, skipped = 0;
    const custBlocked = new Set([
      ...invoices.map((i) => i.customerId),
      ...receipts.map((r) => r.customerId),
    ]);
    const bankBlocked = new Set(receipts.map((r) => (r.bankName || "").toLowerCase()).filter(Boolean));

    const custIdsToDelete = customers
      .filter((c) => nameSet.has(c.name.toLowerCase()) && !custBlocked.has(c.id))
      .map((c) => c.id);
    const custSkipped = customers.filter((c) => nameSet.has(c.name.toLowerCase()) && custBlocked.has(c.id)).length;

    const bankIdsToDelete = bankAccounts
      .filter((b) => nameSet.has(b.bankName.toLowerCase()) && !bankBlocked.has(b.bankName.toLowerCase()))
      .map((b) => b.id);
    const bankSkipped = bankAccounts.filter((b) => nameSet.has(b.bankName.toLowerCase()) && bankBlocked.has(b.bankName.toLowerCase())).length;

    if (custIdsToDelete.length) setCustomers((prev) => prev.filter((c) => !custIdsToDelete.includes(c.id)));
    if (bankIdsToDelete.length) setBankAccounts((prev) => prev.filter((b) => !bankIdsToDelete.includes(b.id)));
    deleted = custIdsToDelete.length + bankIdsToDelete.length;
    skipped = custSkipped + bankSkipped;

    if (skipped > 0) {
      setError(`Deleted ${deleted}. Skipped ${skipped} account${skipped !== 1 ? "s" : ""} still in use (has invoices/receipts) or system accounts.`);
      setTimeout(() => setError(""), 5000);
    }
    return { deleted, skipped };
  }

  function deleteCustomer(id) {
    // Mirror the real API: refuse when invoices or receipts reference this customer.
    if (invoices.some((i) => i.customerId === id)) {
      setError("Customer has invoices. Delete or reassign them first.");
      setTimeout(() => setError(""), 4000);
      return false;
    }
    if (receipts.some((r) => r.customerId === id)) {
      setError("Customer has receipts recorded. Delete those first.");
      setTimeout(() => setError(""), 4000);
      return false;
    }
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    if (viewingCustomerId === id) {
      setViewingCustomerId(null);
      setCustomerView("list");
    }
    return true;
  }

  // ---------- receipts ----------
  const blankReceiptForm = () => ({
    customerId: "", date: todayISO(), amount: "", mode: "Cash",
    invoiceId: "", reference: "", notes: "",
  });

  function nextReceiptNo(list) {
    let max = 0;
    for (const r of list) {
      const m = (r.receiptNo || "").match(/(\d+)$/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `RCT-${String(max + 1).padStart(3, "0")}`;
  }

  // Derive linked invoice status from its receipts (paid when fully covered).
  function recomputeInvoiceStatus(invoiceId, receiptList) {
    if (!invoiceId) return;
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const covered = receiptList
      .filter((r) => r.invoiceId === invoiceId)
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const status = covered >= invoiceTotal(inv) && covered > 0 ? "Paid" : "Unpaid";
    setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? { ...i, status } : i)));
  }

  // Reconcile EVERY invoice's status against its linked receipts in one pass.
  // The per-invoice function above only runs when a receipt is added/edited/
  // deleted in the app, so any path that brings in data wholesale — backup
  // restore, CSV import, QR import — could leave an invoice marked Unpaid
  // even though a receipt covering it exists. Treating the receipts as the
  // source of truth and re-deriving the flag keeps those in step.
  // Returns the corrected invoice list (pure — caller decides what to do).
  function reconcileInvoiceStatuses(invoiceList, receiptList) {
    const covered = new Map();
    const credit = (id, amt) => covered.set(id, (covered.get(id) || 0) + amt);
    for (const r of receiptList || []) {
      if (Array.isArray(r.allocations) && r.allocations.length) {
        // A single combined receipt covering several invoices for the same
        // customer — credit each invoice only its own allocated share, not
        // the full receipt amount.
        for (const a of r.allocations) {
          if (a.invoiceId) credit(a.invoiceId, Number(a.amount) || 0);
        }
      } else if (r.invoiceId) {
        credit(r.invoiceId, Number(r.amount) || 0);
      }
    }
    let changed = false;
    const next = (invoiceList || []).map((inv) => {
      const paid = covered.get(inv.id) || 0;
      const status = paid > 0 && paid >= invoiceTotal(inv) ? "Paid" : "Unpaid";
      if (status === inv.status) return inv;
      changed = true;
      return { ...inv, status };
    });
    return changed ? next : invoiceList;
  }

  function addReceipt(form) {
    if (!form.customerId) {
      setError("Pick a customer for the receipt.");
      setTimeout(() => setError(""), 3000);
      return false;
    }
    if (!(Number(form.amount) > 0)) {
      setError("Enter a receipt amount.");
      setTimeout(() => setError(""), 3000);
      return false;
    }
    const r = {
      id: uid(),
      receiptNo: nextReceiptNo(receipts),
      createdAt: Date.now(),
      ...form,
      invoiceId: form.invoiceId || null,
    };
    const next = [r, ...receipts];
    setReceipts(next);
    recomputeInvoiceStatus(r.invoiceId, next);
    return true;
  }

  // Opens the receipt form prefilled against a specific invoice. The amount
  // defaults to what's still OUTSTANDING on that invoice (total less any
  // receipts already linked to it), not the full invoice value — otherwise
  // adding a second receipt to a part-paid invoice would suggest overpaying.
  // Everything stays editable; mode defaults to Cash as requested.
  function openReceiptForInvoice(inv) {
    if (!inv) return;
    const alreadyReceived = receipts
      .filter((r) => r.invoiceId === inv.id)
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const outstanding = invoiceTotal(inv) - alreadyReceived;
    setEditingReceipt({
      customerId: inv.customerId,
      date: todayISO(),
      amount: outstanding > 0.5 ? String(Math.round(outstanding)) : "",
      mode: "Cash",
      invoiceId: inv.id,
      reference: "",
      notes: "",
      bankAccountId: "",
    });
    setShowReceiptModal(true);
  }

  // Saves the unit list. Line items store the unit by *name*, so a rename has
  // to rewrite every saved item too — otherwise those lines would point at a
  // unit that no longer exists and silently lose their size/abbreviation
  // handling.
  function saveUnits(next, oldName, newName) {
    setUnits(next);
    if (oldName && newName && oldName !== newName) {
      const rename = (items) => (items || []).map((it) => (it.unit === oldName ? { ...it, unit: newName } : it));
      setInvoices((prev) => prev.map((inv) => (inv.items ? { ...inv, items: rename(inv.items) } : inv)));
      setPurchases((prev) => prev.map((p) => (p.items ? { ...p, items: rename(p.items) } : p)));
    }
  }

  // Cancels or restores a single line on a saved invoice. The line is kept
  // (so the Sr numbers of the others don't shift — the physical goods are
  // already numbered against them) but stops counting toward any total.
  // Invoice status is re-derived afterwards, since the total has changed and
  // an existing receipt may now cover the invoice in full.
  function toggleItemCancel(invoice, itemId) {
    setInvoices((prev) => {
      const next = prev.map((inv) => (inv.id !== invoice.id ? inv : {
        ...inv,
        items: (inv.items || []).map((it) => (it.id === itemId ? { ...it, cancelled: !it.cancelled } : it)),
      }));
      return reconcileInvoiceStatuses(next, receipts);
    });
  }

  // ---------- payments ----------
  // Records a payment and keeps the linked purchase bill's Paid/Unpaid status
  // in sync with what's actually been paid against it, mirroring receipts.
  function addPayment(p) {
    setPayments((prev) => {
      const next = [...prev, p];
      setPurchases((ps) => reconcilePurchaseStatuses(ps, next));
      return next;
    });
  }
  function updatePayment(p) {
    setPayments((prev) => {
      const next = prev.map((x) => (x.id === p.id ? p : x));
      setPurchases((ps) => reconcilePurchaseStatuses(ps, next));
      return next;
    });
  }

  // Opens the payment form prefilled against a specific purchase bill — same
  // idea as openReceiptForInvoice: amount defaults to what's still
  // outstanding on the bill, not the full bill value.
  function openPaymentForPurchase(p) {
    if (!p) return;
    const alreadyPaid = payments
      .filter((pay) => pay.purchaseId === p.id)
      .reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
    const outstanding = purchaseTotal(p) - alreadyPaid;
    setEditingPayment({
      vendorId: p.vendorId,
      date: todayISO(),
      amount: outstanding > 0.5 ? String(Math.round(outstanding)) : "",
      mode: "Cash",
      purchaseId: p.id,
      bankName: "",
      reference: "",
      notes: "",
    });
    setShowPaymentModal(true);
  }

  // Records one payment per bill in a single batch — used by the "Add
  // Payment" bulk action when multiple purchase bills are selected at once.
  // entries: [{ purchaseId, allocations, vendorId, amount, date, mode,
  // bankName, reference, notes }]. `allocations` (when a payment covers
  // several bills for the same vendor) is [{purchaseId, amount}] — the exact
  // per-bill breakdown, so reconcilePurchaseStatuses can still credit each
  // bill correctly even though the payment itself isn't tied to just one.
  // One setPayments/reconcile pass covers the whole batch rather than one
  // round-trip per bill.
  function bulkAddPayments(entries) {
    if (!entries || !entries.length) return;
    let counter = payments.length;
    const built = entries.map((e) => {
      counter++;
      return {
        id: uid(),
        paymentNo: `PAY-${String(counter).padStart(3, "0")}`,
        createdAt: Date.now(),
        vendorId: e.vendorId,
        purchaseId: e.purchaseId || null,
        allocations: e.allocations || null,
        date: e.date,
        amount: e.amount,
        mode: e.mode,
        bankName: e.bankName || "",
        reference: e.reference || "",
        notes: e.notes || "",
      };
    });
    setPayments((prev) => {
      const next = [...built, ...prev];
      setPurchases((ps) => reconcilePurchaseStatuses(ps, next));
      return next;
    });
  }

  // Same idea as bulkAddPayments, for receipts against several invoices at
  // once (Sales tab's bulk-selection toolbar). `allocations` is
  // [{invoiceId, amount}] when one receipt covers several invoices for the
  // same customer.
  function bulkAddReceipts(entries) {
    if (!entries || !entries.length) return;
    let counter = receipts.length;
    const built = entries.map((e) => {
      counter++;
      return {
        id: uid(),
        receiptNo: `RCT-${String(counter).padStart(3, "0")}`,
        createdAt: Date.now(),
        customerId: e.customerId,
        invoiceId: e.invoiceId || null,
        allocations: e.allocations || null,
        date: e.date,
        amount: e.amount,
        mode: e.mode,
        bankName: e.bankName || "",
        accountNumber: "",
        reference: e.reference || "",
        notes: e.notes || "",
      };
    });
    setReceipts((prev) => {
      const next = [...built, ...prev];
      setInvoices((invs) => reconcileInvoiceStatuses(invs, next));
      return next;
    });
  }

  function updateReceipt(id, form) {
    if (!form.customerId) {
      setError("Pick a customer for the receipt.");
      setTimeout(() => setError(""), 3000);
      return false;
    }
    if (!(Number(form.amount) > 0)) {
      setError("Enter a receipt amount.");
      setTimeout(() => setError(""), 3000);
      return false;
    }
    const old = receipts.find((r) => r.id === id);
    const newInvoiceId = form.invoiceId || null;
    const next = receipts.map((r) => (r.id === id ? { ...r, ...form, invoiceId: newInvoiceId } : r));
    setReceipts(next);
    if (old?.invoiceId) recomputeInvoiceStatus(old.invoiceId, next);
    if (newInvoiceId && newInvoiceId !== old?.invoiceId) recomputeInvoiceStatus(newInvoiceId, next);
    return true;
  }

  function deleteReceipt(id) {
    const r = receipts.find((x) => x.id === id);
    const next = receipts.filter((x) => x.id !== id);
    setReceipts(next);
    if (r?.invoiceId) recomputeInvoiceStatus(r.invoiceId, next);
  }

  function deleteReceipts(ids) {
    const idSet = new Set(ids);
    const affectedInvoices = receipts.filter((r) => idSet.has(r.id) && r.invoiceId).map((r) => r.invoiceId);
    const next = receipts.filter((r) => !idSet.has(r.id));
    setReceipts(next);
    affectedInvoices.forEach((invId) => recomputeInvoiceStatus(invId, next));
  }

  // Balance follows the real app's formula:
  // opening (Dr +, Cr −) + all invoice totals − all receipts for the customer.
  // Positive = Dr (customer owes), negative = Cr (advance held).
  // Balance lookups get called from list sort comparators, dashboard KPIs,
  // aging and RFM — easily hundreds of times per render. Computing one per
  // call re-scanned every invoice and receipt each time (measured at 3k
  // invoices: 337ms just to sort the customers list, re-run on every
  // keystroke). Building the whole map once per data change makes each
  // lookup O(1); the function signature is unchanged so every existing
  // caller keeps working.
  const customerBalances = useMemo(() => {
    // "As on" the customers-tab To date when set; otherwise all history.
    const upTo = (d) => !custTo || d <= custTo;
    const m = new Map();
    for (const c of customers) {
      m.set(c.id, (Number(c.openingBalance) || 0) * (c.openingBalanceType === "Cr" ? -1 : 1));
    }
    for (const i of invoices) {
      if (!m.has(i.customerId) || !upTo(i.date)) continue;
      m.set(i.customerId, m.get(i.customerId) + invoiceTotal(i));
    }
    for (const r of receipts) {
      if (!m.has(r.customerId) || !upTo(r.date)) continue;
      m.set(r.customerId, m.get(r.customerId) - (Number(r.amount) || 0));
    }
    return m;
  }, [customers, invoices, receipts, custTo]);

  function customerOutstanding(customerId) {
    return customerBalances.get(customerId) ?? 0;
  }

  // ---------- vendors (accounts payable) ----------
  // Vendor balance = what we owe: opening (Cr +) + purchases − payments.
  // Same Map treatment as customers above.
  const vendorBalances = useMemo(() => {
    const m = new Map();
    for (const v of vendors) {
      m.set(v.id, (Number(v.openingBalance) || 0) * (v.openingBalanceType === "Dr" ? -1 : 1));
    }
    for (const p of purchases) {
      if (!m.has(p.vendorId)) continue;
      m.set(p.vendorId, m.get(p.vendorId) + purchaseTotal(p));
    }
    for (const p of payments) {
      if (!m.has(p.vendorId)) continue;
      m.set(p.vendorId, m.get(p.vendorId) - (Number(p.amount) || 0));
    }
    return m;
  }, [vendors, purchases, payments]);

  function vendorOutstanding(vendorId) {
    return vendorBalances.get(vendorId) ?? 0;
  }

  function saveVendor(v) {
    if (!v.name?.trim()) return false;
    if (v.id) {
      setVendors((prev) => prev.map((x) => (x.id === v.id ? v : x)));
    } else {
      setVendors((prev) => [...prev, { ...v, id: uid(), createdAt: Date.now() }]);
    }
    return true;
  }

  function deleteVendor(id) {
    if (purchases.some((p) => p.vendorId === id)) {
      setError("Vendor has purchase bills. Delete those first.");
      setTimeout(() => setError(""), 4000);
      return false;
    }
    if (payments.some((p) => p.vendorId === id)) {
      setError("Vendor has payments recorded. Delete those first.");
      setTimeout(() => setError(""), 4000);
      return false;
    }
    setVendors((prev) => prev.filter((v) => v.id !== id));
    if (viewingVendorId === id) {
      setViewingVendorId(null);
      setVendorView("list");
    }
    return true;
  }

  function quickRangeDates(kind) {
    const now = new Date();
    let from, to;
    if (kind === "current") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (kind === "previous") {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      from = new Date(fyStartYear, 3, 1);
      to = new Date(fyStartYear + 1, 2, 31);
    }
    return { from: toLocalISO(from), to: toLocalISO(to) };
  }

  function setQuickRange(kind) {
    const now = new Date();
    let from, to;
    if (kind === "current") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (kind === "previous") {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (kind === "fy") {
      // Indian financial year: 1 Apr – 31 Mar
      const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      from = new Date(fyStartYear, 3, 1);
      to = new Date(fyStartYear + 1, 2, 31);
    }
    setDateFrom(toLocalISO(from));
    setDateTo(toLocalISO(to));
  }

  // The same snapshot exportBackup writes to a file — reused by Cloud Sync so
  // what gets uploaded is byte-for-byte what a local backup would contain.
  function buildSyncBook() {
    return {
      meta: { app: "textile-bill", version: 3, exportedAt: new Date().toISOString(), company: activeCompanyName },
      customers, invoices, receipts, bankAccounts, vendors, purchases, payments, units, shipFroms, counters,
    };
  }

  // Builds the backup file without saving it, so callers can either download
  // it or hand it to the native share sheet (Google Drive, Files, Mail…).
  function buildBackupFile() {
    const payload = JSON.stringify({
      meta: { app: "textile-bill", version: 3, exportedAt: new Date().toISOString(), company: activeCompanyName },
      customers, invoices, receipts, bankAccounts, vendors, purchases, payments, units, shipFroms, counters,
    }, null, 2);
    const slug = (activeCompanyName || "company").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const fname = `textile-bill-${slug}-${todayISO()}.json`;
    const blob = new Blob([payload], { type: "application/json" });
    let file;
    try {
      file = new File([blob], fname, { type: "application/json" });
    } catch {
      file = blob;
    }
    return { file, blob, fname };
  }

  // Records that a backup actually happened — powers the "haven't backed up
  // in a while" reminder banner, per company since each is backed up
  // independently.
  function markBackedUp() {
    const when = new Date().toISOString();
    try { localStorage.setItem(`textile-bill-lastbackup-${activeCompanyId}`, when); } catch {}
    setLastBackupAt(when);
  }

  function exportBackup() {
    const { blob, fname } = buildBackupFile();
    downloadBlob(blob, fname);
    markBackedUp();
  }

  // Two-tap share, for the same iOS reason as the PDF Share button: Safari
  // only allows navigator.share() to run immediately within the tap that
  // triggered it, and building the file takes long enough to lose that
  // window. First tap prepares, second tap (a fresh gesture) opens the share
  // sheet — where Google Drive, Files, Mail etc. appear as destinations.
  async function shareBackup() {
    if (backupSharePayload) {
      const { file, fname } = backupSharePayload;
      try {
        await navigator.share({ files: [file], title: fname });
        markBackedUp();
      } catch (e) {
        if (e?.name !== "AbortError") {
          downloadBlob(file, fname);
          markBackedUp();
        }
      } finally {
        setBackupSharePayload(null);
      }
      return;
    }
    const prepared = buildBackupFile();
    if (canShareFiles() && navigator.canShare?.({ files: [prepared.file] })) {
      setBackupSharePayload(prepared);
    } else {
      // Desktop and anywhere file sharing isn't supported — just download.
      downloadBlob(prepared.blob, prepared.fname);
      markBackedUp();
    }
  }

  // Exports in the other "textile-bill-pro" app's own schema — the exact
  // reverse of the translation importBackup does when reading one of its
  // backups (see the isProApp branch below). That app validates every id as
  // a real number, but this app's own ids are random strings (uid()), so a
  // straight re-export of our data fails its restore with "entry without a
  // valid numeric id". Fresh sequential numeric ids are assigned here to
  // every record, with every foreign key (customerId, vendorId, invoiceId,
  // purchaseId, partyId) remapped to match. Receipts/payments carrying
  // `allocations` (this app's multi-bill combined-payment feature) are
  // split back into one record per allocation, since the pro app's schema
  // has no equivalent — only a single invoiceId/purchaseId per payment.
  function exportForProApp() {
    const mapItemOut = (it) => {
      const size = isCountUnit(it.unit) ? 1 : (Number(it.size) || 0);
      return { rate: Number(it.rate) || 0, size, unit: it.unit, quantity: Number(it.qty) || 0, amount: lineAmount(it), description: null };
    };
    const isoOf = (ms) => (ms ? new Date(ms).toISOString() : new Date().toISOString());

    let custCounter = 0;
    const customerIdMap = new Map();
    const custOut = customers.map((c) => {
      custCounter++;
      customerIdMap.set(c.id, custCounter);
      return {
        id: custCounter, name: c.name || "",
        phone: c.phone1 || null, phone2: c.phone2 || null, phone3: null, email: c.email || null,
        address: c.address || null,
        openingBalance: (Number(c.openingBalance) || 0).toFixed(2),
        openingBalanceType: (c.openingBalanceType || "Dr").toLowerCase(),
        openingBalanceDate: c.openingBalanceDate || todayISO(),
        createdAt: isoOf(c.createdAt),
      };
    });

    let vendCounter = 0;
    const vendorIdMap = new Map();
    const vendOut = vendors.map((v) => {
      vendCounter++;
      vendorIdMap.set(v.id, vendCounter);
      return {
        id: vendCounter, name: v.name || "",
        phone: v.phone1 || null, phone2: v.phone2 || null, phone3: null, email: v.email || null,
        address: v.address || null,
        openingBalance: (Number(v.openingBalance) || 0).toFixed(2),
        openingBalanceType: (v.openingBalanceType || "Cr").toLowerCase(),
        openingBalanceDate: v.openingBalanceDate || todayISO(),
        createdAt: isoOf(v.createdAt),
      };
    });

    let bankCounter = 0;
    const bankOut = bankAccounts.map((b) => {
      bankCounter++;
      return {
        id: bankCounter, name: b.bankName || "", bankName: b.bankName || "",
        accountNumber: b.accountNumber || null, ifsc: b.ifsc || null, notes: b.notes || null,
        createdAt: isoOf(b.createdAt),
      };
    });

    let invCounter = 0;
    const invoiceIdMap = new Map();
    const invOut = invoices.map((inv) => {
      invCounter++;
      invoiceIdMap.set(inv.id, invCounter);
      const itemsOut = (inv.items || []).filter((it) => !isCancelledItem(it)).map(mapItemOut);
      const subtotal = itemsOut.reduce((s, it) => s + it.amount, 0);
      const expenses = inv.expenses || [];
      const expenseTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      let paid = 0;
      for (const r of receipts) {
        if (r.invoiceId === inv.id) paid += Number(r.amount) || 0;
        else if (Array.isArray(r.allocations)) {
          const a = r.allocations.find((x) => x.invoiceId === inv.id);
          if (a) paid += Number(a.amount) || 0;
        }
      }
      return {
        id: invCounter, invoiceNumber: inv.invoiceNo || "",
        customerId: customerIdMap.get(inv.customerId) || null,
        date: inv.date || todayISO(), dueDate: null,
        items: itemsOut,
        subtotal: subtotal.toFixed(2), discountAmount: "0.00", taxAmount: "0.00",
        otherExpense: expenseTotal.toFixed(2),
        otherExpenseLabel: expenses[0]?.label || "Other Expense",
        otherExpenses: expenses.map((e) => ({ label: e.label || "", amount: Number(e.amount) || 0 })),
        roundOff: "0.00",
        totalAmount: (subtotal + expenseTotal).toFixed(2),
        paidAmount: paid.toFixed(2),
        status: (inv.status || "Unpaid").toLowerCase(),
        notes: inv.reference || null,
        createdAt: isoOf(inv.createdAt), createdBy: null, updatedAt: isoOf(inv.createdAt),
      };
    });

    let purCounter = 0;
    const purchaseIdMap = new Map();
    const purOut = purchases.map((p) => {
      purCounter++;
      purchaseIdMap.set(p.id, purCounter);
      const itemsSrc = Array.isArray(p.items) && p.items.length
        ? p.items
        : (p.qty || p.rate) ? [{ unit: p.unit || "Pcs", qty: p.qty || "", size: p.size || "", rate: p.rate || "" }] : [];
      const itemsOut = itemsSrc.map(mapItemOut);
      const itemsSum = itemsOut.reduce((s, it) => s + it.amount, 0);
      const totalAmount = Number(p.amount) || itemsSum; // amount is authoritative in our model
      let paid = 0;
      for (const pay of payments) {
        if (pay.purchaseId === p.id) paid += Number(pay.amount) || 0;
        else if (Array.isArray(pay.allocations)) {
          const a = pay.allocations.find((x) => x.purchaseId === p.id);
          if (a) paid += Number(a.amount) || 0;
        }
      }
      return {
        id: purCounter, billNumber: p.billNo || "",
        vendorId: vendorIdMap.get(p.vendorId) || null,
        date: p.date || todayISO(), dueDate: null,
        items: itemsOut,
        subtotal: itemsSum.toFixed(2), discountAmount: "0.00", taxAmount: "0.00", otherExpenses: [],
        roundOff: "0.00",
        totalAmount: totalAmount.toFixed(2),
        paidAmount: paid.toFixed(2),
        status: (p.status || "Unpaid").toLowerCase(),
        notes: p.notes || null,
        createdAt: isoOf(p.createdAt), createdBy: null, updatedAt: isoOf(p.createdAt),
      };
    });

    let payCounter = 0;
    const payOut = [];
    const pushPayment = (base, partyType, partyId, invoiceId, purchaseId, amount, type) => {
      payCounter++;
      payOut.push({
        id: payCounter,
        receiptNumber: base.receiptNo || base.paymentNo || `${type === "receipt" ? "RCT" : "PAY"}-${String(payCounter).padStart(3, "0")}`,
        partyType, partyId,
        date: base.date || todayISO(),
        amount: (Number(amount) || 0).toFixed(2),
        paymentMode: (base.mode || "Cash").toLowerCase(),
        type,
        referenceNumber: base.reference || null,
        bankName: base.bankName || null,
        accountNumber: base.accountNumber || null,
        notes: base.notes || null,
        invoiceId, purchaseId,
        createdAt: isoOf(base.createdAt), createdBy: null, updatedAt: isoOf(base.createdAt),
      });
    };
    for (const r of receipts) {
      const custId = customerIdMap.get(r.customerId) || null;
      if (Array.isArray(r.allocations) && r.allocations.length) {
        for (const a of r.allocations) pushPayment(r, "customer", custId, invoiceIdMap.get(a.invoiceId) || null, null, a.amount, "receipt");
      } else {
        pushPayment(r, "customer", custId, r.invoiceId ? (invoiceIdMap.get(r.invoiceId) || null) : null, null, r.amount, "receipt");
      }
    }
    for (const p of payments) {
      const vendId = vendorIdMap.get(p.vendorId) || null;
      if (Array.isArray(p.allocations) && p.allocations.length) {
        for (const a of p.allocations) pushPayment(p, "vendor", vendId, null, purchaseIdMap.get(a.purchaseId) || null, a.amount, "payment");
      } else {
        pushPayment(p, "vendor", vendId, null, p.purchaseId ? (purchaseIdMap.get(p.purchaseId) || null) : null, p.amount, "payment");
      }
    }

    const payload = JSON.stringify({
      meta: { app: "textile-bill-pro", version: 1, exportedAt: new Date().toISOString() },
      customers: custOut, vendors: vendOut, bankAccounts: bankOut,
      invoices: invOut, purchases: purOut, payments: payOut,
    }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = (activeCompanyName || "company").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.download = `textile-bill-pro-export-${slug}-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Complete Chart of Accounts as Tally Prime master XML: all customers,
  // vendors, and banks, plus the non-default system ledgers that Tally
  // doesn't already provide out of the box (Cash and the Sales/Purchase
  // Accounts groups are Tally defaults, so those stay excluded — Discount
  // Allowed/Received and Round Off are not, so those are included).
  function exportAllTallyMasters() {
    const ledgers = [
      { name: "Sales", type: "Sales", address: "", phone: "", email: "", openingBalance: "", balanceType: "" },
      { name: "Purchases", type: "Purchase", address: "", phone: "", email: "", openingBalance: "", balanceType: "" },
      { name: "Discount Allowed", type: "Expense", address: "", phone: "", email: "", openingBalance: "", balanceType: "" },
      { name: "Discount Received", type: "Income", address: "", phone: "", email: "", openingBalance: "", balanceType: "" },
      // Returns reverse part of a sale/purchase rather than being a fresh
      // expense or income, so they sit against the corresponding trading
      // account group in Tally.
      { name: "Sales Return", type: "Sales", address: "", phone: "", email: "", openingBalance: "", balanceType: "" },
      { name: "Purchase Return", type: "Purchase", address: "", phone: "", email: "", openingBalance: "", balanceType: "" },
      { name: "Round Off", type: "Income", address: "", phone: "", email: "", openingBalance: "", balanceType: "" },
      ...customers.map((c) => ({ name: c.name, type: "Customer", address: c.address || "", shipAddress: c.shipAddress || "", shipCity: c.shipCity || "", shipState: c.shipState || "", shipPin: c.shipPin || "", phone: c.phone1 || "", email: c.email || "", openingBalance: c.openingBalance || "", balanceType: c.openingBalanceType || "Dr" })),
      ...vendors.map((v) => ({ name: v.name, type: "Vendor", address: v.address || "", phone: v.phone1 || "", email: v.email || "", openingBalance: v.openingBalance || "", balanceType: v.openingBalanceType || "Cr" })),
      ...bankAccounts.map((b) => ({ name: b.bankName, type: "Bank", address: "", phone: "", email: "", openingBalance: "", balanceType: "" })),
    ];
    if (ledgers.length <= 5) { setError("No accounts to export."); setTimeout(() => setError(""), 3000); return; }
    downloadTextFile(buildTallyLedgersXml(ledgers, activeCompanyName), `Tally_Masters_${todayISO()}.xml`);
  }

  // Complete transaction report as Tally Prime voucher XML (all Sales,
  // Receipts, Purchases, and Payments).
  function exportAllTallyVouchers() {
    const custName = (id) => customerById.get(id)?.name || "Unknown";
    const vendName = (id) => vendorById.get(id)?.name || "Unknown";
    // Discount-mode and return-mode receipts/payments have no real cash/bank
    // leg — they write off or reverse part of what's owed — so they use the
    // Discount Allowed / Sales Return (customer side) and Discount Received /
    // Purchase Return (vendor side) ledgers and export as Journal vouchers,
    // not Receipt/Payment.
    const isJournalMode = (m) => m === "Discount" || m === "Sale Return" || m === "Purchase Return";
    const receiptModeAcct = (r) => (r.mode === "Cash" ? "Cash" : r.mode === "Discount" ? "Discount Allowed" : r.mode === "Sale Return" ? "Sales Return" : r.mode === "Bank" ? (r.bankName || "Bank") : r.mode);
    const paymentModeAcct = (p) => (p.mode === "Cash" ? "Cash" : p.mode === "Discount" ? "Discount Received" : p.mode === "Purchase Return" ? "Purchase Return" : (p.bankName || p.mode || "Bank"));
    const vouchers = [
      ...invoices.map((inv) => ({ date: inv.date, type: "Sales", ref: inv.invoiceNo, party: custName(inv.customerId), otherLedger: "Sales", amount: invoiceTotal(inv) })),
      ...receipts.map((r) => ({ date: r.date, type: "Receipt", ref: r.receiptNo, party: custName(r.customerId), otherLedger: receiptModeAcct(r), amount: Number(r.amount) || 0, isDiscount: isJournalMode(r.mode) })),
      ...purchases.map((p) => ({ date: p.date, type: "Purchase", ref: p.billNo, party: vendName(p.vendorId), otherLedger: "Purchases", amount: purchaseTotal(p) })),
      ...payments.map((p) => ({ date: p.date, type: "Payment", ref: p.paymentNo, party: vendName(p.vendorId), otherLedger: paymentModeAcct(p), amount: Number(p.amount) || 0, isDiscount: isJournalMode(p.mode) })),
    ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (!vouchers.length) { setError("No transactions to export."); setTimeout(() => setError(""), 3000); return; }
    downloadTextFile(buildTallyVouchersXml(vouchers, activeCompanyName), `Tally_Transactions_${todayISO()}.xml`);
  }
  // Invoice No., Date, Customer, Status, Amount
  function exportSalesCsv() {
    // With rows selected, export just those; otherwise the whole filtered
    // register summary.
    const scope = selected.length
      ? filteredInvoices.filter((i) => selected.includes(i.id))
      : filteredInvoices;
    const data = scope.map((inv) => ({
      "Invoice No.": inv.invoiceNo,
      "Date": inv.date,
      "Customer": customerById.get(inv.customerId)?.name || "",
      "Status": inv.status,
      "Amount": invoiceTotal(inv),
      "Created": inv.createdAt ? new Date(inv.createdAt).toISOString() : "",
    }));
    if (!data.length) {
      setError("Nothing to export with the current filters.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    downloadCsv(data, `Sales_Register_${todayISO()}`);
  }

  // Full invoice export: one row per line item, grouped by invoice (matches
  // the importer's full-invoice format). The invoice's other expense is
  // written on a trailing row for that invoice.
  function exportFullInvoicesCsv() {
    const scope = selected.length
      ? filteredInvoices.filter((i) => selected.includes(i.id))
      : filteredInvoices;
    if (!scope.length) {
      setError("Nothing to export with the current filters.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    const rows = [];
    for (const inv of scope) {
      const custName = customerById.get(inv.customerId)?.name || "";
      const created = inv.createdAt ? new Date(inv.createdAt).toISOString() : "";
      for (const it of inv.items) {
        rows.push({
          "Group": inv.invoiceNo,
          "Customer": custName,
          "Date": inv.date,
          "Type": UNIT_ABBR[it.unit] || it.unit,
          "Qty": it.qty,
          "Size": isCountUnit(it.unit) ? "" : it.size,
          "Rate": it.rate,
          "Reference": inv.reference || "",
          "Other Expense": "",
          "Other Expense Amount": "",
          "Created": created,
        });
      }
      const expTotal = (inv.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      if (expTotal) {
        rows.push({
          "Group": inv.invoiceNo,
          "Customer": custName,
          "Date": inv.date,
          "Type": "", "Qty": "", "Size": "", "Rate": "",
          "Reference": "",
          "Other Expense": (inv.expenses || []).map((e) => e.label).filter(Boolean).join("; ") || "Other Expense",
          "Other Expense Amount": expTotal,
          "Created": created,
        });
      }
    }
    downloadCsv(rows, `Sales_Invoices_${todayISO()}`);
  }

  // CSV import accepting the same columns. Line items aren't in the CSV, so
  // each row becomes a single-line Pcs invoice whose amount matches the file;
  // unknown customers are created by name.
  // Reverse the unit abbreviation used in exports/imports (Yd -> Yards).
  // Common alternate spellings/plurals that don't match UNIT_ABBR's keys
  // exactly — without this, e.g. "Metre" (British spelling) falls through to
  // the Pcs fallback below, which also forces Size to 1, silently corrupting
  // the imported amount (Qty × Size × Rate becomes Qty × 1 × Rate).
  const UNIT_SPELLING_ALIASES = {
    metre: "Meter", metres: "Meter", meters: "Meter",
    yard: "Yards", yds: "Yards",
    piece: "Pcs", pieces: "Pcs", pc: "Pcs",
    roll: "Rolls", rolls: "Rolls",
  };
  function unitFromCsv(t) {
    const s = (t || "").trim();
    if (!s) return "Pcs";
    const sl = s.toLowerCase();
    if (UNIT_SPELLING_ALIASES[sl]) return UNIT_SPELLING_ALIASES[sl];
    const hit = Object.entries(UNIT_ABBR).find(([full, abbr]) => abbr.toLowerCase() === sl || full.toLowerCase() === sl);
    return hit ? hit[0] : (UNIT_OPTIONS.includes(s) ? s : "Pcs");
  }

  function importSalesCsv(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result));
        if (!rows.length) throw new Error("empty");
        // Detect format: "Group" + "Type" columns => full line-item invoices;
        // "Invoice No." + "Amount" => register summary.
        if ("Group" in rows[0] && ("Type" in rows[0] || "Qty" in rows[0])) {
          importFullInvoicesCsv(rows);
        } else if ("Invoice No." in rows[0]) {
          importSalesSummaryCsv(rows);
        } else {
          throw new Error("unrecognized columns");
        }
      } catch (e) {
        setError("Couldn't import: expected either the full invoice format (Group, Customer, Date, Type, Qty, Size, Rate) or the register summary (Invoice No., Date, Customer, Status, Amount).");
        setTimeout(() => setError(""), 6000);
      }
    };
    reader.readAsText(file);
  }

  // Saves a decoded "full data" QR scan as a new invoice — matches or
  // creates the customer by name (same as the CSV importer), and refuses to
  // silently overwrite an existing invoice number.
  function importInvoiceFromQr(decoded) {
    if (invoices.some((i) => i.invoiceNo === decoded.invoiceNo)) {
      setError(`Invoice ${decoded.invoiceNo} already exists — scanning it again won't create a duplicate.`);
      setTimeout(() => setError(""), 5000);
      return false;
    }
    let cust = customers.find((c) => c.name.toLowerCase() === (decoded.customerName || "").toLowerCase());
    if (!cust && decoded.customerName) {
      cust = { id: uid(), name: decoded.customerName, phone1: "", phone2: "", email: "", address: "", openingBalance: "", openingBalanceType: "Dr", openingBalanceDate: todayISO() };
      setCustomers((prev) => [...prev, cust]);
    }
    if (!cust) {
      setError("No customer name found in the scanned code.");
      setTimeout(() => setError(""), 5000);
      return false;
    }
    const newInvoice = {
      id: uid(),
      createdAt: Date.now(),
      invoiceNo: decoded.invoiceNo,
      series: decoded.invoiceNo.startsWith("CC") ? "CC" : "VCH",
      date: decoded.date || todayISO(),
      reference: decoded.reference || "",
      customerId: cust.id,
      items: decoded.items.length ? decoded.items : [{ id: uid(), unit: "Pcs", qty: "1", size: "", rate: "0" }],
      expenses: decoded.expenses || [],
      status: "Unpaid",
    };
    setInvoices((prev) => {
      const next = [...prev, newInvoice];
      setCounters((c) => deriveCounters({ invoices: next }, c));
      return next;
    });
    return true;
  }

  // Full invoices: one row per line item, grouped by "Group" (invoice number).
  // A trailing row with only "Other Expense Amount" carries the invoice's
  // other expense. Line amount = Qty x Size x Rate (Pcs uses size 1).
  function importFullInvoicesCsv(rows) {
    let customerList = [...customers];
    const groups = new Map(); // invoiceNo -> { customer, date, items[], expense }
    for (const row of rows) {
      const invNo = (row["Group"] || "").trim();
      if (!invNo) continue;
      if (!groups.has(invNo)) {
        groups.set(invNo, {
          customerName: (row["Customer"] || "").trim(),
          date: normalizeDate(row["Date"]) || "",
          reference: (row["Reference"] || "").trim(),
          items: [],
          expense: 0,
          expenseLabel: "",
          createdRaw: "",
        });
      }
      const g = groups.get(invNo);
      if (!g.customerName && row["Customer"]) g.customerName = row["Customer"].trim();
      if (!g.date && row["Date"]) g.date = normalizeDate(row["Date"]);
      if (!g.createdRaw && row["Created"]) g.createdRaw = String(row["Created"]).trim();
      // Other Expense Amount can appear on any row (usually a trailing one).
      const oe = Number(row["Other Expense Amount"]) || 0;
      if (oe) g.expense += oe;
      if (!g.expenseLabel && row["Other Expense"]) g.expenseLabel = String(row["Other Expense"]).trim();
      // A line item requires a Type or a Qty+Rate.
      const type = (row["Type"] || "").trim();
      const qty = row["Qty"];
      const rate = row["Rate"];
      if (type || (qty !== "" && rate !== "" && qty != null && rate != null)) {
        if ((qty === "" || qty == null) && !type) continue;
        if (qty === "" && rate === "") continue;
        g.items.push({
          id: uid(),
          unit: unitFromCsv(type),
          qty: String(qty ?? "").trim(),
          size: String(row["Size"] ?? "").trim(),
          rate: String(rate ?? "").trim(),
        });
      }
    }

    // Build all candidate invoices (including ones whose number already
    // exists), then split into new vs duplicate for the resolution prompt.
    const built = [];
    for (const [invNo, g] of groups) {
      if (built.some((i) => i.invoiceNo === invNo)) continue;
      let cust = customerList.find((c) => c.name.toLowerCase() === g.customerName.toLowerCase());
      if (!cust && g.customerName) {
        cust = { id: uid(), name: g.customerName, phone1: "", phone2: "", email: "", address: "", openingBalance: "", openingBalanceType: "Dr", openingBalanceDate: todayISO() };
        customerList.push(cust);
      }
      if (!cust) continue;
      built.push({
        id: uid(),
        createdAt: parseImportedCreatedAt(g.createdRaw, g.date, built.length),
        invoiceNo: invNo,
        series: invNo.startsWith("CC") ? "CC" : "VCH",
        date: g.date || todayISO(),
        reference: g.reference,
        customerId: cust.id,
        items: g.items.length ? g.items : [{ id: uid(), unit: "Pcs", qty: "1", size: "", rate: "0" }],
        expenses: g.expense ? [{ id: uid(), label: g.expenseLabel || "", amount: String(g.expense) }] : [],
        status: "Unpaid",
      });
    }
    if (!built.length) throw new Error("no invoices");

    const existingNos = new Set(invoices.map((i) => i.invoiceNo));
    const fresh = built.filter((i) => !existingNos.has(i.invoiceNo));
    const dups = built.filter((i) => existingNos.has(i.invoiceNo));

    const applyImport = (mode) => {
      setCustomers(customerList);
      if (mode === "replace") {
        const dupNos = new Set(dups.map((i) => i.invoiceNo));
        setInvoices((prev) => {
          const next = [...built, ...prev.filter((i) => !dupNos.has(i.invoiceNo))];
          setCounters((c) => deriveCounters({ invoices: next }, c));
          return next;
        });
      } else {
        // skip: keep existing, add only fresh
        setInvoices((prev) => {
          const next = [...fresh, ...prev];
          setCounters((c) => deriveCounters({ invoices: next }, c));
          return next;
        });
      }
    };

    if (dups.length > 0) {
      setPendingImport({
        label: "invoice",
        newCount: fresh.length,
        dupCount: dups.length,
        onResolve: (mode) => { if (mode !== "cancel") applyImport(mode); setPendingImport(null); },
      });
    } else {
      applyImport("skip");
    }
  }

  function importSalesSummaryCsv(rows) {
    let customerList = [...customers];
    const built = [];
    for (const row of rows) {
      const name = (row["Customer"] || "").trim();
      let cust = customerList.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (!cust && name) {
        cust = { id: uid(), name, phone1: "", phone2: "", email: "", address: "", openingBalance: "", openingBalanceType: "Dr", openingBalanceDate: todayISO() };
        customerList.push(cust);
      }
      const amount = Number(row["Amount"]) || 0;
      const invNo = (row["Invoice No."] || "").trim();
      if (!invNo || !cust) continue;
      if (built.some((i) => i.invoiceNo === invNo)) continue;
      built.push({
        id: uid(),
        createdAt: parseImportedCreatedAt(row["Created"], normalizeDate(row["Date"]), built.length),
        invoiceNo: invNo,
        series: invNo.startsWith("CC") ? "CC" : "VCH",
        date: normalizeDate(row["Date"]) || todayISO(),
        reference: "",
        customerId: cust.id,
        items: [{ id: uid(), unit: "Pcs", qty: "1", size: "", rate: String(amount) }],
        expenses: [],
        status: (row["Status"] || "").toLowerCase() === "paid" ? "Paid" : "Unpaid",
      });
    }
    if (!built.length) throw new Error("no rows");

    const existingNos = new Set(invoices.map((i) => i.invoiceNo));
    const fresh = built.filter((i) => !existingNos.has(i.invoiceNo));
    const dups = built.filter((i) => existingNos.has(i.invoiceNo));
    const applyImport = (mode) => {
      setCustomers(customerList);
      if (mode === "replace") {
        const dupNos = new Set(dups.map((i) => i.invoiceNo));
        setInvoices((prev) => {
          const next = [...built, ...prev.filter((i) => !dupNos.has(i.invoiceNo))];
          setCounters((c) => deriveCounters({ invoices: next }, c));
          return next;
        });
      } else {
        setInvoices((prev) => {
          const next = [...fresh, ...prev];
          setCounters((c) => deriveCounters({ invoices: next }, c));
          return next;
        });
      }
    };
    if (dups.length > 0) {
      setPendingImport({ label: "invoice", newCount: fresh.length, dupCount: dups.length, onResolve: (mode) => { if (mode !== "cancel") applyImport(mode); setPendingImport(null); } });
    } else {
      applyImport("skip");
    }
  }

  // Import customers/accounts from CSV (Account Name, Header, Address, Phone,
  // Phone 2). Only "Customer" header rows create customer masters here.
  // Receipts CSV in the attached format:
  // Date, Party Name, Amount, Mode, Reference, Bank Name, Account Number, Notes
  function exportReceiptsCsv(scopedReceipts) {
    const list = scopedReceipts || receipts;
    const data = [...list]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((r) => ({
        "Date": r.date,
        "Party Name": customerById.get(r.customerId)?.name || "",
        "Amount": Number(r.amount) || 0,
        "Mode": (r.mode || "").toLowerCase(),
        "Reference": r.reference || "",
        "Bank Name": r.bankName || "",
        "Account Number": r.accountNumber || "",
        "Notes": r.notes || "",
        "Created": r.createdAt ? new Date(r.createdAt).toISOString() : "",
      }));
    if (!data.length) {
      setError("No receipts to export.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    downloadCsv(data, `Receipts_${todayISO()}`);
  }

  function importReceiptsCsv(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result));
        if (!rows.length || !("Party Name" in rows[0])) throw new Error("bad columns");
        let customerList = [...customers];
        const built = [];
        let counter = receipts.length;
        for (const row of rows) {
          const name = (row["Party Name"] || "").trim();
          const amount = Number(row["Amount"]) || 0;
          if (!name || !(amount > 0)) continue;
          let cust = customerList.find((c) => c.name.toLowerCase() === name.toLowerCase());
          if (!cust) {
            cust = { id: uid(), name, phone1: "", phone2: "", email: "", address: "", openingBalance: "", openingBalanceType: "Dr", openingBalanceDate: todayISO() };
            customerList.push(cust);
          }
          const modeRaw = (row["Mode"] || "cash").trim().toLowerCase();
          const mode = modeRaw === "bank" || modeRaw === "upi" ? "Bank" : modeRaw === "cheque" ? "Cheque" : modeRaw === "discount" ? "Discount" : "Cash";
          counter++;
          built.push({
            id: uid(),
            receiptNo: `RCT-${String(counter).padStart(3, "0")}`,
            createdAt: parseImportedCreatedAt(row["Created"], normalizeDate(row["Date"]), built.length),
            customerId: cust.id,
            date: normalizeDate(row["Date"]) || todayISO(),
            amount: String(amount),
            mode,
            invoiceId: null,
            reference: row["Reference"] || "",
            bankName: row["Bank Name"] || "",
            accountNumber: row["Account Number"] || "",
            notes: row["Notes"] || "",
          });
        }
        if (!built.length) throw new Error("no rows");

        // A receipt "duplicate" = same customer + date + amount + mode already
        // recorded (there's no receipt number in the CSV to key on).
        const sig = (r) => `${r.customerId}|${r.date}|${Number(r.amount)}|${r.mode}`;
        const existingSigs = new Set(receipts.map(sig));
        const fresh = built.filter((r) => !existingSigs.has(sig(r)));
        const dups = built.filter((r) => existingSigs.has(sig(r)));

        const applyImport = (mode) => {
          setCustomers(customerList);
          if (mode === "replace") {
            const dupSigs = new Set(dups.map(sig));
            setReceipts((prev) => {
              const next = [...built, ...prev.filter((r) => !dupSigs.has(sig(r)))];
              // Imported receipts may settle existing invoices — re-derive
              // every invoice's Paid/Unpaid rather than leaving stale flags.
              setInvoices((invs) => reconcileInvoiceStatuses(invs, next));
              return next;
            });
          } else {
            setReceipts((prev) => {
              const next = [...fresh, ...prev];
              setInvoices((invs) => reconcileInvoiceStatuses(invs, next));
              return next;
            });
          }
        };

        if (dups.length > 0) {
          setPendingImport({
            label: "receipt",
            newCount: fresh.length,
            dupCount: dups.length,
            onResolve: (mode) => { if (mode !== "cancel") applyImport(mode); setPendingImport(null); },
          });
        } else {
          applyImport("skip");
        }
      } catch (e) {
        setError("Couldn't import: expected columns Date, Party Name, Amount, Mode…");
        setTimeout(() => setError(""), 5000);
      }
    };
    reader.readAsText(file);
  }

  // Import Tally ledger masters (customers, vendors) with opening balances —
  // for bringing a party list over from an existing Tally company. Reads the
  // XML exported from Tally (Display → List of Accounts → Export, or a
  // "Ledgers" masters export) — the same shape this app's own "Tally
  // Masters XML" export produces, so a round-trip through Tally works too.
  //
  // Ledgers use dotted tag names (ADDRESS.LIST, MAILINGNAME.LIST, …), which
  // CSS-selector syntax would misread as a class selector — querySelector
  // is deliberately avoided here in favour of getElementsByTagName, which
  // has no such ambiguity.
  //
  // Sign convention matches Tally's own export: a negative OPENINGBALANCE is
  // Dr, a positive one is Cr — verified against this app's own export code,
  // which uses the identical convention in reverse.
  function importTallyMastersXml(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const xmlText = String(reader.result);
        const doc = new DOMParser().parseFromString(xmlText, "text/xml");
        if (doc.getElementsByTagName("parsererror").length) throw new Error("bad xml");

        const ledgerEls = Array.from(doc.getElementsByTagName("LEDGER"));
        if (!ledgerEls.length) throw new Error("no ledgers");

        const textOf = (el, tag) => {
          const n = el.getElementsByTagName(tag)[0];
          return n && n.textContent ? n.textContent.trim() : "";
        };
        const asOn = currentFYDates().from;

        const custCandidates = [];
        const vendCandidates = [];
        let skipped = 0;

        for (const el of ledgerEls) {
          const name = (el.getAttribute("NAME") || "").trim();
          if (!name) continue;
          const parent = textOf(el, "PARENT").toLowerCase();
          const isCustomer = parent.includes("debtor");
          const isVendor = parent.includes("creditor");
          if (!isCustomer && !isVendor) { skipped++; continue; }

          const addrLines = [];
          for (const list of Array.from(el.getElementsByTagName("ADDRESS.LIST"))) {
            for (const a of Array.from(list.getElementsByTagName("ADDRESS"))) {
              const t = (a.textContent || "").trim();
              if (t) addrLines.push(t);
            }
          }
          const obRaw = textOf(el, "OPENINGBALANCE");
          const obNum = obRaw ? Number(obRaw) : 0;
          const hasBalance = obRaw !== "" && !Number.isNaN(obNum) && obNum !== 0;

          const record = {
            id: uid(),
            name,
            phone1: textOf(el, "LEDGERMOBILE") || textOf(el, "LEDGERPHONE"),
            phone2: "",
            email: textOf(el, "EMAIL"),
            address: addrLines.join(", "),
            openingBalance: hasBalance ? String(Math.abs(obNum)) : "",
            openingBalanceType: hasBalance ? (obNum < 0 ? "Dr" : "Cr") : (isCustomer ? "Dr" : "Cr"),
            openingBalanceDate: asOn,
            createdAt: Date.now(),
          };
          (isCustomer ? custCandidates : vendCandidates).push(record);
        }

        if (!custCandidates.length && !vendCandidates.length) {
          throw new Error(skipped ? "no party ledgers" : "no ledgers");
        }

        const existingCustNames = new Set(customers.map((c) => c.name.toLowerCase()));
        const existingVendNames = new Set(vendors.map((v) => v.name.toLowerCase()));
        const custDups = custCandidates.filter((c) => existingCustNames.has(c.name.toLowerCase()));
        const custFresh = custCandidates.filter((c) => !existingCustNames.has(c.name.toLowerCase()));
        const vendDups = vendCandidates.filter((v) => existingVendNames.has(v.name.toLowerCase()));
        const vendFresh = vendCandidates.filter((v) => !existingVendNames.has(v.name.toLowerCase()));
        const dupCount = custDups.length + vendDups.length;
        const newCount = custFresh.length + vendFresh.length;

        const applyImport = (mode) => {
          if (mode === "replace") {
            setCustomers((prev) => {
              const byName = new Map(custDups.map((c) => [c.name.toLowerCase(), c]));
              const merged = prev.map((c) => {
                const repl = byName.get(c.name.toLowerCase());
                return repl ? { ...c, ...repl, id: c.id, createdAt: c.createdAt } : c;
              });
              return [...merged, ...custFresh];
            });
            setVendors((prev) => {
              const byName = new Map(vendDups.map((v) => [v.name.toLowerCase(), v]));
              const merged = prev.map((v) => {
                const repl = byName.get(v.name.toLowerCase());
                return repl ? { ...v, ...repl, id: v.id, createdAt: v.createdAt } : v;
              });
              return [...merged, ...vendFresh];
            });
          } else {
            if (custFresh.length) setCustomers((prev) => [...prev, ...custFresh]);
            if (vendFresh.length) setVendors((prev) => [...prev, ...vendFresh]);
          }
          if (skipped > 0) {
            const imported = newCount + (mode === "replace" ? dupCount : 0);
            setError(`Imported ${imported} part${imported !== 1 ? "ies" : "y"}. Skipped ${skipped} non-party ledger${skipped !== 1 ? "s" : ""} (Cash, Bank, Sales, etc.) — this app only imports Sundry Debtors/Creditors as customers/vendors.`);
            setTimeout(() => setError(""), 6000);
          }
        };

        if (dupCount > 0) {
          setPendingImport({
            label: "party",
            newCount,
            dupCount,
            // Named so the person can see exactly who's about to be
            // overwritten or skipped, not just a bare count — the "party"
            // label alone doesn't say whether it's a name they'd recognize.
            dupNames: [
              ...custDups.map((c) => ({ name: c.name, kind: "Customer" })),
              ...vendDups.map((v) => ({ name: v.name, kind: "Vendor" })),
            ],
            onResolve: (mode) => { if (mode !== "cancel") applyImport(mode); setPendingImport(null); },
          });
        } else {
          applyImport("skip");
        }
      } catch (e) {
        setError("Couldn't import: expected a Tally ledger-masters XML export (Sundry Debtors/Creditors ledgers, with PARENT and OPENINGBALANCE tags).");
        setTimeout(() => setError(""), 6000);
      }
    };
    reader.readAsText(file);
  }

  function importCustomersCsv(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result));
        if (!rows.length) throw new Error("empty");
        const nameKey = ["Account Name", "Name", "name"].find((k) => k in rows[0]);
        if (!nameKey) throw new Error("no name column");

        // Build candidate customers, vendors and banks from the file first.
        const custCandidates = [];
        const vendCandidates = [];
        const bankCandidates = [];
        // Map both raw and accounting-label header names to a category.
        const categoryOf = (t) => {
          const s = (t || "").trim().toLowerCase();
          if (s === "bank" || s === "bank accounts") return "bank";
          if (s === "vendor" || s === "sundry creditors") return "vendor";
          if (s === "customer" || s === "sundry debtors") return "customer";
          return "other"; // sales/purchase/cash system accounts — skipped
        };
        for (const row of rows) {
          const name = (row[nameKey] || "").trim();
          if (!name) continue;
          const cat = categoryOf(row["Type"] || row["Header"]);
          if (cat === "bank") {
            bankCandidates.push({
              id: uid(),
              bankName: name,
              accountNumber: (row["Account Number"] || "").trim(),
              ifsc: (row["IFSC"] || "").trim(),
              notes: (row["Notes"] || "").trim(),
            });
          } else if (cat === "vendor") {
            vendCandidates.push({
              id: uid(),
              name,
              phone1: (row["Phone"] || row["Phone 1"] || "").trim(),
              phone2: (row["Phone 2"] || "").trim(),
              email: (row["Email"] || "").trim(),
              address: (row["Address"] || "").trim(),
              openingBalance: (row["Opening Balance"] || "").trim(),
              openingBalanceType: (row["Balance Type"] || "Cr").trim().toLowerCase() === "dr" ? "Dr" : "Cr",
              openingBalanceDate: (row["Opening Balance Date"] || "").trim() || todayISO(),
              createdAt: Date.now(),
            });
          } else if (cat === "customer") {
            custCandidates.push({
              id: uid(),
              name,
              phone1: (row["Phone"] || row["Phone 1"] || "").trim(),
              phone2: (row["Phone 2"] || "").trim(),
              email: (row["Email"] || "").trim(),
              address: (row["Address"] || "").trim(),
              openingBalance: (row["Opening Balance"] || "").trim(),
              openingBalanceType: (row["Balance Type"] || "Dr").trim().toLowerCase() === "cr" ? "Cr" : "Dr",
              openingBalanceDate: (row["Opening Balance Date"] || "").trim() || todayISO(),
              createdAt: Date.now(),
            });
          }
          // system accounts (Sales/Purchase/Cash) are ignored
        }
        if (!custCandidates.length && !vendCandidates.length && !bankCandidates.length) throw new Error("no rows");

        const existingCustNames = new Set(customers.map((c) => c.name.toLowerCase()));
        const existingVendNames = new Set(vendors.map((v) => v.name.toLowerCase()));
        const existingBankNames = new Set(bankAccounts.map((b) => b.bankName.toLowerCase()));
        const custDups = custCandidates.filter((c) => existingCustNames.has(c.name.toLowerCase()));
        const custFresh = custCandidates.filter((c) => !existingCustNames.has(c.name.toLowerCase()));
        const vendDups = vendCandidates.filter((v) => existingVendNames.has(v.name.toLowerCase()));
        const vendFresh = vendCandidates.filter((v) => !existingVendNames.has(v.name.toLowerCase()));
        const bankDups = bankCandidates.filter((b) => existingBankNames.has(b.bankName.toLowerCase()));
        const bankFresh = bankCandidates.filter((b) => !existingBankNames.has(b.bankName.toLowerCase()));
        const dupCount = custDups.length + vendDups.length + bankDups.length;
        const newCount = custFresh.length + vendFresh.length + bankFresh.length;

        const applyImport = (mode) => {
          if (mode === "replace") {
            setCustomers((prev) => {
              const byName = new Map(custDups.map((c) => [c.name.toLowerCase(), c]));
              const merged = prev.map((c) => {
                const repl = byName.get(c.name.toLowerCase());
                return repl ? { ...repl, id: c.id, createdAt: c.createdAt } : c;
              });
              return [...merged, ...custFresh];
            });
            setVendors((prev) => {
              const byName = new Map(vendDups.map((v) => [v.name.toLowerCase(), v]));
              const merged = prev.map((v) => {
                const repl = byName.get(v.name.toLowerCase());
                return repl ? { ...repl, id: v.id, createdAt: v.createdAt } : v;
              });
              return [...merged, ...vendFresh];
            });
            setBankAccounts((prev) => {
              const byName = new Map(bankDups.map((b) => [b.bankName.toLowerCase(), b]));
              const merged = prev.map((b) => {
                const repl = byName.get(b.bankName.toLowerCase());
                return repl ? { ...repl, id: b.id } : b;
              });
              return [...merged, ...bankFresh];
            });
          } else {
            if (custFresh.length) setCustomers((prev) => [...prev, ...custFresh]);
            if (vendFresh.length) setVendors((prev) => [...prev, ...vendFresh]);
            if (bankFresh.length) setBankAccounts((prev) => [...prev, ...bankFresh]);
          }
        };

        if (dupCount > 0) {
          setPendingImport({
            label: "account",
            newCount,
            dupCount,
            onResolve: (mode) => { if (mode !== "cancel") applyImport(mode); setPendingImport(null); },
          });
        } else {
          applyImport("skip");
        }
      } catch (e) {
        setError("Couldn't import: expected columns Account Name, Type, Phone, Address…");
        setTimeout(() => setError(""), 5000);
      }
    };
    reader.readAsText(file);
  }

  // Import vendors: Name, Phone, Email, Address, Balance, Balance Type.
  function importVendorsCsv(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result));
        if (!rows.length) throw new Error("empty");
        const nameKey = ["Name", "Account Name", "name"].find((k) => k in rows[0]);
        if (!nameKey) throw new Error("no name column");
        const candidates = [];
        for (const row of rows) {
          const name = (row[nameKey] || "").trim();
          if (!name) continue;
          candidates.push({
            id: uid(),
            name,
            phone1: (row["Phone"] || row["Phone 1"] || "").trim(),
            phone2: (row["Phone 2"] || "").trim(),
            email: (row["Email"] || "").trim(),
            address: (row["Address"] || "").trim(),
            openingBalance: (row["Balance"] || row["Opening Balance"] || "").trim(),
            openingBalanceType: (row["Balance Type"] || "Cr").trim().toLowerCase() === "dr" ? "Dr" : "Cr",
            openingBalanceDate: (row["Opening Balance Date"] || "").trim() || todayISO(),
            createdAt: Date.now(),
          });
        }
        if (!candidates.length) throw new Error("no rows");
        const existing = new Set(vendors.map((v) => v.name.toLowerCase()));
        const dups = candidates.filter((v) => existing.has(v.name.toLowerCase()));
        const fresh = candidates.filter((v) => !existing.has(v.name.toLowerCase()));
        const applyImport = (mode) => {
          if (mode === "replace") {
            const byName = new Map(dups.map((v) => [v.name.toLowerCase(), v]));
            setVendors((prev) => {
              const merged = prev.map((v) => {
                const repl = byName.get(v.name.toLowerCase());
                return repl ? { ...repl, id: v.id, createdAt: v.createdAt } : v;
              });
              return [...merged, ...fresh];
            });
          } else {
            setVendors((prev) => [...prev, ...fresh]);
          }
        };
        if (dups.length > 0) {
          setPendingImport({ label: "vendor", newCount: fresh.length, dupCount: dups.length, onResolve: (mode) => { if (mode !== "cancel") applyImport(mode); setPendingImport(null); } });
        } else {
          applyImport("skip");
        }
      } catch (e) {
        setError("Couldn't import vendors: expected Name, Phone, Address, Balance…");
        setTimeout(() => setError(""), 5000);
      }
    };
    reader.readAsText(file);
  }

  // Import purchase bills: grouped line-item format
  // Bill No.,Vendor,Date,Type,Qty,Size,Rate,Reference,Other Expense,Other Expense Amount.
  // Each bill's amount = sum of Qty×Size×Rate lines + Other Expense Amount rows.
  function importPurchasesCsv(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result));
        if (!rows.length) throw new Error("empty");
        const billKey = ["Bill No.", "Bill No", "Invoice No.", "Group"].find((k) => k in rows[0]);
        const vendKey = ["Vendor", "Party", "Customer"].find((k) => k in rows[0]);
        if (!billKey || !vendKey) throw new Error("missing columns");

        // Register-summary format: one row per bill with a direct Amount column
        // (no Qty/Rate). Handle it directly.
        const isSummary = ("Amount" in rows[0]) && !("Qty" in rows[0]);
        if (isSummary) {
          let vendorList = [...vendors];
          const ensureVendorS = (name) => {
            const n = (name || "").trim();
            if (!n) return null;
            let v = vendorList.find((x) => x.name.toLowerCase() === n.toLowerCase());
            if (!v) {
              v = { id: uid(), name: n, phone1: "", phone2: "", email: "", address: "", openingBalance: "", openingBalanceType: "Cr", openingBalanceDate: todayISO(), createdAt: Date.now() };
              vendorList.push(v);
            }
            return v;
          };
          const builtS = [];
          for (const row of rows) {
            const billNo = (row[billKey] || "").trim();
            const amount = Number(row["Amount"]) || 0;
            if (!billNo || !(amount > 0)) continue;
            const vend = ensureVendorS(row[vendKey]);
            if (!vend) continue;
            builtS.push({ id: uid(), createdAt: parseImportedCreatedAt(row["Created"], normalizeDate(row["Date"]), builtS.length), billNo, vendorId: vend.id, date: normalizeDate(row["Date"]) || todayISO(), amount: String(Math.round(amount)), notes: "" });
          }
          if (!builtS.length) throw new Error("no bills");
          const existingS = new Set(purchases.map((p) => p.billNo.toLowerCase()));
          const dupsS = builtS.filter((p) => existingS.has(p.billNo.toLowerCase()));
          const freshS = builtS.filter((p) => !existingS.has(p.billNo.toLowerCase()));
          const applyS = (mode) => {
            setVendors(vendorList);
            if (mode === "replace") {
              const dupNos = new Set(dupsS.map((p) => p.billNo.toLowerCase()));
              setPurchases((prev) => {
                const nextP = [...builtS, ...prev.filter((p) => !dupNos.has(p.billNo.toLowerCase()))];
                setCounters((c) => deriveCounters({ purchases: nextP }, c));
                return nextP;
              });
            } else {
              setPurchases((prev) => {
                const nextP = [...freshS, ...prev];
                setCounters((c) => deriveCounters({ purchases: nextP }, c));
                return nextP;
              });
            }
          };
          if (dupsS.length > 0) {
            setPendingImport({ label: "purchase bill", newCount: freshS.length, dupCount: dupsS.length, onResolve: (mode) => { if (mode !== "cancel") applyS(mode); setPendingImport(null); } });
          } else {
            applyS("skip");
          }
          return;
        }

        // Group rows by bill number.
        const groups = new Map();
        for (const row of rows) {
          const billNo = (row[billKey] || "").trim();
          if (!billNo) continue;
          if (!groups.has(billNo)) groups.set(billNo, []);
          groups.get(billNo).push(row);
        }

        let vendorList = [...vendors];
        const ensureVendor = (name) => {
          const n = name.trim();
          if (!n) return null;
          let v = vendorList.find((x) => x.name.toLowerCase() === n.toLowerCase());
          if (!v) {
            v = { id: uid(), name: n, phone1: "", phone2: "", email: "", address: "", openingBalance: "", openingBalanceType: "Cr", openingBalanceDate: todayISO(), createdAt: Date.now() };
            vendorList.push(v);
          }
          return v;
        };

        const built = [];
        for (const [billNo, lines] of groups) {
          const first = lines.find((l) => (l[vendKey] || "").trim()) || lines[0];
          const vend = ensureVendor(first[vendKey] || "");
          if (!vend) continue;
          const date = normalizeDate(lines[0]["Date"]) || todayISO();
          const createdRaw = lines.find((l) => l["Created"])?.["Created"] || "";
          // Each CSV row within the group becomes its own line item — same
          // one-row-per-line-item convention as the Sales invoice importer —
          // so a purchase bill can carry multiple items, not just a flat total.
          const items = [];
          let otherExpenseTotal = 0;
          for (const l of lines) {
            const type = (l["Type"] || "").trim();
            const qty = l["Qty"];
            const rate = l["Rate"];
            if (type || (qty !== "" && qty != null && rate !== "" && rate != null)) {
              items.push({ id: uid(), unit: unitFromCsv(type), qty: String(qty ?? "").trim(), size: String(l["Size"] ?? "").trim(), rate: String(rate ?? "").trim() });
            }
            otherExpenseTotal += Number(l["Other Expense Amount"]) || 0;
          }
          const itemsAmount = items.reduce((s, it) => s + lineAmount(it), 0);
          const amount = Math.round(itemsAmount + otherExpenseTotal);
          if (!items.length && amount <= 0) continue;
          built.push({ id: uid(), createdAt: parseImportedCreatedAt(createdRaw, date, built.length), billNo, vendorId: vend.id, date, items, amount: String(amount), notes: "" });
        }
        if (!built.length) throw new Error("no bills");

        const existing = new Set(purchases.map((p) => p.billNo.toLowerCase()));
        const dups = built.filter((p) => existing.has(p.billNo.toLowerCase()));
        const fresh = built.filter((p) => !existing.has(p.billNo.toLowerCase()));
        const applyImport = (mode) => {
          setVendors(vendorList);
          if (mode === "replace") {
            const dupNos = new Set(dups.map((p) => p.billNo.toLowerCase()));
            setPurchases((prev) => {
              const nextP = [...built, ...prev.filter((p) => !dupNos.has(p.billNo.toLowerCase()))];
              setCounters((c) => deriveCounters({ purchases: nextP }, c));
              return nextP;
            });
          } else {
            setPurchases((prev) => {
              const nextP = [...fresh, ...prev];
              setCounters((c) => deriveCounters({ purchases: nextP }, c));
              return nextP;
            });
          }
        };
        if (dups.length > 0) {
          setPendingImport({ label: "purchase bill", newCount: fresh.length, dupCount: dups.length, onResolve: (mode) => { if (mode !== "cancel") applyImport(mode); setPendingImport(null); } });
        } else {
          applyImport("skip");
        }
      } catch (e) {
        setError("Couldn't import purchases: expected Bill No., Vendor, Date, Qty, Rate…");
        setTimeout(() => setError(""), 5000);
      }
    };
    reader.readAsText(file);
  }

  // Import payments to vendors: Date, Party Name, Amount, Mode, Bank Name, etc.
  function importPaymentsCsv(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result));
        if (!rows.length || !("Party Name" in rows[0])) throw new Error("bad columns");
        let vendorList = [...vendors];
        const built = [];
        let counter = payments.length;
        for (const row of rows) {
          const name = (row["Party Name"] || "").trim();
          const amount = Number(row["Amount"]) || 0;
          if (!name || !(amount > 0)) continue;
          let vend = vendorList.find((v) => v.name.toLowerCase() === name.toLowerCase());
          if (!vend) {
            vend = { id: uid(), name, phone1: "", phone2: "", email: "", address: "", openingBalance: "", openingBalanceType: "Cr", openingBalanceDate: todayISO(), createdAt: Date.now() };
            vendorList.push(vend);
          }
          const modeRaw = (row["Mode"] || "cash").trim().toLowerCase();
          const mode = modeRaw === "bank" || modeRaw === "upi" ? "Bank" : modeRaw === "cheque" ? "Cheque" : "Cash";
          counter++;
          built.push({
            id: uid(),
            paymentNo: `PAY-${String(counter).padStart(3, "0")}`,
            createdAt: parseImportedCreatedAt(row["Created"], normalizeDate(row["Date"]), built.length),
            vendorId: vend.id,
            date: normalizeDate(row["Date"]) || todayISO(),
            amount: String(amount),
            mode,
            bankName: row["Bank Name"] || "",
            reference: row["Reference"] || "",
            notes: row["Notes"] || "",
          });
        }
        if (!built.length) throw new Error("no rows");
        const sig = (p) => `${p.vendorId}|${p.date}|${Number(p.amount)}|${p.mode}`;
        const existingSigs = new Set(payments.map(sig));
        const fresh = built.filter((p) => !existingSigs.has(sig(p)));
        const dups = built.filter((p) => existingSigs.has(sig(p)));
        const applyImport = (mode) => {
          setVendors(vendorList);
          if (mode === "replace") {
            const dupSigs = new Set(dups.map(sig));
            setPayments((prev) => {
              const nextP = [...built, ...prev.filter((p) => !dupSigs.has(sig(p)))];
              setCounters((c) => deriveCounters({ payments: nextP }, c));
              return nextP;
            });
          } else {
            setPayments((prev) => {
              const nextP = [...fresh, ...prev];
              setCounters((c) => deriveCounters({ payments: nextP }, c));
              return nextP;
            });
          }
        };
        if (dups.length > 0) {
          setPendingImport({ label: "payment", newCount: fresh.length, dupCount: dups.length, onResolve: (mode) => { if (mode !== "cancel") applyImport(mode); setPendingImport(null); } });
        } else {
          applyImport("skip");
        }
      } catch (e) {
        setError("Couldn't import payments: expected Date, Party Name, Amount, Mode…");
        setTimeout(() => setError(""), 5000);
      }
    };
    reader.readAsText(file);
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const isProApp = parsed.meta?.app === "textile-bill-pro" ||
          (Array.isArray(parsed.payments) && parsed.payments.some((p) => "receiptNumber" in p || "partyType" in p));

        if (isProApp) {
          // ---- Translate the real app's schema into ours ----
          const cust = (parsed.customers || []).map((c) => ({
            id: String(c.id), name: c.name || "",
            phone1: c.phone || "", phone2: c.phone2 || "", email: c.email || "",
            address: c.address || "",
            openingBalance: c.openingBalance != null ? String(Number(c.openingBalance)) : "",
            openingBalanceType: (c.openingBalanceType || "dr").toLowerCase() === "cr" ? "Cr" : "Dr",
            openingBalanceDate: c.openingBalanceDate || todayISO(),
            createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
          }));
          const vend = (parsed.vendors || []).map((v) => ({
            id: String(v.id), name: v.name || "",
            phone1: v.phone || "", phone2: v.phone2 || "", email: v.email || "",
            address: v.address || "",
            openingBalance: v.openingBalance != null ? String(Number(v.openingBalance)) : "",
            openingBalanceType: (v.openingBalanceType || "cr").toLowerCase() === "dr" ? "Dr" : "Cr",
            openingBalanceDate: v.openingBalanceDate || todayISO(),
            createdAt: v.createdAt ? new Date(v.createdAt).getTime() : Date.now(),
          }));
          const banks = (parsed.bankAccounts || []).map((b) => ({
            id: String(b.id), bankName: b.bankName || b.name || "",
            accountNumber: b.accountNumber || "", ifsc: b.ifsc || "", notes: b.notes || "",
            createdAt: b.createdAt ? new Date(b.createdAt).getTime() : Date.now(),
          }));
          const mapItem = (it) => ({
            id: uid(), unit: unitFromCsv(it.unit),
            qty: it.quantity != null ? String(it.quantity) : "",
            size: it.size != null ? String(it.size) : (String(it.unit).toLowerCase() === "pcs" ? "1" : ""),
            rate: it.rate != null ? String(it.rate) : "",
          });
          const mapExpenses = (inv) => {
            const list = [];
            if (Array.isArray(inv.otherExpenses)) {
              for (const e of inv.otherExpenses) {
                const amt = Number(e.amount) || 0;
                if (amt) list.push({ id: uid(), label: e.label || "", amount: String(amt) });
              }
            } else if (Number(inv.otherExpense)) {
              list.push({ id: uid(), label: inv.otherExpenseLabel || "", amount: String(Number(inv.otherExpense)) });
            }
            return list;
          };
          const inv = (parsed.invoices || []).map((i) => ({
            id: String(i.id), createdAt: i.createdAt ? new Date(i.createdAt).getTime() : Date.now(),
            invoiceNo: i.invoiceNumber || "", series: (i.invoiceNumber || "").startsWith("CC") ? "CC" : "VCH",
            date: i.date || todayISO(), reference: i.notes || "",
            customerId: String(i.customerId),
            items: (i.items || []).map(mapItem), expenses: mapExpenses(i),
            status: (i.status || "unpaid").toLowerCase() === "paid" ? "Paid" : "Unpaid",
          }));
          const purch = (parsed.purchases || []).map((p) => ({
            id: String(p.id), createdAt: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
            billNo: p.billNumber || "", vendorId: String(p.vendorId),
            date: p.date || todayISO(), items: (p.items || []).map(mapItem),
            // amount stays authoritative (covers discount/tax/other-expenses/round-off
            // baked into the pro app's totalAmount, which a raw items-sum wouldn't
            // capture) — items[] is carried over purely for the line-item breakdown.
            amount: String(Number(p.totalAmount) || 0), notes: p.notes || "",
          }));
          // The pro app stores receipts and payments together in `payments`,
          // split by type. Route each to the right array.
          const rcpts = [], pays = [];
          for (const p of (parsed.payments || [])) {
            const amount = String(Number(p.amount) || 0);
            const modeRaw = (p.paymentMode || "cash").toLowerCase();
            const mode = modeRaw === "bank" || modeRaw === "upi" ? "Bank" : modeRaw === "cheque" ? "Cheque" : modeRaw === "discount" ? "Discount" : "Cash";
            const createdAt = p.createdAt ? new Date(p.createdAt).getTime() : Date.now();
            if ((p.type || "receipt") === "payment" || p.partyType === "vendor") {
              pays.push({ id: String(p.id), paymentNo: p.receiptNumber || `PAY-${p.id}`, createdAt,
                vendorId: String(p.partyId), date: p.date || todayISO(), amount, mode,
                bankName: p.bankName || "", reference: p.referenceNumber || "", notes: p.notes || "" });
            } else {
              rcpts.push({ id: String(p.id), receiptNo: p.receiptNumber || `RCT-${p.id}`, createdAt,
                customerId: String(p.partyId), date: p.date || todayISO(), amount, mode,
                invoiceId: p.invoiceId != null ? String(p.invoiceId) : null,
                reference: p.referenceNumber || "", bankName: p.bankName || "", accountNumber: p.accountNumber || "", notes: p.notes || "" });
            }
          }
          setCustomers(cust);
          setVendors(vend);
          setBankAccounts(banks);
          // Recompute each invoice's Paid/Unpaid from the receipts actually
          // linked to it (the pro app's stored status can be stale).
          const invWithStatus = inv.map((i) => {
            const covered = rcpts
              .filter((r) => r.invoiceId === i.id)
              .reduce((s, r) => s + (Number(r.amount) || 0), 0);
            const total = (i.items || []).reduce((s, it) => {
              const q = Number(it.qty) || 0;
              const sz = it.size === "" || it.size == null ? 1 : (Number(it.size) || 1);
              return s + q * sz * (Number(it.rate) || 0);
            }, 0) + (i.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
            const status = covered > 0 && covered >= total ? "Paid" : "Unpaid";
            return { ...i, status };
          });
          setInvoices(invWithStatus);
          setPurchases(purch);
          setReceipts(rcpts);
          setPayments(pays);
          // Continue numbering from the highest imported document number.
          // Resetting to zero here meant the next new invoice restarted at
          // CC-001 / VCH-001 and collided with imported records.
          setCounters(deriveCounters(
            { invoices: invWithStatus, purchases: purch, receipts: rcpts, payments: pays },
            { VCH: 0, CC: 0, PUR: 0, PAY: 0 }
          ));
          setError("");
          return;
        }

        // ---- Native Textile Bill backup ----
        applyRestoredBook(parsed);
      } catch (e) {
        setError("That file doesn't look like a valid backup.");
        setTimeout(() => setError(""), 4000);
      }
    };
    reader.readAsText(file);
  }

  // Applies a Textile Bill-native book (our own schema) to local state —
  // shared by importBackup (file restore) and Restore from Cloud, so both
  // paths behave identically. Throws on an unrecognizable shape rather than
  // silently doing nothing, matching importBackup's own validation.
  function applyRestoredBook(parsed) {
    if (!Array.isArray(parsed.invoices) || !Array.isArray(parsed.customers)) {
      throw new Error("bad shape");
    }
    setCustomers(parsed.customers || []);
    setInvoices(parsed.invoices || []);
    setReceipts(parsed.receipts || []);
    setBankAccounts(parsed.bankAccounts || []);
    setVendors(parsed.vendors || []);
    setPurchases(parsed.purchases || []);
    setPayments(parsed.payments || []);
    // Backups made before units were manageable simply have none — fall back
    // to the defaults so those restores keep working unchanged.
    setUnits(migrateUnitAbbrs(Array.isArray(parsed.units) && parsed.units.length ? parsed.units : DEFAULT_UNITS.slice()));
    setShipFroms(Array.isArray(parsed.shipFroms) ? parsed.shipFroms : []);
    setCounters(deriveCounters(parsed, parsed.counters));
  }

  // ---------- item / expense editing ----------
  function updateItem(id, field, value) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
    }));
  }
  function addItem() {
    setDraft((d) => ({ ...d, items: [...d.items, emptyItem()] }));
  }
  function removeItem(id) {
    setDraft((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }));
  }
  function updateExpense(id, field, value) {
    setDraft((d) => ({
      ...d,
      expenses: d.expenses.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    }));
  }
  function addExpense() {
    setDraft((d) => ({ ...d, expenses: [...(d.expenses || []), emptyExpense()] }));
  }
  function removeExpense(id) {
    setDraft((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }));
  }

  const draftSubtotal = draft
    ? draft.items.reduce((s, it) => s + lineAmount(it), 0)
    : 0;
  const draftExpenseTotal = draft
    ? (draft.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0)
    : 0;
  const draftTotal = draftSubtotal + draftExpenseTotal;

  if (!loaded) {
    return (
      <div style={{ background: paper, minHeight: "100vh" }} className="flex items-center justify-center">
        <style>{fontImport}</style>
        <div style={{ color: muted, fontFamily: "'Inter', sans-serif" }}>Loading ledger…</div>
      </div>
    );
  }

  return (
    <div className="app-root" style={{ background: paper, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{fontImport}</style>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; position: static !important; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          /* The app shell reserves a full viewport height on screen; in print
             that would reserve an empty page, so collapse it. */
          .app-root { min-height: 0 !important; background: white !important; }
          /* Each print sheet occupies exactly one page; prevents a sheet (and its
             Page x/y footer) from splitting across two physical pages. */
          .print-sheet { page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; }
          .print-sheet:last-child { page-break-after: auto; break-after: auto; }
          /* Nothing after the last sheet should generate another page. */
          .print-area > *:last-child { page-break-after: auto !important; break-after: auto !important; }
        }
        .print-area { display: none; }
        @page { size: A4 landscape; margin: 8mm; }
        input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.6; }
        /* Items editor: compact 6-col grid on phones (no Amount column, no
           horizontal scroll), full 7-col single-row table from 640px up. */
        .item-grid { display: grid; grid-template-columns: 18px 78px 1fr 1fr 1fr 24px; gap: 4px; align-items: center; }
        .item-amt-inline { display: block; grid-column: 1 / -1; text-align: right; }
        .item-amt-col { display: none; }
        /* iOS Safari zooms the whole page when a focused input's font-size is
           under 16px — that zoom is the "screen repositioning" when tapping
           Qty/Size/Rate. 16px on phones prevents the zoom entirely. */
        @media (max-width: 639.98px) {
          input, select, textarea { font-size: 16px !important; }
        }
        @media (min-width: 640px) {
          .item-grid { grid-template-columns: 24px 96px 1fr 1fr 1fr 84px 28px; gap: 8px; }
          .item-amt-inline { display: none; }
          .item-amt-col { display: block; }
        }
        /* Customer table: name wraps to 2 lines with phone beneath (like the
           real app); compact columns so balance sits close to address. */
        .cust-grid { display: grid; align-items: center; gap: 8px;
          grid-template-columns: 22px 28px 160px 72px 120px 30px; }
        @media (min-width: 640px) {
          .cust-grid { grid-template-columns: 24px 34px 200px 130px 150px 40px; }
        }
      `}</style>

      {/* ---------- header ---------- */}
      <header className="no-print" style={{ background: ink }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          {/* Branding gets its own full-width row — on a phone the title and
              the two pickers side by side squeezed "Textile Bill" onto two
              lines and pushed the company name off-screen. */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
              <div
                className="flex items-center justify-center rounded-lg"
                style={{ width: 36, height: 36, background: thread, color: ink, fontWeight: 700, flexShrink: 0 }}
              >
                <FileText size={18} strokeWidth={2.5} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{ fontFamily: "'Fraunces', serif", color: "#fff", fontWeight: 600, fontSize: 19, lineHeight: 1, whiteSpace: "nowrap" }}
                >
                  Textile Bill
                </div>
                <div style={{ color: "#B9C2D6", fontSize: 11, letterSpacing: "0.06em", marginTop: 3, whiteSpace: "nowrap" }}>
                  SALES &amp; BILLING
                </div>
              </div>
            </div>
            <span style={{ color: "#B9C2D6", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 }}>
              {saveState === "saving" ? "saving…" : saveState === "saved" ? "saved ✓" : ""}
            </span>
          </div>

          {/* Controls row — deliberately never wraps: the company name is the
              only flexible element, so on a narrow phone it truncates with an
              ellipsis rather than pushing Backup/Sign out onto a second row. */}
          <div className="flex items-center gap-2 mt-3 flex-nowrap">
            <div style={{ position: "relative", flexShrink: 0 }}>
              <select
                value={activeFy}
                onChange={(e) => selectFy(e.target.value)}
                className="rounded-lg text-xs font-semibold"
                style={{
                  background: "rgba(255,255,255,0.08)", color: "#fff",
                  border: "1px solid #3A4A6C", padding: "6px 24px 6px 8px",
                  appearance: "none", WebkitAppearance: "none", cursor: "pointer",
                }}
                title="Financial year — sets the date filters across the app"
              >
                {fyYears.map((y) => (
                  <option key={y} value={y} style={{ color: ink }}>{fyLabel(y)}</option>
                ))}
              </select>
              <ChevronDown size={13} color="#B9C2D6" style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            </div>
            <button
              onClick={() => setShowCompanyModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid #3A4A6C", flex: "1 1 auto", minWidth: 0, maxWidth: 190 }}
              title="Switch or manage companies"
            >
              <Landmark size={13} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                {activeCompanyName || "Company"}
              </span>
              <ChevronDown size={13} style={{ flexShrink: 0 }} />
            </button>
            <button
              onClick={() => setModule("backup")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid #3A4A6C", flexShrink: 0 }}
              title="Backup & restore"
            >
              <Save size={13} />
              <span className="hidden sm:inline">Backup</span>
            </button>
            <button
              onClick={onSignOut}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, flexShrink: 0, background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid #3A4A6C" }}
              title={currentUsername ? `Sign out (${currentUsername})` : "Sign out"}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <nav className="no-print" style={{ background: "#16233D", borderBottom: `1px solid #2A3A5C` }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
          {[
            { key: "dashboard", label: "Dashboard" },
            { key: "analytics", label: "Data Analytics" },
            { key: "sales", label: "Sales" },
            { key: "receipts", label: "Receipts" },
            { key: "customers", label: "Customers" },
            { key: "vendors", label: "Vendors" },
            { key: "purchases", label: "Purchases" },
            { key: "payments", label: "Payments" },
            { key: "accounts", label: "Chart of Accounts" },
            { key: "transactions", label: "Transactions" },
            ...(currentUserRole === "Admin" ? [{ key: "users", label: "Users" }] : []),
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setModule(tab.key)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap"
              style={{
                color: module === tab.key ? thread : "#7C8AAE",
                borderBottom: module === tab.key ? `2px solid ${thread}` : "2px solid transparent",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {error && (
        <div
          className="no-print max-w-5xl mx-auto mt-3 mx-4 sm:mx-auto px-4 py-2 rounded-md flex items-center gap-2"
          style={{ background: dangerBg, color: danger, fontSize: 13 }}
        >
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {!backupBannerDismissed && (customers.length + vendors.length + invoices.length + purchases.length > 0) && (() => {
        const days = lastBackupAt ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86400000) : null;
        if (days !== null && days < 7) return null; // recently backed up — nothing to say
        return (
          <div className="no-print max-w-5xl mx-auto mt-3 px-4 sm:px-0">
            <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-2.5 rounded-lg" style={{ background: "#FBF4E7", border: `1px solid #E8D5A8` }}>
              <span style={{ color: "#8A6416", fontSize: 13, fontWeight: 600 }}>
                <Save size={14} style={{ display: "inline", marginRight: 6, verticalAlign: -2 }} />
                {days === null ? "You haven't backed up this company yet." : `Last backup was ${days} day${days !== 1 ? "s" : ""} ago.`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={shareBackup}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold"
                  style={{ background: thread, color: ink }}
                >
                  {backupSharePayload ? "Tap to Save" : "Back Up Now"}
                </button>
                <button
                  onClick={() => setBackupBannerDismissed(true)}
                  className="px-2 py-1.5 rounded-md text-xs font-semibold"
                  style={{ color: "#8A6416" }}
                  title="Dismiss for this session"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <main className="no-print max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {module === "dashboard" ? (
          <DashboardView
            customers={customers}
            vendors={vendors}
            invoices={invoices}
            purchases={purchases}
            payments={payments}
            receipts={receipts}
            invoiceTotal={invoiceTotal}
            customerOutstanding={customerOutstanding}
            vendorOutstanding={vendorOutstanding}
            dateFrom={dashFrom}
            dateTo={dashTo}
            setDateFrom={setDashFrom}
            setDateTo={setDashTo}
            quickRangeDates={quickRangeDates}
            onNavigate={(m) => setModule(m)}
            onOpenCustomerLedger={(id) => { if (!id || id === "all") return; setModule("customers"); setViewingCustomerId(id); setCustomerView("detail"); }}
            onOpenVendorLedger={(id) => { if (!id || id === "all") return; setModule("vendors"); setViewingVendorId(id); setVendorView("detail"); }}
          />
        ) : module === "analytics" ? (
          <DataAnalyticsView
            customers={customers}
            vendors={vendors}
            invoices={invoices}
            purchases={purchases}
            receipts={receipts}
            payments={payments}
            invoiceTotal={invoiceTotal}
            customerOutstanding={customerOutstanding}
            vendorOutstanding={vendorOutstanding}
            dateFrom={analyticsFrom}
            dateTo={analyticsTo}
            setDateFrom={setAnalyticsFrom}
            setDateTo={setAnalyticsTo}
            quickRangeDates={quickRangeDates}
          />
        ) : module === "backup" ? (
          <BackupView
            companyName={activeCompanyName}
            counts={{ customers: customers.length, vendors: vendors.length, invoices: invoices.length, receipts: receipts.length, purchases: purchases.length, payments: payments.length }}
            onBackup={exportBackup}
            onShareBackup={shareBackup}
            shareBackupPending={!!backupSharePayload}
            onRestore={(file) => setPendingRestore(file)}
            onExportMasters={exportAllTallyMasters}
            onExportVouchers={exportAllTallyVouchers}
            onExportProApp={exportForProApp}
            companyId={activeCompanyId}
            buildSyncBook={buildSyncBook}
            onRestoreFromCloud={(result) => setPendingCloudRestore(result)}
          />
        ) : module === "accounts" ? (
          <ChartOfAccountsView
            customers={customers}
            bankAccounts={bankAccounts}
            vendors={vendors}
            units={units}
            invoices={invoices}
            purchases={purchases}
            onSaveUnits={saveUnits}
            onImportCustomers={importCustomersCsv}
            onImportTally={importTallyMastersXml}
            onDeleteAccounts={deleteAccountsByName}
          />
        ) : module === "transactions" ? (
          <TransactionReportView
            invoices={invoices}
            receipts={receipts}
            customers={customers}
            purchases={purchases}
            payments={payments}
            vendors={vendors}
            invoiceTotal={invoiceTotal}
            quickRangeDates={quickRangeDates}
            fyWindow={fyWindow}
          />
        ) : module === "users" && currentUserRole === "Admin" ? (
          <UsersView
            users={users}
            currentUsername={currentUsername}
            onAdd={(u) => onSetUsers([...users, { id: uid(), ...u }])}
            onUpdateRole={(id, role) => onSetUsers(users.map((u) => (u.id === id ? { ...u, role } : u)))}
            onResetPassword={(id, password) => onSetUsers(users.map((u) => (u.id === id ? { ...u, password } : u)))}
            onDelete={(id) => onSetUsers(users.filter((u) => u.id !== id))}
          />
        ) : module === "vendors" ? (
          vendorView === "detail" ? (
            <VendorDetailView
              vendor={vendorById.get(viewingVendorId)}
              purchases={purchases.filter((p) => p.vendorId === viewingVendorId).sort((a, b) => (a.date < b.date ? 1 : -1))}
              payments={payments.filter((p) => p.vendorId === viewingVendorId)}
              ledgerWindow={{ from: vendFrom, to: vendTo }}
              onBack={() => { setViewingVendorId(null); setVendorView("list"); }}
              onSave={saveVendor}
              onOpenPurchase={(p) => { setModule("purchases"); setViewingPurchaseId(p.id); setPurchaseView("detail"); }}
              onOpenPayment={(pay) => { setEditingPayment(pay); setShowPaymentModal(true); }}
              onNewPurchase={(v) => { setEditingPurchase({ vendorId: v.id }); setShowPurchaseModal(true); }}
              onNewPayment={(v) => {
                setEditingPayment({ vendorId: v.id, date: todayISO(), amount: "", mode: "Cash", purchaseId: "", bankName: "", reference: "", notes: "" });
                setShowPaymentModal(true);
              }}
            />
          ) : (
            <VendorsView
              vendors={vendors}
              vendorOutstanding={vendorOutstanding}
              selected={vendSelected}
              setSelected={setVendSelected}
              onSave={saveVendor}
              onDelete={deleteVendor}
              onImportCsv={importVendorsCsv}
              onOpenDetail={(v) => { setViewingVendorId(v.id); setVendorView("detail"); }}
              onPreviewSummary={() => setVendSummaryPreview(true)}
              onPrintSummary={() => setVendSummaryPrint(true)}
              onPrintLedgers={() => setVendLedgersPrint(true)}
              dateFrom={vendFrom}
              dateTo={vendTo}
              setDateFrom={setVendFrom}
              setDateTo={setVendTo}
              quickRangeDates={quickRangeDates}
            />
          )
        ) : module === "purchases" ? (
          purchaseView === "detail" ? (
            <PurchaseDetailView
              purchase={purchases.find((p) => p.id === viewingPurchaseId)}
              vendors={vendors}
              payments={payments}
              onBack={() => { setViewingPurchaseId(null); setPurchaseView("list"); }}
              onUpdate={(p) => setPurchases((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
              onDelete={(id) => { setPurchases((prev) => prev.filter((x) => x.id !== id)); setViewingPurchaseId(null); setPurchaseView("list"); }}
              onAddPayment={openPaymentForPurchase}
              onEditPayment={(pay) => { setEditingPayment(pay); setShowPaymentModal(true); }}
            />
          ) : (
            <PurchasesView
              purchases={purchases}
              vendors={vendors}
              payments={payments}
              bankAccounts={bankAccounts}
              counters={counters}
              setCounters={setCounters}
              onAdd={(p) => setPurchases((prev) => [...prev, p])}
              onDelete={(id) => setPurchases((prev) => prev.filter((x) => x.id !== id))}
              onBulkDelete={(ids) => setPurchases((prev) => prev.filter((x) => !ids.includes(x.id)))}
              onImportCsv={importPurchasesCsv}
              quickRangeDates={quickRangeDates}
              fyWindow={fyWindow}
              onOpenDetail={(p) => { setViewingPurchaseId(p.id); setPurchaseView("detail"); }}
              onToggleStatus={togglePurchaseStatus}
              onBulkAddPayments={bulkAddPayments}
            />
          )
        ) : module === "payments" ? (
          <PaymentsView
            payments={payments}
            vendors={vendors}
            purchases={purchases}
            vendorOutstanding={vendorOutstanding}
            bankAccounts={bankAccounts}
            counters={counters}
            setCounters={setCounters}
            onAdd={addPayment}
            onUpdate={updatePayment}
            onDelete={(id) => {
              setPayments((prev) => {
                const next = prev.filter((x) => x.id !== id);
                setPurchases((ps) => reconcilePurchaseStatuses(ps, next));
                return next;
              });
            }}
            onBulkDelete={(ids) => {
              setPayments((prev) => {
                const next = prev.filter((x) => !ids.includes(x.id));
                setPurchases((ps) => reconcilePurchaseStatuses(ps, next));
                return next;
              });
            }}
            onImportCsv={importPaymentsCsv}
            quickRangeDates={quickRangeDates}
            fyWindow={fyWindow}
          />
        ) : module === "receipts" ? (
          <ReceiptsView
            receipts={receipts}
            customers={customers}
            invoices={invoices}
            onAdd={() => { setEditingReceipt(null); setShowReceiptModal(true); }}
            onEdit={(r) => { setEditingReceipt(r); setShowReceiptModal(true); }}
            onDelete={deleteReceipt}
            onBulkDelete={deleteReceipts}
            dateFrom={receiptFrom}
            dateTo={receiptTo}
            setDateFrom={setReceiptFrom}
            setDateTo={setReceiptTo}
            quickRangeDates={quickRangeDates}
            onPreviewRegister={() => setReceiptRegPreview(true)}
            onExportCsv={() => exportReceiptsCsv(receiptFrom || receiptTo ? receipts.filter((r) => (!receiptFrom || r.date >= receiptFrom) && (!receiptTo || r.date <= receiptTo)) : receipts)}
            onImportCsv={importReceiptsCsv}
            onManageBanks={() => setShowBankModal(true)}
          />
        ) : module === "customers" ? (
          customerView === "detail" ? (
            <CustomerDetailView
              customer={customerById.get(viewingCustomerId)}
              invoices={invoices.filter((i) => i.customerId === viewingCustomerId).sort((a, b) => (a.date < b.date ? 1 : -1))}
              receipts={receipts.filter((r) => r.customerId === viewingCustomerId)}
              outstanding={customerOutstanding(viewingCustomerId)}
              ledgerWindow={{ from: custFrom, to: custTo }}
              invoiceTotal={invoiceTotal}
              onBack={() => { setViewingCustomerId(null); setCustomerView("list"); }}
              onEdit={openEditCustomer}
              onOpenInvoice={(inv) => {
                setModule("sales");
                setViewingId(inv.id);
                setView("detail");
              }}
              onOpenReceipt={(r) => { setEditingReceipt(r); setShowReceiptModal(true); }}
              onNewInvoice={(c) => {
                const series = "VCH";
                const nextNo = (counters[series] || 0) + 1;
                setModule("sales");
                setDraft({ ...blankDraft(series, nextNo), customerId: c.id });
                setView("form");
              }}
              onNewReceipt={(c) => {
                setEditingReceipt({ customerId: c.id, date: todayISO(), amount: "", mode: "Cash", invoiceId: "", reference: "", notes: "", bankAccountId: "" });
                setShowReceiptModal(true);
              }}
            />
          ) : (
            <CustomersView
              customers={customers}
              customerOutstanding={customerOutstanding}
              selected={custSelected}
              setSelected={setCustSelected}
              onAdd={openAddCustomer}
              onEdit={openEditCustomer}
              onDelete={deleteCustomer}
              onOpenDetail={(c) => { setViewingCustomerId(c.id); setCustomerView("detail"); }}
              onPreviewSummary={() => setCustSummaryPreview(true)}
              onPrintSummary={() => setCustSummaryPrint(true)}
              onPrintLedgers={() => setCustLedgersPrint(true)}
              dateFrom={custFrom}
              dateTo={custTo}
              setDateFrom={setCustFrom}
              setDateTo={setCustTo}
              quickRangeDates={quickRangeDates}
            />
          )
        ) : view === "list" ? (
          <ListView
            invoices={filteredInvoices}
            customers={customers}
            receipts={receipts}
            bankAccounts={bankAccounts}
            totals={totals}
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            seriesFilter={seriesFilter}
            setSeriesFilter={setSeriesFilter}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            onQuickRange={setQuickRange}
            printSeparate={printSeparate}
            setPrintSeparate={setPrintSeparate}
            onPrintRegister={() => setPrintingRegister(true)}
            onPreviewRegister={() => setPreviewingRegister(true)}
            onExport={exportBackup}
            onImport={importBackup}
            onExportCsv={exportSalesCsv}
            onExportFullCsv={exportFullInvoicesCsv}
            onImportCsv={importSalesCsv}
            onImportQr={() => setShowQrImport(true)}
            onNew={startNewInvoice}
            onEdit={editInvoice}
            onOpenDetail={(inv) => { setViewingId(inv.id); setView("detail"); }}
            onPrint={setPrinting}
            onPreview={setPreviewing}
            onToggleStatus={toggleStatus}
            pendingDelete={pendingDelete}
            setPendingDelete={setPendingDelete}
            onDelete={deleteInvoice}
            invoiceTotal={invoiceTotal}
            srnoMap={srnoMap}
            dateSortDir={dateSortDir}
            onToggleDateSort={() => setDateSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onBulkSetStatus={bulkSetStatus}
            onBulkDelete={bulkDelete}
            bulkDeleteConfirm={bulkDeleteConfirm}
            setBulkDeleteConfirm={setBulkDeleteConfirm}
            onBulkAddReceipts={bulkAddReceipts}
          />
        ) : view === "detail" ? (
          <DetailView
            invoice={viewingInvoice}
            customer={customerById.get(viewingInvoice?.customerId)}
            invoices={invoices}
            receipts={receipts}
            invoiceTotal={invoiceTotal}
            onBack={() => { setViewingId(null); setView("list"); }}
            onEdit={(inv) => editInvoice(inv)}
            onPreview={setPreviewing}
            onPrint={setPrinting}
            onAddReceipt={openReceiptForInvoice}
            onEditReceipt={(r) => { setEditingReceipt(r); setShowReceiptModal(true); }}
            onOpenInvoice={(inv) => setViewingId(inv.id)}
            onToggleItemCancel={toggleItemCancel}
            onShippingLabel={(inv) => setLabelInvoice(inv)}
          />
        ) : (
          <FormView
            draft={draft}
            setDraft={setDraft}
            customers={customers}
            invoices={invoices}
            invoiceTotal={invoiceTotal}
            onChangeSeries={changeSeries}
            onSave={saveDraft}
            onCancel={() => {
              setView(viewingId && draft?.id === viewingId ? "detail" : "list");
              setDraft(null);
            }}
            onOpenCustomerModal={openAddCustomer}
            updateItem={updateItem}
            addItem={addItem}
            removeItem={removeItem}
            updateExpense={updateExpense}
            addExpense={addExpense}
            removeExpense={removeExpense}
            subtotal={draftSubtotal}
            expenseTotal={draftExpenseTotal}
            total={draftTotal}
            onPreviewPrint={setPrinting}
          />
        )}
      </main>

      {showCustomerModal && (
        <CustomerModal
          value={newCustomer}
          setValue={setNewCustomer}
          editing={!!editingCustomerId}
          onSave={saveCustomer}
          onClose={() => { setShowCustomerModal(false); setEditingCustomerId(null); }}
        />
      )}

      {receiptRegPreview && (
        <ReceiptRegisterPreview
          receipts={receiptFrom || receiptTo ? receipts.filter((r) => (!receiptFrom || r.date >= receiptFrom) && (!receiptTo || r.date <= receiptTo)) : receipts}
          customers={customers}
          invoices={invoices}
          dateFrom={receiptFrom}
          dateTo={receiptTo}
          onClose={() => setReceiptRegPreview(false)}
        />
      )}
      {receiptRegPreview && (
        <ReceiptRegisterPrint
          receipts={receiptFrom || receiptTo ? receipts.filter((r) => (!receiptFrom || r.date >= receiptFrom) && (!receiptTo || r.date <= receiptTo)) : receipts}
          customers={customers}
          invoices={invoices}
          dateFrom={receiptFrom}
          dateTo={receiptTo}
        />
      )}

      {showReceiptModal && (
        <ReceiptModal
          customers={customers}
          invoices={invoices}
          bankAccounts={bankAccounts}
          invoiceTotal={invoiceTotal}
          customerOutstanding={customerOutstanding}
          value={editingReceipt}
          onSave={(form) => {
            const ok = editingReceipt?.id ? updateReceipt(editingReceipt.id, form) : addReceipt(form);
            if (ok) { setShowReceiptModal(false); setEditingReceipt(null); }
          }}
          onClose={() => { setShowReceiptModal(false); setEditingReceipt(null); }}
        />
      )}

      {showPaymentModal && (
        <PaymentModal
          vendors={vendors}
          purchases={purchases}
          bankAccounts={bankAccounts}
          vendorOutstanding={vendorOutstanding}
          value={editingPayment}
          onClose={() => { setShowPaymentModal(false); setEditingPayment(null); }}
          onSave={(data) => {
            if (editingPayment?.id) {
              updatePayment({ ...editingPayment, ...data, purchaseId: data.purchaseId || null });
            } else {
              const next = (counters.PAY || 0) + 1;
              setCounters((c) => ({ ...c, PAY: next }));
              addPayment({ id: uid(), createdAt: Date.now(), paymentNo: `PAY-${String(next).padStart(3, "0")}`, vendorId: data.vendorId, purchaseId: data.purchaseId || null, date: data.date, amount: data.amount, mode: data.mode, bankName: data.bankName || "", reference: data.reference || "", notes: data.notes || "" });
            }
            setShowPaymentModal(false);
            setEditingPayment(null);
          }}
        />
      )}

      {labelInvoice && (
        <ShippingLabelModal
          invoice={labelInvoice}
          customer={customerById.get(labelInvoice.customerId)}
          shipFroms={shipFroms}
          onSaveFroms={setShipFroms}
          onSaveShipping={updateCustomerShipping}
          onClose={() => setLabelInvoice(null)}
        />
      )}

      {showPurchaseModal && (
        <PurchaseModal
          vendors={vendors}
          value={editingPurchase}
          onClose={() => { setShowPurchaseModal(false); setEditingPurchase(null); }}
          onSave={(data) => {
            if (editingPurchase?.id) {
              setPurchases((prev) => prev.map((x) => (x.id === editingPurchase.id ? { ...x, ...data, billNo: data.billNo || x.billNo } : x)));
            } else {
              const next = (counters.PUR || 0) + 1;
              setCounters((c) => ({ ...c, PUR: next }));
              setPurchases((prev) => [...prev, {
                id: uid(), createdAt: Date.now(),
                billNo: data.billNo || `PUR-${String(next).padStart(3, "0")}`,
                vendorId: data.vendorId, date: data.date, items: data.items,
                expenses: data.expenses || [], amount: data.amount,
                notes: data.notes || "", status: "Unpaid",
              }]);
            }
            setShowPurchaseModal(false);
            setEditingPurchase(null);
          }}
        />
      )}

      {showCompanyModal && (
        <CompanyModal
          companies={companies}
          activeId={activeCompanyId}
          onSwitch={(id) => { switchCompany(id); setShowCompanyModal(false); }}
          onCreate={async (name) => { const ok = await createCompany(name); if (ok) setShowCompanyModal(false); return ok; }}
          onRename={renameCompany}
          onDelete={deleteCompany}
          onCarryForward={async (name, cutoff) => { const ok = await carryForward(name, cutoff); if (ok) setShowCompanyModal(false); return ok; }}
          onClose={() => setShowCompanyModal(false)}
        />
      )}

      {pendingRestore && (
        <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
          <div className="w-full max-w-sm rounded-xl p-5" style={{ background: "#fff" }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Restore from backup?</h3>
            <p style={{ color: muted, fontSize: 13.5, lineHeight: 1.5, marginBottom: 16 }}>
              This will <b>replace all current data</b> — customers, vendors, invoices, purchases, receipts, and payments — with the contents of the backup file. This can't be undone. Consider downloading a backup of your current data first.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => { importBackup(pendingRestore); setPendingRestore(null); }}
                className="w-full py-2.5 rounded-lg font-semibold text-sm"
                style={{ background: danger, color: "#fff" }}
              >
                Replace all data with backup
              </button>
              <button
                onClick={() => setPendingRestore(null)}
                className="w-full py-2 rounded-lg font-medium text-sm"
                style={{ color: muted }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingCloudRestore && (
        <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
          <div className="w-full max-w-sm rounded-xl p-5" style={{ background: "#fff" }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Restore from cloud?</h3>
            <p style={{ color: muted, fontSize: 13.5, lineHeight: 1.5, marginBottom: 8 }}>
              This will <b>replace all current data on this device</b> for {activeCompanyName || "this company"} with the cloud copy{pendingCloudRestore.updatedAt ? ` last synced ${fmtDateTime(new Date(pendingCloudRestore.updatedAt).getTime())}` : ""}. This can't be undone. Consider downloading a backup of your current data first.
            </p>
            <div className="space-y-2 mt-2">
              <button
                onClick={() => {
                  try {
                    applyRestoredBook(pendingCloudRestore.book);
                    setError("");
                  } catch {
                    setError("The cloud copy doesn't look like a valid backup.");
                    setTimeout(() => setError(""), 4000);
                  }
                  setPendingCloudRestore(null);
                }}
                className="w-full py-2.5 rounded-lg font-semibold text-sm"
                style={{ background: danger, color: "#fff" }}
              >
                Replace all data with cloud copy
              </button>
              <button
                onClick={() => setPendingCloudRestore(null)}
                className="w-full py-2 rounded-lg font-medium text-sm"
                style={{ color: muted }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingImport && (
        <ImportDuplicateModal
          label={pendingImport.label}
          newCount={pendingImport.newCount}
          dupCount={pendingImport.dupCount}
          dupNames={pendingImport.dupNames}
          onResolve={pendingImport.onResolve}
        />
      )}

      {showQrImport && (
        <QrImportModal
          onClose={() => setShowQrImport(false)}
          onConfirm={(decoded) => {
            if (importInvoiceFromQr(decoded)) setShowQrImport(false);
          }}
        />
      )}

      {showBankModal && (
        <BankAccountsModal
          bankAccounts={bankAccounts}
          onSave={saveBankAccount}
          onDelete={deleteBankAccount}
          onClose={() => setShowBankModal(false)}
        />
      )}

      {printing && (
        <PrintModal invoice={printing} customer={customerById.get(printing.customerId)} onClose={() => setPrinting(null)} />
      )}

      {printing && (
        <PackingListPrint invoice={printing} customer={customerById.get(printing.customerId)} />
      )}

      {previewing && (
        <InvoicePreviewModal
          invoice={previewing}
          customer={customerById.get(previewing.customerId)}
          onClose={() => setPreviewing(null)}
          onPrint={() => {
            setPrinting(previewing);
            setPreviewing(null);
          }}
        />
      )}

      {printingRegister && (
        <RegisterPrintModal onClose={() => setPrintingRegister(false)} />
      )}

      {(() => {
        // Print scope: ticked customers, else all — summary sorted by balance
        // (highest receivable first), ledgers alphabetical.
        const scope = custSelected.length
          ? customers.filter((c) => custSelected.includes(c.id))
          : customers;
        const summaryList = [...scope].sort((a, b) => customerOutstanding(b.id) - customerOutstanding(a.id));
        const ledgerList = [...scope].sort((a, b) => a.name.localeCompare(b.name));
        // Landscape 2-up summary rows. Name and address share one column so
        // the last-sale columns fit without the sheet overflowing.
        const lastSaleBy = new Map();
        for (const inv of invoices) {
          const prev = lastSaleBy.get(inv.customerId);
          if (!prev || inv.date > prev) lastSaleBy.set(inv.customerId, inv.date);
        }
        const daysSince = (d) => {
          if (!d) return null;
          return Math.max(0, Math.round((new Date(`${todayISO()}T12:00:00`) - new Date(`${d}T12:00:00`)) / 86400000));
        };
        const sumRows = summaryList.map((c, i) => {
          const bal = customerOutstanding(c.id);
          const last = lastSaleBy.get(c.id);
          const days = daysSince(last);
          return [
            i + 1,
            c.address ? `${c.name} — ${c.address}` : c.name,
            c.phone1 || "—",
            `${fmtNum(Math.abs(bal))} ${bal >= 0 ? "DR" : "CR"}`,
            last ? fmtDate(last) : "—",
            days === null ? "—" : String(days),
          ];
        });
        const sumCols = [
          { header: "SN", align: "center" },
          { header: "Customer Details", width: 230 },
          { header: "Phone" },
          { header: "Balance", align: "right" },
          { header: "Last Sale", align: "center" },
          { header: "Days", align: "center" },
        ];
        const sumTotal = summaryList.reduce((s, c) => s + Math.max(0, customerOutstanding(c.id)), 0);
        const sumFoot = ["", "", "", fmtNum(sumTotal), "", "Total Receivable"];
        const sumSubtitle = `${summaryList.length} customer${summaryList.length !== 1 ? "s" : ""}${custSelected.length ? " · selected only" : ""} · as on ${fmtDate(todayISO())}`;
        return (
          <>
            {custSummaryPreview && (
              <GenericReportPreview
                rows={sumRows}
                title="Customer Summary Balances"
                subtitle={sumSubtitle}
                columns={sumCols}
                footer={sumFoot}
                onClose={() => setCustSummaryPreview(false)}
              />
            )}
            {(custSummaryPrint || custSummaryPreview) && (
              <GenericReportPrint rows={sumRows} title="Customer Summary Balances" subtitle={`As on ${fmtDate(todayISO())}`} columns={sumCols} footer={sumFoot} />
            )}
            {custSummaryPrint && (
              <ConfirmPrintModal
                title="Print Customer Summary"
                subtitle={`${summaryList.length} customer${summaryList.length !== 1 ? "s" : ""}${custSelected.length ? " (selected only)" : ""}`}
                onClose={() => setCustSummaryPrint(false)}
              />
            )}
            {custLedgersPrint && (
              <>
                <CustomerLedgersPrint
                  customers={ledgerList}
                  invoices={invoices}
                  receipts={receipts}
                  invoiceTotal={invoiceTotal}
                  ledgerWindow={{ from: custFrom, to: custTo }}
                />
                <CustomerLedgersPreview
                  customers={ledgerList}
                  invoices={invoices}
                  receipts={receipts}
                  invoiceTotal={invoiceTotal}
                  ledgerWindow={{ from: custFrom, to: custTo }}
                  selectionCount={custSelected.length}
                  onClose={() => setCustLedgersPrint(false)}
                />
              </>
            )}
          </>
        );
      })()}

      {(() => {
        // Print scope: ticked vendors, else all — summary sorted by payable
        // (highest first), ledgers alphabetical. Mirrors the customer block above.
        const scope = vendSelected.length
          ? vendors.filter((v) => vendSelected.includes(v.id))
          : vendors;
        const summaryList = [...scope].sort((a, b) => vendorOutstanding(b.id) - vendorOutstanding(a.id));
        const ledgerList = [...scope].sort((a, b) => a.name.localeCompare(b.name));
        const sumRows = summaryList.map((v, i) => {
          const bal = vendorOutstanding(v.id);
          return [i + 1, v.name, v.phone1 || "—", v.address || "—", `${fmtNum(Math.abs(bal))} ${bal >= 0 ? "CR" : "DR"}`];
        });
        const sumCols = [{ header: "SN", align: "center" }, { header: "Vendor", width: 200 }, { header: "Phone" }, { header: "Address" }, { header: "Payable", align: "right" }];
        const sumTotal = summaryList.reduce((s, v) => s + Math.max(0, vendorOutstanding(v.id)), 0);
        const sumFoot = ["", "", "", "Total Payable", fmtNum(sumTotal)];
        const sumSubtitle = `${summaryList.length} vendor${summaryList.length !== 1 ? "s" : ""}${vendSelected.length ? " · selected only" : ""} · as on ${fmtDate(todayISO())}`;
        return (
          <>
            {vendSummaryPreview && (
              <GenericReportPreview
                rows={sumRows}
                title="Vendor Balance Summary"
                subtitle={sumSubtitle}
                columns={sumCols}
                footer={sumFoot}
                onClose={() => setVendSummaryPreview(false)}
              />
            )}
            {(vendSummaryPrint || vendSummaryPreview) && (
              <GenericReportPrint rows={sumRows} title="Vendor Balance Summary" subtitle={`As on ${fmtDate(todayISO())}`} columns={sumCols} footer={sumFoot} />
            )}
            {vendSummaryPrint && (
              <ConfirmPrintModal
                title="Print Vendor Summary"
                subtitle={`${summaryList.length} vendor${summaryList.length !== 1 ? "s" : ""}${vendSelected.length ? " (selected only)" : ""}`}
                onClose={() => setVendSummaryPrint(false)}
              />
            )}
            {vendLedgersPrint && (
              <>
                <VendorLedgersPrint
                  vendors={ledgerList}
                  purchases={purchases}
                  payments={payments}
                  ledgerWindow={{ from: vendFrom, to: vendTo }}
                />
                <VendorLedgersPreview
                  vendors={ledgerList}
                  purchases={purchases}
                  payments={payments}
                  ledgerWindow={{ from: vendFrom, to: vendTo }}
                  selectionCount={vendSelected.length}
                  onClose={() => setVendLedgersPrint(false)}
                />
              </>
            )}
          </>
        );
      })()}

      {/* When rows are selected, the register covers only those (matching the
          real app's "N selected for print" behavior); otherwise the full
          filtered list. */}
      {previewingRegister && (
        <RegisterPreviewModal
          invoices={selected.length ? filteredInvoices.filter((i) => selected.includes(i.id)) : filteredInvoices}
          selectionCount={selected.length}
          customers={customers}
          invoiceTotal={invoiceTotal}
          separateBySeries={printSeparate}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onClose={() => setPreviewingRegister(false)}
        />
      )}

      {(printingRegister || previewingRegister) && (
        <PrintableRegister
          invoices={selected.length ? filteredInvoices.filter((i) => selected.includes(i.id)) : filteredInvoices}
          customers={customers}
          invoiceTotal={invoiceTotal}
          separateBySeries={printSeparate}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      )}
    </div>
  );
}

// ================= LIST VIEW =================
function ListView({
  invoices, customers, receipts, totals, search, setSearch, statusFilter, setStatusFilter,
  seriesFilter, setSeriesFilter, dateFrom, setDateFrom, dateTo, setDateTo, onQuickRange,
  printSeparate, setPrintSeparate, onPrintRegister, onPreviewRegister, onExport, onImport, onExportCsv, onExportFullCsv, onImportCsv, onImportQr,
  onNew, onEdit, onOpenDetail, onPrint, onPreview, onToggleStatus, pendingDelete, setPendingDelete, onDelete, invoiceTotal,
  srnoMap, dateSortDir, onToggleDateSort, selected, onToggleSelect, onToggleSelectAll, onBulkSetStatus, onBulkDelete,
  bulkDeleteConfirm, setBulkDeleteConfirm, onBulkAddReceipts, bankAccounts = [],
}) {
  const customerById = useMemo(() => {
    const m = new Map();
    for (const c of customers) m.set(c.id, c);
    return m;
  }, [customers]);
  const visibleIds = invoices.map((i) => i.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const anySelected = selected.length > 0;
  const [bulkReceiptModal, setBulkReceiptModal] = useState(false);
  // Rendering is paginated (large filtered lists were re-rendering every row
  // on every keystroke in search/date filters); selection and "select all"
  // still operate on the full filtered set above, not just the visible page.
  const LIST_PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(invoices.length / LIST_PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pagedInvoices = invoices.slice(pageSafe * LIST_PAGE_SIZE, (pageSafe + 1) * LIST_PAGE_SIZE);
  const importInputRef = useRef(null);
  const importCsvRef = useRef(null);
  // staged date inputs — applied on "Filter" tap; kept in sync when quick-range buttons set dates
  const [pendingFrom, setPendingFrom] = useState(dateFrom);
  const [pendingTo, setPendingTo] = useState(dateTo);
  useEffect(() => { setPendingFrom(dateFrom); }, [dateFrom]);
  useEffect(() => { setPendingTo(dateTo); }, [dateTo]);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 28, fontWeight: 600 }}>
            Sales Invoices
          </h1>
          <p style={{ color: muted, fontSize: 13, marginTop: 2 }}>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm shrink-0 whitespace-nowrap"
          style={{ background: thread, color: ink }}
        >
          <Plus size={16} strokeWidth={2.5} /> New Invoice
        </button>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
          <input
            ref={importCsvRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) onImportCsv(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => importCsvRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-2.5 rounded-lg font-semibold text-xs"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Import invoices from CSV (register summary or full line-item format)"
          >
            <Upload size={14} /> Import
          </button>
          <button
            onClick={onImportQr}
            className="flex items-center gap-1 px-2.5 py-2.5 rounded-lg font-semibold text-xs"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Scan an invoice QR code to import it"
          >
            <Camera size={14} /> Scan QR
          </button>
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1 px-2.5 py-2.5 rounded-lg font-semibold text-xs"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Export register summary (one row per invoice)"
          >
            <Download size={14} /> Register
          </button>
          <button
            onClick={onExportFullCsv}
            className="flex items-center gap-1 px-2.5 py-2.5 rounded-lg font-semibold text-xs"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Export full invoices (one row per line item)"
          >
            <Download size={14} /> Invoices
          </button>
          <button
            onClick={onPreviewRegister}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Preview Sales Invoices Register"
          >
            <Eye size={16} />
          </button>
      </div>

      {/* toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1"
          style={{ background: card, border: `1px solid ${hairline}` }}
        >
          <Search size={15} color={muted} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer or invoice no."
            className="flex-1 outline-none text-sm bg-transparent"
            style={{ color: ink }}
          />
        </div>
        <div className="flex gap-2">
          <div style={{ flex: 1 }}>
            <InlineSelect
              value={seriesFilter}
              onChange={setSeriesFilter}
              options={[{ value: "All", label: "All Series" }, { value: "VCH", label: "VCH" }, { value: "CC", label: "CC" }]}
              className="px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: card, border: `1px solid ${hairline}`, color: ink }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <InlineSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ value: "All", label: "All Status" }, { value: "Paid", label: "Paid" }, { value: "Unpaid", label: "Unpaid" }]}
              className="px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: card, border: `1px solid ${hairline}`, color: ink }}
            />
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 mb-3 text-sm" style={{ color: muted }}>
        <input
          type="checkbox"
          checked={printSeparate}
          onChange={(e) => setPrintSeparate(e.target.checked)}
          style={{ width: 15, height: 15, accentColor: thread }}
        />
        Print CC &amp; VCH series separately
      </label>

      <div className="flex items-end gap-1.5 mb-3">
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ color: muted, fontSize: 11, marginBottom: 3 }}>From</div>
          <DateField value={pendingFrom} onChange={setPendingFrom} className="px-1.5 py-2 rounded-lg text-xs outline-none" style={{ border: `1px solid ${hairline}`, color: ink, background: "#fff", width: "100%", minWidth: 0, boxSizing: "border-box" }} />
        </div>
        <div style={{ flex: "1 1 0", minWidth: 0 }}>
          <div style={{ color: muted, fontSize: 11, marginBottom: 3 }}>To</div>
          <DateField value={pendingTo} onChange={setPendingTo} className="px-1.5 py-2 rounded-lg text-xs outline-none" style={{ border: `1px solid ${hairline}`, color: ink, background: "#fff", width: "100%", minWidth: 0, boxSizing: "border-box" }} />
        </div>
        <button
          onClick={() => { setDateFrom(pendingFrom); setDateTo(pendingTo); }}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold shrink-0"
          style={{ background: ink, color: "#fff" }}
        >
          <Filter size={14} /> Filter
        </button>
        {(dateFrom || dateTo || pendingFrom || pendingTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); setPendingFrom(""); setPendingTo(""); }}
            className="px-3 py-2 rounded-lg text-xs font-medium shrink-0"
            style={{ border: `1px solid ${hairline}`, color: muted, background: "#fff" }}
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <button onClick={() => onQuickRange("current")} className="py-2 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${hairline}`, color: inkSoft }}>
          Current Month
        </button>
        <button onClick={() => onQuickRange("previous")} className="py-2 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${hairline}`, color: inkSoft }}>
          Previous Month
        </button>
        <button onClick={() => onQuickRange("fy")} className="py-2 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${hairline}`, color: inkSoft }}>
          Current Financial Year
        </button>
      </div>

      {/* combined summary card */}
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3 mb-4"
        style={{ background: card, border: `1px solid ${hairline}` }}
      >
        <div>
          <div style={{ color: muted, fontSize: 12 }}>Total Sales</div>
          <div style={{ color: success, fontWeight: 700, fontSize: 22, fontFamily: "'Fraunces', serif" }}>
            {fmtMoney(totals.total)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: muted, fontSize: 12 }}>Count</div>
          <div style={{ color: ink, fontWeight: 700, fontSize: 22, fontFamily: "'IBM Plex Mono', monospace" }}>
            {totals.count}
          </div>
        </div>
      </div>

      {anySelected && (
        <div
          className="flex items-center justify-between flex-wrap gap-2 mb-3 px-3 py-2 rounded-lg"
          style={{ background: ink }}
        >
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
            {selected.length} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkDeleteConfirm ? (
              <>
                <button
                  onClick={onBulkDelete}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold"
                  style={{ background: danger, color: "#fff" }}
                >
                  Delete {selected.length}?
                </button>
                <button
                  onClick={() => setBulkDeleteConfirm(false)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold"
                  style={{ background: "transparent", color: "#B9C2D6", border: "1px solid #4A5D8A" }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                {onBulkAddReceipts && (
                  <button
                    onClick={() => setBulkReceiptModal(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold"
                    style={{ background: thread, color: ink }}
                  >
                    <IndianRupee size={13} /> Add Receipt
                  </button>
                )}
                <button
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold"
                  style={{ background: "transparent", color: "#F3B0A0", border: "1px solid #6E4A44" }}
                >
                  <Trash2 size={13} /> Delete
                </button>
                <button
                  onClick={() => onToggleSelectAll([])}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold"
                  style={{ background: "transparent", color: "#B9C2D6", border: "1px solid #4A5D8A" }}
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <Stitch margin="0 0 16px 0" />

      {/* table */}
      {invoices.length === 0 ? (
        <div
          className="rounded-xl py-16 text-center"
          style={{ background: card, border: `1px dashed ${hairline}` }}
        >
          <FileText size={28} color={muted} className="mx-auto mb-3" />
          <p style={{ color: ink, fontWeight: 600, fontSize: 15 }}>No invoices yet</p>
          <p style={{ color: muted, fontSize: 13, marginTop: 4 }}>Create your first bill to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${hairline}` }}>
          <div className="overflow-x-auto">
            <div style={{ minWidth: 440, width: "max-content" }}>
              {/* header */}
              <div
                className="grid items-center gap-1.5 px-3 py-2"
                style={{
                  gridTemplateColumns: "22px 26px 62px 150px 92px 60px 26px",
                  background: paper,
                  borderBottom: `1px solid ${hairline}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleSelectAll(visibleIds)}
                  style={{ width: 15, height: 15, accentColor: thread }}
                />
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>SR</span>
                <button
                  onClick={onToggleDateSort}
                  className="flex items-center gap-0.5"
                  style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: "transparent", padding: 0 }}
                >
                  DATE {dateSortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>CUSTOMER</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textAlign: "left" }}>AMOUNT</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textAlign: "center" }}>STATUS</span>
                <span></span>
              </div>
              {pagedInvoices.map((inv, idx) => {
                const cust = customerById.get(inv.customerId);
                const total = invoiceTotal(inv);
                const confirming = pendingDelete === inv.id;
                const isSelected = selected.includes(inv.id);
                return (
                  <div
                    key={inv.id}
                    className="grid items-center gap-1.5 px-3 py-2.5"
                    style={{
                      gridTemplateColumns: "22px 26px 62px 150px 92px 60px 26px",
                      background: isSelected ? "#FBF4E7" : "transparent",
                      cursor: "pointer",
                      borderTop: idx > 0 ? `1px solid ${hairline}` : "none",
                    }}
                    onClick={() => onOpenDetail(inv)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(inv.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 15, height: 15, accentColor: thread }}
                    />
                    <span style={{ color: muted, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {srnoMap[inv.id] || "—"}
                    </span>
                    <span style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
                      {fmtDateShort(inv.date)}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: ink, fontWeight: 600, fontSize: 13, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                        {cust?.name || "—"}
                      </div>
                      <div style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", display: "flex", alignItems: "center", gap: 4 }}>
                        <span
                          title={inv.status}
                          style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: inv.status === "Paid" ? success : danger }}
                        />
                        {inv.invoiceNo}
                      </div>
                    </div>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: ink, fontSize: 13, textAlign: "left", whiteSpace: "nowrap" }}>
                      {fmtMoney(total)}
                    </span>
                    <div style={{ textAlign: "center" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleStatus(inv); }}
                        className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{
                          background: inv.status === "Paid" ? successBg : dangerBg,
                          color: inv.status === "Paid" ? success : danger,
                        }}
                      >
                        {inv.status}
                      </button>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                      {confirming ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onDelete(inv.id)}
                            className="px-1.5 py-1 rounded-md font-semibold"
                            style={{ background: danger, color: "#fff", fontSize: 10, whiteSpace: "nowrap" }}
                          >
                            Sure?
                          </button>
                          <button
                            onClick={() => setPendingDelete(null)}
                            className="px-1 py-1 rounded-md font-semibold"
                            style={{ color: muted, fontSize: 10 }}
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <IconBtn onClick={() => setPendingDelete(inv.id)} title="Delete" danger><Trash2 size={15} /></IconBtn>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {invoices.length > 0 && pageCount > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span style={{ color: muted, fontSize: 12.5 }}>
            {pageSafe * LIST_PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * LIST_PAGE_SIZE, invoices.length)} of {invoices.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={pageSafe === 0}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: pageSafe === 0 ? hairline : ink, cursor: pageSafe === 0 ? "not-allowed" : "pointer" }}
              title="Previous"
            >
              <ArrowLeft size={15} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={pageSafe >= pageCount - 1}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: pageSafe >= pageCount - 1 ? hairline : ink, cursor: pageSafe >= pageCount - 1 ? "not-allowed" : "pointer" }}
              title="Next"
            >
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {bulkReceiptModal && onBulkAddReceipts && (
        <BulkInvoiceReceiptModal
          invoices={invoices.filter((i) => selected.includes(i.id))}
          customers={customers}
          bankAccounts={bankAccounts}
          receipts={receipts || []}
          invoiceTotal={invoiceTotal}
          onClose={() => setBulkReceiptModal(false)}
          onSave={(entries) => {
            onBulkAddReceipts(entries);
            setBulkReceiptModal(false);
            onToggleSelectAll([]);
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, mono }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: card, border: `1px solid ${hairline}` }}>
      <div style={{ color: muted, fontSize: 11, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
      <div
        style={{
          color,
          fontWeight: 700,
          fontSize: 20,
          marginTop: 2,
          fontFamily: mono ? "'IBM Plex Mono', monospace" : "'Fraunces', serif",
        }}
      >
        {value}
      </div>
    </div>
  );
}


// ================= FORM VIEW =================
// ============ PRINT PREVIEW SYSTEM ============
// Full-screen dark preview showing the real print sheets as white paper,
// scaled to fit the viewport (matches the reference app's preview).
const A4 = { landW: 1122, landH: 794, portW: 794, portH: 1123 }; // px @96dpi

function PaperSheet({ landscape = false, children }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  const designW = landscape ? A4.landW : A4.portW;
  const designH = landscape ? A4.landH : A4.portH;
  useEffect(() => {
    const update = () => {
      if (!wrapRef.current) return;
      const w = wrapRef.current.clientWidth;
      setScale(Math.min(1, w / designW));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [designW]);
  return (
    <div ref={wrapRef} style={{ width: "100%", height: designH * scale, marginBottom: 18 }}>
      <div
        style={{
          width: designW,
          minHeight: designH,
          background: "#fff",
          boxShadow: "0 4px 18px rgba(0,0,0,0.45)",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          color: "#111",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function PrintPreviewOverlay({ title, subtitle, onClose, children, filename }) {
  const sheetsRef = useRef(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sharePayload, setSharePayload] = useState(null); // {file, fname} once prepared, awaiting the confirming tap

  // Fallback/alternative to the system print dialog: renders an actual PDF
  // file client-side (html2canvas-pro + jsPDF) from the same hidden print-area
  // markup, for browsers/webviews where window.print() doesn't reliably show
  // a "Save as PDF" option (notably in-app browsers on iOS).
  const doSavePdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await generatePdfFromPrintAreas(filename || title);
    } catch (e) {
      console.error("PDF generation failed", e);
      alert("Could not generate the PDF. Please try the Print button instead.");
    } finally {
      setPdfBusy(false);
    }
  };

  // Two-tap Share (see preparePdfForShare's comment for why): first tap
  // builds the file and waits; a second tap — a fresh, instant user
  // gesture — is what actually opens the native share sheet.
  const doSharePdf = async () => {
    if (pdfBusy) return;
    if (sharePayload) {
      try {
        await navigator.share({ files: [sharePayload.file], title: sharePayload.fname });
      } catch (e) {
        if (e?.name !== "AbortError") downloadBlob(sharePayload.file, sharePayload.fname);
      } finally {
        setSharePayload(null);
      }
      return;
    }
    setPdfBusy(true);
    try {
      const prepared = await preparePdfForShare(filename || title);
      if (!prepared) return;
      if (canShareFiles() && navigator.canShare({ files: [prepared.file] })) {
        setSharePayload(prepared);
      } else {
        prepared.pdf.save(prepared.fname);
      }
    } catch (e) {
      console.error("PDF share failed", e);
      alert("Could not prepare the PDF to share. Please try Save PDF instead.");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="no-print fixed inset-0 flex flex-col" style={{ background: "rgba(17,20,28,0.96)", zIndex: 80 }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap" style={{ background: "#0F1420" }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>Print Preview </span>
          <span style={{ color: "#B9C2D6", fontWeight: 600, fontSize: 16 }}>{title}</span>
          {subtitle && <div style={{ color: "#7C8AAE", fontSize: 12 }}>{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2">
          {canShareFiles() && (
            <button
              onClick={doSharePdf}
              disabled={pdfBusy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: thread, color: ink, opacity: pdfBusy ? 0.6 : 1 }}
            >
              <Share2 size={15} /> {pdfBusy ? "Preparing…" : sharePayload ? "Tap to Share" : "Share"}
            </button>
          )}
          <button
            onClick={doSavePdf}
            disabled={pdfBusy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#fff", color: ink, opacity: pdfBusy ? 0.6 : 1 }}
          >
            <Download size={15} /> {pdfBusy ? "Generating…" : "Save PDF"}
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#fff", color: ink }}
          >
            <X size={15} /> Close
          </button>
        </div>
      </div>
      <div ref={sheetsRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-5">{children}</div>
    </div>
  );
}

// ============ MOBILE KEYPAD NAV TOOLBAR ============
// iOS renders numeric inputs with the decimal keypad, which has no "Next" key,
// so on phones you can't move between Qty/Size/Rate from the keyboard. This
// bar floats just above the keyboard with Prev / Next / + line / Done. Inputs
// opt in via a data-kbdnav attribute; navigation follows DOM order and skips
// disabled fields (e.g. Size on a Pcs row).
function isNavField(el) {
  return el instanceof HTMLInputElement && el.matches("input[data-kbdnav]");
}

function KeyboardNavToolbar({ onAddLine }) {
  const [visible, setVisible] = useState(false);
  const [bottom, setBottom] = useState(0);
  const activeRef = useRef(null);
  const [coarsePointer] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches
  );

  useEffect(() => {
    const onFocusIn = (e) => {
      if (isNavField(e.target)) {
        activeRef.current = e.target;
        setVisible(true);
      }
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        if (!isNavField(document.activeElement)) setVisible(false);
      }, 60);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const keyboard = window.innerHeight - (vv.height + vv.offsetTop);
      setBottom(Math.max(keyboard, 0));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [visible]);

  const getFields = () =>
    Array.from(document.querySelectorAll("input[data-kbdnav]")).filter(
      (el) => el.offsetParent !== null && !el.disabled
    );

  const move = (dir) => {
    const fields = getFields();
    const idx = activeRef.current ? fields.indexOf(activeRef.current) : -1;
    const next = fields[idx + dir];
    if (next) next.focus();
  };

  const addLine = () => {
    onAddLine();
    // Focus the first field (Qty) of the freshly added row once it renders.
    window.setTimeout(() => {
      const fields = getFields();
      // each row contributes Qty, Size, Rate — new row's Qty is 3rd from end
      const target = fields[fields.length - 3] || fields[fields.length - 1];
      if (target) target.focus();
    }, 60);
  };

  if (!visible || !coarsePointer) return null;

  return (
    <div
      className="no-print fixed inset-x-0 flex items-center justify-between gap-2 px-3 py-1.5"
      style={{ bottom, zIndex: 70, background: "rgba(255,255,255,0.96)", borderTop: `1px solid ${hairline}`, backdropFilter: "blur(6px)" }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous field"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => move(-1)}
          className="flex items-center gap-1 rounded-md px-3 text-sm font-medium"
          style={{ height: 36, border: `1px solid ${hairline}`, background: "#fff", color: ink }}
        >
          <ChevronUp size={16} /> Prev
        </button>
        <button
          type="button"
          aria-label="Next field"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => move(1)}
          className="flex items-center gap-1 rounded-md px-3 text-sm font-medium"
          style={{ height: 36, border: `1px solid ${hairline}`, background: "#fff", color: ink }}
        >
          Next <ChevronDown size={16} />
        </button>
        <button
          type="button"
          aria-label="Add item line"
          onPointerDown={(e) => e.preventDefault()}
          onClick={addLine}
          className="flex items-center justify-center rounded-md"
          style={{ height: 36, width: 40, background: thread, color: ink }}
        >
          <Plus size={17} strokeWidth={2.5} />
        </button>
      </div>
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => activeRef.current?.blur()}
        className="rounded-md px-3 text-sm font-semibold"
        style={{ height: 36, color: inkSoft }}
      >
        Done
      </button>
    </div>
  );
}

// ============ SIZEWISE SUMMARY (screen-only, like the real app) ============
function SizeSummary({ items }) {
  const rows = UNIT_OPTIONS.map((u) => {
    let qty = 0, totQty = 0, amount = 0;
    for (const it of items) {
      if (it.unit !== u || isCancelledItem(it)) continue;
      const q = Number(it.qty) || 0;
      qty += q;
      totQty += isCountUnit(u) ? q : q * (Number(it.size) || 0);
      amount += lineAmount(it);
    }
    return { label: u, qty, totQty, amount };
  }).filter((r) => r.qty > 0);
  if (rows.length === 0) return null;
  const tQty = rows.reduce((t, r) => t + r.qty, 0);
  const tTot = rows.reduce((t, r) => t + r.totQty, 0);
  const tAmt = rows.reduce((t, r) => t + r.amount, 0);
  const fmt1 = (n) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
  const rate = (a, q) => (q > 0 ? (a / q).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-");
  const cell = { padding: "5px 8px", fontSize: 12, borderBottom: `1px solid ${hairline}` };
  return (
    <div className="no-print rounded-xl overflow-hidden mb-4" style={{ background: card, border: `1px solid ${hairline}` }}>
      <div className="px-4 pt-3 pb-1" style={{ color: inkSoft, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
        SIZEWISE SUMMARY
      </div>
      <div className="overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
          <thead>
            <tr style={{ background: paper }}>
              <th style={{ ...cell, textAlign: "left", color: muted, fontSize: 11, fontWeight: 700 }}>Size</th>
              <th style={{ ...cell, textAlign: "right", color: muted, fontSize: 11, fontWeight: 700 }}>Total Qty</th>
              <th style={{ ...cell, textAlign: "right", color: muted, fontSize: 11, fontWeight: 700 }}>Total Qty(uom)</th>
              <th style={{ ...cell, textAlign: "right", color: muted, fontSize: 11, fontWeight: 700 }}>Avg Rate</th>
              <th style={{ ...cell, textAlign: "right", color: muted, fontSize: 11, fontWeight: 700 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td style={{ ...cell, fontWeight: 600, color: ink }}>{r.label}</td>
                <td style={{ ...cell, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt1(r.qty)}</td>
                <td style={{ ...cell, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt1(r.totQty)}</td>
                <td style={{ ...cell, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>₹{rate(r.amount, r.totQty)}</td>
                <td style={{ ...cell, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: paper, fontWeight: 700 }}>
              <td style={{ ...cell, borderBottom: "none", color: ink }}>Total</td>
              <td style={{ ...cell, borderBottom: "none", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt1(tQty)}</td>
              <td style={{ ...cell, borderBottom: "none", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt1(tTot)}</td>
              <td style={{ ...cell, borderBottom: "none", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>₹{rate(tAmt, tTot)}</td>
              <td style={{ ...cell, borderBottom: "none", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(tAmt)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ================= DETAIL VIEW (read-only invoice) =================
function DetailView({ invoice, customer, invoices, receipts = [], invoiceTotal, onBack, onEdit, onPreview, onPrint, onAddReceipt, onEditReceipt, onOpenInvoice, onToggleItemCancel, onShippingLabel }) {
  if (!invoice) {
    return (
      <div className="text-center py-16">
        <p style={{ color: muted, fontSize: 14 }}>Invoice not found.</p>
        <button onClick={onBack} className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: inkSoft }}>
          Back to list
        </button>
      </div>
    );
  }
  const subtotal = invoice.items.reduce((s, it) => s + lineAmount(it), 0);
  const expenseTotal = (invoice.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const total = subtotal + expenseTotal;
  const unitAbbr = (u) => UNIT_ABBR[u] || u;
  const customerHistory = invoice.customerId
    ? (invoices || [])
        .filter((i) => i.customerId === invoice.customerId && i.id !== invoice.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 2)
    : [];
  // Receipts linked to this invoice — either directly (invoiceId) or as
  // part of a combined receipt covering several invoices for this customer
  // (allocations). Each row shows only the share allocated to *this*
  // invoice, not the full receipt amount when it's a combined one. Receipts
  // recorded purely "on account" (no link at all) aren't included, since
  // there's no way to know which invoice they were meant to settle.
  const invoiceReceipts = (receipts || [])
    .map((r) => {
      if (r.invoiceId === invoice.id) return { ...r, allocatedAmount: Number(r.amount) || 0, combined: false };
      if (Array.isArray(r.allocations)) {
        const a = r.allocations.find((x) => x.invoiceId === invoice.id);
        if (a) return { ...r, allocatedAmount: Number(a.amount) || 0, combined: true };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const receivedTotal = invoiceReceipts.reduce((s, r) => s + r.allocatedAmount, 0);
  const balanceDue = total - receivedTotal;

  return (
    <div>
      {/* header: back + number + status, customer · date */}
      <div className="flex items-center gap-3 mb-1">
        <button onClick={onBack} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium" style={{ color: inkSoft }}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <h1 style={{ fontFamily: "'IBM Plex Mono', monospace", color: ink, fontSize: 26, fontWeight: 700 }}>
          {invoice.invoiceNo}
        </h1>
        <span
          className="px-2.5 py-1 rounded-md text-xs font-bold"
          style={{
            background: invoice.status === "Paid" ? successBg : dangerBg,
            color: invoice.status === "Paid" ? success : danger,
            letterSpacing: "0.04em",
          }}
        >
          {invoice.status.toUpperCase()}
        </span>
      </div>
      <p style={{ color: muted, fontSize: 14, marginBottom: 14 }}>
        {customer?.name || "—"} · {fmtDate(invoice.date)}
      </p>

      {/* actions — kept to a single row (no wrap) so all three stay reachable
          without the last one dropping to its own line on a phone. */}
      <div className="flex items-center gap-2 flex-nowrap mb-4">
        <button onClick={() => onEdit(invoice)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink, flex: "1 1 0", minWidth: 0 }}>
          <Edit2 size={15} style={{ flexShrink: 0 }} /> Edit
        </button>
        <button onClick={() => onPreview(invoice)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink, flex: "1 1 0", minWidth: 0 }}>
          <Eye size={15} style={{ flexShrink: 0 }} /> Preview
        </button>
        {onAddReceipt && (
          <button onClick={() => onAddReceipt(invoice)} className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap" style={{ background: thread, color: ink, flex: "1 1 0", minWidth: 0 }}>
            <IndianRupee size={15} style={{ flexShrink: 0 }} /> Add Receipt
          </button>
        )}
      </div>

      {onShippingLabel && (
        <div className="flex mb-4">
          <button
            onClick={() => onShippingLabel(invoice)}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: card, border: `1px solid ${hairline}`, color: ink }}
          >
            <Printer size={15} /> Prepare Shipping Label
          </button>
        </div>
      )}

      {/* Bill To */}
      <Section title="Bill To">
        <div style={{ color: ink, fontWeight: 700, fontSize: 18 }}>{customer?.name || "—"}</div>
        {customer?.address && <div style={{ color: muted, fontSize: 13, marginTop: 2 }}>{customer.address}</div>}
        {(customer?.phone1 || customer?.phone2) && (
          <div style={{ marginTop: 4, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>
            {[customer.phone1, customer.phone2].filter(Boolean).map((ph, i) => (
              <a key={i} href={`tel:${String(ph).replace(/[^\d+]/g, "")}`} style={{ color: inkSoft, marginRight: 10 }}>{ph}</a>
            ))}
          </div>
        )}
        {customer?.transporter && (
          // Screen-only: useful when despatching, but deliberately kept off
          // the shipping label and every printed document.
          <div style={{ marginTop: 6, fontSize: 12.5 }}>
            <span style={{ color: muted }}>Transport: </span>
            <span style={{ color: inkSoft, fontWeight: 600 }}>{customer.transporter}</span>
          </div>
        )}
      </Section>

      {/* Invoice Info */}
      <Section title="Invoice Info">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span style={{ color: muted }}>Invoice Date</span>
            <span style={{ color: ink }}>{fmtDate(invoice.date)}</span>
          </div>
          {invoice.reference && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>Reference</span>
              <span style={{ color: ink }}>{invoice.reference}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span style={{ color: muted }}>Series</span>
            <span style={{ color: ink }}>{invoice.series}</span>
          </div>
          {invoice.createdAt && (
            // On-screen only — the printed invoice and PDF deliberately
            // don't carry this, since it's an internal audit detail rather
            // than something the customer needs. Same format as the
            // Transactions tab.
            <div className="flex justify-between">
              <span style={{ color: muted }}>Created</span>
              <span style={{ color: muted, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }}>
                {fmtDateTime(invoice.createdAt)}
              </span>
            </div>
          )}
        </div>
      </Section>

      {/* Items table */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: card, border: `1px solid ${hairline}` }}>
        <div className="grid px-3 py-2 text-xs font-semibold" style={{ gridTemplateColumns: onToggleItemCancel ? "28px 1fr 54px 54px 70px 86px 30px" : "28px 1fr 56px 56px 72px 88px", color: inkSoft, background: paper, borderBottom: `1px solid ${hairline}` }}>
          <span>#</span><span>Type</span>
          <span style={{ textAlign: "right" }}>Qty</span>
          <span style={{ textAlign: "right" }}>Size</span>
          <span style={{ textAlign: "right" }}>Rate</span>
          <span style={{ textAlign: "right" }}>Amount</span>
          {onToggleItemCancel && <span></span>}
        </div>
        {invoice.items.map((it, i) => {
          const off = isCancelledItem(it);
          // Struck through and dimmed, but the row (and its Sr number) stays
          // exactly where it was.
          const dim = { color: off ? muted : ink, textDecoration: off ? "line-through" : "none" };
          return (
            <div
              key={it.id}
              className="grid px-3 py-2 text-sm items-center"
              style={{
                gridTemplateColumns: onToggleItemCancel ? "28px 1fr 54px 54px 70px 86px 30px" : "28px 1fr 56px 56px 72px 88px",
                borderTop: i > 0 ? `1px solid ${hairline}` : "none",
                background: off ? "#FAF8F4" : "transparent",
              }}
            >
              <span style={{ color: muted, fontSize: 12 }}>{i + 1}</span>
              <span style={{ ...dim, fontWeight: 600 }}>
                {unitAbbr(it.unit)}
                {off && (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span style={{ color: danger, fontSize: 9, fontWeight: 700, textDecoration: "none", letterSpacing: "0.04em" }}>CANCELLED</span>
                    {onToggleItemCancel && (
                      <button
                        onClick={() => onToggleItemCancel(invoice, it.id)}
                        className="rounded"
                        style={{ color: success, border: `1px solid ${success}`, background: "#fff", fontSize: 9.5, fontWeight: 700, padding: "1px 6px", textDecoration: "none", letterSpacing: "0.03em", lineHeight: 1.5, whiteSpace: "nowrap" }}
                        title="Restore this line"
                      >
                        UNDO
                      </button>
                    )}
                  </span>
                )}
              </span>
              <span style={{ ...dim, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{it.qty}</span>
              <span style={{ ...dim, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{isCountUnit(it.unit) ? "—" : it.size}</span>
              <span style={{ ...dim, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(it.rate)}</span>
              <span style={{ ...dim, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
                {off ? "—" : fmtMoney(lineAmount(it))}
              </span>
              {onToggleItemCancel && (
                // Restore is a labelled button rather than an icon: a small
                // arrow reads as ambiguous next to the ✕, and undoing an
                // accidental cancel needs to be obvious.
                off ? (
                  <span />
                ) : (
                  <button
                    onClick={() => onToggleItemCancel(invoice, it.id)}
                    className="flex items-center justify-center"
                    style={{ color: muted, width: 26, height: 26, justifySelf: "end" }}
                    title="Cancel this line — keeps the Sr numbers of the other lines unchanged"
                  >
                    <X size={14} />
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* Expenses + totals */}
      <Section title="Totals">
        <div className="space-y-1.5">
          <Row label="Subtotal" value={fmtMoney(subtotal)} />
          {(invoice.expenses || []).map((e) => (
            <div key={e.id} className="flex items-center justify-between">
              <span style={{ color: muted, fontSize: 13 }}>{e.label || "Other Expense"}</span>
              <span style={{ color: ink, fontSize: 14, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(e.amount)}</span>
            </div>
          ))}
          <Stitch margin="8px 0" />
          <Row label="Total" value={fmtMoney(total)} big />
        </div>
      </Section>

      <SizeSummary items={invoice.items} />

      <Section title="Receipts Against This Invoice">
        {invoiceReceipts.length === 0 ? (
          <div style={{ color: muted, fontSize: 13 }}>
            No receipts linked to this invoice yet.
          </div>
        ) : (
          <div>
            <div className="space-y-2">
              {invoiceReceipts.map((r) => (
                <div
                  key={r.id}
                  onClick={() => onEditReceipt && onEditReceipt(r)}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                  style={{
                    background: paper,
                    border: `1px solid ${hairline}`,
                    cursor: onEditReceipt ? "pointer" : "default",
                  }}
                  title={onEditReceipt ? "Edit this receipt" : undefined}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: inkSoft, fontWeight: 600, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {fmtDate(r.date)}
                    </div>
                    <div style={{ color: muted, fontSize: 11 }}>
                      {receiptAccountLabel(r)}{r.receiptNo ? ` · ${r.receiptNo}` : ""}{r.combined ? " · part of a combined receipt" : ""}
                    </div>
                  </div>
                  <span style={{ color: success, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>
                    {fmtMoney(r.allocatedAmount)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${hairline}` }}>
              <div className="flex items-center justify-between" style={{ fontSize: 13 }}>
                <span style={{ color: muted }}>Received</span>
                <span style={{ color: success, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(receivedTotal)}</span>
              </div>
              <div className="flex items-center justify-between mt-1" style={{ fontSize: 13 }}>
                <span style={{ color: muted }}>Balance due</span>
                <span style={{ color: balanceDue > 0.5 ? danger : ink, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {fmtMoney(balanceDue)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Section>

      {customerHistory.length > 0 && (
        <Section title="Recent Invoices for this Customer">
          <div className="space-y-2">
            {customerHistory.map((inv) => (
              <div
                key={inv.id}
                onClick={() => onOpenInvoice && onOpenInvoice(inv)}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                style={{
                  background: paper,
                  border: `1px solid ${hairline}`,
                  cursor: onOpenInvoice ? "pointer" : "default",
                }}
                title={onOpenInvoice ? "Open this invoice" : undefined}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: inkSoft, fontWeight: 600, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{inv.invoiceNo}</div>
                  <div style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {fmtDate(inv.date)} · {inv.items.length} item{inv.items.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span style={{ color: ink, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13 }}>{fmtMoney(invoiceTotal(inv))}</span>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ background: inv.status === "Paid" ? successBg : dangerBg, color: inv.status === "Paid" ? success : danger }}
                  >
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <InvoiceQrPanel invoice={invoice} customerName={customer?.name || ""} />
    </div>
  );
}

function FormView({
  draft, setDraft, customers, invoices, invoiceTotal, onChangeSeries, onSave, onCancel, onOpenCustomerModal,
  updateItem, addItem, removeItem, updateExpense, addExpense, removeExpense,
  subtotal, expenseTotal, total, onPreviewPrint,
}) {
  const [showPreview, setShowPreview] = useState(false);

  // Expenses entered as a percentage track the subtotal — if item lines are
  // added, removed, or edited afterwards, the rupee figure recalculates
  // instead of silently keeping the value from when it was first typed.
  // Rows with a manually-typed amount (no pct) are never touched.
  useEffect(() => {
    for (const e of draft?.expenses || []) {
      if (!e.pct || String(e.pct).trim() === "") continue;
      const n = Number(e.pct);
      if (!Number.isFinite(n)) continue;
      const next = String(Math.round((n / 100) * subtotal));
      if (next !== String(e.amount)) updateExpense(e.id, "amount", next);
    }
  }, [subtotal, draft?.expenses]);

  if (!draft) return null;
  const customerHistory = draft.customerId
    ? invoices
        .filter((i) => i.customerId === draft.customerId && i.id !== draft.id)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 2)
    : [];
  const previewCustomer = customers.find((c) => c.id === draft.customerId);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="flex items-center justify-center rounded-lg" style={{ width: 34, height: 34, background: card, border: `1px solid ${hairline}`, color: ink }}>
            <ArrowLeft size={16} />
          </button>
          <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 24, fontWeight: 600 }}>
            {draft.id ? "Edit Invoice" : "New Invoice"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm"
            style={{ background: card, border: `1px solid ${hairline}`, color: muted }}
          >
            <X size={15} /> Cancel
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
          >
            <Eye size={15} /> Preview
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm"
            style={{ background: thread, color: ink }}
          >
            <Save size={15} /> Save
          </button>
        </div>
      </div>

      {/* Bill to */}
      <Section title="Bill To">
        <div className="flex gap-2">
          <SearchableSelect
            value={draft.customerId}
            onChange={(v) => setDraft((d) => ({ ...d, customerId: v }))}
            options={customers.map((c) => ({ value: c.id, label: c.name, sub: [c.address, c.phone1].filter(Boolean).join(" · ") }))}
            placeholder="Search customer…"
            inputStyle={{ border: `1px solid ${hairline}`, color: ink, background: "#fff" }}
          />
          <button
            onClick={onOpenCustomerModal}
            className="flex items-center justify-center rounded-lg shrink-0"
            style={{ width: 42, height: 42, background: ink, color: "#fff" }}
            title="Add new customer"
          >
            <UserPlus size={17} />
          </button>
        </div>
      </Section>

      {/* Invoice info */}
      <Section title="Invoice Info">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Series">
            <InlineSelect
              value={draft.series}
              onChange={onChangeSeries}
              options={["VCH", "CC"]}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${hairline}`, color: ink }}
            />
          </Field>
          <Field label="Invoice No.">
            <input
              value={draft.invoiceNo}
              onChange={(e) => setDraft((d) => ({ ...d, invoiceNo: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${hairline}`, color: ink, fontFamily: "'IBM Plex Mono', monospace" }}
            />
          </Field>
          <Field label="Invoice Date">
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${hairline}`, color: ink }}
            />
          </Field>
          <Field label="Reference">
            <input
              value={draft.reference}
              onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))}
              placeholder="Optional"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${hairline}`, color: ink }}
            />
          </Field>
        </div>
      </Section>

      {/* Items */}
      <Section title="Items">
        {/* header row */}
        <div
          className="item-grid px-1 pb-2 text-xs font-semibold"
          style={{ color: inkSoft, borderBottom: `1px solid ${hairline}` }}
        >
          <span>#</span><span>Type</span>
          <span>Qty</span><span>Size</span><span>Rate</span>
          <span className="item-amt-col" style={{ textAlign: "right" }}>Amount</span>
          <span></span>
        </div>
        {draft.items.map((it, idx) => (
          <div
            key={it.id}
            className="item-grid px-1 py-2"
            style={{ borderBottom: `1px dashed ${hairline}` }}
          >
            <span style={{ color: muted, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>{idx + 1}</span>
            <InlineSelect
              value={it.unit}
              onChange={(unit) => {
                updateItem(it.id, "unit", unit);
                if (isCountUnit(unit)) updateItem(it.id, "size", "");
              }}
              options={UNIT_OPTIONS}
              className="px-1.5 py-2 rounded-lg text-sm outline-none w-full"
              style={{ border: `1px solid ${hairline}`, color: ink, background: "#fff" }}
            />
            <input
              type="number"
              inputMode="decimal"
              data-kbdnav="true"
              value={it.qty}
              onChange={(e) => updateItem(it.id, "qty", e.target.value)}
              className="w-full px-1.5 py-2 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${hairline}`, color: ink, fontFamily: "'IBM Plex Mono', monospace", minWidth: 0 }}
            />
            <input
              type="number"
              inputMode="decimal"
              data-kbdnav="true"
              value={isCountUnit(it.unit) ? "" : it.size}
              onChange={(e) => updateItem(it.id, "size", e.target.value)}
              disabled={isCountUnit(it.unit)}
              placeholder={isCountUnit(it.unit) ? "—" : undefined}
              className="w-full px-1.5 py-2 rounded-lg text-sm outline-none"
              style={{
                border: `1px solid ${hairline}`,
                color: isCountUnit(it.unit) ? muted : ink,
                fontFamily: "'IBM Plex Mono', monospace",
                background: isCountUnit(it.unit) ? "#F1EEE6" : "#fff",
                cursor: isCountUnit(it.unit) ? "not-allowed" : "text",
                minWidth: 0,
              }}
            />
            <input
              type="number"
              inputMode="decimal"
              data-kbdnav="true"
              value={it.rate}
              onChange={(e) => updateItem(it.id, "rate", e.target.value)}
              className="w-full px-1.5 py-2 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${hairline}`, color: ink, fontFamily: "'IBM Plex Mono', monospace", minWidth: 0 }}
            />
            <span className="item-amt-col" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: ink, fontSize: 13, textAlign: "right" }}>
              {fmtMoney(lineAmount(it))}
            </span>
            <button onClick={() => removeItem(it.id)} style={{ color: danger }} title="Remove line">
              <Trash2 size={15} />
            </button>
            <span className="item-amt-inline" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: ink, fontSize: 12, paddingTop: 2 }}>
              = {fmtMoney(lineAmount(it))}
            </span>
          </div>
        ))}
        <button
          onClick={addItem}
          className="w-full mt-3 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
          style={{ border: `1px dashed ${inkSoft}`, color: inkSoft }}
        >
          <Plus size={15} /> Add Item Line
        </button>
      </Section>

      {/* Expenses & totals */}
      <Section title="Other Expenses">
        {(draft.expenses || []).map((e) => (
          <div key={e.id} className="flex items-center gap-1.5 mb-2">
            <input
              value={e.label}
              onChange={(ev) => updateExpense(e.id, "label", ev.target.value)}
              placeholder="e.g. Transport"
              className="flex-1 min-w-0 px-2.5 py-2 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${hairline}`, color: ink }}
            />
            {/* Percentage is a data-entry helper only: typing 2 here fills the
                amount with 2% of the subtotal. It's stored so editing an
                invoice still shows what was used, but nothing reads it for
                totals, printing, or exports — only `amount` is authoritative. */}
            <div className="relative" style={{ width: 56, flexShrink: 0 }}>
              <input
                type="text"
                inputMode="decimal"
                value={e.pct || ""}
                onChange={(ev) => {
                  const raw = ev.target.value.replace(/%/g, "");
                  updateExpense(e.id, "pct", raw);
                  const n = Number(raw);
                  if (raw.trim() !== "" && Number.isFinite(n)) {
                    updateExpense(e.id, "amount", String(Math.round((n / 100) * subtotal)));
                  }
                }}
                placeholder="%"
                className="w-full pl-2 pr-4 py-2 rounded-lg text-sm outline-none text-right"
                style={{ border: `1px solid ${hairline}`, color: ink, fontFamily: "'IBM Plex Mono', monospace" }}
              />
              <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: muted, fontSize: 11, pointerEvents: "none" }}>%</span>
            </div>
            <input
              type="text"
              inputMode="decimal"
              value={e.amount}
              onChange={(ev) => {
                // Typing an amount directly clears the % — otherwise the two
                // fields would silently disagree about where the figure came from.
                updateExpense(e.id, "pct", "");
                updateExpense(e.id, "amount", ev.target.value);
              }}
              placeholder="0"
              className="px-2 py-2 rounded-lg text-sm outline-none text-right"
              style={{ width: 76, flexShrink: 0, border: `1px solid ${hairline}`, color: (Number(e.amount) || 0) < 0 ? danger : ink, fontFamily: "'IBM Plex Mono', monospace" }}
            />
            <button
              onClick={() => {
                // Flips the sign of whichever field drives the amount, so a
                // %-based expense stays %-based when negated.
                if (e.pct && String(e.pct).trim() !== "") {
                  const np = -(Number(e.pct) || 0);
                  updateExpense(e.id, "pct", String(np));
                  updateExpense(e.id, "amount", String(Math.round((np / 100) * subtotal)));
                } else {
                  updateExpense(e.id, "amount", String(-(Number(e.amount) || 0)));
                }
              }}
              title="Make negative / positive — for a deduction on the invoice"
              style={{ color: inkSoft, flexShrink: 0, padding: "0 1px", fontSize: 15, fontWeight: 700, lineHeight: 1 }}
            >
              ±
            </button>
            <button onClick={() => removeExpense(e.id)} style={{ color: danger, flexShrink: 0, padding: "0 2px" }}><Trash2 size={16} /></button>
          </div>
        ))}
        <button
          onClick={addExpense}
          className="w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
          style={{ border: `1px dashed ${hairline}`, color: muted }}
        >
          <Plus size={14} /> Add Other Expense
        </button>

        <Stitch margin="16px 0" />

        <div className="space-y-1.5">
          <Row label="Subtotal" value={fmtMoney(subtotal)} />
          <Row label="Expenses" value={fmtMoney(expenseTotal)} />
          <Row label="Total" value={fmtMoney(total)} big />
        </div>
      </Section>

      <SizeSummary items={draft.items} />

      {customerHistory.length > 0 && (
        <Section title="Recent Invoices for this Customer">
          <div className="space-y-2">
            {customerHistory.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                style={{ background: paper, border: `1px solid ${hairline}` }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: inkSoft, fontWeight: 600, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{inv.invoiceNo}</div>
                  <div style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {fmtDate(inv.date)} · {inv.items.length} item{inv.items.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span style={{ color: ink, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13 }}>{fmtMoney(invoiceTotal(inv))}</span>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold"
                    style={{ background: inv.status === "Paid" ? successBg : dangerBg, color: inv.status === "Paid" ? success : danger }}
                  >
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="flex gap-3 sticky bottom-0 py-3" style={{ background: paper }}>
        <button onClick={onCancel} className="flex-1 py-3 rounded-lg font-semibold text-sm" style={{ border: `1px solid ${hairline}`, color: muted }}>
          Cancel
        </button>
        <button onClick={onSave} className="flex-1 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2" style={{ background: thread, color: ink }}>
          <Save size={16} /> Save Invoice
        </button>
      </div>

      <KeyboardNavToolbar onAddLine={addItem} />

      {showPreview && (
        <InvoicePreviewModal
          invoice={draft}
          customer={previewCustomer}
          onClose={() => setShowPreview(false)}
          onPrint={() => {
            setShowPreview(false);
            onPreviewPrint(draft);
          }}
        />
      )}
    </div>
  );
}

// Camera-based QR scanner for invoice import. Continuously grabs video
// frames onto a canvas and runs jsQR against each one — there's no need for
// a heavier library like html5-qrcode just for decoding, and this keeps the
// bundle smaller. Stops the camera stream as soon as a code is found (or on
// unmount/cancel) rather than leaving it running.
function QrImportModal({ onClose, onConfirm }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | scanning | error | result
  const [decoded, setDecoded] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [scanKey, setScanKey] = useState(0);

  useEffect(() => {
    let raf;
    let cancelled = false;
    setStatus("starting");
    setDecoded(null);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus("scanning");
        const { default: jsQR } = await import("jsqr");
        const tick = () => {
          if (cancelled) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code && code.data) {
              streamRef.current?.getTracks().forEach((t) => t.stop());
              setDecoded(decodeInvoiceQr(code.data));
              setStatus("result");
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        setCameraError(e?.message || "Could not access the camera. Check camera permissions and that this page is loaded over HTTPS.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [scanKey]);

  const itemsTotal = decoded?.ok && decoded.mode === "full"
    ? decoded.items.reduce((s, it) => s + lineAmount(it), 0) + (decoded.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0)
    : 0;

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.55)", zIndex: 70 }}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: "#fff" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>Scan Invoice QR Code</h3>
          <button onClick={onClose}><X size={20} color={muted} /></button>
        </div>

        {(status === "starting" || status === "scanning") && (
          <>
            <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", aspectRatio: "1" }}>
              <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div style={{ position: "absolute", inset: 24, border: "2px solid rgba(255,255,255,0.7)", borderRadius: 10, pointerEvents: "none" }} />
            </div>
            <p style={{ color: muted, fontSize: 13, textAlign: "center", marginTop: 12 }}>
              {status === "starting" ? "Starting camera…" : "Point the camera at the invoice's QR code."}
            </p>
          </>
        )}

        {status === "error" && (
          <div className="text-center py-6">
            <Camera size={28} color={danger} className="mx-auto mb-3" />
            <p style={{ color: danger, fontSize: 13.5, fontWeight: 600 }}>{cameraError}</p>
            <button onClick={() => setScanKey((k) => k + 1)} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: thread, color: ink }}>
              Try Again
            </button>
          </div>
        )}

        {status === "result" && decoded && !decoded.ok && (
          <div className="text-center py-6">
            <AlertCircle size={28} color={danger} className="mx-auto mb-3" />
            <p style={{ color: danger, fontSize: 13.5, fontWeight: 600 }}>{decoded.error}</p>
            <button onClick={() => setScanKey((k) => k + 1)} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: thread, color: ink }}>
              Scan Again
            </button>
          </div>
        )}

        {status === "result" && decoded?.ok && decoded.mode === "ref" && (
          <div className="text-center py-6">
            <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold mb-3" style={{ background: dangerBg, color: danger }}>Reference only</span>
            <p style={{ color: ink, fontSize: 14, fontWeight: 600 }}>{decoded.invoiceNo} · {decoded.customerName}</p>
            <p style={{ color: muted, fontSize: 13, marginTop: 4 }}>{fmtDate(decoded.date)}</p>
            <p style={{ color: muted, fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>
              This code only confirms the invoice number, customer, and date — it doesn't carry line items, so there's nothing to import. Use CSV export/import for a full copy of this invoice.
            </p>
            <button onClick={() => setScanKey((k) => k + 1)} className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>
              Scan Again
            </button>
          </div>
        )}

        {status === "result" && decoded?.ok && decoded.mode === "full" && (
          <div>
            <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold mb-3" style={{ background: successBg, color: success }}>Full data</span>
            <div className="rounded-lg p-3 mb-4" style={{ background: paper, border: `1px solid ${hairline}` }}>
              <div className="flex justify-between mb-1"><span style={{ color: muted, fontSize: 13 }}>Invoice No.</span><span style={{ color: ink, fontWeight: 600, fontSize: 13 }}>{decoded.invoiceNo}</span></div>
              <div className="flex justify-between mb-1"><span style={{ color: muted, fontSize: 13 }}>Customer</span><span style={{ color: ink, fontWeight: 600, fontSize: 13 }}>{decoded.customerName}</span></div>
              <div className="flex justify-between mb-1"><span style={{ color: muted, fontSize: 13 }}>Date</span><span style={{ color: ink, fontSize: 13 }}>{fmtDate(decoded.date)}</span></div>
              <div className="flex justify-between mb-1"><span style={{ color: muted, fontSize: 13 }}>Items</span><span style={{ color: ink, fontSize: 13 }}>{decoded.items.length}</span></div>
              <div className="flex justify-between"><span style={{ color: muted, fontSize: 13 }}>Total</span><span style={{ color: ink, fontWeight: 700, fontSize: 14, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(itemsTotal)}</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setScanKey((k) => k + 1)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>
                Rescan
              </button>
              <button onClick={() => onConfirm(decoded)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1" style={{ background: thread, color: ink }}>
                <Check size={16} /> Import
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// Renders an invoice's QR code (dynamically imports the `qrcode` library so
// it's not in the main bundle for people who never open this panel). Shows
// which mode it encoded as — full data (re-importable) or reference-only
// (this invoice had too many line items to fit in one QR).
function InvoiceQrPanel({ invoice, customerName }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [qrMode, setQrMode] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setError("");
    (async () => {
      try {
        const { text, mode } = encodeInvoiceQr(invoice, customerName);
        const QRCode = await import("qrcode");
        const url = await QRCode.toDataURL(text, { width: 240, margin: 4, errorCorrectionLevel: "M" });
        if (!cancelled) { setDataUrl(url); setQrMode(mode); }
      } catch (e) {
        if (!cancelled) setError("Could not generate QR code.");
      }
    })();
    return () => { cancelled = true; };
  }, [invoice, customerName]);

  return (
    <Section title="Invoice QR Code">
      {error ? (
        <p style={{ color: danger, fontSize: 13 }}>{error}</p>
      ) : !dataUrl ? (
        <p style={{ color: muted, fontSize: 13 }}>Generating…</p>
      ) : (
        <div className="flex items-center gap-4 flex-wrap">
          <img src={dataUrl} alt="Invoice QR code" style={{ width: 140, height: 140, borderRadius: 8, border: `1px solid ${hairline}` }} />
          <div style={{ maxWidth: 320 }}>
            {qrMode === "full" ? (
              <>
                <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: successBg, color: success }}>Full data</span>
                <p style={{ color: muted, fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>
                  Scanning this code re-imports the whole invoice — items, rates, and all — via Sales → Import via QR.
                </p>
              </>
            ) : (
              <>
                <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: dangerBg, color: danger }}>Reference only</span>
                <p style={{ color: muted, fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>
                  This invoice has too many line items to fit in a single QR code. This one only confirms the invoice number, customer, and date — it can't rebuild the items. Use CSV export/import for a full copy of this invoice instead.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
// Inline searchable dropdown: shows the selected label, opens a filterable
// list of options on focus/click. options: [{ value, label, sub? }].
// A compact inline dropdown (replaces native <select>). options: [{value,label}]
// or plain strings. Renders the selected label with a chevron; opens a styled
// list on click. Closes on outside-click or selection.


// A date input that always DISPLAYS dd/mm/yyyy (regardless of device locale),
// while storing the value as YYYY-MM-DD. A small calendar button opens the
// native picker for convenience; typing accepts dd/mm/yyyy or dd-mm-yyyy.

function Field({ label, children }) {
  return (
    <div>
      <div style={{ color: muted, fontSize: 12, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
function NumField({ label, value, onChange, disabled }) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={disabled ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={disabled ? "N/A" : undefined}
        className="w-full px-2.5 py-2 rounded-lg text-sm outline-none"
        style={{
          border: `1px solid ${hairline}`,
          color: disabled ? muted : ink,
          fontFamily: "'IBM Plex Mono', monospace",
          background: disabled ? "#F1EEE6" : "#fff",
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
    </Field>
  );
}
function TextField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-2 rounded-lg text-sm outline-none"
        style={{ border: `1px solid ${hairline}`, color: ink }}
      />
    </Field>
  );
}
function Row({ label, value, big }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: big ? ink : muted, fontSize: big ? 15 : 13, fontWeight: big ? 700 : 500 }}>{label}</span>
      <span style={{ color: ink, fontSize: big ? 18 : 14, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{value}</span>
    </div>
  );
}

// ================= CUSTOMER MODAL =================
// ================= RECEIPTS MODULE =================
const RECEIPT_MODES = ["Cash", "Bank", "Cheque", "Discount", "Sale Return"];
// Same idea for payments against a vendor bill — a return isn't a real money
// movement either, so it gets the same treatment as Discount (no bank
// account, excluded from cash/bank totals via paymentAccountLabel below).
const PAYMENT_MODES = ["Cash", "Bank", "Cheque", "Discount", "Purchase Return"];

// "Cash/Bank" label for a receipt: the bank account's own name (e.g. "BOB765")
// when paid via Bank, since that's the only receipt mode that currently
// collects a linked bank account — otherwise just the mode itself.
// Same for a payment: Bank, Cheque, and UPI payments can all be linked to a
// bank account (unlike receipts, where only Bank mode does), so any mode in
// that group resolves to the account name when one was set. Discount and
// Purchase Return are never real money movement though, so those always
// just show the mode itself — even if a bank name is still sitting in the
// record from before the mode was switched (see PaymentModal, which now
// clears it when you switch away from a bank-eligible mode).

function ReceiptsView({ receipts, customers, invoices, onAdd, onEdit, onDelete, onBulkDelete, dateFrom, dateTo, setDateFrom, setDateTo, quickRangeDates, onPreviewRegister, onExportCsv, onImportCsv, onManageBanks }) {
  const importRef = useRef(null);
  const [q, setQ] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const customerById = useMemo(() => {
    const m = new Map();
    for (const c of customers) m.set(c.id, c);
    return m;
  }, [customers]);
  const invoiceById = useMemo(() => {
    const m = new Map();
    for (const i of invoices) m.set(i.id, i);
    return m;
  }, [invoices]);
  const custName = (id) => customerById.get(id)?.name || "—";
  const list = receipts
    .filter((r) => {
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      return (
        (r.receiptNo || "").toLowerCase().includes(needle) ||
        custName(r.customerId).toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
  const total = list.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const byAccount = useMemo(() => {
    const map = new Map();
    for (const r of list) {
      const label = receiptAccountLabel(r);
      const e = map.get(label) || { label, count: 0, amount: 0 };
      e.count += 1;
      e.amount += Number(r.amount) || 0;
      map.set(label, e);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [list]);
  const visibleIds = list.map((r) => r.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleSelect = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleSelectAll = () => setSelected(allSelected ? [] : visibleIds);
  const confirmBulkDelete = () => { onBulkDelete(selected); setSelected([]); setBulkConfirm(false); };
  // Rendering is paginated; selection/"select all" still operate on the full
  // filtered `list` above, not just the visible page.
  const RECEIPT_PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(list.length / RECEIPT_PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pagedList = list.slice(pageSafe * RECEIPT_PAGE_SIZE, (pageSafe + 1) * RECEIPT_PAGE_SIZE);

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 28, fontWeight: 600 }}>Receipts</h1>
          <p style={{ color: muted, fontSize: 13, marginTop: 2 }}>{receipts.length} receipt{receipts.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) onImportCsv(e.target.files[0]); e.target.value = ""; }}
          />
          <button
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-2.5 rounded-lg font-semibold text-xs"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Import receipts from CSV"
          >
            <Upload size={14} /> CSV
          </button>
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1 px-2.5 py-2.5 rounded-lg font-semibold text-xs"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Export receipts to CSV"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={onPreviewRegister}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Preview receipts register"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={onManageBanks}
            className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Manage bank accounts"
          >
            <Landmark size={16} />
          </button>
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: thread, color: ink }}
          >
            <Plus size={16} strokeWidth={2.5} /> New Receipt
          </button>
        </div>
      </div>

      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4"
        style={{ background: card, border: `1px solid ${hairline}` }}
      >
        <Search size={15} color={muted} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customer or receipt no."
          className="flex-1 outline-none text-sm bg-transparent"
          style={{ color: ink }}
        />
      </div>

      <DateRangeBar from={dateFrom} to={dateTo} setFrom={setDateFrom} setTo={setDateTo} quickRangeDates={quickRangeDates} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ background: card, border: `1px solid ${hairline}` }}
        >
          <div>
            <div style={{ color: muted, fontSize: 12 }}>Total Received</div>
            <div style={{ color: success, fontWeight: 700, fontSize: 22, fontFamily: "'Fraunces', serif" }}>
              {fmtMoney(total)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: muted, fontSize: 12 }}>Count</div>
            <div style={{ color: ink, fontWeight: 700, fontSize: 22, fontFamily: "'IBM Plex Mono', monospace" }}>
              {list.length}
            </div>
          </div>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: card, border: `1px solid ${hairline}` }}>
          <div style={{ color: muted, fontSize: 12, marginBottom: 6 }}>Cash/Bank</div>
          {byAccount.length === 0 ? (
            <div style={{ color: muted, fontSize: 13 }}>No receipts.</div>
          ) : (
            <div className="space-y-1">
              {byAccount.map((a) => (
                <div key={a.label} className="flex items-center justify-between">
                  <span style={{ color: inkSoft, fontSize: 13 }}>{a.label} <span style={{ color: muted, fontSize: 11.5 }}>({a.count})</span></span>
                  <span style={{ color: ink, fontWeight: 600, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(a.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: ink }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{selected.length} selected</span>
          <div className="flex items-center gap-2">
            {bulkConfirm ? (
              <>
                <button onClick={confirmBulkDelete} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: danger, color: "#fff" }}>Delete {selected.length}?</button>
                <button onClick={() => setBulkConfirm(false)} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "transparent", color: "#B9C2D6", border: "1px solid #4A5D8A" }}>Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => setBulkConfirm(true)} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "transparent", color: "#F3B0A0", border: "1px solid #6E4A44" }}><Trash2 size={13} /> Delete</button>
                <button onClick={() => setSelected([])} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "transparent", color: "#B9C2D6", border: "1px solid #4A5D8A" }}>Clear</button>
              </>
            )}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: card, border: `1px dashed ${hairline}` }}>
          <IndianRupee size={28} color={muted} className="mx-auto mb-3" />
          <p style={{ color: ink, fontWeight: 600, fontSize: 15 }}>{q ? "No matches" : "No receipts yet"}</p>
          <p style={{ color: muted, fontSize: 13, marginTop: 4 }}>{q ? "Try a different search." : "Record your first receipt to get started."}</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${hairline}` }}>
          <div className="overflow-x-auto">
          <div style={{ minWidth: 500 }}>
          <div
            className="grid items-center gap-2 px-3 py-2"
            style={{ gridTemplateColumns: "24px 32px 84px minmax(120px,1fr) 70px 92px 36px", background: paper, borderBottom: `1px solid ${hairline}` }}
          >
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ width: 15, height: 15, accentColor: thread }} />
            <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>SR</span>
            <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>DATE</span>
            <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>CUSTOMER</span>
            <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>CASH/BANK</span>
            <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textAlign: "left" }}>AMOUNT</span>
            <span></span>
          </div>
          {pagedList.map((r, idx) => {
            const confirming = pendingDelete === r.id;
            const linkedInv = r.invoiceId ? invoiceById.get(r.invoiceId) : null;
            const srIdx = pageSafe * RECEIPT_PAGE_SIZE + idx;
            return (
              <div
                key={r.id}
                className="grid items-center gap-2 px-3 py-2.5"
                style={{
                  gridTemplateColumns: "24px 32px 84px minmax(120px,1fr) 70px 92px 36px",
                  borderTop: idx > 0 ? `1px solid ${hairline}` : "none",
                  background: selected.includes(r.id) ? "#FBF4E7" : "transparent",
                  cursor: "pointer",
                }}
                onClick={() => onEdit(r)}
              >
                <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} onClick={(e) => e.stopPropagation()} style={{ width: 15, height: 15, accentColor: thread }} />
                <span style={{ color: muted, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>{list.length - srIdx}</span>
                <span style={{ color: muted, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmtDate(r.date)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: ink, fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {custName(r.customerId)}
                  </div>
                  <div style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {r.receiptNo}{linkedInv ? ` · ${linkedInv.invoiceNo}` : ""}
                  </div>
                </div>
                <span style={{ color: inkSoft, fontSize: 12, fontWeight: 600 }}>{receiptAccountLabel(r)}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: success, fontSize: 13, textAlign: "right", whiteSpace: "nowrap" }}>
                  {fmtMoney(r.amount)}
                </span>
                <div style={{ textAlign: "right" }}>
                  {confirming ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(r.id); setPendingDelete(null); }}
                        className="px-1.5 py-1 rounded-md font-semibold"
                        style={{ background: danger, color: "#fff", fontSize: 10, whiteSpace: "nowrap" }}
                      >
                        Sure?
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setPendingDelete(null); }}
                        className="px-1 py-1 rounded-md font-semibold"
                        style={{ color: muted, fontSize: 10 }}
                        title="Cancel"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <IconBtn onClick={(e) => { e.stopPropagation(); setPendingDelete(r.id); }} title="Delete" danger><Trash2 size={14} /></IconBtn>
                  )}
                </div>
              </div>
            );
          })}
          </div>
          </div>
        </div>
      )}

      {list.length > 0 && pageCount > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span style={{ color: muted, fontSize: 12.5 }}>
            {pageSafe * RECEIPT_PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * RECEIPT_PAGE_SIZE, list.length)} of {list.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={pageSafe === 0}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: pageSafe === 0 ? hairline : ink, cursor: pageSafe === 0 ? "not-allowed" : "pointer" }}
              title="Previous"
            >
              <ArrowLeft size={15} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={pageSafe >= pageCount - 1}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: pageSafe >= pageCount - 1 ? hairline : ink, cursor: pageSafe >= pageCount - 1 ? "not-allowed" : "pointer" }}
              title="Next"
            >
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// `dupNames` is optional — the plain CSV importers only pass counts, so this
// stays exactly as before for them. Only callers that can name the actual
// duplicates (currently the Tally import) get the "Exceptions" button.
function ImportDuplicateModal({ label, newCount, dupCount, dupNames, onResolve }) {
  const [showList, setShowList] = useState(false);
  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: "#fff", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Duplicate {label}{dupCount !== 1 ? "s" : ""} found
        </h3>
        <p style={{ color: muted, fontSize: 13.5, lineHeight: 1.5, marginBottom: 12 }}>
          {dupCount} {label}{dupCount !== 1 ? "s" : ""} in this file already exist{dupCount === 1 ? "s" : ""}.
          {newCount > 0 ? ` ${newCount} new ${label}${newCount !== 1 ? "s" : ""} will be added either way.` : ""} How should the duplicates be handled?
        </p>

        {dupNames?.length > 0 && (
          <div className="mb-3">
            <button
              onClick={() => setShowList((v) => !v)}
              className="flex items-center gap-1 text-sm font-semibold"
              style={{ color: thread }}
            >
              {showList ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              Exceptions — see which {dupCount !== 1 ? "ones" : "one"}
            </button>
            {showList && (
              <div className="mt-2 rounded-lg" style={{ border: `1px solid ${hairline}`, maxHeight: 180, overflowY: "auto" }}>
                {dupNames.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-1.5"
                    style={{ borderTop: i > 0 ? `1px solid ${hairline}` : "none", fontSize: 12.5 }}
                  >
                    <span style={{ color: ink }}>{d.name}</span>
                    <span style={{ color: muted, fontSize: 11 }}>{d.kind}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={() => onResolve("replace")}
            className="w-full py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: thread, color: ink }}
          >
            Replace existing with imported
          </button>
          <button
            onClick={() => onResolve("skip")}
            className="w-full py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
          >
            Skip duplicates{newCount > 0 ? `, add ${newCount} new` : ""}
          </button>
          <button
            onClick={() => onResolve("cancel")}
            className="w-full py-2 rounded-lg font-medium text-sm"
            style={{ color: muted }}
          >
            Cancel import
          </button>
        </div>
      </div>
    </div>
  );
}

function BankAccountsModal({ bankAccounts, onSave, onDelete, onClose }) {
  const [editing, setEditing] = useState(null); // account being edited, or null
  const [form, setForm] = useState({ bankName: "", accountNumber: "", ifsc: "", notes: "" });
  const set = (f) => (e) => setForm((v) => ({ ...v, [f]: e.target.value }));
  const inputCls = "flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-sm outline-none";
  const inputStyle = { border: `1px solid ${hairline}`, color: ink, background: "#fff" };
  const startAdd = () => { setEditing(null); setForm({ bankName: "", accountNumber: "", ifsc: "", notes: "" }); };
  const startEdit = (b) => { setEditing(b.id); setForm({ bankName: b.bankName || "", accountNumber: b.accountNumber || "", ifsc: b.ifsc || "", notes: b.notes || "" }); };
  const save = () => { if (onSave({ ...form, id: editing })) startAdd(); };
  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8 overflow-y-auto" style={{ background: "rgba(30,42,68,0.45)", zIndex: 50 }}>
      <div className="w-full max-w-md rounded-xl p-5 my-auto" style={{ background: "#fff" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>Bank Accounts</h3>
          <button onClick={onClose}><X size={18} color={muted} /></button>
        </div>

        {/* existing accounts */}
        <div className="mb-4">
          {bankAccounts.length === 0 ? (
            <p style={{ color: muted, fontSize: 13 }}>No bank accounts yet. Add one below.</p>
          ) : (
            <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${hairline}` }}>
              {bankAccounts.map((b, i) => (
                <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-2" style={{ borderTop: i > 0 ? `1px solid ${hairline}` : "none" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: ink, fontWeight: 600, fontSize: 13 }}>{b.bankName}</div>
                    <div style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {[b.accountNumber, b.ifsc].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconBtn onClick={() => startEdit(b)} title="Edit"><Edit2 size={14} /></IconBtn>
                    <IconBtn onClick={() => onDelete(b.id)} title="Delete" danger><Trash2 size={14} /></IconBtn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* add / edit form */}
        <div style={{ borderTop: `1px solid ${hairline}`, paddingTop: 14 }}>
          <div style={{ color: inkSoft, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", marginBottom: 10 }}>
            {editing ? "EDIT ACCOUNT" : "ADD ACCOUNT"}
          </div>
          <div className="space-y-2.5">
            <InlineRow label="Bank Name">
              <input autoFocus value={form.bankName} onChange={set("bankName")} className={inputCls} style={inputStyle} placeholder="e.g. BOB765" />
            </InlineRow>
            <InlineRow label="Account No.">
              <input value={form.accountNumber} onChange={set("accountNumber")} className={inputCls} style={inputStyle} />
            </InlineRow>
            <InlineRow label="IFSC">
              <input value={form.ifsc} onChange={set("ifsc")} className={inputCls} style={inputStyle} />
            </InlineRow>
            <InlineRow label="Notes">
              <input value={form.notes} onChange={set("notes")} className={inputCls} style={inputStyle} />
            </InlineRow>
          </div>
          <div className="flex gap-2 mt-4">
            {editing && (
              <button onClick={startAdd} className="px-4 py-2 rounded-lg font-semibold text-sm" style={{ border: `1px solid ${hairline}`, color: muted }}>
                Cancel Edit
              </button>
            )}
            <button onClick={save} className="flex-1 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2" style={{ background: thread, color: ink }}>
              <Check size={16} /> {editing ? "Save Changes" : "Add Account"}
            </button>
          </div>
        </div>

        <button onClick={onClose} className="w-full mt-3 py-2.5 rounded-lg font-semibold text-sm" style={{ border: `1px solid ${hairline}`, color: muted }}>
          Done
        </button>
      </div>
    </div>
  );
}

function ReceiptModal({ customers, invoices, bankAccounts = [], invoiceTotal, value, onSave, onClose, customerOutstanding }) {
  const [form, setForm] = useState(() => {
    if (!value) return { customerId: "", date: todayISO(), amount: "", mode: "Cash", invoiceId: "", reference: "", notes: "", bankAccountId: "" };
    // Older receipts (CSV imports, manual entries from before bank accounts
    // were linked by id) only ever stored a free-text bankName, never a
    // bankAccountId — so the dropdown had nothing to match and fell back to
    // "Select bank account" even though the name was right there. Resolve it
    // by name against the configured accounts so editing shows it selected.
    let bankAccountId = value.bankAccountId || "";
    if (!bankAccountId && value.bankName) {
      const match = bankAccounts.find((b) => b.bankName.toLowerCase() === value.bankName.toLowerCase());
      if (match) bankAccountId = match.id;
    }
    return {
      customerId: value.customerId || "", date: value.date || todayISO(), amount: value.amount || "",
      mode: value.mode || "Cash", invoiceId: value.invoiceId || "", reference: value.reference || "",
      notes: value.notes || "", bankAccountId,
    };
  });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const inputCls = "flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-sm outline-none";
  const inputStyle = { border: `1px solid ${hairline}`, color: ink, background: "#fff" };
  const customerInvoices = form.customerId
    ? invoices.filter((i) => i.customerId === form.customerId).sort((a, b) => (a.date < b.date ? 1 : -1))
    : [];
  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8 overflow-y-auto" style={{ background: "rgba(30,42,68,0.45)", zIndex: 50 }}>
      <div className="w-full max-w-sm rounded-xl p-5 my-auto" style={{ background: "#fff" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>{value?.id ? "Edit Receipt" : "New Receipt"}</h3>
          <button onClick={onClose}><X size={18} color={muted} /></button>
        </div>
        <div className="space-y-2.5">
          <InlineRow label="Customer">
            <SearchableSelect
              value={form.customerId}
              onChange={(v) => setForm((f) => ({ ...f, customerId: v, invoiceId: "" }))}
              options={customers.map((c) => ({ value: c.id, label: c.name, sub: [c.address, c.phone1].filter(Boolean).join(" · ") }))}
              placeholder="Search customer…"
              inputStyle={inputStyle}
              className={inputCls}
            />
          </InlineRow>
          {/* Balance as of today, so it's clear what's outstanding while
              entering the receipt. */}
          {form.customerId && customerOutstanding && (() => {
            const bal = customerOutstanding(form.customerId);
            return (
              <div className="flex justify-end" style={{ marginTop: 2, marginBottom: 4 }}>
                <span style={{ color: muted, fontSize: 11.5 }}>
                  Balance:{" "}
                  <b style={{ color: bal > 0 ? success : bal < 0 ? danger : ink, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {fmtMoney(Math.abs(bal))} {bal >= 0 ? "Dr" : "Cr"}
                  </b>
                </span>
              </div>
            );
          })()}
          <InlineRow label="Date">
            <DateField value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} className={inputCls} style={inputStyle} />
          </InlineRow>
          <InlineRow label="Amount">
            <input type="number" inputMode="decimal" value={form.amount} onChange={set("amount")} className={inputCls} style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }} />
          </InlineRow>
          <InlineRow label="Mode">
            <InlineSelect
              value={form.mode}
              onChange={(v) => setForm((f) => ({ ...f, mode: v }))}
              options={RECEIPT_MODES}
              className={inputCls}
              style={inputStyle}
            />
          </InlineRow>
          {form.mode === "Bank" && (
            <InlineRow label="Bank A/c">
              <InlineSelect
                value={form.bankAccountId}
                onChange={(v) => {
                  const acc = bankAccounts.find((b) => b.id === v);
                  setForm((f) => ({ ...f, bankAccountId: v, bankName: acc?.bankName || "", accountNumber: acc?.accountNumber || "" }));
                }}
                options={bankAccounts.map((b) => ({ value: b.id, label: `${b.bankName}${b.accountNumber ? ` (${b.accountNumber})` : ""}` }))}
                placeholder={bankAccounts.length ? "Select bank account" : "No banks — add via Banks button"}
                className={inputCls}
                style={{ ...inputStyle, background: "#fff", cursor: "pointer" }}
              />
            </InlineRow>
          )}
          <InlineRow label="Invoice">
            {value?.allocations && value.allocations.length > 0 ? (
              <div className={inputCls} style={{ ...inputStyle, cursor: "default" }}>
                {value.allocations.map((a, i) => {
                  const inv = invoices.find((x) => x.id === a.invoiceId);
                  return (
                    <div key={i} className="flex items-center justify-between" style={{ fontSize: 13, color: ink, padding: i > 0 ? "3px 0 0" : 0 }}>
                      <span>{inv?.invoiceNo || "Invoice not found"}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: muted }}>{fmtMoney(a.amount)}</span>
                    </div>
                  );
                })}
                <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>
                  Combined receipt — covers {value.allocations.length} invoices
                </div>
              </div>
            ) : (
              <InlineSelect
                value={form.invoiceId}
                onChange={(v) => setForm((f) => ({ ...f, invoiceId: v }))}
                options={[{ value: "", label: "On account (none)" }, ...customerInvoices.map((i) => ({ value: i.id, label: `${i.invoiceNo} — ${fmtMoney(invoiceTotal(i))} (${i.status})` }))]}
                disabled={!form.customerId}
                className={inputCls}
                style={{ ...inputStyle, background: form.customerId ? "#fff" : "#F1EEE6", cursor: form.customerId ? "pointer" : "not-allowed" }}
              />
            )}
          </InlineRow>
          <InlineRow label="Reference">
            <input value={form.reference} onChange={set("reference")} placeholder="Cheque / ref no." className={inputCls} style={inputStyle} />
          </InlineRow>
          <InlineRow label="Notes">
            <input value={form.notes} onChange={set("notes")} className={inputCls} style={inputStyle} />
          </InlineRow>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg font-semibold text-sm" style={{ border: `1px solid ${hairline}`, color: muted }}>
            Cancel
          </button>
          <button onClick={() => onSave(form)} className="flex-1 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2" style={{ background: thread, color: ink }}>
            <Check size={16} /> {value?.id ? "Save Changes" : "Save Receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ GENERIC LANDSCAPE REPORT PREVIEW ============
// Paginates any column/rows table into A4-landscape two-up sheets, matching
// the invoice/register preview. columns: [{ header, align, width }]. rows are
// arrays of cell values aligned to columns. footer is an optional cell array.
const GENERIC_FIRST_ROWS = 20;
const GENERIC_OTHER_ROWS = 24;

function genericReportLayout(rows) {
  const pages = [];
  let i = 0, first = true;
  while (i < rows.length || (first && rows.length === 0)) {
    const cap = first ? GENERIC_FIRST_ROWS : GENERIC_OTHER_ROWS;
    pages.push({ rows: rows.slice(i, i + cap) });
    i += cap; first = false;
  }
  pages.forEach((p, idx) => { p.index = idx; p.isLast = idx === pages.length - 1; });
  return { pages, sheets: chunkSheets(pages) };
}

function GenericHalfPage({ page, pagesCount, title, subtitle, columns, footer, bigHeader, summaryLines }) {
  const th = (align) => ({ border: "1px solid #333", padding: "3px 6px", textAlign: align || "left", fontWeight: 700, background: "#f2f2f2", fontSize: 10 });
  const td = (align) => ({ border: "1px solid #333", padding: "2px 6px", textAlign: align || "left", fontSize: 10 });
  return (
    <>
      {bigHeader ? (
        <div style={{ marginTop: 30, marginBottom: 8 }}>
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", textTransform: "uppercase", color: "#000" }}>{title}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#000", marginTop: 2 }}>
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 12, color: "#000" }}>Textile Bill</span>
            <span>{subtitle}</span>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "right", fontSize: 10, marginTop: 30, marginBottom: 6, color: "#000" }}>{title} | {fmtDate(todayISO())}</div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{columns.map((c, i) => <th key={i} style={th(c.align)}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {page.rows.map((cells, ri) => (
            <tr key={ri}>
              {cells.map((v, ci) => (
                <td key={ci} style={{ ...td(columns[ci]?.align), ...(columns[ci]?.width ? { maxWidth: columns[ci].width, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : {}) }}>{v}</td>
              ))}
            </tr>
          ))}
          {page.rows.length === 0 && (
            <tr><td colSpan={columns.length} style={{ ...td("center"), padding: "12px 6px", color: "#888" }}>No rows.</td></tr>
          )}
        </tbody>
        {page.isLast && footer && (
          <tfoot>
            <tr style={{ fontWeight: 700 }}>{footer.map((v, i) => <td key={i} style={{ ...td(columns[i]?.align), borderTop: "2px solid #333" }}>{v}</td>)}</tr>
          </tfoot>
        )}
      </table>
      {page.isLast && summaryLines && summaryLines.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>Cash/Bank Summary</div>
          {summaryLines.map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
              <span>{s.label}</span>
              <span>{s.value}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ textAlign: "center", fontSize: 9, color: "#000", marginTop: 6 }}>Page {page.index + 1}/{pagesCount}</div>
    </>
  );
}

function GenericReportSheet({ sheetPages, layout, title, subtitle, columns, footer, summaryLines }) {
  // Two logical pages side by side on one physical landscape sheet. Floats,
  // not flex: mobile Safari/Chrome (WebKit) print engines have a long-standing
  // bug where flex children in a printed page can each get promoted onto
  // their own physical page instead of staying side by side, which both
  // wastes paper and leaves most of each page blank. Floats paginate
  // reliably across engines.
  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      {sheetPages.map((page, colIdx) => (
        <div key={colIdx} style={{ float: "left", width: "50%", boxSizing: "border-box", padding: "14px 18px", borderRight: colIdx === 0 ? "1px dashed #999" : "none", fontSize: 11 }}>
          <GenericHalfPage page={page} pagesCount={layout.pages.length} title={title} subtitle={subtitle} columns={columns} footer={footer} bigHeader={page.index === 0} summaryLines={summaryLines} />
        </div>
      ))}
      {sheetPages.length === 1 && <div style={{ float: "left", width: "50%", boxSizing: "border-box" }} />}
    </div>
  );
}

function GenericReportPrint({ rows, title, subtitle, columns, footer, summaryLines }) {
  const layout = genericReportLayout(rows);
  return (
    <div className="print-area packing-print" style={{ fontFamily: "'Inter', sans-serif", color: "#111" }}>
      {layout.sheets.map((sheetPages, sIdx) => (
        <div key={sIdx} className="print-sheet">
          <GenericReportSheet sheetPages={sheetPages} layout={layout} title={title} subtitle={subtitle} columns={columns} footer={footer} summaryLines={summaryLines} />
        </div>
      ))}
    </div>
  );
}

function GenericReportPreview({ rows, title, subtitle, columns, footer, summaryLines, onClose }) {
  const layout = genericReportLayout(rows);
  return (
    <PrintPreviewOverlay
      title={title}
      subtitle={`landscape, 2 pages per sheet · ${layout.pages.length} page${layout.pages.length !== 1 ? "s" : ""} · ${subtitle}`}
      onClose={onClose}
    >
      {layout.sheets.map((sheetPages, sIdx) => (
        <PaperSheet key={sIdx} landscape>
          <GenericReportSheet sheetPages={sheetPages} layout={layout} title={title} subtitle={subtitle} columns={columns} footer={footer} summaryLines={summaryLines} />
        </PaperSheet>
      ))}
    </PrintPreviewOverlay>
  );
}

// ============ CHART OF ACCOUNTS ============
// System (non-party) ledger accounts always present in a sales book.
const SYSTEM_ACCOUNTS = [
  { name: "Sales Account", header: "Sales" },
  { name: "Cash", header: "Cash" },
  { name: "Bank", header: "Bank" },
  { name: "Round Off", header: "Income" },
  { name: "Discount Allowed", header: "Expense" },
  { name: "Discount Received", header: "Income" },
  { name: "Sales Return", header: "Sales" },
  { name: "Purchase Return", header: "Purchase" },
];

// Accounting-style header labels shown in the Chart of Accounts.
const ACCOUNT_HEADER_LABEL = {
  Customer: "Sundry Debtors",
  Vendor: "Sundry Creditors",
  Bank: "Bank Accounts",
  Sales: "Sales Accounts",
  Purchase: "Purchase Accounts",
  Cash: "Cash in Hand",
  Expense: "Indirect Expenses",
  Income: "Indirect Income",
};
const accountHeaderLabel = (type) => ACCOUNT_HEADER_LABEL[type] || type;


// Manage the units of measurement offered on invoice and purchase line
// items. A unit already used on a saved document can't be deleted, since
// that would leave those line items pointing at a unit that no longer
// exists — rename is offered instead, which rewrites them in place.
function UnitsView({ units, invoices, purchases, onSave }) {
  const [modal, setModal] = useState(null); // null | {} (new) | unit (edit)
  const [pendingDelete, setPendingDelete] = useState(null);

  // How many saved line items reference each unit — drives the "in use"
  // count and blocks deletion.
  const usage = useMemo(() => {
    const m = new Map();
    const bump = (u) => m.set(u, (m.get(u) || 0) + 1);
    for (const inv of invoices || []) for (const it of inv.items || []) if (it.unit) bump(it.unit);
    for (const p of purchases || []) for (const it of p.items || []) if (it.unit) bump(it.unit);
    return m;
  }, [invoices, purchases]);

  function saveUnit(data) {
    const name = data.name.trim();
    const abbr = (data.abbr || "").trim() || name;
    if (!name) return;
    const clash = units.some((u) => u.name.toLowerCase() === name.toLowerCase() && u.id !== data.id);
    if (clash) return; // guarded in the modal too
    if (data.id) {
      const prev = units.find((u) => u.id === data.id);
      onSave(units.map((u) => (u.id === data.id ? { ...u, name, abbr, count: !!data.count } : u)), prev?.name, name);
    } else {
      onSave([...units, { id: uid(), name, abbr, count: !!data.count }]);
    }
    setModal(null);
  }

  return (
    <div className="rounded-xl p-5 mb-4" style={{ background: card, border: `1px solid ${hairline}` }}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 17, fontWeight: 600 }}>Units of Measurement</h3>
          <p style={{ color: muted, fontSize: 13, lineHeight: 1.5, marginTop: 2 }}>
            Units offered on invoice and purchase line items. A “counted” unit (like Pcs) has no size — its amount is quantity × rate.
          </p>
        </div>
        <button onClick={() => setModal({})} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap" style={{ background: thread, color: ink }}>
          <Plus size={15} /> Add Unit
        </button>
      </div>

      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${hairline}` }}>
        <div className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: "minmax(0,1fr) 70px 62px 60px", background: paper, borderBottom: `1px solid ${hairline}` }}>
          <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>UNIT</span>
          <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>SHORT</span>
          <span style={{ color: muted, fontSize: 11, fontWeight: 700, textAlign: "center" }}>SIZE</span>
          <span style={{ color: muted, fontSize: 11, fontWeight: 700, textAlign: "right" }}>ACTIONS</span>
        </div>
        {units.map((u, idx) => {
          const used = usage.get(u.name) || 0;
          return (
            <div key={u.id} className="grid items-center gap-2 px-3 py-2.5" style={{ gridTemplateColumns: "minmax(0,1fr) 70px 62px 60px", borderTop: idx > 0 ? `1px solid ${hairline}` : "none" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: ink, fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                <div style={{ color: muted, fontSize: 11 }}>{used > 0 ? `used on ${used} line item${used !== 1 ? "s" : ""}` : "not used yet"}</div>
              </div>
              <span style={{ color: inkSoft, fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace" }}>{u.abbr || u.name}</span>
              <span style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: u.count ? muted : success }}>{u.count ? "—" : "YES"}</span>
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => setModal(u)} className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, color: inkSoft }} title="Edit">
                  <Edit2 size={14} />
                </button>
                {pendingDelete === u.id ? (
                  <button onClick={() => { onSave(units.filter((x) => x.id !== u.id)); setPendingDelete(null); }} className="text-xs font-bold" style={{ color: danger }}>Sure?</button>
                ) : (
                  <button
                    onClick={() => used === 0 && units.length > 1 && setPendingDelete(u.id)}
                    disabled={used > 0 || units.length <= 1}
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 28, height: 28, color: (used > 0 || units.length <= 1) ? hairline : danger, cursor: (used > 0 || units.length <= 1) ? "not-allowed" : "pointer" }}
                    title={used > 0 ? "In use on saved documents — rename it instead" : units.length <= 1 ? "At least one unit is required" : "Delete"}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <UnitModal
          value={modal.id ? modal : null}
          existing={units}
          inUse={modal.id ? (usage.get(modal.name) || 0) : 0}
          onClose={() => setModal(null)}
          onSave={saveUnit}
        />
      )}
    </div>
  );
}

function UnitModal({ value, existing, inUse, onClose, onSave }) {
  const [name, setName] = useState(value?.name || "");
  const [abbr, setAbbr] = useState(value?.abbr || "");
  const [count, setCount] = useState(!!value?.count);
  const [error, setError] = useState("");

  function handleSave() {
    const n = name.trim();
    if (!n) { setError("Enter a unit name."); return; }
    if (existing.some((u) => u.name.toLowerCase() === n.toLowerCase() && u.id !== value?.id)) {
      setError("A unit with that name already exists."); return;
    }
    onSave({ id: value?.id, name: n, abbr: abbr.trim(), count });
  }

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: "#fff" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 20, fontWeight: 600 }}>{value ? "Edit Unit" : "Add Unit"}</h3>
          <button onClick={onClose}><X size={20} color={muted} /></button>
        </div>
        {error && (
          <div style={{ background: dangerBg, color: danger, fontSize: 12.5, padding: "8px 10px", borderRadius: 8, marginBottom: 12 }}>{error}</div>
        )}
        {inUse > 0 && (
          <div style={{ background: "#FBF4E7", color: "#8A6416", fontSize: 12, padding: "8px 10px", borderRadius: 8, marginBottom: 12, lineHeight: 1.45 }}>
            In use on {inUse} saved line item{inUse !== 1 ? "s" : ""}. Renaming updates them all; changing “has size” only affects how amounts are calculated from now on.
          </div>
        )}
        <div className="space-y-2.5">
          <InlineRow label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} style={inputStyle} autoFocus placeholder="e.g. Thaan" />
          </InlineRow>
          <InlineRow label="Short">
            <input value={abbr} onChange={(e) => setAbbr(e.target.value)} className={inputCls} style={inputStyle} placeholder="for print — defaults to name" />
          </InlineRow>
        </div>
        <label className="flex items-start gap-2 mt-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!count} onChange={(e) => setCount(!e.target.checked)} style={{ width: 15, height: 15, accentColor: thread, marginTop: 2 }} />
          <span style={{ color: inkSoft, fontSize: 13, lineHeight: 1.4 }}>
            Has a size
            <span style={{ color: muted, display: "block", fontSize: 11.5 }}>
              On = amount is qty × size × rate (like Yards). Off = qty × rate only, size disabled (like Pcs).
            </span>
          </span>
        </label>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1" style={{ background: thread, color: ink }}>
            <Check size={16} /> {value ? "Save Changes" : "Add Unit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChartOfAccountsView({ customers, bankAccounts = [], vendors = [], units = [], invoices = [], purchases = [], onSaveUnits, onImportCustomers, onImportTally, onDeleteAccounts }) {
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [q, setQ] = useState("");
  const [headerFilter, setHeaderFilter] = useState("all"); // all | Customer | Bank | System
  const [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState([]); // selected account names
  const [sortField, setSortField] = useState("created"); // created | name | header
  const [sortDir, setSortDir] = useState("desc"); // newest first by default
  const importRef = useRef(null);
  const tallyImportRef = useRef(null);

  const allRows = [
    ...customers.map((c) => ({
      name: c.name, type: "Customer", address: c.address || "", phone: c.phone1 || "", phone2: c.phone2 || "",
      shipAddress: c.shipAddress || "", shipCity: c.shipCity || "", shipState: c.shipState || "", shipPin: c.shipPin || "",
      email: c.email || "", openingBalance: c.openingBalance || "", balanceType: c.openingBalanceType || "Dr",
      openingBalanceDate: c.openingBalanceDate || "", bankName: "", accountNumber: "", ifsc: "", notes: "",
      createdAt: c.createdAt || 0,
    })),
    ...vendors.map((v) => ({
      name: v.name, type: "Vendor", address: v.address || "", phone: v.phone1 || "", phone2: v.phone2 || "",
      email: v.email || "", openingBalance: v.openingBalance || "", balanceType: v.openingBalanceType || "Cr",
      openingBalanceDate: v.openingBalanceDate || "", bankName: "", accountNumber: "", ifsc: "", notes: "",
      createdAt: v.createdAt || 0,
    })),
    ...bankAccounts.map((b) => ({
      name: b.bankName, type: "Bank", address: "", phone: "", phone2: "", email: "",
      openingBalance: "", balanceType: "", openingBalanceDate: "",
      bankName: b.bankName, accountNumber: b.accountNumber || "", ifsc: b.ifsc || "", notes: b.notes || "", bank: true,
      createdAt: b.createdAt || 0,
    })),
    ...SYSTEM_ACCOUNTS.map((a) => ({ name: a.name, type: a.header, address: "", phone: "", phone2: "", email: "", openingBalance: "", balanceType: "", openingBalanceDate: "", bankName: "", accountNumber: "", ifsc: "", notes: "", system: true, createdAt: 0 })),
  ];
  const rows = allRows
    .filter((r) => {
      if (headerFilter === "Customer") return r.type === "Customer";
      if (headerFilter === "Bank") return !!r.bank;
      if (headerFilter === "System") return !!r.system;
      return true;
    })
    .filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => {
      let cmp;
      if (sortField === "created") cmp = (a.createdAt || 0) - (b.createdAt || 0);
      else if (sortField === "header") cmp = accountHeaderLabel(a.type).localeCompare(accountHeaderLabel(b.type));
      else cmp = a.name.localeCompare(b.name);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir(field === "created" ? "desc" : "asc"); }
  };

  const visibleNames = rows.map((r) => r.name);
  const allSelected = visibleNames.length > 0 && visibleNames.every((n) => selected.includes(n));
  const toggleSelect = (name) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  const toggleSelectAll = () => setSelected(allSelected ? [] : visibleNames);

  function exportCsv() {
    // Export only selected rows when any are ticked; otherwise all visible.
    const scope = selected.length ? rows.filter((r) => selected.includes(r.name)) : rows;
    const data = scope.map((r, i) => ({
      "Sr No.": i + 1,
      "Account Name": r.name,
      "Type": r.type,
      "Phone": r.phone,
      "Phone 2": r.phone2,
      "Phone 3": "",
      "Email": r.email,
      "Address": r.address,
      "Opening Balance": r.openingBalance,
      "Balance Type": r.balanceType ? r.balanceType.toUpperCase() : "",
      "Opening Balance Date": r.openingBalanceDate,
      "Created": r.createdAt ? fmtDateTime(r.createdAt) : "",
      "Bank Name": r.bankName,
      "Account Number": r.accountNumber,
      "IFSC": r.ifsc,
      "Notes": r.notes,
    }));
    if (!data.length) return;
    downloadCsv(data, `Chart_of_Accounts_${todayISO()}`);
  }

  // Export ledger masters as Tally Prime XML. Most system placeholder rows
  // are skipped since they're either Tally defaults (Cash) or duplicates of
  // what the top-level "Export Tally Masters" action already creates (Sales/
  // Purchase Accounts, Bank) — but Discount Allowed/Received, the return
  // ledgers, and Round Off are NOT Tally defaults, so those stay in.
  function exportTallyXml() {
    const NON_DEFAULT_SYSTEM_LEDGERS = ["Discount Allowed", "Discount Received", "Sales Return", "Purchase Return", "Round Off"];
    const ledgers = rows.filter((r) => !r.system || NON_DEFAULT_SYSTEM_LEDGERS.includes(r.name));
    if (!ledgers.length) return;
    const xml = buildTallyLedgersXml(ledgers);
    downloadTextFile(xml, `Chart_of_Accounts_Tally_${todayISO()}.xml`);
  }

  return (
    <div>
      {onSaveUnits && (
        <UnitsView units={units} invoices={invoices} purchases={purchases} onSave={onSaveUnits} />
      )}

      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 28, fontWeight: 600 }}>Chart of Accounts</h1>
          <p style={{ color: muted, fontSize: 13, marginTop: 2 }}>{rows.length} account{rows.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={importRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) onImportCustomers(e.target.files[0]); e.target.value = ""; }}
          />
          {onImportTally && (
            <input
              ref={tallyImportRef}
              type="file"
              accept=".xml,text/xml"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) onImportTally(e.target.files[0]); e.target.value = ""; }}
            />
          )}
          <button
            onClick={() => setPreview(true)}
            className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Preview / print (A4 landscape)"
          >
            <Eye size={14} /> Preview
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Import accounts from CSV"
          >
            <Upload size={14} /> CSV
          </button>
          {onImportTally && (
            <button
              onClick={() => tallyImportRef.current?.click()}
              className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs"
              style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
              title="Import party ledgers with opening balances from a Tally masters XML export"
            >
              <Upload size={14} /> Tally
            </button>
          )}
          <button
            onClick={exportCsv}
            className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title={selected.length ? "Export selected accounts to CSV" : "Export all accounts to CSV"}
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={exportTallyXml}
            className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs"
            style={{ background: ink, color: "#fff" }}
            title="Export ledger masters as Tally Prime XML"
          >
            <Download size={14} /> Tally XML
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 rounded-lg mb-3" style={{ background: ink }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
            {selected.length} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkConfirm ? (
              <>
                <button
                  onClick={() => { onDeleteAccounts(selected); setSelected([]); setBulkConfirm(false); }}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold"
                  style={{ background: danger, color: "#fff" }}
                >
                  Delete {selected.length}?
                </button>
                <button onClick={() => setBulkConfirm(false)} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "transparent", color: "#B9C2D6", border: "1px solid #4A5D8A" }}>Cancel</button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setBulkConfirm(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold"
                  style={{ background: "transparent", color: "#F3B0A0", border: "1px solid #6E4A44" }}
                >
                  <Trash2 size={13} /> Delete
                </button>
                <button
                  onClick={() => setSelected([])}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold"
                  style={{ background: "transparent", color: "#B9C2D6", border: "1px solid #4A5D8A" }}
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1" style={{ background: card, border: `1px solid ${hairline}` }}>
          <Search size={15} color={muted} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search account name..." className="flex-1 outline-none text-sm bg-transparent" style={{ color: ink }} />
        </div>
        <select value={headerFilter} onChange={(e) => setHeaderFilter(e.target.value)} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
          <option value="all">All Accounts</option>
          <option value="Customer">Sundry Debtors</option>
          <option value="Bank">Bank Accounts</option>
          <option value="System">System</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: card, border: `1px dashed ${hairline}` }}>
          <FileText size={28} color={muted} className="mx-auto mb-3" />
          <p style={{ color: ink, fontWeight: 600, fontSize: 15 }}>No accounts</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${hairline}` }}>
          <div className="overflow-x-auto">
            <div style={{ minWidth: 860 }}>
              <div className="grid items-center gap-3 px-3 py-2" style={{ gridTemplateColumns: "24px 36px minmax(150px,1.4fr) 92px minmax(120px,1fr) 110px 100px 110px", background: paper, borderBottom: `1px solid ${hairline}` }}>
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ width: 15, height: 15, accentColor: thread }} />
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>SR</span>
                <button onClick={() => toggleSort("name")} className="flex items-center gap-0.5" style={{ color: sortField === "name" ? ink : muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: "transparent", padding: 0 }}>
                  ACCOUNT NAME {sortField === "name" && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </button>
                <button onClick={() => toggleSort("header")} className="flex items-center gap-0.5" style={{ color: sortField === "header" ? ink : muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: "transparent", padding: 0 }}>
                  HEADER {sortField === "header" && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </button>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>ADDRESS</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>PHONE</span>
                <button onClick={() => toggleSort("created")} className="flex items-center gap-0.5" style={{ color: sortField === "created" ? ink : muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: "transparent", padding: 0 }}>
                  CREATED {sortField === "created" && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </button>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textAlign: "right" }}>OP. BALANCE</span>
              </div>
              {rows.map((r, idx) => {
                const ob = Number(r.openingBalance) || 0;
                const isSel = selected.includes(r.name);
                return (
                <div key={r.name + idx} className="grid items-center gap-3 px-3 py-2.5" style={{ gridTemplateColumns: "24px 36px minmax(150px,1.4fr) 92px minmax(120px,1fr) 110px 100px 110px", borderTop: idx > 0 ? `1px solid ${hairline}` : "none", background: isSel ? "#FBF4E7" : "transparent" }}>
                  <input type="checkbox" checked={isSel} onChange={() => toggleSelect(r.name)} style={{ width: 15, height: 15, accentColor: thread }} />
                  <span style={{ color: muted, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>{idx + 1}</span>
                  <span style={{ color: ink, fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  <span>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap" style={{ background: r.type === "Customer" ? "#EAF0FB" : paper, color: r.type === "Customer" ? inkSoft : muted, border: `1px solid ${hairline}` }}>
                      {accountHeaderLabel(r.type)}
                    </span>
                  </span>
                  <span style={{ color: muted, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.address || "—"}</span>
                  <span style={{ color: muted, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[r.phone, r.phone2].filter(Boolean).join(", ") || "—"}</span>
                  <span style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{r.createdAt ? fmtDateTime(r.createdAt) : "—"}</span>
                  <span style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, fontWeight: 600, color: ink, whiteSpace: "nowrap" }}>
                    {ob ? `${fmtMoney(ob)} ${(r.balanceType || "Dr").toUpperCase()}` : "—"}
                  </span>
                </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {preview && (() => {
        const prows = rows.map((r, i) => [
          i + 1, r.name, accountHeaderLabel(r.type), r.address || "—",
          [r.phone, r.phone2].filter(Boolean).join(", ") || "—",
          (Number(r.openingBalance) || 0) ? `${fmtMoney(r.openingBalance)} ${(r.balanceType || "Dr").toUpperCase()}` : "—",
        ]);
        const cols = [{ header: "SN", align: "center" }, { header: "Account Name" }, { header: "Header" }, { header: "Address", width: 160 }, { header: "Phone" }, { header: "Op. Balance", align: "right" }];
        return (
          <>
            <GenericReportPreview
              rows={prows}
              title="Chart of Accounts"
              subtitle={`${rows.length} account${rows.length !== 1 ? "s" : ""}`}
              columns={cols}
              onClose={() => setPreview(false)}
            />
            <GenericReportPrint
              rows={prows}
              title="Chart of Accounts"
              subtitle={`${rows.length} account${rows.length !== 1 ? "s" : ""}`}
              columns={cols}
            />
          </>
        );
      })()}
    </div>
  );
}

// ============ TRANSACTION REPORT ============
// ===================== VENDORS (Accounts Payable) =====================
function VendorsView({
  vendors, vendorOutstanding, selected, setSelected,
  onSave, onDelete, onImportCsv, onOpenDetail,
  onPreviewSummary, onPrintSummary, onPrintLedgers,
  dateFrom, dateTo, setDateFrom, setDateTo, quickRangeDates,
}) {
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null); // null | {} (new) | vendor (edit)
  const [pendingDelete, setPendingDelete] = useState(null);
  const [nonZeroOnly, setNonZeroOnly] = useState(false);
  const list = vendors
    .filter((v) => !q.trim() || v.name.toLowerCase().includes(q.toLowerCase()) || (v.phone1 || "").includes(q))
    .filter((v) => !nonZeroOnly || Math.round(vendorOutstanding(v.id)) !== 0)
    .slice()
    .sort((a, b) => vendorOutstanding(b.id) - vendorOutstanding(a.id));

  const visibleIds = list.map((v) => v.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleSelect = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSelectAll = () =>
    setSelected(allSelected ? [] : visibleIds);

  // Computed from `list`, so it follows the search box and non-zero filter.
  // Vendors are creditors: positive balance = Cr (payable) — the opposite
  // sense from customers.
  const summary = list.reduce((acc, v) => {
    const bal = Math.round(vendorOutstanding(v.id));
    if (bal > 0) { acc.crTotal += bal; acc.crCount += 1; }
    else if (bal < 0) { acc.drTotal += -bal; acc.drCount += 1; }
    else acc.zeroCount += 1;
    return acc;
  }, { drTotal: 0, drCount: 0, crTotal: 0, crCount: 0, zeroCount: 0 });

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 28, fontWeight: 600 }}>Vendors</h1>
          <p style={{ color: muted, fontSize: 13, marginTop: 2 }}>{vendors.length} vendor{vendors.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrintLedgers}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Print ledgers (selected or all)"
          >
            <FileText size={16} />
          </button>
          <button
            onClick={onPreviewSummary}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Preview summary balances"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={onPrintSummary}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Print summary balances"
          >
            <Printer size={16} />
          </button>
          <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm whitespace-nowrap" style={{ background: thread, color: ink }}>
            <UserPlus size={17} /> New Vendor
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg mb-3" style={{ background: ink }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
            {selected.length} selected — prints cover these only
          </span>
          <button
            onClick={() => setSelected([])}
            className="px-2.5 py-1 rounded-md text-xs font-semibold"
            style={{ background: "transparent", color: "#B9C2D6", border: "1px solid #4A5D8A" }}
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4" style={{ background: card, border: `1px solid ${hairline}` }}>
        <Search size={16} color={muted} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone…" className="flex-1 bg-transparent outline-none text-sm" style={{ color: ink }} />
      </div>

      <DateRangeBar from={dateFrom} to={dateTo} setFrom={setDateFrom} setTo={setDateTo} quickRangeDates={quickRangeDates} />

      <label className="flex items-center gap-2 mb-4 text-sm" style={{ color: muted }}>
        <input
          type="checkbox"
          checked={nonZeroOnly}
          onChange={(e) => setNonZeroOnly(e.target.checked)}
          style={{ width: 15, height: 15, accentColor: thread }}
        />
        Show only non-zero balances
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <BalanceCard label="Total Payable (Cr)" count={summary.crCount} amount={summary.crTotal} color={danger} />
        <BalanceCard label="Total Receivable (Dr)" count={summary.drCount} amount={summary.drTotal} color={success} />
        <BalanceCard label="Net" count={summary.drCount + summary.crCount} amount={summary.crTotal - summary.drTotal} color={ink} net vendorSense />
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: card, border: `1px dashed ${hairline}` }}>
          <Landmark size={28} color={muted} className="mx-auto mb-3" />
          <p style={{ color: ink, fontWeight: 600, fontSize: 15 }}>No vendors yet</p>
          <p style={{ color: muted, fontSize: 13, marginTop: 4 }}>Add a vendor to track what you owe.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${hairline}` }}>
          <div className="overflow-x-auto">
            <div style={{ minWidth: 470 }}>
              <div className="grid items-center gap-3 px-3 py-2" style={{ gridTemplateColumns: "24px 30px 160px 72px 120px 30px", background: paper, borderBottom: `1px solid ${hairline}` }}>
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ width: 15, height: 15, accentColor: thread }} />
                <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>SR</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>NAME</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>ADDRESS</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, textAlign: "right" }}>PAYABLE</span>
                <span></span>
              </div>
              {list.map((v, idx) => {
                const bal = vendorOutstanding(v.id);
                return (
                  <div
                    key={v.id}
                    className="grid items-center gap-3 px-3 py-2.5"
                    style={{ gridTemplateColumns: "24px 30px 160px 72px 120px 30px", borderTop: idx > 0 ? `1px solid ${hairline}` : "none", cursor: "pointer", background: selected.includes(v.id) ? "#FBF4E7" : "transparent" }}
                    onClick={() => onOpenDetail(v)}
                  >
                    <input type="checkbox" checked={selected.includes(v.id)} onChange={() => toggleSelect(v.id)} onClick={(e) => e.stopPropagation()} style={{ width: 15, height: 15, accentColor: thread }} />
                    <span style={{ color: muted, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>{idx + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <button onClick={(e) => { e.stopPropagation(); setModal(v); }} className="text-left" style={{ color: inkSoft, fontWeight: 600, fontSize: 13, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{v.name}</button>
                      {v.phone1 && <div style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>{v.phone1}</div>}
                    </div>
                    <span style={{ color: muted, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.address || "—"}</span>
                    <span style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: bal > 0 ? danger : ink, whiteSpace: "nowrap" }}>
                      {fmtMoney(Math.abs(bal))} {bal >= 0 ? "Cr" : "Dr"}
                    </span>
                    {pendingDelete === v.id ? (
                      <button onClick={(e) => { e.stopPropagation(); if (onDelete(v.id)) setPendingDelete(null); }} className="text-xs font-bold" style={{ color: danger }}>Sure?</button>
                    ) : (
                      <IconBtn onClick={(e) => { e.stopPropagation(); setPendingDelete(v.id); }} title="Delete" danger><Trash2 size={14} /></IconBtn>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {modal && <VendorModal value={modal} onClose={() => setModal(null)} onSave={(v) => { if (onSave(v)) setModal(null); }} />}
    </div>
  );
}

function VendorModal({ value, onClose, onSave }) {
  const [v, setV] = useState({ name: "", phone1: "", phone2: "", email: "", address: "", openingBalance: "", openingBalanceType: "Cr", openingBalanceDate: todayISO(), ...value });
  const set = (f) => (e) => setV((p) => ({ ...p, [f]: e.target.value }));
  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-md rounded-xl p-5" style={{ background: "#fff", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 20, fontWeight: 600 }}>{value.id ? "Edit Vendor" : "New Vendor"}</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
            <button onClick={() => onSave(v)} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: thread, color: ink }}>Save</button>
          </div>
        </div>
        <div className="space-y-2.5">
          <InlineRow label="Name"><input value={v.name} onChange={set("name")} className={inputCls} style={inputStyle} placeholder="Vendor name" /></InlineRow>
          <InlineRow label="Phone"><input value={v.phone1} onChange={set("phone1")} className={inputCls} style={inputStyle} /></InlineRow>
          <InlineRow label="Phone 2"><input value={v.phone2} onChange={set("phone2")} className={inputCls} style={inputStyle} /></InlineRow>
          <InlineRow label="Email"><input value={v.email} onChange={set("email")} className={inputCls} style={inputStyle} /></InlineRow>
          <InlineRow label="Address"><input value={v.address} onChange={set("address")} className={inputCls} style={inputStyle} /></InlineRow>
          <InlineRow label="Op. Balance"><input value={v.openingBalance} onChange={set("openingBalance")} className={inputCls} style={inputStyle} inputMode="decimal" placeholder="0" /></InlineRow>
          <InlineRow label="Type">
            <select value={v.openingBalanceType} onChange={set("openingBalanceType")} className={inputCls} style={inputStyle}>
              <option value="Cr">Cr (we owe them)</option>
              <option value="Dr">Dr (advance paid)</option>
            </select>
          </InlineRow>
          <InlineRow label="As On"><DateField value={v.openingBalanceDate} onChange={(d) => setV((p) => ({ ...p, openingBalanceDate: d }))} className={inputCls} style={inputStyle} /></InlineRow>
        </div>
      </div>
    </div>
  );
}

// ===================== PURCHASES (simple bills) =====================
function PurchasesView({ purchases, vendors, payments, bankAccounts = [], counters, setCounters, onAdd, onDelete, onBulkDelete, onImportCsv, quickRangeDates, onOpenDetail, onToggleStatus, onBulkAddPayments, fyWindow }) {
  const [from, setFrom] = useState(currentMonthDates().from);
  const [to, setTo] = useState(currentMonthDates().to);

  // Follow the global financial-year picker when it *changes* — but not on
  // first mount, so the current-month default above survives instead of
  // immediately being overwritten by whatever FY happens to be selected.
  const fyMountedRef = useRef(false);
  useEffect(() => {
    if (!fyWindow) return;
    if (!fyMountedRef.current) { fyMountedRef.current = true; return; }
    setFrom(fyWindow.from);
    setTo(fyWindow.to);
  }, [fyWindow]);

  const [modal, setModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [preview, setPreview] = useState(false);
  const [q, setQ] = useState("");
  const [bulkPaymentModal, setBulkPaymentModal] = useState(false);
  const importRef = useRef(null);
  const vendorById = useMemo(() => {
    const m = new Map();
    for (const v of vendors) m.set(v.id, v);
    return m;
  }, [vendors]);
  const vName = (id) => vendorById.get(id)?.name || "—";
  const list = purchases
    .filter((p) => (!from || p.date >= from) && (!to || p.date <= to))
    .filter((p) => {
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      return (
        (p.billNo || "").toLowerCase().includes(needle) ||
        vName(p.vendorId).toLowerCase().includes(needle)
      );
    })
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
  const total = list.reduce((s, p) => s + purchaseTotal(p), 0);
  const visibleIds = list.map((p) => p.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleSel = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const periodLabel = `${from ? fmtDate(from) : "Beginning"} to ${to ? fmtDate(to) : fmtDate(todayISO())}`;
  const PURCHASE_PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(list.length / PURCHASE_PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pagedList = list.slice(pageSafe * PURCHASE_PAGE_SIZE, (pageSafe + 1) * PURCHASE_PAGE_SIZE);

  function exportCsv() {
    const data = list.map((p, i) => ({
      "Sr No.": list.length - i,
      "Bill No.": p.billNo,
      "Date": fmtDate(p.date),
      "Vendor": vName(p.vendorId),
      "Amount": purchaseTotal(p),
      "Created": p.createdAt ? new Date(p.createdAt).toISOString() : "",
    }));
    if (!data.length) return;
    downloadCsv(data, `Purchase_Register_${todayISO()}`);
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 28, fontWeight: 600 }}>Purchases</h1>
          <p style={{ color: muted, fontSize: 13, marginTop: 2 }}>{list.length} bill{list.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={importRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) { onImportCsv(e.target.files[0]); e.target.value = ""; } }} />
          <button onClick={() => importRef.current?.click()} className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs" style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }} title="Import purchase bills from CSV">
            <Upload size={14} /> CSV
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs" style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }} title="Export purchase register to CSV">
            <Download size={14} /> Register
          </button>
          <button onClick={() => setPreview(true)} className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs" style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }} title="Preview / print (A4 landscape)">
            <Eye size={14} />
          </button>
          <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm whitespace-nowrap" style={{ background: thread, color: ink }}>
            <Plus size={17} /> New Purchase
          </button>
        </div>
      </div>

      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4"
        style={{ background: card, border: `1px solid ${hairline}` }}
      >
        <Search size={15} color={muted} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search vendor or bill no."
          className="flex-1 outline-none text-sm bg-transparent"
          style={{ color: ink }}
        />
      </div>

      <DateRangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} quickRangeDates={quickRangeDates} />

      <div className="rounded-xl p-4 mb-4" style={{ background: card, border: `1px solid ${hairline}` }}>
        <div className="flex items-center justify-between">
          <div>
            <div style={{ color: muted, fontSize: 12 }}>Total Purchases</div>
            <div style={{ color: ink, fontWeight: 700, fontSize: 22, fontFamily: "'Fraunces', serif" }}>{fmtMoney(total)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: muted, fontSize: 12 }}>Count</div>
            <div style={{ color: ink, fontWeight: 700, fontSize: 22 }}>{list.length}</div>
          </div>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg mb-3" style={{ background: ink }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{selected.length} selected</span>
          <div className="flex items-center gap-2">
            {bulkConfirm ? (
              <>
                <button onClick={() => { onBulkDelete(selected); setSelected([]); setBulkConfirm(false); }} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: danger, color: "#fff" }}>Delete {selected.length}?</button>
                <button onClick={() => setBulkConfirm(false)} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "transparent", color: "#B9C2D6", border: "1px solid #4A5D8A" }}>Cancel</button>
              </>
            ) : (
              <>
                {onBulkAddPayments && (
                  <button onClick={() => setBulkPaymentModal(true)} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: thread, color: ink }}><IndianRupee size={13} /> Add Payment</button>
                )}
                <button onClick={() => setBulkConfirm(true)} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "transparent", color: "#F3B0A0", border: "1px solid #6E4A44" }}><Trash2 size={13} /> Delete</button>
                <button onClick={() => setSelected([])} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "transparent", color: "#B9C2D6", border: "1px solid #4A5D8A" }}>Clear</button>
              </>
            )}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: card, border: `1px dashed ${hairline}` }}>
          <FileText size={28} color={muted} className="mx-auto mb-3" />
          <p style={{ color: ink, fontWeight: 600, fontSize: 15 }}>No purchases yet</p>
          <p style={{ color: muted, fontSize: 13, marginTop: 4 }}>Record a purchase bill to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${hairline}` }}>
          <div className="overflow-x-auto">
            <div style={{ minWidth: 380 }}>
              <div className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: "24px 62px minmax(120px,1fr) 92px 70px 30px", background: paper, borderBottom: `1px solid ${hairline}` }}>
                <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : visibleIds)} style={{ width: 15, height: 15, accentColor: thread }} />
                <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>DATE</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>VENDOR</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, textAlign: "left" }}>AMOUNT</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, textAlign: "center" }}>STATUS</span>
                <span></span>
              </div>
              {pagedList.map((p, idx) => (
                <div
                  key={p.id}
                  className="grid items-center gap-2 px-3 py-2.5"
                  style={{ gridTemplateColumns: "24px 62px minmax(120px,1fr) 92px 70px 30px", borderTop: idx > 0 ? `1px solid ${hairline}` : "none", background: selected.includes(p.id) ? "#FBF4E7" : "transparent", cursor: "pointer" }}
                  onClick={() => onOpenDetail(p)}
                >
                  <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSel(p.id)} onClick={(e) => e.stopPropagation()} style={{ width: 15, height: 15, accentColor: thread }} />
                  <span style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmtDateShort(p.date)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: ink, fontSize: 13, fontWeight: 600, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>
                      {vName(p.vendorId)}
                    </div>
                    <div style={{ color: muted, fontSize: 11, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                      <span
                        title={p.status || "Unpaid"}
                        style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: p.status === "Paid" ? success : danger }}
                      />
                      {p.billNo}
                    </div>
                  </div>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: ink, fontSize: 13, textAlign: "left", whiteSpace: "nowrap" }}>{fmtMoney(purchaseTotal(p))}</span>
                  <div style={{ textAlign: "center" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleStatus && onToggleStatus(p); }}
                      className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={{
                        background: p.status === "Paid" ? successBg : dangerBg,
                        color: p.status === "Paid" ? success : danger,
                        cursor: onToggleStatus ? "pointer" : "default",
                      }}
                    >
                      {p.status || "Unpaid"}
                    </button>
                  </div>
                  {pendingDelete === p.id ? (
                    <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); setPendingDelete(null); }} className="text-xs font-bold" style={{ color: danger }}>Sure?</button>
                  ) : (
                    <IconBtn onClick={(e) => { e.stopPropagation(); setPendingDelete(p.id); }} title="Delete" danger><Trash2 size={14} /></IconBtn>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {list.length > 0 && pageCount > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span style={{ color: muted, fontSize: 12.5 }}>
            {pageSafe * PURCHASE_PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * PURCHASE_PAGE_SIZE, list.length)} of {list.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={pageSafe === 0}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: pageSafe === 0 ? hairline : ink, cursor: pageSafe === 0 ? "not-allowed" : "pointer" }}
              title="Previous"
            >
              <ArrowLeft size={15} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={pageSafe >= pageCount - 1}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: pageSafe >= pageCount - 1 ? hairline : ink, cursor: pageSafe >= pageCount - 1 ? "not-allowed" : "pointer" }}
              title="Next"
            >
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {modal && (
        <PurchaseModal
          vendors={vendors}
          onClose={() => setModal(false)}
          onSave={(data) => {
            const next = (counters.PUR || 0) + 1;
            setCounters((c) => ({ ...c, PUR: next }));
            onAdd({ id: uid(), createdAt: Date.now(), billNo: data.billNo || `PUR-${String(next).padStart(3, "0")}`, vendorId: data.vendorId, date: data.date, items: data.items, amount: data.amount, notes: data.notes || "", status: "Unpaid" });
            setModal(false);
          }}
        />
      )}

      {preview && (() => {
        const prows = list.map((p, i) => [list.length - i, p.billNo, fmtDate(p.date), vName(p.vendorId), fmtNum(purchaseTotal(p))]);
        const cols = [{ header: "SN", align: "center" }, { header: "Bill No" }, { header: "Date" }, { header: "Vendor", width: 200 }, { header: "Amount", align: "right" }];
        const foot = ["", "", "", "Total", fmtNum(total)];
        return (
          <>
            <GenericReportPreview rows={prows} title="Purchase Register" subtitle={`${list.length} bill${list.length !== 1 ? "s" : ""} · ${periodLabel}`} columns={cols} footer={foot} onClose={() => setPreview(false)} />
            <GenericReportPrint rows={prows} title="Purchase Register" subtitle={`Period: ${periodLabel}`} columns={cols} footer={foot} />
          </>
        );
      })()}

      {bulkPaymentModal && onBulkAddPayments && (
        <BulkPurchasePaymentModal
          purchases={purchases.filter((p) => selected.includes(p.id))}
          vendors={vendors}
          bankAccounts={bankAccounts}
          payments={payments || []}
          onClose={() => setBulkPaymentModal(false)}
          onSave={(entries) => {
            onBulkAddPayments(entries);
            setBulkPaymentModal(false);
            setSelected([]);
          }}
        />
      )}
    </div>
  );
}

function PurchaseModal({ vendors, value, onClose, onSave }) {
  const [vendorId, setVendorId] = useState(value?.vendorId || "");
  const [billNo, setBillNo] = useState(value?.billNo || "");
  const [date, setDate] = useState(value?.date || todayISO());
  const [notes, setNotes] = useState(value?.notes || "");
  const [items, setItems] = useState(() => {
    if (Array.isArray(value?.items) && value.items.length) {
      return value.items.map((it) => ({ id: it.id || uid(), unit: it.unit || "Yards", qty: it.qty ?? "", size: it.size ?? "", rate: it.rate ?? "" }));
    }
    // Legacy single-line purchase (pre-multi-item): seed one row from its flat fields.
    if (value && (value.qty || value.rate || value.amount)) {
      return [{ id: uid(), unit: value.unit || "Yards", qty: value.qty || "", size: value.size || "", rate: value.rate || "" }];
    }
    return [{ id: uid(), unit: "Yards", qty: "", size: "", rate: "" }];
  });
  // Other expenses on a purchase bill (freight, cartage, etc.) — same shape
  // and % helper as the Sales invoice form.
  const [expenses, setExpenses] = useState(() =>
    (value?.expenses || []).map((e) => ({ id: e.id || uid(), label: e.label || "", pct: e.pct || "", amount: e.amount ?? "" }))
  );

  const updateItem = (id, field, v) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: v, ...(field === "unit" && isCountUnit(v) ? { size: "" } : {}) } : it)));
  const addItem = () => setItems((prev) => [...prev, { id: uid(), unit: "Yards", qty: "", size: "", rate: "" }]);
  const removeItem = (id) => setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));

  const updateExpense = (id, field, v) =>
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: v } : e)));
  const addExpense = () => setExpenses((prev) => [...prev, { id: uid(), label: "", pct: "", amount: "" }]);
  const removeExpense = (id) => setExpenses((prev) => prev.filter((e) => e.id !== id));

  const subtotal = items.reduce((s, it) => s + lineAmount(it), 0);
  const expenseTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const itemsTotal = subtotal + expenseTotal;
  const canSave = vendorId && itemsTotal > 0;

  // Percentage-entered expenses track the subtotal, so editing item lines
  // afterwards recalculates them instead of leaving a stale figure.
  useEffect(() => {
    for (const e of expenses) {
      if (!e.pct || String(e.pct).trim() === "") continue;
      const n = Number(e.pct);
      if (!Number.isFinite(n)) continue;
      const next = String(Math.round((n / 100) * subtotal));
      if (next !== String(e.amount)) updateExpense(e.id, "amount", next);
    }
  }, [subtotal, expenses]);

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-xl rounded-xl p-5" style={{ background: "#fff", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 20, fontWeight: 600 }}>{value ? "Edit Purchase" : "New Purchase"}</h3>
          <button onClick={onClose}><X size={20} color={muted} /></button>
        </div>
        <div className="space-y-2.5 mb-4">
          <InlineRow label="Vendor">
            <SearchableSelect value={vendorId} onChange={setVendorId} options={vendors.map((v) => ({ value: v.id, label: v.name, sub: [v.address, v.phone1].filter(Boolean).join(" · ") }))} placeholder="Search vendor…" inputStyle={inputStyle} className={inputCls} />
          </InlineRow>
          <InlineRow label="Bill No"><input value={billNo} onChange={(e) => setBillNo(e.target.value)} className={inputCls} style={inputStyle} placeholder="Auto if blank" /></InlineRow>
          <InlineRow label="Date"><DateField value={date} onChange={setDate} className={inputCls} style={inputStyle} /></InlineRow>
        </div>

        {/* Items — same layout as the Sales invoice items editor, so a
            purchase bill can carry multiple line items just like an invoice. */}
        <Section title="Items">
          <div className="item-grid px-1 pb-2 text-xs font-semibold" style={{ color: inkSoft, borderBottom: `1px solid ${hairline}` }}>
            <span>#</span><span>Type</span>
            <span>Qty</span><span>Size</span><span>Rate</span>
            <span className="item-amt-col" style={{ textAlign: "right" }}>Amount</span>
            <span></span>
          </div>
          {items.map((it, idx) => (
            <div key={it.id} className="item-grid px-1 py-2" style={{ borderBottom: `1px dashed ${hairline}` }}>
              <span style={{ color: muted, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>{idx + 1}</span>
              <InlineSelect
                value={it.unit}
                onChange={(unit) => updateItem(it.id, "unit", unit)}
                options={UNIT_OPTIONS}
                className="px-1.5 py-2 rounded-lg text-sm outline-none w-full"
                style={{ border: `1px solid ${hairline}`, color: ink, background: "#fff" }}
              />
              <input
                type="number" inputMode="decimal" data-kbdnav="true"
                value={it.qty}
                onChange={(e) => updateItem(it.id, "qty", e.target.value)}
                className="w-full px-1.5 py-2 rounded-lg text-sm outline-none"
                style={{ border: `1px solid ${hairline}`, color: ink, fontFamily: "'IBM Plex Mono', monospace", minWidth: 0 }}
              />
              <input
                type="number" inputMode="decimal" data-kbdnav="true"
                value={isCountUnit(it.unit) ? "" : it.size}
                onChange={(e) => updateItem(it.id, "size", e.target.value)}
                disabled={isCountUnit(it.unit)}
                placeholder={isCountUnit(it.unit) ? "—" : undefined}
                className="w-full px-1.5 py-2 rounded-lg text-sm outline-none"
                style={{
                  border: `1px solid ${hairline}`,
                  color: isCountUnit(it.unit) ? muted : ink,
                  fontFamily: "'IBM Plex Mono', monospace",
                  background: isCountUnit(it.unit) ? "#F1EEE6" : "#fff",
                  cursor: isCountUnit(it.unit) ? "not-allowed" : "text",
                  minWidth: 0,
                }}
              />
              <input
                type="number" inputMode="decimal" data-kbdnav="true"
                value={it.rate}
                onChange={(e) => updateItem(it.id, "rate", e.target.value)}
                className="w-full px-1.5 py-2 rounded-lg text-sm outline-none"
                style={{ border: `1px solid ${hairline}`, color: ink, fontFamily: "'IBM Plex Mono', monospace", minWidth: 0 }}
              />
              <span className="item-amt-col" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: ink, fontSize: 13, textAlign: "right" }}>
                {fmtMoney(lineAmount(it))}
              </span>
              <button onClick={() => removeItem(it.id)} style={{ color: danger }} title="Remove line" disabled={items.length === 1}>
                <Trash2 size={15} />
              </button>
              <span className="item-amt-inline" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: ink, fontSize: 12, paddingTop: 2 }}>
                = {fmtMoney(lineAmount(it))}
              </span>
            </div>
          ))}
          <button onClick={addItem} className="w-full mt-3 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" style={{ border: `1px dashed ${inkSoft}`, color: inkSoft }}>
            <Plus size={15} /> Add Item Line
          </button>
        </Section>

        <Section title="Other Expenses">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center gap-1.5 mb-2">
              <input
                value={e.label}
                onChange={(ev) => updateExpense(e.id, "label", ev.target.value)}
                placeholder="e.g. Freight"
                className="flex-1 min-w-0 px-2.5 py-2 rounded-lg text-sm outline-none"
                style={{ border: `1px solid ${hairline}`, color: ink }}
              />
              <div className="relative" style={{ width: 56, flexShrink: 0 }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={e.pct || ""}
                  onChange={(ev) => {
                    const raw = ev.target.value.replace(/%/g, "");
                    updateExpense(e.id, "pct", raw);
                    const n = Number(raw);
                    if (raw.trim() !== "" && Number.isFinite(n)) {
                      updateExpense(e.id, "amount", String(Math.round((n / 100) * subtotal)));
                    }
                  }}
                  placeholder="%"
                  className="w-full pl-2 pr-4 py-2 rounded-lg text-sm outline-none text-right"
                  style={{ border: `1px solid ${hairline}`, color: ink, fontFamily: "'IBM Plex Mono', monospace" }}
                />
                <span style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: muted, fontSize: 11, pointerEvents: "none" }}>%</span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={e.amount}
                onChange={(ev) => {
                  updateExpense(e.id, "pct", "");
                  updateExpense(e.id, "amount", ev.target.value);
                }}
                placeholder="0"
                className="px-2 py-2 rounded-lg text-sm outline-none text-right"
                style={{ width: 76, flexShrink: 0, border: `1px solid ${hairline}`, color: (Number(e.amount) || 0) < 0 ? danger : ink, fontFamily: "'IBM Plex Mono', monospace" }}
              />
              <button
                onClick={() => {
                  if (e.pct && String(e.pct).trim() !== "") {
                    const np = -(Number(e.pct) || 0);
                    updateExpense(e.id, "pct", String(np));
                    updateExpense(e.id, "amount", String(Math.round((np / 100) * subtotal)));
                  } else {
                    updateExpense(e.id, "amount", String(-(Number(e.amount) || 0)));
                  }
                }}
                title="Make negative / positive — for a deduction on the bill"
                style={{ color: inkSoft, flexShrink: 0, padding: "0 1px", fontSize: 15, fontWeight: 700, lineHeight: 1 }}
              >
                ±
              </button>
              <button onClick={() => removeExpense(e.id)} style={{ color: danger, flexShrink: 0, padding: "0 2px" }}><Trash2 size={16} /></button>
            </div>
          ))}
          <button onClick={addExpense} className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" style={{ border: `1px dashed ${hairline}`, color: muted }}>
            <Plus size={15} /> Add Other Expense
          </button>
        </Section>

        <div className="mt-4 mb-2 px-1">
          <div className="flex items-center justify-between mb-1">
            <span style={{ color: muted, fontSize: 13 }}>Subtotal</span>
            <span style={{ color: inkSoft, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span style={{ color: muted, fontSize: 13 }}>Expenses</span>
            <span style={{ color: inkSoft, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(expenseTotal)}</span>
          </div>
          <div className="flex items-center justify-between pt-1" style={{ borderTop: `1px solid ${hairline}` }}>
            <span style={{ color: muted, fontSize: 13, fontWeight: 600 }}>Total</span>
            <span style={{ color: ink, fontWeight: 700, fontSize: 16, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(itemsTotal)}</span>
          </div>
        </div>

        <div className="space-y-2.5">
          <InlineRow label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} style={inputStyle} /></InlineRow>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
          <button
            onClick={() => canSave && onSave({ vendorId, billNo, date, notes, items, expenses, amount: String(itemsTotal) })}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
            style={{ background: canSave ? thread : hairline, color: canSave ? ink : muted }}
          >
            <Check size={16} /> {value ? "Save Changes" : "Save Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== PURCHASE DETAIL =====================
function PurchaseDetailView({ purchase, vendors, payments = [], onBack, onUpdate, onDelete, onAddPayment, onEditPayment }) {
  const [editModal, setEditModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!purchase) {
    return (
      <div className="text-center py-16">
        <p style={{ color: muted, fontSize: 14 }}>Purchase not found.</p>
        <button onClick={onBack} className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: inkSoft }}>
          Back to list
        </button>
      </div>
    );
  }

  const vendor = vendors.find((v) => v.id === purchase.vendorId);
  // Legacy purchases (pre-multi-item) only have flat unit/qty/size/rate
  // fields, not an items[] array — normalize both shapes into one list so
  // the table below always has something consistent to render.
  const displayItems = Array.isArray(purchase.items) && purchase.items.length
    ? purchase.items
    : (purchase.qty || purchase.rate)
      ? [{ id: "legacy", unit: purchase.unit || "", qty: purchase.qty || "", size: purchase.size || "", rate: purchase.rate || "" }]
      : [];
  const total = purchaseTotal(purchase);
  const billExpenses = purchase.expenses || [];
  const billSubtotal = displayItems.reduce((s, it) => s + lineAmount(it), 0);
  // Payments linked to this bill — either directly (purchaseId) or as part
  // of a combined payment covering several bills for this vendor
  // (allocations). Each row shows only the share allocated to *this* bill,
  // not the full payment amount when it's a combined one. Payments recorded
  // purely "on account" (no link at all) aren't included, since there's no
  // way to know which bill they were meant to settle.
  const billPayments = (payments || [])
    .map((pay) => {
      if (pay.purchaseId === purchase.id) return { ...pay, allocatedAmount: Number(pay.amount) || 0, combined: false };
      if (Array.isArray(pay.allocations)) {
        const a = pay.allocations.find((x) => x.purchaseId === purchase.id);
        if (a) return { ...pay, allocatedAmount: Number(a.amount) || 0, combined: true };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const paidTotal = billPayments.reduce((s, pay) => s + pay.allocatedAmount, 0);
  const balanceDue = total - paidTotal;

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <button onClick={onBack} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium" style={{ color: inkSoft }}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <h1 style={{ fontFamily: "'IBM Plex Mono', monospace", color: ink, fontSize: 26, fontWeight: 700 }}>
          {purchase.billNo}
        </h1>
        <span
          className="px-2.5 py-1 rounded-md text-xs font-bold"
          style={{
            background: purchase.status === "Paid" ? successBg : dangerBg,
            color: purchase.status === "Paid" ? success : danger,
            letterSpacing: "0.04em",
          }}
        >
          {(purchase.status || "Unpaid").toUpperCase()}
        </span>
      </div>
      <p style={{ color: muted, fontSize: 14, marginBottom: 14 }}>
        {vendor?.name || "—"} · {fmtDate(purchase.date)}
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <button onClick={() => setEditModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
          <Edit2 size={15} /> Edit
        </button>
        {onAddPayment && (
          <button onClick={() => onAddPayment(purchase)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: thread, color: ink }}>
            <IndianRupee size={15} /> Add Payment
          </button>
        )}
        {confirmDelete ? (
          <>
            <button onClick={() => onDelete(purchase.id)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: danger, color: "#fff" }}>
              Delete for sure?
            </button>
            <button onClick={() => setConfirmDelete(false)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>
              Cancel
            </button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: danger }}>
            <Trash2 size={15} /> Delete
          </button>
        )}
      </div>

      {/* Vendor / bill details */}
      <Section title="Bill Details">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span style={{ color: muted }}>Vendor</span>
            <span style={{ color: ink }}>{vendor?.name || "—"}</span>
          </div>
          {(vendor?.phone1 || vendor?.phone2) && (
            <div className="flex justify-between gap-4">
              <span style={{ color: muted }}>Phone</span>
              <span style={{ textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>
                {[vendor.phone1, vendor.phone2].filter(Boolean).map((ph, i) => (
                  <a key={i} href={`tel:${String(ph).replace(/[^\d+]/g, "")}`} style={{ color: inkSoft, marginLeft: i ? 10 : 0 }}>{ph}</a>
                ))}
              </span>
            </div>
          )}
          {vendor?.address && (
            <div className="flex justify-between gap-4">
              <span style={{ color: muted }}>Address</span>
              <span style={{ color: ink, textAlign: "right" }}>{vendor.address}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span style={{ color: muted }}>Date</span>
            <span style={{ color: ink }}>{fmtDate(purchase.date)}</span>
          </div>
          {purchase.createdAt && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>Created</span>
              <span style={{ color: muted, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }}>
                {fmtDateTime(purchase.createdAt)}
              </span>
            </div>
          )}
          {purchase.notes && (
            <div className="flex justify-between gap-4">
              <span style={{ color: muted }}>Notes</span>
              <span style={{ color: ink, textAlign: "right" }}>{purchase.notes}</span>
            </div>
          )}
        </div>
      </Section>

      {/* Line items, mirroring the Sales invoice items table */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: card, border: `1px solid ${hairline}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
            <thead>
              <tr style={{ background: paper }}>
                <th style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: muted, textAlign: "left", borderBottom: `1px solid ${hairline}`, width: 34 }}>#</th>
                <th style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: muted, textAlign: "left", borderBottom: `1px solid ${hairline}` }}>TYPE</th>
                <th style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: muted, textAlign: "right", borderBottom: `1px solid ${hairline}` }}>QTY</th>
                <th style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: muted, textAlign: "right", borderBottom: `1px solid ${hairline}` }}>SIZE</th>
                <th style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: muted, textAlign: "right", borderBottom: `1px solid ${hairline}` }}>RATE</th>
                <th style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: muted, textAlign: "right", borderBottom: `1px solid ${hairline}` }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {displayItems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "16px 8px", fontSize: 13, color: muted, textAlign: "center", borderBottom: `1px solid ${hairline}` }}>No line items.</td>
                </tr>
              ) : (
                displayItems.map((it, i) => {
                  const isPcs = isCountUnit(it.unit);
                  const qty = Number(it.qty) || 0;
                  const rate = Number(it.rate) || 0;
                  const size = isPcs ? 1 : (Number(it.size) || 0);
                  const unitAbbr = UNIT_ABBR[it.unit] || it.unit || "";
                  const hasLineDetail = qty > 0 && rate > 0;
                  return (
                    <tr key={it.id || i}>
                      <td style={{ padding: "8px", fontSize: 12, color: muted, borderBottom: `1px solid ${hairline}`, fontFamily: "'IBM Plex Mono', monospace" }}>{i + 1}</td>
                      <td style={{ padding: "8px", fontSize: 13, color: ink, borderBottom: `1px solid ${hairline}` }}>{it.unit || "—"}</td>
                      <td style={{ padding: "8px", fontSize: 13, color: ink, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: `1px solid ${hairline}` }}>{hasLineDetail ? qty : "—"}</td>
                      <td style={{ padding: "8px", fontSize: 13, color: ink, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: `1px solid ${hairline}` }}>{hasLineDetail ? (isPcs ? "—" : `${size} ${unitAbbr}`) : "—"}</td>
                      <td style={{ padding: "8px", fontSize: 13, color: ink, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: `1px solid ${hairline}` }}>{hasLineDetail ? fmtNum(rate) : "—"}</td>
                      <td style={{ padding: "8px", fontSize: 13, color: ink, fontWeight: 600, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: `1px solid ${hairline}` }}>{fmtMoney(lineAmount(it))}</td>
                    </tr>
                  );
                })
              )}
              {billExpenses.length > 0 && (
                <>
                  <tr>
                    <td colSpan={5} style={{ padding: "6px 8px", fontSize: 12.5, textAlign: "right", color: muted }}>Subtotal</td>
                    <td style={{ padding: "6px 8px", fontSize: 12.5, textAlign: "right", color: inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(billSubtotal)}</td>
                  </tr>
                  {billExpenses.map((e, i) => (
                    <tr key={i}>
                      <td colSpan={5} style={{ padding: "6px 8px", fontSize: 12.5, textAlign: "right", color: muted }}>{e.label || "Other Expense"}</td>
                      <td style={{ padding: "6px 8px", fontSize: 12.5, textAlign: "right", color: inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(Number(e.amount) || 0)}</td>
                    </tr>
                  ))}
                </>
              )}
              <tr style={{ background: paper, fontWeight: 700 }}>
                <td colSpan={5} style={{ padding: "8px", fontSize: 13, textAlign: "right", color: ink }}>Total</td>
                <td style={{ padding: "8px", fontSize: 14, textAlign: "right", color: ink, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Section title="Payments Against This Bill">
        {billPayments.length === 0 ? (
          <div style={{ color: muted, fontSize: 13 }}>
            No payments linked to this bill yet.
          </div>
        ) : (
          <div>
            <div className="space-y-2">
              {billPayments.map((pay) => (
                <div
                  key={pay.id}
                  onClick={() => onEditPayment && onEditPayment(pay)}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                  style={{
                    background: paper,
                    border: `1px solid ${hairline}`,
                    cursor: onEditPayment ? "pointer" : "default",
                  }}
                  title={onEditPayment ? "Edit this payment" : undefined}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: inkSoft, fontWeight: 600, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>
                      {fmtDate(pay.date)}
                    </div>
                    <div style={{ color: muted, fontSize: 11 }}>
                      {paymentAccountLabel(pay)}{pay.paymentNo ? ` · ${pay.paymentNo}` : ""}{pay.combined ? " · part of a combined payment" : ""}
                    </div>
                  </div>
                  <span style={{ color: success, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>
                    {fmtMoney(pay.allocatedAmount)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${hairline}` }}>
              <div className="flex items-center justify-between" style={{ fontSize: 13 }}>
                <span style={{ color: muted }}>Paid</span>
                <span style={{ color: success, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(paidTotal)}</span>
              </div>
              <div className="flex items-center justify-between mt-1" style={{ fontSize: 13 }}>
                <span style={{ color: muted }}>Balance due</span>
                <span style={{ color: balanceDue > 0.5 ? danger : ink, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {fmtMoney(balanceDue)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Section>

      {editModal && (
        <PurchaseModal
          vendors={vendors}
          value={purchase}
          onClose={() => setEditModal(false)}
          onSave={(data) => {
            onUpdate({ ...purchase, ...data, billNo: data.billNo || purchase.billNo });
            setEditModal(false);
          }}
        />
      )}
    </div>
  );
}

// ===================== PAYMENTS (money out to vendors) =====================
function PaymentsView({ payments, vendors, purchases, bankAccounts, counters, setCounters, onAdd, onUpdate, onDelete, onBulkDelete, onImportCsv, quickRangeDates, fyWindow, vendorOutstanding }) {
  const [from, setFrom] = useState(currentMonthDates().from);
  const [to, setTo] = useState(currentMonthDates().to);

  // Follow the global financial-year picker when it *changes* — but not on
  // first mount, so the current-month default above survives instead of
  // immediately being overwritten by whatever FY happens to be selected.
  const fyMountedRef = useRef(false);
  useEffect(() => {
    if (!fyWindow) return;
    if (!fyMountedRef.current) { fyMountedRef.current = true; return; }
    setFrom(fyWindow.from);
    setTo(fyWindow.to);
  }, [fyWindow]);

  const [modal, setModal] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [preview, setPreview] = useState(false);
  const importRef = useRef(null);
  const vendorById = useMemo(() => {
    const m = new Map();
    for (const v of vendors) m.set(v.id, v);
    return m;
  }, [vendors]);
  const vName = (id) => vendorById.get(id)?.name || "—";
  const list = payments
    .filter((p) => (!from || p.date >= from) && (!to || p.date <= to))
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
  const total = list.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const byAccount = useMemo(() => {
    const map = new Map();
    for (const p of list) {
      const label = paymentAccountLabel(p);
      const e = map.get(label) || { label, count: 0, amount: 0 };
      e.count += 1;
      e.amount += Number(p.amount) || 0;
      map.set(label, e);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [list]);
  const visibleIds = list.map((p) => p.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleSel = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const periodLabel = `${from ? fmtDate(from) : "Beginning"} to ${to ? fmtDate(to) : fmtDate(todayISO())}`;
  const PAYMENT_PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(list.length / PAYMENT_PAGE_SIZE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pagedList = list.slice(pageSafe * PAYMENT_PAGE_SIZE, (pageSafe + 1) * PAYMENT_PAGE_SIZE);

  function exportCsv() {
    const data = list.map((p) => ({
      "Date": fmtDate(p.date),
      "Party Name": vName(p.vendorId),
      "Amount": Number(p.amount) || 0,
      "Mode": p.mode,
      "Bank Name": p.bankName || "",
      "Reference": p.reference || "",
      "Notes": p.notes || "",
      "Created": p.createdAt ? new Date(p.createdAt).toISOString() : "",
    }));
    if (!data.length) return;
    downloadCsv(data, `Payments_${todayISO()}`);
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 28, fontWeight: 600 }}>Payments</h1>
          <p style={{ color: muted, fontSize: 13, marginTop: 2 }}>{list.length} payment{list.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={importRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) { onImportCsv(e.target.files[0]); e.target.value = ""; } }} />
          <button onClick={() => importRef.current?.click()} className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs" style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }} title="Import payments from CSV">
            <Upload size={14} /> CSV
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs" style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }} title="Export payments to CSV">
            <Download size={14} /> Export
          </button>
          <button onClick={() => setPreview(true)} className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs" style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }} title="Preview / print (A4 landscape)">
            <Eye size={14} />
          </button>
          <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm whitespace-nowrap" style={{ background: thread, color: ink }}>
            <Plus size={17} /> New Payment
          </button>
        </div>
      </div>

      <DateRangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} quickRangeDates={quickRangeDates} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl p-4" style={{ background: card, border: `1px solid ${hairline}` }}>
          <div className="flex items-center justify-between">
            <div>
              <div style={{ color: muted, fontSize: 12 }}>Total Paid</div>
              <div style={{ color: ink, fontWeight: 700, fontSize: 22, fontFamily: "'Fraunces', serif" }}>{fmtMoney(total)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: muted, fontSize: 12 }}>Count</div>
              <div style={{ color: ink, fontWeight: 700, fontSize: 22 }}>{list.length}</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ background: card, border: `1px solid ${hairline}` }}>
          <div style={{ color: muted, fontSize: 12, marginBottom: 6 }}>Cash/Bank</div>
          {byAccount.length === 0 ? (
            <div style={{ color: muted, fontSize: 13 }}>No payments.</div>
          ) : (
            <div className="space-y-1">
              {byAccount.map((a) => (
                <div key={a.label} className="flex items-center justify-between">
                  <span style={{ color: inkSoft, fontSize: 13 }}>{a.label} <span style={{ color: muted, fontSize: 11.5 }}>({a.count})</span></span>
                  <span style={{ color: ink, fontWeight: 600, fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(a.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg mb-3" style={{ background: ink }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{selected.length} selected</span>
          <div className="flex items-center gap-2">
            {bulkConfirm ? (
              <>
                <button onClick={() => { onBulkDelete(selected); setSelected([]); setBulkConfirm(false); }} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: danger, color: "#fff" }}>Delete {selected.length}?</button>
                <button onClick={() => setBulkConfirm(false)} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "transparent", color: "#B9C2D6", border: "1px solid #4A5D8A" }}>Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => setBulkConfirm(true)} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "transparent", color: "#F3B0A0", border: "1px solid #6E4A44" }}><Trash2 size={13} /> Delete</button>
                <button onClick={() => setSelected([])} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "transparent", color: "#B9C2D6", border: "1px solid #4A5D8A" }}>Clear</button>
              </>
            )}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: card, border: `1px dashed ${hairline}` }}>
          <IndianRupee size={28} color={muted} className="mx-auto mb-3" />
          <p style={{ color: ink, fontWeight: 600, fontSize: 15 }}>No payments yet</p>
          <p style={{ color: muted, fontSize: 13, marginTop: 4 }}>Record a payment to a vendor.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${hairline}` }}>
          <div className="overflow-x-auto">
            <div style={{ minWidth: 470 }}>
              <div className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: "24px 62px minmax(0,1fr) 70px 96px 30px", background: paper, borderBottom: `1px solid ${hairline}` }}>
                <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : visibleIds)} style={{ width: 15, height: 15, accentColor: thread }} />
                <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>DATE</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>VENDOR</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>CASH/BANK</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, textAlign: "right" }}>AMOUNT</span>
                <span></span>
              </div>
              {pagedList.map((p, idx) => (
                <div
                  key={p.id}
                  className="grid items-center gap-2 px-3 py-2.5"
                  style={{ gridTemplateColumns: "24px 62px minmax(0,1fr) 70px 96px 30px", borderTop: idx > 0 ? `1px solid ${hairline}` : "none", background: selected.includes(p.id) ? "#FBF4E7" : "transparent", cursor: "pointer" }}
                  onClick={() => setModal(p)}
                >
                  <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSel(p.id)} onClick={(e) => e.stopPropagation()} style={{ width: 15, height: 15, accentColor: thread }} />
                  <span style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmtDateShort(p.date)}</span>
                  <span style={{ color: ink, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vName(p.vendorId)}</span>
                  <span style={{ color: muted, fontSize: 12 }}>{paymentAccountLabel(p)}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: ink, fontSize: 13, textAlign: "right", whiteSpace: "nowrap" }}>{fmtMoney(Number(p.amount) || 0)}</span>
                  {pendingDelete === p.id ? (
                    <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); setPendingDelete(null); }} className="text-xs font-bold" style={{ color: danger }}>Sure?</button>
                  ) : (
                    <IconBtn onClick={(e) => { e.stopPropagation(); setPendingDelete(p.id); }} title="Delete" danger><Trash2 size={14} /></IconBtn>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {list.length > 0 && pageCount > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span style={{ color: muted, fontSize: 12.5 }}>
            {pageSafe * PAYMENT_PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * PAYMENT_PAGE_SIZE, list.length)} of {list.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={pageSafe === 0}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: pageSafe === 0 ? hairline : ink, cursor: pageSafe === 0 ? "not-allowed" : "pointer" }}
              title="Previous"
            >
              <ArrowLeft size={15} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={pageSafe >= pageCount - 1}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: pageSafe >= pageCount - 1 ? hairline : ink, cursor: pageSafe >= pageCount - 1 ? "not-allowed" : "pointer" }}
              title="Next"
            >
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {modal && (
        <PaymentModal
          vendors={vendors}
          purchases={purchases}
          bankAccounts={bankAccounts}
          vendorOutstanding={vendorOutstanding}
          value={typeof modal === "object" ? modal : null}
          onClose={() => setModal(false)}
          onSave={(data) => {
            if (typeof modal === "object") {
              onUpdate({ ...modal, ...data, purchaseId: data.purchaseId || null });
            } else {
              const next = (counters.PAY || 0) + 1;
              setCounters((c) => ({ ...c, PAY: next }));
              onAdd({ id: uid(), createdAt: Date.now(), paymentNo: `PAY-${String(next).padStart(3, "0")}`, vendorId: data.vendorId, purchaseId: data.purchaseId || null, date: data.date, amount: data.amount, mode: data.mode, bankName: data.bankName || "", reference: data.reference || "", notes: data.notes || "" });
            }
            setModal(false);
          }}
        />
      )}

      {preview && (() => {
        const prows = list.map((p) => [fmtDate(p.date), vName(p.vendorId), paymentAccountLabel(p), p.reference || "—", fmtNum(Number(p.amount) || 0)]);
        const cols = [{ header: "Date" }, { header: "Vendor", width: 200 }, { header: "Cash/Bank" }, { header: "Reference" }, { header: "Amount", align: "right" }];
        const foot = ["", "", "", "Total", fmtNum(total)];
        const summaryLines = byAccount.map((a) => ({ label: `${a.label} (${a.count})`, value: fmtNum(a.amount) }));
        return (
          <>
            <GenericReportPreview rows={prows} title="Payments" subtitle={`${list.length} payment${list.length !== 1 ? "s" : ""} · ${periodLabel}`} columns={cols} footer={foot} summaryLines={summaryLines} onClose={() => setPreview(false)} />
            <GenericReportPrint rows={prows} title="Payments" subtitle={`Period: ${periodLabel}`} columns={cols} footer={foot} summaryLines={summaryLines} />
          </>
        );
      })()}
    </div>
  );
}

function PaymentModal({ vendors, purchases = [], bankAccounts, value, onClose, onSave, vendorOutstanding }) {
  const [f, setF] = useState(() => value
    ? {
        vendorId: value.vendorId || "", date: value.date || todayISO(), amount: value.amount || "",
        mode: value.mode || "Bank", bankName: value.bankName || bankAccounts[0]?.bankName || "",
        purchaseId: value.purchaseId || "", reference: value.reference || "", notes: value.notes || "",
      }
    : { vendorId: "", date: todayISO(), amount: "", mode: "Cash", bankName: bankAccounts[0]?.bankName || "", purchaseId: "", reference: "", notes: "" });
  const canSave = f.vendorId && (Number(f.amount) || 0) > 0;
  const vendorPurchases = f.vendorId
    ? purchases.filter((p) => p.vendorId === f.vendorId).sort((a, b) => (a.date < b.date ? 1 : -1))
    : [];
  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-md rounded-xl p-5" style={{ background: "#fff", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 20, fontWeight: 600 }}>{value ? "Edit Payment" : "New Payment"}</h3>
          <button onClick={onClose}><X size={20} color={muted} /></button>
        </div>
        <div className="space-y-2.5">
          <InlineRow label="Vendor">
            <SearchableSelect value={f.vendorId} onChange={(v) => setF((p) => ({ ...p, vendorId: v, purchaseId: "" }))} options={vendors.map((v) => ({ value: v.id, label: v.name, sub: [v.address, v.phone1].filter(Boolean).join(" · ") }))} placeholder="Search vendor…" inputStyle={inputStyle} className={inputCls} />
          </InlineRow>
          {/* Vendors are creditors, so a positive balance is Cr (payable). */}
          {f.vendorId && vendorOutstanding && (() => {
            const bal = vendorOutstanding(f.vendorId);
            return (
              <div className="flex justify-end" style={{ marginTop: 2, marginBottom: 4 }}>
                <span style={{ color: muted, fontSize: 11.5 }}>
                  Balance:{" "}
                  <b style={{ color: bal > 0 ? danger : bal < 0 ? success : ink, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {fmtMoney(Math.abs(bal))} {bal >= 0 ? "Cr" : "Dr"}
                  </b>
                </span>
              </div>
            );
          })()}
          <InlineRow label="Date"><DateField value={f.date} onChange={(d) => setF((p) => ({ ...p, date: d }))} className={inputCls} style={inputStyle} /></InlineRow>
          <InlineRow label="Amount"><input value={f.amount} onChange={(e) => setF((p) => ({ ...p, amount: e.target.value }))} className={inputCls} style={inputStyle} inputMode="decimal" placeholder="0" /></InlineRow>
          <InlineRow label="Mode">
            <InlineSelect
              value={f.mode}
              onChange={(v) => setF((p) => ({
                ...p,
                mode: v,
                // A bank name left over from a previous Bank/Cheque/UPI
                // selection would otherwise still show in the list even
                // after switching to Cash/Discount/Purchase Return — see
                // paymentAccountLabel.
                bankName: (v === "Bank" || v === "Cheque") ? p.bankName : "",
              }))}
              options={PAYMENT_MODES}
              className={inputCls}
              style={inputStyle}
            />
          </InlineRow>
          {f.mode !== "Cash" && f.mode !== "Discount" && f.mode !== "Purchase Return" && bankAccounts.length > 0 && (
            <InlineRow label="Bank A/c">
              <InlineSelect
                value={f.bankName}
                onChange={(v) => setF((p) => ({ ...p, bankName: v }))}
                options={bankAccounts.map((b) => ({ value: b.bankName, label: `${b.bankName}${b.accountNumber ? ` (${b.accountNumber})` : ""}` }))}
                className={inputCls}
                style={inputStyle}
              />
            </InlineRow>
          )}
          <InlineRow label="Purchase Bill">
            {value?.allocations && value.allocations.length > 0 ? (
              <div className={inputCls} style={{ ...inputStyle, cursor: "default" }}>
                {value.allocations.map((a, i) => {
                  const bill = purchases.find((p) => p.id === a.purchaseId);
                  return (
                    <div key={i} className="flex items-center justify-between" style={{ fontSize: 13, color: ink, padding: i > 0 ? "3px 0 0" : 0 }}>
                      <span>{bill?.billNo || "Bill not found"}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: muted }}>{fmtMoney(a.amount)}</span>
                    </div>
                  );
                })}
                <div style={{ fontSize: 11, color: muted, marginTop: 3 }}>
                  Combined payment — covers {value.allocations.length} bills
                </div>
              </div>
            ) : (
              <InlineSelect
                value={f.purchaseId}
                onChange={(v) => setF((p) => ({ ...p, purchaseId: v }))}
                options={[{ value: "", label: "On account (none)" }, ...vendorPurchases.map((p) => ({ value: p.id, label: `${p.billNo} — ${fmtMoney(purchaseTotal(p))} (${p.status || "Unpaid"})` }))]}
                disabled={!f.vendorId}
                className={inputCls}
                style={{ ...inputStyle, background: f.vendorId ? "#fff" : "#F1EEE6", cursor: f.vendorId ? "pointer" : "not-allowed" }}
              />
            )}
          </InlineRow>
          <InlineRow label="Reference"><input value={f.reference} onChange={(e) => setF((p) => ({ ...p, reference: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Cheque / ref no." /></InlineRow>
          <InlineRow label="Notes"><input value={f.notes} onChange={(e) => setF((p) => ({ ...p, notes: e.target.value }))} className={inputCls} style={inputStyle} /></InlineRow>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
          <button onClick={() => canSave && onSave(f)} disabled={!canSave} className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1" style={{ background: canSave ? thread : hairline, color: canSave ? ink : muted }}><Check size={16} /> {value ? "Save Changes" : "Save Payment"}</button>
        </div>
      </div>
    </div>
  );
}

// Records a payment against each of several selected purchase bills in one
// go — used from the Purchases tab's bulk-selection toolbar. Each bill gets
// its own row with an editable amount (defaulting to what's still
// outstanding on it), while Date/Mode/Bank/Reference/Notes are shared across
// the whole batch. Rows can be individually excluded (amount cleared to 0)
// without leaving the modal.
function BulkPurchasePaymentModal({ purchases, vendors, payments, bankAccounts = [], onClose, onSave }) {
  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);
  const rows = useMemo(() => purchases.map((p) => {
    const alreadyPaid = payments
      .filter((pay) => pay.purchaseId === p.id)
      .reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
    const outstanding = Math.max(0, purchaseTotal(p) - alreadyPaid);
    return { purchase: p, outstanding };
  }), [purchases, payments]);

  const [amounts, setAmounts] = useState(() => {
    const m = {};
    for (const r of rows) m[r.purchase.id] = r.outstanding > 0.5 ? String(Math.round(r.outstanding)) : "";
    return m;
  });
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState("Cash");
  const [bankName, setBankName] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const total = rows.reduce((s, r) => s + (Number(amounts[r.purchase.id]) || 0), 0);
  const includedCount = rows.filter((r) => (Number(amounts[r.purchase.id]) || 0) > 0).length;
  const canSave = includedCount > 0 && date;

  function setAmount(id, v) {
    setAmounts((prev) => ({ ...prev, [id]: v }));
  }

  function handleSave() {
    // Group by vendor: a party with just one bill selected still gets a
    // directly-linked entry (so that bill's status updates as before), but
    // multiple bills for the *same* vendor combine into one payment for the
    // total — matching how a single bank transaction covering several bills
    // is normally booked. The exact per-bill breakdown is kept as
    // `allocations` so each bill's Paid/Unpaid status can still be derived
    // correctly from this one combined entry.
    const byVendor = new Map(); // vendorId -> { amount, allocations: [{purchaseId, amount}] }
    for (const r of rows) {
      const amt = Number(amounts[r.purchase.id]) || 0;
      if (amt <= 0) continue;
      const e = byVendor.get(r.purchase.vendorId) || { amount: 0, allocations: [] };
      e.amount += amt;
      e.allocations.push({ purchaseId: r.purchase.id, amount: amt });
      byVendor.set(r.purchase.vendorId, e);
    }
    const entries = [...byVendor.entries()].map(([vendorId, e]) => ({
      purchaseId: e.allocations.length === 1 ? e.allocations[0].purchaseId : null,
      allocations: e.allocations.length > 1 ? e.allocations : null,
      vendorId,
      amount: String(e.amount),
      date,
      mode,
      bankName: mode === "Cash" || mode === "Discount" || mode === "Purchase Return" ? "" : bankName,
      reference,
      notes,
    }));
    onSave(entries);
  }

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-lg rounded-xl p-5" style={{ background: "#fff", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 20, fontWeight: 600 }}>Add Payment — {rows.length} bill{rows.length !== 1 ? "s" : ""}</h3>
            <p style={{ color: muted, fontSize: 12.5, marginTop: 2 }}>Each bill gets its own payment entry, linked individually.</p>
          </div>
          <button onClick={onClose}><X size={20} color={muted} /></button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          <div className="space-y-2.5 mb-4">
            <InlineRow label="Date"><DateField value={date} onChange={setDate} className={inputCls} style={inputStyle} /></InlineRow>
            <InlineRow label="Mode">
              <InlineSelect value={mode} onChange={setMode} options={PAYMENT_MODES} className={inputCls} style={inputStyle} />
            </InlineRow>
            {mode !== "Cash" && mode !== "Discount" && mode !== "Purchase Return" && (
              <InlineRow label="Bank A/c">
                {bankAccounts.length ? (
                  <InlineSelect
                    value={bankName}
                    onChange={setBankName}
                    options={bankAccounts.map((b) => ({ value: b.bankName, label: `${b.bankName}${b.accountNumber ? ` (${b.accountNumber})` : ""}` }))}
                    placeholder="Select bank account"
                    className={inputCls}
                    style={inputStyle}
                  />
                ) : (
                  // No accounts set up yet — fall back to free text rather
                  // than an empty dropdown that can't be used.
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputCls} style={inputStyle} placeholder="e.g. HDFC 4321" />
                )}
              </InlineRow>
            )}
            <InlineRow label="Reference"><input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} style={inputStyle} placeholder="Cheque / ref no." /></InlineRow>
            <InlineRow label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} style={inputStyle} /></InlineRow>
          </div>

          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${hairline}` }}>
            <div className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: "minmax(0,1fr) 100px", background: paper, borderBottom: `1px solid ${hairline}` }}>
              <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>BILL</span>
              <span style={{ color: muted, fontSize: 11, fontWeight: 700, textAlign: "right" }}>AMOUNT</span>
            </div>
            {rows.map((r, idx) => (
              <div key={r.purchase.id} className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: "minmax(0,1fr) 100px", borderTop: idx > 0 ? `1px solid ${hairline}` : "none" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: ink, fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {vendorById.get(r.purchase.vendorId)?.name || "—"}
                  </div>
                  <div style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {r.purchase.billNo} · outstanding {fmtMoney(r.outstanding)}
                  </div>
                </div>
                <input
                  value={amounts[r.purchase.id] || ""}
                  onChange={(e) => setAmount(r.purchase.id, e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="px-2 py-1.5 rounded-lg text-sm outline-none text-right"
                  style={{ border: `1px solid ${hairline}`, color: ink, fontFamily: "'IBM Plex Mono', monospace" }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${hairline}` }}>
          <div className="flex items-center justify-between mb-3" style={{ fontSize: 13 }}>
            <span style={{ color: muted }}>{includedCount} bill{includedCount !== 1 ? "s" : ""} · Total</span>
            <span style={{ color: ink, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", fontSize: 15 }}>{fmtMoney(total)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
            <button onClick={handleSave} disabled={!canSave} className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1" style={{ background: canSave ? thread : hairline, color: canSave ? ink : muted }}>
              <Check size={16} /> Save {includedCount || ""} Payment{includedCount !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// Records a receipt against each of several selected invoices in one go —
// used from the Sales tab's bulk-selection toolbar. Mirrors
// BulkPurchasePaymentModal exactly, just customer/invoice-flavoured.
function BulkInvoiceReceiptModal({ invoices, customers, receipts, invoiceTotal, bankAccounts = [], onClose, onSave }) {
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const rows = useMemo(() => invoices.map((inv) => {
    const alreadyReceived = receipts
      .filter((r) => r.invoiceId === inv.id)
      .reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const outstanding = Math.max(0, invoiceTotal(inv) - alreadyReceived);
    return { invoice: inv, outstanding };
  }), [invoices, receipts, invoiceTotal]);

  const [amounts, setAmounts] = useState(() => {
    const m = {};
    for (const r of rows) m[r.invoice.id] = r.outstanding > 0.5 ? String(Math.round(r.outstanding)) : "";
    return m;
  });
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState("Cash");
  const [bankName, setBankName] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const total = rows.reduce((s, r) => s + (Number(amounts[r.invoice.id]) || 0), 0);
  const includedCount = rows.filter((r) => (Number(amounts[r.invoice.id]) || 0) > 0).length;
  const canSave = includedCount > 0 && date;

  function setAmount(id, v) {
    setAmounts((prev) => ({ ...prev, [id]: v }));
  }

  function handleSave() {
    // Group by customer: a party with just one invoice selected still gets
    // a directly-linked entry (so that invoice's status updates as before),
    // but multiple invoices for the *same* customer combine into one
    // receipt for the total — matching how a single payment covering
    // several invoices is normally booked. The exact per-invoice breakdown
    // is kept as `allocations` so each invoice's Paid/Unpaid status can
    // still be derived correctly from this one combined entry.
    const byCustomer = new Map(); // customerId -> { amount, allocations: [{invoiceId, amount}] }
    for (const r of rows) {
      const amt = Number(amounts[r.invoice.id]) || 0;
      if (amt <= 0) continue;
      const e = byCustomer.get(r.invoice.customerId) || { amount: 0, allocations: [] };
      e.amount += amt;
      e.allocations.push({ invoiceId: r.invoice.id, amount: amt });
      byCustomer.set(r.invoice.customerId, e);
    }
    const entries = [...byCustomer.entries()].map(([customerId, e]) => ({
      invoiceId: e.allocations.length === 1 ? e.allocations[0].invoiceId : null,
      allocations: e.allocations.length > 1 ? e.allocations : null,
      customerId,
      amount: String(e.amount),
      date,
      mode,
      bankName: mode === "Cash" || mode === "Discount" || mode === "Sale Return" ? "" : bankName,
      reference,
      notes,
    }));
    onSave(entries);
  }

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-lg rounded-xl p-5" style={{ background: "#fff", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 20, fontWeight: 600 }}>Add Receipt — {rows.length} invoice{rows.length !== 1 ? "s" : ""}</h3>
            <p style={{ color: muted, fontSize: 12.5, marginTop: 2 }}>Each invoice gets its own receipt entry, linked individually.</p>
          </div>
          <button onClick={onClose}><X size={20} color={muted} /></button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          <div className="space-y-2.5 mb-4">
            <InlineRow label="Date"><DateField value={date} onChange={setDate} className={inputCls} style={inputStyle} /></InlineRow>
            <InlineRow label="Mode">
              <InlineSelect value={mode} onChange={setMode} options={RECEIPT_MODES} className={inputCls} style={inputStyle} />
            </InlineRow>
            {mode !== "Cash" && mode !== "Discount" && mode !== "Sale Return" && (
              <InlineRow label="Bank A/c">
                {bankAccounts.length ? (
                  <InlineSelect
                    value={bankName}
                    onChange={setBankName}
                    options={bankAccounts.map((b) => ({ value: b.bankName, label: `${b.bankName}${b.accountNumber ? ` (${b.accountNumber})` : ""}` }))}
                    placeholder="Select bank account"
                    className={inputCls}
                    style={inputStyle}
                  />
                ) : (
                  // No accounts set up yet — fall back to free text rather
                  // than an empty dropdown that can't be used.
                  <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputCls} style={inputStyle} placeholder="e.g. HDFC 4321" />
                )}
              </InlineRow>
            )}
            <InlineRow label="Reference"><input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} style={inputStyle} placeholder="Cheque / ref no." /></InlineRow>
            <InlineRow label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} style={inputStyle} /></InlineRow>
          </div>

          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${hairline}` }}>
            <div className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: "minmax(0,1fr) 100px", background: paper, borderBottom: `1px solid ${hairline}` }}>
              <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>INVOICE</span>
              <span style={{ color: muted, fontSize: 11, fontWeight: 700, textAlign: "right" }}>AMOUNT</span>
            </div>
            {rows.map((r, idx) => (
              <div key={r.invoice.id} className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: "minmax(0,1fr) 100px", borderTop: idx > 0 ? `1px solid ${hairline}` : "none" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: ink, fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {customerById.get(r.invoice.customerId)?.name || "—"}
                  </div>
                  <div style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {r.invoice.invoiceNo} · outstanding {fmtMoney(r.outstanding)}
                  </div>
                </div>
                <input
                  value={amounts[r.invoice.id] || ""}
                  onChange={(e) => setAmount(r.invoice.id, e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className="px-2 py-1.5 rounded-lg text-sm outline-none text-right"
                  style={{ border: `1px solid ${hairline}`, color: ink, fontFamily: "'IBM Plex Mono', monospace" }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${hairline}` }}>
          <div className="flex items-center justify-between mb-3" style={{ fontSize: 13 }}>
            <span style={{ color: muted }}>{includedCount} invoice{includedCount !== 1 ? "s" : ""} · Total</span>
            <span style={{ color: ink, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", fontSize: 15 }}>{fmtMoney(total)}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
            <button onClick={handleSave} disabled={!canSave} className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1" style={{ background: canSave ? thread : hairline, color: canSave ? ink : muted }}>
              <Check size={16} /> Save {includedCount || ""} Receipt{includedCount !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function CompanyModal({ companies, activeId, onSwitch, onCreate, onRename, onDelete, onClose, onCarryForward }) {
  const [adding, setAdding] = useState(false);
  const [carryOpen, setCarryOpen] = useState(false);
  const [carryName, setCarryName] = useState("");
  const [carryDate, setCarryDate] = useState(() => currentFYDates().to);
  const [carryErr, setCarryErr] = useState("");
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 70 }}>
      <div className="w-full max-w-md rounded-xl p-5" style={{ background: "#fff", maxHeight: "88vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-1">
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 20, fontWeight: 600 }}>Companies</h3>
          <button onClick={onClose}><X size={20} color={muted} /></button>
        </div>
        <p style={{ color: muted, fontSize: 12.5, lineHeight: 1.5, marginBottom: 14 }}>
          Each company keeps its own customers, vendors, invoices and ledgers. Switching changes every tab.
        </p>

        <div className="rounded-lg overflow-hidden mb-3" style={{ border: `1px solid ${hairline}` }}>
          {companies.map((c, idx) => {
            const isActive = c.id === activeId;
            return (
              <div key={c.id} className="px-3 py-2.5" style={{ borderTop: idx > 0 ? `1px solid ${hairline}` : "none", background: isActive ? "#FBF4E7" : "#fff" }}>
                {renamingId === c.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      className={inputCls}
                      style={inputStyle}
                      autoFocus
                    />
                    <button
                      onClick={async () => { if (await onRename(c.id, renameText)) setRenamingId(null); }}
                      className="px-2.5 py-1.5 rounded-md text-xs font-semibold"
                      style={{ background: thread, color: ink }}
                    >Save</button>
                    <button onClick={() => setRenamingId(null)} className="px-2 py-1.5 rounded-md text-xs font-semibold" style={{ color: muted }}>Cancel</button>
                  </div>
                ) : confirmDelete === c.id ? (
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ color: danger, fontSize: 12.5, fontWeight: 600, minWidth: 0 }}>
                      Delete “{c.name}” and all its data?
                    </span>
                    <div className="flex items-center gap-1.5" style={{ flexShrink: 0 }}>
                      <button
                        onClick={async () => { await onDelete(c.id); setConfirmDelete(null); }}
                        className="px-2.5 py-1.5 rounded-md text-xs font-bold"
                        style={{ background: danger, color: "#fff" }}
                      >Delete</button>
                      <button onClick={() => setConfirmDelete(null)} className="px-2 py-1.5 rounded-md text-xs font-semibold" style={{ color: muted }}>No</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => !isActive && onSwitch(c.id)}
                      className="text-left flex-1"
                      style={{ minWidth: 0, cursor: isActive ? "default" : "pointer" }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span style={{ color: ink, fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: thread, color: ink, fontSize: 10 }}>ACTIVE</span>
                        )}
                      </div>
                      {!isActive && <span style={{ color: muted, fontSize: 11 }}>Tap to switch</span>}
                    </button>
                    <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                      <IconBtn onClick={() => { setRenamingId(c.id); setRenameText(c.name); }} title="Rename"><Edit2 size={14} /></IconBtn>
                      {companies.length > 1 && (
                        <IconBtn onClick={() => setConfirmDelete(c.id)} title="Delete" danger><Trash2 size={14} /></IconBtn>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {adding ? (
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Company name"
              className={inputCls}
              style={inputStyle}
              autoFocus
            />
            <button
              onClick={async () => { if (await onCreate(newName)) { setNewName(""); setAdding(false); } }}
              className="px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
              style={{ background: thread, color: ink }}
            >Create</button>
            <button onClick={() => { setAdding(false); setNewName(""); }} className="px-2 py-2 rounded-lg text-sm font-semibold" style={{ color: muted }}>Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: card, border: `1px dashed ${hairline}`, color: inkSoft }}
          >
            <Plus size={16} /> New Company
          </button>
        )}

        {/* Year-end carry-forward — starts a fresh book with balances brought
            over, leaving this company's history untouched. */}
        {onCarryForward && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${hairline}` }}>
            {carryOpen ? (
              <>
                <div style={{ color: inkSoft, fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Start New Year</div>
                <p style={{ color: muted, fontSize: 11.5, lineHeight: 1.5, marginBottom: 10 }}>
                  Creates a new company with your customers, vendors, banks and units carried over — each party's closing balance as on the date below becomes their opening balance. Invoices, receipts, purchases and payments are <b>not</b> copied; they stay in <b>{companies.find((c) => c.id === activeId)?.name || "this company"}</b>, which remains fully readable.
                </p>
                <div className="space-y-2.5 mb-3">
                  <InlineRow label="New name">
                    <input value={carryName} onChange={(e) => setCarryName(e.target.value)} placeholder="e.g. My Company FY 2027-28" className={inputCls} style={inputStyle} autoFocus />
                  </InlineRow>
                  <InlineRow label="Balances as on">
                    <DateField value={carryDate} onChange={setCarryDate} className={inputCls} style={inputStyle} />
                  </InlineRow>
                </div>
                {carryErr && <div style={{ background: dangerBg, color: danger, fontSize: 12, padding: "7px 9px", borderRadius: 8, marginBottom: 10 }}>{carryErr}</div>}
                <div className="flex gap-2">
                  <button onClick={() => { setCarryOpen(false); setCarryErr(""); }} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
                  <button
                    onClick={async () => {
                      if (!carryName.trim()) { setCarryErr("Enter a name for the new company."); return; }
                      if (!carryDate) { setCarryErr("Pick the cut-off date."); return; }
                      setCarryErr("");
                      await onCarryForward(carryName, carryDate);
                    }}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
                    style={{ background: thread, color: ink }}
                  >
                    <Check size={16} /> Create &amp; Switch
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setCarryOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm"
                style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
              >
                <ArrowRight size={16} /> Start New Year (carry balances forward)
              </button>
            )}
          </div>
        )}

        <p style={{ color: muted, fontSize: 11, lineHeight: 1.5, marginTop: 12 }}>
          Deleting a company permanently removes its books. Export a backup from the Backup tab first if you might need it.
        </p>
      </div>
    </div>
  );
}

// Upload-only cloud backup to Firestore. Deliberately one-way: it copies the
// active company up to the cloud and never writes back to local data, so
// there's no chance of a sync overwriting work on this device. See
// SYNC-SETUP.md for the one-time Firebase setup this needs.
function CloudSyncCard({ companyId, companyName, buildBook, onRestoreRequested, Card }) {
  const [configured, setConfigured] = useState(null); // null = still checking
  const [fbUser, setFbUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [lastSync, setLastSync] = useState(() => {
    try { return localStorage.getItem(`textile-bill-lastsync-${companyId}`) || ""; } catch { return ""; }
  });

  useEffect(() => {
    let unsub;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("./firebase.js");
        if (cancelled) return;
        if (!mod.isFirebaseConfigured()) { setConfigured(false); return; }
        setConfigured(true);
        unsub = await mod.watchFirebaseUser((u) => { if (!cancelled) setFbUser(u); });
      } catch (e) {
        if (!cancelled) { setConfigured(false); }
      }
    })();
    return () => { cancelled = true; if (typeof unsub === "function") unsub(); };
  }, []);

  async function handleSignIn(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const mod = await import("./firebase.js");
      await mod.firebaseSignIn(email.trim(), password);
      setPassword("");
    } catch (err) {
      const code = err?.code || "";
      setError(
        code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found"
          ? "Incorrect email or password."
          : code === "auth/invalid-email" ? "That doesn't look like a valid email address."
          : code === "auth/too-many-requests" ? "Too many attempts — try again shortly."
          : err?.message || "Couldn't sign in."
      );
    } finally { setBusy(false); }
  }

  async function handleSignOut() {
    try { const mod = await import("./firebase.js"); await mod.firebaseSignOut(); } catch {}
    setStatus(""); setError("");
  }

  async function handleSync() {
    if (busy) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const mod = await import("./firebase.js");
      const { bytes } = await mod.pushCompanyToFirestore({
        companyId,
        companyName,
        book: buildBook(),
      });
      const when = new Date().toISOString();
      try { localStorage.setItem(`textile-bill-lastsync-${companyId}`, when); } catch {}
      setLastSync(when);
      setStatus(`Uploaded ${(bytes / 1024).toFixed(0)} KB to the cloud.`);
    } catch (err) {
      const code = err?.code || "";
      setError(
        code === "permission-denied"
          ? "Firestore rejected the write — check the security rules in SYNC-SETUP.md are published."
          : err?.message || "Sync failed."
      );
    } finally { setBusy(false); }
  }

  async function handleRestore() {
    if (busy) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const mod = await import("./firebase.js");
      const result = await mod.pullCompanyFromFirestore({ companyId });
      onRestoreRequested(result); // hands off to the App-level confirm modal — this card never applies it directly
    } catch (err) {
      const code = err?.code || "";
      setError(
        code === "permission-denied"
          ? "Firestore rejected the read — check the security rules in SYNC-SETUP.md are published."
          : err?.message || "Couldn't fetch the cloud copy."
      );
    } finally { setBusy(false); }
  }

  if (configured === null) return null;

  if (configured === false) {
    return (
      <Card title="Cloud Sync" desc="Upload this company's data to Firebase Firestore as a cloud backup. Not set up yet — follow SYNC-SETUP.md in the project (paste your Firebase config, enable Email/Password sign-in, create a user, and publish the Firestore rules), then redeploy.">
        <div style={{ color: muted, fontSize: 12.5 }}>Firebase isn't configured in this build.</div>
      </Card>
    );
  }

  return (
    <Card title="Cloud Sync" desc="Uploads this company's data to Firestore as a cloud backup, and can pull it back down to recover on a new device or after clearing browser storage. Sync never changes local data; Restore never changes the cloud copy.">
      {error && (
        <div style={{ background: dangerBg, color: danger, fontSize: 12.5, padding: "8px 10px", borderRadius: 8, marginBottom: 12 }}>{error}</div>
      )}
      {status && (
        <div style={{ background: successBg, color: success, fontSize: 12.5, padding: "8px 10px", borderRadius: 8, marginBottom: 12 }}>{status}</div>
      )}

      {!fbUser ? (
        <form onSubmit={handleSignIn}>
          <p style={{ color: muted, fontSize: 12.5, marginBottom: 10 }}>
            Sign in with the Firebase account you created (Authentication → Users). This is separate from your app login, and is normally only needed once per device.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder="Firebase email" autoComplete="off"
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${hairline}`, color: ink, background: "#fff" }}
            />
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              placeholder="Password" autoComplete="off"
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: `1px solid ${hairline}`, color: ink, background: "#fff" }}
            />
            <button
              type="submit" disabled={busy}
              className="px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap"
              style={{ background: busy ? hairline : thread, color: ink }}
            >
              {busy ? "Signing in…" : "Connect"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <span style={{ color: muted, fontSize: 12.5 }}>
              Connected as <b style={{ color: ink }}>{fbUser.email}</b>
            </span>
            <button onClick={handleSignOut} style={{ color: inkSoft, fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Disconnect
            </button>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-start sm:items-center">
            <button
              onClick={handleSync} disabled={busy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm"
              style={{ background: busy ? hairline : thread, color: ink }}
            >
              <Upload size={16} /> {busy ? "Syncing…" : `Sync ${companyName || "Company"} to Cloud`}
            </button>
            <button
              onClick={handleRestore} disabled={busy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm"
              style={{ background: card, border: `1px solid ${hairline}`, color: ink, opacity: busy ? 0.6 : 1 }}
            >
              <Download size={16} /> {busy ? "Fetching…" : "Restore from Cloud"}
            </button>
            {lastSync && (
              <span style={{ color: muted, fontSize: 12 }}>Last synced {fmtDateTime(new Date(lastSync).getTime())}</span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function BackupView({ counts, onBackup, onShareBackup, shareBackupPending, onRestore, onExportMasters, onExportVouchers, onExportProApp, companyName, companyId, buildSyncBook, onRestoreFromCloud }) {
  const restoreRef = useRef(null);
  const Card = ({ title, desc, children }) => (
    <div className="rounded-xl p-5 mb-4" style={{ background: card, border: `1px solid ${hairline}` }}>
      <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{title}</h3>
      <p style={{ color: muted, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>{desc}</p>
      {children}
    </div>
  );
  return (
    <div>
      <div className="mb-5">
        <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 28, fontWeight: 600 }}>Backup &amp; Export</h1>
        {companyName && (
          <p style={{ color: inkSoft, fontSize: 13, fontWeight: 600, marginTop: 4 }}>
            Company: {companyName}
          </p>
        )}
        <p style={{ color: muted, fontSize: 13, marginTop: 2 }}>
          {counts.customers} customers · {counts.vendors} vendors · {counts.invoices} invoices · {counts.receipts} receipts · {counts.purchases} purchases · {counts.payments} payments
        </p>
      </div>

      {buildSyncBook && companyId && (
        <CloudSyncCard companyId={companyId} companyName={companyName} buildBook={buildSyncBook} onRestoreRequested={onRestoreFromCloud} Card={Card} />
      )}

      <Card title="Full Backup &amp; Tally Export" desc="Download a complete JSON backup of all your data, or export directly to Tally Prime XML. For Tally: import Masters first (creates all ledgers), then Transactions.">
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <button onClick={onBackup} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm" style={{ background: thread, color: ink }}>
            <Download size={16} /> Download Backup
          </button>
          {onShareBackup && canShareFiles() && (
            <button onClick={onShareBackup} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
              <Share2 size={16} /> {shareBackupPending ? "Tap to Save" : "Save to Drive / Files"}
            </button>
          )}
          <button onClick={onExportMasters} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm" style={{ background: ink, color: "#fff" }}>
            <Download size={16} /> Tally Masters XML
          </button>
          <button onClick={onExportVouchers} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm" style={{ background: ink, color: "#fff" }}>
            <Download size={16} /> Tally Transactions XML
          </button>
        </div>
        <p style={{ color: muted, fontSize: 11.5, lineHeight: 1.5, marginTop: 12 }}>
          <b>Backup</b> = full JSON (your restore point). <b>Masters XML</b> = complete Chart of Accounts. <b>Transactions XML</b> = all sales, receipts, purchases &amp; payments as vouchers.
        </p>
      </Card>

      {onExportProApp && (
        <Card title="Export for Textile Bill Pro" desc="Converts this data into the other app's own backup format so it can be restored there. This app's ids are random text (not accepted by that app's restore, which requires numeric ids) — this export assigns fresh numeric ids to every record and rewrites every reference to match, so the file passes its validation.">
          <button onClick={onExportProApp} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm" style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}>
            <Download size={16} /> Export for Textile Bill Pro
          </button>
        </Card>
      )}

      <Card title="Restore from Backup" desc="Load a backup file. This replaces ALL current data. Works with this app's backups and the real app's textile-bill-pro backup file.">
        <input ref={restoreRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) { onRestore(e.target.files[0]); e.target.value = ""; } }} />
        <button onClick={() => restoreRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm" style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}>
          <Upload size={16} /> Choose Backup File…
        </button>
      </Card>
    </div>
  );
}

// Admin-only screen for managing who can sign in — add people, change their
// role, reset a forgotten password, or remove access. The list itself is
// stored in this browser (see loadUsers/saveUsers) since there's no backend.
function UsersView({ users, currentUsername, onAdd, onUpdateRole, onResetPassword, onDelete }) {
  const [showAdd, setShowAdd] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const adminCount = users.filter((u) => u.role === "Admin").length;

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 28, fontWeight: 600 }}>Users</h1>
          <p style={{ color: muted, fontSize: 13, marginTop: 2 }}>Manage who can sign in to Textile Bill</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm"
          style={{ background: thread, color: ink }}
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${hairline}` }}>
        <div className="grid items-center gap-2 px-4 py-2.5" style={{ gridTemplateColumns: "minmax(0,1fr) 150px 90px", background: paper, borderBottom: `1px solid ${hairline}` }}>
          <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>USER ID</span>
          <span style={{ color: muted, fontSize: 11, fontWeight: 700 }}>ROLE</span>
          <span style={{ color: muted, fontSize: 11, fontWeight: 700, textAlign: "right" }}>ACTIONS</span>
        </div>
        {users.map((u, idx) => {
          const isSelf = u.username.toLowerCase() === currentUsername.toLowerCase();
          const isLastAdmin = u.role === "Admin" && adminCount <= 1;
          const canDelete = !isSelf && !isLastAdmin;
          return (
            <div
              key={u.id}
              className="grid items-center gap-2 px-4 py-3"
              style={{ gridTemplateColumns: "minmax(0,1fr) 150px 90px", borderTop: idx > 0 ? `1px solid ${hairline}` : "none" }}
            >
              <div style={{ color: ink, fontWeight: 600, fontSize: 14 }}>
                {u.username}
                {isSelf && <span style={{ color: muted, fontWeight: 500 }}> (you)</span>}
              </div>
              <InlineSelect
                value={u.role}
                onChange={(v) => onUpdateRole(u.id, v)}
                options={["User", "Admin"]}
                disabled={isLastAdmin}
                className="px-2.5 py-1.5 rounded-lg text-sm outline-none"
                style={{ border: `1px solid ${hairline}`, color: ink, background: isLastAdmin ? "#F1EEE6" : "#fff" }}
              />
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => setResetTarget(u)}
                  className="flex items-center justify-center rounded-lg"
                  style={{ width: 30, height: 30, color: inkSoft }}
                  title="Reset password"
                >
                  <Key size={15} />
                </button>
                {pendingDelete === u.id ? (
                  <button onClick={() => { onDelete(u.id); setPendingDelete(null); }} className="text-xs font-bold" style={{ color: danger }}>
                    Sure?
                  </button>
                ) : (
                  <button
                    onClick={() => canDelete && setPendingDelete(u.id)}
                    disabled={!canDelete}
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 30, height: 30, color: canDelete ? danger : hairline, cursor: canDelete ? "pointer" : "not-allowed" }}
                    title={isSelf ? "Can't delete your own account while signed in" : isLastAdmin ? "Can't delete the last Admin" : "Delete"}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <AddUserModal
          existingUsernames={users.map((u) => u.username.toLowerCase())}
          onClose={() => setShowAdd(false)}
          onSave={(u) => { onAdd(u); setShowAdd(false); }}
        />
      )}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onSave={(password) => { onResetPassword(resetTarget.id, password); setResetTarget(null); }}
        />
      )}
    </div>
  );
}

function AddUserModal({ existingUsernames, onClose, onSave }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("User");
  const [error, setError] = useState("");

  function handleSave() {
    const trimmed = username.trim();
    if (!trimmed) { setError("Enter a username."); return; }
    if (existingUsernames.includes(trimmed.toLowerCase())) { setError("That username is already taken."); return; }
    if (!password.trim()) { setError("Enter a password."); return; }
    onSave({ username: trimmed, password: password.trim(), role });
  }

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: "#fff" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 20, fontWeight: 600 }}>Add User</h3>
          <button onClick={onClose}><X size={20} color={muted} /></button>
        </div>
        {error && (
          <div style={{ background: dangerBg, color: danger, fontSize: 12.5, padding: "8px 10px", borderRadius: 8, marginBottom: 12 }}>{error}</div>
        )}
        <div className="space-y-2.5">
          <InlineRow label="Username">
            <input value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} style={inputStyle} autoFocus />
          </InlineRow>
          <InlineRow label="Password">
            <input value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} style={inputStyle} />
          </InlineRow>
          <InlineRow label="Role">
            <InlineSelect value={role} onChange={setRole} options={["User", "Admin"]} className={inputCls} style={inputStyle} />
          </InlineRow>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1" style={{ background: thread, color: ink }}>
            <Check size={16} /> Add User
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onSave }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSave() {
    if (!password.trim()) { setError("Enter a new password."); return; }
    onSave(password.trim());
  }

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: "#fff" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 20, fontWeight: 600 }}>Reset Password</h3>
          <button onClick={onClose}><X size={20} color={muted} /></button>
        </div>
        <p style={{ color: muted, fontSize: 13, marginBottom: 14 }}>
          New password for <b style={{ color: ink }}>{user.username}</b>.
        </p>
        {error && (
          <div style={{ background: dangerBg, color: danger, fontSize: 12.5, padding: "8px 10px", borderRadius: 8, marginBottom: 12 }}>{error}</div>
        )}
        <InlineRow label="New Password">
          <input value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} style={inputStyle} autoFocus />
        </InlineRow>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1" style={{ background: thread, color: ink }}>
            <Check size={16} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

function TransactionReportView({ invoices, receipts, customers, purchases = [], payments = [], vendors = [], invoiceTotal, quickRangeDates, fyWindow }) {
  const [from, setFrom] = useState(currentFYDates().from);
  const [to, setTo] = useState(currentFYDates().to);

  // Follow the global financial-year picker. This view owns its own From/To
  // state (so it can still be adjusted independently), so it needs to be
  // told when the app-wide year changes.
  useEffect(() => {
    if (!fyWindow) return;
    setFrom(fyWindow.from);
    setTo(fyWindow.to);
  }, [fyWindow]);

  const [typeFilter, setTypeFilter] = useState("all"); // all | Sales | Receipt | Purchase | Payment
  const [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState([]); // keys of selected rows
  const [sortField, setSortField] = useState("date"); // date | created
  const [sortDir, setSortDir] = useState("desc");
  const customerById = useMemo(() => {
    const m = new Map();
    for (const c of customers) m.set(c.id, c);
    return m;
  }, [customers]);
  const vendorById = useMemo(() => {
    const m = new Map();
    for (const v of vendors) m.set(v.id, v);
    return m;
  }, [vendors]);
  const nameOf = (id) => customerById.get(id)?.name || "—";
  const vNameOf = (id) => vendorById.get(id)?.name || "—";
  // Discount-mode and return-mode receipts/payments have no real cash/bank
  // leg — Discount Allowed (Indirect Expense) / Sales Return on the customer
  // side, Discount Received (Indirect Income) / Purchase Return on the vendor
  // side — and they display/export as Journal vouchers rather than
  // Receipt/Payment (see voucherLabel below).
  const receiptModeAccount = (r) => (r.mode === "Cash" ? "Cash" : r.mode === "Discount" ? "Discount Allowed" : r.mode === "Sale Return" ? "Sales Return" : r.mode === "Bank" ? (r.bankName || "Bank") : r.mode);
  const paymentModeAccount = (p) => (p.mode === "Cash" ? "Cash" : p.mode === "Discount" ? "Discount Received" : p.mode === "Purchase Return" ? "Purchase Return" : (p.bankName || p.mode || "Bank"));
  // Modes with no cash/bank movement — booked as Journal vouchers, matching
  // Tally convention for an adjustment rather than an actual money transfer.
  const isJournalMode = (m) => m === "Discount" || m === "Sale Return" || m === "Purchase Return";
  // Display/export label for a row's voucher type: these modes show as
  // "Journal" even though they're still filtered and summarized as ordinary
  // Receipt/Payment activity underneath.
  const voucherLabel = (r) => ((r.type === "Receipt" || r.type === "Payment") && isJournalMode(r.mode)) ? "Journal" : r.type;

  // Unified voucher rows across all four transaction types.
  //   Sales:    Dr customer            / Cr Sales Account
  //   Receipt:  Dr Cash/Bank           / Cr customer
  //   Purchase: Dr Purchase Account     / Cr vendor
  //   Payment:  Dr vendor               / Cr Cash/Bank
  const allRows = [
    ...invoices.map((inv) => ({ key: `Sales:${inv.invoiceNo}`, date: inv.date, type: "Sales", ref: inv.invoiceNo, debit: nameOf(inv.customerId), credit: "Sales Account", amount: invoiceTotal(inv), createdAt: inv.createdAt || 0 })),
    ...receipts.map((r) => ({ key: `Receipt:${r.receiptNo}`, date: r.date, type: "Receipt", mode: r.mode, ref: r.receiptNo, debit: receiptModeAccount(r), credit: nameOf(r.customerId), amount: Number(r.amount) || 0, createdAt: r.createdAt || 0 })),
    ...purchases.map((p) => ({ key: `Purchase:${p.billNo}`, date: p.date, type: "Purchase", ref: p.billNo, debit: "Purchase Account", credit: vNameOf(p.vendorId), amount: purchaseTotal(p), createdAt: p.createdAt || 0 })),
    ...payments.map((p) => ({ key: `Payment:${p.paymentNo}`, date: p.date, type: "Payment", mode: p.mode, ref: p.paymentNo, debit: vNameOf(p.vendorId), credit: paymentModeAccount(p), amount: Number(p.amount) || 0, createdAt: p.createdAt || 0 })),
  ];
  const rows = allRows
    .filter((r) => (typeFilter === "all" || r.type === typeFilter))
    .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
    .sort((a, b) => {
      const cmp = sortField === "created"
        ? (a.createdAt || 0) - (b.createdAt || 0)
        : (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const typeSummary = ["Sales", "Purchase", "Receipt", "Payment"].map((t) => {
    const trows = rows.filter((r) => r.type === t);
    return { type: t, count: trows.length, amount: trows.reduce((s, r) => s + r.amount, 0) };
  });
  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  // Export scope: selected rows if any are ticked, else all filtered rows.
  const exportRows = selected.length ? rows.filter((r) => selected.includes(r.key)) : rows;
  const visibleKeys = rows.map((r) => r.key);
  const allSelected = visibleKeys.length > 0 && visibleKeys.every((k) => selected.includes(k));
  const toggleSelect = (k) => setSelected((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const toggleSelectAll = () => setSelected(allSelected ? [] : visibleKeys);


  function exportCsv() {
    const data = exportRows.map((r) => ({
      "Date": r.date,
      "Voucher Type": voucherLabel(r),
      "Reference": r.ref,
      "Debit": r.debit,
      "Credit": r.credit,
      "Amount": r.amount,
      "Created": r.createdAt ? fmtDateTime(r.createdAt) : "",
    }));
    if (!data.length) return;
    downloadCsv(data, `Transaction_Report_${todayISO()}`);
  }

  // Export the transactions as Tally Prime voucher XML (selected rows or all).
  function exportTallyXml() {
    if (!exportRows.length) return;
    const vouchers = exportRows.map((r) => {
      // party = customer/vendor ledger; otherLedger = Cash/Bank/Sales/Purchase.
      let party, otherLedger;
      if (r.type === "Sales") { party = r.debit; otherLedger = r.credit; }
      else if (r.type === "Receipt") { party = r.credit; otherLedger = r.debit; }
      else if (r.type === "Purchase") { party = r.credit; otherLedger = r.debit; }
      else { party = r.debit; otherLedger = r.credit; } // Payment
      return { date: r.date, type: r.type, ref: r.ref, party, otherLedger, amount: r.amount, isDiscount: isJournalMode(r.mode) };
    });
    const xml = buildTallyVouchersXml(vouchers);
    downloadTextFile(xml, `Transaction_Report_Tally_${todayISO()}.xml`);
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 28, fontWeight: 600 }}>Transaction Report</h1>
          <p style={{ color: muted, fontSize: 13, marginTop: 2 }}>{rows.length} entr{rows.length !== 1 ? "ies" : "y"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPreview(true)} className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs" style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }} title="Preview / print (A4 landscape)">
            <Eye size={14} /> Preview
          </button>
          <button onClick={exportCsv} className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs" style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }} title="Export to CSV">
            <Download size={14} /> CSV
          </button>
          <button onClick={exportTallyXml} className="flex items-center gap-1 px-3 py-2.5 rounded-lg font-semibold text-xs" style={{ background: ink, color: "#fff" }} title="Export vouchers as Tally Prime XML">
            <Download size={14} /> Tally XML
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        {["all", "Sales", "Receipt", "Purchase", "Payment"].map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ background: typeFilter === t ? ink : card, color: typeFilter === t ? "#fff" : muted, border: `1px solid ${typeFilter === t ? ink : hairline}` }}>
            {t === "all" ? "All Types" : t}
          </button>
        ))}
      </div>

      <DateRangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} quickRangeDates={quickRangeDates} />

      <div className="flex items-center justify-between rounded-xl px-4 py-3 mb-4" style={{ background: card, border: `1px solid ${hairline}` }}>
        <div>
          <div style={{ color: muted, fontSize: 12 }}>Total</div>
          <div style={{ color: ink, fontWeight: 700, fontSize: 22, fontFamily: "'Fraunces', serif" }}>{fmtMoney(total)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: muted, fontSize: 12 }}>Entries</div>
          <div style={{ color: ink, fontWeight: 700, fontSize: 22, fontFamily: "'IBM Plex Mono', monospace" }}>{rows.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {typeSummary.map((s) => (
          <div key={s.type} className="rounded-xl px-3.5 py-3" style={{ background: card, border: `1px solid ${hairline}` }}>
            <div style={{ color: muted, fontSize: 11.5, fontWeight: 600 }}>{s.type}{s.type === "Receipt" ? "s" : s.type === "Payment" ? "s" : ""}</div>
            <div style={{ color: ink, fontWeight: 700, fontSize: 16.5, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {fmtMoney(s.amount)}
            </div>
            <div style={{ color: muted, fontSize: 11, marginTop: 1 }}>{s.count} entr{s.count !== 1 ? "ies" : "y"}</div>
          </div>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg mb-3" style={{ background: ink }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{selected.length} selected — exports cover these only</span>
          <button onClick={() => setSelected([])} className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: "transparent", color: "#B9C2D6", border: "1px solid #4A5D8A" }}>Clear</button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: card, border: `1px dashed ${hairline}` }}>
          <FileText size={28} color={muted} className="mx-auto mb-3" />
          <p style={{ color: ink, fontWeight: 600, fontSize: 15 }}>No transactions</p>
          <p style={{ color: muted, fontSize: 13, marginTop: 4 }}>Adjust filters or record a sale/receipt.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${hairline}` }}>
          <div className="overflow-x-auto">
            <div style={{ minWidth: 700 }}>
              <div className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: "28px 78px 68px 84px minmax(0,1fr) minmax(0,1fr) 92px 108px", background: paper, borderBottom: `1px solid ${hairline}` }}>
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ width: 15, height: 15, accentColor: thread }} />
                <button onClick={() => toggleSort("date")} className="flex items-center gap-0.5" style={{ color: sortField === "date" ? ink : muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: "transparent", padding: 0 }}>
                  DATE {sortField === "date" && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </button>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>TYPE</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>REF</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>DEBIT</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>CREDIT</span>
                <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textAlign: "right" }}>AMOUNT</span>
                <button onClick={() => toggleSort("created")} className="flex items-center gap-0.5 justify-end" style={{ color: sortField === "created" ? ink : muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", background: "transparent", padding: 0 }}>
                  CREATED {sortField === "created" && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </button>
              </div>
              {rows.map((r, idx) => (
                <div key={r.key} className="grid items-center gap-2 px-3 py-2.5" style={{ gridTemplateColumns: "28px 78px 68px 84px minmax(0,1fr) minmax(0,1fr) 92px 108px", borderTop: idx > 0 ? `1px solid ${hairline}` : "none", background: selected.includes(r.key) ? "#FBF4E7" : "transparent" }}>
                  <input type="checkbox" checked={selected.includes(r.key)} onChange={() => toggleSelect(r.key)} style={{ width: 15, height: 15, accentColor: thread }} />
                  <span style={{ color: muted, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmtDateShort(r.date)}</span>
                  <span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{
                      background: voucherLabel(r) === "Journal" ? "#F1EEFB" : (r.type === "Sales" || r.type === "Purchase") ? "#EAF0FB" : successBg,
                      color: voucherLabel(r) === "Journal" ? "#5B4FA8" : (r.type === "Sales" || r.type === "Purchase") ? inkSoft : success,
                    }}>{voucherLabel(r)}</span>
                  </span>
                  <span style={{ color: inkSoft, fontSize: 12, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{r.ref}</span>
                  <span style={{ color: ink, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.debit}</span>
                  <span style={{ color: ink, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.credit}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: ink, fontSize: 13, textAlign: "right", whiteSpace: "nowrap" }}>{fmtMoney(r.amount)}</span>
                  <span style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap", textAlign: "right" }}>{r.createdAt ? fmtDateTime(r.createdAt) : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {preview && (() => {
        const prows = rows.map((r) => [fmtDate(r.date), voucherLabel(r), r.ref, r.debit, r.credit, fmtNum(r.amount)]);
        const cols = [{ header: "Date" }, { header: "Type" }, { header: "Ref" }, { header: "Debit", width: 150 }, { header: "Credit", width: 150 }, { header: "Amount", align: "right" }];
        const foot = ["", "", "", "", "Total", fmtNum(total)];
        return (
          <>
            <GenericReportPreview rows={prows} title="Transaction Report" subtitle={`${rows.length} entr${rows.length !== 1 ? "ies" : "y"}${typeFilter !== "all" ? ` · ${typeFilter}` : ""}`} columns={cols} footer={foot} onClose={() => setPreview(false)} />
            <GenericReportPrint rows={prows} title="Transaction Report" subtitle={`${rows.length} entr${rows.length !== 1 ? "ies" : "y"} · ${fmtDate(todayISO())}`} columns={cols} footer={foot} />
          </>
        );
      })()}
    </div>
  );
}

// ============ SHARED DATE RANGE BAR ============

// ============ CUSTOMER PRINTS ============
function ConfirmPrintModal({ title, subtitle, onClose }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sharePayload, setSharePayload] = useState(null);
  const doSavePdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await generatePdfFromPrintAreas(title);
    } catch (e) {
      console.error("PDF generation failed", e);
      alert("Could not generate the PDF. Please try the Print button instead.");
    } finally {
      setPdfBusy(false);
    }
  };
  // Two-tap Share — see preparePdfForShare's comment for why (iOS Safari
  // requires navigator.share() to be called immediately within the tap
  // that triggered it, and building the PDF takes too long for that).
  const doSharePdf = async () => {
    if (pdfBusy) return;
    if (sharePayload) {
      try {
        await navigator.share({ files: [sharePayload.file], title: sharePayload.fname });
      } catch (e) {
        if (e?.name !== "AbortError") downloadBlob(sharePayload.file, sharePayload.fname);
      } finally {
        setSharePayload(null);
      }
      return;
    }
    setPdfBusy(true);
    try {
      const prepared = await preparePdfForShare(title);
      if (!prepared) return;
      if (canShareFiles() && navigator.canShare({ files: [prepared.file] })) {
        setSharePayload(prepared);
      } else {
        prepared.pdf.save(prepared.fname);
      }
    } catch (e) {
      console.error("PDF share failed", e);
      alert("Could not prepare the PDF to share. Please try Save PDF instead.");
    } finally {
      setPdfBusy(false);
    }
  };
  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4" style={{ background: "rgba(30,42,68,0.45)", zIndex: 55 }}>
      <div className="w-full max-w-sm rounded-xl p-6 text-center" style={{ background: "#fff" }}>
        <Printer size={26} color={ink} className="mx-auto mb-3" />
        <p style={{ color: ink, fontWeight: 600, marginBottom: 4 }}>{title}</p>
        <p style={{ color: muted, fontSize: 13, marginBottom: 16 }}>{subtitle}</p>
        <div className="flex gap-2 mb-2">
          <button onClick={() => printDoc(title)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: thread, color: ink }}>Print</button>
          <button onClick={doSavePdf} disabled={pdfBusy} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: ink, opacity: pdfBusy ? 0.6 : 1 }}>{pdfBusy ? "…" : "Save PDF"}</button>
        </div>
        <div className="flex gap-2">
          {canShareFiles() && (
            <button onClick={doSharePdf} disabled={pdfBusy} className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5" style={{ border: `1px solid ${hairline}`, background: sharePayload ? thread : "transparent", color: ink, opacity: pdfBusy ? 0.6 : 1 }}>
              <Share2 size={14} /> {pdfBusy ? "…" : sharePayload ? "Tap to Share" : "Share"}
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function SummaryTable({ customers, customerOutstanding, invoices = [] }) {
  // Last sale per customer, taken from their most recent invoice date.
  // Built once as a Map rather than scanning the invoice list per row.
  const lastSale = useMemo(() => {
    const m = new Map();
    for (const inv of invoices) {
      const prev = m.get(inv.customerId);
      if (!prev || inv.date > prev) m.set(inv.customerId, inv.date);
    }
    return m;
  }, [invoices]);
  const daysSince = (d) => {
    if (!d) return null;
    const ms = new Date(`${todayISO()}T12:00:00`) - new Date(`${d}T12:00:00`);
    return Math.max(0, Math.round(ms / 86400000));
  };
  const th = (align) => ({ border: "1px solid #333", padding: "4px 6px", textAlign: align, fontWeight: 700, background: "#f2f2f2", fontSize: 12 });
  const td = (align) => ({ border: "1px solid #333", padding: "3px 6px", textAlign: align, fontSize: 12 });
  const balances = customers.map((c) => customerOutstanding(c.id));
  const totalDr = balances.filter((b) => b > 0).reduce((s, b) => s + b, 0);
  const totalCr = balances.filter((b) => b < 0).reduce((s, b) => s + Math.abs(b), 0);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={th("center")}>SN</th>
          <th style={th("left")}>Customer Details</th>
          <th style={th("left")}>Phone</th>
          <th style={th("center")}>Last Sale</th>
          <th style={th("center")}>Days</th>
          <th style={th("right")}>Balance</th>
        </tr>
      </thead>
      <tbody>
        {customers.map((c, i) => {
          const bal = customerOutstanding(c.id);
          const last = lastSale.get(c.id);
          const days = daysSince(last);
          return (
            <tr key={c.id}>
              <td style={td("center")}>{i + 1}</td>
              {/* Name and address share one column so the two new date
                  columns fit without the table overflowing the page. */}
              <td style={td("left")}>
                <span style={{ fontWeight: 600 }}>{c.name}</span>
                {c.address ? <span style={{ color: "#555" }}> — {c.address}</span> : null}
              </td>
              <td style={td("left")}>{c.phone1 || "—"}</td>
              <td style={{ ...td("center"), whiteSpace: "nowrap" }}>{last ? fmtDate(last) : "—"}</td>
              <td style={td("center")}>{days === null ? "—" : days}</td>
              <td style={{ ...td("right"), whiteSpace: "nowrap", fontWeight: 600 }}>
                {fmtMoney(Math.abs(bal))} {bal >= 0 ? "DR" : "CR"}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr style={{ fontWeight: 700 }}>
          <td colSpan={5} style={{ padding: "5px 6px", textAlign: "right" }}>Total Dr / Cr</td>
          <td style={{ padding: "5px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
            {fmtMoney(totalDr)} DR · {fmtMoney(totalCr)} CR
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function CustomerSummaryPrint({ customers, customerOutstanding, invoices = [] }) {
  return (
    <div className="print-area" style={{ padding: 32, fontFamily: "'Inter', sans-serif", color: "#111" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700 }}>Textile Bill</div>
        <div style={{ fontSize: 12, color: "#666" }}>
          Customer Summary Balances — {customers.length} customer{customers.length !== 1 ? "s" : ""} · {fmtDate(todayISO())}
        </div>
      </div>
      <SummaryTable customers={customers} customerOutstanding={customerOutstanding} invoices={invoices} />
    </div>
  );
}

function CustomerSummaryPreviewModal({ customers, customerOutstanding, invoices = [], selectionCount = 0, onClose }) {
  return (
    <PrintPreviewOverlay
      title="Customer Summary Balances"
      subtitle={`${customers.length} customer${customers.length !== 1 ? "s" : ""}${selectionCount > 0 ? " · selected only" : ""} · sorted by balance`}
      onClose={onClose}
    >
      <PaperSheet>
        <div style={{ padding: 32 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>Textile Bill</div>
            <div style={{ fontSize: 12, color: "#666" }}>
              Customer Summary Balances · {fmtDate(todayISO())}
            </div>
          </div>
          {customers.length === 0 ? (
            <div style={{ textAlign: "center", color: "#888", fontSize: 13, padding: "24px 0" }}>No customers to show.</div>
          ) : (
            <SummaryTable customers={customers} customerOutstanding={customerOutstanding} invoices={invoices} />
          )}
        </div>
      </PaperSheet>
    </PrintPreviewOverlay>
  );
}
// Compact ledger block (used in the two-column flowing multi-ledger layout).
function LedgerBlock({ customer, invoices, receipts, invoiceTotal, ledgerWindow = {} }) {
  const th = (align) => ({ border: "1px solid #333", padding: "2px 5px", textAlign: align, fontWeight: 700, background: "#f2f2f2", fontSize: 9.5, lineHeight: 1.15 });
  const td = (align) => ({ border: "1px solid #333", padding: "2px 5px", textAlign: align, fontSize: 9.5, lineHeight: 1.15 });
  const led = buildLedger(customer, invoices, receipts, invoiceTotal, ledgerWindow);
  const phones = [customer.phone1, customer.phone2].filter(Boolean).join(" · ");
  const period = ledgerWindow.from || ledgerWindow.to
    ? `${ledgerWindow.from ? fmtDate(ledgerWindow.from) : "Beginning"} to ${ledgerWindow.to ? fmtDate(ledgerWindow.to) : fmtDate(todayISO())}`
    : `As on ${fmtDate(todayISO())}`;
  return (
    <div style={{ breakInside: "avoid", pageBreakInside: "avoid", marginBottom: 16 }}>
      <div style={{ marginBottom: 3 }}>
        <span style={{ fontWeight: 700, fontSize: 12 }}>{customer.name}</span>
        {phones ? <span style={{ fontSize: 9.5, color: "#000", marginLeft: 6 }}>{phones}</span> : null}
      </div>
      <div style={{ fontSize: 9, color: "#000", marginBottom: 3 }}>Customer Ledger · {period}</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th("left")}>Date</th>
            <th style={th("left")}>Description</th>
            <th style={th("right")}>Debit (Dr)</th>
            <th style={th("right")}>Credit (Cr)</th>
            <th style={th("right")}>Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={td("left")}>—</td>
            <td style={{ ...td("left"), fontWeight: 600 }}>Opening Balance</td>
            <td style={td("right")}>{led.opening > 0 ? fmtMoney(led.opening) : "—"}</td>
            <td style={td("right")}>{led.opening < 0 ? fmtMoney(Math.abs(led.opening)) : "—"}</td>
            <td style={{ ...td("right"), fontWeight: 600, whiteSpace: "nowrap" }}>{fmtMoney(Math.abs(led.opening))} {led.opening >= 0 ? "DR" : "CR"}</td>
          </tr>
          {led.entries.map((e, i) => (
            <tr key={i}>
              <td style={{ ...td("left"), whiteSpace: "nowrap" }}>{fmtDate(e.date)}</td>
              <td style={td("left")}>{e.description}</td>
              <td style={td("right")}>{e.debit > 0 ? fmtMoney(e.debit) : "—"}</td>
              <td style={td("right")}>{e.credit > 0 ? fmtMoney(e.credit) : "—"}</td>
              <td style={{ ...td("right"), fontWeight: 600, whiteSpace: "nowrap" }}>{fmtMoney(Math.abs(e.balance))} {e.balance >= 0 ? "DR" : "CR"}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 700 }}>
            <td colSpan={2} style={{ ...td("right"), background: "#f8f8f8" }}>Closing Balance</td>
            <td style={{ ...td("right"), background: "#f8f8f8" }}>{fmtMoney(led.totalDebit)}</td>
            <td style={{ ...td("right"), background: "#f8f8f8" }}>{fmtMoney(led.totalCredit)}</td>
            <td style={{ ...td("right"), background: "#f8f8f8", whiteSpace: "nowrap" }}>{fmtMoney(Math.abs(led.closing))} {led.closing >= 0 ? "DR" : "CR"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Two-column flowing layout: ledgers pack into two columns and flow down the
// page, matching the reference app (many ledgers per sheet, not one per page).
function LedgersFlow({ customers, invoices, receipts, invoiceTotal, ledgerWindow }) {
  return (
    <div style={{ padding: "18px 22px", columnCount: 2, columnGap: 24, fontFamily: "'Inter', sans-serif", color: "#111" }}>
      {customers.map((c) => (
        <LedgerBlock
          key={c.id}
          customer={c}
          invoices={invoices.filter((i) => i.customerId === c.id)}
          receipts={receipts.filter((r) => r.customerId === c.id)}
          invoiceTotal={invoiceTotal}
          ledgerWindow={ledgerWindow}
        />
      ))}
    </div>
  );
}

function CustomerLedgersPrint({ customers, invoices, receipts, invoiceTotal, ledgerWindow }) {
  return (
    <div className="print-area packing-print" style={{ fontFamily: "'Inter', sans-serif", color: "#111" }}>
      <LedgersFlow customers={customers} invoices={invoices} receipts={receipts} invoiceTotal={invoiceTotal} ledgerWindow={ledgerWindow} />
    </div>
  );
}

function CustomerLedgersPreview({ customers, invoices, receipts, invoiceTotal, ledgerWindow, selectionCount = 0, onClose }) {
  return (
    <PrintPreviewOverlay
      title={customers.length === 1 ? `${customers[0].name} — Ledger` : "Customer Ledgers"}
      // A single-party ledger is almost always being shared with that party,
      // so the file is named after them rather than the generic report name.
      filename={customers.length === 1 ? `${customers[0].name} Ledger` : "Customer Ledgers"}
      subtitle={`landscape, 2 columns · ${customers.length} customer${customers.length !== 1 ? "s" : ""}${selectionCount > 0 ? " · selected only" : ""}`}
      onClose={onClose}
    >
      {customers.length === 0 ? (
        <div style={{ textAlign: "center", color: "#B9C2D6", fontSize: 14, padding: "48px 0" }}>No customers to show.</div>
      ) : (
        <PaperSheet landscape>
          <LedgersFlow customers={customers} invoices={invoices} receipts={receipts} invoiceTotal={invoiceTotal} ledgerWindow={ledgerWindow} />
        </PaperSheet>
      )}
    </PrintPreviewOverlay>
  );
}

// ================= CUSTOMERS MODULE =================
// Compact summary tile for the Customers/Vendors balance cards. The `net`
// variant flips its own colour by sign, since a net figure can land either
// way regardless of which column it sits under.
function BalanceCard({ label, count, amount, color, net = false, vendorSense = false }) {
  const shown = net ? Math.abs(amount) : amount;
  // On the vendor side a positive net means payable (Cr) and reads as a
  // liability, so both the tag and the colour invert relative to customers.
  const tone = net
    ? (amount === 0 ? ink : (amount > 0) !== vendorSense ? success : danger)
    : color;
  const suffix = net ? (amount === 0 ? "" : (amount > 0) !== vendorSense ? " Dr" : " Cr") : "";
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: card, border: `1px solid ${hairline}` }}>
      <div style={{ color: muted, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ color: tone, fontWeight: 700, fontSize: 16, fontFamily: "'IBM Plex Mono', monospace", marginTop: 2, whiteSpace: "nowrap" }}>
        {fmtMoney(shown)}<span style={{ fontSize: 10, fontWeight: 700 }}>{suffix}</span>
      </div>
      <div style={{ color: muted, fontSize: 11, marginTop: 1 }}>
        {count} {count === 1 ? "party" : "parties"}
      </div>
    </div>
  );
}

function CustomersView({
  customers, customerOutstanding, selected, setSelected,
  onAdd, onEdit, onDelete, onOpenDetail,
  onPreviewSummary, onPrintSummary, onPrintLedgers,
  dateFrom, dateTo, setDateFrom, setDateTo, quickRangeDates,
}) {
  const [q, setQ] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  // Default matches the real app: sorted by balance, highest receivable first.
  const [sortField, setSortField] = useState("balance"); // name | address | balance
  const [sortDir, setSortDir] = useState("desc");
  const [nonZeroOnly, setNonZeroOnly] = useState(false);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir(field === "balance" ? "desc" : "asc"); }
  };

  const list = customers
    .filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()) || (c.phone1 || "").includes(q.trim()))
    .filter((c) => !nonZeroOnly || Math.round(customerOutstanding(c.id)) !== 0)
    .sort((a, b) => {
      let cmp;
      if (sortField === "balance") {
        cmp = customerOutstanding(a.id) - customerOutstanding(b.id);
      } else {
        const av = (a[sortField === "address" ? "address" : "name"] || "").toLowerCase();
        const bv = (b[sortField === "address" ? "address" : "name"] || "").toLowerCase();
        cmp = av.localeCompare(bv);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  const visibleIds = list.map((c) => c.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleSelect = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSelectAll = () =>
    setSelected(allSelected ? [] : visibleIds);

  // Summary is computed from `list`, not the full customer set, so it
  // automatically follows the search box and the non-zero checkbox.
  // Customers are debtors: positive balance = Dr (receivable).
  const summary = list.reduce((acc, c) => {
    const bal = Math.round(customerOutstanding(c.id));
    if (bal > 0) { acc.drTotal += bal; acc.drCount += 1; }
    else if (bal < 0) { acc.crTotal += -bal; acc.crCount += 1; }
    else acc.zeroCount += 1;
    return acc;
  }, { drTotal: 0, drCount: 0, crTotal: 0, crCount: 0, zeroCount: 0 });

  const SortHeader = ({ field, children, align }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1"
      style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", justifyContent: align === "right" ? "flex-end" : "flex-start" }}
    >
      {children}
      {sortField === field && (sortDir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
    </button>
  );

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div>
          <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 28, fontWeight: 600 }}>Customers</h1>
          <p style={{ color: muted, fontSize: 13, marginTop: 2 }}>{customers.length} customer{customers.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrintLedgers}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Print ledgers (selected or all)"
          >
            <FileText size={16} />
          </button>
          <button
            onClick={onPreviewSummary}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Preview summary balances"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={onPrintSummary}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: card, border: `1px solid ${hairline}`, color: inkSoft }}
            title="Print summary balances"
          >
            <Printer size={16} />
          </button>
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm"
            style={{ background: thread, color: ink }}
          >
            <UserPlus size={16} /> New Customer
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg mb-3" style={{ background: ink }}>
          <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>
            {selected.length} selected — prints cover these only
          </span>
          <button
            onClick={() => setSelected([])}
            className="px-2.5 py-1 rounded-md text-xs font-semibold"
            style={{ background: "transparent", color: "#B9C2D6", border: "1px solid #4A5D8A" }}
          >
            Clear
          </button>
        </div>
      )}

      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4"
        style={{ background: card, border: `1px solid ${hairline}` }}
      >
        <Search size={15} color={muted} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or phone..."
          className="flex-1 outline-none text-sm bg-transparent"
          style={{ color: ink }}
        />
      </div>

      <DateRangeBar from={dateFrom} to={dateTo} setFrom={setDateFrom} setTo={setDateTo} quickRangeDates={quickRangeDates} />

      <label className="flex items-center gap-2 mb-4 text-sm" style={{ color: muted }}>
        <input
          type="checkbox"
          checked={nonZeroOnly}
          onChange={(e) => setNonZeroOnly(e.target.checked)}
          style={{ width: 15, height: 15, accentColor: thread }}
        />
        Show only non-zero balances
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <BalanceCard label="Total Receivable (Dr)" count={summary.drCount} amount={summary.drTotal} color={success} />
        <BalanceCard label="Total Payable (Cr)" count={summary.crCount} amount={summary.crTotal} color={danger} />
        <BalanceCard label="Net" count={summary.drCount + summary.crCount} amount={summary.drTotal - summary.crTotal} color={ink} net />
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl py-16 text-center" style={{ background: card, border: `1px dashed ${hairline}` }}>
          <UserPlus size={28} color={muted} className="mx-auto mb-3" />
          <p style={{ color: ink, fontWeight: 600, fontSize: 15 }}>{q ? "No matches" : "No customers yet"}</p>
          <p style={{ color: muted, fontSize: 13, marginTop: 4 }}>{q ? "Try a different search." : "Add your first customer to get started."}</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${hairline}` }}>
          <div className="overflow-x-auto">
            <div style={{ minWidth: 472 }}>
          {/* header */}
          <div
            className="cust-grid px-3 py-2"
            style={{ background: paper, borderBottom: `1px solid ${hairline}` }}
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              style={{ width: 15, height: 15, accentColor: thread }}
            />
            <span style={{ color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>SR</span>
            <SortHeader field="name">NAME</SortHeader>
            <SortHeader field="address">ADDRESS</SortHeader>
            <div style={{ textAlign: "right" }}><SortHeader field="balance" align="right">BALANCE</SortHeader></div>
            <span></span>
          </div>
          {list.map((c, idx) => {
            const confirming = pendingDelete === c.id;
            return (
              <div
                key={c.id}
                className="cust-grid px-3 py-2.5"
                style={{
                  borderTop: idx > 0 ? `1px solid ${hairline}` : "none",
                  cursor: "pointer",
                  background: selected.includes(c.id) ? "#FBF4E7" : "transparent",
                }}
                onClick={() => onOpenDetail(c)}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => toggleSelect(c.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 15, height: 15, accentColor: thread }}
                />
                <span style={{ color: muted, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>{idx + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEdit(c); }}
                    className="text-left"
                    style={{ color: inkSoft, fontWeight: 600, fontSize: 13, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", wordBreak: "break-word", maxWidth: "100%" }}
                  >
                    {c.name}
                  </button>
                  {c.phone1 && <div style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", marginTop: 1 }}>{c.phone1}</div>}
                </div>
                <span style={{ color: muted, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.address || "—"}
                </span>
                {(() => {
                  const bal = customerOutstanding(c.id);
                  const isDr = bal >= 0;
                  return (
                    <div className="flex items-center justify-end gap-1.5" style={{ whiteSpace: "nowrap" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 13, color: isDr ? success : danger }}>
                        {fmtMoney(Math.abs(bal))}
                      </span>
                      <span
                        className="px-1 rounded"
                        style={{ fontSize: 9, fontWeight: 700, border: `1px solid ${isDr ? success : danger}`, color: isDr ? success : danger }}
                      >
                        {isDr ? "DR" : "CR"}
                      </span>
                    </div>
                  );
                })()}
                <div onClick={(e) => e.stopPropagation()} style={{ textAlign: "right" }}>
                  {confirming ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { onDelete(c.id); setPendingDelete(null); }}
                        className="px-1.5 py-1 rounded-md font-semibold"
                        style={{ background: danger, color: "#fff", fontSize: 10, whiteSpace: "nowrap" }}
                      >
                        Sure?
                      </button>
                      <button
                        onClick={() => setPendingDelete(null)}
                        className="px-1 py-1 rounded-md font-semibold"
                        style={{ color: muted, fontSize: 10 }}
                        title="Cancel"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <IconBtn onClick={() => setPendingDelete(c.id)} title="Delete" danger><Trash2 size={14} /></IconBtn>
                  )}
                </div>
              </div>
            );
          })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerDetailView({ customer, invoices, receipts = [], invoiceTotal, ledgerWindow = {}, onBack, onEdit, onOpenInvoice, onOpenReceipt, onNewInvoice, onNewReceipt }) {
  const [preview, setPreview] = useState(false);
  if (!customer) {
    return (
      <div className="text-center py-16">
        <p style={{ color: muted, fontSize: 14 }}>Customer not found.</p>
        <button onClick={onBack} className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: inkSoft }}>
          Back to list
        </button>
      </div>
    );
  }

  const { opening, openingLabel, entries, totalDebit, totalCredit, closing } = buildLedger(customer, invoices, receipts, invoiceTotal, ledgerWindow);

  const cellBase = { padding: "6px 8px", fontSize: 12, borderBottom: `1px solid ${hairline}` };
  const BalTag = ({ v }) => (
    <span style={{ fontSize: 9, fontWeight: 700, color: v >= 0 ? success : danger, marginLeft: 3 }}>
      {v >= 0 ? "DR" : "CR"}
    </span>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <button onClick={onBack} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium" style={{ color: inkSoft }}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 26, fontWeight: 600 }}>{customer.name}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setPreview(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }} title="Preview / print this ledger">
            <Eye size={15} />
          </button>
          <button onClick={() => onEdit(customer)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
            <Edit2 size={15} /> Edit
          </button>
        </div>
      </div>

      {/* Create straight from the ledger, with this customer pre-selected. */}
      {(onNewInvoice || onNewReceipt) && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {onNewInvoice && (
            <button onClick={() => onNewInvoice(customer)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
              <Plus size={15} /> New Invoice
            </button>
          )}
          {onNewReceipt && (
            <button onClick={() => onNewReceipt(customer)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: thread, color: ink }}>
              <IndianRupee size={15} /> Add Receipt
            </button>
          )}
        </div>
      )}

      <Section title="Contact">
        <div className="space-y-1.5 text-sm">
          {(customer.phone1 || customer.phone2) && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>Phone</span>
              <span style={{ color: ink }}>{[customer.phone1, customer.phone2].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {customer.email && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>Email</span>
              <span style={{ color: ink }}>{customer.email}</span>
            </div>
          )}
          {customer.address && (
            <div className="flex justify-between gap-4">
              <span style={{ color: muted }}>Address</span>
              <span style={{ color: ink, textAlign: "right" }}>{customer.address}</span>
            </div>
          )}
          {!customer.phone1 && !customer.phone2 && !customer.email && !customer.address && (
            <div style={{ color: muted }}>No contact details.</div>
          )}
        </div>
      </Section>

      {/* stat boxes, like the real ledger header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label: "Opening", value: Math.abs(opening), tag: opening >= 0 ? "DR" : "CR", color: ink },
          { label: "Total Debit", value: totalDebit, color: success },
          { label: "Total Credit", value: totalCredit, color: danger },
          { label: "Closing", value: Math.abs(closing), tag: closing >= 0 ? "DR" : "CR", color: closing >= 0 ? success : danger },
        ].map((b) => (
          <div key={b.label} className="rounded-lg px-3 py-2" style={{ background: card, border: `1px solid ${hairline}` }}>
            <div style={{ color: muted, fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase" }}>{b.label}</div>
            <div style={{ color: b.color, fontWeight: 700, fontSize: 15, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
              {fmtMoney(b.value)}{b.tag ? <span style={{ fontSize: 9, marginLeft: 3 }}>{b.tag}</span> : null}
            </div>
          </div>
        ))}
      </div>

      {/* T-format ledger */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: card, border: `1px solid ${hairline}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr style={{ background: paper }}>
                <th style={{ ...cellBase, textAlign: "left", color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>DATE</th>
                <th style={{ ...cellBase, textAlign: "left", color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>DESCRIPTION</th>
                <th style={{ ...cellBase, textAlign: "right", color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>DEBIT (DR)</th>
                <th style={{ ...cellBase, textAlign: "right", color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>CREDIT (CR)</th>
                <th style={{ ...cellBase, textAlign: "right", color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>BALANCE</th>
              </tr>
            </thead>
            <tbody>
              {/* opening row */}
              <tr style={{ background: "#F2F0FB" }}>
                <td style={{ ...cellBase, color: muted }}>—</td>
                <td style={{ ...cellBase, fontWeight: 600, color: ink }}>{openingLabel}</td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {customer.openingBalanceType !== "Cr" && Number(customer.openingBalance) ? fmtMoney(customer.openingBalance) : "—"}
                </td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {customer.openingBalanceType === "Cr" && Number(customer.openingBalance) ? fmtMoney(customer.openingBalance) : "—"}
                </td>
                <td style={{ ...cellBase, textAlign: "right", fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
                  {fmtMoney(Math.abs(opening))}<BalTag v={opening} />
                </td>
              </tr>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...cellBase, textAlign: "center", color: muted, padding: "24px 8px" }}>
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                entries.map((e, i) => (
                  <tr
                    key={i}
                    onClick={e.invoice ? () => onOpenInvoice(e.invoice) : e.receipt && onOpenReceipt ? () => onOpenReceipt(e.receipt) : undefined}
                    style={{ cursor: e.invoice || (e.receipt && onOpenReceipt) ? "pointer" : "default" }}
                  >
                    <td style={{ ...cellBase, whiteSpace: "nowrap", fontFamily: "'IBM Plex Mono', monospace", color: muted }}>{fmtDate(e.date)}</td>
                    <td style={{ ...cellBase, fontWeight: 600, color: e.invoice || e.receipt ? inkSoft : ink }}>{e.description}</td>
                    <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{e.debit > 0 ? fmtMoney(e.debit) : "—"}</td>
                    <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{e.credit > 0 ? fmtMoney(e.credit) : "—"}</td>
                    <td style={{ ...cellBase, textAlign: "right", fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
                      {fmtMoney(Math.abs(e.balance))}<BalTag v={e.balance} />
                    </td>
                  </tr>
                ))
              )}
              {/* closing row */}
              <tr style={{ background: paper, fontWeight: 700 }}>
                <td colSpan={2} style={{ ...cellBase, textAlign: "right", borderBottom: "none" }}>Closing Balance</td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: "none" }}>{fmtMoney(totalDebit)}</td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: "none" }}>{fmtMoney(totalCredit)}</td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap", borderBottom: "none" }}>
                  {fmtMoney(Math.abs(closing))}<BalTag v={closing} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {preview && (
        <>
          <CustomerLedgersPrint
            customers={[customer]}
            invoices={invoices}
            receipts={receipts}
            invoiceTotal={invoiceTotal}
            ledgerWindow={ledgerWindow}
          />
          <CustomerLedgersPreview
            customers={[customer]}
            invoices={invoices}
            receipts={receipts}
            invoiceTotal={invoiceTotal}
            ledgerWindow={ledgerWindow}
            onClose={() => setPreview(false)}
          />
        </>
      )}
    </div>
  );
}

// Vendor equivalent of LedgerBlock — same print styling, but built on
// buildVendorLedger's flipped Dr/Cr convention (positive = Cr/payable).
function VendorLedgerBlock({ vendor, purchases, payments, ledgerWindow = {} }) {
  const th = (align) => ({ border: "1px solid #333", padding: "2px 5px", textAlign: align, fontWeight: 700, background: "#f2f2f2", fontSize: 9.5, lineHeight: 1.15 });
  const td = (align) => ({ border: "1px solid #333", padding: "2px 5px", textAlign: align, fontSize: 9.5, lineHeight: 1.15 });
  const led = buildVendorLedger(vendor, purchases, payments, ledgerWindow);
  const phones = [vendor.phone1, vendor.phone2].filter(Boolean).join(" · ");
  const period = ledgerWindow.from || ledgerWindow.to
    ? `${ledgerWindow.from ? fmtDate(ledgerWindow.from) : "Beginning"} to ${ledgerWindow.to ? fmtDate(ledgerWindow.to) : fmtDate(todayISO())}`
    : `As on ${fmtDate(todayISO())}`;
  return (
    <div style={{ breakInside: "avoid", pageBreakInside: "avoid", marginBottom: 16 }}>
      <div style={{ marginBottom: 3 }}>
        <span style={{ fontWeight: 700, fontSize: 12 }}>{vendor.name}</span>
        {phones ? <span style={{ fontSize: 9.5, color: "#000", marginLeft: 6 }}>{phones}</span> : null}
      </div>
      <div style={{ fontSize: 9, color: "#000", marginBottom: 3 }}>Vendor Ledger · {period}</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th("left")}>Date</th>
            <th style={th("left")}>Description</th>
            <th style={th("right")}>Debit (Dr)</th>
            <th style={th("right")}>Credit (Cr)</th>
            <th style={th("right")}>Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={td("left")}>—</td>
            <td style={{ ...td("left"), fontWeight: 600 }}>Opening Balance</td>
            <td style={td("right")}>{led.opening < 0 ? fmtMoney(Math.abs(led.opening)) : "—"}</td>
            <td style={td("right")}>{led.opening > 0 ? fmtMoney(led.opening) : "—"}</td>
            <td style={{ ...td("right"), fontWeight: 600, whiteSpace: "nowrap" }}>{fmtMoney(Math.abs(led.opening))} {led.opening >= 0 ? "CR" : "DR"}</td>
          </tr>
          {led.entries.map((e, i) => (
            <tr key={i}>
              <td style={{ ...td("left"), whiteSpace: "nowrap" }}>{fmtDate(e.date)}</td>
              <td style={td("left")}>{e.description}</td>
              <td style={td("right")}>{e.debit > 0 ? fmtMoney(e.debit) : "—"}</td>
              <td style={td("right")}>{e.credit > 0 ? fmtMoney(e.credit) : "—"}</td>
              <td style={{ ...td("right"), fontWeight: 600, whiteSpace: "nowrap" }}>{fmtMoney(Math.abs(e.balance))} {e.balance >= 0 ? "CR" : "DR"}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 700 }}>
            <td colSpan={2} style={{ ...td("right"), background: "#f8f8f8" }}>Closing Balance</td>
            <td style={{ ...td("right"), background: "#f8f8f8" }}>{fmtMoney(led.totalDebit)}</td>
            <td style={{ ...td("right"), background: "#f8f8f8" }}>{fmtMoney(led.totalCredit)}</td>
            <td style={{ ...td("right"), background: "#f8f8f8", whiteSpace: "nowrap" }}>{fmtMoney(Math.abs(led.closing))} {led.closing >= 0 ? "CR" : "DR"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function VendorLedgersFlow({ vendors, purchases, payments, ledgerWindow }) {
  return (
    <div style={{ padding: "18px 22px", columnCount: 2, columnGap: 24, fontFamily: "'Inter', sans-serif", color: "#111" }}>
      {vendors.map((v) => (
        <VendorLedgerBlock
          key={v.id}
          vendor={v}
          purchases={purchases.filter((p) => p.vendorId === v.id)}
          payments={payments.filter((p) => p.vendorId === v.id)}
          ledgerWindow={ledgerWindow}
        />
      ))}
    </div>
  );
}

function VendorLedgersPrint({ vendors, purchases, payments, ledgerWindow }) {
  return (
    <div className="print-area packing-print" style={{ fontFamily: "'Inter', sans-serif", color: "#111" }}>
      <VendorLedgersFlow vendors={vendors} purchases={purchases} payments={payments} ledgerWindow={ledgerWindow} />
    </div>
  );
}

function VendorLedgersPreview({ vendors, purchases, payments, ledgerWindow, selectionCount = 0, onClose }) {
  return (
    <PrintPreviewOverlay
      title={vendors.length === 1 ? `${vendors[0].name} — Ledger` : "Vendor Ledgers"}
      filename={vendors.length === 1 ? `${vendors[0].name} Ledger` : "Vendor Ledgers"}
      subtitle={`landscape, 2 columns · ${vendors.length} vendor${vendors.length !== 1 ? "s" : ""}${selectionCount > 0 ? " · selected only" : ""}`}
      onClose={onClose}
    >
      {vendors.length === 0 ? (
        <div style={{ textAlign: "center", color: "#B9C2D6", fontSize: 14, padding: "48px 0" }}>No vendors to show.</div>
      ) : (
        <PaperSheet landscape>
          <VendorLedgersFlow vendors={vendors} purchases={purchases} payments={payments} ledgerWindow={ledgerWindow} />
        </PaperSheet>
      )}
    </PrintPreviewOverlay>
  );
}

function VendorDetailView({ vendor, purchases, payments = [], onBack, onSave, ledgerWindow = {}, onOpenPurchase, onOpenPayment, onNewPurchase, onNewPayment }) {
  const [editModal, setEditModal] = useState(null); // local edit-modal state, mirrors VendorsView's
  const [preview, setPreview] = useState(false);

  if (!vendor) {
    return (
      <div className="text-center py-16">
        <p style={{ color: muted, fontSize: 14 }}>Vendor not found.</p>
        <button onClick={onBack} className="mt-3 px-4 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: inkSoft }}>
          Back to list
        </button>
      </div>
    );
  }

  const { opening, openingLabel, entries, totalDebit, totalCredit, closing } = buildVendorLedger(vendor, purchases, payments, ledgerWindow);

  const cellBase = { padding: "6px 8px", fontSize: 12, borderBottom: `1px solid ${hairline}` };
  // Vendors are creditors: positive balance = Cr (payable) — the opposite tag
  // sense from the customer ledger's Dr(receivable)-positive convention.
  const BalTag = ({ v }) => (
    <span style={{ fontSize: 9, fontWeight: 700, color: v >= 0 ? danger : success, marginLeft: 3 }}>
      {v >= 0 ? "CR" : "DR"}
    </span>
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <button onClick={onBack} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium" style={{ color: inkSoft }}>
          <ArrowLeft size={16} /> Back
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 26, fontWeight: 600 }}>{vendor.name}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setPreview(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }} title="Preview / print this ledger">
            <Eye size={15} />
          </button>
          <button onClick={() => setEditModal(vendor)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
            <Edit2 size={15} /> Edit
          </button>
        </div>
      </div>

      {/* Create straight from the ledger, with this vendor pre-selected. */}
      {(onNewPurchase || onNewPayment) && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {onNewPurchase && (
            <button onClick={() => onNewPurchase(vendor)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
              <Plus size={15} /> New Purchase
            </button>
          )}
          {onNewPayment && (
            <button onClick={() => onNewPayment(vendor)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: thread, color: ink }}>
              <IndianRupee size={15} /> Add Payment
            </button>
          )}
        </div>
      )}

      <Section title="Contact">
        <div className="space-y-1.5 text-sm">
          {(vendor.phone1 || vendor.phone2) && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>Phone</span>
              <span style={{ color: ink }}>{[vendor.phone1, vendor.phone2].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {vendor.email && (
            <div className="flex justify-between">
              <span style={{ color: muted }}>Email</span>
              <span style={{ color: ink }}>{vendor.email}</span>
            </div>
          )}
          {vendor.address && (
            <div className="flex justify-between gap-4">
              <span style={{ color: muted }}>Address</span>
              <span style={{ color: ink, textAlign: "right" }}>{vendor.address}</span>
            </div>
          )}
          {!vendor.phone1 && !vendor.phone2 && !vendor.email && !vendor.address && (
            <div style={{ color: muted }}>No contact details.</div>
          )}
        </div>
      </Section>

      {/* stat boxes, like the real ledger header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { label: "Opening", value: Math.abs(opening), tag: opening >= 0 ? "CR" : "DR", color: ink },
          { label: "Total Debit", value: totalDebit, color: success },
          { label: "Total Credit", value: totalCredit, color: danger },
          { label: "Closing", value: Math.abs(closing), tag: closing >= 0 ? "CR" : "DR", color: closing >= 0 ? danger : success },
        ].map((b) => (
          <div key={b.label} className="rounded-lg px-3 py-2" style={{ background: card, border: `1px solid ${hairline}` }}>
            <div style={{ color: muted, fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase" }}>{b.label}</div>
            <div style={{ color: b.color, fontWeight: 700, fontSize: 15, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
              {fmtMoney(b.value)}{b.tag ? <span style={{ fontSize: 9, marginLeft: 3 }}>{b.tag}</span> : null}
            </div>
          </div>
        ))}
      </div>

      {/* T-format ledger */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: card, border: `1px solid ${hairline}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr style={{ background: paper }}>
                <th style={{ ...cellBase, textAlign: "left", color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>DATE</th>
                <th style={{ ...cellBase, textAlign: "left", color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>DESCRIPTION</th>
                <th style={{ ...cellBase, textAlign: "right", color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>DEBIT (DR)</th>
                <th style={{ ...cellBase, textAlign: "right", color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>CREDIT (CR)</th>
                <th style={{ ...cellBase, textAlign: "right", color: muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em" }}>BALANCE</th>
              </tr>
            </thead>
            <tbody>
              {/* opening row */}
              <tr style={{ background: "#F2F0FB" }}>
                <td style={{ ...cellBase, color: muted }}>—</td>
                <td style={{ ...cellBase, fontWeight: 600, color: ink }}>{openingLabel}</td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {vendor.openingBalanceType === "Dr" && Number(vendor.openingBalance) ? fmtMoney(vendor.openingBalance) : "—"}
                </td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {vendor.openingBalanceType !== "Dr" && Number(vendor.openingBalance) ? fmtMoney(vendor.openingBalance) : "—"}
                </td>
                <td style={{ ...cellBase, textAlign: "right", fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
                  {fmtMoney(Math.abs(opening))}<BalTag v={opening} />
                </td>
              </tr>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...cellBase, textAlign: "center", color: muted, padding: "24px 8px" }}>
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                entries.map((e, i) => {
                  const openRow = e.purchase && onOpenPurchase ? () => onOpenPurchase(e.purchase)
                    : e.payment && onOpenPayment ? () => onOpenPayment(e.payment) : undefined;
                  return (
                  <tr
                    key={i}
                    onClick={openRow}
                    style={{ cursor: openRow ? "pointer" : "default" }}
                    title={openRow ? (e.purchase ? "Open this purchase bill" : "Edit this payment") : undefined}
                  >
                    <td style={{ ...cellBase, whiteSpace: "nowrap", fontFamily: "'IBM Plex Mono', monospace", color: muted }}>{fmtDate(e.date)}</td>
                    <td style={{ ...cellBase, fontWeight: 600, color: (e.purchase || e.payment) ? inkSoft : ink }}>{e.description}</td>
                    <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{e.debit > 0 ? fmtMoney(e.debit) : "—"}</td>
                    <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{e.credit > 0 ? fmtMoney(e.credit) : "—"}</td>
                    <td style={{ ...cellBase, textAlign: "right", fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>
                      {fmtMoney(Math.abs(e.balance))}<BalTag v={e.balance} />
                    </td>
                  </tr>
                  );
                })
              )}
              {/* closing row */}
              <tr style={{ background: paper, fontWeight: 700 }}>
                <td colSpan={2} style={{ ...cellBase, textAlign: "right", borderBottom: "none" }}>Closing Balance</td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: "none" }}>{fmtMoney(totalDebit)}</td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: "none" }}>{fmtMoney(totalCredit)}</td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap", borderBottom: "none" }}>
                  {fmtMoney(Math.abs(closing))}<BalTag v={closing} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {editModal && (
        <VendorModal
          value={editModal}
          onClose={() => setEditModal(null)}
          onSave={(v) => { if (onSave(v)) setEditModal(null); }}
        />
      )}

      {preview && (
        <>
          <VendorLedgersPrint
            vendors={[vendor]}
            purchases={purchases}
            payments={payments}
            ledgerWindow={ledgerWindow}
          />
          <VendorLedgersPreview
            vendors={[vendor]}
            purchases={purchases}
            payments={payments}
            ledgerWindow={ledgerWindow}
            onClose={() => setPreview(false)}
          />
        </>
      )}
    </div>
  );
}


function CustomerModal({ value, setValue, onSave, onClose, editing = false }) {
  const set = (field) => (e) => setValue((v) => ({ ...v, [field]: e.target.value }));
  const hasShip = !!(value.shipAddress || value.shipCity || value.shipState || value.shipPin || value.transporter);
  // Opens expanded when there's already an address, so editing doesn't hide it.
  const [showShip, setShowShip] = useState(hasShip);
  const inputCls = "flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-sm outline-none";
  const inputStyle = { border: `1px solid ${hairline}`, color: ink, background: "#fff" };
  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8 overflow-y-auto" style={{ background: "rgba(30,42,68,0.45)", zIndex: 50 }}>
      <div className="w-full max-w-sm rounded-xl p-5 my-auto" style={{ background: "#fff" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>{editing ? "Edit Customer" : "New Customer"}</h3>
          <button onClick={onClose}><X size={18} color={muted} /></button>
        </div>
        {/* Cancel / Save side by side at the top, like the reference app */}
        <div className="flex gap-2 mb-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg font-semibold text-sm" style={{ border: `1px solid ${hairline}`, color: muted, background: "#fff" }}>
            Cancel
          </button>
          <button onClick={onSave} className="flex-1 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2" style={{ background: thread, color: ink }}>
            <Check size={16} /> {editing ? "Save Changes" : "Save"}
          </button>
        </div>
        <div className="space-y-2.5">
          <InlineRow label="Name">
            <input autoFocus value={value.name} onChange={set("name")} className={inputCls} style={inputStyle} />
          </InlineRow>
          <InlineRow label="Address">
            <input value={value.address} onChange={set("address")} className={inputCls} style={inputStyle} />
          </InlineRow>
          <InlineRow label="Phone 1">
            <input inputMode="tel" value={value.phone1} onChange={set("phone1")} className={inputCls} style={inputStyle} />
          </InlineRow>
          <InlineRow label="Phone 2">
            <input inputMode="tel" value={value.phone2} onChange={set("phone2")} className={inputCls} style={inputStyle} />
          </InlineRow>
          <InlineRow label="Email">
            <input type="email" value={value.email} onChange={set("email")} className={inputCls} style={inputStyle} />
          </InlineRow>
          <InlineRow label="Op. Balance">
            <input type="number" inputMode="decimal" value={value.openingBalance} onChange={set("openingBalance")} className={inputCls} style={inputStyle} />
            <div className="flex gap-1" style={{ flexShrink: 0 }}>
              {["Dr", "Cr"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setValue((v) => ({ ...v, openingBalanceType: t }))}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold"
                  style={{
                    background: value.openingBalanceType === t ? ink : "#fff",
                    color: value.openingBalanceType === t ? "#fff" : muted,
                    border: `1px solid ${value.openingBalanceType === t ? ink : hairline}`,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </InlineRow>
          <InlineRow label="As On">
            <DateField value={value.openingBalanceDate} onChange={(v) => setValue((prev) => ({ ...prev, openingBalanceDate: v }))} className={inputCls} style={inputStyle} />
          </InlineRow>
        </div>

        {/* Shipping address — kept collapsed by default so it doesn't crowd
            the common case, and only needed for parties you actually ship to. */}
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${hairline}` }}>
          {!showShip ? (
            <button
              type="button"
              onClick={() => setShowShip(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold w-full justify-center"
              style={{ border: `1px dashed ${hairline}`, color: hasShip ? ink : muted, background: "#fff" }}
            >
              <Plus size={15} /> {hasShip ? "Edit Shipping Address" : "Add Shipping Address"}
              {hasShip && <span style={{ color: success, fontSize: 10, fontWeight: 700 }}>SET</span>}
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: inkSoft, fontSize: 12.5, fontWeight: 700 }}>Shipping Address</span>
                <button type="button" onClick={() => setShowShip(false)} style={{ color: muted, fontSize: 12, fontWeight: 600 }}>Hide</button>
              </div>
              <div className="space-y-2.5">
                <InlineRow label="Ship To">
                  <input value={value.shipName || ""} onChange={set("shipName")} placeholder="defaults to customer name" className={inputCls} style={inputStyle} />
                </InlineRow>
                <InlineRow label="Address">
                  <textarea value={value.shipAddress || ""} onChange={set("shipAddress")} rows={4} placeholder="flat / building / street — press Enter to start a new printed line" className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
                </InlineRow>
                <InlineRow label="City">
                  <input value={value.shipCity || ""} onChange={set("shipCity")} className={inputCls} style={inputStyle} />
                </InlineRow>
                <InlineRow label="State">
                  <input value={value.shipState || ""} onChange={set("shipState")} className={inputCls} style={inputStyle} />
                </InlineRow>
                <InlineRow label="PIN">
                  <input inputMode="numeric" value={value.shipPin || ""} onChange={set("shipPin")} className={inputCls} style={inputStyle} />
                </InlineRow>
                <InlineRow label="Phone">
                  <input inputMode="tel" value={value.shipPhone || ""} onChange={set("shipPhone")} placeholder="defaults to Phone 1" className={inputCls} style={inputStyle} />
                </InlineRow>
                <InlineRow label="Transport">
                  <input value={value.transporter || ""} onChange={set("transporter")} placeholder="transporter name" className={inputCls} style={inputStyle} />
                </InlineRow>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ================= INVOICE PREVIEW ================
function InvoicePreviewModal({ invoice, customer, onClose }) {
  const layout = packingLayout(invoice);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [includeQr, setIncludeQr] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setQrDataUrl(null);
    (async () => {
      try {
        const { text } = encodeInvoiceQr(invoice, customer?.name || "");
        const QRCode = await import("qrcode");
        const url = await QRCode.toDataURL(text, { width: 240, margin: 4, errorCorrectionLevel: "M" });
        if (!cancelled) setQrDataUrl(url);
      } catch (e) {
        // Print/PDF still work fine without the QR if generation fails.
      }
    })();
    return () => { cancelled = true; };
  }, [invoice, customer]);
  const sheetProps = (sheetPages, sIdx) => ({
    sheetPages,
    sIdx,
    pages: layout.pages,
    invoice,
    customer,
    totalQty: layout.totalQty,
    totalRows: layout.rows.length,
    itemsTotal: layout.itemsTotal,
    expenses: layout.expenses,
    expenseTotal: layout.expenseTotal,
    grandTotal: layout.grandTotal,
    qrDataUrl: includeQr ? qrDataUrl : null,
  });
  return (
    <>
      <PrintPreviewOverlay
        title={invoice.invoiceNo || "Draft"}
        subtitle={`landscape, 2 pages per sheet · ${layout.pages.length} page${layout.pages.length !== 1 ? "s" : ""}`}
        onClose={onClose}
      >
        {qrDataUrl && (
          <label className="no-print flex items-center gap-2 mb-3 px-1" style={{ color: "#B9C2D6", fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={includeQr} onChange={(e) => setIncludeQr(e.target.checked)} style={{ width: 15, height: 15, accentColor: thread }} />
            Print with QR code
          </label>
        )}
        {layout.sheets.map((sheetPages, sIdx) => (
          <PaperSheet key={sIdx} landscape>
            <PackingSheet {...sheetProps(sheetPages, sIdx)} />
          </PaperSheet>
        ))}
      </PrintPreviewOverlay>
      {/* hidden print copy so the Print button works directly (drafts too) */}
      <div className="print-area packing-print" style={{ fontFamily: "'Inter', sans-serif", color: "#111" }}>
        {layout.sheets.map((sheetPages, sIdx) => (
          <div key={sIdx} className="print-sheet">
            <PackingSheet {...sheetProps(sheetPages, sIdx)} />
          </div>
        ))}
      </div>
    </>
  );
}

// ================= PRINT ================
function PrintModal({ invoice, customer, onClose }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sharePayload, setSharePayload] = useState(null);
  const doSavePdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await generatePdfFromPrintAreas(invoice.invoiceNo);
    } catch (e) {
      console.error("PDF generation failed", e);
      alert("Could not generate the PDF. Please try the Print button instead.");
    } finally {
      setPdfBusy(false);
    }
  };
  // Two-tap Share — see preparePdfForShare's comment for why (iOS Safari
  // requires navigator.share() to be called immediately within the tap
  // that triggered it, and building the PDF takes too long for that).
  const doSharePdf = async () => {
    if (pdfBusy) return;
    if (sharePayload) {
      try {
        await navigator.share({ files: [sharePayload.file], title: sharePayload.fname });
      } catch (e) {
        if (e?.name !== "AbortError") downloadBlob(sharePayload.file, sharePayload.fname);
      } finally {
        setSharePayload(null);
      }
      return;
    }
    setPdfBusy(true);
    try {
      const prepared = await preparePdfForShare(invoice.invoiceNo);
      if (!prepared) return;
      if (canShareFiles() && navigator.canShare({ files: [prepared.file] })) {
        setSharePayload(prepared);
      } else {
        prepared.pdf.save(prepared.fname);
      }
    } catch (e) {
      console.error("PDF share failed", e);
      alert("Could not prepare the PDF to share. Please try Save PDF instead.");
    } finally {
      setPdfBusy(false);
    }
  };
  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4" style={{ background: "rgba(30,42,68,0.45)", zIndex: 50 }}>
      <div className="w-full max-w-sm rounded-xl p-6 text-center" style={{ background: "#fff" }}>
        <Printer size={26} color={ink} className="mx-auto mb-3" />
        <p style={{ color: ink, fontWeight: 600, marginBottom: 4 }}>Print {invoice.invoiceNo}</p>
        <p style={{ color: muted, fontSize: 13, marginBottom: 16 }}>Opens your browser's print dialog, or save/share a PDF directly.</p>
        <div className="flex gap-2 mb-2">
          <button onClick={() => printDoc(invoice.invoiceNo)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: thread, color: ink }}>Print</button>
          <button onClick={doSavePdf} disabled={pdfBusy} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: ink, opacity: pdfBusy ? 0.6 : 1 }}>{pdfBusy ? "…" : "Save PDF"}</button>
        </div>
        <div className="flex gap-2">
          {canShareFiles() && (
            <button onClick={doSharePdf} disabled={pdfBusy} className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5" style={{ border: `1px solid ${hairline}`, background: sharePayload ? thread : "transparent", color: ink, opacity: pdfBusy ? 0.6 : 1 }}>
              <Share2 size={14} /> {pdfBusy ? "…" : sharePayload ? "Tap to Share" : "Share"}
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// Shared packing-list computation: pages of rows + totals for one invoice.
function packingLayout(invoice) {
  const rows = packingRows(invoice.items);
  const pages = paginateRows(rows);
  const sheets = chunkSheets(pages);
  const expenses = (invoice.expenses || []).filter((e) => Number(e.amount) !== 0);
  const expenseTotal = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  // Coerce explicitly: a cancelled row carries "" for qty/rate so the printed
  // cell is blank, and "" would otherwise turn this sum into string
  // concatenation rather than addition.
  const totalQty = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const itemsTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  return { rows, pages, sheets, expenses, expenseTotal, totalQty, itemsTotal, grandTotal: itemsTotal + expenseTotal };
}

// One physical landscape sheet (two logical pages side by side). Used by both
// the actual print output and the on-screen paper preview.
function PackingSheet({ sheetPages, sIdx, pages, invoice, customer, totalQty, totalRows, itemsTotal, expenses, expenseTotal, grandTotal, qrDataUrl }) {
  // Grid lines: a real 1px border (sub-pixel widths like 0.5px round to zero
  // and vanish in both preview and print) in solid black, so the rules read
  // clearly on the printed page. Cell padding is the original height — the
  // extra breathing room lives in the header margins below, not in the rows.
  const thStyle = (align) => ({ border: "1px solid #000", padding: "4px 6px", textAlign: align, fontWeight: 700, background: "#f2f2f2" });
  const tdStyle = (align) => ({ border: "1px solid #000", padding: "3px 6px", textAlign: align });
  // Two logical pages side by side on one physical landscape sheet. Floats,
  // not flex: mobile Safari/Chrome (WebKit) print engines have a long-standing
  // bug where flex children in a printed page can each get promoted onto
  // their own physical page instead of staying side by side, which both
  // wastes paper and leaves most of each page blank. Floats paginate
  // reliably across engines.
  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
          {sheetPages.map((pageRows, colIdx) => {
            const pageIndex = sIdx * 2 + colIdx;
            const isFirstPage = pageIndex === 0;
            const isLastPage = pageIndex === pages.length - 1;
            return (
              <div
                key={colIdx}
                style={{
                  float: "left",
                  width: "50%",
                  boxSizing: "border-box",
                  padding: "14px 18px",
                  borderRight: colIdx === 0 ? "1px dashed #000" : "none",
                  fontSize: 11,
                }}
              >
                {isFirstPage ? (
                  <>
                    <div style={{ textAlign: "center", fontWeight: 700, fontSize: 14, letterSpacing: "0.05em", marginTop: 30, marginBottom: 10 }}>
                      PROFORMA PACKING LIST
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{customer?.name || "—"}</div>
                        {customer?.address && <div style={{ fontSize: 11, color: "#000" }}>{customer.address}</div>}
                      </div>
                      <div style={{ textAlign: "right", fontSize: 12 }}>
                        <div style={{ fontWeight: 700 }}>{invoice.invoiceNo}</div>
                        <div>DATE: {fmtDate(invoice.date)}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "right", fontSize: 11, marginTop: 30, marginBottom: 8, color: "#000" }}>
                    {invoice.invoiceNo} | {fmtDate(invoice.date)}
                  </div>
                )}

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={thStyle("center")}>SN</th>
                      <th style={thStyle("right")}>Qty</th>
                      <th style={thStyle("left")}>Size</th>
                      <th style={thStyle("right")}>Total Qty(uom)</th>
                      <th style={thStyle("right")}>Rate</th>
                      <th style={thStyle("right")}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={r.sn} style={r.cancelled ? { color: "#777" } : undefined}>
                        <td style={tdStyle("center")}>{r.sn}</td>
                        <td style={tdStyle("right")}>{r.qty}</td>
                        <td style={{ ...tdStyle("left"), whiteSpace: "nowrap", fontWeight: r.cancelled ? 700 : undefined }}>{r.sizeDisplay}</td>
                        <td style={{ ...tdStyle("right"), whiteSpace: "nowrap" }}>{r.totalQtyDisplay}</td>
                        <td style={tdStyle("right")}>{r.cancelled ? "" : Number(r.rate).toFixed(1)}</td>
                        <td style={tdStyle("right")}>{r.cancelled ? "" : fmtNum(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {pageRows.length > 0 && (
                    <tfoot>
                      <tr>
                        <td style={{ padding: "4px 6px" }}></td>
                        <td style={{ padding: "4px 6px", fontWeight: 700, textAlign: "right" }}>
                          {pageRows.reduce((s, r) => s + (Number(r.qty) || 0), 0)}
                        </td>
                        <td colSpan={2}></td>
                        <td style={{ padding: "4px 6px", fontWeight: 700, textAlign: "right" }}>
                          Total ({pageIndex + 1}/{pages.length})
                        </td>
                        <td style={{ padding: "4px 6px", fontWeight: 700, textAlign: "right" }}>
                          {fmtNum(pageRows.reduce((s, r) => s + (Number(r.amount) || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>

                {!isLastPage && (
                  <div style={{ textAlign: "center", fontSize: 10, color: "#000", marginTop: 8 }}>
                    Page {pageIndex + 1}/{pages.length}
                  </div>
                )}

                {isLastPage && (
                  <div style={{ marginTop: 20, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #000", paddingTop: 6 }}>
                      <span>Sub-Total{totalRows ? ` (1-${totalRows})` : ""}: {totalQty} pcs</span>
                      <span>Rs. {fmtNum(itemsTotal)}</span>
                    </div>
                    {(expenses || []).map((e) => {
                      const amt = Number(e.amount) || 0;
                      const isAdd = amt >= 0;
                      return (
                        <div key={e.id} style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                          <span>{isAdd ? "Add" : "Less"}: {e.label || ""}</span>
                          <span>Rs. {fmtNum(Math.abs(amt))}</span>
                        </div>
                      );
                    })}
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: 4, borderTop: "1px solid #000", paddingTop: 4 }}>
                      <span>Grand total:</span>
                      <span>Rs. {fmtNum(grandTotal)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div>Remarks :</div>
                      </div>
                      {qrDataUrl && (
                        <div style={{ textAlign: "center", marginLeft: 12 }}>
                          <img src={qrDataUrl} alt="Invoice QR code" style={{ width: 90, height: 90, display: "block" }} />
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "center", fontSize: 10, color: "#000", marginTop: 16 }}>
                      Page {pageIndex + 1}/{pages.length}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {sheetPages.length === 1 && (
            <div style={{ float: "left", width: "50%", boxSizing: "border-box" }} />
          )}
    </div>
  );
}

// Picks the From address, previews the label, and hands off to the same
// print/share pipeline the invoice preview uses.
function ShippingLabelModal({ invoice, customer, shipFroms, onSaveFroms, onSaveShipping, onClose }) {
  const [fromId, setFromId] = useState(() => {
    try { return localStorage.getItem("textile-bill-lastfrom") || (shipFroms[0]?.id || ""); } catch { return shipFroms[0]?.id || ""; }
  });
  const [manageOpen, setManageOpen] = useState(shipFroms.length === 0);
  const [editOpen, setEditOpen] = useState(false);
  const from = shipFroms.find((f) => f.id === fromId) || shipFroms[0] || null;
  const ship = shipToOf(customer);

  useEffect(() => {
    if (from?.id) { try { localStorage.setItem("textile-bill-lastfrom", from.id); } catch {} }
  }, [from?.id]);

  return (
    <>
      <PrintPreviewOverlay
        title={`Shipping Label — ${invoice.invoiceNo}`}
        filename={`Shipping Label ${invoice.invoiceNo}`}
        subtitle="A4 landscape, 2 labels per sheet"
        onClose={onClose}
      >
        <div className="no-print mb-3 flex items-end gap-2 flex-wrap">
          <div style={{ minWidth: 200, flex: "1 1 auto" }}>
            <div style={{ color: "#B9C2D6", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>From address</div>
            <InlineSelect
              value={fromId}
              onChange={setFromId}
              options={shipFroms.length
                ? shipFroms.map((f) => ({ value: f.id, label: f.name }))
                : [{ value: "", label: "No from-addresses yet" }]}
              className="px-2.5 py-1.5 rounded-lg text-sm outline-none w-full"
              style={{ border: `1px solid ${hairline}`, color: ink, background: "#fff" }}
            />
          </div>
          <button
            onClick={() => setManageOpen(true)}
            className="px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "#fff", color: ink }}
          >
            Manage
          </button>
          {onSaveShipping && customer && (
            <button
              onClick={() => setEditOpen(true)}
              className="px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ background: "#fff", color: ink }}
            >
              {ship?.complete ? "Edit Ship-To Address" : "Add Ship-To Address"}
            </button>
          )}
        </div>

        {!ship?.complete && (
          <div className="no-print mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBF4E7", color: "#8A6416", fontSize: 12.5 }}>
            No shipping address saved for {customer?.name || "this customer"} — using their regular address. Tap “Add Ship-To Address” above for a complete label.
          </div>
        )}

        <PaperSheet landscape>
          <ShippingLabelSheet invoice={invoice} customer={customer} from={from} />
        </PaperSheet>
      </PrintPreviewOverlay>

      {/* Hidden copy that print / Save PDF / Share actually capture. */}
      <ShippingLabelPrint invoice={invoice} customer={customer} from={from} />

      {manageOpen && (
        <ShipFromManager
          shipFroms={shipFroms}
          onSave={(next, newId) => { onSaveFroms(next); if (newId) setFromId(newId); }}
          onClose={() => setManageOpen(false)}
        />
      )}

      {editOpen && (
        <ShipToEditModal
          customer={customer}
          onSave={(patch) => { onSaveShipping(customer.id, patch); setEditOpen(false); }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}

// Edits just the shipping-address fields on the invoice's customer, directly
// from the label screen — the same fields as the customer's own Edit screen,
// so nothing about the data shape changes, just where it can be entered from.
function ShipToEditModal({ customer, onSave, onClose }) {
  const [f, setF] = useState({
    shipName: customer.shipName || "",
    shipAddress: customer.shipAddress || "",
    shipCity: customer.shipCity || "",
    shipState: customer.shipState || "",
    shipPin: customer.shipPin || "",
    shipPhone: customer.shipPhone || "",
    transporter: customer.transporter || "",
  });
  const set = (field) => (e) => setF((p) => ({ ...p, [field]: e.target.value }));

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.55)", zIndex: 90 }}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: "#fff", maxHeight: "85vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>Ship-To Address</h3>
          <button onClick={onClose}><X size={18} color={muted} /></button>
        </div>
        <p style={{ color: muted, fontSize: 12, marginBottom: 12 }}>For {customer.name}. Saved to this customer, same as editing from the Customers tab.</p>
        <div className="space-y-2.5">
          <InlineRow label="Ship To">
            <input value={f.shipName} onChange={set("shipName")} placeholder="defaults to customer name" className={inputCls} style={inputStyle} />
          </InlineRow>
          <InlineRow label="Address">
            <textarea value={f.shipAddress} onChange={set("shipAddress")} rows={4} placeholder="flat / building / street — press Enter to start a new printed line" className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
          </InlineRow>
          <InlineRow label="City">
            <input value={f.shipCity} onChange={set("shipCity")} className={inputCls} style={inputStyle} />
          </InlineRow>
          <InlineRow label="State">
            <input value={f.shipState} onChange={set("shipState")} className={inputCls} style={inputStyle} />
          </InlineRow>
          <InlineRow label="PIN">
            <input inputMode="numeric" value={f.shipPin} onChange={set("shipPin")} className={inputCls} style={inputStyle} />
          </InlineRow>
          <InlineRow label="Phone">
            <input inputMode="tel" value={f.shipPhone} onChange={set("shipPhone")} placeholder="defaults to Phone 1" className={inputCls} style={inputStyle} />
          </InlineRow>
          <InlineRow label="Transport">
            <input value={f.transporter} onChange={set("transporter")} placeholder="transporter name" className={inputCls} style={inputStyle} />
          </InlineRow>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
          <button onClick={() => onSave(f)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1" style={{ background: thread, color: ink }}>
            <Check size={16} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

// Add / edit / remove the From addresses available to shipping labels.
function ShipFromManager({ shipFroms, onSave, onClose }) {
  const [editing, setEditing] = useState(null); // null | {} | existing
  const [pendingDelete, setPendingDelete] = useState(null);

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.55)", zIndex: 90 }}>
      <div className="w-full max-w-sm rounded-xl p-5" style={{ background: "#fff", maxHeight: "85vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>From Addresses</h3>
          <button onClick={onClose}><X size={18} color={muted} /></button>
        </div>

        {editing ? (
          <ShipFromForm
            value={editing}
            onCancel={() => setEditing(null)}
            onSave={(data) => {
              if (data.id) {
                onSave(shipFroms.map((f) => (f.id === data.id ? data : f)));
              } else {
                const withId = { ...data, id: uid() };
                onSave([...shipFroms, withId], withId.id);
              }
              setEditing(null);
            }}
          />
        ) : (
          <>
            {shipFroms.length === 0 && (
              <p style={{ color: muted, fontSize: 13, marginBottom: 12 }}>
                None yet. Add the address goods are dispatched from — you can keep several and pick one per label.
              </p>
            )}
            <div className="space-y-2 mb-3">
              {shipFroms.map((f) => (
                <div key={f.id} className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg" style={{ border: `1px solid ${hairline}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: ink, fontWeight: 600, fontSize: 13.5 }}>{f.name}</div>
                    <div style={{ color: muted, fontSize: 11.5, lineHeight: 1.4, whiteSpace: "pre-line" }}>{f.address}</div>
                  </div>
                  <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                    <button onClick={() => setEditing(f)} style={{ color: inkSoft, padding: 3 }} title="Edit"><Edit2 size={14} /></button>
                    {pendingDelete === f.id ? (
                      <button onClick={() => { onSave(shipFroms.filter((x) => x.id !== f.id)); setPendingDelete(null); }} className="text-xs font-bold" style={{ color: danger }}>Sure?</button>
                    ) : (
                      <button onClick={() => setPendingDelete(f.id)} style={{ color: danger, padding: 3 }} title="Delete"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setEditing({ name: "", address: "", phone: "" })}
              className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
              style={{ border: `1px dashed ${hairline}`, color: muted }}
            >
              <Plus size={15} /> Add From Address
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ShipFromForm({ value, onSave, onCancel }) {
  const [f, setF] = useState({ id: value.id, name: value.name || "", address: value.address || "", phone: value.phone || "" });
  const [error, setError] = useState("");
  return (
    <div>
      {error && <div style={{ background: dangerBg, color: danger, fontSize: 12.5, padding: "8px 10px", borderRadius: 8, marginBottom: 12 }}>{error}</div>}
      <div className="space-y-2.5">
        <InlineRow label="Name">
          <input value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} className={inputCls} style={inputStyle} autoFocus placeholder="business / branch name" />
        </InlineRow>
        <InlineRow label="Address">
          <textarea value={f.address} onChange={(e) => setF((p) => ({ ...p, address: e.target.value }))} rows={3} className={inputCls} style={{ ...inputStyle, resize: "vertical" }} placeholder="full address" />
        </InlineRow>
        <InlineRow label="Phone">
          <input inputMode="tel" value={f.phone} onChange={(e) => setF((p) => ({ ...p, phone: e.target.value }))} className={inputCls} style={inputStyle} />
        </InlineRow>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
        <button
          onClick={() => {
            if (!f.name.trim()) { setError("Enter a name."); return; }
            if (!f.address.trim()) { setError("Enter an address."); return; }
            onSave({ ...f, name: f.name.trim(), address: f.address.trim(), phone: f.phone.trim() });
          }}
          className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
          style={{ background: thread, color: ink }}
        >
          <Check size={16} /> Save
        </button>
      </div>
    </div>
  );
}

// ---------- shipping label ----------
// A hand-typed address is often one long comma-separated run ("flat, street,
// area, landmark, ..."), which prints as a single wide, hard-to-scan line.
// Breaking after every 2nd comma keeps each printed line to a natural
// address-line length regardless of how the person originally typed it.
function wrapAddressByCommas(text, perLine = 3) {
  const raw = String(text || "");
  // Pressing Enter in the address field is how the person controls exactly
  // where a line breaks on the printed label — that's honoured first. Only
  // when they haven't broken it up themselves (a single unbroken line) does
  // it fall back to wrapping automatically after every 2nd comma, so a
  // long address typed as one run still prints in readable chunks.
  const manualLines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (manualLines.length > 1) return manualLines;

  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const lines = [];
  for (let i = 0; i < parts.length; i += perLine) {
    lines.push(parts.slice(i, i + perLine).join(", "));
  }
  return lines;
}

// Resolves the address a courier needs. Falls back to the customer's own
// name/phone when the shipping-specific fields are blank, so a label is
// still usable for a party whose shipping address was never filled in.
function shipToOf(customer) {
  if (!customer) return null;
  const cityLine = [
    [customer.shipCity, customer.shipState].filter(Boolean).join(", "),
    customer.shipPin && `PIN ${customer.shipPin}`,
  ].filter(Boolean).join(" — ");
  const lines = [...wrapAddressByCommas(customer.shipAddress), cityLine]
    .filter((l) => l && String(l).trim());
  return {
    name: (customer.shipName || "").trim() || customer.name || "",
    lines: lines.length ? lines : [customer.address || ""].filter(Boolean),
    phone: (customer.shipPhone || "").trim() || customer.phone1 || "",
    complete: !!(customer.shipAddress || customer.shipCity || customer.shipState || customer.shipPin),
  };
}

// One A4-landscape sheet carrying a single label on the left half.
// Deliberately no barcode and no item lines — just who it's going to and
// who it's from.
function ShippingLabelSheet({ invoice, customer, from }) {
  const ship = shipToOf(customer);
  const labelCap = { fontSize: 13, letterSpacing: "0.08em", color: "#555", fontWeight: 700, marginBottom: 5 };
  const bigName = { fontSize: 20, fontWeight: 700, color: "#000", marginBottom: 5 };
  const addrLine = { fontSize: 17, color: "#111", lineHeight: 1.5 };

  return (
    // One label per sheet. The left half carries the label and the right half
    // is left blank, so the sheet still folds/cuts on the same centre line as
    // the other two-up documents without printing a duplicate.
    <div style={{ width: A4.landW, minHeight: A4.landH, background: "#fff", display: "flex", position: "relative" }}>
      <div style={{ width: "50%", boxSizing: "border-box", padding: "26px 30px", display: "flex", flexDirection: "column" }}>
        {/* Top margin before the label content starts, so it doesn't sit
            flush against the sheet edge. */}
        <div style={{ height: "4em" }} aria-hidden="true" />

        <div style={{ marginBottom: 18 }}>
          <div style={labelCap}>DELIVER TO</div>
          <div style={bigName}>
            {ship?.name || "—"}
            {ship?.phone && (
              <span style={{ fontSize: 17, fontWeight: 600 }}> (M-{ship.phone})</span>
            )}
          </div>
          {(ship?.lines || []).map((l, i) => (<div key={i} style={addrLine}>{l}</div>))}
        </div>

        {/* Three blank line-heights of separation, as requested — kept as its
            own spacer rather than folded into a margin so the gap is exact
            regardless of how many address lines DELIVER TO ends up with. */}
        <div style={{ height: "3em" }} aria-hidden="true" />

        <div>
          <div style={labelCap}>FROM</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#000", marginBottom: 4 }}>
            {from?.name || "—"}
            {from?.phone && <span style={{ fontSize: 16, fontWeight: 600 }}> (M-{from.phone})</span>}
          </div>
          {(from?.address || "").split("\n").filter(Boolean).map((l, i) => (
            <div key={i} style={{ fontSize: 16, color: "#222", lineHeight: 1.5 }}>{l}</div>
          ))}
        </div>
      </div>

      {/* Centre fold line kept so the sheet matches the other two-up prints. */}
      <div style={{ position: "absolute", left: "50%", top: 24, bottom: 24, borderLeft: "1px dashed #999" }} />
    </div>
  );
}

// Hidden copy that print / Save PDF / Share capture. Same sheet, wrapped in
// the print-area/print-sheet classes the print pipeline looks for — those
// are display:none on screen, which is why the preview renders the bare
// sheet above instead of reusing this.
function ShippingLabelPrint({ invoice, customer, from }) {
  return (
    <div className="print-area packing-print" style={{ fontFamily: "'Inter', sans-serif", color: "#111" }}>
      <div className="print-sheet">
        <ShippingLabelSheet invoice={invoice} customer={customer} from={from} />
      </div>
    </div>
  );
}

function PackingListPrint({ invoice, customer }) {
  const layout = packingLayout(invoice);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setQrDataUrl(null);
    (async () => {
      try {
        const { text } = encodeInvoiceQr(invoice, customer?.name || "");
        const QRCode = await import("qrcode");
        const url = await QRCode.toDataURL(text, { width: 240, margin: 4, errorCorrectionLevel: "M" });
        if (!cancelled) setQrDataUrl(url);
      } catch (e) {
        // Print/PDF still work fine without the QR if generation fails.
      }
    })();
    return () => { cancelled = true; };
  }, [invoice, customer]);
  return (
    <div className="print-area packing-print" style={{ fontFamily: "'Inter', sans-serif", color: "#111" }}>
      {layout.sheets.map((sheetPages, sIdx) => (
        <div
          key={sIdx}
          className="print-sheet"
        >
          <PackingSheet
            sheetPages={sheetPages}
            sIdx={sIdx}
            pages={layout.pages}
            invoice={invoice}
            customer={customer}
            totalQty={layout.totalQty}
            totalRows={layout.rows.length}
            itemsTotal={layout.itemsTotal}
            expenses={layout.expenses}
            expenseTotal={layout.expenseTotal}
            grandTotal={layout.grandTotal}
            qrDataUrl={qrDataUrl}
          />
        </div>
      ))}
    </div>
  );
}

// ================= REGISTER PRINT (multi-invoice) ================
function RegisterPrintModal({ onClose }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sharePayload, setSharePayload] = useState(null);
  const doSavePdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await generatePdfFromPrintAreas(`Sales Register ${todayISO()}`);
    } catch (e) {
      console.error("PDF generation failed", e);
      alert("Could not generate the PDF. Please try the Print button instead.");
    } finally {
      setPdfBusy(false);
    }
  };
  // Two-tap Share — see preparePdfForShare's comment for why (iOS Safari
  // requires navigator.share() to be called immediately within the tap
  // that triggered it, and building the PDF takes too long for that).
  const doSharePdf = async () => {
    if (pdfBusy) return;
    if (sharePayload) {
      try {
        await navigator.share({ files: [sharePayload.file], title: sharePayload.fname });
      } catch (e) {
        if (e?.name !== "AbortError") downloadBlob(sharePayload.file, sharePayload.fname);
      } finally {
        setSharePayload(null);
      }
      return;
    }
    setPdfBusy(true);
    try {
      const prepared = await preparePdfForShare(`Sales Register ${todayISO()}`);
      if (!prepared) return;
      if (canShareFiles() && navigator.canShare({ files: [prepared.file] })) {
        setSharePayload(prepared);
      } else {
        prepared.pdf.save(prepared.fname);
      }
    } catch (e) {
      console.error("PDF share failed", e);
      alert("Could not prepare the PDF to share. Please try Save PDF instead.");
    } finally {
      setPdfBusy(false);
    }
  };
  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4" style={{ background: "rgba(30,42,68,0.45)", zIndex: 50 }}>
      <div className="w-full max-w-sm rounded-xl p-6 text-center" style={{ background: "#fff" }}>
        <Printer size={26} color={ink} className="mx-auto mb-3" />
        <p style={{ color: ink, fontWeight: 600, marginBottom: 4 }}>Print Sales Invoices Register</p>
        <p style={{ color: muted, fontSize: 13, marginBottom: 16 }}>Prints the currently filtered list of invoices.</p>
        <div className="flex gap-2 mb-2">
          <button onClick={() => printDoc(`Sales Register ${todayISO()}`)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: thread, color: ink }}>Print</button>
          <button onClick={doSavePdf} disabled={pdfBusy} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: ink, opacity: pdfBusy ? 0.6 : 1 }}>{pdfBusy ? "…" : "Save PDF"}</button>
        </div>
        <div className="flex gap-2">
          {canShareFiles() && (
            <button onClick={doSharePdf} disabled={pdfBusy} className="flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5" style={{ border: `1px solid ${hairline}`, background: sharePayload ? thread : "transparent", color: ink, opacity: pdfBusy ? 0.6 : 1 }}>
              <Share2 size={14} /> {pdfBusy ? "…" : sharePayload ? "Tap to Share" : "Share"}
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ---- Landscape two-up register (matches the packing-list sheet system) ----
// Bumped up from the original 18/22 after real-print feedback showed a lot of
// unused space below the last row — same caveat as the packing-list row caps
// elsewhere in this file: this is an estimate, not pixel-verified (no browser
// in this environment to test against), so may need another round of tuning
// against actual printed output.
const REGISTER_FIRST_PAGE_ROWS = 26;
const REGISTER_OTHER_PAGE_ROWS = 30;

function registerLayout(invoices, customers, invoiceTotal, separateBySeries, dateFrom, dateTo) {
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const nameOf = (id) => customerById.get(id)?.name || "—";
  const groups = separateBySeries
    ? Array.from(new Set(invoices.map((i) => i.series))).map((sr) => ({
        title: `Series: ${sr}`,
        rows: invoices.filter((i) => i.series === sr),
      }))
    : [{ title: null, rows: invoices }];

  const pages = [];
  let firstOverall = true;
  const seriesTotals = [];
  for (const g of groups) {
    const displayRows = g.rows.map((inv, i) => ({
      sr: i + 1,
      date: inv.date,
      invoiceNo: inv.invoiceNo,
      customer: nameOf(inv.customerId),
      amount: invoiceTotal(inv),
      status: inv.status,
    }));
    seriesTotals.push({ title: g.title, total: displayRows.reduce((t, r) => t + r.amount, 0), count: displayRows.length });
    let i = 0;
    let firstOfGroup = true;
    while (i < displayRows.length || (firstOfGroup && displayRows.length === 0)) {
      const cap = firstOverall ? REGISTER_FIRST_PAGE_ROWS : REGISTER_OTHER_PAGE_ROWS;
      pages.push({
        groupTitle: firstOfGroup ? g.title : null,
        rows: displayRows.slice(i, i + cap),
        bigHeader: firstOverall,
      });
      i += cap;
      firstOverall = false;
      firstOfGroup = false;
    }
  }
  if (pages.length === 0) pages.push({ groupTitle: null, rows: [], bigHeader: true });
  pages.forEach((p, idx) => { p.index = idx; p.isLast = idx === pages.length - 1; });
  const grandTotal = invoices.reduce((t, inv) => t + invoiceTotal(inv), 0);
  const periodLabel = (dateFrom || dateTo)
    ? (dateFrom && dateTo
        ? `${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`
        : dateFrom
          ? `${fmtDate(dateFrom)} onwards`
          : `Up to ${fmtDate(dateTo)}`)
    : "All dates";
  return { pages, sheets: chunkSheets(pages), grandTotal, seriesTotals, count: invoices.length, periodLabel };
}

function RegisterHalfPage({ page, pagesCount, layout, separateBySeries }) {
  const th = (align) => ({ border: "1px solid #333", padding: "3px 6px", textAlign: align, fontWeight: 700, background: "#f2f2f2", fontSize: 10 });
  const td = (align) => ({ border: "1px solid #333", padding: "2px 6px", textAlign: align, fontSize: 10 });
  const pageTotal = page.rows.reduce((t, r) => t + r.amount, 0);
  return (
    <>
      {page.bigHeader ? (
        <div style={{ marginTop: 30, marginBottom: 8 }}>
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", color: "#000" }}>SALES INVOICES REGISTER</div>
          <div style={{ textAlign: "center", fontSize: 10, color: "#000", marginTop: 1 }}>Period: {layout.periodLabel}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#000", marginTop: 2 }}>
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 12, color: "#000" }}>Textile Bill</span>
            <span>{layout.count} invoice{layout.count !== 1 ? "s" : ""}</span>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "right", fontSize: 10, marginTop: 30, marginBottom: 6, color: "#000" }}>
          Sales Register | {layout.periodLabel}
        </div>
      )}
      {page.groupTitle && (
        <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 4, color: "#000" }}>{page.groupTitle}</div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th("center")}>Sr</th>
            <th style={th("left")}>Date</th>
            <th style={th("left")}>Invoice No.</th>
            <th style={th("left")}>Customer</th>
            <th style={th("right")}>Amount</th>
            <th style={th("left")}>Status</th>
          </tr>
        </thead>
        <tbody>
          {page.rows.map((r) => (
            <tr key={r.invoiceNo}>
              <td style={td("center")}>{r.sr}</td>
              <td style={{ ...td("left"), whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
              <td style={td("left")}>{r.invoiceNo}</td>
              <td style={{ ...td("left"), maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.customer}</td>
              <td style={{ ...td("right"), whiteSpace: "nowrap" }}>{fmtNum(r.amount)}</td>
              <td style={td("left")}>{r.status}</td>
            </tr>
          ))}
          {page.rows.length === 0 && (
            <tr><td colSpan={6} style={{ ...td("center"), padding: "12px 6px", color: "#888" }}>No invoices.</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={{ padding: "3px 6px", fontWeight: 700, textAlign: "right", fontSize: 10 }}>
              Total ({page.index + 1}/{pagesCount})
            </td>
            <td style={{ padding: "3px 6px", fontWeight: 700, textAlign: "right", fontSize: 10 }}>{fmtNum(pageTotal)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div style={{ textAlign: "center", fontSize: 9, color: "#000", marginTop: 6 }}>
        Page {page.index + 1}/{pagesCount}
      </div>
      {page.isLast && (
        <div style={{ marginTop: 12, fontSize: 11 }}>
          {separateBySeries && layout.seriesTotals.length > 1 && layout.seriesTotals.map((g) => (
            <div key={g.title} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
              <span>{g.title} ({g.count})</span>
              <span>Rs. {fmtNum(g.total)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid #333", marginTop: 4, paddingTop: 4 }}>
            <span>Grand total:</span>
            <span>Rs. {fmtNum(layout.grandTotal)}</span>
          </div>
        </div>
      )}
    </>
  );
}

function RegisterSheet({ sheetPages, layout, separateBySeries }) {
  // Two logical pages side by side on one physical landscape sheet. Floats,
  // not flex: mobile Safari/Chrome (WebKit) print engines have a long-standing
  // bug where flex children in a printed page can each get promoted onto
  // their own physical page instead of staying side by side, which both
  // wastes paper and leaves most of each page blank. Floats paginate
  // reliably across engines.
  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      {sheetPages.map((page, colIdx) => (
        <div
          key={colIdx}
          style={{
            float: "left",
            width: "50%",
            boxSizing: "border-box",
            padding: "14px 18px",
            borderRight: colIdx === 0 ? "1px dashed #999" : "none",
            fontSize: 11,
          }}
        >
          <RegisterHalfPage page={page} pagesCount={layout.pages.length} layout={layout} separateBySeries={separateBySeries} />
        </div>
      ))}
      {sheetPages.length === 1 && (
        <div style={{ float: "left", width: "50%", boxSizing: "border-box" }} />
      )}
    </div>
  );
}

// ---- Landscape two-up RECEIPTS register ----
function receiptRegisterLayout(receipts, customers, invoices, dateFrom, dateTo) {
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  const nameOf = (id) => customerById.get(id)?.name || "—";
  const invNo = (id) => invoiceById.get(id)?.invoiceNo || "";
  const sorted = [...receipts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0)));
  const display = sorted.map((r, i) => ({
    sr: i + 1,
    date: r.date,
    receiptNo: r.receiptNo,
    customer: nameOf(r.customerId),
    against: r.invoiceId ? invNo(r.invoiceId) : "On account",
    mode: receiptAccountLabel(r),
    amount: Number(r.amount) || 0,
  }));
  const pages = [];
  let i = 0, first = true;
  while (i < display.length || (first && display.length === 0)) {
    const cap = first ? REGISTER_FIRST_PAGE_ROWS : REGISTER_OTHER_PAGE_ROWS;
    pages.push({ rows: display.slice(i, i + cap), bigHeader: first });
    i += cap; first = false;
  }
  pages.forEach((p, idx) => { p.index = idx; p.isLast = idx === pages.length - 1; });
  const grandTotal = display.reduce((t, r) => t + r.amount, 0);
  const byAccountMap = new Map();
  for (const r of display) {
    const e = byAccountMap.get(r.mode) || { label: r.mode, count: 0, amount: 0 };
    e.count += 1; e.amount += r.amount;
    byAccountMap.set(r.mode, e);
  }
  const byAccount = [...byAccountMap.values()].sort((a, b) => b.amount - a.amount);
  const periodLabel = (dateFrom || dateTo)
    ? (dateFrom && dateTo
        ? `${fmtDate(dateFrom)} to ${fmtDate(dateTo)}`
        : dateFrom
          ? `${fmtDate(dateFrom)} onwards`
          : `Up to ${fmtDate(dateTo)}`)
    : "All dates";
  return { pages, sheets: chunkSheets(pages), grandTotal, byAccount, count: display.length, periodLabel };
}

function ReceiptHalfPage({ page, pagesCount, layout }) {
  const th = (align) => ({ border: "1px solid #333", padding: "3px 6px", textAlign: align, fontWeight: 700, background: "#f2f2f2", fontSize: 10 });
  const td = (align) => ({ border: "1px solid #333", padding: "2px 6px", textAlign: align, fontSize: 10 });
  const pageTotal = page.rows.reduce((t, r) => t + r.amount, 0);
  return (
    <>
      {page.bigHeader ? (
        <div style={{ marginTop: 30, marginBottom: 8 }}>
          <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em", color: "#000" }}>RECEIPTS REGISTER</div>
          <div style={{ textAlign: "center", fontSize: 10, color: "#000", marginTop: 1 }}>Period: {layout.periodLabel}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#000", marginTop: 2 }}>
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 12, color: "#000" }}>Textile Bill</span>
            <span>{layout.count} receipt{layout.count !== 1 ? "s" : ""}</span>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "right", fontSize: 10, marginTop: 30, marginBottom: 6, color: "#000" }}>Receipts Register | {layout.periodLabel}</div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th("center")}>Sr</th>
            <th style={th("left")}>Date</th>
            <th style={th("left")}>Customer</th>
            <th style={th("left")}>Against</th>
            <th style={th("left")}>Mode</th>
            <th style={th("right")}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {page.rows.map((r) => (
            <tr key={r.receiptNo}>
              <td style={td("center")}>{r.sr}</td>
              <td style={{ ...td("left"), whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
              <td style={{ ...td("left"), maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.customer} - {r.receiptNo}</td>
              <td style={td("left")}>{r.against}</td>
              <td style={td("left")}>{r.mode}</td>
              <td style={{ ...td("right"), whiteSpace: "nowrap" }}>{fmtNum(r.amount)}</td>
            </tr>
          ))}
          {page.rows.length === 0 && (
            <tr><td colSpan={6} style={{ ...td("center"), padding: "12px 6px", color: "#888" }}>No receipts.</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} style={{ padding: "3px 6px", fontWeight: 700, textAlign: "right", fontSize: 10 }}>Total ({page.index + 1}/{pagesCount})</td>
            <td></td>
            <td style={{ padding: "3px 6px", fontWeight: 700, textAlign: "right", fontSize: 10 }}>{fmtNum(pageTotal)}</td>
          </tr>
        </tfoot>
      </table>
      <div style={{ textAlign: "center", fontSize: 9, color: "#000", marginTop: 6 }}>Page {page.index + 1}/{pagesCount}</div>
      {page.isLast && (
        <div style={{ marginTop: 12, fontSize: 11 }}>
          {layout.byAccount.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>Cash/Bank Summary</div>
              {layout.byAccount.map((a) => (
                <div key={a.label} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                  <span>{a.label} ({a.count})</span>
                  <span>{fmtNum(a.amount)}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid #333", paddingTop: 4 }}>
            <span>Grand total:</span>
            <span>Rs. {fmtNum(layout.grandTotal)}</span>
          </div>
        </div>
      )}
    </>
  );
}

function ReceiptSheet({ sheetPages, layout }) {
  // Two logical pages side by side on one physical landscape sheet. Floats,
  // not flex: mobile Safari/Chrome (WebKit) print engines have a long-standing
  // bug where flex children in a printed page can each get promoted onto
  // their own physical page instead of staying side by side, which both
  // wastes paper and leaves most of each page blank. Floats paginate
  // reliably across engines.
  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      {sheetPages.map((page, colIdx) => (
        <div key={colIdx} style={{ float: "left", width: "50%", boxSizing: "border-box", padding: "14px 18px", borderRight: colIdx === 0 ? "1px dashed #999" : "none", fontSize: 11 }}>
          <ReceiptHalfPage page={page} pagesCount={layout.pages.length} layout={layout} />
        </div>
      ))}
      {sheetPages.length === 1 && <div style={{ float: "left", width: "50%", boxSizing: "border-box" }} />}
    </div>
  );
}

function ReceiptRegisterPrint({ receipts, customers, invoices, dateFrom, dateTo }) {
  const layout = receiptRegisterLayout(receipts, customers, invoices, dateFrom, dateTo);
  return (
    <div className="print-area packing-print" style={{ fontFamily: "'Inter', sans-serif", color: "#111" }}>
      {layout.sheets.map((sheetPages, sIdx) => (
        <div key={sIdx} className="print-sheet">
          <ReceiptSheet sheetPages={sheetPages} layout={layout} />
        </div>
      ))}
    </div>
  );
}

function ReceiptRegisterPreview({ receipts, customers, invoices, dateFrom, dateTo, onClose }) {
  const layout = receiptRegisterLayout(receipts, customers, invoices, dateFrom, dateTo);
  return (
    <PrintPreviewOverlay
      title="Receipts Register"
      subtitle={`${layout.periodLabel} · ${layout.count} receipt${layout.count !== 1 ? "s" : ""}`}
      onClose={onClose}
    >
      {layout.sheets.map((sheetPages, sIdx) => (
        <PaperSheet key={sIdx} landscape>
          <ReceiptSheet sheetPages={sheetPages} layout={layout} />
        </PaperSheet>
      ))}
    </PrintPreviewOverlay>
  );
}

function RegisterTable({ title, rows, customers, invoiceTotal }) {
  const total = rows.reduce((s, inv) => s + invoiceTotal(inv), 0);
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  return (
    <div style={{ marginBottom: 28 }}>
      {title && <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{title}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #111" }}>
            <th style={{ textAlign: "left", padding: "5px 4px" }}>Sr</th>
            <th style={{ textAlign: "left", padding: "5px 4px" }}>Date</th>
            <th style={{ textAlign: "left", padding: "5px 4px" }}>Invoice No.</th>
            <th style={{ textAlign: "left", padding: "5px 4px" }}>Customer</th>
            <th style={{ textAlign: "right", padding: "5px 4px" }}>Amount</th>
            <th style={{ textAlign: "left", padding: "5px 4px" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv, i) => (
            <tr key={inv.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "5px 4px" }}>{i + 1}</td>
              <td style={{ padding: "5px 4px" }}>{fmtDate(inv.date)}</td>
              <td style={{ padding: "5px 4px" }}>{inv.invoiceNo}</td>
              <td style={{ padding: "5px 4px" }}>{customerById.get(inv.customerId)?.name || "—"}</td>
              <td style={{ padding: "5px 4px", textAlign: "right" }}>{fmtMoney(invoiceTotal(inv))}</td>
              <td style={{ padding: "5px 4px" }}>{inv.status}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid #111", fontWeight: 700 }}>
            <td colSpan={4} style={{ padding: "6px 4px" }}>Total</td>
            <td style={{ padding: "6px 4px", textAlign: "right" }}>{fmtMoney(total)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function RegisterPreviewModal({ invoices, customers, invoiceTotal, separateBySeries, selectionCount = 0, dateFrom, dateTo, onClose }) {
  const layout = registerLayout(invoices, customers, invoiceTotal, separateBySeries, dateFrom, dateTo);
  return (
    <PrintPreviewOverlay
      title="Sales Invoices Register"
      subtitle={`${layout.periodLabel} · ${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}${selectionCount > 0 ? " · selected rows only" : ""}${separateBySeries ? " · split by series" : ""}`}
      onClose={onClose}
    >
      {layout.sheets.map((sheetPages, sIdx) => (
        <PaperSheet key={sIdx} landscape>
          <RegisterSheet sheetPages={sheetPages} layout={layout} separateBySeries={separateBySeries} />
        </PaperSheet>
      ))}
    </PrintPreviewOverlay>
  );
}
function PrintableRegister({ invoices, customers, invoiceTotal, separateBySeries, dateFrom, dateTo }) {
  const layout = registerLayout(invoices, customers, invoiceTotal, separateBySeries, dateFrom, dateTo);
  return (
    <div className="print-area packing-print" style={{ fontFamily: "'Inter', sans-serif", color: "#111" }}>
      {layout.sheets.map((sheetPages, sIdx) => (
        <div key={sIdx} className="print-sheet">
          <RegisterSheet sheetPages={sheetPages} layout={layout} separateBySeries={separateBySeries} />
        </div>
      ))}
    </div>
  );
}

// ===================== DASHBOARD =====================
// Ported from the reference app's dashboard.tsx: KPI cards, three
// recent-activity tables (Invoices / Receipts / Payments), and two
// filterable monthly tables (Sales & Receipts / Purchases & Payments) that
// drill into a customer-wise or vendor-wise breakdown for a clicked month.

// Dashboard tab — split into its own module so it isn't part of the initial
// bundle. It loads the first time the tab is opened (see React.lazy in
// TextileSales.jsx) and is cached from then on.


// Dashboard tab — split into its own module so it is not part of the
// initial bundle. Loads the first time the tab is opened (see React.lazy in
// TextileSales.jsx) and is cached from then on.

function DashboardView({
  customers, vendors, invoices, purchases, payments, receipts,
  invoiceTotal, customerOutstanding, vendorOutstanding,
  dateFrom, dateTo, setDateFrom, setDateTo, quickRangeDates,
  onNavigate, onOpenCustomerLedger, onOpenVendorLedger,
}) {
  const [customerFilter, setCustomerFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [breakdownMonth, setBreakdownMonth] = useState(null); // { key, label } | null
  const [vendorBreakdownMonth, setVendorBreakdownMonth] = useState(null);

  const inRange = (d) => (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
  const wInvoices = useMemo(() => invoices.filter((i) => inRange(i.date)), [invoices, dateFrom, dateTo]);
  const wPurchases = useMemo(() => purchases.filter((p) => inRange(p.date)), [purchases, dateFrom, dateTo]);
  const wReceipts = useMemo(() => receipts.filter((r) => inRange(r.date)), [receipts, dateFrom, dateTo]);
  const wPayments = useMemo(() => payments.filter((p) => inRange(p.date)), [payments, dateFrom, dateTo]);

  const totalSales = wInvoices.reduce((s, i) => s + invoiceTotal(i), 0);
  const totalPurchases = wPurchases.reduce((s, p) => s + purchaseTotal(p), 0);
  // Receivable/Payable are point-in-time balances (not windowed by the date
  // filter above) — matches the reference app's KPI cards, which show no
  // trend/count line for these two.
  const totalReceivable = customers.reduce((s, c) => s + Math.max(0, customerOutstanding(c.id)), 0);
  const totalPayable = vendors.reduce((s, v) => s + Math.max(0, vendorOutstanding(v.id)), 0);
  const totalReceipts = wReceipts.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalPayments = wPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0));
  const recentInvoices = useMemo(() => [...wInvoices].sort(byDateDesc).slice(0, 4), [wInvoices]);
  const recentReceipts = useMemo(() => [...wReceipts].sort(byDateDesc).slice(0, 4), [wReceipts]);
  const recentPayments = useMemo(() => [...wPayments].sort(byDateDesc).slice(0, 4), [wPayments]);

  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);
  const custName = (id) => customerById.get(id)?.name || "—";
  const vendName = (id) => vendorById.get(id)?.name || "—";

  const months = useMemo(() => buildFYMonths(dateFrom, dateTo), [dateFrom, dateTo]);

  const salesReceiptsRows = useMemo(() => {
    const map = new Map(months.map((m) => [m.key, { sales: 0, receipts: 0 }]));
    const cid = customerFilter === "all" ? null : customerFilter;
    for (const inv of wInvoices) {
      if (cid && inv.customerId !== cid) continue;
      const e = map.get(inv.date.slice(0, 7)); if (e) e.sales += invoiceTotal(inv);
    }
    for (const r of wReceipts) {
      if (cid && r.customerId !== cid) continue;
      const e = map.get(r.date.slice(0, 7)); if (e) e.receipts += Number(r.amount) || 0;
    }
    return months.map((m) => ({ ...m, ...(map.get(m.key) || { sales: 0, receipts: 0 }) }));
  }, [months, wInvoices, wReceipts, customerFilter]);
  const salesReceiptsTotals = salesReceiptsRows.reduce((t, r) => ({ sales: t.sales + r.sales, receipts: t.receipts + r.receipts }), { sales: 0, receipts: 0 });

  const purchasePaymentsRows = useMemo(() => {
    const map = new Map(months.map((m) => [m.key, { purchases: 0, payments: 0 }]));
    const vid = vendorFilter === "all" ? null : vendorFilter;
    for (const p of wPurchases) {
      if (vid && p.vendorId !== vid) continue;
      const e = map.get(p.date.slice(0, 7)); if (e) e.purchases += purchaseTotal(p);
    }
    for (const p of wPayments) {
      if (vid && p.vendorId !== vid) continue;
      const e = map.get(p.date.slice(0, 7)); if (e) e.payments += Number(p.amount) || 0;
    }
    return months.map((m) => ({ ...m, ...(map.get(m.key) || { purchases: 0, payments: 0 }) }));
  }, [months, wPurchases, wPayments, vendorFilter]);
  const purchasePaymentsTotals = purchasePaymentsRows.reduce((t, r) => ({ purchases: t.purchases + r.purchases, payments: t.payments + r.payments }), { purchases: 0, payments: 0 });

  // Per-customer breakdown for a clicked month — spans ALL customers,
  // ignoring the customerFilter dropdown (matches the reference app).
  const monthBreakdownRows = useMemo(() => {
    if (!breakdownMonth) return [];
    const key = breakdownMonth.key;
    const map = new Map();
    const ensure = (id) => { let e = map.get(id); if (!e) { e = { id, name: custName(id), sales: 0, receipts: 0 }; map.set(id, e); } return e; };
    for (const inv of wInvoices) { if (inv.date.slice(0, 7) !== key) continue; ensure(inv.customerId).sales += invoiceTotal(inv); }
    for (const r of wReceipts) { if (r.date.slice(0, 7) !== key) continue; ensure(r.customerId).receipts += Number(r.amount) || 0; }
    return [...map.values()].filter((r) => r.sales || r.receipts).sort((a, b) => b.sales - a.sales);
  }, [breakdownMonth, wInvoices, wReceipts, customers]);
  const monthBreakdownTotals = monthBreakdownRows.reduce((t, r) => ({ sales: t.sales + r.sales, receipts: t.receipts + r.receipts }), { sales: 0, receipts: 0 });

  const vendorMonthBreakdownRows = useMemo(() => {
    if (!vendorBreakdownMonth) return [];
    const key = vendorBreakdownMonth.key;
    const map = new Map();
    const ensure = (id) => { let e = map.get(id); if (!e) { e = { id, name: vendName(id), purchases: 0, payments: 0 }; map.set(id, e); } return e; };
    for (const p of wPurchases) { if (p.date.slice(0, 7) !== key) continue; ensure(p.vendorId).purchases += purchaseTotal(p); }
    for (const p of wPayments) { if (p.date.slice(0, 7) !== key) continue; ensure(p.vendorId).payments += Number(p.amount) || 0; }
    return [...map.values()].filter((r) => r.purchases || r.payments).sort((a, b) => b.purchases - a.purchases);
  }, [vendorBreakdownMonth, wPurchases, wPayments, vendors]);
  const vendorMonthBreakdownTotals = vendorMonthBreakdownRows.reduce((t, r) => ({ purchases: t.purchases + r.purchases, payments: t.payments + r.payments }), { purchases: 0, payments: 0 });

  const kpiCards = [
    { key: "sales", label: "Total Sales", value: totalSales, sub: `${wInvoices.length} invoice${wInvoices.length !== 1 ? "s" : ""}`, trend: "up", color: ink, module: "sales" },
    { key: "purchases", label: "Total Purchases", value: totalPurchases, sub: `${wPurchases.length} bill${wPurchases.length !== 1 ? "s" : ""}`, trend: "down", color: ink, module: "purchases" },
    { key: "receivable", label: "Receivable (Dr)", value: totalReceivable, color: success, module: "customers" },
    { key: "payable", label: "Payable (Cr)", value: totalPayable, color: danger, module: "vendors" },
    { key: "receipts", label: "Total Receipts", value: totalReceipts, sub: `${wReceipts.length} receipt${wReceipts.length !== 1 ? "s" : ""}`, trend: "up", color: success, module: "receipts" },
    { key: "payments", label: "Total Payments", value: totalPayments, sub: `${wPayments.length} payment${wPayments.length !== 1 ? "s" : ""}`, trend: "down", color: danger, module: "payments" },
  ];

  const cellBase = { padding: "8px 10px", fontSize: 12.5, borderBottom: `1px solid ${hairline}` };
  const thBase = { ...cellBase, color: muted, fontWeight: 700, fontSize: 11, letterSpacing: "0.03em", textAlign: "left" };

  const MonthlyTable = ({ title, filterValue, setFilter, options, onEye, eyeDisabled, rows, cols, totals }) => (
    <div className="rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${hairline}` }}>
      <div className="p-4 pb-3">
        <h3 style={{ color: ink, fontWeight: 600, fontSize: 15, marginBottom: 10 }}>{title}</h3>
        <div className="flex items-center gap-2">
          <div style={{ flex: 1, minWidth: 0 }}>
            <SearchableSelect value={filterValue} onChange={setFilter} options={options} placeholder="All" inputStyle={{ border: `1px solid ${hairline}`, color: ink, background: "#fff" }} className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none" />
          </div>
          <button
            onClick={onEye}
            disabled={eyeDisabled}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 32, height: 32, flexShrink: 0, background: eyeDisabled ? paper : "#fff", border: `1px solid ${hairline}`, color: eyeDisabled ? muted : ink, cursor: eyeDisabled ? "not-allowed" : "pointer" }}
            title="View ledger"
          >
            <Eye size={15} />
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 340 }}>
          <thead><tr style={{ background: paper }}>
            <th style={thBase}>Month</th>
            <th style={{ ...thBase, textAlign: "right" }}>{cols[0]}</th>
            <th style={{ ...thBase, textAlign: "right" }}>{cols[1]}</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} onClick={() => r.onClick(r)} style={{ cursor: "pointer" }} title="View breakdown">
                <td style={{ ...cellBase, color: ink, whiteSpace: "nowrap" }}>{r.label}</td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(r[cols[0].toLowerCase()])}</td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(r[cols[1].toLowerCase()])}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} style={{ ...cellBase, textAlign: "center", color: muted, padding: "24px 8px" }}>No data for this period.</td></tr>
            )}
            {rows.length > 0 && (
              <tr style={{ background: paper, fontWeight: 700 }}>
                <td style={{ ...cellBase, borderBottom: "none" }}>Total</td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: "none" }}>{fmtMoney(totals[cols[0].toLowerCase()])}</td>
                <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: "none" }}>{fmtMoney(totals[cols[1].toLowerCase()])}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const RecentTable = ({ title, onViewAll, headers, rows, empty }) => (
    <div className="rounded-xl overflow-hidden" style={{ background: card, border: `1px solid ${hairline}` }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 style={{ color: ink, fontWeight: 600, fontSize: 15 }}>{title}</h3>
        <button onClick={onViewAll} className="flex items-center gap-1 text-xs font-semibold" style={{ color: thread }}>
          View all <ArrowRight size={12} />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 320 }}>
          <thead><tr style={{ background: paper }}>{headers.map((h, i) => <th key={i} style={{ ...thBase, textAlign: h.align || "left" }}>{h.label}</th>)}</tr></thead>
          <tbody>
            {rows}
            {empty}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-1">
        <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 28, fontWeight: 600 }}>Dashboard</h1>
        <p style={{ color: muted, fontSize: 13, marginTop: 2 }}>Overview of your business.</p>
      </div>

      <div className="my-4">
        <DateRangeBar from={dateFrom} to={dateTo} setFrom={setDateFrom} setTo={setDateTo} quickRangeDates={quickRangeDates} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        {kpiCards.map((c) => (
          <button
            key={c.key}
            onClick={() => onNavigate(c.module)}
            className="rounded-xl p-3.5 text-left"
            style={{ background: card, border: `1px solid ${hairline}` }}
          >
            <div style={{ color: muted, fontSize: 12.5, fontWeight: 600 }}>{c.label}</div>
            <div style={{ color: c.color, fontWeight: 700, fontSize: 19, fontFamily: "'IBM Plex Mono', monospace", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {fmtMoney(c.value)}
            </div>
            {c.sub && (
              <div className="flex items-center gap-1 mt-1">
                {c.trend === "up"
                  ? <TrendingUp size={12} color={success} />
                  : <TrendingDown size={12} color={danger} />}
                <span style={{ color: muted, fontSize: 11.5 }}>{c.sub}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <RecentTable
          title="Recent Invoices"
          onViewAll={() => onNavigate("sales")}
          headers={[{ label: "Date" }, { label: "Customer" }, { label: "Amount", align: "right" }]}
          rows={recentInvoices.map((inv) => (
            <tr key={inv.id}>
              <td style={{ ...cellBase, whiteSpace: "nowrap", fontFamily: "'IBM Plex Mono', monospace", color: muted }}>{fmtDate(inv.date)}</td>
              <td style={{ ...cellBase, color: ink }}>{custName(inv.customerId)}</td>
              <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{fmtMoney(invoiceTotal(inv))}</td>
            </tr>
          ))}
          empty={!recentInvoices.length && <tr><td colSpan={3} style={{ ...cellBase, textAlign: "center", color: muted, padding: "20px 8px" }}>No recent invoices.</td></tr>}
        />
        <RecentTable
          title="Recent Receipts"
          onViewAll={() => onNavigate("receipts")}
          headers={[{ label: "Date" }, { label: "Party" }, { label: "Account" }, { label: "Amount", align: "right" }]}
          rows={recentReceipts.map((r) => (
            <tr key={r.id}>
              <td style={{ ...cellBase, whiteSpace: "nowrap", fontFamily: "'IBM Plex Mono', monospace", color: muted }}>{fmtDate(r.date)}</td>
              <td style={{ ...cellBase, color: ink }}>{custName(r.customerId)}</td>
              <td style={{ ...cellBase, color: inkSoft, whiteSpace: "nowrap" }}>{receiptAccountLabel(r)}</td>
              <td style={{ ...cellBase, textAlign: "right" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#E5F6EA", color: success }}>+{fmtMoney(r.amount)}</span>
              </td>
            </tr>
          ))}
          empty={!recentReceipts.length && <tr><td colSpan={4} style={{ ...cellBase, textAlign: "center", color: muted, padding: "20px 8px" }}>No recent receipts.</td></tr>}
        />
        <RecentTable
          title="Recent Payments"
          onViewAll={() => onNavigate("payments")}
          headers={[{ label: "Date" }, { label: "Party" }, { label: "Account" }, { label: "Amount", align: "right" }]}
          rows={recentPayments.map((p) => (
            <tr key={p.id}>
              <td style={{ ...cellBase, whiteSpace: "nowrap", fontFamily: "'IBM Plex Mono', monospace", color: muted }}>{fmtDate(p.date)}</td>
              <td style={{ ...cellBase, color: ink }}>{vendName(p.vendorId)}</td>
              <td style={{ ...cellBase, color: inkSoft, whiteSpace: "nowrap" }}>{paymentAccountLabel(p)}</td>
              <td style={{ ...cellBase, textAlign: "right" }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#FBEAE7", color: danger }}>-{fmtMoney(p.amount)}</span>
              </td>
            </tr>
          ))}
          empty={!recentPayments.length && <tr><td colSpan={4} style={{ ...cellBase, textAlign: "center", color: muted, padding: "20px 8px" }}>No recent payments.</td></tr>}
        />
      </div>

      {/* Monthly tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MonthlyTable
          title="Monthly Sales & Receipts"
          filterValue={customerFilter}
          setFilter={setCustomerFilter}
          options={[{ value: "all", label: "All Customers" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]}
          onEye={() => onOpenCustomerLedger(customerFilter)}
          eyeDisabled={customerFilter === "all"}
          rows={salesReceiptsRows.map((r) => ({ ...r, onClick: () => setBreakdownMonth({ key: r.key, label: r.label }) }))}
          cols={["Sales", "Receipts"]}
          totals={salesReceiptsTotals}
        />
        <MonthlyTable
          title="Monthly Purchases & Payments"
          filterValue={vendorFilter}
          setFilter={setVendorFilter}
          options={[{ value: "all", label: "All Vendors" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
          onEye={() => onOpenVendorLedger(vendorFilter)}
          eyeDisabled={vendorFilter === "all"}
          rows={purchasePaymentsRows.map((r) => ({ ...r, onClick: () => setVendorBreakdownMonth({ key: r.key, label: r.label }) }))}
          cols={["Purchases", "Payments"]}
          totals={purchasePaymentsTotals}
        />
      </div>

      {/* Customer-wise month breakdown */}
      {breakdownMonth && (
        <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
          <div className="w-full max-w-lg rounded-xl p-5" style={{ background: "#fff", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 17, fontWeight: 600 }}>Customer-wise · {breakdownMonth.label}</h3>
              <button onClick={() => setBreakdownMonth(null)}><X size={18} color={muted} /></button>
            </div>
            <div style={{ overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={thBase}>Customer</th>
                  <th style={{ ...thBase, textAlign: "right" }}>Sales</th>
                  <th style={{ ...thBase, textAlign: "right" }}>Receipts</th>
                </tr></thead>
                <tbody>
                  {monthBreakdownRows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ ...cellBase, color: ink }}>{r.name}</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(r.sales)}</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(r.receipts)}</td>
                    </tr>
                  ))}
                  {monthBreakdownRows.length === 0 && (
                    <tr><td colSpan={3} style={{ ...cellBase, textAlign: "center", color: muted, padding: "20px 8px" }}>No activity this month.</td></tr>
                  )}
                  {monthBreakdownRows.length > 0 && (
                    <tr style={{ background: paper, fontWeight: 700 }}>
                      <td style={{ ...cellBase, borderBottom: "none" }}>Total</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: "none" }}>{fmtMoney(monthBreakdownTotals.sales)}</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: "none" }}>{fmtMoney(monthBreakdownTotals.receipts)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Vendor-wise month breakdown */}
      {vendorBreakdownMonth && (
        <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
          <div className="w-full max-w-lg rounded-xl p-5" style={{ background: "#fff", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 17, fontWeight: 600 }}>Vendor-wise · {vendorBreakdownMonth.label}</h3>
              <button onClick={() => setVendorBreakdownMonth(null)}><X size={18} color={muted} /></button>
            </div>
            <div style={{ overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={thBase}>Vendor</th>
                  <th style={{ ...thBase, textAlign: "right" }}>Purchases</th>
                  <th style={{ ...thBase, textAlign: "right" }}>Payments</th>
                </tr></thead>
                <tbody>
                  {vendorMonthBreakdownRows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ ...cellBase, color: ink }}>{r.name}</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(r.purchases)}</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(r.payments)}</td>
                    </tr>
                  ))}
                  {vendorMonthBreakdownRows.length === 0 && (
                    <tr><td colSpan={3} style={{ ...cellBase, textAlign: "center", color: muted, padding: "20px 8px" }}>No activity this month.</td></tr>
                  )}
                  {vendorMonthBreakdownRows.length > 0 && (
                    <tr style={{ background: paper, fontWeight: 700 }}>
                      <td style={{ ...cellBase, borderBottom: "none" }}>Total</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: "none" }}>{fmtMoney(vendorMonthBreakdownTotals.purchases)}</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", borderBottom: "none" }}>{fmtMoney(vendorMonthBreakdownTotals.payments)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== DATA ANALYTICS =====================
// FIFO-style aging: each party's current outstanding balance is consumed
// against their own bills oldest-first (a standard aging approximation used
// when individual payments aren't allocated to specific bills — Payments in
// this app link to a vendor, not a specific purchase bill, so exact
// bill-level aging isn't otherwise possible). Any balance left over after all
// known bills are consumed (e.g. from an opening balance predating the
// tracked bills) is bucketed as 90+ days.

// Data Analytics tab — split into its own module so it isn't part of the
// initial bundle. It loads the first time the tab is opened (see React.lazy
// in TextileSales.jsx) and is cached from then on. The charts and drill-down
// modals it owns live here too, since nothing else uses them.


// Data Analytics tab — split into its own module so it is not part of the
// initial bundle. Loads the first time the tab is opened (see React.lazy in
// TextileSales.jsx) and is cached from then on. The charts and drill-down
// modals it owns live here too, since nothing else uses them.

function agingBuckets(parties, getBills, getOutstanding, todayIso) {
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  const today = new Date(todayIso);
  for (const party of parties) {
    let remaining = Math.max(0, getOutstanding(party));
    if (remaining <= 0.5) continue;
    const bills = getBills(party).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const bill of bills) {
      if (remaining <= 0.5) break;
      const consumed = Math.min(bill.total, remaining);
      if (consumed <= 0) continue;
      const days = Math.floor((today - new Date(bill.date)) / 86400000);
      const bucket = days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
      buckets[bucket] += consumed;
      remaining -= consumed;
    }
    if (remaining > 0.5) buckets["90+"] += remaining;
  }
  return buckets;
}

// Same FIFO-consumption logic as agingBuckets, but returns one row per
// outstanding bill (party, bill, days, bucket) instead of just bucket totals
// — used for the aging "View All" detail table + export.
function agingDetailRows(parties, getBills, getOutstanding, todayIso, partyName) {
  const today = new Date(todayIso);
  const rows = [];
  for (const party of parties) {
    let remaining = Math.max(0, getOutstanding(party));
    if (remaining <= 0.5) continue;
    const bills = getBills(party).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const bill of bills) {
      if (remaining <= 0.5) break;
      const consumed = Math.min(bill.total, remaining);
      if (consumed <= 0) continue;
      const days = Math.floor((today - new Date(bill.date)) / 86400000);
      const bucket = days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
      rows.push({ party: partyName(party), ref: bill.ref, date: bill.date, amount: bill.total, days, bucket });
      remaining -= consumed;
    }
    // Balance left over after every known bill is consumed (e.g. an opening
    // balance predating any tracked invoice/purchase, or a party with no
    // bills at all) — the chart's 90+ bucket includes this too, so surface
    // it here as its own row rather than silently dropping it, otherwise
    // the chart total and this table's total would disagree.
    if (remaining > 0.5) {
      rows.push({ party: partyName(party), ref: "Opening Balance / Unmatched", date: null, amount: remaining, days: null, bucket: "90+" });
    }
  }
  return rows.sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity));
}

// Simple horizontal bar list — used for Top Customers/Vendors and the unit-
// type breakdown. data: [{ label, value }], sorted desc by caller.
// ---------- RFM scoring ----------
// Standard RFM: each customer scored 1-5 on Recency, Frequency and Monetary
// by quintile rank against the rest of the customer base. 5 is always the
// best score — for Recency that means the FEWEST days since last purchase,
// so its ranking direction is inverted relative to F and M.
function assignQuintileScores(rows, getValue, higherIsBetter) {
  const sorted = [...rows].sort((a, b) =>
    higherIsBetter ? getValue(b) - getValue(a) : getValue(a) - getValue(b)
  );
  const n = sorted.length;
  const scores = new Map();
  sorted.forEach((row, i) => {
    const score = n <= 1 ? 5 : 5 - Math.floor((i * 5) / n);
    scores.set(row.id, Math.max(1, Math.min(5, score)));
  });
  return scores;
}

// Amount-weighted average days between an invoice and the payment(s) that
// settled it. Receipts explicitly tied to an invoice are applied there
// first; whatever's left (receipts in this app are frequently recorded "on
// account" with no invoice link) is allocated oldest-invoice-first — the
// same FIFO approximation the aging report uses. Returns null when nothing
// has been settled, so the UI can show "—" instead of a misleading 0.
// A negative result is only possible via a receipt explicitly linked to a
// later invoice — a deliberate advance payment, which is meaningful rather
// than a bug. Unlinked receipts are never matched to invoices that didn't
// exist yet (see pass 2 below).
function avgPaymentDays(custInvoices, custReceipts, invoiceTotal, opening) {
  const bills = custInvoices
    .map((inv) => ({ id: inv.id, date: inv.date, due: invoiceTotal(inv) }));
  // The customer's brought-forward opening balance is money owed too, and it
  // predates every invoice on file. Without it, an early receipt that's
  // actually clearing that old debt gets FIFO-matched against a *later*
  // invoice instead (the only "bill" the function knew about), producing a
  // nonsensical negative "days to pay" — the receipt looks like it arrived
  // before the invoice was even raised. It's included here as a normal bill,
  // dated at the opening balance date, so it both absorbs those early
  // receipts first (oldest-due-first) and still contributes a meaningful
  // "days since due" figure of its own.
  if (opening && opening.amount > 0.5 && opening.date) {
    bills.push({ id: "__opening__", date: opening.date, due: opening.amount });
  }
  bills.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!bills.length) return null;
  const byId = new Map(bills.map((b) => [b.id, b]));
  const ordered = [...custReceipts].sort((a, b) => (a.date < b.date ? -1 : 1));

  let weightedDays = 0;
  let settled = 0;
  const applyTo = (bill, amount, receiptDate) => {
    const used = Math.min(bill.due, amount);
    if (used <= 0) return 0;
    bill.due -= used;
    const days = Math.round((new Date(receiptDate) - new Date(bill.date)) / 86400000);
    weightedDays += days * used;
    settled += used;
    return used;
  };

  // Pass 1 — receipts pointing at a specific invoice.
  const leftovers = [];
  for (const r of ordered) {
    let amt = Number(r.amount) || 0;
    if (amt <= 0) continue;
    const target = r.invoiceId ? byId.get(r.invoiceId) : null;
    if (target) amt -= applyTo(target, amt, r.date);
    if (amt > 0.5) leftovers.push({ amount: amt, date: r.date });
  }
  // Pass 2 — everything else, oldest bill first (opening balance included).
  // Bills dated *after* the receipt are skipped: money received before an
  // invoice was even raised can't be a payment against it, and matching it
  // there produces a negative "days to pay" that drags the weighted average
  // to a meaningless figure. Any remainder is genuine credit sitting on
  // account and simply isn't counted until a later invoice settles it.
  for (const r of leftovers) {
    let amt = r.amount;
    for (const bill of bills) {
      if (amt <= 0.5) break;
      if (bill.due <= 0.5) continue;
      if (bill.date > r.date) continue;
      amt -= applyTo(bill, amt, r.date);
    }
  }
  return settled > 0.5 ? Math.round(weightedDays / settled) : null;
}

// Colour ramp for a 1-5 RFM score so the grid is scannable at a glance.
const rfmScoreColor = (s) => (s >= 5 ? success : s === 4 ? "#5B8C6E" : s === 3 ? inkSoft : s === 2 ? "#C17817" : danger);

function HBarList({ data, color, formatValue = fmtMoney, emptyText = "No data.", onRowClick }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) {
    return <div style={{ color: muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>{emptyText}</div>;
  }
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div
          key={d.label}
          title={onRowClick ? "View breakdown" : formatValue(d.value)}
          onClick={onRowClick ? () => onRowClick(d) : undefined}
          style={onRowClick ? { cursor: "pointer" } : undefined}
        >
          <div className="flex items-center justify-between mb-1">
            <span style={{ color: ink, fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>{d.label}</span>
            <span style={{ color: inkSoft, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>{formatValue === fmtMoney ? fmtMoneyCompact(d.value) : formatValue(d.value)}</span>
          </div>
          <div style={{ height: 8, borderRadius: 5, background: paper, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.max(2, (d.value / max) * 100)}%`, background: color, borderRadius: 5 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Simple vertical bar chart for month-over-month trend. series:
// [{ key, color, label }], rows: [{ label, <key>: number, ... }].
function MonthlyBarChart({ rows, series, formatValue = fmtMoney }) {
  const BAR_MAX_PX = 104;
  const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => r[s.key] || 0)));
  if (!rows.length) return <div style={{ color: muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No data for this period.</div>;
  return (
    <div>
      <div className="flex items-center gap-4 mb-3">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />
            <span style={{ color: muted, fontSize: 12 }}>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2" style={{ height: 160, overflowX: "auto" }}>
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col items-center justify-end" style={{ minWidth: 34, height: "100%", flex: "1 0 auto" }} title={series.map((s) => `${s.label}: ${formatValue(r[s.key] || 0)}`).join(" · ")}>
            <div className="flex items-end gap-1" style={{ height: BAR_MAX_PX + 16 }}>
              {series.map((s) => {
                const val = r[s.key] || 0;
                return (
                  <div key={s.key} className="flex flex-col-reverse items-center" style={{ height: BAR_MAX_PX + 16 }}>
                    <div style={{ width: 10, height: `${Math.max(2, (val / max) * BAR_MAX_PX)}px`, background: s.color, borderRadius: "2px 2px 0 0" }} />
                    {val > 0 && (
                      <span style={{ fontSize: 8.5, color: s.color, fontWeight: 700, marginBottom: 2, whiteSpace: "nowrap" }}>
                        {formatValue === fmtMoney ? fmtMoneyCompact(val) : formatValue(val)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <span style={{ color: muted, fontSize: 10, marginTop: 4, whiteSpace: "nowrap" }}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Simple SVG scatter plot — one dot per data point, semi-transparent so
// overlapping points read as denser. points: [{ x, y }].
// "1-2-5" tick sequence (1,2,5,10,20,50,100,...) — the standard readable
// spacing for a log-scale axis, plus a 0 baseline.
function niceLogTicks(max) {
  const ticks = [0];
  for (let mag = 1; mag <= max * 1.01; mag *= 10) {
    for (const m of [1, 2, 5]) {
      const t = mag * m;
      if (t <= max * 1.01) ticks.push(t);
    }
  }
  return ticks;
}

function ScatterChart({ points, xLabel, yLabel, color, highlightFrom, highlightTo }) {
  if (!points.length) return <div style={{ color: muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No data for this period.</div>;
  const W = 600, H = 260, padL = 46, padR = 12, padT = 10, padB = 34;
  const xMax = Math.max(...points.map((p) => p.x)) * 1.06 || 1;
  const yMaxRaw = Math.max(...points.map((p) => p.y)) || 1;
  const xScale = (v) => padL + (v / xMax) * (W - padL - padR);
  // Log scale on Y: quantities in this app commonly span from single digits
  // to tens of thousands, and a linear scale squashes every small-but-real
  // value onto the baseline next to a handful of large outliers, making them
  // indistinguishable from zero (they aren't — rateQtyPoints only ever
  // includes qty > 0).
  const logMax = Math.log10(yMaxRaw + 1);
  const yScale = (v) => H - padB - (Math.log10(v + 1) / logMax) * (H - padT - padB);
  const xTicksCount = 5;
  const xTicks = Array.from({ length: xTicksCount + 1 }, (_, i) => (xMax / xTicksCount) * i);
  const yTicks = niceLogTicks(yMaxRaw);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 240, display: "block" }}>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={padL} y1={yScale(v)} x2={W - padR} y2={yScale(v)} stroke={hairline} strokeWidth={1} />
          <text x={padL - 6} y={yScale(v) + 3} fontSize={8.5} textAnchor="end" fill={muted}>{fmtNum(v)}</text>
        </g>
      ))}
      {xTicks.map((v, i) => (
        <text key={i} x={xScale(v)} y={H - padB + 14} fontSize={9} textAnchor="middle" fill={muted}>{fmtNum(v)}</text>
      ))}
      {highlightFrom != null && (
        <rect x={xScale(highlightFrom)} y={padT} width={Math.max(0, xScale(highlightTo) - xScale(highlightFrom))} height={H - padT - padB} fill={thread} fillOpacity={0.08} />
      )}
      <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke={inkSoft} strokeWidth={1} />
      <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={inkSoft} strokeWidth={1} />
      {points.map((p, i) => (
        <circle key={i} cx={xScale(p.x)} cy={yScale(p.y)} r={3.2} fill={color} fillOpacity={0.45}>
          <title>{`Rate: ${fmtMoney(p.x)} · Qty: ${fmtNum(p.y)}`}</title>
        </circle>
      ))}
      <text x={(padL + W - padR) / 2} y={H - 3} fontSize={10} textAnchor="middle" fill={muted}>{xLabel}</text>
      <text x={11} y={(padT + H - padB) / 2} fontSize={10} textAnchor="middle" fill={muted} transform={`rotate(-90 11 ${(padT + H - padB) / 2})`}>{yLabel} (log scale)</text>
    </svg>
  );
}

const AGING_BUCKET_COLOR = { "0-30": success, "31-60": "#B8860B", "61-90": "#C17817", "90+": danger };

function AgingDetailModal({ title, partyLabel, rows, onClose }) {
  const cellBase = { padding: "7px 9px", fontSize: 12.5, borderBottom: `1px solid ${hairline}` };
  const thBase = { ...cellBase, color: muted, fontWeight: 700, fontSize: 11, letterSpacing: "0.03em", textAlign: "left" };
  const total = rows.reduce((s, r) => s + r.amount, 0);

  function exportCsv() {
    const data = rows.map((r) => ({
      [partyLabel]: r.party,
      "Invoice No.": r.ref,
      "Invoice Date": r.date ? fmtDate(r.date) : "—",
      "Invoice Amount": r.amount,
      "Outstanding Days": r.days ?? "—",
      "Outstanding Days Range": r.bucket,
    }));
    if (!data.length) return;
    downloadCsv(data, `${title.replace(/\s+/g, "_")}_${todayISO()}`);
  }

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-2xl rounded-xl p-5" style={{ background: "#fff", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>{title}</h3>
            <p style={{ color: muted, fontSize: 12, marginTop: 2 }}>{rows.length} outstanding bill{rows.length !== 1 ? "s" : ""} · {fmtMoney(total)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
              <Download size={15} /> Export
            </button>
            <button onClick={onClose}><X size={20} color={muted} /></button>
          </div>
        </div>
        <div style={{ overflowY: "auto", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={thBase}>{partyLabel}</th>
                <th style={thBase}>Invoice No.</th>
                <th style={thBase}>Invoice Date</th>
                <th style={{ ...thBase, textAlign: "right" }}>Invoice Amount</th>
                <th style={{ ...thBase, textAlign: "right" }}>Outstanding Days</th>
                <th style={thBase}>Days Range</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ ...cellBase, textAlign: "center", color: muted, padding: "24px 8px" }}>No outstanding bills.</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...cellBase, color: ink, fontWeight: 600 }}>{r.party}</td>
                    <td style={{ ...cellBase, color: inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{r.ref}</td>
                    <td style={{ ...cellBase, color: muted, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{r.date ? fmtDate(r.date) : "—"}</td>
                    <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{fmtMoney(r.amount)}</td>
                    <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{r.days ?? "—"}</td>
                    <td style={cellBase}>
                      <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: `${AGING_BUCKET_COLOR[r.bucket]}1A`, color: AGING_BUCKET_COLOR[r.bucket] }}>{r.bucket}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScatterDetailModal({ title, scopeLabel, rows, onClose, partyLabel = "Customer", qtyLabel = "Qty Sold" }) {
  const [viewMode, setViewMode] = useState("invoice"); // invoice | customer
  const cellBase = { padding: "7px 9px", fontSize: 12.5, borderBottom: `1px solid ${hairline}` };
  const thBase = { ...cellBase, color: muted, fontWeight: 700, fontSize: 11, letterSpacing: "0.03em", textAlign: "left" };
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // Customer-wise: sums Qty/Amount across every invoice for that customer
  // (within the current filter) — grouped by unit too, since mixing e.g.
  // Yards and Pcs quantities into one number wouldn't mean anything.
  const customerRows = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = `${r.customer}||${r.unit}`;
      const e = map.get(key) || { customer: r.customer, unit: r.unit, qty: 0, amount: 0, invoices: new Set() };
      e.qty += r.qty;
      e.amount += r.amount;
      e.invoices.add(r.invoiceNo);
      map.set(key, e);
    }
    return [...map.values()]
      .map((e) => ({ ...e, invoiceCount: e.invoices.size, avgRate: e.qty > 0 ? e.amount / e.qty : 0 }))
      .sort((a, b) => b.qty - a.qty);
  }, [rows]);

  function exportCsv() {
    const data = viewMode === "customer"
      ? customerRows.map((r) => ({
          [partyLabel]: r.customer,
          "Unit": r.unit,
          "Invoices": r.invoiceCount,
          [`Total ${qtyLabel}`]: r.qty,
          "Avg Rate": r.avgRate.toFixed(2),
          "Total Amount": r.amount,
        }))
      : sorted.map((r) => ({
          [partyLabel]: r.customer,
          "Invoice No.": r.invoiceNo,
          "Date": fmtDate(r.date),
          "Unit": r.unit,
          [qtyLabel]: r.qty,
          "Rate": r.rate,
          "Amount": r.amount,
        }));
    if (!data.length) return;
    downloadCsv(data, `${title.replace(/\s+/g, "_")}_${viewMode}_${todayISO()}`);
  }

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-2xl rounded-xl p-5" style={{ background: "#fff", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>{title}</h3>
            <p style={{ color: muted, fontSize: 12, marginTop: 2 }}>
              {scopeLabel} · {rows.length} line item{rows.length !== 1 ? "s" : ""} · {fmtNum(totalQty)} units · {fmtMoney(totalAmount)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
              <Download size={15} /> Export
            </button>
            <button onClick={onClose}><X size={20} color={muted} /></button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setViewMode("invoice")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: viewMode === "invoice" ? thread : card, border: `1px solid ${viewMode === "invoice" ? thread : hairline}`, color: viewMode === "invoice" ? ink : muted }}
          >
            Invoice-wise
          </button>
          <button
            onClick={() => setViewMode("customer")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: viewMode === "customer" ? thread : card, border: `1px solid ${viewMode === "customer" ? thread : hairline}`, color: viewMode === "customer" ? ink : muted }}
          >
            {partyLabel}-wise
          </button>
        </div>

        <div style={{ overflowY: "auto", overflowX: "auto" }}>
          {viewMode === "customer" ? (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={thBase}>{partyLabel}</th>
                  <th style={thBase}>Unit</th>
                  <th style={{ ...thBase, textAlign: "right" }}>Invoices</th>
                  <th style={{ ...thBase, textAlign: "right" }}>{qtyLabel}</th>
                  <th style={{ ...thBase, textAlign: "right" }}>Avg Rate</th>
                  <th style={{ ...thBase, textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {customerRows.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...cellBase, textAlign: "center", color: muted, padding: "24px 8px" }}>No line items match this filter.</td></tr>
                ) : (
                  customerRows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ ...cellBase, color: ink, fontWeight: 600 }}>{r.customer}</td>
                      <td style={{ ...cellBase, color: inkSoft }}>{r.unit}</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: muted }}>{r.invoiceCount}</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{fmtNum(r.qty)}</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(r.avgRate)}</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{fmtMoney(r.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={thBase}>{partyLabel}</th>
                  <th style={thBase}>Unit</th>
                  <th style={{ ...thBase, textAlign: "right" }}>{qtyLabel}</th>
                  <th style={{ ...thBase, textAlign: "right" }}>Rate</th>
                  <th style={{ ...thBase, textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...cellBase, textAlign: "center", color: muted, padding: "24px 8px" }}>No line items match this filter.</td></tr>
                ) : (
                  sorted.map((r, i) => (
                    <tr key={i}>
                      <td style={cellBase}>
                        <div style={{ color: ink, fontWeight: 600 }}>{r.customer}</div>
                        <div style={{ color: muted, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", marginTop: 1 }}>{r.invoiceNo} · {fmtDate(r.date)}</div>
                      </td>
                      <td style={{ ...cellBase, color: inkSoft }}>{r.unit}</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtNum(r.qty)}</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(r.rate)}</td>
                      <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>{fmtMoney(r.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// Full customer-wise RFM table. Every column is click-to-sort (first click
// sorts descending — "best first" is the usual thing you want from RFM —
// clicking the same column again flips direction). Customers with no
// payments yet sort to the bottom on Payment Days regardless of direction,
// since a missing value isn't meaningfully "low" or "high".
function RfmDetailModal({ rows, onClose }) {
  const [sortKey, setSortKey] = useState("total");
  const [sortDir, setSortDir] = useState("desc");
  const cellBase = { padding: "7px 9px", fontSize: 12.5, borderBottom: `1px solid ${hairline}` };

  const toggleSort = (k) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
  };

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      if (sortKey === "name") {
        return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      if (sortKey === "payDays") {
        if (a.payDays == null && b.payDays == null) return 0;
        if (a.payDays == null) return 1;   // unpaid always last
        if (b.payDays == null) return -1;
        return sortDir === "asc" ? a.payDays - b.payDays : b.payDays - a.payDays;
      }
      const av = sortKey === "total" ? a.R + a.F + a.M : a[sortKey];
      const bv = sortKey === "total" ? b.R + b.F + b.M : b[sortKey];
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  function exportCsv() {
    const data = sorted.map((r) => ({
      "Customer": r.name,
      "Sales": r.sales,
      "Invoices": r.count,
      "R": r.R,
      "F": r.F,
      "M": r.M,
      "Total RFM": r.R + r.F + r.M,
      "Payment Days": r.payDays == null ? "" : r.payDays,
    }));
    if (!data.length) return;
    downloadCsv(data, `Customer_RFM_${todayISO()}`);
  }

  const SortTh = ({ label, k, align = "center", hint }) => (
    <th
      onClick={() => toggleSort(k)}
      title={hint || `Sort by ${label}`}
      style={{
        textAlign: align, padding: "6px 9px", fontSize: 11, fontWeight: 700,
        color: sortKey === k ? ink : muted, cursor: "pointer", whiteSpace: "nowrap",
        borderBottom: `1px solid ${hairline}`, userSelect: "none",
      }}
    >
      {label}{sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-2xl rounded-xl p-5" style={{ background: "#fff", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>Customer RFM — All</h3>
            <p style={{ color: muted, fontSize: 12, marginTop: 2 }}>{rows.length} customer{rows.length !== 1 ? "s" : ""} · tap any column to sort</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
              <Download size={15} /> Export
            </button>
            <button onClick={onClose}><X size={20} color={muted} /></button>
          </div>
        </div>
        <div style={{ overflowY: "auto", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <SortTh label="Customer" k="name" align="left" />
                <SortTh label="Sales" k="sales" align="right" />
                <SortTh label="Inv" k="count" align="right" hint="Sort by number of invoices" />
                <SortTh label="R" k="R" hint="Recency — how recently they last purchased" />
                <SortTh label="F" k="F" hint="Frequency — how many invoices" />
                <SortTh label="M" k="M" hint="Monetary — total sales value" />
                <SortTh label="Total" k="total" hint="Sort by combined R+F+M score" />
                <SortTh label="Pay Days" k="payDays" align="left" />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={8} style={{ ...cellBase, textAlign: "center", color: muted, padding: "24px 8px" }}>No sales in this period.</td></tr>
              ) : (
                sorted.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...cellBase, color: ink, fontWeight: 600, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</td>
                    <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: inkSoft }}>{fmtMoney(r.sales)}</td>
                    <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: inkSoft }}>{r.count}</td>
                    <td style={{ ...cellBase, textAlign: "center", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: rfmScoreColor(r.R) }}>{r.R}</td>
                    <td style={{ ...cellBase, textAlign: "center", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: rfmScoreColor(r.F) }}>{r.F}</td>
                    <td style={{ ...cellBase, textAlign: "center", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: rfmScoreColor(r.M) }}>{r.M}</td>
                    <td style={{ ...cellBase, textAlign: "center", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: ink }}>{r.R + r.F + r.M}</td>
                    <td style={{ ...cellBase, textAlign: "left", fontFamily: "'IBM Plex Mono', monospace", color: r.payDays == null ? muted : inkSoft }}>{r.payDays == null ? "—" : r.payDays}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Invoice-wise other-expense breakdown for one customer — opened by tapping a
// row in the "Other Expenses by Customer" table.
function ExpenseDetailModal({ row, onClose }) {
  const cellBase = { padding: "7px 9px", fontSize: 12.5, borderBottom: `1px solid ${hairline}` };
  const sorted = useMemo(
    () => [...row.invoices].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [row.invoices]
  );

  function exportCsv() {
    const data = sorted.map((r) => ({
      "Invoice No.": r.invoiceNo,
      "Date": fmtDate(r.date),
      "Subtotal": r.subtotal,
      "Other Expense": r.expense,
      "% of Subtotal": r.pct.toFixed(2),
      "Expense Heads": r.labels,
    }));
    if (!data.length) return;
    downloadCsv(data, `Other_Expenses_${row.name.replace(/[^a-zA-Z0-9]+/g, "_")}_${todayISO()}`);
  }

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-2xl rounded-xl p-5" style={{ background: "#fff", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>{row.name}</h3>
            <p style={{ color: muted, fontSize: 12, marginTop: 2 }}>
              {row.count} invoice{row.count !== 1 ? "s" : ""} · {fmtMoney(row.expense)} on {fmtMoney(row.subtotal)} = <b style={{ color: ink }}>{row.pct.toFixed(2)}%</b>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
              <Download size={15} /> Export
            </button>
            <button onClick={onClose}><X size={20} color={muted} /></button>
          </div>
        </div>
        <div style={{ overflowY: "auto", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>INVOICE</th>
                <th style={{ textAlign: "left", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>DATE</th>
                <th style={{ textAlign: "right", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>SUBTOTAL</th>
                <th style={{ textAlign: "right", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>OTHER EXP.</th>
                <th style={{ textAlign: "right", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>%</th>
                <th style={{ textAlign: "left", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>HEADS</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...cellBase, color: ink, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{r.invoiceNo}</td>
                  <td style={{ ...cellBase, color: muted, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmtDate(r.date)}</td>
                  <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: inkSoft }}>{fmtMoney(r.subtotal)}</td>
                  <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: inkSoft }}>{fmtMoney(r.expense)}</td>
                  <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>{r.pct.toFixed(2)}%</td>
                  <td style={{ ...cellBase, color: muted, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.labels || "—"}</td>
                </tr>
              ))}
              <tr style={{ background: paper }}>
                <td colSpan={2} style={{ padding: "8px 9px", fontSize: 12.5, fontWeight: 700, color: ink }}>Total</td>
                <td style={{ padding: "8px 9px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>{fmtMoney(row.subtotal)}</td>
                <td style={{ padding: "8px 9px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>{fmtMoney(row.expense)}</td>
                <td style={{ padding: "8px 9px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>{row.pct.toFixed(2)}%</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Customer-wise breakdown for one location — opened by tapping a row in the
// "Top 5 Locations" card.
function GeoDetailModal({ geo, onClose }) {
  const cellBase = { padding: "7px 9px", fontSize: 12.5, borderBottom: `1px solid ${hairline}` };

  function exportCsv() {
    const data = geo.customers.map((c) => ({
      "Customer": c.name,
      "Invoices": c.count,
      "Sales": c.amount,
      "% of Location": geo.amount > 0 ? ((c.amount / geo.amount) * 100).toFixed(2) : "0.00",
    }));
    if (!data.length) return;
    downloadCsv(data, `Location_${geo.label.replace(/[^a-zA-Z0-9]+/g, "_")}_${todayISO()}`);
  }

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-lg rounded-xl p-5" style={{ background: "#fff", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>{geo.label}</h3>
            <p style={{ color: muted, fontSize: 12, marginTop: 2 }}>
              {geo.customers.length} customer{geo.customers.length !== 1 ? "s" : ""} · {geo.count} invoice{geo.count !== 1 ? "s" : ""} · <b style={{ color: ink }}>{fmtMoney(geo.amount)}</b>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
              <Download size={15} /> Export
            </button>
            <button onClick={onClose}><X size={20} color={muted} /></button>
          </div>
        </div>
        <div style={{ overflowY: "auto", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 380 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>CUSTOMER</th>
                <th style={{ textAlign: "right", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>INV</th>
                <th style={{ textAlign: "right", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>SALES</th>
                <th style={{ textAlign: "right", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>SHARE</th>
              </tr>
            </thead>
            <tbody>
              {geo.customers.map((c) => (
                <tr key={c.id}>
                  <td style={{ ...cellBase, color: ink, fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</td>
                  <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: inkSoft }}>{c.count}</td>
                  <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: inkSoft }}>{fmtMoney(c.amount)}</td>
                  <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>
                    {geo.amount > 0 ? ((c.amount / geo.amount) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              ))}
              <tr style={{ background: paper }}>
                <td style={{ padding: "8px 9px", fontSize: 12.5, fontWeight: 700, color: ink }}>Total</td>
                <td style={{ padding: "8px 9px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>{geo.count}</td>
                <td style={{ padding: "8px 9px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>{fmtMoney(geo.amount)}</td>
                <td style={{ padding: "8px 9px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Document-wise breakdown for one top customer or vendor — the same shape
// works for both, since an invoice and a purchase bill each reduce to
// ref/date/amount here. `refLabel` just switches the column heading.
function PartyDetailModal({ detail, onClose }) {
  const cellBase = { padding: "7px 9px", fontSize: 12.5, borderBottom: `1px solid ${hairline}` };
  const sorted = useMemo(
    () => [...detail.docs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [detail.docs]
  );
  const total = sorted.reduce((s, d) => s + d.amount, 0);

  function exportCsv() {
    const data = sorted.map((d) => ({
      [detail.refLabel === "BILL" ? "Bill No." : "Invoice No."]: d.ref,
      "Date": fmtDate(d.date),
      "Amount": d.amount,
      "% of Total": total > 0 ? ((d.amount / total) * 100).toFixed(2) : "0.00",
    }));
    if (!data.length) return;
    downloadCsv(data, `${detail.label.replace(/[^a-zA-Z0-9]+/g, "_")}_${todayISO()}`);
  }

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-lg rounded-xl p-5" style={{ background: "#fff", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>{detail.label}</h3>
            <p style={{ color: muted, fontSize: 12, marginTop: 2 }}>
              {sorted.length} {detail.title.toLowerCase()} · <b style={{ color: ink }}>{fmtMoney(total)}</b>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
              <Download size={15} /> Export
            </button>
            <button onClick={onClose}><X size={20} color={muted} /></button>
          </div>
        </div>
        <div style={{ overflowY: "auto", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 360 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>{detail.refLabel}</th>
                <th style={{ textAlign: "left", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>DATE</th>
                <th style={{ textAlign: "right", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>AMOUNT</th>
                <th style={{ textAlign: "right", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>SHARE</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <tr key={d.id}>
                  <td style={{ ...cellBase, color: ink, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{d.ref}</td>
                  <td style={{ ...cellBase, color: muted, fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{fmtDate(d.date)}</td>
                  <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: inkSoft }}>{fmtMoney(d.amount)}</td>
                  <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>
                    {total > 0 ? ((d.amount / total) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              ))}
              <tr style={{ background: paper }}>
                <td colSpan={2} style={{ padding: "8px 9px", fontSize: 12.5, fontWeight: 700, color: ink }}>Total</td>
                <td style={{ padding: "8px 9px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>{fmtMoney(total)}</td>
                <td style={{ padding: "8px 9px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Party-wise breakdown for one location's balances — opened from the
// "Location-wise Balances" table. Works for customers or vendors; only the
// heading wording differs.
function LocationBalanceModal({ row, partyLabel, onClose }) {
  const cellBase = { padding: "7px 9px", fontSize: 12.5, borderBottom: `1px solid ${hairline}` };

  function exportCsv() {
    const data = row.parties.map((p) => ({
      [partyLabel]: p.name,
      "Balance": Math.abs(p.balance),
      "Type": p.isDr ? "Dr" : "Cr",
    }));
    if (!data.length) return;
    downloadCsv(data, `${partyLabel}_Balances_${row.label.replace(/[^a-zA-Z0-9]+/g, "_")}_${todayISO()}`);
  }

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-lg rounded-xl p-5" style={{ background: "#fff", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>{row.label}</h3>
            <p style={{ color: muted, fontSize: 12, marginTop: 2 }}>
              {row.parties.length} {row.parties.length === 1 ? partyLabel.toLowerCase() : `${partyLabel.toLowerCase()}s`} · Net{" "}
              <b style={{ color: row.net >= 0 ? success : danger }}>
                {fmtMoney(Math.abs(row.net))} {row.net >= 0 ? "Dr" : "Cr"}
              </b>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
              <Download size={15} /> Export
            </button>
            <button onClick={onClose}><X size={20} color={muted} /></button>
          </div>
        </div>
        <div style={{ overflowY: "auto", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 320 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>{partyLabel.toUpperCase()}</th>
                <th style={{ textAlign: "right", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>BALANCE</th>
              </tr>
            </thead>
            <tbody>
              {row.parties.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...cellBase, color: ink, fontWeight: 600, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                  <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: p.isDr ? success : danger, whiteSpace: "nowrap" }}>
                    {fmtMoney(Math.abs(p.balance))}<span style={{ fontSize: 9, fontWeight: 700 }}>{p.isDr ? " DR" : " CR"}</span>
                  </td>
                </tr>
              ))}
              <tr style={{ background: paper }}>
                <td style={{ padding: "8px 9px", fontSize: 12.5, fontWeight: 700, color: ink }}>Net</td>
                <td style={{ padding: "8px 9px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: row.net >= 0 ? success : danger, whiteSpace: "nowrap" }}>
                  {fmtMoney(Math.abs(row.net))}<span style={{ fontSize: 9, fontWeight: 700 }}>{row.net >= 0 ? " DR" : " CR"}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Full ranked list behind the "Top 3" cards. Rows stay tappable so this is a
// way into the per-party breakdown rather than a dead end.
function RankAllModal({ detail, onClose, onPick }) {
  const cellBase = { padding: "7px 9px", fontSize: 12.5, borderBottom: `1px solid ${hairline}` };
  const total = detail.rows.reduce((s, r) => s + r.value, 0);

  function exportCsv() {
    const data = detail.rows.map((r, i) => ({
      "Rank": i + 1,
      [detail.partyLabel]: r.label,
      "Documents": r.docs.length,
      "Amount": r.value,
      "% of Total": total > 0 ? ((r.value / total) * 100).toFixed(2) : "0.00",
    }));
    if (!data.length) return;
    downloadCsv(data, `${detail.title.replace(/[^a-zA-Z0-9]+/g, "_")}_${todayISO()}`);
  }

  return (
    <div className="no-print fixed inset-0 flex items-center justify-center px-4 py-8" style={{ background: "rgba(30,42,68,0.45)", zIndex: 60 }}>
      <div className="w-full max-w-lg rounded-xl p-5" style={{ background: "#fff", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 18, fontWeight: 600 }}>{detail.title}</h3>
            <p style={{ color: muted, fontSize: 12, marginTop: 2 }}>
              {detail.rows.length} {detail.rows.length === 1 ? detail.partyLabel.toLowerCase() : `${detail.partyLabel.toLowerCase()}s`} · <b style={{ color: ink }}>{fmtMoney(total)}</b> · tap a row for the breakdown
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: ink }}>
              <Download size={15} /> Export
            </button>
            <button onClick={onClose}><X size={20} color={muted} /></button>
          </div>
        </div>
        <div style={{ overflowY: "auto", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 360 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}`, width: 34 }}>#</th>
                <th style={{ textAlign: "left", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>{detail.partyLabel.toUpperCase()}</th>
                <th style={{ textAlign: "right", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>DOCS</th>
                <th style={{ textAlign: "right", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>AMOUNT</th>
                <th style={{ textAlign: "right", padding: "6px 9px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>SHARE</th>
              </tr>
            </thead>
            <tbody>
              {detail.rows.map((r, i) => (
                <tr key={r.label + i} onClick={() => onPick(r)} style={{ cursor: "pointer" }} title="View the breakdown">
                  <td style={{ ...cellBase, color: muted, fontFamily: "'IBM Plex Mono', monospace" }}>{i + 1}</td>
                  <td style={{ ...cellBase, color: ink, fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</td>
                  <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: muted }}>{r.docs.length}</td>
                  <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: detail.color }}>{fmtMoney(r.value)}</td>
                  <td style={{ ...cellBase, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>
                    {total > 0 ? ((r.value / total) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              ))}
              <tr style={{ background: paper }}>
                <td colSpan={3} style={{ padding: "8px 9px", fontSize: 12.5, fontWeight: 700, color: ink }}>Total</td>
                <td style={{ padding: "8px 9px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>{fmtMoney(total)}</td>
                <td style={{ padding: "8px 9px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AnalyticsCard({ icon, title, subtitle, children }) {
  return (
    <div className="rounded-xl p-4" style={{ background: card, border: `1px solid ${hairline}` }}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 style={{ color: ink, fontWeight: 600, fontSize: 15 }}>{title}</h3>
      </div>
      {subtitle && <p style={{ color: muted, fontSize: 12, marginBottom: 12 }}>{subtitle}</p>}
      <div style={{ marginTop: subtitle ? 0 : 12 }}>{children}</div>
    </div>
  );
}

function DataAnalyticsView({
  customers, vendors, invoices, purchases, receipts, payments,
  invoiceTotal, customerOutstanding, vendorOutstanding,
  dateFrom, dateTo, setDateFrom, setDateTo, quickRangeDates,
}) {
  const inRange = (d) => (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
  const wInvoices = useMemo(() => invoices.filter((i) => inRange(i.date)), [invoices, dateFrom, dateTo]);
  const wPurchases = useMemo(() => purchases.filter((p) => inRange(p.date)), [purchases, dateFrom, dateTo]);
  const [scatterSource, setScatterSource] = useState("sale"); // sale | purchase
  const [locBalSource, setLocBalSource] = useState("customer"); // customer | vendor
  const [locBalPage, setLocBalPage] = useState(0);
  const [locBalDetail, setLocBalDetail] = useState(null); // location row drilled into
  const [rankAll, setRankAll] = useState(null); // {title, rows, partyLabel} for the View All list
  const [scatterUnit, setScatterUnit] = useState("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [custPage, setCustPage] = useState(0);
  const [rfmPage, setRfmPage] = useState(0);
  const [showRfmDetail, setShowRfmDetail] = useState(false);
  const [expPage, setExpPage] = useState(0);
  const [expCustomer, setExpCustomer] = useState(null); // customer row being drilled into
  const [geoDetail, setGeoDetail] = useState(null); // location row being drilled into
  const [partyDetail, setPartyDetail] = useState(null); // {title, label, docs, refLabel} for top customer/vendor

  // Fast id -> customer/vendor lookup, so the per-invoice loops below stay
  // O(n) rather than scanning the whole customer/vendor list for every row.
  const customerById = useMemo(() => {
    const m = new Map();
    for (const c of customers) m.set(c.id, c);
    return m;
  }, [customers]);
  const vendorById = useMemo(() => {
    const m = new Map();
    for (const v of vendors) m.set(v.id, v);
    return m;
  }, [vendors]);

  // Customer frequency & recency: one row per customer with any activity in
  // the selected period — total sales, how many invoices, average invoice
  // value, and when they last bought (the recency signal).
  const customerStats = useMemo(() => {
    const map = new Map();
    for (const inv of wInvoices) {
      const e = map.get(inv.customerId) || { id: inv.customerId, sales: 0, count: 0, lastDate: "" };
      e.sales += invoiceTotal(inv);
      e.count += 1;
      if (!e.lastDate || inv.date > e.lastDate) e.lastDate = inv.date;
      map.set(inv.customerId, e);
    }
    return [...map.values()]
      .map((e) => ({
        ...e,
        name: customerById.get(e.id)?.name || "—",
        avg: e.count > 0 ? e.sales / e.count : 0,
      }))
      .sort((a, b) => b.sales - a.sales);
  }, [wInvoices, customerById]);

  const CUST_PAGE_SIZE = 5;
  const custPageCount = Math.max(1, Math.ceil(customerStats.length / CUST_PAGE_SIZE));
  const custPageSafe = Math.min(custPage, custPageCount - 1);
  const custPageRows = customerStats.slice(custPageSafe * CUST_PAGE_SIZE, custPageSafe * CUST_PAGE_SIZE + CUST_PAGE_SIZE);

  // Geographic sales: customers only have a single free-text `address` field
  // (there's no separate city/state), so this groups by whatever's typed
  // there — matched case-insensitively so "Indore" and "indore" don't split
  // into two rows. Invoices whose customer has no address land in
  // "Unspecified" rather than being silently dropped.
  // Location-wise outstanding balances, for customers or vendors. Unlike the
  // sales figures above, a balance is a point-in-time number (what's owed
  // right now), so this deliberately ignores the date filter — filtering it
  // by period would produce a figure that isn't a real balance.
  const locBalances = useMemo(() => {
    const isCust = locBalSource === "customer";
    const parties = isCust ? customers : vendors;
    const balOf = isCust ? customerOutstanding : vendorOutstanding;
    const map = new Map();
    for (const p of parties) {
      const bal = Math.round(balOf(p.id));
      if (bal === 0) continue; // zero balances add nothing to a balance report
      const label = (p.address || "").trim() || "Unspecified";
      const key = label.toLowerCase();
      const e = map.get(key) || { label, dr: 0, cr: 0, drCount: 0, crCount: 0, parties: [] };
      // Customers: +ve = Dr (receivable). Vendors: +ve = Cr (payable).
      const isDr = isCust ? bal > 0 : bal < 0;
      if (isDr) { e.dr += Math.abs(bal); e.drCount += 1; }
      else { e.cr += Math.abs(bal); e.crCount += 1; }
      e.parties.push({ id: p.id, name: p.name, address: label, balance: bal, isDr });
      map.set(key, e);
    }
    return [...map.values()]
      .map((e) => ({ ...e, net: e.dr - e.cr, parties: e.parties.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)) }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [locBalSource, customers, vendors, customerOutstanding, vendorOutstanding]);

  const locBalTotals = useMemo(() => locBalances.reduce(
    (acc, r) => ({ dr: acc.dr + r.dr, cr: acc.cr + r.cr, drCount: acc.drCount + r.drCount, crCount: acc.crCount + r.crCount }),
    { dr: 0, cr: 0, drCount: 0, crCount: 0 }
  ), [locBalances]);

  const LOCBAL_PAGE = 8;
  const locBalPageCount = Math.max(1, Math.ceil(locBalances.length / LOCBAL_PAGE));
  const locBalPageSafe = Math.min(locBalPage, locBalPageCount - 1);

  const geoSales = useMemo(() => {
    const map = new Map();
    for (const inv of wInvoices) {
      const raw = (customerById.get(inv.customerId)?.address || "").trim();
      const label = raw || "Unspecified";
      const key = label.toLowerCase();
      const e = map.get(key) || { label, amount: 0, count: 0, byCustomer: new Map() };
      const amt = invoiceTotal(inv);
      e.amount += amt;
      e.count += 1;
      // Per-customer split within the location, so tapping a row can show
      // who actually makes up that location's total.
      const cid = inv.customerId;
      const c = e.byCustomer.get(cid) || { id: cid, name: customerById.get(cid)?.name || "—", amount: 0, count: 0 };
      c.amount += amt;
      c.count += 1;
      e.byCustomer.set(cid, c);
      map.set(key, e);
    }
    return [...map.values()]
      .map((e) => ({ ...e, customers: [...e.byCustomer.values()].sort((a, b) => b.amount - a.amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [wInvoices, customerById]);

  // RFM scores, built on the same period-filtered invoices as the frequency
  // table above. Payment days deliberately considers ALL of a customer's
  // receipts rather than only ones dated inside the period — a June invoice
  // may well be settled in August, and we're measuring how fast the period's
  // invoices actually got paid.
  const rfmRows = useMemo(() => {
    if (!customerStats.length) return [];
    const today = new Date(todayISO());
    const base = customerStats.map((c) => ({
      id: c.id,
      name: c.name,
      sales: c.sales,
      count: c.count,
      recencyDays: Math.max(0, Math.round((today - new Date(c.lastDate)) / 86400000)),
    }));
    const rScores = assignQuintileScores(base, (r) => r.recencyDays, false);
    const fScores = assignQuintileScores(base, (r) => r.count, true);
    const mScores = assignQuintileScores(base, (r) => r.sales, true);
    return base
      .map((r) => ({
        ...r,
        R: rScores.get(r.id) || 1,
        F: fScores.get(r.id) || 1,
        M: mScores.get(r.id) || 1,
        payDays: avgPaymentDays(
          wInvoices.filter((i) => i.customerId === r.id),
          receipts.filter((x) => x.customerId === r.id),
          invoiceTotal,
          (() => {
            const cust = customerById.get(r.id);
            if (!cust || (cust.openingBalanceType || "Dr") !== "Dr") return null;
            const amt = Number(cust.openingBalance) || 0;
            return amt > 0 ? { amount: amt, date: cust.openingBalanceDate } : null;
          })(),
        ),
      }))
      .sort((a, b) => (b.R + b.F + b.M) - (a.R + a.F + a.M) || b.sales - a.sales);
  }, [customerStats, wInvoices, receipts, invoiceTotal]);

  const RFM_PAGE_SIZE = 5;
  const rfmPageCount = Math.max(1, Math.ceil(rfmRows.length / RFM_PAGE_SIZE));
  const rfmPageSafe = Math.min(rfmPage, rfmPageCount - 1);
  const rfmPageRows = rfmRows.slice(rfmPageSafe * RFM_PAGE_SIZE, rfmPageSafe * RFM_PAGE_SIZE + RFM_PAGE_SIZE);

  // 1. Sales trend over time
  const months = useMemo(() => buildFYMonths(dateFrom, dateTo), [dateFrom, dateTo]);
  const trendRows = useMemo(() => {
    const map = new Map(months.map((m) => [m.key, { label: m.label, sales: 0, purchases: 0 }]));
    for (const inv of wInvoices) { const e = map.get(inv.date.slice(0, 7)); if (e) e.sales += invoiceTotal(inv); }
    for (const p of wPurchases) { const e = map.get(p.date.slice(0, 7)); if (e) e.purchases += purchaseTotal(p); }
    return months.map((m) => map.get(m.key));
  }, [months, wInvoices, wPurchases]);

  // Customer-wise "other expenses" as a % of subtotal, for the filtered
  // period. Subtotal here is the pre-expense line-item total (invoiceTotal
  // includes expenses, so it can't be used directly). Each row also carries
  // its own per-invoice breakdown so the drill-down modal doesn't have to
  // recompute anything.
  const expenseRows = useMemo(() => {
    const map = new Map();
    for (const inv of wInvoices) {
      const sub = (inv.items || []).reduce((s, it) => s + lineAmount(it), 0);
      const exp = (inv.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      if (sub <= 0 && exp <= 0) continue;
      let e = map.get(inv.customerId);
      if (!e) {
        e = { id: inv.customerId, name: customerById.get(inv.customerId)?.name || "—", subtotal: 0, expense: 0, count: 0, invoices: [] };
        map.set(inv.customerId, e);
      }
      e.subtotal += sub;
      e.expense += exp;
      e.count += 1;
      e.invoices.push({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        date: inv.date,
        subtotal: sub,
        expense: exp,
        pct: sub > 0 ? (exp / sub) * 100 : 0,
        labels: (inv.expenses || []).map((x) => x.label).filter(Boolean).join(", "),
      });
    }
    return [...map.values()]
      .map((e) => ({ ...e, pct: e.subtotal > 0 ? (e.expense / e.subtotal) * 100 : 0 }))
      .sort((a, b) => b.expense - a.expense);
  }, [wInvoices, customerById]);

  const expenseTotals = useMemo(() => {
    const subtotal = expenseRows.reduce((s, r) => s + r.subtotal, 0);
    const expense = expenseRows.reduce((s, r) => s + r.expense, 0);
    return { subtotal, expense, pct: subtotal > 0 ? (expense / subtotal) * 100 : 0 };
  }, [expenseRows]);

  const ANALYTICS_PAGE = 5;
  const expPageCount = Math.max(1, Math.ceil(expenseRows.length / ANALYTICS_PAGE));
  const expPageSafe = Math.min(expPage, expPageCount - 1);

  // 2. Top customers / vendors by revenue (in-period activity). Each row
  // carries the documents behind its total so tapping it can show the
  // invoice-/bill-wise breakdown without recomputing.
  const topCustomers = useMemo(() => {
    const map = new Map();
    for (const inv of wInvoices) {
      const e = map.get(inv.customerId) || { value: 0, docs: [] };
      e.value += invoiceTotal(inv);
      e.docs.push({ id: inv.id, ref: inv.invoiceNo, date: inv.date, amount: invoiceTotal(inv) });
      map.set(inv.customerId, e);
    }
    return [...map.entries()]
      .map(([id, e]) => ({ label: customerById.get(id)?.name || "—", value: e.value, docs: e.docs }))
      .sort((a, b) => b.value - a.value);
  }, [wInvoices, customerById, invoiceTotal]);
  const topVendors = useMemo(() => {
    const map = new Map();
    for (const p of wPurchases) {
      const e = map.get(p.vendorId) || { value: 0, docs: [] };
      e.value += purchaseTotal(p);
      e.docs.push({ id: p.id, ref: p.billNo, date: p.date, amount: purchaseTotal(p) });
      map.set(p.vendorId, e);
    }
    return [...map.entries()]
      .map(([id, e]) => ({ label: vendorById.get(id)?.name || "—", value: e.value, docs: e.docs }))
      .sort((a, b) => b.value - a.value);
  }, [wPurchases, vendorById]);

  // 3. Item / unit-type breakdown — Qty, average rate, amount per unit type.
  const unitBreakdown = useMemo(() => {
    const map = new Map();
    for (const inv of wInvoices) {
      for (const it of inv.items || []) {
        if (isCancelledItem(it)) continue;
        const e = map.get(it.unit) || { unit: it.unit, qty: 0, amount: 0 };
        e.qty += Number(it.qty) || 0;
        e.amount += lineAmount(it);
        map.set(it.unit, e);
      }
    }
    const total = [...map.values()].reduce((s, e) => s + e.amount, 0) || 1;
    return [...map.values()]
      .map((e) => ({ ...e, avgRate: e.qty > 0 ? e.amount / e.qty : 0, pct: (e.amount / total) * 100 }))
      .sort((a, b) => b.amount - a.amount);
  }, [wInvoices]);

  // Full line-item detail behind the Rate vs Qty scatter — customer/vendor and
  // invoice/bill context included so the "View Table" breakdown (and its
  // export) can show more than just rate/qty. Filterable by unit type since
  // price ranges are meaningless mixed across Yards/Pcs/Meter/etc. Source
  // switches between Sale (invoices) and Purchase (purchase bills) — same row
  // shape either way so the chart, summary text, and table below don't need
  // to know which one's in play.
  const scatterLineItems = useMemo(() => {
    const rows = [];
    if (scatterSource === "purchase") {
      for (const p of wPurchases) {
        for (const it of p.items || []) {
          if (isCancelledItem(it)) continue;
          if (scatterUnit !== "all" && it.unit !== scatterUnit) continue;
          const rate = Number(it.rate) || 0;
          const qty = Number(it.qty) || 0;
          if (rate > 0 && qty > 0) {
            rows.push({
              customer: vendorById.get(p.vendorId)?.name || "—",
              unit: it.unit,
              qty,
              rate,
              amount: lineAmount(it),
              invoiceNo: p.billNo,
              date: p.date,
            });
          }
        }
      }
      return rows;
    }
    for (const inv of wInvoices) {
      for (const it of inv.items || []) {
        if (isCancelledItem(it)) continue;
        if (scatterUnit !== "all" && it.unit !== scatterUnit) continue;
        const rate = Number(it.rate) || 0;
        const qty = Number(it.qty) || 0;
        if (rate > 0 && qty > 0) {
          rows.push({
            customer: customerById.get(inv.customerId)?.name || "—",
            unit: it.unit,
            qty,
            rate,
            amount: lineAmount(it),
            invoiceNo: inv.invoiceNo,
            date: inv.date,
          });
        }
      }
    }
    return rows;
  }, [wInvoices, wPurchases, scatterSource, scatterUnit, customerById, vendorById]);

  const priceMinNum = priceMin !== "" ? Number(priceMin) : null;
  const priceMaxNum = priceMax !== "" ? Number(priceMax) : null;
  const hasPriceRange = priceMinNum != null || priceMaxNum != null;

  // Everything downstream — the plotted chart points, the summary line, and
  // the "View Table" breakdown — all read from this SAME filtered set, so
  // what the chart shows and what the numbers say can never disagree again.
  const scatterFilteredRows = useMemo(() => {
    if (!hasPriceRange) return scatterLineItems;
    return scatterLineItems.filter((r) => (priceMinNum == null || r.rate >= priceMinNum) && (priceMaxNum == null || r.rate <= priceMaxNum));
  }, [scatterLineItems, priceMinNum, priceMaxNum, hasPriceRange]);

  const rateQtyPoints = useMemo(() => scatterFilteredRows.map((r) => ({ x: r.rate, y: r.qty })), [scatterFilteredRows]);
  const [showScatterTable, setShowScatterTable] = useState(false);

  // Which rate bucket moves the most total quantity — computed from the full
  // unit-filtered set (not yet narrowed by price range), since this is meant
  // to suggest where to look before the user picks a specific range.
  const bestRateBucket = useMemo(() => {
    if (!scatterLineItems.length) return null;
    const maxRate = Math.max(...scatterLineItems.map((r) => r.rate));
    const bucketSize = Math.max(1, Math.ceil(maxRate / 10));
    const buckets = new Map();
    for (const r of scatterLineItems) {
      const b = Math.floor(r.rate / bucketSize);
      buckets.set(b, (buckets.get(b) || 0) + r.qty);
    }
    let bestB = 0, bestQty = -1;
    for (const [b, qty] of buckets) { if (qty > bestQty) { bestQty = qty; bestB = b; } }
    return { from: bestB * bucketSize, to: (bestB + 1) * bucketSize, qty: bestQty };
  }, [scatterLineItems]);

  // User-specified price range (Min/Max Price inputs) — sums qty for every
  // point whose rate falls within [priceMin, priceMax], either bound optional.
  const priceRangeResult = useMemo(() => {
    if (!hasPriceRange) return null;
    return {
      qty: scatterFilteredRows.reduce((s, r) => s + r.qty, 0),
      lines: scatterFilteredRows.length,
      amount: scatterFilteredRows.reduce((s, r) => s + r.amount, 0),
    };
  }, [scatterFilteredRows, hasPriceRange]);

  // 4. Receivables vs Payables aging (point-in-time, FIFO-consumed against
  // each party's own bills — not windowed by the date filter above).
  const today = todayISO();
  const arBills = (c) => invoices.filter((i) => i.customerId === c.id).map((i) => ({ date: i.date, total: invoiceTotal(i), ref: i.invoiceNo }));
  const apBills = (v) => purchases.filter((p) => p.vendorId === v.id).map((p) => ({ date: p.date, total: purchaseTotal(p), ref: p.billNo }));
  const arBuckets = useMemo(
    () => agingBuckets(customers, arBills, (c) => customerOutstanding(c.id), today),
    [customers, invoices]
  );
  const apBuckets = useMemo(
    () => agingBuckets(vendors, apBills, (v) => vendorOutstanding(v.id), today),
    [vendors, purchases]
  );
  const bucketKeys = ["0-30", "31-60", "61-90", "90+"];
  const agingRows = bucketKeys.map((k) => ({ label: k, ar: arBuckets[k], ap: apBuckets[k] }));
  const [showArDetail, setShowArDetail] = useState(false);
  const [showApDetail, setShowApDetail] = useState(false);
  const arDetailRows = useMemo(
    () => (showArDetail ? agingDetailRows(customers, arBills, (c) => customerOutstanding(c.id), today, (c) => c.name) : []),
    [showArDetail, customers, invoices]
  );
  const apDetailRows = useMemo(
    () => (showApDetail ? agingDetailRows(vendors, apBills, (v) => vendorOutstanding(v.id), today, (v) => v.name) : []),
    [showApDetail, vendors, purchases]
  );

  return (
    <div>
      <div className="mb-1">
        <h1 style={{ fontFamily: "'Fraunces', serif", color: ink, fontSize: 28, fontWeight: 600 }}>Data Analytics</h1>
        <p style={{ color: muted, fontSize: 13, marginTop: 2 }}>Trends and breakdowns across your business.</p>
      </div>

      <div className="my-4">
        <DateRangeBar from={dateFrom} to={dateTo} setFrom={setDateFrom} setTo={setDateTo} quickRangeDates={quickRangeDates} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <AnalyticsCard icon={<BarChart3 size={17} color={thread} />} title="Sales & Purchases Trend" subtitle="Month by month, for the selected period">
          <MonthlyBarChart rows={trendRows} series={[{ key: "sales", color: success, label: "Sales" }, { key: "purchases", color: danger, label: "Purchases" }]} />
        </AnalyticsCard>

        <AnalyticsCard icon={<PieChart size={17} color={thread} />} title="Item / Unit-Type Breakdown" subtitle="Qty sold, average rate, and amount by unit type">
          {unitBreakdown.length === 0 ? (
            <div style={{ color: muted, fontSize: 13, textAlign: "center", padding: "24px 0" }}>No data for this period.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${hairline}` }}>
                  <th style={{ textAlign: "left", padding: "4px 6px", fontSize: 11, color: muted, fontWeight: 700 }}>Unit</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", fontSize: 11, color: muted, fontWeight: 700 }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", fontSize: 11, color: muted, fontWeight: 700 }}>Avg Rate</th>
                  <th style={{ textAlign: "right", padding: "4px 6px", fontSize: 11, color: muted, fontWeight: 700 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {unitBreakdown.map((u) => (
                  <tr key={u.unit} style={{ borderBottom: `1px solid ${hairline}` }}>
                    <td style={{ padding: "6px", fontSize: 12.5, fontWeight: 600, color: ink }}>{u.unit} <span style={{ color: muted, fontWeight: 400 }}>({u.pct.toFixed(0)}%)</span></td>
                    <td style={{ padding: "6px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: inkSoft }}>{fmtNum(u.qty)}</td>
                    <td style={{ padding: "6px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: inkSoft }}>{fmtMoney(u.avgRate)}</td>
                    <td style={{ padding: "6px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: ink }}>{fmtMoney(u.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </AnalyticsCard>

        <AnalyticsCard icon={<Users size={17} color={thread} />} title="Top 3 Customers" subtitle="By sales in the selected period — tap a row for the invoice-wise breakdown">
          <HBarList
            data={topCustomers.slice(0, 3)}
            color={success}
            onRowClick={(d) => setPartyDetail({ title: "Invoices", label: d.label, docs: d.docs, refLabel: "INVOICE" })}
          />
          {topCustomers.length > 3 && (
            <button
              onClick={() => setRankAll({ title: "All Customers by Sales", rows: topCustomers, partyLabel: "Customer", detailTitle: "Invoices", refLabel: "INVOICE", color: success })}
              className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: card, border: `1px solid ${hairline}`, color: thread }}
            >
              View All ({topCustomers.length})
            </button>
          )}
        </AnalyticsCard>

        <AnalyticsCard icon={<Users size={17} color={thread} />} title="Top 3 Vendors" subtitle="By purchases in the selected period — tap a row for the bill-wise breakdown">
          <HBarList
            data={topVendors.slice(0, 3)}
            color={danger}
            onRowClick={(d) => setPartyDetail({ title: "Purchase Bills", label: d.label, docs: d.docs, refLabel: "BILL" })}
          />
          {topVendors.length > 3 && (
            <button
              onClick={() => setRankAll({ title: "All Vendors by Purchases", rows: topVendors, partyLabel: "Vendor", detailTitle: "Purchase Bills", refLabel: "BILL", color: danger })}
              className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: card, border: `1px solid ${hairline}`, color: thread }}
            >
              View All ({topVendors.length})
            </button>
          )}
        </AnalyticsCard>

        <AnalyticsCard icon={<Landmark size={17} color={thread} />} title="Top 5 Locations" subtitle="By sales in the selected period, grouped by customer address — tap a row for the customer breakdown">
          <HBarList
            data={geoSales.map((g) => ({ label: `${g.label} (${g.count})`, value: g.amount, geo: g }))}
            color={thread}
            emptyText="No sales in this period."
            onRowClick={(d) => setGeoDetail(d.geo)}
          />
        </AnalyticsCard>

        <AnalyticsCard icon={<Clock size={17} color={thread} />} title="Receivables vs Payables Aging" subtitle="Outstanding balances by age, as on today">
          <MonthlyBarChart
            rows={agingRows}
            series={[{ key: "ar", color: success, label: "Receivable" }, { key: "ap", color: danger, label: "Payable" }]}
          />
          <div className="flex items-center gap-2 mt-3">
            <button onClick={() => setShowArDetail(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: success }}>
              Debtors — View All
            </button>
            <button onClick={() => setShowApDetail(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: card, border: `1px solid ${hairline}`, color: danger }}>
              Creditors — View All
            </button>
          </div>
          <p style={{ color: muted, fontSize: 11, marginTop: 10, lineHeight: 1.4 }}>
            Each party's current balance is aged against their own bills, oldest first — an approximation, since payments here aren't linked to specific bills.
          </p>
        </AnalyticsCard>
      </div>

      {showArDetail && (
        <AgingDetailModal title="Debtors Ageing" partyLabel="Customer" rows={arDetailRows} onClose={() => setShowArDetail(false)} />
      )}
      {showRfmDetail && (
        <RfmDetailModal rows={rfmRows} onClose={() => setShowRfmDetail(false)} />
      )}
      {showApDetail && (
        <AgingDetailModal title="Creditors Ageing" partyLabel="Vendor" rows={apDetailRows} onClose={() => setShowApDetail(false)} />
      )}
      {expCustomer && (
        <ExpenseDetailModal row={expCustomer} onClose={() => setExpCustomer(null)} />
      )}
      {geoDetail && (
        <GeoDetailModal geo={geoDetail} onClose={() => setGeoDetail(null)} />
      )}
      {rankAll && (
        <RankAllModal
          detail={rankAll}
          onClose={() => setRankAll(null)}
          onPick={(row) => {
            // Chain into the existing per-party breakdown so "View All" is a
            // way in rather than a dead end.
            setPartyDetail({ title: rankAll.detailTitle, label: row.label, docs: row.docs, refLabel: rankAll.refLabel });
            setRankAll(null);
          }}
        />
      )}
      {locBalDetail && (
        <LocationBalanceModal
          row={locBalDetail}
          partyLabel={locBalSource === "vendor" ? "Vendor" : "Customer"}
          onClose={() => setLocBalDetail(null)}
        />
      )}
      {partyDetail && (
        <PartyDetailModal detail={partyDetail} onClose={() => setPartyDetail(null)} />
      )}

      <AnalyticsCard icon={<Users size={17} color={thread} />} title="Customer Frequency & Recency" subtitle="Per-customer totals for the selected period, highest sales first">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${hairline}` }}>
                <th style={{ textAlign: "left", padding: "5px 6px", fontSize: 11, color: muted, fontWeight: 700 }}>Customer</th>
                <th style={{ textAlign: "right", padding: "5px 6px", fontSize: 11, color: muted, fontWeight: 700 }}>Sales</th>
                <th style={{ textAlign: "right", padding: "5px 6px", fontSize: 11, color: muted, fontWeight: 700 }}>Invoices</th>
                <th style={{ textAlign: "right", padding: "5px 6px", fontSize: 11, color: muted, fontWeight: 700 }}>Avg Invoice</th>
                <th style={{ textAlign: "right", padding: "5px 6px", fontSize: 11, color: muted, fontWeight: 700 }}>Last Purchase</th>
              </tr>
            </thead>
            <tbody>
              {custPageRows.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "24px 8px", fontSize: 13, color: muted, textAlign: "center" }}>No sales in this period.</td></tr>
              ) : (
                custPageRows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${hairline}` }}>
                    <td style={{ padding: "7px 6px", fontSize: 12.5, fontWeight: 600, color: ink, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</td>
                    <td style={{ padding: "7px 6px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: ink }}>{fmtMoney(r.sales)}</td>
                    <td style={{ padding: "7px 6px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: inkSoft }}>{r.count}</td>
                    <td style={{ padding: "7px 6px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: inkSoft }}>{fmtMoney(r.avg)}</td>
                    <td style={{ padding: "7px 6px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: muted, whiteSpace: "nowrap" }}>{fmtDate(r.lastDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {customerStats.length > CUST_PAGE_SIZE && (
          <div className="flex items-center justify-between mt-3">
            <span style={{ color: muted, fontSize: 12 }}>
              {custPageSafe * CUST_PAGE_SIZE + 1}–{Math.min((custPageSafe + 1) * CUST_PAGE_SIZE, customerStats.length)} of {customerStats.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCustPage((p) => Math.max(0, p - 1))}
                disabled={custPageSafe === 0}
                className="flex items-center justify-center rounded-lg"
                style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: custPageSafe === 0 ? hairline : ink, cursor: custPageSafe === 0 ? "not-allowed" : "pointer" }}
                title="Previous"
              >
                <ArrowLeft size={15} />
              </button>
              <button
                onClick={() => setCustPage((p) => Math.min(custPageCount - 1, p + 1))}
                disabled={custPageSafe >= custPageCount - 1}
                className="flex items-center justify-center rounded-lg"
                style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: custPageSafe >= custPageCount - 1 ? hairline : ink, cursor: custPageSafe >= custPageCount - 1 ? "not-allowed" : "pointer" }}
                title="Next"
              >
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </AnalyticsCard>

      <AnalyticsCard icon={<Users size={17} color={thread} />} title="Customer RFM Scores" subtitle="Recency, Frequency & Monetary — each scored 1-5 by quintile (5 = best), plus average days taken to pay">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 400 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${hairline}` }}>
                <th style={{ textAlign: "left", padding: "5px 6px", fontSize: 11, color: muted, fontWeight: 700 }}>Customer</th>
                <th style={{ textAlign: "center", padding: "5px 6px", fontSize: 11, color: muted, fontWeight: 700 }} title="Recency — how recently they last purchased">R</th>
                <th style={{ textAlign: "center", padding: "5px 6px", fontSize: 11, color: muted, fontWeight: 700 }} title="Frequency — how many invoices">F</th>
                <th style={{ textAlign: "center", padding: "5px 6px", fontSize: 11, color: muted, fontWeight: 700 }} title="Monetary — total sales value">M</th>
                <th style={{ textAlign: "left", padding: "5px 6px", fontSize: 11, color: muted, fontWeight: 700 }}>Payment Days</th>
              </tr>
            </thead>
            <tbody>
              {rfmPageRows.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "24px 8px", fontSize: 13, color: muted, textAlign: "center" }}>No sales in this period.</td></tr>
              ) : (
                rfmPageRows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${hairline}` }}>
                    <td style={{ padding: "7px 6px", fontSize: 12.5, fontWeight: 600, color: ink, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</td>
                    <td style={{ padding: "7px 6px", fontSize: 13, textAlign: "center", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: rfmScoreColor(r.R) }}>{r.R}</td>
                    <td style={{ padding: "7px 6px", fontSize: 13, textAlign: "center", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: rfmScoreColor(r.F) }}>{r.F}</td>
                    <td style={{ padding: "7px 6px", fontSize: 13, textAlign: "center", fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: rfmScoreColor(r.M) }}>{r.M}</td>
                    <td style={{ padding: "7px 6px", fontSize: 12.5, textAlign: "left", fontFamily: "'IBM Plex Mono', monospace", color: r.payDays == null ? muted : inkSoft }}>
                      {r.payDays == null ? "—" : r.payDays}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <button
            onClick={() => setShowRfmDetail(true)}
            disabled={rfmRows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: card, border: `1px solid ${hairline}`, color: rfmRows.length === 0 ? muted : thread, cursor: rfmRows.length === 0 ? "not-allowed" : "pointer" }}
          >
            View All
          </button>
          {rfmRows.length > RFM_PAGE_SIZE && (
            <div className="flex items-center gap-2">
              <span style={{ color: muted, fontSize: 12 }}>
                {rfmPageSafe * RFM_PAGE_SIZE + 1}–{Math.min((rfmPageSafe + 1) * RFM_PAGE_SIZE, rfmRows.length)} of {rfmRows.length}
              </span>
              <button
                onClick={() => setRfmPage((p) => Math.max(0, p - 1))}
                disabled={rfmPageSafe === 0}
                className="flex items-center justify-center rounded-lg"
                style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: rfmPageSafe === 0 ? hairline : ink, cursor: rfmPageSafe === 0 ? "not-allowed" : "pointer" }}
                title="Previous"
              >
                <ArrowLeft size={15} />
              </button>
              <button
                onClick={() => setRfmPage((p) => Math.min(rfmPageCount - 1, p + 1))}
                disabled={rfmPageSafe >= rfmPageCount - 1}
                className="flex items-center justify-center rounded-lg"
                style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: rfmPageSafe >= rfmPageCount - 1 ? hairline : ink, cursor: rfmPageSafe >= rfmPageCount - 1 ? "not-allowed" : "pointer" }}
                title="Next"
              >
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
        <p style={{ color: muted, fontSize: 11, marginTop: 10, lineHeight: 1.45 }}>
          Scores are relative rankings within this customer base, not absolute grades — a 5 means "top fifth of your customers," so they shift as the period or customer list changes. Payment Days is amount-weighted; receipts recorded "on account" are allocated oldest-invoice-first, so it's an approximation where payments aren't linked to specific invoices.
        </p>
      </AnalyticsCard>

      <AnalyticsCard
        icon={<IndianRupee size={17} color={thread} />}
        title="Other Expenses by Customer"
        subtitle="Other expenses charged on invoices, as a % of the pre-expense subtotal — tap any row for the invoice-wise breakdown"
      >
        {expenseRows.length === 0 ? (
          <div style={{ color: muted, fontSize: 13, padding: "18px 0", textAlign: "center" }}>
            No invoices in this period.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>CUSTOMER</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>SUBTOTAL</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>OTHER EXP.</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseRows.slice(expPageSafe * ANALYTICS_PAGE, (expPageSafe + 1) * ANALYTICS_PAGE).map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setExpCustomer(r)}
                      style={{ cursor: "pointer" }}
                      title="View invoice-wise breakdown"
                    >
                      <td style={{ padding: "7px 8px", fontSize: 12.5, color: ink, fontWeight: 600, borderBottom: `1px solid ${hairline}`, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.name}
                        <span style={{ color: muted, fontWeight: 500 }}> ({r.count})</span>
                      </td>
                      <td style={{ padding: "7px 8px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: inkSoft, borderBottom: `1px solid ${hairline}` }}>{fmtMoney(r.subtotal)}</td>
                      <td style={{ padding: "7px 8px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: inkSoft, borderBottom: `1px solid ${hairline}` }}>{fmtMoney(r.expense)}</td>
                      <td style={{ padding: "7px 8px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink, borderBottom: `1px solid ${hairline}` }}>{r.pct.toFixed(2)}%</td>
                    </tr>
                  ))}
                  <tr style={{ background: paper }}>
                    <td style={{ padding: "8px", fontSize: 12.5, fontWeight: 700, color: ink }}>Total</td>
                    <td style={{ padding: "8px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>{fmtMoney(expenseTotals.subtotal)}</td>
                    <td style={{ padding: "8px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>{fmtMoney(expenseTotals.expense)}</td>
                    <td style={{ padding: "8px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: ink }}>{expenseTotals.pct.toFixed(2)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {expPageCount > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span style={{ color: muted, fontSize: 12 }}>
                  {expPageSafe * ANALYTICS_PAGE + 1}–{Math.min((expPageSafe + 1) * ANALYTICS_PAGE, expenseRows.length)} of {expenseRows.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpPage((p) => Math.max(0, p - 1))}
                    disabled={expPageSafe === 0}
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: expPageSafe === 0 ? hairline : ink, cursor: expPageSafe === 0 ? "not-allowed" : "pointer" }}
                    title="Previous"
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <button
                    onClick={() => setExpPage((p) => Math.min(expPageCount - 1, p + 1))}
                    disabled={expPageSafe >= expPageCount - 1}
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: expPageSafe >= expPageCount - 1 ? hairline : ink, cursor: expPageSafe >= expPageCount - 1 ? "not-allowed" : "pointer" }}
                    title="Next"
                  >
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}
            <p style={{ color: muted, fontSize: 11, marginTop: 10, lineHeight: 1.45 }}>
              Subtotal is the line-item total before other expenses, so the % shows what was added on top. The Total row is the overall ratio across all customers, not an average of the individual percentages.
            </p>
          </>
        )}
      </AnalyticsCard>

      <AnalyticsCard
        icon={<Landmark size={17} color={thread} />}
        title={`Location-wise ${locBalSource === "vendor" ? "Vendor" : "Customer"} Balances`}
        subtitle="Outstanding balances grouped by address — tap any row to see the parties behind it"
      >
        <div className="mb-3" style={{ maxWidth: 180 }}>
          <div style={{ color: muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Customer / Vendor</div>
          <InlineSelect
            value={locBalSource}
            onChange={(v) => { setLocBalSource(v); setLocBalPage(0); }}
            options={[{ value: "customer", label: "Customer" }, { value: "vendor", label: "Vendor" }]}
            className="px-2.5 py-1.5 rounded-lg text-sm outline-none w-full"
            style={{ border: `1px solid ${hairline}`, color: ink, background: "#fff" }}
          />
        </div>

        {locBalances.length === 0 ? (
          <div style={{ color: muted, fontSize: 13, padding: "18px 0", textAlign: "center" }}>
            No outstanding balances.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>LOCATION</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>DR</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>CR</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 11, fontWeight: 700, color: muted, borderBottom: `1px solid ${hairline}` }}>NET</th>
                  </tr>
                </thead>
                <tbody>
                  {locBalances.slice(locBalPageSafe * LOCBAL_PAGE, (locBalPageSafe + 1) * LOCBAL_PAGE).map((r) => (
                    <tr key={r.label} onClick={() => setLocBalDetail(r)} style={{ cursor: "pointer" }} title="View parties in this location">
                      <td style={{ padding: "7px 8px", fontSize: 12.5, color: ink, fontWeight: 600, borderBottom: `1px solid ${hairline}`, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.label}
                        <span style={{ color: muted, fontWeight: 500 }}> ({r.parties.length})</span>
                      </td>
                      <td style={{ padding: "7px 8px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: r.dr ? success : muted, borderBottom: `1px solid ${hairline}` }}>{r.dr ? fmtMoney(r.dr) : "—"}</td>
                      <td style={{ padding: "7px 8px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", color: r.cr ? danger : muted, borderBottom: `1px solid ${hairline}` }}>{r.cr ? fmtMoney(r.cr) : "—"}</td>
                      <td style={{ padding: "7px 8px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: r.net >= 0 ? success : danger, borderBottom: `1px solid ${hairline}`, whiteSpace: "nowrap" }}>
                        {fmtMoney(Math.abs(r.net))}<span style={{ fontSize: 9, fontWeight: 700 }}>{r.net >= 0 ? " DR" : " CR"}</span>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: paper }}>
                    <td style={{ padding: "8px", fontSize: 12.5, fontWeight: 700, color: ink }}>Total</td>
                    <td style={{ padding: "8px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: success }}>{fmtMoney(locBalTotals.dr)}</td>
                    <td style={{ padding: "8px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: danger }}>{fmtMoney(locBalTotals.cr)}</td>
                    <td style={{ padding: "8px", fontSize: 12.5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: (locBalTotals.dr - locBalTotals.cr) >= 0 ? success : danger, whiteSpace: "nowrap" }}>
                      {fmtMoney(Math.abs(locBalTotals.dr - locBalTotals.cr))}<span style={{ fontSize: 9, fontWeight: 700 }}>{(locBalTotals.dr - locBalTotals.cr) >= 0 ? " DR" : " CR"}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {locBalPageCount > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span style={{ color: muted, fontSize: 12 }}>
                  {locBalPageSafe * LOCBAL_PAGE + 1}–{Math.min((locBalPageSafe + 1) * LOCBAL_PAGE, locBalances.length)} of {locBalances.length}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setLocBalPage((p) => Math.max(0, p - 1))} disabled={locBalPageSafe === 0}
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: locBalPageSafe === 0 ? hairline : ink, cursor: locBalPageSafe === 0 ? "not-allowed" : "pointer" }}>
                    <ArrowLeft size={15} />
                  </button>
                  <button onClick={() => setLocBalPage((p) => Math.min(locBalPageCount - 1, p + 1))} disabled={locBalPageSafe >= locBalPageCount - 1}
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 30, height: 30, background: card, border: `1px solid ${hairline}`, color: locBalPageSafe >= locBalPageCount - 1 ? hairline : ink, cursor: locBalPageSafe >= locBalPageCount - 1 ? "not-allowed" : "pointer" }}>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}
            <p style={{ color: muted, fontSize: 11, marginTop: 10, lineHeight: 1.45 }}>
              Balances are as of today, not limited to the selected period — an outstanding balance is a point-in-time figure. Parties with a nil balance are excluded.
            </p>
          </>
        )}
      </AnalyticsCard>

      <AnalyticsCard
        icon={<BarChart3 size={17} color={thread} />}
        title={scatterSource === "purchase" ? "Qty Purchased vs. Price" : "Qty Sold vs. Price"}
        subtitle={`Each dot is one ${scatterSource === "purchase" ? "purchase bill" : "invoice"} line item — denser clusters show where volume concentrates`}
      >
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div style={{ maxWidth: 160 }}>
            <div style={{ color: muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Sale / Purchase</div>
            <InlineSelect
              value={scatterSource}
              onChange={setScatterSource}
              options={[{ value: "sale", label: "Sale" }, { value: "purchase", label: "Purchase" }]}
              className="px-2.5 py-1.5 rounded-lg text-sm outline-none w-full"
              style={{ border: `1px solid ${hairline}`, color: ink, background: "#fff" }}
            />
          </div>
          <div style={{ maxWidth: 220 }}>
            <div style={{ color: muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Unit</div>
            <InlineSelect
              value={scatterUnit}
              onChange={setScatterUnit}
              options={[{ value: "all", label: "All Units" }, ...UNIT_OPTIONS.map((u) => ({ value: u, label: u }))]}
              className="px-2.5 py-1.5 rounded-lg text-sm outline-none w-full"
              style={{ border: `1px solid ${hairline}`, color: ink, background: "#fff" }}
            />
          </div>
          <div style={{ width: 130 }}>
            <div style={{ color: muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Min Price</div>
            <input
              type="number" inputMode="decimal" value={priceMin} onChange={(e) => setPriceMin(e.target.value)}
              placeholder="0" className="px-2.5 py-1.5 rounded-lg text-sm outline-none w-full"
              style={{ border: `1px solid ${hairline}`, color: ink, fontFamily: "'IBM Plex Mono', monospace" }}
            />
          </div>
          <div style={{ width: 130 }}>
            <div style={{ color: muted, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Max Price</div>
            <input
              type="number" inputMode="decimal" value={priceMax} onChange={(e) => setPriceMax(e.target.value)}
              placeholder="No limit" className="px-2.5 py-1.5 rounded-lg text-sm outline-none w-full"
              style={{ border: `1px solid ${hairline}`, color: ink, fontFamily: "'IBM Plex Mono', monospace" }}
            />
          </div>
          {(priceMin !== "" || priceMax !== "") && (
            <button onClick={() => { setPriceMin(""); setPriceMax(""); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${hairline}`, color: muted }}>
              Clear
            </button>
          )}
        </div>
        <ScatterChart
          points={rateQtyPoints}
          xLabel="Rate (₹)"
          yLabel="Qty"
          color={thread}
          highlightFrom={hasPriceRange ? null : bestRateBucket?.from}
          highlightTo={hasPriceRange ? null : bestRateBucket?.to}
        />
        {priceRangeResult ? (
          <div className="flex items-center justify-between flex-wrap gap-2 mt-2">
            <p style={{ color: inkSoft, fontSize: 12.5, fontWeight: 600 }}>
              {fmtNum(priceRangeResult.qty)} units {scatterSource === "purchase" ? "purchased" : "sold"} between {priceMin !== "" ? fmtMoney(priceMin) : "₹0"} and {priceMax !== "" ? fmtMoney(priceMax) : "no limit"}
              {" "}— across {priceRangeResult.lines} line item{priceRangeResult.lines !== 1 ? "s" : ""}, worth {fmtMoney(priceRangeResult.amount)}.
            </p>
            <button onClick={() => setShowScatterTable(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: card, border: `1px solid ${hairline}`, color: thread }}>
              View Table
            </button>
          </div>
        ) : bestRateBucket && (
          <div className="flex items-center justify-between flex-wrap gap-2 mt-2">
            <p style={{ color: inkSoft, fontSize: 12.5, fontWeight: 600 }}>
              Most quantity {scatterSource === "purchase" ? "purchased" : "sold"} in the {fmtMoney(bestRateBucket.from)}–{fmtMoney(bestRateBucket.to)} price range ({fmtNum(bestRateBucket.qty)} units) — shaded above.
            </p>
            {scatterUnit !== "all" && (
              <button onClick={() => setShowScatterTable(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap" style={{ background: card, border: `1px solid ${hairline}`, color: thread }}>
                View Table
              </button>
            )}
          </div>
        )}
      </AnalyticsCard>

      {showScatterTable && (
        <ScatterDetailModal
          title={scatterSource === "purchase" ? "Qty Purchased vs. Price — Line Items" : "Qty Sold vs. Price — Line Items"}
          scopeLabel={`${scatterSource === "purchase" ? "Purchase" : "Sale"} · ${scatterUnit === "all" ? "All Units" : scatterUnit}${hasPriceRange ? ` · ${priceMin !== "" ? fmtMoney(priceMin) : "₹0"}–${priceMax !== "" ? fmtMoney(priceMax) : "no limit"}` : ""}`}
          rows={scatterFilteredRows}
          onClose={() => setShowScatterTable(false)}
          partyLabel={scatterSource === "purchase" ? "Vendor" : "Customer"}
          qtyLabel={scatterSource === "purchase" ? "Qty Purchased" : "Qty Sold"}
        />
      )}
    </div>
  );
}
