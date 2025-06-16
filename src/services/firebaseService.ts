import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs,
  query,
  where,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Client, Product, Invoice, LaundryCart, PickupEntry } from "../types";

// Client operations
export const addClient = async (client: Omit<Client, "id">): Promise<string> => {
  try {
    console.log("Adding client to Firebase:", client);
    const docRef = await addDoc(collection(db, "clients"), client);
    console.log("Client added with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error adding client:", error);
    throw error;
  }
};

export const updateClient = async (clientId: string, client: any) => {
  const clientRef = doc(db, 'clients', clientId);
  // Sanitize client object to remove undefined fields
  const sanitizedClient = sanitizeForFirestore({
    ...client,
    selectedProducts: client.selectedProducts || [],
    isRented: client.isRented || false
  });
  await updateDoc(clientRef, sanitizedClient);
};

export const deleteClient = async (clientId: string) => {
  await deleteDoc(doc(db, 'clients', clientId));
};

export const getClients = async (): Promise<Client[]> => {
  try {
    console.log("Fetching clients from Firebase");
    const querySnapshot = await getDocs(collection(db, "clients"));
    const clients = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Client[];
    console.log("Fetched clients:", clients);
    return clients;
  } catch (error) {
    console.error("Error fetching clients:", error);
    throw error;
  }
};

// Product operations
export const addProduct = async (product: Omit<Product, "id">): Promise<string> => {
  try {
    // Sanitize product object to remove undefined fields
    const sanitizedProduct = sanitizeForFirestore(product);
    console.log("Adding product to Firebase:", sanitizedProduct);
    const docRef = await addDoc(collection(db, "products"), sanitizedProduct);
    console.log("Product added with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error adding product:", error);
    throw error;
  }
};

export const updateProduct = async (productId: string, product: any) => {
  const productRef = doc(db, 'products', productId);
  await updateDoc(productRef, product);
};

export const deleteProduct = async (productId: string) => {
  await deleteDoc(doc(db, 'products', productId));
};

export const getProducts = async (): Promise<Product[]> => {
  try {
    console.log("Fetching products from Firebase");
    const querySnapshot = await getDocs(collection(db, "products"));
    const products = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Product[];
    console.log("Fetched products:", products);
    return products;
  } catch (error) {
    console.error("Error fetching products:", error);
    throw error;
  }
};

// Invoice operations
export const addInvoice = async (invoice: Omit<Invoice, "id">): Promise<string> => {
  try {
    console.log("Adding invoice to Firebase:", invoice);
    const docRef = await addDoc(collection(db, "invoices"), invoice);
    console.log("Invoice added with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error adding invoice:", error);
    throw error;
  }
};

// Utility to deeply sanitize invoice/cart data before sending to Firestore
function sanitizeForFirestore(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  } else if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue; // Firestore does not allow undefined fields
      if (value === null) {
        sanitized[key] = null;
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeForFirestore(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  return obj;
}

export const updateInvoice = async (
  invoiceId: string,
  invoice: Partial<Invoice>
): Promise<void> => {
  try {
    console.log("Updating invoice in Firebase:", { invoiceId, invoice });
    const invoiceRef = doc(db, "invoices", invoiceId);
    const invoiceDoc = await getDoc(invoiceRef);
    if (!invoiceDoc.exists()) {
      throw new Error(`Invoice with ID ${invoiceId} does not exist`);
    }
    // Sanitize invoice data before sending to Firestore
    const sanitizedInvoice = sanitizeForFirestore({
      ...invoice,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(invoiceRef, sanitizedInvoice);
    console.log("Invoice updated successfully");
  } catch (error) {
    console.error("Error updating invoice:", error);
    throw error;
  }
};

export const assignCartToInvoice = async (
  invoiceId: string,
  cart: { id: string; name: string }
): Promise<void> => {
  const invoiceRef = doc(db, "invoices", invoiceId);
  await updateDoc(invoiceRef, {
    cart,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteInvoice = async (invoiceId: string) => {
  await deleteDoc(doc(db, 'invoices', invoiceId));
};

export const getInvoices = async (): Promise<Invoice[]> => {
  try {
    console.log("Fetching invoices from Firebase");
    const querySnapshot = await getDocs(collection(db, "invoices"));
    const invoices = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Invoice[];
    console.log("Fetched invoices:", invoices);
    return invoices;
  } catch (error) {
    console.error("Error fetching invoices:", error);
    throw error;
  }
};

// Image upload
export const uploadImage = async (file: File, path: string): Promise<string> => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

export { uploadBytes, getDownloadURL };

// Pickup operations
export async function savePickupEntry(entry: PickupEntry) {
  await addDoc(collection(db, "pickup_entries"), entry);
}

export async function fetchPickupEntries({ clientId, driver, start, end }: { clientId?: string; driver?: string; start?: Date; end?: Date }) {
  let q: any = collection(db, "pickup_entries");
  const filters: any[] = [];
  if (clientId) filters.push(where("clientId", "==", clientId));
  if (driver) filters.push(where("driver", "==", driver));
  if (start) filters.push(where("timestamp", ">=", start.toISOString()));
  if (end) filters.push(where("timestamp", "<=", end.toISOString()));
  if (filters.length) {
    q = query(q, ...filters);
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as object) }) as PickupEntry);
  } else {
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as object) }) as PickupEntry);
  }
}

export async function updatePickupEntry(id: string, data: Partial<PickupEntry>) {
  const entryRef = doc(db, "pickup_entries", id);
  await updateDoc(entryRef, data);
}

export async function deletePickupEntry(id: string) {
  const entryRef = doc(db, "pickup_entries", id);
  await deleteDoc(entryRef);
}