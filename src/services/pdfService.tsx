import React from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import LaundryTicketPreview from "../components/LaundryTicketPreview";
import { Invoice, Client } from "../types";

export async function generateLaundryTicketPDF(
  invoice: Invoice,
  client: Client
): Promise<string> {
  // Create a container for rendering
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "800px";
  document.body.appendChild(container);

  // Render the preview with real data
  const items = invoice.carts.flatMap((cart) => cart.items || []);
  const root = createRoot(container);
  root.render(
    <LaundryTicketPreview
      ticketNumber={String(invoice.invoiceNumber || invoice.id)}
      clientName={client.name}
      truck={invoice.truckNumber || ""}
      pickupDate={invoice.date}
      items={items}
      pounds={invoice.totalWeight || 0}
    />
  );

  // Wait for the DOM to update
  await new Promise((r) => setTimeout(r, 500));

  // Find the rendered ticket
  const ticketElement = container.querySelector(
    ".laundry-ticket-preview"
  ) as HTMLElement;
  if (!ticketElement) {
    document.body.removeChild(container);
    throw new Error("Could not find ticket element to render.");
  }

  // Generate canvas and PDF
  const canvas = await html2canvas(ticketElement, { scale: 2 });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "p",
    unit: "px",
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  const pdfAsString = pdf.output("datauristring");

  // Clean up
  document.body.removeChild(container);
  return pdfAsString;
}
