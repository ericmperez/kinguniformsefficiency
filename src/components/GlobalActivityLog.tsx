import React, { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

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

  useEffect(() => {
    const fetchLogs = async () => {
      const q = query(collection(db, "activity_log"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setLogs(
        snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as LogEntry[]
      );
      setLoading(false);
    };
    fetchLogs();
  }, []);

  return (
    <div className="card p-4 mb-4" style={{ maxWidth: 700, margin: "0 auto" }}>
      <h4 className="mb-3" style={{ fontWeight: 700, letterSpacing: 1 }}>Global Activity Log</h4>
      {loading ? (
        <div>Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-muted">No activity yet.</div>
      ) : (
        <ul className="list-unstyled mb-0" style={{ maxHeight: 400, overflowY: "auto" }}>
          {logs.map((log) => (
            <li key={log.id} className="mb-3 pb-2 border-bottom" style={{ fontSize: 16 }}>
              <div style={{ fontWeight: 600 }}>{log.type}</div>
              <div>{log.message}</div>
              <div style={{ color: "#888", fontSize: 13 }}>
                {log.user ? `By: ${log.user}` : ""} &nbsp;|
                {log.createdAt?.seconds ?
                  new Date(log.createdAt.seconds * 1000).toLocaleString() :
                  "Unknown time"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
