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
import { canUserSeeComponent, AppComponentKey } from "./permissions";

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

  // Helper: check if current user can see a component (per-user or fallback to role)
  const canSee = (component: AppComponentKey) =>
    user && canUserSeeComponent(user, component);

  // Real-time Firestore listeners for invoices, products, and clients
  useEffect(() => {
    // Invoices
    const unsubInvoices = onSnapshot(collection(db, "invoices"), (snapshot) => {
      const invoices = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setInvoices(invoices as Invoice[]);
    });
    // Products
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const products = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProducts(products as Product[]);
    });
    // Clients (optional, for real-time sync)
    const unsubClients = onSnapshot(collection(db, "clients"), (snapshot) => {
      const clients = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setClients(clients as Client[]);
    });
    return () => {
      unsubInvoices();
      unsubProducts();
      unsubClients();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Only fetch drivers and users here
        const [fetchedUsers] = await Promise.all([
          getUsers(),
        ]);
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
      // If user has a defaultPage, set it as the active page on login
      if (user.defaultPage) {
        setActivePage(
          user.defaultPage === "ActiveInvoices"
            ? "home"
            : user.defaultPage === "PickupWashing"
            ? "entradas"
            : user.defaultPage === "Washing"
            ? "washing"
            : user.defaultPage === "Segregation"
            ? "segregation"
            : user.defaultPage === "Report"
            ? "reports"
            : user.defaultPage === "UserManagement"
            ? "settings"
            : "home"
        );
        setShowWelcome(false);
      } else {
        setShowWelcome(true);
      }
    }
  }, [user]);

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
      await addProduct(newProduct);
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
    } catch (error) {
      console.error("Error updating product:", error);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct(productId);
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const handleAddInvoice = async (invoice: Omit<Invoice, "id">) => {
    try {
      await addInvoice(invoice);
    } catch (error) {
      console.error("Error adding invoice:", error);
    }
  };

  const handleUpdateInvoice = async (
    invoiceId: string,
    updatedInvoice: Partial<Invoice>
  ) => {
    try {
      await updateInvoice(invoiceId, updatedInvoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      alert("Error updating invoice. Please try again.");
      throw error;
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      await deleteInvoice(invoiceId);
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

  // Role-based tab visibility (now using permissions map)
  const canManageUsers = canSee("UserManagement");
  const canManageProducts = canSee("Report"); // adjust if you have a separate key for products
  const canManageClients = true; // All roles, or use canSee('ClientForm') if you want to restrict

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
              {canSee("ActiveInvoices") && (
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
              )}
              {canSee("PickupWashing") && (
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
              )}
              {canSee("Washing") && (
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
              )}
              {canSee("Segregation") && (
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
              )}
              {canSee("Report") && (
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
              )}
              {canManageUsers && (
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
              )}
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
      {/* Main content: only render components if user has permission */}
      {activePage === "home" && canSee("ActiveInvoices") && (
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
      )}
      {activePage === "entradas" && canSee("PickupWashing") && (
        <PickupWashing clients={clients} drivers={drivers} />
      )}
      {activePage === "washing" && canSee("Washing") && (
        <Washing setSelectedInvoiceId={setSelectedInvoiceId} />
      )}
      {activePage === "segregation" && canSee("Segregation") && <Segregation />}
      {activePage === "reports" && canSee("Report") && <Report />}
      {activePage === "settings" && canManageUsers && (
        <>
          {/* Settings Nav Bar - always visible below main navbar */}
          <div style={{ height: 56 }} />{" "}
          {/* Spacer to push submenu below navbar */}
          <div
            className="mb-3"
            style={{
              marginTop: 0,
              marginBottom: 24,
              zIndex: 1,
              position: "relative",
            }}
          >
            <div
              className="btn-group w-100 justify-content-center"
              role="group"
              style={{ display: "flex" }}
            >
              <button
                className={`btn btn-outline-primary${
                  activeSettingsTab === "clients" ? " active" : ""
                }`}
                onClick={() => setActiveSettingsTab("clients")}
                style={{ minWidth: 120 }}
              >
                Clients
              </button>
              <button
                className={`btn btn-outline-primary${
                  activeSettingsTab === "products" ? " active" : ""
                }`}
                onClick={() => setActiveSettingsTab("products")}
                style={{ minWidth: 120 }}
              >
                Products
              </button>
              <button
                className={`btn btn-outline-primary${
                  activeSettingsTab === "drivers" ? " active" : ""
                }`}
                onClick={() => setActiveSettingsTab("drivers")}
                style={{ minWidth: 120 }}
              >
                Choferes
              </button>
              <button
                className={`btn btn-outline-primary${
                  activeSettingsTab === "users" ? " active" : ""
                }`}
                onClick={() => setActiveSettingsTab("users")}
                style={{ minWidth: 120 }}
              >
                Users
              </button>
            </div>
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
            {activeSettingsTab === "drivers" && (
              <div className="col-md-12">
                <DriverManagement drivers={drivers} />
              </div>
            )}
            {activeSettingsTab === "users" && canManageUsers && (
              <div className="col-md-12">
                <UserManagement />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
