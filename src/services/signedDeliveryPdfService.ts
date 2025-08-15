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
  paperSize?: string; // Now supports: 'letter', 'a4', 'legal', 'content', 'auto'
  orientation?: string;
  margins?: string; // Now supports: 'normal', 'none', 'content' (minimal padding)
  fontSize?: string;
  showWatermark?: boolean;
  headerText?: string;
  footerText?: string;
  logoSize?: string;
  showBorder?: boolean;
  pagination?: string;
  // Lightweight optimization options
  optimizeLightweight?: boolean;
  compressImages?: boolean;
  imageQuality?: number;
  contentDisplay?: 'detailed' | 'summary' | 'weight-only' | 'servilletas-summary';
  showQuantities?: boolean;
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
  // Create a container for rendering with simplified approach for better control
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "1200px";
  container.style.height = "1600px";
  container.style.backgroundColor = "white";
  container.style.color = "black";
  container.style.fontFamily = "Arial, sans-serif";
  container.style.overflow = "visible";
  container.style.zIndex = "-1";
  // Remove flexbox centering that may cause positioning issues
  container.style.display = "block";
  container.style.textAlign = "center"; // Use text-align for centering instead
  container.style.padding = "0"; // Remove padding to get pure content dimensions
  container.style.margin = "0";
  document.body.appendChild(container);

  try {
    // Render the signed delivery ticket with real data
    const root = createRoot(container);
    
    // Create a wrapper div that uses full width with equal margins
    const wrapperDiv = React.createElement('div', {
      style: {
        display: "block", // Change to block for full width
        textAlign: "left",
        width: "100%", // Use full container width
        maxWidth: "none", // Remove maxWidth restrictions
        margin: "0", // Remove auto margins since we want full width
        padding: "0 40px", // Add horizontal padding for equal margins
        boxSizing: "border-box", // Include padding in width calculation
        fontSize: pdfOptions.fontSize === 'small' ? '18px' : 
                 pdfOptions.fontSize === 'large' ? '22px' : '20px' // Increased base sizes by 6px
      }
    }, React.createElement(SignedDeliveryTicket, {
      ticketNumber: String(invoice.invoiceNumber || invoice.id),
      clientName: client.name,
      driverName: signatureData.driverName,
      deliveryDate: signatureData.deliveryDate,
      invoice: invoice,
      client: client,
      signatureDataUrl: signatureData.signatureDataUrl,
      signedByName: signatureData.signedByName,
      pdfOptions: pdfOptions
    }));
    
    await new Promise<void>((resolve) => {
      root.render(wrapperDiv);
      
      // Give React time to render and images to load
      setTimeout(resolve, 200);
    });

    // Wait for the DOM to update and images to load
    await new Promise((r) => setTimeout(r, 1000));
    
    // Wait for any images to load
    const images = container.querySelectorAll('img');
    if (images.length > 0) {
      console.log(`🖼️ Waiting for ${images.length} images to load...`);
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = () => resolve(true);
          img.onerror = () => resolve(true); // Continue even if image fails
          // Timeout after 3 seconds
          setTimeout(() => resolve(true), 3000);
        });
      }));
      console.log("✅ Images loaded");
    }

    // Find the rendered ticket
    const ticketElement = container.querySelector(
      ".signed-delivery-ticket"
    ) as HTMLElement;
    
    if (!ticketElement) {
      throw new Error("Could not find signed delivery ticket element to render.");
    }
    
    // Ensure element is visible and properly styled for rendering
    ticketElement.style.opacity = "1";
    ticketElement.style.visibility = "visible";
    ticketElement.style.display = "block";
    ticketElement.style.position = "relative";
    
    // FULL-WIDTH APPROACH: Use entire wrapper width with equal side margins
    ticketElement.style.margin = "0"; // No margins - wrapper handles spacing
    ticketElement.style.width = "100%"; // Use full wrapper width
    ticketElement.style.maxWidth = "none"; // Remove width constraints
    ticketElement.style.minWidth = "none"; // Remove width constraints
    ticketElement.style.textAlign = "left"; // Left-aligned text within full-width element
    
    console.log("📋 Element found and styled for full-width:");
    console.log("🔧 FULL-WIDTH APPROACH applied:");
    console.log(`   margin: ${ticketElement.style.margin}`);
    console.log(`   width: ${ticketElement.style.width}`);
    console.log(`   maxWidth: ${ticketElement.style.maxWidth}`);
    console.log(`   textAlign: ${ticketElement.style.textAlign}`);
    console.log(`   computed width: ${ticketElement.offsetWidth}px`);
    console.log(`   computed height: ${ticketElement.offsetHeight}px`);
    
    // Get the parent wrapper element to check its full-width positioning
    const wrapperElement = ticketElement.parentElement;
    if (wrapperElement) {
      const wrapperStyles = window.getComputedStyle(wrapperElement);
      console.log("🎯 Full-Width Wrapper analysis:");
      console.log(`   wrapper display: ${wrapperStyles.display}`);
      console.log(`   wrapper textAlign: ${wrapperStyles.textAlign}`);
      console.log(`   wrapper width: ${wrapperElement.offsetWidth}px`);
      console.log(`   wrapper padding: ${wrapperStyles.padding}`);
      console.log(`   wrapper position in container: ${wrapperElement.offsetLeft}px from left`);
      console.log(`   ticket element fills wrapper: ${ticketElement.offsetWidth === wrapperElement.offsetWidth ? 'YES' : 'NO'}`);
    }

    // Apply scale option if provided
    if (pdfOptions.scale && pdfOptions.scale !== 1.0) {
      ticketElement.style.transform = `scale(${pdfOptions.scale})`;
      ticketElement.style.transformOrigin = 'top left';
    }

    // Generate canvas and PDF with stable quality settings
    const canvasScale = pdfOptions.optimizeLightweight ? 1.3 : 1.8; // Restored to proven working scales
    
    console.log("🖼️ Starting canvas generation...");
    console.log("📐 Canvas scale:", canvasScale);
    console.log("📏 Element dimensions:", {
      width: ticketElement.scrollWidth,
      height: ticketElement.scrollHeight,
      clientWidth: ticketElement.clientWidth,
      clientHeight: ticketElement.clientHeight
    });
    
    const canvas = await html2canvas(ticketElement, { 
      scale: canvasScale, // Stable scale for reliable rendering
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: ticketElement.scrollWidth,
      height: ticketElement.scrollHeight,
      // Core quality settings
      logging: false, // Disable logging to reduce noise
      imageTimeout: 0,
      removeContainer: true
    });
    
    console.log("✅ Canvas generated successfully");
    console.log("📊 Canvas dimensions:", {
      width: canvas.width,
      height: canvas.height
    });
    
    // Validate canvas has content
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error("Canvas dimensions are zero - element may not be visible");
    }
    
    // Convert to optimized format with higher quality
    const imageFormat = pdfOptions.optimizeLightweight && pdfOptions.compressImages ? "image/jpeg" : "image/png";
    const imageQuality = pdfOptions.optimizeLightweight ? (pdfOptions.imageQuality || 0.92) : 1.0; // Increased from 0.85 to 0.92 for better quality
    
    const imgData = canvas.toDataURL(imageFormat, imageQuality);
    
    // Check if image data is valid
    if (!imgData || imgData === "data:,") {
      throw new Error("Canvas conversion to image failed - no image data generated");
    }
    
    console.log("📷 Image data generated:", {
      format: imageFormat,
      quality: imageQuality,
      dataLength: imgData.length
    });
    
    // Check if user wants content-sized PDF (no empty space)
    const useContentSize = pdfOptions.paperSize === 'content' || pdfOptions.paperSize === 'auto' || 
                           pdfOptions.margins === 'none' || pdfOptions.margins === 'content';
    
    let pdfWidth, pdfHeight;
    
    if (useContentSize) {
      // Content-sized PDF - calculate true content bounds and center it
      console.log("🎯 CONTENT-SIZED MODE - measuring actual content for precise centering");
      
      // Get the actual content dimensions from the rendered element
      const contentRect = ticketElement.getBoundingClientRect();
      const actualContentWidth = ticketElement.scrollWidth;
      const actualContentHeight = ticketElement.scrollHeight;
      
      console.log("📏 ACTUAL CONTENT MEASUREMENTS:");
      console.log(`   Element scrollWidth: ${actualContentWidth}px`);
      console.log(`   Element scrollHeight: ${actualContentHeight}px`);
      console.log(`   Element offsetWidth: ${ticketElement.offsetWidth}px`);
      console.log(`   Element offsetHeight: ${ticketElement.offsetHeight}px`);
      console.log(`   BoundingRect width: ${contentRect.width}px`);
      console.log(`   BoundingRect height: ${contentRect.height}px`);
      
      // Use the actual content dimensions for PDF sizing
      const paddingPts = 30; // Slightly more padding for better appearance
      const canvasToPointsRatio = 72 / 96;
      
      // Use the larger dimension to ensure all content fits
      const contentWidth = Math.max(actualContentWidth, ticketElement.offsetWidth, contentRect.width);
      const contentHeight = Math.max(actualContentHeight, ticketElement.offsetHeight, contentRect.height);
      
      pdfWidth = Math.ceil(contentWidth * canvasToPointsRatio) + (paddingPts * 2);
      pdfHeight = Math.ceil(contentHeight * canvasToPointsRatio) + (paddingPts * 2);
      
      console.log("📐 CONTENT-SIZED PDF CALCULATION:");
      console.log(`   Used content size: ${contentWidth} × ${contentHeight} px`);
      console.log(`   Conversion ratio: ${canvasToPointsRatio}`);
      console.log(`   Content in points: ${Math.ceil(contentWidth * canvasToPointsRatio)} × ${Math.ceil(contentHeight * canvasToPointsRatio)} pts`);
      console.log(`   Padding: ${paddingPts}pts each side`);
      console.log(`   Final PDF size: ${pdfWidth} × ${pdfHeight} pts`);
      console.log(`   PDF size in inches: ${(pdfWidth/72).toFixed(2)}" × ${(pdfHeight/72).toFixed(2)}"`);
    } else {
      // Use standard paper sizes as before
      pdfWidth = 8.5 * 72; // Letter width in points (72 points per inch)
      pdfHeight = 11 * 72; // Letter height in points
      
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
      
      console.log("📄 STANDARD PAPER SIZE MODE:");
      console.log(`   Paper size: ${pdfOptions.paperSize || 'letter'}`);
      console.log(`   Orientation: ${pdfOptions.orientation || 'portrait'}`);
      console.log(`   PDF dimensions: ${pdfWidth} × ${pdfHeight} pts`);
    }
    
    // Create PDF with calculated dimensions
    const pdf = new jsPDF({
      orientation: useContentSize ? 'portrait' : (pdfOptions.orientation === 'landscape' ? 'landscape' : 'portrait'),
      unit: "pt",
      format: [pdfWidth, pdfHeight],
    });

    // Handle pagination and content placement
    console.log("📄 PDF Generation Mode Check:");
    console.log(`   Content-sized: ${useContentSize ? 'YES' : 'NO'}`);
    console.log(`   Pagination setting: ${pdfOptions.pagination || 'undefined (will default to single)'}`);
    console.log(`   Paper size: ${pdfOptions.paperSize || 'letter'}`);
    console.log(`   Orientation: ${pdfOptions.orientation || 'portrait'}`);
    
    if (useContentSize) {
      // Content-sized PDF - place content with proper centering and padding
      console.log("🎯 CONTENT-SIZED MODE - placing content with precise centering");
      
      const paddingPts = 30; // Same padding used in size calculation
      
      // Calculate the scaling needed to fit the canvas into the content area
      const availableWidth = pdfWidth - (paddingPts * 2);
      const availableHeight = pdfHeight - (paddingPts * 2);
      
      // Calculate scale to fit content properly
      const scaleX = availableWidth / canvas.width * (96 / 72); // Convert back to pixels
      const scaleY = availableHeight / canvas.height * (96 / 72);
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down if needed
      
      // Calculate final image dimensions
      const imgWidth = canvas.width * scale * (72 / 96);
      const imgHeight = canvas.height * scale * (72 / 96);
      
      // Center the scaled content within the PDF
      const x = (pdfWidth - imgWidth) / 2;
      const y = (pdfHeight - imgHeight) / 2;
      
      console.log("📍 Content-Sized PDF Placement with Centering:");
      console.log(`   PDF dimensions: ${pdfWidth} × ${pdfHeight} pts`);
      console.log(`   Available area: ${availableWidth} × ${availableHeight} pts`);
      console.log(`   Canvas dimensions: ${canvas.width} × ${canvas.height} px`);
      console.log(`   Scale factors: x=${scaleX.toFixed(3)}, y=${scaleY.toFixed(3)}, final=${scale.toFixed(3)}`);
      console.log(`   Final image: ${imgWidth.toFixed(1)} × ${imgHeight.toFixed(1)} pts`);
      console.log(`   Centered position: x=${x.toFixed(1)}, y=${y.toFixed(1)}`);
      console.log(`   Margins: left=${x.toFixed(1)}, right=${(pdfWidth - imgWidth - x).toFixed(1)}`);
      console.log(`   Perfect centering with no empty space`);
      
      // Use appropriate image format for PDF generation
      const imageFormat = pdfOptions.optimizeLightweight && pdfOptions.compressImages ? "JPEG" : "PNG";
      pdf.addImage(imgData, imageFormat, x, y, imgWidth, imgHeight);
      
    } else if (pdfOptions.pagination === 'multiple') {
      console.log("🔄 Using MULTIPLE PAGE MODE");
      // Multiple pages mode - allow content to flow naturally across pages
      const contentHeight = canvas.height * (canvas.width > 0 ? pdfWidth / canvas.width : 1);
      const pageHeight = pdfHeight;
      
      if (contentHeight > pageHeight) {
        // Content is taller than one page, split into multiple pages
        const totalPages = Math.ceil(contentHeight / pageHeight);
        
        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
          if (pageIndex > 0) {
            pdf.addPage();
          }
          
          // Calculate the portion of the image for this page
          const yOffset = pageIndex * pageHeight;
          const remainingHeight = Math.min(pageHeight, contentHeight - yOffset);
          
          // Create a temporary canvas for this page's content
          const pageCanvas = document.createElement('canvas');
          const pageCtx = pageCanvas.getContext('2d');
          
          if (pageCtx) {
            pageCanvas.width = canvas.width;
            pageCanvas.height = (remainingHeight / contentHeight) * canvas.height;
            
            // Draw the portion of the original canvas for this page
            pageCtx.drawImage(
              canvas,
              0, (yOffset / contentHeight) * canvas.height, // Source x, y
              canvas.width, pageCanvas.height, // Source width, height
              0, 0, // Destination x, y
              pageCanvas.width, pageCanvas.height // Destination width, height
            );
            
            const pageImgData = pageCanvas.toDataURL("image/png");
            pdf.addImage(pageImgData, "PNG", 0, 0, pdfWidth, remainingHeight);
          }
        }
      } else {
        // Content fits on one page - center properly while maintaining aspect ratio
        console.log("🎯 Using MULTIPLE PAGE MODE - centering with proper aspect ratio");
        const aspectRatio = canvas.width / canvas.height;
        
        // Scale to fit within page while maintaining aspect ratio
        let imgWidth = pdfWidth * 0.90; // Use 90% to ensure consistent margins like preview
        let imgHeight = imgWidth / aspectRatio;
        
        // If image is too tall, scale by height instead
        if (imgHeight > pdfHeight * 0.90) {
          imgHeight = pdfHeight * 0.90;
          imgWidth = imgHeight * aspectRatio;
        }
           // Center horizontally but position at top - adjusted significantly to the right
      const exactX = (pdfWidth - imgWidth) / 2 + 30; // Add 30 points to move right
      const exactY = 20; // Start 20 points from top instead of centering vertically
      
      // Use high precision rounding to ensure perfect centering
      const x = Math.round(exactX * 100) / 100; // Round to 2 decimal places for PDF precision
      const y = exactY;
        
        // Calculate actual margins for verification
        const leftMargin = x;
        const rightMargin = pdfWidth - imgWidth - x;
        const topMargin = y;
        const bottomMargin = pdfHeight - imgHeight - y;
           console.log("📍 PDF Horizontally Centered (Adjusted +30pts Right), Top-Aligned (Multiple page mode):");
      console.log(`   PDF dimensions: ${pdfWidth} × ${pdfHeight} pts`);
      console.log(`   Canvas dimensions: ${canvas.width} × ${canvas.height} px`);
      console.log(`   Canvas aspect ratio: ${aspectRatio.toFixed(3)}`);
      console.log(`   Image dimensions: ${imgWidth.toFixed(1)} × ${imgHeight.toFixed(1)} pts`);
      console.log(`   Exact position: x=${exactX.toFixed(3)}, y=${exactY} (adjusted +30pts right)`);
      console.log(`   Rounded position: x=${x}, y=${y}`);
      console.log(`   Left margin: ${leftMargin.toFixed(2)} pts`);
      console.log(`   Right margin: ${rightMargin.toFixed(2)} pts`);
      console.log(`   Top margin: ${y} pts (fixed top position)`);
      console.log(`   Bottom margin: ${(pdfHeight - imgHeight - y).toFixed(2)} pts`);
      console.log(`   Horizontal adjustment: +30pts to move right`);
      console.log(`   Content uses: ${(imgWidth / pdfWidth * 100).toFixed(1)}% of page width`);
      console.log(`   Left margin uses: ${(leftMargin / pdfWidth * 100).toFixed(1)}% of page width`);
        
        const imageFormat = pdfOptions.optimizeLightweight && pdfOptions.compressImages ? "JPEG" : "PNG";
        pdf.addImage(imgData, imageFormat, x, y, imgWidth, imgHeight);
      }
    } else {
      // Single page mode - center properly while maintaining aspect ratio
      console.log("🎯 Using SINGLE PAGE MODE - centering with proper aspect ratio");
      const aspectRatio = canvas.width / canvas.height;
      
      // Scale to fit within page while maintaining aspect ratio
      let imgWidth = pdfWidth * 0.90; // Use 90% to ensure consistent margins like preview
      let imgHeight = imgWidth / aspectRatio;
      
      // If image is too tall, scale by height instead
      if (imgHeight > pdfHeight * 0.90) {
        imgHeight = pdfHeight * 0.90;
        imgWidth = imgHeight * aspectRatio;
      }
      
      // Center horizontally but position at top - adjusted significantly to the right
      const exactX = (pdfWidth - imgWidth) / 2 + 30; // Add 30 points to move right
      const exactY = 20; // Start 20 points from top instead of centering vertically
      
      // Use high precision rounding to ensure perfect centering
      const x = Math.round(exactX * 100) / 100; // Round to 2 decimal places for PDF precision
      const y = exactY;
      
      // Calculate actual margins for verification
      const leftMargin = x;
      const rightMargin = pdfWidth - imgWidth - x;
      const topMargin = y;
      const bottomMargin = pdfHeight - imgHeight - y;
      
      console.log("📍 PDF Horizontally Centered (Adjusted +30pts Right), Top-Aligned (Single page mode):");
      console.log(`   PDF dimensions: ${pdfWidth} × ${pdfHeight} pts`);
      console.log(`   Canvas dimensions: ${canvas.width} × ${canvas.height} px`);
      console.log(`   Canvas aspect ratio: ${aspectRatio.toFixed(3)}`);
      console.log(`   Image dimensions: ${imgWidth.toFixed(1)} × ${imgHeight.toFixed(1)} pts`);
      console.log(`   Exact position: x=${exactX.toFixed(3)}, y=${exactY} (adjusted +30pts right)`);
      console.log(`   Rounded position: x=${x}, y=${y}`);
      console.log(`   Left margin: ${leftMargin.toFixed(2)} pts`);
      console.log(`   Right margin: ${rightMargin.toFixed(2)} pts`);
      console.log(`   Top margin: ${y} pts (fixed top position)`);
      console.log(`   Bottom margin: ${(pdfHeight - imgHeight - y).toFixed(2)} pts`);
      console.log(`   Horizontal adjustment: +30pts to move right`);
      console.log(`   Content uses: ${(imgWidth / pdfWidth * 100).toFixed(1)}% of page width`);
      console.log(`   Left margin uses: ${(leftMargin / pdfWidth * 100).toFixed(1)}% of page width`);
      
      // Use appropriate image format for PDF generation
      const imageFormat = pdfOptions.optimizeLightweight && pdfOptions.compressImages ? "JPEG" : "PNG";
      pdf.addImage(imgData, imageFormat, x, y, imgWidth, imgHeight);
    }
    
    let pdfAsString = pdf.output("datauristring");
    
    // Apply post-generation compression if lightweight mode and size > 1MB
    if (pdfOptions.optimizeLightweight) {
      console.log("🗜️ Lightweight mode enabled, checking PDF size for compression...");
      const sizeInMB = (pdfAsString.length * 0.75) / (1024 * 1024);
      console.log(`📄 Generated PDF size: ${sizeInMB.toFixed(2)}MB`);
      
      if (sizeInMB > 1.0) {
        try {
          console.log("📦 Applying smart compression to reduce size...");
          const { smartCompressPDF } = await import('./pdfCompressionService');
          const compressionResult = await smartCompressPDF(pdfAsString);
          
          if (compressionResult.success && compressionResult.compressedPdf) {
            pdfAsString = compressionResult.compressedPdf;
            console.log(`✅ PDF compressed: ${compressionResult.originalSize.toFixed(2)}MB → ${compressionResult.compressedSize.toFixed(2)}MB`);
          } else {
            console.log("⚠️ Compression failed, using original PDF");
          }
        } catch (compressionError) {
          console.error("❌ Compression error:", compressionError);
          console.log("⚠️ Using original PDF due to compression failure");
        }
      } else {
        console.log("✅ PDF size is already optimal (<1MB), no compression needed");
      }
    }
    
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
