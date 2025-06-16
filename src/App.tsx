import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./App.css";
import { ProductForm } from "./components/ProductForm";
import { ClientForm } from "./components/ClientForm";
import ActiveInvoices from "./components/ActiveInvoices";
import PickupWashing from "./components/PickupWashing";
import Washing from "./components/Washing";
import Segregation from "./components/Segregation";
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
  getUsers,
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
import UserManagement from "./components/UserManagement";
import DriverManagement from "./components/DriverManagement";
import { useState, useEffect } from "react";
import type { UserRecord } from "./services/firebaseService";
import {
  collection,
  getDocs,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import Report from "./components/Report";
import React from "react";

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
  const [activePage, setActivePage] = useState<
    "home" | "entradas" | "washing" | "segregation" | "settings" | "reports"
  >("home");
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    "clients" | "products" | "users" | "drivers"
  >("clients");
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  );
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedClients, fetchedProducts, fetchedInvoices, fetchedUsers] =
          await Promise.all([
            getClients(),
            getProducts(),
            getInvoices(),
            getUsers(),
          ]);
        setClients(fetchedClients);
        setProducts(fetchedProducts);
        setInvoices(fetchedInvoices);
        setUsers(fetchedUsers);
        // Fetch drivers from Firestore
        const driverSnapshot = await getDocs(collection(db, "drivers"));
        setDrivers(
          driverSnapshot.docs.map(
            (doc) =>
              ({ id: doc.id, ...doc.data() } as { id: string; name: string })
          )
        );
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (user) {
      setShowWelcome(true);
      const timer = setTimeout(() => setShowWelcome(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Real-time driver updates
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "drivers"),
      (querySnapshot: QuerySnapshot<DocumentData>) => {
        setDrivers(
          querySnapshot.docs.map(
            (doc) =>
              ({ id: doc.id, ...doc.data() } as { id: string; name: string })
          )
        );
      }
    );
    return () => unsubscribe();
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

  if (showWelcome) {
    return (
      <div
        className="d-flex flex-column justify-content-center align-items-center"
        style={{ minHeight: "100vh", background: "#f8f9fa" }}
        onClick={() => setShowWelcome(false)}
      >
        <div className="card shadow p-5 text-center" style={{ maxWidth: 400 }}>
          <h2 className="mb-3">Hola, {user.username}!</h2>
          <p className="lead mb-0">
            Gracias por formar parte del <b>Equipo de King Uniforms</b>.
          </p>
          <small className="text-muted d-block mt-3">
            (Haz clic para continuar)
          </small>
        </div>
      </div>
    );
  }

  // Role-based tab visibility
  const canManageUsers = user.role === "Admin" || user.role === "Owner";
  const canManageProducts =
    user.role === "Supervisor" ||
    user.role === "Admin" ||
    user.role === "Owner";
  const canManageClients = true; // All roles

  return (
    <div className="container-fluid">
      <nav className="navbar navbar-expand-lg navbar-light bg-light mb-4">
        <div className="container-fluid">
          <a className="navbar-brand" href="#">
            King Uniforms
          </a>
          {/* Hamburger for tablet/mobile */}
          <button
            className="navbar-toggler d-lg-none"
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          {/* Menu options: show inline on desktop, in dropdown on tablet/mobile */}
          <div
            className={`collapse navbar-collapse${
              menuOpen ? " show" : ""
            } d-lg-block`}
            style={{
              zIndex: 1000,
              background: "var(--ku-red)",
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              borderRadius: "0 0 10px 10px",
            }}
          >
            <div className="navbar-nav">
              <button
                className={`nav-link btn btn-link ${
                  activePage === "home" ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage("home");
                  setMenuOpen(false);
                }}
              >
                Home
              </button>
              <button
                className={`nav-link btn btn-link ${
                  activePage === "entradas" ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage("entradas");
                  setMenuOpen(false);
                }}
              >
                Entradas
              </button>
              <button
                className={`nav-link btn btn-link ${
                  activePage === "washing" ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage("washing");
                  setMenuOpen(false);
                }}
              >
                Washing
              </button>
              <button
                className={`nav-link btn btn-link ${
                  activePage === "segregation" ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage("segregation");
                  setMenuOpen(false);
                }}
              >
                Segregation
              </button>
              <button
                className={`nav-link btn btn-link ${
                  activePage === "reports" ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage("reports");
                  setMenuOpen(false);
                }}
              >
                Reports
              </button>
              <button
                className={`nav-link btn btn-link ${
                  activePage === "settings" ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage("settings");
                  setMenuOpen(false);
                }}
              >
                Settings
              </button>
            </div>
          </div>
          <div className="d-flex align-items-center ms-auto">
            <span className="me-3 text-muted">
              Hello, {user.username} ({user.role})
            </span>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={logout}
            >
              Logout
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
          selectedInvoiceId={selectedInvoiceId}
          setSelectedInvoiceId={setSelectedInvoiceId}
        />
      ) : activePage === "entradas" ? (
        <PickupWashing clients={clients} drivers={drivers} />
      ) : activePage === "washing" ? (
        <Washing setSelectedInvoiceId={setSelectedInvoiceId} />
      ) : activePage === "segregation" ? (
        <Segregation />
      ) : activePage === "reports" ? (
        <Report />
      ) : (
        <div>
          {/* Tab Buttons */}
          <div className="mb-3">
            {canManageClients && (
              <button
                className={`btn btn-outline-primary me-2 ${
                  activeSettingsTab === "clients" ? "active" : ""
                }`}
                onClick={() => setActiveSettingsTab("clients")}
              >
                Clients
              </button>
            )}
            {canManageProducts && (
              <button
                className={`btn btn-outline-primary me-2 ${
                  activeSettingsTab === "products" ? "active" : ""
                }`}
                onClick={() => setActiveSettingsTab("products")}
              >
                Products
              </button>
            )}
            {canManageUsers && (
              <button
                className={`btn btn-outline-primary me-2 ${
                  activeSettingsTab === "users" ? "active" : ""
                }`}
                onClick={() => setActiveSettingsTab("users")}
              >
                Users
              </button>
            )}
            <button
              className={`btn btn-outline-primary ${
                activeSettingsTab === "drivers" ? "active" : ""
              }`}
              onClick={() => setActiveSettingsTab("drivers")}
            >
              Choferes
            </button>
          </div>
          {/* Show only one form at a time */}
          <div className="row">
            {activeSettingsTab === "clients" && canManageClients && (
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
            {activeSettingsTab === "products" && canManageProducts && (
              <div className="col-md-12">
                <ProductForm
                  products={products}
                  onAddProduct={handleAddProduct}
                  onUpdateProduct={handleUpdateProduct}
                  onDeleteProduct={handleDeleteProduct}
                />
              </div>
            )}
            {activeSettingsTab === "users" && canManageUsers && (
              <div className="col-md-12">
                <UserManagement />
              </div>
            )}
            {activeSettingsTab === "drivers" && (
              <div className="col-md-12">
                <DriverManagement drivers={drivers} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
