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
import { formatDateOnlySpanish } from "../utils/dateFormatter";
import { db } from "../firebase";
import InvoiceDetailsModal from "./InvoiceDetailsModal";
import InvoiceForm from "./InvoiceForm";
import Report from "./Report";
import WeightIntervalAnalytics from "./WeightIntervalAnalytics";
import PieceIntervalAnalytics from "./PieceIntervalAnalytics";
import { useAuth } from "./AuthContext";

const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showInvoiceDetailsModal, setShowInvoiceDetailsModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [activeSection, setActiveSection] = useState<
    "boletas" | "reports" | "status" | "weightAnalytics" | "pieceAnalytics"
  >("boletas");

  // Status section query filter state
  const [statusQuery, setStatusQuery] = useState<string>("all");

  // Product confirmation dialog state
  const [showAddConfirmation, setShowAddConfirmation] = useState(false);
  const [confirmationProduct, setConfirmationProduct] = useState<{
    cartId: string;
    productId: string;
    product: Product | null;
    quantity: number;
    price?: number;
    itemIdx?: number;
    addCallback: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    (async () => {
      // Get all invoices for status view, but filter only done ones for boletas view
      const all = await getInvoices();
      if (activeSection === "status") {
        setInvoices(all); // Show all invoices in status view
      } else {
        setInvoices(all.filter((inv: Invoice) => inv.status === "done"));
      }
      setClients(await getClients());
      setAllProducts(await getProducts());
    })();
  }, [activeSection]);

  // Refresh invoices from Firestore
  const refreshInvoices = async () => {
    const all = await getInvoices();
    if (activeSection === "status") {
      setInvoices(all); // Show all invoices in status view
    } else {
      setInvoices(all.filter((inv: Invoice) => inv.status === "done"));
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex gap-3 mb-4">
        <button
          className={`btn${
            activeSection === "boletas"
              ? " btn-primary"
              : " btn-outline-primary"
          }`}
          onClick={() => setActiveSection("boletas")}
        >
          Boletas
        </button>
        <button
          className={`btn${
            activeSection === "reports"
              ? " btn-primary"
              : " btn-outline-primary"
          }`}
          onClick={() => setActiveSection("reports")}
        >
          Reports
        </button>
        <button
          className={`btn${
            activeSection === "status" ? " btn-primary" : " btn-outline-primary"
          }`}
          onClick={() => setActiveSection("status")}
        >
          Status
        </button>
        <button
          className={`btn${
            activeSection === "weightAnalytics"
              ? " btn-primary"
              : " btn-outline-primary"
          }`}
          onClick={() => setActiveSection("weightAnalytics")}
        >
          Weight Analytics
        </button>
        <button
          className={`btn${
            activeSection === "pieceAnalytics"
              ? " btn-primary"
              : " btn-outline-primary"
          }`}
          onClick={() => setActiveSection("pieceAnalytics")}
        >
          Piece Analytics
        </button>
      </div>
      {activeSection === "boletas" && (
        <>
          <h2>Shipped/Done Invoices</h2>
          <div className="mb-3" style={{ maxWidth: 350 }}>
            <label className="form-label">Select Client</label>
            <select
              className="form-select"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">-- Select Client --</option>
              {clients
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          {selectedClientId
            ? (() => {
                const client = clients.find((c) => c.id === selectedClientId);
                const clientInvoices = invoices.filter(
                  (inv) => inv.clientId === selectedClientId
                );
                if (clientInvoices.length === 0) {
                  return (
                    <div className="text-muted">
                      No completed invoices found for this client.
                    </div>
                  );
                }
                return (
                  <div key={selectedClientId} className="mb-5">
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
                                    ? formatDateOnlySpanish(inv.date)
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
                                                `${item.productName} x${item.quantity}` +
                                                (item.editedBy
                                                  ? ` (edited by ${item.editedBy})`
                                                  : "")
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
              })()
            : null}
          {showInvoiceDetailsModal && selectedInvoice && (
            <InvoiceDetailsModal
              invoice={selectedInvoice}
              onClose={() => setShowInvoiceDetailsModal(false)}
              client={clients.find((c) => c.id === selectedInvoice.clientId)}
              products={allProducts}
              onAddCart={async (cartName: string) => {
                // Handle special keys for invoice name and cart name edits
                if (cartName.startsWith("__invoice_name__")) {
                  const newInvoiceName = cartName.replace(
                    "__invoice_name__",
                    ""
                  );
                  await updateInvoice(selectedInvoice.id, {
                    name: newInvoiceName,
                  });
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
                  await updateInvoice(selectedInvoice.id, {
                    carts: updatedCarts,
                  });
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
                  createdBy: user?.username || "Unknown",
                };
                const updatedCarts = [
                  ...(selectedInvoice.carts || []),
                  newCart,
                ];
                await updateInvoice(selectedInvoice.id, {
                  carts: updatedCarts,
                });
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

                // If it's a deletion (quantity=0), process immediately without confirmation
                if (quantity === 0 && typeof itemIdx === "number") {
                  const updatedCarts = invoice.carts.map((cart) => {
                    if (cart.id !== cartId) return cart;
                    const newItems = cart.items.filter(
                      (item, idx) =>
                        !(item.productId === productId && idx === itemIdx)
                    );
                    return { ...cart, items: newItems };
                  });
                  await updateInvoice(invoice.id, { carts: updatedCarts });
                  await refreshInvoices();
                  return;
                }

                const prod = allProducts.find((p) => p.id === productId);

                // Create product add callback
                const addProductCallback = async () => {
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
                      newItems = [
                        ...cart.items,
                        {
                          productId: productId,
                          productName: prod ? prod.name : "",
                          quantity: quantity,
                          price:
                            price !== undefined ? price : prod ? prod.price : 0,
                          addedBy: "You",
                          addedAt: new Date().toISOString(),
                        },
                      ];
                    }
                    return { ...cart, items: newItems };
                  });
                  await updateInvoice(invoice.id, { carts: updatedCarts });
                  await refreshInvoices();

                  // Clear confirmation state
                  setShowAddConfirmation(false);
                  setConfirmationProduct(null);
                };

                // Show confirmation dialog
                setConfirmationProduct({
                  cartId,
                  productId,
                  product: prod || null,
                  quantity,
                  price,
                  itemIdx,
                  addCallback: addProductCallback,
                });
                setShowAddConfirmation(true);
              }}
              onUpdateInvoice={updateInvoice}
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

          {/* Product Add Confirmation Modal */}
          {showAddConfirmation && confirmationProduct && (
            <div
              className="modal show"
              style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
            >
              <div className="modal-dialog" style={{ marginTop: "10vh" }}>
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Confirm Product Addition</h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => {
                        setShowAddConfirmation(false);
                        setConfirmationProduct(null);
                      }}
                    ></button>
                  </div>
                  <div className="modal-body text-center">
                    <div className="mb-4">
                      <h4 className="mb-3">User wants to add</h4>
                      <div
                        className="display-1 fw-bold text-primary mb-3"
                        style={{ fontSize: "4rem" }}
                      >
                        {confirmationProduct.quantity}
                      </div>
                      <h3 className="text-secondary">
                        {confirmationProduct.product?.name || "Product"}
                      </h3>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowAddConfirmation(false);
                        setConfirmationProduct(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={confirmationProduct.addCallback}
                    >
                      Confirm Addition
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {activeSection === "reports" && (
        <>
          <h2>Pickup Entries Report</h2>
          <Report />
        </>
      )}
      {activeSection === "status" && (
        <>
          <h2>Invoice Status Overview</h2>

          {/* Status Query Buttons */}
          <div className="mb-4">
            <div className="row g-2">
              <div className="col-auto">
                <button
                  className={`btn ${
                    statusQuery === "all"
                      ? "btn-primary"
                      : "btn-outline-primary"
                  }`}
                  onClick={() => setStatusQuery("all")}
                >
                  All Invoices ({invoices.length})
                </button>
              </div>
              <div className="col-auto">
                <button
                  className={`btn ${
                    statusQuery === "active"
                      ? "btn-primary"
                      : "btn-outline-primary"
                  }`}
                  onClick={() => setStatusQuery("active")}
                >
                  Active (
                  {
                    invoices.filter(
                      (inv) => !inv.status || inv.status === "active"
                    ).length
                  }
                  )
                </button>
              </div>
              <div className="col-auto">
                <button
                  className={`btn ${
                    statusQuery === "completed"
                      ? "btn-primary"
                      : "btn-outline-primary"
                  }`}
                  onClick={() => setStatusQuery("completed")}
                >
                  Completed (
                  {
                    invoices.filter(
                      (inv) =>
                        inv.status === "completed" ||
                        inv.verified ||
                        inv.status === "done"
                    ).length
                  }
                  )
                </button>
              </div>
              <div className="col-auto">
                <button
                  className={`btn ${
                    statusQuery === "verified"
                      ? "btn-primary"
                      : "btn-outline-primary"
                  }`}
                  onClick={() => setStatusQuery("verified")}
                >
                  Verified (
                  {
                    invoices.filter(
                      (inv) => inv.verified || inv.partiallyVerified
                    ).length
                  }
                  )
                </button>
              </div>
              <div className="col-auto">
                <button
                  className={`btn ${
                    statusQuery === "shipped"
                      ? "btn-primary"
                      : "btn-outline-primary"
                  }`}
                  onClick={() => setStatusQuery("shipped")}
                >
                  Shipped (
                  {invoices.filter((inv) => inv.status === "done").length})
                </button>
              </div>
              <div className="col-auto">
                <button
                  className={`btn ${
                    statusQuery === "signed"
                      ? "btn-primary"
                      : "btn-outline-primary"
                  }`}
                  onClick={() => setStatusQuery("signed")}
                >
                  Signed ({invoices.filter((inv) => !!inv.signature).length})
                </button>
              </div>
              <div className="col-auto">
                <button
                  className={`btn ${
                    statusQuery === "overdue"
                      ? "btn-primary"
                      : "btn-outline-primary"
                  }`}
                  onClick={() => setStatusQuery("overdue")}
                >
                  Overdue (
                  {
                    invoices.filter((inv) => {
                      if (!inv.date || inv.verified || inv.status === "done")
                        return false;
                      const now = new Date();
                      const created = new Date(inv.date);
                      return (
                        now.getTime() - created.getTime() > 24 * 60 * 60 * 1000
                      );
                    }).length
                  }
                  )
                </button>
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered table-hover">
              <thead>
                <tr>
                  <th>Invoice Name/ID</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Active</th>
                  <th>Completed</th>
                  <th>Verified</th>
                  <th>Shipped</th>
                  <th>Signed</th>
                  <th>Printed</th>
                  <th>Email Status</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Filter invoices based on selected query
                  let filteredInvoices = [...invoices];

                  switch (statusQuery) {
                    case "active":
                      filteredInvoices = invoices.filter(
                        (inv) => !inv.status || inv.status === "active"
                      );
                      break;
                    case "completed":
                      filteredInvoices = invoices.filter(
                        (inv) =>
                          inv.status === "completed" ||
                          inv.verified ||
                          inv.status === "done"
                      );
                      break;
                    case "verified":
                      filteredInvoices = invoices.filter(
                        (inv) => inv.verified || inv.partiallyVerified
                      );
                      break;
                    case "shipped":
                      filteredInvoices = invoices.filter(
                        (inv) => inv.status === "done"
                      );
                      break;
                    case "signed":
                      filteredInvoices = invoices.filter(
                        (inv) => !!inv.signature
                      );
                      break;
                    case "overdue":
                      filteredInvoices = invoices.filter((inv) => {
                        if (!inv.date || inv.verified || inv.status === "done")
                          return false;
                        const now = new Date();
                        const created = new Date(inv.date);
                        return (
                          now.getTime() - created.getTime() >
                          24 * 60 * 60 * 1000
                        );
                      });
                      break;
                    default:
                      // "all" - no filtering
                      break;
                  }

                  return filteredInvoices
                    .sort((a, b) => {
                      // Sort by date (newest first), then by client name
                      if (a.date && b.date) {
                        const dateComparison =
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime();
                        if (dateComparison !== 0) return dateComparison;
                      }
                      return (a.clientName || "").localeCompare(
                        b.clientName || ""
                      );
                    })
                    .map((invoice) => {
                      const isActive =
                        !invoice.status || invoice.status === "active";
                      const isCompleted =
                        invoice.status === "completed" ||
                        invoice.verified ||
                        invoice.status === "done";
                      const isVerified =
                        invoice.verified || invoice.partiallyVerified;
                      const isShipped = invoice.status === "done";
                      const hasSigned = !!invoice.signature;
                      const isPrinted = !!invoice.signature; // Assuming printed when signed

                      // Email status logic
                      const emailStatus = invoice.emailStatus;
                      const hasApprovalEmail = emailStatus?.approvalEmailSent;
                      const hasShippingEmail = emailStatus?.shippingEmailSent;
                      const hasEmailError = emailStatus?.lastEmailError;

                      // Determine email status display
                      const getEmailStatusDisplay = () => {
                        if (hasEmailError) {
                          return {
                            icon: "bi bi-x-circle-fill text-danger",
                            title: `Email Error: ${hasEmailError}`,
                            text: "Error",
                          };
                        }

                        if (isShipped && hasShippingEmail) {
                          return {
                            icon: "bi bi-check-circle-fill text-success",
                            title: `Shipping email sent at ${
                              emailStatus?.shippingEmailSentAt
                                ? new Date(
                                    emailStatus.shippingEmailSentAt
                                  ).toLocaleString()
                                : "unknown time"
                            }`,
                            text: "Sent (Ship)",
                          };
                        }

                        if (isVerified && hasApprovalEmail) {
                          return {
                            icon: "bi bi-check-circle-fill text-success",
                            title: `Approval email sent at ${
                              emailStatus?.approvalEmailSentAt
                                ? new Date(
                                    emailStatus.approvalEmailSentAt
                                  ).toLocaleString()
                                : "unknown time"
                            }`,
                            text: "Sent (Approval)",
                          };
                        }

                        if (isShipped || isVerified) {
                          return {
                            icon: "bi bi-circle text-muted",
                            title: "No email sent",
                            text: "Not Sent",
                          };
                        }

                        return {
                          icon: "bi bi-dash-circle text-muted",
                          title:
                            "Not applicable - invoice not approved/shipped yet",
                          text: "N/A",
                        };
                      };

                      const emailDisplay = getEmailStatusDisplay();

                      // Check if overdue
                      const isOverdue =
                        invoice.date &&
                        !invoice.verified &&
                        !isShipped &&
                        new Date().getTime() -
                          new Date(invoice.date).getTime() >
                          24 * 60 * 60 * 1000;

                      return (
                        <tr
                          key={invoice.id}
                          className={isOverdue ? "table-warning" : ""}
                        >
                          <td>
                            <button
                              className="btn btn-link p-0 text-start"
                              style={{ textDecoration: "none" }}
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setShowInvoiceDetailsModal(true);
                              }}
                            >
                              {invoice.name ||
                                invoice.invoiceNumber ||
                                invoice.id}
                              {isOverdue && (
                                <i
                                  className="bi bi-exclamation-triangle-fill text-warning ms-2"
                                  title="Overdue (>24h)"
                                ></i>
                              )}
                            </button>
                          </td>
                          <td>{invoice.clientName}</td>
                          <td>
                            {invoice.date
                              ? formatDateOnlySpanish(invoice.date)
                              : "-"}
                          </td>
                          <td className="text-center">
                            {isActive ? (
                              <i
                                className="bi bi-check-circle-fill text-success"
                                title="Active"
                              ></i>
                            ) : (
                              <i
                                className="bi bi-circle text-muted"
                                title="Not Active"
                              ></i>
                            )}
                          </td>
                          <td className="text-center">
                            {isCompleted ? (
                              <i
                                className="bi bi-check-circle-fill text-success"
                                title="Completed"
                              ></i>
                            ) : (
                              <i
                                className="bi bi-circle text-muted"
                                title="Not Completed"
                              ></i>
                            )}
                          </td>
                          <td className="text-center">
                            {isVerified ? (
                              <i
                                className="bi bi-check-circle-fill text-success"
                                title={
                                  invoice.verified
                                    ? "Fully Verified"
                                    : "Partially Verified"
                                }
                              ></i>
                            ) : (
                              <i
                                className="bi bi-circle text-muted"
                                title="Not Verified"
                              ></i>
                            )}
                          </td>
                          <td className="text-center">
                            {isShipped ? (
                              <i
                                className="bi bi-check-circle-fill text-success"
                                title="Shipped"
                              ></i>
                            ) : (
                              <i
                                className="bi bi-circle text-muted"
                                title="Not Shipped"
                              ></i>
                            )}
                          </td>
                          <td className="text-center">
                            {hasSigned ? (
                              <i
                                className="bi bi-check-circle-fill text-success"
                                title="Signed by Client"
                              ></i>
                            ) : (
                              <i
                                className="bi bi-circle text-muted"
                                title="Not Signed"
                              ></i>
                            )}
                          </td>
                          <td className="text-center">
                            {isPrinted ? (
                              <i
                                className="bi bi-check-circle-fill text-success"
                                title="Printed"
                              ></i>
                            ) : (
                              <i
                                className="bi bi-circle text-muted"
                                title="Not Printed"
                              ></i>
                            )}
                          </td>
                          <td className="text-center">
                            <div className="d-flex flex-column align-items-center">
                              <i
                                className={emailDisplay.icon}
                                title={emailDisplay.title}
                              ></i>
                              <small
                                className="text-muted"
                                style={{ fontSize: "0.75rem" }}
                              >
                                {emailDisplay.text}
                              </small>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                })()}
              </tbody>
            </table>

            {/* Show message when no invoices match the query */}
            {(() => {
              let filteredCount = invoices.length;
              switch (statusQuery) {
                case "active":
                  filteredCount = invoices.filter(
                    (inv) => !inv.status || inv.status === "active"
                  ).length;
                  break;
                case "completed":
                  filteredCount = invoices.filter(
                    (inv) =>
                      inv.status === "completed" ||
                      inv.verified ||
                      inv.status === "done"
                  ).length;
                  break;
                case "verified":
                  filteredCount = invoices.filter(
                    (inv) => inv.verified || inv.partiallyVerified
                  ).length;
                  break;
                case "shipped":
                  filteredCount = invoices.filter(
                    (inv) => inv.status === "done"
                  ).length;
                  break;
                case "signed":
                  filteredCount = invoices.filter(
                    (inv) => !!inv.signature
                  ).length;
                  break;
                case "overdue":
                  filteredCount = invoices.filter((inv) => {
                    if (!inv.date || inv.verified || inv.status === "done")
                      return false;
                    const now = new Date();
                    const created = new Date(inv.date);
                    return (
                      now.getTime() - created.getTime() > 24 * 60 * 60 * 1000
                    );
                  }).length;
                  break;
              }

              if (filteredCount === 0) {
                const queryLabels = {
                  all: "invoices",
                  active: "active invoices",
                  completed: "completed invoices",
                  verified: "verified invoices",
                  shipped: "shipped invoices",
                  signed: "signed invoices",
                  overdue: "overdue invoices",
                };

                return (
                  <div className="text-center text-muted py-4">
                    <i className="bi bi-inbox display-1 mb-3 d-block"></i>
                    No{" "}
                    {queryLabels[statusQuery as keyof typeof queryLabels] ||
                      "invoices"}{" "}
                    found.
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </>
      )}

      {activeSection === "weightAnalytics" && (
        <>
          <h2>Weight Interval Analytics</h2>
          <WeightIntervalAnalytics />
        </>
      )}

      {activeSection === "pieceAnalytics" && (
        <>
          <h2>Piece Interval Analytics (Mangle vs Doblado)</h2>
          <PieceIntervalAnalytics />
        </>
      )}

      {/* Invoice Details Modal */}
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
              await updateInvoice(selectedInvoice.id, {
                name: newInvoiceName,
              });
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
              await updateInvoice(selectedInvoice.id, {
                carts: updatedCarts,
              });
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
              createdBy: user?.username || "Unknown",
            };
            const updatedCarts = [...(selectedInvoice.carts || []), newCart];
            await updateInvoice(selectedInvoice.id, {
              carts: updatedCarts,
            });
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

            // If it's a deletion (quantity=0), process immediately without confirmation
            if (quantity === 0 && typeof itemIdx === "number") {
              const updatedCarts = invoice.carts.map((cart) => {
                if (cart.id !== cartId) return cart;
                const newItems = cart.items.filter(
                  (item, idx) =>
                    !(item.productId === productId && idx === itemIdx)
                );
                return { ...cart, items: newItems };
              });
              await updateInvoice(invoice.id, { carts: updatedCarts });
              await refreshInvoices();
              return;
            }

            const prod = allProducts.find((p) => p.id === productId);

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
          onUpdateInvoice={updateInvoice}
          refreshInvoices={refreshInvoices}
        />
      )}
    </div>
  );
};

export default ReportsPage;
