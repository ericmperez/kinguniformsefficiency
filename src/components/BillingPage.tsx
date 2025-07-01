import React, { useEffect, useState } from "react";
import { Invoice, Client, Product } from "../types";
import {
  getInvoices,
  getClients,
  updateInvoice,
} from "../services/firebaseService";
import {
  collection,
  setDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import InvoiceDetailsModal from "./InvoiceDetailsModal";
import html2pdf from "html2pdf.js";

const nowrapCellStyle = { whiteSpace: "nowrap" };

const BillingPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // State for per-client, per-product prices
  const [productPrices, setProductPrices] = useState<Record<string, number>>(
    {}
  );
  const [saveStatus, setSaveStatus] = useState<string>("");

  // State for minimum billing value
  const [minBilling, setMinBilling] = useState<string>("");

  // State for service and fuel charge
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargePercent, setServiceChargePercent] = useState("");
  const [fuelChargeEnabled, setFuelChargeEnabled] = useState(false);
  const [fuelChargePercent, setFuelChargePercent] = useState("");

  // State for surcharge
  const [surchargeEnabled, setSurchargeEnabled] = useState(false);
  const [surchargePercent, setSurchargePercent] = useState("");

  // Get selected client object
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  // Get products for selected client
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (!selectedClient) return;
    (async () => {
      // Dynamically import getProducts to avoid circular deps
      const { getProducts } = await import("../services/firebaseService");
      const products = await getProducts();
      setAllProducts(products);
    })();
  }, [selectedClientId]);

  useEffect(() => {
    (async () => {
      const all = await getInvoices();
      setInvoices(all.filter((inv: Invoice) => inv.status === "done"));
      setClients(await getClients());
    })();
  }, []);

  // Load prices for selected client
  useEffect(() => {
    if (!selectedClient) {
      setProductPrices({});
      return;
    }
    (async () => {
      const q = query(
        collection(db, "client_product_prices"),
        where("clientId", "==", selectedClient.id)
      );
      const snap = await getDocs(q);
      const prices: Record<string, number> = {};
      snap.docs.forEach((doc) => {
        const data = doc.data();
        prices[data.productId] = data.price;
      });
      setProductPrices(prices);
    })();
  }, [selectedClientId]);

  // Load minimum billing value for selected client
  useEffect(() => {
    if (!selectedClient) {
      setMinBilling("");
      return;
    }
    (async () => {
      const { getDoc, doc } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      const docRef = doc(db, "client_minimum_billing", selectedClient.id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setMinBilling(String(snap.data().minBilling ?? ""));
      } else {
        setMinBilling("");
      }
    })();
  }, [selectedClientId]);

  // Load both charges for selected client
  useEffect(() => {
    if (!selectedClient) {
      setServiceChargeEnabled(false);
      setServiceChargePercent("");
      setFuelChargeEnabled(false);
      setFuelChargePercent("");
      return;
    }
    (async () => {
      const { getDoc, doc } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      const docRef = doc(db, "client_minimum_billing", selectedClient.id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setServiceChargeEnabled(!!snap.data().serviceChargeEnabled);
        setServiceChargePercent(
          snap.data().serviceChargePercent !== undefined
            ? String(snap.data().serviceChargePercent)
            : ""
        );
        setFuelChargeEnabled(!!snap.data().fuelChargeEnabled);
        setFuelChargePercent(
          snap.data().fuelChargePercent !== undefined
            ? String(snap.data().fuelChargePercent)
            : ""
        );
      } else {
        setServiceChargeEnabled(false);
        setServiceChargePercent("");
        setFuelChargeEnabled(false);
        setFuelChargePercent("");
      }
    })();
  }, [selectedClientId]);

  // Load surcharge for selected client
  useEffect(() => {
    if (!selectedClient) {
      setSurchargeEnabled(false);
      setSurchargePercent("");
      return;
    }
    (async () => {
      const { getDoc, doc } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      const docRef = doc(db, "client_minimum_billing", selectedClient.id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setSurchargeEnabled(!!snap.data().surchargeEnabled);
        setSurchargePercent(
          snap.data().surchargePercent !== undefined
            ? String(snap.data().surchargePercent)
            : ""
        );
      } else {
        setSurchargeEnabled(false);
        setSurchargePercent("");
      }
    })();
  }, [selectedClientId]);

  // Handler for price input
  const handlePriceChange = (productId: string, value: string) => {
    setProductPrices((prev) => ({ ...prev, [productId]: Number(value) }));
  };

  // Save handler
  const handleSavePrices = async () => {
    if (!selectedClient) return;
    setSaveStatus("");
    try {
      const updates = Object.entries(productPrices)
        .filter(([productId, price]) =>
          selectedClient.selectedProducts.includes(productId)
        )
        .map(async ([productId, price]) => {
          // Save each price as a document: id = `${clientId}_${productId}`
          await setDoc(
            doc(
              collection(db, "client_product_prices"),
              `${selectedClient.id}_${productId}`
            ),
            {
              clientId: selectedClient.id,
              productId,
              price: Number(price),
              updatedAt: new Date().toISOString(),
            }
          );
        });
      // Save minimum billing value, charges, and surcharge
      await setDoc(
        doc(collection(db, "client_minimum_billing"), selectedClient.id),
        {
          clientId: selectedClient.id,
          minBilling: minBilling ? Number(minBilling) : 0,
          serviceChargeEnabled,
          serviceChargePercent: serviceChargePercent
            ? Number(serviceChargePercent)
            : 0,
          fuelChargeEnabled,
          fuelChargePercent: fuelChargePercent ? Number(fuelChargePercent) : 0,
          surchargeEnabled,
          surchargePercent: surchargePercent ? Number(surchargePercent) : 0,
          updatedAt: new Date().toISOString(),
        }
      );
      await Promise.all(updates);
      setSaveStatus("Prices saved successfully.");
    } catch (e) {
      setSaveStatus("Error saving prices.");
    }
  };

  // --- Invoice Editing Modal State ---
  const [showInvoiceDetailsModal, setShowInvoiceDetailsModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Handler to open invoice edit modal
  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceDetailsModal(true);
  };

  // Print modal state
  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null);

  // State for email sending
  const [emailStatus, setEmailStatus] = useState<string>("");
  const [emailTo, setEmailTo] = useState<string>("");

  // Get charge label based on type
  const getChargeLabel = () => {
    return serviceChargeEnabled ? "Service Charge" : "Fuel Charge";
  };

  async function sendInvoiceByEmail() {
    setEmailStatus("");
    if (!emailTo) {
      setEmailStatus("Please enter a recipient email.");
      return;
    }
    const element = document.getElementById("print-area");
    if (!element) {
      setEmailStatus("Invoice content not found.");
      return;
    }
    try {
      const pdfBlob = await html2pdf().from(element).outputPdf("blob");
      const pdfBase64 = await blobToBase64(pdfBlob);
      const res = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          subject: `Factura #${invoiceToPrint?.invoiceNumber}`,
          text: "Adjunto su factura.",
          pdfBase64: pdfBase64.split(",")[1], // remove data:...base64,
        }),
      });
      if (res.ok) {
        setEmailStatus("Email sent successfully.");
      } else {
        setEmailStatus("Failed to send email.");
      }
    } catch (err) {
      setEmailStatus("Error generating or sending PDF.");
    }
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Refresh invoices from Firestore
  const refreshInvoices = async () => {
    const all = await getInvoices();
    setInvoices(all.filter((inv: Invoice) => inv.status === "done"));
  };

  // Delete handler
  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!window.confirm("Are you sure you want to delete this invoice?")) return;
    try {
      const docRef = doc(db, "invoices", invoice.id);
      await setDoc(docRef, { status: "deleted" }, { merge: true });
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoice.id));
      setEmailStatus("Invoice deleted successfully.");
    } catch (e) {
      setEmailStatus("Error deleting invoice.");
    }
  };

  return (
    <div className="container py-4">
      {/* Client Dropdown Filter - moved to top */}
      <div className="mb-4" style={{ maxWidth: 350 }}>
        <label className="form-label">Select Client</label>
        <select
          className="form-select"
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
        >
          <option value="">All Clients</option>
          {clients
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
        </select>
      </div>
      <h2>Billing Section</h2>
      {/* Per-Product Price Table for Selected Client */}
      {selectedClient && (
        <div className="mb-4">
          <h5>Set Product Prices for {selectedClient.name}</h5>
          <div className="table-responsive" style={{ maxWidth: 600 }}>
            <table className="table table-bordered align-middle">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th style={{ width: 180 }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {allProducts
                  .filter((p) => selectedClient.selectedProducts.includes(p.id))
                  .map((product) => {
                    const priceValue = productPrices[product.id];
                    const isMissing = !priceValue || priceValue <= 0;
                    const name = product.name.toLowerCase();
                    return (
                      <tr key={product.id}>
                        <td style={nowrapCellStyle}>
                          {name.includes("scrub shirt") ||
                          name.includes("scrub top") ||
                          name.includes("scrub") ? (
                            <img
                              src={"/images/products/scrubshirt.png"}
                              alt="Scrub Shirt"
                              style={{
                                width: 28,
                                height: 28,
                                objectFit: "contain",
                                marginRight: 8,
                                verticalAlign: "middle",
                              }}
                            />
                          ) : null}
                          {product.name}
                        </td>
                        <td style={nowrapCellStyle}>
                          <input
                            type="number"
                            className={`form-control${
                              isMissing ? " is-invalid" : ""
                            }`}
                            min={0}
                            value={priceValue ?? ""}
                            onChange={(e) =>
                              handlePriceChange(product.id, e.target.value)
                            }
                            placeholder="Enter price"
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {/* Minimum Billing Value input */}
          <div className="mb-3" style={{ maxWidth: 300 }}>
            <label className="form-label">Minimum Billing Value</label>
            <input
              type="number"
              className="form-control"
              min={0}
              value={minBilling}
              onChange={(e) => setMinBilling(e.target.value)}
              placeholder="Enter minimum billing value"
            />
          </div>
          {/* Surcharge input */}
          <div className="mb-3" style={{ maxWidth: 500 }}>
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="surcharge"
                checked={surchargeEnabled}
                onChange={() => setSurchargeEnabled((v) => !v)}
              />
              <label className="form-check-label" htmlFor="surcharge">
                Surcharge
              </label>
              <input
                type="number"
                className="form-control d-inline-block ms-2"
                style={{ width: 100 }}
                min={0}
                max={100}
                value={surchargePercent}
                onChange={(e) => setSurchargePercent(e.target.value)}
                placeholder="%"
                disabled={!surchargeEnabled}
              />
              <span className="ms-2">%</span>
            </div>
          </div>
          {/* Service and Fuel Charge Options */}
          <div className="mb-3" style={{ maxWidth: 500 }}>
            <label className="form-label">Additional Charges</label>
            <div className="d-flex align-items-center gap-4 mb-2">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="serviceCharge"
                  checked={serviceChargeEnabled}
                  onChange={() => setServiceChargeEnabled((v) => !v)}
                />
                <label className="form-check-label" htmlFor="serviceCharge">
                  Service Charge
                </label>
                <input
                  type="number"
                  className="form-control d-inline-block ms-2"
                  style={{ width: 100 }}
                  min={0}
                  max={100}
                  value={serviceChargePercent}
                  onChange={(e) => setServiceChargePercent(e.target.value)}
                  placeholder="%"
                  disabled={!serviceChargeEnabled}
                />
                <span className="ms-2">%</span>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="fuelCharge"
                  checked={fuelChargeEnabled}
                  onChange={() => setFuelChargeEnabled((v) => !v)}
                />
                <label className="form-check-label" htmlFor="fuelCharge">
                  Fuel Charge
                </label>
                <input
                  type="number"
                  className="form-control d-inline-block ms-2"
                  style={{ width: 100 }}
                  min={0}
                  max={100}
                  value={fuelChargePercent}
                  onChange={(e) => setFuelChargePercent(e.target.value)}
                  placeholder="%"
                  disabled={!fuelChargeEnabled}
                />
                <span className="ms-2">%</span>
              </div>
            </div>
          </div>
          <button className="btn btn-success mt-2" onClick={handleSavePrices}>
            Save Prices
          </button>
          {saveStatus && (
            <div
              className={`alert ${
                saveStatus.includes("success")
                  ? "alert-success"
                  : "alert-danger"
              } mt-2`}
            >
              {saveStatus}
            </div>
          )}
        </div>
      )}
      {/* Completed Invoices Table */}
      {(() => {
        // Filter/group invoices by selected client
        const filteredInvoices = selectedClientId
          ? invoices.filter((inv) => inv.clientId === selectedClientId)
          : invoices;
        const grouped = filteredInvoices.reduce((acc, inv) => {
          if (!acc[inv.clientId]) acc[inv.clientId] = [];
          acc[inv.clientId].push(inv);
          return acc;
        }, {} as Record<string, Invoice[]>);
        if (Object.keys(grouped).length === 0) {
          return <div className="text-muted">No completed invoices found.</div>;
        }
        // Get product columns for selected client
        let productColumns: { id: string; name: string }[] = [];
        if (selectedClient) {
          productColumns = allProducts.filter((p) =>
            selectedClient.selectedProducts.includes(p.id)
          );
        } else {
          // If no client selected, show all products found in invoices
          const productIds = new Set<string>();
          filteredInvoices.forEach((inv) => {
            inv.carts?.forEach((cart) => {
              cart.items?.forEach((item) => productIds.add(item.productId));
            });
          });
          productColumns = allProducts.filter((p) => productIds.has(p.id));
        }
        return Object.entries(grouped).map(([clientId, clientInvoices]) => {
          const client = clients.find((c) => c.id === clientId);
          return (
            <div key={clientId} className="mb-5">
              <h5 style={{ fontWeight: 700, color: "#0ea5e9" }}>
                {client?.name || clientInvoices[0].clientName}
              </h5>
              <div
                className="table-responsive"
                style={{ overflowX: "auto", minWidth: 400 }}
              >
                <table
                  className="table table-bordered table-hover"
                  style={{ minWidth: 700 }}
                >
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Truck #</th>
                      {/* Add Verifier column */}
                      <th>Verifier</th>
                      {productColumns.map((prod) => (
                        <th key={prod.id}>{prod.name}</th>
                      ))}
                      <th>Subtotal</th>
                      <th>Service Charge</th>
                      <th>Fuel Charge</th>
                      <th>Surcharge</th>
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
                      .map((inv) => {
                        // Check if any product in this invoice has qty > 0 and no price set
                        const missingPrice = productColumns.some((prod) => {
                          const qty = (inv.carts || []).reduce((sum, cart) => {
                            return (
                              sum +
                              (cart.items || [])
                                .filter((item) => item.productId === prod.id)
                                .reduce(
                                  (s, item) => s + (Number(item.quantity) || 0),
                                  0
                                )
                            );
                          }, 0);
                          const price = productPrices[prod.id];
                          return qty > 0 && (!price || price <= 0);
                        });
                        let subtotal = 0;
                        const productCells = productColumns.map((prod) => {
                          const qty = (inv.carts || []).reduce((sum, cart) => {
                            return (
                              sum +
                              (cart.items || [])
                                .filter((item) => item.productId === prod.id)
                                .reduce(
                                  (s, item) => s + (Number(item.quantity) || 0),
                                  0
                                )
                            );
                          }, 0);
                          const price = productPrices[prod.id];
                          let cell = null;
                          if (qty > 0 && price > 0) {
                            const total = qty * price;
                            subtotal += total;
                            cell = `${qty} | `;
                            return (
                              <td key={prod.id} style={nowrapCellStyle}>
                                {qty} |{" "}
                                <span className="text-success">
                                  ${total.toFixed(2)}
                                </span>
                              </td>
                            );
                          } else if (qty > 0) {
                            return (
                              <td key={prod.id} style={nowrapCellStyle}>
                                {qty}
                              </td>
                            );
                          } else {
                            return <td key={prod.id}></td>;
                          }
                          return <td key={prod.id}>{cell}</td>;
                        });
                        // Use minimum billing value if subtotal is less
                        let minValue = minBilling ? Number(minBilling) : 0;
                        let displaySubtotal = subtotal;
                        if (minValue > 0 && subtotal < minValue) {
                          displaySubtotal = minValue;
                        }
                        // Calculate charges
                        let serviceCharge = 0;
                        let fuelCharge = 0;
                        let surchargeValue = 0;
                        if (
                          serviceChargeEnabled &&
                          serviceChargePercent &&
                          Number(serviceChargePercent) > 0
                        ) {
                          serviceCharge =
                            displaySubtotal *
                            (Number(serviceChargePercent) / 100);
                        }
                        if (
                          fuelChargeEnabled &&
                          fuelChargePercent &&
                          Number(fuelChargePercent) > 0
                        ) {
                          fuelCharge =
                            displaySubtotal * (Number(fuelChargePercent) / 100);
                        }
                        if (
                          surchargeEnabled &&
                          surchargePercent &&
                          Number(surchargePercent) > 0
                        ) {
                          surchargeValue =
                            displaySubtotal * (Number(surchargePercent) / 100);
                        }
                        return (
                          <tr
                            key={inv.id}
                            className={missingPrice ? "table-danger" : ""}
                          >
                            <td>{inv.invoiceNumber || inv.id}</td>
                            <td>
                              {inv.date
                                ? new Date(inv.date).toLocaleDateString()
                                : "-"}
                            </td>
                            <td>{inv.truckNumber || "-"}</td>
                            {/* Verifier cell */}
                            <td>{inv.verifiedBy || "-"}</td>
                            {productCells}
                            <td style={nowrapCellStyle}>
                              <b>
                                {displaySubtotal > 0
                                  ? `$${displaySubtotal.toFixed(2)}`
                                  : ""}
                              </b>
                            </td>
                            <td style={nowrapCellStyle}>
                              <b>
                                {serviceCharge > 0
                                  ? `$${serviceCharge.toFixed(2)}`
                                  : ""}
                              </b>
                            </td>
                            <td style={nowrapCellStyle}>
                              <b>
                                {fuelCharge > 0
                                  ? `$${fuelCharge.toFixed(2)}`
                                  : ""}
                              </b>
                            </td>
                            <td style={nowrapCellStyle}>
                              <b>
                                {surchargeValue > 0
                                  ? `$${surchargeValue.toFixed(2)}`
                                  : ""}
                              </b>
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => handleEditInvoice(inv)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-sm btn-outline-secondary ms-2"
                                onClick={() => setInvoiceToPrint(inv)}
                              >
                                Print
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger ms-2"
                                onClick={() => handleDeleteInvoice(inv)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        });
      })()}
      {/* Invoice Details Modal - for editing invoices */}
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
                // Delete only the entry at the given index for this product
                newItems = cart.items.filter(
                  (item, idx) =>
                    !(item.productId === productId && idx === itemIdx)
                );
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
      {/* Print Invoice Modal */}
      {invoiceToPrint && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog" style={{ maxWidth: 700 }}>
            <div className="modal-content">
              <div className="modal-header d-print-none">
                <h5 className="modal-title">
                  Imprimir Factura #{invoiceToPrint.invoiceNumber}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setInvoiceToPrint(null)}
                ></button>
              </div>
              <div className="modal-body" id="print-area">
                <div
                  style={{
                    width: "8.5in",
                    height: "5.5in",
                    margin: "0 auto",
                    background: "#fff",
                    border: "2px solid #222",
                    padding: 32,
                    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <img
                      src={"/images/King Uniforms Logo.png"}
                      alt="King Uniforms Logo"
                      style={{ width: 120, height: "auto", marginBottom: 8 }}
                    />
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{ fontWeight: 800, fontSize: 32, color: "#111" }}
                      >
                        Invoice #
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 22,
                          color: "#0E62A0",
                        }}
                      >
                        {invoiceToPrint.invoiceNumber}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, marginBottom: 18 }}>
                    <div
                      style={{ fontWeight: 800, fontSize: 36, color: "#111" }}
                    >
                      Servicios de Lavandería
                    </div>
                  </div>
                  <div style={{ fontSize: 22, marginBottom: 18 }}>
                    <span style={{ fontWeight: 700 }}>Nombre: </span>
                    <span style={{ color: "#0E62A0", fontWeight: 700 }}>
                      {invoiceToPrint.clientName}
                    </span>
                    <br />
                    <span style={{ fontWeight: 700 }}>Fecha: </span>
                    <span style={{ color: "#0E62A0", fontWeight: 700 }}>
                      {invoiceToPrint.date
                        ? new Date(invoiceToPrint.date).toLocaleDateString()
                        : "-"}
                    </span>
                    {/* Show verification status and verifier if present */}
                    {(invoiceToPrint.verified ||
                      invoiceToPrint.partiallyVerified) && (
                      <div style={{ marginTop: 8 }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: invoiceToPrint.verified
                              ? "#22c55e"
                              : "#fbbf24",
                          }}
                        >
                          {invoiceToPrint.verified
                            ? "Fully Verified"
                            : "Partially Verified"}
                        </span>
                        {invoiceToPrint.verifiedBy && (
                          <span
                            style={{
                              marginLeft: 12,
                              color: "#888",
                              fontWeight: 500,
                            }}
                          >
                            Verifier: {invoiceToPrint.verifiedBy}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <div style={{ maxHeight: "4.5in", overflowY: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          fontSize: 14,
                          fontWeight: 700,
                          borderCollapse: "collapse",
                          tableLayout: "fixed",
                          wordBreak: "break-word",
                        }}
                      >
                        <thead>
                          <tr>
                            <th
                              style={{
                                textAlign: "left",
                                paddingBottom: 4,
                                width: "70%",
                              }}
                            >
                              Producto
                            </th>
                            <th
                              style={{
                                textAlign: "right",
                                paddingBottom: 4,
                                width: "30%",
                              }}
                            >
                              Qty
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Group items by product name and sum quantities
                            const productMap: Record<string, number> = {};
                            invoiceToPrint.carts.forEach((cart) => {
                              cart.items.forEach((item) => {
                                if (!productMap[item.productName]) {
                                  productMap[item.productName] = 0;
                                }
                                productMap[item.productName] +=
                                  Number(item.quantity) || 0;
                              });
                            });
                            const productRows = Object.entries(productMap)
                              .sort((a, b) => a[0].localeCompare(b[0]))
                              .map(([name, qty], idx) => {
                                const lower = name.toLowerCase();
                                return (
                                  <tr key={name + idx}>
                                    <td
                                      style={{
                                        fontWeight: 700,
                                        color: "#111",
                                        padding: "1px 0",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "normal",
                                        maxWidth: 0,
                                        fontSize: 13,
                                      }}
                                    >
                                      {lower.includes("scrub shirt") ||
                                      lower.includes("scrub top") ||
                                      lower.includes("scrub") ? (
                                        <img
                                          src={
                                            "/images/products/scrubshirt.png"
                                          }
                                          alt="Scrub Shirt"
                                          style={{
                                            width: 20,
                                            height: 20,
                                            objectFit: "contain",
                                            marginRight: 6,
                                            verticalAlign: "middle",
                                          }}
                                        />
                                      ) : null}
                                      {name}
                                    </td>
                                    <td
                                      style={{
                                        fontWeight: 700,
                                        color: "#111",
                                        textAlign: "right",
                                        padding: "1px 0",
                                        fontSize: 13,
                                      }}
                                    >
                                      {Number(qty)}
                                    </td>
                                  </tr>
                                );
                              });
                            if (productRows.length === 0) {
                              return (
                                <tr>
                                  <td
                                    colSpan={2}
                                    style={{
                                      textAlign: "center",
                                      color: "#888",
                                      fontWeight: 400,
                                    }}
                                  >
                                    No hay productos
                                  </td>
                                </tr>
                              );
                            }
                            return productRows;
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer d-print-none">
                <button
                  className="btn btn-secondary"
                  onClick={() => setInvoiceToPrint(null)}
                >
                  Cerrar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const printContents =
                      document.getElementById("print-area")?.innerHTML;
                    if (printContents) {
                      const logoUrl =
                        window.location.origin +
                        "/images/King Uniforms Logo.png";
                      const patched = printContents.replace(
                        /<img[^>]+src=["'][^"']*King Uniforms Logo.png["'][^>]*>/,
                        `<img src='${logoUrl}' alt='King Uniforms Logo' style='width:120px;height:auto;margin-bottom:8px;' />`
                      );
                      // Open the print window first to avoid pop-up blockers
                      const printWindow = window.open(
                        "",
                        "",
                        "height=800,width=600"
                      );
                      if (!printWindow) return;
                      // Write after a short delay to ensure window is ready
                      setTimeout(() => {
                        printWindow.document.write(`
                        <html>
                          <head>
                            <title>Print Invoice</title>
                            <style>
                              @media print {
                                @page { size: 5.5in 8.5in portrait; margin: 0; }
                                body { margin: 0; }
                                .modal-footer, .d-print-none { display: none !important; }
                                table { font-size: 12px !important; }
                                td, th { word-break: break-word; white-space: normal !important; padding: 1px 0 !important; }
                                .product-table-scroll { max-height: 4.5in !important; overflow-y: auto !important; }
                              }
                              body { background: #fff; }
                              table { font-size: 13px; }
                              td, th { word-break: break-word; white-space: normal; padding: 1px 0; }
                            </style>
                          </head>
                          <body>${patched}</body>
                        </html>
                      `);
                        printWindow.document.close();
                        printWindow.focus();
                        printWindow.print();
                        printWindow.close();
                      }, 100);
                    }
                  }}
                >
                  Imprimir
                </button>
                <div
                  className="d-flex flex-column align-items-end"
                  style={{ flex: 1 }}
                >
                  <div className="input-group mb-1" style={{ maxWidth: 320 }}>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="Recipient email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                    />
                    <button
                      className="btn btn-outline-primary"
                      onClick={sendInvoiceByEmail}
                    >
                      Send PDF by Email
                    </button>
                  </div>
                  {emailStatus && (
                    <div
                      className="text-end"
                      style={{
                        color: emailStatus.includes("success")
                          ? "green"
                          : "red",
                        fontSize: 14,
                      }}
                    >
                      {emailStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;
