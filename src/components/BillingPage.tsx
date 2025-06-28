import React, { useEffect, useState } from "react";
import { Invoice, Client } from "../types";
import { getInvoices, getClients } from "../services/firebaseService";
import { collection, setDoc, doc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

const BillingPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // State for per-client, per-product prices
  const [productPrices, setProductPrices] = useState<Record<string, number>>({});
  const [saveStatus, setSaveStatus] = useState<string>("");

  // Get selected client object
  const selectedClient = clients.find(c => c.id === selectedClientId);
  // Get products for selected client
  const [allProducts, setAllProducts] = useState<{id: string, name: string}[]>([]);
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
      const q = query(collection(db, "client_product_prices"), where("clientId", "==", selectedClient.id));
      const snap = await getDocs(q);
      const prices: Record<string, number> = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        prices[data.productId] = data.price;
      });
      setProductPrices(prices);
    })();
  }, [selectedClientId]);

  // Handler for price input
  const handlePriceChange = (productId: string, value: string) => {
    setProductPrices(prev => ({ ...prev, [productId]: Number(value) }));
  };

  // Save handler
  const handleSavePrices = async () => {
    if (!selectedClient) return;
    setSaveStatus("");
    try {
      const updates = Object.entries(productPrices)
        .filter(([productId, price]) => selectedClient.selectedProducts.includes(productId))
        .map(async ([productId, price]) => {
          // Save each price as a document: id = `${clientId}_${productId}`
          await setDoc(
            doc(collection(db, "client_product_prices"), `${selectedClient.id}_${productId}`),
            {
              clientId: selectedClient.id,
              productId,
              price: Number(price),
              updatedAt: new Date().toISOString(),
            }
          );
        });
      await Promise.all(updates);
      setSaveStatus("Prices saved successfully.");
    } catch (e) {
      setSaveStatus("Error saving prices.");
    }
  };

  return (
    <div className="container py-4">
      <h2>Billing Section</h2>
      {/* Per-Product Price Table for Selected Client */}
      {selectedClient && (
        <div className="mb-4">
          <h5>Set Product Prices for {selectedClient.name}</h5>
          <button className="btn btn-success mb-3" onClick={handleSavePrices}>
            Save Prices
          </button>
          {saveStatus && (
            <div className={`alert ${saveStatus.includes('success') ? 'alert-success' : 'alert-danger'} mt-2`}>
              {saveStatus}
            </div>
          )}
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
                  .filter(p => selectedClient.selectedProducts.includes(p.id))
                  .map(product => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          value={productPrices[product.id] ?? ""}
                          onChange={e => handlePriceChange(product.id, e.target.value)}
                          placeholder="Enter price"
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Client Dropdown Filter */}
      <div className="mb-4" style={{ maxWidth: 350 }}>
        <label className="form-label">Select Client</label>
        <select
          className="form-select"
          value={selectedClientId}
          onChange={e => setSelectedClientId(e.target.value)}
        >
          <option value="">All Clients</option>
          {clients
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(client => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
        </select>
      </div>
      {/* Completed Invoices Table */}
      {(() => {
        // Filter/group invoices by selected client
        const filteredInvoices = selectedClientId
          ? invoices.filter(inv => inv.clientId === selectedClientId)
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
        let productColumns: {id: string, name: string}[] = [];
        if (selectedClient) {
          productColumns = allProducts.filter(p => selectedClient.selectedProducts.includes(p.id));
        } else {
          // If no client selected, show all products found in invoices
          const productIds = new Set<string>();
          filteredInvoices.forEach(inv => {
            inv.carts?.forEach(cart => {
              cart.items?.forEach(item => productIds.add(item.productId));
            });
          });
          productColumns = allProducts.filter(p => productIds.has(p.id));
        }
        return Object.entries(grouped).map(([clientId, clientInvoices]) => {
          const client = clients.find(c => c.id === clientId);
          return (
            <div key={clientId} className="mb-5">
              <h5 style={{ fontWeight: 700, color: '#0ea5e9' }}>{client?.name || clientInvoices[0].clientName}</h5>
              <div className="table-responsive">
                <table className="table table-bordered table-hover">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th>Truck #</th>
                      {productColumns.map(prod => (
                        <th key={prod.id}>{prod.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientInvoices.sort((a, b) => {
                      if (a.invoiceNumber && b.invoiceNumber) return a.invoiceNumber - b.invoiceNumber;
                      if (a.date && b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
                      return a.id.localeCompare(b.id);
                    }).map(inv => (
                      <tr key={inv.id}>
                        <td>{inv.invoiceNumber || inv.id}</td>
                        <td>{inv.date ? new Date(inv.date).toLocaleDateString() : '-'}</td>
                        <td>{inv.truckNumber || '-'}</td>
                        {productColumns.map(prod => {
                          // Sum quantity of this product in all carts for this invoice
                          const qty = (inv.carts || []).reduce((sum, cart) => {
                            return sum + (cart.items || []).filter(item => item.productId === prod.id).reduce((s, item) => s + (Number(item.quantity) || 0), 0);
                          }, 0);
                          const price = productPrices[prod.id];
                          if (qty > 0 && price > 0) {
                            const total = qty * price;
                            return <td key={prod.id}>{`${qty} | ${total.toFixed(2)}`}</td>;
                          } else if (qty > 0) {
                            return <td key={prod.id}>{qty}</td>;
                          } else {
                            return <td key={prod.id}></td>;
                          }
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        });
      })()}
    </div>
  );
};

export default BillingPage;
