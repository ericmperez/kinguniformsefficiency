import React, { useState, useMemo, useEffect, useRef } from "react";
import { Client } from "../types";
import { AlertService } from "../services/AlertService";
import {
  UserRecord,
  addPickupEntry,
  updatePickupEntry,
  deletePickupEntry,
  addPickupGroup,
  updatePickupGroupStatus,
  getTodayPickupGroups,
  logActivity,
} from "../services/firebaseService";
import {
  collection,
  deleteDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";

interface Driver {
  id: string;
  name: string;
  linkedUserId?: string; // Link to user account
  linkedUsername?: string; // Cached username for display
}

interface PickupEntry {
  id?: string;
  clientId: string;
  clientName: string;
  driverId: string;
  driverName: string;
  groupId: string;
  weight: number;
  cartId: string; // New field for cart identification
  timestamp: Date | Timestamp;
}

interface PickupGroup {
  id: string;
  clientId: string;
  clientName: string;
  driverId: string;
  driverName: string;
  startTime: string;
  endTime: string;
  totalWeight: number;
  status: string;
}

interface PickupWashingProps {
  clients: Client[];
  drivers: Driver[];
  onNavigateHome?: () => void; // New prop for navigation
}

export default function PickupWashing({
  clients,
  drivers,
  onNavigateHome,
}: PickupWashingProps) {
  // Add responsive styles
  const getResponsiveStyles = () => {
    const isMobile = window.innerWidth <= 768;
    const isTablet = window.innerWidth <= 1024;

    return {
      fontSize: {
        title: isMobile ? "1.8rem" : isTablet ? "2.2rem" : "2.8rem", // Reduced sizes
        label: isMobile ? "1.1rem" : isTablet ? "1.3rem" : "1.5rem", // Reduced sizes
        input: isMobile ? "1.1rem" : isTablet ? "1.2rem" : "1.4rem", // Reduced sizes
        weightInput: isMobile ? "1.3rem" : isTablet ? "1.5rem" : "1.7rem", // Reduced sizes
        button: isMobile ? "1.3rem" : isTablet ? "1.5rem" : "1.7rem", // Reduced sizes
        keypad: isMobile ? "1.3rem" : isTablet ? "1.5rem" : "1.7rem",
      },
      padding: {
        container: isMobile ? "8px" : isTablet ? "15px" : "20px", // Reduced padding
        input: isMobile ? "10px" : isTablet ? "12px" : "15px", // Reduced padding
        weightInput: isMobile ? "12px" : isTablet ? "15px" : "18px", // Reduced padding
        button: isMobile ? "12px" : isTablet ? "15px" : "18px", // Reduced padding
      },
      keypadSize: {
        width: isMobile ? 60 : isTablet ? 70 : 80,
        height: isMobile ? 60 : isTablet ? 70 : 80,
      },
      historyPanel: {
        width: isMobile ? "90vw" : isTablet ? "70vw" : "60vw",
        right: isMobile ? "-90vw" : isTablet ? "-70vw" : "-60vw",
      },
    };
  };

  const [responsiveStyles, setResponsiveStyles] = useState(
    getResponsiveStyles()
  );

  // Update responsive styles on window resize
  useEffect(() => {
    const handleResize = () => {
      setResponsiveStyles(getResponsiveStyles());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [clientId, setClientId] = useState("");
  const [weight, setWeight] = useState("");
  const [cartId, setCartId] = useState(""); // New state for cart ID
  const [driverId, setDriverId] = useState("");
  const [success, setSuccess] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState<string>("");
  const [editCartId, setEditCartId] = useState<string>(""); // New edit state for cart ID
  const [groupStatusUpdating, setGroupStatusUpdating] = useState<string | null>(
    null
  );
  const weightInputRef = useRef<HTMLInputElement>(null);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showFullScreenSuccess, setShowFullScreenSuccess] = useState(false);
  const [showCartPopup, setShowCartPopup] = useState(false); // New state for cart popup
  const [showCartKeypad, setShowCartKeypad] = useState(false); // New state for cart ID keypad
  const [showConfirmationModal, setShowConfirmationModal] = useState(false); // New state for confirmation modal
  const [submitting, setSubmitting] = useState(false);
  const [showAddEntryGroupId, setShowAddEntryGroupId] = useState<string | null>(
    null
  );
  const [addEntryWeight, setAddEntryWeight] = useState("");
  const [addEntryCartId, setAddEntryCartId] = useState(""); // New state for adding cart ID to group
  const [addEntryDriverId, setAddEntryDriverId] = useState("");
  const [addEntrySubmitting, setAddEntrySubmitting] = useState(false);

  // State for side panel visibility
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Fetch today's groups in real time
  useEffect(() => {
    // Get today's date range in local time
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const q = query(
      collection(db, "pickup_groups"),
      where("startTime", ">=", Timestamp.fromDate(today)),
      where("startTime", "<", Timestamp.fromDate(tomorrow))
    );
    const unsub = onSnapshot(q, (snap) => {
      const fetchedGroups = snap.docs.map((doc) => {
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
      setGroups(fetchedGroups);
    });
    return () => unsub();
  }, []);

  // Sort clients alphabetically by name
  const sortedClients = [...clients].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Sort drivers alphabetically by name
  const sortedDrivers = [...drivers].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // --- Helper to update group in Firestore ---
  const updateGroupTotals = async (
    groupId: string,
    entriesForGroup: PickupEntry[]
  ) => {
    if (!groupId) return;
    if (entriesForGroup.length === 0) return;
    const totalWeight = entriesForGroup.reduce((sum, e) => sum + e.weight, 0);
    // Convert all timestamps to Date for comparison
    const getDate = (t: Date | Timestamp) =>
      t instanceof Date ? t : t.toDate();
    const endTimeDate = entriesForGroup.reduce(
      (latest, e) =>
        getDate(e.timestamp) > latest ? getDate(e.timestamp) : latest,
      getDate(entriesForGroup[0].timestamp)
    );
    await updateDoc(doc(db, "pickup_groups", groupId), {
      totalWeight,
      endTime:
        endTimeDate instanceof Timestamp
          ? endTimeDate
          : Timestamp.fromDate(new Date(endTimeDate)),
    });
  };

  // When adding a new entry, check if it fits an existing group or needs a new group
  const handleActualSubmit = async () => {
    if (submitting) return; // Prevent double submit
    setSubmitting(true);
    setSuccess(false);
    const client = sortedClients.find((c) => c.id === clientId);
    const driver = drivers.find((d) => d.id === driverId);
    if (!client || !driver || !weight || !cartId.trim()) {
      setSubmitting(false);
      return;
    }
    const now = new Date();

    // Check for duplicate cart ID across all entries for this client
    const existingCartId = entries.find(
      (e) => e.clientId === client.id && e.cartId === cartId.trim()
    );
    if (existingCartId) {
      alert(
        `El Cart ID "${cartId.trim()}" ya está registrado para este cliente. Por favor, use un Cart ID diferente.`
      );
      setSubmitting(false);
      return;
    }

    // Change window from 2 minutes to 60 minutes (1 hour)
    const sixtyMinutesAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Find the most recent entry for this client and driver
    const recentEntry = entries
      .filter((e) => e.clientId === client.id && e.driverId === driver.id)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];
    let groupId: string | null = null;
    if (recentEntry && new Date(recentEntry.timestamp) >= sixtyMinutesAgo) {
      // Check for duplicate entry in the last 60 minutes for this client, driver, group, weight, and cart ID
      if (
        recentEntry.weight === parseFloat(weight) &&
        recentEntry.cartId === cartId.trim() &&
        recentEntry.groupId
      ) {
        alert(
          "Ya existe una entrada similar registrada recientemente con el mismo Cart ID. Por favor, verifique."
        );
        setSubmitting(false);
        return;
      }
      groupId = recentEntry.groupId;
    }
    let groupData: PickupGroup | null = null;
    if (!groupId) {
      // Create new group
      let initialStatus = "Segregation";
      let newOrder: number | undefined = undefined;
      if (!client.segregation) {
        if (client.washingType === "Tunnel") {
          initialStatus = "Tunnel";
          // Find the highest order among current tunnel groups
          const tunnelGroups = groups.filter(
            (g) => g.status === "Tunnel" && client.washingType === "Tunnel"
          );
          const maxOrder = tunnelGroups.reduce(
            (max, g) =>
              typeof g.order === "number" && g.order > max ? g.order : max,
            -1
          );
          newOrder = maxOrder + 1;
        } else if (client.washingType === "Conventional") {
          initialStatus = "Conventional";
        }
      }
      const groupData = {
        clientId: client.id,
        clientName: client.name,
        driverId: driver.id,
        driverName: driver.name,
        startTime: now,
        endTime: now,
        totalWeight: parseFloat(weight),
        status: initialStatus,
        ...(typeof newOrder === "number" ? { order: newOrder } : {}),
      };
      const groupRef = await addPickupGroup(groupData);
      groupId = groupRef.id;
      setGroups([{ ...groupData, id: groupId }, ...groups]);
    }
    const entry: Omit<PickupEntry, "id"> = {
      clientId: client.id,
      clientName: client.name,
      driverId: driver.id,
      driverName: driver.name,
      groupId: groupId!,
      weight: parseFloat(weight),
      cartId: cartId.trim(),
      timestamp: now,
    };
    try {
      const docRef = await addPickupEntry(entry);
      const newEntry: PickupEntry = { ...entry, id: docRef.id };
      setEntries([newEntry, ...entries]);
      // Update group totals
      const updatedEntries = [newEntry, ...entries].filter(
        (e) => e.groupId === groupId
      );
      await updateGroupTotals(groupId!, updatedEntries);
      // After updating group totals (on add, edit, or delete), also update numCarts in Firestore
      await updateDoc(doc(db, "pickup_groups", groupId), {
        numCarts: updatedEntries.length,
      });
      // Also update segregatedCarts for Tunnel/no-segregation clients
      const groupSnap = await getDocs(
        query(collection(db, "pickup_groups"), where("id", "==", groupId))
      );
      if (!groupSnap.empty) {
        const groupData = groupSnap.docs[0].data();
        const client = clients.find((c) => c.id === groupData.clientId);
        if (
          client &&
          client.washingType === "Tunnel" &&
          client.segregation === false
        ) {
          await updateDoc(doc(db, "pickup_groups", groupId), {
            segregatedCarts: updatedEntries.length,
          });
        }
      }
      setSuccess(true);
      setShowFullScreenSuccess(true); // Show full-screen confirmation
      setTimeout(() => {
        setShowFullScreenSuccess(false); // Hide after 5 seconds
        setSubmitting(false); // <-- Re-enable submit button after green screen
      }, 5000);
      setTimeout(() => setSuccess(false), 2000);
      // Do not clear clientId or driverId so they remain prepopulated
      setWeight("");
      setCartId(""); // Clear cart ID after successful submission
      setShowKeypad(false); // Hide keypad on submit
      await logActivity({
        type: "Pickup",
        message: `Pickup entry added for client '${client.name}' by driver '${driver.name}'`,
      });
    } catch (err) {
      alert("Error al guardar la entrada en Firebase");
      setSubmitting(false);

      // Create system alert for pickup entry error
      try {
        await AlertService.createAlert({
          type: "system_error",
          severity: "medium",
          title: "Pickup Entry Save Error",
          message: `Failed to save pickup entry for client ${
            client.name
          }, driver ${driver.name}, weight ${weight}lbs. Error: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
          component: "Pickup/Washing",
          clientName: client.name,
          userName: driver.name,
          triggerData: {
            clientId: client.id,
            driverId: driver.id,
            weight: parseFloat(weight),
            operation: "save_pickup_entry",
          },
          createdBy: "System",
        });
      } catch (alertError) {
        console.error(
          "Failed to create alert for pickup entry error:",
          alertError
        );
      }
    }
  };

  // Grouped entries by groupId (using Firestore groups)
  const groupedEntries = useMemo(() => {
    // Sort groups by most recent (latest endTime or startTime) first
    let result = groups
      .map((group) => {
        const groupEntries = entries.filter((e) => e.groupId === group.id);
        const totalWeight = groupEntries.reduce((sum, e) => sum + e.weight, 0);
        // Find the latest timestamp in the group's entries, fallback to group.endTime/startTime
        let latest = group.endTime
          ? new Date(group.endTime)
          : new Date(group.startTime);
        if (groupEntries.length > 0) {
          const maxEntry = groupEntries.reduce((max, e) => {
            const t =
              e.timestamp instanceof Date ? e.timestamp : new Date(e.timestamp);
            return t > max ? t : max;
          }, latest);
          latest = maxEntry;
        }
        return {
          ...group,
          entries: groupEntries,
          totalWeight,
          _latest: latest,
        };
      })
      .filter((g) => g.entries.length > 0);
    // Find the most recent group
    if (result.length > 1) {
      result.sort((a, b) => {
        const dateA =
          a._latest instanceof Date
            ? a._latest.getTime()
            : new Date(a._latest).getTime();
        const dateB =
          b._latest instanceof Date
            ? b._latest.getTime()
            : new Date(b._latest).getTime();
        return dateB - dateA;
      });
      // Move the most recent group to the top explicitly (in case of equal timestamps, preserves most recent submission)
      const mostRecent = result[0];
      result = [mostRecent, ...result.filter((g) => g !== mostRecent)];
    }
    return result;
  }, [groups, entries]);

  // Edit an entry's weight and cart ID inline
  const handleEditEntry = (entry: any) => {
    setEditEntryId(entry.id);
    setEditWeight(entry.weight.toString());
    setEditCartId(entry.cartId || ""); // Set cart ID for editing
  };
  const handleEditSave = async (entry: PickupEntry) => {
    if (isNaN(parseFloat(editWeight)) || !editCartId.trim()) return;
    try {
      await updatePickupEntry(entry.id!, {
        weight: parseFloat(editWeight),
        cartId: editCartId.trim(),
      });
      const updatedEntries = entries.map((e) =>
        e.id === entry.id
          ? { ...e, weight: parseFloat(editWeight), cartId: editCartId.trim() }
          : e
      );
      setEntries(updatedEntries);
      // Update group totals
      const groupEntries = updatedEntries.filter(
        (e) => e.groupId === entry.groupId
      );
      await updateGroupTotals(entry.groupId, groupEntries);
      // After updating group totals (on add, edit, or delete), also update numCarts in Firestore
      await updateDoc(doc(db, "pickup_groups", entry.groupId), {
        numCarts: groupEntries.length,
      });
      // Also update segregatedCarts for Tunnel/no-segregation clients
      const groupSnap = await getDocs(
        query(collection(db, "pickup_groups"), where("id", "==", entry.groupId))
      );
      if (!groupSnap.empty) {
        const groupData = groupSnap.docs[0].data();
        const client = clients.find((c) => c.id === groupData.clientId);
        if (
          client &&
          client.washingType === "Tunnel" &&
          client.segregation === false
        ) {
          await updateDoc(doc(db, "pickup_groups", entry.groupId), {
            segregatedCarts: groupEntries.length,
          });
        }
      }
      setEditEntryId(null);
      setEditWeight("");
      setEditCartId(""); // Clear cart ID after successful edit
      await logActivity({
        type: "Pickup",
        message: `Pickup entry edited for client '${entry.clientName}' by driver '${entry.driverName}'`,
      });
    } catch (err) {
      alert("Error al editar la entrada");
    }
  };
  const handleEditCancel = () => {
    setEditEntryId(null);
    setEditWeight("");
    setEditCartId(""); // Clear cart ID when canceling edit
  };

  // Delete an entry
  const handleDeleteEntry = async (group: PickupGroup, entry: PickupEntry) => {
    if (!window.confirm("¿Eliminar esta entrada?")) return;
    try {
      await deletePickupEntry(entry.id!);
      const updatedEntries = entries.filter((e) => e.id !== entry.id);
      setEntries(updatedEntries);
      // Update group totals
      const groupEntries = updatedEntries.filter((e) => e.groupId === group.id);
      await updateGroupTotals(group.id, groupEntries);
      // After updating group totals (on add, edit, or delete), also update numCarts in Firestore
      await updateDoc(doc(db, "pickup_groups", group.id), {
        numCarts: groupEntries.length,
      });
      // Also update segregatedCarts for Tunnel/no-segregation clients
      const groupSnap = await getDocs(
        query(collection(db, "pickup_groups"), where("id", "==", group.id))
      );
      if (!groupSnap.empty) {
        const groupData = groupSnap.docs[0].data();
        const client = clients.find((c) => c.id === groupData.clientId);
        if (
          client &&
          client.washingType === "Tunnel" &&
          client.segregation === false
        ) {
          await updateDoc(doc(db, "pickup_groups", group.id), {
            segregatedCarts: groupEntries.length,
          });
        }
      }
      await logActivity({
        type: "Pickup",
        message: `Pickup entry deleted for client '${entry.clientName}' by driver '${entry.driverName}'`,
      });
    } catch (err) {
      alert("Error al eliminar la entrada");
    }
  };

  // Handler to update group status
  const handleStatusChange = async (groupId: string, status: string) => {
    setGroupStatusUpdating(groupId);
    await updatePickupGroupStatus(groupId, status);
    setGroupStatusUpdating(null);
  };

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
          clientId: data.clientId,
          clientName: data.clientName,
          driverId: data.driverId,
          driverName: data.driverName,
          groupId: data.groupId,
          weight: data.weight,
          cartId: data.cartId || "", // Include cart ID from database
          timestamp:
            data.timestamp instanceof Timestamp
              ? data.timestamp.toDate()
              : new Date(data.timestamp),
        };
      });
      setEntries(
        fetched.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
      );
    });
    return () => unsub();
  }, []);

  // Find the most recent entry for prepopulation
  const lastEntry = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    // Sort by timestamp descending
    return [...entries].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
  }, [entries]);

  // Prepopulate client and driver from last entry if empty
  useEffect(() => {
    if (lastEntry) {
      if (!clientId) setClientId(lastEntry.clientId);
      if (!driverId) setDriverId(lastEntry.driverId);
    }
  }, [lastEntry]);

  // Keypad input handler
  const handleKeypadInput = (val: string) => {
    setWeight((prev) => {
      if (val === "C") return "";
      if (val === "←") return prev.slice(0, -1);
      return prev + val;
    });
    if (weightInputRef.current) weightInputRef.current.focus();
  };

  // Handle weight confirmation and show cart popup
  const handleWeightConfirmation = () => {
    if (!clientId || !driverId || !weight) {
      alert("Por favor complete Cliente, Chofer y Peso antes de continuar.");
      return;
    }
    setShowKeypad(false);
    setShowCartPopup(true);
  };

  // Handle confirmation modal
  const handleShowConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !driverId || !weight || !cartId.trim()) {
      alert("Por favor complete todos los campos requeridos (Cliente, Chofer, Peso y Cart ID) antes de continuar.");
      return;
    }
    setShowConfirmationModal(true);
  };

  const handleConfirmSubmission = () => {
    setShowConfirmationModal(false);
    handleActualSubmit();
  };

  // New submit handler that shows confirmation modal first
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleShowConfirmation(e);
  };

  // Cart ID keypad input handler
  const handleCartKeypadInput = (val: string) => {
    setCartId((prev) => {
      if (val === "C") return "";
      if (val === "←") return prev.slice(0, -1);
      return prev + val;
    });
  };

  // Add this handler below other handlers
  const handleDeleteGroup = async (groupId: string) => {
    if (
      !window.confirm(
        "¿Eliminar todo el grupo y todas sus entradas? Esta acción no se puede deshacer."
      )
    )
      return;
    try {
      // Delete all pickup_entries for this group
      const entriesSnap = await getDocs(
        query(collection(db, "pickup_entries"), where("groupId", "==", groupId))
      );
      const batchDeletes = entriesSnap.docs.map((docSnap) =>
        deleteDoc(doc(db, "pickup_entries", docSnap.id))
      );
      await Promise.all(batchDeletes);
      // Delete the group itself
      await deleteDoc(doc(db, "pickup_groups", groupId));
      // Remove from UI state
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setEntries((prev) => prev.filter((e) => e.groupId !== groupId));
    } catch (err) {
      alert("Error al eliminar el grupo");
    }
  };

  // Handler to add entry directly to a group
  const handleAddEntryToGroup = async (group: any) => {
    if (!addEntryWeight || !addEntryDriverId || !addEntryCartId.trim()) return;
    setAddEntrySubmitting(true);
    const driver = drivers.find((d) => d.id === addEntryDriverId);
    if (!driver) {
      setAddEntrySubmitting(false);
      return;
    }
    const now = new Date();
    const entry: Omit<PickupEntry, "id"> = {
      clientId: group.clientId,
      clientName: group.clientName,
      driverId: driver.id,
      driverName: driver.name,
      groupId: group.id,
      weight: parseFloat(addEntryWeight),
      cartId: addEntryCartId.trim(),
      timestamp: now,
    };
    try {
      const docRef = await addPickupEntry(entry);
      const newEntry: PickupEntry = { ...entry, id: docRef.id };
      setEntries([newEntry, ...entries]);
      // Update group totals
      const updatedEntries = [newEntry, ...entries].filter(
        (e) => e.groupId === group.id
      );
      await updateGroupTotals(group.id, updatedEntries);
      await updateDoc(doc(db, "pickup_groups", group.id), {
        numCarts: updatedEntries.length,
      });
      // Also update segregatedCarts for Tunnel/no-segregation clients
      const groupSnap = await getDocs(
        query(collection(db, "pickup_groups"), where("id", "==", group.id))
      );
      if (!groupSnap.empty) {
        const groupData = groupSnap.docs[0].data();
        const client = clients.find((c) => c.id === groupData.clientId);
        if (
          client &&
          client.washingType === "Tunnel" &&
          client.segregation === false
        ) {
          await updateDoc(doc(db, "pickup_groups", group.id), {
            segregatedCarts: updatedEntries.length,
          });
        }
      }
      setShowAddEntryGroupId(null);
      setAddEntryWeight("");
      setAddEntryCartId(""); // Clear cart ID after adding entry to group
      setAddEntryDriverId("");
    } catch (err) {
      alert("Error al guardar la entrada en Firebase");
    }
    setAddEntrySubmitting(false);
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
        padding: 0,
        position: "fixed",
        top: 0,
        left: 0,
        overflow: "hidden",
      }}
    >
      {/* Full-screen confirmation overlay */}
      {showFullScreenSuccess && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(40,167,69,0.97)",
            color: "#fff",
            zIndex: 1500,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2.5rem",
            fontWeight: 700,
            letterSpacing: 1,
            textAlign: "center",
            transition: "opacity 0.3s",
          }}
        >
          <div style={{ fontSize: "4rem", marginBottom: 24 }}>✔️</div>
          ¡Entrada registrada exitosamente!
        </div>
      )}

      {/* History Side Panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: showHistoryPanel ? 0 : responsiveStyles.historyPanel.right,
          width: responsiveStyles.historyPanel.width,
          height: "100vh",
          background: "#fff",
          boxShadow: "-5px 0 20px rgba(0,0,0,0.3)",
          zIndex: 1000,
          transition: "right 0.3s ease-in-out",
          overflowY: "auto",
          padding: "30px",
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h3 style={{ fontSize: "2.5rem", fontWeight: "bold", color: "#333" }}>
            Historial de Entradas
          </h3>
          <button
            className="btn btn-outline-secondary btn-lg"
            onClick={() => setShowHistoryPanel(false)}
            style={{ fontSize: "1.8rem", padding: "15px 25px" }}
          >
            ✕ Cerrar
          </button>
        </div>

        {/* Grouped entries table inside panel */}
        {groupedEntries.length > 0 ? (
          <div>
            {groupedEntries.map((group, idx) => (
              <div
                key={idx}
                className="mb-5 p-3 border rounded"
                style={{ background: "#f8f9fa" }}
              >
                <div className="mb-3 d-flex align-items-center justify-content-between">
                  <div>
                    <div
                      style={{
                        fontSize: "1.3rem",
                        fontWeight: "bold",
                        color: "#007bff",
                      }}
                    >
                      {group.clientName}
                    </div>
                    <div
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: "bold",
                        color: "#28a745",
                      }}
                    >
                      Chofer: {group.driverName}
                    </div>
                    <div style={{ fontSize: "1rem", color: "#6c757d" }}>
                      Carros: {group.entries.length} | Peso total:{" "}
                      {Math.round(group.totalWeight)} lbs
                    </div>
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteGroup(group.id)}
                    style={{ fontSize: "0.9rem" }}
                  >
                    Eliminar Grupo
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="table table-sm table-bordered">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Peso (libras)</th>
                        <th>Cart ID</th>
                        <th>Hora</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries
                        .slice()
                        .reverse()
                        .map((entry: PickupEntry, i: number) => {
                          let timeString = "";
                          if (entry.timestamp instanceof Date) {
                            timeString = entry.timestamp.toLocaleTimeString();
                          } else if (
                            entry.timestamp &&
                            typeof entry.timestamp.toDate === "function"
                          ) {
                            timeString = entry.timestamp
                              .toDate()
                              .toLocaleTimeString();
                          } else {
                            timeString = new Date(
                              entry.timestamp as any
                            ).toLocaleTimeString();
                          }
                          return (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td>
                                {editEntryId === entry.id ? (
                                  <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    value={editWeight}
                                    onChange={(e) =>
                                      setEditWeight(e.target.value)
                                    }
                                    style={{
                                      width: 80,
                                      display: "inline-block",
                                    }}
                                    autoFocus
                                    inputMode="numeric"
                                  />
                                ) : (
                                  entry.weight
                                )}
                              </td>
                              <td>
                                {editEntryId === entry.id ? (
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={editCartId}
                                    onChange={(e) =>
                                      setEditCartId(e.target.value)
                                    }
                                    style={{
                                      width: 100,
                                      display: "inline-block",
                                    }}
                                    placeholder="Cart ID"
                                    inputMode="text"
                                  />
                                ) : (
                                  <span className="badge bg-info">
                                    {entry.cartId || "N/A"}
                                  </span>
                                )}
                              </td>
                              <td>{timeString}</td>
                              <td>
                                {editEntryId === entry.id ? (
                                  <>
                                    <button
                                      className="btn btn-success btn-sm me-2"
                                      onClick={() => handleEditSave(entry)}
                                    >
                                      Guardar
                                    </button>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={handleEditCancel}
                                    >
                                      Cancelar
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="btn btn-outline-primary btn-sm me-2"
                                      onClick={() => handleEditEntry(entry)}
                                    >
                                      Editar
                                    </button>
                                    <button
                                      className="btn btn-outline-danger btn-sm"
                                      onClick={() =>
                                        handleDeleteEntry(group, entry)
                                      }
                                    >
                                      Eliminar
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Add Entry Button and Inline Form */}
                {showAddEntryGroupId === group.id ? (
                  <form
                    className="d-flex align-items-end gap-2 mt-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddEntryToGroup(group);
                    }}
                  >
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Peso (libras)"
                      value={addEntryWeight}
                      min={0}
                      step={0.1}
                      onChange={(e) => setAddEntryWeight(e.target.value)}
                      style={{ maxWidth: 120 }}
                      required
                      inputMode="numeric"
                    />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Cart ID"
                      value={addEntryCartId}
                      onChange={(e) => setAddEntryCartId(e.target.value)}
                      style={{ maxWidth: 120 }}
                      required
                      inputMode="text"
                    />
                    <select
                      className="form-control"
                      value={addEntryDriverId}
                      onChange={(e) => setAddEntryDriverId(e.target.value)}
                      required
                      style={{ maxWidth: 180 }}
                    >
                      <option value="">Seleccione chofer</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-success"
                      type="submit"
                      disabled={addEntrySubmitting}
                    >
                      Agregar
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => setShowAddEntryGroupId(null)}
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <button
                    className="btn btn-outline-primary btn-sm mt-2"
                    onClick={() => {
                      setShowAddEntryGroupId(group.id);
                      setAddEntryWeight("");
                      setAddEntryCartId(""); // Clear cart ID when opening add entry form
                      setAddEntryDriverId(driverId || drivers[0]?.id || "");
                    }}
                  >
                    + Añadir entrada a este grupo
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="text-center text-muted p-5"
            style={{ fontSize: "1.2rem" }}
          >
            <i className="fas fa-clipboard-list fa-3x mb-3"></i>
            <div>No hay entradas registradas hoy</div>
          </div>
        )}
      </div>

      {/* Main Content - Full Width Layout */}
      <div
        style={{
          display: "flex",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Main Form - Centered */}
        <div
          style={{
            width: "100%",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.95)",
              borderRadius: "15px",
              padding: "10px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              width: "100%",
              maxWidth: "600px",
              height: "92vh", // Use viewport height
              overflow: "hidden",
              backdropFilter: "blur(15px)",
              display: "grid",
              gridTemplateRows: "auto 1fr auto", // Header, scrollable content, footer
              gap: "5px",
            }}
          >
            <h1
              className="text-center"
              style={{
                fontSize: window.innerWidth <= 768 ? "1.5rem" : "2rem",
                fontWeight: "bold",
                color: "#333",
                textShadow: "2px 2px 4px rgba(0,0,0,0.1)",
                margin: "0",
              }}
            >
              🚛 Registro de Entradas
            </h1>

            <form
              onSubmit={handleSubmit}
              style={{
                overflow: "hidden",
                display: "grid",
                gridTemplateRows: "1fr auto", // Content, submit button
                gap: "5px",
              }}
            >
              <div
                style={{
                  overflow: "auto",
                  display: "grid",
                  gridTemplateRows: "auto auto auto auto auto", // Fixed rows for form elements
                  gap: "3px", // Reduced gap between form elements
                  paddingRight: "3px",
                }}
              >
                {/* Cliente */}
                <div>
                  <label
                    className="form-label"
                    style={{
                      fontSize: window.innerWidth <= 768 ? "1.1rem" : "1.3rem",
                      fontWeight: "bold",
                      color: "#555",
                      marginBottom: "2px",
                      display: "block",
                    }}
                  >
                    Cliente <span style={{ color: "#dc3545" }}>*</span>
                  </label>
                  <select
                    className="form-control"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                    style={{
                      fontSize: window.innerWidth <= 768 ? "1.1rem" : "1.3rem",
                      padding: window.innerWidth <= 768 ? "12px" : "15px",
                      borderRadius: "12px",
                      border: "2px solid #ddd",
                      background: "#fff",
                      width: "100%",
                      minHeight: "50px",
                    }}
                  >
                    <option value="">Seleccione un cliente</option>
                    {sortedClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chofer */}
                <div>
                  <label
                    className="form-label"
                    style={{
                      fontSize: window.innerWidth <= 768 ? "1.1rem" : "1.3rem",
                      fontWeight: "bold",
                      color: "#555",
                      marginBottom: "2px",
                      display: "block",
                    }}
                  >
                    Chofer <span style={{ color: "#dc3545" }}>*</span>
                  </label>
                  <select
                    className="form-control"
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    required
                    style={{
                      fontSize: window.innerWidth <= 768 ? "1.1rem" : "1.3rem",
                      padding: window.innerWidth <= 768 ? "12px" : "15px",
                      borderRadius: "12px",
                      border: "2px solid #ddd",
                      background: "#fff",
                      width: "100%",
                      minHeight: "50px",
                    }}
                  >
                    <option value="">Seleccione un chofer</option>
                    {sortedDrivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Peso */}
                <div>
                  <label
                    className="form-label"
                    style={{
                      fontSize: window.innerWidth <= 768 ? "1.1rem" : "1.3rem",
                      fontWeight: "bold",
                      color: "#555",
                      marginBottom: "2px",
                      display: "block",
                    }}
                  >
                    Peso (libras) <span style={{ color: "#dc3545" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={weight}
                    ref={weightInputRef}
                    onFocus={() => setShowKeypad(true)}
                    onChange={(e) => setWeight(e.target.value)}
                    min={0}
                    step={0.1}
                    required
                    placeholder="FAVOR DE PONER LIBRAS"
                    inputMode="numeric"
                    autoComplete="off"
                    style={{
                      fontSize: window.innerWidth <= 768 ? "1.3rem" : "1.5rem",
                      padding: window.innerWidth <= 768 ? "15px" : "18px",
                      borderRadius: "12px",
                      border: "2px solid #ddd",
                      background: "#fff",
                      textAlign: "center",
                      fontWeight: "bold",
                      width: "100%",
                      minHeight: "55px",
                    }}
                  />
                </div>

                {/* Cart ID section - Always visible and required */}
                <div>
                  <label
                    className="form-label"
                    style={{
                      fontSize: window.innerWidth <= 768 ? "1.1rem" : "1.3rem",
                      fontWeight: "bold",
                      color: "#555",
                      marginBottom: "2px",
                      display: "block",
                    }}
                  >
                    Cart ID <span style={{ color: "#dc3545" }}>*</span>
                  </label>
                  {cartId ? (
                    <div
                      className="form-control d-flex align-items-center justify-content-between"
                      style={{
                        fontSize: window.innerWidth <= 768 ? "1.1rem" : "1.3rem",
                        padding: window.innerWidth <= 768 ? "12px" : "15px",
                        borderRadius: "12px",
                        border: "2px solid #28a745",
                        background: "#f8fff9",
                        width: "100%",
                        fontWeight: "bold",
                        minHeight: "50px",
                      }}
                    >
                      <span className="text-success">
                        <i className="fas fa-check-circle me-2"></i>
                        {cartId}
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => setShowCartPopup(true)}
                        style={{ fontSize: "0.8rem" }}
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-danger btn-lg"
                      onClick={() => {
                        if (!clientId || !driverId || !weight) {
                          alert(
                            "Por favor complete Cliente, Chofer y Peso antes de ingresar el Cart ID."
                          );
                          return;
                        }
                        setShowCartPopup(true);
                      }}
                      style={{
                        fontSize: window.innerWidth <= 768 ? "1.1rem" : "1.3rem",
                        padding: window.innerWidth <= 768 ? "12px" : "15px",
                        borderRadius: "12px",
                        fontWeight: "bold",
                        background: "linear-gradient(45deg, #dc3545, #c82333)",
                        border: "none",
                        boxShadow: "0 5px 15px rgba(220,53,69,0.2)",
                        transition: "all 0.3s ease",
                        width: "100%",
                        minHeight: "50px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <i className="fas fa-barcode me-2"></i>
                      Cart ID Requerido - Presione para Ingresar
                    </button>
                  )}
                  <small
                    className="text-muted d-block mt-1"
                    style={{ fontSize: "0.85rem" }}
                  >
                    {cartId ? "Cart ID ingresado correctamente" : "Este campo es obligatorio para registrar la entrada"}
                  </small>
                </div>
              </div>

              {/* Submit Button - Fixed at bottom */}
              <div style={{ paddingTop: "5px" }}>
                <button
                  className="btn btn-primary w-100"
                  type="submit"
                  disabled={submitting || !clientId || !driverId || !weight || !cartId.trim()}
                  style={{
                    fontSize: window.innerWidth <= 768 ? "1.2rem" : "1.4rem",
                    padding: window.innerWidth <= 768 ? "12px" : "15px",
                    borderRadius: "12px",
                    fontWeight: "bold",
                    background: "linear-gradient(45deg, #007bff, #0056b3)",
                    border: "none",
                    boxShadow: "0 5px 15px rgba(0,123,255,0.2)",
                    transition: "all 0.3s ease",
                    minHeight: "50px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 20px rgba(0,123,255,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 5px 15px rgba(0,123,255,0.2)";
                  }}
                >
                  {submitting ? (
                    <>
                      <div
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                      ></div>
                      Registrando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-clipboard-check me-2"></i>
                      Revisar y Confirmar
                    </>
                  )}
                </button>

                {success && (
                  <div
                    className="alert alert-success mt-2"
                    style={{
                      fontSize: "1rem",
                      padding: "8px",
                      borderRadius: "10px",
                      textAlign: "center",
                      fontWeight: "bold",
                      marginBottom: "0",
                    }}
                  >
                    <i className="fas fa-check-circle me-2"></i>
                    ¡Entrada registrada exitosamente!
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Main Menu Button - Fixed Position */}
        <button
          onClick={() => onNavigateHome && onNavigateHome()}
          style={{
            position: "fixed",
            top: "15px",
            left: "15px",
            zIndex: 500,
            background: "linear-gradient(45deg, #28a745, #20c997)",
            border: "none",
            borderRadius: "20px",
            padding: "10px 15px",
            fontSize: "1rem",
            fontWeight: "bold",
            color: "#fff",
            boxShadow: "0 4px 12px rgba(40,167,69,0.3)",
            cursor: "pointer",
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(40,167,69,0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(40,167,69,0.3)";
          }}
          title="Volver al menú principal"
        >
          <i className="fas fa-home me-1"></i>
          Menú
        </button>

        {/* Ver Todo Button - Fixed Position */}
        <button
          onClick={() => setShowHistoryPanel(true)}
          style={{
            position: "fixed",
            top: "15px",
            right: "15px",
            zIndex: 500,
            background: "linear-gradient(45deg, #007bff, #0056b3)",
            border: "none",
            borderRadius: "20px",
            padding: "10px 15px",
            fontSize: "1rem",
            fontWeight: "bold",
            color: "#fff",
            boxShadow: "0 4px 12px rgba(0,123,255,0.3)",
            cursor: "pointer",
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,123,255,0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,123,255,0.3)";
          }}
          title="Ver historial de entradas"
        >
          <i className="fas fa-list me-1"></i>
          Ver Todo
        </button>

        {/* Modal Keypad */}
        {showKeypad && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0, 0, 0, 0.7)",
              zIndex: 1200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(5px)",
            }}
            onClick={() => setShowKeypad(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="card p-4"
              style={{
                background: "rgba(255,255,255,0.98)",
                borderRadius: "25px",
                border: "3px solid #fff",
                boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
                maxWidth: "500px",
                width: "90%",
                backdropFilter: "blur(15px)",
              }}
            >
              <h3
                className="text-center mb-4"
                style={{
                  fontSize: "1.8rem",
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                📱 Teclado Numérico
              </h3>

              {/* Weight Display */}
              <div
                className="text-center mb-4 p-3"
                style={{
                  background: "#f8f9fa",
                  borderRadius: "15px",
                  border: "2px solid #dee2e6",
                  fontSize: "2rem",
                  fontWeight: "bold",
                  color: "#333",
                  minHeight: "60px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {weight || "0"} lbs
              </div>

              <div className="d-flex flex-wrap justify-content-center gap-3 mb-4">
                {[
                  "7",
                  "8",
                  "9",
                  "4",
                  "5",
                  "6",
                  "1",
                  "2",
                  "3",
                  "0",
                  "←",
                  "C",
                ].map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`btn btn-outline-dark${
                      key === "C"
                        ? " btn-danger"
                        : key === "←"
                        ? " btn-warning"
                        : ""
                    }`}
                    style={{
                      width: responsiveStyles.keypadSize.width,
                      height: responsiveStyles.keypadSize.height,
                      fontSize: responsiveStyles.fontSize.keypad,
                      fontWeight: "bold",
                      borderRadius: "15px",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => handleKeypadInput(key)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.05)";
                      e.currentTarget.style.boxShadow =
                        "0 5px 15px rgba(0,0,0,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {key === "←" ? <>&larr;</> : key}
                  </button>
                ))}
              </div>

              {/* OK and Close buttons */}
              <div className="d-flex gap-3">
                <button
                  type="button"
                  className="btn btn-success flex-fill"
                  onClick={handleWeightConfirmation}
                  disabled={!weight || !clientId || !driverId}
                  style={{
                    fontSize: "1.4rem",
                    padding: "15px",
                    borderRadius: "18px",
                    fontWeight: "bold",
                  }}
                >
                  <i className="fas fa-check me-2"></i>
                  OK - Continuar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary flex-fill"
                  onClick={() => setShowKeypad(false)}
                  style={{
                    fontSize: "1.4rem",
                    padding: "15px",
                    borderRadius: "18px",
                    fontWeight: "bold",
                  }}
                >
                  <i className="fas fa-times me-2"></i>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cart ID Popup Modal */}
        {showCartPopup && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0, 0, 0, 0.8)",
              zIndex: 1300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(5px)",
            }}
            onClick={() => setShowCartPopup(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="card p-4"
              style={{
                background: "rgba(255,255,255,0.98)",
                borderRadius: "25px",
                border: "3px solid #fff",
                boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
                maxWidth: "600px",
                width: "95%",
                maxHeight: "90vh",
                overflow: "auto",
                backdropFilter: "blur(15px)",
              }}
            >
              <h3
                className="text-center mb-4"
                style={{
                  fontSize: "2rem",
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                🛒 Identificar Cart ID
              </h3>

              {/* Cart Image */}
              <div className="text-center mb-4">
                <img
                  src="/images/cart-example.jpg"
                  alt="Ejemplo de Cart con ID"
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    borderRadius: "15px",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
                    border: "3px solid #ddd",
                  }}
                />
                <p
                  className="mt-3"
                  style={{
                    fontSize: "1.2rem",
                    color: "#666",
                    fontWeight: "500",
                  }}
                >
                  Busque el número de identificación en el cart como se muestra
                  en la imagen
                </p>
              </div>

              {/* Cart ID Input */}
              <div className="mb-4">
                <label
                  className="form-label"
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: "bold",
                    color: "#555",
                    marginBottom: "10px",
                    display: "block",
                  }}
                >
                  Ingrese el Cart ID:
                </label>
                <div className="d-flex gap-2">
                  <input
                    type="text"
                    className="form-control"
                    value={cartId}
                    readOnly
                    placeholder="Presione el teclado para ingresar"
                    style={{
                      fontSize: "1.3rem",
                      padding: "15px",
                      borderRadius: "15px",
                      border: "3px solid #ddd",
                      background: "#f8f9fa",
                      textAlign: "center",
                      fontWeight: "bold",
                      flex: 1,
                      cursor: "pointer",
                    }}
                    onClick={() => setShowCartKeypad(true)}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowCartKeypad(true)}
                    style={{
                      fontSize: "1.2rem",
                      padding: "15px 20px",
                      borderRadius: "15px",
                      fontWeight: "bold",
                    }}
                  >
                    <i className="fas fa-keyboard"></i>
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="d-flex gap-3">
                <button
                  type="button"
                  className="btn btn-success flex-fill"
                  onClick={() => {
                    if (cartId.trim()) {
                      setShowCartPopup(false);
                      // Focus back to form or submit
                    } else {
                      alert("Por favor ingrese un Cart ID válido");
                    }
                  }}
                  style={{
                    fontSize: "1.3rem",
                    padding: "15px",
                    borderRadius: "18px",
                    fontWeight: "bold",
                  }}
                >
                  <i className="fas fa-check me-2"></i>
                  Continuar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary flex-fill"
                  onClick={() => setShowCartPopup(false)}
                  style={{
                    fontSize: "1.3rem",
                    padding: "15px",
                    borderRadius: "18px",
                    fontWeight: "bold",
                  }}
                >
                  <i className="fas fa-arrow-left me-2"></i>
                  Volver
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cart ID Keypad Modal */}
        {showCartKeypad && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0, 0, 0, 0.8)",
              zIndex: 1400,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(5px)",
              overflow: "auto",
            }}
            onClick={() => setShowCartKeypad(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="card"
              style={{
                background: "rgba(255,255,255,0.98)",
                borderRadius: "20px",
                border: "3px solid #fff",
                boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
                maxWidth: "480px",
                width: "95%",
                maxHeight: "95vh",
                padding:
                  responsiveStyles.fontSize.title === "2rem" ? "20px" : "25px",
                backdropFilter: "blur(15px)",
                margin: "10px",
              }}
            >
              <h3
                className="text-center mb-3"
                style={{
                  fontSize:
                    responsiveStyles.fontSize.title === "2rem"
                      ? "1.5rem"
                      : "1.7rem",
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                ⌨️ Teclado para Cart ID
              </h3>

              {/* Cart ID Display */}
              <div
                className="text-center mb-3 p-2"
                style={{
                  background: "#f8f9fa",
                  borderRadius: "12px",
                  border: "2px solid #dee2e6",
                  fontSize:
                    responsiveStyles.fontSize.title === "2rem"
                      ? "1.4rem"
                      : "1.6rem",
                  fontWeight: "bold",
                  color: "#333",
                  minHeight:
                    responsiveStyles.fontSize.title === "2rem"
                      ? "45px"
                      : "55px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {cartId || "Cart ID"}
              </div>

              {/* Numeric Keypad */}
              <div className="d-flex flex-wrap justify-content-center gap-2 mb-3">
                {[
                  "7",
                  "8",
                  "9",
                  "4",
                  "5",
                  "6",
                  "1",
                  "2",
                  "3",
                  "0",
                  "←",
                  "C",
                ].map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`btn btn-outline-dark${
                      key === "C"
                        ? " btn-danger"
                        : key === "←"
                        ? " btn-warning"
                        : ""
                    }`}
                    style={{
                      width:
                        responsiveStyles.fontSize.title === "2rem" ? 50 : 60,
                      height:
                        responsiveStyles.fontSize.title === "2rem" ? 50 : 60,
                      fontSize:
                        responsiveStyles.fontSize.title === "2rem"
                          ? "1.1rem"
                          : "1.3rem",
                      fontWeight: "bold",
                      borderRadius: "12px",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => handleCartKeypadInput(key)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.05)";
                      e.currentTarget.style.boxShadow =
                        "0 5px 15px rgba(0,0,0,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {key === "←" ? <>&larr;</> : key}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-success flex-fill"
                  onClick={() => setShowCartKeypad(false)}
                  style={{
                    fontSize:
                      responsiveStyles.fontSize.title === "2rem"
                        ? "1.1rem"
                        : "1.2rem",
                    padding:
                      responsiveStyles.fontSize.title === "2rem"
                        ? "12px"
                        : "15px",
                    borderRadius: "15px",
                    fontWeight: "bold",
                  }}
                >
                  <i className="fas fa-check me-2"></i>
                  Confirmar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary flex-fill"
                  onClick={() => setShowCartKeypad(false)}
                  style={{
                    fontSize:
                      responsiveStyles.fontSize.title === "2rem"
                        ? "1.1rem"
                        : "1.2rem",
                    padding:
                      responsiveStyles.fontSize.title === "2rem"
                        ? "12px"
                        : "15px",
                    borderRadius: "15px",
                    fontWeight: "bold",
                  }}
                >
                  <i className="fas fa-times me-2"></i>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmationModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0, 0, 0, 0.8)",
              zIndex: 1500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(5px)",
            }}
            onClick={() => setShowConfirmationModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="card"
              style={{
                background: "rgba(255,255,255,0.98)",
                borderRadius: "20px",
                border: "3px solid #fff",
                boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
                maxWidth: "600px",
                width: "95%",
                padding: "30px",
                backdropFilter: "blur(15px)",
              }}
            >
              <div className="text-center mb-4">
                <h3
                  style={{
                    fontSize: "2rem",
                    fontWeight: "bold",
                    color: "#333",
                    marginBottom: "10px",
                  }}
                >
                  📋 Confirmar Información
                </h3>
                <p
                  style={{
                    fontSize: "1.1rem",
                    color: "#666",
                    marginBottom: "0",
                  }}
                >
                  Por favor revise que toda la información sea correcta antes de
                  registrar la entrada
                </p>
              </div>

              {/* Summary Information */}
              <div
                className="mb-4"
                style={{
                  background: "#f8f9fa",
                  borderRadius: "15px",
                  padding: "20px",
                  border: "2px solid #dee2e6",
                }}
              >
                <div className="row g-3">
                  <div className="col-12">
                    <div className="d-flex align-items-center mb-2">
                      <i
                        className="fas fa-building text-primary me-3"
                        style={{ fontSize: "1.2rem" }}
                      ></i>
                      <div>
                        <strong style={{ fontSize: "1.1rem", color: "#333" }}>
                          Cliente:
                        </strong>
                        <div
                          style={{
                            fontSize: "1.3rem",
                            fontWeight: "bold",
                            color: "#007bff",
                          }}
                        >
                          {sortedClients.find((c) => c.id === clientId)?.name ||
                            ""}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="d-flex align-items-center mb-2">
                      <i
                        className="fas fa-user text-success me-3"
                        style={{ fontSize: "1.2rem" }}
                      ></i>
                      <div>
                        <strong style={{ fontSize: "1.1rem", color: "#333" }}>
                          Chofer:
                        </strong>
                        <div
                          style={{
                            fontSize: "1.3rem",
                            fontWeight: "bold",
                            color: "#28a745",
                          }}
                        >
                          {sortedDrivers.find((d) => d.id === driverId)?.name ||
                            ""}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-6">
                    <div className="d-flex align-items-center mb-2">
                      <i
                        className="fas fa-weight text-warning me-3"
                        style={{ fontSize: "1.2rem" }}
                      ></i>
                      <div>
                        <strong style={{ fontSize: "1.1rem", color: "#333" }}>
                          Peso:
                        </strong>
                        <div
                          style={{
                            fontSize: "1.3rem",
                            fontWeight: "bold",
                            color: "#ffc107",
                          }}
                        >
                          {weight} libras
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-6">
                    <div className="d-flex align-items-center mb-2">
                      <i
                        className="fas fa-barcode text-info me-3"
                        style={{ fontSize: "1.2rem" }}
                      ></i>
                      <div>
                        <strong style={{ fontSize: "1.1rem", color: "#333" }}>
                          Cart ID:
                        </strong>
                        <div
                          style={{
                            fontSize: "1.3rem",
                            fontWeight: "bold",
                            color: "#17a2b8",
                          }}
                        >
                          {cartId}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-6">
                    <div className="d-flex align-items-center mb-2">
                      <i
                        className="fas fa-cogs text-secondary me-3"
                        style={{ fontSize: "1.2rem" }}
                      ></i>
                      <div>
                        <strong style={{ fontSize: "1.1rem", color: "#333" }}>
                          Tipo de Lavado:
                        </strong>
                        <div
                          style={{
                            fontSize: "1.1rem",
                            fontWeight: "bold",
                            color: "#6c757d",
                          }}
                        >
                          {sortedClients.find((c) => c.id === clientId)
                            ?.washingType || "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-6">
                    <div className="d-flex align-items-center mb-2">
                      <i
                        className="fas fa-layer-group text-secondary me-3"
                        style={{ fontSize: "1.2rem" }}
                      ></i>
                      <div>
                        <strong style={{ fontSize: "1.1rem", color: "#333" }}>
                          Segregación:
                        </strong>
                        <div
                          style={{
                            fontSize: "1.1rem",
                            fontWeight: "bold",
                            color: "#6c757d",
                          }}
                        >
                          {sortedClients.find((c) => c.id === clientId)
                            ?.segregation
                            ? "Sí"
                            : "No"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-12">
                    <div className="d-flex align-items-center">
                      <i
                        className="fas fa-clock text-muted me-3"
                        style={{ fontSize: "1.2rem" }}
                      ></i>
                      <div>
                        <strong style={{ fontSize: "1.1rem", color: "#333" }}>
                          Fecha y Hora:
                        </strong>
                        <div
                          style={{
                            fontSize: "1.1rem",
                            fontWeight: "bold",
                            color: "#6c757d",
                          }}
                        >
                          {new Date().toLocaleString("es-ES", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="d-flex gap-3">
                <button
                  type="button"
                  className="btn btn-success flex-fill"
                  onClick={handleConfirmSubmission}
                  disabled={submitting}
                  style={{
                    fontSize: "1.3rem",
                    padding: "15px",
                    borderRadius: "15px",
                    fontWeight: "bold",
                    background: "linear-gradient(45deg, #28a745, #20c997)",
                    border: "none",
                    transition: "all 0.3s ease",
                  }}
                >
                  {submitting ? (
                    <>
                      <div
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                      ></div>
                      Registrando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check-circle me-2"></i>
                      Confirmar y Registrar
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary flex-fill"
                  onClick={() => setShowConfirmationModal(false)}
                  disabled={submitting}
                  style={{
                    fontSize: "1.3rem",
                    padding: "15px",
                    borderRadius: "15px",
                    fontWeight: "bold",
                  }}
                >
                  <i className="fas fa-arrow-left me-2"></i>
                  Volver a Editar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
