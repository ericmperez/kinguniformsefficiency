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
  getManualConventionalProductsForDate,
  propagateProductUpdateToInvoices,
} from "./services/firebaseService";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";
import type {
  Client as AppClient,
  Product as AppProduct,
  Invoice,
} from "./types";
import { Client, Product } from "./types";
import { Cart, CartItem } from "./types";
import { useAuth } from "./components/AuthContext";
import LocalLoginForm from "./components/LocalLoginForm";
import UserManagement from "./components/UserManagement";
import DriverManagement from "./components/DriverManagement";
import PrintingSettings from "./components/PrintingSettings";
import { useState, useEffect } from "react";
import type { UserRecord } from "./services/firebaseService";
import {
  collection,
  onSnapshot,
  query as firestoreQuery,
  where as firestoreWhere,
  Timestamp as FirestoreTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import Report from "./components/Report";
import ReportsPage from "./components/ReportsPage";
import React from "react";
import { canUserSeeComponent, AppComponentKey } from "./permissions";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MenuIcon from "@mui/icons-material/Menu";
import AccountCircle from "@mui/icons-material/AccountCircle";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import HomeIcon from "@mui/icons-material/Home";
import ListAltIcon from "@mui/icons-material/ListAlt";
import LocalLaundryServiceIcon from "@mui/icons-material/LocalLaundryService";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import AssessmentIcon from "@mui/icons-material/Assessment";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import CalculateIcon from "@mui/icons-material/Calculate";
import kingUniformsLogo from "./assets/King Uniforms Logo.jpeg";
import SignInSide from "./components/SignInSide";
import RutasPorCamion from "./components/RutasPorCamion";
import GlobalActivityLog from "./components/GlobalActivityLog";
import BillingPage from "./components/BillingPage";
import SendInvoicePage from "./components/SendInvoicePage";
import AnalyticsPage from "./components/AnalyticsPage";
import ShippingPage from "./components/ShippingPage";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

interface ActiveInvoicesProps {
  clients: Client[];
  products: Product[];
  invoices: Invoice[];
  onAddInvoice: (invoice: Omit<Invoice, "id">) => Promise<string>;
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
    | "home"
    | "entradas"
    | "washing"
    | "segregation"
    | "settings"
    | "reports"
    | "analytics"
    | "billing"
    | "activityLog"
    | "shipping"
  >("home");
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
  const [todayTotalLbs, setTodayTotalLbs] = useState<number>(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<string>(
    localStorage.getItem("loginAnnouncements") || ""
  );
  const [announcementImage, setAnnouncementImage] = useState<string | null>(
    localStorage.getItem("loginAnnouncementImage") || null
  );
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    | "clients"
    | "products"
    | "users"
    | "drivers"
    | "loginContent"
    | "rutas"
    | "printing"
  >("clients");

  // State for which process menu is open (string or null)
  const [processMenuOpen, setProcessMenuOpen] = useState<string | null>(null);
  // Add state for anchor element
  const [processMenuAnchorEl, setProcessMenuAnchorEl] =
    useState<null | HTMLElement>(null);
  const processMenuOpenState = Boolean(processMenuAnchorEl);

  // Helper: check if current user can see a component (per-user or fallback to role)
  const canSee = (component: AppComponentKey) =>
    user && canUserSeeComponent(user, component);

  // Auto-redirect drivers to shipping page - MOVED TO TOP TO FIX HOOKS ORDER
  React.useEffect(() => {
    if (user && user.role === "Driver" && activePage !== "shipping") {
      setActivePage("shipping");
    }
  }, [user, activePage]);

  // Real-time Firestore listeners for invoices, products, and clients
  useEffect(() => {
    // Invoices
    const unsubInvoices = onSnapshot(collection(db, "invoices"), (snapshot) => {
      const invoices = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInvoices(invoices as Invoice[]);
    });
    // Products
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const products = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(products as Product[]);
    });
    // Clients (optional, for real-time sync)
    const unsubClients = onSnapshot(collection(db, "clients"), (snapshot) => {
      const clients = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
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
        const [fetchedUsers] = await Promise.all([getUsers()]);
        setUsers(fetchedUsers);
        // Fetch drivers from Firestore
        const driverSnapshot = await getDocs(collection(db, "drivers"));
        setDrivers(
          driverSnapshot.docs.map(
            (doc: any) =>
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
          user.defaultPage === "ActiveLaundryTickets"
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
      // For drivers, set shorter welcome screen time and auto-redirect to shipping
      if (user.role === "Driver") {
        setShowWelcome(true);
        const timer = setTimeout(() => {
          setShowWelcome(false);
          setActivePage("shipping");
        }, 1500); // Shorter welcome time for drivers
        return () => clearTimeout(timer);
      } else {
        setShowWelcome(true);
        const timer = setTimeout(() => setShowWelcome(false), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  // Real-time driver updates
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "drivers"),
      (querySnapshot: any) => {
        setDrivers(
          querySnapshot.docs.map(
            (doc: any) =>
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
      // Propagate product changes to all invoices
      await propagateProductUpdateToInvoices(productId, productToUpdate);
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
      return await addInvoice(invoice);
    } catch (error) {
      console.error("Error adding invoice:", error);
      throw error;
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

  // Save announcements and image to localStorage when changed
  useEffect(() => {
    localStorage.setItem("loginAnnouncements", announcements);
    if (announcementImage) {
      localStorage.setItem("loginAnnouncementImage", announcementImage);
    }
  }, [announcements, announcementImage]);

  // Real-time listener for today's total pounds
  useEffect(() => {
    // Fetch today's groups and entries, then sum only entries whose group is not deleted
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    // Listen to both groups and entries
    const groupsQ = firestoreQuery(
      collection(db, "pickup_groups"),
      firestoreWhere("startTime", ">=", FirestoreTimestamp.fromDate(today)),
      firestoreWhere("startTime", "<", FirestoreTimestamp.fromDate(tomorrow))
    );
    const entriesQ = firestoreQuery(
      collection(db, "pickup_entries"),
      firestoreWhere("timestamp", ">=", FirestoreTimestamp.fromDate(today)),
      firestoreWhere("timestamp", "<", FirestoreTimestamp.fromDate(tomorrow))
    );
    let unsubGroups: any, unsubEntries: any;
    let groupStatusMap: Record<string, string> = {};
    let entryCache: any[] = [];
    function updateTotal() {
      // Only sum entries whose group is not deleted (or missing from map)
      const total = entryCache.reduce((sum, entry) => {
        const status = groupStatusMap[entry.groupId];
        if (typeof status === "undefined" || status !== "deleted") {
          return sum + (typeof entry.weight === "number" ? entry.weight : 0);
        }
        return sum;
      }, 0);
      setTodayTotalLbs(total);
    }
    unsubGroups = onSnapshot(groupsQ, (snap) => {
      groupStatusMap = {};
      snap.docs.forEach((doc: any) => {
        const data = doc.data();
        groupStatusMap[doc.id] = data.status || "";
      });
      updateTotal();
    });
    unsubEntries = onSnapshot(entriesQ, (snap) => {
      entryCache = snap.docs.map((doc: any) => doc.data());
      updateTotal();
    });
    return () => {
      unsubGroups && unsubGroups();
      unsubEntries && unsubEntries();
    };
  }, []);

  // --- Auto-logout after user-defined inactivity timeout ---
  React.useEffect(() => {
    if (!user) return;
    if (user.id === "1991") return; // Never auto-logout user 1991
    let timer: NodeJS.Timeout;
    // Use the per-user logoutTimeout (in seconds, default 20)
    const timeout = (user.logoutTimeout || 20) * 1000;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        logout();
        // No alert, just log out and return to login page
      }, timeout);
    };
    // Listen for user activity
    const events = ["mousemove", "keydown", "mousedown", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [user, logout, user && user.logoutTimeout]);

  if (!user) {
    // Use the new LocalLoginForm as the login page
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

  // Refactored navLinks: Combine Entradas, Segregation, Washing under Process
  const navLinks = [
    {
      label: "Process",
      page: "process" as const,
      icon: <LocalLaundryServiceIcon />,
      visible:
        canSee("PickupWashing") || canSee("Segregation") || canSee("Washing"),
      subpages: [
        {
          label: "Entradas",
          page: "entradas" as const,
          icon: <ListAltIcon />,
          visible: canSee("PickupWashing"),
        },
        {
          label: "Segregation",
          page: "segregation" as const,
          icon: <GroupWorkIcon />,
          visible: canSee("Segregation"),
        },
        {
          label: "Washing",
          page: "washing" as const,
          icon: <LocalLaundryServiceIcon />,
          visible: canSee("Washing"),
        },
      ],
    },
    {
      label: "Reports",
      page: "reports" as const,
      icon: <AssessmentIcon />,
      visible: canSee("Report"),
      subpages: [
        {
          label: "Summary",
          page: "reports",
          icon: <AssessmentIcon />,
          visible: true,
        },
        {
          label: "Analytics",
          page: "analytics",
          icon: <AssessmentIcon />,
          visible: true,
        },
      ],
    },
    {
      label: "Settings",
      page: "settings" as const,
      icon: <SettingsIcon />,
      visible: canManageUsers,
    },
    {
      label: "Billing",
      page: "billing" as const,
      icon: <CalculateIcon style={{ fontSize: 38, color: "#0E62A0" }} />,
      visible: canSee("BillingPage"),
    },
    {
      label: "Activity Log",
      page: "activityLog" as const,
      icon: <ListAltIcon style={{ fontSize: 38, color: "#0E62A0" }} />,
      visible: canSee("GlobalActivityLog"),
    },
    {
      label: "Shipping",
      page: "shipping" as const,
      icon: <LocalShippingIcon style={{ fontSize: 38, color: "#0E62A0" }} />,
      visible: canSee("ShippingPage"),
    },
    // Removed 'Rutas por Camión' from navLinks
  ];

  // Home page cards config
  const homePages = [
    {
      label: "Entradas",
      page: "entradas",
      color: "#FAC61B",
      icon: <ListAltIcon style={{ fontSize: 38, color: "#FAC61B" }} />,
    },
    {
      label: "Segregation",
      page: "segregation",
      color: "#0E62A0",
      icon: <GroupWorkIcon style={{ fontSize: 38, color: "#0E62A0" }} />,
    },
    {
      label: "Washing",
      page: "washing",
      color: "#D72328",
      icon: (
        <LocalLaundryServiceIcon style={{ fontSize: 38, color: "#D72328" }} />
      ),
    },
    {
      label: "Reports",
      page: "reports",
      color: "#0E62A0",
      icon: <AssessmentIcon style={{ fontSize: 38, color: "#0E62A0" }} />,
    },
    {
      label: "Shipping",
      page: "shipping",
      color: "#0E62A0",
      icon: <LocalShippingIcon style={{ fontSize: 38, color: "#0E62A0" }} />,
    },
    {
      label: "Settings",
      page: "settings",
      color: "#FAC61B",
      icon: <SettingsIcon style={{ fontSize: 38, color: "#FAC61B" }} />,
    },
    // Add more pages as needed
  ];

  // PendingProductsWidget: shows all pending products (cart items) from groups with pendingProduct === true
  function PendingProductsWidget() {
    const [pendingProducts, setPendingProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const unsub = onSnapshot(collection(db, "pickup_groups"), (snap) => {
        const products: any[] = [];
        snap.docs.forEach((doc) => {
          const g = { id: doc.id, ...(doc.data() as any) };
          if (!g.pendingProduct) return;
          if (g.status === "deleted" || g.status === "Boleta Impresa") return;
          // NEW: If group is a new-style pending product (product info at group level)
          if (g.status === "Pending Product" && g.productId && g.productName) {
            products.push({
              groupId: g.id,
              clientName: g.clientName,
              productName: g.productName,
              quantity: g.quantity,
              createdAt: g.createdAt,
            });
            return;
          }
          // OLD: If group has carts/items
          if (Array.isArray(g.carts) && g.carts.length > 0) {
            g.carts.forEach((cart: any) => {
              if (Array.isArray(cart.items) && cart.items.length > 0) {
                cart.items.forEach((item: any) => {
                  products.push({
                    groupId: g.id,
                    clientName: g.clientName,
                    productName: item.productName,
                    quantity: item.quantity,
                    cartId: cart.id,
                  });
                });
              }
            });
          }
        });
        setPendingProducts(products);
        setLoading(false);
      });
      return () => unsub();
    }, []);

    if (loading)
      return <div className="card p-3 mb-3">Loading pending products...</div>;
    if (pendingProducts.length === 0)
      return <div className="card p-3 mb-3">No pending products.</div>;

    return (
      <div className="card p-3 mb-3">
        <h5 className="mb-3">Pending Products (Conventional + Button)</h5>
        <ul className="mb-0">
          {pendingProducts.map((item, idx) => (
            <li key={item.groupId + "-" + (item.cartId || "group") + "-" + idx}>
              <b>Client:</b> {item.clientName} &nbsp; <b>Product:</b>{" "}
              {item.productName} &nbsp; <b>Qty:</b> {item.quantity}
              {item.createdAt && (
                <span style={{ color: "#888", fontSize: "0.9em" }}>
                  {" "}
                  &nbsp; <b>Created:</b>{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // --- COMPONENT: MissingRequiredItemsSection ---
  type MissingRequiredItemsSectionProps = {
    clients: Client[];
    products: Product[];
    invoices: Invoice[];
  };

  function MissingRequiredItemsSection({
    clients,
    products,
    invoices,
  }: MissingRequiredItemsSectionProps) {
    // Build a map of productId to productName for display
    const productMap: Record<string, string> = Object.fromEntries(
      products.map((p: Product) => [p.id, p.name])
    );
    // Find all clients with an active invoice
    const clientActiveInvoices: Record<string, Invoice> = {};
    invoices.forEach((inv: Invoice) => {
      if (!clientActiveInvoices[inv.clientId]) {
        clientActiveInvoices[inv.clientId] = inv;
      }
    });
    // For each client, check which required products are missing from their invoice carts
    const missingItems: { clientName: string; productName: string }[] = [];
    clients.forEach((client: Client) => {
      const invoice = clientActiveInvoices[client.id];
      if (!invoice) return;
      // Gather all productIds present in any cart for this invoice
      const presentProductIds = new Set<string>();
      invoice.carts.forEach((cart: Cart) => {
        cart.items.forEach((item: CartItem) => {
          presentProductIds.add(item.productId);
        });
      });
      // For each required product, if not present, add to missing list
      (client.selectedProducts || []).forEach((productId: string) => {
        if (!presentProductIds.has(productId)) {
          missingItems.push({
            clientName: client.name,
            productName: productMap[productId] || productId,
          });
        }
      });
    });
    if (missingItems.length === 0) return null;
    return (
      <div className="card p-3 mb-4 border-danger">
        <h5 className="mb-3 text-danger">
          Required Items Missing from Invoices
        </h5>
        <ul className="mb-0">
          {missingItems.map((item, idx) => (
            <li key={item.clientName + "-" + item.productName + "-" + idx}>
              <b>Client:</b> {item.clientName} &nbsp; <b>Product:</b>{" "}
              {item.productName}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function ManualConventionalProductsWidget() {
    const [manualProducts, setManualProducts] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      let mounted = true;
      getManualConventionalProductsForDate(new Date()).then((products) => {
        if (mounted) {
          setManualProducts(products);
          setLoading(false);
        }
      });
      return () => {
        mounted = false;
      };
    }, []);

    if (loading)
      return <div className="card p-3 mb-3">Loading manual products...</div>;
    if (manualProducts.length === 0) return null;

    return (
      <div className="card p-3 mb-3">
        <h5 className="mb-3">Manual Products Added (Conventional + Button)</h5>
        <ul className="mb-0">
          {manualProducts.map((item, idx) => (
            <li key={item.id || idx}>
              <b>Client:</b> {item.clientName} &nbsp; <b>Product:</b>{" "}
              {item.productName} &nbsp; <b>Qty:</b> {item.quantity} &nbsp;{" "}
              <b>Type:</b> {item.type}
              {item.createdAt && (
                <span style={{ color: "#888", fontSize: "0.9em" }}>
                  {" "}
                  &nbsp; <b>Created:</b>{" "}
                  {new Date(
                    item.createdAt.seconds
                      ? item.createdAt.seconds * 1000
                      : item.createdAt
                  ).toLocaleString()}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <Router>
      <AppBar
        position="sticky"
        color="default"
        elevation={2}
        sx={{
          background: {
            xs: "linear-gradient(90deg, var(--ku-red) 80%, var(--ku-yellow) 100%)",
            md: "linear-gradient(90deg, var(--ku-red) 70%, var(--ku-yellow) 100%)",
          },
          color: "#fff",
          borderRadius: { xs: 0, md: "0 0 18px 18px" },
          boxShadow: "0 4px 24px rgba(215,35,40,0.10)",
          px: { xs: 1, md: 4 },
          backdropFilter: "blur(8px)",
          position: "relative",
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 48, md: 56 },
            display: "flex",
            flexDirection: "row",
            flexWrap: "nowrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            overflowX: "auto",
            whiteSpace: "nowrap",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexShrink: 0,
            }}
          >
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              sx={{ mr: 1, display: { xs: "flex", md: "none" } }}
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon />
            </IconButton>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="home"
              sx={{
                p: 0,
                mr: 1,
                borderRadius: 2,
                background: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
              }}
              onClick={() => setActivePage("home")}
            >
              <Avatar
                src={"/images/King-Uniforms-Icon.png"}
                alt="King Uniforms"
                sx={{
                  width: { xs: 28, md: 36 },
                  height: { xs: 28, md: 36 },
                  bgcolor: "#fff", // changed from var(--ku-yellow) to white
                  border: "2px solid #fff",
                }}
              />
            </IconButton>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                letterSpacing: 1,
                color: "#111", // Make King Uniforms black
                fontSize: { xs: 13, md: 18 },
                textShadow: "0 2px 8px rgba(0,0,0,0.10)",
                textTransform: "uppercase",
                ml: 0.5,
                display: { xs: "none", sm: "block" },
                whiteSpace: "nowrap",
              }}
            >
              King Uniforms
            </Typography>
          </Box>
          {/* Navigation bar rendering: add Process dropdown as submenu */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              gap: 1,
              alignItems: "center",
              flex: 1,
              justifyContent: "center",
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}
          >
            {navLinks
              .filter((l: any) => {
                // For drivers, only show shipping link
                if (user && user.role === "Driver") {
                  return l.page === "shipping" && l.visible;
                }
                // For other roles, use existing visibility logic
                return l.visible;
              })
              .map((link: any) =>
                link.subpages ? (
                  <Box key={link.page} sx={{ position: "relative" }}>
                    <Button
                      color={
                        link.subpages.some((sp: any) => sp.page === activePage)
                          ? "warning"
                          : "inherit"
                      }
                      startIcon={link.icon}
                      sx={{
                        fontWeight: 600,
                        color: link.subpages.some(
                          (sp: any) => sp.page === activePage
                        )
                          ? "var(--ku-yellow)"
                          : "#fff",
                        bgcolor: link.subpages.some(
                          (sp: any) => sp.page === activePage
                        )
                          ? "rgba(255,224,102,0.18)"
                          : "transparent",
                        borderRadius: 2,
                        px: 1.5,
                        fontSize: 13,
                        minWidth: 0,
                        boxShadow: link.subpages.some(
                          (sp: any) => sp.page === activePage
                        )
                          ? "0 2px 8px rgba(250,198,27,0.10)"
                          : "none",
                        borderBottom: link.subpages.some(
                          (sp: any) => sp.page === activePage
                        )
                          ? "2px solid var(--ku-yellow)"
                          : "2px solid transparent",
                        "&:hover": {
                          bgcolor: "var(--ku-yellow)",
                          color: "#222",
                        },
                        whiteSpace: "nowrap",
                      }}
                      onClick={(e) => setProcessMenuAnchorEl(e.currentTarget)}
                    >
                      {link.label}
                    </Button>
                    <Menu
                      anchorEl={processMenuAnchorEl}
                      open={
                        processMenuOpenState &&
                        processMenuAnchorEl &&
                        processMenuAnchorEl.textContent === link.label
                          ? true
                          : false
                      }
                      onClose={() => setProcessMenuAnchorEl(null)}
                      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                      transformOrigin={{ vertical: "top", horizontal: "left" }}
                      PaperProps={{
                        sx: {
                          minWidth: 200,
                          borderRadius: 2,
                          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                          p: 0,
                        },
                      }}
                    >
                      {link.subpages
                        .filter((sp: any) => sp.visible)
                        .map((sp: any) => (
                          <MenuItem
                            key={sp.page}
                            selected={activePage === sp.page}
                            onClick={() => {
                              setActivePage(sp.page as typeof activePage);
                              setProcessMenuAnchorEl(null);
                            }}
                            sx={{
                              fontWeight: 600,
                              fontSize: 15,
                              color:
                                activePage === sp.page
                                  ? "var(--ku-yellow)"
                                  : "#222",
                              bgcolor:
                                activePage === sp.page
                                  ? "rgba(255,224,102,0.18)"
                                  : "transparent",
                              borderBottom:
                                activePage === sp.page
                                  ? "2px solid var(--ku-yellow)"
                                  : "2px solid transparent",
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              "&:hover": {
                                bgcolor: "var(--ku-yellow)",
                                color: "#222",
                              },
                            }}
                          >
                            {sp.icon}
                            <span style={{ marginLeft: 12 }}>{sp.label}</span>
                          </MenuItem>
                        ))}
                    </Menu>
                  </Box>
                ) : (
                  <Button
                    key={link.page}
                    color={activePage === link.page ? "warning" : "inherit"}
                    startIcon={link.icon}
                    sx={{
                      fontWeight: 600,
                      color:
                        activePage === link.page ? "var(--ku-yellow)" : "#fff",
                      bgcolor:
                        activePage === link.page
                          ? "rgba(255,224,102,0.18)"
                          : "transparent",
                      borderRadius: 2,
                      px: 1.5,
                      fontSize: 13,
                      minWidth: 0,
                      boxShadow:
                        activePage === link.page
                          ? "0 2px 8px rgba(250,198,27,0.10)"
                          : "none",
                      borderBottom:
                        activePage === link.page
                          ? "2px solid var(--ku-yellow)"
                          : "2px solid transparent",
                      "&:hover": {
                        bgcolor: "var(--ku-yellow)",
                        color: "#222",
                      },
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => setActivePage(link.page)}
                  >
                    {link.label}
                  </Button>
                )
              )}
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexShrink: 0,
              justifyContent: { xs: "flex-end", md: "unset" },
              whiteSpace: "nowrap",
            }}
          >
            <Typography
              variant="body2"
              sx={{
                color: "#fff",
                mr: 1,
                display: { xs: "none", md: "block" },
                fontWeight: 500,
                letterSpacing: 0.5,
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              Hello, {user.username} ({user.role})
            </Typography>
            <IconButton
              color="inherit"
              onClick={logout}
              sx={{
                ml: 1,
                bgcolor: "rgba(255,255,255,0.10)",
                borderRadius: 2,
                width: 32,
                height: 32,
              }}
            >
              <LogoutIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box
          sx={{ width: 240 }}
          role="presentation"
          onClick={() => setDrawerOpen(false)}
        >
          <List>
            {navLinks
              .filter((l) => {
                // For drivers, only show shipping link
                if (user && user.role === "Driver") {
                  return l.page === "shipping" && l.visible;
                }
                // For other roles, use existing visibility logic
                return l.visible;
              })
              .map((link: any) =>
                link.subpages ? (
                  <React.Fragment key={link.page}>
                    <ListItem>
                      <ListItemText primary={link.label} />
                    </ListItem>
                    {link.subpages
                      .filter((sp: any) => sp.visible)
                      .map((sp: any) => (
                        <ListItem key={sp.page} disablePadding sx={{ pl: 3 }}>
                          <ListItemButton
                            selected={activePage === sp.page}
                            onClick={() =>
                              setActivePage(sp.page as typeof activePage)
                            }
                          >
                            <ListItemIcon>{sp.icon}</ListItemIcon>
                            <ListItemText primary={sp.label} />
                          </ListItemButton>
                        </ListItem>
                      ))}
                  </React.Fragment>
                ) : (
                  <ListItem key={link.page} disablePadding>
                    <ListItemButton
                      selected={activePage === link.page}
                      onClick={() => setActivePage(link.page)}
                    >
                      <ListItemIcon>{link.icon}</ListItemIcon>
                      <ListItemText primary={link.label} />
                    </ListItemButton>
                  </ListItem>
                )
              )}
            <ListItem disablePadding>
              <ListItemButton onClick={logout}>
                <ListItemIcon>
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>
      {/* Main content: only render components if user has permission */}
      {activePage === "home" && (
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
      {activePage === "reports" && <ReportsPage />}
      {activePage === "analytics" && <AnalyticsPage />}
      {activePage === "settings" && canManageUsers && (
        <>
          {/* Settings Nav Bar - always visible below main navbar */}
          <div style={{ height: 56 }} />
          {/* Spacer to push submenu below navbar */}
          <div
            className="mb-3"
            style={{
              marginTop: 0,
              marginBottom: 24,
              zIndex: 1,
              position: "relative",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              className="mb-3"
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 16,
                justifyContent: "center",
                alignItems: "center",
                maxWidth: 600,
                width: "100%",
              }}
            >
              <button
                className={`btn${
                  activeSettingsTab === "clients"
                    ? " btn-primary"
                    : " btn-outline-primary"
                }`}
                onClick={() => setActiveSettingsTab("clients")}
                style={{
                  minWidth: 120,
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 16,
                  boxShadow:
                    activeSettingsTab === "clients"
                      ? "0 2px 8px rgba(14,98,160,0.08)"
                      : "none",
                  background:
                    activeSettingsTab === "clients" ? "var(--ku-blue)" : "#fff",
                  color: activeSettingsTab === "clients" ? "#fff" : "#0E62A0",
                  border: "2px solid var(--ku-blue)",
                  transition: "all 0.2s",
                }}
              >
                Clients
              </button>
              <button
                className={`btn${
                  activeSettingsTab === "products"
                    ? " btn-primary"
                    : " btn-outline-primary"
                }`}
                onClick={() => setActiveSettingsTab("products")}
                style={{
                  minWidth: 120,
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 16,
                  boxShadow:
                    activeSettingsTab === "products"
                      ? "0 2px 8px rgba(14,98,160,0.08)"
                      : "none",
                  background:
                    activeSettingsTab === "products"
                      ? "var(--ku-blue)"
                      : "#fff",
                  color: activeSettingsTab === "products" ? "#fff" : "#0E62A0",
                  border: "2px solid var(--ku-blue)",
                  transition: "all 0.2s",
                }}
              >
                Products
              </button>
              <button
                className={`btn${
                  activeSettingsTab === "drivers"
                    ? " btn-primary"
                    : " btn-outline-primary"
                }`}
                onClick={() => setActiveSettingsTab("drivers")}
                style={{
                  minWidth: 120,
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 16,
                  boxShadow:
                    activeSettingsTab === "drivers"
                      ? "0 2px 8px rgba(14,98,160,0.08)"
                      : "none",
                  background:
                    activeSettingsTab === "drivers" ? "var(--ku-blue)" : "#fff",
                  color: activeSettingsTab === "drivers" ? "#fff" : "#0E62A0",
                  border: "2px solid var(--ku-blue)",
                  transition: "all 0.2s",
                }}
              >
                Choferes
              </button>
              <button
                className={`btn${
                  activeSettingsTab === "users"
                    ? " btn-primary"
                    : " btn-outline-primary"
                }`}
                onClick={() => setActiveSettingsTab("users")}
                style={{
                  minWidth: 120,
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 16,
                  boxShadow:
                    activeSettingsTab === "users"
                      ? "0 2px 8px rgba(14,98,160,0.08)"
                      : "none",
                  background:
                    activeSettingsTab === "users" ? "var(--ku-blue)" : "#fff",
                  color: activeSettingsTab === "users" ? "#fff" : "#0E62A0",
                  border: "2px solid var(--ku-blue)",
                  transition: "all 0.2s",
                }}
              >
                Users
              </button>
              <button
                className={`btn${
                  activeSettingsTab === "loginContent"
                    ? " btn-primary"
                    : " btn-outline-primary"
                }`}
                onClick={() => setActiveSettingsTab("loginContent")}
                style={{
                  minWidth: 120,
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 16,
                  boxShadow:
                    activeSettingsTab === "loginContent"
                      ? "0 2px 8px rgba(14,98,160,0.08)"
                      : "none",
                  background:
                    activeSettingsTab === "loginContent"
                      ? "var(--ku-blue)"
                      : "#fff",
                  color:
                    activeSettingsTab === "loginContent" ? "#fff" : "#0E62A0",
                  border: "2px solid var(--ku-blue)",
                  transition: "all 0.2s",
                }}
              >
                Login Content
              </button>
              <button
                className={`btn${
                  activeSettingsTab === "printing"
                    ? " btn-primary"
                    : " btn-outline-primary"
                }`}
                onClick={() => setActiveSettingsTab("printing")}
                style={{
                  minWidth: 120,
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 16,
                  boxShadow:
                    activeSettingsTab === "printing"
                      ? "0 2px 8px rgba(14,98,160,0.08)"
                      : "none",
                  background:
                    activeSettingsTab === "printing"
                      ? "var(--ku-blue)"
                      : "#fff",
                  color: activeSettingsTab === "printing" ? "#fff" : "#0E62A0",
                  border: "2px solid var(--ku-blue)",
                  transition: "all 0.2s",
                }}
              >
                🖨️ Printing
              </button>
              <button
                className={`btn${
                  activeSettingsTab === "rutas"
                    ? " btn-primary"
                    : " btn-outline-primary"
                }`}
                onClick={() => setActiveSettingsTab("rutas")}
                style={{
                  minWidth: 120,
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontWeight: 600,
                  fontSize: 16,
                  boxShadow:
                    activeSettingsTab === "rutas"
                      ? "0 2px 8px rgba(14,98,160,0.08)"
                      : "none",
                  background:
                    activeSettingsTab === "rutas" ? "var(--ku-blue)" : "#fff",
                  color: activeSettingsTab === "rutas" ? "#fff" : "#0E62A0",
                  border: "2px solid var(--ku-blue)",
                  transition: "all 0.2s",
                }}
              >
                Rutas de Camiones
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
            {activeSettingsTab === "loginContent" && (
              <div className="col-md-12">
                <div className="card p-4 mb-4">
                  <h3 className="mb-3">Login Page Side Content</h3>
                  <div className="mb-3">
                    <label className="form-label">
                      Announcements / Message
                    </label>
                    <textarea
                      className="form-control"
                      rows={6}
                      value={announcements}
                      onChange={(e) => setAnnouncements(e.target.value)}
                      placeholder="Enter announcements, birthdays, or any message to show on the login page...\nYou can use *markdown* for formatting, including bold, italics, lists, and links."
                    />
                    <div className="form-text">
                      <b>Formatting tips:</b> You can use{" "}
                      <a
                        href="https://www.markdownguide.org/basic-syntax/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Markdown
                      </a>{" "}
                      for bold, italics, lists, and links.
                      <br />
                      Example: <code>*Important*</code>, <code>**Bold**</code>,{" "}
                      <code>- List item</code>,{" "}
                      <code>[Link](https://example.com)</code>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Image (URL)</label>
                    <input
                      className="form-control"
                      type="text"
                      value={announcementImage || ""}
                      onChange={(e) => setAnnouncementImage(e.target.value)}
                      placeholder="Paste image URL for birthdays, etc."
                    />
                  </div>
                  {announcementImage && (
                    <div className="mb-3">
                      <img
                        src={announcementImage}
                        alt="Announcement"
                        style={{ maxWidth: 300, borderRadius: 8 }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeSettingsTab === "printing" && (
              <div className="col-md-12">
                <PrintingSettings />
              </div>
            )}
            {activeSettingsTab === "rutas" && (
              <div className="col-md-12">
                {/* Rutas de Camiones UI */}
                <RutasPorCamion />
              </div>
            )}
          </div>
        </>
      )}
      {activePage === "home" && (
        <div className="container py-5">
          {/* Removed Total Pounds Entered Today widget */}
          <ManualConventionalProductsWidget />
          {/* <PendingProductsWidget /> */}
          <div className="row justify-content-center g-4">
            {homePages
              .filter(
                (p) => {
                  // For drivers, only show shipping card
                  if (user && user.role === "Driver") {
                    return p.page === "shipping";
                  }
                  // For other roles, use existing filter logic
                  return navLinks.find((l) => l.page === p.page && l.visible) &&
                    p.page !== "reports" &&
                    p.page !== "settings";
                }
              )
              .map((p) => (
                <div
                  key={p.page}
                  className="col-12 col-sm-6 col-md-4 col-lg-3 d-flex align-items-stretch"
                >
                  <div
                    className="card shadow text-center w-100 home-page-card"
                    style={{
                      border: `2.5px solid ${p.color}`,
                      borderRadius: 18,
                      padding: "2.5rem 1.5rem",
                      cursor: "pointer",
                      transition: "box-shadow 0.18s, transform 0.18s",
                      boxShadow: "0 4px 24px rgba(14,98,160,0.10)",
                      background: "#fff",
                      minHeight: 180,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onClick={() => setActivePage(p.page as typeof activePage)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        setActivePage(p.page as typeof activePage);
                    }}
                  >
                    <div style={{ marginBottom: 18 }}>{p.icon}</div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 22,
                        color: p.color,
                        letterSpacing: 1,
                      }}
                    >
                      {p.label}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
      {/* Removed rendering for activePage === "rutasPorCamion" */}
      {activePage === "home" && (
        <div className="home-page">
          {/* Removed 'Welcome to the App' and instructions text */}
        </div>
      )}
      {activePage === "settings" && (
        <div className="settings-page">
          <h2>Settings</h2>
          {/* Add settings content here */}
        </div>
      )}
      {activePage === "billing" && canSee("BillingPage") && <BillingPage />}
      {activePage === "activityLog" && canSee("GlobalActivityLog") && (
        <div className="container py-5">
          <div className="row justify-content-center">
            <div className="col-12 col-md-10 col-lg-8">
              <GlobalActivityLog />
            </div>
          </div>
        </div>
      )}
      {activePage === "shipping" && canSee("ShippingPage") && (
        <div className="container py-5">
          <div className="row justify-content-center">
            <div className="col-12">
              <ShippingPage />
            </div>
          </div>
        </div>
      )}
      <Routes>
        <Route path="/send-invoice" element={<SendInvoicePage />} />
      </Routes>
    </Router>
  );
}

export default App;
