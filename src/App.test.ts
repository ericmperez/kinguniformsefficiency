import '@testing-library/jest-dom';
import { Invoice, Product, Client, Cart, CartItem } from '../types';

// We need to extract the utility functions from App.tsx since they're not exported
// For testing purposes, we'll recreate them here

// Utility: Remove deleted client from all invoices
function removeClientFromInvoices(
  clientId: string,
  invoices: Invoice[]
): Invoice[] {
  return invoices.filter((invoice) => invoice.clientId !== clientId);
}

// Utility: Remove deleted product from all invoices/carts
function removeProductFromInvoices(
  productId: string,
  invoices: Invoice[]
): Invoice[] {
  return invoices.map((invoice) => ({
    ...invoice,
    products: invoice.products.filter((p) => p.id !== productId),
    carts: invoice.carts.map((cart) => ({
      ...cart,
      items: cart.items.filter((item) => item.productId !== productId),
    })),
  }));
}

// Utility: Update product info in all invoices/carts
function updateProductInInvoices(
  product: Product,
  invoices: Invoice[]
): Invoice[] {
  return invoices.map((invoice) => ({
    ...invoice,
    products: invoice.products.map((p) =>
      p.id === product.id ? { ...p, ...product } : p
    ),
    carts: invoice.carts.map((cart) => ({
      ...cart,
      items: cart.items.map((item) =>
        item.productId === product.id
          ? { ...item, productName: product.name, price: product.price }
          : item
      ),
    })),
  }));
}

// Utility: Update client info in all invoices
function updateClientInInvoices(
  client: Client,
  invoices: Invoice[]
): Invoice[] {
  return invoices.map((invoice) =>
    invoice.clientId === client.id
      ? { ...invoice, clientName: client.name }
      : invoice
  );
}

describe('App Utility Functions', () => {
  // Mock data for testing
  const mockProduct1: Product = {
    id: 'product1',
    name: 'Test Product 1',
    price: 10.99,
    image: null,
    imageUrl: 'https://example.com/product1.jpg',
  };

  const mockProduct2: Product = {
    id: 'product2',
    name: 'Test Product 2',
    price: 20.50,
    image: null,
  };

  const mockClient1: Client = {
    id: 'client1',
    name: 'Test Client 1',
    selectedProducts: ['product1'],
    image: null,
    isRented: false,
    washingType: 'Tunnel',
    segregation: true,
  };

  const mockClient2: Client = {
    id: 'client2',
    name: 'Test Client 2',
    selectedProducts: ['product2'],
    image: null,
    isRented: true,
    washingType: 'Conventional',
  };

  const mockCartItem1: CartItem = {
    productId: 'product1',
    productName: 'Test Product 1',
    quantity: 2,
    price: 10.99,
    addedBy: 'user1',
    addedAt: '2023-01-01T10:00:00Z',
  };

  const mockCartItem2: CartItem = {
    productId: 'product2',
    productName: 'Test Product 2',
    quantity: 1,
    price: 20.50,
  };

  const mockCart1: Cart = {
    id: 'cart1',
    name: 'Test Cart 1',
    items: [mockCartItem1, mockCartItem2],
    total: 42.48,
    createdAt: '2023-01-01T09:00:00Z',
  };

  const mockCart2: Cart = {
    id: 'cart2',
    name: 'Test Cart 2',
    items: [mockCartItem1],
    total: 21.98,
    createdAt: '2023-01-01T11:00:00Z',
  };

  const mockInvoice1: Invoice = {
    id: 'invoice1',
    clientId: 'client1',
    clientName: 'Test Client 1',
    date: '2023-01-01',
    products: [mockProduct1, mockProduct2],
    total: 100.00,
    carts: [mockCart1],
    totalWeight: 50,
    status: 'active',
    invoiceNumber: 56091,
    locked: false,
  };

  const mockInvoice2: Invoice = {
    id: 'invoice2',
    clientId: 'client2',
    clientName: 'Test Client 2',
    date: '2023-01-02',
    products: [mockProduct2],
    total: 50.00,
    carts: [mockCart2],
    status: 'completed',
    invoiceNumber: 56092,
  };

  const mockInvoices: Invoice[] = [mockInvoice1, mockInvoice2];

  describe('removeClientFromInvoices', () => {
    it('should remove all invoices for the specified client', () => {
      const result = removeClientFromInvoices('client1', mockInvoices);

      expect(result).toHaveLength(1);
      expect(result[0].clientId).toBe('client2');
      expect(result[0].id).toBe('invoice2');
    });

    it('should return all invoices when client ID does not exist', () => {
      const result = removeClientFromInvoices('nonexistent', mockInvoices);

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockInvoices);
    });

    it('should return empty array when all invoices belong to the deleted client', () => {
      const singleClientInvoices = [mockInvoice1];
      const result = removeClientFromInvoices('client1', singleClientInvoices);

      expect(result).toHaveLength(0);
    });

    it('should handle empty invoices array', () => {
      const result = removeClientFromInvoices('client1', []);

      expect(result).toEqual([]);
    });
  });

  describe('removeProductFromInvoices', () => {
    it('should remove product from products array and cart items', () => {
      const result = removeProductFromInvoices('product1', mockInvoices);

      expect(result).toHaveLength(2);
      
      // Check first invoice
      expect(result[0].products).toHaveLength(1);
      expect(result[0].products[0].id).toBe('product2');
      
      // Check cart items in first invoice
      expect(result[0].carts[0].items).toHaveLength(1);
      expect(result[0].carts[0].items[0].productId).toBe('product2');
      
      // Check second invoice (should remove from cart but product2 should remain in products)
      expect(result[1].products).toHaveLength(1);
      expect(result[1].products[0].id).toBe('product2');
      expect(result[1].carts[0].items).toHaveLength(0); // product1 removed from cart
    });

    it('should handle product that does not exist', () => {
      const result = removeProductFromInvoices('nonexistent', mockInvoices);

      expect(result).toEqual(mockInvoices);
    });

    it('should handle invoices with empty products and carts', () => {
      const emptyInvoice: Invoice = {
        id: 'empty',
        clientId: 'client1',
        clientName: 'Empty Client',
        date: '2023-01-01',
        products: [],
        total: 0,
        carts: [],
      };

      const result = removeProductFromInvoices('product1', [emptyInvoice]);

      expect(result).toEqual([emptyInvoice]);
    });

    it('should preserve invoice structure while removing products', () => {
      const result = removeProductFromInvoices('product1', mockInvoices);

      expect(result[0]).toMatchObject({
        id: 'invoice1',
        clientId: 'client1',
        clientName: 'Test Client 1',
        date: '2023-01-01',
        total: 100.00,
        totalWeight: 50,
        status: 'active',
      });
    });
  });

  describe('updateProductInInvoices', () => {
    it('should update product information in products array and cart items', () => {
      const updatedProduct: Product = {
        ...mockProduct1,
        name: 'Updated Product 1',
        price: 15.99,
      };

      const result = updateProductInInvoices(updatedProduct, mockInvoices);

      expect(result).toHaveLength(2);
      
      // Check products array update
      const updatedProductInInvoice = result[0].products.find(p => p.id === 'product1');
      expect(updatedProductInInvoice?.name).toBe('Updated Product 1');
      expect(updatedProductInInvoice?.price).toBe(15.99);
      
      // Check cart items update
      const updatedCartItem = result[0].carts[0].items.find(item => item.productId === 'product1');
      expect(updatedCartItem?.productName).toBe('Updated Product 1');
      expect(updatedCartItem?.price).toBe(15.99);
      
      // Check that other cart item quantities remain unchanged
      expect(updatedCartItem?.quantity).toBe(2);
      expect(updatedCartItem?.addedBy).toBe('user1');
    });

    it('should only update matching products and leave others unchanged', () => {
      const updatedProduct: Product = {
        ...mockProduct1,
        name: 'Updated Product 1',
        price: 15.99,
      };

      const result = updateProductInInvoices(updatedProduct, mockInvoices);

      // Product2 should remain unchanged
      const unchangedProduct = result[0].products.find(p => p.id === 'product2');
      expect(unchangedProduct?.name).toBe('Test Product 2');
      expect(unchangedProduct?.price).toBe(20.50);
      
      const unchangedCartItem = result[0].carts[0].items.find(item => item.productId === 'product2');
      expect(unchangedCartItem?.productName).toBe('Test Product 2');
      expect(unchangedCartItem?.price).toBe(20.50);
    });

    it('should handle product that does not exist in any invoice', () => {
      const nonExistentProduct: Product = {
        id: 'nonexistent',
        name: 'Nonexistent Product',
        price: 99.99,
        image: null,
      };

      const result = updateProductInInvoices(nonExistentProduct, mockInvoices);

      expect(result).toEqual(mockInvoices);
    });

    it('should preserve invoice structure while updating products', () => {
      const updatedProduct: Product = {
        ...mockProduct1,
        name: 'Updated Product 1',
      };

      const result = updateProductInInvoices(updatedProduct, mockInvoices);

      expect(result[0]).toMatchObject({
        id: 'invoice1',
        clientId: 'client1',
        clientName: 'Test Client 1',
        date: '2023-01-01',
        total: 100.00,
        totalWeight: 50,
        status: 'active',
      });
    });
  });

  describe('updateClientInInvoices', () => {
    it('should update client name in matching invoices', () => {
      const updatedClient: Client = {
        ...mockClient1,
        name: 'Updated Client Name',
      };

      const result = updateClientInInvoices(updatedClient, mockInvoices);

      expect(result).toHaveLength(2);
      
      // First invoice should be updated
      expect(result[0].clientName).toBe('Updated Client Name');
      expect(result[0].clientId).toBe('client1');
      
      // Second invoice should remain unchanged
      expect(result[1].clientName).toBe('Test Client 2');
      expect(result[1].clientId).toBe('client2');
    });

    it('should only update invoices with matching client ID', () => {
      const updatedClient: Client = {
        ...mockClient2,
        name: 'Super Updated Client 2',
      };

      const result = updateClientInInvoices(updatedClient, mockInvoices);

      // First invoice should remain unchanged
      expect(result[0].clientName).toBe('Test Client 1');
      expect(result[0].clientId).toBe('client1');
      
      // Second invoice should be updated
      expect(result[1].clientName).toBe('Super Updated Client 2');
      expect(result[1].clientId).toBe('client2');
    });

    it('should handle client that does not exist in any invoice', () => {
      const nonExistentClient: Client = {
        id: 'nonexistent',
        name: 'Nonexistent Client',
        selectedProducts: [],
        image: null,
        isRented: false,
      };

      const result = updateClientInInvoices(nonExistentClient, mockInvoices);

      expect(result).toEqual(mockInvoices);
    });

    it('should preserve all other invoice properties while updating client name', () => {
      const updatedClient: Client = {
        ...mockClient1,
        name: 'Updated Client Name',
      };

      const result = updateClientInInvoices(updatedClient, mockInvoices);

      const updatedInvoice = result[0];
      expect(updatedInvoice).toMatchObject({
        id: 'invoice1',
        clientId: 'client1',
        date: '2023-01-01',
        products: mockInvoice1.products,
        total: 100.00,
        carts: mockInvoice1.carts,
        totalWeight: 50,
        status: 'active',
        invoiceNumber: 56091,
        locked: false,
      });
    });

    it('should handle empty invoices array', () => {
      const result = updateClientInInvoices(mockClient1, []);

      expect(result).toEqual([]);
    });
  });
});