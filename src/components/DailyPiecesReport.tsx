import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, doc, getDoc, setDoc, query, where, Timestamp } from "firebase/firestore";
import { db } from "../firebase";

// Types
type ClientPieces = {
  clientName: string;
  pieces: number;
};

type ProductPieces = {
  productName: string;
  pieces: number;
};

type RangeType = "day" | "week" | "month" | "custom";

type WeekStart = "monday" | "sunday";

type DateRange = {
  start: Date; // inclusive
  endExclusive: Date; // exclusive upper bound
  label: string;
};

// New: Area classification
type AreaType = "Mangle" | "Doblado" | "Segregation";

// Utils
function toYMD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toYM(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseYMD(ymd: string | undefined | null): Date | null {
  if (!ymd) return null;
  const [yStr, mStr, dStr] = ymd.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseYM(ym: string | undefined | null): { y: number; m: number } | null {
  if (!ym) return null;
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return null;
  return { y, m };
}

function addDays(d: Date, delta: number) {
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + delta);
  return copy;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function getWeekStart(anchor: Date, weekStartsOn: WeekStart): Date {
  const d = startOfDay(anchor);
  const day = d.getDay(); // 0=Sun .. 6=Sat
  if (weekStartsOn === "sunday") {
    return addDays(d, -day);
  }
  // monday
  const dayMon = day === 0 ? 7 : day; // 1..7
  return addDays(d, -(dayMon - 1)); // back to Monday
}

function formatRangeLabel(start: Date, endInclusive: Date) {
  const fmtOpts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
  const s = start.toLocaleDateString(undefined, fmtOpts);
  const e = endInclusive.toLocaleDateString(undefined, fmtOpts);
  if (s === e) return s;
  return `${s} – ${e}`;
}

function getPreviousRange(current: DateRange, kind: RangeType, weekStartsOn: WeekStart): DateRange {
  const start = current.start;
  if (kind === "day") {
    const prevStart = addDays(start, -1);
    return { start: startOfDay(prevStart), endExclusive: startOfDay(start), label: formatRangeLabel(startOfDay(prevStart), addDays(startOfDay(start), -1)) };
  }
  if (kind === "week") {
    const prevStart = addDays(start, -7);
    const prevEndInclusive = addDays(prevStart, 6);
    return { start: startOfDay(prevStart), endExclusive: addDays(prevEndInclusive, 1), label: formatRangeLabel(startOfDay(prevStart), prevEndInclusive) };
  }
  if (kind === "month") {
    const y = start.getFullYear();
    const m = start.getMonth();
    const prevStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const prevEndExclusive = new Date(y, m, 1, 0, 0, 0, 0);
    return { start: prevStart, endExclusive: prevEndExclusive, label: formatRangeLabel(prevStart, addDays(prevEndExclusive, -1)) };
  }
  // custom: mirror duration length
  const durationMs = current.endExclusive.getTime() - current.start.getTime();
  const prevStartMs = current.start.getTime() - durationMs;
  const prevStart = new Date(prevStartMs);
  const prevEndExclusive = new Date(current.start);
  return { start: startOfDay(prevStart), endExclusive: prevEndExclusive, label: formatRangeLabel(startOfDay(prevStart), addDays(prevEndExclusive, -1)) };
}

// Helpers for area mapping
function normalizeProductKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
function inferAreaFromName(name: string): AreaType | null {
  const n = normalizeProductKey(name);
  if (/(mangle|mangl|plancha|planchado|planch|mangler)/i.test(n)) return "Mangle";
  if (/(dobla|doblado|fold|folded)/i.test(n)) return "Doblado";
  if (/(segreg|segregation|segregado|segregado|separ|clasif)/i.test(n)) return "Segregation";
  return null;
}

const DailyPiecesReport: React.FC = () => {
  // Range selection state
  const [rangeType, setRangeType] = useState<RangeType>("day");
  const [selectedDate, setSelectedDate] = useState<string>(() => toYMD(new Date())); // for day
  const [weekAnchor, setWeekAnchor] = useState<string>(() => toYMD(new Date())); // any day within desired week
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStart>("monday");
  const [monthStr, setMonthStr] = useState<string>(() => toYM(new Date())); // YYYY-MM
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  // Other controls
  const [hours, setHours] = useState<string>("");
  // New segmented hours
  const [hoursMangle, setHoursMangle] = useState<string>("");
  const [hoursDoblado, setHoursDoblado] = useState<string>("");
  const [hoursSegregation, setHoursSegregation] = useState<string>("");

  // New: four-area hours and costs (Uniformes, Doblado, Industrial, Supervisores)
  const [hoursUniformes, setHoursUniformes] = useState<string>("");
  const [overtimeUniformes, setOvertimeUniformes] = useState<string>("");
  const [costUniformes, setCostUniformes] = useState<string>("");
  const [overtimeCostUniformes, setOvertimeCostUniformes] = useState<string>("");

  const [hoursDobladoNew, setHoursDobladoNew] = useState<string>("");
  const [overtimeDoblado, setOvertimeDoblado] = useState<string>("");
  const [costDoblado, setCostDoblado] = useState<string>("");
  const [overtimeCostDoblado, setOvertimeCostDoblado] = useState<string>("");

  const [hoursIndustrial, setHoursIndustrial] = useState<string>("");
  const [overtimeIndustrial, setOvertimeIndustrial] = useState<string>("");
  const [costIndustrial, setCostIndustrial] = useState<string>("");
  const [overtimeCostIndustrial, setOvertimeCostIndustrial] = useState<string>("");

  const [hoursSupervisores, setHoursSupervisores] = useState<string>("");
  const [overtimeSupervisores, setOvertimeSupervisores] = useState<string>("");
  const [costSupervisores, setCostSupervisores] = useState<string>("");
  const [overtimeCostSupervisores, setOvertimeCostSupervisores] = useState<string>("");

  // New: control to include/exclude price-per-piece in PPH calculations (behavior pending clarification)
  const [includePriceInPPH, setIncludePriceInPPH] = useState<boolean>(false);

  const [excludePeso, setExcludePeso] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedAt, setSavedAt] = useState<string>("");

  // Comparison state
  const [compareEnabled, setCompareEnabled] = useState<boolean>(true);
  const [prevTotalPieces, setPrevTotalPieces] = useState<number>(0);

  // Data state
  const [loading, setLoading] = useState<boolean>(false);
  const [totalPieces, setTotalPieces] = useState<number>(0);
  // New: per area totals
  const [totalPiecesMangle, setTotalPiecesMangle] = useState<number>(0);
  const [totalPiecesDoblado, setTotalPiecesDoblado] = useState<number>(0);
  const [totalPiecesSegregation, setTotalPiecesSegregation] = useState<number>(0);
  // New: total weight within range (from pickup_entries) and previous
  const [totalWeight, setTotalWeight] = useState<number>(0);
  const [prevTotalWeight, setPrevTotalWeight] = useState<number>(0);

  const [byClient, setByClient] = useState<ClientPieces[]>([]);
  const [byProduct, setByProduct] = useState<ProductPieces[]>([]);
  const [prevByProduct, setPrevByProduct] = useState<ProductPieces[]>([]);
  const [scanInfo, setScanInfo] = useState<{ invoices: number; items: number }>({ invoices: 0, items: 0 });

  // Also track previous period saved hours (to compare throughput)
  const [prevHours, setPrevHours] = useState<number | null>(null);
  // New: prev segmented hours
  const [prevMangleHours, setPrevMangleHours] = useState<number | null>(null);
  const [prevDobladoHours, setPrevDobladoHours] = useState<number | null>(null);
  const [prevSegregationHours, setPrevSegregationHours] = useState<number | null>(null);
  // New: previous per-area totals
  const [prevPiecesMangle, setPrevPiecesMangle] = useState<number>(0);
  const [prevPiecesDoblado, setPrevPiecesDoblado] = useState<number>(0);
  const [prevPiecesSegregation, setPrevPiecesSegregation] = useState<number>(0);

  // New: product area mappings loaded from Firestore (normalized key -> area)
  const [productAreas, setProductAreas] = useState<Record<string, AreaType>>({});
  // Bump to re-run aggregation after area edits
  const [areaVersion, setAreaVersion] = useState<number>(0);

  // New: optional conversion factor for segregation logs (weight -> pieces)
  const [segWeightToPieceFactor, setSegWeightToPieceFactor] = useState<number>(1);

  // Try to load conversion factor from optional settings docs (best-effort)
  useEffect(() => {
    let ignore = false;
    const loadFactor = async () => {
      try {
        const tryDocs = [
          doc(db, "appSettings", "segregation"),
          doc(db, "settings", "segregation"),
        ];
        for (const d of tryDocs) {
          try {
            const snap = await getDoc(d);
            if (snap.exists()) {
              const data: any = snap.data();
              const candidates = [
                data?.weightToPieceFactor,
                data?.piecesPerKg,
                data?.piecesPerLb,
                data?.conversionFactor,
              ];
              const n = candidates.map((v) => parseFloat(v)).find((v) => Number.isFinite(v) && v > 0);
              if (!ignore && Number.isFinite(n as number) && (n as number) > 0) {
                setSegWeightToPieceFactor(n as number);
                return;
              }
            }
          } catch {}
        }
      } catch {}
    };
    loadFactor();
    return () => {
      ignore = true;
    };
  }, []);

  // Compute piece-equivalents from a segregation log entry
  const computePiecesFromSegLog = (data: any): number => {
    try {
      // Prefer direct piece-like fields when present
      const pieceKeys = [
        "pieces",
        "pieceCount",
        "count",
        "units",
        "numPieces",
        "numUnits",
        "qty",
        "quantity",
      ];
      for (const k of pieceKeys) {
        const v = (data as any)?.[k];
        const n = parseFloat(v);
        if (Number.isFinite(n) && n > 0) return n;
      }
      // Fallback to weight -> pieces using configured factor
      const w = parseFloat((data as any)?.weight);
      if (Number.isFinite(w) && w > 0) {
        const factor = Number.isFinite(segWeightToPieceFactor) && segWeightToPieceFactor > 0 ? segWeightToPieceFactor : 1;
        return Math.round(w * factor);
      }
    } catch {}
    return 0;
  };

  // Fetch segregation logs and sum piece-equivalents for the given range.
  // Robust to logs that store either a Firestore Timestamp `timestamp` or a string `date` (YYYY-MM-DD).
  const fetchSegregationLogsPiecesForRange = async (range: DateRange): Promise<number> => {
    const seen = new Set<string>();
    let sum = 0;

    // Primary: query by Firestore timestamp range (inclusive start, exclusive end)
    try {
      const qTs = query(
        collection(db, "segregation_done_logs"),
        where("timestamp", ">=", Timestamp.fromDate(range.start)),
        where("timestamp", "<", Timestamp.fromDate(range.endExclusive))
      );
      const snapTs = await getDocs(qTs);
      snapTs.docs.forEach((docSnap) => {
        const id = docSnap.id;
        if (seen.has(id)) return;
        seen.add(id);
        const data = docSnap.data();
        sum += computePiecesFromSegLog(data);
      });
    } catch (e) {
      console.warn("Segregation logs timestamp query failed", e);
    }

    // Secondary: query by string date range (YYYY-MM-DD)
    const startYMD = toYMD(range.start);
    const endYMD = toYMD(addDays(range.endExclusive, -1));
    try {
      const qDateRange = query(
        collection(db, "segregation_done_logs"),
        where("date", ">=", startYMD),
        where("date", "<=", endYMD)
      );
      const snapDateRange = await getDocs(qDateRange);
      snapDateRange.docs.forEach((docSnap) => {
        const id = docSnap.id;
        if (seen.has(id)) return;
        seen.add(id);
        const data = docSnap.data();
        sum += computePiecesFromSegLog(data);
      });
    } catch (e) {
      // Some projects may lack composite index or rely on equality; fall back to per-day equality queries
      try {
        let d = startOfDay(range.start);
        const end = startOfDay(addDays(range.endExclusive, -1));
        while (d <= end) {
          const ymd = toYMD(d);
          try {
            const qEq = query(collection(db, "segregation_done_logs"), where("date", "==", ymd));
            const snapEq = await getDocs(qEq);
            snapEq.docs.forEach((docSnap) => {
              const id = docSnap.id;
              if (seen.has(id)) return;
              seen.add(id);
              const data = docSnap.data();
              sum += computePiecesFromSegLog(data);
            });
          } catch (e2) {
            console.warn("Segregation logs per-day query failed for", ymd, e2);
          }
          d = addDays(d, 1);
        }
      } catch (e2) {
        console.warn("Segregation logs date queries failed", e2);
      }
    }

    return sum;
  };

  // Export per-product totals (with area and optional previous columns)
  const exportCsv = () => {
    const header = compareEnabled
      ? ["Product", "Area", "Current", "Previous", "Delta", "Percent"]
      : ["Product", "Area", "Pieces"];

    const rows = compareEnabled
      ? productCompareRows.map((r) => {
          const key = normalizeProductKey(r.productName);
          const area = (productAreas[key] as string) || "";
          const pctStr = isFinite(r.pct) ? `${r.pct.toFixed(1)}%` : "-";
          return [r.productName, area, String(r.current), String(r.previous), String(r.delta), pctStr];
        })
      : byProduct.map((r) => {
          const key = normalizeProductKey(r.productName);
          const area = (productAreas[key] as string) || "";
          return [r.productName, area, String(r.pieces)];
        });

    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const rangeStr = dateRange ? dateRange.label.replace(/\s+/g, "_") : "range";
    a.download = `daily_pieces_products_${rangeStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const dateRange = useMemo<DateRange | null>(() => {
    try {
      if (rangeType === "day") {
        const d = parseYMD(selectedDate);
        if (!d) return null;
        const start = startOfDay(d);
        const endExclusive = addDays(start, 1);
        return { start, endExclusive, label: formatRangeLabel(start, addDays(endExclusive, -1)) };
      }

      if (rangeType === "week") {
        const d = parseYMD(weekAnchor);
        if (!d) return null;
        const start = getWeekStart(d, weekStartsOn);
        const endInclusive = addDays(start, 6);
        const endExclusive = addDays(endInclusive, 1);
        return { start, endExclusive, label: formatRangeLabel(start, endInclusive) };
      }

      if (rangeType === "month") {
        const parsed = parseYM(monthStr);
        if (!parsed) return null;
        const start = new Date(parsed.y, parsed.m - 1, 1, 0, 0, 0, 0);
        const endExclusive = new Date(parsed.y, parsed.m, 1, 0, 0, 0, 0); // first of next month
        return { start, endExclusive, label: formatRangeLabel(start, addDays(endExclusive, -1)) };
      }

      // custom
      const cs = parseYMD(customStart);
      const ce = parseYMD(customEnd);
      if (!cs || !ce) return null;
      const start = startOfDay(cs);
      const endInclusive = startOfDay(ce);
      const endExclusive = addDays(endInclusive, 1);
      if (start > endInclusive) return null;
      return { start, endExclusive, label: formatRangeLabel(start, endInclusive) };
    } catch (e) {
      return null;
    }
  }, [rangeType, selectedDate, weekAnchor, weekStartsOn, monthStr, customStart, customEnd]);

  const prevRange = useMemo(() => {
    if (!dateRange) return null;
    try {
      return getPreviousRange(dateRange, rangeType, weekStartsOn);
    } catch {
      return null;
    }
  }, [dateRange, rangeType, weekStartsOn]);

  // Build a stable document id for hours persistence for the selected range
  const hoursDocId = useMemo(() => {
    if (!dateRange) return null;
    const startYMD = toYMD(dateRange.start);
    const endYMD = toYMD(addDays(dateRange.endExclusive, -1)); // inclusive end
    if (rangeType === "day") return `day_${startYMD}`;
    if (rangeType === "week") return `week_${weekStartsOn}_${startYMD}`; // week anchored on computed start
    if (rangeType === "month") return `month_${monthStr || toYM(dateRange.start)}`;
    // custom
    return `custom_${startYMD}_${endYMD}`;
  }, [dateRange, rangeType, weekStartsOn, monthStr]);

  // Build previous period hours doc id (if comparing)
  const prevHoursDocId = useMemo(() => {
    if (!prevRange || !compareEnabled) return null;
    const prevStartYMD = toYMD(prevRange.start);
    const prevEndYMD = toYMD(addDays(prevRange.endExclusive, -1));
    if (rangeType === "day") return `day_${prevStartYMD}`;
    if (rangeType === "week") return `week_${weekStartsOn}_${prevStartYMD}`;
    if (rangeType === "month") return `month_${toYM(prevRange.start)}`;
    return `custom_${prevStartYMD}_${prevEndYMD}`;
  }, [prevRange, compareEnabled, rangeType, weekStartsOn]);

  // Auto-load saved hours for the selected period
  useEffect(() => {
    let ignore = false;
    const load = async () => {
      if (!hoursDocId) return;
      try {
        const ref = doc(db, "workHours", hoursDocId);
        const snap = await getDoc(ref);
        if (!ignore && snap.exists()) {
          const data: any = snap.data();
          const hTotal = typeof data?.hoursTotal === "number" ? data.hoursTotal : (typeof data?.hours === "number" ? data.hours : parseFloat(data?.hours || ""));
          const hM = typeof data?.hoursMangle === "number" ? data.hoursMangle : parseFloat(data?.hoursMangle || "");
          const hD = typeof data?.hoursDoblado === "number" ? data.hoursDoblado : parseFloat(data?.hoursDoblado || "");
          const hS = typeof data?.hoursSegregation === "number" ? data.hoursSegregation : parseFloat(data?.hoursSegregation || "");
          setHours(Number.isFinite(hTotal) ? String(hTotal) : "");
          setHoursMangle(Number.isFinite(hM) ? String(hM) : "");
          setHoursDoblado(Number.isFinite(hD) ? String(hD) : "");
          setHoursSegregation(Number.isFinite(hS) ? String(hS) : "");

          // Load new-format fields (with fallback from legacy where sensible)
          const u = typeof data?.hoursUniformes === "number" ? data.hoursUniformes : (typeof data?.hoursMangle === "number" ? data.hoursMangle : parseFloat(data?.hoursUniformes || data?.hoursMangle || ""));
          const uOT = typeof data?.overtimeUniformes === "number" ? data.overtimeUniformes : parseFloat(data?.overtimeUniformes || "");
          const uCost = typeof data?.costUniformes === "number" ? data.costUniformes : parseFloat(data?.costUniformes || "");
          const uOtCost = typeof data?.overtimeCostUniformes === "number" ? data.overtimeCostUniformes : parseFloat(data?.overtimeCostUniformes || "");
          setHoursUniformes(Number.isFinite(u) ? String(u) : "");
          setOvertimeUniformes(Number.isFinite(uOT) ? String(uOT) : "");
          setCostUniformes(Number.isFinite(uCost) ? String(uCost) : "");
          setOvertimeCostUniformes(Number.isFinite(uOtCost) ? String(uOtCost) : "");

          const dNew = typeof data?.hoursDobladoNew === "number" ? data.hoursDobladoNew : (typeof data?.hoursDoblado === "number" ? data.hoursDoblado : parseFloat(data?.hoursDobladoNew || data?.hoursDoblado || ""));
          const dOT = typeof data?.overtimeDoblado === "number" ? data.overtimeDoblado : parseFloat(data?.overtimeDoblado || "");
          const dCost = typeof data?.costDoblado === "number" ? data.costDoblado : parseFloat(data?.costDoblado || "");
          const dOtCost = typeof data?.overtimeCostDoblado === "number" ? data.overtimeCostDoblado : parseFloat(data?.overtimeCostDoblado || "");
          setHoursDobladoNew(Number.isFinite(dNew) ? String(dNew) : "");
          setOvertimeDoblado(Number.isFinite(dOT) ? String(dOT) : "");
          setCostDoblado(Number.isFinite(dCost) ? String(dCost) : "");
          setOvertimeCostDoblado(Number.isFinite(dOtCost) ? String(dOtCost) : "");

          const i = typeof data?.hoursIndustrial === "number" ? data.hoursIndustrial : parseFloat(data?.hoursIndustrial || "");
          const iOT = typeof data?.overtimeIndustrial === "number" ? data.overtimeIndustrial : parseFloat(data?.overtimeIndustrial || "");
          const iCost = typeof data?.costIndustrial === "number" ? data.costIndustrial : parseFloat(data?.costIndustrial || "");
          const iOtCost = typeof data?.overtimeCostIndustrial === "number" ? data.overtimeCostIndustrial : parseFloat(data?.overtimeCostIndustrial || "");
          setHoursIndustrial(Number.isFinite(i) ? String(i) : "");
          setOvertimeIndustrial(Number.isFinite(iOT) ? String(iOT) : "");
          setCostIndustrial(Number.isFinite(iCost) ? String(iCost) : "");
          setOvertimeCostIndustrial(Number.isFinite(iOtCost) ? String(iOtCost) : "");

          const s = typeof data?.hoursSupervisores === "number" ? data.hoursSupervisores : parseFloat(data?.hoursSupervisores || "");
          const sOT = typeof data?.overtimeSupervisores === "number" ? data.overtimeSupervisores : parseFloat(data?.overtimeSupervisores || "");
          const sCost = typeof data?.costSupervisores === "number" ? data.costSupervisores : parseFloat(data?.costSupervisores || "");
          const sOtCost = typeof data?.overtimeCostSupervisores === "number" ? data.overtimeCostSupervisores : parseFloat(data?.overtimeCostSupervisores || "");
          setHoursSupervisores(Number.isFinite(s) ? String(s) : "");
          setOvertimeSupervisores(Number.isFinite(sOT) ? String(sOT) : "");
          setCostSupervisores(Number.isFinite(sCost) ? String(sCost) : "");
          setOvertimeCostSupervisores(Number.isFinite(sOtCost) ? String(sOtCost) : "");

          // Load persisted toggle for price-per-piece inclusion
          setIncludePriceInPPH(Boolean(data?.includePriceInPPH));

          setSavedAt(data?.updatedAt || "");
        } else if (!ignore) {
          setHours("");
          setHoursMangle("");
          setHoursDoblado("");
          setHoursSegregation("");
          setHoursUniformes("");
          setOvertimeUniformes("");
          setCostUniformes("");
          setOvertimeCostUniformes("");
          setHoursDobladoNew("");
          setOvertimeDoblado("");
          setCostDoblado("");
          setOvertimeCostDoblado("");
          setHoursIndustrial("");
          setOvertimeIndustrial("");
          setCostIndustrial("");
          setOvertimeCostIndustrial("");
          setHoursSupervisores("");
          setOvertimeSupervisores("");
          setCostSupervisores("");
          setOvertimeCostSupervisores("");
          setSavedAt("");
          setIncludePriceInPPH(false);
        }
      } catch (e) {
        // keep current input on read errors
        console.warn("Failed to load saved hours", e);
      }
    };
    load();
    return () => {
      ignore = true;
    };
  }, [hoursDocId]);

  // Load previous period hours (if any) when comparing
  useEffect(() => {
    setPrevHours(null);
    setPrevMangleHours(null);
    setPrevDobladoHours(null);
    setPrevSegregationHours(null);
    if (!prevHoursDocId) return;
    let ignore = false;
    const loadPrev = async () => {
      try {
        const ref = doc(db, "workHours", prevHoursDocId);
        const snap = await getDoc(ref);
        if (!ignore && snap.exists()) {
          const data: any = snap.data();
          // Prefer new format totals
          const u = (typeof data?.hoursUniformes === "number" ? data.hoursUniformes : parseFloat(data?.hoursUniformes || "")) + (typeof data?.overtimeUniformes === "number" ? data.overtimeUniformes : parseFloat(data?.overtimeUniformes || ""));
          const d = (typeof data?.hoursDobladoNew === "number" ? data.hoursDobladoNew : (typeof data?.hoursDoblado === "number" ? data.hoursDoblado : parseFloat(data?.hoursDobladoNew || data?.hoursDoblado || ""))) + (typeof data?.overtimeDoblado === "number" ? data.overtimeDoblado : parseFloat(data?.overtimeDoblado || ""));
          const i = (typeof data?.hoursIndustrial === "number" ? data.hoursIndustrial : parseFloat(data?.hoursIndustrial || "")) + (typeof data?.overtimeIndustrial === "number" ? data.overtimeIndustrial : parseFloat(data?.overtimeIndustrial || ""));
          const s = (typeof data?.hoursSupervisores === "number" ? data.hoursSupervisores : parseFloat(data?.hoursSupervisores || "")) + (typeof data?.overtimeSupervisores === "number" ? data.overtimeSupervisores : parseFloat(data?.overtimeSupervisores || ""));
          const sumNew = [u, d, i, s].reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);

          if (sumNew > 0) {
            setPrevHours(sumNew);
            setPrevMangleHours(Number.isFinite(u) ? u : null);
            setPrevDobladoHours(Number.isFinite(d) ? d : null);
            setPrevSegregationHours(null);
          } else {
            // Fallback to legacy
            const hTotal = typeof data?.hoursTotal === "number" ? data.hoursTotal : (typeof data?.hours === "number" ? data.hours : parseFloat(data?.hours || ""));
            const hM = typeof data?.hoursMangle === "number" ? data.hoursMangle : parseFloat(data?.hoursMangle || "");
            const hD = typeof data?.hoursDoblado === "number" ? data.hoursDoblado : parseFloat(data?.hoursDoblado || "");
            const hS = typeof data?.hoursSegregation === "number" ? data.hoursSegregation : parseFloat(data?.hoursSegregation || "");
            const total = (Number.isFinite(hM) ? hM : 0) + (Number.isFinite(hD) ? hD : 0) + (Number.isFinite(hS) ? hS : 0);
            setPrevHours(Number.isFinite(total) && total > 0 ? total : (Number.isFinite(hTotal) ? hTotal : null));
            setPrevMangleHours(Number.isFinite(hM) ? hM : null);
            setPrevDobladoHours(Number.isFinite(hD) ? hD : null);
            setPrevSegregationHours(Number.isFinite(hS) ? hS : null);
          }
        }
      } catch (e) {
        console.warn("Failed to load previous hours", e);
        setPrevHours(null);
        setPrevMangleHours(null);
        setPrevDobladoHours(null);
        setPrevSegregationHours(null);
      }
    };
    loadPrev();
    return () => {
      ignore = true;
    };
  }, [prevHoursDocId]);

  useEffect(() => {
    const fetchData = async () => {
      if (!dateRange) return;
      setLoading(true);
      try {
        // Load product area mappings
        const areaSnap = await getDocs(collection(db, "productAreas"));
        const areaMap = new Map<string, AreaType>();
        areaSnap.docs.forEach((d) => {
          const data: any = d.data();
          const area: string | undefined = data?.area || data?.areaType;
          if (area === "Mangle" || area === "Doblado" || area === "Segregation") {
            areaMap.set(d.id, area);
          }
        });
        // Reflect current saved mappings in state for inline editor
        setProductAreas(Object.fromEntries(areaMap.entries()) as Record<string, AreaType>);

        const snapshot = await getDocs(collection(db, "invoices"));
        const toPersist: Array<{ key: string; area: AreaType; example: string }> = [];

        // helper to process one range
        const processRange = (range: DateRange) => {
          let total = 0;
          let totalM = 0;
          let totalD = 0;
          let totalS = 0;
          let invoicesCount = 0;
          let itemsScanned = 0;
          const clientMap = new Map<string, number>();
          const productMap = new Map<string, number>();

          snapshot.docs.forEach((docSnap) => {
            const inv: any = docSnap.data();
            const clientName = inv.clientName || "Unknown Client";
            const carts = inv.carts || [];
            let invoiceHasItemsInRange = false;

            carts.forEach((cart: any) => {
              const items = cart.items || [];
              items.forEach((item: any) => {
                let addedAt: Date | null = null;
                if (item?.addedAt) {
                  if (typeof item.addedAt?.toDate === "function") {
                    addedAt = item.addedAt.toDate();
                  } else {
                    const dt = new Date(item.addedAt);
                    if (!isNaN(dt.getTime())) addedAt = dt;
                  }
                }
                if (!addedAt) return;
                if (addedAt >= range.start && addedAt < range.endExclusive) {
                  const name = (item.productName || "Unknown").toString();
                  if (excludePeso && name.toLowerCase().includes("peso")) return;
                  const qty = Number(item.quantity) || 0;
                  if (qty > 0) {
                    itemsScanned++;
                    invoiceHasItemsInRange = true;
                    total += qty;
                    clientMap.set(clientName, (clientMap.get(clientName) || 0) + qty);
                    productMap.set(name, (productMap.get(name) || 0) + qty);

                    // Area classification
                    const key = normalizeProductKey(name);
                    let area = areaMap.get(key) as AreaType | undefined;
                    if (!area) {
                      const inferred = inferAreaFromName(name);
                      if (inferred) {
                        area = inferred;
                        // record to persist mapping for the future
                        if (!areaMap.has(key)) {
                          areaMap.set(key, inferred);
                          toPersist.push({ key, area: inferred, example: name });
                        }
                      }
                    }
                    if (area === "Mangle") totalM += qty;
                    else if (area === "Doblado") totalD += qty;
                    else if (area === "Segregation") totalS += qty;
                  }
                }
              });
            });

            if (invoiceHasItemsInRange) invoicesCount++;
          });

          return { total, totalM, totalD, totalS, invoicesCount, itemsScanned, clientMap, productMap };
        };

        // current
        const cur = processRange(dateRange);
        const breakdownClients: ClientPieces[] = Array.from(cur.clientMap.entries())
          .map(([clientName, pieces]) => ({ clientName, pieces }))
          .sort((a, b) => b.pieces - a.pieces);
        const breakdownProducts: ProductPieces[] = Array.from(cur.productMap.entries())
          .map(([productName, pieces]) => ({ productName, pieces }))
          .sort((a, b) => b.pieces - a.pieces);

        setTotalPieces(cur.total);
        setTotalPiecesMangle(cur.totalM);
        setTotalPiecesDoblado(cur.totalD);
        setTotalPiecesSegregation(cur.totalS);
        setByClient(breakdownClients);
        setByProduct(breakdownProducts);
        setScanInfo({ invoices: cur.invoicesCount, items: cur.itemsScanned });

        // previous (optional)
        if (compareEnabled && prevRange) {
          const prev = processRange(prevRange);
          const prevBreakdownProducts: ProductPieces[] = Array.from(prev.productMap.entries())
            .map(([productName, pieces]) => ({ productName, pieces }))
            .sort((a, b) => b.pieces - a.pieces);
          setPrevTotalPieces(prev.total);
          setPrevPiecesMangle(prev.totalM);
          setPrevPiecesDoblado(prev.totalD);
          setPrevPiecesSegregation(prev.totalS);
          setPrevByProduct(prevBreakdownProducts);
        } else {
          setPrevTotalPieces(0);
          setPrevPiecesMangle(0);
          setPrevPiecesDoblado(0);
          setPrevPiecesSegregation(0);
          setPrevByProduct([]);
        }

        // Persist any inferred area mappings for future runs
        if (toPersist.length > 0) {
          // fire and forget
          toPersist.slice(0, 50).forEach(async ({ key, area, example }) => {
            try {
              await setDoc(doc(db, "productAreas", key), { area, example, updatedAt: new Date().toISOString() }, { merge: true });
            } catch (e) {
              console.warn("Failed to persist product area mapping for", key, e);
            }
          });
        }

        // New: Aggregate total weight from pickup_entries within the selected range
        const sumPickupWeightsInRange = async (range: DateRange): Promise<number> => {
          try {
            const q = query(
              collection(db, "pickup_entries"),
              where("timestamp", ">=", Timestamp.fromDate(range.start)),
              where("timestamp", "<", Timestamp.fromDate(range.endExclusive))
            );
            const snap = await getDocs(q);
            let sum = 0;
            snap.docs.forEach((d) => {
              const w = Number((d.data() as any)?.weight);
              if (Number.isFinite(w)) sum += w;
            });
            return sum;
          } catch (e) {
            console.warn("Failed to sum pickup weights for range", e);
            return 0;
          }
        };

        const weightCur = await sumPickupWeightsInRange(dateRange);
        setTotalWeight(weightCur);
        if (compareEnabled && prevRange) {
          const weightPrev = await sumPickupWeightsInRange(prevRange);
          setPrevTotalWeight(weightPrev);
        } else {
          setPrevTotalWeight(0);
        }

        // NEW: Override Segregation pieces using segregation_done_logs (robust to timezone/storage formats)
        try {
          const segCur = await fetchSegregationLogsPiecesForRange(dateRange);
          if (Number.isFinite(segCur)) setTotalPiecesSegregation(segCur);
          if (compareEnabled && prevRange) {
            const segPrev = await fetchSegregationLogsPiecesForRange(prevRange);
            if (Number.isFinite(segPrev)) setPrevPiecesSegregation(segPrev);
          } else {
            setPrevPiecesSegregation(0);
          }
        } catch (e) {
          console.warn("Failed to load segregation logs for pieces override", e);
        }
      } catch (e) {
        console.error("Failed to load pieces report:", e);
        setTotalPieces(0);
        setTotalPiecesMangle(0);
        setTotalPiecesDoblado(0);
        setTotalPiecesSegregation(0);
        setByClient([]);
        setByProduct([]);
        setPrevByProduct([]);
        setPrevTotalPieces(0);
        setPrevPiecesMangle(0);
        setPrevPiecesDoblado(0);
        setPrevPiecesSegregation(0);
        setScanInfo({ invoices: 0, items: 0 });
        setTotalWeight(0);
        setPrevTotalWeight(0);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, prevRange, excludePeso, compareEnabled, areaVersion, segWeightToPieceFactor]);

  const handleSaveHours = async () => {
    if (!dateRange || !hoursDocId) return;
    const num = (v: string) => {
      const n = parseFloat(v);
      return Number.isFinite(n) && n >= 0 ? n : NaN;
    };

    const u = num(hoursUniformes);
    const uOT = num(overtimeUniformes);
    const uCost = num(costUniformes);
    const uOtCost = num(overtimeCostUniformes);

    const dNew = num(hoursDobladoNew);
    const dOT = num(overtimeDoblado);
    const dCost = num(costDoblado);
    const dOtCost = num(overtimeCostDoblado);

    const i = num(hoursIndustrial);
    const iOT = num(overtimeIndustrial);
    const iCost = num(costIndustrial);
    const iOtCost = num(overtimeCostIndustrial);

    const s = num(hoursSupervisores);
    const sOT = num(overtimeSupervisores);
    const sCost = num(costSupervisores);
    const sOtCost = num(overtimeCostSupervisores);

    // Total from new areas
    const totalFromAreas = [u, uOT, dNew, dOT, i, iOT, s, sOT].reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);

    // Legacy total as fallback
    const h = parseFloat(hours);
    const hM = parseFloat(hoursMangle);
    const hD = parseFloat(hoursDoblado);
    const hS = parseFloat(hoursSegregation);
    const legacyAreas = (Number.isFinite(hM) ? hM : 0) + (Number.isFinite(hD) ? hD : 0) + (Number.isFinite(hS) ? hS : 0);
    const hoursTotal = totalFromAreas > 0 ? totalFromAreas : (legacyAreas > 0 ? legacyAreas : (Number.isFinite(h) ? h : NaN));

    if (!Number.isFinite(hoursTotal) || hoursTotal < 0) return;
    setSaving(true);
    try {
      const payload: any = {
        id: hoursDocId,
        type: rangeType,
        start: toYMD(dateRange.start),
        end: toYMD(addDays(dateRange.endExclusive, -1)),
        label: dateRange.label,
        weekStartsOn: rangeType === "week" ? weekStartsOn : undefined,
        month: rangeType === "month" ? (monthStr || toYM(dateRange.start)) : undefined,
        hours: hoursTotal, // backward compatible
        hoursTotal,
        // New fields
        hoursUniformes: Number.isFinite(u) ? u : undefined,
        overtimeUniformes: Number.isFinite(uOT) ? uOT : undefined,
        costUniformes: Number.isFinite(uCost) ? uCost : undefined,
        overtimeCostUniformes: Number.isFinite(uOtCost) ? uOtCost : undefined,

        hoursDobladoNew: Number.isFinite(dNew) ? dNew : undefined,
        overtimeDoblado: Number.isFinite(dOT) ? dOT : undefined,
        costDoblado: Number.isFinite(dCost) ? dCost : undefined,
        overtimeCostDoblado: Number.isFinite(dOtCost) ? dOtCost : undefined,

        hoursIndustrial: Number.isFinite(i) ? i : undefined,
        overtimeIndustrial: Number.isFinite(iOT) ? iOT : undefined,
        costIndustrial: Number.isFinite(iCost) ? iCost : undefined,
        overtimeCostIndustrial: Number.isFinite(iOtCost) ? iOtCost : undefined,

        hoursSupervisores: Number.isFinite(s) ? s : undefined,
        overtimeSupervisores: Number.isFinite(sOT) ? sOT : undefined,
        costSupervisores: Number.isFinite(sCost) ? sCost : undefined,
        overtimeCostSupervisores: Number.isFinite(sOtCost) ? sOtCost : undefined,

        // Persist toggle (no calculation effect yet; pending clarification)
        includePriceInPPH,

        updatedAt: new Date().toISOString(),
      };

      // Remove undefined fields as Firestore does not accept undefined values
      Object.keys(payload).forEach((k) => {
        if (payload[k] === undefined) delete payload[k];
      });

      await setDoc(doc(db, "workHours", hoursDocId), payload, { merge: true });
      setSavedAt(payload.updatedAt);
      // Normalize displayed total hours to saved total
      setHours(String(hoursTotal));
    } catch (e) {
      console.error("Failed to save hours", e);
      alert("Failed to save hours. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Save an edited product area mapping from UI
  const handleSaveProductArea = async (productName: string, area: AreaType) => {
    const key = normalizeProductKey(productName);
    try {
      await setDoc(doc(db, "productAreas", key), { area, example: productName, updatedAt: new Date().toISOString() }, { merge: true });
      setProductAreas((prev) => ({ ...prev, [key]: area }));
      // trigger re-aggregation with new mapping
      setAreaVersion((v) => v + 1);
    } catch (e) {
      console.error("Failed to save product area", e);
      alert("Failed to save product area. Please try again.");
    }
  };

  // Effective hours used for overall PPH
  const effectiveTotalHours = useMemo(() => {
    // Prefer new area-based total (sum of regular + overtime across 4 areas)
    const num = (v: string) => {
      const n = parseFloat(v);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    const sumNew =
      num(hoursUniformes) +
      num(overtimeUniformes) +
      num(hoursDobladoNew) +
      num(overtimeDoblado) +
      num(hoursIndustrial) +
      num(overtimeIndustrial) +
      num(hoursSupervisores) +
      num(overtimeSupervisores);

    if (sumNew > 0) return sumNew;

    // Fallback to legacy segmented or total
    const h = parseFloat(hours);
    const hM = parseFloat(hoursMangle);
    const hD = parseFloat(hoursDoblado);
    const hS = parseFloat(hoursSegregation);
    const totalFromAreas = (Number.isFinite(hM) ? hM : 0) + (Number.isFinite(hD) ? hD : 0) + (Number.isFinite(hS) ? hS : 0);
    return totalFromAreas > 0 ? totalFromAreas : (Number.isFinite(h) ? h : 0);
  }, [hours, hoursMangle, hoursDoblado, hoursSegregation, hoursUniformes, overtimeUniformes, hoursDobladoNew, overtimeDoblado, hoursIndustrial, overtimeIndustrial, hoursSupervisores, overtimeSupervisores]);

  // New: compute total labor cost and current price-per-piece (based on entered costs)
  const totalLaborCost = useMemo(() => {
    const num = (v: string) => {
      const n = parseFloat(v);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    return (
      num(costUniformes) +
      num(overtimeCostUniformes) +
      num(costDoblado) +
      num(overtimeCostDoblado) +
      num(costIndustrial) +
      num(overtimeCostIndustrial) +
      num(costSupervisores) +
      num(overtimeCostSupervisores)
    );
  }, [
    costUniformes,
    overtimeCostUniformes,
    costDoblado,
    overtimeCostDoblado,
    costIndustrial,
    overtimeCostIndustrial,
    costSupervisores,
    overtimeCostSupervisores,
  ]);

  const pricePerPiece = useMemo(() => {
    if (totalPieces > 0 && totalLaborCost > 0) return totalLaborCost / totalPieces;
    return 0;
  }, [totalLaborCost, totalPieces]);

  const piecesPerHour = useMemo(() => {
    const h = effectiveTotalHours;
    if (!h || h <= 0) return 0;
    return totalPieces / h;
  }, [effectiveTotalHours, totalPieces]);

  // Area-specific PPH
  const manglePPH = useMemo(() => {
    const h = parseFloat(hoursMangle);
    if (!Number.isFinite(h) || h <= 0) return 0;
    return totalPiecesMangle / h;
  }, [hoursMangle, totalPiecesMangle]);
  const dobladoPPH = useMemo(() => {
    const h = parseFloat(hoursDoblado);
    if (!Number.isFinite(h) || h <= 0) return 0;
    return totalPiecesDoblado / h;
  }, [hoursDoblado, totalPiecesDoblado]);
  const segregationPPH = useMemo(() => {
    const h = parseFloat(hoursSegregation);
    if (!Number.isFinite(h) || h <= 0) return 0;
    return totalPiecesSegregation / h;
  }, [hoursSegregation, totalPiecesSegregation]);

  // Previous period pieces per hour (if previous hours exist)
  const prevPiecesPerHour = useMemo(() => {
    if (!compareEnabled) return null;
    const h = prevHours ?? 0;
    if (!h || h <= 0) return null;
    return prevTotalPieces / h;
  }, [compareEnabled, prevHours, prevTotalPieces]);

  // Previous period area PPH
  const prevManglePPH = useMemo(() => {
    if (!compareEnabled) return null;
    const h = prevMangleHours ?? 0;
    if (!h || h <= 0) return null;
    return prevPiecesMangle / h;
  }, [compareEnabled, prevMangleHours, prevPiecesMangle]);
  const prevDobladoPPH = useMemo(() => {
    if (!compareEnabled) return null;
    const h = prevDobladoHours ?? 0;
    if (!h || h <= 0) return null;
    return prevPiecesDoblado / h;
  }, [compareEnabled, prevDobladoHours, prevPiecesDoblado]);
  const prevSegregationPPH = useMemo(() => {
    if (!compareEnabled) return null;
    const h = prevSegregationHours ?? 0;
    if (!h || h <= 0) return null;
    return prevPiecesSegregation / h;
  }, [compareEnabled, prevSegregationHours, prevPiecesSegregation]);

  const deltaPieces = totalPieces - prevTotalPieces;
  const deltaPct = prevTotalPieces > 0 ? (deltaPieces / prevTotalPieces) * 100 : 0;
  const deltaPiecesM = totalPiecesMangle - prevPiecesMangle;
  const deltaPiecesD = totalPiecesDoblado - prevPiecesDoblado;
  const deltaPiecesS = totalPiecesSegregation - prevPiecesSegregation;
  // New: weight deltas
  const deltaWeight = totalWeight - prevTotalWeight;
  const deltaWeightPct = prevTotalWeight > 0 ? (deltaWeight / prevTotalWeight) * 100 : 0;

  // Build comparison rows for per-product table
  const productCompareRows = useMemo(() => {
    const curMap = new Map(byProduct.map((r) => [r.productName, r.pieces] as const));
    const prevMap = new Map(prevByProduct.map((r) => [r.productName, r.pieces] as const));
    const names = new Set<string>([...curMap.keys(), ...prevMap.keys()]);
    const rows = Array.from(names).map((name) => {
      const cur = curMap.get(name) || 0;
      const prev = prevMap.get(name) || 0;
      const d = cur - prev;
      const p = prev > 0 ? (d / prev) * 100 : 0;
      return { productName: name, current: cur, previous: prev, delta: d, pct: p };
    });
    rows.sort((a, b) => b.current - a.current);
    return rows;
  }, [byProduct, prevByProduct]);

  // Heuristic Insights based on current vs previous, hours, and product mix
  const insights = useMemo(() => {
    const out: string[] = [];

    // Throughput insight
    if (effectiveTotalHours > 0) {
      const pph = piecesPerHour;
      if (pph > 0) {
        if (prevPiecesPerHour != null) {
          const d = pph - prevPiecesPerHour;
          const pct = prevPiecesPerHour > 0 ? (d / prevPiecesPerHour) * 100 : 0;
          out.push(
            `Throughput: ${pph.toFixed(2)} pieces/hour (prev ${prevPiecesPerHour.toFixed(2)}, ${d >= 0 ? "+" : ""}${d.toFixed(2)} | ${pct.toFixed(1)}%).`
          );
        } else {
          out.push(`Throughput: ${pph.toFixed(2)} pieces/hour based on ${effectiveTotalHours} hours.`);
        }
      }
    }

    // Area throughput
    if (hoursMangle || hoursDoblado || hoursSegregation) {
      if (parseFloat(hoursMangle) > 0) {
        if (prevManglePPH != null) {
          const d = manglePPH - prevManglePPH;
          const pct = prevManglePPH > 0 ? (d / prevManglePPH) * 100 : 0;
          out.push(`Mangle throughput: ${manglePPH.toFixed(2)} p/h (prev ${prevManglePPH.toFixed(2)}, ${d >= 0 ? "+" : ""}${d.toFixed(2)} | ${pct.toFixed(1)}%).`);
        } else {
          out.push(`Mangle throughput: ${manglePPH.toFixed(2)} p/h using ${hoursMangle || 0} hours.`);
        }
      }
      if (parseFloat(hoursDoblado) > 0) {
        if (prevDobladoPPH != null) {
          const d = dobladoPPH - prevDobladoPPH;
          const pct = prevDobladoPPH > 0 ? (d / prevDobladoPPH) * 100 : 0;
          out.push(`Doblado throughput: ${dobladoPPH.toFixed(2)} p/h (prev ${prevDobladoPPH.toFixed(2)}, ${d >= 0 ? "+" : ""}${d.toFixed(2)} | ${pct.toFixed(1)}%).`);
        } else {
          out.push(`Doblado throughput: ${dobladoPPH.toFixed(2)} p/h using ${hoursDoblado || 0} hours.`);
        }
      }
      if (parseFloat(hoursSegregation) > 0) {
        if (prevSegregationPPH != null) {
          const d = segregationPPH - prevSegregationPPH;
          const pct = prevSegregationPPH > 0 ? (d / prevSegregationPPH) * 100 : 0;
          out.push(`Segregation throughput: ${segregationPPH.toFixed(2)} p/h (prev ${prevSegregationPPH.toFixed(2)}, ${d >= 0 ? "+" : ""}${d.toFixed(2)} | ${pct.toFixed(1)}%).`);
        } else {
          out.push(`Segregation throughput: ${segregationPPH.toFixed(2)} p/h using ${hoursSegregation || 0} hours.`);
        }
      }
    }

    // Overall delta insight
    if (compareEnabled && prevRange && prevTotalPieces > 0) {
      out.push(
        `Total pieces ${deltaPieces >= 0 ? "increased" : "decreased"} by ${Math.abs(deltaPieces).toLocaleString()} (${deltaPct.toFixed(1)}%) vs ${prevRange.label}.`
      );
      // Area drivers
      const changes = [
        { name: "Mangle", delta: deltaPiecesM },
        { name: "Doblado", delta: deltaPiecesD },
        { name: "Segregation", delta: deltaPiecesS },
      ];
      const most = changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
      if (most) out.push(`${most.name} contributed ${most.delta >= 0 ? "+" : ""}${most.delta.toLocaleString()} pieces vs previous.`);
    }

    // Product mix drivers
    const inc = productCompareRows
      .filter((r) => r.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 3);
    const dec = productCompareRows
      .filter((r) => r.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 3);

    if (inc.length > 0) {
      out.push(
        `Top gainers: ${inc
          .map((r) => `${r.productName} (+${r.delta.toLocaleString()})`)
          .join(", ")}.`
      );
    }
    if (dec.length > 0) {
      out.push(
        `Top decliners: ${dec
          .map((r) => `${r.productName} (${r.delta.toLocaleString()})`)
          .join(", ")}.`
      );
    }

    // Area mix share
    const totalCur = totalPiecesMangle + totalPiecesDoblado + totalPiecesSegregation;
    if (totalCur > 0) {
      const shareM = (totalPiecesMangle / totalCur) * 100;
      const shareD = (totalPiecesDoblado / totalCur) * 100;
      const shareS = (totalPiecesSegregation / totalCur) * 100;
      out.push(`Mix this period — Mangle: ${shareM.toFixed(1)}%, Doblado: ${shareD.toFixed(1)}%, Segregation: ${shareS.toFixed(1)}%.`);
    }

    // Top clients current period
    if (byClient.length > 0) {
      const topClients = byClient
        .slice(0, 3)
        .map((c) => `${c.clientName} (${c.pieces.toLocaleString()})`)
        .join(", ");
      out.push(`Top clients this period: ${topClients}.`);
    }

    if (excludePeso) {
      out.push('Note: "peso" products were excluded from this analysis.');
    }

    return out;
  }, [effectiveTotalHours, piecesPerHour, prevPiecesPerHour, compareEnabled, prevRange, prevTotalPieces, deltaPieces, deltaPct, productCompareRows, byClient, excludePeso, hoursMangle, hoursDoblado, hoursSegregation, manglePPH, dobladoPPH, segregationPPH, prevManglePPH, prevDobladoPPH, prevSegregationPPH, totalPiecesMangle, totalPiecesDoblado, totalPiecesSegregation, deltaPiecesM, deltaPiecesD, deltaPiecesS]);

  return (
    <div className="daily-pieces-fullscreen">
      <div className="row g-3 align-items-end">
        {/* Range type selector */}
        <div className="col-auto">
          <label className="form-label">Range</label>
          <select
            className="form-select"
            value={rangeType}
            onChange={(e) => setRangeType(e.target.value as RangeType)}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Day picker */}
        {rangeType === "day" && (
          <div className="col-auto">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        )}

        {/* Week picker */}
        {rangeType === "week" && (
          <>
            <div className="col-auto">
              <label className="form-label">Any day in week</label>
              <input
                type="date"
                className="form-control"
                value={weekAnchor}
                onChange={(e) => setWeekAnchor(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <label className="form-label">Week starts on</label>
              <select
                className="form-select"
                value={weekStartsOn}
                onChange={(e) => setWeekStartsOn(e.target.value as WeekStart)}
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
          </>
        )}

        {/* Month picker */}
        {rangeType === "month" && (
          <div className="col-auto">
            <label className="form-label">Month</label>
            <input
              type="month"
              className="form-control"
              value={monthStr}
              onChange={(e) => setMonthStr(e.target.value)}
            />
          </div>
        )}

        {/* Custom picker */}
        {rangeType === "custom" && (
          <>
            <div className="col-auto">
              <label className="form-label">Start date</label>
              <input
                type="date"
                className="form-control"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div className="col-auto">
              <label className="form-label">End date</label>
              <input
                type="date"
                className="form-control"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </>
        )}

        {/* Exclude peso */}
        <div className="col-auto">
          <div className="form-check mt-4 pt-1">
            <input
              id="excludePeso"
              className="form-check-input"
              type="checkbox"
              checked={excludePeso}
              onChange={(e) => setExcludePeso(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="excludePeso">
              Exclude "peso" products
            </label>
          </div>
        </div>

        {/* New Four-Area Hours and Costs */}
        <div className="w-100" />
        <div className="col-12">
          <div className="card p-3 border-0 bg-light">
            <div className="row g-3">
              <div className="col-12"><strong>Labor (hours and cost)</strong></div>

              {/* Uniformes */}
              <div className="col-12 col-md-6 col-lg-3">
                <div className="border rounded p-2 h-100">
                  <div className="fw-semibold mb-2">Uniformes</div>
                  <label className="form-label mb-1">Total hours</label>
                  <input type="number" min={0} step="0.1" className="form-control mb-2" value={hoursUniformes} onChange={(e)=>setHoursUniformes(e.target.value)} />
                  <label className="form-label mb-1">Overtime hours</label>
                  <input type="number" min={0} step="0.1" className="form-control mb-2" value={overtimeUniformes} onChange={(e)=>setOvertimeUniformes(e.target.value)} />
                  <label className="form-label mb-1">Cost (total hours)</label>
                  <input type="number" min={0} step="0.01" className="form-control mb-2" value={costUniformes} onChange={(e)=>setCostUniformes(e.target.value)} />
                  <label className="form-label mb-1">Cost (overtime)</label>
                  <input type="number" min={0} step="0.01" className="form-control" value={overtimeCostUniformes} onChange={(e)=>setOvertimeCostUniformes(e.target.value)} />
                </div>
              </div>

              {/* Doblado */}
              <div className="col-12 col-md-6 col-lg-3">
                <div className="border rounded p-2 h-100">
                  <div className="fw-semibold mb-2">Doblado</div>
                  <label className="form-label mb-1">Total hours</label>
                  <input type="number" min={0} step="0.1" className="form-control mb-2" value={hoursDobladoNew} onChange={(e)=>setHoursDobladoNew(e.target.value)} />
                  <label className="form-label mb-1">Overtime hours</label>
                  <input type="number" min={0} step="0.1" className="form-control mb-2" value={overtimeDoblado} onChange={(e)=>setOvertimeDoblado(e.target.value)} />
                  <label className="form-label mb-1">Cost (total hours)</label>
                  <input type="number" min={0} step="0.01" className="form-control mb-2" value={costDoblado} onChange={(e)=>setCostDoblado(e.target.value)} />
                  <label className="form-label mb-1">Cost (overtime)</label>
                  <input type="number" min={0} step="0.01" className="form-control" value={overtimeCostDoblado} onChange={(e)=>setOvertimeCostDoblado(e.target.value)} />
                </div>
              </div>

              {/* Industrial */}
              <div className="col-12 col-md-6 col-lg-3">
                <div className="border rounded p-2 h-100">
                  <div className="fw-semibold mb-2">Industrial</div>
                  <label className="form-label mb-1">Total hours</label>
                  <input type="number" min={0} step="0.1" className="form-control mb-2" value={hoursIndustrial} onChange={(e)=>setHoursIndustrial(e.target.value)} />
                  <label className="form-label mb-1">Overtime hours</label>
                  <input type="number" min={0} step="0.1" className="form-control mb-2" value={overtimeIndustrial} onChange={(e)=>setOvertimeIndustrial(e.target.value)} />
                  <label className="form-label mb-1">Cost (total hours)</label>
                  <input type="number" min={0} step="0.01" className="form-control mb-2" value={costIndustrial} onChange={(e)=>setCostIndustrial(e.target.value)} />
                  <label className="form-label mb-1">Cost (overtime)</label>
                  <input type="number" min={0} step="0.01" className="form-control" value={overtimeCostIndustrial} onChange={(e)=>setOvertimeCostIndustrial(e.target.value)} />
                </div>
              </div>

              {/* Supervisores */}
              <div className="col-12 col-md-6 col-lg-3">
                <div className="border rounded p-2 h-100">
                  <div className="fw-semibold mb-2">Supervisores</div>
                  <label className="form-label mb-1">Total hours</label>
                  <input type="number" min={0} step="0.1" className="form-control mb-2" value={hoursSupervisores} onChange={(e)=>setHoursSupervisores(e.target.value)} />
                  <label className="form-label mb-1">Overtime hours</label>
                  <input type="number" min={0} step="0.1" className="form-control mb-2" value={overtimeSupervisores} onChange={(e)=>setOvertimeSupervisores(e.target.value)} />
                  <label className="form-label mb-1">Cost (total hours)</label>
                  <input type="number" min={0} step="0.01" className="form-control mb-2" value={costSupervisores} onChange={(e)=>setCostSupervisores(e.target.value)} />
                  <label className="form-label mb-1">Cost (overtime)</label>
                  <input type="number" min={0} step="0.01" className="form-control" value={overtimeCostSupervisores} onChange={(e)=>setOvertimeCostSupervisores(e.target.value)} />
                </div>
              </div>

              {/* Toggle for including price-per-piece in PPH (exact behavior pending clarification) */}
              <div className="col-12 d-flex align-items-center justify-content-between">
                <div className="form-check">
                  <input
                    id="includePriceInPPH"
                    className="form-check-input"
                    type="checkbox"
                    checked={includePriceInPPH}
                    onChange={(e) => setIncludePriceInPPH(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="includePriceInPPH">
                    Include “price per piece” in PPH calculations
                  </label>
                </div>
                <button className="btn btn-primary" onClick={handleSaveHours} disabled={!hoursDocId || saving}>
                  {saving ? "Saving…" : "Save Hours"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-auto ms-auto">
          <button className="btn btn-outline-primary mt-4" onClick={exportCsv} disabled={loading || (!compareEnabled && byProduct.length === 0) || (compareEnabled && productCompareRows.length === 0)}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Range summary */}
      <div className="mt-2 text-muted">
        {dateRange ? (
          <small>
            Range: {dateRange.label} (inclusive)
            {savedAt && (
              <>
                {" "}| Last saved: {new Date(savedAt).toLocaleString()}
              </>
            )}
          </small>
        ) : (
          <small>Please select a valid date range.</small>
        )}
      </div>

      <hr className="my-4" />

      {loading ? (
        <div className="text-center text-muted py-4">Loading…</div>
      ) : (
        <>
          <div className="d-flex flex-wrap gap-3 mb-4">
            <div className="card border-primary" style={{ minWidth: 220 }}>
              <div className="card-body">
                <div className="text-muted">Total pieces (current)</div>
                <div className="display-6 fw-bold text-primary">{totalPieces.toLocaleString()}</div>
                <small className="text-muted">Across {scanInfo.invoices} invoices, {scanInfo.items} item entries</small>
              </div>
            </div>
            <div className="card border-success" style={{ minWidth: 260 }}>
              <div className="card-body">
                <div className="text-muted">Pieces per man-hour</div>
                <div className="display-6 fw-bold text-success">
                  {Number.isFinite(piecesPerHour) ? piecesPerHour.toFixed(2) : "-"}
                </div>
                <small className="text-muted">Using {effectiveTotalHours || 0} hours</small>
              </div>
            </div>
            {compareEnabled && (
              <div className="card border-secondary" style={{ minWidth: 260 }}>
                <div className="card-body">
                  <div className="text-muted">Previous period total</div>
                  <div className="display-6 fw-bold">{prevTotalPieces.toLocaleString()}</div>
                  <small className={deltaPieces >= 0 ? "text-success" : "text-danger"}>
                    Δ {deltaPieces >= 0 ? "+" : ""}{deltaPieces.toLocaleString()} ({deltaPct.toFixed(1)}%)
                  </small>
                </div>
              </div>
            )}
            {/* New: Total weight card */}
            <div className="card border-dark" style={{ minWidth: 260 }}>
              <div className="card-body">
                <div className="text-muted">Total weight (current)</div>
                <div className="display-6 fw-bold">{Math.round(totalWeight).toLocaleString()}</div>
                <small className="text-muted">from pickup entries</small>
                {compareEnabled && (
                  <div className={`mt-1 ${deltaWeight >= 0 ? "text-success" : "text-danger"}`}>
                    Δ {deltaWeight >= 0 ? "+" : ""}{Math.round(deltaWeight).toLocaleString()} ({deltaWeightPct.toFixed(1)}%)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Area cards */}
          <div className="d-flex flex-wrap gap-3 mb-4">
            <div className="card border-info" style={{ minWidth: 260 }}>
              <div className="card-body">
                <div className="text-muted">Mangle pieces</div>
                <div className="h3 fw-bold text-info">{totalPiecesMangle.toLocaleString()}</div>
                <div className="text-muted">Throughput: {manglePPH > 0 ? manglePPH.toFixed(2) : "-"} p/h</div>
                {compareEnabled && (
                  <small className={deltaPiecesM >= 0 ? "text-success" : "text-danger"}>
                    Δ {deltaPiecesM >= 0 ? "+" : ""}{deltaPiecesM.toLocaleString()} pieces{prevManglePPH != null ? ` | p/h ${((manglePPH || 0) - (prevManglePPH || 0)).toFixed(2)}` : ""}
                  </small>
                )}
              </div>
            </div>
            <div className="card border-warning" style={{ minWidth: 260 }}>
              <div className="card-body">
                <div className="text-muted">Doblado pieces</div>
                <div className="h3 fw-bold text-warning">{totalPiecesDoblado.toLocaleString()}</div>
                <div className="text-muted">Throughput: {dobladoPPH > 0 ? dobladoPPH.toFixed(2) : "-"} p/h</div>
                {compareEnabled && (
                  <small className={deltaPiecesD >= 0 ? "text-success" : "text-danger"}>
                    Δ {deltaPiecesD >= 0 ? "+" : ""}{deltaPiecesD.toLocaleString()} pieces{prevDobladoPPH != null ? ` | p/h ${((dobladoPPH || 0) - (prevDobladoPPH || 0)).toFixed(2)}` : ""}
                  </small>
                )}
              </div>
            </div>
            <div className="card border-secondary" style={{ minWidth: 260 }}>
              <div className="card-body">
                <div className="text-muted">Segregation pieces</div>
                <div className="h3 fw-bold text-secondary">{totalPiecesSegregation.toLocaleString()}</div>
                <div className="text-muted">Throughput: {segregationPPH > 0 ? segregationPPH.toFixed(2) : "-"} p/h</div>
                {compareEnabled && (
                  <small className={deltaPiecesS >= 0 ? "text-success" : "text-danger"}>
                    Δ {deltaPiecesS >= 0 ? "+" : ""}{deltaPiecesS.toLocaleString()} pieces{prevSegregationPPH != null ? ` | p/h ${((segregationPPH || 0) - (prevSegregationPPH || 0)).toFixed(2)}` : ""}
                  </small>
                )}
              </div>
            </div>
          </div>

          {/* New: Price per piece summary */}
          <div className="d-flex flex-wrap gap-3 mb-4">
            <div className="card border-danger" style={{ minWidth: 260 }}>
              <div className="card-body">
                <div className="text-muted">Price per piece</div>
                <div className="display-6 fw-bold">
                  {pricePerPiece > 0
                    ? pricePerPiece.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })
                    : "-"}
                </div>
                <small className="text-muted">
                  From entered labor costs{totalLaborCost > 0 ? ` (${totalLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total)` : ""}
                </small>
              </div>
            </div>
          </div>

          {/* Insights panel */}
          <div className="mb-4">
            <h5>Insights</h5>
            <ul className="mb-0">
              {insights.length === 0 ? (
                <li className="text-muted">Add hours and enable comparison to view insights.</li>
              ) : (
                insights.map((t, i) => <li key={i}>{t}</li>)
              )}
            </ul>
          </div>

          {/* Per-product comparison */}
          <div className="mb-4">
            <h5>Per-Product Totals {compareEnabled && prevRange ? `(vs ${prevRange.label})` : ""}</h5>
            <div className="table-responsive">
              <table className="table table-sm table-hover">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Area</th>
                    <th className="text-end">Current</th>
                    {compareEnabled && <th className="text-end">Previous</th>}
                    {compareEnabled && <th className="text-end">Δ</th>}
                    {compareEnabled && <th className="text-end">%</th>}
                  </tr>
                </thead>
                <tbody>
                  {productCompareRows.length === 0 ? (
                    <tr>
                      <td colSpan={compareEnabled ? 6 : 3} className="text-center text-muted py-3">
                        No products found for this range.
                      </td>
                    </tr>
                  ) : (
                    productCompareRows.map((row) => {
                      const key = normalizeProductKey(row.productName);
                      const currentArea = productAreas[key] || "";
                      return (
                        <tr key={row.productName}>
                          <td>{row.productName}</td>
                          <td style={{ minWidth: 140 }}>
                            <select
                              className="form-select form-select-sm"
                              value={currentArea as any}
                              onChange={(e) => handleSaveProductArea(row.productName, e.target.value as AreaType)}
                            >
                              <option value="" disabled>
                                Select area
                              </option>
                              <option value="Mangle">Mangle</option>
                              <option value="Doblado">Doblado</option>
                              <option value="Segregation">Segregation</option>
                            </select>
                          </td>
                          <td className="text-end">{row.current.toLocaleString()}</td>
                          {compareEnabled && <td className="text-end">{row.previous.toLocaleString()}</td>}
                          {compareEnabled && (
                            <td className={`text-end ${row.delta >= 0 ? "text-success" : "text-danger"}`}>
                              {row.delta >= 0 ? "+" : ""}
                              {row.delta.toLocaleString()}
                            </td>
                          )}
                          {compareEnabled && (
                            <td className={`text-end ${row.delta >= 0 ? "text-success" : "text-danger"}`}>
                              {isFinite(row.pct) ? `${row.pct.toFixed(1)}%` : "-"}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {/* New: table footer summary for segregated pieces */}
                <tfoot>
                  <tr>
                    <td colSpan={2} className="fw-bold">Segregation total</td>
                    <td className="text-end fw-bold">{totalPiecesSegregation.toLocaleString()}</td>
                    {compareEnabled && <td className="text-end fw-bold">{prevPiecesSegregation.toLocaleString()}</td>}
                    {compareEnabled && (
                      <td className={`text-end fw-bold ${deltaPiecesS >= 0 ? "text-success" : "text-danger"}`}>
                        {deltaPiecesS >= 0 ? "+" : ""}{deltaPiecesS.toLocaleString()}
                      </td>
                    )}
                    {compareEnabled && (
                      <td className={`text-end fw-bold ${deltaPiecesS >= 0 ? "text-success" : "text-danger"}`}>
                        {prevPiecesSegregation > 0 ? `${(((totalPiecesSegregation - prevPiecesSegregation) / prevPiecesSegregation) * 100).toFixed(1)}%` : "-"}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Existing per-client table */}
          <div className="table-responsive">
            <table className="table table-sm table-hover">
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="text-end">Pieces</th>
                </tr>
              </thead>
              <tbody>
                {byClient.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="text-center text-muted py-3">
                      No items found for this range.
                    </td>
                  </tr>
                ) : (
                  byClient.map((row) => (
                    <tr key={row.clientName}>
                      <td>{row.clientName}</td>
                      <td className="text-end">{row.pieces.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default DailyPiecesReport;
