import jsPDF from "jspdf";
import { Invoice, Client, PrintConfiguration } from "../types";

/**
 * Advanced PDF generation with client-specific formatting
 */
export async function generateLaundryTicketPDF(
  invoice: Invoice,
  client: Client,
  printConfig?: PrintConfiguration
): Promise<string> {
  console.log("📄 Starting advanced PDF generation with client formatting...");
  
  try {
    // Get client print configuration or use defaults
    const config = printConfig?.invoicePrintSettings || {
      enabled: true,
      showClientInfo: true,
      showInvoiceNumber: true,
      showDate: true,
      showPickupDate: false,
      showCartBreakdown: true,
      showProductSummary: true,
      showTotalWeight: true,
      showSubtotal: false,
      showTaxes: false,
      showGrandTotal: true,
      includeSignature: false,
      headerText: "",
      footerText: "",
      logoUrl: ""
    };

    // Create PDF with configurable settings
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let yPos = 20;

    // Custom Header Text
    if (config.headerText) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(config.headerText, 105, yPos, { align: 'center' });
      yPos += 15;
    }

    // Company Header
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('King Uniforms', 105, yPos, { align: 'center' });
    
    yPos += 10;
    pdf.setFontSize(16);
    pdf.text('Laundry Service Ticket', 105, yPos, { align: 'center' });
    
    yPos += 10;
    
    // Line separator
    pdf.setLineWidth(0.5);
    pdf.line(20, yPos, 190, yPos);
    yPos += 15;

    // Invoice Information Section
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');

    // Invoice Number
    if (config.showInvoiceNumber) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Ticket #: ${invoice.invoiceNumber || invoice.id}`, 20, yPos);
      pdf.setFont('helvetica', 'normal');
    }

    // Date
    if (config.showDate) {
      const dateText = `Date: ${invoice.date}`;
      pdf.text(dateText, config.showInvoiceNumber ? 120 : 20, yPos);
    }
    
    if (config.showInvoiceNumber || config.showDate) {
      yPos += 10;
    }

    // Client Information
    if (config.showClientInfo) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Client: ${client.name}`, 20, yPos);
      pdf.setFont('helvetica', 'normal');
      yPos += 10;
    }

    // Delivery/Pickup Date
    if (config.showPickupDate && invoice.deliveryDate) {
      pdf.text(`Delivery Date: ${new Date(invoice.deliveryDate).toLocaleDateString()}`, 20, yPos);
      yPos += 10;
    }

    // Truck Number
    if (invoice.truckNumber) {
      pdf.text(`Truck: ${invoice.truckNumber}`, 20, yPos);
      yPos += 10;
    }

    // Total Weight
    if (config.showTotalWeight && invoice.totalWeight) {
      pdf.text(`Total Weight: ${invoice.totalWeight} lbs`, 20, yPos);
      yPos += 10;
    }

    yPos += 10;

    // Cart Breakdown
    if (config.showCartBreakdown && invoice.carts && invoice.carts.length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('Items Processed:', 20, yPos);
      pdf.setFont('helvetica', 'normal');
      
      yPos += 10;
      
      invoice.carts.forEach((cart, cartIndex) => {
        if (cartIndex > 0) {
          yPos += 5;
        }
        
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${cart.name}:`, 25, yPos);
        pdf.setFont('helvetica', 'normal');
        yPos += 8;
        
        if (cart.items && cart.items.length > 0) {
          cart.items.forEach((item) => {
            const itemText = `  • ${item.quantity} ${item.productName}`;
            pdf.text(itemText, 30, yPos);
            yPos += 6;
            
            // Page break handling
            if (yPos > 270) {
              pdf.addPage();
              yPos = 20;
            }
          });
        } else {
          pdf.text('  • No items listed', 30, yPos);
          yPos += 6;
        }
      });
    }

    // Product Summary
    if (config.showProductSummary) {
      yPos += 10;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Summary:', 20, yPos);
      pdf.setFont('helvetica', 'normal');
      yPos += 8;
      
      pdf.text(`Total Carts: ${invoice.carts?.length || 0}`, 25, yPos);
      yPos += 6;
      
      const totalItems = invoice.carts?.reduce((total, cart) => 
        total + (cart.items?.length || 0), 0) || 0;
      pdf.text(`Total Items: ${totalItems}`, 25, yPos);
      yPos += 6;
    }

    // Financial Information
    if (invoice.total) {
      if (config.showSubtotal) {
        const subtotal = invoice.total / 1.115; // Assuming 11.5% tax
        pdf.text(`Subtotal: $${subtotal.toFixed(2)}`, 25, yPos);
        yPos += 6;
      }

      if (config.showTaxes) {
        const tax = invoice.total - (invoice.total / 1.115);
        pdf.text(`Tax: $${tax.toFixed(2)}`, 25, yPos);
        yPos += 6;
      }

      if (config.showGrandTotal) {
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Total Amount: $${invoice.total.toFixed(2)}`, 25, yPos);
        pdf.setFont('helvetica', 'normal');
        yPos += 10;
      }
    }

    // Signature Section
    if (config.includeSignature) {
      yPos += 20;
      pdf.setFont('helvetica', 'normal');
      pdf.text('Customer Signature:', 20, yPos);
      pdf.line(60, yPos, 150, yPos); // Signature line
      yPos += 15;
      pdf.text('Date:', 20, yPos);
      pdf.line(35, yPos, 80, yPos); // Date line
    }

    // Custom Footer
    if (config.footerText) {
      yPos += 20;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      // Split footer text into lines if it's too long
      const footerLines = pdf.splitTextToSize(config.footerText, 170);
      pdf.text(footerLines, 20, yPos);
      yPos += footerLines.length * 5;
    }

    // Default footer
    yPos += 15;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'italic');
    pdf.text('Thank you for choosing King Uniforms', 105, yPos, { align: 'center' });

    // Generate and return PDF
    const pdfAsString = pdf.output('datauristring');
    
    console.log("✅ Advanced PDF generated successfully with client formatting");
    console.log("📄 PDF size:", pdfAsString.length, "characters");
    console.log("🎨 Applied configurations:", {
      showClientInfo: config.showClientInfo,
      showInvoiceNumber: config.showInvoiceNumber,
      showCartBreakdown: config.showCartBreakdown,
      includeSignature: config.includeSignature,
      hasCustomHeader: !!config.headerText,
      hasCustomFooter: !!config.footerText
    });
    
    return pdfAsString;
    
  } catch (error) {
    console.error("❌ Error generating advanced PDF:", error);
    throw error;
  }
}

/**
 * Simple PDF generation for backward compatibility
 */
export async function generateSimpleLaundryTicketPDF(
  invoice: Invoice,
  client: Client
): Promise<string> {
  return generateLaundryTicketPDF(invoice, client);
}
