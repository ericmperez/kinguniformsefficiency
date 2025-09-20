import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Types
type RangeType = "day" | "week" | "month" | "custom";

type WeekStart = "monday" | "sunday";

type DateRange = {
  start: Date; // inclusive
  endExclusive: Date; // exclusive upper bound
  label: string;
};

// Utils (kept local; mirrors DailyPiecesReport)
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
  return addDays(d, -(dayMon - 1));
}
function formatRangeLabel(start: Date, endInclusive: Date) {
  const fmtOpts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
  const s = start.toLocaleDateString(undefined, fmtOpts);
  const e = endInclusive.toLocaleDateString(undefined, fmtOpts);
  if (s === e) return s;
  return `${s} – ${e}`;
}

type ProductRow = { productName: string; pieces: number };

const ItemTotalsByProduct: React.FC = () => {
  // Range selection state
  const [rangeType, setRangeType] = useState<RangeType>("day");
  const [selectedDate, setSelectedDate] = useState<string>(() => toYMD(new Date()));
  const [weekAnchor, setWeekAnchor] = useState<string>(() => toYMD(new Date()));
  const [weekStartsOn, setWeekStartsOn] = useState<WeekStart>("monday");
  const [monthStr, setMonthStr] = useState<string>(() => toYM(new Date()));
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  // Filters
  const [excludePeso, setExcludePeso] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [topN, setTopN] = useState<string>("");

  // Data state
  const [loading, setLoading] = useState<boolean>(false);
  const [totalPieces, setTotalPieces] = useState<number>(0);
  const [byProduct, setByProduct] = useState<ProductRow[]>([]);
  const [scanInfo, setScanInfo] = useState<{ invoices: number; items: number }>({ invoices: 0, items: 0 });

  const dateRange = useMemo(() => {
    try {
      if (rangeType === "day") {
        const d = parseYMD(selectedDate);
        if (!d) return null;
        const start = startOfDay(d);
        const endExclusive = addDays(start, 1);
        return { start, endExclusive, label: formatRangeLabel(start, addDays(endExclusive, -1)) } as DateRange;
      }
      if (rangeType === "week") {
        const d = parseYMD(weekAnchor);
        if (!d) return null;
        const start = getWeekStart(d, weekStartsOn);
        const endInclusive = addDays(start, 6);
        const endExclusive = addDays(endInclusive, 1);
        return { start, endExclusive, label: formatRangeLabel(start, endInclusive) } as DateRange;
      }
      if (rangeType === "month") {
        const parsed = parseYM(monthStr);
        if (!parsed) return null;
        const start = new Date(parsed.y, parsed.m - 1, 1, 0, 0, 0, 0);
        const endExclusive = new Date(parsed.y, parsed.m, 1, 0, 0, 0, 0);
        return { start, endExclusive, label: formatRangeLabel(start, addDays(endExclusive, -1)) } as DateRange;
      }
      const cs = parseYMD(customStart);
      const ce = parseYMD(customEnd);
      if (!cs || !ce) return null;
      const start = startOfDay(cs);
      const endInclusive = startOfDay(ce);
      const endExclusive = addDays(endInclusive, 1);
      if (start > endInclusive) return null;
      return { start, endExclusive, label: formatRangeLabel(start, endInclusive) } as DateRange;
    } catch {
      return null;
    }
  }, [rangeType, selectedDate, weekAnchor, weekStartsOn, monthStr, customStart, customEnd]);

  useEffect(() => {
    const fetchData = async () => {
      if (!dateRange) return;
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, "invoices"));
        let total = 0;
        let invoicesCount = 0;
        let itemsScanned = 0;
        const productMap = new Map<string, number>();

        snapshot.docs.forEach((docSnap) => {
          const inv: any = docSnap.data();
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
              if (addedAt >= dateRange.start && addedAt < dateRange.endExclusive) {
                const name = (item.productName || "Unknown").toString();
                if (excludePeso && name.toLowerCase().includes("peso")) return;
                const qty = Number(item.quantity) || 0;
                if (qty > 0) {
                  itemsScanned++;
                  invoiceHasItemsInRange = true;
                  total += qty;
                  productMap.set(name, (productMap.get(name) || 0) + qty);
                }
              }
            });
          });

          if (invoiceHasItemsInRange) invoicesCount++;
        });

        const rows: ProductRow[] = Array.from(productMap.entries())
          .map(([productName, pieces]) => ({ productName, pieces }))
          .sort((a, b) => b.pieces - a.pieces);

        setTotalPieces(total);
        setByProduct(rows);
        setScanInfo({ invoices: invoicesCount, items: itemsScanned });
      } catch (e) {
        console.error("Failed to load product totals:", e);
        setTotalPieces(0);
        setByProduct([]);
        setScanInfo({ invoices: 0, items: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange, excludePeso]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? byProduct.filter((r) => r.productName.toLowerCase().includes(term))
      : byProduct;
    const n = parseInt(topN, 10);
    if (!isNaN(n) && n > 0) return list.slice(0, n);
    return list;
  }, [byProduct, search, topN]);

  const exportCsv = () => {
    const header = ["Product", "Pieces"];
    const rows = filtered.map((r) => [r.productName, String(r.pieces)]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `product_totals_${dateRange ? dateRange.label.replace(/\s+/g, "_") : "range"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-2">
      <div className="row g-3 align-items-end">
        {/* Range type selector */}
        <div className="col-auto">
          <label className="form-label">Range</label>
          <select className="form-select" value={rangeType} onChange={(e) => setRangeType(e.target.value as RangeType)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {rangeType === "day" && (
          <div className="col-auto">
            <label className="form-label">Date</label>
            <input type="date" className="form-control" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
        )}

        {rangeType === "week" && (
          <>
            <div className="col-auto">
              <label className="form-label">Any day in week</label>
              <input type="date" className="form-control" value={weekAnchor} onChange={(e) => setWeekAnchor(e.target.value)} />
            </div>
            <div className="col-auto">
              <label className="form-label">Week starts on</label>
              <select className="form-select" value={weekStartsOn} onChange={(e) => setWeekStartsOn(e.target.value as WeekStart)}>
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
          </>
        )}

        {rangeType === "month" && (
          <div className="col-auto">
            <label className="form-label">Month</label>
            <input type="month" className="form-control" value={monthStr} onChange={(e) => setMonthStr(e.target.value)} />
          </div>
        )}

        {rangeType === "custom" && (
          <>
            <div className="col-auto">
              <label className="form-label">Start date</label>
              <input type="date" className="form-control" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            </div>
            <div className="col-auto">
              <label className="form-label">End date</label>
              <input type="date" className="form-control" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          </>
        )}

        {/* Exclude peso */}
        <div className="col-auto">
          <div className="form-check mt-4 pt-1">
            <input id="excludePeso2" className="form-check-input" type="checkbox" checked={excludePeso} onChange={(e) => setExcludePeso(e.target.checked)} />
            <label className="form-check-label" htmlFor="excludePeso2">Exclude "peso" products</label>
          </div>
        </div>

        {/* Search */}
        <div className="col-auto">
          <label className="form-label">Search product</label>
          <input type="text" className="form-control" placeholder="e.g. towels" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {/* Top N */}
        <div className="col-auto">
          <label className="form-label">Top N</label>
          <input type="number" className="form-control" min={1} placeholder="e.g. 10" value={topN} onChange={(e) => setTopN(e.target.value)} />
        </div>

        <div className="col-auto ms-auto">
          <button className="btn btn-outline-primary" onClick={exportCsv} disabled={filtered.length === 0}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Range summary */}
      <div className="mt-2 text-muted">
        {dateRange ? (
          <small>Range: {dateRange.label} (inclusive)</small>
        ) : (
          <small>Please select a valid date range.</small>
        )}
      </div>

      <hr className="my-4" />

      {loading ? (
        <div className="text-center text-muted py-4">Loading…</div>
      ) : (
        <>
          <div className="card border-primary mb-4" style={{ maxWidth: 360 }}>
            <div className="card-body">
              <div className="text-muted">Total pieces</div>
              <div className="display-6 fw-bold text-primary">{totalPieces.toLocaleString()}</div>
              <small className="text-muted">Across {scanInfo.invoices} invoices, {scanInfo.items} item entries</small>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-sm table-hover">
              <thead>
                <tr>
                  <th style={{ width: 56 }}>#</th>
                  <th>Product</th>
                  <th className="text-end">Pieces</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-3">No products found for this range.</td>
                  </tr>
                ) : (
                  filtered.map((row, idx) => (
                    <tr key={row.productName}>
                      <td className="text-muted">{idx + 1}</td>
                      <td>{row.productName}</td>
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

export default ItemTotalsByProduct;
