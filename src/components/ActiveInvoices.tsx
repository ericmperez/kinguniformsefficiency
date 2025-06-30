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
import {
  getAllPickupGroups,
  updatePickupGroupStatus,
  getManualConventionalProductsForDate,
  deleteManualConventionalProduct,
} from "../services/firebaseService";
import { updateDoc, doc } from "firebase/firestore";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { AuthContext, useAuth } from "./AuthContext";
import { getUsers } from "../services/firebaseService";
import type { UserRecord } from "../services/firebaseService";
import { db } from "../firebase";
import { getClientAvatarUrl } from "../services/firebaseService";
import { logActivity } from "../services/firebaseService";

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

  React.useEffect(() => {
    getUsers().then((userList) => setUsers(userList));
  }, []);

  // --- Verification State ---
  const [verifyInvoiceId, setVerifyInvoiceId] = useState<string | null>(null);
  const [verifyChecks, setVerifyChecks] = useState<{
    [cartId: string]: { [productId: string]: boolean };
  }>({});
  const [showVerifyIdModal, setShowVerifyIdModal] = useState(false);
  const [verifyIdError, setVerifyIdError] = useState("");
  const [partialVerifiedInvoices, setPartialVerifiedInvoices] = useState<{ [id: string]: boolean }>({});

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
    setPartialVerifiedInvoices((prev) => ({
      ...prev,
      [verifyInvoiceId]: !isFullyVerified && anyVerified(),
    }));
    const invoice = invoices.find((inv) => inv.id === verifyInvoiceId);
    if (invoice) {
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
    const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
    if (!invoice) return;
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
      const product = products.find((p) => p.id === selectedProduct);
      if (!product) return;
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
    onUpdateInvoice(selectedInvoiceId, { carts: updatedCarts });
    setQuantity("");
    setSelectedProduct("");
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
        message: `User ${user.username} opened Create New Invoice modal`,
        user: user.username,
      });
    }
  };

  // --- Cart Selection Handler ---
  const handleInvoiceClick = (invoiceId: string) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (invoice) {
      setSelectedInvoice(invoice);
      setShowInvoiceDetailsModal(true);
    }
  };

  // --- Cart Selection Modal Logic ---
  const handleCartSelect = async (cart: Cart) => {
    setSelectedInvoiceId(cartSelectInvoiceId);
    setNewCartName(cart.name);
    setCartItems(cart.items);
    setShowCartSelectModal(false);
    setShowCartModal(true);
    setIsCreatingCart(false);
  };

  const handleCartCreate = async (cartName: string) => {
    if (!cartSelectInvoiceId) return null;
    const invoice = invoices.find((inv) => inv.id === cartSelectInvoiceId);
    if (!invoice) return null;
    const trimmedName = cartName.trim();
    // Check for duplicate name (case-insensitive)
    const duplicate = invoice.carts.some(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      // Optionally show a toast or error (handled in modal)
      return null;
    }
    const newCart: Cart = {
      id: Date.now().toString(),
      name: trimmedName,
      items: [],
      total: 0,
      createdAt: new Date().toISOString(),
    };
    await onUpdateInvoice(cartSelectInvoiceId, {
      carts: [...(invoice.carts || []), newCart],
    });
    setCartSelectCarts([...(invoice.carts || []), newCart]);
    // Immediately select the new cart
    await handleCartSelect(newCart);
    return newCart;
  };

  // --- Delete Confirmation Logic ---
  const handleDeleteClick = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
  };

  const handleConfirmDelete = async () => {
    if (invoiceToDelete) {
      await onDeleteInvoice(invoiceToDelete.id);
      if (user?.username) {
        await logActivity({
          type: "Invoice",
          message: `User ${user.username} deleted invoice #${invoiceToDelete.invoiceNumber || invoiceToDelete.id}`,
          user: user.username,
        });
      }
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
    const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
    if (!invoice) return;
    let cartIdx = invoice.carts.findIndex((c) => c.id === selectedCartModalId);
    if (cartIdx === -1) {
      // If no cart selected, default to first cart
      cartIdx = 0;
    }
    if (cartIdx === -1) return; // No carts at all
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
    updatedCarts[cartIdx] = cart;
    await onUpdateInvoice(selectedInvoiceId, { carts: updatedCarts });
    if (user?.username) {
      await logActivity({
        type: "Invoice",
        message: `User ${user.username} added ${keypadQuantity} x '${productForKeypad.name}' to invoice #${selectedInvoiceId}`,
        user: user.username,
      });
    }
    setShowProductKeypad(false);
    setProductForKeypad(null);
    setKeypadQuantity(1);
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
      const invoice = invoices.find((inv) => inv.clientId === group.clientId);
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
    const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
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
  const [readyInvoices, setReadyInvoices] = useState<{ [id: string]: boolean }>({});

  // Handler for Ready button
  const handleReadyClick = async (invoiceId: string) => {
    setReadyInvoices((prev) => ({ ...prev, [invoiceId]: true }));
    // Optionally, persist this status in backend:
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (invoice) {
      await onUpdateInvoice(invoiceId, { status: 'ready' });
    }
  };

  // Shipped modal state
  const [showShippedModal, setShowShippedModal] = useState<string | null>(null);
  const [shippedTruckNumber, setShippedTruckNumber] = useState("");

  // Add at the top-level of the component:
  const [highlightColors, setHighlightColors] = useState<{ [invoiceId: string]: 'yellow' | 'blue' }>({});

  const getVerifierName = (verifierId: string) => {
    if (!verifierId) return "-";
    const found = users.find((u: UserRecord) => u.id === verifierId || u.username === verifierId);
    if (found) return found.username;
    // If already a name, just return
    if (verifierId.length > 4 || /[a-zA-Z]/.test(verifierId)) return verifierId;
    return verifierId;
  };

  // --- DEMO/TEST: Inject a fake overdue invoice if none exist ---
  const hasOverdue = invoices.some(inv => {
    if (!inv.date) return false;
    const created = new Date(inv.date);
    const now = new Date();
    return (now.getTime() - created.getTime()) > 24 * 60 * 60 * 1000;
  });
  let demoInvoices = invoices;
  if (!hasOverdue && invoices.length > 0) {
    // Clone the first invoice and set its date to 2 days ago
    const demo = { ...invoices[0], id: 'demo-overdue', clientName: 'Demo Overdue Client', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() };
    demoInvoices = [demo, ...invoices];
  }

  return (
    <div className="container-fluid py-4">
      <div className="row">
        <div className="col-md-6">
          <h3 className="mb-4">Active Invoices</h3>
        </div>
        <div className="col-md-6 text-md-end">
          <button className="btn btn-primary" onClick={handleAddInvoice}>
            Create New Invoice
          </button>
        </div>
      </div>

      <div className="row">
        {invoices.filter(inv => inv.status !== 'done').length === 0 ? (
          <div className="text-center text-muted py-5">
            No active invoices found. Create a new invoice to get started.
          </div>
        ) : (
          invoices
            .filter(inv => inv.status !== 'done')
            .sort((a, b) => {
              if (a.invoiceNumber && b.invoiceNumber) {
                return a.invoiceNumber - b.invoiceNumber;
              }
              if (a.date && b.date) {
                return new Date(a.date).getTime() - new Date(b.date).getTime();
              }
              return a.id.localeCompare(b.id);
            })
            .map((invoice, idx) => {
              const client = clients.find((c) => c.id === invoice.clientId);
              const avatarSrc = getClientAvatarUrl(client || {});
              const isReady = invoice.status === 'ready' || readyInvoices[invoice.id];
              const isVerified = invoice.verified;
              const isPartiallyVerified = invoice.partiallyVerified || partialVerifiedInvoices[invoice.id];
              // Determine highlight color for this invoice
              const highlight = highlightColors[invoice.id] || 'blue';
              // Compute background based on highlight color and status
              let cardBackground = '';
              if (isVerified) {
                cardBackground = 'linear-gradient(135deg, #bbf7d0 0%, #22c55e 100%)'; // green
              } else if (isPartiallyVerified) {
                cardBackground = 'linear-gradient(135deg, #fef9c3 0%, #fde047 100%)'; // yellow for partial
              } else if (isReady) {
                cardBackground = 'linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)'; // yellow
              } else if (highlight === 'yellow') {
                cardBackground = 'linear-gradient(135deg, #fde68a 0%, #fbbf24 100%)'; // yellow
              } else {
                cardBackground = 'linear-gradient(135deg, #6ee7b7 0%, #3b82f6 100%)'; // blue
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

              return (
                <div
                  key={invoice.id}
                  className={`col-lg-4 col-md-6 mb-4${isOverdue ? ' overdue-blink' : ''}`}
                  onMouseEnter={() => setHoveredInvoiceId(invoice.id)}
                  onMouseLeave={() => setHoveredInvoiceId(null)}
                >
                  <div
                    className={`modern-invoice-card shadow-lg${isOverdue ? ' overdue-blink' : ''}`}
                    style={{
                      borderRadius: 24,
                      background: cardBackground,
                      color: '#222',
                      boxShadow: '0 8px 32px 0 rgba(0,0,0,0.10)',
                      border: 'none',
                      position: 'relative',
                      minHeight: 380,
                      maxWidth: 340,
                      margin: '60px auto 0 auto',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
                      padding: '2.5rem 1.5rem 1.5rem 1.5rem',
                      transition: 'background 0.3s',
                    }}
                    onClick={() => handleInvoiceClick(invoice.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleInvoiceClick(invoice.id);
                      }
                    }}
                  >
                    {/* Delete button in top left corner */}
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
                          fontSize: 24,
                          color: (invoice.carts || []).some(c => c.name.toUpperCase().startsWith('CARRO SIN NOMBRE')) ? 'red' : '#222',
                          marginBottom: 4,
                        }}
                      >
                        {client?.name || invoice.clientName}
                      </div>
                      <div
                        style={{ fontSize: 15, color: "#555", marginBottom: 0 }}
                      >
                        Active Invoice
                      </div>
                    </div>
                    {/* Product summary (total qty per product) */}
                    <div style={{ margin: '12px 0 0 0', width: '100%' }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#0ea5e9', marginBottom: 2 }}>Products</div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 15 }}>
                        {(() => {
                          // Build product totals across all carts
                          const productTotals: { [productId: string]: { name: string; qty: number } } = {};
                          (invoice.carts || []).forEach(cart => {
                            (cart.items || []).forEach(item => {
                              if (!productTotals[item.productId]) {
                                productTotals[item.productId] = { name: item.productName, qty: 0 };
                              }
                              productTotals[item.productId].qty += Number(item.quantity) || 0;
                            });
                          });
                          // Show all products with qty > 0
                          return Object.values(productTotals)
                            .filter(p => p.qty > 0)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((prod, idx) => (
                              <li key={prod.name + idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                                <span>{prod.name}</span>
                                <span style={{ fontWeight: 800 }}>{prod.qty}</span>
                              </li>
                            ));
                        })()}
                      </ul>
                    </div>
                    {/* Social-style action buttons */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 24,
                        right: 24,
                        display: 'flex',
                        flexDirection: 'row',
                        gap: 10,
                        zIndex: 10,
                      }}
                    >
                      {/* Mark as Ready button (now toggles highlight color) */}
                      <button
                        className="btn btn-warning btn-sm"
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
                        onClick={e => {
                          e.stopPropagation();
                          setHighlightColors(prev => ({
                            ...prev,
                            [invoice.id]: prev[invoice.id] === 'yellow' ? 'blue' : 'yellow',
                          }));
                          if (user?.username) {
                            logActivity({
                              type: "Invoice",
                              message: `User ${user.username} toggled highlight for invoice #${invoice.id}`,
                              user: user.username,
                            });
                          }
                        }}
                        title={highlight === 'yellow' ? 'Highlight: Yellow' : 'Highlight: Blue'}
                      >
                        <i className="bi bi-flag-fill" style={{ color: highlight === 'yellow' ? '#fbbf24' : '#0E62A0', fontSize: 22 }} />
                      </button>
                      {/* Verified button */}
                      <button
                        className="btn btn-success btn-sm"
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
                        onClick={e => {
                          e.stopPropagation();
                          if (hasUnnamedCart(invoice)) {
                            alert('Cannot verify invoice: A cart is named "CARRO SIN NOMBRE". Please rename all carts.');
                            return;
                          }
                          setVerifyInvoiceId(invoice.id); // open verify modal
                          // Build initial check state for modal
                          const checks: Record<string, Record<string, boolean>> = {};
                          for (const cart of invoice.carts) {
                            checks[cart.id] = {};
                            for (const item of cart.items) {
                              checks[cart.id][item.productId] = false;
                            }
                          }
                          setVerifyChecks(checks);
                        }}
                        disabled={invoice.verified || hasUnnamedCart(invoice)}
                        title={invoice.verified ? "Verified" : hasUnnamedCart(invoice) ? 'Cannot verify with "CARRO SIN NOMBRE" cart' : "Verify"}
                      >
                        <i className="bi bi-check-lg" style={{ color: invoice.verified ? '#22c55e' : '#166534', fontSize: 22 }} />
                      </button>
                      {/* Shipped button */}
                      <button
                        className="btn btn-info btn-sm"
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
                        onClick={e => {
                          e.stopPropagation();
                          if (hasUnnamedCart(invoice)) {
                            alert('Cannot ship invoice: A cart is named "CARRO SIN NOMBRE". Please rename all carts.');
                            return;
                          }
                          setShowShippedModal(invoice.id);
                          setShippedTruckNumber("");
                        }}
                        disabled={invoice.status === 'done' || hasUnnamedCart(invoice)}
                        title={invoice.status === 'done' ? "Shipped" : hasUnnamedCart(invoice) ? 'Cannot ship with "CARRO SIN NOMBRE" cart' : "Mark as Shipped"}
                      >
                        <i className="bi bi-truck" style={{ color: '#0ea5e9', fontSize: 22 }} />
                      </button>
                    </div>
                    {/* Show verification status and details on invoice card */}
                    {(invoice.verified || invoice.partiallyVerified) && (
                      <div style={{ marginTop: 8 }}>
                        <span style={{ fontWeight: 700, color: invoice.verified ? '#22c55e' : '#fbbf24' }}>
                          {invoice.verified ? 'Fully Verified' : 'Partially Verified'}
                        </span>
                        {invoice.verifiedBy && (
                          <span style={{ marginLeft: 12, color: '#888', fontWeight: 500 }}>
                            Verifier: {getVerifierName(invoice.verifiedBy)}
                          </span>
                        )}
                        {invoice.verifiedAt && (
                          <span style={{ marginLeft: 12, color: '#888', fontWeight: 500 }}>
                            Date: {new Date(invoice.verifiedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ); // <-- close map function
            })
        )}
      </div>

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
                <h5 className="modal-title">Invoice Cart</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCartModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                {/* Cart log at the top */}
                {(() => {
                  const invoice = invoices.find(
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
                  const invoice = invoices.find(
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
                          <div key={cart.id} className="mb-2">
                            <div className="fw-bold">{cart.name}</div>
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
                      const invoice = invoices.find(
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
                              {/* Show product image or icon */}
                              {(() => {
                                const name = product.name.toLowerCase();
                                if (name.includes("scrub shirt") || name.includes("scrub top") || name.includes("scrub")) {
                                  return (
                                    <img
                                      src={"/images/products/scrubshirt.png"}
                                      alt="Scrub Shirt"
                                      style={{ width: "100%", height: 90, objectFit: "contain", borderRadius: 8 }}
                                    />
                                  );
                                }
                                if (product.imageUrl) {
                                  return (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.name}
                                      style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 8 }}
                                    />
                                  );
                                }
                                return null;
                              })()}
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
                      const invoice = invoices.find(
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
                      const invoice = invoices.find(
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
                  const invoice = invoices.find(
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
                        {log.timestamp
                          ? new Date(log.timestamp).toLocaleString()
                          : "-"}{" "}
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
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowLogModal(false)}
                >
                  Close
                </button>
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
                        await import("../firebase").then(({ db }) =>
                          import("firebase/firestore").then(
                            ({ doc, updateDoc }) =>
                              updateDoc(
                                doc(db, "pickup_groups", pendingGroup.id),
                                {
                                  status: "Pending Products",
                                }
                              )
                          )
                        );
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

      {/* Shipped Modal */}
      {showShippedModal && (
        <div className="modal show" style={{ display: 'block', background: 'rgba(0,0,0,0.3)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Enter Truck Number</h5>
                <button type="button" className="btn-close" onClick={() => setShowShippedModal(null)}></button>
              </div>
              <div className="modal-body">
                <input
                  type="number"
                  className="form-control"
                  placeholder="Truck Number"
                  value={shippedTruckNumber}
                  onChange={e => setShippedTruckNumber(e.target.value.replace(/[^0-9]/g, ""))}
                  min={1}
                  autoFocus
                />
              </div>
                           <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowShippedModal(null)}>Cancel</button>
                <button
                  className="btn btn-info"
                  disabled={!shippedTruckNumber}
                  onClick={async () => {
                    // Update invoice and group status to done, store truck number
                    const invoice = invoices.find(inv => inv.id === showShippedModal);
                    if (!invoice) return;
                    await onUpdateInvoice(invoice.id, { status: 'done', truckNumber: shippedTruckNumber });
                    if (user?.username) {
                      await logActivity({
                        type: "Invoice",
                        message: `User ${user.username} marked invoice #${invoice.id} as shipped (Truck #${shippedTruckNumber})`,
                        user: user.username,
                      });
                    }
                    // Update group status if invoice has pickupGroupId
                    if (invoice.pickupGroupId) {
                      try {
                        const { updatePickupGroupStatus } = await import("../services/firebaseService");
                        const group = pickupGroups.find(g => g.id === invoice.pickupGroupId);
                        if (group) {
                          await updatePickupGroupStatus(invoice.pickupGroupId, 'done');
                        }
                      } catch (err) {
                        console.error("Error updating group status:", err);
                      }
                    }
                    setShowShippedModal(null);
                  }}
                >
                  Ship
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
            const invoice = invoices.find((inv) => inv.id === selectedInvoiceId);
            if (!invoice) throw new Error("Invoice not found");
            // Handle delete cart
            if (cartName.startsWith("__delete__")) {
              const cartId = cartName.replace("__delete__", "");
              const updatedCarts = invoice.carts.filter((c) => c.id !== cartId);
              await onUpdateInvoice(invoice.id, { carts: updatedCarts });
              return { id: cartId, name: '', isActive: false };
            }
            // Handle edit cart name
            if (cartName.startsWith("__edit__")) {
              const [_, cartId, ...nameParts] = cartName.split("__");
              const newName = nameParts.join("__");
              const updatedCarts = invoice.carts.map((c) =>
                c.id === cartId ? { ...c, name: newName } : c
              );
              await onUpdateInvoice(invoice.id, { carts: updatedCarts });
              return { id: cartId, name: newName, isActive: true };
            }
            // Prevent duplicate cart names
            if (invoice.carts.some(c => c.name.trim().toLowerCase() === cartName.trim().toLowerCase())) {
              throw new Error("Duplicate cart name");
            }
            const newCart = {
              id: Date.now().toString(),
              name: cartName,
              items: [],
              total: 0,
              createdAt: new Date().toISOString(),
            };
            await onUpdateInvoice(invoice.id, { carts: [...invoice.carts, newCart] });
            return { id: newCart.id, name: newCart.name, isActive: true };
          }}
        />
      )}

      {/* Invoice Details Modal */}
      {showInvoiceDetailsModal && selectedInvoice && (
        <InvoiceDetailsModal
          invoice={selectedInvoice}
          client={clients.find((c) => c.id === selectedInvoice.clientId)}
          products={products}
          onClose={() => setShowInvoiceDetailsModal(false)}
          onAddCart={async (cartName) => {
            // Find invoice by id
            const invoice = invoices.find((inv) => inv.id === selectedInvoice.id);
            if (!invoice) throw new Error("Invoice not found");
            // Handle delete cart
            if (cartName.startsWith("__delete__")) {
              const cartId = cartName.replace("__delete__", "");
              const updatedCarts = invoice.carts.filter((c) => c.id !== cartId);
              await onUpdateInvoice(invoice.id, { carts: updatedCarts });
              return { id: cartId, name: '', isActive: false };
            }
            // Handle edit cart name
            if (cartName.startsWith("__edit__")) {
              const [_, cartId, ...nameParts] = cartName.split("__");
              const newName = nameParts.join("__");
              const updatedCarts = invoice.carts.map((c) =>
                c.id === cartId ? { ...c, name: newName } : c
              );
              await onUpdateInvoice(invoice.id, { carts: updatedCarts });
              return { id: cartId, name: newName, isActive: true };
            }
            // Prevent duplicate cart names
            if (invoice.carts.some(c => c.name.trim().toLowerCase() === cartName.trim().toLowerCase())) {
              throw new Error("Duplicate cart name");
            }
            const newCart = {
              id: Date.now().toString(),
              name: cartName,
              items: [],
              total: 0,
              createdAt: new Date().toISOString(),
            };
            await onUpdateInvoice(invoice.id, { carts: [...invoice.carts, newCart] });
            return { id: newCart.id, name: newCart.name, isActive: true };
          }}
          onAddProductToCart={(cartId, productId, quantity) => {
            // Find invoice by id
            const invoice = invoices.find((inv) => inv.id === selectedInvoice.id);
            if (!invoice) return;
            const updatedCarts = invoice.carts.map((cart) => {
              if (cart.id !== cartId) return cart;
              const existingIdx = cart.items.findIndex((item) => item.productId === productId);
              let newItems;
              if (existingIdx > -1) {
                newItems = cart.items.map((item, idx) =>
                  idx === existingIdx
                    ? {
                        ...item,
                        quantity: (Number(item.quantity) || 0) + quantity,
                      }
                    : item
                );
              } else {
                const prod = products.find((p) => p.id === productId);
                newItems = [
                  ...cart.items,
                  {
                    productId: productId,
                    productName: prod ? prod.name : '',
                    quantity: quantity,
                    price: prod ? prod.price : 0,
                    addedBy: 'You',
                  },
                ];
              }
              return { ...cart, items: newItems };
            });
            onUpdateInvoice(invoice.id, { carts: updatedCarts });
          }}
        />
      )}

      {/* Verification Modal */}
      {verifyInvoiceId && (
        <div className="modal show" style={{ display: 'block', background: 'rgba(0,0,0,0.3)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Verify Invoice Items</h5>
                <button type="button" className="btn-close" onClick={() => setVerifyInvoiceId(null)}></button>
              </div>
              <div className="modal-body">
                {(() => {
                  const invoice = invoices.find(inv => inv.id === verifyInvoiceId);
                  if (!invoice) return null;
                  return invoice.carts.map(cart => (
                    <div key={cart.id} className="mb-3">
                      <div className="fw-bold mb-1">{cart.name}</div>
                      <ul className="list-group">
                        {cart.items.map(item => (
                          <li key={item.productId} className="list-group-item d-flex align-items-center">
                            <input
                              type="checkbox"
                              className="form-check-input me-2"
                              checked={!!verifyChecks[cart.id]?.[item.productId]}
                              onChange={() => toggleVerifyCheck(cart.id, item.productId)}
                            />
                            <span>{item.productName} <span className="text-muted">x{item.quantity}</span></span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ));
                })()}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setVerifyInvoiceId(null)}>Cancel</button>
                <button className="btn btn-success" onClick={handleVerifyDone} disabled={!anyVerified()}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
