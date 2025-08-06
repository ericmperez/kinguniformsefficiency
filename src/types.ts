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
    showProductSummary: boolean;
    showQuantities: boolean;
    showPrices: boolean;
    showCartTotal: boolean;
    includeTimestamp: boolean;
    headerText?: string;
    footerText?: string;
    clientNameFontSize?: 'small' | 'medium' | 'large'; // Size option for client name display
  };
  // Invoice printing settings
  invoicePrintSettings: {
    enabled: boolean;
    showClientInfo: boolean;
    showInvoiceNumber: boolean;
    showDate: boolean;
    showPickupDate: boolean;
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
    autoSendOnSignature?: boolean;
    ccEmails?: string[];
    subject?: string;
    bodyTemplate?: string;
    signatureEmailSubject?: string;
    signatureEmailTemplate?: string;
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
  createdBy?: string; // Name or ID of the user who created the cart
  lastModifiedAt?: string; // When cart content was last modified
  lastModifiedBy?: string; // Who last modified the cart
  lastPrintedAt?: string; // When cart was last printed
  lastPrintedBy?: string; // Who last printed the cart
  needsReprint?: boolean; // True if cart was modified after last print
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
  groupedInvoiceNumber?: string; // Custom invoice number when invoices are grouped
  locked?: boolean; // If true, invoice is locked and not editable
  verified?: boolean; // If true, invoice is approved
  partiallyVerified?: boolean; // If true, invoice is partially approved
  manglesCompleted?: boolean; // If true, "Mangles - Arriba" (top part) is completed
  dobladoCompleted?: boolean; // If true, "Doblado - Abajo" (bottom part) is completed  
  verifiedBy?: string; // User ID who approved
  verifiedAt?: string; // Timestamp of approval
  verifiedProducts?: { [cartId: string]: string[] }; // Product IDs checked per cart
  lockedBy?: string; // User ID or username who closed the invoice
  lockedAt?: string; // Timestamp when invoice was closed
  note?: string; // Public note for all users to see
  truckNumber?: string; // Add truck number for shipped invoices
  deliveryDate?: string; // Add delivery date for shipped invoices
  deliveryMethod?: "truck" | "client_pickup"; // Delivery method for the invoice
  pickupGroupId?: string; // Link to pickup group if present
  name?: string; // Optional invoice-level name
  highlight?: "yellow" | "blue"; // Real-time highlight sync
  specialServiceRequested?: boolean; // Flag for special service delivery
  specialServiceCost?: number; // Cost for special service delivery
  signature?: { // Digital signature
    image: string; // Data URL of the signature
    name: string; // Name of person who signed
    timestamp: any; // Firebase Timestamp when signature was captured
    noPersonnelAvailable?: boolean; // Flag if no personnel was available to sign
  };
  receivedBy?: string; // Name of the person who received the delivery
  shippingComplete?: boolean; // Whether truck loading/shipping is complete
  shippingCompletedAt?: string; // Timestamp when shipping was marked complete
  shippingCompletedBy?: string; // Username of person who marked shipping complete
  emailStatus?: { // Email delivery tracking
    approvalEmailSent?: boolean; // Whether email was sent on approval
    approvalEmailSentAt?: string; // Timestamp when approval email was sent
    shippingEmailSent?: boolean; // Whether email was sent on shipping
    shippingEmailSentAt?: string; // Timestamp when shipping email was sent
    lastEmailError?: string; // Last email error if any
  };
  printHistory?: { // Print operation tracking
    printAllCartsHistory?: Array<{
      printedBy: string; // Username of person who performed "Print All Carts"
      printedAt: string; // Timestamp when print was executed
      cartCount: number; // Number of carts that were printed
    }>;
    lastPrintAllCarts?: {
      printedBy: string; // Most recent "Print All Carts" user
      printedAt: string; // Most recent "Print All Carts" timestamp
      cartCount: number; // Number of carts in most recent print
    };
  };
}

export interface LaundryCart {
  id: string;
  name: string;
  isActive: boolean;
}

export interface TruckLoadingVerification {
  id: string;
  invoiceId: string;
  truckNumber: string;
  verifiedBy: string;
  verifiedAt: string;
  verifiedDate?: string;
  isVerified?: boolean;
  actualCartCount?: number;
  expectedCartCount?: number;
  tripNumber?: number;
  tripType?: string;
  truckDiagram?: any[];
  notes?: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    verified: boolean;
  }[];
}

export interface TruckPosition {
  row: number;
  col: number;
  clientId?: string | null;
  clientName?: string | null;
  color?: string | null;
  cartCount?: number;
  invoiceData?: {
    id: string;
    clientName: string;
    total: number;
  };
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  submittedBy: string; // User ID who submitted
  submittedByName: string; // User name for display
  status: 'pending' | 'reviewed' | 'approved' | 'rejected' | 'implemented';
  priority: 'low' | 'medium' | 'high';
  category: 'feature' | 'improvement' | 'bug' | 'other';
  createdAt: Date | string;
  updatedAt: Date | string;
  reviewedBy?: string; // User ID who reviewed
  reviewedByName?: string; // User name for display
  reviewNotes?: string;
}