import React, { useEffect, useState } from "react";
import { Invoice, Client, Product } from "../types";
import {
  getInvoices,
  getClients,
  getProducts,
} from "../services/firebaseService";
import InvoiceDetailsModal from "./InvoiceDetailsModal";

const ReportsPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showInvoiceDetailsModal, setShowInvoiceDetailsModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    (async () => {
      const all = await getInvoices();
      setInvoices(all.filter((inv: Invoice) => inv.status === "done"));
      setClients(await getClients());
      setAllProducts(await getProducts());
    })();
  }, []);

  return (
    <div className="container py-4">
      <h2>Shipped/Done Invoices</h2>
      {/* Grouped Table by Client */}
      {(() => {
        // Group invoices by clientId
        const grouped = invoices.reduce((acc, inv) => {
          if (!acc[inv.clientId]) acc[inv.clientId] = [];
          acc[inv.clientId].push(inv);
          return acc;
        }, {} as Record<string, Invoice[]>);
        if (Object.keys(grouped).length === 0) {
          return <div className="text-muted">No completed invoices found.</div>;
        }
        return Object.entries(grouped).map(([clientId, clientInvoices]) => {
          const client = clients.find((c) => c.id === clientId);
          return (
            <div key={clientId} className="mb-5">
              <h5 style={{ fontWeight: 700, color: "#0ea5e9" }}>
                {client?.name || clientInvoices[0].clientName}
              </h5>
              <div className="table-responsive">
                <table className="table table-bordered table-hover">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Truck #</th>
                      <th>Total Weight</th>
                      <th>Products</th>
                      <th>Carts</th>
                      <th>Invoice Name</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientInvoices
                      .sort((a, b) => {
                        if (a.invoiceNumber && b.invoiceNumber)
                          return a.invoiceNumber - b.invoiceNumber;
                        if (a.date && b.date)
                          return (
                            new Date(a.date).getTime() -
                            new Date(b.date).getTime()
                          );
                        return a.id.localeCompare(b.id);
                      })
                      .map((inv) => (
                        <tr key={inv.id}>
                          <td>{inv.invoiceNumber || inv.id}</td>
                          <td>
                            {inv.date
                              ? new Date(inv.date).toLocaleDateString()
                              : "-"}
                          </td>
                          <td>{inv.status || "-"}</td>
                          <td>{inv.truckNumber || "-"}</td>
                          <td>{inv.totalWeight || "-"}</td>
                          <td>
                            {inv.products && inv.products.length > 0
                              ? inv.products
                                  .map((p) => `${p.name} (${p.price})`)
                                  .join(", ")
                              : "-"}
                          </td>
                          <td>
                            {inv.carts && inv.carts.length > 0
                              ? inv.carts.map((cart) => (
                                  <div key={cart.id}>
                                    <b>{cart.name}:</b>{" "}
                                    {cart.items
                                      .map(
                                        (item) =>
                                          `${item.productName} x${item.quantity}`
                                      )
                                      .join(", ")}
                                  </div>
                                ))
                              : "-"}
                          </td>
                          <td>{inv.name || "-"}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setShowInvoiceDetailsModal(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger ms-2"
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    "Are you sure you want to delete this invoice?"
                                  )
                                )
                                  return;
                                try {
                                  const { doc, setDoc } = await import(
                                    "firebase/firestore"
                                  );
                                  const { db } = await import("../firebase");
                                  const docRef = doc(db, "invoices", inv.id);
                                  await setDoc(docRef, { status: "deleted" }, { merge: true });
                                  setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
                                } catch (e) {
                                  alert("Error deleting invoice.");
                                }
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        });
      })()}
      {showInvoiceDetailsModal && selectedInvoice && (
        <InvoiceDetailsModal
          invoice={selectedInvoice}
          onClose={() => setShowInvoiceDetailsModal(false)}
          client={clients.find((c) => c.id === selectedInvoice.clientId)}
          products={allProducts}
          onAddCart={async (cartName: string) => {
            return {
              id: Date.now().toString(),
              name: cartName,
              isActive: true,
            };
          }}
          onAddProductToCart={() => {}}
        />
      )}
    </div>
  );
};

export default ReportsPage;
