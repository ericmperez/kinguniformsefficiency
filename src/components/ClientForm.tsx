import React, { useState } from "react";
// Use canonical types from src/types.ts
import type { Client as AppClient, Product as AppProduct } from "../types";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";

interface Product {
  id: string;
  name: string;
  image: File | null;
  imageUrl?: string;
}

interface Client {
  id: string;
  name: string;
  selectedProducts: string[];
  image?: File | null;
  imageUrl?: string;
  isRented: boolean;
}

interface ClientFormProps {
  clients: AppClient[];
  products: AppProduct[];
  onAddClient: (client: Omit<AppClient, "id">) => Promise<void>;
  onUpdateClient: (
    clientId: string,
    client: Partial<AppClient>
  ) => Promise<void>;
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
  const [editingClient, setEditingClient] = useState<AppClient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<AppClient | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    const clientData = {
      name: newClientName,
      image: newClientImage,
      selectedProducts,
      isRented,
    };

    if (editingClient) {
      await onUpdateClient(editingClient.id, clientData);
      setEditingClient(null);
    } else {
      await onAddClient(clientData);
    }

    setNewClientName("");
    setNewClientImage(null);
    setSelectedProducts([]);
    setIsRented(false);
  };

  // Patch: always provide image as File|null (never undefined) for AppClient
  type CanonicalClient = import("../types").Client;

  const handleEdit = (client: CanonicalClient) => {
    setEditingClient({
      ...client,
      image: client.image === undefined ? null : client.image,
    });
    setNewClientName(client.name);
    setSelectedProducts(client.selectedProducts);
    setIsRented(client.isRented);
  };

  const handleCancel = () => {
    setEditingClient(null);
    setNewClientName("");
    setNewClientImage(null);
    setSelectedProducts([]);
    setIsRented(false);
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

  return (
    <div className="card">
      <div className="card-header">
        <h3>{editingClient ? "Edit Client" : "Add New Client"}</h3>
      </div>
      <div className="card-body">
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
            <div className="row g-3">
              {products.map((product) => (
                <div key={product.id} className="col-6 col-md-4 col-lg-3">
                  <label
                    className={`card h-100 shadow-sm position-relative product-checkbox-card ${
                      selectedProducts.includes(product.id)
                        ? "border-primary"
                        : "border-light"
                    }`}
                    style={{ cursor: "pointer", minHeight: 90 }}
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
                          style={{ width: 40, height: 40, objectFit: "cover" }}
                        />
                      )}
                      <span
                        className="fw-semibold text-center"
                        style={{ fontSize: 15 }}
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

          <div className="d-flex gap-2">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {editingClient ? "Update Client" : "Add Client"}
            </button>
            {editingClient && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancel}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {saveError && (
          <div className="alert alert-danger mt-2">{saveError}</div>
        )}
        {isSaving && <div className="text-info mt-2">Saving...</div>}

        <div className="mt-4">
          <h4>Client List</h4>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Image</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>{client.name}</td>
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
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleEdit(client)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setClientToDelete(client)}
                        >
                          Delete
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

      {/* Confirmation Modal */}
      <DeleteConfirmationModal
        show={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        onConfirm={async () => {
          if (clientToDelete) {
            await onDeleteClient(clientToDelete.id);
            setClientToDelete(null);
          }
        }}
        title="Delete Client"
        message={`Are you sure you want to delete client '${clientToDelete?.name}'? This action cannot be undone.`}
      />
    </div>
  );
};
