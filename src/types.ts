export interface Product {
  id: string;
  name: string;
  price: number;
  image: File | null;
  imageUrl?: string;
}

export interface Client {
  id: string;
  name: string;
  selectedProducts: string[];
  image: File | null;
  imageUrl?: string;
  isRented: boolean;
  washingType?: "Tunnel" | "Conventional";
  segregation?: boolean;
  billingCalculation?: "byWeight" | "byItem";
  email?: string; // Optional email property
  needsInvoice?: boolean; // New field: does this client require invoice creation?
  printConfig?: PrintConfiguration; // Print configuration for this client
}

export interface PrintConfiguration {
  // Cart printing settings
  cartPrintSettings: {
    enabled: boolean;
    showProductDetails: boolean;
    showQuantities: boolean;
    showPrices: boolean;
    showCartTotal: boolean;
    includeTimestamp: boolean;
    headerText?: string;
    footerText?: string;
  };
  // Invoice printing settings
  invoicePrintSettings: {
    enabled: boolean;
    showClientInfo: boolean;
    showInvoiceNumber: boolean;
    showDate: boolean;
    showCartBreakdown: boolean;
    showProductSummary: boolean;
    showTotalWeight: boolean;
    showSubtotal: boolean;
    showTaxes: boolean;
    showGrandTotal: boolean;
    includeSignature: boolean;
    headerText?: string;
    footerText?: string;
    logoUrl?: string;
  };
  // Email settings
  emailSettings: {
    enabled: boolean;
    autoSendOnApproval: boolean;
    autoSendOnShipping: boolean;
    ccEmails?: string[];
    subject?: string;
    bodyTemplate?: string;
  };
}

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  addedBy?: string; // Name or ID of the user who added the item
  addedAt?: string; // Timestamp when the item was added
  editedBy?: string; // Name or ID of the user who last edited the item
  editedAt?: string; // Timestamp when the item was last edited
}

export interface Cart {
  id: string;
  name: string;
  items: CartItem[];
  total: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  products: Product[];
  total: number;
  carts: Cart[];
  totalWeight?: number; // Add totalWeight for tunnel invoices
  status?: "completed" | "done" | "active" | "deleted" | string; // Add status for invoice status tracking
  invoiceNumber?: number; // Optional invoiceNumber property for sequential numbering
  locked?: boolean; // If true, invoice is locked and not editable
  verified?: boolean; // If true, invoice is approved
  partiallyVerified?: boolean; // If true, invoice is partially approved  
  verifiedBy?: string; // User ID who approved
  verifiedAt?: string; // Timestamp of approval
  verifiedProducts?: { [cartId: string]: string[] }; // Product IDs checked per cart
  lockedBy?: string; // User ID or username who closed the invoice
  lockedAt?: string; // Timestamp when invoice was closed
  note?: string; // Public note for all users to see
  truckNumber?: string; // Add truck number for shipped invoices
  deliveryDate?: string; // Add delivery date for shipped invoices
  pickupGroupId?: string; // Link to pickup group if present
  name?: string; // Optional invoice-level name
  highlight?: "yellow" | "blue"; // Real-time highlight sync
  specialServiceRequested?: boolean; // Flag for special service delivery
  specialServiceCost?: number; // Cost for special service delivery
  signature?: { // Digital signature
    image: string; // Data URL of the signature
    name: string; // Name of person who signed
    timestamp: any; // Firebase Timestamp when signature was captured
  };
  receivedBy?: string; // Name of the person who received the delivery
}

export interface LaundryCart {
  id: string;
  name: string;
  isActive: boolean;
}