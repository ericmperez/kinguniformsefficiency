import { 
  addClient,
  updateClient,
  deleteClient,
  addProduct,
  updateProduct,
  deleteProduct,
  addInvoice,
  updateInvoice,
  deleteInvoice,
  uploadImage,
  propagateProductUpdateToInvoices
} from '../services/firebaseService';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import type { Client, Product, Invoice } from '../types';

/**
 * Custom hook for business logic operations
 * Handles CRUD operations and data manipulation
 */
export const useBusinessLogic = () => {
  
  // Utility: Remove deleted client from all invoices
  const removeClientFromInvoices = (
    clientId: string,
    invoices: Invoice[]
  ): Invoice[] => {
    return invoices.filter((invoice) => invoice.clientId !== clientId);
  };

  // Utility: Remove deleted product from all invoices/carts
  const removeProductFromInvoices = (
    productId: string,
    invoices: Invoice[]
  ): Invoice[] => {
    return invoices.map((invoice) => ({
      ...invoice,
      products: invoice.products.filter((p) => p.id !== productId),
      carts: invoice.carts.map((cart) => ({
        ...cart,
        items: cart.items.filter((item) => item.productId !== productId),
      })),
    }));
  };

  // Utility: Update product info in all invoices/carts
  const updateProductInInvoices = (
    product: Product,
    invoices: Invoice[]
  ): Invoice[] => {
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
  };

  // Utility: Update client info in all invoices
  const updateClientInInvoices = (
    client: Client,
    invoices: Invoice[]
  ): Invoice[] => {
    return invoices.map((invoice) =>
      invoice.clientId === client.id
        ? { ...invoice, clientName: client.name }
        : invoice
    );
  };

  // Client operations
  const handleAddClient = async (
    client: Omit<Client, "id">,
    onSuccess?: (clients: Client[]) => void,
    onError?: (error: any) => void
  ) => {
    try {
      let imageUrl = "";
      const image: File | null = client.image === undefined ? null : client.image;
      
      if (image) {
        const imageRef = ref(storage, `clients/${Date.now()}_${image.name}`);
        await uploadBytes(imageRef, image);
        imageUrl = await getDownloadURL(imageRef);
      }
      
      const newClient: any = {
        ...client,
        image,
        ...(imageUrl ? { imageUrl } : {}),
      };
      
      // Clean undefined values
      Object.keys(newClient).forEach((key) => {
        if (newClient[key] === undefined) {
          delete newClient[key];
        }
      });
      
      const clientId = await addClient(newClient);
      return { ...newClient, id: clientId };
    } catch (error) {
      console.error("Error adding client:", error);
      if (onError) onError(error);
      throw error;
    }
  };

  const handleUpdateClient = async (
    clientId: string,
    updatedClient: Partial<Client>
  ) => {
    try {
      let imageUrl = updatedClient.imageUrl;
      
      if (updatedClient.image) {
        imageUrl = await uploadImage(
          updatedClient.image,
          `clients/${Date.now()}_${updatedClient.image.name}`
        );
      }

      const clientToUpdate = {
        ...updatedClient,
        imageUrl,
      };

      await updateClient(clientId, clientToUpdate);
      return { ...clientToUpdate, id: clientId };
    } catch (error) {
      console.error("Error updating client:", error);
      throw error;
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await deleteClient(clientId);
    } catch (error) {
      console.error("Error deleting client:", error);
      throw error;
    }
  };

  // Product operations
  const handleAddProduct = async (product: Omit<Product, "id">) => {
    try {
      let imageUrl;
      const image: File | null = product.image === undefined ? null : product.image;
      const price: number = (product as any).price !== undefined ? (product as any).price : 0;
      
      if (image) {
        imageUrl = await uploadImage(
          image,
          `products/${Date.now()}_${image.name}`
        );
      }
      
      const newProduct = {
        ...product,
        image,
        price,
        imageUrl,
      };
      
      await addProduct(newProduct);
      return newProduct;
    } catch (error) {
      console.error("Error adding product:", error);
      throw error;
    }
  };

  const handleUpdateProduct = async (
    productId: string,
    updatedProduct: Partial<Product>
  ) => {
    try {
      let imageUrl = updatedProduct.imageUrl;
      
      if (updatedProduct.image) {
        imageUrl = await uploadImage(
          updatedProduct.image,
          `products/${Date.now()}_${updatedProduct.image.name}`
        );
      }
      
      const productToUpdate = {
        ...updatedProduct,
        imageUrl,
      };
      
      await updateProduct(productId, productToUpdate);
      await propagateProductUpdateToInvoices(productId, productToUpdate);
      
      return { ...productToUpdate, id: productId };
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct(productId);
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
  };

  // Invoice operations
  const handleAddInvoice = async (invoice: Omit<Invoice, "id">) => {
    try {
      return await addInvoice(invoice);
    } catch (error) {
      console.error("Error adding invoice:", error);
      throw error;
    }
  };

  const handleUpdateInvoice = async (
    invoiceId: string,
    updatedInvoice: Partial<Invoice>
  ) => {
    try {
      await updateInvoice(invoiceId, updatedInvoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      throw error;
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      await deleteInvoice(invoiceId);
    } catch (error) {
      console.error("Error deleting invoice:", error);
      throw error;
    }
  };

  return {
    // Utility functions
    removeClientFromInvoices,
    removeProductFromInvoices,
    updateProductInInvoices,
    updateClientInInvoices,
    
    // Client operations
    handleAddClient,
    handleUpdateClient,
    handleDeleteClient,
    
    // Product operations
    handleAddProduct,
    handleUpdateProduct,
    handleDeleteProduct,
    
    // Invoice operations
    handleAddInvoice,
    handleUpdateInvoice,
    handleDeleteInvoice,
  };
}; 