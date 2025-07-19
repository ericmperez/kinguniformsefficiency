import React, { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Invoice } from "../types";
import "./ShippingPage.css";
import InvoiceDetailsPopup from "./InvoiceDetailsPopup";
import SignatureModal from "./SignatureModal";

interface ShippingTruckData {
  truckNumber: string;
  invoices: ShippingInvoice[];
}

interface ShippingInvoice {
  id: string;
  invoiceNumber?: string;
  clientName: string;
  clientId: string;
  deliveryDate: string;
  cartCount: number;
  truckNumber: string;
  receivedBy?: string;
  hasSignature?: boolean;
}

const ShippingPage: React.FC = () => {
  const [shippingData, setShippingData] = useState<ShippingTruckData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  );
  const [signatureInvoice, setSignatureInvoice] = useState<{
    id: string;
    number?: string;
    clientName: string;
  } | null>(null);

  // Function to handle clicking on an invoice
  const handleInvoiceClick = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
  };

  // Function to handle capturing a signature
  const handleSignatureCapture = (invoice: ShippingInvoice) => {
    setSignatureInvoice({
      id: invoice.id,
      number: invoice.invoiceNumber,
      clientName: invoice.clientName,
    });
  };

  // Function to fetch shipping data that can be called to refresh the data
  const fetchShippingData = useCallback(async () => {
    try {
      setLoading(true);

      // Query for all invoices with status "done"
      const q = query(
        collection(db, "invoices"),
        where("status", "==", "done")
      );

      const querySnapshot = await getDocs(q);
      const invoices: ShippingInvoice[] = [];
      const dates = new Set<string>();

      // Process the invoices
      querySnapshot.forEach((doc) => {
        const invoiceData = doc.data() as Invoice;

        // Skip if missing required fields
        if (!invoiceData.truckNumber || !invoiceData.deliveryDate) return;

        // Convert truckNumber to string if it's a number
        const truckNumberStr =
          typeof invoiceData.truckNumber === "number"
            ? String(invoiceData.truckNumber)
            : String(invoiceData.truckNumber);

        // Only include trucks 30-39
        const truckNum = parseInt(truckNumberStr);
        if (isNaN(truckNum) || truckNum < 30 || truckNum > 39) return;

        // Add delivery date to available dates
        dates.add(invoiceData.deliveryDate);

        // Calculate cart count
        const cartCount = invoiceData.carts?.length || 0;

        invoices.push({
          id: doc.id,
          invoiceNumber: invoiceData.invoiceNumber?.toString(),
          clientName: invoiceData.clientName,
          clientId: invoiceData.clientId,
          deliveryDate: invoiceData.deliveryDate,
          cartCount,
          truckNumber: truckNumberStr,
          receivedBy: invoiceData.receivedBy,
          hasSignature: !!invoiceData.signature,
        });
      });

      // Sort dates chronologically and set the most recent as default
      const sortedDates = Array.from(dates).sort();
      setAvailableDates(sortedDates);
      if (sortedDates.length > 0 && !selectedDate) {
        setSelectedDate(sortedDates[sortedDates.length - 1]);
      }

      // Group by truck number
      const truckMap: { [key: string]: ShippingInvoice[] } = {};

      for (const invoice of invoices) {
        if (!truckMap[invoice.truckNumber]) {
          truckMap[invoice.truckNumber] = [];
        }
        truckMap[invoice.truckNumber].push(invoice);
      }

      // Convert to array and sort by truck number
      const trucksArray: ShippingTruckData[] = Object.keys(truckMap).map(
        (truckNumber) => ({
          truckNumber,
          invoices: truckMap[truckNumber],
        })
      );

      trucksArray.sort(
        (a, b) => parseInt(a.truckNumber) - parseInt(b.truckNumber)
      );
      setShippingData(trucksArray);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching shipping data:", error);
      setLoading(false);
    }
  }, [selectedDate]);

  // Fetch shipping data for trucks 30-39
  useEffect(() => {
    fetchShippingData();
  }, [fetchShippingData]);

  // Filter data by selected date
  const filteredData = selectedDate
    ? shippingData
        .map((truck) => ({
          ...truck,
          invoices: truck.invoices.filter(
            (invoice) => invoice.deliveryDate === selectedDate
          ),
        }))
        .filter((truck) => truck.invoices.length > 0)
    : shippingData;

  // Calculate totals for each truck
  const calculateTruckTotals = (truck: ShippingTruckData) => {
    const totalCarts = truck.invoices.reduce(
      (sum, inv) => sum + inv.cartCount,
      0
    );
    const clientCount = new Set(truck.invoices.map((inv) => inv.clientId)).size;

    return { totalCarts, clientCount };
  };

  return (
    <div className="container shipping-dashboard">
      <h2 className="mb-4">Shipping Dashboard</h2>

      {loading ? (
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <div>
          <div className="row mb-4">
            <div className="col-md-4">
              <label className="form-label">Filter by Delivery Date</label>
              <select
                className="form-select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                <option value="">All Dates</option>
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {new Date(date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="row">
            {filteredData.length === 0 ? (
              <div className="col-12 text-center py-5">
                <h5 className="text-muted">
                  No shipping data found for trucks 30-39
                </h5>
                {selectedDate && (
                  <p>
                    No deliveries scheduled for{" "}
                    {new Date(selectedDate).toLocaleDateString("en-US")}
                  </p>
                )}
              </div>
            ) : (
              filteredData.map((truck) => {
                const { totalCarts, clientCount } = calculateTruckTotals(truck);

                return (
                  <div
                    className="col-md-6 col-lg-4 mb-4"
                    key={truck.truckNumber}
                  >
                    <div className="card shadow-sm truck-card">
                      <div className="card-header truck-header">
                        <h4 className="mb-0">Truck #{truck.truckNumber}</h4>
                      </div>
                      <div className="card-body">
                        <div className="truck-stats">
                          <div className="stat-item">
                            <h5 className="stat-value">{clientCount}</h5>
                            <small className="stat-label">Clients</small>
                          </div>
                          <div className="stat-item">
                            <h5 className="stat-value">{totalCarts}</h5>
                            <small className="stat-label">Carts</small>
                          </div>
                        </div>

                        <h6 className="border-bottom pb-2 mb-3">
                          Client Details
                        </h6>
                        <div className="scrollable-table">
                          <table className="table table-sm table-hover">
                            <thead>
                              <tr>
                                <th style={{ width: "50%" }}>Client</th>
                                <th className="text-center">Carts</th>
                                <th
                                  className="text-center"
                                  style={{ width: "30%" }}
                                >
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {truck.invoices.map((invoice) => (
                                <tr key={invoice.id} className="client-row">
                                  <td
                                    onClick={() =>
                                      handleInvoiceClick(invoice.id)
                                    }
                                    style={{ cursor: "pointer" }}
                                  >
                                    <div className="d-flex flex-column">
                                      <div className="d-flex align-items-center">
                                        <span className="fw-bold">
                                          {invoice.clientName}
                                        </span>
                                        {invoice.hasSignature && (
                                          <span
                                            className="ms-2 badge bg-success"
                                            title={`Received by ${invoice.receivedBy}`}
                                          >
                                            <i className="bi bi-check-circle-fill"></i>{" "}
                                            Signed
                                          </span>
                                        )}
                                      </div>
                                      <small className="text-muted">
                                        Invoice #
                                        {invoice.invoiceNumber ||
                                          invoice.id.substring(0, 8)}
                                      </small>
                                    </div>
                                  </td>
                                  <td className="text-center align-middle">
                                    <span className="badge rounded-pill bg-info">
                                      {invoice.cartCount}{" "}
                                      {invoice.cartCount === 1
                                        ? "cart"
                                        : "carts"}
                                    </span>
                                  </td>
                                  <td className="text-center align-middle">
                                    <div className="d-grid gap-2">
                                      <button
                                        className="btn btn-sm btn-primary"
                                        onClick={() =>
                                          handleInvoiceClick(invoice.id)
                                        }
                                        title="View invoice details"
                                      >
                                        <i className="bi bi-file-text"></i>{" "}
                                        Details
                                      </button>
                                      <button
                                        className={`btn btn-sm ${
                                          invoice.hasSignature
                                            ? "btn-success"
                                            : "btn-outline-success"
                                        }`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSignatureCapture(invoice);
                                        }}
                                        title={
                                          invoice.hasSignature
                                            ? "Update signature"
                                            : "Capture signature"
                                        }
                                      >
                                        <i
                                          className={`bi ${
                                            invoice.hasSignature
                                              ? "bi-pencil-square"
                                              : "bi-pen"
                                          }`}
                                        ></i>
                                        {invoice.hasSignature
                                          ? "Update Signature"
                                          : "Capture Signature"}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="card-footer bg-light">
                        <small className="text-muted">
                          Delivery Date:{" "}
                          {selectedDate &&
                            new Date(selectedDate).toLocaleDateString("en-US")}
                        </small>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Invoice Details Popup */}
      {selectedInvoiceId && (
        <InvoiceDetailsPopup
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onRefresh={fetchShippingData}
        />
      )}

      {/* Signature Modal */}
      {signatureInvoice && (
        <SignatureModal
          show={!!signatureInvoice}
          onClose={() => setSignatureInvoice(null)}
          invoiceId={signatureInvoice.id}
          invoiceNumber={signatureInvoice.number}
          clientName={signatureInvoice.clientName}
          onSignatureSaved={fetchShippingData}
        />
      )}
    </div>
  );
};

export default ShippingPage;
