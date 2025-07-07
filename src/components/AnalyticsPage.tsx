import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "../firebase";

const AnalyticsPage: React.FC = () => {
  // Segregation summary state
  const [segDoneLogs, setSegDoneLogs] = useState<any[]>([]);
  const [segDate, setSegDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [segLoading, setSegLoading] = useState(false);

  useEffect(() => {
    setSegLoading(true);
    const fetchLogs = async () => {
      const q = query(
        collection(db, "segregation_done_logs"),
        where("date", "==", segDate)
      );
      const snap = await getDocs(q);
      setSegDoneLogs(snap.docs.map((doc) => doc.data()));
      setSegLoading(false);
    };
    fetchLogs();
  }, [segDate]);

  // --- Average First Entry Time Analytics ---
  const [rangeStart, setRangeStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [rangeEnd, setRangeEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [avgFirstEntryLoading, setAvgFirstEntryLoading] = useState(false);
  const [avgFirstEntryRows, setAvgFirstEntryRows] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAvgFirstEntry() {
      setAvgFirstEntryLoading(true);
      // Get all pickup_entries in range
      const start = new Date(rangeStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(rangeEnd);
      end.setHours(23, 59, 59, 999);
      const q = query(
        collection(db, "pickup_entries"),
        where("timestamp", ">=", Timestamp.fromDate(start)),
        where("timestamp", "<=", Timestamp.fromDate(end))
      );
      const snap = await getDocs(q);
      const entries = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          clientId: data.clientId,
          clientName: data.clientName || data.clientId,
          groupId: data.groupId,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
        };
      }).filter(e => e.clientId && e.timestamp instanceof Date && !isNaN(e.timestamp.getTime()));
      // Group by date, then by client, then by group
      const byDateClient: Record<string, Record<string, { clientName: string; times: any[] }>> = {};
      entries.forEach((e) => {
        const dateStr = e.timestamp.toISOString().slice(0, 10);
        if (!byDateClient[dateStr]) byDateClient[dateStr] = {};
        if (!byDateClient[dateStr][e.clientId]) byDateClient[dateStr][e.clientId] = { clientName: e.clientName, times: [] };
        byDateClient[dateStr][e.clientId].times.push(e);
      });
      // For each date/client, get first entry time per group, then average
      const rows: any[] = [];
      Object.entries(byDateClient).forEach(([date, clients]) => {
        Object.entries(clients).forEach(([clientId, { clientName, times }]) => {
          // Map groupId to first entry time
          const groupFirstTimes: Record<string, Date> = {};
          times.forEach((e: any) => {
            if (!groupFirstTimes[e.groupId] || e.timestamp < groupFirstTimes[e.groupId]) {
              groupFirstTimes[e.groupId] = e.timestamp;
            }
          });
          const firstTimes = Object.values(groupFirstTimes);
          if (firstTimes.length === 0) return;
          // Average time (in ms since midnight)
          const avgMs = Math.round(
            firstTimes.reduce((sum, d) => {
              const ms = d.getHours() * 3600000 + d.getMinutes() * 60000 + d.getSeconds() * 1000 + d.getMilliseconds();
              return sum + ms;
            }, 0) / firstTimes.length
          );
          // Convert avgMs to time string
          const h = Math.floor(avgMs / 3600000);
          const m = Math.floor((avgMs % 3600000) / 60000);
          const s = Math.floor((avgMs % 60000) / 1000);
          const avgTimeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
          rows.push({ date, clientName, avgTimeStr });
        });
      });
      // Sort by date, then client
      rows.sort((a, b) => a.date.localeCompare(b.date) || a.clientName.localeCompare(b.clientName));
      setAvgFirstEntryRows(rows);
      setAvgFirstEntryLoading(false);
    }
    fetchAvgFirstEntry();
  }, [rangeStart, rangeEnd]);

  // --- Typical Arrival Time per Client per Day of Week ---
  const [arrivalLoading, setArrivalLoading] = useState(false);
  const [arrivalTable, setArrivalTable] = useState<any[]>([]); // [{ clientName, timesByDay: { 0: '08:12', ... } }]
  const [arrivalClients, setArrivalClients] = useState<string[]>([]); // for optional filtering
  const [selectedArrivalClient, setSelectedArrivalClient] = useState<string>("");

  useEffect(() => {
    async function fetchTypicalArrivalTimes() {
      setArrivalLoading(true);
      // Fetch all pickup_entries
      const snap = await getDocs(collection(db, "pickup_entries"));
      const entries = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          clientId: data.clientId,
          clientName: data.clientName || data.clientId,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
          groupId: data.groupId,
        };
      }).filter(e => e.clientId && e.timestamp instanceof Date && !isNaN(e.timestamp.getTime()));
      // Group: clientId -> dayOfWeek (0=Sun) -> dateStr -> [first entry times]
      const byClientDay: Record<string, { clientName: string; timesByDay: Record<number, Record<string, Date[]>> }> = {};
      entries.forEach((e) => {
        const clientId = e.clientId;
        const clientName = e.clientName;
        const dateStr = e.timestamp.toISOString().slice(0, 10);
        const dayOfWeek = e.timestamp.getDay(); // 0=Sun, 1=Mon, ...
        if (!byClientDay[clientId]) byClientDay[clientId] = { clientName, timesByDay: {} };
        if (!byClientDay[clientId].timesByDay[dayOfWeek]) byClientDay[clientId].timesByDay[dayOfWeek] = {};
        if (!byClientDay[clientId].timesByDay[dayOfWeek][dateStr]) byClientDay[clientId].timesByDay[dayOfWeek][dateStr] = [];
        byClientDay[clientId].timesByDay[dayOfWeek][dateStr].push(e.timestamp);
      });
      // For each client/day, get first entry per date, then average
      const result: any[] = [];
      Object.entries(byClientDay).forEach(([clientId, { clientName, timesByDay }]) => {
        const avgTimes: Record<number, string> = {};
        for (let dow = 0; dow < 7; dow++) {
          const allDates = timesByDay[dow] || {};
          const firstTimes: Date[] = Object.values(allDates).map((arr: Date[]) => Array.isArray(arr) ? arr.sort((a, b) => a.getTime() - b.getTime())[0] : undefined).filter(Boolean) as Date[];
          if (firstTimes.length === 0) {
            avgTimes[dow] = "-";
            continue;
          }
          const avgMs = Math.round(
            firstTimes.reduce((sum, d) => sum + (d.getHours() * 3600000 + d.getMinutes() * 60000), 0) / firstTimes.length
          );
          const h = Math.floor(avgMs / 3600000);
          const m = Math.floor((avgMs % 3600000) / 60000);
          avgTimes[dow] = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        }
        result.push({ clientId, clientName, avgTimes });
      });
      // Sort by client name
      result.sort((a, b) => a.clientName.localeCompare(b.clientName));
      setArrivalTable(result);
      setArrivalClients(result.map(r => r.clientName));
      setArrivalLoading(false);
    }
    fetchTypicalArrivalTimes();
  }, []);

  // --- Average Total Weight per Hour per Day of Week ---
  const [hourlyWeightLoading, setHourlyWeightLoading] = useState(false);
  const [hourlyWeightTable, setHourlyWeightTable] = useState<any[][]>([]); // [ [avg for hour0, hour1, ...], ... ]
  const [hourlyWeightDays, setHourlyWeightDays] = useState<string[]>([]); // ['Mon', ...]
  const [hourlyWeightHours, setHourlyWeightHours] = useState<number[]>([]); // [0,1,...23]

  useEffect(() => {
    async function fetchHourlyWeightAnalytics() {
      setHourlyWeightLoading(true);
      const snap = await getDocs(collection(db, "pickup_entries"));
      const entries = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
          weight: Number(data.weight) || 0,
        };
      }).filter(e => e.timestamp instanceof Date && !isNaN(e.timestamp.getTime()));
      // Group: dayOfWeek (0=Sun) -> hour (0-23) -> dateStr -> total weight for that hour on that date
      const byDayHour: Record<number, Record<number, Record<string, number>>> = {};
      entries.forEach((e) => {
        const d = e.timestamp;
        const dayOfWeek = d.getDay();
        const hour = d.getHours();
        const dateStr = d.toISOString().slice(0, 10);
        if (!byDayHour[dayOfWeek]) byDayHour[dayOfWeek] = {};
        if (!byDayHour[dayOfWeek][hour]) byDayHour[dayOfWeek][hour] = {};
        if (!byDayHour[dayOfWeek][hour][dateStr]) byDayHour[dayOfWeek][hour][dateStr] = 0;
        byDayHour[dayOfWeek][hour][dateStr] += e.weight;
      });
      // For each dayOfWeek/hour, average the total weights per date
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const hours = Array.from({ length: 24 }, (_, i) => i);
      const table: any[][] = [];
      for (let dow = 1; dow <= 7; dow++) { // 1=Mon ... 7=Sun (0=Sun)
        const row: any[] = [];
        const dowIdx = dow % 7; // 0=Sun, 1=Mon, ...
        for (let h = 0; h < 24; h++) {
          const dateTotals = byDayHour[dowIdx]?.[h] || {};
          const totals = Object.values(dateTotals);
          if (totals.length === 0) {
            row.push("-");
          } else {
            const avg = totals.reduce((sum, v) => sum + v, 0) / totals.length;
            row.push(avg.toFixed(1));
          }
        }
        table.push(row);
      }
      setHourlyWeightTable(table);
      setHourlyWeightDays(days);
      setHourlyWeightHours(hours);
      setHourlyWeightLoading(false);
    }
    fetchHourlyWeightAnalytics();
  }, []);

  return (
    <div className="container py-4">
      <h2>Segregation Analytics</h2>
      <div className="mb-4">
        <label className="form-label">Segregation Done Logs (by Date)</label>
        <input
          type="date"
          className="form-control"
          style={{ maxWidth: 220 }}
          value={segDate}
          onChange={(e) => setSegDate(e.target.value)}
        />
        {segLoading ? (
          <div className="text-muted mt-2">Loading...</div>
        ) : segDoneLogs.length === 0 ? (
          <div className="text-muted mt-2">No logs for this date.</div>
        ) : (
          <table className="table table-bordered mt-2" style={{ maxWidth: 500 }}>
            <thead>
              <tr>
                <th>Client</th>
                <th>Weight (lbs)</th>
              </tr>
            </thead>
            <tbody>
              {segDoneLogs.map((log, idx) => (
                <tr key={log.clientId + log.timestamp + idx}>
                  <td>{log.clientName || log.clientId}</td>
                  <td>{log.weight || 0}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: '#f3f4f6' }}>
                <td>Total</td>
                <td>{segDoneLogs.reduce((sum, log) => sum + (Number(log.weight) || 0), 0)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      <div className="mb-5 mt-5">
        <h4>Average First Entry Time per Client per Day</h4>
        <div className="d-flex gap-3 align-items-end mb-3">
          <div>
            <label className="form-label">Start Date</label>
            <input type="date" className="form-control" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
          </div>
          <div>
            <label className="form-label">End Date</label>
            <input type="date" className="form-control" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
          </div>
        </div>
        {avgFirstEntryLoading ? (
          <div>Loading...</div>
        ) : avgFirstEntryRows.length === 0 ? (
          <div className="text-muted">No data for this range.</div>
        ) : (
          <table className="table table-bordered" style={{ maxWidth: 600 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Average First Entry Time</th>
              </tr>
            </thead>
            <tbody>
              {avgFirstEntryRows.map((row, i) => (
                <tr key={row.date + row.clientName + i}>
                  <td>{row.date}</td>
                  <td>{row.clientName}</td>
                  <td>{row.avgTimeStr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="mb-5 mt-5">
        <h4>Typical Arrival Time per Client per Day of Week</h4>
        <div className="mb-2" style={{ maxWidth: 350 }}>
          <label className="form-label">Filter by Client (optional)</label>
          <select className="form-select" value={selectedArrivalClient} onChange={e => setSelectedArrivalClient(e.target.value)}>
            <option value="">All Clients</option>
            {arrivalClients.map((name, i) => (
              <option key={i} value={name}>{name}</option>
            ))}
          </select>
        </div>
        {arrivalLoading ? (
          <div>Loading...</div>
        ) : arrivalTable.length === 0 ? (
          <div className="text-muted">No data.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-bordered" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Mon</th>
                  <th>Tue</th>
                  <th>Wed</th>
                  <th>Thu</th>
                  <th>Fri</th>
                  <th>Sat</th>
                  <th>Sun</th>
                </tr>
              </thead>
              <tbody>
                {arrivalTable.filter(row => !selectedArrivalClient || row.clientName === selectedArrivalClient).map((row, i) => (
                  <tr key={row.clientId + i}>
                    <td>{row.clientName}</td>
                    {/* Days: 1=Mon ... 0=Sun */}
                    <td>{row.avgTimes[1]}</td>
                    <td>{row.avgTimes[2]}</td>
                    <td>{row.avgTimes[3]}</td>
                    <td>{row.avgTimes[4]}</td>
                    <td>{row.avgTimes[5]}</td>
                    <td>{row.avgTimes[6]}</td>
                    <td>{row.avgTimes[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="mb-5 mt-5">
        <h4>Average Total Weight per Hour per Day of Week (All Clients)</h4>
        {hourlyWeightLoading ? (
          <div>Loading...</div>
        ) : hourlyWeightTable.length === 0 ? (
          <div className="text-muted">No data.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-bordered" style={{ minWidth: 1200, fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Day/Hour</th>
                  {hourlyWeightHours.map((h) => (
                    <th key={h}>{h}:00</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hourlyWeightTable.map((row, i) => (
                  <tr key={hourlyWeightDays[i] || i}>
                    <td style={{ fontWeight: 700 }}>{hourlyWeightDays[i]}</td>
                    {row.map((val, j) => (
                      <td key={j} style={{ textAlign: 'right' }}>{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;
