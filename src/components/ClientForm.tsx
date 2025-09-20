import React, { useState } from "react";
// Use canonical types from src/types.ts
import type { Client, Product } from "../types";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { logActivity } from "../services/firebaseService";

interface ClientFormProps {
  clients: Client[];
  products: Product[];
  onAddClient: (client: Omit<Client, "id">) => Promise<void>;
  onUpdateClient: (clientId: string, client: Partial<Client>) => Promise<void>;
  onDeleteClient: (clientId: string) => Promise<void>;
}

export const ClientForm: React.FC<ClientFormProps> = ({
  clients,
  products,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
}) => {
  const [newClientName, setNewClientName] = useState("");
  const [newClientImage, setNewClientImage] = useState<File | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isRented, setIsRented] = useState(false);
  const [washingType, setWashingType] = useState<"Tunnel" | "Conventional">(
    "Tunnel"
  );
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [segregation, setSegregation] = useState(false);
  const [billingCalculation, setBillingCalculation] = useState<
    "byWeight" | "byItem"
  >("byWeight");
  const [needsInvoice, setNeedsInvoice] = useState<boolean>(
    washingType === "Tunnel"
  );
  const [completedOptionPosition, setCompletedOptionPosition] = useState<
    "top" | "bottom" | "both" | "uniformes"
  >("both");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    const clientData: any = {
      name: newClientName,
      selectedProducts,
      isRented,
      washingType,
      segregation,
      billingCalculation,
      needsInvoice,
      completedOptionPosition,
    };
    // Only include image if a new image is selected
    if (newClientImage) {
      clientData.image = newClientImage;
    }
    if (editingClient) {
      await onUpdateClient(editingClient.id, clientData);
      await logActivity({
        type: "Client",
        message: `Client '${editingClient.name}' updated`,
      });
      setEditingClient(null);
    } else {
      clientData.image = newClientImage;
      await onAddClient(clientData);
      await logActivity({
        type: "Client",
        message: `Client '${newClientName}' added`,
      });
    }
    setNewClientName("");
    setNewClientImage(null); // Always reset after submit
    setSelectedProducts([]);
    setIsRented(false);
    setWashingType("Tunnel");
    setSegregation(false);
    setBillingCalculation("byWeight");
    setNeedsInvoice(false);
    setCompletedOptionPosition("both");
  };

  // Patch: always provide image as File|null (never undefined) for AppClient
  type CanonicalClient = import("../types").Client;

  const handleEdit = (client: CanonicalClient) => {
    setEditingClient({
      ...client,
      image: null, // Always start with no new image selected
    });
    setNewClientName(client.name);
    setSelectedProducts(client.selectedProducts);
    setIsRented(client.isRented);
    setWashingType(client.washingType || "Tunnel");
    setSegregation(client.segregation ?? false);
    setNewClientImage(null); // Always reset when opening edit modal
    setBillingCalculation(client.billingCalculation || "byWeight");
    setNeedsInvoice(client.needsInvoice ?? client.washingType === "Tunnel");
    setCompletedOptionPosition(client.completedOptionPosition || "both");
  };

  const handleCancel = () => {
    setEditingClient(null);
    setNewClientName("");
    setNewClientImage(null);
    setSelectedProducts([]);
    setIsRented(false);
    setWashingType("Tunnel");
    setSegregation(false);
    setBillingCalculation("byWeight");
    setNeedsInvoice(false);
    setCompletedOptionPosition("both");
  };

  const handleProductToggle = async (productId: string) => {
    setSelectedProducts((prev) => {
      const updated = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      if (editingClient) {
        setIsSaving(true);
        setSaveError(null);
        onUpdateClient(editingClient.id, { selectedProducts: updated })
          .catch((err) => setSaveError("Failed to save changes."))
          .finally(() => setIsSaving(false));
      }
      return updated;
    });
  };

  const handleIsRentedToggle = async (checked: boolean) => {
    setIsRented(checked);
    if (editingClient) {
      setIsSaving(true);
      setSaveError(null);
      try {
        await onUpdateClient(editingClient.id, { isRented: checked });
      } catch {
        setSaveError("Failed to save changes.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Update needsInvoice default when washingType changes
  React.useEffect(() => {
    setNeedsInvoice(washingType === "Tunnel");
  }, [washingType]);

  return (
    <div className="card">
      <div className="card-header">
        <h3>Add New Client</h3>
      </div>
      <div className="card-body">
        {/* Add New Client Form */}
        {!editingClient && (
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="clientName" className="form-label">
                Client Name
              </label>
              <input
                type="text"
                className="form-control"
                id="clientName"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="clientImage" className="form-label">
                Client Image
              </label>
              <input
                type="file"
                className="form-control"
                id="clientImage"
                accept="image/*"
                onChange={(e) => setNewClientImage(e.target.files?.[0] || null)}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Selected Products</label>
              <div
                style={{
                  background: "#e0f2fe",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  justifyContent: "space-between",
                }}
              >
                <button
                  type="button"
                  className="btn btn-sm btn-primary fw-bold"
                  onClick={async () => {
                    let newSelection: string[];
                    if (selectedProducts.length === products.length) {
                      newSelection = [];
                    } else {
                      newSelection = products.map((p) => p.id);
                    }
                    setSelectedProducts(newSelection);
                    if (editingClient) {
                      const client: Client = editingClient;
                      setIsSaving(true);
                      setSaveError(null);
                      try {
                        await onUpdateClient(client.id, {
                          selectedProducts: newSelection,
                        });
                      } catch {
                        setSaveError("Failed to save changes.");
                      } finally {
                        setIsSaving(false);
                      }
                    }
                  }}
                  disabled={isSaving}
                  style={{ minWidth: 140 }}
                >
                  {selectedProducts.length === products.length
                    ? "Deselect All"
                    : "Select All Products"}
                </button>
                <span
                  style={{
                    color: "#0ea5e9",
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  {selectedProducts.length} / {products.length} selected
                </span>
              </div>
              <div className="row g-3 client-product-grid">
                {[...products]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((product) => (
                    <div key={product.id} className="col-6 col-md-4 col-lg-3">
                      <label
                        className={`card h-100 shadow-sm position-relative product-checkbox-card client-product-card ${
                          selectedProducts.includes(product.id)
                            ? "border-primary"
                            : "border-light"
                        }`}
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input position-absolute top-0 end-0 m-2"
                          style={{ zIndex: 2, width: 22, height: 22 }}
                          id={`product-${product.id}`}
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => handleProductToggle(product.id)}
                          disabled={isSaving}
                        />
                        <div className="card-body d-flex flex-column align-items-center justify-content-center p-2">
                          {product.imageUrl && (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="mb-2 rounded"
                              style={{ width: 48, height: 48, objectFit: "cover" }}
                            />
                          )}
                          <span className="client-product-name" style={{ display: "block", width: "100%" }}>
                            {product.name}
                          </span>
                        </div>
                      </label>
                    </div>
                  ))}
              </div>
            </div>

            <div className="mb-3">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="isRented"
                  checked={isRented}
                  onChange={(e) => handleIsRentedToggle(e.target.checked)}
                  disabled={isSaving}
                />
                <label className="form-check-label" htmlFor="isRented">
                  Is Rented
                </label>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Washing Type</label>
              <div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="washingType"
                    id="washingTypeTunnel"
                    value="Tunnel"
                    checked={washingType === "Tunnel"}
                    onChange={() => setWashingType("Tunnel")}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="washingTypeTunnel"
                  >
                    Tunnel
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="washingType"
                    id="washingTypeConventional"
                    value="Conventional"
                    checked={washingType === "Conventional"}
                    onChange={() => setWashingType("Conventional")}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="washingTypeConventional"
                  >
                    Conventional
                  </label>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Segregation</label>
              <div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="segregation"
                    id="segregationYes"
                    value="yes"
                    checked={segregation === true}
                    onChange={() => setSegregation(true)}
                  />
                  <label className="form-check-label" htmlFor="segregationYes">
                    Yes
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="segregation"
                    id="segregationNo"
                    value="no"
                    checked={segregation === false}
                    onChange={() => setSegregation(false)}
                  />
                  <label className="form-check-label" htmlFor="segregationNo">
                    No
                  </label>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Billing Calculation</label>
              <div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="billingCalculation"
                    id="billingByWeight"
                    value="byWeight"
                    checked={billingCalculation === "byWeight"}
                    onChange={() => setBillingCalculation("byWeight")}
                  />
                  <label className="form-check-label" htmlFor="billingByWeight">
                    By Weight
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="billingCalculation"
                    id="billingByItem"
                    value="byItem"
                    checked={billingCalculation === "byItem"}
                    onChange={() => setBillingCalculation("byItem")}
                  />
                  <label className="form-check-label" htmlFor="billingByItem">
                    Per Item
                  </label>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Requires Invoice?</label>
              <div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="needsInvoice"
                    id="needsInvoiceYes"
                    value="yes"
                    checked={needsInvoice === true}
                    onChange={() => setNeedsInvoice(true)}
                  />
                  <label className="form-check-label" htmlFor="needsInvoiceYes">
                    Yes
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="needsInvoice"
                    id="needsInvoiceNo"
                    value="no"
                    checked={needsInvoice === false}
                    onChange={() => setNeedsInvoice(false)}
                  />
                  <label className="form-check-label" htmlFor="needsInvoiceNo">
                    No
                  </label>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Completed Option Position</label>
              <div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="completedOptionPosition"
                    id="completedPositionTop"
                    value="top"
                    checked={completedOptionPosition === "top"}
                    onChange={() => setCompletedOptionPosition("top")}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="completedPositionTop"
                  >
                    Mangle
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="completedOptionPosition"
                    id="completedPositionBottom"
                    value="bottom"
                    checked={completedOptionPosition === "bottom"}
                    onChange={() => setCompletedOptionPosition("bottom")}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="completedPositionBottom"
                  >
                    Doblado
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="completedOptionPosition"
                    id="completedPositionBoth"
                    value="both"
                    checked={completedOptionPosition === "both"}
                    onChange={() => setCompletedOptionPosition("both")}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="completedPositionBoth"
                  >
                    Both (Mangle and Doblado)
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="completedOptionPosition"
                    id="completedPositionUniforms"
                    value="uniformes"
                    checked={completedOptionPosition === "uniformes"}
                    onChange={() => setCompletedOptionPosition("uniformes")}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="completedPositionUniforms"
                  >
                    Uniformes
                  </label>
                </div>
              </div>
              <div className="form-text text-muted">
                Choose where the completed option appears in the active invoice
                page for this client.
              </div>
            </div>

            <div className="d-flex gap-2">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
              >
                Add Client
              </button>
            </div>
          </form>
        )}
        {saveError && (
          <div className="alert alert-danger mt-2">{saveError}</div>
        )}
        {isSaving && <div className="text-info mt-2">Saving...</div>}
        <div className="mt-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4>Client List</h4>
          </div>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Image</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th>Washing Type</th>
                  <th>Segregation</th>
                  <th>Billing Calculation</th>
                  <th>Requires Invoice?</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((client) => (
                    <tr key={client.id}>
                      <td>
                        <div
                          className="d-flex align-items-center gap-2"
                          title="Client name"
                        >
                          <strong className="text-primary">
                            {client.name}
                          </strong>
                        </div>
                      </td>
                      <td style={{ width: "60px" }}>
                        {client.imageUrl && (
                          <img
                            src={client.imageUrl}
                            alt={client.name}
                            className="rounded"
                            style={{
                              width: "40px",
                              height: "40px",
                              objectFit: "cover",
                            }}
                          />
                        )}
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {client.selectedProducts &&
                            client.selectedProducts.map((productId) => {
                              const product = products.find(
                                (p) => p.id === productId
                              );
                              return product ? (
                                <span
                                  key={productId}
                                  className="badge bg-secondary"
                                >
                                  {product.name}
                                </span>
                              ) : null;
                            })}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            client.isRented ? "bg-success" : "bg-danger"
                          }`}
                        >
                          {client.isRented ? "Rented" : "Not Rented"}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge bg-info"
                          style={{ cursor: "pointer" }}
                          title="Click to toggle washing type"
                          onClick={async () => {
                            const newType =
                              client.washingType === "Tunnel"
                                ? "Conventional"
                                : "Tunnel";
                            setIsSaving(true);
                            setSaveError(null);
                            try {
                              await onUpdateClient(client.id, {
                                washingType: newType,
                              });
                            } catch {
                              setSaveError("Failed to update washing type.");
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                        >
                          {client.washingType || "Tunnel"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            client.segregation ? "bg-success" : "bg-secondary"
                          }`}
                          style={{ cursor: "pointer" }}
                          title="Click to toggle segregation"
                          onClick={async () => {
                            const newSeg = !client.segregation;
                            setIsSaving(true);
                            setSaveError(null);
                            try {
                              await onUpdateClient(client.id, {
                                segregation: newSeg,
                              });
                            } catch {
                              setSaveError("Failed to update segregation.");
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                        >
                          {client.segregation ? "Yes" : "No"}
                        </span>
                      </td>
                      <td>
                        {client.billingCalculation === "byItem"
                          ? "Per Item"
                          : "By Weight"}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            client.needsInvoice ? "bg-success" : "bg-secondary"
                          }`}
                          style={{ cursor: "pointer" }}
                          title="Click to toggle invoice requirement"
                          onClick={async () => {
                            const newNeedsInvoice = !client.needsInvoice;
                            setIsSaving(true);
                            setSaveError(null);
                            try {
                              await onUpdateClient(client.id, {
                                needsInvoice: newNeedsInvoice,
                              });
                            } catch {
                              setSaveError(
                                "Failed to update invoice requirement."
                              );
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                        >
                          {client.needsInvoice ? "Yes" : "No"}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex gap-1 flex-wrap">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleEdit(client)}
                            title="Edit client details"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setClientToDelete(client)}
                            title="Delete client"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Edit Client Modal */}
      {editingClient && (
        <div
          className="modal show"
          style={{
            display: "block",
            background: "rgba(0,0,0,0.3)",
            position: "absolute",
            left: 0,
            right: 0,
            zIndex: 1050,
            minHeight: "100vh",
          }}
        >
          <div
            className="modal-dialog"
            style={{ maxWidth: 600, width: "100%", margin: "2rem auto" }}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Client</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCancel}
                ></button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="clientNameEdit" className="form-label">
                      Client Name
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="clientNameEdit"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="clientImageEdit" className="form-label">
                      Client Image
                    </label>
                    <input
                      type="file"
                      className="form-control"
                      id="clientImageEdit"
                      accept="image/*"
                      onChange={(e) =>
                        setNewClientImage(e.target.files?.[0] || null)
                      }
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Selected Products</label>
                    <div
                      style={{
                        background: "#e0f2fe",
                        borderRadius: 8,
                        padding: "8px 12px",
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        justifyContent: "space-between",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-sm btn-primary fw-bold"
                        onClick={async () => {
                          let newSelection: string[];
                          if (selectedProducts.length === products.length) {
                            newSelection = [];
                          } else {
                            newSelection = products.map((p) => p.id);
                          }
                          setSelectedProducts(newSelection);
                          if (editingClient) {
                            const client: Client = editingClient;
                            setIsSaving(true);
                            setSaveError(null);
                            try {
                              await onUpdateClient(client.id, {
                                selectedProducts: newSelection,
                              });
                            } catch {
                              setSaveError("Failed to save changes.");
                            } finally {
                              setIsSaving(false);
                            }
                          }
                        }}
                        disabled={isSaving}
                        style={{ minWidth: 140 }}
                      >
                        {selectedProducts.length === products.length
                          ? "Deselect All"
                          : "Select All Products"}
                      </button>
                      <span
                        style={{
                          color: "#0ea5e9",
                          fontWeight: 600,
                          fontSize: 15,
                        }}
                      >
                        {selectedProducts.length} / {products.length} selected
                      </span>
                    </div>
                    <hr style={{ margin: "8px 0" }} />
                    <div className="row g-3 client-product-grid">
                      {[...products]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((product) => (
                          <div
                            key={product.id}
                            className="col-6 col-md-4 col-lg-3"
                          >
                            <label
                              className={`card h-100 shadow-sm position-relative product-checkbox-card client-product-card ${
                                selectedProducts.includes(product.id)
                                  ? "border-primary"
                                  : "border-light"
                              }`}
                              style={{ cursor: "pointer" }}
                            >
                              <input
                                type="checkbox"
                                className="form-check-input position-absolute top-0 end-0 m-2"
                                style={{ zIndex: 2, width: 22, height: 22 }}
                                id={`product-${product.id}-edit`}
                                checked={selectedProducts.includes(product.id)}
                                onChange={() => handleProductToggle(product.id)}
                                disabled={isSaving}
                              />
                              <div className="card-body d-flex flex-column align-items-center justify-content-center p-2">
                                {product.imageUrl && (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="mb-2 rounded"
                                    style={{ width: 48, height: 48, objectFit: "cover" }}
                                  />
                                )}
                                <span
                                  className="client-product-name"
                                  style={{ display: "block", width: "100%" }}
                                >
                                  {product.name}
                                </span>
                              </div>
                            </label>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="isRentedEdit"
                        checked={isRented}
                        onChange={(e) => handleIsRentedToggle(e.target.checked)}
                        disabled={isSaving}
                      />
                      <label
                        className="form-check-label"
                        htmlFor="isRentedEdit"
                      >
                        Is Rented
                      </label>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Washing Type</label>
                    <div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="washingTypeEdit"
                          id="washingTypeTunnelEdit"
                          value="Tunnel"
                          checked={washingType === "Tunnel"}
                          onChange={() => setWashingType("Tunnel")}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="washingTypeTunnelEdit"
                        >
                          Tunnel
                        </label>
                      </div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="washingTypeEdit"
                          id="washingTypeConventionalEdit"
                          value="Conventional"
                          checked={washingType === "Conventional"}
                          onChange={() => setWashingType("Conventional")}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="washingTypeConventionalEdit"
                        >
                          Conventional
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Segregation</label>
                    <div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="segregationEdit"
                          id="segregationYesEdit"
                          value="yes"
                          checked={segregation === true}
                          onChange={() => setSegregation(true)}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="segregationYesEdit"
                        >
                          Yes
                        </label>
                      </div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="segregationEdit"
                          id="segregationNoEdit"
                          value="no"
                          checked={segregation === false}
                          onChange={() => setSegregation(false)}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="segregationNoEdit"
                        >
                          No
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Billing Calculation</label>
                    <div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="billingCalculationEdit"
                          id="billingByWeightEdit"
                          value="byWeight"
                          checked={billingCalculation === "byWeight"}
                          onChange={() => setBillingCalculation("byWeight")}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="billingByWeightEdit"
                        >
                          By Weight
                        </label>
                      </div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="billingCalculationEdit"
                          id="billingByItemEdit"
                          value="byItem"
                          checked={billingCalculation === "byItem"}
                          onChange={() => setBillingCalculation("byItem")}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="billingByItemEdit"
                        >
                          Per Item
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Requires Invoice?</label>
                    <div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="needsInvoiceEdit"
                          id="needsInvoiceYesEdit"
                          value="yes"
                          checked={needsInvoice === true}
                          onChange={() => setNeedsInvoice(true)}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="needsInvoiceYesEdit"
                        >
                          Yes
                        </label>
                      </div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="needsInvoiceEdit"
                          id="needsInvoiceNoEdit"
                          value="no"
                          checked={needsInvoice === false}
                          onChange={() => setNeedsInvoice(false)}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="needsInvoiceNoEdit"
                        >
                          No
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">
                      Completed Option Position
                    </label>
                    <div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="completedOptionPositionEdit"
                          id="completedPositionTopEdit"
                          value="top"
                          checked={completedOptionPosition === "top"}
                          onChange={async () => {
                            setCompletedOptionPosition("top");
                            if (editingClient) {
                              setIsSaving(true);
                              setSaveError(null);
                              try {
                                await onUpdateClient(editingClient.id, {
                                  completedOptionPosition: "top",
                                });
                              } catch {
                                setSaveError("Failed to save changes.");
                              } finally {
                                setIsSaving(false);
                              }
                            }
                          }}
                          disabled={isSaving}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="completedPositionTopEdit"
                        >
                          Mangle
                        </label>
                      </div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="completedOptionPositionEdit"
                          id="completedPositionBottomEdit"
                          value="bottom"
                          checked={completedOptionPosition === "bottom"}
                          onChange={async () => {
                            setCompletedOptionPosition("bottom");
                            if (editingClient) {
                              setIsSaving(true);
                              setSaveError(null);
                              try {
                                await onUpdateClient(editingClient.id, {
                                  completedOptionPosition: "bottom",
                                });
                              } catch {
                                setSaveError("Failed to save changes.");
                              } finally {
                                setIsSaving(false);
                              }
                            }
                          }}
                          disabled={isSaving}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="completedPositionBottomEdit"
                        >
                          Doblado
                        </label>
                      </div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="completedOptionPositionEdit"
                          id="completedPositionBothEdit"
                          value="both"
                          checked={completedOptionPosition === "both"}
                          onChange={async () => {
                            setCompletedOptionPosition("both");
                            if (editingClient) {
                              setIsSaving(true);
                              setSaveError(null);
                              try {
                                await onUpdateClient(editingClient.id, {
                                  completedOptionPosition: "both",
                                });
                              } catch {
                                setSaveError("Failed to save changes.");
                              } finally {
                                setIsSaving(false);
                              }
                            }
                          }}
                          disabled={isSaving}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="completedPositionBothEdit"
                        >
                          Both (Mangle and Doblado)
                        </label>
                      </div>
                      <div className="form-check form-check-inline">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="completedOptionPositionEdit"
                          id="completedPositionUniformsEdit"
                          value="uniformes"
                          checked={completedOptionPosition === "uniformes"}
                          onChange={async () => {
                            setCompletedOptionPosition("uniformes");
                            if (editingClient) {
                              setIsSaving(true);
                              setSaveError(null);
                              try {
                                await onUpdateClient(editingClient.id, {
                                  completedOptionPosition: "uniformes",
                                });
                              } catch {
                                setSaveError("Failed to save changes.");
                              } finally {
                                setIsSaving(false);
                              }
                            }
                          }}
                          disabled={isSaving}
                        />
                        <label
                          className="form-check-label"
                          htmlFor="completedPositionUniformsEdit"
                        >
                          Uniformes
                        </label>
                      </div>
                    </div>
                    <div className="form-text text-muted">
                      Choose where the completed option appears in the active
                      invoice page for this client.
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isSaving}
                    >
                      Update Client
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancel}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
                {saveError && (
                  <div className="alert alert-danger mt-2">{saveError}</div>
                )}
                {isSaving && <div className="text-info mt-2">Saving...</div>}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      <DeleteConfirmationModal
        show={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        onConfirm={async () => {
          if (clientToDelete) {
            await onDeleteClient(clientToDelete.id);
            await logActivity({
              type: "Client",
              message: `Client '${clientToDelete.name}' deleted`,
            });
            setClientToDelete(null);
          }
        }}
        title="Delete Client"
        message={`Are you sure you want to delete client '${clientToDelete?.name}'? This action cannot be undone.`}
      />
    </div>
  );
};
