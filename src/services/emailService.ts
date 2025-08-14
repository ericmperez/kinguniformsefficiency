/**
 * Email Service
 * Handles sending emails for laundry tickets, signatures, and test emails
 */
import { Client, Invoice, PrintConfiguration } from '../types';
import { API_BASE_URL } from '../config/api';

interface EmailData {
  to: string;
  cc?: string[];
  subject: string;
  body: string;
}

/**
 * Main function to send laundry ticket emails
 * Supports both PDF attachments and plain text emails
 */
export const sendInvoiceEmail = async (
  client: Client,
  invoice: Invoice,
  emailSettings: PrintConfiguration["emailSettings"],
  pdfContent?: string // Optional parameter for backward compatibility
): Promise<boolean> => {
  try {
    const emailData: EmailData = {
      to: client.email || "",
      cc: (emailSettings.ccEmails || []).filter(email => email && email.trim() !== ""),
      subject: emailSettings.subject || `Laundry Ticket #${invoice.invoiceNumber || invoice.id} - ${client.name}`,
      body: generateEmailBody(client, invoice, emailSettings.bodyTemplate)
    };

    // Log the email details
    console.log("📧 Email Service - Sending email:", {
      to: emailData.to,
      cc: emailData.cc,
      subject: emailData.subject,
      bodyPreview: emailData.body.substring(0, 100) + "..."
    });
    
    
    // Build list of all email recipients (main email + CC emails)
    const allRecipients = [emailData.to].filter(email => email && email.trim() !== "");
    const ccEmails = emailData.cc || [];
    allRecipients.push(...ccEmails);

    if (allRecipients.length === 0) {
      console.error("❌ No email recipients found");
      return false;
    }

    console.log(`📧 Sending individual emails to ${allRecipients.length} recipients in parallel: ${allRecipients.join(', ')}`);

    let successCount = 0;
    let failCount = 0;

    // Send individual emails to each recipient IN PARALLEL for faster delivery
    const emailPromises = allRecipients.map(async (recipient) => {
      try {
        let emailSent = false;

        // If PDF content is available, send it using the standard attachment endpoint.
        if (pdfContent) {
          try {
            console.log(`📧 Sending email with PDF attachment to: ${recipient}`);

            const response = await fetch(`${API_BASE_URL}/api/send-invoice`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: recipient,
                cc: [], // No CC since we're sending individual emails
                subject: emailData.subject,
                text: emailData.body,
                pdfBase64: pdfContent.split(',')[1] || pdfContent,
                invoiceNumber: invoice.invoiceNumber || invoice.id, // Add invoice number for filename
              }),
            });

            // Try to parse error payload safely but do not throw on parse failure
            let data = null;
            try { data = await response.json(); } catch (e) { /* ignore parse errors */ }

            if (response.ok) {
              console.log(`✅ Email with PDF sent successfully to: ${recipient}`);
              emailSent = true;
            } else {
              console.error(`❌ Email server returned error for ${recipient}:`, data?.error || response.status);
            }
          } catch (fetchError) {
            console.error(`❌ Failed to send email with attachment to ${recipient}:`, fetchError);
          }

          // Fallback: send a text-only email if attachment sending fails
          if (!emailSent) {
            try {
              console.log(`📧 Falling back to text-only email for: ${recipient}`);
              const response = await fetch(`${API_BASE_URL}/api/send-test-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: recipient,
                  cc: [], // No CC since we're sending individual emails
                  subject: emailData.subject,
                  body: emailData.body,
                }),
              });

              let data = null;
              try { data = await response.json(); } catch (e) { /* ignore parse errors */ }

              if (response.ok) {
                console.log(`✅ Text-only fallback email sent successfully to: ${recipient}`);
                emailSent = true;
              } else {
                console.error(`❌ Text-only fallback email failed for ${recipient}:`, data?.error || response.status);
              }
            } catch (fallbackError) {
              console.error(`❌ Failed to send text-only fallback email to ${recipient}:`, fallbackError);
            }
          }
        } else {
          // No PDF was provided — send a plain text email
          try {
            console.log(`📧 Sending text-only email to: ${recipient}`);
            const response = await fetch(`${API_BASE_URL}/api/send-test-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: recipient,
                cc: [], // No CC since we're sending individual emails
                subject: emailData.subject,
                body: emailData.body,
              }),
            });

            let data = null;
            try { data = await response.json(); } catch (e) { /* ignore parse errors */ }

            if (response.ok) {
              console.log(`✅ Text-only email sent successfully to: ${recipient}`);
              emailSent = true;
            } else {
              console.error(`❌ Text-only email failed for ${recipient}:`, data?.error || response.status);
            }
          } catch (err) {
            console.error(`❌ Failed to send text-only email to ${recipient}:`, err);
          }
        }

        return { recipient, success: emailSent };
      } catch (error) {
        console.error(`❌ Error sending email to ${recipient}:`, error);
        return { recipient, success: false };
      }
    });

    // Wait for all emails to complete and count results
    const results = await Promise.allSettled(emailPromises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successCount++;
        } else {
          failCount++;
        }
      } else {
        console.error(`❌ Email promise failed for ${allRecipients[index]}:`, result.reason);
        failCount++;
      }
    });

    console.log(`📊 Email sending complete: ${successCount} sent, ${failCount} failed out of ${allRecipients.length} recipients`);

    // Return true if at least one email was sent successfully
    return successCount > 0;
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
      `Delivery Confirmed - Laundry Ticket #${invoice.invoiceNumber || invoice.id} for ${client.name}`;
    
    const template = emailSettings.signatureEmailTemplate || 
      emailSettings.bodyTemplate;

    const emailData: EmailData = {
      to: client.email || "",
      cc: (emailSettings.ccEmails || []).filter(email => email && email.trim() !== ""),
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
        const response = await fetch(`${API_BASE_URL}/api/send-invoice`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: emailData.to,
            cc: emailData.cc,
            subject: emailData.subject,
            text: emailData.body,
            pdfBase64: pdfContent.split(',')[1] || pdfContent,
            invoiceNumber: invoice.invoiceNumber || invoice.id, // Add invoice number for filename
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
        const response = await fetch(`${API_BASE_URL}/api/send-test-email`, {
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
  // Default template
  const defaultTemplate = `
Dear ${client.name},

Here is your invoice summary #${invoice.invoiceNumber || invoice.id} dated ${invoice.date}.

Invoice Details:
- Client: ${client.name}
- Date: ${invoice.date}
- Total Amount: $${invoice.total.toFixed(2)}

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
  
  // Remove processing summary placeholder if it exists in the template
  if (body.includes('{processingSummary}')) {
    body = body.replace(/\{processingSummary\}/g, '');
  }

  return body;
};

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
  // Default signature template
  const defaultTemplate = `
Dear ${client.name},

We are pleased to confirm that your order has been successfully delivered and received.

Delivery Confirmation Details:
- Laundry Ticket #: ${invoice.invoiceNumber || invoice.id}
- Delivery Date: ${signatureData.signatureDate}
- Delivery Time: ${signatureData.signatureTime}
- Received By: ${signatureData.receivedBy}
- Client: ${client.name}
- Total Amount: $${invoice.total.toFixed(2)}

Thank you for choosing King Uniforms for your laundry services. If you have any questions or concerns about this delivery, please don't hesitate to contact us.

Best regards,
King Uniforms Team
  `.trim();

  if (!template) {
    return defaultTemplate;
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
  
  // Remove processing summary placeholder if it exists in the template
  if (body.includes('{processingSummary}')) {
    body = body.replace(/\{processingSummary\}/g, '');
  }

  return body;
};

/**
 * Function to send test emails to verify email configuration
 * Now includes PDF generation for a complete test
 */
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
      cc: (emailSettings.ccEmails || []).filter(email => email && email.trim() !== ""),
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
A sample PDF laundry ticket is attached to demonstrate PDF generation capability.

If you received this email with a PDF attachment, your email configuration is working properly!

Best regards,
King Uniforms Team`
    };

    // Log the test email (for development/testing)
    console.log("📧 Test Email Service - Sending test email with PDF:", {
      to: testEmailData.to,
      cc: testEmailData.cc,
      subject: testEmailData.subject,
      isTest: true
    });

    // Generate a sample PDF for testing
    let pdfContent: string | undefined;
    try {
      console.log("🔄 Generating sample PDF for test email...");
      
      // Import the proper PDF service for testing
      const { generateLaundryTicketPDF } = await import('./pdfService');
      
      // Create a sample invoice for PDF generation
      const sampleInvoice: Invoice = {
        id: "TEST-001",
        invoiceNumber: 1001,
        clientId: client.id,
        clientName: client.name,
        date: new Date().toISOString().split('T')[0],
        products: [], // Add required products array (empty for test)
        carts: [
          {
            id: "test-cart-1",
            name: "Sample Cart 1",
            items: [
              {
                productId: "test-product-1",
                productName: "Sample Uniform Shirt",
                quantity: 5,
                price: 2.50
              },
              {
                productId: "test-product-2", 
                productName: "Sample Uniform Pants",
                quantity: 3,
                price: 3.00
              }
            ],
            total: 21.50,
            createdAt: new Date().toISOString(),
            createdBy: "Test"
          }
        ],
        total: 21.50,
        totalWeight: 8.5,
        status: "approved",
        verified: true,
        truckNumber: "TEST-TRUCK-01"
      };

      pdfContent = await generateLaundryTicketPDF(sampleInvoice, client);
      console.log("✅ Sample PDF generated successfully for test email");
      console.log("📄 PDF content length:", pdfContent?.length || 0);
      
      // Log PDF generation status
      if (pdfContent && pdfContent.length > 0) {
        console.log("✅ PDF content is valid and ready for email attachment");
      } else {
        console.log("⚠️ PDF content appears to be empty or invalid");
      }
    } catch (pdfError) {
      console.error("❌ Could not generate PDF for test email:", pdfError);
      console.error("❌ PDF Error details:", pdfError instanceof Error ? pdfError.message : 'Unknown error');
      // Continue without PDF - fallback to text-only email
      pdfContent = undefined;
    }

    // Send the test email using the appropriate endpoint
    try {
      if (pdfContent) {
        // Use test email endpoint with PDF attachment
        const response = await fetch(`${API_BASE_URL}/api/send-test-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: testEmailData.to,
            cc: testEmailData.cc,
            subject: testEmailData.subject,
            body: testEmailData.body,
            pdfBase64: pdfContent.split(',')[1] || pdfContent
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          console.error("❌ Test email with PDF server error:", data.error);
          return false;
        }
        
        console.log("✅ Test email with PDF sent successfully");
        return true;
      } else {
        // Fallback to text-only email
        const response = await fetch(`${API_BASE_URL}/api/send-test-email`, {
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
          console.error("❌ Test email server error:", data.error);
          return false;
        }
        
        console.log("✅ Test email sent successfully (text only)");
        return true;
      }
    } catch (fetchError) {
      console.error("❌ Failed to connect to email server:", fetchError);
      return false;
    }

  } catch (error) {
    console.error("❌ Failed to send test email:", error);
    return false;
  }
};

/**
 * PDF generation function that uses the new signed delivery template
 * This replaces the old simple PDF service and provides consistent template usage
 */
export const generateInvoicePDF = async (
  client: Client,
  invoice: Invoice,
  printConfig: any,
  driverName?: string,
  optimizeForEmail: boolean = true // when false, generate full-page PDF instead of email-optimized smaller version
): Promise<string | undefined> => {
  try {
    console.log("📄 Generating PDF using new signed delivery template...");
    
    // Import the new signed delivery PDF service
    const { generateDeliveryTicketPDF } = await import('./signedDeliveryPdfService');
    
    // Use client-specific PDF options if available, otherwise use defaults
    const clientPdfOptions = client.printConfig?.pdfOptions;

    let pdfOptions: any;
    if (optimizeForEmail) {
      // Auto-optimize PDF options for email to reduce file size but maintain quality
      pdfOptions = clientPdfOptions ? {
        // Use client-specific PDF options but optimize for email
        ...clientPdfOptions,
        // Moderate optimizations for email delivery
        scale: Math.min(clientPdfOptions.scale || 1.0, 0.9), // Cap scale at 90% for emails (less aggressive)
        paperSize: clientPdfOptions.paperSize === 'letter' ? 'a4' : clientPdfOptions.paperSize, // Prefer A4 over Letter
        margins: 'narrow', // Force narrow margins for emails
        fontSize: clientPdfOptions.fontSize || 'medium', // Keep medium font size
        logoSize: clientPdfOptions.logoSize || 'medium', // Keep medium logo size
        showBorder: false, // Remove border for emails
        showWatermark: false, // Never show watermark in emails
        // Always show signatures for signed delivery tickets
        showSignatures: true,
        showTimestamp: true
        // Don't override showLocation - respect client's preference
      } : {
        // Fallback defaults optimized for email size but with good quality
        paperSize: 'a4', // Smaller than letter
        orientation: printConfig?.orientation || 'portrait',
        scale: 0.9, // Reduced scale for smaller files but not too aggressive
        showSignatures: true,
        showTimestamp: true,
        showLocation: false, // Reduced content
        showQuantities: true,
        contentDisplay: 'detailed' as const, // Keep detailed for better quality
        margins: 'narrow' as const, // Compact layout
        fontSize: 'medium' as const, // Keep medium text for readability
        showWatermark: false,
        headerText: '',
        footerText: '',
        logoSize: 'medium' as const, // Keep medium logo
        showBorder: false, // No border for smaller size
        pagination: 'single' as const,
        ...printConfig?.pdfOptions
      };
    } else {
      // Generate full-page PDF options (occupy whole page)
      pdfOptions = clientPdfOptions ? {
        ...clientPdfOptions,
        // Prefer full scale and default margins so the ticket fills the page
        scale: clientPdfOptions.scale ?? 1.0,
        paperSize: clientPdfOptions.paperSize || (printConfig?.paperSize || 'letter'),
        margins: clientPdfOptions.margins ?? (printConfig?.margins || 'normal'),
        fontSize: clientPdfOptions.fontSize ?? (printConfig?.fontSize || 'medium'),
        logoSize: clientPdfOptions.logoSize ?? (printConfig?.logoSize || 'normal'),
        showWatermark: clientPdfOptions.showWatermark ?? false,
        showBorder: clientPdfOptions.showBorder ?? true
      } : {
        // Defaults for full-page printable PDF
        paperSize: printConfig?.paperSize || 'letter',
        orientation: printConfig?.orientation || 'portrait',
        scale: 1.0,
        showSignatures: true,
        showTimestamp: true,
        showLocation: true,
        showQuantities: true,
        contentDisplay: 'full' as const,
        margins: printConfig?.margins || 'normal',
        fontSize: printConfig?.fontSize || 'medium',
        showWatermark: false,
        headerText: printConfig?.headerText || '',
        footerText: printConfig?.footerText || '',
        logoSize: printConfig?.logoSize || 'normal',
        showBorder: true,
        pagination: 'single' as const,
        ...printConfig?.pdfOptions
      };
    }
    
    console.log("📄 Using PDF options for client:", client.name, pdfOptions);
    
    // Generate the PDF using the new template
    const pdfContent = await generateDeliveryTicketPDF(invoice, client, pdfOptions, driverName);
    
    console.log("✅ PDF generated successfully with new signed delivery template");
    return pdfContent;
  } catch (error) {
    console.error("❌ Failed to generate PDF with new template:", error);
    
    // Fallback to full PDF service if new template fails
    try {
      console.log("🔄 Falling back to full PDF service...");
      const { generateLaundryTicketPDF } = await import('./pdfService');
      const pdfContent = await generateLaundryTicketPDF(invoice, client);
      console.log("✅ PDF generated successfully with fallback template");
      return pdfContent;
    } catch (fallbackError) {
      console.error("❌ Fallback PDF generation also failed:", fallbackError);
      return undefined;
    }
  }
};

/**
 * Validates email settings configuration
 * Checks if all required email settings are properly configured
 */
export const validateEmailSettings = (
  client: Client,
  emailSettings?: {
    subject?: string;
    ccEmails?: string[];
    bodyTemplate?: string;
  }
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!emailSettings) {
    errors.push("Email settings are not configured");
    return { isValid: false, errors };
  }
  
  if (!emailSettings.subject || emailSettings.subject.trim() === "") {
    errors.push("Email subject is required");
  }
  
  if (!emailSettings.bodyTemplate || emailSettings.bodyTemplate.trim() === "") {
    errors.push("Email body template is required");
  }
  
  if (emailSettings.ccEmails) {
    // Filter out empty strings first
    const nonEmptyEmails = emailSettings.ccEmails.filter(email => email && email.trim() !== "");
    const invalidEmails = nonEmptyEmails.filter(email => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return !emailRegex.test(email.trim());
    });
    
    if (invalidEmails.length > 0) {
      errors.push(`Invalid CC email addresses: ${invalidEmails.join(", ")}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
