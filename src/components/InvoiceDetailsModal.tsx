import React from "react";
import { Invoice, Product, Client, Cart, CartItem, LaundryCart, PrintConfiguration } from "../types";
import { getUsers, UserRecord, logActivity } from "../services/firebaseService";
import { useAuth } from "./AuthContext";
import { formatDateSpanish, formatDateOnlySpanish } from "../utils/dateFormatter";
import { useCartEditor } from "./CartEditHandler";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { transformClientNameForDisplay, shouldAlwaysShowQuantities, isOncologicoClient, isChildrensHospitalClient, isExcludedFromQuantities } from "../utils/clientNameUtils";
import { useCartMerger, CartMergeModal } from "./CartMergeUtility";

interface InvoiceDetailsModalProps {
  invoice: Invoice;
  onClose: () => void;
  client: Client | undefined;
  products: Product[];
  onAddCart: (cartName: string) => Promise<LaundryCart>;
  onAddProductToCart: (
    cartId: string,
    productId: string,
    quantity: number,
    price?: number,
    itemIdx?: number
  ) => void;
  onUpdateInvoice: (invoiceId: string, updates: Partial<Invoice>) => Promise<void>;
  refreshInvoices?: () => Promise<void>;
}

const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  invoice,
  onClose,
  client,
  products,
  onAddCart,
  onAddProductToCart,
  onUpdateInvoice,
  refreshInvoices,
}) => {
  // Add debugging for incoming invoice data
  console.log("📥 InvoiceDetailsModal received invoice update:", {
    invoiceId: invoice.id,
    carts: invoice.carts?.map(c => ({ id: c.id, name: c.name })),
    timestamp: new Date().toISOString()
  });

  // Force re-render counter for debugging
  const [rerenderCounter, setRerenderCounter] = React.useState(0);
  
  // Add invoice change detection
  React.useEffect(() => {
    console.log("🔄 Invoice prop changed, forcing component re-render");
    setRerenderCounter(prev => prev + 1);
  }, [invoice]);

  // State for local invoice data to enable instant UI updates
  const [localInvoice, setLocalInvoice] = React.useState(invoice);

  // Initialize the cart editor with direct Firebase operations
  const cartEditor = useCartEditor(localInvoice, setLocalInvoice);

  const [newCartName, setNewCartName] = React.useState("");
  const [addProductCartId, setAddProductCartId] = React.useState<string | null>(
    null
  );
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [productQty, setProductQty] = React.useState(1);
  const [showNewCartInput, setShowNewCartInput] = React.useState(false);
  const [showCartKeypad, setShowCartKeypad] = React.useState(false);
  const [showProductKeypad, setShowProductKeypad] = React.useState<null | {
    cartId: string;
    productId: string;
  }>(null);
  const [keypadQty, setKeypadQty] = React.useState<string>("");

  // Product confirmation state
  const [showAddConfirmation, setShowAddConfirmation] = React.useState(false);
  const [confirmationProduct, setConfirmationProduct] = React.useState<{
    cartId: string;
    productId: string;
    product: Product | null;
    quantity: number;
    addCallback: () => Promise<void>;
  } | null>(null);

  // Invoice-level quantity toggle state
  const [showQuantitiesForThisInvoice, setShowQuantitiesForThisInvoice] = React.useState(true);

  // Local state for carts to enable instant UI update
  const [localCarts, setLocalCarts] = React.useState(invoice.carts);
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const { user } = useAuth();

  // Initialize cart merger hook
  const cartMerger = useCartMerger(localInvoice, setLocalInvoice);

  // Cart merge modal state
  const [showCartMergeModal, setShowCartMergeModal] = React.useState(false);
  const [cartsToMerge, setCartsToMerge] = React.useState<Cart[]>([]);

  // Checklist modal state
  const [showChecklistModal, setShowChecklistModal] = React.useState(false);

  // Special service confirmation state
  const [showSpecialServiceConfirmation, setShowSpecialServiceConfirmation] = React.useState(false);
  const [pendingSpecialServiceState, setPendingSpecialServiceState] = React.useState<boolean>(false);

  // Helper function to get current user safely
  const getCurrentUser = () => {
    try {
      if (user?.username) {
        return user.username;
      }
      const storedUser = JSON.parse(localStorage.getItem("auth_user") || "null");
      return storedUser?.username || storedUser?.id || "Unknown";
    } catch {
      return "Unknown";
    }
  };

  // Helper function to check if user can modify special service
  const canModifySpecialService = () => {
    return user?.role === "Supervisor" || user?.role === "Admin" || user?.role === "Owner";
  };

  // Helper function to handle special service confirmation
  const handleSpecialServiceToggle = (isChecked: boolean) => {
    setPendingSpecialServiceState(isChecked);
    setShowSpecialServiceConfirmation(true);
  };

  // Helper function to confirm special service change
  const confirmSpecialServiceChange = async () => {
    await onAddCart(`__special_service__${pendingSpecialServiceState}`);
    if (refreshInvoices) await refreshInvoices();
    setShowSpecialServiceConfirmation(false);
  };

  // Helper function to mark cart as printed
  const markCartAsPrinted = async (cartId: string) => {
    const currentUser = getCurrentUser();
    const now = new Date().toISOString();
    
    const updatedCarts = localInvoice.carts.map(cart => {
      if (cart.id === cartId) {
        return {
          ...cart,
          lastPrintedAt: now,
          lastPrintedBy: currentUser,
          needsReprint: false
        };
      }
      return cart;
    });

    const updatedInvoice = { ...localInvoice, carts: updatedCarts };
    setLocalInvoice(updatedInvoice);

    // Update in database using proper invoice update
    try {
      await onUpdateInvoice(localInvoice.id, { carts: updatedCarts });
      
      // Refresh parent data to update indicators instantly
      if (refreshInvoices) {
        await refreshInvoices();
      }
      
      // Close print modal
      setShowCartPrintModal(null);
      
      console.log("✅ Cart marked as printed successfully:", { cartId, user: currentUser, timestamp: now });
    } catch (error) {
      console.error("Failed to update cart print status:", error);
      // Revert local state on error
      setLocalInvoice(localInvoice);
    }
  };

  // Helper function to mark cart as modified (needs reprint)
  const markCartAsModified = async (cartId: string) => {
    const currentUser = getCurrentUser();
    const now = new Date().toISOString();
    
    const updatedCarts = localInvoice.carts.map(cart => {
      if (cart.id === cartId) {
        return {
          ...cart,
          lastModifiedAt: now,
          lastModifiedBy: currentUser,
          needsReprint: true
        };
      }
      return cart;
    });

    const updatedInvoice = { ...localInvoice, carts: updatedCarts };
    setLocalInvoice(updatedInvoice);

    // Update in database using proper invoice update
    try {
      await onUpdateInvoice(localInvoice.id, { carts: updatedCarts });
      console.log("✅ Cart marked as modified successfully:", { cartId, user: currentUser, timestamp: now });
    } catch (error) {
      console.error("Failed to update cart modification status:", error);
      // Revert local state on error
      setLocalInvoice(localInvoice);
    }
  };

  // Helper function to check if all carts are printed and ready for shipping
  const areAllCartsPrintedAndReady = () => {
    if (localInvoice.carts.length === 0) return false;
    
    return localInvoice.carts.every(cart => {
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
  };

  // Get visual status for a cart
  const getCartStatus = (cart: Cart) => {
    if (!cart.lastPrintedAt) {
      return { 
        status: 'not-printed', 
        text: 'NOT PRINTED', 
        icon: '🚫', 
        color: '#dc3545',
        bgColor: '#fff5f5' 
      };
    }
    
    if (cart.needsReprint || 
        (cart.lastModifiedAt && cart.lastPrintedAt && 
         new Date(cart.lastModifiedAt) > new Date(cart.lastPrintedAt))) {
      return { 
        status: 'needs-reprint', 
        text: 'NEEDS REPRINT', 
        icon: '⚠️', 
        color: '#fd7e14',
        bgColor: '#fff8f0' 
      };
    }
    
    return { 
      status: 'printed', 
      text: 'PRINTED', 
      icon: '✅', 
      color: '#198754',
      bgColor: '#f0fff4' 
    };
  };

  // --- Invoice Name Editing ---
  const [editingInvoiceName, setEditingInvoiceName] = React.useState(false);
  const [invoiceName, setInvoiceName] = React.useState(invoice.name || "");
  const [savingInvoiceName, setSavingInvoiceName] = React.useState(false);

  // --- Delivery Date Editing ---
  const [editingDeliveryDate, setEditingDeliveryDate] = React.useState(false);
  const [deliveryDate, setDeliveryDate] = React.useState(invoice.deliveryDate || "");
  const [savingDeliveryDate, setSavingDeliveryDate] = React.useState(false);

  // --- Cart Print Modal State ---
  const [showCartPrintModal, setShowCartPrintModal] = React.useState<{
    cartId: string;
  } | null>(null);

  // Sync local invoice with prop changes
  React.useEffect(() => {
    console.log("🔄 Syncing localInvoice with invoice prop:", {
      invoiceId: invoice.id,
      timestamp: new Date().toISOString()
    });
    setLocalInvoice(invoice);
  }, [invoice]);

  // Sync local carts with local invoice changes
  React.useEffect(() => {
    const currentCartData = localCarts.map(c => `${c.id}:${c.name}`).sort().join('|');
    const newCartData = (localInvoice.carts || []).map(c => `${c.id}:${c.name}`).sort().join('|');
    
    if (currentCartData !== newCartData) {
      console.log("🔄 Syncing localCarts with localInvoice.carts - changes detected:", {
        invoiceId: localInvoice.id,
        fromInvoice: localInvoice.carts?.map(c => ({ id: c.id, name: c.name })),
        currentLocal: localCarts?.map(c => ({ id: c.id, name: c.name })),
        timestamp: new Date().toISOString()
      });
      
      // Create deep copy to ensure React recognizes the change
      const newCarts = localInvoice.carts ? localInvoice.carts.map(cart => ({ 
        ...cart,
        items: cart.items ? [...cart.items] : []
      })) : [];
      
      setLocalCarts(newCarts);
      
      console.log("✅ Updated localCarts:", newCarts.map(c => ({ id: c.id, name: c.name })));
    } else {
      console.log("🔄 Cart sync skipped - no changes detected");
    }
  }, [localInvoice.carts, localInvoice.id]);

  React.useEffect(() => {
    getUsers().then(setUsers);
  }, []);

  React.useEffect(() => {
    setInvoiceName(invoice.name || "");
  }, [invoice.name]);

  // Helper function to convert date to YYYY-MM-DD format for date input
  const formatDateForInput = (dateString: string): string => {
    if (!dateString) return "";
    
    try {
      // Parse the date (handles both ISO strings and YYYY-MM-DD format)
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      
      // Return in YYYY-MM-DD format for HTML date input
      return date.toISOString().slice(0, 10);
    } catch (error) {
      console.warn("Error formatting date for input:", dateString, error);
      return "";
    }
  };

  React.useEffect(() => {
    setDeliveryDate(formatDateForInput(invoice.deliveryDate || ""));
  }, [invoice.deliveryDate]);

  const getVerifierName = (verifierId: string) => {
    if (!verifierId) return "-";
    const found = users.find(
      (u) => u.id === verifierId || u.username === verifierId
    );
    if (found) return found.username;
    if (verifierId.length > 4 || /[a-zA-Z]/.test(verifierId)) return verifierId;
    return verifierId;
  };

  // Get only products associated with this client
  const clientProducts = React.useMemo(() => {
    if (!client) return [];
    return products.filter((p) => client.selectedProducts.includes(p.id));
  }, [client, products]);

  // Determine delivery timestamp (lockedAt, verifiedAt, or deliveredAt if present)
  const deliveryTimestamp =
    invoice.lockedAt ||
    invoice.verifiedAt ||
    (invoice as any).deliveredAt ||
    null;

  // Helper to check if item was added after delivery
  function isItemAddedAfterDelivery(item: any) {
    if (!deliveryTimestamp || !item.addedAt) return false;
    return (
      new Date(item.addedAt).getTime() > new Date(deliveryTimestamp).getTime()
    );
  }

  // Helper: keypad buttons
  const keypadButtons = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "0",
    "←",
    "OK",
  ];

  // Save invoice name to Firestore
  const handleSaveInvoiceName = async () => {
    if (!invoiceName.trim() || invoiceName === invoice.name) {
      setEditingInvoiceName(false);
      return;
    }
    setSavingInvoiceName(true);
    try {
      // Use onAddCart with special key to trigger invoice name update
      if (typeof onAddCart === "function") {
        // This is a hack: pass a special string to onAddCart to trigger invoice name update in parent
        await onAddCart(`__invoice_name__${invoiceName.trim()}`);
      }
      if (refreshInvoices) await refreshInvoices();
    } finally {
      setSavingInvoiceName(false);
      setEditingInvoiceName(false);
    }
  };

  // Save delivery date to Firestore
  const handleSaveDeliveryDate = async () => {
    // Convert delivery date to ISO format to match invoice.date format
    const currentFormattedDate = invoice.deliveryDate 
      ? new Date(invoice.deliveryDate).toISOString().slice(0, 10)
      : "";
    
    if (deliveryDate === currentFormattedDate) {
      setEditingDeliveryDate(false);
      return;
    }
    
    setSavingDeliveryDate(true);
    try {
      // Convert YYYY-MM-DD to ISO string format to match other dates in the system
      const formattedDeliveryDate = deliveryDate 
        ? new Date(deliveryDate + "T00:00:00").toISOString()
        : "";
      
      // Use onAddCart with special key to trigger delivery date update
      if (typeof onAddCart === "function") {
        await onAddCart(`__delivery_date__${deliveryDate}`);
      }
      if (refreshInvoices) await refreshInvoices();
    } finally {
      setSavingDeliveryDate(false);
      setEditingDeliveryDate(false);
    }
  };

  // Handler to delete a product from a cart
  const handleDeleteCartItem = async (
    cartId: string,
    productId: string,
    itemIdx: number
  ) => {
    const updatedCarts = localCarts.map((cart) => {
      if (cart.id !== cartId) return cart;
      return {
        ...cart,
        items: cart.items.filter(
          (item, idx) => !(item.productId === productId && idx === itemIdx)
        ),
      };
    });
    setLocalCarts(updatedCarts);
    
    // Mark cart as modified when items are deleted
    await markCartAsModified(cartId);
    
    // Persist change
    await onAddProductToCart(cartId, productId, 0, undefined, itemIdx);
    if (refreshInvoices) await refreshInvoices();
  };

  // Print All Carts functionality
  const printAllCarts = () => {
    if (localCarts.length === 0) {
      alert("No carts to print");
      return;
    }

    // Get client print configuration with defaults
    const defaultCartPrintSettings: PrintConfiguration['cartPrintSettings'] = {
      enabled: true,
      showProductDetails: true,
      showProductSummary: false,
      showQuantities: true,
      showPrices: false,
      showCartTotal: true,
      includeTimestamp: true,
      headerText: "Cart Contents",
      footerText: "",
      clientNameFontSize: "large",
    };
    const printConfig = client?.printConfig?.cartPrintSettings || defaultCartPrintSettings;

    // Helper function to get client name font size
    const getClientNameFontSize = () => {
      switch (printConfig.clientNameFontSize) {
        case 'small': return '28px';
        case 'medium': return '35px';
        case 'large': return '45px';
        default: return '35px'; // fallback to medium
      }
    };

    // Show quantities based on client-specific print configuration
    // Priority: 1) Client's print config setting, 2) Global toggle for this invoice, 3) Oncologico special case
    const shouldShowQuantities = (printConfig.showQuantities && showQuantitiesForThisInvoice) || 
                                 isOncologicoClient(localInvoice.clientName) || 
                                 isChildrensHospitalClient(localInvoice.clientName);

    // Generate HTML content for all carts with optimized 2-column layout and fixed page size
    const generateAllCartsContent = () => {
      return localCarts.map((cart, index) => {
        const cartIndex = localInvoice.carts.findIndex(c => c.id === cart.id);
        const cartPosition = cartIndex + 1;
        const totalCarts = localInvoice.carts.length;

        // Split items into two columns only if there are more than 5 items
        const shouldUseTwoColumns = cart.items.length > 5;
        const splitItemsIntoColumns = (items: CartItem[]) => {
          if (!shouldUseTwoColumns) {
            return { column1: items, column2: [] };
          }
          const itemsPerColumn = Math.ceil(items.length / 2);
          const column1 = items.slice(0, itemsPerColumn);
          const column2 = items.slice(itemsPerColumn);
          return { column1, column2 };
        };

        const { column1, column2 } = splitItemsIntoColumns(cart.items);

        return `
          <div style="page-break-after: ${index < localCarts.length - 1 ? 'always' : 'auto'};">
            <div style="
              width: 8in;
              height: 5in;
              margin: 0 auto;
              background: #fff;
              padding: 15px;
              font-family: Arial, sans-serif;
              font-size: 12px;
              position: relative;
              overflow: hidden;
              box-sizing: border-box;
            ">
              <!-- Header Section (Fixed Height: ~0.8in) -->
              <div style="
                height: 0.8in;
                border-bottom: 1px solid #333;
                padding-bottom: 8px;
                position: relative;
                margin-bottom: 12px;
              ">
                <!-- Cart Position - Top Right -->
                <div style="
                  position: absolute;
                  top: 0;
                  right: 0;
                  font-size: 14px;
                  font-weight: bold;
                  color: #0E62A0;
                ">
                  ${cartPosition}/${totalCarts}
                </div>

                <!-- Cart Name - Top Left -->
                <div style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  font-size: 28px;
                  font-weight: bold;
                  color: #333;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  line-height: 1.1;
                ">
                  Cart #${cart.name}
                </div>

                <!-- Client Name & Ticket - Center -->
                <div style="
                  text-align: center;
                  margin-top: 35px;
                ">
                  <div style="
                    font-size: ${getClientNameFontSize()};
                    font-weight: bold;
                    color: #0E62A0;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 4px;
                  ">
                    ${transformClientNameForDisplay(localInvoice.clientName)}
                  </div>
                  <div style="
                    font-size: 14px;
                    font-weight: bold;
                    color: #333;
                  ">
                    Ticket #${localInvoice.invoiceNumber || localInvoice.id.substring(0, 8)}
                  </div>
                </div>
              </div>

              <!-- Products Section (Flexible Height: ~2.8in) -->
              <div style="
                height: 2.8in;
                overflow: hidden;
                margin-bottom: 12px;
              ">
                ${cart.items.length === 0 ? `
                  <p style="
                    font-style: italic; 
                    color: #666; 
                    font-size: 12px;
                    text-align: center;
                    margin-top: 40px;
                  ">
                    No items in this cart
                  </p>
                ` : `
                  <!-- Dynamic Product Layout: Single column for ≤5 items, Two columns for >5 items -->
                  ${shouldUseTwoColumns ? `
                    <div style="
                      display: flex;
                      gap: 15px;
                      height: 100%;
                    ">
                      <!-- Column 1 -->
                      <div style="
                        flex: 1;
                        overflow: hidden;
                      ">
                        <table style="
                          width: 100%;
                          border-collapse: collapse;
                          font-size: 10px;
                        ">
                          <thead>
                            <tr style="border-bottom: 1px solid #333;">
                              <th style="
                                text-align: left;
                                padding: 4px 2px;
                                font-size: 10px;
                                font-weight: bold;
                              ">Product</th>
                              ${shouldShowQuantities ? `
                                <th style="
                                  text-align: center;
                                  padding: 4px 2px;
                                  font-size: 10px;
                                  font-weight: bold;
                                  width: 30px;
                                ">Qty</th>
                              ` : ''}
                            </tr>
                          </thead>
                          <tbody>
                            ${column1.map((item) => `
                              <tr style="border-bottom: 1px solid #eee;">
                                <td style="
                                  padding: 3px 2px;
                                  font-size: 9px;
                                  line-height: 1.2;
                                  word-break: break-word;
                                ">${item.productName}</td>
                                ${shouldShowQuantities ? `
                                  <td style="
                                    padding: 3px 2px;
                                    text-align: center;
                                    font-size: 9px;
                                    font-weight: bold;
                                  ">${item.quantity}</td>
                                ` : ''}
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>

                      <!-- Column 2 -->
                      <div style="
                        flex: 1;
                        overflow: hidden;
                      ">
                        <table style="
                          width: 100%;
                          border-collapse: collapse;
                          font-size: 10px;
                        ">
                          <thead>
                            <tr style="border-bottom: 1px solid #333;">
                              <th style="
                                text-align: left;
                                padding: 4px 2px;
                                font-size: 10px;
                                font-weight: bold;
                              ">Product</th>
                              ${shouldShowQuantities ? `
                                <th style="
                                  text-align: center;
                                  padding: 4px 2px;
                                  font-size: 10px;
                                  font-weight: bold;
                                  width: 30px;
                                ">Qty</th>
                              ` : ''}
                            </tr>
                          </thead>
                          <tbody>
                            ${column2.map((item) => `
                              <tr style="border-bottom: 1px solid #eee;">
                                <td style="
                                  padding: 3px 2px;
                                  font-size: 9px;
                                  line-height: 1.2;
                                  word-break: break-word;
                                ">${item.productName}</td>
                                ${shouldShowQuantities ? `
                                  <td style="
                                    padding: 3px 2px;
                                    text-align: center;
                                    font-size: 9px;
                                    font-weight: bold;
                                  ">${item.quantity}</td>
                                ` : ''}
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ` : `
                    <!-- Single Column Layout for 5 or fewer items -->
                    <div style="
                      height: 100%;
                      overflow: hidden;
                    ">
                      <table style="
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 11px;
                      ">
                        <thead>
                          <tr style="border-bottom: 1px solid #333;">
                            <th style="
                              text-align: left;
                              padding: 6px 4px;
                              font-size: 11px;
                              font-weight: bold;
                            ">Product</th>
                            ${shouldShowQuantities ? `
                              <th style="
                                text-align: center;
                                padding: 6px 4px;
                                font-size: 11px;
                                font-weight: bold;
                                width: 60px;
                              ">Qty</th>
                            ` : ''}
                          </tr>
                        </thead>
                        <tbody>
                          ${column1.map((item) => `
                            <tr style="border-bottom: 1px solid #eee;">
                              <td style="
                                padding: 5px 4px;
                                font-size: 10px;
                                line-height: 1.3;
                                word-break: break-word;
                              ">${item.productName}</td>
                              ${shouldShowQuantities ? `
                                <td style="
                                  padding: 5px 4px;
                                  text-align: center;
                                  font-size: 10px;
                                  font-weight: bold;
                                ">${item.quantity}</td>
                              ` : ''}
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                `}
              </div>

              <!-- Footer Section (Fixed at bottom) -->
              <div style="
                position: absolute;
                bottom: 15px;
                left: 15px;
                right: 15px;
              ">
                <!-- Custom Footer Text -->
                ${printConfig.footerText ? `
                  <div style="
                    text-align: center;
                    font-size: 9px;
                    color: #666;
                    margin-bottom: 8px;
                    border-top: 1px solid #ddd;
                    padding-top: 6px;
                  ">
                    ${printConfig.footerText}
                  </div>
                ` : ''}

                <!-- Delivery Date - Always at Bottom -->
                ${localInvoice.deliveryDate ? `
                  <div style="
                    text-align: center;
                    font-size: 14px;
                    font-weight: bold;
                    color: #0E62A0;
                    background-color: #f0f8ff;
                    padding: 8px;
                    border: 2px solid #0E62A0;
                    border-radius: 6px;
                  ">
                    DELIVERY DATE: ${formatDateOnlySpanish(localInvoice.deliveryDate)}
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    };

    // Open print window with all carts using EXACT same approach as individual print
    const printWindow = window.open("", "", "height=800,width=600");
    if (!printWindow) {
      alert("Please allow popups to print all carts");
      return;
    }

    setTimeout(async () => {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print All Carts - ${transformClientNameForDisplay(localInvoice.clientName)}</title>
            <style>
              @media print {
                @page { size: 8.5in 5.5in landscape; margin: 0.25in; }
                body { margin: 0; }
                .d-print-none { display: none !important; }
                * { 
                  -webkit-print-color-adjust: exact !important;
                  color-adjust: exact !important;
                }
              }
              body { font-family: Arial, sans-serif; }
            </style>
          </head>
          <body>${generateAllCartsContent()}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      
      // Mark all carts as printed after print dialog
      await markAllCartsAsPrinted();
    }, 100);
  };

  // Helper function to mark all carts as printed in one operation
  const markAllCartsAsPrinted = async () => {
    const currentUser = getCurrentUser();
    const now = new Date().toISOString();
    
    const updatedCarts = localInvoice.carts.map(cart => ({
      ...cart,
      lastPrintedAt: now,
      lastPrintedBy: currentUser,
      needsReprint: false
    }));

    // Record "Print All Carts" tracking information
    const lastPrintAllCarts = {
      printedBy: currentUser,
      printedAt: now,
      cartCount: localInvoice.carts.length
    };

    const updatedInvoice = { 
      ...localInvoice, 
      carts: updatedCarts,
      printHistory: {
        ...localInvoice.printHistory,
        lastPrintAllCarts: lastPrintAllCarts
      }
    };
    setLocalInvoice(updatedInvoice);

    // Update in database using proper invoice update
    try {
      await onUpdateInvoice(localInvoice.id, { 
        carts: updatedCarts,
        printHistory: {
          ...localInvoice.printHistory,
          lastPrintAllCarts: lastPrintAllCarts
        }
      });
      
      // Refresh parent data to update indicators instantly
      if (refreshInvoices) {
        await refreshInvoices();
      }
      
      console.log("✅ All carts marked as printed successfully:", { 
        cartCount: localInvoice.carts.length, 
        user: currentUser, 
        timestamp: now,
        printAllCartsTracking: lastPrintAllCarts
      });
    } catch (error) {
      console.error("Failed to update cart print status:", error);
      // Revert local state on error
      setLocalInvoice(localInvoice);
    }
  };

  // Add logActivity to cart creation (new cart and default cart)
  const handleAddCart = async (cartName: string) => {
    const newCart: LaundryCart = await onAddCart(cartName);
    if (typeof logActivity === "function") {
      await logActivity({
        type: "Cart",
        message: `Cart '${cartName}' created in invoice #${
          invoice.invoiceNumber || invoice.id
        }'`,
        user: user?.username,
      });
    }
    return newCart;
  };

  // Force re-render trigger for cart name updates
  const [cartNamesVersion, setCartNamesVersion] = React.useState(0);
  
  // Create a stable cart names string for change detection
  const cartNamesSnapshot = React.useMemo(() => {
    return (localCarts || []).map(c => `${c.id}:${c.name}`).join('|');
  }, [localCarts]);
  
  // Trigger re-render when cart names change
  React.useEffect(() => {
    setCartNamesVersion(prev => prev + 1);
    console.log("🔄 Cart names changed, version:", cartNamesVersion + 1, "snapshot:", cartNamesSnapshot);
  }, [cartNamesSnapshot]);

  const [showCreateCartConfirm, setShowCreateCartConfirm] = React.useState(false);
  const [pendingCartName, setPendingCartName] = React.useState("");

  return (
    <>
      <div
        className="modal show"
        style={{
          display: "flex",
          alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.3)",
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 2000,
        overflowY: "auto",
      }}
      onClick={(e) => {
        // Only close if the click is on the overlay, not inside the modal-dialog
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal-dialog invoice-details-modal"
        style={{
          margin: "auto",
          maxWidth: "70vw",
          width: "70vw",
          minWidth: 320,
          pointerEvents: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {invoice.clientName} - Laundry Ticket #{invoice.invoiceNumber}
              {editingInvoiceName ? (
                <span style={{ marginLeft: 16 }}>
                  <input
                    type="text"
                    className="form-control d-inline-block"
                    style={{ width: 220, display: "inline-block" }}
                    value={invoiceName}
                    onChange={(e) => setInvoiceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveInvoiceName();
                      if (e.key === "Escape") setEditingInvoiceName(false);
                    }}
                    autoFocus
                    disabled={savingInvoiceName}
                  />
                  <button
                    className="btn btn-success btn-sm ms-2"
                    onClick={handleSaveInvoiceName}
                    disabled={savingInvoiceName || !invoiceName.trim()}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-secondary btn-sm ms-2"
                    onClick={() => setEditingInvoiceName(false)}
                    disabled={savingInvoiceName}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <>
                  {invoice.name && (
                    <span
                      style={{
                        marginLeft: 16,
                        fontWeight: 600,
                        color: "#0E62A0",
                        fontSize: 18,
                      }}
                    >
                      {invoice.name}
                    </span>
                  )}
                  <button
                    className="btn btn-outline-primary btn-sm ms-2"
                    title="Edit Laundry Ticket Name"
                    onClick={() => setEditingInvoiceName(true)}
                  >
                    <i className="bi bi-pencil" />
                  </button>
                </>
              )}
            </h5>
            
            {/* Special Service Checkbox - Top Right Corner of Invoice */}
            {canModifySpecialService() && (
              <div className="d-flex align-items-center me-3">
                <div className="form-check mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="invoiceSpecialService"
                    checked={invoice.specialServiceRequested || false}
                    onChange={(e) => handleSpecialServiceToggle(e.target.checked)}
                    style={{
                      transform: 'scale(1.3)',
                      accentColor: '#0E62A0'
                    }}
                  />
                  <label
                    className="form-check-label text-primary fw-bold ms-2"
                    htmlFor="invoiceSpecialService"
                    style={{ 
                      fontSize: '14px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Special Service
                  </label>
                </div>
              </div>
            )}
            
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            <h6>Client: {invoice.clientName}</h6>
            <h6>
              Date: {invoice.date ? formatDateSpanish(invoice.date) : "-"}
            </h6>
            {/* Delivery Date - LARGE PROMINENT DISPLAY */}
            <div className="mb-4" style={{
              background: 'linear-gradient(135deg, #fff3e0 0%, #ffcc80 100%)',
              borderRadius: '16px',
              padding: '20px',
              border: '3px solid #ff9800',
              boxShadow: '0 8px 24px rgba(255, 152, 0, 0.15)'
            }}>
              <div className="d-flex align-items-center justify-content-center">
                <h3 className="mb-0" style={{ 
                  color: '#e65100',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginRight: '16px'
                }}>
                  Delivery Date:
                </h3>
                {editingDeliveryDate ? (
                  <span>
                    <input
                      type="date"
                      className="form-control d-inline-block"
                      style={{ width: 180, display: "inline-block", fontSize: '18px', fontWeight: 600 }}
                      value={formatDateForInput(deliveryDate)}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveDeliveryDate();
                        if (e.key === "Escape") setEditingDeliveryDate(false);
                      }}
                      autoFocus
                      disabled={savingDeliveryDate}
                    />
                    <button
                      className="btn btn-success btn-sm ms-2"
                      onClick={handleSaveDeliveryDate}
                      disabled={savingDeliveryDate}
                    >
                      Save
                    </button>
                    <button
                      className="btn btn-secondary btn-sm ms-2"
                      onClick={() => setEditingDeliveryDate(false)}
                      disabled={savingDeliveryDate}
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <div className="d-flex align-items-center">
                    <h2 className="mb-0" style={{ 
                      color: '#e65100',
                      fontWeight: 800,
                      fontSize: '2.5rem',
                      textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      {invoice.deliveryDate ? formatDateSpanish(invoice.deliveryDate) : "Not set"}
                    </h2>
                    <button
                      className="btn btn-outline-primary btn-lg ms-3"
                      title="Edit Delivery Date"
                      onClick={() => setEditingDeliveryDate(true)}
                      style={{ fontSize: '1.2rem', padding: '8px 16px' }}
                    >
                      <i className="bi bi-pencil" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* Show verifier if present */}
            {invoice.verifiedBy && (
              <h6 className="text-success">
                Verificado por: {getVerifierName(invoice.verifiedBy)}
                {invoice.verifiedAt && (
                  <span
                    style={{ marginLeft: 12, color: "#888", fontWeight: 500 }}
                  >
                    ({formatDateSpanish(invoice.verifiedAt)})
                  </span>
                )}
              </h6>
            )}
            
            {/* Total Carts - LARGE PROMINENT DISPLAY */}
            <div className="text-center mb-4" style={{ 
              background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)', 
              borderRadius: '16px', 
              padding: '24px',
              border: '3px solid #0E62A0',
              boxShadow: '0 8px 24px rgba(14, 98, 160, 0.15)'
            }}>
              <h1 className="fw-bold mb-0" style={{ 
                fontSize: '4.5rem', 
                color: '#0E62A0',
                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'inline-block' 
              }}>
                {invoice.carts.length}
              </h1>
              <h4 className="mb-0" style={{ 
                display: 'inline-block', 
                marginLeft: '1rem', 
                verticalAlign: 'bottom',
                color: '#0E62A0',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                Total Cart{invoice.carts.length !== 1 ? 's' : ''}
              </h4>
            </div>
            
            {/* Show group weight if available on invoice or client */}
            {typeof invoice.totalWeight === "number" && (
              <h6 className="text-success">
                Group Weight: {invoice.totalWeight} lbs
              </h6>
            )}
            {client &&
              typeof (client as any).groupWeight === "number" &&
              !invoice.totalWeight && (
                <h6 className="text-success">
                  Group Weight: {(client as any).groupWeight} lbs
                </h6>
              )}
            {/* Show verification status and verifier if present */}
            {(invoice.verified || invoice.partiallyVerified) && (
              <div className="mb-2">
                <span
                  className={
                    invoice.verified
                      ? "badge bg-success"
                      : "badge bg-warning text-dark"
                  }
                >
                  {invoice.verified ? "Fully Verified" : "Partially Verified"}
                </span>
                {invoice.verifiedBy && (
                  <span className="ms-2 text-secondary">
                    Verifier: {getVerifierName(invoice.verifiedBy)}
                    {invoice.verifiedAt && (
                      <span style={{ marginLeft: 8 }}>
                        ({formatDateSpanish(invoice.verifiedAt)})
                      </span>
                    )}
                  </span>
                )}
              </div>
            )}
            <div className="mb-3">
              {!showNewCartInput ? (
                <>
                  <button
                    className="btn btn-primary me-2"
                    onClick={() => {
                      setShowNewCartInput(true);
                      setShowCartKeypad(true);
                      setNewCartName("");
                    }}
                  >
                    Create New Cart
                  </button>
                  {localCarts.length > 0 && (
                    <button
                      className="btn btn-success me-2"
                      onClick={() => {
                        // Print all carts functionality
                        printAllCarts();
                      }}
                      title="Print all carts in this invoice"
                    >
                      <i className="bi bi-printer-fill me-1" />
                      Print All Carts ({localCarts.length})
                    </button>
                  )}
                  {localCarts.length > 0 && (
                    <button
                      className="btn btn-info me-2"
                      onClick={() => setShowChecklistModal(true)}
                      title="Print loading checklist for this invoice"
                    >
                      <i className="bi bi-list-check me-1" />
                      Print Loading Checklist
                    </button>
                  )}
                  {localCarts.length > 0 && (
                    <button
                      className={`btn me-2 ${showQuantitiesForThisInvoice ? 'btn-outline-primary' : 'btn-outline-secondary'}`}
                      onClick={() => setShowQuantitiesForThisInvoice(!showQuantitiesForThisInvoice)}
                      title={`${showQuantitiesForThisInvoice ? 'Hide' : 'Show'} product quantities when printing`}
                    >
                      <i className={`bi ${showQuantitiesForThisInvoice ? 'bi-123' : 'bi-eye-slash'} me-1`} />
                      {showQuantitiesForThisInvoice ? 'Hide Qty' : 'Show Qty'}
                    </button>
                  )}
                  {/* Shipping Readiness Indicator */}
                  {localCarts.length > 0 && (
                    <div className="ms-auto">
                      {(() => {
                        const allReady = areAllCartsPrintedAndReady();
                        const totalCarts = localCarts.length;
                        const printedCarts = localCarts.filter(c => c.lastPrintedAt && !c.needsReprint && 
                          (!c.lastModifiedAt || !c.lastPrintedAt || new Date(c.lastModifiedAt) <= new Date(c.lastPrintedAt))).length;
                        const needsPrintCarts = totalCarts - printedCarts;
                        
                        return (
                          <div className="d-flex align-items-center">
                            <span 
                              className={`badge ${allReady ? 'bg-success' : 'bg-warning text-dark'} me-2`}
                              style={{ fontSize: '12px' }}
                            >
                              {allReady ? '✅ Ready to Ship' : `⚠️ ${needsPrintCarts} cart${needsPrintCarts !== 1 ? 's' : ''} need${needsPrintCarts === 1 ? 's' : ''} printing`}
                            </span>
                            <small className="text-muted">
                              {printedCarts}/{totalCarts} printed
                            </small>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {/* Print All Carts Tracking Display */}
                  {localInvoice.printHistory?.lastPrintAllCarts && (
                    <div className="col-12 mt-3">
                      <div 
                        className="alert alert-info d-flex align-items-center p-2"
                        style={{ fontSize: '13px' }}
                      >
                        <i className="bi bi-printer-fill me-2" style={{ fontSize: '16px' }}></i>
                        <div>
                          <strong>Last "Print All Carts" operation:</strong>
                          <br />
                          <span className="text-muted">
                            Performed by <strong>{localInvoice.printHistory.lastPrintAllCarts.printedBy}</strong> on{' '}
                            {formatDateSpanish(localInvoice.printHistory.lastPrintAllCarts.printedAt)}
                            {localInvoice.printHistory.lastPrintAllCarts.cartCount && (
                              <span> ({localInvoice.printHistory.lastPrintAllCarts.cartCount} cart{localInvoice.printHistory.lastPrintAllCarts.cartCount !== 1 ? 's' : ''})</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="d-flex gap-2 align-items-center">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="New Cart Name"
                    value={newCartName}
                    readOnly
                    style={{ background: "#f8fafc", cursor: "pointer" }}
                    onFocus={() => setShowCartKeypad(true)}
                    onClick={() => setShowCartKeypad(true)} // Ensure keypad shows on click as well
                  />
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      if (newCartName.trim()) {
                        setPendingCartName(newCartName.trim());
                        setShowCreateCartConfirm(true);
                      }
                    }}
                    disabled={!newCartName.trim() || cartEditor.isUpdating}
                  >
                    {cartEditor.isUpdating ? (
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    ) : (
                      "Add"
                    )}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowNewCartInput(false);
                      setShowCartKeypad(false);
                      setNewCartName("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {/* Keypad for cart name input */}
              {showCartKeypad && (
                <div
                  className="modal show d-block"
                  tabIndex={-1}
                  style={{ background: "rgba(0,0,0,0.25)", zIndex: 2000 }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setShowCartKeypad(false);
                  }}
                >
                  <div
                    className="modal-dialog"
                    style={{ maxWidth: 320, margin: "120px auto 80px auto" }}
                  >
                    <div className="modal-content">
                      <div className="modal-header">
                        <h5 className="modal-title">Enter Cart Name</h5>
                        <button
                          type="button"
                          className="btn-close"
                          onClick={() => setShowCartKeypad(false)}
                        ></button>
                      </div>
                      <div className="modal-body">
                        <input
                          type="text"
                          className="form-control mb-3 text-center"
                          value={newCartName}
                          readOnly
                          style={{
                            fontSize: 28,
                            letterSpacing: 2,
                            background: "#f8fafc",
                          }}
                        />
                        <div className="d-flex flex-wrap justify-content-center">
                          {keypadButtons.map((btn, idx) => (
                            <button
                              key={btn + idx}
                              className="btn btn-light m-1"
                              style={{
                                width: 60,
                                height: 48,
                                fontSize: 22,
                                fontWeight: 600,
                              }}
                              onClick={async () => {
                                if (btn === "OK") {
                                  if (newCartName.trim()) {
                                    setPendingCartName(newCartName.trim());
                                    setShowCartKeypad(false); // Hide keypad modal
                                    setShowCreateCartConfirm(true);
                                  } else {
                                    setShowCartKeypad(false);
                                  }
                                } else if (btn === "←") {
                                  setNewCartName((prev) => prev.slice(0, -1));
                                } else {
                                  setNewCartName((prev) => prev + btn);
                                }
                              }}
                              tabIndex={-1}
                              type="button"
                            >
                              {btn}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {localCarts.map((cart) => (
              <div
                key={`${cart.id}-${cart.name}`} // Include cart name in key to force re-render on name changes
                className={`enhanced-cart-section ${cart.name
                  .toUpperCase()
                  .startsWith("CARRO SIN NOMBRE") ? 'cart-unnamed' : ''}`}
              >
                {/* Centered Cart Name */}
                <div className="text-center mb-3">
                  <h3 className="enhanced-cart-name">
                    {cart.name}
                  </h3>
                </div>
                
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="d-flex align-items-center gap-3">
                    
                    {/* Print Status Indicator with Tracking Info */}
                    {(() => {
                      const status = getCartStatus(cart);
                      return (
                        <div className="d-flex flex-column align-items-end">
                          <div
                            className="d-flex align-items-center gap-2 px-3 py-1 rounded"
                            style={{
                              backgroundColor: status.bgColor,
                              border: `2px solid ${status.color}`,
                              fontSize: '14px',
                              fontWeight: 'bold'
                            }}
                          >
                            <span style={{ fontSize: '16px' }}>{status.icon}</span>
                            <span style={{ color: status.color }}>{status.text}</span>
                          </div>
                          {/* Print Tracking Information */}
                          {cart.lastPrintedAt && cart.lastPrintedBy && (
                            <div 
                              className="text-muted small mt-1"
                              style={{ fontSize: '11px', textAlign: 'right' }}
                            >
                              Last printed by: <strong>{cart.lastPrintedBy}</strong>
                              <br />
                              <span style={{ fontSize: '10px' }}>
                                {formatDateSpanish(cart.lastPrintedAt)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-success btn-sm"
                      title="Print Cart"
                      onClick={() => {
                        setShowCartPrintModal({ cartId: cart.id });
                      }}
                    >
                      <i className="bi bi-printer" />
                    </button>
                    <button
                      className="btn btn-outline-primary btn-sm"
                      title="Merge Cart"
                      onClick={() => {
                        // Find all other carts in the invoice to merge with
                        const otherCarts = localInvoice.carts.filter(c => c.id !== cart.id);
                        if (otherCarts.length === 0) {
                          alert("No other carts available to merge with.");
                          return;
                        }
                        setCartsToMerge([cart, ...otherCarts]);
                        setShowCartMergeModal(true);
                      }}
                    >
                      <i className="bi bi-arrow-left-right" />
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      title="Delete Cart"
                      onClick={async () => {
                        if (window.confirm(`Delete cart '${cart.name}'?`)) {
                          try {
                            // Use the new direct cart editor
                            await cartEditor.deleteCart(cart.id);
                            
                            // Log activity
                            if (typeof logActivity === "function") {
                              await logActivity({
                                type: "Cart",
                                message: `Cart '${cart.name}' deleted from invoice #${
                                  localInvoice.invoiceNumber || localInvoice.id
                                }`,
                                user: user?.username,
                              });
                            }
                            
                            console.log("🎉 Cart deletion completed successfully with direct approach");
                            
                          } catch (error: any) {
                            console.error("❌ Error deleting cart:", error);
                            alert(`Failed to delete cart: ${error?.message || 'Network error. Please try again.'}`);
                          }
                        }
                      }}
                      disabled={cartEditor.isUpdating}
                    >
                      {cartEditor.isUpdating ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <i className="bi bi-trash" />
                      )}
                    </button>
                    <button
                      className="btn btn-outline-primary btn-sm"
                      title="Edit Cart Name"
                      onClick={async () => {
                        const newName = prompt("Edit cart name:", cart.name);
                        if (
                          newName &&
                          newName.trim() &&
                          newName !== cart.name
                        ) {
                          console.log("🎯 Cart editing started with direct approach:", { 
                            cartId: cart.id, 
                            oldName: cart.name, 
                            newName: newName.trim() 
                          });
                          
                          try {
                            // Use the new direct cart editor
                            await cartEditor.updateCartName(cart.id, newName.trim());
                            
                            // Mark cart as modified since name changed
                            await markCartAsModified(cart.id);
                            
                            // Log activity
                            if (typeof logActivity === "function") {
                              await logActivity({
                                type: "Cart",
                                message: `Cart '${cart.name}' renamed to '${newName.trim()}' in invoice #${
                                  localInvoice.invoiceNumber || localInvoice.id
                                }`,
                                user: user?.username,
                              });
                            }
                            
                            console.log("🎉 Cart name update completed successfully with direct approach");
                            
                          } catch (error: any) {
                            console.error("❌ Error updating cart name:", error);
                            
                            // Show user-friendly error message
                            alert(`Failed to update cart name: ${error?.message || 'Network error. Please try again.'}`);
                          }
                        }
                      }}
                      disabled={cartEditor.isUpdating}
                    >
                      {cartEditor.isUpdating ? (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      ) : (
                        <i className="bi bi-pencil" />
                      )}
                    </button>
                  </div>
                </div>
                {/* Add New Item Button */}
                <div className="mb-2">
                  <button
                    className="btn btn-link text-primary fw-bold"
                    style={{
                      fontSize: 28,
                      textDecoration: "none",
                      padding: "18px 0",
                      width: "100%",
                      display: "block",
                      background: "#eaf4ff",
                      borderRadius: 12,
                      border: "2.5px dashed #0E62A0",
                      fontWeight: 900,
                      letterSpacing: 1,
                      boxShadow: "0 2px 12px rgba(14,98,160,0.08)",
                      margin: "18px 0",
                    }}
                    onClick={() => setAddProductCartId(cart.id)}
                  >
                    + Add New Item
                  </button>
                </div>


                {/* Product summary cards */}
                <div className="row g-2 mb-2">
                  {clientProducts
                    .filter((prod) =>
                      cart.items.some((i) => i.productId === prod.id)
                    )
                    .map((product) => {
                      // All entries for this product in this cart
                      const entries = cart.items
                        .map((item, idx) => ({ ...item, idx }))
                        .filter((item) => item.productId === product.id);
                      const totalQty = entries.reduce(
                        (sum, item) => sum + Number(item.quantity),
                        0
                      );
                      return (
                        <div key={product.id} className="col-12 col-md-6">
                          <div
                            className="d-flex flex-column border rounded p-2 mb-1"
                            style={{ background: "#fff", minHeight: 72 }}
                          >
                            <div className="d-flex align-items-center mb-2">
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    fontWeight: 700,
                                    fontSize: 18,
                                    color: "#222",
                                  }}
                                >
                                  {product.name}
                                </div>
                              </div>
                            </div>
                            {/* List each entry for this product in this cart */}
                            <div
                              style={{
                                fontSize: 14,
                                color: "#444",
                                marginBottom: 4,
                              }}
                            >
                              {entries.map((item, i) => (
                                <div
                                  key={item.idx}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "2px 0",
                                    borderBottom: "1px solid #f0f0f0",
                                  }}
                                >
                                  <span>
                                    +{item.quantity} by{" "}
                                    {item.addedBy || "Unknown"}
                                    {item.addedAt && (
                                      <span
                                        style={{
                                          color: "#888",
                                          marginLeft: 6,
                                          fontSize: 12,
                                        }}
                                      >
                                        {formatDateSpanish(item.addedAt)}
                                      </span>
                                    )}
                                    {item.editedBy && (
                                      <span
                                        style={{
                                          color: "#0ea5e9",
                                          marginLeft: 8,
                                          fontSize: 12,
                                        }}
                                      >
                                        (edited by {item.editedBy})
                                      </span>
                                    )}
                                  </span>
                                  <span>
                                    <button
                                      className="btn btn-sm btn-outline-danger"
                                      style={{
                                        padding: "2px 8px",
                                        fontSize: 12,
                                      }}
                                      onClick={() =>
                                        handleDeleteCartItem(
                                          cart.id,
                                          product.id,
                                          item.idx
                                        )
                                      }
                                      title="Delete entry"
                                    >
                                      <i className="bi bi-x" />
                                    </button>
                                  </span>
                                </div>
                              ))}
                            </div>
                            {/* Total for this product */}
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 18,
                                color: "#0E62A0",
                                textAlign: "right",
                              }}
                            >
                              Total: {totalQty}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
                
                {/* Cart Creator Information */}
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 12,
                    borderTop: "1px solid #e5e7eb",
                    fontSize: 12,
                    color: "#6b7280",
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontWeight: 500 }}>
                    Created by: {cart.createdBy || "Unknown"}
                  </span>
                  {cart.createdAt && (
                    <span style={{ marginLeft: 8 }}>
                      on {formatDateSpanish(cart.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Product Add Confirmation Modal */}
      {showAddConfirmation && confirmationProduct && (
        <div
          className="modal show product-confirmation-modal"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.8)",
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 9999, // Maximum z-index
          }}
        >
          <div className="modal-dialog" style={{ marginTop: "10vh" }}>
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
                  <h4 className="mb-3">{user?.username || "User"} wants to add</h4>
                  <div className="display-1 fw-bold text-primary mb-3" style={{ fontSize: "4rem" }}>
                    {confirmationProduct.quantity}
                  </div>
                  <h3 className="text-secondary">{confirmationProduct.product?.name}</h3>
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

      {/* Confirmation modal for cart creation */}
      {showCreateCartConfirm && (
        <DeleteConfirmationModal
          show={showCreateCartConfirm}
          onClose={() => setShowCreateCartConfirm(false)}
          onCancel={() => setShowCreateCartConfirm(false)}
          onConfirm={async () => {
            setShowCreateCartConfirm(false);
            try {
              const newCart = await cartEditor.addCart(pendingCartName);
              if (typeof logActivity === "function") {
                await logActivity({
                  type: "Cart",
                  message: `Cart '${pendingCartName}' created in invoice #${localInvoice.invoiceNumber || localInvoice.id}`,
                  user: user?.username,
                });
              }
              setNewCartName("");
              setShowNewCartInput(false);
              setShowCartKeypad(false);
            } catch (error: any) {
              console.error("❌ Error creating cart:", error);
              alert(`Failed to create cart: ${error?.message || 'Network error. Please try again.'}`);
            }
          }}
          title="Create New Cart?"
          message={`Are you sure you want to create a new cart named \"${pendingCartName}\"?`}
          confirmButtonText="Add New Cart"
          confirmButtonClass="btn-success"
        />
      )}

      {/* Cart Merge Modal */}
      {showCartMergeModal && (
        <CartMergeModal
          show={showCartMergeModal}
          onClose={() => {
            setShowCartMergeModal(false);
            setCartsToMerge([]);
          }}
          sourceCarts={cartsToMerge}
          onMerge={async (sourceId: string, targetId: string) => {
            try {
              // Use the cart merger utility to perform the merge
              await cartMerger.mergeCartsDirect(sourceId, targetId);
              
              // Close the modal
              setShowCartMergeModal(false);
              setCartsToMerge([]);
              
              // Log the merge activity
              if (typeof logActivity === "function") {
                const sourceCart = cartsToMerge.find(c => c.id === sourceId);
                const targetCart = cartsToMerge.find(c => c.id === targetId);
                await logActivity({
                  type: "Cart",
                  message: `Merged cart "${sourceCart?.name}" into "${targetCart?.name}" in invoice #${localInvoice.invoiceNumber || localInvoice.id}`,
                  user: user?.username,
                });
              }
              
              console.log("✅ Cart merge completed successfully");
            } catch (error: any) {
              console.error("❌ Error merging carts:", error);
              alert(`Failed to merge carts: ${error?.message || 'Network error. Please try again.'}`);
            }
          }}
        />
      )}

      {/* Cart Print Modal */}
      {showCartPrintModal &&
        (() => {
          const cart = localInvoice.carts.find((c) => c.id === showCartPrintModal.cartId);
          if (!cart) return null;

          // Get client print configuration with defaults (same as Print All Carts)
          const printConfig: PrintConfiguration['cartPrintSettings'] = client?.printConfig?.cartPrintSettings || ({
            enabled: true,
            showProductDetails: true,
            showProductSummary: false,
            showQuantities: true,
            showPrices: false,
            showCartTotal: true,
            includeTimestamp: true,
            headerText: "Cart Contents",
            footerText: "",
            clientNameFontSize: "large",
          } as PrintConfiguration['cartPrintSettings']);

          // Helper function to get client name font size
          const getClientNameFontSize = () => {
            switch (printConfig.clientNameFontSize) {
              case 'small': return '28px';
              case 'medium': return '35px';
              case 'large': return '45px';
              default: return '35px'; // fallback to medium
            }
          };

          // Show quantities based on client-specific print configuration
          // Priority: 1) Client's print config setting, 2) Global toggle for this invoice, 3) Oncologico special case
          const shouldShowQuantities = (printConfig.showQuantities && showQuantitiesForThisInvoice) || 
                                       isOncologicoClient(localInvoice.clientName) || 
                                       isChildrensHospitalClient(localInvoice.clientName);

          // Generate single cart content using EXACT same logic as Print All Carts
          const generateSingleCartContent = () => {
            const cartIndex = localInvoice.carts.findIndex(c => c.id === cart.id);
            const cartPosition = cartIndex + 1;
            const totalCarts = localInvoice.carts.length;

            // Split items into two columns only if there are more than 5 items (same as Print All Carts)
            const shouldUseTwoColumns = cart.items.length > 5;
            const splitItemsIntoColumns = (items: CartItem[]) => {
              if (!shouldUseTwoColumns) {
                return { column1: items, column2: [] };
              }
              const itemsPerColumn = Math.ceil(items.length / 2);
              const column1 = items.slice(0, itemsPerColumn);
              const column2 = items.slice(itemsPerColumn);
              return { column1, column2 };
            };

            const { column1, column2 } = splitItemsIntoColumns(cart.items);

            return `
              <div style="
                width: 8in;
                height: 5in;
                margin: 0 auto;
                background: #fff;
                padding: 15px;
                font-family: Arial, sans-serif;
                font-size: 12px;
                position: relative;
                overflow: hidden;
                box-sizing: border-box;
              ">
                <!-- Header Section (Fixed Height: ~0.8in) -->
                <div style="
                  height: 0.8in;
                  border-bottom: 1px solid #333;
                  padding-bottom: 8px;
                  position: relative;
                  margin-bottom: 12px;
                ">
                  <!-- Cart Position - Top Right -->
                  <div style="
                    position: absolute;
                    top: 0;
                    right: 0;
                    font-size: 14px;
                    font-weight: bold;
                    color: #0E62A0;
                  ">
                    ${cartPosition}/${totalCarts}
                  </div>

                  <!-- Cart Name - Top Left -->
                  <div style="
                    position: absolute;
                    top: 0;
                    left: 0;
                    font-size: 28px;
                    font-weight: bold;
                    color: #333;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    line-height: 1.1;
                  ">
                    Cart #${cart.name}
                  </div>

                  <!-- Client Name & Ticket - Center -->
                  <div style="
                    text-align: center;
                    margin-top: 35px;
                  ">
                    <div style="
                      font-size: ${getClientNameFontSize()};
                      font-weight: bold;
                      color: #0E62A0;
                      text-transform: uppercase;
                      letter-spacing: 1px;
                      margin-bottom: 4px;
                    ">
                      ${transformClientNameForDisplay(localInvoice.clientName)}
                    </div>
                    <div style="
                      font-size: 14px;
                      font-weight: bold;
                      color: #333;
                    ">
                      Ticket #${localInvoice.invoiceNumber || localInvoice.id.substring(0, 8)}
                    </div>
                  </div>
                </div>

                <!-- Products Section (Flexible Height: ~2.8in) -->
                <div style="
                  height: 2.8in;
                  overflow: hidden;
                  margin-bottom: 12px;
                ">
                  ${cart.items.length === 0 ? `
                    <p style="
                      font-style: italic; 
                      color: #666; 
                      font-size: 12px;
                      text-align: center;
                      margin-top: 40px;
                    ">
                      No items in this cart
                    </p>
                  ` : `
                    <!-- Dynamic Product Layout: Single column for ≤5 items, Two columns for >5 items -->
                    ${shouldUseTwoColumns ? `
                      <div style="
                        display: flex;
                        gap: 15px;
                        height: 100%;
                      ">
                        <!-- Column 1 -->
                        <div style="
                          flex: 1;
                          overflow: hidden;
                        ">
                          <table style="
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 10px;
                          ">
                            <thead>
                              <tr style="border-bottom: 1px solid #333;">
                                <th style="
                                  text-align: left;
                                  padding: 4px 2px;
                                  font-size: 10px;
                                  font-weight: bold;
                                ">Product</th>
                                ${shouldShowQuantities ? `
                                  <th style="
                                    text-align: center;
                                    padding: 4px 2px;
                                    font-size: 10px;
                                    font-weight: bold;
                                    width: 30px;
                                  ">Qty</th>
                                ` : ''}
                              </tr>
                            </thead>
                            <tbody>
                              ${column1.map((item) => `
                                <tr style="border-bottom: 1px solid #eee;">
                                  <td style="
                                    padding: 3px 2px;
                                    font-size: 9px;
                                    line-height: 1.2;
                                    word-break: break-word;
                                  ">${item.productName}</td>
                                  ${shouldShowQuantities ? `
                                    <td style="
                                      padding: 3px 2px;
                                      text-align: center;
                                      font-size: 9px;
                                      font-weight: bold;
                                    ">${item.quantity}</td>
                                  ` : ''}
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                        </div>

                        <!-- Column 2 -->
                        <div style="
                          flex: 1;
                          overflow: hidden;
                        ">
                          <table style="
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 10px;
                          ">
                            <thead>
                              <tr style="border-bottom: 1px solid #333;">
                                <th style="
                                  text-align: left;
                                  padding: 4px 2px;
                                  font-size: 10px;
                                  font-weight: bold;
                                ">Product</th>
                                ${shouldShowQuantities ? `
                                  <th style="
                                    text-align: center;
                                    padding: 4px 2px;
                                    font-size: 10px;
                                    font-weight: bold;
                                    width: 30px;
                                  ">Qty</th>
                                ` : ''}
                              </tr>
                            </thead>
                            <tbody>
                              ${column2.map((item) => `
                                <tr style="border-bottom: 1px solid #eee;">
                                  <td style="
                                    padding: 3px 2px;
                                    font-size: 9px;
                                    line-height: 1.2;
                                    word-break: break-word;
                                  ">${item.productName}</td>
                                  ${shouldShowQuantities ? `
                                    <td style="
                                      padding: 3px 2px;
                                      text-align: center;
                                      font-size: 9px;
                                      font-weight: bold;
                                    ">${item.quantity}</td>
                                  ` : ''}
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ` : `
                      <!-- Single Column Layout for 5 or fewer items -->
                      <div style="
                        height: 100%;
                        overflow: hidden;
                      ">
                        <table style="
                          width: 100%;
                          border-collapse: collapse;
                          font-size: 11px;
                        ">
                          <thead>
                            <tr style="border-bottom: 1px solid #333;">
                              <th style="
                                text-align: left;
                                padding: 6px 4px;
                                font-size: 11px;
                                font-weight: bold;
                              ">Product</th>
                              ${shouldShowQuantities ? `
                                <th style="
                                  text-align: center;
                                  padding: 6px 4px;
                                  font-size: 11px;
                                  font-weight: bold;
                                  width: 60px;
                                ">Qty</th>
                              ` : ''}
                            </tr>
                          </thead>
                          <tbody>
                            ${column1.map((item) => `
                              <tr style="border-bottom: 1px solid #eee;">
                                <td style="
                                  padding: 5px 4px;
                                  font-size: 10px;
                                  line-height: 1.3;
                                  word-break: break-word;
                                ">${item.productName}</td>
                                ${shouldShowQuantities ? `
                                  <td style="
                                    padding: 5px 4px;
                                    text-align: center;
                                    font-size: 10px;
                                    font-weight: bold;
                                  ">${item.quantity}</td>
                                ` : ''}
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    `}
                `}
              </div>

              <!-- Footer Section (Fixed at bottom) -->
              <div style="
                position: absolute;
                bottom: 15px;
                left: 15px;
                right: 15px;
              ">
                <!-- Custom Footer Text -->
                ${printConfig.footerText ? `
                  <div style="
                    text-align: center;
                    font-size: 9px;
                    color: #666;
                    margin-bottom: 8px;
                    border-top: 1px solid #ddd;
                    padding-top: 6px;
                  ">
                    ${printConfig.footerText}
                  </div>
                ` : ''}

                <!-- Delivery Date - Always at Bottom -->
                ${localInvoice.deliveryDate ? `
                  <div style="
                    text-align: center;
                    font-size: 14px;
                    font-weight: bold;
                    color: #0E62A0;
                    background-color: #f0f8ff;
                    padding: 8px;
                    border: 2px solid #0E62A0;
                    border-radius: 6px;
                  ">
                    DELIVERY DATE: ${formatDateOnlySpanish(localInvoice.deliveryDate)}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        };

          return (
            <div
              className="modal show"
              style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
            >
              <div 
                className="modal-dialog" 
                style={{ 
                  maxWidth: "70vw", 
                  width: "70vw", 
                  minWidth: "800px",
                  margin: "2vh auto"
                }}
              >
                <div className="modal-content" style={{ height: "90vh" }}>
                  <div className="modal-header d-print-none">
                    <h5 className="modal-title">
                      Print Cart: {cart.name} 
                      {(() => {
                        const cartIndex = localInvoice.carts.findIndex(c => c.id === cart.id);
                        const cartPosition = cartIndex + 1;
                        const totalCarts = localInvoice.carts.length;
                        return (
                          <span className="badge bg-primary ms-2">
                            {cartPosition}/{totalCarts}
                          </span>
                        );
                      })()}
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setShowCartPrintModal(null)}
                    ></button>
                  </div>
                  <div className="modal-body" style={{ height: "calc(90vh - 120px)", overflowY: "auto", padding: "20px" }}>
                    <div className="h-100">
                      {/* Standard 8.5x5.5 Print Preview - Full Width */}
                      <div className="h-100">
                        <h6 className="mb-3">📄 Print Preview (8" x 5" - Same as Print All Carts)</h6>
                        <div
                          id="cart-print-area"
                          style={{
                            padding: "0",
                            background: "#fff",
                            width: "8.5in",
                            height: "5.5in",
                            margin: "0 auto",
                            overflowY: "auto",
                            minHeight: "400px",
                            border: "1px solid #ddd"
                          }}
                          dangerouslySetInnerHTML={{ __html: generateSingleCartContent() }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer d-print-none">
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        // Use the same exact approach as Print All Carts
                        const printWindow = window.open("", "", "height=800,width=600");
                        if (!printWindow) {
                          alert("Please allow popups to print cart");
                          return;
                        }

                        setTimeout(async () => {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>Print Cart: ${cart.name}</title>
                                <style>
                                  @media print {
                                    @page { size: 8.5in 5.5in landscape; margin: 0.25in; }
                                    body { margin: 0; }
                                    .d-print-none { display: none !important; }
                                    * { 
                                      -webkit-print-color-adjust: exact !important;
                                      color-adjust: exact !important;
                                    }
                                  }
                                  body { font-family: Arial, sans-serif; }
                                </style>
                              </head>
                              <body>${generateSingleCartContent()}</body>
                            </html>
                          `);
                          printWindow.document.close();
                          printWindow.focus();
                          printWindow.print();
                          printWindow.close();
                          
                          // Mark cart as printed after print dialog
                          await markCartAsPrinted(cart.id);
                        }, 100);
                      }}
                    >
                      📄 Print Cart (Same Format as Print All)
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowCartPrintModal(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Loading Checklist Modal */}
      {showChecklistModal && (
        <div 
          className="modal show d-block" 
          tabIndex={-1} 
          style={{ background: "rgba(0,0,0,0.5)", zIndex: 2100 }}
        >
          <div className="modal-dialog" style={{ maxWidth: 600, margin: "60px auto" }}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">🚛 Loading Checklist</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowChecklistModal(false)}
                ></button>
              </div>
              <div className="modal-body" id="print-checklist-content">
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <h2 style={{ 
                    color: "#0E62A0", 
                    fontWeight: 800, 
                    textTransform: "uppercase", 
                    letterSpacing: 1,
                    marginBottom: 8,
                    fontSize: 20
                  }}>
                    {transformClientNameForDisplay(localInvoice.clientName)}
                  </h2>
                  <div style={{ fontSize: 14, color: "#333", marginBottom: 4 }}>
                    Ticket #{localInvoice.invoiceNumber || localInvoice.id.substring(0, 8)}
                  </div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {formatDateOnlySpanish(localInvoice.date)}
                    {localInvoice.deliveryDate && ` | Delivery: ${formatDateOnlySpanish(localInvoice.deliveryDate)}`}
                  </div>
                </div>
                
                <div style={{ margin: "0 auto", maxWidth: 450 }}>
                  <h4 style={{ 
                    color: "#0E62A0", 
                    marginBottom: 15, 
                    textAlign: "center",
                    borderBottom: "1px solid #0E62A0",
                    paddingBottom: 5,
                    fontSize: 16
                  }}>
                    Carts to Load ({localCarts.length})
                  </h4>
                  
                  {localCarts.map((cart, idx) => (
                    <div 
                      key={cart.id} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        marginBottom: 12,
                        padding: "5px 0"
                      }}
                    >
                      {/* Smaller checkbox for A5 format */}
                      <div 
                        style={{ 
                          width: 25, 
                          height: 25, 
                          border: "2px solid #0E62A0", 
                          borderRadius: 4, 
                          marginRight: 15, 
                          background: "#fff",
                          flexShrink: 0
                        }}
                      ></div>
                      
                      {/* Cart name and details */}
                      <div style={{ flex: 1 }}>
                        <span style={{ 
                          fontSize: 18, 
                          fontWeight: 700, 
                          color: "#0E62A0", 
                          textTransform: "uppercase", 
                          letterSpacing: 0.5 
                        }}>
                          {cart.name}
                        </span>
                        {cart.items.length > 0 && (
                          <div style={{ 
                            fontSize: 11, 
                            color: "#666", 
                            marginTop: 2 
                          }}>
                            {cart.items.length} item{cart.items.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  <div style={{ 
                    marginTop: 20, 
                    padding: 10, 
                    background: "#f8f9fa", 
                    borderRadius: 6,
                    textAlign: "center",
                    fontSize: 12
                  }}>
                    <strong style={{ color: "#0E62A0" }}>
                      ✓ Check off each cart as loaded
                    </strong>
                  </div>
                </div>
              </div>
              <div className="modal-footer d-print-none">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowChecklistModal(false)}
                >
                  Close
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    const printWindow = window.open("", "", "height=800,width=600");
                    if (!printWindow) {
                      alert("Please allow popups to print the loading checklist");
                      return;
                    }

                    printWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <title>Loading Checklist - ${transformClientNameForDisplay(localInvoice.clientName)}</title>
                          <style>
                            @page { 
                              size: A5; 
                              margin: 0.4in; 
                            }
                            body { 
                              font-family: Arial, sans-serif; 
                              color: #333; 
                              line-height: 1.2;
                              margin: 0;
                              padding: 0;
                              font-size: 11px;
                            }
                            h1 { 
                              color: #0E62A0; 
                              text-align: center; 
                              font-size: 16px; 
                              margin: 0 0 8px 0;
                              text-transform: uppercase;
                              letter-spacing: 1px;
                              font-weight: 800;
                            }
                            .header-info { 
                              text-align: center; 
                              margin-bottom: 15px; 
                              font-size: 10px;
                            }
                            .section-title {
                              color: #0E62A0; 
                              margin: 10px 0 8px 0; 
                              text-align: center; 
                              border-bottom: 1px solid #0E62A0; 
                              padding-bottom: 3px;
                              font-size: 12px;
                              font-weight: bold;
                            }
                            .cart-item { 
                              display: flex; 
                              align-items: center; 
                              margin-bottom: 8px; 
                              padding: 3px 0;
                            }
                            .checkbox { 
                              width: 20px; 
                              height: 20px; 
                              border: 2px solid #0E62A0; 
                              border-radius: 3px; 
                              margin-right: 10px; 
                              background: #fff;
                              flex-shrink: 0;
                            }
                            .cart-name { 
                              font-size: 13px; 
                              font-weight: bold; 
                              color: #0E62A0; 
                              text-transform: uppercase;
                              letter-spacing: 0.5px;
                            }
                            .item-count { 
                              font-size: 9px; 
                              color: #666; 
                              margin-top: 1px; 
                            }
                            .instructions { 
                              margin-top: 12px; 
                              padding: 6px; 
                              background: #f8f9fa; 
                              border-radius: 4px;
                              text-align: center;
                              font-weight: bold;
                              color: #0E62A0;
                              font-size: 10px;
                            }
                            .compact-layout {
                              max-height: 7in; /* Ensure it fits A5 height */
                              overflow: hidden;
                            }
                          </style>
                        </head>
                        <body>
                          <div class="compact-layout">
                            <h1>${transformClientNameForDisplay(localInvoice.clientName)}</h1>
                            <div class="header-info">
                              <div style="margin-bottom: 3px;">
                                Ticket #${localInvoice.invoiceNumber || localInvoice.id.substring(0, 8)}
                              </div>
                              <div style="color: #666;">
                                ${formatDateOnlySpanish(localInvoice.date)}
                                ${localInvoice.deliveryDate ? ` | Delivery: ${formatDateOnlySpanish(localInvoice.deliveryDate)}` : ''}
                              </div>
                            </div>
                            
                            <div class="section-title">
                              Carts to Load (${localCarts.length})
                            </div>
                            
                            ${localCarts.map((cart) => `
                              <div class="cart-item">
                                <div class="checkbox"></div>
                                <div>
                                  <div class="cart-name">${cart.name}</div>
                                  ${cart.items.length > 0 ? `
                                    <div class="item-count">${cart.items.length} item${cart.items.length !== 1 ? 's' : ''}</div>
                                  ` : ''}
                                </div>
                              </div>
                            `).join('')}
                            
                            <div class="instructions">
                              ✓ Check off each cart as loaded
                            </div>
                          </div>
                        </body>
                      </html>
                    `);
                    
                    printWindow.document.close();
                    printWindow.focus();
                    printWindow.print();
                    printWindow.close();
                  }}
                >
                  🖨️ Print Checklist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Special Service Confirmation Modal */}
      {showSpecialServiceConfirmation && (
        <DeleteConfirmationModal
          show={showSpecialServiceConfirmation}
          onClose={() => setShowSpecialServiceConfirmation(false)}
          onCancel={() => setShowSpecialServiceConfirmation(false)}
          onConfirm={confirmSpecialServiceChange}
          title="Confirm Special Service Change"
          message={`Are you sure you want to ${pendingSpecialServiceState ? 'enable' : 'disable'} special service for this invoice?`}
          confirmButtonText={pendingSpecialServiceState ? 'Enable Special Service' : 'Disable Special Service'}
          confirmButtonClass={pendingSpecialServiceState ? 'btn-primary' : 'btn-warning'}
        />
      )}
    </div>

    {/* Product Cards Modal for Adding Product - Moved Outside Main Modal */}
    {addProductCartId && (
      <div 
        className="modal show d-block add-product-modal"
        style={{ zIndex: 2500 }}
        onClick={(e) => {
          // Close modal only if clicking on the backdrop, not the content
          if (e.target === e.currentTarget) {
            setAddProductCartId(null);
            setSelectedProductId("");
            setKeypadQty("");
          }
        }}
      >
        <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Select Product</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => {
                  setAddProductCartId(null);
                  setSelectedProductId("");
                  setKeypadQty("");
                }}
              ></button>
            </div>
            <div className="modal-body">
              <div className="product-grid">
                {clientProducts.map((product) => (
                  <div key={product.id}>
                    <div
                      className={`card product-card-selectable${
                        selectedProductId === product.id ? " border-primary" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProductId(product.id);
                        setShowProductKeypad({
                          cartId: addProductCartId,
                          productId: product.id,
                        });
                        setKeypadQty("");
                      }}
                    >
                      <div className="card-body">
                        <h6 className="fw-bold mb-0">
                          {product.name}
                        </h6>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>        </div>
      )}

    {/* Quantity Keypad Modal for Product Selection - Moved Outside Main Modal */}
    {showProductKeypad && (
      <div
        className="modal show d-block"
        tabIndex={-1}
        style={{ background: "rgba(0,0,0,0.5)", zIndex: 3500 }}
        onClick={(e) => {
          if (e.target === e.currentTarget)
            setShowProductKeypad(null);
        }}
      >
        <div
          className="modal-dialog"
          style={{ maxWidth: 320, margin: "120px auto 80px auto" }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Enter Quantity</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowProductKeypad(null)}
              ></button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                className="form-control mb-3 text-center"
                value={keypadQty}
                readOnly
                style={{
                  fontSize: 28,
                  letterSpacing: 2,
                  background: "#f8fafc",
                }}
              />
              <div className="d-flex flex-wrap justify-content-center">
                {keypadButtons.map((btn, idx) => (
                  <button
                    key={btn + idx}
                    className="btn btn-light m-1"
                    style={{
                      width: 60,
                      height: 48,
                      fontSize: 22,
                      fontWeight: 600,
                    }}
                    onClick={async () => {
                      if (btn === "OK") {
                        const qty = parseInt(keypadQty, 10);
                        if (showProductKeypad && qty > 0) {
                          const prod = clientProducts.find(
                            (p) => p.id === showProductKeypad.productId
                          );
                          
                          // Create add product callback
                          const addProductCallback = async () => {
                            // 1. Update localCarts immediately for instant UI update
                            setLocalCarts((prevCarts) =>
                              prevCarts.map((cartObj) => {
                                if (
                                  cartObj.id !==
                                  showProductKeypad.cartId
                                )
                                  return cartObj;
                                
                                return {
                                  ...cartObj,
                                  items: [
                                    ...cartObj.items,
                                    {
                                      productId:
                                        showProductKeypad.productId,
                                      productName: prod
                                        ? prod.name
                                        : "",
                                      quantity: qty,
                                      price: prod ? prod.price : 0,
                                      addedBy:
                                        user?.username || "You",
                                      addedAt:
                                        new Date().toISOString(),
                                    },
                                  ],
                                };
                              })
                            );
                            
                            // 2. Mark cart as modified (needs reprint)
                            await markCartAsModified(showProductKeypad.cartId);
                            
                            // 3. Persist to Firestore (parent handler)
                            await onAddProductToCart(
                              showProductKeypad.cartId,
                              showProductKeypad.productId,
                              qty
                            );
                            
                            if (refreshInvoices)
                              await refreshInvoices();
                            
                            // Clear states
                            setAddProductCartId(null);
                            setSelectedProductId("");
                            setShowProductKeypad(null);
                            setKeypadQty("");
                            setShowAddConfirmation(false);
                            setConfirmationProduct(null);
                          };
                          
                          // Show confirmation dialog
                          setConfirmationProduct({
                            cartId: showProductKeypad.cartId,
                            productId: showProductKeypad.productId,
                            product: prod || null,
                            quantity: qty,
                            addCallback: addProductCallback
                          });
                          setShowAddConfirmation(true);
                          
                          // Close ALL other modals to make way for confirmation modal
                          setShowProductKeypad(null);
                          setAddProductCartId(null); // Close product selection modal
                          setSelectedProductId("");
                          setKeypadQty("");
                        } else {
                          setShowProductKeypad(null);
                          setKeypadQty("");
                        }
                      } else if (btn === "←") {
                        setKeypadQty((prev) => prev.slice(0, -1));
                      } else {
                        setKeypadQty((prev) => prev + btn);
                      }
                    }}
                    tabIndex={-1}
                    type="button"
                  >
                    {btn}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default InvoiceDetailsModal;
