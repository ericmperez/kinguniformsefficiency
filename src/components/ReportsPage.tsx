import React, { useEffect, useState } from "react";
import { Invoice } from "../types";
import { getInvoices } from "../services/firebaseService";

const ReportsPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  useEffect(() => {
    (async () => {
      const all = await getInvoices();
      setInvoices(all.filter((inv: Invoice) => inv.status === "done"));
    })();
  }, []);
  return (
    <div className="container py-4">
      <h2>Shipped/Done Invoices</h2>
      <table className="table table-bordered mt-4">
        <thead>
          <tr>
            <th>Invoice #</th>
            <th>Client</th>
            <th>Date</th>
            <th>Truck #</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(inv => (
            <tr key={inv.id}>
              <td>{inv.invoiceNumber}</td>
              <td>{inv.clientName}</td>
              <td>{inv.date}</td>
              <td>{inv.truckNumber || "-"}</td>
              <td>{inv.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReportsPage;
