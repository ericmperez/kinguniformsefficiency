import React, { useState } from "react";
import { Client, Invoice } from "../types";

interface InvoiceFormProps {
  clients: Client[];
  onClose: () => void;
  onAddInvoice: (invoice: Omit<Invoice, "id">) => Promise<void>;
}

export default function InvoiceForm({
  clients,
  onClose,
  onAddInvoice,
}: InvoiceFormProps) {
  const [selectedClient, setSelectedClient] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    const client = clients.find((c) => c.id === selectedClient);
    if (!client) return;

    const newInvoice: Omit<Invoice, "id"> = {
      clientId: client.id,
      clientName: client.name,
      date: new Date().toISOString(),
      products: [],
      total: 0,
      carts: [], // Fix: add empty carts array
    };

    try {
      await onAddInvoice(newInvoice);
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
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Client</label>
                <div className="row g-3">
                  {clients.map((client) => (
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
                        onClick={() => setSelectedClient(client.id)}
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
                        {selectedClient === client.id && (
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
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create Invoice
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
