import React, { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { cleanupOldActivityLogs } from "../services/firebaseService";

interface LogEntry {
  id: string;
  type: string;
  message: string;
  user?: string;
  createdAt: any;
}

export default function GlobalActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        // Clean up old logs first (older than 15 days)
        await cleanupOldActivityLogs();
        
        // Calculate 15 days ago
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        const cutoffTimestamp = Timestamp.fromDate(fifteenDaysAgo);
        
        let qBase = collection(db, "activity_log");
        let qFinal = query(
          qBase, 
          where("createdAt", ">=", cutoffTimestamp),
          orderBy("createdAt", "desc")
        );
        
        const snap = await getDocs(qFinal);
        const allLogs = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type || "",
            message: data.message || "",
            user: data.user || "",
            createdAt: data.createdAt,
          };
        });
        
        if (date) {
          const start = new Date(date);
          start.setHours(0, 0, 0, 0);
          const end = new Date(date);
          end.setHours(23, 59, 59, 999);
          setLogs(
            allLogs.filter((log) => {
              if (!log.createdAt?.seconds) return false;
              const logDate = new Date(log.createdAt.seconds * 1000);
              return logDate >= start && logDate <= end;
            })
          );
        } else {
          setLogs(allLogs);
        }
      } catch (error) {
        console.error("Error fetching activity logs:", error);
        setLogs([]);
      }
      setLoading(false);
    };
    fetchLogs();
  }, [date]);

  // Filter logs by search query
  const filteredLogs = logs.filter((log) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      log.type.toLowerCase().includes(q) ||
      log.message.toLowerCase().includes(q) ||
      (log.user || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="card p-4 mb-4" style={{ maxWidth: 700, margin: "0 auto" }}>
      <h4 className="mb-3" style={{ fontWeight: 700, letterSpacing: 1 }}>
        Global Activity Log (Last 15 Days)
      </h4>
      <div className="mb-3">
        <label className="form-label">Filter by Date (within last 15 days)</label>
        <input
          type="date"
          className="form-control mb-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
          max={new Date().toISOString().slice(0, 10)}
        />
        <input
          type="text"
          className="form-control"
          placeholder="Search activity log..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-muted">No activity in the last 15 days.</div>
      ) : (
        <ul
          className="list-unstyled mb-0"
          style={{ maxHeight: 400, overflowY: "auto" }}
        >
          {filteredLogs.map((log) => (
            <li
              key={log.id}
              className="mb-3 pb-2 border-bottom"
              style={{ fontSize: 16 }}
            >
              <div style={{ fontWeight: 600 }}>{log.type}</div>
              <div>{log.message}</div>
              <div style={{ color: "#888", fontSize: 13 }}>
                {log.user ? `By: ${log.user}` : ""} &nbsp;|
                {log.createdAt?.seconds
                  ? new Date(log.createdAt.seconds * 1000).toLocaleString()
                  : "Unknown time"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
