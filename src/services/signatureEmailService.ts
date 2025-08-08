import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Client, Invoice } from '../types';
import { sendSignatureEmail } from './emailService';
import { generateLaundryTicketPDF } from './pdfService';
import { generateSimpleLaundryTicketPDF } from './simplePdfService';
import { logActivity } from './firebaseService';

export interface SignatureEmailData {
  receivedBy: string;
  signatureDate: string;
  signatureTime: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  deviceInfo?: {
    userAgent: string;
    platform: string;
  };
  offlineSignature?: boolean;
}

/**
 * Service to handle sending PDF emails when signatures are received
 * Works for both online and offline signature capture
 */
export class SignatureEmailService {
  
  /**
   * Send signature confirmation email with PDF attachment
   * @param invoiceId - The invoice ID
   * @param clientId - The client ID
   * @param signatureData - Signature information
   * @param invoice - Optional invoice data (if already available)
   * @returns Promise<boolean> - Success status
   */
  public static async sendSignatureEmail(
    invoiceId: string,
    clientId: string,
    signatureData: SignatureEmailData,
    invoice?: Invoice
  ): Promise<boolean> {
    try {
      console.log('📧 SignatureEmailService - Starting email process for invoice:', invoiceId);

      // Get client configuration from Firestore
      const clientRef = doc(db, "clients", clientId);
      const clientSnap = await getDoc(clientRef);
      
      if (!clientSnap.exists()) {
        console.log("❌ Client not found for signature email:", clientId);
        return false;
      }

      const client = { id: clientSnap.id, ...clientSnap.data() } as Client;

      // Check if signature email is enabled
      const emailSettings = client.printConfig?.emailSettings;
      if (!emailSettings?.enabled || !emailSettings?.autoSendOnSignature) {
        console.log("ℹ️ Signature email not enabled for client:", client.name);
        return false;
      }

      if (!client.email) {
        console.log("❌ Client has no email address configured:", client.name);
        return false;
      }

      // Get invoice data if not provided
      let invoiceData = invoice;
      if (!invoiceData) {
        const invoiceRef = doc(db, "invoices", invoiceId);
        const invoiceSnap = await getDoc(invoiceRef);
        
        if (!invoiceSnap.exists()) {
          console.log("❌ Invoice not found for signature email:", invoiceId);
          return false;
        }
        
        invoiceData = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;
      }

      // Generate PDF for attachment
      let pdfContent: string | undefined;
      try {
        console.log('📄 Generating PDF for signature email...');
        
        // Try the simple PDF service first (more reliable for email context)
        try {
          pdfContent = await generateSimpleLaundryTicketPDF(invoiceData, client);
          console.log('✅ PDF generated successfully using simple PDF service');
        } catch (simpleError) {
          console.log('⚠️ Simple PDF service failed, trying standard PDF service...');
          // Fallback to the standard PDF service
          pdfContent = await generateLaundryTicketPDF(invoiceData, client);
          console.log('✅ PDF generated successfully using standard PDF service');
        }
      } catch (err) {
        console.error("❌ Failed to generate PDF for signature email:", err);
        // Continue without PDF attachment - email will be sent as text only
        console.log("📧 Continuing with text-only email...");
      }

      // Send signature email
      const success = await sendSignatureEmail(
        client,
        invoiceData,
        emailSettings,
        {
          receivedBy: signatureData.receivedBy,
          signatureDate: signatureData.signatureDate,
          signatureTime: signatureData.signatureTime,
        },
        pdfContent
      );

      if (success) {
        // Log the email activity
        await logActivity({
          type: "Email",
          message: `Signature confirmation email sent automatically to ${client.name} (${client.email}) for laundry ticket #${invoiceData.invoiceNumber || invoiceData.id}${signatureData.offlineSignature ? ' (offline signature)' : ''}`,
        });
        
        console.log("✅ Signature email sent successfully to:", client.email);
        return true;
      } else {
        console.log("❌ Failed to send signature email to:", client.email);
        return false;
      }
    } catch (error) {
      console.error("❌ Error sending signature email:", error);
      return false;
    }
  }

  /**
   * Check if a client has signature email enabled
   * @param clientId - The client ID
   * @returns Promise<boolean> - Whether signature email is enabled
   */
  public static async isSignatureEmailEnabled(clientId: string): Promise<boolean> {
    try {
      const clientRef = doc(db, "clients", clientId);
      const clientSnap = await getDoc(clientRef);
      
      if (!clientSnap.exists()) {
        return false;
      }

      const client = { id: clientSnap.id, ...clientSnap.data() } as Client;
      const emailSettings = client.printConfig?.emailSettings;
      
      return !!(emailSettings?.enabled && emailSettings?.autoSendOnSignature && client.email);
    } catch (error) {
      console.error("❌ Error checking signature email status:", error);
      return false;
    }
  }

  /**
   * Get client email configuration
   * @param clientId - The client ID
   * @returns Promise<{client: Client, emailSettings: any} | null> - Client and email settings
   */
  public static async getClientEmailConfig(clientId: string): Promise<{client: Client, emailSettings: any} | null> {
    try {
      const clientRef = doc(db, "clients", clientId);
      const clientSnap = await getDoc(clientRef);
      
      if (!clientSnap.exists()) {
        return null;
      }

      const client = { id: clientSnap.id, ...clientSnap.data() } as Client;
      const emailSettings = client.printConfig?.emailSettings;
      
      return { client, emailSettings };
    } catch (error) {
      console.error("❌ Error getting client email config:", error);
      return null;
    }
  }
}
