import React, { useEffect, useState } from "react";
import { Invoice, Client, Product } from "../types";
import {
  getInvoices,
  getClients,
  getProducts,
  updateInvoice,
  addInvoice,
} from "../services/firebaseService";
// Add Firestore imports for reporting
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import InvoiceDetailsModal from "./InvoiceDetailsModal";
import InvoiceForm from "./InvoiceForm";

const ReportsPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showInvoiceDetailsModal, setShowInvoiceDetailsModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

  useEffect(() => {
    (async () => {
      const all = await getInvoices();
      setInvoices(all.filter((inv: Invoice) => inv.status === "done"));
      setClients(await getClients());
      setAllProducts(await getProducts());
    })();
  }, []);

  // Refresh invoices from Firestore
  const refreshInvoices = async () => {
    const all = await getInvoices();
    setInvoices(all.filter((inv: Invoice) => inv.status === "done"));
  };

  return (
    <div className="container py-4">
      <h2>Shipped/Done Invoices</h2>
      <button
        className="btn btn-primary mb-3"
        onClick={() => setShowInvoiceForm(true)}
      >
        New Invoice
      </button>
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
                                  .map((p) => `${p.name} (${p.price}${p.editedBy ? ", edited by " + p.editedBy : ""})`)
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
                                          `${item.productName} x${item.quantity}` +
                                          (item.editedBy ? ` (edited by ${item.editedBy})` : "")
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
                                    "Are you sure you want to permanently delete this invoice? This cannot be undone."
                                  )
                                )
                                  return;
                                try {
                                  const { deleteInvoice } = await import(
                                    "../services/firebaseService"
                                  );
                                  await deleteInvoice(inv.id);
                                  setInvoices((prev) =>
                                    prev.filter((i) => i.id !== inv.id)
                                  );
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
            // Handle special keys for invoice name and cart name edits
            if (cartName.startsWith("__invoice_name__")) {
              const newInvoiceName = cartName.replace("__invoice_name__", "");
              await updateInvoice(selectedInvoice.id, { name: newInvoiceName });
              await refreshInvoices();
              return {
                id: selectedInvoice.id,
                name: newInvoiceName,
                isActive: true,
              };
            }
            if (cartName.startsWith("__edit__")) {
              const [_, cartId, ...nameParts] = cartName.split("__");
              const newName = nameParts.join("__");
              const updatedCarts = (selectedInvoice.carts || []).map((c) =>
                c.id === cartId ? { ...c, name: newName } : c
              );
              await updateInvoice(selectedInvoice.id, { carts: updatedCarts });
              await refreshInvoices();
              return { id: cartId, name: newName, isActive: true };
            }
            // Add new cart
            const newCart = {
              id: Date.now().toString(),
              name: cartName,
              items: [],
              total: 0,
              createdAt: new Date().toISOString(),
            };
            const updatedCarts = [...(selectedInvoice.carts || []), newCart];
            await updateInvoice(selectedInvoice.id, { carts: updatedCarts });
            await refreshInvoices();
            return { id: newCart.id, name: newCart.name, isActive: true };
          }}
          onAddProductToCart={async (
            cartId,
            productId,
            quantity,
            price,
            itemIdx
          ) => {
            const invoice = invoices.find(
              (inv) => inv.id === selectedInvoice.id
            );
            if (!invoice) return;
            const updatedCarts = invoice.carts.map((cart) => {
              if (cart.id !== cartId) return cart;
              let newItems;
              if (typeof itemIdx === "number") {
                // Edit the entry at the given index for this product
                newItems = cart.items.map((item, idx) => {
                  if (item.productId === productId && idx === itemIdx) {
                    return {
                      ...item,
                      quantity,
                      price: price !== undefined ? price : item.price,
                      editedBy: "You",
                      editedAt: new Date().toISOString(),
                    };
                  }
                  return item;
                });
              } else {
                // Always add as a new entry (do not merge)
                const prod = allProducts.find((p) => p.id === productId);
                newItems = [
                  ...cart.items,
                  {
                    productId: productId,
                    productName: prod ? prod.name : "",
                    quantity: quantity,
                    price: price !== undefined ? price : prod ? prod.price : 0,
                    addedBy: "You",
                    addedAt: new Date().toISOString(),
                  },
                ];
              }
              return { ...cart, items: newItems };
            });
            await updateInvoice(invoice.id, { carts: updatedCarts });
            await refreshInvoices();
          }}
          refreshInvoices={refreshInvoices}
        />
      )}
      {showInvoiceForm && (
        <InvoiceForm
          clients={clients}
          products={allProducts}
          onClose={() => setShowInvoiceForm(false)}
          onAddInvoice={async (invoice) => {
            await addInvoice(invoice);
            await refreshInvoices();
            setShowInvoiceForm(false);
            return "";
          }}
        />
      )}
    </div>
  );
};

export default ReportsPage;
