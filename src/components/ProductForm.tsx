import React, { useState } from "react";
// Use canonical Product type from src/types.ts
import type { Product as AppProduct } from "../types";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { logActivity } from "../services/firebaseService";

interface ProductFormProps {
  products: AppProduct[];
  onAddProduct: (product: Omit<AppProduct, "id">) => Promise<void>;
  onUpdateProduct: (
    productId: string,
    product: Partial<AppProduct>
  ) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
}) => {
  const [newProductName, setNewProductName] = useState("");
  const [newProductImage, setNewProductImage] = useState<File | null>(null);
  const [editingProduct, setEditingProduct] = useState<AppProduct | null>(null);
  const [productToDelete, setProductToDelete] = useState<AppProduct | null>(
    null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    console.log("Submitting product form:", {
      name: newProductName,
      image: newProductImage,
    });

    // Patch: require price input (default to 0 if not present)
    const price =
      typeof editingProduct?.price === "number" ? editingProduct.price : 0;

    const productData = {
      name: newProductName,
      image: newProductImage,
      price,
    };

    try {
      if (editingProduct) {
        console.log("Updating existing product:", editingProduct.id);
        await onUpdateProduct(editingProduct.id, productData);
        setEditingProduct(null);
        await logActivity({
          type: "Product",
          message: `Product '${editingProduct.name}' updated`,
        });
      } else {
        console.log("Adding new product");
        await onAddProduct(productData);
        await logActivity({
          type: "Product",
          message: `Product '${newProductName}' added`,
        });
      }

      // Clear the form
      setNewProductName("");
      setNewProductImage(null);
      console.log("Form cleared");
    } catch (error) {
      console.error("Error in handleSubmit:", error);
    }
  };

  const handleEdit = (product: AppProduct) => {
    setEditingProduct(product);
    setNewProductName(product.name);
  };

  const handleCancel = () => {
    setEditingProduct(null);
    setNewProductName("");
    setNewProductImage(null);
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>{editingProduct ? "Edit Product" : "Add New Product"}</h3>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="productName" className="form-label">
              Product Name
            </label>
            <input
              type="text"
              className="form-control"
              id="productName"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="productImage" className="form-label">
              Product Image
            </label>
            <input
              type="file"
              className="form-control"
              id="productImage"
              accept="image/*"
              onChange={(e) => setNewProductImage(e.target.files?.[0] || null)}
            />
          </div>

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary">
              {editingProduct ? "Update Product" : "Add Product"}
            </button>
            {editingProduct && (
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

        <div className="mt-4">
          <h4>Product List</h4>
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Image</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td style={{ width: "60px" }}>
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
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
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleEdit(product)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => setProductToDelete(product)}
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
        show={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={async () => {
          if (productToDelete) {
            await onDeleteProduct(productToDelete.id);
            await logActivity({
              type: "Product",
              message: `Product '${productToDelete.name}' deleted`,
            });
            setProductToDelete(null);
          }
        }}
        title="Delete Product"
        message={`Are you sure you want to delete product '${productToDelete?.name}'? This action cannot be undone.`}
      />
    </div>
  );
};
