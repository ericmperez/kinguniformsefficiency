import React, { useState } from "react";
import { Client, Invoice, Product } from "../types";

interface InvoiceFormProps {
  clients: Client[];
  products: Product[];
  onClose: () => void;
  onAddInvoice: (invoice: Omit<Invoice, "id">) => Promise<string>;
}

export default function InvoiceForm({
  clients,
  products,
  onClose,
  onAddInvoice,
}: InvoiceFormProps) {
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Sort clients alphabetically by name
  const sortedClients = [...clients].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const handleClientClick = (clientId: string) => {
    setSelectedClient(clientId);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    if (!selectedClient) return;
    const client = clients.find((c) => c.id === selectedClient);
    if (!client) return;
    const newInvoice: Omit<Invoice, "id"> = {
      clientId: client.id,
      clientName: client.name,
      date: new Date().toISOString(),
      products: [],
      total: 0,
      carts: [],
    };
    try {
      await onAddInvoice(newInvoice); // The parent will handle adding and return the ID
      onClose();
    } catch (error) {
      console.error("Error adding invoice:", error);
      alert("Error adding invoice. Please try again.");
    }
  };

  return (
    <div className="modal show d-block" tabIndex={-1}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">New Invoice</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Client</label>
                <div className="row g-3">
                  {sortedClients.map((client) => (
                    <div key={client.id} className="col-6 col-md-4">
                      <div
                        className={`card h-100 shadow-sm position-relative client-card-select ${
                          selectedClient === client.id
                            ? "border-primary"
                            : "border-light"
                        }`}
                        style={{
                          cursor: "pointer",
                          minHeight: 100,
                          borderWidth: 2,
                        }}
                        onClick={() => handleClientClick(client.id)}
                      >
                        <div className="card-body d-flex flex-column align-items-center justify-content-center p-2">
                          {client.imageUrl ? (
                            <img
                              src={client.imageUrl}
                              alt={client.name}
                              className="mb-2 rounded"
                              style={{
                                width: 48,
                                height: 48,
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            <div
                              className="mb-2 rounded bg-secondary d-flex align-items-center justify-content-center"
                              style={{
                                width: 48,
                                height: 48,
                                color: "#fff",
                                fontWeight: 600,
                              }}
                            >
                              Logo
                            </div>
                          )}
                          <span
                            className="fw-semibold text-center"
                            style={{ fontSize: 15 }}
                          >
                            {client.name}
                          </span>
                        </div>
                        {selectedClient === client.id && showConfirm && (
                          <span
                            className="position-absolute top-0 end-0 m-2 badge bg-primary"
                            style={{ zIndex: 2 }}
                          >
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
      {showConfirm && selectedClient && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          style={{ background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm Client</h5>
              </div>
              <div className="modal-body">
                <p>
                  Are you sure you want to create an invoice for{" "}
                  <b>{clients.find((c) => c.id === selectedClient)?.name}</b>?
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleConfirm}>
                  Yes, Create Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
