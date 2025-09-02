import React, { useEffect, useState, useMemo } from "react";
import {
  getTodayPickupGroups,
  updatePickupGroupStatus,
  getClients,
  logActivity,
} from "../services/firebaseService";
import type { Client } from "../types";
// Add Firestore imports
import {
  doc,
  updateDoc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  Timestamp,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import "./Segregation.css";
import { useAuth } from "./AuthContext";

interface SegregationProps {
  hideArrows?: boolean;
  onGroupComplete?: () => void;
}

const Segregation: React.FC<SegregationProps> = ({
  hideArrows,
  onGroupComplete,
}) => {
  const [groups, setGroups] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  // --- Alert Banner State ---
  const [alertMessage, setAlertMessage] = useState("");
  const [isEditingAlert, setIsEditingAlert] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [loadingAlert, setLoadingAlert] = useState(true);

  // State for log modal
  const [logGroup, setLogGroup] = useState<any | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);

  // Fetch clients only once on mount
  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      const fetchedClients = await getClients();
      setClients(fetchedClients);
      setLoading(false);
    };
    fetchClients();
  }, []);

  // Real-time listener for all pickup_groups with debouncing for stability
  useEffect(() => {
    const q = collection(db, "pickup_groups");
    let debounceTimeout: NodeJS.Timeout;

    const unsub = onSnapshot(q, (snap) => {
      // Clear any existing timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Debounce the update to prevent rapid fire updates during weight entry
      debounceTimeout = setTimeout(() => {
        const fetchedGroups = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        console.log(
          "📡 [GROUPS SYNC] Groups updated from Firestore - maintaining order stability"
        );
        setGroups(fetchedGroups);
      }, 50); // 50ms debounce to smooth out rapid updates
    });

    return () => {
      unsub();
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, []);

  // Show all groups with status 'Segregacion' or 'Segregation' (case-insensitive)
  const segregationGroups = groups.filter(
    (g) =>
      typeof g.status === "string" &&
      ["segregacion", "segregation"].includes(g.status.toLowerCase())
  );

  // Debug logging for segregation groups
  useEffect(() => {
    if (segregationGroups.length > 0) {
      console.log("🔍 [SEGREGATION GROUPS] Current groups in segregation:");
      segregationGroups.forEach((group, idx) => {
        console.log(
          `   ${idx + 1}. ${group.clientName} (ID: ${group.id}) - Status: ${
            group.status
          }`
        );
      });
    }
  }, [segregationGroups.map((g) => g.id + g.status).join(",")]);

  // Debug logging for all groups with their statuses
  useEffect(() => {
    if (groups.length > 0) {
      console.log("📊 [ALL GROUPS STATUS] Current status of all groups:");
      groups.forEach((group) => {
        console.log(
          `   ${group.clientName || "Unknown"} (${group.id}): ${
            group.status || "No status"
          }`
        );
      });
    }
  }, [groups.map((g) => g.id + (g.status || "")).join(",")]);

  // Only set group status to 'Segregation' if it is in a pre-segregation state (e.g., 'Pickup Complete')
  useEffect(() => {
    if (!loading && groups.length > 0 && clients.length > 0) {
      groups.forEach((group) => {
        const client = clients.find((c) => c.id === group.clientId);
        // Only set to 'Segregation' if client needs segregation and group is in a pre-segregation state
        if (client && client.segregation && group.status === undefined) {
          updatePickupGroupStatus(group.id, "Segregation");
        }
      });
    }
  }, [loading, groups.length, clients.length]);

  // Fetch all entries to count carts per group (remove date filter)
  const [entries, setEntries] = useState<any[]>([]);
  useEffect(() => {
    import("../firebase").then(({ db }) => {
      import("firebase/firestore").then(({ collection, onSnapshot, query }) => {
        const q = query(collection(db, "pickup_entries"));
        const unsub = onSnapshot(q, (snap) => {
          const fetched = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setEntries(fetched);
        });
        // Return unsubscribe function for cleanup
        return unsub;
      });
    });
  }, []);

  // Helper: count carts for a group
  const getCartCount = (groupId: string) =>
    entries.filter((e) => e.groupId === groupId).length;

  // Helper: get expected verification value for a group
  const getExpectedVerificationValue = (
    group: any,
    client: Client | undefined
  ) => {
    // For Tunnel clients that do NOT need segregation, use the number of carts as verification
    if (
      client &&
      client.washingType === "Tunnel" &&
      client.segregation === false
    ) {
      return getCartCount(group.id);
    }
    // For other clients, use segregatedCarts (default behavior)
    return group.segregatedCarts;
  };

  // Track input and completion state for each group
  const [segregatedCounts, setSegregatedCounts] = useState<{
    [groupId: string]: string;
  }>({});
  const [completingGroup, setCompletingGroup] = useState<string | null>(null);

  // Track washing type overrides per group (to force Tunnel clients to Conventional)
  const [washingTypeOverrides, setWashingTypeOverrides] = useState<{
    [groupId: string]: "Conventional" | null;
  }>({});

  // Track manual order for segregation groups, persist in Firestore
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [orderLoading, setOrderLoading] = useState(true);

  // Enhanced tracking for new clients and order changes
  const [previousGroups, setPreviousGroups] = useState<string[]>([]);
  const [previousOrder, setPreviousOrder] = useState<string[]>([]);

  // NEW: Sequential verification state
  const [currentClientIndex, setCurrentClientIndex] = useState(0);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [cartsVerified, setCartsVerified] = useState<boolean>(false);
  const [showActualCarts, setShowActualCarts] = useState<boolean>(false);

  // NEW: Cart count verification system
  const [verificationStarted, setVerificationStarted] =
    useState<boolean>(false);
  const [verifyingClient, setVerifyingClient] = useState<string | null>(null);
  const [expectedCartCount, setExpectedCartCount] = useState<string>("");
  const [showVerificationError, setShowVerificationError] =
    useState<boolean>(false);
  const [verificationErrorUser, setVerificationErrorUser] =
    useState<string>("");
  const [verifiedClients, setVerifiedClients] = useState<Set<string>>(
    new Set()
  );
  const [verificationErrors, setVerificationErrors] = useState<
    Array<{
      id: string;
      username: string;
      clientName: string;
      expectedCount: string;
      actualCount: number;
      timestamp: Date;
    }>
  >([]);
  const [showErrorsSidebar, setShowErrorsSidebar] = useState<boolean>(false);

  // Confirmation modal state for Done button
  const [showDoneConfirmation, setShowDoneConfirmation] = useState<boolean>(false);
  const [confirmingClient, setConfirmingClient] = useState<string | null>(null);

  // Today's date string for Firestore doc
  const todayStr = new Date().toISOString().slice(0, 10);
  const orderDocRef = doc(db, "segregation_orders", todayStr);

  // Load order from Firestore and listen for changes with stability improvements
  useEffect(() => {
    setOrderLoading(true);
    const unsub = onSnapshot(orderDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.order)) {
          // Only update if the order actually changed to prevent unnecessary re-renders
          setGroupOrder((prev) => {
            const newOrder = data.order;
            if (
              prev.length !== newOrder.length ||
              !prev.every((id, idx) => id === newOrder[idx])
            ) {
              console.log(
                "📡 [ORDER SYNC] Order updated from Firestore - preserving stability"
              );
              return newOrder;
            }
            return prev;
          });
        } else {
          setGroupOrder([]);
        }
      } else {
        setGroupOrder([]);
      }
      setOrderLoading(false);
    });
    return () => unsub();
  }, [todayStr]);

  // When segregationGroups changes, initialize order in Firestore if needed
  useEffect(() => {
    if (
      !orderLoading &&
      segregationGroups.length > 0 &&
      groupOrder.length === 0
    ) {
      // Sort by creation time or existing order to maintain consistency
      const sortedGroups = [...segregationGroups].sort((a, b) => {
        // If both have order, sort by order
        if (typeof a.order === "number" && typeof b.order === "number") {
          return a.order - b.order;
        }
        // If one has order and other doesn't, prioritize the one with order
        if (typeof a.order === "number") return -1;
        if (typeof b.order === "number") return 1;
        // If neither has order, sort by timestamp or ID
        const timeA =
          (a.startTime instanceof Date
            ? a.startTime.getTime()
            : a.startTime?.toDate?.()?.getTime()) ||
          new Date(a.id.substring(0, 8), 16).getTime() ||
          0;
        const timeB =
          (b.startTime instanceof Date
            ? b.startTime.getTime()
            : b.startTime?.toDate?.()?.getTime()) ||
          new Date(b.id.substring(0, 8), 16).getTime() ||
          0;
        return timeA - timeB;
      });

      const initialOrder = sortedGroups.map((g) => g.id);
      setDoc(orderDocRef, { order: initialOrder }, { merge: true });

      // Log initial order setup
      console.log(
        "🎬 [INITIAL ORDER] Setting up segregation order for the first time"
      );
      console.log(
        "📋 Initial order:",
        sortedGroups.map((g) => g.clientName)
      );
    }
  }, [segregationGroups.length, orderLoading, groupOrder.length]);

  // Handle new groups being added with improved debouncing to prevent rapid updates
  useEffect(() => {
    if (!orderLoading && groupOrder.length > 0) {
      const newGroups = segregationGroups.filter(
        (g) => !groupOrder.includes(g.id)
      );

      if (newGroups.length > 0) {
        // Use a more stable timeout to prevent race conditions
        const timeoutId = setTimeout(() => {
          // Double-check that these groups are still new to prevent duplicates
          const stillNewGroups = newGroups.filter(
            (g) => !groupOrder.includes(g.id)
          );

          if (stillNewGroups.length > 0) {
            const updatedOrder = [
              ...groupOrder,
              ...stillNewGroups.map((g) => g.id),
            ];

            // Log new groups being added to bottom
            console.log(
              "🆕 [ADDING NEW GROUPS] New clients being added to bottom of segregation queue"
            );
            stillNewGroups.forEach((group, idx) => {
              const position = groupOrder.length + idx + 1;
              console.log(
                `   📍 ${group.clientName} added at position ${position} (bottom of queue)`
              );
              console.log(
                `   📊 Group details: ID=${group.id}, Weight=${
                  group.totalWeight || 0
                }lbs`
              );
            });
            console.log(
              "✅ New groups successfully positioned at bottom - order preserved during weight updates"
            );

            // Update Firestore first, then let the listener update local state
            setDoc(orderDocRef, { order: updatedOrder }, { merge: true }).catch(
              (error) => {
                console.error(
                  "❌ Error updating group order in Firestore:",
                  error
                );
              }
            );

            // Log to Firestore activity log
            const currentUser = getCurrentUser();
            stillNewGroups.forEach(async (group) => {
              await logActivity({
                type: "Segregation",
                message: `New client "${group.clientName}" automatically added to bottom of segregation queue by system (user context: ${currentUser})`,
                user: currentUser,
              });
            });
          }
        }, 500); // Increased debounce time for more stability

        return () => clearTimeout(timeoutId);
      }

      // Clean up removed groups from order with improved stability
      const cleanedOrder = groupOrder.filter((id) =>
        segregationGroups.some((g) => g.id === id)
      );

      if (cleanedOrder.length !== groupOrder.length) {
        const timeoutId = setTimeout(() => {
          console.log(
            "🧹 [CLEANUP] Removing deleted groups from order - maintaining position stability"
          );
          setDoc(orderDocRef, { order: cleanedOrder }, { merge: true });
        }, 300); // Slightly increased cleanup delay

        return () => clearTimeout(timeoutId);
      }
    }
  }, [
    segregationGroups.map((g) => g.id).join(","),
    orderLoading,
    groupOrder.join(","),
  ]);

  // Move group up/down in the order and persist to Firestore, then update all screens immediately
  const [movingGroupId, setMovingGroupId] = useState<string | null>(null);

  // Optimistically update local groupOrder before persisting to Firestore
  const moveGroup = async (groupId: string, direction: -1 | 1) => {
    if (movingGroupId) return; // Prevent multiple simultaneous moves

    setMovingGroupId(groupId);

    try {
      let idx = groupOrder.indexOf(groupId);
      let newOrder = [...groupOrder];

      // If group is not in order, append it
      if (idx === -1) {
        newOrder.push(groupId);
        idx = newOrder.length - 1;
      }

      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= newOrder.length) {
        setMovingGroupId(null);
        return;
      }

      const group = segregationGroups.find((g) => g.id === groupId);
      const swapGroup = segregationGroups.find(
        (g) => g.id === newOrder[swapIdx]
      );
      const currentUser = getCurrentUser();

      // Perform the swap
      [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

      // Update Firestore first, let the listener update local state for consistency
      await setDoc(orderDocRef, { order: newOrder }, { merge: true });

      // Enhanced activity logging with user information
      await logActivity({
        type: "Segregation",
        message: `Group "${getGroupDisplayName(groupId, group)}" moved ${
          direction === -1 ? "up" : "down"
        } by ${currentUser} from position ${idx + 1} to ${
          swapIdx + 1
        } (swapped with "${getGroupDisplayName(
          newOrder[swapIdx],
          swapGroup
        )}")`,
        user: currentUser,
      });

      // Update both moved groups with the user who performed the action
      const groupRef = doc(db, "pickup_groups", groupId);
      const swapGroupRef = doc(db, "pickup_groups", newOrder[swapIdx]);

      await Promise.all([
        updateDoc(groupRef, {
          lastMovedBy: currentUser,
          lastMovedAt: new Date().toISOString(),
        }),
        updateDoc(swapGroupRef, {
          lastMovedBy: currentUser,
          lastMovedAt: new Date().toISOString(),
        }),
      ]);

      console.log(
        `📝 Updated move tracking: ${group?.clientName} and ${swapGroup?.clientName} moved by ${currentUser}`
      );

      // Additional console logging for detailed tracking
      console.log(
        "📝 [ACTIVITY LOGGED] Move operation saved to Firestore activity log"
      );
    } catch (error) {
      console.error("❌ Error moving group:", error);
    } finally {
      setMovingGroupId(null);
    }
  };

  // Handler to delete a segregation group
  const handleDeleteSegregationGroup = async (groupId: string) => {
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

  // Helper to get effective washing type (considering overrides)
  const getEffectiveWashingType = (groupId: string, client?: Client) => {
    // Check if there's an override for this group
    const override = washingTypeOverrides[groupId];
    if (override) {
      return override;
    }
    // Otherwise return the client's default washing type
    return client?.washingType || "Conventional";
  };

  // Toggle washing type override for a group
  const toggleWashingTypeOverride = async (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    const client = clients.find((c) => c.id === group?.clientId);

    if (!client || client.washingType !== "Tunnel") {
      return; // Only allow overriding Tunnel clients
    }

    const currentOverride = washingTypeOverrides[groupId];
    const newOverride = currentOverride ? null : "Conventional";

    setWashingTypeOverrides((prev) => {
      const newOverrides = { ...prev };
      if (newOverride) {
        newOverrides[groupId] = newOverride;
      } else {
        delete newOverrides[groupId];
      }
      return newOverrides;
    });

    // Log the override action
    const action = newOverride ? "enabled" : "disabled";
    const message = newOverride
      ? `Override ${action}: ${getGroupDisplayName(
          groupId,
          group
        )} (Tunnel client) will be forced to Conventional by ${getCurrentUser()}`
      : `Override ${action}: ${getGroupDisplayName(
          groupId,
          group
        )} will use default Tunnel washing by ${getCurrentUser()}`;

    await logActivity({
      type: "Segregation",
      message,
      user: getCurrentUser(),
    });

    console.log(
      `🔄 [OVERRIDE ${action.toUpperCase()}] ${group?.clientName}: ${
        client.washingType
      } → ${newOverride || client.washingType}`
    );
  };

  // Helper to get current user (from localStorage or context)
  const getCurrentUser = () => {
    try {
      // First try to get from auth context if available
      if (user && user.username) {
        return user.username;
      }
      // Fallback to localStorage with correct key
      const storedUser = JSON.parse(
        localStorage.getItem("auth_user") || "null"
      );
      return storedUser?.username || storedUser?.id || "Unknown";
    } catch {
      return "Unknown";
    }
  };

  // Helper to get group name with fallback to client lookup
  const getGroupDisplayName = (groupId: string, group?: any) => {
    // If group has clientName, use it
    if (group?.clientName) {
      return group.clientName;
    }

    // If group has clientId, look up client name
    if (group?.clientId) {
      const client = clients.find((c) => c.id === group.clientId);
      if (client?.name) {
        return client.name;
      }
    }

    // Fallback to group ID
    return groupId;
  };

  // Handler for input change
  const handleInputChange = (groupId: string, value: string) => {
    if (/^\d*$/.test(value)) {
      setSegregatedCounts((prev) => ({ ...prev, [groupId]: value }));
    }
  };

  // In the + button handler:
  const handleIncrement = async (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    const oldValue = parseInt(segregatedCounts[groupId] || "0", 10);
    const newValue = String(oldValue + 1);

    console.log(
      `➕ [INCREMENT] ${getGroupDisplayName(
        groupId,
        group
      )}: ${oldValue} → ${newValue}`
    );

    setSegregatedCounts((prev) => ({ ...prev, [groupId]: newValue }));
    // Persist the new value to Firestore
    await updateDoc(doc(db, "pickup_groups", groupId), {
      segregatedCarts: parseInt(newValue, 10),
      updatedAt: new Date().toISOString(),
    });
    await logActivity({
      type: "Segregation",
      message: `+1 to group ${getGroupDisplayName(
        groupId,
        group
      )} (${groupId}) by ${getCurrentUser()}`,
      user: getCurrentUser(),
    });
  };

  // In the - button handler:
  const handleDecrement = async (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    const oldValue = parseInt(segregatedCounts[groupId] || "0", 10);
    const newValue = String(Math.max(0, oldValue - 1));

    console.log(
      `➖ [DECREMENT] ${getGroupDisplayName(
        groupId,
        group
      )}: ${oldValue} → ${newValue}`
    );

    setSegregatedCounts((prev) => ({ ...prev, [groupId]: newValue }));
    // Persist the new value to Firestore
    await updateDoc(doc(db, "pickup_groups", groupId), {
      segregatedCarts: parseInt(newValue, 10),
      updatedAt: new Date().toISOString(),
    });
    await logActivity({
      type: "Segregation",
      message: `-1 to group ${getGroupDisplayName(
        groupId,
        group
      )} (${groupId}) by ${getCurrentUser()}`,
      user: getCurrentUser(),
    });
  };

  // Always use groupOrder to render, but append any new segregationGroups not in groupOrder
  // Use a stable sort to prevent position jumping during real-time updates
  const displayGroups = useMemo(() => {
    const orderedGroups = groupOrder
      .map((id) => segregationGroups.find((g) => g.id === id))
      .filter(Boolean);

    const newGroups = segregationGroups.filter(
      (g) => !groupOrder.includes(g.id)
    );

    // Sort new groups by creation time or ID to ensure consistent ordering
    const sortedNewGroups = newGroups.sort((a, b) => {
      // Sort by startTime if available, otherwise by ID
      const timeA =
        (a.startTime instanceof Date
          ? a.startTime.getTime()
          : a.startTime?.toDate?.()?.getTime()) || 0;
      const timeB =
        (b.startTime instanceof Date
          ? b.startTime.getTime()
          : b.startTime?.toDate?.()?.getTime()) || 0;

      if (timeA !== timeB) {
        return timeA - timeB; // Older groups first in the new groups section
      }

      // Fallback to ID comparison for consistent ordering
      return a.id.localeCompare(b.id);
    });

    return [...orderedGroups, ...sortedNewGroups];
  }, [groupOrder, segregationGroups]);

  // Console logging for segregation order (runs whenever the order changes)
  useEffect(() => {
    if (displayGroups.length > 0) {
      console.log("🔍 [SEGREGATION ORDER LOG] ===================");
      console.log("📊 Current Segregation Processing Order:");
      displayGroups.forEach((group, idx) => {
        const status = idx < 2 ? "🟢 ACTIVE" : "⏳ WAITING";
        console.log(
          `  ${idx + 1}. ${status} - ${group.clientName} (ID: ${group.id})`
        );
        console.log(`     - Status: ${group.status}`);
        console.log(`     - Segregated Carts: ${group.segregatedCarts || 0}`);
        console.log(`     - Total Weight: ${group.totalWeight || 0} lbs`);
        console.log(
          `     - Flagged for Tomorrow: ${
            group.segregationTomorrow ? "Yes" : "No"
          }`
        );
      });
      console.log(
        `📈 Summary: ${displayGroups.length} total groups, ${Math.min(
          2,
          displayGroups.length
        )} active, ${Math.max(0, displayGroups.length - 2)} waiting`
      );
      console.log("🔍 [END SEGREGATION ORDER LOG] ===============");
    }
  }, [
    displayGroups.length,
    displayGroups.map((g) => g.id).join(","),
    displayGroups.map((g) => g.segregatedCarts).join(","),
  ]);

  // Track new clients appearing at bottom of list
  useEffect(() => {
    const currentGroupIds = segregationGroups.map((g) => g.id);
    const newClients = currentGroupIds.filter(
      (id) => !previousGroups.includes(id)
    );

    if (newClients.length > 0 && previousGroups.length > 0) {
      console.log("🆕 [NEW CLIENTS DETECTED] ===================");
      newClients.forEach((id) => {
        const group = segregationGroups.find((g) => g.id === id);
        const position = displayGroups.findIndex((g) => g.id === id) + 1;
        console.log(`📍 NEW CLIENT ADDED: ${group?.clientName || "Unknown"}`);
        console.log(`   - Client ID: ${id}`);
        console.log(
          `   - Position in queue: ${position} of ${displayGroups.length}`
        );
        console.log(`   - Added at: ${new Date().toLocaleTimeString()}`);
        console.log(`   - Status: ${group?.status || "Unknown"}`);
        console.log(`   - Total Weight: ${group?.totalWeight || 0} lbs`);

        if (position === displayGroups.length) {
          console.log(`   - ✅ POSITIONED AT BOTTOM OF LIST (as expected)`);
        } else {
          console.log(`   - ⚠️ POSITIONED ELSEWHERE (position ${position})`);
        }
      });
      console.log("🆕 [END NEW CLIENTS DETECTED] ==============");
    }

    setPreviousGroups(currentGroupIds);
  }, [segregationGroups.map((g) => g.id).join(",")]);

  // Enhanced logging for order changes with user tracking
  useEffect(() => {
    if (groupOrder.length > 0 && previousOrder.length > 0) {
      // Check if order actually changed
      const orderChanged =
        groupOrder.length !== previousOrder.length ||
        !groupOrder.every((id, idx) => id === previousOrder[idx]);

      if (orderChanged) {
        console.log("📋 [ORDER CHANGE] ===================");
        console.log("🔄 Order has been modified");
        console.log("👤 Changed by: User interaction (manual reordering)");
        console.log("⏰ Time: " + new Date().toLocaleTimeString());
        console.log(
          "📊 Previous order:",
          previousOrder.map((id) => {
            const group = segregationGroups.find((g) => g.id === id);
            return group ? `${group.clientName}` : `Unknown`;
          })
        );
        console.log(
          "📊 New order:",
          groupOrder.map((id) => {
            const group = segregationGroups.find((g) => g.id === id);
            return group ? `${group.clientName}` : `Unknown`;
          })
        );

        // Identify specific changes
        const changes = [];
        for (
          let i = 0;
          i < Math.max(groupOrder.length, previousOrder.length);
          i++
        ) {
          if (groupOrder[i] !== previousOrder[i]) {
            const currentGroup = segregationGroups.find(
              (g) => g.id === groupOrder[i]
            );
            const previousGroup = segregationGroups.find(
              (g) => g.id === previousOrder[i]
            );
            if (
              currentGroup &&
              previousGroup &&
              currentGroup.id !== previousGroup.id
            ) {
              changes.push(
                `Position ${i + 1}: ${previousGroup.clientName} → ${
                  currentGroup.clientName
                }`
              );
            }
          }
        }

        if (changes.length > 0) {
          console.log("🔄 Specific position changes:");
          changes.forEach((change) => console.log(`   ${change}`));
        }

        console.log("📋 [END ORDER CHANGE] ==================");
      }
    }

    if (groupOrder.length > 0) {
      setPreviousOrder([...groupOrder]);
    }
  }, [groupOrder]);

  // Log when groups are moved with enhanced user tracking
  const moveGroupWithLogging = async (groupId: string, direction: -1 | 1) => {
    const group = segregationGroups.find((g) => g.id === groupId);
    const oldIndex = groupOrder.indexOf(groupId);
    const newIndex = oldIndex + direction;
    const currentUser = getCurrentUser();

    console.log("🔄 [MOVE GROUP] ===================");
    console.log(`👤 Action performed by: ${currentUser}`);
    console.log(`📱 Moving: ${group?.clientName || groupId}`);
    console.log(`📍 From position: ${oldIndex + 1} → ${newIndex + 1}`);
    console.log(`⬆️⬇️ Direction: ${direction === -1 ? "UP" : "DOWN"}`);
    console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);

    // Show what groups will be affected
    if (newIndex >= 0 && newIndex < groupOrder.length) {
      const swapGroup = segregationGroups.find(
        (g) => g.id === groupOrder[newIndex]
      );
      console.log(`🔄 Will swap with: ${swapGroup?.clientName || "Unknown"}`);
    }

    await moveGroup(groupId, direction);

    console.log("✅ Move completed successfully");
    console.log("🔄 [END MOVE GROUP] ==============");
  };

  // --- Pending Conventional Products Widget ---
  const [pendingConventionalGroups, setPendingConventionalGroups] = useState<
    any[]
  >([]);
  useEffect(() => {
    // Listen for all pickup_groups with pendingProduct === true, washingType 'Conventional', not deleted or 'Boleta Impresa', and at least one product in carts
    import("../firebase").then(({ db }) => {
      import("firebase/firestore").then(
        ({ collection, onSnapshot, query, where }) => {
          const q = query(
            collection(db, "pickup_groups"),
            where("pendingProduct", "==", true),
            where("washingType", "==", "Conventional")
          );
          const unsub = onSnapshot(q, (snap) => {
            const filtered = snap.docs
              .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
              .filter(
                (g: any) =>
                  g.pendingProduct === true &&
                  g.washingType === "Conventional" &&
                  g.status !== "deleted" &&
                  g.status !== "Boleta Impresa" &&
                  Array.isArray(g.carts) &&
                  g.carts.length > 0
              );
            setPendingConventionalGroups(filtered);
          });
          return unsub;
        }
      );
    });
  }, []);

  // Handler for completing segregation for a group
  const handleComplete = async (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    const segregatedCount = parseInt(segregatedCounts[groupId] || "0", 10);

    console.log("✅ [COMPLETE GROUP] ===================");
    console.log(`📱 Completing: ${group?.clientName || groupId}`);
    console.log(`📊 Segregated Count: ${segregatedCount}`);
    console.log(`🎯 Moving to next phase`);

    setCompletingGroup(groupId);
    try {
      const client = clients.find((c) => c.id === group?.clientId);
      // Always set status to Tunnel or Conventional only
      let newStatus = "Conventional";
      let orderUpdate: any = {};

      // Use effective washing type (considering overrides)
      const effectiveWashingType = getEffectiveWashingType(
        group?.id || groupId,
        client
      );

      if (effectiveWashingType === "Tunnel") {
        newStatus = "Tunnel";
        // Only assign order if group doesn't already have one (preserve supervisor-set order)
        if (typeof group?.order !== "number") {
          // Find max order among existing Tunnel groups and add 1 to put at bottom
          const existingTunnelGroups = groups.filter(
            (g) =>
              g.status === "Tunnel" &&
              clients.find((c) => c.id === g.clientId)?.washingType === "Tunnel"
          );
          const maxOrder = existingTunnelGroups.reduce(
            (max, g) =>
              typeof g.order === "number" && g.order > max ? g.order : max,
            -1
          );
          orderUpdate = { order: maxOrder + 1 };
          console.log(`📈 Assigned new tunnel order: ${maxOrder + 1}`);
        } else {
          console.log(
            `🔒 Preserving existing tunnel order: ${group.order} (supervisor-set)`
          );
        }
      } else {
        // For Conventional groups, also assign order only if not already set
        if (typeof group?.order !== "number") {
          const existingConventionalGroups = groups.filter(
            (g) =>
              g.status === "Conventional" &&
              clients.find((c) => c.id === g.clientId)?.washingType ===
                "Conventional"
          );
          const maxOrder = existingConventionalGroups.reduce(
            (max, g) =>
              typeof g.order === "number" && g.order > max ? g.order : max,
            -1
          );
          orderUpdate = { order: maxOrder + 1 };
          console.log(`📈 Assigned new conventional order: ${maxOrder + 1}`);
        } else {
          console.log(
            `🔒 Preserving existing conventional order: ${group.order} (supervisor-set)`
          );
        }
      }

      console.log(`📋 New Status: ${newStatus}`);
      console.log(`📈 Order Update:`, orderUpdate);

      // Log override usage if applicable
      const override = washingTypeOverrides[groupId];
      if (override) {
        console.log(
          `🔄 OVERRIDE APPLIED: Client default (${client?.washingType}) → ${override}`
        );
        await logActivity({
          type: "Segregation",
          message: `Override applied to ${getGroupDisplayName(
            groupId,
            group
          )}: Client default (${
            client?.washingType
          }) forced to ${override} by ${getCurrentUser()}`,
          user: getCurrentUser(),
        });
      }

      await updateDoc(doc(db, "pickup_groups", groupId), {
        segregatedCarts: segregatedCount,
        status: newStatus,
        ...orderUpdate,
        // Clear verification status when segregation is completed
        cartCountVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        verifiedCartCount: null,
      });

      // Clean up the override for this group since it's completed
      if (override) {
        setWashingTypeOverrides((prev) => {
          const newOverrides = { ...prev };
          delete newOverrides[groupId];
          return newOverrides;
        });
      }
      // --- LOG TO segregation_done_logs ---
      // Calculate total weight for this group (sum all carts' totalWeight or use group.totalWeight if available)
      let totalWeight = 0;
      if (Array.isArray(group?.carts)) {
        totalWeight = group.carts.reduce(
          (sum: number, cart: any) => sum + (cart.totalWeight || 0),
          0
        );
      } else if (typeof group?.totalWeight === "number") {
        totalWeight = group.totalWeight;
      }
      await addDoc(collection(db, "segregation_done_logs"), {
        clientId: client?.id || group?.clientId || groupId,
        clientName: client?.name || group?.clientName || "",
        date: new Date().toISOString().slice(0, 10),
        weight: totalWeight,
        groupId,
        timestamp: new Date().toISOString(),
        user: getCurrentUser(),
      });
      // --- END LOG ---
      setStatusUpdating(groupId);
      setSegregatedCounts((prev) => ({ ...prev, [groupId]: "" }));
      if (onGroupComplete) onGroupComplete();
      await logActivity({
        type: "Segregation",
        message: `Group ${getGroupDisplayName(
          groupId,
          group
        )} completed segregation by ${getCurrentUser()}`,
        user: getCurrentUser(),
      });

      console.log("✅ Group completion successful");
      console.log("✅ [END COMPLETE GROUP] ==============");
    } catch (err) {
      console.error("❌ Error completing segregation:", err);
      alert("Error completing segregation for this group");
    } finally {
      setCompletingGroup(null);
    }
  };

  // Handler to skip segregation for a group
  const handleSkipSegregation = async (groupId: string) => {
    setCompletingGroup(groupId);

    const group = groups.find((g) => g.id === groupId);
    console.log("🚀 [SKIP SEGREGATION] ===================");
    console.log(`📱 Skipping segregation for: ${group?.clientName || groupId}`);
    console.log(`📊 Current status: ${group?.status}`);
    console.log(`🏷️ Group ID: ${groupId}`);

    try {
      const client = clients.find((c) => c.id === group?.clientId);
      // Use the current cart count as the segregatedCarts value
      const cartCount = getCartCount(groupId);
      let newStatus = "Conventional";
      let orderUpdate: any = {};

      // Use effective washing type (considering overrides)
      const effectiveWashingType = getEffectiveWashingType(groupId, client);

      if (effectiveWashingType === "Tunnel") {
        newStatus = "Tunnel";
        console.log(
          `🔄 Effective washing type is Tunnel, changing status to: ${newStatus}`
        );
        // Only assign order if group doesn't already have one (preserve supervisor-set order)
        if (typeof group?.order !== "number") {
          // Find max order among existing Tunnel groups and add 1 to put at bottom
          const existingTunnelGroups = groups.filter(
            (g) =>
              g.status === "Tunnel" &&
              clients.find((c) => c.id === g.clientId)?.washingType === "Tunnel"
          );
          const maxOrder = existingTunnelGroups.reduce(
            (max, g) =>
              typeof g.order === "number" && g.order > max ? g.order : max,
            -1
          );
          orderUpdate = { order: maxOrder + 1 };
          console.log(`📈 Assigned new tunnel order: ${maxOrder + 1}`);
        } else {
          console.log(
            `🔒 Preserving existing tunnel order: ${group.order} (supervisor-set)`
          );
        }
      } else {
        console.log(
          `🔄 Effective washing type is Conventional, changing status to: ${newStatus}`
        );
        // For Conventional groups, also assign order only if not already set
        if (typeof group?.order !== "number") {
          const existingConventionalGroups = groups.filter(
            (g) =>
              g.status === "Conventional" &&
              clients.find((c) => c.id === g.clientId)?.washingType ===
                "Conventional"
          );
          const maxOrder = existingConventionalGroups.reduce(
            (max, g) =>
              typeof g.order === "number" && g.order > max ? g.order : max,
            -1
          );
          orderUpdate = { order: maxOrder + 1 };
          console.log(`📈 Assigned new conventional order: ${maxOrder + 1}`);
        } else {
          console.log(
            `🔒 Preserving existing conventional order: ${group.order} (supervisor-set)`
          );
        }
      }

      console.log(
        `💾 Updating Firestore with status: ${newStatus}, order: ${orderUpdate.order}`
      );

      // Log override usage if applicable
      const override = washingTypeOverrides[groupId];
      if (override) {
        console.log(
          `🔄 OVERRIDE APPLIED: Client default (${client?.washingType}) → ${override}`
        );
        await logActivity({
          type: "Segregation",
          message: `Override applied to ${getGroupDisplayName(
            groupId,
            group
          )}: Client default (${
            client?.washingType
          }) forced to ${override} by ${getCurrentUser()}`,
          user: getCurrentUser(),
        });
      }

      // Update Firestore
      const groupRef = doc(db, "pickup_groups", groupId);
      await updateDoc(groupRef, {
        segregatedCarts: cartCount,
        status: newStatus,
        ...orderUpdate,
        // Clear verification status when segregation is skipped
        cartCountVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        verifiedCartCount: null,
      });

      // Clean up the override for this group since it's completed
      if (override) {
        setWashingTypeOverrides((prev) => {
          const newOverrides = { ...prev };
          delete newOverrides[groupId];
          return newOverrides;
        });
      }

      console.log(`✅ Firestore update complete`);

      // Verify the update worked by reading back the document
      try {
        const { getDoc } = await import("firebase/firestore");
        const updatedDoc = await getDoc(groupRef);
        if (updatedDoc.exists()) {
          const updatedData = updatedDoc.data();
          console.log(`🔍 Verification: Status is now "${updatedData.status}"`);
          if (updatedData.status !== newStatus) {
            console.error(
              `❌ Status update failed! Expected: "${newStatus}", Got: "${updatedData.status}"`
            );
            throw new Error(
              `Status update verification failed. Expected ${newStatus}, got ${updatedData.status}`
            );
          }
        } else {
          console.error(
            `❌ Document ${groupId} no longer exists after update!`
          );
          throw new Error("Document disappeared after update");
        }
      } catch (verifyError) {
        console.error(`❌ Error verifying update:`, verifyError);
        throw verifyError;
      }

      console.log(
        `📤 Group should now disappear from segregation and appear in ${newStatus}`
      );

      // Force immediate UI update to prevent race conditions
      setGroups((prevGroups) =>
        prevGroups.map((g) =>
          g.id === groupId
            ? {
                ...g,
                status: newStatus,
                segregatedCarts: cartCount,
                ...orderUpdate,
              }
            : g
        )
      );

      setStatusUpdating(groupId);
      setSegregatedCounts((prev) => ({
        ...prev,
        [groupId]: String(cartCount),
      }));
      if (onGroupComplete) onGroupComplete();
      await logActivity({
        type: "Segregation",
        message: `Group ${getGroupDisplayName(
          groupId,
          group
        )} skipped segregation by ${getCurrentUser()}`,
        user: getCurrentUser(),
      });

      // Delayed verification to catch race conditions
      setTimeout(() => {
        console.log(
          `🕐 [DELAYED CHECK] Group ${groupId} (${group?.clientName}) should no longer be in segregation`
        );
        const stillInSegregation = groups.some(
          (g) =>
            g.id === groupId &&
            typeof g.status === "string" &&
            ["segregacion", "segregation"].includes(g.status.toLowerCase())
        );
        if (stillInSegregation) {
          console.warn(
            `⚠️ Group ${groupId} is still showing in segregation after skip!`
          );
        }
      }, 2000);

      console.log("🏁 [END SKIP SEGREGATION] ==============");
    } catch (err) {
      console.error("❌ Error skipping segregation:", err);
      alert(
        `Error skipping segregation for this group: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setCompletingGroup(null);
    }
  };

  // Real-time listener for all pickup_groups (no date filter)
  useEffect(() => {
    const q = collection(db, "pickup_groups");
    const unsub = onSnapshot(q, (snap) => {
      const fetchedGroups = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGroups(fetchedGroups);
    });
    return () => unsub();
  }, []);

  // Sync segregatedCounts with Firestore values in real time
  useEffect(() => {
    // Only update segregatedCounts if the Firestore value is different from the current input
    setSegregatedCounts((prev) => {
      const next = { ...prev };
      groups.forEach((group) => {
        if (
          typeof group.segregatedCarts === "number" &&
          (prev[group.id] === undefined ||
            prev[group.id] !== String(group.segregatedCarts))
        ) {
          next[group.id] = String(group.segregatedCarts);
        }
      });
      // Remove counts for groups that no longer exist
      Object.keys(next).forEach((id) => {
        if (!groups.some((g) => g.id === id)) delete next[id];
      });
      return next;
    });
  }, [groups]);

  // Load verified clients from Firestore on mount and when groups change
  useEffect(() => {
    if (groups.length > 0) {
      const verifiedGroupIds = groups
        .filter((group) => group.cartCountVerified === true)
        .map((group) => group.id);
      
      if (verifiedGroupIds.length > 0) {
        console.log(`📋 Loading ${verifiedGroupIds.length} verified clients from Firestore`);
        setVerifiedClients(new Set(verifiedGroupIds));
      }
    }
  }, [groups]);

  const { user } = useAuth();

  // Check if user can edit the alert banner
  const canEdit = user && ["Supervisor", "Admin", "Owner"].includes(user.role);

  // Check if user is employee (not supervisor or above)
  const isEmployee =
    user && !["Supervisor", "Admin", "Owner"].includes(user.role);

  // Handler for showing confirmation modal before completing segregation
  const showDoneConfirmationModal = (groupId: string) => {
    setConfirmingClient(groupId);
    setShowDoneConfirmation(true);
  };

  // Handler for confirming completion after user confirms quantity
  const confirmDone = async () => {
    if (confirmingClient) {
      setShowDoneConfirmation(false);
      await handleComplete(confirmingClient);
      setConfirmingClient(null);
    }
  };

  // Handler for canceling the confirmation modal
  const cancelDoneConfirmation = () => {
    setShowDoneConfirmation(false);
    setConfirmingClient(null);
  };

  // Helper functions for cart count verification system
  const startVerification = () => {
    setVerificationStarted(true);
    setShowVerificationError(false);
    setVerificationErrorUser("");
  };

  const startClientVerification = (groupId: string) => {
    setVerifyingClient(groupId);
    setExpectedCartCount("");
  };

  // Get the current client that should be worked on
  const getCurrentClient = () => {
    if (verifyingClient) {
      // If currently verifying, return only that client
      return displayGroups.find((g) => g.id === verifyingClient);
    }

    // Return the first unverified client in the ordered list
    const unverified = displayGroups.find((g) => !verifiedClients.has(g.id));
    if (unverified) {
      return unverified;
    }

    // If all clients are verified, return the first one (they can work on any verified client)
    return displayGroups.length > 0 ? displayGroups[0] : null;
  };

  // Check if we should show the full list (all clients verified) or single client mode
  const shouldShowSingleClient = () => {
    // Show full list for employees so they can see all clients (but with names hidden until verified)
    return false;
  };

  const sendVerificationErrorEmail = async (
    groupId: string,
    expectedCount: string,
    actualCount: number,
    username: string
  ) => {
    try {
      // Find the group and client name
      const group = displayGroups.find((g) => g.id === groupId);
      const clientName = group?.clientName || "Unknown Client";

      // Send email notification to the backend server running on port 3001
      const response = await fetch(
        "http://localhost:3001/api/send-verification-error-email",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientName,
            expectedCount,
            actualCount,
            username,
            date: new Date().toISOString(),
          }),
        }
      );

      if (!response.ok) {
        console.error("Failed to send verification error email");
      }

      // Log the verification error
      await logActivity({
        type: "Cart Verification Error",
        message: `${username} incorrectly counted carts for ${clientName}. Expected: ${expectedCount}, Actual: ${actualCount}`,
        user: username,
      });
    } catch (error) {
      console.error("Error sending verification error email:", error);
    }
  };

  const verifyCartCount = async (groupId: string) => {
    const actualCount = getCartCount(groupId);
    const expectedCount = parseInt(expectedCartCount, 10);
    const group = displayGroups.find((g) => g.id === groupId);

    if (expectedCount !== actualCount) {
      // Verification failed - create error record
      const clientName = group?.clientName || "Unknown Client";
      const errorRecord = {
        id: Date.now().toString(),
        username: user?.username || "Unknown User",
        clientName,
        expectedCount: expectedCartCount,
        actualCount,
        timestamp: new Date(),
      };

      // Add to verification errors list
      setVerificationErrors((prev) => [errorRecord, ...prev]);

      // Persist failure to Firestore for supervisor visibility
      try {
        await addDoc(collection(db, "verificationFailures"), {
          username: errorRecord.username,
          clientName: errorRecord.clientName,
          expectedCount: errorRecord.expectedCount,
          actualCount: errorRecord.actualCount,
          groupId,
          timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.error("❌ Failed to log verification failure to Firestore:", e);
      }

      // Show full screen red alert and errors sidebar
      setShowVerificationError(true);
      setVerificationErrorUser(user?.username || "Unknown User");
      setShowErrorsSidebar(true);

      // Send error email
      await sendVerificationErrorEmail(
        groupId,
        expectedCartCount,
        actualCount,
        user?.username || "Unknown User"
      );

      // Reset verification state
      setVerifyingClient(null);
      setExpectedCartCount("");
      return false;
    } else {
      // Verification succeeded
      setVerifiedClients((prev) => new Set([...prev, groupId]));
      setVerifyingClient(null);
      setExpectedCartCount("");
      setShowVerificationError(false);
      setVerificationErrorUser("");

      // Save verification status to Firestore for persistence across sessions
      await updateDoc(doc(db, "pickup_groups", groupId), {
        cartCountVerified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: user?.username || user?.id || "Unknown User",
        verifiedCartCount: actualCount,
      });

      // Initialize segregated count to 0 for the verified client
      setSegregatedCounts((prev) => ({ ...prev, [groupId]: "0" }));

      // Don't move the client - keep them in their current position but now verified (green)
      console.log(`✅ Client ${group?.clientName} verified and ready for segregation - status saved to Firestore`);

      return true;
    }
  };

  const resetVerificationError = () => {
    setShowVerificationError(false);
    setVerificationErrorUser("");
    setShowErrorsSidebar(false);
  };

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

  // --- UI ---

  return (
    <>
      {/* Full Red Screen Alert Overlay */}
      {showVerificationError && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(220, 53, 69, 0.95)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(5px)",
          }}
        >
          <div
            style={{
              background: "#fff",
              border: "5px solid #dc3545",
              borderRadius: "20px",
              padding: "40px",
              textAlign: "center",
              maxWidth: "500px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ fontSize: "4rem", marginBottom: "20px" }}>🚨</div>
            <h1
              style={{
                color: "#dc3545",
                marginBottom: "20px",
                fontSize: "2.5rem",
                fontWeight: 900,
              }}
            >
              VERIFICATION ERROR!
            </h1>
            <div
              style={{
                fontSize: "1.2rem",
                marginBottom: "15px",
                color: "#721c24",
              }}
            >
              <strong>{verificationErrorUser}</strong> provided incorrect cart
              count
            </div>
            <div
              style={{
                fontSize: "1rem",
                marginBottom: "25px",
                color: "#721c24",
              }}
            >
              Email notification has been sent to management
            </div>
            <button
              className="btn btn-danger btn-lg"
              onClick={resetVerificationError}
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                padding: "12px 30px",
                borderRadius: "10px",
                boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
              }}
            >
              ACKNOWLEDGE ERROR
            </button>
          </div>
        </div>
      )}

      {/* Verification Errors Sidebar */}
      {showErrorsSidebar && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "350px",
            height: "100vh",
            backgroundColor: "#fff",
            borderRight: "3px solid #dc3545",
            zIndex: 9998,
            padding: "20px",
            overflowY: "auto",
            boxShadow: "5px 0 15px rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              marginBottom: "20px",
              borderBottom: "2px solid #dc3545",
              paddingBottom: "15px",
            }}
          >
            <h4
              style={{ color: "#dc3545", fontWeight: 900, marginBottom: "5px" }}
            >
              🚨 VERIFICATION ERRORS
            </h4>
            <div style={{ fontSize: "14px", color: "#666" }}>
              Total Errors: <strong>{verificationErrors.length}</strong>
            </div>
            <button
              onClick={() => setShowErrorsSidebar(false)}
              style={{
                position: "absolute",
                top: "15px",
                right: "15px",
                background: "transparent",
                border: "none",
                fontSize: "24px",
                color: "#dc3545",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          <div style={{ marginBottom: "20px" }}>
            {verificationErrors.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#666",
                  fontStyle: "italic",
                }}
              >
                No verification errors yet
              </div>
            ) : (
              <div>
                {verificationErrors.map((error) => (
                  <div
                    key={error.id}
                    style={{
                      backgroundColor: "#f8d7da",
                      border: "2px solid #f5c6cb",
                      borderRadius: "10px",
                      padding: "15px",
                      marginBottom: "15px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#721c24",
                        marginBottom: "8px",
                        fontSize: "16px",
                      }}
                    >
                      👤 {error.username}
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#721c24",
                        marginBottom: "5px",
                      }}
                    >
                      <strong>Client:</strong> {error.clientName}
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#721c24",
                        marginBottom: "5px",
                      }}
                    >
                      <strong>Expected:</strong> {error.expectedCount} carts
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "#721c24",
                        marginBottom: "5px",
                      }}
                    >
                      <strong>Actual:</strong> {error.actualCount} carts
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      {error.timestamp.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {verificationErrors.length > 0 && (
            <div
              style={{
                marginTop: "auto",
                paddingTop: "20px",
                borderTop: "1px solid #dee2e6",
              }}
            >
              <button
                onClick={() => setVerificationErrors([])}
                className="btn btn-outline-danger btn-sm"
                style={{
                  width: "100%",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                Clear All Errors
              </button>
            </div>
          )}
        </div>
      )}

      <div
        className={`container py-4 segregation-page ${showErrorsSidebar ? "with-sidebar" : ""}`}
      >
        {/* Alert Banner */}
        {loadingAlert ? (
          <div
            style={{
              width: "100%",
              background: "#f3f4f6",
              borderBottom: "2px solid #d1d5db",
              padding: "8px 0",
              textAlign: "center",
              position: "sticky",
              top: 0,
              zIndex: 1000,
            }}
          >
            <span>Loading...</span>
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              background: alertMessage ? "#fef3c7" : "#f3f4f6",
              borderBottom: alertMessage
                ? "2px solid #f59e0b"
                : "2px solid #d1d5db",
              padding: "12px 0",
              textAlign: "center",
              position: "sticky",
              top: 0,
              zIndex: 1000,
              marginBottom: "16px",
              display:
                !alertMessage && !canEdit && !isEditingAlert ? "none" : "block",
            }}
          >
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

        {/* Summary Section */}
        <div
          className="mb-4 p-4 shadow-lg rounded border bg-light"
          style={{
            backgroundColor: "#f8f9fa",
            borderColor: "#dee2e6",
          }}
        >
          <h4
            style={{
              color: "#495057",
              fontWeight: 700,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            📊 Segregation Summary
          </h4>
          <div className="row text-center">
            <div className={canEdit ? "col-md-4" : "col-md-6"}>
              <div
                className="p-3 rounded"
                style={{
                  backgroundColor: "#e3f2fd",
                  border: "2px solid #2196f3",
                }}
              >
                <h5
                  style={{ color: "#1976d2", fontWeight: 700, marginBottom: 8 }}
                >
                  👥 Clients Remaining
                </h5>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    color: "#1976d2",
                  }}
                >
                  {displayGroups.length}
                </div>
              </div>
            </div>
            <div className={canEdit ? "col-md-4" : "col-md-6"}>
              <div
                className="p-3 rounded"
                style={{
                  backgroundColor: "#e8f5e8",
                  border: "2px solid #4caf50",
                }}
              >
                <h5
                  style={{ color: "#388e3c", fontWeight: 700, marginBottom: 8 }}
                >
                  ⚖️ Total Weight
                </h5>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    color: "#388e3c",
                  }}
                >
                  {(() => {
                    const totalWeight = displayGroups.reduce((sum, group) => {
                      // Calculate total weight for each group
                      let groupWeight = 0;
                      if (Array.isArray(group?.carts)) {
                        groupWeight = group.carts.reduce(
                          (cartSum: number, cart: any) =>
                            cartSum + (cart.totalWeight || 0),
                          0
                        );
                      } else if (typeof group?.totalWeight === "number") {
                        groupWeight = group.totalWeight;
                      }
                      return sum + groupWeight;
                    }, 0);

                    return totalWeight > 0
                      ? `${totalWeight.toLocaleString("en-US", {
                          maximumFractionDigits: 0,
                        })} lbs`
                      : "0 lbs";
                  })()}
                </div>
              </div>
            </div>
            {canEdit && (
              <div className="col-md-4">
                <div
                  className="p-3 rounded"
                  style={{
                    backgroundColor:
                      verificationErrors.filter((error) => {
                        const today = new Date();
                        const errorDate = new Date(error.timestamp);
                        return (
                          errorDate.toDateString() === today.toDateString()
                        );
                      }).length > 0
                        ? "#ffeaea"
                        : "#f8f9fa",
                    border:
                      verificationErrors.filter((error) => {
                        const today = new Date();
                        const errorDate = new Date(error.timestamp);
                        return (
                          errorDate.toDateString() === today.toDateString()
                        );
                      }).length > 0
                        ? "2px solid #dc3545"
                        : "2px solid #dee2e6",
                  }}
                >
                  <h5
                    style={{
                      color:
                        verificationErrors.filter((error) => {
                          const today = new Date();
                          const errorDate = new Date(error.timestamp);
                          return (
                            errorDate.toDateString() === today.toDateString()
                          );
                        }).length > 0
                          ? "#dc3545"
                          : "#6c757d",
                      fontWeight: 700,
                      marginBottom: 8,
                    }}
                  >
                    🚨 Today's Errors
                  </h5>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 900,
                      color:
                        verificationErrors.filter((error) => {
                          const today = new Date();
                          const errorDate = new Date(error.timestamp);
                          return (
                            errorDate.toDateString() === today.toDateString()
                          );
                        }).length > 0
                          ? "#dc3545"
                          : "#6c757d",
                    }}
                  >
                    {
                      verificationErrors.filter((error) => {
                        const today = new Date();
                        const errorDate = new Date(error.timestamp);
                        return (
                          errorDate.toDateString() === today.toDateString()
                        );
                      }).length
                    }
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Today's Verification Errors Detail Section */}
        {canEdit &&
          (() => {
            const todayErrors = verificationErrors.filter((error) => {
              const today = new Date();
              const errorDate = new Date(error.timestamp);
              return errorDate.toDateString() === today.toDateString();
            });

            if (todayErrors.length === 0) {
              return null;
            }

            return (
              <div
                className="card shadow p-3 mb-4 mx-auto"
                style={{
                  maxWidth: 900,
                  background: "#fff5f5",
                  border: "2px solid #dc3545",
                }}
              >
                <h5
                  className="mb-3 text-center"
                  style={{
                    color: "#dc3545",
                    letterSpacing: 1,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                  }}
                >
                  🚨 Today's Verification Errors ({todayErrors.length})
                </h5>

                <div className="row">
                  {todayErrors.map((error, index) => (
                    <div key={error.id} className="col-md-6 col-lg-4 mb-3">
                      <div
                        className="p-3 rounded shadow-sm"
                        style={{
                          backgroundColor: "#f8d7da",
                          border: "2px solid #f5c6cb",
                          height: "100%",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            color: "#721c24",
                            marginBottom: "8px",
                            fontSize: "16px",
                          }}
                        >
                          👤 {error.username}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#721c24",
                            marginBottom: "5px",
                          }}
                        >
                          <strong>Client:</strong> {error.clientName}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#721c24",
                            marginBottom: "5px",
                          }}
                        >
                          <strong>Expected:</strong> {error.expectedCount} carts
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#721c24",
                            marginBottom: "5px",
                          }}
                        >
                          <strong>Actual:</strong> {error.actualCount} carts
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "#666",
                            fontWeight: 600,
                          }}
                        >
                          🕐{" "}
                          {error.timestamp.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: true,
                          })}
                        </div>
                        <div style={{ fontSize: "11px", color: "#999" }}>
                          {error.timestamp.toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-center mt-3">
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => setShowErrorsSidebar(true)}
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    📋 View All Errors History
                  </button>
                </div>
              </div>
            );
          })()}

        {/* Pending Conventional Products Widget */}
        {pendingConventionalGroups.length > 0 && (
          <div
            className="card shadow p-3 mb-4 mx-auto"
            style={{
              maxWidth: 900,
              background: "#fffbe6",
              border: "2px solid #ffc107",
            }}
          >
            <h5
              className="mb-3 text-center"
              style={{ color: "#b8860b", letterSpacing: 1 }}
            >
              Pending Conventional Products (added via + button)
            </h5>
            <div className="d-flex flex-wrap gap-3 justify-content-center">
              {pendingConventionalGroups.map((group) => (
                <div
                  key={group.id}
                  className="p-3 rounded shadow-sm bg-white border"
                  style={{ minWidth: 180, maxWidth: 260 }}
                >
                  <div
                    style={{ fontWeight: 700, color: "#007bff", fontSize: 18 }}
                  >
                    {group.clientName}
                  </div>
                  <div style={{ fontSize: 14, color: "#333" }}>
                    Weight:{" "}
                    <strong>
                      {typeof group.totalWeight === "number"
                        ? group.totalWeight.toFixed(2)
                        : "?"}
                    </strong>{" "}
                    lbs
                  </div>
                  <div style={{ fontSize: 14, color: "#333" }}>
                    Carros:{" "}
                    <strong>
                      {Array.isArray(group.carts) ? group.carts.length : 0}
                    </strong>
                  </div>
                  <div className="mt-2">
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      Products:
                    </div>
                    <ul
                      className="mb-0"
                      style={{ fontSize: 13, paddingLeft: 18 }}
                    >
                      {Array.isArray(group.carts) &&
                        group.carts.map((cart: any, idx: number) => (
                          <li key={idx}>
                            {cart.productName || cart.productId || "Product"} x
                            {cart.quantity || 1}
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Verification System Interface */}
        {loading || orderLoading ? (
          <div className="text-center py-5">Loading...</div>
        ) : segregationGroups.length === 0 ? (
          <div className="text-muted text-center py-5">
            No groups for segregation today.
          </div>
        ) : (
          <div
            className="card shadow p-3 mb-4 mx-auto full-viewport-card"
            style={{
              maxWidth: 720,
              minWidth: 320,
              width: "100%",
              background: "#f8f9fa",
              border: "2px solid #0E62A0",
              borderRadius: 16,
              boxShadow: "0 4px 16px rgba(14,98,160,0.10)",
              padding: "2rem 1rem 1.5rem 1rem",
              marginBottom: 24,
              marginTop: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <h4
              className="mb-3 text-center"
              style={{
                letterSpacing: 1,
                fontSize: 22,
                fontWeight: 800,
                color: "#0E62A0",
              }}
            >
              Segregation Verification
            </h4>

            {/* Verification Error Display */}
            {showVerificationError && verificationErrorUser && (
              <div
                className="alert alert-danger text-center mb-3"
                style={{
                  fontSize: 16,
                  padding: "12px 20px",
                  background: "#f8d7da",
                  border: "2px solid #dc3545",
                  borderRadius: 8,
                  color: "#721c24",
                  fontWeight: 600,
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  ❌ <strong>Cart Count Error!</strong>
                </div>
                <div style={{ fontSize: 14, marginBottom: 8 }}>
                  <strong>{verificationErrorUser}</strong> provided incorrect
                  cart count
                </div>
                <div style={{ fontSize: 12, color: "#721c24" }}>
                  Email notification has been sent to management
                </div>
                <button
                  className="btn btn-outline-danger btn-sm mt-2"
                  onClick={resetVerificationError}
                  style={{ fontSize: 12 }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Start Button for Employees */}
            {isEmployee && !verificationStarted && (
              <div className="text-center">
                <div
                  className="alert alert-warning mb-4"
                  style={{
                    fontSize: 16,
                    padding: "20px",
                    background: "#fff3cd",
                    border: "2px solid #ffc107",
                    borderRadius: 12,
                    color: "#856404",
                  }}
                >
                  <div style={{ marginBottom: 10 }}>
                    🛡️ <strong>Verification Required</strong>
                  </div>
                  <div style={{ fontSize: 14, marginBottom: 15 }}>
                    You must verify cart counts before starting segregation
                    work.
                  </div>
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={startVerification}
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      padding: "12px 30px",
                      borderRadius: 8,
                    }}
                  >
                    🚀 Start Verification Process
                  </button>
                </div>
              </div>
            )}

            {/* Verification Interface for Employees */}
            {isEmployee && verificationStarted && (
              <div className="w-100">
                {/* Progress Indicator */}
                <div className="text-center mb-3">
                  <div
                    style={{
                      display: "inline-block",
                      background: "#e9ecef",
                      borderRadius: 20,
                      padding: "8px 16px",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#495057",
                    }}
                  >
                    {(() => {
                      const currentClient = getCurrentClient();
                      const isCurrentVerified = currentClient && verifiedClients.has(currentClient.id);
                      const totalClients = displayGroups.length;
                      const verifiedCount = verifiedClients.size;
                      
                      if (totalClients === 0) {
                        return "No clients in segregation";
                      } else if (isCurrentVerified) {
                        return `✅ Working on: ${currentClient?.clientName} (Verified)`;
                      } else {
                        return "🔍 Verification in progress";
                      }
                    })()}
                  </div>
                </div>

                {shouldShowSingleClient() ? (
                  // Single Client Focus Mode - Matches Tunnel Interface
                  (() => {
                    const currentClient = getCurrentClient();
                    if (!currentClient) {
                      return (
                        <div className="text-center py-4">
                          <div className="alert alert-success">
                            <h5>🎉 All Clients Verified!</h5>
                            <p>You can now work on all segregation tasks.</p>
                          </div>
                        </div>
                      );
                    }

                    const isVerified = verifiedClients.has(currentClient.id);
                    const isVerifying = verifyingClient === currentClient.id;
                    const actualCartCount = getCartCount(currentClient.id);

                    return (
                      <div
                        className="list-group list-group-flush w-100"
                        style={{
                          maxWidth: 1000,
                          margin: "0 auto",
                        }}
                      >
                        <div
                          className="list-group-item d-flex flex-row align-items-center justify-content-between py-4 mb-2 shadow-sm rounded"
                          style={{
                            background: isVerified ? "#d1f2eb" : "#fff", // Green background for verified clients
                            border: isVerified ? "1.5px solid #27ae60" : "1.5px solid #e3e3e3", // Green border for verified
                            fontSize: 16,
                            minHeight: 80,
                            boxShadow: isVerified ? "0 1px 6px rgba(39,174,96,0.06)" : "0 1px 6px rgba(14,98,160,0.06)",
                          }}
                        >
                          {/* Left side: Client info */}
                          <div
                            className="d-flex flex-column"
                            style={{ flex: 1 }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: 28,
                                color: isVerified ? "#27ae60" : "#007bff", // Green text for verified
                                marginBottom: 4,
                              }}
                            >
                              {isVerified && "🟢 "}{currentClient.clientName}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span style={{ fontSize: 14, color: "#666" }}>
                                Weight: <span className="segregation-weight-badge">{typeof currentClient.totalWeight === "number" ? currentClient.totalWeight.toLocaleString() : "?"} lbs</span>
                              </span>
                              {currentClient.lastMovedBy && (
                                <span
                                  className="user-move-badge"
                                  title={`Moved by ${
                                    currentClient.lastMovedBy
                                  }${
                                    currentClient.lastMovedAt
                                      ? " at " +
                                        new Date(
                                          currentClient.lastMovedAt
                                        ).toLocaleString()
                                      : ""
                                  }`}
                                >
                                  <span className="user-icon">👤</span>
                                  {currentClient.lastMovedBy}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right side: Verification controls - matching tunnel exactly */}
                          <div style={{ minWidth: 220 }}>
                            {!isVerified ? (
                              !isVerifying ? (
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
                                    startClientVerification(currentClient.id)
                                  }
                                  aria-label="Verify Cart Count"
                                >
                                  ?
                                </button>
                              ) : (
                                <div className="d-flex align-items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    className="form-control form-control-sm"
                                    style={{ width: 110, maxWidth: "100%" }}
                                    placeholder="How many carts did you count?"
                                    value={expectedCartCount}
                                    onChange={(e) =>
                                      setExpectedCartCount(e.target.value)
                                    }
                                    autoFocus
                                  />
                                  <button
                                    className="btn btn-primary btn-sm ms-2"
                                    onClick={() =>
                                      verifyCartCount(currentClient.id)
                                    }
                                    disabled={!expectedCartCount}
                                  >
                                    Verify
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm ms-2"
                                    onClick={() => {
                                      setVerifyingClient(null);
                                      setExpectedCartCount("");
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )
                            ) : (
                              // Verified state - show segregation controls like tunnel
                              <div className="d-flex align-items-center gap-2">
                                <span
                                  className="cart-value"
                                  style={{ fontSize: "1.4rem", color: "#333", fontWeight: "bold" }}
                                >
                                  {segregatedCounts[currentClient.id] || 0}
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
                                    completingGroup === currentClient.id
                                  }
                                  onClick={() =>
                                    handleInputChange(
                                      currentClient.id,
                                      String(
                                        parseInt(
                                          segregatedCounts[
                                            currentClient.id
                                          ] || "0"
                                        ) + 1
                                      )
                                    )
                                  }
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
                                    parseInt(
                                      segregatedCounts[currentClient.id] || "0"
                                    ) <= 0 ||
                                    completingGroup === currentClient.id
                                  }
                                  onClick={() =>
                                    handleInputChange(
                                      currentClient.id,
                                      String(
                                        Math.max(
                                          parseInt(
                                            segregatedCounts[
                                              currentClient.id
                                            ] || "0"
                                          ) - 1,
                                          0
                                        )
                                      )
                                    )
                                  }
                                >
                                  -
                                </button>
                                {/* Done button always available for verified clients */}
                                <button
                                  className="btn btn-success btn-lg ms-3 px-4"
                                  style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    minWidth: 100,
                                    borderRadius: 12,
                                  }}
                                  disabled={
                                    completingGroup === currentClient.id
                                  }
                                  onClick={() =>
                                    showDoneConfirmationModal(currentClient.id)
                                  }
                                >
                                  {completingGroup === currentClient.id
                                    ? "Saving..."
                                    : "Done"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  // Full List Mode - Show all clients with names hidden until verified
                  <div
                    className="list-group list-group-flush w-100"
                    style={{ maxWidth: 1000, margin: "0 auto" }}
                  >
                    {displayGroups.map((group, idx) => {
                      const isVerified = verifiedClients.has(group.id);
                      const actualCartCount = getCartCount(group.id);
                      const isVerifying = verifyingClient === group.id;
                      
                      // Determine if this client can be verified (first unverified client)
                      const firstUnverifiedIndex = displayGroups.findIndex(g => !verifiedClients.has(g.id));
                      const canVerify = idx === firstUnverifiedIndex && !isVerified && !verifyingClient;

                      return (
                        <div
                          key={group.id}
                          className="list-group-item d-flex flex-row align-items-center justify-content-between py-4 mb-2 shadow-sm rounded"
                          style={{
                            background: isVerified ? "#d1f2eb" : "#fff", // Green background for verified clients
                            border: isVerified ? "1.5px solid #27ae60" : "1.5px solid #e3e3e3", // Green border for verified
                            fontSize: isVerified ? 18 : 16, // Bigger font for verified clients
                            minHeight: isVerified ? 120 : 80, // Bigger height for verified clients
                            boxShadow: isVerified ? "0 1px 6px rgba(39,174,96,0.06)" : "0 1px 6px rgba(14,98,160,0.06)",
                          }}
                        >
                          {/* Left side: Client info */}
                          <div
                            className="d-flex flex-column"
                            style={{ flex: 1 }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: isVerified ? 32 : 28, // Bigger font for verified clients
                                color: isVerified ? "#27ae60" : "#6c757d", // Green for verified, gray for unverified
                                marginBottom: 4,
                              }}
                            >
                              {isVerified ? (
                                `🟢 ${group.clientName}` // Show actual name for verified clients
                              ) : idx === 0 ? (
                                group.clientName // Show actual name for the first client (even if unverified)
                              ) : (
                                `Client #${idx + 1}` // Show numbered client for other unverified clients
                              )}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <span style={{ fontSize: 14, color: "#666" }}>
                                {isVerified ? (
                                  <>
                                    Verified: {actualCartCount} carts | Weight: <span className="segregation-weight-badge">{typeof group.totalWeight === "number" ? group.totalWeight.toLocaleString() : "?"} lbs</span>
                                  </>
                                ) : (
                                  <>
                                    Weight: <span className="segregation-weight-badge">{typeof group.totalWeight === "number" ? group.totalWeight.toLocaleString() : "?"} lbs</span>
                                  </>
                                )}
                              </span>
                              {group.lastMovedBy && (
                                <span
                                  className="user-move-badge"
                                  title={`Moved by ${group.lastMovedBy}${
                                    group.lastMovedAt
                                      ? " at " +
                                        new Date(group.lastMovedAt).toLocaleString()
                                      : ""
                                  }`}
                                >
                                  <span className="user-icon">👤</span>
                                  {group.lastMovedBy}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right side: Controls */}
                          <div className="d-flex align-items-center gap-2">
                            {!isVerified ? (
                              // Verification controls for unverified clients
                              !isVerifying ? (
                                <button
                                  className="btn btn-outline-danger btn-lg d-flex align-items-center justify-content-center"
                                  style={{
                                    fontSize: 38,
                                    minWidth: 60,
                                    minHeight: 60,
                                    borderRadius: 16,
                                    background: canVerify ? "#ff3b3b" : "#f8f9fa",
                                    color: canVerify ? "#fff" : "#6c757d",
                                    fontWeight: 900,
                                    boxShadow: canVerify ? "0 2px 8px rgba(255,59,59,0.18)" : "none",
                                    border: "none",
                                    cursor: canVerify ? "pointer" : "not-allowed",
                                  }}
                                  onClick={() => canVerify && startClientVerification(group.id)}
                                  disabled={!canVerify}
                                  aria-label="Verify Cart Count"
                                >
                                  ?
                                </button>
                              ) : (
                                <div className="d-flex align-items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    className="form-control form-control-sm"
                                    style={{ width: 110, maxWidth: "100%" }}
                                    placeholder="How many carts did you count?"
                                    value={expectedCartCount}
                                    onChange={(e) =>
                                      setExpectedCartCount(e.target.value)
                                    }
                                    autoFocus
                                  />
                                  <button
                                    className="btn btn-primary btn-sm ms-2"
                                    onClick={() =>
                                      verifyCartCount(group.id)
                                    }
                                    disabled={!expectedCartCount}
                                  >
                                    Verify
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm ms-2"
                                    onClick={() => {
                                      setVerifyingClient(null);
                                      setExpectedCartCount("");
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )
                            ) : (
                              // Segregation controls for verified clients - like tunnel interface
                              <>
                                <span
                                  className="cart-value"
                                  style={{ fontSize: "1.4rem", color: "#333", fontWeight: "bold" }}
                                >
                                  {segregatedCounts[group.id] || 0}
                                </span>
                                <button
                                  className="btn btn-outline-primary btn-lg"
                                  style={{
                                    fontSize: 30,
                                    minWidth: 60,
                                    minHeight: 60,
                                    borderRadius: 12,
                                  }}
                                  disabled={completingGroup === group.id}
                                  onClick={() => handleIncrement(group.id)}
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
                                    parseInt(segregatedCounts[group.id] || "0") <= 0 || 
                                    completingGroup === group.id
                                  }
                                  onClick={() => handleDecrement(group.id)}
                                >
                                  -
                                </button>
                                {/* Done button always available for verified clients */}
                                <button
                                  className="btn btn-success btn-lg ms-3 px-4"
                                  style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    minWidth: 100,
                                    borderRadius: 12,
                                  }}
                                  disabled={completingGroup === group.id}
                                  onClick={() => showDoneConfirmationModal(group.id)}
                                >
                                  {completingGroup === group.id
                                    ? "Saving..."
                                    : "Done"}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Normal Interface for Supervisors and Above */}
            {!isEmployee && (
              <div
                className="list-group list-group-flush w-100"
                style={{ maxWidth: 640, margin: "0 auto" }}
              >
                {displayGroups.map((group, idx) => {
                  const isSupervisorOrAbove =
                    user &&
                    ["Supervisor", "Admin", "Owner"].includes(user.role);
                  // For supervisors: only disable if segregationTomorrow is true
                  const disableActions = !!group.segregationTomorrow;

                  if (group.segregationTomorrow && !isSupervisorOrAbove) {
                    return (
                      <div
                        key={group.id}
                        className="list-group-item d-flex flex-column py-3 mb-2 shadow-sm rounded"
                        style={{
                          background: "#ffe066",
                          border: "2.5px solid #ffa600",
                          fontSize: 14,
                          minHeight: 56,
                          boxShadow: "0 1px 6px rgba(14,98,160,0.06)",
                          transition: "background 0.2s, border 0.2s",
                          pointerEvents: "none",
                          opacity: 0.7,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                            marginBottom: 4,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: 20,
                              color: "#007bff",
                              textAlign: "left",
                            }}
                          >
                            {group.clientName}
                          </span>
                        </div>
                        <div className="d-flex flex-row align-items-center justify-content-between gap-2 w-100">
                          <div style={{ minWidth: 90, maxWidth: 120 }} />
                          <div style={{ minWidth: 120, maxWidth: 160 }} />
                        </div>
                      </div>
                    );
                  }
                  // For supervisors/admins/owners and non-flagged groups
                  return (
                    <div
                      key={group.id}
                      className="list-group-item d-flex flex-column py-3 mb-2 shadow-sm rounded"
                      style={{
                        background: group.segregationTomorrow
                          ? "#ffe066"
                          : "#fff",
                        border: group.segregationTomorrow
                          ? "2.5px solid #ffa600"
                          : "1.5px solid #e3e3e3",
                        fontSize: 14,
                        minHeight: 56,
                        boxShadow: "0 1px 6px rgba(14,98,160,0.06)",
                        transition: "background 0.2s, border 0.2s",
                      }}
                    >
                      {/* Top row: arrows and client name */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                          marginBottom: 4,
                        }}
                      >
                        {isSupervisorOrAbove && (
                          <div
                            className="d-flex flex-row gap-1"
                            style={{ marginRight: 10 }}
                          >
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              title="Move up"
                              disabled={disableActions || idx === 0}
                              onClick={() => moveGroupWithLogging(group.id, -1)}
                              style={{ padding: "2px 7px", fontSize: 13 }}
                            >
                              <span aria-hidden="true">▲</span>
                            </button>
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              title="Move down"
                              disabled={
                                disableActions ||
                                idx === displayGroups.length - 1
                              }
                              onClick={() => moveGroupWithLogging(group.id, 1)}
                              style={{ padding: "2px 7px", fontSize: 13 }}
                            >
                              <span aria-hidden="true">▼</span>
                            </button>
                          </div>
                        )}
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 20,
                            color: "#007bff",
                            textAlign: "left",
                          }}
                        >
                          {group.clientName}
                          {(() => {
                            const client = clients.find(
                              (c) => c.id === group.clientId
                            );
                            const hasOverride = washingTypeOverrides[group.id];
                            const effectiveType = getEffectiveWashingType(
                              group.id,
                              client
                            );

                            // Show override indicator
                            if (
                              hasOverride &&
                              client?.washingType === "Tunnel"
                            ) {
                              return (
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    marginLeft: 8,
                                    padding: "2px 6px",
                                    backgroundColor: "#fff3cd",
                                    border: "1px solid #ffc107",
                                    borderRadius: 4,
                                    color: "#856404",
                                  }}
                                  title="Override active: Will go to Conventional instead of Tunnel"
                                >
                                  T→C
                                </span>
                              );
                            }
                            return null;
                          })()}
                          {group.lastMovedBy && (
                            <span
                              className="user-move-badge"
                              title={`Moved by ${group.lastMovedBy}${
                                group.lastMovedAt
                                  ? " at " +
                                    new Date(group.lastMovedAt).toLocaleString()
                                  : ""
                              }`}
                            >
                              <span className="user-icon">👤</span>
                              {group.lastMovedBy}
                            </span>
                          )}
                        </span>
                      </div>
                      {/* Info and controls row below */}
                      <div className="d-flex flex-row align-items-center justify-content-between gap-2 w-100">
                        {/* Info section */}
                        <div
                          className="d-flex flex-column flex-grow-1 justify-content-center"
                          style={{ flex: 1, minWidth: 0 }}
                        >
                          <span
                            style={{
                              color: "#333",
                              opacity: 0.7,
                              fontSize: "11px",
                              fontWeight: 500,
                              letterSpacing: 0.2,
                              marginTop: 1,
                              textAlign: "left",
                              display: "block",
                            }}
                          >
                            Carros:{" "}
                            <strong
                              style={{ fontSize: "11px", fontWeight: 600 }}
                            >
                              {getCartCount(group.id)}
                            </strong>
                          </span>
                          <span
                            style={{
                              fontSize: "0.95rem",
                              color: "#28a745",
                              minWidth: 70,
                              textAlign: "left",
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
                        </div>
                        {/* Controls section: only trash button */}
                        <div
                          className="d-flex flex-row align-items-center gap-2"
                          style={{ minWidth: 90, maxWidth: 120 }}
                        ></div>
                        {/* Input and action section */}
                        <div
                          className="d-flex flex-row align-items-center gap-1"
                          style={{
                            minWidth: 120,
                            maxWidth: 160,
                            justifyContent: "flex-end",
                          }}
                        >
                          <input
                            type="number"
                            min={0}
                            className="form-control form-control-sm text-center"
                            style={{
                              width: 44,
                              fontSize: 14,
                              fontWeight: 700,
                              maxWidth: "100%",
                              padding: "2px 4px",
                            }}
                            placeholder="#"
                            value={segregatedCounts[group.id] || ""}
                            onChange={(e) =>
                              handleInputChange(group.id, e.target.value)
                            }
                            disabled={
                              disableActions || completingGroup === group.id
                            }
                          />
                          <button
                            className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center"
                            onClick={() =>
                              handleInputChange(
                                group.id,
                                String(
                                  parseInt(
                                    segregatedCounts[group.id] || "0",
                                    10
                                  ) + 1
                                )
                              )
                            }
                            disabled={
                              disableActions || completingGroup === group.id
                            }
                            style={{
                              minWidth: 28,
                              width: 28,
                              height: 28,
                              fontSize: 16,
                              borderRadius: 5,
                              aspectRatio: "1 / 1",
                              padding: 0,
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: 18,
                                lineHeight: 1,
                              }}
                            >
                              +
                            </span>
                          </button>
                          <button
                            className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center"
                            onClick={() => {
                              handleInputChange(
                                group.id,
                                String(
                                  Math.max(
                                    0,
                                    parseInt(
                                      segregatedCounts[group.id] || "0",
                                      10
                                    ) - 1
                                  )
                                )
                              );
                            }}
                            disabled={
                              disableActions || completingGroup === group.id
                            }
                            style={{
                              minWidth: 28,
                              width: 28,
                              height: 28,
                              fontSize: 16,
                              borderRadius: 5,
                              aspectRatio: "1 / 1",
                              padding: 0,
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: 18,
                                lineHeight: 1,
                              }}
                            >
                              -
                            </span>
                          </button>

                          {/* Washing Type Override Button - only for Tunnel clients */}
                          {(() => {
                            const client = clients.find(
                              (c) => c.id === group.clientId
                            );
                            const hasOverride = washingTypeOverrides[group.id];
                            const effectiveType = getEffectiveWashingType(
                              group.id,
                              client
                            );

                            // Only show for Tunnel clients
                            if (client?.washingType === "Tunnel") {
                              return (
                                <button
                                  className={`btn btn-sm ms-1 px-2 ${
                                    hasOverride
                                      ? "btn-warning"
                                      : "btn-outline-warning"
                                  }`}
                                  disabled={
                                    disableActions ||
                                    completingGroup === group.id
                                  }
                                  onClick={() =>
                                    toggleWashingTypeOverride(group.id)
                                  }
                                  title={
                                    hasOverride
                                      ? `Override Active: Will go to Conventional (default: ${client.washingType})`
                                      : `Click to force to Conventional (default: ${client.washingType})`
                                  }
                                  style={{
                                    fontWeight: 700,
                                    fontSize: 11,
                                    minWidth: 44,
                                    padding: "2px 4px",
                                  }}
                                >
                                  {hasOverride ? "→C" : "T→C"}
                                </button>
                              );
                            }
                            return null;
                          })()}

                          <button
                            className="btn btn-success btn-sm ms-1 px-2"
                            disabled={
                              disableActions ||
                              completingGroup === group.id ||
                              !segregatedCounts[group.id]
                            }
                            onClick={() => handleComplete(group.id)}
                            style={{
                              fontWeight: 700,
                              fontSize: 13,
                              minWidth: 54,
                            }}
                          >
                            {completingGroup === group.id
                              ? "Saving..."
                              : "Done"}
                          </button>
                          {/* Skip Segregation button for supervisors/admins/owners */}
                          {isSupervisorOrAbove && (
                            <button
                              className="btn btn-outline-primary btn-sm ms-2"
                              style={{
                                fontWeight: 700,
                                fontSize: 18,
                                minWidth: 36,
                                padding: 0,
                              }}
                              disabled={
                                disableActions || completingGroup === group.id
                              }
                              onClick={() => handleSkipSegregation(group.id)}
                              title="Skip segregation and send to Tunnel or Conventional"
                            >
                              <span aria-hidden="true">➡️</span>
                            </button>
                          )}
                          {isSupervisorOrAbove && (
                            <>
                              <button
                                className="btn btn-warning btn-sm ms-2"
                                style={{
                                  fontWeight: 700,
                                  fontSize: 13,
                                  minWidth: 54,
                                  background: "#ffa600",
                                  color: "#222",
                                  border: "none",
                                }}
                                onClick={async () => {
                                  const newValue = !group.segregationTomorrow;
                                  await updateDoc(
                                    doc(db, "pickup_groups", group.id),
                                    { segregationTomorrow: newValue }
                                  );
                                  await logActivity({
                                    type: "Segregation",
                                    message: `${
                                      newValue ? "Flagged" : "Unflagged"
                                    } group ${
                                      group.clientName || group.id
                                    } for segregation tomorrow by ${
                                      user.username || user.id
                                    }`,
                                    user: user.username || user.id,
                                  });
                                }}
                              >
                                {group.segregationTomorrow
                                  ? "Unflag Tomorrow"
                                  : "Tomorrow"}
                              </button>
                              <button
                                className="btn btn-outline-danger btn-sm ms-1"
                                title="Delete group"
                                onClick={() =>
                                  handleDeleteSegregationGroup(group.id)
                                }
                                style={{ padding: "2px 7px", fontSize: 13 }}
                                disabled={disableActions}
                              >
                                <span aria-hidden="true">🗑️</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {showLogModal && logGroup && (
          <div
            className="modal show"
            style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
          >
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Group History Log</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowLogModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  {/* TODO: Implement group log details here, or remove this modal if not needed */}
                  <div className="text-muted">No log data available.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Done Confirmation Modal */}
        {showDoneConfirmation && confirmingClient && (
          <div
            className="modal show d-block"
            tabIndex={-1}
            style={{
              background: "rgba(0,0,0,0.5)",
              zIndex: 1050,
            }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header bg-success text-white">
                  <h5 className="modal-title">
                    🎯 Confirm Segregation Completion
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={cancelDoneConfirmation}
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body">
                  {(() => {
                    const group = displayGroups.find(g => g.id === confirmingClient);
                    const segregatedCount = parseInt(segregatedCounts[confirmingClient] || "0", 10);
                    const actualCartCount = getCartCount(confirmingClient);
                    
                    return (
                      <div className="text-center">
                        <div className="mb-4">
                          <h4 className="text-success mb-3">
                            {group?.clientName || "Client"}
                          </h4>
                          <div className="alert alert-info">
                            <h5 className="mb-2">
                              📊 Final Segregation Count
                            </h5>
                            <div style={{ fontSize: "2rem", fontWeight: "bold" }}>
                              {segregatedCount} carts segregated
                            </div>
                            <div style={{ fontSize: "1rem", color: "#666", marginTop: "10px" }}>
                              (Original cart count: {actualCartCount})
                            </div>
                          </div>
                        </div>
                        
                        <div className="alert alert-warning">
                          <strong>⚠️ Please confirm:</strong>
                          <br />
                          You have segregated <strong>{segregatedCount} carts</strong> for this client.
                          <br />
                          This action will complete the segregation process.
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={cancelDoneConfirmation}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-success btn-lg"
                    onClick={confirmDone}
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: "bold",
                      padding: "10px 20px"
                    }}
                  >
                    ✅ Confirm & Complete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Segregation;
