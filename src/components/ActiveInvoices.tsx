import React, { useEffect, useState, useMemo, useContext } from "react";
import {
  Client,
  Product,
  Invoice,
  CartItem,
  Cart,
  LaundryCart,
} from "../types";
import InvoiceForm from "./InvoiceForm";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import LaundryCartModal from "./LaundryCartModal";
import InvoiceDetailsModal from "./InvoiceDetailsModal";
import SignatureModal from "./SignatureModal";
import {
  getAllPickupGroups,
  updatePickupGroupStatus,
  getManualConventionalProductsForDate,
  deleteManualConventionalProduct,
} from "../services/firebaseService";
import { updateDoc, doc, getDoc, setDoc } from "firebase/firestore";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { AuthContext, useAuth } from "./AuthContext";
import { getUsers } from "../services/firebaseService";
import type { UserRecord } from "../services/firebaseService";
import { db } from "../firebase";
import { getClientAvatarUrl } from "../services/firebaseService";
import { logActivity } from "../services/firebaseService";
import { getInvoices } from "../services/firebaseService";
import {
  sendInvoiceEmail,
  validateEmailSettings,
  generateInvoicePDF,
} from "../services/emailService";
import { collection, onSnapshot } from "firebase/firestore";
import { formatDateSpanish } from "../utils/dateFormatter";

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
  selectedInvoiceId?: string | null;
  setSelectedInvoiceId?: (id: string | null) => void;
}

// Utility to sanitize cart items before updating invoice
function sanitizeCartItem(item: any) {
  return {
    ...item,
    price:
      typeof item.price === "number" && !isNaN(item.price) ? item.price : 0,
    quantity:
      typeof item.quantity === "number" && !isNaN(item.quantity)
        ? item.quantity
        : 1,
    addedBy: typeof item.addedBy === "string" ? item.addedBy : "",
  };
}

// Helper: determine initial carts for a new group (customize as needed)
function getInitialCartsForGroup(groupData: any) {
  // Example: always start with 1 cart. Replace with your grouping logic.
  return [
    {
      id: Date.now().toString(),
      name: "Cart 1",
      items: [],
      total: 0,
      createdAt: new Date().toISOString(),
      createdBy: "System", // System-created initial cart
    },
  ];
}

// Helper to convert Cart to LaundryCart for modal compatibility
function cartToLaundryCart(cart: Cart): LaundryCart {
  return {
    id: cart.id,
    name: cart.name,
    isActive: true, // Assume active for selection
  };
}

// Helper to check if invoice has any 'CARRO SIN NOMBRE' cart
function hasUnnamedCart(invoice: Invoice) {
  return (invoice.carts || []).some((c) =>
    c.name.toUpperCase().startsWith("CARRO SIN NOMBRE")
  );
}

// Helper function to merge cart items as individual entries
function mergeCartItems(existingItems: CartItem[], newItems: CartItem[]): CartItem[] {
  // Simply combine all items as individual entries without grouping
  const mergedItems = [...existingItems];
  
  newItems.forEach(newItem => {
    // Add each item as a separate entry, regardless of product or price duplicates
    mergedItems.push({
      ...newItem,
      addedAt: new Date().toISOString(), // Update timestamp for merged item
      editedBy: newItem.addedBy || "System",
      editedAt: new Date().toISOString()
    });
  });
  
  return mergedItems;
}

// Helper function to mark cart as modified for reprint tracking
async function markCartAsModified(invoiceId: string, cartId: string, currentUser: string) {
  try {
    const invoiceRef = doc(db, "invoices", invoiceId);
    const invoiceDoc = await getDoc(invoiceRef);
    
    if (invoiceDoc.exists()) {
      const invoice = invoiceDoc.data() as Invoice;
      const updatedCarts = (invoice.carts || []).map(cart => {
        if (cart.id === cartId) {
          return {
            ...cart,
            needsReprint: true,
            lastModifiedAt: new Date().toISOString(),
            lastModifiedBy: currentUser
          };
        }
        return cart;
      });
      
      await updateDoc(invoiceRef, {
        carts: updatedCarts,
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: currentUser
      });
    }
  } catch (error) {
    console.error("Error marking cart as modified:", error);
  }
}

export default function ActiveInvoices({
  clients,
  products,
  invoices,
  onAddInvoice,
  onDeleteInvoice,
  onUpdateInvoice,
  selectedInvoiceId: selectedInvoiceIdProp,
  setSelectedInvoiceId: setSelectedInvoiceIdProp,
}: ActiveInvoicesProps) {
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedInvoiceIdLocal, setSelectedInvoiceIdLocal] = useState<
    string | null
  >(null);
  const selectedInvoiceId =
    selectedInvoiceIdProp !== undefined
      ? selectedInvoiceIdProp
      : selectedInvoiceIdLocal;
  const setSelectedInvoiceId =
    setSelectedInvoiceIdProp || setSelectedInvoiceIdLocal;
  const [showNewCartForm, setShowNewCartForm] = useState(false);
  const [newCartName, setNewCartName] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [hoveredInvoiceId, setHoveredInvoiceId] = useState<string | null>(null);
  const [isCreatingCart, setIsCreatingCart] = useState(false);
  const [showProductKeypad, setShowProductKeypad] = useState(false);
  const [productForKeypad, setProductForKeypad] = useState<Product | null>(
    null
  );
  const [keypadQuantity, setKeypadQuantity] = useState(1);
  const [doneInvoices, setDoneInvoices] = useState<string[]>([]);

  // --- GROUP OVERVIEW ---
  const [pickupGroups, setPickupGroups] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [logGroup, setLogGroup] = useState<any | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductGroup, setAddProductGroup] = useState<any | null>(null);
  const [selectedCartId, setSelectedCartId] = useState<string>("");
  const [selectedAddProductId, setSelectedAddProductId] = useState<string>("");
  const [addProductQty, setAddProductQty] = useState<number>(1);

  // New state variables for Add To Group modal
  const [showAddToGroupModal, setShowAddToGroupModal] = useState(false);
  const [addToGroupClientId, setAddToGroupClientId] = useState("");
  const [addToGroupProductId, setAddToGroupProductId] = useState("");
  const [addToGroupMode, setAddToGroupMode] = useState<
    "carts" | "quantity" | "pounds"
  >("carts");
  const [addToGroupValue, setAddToGroupValue] = useState<number>(1);
  const [addToGroupError, setAddToGroupError] = useState("");
  const [addToGroupLoading, setAddToGroupLoading] = useState(false);

  // --- Animation State for Approval Status Changes ---
  const [animatingInvoices, setAnimatingInvoices] = useState<{
    [invoiceId: string]: "approved" | "partial" | null;
  }>({});

  // --- Cart Selection Modal State ---
  const [showCartSelectModal, setShowCartSelectModal] = useState(false);
  const [cartSelectInvoiceId, setCartSelectInvoiceId] = useState<string | null>(
    null
  );
  const [cartSelectCarts, setCartSelectCarts] = useState<Cart[]>([]);

  // Add state for lock modal and unlock input
  const [unlockInvoiceId, setUnlockInvoiceId] = useState<string | null>(null);
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const { user } = useAuth();
  const [users, setUsers] = React.useState<UserRecord[]>([]);

  // View mode state - cards or list view
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  React.useEffect(() => {
    getUsers().then((userList) => setUsers(userList));
  }, []);

  // --- Invoice Merge State ---
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceInvoiceId, setMergeSourceInvoiceId] = useState<string | null>(null);
  const [mergeTargetInvoiceId, setMergeTargetInvoiceId] = useState<string>("");
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeError, setMergeError] = useState("");

  // --- Verification State ---
  const [verifyInvoiceId, setVerifyInvoiceId] = useState<string | null>(null);
  const [verifyChecks, setVerifyChecks] = useState<{
    [cartId: string]: { [productId: string]: boolean };
  }>({});
  const [showVerifyIdModal, setShowVerifyIdModal] = useState(false);
  const [verifyIdError, setVerifyIdError] = useState("");
  const [partialVerifiedInvoices, setPartialVerifiedInvoices] = useState<{
    [id: string]: boolean;
  }>({});

  // --- Two-Step Completion State ---
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionInvoiceId, setCompletionInvoiceId] = useState<string | null>(null);
  const [selectedCompletionParts, setSelectedCompletionParts] = useState<{
    mangles: boolean;
    doblado: boolean;
  }>({ mangles: false, doblado: false });
  
  // Helper to get completed option position for a client
  function getCompletedOptionPosition(client: Client): 'top' | 'bottom' | 'both' {
    return client.completedOptionPosition || 'both';
  }

  // --- Print Options Modal State ---
  const [showPrintOptionsModal, setShowPrintOptionsModal] = useState<
    string | null
  >(null);
  const [showCartPrintModal, setShowCartPrintModal] = useState<{
    invoiceId: string;
    cartId: string;
  } | null>(null);
  const [showInvoicePrintModal, setShowInvoicePrintModal] = useState<
    string | null
  >(null);

  // --- Product Confirmation State ---
  const [showAddConfirmation, setShowAddConfirmation] = useState(false);
  const [confirmationProduct, setConfirmationProduct] = useState<{
    product: Product | null;
    quantity: number;
    cartId?: string;
    itemIdx?: number;
    addCallback: () => Promise<void>;
  } | null>(null);

  // --- Alert Banner State ---
  const [alertMessage, setAlertMessage] = useState("");
  const [isEditingAlert, setIsEditingAlert] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [loadingAlert, setLoadingAlert] = useState(true);

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

  // Handler to lock invoice
  const handleLockInvoice = async (invoiceId: string) => {
    await onUpdateInvoice(invoiceId, {
      locked: true,
      lockedBy: user?.username || user?.id || "",
      lockedAt: new Date().toISOString(),
    });
  };

  // Handler to unlock invoice (owner only)
  const handleUnlockInvoice = async (invoiceId: string) => {
    setUnlockInvoiceId(invoiceId);
    setUnlockInput("");
    setUnlockError("");
  };

  const confirmUnlock = async () => {
    // Only allow owner with correct ID (1991)
    if (unlockInput === "1991" && user?.role === "Owner") {
      await onUpdateInvoice(unlockInvoiceId!, { locked: false });
      setUnlockInvoiceId(null);
      setUnlockInput("");
      setUnlockError("");
    } else {
      setUnlockError("ID incorrecto o no autorizado.");
    }
  };

  // Open verification modal
  const handleVerifyInvoice = (invoiceId: string) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;
    // Build initial check state
    const checks: { [cartId: string]: { [productId: string]: boolean } } = {};
    for (const cart of invoice.carts) {
      checks[cart.id] = {};
      for (const item of cart.items) {
        checks[cart.id][item.productId] = false;
      }
    }
    setVerifyChecks(checks);
    setVerifyInvoiceId(invoiceId);
  };

  // Toggle check for a product
  const toggleVerifyCheck = (cartId: string, productId: string) => {
    setVerifyChecks((prev) => ({
      ...prev,
      [cartId]: {
        ...prev[cartId],
        [productId]: !prev[cartId][productId],
      },
    }));
  };

  // Check if all products are checked
  const allVerified = () => {
    return Object.values(verifyChecks).every((cartChecks) =>
      Object.values(cartChecks).every(Boolean)
    );
  };

  // Check if any products are checked
  const anyVerified = () => {
    return Object.values(verifyChecks).some((cartChecks) =>
      Object.values(cartChecks).some(Boolean)
    );
  };

  // Handler to open completion selection modal
  const handleOpenCompletionModal = (invoiceId: string) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;
    
    setCompletionInvoiceId(invoiceId);
    setSelectedCompletionParts({
      mangles: invoice.manglesCompleted || false,
      doblado: invoice.dobladoCompleted || false,
    });
    setShowCompletionModal(true);
  };

  // Handler to apply completion selection
  const handleApplyCompletion = async () => {
    if (!completionInvoiceId) return;
    
    const invoice = invoices.find((inv) => inv.id === completionInvoiceId);
    const client = clients.find((c) => c.id === invoice?.clientId);
    const completedPosition = getCompletedOptionPosition(client!);
    
    const { mangles, doblado } = selectedCompletionParts;
    
    // Update invoice with completion parts
    const updateData: Partial<Invoice> = {
      manglesCompleted: mangles,
      dobladoCompleted: doblado,
    };
    
    // Determine completion status based on client setting
    let isCompleted = false;
    if (completedPosition === 'top') {
      // For top-only clients, completed when mangles is done
      isCompleted = mangles;
    } else if (completedPosition === 'bottom') {
      // For bottom-only clients, completed when doblado is done
      isCompleted = doblado;
    } else {
      // For 'both' clients, completed when both parts are done
      isCompleted = mangles && doblado;
    }
    
    // Update status based on completion
    if (isCompleted) {
      updateData.status = "completed";
    } else if (!mangles && !doblado) {
      // If unchecking all available parts, revert to active
      updateData.status = "active";
    }
    // If only partially completed (for 'both' clients), keep current status
    
    await onUpdateInvoice(completionInvoiceId, updateData);
    
    // Trigger animation based on completion state
    if (isCompleted) {
      triggerApprovalAnimation(completionInvoiceId, "partial");
    }
    
    // Log activity
    if (user?.username) {
      const completedParts = [];
      if (mangles) completedParts.push("Mangles - Arriba");
      if (doblado) completedParts.push("Doblado - Abajo");
      
      let message = `User ${user.username} marked laundry ticket #${invoice?.invoiceNumber || completionInvoiceId}`;
      if (completedParts.length > 0) {
        message += ` - completed parts: ${completedParts.join(", ")}`;
      } else {
        message += " as uncompleted";
      }
      
      await logActivity({
        type: "Invoice",
        message,
        user: user.username,
      });
    }
    
    setShowCompletionModal(false);
    setCompletionInvoiceId(null);
  };

  // When user clicks Done in verify modal
  const handleVerifyDone = async () => {
    if (!anyVerified()) return; // Require at least one item checked
    // Instead of showing modal, immediately use logged-in user's name
    await confirmVerifyId();
  };

  // Confirm verification with user name
  const confirmVerifyId = async () => {
    if (!verifyInvoiceId) return;
    if (!user?.username) {
      setVerifyIdError("No user name found. Please log in again.");
      return;
    }
    // Build verifiedProducts structure
    const verifiedProducts: { [cartId: string]: string[] } = {};
    for (const cartId in verifyChecks) {
      verifiedProducts[cartId] = Object.entries(verifyChecks[cartId])
        .filter(([_, checked]) => checked)
        .map(([productId]) => productId);
    }
    const isFullyVerified = allVerified();
    await onUpdateInvoice(verifyInvoiceId, {
      verified: isFullyVerified,
      partiallyVerified: !isFullyVerified,
      verifiedBy: user.username,
      verifiedAt: new Date().toISOString(),
      verifiedProducts,
    });

    // Trigger appropriate animation based on verification type
    if (isFullyVerified) {
      triggerApprovalAnimation(verifyInvoiceId, "approved");
    } else {
      triggerApprovalAnimation(verifyInvoiceId, "partial");
    }

    setPartialVerifiedInvoices((prev) => ({
      ...prev,
      [verifyInvoiceId]: !isFullyVerified && anyVerified(),
    }));
    const invoice = invoices.find((inv) => inv.id === verifyInvoiceId);
    if (invoice) {
      // Log the approval activity
      if (user?.username) {
        await        logActivity({
          type: "Invoice",
          message: `User ${user.username} ${isFullyVerified ? 'approved' : 'partially approved'} laundry ticket #${invoice.invoiceNumber || invoice.id}`,
          user: user.username,
        });
      }

      // Auto-send email if enabled and fully verified
      if (isFullyVerified) {
        const client = clients.find((c) => c.id === invoice.clientId);
        if (
          client?.printConfig?.emailSettings?.enabled &&
          client.printConfig.emailSettings.autoSendOnApproval &&
          client.email
        ) {
          try {
            // Generate PDF attachment if needed
            let pdfContent: string | undefined;
            try {
              const printConfig = client.printConfig.invoicePrintSettings;
              pdfContent = await generateInvoicePDF(
                client,
                invoice,
                printConfig
              );
            } catch (error) {
              console.error("Failed to generate PDF for auto-send:", error);
            }

            // Send email
            const success = await sendInvoiceEmail(
              client,
              invoice,
              client.printConfig.emailSettings,
              pdfContent
            );

            // Update email status in invoice
            const emailStatusUpdate = {
              emailStatus: {
                ...invoice.emailStatus,
                approvalEmailSent: success,
                approvalEmailSentAt: success ? new Date().toISOString() : undefined,
                lastEmailError: success ? undefined : "Failed to send approval email"
              }
            };

            await onUpdateInvoice(invoice.id, emailStatusUpdate);

            if (success) {
              console.log(`Auto-sent invoice email to ${client.email}`);
              await logActivity({
                type: "Invoice",
                message: `Laundry Ticket #${invoice.invoiceNumber || invoice.id} auto-sent to ${client.name} (${client.email}) on approval`,
              });
            }
          } catch (error) {
            console.error("Auto-send email failed:", error);
            // Don't block the approval process if email fails
          }
        }

        // Show delivery scheduling modal first after approval
        setShowDeliveryScheduleModal(invoice.id);
      }

      openPrintInvoice({
        ...invoice,
        verified: isFullyVerified,
        partiallyVerified: !isFullyVerified,
        verifiedBy: user.username,
        verifiedAt: new Date().toISOString(),
        verifiedProducts,
      });
    }
    setShowVerifyIdModal(false);
    setVerifyInvoiceId(null);
    setVerifyChecks({});
  };

  // Handler for adding product to cart (move to component scope)
  const handleAddProductToCart = () => {
    if (
      !selectedProduct ||
      !selectedInvoiceId ||
      quantity === "" ||
      isNaN(Number(quantity)) ||
      Number(quantity) < 1
    )
      return;
    const invoice = invoicesState.find((inv) => inv.id === selectedInvoiceId);
    if (!invoice) return;

    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;

    // Create the add callback
    const addProductCallback = async () => {
      // Find or create the cart for this invoice by name (case-insensitive, trimmed)
      const trimmedCartName = newCartName.trim();
      let cartIdx = invoice.carts.findIndex(
        (c) => c.name.trim().toLowerCase() === trimmedCartName.toLowerCase()
      );
      let cart;
      if (cartIdx === -1) {
        // Create new cart if not found
        cart = {
          id: Date.now().toString(),
          name: trimmedCartName || `Cart ${invoice.carts.length + 1}`,
          items: [],
          total: 0,
          createdAt: new Date().toISOString(),
          createdBy: user?.username || "Unknown",
        };
        invoice.carts.push(cart);
        cartIdx = invoice.carts.length - 1;
      } else {
        cart = { ...invoice.carts[cartIdx] };
      }

      // Add or update product in the cart
      const existingIdx = cart.items.findIndex(
        (item) => item.productId === selectedProduct
      );
      if (existingIdx > -1) {
        cart.items[existingIdx].quantity += Number(quantity);
      } else {
        cart.items.push({
          productId: product.id,
          productName: product.name,
          quantity: Number(quantity),
          price: product.price,
          addedBy: user?.username || "Unknown",
          addedAt: new Date().toISOString(),
        });
      }

      // Update the cart in the invoice
      const updatedCarts = [...invoice.carts];
      updatedCarts[cartIdx] = cart;
      await onUpdateInvoice(selectedInvoiceId, { carts: updatedCarts });
      setQuantity("");
      setSelectedProduct("");
      setShowAddConfirmation(false);
      setConfirmationProduct(null);
    };

    // Show confirmation dialog
    setConfirmationProduct({
      product: product,
      quantity: Number(quantity),
      addCallback: addProductCallback,
    });
    setShowAddConfirmation(true);
  };

  const [invoicesState, setInvoicesState] = useState<Invoice[]>(invoices);

  // Sync invoicesState with invoices prop
  useEffect(() => {
    setInvoicesState(invoices);
  }, [invoices]);

  // Real-time Firestore listener for invoices with debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const unsub = onSnapshot(
      collection(db, "invoices"),
      (snapshot) => {
        console.log("🔄 Real-time Firestore update received, docs:", snapshot.docs.length);
        
        // Clear any pending update
        if (timeoutId) clearTimeout(timeoutId);
        
        // Debounce updates to prevent rapid state changes
        timeoutId = setTimeout(() => {
          const updated = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Invoice[];
          
          console.log("📱 Updating invoicesState with", updated.length, "invoices");
          setInvoicesState(updated);
          
          // If modal is open, update selectedInvoice with latest data
          if (showInvoiceDetailsModal && selectedInvoice) {
            const updatedSelectedInvoice = updated.find(inv => inv.id === selectedInvoice.id);
            if (updatedSelectedInvoice) {
              console.log("🔄 Updating selectedInvoice with latest data:", {
                invoiceId: updatedSelectedInvoice.id,
                carts: updatedSelectedInvoice.carts?.map(c => ({ id: c.id, name: c.name }))
              });
              setSelectedInvoice({ ...updatedSelectedInvoice });
            }
          }
        }, 50); // 50ms debounce
      },
      (error) => {
        console.error("Error listening to invoices:", error);
      }
    );
    
    return () => {
      unsub();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Refresh invoices from Firestore
  const refreshInvoices = async () => {
    const fresh = await getInvoices();
    setInvoicesState(fresh);
  };

  // --- Animation Helper Functions ---
  const triggerApprovalAnimation = (
    invoiceId: string,
    animationType: "approved" | "partial"
  ) => {
    setAnimatingInvoices((prev) => ({ ...prev, [invoiceId]: animationType }));
    // Clear animation after it completes (2s as defined in CSS)
    setTimeout(() => {
      setAnimatingInvoices((prev) => ({ ...prev, [invoiceId]: null }));
    }, 2000);
  };

  useEffect(() => {
    (async () => {
      setGroupsLoading(true);
      const groups = await getAllPickupGroups();
      setPickupGroups(groups);
      setGroupsLoading(false);
    })();
  }, []);

  const handleAddInvoice = async () => {
    setShowInvoiceForm(true);
    if (user?.username) {
      await logActivity({
        type: "Invoice",
        message: `User ${user.username} opened Create New Laundry Ticket modal`,
        user: user.username,
      });
    }
  };

  // --- Unship Recent Invoices Modal State ---
  const [showUnshipModal, setShowUnshipModal] = useState(false);
  const [unshipSelectedIds, setUnshipSelectedIds] = useState<string[]>([]);

  // --- Unship Recent Invoices Handler ---
  const handleUnshipRecentInvoices = () => {
    setShowUnshipModal(true);
    setUnshipSelectedIds([]);
  };

  // --- Confirm Unship Handler ---
  const handleConfirmUnship = async () => {
    if (unshipSelectedIds.length === 0) {
      alert("Please select at least one invoice to unship.");
      return;
    }
    for (const id of unshipSelectedIds) {
      await onUpdateInvoice(id, { status: "active", truckNumber: "" });
    }
    setShowUnshipModal(false);
    setUnshipSelectedIds([]);
    await refreshInvoices();
    alert(`Unshipped laundry tickets: ${unshipSelectedIds.join(", ")}`);
  };

  // --- Delivery Schedule Handler ---
  const handleScheduleDelivery = (invoice: Invoice) => {
    setShowDeliveryScheduleModal(invoice.id);
    // Pre-fill with current values if they exist
    const existingDeliveryDate = invoice.deliveryDate 
      ? new Date(invoice.deliveryDate).toISOString().slice(0, 10)
      : "";
    setScheduleDeliveryDate(existingDeliveryDate);
    setScheduleTruckNumber(invoice.truckNumber?.toString() || "");
    setScheduleDeliveryMethod(invoice.deliveryMethod || "truck");
  };

  const handleConfirmScheduleDelivery = async () => {
    if (!scheduleDeliveryDate) {
      alert("Please select a delivery date.");
      return;
    }

    if (scheduleDeliveryMethod === "truck" && !scheduleTruckNumber) {
      alert("Please select a truck number for truck delivery.");
      return;
    }

    const invoice = invoicesState.find(inv => inv.id === showDeliveryScheduleModal);
    if (!invoice) return;

    try {
      const updateData: Partial<Invoice> = {
        deliveryDate: new Date(scheduleDeliveryDate + "T00:00:00").toISOString(),
        deliveryMethod: scheduleDeliveryMethod,
      };

      // Only include truck number for truck delivery
      if (scheduleDeliveryMethod === "truck") {
        updateData.truckNumber = scheduleTruckNumber.toString();
      }

      await onUpdateInvoice(invoice.id, updateData);

      if (user?.username) {
        const deliveryMethodText = scheduleDeliveryMethod === "truck" 
          ? `via Truck #${scheduleTruckNumber}` 
          : "for client pickup";
        
        await logActivity({
          type: "Invoice",
          message: `User ${user.username} scheduled laundry ticket #${invoice.invoiceNumber || invoice.id} for delivery on ${scheduleDeliveryDate} ${deliveryMethodText}`,
          user: user.username,
        });
      }

      await refreshInvoices();
      
      // Store the invoice ID before clearing the delivery modal
      const invoiceId = invoice.id;
      
      setShowDeliveryScheduleModal(null);
      setScheduleDeliveryDate("");
      setScheduleTruckNumber("");
      setScheduleDeliveryMethod("truck");
      
      // Show print options modal after delivery is scheduled
      setShowPrintOptionsModal(invoiceId);
      
      const deliveryMethodText = scheduleDeliveryMethod === "truck" 
        ? `via Truck #${scheduleTruckNumber}` 
        : "for client pickup";
      alert(`Laundry Ticket scheduled for delivery on ${new Date(scheduleDeliveryDate).toLocaleDateString()} ${deliveryMethodText}`);
    } catch (error) {
      console.error("Error scheduling delivery:", error);
      alert("Error scheduling delivery. Please try again.");
    }
  };

  // --- Client Pickup Handler ---
  const handleMarkAsPickedUp = (invoice: Invoice) => {
    setPickupSignatureInvoice(invoice);
    setShowPickupSignatureModal(invoice.id);
  };

  // --- Client Pickup Signature Saved Handler ---
  const handlePickupSignatureSaved = async () => {
    if (!pickupSignatureInvoice || !user) return;

    try {
      // Mark the invoice as done (picked up)
      await onUpdateInvoice(pickupSignatureInvoice.id, {
        status: "done",
      });

      // Log the activity
      await logActivity({
        type: "Invoice",
        message: `User ${user.username} marked laundry ticket #${pickupSignatureInvoice.invoiceNumber || pickupSignatureInvoice.id} as picked up by client`,
        user: user.username,
      });

      // Update group status if invoice has pickupGroupId
      if (pickupSignatureInvoice.pickupGroupId) {
        try {
          const { updatePickupGroupStatus } = await import(
            "../services/firebaseService"
          );
          await updatePickupGroupStatus(pickupSignatureInvoice.pickupGroupId, "done");
        } catch (err) {
          console.error("Error updating group status:", err);
        }
      }

      // Close the modal
      setShowPickupSignatureModal(null);
      setPickupSignatureInvoice(null);

      alert(`Laundry Ticket #${pickupSignatureInvoice.invoiceNumber || pickupSignatureInvoice.id} marked as picked up!`);
    } catch (error) {
      console.error("Error marking as picked up:", error);
      alert("Error marking as picked up. Please try again.");
    }
  };

  // --- Delete Confirmation Logic ---
  const handleDeleteClick = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
  };

  const handleConfirmDelete = async () => {
    if (invoiceToDelete) {
      if (user?.username) {
        await logActivity({
          type: "Invoice",
          message: `User ${user.username} deleted laundry ticket #${
            invoiceToDelete.invoiceNumber || invoiceToDelete.id
          }`,
          user: user.username,
        });
      }
      // Remove from local state immediately
      setInvoicesState((prev) =>
        prev.filter((inv) => inv.id !== invoiceToDelete.id)
      );
      // Call backend deletion if needed
      await onDeleteInvoice(invoiceToDelete.id);
      setInvoiceToDelete(null);
    }
  };

  const handleProductCardClick = (product: Product) => {
    setProductForKeypad(product);
    setKeypadQuantity(1);
    setShowProductKeypad(true);
    if (user?.username) {
      logActivity({
        type: "Invoice",
        message: `User ${user.username} opened keypad to add product '${product.name}'`,
        user: user.username,
      });
    }
  };

  // --- Product Keypad Add Handler ---
  const handleKeypadAdd = async () => {
    if (!productForKeypad || keypadQuantity < 1 || !selectedInvoiceId) return;

    // Find the invoice and the selected cart
    const invoice = invoicesState.find((inv) => inv.id === selectedInvoiceId);
    if (!invoice) return;

    let cartIdx = invoice.carts.findIndex((c) => c.id === selectedCartModalId);
    if (cartIdx === -1) {
      // If no cart selected, default to first cart
      cartIdx = 0;
    }
    if (cartIdx === -1) return; // No carts at all

    // Create confirmation callback
    const addProductCallback = async () => {
      const cart = { ...invoice.carts[cartIdx] };
      // Always push a new entry (do not merge with existing)
      cart.items = [
        ...cart.items,
        {
          productId: productForKeypad.id,
          productName: productForKeypad.name,
          quantity: keypadQuantity,
          price: productForKeypad.price,
          addedBy: user?.username || "Unknown",
          addedAt: new Date().toISOString(),
        },
      ];
      
      // Update the cart in the invoice
      const updatedCarts = [...invoice.carts];
      updatedCarts[cartIdx] = {
        ...cart,
        needsReprint: true,
        lastModifiedAt: new Date().toISOString(),
        lastModifiedBy: user?.username || "Unknown"
      };
      
      // Update local state immediately for instant UI feedback
      setInvoicesState(prevInvoices => 
        prevInvoices.map(inv => 
          inv.id === selectedInvoiceId 
            ? { ...inv, carts: updatedCarts }
            : inv
        )
      );
      
      // Update selected invoice if modal is open
      if (showInvoiceDetailsModal && selectedInvoice?.id === selectedInvoiceId) {
        setSelectedInvoice(prev => prev ? { ...prev, carts: updatedCarts } : null);
      }
      
      // Persist to Firestore
      await onUpdateInvoice(selectedInvoiceId, { carts: updatedCarts });

      // Mark cart as modified for reprint tracking
      await markCartAsModified(selectedInvoiceId, cart.id, user?.username || "Unknown");

      if (user?.username) {
        await logActivity({
          type: "Invoice",
          message: `User ${user.username} added ${keypadQuantity} x '${productForKeypad.name}' to laundry ticket #${invoice.invoiceNumber || invoice.id}`,
          user: user.username,
        });
      }

      setShowAddConfirmation(false);
      setConfirmationProduct(null);
      setShowProductKeypad(false);
      setProductForKeypad(null);
    };

    // Show confirmation dialog instead of immediately adding
    setConfirmationProduct({
      product: productForKeypad,
      quantity: keypadQuantity,
      cartId: invoice.carts[cartIdx].id,
      addCallback: addProductCallback,
    });
    setShowAddConfirmation(true);
  };

  const handleStatusChange = async (groupId: string, newStatus: string) => {
    // Normalize status for Segregation/Segregacion
    let normalizedStatus = newStatus;
    if (
      newStatus.toLowerCase() === "segregacion" ||
      newStatus.toLowerCase() === "segregation"
    ) {
      normalizedStatus = "Segregation";
    }

    // Find the group and client
    const group = pickupGroups.find((g) => g.id === groupId);
    const client = group
      ? clients.find((c) => c.id === group.clientId)
      : undefined;

    // If changing from 'Recibido' and the new status is 'Segregation', check client settings
    if (
      group &&
      group.status === "Recibido" &&
      normalizedStatus === "Segregation" &&
      client
    ) {
      if (!client.segregation) {
        // If client does not need segregation, go directly to Tunnel or Conventional
        normalizedStatus =
          client.washingType === "Conventional" ? "Conventional" : "Tunnel";
      }
    }

    // If trying to set to delivered, require all manual products present
    if (
      (newStatus === "Entregado" || newStatus === "Boleta Impresa") &&
      group
    ) {
      const invoice = invoicesState.find(
        (inv) => inv.clientId === group.clientId
      );
      if (invoice && !invoiceHasAllRequiredManualProducts(invoice)) {
        alert(
          "You must add all required manual products to the invoice before delivering."
        );
        return;
      }
      if (invoice) {
        // Mark all manual products as invoiced and delivered
        const required = getRequiredManualProductsForInvoice(invoice);
        for (const mp of required) {
          await updateDoc(doc(db, "manual_conventional_products", mp.id), {
            invoiceId: invoice.id,
            delivered: true,
          });
        }
        setManualProducts((prev) =>
          prev.map((p) =>
            required.some((mp) => mp.id === p.id)
              ? { ...p, invoiceId: invoice.id, delivered: true }
              : p
          )
        );
      }
    }

    setPickupGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, status: normalizedStatus } : g
      )
    );
    setStatusUpdating(groupId);
    await updatePickupGroupStatus(groupId, normalizedStatus);

    // If status is Segregation, ensure client.segregation is true
    if (normalizedStatus === "Segregation") {
      if (group && client && !client.segregation) {
        await import("../firebase").then(({ db }) =>
          import("firebase/firestore").then(({ doc, updateDoc }) =>
            updateDoc(doc(db, "clients", client.id), { segregation: true })
          )
        );
      }
    }

    // Refetch groups to ensure UI is in sync with backend
    const groups = await getAllPickupGroups();
    setPickupGroups(groups);
    setStatusUpdating(null);
    setEditingGroupId(null);
  };

  // Progress bar steps
  const STATUS_STEPS = [
    { key: "Segregation", label: "Segregando" },
    { key: "Tunnel", label: "Tunnel/Conventional" },
    { key: "Empaque", label: "Empaque" },
    { key: "Entregado", label: "Lista para Entrega" },
  ];

  function getStepIndex(status: string) {
    const idx = STATUS_STEPS.findIndex(
      (s) =>
        status === s.key ||
        (s.key === "Tunnel" &&
          (status === "Tunnel" || status === "Conventional"))
    );
    return idx === -1 ? 0 : idx;
  }

  const handleOpenAddProductModal = (group: any) => {
    setAddProductGroup(group);
    setShowAddProductModal(true);
    setSelectedCartId("");
    setSelectedAddProductId("");
    setAddProductQty(1);
    setAddProductMode("cart");
  };

  const [addProductMode, setAddProductMode] = useState<
    "cart" | "quantity" | "pounds"
  >("cart");

  // --- Delete Entry from Invoice Cart ---
  const handleDeleteCartItem = async (cartId: string, productId: string) => {
    if (!selectedInvoiceId) return;
    const invoice = invoicesState.find((inv) => inv.id === selectedInvoiceId);
    if (!invoice) return;
    const updatedCarts = invoice.carts.map((cart) => {
      if (cart.id !== cartId) return cart;
      return {
        ...cart,
        items: cart.items.filter((item) => item.productId !== productId),
      };
    });
    await onUpdateInvoice(selectedInvoiceId, { carts: updatedCarts });
  };

  // Delete a manual product and update state
  const handleDeleteManualProduct = async (manualProductId: string) => {
    await deleteManualConventionalProduct(manualProductId);
    setManualProducts((prev) => prev.filter((p) => p.id !== manualProductId));
  };

  // Archive logic: show all groups except those with status 'Entregado' (Boleta Impresa) whose endTime/startTime is before today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Restore: include Tunnel groups in main overview
  const visiblePickupGroups = pickupGroups.filter((g) => {
    if (g.status === "deleted") return false;
    if (g.status === "Entregado" || g.status === "Boleta Impresa") {
      // Use endTime if available, else startTime
      const groupDate = g.endTime || g.startTime;
      if (!groupDate) return false;
      const groupDay = new Date(groupDate);
      groupDay.setHours(0, 0, 0, 0);
      // If group was completed before today, archive it
      if (groupDay < today) return false;
    }
    return true;
  });

  // --- Sectioned groupings ---
  // const tunnelGroups = visiblePickupGroups.filter((g) => g.status === "Tunnel");
  // const conventionalGroups = visiblePickupGroups.filter(
  //   (g) => g.status === "Conventional"
  // );
  // const pendingProductGroups = visiblePickupGroups.filter(
  //   (g) => g.pendingProduct === true
  // );

  const [selectedCartModalId, setSelectedCartModalId] = useState<string>("");

  // Add at the top-level of the component:
  const [showNoteInput, setShowNoteInput] = useState<{
    [invoiceId: string]: boolean;
  }>({});

  // --- Manual Conventional Products State ---
  const [manualProducts, setManualProducts] = useState<any[]>([]);
  const [manualProductsLoading, setManualProductsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getManualConventionalProductsForDate(new Date()).then((products) => {
      if (mounted) {
        setManualProducts(products);
        setManualProductsLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Helper: get washed manual products for a client that are not yet invoiced
  const getPendingManualProductsForClient = (clientId: string) =>
    manualProducts.filter(
      (mp) => mp.clientId === clientId && mp.washed && !mp.invoiceId
    );

  // When adding a manual product to an invoice, set its invoiceId in Firestore
  const handleAddManualProductToInvoice = async (
    manualProductId: string,
    invoiceId: string
  ) => {
    await updateDoc(doc(db, "manual_conventional_products", manualProductId), {
      invoiceId,
    });
    setManualProducts((prev) =>
      prev.map((p) => (p.id === manualProductId ? { ...p, invoiceId } : p))
    );
  };

  // Helper: for a given invoice, get required manual products (ALL manual, not delivered, for this client)
  const getRequiredManualProductsForInvoice = (invoice: Invoice) =>
    manualProducts.filter(
      (mp) => mp.clientId === invoice.clientId && !mp.delivered
    );

  // Helper: check if all required manual products are present in the invoice carts
  const invoiceHasAllRequiredManualProducts = (invoice: Invoice) => {
    const required = getRequiredManualProductsForInvoice(invoice);
    if (required.length === 0) return true;
    // Flatten all cart items in the invoice
    const allItems = (invoice.carts || []).flatMap((cart) => cart.items || []);
    return required.every((mp) =>
      allItems.some(
        (item) =>
          item.productId === mp.productId &&
          Number(item.quantity) >= Number(mp.quantity)
      )
    );
  };

  // Add at the top-level of the component (before return):
  const [cartProductSelections, setCartProductSelections] = React.useState<{
    [cartId: string]: { productId: string; qty: number; adding: boolean };
  }>({});

  // Add at the top-level of the component:
  const [showPrintInvoiceModal, setShowPrintInvoiceModal] =
    React.useState(false);
  const [printInvoiceData, setPrintInvoiceData] = React.useState<any>(null);
  const [printDate, setPrintDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [printVerifiedBy, setPrintVerifiedBy] = React.useState("");
  const [printQuantities, setPrintQuantities] = React.useState<{
    [productId: string]: number;
  }>({});

  // Helper to open print modal after verification
  function openPrintInvoice(invoice: Invoice) {
    // Build global product summary
    const carts = invoice.carts || [];
    const productMap: {
      [productId: string]: { name: string; total: number; carts: string[] };
    } = {};
    carts.forEach((cart) => {
      cart.items.forEach((item) => {
        if (!productMap[item.productId]) {
          productMap[item.productId] = {
            name: item.productName,
            total: 0,
            carts: [],
          };
        }
        productMap[item.productId].total += Number(item.quantity) || 0;
        if (!productMap[item.productId].carts.includes(cart.name)) {
          productMap[item.productId].carts.push(cart.name);
        }
      });
    });
    setPrintInvoiceData({
      invoiceId: invoice.id,
      clientName: invoice.clientName,
      carts,
      productMap,
      verifiedBy: invoice.verifiedBy || user?.username || "",
      date: new Date().toISOString().slice(0, 10),
    });
    setPrintVerifiedBy(invoice.verifiedBy || user?.username || "");
    setPrintDate(new Date().toISOString().slice(0, 10));
    setPrintQuantities(
      Object.fromEntries(
        Object.entries(productMap).map(([pid, p]) => [pid, p.total])
      )
    );
    setShowPrintInvoiceModal(true);
  }

  // Avatar error state: track which invoice cards have failed avatar loads
  const [avatarErrorMap, setAvatarErrorMap] = useState<{
    [invoiceId: string]: boolean;
  }>({});

  const [showInvoiceDetailsModal, setShowInvoiceDetailsModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Add Ready state to invoice
  const [readyInvoices, setReadyInvoices] = useState<{ [id: string]: boolean }>(
    {}
  );

  // Handler for Ready button
  const handleReadyClick = async (invoiceId: string) => {
    setReadyInvoices((prev) => ({ ...prev, [invoiceId]: true }));
    // Optionally, persist this status in backend:
    const invoice = invoicesState.find((inv) => inv.id === invoiceId);
    if (invoice) {
      await onUpdateInvoice(invoiceId, { status: "ready" });
    }
  };

  // Shipped modal state
  const [showShippedModal, setShowShippedModal] = useState<string | null>(null);
  const [shippedTruckNumber, setShippedTruckNumber] = useState("");
  const [shippedDeliveryDate, setShippedDeliveryDate] = useState("");

  // Delivery scheduling modal state
  const [showDeliveryScheduleModal, setShowDeliveryScheduleModal] = useState<string | null>(null);
  const [scheduleDeliveryDate, setScheduleDeliveryDate] = useState("");
  const [scheduleTruckNumber, setScheduleTruckNumber] = useState("");
  const [scheduleDeliveryMethod, setScheduleDeliveryMethod] = useState<"truck" | "client_pickup">("truck");

  // Client pickup signature modal state
  const [showPickupSignatureModal, setShowPickupSignatureModal] = useState<string | null>(null);
  const [pickupSignatureInvoice, setPickupSignatureInvoice] = useState<Invoice | null>(null);

  // --- DEMO/TEST: Inject a fake overdue invoice if none exist ---
  const hasOverdue = invoices.some((inv) => {
    if (!inv.date) return false;
    const created = new Date(inv.date);
    const now = new Date();
    return now.getTime() - created.getTime() > 24 * 60 * 60 * 1000;
  });
  let demoInvoices = invoices;
  if (!hasOverdue && invoices.length > 0) {
    // Clone the first invoice and set its date to 2 days ago
    const demo = {
      ...invoices[0],
      id: "demo-overdue",
      clientName: "Demo Overdue Client",
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    };
    demoInvoices = [demo, ...invoices];
  }

  const getVerifierName = (verifierId: string) => {
    if (!verifierId) return "-";
    const found = users.find(
      (u: UserRecord) => u.id === verifierId || u.username === verifierId
    );
    if (found) return found.username;
    if (verifierId.length > 4 || /[a-zA-Z]/.test(verifierId)) return verifierId;
    return verifierId;
  };

  // Sort invoices so that overdue (red) invoices are at the top (alphabetically by client name), then unverified (alphabetically), then verified (alphabetically)
  const sortedInvoices = [...invoices].sort((a, b) => {
    const now = new Date();
    const aOverdue =
      a.date &&
      !a.verified &&
      now.getTime() - new Date(a.date).getTime() > 24 * 60 * 60 * 1000;
    const bOverdue =
      b.date &&
      !b.verified &&
      now.getTime() - new Date(b.date).getTime() > 24 * 60 * 60 * 1000;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    // If both are overdue, sort alphabetically by client name
    if (aOverdue && bOverdue) {
      return (a.clientName || "").localeCompare(b.clientName || "");
    }
    // Then by verified status (unverified first)
    if (!a.verified && b.verified) return -1;
    if (a.verified && !b.verified) return 1;
    // If both are unverified or both are verified, sort alphabetically by client name
    return (a.clientName || "").localeCompare(b.clientName || "");
  });

  // Status filter options
  const STATUS_FILTERS = [
    { key: 'all', label: 'All', icon: 'bi-circle' },
    { key: 'in_progress', label: 'In Progress', icon: 'bi-hourglass' },
    { key: 'completed', label: 'Completed', icon: 'bi-check2-circle' },
    { key: 'approved', label: 'Approved', icon: 'bi-check-circle-fill' },
    { key: 'partial', label: 'Partial', icon: 'bi-exclamation-circle' },
    { key: 'shipped', label: 'Shipped', icon: 'bi-truck' },
  ];
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed' | 'approved' | 'partial' | 'shipped'>('all');

  // Calculate counts for each status filter
  const statusCounts = useMemo(() => {
    const counts = {
      all: sortedInvoices.filter(inv => inv.status !== 'done').length,
      in_progress: sortedInvoices.filter(inv => !inv.verified && inv.status !== 'done' && inv.status !== 'completed').length,
      completed: sortedInvoices.filter(inv => inv.status === 'completed' && !inv.verified).length,
      approved: sortedInvoices.filter(inv => inv.verified && inv.status !== 'done').length,
      partial: sortedInvoices.filter(inv => inv.partiallyVerified && !inv.verified && inv.status !== 'done').length,
      shipped: sortedInvoices.filter(inv => inv.status === 'done').length,
    };
    return counts;
  }, [sortedInvoices]);

  // Filter invoices by status
  const filteredInvoices = useMemo(() => {
    if (statusFilter === 'all') return sortedInvoices.filter(inv => inv.status !== 'done');
    if (statusFilter === 'in_progress') return sortedInvoices.filter(inv => !inv.verified && inv.status !== 'done' && inv.status !== 'completed');
    if (statusFilter === 'completed') return sortedInvoices.filter(inv => inv.status === 'completed' && !inv.verified);
    if (statusFilter === 'approved') return sortedInvoices.filter(inv => inv.verified && inv.status !== 'done');
    if (statusFilter === 'partial') return sortedInvoices.filter(inv => inv.partiallyVerified && !inv.verified && inv.status !== 'done');
    if (statusFilter === 'shipped') return sortedInvoices.filter(inv => inv.status === 'done');
    return sortedInvoices.filter(inv => inv.status !== 'done');
  }, [sortedInvoices, statusFilter]);

  // Handler to select an invoice (for card click)
  function handleInvoiceClick(invoiceId: string) {
    const invoice = invoicesState.find((inv) => inv.id === invoiceId);
    console.log("🔍 handleInvoiceClick:", { 
      invoiceId, 
      foundInvoice: !!invoice, 
      carts: invoice?.carts?.map(c => ({ id: c.id, name: c.name })),
      timestamp: new Date().toISOString()
    });
    
    if (invoice) {
      // Ensure we have the latest invoice data
      setSelectedInvoice({ ...invoice }); // Create a new object to trigger re-render
      setShowInvoiceDetailsModal(true);
    }
    
    if (typeof setSelectedInvoiceId === "function") {
      setSelectedInvoiceId(invoiceId);
    }
  }

  // Handler to select a cart (for LaundryCartModal)
  async function handleCartSelect(cart: Cart) {
    setShowCartSelectModal(false);
    // Optionally, set selected cart state here if your UI needs it
  }

  // --- Invoice Merge Functions ---
  
  // Get invoices that can be merged with the given invoice (same client name)
  const getMergeableInvoices = (sourceInvoiceId: string) => {
    const sourceInvoice = invoices.find(inv => inv.id === sourceInvoiceId);
    if (!sourceInvoice) return [];
    
    return invoices.filter(inv => 
      inv.id !== sourceInvoiceId && 
      inv.clientName === sourceInvoice.clientName &&
      inv.status !== "done" // Don't merge with shipped invoices
    );
  };
  
  // Open merge modal for selecting target invoice
  const handleOpenMergeModal = (sourceInvoiceId: string) => {
    const mergeableInvoices = getMergeableInvoices(sourceInvoiceId);
    if (mergeableInvoices.length === 0) {
      alert("No invoices with the same client name found to merge with.");
      return;
    }
    
    setMergeSourceInvoiceId(sourceInvoiceId);
    setMergeTargetInvoiceId("");
    setMergeError("");
    setShowMergeModal(true);
  };
  
  // Handle the actual merge operation
  const handleMergeInvoices = async () => {
    if (!mergeSourceInvoiceId || !mergeTargetInvoiceId) {
      setMergeError("Please select both source and target invoices.");
      return;
    }
    
    setMergeLoading(true);
    setMergeError("");
    
    try {
      const sourceInvoice = invoices.find(inv => inv.id === mergeSourceInvoiceId);
      const targetInvoice = invoices.find(inv => inv.id === mergeTargetInvoiceId);
      
      if (!sourceInvoice || !targetInvoice) {
        throw new Error("Source or target invoice not found");
      }
      
      // Handle cart name conflicts by renaming duplicates
      const targetCartNames = new Set(targetInvoice.carts.map(c => c.name.toLowerCase()));
      
      const resolvedSourceCarts = sourceInvoice.carts.map(cart => {
        let newName = cart.name;
        let counter = 1;
        
        while (targetCartNames.has(newName.toLowerCase())) {
          newName = `${cart.name} (${counter})`;
          counter++;
        }
        
        return { ...cart, name: newName };
      });
      
      // Combine carts from both invoices
      const mergedCarts = [...targetInvoice.carts, ...resolvedSourceCarts];
      
      // Combine weights if both invoices have totalWeight
      const combinedWeight = (sourceInvoice.totalWeight || 0) + (targetInvoice.totalWeight || 0);
      
      // Prepare update data
      const updateData: Partial<Invoice> = {
        carts: mergedCarts
      };
      
      // Only include totalWeight if there's actually weight to combine
      if (combinedWeight > 0) {
        updateData.totalWeight = combinedWeight;
      }
      
      // Update target invoice with merged carts and combined weight
      await onUpdateInvoice(targetInvoice.id, updateData);
      
      // Delete source invoice
      await onDeleteInvoice(sourceInvoice.id);
      
      // Log merge activity
      if (user?.username) {
        const weightInfo = combinedWeight > 0 
          ? ` (Weight: ${sourceInvoice.totalWeight || 0} + ${targetInvoice.totalWeight || 0} = ${combinedWeight} lbs)`
          : '';
          
        await logActivity({
          type: "invoice_merge",
          message: `User ${user.username} merged invoice #${sourceInvoice.invoiceNumber || sourceInvoice.id} into invoice #${targetInvoice.invoiceNumber || targetInvoice.id}${weightInfo}`,
          user: user.username
        });
      }
      
      // Close modal and reset state
      setShowMergeModal(false);
      setMergeSourceInvoiceId(null);
      setMergeTargetInvoiceId("");
    } catch (error: any) {
      console.error("Error merging invoices:", error);
      setMergeError(error.message || "Failed to merge invoices. Please try again.");
    } finally {
      setMergeLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4">
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

      <div className="row">
        <div className="col-md-6">
          <h3 className="mb-4">Active Laundry Tickets</h3>
        </div>
        <div className="col-md-6 text-md-end">
          <button className="btn btn-primary me-2" onClick={handleAddInvoice}>
            Create New Laundry Ticket
          </button>
          {/* Only show Unship button for Supervisor, Admin, Owner */}
          {user && ["Supervisor", "Admin", "Owner"].includes(user.role) && (
            <button
              className="btn btn-warning"
              onClick={handleUnshipRecentInvoices}
            >
              Unship Recent Laundry Tickets
            </button>
          )}
        </div>
      </div>

      {/* Status Filters and View Toggle */}
      <div className="row mb-3">
        <div className="col-12">
          <div className="d-flex justify-content-between align-items-center flex-wrap">
            {/* Status Filter Cards */}
            <div className="d-flex gap-2 mb-2 mb-md-0">
              {STATUS_FILTERS.map((filter) => {
                const count = statusCounts[filter.key as keyof typeof statusCounts] || 0;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    className={`btn btn-sm ${
                      statusFilter === filter.key 
                        ? 'btn-primary' 
                        : 'btn-outline-secondary'
                    }`}
                    onClick={() => setStatusFilter(filter.key as any)}
                    title={`${filter.label} (${count})`}
                  >
                    <i className={`${filter.icon} me-1`}></i>
                    {filter.label} ({count})
                  </button>
                );
              })}
            </div>
            
            {/* View Toggle */}
            <div className="btn-group" role="group" aria-label="View options">
              <button
                type="button"
                className={`btn ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setViewMode('cards')}
              >
                <i className="bi bi-grid-3x3-gap me-1"></i>
                Cards
              </button>
              <button
                type="button"
                className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => setViewMode('list')}
              >
                <i className="bi bi-list-ul me-1"></i>
                List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area - Cards or List View */}
      {invoicesState.filter((inv) => inv.status !== "done").length === 0 ? (
        <div className="text-center text-muted py-5">
          No active laundry tickets found. Create a new laundry ticket to get started.
        </div>
      ) : viewMode === 'cards' ? (
        // Cards View (existing)
        <div className="row">
          {filteredInvoices.map((invoice, idx) => {
              const client = clients.find((c) => c.id === invoice.clientId);
              const avatarSrc = getClientAvatarUrl(client || {});
              const isReady =
                invoice.status === "ready" || readyInvoices[invoice.id];
              const isVerified = invoice.verified;
              const isPartiallyVerified =
                invoice.partiallyVerified ||
                partialVerifiedInvoices[invoice.id];
              // Determine highlight color for this invoice
              const highlight = invoice.highlight || "blue";
              // Compute background based on approval status with enhanced visual feedback
              let cardBackground = "";
              let cardBorderColor = "";

              if (isVerified) {
                // Check if this is a client pickup order - make it pink instead of green
                if (invoice.deliveryMethod === "client_pickup") {
                  // Fully approved client pickup - Pink card
                  cardBackground =
                    "linear-gradient(135deg, #fce7f3 0%, #ec4899 100%)";
                  cardBorderColor = "#ec4899";
                } else {
                  // Fully approved - Green card
                  cardBackground =
                    "linear-gradient(135deg, #dcfce7 0%, #16a34a 100%)";
                  cardBorderColor = "#16a34a";
                }
              } else if (isPartiallyVerified) {
                // Partially approved - Yellow card
                cardBackground =
                  "linear-gradient(135deg, #fefce8 0%, #eab308 100%)";
                cardBorderColor = "#eab308";
              } else if (invoice.status === "completed") {
                // Completed but not approved - Yellow card
                cardBackground =
                  "linear-gradient(135deg, #fefce8 0%, #eab308 100%)";
                cardBorderColor = "#eab308";
              } else if (invoice.manglesCompleted || invoice.dobladoCompleted) {
                // Partial completion - Split background
                if (invoice.manglesCompleted && invoice.dobladoCompleted) {
                  // Both parts completed - should be status "completed", but fallback
                  cardBackground =
                    "linear-gradient(135deg, #fefce8 0%, #eab308 100%)";
                  cardBorderColor = "#eab308";
                } else if (invoice.manglesCompleted) {
                  // Only top part completed - Yellow top, blue bottom
                  cardBackground =
                    "linear-gradient(to bottom, #fef3c7 0%, #fef3c7 50%, #dbeafe 50%, #dbeafe 100%)";
                  cardBorderColor = "#3b82f6";
                } else if (invoice.dobladoCompleted) {
                  // Only bottom part completed - Blue top, yellow bottom
                  cardBackground =
                    "linear-gradient(to bottom, #dbeafe 0%, #dbeafe 50%, #fef3c7 50%, #fef3c7 100%)";
                  cardBorderColor = "#3b82f6";
                }
              } else if (isReady) {
                // Ready status - Light yellow
                cardBackground =
                  "linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)";
                cardBorderColor = "#fbbf24";
              } else if (highlight === "yellow") {
                // Yellow highlight
                cardBackground =
                  "linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)";
                cardBorderColor = "#fbbf24";
              } else {
                // Default - Blue card (not approved)
                cardBackground =
                  "linear-gradient(135deg, #dbeafe 0%, #3b82f6 100%)";
                cardBorderColor = "#3b82f6";
              }

              // --- Overdue logic: more than 1 day old ---
              let isOverdue = false;
              if (invoice.date) {
                const created = new Date(invoice.date);
                const now = new Date();
                const diffMs = now.getTime() - created.getTime();
                if (diffMs > 24 * 60 * 60 * 1000) {
                  isOverdue = true;
                }
              }

              // Only apply overdue-blink if overdue AND not verified
              const showOverdueBlink = isOverdue && !isVerified;

              // Get animation class if animation is active
              const animationClass = animatingInvoices[invoice.id]
                ? animatingInvoices[invoice.id] === "approved"
                  ? "invoice-card-approved"
                  : "invoice-card-partial"
                : "";

              return (
                <React.Fragment key={invoice.id}>
                  <div
                    key={invoice.id}
                    className={`col-lg-4 col-md-6 mb-4${
                      showOverdueBlink ? " overdue-blink" : ""
                    }`}
                    onMouseEnter={() => setHoveredInvoiceId(invoice.id)}
                    onMouseLeave={() => setHoveredInvoiceId(null)}
                  >
                    <div
                      className={`modern-invoice-card shadow-lg${
                        showOverdueBlink ? " overdue-blink" : ""
                      }${animationClass ? ` ${animationClass}` : ""}`}
                      style={{
                        borderRadius: 24,
                        background: cardBackground,
                        color: "#222",
                        boxShadow: `0 8px 32px 0 rgba(0,0,0,0.10), 0 0 0 2px ${cardBorderColor}20`,
                        border: `2px solid ${cardBorderColor}40`,
                        position: "relative",
                        minHeight: 380,
                        maxWidth: 340,
                        margin: "60px auto 0 auto",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        fontFamily: "Inter, Segoe UI, Arial, sans-serif",
                        padding: "2.5rem 1.5rem 1.5rem 1.5rem",
                        transition: "all 0.3s ease-in-out",
                        transform: isVerified ? "scale(1.02)" : "scale(1)",
                      }}
                      onClick={() => handleInvoiceClick(invoice.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handleInvoiceClick(invoice.id);
                        }
                      }}
                    >
                      {/* Delete button in top left corner */}
                      {user &&
                        ["Supervisor", "Admin", "Owner"].includes(
                          user.role
                        ) && (
                          <button
                            className="btn"
                            style={{
                              position: "absolute",
                              top: 16,
                              left: 16,
                              background: "#fff",
                              borderRadius: "50%",
                              width: 44,
                              height: 44,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                              border: "none",
                              color: "#ef4444",
                              fontSize: 22,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(invoice);
                            }}
                            title="Delete"
                            disabled={!!invoice.locked}
                          >
                            <i className="bi bi-trash" />
                          </button>
                        )}
                      
                      {/* Merge button in top left corner (next to delete) */}
                      {user &&
                        ["Supervisor", "Admin", "Owner"].includes(
                          user.role
                        ) && 
                        true && (  /* Temporarily always show for debugging */
                          <button
                            className="btn"
                            style={{
                              position: "absolute",
                              top: 16,
                              left: 70,
                              background: "#fff",
                              borderRadius: "50%",
                              width: 44,
                              height: 44,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                              border: "none",
                              color: "#0ea5e9",
                              fontSize: 22,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log("Merge button clicked for invoice:", invoice.id);
                              console.log("Mergeable invoices:", getMergeableInvoices(invoice.id));
                              handleOpenMergeModal(invoice.id);
                            }}
                            title="Merge with another invoice from same client"
                            disabled={!!invoice.locked}
                          >
                            <i className="bi bi-shuffle" />
                          </button>
                        )}
                      
                      {/* Invoice Number in top right corner */}
                      <div
                        style={{
                          position: "absolute",
                          top: 16,
                          right: 16,
                          background: "linear-gradient(135deg, #3b82f6, #1e40af)",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
                          border: "1px solid rgba(59, 130, 246, 0.2)",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#ffffff",
                          letterSpacing: "0.5px",
                          zIndex: 3,
                        }}
                      >
                        #{invoice.invoiceNumber || invoice.id.substring(0, 8)}
                      </div>
                      
                      {/* Avatar */}
                      <div
                        style={{
                          width: 110,
                          height: 110,
                          position: "absolute",
                          left: "50%",
                          top: -55,
                          transform: "translateX(-50%)",
                          zIndex: 2,
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          pointerEvents: "none",
                        }}
                      >
                        <img
                          src={avatarSrc}
                          alt="avatar"
                          style={{
                            width: 100,
                            height: 100,
                            borderRadius: "50%",
                            border: "4px solid #fff",
                            objectFit: "cover",
                            boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
                            background: "#e0f2fe",
                          }}
                          onError={() =>
                            setAvatarErrorMap((prev) => ({
                              ...prev,
                              [invoice.id]: true,
                            }))
                          }
                        />
                      </div>
                      {/* Name and subtitle */}
                      <div
                        style={{
                          textAlign: "center",
                          marginTop: 16,
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 28, // Increased from 24 for better readability
                            color: (invoice.carts || []).some((c) =>
                              c.name
                                .toUpperCase()
                                .startsWith("CARRO SIN NOMBRE")
                            )
                              ? "red"
                              : "#222",
                            marginBottom: 4,
                          }}
                        >
                          {client?.name || invoice.clientName}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#777",
                            marginBottom: 0,
                          }}
                        >
                          Active Invoice
                        </div>
                        {/* Approval Status Badge */}
                        {(isVerified ||
                          isPartiallyVerified ||
                          invoice.status === "completed") && (
                          <div
                            style={{
                              display: "inline-block",
                              padding: "4px 12px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: "700",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              marginTop: "8px",
                              background: isVerified
                                ? "#16a34a"
                                : isPartiallyVerified
                                ? "#eab308"
                                : "#eab308", // Yellow for completed but not approved
                              color: "white",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            }}
                          >
                            {isVerified
                              ? "✓ APPROVED"
                              : isPartiallyVerified
                              ? "⚠ PARTIAL"
                              : "📋 COMPLETED"}
                          </div>
                        )}
                        
                        {/* Delivery Schedule Badge */}
                        {invoice.deliveryDate && (
                          <div
                            style={{
                              display: "inline-block",
                              padding: "4px 12px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: "700",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              marginTop: "8px",
                              marginLeft: "8px",
                              background: "#3b82f6",
                              color: "white",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            }}
                          >
                            {invoice.deliveryMethod === "client_pickup" ? (
                              <>
                                👤 {new Date(invoice.deliveryDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric"
                                })} - Client Pickup
                              </>
                            ) : (
                              <>
                                🚛 {new Date(invoice.deliveryDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric"
                                })} - Truck #{invoice.truckNumber || "TBD"}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Product summary (total qty per product) */}
                      <div style={{ margin: "12px 0 0 0", width: "100%" }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: 20, // Increased from 15 for product summary title
                            color: "white",
                            marginBottom: 2,
                          }}
                        >
                          Productos Total global
                        </div>
                        <ul
                          style={{
                            listStyle: "none",
                            paddingLeft: 20,
                            padding: 0,
                            margin: 0,
                            fontSize: 28, // Increased from 15 for product list
                            marginBottom: 20,
                          }}
                        >
                          {(() => {
                            // Aggregate product totals across all carts
                            const productTotals: {
                              [productId: string]: {
                                name: string;
                                qty: number;
                              };
                            } = {};
                            (invoice.carts || []).forEach((cart) => {
                              cart.items.forEach((item) => {
                                if (!productTotals[item.productId]) {
                                  productTotals[item.productId] = {
                                    name: item.productName,
                                    qty: 0,
                                  };
                                }
                                productTotals[item.productId].qty +=
                                  Number(item.quantity) || 0;
                              });
                            });
                            const sorted = Object.values(productTotals).sort(
                              (a, b) => a.name.localeCompare(b.name)
                            );
                            if (sorted.length === 0) {
                              return (
                                <li className="text-muted">No products yet.</li>
                              );
                            }
                            return sorted.map((prod, idx) => (
                              <li key={prod.name + idx}>
                                <span style={{ fontSize: 18 }}>
                                  {prod.name}
                                </span>{" "}
                                <b style={{ fontSize: 18 }}>{prod.qty}</b>
                              </li>
                            ));
                          })()}
                        </ul>
                      </div>
                      {/* Social-style action buttons */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: 24,
                          right: 24,
                          display: "flex",
                          flexDirection: "row",
                          gap: 10,
                          zIndex: 10,
                        }}
                      >
                        {/* Schedule Delivery button - Step 0 - Only show when invoice is approved */}
                        {(invoice.verified || invoice.partiallyVerified) && (
                          <button
                            className="btn btn-sm btn-outline-primary"
                            style={{
                              fontSize: 16,
                              width: 44,
                              height: 44,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                              border: "2px solid #3b82f6",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleScheduleDelivery(invoice);
                            }}
                            title={`Schedule delivery date and truck assignment${invoice.deliveryDate ? `\nCurrent: ${new Date(invoice.deliveryDate).toLocaleDateString()} via Truck #${invoice.truckNumber}` : ''}`}
                          >
                            <i
                              className="bi bi-calendar-check"
                              style={{
                                color: invoice.deliveryDate ? "#22c55e" : "#3b82f6",
                                fontSize: 22,
                              }}
                            />
                          </button>
                        )}
                        {/* Complete button - Step 1 */}
                        <button
                          className={`btn btn-sm ${
                            invoice.status === "completed" ||
                            invoice.verified ||
                            invoice.status === "done"
                              ? "btn-success"
                              : "btn-warning"
                          }`}
                          style={{
                            fontSize: 16,
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            border: "none",
                          }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (hasUnnamedCart(invoice)) {
                              alert(
                                'Cannot modify laundry ticket: A cart is named "CARRO SIN NOMBRE". Please rename all carts.'
                              );
                              return;
                            }

                            // Toggle completed status
                            const isCurrentlyCompleted =
                              invoice.status === "completed" ||
                              invoice.verified ||
                              invoice.status === "done";

                            if (isCurrentlyCompleted) {
                              // If shipping is done, cannot revert
                              if (invoice.status === "done") {
                                alert("Cannot uncomplete a shipped laundry ticket.");
                                return;
                              }
                              // If approved, ask for confirmation to revert
                              if (invoice.verified) {
                                if (
                                  !window.confirm(
                                    "This will also remove the approval. Continue?"
                                  )
                                ) {
                                  return;
                                }
                                // Remove approval and completion
                                await onUpdateInvoice(invoice.id, {
                                  status: "active",
                                  verified: false,
                                  verifiedBy: "",
                                  verifiedAt: "",
                                });
                              } else {
                                // Just remove completion parts
                                await onUpdateInvoice(invoice.id, {
                                  status: "active",
                                  manglesCompleted: false,
                                  dobladoCompleted: false,
                                });
                              }
                              if (user?.username) {
                                await logActivity({
                                  type: "Invoice",
                                  message: `User ${user.username} marked laundry ticket #${invoice.invoiceNumber || invoice.id} as active (uncompleted)`,
                                  user: user.username,
                                });
                              }
                            } else {
                              // Open completion selection modal
                              handleOpenCompletionModal(invoice.id);
                            }
                          }}
                          disabled={hasUnnamedCart(invoice)}
                          title={
                            hasUnnamedCart(invoice)
                              ? 'Cannot modify with "CARRO SIN NOMBRE" cart'
                              : invoice.status === "done"
                              ? "Shipped (cannot uncomplete)"
                              : invoice.status === "completed" ||
                                invoice.verified
                              ? "Click to mark as active"
                              : "Select completion parts"
                          }
                        >
                          <i
                            className="bi bi-clipboard-check"
                            style={{
                              color:
                                invoice.status === "completed" ||
                                invoice.verified ||
                                invoice.status === "done"
                                  ? "#fff"
                                  : "#f59e0b",
                              fontSize: 22,
                            }}
                          />
                        </button>
                        {/* Approved button - Step 2 */}
                        <button
                          className={`btn btn-sm ${
                            invoice.verified
                              ? "btn-success"
                              : "btn-outline-success"
                          }`}
                          style={{
                            fontSize: 16,
                            width: 44,
                            height: 44,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            border: invoice.verified
                              ? "none"
                              : "2px solid #22c55e",
                          }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (hasUnnamedCart(invoice)) {
                              alert(
                                'Cannot modify laundry ticket: A cart is named "CARRO SIN NOMBRE". Please rename all carts.'
                              );
                              return;
                            }
                            if (invoice.status !== "completed") {
                              alert(
                                "Laundry Ticket must be completed before it can be approved."
                              );
                              return;
                            }
                            
                            // Check if both parts are completed
                            if (!invoice.manglesCompleted || !invoice.dobladoCompleted) {
                              alert(
                                "Both Mangles (top) and Doblado (bottom) parts must be completed before approval."
                              );
                              return;
                            }

                            // Toggle approval status
                            if (invoice.verified) {
                              // If shipped, cannot revert approval
                              if ((invoice as any).status === "done") {
                                alert("Cannot unapprove a shipped laundry ticket.");
                                return;
                              }
                              // Remove approval
                              await onUpdateInvoice(invoice.id, {
                                verified: false,
                                verifiedBy: "",
                                verifiedAt: "",
                              });
                              if (user?.username) {
                                await                                logActivity({
                                  type: "Invoice",
                                  message: `User ${user.username} removed approval from laundry ticket #${invoice.invoiceNumber || invoice.id}`,
                                  user: user.username,
                                });
                              }
                            } else {
                              // Open verification modal to approve the invoice
                              handleVerifyInvoice(invoice.id);
                            }
                          }}
                          disabled={
                            invoice.status !== "completed" ||
                            !invoice.manglesCompleted ||
                            !invoice.dobladoCompleted ||
                            hasUnnamedCart(invoice)
                          }
                          title={
                            invoice.status !== "completed"
                              ? "Must be completed first"
                              : !invoice.manglesCompleted || !invoice.dobladoCompleted
                              ? "Both Mangles (top) and Doblado (bottom) must be completed first"
                              : hasUnnamedCart(invoice)
                              ? 'Cannot modify with "CARRO SIN NOMBRE" cart'
                              : (invoice as any).status === "done" &&
                                invoice.verified
                              ? "Approved (cannot unapprove shipped laundry ticket)"
                              : invoice.verified
                              ? "Click to remove approval"
                              : "Approve"
                          }
                        >
                          <i
                            className="bi bi-check-circle"
                            style={{
                              color: invoice.verified ? "#fff" : "#22c55e",
                              fontSize: 22,
                            }}
                          />
                        </button>
                        {/* Shipping/Pickup button - Step 3 - Conditional based on delivery method */}
                        {invoice.deliveryMethod === "client_pickup" ? (
                          /* Mark as Picked Up button for client pickup orders */
                          <button
                            className={`btn btn-sm ${
                              invoice.status === "done"
                                ? "btn-success"
                                : "btn-outline-success"
                            }`}
                            style={{
                              fontSize: 16,
                              width: 44,
                              height: 44,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                              border:
                                invoice.status === "done"
                                  ? "none"
                                  : "2px solid #22c55e",
                            }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (hasUnnamedCart(invoice)) {
                                alert(
                                  'Cannot modify laundry ticket: A cart is named "CARRO SIN NOMBRE". Please rename all carts.'
                                );
                                return;
                              }
                              if (!invoice.verified) {
                                alert(
                                  "Laundry Ticket must be approved before it can be marked as picked up."
                                );
                                return;
                              }

                              if (invoice.status === "done") {
                                // Allow unmarking as picked up (revert to approved status)
                                const confirmUnpickup = window.confirm(
                                  "Are you sure you want to mark this as not picked up? This will revert it to approved status."
                                );
                                if (confirmUnpickup) {
                                  await onUpdateInvoice(invoice.id, {
                                    status: "completed",
                                  });
                                  if (user?.username) {
                                    await logActivity({
                                      type: "Invoice",
                                      message: `User ${user.username} marked laundry ticket #${invoice.invoiceNumber || invoice.id} as not picked up`,
                                      user: user.username,
                                    });
                                  }
                                }
                              } else {
                                // Mark as picked up - show signature modal
                                handleMarkAsPickedUp(invoice);
                              }
                            }}
                            disabled={
                              !invoice.verified || hasUnnamedCart(invoice)
                            }
                            title={
                              !invoice.verified
                                ? "Must be approved first"
                                : hasUnnamedCart(invoice)
                                ? 'Cannot modify with "CARRO SIN NOMBRE" cart'
                                : invoice.status === "done"
                                ? "Click to mark as not picked up"
                                : "Mark as Picked Up"
                            }
                          >
                            <i
                              className="bi bi-person-check"
                              style={{
                                color:
                                  invoice.status === "done" ? "#fff" : "#22c55e",
                                fontSize: 22,
                              }}
                            />
                          </button>
                        ) : (
                          /* Shipped button for truck delivery orders */
                          <button
                            className={`btn btn-sm ${
                              invoice.status === "done"
                                ? "btn-info"
                                : "btn-outline-info"
                            }`}
                            style={{
                              fontSize: 16,
                              width: 44,
                              height: 44,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: 0,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                              border:
                                invoice.status === "done"
                                  ? "none"
                                  : "2px solid #0ea5e9",
                            }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (hasUnnamedCart(invoice)) {
                                alert(
                                  'Cannot modify laundry ticket: A cart is named "CARRO SIN NOMBRE". Please rename all carts.'
                                );
                                return;
                              }
                              if (!invoice.verified) {
                                alert(
                                  "Laundry Ticket must be approved before it can be shipped."
                                );
                                return;
                              }

                              // Toggle shipping status
                              if (invoice.status === "done") {
                                // Unship the invoice
                                const confirmUnship = window.confirm(
                                  "Are you sure you want to unship this invoice? This will revert it to approved status."
                                );
                                if (confirmUnship) {
                                  await onUpdateInvoice(invoice.id, {
                                    status: "completed",
                                    truckNumber: "",
                                    deliveryDate: "",
                                  });
                                  if (user?.username) {
                                    await logActivity({
                                      type: "Invoice",
                                      message: `User ${user.username} unshipped laundry ticket #${invoice.invoiceNumber || invoice.id}`,
                                      user: user.username,
                                    });
                                  }
                                }
                              } else {
                                // Check if all carts are properly printed before shipping
                                const areAllCartsPrinted = (invoice.carts || []).every(cart => {
                                  // Cart must be printed at least once
                                  if (!cart.lastPrintedAt) return false;
                                  
                                  // If cart was modified after printing, it needs reprint
                                  if (cart.needsReprint) return false;
                                  
                                  // If cart was modified after last print, it needs reprint
                                  if (cart.lastModifiedAt && cart.lastPrintedAt && 
                                      new Date(cart.lastModifiedAt) > new Date(cart.lastPrintedAt)) {
                                    return false;
                                  }
                                  
                                  return true;
                                });
                                
                                if (!areAllCartsPrinted) {
                                  const unprintedCarts = (invoice.carts || []).filter(cart => {
                                    if (!cart.lastPrintedAt) return true;
                                    if (cart.needsReprint) return true;
                                    if (cart.lastModifiedAt && cart.lastPrintedAt && 
                                        new Date(cart.lastModifiedAt) > new Date(cart.lastPrintedAt)) {
                                      return true;
                                    }
                                    return false;
                                  });
                                  
                                  alert(
                                    `Cannot ship laundry ticket: ${unprintedCarts.length} cart(s) need to be printed first.\n\n` +
                                    `Carts requiring print: ${unprintedCarts.map(c => c.name).join(', ')}\n\n` +
                                    `Please print all carts before shipping.`
                                  );
                                  return;
                                }
                                
                                // Ship the invoice - show modal for truck number and delivery date
                                setShowShippedModal(invoice.id);
                                // Pre-fill with existing values if they exist
                                setShippedTruckNumber(invoice.truckNumber?.toString() || "");
                                const existingDeliveryDate = invoice.deliveryDate 
                                  ? new Date(invoice.deliveryDate).toISOString().slice(0, 10)
                                  : "";
                                setShippedDeliveryDate(existingDeliveryDate);
                              }
                            }}
                            disabled={
                              !invoice.verified || hasUnnamedCart(invoice)
                            }
                            title={(() => {
                              if (!invoice.verified) return "Must be approved first";
                              if (hasUnnamedCart(invoice)) return 'Cannot modify with "CARRO SIN NOMBRE" cart';
                              if (invoice.status === "done") return "Click to unship";
                              
                              // Check cart print status
                              const areAllCartsPrinted = (invoice.carts || []).every(cart => {
                                if (!cart.lastPrintedAt) return false;
                                if (cart.needsReprint) return false;
                                if (cart.lastModifiedAt && cart.lastPrintedAt && 
                                    new Date(cart.lastModifiedAt) > new Date(cart.lastPrintedAt)) {
                                  return false;
                                }
                                return true;
                              });
                              
                              if (!areAllCartsPrinted) {
                                const unprintedCarts = (invoice.carts || []).filter(cart => {
                                  if (!cart.lastPrintedAt) return true;
                                  if (cart.needsReprint) return true;
                                  if (cart.lastModifiedAt && cart.lastPrintedAt && 
                                      new Date(cart.lastModifiedAt) > new Date(cart.lastPrintedAt)) {
                                    return true;
                                  }
                                  return false;
                                });
                                return `${unprintedCarts.length} cart(s) need printing: ${unprintedCarts.map(c => c.name).join(', ')}`;
                              }
                              
                              return "Mark as Shipped";
                            })()}
                          >
                            <i
                              className="bi bi-truck"
                              style={{
                                color:
                                  invoice.status === "done" ? "#fff" : "#0ea5e9",
                                fontSize: 22,
                              }}
                            />
                          </button>
                        )}
                      </div>
                      {/* Show approval status and details on invoice card */}
                      {(invoice.verified || invoice.partiallyVerified) && (
                        <div style={{ marginTop: 8 }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: invoice.verified ? "#22c55e" : "#fbbf24",
                            }}
                          >
                            {invoice.verified
                              ? "Fully Approved"
                              : "Partially Approved"}
                          </span>
                          {invoice.verifiedBy && (
                            <span
                              style={{
                                marginLeft: 12,
                                color: "#888",
                                fontWeight: 500,
                              }}
                            >
                              Approved by: {getVerifierName(invoice.verifiedBy)}
                            </span>
                          )}
                          {invoice.verifiedAt && (
                            <span
                              style={{
                                marginLeft: 12,
                                color: "#888",
                                fontWeight: 500,
                              }}
                            >
                              Date: {formatDateSpanish(invoice.verifiedAt)}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Special Service Delivery Indicator */}
                      {invoice.specialServiceRequested && (
                        <div
                          style={{
                            position: "absolute",
                            top: 16,
                            right: 16,
                            background:
                              "linear-gradient(135deg, #ff6b6b, #ee5a52)",
                            color: "white",
                            padding: "6px 12px",
                            borderRadius: "20px",
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            boxShadow: "0 2px 8px rgba(255, 107, 107, 0.3)",
                            zIndex: 5,
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                          title={`Special Service Delivery - Cost: $${(
                            invoice.specialServiceCost || 0
                          ).toFixed(2)}`}
                        >
                          <i
                            className="bi bi-star-fill"
                            style={{ fontSize: 10 }}
                          />
                          Special Service
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              ); // <-- close map function
            })}
        </div>
      ) : (
        // List View
        <div className="table-responsive">
          <table className="table table-hover">
            <thead className="table-dark">
              <tr>
                <th>Client</th>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Carts</th>
                <th>Total Items</th>
                <th>Status</th>
                <th>Delivery</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedInvoices
                .filter((inv) => inv.status !== "done")
                .map((invoice) => {
                  const client = clients.find((c) => c.id === invoice.clientId);
                  const isVerified = invoice.verified;
                  const isPartiallyVerified = invoice.partiallyVerified || partialVerifiedInvoices[invoice.id];
                  const isReady = invoice.status === "ready" || readyInvoices[invoice.id];
                  
                  // Calculate total items across all carts
                  const totalItems = (invoice.carts || []).reduce((total, cart) => 
                    total + cart.items.reduce((cartTotal, item) => cartTotal + item.quantity, 0), 0
                  );

                  // Get row background color based on status
                  let rowClass = "";
                  if (isVerified) {
                    rowClass = invoice.deliveryMethod === "client_pickup" ? "table-warning" : "table-success";
                  } else if (isPartiallyVerified || invoice.status === "completed") {
                    rowClass = "table-warning";
                  } else if (isReady) {
                    rowClass = "table-info";
                  }

                  return (
                    <tr 
                      key={invoice.id} 
                      className={`${rowClass} ${invoice.locked ? 'text-muted' : ''}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleInvoiceClick(invoice.id)}
                    >
                      <td>
                        <div className="d-flex align-items-center">
                          <img
                            src={getClientAvatarUrl(client || {})}
                            alt={client?.name || invoice.clientName}
                            className="rounded-circle me-2"
                            style={{ width: 32, height: 32, objectFit: 'cover' }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                          <div>
                            <div className="fw-bold">{client?.name || invoice.clientName}</div>
                            {(invoice.carts || []).some((c) =>
                              c.name.toUpperCase().startsWith("CARRO SIN NOMBRE")
                            ) && (
                              <small className="text-danger">⚠ Unnamed cart</small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-primary">
                          #{invoice.invoiceNumber || invoice.id.substring(0, 8)}
                        </span>
                      </td>
                      <td>
                        {invoice.date ? formatDateSpanish(invoice.date) : "-"}
                      </td>
                      <td>
                        <span className="badge bg-secondary">
                          {invoice.carts?.length || 0} cart{(invoice.carts?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-info">
                          {totalItems} item{totalItems !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex flex-column gap-1">
                          {/* Status badge */}
                          <span className={`badge ${
                            invoice.status === "done" ? "bg-success" :
                            isVerified ? "bg-success" :
                            isPartiallyVerified ? "bg-warning" :
                            invoice.status === "completed" ? "bg-warning" :
                            isReady ? "bg-info" : "bg-secondary"
                          }`}>
                            {invoice.status === "done" ? "SHIPPED" :
                             isVerified ? "APPROVED" :
                             isPartiallyVerified ? "PARTIAL" :
                             invoice.status === "completed" ? "COMPLETED" :
                             isReady ? "READY" : "IN PROGRESS"}
                          </span>
                          
                          {/* Verification info */}
                          {(isVerified || isPartiallyVerified) && invoice.verifiedBy && (
                            <small className="text-muted">
                              by {invoice.verifiedBy}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        {invoice.deliveryDate ? (
                          <div>
                            <div className="small">
                              {new Date(invoice.deliveryDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric"
                              })}
                            </div>
                            <div className="small text-muted">
                              {invoice.deliveryMethod === "client_pickup" ? 
                                "👤 Pickup" : 
                                `🚛 Truck #${invoice.truckNumber || "TBD"}`
                              }
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted">Not scheduled</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {/* Complete/Approve button */}
                          <button
                            className={`btn btn-sm ${
                              invoice.status === "completed" || isVerified ? "btn-success" : "btn-warning"
                            }`}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (invoice.status !== "completed") {
                                // Mark as completed
                                if (hasUnnamedCart(invoice)) {
                                  alert(
                                    'Cannot modify laundry ticket: A cart is named "CARRO SIN NOMBRE". Please rename all carts.'
                                  );
                                  return;
                                }

                                // Toggle completed status
                                const isCurrentlyCompleted =
                                  invoice.status === "completed" ||
                                  invoice.verified ||
                                  invoice.status === "done";

                                if (isCurrentlyCompleted) {
                                  // If shipping is done, cannot revert
                                  if (invoice.status === "done") {
                                    alert("Cannot uncomplete a shipped laundry ticket.");
                                    return;
                                  }
                                  // If approved, ask for confirmation to revert
                                  if (invoice.verified) {
                                    if (
                                      !window.confirm(
                                        "This will also remove the approval. Continue?"
                                      )
                                    ) {
                                      return;
                                    }
                                    // Remove approval and completion
                                    await onUpdateInvoice(invoice.id, {
                                      status: "active",
                                      verified: false,
                                      verifiedBy: "",
                                      verifiedAt: "",
                                    });
                                  } else {
                                    // Just remove completion parts
                                    await onUpdateInvoice(invoice.id, {
                                      status: "active",
                                      manglesCompleted: false,
                                      dobladoCompleted: false,
                                    });
                                  }
                                } else {
                                  // Open completion selection modal
                                  handleOpenCompletionModal(invoice.id);
                                }

                                if (user?.username) {
                                  await logActivity({
                                    type: "Invoice",
                                    message: `User ${user.username} ${
                                      isCurrentlyCompleted ? "uncompleted" : "completed"
                                    } laundry ticket #${invoice.invoiceNumber || invoice.id}`,
                                    user: user.username,
                                  });
                                }
                              } else if (isVerified) {
                                // Remove approval
                                if (hasUnnamedCart(invoice)) {
                                  alert(
                                    'Cannot modify laundry ticket: A cart is named "CARRO SIN NOMBRE". Please rename all carts.'
                                  );
                                  return;
                                }
                                if (invoice.status !== "completed") {
                                  alert(
                                    "Laundry Ticket must be completed before it can be approved."
                                  );
                                  return;
                                }
                                
                                // Check if both parts are completed
                                if (!invoice.manglesCompleted || !invoice.dobladoCompleted) {
                                  alert(
                                    "Both Mangles (top) and Doblado (bottom) parts must be completed before approval."
                                  );
                                  return;
                                }

                                // Toggle approval status
                                if (invoice.verified) {
                                  // If shipped, cannot revert approval
                                  if ((invoice as any).status === "done") {
                                    alert("Cannot unapprove a shipped laundry ticket.");
                                    return;
                                  }
                                  // Remove approval
                                  await onUpdateInvoice(invoice.id, {
                                    verified: false,
                                    verifiedBy: "",
                                    verifiedAt: "",
                                  });
                                  if (user?.username) {
                                    await logActivity({
                                      type: "Invoice",
                                      message: `User ${user.username} removed approval from laundry ticket #${invoice.invoiceNumber || invoice.id}`,
                                      user: user.username,
                                    });
                                  }
                                } else {
                                  // Open verification modal to approve the invoice
                                  handleVerifyInvoice(invoice.id);
                                }
                              } else {
                                // Approve
                                handleVerifyInvoice(invoice.id);
                              }
                            }}
                            disabled={
                              hasUnnamedCart(invoice) ||
                              (invoice.status !== "completed") ||
                              (!invoice.manglesCompleted || !invoice.dobladoCompleted)
                            }
                            title={
                              hasUnnamedCart(invoice) ? 'Cannot modify with "CARRO SIN NOMBRE" cart' :
                              invoice.status !== "completed" ? "Mark as completed first" :
                              (!invoice.manglesCompleted || !invoice.dobladoCompleted) ? "Both Mangles and Doblado parts must be completed first" :
                              isVerified ? "Remove approval" : "Approve"
                            }
                          >
                            <i className={`bi ${
                              invoice.status === "completed" || isVerified ? "bi-check-circle" : "bi-hourglass"
                            }`}></i>
                          </button>

                          {/* Ship button */}
                          {user && ["Supervisor", "Admin", "Owner"].includes(user.role) && (
                            <button
                              className={`btn btn-sm ${
                                invoice.status === "done" ? "btn-success" : "btn-outline-primary"
                              }`}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (invoice.status === "done") {
                                  // Unship
                                  const confirmUnship = window.confirm(
                                    "Are you sure you want to unship this invoice?"
                                  );
                                  if (confirmUnship) {
                                    if (hasUnnamedCart(invoice)) {
                                      alert(
                                        'Cannot modify laundry ticket: A cart is named "CARRO SIN NOMBRE". Please rename all carts.'
                                      );
                                      return;
                                    }
                                    if (!invoice.verified) {
                                      alert(
                                        "Laundry Ticket must be approved before it can be shipped."
                                      );
                                      return;
                                    }

                                    // Unship the invoice
                                    await onUpdateInvoice(invoice.id, {
                                      status: "completed",
                                      truckNumber: "",
                                      deliveryDate: "",
                                    });
                                    if (user?.username) {
                                      await logActivity({
                                        type: "Invoice",
                                        message: `User ${user.username} unshipped laundry ticket #${invoice.invoiceNumber || invoice.id}`,
                                        user: user.username,
                                      });
                                    }
                                  }
                                } else {
                                  // Ship
                                  if (!invoice.verified) {
                                    alert("Invoice must be approved before shipping.");
                                    return;
                                  }
                                  if (hasUnnamedCart(invoice)) {
                                    alert(
                                      'Cannot ship laundry ticket: A cart is named "CARRO SIN NOMBRE". Please rename all carts.'
                                    );
                                    return;
                                  }
                                  
                                  // Check if all carts are properly printed before shipping
                                  const areAllCartsPrinted = (invoice.carts || []).every(cart => {
                                    // Cart must be printed at least once
                                    if (!cart.lastPrintedAt) return false;
                                    
                                    // If cart was modified after printing, it needs reprint
                                    if (cart.needsReprint) return false;
                                    
                                    // If cart was modified after last print, it needs reprint
                                    if (cart.lastModifiedAt && cart.lastPrintedAt && 
                                        new Date(cart.lastModifiedAt) > new Date(cart.lastPrintedAt)) {
                                      return false;
                                    }
                                    
                                    return true;
                                  });
                                  
                                  if (!areAllCartsPrinted) {
                                    const unprintedCarts = (invoice.carts || []).filter(cart => {
                                      if (!cart.lastPrintedAt) return true;
                                      if (cart.needsReprint) return true;
                                      if (cart.lastModifiedAt && cart.lastPrintedAt && 
                                          new Date(cart.lastModifiedAt) > new Date(cart.lastPrintedAt)) {
                                        return true;
                                      }
                                      return false;
                                    });
                                    
                                    alert(
                                      `Cannot ship laundry ticket: ${unprintedCarts.length} cart(s) need to be printed first.\n\n` +
                                      `Carts requiring print: ${unprintedCarts.map(c => c.name).join(', ')}\n\n` +
                                      `Please print all carts before shipping.`
                                    );
                                    return;
                                  }
                                  
                                  // Ship the invoice - show modal for truck number and delivery date
                                  setShowShippedModal(invoice.id);
                                  // Pre-fill with existing values if they exist
                                  setShippedTruckNumber(invoice.truckNumber?.toString() || "");
                                  const existingDeliveryDate = invoice.deliveryDate 
                                    ? new Date(invoice.deliveryDate).toISOString().slice(0, 10)
                                    : "";
                                  setShippedDeliveryDate(existingDeliveryDate);
                                }
                              }}
                              disabled={
                                invoice.status !== "done" && (!invoice.verified || hasUnnamedCart(invoice))
                              }
                              title={(() => {
                                if (invoice.status === "done") return "Click to unship";
                                if (!invoice.verified) return "Must be approved first";
                                if (hasUnnamedCart(invoice)) return 'Cannot ship with "CARRO SIN NOMBRE" cart';
                                
                                // Check cart print status
                                const areAllCartsPrinted = (invoice.carts || []).every(cart => {
                                  if (!cart.lastPrintedAt) return false;
                                  if (cart.needsReprint) return false;
                                  if (cart.lastModifiedAt && cart.lastPrintedAt && 
                                      new Date(cart.lastModifiedAt) > new Date(cart.lastPrintedAt)) {
                                    return false;
                                  }
                                  return true;
                                });
                                
                                if (!areAllCartsPrinted) {
                                  const unprintedCarts = (invoice.carts || []).filter(cart => {
                                    if (!cart.lastPrintedAt) return true;
                                    if (cart.needsReprint) return true;
                                    if (cart.lastModifiedAt && cart.lastPrintedAt && 
                                        new Date(cart.lastModifiedAt) > new Date(cart.lastPrintedAt)) {
                                      return true;
                                    }
                                    return false;
                                  });
                                  return `${unprintedCarts.length} cart(s) need printing: ${unprintedCarts.map(c => c.name).join(', ')}`;
                                }
                                
                                return "Mark as shipped";
                              })()}
                            >
                              <i className="bi bi-truck"></i>
                            </button>
                          )}

                          {/* Delete button */}
                          {user && ["Supervisor", "Admin", "Owner"].includes(user.role) && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(invoice);
                              }}
                              disabled={!!invoice.locked}
                              title="Delete invoice"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Form */}
      {showInvoiceForm && (
        <InvoiceForm
          clients={clients}
          products={products}
          onAddInvoice={onAddInvoice}
          onClose={() => setShowInvoiceForm(false)}
        />
      )}

      {/* Cart Modal */}
      {showCartModal && selectedInvoiceId && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Laundry Ticket Cart</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCartModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {/* Cart log at the top */}
                {(() => {
                  const invoice = invoicesState.find(
                    (inv) => inv.id === selectedInvoiceId
                  );
                  if (!invoice) return null;
                  const carts = invoice.carts || [];
                  const allItems = carts.flatMap((cart) =>
                    cart.items.map((item) => ({
                      ...item,
                      cartName: cart.name,
                    }))
                  );
                  if (allItems.length === 0)
                    return (
                      <div className="text-muted mb-3">
                        No products in any cart yet.
                      </div>
                    );
                  return (
                    <div className="mb-3">
                      <h6 className="mb-2">Cart Log</h6>
                      <ul className="list-group mb-0">
                        {allItems.map((item, idx) => (
                          <li
                            key={item.productId + "-" + idx}
                            className="list-group-item d-flex justify-content-between align-items-center py-2"
                          >
                            <span>
                              <b>{item.productName}</b>{" "}
                              <span className="text-secondary">
                                ({item.cartName})
                              </span>
                            </span>
                            <span>
                              <b>Qty:</b> {item.quantity} &nbsp;
                              <span className="text-muted">
                                {item.addedBy ? `By: ${item.addedBy}` : ""}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
                {/* Cart summary by product for each cart */}
                {(() => {
                  const invoice = invoicesState.find(
                    (inv) => inv.id === selectedInvoiceId
                  );
                  if (!invoice) return null;
                  const carts = invoice.carts || [];
                  if (carts.length === 0) return null;
                  return (
                    <div className="mb-4">
                      <h6 className="mb-2">Summary by Product (per Cart)</h6>
                      {carts.map((cart) => {
                        if (!cart.items || cart.items.length === 0) return null;
                        // Aggregate product quantities in this cart
                        const productTotals: {
                          [productId: string]: { name: string; qty: number };
                        } = {};
                        cart.items.forEach((item) => {
                          if (!productTotals[item.productId]) {
                            productTotals[item.productId] = {
                              name: item.productName,
                              qty: 0,
                            };
                          }
                          productTotals[item.productId].qty +=
                            Number(item.quantity) || 0;
                        });
                        return (
                          <div
                            key={cart.id}
                            className="mb-2 d-flex align-items-center gap-2"
                          >
                            <div
                              className="fw-bold"
                              style={{
                                color: cart.name
                                  .toUpperCase()
                                  .startsWith("CARRO SIN NOMBRE")
                                  ? "red"
                                  : undefined,
                              }}
                            >
                              {cart.name}
                            </div>
                            <button
                              className="btn btn-outline-primary btn-sm"
                              title="Edit Cart Name"
                              style={{ padding: "2px 6px", fontSize: 13 }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                const newName = prompt(
                                  "Edit cart name:",
                                  cart.name
                                );
                                if (
                                  newName &&
                                  newName.trim() &&
                                  newName !== cart.name
                                ) {
                                  try {
                                    const updatedCarts = (carts || []).map((c) =>
                                      c.id === cart.id
                                        ? { ...c, name: newName.trim() }
                                        : c
                                    );
                                    await onUpdateInvoice(invoice.id, {
                                      carts: updatedCarts,
                                    });
                                    // Small delay to ensure Firestore write is propagated
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                    // The real-time listener will automatically update the UI
                                  } catch (error: any) {
                                    console.error("Error updating cart name:", error);
                                    alert(`Failed to update cart name: ${error?.message || 'Unknown error'}`);
                                  }
                                }
                              }}
                            >
                              <i className="bi bi-pencil" />
                            </button>
                            <ul
                              className="mb-1"
                              style={{ fontSize: 15, paddingLeft: 18 }}
                            >
                              {Object.values(productTotals).map((prod, idx) => (
                                <li key={prod.name + idx}>
                                  <span>{prod.name}</span>: <b>{prod.qty}</b>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {/* Product cards in 3 columns */}
                <div style={{ maxHeight: 400, overflowY: "auto" }}>
                  <div className="row g-3">
                    {(() => {
                      const invoice = invoicesState.find(
                        (inv) => inv.id === selectedInvoiceId
                      );
                      if (!invoice) return null;
                      const carts = invoice.carts || [];
                      const client = clients.find(
                        (c) => c.id === invoice.clientId
                      );
                      const allowedProductIds = client?.selectedProducts || [];
                      return products
                        .filter((product) =>
                          allowedProductIds.includes(product.id)
                        )
                        .map((product) => (
                          <div key={product.id} className="col-12 col-md-4">
                            <div
                              className={`card mb-2 shadow-sm h-100${
                                selectedProduct === product.id
                                  ? " border-primary"
                                  : " border-light"
                              }`}
                              style={{
                                cursor: "pointer",
                                minHeight: 120,
                                borderWidth: 2,
                              }}
                              onClick={() => {
                                setProductForKeypad(product);
                                setShowProductKeypad(true);
                                setKeypadQuantity(1);
                              }}
                            >
                              <div className="card-body py-2 px-3 text-center">
                                <div
                                  className="fw-bold"
                                  style={{ fontSize: 18 }}
                                >
                                  {product.name}
                                </div>
                              </div>
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                </div>
                {/* Keypad modal for quantity input */}
                {showProductKeypad && productForKeypad && (
                  <div
                    className="modal show"
                    style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
                  >
                    <div className="modal-dialog">
                      <div className="modal-content">
                        <div className="modal-header">
                          <h5 className="modal-title">
                            Add {productForKeypad.name} to Cart
                          </h5>
                          <button
                            type="button"
                            className="btn-close"
                            onClick={() => setShowProductKeypad(false)}
                          ></button>
                        </div>
                        <div className="modal-body">
                          <div className="mb-3">
                            <label className="form-label">Quantity</label>
                            <input
                              type="number"
                              className="form-control"
                              value={keypadQuantity}
                              onChange={(e) =>
                                setKeypadQuantity(Number(e.target.value))
                              }
                              min={1}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button
                            className="btn btn-secondary"
                            onClick={() => setShowProductKeypad(false)}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={handleKeypadAdd}
                          >
                            Add to Cart
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Global total by carts */}
                <div className="mt-4 border-top pt-3">
                  <h6>Totals by Cart</h6>
                  <ul
                    className="mb-2"
                    style={{ listStyle: "none", paddingLeft: 0 }}
                  >
                    {(() => {
                      const invoice = invoicesState.find(
                        (inv) => inv.id === selectedInvoiceId
                      );
                      if (!invoice) return 0;
                      return (invoice.carts || []).reduce(
                        (sum, cart) =>
                          sum +
                          cart.items.reduce(
                            (s, item) => s + (Number(item.quantity) || 0),
                            0
                          ),
                        0
                      );
                    })()}
                  </ul>
                  <div className="fw-bold text-end">
                    Global Total:{" "}
                    {(() => {
                      const invoice = invoicesState.find(
                        (inv) => inv.id === selectedInvoiceId
                      );
                      if (!invoice) return 0;
                      return (invoice.carts || []).reduce(
                        (sum, cart) =>
                          sum +
                          cart.items.reduce(
                            (s, item) => s + (Number(item.quantity) || 0),
                            0
                          ),
                        0
                      );
                    })()}
                  </div>
                </div>
                {/* Add Product to Each Cart */}
                {(() => {
                  const invoice = invoicesState.find(
                    (inv) => inv.id === selectedInvoiceId
                  );
                  if (!invoice) return null;
                  const carts = invoice.carts || [];
                  if (carts.length === 0) return null;
                  return (
                    <div className="mb-4">
                      <h6 className="mb-2">Add Product to Each Cart</h6>
                      {carts.map((cart) => {
                        const selection = cartProductSelections[cart.id] || {
                          productId: "",
                          qty: 1,
                          adding: false,
                        };
                        const allowedProductIds =
                          clients.find((c) => c.id === invoice.clientId)
                            ?.selectedProducts || [];
                        return (
                          <div
                            key={cart.id}
                            className="mb-2 p-2 border rounded bg-light"
                          >
                            <div className="fw-bold mb-1">{cart.name}</div>
                            <div className="d-flex flex-row align-items-center gap-2 mb-2">
                              <select
                                className="form-select form-select-sm"
                                style={{ maxWidth: 180 }}
                                value={selection.productId}
                                onChange={(e) =>
                                  setCartProductSelections((prev) => ({
                                    ...prev,
                                    [cart.id]: {
                                      ...selection,
                                      productId: e.target.value,
                                    },
                                  }))
                                }
                              >
                                <option value="">Select product</option>
                                {products
                                  .filter((p) =>
                                    allowedProductIds.includes(p.id)
                                  )
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                              </select>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                style={{ width: 80 }}
                                min={1}
                                value={selection.qty}
                                onChange={(e) =>
                                  setCartProductSelections((prev) => ({
                                    ...prev,
                                    [cart.id]: {
                                      ...selection,
                                      qty: Number(e.target.value),
                                    },
                                  }))
                                }
                              />
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={
                                  !selection.productId ||
                                  selection.qty < 1 ||
                                  selection.adding
                                }
                                onClick={async () => {
                                  setCartProductSelections((prev) => ({
                                    ...prev,
                                    [cart.id]: { ...selection, adding: true },
                                  }));
                                  const product = products.find(
                                    (p) => p.id === selection.productId
                                  );
                                  if (!product) return;
                                  // Add or update product in cart
                                  const updatedCarts = invoice.carts.map(
                                    (c) => {
                                      if (c.id !== cart.id) return c;
                                      const existingIdx = c.items.findIndex(
                                        (item) => item.productId === product.id
                                      );
                                      let newItems;
                                      if (existingIdx > -1) {
                                        newItems = c.items.map((item, idx) =>
                                          idx === existingIdx
                                            ? {
                                                ...item,
                                                quantity:
                                                  (Number(item.quantity) || 0) +
                                                  selection.qty,
                                              }
                                            : item
                                        );
                                      } else {
                                        const prod = products.find(
                                          (p) => p.id === product.id
                                        );
                                        newItems = [
                                          ...c.items,
                                          {
                                            productId: product.id,
                                            productName: product.name,
                                            quantity: selection.qty,
                                            price: product.price,
                                            addedBy:
                                              user?.username || "Unknown",
                                            addedAt: new Date().toISOString(),
                                          },
                                        ];
                                      }
                                      return { ...c, items: newItems };
                                    }
                                  );
                                  await onUpdateInvoice(invoice.id, {
                                    carts: updatedCarts,
                                  });
                                  await refreshInvoices();
                                  setCartProductSelections((prev) => ({
                                    ...prev,
                                    [cart.id]: {
                                      productId: "",
                                      qty: 1,
                                      adding: false,
                                    },
                                  }));
                                }}
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCartModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <DeleteConfirmationModal
          invoice={invoiceToDelete}
          onConfirm={handleConfirmDelete}
          onCancel={() => setInvoiceToDelete(null)}
        />
      )}

      {/* Invoice Merge Modal */}
      {showMergeModal && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Merge Invoices</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowMergeModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {mergeError && (
                  <div className="alert alert-danger">{mergeError}</div>
                )}
                
                <div className="mb-3">
                  <label className="form-label">
                    <strong>Source Invoice (will be deleted after merge):</strong>
                  </label>
                  {mergeSourceInvoiceId && (() => {
                    const sourceInvoice = invoices.find(inv => inv.id === mergeSourceInvoiceId);
                    return sourceInvoice ? (
                      <div className="p-2 bg-light rounded">
                        #{sourceInvoice.invoiceNumber || sourceInvoice.id} - {sourceInvoice.clientName}
                        ({sourceInvoice.carts.length} cart{sourceInvoice.carts.length !== 1 ? 's' : ''})
                      </div>
                    ) : null;
                  })()}
                </div>

                <div className="mb-3">
                  <label htmlFor="mergeTarget" className="form-label">
                    <strong>Target Invoice (carts will be merged into this invoice):</strong>
                  </label>
                  <select
                    id="mergeTarget"
                    className="form-select"
                    value={mergeTargetInvoiceId}
                    onChange={(e) => setMergeTargetInvoiceId(e.target.value)}
                    disabled={mergeLoading}
                  >
                    <option value="">Select target invoice...</option>
                    {mergeSourceInvoiceId && getMergeableInvoices(mergeSourceInvoiceId).map(invoice => (
                      <option key={invoice.id} value={invoice.id}>
                        #{invoice.invoiceNumber || invoice.id} - {invoice.clientName} 
                        ({invoice.carts.length} cart{invoice.carts.length !== 1 ? 's' : ''})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="alert alert-info">
                  <strong>Note:</strong> All carts from the source invoice will be merged into the target invoice. 
                  If cart names conflict, they will be automatically renamed. The source invoice will be deleted after the merge.
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowMergeModal(false)}
                  disabled={mergeLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleMergeInvoices}
                  disabled={mergeLoading || !mergeTargetInvoiceId}
                >
                  {mergeLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Merging...
                    </>
                  ) : (
                    'Merge Invoices'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Keypad Modal */}
      {showProductKeypad && productForKeypad && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Add {productForKeypad.name} to Cart
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowProductKeypad(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    value={keypadQuantity}
                    onChange={(e) => setKeypadQuantity(Number(e.target.value))}
                    min={1}
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowProductKeypad(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleKeypadAdd}>
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Modal */}
      {showLogModal && logGroup && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Status Change Log</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowLogModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {Array.isArray(logGroup.statusLog) &&
                logGroup.statusLog.length > 0 ? (
                  <ul className="list-group">
                    {logGroup.statusLog.map((log: any, idx: number) => (
                      <li key={idx} className="list-group-item">
                        <b>Step:</b> {log.step} <br />
                        <b>Time:</b>{" "}
                        {log.timestamp ? formatDateSpanish(log.timestamp) : "-"}{" "}
                        <br />
                        <b>User:</b> {log.user || "-"}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted">
                    No log available for this group.
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button onClick={() => setShowLogModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product to Cart Modal */}
      {showAddProductModal && addProductGroup && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Product to Group</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddProductModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Select Client</label>
                  <select
                    className="form-select"
                    value={addProductGroup.clientId || ""}
                    disabled
                  >
                    {clients.map((client, clientIdx) => (
                      <option key={client.id || clientIdx} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Select Product</label>
                  <select
                    className="form-select"
                    value={selectedAddProductId}
                    onChange={(e) => setSelectedAddProductId(e.target.value)}
                  >
                    <option value="">-- Select a product --</option>
                    {(() => {
                      const client = clients.find(
                        (c) => c.id === addProductGroup?.clientId
                      );
                      const allowedProductIds = client?.selectedProducts || [];
                      return products
                        .filter((product) =>
                          allowedProductIds.includes(product.id)
                        )
                        .map((product, prodIdx) => (
                          <option
                            key={product.id || prodIdx}
                            value={product.id}
                          >
                            {product.name}
                          </option>
                        ));
                    })()}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Add By</label>
                  <div>
                    <div className="form-check form-check-inline">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="addByMode"
                        id="addByCart"
                        value="cart"
                        checked={addProductMode === "cart"}
                        onChange={() => setAddProductMode("cart")}
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
                        checked={addProductMode === "quantity"}
                        onChange={() => setAddProductMode("quantity")}
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
                        checked={addProductMode === "pounds"}
                        onChange={() => setAddProductMode("pounds")}
                      />
                      <label className="form-check-label" htmlFor="addByLbs">
                        Pounds
                      </label>
                    </div>
                  </div>
                </div>
                {addProductMode === "cart" && (
                  <div className="mb-3">
                    <label className="form-label">Select Cart</label>
                    <select
                      className="form-select"
                      value={selectedCartId}
                      onChange={(e) => setSelectedCartId(e.target.value)}
                    >
                      <option value="">-- Select a cart --</option>
                      {(addProductGroup.carts || []).map(
                        (cart: any, idx: number) => (
                          <option key={cart.id || idx} value={cart.id}>
                            {cart.name}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                )}
                {(addProductMode === "quantity" ||
                  addProductMode === "pounds") && (
                  <div className="mb-3">
                    <label className="form-label">
                      {addProductMode === "quantity" ? "Quantity" : "Pounds"}
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      min={1}
                      value={addProductQty}
                      onChange={(e) => setAddProductQty(Number(e.target.value))}
                    />
                  </div>
                )}
                {addToGroupError && (
                  <div className="text-danger mb-2">{addToGroupError}</div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAddProductModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={
                    !selectedAddProductId ||
                    (addProductMode === "cart" && !selectedCartId) ||
                    ((addProductMode === "quantity" ||
                      addProductMode === "pounds") &&
                      addProductQty < 1)
                  }
                  onClick={async () => {
                    const product = products.find(
                      (p) => p.id === selectedAddProductId
                    );
                    if (!product) return;
                    // Find or create 'Pending Products' group for this client
                    let pendingGroup = pickupGroups.find(
                      (g) =>
                        g.clientId === addProductGroup.clientId &&
                        g.status === "Pending Products"
                    );
                    if (!pendingGroup) {
                      // Create new group in Firestore
                      const now = new Date();
                      const initialCarts = getInitialCartsForGroup({
                        clientId: addProductGroup.clientId,
                        clientName: addProductGroup.clientName,
                      });
                      const groupData = {
                        clientId: addProductGroup.clientId,
                        clientName: addProductGroup.clientName,
                        startTime: now,
                        endTime: now,
                        totalWeight: 0,
                        status: "Pending Products",
                        carts: initialCarts,
                        numCarts: initialCarts.length, // Add number of carts as a value
                        segregatedCarts: null, // Set segregatedCarts to null

                        createdAt: now.toISOString(),
                        // washingType: 'Conventional', // Ensure this is set for filtering
                      };
                      const groupRef = await import("../firebase").then(
                        ({ db }) =>
                          import("firebase/firestore").then(
                            ({ collection, addDoc }) =>
                              addDoc(collection(db, "pickup_groups"), groupData)
                          )
                      );
                      pendingGroup = { ...groupData, id: groupRef.id };
                      setPickupGroups((prev) => [...prev, pendingGroup]);
                    } else {
                      // If group exists but status is not 'Pending Products', update it
                      if (pendingGroup.status !== "Pending Products") {
                        pendingGroup.status = "Pending Products";
                      }
                    }
                    // Add product to the group's carts
                    let updatedCarts = Array.isArray(pendingGroup.carts)
                      ? [...pendingGroup.carts]
                      : [];
                    if (addProductMode === "cart") {
                      let cartIdx = updatedCarts.findIndex(
                        (c: any) => c.id === selectedCartId
                      );
                      if (cartIdx === -1) {
                        const newCart = {
                          id: Date.now().toString(),
                          name: `Cart ${updatedCarts.length + 1}`,
                          items: [],
                          total: 0,
                          createdAt: new Date().toISOString(),
                          createdBy: user?.username || "Unknown",
                        };
                        updatedCarts.push(newCart);
                        cartIdx = updatedCarts.length - 1;
                      }

                      const cart = { ...updatedCarts[cartIdx] };
                      const existingItemIdx = cart.items.findIndex(
                        (item: any) => item.productId === product.id
                      );
                      if (existingItemIdx > -1) {
                        cart.items[existingItemIdx].quantity += addProductQty;
                      } else {
                        cart.items.push({
                          productId: product.id,
                          productName: product.name,
                          quantity: addProductQty,
                          price: product.price,
                          addedBy: user?.username || "Unknown",
                          addedAt: new Date().toISOString(),
                        });
                      }
                      updatedCarts[cartIdx] = cart;
                    } else {
                      const newCart = {
                        id: Date.now().toString(),
                        name: `${
                          addProductMode === "quantity" ? "Qty" : "Lbs"
                        } Cart - ${new Date().toLocaleTimeString()}`,
                        items: [
                          {
                            productId: product.id,
                            productName: product.name,
                            quantity: addProductQty,
                            price: product.price,
                            addedBy: user?.username || "Unknown",
                            addedAt: new Date().toISOString(),
                          },
                        ],
                        total: 0,
                        createdAt: new Date().toISOString(),
                        createdBy: user?.username || "Unknown",
                      };
                      updatedCarts.push(newCart);
                    }
                    // Update in Firestore
                    // Removed Pending Products logic and group update since Pending Products section is removed
                    setShowAddProductModal(false);
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add To Group Modal */}
      {showAddToGroupModal && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Product to Group</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddToGroupModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Client</label>
                  <select
                    className="form-select"
                    value={addToGroupClientId}
                    onChange={(e) => setAddToGroupClientId(e.target.value)}
                  >
                    <option value="">-- Select a client --</option>
                    {clients.map((client, clientIdx) => (
                      <option key={client.id || clientIdx} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Product</label>
                  <select
                    className="form-select"
                    value={addToGroupProductId}
                    onChange={(e) => setAddToGroupProductId(e.target.value)}
                  >
                    <option value="">-- Select a product --</option>
                    {(() => {
                      const client = clients.find(
                        (c) => c.id === addToGroupClientId
                      );
                      const allowedProductIds = client?.selectedProducts || [];
                      return products
                        .filter((product) =>
                          allowedProductIds.includes(product.id)
                        )
                        .map((product, prodIdx) => (
                          <option
                            key={product.id || prodIdx}
                            value={product.id}
                          >
                            {product.name}
                          </option>
                        ));
                    })()}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Mode</label>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      id="mode-carts"
                      name="addToGroupMode"
                      value="carts"
                      checked={addToGroupMode === "carts"}
                      onChange={() => setAddToGroupMode("carts")}
                    />
                    <label className="form-check-label" htmlFor="mode-carts">
                      Carts
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      id="mode-quantity"
                      name="addToGroupMode"
                      value="quantity"
                      checked={addToGroupMode === "quantity"}
                      onChange={() => setAddToGroupMode("quantity")}
                    />
                    <label className="form-check-label" htmlFor="mode-quantity">
                      Quantity
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      id="mode-pounds"
                      name="addToGroupMode"
                      value="pounds"
                      checked={addToGroupMode === "pounds"}
                      onChange={() => setAddToGroupMode("pounds")}
                    />
                    <label className="form-check-label" htmlFor="mode-pounds">
                      Pounds
                    </label>
                  </div>
                </div>
                {addProductMode === "cart" && (
                  <div className="mb-3">
                    <label className="form-label">Select Cart</label>
                    <select
                      className="form-select"
                      value={selectedCartId}
                      onChange={(e) => setSelectedCartId(e.target.value)}
                    >
                      <option value="">-- Select a cart --</option>
                      {(addProductGroup.carts || []).map(
                        (cart: any, idx: number) => (
                          <option key={cart.id || idx} value={cart.id}>
                            {cart.name}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                )}
                {(addProductMode === "quantity" ||
                  addProductMode === "pounds") && (
                  <div className="mb-3">
                    <label className="form-label">
                      {addProductMode === "quantity" ? "Quantity" : "Pounds"}
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      min={1}
                      value={addProductQty}
                      onChange={(e) => setAddProductQty(Number(e.target.value))}
                    />
                  </div>
                )}
                {addToGroupError && (
                  <div className="text-danger mb-2">{addToGroupError}</div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAddToGroupModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={addToGroupLoading}
                  onClick={async () => {
                    setAddToGroupError("");
                    setAddToGroupLoading(true);
                    try {
                      if (
                        !addToGroupClientId ||
                        !addToGroupProductId ||
                        (addToGroupMode !== "carts" && addToGroupValue < 1)
                      ) {
                        setAddToGroupError(
                          "Please select all fields and enter a valid value."
                        );
                        setAddToGroupLoading(false);
                        return;
                      }
                      // Find the group for this client (Conventional or Tunnel)
                      const group = pickupGroups.find(
                        (g) =>
                          g.clientId === addToGroupClientId &&
                          (g.status === "Conventional" || g.status === "Tunnel")
                      );
                      if (!group) {
                        setAddToGroupError(
                          "No group found for this client today."
                        );
                        setAddToGroupLoading(false);
                        return;
                      }
                      // Find or create cart
                      let carts = Array.isArray(group.carts)
                        ? [...group.carts]
                        : [];
                      let cartId =
                        carts.length > 0 ? carts[0].id : Date.now().toString();
                      let cartIdx = carts.findIndex((c) => c.id === cartId);
                      if (cartIdx === -1) {
                        carts.push({
                          id: cartId,
                          name: `Cart ${carts.length + 1}`,
                          items: [],
                          total: 0,
                          createdAt: new Date().toISOString(),
                        });
                        cartIdx = carts.length - 1;
                      }
                      const product = products.find(
                        (p) => p.id === addToGroupProductId
                      );
                      if (!product) throw new Error("Product not found");
                      let cart = { ...carts[cartIdx] };
                      // Add product with the selected mode
                      let item: any = {
                        productId: product.id,
                        productName: product.name,
                        price: product.price,
                        addedBy: user?.username || "Unknown",
                        addedAt: new Date().toISOString(),
                      };
                      if (addToGroupMode === "carts") {
                        item.quantity = 1;
                      } else if (addToGroupMode === "quantity") {
                        item.quantity = addToGroupValue;
                      } else if (addToGroupMode === "pounds") {
                        item.quantity = addToGroupValue;
                      }
                      // If product already exists, update quantity
                      const existingIdx = cart.items.findIndex(
                        (i: any) => i.productId === product.id
                      );
                      if (existingIdx > -1) {
                        cart.items[existingIdx].quantity += item.quantity;
                      } else {
                        cart.items.push(item);
                      }
                      carts[cartIdx] = cart;
                      // Update in Firestore
                      // Removed Pending Products logic and group update since Pending Products section is removed
                      setShowAddToGroupModal(false);
                    } catch (err: any) {
                      setAddToGroupError(
                        err.message || "Error adding product to group"
                      );
                    } finally {
                      setAddToGroupLoading(false);
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Add Confirmation Modal */}
      {showAddConfirmation && confirmationProduct && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm Product Addition</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowAddConfirmation(false);
                    setConfirmationProduct(null);
                  }}
                ></button>
              </div>
              <div className="modal-body text-center">
                <div className="mb-4">
                  <h4 className="mb-3">
                    {user?.username || "User"} wants to add
                  </h4>
                  <div
                    className="display-1 fw-bold text-primary mb-3"
                    style={{ fontSize: "4rem" }}
                  >
                    {confirmationProduct.quantity}
                  </div>
                  <h3 className="text-secondary">
                    {confirmationProduct.product?.name}
                  </h3>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddConfirmation(false);
                    setConfirmationProduct(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={confirmationProduct.addCallback}
                >
                  Confirm Addition
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shipped Modal */}
      {showShippedModal && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Enter Truck Number & Delivery Date
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowShippedModal(null)}
                ></button>
              </div>
              <div className="modal-body">
                <input
                  type="number"
                  className="form-control mb-3"
                  placeholder="Truck Number"
                  value={shippedTruckNumber}
                  onChange={(e) =>
                    setShippedTruckNumber(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  min={1}
                  autoFocus
                />
                <label className="form-label">Delivery Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={shippedDeliveryDate}
                  onChange={(e) => setShippedDeliveryDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowShippedModal(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-info"
                  disabled={!shippedTruckNumber || !shippedDeliveryDate}
                  onClick={async () => {
                    const invoice = invoicesState.find(
                      (inv) => inv.id === showShippedModal
                    );
                    if (!invoice) return;
                    
                    // Check if all carts are properly printed before shipping
                    const areAllCartsPrinted = (invoice.carts || []).every(cart => {
                      // Cart must be printed at least once
                      if (!cart.lastPrintedAt) return false;
                      
                      // If cart was modified after printing, it needs reprint
                      if (cart.needsReprint) return false;
                      
                      // If cart was modified after last print, it needs reprint
                      if (cart.lastModifiedAt && cart.lastPrintedAt && 
                          new Date(cart.lastModifiedAt) > new Date(cart.lastPrintedAt)) {
                        return false;
                      }
                      
                      return true;
                    });
                    
                    if (!areAllCartsPrinted) {
                      const unprintedCarts = (invoice.carts || []).filter(cart => {
                        if (!cart.lastPrintedAt) return true;
                        if (cart.needsReprint) return true;
                        if (cart.lastModifiedAt && cart.lastPrintedAt && 
                            new Date(cart.lastModifiedAt) > new Date(cart.lastPrintedAt)) {
                          return true;
                        }
                        return false;
                      });
                      
                      alert(
                        `Cannot ship laundry ticket: ${unprintedCarts.length} cart(s) need to be printed first.\n\n` +
                        `Carts requiring print: ${unprintedCarts.map(c => c.name).join(', ')}\n\n` +
                        `Please print all carts before shipping.`
                      );
                      return;
                    }
                    
                    await onUpdateInvoice(invoice.id, {
                      status: "done",
                      truckNumber: shippedTruckNumber.toString(),
                      deliveryDate: new Date(shippedDeliveryDate + "T00:00:00").toISOString(),
                    });
                    if (user?.username) {
                      await                      logActivity({
                        type: "Invoice",
                        message: `User ${user.username} marked laundry ticket #${invoice.invoiceNumber || invoice.id} as shipped (Truck #${shippedTruckNumber}, Delivery Date: ${shippedDeliveryDate})`,
                        user: user.username,
                      });
                    }

                    // Auto-send email if enabled for shipping
                    const client = clients.find(
                      (c) => c.id === invoice.clientId
                    );
                    if (
                      client?.printConfig?.emailSettings?.enabled &&
                      client.printConfig.emailSettings.autoSendOnShipping &&
                      client.email
                    ) {
                      try {
                        // Generate PDF attachment if needed
                        let pdfContent: string | undefined;
                        try {
                          const printConfig =
                            client.printConfig.invoicePrintSettings;
                          pdfContent = await generateInvoicePDF(
                            client,
                            invoice,
                            printConfig
                          );
                        } catch (error) {
                          console.error(
                            "Failed to generate PDF for shipping auto-send:",
                            error
                          );
                        }

                        // Send email with shipping information
                        const emailSettings = {
                          ...client.printConfig.emailSettings,
                          subject:
                            client.printConfig.emailSettings.subject ||
                            `Invoice #${
                              invoice.invoiceNumber || invoice.id
                            } - Shipped via Truck #${shippedTruckNumber}`,
                          bodyTemplate: client.printConfig.emailSettings
                            .bodyTemplate
                            ? client.printConfig.emailSettings.bodyTemplate
                                .replace(/\{truckNumber\}/g, shippedTruckNumber)
                                .replace(
                                  /\{deliveryDate\}/g,
                                  shippedDeliveryDate
                                )
                            : undefined,
                        };

                        const success = await sendInvoiceEmail(
                          client,
                          invoice,
                          emailSettings,
                          pdfContent
                        );

                        // Update email status in invoice
                        const emailStatusUpdate = {
                          emailStatus: {
                            ...invoice.emailStatus,
                            shippingEmailSent: success,
                            shippingEmailSentAt: success
                              ? new Date().toISOString()
                              : undefined,
                            lastEmailError: success
                              ? undefined
                              : "Failed to send shipping email",
                          },
                        };

                        await onUpdateInvoice(invoice.id, emailStatusUpdate);

                        if (success) {
                          console.log(
                            `Auto-sent shipping notification email to ${client.email}`
                          );
                          await logActivity({
                            type: "Invoice",
                            message: `Invoice #${
                              invoice.invoiceNumber || invoice.id
                            } shipping notification auto-sent to ${
                              client.name
                            } (${client.email})`,
                          });
                        }
                      } catch (error) {
                        console.error(
                          "Auto-send shipping email failed:",
                          error
                        );
                        // Don't block the shipping process if email fails
                      }
                    }

                    // Update group status if invoice has pickupGroupId
                    if (invoice.pickupGroupId) {
                      try {
                        const { updatePickupGroupStatus } = await import(
                          "../services/firebaseService"
                        );
                        const group = pickupGroups.find(
                          (g) => g.id === invoice.pickupGroupId
                        );
                        if (group) {
                          await updatePickupGroupStatus(
                            invoice.pickupGroupId,
                            "done"
                          );
                        }
                      } catch (err) {
                        console.error("Error updating group status:", err);
                      }
                    }
                    setShowShippedModal(null);
                    setShippedTruckNumber("");
                    setShippedDeliveryDate("");
                  }}
                >
                  Ship
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Schedule Modal */}
      {showDeliveryScheduleModal && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-calendar-check me-2"></i>
                  Schedule Delivery (Step 1 of 2)
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    const invoiceId = showDeliveryScheduleModal;
                    setShowDeliveryScheduleModal(null);
                    // Show print options even if user closes modal
                    if (invoiceId) {
                      setShowPrintOptionsModal(invoiceId);
                    }
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <i className="bi bi-info-circle-fill me-2"></i>
                  <strong>Laundry Ticket Approved!</strong> Now schedule the delivery date and method. You can skip this step if you want to schedule later.
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    <strong>Delivery Method</strong> <span className="text-danger">*</span>
                  </label>
                  <div className="d-flex gap-3">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="deliveryMethod"
                        id="deliveryMethodTruck"
                        value="truck"
                        checked={scheduleDeliveryMethod === "truck"}
                        onChange={(e) => setScheduleDeliveryMethod(e.target.value as "truck" | "client_pickup")}
                      />
                      <label className="form-check-label" htmlFor="deliveryMethodTruck">
                        <i className="bi bi-truck me-1"></i>
                        Truck Delivery
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="deliveryMethod"
                        id="deliveryMethodPickup"
                        value="client_pickup"
                        checked={scheduleDeliveryMethod === "client_pickup"}
                        onChange={(e) => setScheduleDeliveryMethod(e.target.value as "truck" | "client_pickup")}
                      />
                      <label className="form-check-label" htmlFor="deliveryMethodPickup">
                        <i className="bi bi-person-check me-1"></i>
                        Pick Up by Client
                      </label>
                    </div>
                  </div>
                  <small className="form-text text-muted">
                    Choose whether to deliver via truck or have client pick up at facility
                  </small>
                </div>
                
                <div className="mb-3">
                  <label className="form-label">
                    <strong>Delivery Date</strong> <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={scheduleDeliveryDate}
                    onChange={(e) => setScheduleDeliveryDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    required
                  />
                  <small className="form-text text-muted">
                    {scheduleDeliveryMethod === "truck" 
                      ? "Select tomorrow or any future date for delivery" 
                      : "Select date when client will pick up the order"}
                  </small>
                </div>

                {scheduleDeliveryMethod === "truck" && (
                  <div className="mb-3">
                    <label className="form-label">
                      <strong>Truck Number</strong> <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={scheduleTruckNumber}
                      onChange={(e) => setScheduleTruckNumber(e.target.value)}
                      required
                    >
                      <option value="">Select truck number...</option>
                      {Array.from({ length: 10 }, (_, i) => 30 + i).map(num => (
                        <option key={num} value={num}>Truck #{num}</option>
                      ))}
                    </select>
                    <small className="form-text text-muted">
                      Available trucks: #30 through #39
                    </small>
                  </div>
                )}

                {scheduleDeliveryDate && (scheduleDeliveryMethod === "client_pickup" || scheduleTruckNumber) && (
                  <div className="alert alert-success">
                    <i className="bi bi-check-circle-fill me-2"></i>
                    <strong>Ready to schedule:</strong><br />
                    {scheduleDeliveryMethod === "truck" ? (
                      <>Delivery on {new Date(scheduleDeliveryDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric", 
                        month: "long",
                        day: "numeric"
                      })} via Truck #{scheduleTruckNumber}</>
                    ) : (
                      <>Client pickup on {new Date(scheduleDeliveryDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric", 
                        month: "long",
                        day: "numeric"
                      })}</>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    const invoiceId = showDeliveryScheduleModal;
                    setShowDeliveryScheduleModal(null);
                    // Show print options even if user cancels delivery scheduling
                    if (invoiceId) {
                      setShowPrintOptionsModal(invoiceId);
                    }
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    const invoiceId = showDeliveryScheduleModal;
                    setShowDeliveryScheduleModal(null);
                    setScheduleDeliveryDate("");
                    setScheduleTruckNumber("");
                    setScheduleDeliveryMethod("truck");
                    // Skip delivery scheduling and go directly to print options
                    if (invoiceId) {
                      setShowPrintOptionsModal(invoiceId);
                    }
                  }}
                >
                  <i className="bi bi-skip-forward me-1"></i>
                  Skip for Now
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!scheduleDeliveryDate || (scheduleDeliveryMethod === "truck" && !scheduleTruckNumber)}
                  onClick={handleConfirmScheduleDelivery}
                >
                  <i className="bi bi-calendar-check me-1"></i>
                  Schedule {scheduleDeliveryMethod === "truck" ? "Delivery" : "Pickup"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client Pickup Signature Modal */}
      {showPickupSignatureModal && pickupSignatureInvoice && (
        <SignatureModal
          show={!!showPickupSignatureModal}
          onClose={() => {
            setShowPickupSignatureModal(null);
            setPickupSignatureInvoice(null);
          }}
          invoiceId={pickupSignatureInvoice.id}
          invoiceNumber={pickupSignatureInvoice.invoiceNumber?.toString()}
          clientName={pickupSignatureInvoice.clientName}
          clientId={pickupSignatureInvoice.clientId}
          invoice={pickupSignatureInvoice}
          onSignatureSaved={handlePickupSignatureSaved}
        />
      )}

      {/* Unship Recent Invoices Modal */}
      {showUnshipModal &&
        user &&
        ["Supervisor", "Admin", "Owner"].includes(user.role) && (
          <div
            className="modal show"
            style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
          >
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    Select Invoices to Unship (Last 24h)
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowUnshipModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  {(() => {
                    const now = Date.now();
                    const eligible = invoicesState.filter(
                      (inv) =>
                        inv.status === "done" &&
                        inv.truckNumber &&
                        ((inv.verifiedAt &&
                          now - new Date(inv.verifiedAt).getTime() <
                            24 * 60 * 60 * 1000) ||
                          (inv.lockedAt &&
                            now - new Date(inv.lockedAt).getTime() <
                              24 * 60 * 60 * 1000) ||
                          (inv.date &&
                            now - new Date(inv.date).getTime() <
                              24 * 60 * 60 * 1000))
                    );
                    if (eligible.length === 0)
                      return (
                        <div className="text-muted">
                          No recently shipped laundry tickets found.
                        </div>
                      );
                    return (
                      <ul className="list-group mb-3">
                        {eligible.map((inv) => (
                          <li
                            key={inv.id}
                            className="list-group-item d-flex align-items-center"
                          >
                            <input
                              type="checkbox"
                              className="form-check-input me-2"
                              checked={unshipSelectedIds.includes(inv.id)}
                              onChange={(e) => {
                                setUnshipSelectedIds((prev) =>
                                  e.target.checked
                                    ? [...prev, inv.id]
                                    : prev.filter((id) => id !== inv.id)
                                );
                              }}
                            />
                            <span>
                              #{inv.invoiceNumber || inv.id} - {inv.clientName}{" "}
                              -{" "}
                              {inv.date
                                ? formatDateSpanish(inv.date)
                                : "No date"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowUnshipModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-warning"
                    onClick={handleConfirmUnship}
                    disabled={unshipSelectedIds.length === 0}
                  >
                    Unship Selected
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Cart Selection Modal */}
      {showCartSelectModal && (
        <LaundryCartModal
          show={showCartSelectModal}
          onClose={() => setShowCartSelectModal(false)}
          onSelect={async (laundryCart) => {
            // Find the full Cart object by id
            const cart = cartSelectCarts.find((c) => c.id === laundryCart.id);
            if (cart) await handleCartSelect(cart);
          }}
          carts={cartSelectCarts.map(cartToLaundryCart)}
          onAddCart={async (cartName) => {
            const invoice = invoicesState.find(
              (inv) => inv.id === selectedInvoiceId
            );
            if (!invoice) throw new Error("Invoice not found");
            // Handle delete cart
            if (cartName.startsWith("__delete__")) {
              const cartId = cartName.replace("__delete__", "");
              const updatedCarts = invoice.carts.filter((c) => c.id !== cartId);
              await onUpdateInvoice(invoice.id, { carts: updatedCarts });
              return { id: cartId, name: "", isActive: false };
            }
            // Handle edit cart name
            if (cartName.startsWith("__edit__")) {
              try {
                const [_, cartId, ...nameParts] = cartName.split("__");
                const newName = nameParts.join("__");
                
                console.log("🔄 Processing cart name edit:", { 
                  invoiceId: invoice.id, 
                  cartId, 
                  newName,
                  timestamp: new Date().toISOString()
                });
                
                const updatedCarts = invoice.carts.map((c) =>
                  c.id === cartId ? { ...c, name: newName } : c
                );
                
                await onUpdateInvoice(invoice.id, { carts: updatedCarts });
                
                // Small delay to ensure Firestore write propagation
                await new Promise(resolve => setTimeout(resolve, 50));
                
                console.log("✅ Cart name edit completed successfully:", { cartId, newName });
                
                return { id: cartId, name: newName, isActive: true };
              } catch (error: any) {
                console.error("❌ Error updating cart name:", error);
                throw new Error(`Failed to update cart name: ${error?.message || 'Unknown error'}`);
              }
            }
            // --- Invoice Name Edit Logic ---
            if (cartName.startsWith("__invoice_name__")) {
              const newInvoiceName = cartName.replace("__invoice_name__", "");
              await onUpdateInvoice(invoice.id, { name: newInvoiceName });
              await refreshInvoices();
              return { id: invoice.id, name: newInvoiceName, isActive: true };
            }
            // --- Special Service Logic ---
            if (cartName.startsWith("__special_service__")) {
              const isRequested =
                cartName.replace("__special_service__", "") === "true";
              await onUpdateInvoice(invoice.id, {
                specialServiceRequested: isRequested,
                ...(isRequested ? {} : { specialServiceCost: 0 }),
              });
              await refreshInvoices();
              return { id: invoice.id, name: cartName, isActive: true };
            }
            if (cartName.startsWith("__special_service_cost__")) {
              const cost = Number(
                cartName.replace("__special_service_cost__", "")
              );
              await onUpdateInvoice(invoice.id, { specialServiceCost: cost });
              await refreshInvoices();
              return { id: invoice.id, name: cartName, isActive: true };
            }
            // Check for duplicate cart names and handle merging
            if (
              invoice.carts.some(
                (c) =>
                  c.name.trim().toLowerCase() === cartName.trim().toLowerCase()
              )
            ) {
              // Check if user wants to merge or create separate cart
              const userWantsToMerge = window.confirm(
                `A cart named "${cartName}" already exists.\n\n` +
                `Click OK to merge the items with the existing cart, or Cancel to create a separate cart with a numbered suffix.`
              );
              
              if (userWantsToMerge) {
                // Find the existing cart and return its ID for merging
                const existingCart = invoice.carts.find(
                  (c) => c.name.trim().toLowerCase() === cartName.trim().toLowerCase()
                );
                if (existingCart) {
                  return { id: existingCart.id, name: existingCart.name, isActive: true };
                }
              } else {
                // Create a cart with numbered suffix
                let suffix = 2;
                let newCartName = `${cartName} (${suffix})`;
                while (invoice.carts.some(c => c.name.trim().toLowerCase() === newCartName.trim().toLowerCase())) {
                  suffix++;
                  newCartName = `${cartName} (${suffix})`;
                }
                cartName = newCartName;
              }
            }
            const newCart = {
              id: Date.now().toString(),
              name: cartName,
              items: [],
              total: 0,
              createdAt: new Date().toISOString(),
              createdBy: user?.username || "Unknown",
            };
            await onUpdateInvoice(invoice.id, {
              carts: [...invoice.carts, newCart],
            });
            await refreshInvoices();
            // Log cart creation
            if (user?.username) {
              await logActivity({
                type: "Cart",
                message: `User ${user.username} created cart '${
                  newCart.name
                }' in invoice #${invoice.invoiceNumber || invoice.id}`,
                user: user.username,
              });
            }
            return { id: newCart.id, name: newCart.name, isActive: true };
          }}
        />
      )}

      {/* Invoice Details Modal */}
      {showInvoiceDetailsModal && selectedInvoice && (
        <InvoiceDetailsModal
          invoice={(() => {
            const currentInvoice = invoicesState.find((inv) => inv.id === selectedInvoice.id) || selectedInvoice;
            console.log("📤 Passing invoice to modal:", { 
              invoiceId: currentInvoice.id, 
              carts: currentInvoice.carts?.map(c => ({ id: c.id, name: c.name })),
              fromState: !!invoicesState.find((inv) => inv.id === selectedInvoice.id),
              selectedInvoiceId: selectedInvoice.id
            });
            return currentInvoice;
          })()}
          client={clients.find((c) => c.id === selectedInvoice.clientId)}
          products={products}
          onClose={() => setShowInvoiceDetailsModal(false)}
          onAddCart={async (cartName) => {
            const invoice = invoicesState.find(
              (inv) => inv.id === selectedInvoice.id
            );
            if (!invoice) throw new Error("Invoice not found");
            if (cartName.startsWith("__delete__")) {
              const cartId = cartName.replace("__delete__", "");
              const updatedCarts = invoice.carts.filter((c) => c.id !== cartId);
              try {
                await onUpdateInvoice(invoice.id, { carts: updatedCarts });
                // Small delay to ensure Firestore write is propagated
                await new Promise(resolve => setTimeout(resolve, 100));
                // The real-time listener will handle global updates
                return { id: cartId, name: "", isActive: false };
              } catch (error: any) {
                console.error("Error deleting cart:", error);
                throw new Error(`Failed to delete cart: ${error?.message || 'Unknown error'}`);
              }
            }
            if (cartName.startsWith("__edit__")) {
              const [_, cartId, ...nameParts] = cartName.split("__");
              const newName = nameParts.join("__");
              console.log("🔧 Cart editing request:", { cartId, oldName: invoice.carts.find(c => c.id === cartId)?.name, newName });
              
              const updatedCarts = invoice.carts.map((c) =>
                c.id === cartId ? { ...c, name: newName } : c
              );
              
              try {
                console.log("💾 Updating cart in Firestore...", { invoiceId: invoice.id, updatedCarts });
                await onUpdateInvoice(invoice.id, { carts: updatedCarts });
                console.log("✅ Cart update successful in Firestore");
                
                // Small delay to ensure Firestore write is propagated before real-time listener updates
                await new Promise(resolve => setTimeout(resolve, 100));
                // The real-time listener will automatically update the UI
                return { id: cartId, name: newName, isActive: true };
              } catch (error: any) {
                console.error("❌ Error updating cart name:", error);
                throw new Error(`Failed to update cart name: ${error?.message || 'Unknown error'}`);
              }
            }
            // --- Invoice Name Edit Logic ---
            if (cartName.startsWith("__invoice_name__")) {
              const newInvoiceName = cartName.replace("__invoice_name__", "");
              await onUpdateInvoice(invoice.id, { name: newInvoiceName });
              await refreshInvoices();
              return { id: invoice.id, name: newInvoiceName, isActive: true };
            }
            // --- Delivery Date Edit Logic ---
            if (cartName.startsWith("__delivery_date__")) {
              const newDeliveryDate = cartName.replace("__delivery_date__", "");
              const formattedDeliveryDate = newDeliveryDate 
                ? new Date(newDeliveryDate + "T00:00:00").toISOString()
                : undefined;
              await onUpdateInvoice(invoice.id, { 
                deliveryDate: formattedDeliveryDate
              });
              await refreshInvoices();
              return { id: invoice.id, name: cartName, isActive: true };
            }
            // --- Special Service Logic ---
            if (cartName.startsWith("__special_service__")) {
              const isRequested =
                cartName.replace("__special_service__", "") === "true";
              await onUpdateInvoice(invoice.id, {
                specialServiceRequested: isRequested,
                ...(isRequested ? {} : { specialServiceCost: 0 }),
              });
              await refreshInvoices();
              return { id: invoice.id, name: cartName, isActive: true };
            }
            if (cartName.startsWith("__special_service_cost__")) {
              const cost = Number(
                cartName.replace("__special_service_cost__", "")
              );
              await onUpdateInvoice(invoice.id, { specialServiceCost: cost });
              await refreshInvoices();
              return { id: invoice.id, name: cartName, isActive: true };
            }
            // Check for duplicate cart names and handle merging
            if (
              invoice.carts.some(
                (c) =>
                  c.name.trim().toLowerCase() === cartName.trim().toLowerCase()
              )
            ) {
              // Check if user wants to merge or create separate cart
              const userWantsToMerge = window.confirm(
                `A cart named "${cartName}" already exists.\n\n` +
                `Click OK to merge the items with the existing cart, or Cancel to create a separate cart with a numbered suffix.`
              );
              
              if (userWantsToMerge) {
                // Find the existing cart and return its ID for merging
                const existingCart = invoice.carts.find(
                  (c) => c.name.trim().toLowerCase() === cartName.trim().toLowerCase()
                );
                if (existingCart) {
                  return { id: existingCart.id, name: existingCart.name, isActive: true };
                }
              } else {
                // Create a cart with numbered suffix
                let suffix = 2;
                let newCartName = `${cartName} (${suffix})`;
                while (invoice.carts.some(c => c.name.trim().toLowerCase() === newCartName.trim().toLowerCase())) {
                  suffix++;
                  newCartName = `${cartName} (${suffix})`;
                }
                cartName = newCartName;
              }
            }
            const newCart = {
              id: Date.now().toString(),
              name: cartName,
              items: [],
              total: 0,
              createdAt: new Date().toISOString(),
              createdBy: user?.username || "Unknown",
            };
            await onUpdateInvoice(invoice.id, {
              carts: [...invoice.carts, newCart],
            });
            await refreshInvoices();
            return { id: newCart.id, name: newCart.name, isActive: true };
          }}
          onAddProductToCart={async (
            cartId: string,
            prodId: string,
            quantity: number,
            _price?: number,
            itemIdx?: number
          ) => {
            const invoice = invoicesState.find(
              (inv) => inv.id === selectedInvoice.id
            );
            if (!invoice) return;
            const updatedCarts = invoice.carts.map((cart) => {
              if (cart.id !== cartId) return cart;
              let newItems;
              if (quantity === 0 && typeof itemIdx === "number") {
                // Remove only the entry at the given index with matching productId
                newItems = cart.items.filter(
                  (item, idx) => !(item.productId === prodId && idx === itemIdx)
                );
              } else {
                // Always add a new entry (do not merge with existing)
                let prodName = "";
                let prodPrice = 0;
                const prod = products.find((p) => p.id === prodId);
                if (prod) {
                  prodName = prod.name;
                  prodPrice = prod.price;
                }
                newItems = [
                  ...cart.items,
                  {
                    productId: prodId,
                    productName: prodName,
                    quantity: quantity,
                    price: prodPrice,
                    addedBy: user?.username || "Unknown",
                    addedAt: new Date().toISOString(),
                  },
                ];
              }
              
              // For item additions, mark cart as needing reprint
              const updatedCart = { ...cart, items: newItems };
              if (quantity > 0) {
                updatedCart.needsReprint = true;
                updatedCart.lastModifiedAt = new Date().toISOString();
                updatedCart.lastModifiedBy = user?.username || "Unknown";
              }
              
              return updatedCart;
            });
            
            // Update local state immediately for instant UI feedback
            setInvoicesState(prevInvoices => 
              prevInvoices.map(inv => 
                inv.id === invoice.id 
                  ? { ...inv, carts: updatedCarts }
                  : inv
              )
            );
            
            // Update selected invoice if modal is open
            if (showInvoiceDetailsModal && selectedInvoice?.id === invoice.id) {
              setSelectedInvoice(prev => prev ? { ...prev, carts: updatedCarts } : null);
            }
            
            // Persist to Firestore
            await onUpdateInvoice(invoice.id, { carts: updatedCarts });
            
            // Mark cart as modified for reprint tracking when adding items
            if (quantity > 0) {
              await markCartAsModified(invoice.id, cartId, user?.username || "Unknown");
            }
            
            await refreshInvoices();
          }}
          onUpdateInvoice={onUpdateInvoice}
          refreshInvoices={refreshInvoices}
        />
      )}

      {/* Verification Modal */}
      {verifyInvoiceId && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Verify Laundry Ticket Items</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setVerifyInvoiceId(null)}
                ></button>
              </div>
              <div className="modal-body">
                {(() => {
                  const invoice = invoices.find(
                    (inv) => inv.id === verifyInvoiceId
                  );
                  if (!invoice) return null;
                  return invoice.carts.map((cart) => (
                    <div key={cart.id} className="mb-3">
                      <div className="fw-bold mb-1">{cart.name}</div>
                      <ul className="list-group">
                        {cart.items.map((item) => (
                          <li
                            key={item.productId}
                            className="list-group-item d-flex align-items-center"
                          >
                            <input
                              type="checkbox"
                              className="form-check-input me-2"
                              checked={
                                !!verifyChecks[cart.id]?.[item.productId]
                              }
                              onChange={() =>
                                toggleVerifyCheck(cart.id, item.productId)
                              }
                            />
                            <span>
                              {item.productName}{" "}
                              <span className="text-muted">
                                x{item.quantity}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ));
                })()}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setVerifyInvoiceId(null)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-success"
                  onClick={handleVerifyDone}
                  disabled={!anyVerified()}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two-Step Completion Modal */}
      {showCompletionModal && completionInvoiceId && (() => {
        const invoice = invoices.find(inv => inv.id === completionInvoiceId);
        const client = clients.find(c => c.id === invoice?.clientId);
        const completedPosition = getCompletedOptionPosition(client!);
        
        return (
          <div
            className="modal show"
            style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
          >
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-clipboard-check me-2"></i>
                    Select Completion Parts
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowCompletionModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <p className="text-muted mb-3">
                    Select which parts of the work are completed for this laundry ticket:
                  </p>
                  
                  <div className={`row g-3 ${completedPosition === 'both' ? '' : 'justify-content-center'}`}>
                    {/* Mangles - Arriba (Top) section */}
                    {(completedPosition === 'top' || completedPosition === 'both') && (
                      <div className={completedPosition === 'both' ? 'col-md-6' : 'col-md-8'}>
                        <div className="card h-100">
                          <div className="card-body text-center">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="manglesCheckbox"
                                checked={selectedCompletionParts.mangles}
                                onChange={(e) =>
                                  setSelectedCompletionParts(prev => ({
                                    ...prev,
                                    mangles: e.target.checked
                                  }))
                                }
                              />
                              <label className="form-check-label fs-5 fw-bold" htmlFor="manglesCheckbox">
                                Mangles - Arriba
                              </label>
                            </div>
                            <p className="text-muted mt-2 small">Top part of the invoice</p>
                            <div className="mt-3">
                              <div 
                                className="border rounded p-2"
                                style={{ 
                                  backgroundColor: selectedCompletionParts.mangles ? '#fef3c7' : '#f8f9fa',
                                  borderColor: selectedCompletionParts.mangles ? '#f59e0b' : '#dee2e6',
                                  height: '40px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}
                              >
                                {selectedCompletionParts.mangles ? 'TOP COMPLETED' : 'TOP SECTION'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Doblado - Abajo (Bottom) section */}
                    {(completedPosition === 'bottom' || completedPosition === 'both') && (
                      <div className={completedPosition === 'both' ? 'col-md-6' : 'col-md-8'}>
                        <div className="card h-100">
                          <div className="card-body text-center">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="dobladoCheckbox"
                                checked={selectedCompletionParts.doblado}
                                onChange={(e) =>
                                  setSelectedCompletionParts(prev => ({
                                    ...prev,
                                    doblado: e.target.checked
                                  }))
                                }
                              />
                              <label className="form-check-label fs-5 fw-bold" htmlFor="dobladoCheckbox">
                                Doblado - Abajo
                              </label>
                            </div>
                            <p className="text-muted mt-2 small">Bottom part of the invoice</p>
                            <div className="mt-3">
                              <div 
                                className="border rounded p-2"
                                style={{ 
                                  backgroundColor: selectedCompletionParts.doblado ? '#fef3c7' : '#f8f9fa',
                                  borderColor: selectedCompletionParts.doblado ? '#f59e0b' : '#dee2e6',
                                  height: '40px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}
                              >
                                {selectedCompletionParts.doblado ? 'BOTTOM COMPLETED' : 'BOTTOM SECTION'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                
                <div className="mt-4">
                  {/* Dynamic alerts based on client setting and selections */}
                  {completedPosition === 'both' && selectedCompletionParts.mangles && selectedCompletionParts.doblado && (
                    <div className="alert alert-success" role="alert">
                      <i className="bi bi-check-circle-fill me-2"></i>
                      Both parts completed! This invoice will be marked as fully completed.
                    </div>
                  )}
                  {completedPosition === 'top' && selectedCompletionParts.mangles && (
                    <div className="alert alert-success" role="alert">
                      <i className="bi bi-check-circle-fill me-2"></i>
                      Top part completed! This invoice will be marked as completed.
                    </div>
                  )}
                  {completedPosition === 'bottom' && selectedCompletionParts.doblado && (
                    <div className="alert alert-success" role="alert">
                      <i className="bi bi-check-circle-fill me-2"></i>
                      Bottom part completed! This invoice will be marked as completed.
                    </div>
                  )}
                  {completedPosition === 'both' && (selectedCompletionParts.mangles || selectedCompletionParts.doblado) && 
                   !(selectedCompletionParts.mangles && selectedCompletionParts.doblado) && (
                    <div className="alert alert-warning" role="alert">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      Partial completion. The invoice will not be available for approval until both parts are completed.
                    </div>
                  )}
                  {((completedPosition === 'top' && !selectedCompletionParts.mangles) ||
                    (completedPosition === 'bottom' && !selectedCompletionParts.doblado) ||
                    (completedPosition === 'both' && !selectedCompletionParts.mangles && !selectedCompletionParts.doblado)) && (
                    <div className="alert alert-info" role="alert">
                      <i className="bi bi-info-circle-fill me-2"></i>
                      Select {completedPosition === 'both' ? 'at least one part' : 'the available part'} to mark as completed.
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCompletionModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleApplyCompletion}
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Print Options Modal */}
      {showPrintOptionsModal &&
        (() => {
          const invoice = invoices.find(
            (inv) => inv.id === showPrintOptionsModal
          );
          const client = clients.find((c) => c.id === invoice?.clientId);
          return (
            <div
              className="modal show"
              style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
            >
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Print Options</h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setShowPrintOptionsModal(null)}
                    ></button>
                  </div>
                  <div className="modal-body">
                    <p>
                      Laundry Ticket has been approved! Choose what you'd like to
                      print:
                    </p>

                    <div className="d-grid gap-3">
                      {/* Print Individual Carts */}
                      <div className="border rounded p-3">
                        <h6 className="mb-3">Print Individual Cart Contents</h6>
                        {invoice?.carts.map((cart) => (
                          <button
                            key={cart.id}
                            className="btn btn-outline-primary me-2 mb-2"
                            onClick={() => {
                              setShowCartPrintModal({
                                invoiceId: invoice.id,
                                cartId: cart.id,
                              });
                              setShowPrintOptionsModal(null);
                            }}
                          >
                            Print "{cart.name}"
                          </button>
                        ))}
                      </div>

                      {/* Print Full Invoice */}
                      <div className="border rounded p-3">
                        <h6 className="mb-3">Print/Email Complete Laundry Ticket</h6>
                        <button
                          className="btn btn-primary me-2"
                          onClick={() => {
                            setShowInvoicePrintModal(invoice?.id || null);
                            setShowPrintOptionsModal(null);
                          }}
                        >
                          Print Complete Laundry Ticket
                        </button>
                        {client?.printConfig?.emailSettings?.enabled && (
                          <button
                            className="btn btn-success"
                            onClick={async () => {
                              // Email invoice functionality
                              if (client.email && invoice) {
                                try {
                                  // Auto-send email based on client configuration
                                  alert(
                                    `Email sent to ${client.email} (functionality to be implemented)`
                                  );
                                } catch (error) {
                                  alert("Error sending email");
                                }
                              } else {
                                alert("Client email not configured");
                              }
                              setShowPrintOptionsModal(null);
                            }}
                          >
                            Email Laundry Ticket
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowPrintOptionsModal(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Cart Print Modal */}
      {showCartPrintModal &&
        (() => {
          const invoice = invoices.find(
            (inv) => inv.id === showCartPrintModal.invoiceId
          );
          const cart = invoice?.carts.find(
            (c) => c.id === showCartPrintModal.cartId
          );
          const client = clients.find((c) => c.id === invoice?.clientId);

          if (!invoice || !cart) return null;

          // Apply client print configuration defaults
          const printConfig = client?.printConfig?.cartPrintSettings || {
            enabled: true,
            showProductDetails: true,
            showQuantities: true,
            showPrices: false,
            showCartTotal: true,
            includeTimestamp: true,
            headerText: "Cart Contents",
            footerText: "",
            logoUrl: "/images/King Uniforms Logo.png", // Added missing logoUrl property
          };

          return (
            <div
              className="modal show"
              style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
            >
              <div className="modal-dialog modal-xl">
                <div className="modal-content">
                  <div className="modal-header d-print-none">
                    <h5 className="modal-title">Print Cart: {cart.name}</h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setShowCartPrintModal(null)}
                    ></button>
                  </div>
                  <div className="modal-body">
                    <div className="row">
                      {/* Standard A4 Print Preview */}
                      <div className="col-md-8">
                        <h6 className="mb-3">📄 Standard Print Preview (A4)</h6>
                        <div
                          id="cart-print-area"
                          style={{
                            border: "2px solid #ddd",
                            borderRadius: "8px",
                            padding: "10px",
                            background: "#fff",
                            maxHeight: "500px",
                            overflowY: "auto",
                          }}
                        >
                          <div
                            style={{
                              maxWidth: "8.5in",
                              margin: "0 auto",
                              background: "#fff",
                              padding: 20,
                              fontFamily: "Arial, sans-serif",
                            }}
                          >
                            {/* Header */}
                            <div
                              style={{ textAlign: "center", marginBottom: 20 }}
                            >
                              <h2
                                style={{ color: "#0E62A0", marginBottom: 10 }}
                              >
                                {printConfig.headerText || "Cart Contents"}
                              </h2>
                              <div style={{ fontSize: 14, color: "#666" }}>
                                <strong>Laundry Ticket:</strong> #
                                {invoice.invoiceNumber || invoice.id} |
                                <strong> Client:</strong> {invoice.clientName} |
                                <strong> Cart:</strong> {cart.name}
                                {printConfig.includeTimestamp && (
                                  <div style={{ marginTop: 5 }}>
                                    <strong>Printed:</strong>{" "}
                                    {new Date().toLocaleString()}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Cart Items */}
                            <table
                              style={{
                                width: "100%",
                                borderCollapse: "collapse",
                                marginBottom: 20,
                              }}
                            >
                              <thead>
                                <tr
                                  style={{ borderBottom: "2px solid #0E62A0" }}
                                >
                                  {printConfig.showProductDetails && (
                                    <th
                                      style={{
                                        textAlign: "left",
                                        padding: 8,
                                        fontWeight: "bold",
                                      }}
                                    >
                                      Product
                                    </th>
                                  )}
                                  {printConfig.showQuantities && (
                                    <th
                                      style={{
                                        textAlign: "center",
                                        padding: 8,
                                        fontWeight: "bold",
                                      }}
                                    >
                                      Quantity
                                    </th>
                                  )}
                                  {printConfig.showPrices && (
                                    <th
                                      style={{
                                        textAlign: "right",
                                        padding: 8,
                                        fontWeight: "bold",
                                      }}
                                    >
                                      Price
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {cart.items.map((item, index) => (
                                  <tr
                                    key={index}
                                    style={{ borderBottom: "1px solid #eee" }}
                                  >
                                    {printConfig.showProductDetails && (
                                      <td style={{ padding: 8 }}>
                                        {item.productName}
                                      </td>
                                    )}
                                    {printConfig.showQuantities && (
                                      <td
                                        style={{
                                          textAlign: "center",
                                          padding: 8,
                                        }}
                                      >
                                        {item.quantity}
                                      </td>
                                    )}
                                    {printConfig.showPrices && (
                                      <td
                                        style={{
                                          textAlign: "right",
                                          padding: 8,
                                        }}
                                      >
                                        ${item.price.toFixed(2)}
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                              {printConfig.showCartTotal && (
                                <tfoot>
                                  <tr
                                    style={{
                                      borderTop: "2px solid #0E62A0",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    <td
                                      colSpan={printConfig.showPrices ? 2 : 1}
                                      style={{ padding: 8 }}
                                    >
                                      Total Items:
                                    </td>
                                    <td
                                      style={{
                                        textAlign: printConfig.showPrices
                                          ? "right"
                                          : "center",
                                        padding: 8,
                                      }}
                                    >
                                      {cart.items.reduce(
                                        (sum, item) => sum + item.quantity,
                                        0
                                      )}
                                    </td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>

                            {/* Footer */}
                            {printConfig.footerText && (
                              <div
                                style={{
                                  textAlign: "center",
                                  fontSize: 12,
                                  color: "#666",
                                  marginTop: 20,
                                }}
                              >
                                {printConfig.footerText}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 3-inch Receipt Printer Preview */}
                      <div className="col-md-4">
                        <h6 className="mb-3">🧾 3" Receipt Printer Preview</h6>
                        <div
                          id="receipt-print-area"
                          style={{
                            border: "2px solid #333",
                            borderRadius: "8px",
                            background: "#fff",
                            width: "3in",
                            maxHeight: "500px",
                            overflowY: "auto",
                            padding: "8px",
                            fontSize: "11px",
                            fontFamily: "monospace",
                            lineHeight: "1.2",
                          }}
                        >
                          {/* Receipt Header */}
                          <div
                            style={{
                              textAlign: "center",
                              marginBottom: "8px",
                              borderBottom: "1px dashed #333",
                              paddingBottom: "4px",
                            }}
                          >
                            <div
                              style={{ fontWeight: "bold", fontSize: "12px" }}
                            >
                              {(printConfig as any)?.logoUrl ? (
                                <img
                                  src={(printConfig as any).logoUrl}
                                  alt="Logo"
                                  style={{ maxHeight: 80 }}
                                />
                              ) : (
                                <div
                                  style={{
                                    fontSize: 24,
                                    fontWeight: "bold",
                                    color: "#0E62A0",
                                  }}
                                >
                                  {printConfig.headerText || "King Uniforms"}
                                </div>
                              )}
                            </div>
                            <div style={{ fontSize: "10px", marginTop: "2px" }}>
                              INV: #{invoice.invoiceNumber || invoice.id}
                            </div>
                            <div style={{ fontSize: "10px" }}>
                              CLIENT: {invoice.clientName}
                            </div>
                            <div style={{ fontSize: "10px" }}>
                              CART: {cart.name}
                            </div>
                            {printConfig.includeTimestamp && (
                              <div
                                style={{ fontSize: "9px", marginTop: "2px" }}
                              >
                                {new Date().toLocaleString()}
                              </div>
                            )}
                          </div>

                          {/* Receipt Items */}
                          <div style={{ marginBottom: "8px" }}>
                            {cart.items.map((item, index) => (
                              <div
                                key={index}
                                style={{
                                  marginBottom: "3px",
                                  borderBottom: "1px dotted #ccc",
                                  paddingBottom: "2px",
                                }}
                              >
                                {printConfig.showProductDetails && (
                                  <div
                                    style={{
                                      fontWeight: "bold",
                                      fontSize: "10px",
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    {item.productName}
                                  </div>
                                )}
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: "10px",
                                  }}
                                >
                                  {printConfig.showQuantities && (
                                    <span>QTY: {item.quantity}</span>
                                  )}
                                  {printConfig.showPrices && (
                                    <span>${item.price.toFixed(2)}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Receipt Total */}
                          {printConfig.showCartTotal && (
                            <div
                              style={{
                                borderTop: "1px dashed #333",
                                paddingTop: "4px",
                                textAlign: "center",
                              }}
                            >
                              <div
                                style={{ fontWeight: "bold", fontSize: "11px" }}
                              >
                                TOTAL ITEMS:{" "}
                                {cart.items.reduce(
                                  (sum, item) => sum + item.quantity,
                                  0
                                )}
                              </div>
                            </div>
                          )}

                          {/* Receipt Footer */}
                          {printConfig.footerText && (
                            <div
                              style={{
                                textAlign: "center",
                                fontSize: "9px",
                                marginTop: "8px",
                                borderTop: "1px dashed #333",
                                paddingTop: "4px",
                                wordBreak: "break-word",
                              }}
                            >
                              {printConfig.footerText}
                            </div>
                          )}

                          {/* Receipt Cut Line */}
                          <div
                            style={{
                              textAlign: "center",
                              marginTop: "8px",
                              fontSize: "8px",
                              color: "#666",
                              borderTop: "1px dashed #333",
                              paddingTop: "4px",
                            }}
                          >
                            - - - - CUT HERE - - - -
                          </div>
                        </div>

                        <div className="mt-2">
                          <small className="text-muted d-block">
                            📏 Width: 3 inches (72mm)
                            <br />
                            🖨️ Typical thermal receipt printer format
                            <br />
                            📱 Monospace font for consistent spacing
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer d-print-none">
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowCartPrintModal(null)}
                    >
                      Close
                    </button>
                    <button
                      className="btn btn-outline-primary me-2"
                      onClick={() => {
                        const printContents =
                          document.getElementById(
                            "receipt-print-area"
                          )?.innerHTML;
                        if (printContents) {
                          const printWindow = window.open(
                            "",
                            "",
                            "height=800,width=600"
                          );
                          if (!printWindow) return;
                          setTimeout(() => {
                            printWindow.document.write(`
                            <html>
                              <head>
                                <title>Print Receipt: ${cart.name}</title>
                                <style>
                                  @media print {
                                    @page { size: 80mm auto; margin: 2mm; }
                                    body { 
                                      margin: 0; 
                                      font-family: monospace;
                                      font-size: 11px;
                                      line-height: 1.2;
                                      width: 72mm;
                                    }
                                    .d-print-none { display: none !important; }
                                  }
                                  body { background: #fff; }
                                </style>
                              </head>
                              <body>${printContents}</body>
                            </html>
                          `);
                            printWindow.document.close();
                            printWindow.focus();
                            printWindow.print();
                            printWindow.close();
                          }, 100);
                        }
                      }}
                    >
                      🧾 Print Receipt (3")
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        const printContents =
                          document.getElementById("cart-print-area")?.innerHTML;
                        if (printContents) {
                          const printWindow = window.open(
                            "",
                            "",
                            "height=800,width=600"
                          );
                          if (!printWindow) return;
                          setTimeout(() => {
                            printWindow.document.write(`
                            <html>
                              <head>
                                <title>Print Cart: ${cart.name}</title>
                                <style>
                                  @media print {
                                    @page { size: A4; margin: 0.5in; }
                                    body { margin: 0; }
                                    .d-print-none { display: none !important; }
                                  }
                                  body { background: #fff; }
                                </style>
                              </head>
                              <body>${printContents}</body>
                            </html>
                          `);
                            printWindow.document.close();
                            printWindow.focus();
                            printWindow.print();
                            printWindow.close();
                          }, 100);
                        }
                      }}
                    >
                      📄 Print Standard (A4)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Invoice Print Modal */}
      {showInvoicePrintModal &&
        (() => {
          const invoice = invoices.find(
            (inv) => inv.id === showInvoicePrintModal
          );
          const client = clients.find((c) => c.id === invoice?.clientId);

          if (!invoice) return null;

          // Apply client print configuration defaults
          const printConfig = client?.printConfig?.invoicePrintSettings || {
            enabled: true,
            showClientInfo: true,
            showInvoiceNumber: true,
            showDate: true,
            showPickupDate: false,
            showCartBreakdown: true,
            showProductSummary: true,
            showTotalWeight: false,
            showSubtotal: true,
            showTaxes: false,
            showGrandTotal: true,
            includeSignature: false,
            headerText: "Invoice",
            footerText: "",
            logoUrl: "/images/King Uniforms Logo.png",
          };

          // Calculate totals
          const productMap: { [productName: string]: number } = {};
          let grandTotal = 0;

          invoice.carts.forEach((cart) => {
            cart.items.forEach((item) => {
              if (!productMap[item.productName]) {
                productMap[item.productName] = 0;
              }
              productMap[item.productName] += item.quantity;
              grandTotal += item.quantity * item.price;
            });
          });

          return (
            <div
              className="modal show"
              style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
            >
              <div className="modal-dialog modal-xl">
                <div className="modal-content">
                  <div className="modal-header d-print-none">
                    <h5 className="modal-title">Print Laundry Ticket</h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setShowInvoicePrintModal(null)}
                    ></button>
                  </div>
                  <div className="modal-body" id="invoice-print-area">
                    <div
                      style={{
                        maxWidth: "8.5in",
                        margin: "0 auto",
                        background: "#fff",
                        padding: 30,
                        fontFamily: "Arial, sans-serif",
                        border: "1px solid #ddd",
                      }}
                    >
                      {/* Header with Logo */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 30,
                        }}
                      >
                        <div>
                          {printConfig.logoUrl ? (
                            <img
                              src={printConfig.logoUrl}
                              alt="Logo"
                              style={{ maxHeight: 80 }}
                            />
                          ) : (
                            <div
                              style={{
                                fontSize: 24,
                                fontWeight: "bold",
                                color: "#0E62A0",
                              }}
                            >
                              {printConfig.headerText || "King Uniforms"}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {printConfig.showInvoiceNumber && (
                            <h2 style={{ color: "#0E62A0", margin: 0 }}>
                              Invoice #{invoice.invoiceNumber || invoice.id}
                            </h2>
                          )}
                          {printConfig.showDate && (
                            <div
                              style={{
                                fontSize: 14,
                                color: "#666",
                                marginTop: 5,
                              }}
                            >
                              Date:{" "}
                              {invoice.date
                                ? new Date(invoice.date).toLocaleDateString()
                                : new Date().toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Client Information */}
                      {printConfig.showClientInfo && (
                        <div style={{ marginBottom: 30 }}>
                          <h4 style={{ color: "#0E62A0", marginBottom: 10 }}>
                            Bill To:
                          </h4>
                          <div style={{ fontSize: 16 }}>
                            <strong>{invoice.clientName}</strong>
                            {client?.email && (
                              <div style={{ fontSize: 14, color: "#666" }}>
                                Email: {client.email}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Cart Breakdown */}
                      {printConfig.showCartBreakdown && (
                        <div style={{ marginBottom: 30 }}>
                          <h4 style={{ color: "#0E62A0", marginBottom: 15 }}>
                            Cart Breakdown:
                          </h4>
                          {invoice.carts.map((cart, index) => (
                            <div
                              key={cart.id}
                              style={{
                                marginBottom: 20,
                                border: "1px solid #eee",
                                padding: 15,
                              }}
                            >
                              <h6
                                style={{ margin: "0 0 10px 0", color: "#333" }}
                              >
                                {cart.name}
                              </h6>
                              <table style={{ width: "100%", fontSize: 14 }}>
                                {cart.items.map((item, itemIndex) => (
                                  <tr key={itemIndex}>
                                    <td style={{ padding: "2px 0" }}>
                                      {item.productName}
                                    </td>
                                    <td
                                      style={{
                                        textAlign: "center",
                                        padding: "2px 0",
                                      }}
                                    >
                                      ×{item.quantity}
                                    </td>
                                    <td
                                      style={{
                                        textAlign: "right",
                                        padding: "2px 0",
                                      }}
                                    >
                                      ${(item.quantity * item.price).toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </table>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Product Summary */}
                      {printConfig.showProductSummary && (
                        <div style={{ marginBottom: 30 }}>
                          <h4 style={{ color: "#0E62A0", marginBottom: 15 }}>
                            Product Summary:
                          </h4>
                          <table
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                            }}
                          >
                            <thead>
                              <tr style={{ borderBottom: "2px solid #0E62A0" }}>
                                <th style={{ textAlign: "left", padding: 8 }}>
                                  Product
                                </th>
                                <th style={{ textAlign: "center", padding: 8 }}>
                                  Total Quantity
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(productMap).map(
                                ([productName, quantity]) => (
                                  <tr
                                    key={productName}
                                    style={{ borderBottom: "1px solid #eee" }}
                                  >
                                    <td style={{ padding: 8 }}>
                                      {productName}
                                    </td>
                                    <td
                                      style={{
                                        textAlign: "center",
                                        padding: 8,
                                      }}
                                    >
                                      {quantity}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Weight Information */}
                      {printConfig.showTotalWeight && invoice.totalWeight && (
                        <div style={{ marginBottom: 20 }}>
                          <strong>Total Weight:</strong> {invoice.totalWeight}{" "}
                          lbs
                        </div>
                      )}

                      {/* Totals */}
                      <div
                        style={{
                          borderTop: "2px solid #0E62A0",
                          paddingTop: 15,
                          textAlign: "right",
                        }}
                      >
                        {printConfig.showSubtotal && (
                          <div style={{ fontSize: 16, marginBottom: 5 }}>
                            <strong>Subtotal: ${grandTotal.toFixed(2)}</strong>
                          </div>
                        )}
                        {printConfig.showTaxes && (
                          <div
                            style={{
                              fontSize: 14,
                              marginBottom: 5,
                              color: "#666",
                            }}
                          >
                            Tax: $0.00
                          </div>
                        )}
                        {printConfig.showGrandTotal && (
                          <div
                            style={{
                              fontSize: 20,
                              fontWeight: "bold",
                              color: "#0E62A0",
                            }}
                          >
                            Total: ${grandTotal.toFixed(2)}
                          </div>
                        )}
                      </div>

                      {/* Signature Line */}
                      {printConfig.includeSignature && (
                        <div
                          style={{
                            marginTop: 40,
                            borderTop: "1px solid #ccc",
                            paddingTop: 20,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <div style={{ width: "45%" }}>
                              <div
                                style={{
                                  borderBottom: "1px solid #000",
                                  marginBottom: 5,
                                }}
                              >
                                &nbsp;
                              </div>
                              <div
                                style={{ fontSize: 12, textAlign: "center" }}
                              >
                                Customer Signature
                              </div>
                            </div>
                            <div style={{ width: "45%" }}>
                              <div
                                style={{
                                  borderBottom: "1px solid #000",
                                  marginBottom: 5,
                                }}
                              >
                                &nbsp;
                              </div>
                              <div
                                style={{ fontSize: 12, textAlign: "center" }}
                              >
                                Date
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      {printConfig.footerText && (
                        <div
                          style={{
                            textAlign: "center",
                            fontSize: 12,
                            color: "#666",
                            marginTop: 30,
                            borderTop: "1px solid #eee",
                            paddingTop: 15,
                          }}
                        >
                          {printConfig.footerText}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="modal-footer d-print-none">
                    <button
                      className="btn btn-secondary me-2"
                      onClick={() => setShowInvoicePrintModal(null)}
                    >
                      Close
                    </button>
                    <button
                      className="btn btn-success me-2"
                      onClick={async () => {
                        // Email functionality
                        if (
                          client?.email &&
                          client.printConfig?.emailSettings?.enabled
                        ) {
                          try {
                            // Validate email settings
                            const validation = validateEmailSettings(
                              client,
                              client.printConfig.emailSettings
                            );
                            if (!validation.isValid) {
                              alert(
                                "Email configuration error:\n" +
                                  validation.errors.join("\n")
                              );
                              return;
                            }

                            // Generate PDF attachment if needed
                            let pdfContent: string | undefined;
                            try {
                              pdfContent = await generateInvoicePDF(
                                client,
                                invoice,
                                printConfig
                              );
                            } catch (error) {
                              console.error("Failed to generate PDF:", error);
                              // Continue without attachment
                            }

                            // Send email
                            const success = await sendInvoiceEmail(
                              client,
                              invoice,
                              client.printConfig.emailSettings,
                              pdfContent
                            );

                            if (success) {
                              // Update email status in invoice
                              const emailStatusUpdate = {
                                emailStatus: {
                                  ...invoice.emailStatus,
                                  approvalEmailSent: true,
                                  approvalEmailSentAt: new Date().toISOString(),
                                  lastEmailError: undefined,
                                },
                              };

                              await onUpdateInvoice(
                                invoice.id,
                                emailStatusUpdate
                              );

                              alert(
                                `Invoice emailed successfully to ${client.email}`
                              );

                              // Log activity
                              await logActivity({
                                type: "Invoice",
                                message: `Invoice #${
                                  invoice.invoiceNumber || invoice.id
                                } emailed to ${client.name} (${client.email})`,
                              });
                            } else {
                              // Update email status with error
                              const emailStatusUpdate = {
                                emailStatus: {
                                  ...invoice.emailStatus,
                                  lastEmailError: "Failed to send manual email",
                                },
                              };

                              await onUpdateInvoice(
                                invoice.id,
                                emailStatusUpdate
                              );

                              alert("Failed to send email. Please try again.");
                            }
                          } catch (error) {
                            console.error("Email error:", error);
                            alert(
                              "Failed to send email. Please check your email configuration."
                            );
                          }
                        } else if (!client?.email) {
                          alert(
                            "Client email address is not configured. Please update the client profile."
                          );
                        } else {
                          alert(
                            "Email functionality is disabled for this client. Please check print configuration."
                          );
                        }
                      }}
                      disabled={
                        !client?.email ||
                        !client?.printConfig?.emailSettings?.enabled
                      }
                    >
                      📧 Email Invoice
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        const printContents =
                          document.getElementById(
                            "invoice-print-area"
                          )?.innerHTML;
                        if (printContents) {
                          const printWindow = window.open(
                            "",
                            "",
                            "height=800,width=600"
                          );
                          if (!printWindow) return;
                          setTimeout(() => {
                            printWindow.document.write(`
                            <html>
                              <head>
                                <title>Invoice #${
                                  invoice.invoiceNumber || invoice.id
                                }</title>
                                <style>
                                  @media print {
                                    @page { size: A4; margin: 0.5in; }
                                    body { margin: 0; }
                                    .d-print-none { display: none !important; }
                                  }
                                  body { background: #fff; }
                                </style>
                              </head>
                              <body>${printContents}</body>
                            </html>
                          `);
                            printWindow.document.close();
                            printWindow.focus();
                            printWindow.print();
                            printWindow.close();
                          }, 100);
                        }
                      }}
                    >
                      Print Invoice
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Footer with new color */}
      <footer
        style={{
          width: "100%",
          color: "#fff",
          textAlign: "center",
          padding: "1rem 0",
          marginTop: 40,
        }}
      >
        {/* Removed violet color note */}
      </footer>
    </div>
  );
}
