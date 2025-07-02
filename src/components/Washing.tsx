import React, { useState, useEffect } from "react";
import { getClients } from "../services/firebaseService";
import { doc, updateDoc, addDoc } from "firebase/firestore";
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

  // Red alert overlay state for tunnel cart count mismatch
  const [showTunnelRedAlert, setShowTunnelRedAlert] = useState(false);
  const tunnelRedAlertTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // New state for per-group verification mode
  const [verifyingGroupIds, setVerifyingGroupIds] = useState<{
    [groupId: string]: boolean;
  }>({});

  const { user } = useAuth();
  const canReorder =
    user && ["Supervisor", "Admin", "Owner"].includes(user.role);

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
      // Create the group
      await addDoc(collection(db, "pickup_groups"), {
        clientId: client.id,
        clientName: client.name,
        status: "Conventional",
        washingType: "Conventional",
        carts: [cart],
        numCarts: numCarts,
        createdAt: Timestamp.now(),
        order: conventionalGroups.length, // add to end
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
        message: `Conventional group with product '${product.name}' added for client '${client.name}' by user`,
      });
    } catch (err: any) {
      setConventionalModalError(err.message || "Error adding product to group");
      setConventionalModalLoading(false);
    }
  };

  // --- Conventional Group Reordering ---
  // Ensure groups have an 'order' property for sorting
  useEffect(() => {
    // If any conventional group is missing 'order', assign it based on current order
    if (conventionalGroups.some((g) => typeof g.order !== "number")) {
      setGroups((prev) => {
        let changed = false;
        const updated = prev.map((g, idx) => {
          if (
            g.status === "Conventional" &&
            getWashingType(g.clientId) === "Conventional" &&
            typeof g.order !== "number"
          ) {
            changed = true;
            return { ...g, order: idx };
          }
          return g;
        });
        return changed ? updated : prev;
      });
    }
    // eslint-disable-next-line
  }, [conventionalGroups.length]);

  // Ensure Tunnel groups have an 'order' property for sorting
  useEffect(() => {
    if (tunnelGroups.some((g) => typeof g.order !== "number")) {
      setGroups((prev) => {
        let changed = false;
        const updated = prev.map((g, idx) => {
          if (
            g.status === "Tunnel" &&
            getWashingType(g.clientId) === "Tunnel" &&
            typeof g.order !== "number"
          ) {
            changed = true;
            return { ...g, order: idx };
          }
          return g;
        });
        return changed ? updated : prev;
      });
    }
    // eslint-disable-next-line
  }, [tunnelGroups.length]);

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
      // Sort by order or fallback to index
      const sorted = [...conventional].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      );
      const idx = sorted.findIndex((g) => g.id === groupId);
      if (idx === -1) return prevGroups;
      let newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= sorted.length) return prevGroups;
      // Swap order values
      const tempOrder = sorted[idx].order ?? idx;
      sorted[idx].order = sorted[newIdx].order ?? newIdx;
      sorted[newIdx].order = tempOrder;
      // Persist order changes to Firestore
      (async () => {
        try {
          await Promise.all([
            updateDoc(doc(db, "pickup_groups", sorted[idx].id), {
              order: sorted[idx].order,
            }),
            updateDoc(doc(db, "pickup_groups", sorted[newIdx].id), {
              order: sorted[newIdx].order,
            }),
          ]);
        } catch (e) {
          // Optionally handle error
        }
      })();
      // Rebuild groups array
      const newGroups = [...others, ...sorted];
      return newGroups;
    });
  };

  const [tunnelReorderLoading, setTunnelReorderLoading] = useState<
    string | null
  >(null);

  // Ensure Tunnel groups have a unique, consecutive 'order' property after every move
  const normalizeTunnelOrders = (groupsArr: any[]) => {
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
        } catch (e) {
          // Optionally handle error
        }
        setTunnelReorderLoading(null);
      })();
      return newGroups;
    });
  };

  // Move up/down for both manual products and client groups
  const moveConventionalRow = async (id: string, direction: "up" | "down") => {
    // If it's a manual product, just reorder in local state (optional: persist order if needed)
    const manualIdx = manualConventionalProducts.findIndex((p) => p.id === id);
    if (manualIdx !== -1) {
      setManualConventionalProducts((prev) => {
        const arr = [...prev];
        const newIdx = direction === "up" ? manualIdx - 1 : manualIdx + 1;
        if (newIdx < 0 || newIdx >= arr.length) return arr;
        [arr[manualIdx], arr[newIdx]] = [arr[newIdx], arr[manualIdx]];
        return arr;
      });
      // Optionally: persist order to Firestore if needed
      return;
    }
    // Otherwise, it's a client group
    await moveConventionalGroup(id, direction);
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
      message: `Manual product ${id} marked as washed by user`,
      // Optionally, add user context if available
    });
  };

  // Handler to mark a conventional client group as washed
  const handleMarkConventionalGroupWashed = async (group: any) => {
    // 1. Update pickup group status to 'Empaque'
    await updateDoc(doc(db, "pickup_groups", group.id), {
      status: "Empaque",
      washed: true,
    });
    // 2. Create an invoice for the client
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
        message: `Group ${group.clientName} marked as washed by user`,
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

  return (
    <div className="container py-4">
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
              padding: "3.5rem 2.5rem 2.5rem 2.5rem",
              marginBottom: 40,
              marginTop: 18,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
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
                style={{ maxWidth: 1000, margin: "0 auto" }}
              >
                {tunnelGroups.map((group, idx) => {
                  const isVerified = !!verifiedGroups[group.id];
                  const cartCounter = cartCounters[group.id] || 0;
                  const isLocked =
                    group.showInTunnel && group.segregationComplete;
                  const maxCarts = getSegregatedCarts(group);
                  const isVerifying = verifyingGroupIds[group.id];
                  return (
                    <div
                      key={group.id}
                      className="list-group-item d-flex flex-row align-items-center justify-content-between gap-4 py-4 mb-3 shadow-sm rounded"
                      style={{
                        background: isLocked ? "#cce5ff" : "#fff",
                        border: "2px solid #e3e3e3",
                        fontSize: 20,
                        minHeight: 90,
                        boxShadow: "0 2px 12px rgba(14,98,160,0.07)",
                      }}
                    >
                      <div
                        className="d-flex flex-column flex-md-row align-items-md-center gap-4 flex-grow-1"
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <span
                          style={{
                            fontSize: "1.5rem",
                            fontWeight: 700,
                            color: "#007bff",
                            minWidth: 180,
                          }}
                        >
                          {group.clientName}
                        </span>
                        <span
                          style={{
                            fontSize: "1.2rem",
                            color: "#28a745",
                            minWidth: 120,
                          }}
                        >
                          Total:{" "}
                          <strong>
                            {typeof group.totalWeight === "number"
                              ? group.totalWeight.toFixed(2)
                              : "?"}{" "}
                            lbs
                          </strong>
                        </span>
                        {/* If locked, skip verification and show counter directly */}
                        {isLocked ? (
                          <div className="d-flex align-items-center gap-2">
                            <span style={{ fontSize: "1.1rem", color: "#333" }}>
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
                              disabled={cartCounter >= maxCarts}
                              onClick={async () => {
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
                              disabled={cartCounter <= 0}
                              onClick={async () => {
                                const newCount = Math.max(cartCounter - 1, 0);
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
                                onClick={async () => {
                                  // Only allow if value matches segregatedCarts
                                  if (cartCounter !== maxCarts) {
                                    alert(
                                      "Error: The number of carts does not match the segregation value."
                                    );
                                    return;
                                  }
                                  const { updatePickupGroupStatus } =
                                    await import("../services/firebaseService");
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
                                  setTunnelCartInput("");
                                  setTunnelCartError("");
                                }}
                              >
                                Done
                              </button>
                            )}
                          </div>
                        ) : !isVerified ? (
                          <div style={{ minWidth: 220 }}>
                            {/* Always show the button, and show the input if verifying */}
                            {!isVerifying ? (
                              <button
                                className="btn btn-outline-primary btn-sm"
                                onClick={() =>
                                  setVerifyingGroupIds((ids) => ({
                                    ...ids,
                                    [group.id]: true,
                                  }))
                                }
                              >
                                Verify Cart Count
                              </button>
                            ) : (
                              <>
                                {/* Only show segregated carts value for Supervisor or higher */}
                                {canReorder && (
                                  <div className="mb-2 text-secondary small">
                                    Segregated Carts:{" "}
                                    <strong>{getSegregatedCarts(group)}</strong>
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
                                />
                                {tunnelCartError && (
                                  <div className="text-danger small">
                                    {tunnelCartError}
                                  </div>
                                )}
                                <button
                                  className="btn btn-primary btn-sm ms-2"
                                  onClick={async () => {
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
                                >
                                  Verify
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm ms-2"
                                  onClick={() => {
                                    setVerifyingGroupIds((ids) => ({
                                      ...ids,
                                      [group.id]: false,
                                    }));
                                    setTunnelCartInput("");
                                    setTunnelCartError("");
                                  }}
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          // Counting step: show counter if verified
                          <div className="d-flex align-items-center gap-2">
                            <span style={{ fontSize: "1.1rem", color: "#333" }}>
                              {cartCounter} / {getSegregatedCarts(group)}
                            </span>
                            <button
                              className="btn btn-outline-primary btn-sm"
                              disabled={
                                cartCounter >= getSegregatedCarts(group)
                              }
                              onClick={async () => {
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
                              className="btn btn-outline-secondary btn-sm"
                              disabled={cartCounter <= 0}
                              onClick={async () => {
                                const newCount = Math.max(cartCounter - 1, 0);
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
                              -
                            </button>
                            {cartCounter === getSegregatedCarts(group) && (
                              <button
                                className="btn btn-success btn-sm ms-2"
                                disabled={
                                  !!group.invoiceId ||
                                  group.washed ||
                                  tunnelInvoiceInProgress[group.id]
                                }
                                onClick={async () => {
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
                                    const { db } = await import("../firebase");
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
                        style={{ minWidth: 220, maxWidth: 260 }}
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
                              onClick={() => moveTunnelGroup(group.id, "down")}
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
                    {clientsForConventional.map((client) => (
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
                    {products.map((product) => (
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
                        background: group.isManualProduct ? "#fffbe6" : "#fff",
                        marginBottom: 8,
                        minHeight: 90,
                        fontSize: 20,
                        alignItems: "center",
                        maxWidth: 1000,
                        width: "100%",
                      }}
                    >
                      {/* Info section */}
                      <div
                        className="d-flex flex-column flex-md-row align-items-md-center gap-4 flex-grow-1"
                        style={{ minWidth: 0 }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            color: group.isManualProduct
                              ? "#b8860b"
                              : "#007bff",
                            fontSize: "1.5rem",
                            maxWidth: 180,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            lineHeight: 1.1,
                            display: "block",
                            minWidth: 180,
                          }}
                          title={group.clientName}
                        >
                          {group.clientName}
                        </span>
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
                        {/* Weight section */}
                        {!group.isManualProduct && (
                          <span
                            style={{
                              fontSize: "1.2rem",
                              color: "#28a745",
                              minWidth: 120,
                              textAlign: "center",
                            }}
                          >
                            Total:{" "}
                            <strong>
                              {typeof group.totalWeight === "number"
                                ? group.totalWeight.toLocaleString(undefined, {
                                    maximumFractionDigits: 0,
                                  })
                                : "?"}{" "}
                              lbs
                            </strong>
                          </span>
                        )}
                      </div>
                      {/* Actions section */}
                      <div
                        className="d-flex flex-row align-items-center gap-2"
                        style={{ minWidth: 220, maxWidth: 260 }}
                      >
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
                              disabled={idx === allConventionalRows.length - 1}
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
            zIndex: 9999,
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
    </div>
  );
};

export default Washing;
