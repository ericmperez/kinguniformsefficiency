import React, { useState, useEffect } from "react";
import { getClients } from "../services/firebaseService";
import { doc, updateDoc, addDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import type { Client, Product } from "../types";
import { addManualConventionalProduct } from "../services/firebaseService";
import { getManualConventionalProductsForDate } from "../services/firebaseService";
import { logActivity } from "../services/firebaseService";
import { useAuth } from "./AuthContext";
import FlipMove from "react-flip-move";
import { hardwareService, CartCountdownEvent } from '../services/hardwareService';

interface WashingProps {
  setSelectedInvoiceId?: (id: string | null) => void;
}

const Washing: React.FC<WashingProps> = ({ setSelectedInvoiceId }) => {
  const [activeTab, setActiveTab] = useState<"tunnel" | "conventional">(
    "tunnel"
  );
  const [groups, setGroups] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTunnelGroup, setSelectedTunnelGroup] = useState<any | null>(
    null
  );
  const [tunnelCartInput, setTunnelCartInput] = useState("");
  const [tunnelCartError, setTunnelCartError] = useState("");

  // --- Alert Banner State ---
  const [alertMessage, setAlertMessage] = useState("");
  const [isEditingAlert, setIsEditingAlert] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [loadingAlert, setLoadingAlert] = useState(true);

  // Per-group state for verification and cart counting
  const [verifiedGroups, setVerifiedGroups] = useState<{
    [groupId: string]: boolean;
  }>({});
  const [cartCounters, setCartCounters] = useState<{
    [groupId: string]: number;
  }>({});
  const [pickupEntries, setPickupEntries] = useState<any[]>([]); // <-- NEW

  // Modal state for adding conventional clients/products
  const [showAddConventionalModal, setShowAddConventionalModal] =
    useState(false);
  const [selectedConventionalClientId, setSelectedConventionalClientId] =
    useState("");
  const [selectedConventionalCartId, setSelectedConventionalCartId] =
    useState("");
  const [selectedConventionalProductId, setSelectedConventionalProductId] =
    useState("");
  const [conventionalProductQty, setConventionalProductQty] = useState(1);
  const [conventionalModalError, setConventionalModalError] = useState("");
  const [conventionalModalLoading, setConventionalModalLoading] =
    useState(false);
  const [conventionalModalCarts, setConventionalModalCarts] = useState<any[]>(
    []
  );
  const [conventionalAddMode, setConventionalAddMode] = useState<
    "cart" | "quantity" | "pounds"
  >("cart");

  // State for manual conventional products
  const [manualConventionalProducts, setManualConventionalProducts] = useState<
    any[]
  >([]);
  const [manualProductsLoading, setManualProductsLoading] = useState(true);

  // Special item confirmation state
  const [showSpecialItemModal, setShowSpecialItemModal] = useState(false);
  const [selectedSpecialItem, setSelectedSpecialItem] = useState<any>(null);
  const [specialItemCategory, setSpecialItemCategory] = useState<'blanket' | 'colcha' | 'uniform' | 'other'>('other');
  const [skipReason, setSkipReason] = useState("");
  const [pendingSpecialItems, setPendingSpecialItems] = useState<any[]>([]);
  const [skippedSpecialItems, setSkippedSpecialItems] = useState<any[]>([]);

  // Red alert overlay state for tunnel cart count mismatch
  const [showTunnelRedAlert, setShowTunnelRedAlert] = useState(false);
  const tunnelRedAlertTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // New state for per-group verification mode
  const [verifyingGroupIds, setVerifyingGroupIds] = useState<{
    [groupId: string]: boolean;
  }>({});

  // New state for tunnel messages
  const [tunnelMessages, setTunnelMessages] = useState<{
    [groupId: string]: string;
  }>({});
  const [tunnelMessageInputs, setTunnelMessageInputs] = useState<{
    [groupId: string]: string;
  }>({});
  const [tunnelMessageLoading, setTunnelMessageLoading] = useState<{
    [groupId: string]: boolean;
  }>({});
  const [tunnelMessageSaved, setTunnelMessageSaved] = useState<{
    [groupId: string]: boolean;
  }>({});
  const [tunnelMessageVerifiedBy, setTunnelMessageVerifiedBy] = useState<{
    [groupId: string]: Array<{ id: string; name: string }>;
  }>({});

  // State for editing segregated cart values
  const [editingSegregatedCarts, setEditingSegregatedCarts] = useState<{
    [groupId: string]: boolean;
  }>({});
  const [segregatedCartsInput, setSegregatedCartsInput] = useState<{
    [groupId: string]: string;
  }>({});

  // State for priority flags in conventional list
  const [priorityFlags, setPriorityFlags] = useState<{
    [groupId: string]: boolean;
  }>({});
  const [priorityLoading, setPriorityLoading] = useState<{
    [groupId: string]: boolean;
  }>({});

  const { user } = useAuth();
  
  // Helper to get current user (from localStorage or context)
  const getCurrentUser = () => {
    try {
      // First try to get from auth context if available
      if (user && user.username) {
        return user.username;
      }
      
      // Fallback to localStorage with correct key
      const authUserStr = localStorage.getItem("auth_user");
      if (authUserStr) {
        const authUser = JSON.parse(authUserStr);
        if (authUser && authUser.username) {
          return authUser.username;
        }
      }
    } catch (error) {
      console.error("Error getting current user:", error);
    }
    return "Unknown";
  };
  
  const canReorder =
    user && ["Supervisor", "Admin", "Owner"].includes(user.role);

  // Check if user can edit the alert banner
  const canEdit = user && ["Supervisor", "Admin", "Owner"].includes(user.role);

  // Fetch alert message from Firestore
  useEffect(() => {
    async function fetchAlert() {
      setLoadingAlert(true);
      try {
        const docRef = doc(db, "app_config", "alert_banner");
        const snap = await getDoc(docRef);
        const alertData = snap.exists() ? snap.data().message || "" : "";
        console.log("Fetched alert message:", alertData);
        setAlertMessage(alertData);
      } catch (error) {
        console.error("Error fetching alert:", error);
        setAlertMessage("");
      }
      setLoadingAlert(false);
    }
    fetchAlert();
  }, []);

  // Handle editing the alert
  const handleStartEditing = () => {
    setIsEditingAlert(true);
    setEditValue(alertMessage);
  };
  
  // Handle canceling the edit
  const handleCancelEdit = () => {
    setIsEditingAlert(false);
  };
  
  // Save alert message to Firestore
  const handleSaveAlert = async () => {
    setLoadingAlert(true);
    try {
      const docRef = doc(db, "app_config", "alert_banner");
      await setDoc(docRef, { message: editValue || "" }, { merge: true });
      setAlertMessage(editValue || "");
      setIsEditingAlert(false);
      alert("Alert banner updated successfully");
    } catch (error) {
      console.error("Error saving alert:", error);
      alert("Error saving alert message");
    }
    setLoadingAlert(false);
  };

  useEffect(() => {
    setLoading(true);
    // Load ALL pickup_groups (no date filter)
    const q = collection(db, "pickup_groups");
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startTime:
            data.startTime instanceof Timestamp
              ? data.startTime.toDate()
              : new Date(data.startTime),
          endTime:
            data.endTime instanceof Timestamp
              ? data.endTime.toDate()
              : new Date(data.endTime),
        };
      });
      setGroups(fetched);
      setLoading(false);
    });
    return () => unsub();
  }, []);
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const fetchedClients = await getClients();
      setClients(fetchedClients);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Fetch today's pickup entries for cart counting in Conventional tab
  useEffect(() => {
    // Get today's date range in local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const q = query(
      collection(db, "pickup_entries"),
      where("timestamp", ">=", Timestamp.fromDate(today)),
      where("timestamp", "<", Timestamp.fromDate(tomorrow))
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp:
            data.timestamp instanceof Timestamp
              ? data.timestamp.toDate()
              : new Date(data.timestamp),
        };
      });
      setPickupEntries(fetched);
    });
    return () => unsub();
  }, []);

  // Fetch products for modal
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await import("../services/firebaseService");
        if (res.getProducts) {
          const prods = await res.getProducts();
          setProducts(prods);
        }
      } catch (e) {
        setProducts([]);
      }
    };
    fetchProducts();
  }, []);

  // Helper to get client segregation and washing type
  const getClient = (clientId: string) =>
    clients.find((c) => c.id === clientId);
  const getSegregatedCarts = (group: any) => {
    const client = getClient(group.clientId);
    if (
      client &&
      client.segregation === false &&
      client.washingType === "Tunnel"
    ) {
      // Always use segregatedCarts if present, otherwise fallback to carts length/number
      if (typeof group.segregatedCarts === "number")
        return group.segregatedCarts;
      if (Array.isArray(group.carts)) return group.carts.length;
      if (typeof group.carts === "number") return group.carts;
      return 0;
    }
    // If segregatedCarts is null or undefined, fallback to 0
    return typeof group.segregatedCarts === "number"
      ? group.segregatedCarts
      : 0;
  };
  // Helper to get client washing type
  const getWashingType = (clientId: string) => getClient(clientId)?.washingType;

  // Only show groups with status 'Tunnel' and not 'Entregado' in Tunnel tab
  // Show ALL Tunnel groups regardless of date or delivery status
  const tunnelGroups = groups
    .filter(
      (g) => g.status === "Tunnel" && getWashingType(g.clientId) === "Tunnel"
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); // Always sort by order for smooth UI
  // Only show groups with status 'Conventional' and not 'Entregado' in Conventional tab
  const conventionalGroups = groups
    .filter((g) => g.status === "Conventional" && g.status !== "Entregado")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); // Sort by order property

  const manualProductGroups = manualConventionalProducts
    .filter((p) => !p.invoiceId)
    .map((p, idx) => ({
      ...p,
      isManualProduct: true,
      order: p.order ?? conventionalGroups.length + idx,
    }));

  // Merge and sort both lists
  const allConventionalRows = [
    ...conventionalGroups.map((g) => ({ ...g, isManualProduct: false })),
    ...manualProductGroups,
  ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Helper: count carts for a group from pickup entries
  const getConventionalCartCount = (groupId: string) =>
    pickupEntries.filter((e) => e.groupId === groupId).length;

  // Load verification and counter state from Firestore on mount and when tunnelGroups change
  useEffect(() => {
    // Build new state objects from tunnelGroups
    const newVerifiedGroups: { [groupId: string]: boolean } = {};
    const newCartCounters: { [groupId: string]: number } = {};
    tunnelGroups.forEach((group) => {
      if (group.tunnelVerified) {
        newVerifiedGroups[group.id] = true;
      }
      if (typeof group.tunnelCartCount === "number") {
        newCartCounters[group.id] = group.tunnelCartCount;
      }
    });
    // Only update state if changed (prevents UI from being stuck)
    setVerifiedGroups((prev) => {
      let changed = false;
      for (const key in newVerifiedGroups) {
        if (prev[key] !== newVerifiedGroups[key]) changed = true;
      }
      for (const key in prev) {
        if (!(key in newVerifiedGroups)) changed = true;
      }
      return changed ? newVerifiedGroups : prev;
    });
    setCartCounters((prev) => {
      let changed = false;
      for (const key in newCartCounters) {
        if (prev[key] !== newCartCounters[key]) changed = true;
      }
      for (const key in prev) {
        if (!(key in newCartCounters)) changed = true;
      }
      return changed ? newCartCounters : prev;
    });
  }, [tunnelGroups]);

  // Set group status to 'Tunnel' or 'Conventional' when they appear in the respective tab
  useEffect(() => {
    if (!loading) {
      tunnelGroups.forEach((group) => {
        if (group.status !== "Tunnel") {
          import("../services/firebaseService").then(
            ({ updatePickupGroupStatus }) => {
              updatePickupGroupStatus(group.id, "Tunnel");
            }
          );
        }
      });
      conventionalGroups.forEach((group) => {
        if (group.status !== "Conventional") {
          import("../services/firebaseService").then(
            ({ updatePickupGroupStatus }) => {
              updatePickupGroupStatus(group.id, "Conventional");
            }
          );
        }
      });
    }
    // eslint-disable-next-line
  }, [loading, tunnelGroups.length, conventionalGroups.length]);

  // Helper: get clients not already in a conventional group today
  const clientsForConventional = clients;

  // Helper: get carts for a group
  const getGroupCarts = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    return group && Array.isArray(group.carts) ? group.carts : [];
  };

  // Add/Update product in cart for a group
  const handleAddConventionalProduct = async () => {
    setConventionalModalError("");
    setConventionalModalLoading(true);
    try {
      if (
        !selectedConventionalClientId ||
        !selectedConventionalProductId ||
        conventionalProductQty < 1
      ) {
        setConventionalModalError(
          "Please select all fields and enter a valid quantity."
        );
        setConventionalModalLoading(false);
        return;
      }
      // Find client and product
      const client = clients.find((c) => c.id === selectedConventionalClientId);
      const product = products.find(
        (p) => p.id === selectedConventionalProductId
      );
      if (!client) throw new Error("Client not found");
      if (!product) throw new Error("Product not found");
      
      // Check if this is a special item that requires confirmation
      const isSpecial = isSpecialItem(product.name);
      const category = getSpecialItemCategory(product.name);
      
      // If it's a special item, create a manual conventional product entry
      if (isSpecial) {
        const { addManualConventionalProduct } = await import("../services/firebaseService");
        
        await addManualConventionalProduct({
          clientId: client.id,
          clientName: client.name,
          productId: product.id,
          productName: product.name,
          quantity: conventionalProductQty,
          type: conventionalAddMode === "cart" ? "cart" : conventionalAddMode === "quantity" ? "qty" : "lbs",
          isSpecialItem: true,
          category,
          requiresConfirmation: true
        });
        
        await logActivity({
          type: "Special Item",
          message: `Special item '${product.name}' (${category}) added for client '${client.name}' by ${getCurrentUser()} - requires confirmation`,
          user: getCurrentUser(),
        });
        
        // Reset form
        setShowAddConventionalModal(false);
        setSelectedConventionalClientId("");
        setSelectedConventionalCartId("");
        setSelectedConventionalProductId("");
        setConventionalProductQty(1);
        setConventionalModalError("");
        setConventionalModalLoading(false);
        
        alert(`Special item "${product.name}" has been added and will require confirmation before being included in invoices.`);
        return;
      }
      // Instead of manual product, create a new group for this client
      const { collection, addDoc, Timestamp } = await import(
        "firebase/firestore"
      );
      const { db } = await import("../firebase");
      // Build a cart with the product as an item
      // Try to get numCarts from the most recent group for this client, or fallback to 1
      const existingGroup = groups.find(
        (g) => g.clientId === client.id && typeof g.numCarts === "number"
      );
      const numCarts = existingGroup ? existingGroup.numCarts : 1;
      const cart = {
        id: Math.random().toString(36).slice(2), // local unique id
        name: `Cart ${numCarts}`,
        items: [
          {
            productId: product.id,
            productName: product.name,
            quantity: conventionalProductQty,
            type:
              conventionalAddMode === "cart"
                ? "cart"
                : conventionalAddMode === "quantity"
                ? "qty"
                : "lbs",
            addedAt: new Date().toISOString(),
          },
        ],
      };
      // Calculate the next order value to add to the bottom of conventional list
      const existingConventionalGroups = groups.filter((g) => g.status === "Conventional" && g.status !== "Entregado");
      const existingManualProducts = manualConventionalProducts.filter((p) => !p.invoiceId);
      
      // Find the maximum order value among all conventional items
      const maxGroupOrder = existingConventionalGroups.reduce((max, g) => 
        Math.max(max, g.order ?? -1), -1);
      const maxManualOrder = existingManualProducts.reduce((max, p) => 
        Math.max(max, p.order ?? -1), -1);
      const nextOrder = Math.max(maxGroupOrder, maxManualOrder) + 1;
      
      // Create the group with Conventional status and washingType
      await addDoc(collection(db, "pickup_groups"), {
        clientId: client.id,
        clientName: client.name,
        status: "Conventional",
        washingType: "Conventional", 
        carts: [cart],
        numCarts: numCarts,
        createdAt: Timestamp.now(),
        order: nextOrder, // add to end of all conventional items
      });
      setShowAddConventionalModal(false);
      setSelectedConventionalClientId("");
      setSelectedConventionalCartId("");
      setSelectedConventionalProductId("");
      setConventionalProductQty(1);
      setConventionalModalError("");
      setConventionalModalLoading(false);
      await logActivity({
        type: "Washing",
        message: `Conventional group with product '${product.name}' added for client '${client.name}' by ${getCurrentUser()}`,
        user: getCurrentUser(),
      });
    } catch (err: any) {
      setConventionalModalError(err.message || "Error adding product to group");
      setConventionalModalLoading(false);
    }
  };

  // --- Conventional Group Reordering ---
  // Ensure groups have an 'order' property for sorting - IMPROVED VERSION
  useEffect(() => {
    // If any conventional group is missing 'order', assign it the highest order + 1 to put at bottom
    const conventionalGroupsNeedingOrder = conventionalGroups.filter((g) => typeof g.order !== "number");
    
    if (conventionalGroupsNeedingOrder.length > 0) {
      // Process all groups needing order in a single batch to prevent race conditions
      const existingConventionalGroups = conventionalGroups.filter((g) => typeof g.order === "number");
      let nextOrder = existingConventionalGroups.reduce((max, g) => Math.max(max, g.order!), -1) + 1;
      
      // Batch update all groups that need order assignment
      const batchUpdates = conventionalGroupsNeedingOrder.map(async (group) => {
        const assignedOrder = nextOrder++;
        await updateDoc(doc(db, "pickup_groups", group.id), { order: assignedOrder });
        return { ...group, order: assignedOrder };
      });
      
      // Execute all updates and then update local state once
      Promise.all(batchUpdates).then((updatedGroups) => {
        setGroups((prev) => {
          return prev.map((g) => {
            const updated = updatedGroups.find(u => u.id === g.id);
            return updated ? { ...g, order: updated.order } : g;
          });
        });
      }).catch(console.error);
    }
    // eslint-disable-next-line
  }, [conventionalGroups.length, conventionalGroups.filter(g => typeof g.order !== "number").length]);

  // Ensure Tunnel groups have an 'order' property for sorting - IMPROVED VERSION
  useEffect(() => {
    const tunnelGroupsNeedingOrder = tunnelGroups.filter((g) => typeof g.order !== "number");
    
    if (tunnelGroupsNeedingOrder.length > 0) {
      // Process all groups needing order in a single batch to prevent race conditions
      const existingTunnelGroups = tunnelGroups.filter((g) => typeof g.order === "number");
      let nextOrder = existingTunnelGroups.reduce((max, g) => Math.max(max, g.order!), -1) + 1;
      
      // Batch update all groups with consecutive order values
      const batchUpdates = tunnelGroupsNeedingOrder.map(async (group) => {
        const assignedOrder = nextOrder++;
        await updateDoc(doc(db, "pickup_groups", group.id), { order: assignedOrder });
        return { ...group, order: assignedOrder };
      });
      
      // Execute all updates and then update local state once
      Promise.all(batchUpdates).then((updatedGroups) => {
        setGroups((prev) => {
          return prev.map((g) => {
            const updated = updatedGroups.find(u => u.id === g.id);
            return updated ? { ...g, order: updated.order } : g;
          });
        });
      }).catch(console.error);
    }
    // eslint-disable-next-line
  }, [tunnelGroups.length, tunnelGroups.filter(g => typeof g.order !== "number").length]);

  // Move group up/down in order
  const moveConventionalGroup = async (
    groupId: string,
    direction: "up" | "down"
  ) => {
    setGroups((prevGroups) => {
      const conventional = prevGroups.filter(
        (g) =>
          g.status === "Conventional" &&
          getWashingType(g.clientId) === "Conventional" &&
          g.status !== "Entregado"
      );
      const others = prevGroups.filter(
        (g) =>
          g.status !== "Conventional" ||
          getWashingType(g.clientId) !== "Conventional" ||
          g.status === "Entregado"
      );
      const sorted = [...conventional].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
      const idx = sorted.findIndex((g) => g.id === groupId);
      if (idx === -1) return prevGroups;
      let newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= sorted.length) return prevGroups;
      // Swap order values
      [sorted[idx], sorted[newIdx]] = [sorted[newIdx], sorted[idx]];
      // Re-assign order values to be consecutive
      sorted.forEach((g, i) => {
        g.order = i;
      });
      // Optimistically update UI
      const newGroups = [...others, ...sorted];
      // Persist order changes to Firestore in background
      (async () => {
        try {
          await Promise.all(
            sorted.map((g, i) =>
              updateDoc(doc(db, "pickup_groups", g.id), { order: i })
            )
          );
        } catch (e) {
          // Optionally handle error
        }
      })();
      return newGroups;
    });
  };

  const [tunnelReorderLoading, setTunnelReorderLoading] = useState<
    string | null
  >(null);

  // Helper function to normalize tunnel order values (ensure consecutive 0, 1, 2, ...)
  const normalizeTunnelOrders = async () => {
    const tunnelGroups = groups.filter(
      (g) => g.status === "Tunnel" && getWashingType(g.clientId) === "Tunnel"
    );
    
    if (tunnelGroups.length === 0) return;
    
    // Sort by current order, then by creation time for consistency
    const sorted = [...tunnelGroups].sort((a, b) => {
      if (typeof a.order === "number" && typeof b.order === "number") {
        return a.order - b.order;
      }
      if (typeof a.order === "number") return -1;
      if (typeof b.order === "number") return 1;
      // Both missing order, sort by creation time
      const timeA = a.startTime?.getTime?.() || 0;
      const timeB = b.startTime?.getTime?.() || 0;
      return timeA - timeB;
    });
    
    // Check if normalization is needed
    const needsNormalization = sorted.some((group, index) => group.order !== index);
    
    if (needsNormalization) {
      console.log("🔧 [TUNNEL ORDER] Normalizing tunnel group order values...");
      
      // Batch update all tunnel groups with consecutive order values
      const batchUpdates = sorted.map(async (group, index) => {
        if (group.order !== index) {
          await updateDoc(doc(db, "pickup_groups", group.id), { order: index });
          console.log(`   Updated ${group.clientName}: order ${group.order} → ${index}`);
        }
      });
      
      await Promise.all(batchUpdates);
      console.log("✅ [TUNNEL ORDER] Normalization complete");
    }
  };

  // Normalize tunnel orders when component loads and when tunnel groups change significantly
  useEffect(() => {
    if (!loading && tunnelGroups.length > 0) {
      // Add a small delay to ensure all groups are loaded
      setTimeout(() => normalizeTunnelOrders(), 1000);
    }
    // eslint-disable-next-line
  }, [loading]);

  // Ensure Tunnel groups have a unique, consecutive 'order' property after every move
  const normalizeTunnelOrdersInMemory = (groupsArr: any[]) => {
    const tunnel = groupsArr.filter(
      (g) => g.status === "Tunnel" && getWashingType(g.clientId) === "Tunnel"
    );
    const others = groupsArr.filter(
      (g) => g.status !== "Tunnel" || getWashingType(g.clientId) !== "Tunnel"
    );
    const sorted = [...tunnel].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    sorted.forEach((g, idx) => {
      g.order = idx;
    });
    return [...others, ...sorted];
  };
  // Move Tunnel group up/down in order (optimistic UI update)
  const moveTunnelGroup = async (groupId: string, direction: "up" | "down") => {
    const currentUser = getCurrentUser();
    
    // Get the group being moved and its position before the move
    const tunnel = groups.filter(
      (g) => g.status === "Tunnel" && getWashingType(g.clientId) === "Tunnel"
    );
    const sorted = [...tunnel].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const oldIndex = sorted.findIndex((g) => g.id === groupId);
    const newIndex = direction === "up" ? oldIndex - 1 : oldIndex + 1;
    
    if (oldIndex === -1 || newIndex < 0 || newIndex >= sorted.length) return;
    
    const group = sorted[oldIndex];
    const swapGroup = sorted[newIndex];
    
    console.log("🔄 [TUNNEL MOVE GROUP] ===================");
    console.log(`👤 Action performed by: ${currentUser}`);
    console.log(`📱 Moving: ${group?.clientName || groupId}`);
    console.log(`📍 From position: ${oldIndex + 1} → ${newIndex + 1}`);
    console.log(`⬆️⬇️ Direction: ${direction === "up" ? 'UP' : 'DOWN'}`);
    console.log(`🔄 Will swap with: ${swapGroup?.clientName || 'Unknown'}`);
    
    setTunnelReorderLoading(groupId);
    setGroups((prevGroups) => {
      const tunnel = prevGroups.filter(
        (g) => g.status === "Tunnel" && getWashingType(g.clientId) === "Tunnel"
      );
      const others = prevGroups.filter(
        (g) => g.status !== "Tunnel" || getWashingType(g.clientId) !== "Tunnel"
      );
      const sorted = [...tunnel].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
      const idx = sorted.findIndex((g) => g.id === groupId);
      if (idx === -1) return prevGroups;
      let newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= sorted.length) return prevGroups;
      // Swap order values
      [sorted[idx], sorted[newIdx]] = [sorted[newIdx], sorted[idx]];
      // Re-assign order values to be consecutive
      sorted.forEach((g, i) => {
        g.order = i;
      });
      // Optimistically update UI
      const newGroups = [...others, ...sorted];
      // Persist order changes to Firestore in background
      (async () => {
        try {
          await Promise.all(
            sorted.map((g, i) =>
              updateDoc(doc(db, "pickup_groups", g.id), { order: i })
            )
          );
          
          // Enhanced activity logging with user information
          await logActivity({
            type: "Tunnel",
            message: `Group "${group?.clientName || groupId}" moved ${
              direction === "up" ? "up" : "down"
            } by ${currentUser} from position ${oldIndex + 1} to ${newIndex + 1} (swapped with "${swapGroup?.clientName || 'unknown'}")`,
            user: currentUser,
          });
          
          console.log("📝 [ACTIVITY LOGGED] Tunnel move operation saved to Firestore activity log");
          console.log("✅ Move completed successfully");
          console.log("🔄 [END TUNNEL MOVE GROUP] ==============");
        } catch (e) {
          console.error("Error in tunnel group move:", e);
        }
        setTunnelReorderLoading(null);
      })();
      return newGroups;
    });
  };

  // Move up/down for both manual products and client groups
  const moveConventionalRow = async (id: string, direction: "up" | "down") => {
    const currentUser = getCurrentUser();
    
    // Build a combined list of all conventional rows (client groups + manual products)
    const allRows = [
      ...conventionalGroups.map((g) => ({ ...g, isManualProduct: false })),
      ...manualConventionalProducts
        .filter((p) => !p.invoiceId)
        .map((p) => ({ ...p, isManualProduct: true })),
    ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = allRows.findIndex((row) => row.id === id);
    if (idx === -1) return;
    let newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= allRows.length) return;
    
    const movingItem = allRows[idx];
    const swapItem = allRows[newIdx];
    
    console.log("🔄 [CONVENTIONAL MOVE] ===================");
    console.log(`👤 Action performed by: ${currentUser}`);
    console.log(`📱 Moving: ${movingItem?.clientName || movingItem?.productName || id}`);
    console.log(`📍 From position: ${idx + 1} → ${newIdx + 1}`);
    console.log(`⬆️⬇️ Direction: ${direction === "up" ? 'UP' : 'DOWN'}`);
    console.log(`🏷️ Type: ${movingItem?.isManualProduct ? 'Manual Product' : 'Client Group'}`);
    console.log(`🔄 Will swap with: ${swapItem?.clientName || swapItem?.productName || 'Unknown'}`);
    
    // Swap order values
    [allRows[idx], allRows[newIdx]] = [allRows[newIdx], allRows[idx]];
    // Re-assign order values to be consecutive
    allRows.forEach((row, i) => {
      row.order = i;
    });
    // Persist order changes to Firestore for both types
    const updates = allRows.map((row) => {
      if (row.isManualProduct) {
        // Manual product
        return updateDoc(doc(db, "manual_conventional_products", row.id), {
          order: row.order,
        });
      } else {
        // Client group
        return updateDoc(doc(db, "pickup_groups", row.id), {
          order: row.order,
        });
      }
    });
    await Promise.all(updates);
    
    // Enhanced activity logging with user information
    await logActivity({
      type: "Conventional",
      message: `${movingItem?.isManualProduct ? 'Manual product' : 'Group'} "${movingItem?.clientName || movingItem?.productName || id}" moved ${
        direction === "up" ? "up" : "down"
      } by ${currentUser} from position ${idx + 1} to ${newIdx + 1} (swapped with "${swapItem?.clientName || swapItem?.productName || 'unknown'}")`,
      user: currentUser,
    });
    
    console.log("📝 [ACTIVITY LOGGED] Conventional move operation saved to Firestore activity log");
    console.log("✅ Move completed successfully");
    console.log("🔄 [END CONVENTIONAL MOVE] ==============");
    
    // Update local state
    setManualConventionalProducts((prev) =>
      prev.map((p) => {
        const updated = allRows.find(
          (row) => row.id === p.id && row.isManualProduct
        );
        return updated ? { ...p, order: updated.order } : p;
      })
    );
    setGroups((prev) =>
      prev.map((g) => {
        const updated = allRows.find(
          (row) => row.id === g.id && !row.isManualProduct
        );
        return updated ? { ...g, order: updated.order } : g;
      })
    );
  };

  // Delete a conventional group instantly and update UI immediately
  const handleDeleteConventionalGroup = async (groupId: string) => {
    // Optimistically update UI
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    try {
      await updateDoc(doc(db, "pickup_groups", groupId), { status: "deleted" });
    } catch (e) {
      // Optionally, show error and revert UI if needed
      // For now, do nothing (UI stays in sync with Firestore on next snapshot)
    }
  };

  // Delete manual product
  const handleDeleteManualProductGroup = async (id: string) => {
    if (!window.confirm("Delete this manual product?")) return;
    try {
      const { deleteDoc, doc } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      await deleteDoc(doc(db, "manual_conventional_products", id));
      setManualConventionalProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert("Error deleting manual product");
    }
  };

  // Fetch manual conventional products for today
  useEffect(() => {
    let mounted = true;
    getManualConventionalProductsForDate(new Date()).then((products) => {
      if (mounted) {
        setManualConventionalProducts(products.filter((p: any) => !p.washed));
        setManualProductsLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch pending special items that need confirmation
  useEffect(() => {
    let mounted = true;
    
    const fetchSpecialItems = async () => {
      try {
        const { getPendingSpecialItems, getSkippedSpecialItems } = await import("../services/firebaseService");
        const [pending, skipped] = await Promise.all([
          getPendingSpecialItems(),
          getSkippedSpecialItems()
        ]);
        
        if (mounted) {
          setPendingSpecialItems(pending);
          setSkippedSpecialItems(skipped);
        }
      } catch (error) {
        console.error("Error fetching special items:", error);
      }
    };

    fetchSpecialItems();
    
    // Refresh every 30 seconds to check for new special items
    const interval = setInterval(fetchSpecialItems, 30000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Handler to confirm a special item for invoice inclusion
  const handleConfirmSpecialItem = async (item: any) => {
    try {
      const { confirmSpecialItem } = await import("../services/firebaseService");
      
      await confirmSpecialItem(item.id, getCurrentUser());
      
      // Update local state
      setPendingSpecialItems(prev => prev.filter(p => p.id !== item.id));
      
      await logActivity({
        type: "Special Item",
        message: `Special item "${item.productName}" for ${item.clientName} confirmed for invoice inclusion by ${getCurrentUser()}`,
        user: getCurrentUser(),
      });
      
      alert(`Special item "${item.productName}" confirmed for invoice inclusion.`);
    } catch (error) {
      console.error("Error confirming special item:", error);
      alert("Error confirming special item. Please try again.");
    }
  };

  // Handler to skip a special item with reason
  const handleSkipSpecialItem = async (item: any, reason: string) => {
    try {
      const { skipSpecialItem } = await import("../services/firebaseService");
      
      await skipSpecialItem(item.id, reason, getCurrentUser());
      
      // Update local state
      setPendingSpecialItems(prev => prev.filter(p => p.id !== item.id));
      setSkippedSpecialItems(prev => [...prev, { ...item, skipReason: reason, skippedBy: getCurrentUser() }]);
      
      await logActivity({
        type: "Special Item",
        message: `Special item "${item.productName}" for ${item.clientName} skipped by ${getCurrentUser()}. Reason: ${reason}`,
        user: getCurrentUser(),
      });
      
      alert(`Special item "${item.productName}" has been skipped.`);
    } catch (error) {
      console.error("Error skipping special item:", error);
      alert("Error skipping special item. Please try again.");
    }
  };

  // Check if a product is a special item that requires confirmation
  const isSpecialItem = (productName: string): boolean => {
    const name = productName.toLowerCase();
    return name.includes('blanket') || 
           name.includes('colcha') || 
           name.includes('manta') ||
           name.includes('frazada');
  };

  // Get special item category
  const getSpecialItemCategory = (productName: string): 'blanket' | 'colcha' | 'uniform' | 'other' => {
    const name = productName.toLowerCase();
    if (name.includes('blanket') || name.includes('manta') || name.includes('frazada')) return 'blanket';
    if (name.includes('colcha')) return 'colcha';
    if (name.includes('uniform') || name.includes('scrub')) return 'uniform';
    return 'other';
  };

  // Handler to mark manual product as washed (but keep in list until invoiced)
  const handleMarkManualProductWashed = async (id: string) => {
    await updateDoc(doc(db, "manual_conventional_products", id), {
      washed: true,
    });
    setManualConventionalProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, washed: true } : p))
    );
    await logActivity({
      type: "Washing",
      message: `Manual product ${id} marked as washed by ${getCurrentUser()}`,
      user: getCurrentUser(),
    });
  };

  // Handler to mark a conventional client group as washed
  const handleMarkConventionalGroupWashed = async (group: any) => {
    // 1. Update pickup group status to 'Empaque' and washed
    await updateDoc(doc(db, "pickup_groups", group.id), {
      status: "Empaque",
      washed: true,
    });
    // 2. Only create invoice if client needsInvoice is true
    const client = clients.find((c) => c.id === group.clientId);
    if (client?.needsInvoice) {
      const { addInvoice } = await import("../services/firebaseService");
      const newInvoice = {
        clientId: group.clientId,
        clientName: group.clientName,
        date: new Date().toISOString(),
        products: [], // You may want to fill this with group products if available
        total: 0,
        carts: group.carts || [],
        totalWeight: group.totalWeight || 0,
      };
      const invoiceId = await addInvoice(newInvoice);
      if (setSelectedInvoiceId) setSelectedInvoiceId(invoiceId);
    }
  };

  // Handler to mark a client group as washed (set to Empaque and create invoice)
  const handleMarkGroupAsWashed = async (group: any) => {
    try {
      // Update group status to Empaque
      await updateDoc(doc(db, "pickup_groups", group.id), {
        status: "Empaque",
        washed: true,
      });
      // Create invoice for this group
      const { addInvoice } = await import("../services/firebaseService");
      const newInvoice = {
        clientId: group.clientId,
        clientName: group.clientName,
        date: new Date().toISOString(),
        products: [], // You may want to add group products if available
        total: 0,
        carts: group.carts || [],
        totalWeight: group.totalWeight || 0,
        pickupGroupId: group.id,
      };
      const invoiceId = await addInvoice(newInvoice);
      if (setSelectedInvoiceId) setSelectedInvoiceId(invoiceId);
      // Update local state
      setGroups((prev) =>
        prev.map((g) =>
          g.id === group.id ? { ...g, status: "Empaque", washed: true } : g
        )
      );
      await logActivity({
        type: "Washing",
        message: `Group ${group.clientName} marked as washed by ${getCurrentUser()}`,
        user: getCurrentUser(),
      });
    } catch (e) {
      alert("Error marking group as washed and creating invoice");
    }
  };

  // Automatically sync segregatedCarts for Tunnel/no-segregation clients
  useEffect(() => {
    if (!loading && groups.length > 0 && clients.length > 0) {
      groups.forEach(async (group) => {
        const client = clients.find((c) => c.id === group.clientId);
        if (
          client &&
          client.washingType === "Tunnel" &&
          client.segregation === false
        ) {
          let cartCount = 0;
          if (typeof group.numCarts === "number") cartCount = group.numCarts;
          else if (Array.isArray(group.carts)) cartCount = group.carts.length;
          else if (typeof group.carts === "number") cartCount = group.carts;
          if (group.segregatedCarts !== cartCount) {
            await updateDoc(doc(db, "pickup_groups", group.id), {
              segregatedCarts: cartCount,
            });
            setGroups((prev) =>
              prev.map((g) =>
                g.id === group.id ? { ...g, segregatedCarts: cartCount } : g
              )
            );
          }
        }
      });
    }
    // eslint-disable-next-line
  }, [loading, groups, clients]);

  // Helper: check if a group or manual product is overdue (created > 1 day ago)
  const isOverdue = (item: any) => {
    let createdAt: Date | null = null;
    if (item.createdAt) {
      if (item.createdAt.seconds) {
        createdAt = new Date(item.createdAt.seconds * 1000);
      } else if (
        typeof item.createdAt === "string" ||
        typeof item.createdAt === "number"
      ) {
        createdAt = new Date(item.createdAt);
      }
    } else if (item.date) {
      createdAt = new Date(item.date);
    }
    if (!createdAt) return false;
    const now = new Date();
    return now.getTime() - createdAt.getTime() > 24 * 60 * 60 * 1000;
  };

  // Add handler for deleting a group (Tunnel or Conventional)
  const handleDeleteGroup = async (groupId: string) => {
    if (
      !window.confirm(
        "Delete this group and all its data? This action cannot be undone."
      )
    )
      return;
    // Optimistically update UI
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    try {
      await updateDoc(doc(db, "pickup_groups", groupId), { status: "deleted" });
    } catch (e) {
      // Optionally show error and revert UI if needed
      // For now, do nothing (UI will sync with Firestore on next snapshot)
    }
  };

  const [tunnelInvoiceInProgress, setTunnelInvoiceInProgress] = useState<{
    [groupId: string]: boolean;
  }>({});

  // Listen for tunnelMessage changes in pickup_groups
  useEffect(() => {
    const q = collection(db, "pickup_groups");
    const unsub = onSnapshot(q, (snap) => {
      const messages: { [groupId: string]: string } = {};
      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (typeof data.tunnelMessage === "string") {
          messages[doc.id] = data.tunnelMessage;
        }
      });
      setTunnelMessages(messages);
    });
    return () => unsub();
  }, []);

  // Listen for tunnelMessageVerifiedBy changes in pickup_groups
  useEffect(() => {
    const q = collection(db, "pickup_groups");
    const unsub = onSnapshot(q, (snap) => {
      const verifiedBy: {
        [groupId: string]: Array<{ id: string; name: string }>;
      } = {};
      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (Array.isArray(data.tunnelMessageVerifiedBy)) {
          verifiedBy[doc.id] = data.tunnelMessageVerifiedBy;
        }
      });
      setTunnelMessageVerifiedBy(verifiedBy);
    });
    return () => unsub();
  }, []);

  // Load priority flags from Firestore
  useEffect(() => {
    const loadPriorityFlags = async () => {
      try {
        const prioritiesRef = collection(db, "washing_priorities");
        const unsubscribe = onSnapshot(prioritiesRef, (snapshot) => {
          const priorities: { [groupId: string]: boolean } = {};
          snapshot.docs.forEach((doc) => {
            priorities[doc.id] = doc.data().isPriority || false;
          });
          setPriorityFlags(priorities);
        });
        return unsubscribe;
      } catch (error) {
        console.error("Error loading priority flags:", error);
      }
    };
    
    loadPriorityFlags();
  }, []);

  // Toggle priority status for a group
  const togglePriorityFlag = async (groupId: string) => {
    if (priorityLoading[groupId]) return;
    
    try {
      setPriorityLoading(prev => ({ ...prev, [groupId]: true }));
      
      const currentPriority = priorityFlags[groupId] || false;
      const newPriority = !currentPriority;
      
      // Update Firestore
      const priorityRef = doc(db, "washing_priorities", groupId);
      await setDoc(priorityRef, { 
        isPriority: newPriority,
        updatedAt: Timestamp.now(),
        updatedBy: user?.username || "Unknown"
      }, { merge: true });
      
      // Log activity
      if (user) {
        await logActivity({
          type: newPriority ? "PRIORITY_ADDED" : "PRIORITY_REMOVED",
          message: `${newPriority ? "Added" : "Removed"} priority flag for group ${groupId}`,
          user: user.username
        });
      }
      
    } catch (error) {
      console.error("Error toggling priority flag:", error);
      alert("Error updating priority status");
    } finally {
      setPriorityLoading(prev => ({ ...prev, [groupId]: false }));
    }
  };

  return (
    <div className="container py-4">
      {/* Alert Banner */}
      {loadingAlert ? (
        <div style={{
          width: "100%", background: "#f3f4f6", borderBottom: "2px solid #d1d5db",
          padding: "8px 0", textAlign: "center", position: "sticky", top: 0, zIndex: 1000
        }}>
          <span>Loading...</span>
        </div>
      ) : (
        <div style={{
          width: "100%", 
          background: alertMessage ? "#fef3c7" : "#f3f4f6", 
          borderBottom: alertMessage ? "2px solid #f59e0b" : "2px solid #d1d5db",
          padding: "12px 0", 
          textAlign: "center", 
          position: "sticky", 
          top: 0, 
          zIndex: 1000,
          marginBottom: "16px",
          display: (!alertMessage && !canEdit && !isEditingAlert) ? "none" : "block"
        }}>
          {isEditingAlert ? (
            <div className="container">
              <div className="row justify-content-center">
                <div className="col-md-8">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Enter alert message"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={handleSaveAlert}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : alertMessage ? (
            <div className="container">
              <div className="row align-items-center justify-content-center">
                <div className="col-auto">
                  <i className="bi bi-exclamation-triangle-fill text-warning"></i>
                </div>
                <div className="col-auto">
                  <span>{alertMessage}</span>
                </div>
                {canEdit && (
                  <div className="col-auto">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={handleStartEditing}
                    >
                      <i className="bi bi-pencil"></i> Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : canEdit ? (
            <div className="container">
              <button 
                className="btn btn-outline-primary"
                onClick={handleStartEditing}
              >
                <i className="bi bi-plus-circle me-2"></i>
                <span>Add Company Alert Banner</span>
              </button>
            </div>
          ) : null}
        </div>
      )}

      <h2 className="mb-4 text-center">Washing</h2>
      <ul className="nav nav-tabs mb-3 justify-content-center">
        <li className="nav-item">
          <button
            className={`nav-link${activeTab === "tunnel" ? " active" : ""}`}
            onClick={() => setActiveTab("tunnel")}
          >
            <span style={{ color: "black" }}>Tunnel</span>
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link${
              activeTab === "conventional" ? " active" : ""
            }`}
            onClick={() => setActiveTab("conventional")}
          >
            <span style={{ color: "black" }}>Conventional</span>
          </button>
        </li>
      </ul>
      
      {/* Warning message about priority flags before 12:00 midday - always shown in conventional tab */}
      {activeTab === "conventional" && (
        <div 
          className="alert alert-warning mb-4 text-center mx-auto"
          style={{
            background: "#fff3cd",
            border: "2px solid #ffc107",
            borderRadius: 12,
            padding: "16px",
            fontWeight: 600,
            fontSize: 16,
            color: "#856404",
            maxWidth: 820
          }}
        >
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <strong>⚠️ ADVERTENCIA:</strong> Antes de las 12:00 del mediodía no debería haber filas rojas (prioridad) presentes en la lista.
        </div>
      )}
      
      <div>
        {activeTab === "tunnel" && (
          <div
            className="card shadow p-5 mb-5 mx-auto"
            style={{
              maxWidth: 1100,
              minWidth: 700,
              width: "100%",
              background: "#f8f9fa",
              border: "2.5px solid #0E62A0",
              borderRadius: 22,
              boxShadow: "0 8px 32px rgba(14,98,160,0.13)",
              padding: "3.5rem 2.5rem 7rem 2.5rem", // Increase bottom padding further
              marginBottom: 40,
              marginTop: 18,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minHeight: "calc(100vh - 120px)", // Ensure card is tall enough for 4 rows
              boxSizing: "border-box",
              overflow: "visible", // Prevent clipping
            }}
          >
            <h3
              className="mb-4 text-center"
              style={{
                letterSpacing: 1.5,
                fontSize: 32,
                fontWeight: 800,
                color: "#0E62A0",
              }}
            >
              Groups for Tunnel Washing
            </h3>
            {loading ? (
              <div className="text-center py-5" style={{ fontSize: 22 }}>
                Loading...
              </div>
            ) : tunnelGroups.length === 0 ? (
              <div
                className="text-muted text-center py-5"
                style={{ fontSize: 22 }}
              >
                No tunnel groups ready for washing.
              </div>
            ) : (
              <div
                className="list-group list-group-flush w-100"
                style={{
                  maxWidth: 1000,
                  margin: "0 auto",
                }}
              >
                <FlipMove duration={400} easing="ease-in-out">
                  {tunnelGroups.map((group, idx) => {
                    const isVerified = !!verifiedGroups[group.id];
                    const cartCounter = cartCounters[group.id] || 0;
                    const isLocked =
                      group.showInTunnel && group.segregationComplete;
                    const maxCarts = getSegregatedCarts(group);
                    const isVerifying = verifyingGroupIds[group.id];
                    // Only allow verification for the first 2 entries
                    const canVerify = idx < 2;
                    const isMessageVerified = (
                      tunnelMessageVerifiedBy[group.id] || []
                    ).some((v) => v.id === user?.id);
                    const needsMessageVerification =
                      !canReorder &&
                      tunnelMessages[group.id] &&
                      !isMessageVerified;
                    // Strictly disable all controls except verify button if message not verified
                    const rowControlsDisabled = needsMessageVerification;
                    return (
                      <div
                        key={group.id}
                        className="list-group-item d-flex flex-row align-items-center justify-content-between gap-4 shadow-sm rounded"
                        style={{
                          background: needsMessageVerification
                            ? "#fffbe6"
                            : group.showInTunnel && group.segregationComplete
                            ? "#cce5ff"
                            : "#fff",
                          border: "2px solid #e3e3e3",
                          fontSize: 24,
                          minHeight: "1px",
                          height: "100%",
                          boxShadow: "0 2px 12px rgba(14,98,160,0.07)",
                          color: "#000",
                          width: "100%",
                          borderRadius: 24,
                          padding: "2.5rem 2.5rem",
                          display: "flex",
                          alignItems: "center",
                          opacity: needsMessageVerification ? 0.7 : 1,
                          pointerEvents: "auto",
                        }}
                      >
                        <div
                          className="d-flex flex-column flex-md-row align-items-md-center gap-4 flex-grow-1"
                          style={{ flex: 1, minWidth: 0, color: "#000" }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              width: "100%",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "1.5rem",
                                fontWeight: 700,
                                color: "#000",
                                minWidth: 180,
                              }}
                            >
                              {group.clientName}
                            </span>
                            {/* Tunnel Message Section - restored to box format for clarity and formatting */}
                            <div
                              style={{
                                margin: "8px 0",
                                padding: 8,
                                background: "#eaf4ff",
                                borderRadius: 8,
                                border: "1.5px solid #0E62A0",
                                maxWidth: 420,
                              }}
                            >
                              {canReorder ? (
                                <form
                                  onSubmit={async (e) => {
                                    e.preventDefault();
                                    const message =
                                      tunnelMessageInputs[group.id] || "";
                                    if (!message.trim()) {
                                      alert("Message cannot be empty.");
                                      return;
                                    }
                                    setTunnelMessageLoading((prev) => ({
                                      ...prev,
                                      [group.id]: true,
                                    }));
                                    try {
                                      const { updateDoc, doc } = await import(
                                        "firebase/firestore"
                                      );
                                      const { db } = await import(
                                        "../firebase"
                                      );
                                      await updateDoc(
                                        doc(db, "pickup_groups", group.id),
                                        {
                                          tunnelMessage: message,
                                          tunnelMessageAuthor:
                                            user?.username || "Supervisor",
                                        }
                                      );
                                      setTunnelMessages((prev) => ({
                                        ...prev,
                                        [group.id]: message,
                                      }));
                                      setTunnelMessageSaved((prev) => ({
                                        ...prev,
                                        [group.id]: true,
                                      }));
                                      setTimeout(() => {
                                        setTunnelMessageSaved((prev) => ({
                                          ...prev,
                                          [group.id]: false,
                                        }));
                                      }, 2000);
                                    } catch (e) {
                                      alert("Error saving message");
                                    }
                                    setTunnelMessageLoading((prev) => ({
                                      ...prev,
                                      [group.id]: false,
                                    }));
                                  }}
                                  className="d-flex align-items-center gap-2"
                                  style={{ marginTop: 2 }}
                                >
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Deja un mensaje para este grupo..."
                                    value={
                                      tunnelMessageInputs[group.id] ??
                                      tunnelMessages[group.id] ??
                                      ""
                                    }
                                    onChange={(e) =>
                                      setTunnelMessageInputs((prev) => ({
                                        ...prev,
                                        [group.id]: e.target.value,
                                      }))
                                    }
                                    style={{
                                      maxWidth: 260,
                                      background: "#fff",
                                    }}
                                    disabled={
                                      Boolean(tunnelMessageLoading[group.id]) ||
                                      Boolean(rowControlsDisabled)
                                    }
                                  />
                                  <button
                                    type="submit"
                                    className="btn btn-sm btn-primary"
                                    disabled={
                                      Boolean(tunnelMessageLoading[group.id]) ||
                                      Boolean(rowControlsDisabled)
                                    }
                                    style={{ fontWeight: 700 }}
                                  >
                                    {tunnelMessageLoading[group.id]
                                      ? "Guardando..."
                                      : "Guardar"}
                                  </button>
                                  {tunnelMessageSaved[group.id] && (
                                    <span
                                      className="text-success ms-2"
                                      style={{ fontWeight: 600, fontSize: 14 }}
                                    >
                                      ¡Mensaje guardado!
                                    </span>
                                  )}
                                </form>
                              ) : tunnelMessages[group.id] ? (
                                <>
                                  <div
                                    className="text-secondary small mt-1"
                                    style={{
                                      maxWidth: 320,
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    <strong>
                                      {group.tunnelMessageAuthor
                                        ? `${group.tunnelMessageAuthor}: `
                                        : ""}
                                    </strong>
                                    {tunnelMessages[group.id]}
                                  </div>
                                  {/* Verification logic for employees */}
                                  {!(
                                    tunnelMessageVerifiedBy[group.id] || []
                                  ).some((v) => v.id === user?.id) ? (
                                    <button
                                      className="btn btn-success btn-sm mt-2"
                                      style={{
                                        fontWeight: 700,
                                        backgroundColor: "#176a1a",
                                        borderColor: "#176a1a",
                                      }}
                                      onClick={async () => {
                                        if (!user) return;
                                        const { updateDoc, arrayUnion, doc } =
                                          await import("firebase/firestore");
                                        const { db } = await import(
                                          "../firebase"
                                        );
                                        await updateDoc(
                                          doc(db, "pickup_groups", group.id),
                                          {
                                            tunnelMessageVerifiedBy: arrayUnion(
                                              {
                                                id: user.id,
                                                name:
                                                  user.username || "Employee",
                                              }
                                            ),
                                          }
                                        );
                                      }}
                                      disabled={false}
                                    >
                                      OK / Listo
                                    </button>
                                  ) : (
                                    <div className="text-success small mt-2">
                                      Ya verificaste este mensaje.
                                    </div>
                                  )}
                                  {/* Show who has verified */}
                                  {tunnelMessageVerifiedBy[group.id] &&
                                    tunnelMessageVerifiedBy[group.id].length >
                                      0 && (
                                      <div
                                        className="small mt-1"
                                        style={{ color: "#0E62A0" }}
                                      >
                                        Verificado por:{" "}
                                        {tunnelMessageVerifiedBy[group.id]
                                          .map((v) => v.name)
                                          .join(", ")}
                                      </div>
                                    )}
                                  {/* Info for employees if controls are disabled */}
                                  {needsMessageVerification && (
                                    <div
                                      className="small mt-2 text-success"
                                      style={{ fontWeight: 500 }}
                                    >
                                      Los controles están deshabilitados hasta
                                      que verifiques el mensaje.
                                    </div>
                                  )}
                                </>
                              ) : null}
                            </div>
                          </div>
                          <span
                            style={{
                              display: "inline-block",
                              backgroundColor: "#28a745",
                              color: "white",
                              padding: "4px 12px",
                              borderRadius: "20px",
                              fontSize: "1rem",
                              fontWeight: "bold",
                              minWidth: "80px",
                              textAlign: "center",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {typeof group.totalWeight === "number"
                              ? Math.round(group.totalWeight)
                              : "?"} lbs
                          </span>
                          {/* If locked, skip verification and show counter directly */}
                          {isLocked ? (
                            <div className="d-flex align-items-center gap-2">
                              <span
                                style={{ fontSize: "1.1rem", color: "#333" }}
                              >
                                {cartCounter} / {maxCarts}
                              </span>
                              <button
                                className="btn btn-outline-primary btn-lg"
                                style={{
                                  fontSize: 30,
                                  minWidth: 60,
                                  minHeight: 60,
                                  borderRadius: 12,
                                }}
                                disabled={
                                  cartCounter >= maxCarts ||
                                  !canVerify ||
                                  Boolean(rowControlsDisabled)
                                }
                                onClick={async () => {
                                  if (!canVerify || rowControlsDisabled) return;
                                  const newCount = Math.min(
                                    cartCounter + 1,
                                    maxCarts
                                  );
                                  setCartCounters((prev) => ({
                                    ...prev,
                                    [group.id]: newCount,
                                  }));
                                  await updateDoc(
                                    doc(db, "pickup_groups", group.id),
                                    { tunnelCartCount: newCount }
                                  );
                                }}
                              >
                                +
                              </button>
                              <button
                                className="btn btn-outline-secondary btn-lg"
                                style={{
                                  fontSize: 30,
                                  minWidth: 60,
                                  minHeight: 60,
                                  borderRadius: 12,
                                }}
                                disabled={
                                  cartCounter <= 0 ||
                                  !canVerify ||
                                  Boolean(rowControlsDisabled)
                                }
                                onClick={async () => {
                                  if (!canVerify || rowControlsDisabled) return;
                                  const previousCount = cartCounter;
                                  const newCount = Math.max(cartCounter - 1, 0);
                                  
                                  // Update UI state
                                  setCartCounters((prev) => ({
                                    ...prev,
                                    [group.id]: newCount,
                                  }));
                                  
                                  // Update database
                                  await updateDoc(
                                    doc(db, "pickup_groups", group.id),
                                    { tunnelCartCount: newCount }
                                  );
                                  
                                  // Send signal to hardware
                                  try {
                                    const hardwareEvent: CartCountdownEvent = {
                                      groupId: group.id,
                                      clientName: group.clientName || 'Unknown Client',
                                      previousCount,
                                      newCount,
                                      timestamp: new Date(),
                                    };
                                    
                                    const success = await hardwareService.sendCartCountdown(hardwareEvent);
                                    if (success) {
                                      console.log('✅ Hardware signal sent for cart countdown');
                                    } else {
                                      console.log('⚠️ Hardware signal failed (hardware may be disabled)');
                                    }
                                  } catch (error) {
                                    console.error('❌ Error sending hardware signal:', error);
                                  }
                                }}
                              >
                                -
                              </button>
                              {cartCounter === maxCarts && (
                                <button
                                  className="btn btn-success btn-lg ms-3 px-4"
                                  style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    minWidth: 100,
                                    borderRadius: 12,
                                  }}
                                  disabled={
                                    !canVerify || Boolean(rowControlsDisabled)
                                  }
                                  onClick={async () => {
                                    if (!canVerify || rowControlsDisabled)
                                      return;
                                    if (cartCounter !== maxCarts) {
                                      return;
                                    }
                                    const { updatePickupGroupStatus } =
                                      await import(
                                        "../services/firebaseService"
                                      );
                                    await updatePickupGroupStatus(
                                      group.id,
                                      "procesandose"
                                    );
                                    await updateDoc(
                                      doc(db, "pickup_groups", group.id),
                                      {
                                        showInTunnel: false,
                                        segregationComplete: false,
                                      }
                                    );
                                    setSelectedTunnelGroup(null);
                                  }}
                                >
                                  Done
                                </button>
                              )}
                            </div>
                          ) : !isVerified ? (
                            <div style={{ minWidth: 220 }}>
                              {/* Only show the button, and show the input if verifying */}
                              {!isVerifying ? (
                                <button
                                  className="btn btn-outline-danger btn-lg d-flex align-items-center justify-content-center"
                                  style={{
                                    fontSize: 38,
                                    minWidth: 60,
                                    minHeight: 60,
                                    borderRadius: 16,
                                    background: "#ff3b3b",
                                    color: "#fff",
                                    fontWeight: 900,
                                    boxShadow: "0 2px 8px rgba(255,59,59,0.18)",
                                    border: "none",
                                  }}
                                  onClick={() =>
                                    canVerify &&
                                    !rowControlsDisabled &&
                                    setVerifyingGroupIds((ids) => ({
                                      ...ids,
                                      [group.id]: true,
                                    }))
                                  }
                                  disabled={
                                    !canVerify || Boolean(rowControlsDisabled)
                                  }
                                  aria-label="Verify Cart Count"
                                >
                                  ?
                                </button>
                              ) : (
                                <>
                                  {/* Only show segregated carts value for Supervisor or higher */}
                                  {canReorder && (
                                    <div className="mb-2 text-secondary small">
                                      {editingSegregatedCarts[group.id] ? (
                                        <div className="d-flex align-items-center gap-2">
                                          <span>Segregated Carts:</span>
                                          <input
                                            type="number"
                                            min="0"
                                            className="form-control form-control-sm"
                                            style={{ width: "80px" }}
                                            value={
                                              segregatedCartsInput[group.id] ??
                                              getSegregatedCarts(
                                                group
                                              ).toString()
                                            }
                                            onChange={(e) =>
                                              setSegregatedCartsInput(
                                                (prev) => ({
                                                  ...prev,
                                                  [group.id]: e.target.value,
                                                })
                                              )
                                            }
                                            onKeyDown={async (e) => {
                                              if (e.key === "Enter") {
                                                const newValue = parseInt(
                                                  segregatedCartsInput[
                                                    group.id
                                                  ] || "0"
                                                );
                                                if (
                                                  !isNaN(newValue) &&
                                                  newValue >= 0
                                                ) {
                                                  try {
                                                    await updateDoc(
                                                      doc(
                                                        db,
                                                        "pickup_groups",
                                                        group.id
                                                      ),
                                                      {
                                                        segregatedCarts:
                                                          newValue,
                                                      }
                                                    );
                                                    setEditingSegregatedCarts(
                                                      (prev) => ({
                                                        ...prev,
                                                        [group.id]: false,
                                                      })
                                                    );
                                                    setSegregatedCartsInput(
                                                      (prev) => ({
                                                        ...prev,
                                                        [group.id]: "",
                                                      })
                                                    );
                                                  } catch (error) {
                                                    alert(
                                                      "Error updating segregated carts"
                                                    );
                                                  }
                                                }
                                              } else if (e.key === "Escape") {
                                                setEditingSegregatedCarts(
                                                  (prev) => ({
                                                    ...prev,
                                                    [group.id]: false,
                                                  })
                                                );
                                                setSegregatedCartsInput(
                                                  (prev) => ({
                                                    ...prev,
                                                    [group.id]: "",
                                                  })
                                                );
                                              }
                                            }}
                                            autoFocus
                                          />
                                          <button
                                            className="btn btn-success btn-sm px-2 py-0"
                                            style={{ fontSize: "12px" }}
                                            onClick={async () => {
                                              const newValue = parseInt(
                                                segregatedCartsInput[
                                                  group.id
                                                ] || "0"
                                              );
                                              if (
                                                !isNaN(newValue) &&
                                                newValue >= 0
                                              ) {
                                                try {
                                                  await updateDoc(
                                                    doc(
                                                      db,
                                                      "pickup_groups",
                                                      group.id
                                                    ),
                                                    {
                                                      segregatedCarts: newValue,
                                                    }
                                                  );
                                                  setEditingSegregatedCarts(
                                                    (prev) => ({
                                                      ...prev,
                                                      [group.id]: false,
                                                    })
                                                  );
                                                  setSegregatedCartsInput(
                                                    (prev) => ({
                                                      ...prev,
                                                      [group.id]: "",
                                                    })
                                                  );
                                                } catch (error) {
                                                  alert(
                                                    "Error updating segregated carts"
                                                  );
                                                }
                                              }
                                            }}
                                            title="Save"
                                          >
                                            ✓
                                          </button>
                                          <button
                                            className="btn btn-secondary btn-sm px-2 py-0"
                                            style={{ fontSize: "12px" }}
                                            onClick={() => {
                                              setEditingSegregatedCarts(
                                                (prev) => ({
                                                  ...prev,
                                                  [group.id]: false,
                                                })
                                              );
                                              setSegregatedCartsInput(
                                                (prev) => ({
                                                  ...prev,
                                                  [group.id]: "",
                                                })
                                              );
                                            }}
                                            title="Cancel"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="d-flex align-items-center gap-2">
                                          <span>
                                            Segregated Carts:{" "}
                                            <strong>
                                              {getSegregatedCarts(group)}
                                            </strong>
                                          </span>
                                          <button
                                            className="btn btn-outline-primary btn-sm px-2 py-0"
                                            style={{ fontSize: "12px" }}
                                            onClick={() =>
                                              setEditingSegregatedCarts(
                                                (prev) => ({
                                                  ...prev,
                                                  [group.id]: true,
                                                })
                                              )
                                            }
                                            title="Edit segregated cart count"
                                          >
                                            ✏️
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <input
                                    type="number"
                                    min={0}
                                    className="form-control form-control-sm"
                                    style={{ width: 110, maxWidth: "100%" }}
                                    placeholder="How many carts did you count?"
                                    value={tunnelCartInput}
                                    onChange={(e) =>
                                      setTunnelCartInput(e.target.value)
                                    }
                                    autoFocus
                                    disabled={
                                      !canVerify || Boolean(rowControlsDisabled)
                                    }
                                  />
                                  {tunnelCartError && (
                                    <div className="text-danger small">
                                      {tunnelCartError}
                                    </div>
                                  )}
                                  <button
                                    className="btn btn-primary btn-sm ms-2"
                                    onClick={async () => {
                                      if (!canVerify) return;
                                      const val = parseInt(tunnelCartInput);
                                      if (isNaN(val)) {
                                        setTunnelCartError(
                                          "Please enter a valid number."
                                        );
                                        return;
                                      }
                                      if (val !== getSegregatedCarts(group)) {
                                        setTunnelCartError(
                                          canReorder
                                            ? `Cart count does not match segregation value (${getSegregatedCarts(
                                                group
                                              )}).`
                                            : "Cart count does not match segregation value."
                                        );
                                        setShowTunnelRedAlert(true);
                                        if (tunnelRedAlertTimerRef.current)
                                          clearTimeout(
                                            tunnelRedAlertTimerRef.current
                                          );
                                        tunnelRedAlertTimerRef.current =
                                          setTimeout(() => {
                                            setShowTunnelRedAlert(false);
                                          }, 5000);
                                        return;
                                      }
                                      setTunnelCartError("");
                                      setVerifiedGroups((prev) => ({
                                        ...prev,
                                        [group.id]: true,
                                      }));
                                      setCartCounters((prev) => ({
                                        ...prev,
                                        [group.id]: 0,
                                      }));
                                      setVerifyingGroupIds((ids) => ({
                                        ...ids,
                                        [group.id]: false,
                                      }));
                                      setTunnelCartInput("");
                                      // Save verification and counter to Firestore
                                      await updateDoc(
                                        doc(db, "pickup_groups", group.id),
                                        {
                                          tunnelVerified: true,
                                          tunnelCartCount: 0,
                                          segregatedCarts: val,
                                        }
                                      );
                                    }}
                                    disabled={!canVerify}
                                  >
                                    Verify
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm ms-2"
                                    onClick={() =>
                                      canVerify &&
                                      setVerifyingGroupIds((ids) => ({
                                        ...ids,
                                        [group.id]: false,
                                      }))
                                    }
                                    disabled={!canVerify}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>
                          ) : (
                            // Counting step: show counter if verified
                            <div className="d-flex align-items-center gap-2">
                              <span
                                style={{ fontSize: "1.1rem", color: "#333" }}
                              >
                                {cartCounter} / {getSegregatedCarts(group)}
                              </span>
                              <button
                                className="btn btn-outline-primary btn-lg"
                                style={{
                                  fontSize: 30,
                                  minWidth: 60,
                                  minHeight: 60,
                                  borderRadius: 12,
                                }}
                                disabled={
                                  cartCounter >= getSegregatedCarts(group) ||
                                  !canVerify ||
                                  Boolean(rowControlsDisabled)
                                }
                                onClick={async () => {
                                  if (!canVerify || rowControlsDisabled) return;
                                  const newCount = Math.min(
                                    cartCounter + 1,
                                    getSegregatedCarts(group)
                                  );
                                  setCartCounters((prev) => ({
                                    ...prev,
                                    [group.id]: newCount,
                                  }));
                                  await updateDoc(
                                    doc(db, "pickup_groups", group.id),
                                    {
                                      tunnelCartCount: newCount,
                                    }
                                  );
                                }}
                              >
                                +
                              </button>
                              <button
                                className="btn btn-outline-secondary btn-lg"
                                style={{
                                  fontSize: 30,
                                  minWidth: 60,
                                  minHeight: 60,
                                  borderRadius: 12,
                                }}
                                disabled={
                                  cartCounter <= 0 ||
                                  !canVerify ||
                                  Boolean(rowControlsDisabled)
                                }
                                onClick={async () => {
                                  if (!canVerify || rowControlsDisabled) return;
                                  const previousCount = cartCounter;
                                  const newCount = Math.max(cartCounter - 1, 0);
                                  
                                  // Update UI state
                                  setCartCounters((prev) => ({
                                    ...prev,
                                    [group.id]: newCount,
                                  }));
                                  
                                  // Update database
                                  await updateDoc(
                                    doc(db, "pickup_groups", group.id),
                                    { tunnelCartCount: newCount }
                                  );
                                  
                                  // Send signal to hardware
                                  try {
                                    const hardwareEvent: CartCountdownEvent = {
                                      groupId: group.id,
                                      clientName: group.clientName || 'Unknown Client',
                                      previousCount,
                                      newCount,
                                      timestamp: new Date(),
                                    };
                                    
                                    const success = await hardwareService.sendCartCountdown(hardwareEvent);
                                    if (success) {
                                      console.log('✅ Hardware signal sent for cart countdown');
                                    } else {
                                      console.log('⚠️ Hardware signal failed (hardware may be disabled)');
                                    }
                                  } catch (error) {
                                    console.error('❌ Error sending hardware signal:', error);
                                  }
                                }}
                              >
                                -
                              </button>
                              {cartCounter === getSegregatedCarts(group) && (
                                <button
                                  className="btn btn-success btn-sm ms-2"
                                  disabled={
                                    !!group.invoiceId ||
                                    group.washed ||
                                    tunnelInvoiceInProgress[group.id] ||
                                    !canVerify
                                  }
                                  onClick={async () => {
                                    if (!canVerify) return;
                                    if (
                                      group.invoiceId ||
                                      group.washed ||
                                      tunnelInvoiceInProgress[group.id]
                                    )
                                      return;
                                    setTunnelInvoiceInProgress((prev) => ({
                                      ...prev,
                                      [group.id]: true,
                                    }));
                                    try {
                                      // Refetch group from Firestore to check for invoiceId/washed
                                      const {
                                        getDoc,
                                        doc: firestoreDoc,
                                        updateDoc,
                                      } = await import("firebase/firestore");
                                      const { db } = await import(
                                        "../firebase"
                                      );
                                      const groupSnap = await getDoc(
                                        firestoreDoc(
                                          db,
                                          "pickup_groups",
                                          group.id
                                        )
                                      );
                                      const latestGroup = groupSnap.exists()
                                        ? groupSnap.data()
                                        : {};
                                      if (
                                        latestGroup.invoiceId ||
                                        latestGroup.washed
                                      ) {
                                        setTunnelInvoiceInProgress((prev) => ({
                                          ...prev,
                                          [group.id]: false,
                                        }));
                                        return;
                                      }
                                      // Create invoice
                                      const {
                                        addInvoice,
                                        updatePickupGroupStatus,
                                      } = await import(
                                        "../services/firebaseService"
                                      );
                                      const newInvoice = {
                                        clientId: group.clientId,
                                        clientName: group.clientName,
                                        date: new Date().toISOString(),
                                        products: [],
                                        total: 0,
                                        carts: group.carts || [],
                                        totalWeight: group.totalWeight || 0,
                                        pickupGroupId: group.id,
                                      };
                                      const invoiceId = await addInvoice(
                                        newInvoice
                                      );
                                      await updateDoc(
                                        firestoreDoc(
                                          db,
                                          "pickup_groups",
                                          group.id
                                        ),
                                        {
                                          invoiceId,
                                          washed: true,
                                          status: "Empaque",
                                        }
                                      );
                                      await updatePickupGroupStatus(
                                        group.id,
                                        "procesandose"
                                      );
                                      if (setSelectedInvoiceId)
                                        setSelectedInvoiceId(invoiceId);
                                      setGroups((prev) =>
                                        prev.map((g) =>
                                          g.id === group.id
                                            ? {
                                                ...g,
                                                invoiceId,
                                                washed: true,
                                                status: "Empaque",
                                              }
                                            : g
                                        )
                                      );
                                    } catch (e) {
                                      alert(
                                        "Error marking group as washed and creating invoice"
                                      );
                                    } finally {
                                      setTunnelInvoiceInProgress((prev) => ({
                                        ...prev,
                                        [group.id]: false,
                                      }));
                                    }
                                  }}
                                >
                                  Done
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div
                          className="d-flex flex-row align-items-center justify-content-end gap-2"
                          style={{
                            minWidth: 220,
                            maxWidth: 260,
                            color: "#000",
                          }} // Force text black
                        >
                          {/* Move up/down arrows - only for Supervisor or higher */}
                          {canReorder && (
                            <>
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                title="Move up"
                                disabled={
                                  tunnelReorderLoading === group.id || idx === 0
                                }
                                onClick={() => moveTunnelGroup(group.id, "up")}
                                style={{
                                  fontSize: 32,
                                  padding: "8px 16px",
                                  minWidth: 48,
                                }}
                              >
                                <span aria-hidden="true">▲</span>
                              </button>
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                title="Move down"
                                disabled={
                                  tunnelReorderLoading === group.id ||
                                  idx === tunnelGroups.length - 1
                                }
                                onClick={() =>
                                  moveTunnelGroup(group.id, "down")
                                }
                                style={{
                                  fontSize: 32,
                                  padding: "8px 16px",
                                  minWidth: 48,
                                }}
                              >
                                <span aria-hidden="true">▼</span>
                              </button>
                            </>
                          )}
                          {/* Delete group button */}
                          <button
                            className="btn btn-outline-danger btn-sm"
                            title="Delete group"
                            onClick={() => handleDeleteGroup(group.id)}
                          >
                            <span aria-hidden="true">🗑️</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </FlipMove>
              </div>
            )}
          </div>
        )}
        {activeTab === "conventional" && (
          <div
            className="card shadow p-4 mb-4 mx-auto"
            style={{ maxWidth: 820 }}
          >
            {/* Collapsible input form */}
            <div className="mb-3 w-100" style={{ textAlign: "right" }}>
              <button
                className="btn btn-primary"
                style={{
                  fontWeight: 700,
                  fontSize: 18,
                  borderRadius: 8,
                  minWidth: 44,
                }}
                onClick={() => setShowAddConventionalModal((v) => !v)}
                aria-expanded={showAddConventionalModal}
                aria-controls="conventional-input-form"
                type="button"
              >
                <span style={{ fontSize: 22, fontWeight: 900, marginRight: 6 }}>
                  +
                </span>{" "}
                Add Entry
              </button>
            </div>
            {showAddConventionalModal && (
              <form
                id="conventional-input-form"
                className="row g-2 align-items-end mb-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddConventionalProduct();
                }}
                style={{
                  background: "#f8f9fa",
                  borderRadius: 12,
                  padding: 18,
                  marginBottom: 18,
                  boxShadow: "0 2px 8px rgba(14,98,160,0.06)",
                }}
              >
                <div className="col-12 col-md-4">
                  <label className="form-label mb-1">Client</label>
                  <select
                    className="form-select"
                    value={selectedConventionalClientId}
                    onChange={(e) =>
                      setSelectedConventionalClientId(e.target.value)
                    }
                    required
                  >
                    <option value="">-- Select a client --</option>
                    {clientsForConventional
                      .slice() // copy array
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label mb-1">Product</label>
                  <select
                    className="form-select"
                    value={selectedConventionalProductId}
                    onChange={(e) =>
                      setSelectedConventionalProductId(e.target.value)
                    }
                    required
                  >
                    <option value="">-- Select a product --</option>
                    {products
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label mb-1">Add By</label>
                  <div className="d-flex gap-2">
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="addByMode"
                        id="addByCart"
                        value="cart"
                        checked={conventionalAddMode === "cart"}
                        onChange={() => setConventionalAddMode("cart")}
                      />
                      <label className="form-check-label" htmlFor="addByCart">
                        Carts
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="addByMode"
                        id="addByQty"
                        value="quantity"
                        checked={conventionalAddMode === "quantity"}
                        onChange={() => setConventionalAddMode("quantity")}
                      />
                      <label className="form-check-label" htmlFor="addByQty">
                        Quantity
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="addByMode"
                        id="addByLbs"
                        value="pounds"
                        checked={conventionalAddMode === "pounds"}
                        onChange={() => setConventionalAddMode("pounds")}
                      />
                      <label className="form-check-label" htmlFor="addByLbs">
                        Pounds
                      </label>
                    </div>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label mb-1">
                    {conventionalAddMode === "cart"
                      ? "Number of Carts"
                      : conventionalAddMode === "quantity"
                      ? "Quantity"
                      : "Pounds"}
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    value={conventionalProductQty}
                    onChange={(e) =>
                      setConventionalProductQty(Number(e.target.value))
                    }
                    required
                  />
                </div>
                <div className="col-12 col-md-4 d-flex align-items-end">
                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={
                      !selectedConventionalClientId ||
                      !selectedConventionalProductId ||
                      conventionalProductQty < 1 ||
                      conventionalModalLoading
                    }
                  >
                    + Add Manual Product
                  </button>
                </div>
                {conventionalModalError && (
                  <div className="col-12">
                    <div className="alert alert-danger py-1 my-1">
                      {conventionalModalError}
                    </div>
                  </div>
                )}
              </form>
            )}
            {manualProductsLoading ? (
              <div className="text-center py-2">Loading manual products...</div>
            ) : (
              manualConventionalProducts.length > 0 && (
                <div className="list-group mb-3">
                  {manualConventionalProducts
                    .filter((p) => !p.invoiceId)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="list-group-item d-flex flex-row align-items-center justify-content-between gap-2 py-2 mb-1 shadow-sm rounded bg-warning bg-opacity-25"
                        style={{ border: "1px solid #ffe066" }}
                      >
                        <div>
                          <span style={{ fontWeight: 600, color: "#b8860b" }}>
                            {item.clientName}
                          </span>
                          <span style={{ marginLeft: 8 }}>
                            <b>{item.productName}</b> x{item.quantity}{" "}
                            <span style={{ color: "#888" }}>({item.type})</span>
                          </span>
                        </div>
                        {!item.washed && (
                          <button
                            className="btn btn-outline-success btn-sm"
                            onClick={() =>
                              handleMarkManualProductWashed(item.id)
                            }
                          >
                            Mark as Washed
                          </button>
                        )}
                        {item.washed && (
                          <span className="text-muted ms-2">
                            Pending Invoice
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              )
            )}
            {loading ? (
              <div className="text-center py-5">Loading...</div>
            ) : conventionalGroups.length === 0 ? (
              <div className="text-muted text-center py-5">
                No conventional groups ready for washing.
              </div>
            ) : (
              <div
                className="list-group list-group-flush"
                style={{ maxWidth: 1100, margin: "0 auto" }}
              >
                <FlipMove duration={400} easing="ease-in-out">
                  {allConventionalRows.map((group, idx) => {
                    // Determine number of carts for this entry
                    let numCarts = 1;
                    if (group.isManualProduct) {
                      if (group.type === "cart") {
                        numCarts = Number(group.quantity) || 1;
                      } else {
                        numCarts = 1;
                      }
                    } else {
                      numCarts = getConventionalCartCount(group.id) || 1;
                    }
                    return (
                      <div
                        key={group.id}
                        className="list-group-item d-flex flex-row align-items-center justify-content-between gap-4 py-4 mb-3 shadow-sm rounded"
                        style={{
                          border: "2px solid #e3e3e3",
                          background: priorityFlags[group.id] 
                            ? "#d32f2f" 
                            : group.isManualProduct
                            ? "#fffbe6"
                            : "#fff",
                          marginBottom: 8,
                          minHeight: 90,
                          fontSize: 20,
                          alignItems: "center",
                          maxWidth: 1000,
                          width: "100%",
                          borderColor: priorityFlags[group.id] 
                            ? "#b71c1c" 
                            : "#e3e3e3",
                          color: priorityFlags[group.id] ? "#fff" : "inherit",
                        }}
                      >
                        {/* Info section */}
                        <div
                          className="d-flex flex-column flex-md-row align-items-md-center gap-4 flex-grow-1"
                          style={{ minWidth: 0 }}
                        >
                          {/* Date, Client Name, and Group Weight on Same Line */}
                          <div
                            className="d-flex flex-row align-items-center gap-3"
                            style={{ flexWrap: "wrap", alignItems: "center" }}
                          >
                            {/* Date Display */}
                            <span
                              style={{
                                color: "#666",
                                fontSize: "1rem",
                                fontWeight: 500,
                                whiteSpace: "nowrap"
                              }}
                            >
                              {group.startTime ? new Date(group.startTime).toLocaleDateString() : 
                               group.endTime ? new Date(group.endTime).toLocaleDateString() :
                               group.createdAt ? new Date(group.createdAt.seconds * 1000).toLocaleDateString() : 
                               new Date().toLocaleDateString()}
                            </span>
                            
                            {/* Client Name */}
                            <span
                              style={{
                                fontWeight: 700,
                                color: group.isManualProduct
                                  ? "#b8860b"
                                  : "#007bff",
                                fontSize: "1.5rem",
                              }}
                              title={group.clientName}
                            >
                              {group.clientName}
                            </span>
                            
                            {/* Group Weight */}
                            {!group.isManualProduct && (
                              <span
                                style={{
                                  display: "inline-block",
                                  backgroundColor: "#28a745",
                                  color: "white",
                                  padding: "4px 12px",
                                  borderRadius: "20px",
                                  fontSize: "1rem",
                                  fontWeight: "bold",
                                  minWidth: "80px",
                                  textAlign: "center",
                                  whiteSpace: "nowrap"
                                }}
                              >
                                {typeof group.totalWeight === "number"
                                  ? Math.round(group.totalWeight)
                                  : "?"} lbs
                              </span>
                            )}
                          </div>
                          
                          {/* Cart Count on Second Line */}
                          <span
                            style={{
                              color: "#333",
                              opacity: 0.7,
                              fontSize: "1.2rem",
                              fontWeight: 500,
                              letterSpacing: 0.2,
                              marginTop: 1,
                              textAlign: "left",
                              display: "block",
                              minWidth: 120,
                            }}
                          >
                            Carros:{" "}
                            <strong
                              style={{ fontSize: "1.2rem", fontWeight: 600 }}
                            >
                              {numCarts}
                            </strong>
                          </span>
                          {/* Manual product details - simplified display */}
                          {group.isManualProduct && (
                            <span
                              style={{
                                color: "#888",
                                fontSize: 15,
                                marginTop: 1,
                              }}
                            >
                              <b>{group.productName}</b> x{group.quantity}{" "}
                              <span style={{ color: "#888" }}>
                                ({group.type})
                              </span>
                            </span>
                          )}
                          {/* Regular group product details */}
                          {!group.isManualProduct && group.carts && Array.isArray(group.carts) && group.carts.length > 0 && (
                            <span
                              style={{
                                color: "#888",
                                fontSize: 15,
                                marginTop: 1,
                              }}
                            >
                              {group.carts.map((cart: any, cartIdx: number) => 
                                cart.items && Array.isArray(cart.items) ? cart.items.map((item: any, itemIdx: number) => (
                                  <span key={`${cartIdx}-${itemIdx}`}>
                                    <b>{item.productName || item.productId}</b> x{item.quantity}{" "}
                                    <span style={{ color: "#888" }}>
                                      ({item.type || 'qty'})
                                    </span>
                                    {cartIdx < group.carts.length - 1 || itemIdx < cart.items.length - 1 ? ', ' : ''}
                                  </span>
                                )) : null
                              )}
                            </span>
                          )}
                        </div>
                        {/* Actions section */}
                        <div
                          className="d-flex flex-row align-items-center gap-2"
                          style={{ minWidth: 220, maxWidth: 300 }}
                        >
                          {/* Priority toggle button - only for Supervisor and above */}
                          {canReorder && (
                            <button
                              className={`btn ${
                                priorityFlags[group.id] 
                                  ? "btn-danger" 
                                  : "btn-outline-danger"
                              } btn-sm`}
                              title={
                                priorityFlags[group.id] 
                                  ? "Remove priority flag" 
                                  : "Mark as priority"
                              }
                              onClick={() => togglePriorityFlag(group.id)}
                              disabled={priorityLoading[group.id]}
                              style={{ 
                                padding: "4px 8px", 
                                fontSize: 12,
                                minWidth: 32
                              }}
                            >
                              {priorityLoading[group.id] ? (
                                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                              ) : (
                                <span aria-hidden="true">👕</span>
                              )}
                            </button>
                          )}
                          {/* Move up/down arrows for groups only, Supervisor or higher */}
                          {!group.isManualProduct && canReorder && (
                            <>
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                title="Move up"
                                disabled={idx === 0}
                                onClick={() =>
                                  moveConventionalRow(group.id, "up")
                                }
                                style={{ padding: "2px 7px", fontSize: 13 }}
                              >
                                <span aria-hidden="true">▲</span>
                              </button>
                              <button
                                className="btn btn-outline-secondary btn-sm"
                                title="Move down"
                                disabled={
                                  idx === allConventionalRows.length - 1
                                }
                                onClick={() =>
                                  moveConventionalRow(group.id, "down")
                                }
                                style={{ padding: "2px 7px", fontSize: 13 }}
                              >
                                <span aria-hidden="true">▼</span>
                              </button>
                            </>
                          )}
                          {/* Delete button for both types */}
                          <button
                            className="btn btn-outline-danger btn-sm"
                            title="Delete group"
                            onClick={() =>
                              group.isManualProduct
                                ? handleDeleteManualProductGroup(group.id)
                                : handleDeleteGroup(group.id)
                            }
                            style={{ padding: "2px 7px", fontSize: 13 }}
                          >
                            <span aria-hidden="true">🗑️</span>
                          </button>
                          {/* Mark as washed for manual products */}
                          {group.isManualProduct && !group.washed && (
                            <button
                              className="btn btn-outline-success btn-sm ms-1"
                              onClick={() =>
                                handleMarkManualProductWashed(group.id)
                              }
                            >
                              Done
                            </button>
                          )}
                          {group.isManualProduct && group.washed && (
                            <span className="text-muted ms-2">
                              Pending Invoice
                            </span>
                          )}
                          {/* Mark as washed for conventional groups */}
                          {!group.isManualProduct && (
                            <button
                              className="btn btn-success btn-sm ms-1 px-2"
                              onClick={() =>
                                handleMarkConventionalGroupWashed(group)
                              }
                            >
                              Done
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {/* Always render a last empty row for spacing after the last item */}
                  <div style={{ height: 32 }} />
                </FlipMove>
              </div>
            )}
          </div>
        )}
      </div>
      {showTunnelRedAlert && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(215, 35, 40, 0.97)",
            color: "#fff",
            zIndex: 1500,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 38,
            fontWeight: 900,
            letterSpacing: 2,
            textAlign: "center",
            transition: "opacity 0.3s",
          }}
        >
          <div>
            🚨 <br />
            <span style={{ fontSize: 48 }}>¡ATENCIÓN!</span>
          </div>
          <div style={{ fontSize: 28, marginTop: 24 }}>
            El número de carros ingresado <br />
            <span style={{ color: "#fff", fontWeight: 700 }}>
              NO COINCIDE
            </span>{" "}
            <br />
            con el número de carros segregados.
            <br />
            (El mensaje desaparecerá en 5 segundos)
          </div>
        </div>
      )}

      {/* Special Item Confirmation and Reminders Section */}
      {(pendingSpecialItems.length > 0 || skippedSpecialItems.length > 0) && (
        <div className="mt-4">
          <div className="card">
            <div className="card-header bg-warning text-dark">
              <h5 className="mb-0">🔔 Special Items Requiring Attention</h5>
            </div>
            <div className="card-body">
              {/* Pending Confirmations */}
              {pendingSpecialItems.length > 0 && (
                <div className="mb-4">
                  <h6 className="text-warning mb-3">
                    ⚠️ Items Awaiting Confirmation ({pendingSpecialItems.length})
                  </h6>
                  <div className="list-group">
                    {pendingSpecialItems.map((item) => (
                      <div
                        key={item.id}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <strong className="text-primary">{item.clientName}</strong>
                          <br />
                          <span className="badge bg-info me-2">{item.category}</span>
                          <strong>{item.productName}</strong> x{item.quantity} ({item.type})
                          <br />
                          <small className="text-muted">
                            Added: {new Date(item.createdAt.seconds * 1000).toLocaleDateString()}
                          </small>
                        </div>
                        <div className="btn-group">
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleConfirmSpecialItem(item)}
                            title="Confirm for invoice inclusion"
                          >
                            ✅ Confirm
                          </button>
                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() => {
                              setSelectedSpecialItem(item);
                              setShowSpecialItemModal(true);
                            }}
                            title="Skip with reason"
                          >
                            ⏭️ Skip
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skipped Items Reminders */}
              {skippedSpecialItems.length > 0 && (
                <div>
                  <h6 className="text-info mb-3">
                    📋 Skipped Items Reminder ({skippedSpecialItems.length})
                  </h6>
                  <div className="list-group">
                    {skippedSpecialItems.map((item) => (
                      <div
                        key={item.id}
                        className="list-group-item d-flex justify-content-between align-items-center bg-light"
                      >
                        <div>
                          <strong className="text-secondary">{item.clientName}</strong>
                          <br />
                          <span className="badge bg-secondary me-2">{item.category}</span>
                          <strong>{item.productName}</strong> x{item.quantity} ({item.type})
                          <br />
                          <small className="text-muted">
                            Skipped: {item.skipReason}
                            <br />
                            By: {item.skippedBy} on {item.skippedAt ? new Date(item.skippedAt.seconds * 1000).toLocaleDateString() : 'Unknown'}
                          </small>
                        </div>
                        <div className="btn-group">
                          <button
                            className="btn btn-outline-success btn-sm"
                            onClick={() => handleConfirmSpecialItem(item)}
                            title="Ready to include in invoice"
                          >
                            ✅ Ready Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Special Item Skip Reason Modal */}
      {showSpecialItemModal && selectedSpecialItem && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Skip Special Item</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowSpecialItemModal(false);
                    setSelectedSpecialItem(null);
                    setSkipReason("");
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-warning">
                  <strong>⚠️ Skipping Special Item</strong>
                  <br />
                  <strong>{selectedSpecialItem.productName}</strong> for <strong>{selectedSpecialItem.clientName}</strong>
                </div>
                <div className="mb-3">
                  <label className="form-label">Reason for skipping *</label>
                  <select
                    className="form-select"
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    required
                  >
                    <option value="">-- Select a reason --</option>
                    <option value="Item not ready">Item not ready</option>
                    <option value="Still being washed">Still being washed</option>
                    <option value="Quality issue">Quality issue</option>
                    <option value="Customer requested delay">Customer requested delay</option>
                    <option value="Waiting for matching items">Waiting for matching items</option>
                    <option value="Item needs repair">Item needs repair</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                {skipReason === "Other" && (
                  <div className="mb-3">
                    <label className="form-label">Please specify</label>
                    <input
                      type="text"
                      className="form-control"
                      value={skipReason}
                      onChange={(e) => setSkipReason(e.target.value)}
                      placeholder="Enter custom reason..."
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowSpecialItemModal(false);
                    setSelectedSpecialItem(null);
                    setSkipReason("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  disabled={!skipReason}
                  onClick={() => {
                    handleSkipSpecialItem(selectedSpecialItem, skipReason);
                    setShowSpecialItemModal(false);
                    setSelectedSpecialItem(null);
                    setSkipReason("");
                  }}
                >
                  Skip Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Washing;
