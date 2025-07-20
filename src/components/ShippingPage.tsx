import React, { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { Invoice } from "../types";
import "./ShippingPage.css";
import InvoiceDetailsPopup from "./InvoiceDetailsPopup";
import SignatureModal from "./SignatureModal";
import { useAuth } from "./AuthContext";

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
  shippingComplete?: boolean;
  shippingCompletedBy?: string;
  verified?: boolean;
  verifiedBy?: string;
}

const ShippingPage: React.FC = () => {
  const { user } = useAuth();
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
  const [truckCompletionStatus, setTruckCompletionStatus] = useState<{
    [truckNumber: string]: boolean;
  }>({});
  const [showCompletionModal, setShowCompletionModal] = useState<string | null>(null);

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

  // Function to handle marking truck as shipping complete
  const handleMarkTruckComplete = async (truckNumber: string) => {
    try {
      // Update completion status in local state
      setTruckCompletionStatus(prev => ({
        ...prev,
        [truckNumber]: true
      }));
      
      // Find all invoices for this truck and update them
      const truckData = shippingData.find(truck => truck.truckNumber === truckNumber);
      if (truckData) {
        const { updateDoc, doc } = await import("firebase/firestore");
        const { db } = await import("../firebase");
        
        // Get current user information
        const currentUser = user?.username || user?.id || "Unknown";
        
        // Update each invoice to mark shipping as complete
        const updatePromises = truckData.invoices.map(invoice => 
          updateDoc(doc(db, "invoices", invoice.id), {
            shippingComplete: true,
            shippingCompletedAt: new Date().toISOString(),
            shippingCompletedBy: currentUser
          })
        );
        
        await Promise.all(updatePromises);
        
        // Refresh the data to show updated status
        await fetchShippingData();
      }
    } catch (error) {
      console.error("Error marking truck as complete:", error);
      // Revert local state on error
      setTruckCompletionStatus(prev => ({
        ...prev,
        [truckNumber]: false
      }));
    }
  };

  // Function to handle approving an invoice
  const handleApproveInvoice = async (invoiceId: string) => {
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      
      // Update invoice as verified/approved
      await updateDoc(doc(db, "invoices", invoiceId), {
        verified: true,
        verifiedBy: "Shipping Personnel", // You might want to get actual user info
        verifiedAt: new Date().toISOString()
      });
      
      // Refresh the data to show updated status
      await fetchShippingData();
      
      // Show success feedback
      const invoiceData = shippingData
        .flatMap(truck => truck.invoices)
        .find(inv => inv.id === invoiceId);
      
      if (invoiceData) {
        console.log(`Invoice for ${invoiceData.clientName} has been approved`);
      }
    } catch (error) {
      console.error("Error approving invoice:", error);
      alert("Error approving invoice. Please try again.");
    }
  };

  // Function to fetch shipping data that can be called to refresh the data
  const fetchShippingData = useCallback(async () => {
    try {
      setLoading(true);

      // Query for all invoices with status "done" (shipped)
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

        // Include all trucks (removed 30-39 restriction)

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
          shippingComplete: !!invoiceData.shippingComplete,
          shippingCompletedBy: invoiceData.shippingCompletedBy,
          verified: !!invoiceData.verified,
          verifiedBy: invoiceData.verifiedBy,
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
      <h2 className="mb-4">Shipped Invoices</h2>

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
            <div className="col-md-8">
              <div className="row text-center">
                <div className="col-4">
                  <div className="bg-primary text-white rounded p-2">
                    <h5 className="mb-0">{filteredData.length}</h5>
                    <small>Active Trucks</small>
                  </div>
                </div>
                <div className="col-4">
                  <div className="bg-success text-white rounded p-2">
                    <h5 className="mb-0">
                      {filteredData.reduce((sum, truck) => sum + truck.invoices.length, 0)}
                    </h5>
                    <small>Shipped Invoices</small>
                  </div>
                </div>
                <div className="col-4">
                  <div className="bg-info text-white rounded p-2">
                    <h5 className="mb-0">
                      {filteredData.reduce((sum, truck) => sum + truck.invoices.reduce((cartSum, inv) => cartSum + inv.cartCount, 0), 0)}
                    </h5>
                    <small>Total Carts</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row">
            {filteredData.length === 0 ? (
              <div className="col-12 text-center py-5">
                <h5 className="text-muted">
                  No shipped invoices found
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
                const isComplete = truckCompletionStatus[truck.truckNumber] || 
                  truck.invoices.every(invoice => invoice.shippingComplete);
                const approvedCount = truck.invoices.filter(inv => inv.verified).length;
                const totalInvoices = truck.invoices.length;
                
                // Get the loaded by information from the first invoice (they should all have the same value)
                const loadedBy = truck.invoices.find(inv => inv.shippingCompletedBy)?.shippingCompletedBy;

                return (
                  <div
                    className="col-md-6 col-lg-4 mb-4"
                    key={truck.truckNumber}
                  >
                    <div className={`card shadow-sm truck-card ${isComplete ? 'border-success' : ''}`}>
                      <div className={`card-header truck-header ${isComplete ? 'bg-success text-white' : ''}`}>
                        <div className="d-flex justify-content-between align-items-center">
                          <h4 className="mb-0">Truck #{truck.truckNumber}</h4>
                          <div className="d-flex gap-2">
                            {isComplete && (
                              <span className="badge bg-light text-success">
                                <i className="bi bi-check-circle-fill"></i> Complete
                              </span>
                            )}
                            {isComplete && (
                              <span className="badge bg-primary">
                                {approvedCount}/{totalInvoices} Approved
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Show "Loaded by" information when truck is complete */}
                        {isComplete && loadedBy && (
                          <div className="mt-2">
                            <small className={`${isComplete ? 'text-light' : 'text-muted'}`}>
                              <i className="bi bi-person-check me-1"></i>
                              Loaded by: <strong>{loadedBy}</strong>
                            </small>
                          </div>
                        )}
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

                        {!isComplete && (
                          <div className="mb-3">
                            <button
                              className="btn btn-warning w-100"
                              onClick={() => setShowCompletionModal(truck.truckNumber)}
                            >
                              <i className="bi bi-truck"></i> Mark Shipping Complete
                            </button>
                          </div>
                        )}

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
                                        {invoice.verified && (
                                          <span
                                            className="ms-2 badge bg-primary"
                                            title={`Approved by ${invoice.verifiedBy}`}
                                          >
                                            <i className="bi bi-shield-check"></i>{" "}
                                            Approved
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
                                      
                                      {isComplete && !invoice.verified && (
                                        <button
                                          className="btn btn-sm btn-info"
                                          onClick={() => {
                                            handleApproveInvoice(invoice.id);
                                          }}
                                          title="Approve invoice"
                                        >
                                          <i className="bi bi-check-circle"></i>{" "}
                                          Approve
                                        </button>
                                      )}
                                      
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

      {/* Shipping Completion Confirmation Modal */}
      {showCompletionModal && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm Shipping Complete</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCompletionModal(null)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="text-center">
                  <i className="bi bi-truck display-1 text-warning mb-3"></i>
                  <h4>Mark Truck #{showCompletionModal} as Shipping Complete?</h4>
                  <p className="text-muted">
                    This will unlock the approval buttons for all invoices in this truck. 
                    You can then approve individual invoices after verifying they have been properly loaded.
                  </p>
                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    Once marked complete, you'll be able to approve each invoice individually.
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCompletionModal(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-warning"
                  onClick={async () => {
                    if (showCompletionModal) {
                      await handleMarkTruckComplete(showCompletionModal);
                      setShowCompletionModal(null);
                    }
                  }}
                >
                  <i className="bi bi-check-circle me-2"></i>
                  Mark Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShippingPage;
