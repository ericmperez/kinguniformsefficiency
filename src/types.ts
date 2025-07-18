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
  status?: string; // Add status for invoice status tracking
  invoiceNumber?: number; // Optional invoiceNumber property for sequential numbering
  locked?: boolean; // If true, invoice is locked and not editable
  verified?: boolean; // If true, invoice is verified
  partiallyVerified?: boolean; // If true, invoice is partially verified
  verifiedBy?: string; // User ID who verified
  verifiedAt?: string; // Timestamp of verification
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
}

export interface LaundryCart {
  id: string;
  name: string;
  isActive: boolean;
}