import { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  getUsers,
  type UserRecord 
} from '../services/firebaseService';
import type { Client, Product, Invoice } from '../types';

export interface AppState {
  // Data state
  products: Product[];
  clients: Client[];
  invoices: Invoice[];
  users: UserRecord[];
  drivers: { id: string; name: string }[];
  
  // UI state
  activePage: "home" | "entradas" | "washing" | "segregation" | "settings" | "reports" | "analytics" | "comprehensiveAnalytics" | "dailyProductAnalytics" | "predictionSchedule" | "productionClassification" | "billing" | "activityLog" | "realTimeActivity" | "shipping" | "deliveredInvoices" | "realTimeOperations";
  showClientForm: boolean;
  showWelcome: boolean;
  selectedInvoiceId: string | null;
  menuOpen: boolean;
  todayTotalLbs: number;
  drawerOpen: boolean;
  showSuggestionsPanel: boolean;
  activeSettingsTab: "clients" | "products" | "users" | "drivers" | "loginContent" | "rutas" | "printing" | "notifications";
  processMenuOpen: string | null;
  processMenuAnchorEl: HTMLElement | null;
  
  // Announcement state
  announcements: string;
  announcementImage: string | null;
}

export interface AppActions {
  setProducts: (products: Product[]) => void;
  setClients: (clients: Client[]) => void;
  setInvoices: (invoices: Invoice[]) => void;
  setUsers: (users: UserRecord[]) => void;
  setDrivers: (drivers: { id: string; name: string }[]) => void;
  setActivePage: (page: AppState['activePage']) => void;
  setShowClientForm: (show: boolean) => void;
  setShowWelcome: (show: boolean) => void;
  setSelectedInvoiceId: (id: string | null) => void;
  setMenuOpen: (open: boolean) => void;
  setTodayTotalLbs: (lbs: number) => void;
  setDrawerOpen: (open: boolean) => void;
  setShowSuggestionsPanel: (show: boolean) => void;
  setActiveSettingsTab: (tab: AppState['activeSettingsTab']) => void;
  setProcessMenuOpen: (menu: string | null) => void;
  setProcessMenuAnchorEl: (el: HTMLElement | null) => void;
  setAnnouncements: (announcements: string) => void;
  setAnnouncementImage: (image: string | null) => void;
}

/**
 * Custom hook for managing the main application state
 * Centralizes all state management and real-time listeners
 */
export const useAppState = (): AppState & AppActions => {
  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]);
  
  // UI state
  const [activePage, setActivePage] = useState<AppState['activePage']>("home");
  const [showClientForm, setShowClientForm] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [todayTotalLbs, setTodayTotalLbs] = useState<number>(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<AppState['activeSettingsTab']>("clients");
  const [processMenuOpen, setProcessMenuOpen] = useState<string | null>(null);
  const [processMenuAnchorEl, setProcessMenuAnchorEl] = useState<HTMLElement | null>(null);
  
  // Announcement state
  const [announcements, setAnnouncements] = useState<string>(
    localStorage.getItem("loginAnnouncements") || ""
  );
  const [announcementImage, setAnnouncementImage] = useState<string | null>(
    localStorage.getItem("loginAnnouncementImage") || null
  );

  // Real-time Firestore listeners for invoices, products, and clients
  useEffect(() => {
    console.log('Setting up real-time listeners...');
    
    // Invoices listener
    const unsubInvoices = onSnapshot(collection(db, "invoices"), (snapshot) => {
      const invoicesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInvoices(invoicesData as Invoice[]);
    });

    // Products listener
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const productsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productsData as Product[]);
    });

    // Clients listener
    const unsubClients = onSnapshot(collection(db, "clients"), (snapshot) => {
      const clientsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setClients(clientsData as Client[]);
    });

    // Drivers listener
    const unsubDrivers = onSnapshot(collection(db, "drivers"), (snapshot) => {
      const driversData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDrivers(driversData as { id: string; name: string }[]);
    });

    return () => {
      unsubInvoices();
      unsubProducts();
      unsubClients();
      unsubDrivers();
    };
  }, []);

  // Load users data
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const fetchedUsers = await getUsers();
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    fetchUsers();
  }, []);

  // Save announcements to localStorage
  useEffect(() => {
    localStorage.setItem("loginAnnouncements", announcements);
    if (announcementImage) {
      localStorage.setItem("loginAnnouncementImage", announcementImage);
    }
  }, [announcements, announcementImage]);

  return {
    // Data state
    products,
    clients,
    invoices,
    users,
    drivers,
    
    // UI state
    activePage,
    showClientForm,
    showWelcome,
    selectedInvoiceId,
    menuOpen,
    todayTotalLbs,
    drawerOpen,
    showSuggestionsPanel,
    activeSettingsTab,
    processMenuOpen,
    processMenuAnchorEl,
    
    // Announcement state
    announcements,
    announcementImage,
    
    // Actions
    setProducts,
    setClients,
    setInvoices,
    setUsers,
    setDrivers,
    setActivePage,
    setShowClientForm,
    setShowWelcome,
    setSelectedInvoiceId,
    setMenuOpen,
    setTodayTotalLbs,
    setDrawerOpen,
    setShowSuggestionsPanel,
    setActiveSettingsTab,
    setProcessMenuOpen,
    setProcessMenuAnchorEl,
    setAnnouncements,
    setAnnouncementImage,
  };
}; 