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
}

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  addedBy?: string; // Name or ID of the user who added the item
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
}

export interface LaundryCart {
  id: string;
  name: string;
  isActive: boolean;
}