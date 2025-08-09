// Signed Delivery Ticket PDF Generation Service
import React from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import SignedDeliveryTicket from "../components/SignedDeliveryTicket";
import { Invoice, Client } from "../types";

export interface SignedDeliveryPdfOptions {
  scale?: number;
  showSignatures?: boolean;
  showTimestamp?: boolean;
  showLocation?: boolean;
  paperSize?: string;
  orientation?: string;
  margins?: string;
  fontSize?: string;
  showWatermark?: boolean;
  headerText?: string;
  footerText?: string;
  logoSize?: string;
  showBorder?: boolean;
}

export async function generateSignedDeliveryPDF(
  invoice: Invoice,
  client: Client,
  signatureData: {
    signatureDataUrl?: string;
    signedByName: string;
    driverName: string;
    deliveryDate: string;
  },
  pdfOptions: SignedDeliveryPdfOptions = {}
): Promise<string> {
  // Create a container for rendering
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "800px";
  container.style.backgroundColor = "white";
  document.body.appendChild(container);

  try {
    // Render the signed delivery ticket with real data
    const root = createRoot(container);
    
    await new Promise<void>((resolve) => {
      root.render(
        React.createElement(SignedDeliveryTicket, {
          ticketNumber: String(invoice.invoiceNumber || invoice.id),
          clientName: client.name,
          driverName: signatureData.driverName,
          deliveryDate: signatureData.deliveryDate,
          invoice: invoice,
          client: client,
          signatureDataUrl: signatureData.signatureDataUrl,
          signedByName: signatureData.signedByName,
          pdfOptions: pdfOptions
        })
      );
      
      // Give React time to render
      setTimeout(resolve, 100);
    });

    // Wait for the DOM to update
    await new Promise((r) => setTimeout(r, 500));

    // Find the rendered ticket
    const ticketElement = container.querySelector(
      ".signed-delivery-ticket"
    ) as HTMLElement;
    
    if (!ticketElement) {
      throw new Error("Could not find signed delivery ticket element to render.");
    }

    // Apply scale option if provided
    if (pdfOptions.scale && pdfOptions.scale !== 1.0) {
      ticketElement.style.transform = `scale(${pdfOptions.scale})`;
      ticketElement.style.transformOrigin = 'top left';
    }

    // Generate canvas and PDF with higher quality
    const canvas = await html2canvas(ticketElement, { 
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });
    
    const imgData = canvas.toDataURL("image/png");
    
    // Determine PDF dimensions based on paper size and orientation
    let pdfWidth = 8.5 * 72; // Letter width in points (72 points per inch)
    let pdfHeight = 11 * 72; // Letter height in points
    
    if (pdfOptions.paperSize === 'a4') {
      pdfWidth = 8.27 * 72; // A4 width in points
      pdfHeight = 11.7 * 72; // A4 height in points
    } else if (pdfOptions.paperSize === 'legal') {
      pdfWidth = 8.5 * 72; // Legal width
      pdfHeight = 14 * 72; // Legal height
    }
    
    // Swap dimensions for landscape
    if (pdfOptions.orientation === 'landscape') {
      [pdfWidth, pdfHeight] = [pdfHeight, pdfWidth];
    }
    
    // Create PDF with specified dimensions
    const pdf = new jsPDF({
      orientation: pdfOptions.orientation === 'landscape' ? 'landscape' : 'portrait',
      unit: "pt",
      format: [pdfWidth, pdfHeight],
    });

    // Calculate image dimensions to fit the page
    const aspectRatio = canvas.width / canvas.height;
    let imgWidth = pdfWidth;
    let imgHeight = pdfWidth / aspectRatio;
    
    // If image is too tall, scale by height instead
    if (imgHeight > pdfHeight) {
      imgHeight = pdfHeight;
      imgWidth = pdfHeight * aspectRatio;
    }
    
    // Center the image on the page
    const x = (pdfWidth - imgWidth) / 2;
    const y = (pdfHeight - imgHeight) / 2;
    
    pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
    
    const pdfAsString = pdf.output("datauristring");
    
    return pdfAsString;
  } catch (error) {
    console.error("Error generating signed delivery PDF:", error);
    throw error;
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}

/**
 * Download a signed delivery ticket PDF
 */
export async function downloadSignedDeliveryPDF(
  invoice: Invoice,
  client: Client,
  signatureData: {
    signatureDataUrl?: string;
    signedByName: string;
    driverName: string;
    deliveryDate: string;
  },
  pdfOptions: SignedDeliveryPdfOptions = {}
): Promise<void> {
  try {
    const pdfContent = await generateSignedDeliveryPDF(
      invoice, 
      client, 
      signatureData, 
      pdfOptions
    );
    
    // Convert base64 to blob for download
    const base64Data = pdfContent.split(',')[1] || pdfContent;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SignedDeliveryTicket-${invoice.invoiceNumber || invoice.id}-${client.name}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading signed delivery PDF:", error);
    throw error;
  }
}

// New wrapper function that handles both signed and unsigned invoices
export async function generateDeliveryTicketPDF(
  invoice: Invoice,
  client: Client,
  pdfOptions: SignedDeliveryPdfOptions = {},
  driverName?: string
): Promise<string> {
  // Prepare signature data - use actual signature if available, otherwise defaults
  const signatureData = {
    signatureDataUrl: invoice.signature?.image || undefined,
    signedByName: invoice.signature?.name || invoice.receivedBy || "Pending Signature",
    driverName: driverName || "Driver",
    deliveryDate: invoice.deliveryDate || invoice.date || new Date().toISOString().split('T')[0]
  };

  // Use the main signed delivery PDF function
  return generateSignedDeliveryPDF(invoice, client, signatureData, pdfOptions);
}
