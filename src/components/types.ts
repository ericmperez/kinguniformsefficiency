export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  image?: File;
  imageUrl?: string;
  selectedProducts: string[];  // Array of product IDs
  isRented: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image?: File;
  imageUrl?: string;
}

export interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  total: number;
  cartId?: string;
  status?: string; // Add status for invoice status tracking
}

export interface LaundryCart {
  id: string;
  name: string;
  isActive: boolean;
}