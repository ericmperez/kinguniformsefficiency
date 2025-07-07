import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
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
    </div>
  );
};

export default AnalyticsPage;
