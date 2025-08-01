import React from "react";
import { Invoice, Product, Client, Cart, CartItem, LaundryCart } from "../types";
import { getUsers, UserRecord, logActivity } from "../services/firebaseService";
import { useAuth } from "./AuthContext";
import { formatDateSpanish, formatDateOnlySpanish } from "../utils/dateFormatter";
import { useCartEditor } from "./CartEditHandler";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";

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
  refreshInvoices?: () => Promise<void>;
}

const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  invoice,
  onClose,
  client,
  products,
  onAddCart,
  onAddProductToCart,
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

  // Local state for carts to enable instant UI update
  const [localCarts, setLocalCarts] = React.useState(invoice.carts);
  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const { user } = useAuth();

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
    // Persist change
    await onAddProductToCart(cartId, productId, 0, undefined, itemIdx);
    if (refreshInvoices) await refreshInvoices();
  };

  // Print All Carts functionality
  const printAllCarts = async () => {
    if (localCarts.length === 0) {
      alert("No carts to print");
      return;
    }

    // Check if delivery date is set
    if (!localInvoice.deliveryDate) {
      alert("A delivery date is required before printing all carts. Please set a delivery date first.");
      return;
    }

    // Track who printed all carts
    await trackPrintAllCarts();

    // Proceed with printing
    generatePrintContent();
  };

  // Track print all carts operation
  const trackPrintAllCarts = async () => {
    try {
      const printTimestamp = new Date().toISOString();
      const username = user?.username || 'Unknown User';
      const cartCount = localCarts.length;

      // Create print history record
      const printRecord = {
        printedBy: username,
        printedAt: printTimestamp,
        cartCount: cartCount
      };

      // Log the activity
      if (typeof logActivity === "function") {
        await logActivity({
          type: "Print",
          message: `User ${username} printed all carts (${cartCount} carts) for laundry ticket #${localInvoice.invoiceNumber || localInvoice.id.substring(0, 8)} - Client: ${localInvoice.clientName}`,
          user: username,
        });
      }

      // Update local invoice with print history
      const updatedInvoice = {
        ...localInvoice,
        printHistory: {
          ...localInvoice.printHistory,
          lastPrintAllCarts: printRecord,
          printAllCartsHistory: [
            ...(localInvoice.printHistory?.printAllCartsHistory || []),
            printRecord
          ]
        }
      };
      
      setLocalInvoice(updatedInvoice);
      
      console.log('Print tracking recorded:', printRecord);
    } catch (error) {
      console.error('Error tracking print operation:', error);
      // Don't block the print operation if tracking fails
    }
  };

  // Generate print content function
  const generatePrintContent = () => {

    // Get client print configuration with defaults
    const printConfig = client?.printConfig?.cartPrintSettings || {
      enabled: true,
      showProductDetails: true,
      showProductSummary: false,
      showQuantities: true,
      showPrices: false,
      showCartTotal: true,
      includeTimestamp: true,
      headerText: "Cart Contents",
      footerText: "",
    };

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

                <!-- Cart Name - Top Left (Stacked Format) -->
                <div style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  font-weight: bold;
                  color: #333;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  line-height: 1.0;
                ">
                  <div style="font-size: 24px; margin-bottom: 2px;">CART</div>
                  <div style="font-size: 32px;">${cart.name}</div>
                </div>

                <!-- Client Name & Ticket - Center -->
                <div style="
                  text-align: center;
                  margin-top: 35px;
                ">
                  <div style="
                    font-size: ${localInvoice.clientName.toLowerCase().includes('manati medical center') || localInvoice.clientName.toLowerCase().includes('doctor center manati') || localInvoice.clientName.toLowerCase().includes('mayaguez medical center') || localInvoice.clientName.toLowerCase().includes('camara hiperbarica arecibo') || localInvoice.clientName.toLowerCase().includes('doctor center san juan') || localInvoice.clientName.toLowerCase().includes('doctor center bayamon') || localInvoice.clientName.toLowerCase().includes('doctor center carolina') ? '40px' : '55px'};
                    font-weight: bold;
                    color: #0E62A0;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 4px;
                  ">
                    ${localInvoice.clientName}
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
                  ${localInvoice.clientName.toLowerCase().includes('aloft') || 
                    localInvoice.clientName.toLowerCase().includes('sheraton') || 
                    localInvoice.clientName.toLowerCase().includes('costa bahia') || 
                    localInvoice.clientName.toLowerCase().includes('dorado aquarius') || 
                    localInvoice.clientName.toLowerCase().includes('hyatt') ? `
                    <!-- Product list without quantities for specific clients -->
                    <div style="
                      height: 100%;
                      overflow: hidden;
                    ">
                      <table style="
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 12px;
                      ">
                        <thead>
                          <tr style="border-bottom: 1px solid #333;">
                            <th style="
                              text-align: left;
                              padding: 6px 4px;
                              font-size: 12px;
                              font-weight: bold;
                            ">Products in Cart</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${cart.items.map((item) => `
                            <tr style="border-bottom: 1px solid #eee;">
                              <td style="
                                padding: 6px 4px;
                                font-size: 11px;
                                line-height: 1.3;
                                word-break: break-word;
                              ">${item.productName}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  ` : `
                    <!-- Standard product layout for non-Aloft clients -->
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
                                <th style="
                                  text-align: center;
                                  padding: 4px 2px;
                                  font-size: 10px;
                                  font-weight: bold;
                                  width: 30px;
                                ">Qty</th>
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
                                  <td style="
                                    padding: 3px 2px;
                                    text-align: center;
                                    font-size: 9px;
                                    font-weight: bold;
                                  ">${item.quantity}</td>
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
                                <th style="
                                  text-align: center;
                                  padding: 4px 2px;
                                  font-size: 10px;
                                  font-weight: bold;
                                  width: 30px;
                                ">Qty</th>
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
                                  <td style="
                                    padding: 3px 2px;
                                    text-align: center;
                                    font-size: 9px;
                                    font-weight: bold;
                                  ">${item.quantity}</td>
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
                              <th style="
                                text-align: center;
                                padding: 6px 4px;
                                font-size: 11px;
                                font-weight: bold;
                                width: 60px;
                              ">Qty</th>
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
                                <td style="
                                  padding: 5px 4px;
                                  text-align: center;
                                  font-size: 10px;
                                  font-weight: bold;
                                ">${item.quantity}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    `}
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

    setTimeout(() => {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print All Carts - ${localInvoice.clientName}</title>
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
    }, 100);
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
              Laundry Ticket #{invoice.invoiceNumber}
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
            <div className="d-flex align-items-center mb-3">
              <h6 className="mb-0">
                Delivery Date: {editingDeliveryDate ? (
                  <span style={{ marginLeft: 16 }}>
                    <input
                      type="date"
                      className="form-control d-inline-block"
                      style={{ width: 180, display: "inline-block" }}
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
                  <>
                    <span style={{ marginLeft: 16, color: invoice.deliveryDate ? "#0E62A0" : "#6c757d" }}>
                      {invoice.deliveryDate ? formatDateSpanish(invoice.deliveryDate) : "Not set"}
                    </span>
                    <button
                      className="btn btn-outline-primary btn-sm ms-2"
                      title="Edit Delivery Date"
                      onClick={() => setEditingDeliveryDate(true)}
                    >
                      <i className="bi bi-pencil" />
                    </button>
                  </>
                )}
              </h6>
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
            <h6>Total Carts: {invoice.carts.length}</h6>
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

            {/* Print History Section */}
            {invoice.printHistory?.lastPrintAllCarts && (
              <div className="mb-2">
                <h6 className="text-info mb-1">
                  <i className="bi bi-printer-fill me-2"></i>
                  Print History
                </h6>
                <div className="ms-3">
                  <div className="text-secondary small">
                    <strong>Last Print All Carts:</strong> {invoice.printHistory.lastPrintAllCarts.printedBy}
                    <span className="ms-2">
                      ({formatDateSpanish(invoice.printHistory.lastPrintAllCarts.printedAt)})
                    </span>
                    <span className="ms-2 badge bg-light text-dark">
                      {invoice.printHistory.lastPrintAllCarts.cartCount} carts
                    </span>
                  </div>
                  {invoice.printHistory.printAllCartsHistory && invoice.printHistory.printAllCartsHistory.length > 1 && (
                    <details className="mt-1">
                      <summary className="text-primary small" style={{ cursor: "pointer" }}>
                        View all print operations ({invoice.printHistory.printAllCartsHistory.length})
                      </summary>
                      <div className="mt-2">
                        {invoice.printHistory.printAllCartsHistory
                          .slice()
                          .reverse()
                          .map((printRecord, index) => (
                          <div key={index} className="text-secondary small d-flex justify-content-between py-1">
                            <span>
                              <strong>{printRecord.printedBy}</strong> - {printRecord.cartCount} carts
                            </span>
                            <span className="text-muted">
                              {formatDateSpanish(printRecord.printedAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            )}

            {/* Special Service Delivery Section */}
            <div
              className="mb-3 p-3 border rounded"
              style={{ backgroundColor: "#f8f9fa" }}
            >
              <h6
                className="mb-3"
                style={{ color: "#0E62A0", fontWeight: "bold" }}
              >
                Special Service Delivery
              </h6>
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="specialServiceRequested"
                  checked={invoice.specialServiceRequested || false}
                  onChange={async (e) => {
                    const isChecked = e.target.checked;
                    await onAddCart(`__special_service__${isChecked}`);
                    if (refreshInvoices) await refreshInvoices();
                  }}
                />
                <label
                  className="form-check-label"
                  htmlFor="specialServiceRequested"
                  style={{ fontWeight: "600" }}
                >
                  Special Service Delivery Requested
                </label>
              </div>
            </div>
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
                    <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center gap-2">
                      <button
                        className="btn btn-success"
                        onClick={async () => {
                          // Print all carts functionality
                          await printAllCarts();
                        }}
                        title="Print all carts in this invoice"
                      >
                        <i className="bi bi-printer-fill me-1" />
                        Print All Carts ({localCarts.length})
                      </button>
                      {invoice.printHistory?.lastPrintAllCarts && (
                        <div className="text-secondary small d-flex align-items-center">
                          <i className="bi bi-person-fill me-1"></i>
                          <span>
                            Last printed by: <strong>{invoice.printHistory.lastPrintAllCarts.printedBy}</strong>
                          </span>
                          <span className="text-muted ms-1">
                            ({formatDateSpanish(invoice.printHistory.lastPrintAllCarts.printedAt)})
                          </span>
                        </div>
                      )}
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
                    style={{ maxWidth: 320, margin: "120px auto" }}
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
                              }}                              onClick={async () => {
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
                className="cart-section mb-4 p-2 border rounded"
                style={{
                  background: "#bae6fd", // Darker blue background
                  boxShadow: "0 2px 12px #60a5fa",
                  borderLeft: "6px solid #0ea5e9",
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div>
                    <div
                      style={{
                        fontWeight: 800,
                        color: cart.name
                          .toUpperCase()
                          .startsWith("CARRO SIN NOMBRE")
                          ? "red"
                          : "#0E62A0",
                        marginBottom: 8,
                        lineHeight: 1.1,
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontSize: "14px", marginBottom: "2px" }}>CART</div>
                      <div style={{ fontSize: "24px" }}>{cart.name}</div>
                    </div>
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
                {/* Product Cards Modal for Adding Product */}
                {addProductCartId === cart.id && (
                  <div
                    className="modal show d-block add-product-modal"
                    style={{ background: "rgba(0,0,0,0.15)" }}
                  >
                    <div
                      className="modal-dialog"
                      // style removed, handled by CSS
                    >
                      <div className="modal-content">
                        <div className="modal-header">
                          <h5 className="modal-title">Add Product</h5>
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
                          <div className="row g-3 product-grid">
                            {clientProducts.map((product) => (
                              <div key={product.id} className="col-12 col-md-4 col-lg-4">
                                <div
                                  className={`card mb-2 shadow-sm h-100${
                                    selectedProductId === product.id ? " border-primary" : " border-light"
                                  } product-card-selectable`}
                                  style={{
                                    cursor: "pointer",
                                    minHeight: 120,
                                    borderWidth: selectedProductId === product.id ? 4 : 3,
                                    border: selectedProductId === product.id
                                      ? "4px solid #0E62A0"
                                      : "3px solid #1976d2",
                                    borderRadius: 16,
                                    background: selectedProductId === product.id ? "#eaf4ff" : "#f8fafc",
                                    boxShadow: selectedProductId === product.id
                                      ? "0 0 0 4px #b3d8ff, 0 2px 12px rgba(14,98,160,0.10)"
                                      : "0 2px 10px rgba(25,118,210,0.07)",
                                    transition: "border 0.15s, box-shadow 0.15s"
                                  }}
                                  onClick={() => {
                                    setSelectedProductId(product.id);
                                    setShowProductKeypad({
                                      cartId: cart.id,
                                      productId: product.id,
                                    });
                                    setKeypadQty("");
                                  }}
                                >
                                  <div className="card-body py-2 px-3 text-center">
                                    <div
                                      className="fw-bold"
                                      style={{ fontSize: 22 }}
                                    >
                                      {product.name}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Product quantity keypad modal */}
                {showProductKeypad && (
                  <div
                    className="modal show d-block"
                    tabIndex={-1}
                    style={{ background: "rgba(0,0,0,0.25)", zIndex: 2100 }}
                    onClick={(e) => {
                      if (e.target === e.currentTarget)
                        setShowProductKeypad(null);
                    }}
                  >
                    <div
                      className="modal-dialog"
                      style={{ maxWidth: 320, margin: "120px auto" }}
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
                                        
                                        // 2. Persist to Firestore (parent handler)
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
          className="modal show"
          style={{
            display: "block",
            background: "rgba(0,0,0,0.5)",
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 3000,
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

      {/* Cart Print Modal */}
      {showCartPrintModal &&
        (() => {
          const cart = localInvoice.carts.find((c) => c.id === showCartPrintModal.cartId);
          if (!cart) return null;

          // Get client print configuration with defaults
          const printConfig = client?.printConfig?.cartPrintSettings || {
            enabled: true,
            showProductDetails: true,
            showProductSummary: false,
            showQuantities: true,
            showPrices: false,
            showCartTotal: true,
            includeTimestamp: true,
            headerText: "Cart Contents",
            footerText: "",
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
                        <h6 className="mb-3">📄 Print Preview (6.46" x 4.25")</h6>
                        <div
                          id="cart-print-area"
                          style={{
                            padding: "15px",
                            background: "#fff",
                            width: "8.5in",
                            height: "5.5in",
                            margin: "0 auto",
                            overflowY: "auto",
                            // Exact dimensions to match print output: 8.5" x 5.5" (A5 size)
                            minHeight: "400px",
                          }}
                        >
                          <div
                            style={{
                              maxWidth: "8.5in",
                              height: "auto",
                              margin: "0 auto",
                              background: "#fff",
                              padding: 20,
                              fontFamily: "Arial, sans-serif",
                              fontSize: "14px",
                              minHeight: "4.25in",
                            }}
                          >
                            {/* Header with Large Client Name */}
                            <div
                              style={{
                                marginBottom: 20,
                                borderBottom: "2px solid #333",
                                paddingBottom: 15,
                                position: "relative"
                              }}
                            >
                              {/* Cart Position - Top Right Corner */}
                              {(() => {
                                const cartIndex = localInvoice.carts.findIndex(c => c.id === cart.id);
                                const cartPosition = cartIndex + 1;
                                const totalCarts = localInvoice.carts.length;
                                
                                return (
                                  <div style={{
                                    position: "absolute",
                                    top: "0",
                                    right: "0",
                                    fontSize: "18px",
                                    fontWeight: "bold",
                                    color: "#0E62A0"
                                  }}>
                                    {cartPosition}/{totalCarts}
                                  </div>
                                );
                              })()}

                              {/* Cart Name - Top Left Corner */}
                              <div style={{
                                position: "absolute",
                                top: "0",
                                left: "0",
                                fontSize: "48px",
                                fontWeight: "bold",
                                color: "#333",
                                textTransform: "uppercase",
                                letterSpacing: "1px",
                                lineHeight: "1.2"
                              }}>
                                <div>CART</div>
                                <div>{cart.name}</div>
                              </div>

                              {/* Large Client Name Centered */}
                              <div style={{
                                textAlign: "center",
                                marginBottom: "12px",
                                minHeight: "60px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                paddingLeft: "120px", // Space for cart name
                                paddingRight: "60px"  // Space for cart position
                              }}>
                                <h1 style={{ 
                                  margin: "0", 
                                  fontSize: localInvoice.clientName.toLowerCase().includes('manati medical center') ? "44px" : "64px",
                                  fontWeight: "bold",
                                  color: "#0E62A0",
                                  textTransform: "uppercase",
                                  letterSpacing: "2px",
                                  lineHeight: "1.1",
                                  textAlign: "center",
                                  marginBottom: "8px"
                                }}>
                                  {localInvoice.clientName}
                                </h1>
                                
                                {/* Large Ticket Number */}
                                <div style={{
                                  fontSize: "28px",
                                  fontWeight: "bold",
                                  color: "#333",
                                  textAlign: "center",
                                  letterSpacing: "1px"
                                }}>
                                  Laundry Ticket #{localInvoice.invoiceNumber || localInvoice.id.substring(0, 8)}
                                </div>
                              </div>
                            </div>

                            {/* Cart Contents */}
                            <div style={{ marginBottom: 20 }}>
                              {cart.items.length === 0 ? (
                                <p style={{ fontStyle: "italic", color: "#666", fontSize: "13px" }}>
                                  No items in this cart
                                </p>
                              ) : (
                                <table
                                  style={{
                                    width: "100%",
                                    borderCollapse: "collapse",
                                    marginBottom: "20px",
                                    fontSize: "13px",
                                  }}
                                >
                                  <thead>
                                    <tr style={{ borderBottom: "2px solid #333" }}>
                                      <th
                                        style={{
                                          textAlign: "left",
                                          padding: "8px",
                                          fontSize: "13px",
                                        }}
                                      >
                                        Product
                                      </th>
                                      <th
                                        style={{
                                          textAlign: "center",
                                          padding: "8px",
                                          fontSize: "13px",
                                        }}
                                      >
                                        Qty
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {cart.items.map((item, index) => (
                                      <tr
                                        key={index}
                                        style={{ borderBottom: "1px solid #ddd" }}
                                      >
                                        <td style={{ padding: "6px", fontSize: "12px" }}>
                                          {item.productName}
                                        </td>
                                        <td
                                          style={{
                                            padding: "6px",
                                            textAlign: "center",
                                            fontSize: "12px",
                                          }}
                                        >
                                          {item.quantity}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}

                              {/* Product Summary */}
                              {printConfig.showProductSummary && cart.items.length > 0 && (
                                <div style={{ marginTop: 20 }}>
                                  <h5 style={{ fontSize: "14px", marginBottom: "10px" }}>
                                    Product Summary
                                  </h5>
                                  <table
                                    style={{
                                      width: "100%",
                                      borderCollapse: "collapse",
                                      fontSize: "12px",
                                    }}
                                  >
                                    <thead>
                                      <tr style={{ borderBottom: "1px solid #333" }}>
                                        <th
                                          style={{
                                            textAlign: "left",
                                            padding: "6px",
                                            fontSize: "12px",
                                          }}
                                        >
                                          Product
                                        </th>
                                        <th
                                          style={{
                                            textAlign: "center",
                                            padding: "6px",
                                            fontSize: "12px",
                                          }}
                                        >
                                          Total Qty
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {products
                                        .filter((prod) =>
                                          cart.items.some((item) => item.productId === prod.id)
                                        )
                                        .map((product) => {
                                          const totalQty = cart.items
                                            .filter((item) => item.productId === product.id)
                                            .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                                          return (
                                            <tr key={product.id} style={{ borderBottom: "1px solid #eee" }}>
                                              <td style={{ padding: "5px", fontSize: "11px" }}>
                                                {product.name}
                                              </td>
                                              <td
                                                style={{
                                                  padding: "5px",
                                                  textAlign: "center",
                                                  fontSize: "11px",
                                                  fontWeight: "bold",
                                                }}
                                              >
                                                {totalQty}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* Footer */}
                            {printConfig.footerText && (
                              <div
                                style={{
                                  textAlign: "center",
                                  marginTop: 20,
                                  borderTop: "1px solid #ddd",
                                  paddingTop: 10,
                                  fontSize: "11px",
                                  color: "#666",
                                }}
                              >
                                {printConfig.footerText}
                              </div>
                            )}

                            {/* Delivery Date - Bottom Section */}
                            {localInvoice.deliveryDate && (
                              <div
                                style={{
                                  textAlign: "center",
                                  marginTop: 25,
                                  borderTop: "2px solid #0E62A0",
                                  paddingTop: 15,
                                  fontSize: "16px",
                                  fontWeight: "bold",
                                  color: "#0E62A0",
                                  backgroundColor: "#f0f8ff",
                                  padding: "15px",
                                  borderRadius: "8px",
                                  border: "2px solid #0E62A0"
                                }}
                              >
                                DELIVERY DATE: {formatDateOnlySpanish(localInvoice.deliveryDate)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer d-print-none">
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        const printContents = document.getElementById("cart-print-area")?.innerHTML;
                        if (printContents) {
                          const printWindow = window.open("", "", "height=800,width=600");
                          if (!printWindow) return;
                          setTimeout(() => {
                            printWindow.document.write(`
                            <html>
                              <head>
                                <title>Print Cart: ${cart.name}</title>
                                <style>
                                  @media print {
                                    @page { size: 8.5in 5.5in; margin: 0.25in; }
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
                      📄 Print Cart (6.46" x 4.25")
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
    </div>
  );
};

export default InvoiceDetailsModal;
