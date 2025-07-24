/**
 * Email Service
 * 
 * This service has been simplified to focus only on email functionality.
 * PDF generation has been removed, and emails now directly include processing summaries based on client billing type:
 * - For weight-based clients: Shows total pounds processed
 * - For piece-based clients: Shows itemized breakdown of pieces processed
 * 
 * The generateInvoicePDF function remains as a stub to maintain compatibility with existing code,
 * but it returns undefined instead of generating PDFs.
 */
import { Client, Invoice, PrintConfiguration } from "../types";

export interface EmailData {
  to: string;
  cc?: string[];
  subject: string;
  body: string;
}

// Simplified function that returns undefined instead of generating a PDF
// This maintains compatibility with existing code while we transition to email-only functionality
export const generateInvoicePDF = async (
  client: Client,
  invoice: Invoice,
  printConfig: PrintConfiguration["invoicePrintSettings"]
): Promise<string | undefined> => {
  console.log("PDF generation removed - focusing on email functionality only");
  return undefined;
};

export const sendInvoiceEmail = async (
  client: Client,
  invoice: Invoice,
  emailSettings: PrintConfiguration["emailSettings"],
  pdfContent?: string // Optional parameter for backward compatibility
): Promise<boolean> => {
  try {
    const emailData: EmailData = {
      to: client.email || "",
      cc: emailSettings.ccEmails || [],
      subject: emailSettings.subject || `Invoice #${invoice.invoiceNumber || invoice.id} - ${client.name}`,
      body: generateEmailBody(client, invoice, emailSettings.bodyTemplate)
    };

    // Log the email details
    console.log("📧 Email Service - Sending email:", {
      to: emailData.to,
      cc: emailData.cc,
      subject: emailData.subject,
      bodyPreview: emailData.body.substring(0, 100) + "..."
    });
    
    if (pdfContent) {
      // Use the API endpoint that supports PDF attachments
      try {
        const response = await fetch('/api/send-invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: emailData.to,
            subject: emailData.subject,
            text: emailData.body,
            pdfBase64: pdfContent.split(',')[1] || pdfContent
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          console.error("❌ Email server error:", data.error);
          return false;
        }
        
        return true;
      } catch (fetchError) {
        console.error("❌ Failed to connect to email server:", fetchError);
        return false;
      }
    } else {
      // Use the test email endpoint for emails without attachments
      try {
        const response = await fetch('/api/send-test-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: emailData.to,
            cc: emailData.cc,
            subject: emailData.subject,
            body: emailData.body
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          console.error("❌ Email server error:", data.error);
          return false;
        }
        
        return true;
      } catch (fetchError) {
        console.error("❌ Failed to connect to email server:", fetchError);
        return false;
      }
    }
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
};

// New function to send signature-specific emails
export const sendSignatureEmail = async (
  client: Client,
  invoice: Invoice,
  emailSettings: PrintConfiguration["emailSettings"],
  signatureData: {
    receivedBy: string;
    signatureDate: string;
    signatureTime: string;
  },
  pdfContent?: string
): Promise<boolean> => {
  try {
    // Use signature-specific template if available, otherwise fall back to regular template
    const subject = emailSettings.signatureEmailSubject || 
      emailSettings.subject || 
      `Delivery Confirmed - Invoice #${invoice.invoiceNumber || invoice.id} for ${client.name}`;
    
    const template = emailSettings.signatureEmailTemplate || 
      emailSettings.bodyTemplate;

    const emailData: EmailData = {
      to: client.email || "",
      cc: emailSettings.ccEmails || [],
      subject: subject,
      body: generateSignatureEmailBody(client, invoice, signatureData, template)
    };

    // Log the signature email details
    console.log("📧 Signature Email Service - Sending signature email:", {
      to: emailData.to,
      cc: emailData.cc,
      subject: emailData.subject,
      signatureData: signatureData,
      bodyPreview: emailData.body.substring(0, 100) + "..."
    });
    
    if (pdfContent) {
      // Use the API endpoint that supports PDF attachments
      try {
        const response = await fetch('/api/send-invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: emailData.to,
            subject: emailData.subject,
            text: emailData.body,
            pdfBase64: pdfContent.split(',')[1] || pdfContent
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          console.error("❌ Signature email server error:", data.error);
          return false;
        }
        
        return true;
      } catch (fetchError) {
        console.error("❌ Failed to connect to email server for signature email:", fetchError);
        return false;
      }
    } else {
      // Use the test email endpoint for emails without attachments
      try {
        const response = await fetch('/api/send-test-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: emailData.to,
            cc: emailData.cc,
            subject: emailData.subject,
            body: emailData.body
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          console.error("❌ Signature email server error:", data.error);
          return false;
        }
        
        return true;
      } catch (fetchError) {
        console.error("❌ Failed to connect to email server for signature email:", fetchError);
        return false;
      }
    }
  } catch (error) {
    console.error("Failed to send signature email:", error);
    return false;
  }
};

const generateEmailBody = (
  client: Client,
  invoice: Invoice,
  template?: string
): string => {
  // Generate a summary of items or weight based on the client's billing calculation method
  const getProcessingSummary = () => {
    if (client.billingCalculation === "byWeight" && invoice.totalWeight) {
      return `Total Pounds Processed: ${invoice.totalWeight.toFixed(2)} lbs`;
    } else {
      // Generate a breakdown of pieces
      const itemSummary = invoice.carts.reduce((summary, cart) => {
        cart.items.forEach(item => {
          if (!summary[item.productName]) {
            summary[item.productName] = 0;
          }
          summary[item.productName] += item.quantity;
        });
        return summary;
      }, {} as Record<string, number>);
      
      let result = "Items Processed:\n";
      Object.entries(itemSummary).forEach(([itemName, qty]) => {
        result += `- ${itemName}: ${qty} pieces\n`;
      });
      return result;
    }
  };

  const defaultTemplate = `
Dear ${client.name},

Here is your invoice summary #${invoice.invoiceNumber || invoice.id} dated ${invoice.date}.

Invoice Details:
- Client: ${client.name}
- Date: ${invoice.date}
- Total Amount: $${invoice.total.toFixed(2)}

${getProcessingSummary()}

If you have any questions regarding this invoice, please don't hesitate to contact us.

Thank you for your business!

Best regards,
King Uniforms Team
  `.trim();

  if (!template) {
    return defaultTemplate;
  }

  // Replace template variables
  let body = template
    .replace(/\{clientName\}/g, client.name)
    .replace(/\{invoiceNumber\}/g, String(invoice.invoiceNumber || invoice.id))
    .replace(/\{invoiceDate\}/g, invoice.date)
    .replace(/\{totalAmount\}/g, invoice.total.toFixed(2))
    .replace(/\{cartCount\}/g, String(invoice.carts.length))
    .replace(/\{clientEmail\}/g, client.email || "");
  
  // Add processing summary if {processingSummary} is in the template, otherwise append it
  if (body.includes("{processingSummary}")) {
    body = body.replace(/\{processingSummary\}/g, getProcessingSummary());
  } else {
    body += `\n\n${getProcessingSummary()}`;
  }
  
  return body;
};

// Generate email body specifically for signature emails
const generateSignatureEmailBody = (
  client: Client,
  invoice: Invoice,
  signatureData: {
    receivedBy: string;
    signatureDate: string;
    signatureTime: string;
  },
  template?: string
): string => {
  // Generate a summary of items or weight based on the client's billing calculation method
  const getProcessingSummary = () => {
    if (client.billingCalculation === "byWeight" && invoice.totalWeight) {
      return `Total Pounds Processed: ${invoice.totalWeight.toFixed(2)} lbs`;
    } else {
      // Generate a breakdown of pieces
      const itemSummary = invoice.carts.reduce((summary, cart) => {
        cart.items.forEach(item => {
          if (!summary[item.productName]) {
            summary[item.productName] = 0;
          }
          summary[item.productName] += item.quantity;
        });
        return summary;
      }, {} as Record<string, number>);
      
      let result = "Items Processed:\n";
      Object.entries(itemSummary).forEach(([itemName, qty]) => {
        result += `- ${itemName}: ${qty} pieces\n`;
      });
      return result;
    }
  };

  const defaultSignatureTemplate = `
Dear ${client.name},

Your delivery has been completed and confirmed with a signature.

Delivery Details:
- Invoice: #${invoice.invoiceNumber || invoice.id}
- Client: ${client.name}
- Date: ${invoice.date}
- Total Amount: $${invoice.total.toFixed(2)}
- Received By: ${signatureData.receivedBy}
- Signature Date: ${signatureData.signatureDate}
- Signature Time: ${signatureData.signatureTime}

${getProcessingSummary()}

Thank you for your business!

Best regards,
King Uniforms Team
  `.trim();

  if (!template) {
    return defaultSignatureTemplate;
  }

  // Replace template variables including signature-specific ones
  let body = template
    .replace(/\{clientName\}/g, client.name)
    .replace(/\{invoiceNumber\}/g, String(invoice.invoiceNumber || invoice.id))
    .replace(/\{invoiceDate\}/g, invoice.date)
    .replace(/\{totalAmount\}/g, invoice.total.toFixed(2))
    .replace(/\{cartCount\}/g, String(invoice.carts.length))
    .replace(/\{clientEmail\}/g, client.email || "")
    .replace(/\{receivedBy\}/g, signatureData.receivedBy)
    .replace(/\{signatureDate\}/g, signatureData.signatureDate)
    .replace(/\{signatureTime\}/g, signatureData.signatureTime);
  
  // Add processing summary if {processingSummary} is in the template, otherwise append it
  if (body.includes("{processingSummary}")) {
    body = body.replace(/\{processingSummary\}/g, getProcessingSummary());
  } else {
    body += `\n\n${getProcessingSummary()}`;
  }
  
  return body;
};

// Function to validate email configuration
export const validateEmailSettings = (
  client: Client,
  emailSettings: PrintConfiguration["emailSettings"]
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!emailSettings.enabled) {
    return { isValid: true, errors: [] };
  }

  if (!client.email) {
    errors.push("Client email address is required");
  }

  if (emailSettings.ccEmails) {
    emailSettings.ccEmails.forEach((email, index) => {
      if (!isValidEmail(email)) {
        errors.push(`Invalid CC email address at position ${index + 1}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Function to send a test email to verify email configuration
export const sendTestEmail = async (
  client: Client,
  emailSettings: PrintConfiguration["emailSettings"]
): Promise<boolean> => {
  try {
    if (!client.email) {
      throw new Error("Client email address is required");
    }

    if (!emailSettings.enabled) {
      throw new Error("Email is not enabled for this client");
    }

    // Create a test email data object
    const testEmailData: EmailData = {
      to: client.email,
      cc: emailSettings.ccEmails || [],
      subject: emailSettings.subject ? 
        `TEST EMAIL: ${emailSettings.subject}`.replace(/\{clientName\}/g, client.name) :
        `TEST EMAIL: Invoice Configuration Test - ${client.name}`,
      body: `This is a test email for ${client.name}.

Your email configuration is working correctly!

Test Details:
- Client: ${client.name}
- Email: ${client.email}
- Auto-send on Approval: ${emailSettings.autoSendOnApproval ? 'Enabled' : 'Disabled'}
- Auto-send on Shipping: ${emailSettings.autoSendOnShipping ? 'Enabled' : 'Disabled'}
- Auto-send on Signature: ${emailSettings.autoSendOnSignature ? 'Enabled' : 'Disabled'}
- CC Recipients: ${emailSettings.ccEmails?.length || 0}

${client.billingCalculation === "byWeight" ? 
  "This client is billed by weight. Emails will include total pounds processed." :
  "This client is billed by piece. Emails will include a breakdown of items processed."}

This is a test message sent from King Uniforms printing system.

If you received this email, your email configuration is working properly!

Best regards,
King Uniforms Team`
    };

    // Log the test email (for development/testing)
    console.log("📧 Test Email Service - Sending test email:", {
      to: testEmailData.to,
      cc: testEmailData.cc,
      subject: testEmailData.subject,
      isTest: true
    });

    // Send the test email using the backend API
    try {
      const response = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: testEmailData.to,
          cc: testEmailData.cc,
          subject: testEmailData.subject,
          body: testEmailData.body
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("❌ Email server error:", data.error);
        return false;
      }
      
      console.log("✅ Test email sent successfully");
      return true;
    } catch (fetchError) {
      console.error("❌ Failed to connect to email server:", fetchError);
      return false;
    }

  } catch (error) {
    console.error("❌ Failed to send test email:", error);
    return false;
  }
};
