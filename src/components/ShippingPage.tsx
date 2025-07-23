import React, { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Invoice } from "../types";
import "./ShippingPage.css";
import InvoiceDetailsPopup from "./InvoiceDetailsPopup";
import SignatureModal from "./SignatureModal";
import { useAuth } from "./AuthContext";

interface ShippingTruckData {
  truckNumber: string;
  invoices: ShippingInvoice[];
  assignedDriver?: string;
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

interface Driver {
  id: string;
  name: string;
  linkedUserId?: string; // Link to user account
  linkedUsername?: string; // Cached username for display
}

interface TruckAssignment {
  truckNumber: string;
  driverId: string;
  driverName: string;
  assignedDate: string;
}

const ShippingPage: React.FC = () => {
  const { user } = useAuth(); // Get current authenticated user
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
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [truckAssignments, setTruckAssignments] = useState<{[key: string]: TruckAssignment}>({});
  const [savingAssignment, setSavingAssignment] = useState<string | null>(null);
  const [currentDriverId, setCurrentDriverId] = useState<string | null>(null);

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

  // Function to fetch drivers from Firebase
  const fetchDrivers = useCallback(async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "drivers"));
      const driversData: Driver[] = [];
      querySnapshot.forEach((doc) => {
        driversData.push({ id: doc.id, ...doc.data() } as Driver);
      });
      setDrivers(driversData);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  }, []);

  // Effect to find current driver's ID if user is a driver
  useEffect(() => {
    if (user && user.role === "Driver" && drivers.length > 0) {
      const linkedDriver = drivers.find(
        (driver: any) => driver.linkedUserId === user.id
      );
      if (linkedDriver) {
        setCurrentDriverId(linkedDriver.id);
      }
    }
  }, [user, drivers]);

  // Function to fetch truck assignments for the selected date
  const fetchTruckAssignments = useCallback(async () => {
    if (!selectedDate) return;
    
    try {
      const assignmentsQuery = query(
        collection(db, "truckAssignments"),
        where("assignedDate", "==", selectedDate)
      );
      const querySnapshot = await getDocs(assignmentsQuery);
      const assignments: {[key: string]: TruckAssignment} = {};
      
      querySnapshot.forEach((doc) => {
        const assignment = doc.data() as TruckAssignment;
        assignments[assignment.truckNumber] = assignment;
      });
      
      setTruckAssignments(assignments);
    } catch (error) {
      console.error("Error fetching truck assignments:", error);
    }
  }, [selectedDate]);

  // Function to assign driver to truck
  const assignDriverToTruck = async (truckNumber: string, driverId: string) => {
    if (!selectedDate || !driverId) return;
    
    setSavingAssignment(truckNumber);
    try {
      const driver = drivers.find(d => d.id === driverId);
      if (!driver) return;

      const assignment: TruckAssignment = {
        truckNumber,
        driverId,
        driverName: driver.name,
        assignedDate: selectedDate,
      };

      // Create a unique document ID based on truck number and date
      const docId = `${truckNumber}_${selectedDate}`;
      await setDoc(doc(db, "truckAssignments", docId), assignment);

      // Update local state
      setTruckAssignments(prev => ({
        ...prev,
        [truckNumber]: assignment
      }));

      console.log(`Assigned ${driver.name} to Truck ${truckNumber} for ${selectedDate}`);
    } catch (error) {
      console.error("Error assigning driver to truck:", error);
    } finally {
      setSavingAssignment(null);
    }
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

  // Fetch drivers on component mount
  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // Fetch truck assignments when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchTruckAssignments();
    }
  }, [selectedDate, fetchTruckAssignments]);

  // Filter data by selected date and driver assignments (for driver role)
  const filteredData = selectedDate
    ? shippingData
        .map((truck) => ({
          ...truck,
          invoices: truck.invoices.filter(
            (invoice) => invoice.deliveryDate === selectedDate
          ),
        }))
        .filter((truck) => {
          // If user is a driver, only show trucks assigned to them
          if (user && user.role === "Driver" && currentDriverId) {
            const assignment = truckAssignments[truck.truckNumber];
            return truck.invoices.length > 0 && assignment && assignment.driverId === currentDriverId;
          }
          // For non-drivers, show all trucks with invoices
          return truck.invoices.length > 0;
        })
    : user && user.role === "Driver" && currentDriverId
      ? shippingData.filter((truck) => {
          const assignment = truckAssignments[truck.truckNumber];
          return assignment && assignment.driverId === currentDriverId;
        })
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
                {user && user.role === "Driver" ? (
                  <div>
                    <h5 className="text-muted">
                      No trucks assigned to you
                    </h5>
                    <p>
                      Please contact your supervisor to assign you to a truck for{" "}
                      {selectedDate ? new Date(selectedDate).toLocaleDateString("en-US") : "your deliveries"}
                    </p>
                  </div>
                ) : (
                  <div>
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
                        <div className="d-flex justify-content-between align-items-center">
                          <h4 className="mb-0">Truck #{truck.truckNumber}</h4>
                          {truckAssignments[truck.truckNumber] && (
                            <span className="badge bg-success">
                              <i className="bi bi-person-check"></i> {truckAssignments[truck.truckNumber].driverName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="card-body">
                        {/* Driver Assignment Section - Only show for non-driver users */}
                        {(!user || user.role !== "Driver") && (
                          <div className="mb-3">
                            <label className="form-label fw-bold">
                              <i className="bi bi-person"></i> Assign Driver
                            </label>
                            {drivers.filter((driver: any) => driver.linkedUserId).length === 0 ? (
                              <div className="alert alert-warning py-2">
                                <small>
                                  <strong>No linked drivers available.</strong><br />
                                  Link drivers to user accounts in Settings → Drivers to enable assignments.
                                </small>
                              </div>
                            ) : (
                              <div className="d-flex gap-2">
                                <select
                                  className="form-select form-select-sm"
                                  value={truckAssignments[truck.truckNumber]?.driverId || ""}
                                  onChange={(e) => assignDriverToTruck(truck.truckNumber, e.target.value)}
                                  disabled={savingAssignment === truck.truckNumber}
                                >
                                  <option value="">Select Driver...</option>
                                  {drivers
                                    .filter((driver: any) => driver.linkedUserId) // Only show drivers linked to user accounts
                                    .map((driver) => (
                                      <option key={driver.id} value={driver.id}>
                                        {driver.name} (ID: {driver.linkedUserId})
                                      </option>
                                    ))}
                                </select>
                                {savingAssignment === truck.truckNumber && (
                                  <div className="spinner-border spinner-border-sm text-primary" role="status">
                                    <span className="visually-hidden">Saving...</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

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
