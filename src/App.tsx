import { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./App.css";
import { ProductForm } from "./components/ProductForm";
import { ClientForm } from "./components/ClientForm";
import ActiveInvoices from "./components/ActiveInvoices";
import {
  getClients,
  getProducts,
  getInvoices,
  addClient,
  updateClient,
  deleteClient,
  addProduct,
  updateProduct,
  deleteProduct,
  addInvoice,
  updateInvoice,
  deleteInvoice,
  uploadImage,
  assignCartToInvoice,
} from "./services/firebaseService";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";
import type {
  Client as AppClient,
  Product as AppProduct,
  Invoice,
} from "./types";
import { Client, Product } from "./types";
import { useAuth } from "./components/AuthContext";
import LocalLoginForm from "./components/LocalLoginForm";

interface ActiveInvoicesProps {
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  onAddInvoice: (invoice: Omit<Invoice, "id">) => Promise<void>;
  onDeleteInvoice: (invoiceId: string) => Promise<void>;
  onUpdateInvoice: (
    invoiceId: string,
    updatedInvoice: Partial<Invoice>
  ) => Promise<void>;
}

// Utility: Remove deleted client from all invoices
function removeClientFromInvoices(
  clientId: string,
  invoices: Invoice[]
): Invoice[] {
  return invoices.filter((invoice) => invoice.clientId !== clientId);
}

// Utility: Remove deleted product from all invoices/carts
function removeProductFromInvoices(
  productId: string,
  invoices: Invoice[]
): Invoice[] {
  return invoices.map((invoice) => ({
    ...invoice,
    products: invoice.products.filter((p) => p.id !== productId),
    carts: invoice.carts.map((cart) => ({
      ...cart,
      items: cart.items.filter((item) => item.productId !== productId),
    })),
  }));
}

// Utility: Update product info in all invoices/carts
function updateProductInInvoices(
  product: Product,
  invoices: Invoice[]
): Invoice[] {
  return invoices.map((invoice) => ({
    ...invoice,
    products: invoice.products.map((p) =>
      p.id === product.id ? { ...p, ...product } : p
    ),
    carts: invoice.carts.map((cart) => ({
      ...cart,
      items: cart.items.map((item) =>
        item.productId === product.id
          ? { ...item, productName: product.name, price: product.price }
          : item
      ),
    })),
  }));
}

// Utility: Update client info in all invoices
function updateClientInInvoices(
  client: Client,
  invoices: Invoice[]
): Invoice[] {
  return invoices.map((invoice) =>
    invoice.clientId === client.id
      ? { ...invoice, clientName: client.name }
      : invoice
  );
}

function App() {
  const { user, logout } = useAuth();
  const [activePage, setActivePage] = useState<"home" | "settings">("home");
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    "clients" | "products"
  >("clients");
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showClientForm, setShowClientForm] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedClients, fetchedProducts, fetchedInvoices] =
          await Promise.all([getClients(), getProducts(), getInvoices()]);
        setClients(fetchedClients);
        setProducts(fetchedProducts);
        setInvoices(fetchedInvoices);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  // Patch: Ensure image is always File|null, never undefined, for Client
  const handleAddClient: (client: Omit<Client, "id">) => Promise<void> = async (
    client
  ) => {
    try {
      let imageUrl = "";
      // Patch: fallback to null if image is undefined
      const image: File | null =
        client.image === undefined ? null : client.image;
      if (image) {
        const imageRef = ref(storage, `clients/${Date.now()}_${image.name}`);
        await uploadBytes(imageRef, image);
        imageUrl = await getDownloadURL(imageRef);
      }
      const newClient: any = {
        ...client,
        image,
        ...(imageUrl ? { imageUrl } : {}),
      };
      Object.keys(newClient).forEach((key) => {
        if (newClient[key] === undefined) {
          delete newClient[key];
        }
      });
      const clientId = await addClient(newClient);
      setClients([...clients, { ...newClient, id: clientId }]);
      setShowClientForm(false);
    } catch (error) {
      console.error("Error adding client:", error);
    }
  };

  const handleUpdateClient = async (
    clientId: string,
    updatedClient: Partial<Client>
  ) => {
    try {
      let imageUrl = updatedClient.imageUrl;
      if (updatedClient.image) {
        imageUrl = await uploadImage(
          updatedClient.image,
          `clients/${Date.now()}_${updatedClient.image.name}`
        );
      }

      const clientToUpdate = {
        ...updatedClient,
        imageUrl,
      };

      await updateClient(clientId, clientToUpdate);
      setClients((prevClients) =>
        prevClients.map((client) =>
          client.id === clientId ? { ...client, ...clientToUpdate } : client
        )
      );
      // Update client info in all invoices
      setInvoices((prev) => {
        const prevClient = clients.find((c) => c.id === clientId);
        if (prevClient) {
          return updateClientInInvoices(
            { ...prevClient, ...clientToUpdate, id: clientId },
            prev
          );
        }
        return prev;
      });
    } catch (error) {
      console.error("Error updating client:", error);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await deleteClient(clientId);
      setClients(clients.filter((client) => client.id !== clientId));
      setInvoices((prev) => removeClientFromInvoices(clientId, prev));
    } catch (error) {
      console.error("Error deleting client:", error);
    }
  };

  // Patch: Ensure price is always present for Product
  const handleAddProduct: (
    product: Omit<Product, "id">
  ) => Promise<void> = async (product) => {
    try {
      let imageUrl;
      const image: File | null =
        product.image === undefined ? null : product.image;
      // Patch: fallback to 0 if price is undefined
      const price: number =
        (product as any).price !== undefined ? (product as any).price : 0;
      if (image) {
        imageUrl = await uploadImage(
          image,
          `products/${Date.now()}_${image.name}`
        );
      }
      const newProduct = {
        ...product,
        image,
        price,
        imageUrl,
      };
      const productId = await addProduct(newProduct);
      const completeProduct = { ...newProduct, id: productId };
      setProducts((prevProducts) => [...prevProducts, completeProduct]);
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };

  const handleUpdateProduct = async (
    productId: string,
    updatedProduct: Partial<Product>
  ) => {
    try {
      let imageUrl = updatedProduct.imageUrl;
      if (updatedProduct.image) {
        imageUrl = await uploadImage(
          updatedProduct.image,
          `products/${Date.now()}_${updatedProduct.image.name}`
        );
      }

      const productToUpdate = {
        ...updatedProduct,
        imageUrl,
      };

      await updateProduct(productId, productToUpdate);
      setProducts(
        products.map((product) =>
          product.id === productId
            ? { ...product, ...productToUpdate }
            : product
        )
      );
      // Update product info in all invoices/carts
      const updated = products.find((p) => p.id === productId);
      if (updated) {
        setInvoices((prev) =>
          updateProductInInvoices({ ...updated, ...productToUpdate }, prev)
        );
      }
    } catch (error) {
      console.error("Error updating product:", error);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct(productId);
      setProducts(products.filter((product) => product.id !== productId));
      setInvoices((prev) => removeProductFromInvoices(productId, prev));
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const handleAddInvoice = async (invoice: Omit<Invoice, "id">) => {
    try {
      const invoiceId = await addInvoice(invoice);
      setInvoices([...invoices, { ...invoice, id: invoiceId }]);
    } catch (error) {
      console.error("Error adding invoice:", error);
    }
  };

  const handleUpdateInvoice = async (
    invoiceId: string,
    updatedInvoice: Partial<Invoice>
  ) => {
    try {
      console.log("Updating invoice:", { invoiceId, updatedInvoice });
      await updateInvoice(invoiceId, updatedInvoice);

      setInvoices((prevInvoices) =>
        prevInvoices.map((invoice) =>
          invoice.id === invoiceId ? { ...invoice, ...updatedInvoice } : invoice
        )
      );

      console.log("Invoice updated successfully in local state");
    } catch (error) {
      console.error("Error updating invoice:", error);
      alert("Error updating invoice. Please try again.");
      throw error;
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      await deleteInvoice(invoiceId);
      setInvoices(invoices.filter((invoice) => invoice.id !== invoiceId));
    } catch (error) {
      console.error("Error deleting invoice:", error);
    }
  };

  if (!user) {
    return <LocalLoginForm />;
  }

  return (
    <div className="container-fluid">
      <nav className="navbar navbar-expand-lg navbar-light bg-light mb-4">
        <div className="container-fluid">
          <a className="navbar-brand" href="#">
            Laundry App
          </a>
          <div className="navbar-nav">
            <button
              className={`nav-link btn btn-link ${
                activePage === "home" ? "active" : ""
              }`}
              onClick={() => setActivePage("home")}
            >
              Home
            </button>
            <button
              className={`nav-link btn btn-link ${
                activePage === "settings" ? "active" : ""
              }`}
              onClick={() => setActivePage("settings")}
            >
              Settings
            </button>
          </div>
        </div>
      </nav>

      {activePage === "home" ? (
        <ActiveInvoices
          clients={clients}
          products={products}
          invoices={invoices}
          onAddInvoice={handleAddInvoice}
          onDeleteInvoice={handleDeleteInvoice}
          onUpdateInvoice={handleUpdateInvoice}
        />
      ) : (
        <div>
          {/* Tab Buttons */}
          <div className="mb-3">
            <button
              className={`btn btn-outline-primary me-2 ${
                activeSettingsTab === "clients" ? "active" : ""
              }`}
              onClick={() => setActiveSettingsTab("clients")}
            >
              Clients
            </button>
            <button
              className={`btn btn-outline-primary ${
                activeSettingsTab === "products" ? "active" : ""
              }`}
              onClick={() => setActiveSettingsTab("products")}
            >
              Products
            </button>
          </div>
          {/* Show only one form at a time */}
          <div className="row">
            {activeSettingsTab === "clients" && (
              <div className="col-md-12">
                <ClientForm
                  clients={clients}
                  products={products}
                  onAddClient={handleAddClient}
                  onUpdateClient={handleUpdateClient}
                  onDeleteClient={handleDeleteClient}
                />
              </div>
            )}
            {activeSettingsTab === "products" && (
              <div className="col-md-12">
                <ProductForm
                  products={products}
                  onAddProduct={handleAddProduct}
                  onUpdateProduct={handleUpdateProduct}
                  onDeleteProduct={handleDeleteProduct}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
