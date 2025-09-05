import React, { useEffect, useState } from "react";
import { Invoice, Client, Product } from "../types";
import {
  getInvoices,
  getClients,
  updateInvoice,
  logActivity,
} from "../services/firebaseService";
import {
  collection,
  setDoc,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import InvoiceDetailsModal from "./InvoiceDetailsModal";
import html2pdf from "html2pdf.js";
import { formatDateOnlySpanish } from "../utils/dateFormatter";
import { API_BASE_URL } from '../config/api';

const nowrapCellStyle = { whiteSpace: "nowrap" };

// Helper function to calculate charge based on formula type
const calculateCharge = (
  formula: "percentage" | "fixed" | "perInvoice" | "perUnit",
  value: number,
  subtotal: number,
  invoiceCount: number = 1,
  units: number = 0
): number => {
  if (value <= 0) return 0;
  
  switch (formula) {
    case "percentage":
      return subtotal * (value / 100);
    case "fixed":
      return value;
    case "perInvoice":
      return value * invoiceCount;
    case "perUnit":
      return value * units;
    default:
      return 0;
  }
};

// Add report types
const REPORT_TYPES = [
  { value: 'numero-boletas-totales', label: 'Numero de Boletas y Totales' },
  { value: 'reportes-totales-con-precios', label: 'Reportes Totales con Precios' },
  { value: 'encanto', label: 'Encanto Report' },
  { value: 'detailed', label: 'Detailed Report' },
  { value: 'products', label: 'Products Report' },
  { value: 'charges', label: 'Charges Report' },
  { value: 'custom', label: 'Custom Report' },
];

const BillingPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // Helper function to get month-to-date range
  const getMonthToDateRange = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    return {
      start: startOfMonth.toISOString().slice(0, 10), // YYYY-MM-DD format
      end: now.toISOString().slice(0, 10) // YYYY-MM-DD format
    };
  };

  // State for date filtering - default to month-to-date
  const [startDate, setStartDate] = useState<string>(() => getMonthToDateRange().start);
  const [endDate, setEndDate] = useState<string>(() => getMonthToDateRange().end);

  // State for per-client, per-product prices
  const [productPrices, setProductPrices] = useState<Record<string, number>>(
    {}
  );
  const [saveStatus, setSaveStatus] = useState<string>("");

  // State for minimum billing value
  const [minBilling, setMinBilling] = useState<string>("");

  // State for service and fuel charge
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(false);
  const [serviceChargePercent, setServiceChargePercent] = useState("");
  const [fuelChargeEnabled, setFuelChargeEnabled] = useState(false);
  const [fuelChargePercent, setFuelChargePercent] = useState("");
  const [fuelChargeLabel, setFuelChargeLabel] = useState<"Fuel Charge" | "Fuel Fee">("Fuel Charge");

  // State for surcharge
  const [surchargeEnabled, setSurchargeEnabled] = useState(false);
  const [surchargePercent, setSurchargePercent] = useState("");

  // State for Nudos (Sabanas) additional charge
  const [nudosSabanasPrice, setNudosSabanasPrice] = useState<string>("");

  // Add state for delivery charge
  const [deliveryCharge, setDeliveryCharge] = useState<string>("");

  // Add state for general delivery charge (applies to all invoices)
  const [generalDeliveryCharge, setGeneralDeliveryCharge] = useState<string>("");

  // State for disposable fee
  const [disposableFee, setDisposableFee] = useState<string>("");

  // State for formula configurations
  const [serviceChargeFormula, setServiceChargeFormula] = useState<"percentage" | "fixed" | "perInvoice">("percentage");
  const [fuelChargeFormula, setFuelChargeFormula] = useState<"percentage" | "fixed" | "perInvoice">("percentage");
  const [surchargeFormula, setSurchargeFormula] = useState<"percentage" | "fixed" | "perInvoice">("percentage");
  const [deliveryChargeFormula, setDeliveryChargeFormula] = useState<"percentage" | "fixed" | "perInvoice">("perInvoice");
  const [generalDeliveryChargeFormula, setGeneralDeliveryChargeFormula] = useState<"percentage" | "fixed" | "perInvoice">("fixed");
  const [nudosSabanasFormula, setNudosSabanasFormula] = useState<"percentage" | "fixed" | "perInvoice" | "perUnit">("perUnit");
  const [disposableFeeFormula, setDisposableFeeFormula] = useState<"percentage" | "fixed" | "perInvoice">("fixed");

  // State for toggling product pricing table visibility
  const [showPricingTable, setShowPricingTable] = useState<boolean>(false);

  // State for toggling charges configuration table visibility
  const [showChargesTable, setShowChargesTable] = useState<boolean>(false);

  // State for required pricing configuration
  const [requiredPricingProducts, setRequiredPricingProducts] = useState<Record<string, boolean>>({});

  // Test comment for pre-commit hook validation
  // Get selected client object
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  // Cache for client configurations to avoid repeated reads
  const [clientConfigCache, setClientConfigCache] = useState<Record<string, any>>({});
  
  // Get products for selected client
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  
  // Add state for report type and default per client
  const [reportType, setReportType] = useState(REPORT_TYPES[0].value);

  useEffect(() => {
    // Load products only once, not per client change
    (async () => {
      if (allProducts.length === 0) {
        const { getProducts } = await import("../services/firebaseService");
        const products = await getProducts();
        setAllProducts(products);
      }
    })();
  }, []); // Remove selectedClientId dependency

  useEffect(() => {
    (async () => {
      const all = await getInvoices();
      setInvoices(
        all.filter(
          (inv: Invoice) =>
            inv.status === "done" || inv.status === "completed" || inv.verified
        )
      );
      const clientsData = await getClients();
      setClients(clientsData);
    })();
  }, []);

  // Load prices for selected client
  useEffect(() => {
    if (!selectedClient) {
      setProductPrices({});
      return;
    }
    (async () => {
      const q = query(
        collection(db, "client_product_prices"),
        where("clientId", "==", selectedClient.id)
      );
      const snap = await getDocs(q);
      const prices: Record<string, number> = {};
      snap.docs.forEach((doc) => {
        const data = doc.data();
        prices[data.productId] = data.price;
      });
      setProductPrices(prices);
    })();
  }, [selectedClientId]);

  // Load all client configuration data in a single read (combines minimum billing, charges, surcharge, delivery charges, etc.)
  useEffect(() => {
    if (!selectedClient) {
      // Reset all client-specific configuration to default values
      setMinBilling("");
      setServiceChargeEnabled(false);
      setServiceChargePercent("");
      setFuelChargeEnabled(false);
      setFuelChargePercent("");
      setFuelChargeLabel("Fuel Charge");
      setServiceChargeFormula("percentage");
      setFuelChargeFormula("percentage");
      setSurchargeEnabled(false);
      setSurchargePercent("");
      setSurchargeFormula("percentage");
      setDeliveryCharge("");
      setGeneralDeliveryCharge("");
      setNudosSabanasPrice("");
      setDisposableFee("");
      setDeliveryChargeFormula("perInvoice");
      setGeneralDeliveryChargeFormula("fixed");
      setNudosSabanasFormula("perUnit");
      setDisposableFeeFormula("fixed");
      setRequiredPricingProducts({});
      return;
    }
    
    // Check cache first to avoid Firebase read
    if (clientConfigCache[selectedClient.id]) {
      const data = clientConfigCache[selectedClient.id];
      setMinBilling(String(data.minBilling ?? ""));
      setServiceChargeEnabled(!!data.serviceChargeEnabled);
      setServiceChargePercent(data.serviceChargePercent !== undefined ? String(data.serviceChargePercent) : "");
      setFuelChargeEnabled(!!data.fuelChargeEnabled);
      setFuelChargePercent(data.fuelChargePercent !== undefined ? String(data.fuelChargePercent) : "");
      setFuelChargeLabel(data.fuelChargeLabel || "Fuel Charge");
      setServiceChargeFormula(data.serviceChargeFormula || "percentage");
      setFuelChargeFormula(data.fuelChargeFormula || "percentage");
      setSurchargeEnabled(!!data.surchargeEnabled);
      setSurchargePercent(data.surchargePercent !== undefined ? String(data.surchargePercent) : "");
      setSurchargeFormula(data.surchargeFormula || "percentage");
      setDeliveryCharge(data.deliveryCharge !== undefined ? String(data.deliveryCharge) : "");
      setGeneralDeliveryCharge(data.generalDeliveryCharge !== undefined ? String(data.generalDeliveryCharge) : "");
      setNudosSabanasPrice(data.nudosSabanasPrice !== undefined ? String(data.nudosSabanasPrice) : "");
      setDisposableFee(data.disposableFee !== undefined ? String(data.disposableFee) : "");
      setDeliveryChargeFormula(data.deliveryChargeFormula || "perInvoice");
      setGeneralDeliveryChargeFormula(data.generalDeliveryChargeFormula || "fixed");
      setNudosSabanasFormula(data.nudosSabanasFormula || "perUnit");
      setDisposableFeeFormula(data.disposableFeeFormula || "fixed");
      setRequiredPricingProducts(data.requiredPricingProducts || {});
      return;
    }
    
    (async () => {
      const { getDoc, doc } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      const docRef = doc(db, "client_minimum_billing", selectedClient.id);
      const snap = await getDoc(docRef);
      
      let data: any = {};
      if (snap.exists()) {
        data = snap.data();
      }
      
      // Cache the data for future use
      setClientConfigCache(prev => ({ ...prev, [selectedClient.id]: data }));
      
      // Set all configuration values from single document read
      setMinBilling(String(data.minBilling ?? ""));
      setServiceChargeEnabled(!!data.serviceChargeEnabled);
      setServiceChargePercent(data.serviceChargePercent !== undefined ? String(data.serviceChargePercent) : "");
      setFuelChargeEnabled(!!data.fuelChargeEnabled);
      setFuelChargePercent(data.fuelChargePercent !== undefined ? String(data.fuelChargePercent) : "");
      setFuelChargeLabel(data.fuelChargeLabel || "Fuel Charge");
      setServiceChargeFormula(data.serviceChargeFormula || "percentage");
      setFuelChargeFormula(data.fuelChargeFormula || "percentage");
      setSurchargeEnabled(!!data.surchargeEnabled);
      setSurchargePercent(data.surchargePercent !== undefined ? String(data.surchargePercent) : "");
      setSurchargeFormula(data.surchargeFormula || "percentage");
      setDeliveryCharge(data.deliveryCharge !== undefined ? String(data.deliveryCharge) : "");
      setGeneralDeliveryCharge(data.generalDeliveryCharge !== undefined ? String(data.generalDeliveryCharge) : "");
      setNudosSabanasPrice(data.nudosSabanasPrice !== undefined ? String(data.nudosSabanasPrice) : "");
      setDisposableFee(data.disposableFee !== undefined ? String(data.disposableFee) : "");
      setDeliveryChargeFormula(data.deliveryChargeFormula || "perInvoice");
      setGeneralDeliveryChargeFormula(data.generalDeliveryChargeFormula || "fixed");
      setNudosSabanasFormula(data.nudosSabanasFormula || "perUnit");
      setDisposableFeeFormula(data.disposableFeeFormula || "fixed");
      setRequiredPricingProducts(data.requiredPricingProducts || {});
    })();
  }, [selectedClientId, clientConfigCache]);

  // Add defaultReportType to each client if not present
  useEffect(() => {
    if (selectedClient && !selectedClient.defaultReportType) {
      setClients((prev) => prev.map(c => c.id === selectedClient.id ? { ...c, defaultReportType: REPORT_TYPES[0].value } : c));
    }
  }, [selectedClient]);

  // When client changes, set reportType to their default
  useEffect(() => {
    if (selectedClient && selectedClient.defaultReportType) {
      setReportType(selectedClient.defaultReportType);
    }
  }, [selectedClient]);

  // Handler to update default report type for client
  const handleDefaultReportTypeChange = (clientId: string, value: string) => {
    setClients((prev) => prev.map(c => c.id === clientId ? { ...c, defaultReportType: value } : c));
    if (selectedClientId === clientId) setReportType(value);
  };

  // Handler for price input
  const handlePriceChange = (productId: string, value: string) => {
    setProductPrices((prev) => ({ ...prev, [productId]: Number(value) }));
  };

  // Save handler
  const handleSavePrices = async () => {
    if (!selectedClient) return;
    setSaveStatus("");
    try {
      const updates = Object.entries(productPrices)
        .filter(([productId, price]) =>
          selectedClient.selectedProducts.includes(productId)
        )
        .map(async ([productId, price]) => {
          // Save each price as a document: id = `${clientId}_${productId}`
          await setDoc(
            doc(
              collection(db, "client_product_prices"),
              `${selectedClient.id}_${productId}`
            ),
            {
              clientId: selectedClient.id,
              productId,
              price: Number(price),
              updatedAt: new Date().toISOString(),
            }
          );
        });
      // Save minimum billing value, charges, and surcharge
      await setDoc(
        doc(collection(db, "client_minimum_billing"), selectedClient.id),
        {
          clientId: selectedClient.id,
          minBilling: minBilling ? Number(minBilling) : 0,
          serviceChargeEnabled,
          serviceChargePercent: serviceChargePercent
            ? Number(serviceChargePercent)
            : 0,
          fuelChargeEnabled,
          fuelChargePercent: fuelChargePercent ? Number(fuelChargePercent) : 0,
          fuelChargeLabel,
          surchargeEnabled,
          surchargePercent: surchargePercent ? Number(surchargePercent) : 0,
          deliveryCharge: deliveryCharge ? Number(deliveryCharge) : 0,
          generalDeliveryCharge: generalDeliveryCharge ? Number(generalDeliveryCharge) : 0,
          nudosSabanasPrice: nudosSabanasPrice ? Number(nudosSabanasPrice) : 0,
          disposableFee: disposableFee ? Number(disposableFee) : 0,
          serviceChargeFormula,
          fuelChargeFormula,
          surchargeFormula,
          deliveryChargeFormula,
          generalDeliveryChargeFormula,
          nudosSabanasFormula,
          disposableFeeFormula,
          requiredPricingProducts,
          updatedAt: new Date().toISOString(),
        }
      );
      await Promise.all(updates);
      
      // Clear cache for this client since data was updated
      setClientConfigCache(prev => {
        const newCache = { ...prev };
        delete newCache[selectedClient.id];
        return newCache;
      });
      
      setSaveStatus("Prices saved successfully.");
    } catch (e) {
      setSaveStatus("Error saving prices.");
    }
  };

  // --- Invoice Editing Modal State ---
  const [showInvoiceDetailsModal, setShowInvoiceDetailsModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Handler to open invoice edit modal
  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvoiceDetailsModal(true);
  };

  // Print modal state
  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null);

  // State for email sending
  const [emailStatus, setEmailStatus] = useState<string>("");
  const [emailTo, setEmailTo] = useState<string>("");

  // Get charge label based on type
  const getChargeLabel = () => {
    return serviceChargeEnabled ? "Service Charge" : "Fuel Charge";
  };

  async function sendInvoiceByEmail() {
    setEmailStatus("");
    if (!emailTo) {
      setEmailStatus("Please enter a recipient email.");
      return;
    }
    const element = document.getElementById("print-area");
    if (!element) {
      setEmailStatus("Laundry Ticket content not found.");
      return;
    }
    try {
      const pdfBlob = await html2pdf().from(element).outputPdf("blob");
      const pdfBase64 = await blobToBase64(pdfBlob);
      const res = await fetch(`${API_BASE_URL}/api/send-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          subject: `Boleta de Lavandería #${invoiceToPrint?.invoiceNumber}`,
          text: "Adjunto su boleta de lavandería.",
          pdfBase64: pdfBase64.split(",")[1], // remove data:...base64,
          invoiceNumber: invoiceToPrint?.invoiceNumber || invoiceToPrint?.id, // Add invoice number for filename
        }),
      });
      if (res.ok) {
        setEmailStatus("Email sent successfully.");
      } else {
        setEmailStatus("Failed to send email.");
      }
    } catch (err) {
      setEmailStatus("Error generating or sending PDF.");
    }
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Refresh invoices from Firestore
  const refreshInvoices = async () => {
    const all = await getInvoices();
    setInvoices(
      all.filter(
        (inv: Invoice) =>
          inv.status === "done" || inv.status === "completed" || inv.verified
      )
    );
  };

  // Delete handler
  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!window.confirm("Are you sure you want to delete this invoice?"))
      return;
    try {
      const docRef = doc(db, "invoices", invoice.id);
      await setDoc(docRef, { status: "deleted" }, { merge: true });
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoice.id));
      setEmailStatus("Invoice deleted successfully.");
    } catch (e) {
      setEmailStatus("Error deleting invoice.");
    }
  };

  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);

  // Clear selected invoices when client selection changes
  useEffect(() => {
    setSelectedInvoiceIds([]);
  }, [selectedClientId]);

  // State for invoice grouping
  const [showGroupInvoicesModal, setShowGroupInvoicesModal] =
    useState<boolean>(false);
  const [newGroupInvoiceNumber, setNewGroupInvoiceNumber] =
    useState<string>("");
  const [isProcessingGroup, setIsProcessingGroup] = useState<boolean>(false);

  // Handler to group invoices under one invoice number and lock them
  const groupAndLockInvoices = async () => {
    if (selectedInvoiceIds.length < 1) {
      alert("Please select at least one invoice to group");
      return;
    }

    if (!newGroupInvoiceNumber.trim()) {
      alert("Please enter a valid invoice number");
      return;
    }

    // Check if any of the selected invoices are already locked
    const alreadyLockedInvoices = invoices.filter(
      (inv) => selectedInvoiceIds.includes(inv.id) && inv.locked
    );

    if (alreadyLockedInvoices.length > 0) {
      const lockedInvoiceNumbers = alreadyLockedInvoices
        .map((inv) => inv.invoiceNumber || inv.id)
        .join(", ");
      alert(
        `The following invoices are already locked and cannot be grouped: ${lockedInvoiceNumbers}`
      );
      return;
    }

    try {
      setIsProcessingGroup(true);

      // Get the current user's name (or Admin if not available)
      const userName = "Admin"; // Replace with actual user name when available

      // Create metadata about this grouping
      const groupMetadata = {
        groupedInvoiceNumber: newGroupInvoiceNumber,
        locked: true,
        lockedBy: userName,
        lockedAt: new Date().toISOString(),
        groupedAt: new Date().toISOString(),
        groupedBy: userName,
        groupNotes: `Grouped ${selectedInvoiceIds.length} invoices under invoice #${newGroupInvoiceNumber}`,
      };

      // Update each selected invoice with the new invoice number and lock it
      const updatePromises = selectedInvoiceIds.map((invoiceId) => {
        const invoice = invoices.find((inv) => inv.id === invoiceId);
        if (!invoice) return Promise.resolve();

        return updateDoc(doc(db, "invoices", invoiceId), groupMetadata);
      });

      await Promise.all(updatePromises);

      // Log the activity for audit purposes
      try {
        // Create a more user-friendly list of invoice numbers
        const invoiceNumbers = selectedInvoiceIds.map((invoiceId) => {
          const invoice = invoices.find((inv) => inv.id === invoiceId);
          return invoice ? (invoice.invoiceNumber || invoice.id) : invoiceId;
        });
        
        await logActivity({
          type: "group_invoices",
          message: `Grouped ${
            selectedInvoiceIds.length
          } invoices under invoice #${newGroupInvoiceNumber}. Invoices: ${invoiceNumbers.join(
            ", "
          )}`,
          user: userName,
        });
      } catch (logError) {
        console.error("Failed to log activity:", logError);
        // Continue with the process even if logging fails
      }

      // Refresh the invoices list
      const all = await getInvoices();
      setInvoices(
        all.filter(
          (inv: Invoice) =>
            inv.status === "done" || inv.status === "completed" || inv.verified
        )
      );

      // Reset state
      setShowGroupInvoicesModal(false);
      setNewGroupInvoiceNumber("");
      setSelectedInvoiceIds([]);

      alert(
        `Successfully grouped ${selectedInvoiceIds.length} invoices under invoice #${newGroupInvoiceNumber}`
      );
    } catch (error: any) {
      console.error("Error grouping invoices:", error);
      alert(`Failed to group invoices: ${error?.message || "Unknown error"}`);
    } finally {
      setIsProcessingGroup(false);
    }
  };

  // CSV Export Function
  const exportSelectedInvoicesToCSV = () => {
    if (selectedInvoiceIds.length === 0) {
      alert("Please select at least one invoice to export");
      return;
    }

    // Get selected invoices
    const selectedInvoices = invoices.filter((inv) => 
      selectedInvoiceIds.includes(inv.id)
    );

    // Define CSV row type
    type CSVRow = {
      [key: string]: string | number;
    };

    // Get all unique products from selected invoices to create consistent columns
    const allUniqueProducts = new Set<string>();
    selectedInvoices.forEach((inv) => {
      const client = clients.find((c) => c.id === inv.clientId);
      if (client) {
        const productColumns = allProducts.filter((p) =>
          client.selectedProducts.includes(p.id)
        );
        productColumns.forEach((prod) => {
          if (!prod.name.toLowerCase().includes("peso")) {
            allUniqueProducts.add(prod.name);
          }
        });
      }
    });
    
    // Prepare CSV data
    const csvData: CSVRow[] = selectedInvoices.map((inv) => {
      const client = clients.find((c) => c.id === inv.clientId);
      const clientName = client?.name || inv.clientName || "Unknown";
      
      // Calculate totals for this invoice
      let subtotal = 0;
      let pesoSubtotal = 0;
      let productBreakdown: Record<string, { qty: number; amount: number }> = {};
      
      // Get product columns for this client
      let productColumns: { id: string; name: string }[] = [];
      if (client) {
        productColumns = allProducts.filter((p) =>
          client.selectedProducts.includes(p.id)
        );
      }
      
      const pesoProduct = productColumns.find((prod) =>
        prod.name.toLowerCase().includes("peso")
      );
      
      // Calculate peso subtotal
      if (pesoProduct && typeof inv.totalWeight === "number") {
        const pesoPrice = productPrices[pesoProduct.id];
        if (pesoPrice && pesoPrice > 0) {
          pesoSubtotal = inv.totalWeight * pesoPrice;
        }
      }
      
      // Calculate product quantities and amounts
      productColumns.forEach((prod) => {
        if (!prod.name.toLowerCase().includes("peso")) {
          const qty = (inv.carts || []).reduce((sum, cart) => {
            return sum + (cart.items || [])
              .filter((item) => item.productId === prod.id)
              .reduce((s, item) => s + (Number(item.quantity) || 0), 0);
          }, 0);
          
          const price = productPrices[prod.id];
          const amount = qty > 0 && price > 0 ? qty * price : 0;
          
          productBreakdown[prod.name] = { qty, amount };
          if (qty > 0) {
            subtotal += amount;
          }
        }
      });
      
      // Calculate charges
      const baseSubtotal = subtotal + pesoSubtotal;
      let minValue = minBilling ? Number(minBilling) : 0;
      let deliveryChargeValue = 0;
      let generalDeliveryChargeValue = 0;
      
      // Only apply delivery charge if special service is requested
      if (inv.specialServiceRequested) {
        deliveryChargeValue = calculateCharge(
          deliveryChargeFormula,
          Number(deliveryCharge) || 0,
          baseSubtotal,
          1,
          0
        );
      }
      
      // Apply general delivery charge to all invoices
      if (generalDeliveryCharge && Number(generalDeliveryCharge) > 0) {
        generalDeliveryChargeValue = calculateCharge(
          generalDeliveryChargeFormula,
          Number(generalDeliveryCharge) || 0,
          baseSubtotal,
          1,
          0
        );
      }
      
      // Base subtotal (products + peso only - general delivery excluded)
      let baseSubtotalOnly = baseSubtotal;
      
      // Display subtotal (with minimum billing applied if needed, plus special delivery charges only)
      let displaySubtotal = baseSubtotalOnly + deliveryChargeValue;
      if (minValue > 0 && baseSubtotal < minValue) {
        displaySubtotal = minValue + deliveryChargeValue;
      }
      
      // Calculate the higher subtotal value for service charge calculation (excludes general delivery)
      let subtotalForServiceCharge = baseSubtotal;
      if (minValue > 0 && baseSubtotal < minValue) {
        subtotalForServiceCharge = minValue;
      }
      
      let serviceCharge = 0;
      let fuelCharge = 0;
      let surchargeValue = 0;
      let nudosSabanasCharge = 0;
      let disposableFeeValue = 0;
      
      if (serviceChargeEnabled && Number(serviceChargePercent) > 0) {
        serviceCharge = calculateCharge(
          serviceChargeFormula,
          Number(serviceChargePercent),
          subtotalForServiceCharge,
          1,
          0
        );
      }
      
      if (fuelChargeEnabled && Number(fuelChargePercent) > 0) {
        fuelCharge = calculateCharge(
          fuelChargeFormula,
          Number(fuelChargePercent),
          subtotalForServiceCharge,
          1,
          0
        );
      }
      
      if (surchargeEnabled && Number(surchargePercent) > 0) {
        surchargeValue = calculateCharge(
          surchargeFormula,
          Number(surchargePercent),
          subtotalForServiceCharge,
          1,
          0
        );
      }
      
      // Calculate Nudos (Sabanas) charge
      if (nudosSabanasPrice && Number(nudosSabanasPrice) > 0) {
        const sabanasProd = productColumns.find((p) =>
          p.name.toLowerCase().includes("sabana") && 
          !p.name.toLowerCase().includes("nudo")
        );
        
        let sabanasQty = 0;
        if (sabanasProd) {
          sabanasQty = (inv.carts || []).reduce((sum, cart) => {
            return sum + (cart.items || [])
              .filter((item) => item.productId === sabanasProd.id)
              .reduce((s, item) => s + (Number(item.quantity) || 0), 0);
          }, 0);
        }
        
        if (sabanasQty > 0) {
          nudosSabanasCharge = calculateCharge(
            nudosSabanasFormula,
            Number(nudosSabanasPrice),
            baseSubtotal,
            1,
            sabanasQty
          );
        }
      }
      
      // Calculate Disposable Fee
      if (disposableFee && Number(disposableFee) > 0) {
        disposableFeeValue = calculateCharge(
          disposableFeeFormula,
          Number(disposableFee),
          baseSubtotal,
          1,
          0
        );
      }
      
      // Calculate grand total: displaySubtotal + surcharge + service + general delivery charge
      // (excludes fuel, nudos, disposable fee - these appear as separate columns)
      const grandTotal = displaySubtotal + surchargeValue + serviceCharge + generalDeliveryChargeValue;
      
      // Build the CSV row with basic invoice info
      const csvRow: CSVRow = {
        "Invoice #": inv.invoiceNumber || inv.id,
        "Grouped Invoice #": inv.groupedInvoiceNumber || "",
        "Client Name": clientName,
        "Date": inv.date ? formatDateOnlySpanish(inv.date) : "",
        "Truck #": inv.truckNumber || "",
        "Verifier": inv.verifiedBy || "",
        "Total Weight (lbs)": typeof inv.totalWeight === "number" ? inv.totalWeight.toString() : "",
      };
      
      // Add product quantity and price columns for each product
      Array.from(allUniqueProducts).sort().forEach((productName) => {
        const productData = productBreakdown[productName];
        csvRow[`${productName} - Qty`] = productData ? productData.qty.toString() : "0";
        csvRow[`${productName} - Price`] = productData ? `$${productData.amount.toFixed(2)}` : "$0.00";
      });
      
      // Add peso amount and totals
      if (pesoSubtotal > 0) {
        csvRow["Peso Amount"] = `$${pesoSubtotal.toFixed(2)}`;
      }
      
      // Add charge and total columns
      // When minimum billing is applied, set base subtotal to 0 and show minimum as the effective subtotal
      if (minValue > 0 && baseSubtotal < minValue) {
        csvRow["Subtotal (Base)"] = "$0.00";
        csvRow["Minimum Billing"] = `$${minValue.toFixed(2)}`;
      } else {
        csvRow["Subtotal (Base)"] = `$${baseSubtotalOnly.toFixed(2)}`;
        csvRow["Minimum Billing"] = "$0.00";
      }
      if (deliveryChargeValue > 0) csvRow["Delivery Charge"] = `$${deliveryChargeValue.toFixed(2)}`;
      if (generalDeliveryChargeValue > 0) csvRow["General Delivery"] = `$${generalDeliveryChargeValue.toFixed(2)}`;
      if (serviceCharge > 0) csvRow["Service Charge"] = `$${serviceCharge.toFixed(2)}`;
      if (surchargeValue > 0) csvRow["Surcharge"] = `$${surchargeValue.toFixed(2)}`;
      csvRow["Total"] = `$${grandTotal.toFixed(2)}`;
      if (fuelCharge > 0) csvRow[fuelChargeLabel] = `$${fuelCharge.toFixed(2)}`;
      if (nudosSabanasCharge > 0) csvRow["Nudos (Sabanas)"] = `$${nudosSabanasCharge.toFixed(2)}`;
      if (disposableFeeValue > 0) csvRow["Disposable Fee"] = `$${disposableFeeValue.toFixed(2)}`;
      csvRow["Status"] = inv.status || "";
      csvRow["Locked"] = inv.locked ? "Yes" : "No";
      csvRow["Locked By"] = inv.lockedBy || "";
      csvRow["Locked At"] = inv.lockedAt ? new Date(inv.lockedAt).toLocaleString() : "";
      
      return csvRow;
    });

    // Create CSV content
    if (csvData.length === 0) return;
    
    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(","),
      ...csvData.map((row) =>
        headers.map((header) => {
          const value = row[header];
          // Escape commas and quotes in CSV values
          if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(",")
      ),
    ].join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    
    // Generate filename with timestamp and client info
    const clientName = selectedClientId 
      ? clients.find(c => c.id === selectedClientId)?.name || "AllClients"
      : "AllClients";
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `invoices_${clientName}_${timestamp}.csv`;
    
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Log the export activity
    try {
      logActivity({
        type: "export_csv",
        message: `Exported ${selectedInvoiceIds.length} invoices to CSV: ${filename}`,
        user: "Admin", // Replace with actual user when available
      });
    } catch (error) {
      console.error("Failed to log CSV export activity:", error);
    }
  };

  // Reports CSV Export Function
  const exportReportsCSV = () => {
    if (selectedInvoiceIds.length === 0) {
      alert("Please select at least one invoice to export reports");
      return;
    }

    // Get selected invoices
    const selectedInvoices = invoices.filter((inv) => 
      selectedInvoiceIds.includes(inv.id)
    );

    // Define CSV row type
    type ReportsCSVRow = {
      [key: string]: string | number;
    };

    // Check if we're generating the simplified "Numero de Boletas y Totales" report
    if (reportType === 'numero-boletas-totales') {
      // Generate simplified CSV with only Invoice Number and Total columns
      const csvData: ReportsCSVRow[] = selectedInvoices.map((inv) => {
        const client = clients.find((c) => c.id === inv.clientId);
        
        // Get product columns for this client
        let productColumns: { id: string; name: string }[] = [];
        if (client) {
          productColumns = allProducts.filter((p) =>
            client.selectedProducts.includes(p.id)
          );
        }
        
        // Calculate product quantities and subtotal
        let subtotal = 0;
        
        productColumns.forEach((prod) => {
          if (!prod.name.toLowerCase().includes("peso")) {
            const qty = (inv.carts || []).reduce((sum, cart) => {
              return sum + (cart.items || [])
                .filter((item) => item.productId === prod.id)
                .reduce((s, item) => s + (Number(item.quantity) || 0), 0);
            }, 0);
            
            const price = productPrices[prod.id] || 0;
            const amount = qty > 0 && price > 0 ? qty * price : 0;
            
            if (qty > 0) {
              subtotal += amount;
            }
          }
        });
        
        // Handle peso calculations
        const pesoProduct = productColumns.find((prod) =>
          prod.name.toLowerCase().includes("peso")
        );
        
        let pesoSubtotal = 0;
        if (pesoProduct && typeof inv.totalWeight === "number") {
          const pesoPrice = productPrices[pesoProduct.id];
          if (pesoPrice && pesoPrice > 0) {
            pesoSubtotal = inv.totalWeight * pesoPrice;
          }
        }
        
        const baseSubtotal = subtotal + pesoSubtotal;
        let minValue = minBilling ? Number(minBilling) : 0;
        let deliveryChargeValue = 0;
        let generalDeliveryChargeValue = 0;
        
        // Only apply delivery charge if special service is requested
        if (inv.specialServiceRequested) {
          deliveryChargeValue = calculateCharge(
            deliveryChargeFormula,
            Number(deliveryCharge) || 0,
            baseSubtotal,
            1,
            0
          );
        }
        
        // Apply general delivery charge to all invoices
        if (generalDeliveryCharge && Number(generalDeliveryCharge) > 0) {
          generalDeliveryChargeValue = calculateCharge(
            generalDeliveryChargeFormula,
            Number(generalDeliveryCharge) || 0,
            baseSubtotal,
            1,
            0
          );
        }
        
        // Display subtotal (with minimum billing applied if needed, plus special delivery charges only)
        let displaySubtotal = baseSubtotal + deliveryChargeValue;
        if (minValue > 0 && baseSubtotal < minValue) {
          displaySubtotal = minValue + deliveryChargeValue;
        }
        
        // Calculate the higher subtotal value for service charge calculation
        let subtotalForServiceCharge = baseSubtotal;
        if (minValue > 0 && baseSubtotal < minValue) {
          subtotalForServiceCharge = minValue;
        }
        
        let serviceCharge = 0;
        let surchargeValue = 0;
        
        if (serviceChargeEnabled && Number(serviceChargePercent) > 0) {
          serviceCharge = calculateCharge(
            serviceChargeFormula,
            Number(serviceChargePercent),
            subtotalForServiceCharge,
            1,
            0
          );
        }
        
        if (surchargeEnabled && Number(surchargePercent) > 0) {
          surchargeValue = calculateCharge(
            surchargeFormula,
            Number(surchargePercent),
            subtotalForServiceCharge,
            1,
            0
          );
        }
        
        // Calculate grand total: displaySubtotal + surcharge + service + general delivery charge
        const grandTotal = displaySubtotal + surchargeValue + serviceCharge + generalDeliveryChargeValue;
        
        // Return simplified CSV row with Boleta (marked if special service) and Total
        const invoiceNumber = inv.invoiceNumber || inv.id;
        const invoiceNumberWithIndicator = inv.specialServiceRequested 
          ? `${invoiceNumber} *` 
          : invoiceNumber;
        
        return {
          "Boleta": invoiceNumberWithIndicator,
          "Special Service": inv.specialServiceRequested ? "YES" : "NO",
          "Total": `$${grandTotal.toFixed(2)}`
        };
      });

      // Create CSV content for simplified report
      if (csvData.length === 0) return;
      
      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(","),
        ...csvData.map((row) =>
          headers.map((header) => {
            const value = row[header];
            // Escape commas and quotes in CSV values
            if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(",")
        ),
      ].join("\n");

      // Create and download the file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      
      // Generate filename with client name and date range  
      const clientName = selectedClientId 
        ? clients.find(c => c.id === selectedClientId)?.name || "AllClients"
        : "AllClients";
      
      // Format date range for filename
      const startDateFormatted = new Date(startDate).toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric' 
      }).replace(/\//g, '-');
      const endDateFormatted = new Date(endDate).toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric' 
      }).replace(/\//g, '-');
      
      const dateRange = startDate === endDate 
        ? startDateFormatted 
        : `${startDateFormatted}_to_${endDateFormatted}`;
      
      const filename = `${clientName} - ${dateRange} - Numero de Boletas y Totales.csv`;
      
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Log the export activity
      try {
        logActivity({
          type: "export_reports_csv",
          message: `Exported ${selectedInvoiceIds.length} invoices to Numero de Boletas y Totales CSV: ${filename}`,
          user: "Admin", // Replace with actual user when available
        });
      } catch (error) {
        console.error("Failed to log Numero de Boletas y Totales CSV export activity:", error);
      }
      
      return; // Exit early for simplified report
    }

    // Check if we're generating the "Reportes Totales con Precios" report
    if (reportType === 'reportes-totales-con-precios') {
      // Generate CSV with Boleta, Delivery Date, Products with prices in headers, and totals
      // Get all unique products from selected invoices with their prices for headers
      const allUniqueProductsWithPrices = new Map<string, number>();
      selectedInvoices.forEach((inv) => {
        const client = clients.find((c) => c.id === inv.clientId);
        if (client) {
          const productColumns = allProducts.filter((p) =>
            client.selectedProducts.includes(p.id)
          );
          productColumns.forEach((prod) => {
            if (!prod.name.toLowerCase().includes("peso")) {
              const price = productPrices[prod.id] || 0;
              allUniqueProductsWithPrices.set(prod.name, price);
            }
          });
        }
      });

      const csvData: ReportsCSVRow[] = selectedInvoices.map((inv) => {
        const client = clients.find((c) => c.id === inv.clientId);
        
        // Get product columns for this client
        let productColumns: { id: string; name: string }[] = [];
        if (client) {
          productColumns = allProducts.filter((p) =>
            client.selectedProducts.includes(p.id)
          );
        }
        
        // Calculate product quantities
        let productQuantities: Record<string, number> = {};
        let subtotal = 0;
        
        productColumns.forEach((prod) => {
          if (!prod.name.toLowerCase().includes("peso")) {
            const qty = (inv.carts || []).reduce((sum, cart) => {
              return sum + (cart.items || [])
                .filter((item) => item.productId === prod.id)
                .reduce((s, item) => s + (Number(item.quantity) || 0), 0);
            }, 0);
            
            const price = productPrices[prod.id] || 0;
            const amount = qty > 0 && price > 0 ? qty * price : 0;
            
            productQuantities[prod.name] = qty;
            if (qty > 0) {
              subtotal += amount;
            }
          }
        });
        
        // Handle peso calculations
        const pesoProduct = productColumns.find((prod) =>
          prod.name.toLowerCase().includes("peso")
        );
        
        let pesoSubtotal = 0;
        if (pesoProduct && typeof inv.totalWeight === "number") {
          const pesoPrice = productPrices[pesoProduct.id];
          if (pesoPrice && pesoPrice > 0) {
            pesoSubtotal = inv.totalWeight * pesoPrice;
          }
        }
        
        const baseSubtotal = subtotal + pesoSubtotal;
        let minValue = minBilling ? Number(minBilling) : 0;
        let deliveryChargeValue = 0;
        let generalDeliveryChargeValue = 0;
        
        // Only apply delivery charge if special service is requested
        if (inv.specialServiceRequested) {
          deliveryChargeValue = calculateCharge(
            deliveryChargeFormula,
            Number(deliveryCharge) || 0,
            baseSubtotal,
            1,
            0
          );
        }
        
        // Apply general delivery charge to all invoices
        if (generalDeliveryCharge && Number(generalDeliveryCharge) > 0) {
          generalDeliveryChargeValue = calculateCharge(
            generalDeliveryChargeFormula,
            Number(generalDeliveryCharge) || 0,
            baseSubtotal,
            1,
            0
          );
        }
        
        // Display subtotal (with minimum billing applied if needed, plus special delivery charges only)
        let displaySubtotal = baseSubtotal + deliveryChargeValue;
        if (minValue > 0 && baseSubtotal < minValue) {
          displaySubtotal = minValue + deliveryChargeValue;
        }
        
        // Calculate the higher subtotal value for service charge calculation
        let subtotalForServiceCharge = baseSubtotal;
        if (minValue > 0 && baseSubtotal < minValue) {
          subtotalForServiceCharge = minValue;
        }
        
        let serviceCharge = 0;
        let surchargeValue = 0;
        
        if (serviceChargeEnabled && Number(serviceChargePercent) > 0) {
          serviceCharge = calculateCharge(
            serviceChargeFormula,
            Number(serviceChargePercent),
            subtotalForServiceCharge,
            1,
            0
          );
        }
        
        if (surchargeEnabled && Number(surchargePercent) > 0) {
          surchargeValue = calculateCharge(
            surchargeFormula,
            Number(surchargePercent),
            subtotalForServiceCharge,
            1,
            0
          );
        }
        
        // Calculate grand total: displaySubtotal + surcharge + service + general delivery charge
        const grandTotal = displaySubtotal + surchargeValue + serviceCharge + generalDeliveryChargeValue;
        
        // Build the CSV row with basic invoice info
        const csvRow: ReportsCSVRow = {
          "Boleta": inv.invoiceNumber || inv.id,
          "Delivery Date": inv.deliveryDate ? formatDateOnlySpanish(inv.deliveryDate) : "",
        };
        
        // Add product quantity columns with prices in headers
        Array.from(allUniqueProductsWithPrices.keys()).sort().forEach((productName) => {
          const price = allUniqueProductsWithPrices.get(productName) || 0;
          const qty = productQuantities[productName] || 0;
          csvRow[`${productName} ($${price.toFixed(2)})`] = qty;
        });
        
        // Add peso amount if applicable
        if (pesoSubtotal > 0) {
          const pesoPrice = pesoProduct ? (productPrices[pesoProduct.id] || 0) : 0;
          csvRow[`Peso ($${pesoPrice.toFixed(2)}/lb)`] = typeof inv.totalWeight === "number" ? inv.totalWeight : 0;
        }
        
        // Add subtotals and totals
        csvRow["Subtotal"] = `$${baseSubtotal.toFixed(2)}`;
        
        // Add minimum billing if applicable
        if (minValue > 0 && baseSubtotal < minValue) {
          csvRow["Minimum Billing"] = `$${minValue.toFixed(2)}`;
        }
        
        // Add delivery charges
        if (deliveryChargeValue > 0) csvRow["Delivery Charge"] = `$${deliveryChargeValue.toFixed(2)}`;
        if (generalDeliveryChargeValue > 0) csvRow["General Delivery"] = `$${generalDeliveryChargeValue.toFixed(2)}`;
        
        // Add service charges
        if (serviceCharge > 0) csvRow["Service Charge"] = `$${serviceCharge.toFixed(2)}`;
        if (surchargeValue > 0) csvRow["Surcharge"] = `$${surchargeValue.toFixed(2)}`;
        
        // Add total
        csvRow["Total"] = `$${grandTotal.toFixed(2)}`;
        
        return csvRow;
      });

      // Create CSV content for "Reportes Totales con Precios" report
      if (csvData.length === 0) return;
      
      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(","),
        ...csvData.map((row) =>
          headers.map((header) => {
            const value = row[header];
            // Escape commas and quotes in CSV values
            if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(",")
        ),
      ].join("\n");

      // Create and download the file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      
      // Generate filename with client name and date range  
      const clientName = selectedClientId 
        ? clients.find(c => c.id === selectedClientId)?.name || "AllClients"
        : "AllClients";
      
      // Format date range for filename
      const startDateFormatted = new Date(startDate).toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric' 
      }).replace(/\//g, '-');
      const endDateFormatted = new Date(endDate).toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric' 
      }).replace(/\//g, '-');
      
      const dateRange = startDate === endDate 
        ? startDateFormatted 
        : `${startDateFormatted}_to_${endDateFormatted}`;
      
      const filename = `${clientName} - ${dateRange} - Reportes Totales con Precios.csv`;
      
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Log the export activity
      try {
        logActivity({
          type: "export_reports_csv",
          message: `Exported ${selectedInvoiceIds.length} invoices to Reportes Totales con Precios CSV: ${filename}`,
          user: "Admin", // Replace with actual user when available
        });
      } catch (error) {
        console.error("Failed to log Reportes Totales con Precios CSV export activity:", error);
      }
      
      return; // Exit early for this report type
    }

    // Check if we're generating the "Encanto" report
    if (reportType === 'encanto') {
      // Generate CSV with Boleta, Delivery Date, Servilletas quantity, Peso, and totals
      const csvData: ReportsCSVRow[] = selectedInvoices.map((inv) => {
        const client = clients.find((c) => c.id === inv.clientId);
        
        // Get product columns for this client
        let productColumns: { id: string; name: string }[] = [];
        if (client) {
          productColumns = allProducts.filter((p) =>
            client.selectedProducts.includes(p.id)
          );
        }
        
        // Find servilletas product
        const servilletasProduct = productColumns.find((prod) =>
          prod.name.toLowerCase().includes("servilleta")
        );
        
        // Calculate servilletas quantity
        let servilletasQty = 0;
        if (servilletasProduct) {
          servilletasQty = (inv.carts || []).reduce((sum, cart) => {
            return sum + (cart.items || [])
              .filter((item) => item.productId === servilletasProduct.id)
              .reduce((s, item) => s + (Number(item.quantity) || 0), 0);
          }, 0);
        }
        
        // Calculate product quantities and subtotal
        let subtotal = 0;
        
        productColumns.forEach((prod) => {
          if (!prod.name.toLowerCase().includes("peso")) {
            const qty = (inv.carts || []).reduce((sum, cart) => {
              return sum + (cart.items || [])
                .filter((item) => item.productId === prod.id)
                .reduce((s, item) => s + (Number(item.quantity) || 0), 0);
            }, 0);
            
            const price = productPrices[prod.id] || 0;
            const amount = qty > 0 && price > 0 ? qty * price : 0;
            
            if (qty > 0) {
              subtotal += amount;
            }
          }
        });
        
        // Handle peso calculations
        const pesoProduct = productColumns.find((prod) =>
          prod.name.toLowerCase().includes("peso")
        );
        
        let pesoSubtotal = 0;
        if (pesoProduct && typeof inv.totalWeight === "number") {
          const pesoPrice = productPrices[pesoProduct.id];
          if (pesoPrice && pesoPrice > 0) {
            pesoSubtotal = inv.totalWeight * pesoPrice;
          }
        }
        
        const baseSubtotal = subtotal + pesoSubtotal;
        let minValue = minBilling ? Number(minBilling) : 0;
        let deliveryChargeValue = 0;
        let generalDeliveryChargeValue = 0;
        
        // Only apply delivery charge if special service is requested
        if (inv.specialServiceRequested) {
          deliveryChargeValue = calculateCharge(
            deliveryChargeFormula,
            Number(deliveryCharge) || 0,
            baseSubtotal,
            1,
            0
          );
        }
        
        // Apply general delivery charge to all invoices
        if (generalDeliveryCharge && Number(generalDeliveryCharge) > 0) {
          generalDeliveryChargeValue = calculateCharge(
            generalDeliveryChargeFormula,
            Number(generalDeliveryCharge) || 0,
            baseSubtotal,
            1,
            0
          );
        }
        
        // Display subtotal (with minimum billing applied if needed, plus special delivery charges only)
        let displaySubtotal = baseSubtotal + deliveryChargeValue;
        if (minValue > 0 && baseSubtotal < minValue) {
          displaySubtotal = minValue + deliveryChargeValue;
        }
        
        // Calculate the higher subtotal value for service charge calculation
        let subtotalForServiceCharge = baseSubtotal;
        if (minValue > 0 && baseSubtotal < minValue) {
          subtotalForServiceCharge = minValue;
        }
        
        let serviceCharge = 0;
        let surchargeValue = 0;
        
        if (serviceChargeEnabled && Number(serviceChargePercent) > 0) {
          serviceCharge = calculateCharge(
            serviceChargeFormula,
            Number(serviceChargePercent),
            subtotalForServiceCharge,
            1,
            0
          );
        }
        
        if (surchargeEnabled && Number(surchargePercent) > 0) {
          surchargeValue = calculateCharge(
            surchargeFormula,
            Number(surchargePercent),
            subtotalForServiceCharge,
            1,
            0
          );
        }
        
        // Calculate grand total: displaySubtotal + surcharge + service + general delivery charge
        const grandTotal = displaySubtotal + surchargeValue + serviceCharge + generalDeliveryChargeValue;
        
        // Build the CSV row with Encanto report format
        const csvRow: ReportsCSVRow = {
          "Boleta": inv.invoiceNumber || inv.id,
          "Delivery Date": inv.deliveryDate ? formatDateOnlySpanish(inv.deliveryDate) : "",
          "Servilletas": servilletasQty,
          "Peso": typeof inv.totalWeight === "number" ? inv.totalWeight : 0,
          "Subtotal": `$${baseSubtotal.toFixed(2)}`,
        };
        
        // Add minimum billing if applicable
        if (minValue > 0 && baseSubtotal < minValue) {
          csvRow["Minimum Billing"] = `$${minValue.toFixed(2)}`;
        }
        
        // Add delivery charges
        if (deliveryChargeValue > 0) csvRow["Delivery Charge"] = `$${deliveryChargeValue.toFixed(2)}`;
        if (generalDeliveryChargeValue > 0) csvRow["General Delivery"] = `$${generalDeliveryChargeValue.toFixed(2)}`;
        
        // Add service charges
        if (serviceCharge > 0) csvRow["Service Charge"] = `$${serviceCharge.toFixed(2)}`;
        if (surchargeValue > 0) csvRow["Surcharge"] = `$${surchargeValue.toFixed(2)}`;
        
        // Add total
        csvRow["Total"] = `$${grandTotal.toFixed(2)}`;
        
        return csvRow;
      });

      // Create CSV content for Encanto report
      if (csvData.length === 0) return;
      
      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(","),
        ...csvData.map((row) =>
          headers.map((header) => {
            const value = row[header];
            // Escape commas and quotes in CSV values
            if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(",")
        ),
      ].join("\n");

      // Create and download the file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      
      // Generate filename with client name and date range  
      const clientName = selectedClientId 
        ? clients.find(c => c.id === selectedClientId)?.name || "AllClients"
        : "AllClients";
      
      // Format date range for filename
      const startDateFormatted = new Date(startDate).toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric' 
      }).replace(/\//g, '-');
      const endDateFormatted = new Date(endDate).toLocaleDateString('en-US', { 
        month: '2-digit', 
        day: '2-digit', 
        year: 'numeric' 
      }).replace(/\//g, '-');
      
      const dateRange = startDate === endDate 
        ? startDateFormatted 
        : `${startDateFormatted}_to_${endDateFormatted}`;
      
      const filename = `${clientName} - ${dateRange} - Encanto Report.csv`;
      
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Log the export activity
      try {
        logActivity({
          type: "export_reports_csv",
          message: `Exported ${selectedInvoiceIds.length} invoices to Encanto Report CSV: ${filename}`,
          user: "Admin", // Replace with actual user when available
        });
      } catch (error) {
        console.error("Failed to log Encanto Report CSV export activity:", error);
      }
      
      return; // Exit early for Encanto report
    }

    // Original detailed report generation for other report types
    // Get all unique products from selected invoices with their prices for headers
    const allUniqueProductsWithPrices = new Map<string, number>();
    selectedInvoices.forEach((inv) => {
      const client = clients.find((c) => c.id === inv.clientId);
      if (client) {
        const productColumns = allProducts.filter((p) =>
          client.selectedProducts.includes(p.id)
        );
        productColumns.forEach((prod) => {
          if (!prod.name.toLowerCase().includes("peso")) {
            const price = productPrices[prod.id] || 0;
            allUniqueProductsWithPrices.set(prod.name, price);
          }
        });
      }
    });
    
    // Prepare Reports CSV data
    const csvData: ReportsCSVRow[] = selectedInvoices.map((inv) => {
      const client = clients.find((c) => c.id === inv.clientId);
      const clientName = client?.name || inv.clientName || "Unknown";
      
      // Get product columns for this client
      let productColumns: { id: string; name: string }[] = [];
      if (client) {
        productColumns = allProducts.filter((p) =>
          client.selectedProducts.includes(p.id)
        );
      }
      
      // Calculate product quantities
      let productQuantities: Record<string, number> = {};
      let subtotal = 0;
      
      productColumns.forEach((prod) => {
        if (!prod.name.toLowerCase().includes("peso")) {
          const qty = (inv.carts || []).reduce((sum, cart) => {
            return sum + (cart.items || [])
              .filter((item) => item.productId === prod.id)
              .reduce((s, item) => s + (Number(item.quantity) || 0), 0);
          }, 0);
          
          const price = productPrices[prod.id] || 0;
          const amount = qty > 0 && price > 0 ? qty * price : 0;
          
          productQuantities[prod.name] = qty;
          if (qty > 0) {
            subtotal += amount;
          }
        }
      });
      
      // Handle peso calculations
      const pesoProduct = productColumns.find((prod) =>
        prod.name.toLowerCase().includes("peso")
      );
      
      let pesoSubtotal = 0;
      if (pesoProduct && typeof inv.totalWeight === "number") {
        const pesoPrice = productPrices[pesoProduct.id];
        if (pesoPrice && pesoPrice > 0) {
          pesoSubtotal = inv.totalWeight * pesoPrice;
        }
      }
      
      const totalSubtotal = subtotal + pesoSubtotal;
      
      // Build the CSV row with basic invoice info
      const csvRow: ReportsCSVRow = {
        "Laundry Ticket": inv.invoiceNumber || inv.id,
        "Date": inv.date ? formatDateOnlySpanish(inv.date) : "",
        "Delivery Date": inv.deliveryDate ? formatDateOnlySpanish(inv.deliveryDate) : "",
      };
      
      // Add product quantity columns (quantities only, prices are in headers)
      Array.from(allUniqueProductsWithPrices.keys()).sort().forEach((productName) => {
        const price = allUniqueProductsWithPrices.get(productName) || 0;
        const qty = productQuantities[productName] || 0;
        csvRow[`${productName} ($${price.toFixed(2)})`] = qty;
      });
      
      // Add peso amount if applicable
      if (pesoSubtotal > 0) {
        const pesoPrice = pesoProduct ? (productPrices[pesoProduct.id] || 0) : 0;
        csvRow[`Peso ($${pesoPrice.toFixed(2)}/lb)`] = typeof inv.totalWeight === "number" ? inv.totalWeight : 0;
      }
      
      // Add subtotal
      csvRow["Subtotal"] = `$${totalSubtotal.toFixed(2)}`;
      
      // Calculate all charges similar to billing CSV
      const baseSubtotal = totalSubtotal;
      let minValue = minBilling ? Number(minBilling) : 0;
      let deliveryChargeValue = 0;
      let generalDeliveryChargeValue = 0;
      
      // Only apply delivery charge if special service is requested
      if (inv.specialServiceRequested) {
        deliveryChargeValue = calculateCharge(
          deliveryChargeFormula,
          Number(deliveryCharge) || 0,
          baseSubtotal,
          1,
          0
        );
      }
      
      // Apply general delivery charge to all invoices
      if (generalDeliveryCharge && Number(generalDeliveryCharge) > 0) {
        generalDeliveryChargeValue = calculateCharge(
          generalDeliveryChargeFormula,
          Number(generalDeliveryCharge) || 0,
          baseSubtotal,
          1,
          0
        );
      }
      
      // Display subtotal (with minimum billing applied if needed, plus special delivery charges only)
      let displaySubtotal = baseSubtotal + deliveryChargeValue;
      if (minValue > 0 && baseSubtotal < minValue) {
        displaySubtotal = minValue + deliveryChargeValue;
      }
      
      // Calculate the higher subtotal value for service charge calculation
      let subtotalForServiceCharge = baseSubtotal;
      if (minValue > 0 && baseSubtotal < minValue) {
        subtotalForServiceCharge = minValue;
      }
      
      let serviceCharge = 0;
      let fuelCharge = 0;
      let surchargeValue = 0;
      let nudosSabanasCharge = 0;
      let disposableFeeValue = 0;
      
      if (serviceChargeEnabled && Number(serviceChargePercent) > 0) {
        serviceCharge = calculateCharge(
          serviceChargeFormula,
          Number(serviceChargePercent),
          subtotalForServiceCharge,
          1,
          0
        );
      }
      
      if (fuelChargeEnabled && Number(fuelChargePercent) > 0) {
        fuelCharge = calculateCharge(
          fuelChargeFormula,
          Number(fuelChargePercent),
          subtotalForServiceCharge,
          1,
          0
        );
      }
      
      if (surchargeEnabled && Number(surchargePercent) > 0) {
        surchargeValue = calculateCharge(
          surchargeFormula,
          Number(surchargePercent),
          subtotalForServiceCharge,
          1,
          0
        );
      }
      
      // Calculate Nudos (Sabanas) charge
      if (nudosSabanasPrice && Number(nudosSabanasPrice) > 0) {
        const sabanasProd = productColumns.find((p) =>
          p.name.toLowerCase().includes("sabana") && 
          !p.name.toLowerCase().includes("nudo")
        );
        
        let sabanasQty = 0;
        if (sabanasProd) {
          sabanasQty = (inv.carts || []).reduce((sum, cart) => {
            return sum + (cart.items || [])
              .filter((item) => item.productId === sabanasProd.id)
              .reduce((s, item) => s + (Number(item.quantity) || 0), 0);
          }, 0);
        }
        
        if (sabanasQty > 0) {
          nudosSabanasCharge = calculateCharge(
            nudosSabanasFormula,
            Number(nudosSabanasPrice),
            baseSubtotal,
            1,
            sabanasQty
          );
        }
      }
      
      // Calculate Disposable Fee
      if (disposableFee && Number(disposableFee) > 0) {
        disposableFeeValue = calculateCharge(
          disposableFeeFormula,
          Number(disposableFee),
          baseSubtotal,
          1,
          0
        );
      }
      
      // Add charge and total columns in same order as billing CSV
      // When minimum billing is applied, set base subtotal to 0 and show minimum as the effective subtotal
      if (minValue > 0 && baseSubtotal < minValue) {
        csvRow["Subtotal (Base)"] = "$0.00";
        csvRow["Minimum Billing"] = `$${minValue.toFixed(2)}`;
      } else {
        csvRow["Subtotal (Base)"] = `$${baseSubtotal.toFixed(2)}`;
        csvRow["Minimum Billing"] = "$0.00";
      }
      if (deliveryChargeValue > 0) csvRow["Delivery Charge"] = `$${deliveryChargeValue.toFixed(2)}`;
      if (generalDeliveryChargeValue > 0) csvRow["General Delivery"] = `$${generalDeliveryChargeValue.toFixed(2)}`;
      if (serviceCharge > 0) csvRow["Service Charge"] = `$${serviceCharge.toFixed(2)}`;
      if (surchargeValue > 0) csvRow["Surcharge"] = `$${surchargeValue.toFixed(2)}`;
      
      // Calculate grand total: displaySubtotal + surcharge + service + general delivery charge
      const grandTotal = displaySubtotal + surchargeValue + serviceCharge + generalDeliveryChargeValue;
      csvRow["Total"] = `$${grandTotal.toFixed(2)}`;
      
      // Add remaining charge columns after total (matching billing CSV order)
      if (fuelCharge > 0) csvRow[fuelChargeLabel] = `$${fuelCharge.toFixed(2)}`;
      if (nudosSabanasCharge > 0) csvRow["Nudos (Sabanas)"] = `$${nudosSabanasCharge.toFixed(2)}`;
      if (disposableFeeValue > 0) csvRow["Disposable Fee"] = `$${disposableFeeValue.toFixed(2)}`;
      
      return csvRow;
    });

    // Create CSV content
    if (csvData.length === 0) return;
    
    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(","),
      ...csvData.map((row) =>
        headers.map((header) => {
          const value = row[header];
          // Escape commas and quotes in CSV values
          if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(",")
      ),
    ].join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    
    // Generate filename with client name and date range
    const clientName = selectedClientId 
      ? clients.find(c => c.id === selectedClientId)?.name || "AllClients"
      : "AllClients";
    
    // Format date range for filename
    const startDateFormatted = new Date(startDate).toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric' 
    }).replace(/\//g, '-');
    const endDateFormatted = new Date(endDate).toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric' 
    }).replace(/\//g, '-');
    
    const dateRange = startDate === endDate 
      ? startDateFormatted 
      : `${startDateFormatted}_to_${endDateFormatted}`;
    
    // Get report type label for filename
    const reportTypeLabel = REPORT_TYPES.find(rt => rt.value === reportType)?.label || 'Detailed Report';
    const filename = `${clientName} - ${dateRange} - ${reportTypeLabel}.csv`;
    
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Log the export activity
    try {
      logActivity({
        type: "export_reports_csv",
        message: `Exported ${selectedInvoiceIds.length} invoices to ${reportTypeLabel} CSV: ${filename}`,
        user: "Admin", // Replace with actual user when available
      });
    } catch (error) {
      console.error("Failed to log Reports CSV export activity:", error);
    }
  };

  return (
    <div className="container py-4">
      {/* Client Dropdown Filter and Date Range Filter */}
      <div className="row mb-4">
        <div className="col-md-4">
          <label className="form-label">Select Client</label>
          <select
            className="form-select"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">All Clients</option>
            {clients
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label">Start Date</label>
          <input
            type="date"
            className="form-control"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Start date"
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">End Date</label>
          <input
            type="date"
            className="form-control"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="End date"
            min={startDate} // Ensure end date is not before start date
          />
        </div>
        <div className="col-md-2 d-flex align-items-end">
          <button
            className="btn btn-outline-secondary w-100"
            onClick={() => {
              const monthToDate = getMonthToDateRange();
              setStartDate(monthToDate.start);
              setEndDate(monthToDate.end);
            }}
            title="Reset to month-to-date"
          >
            Reset to MTD
          </button>
        </div>
      </div>
      
      {/* Date Range Indicator and Quick Filters */}
      <div className="mb-3 d-flex justify-content-between align-items-center">
        <small className="text-muted">
          <i className="bi bi-calendar-range me-1"></i>
          Showing invoices from {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
          {(() => {
            const monthToDate = getMonthToDateRange();
            return startDate === monthToDate.start && endDate === monthToDate.end ? " (Month-to-Date)" : "";
          })()}
        </small>
        <div className="btn-group btn-group-sm" role="group">
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10);
              setStartDate(today);
              setEndDate(today);
            }}
            title="Today only"
          >
            Today
          </button>
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => {
              const now = new Date();
              const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
              const weekEnd = new Date();
              setStartDate(weekStart.toISOString().slice(0, 10));
              setEndDate(weekEnd.toISOString().slice(0, 10));
            }}
            title="This week"
          >
            This Week
          </button>
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => {
              const now = new Date();
              const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
              setStartDate(lastMonth.toISOString().slice(0, 10));
              setEndDate(lastMonthEnd.toISOString().slice(0, 10));
            }}
            title="Last month"
          >
            Last Month
          </button>
        </div>
      </div>
      <h2>Billing Section</h2>
      {/* Per-Product Price Table for Selected Client */}
      {selectedClient && (
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Set Product Prices for {selectedClient.name}</h5>
            <button
              className={`btn btn-sm ${showPricingTable ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
              onClick={() => setShowPricingTable(!showPricingTable)}
            >
              {showPricingTable ? (
                <>
                  <i className="bi bi-eye-slash me-1"></i>
                  Hide Prices
                </>
              ) : (
                <>
                  <i className="bi bi-eye me-1"></i>
                  Show Prices
                </>
              )}
            </button>
          </div>
          
          {showPricingTable && (
            <>
              <div className="table-responsive" style={{ maxWidth: 600 }}>
                <table className="table table-bordered align-middle">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th style={{ width: 180 }}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                {allProducts
                  .filter((p) => selectedClient.selectedProducts.includes(p.id))
                  .map((product) => {
                    const priceValue = productPrices[product.id];
                    const isMissing = !priceValue || priceValue <= 0;
                    const name = product.name.toLowerCase();
                    return (
                      <tr key={product.id}>
                        <td style={nowrapCellStyle}>
                          {name.includes("scrub shirt") ||
                          name.includes("scrub top") ||
                          name.includes("scrub") ? (
                            <img
                              src={"/images/products/scrubshirt.png"}
                              alt="Scrub Shirt"
                              style={{
                                width: 28,
                                height: 28,
                                objectFit: "contain",
                                marginRight: 8,
                                verticalAlign: "middle",
                              }}
                            />
                          ) : null}
                          {product.name}
                        </td>
                        <td style={nowrapCellStyle}>
                          <input
                            type="number"
                            className={`form-control${
                              isMissing ? " is-invalid" : ""
                            }`}
                            min={0}
                            value={priceValue ?? ""}
                            onChange={(e) =>
                              handlePriceChange(product.id, e.target.value)
                            }
                            placeholder="Enter price"
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <button className="btn btn-success mt-2" onClick={handleSavePrices}>
            Save Prices
          </button>
          {saveStatus && (
            <div
              className={`alert ${
                saveStatus.includes("success")
                  ? "alert-success"
                  : "alert-danger"
              } mt-2`}
            >
              {saveStatus}
            </div>
          )}
            </>
          )}
        </div>
      )}
      
      {/* Charges Configuration Table for Selected Client */}
      {selectedClient && (
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Configure Charges for {selectedClient.name}</h5>
            <button
              className={`btn btn-sm ${showChargesTable ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
              onClick={() => setShowChargesTable(!showChargesTable)}
            >
              {showChargesTable ? (
                <>
                  <i className="bi bi-eye-slash me-1"></i>
                  Hide Charges
                </>
              ) : (
                <>
                  <i className="bi bi-eye me-1"></i>
                  Show Charges
                </>
              )}
            </button>
          </div>
          
          {showChargesTable && (
            <>
              <div className="table-responsive" style={{ maxWidth: 800 }}>
                <table className="table table-bordered align-middle">
                  <thead>
                    <tr>
                      <th>Charge Type</th>
                      <th style={{ width: 100 }}>Enabled</th>
                      <th style={{ width: 120 }}>Value</th>
                      <th style={{ width: 140 }}>Formula</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Minimum Billing */}
                    <tr>
                      <td style={nowrapCellStyle}>
                        <strong>Minimum Billing</strong>
                      </td>
                      <td style={nowrapCellStyle}>
                        <span className={`badge ${minBilling && Number(minBilling) > 0 ? 'bg-success' : 'bg-secondary'}`}>
                          {minBilling && Number(minBilling) > 0 ? 'ON' : 'OFF'}
                        </span>
                      </td>
                      <td style={nowrapCellStyle}>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min={0}
                          step="0.01"
                          value={minBilling}
                          onChange={(e) => setMinBilling(e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                      <td style={nowrapCellStyle}>
                        <span className="badge bg-info">Fixed</span>
                      </td>
                      <td>
                        <small className="text-muted">Minimum charge per invoice regardless of actual total</small>
                      </td>
                    </tr>
                    
                    {/* Service Charge */}
                    <tr>
                      <td style={nowrapCellStyle}>
                        <strong>Service Charge</strong>
                      </td>
                      <td style={nowrapCellStyle}>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={serviceChargeEnabled}
                            onChange={(e) => setServiceChargeEnabled(e.target.checked)}
                          />
                        </div>
                      </td>
                      <td style={nowrapCellStyle}>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min={0}
                          step="0.01"
                          value={serviceChargePercent}
                          onChange={(e) => setServiceChargePercent(e.target.value)}
                          placeholder="0.00"
                          disabled={!serviceChargeEnabled}
                        />
                      </td>
                      <td style={nowrapCellStyle}>
                        <select
                          className="form-select form-select-sm"
                          value={serviceChargeFormula}
                          onChange={(e) => setServiceChargeFormula(e.target.value as "percentage" | "fixed" | "perInvoice")}
                          disabled={!serviceChargeEnabled}
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed</option>
                          <option value="perInvoice">Per Invoice</option>
                        </select>
                      </td>
                      <td>
                        <small className="text-muted">Additional service charge applied to subtotal</small>
                      </td>
                    </tr>
                    
                    {/* Fuel Charge */}
                    <tr>
                      <td style={nowrapCellStyle}>
                        <strong>{fuelChargeLabel}</strong>
                      </td>
                      <td style={nowrapCellStyle}>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={fuelChargeEnabled}
                            onChange={(e) => setFuelChargeEnabled(e.target.checked)}
                          />
                        </div>
                      </td>
                      <td style={nowrapCellStyle}>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min={0}
                          step="0.01"
                          value={fuelChargePercent}
                          onChange={(e) => setFuelChargePercent(e.target.value)}
                          placeholder="0.00"
                          disabled={!fuelChargeEnabled}
                        />
                      </td>
                      <td style={nowrapCellStyle}>
                        <select
                          className="form-select form-select-sm"
                          value={fuelChargeFormula}
                          onChange={(e) => setFuelChargeFormula(e.target.value as "percentage" | "fixed" | "perInvoice")}
                          disabled={!fuelChargeEnabled}
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed</option>
                          <option value="perInvoice">Per Invoice</option>
                        </select>
                      </td>
                      <td>
                        <small className="text-muted">Fuel surcharge applied to subtotal</small>
                      </td>
                    </tr>
                    
                    {/* Surcharge */}
                    <tr>
                      <td style={nowrapCellStyle}>
                        <strong>Surcharge</strong>
                      </td>
                      <td style={nowrapCellStyle}>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={surchargeEnabled}
                            onChange={(e) => setSurchargeEnabled(e.target.checked)}
                          />
                        </div>
                      </td>
                      <td style={nowrapCellStyle}>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min={0}
                          step="0.01"
                          value={surchargePercent}
                          onChange={(e) => setSurchargePercent(e.target.value)}
                          placeholder="0.00"
                          disabled={!surchargeEnabled}
                        />
                      </td>
                      <td style={nowrapCellStyle}>
                        <select
                          className="form-select form-select-sm"
                          value={surchargeFormula}
                          onChange={(e) => setSurchargeFormula(e.target.value as "percentage" | "fixed" | "perInvoice")}
                          disabled={!surchargeEnabled}
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed</option>
                          <option value="perInvoice">Per Invoice</option>
                        </select>
                      </td>
                      <td>
                        <small className="text-muted">Additional surcharge applied to subtotal</small>
                      </td>
                    </tr>
                    
                    {/* General Delivery Charge */}
                    <tr>
                      <td style={nowrapCellStyle}>
                        <strong>General Delivery</strong>
                      </td>
                      <td style={nowrapCellStyle}>
                        <span className={`badge ${generalDeliveryCharge && Number(generalDeliveryCharge) > 0 ? 'bg-success' : 'bg-secondary'}`}>
                          {generalDeliveryCharge && Number(generalDeliveryCharge) > 0 ? 'ON' : 'OFF'}
                        </span>
                      </td>
                      <td style={nowrapCellStyle}>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min={0}
                          step="0.01"
                          value={generalDeliveryCharge}
                          onChange={(e) => setGeneralDeliveryCharge(e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                      <td style={nowrapCellStyle}>
                        <select
                          className="form-select form-select-sm"
                          value={generalDeliveryChargeFormula}
                          onChange={(e) => setGeneralDeliveryChargeFormula(e.target.value as "percentage" | "fixed" | "perInvoice")}
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed</option>
                          <option value="perInvoice">Per Invoice</option>
                        </select>
                      </td>
                      <td>
                        <small className="text-muted">Delivery charge applied to all invoices</small>
                      </td>
                    </tr>
                    
                    {/* Special Delivery Charge */}
                    <tr>
                      <td style={nowrapCellStyle}>
                        <strong>Special Delivery</strong>
                      </td>
                      <td style={nowrapCellStyle}>
                        <span className={`badge ${deliveryCharge && Number(deliveryCharge) > 0 ? 'bg-success' : 'bg-secondary'}`}>
                          {deliveryCharge && Number(deliveryCharge) > 0 ? 'ON' : 'OFF'}
                        </span>
                      </td>
                      <td style={nowrapCellStyle}>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min={0}
                          step="0.01"
                          value={deliveryCharge}
                          onChange={(e) => setDeliveryCharge(e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                      <td style={nowrapCellStyle}>
                        <select
                          className="form-select form-select-sm"
                          value={deliveryChargeFormula}
                          onChange={(e) => setDeliveryChargeFormula(e.target.value as "percentage" | "fixed" | "perInvoice")}
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed</option>
                          <option value="perInvoice">Per Invoice</option>
                        </select>
                      </td>
                      <td>
                        <small className="text-muted">Extra charge for special delivery requests</small>
                      </td>
                    </tr>
                    
                    {/* Nudos (Sabanas) Charge */}
                    <tr>
                      <td style={nowrapCellStyle}>
                        <strong>Nudos (Sabanas)</strong>
                      </td>
                      <td style={nowrapCellStyle}>
                        <span className={`badge ${nudosSabanasPrice && Number(nudosSabanasPrice) > 0 ? 'bg-success' : 'bg-secondary'}`}>
                          {nudosSabanasPrice && Number(nudosSabanasPrice) > 0 ? 'ON' : 'OFF'}
                        </span>
                      </td>
                      <td style={nowrapCellStyle}>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min={0}
                          step="0.01"
                          value={nudosSabanasPrice}
                          onChange={(e) => setNudosSabanasPrice(e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                      <td style={nowrapCellStyle}>
                        <select
                          className="form-select form-select-sm"
                          value={nudosSabanasFormula}
                          onChange={(e) => setNudosSabanasFormula(e.target.value as "percentage" | "fixed" | "perInvoice" | "perUnit")}
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed</option>
                          <option value="perInvoice">Per Invoice</option>
                          <option value="perUnit">Per Unit</option>
                        </select>
                      </td>
                      <td>
                        <small className="text-muted">Special charge for knotting bed sheets</small>
                      </td>
                    </tr>
                    
                    {/* Disposable Fee */}
                    <tr>
                      <td style={nowrapCellStyle}>
                        <strong>Disposable Fee</strong>
                      </td>
                      <td style={nowrapCellStyle}>
                        <span className={`badge ${disposableFee && Number(disposableFee) > 0 ? 'bg-success' : 'bg-secondary'}`}>
                          {disposableFee && Number(disposableFee) > 0 ? 'ON' : 'OFF'}
                        </span>
                      </td>
                      <td style={nowrapCellStyle}>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          min={0}
                          step="0.01"
                          value={disposableFee}
                          onChange={(e) => setDisposableFee(e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                      <td style={nowrapCellStyle}>
                        <select
                          className="form-select form-select-sm"
                          value={disposableFeeFormula}
                          onChange={(e) => setDisposableFeeFormula(e.target.value as "percentage" | "fixed" | "perInvoice")}
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed</option>
                          <option value="perInvoice">Per Invoice</option>
                        </select>
                      </td>
                      <td>
                        <small className="text-muted">Fee for disposable items</small>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mb-2">
                <label className="form-label">Default Report Type</label>
                <select
                  className="form-select"
                  value={selectedClient.defaultReportType || reportType}
                  onChange={e => handleDefaultReportTypeChange(selectedClient.id, e.target.value)}
                >
                  {REPORT_TYPES.map(rt => (
                    <option key={rt.value} value={rt.value}>{rt.label}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-success mt-2" onClick={handleSavePrices}>
                Save Charges Configuration
              </button>
              <div className="mt-2">
                <small className="text-muted">
                  <strong>Formula Types:</strong> Percentage (% of subtotal), Fixed (flat amount), Per Invoice (amount per invoice), Per Unit (amount per item)
                </small>
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Buttons for selected invoices */}
      {selectedInvoiceIds.length > 0 && (
        <div className="mb-3 d-flex gap-2 align-items-end">
          <button
            className="btn btn-primary"
            onClick={() => setShowGroupInvoicesModal(true)}
          >
            <i className="bi bi-object-ungroup me-1"></i> Group{" "}
            {selectedInvoiceIds.length} Selected Invoices
          </button>
          <button
            className="btn btn-success"
            onClick={exportSelectedInvoicesToCSV}
          >
            <i className="bi bi-download me-1"></i> Export{" "}
            {selectedInvoiceIds.length} Selected to CSV
          </button>
          <div>
            <label className="form-label mb-0">Report Type</label>
            <select
              className="form-select form-select-sm"
              style={{ minWidth: 160 }}
              value={reportType}
              onChange={e => setReportType(e.target.value)}
            >
              {REPORT_TYPES.map(rt => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-info"
            onClick={exportReportsCSV}
          >
            <i className="bi bi-file-earmark-spreadsheet me-1"></i> Export{" "}
            {selectedInvoiceIds.length} Reports CSV
          </button>
        </div>
      )}

      {/* Legend Button */}
      <div className="mb-3">
        <button
          className="btn btn-info btn-sm"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#legendCollapse"
          aria-expanded="false"
          aria-controls="legendCollapse"
        >
          <i className="bi bi-info-circle me-1"></i> Legend
        </button>
        <div className="collapse mt-2" id="legendCollapse">
          <div className="card card-body">
            <h6 className="card-title">Color Coding Guide</h6>
            <div className="row">
              <div className="col-md-6">
                <div className="d-flex align-items-center mb-2">
                  <div 
                    className="me-2 px-2 py-1 rounded text-white fw-bold" 
                    style={{ backgroundColor: '#dc3545', fontSize: '0.8rem' }}
                  >
                    Sample Row
                  </div>
                  <span><strong>Red highlighted rows:</strong> Missing product prices. These invoices cannot be billed until prices are set.</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="d-flex align-items-center mb-2">
                  <div 
                    className="me-2 px-2 py-1 rounded text-white fw-bold" 
                    style={{ backgroundColor: '#28a745', fontSize: '0.8rem' }}
                  >
                    $100.00
                  </div>
                  <span><strong>Green highlighted subtotals:</strong> The higher value between base subtotal and minimum billing subtotal (applied to both individual rows and footer totals).</span>
                </div>
              </div>
            </div>
            <hr className="my-2" />
            <small className="text-muted">
              <strong>Note:</strong> When minimum billing is configured, one of the two subtotal columns will be highlighted in green to show which value is being used for billing calculations. All percentage-based charges (Service Charge, Fuel Charge, Surcharge) are calculated based on the highlighted subtotal value.
            </small>
          </div>
        </div>
      </div>

      {/* Completed Invoices Table */}
      {(() => {
        // Filter/group invoices by selected client and date range
        let filteredInvoices = selectedClientId
          ? invoices.filter((inv) => inv.clientId === selectedClientId)
          : invoices;

        // Apply date range filtering (always apply since we default to month-to-date)
        filteredInvoices = filteredInvoices.filter((inv) => {
          if (!inv.date) return false; // Exclude invoices without dates
          
          const invoiceDate = new Date(inv.date);
          const startDateTime = new Date(startDate).getTime();
          const endDateTime = new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1); // End of day
          
          const invoiceDateTime = invoiceDate.getTime();
          
          return invoiceDateTime >= startDateTime && invoiceDateTime <= endDateTime;
        });

        const grouped = filteredInvoices.reduce((acc, inv) => {
          if (!acc[inv.clientId]) acc[inv.clientId] = [];
          acc[inv.clientId].push(inv);
          return acc;
        }, {} as Record<string, Invoice[]>);
        if (Object.keys(grouped).length === 0) {
          return <div className="text-muted">No completed laundry tickets found.</div>;
        }
        // Get product columns for selected client
        let productColumns: { id: string; name: string }[] = [];
        let pesoProduct: { id: string; name: string } | undefined = undefined;
        if (selectedClient) {
          productColumns = allProducts.filter((p) =>
            selectedClient.selectedProducts.includes(p.id)
          );
        } else {
          // If no client selected, show all products found in invoices
          const productIds = new Set<string>();
          filteredInvoices.forEach((inv) => {
            inv.carts?.forEach((cart) => {
              cart.items?.forEach((item) => productIds.add(item.productId));
            });
          });
          productColumns = allProducts.filter((p) => productIds.has(p.id));
        }
        pesoProduct = productColumns.find((prod) =>
          prod.name.toLowerCase().includes("peso")
        );
        return Object.entries(grouped)
          .sort(([idA], [idB]) => {
            const clientA = clients.find((c) => c.id === idA);
            const clientB = clients.find((c) => c.id === idB);
            const nameA = clientA?.name || (grouped[idA][0]?.clientName ?? "");
            const nameB = clientB?.name || (grouped[idB][0]?.clientName ?? "");
            return nameA.localeCompare(nameB);
          })
          .map(([clientId, clientInvoices]) => {
            const client = clients.find((c) => c.id === clientId);
            return (
              <div key={clientId} className="mb-5">
                <h5 style={{ fontWeight: 700, color: "#0ea5e9" }}>
                  {client?.name || clientInvoices[0].clientName}
                </h5>
                <div
                  className="table-responsive"
                  style={{ overflowX: "auto", minWidth: 400, maxHeight: "70vh", overflowY: "auto" }}
                >
                  <table
                    className="table table-bordered table-hover"
                    style={{ minWidth: 700 }}
                  >
                    <thead style={{ position: "sticky", top: 0, zIndex: 10, backgroundColor: "#f8f9fa" }}>
                      <tr style={{ backgroundColor: "#f8f9fa", borderBottom: "2px solid #dee2e6" }}>
                        <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>
                          <input
                            type="checkbox"
                            checked={
                              clientInvoices.length > 0 &&
                              clientInvoices.every(inv => selectedInvoiceIds.includes(inv.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                // Add all client invoices to selection
                                setSelectedInvoiceIds(prev => {
                                  const newIds = [...prev];
                                  clientInvoices.forEach(inv => {
                                    if (!newIds.includes(inv.id)) {
                                      newIds.push(inv.id);
                                    }
                                  });
                                  return newIds;
                                });
                              } else {
                                // Remove only current client's invoices from selection
                                setSelectedInvoiceIds(prev => 
                                  prev.filter(id => !clientInvoices.some(inv => inv.id === id))
                                );
                              }
                            }}
                          />
                        </th>
                        <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Laundry Ticket #</th>
                        <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Date</th>
                        <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Truck #</th>
                        {/* Add Verifier column */}
                        <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Verifier</th>
                        <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Total Weight (lbs)</th>
                        {productColumns.map((prod) => (
                          <th key={prod.id} style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>{prod.name}</th>
                        ))}
                        <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Subtotal (Base)</th>
                        <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Minimum Billing</th>
                        {generalDeliveryCharge && Number(generalDeliveryCharge) > 0 && (
                          <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>General Delivery</th>
                        )}
                        {serviceChargeEnabled && <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Service Charge</th>}
                        {surchargeEnabled && <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Surcharge</th>}
                        <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Total</th>
                        {fuelChargeEnabled && <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>{fuelChargeLabel}</th>}
                        {nudosSabanasPrice && Number(nudosSabanasPrice) > 0 && (
                          <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Nudos (Sabanas)</th>
                        )}
                        {disposableFee && Number(disposableFee) > 0 && (
                          <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Disposable Fee</th>
                        )}
                        {deliveryCharge && Number(deliveryCharge) > 0 && (
                          <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Special Delivery</th>
                        )}
                        <th style={{ backgroundColor: "#f8f9fa", position: "sticky", top: 0, zIndex: 11 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientInvoices
                        .sort((a, b) => {
                          // Primary: invoice date (oldest first)
                          const aTime = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
                          const bTime = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
                          if (aTime !== bTime) return aTime - bTime;
                          
                          // Tie-breaker 1: invoiceNumber (ascending) when present
                          if (typeof a.invoiceNumber === 'number' && typeof b.invoiceNumber === 'number') {
                            if (a.invoiceNumber !== b.invoiceNumber) return a.invoiceNumber - b.invoiceNumber;
                          }
                          
                          // Final fallback: compare IDs
                          return a.id.localeCompare(b.id);
                        })
                        .map((inv) => {
                          // Check if any required product in this invoice has qty > 0 and no price set
                          const missingPrice = productColumns.some((prod) => {
                            // Only check if this product is marked as required for pricing
                            if (!requiredPricingProducts[prod.id]) return false;
                            
                            const qty = (inv.carts || []).reduce(
                              (sum, cart) => {
                                return (
                                  sum +
                                  (cart.items || [])
                                    .filter(
                                      (item) => item.productId === prod.id
                                    )
                                    .reduce(
                                      (s, item) =>
                                        s + (Number(item.quantity) || 0),
                                      0
                                    )
                                );
                              },
                              0
                            );
                            const price = productPrices[prod.id];
                            return qty > 0 && (!price || price <= 0);
                          });
                          // Calculate sabanas quantity for this invoice
                          const sabanasProd = productColumns.find(
                            (p) =>
                              p.name.toLowerCase().includes("sabana") &&
                              !p.name.toLowerCase().includes("nudo")
                          );
                          let sabanasQty = 0;
                          if (sabanasProd) {
                            sabanasQty = (inv.carts || []).reduce(
                              (sum, cart) => {
                                return (
                                  sum +
                                  (cart.items || [])
                                    .filter(
                                      (item) => item.productId === sabanasProd.id
                                    )
                                    .reduce(
                                      (s, item) =>
                                        s + (Number(item.quantity) || 0),
                                      0
                                    )
                                );
                              },
                              0
                            );
                          }
                          
                          // Initialize subtotal variables first
                          let subtotal = 0;
                          let pesoSubtotal = 0;
                          
                          let pesoValue = "";
                          const productCells = productColumns.map((prod) => {
                            if (prod.name.toLowerCase().includes("peso")) {
                              let pesoValue = "";
                              if (
                                pesoProduct &&
                                typeof inv.totalWeight === "number"
                              ) {
                                const pesoPrice = productPrices[pesoProduct.id];
                                if (pesoPrice && pesoPrice > 0) {
                                  pesoValue = `$${(
                                    inv.totalWeight * pesoPrice
                                  ).toFixed(2)}`;
                                  pesoSubtotal = inv.totalWeight * pesoPrice;
                                }
                              }
                              return (
                                <td key={prod.id} style={nowrapCellStyle}>
                                  {pesoValue}
                                </td>
                              );
                            }
                            const qty = (inv.carts || []).reduce(
                              (sum, cart) => {
                                return (
                                  sum +
                                  (cart.items || [])
                                    .filter(
                                      (item) => item.productId === prod.id
                                    )
                                    .reduce(
                                      (s, item) =>
                                        s + (Number(item.quantity) || 0),
                                      0
                                    )
                                );
                              },
                              0
                            );
                            const price = productPrices[prod.id];
                            let cell = null;
                            if (qty > 0 && price > 0) {
                              const total = qty * price;
                              subtotal += total;
                              cell = `${qty} | `;
                              return (
                                <td key={prod.id} style={nowrapCellStyle}>
                                  {qty} |{" "}
                                  <span className="text-success">
                                    ${total.toFixed(2)}
                                  </span>
                                </td>
                              );
                            } else if (qty > 0) {
                              return (
                                <td key={prod.id} style={nowrapCellStyle}>
                                  {qty}
                                </td>
                              );
                            } else {
                              return <td key={prod.id}></td>;
                            }
                            return <td key={prod.id}>{cell}</td>;
                          });
                          // Use minimum billing value if subtotal is less
                          let minValue = minBilling ? Number(minBilling) : 0;
                          let deliveryChargeValue = 0;
                          let generalDeliveryChargeValue = 0;
                          
                          // Only apply delivery charge if special service is requested
                          if (inv.specialServiceRequested) {
                            deliveryChargeValue = calculateCharge(
                              deliveryChargeFormula,
                              Number(deliveryCharge) || 0,
                              subtotal + pesoSubtotal,
                              1,
                              0
                            );
                          }
                          
                          // Apply general delivery charge to all invoices
                          if (generalDeliveryCharge && Number(generalDeliveryCharge) > 0) {
                            generalDeliveryChargeValue = calculateCharge(
                              generalDeliveryChargeFormula,
                              Number(generalDeliveryCharge) || 0,
                              subtotal + pesoSubtotal,
                              1,
                              0
                            );
                          }
                          
                          // Base subtotal (products + peso only - general delivery excluded)
                          let baseSubtotal = subtotal + pesoSubtotal;
                          
                          // Display subtotal (with minimum billing applied if needed, plus special delivery charges only)
                          let displaySubtotal = baseSubtotal + deliveryChargeValue;
                          if (minValue > 0 && (subtotal + pesoSubtotal) < minValue) {
                            displaySubtotal = minValue + deliveryChargeValue;
                          }
                          
                          // Calculate the higher subtotal value for service charge calculation (excludes general delivery)
                          let subtotalForServiceCharge = baseSubtotal;
                          if (minValue > 0 && (subtotal + pesoSubtotal) < minValue) {
                            subtotalForServiceCharge = minValue;
                          }
                          
                          // Calculate charges using formulas
                          let serviceCharge = 0;
                          let fuelCharge = 0;
                          let surchargeValue = 0;
                          let nudosSabanasCharge = 0;
                          let disposableFeeValue = 0;
      
                          if (serviceChargeEnabled && Number(serviceChargePercent) > 0) {
                            serviceCharge = calculateCharge(
                              serviceChargeFormula,
                              Number(serviceChargePercent),
                              subtotalForServiceCharge,
                              1,
                              0
                            );
                          }
                          if (fuelChargeEnabled && Number(fuelChargePercent) > 0) {
                            fuelCharge = calculateCharge(
                              fuelChargeFormula,
                              Number(fuelChargePercent),
                              subtotalForServiceCharge,
                              1,
                              0
                            );
                          }
                          if (surchargeEnabled && Number(surchargePercent) > 0) {
                            surchargeValue = calculateCharge(
                              surchargeFormula,
                              Number(surchargePercent),
                              subtotalForServiceCharge,
                              1,
                              0
                            );
                          }
                          
                          // Calculate Nudos (Sabanas) charge
                          if (nudosSabanasPrice && Number(nudosSabanasPrice) > 0) {
                            const sabanasProd = productColumns.find((p) =>
                              p.name.toLowerCase().includes("sabana") && 
                              !p.name.toLowerCase().includes("nudo")
                            );
                            
                            let sabanasQty = 0;
                            if (sabanasProd) {
                              sabanasQty = (inv.carts || []).reduce((sum, cart) => {
                                return sum + (cart.items || [])
                                  .filter((item) => item.productId === sabanasProd.id)
                                  .reduce((s, item) => s + (Number(item.quantity) || 0), 0);
                              }, 0);
                            }
                            
                            // Calculate Nudos (Sabanas) charge using formula after subtotals are known
                            nudosSabanasCharge = calculateCharge(
                              nudosSabanasFormula,
                              Number(nudosSabanasPrice),
                              subtotal + pesoSubtotal,
                              1,
                              sabanasQty
                            );
                          }
                          
                          // Calculate Disposable Fee
                          if (disposableFee && Number(disposableFee) > 0) {
                            disposableFeeValue = calculateCharge(
                              disposableFeeFormula,
                              Number(disposableFee),
                              subtotal + pesoSubtotal,
                              1,
                              0
                            );
                          }
                          
                          // Calculate grand total: displaySubtotal + surcharge + service + general delivery charge
                          // (excludes fuel, nudos, disposable fee - these appear as separate columns)
                          const grandTotal = displaySubtotal + surchargeValue + serviceCharge + generalDeliveryChargeValue;
                          return (
                            <tr
                              key={inv.id}
                              className={missingPrice ? "table-danger" : ""}
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedInvoiceIds.includes(inv.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedInvoiceIds((prev) => [
                                        ...prev,
                                        inv.id,
                                      ]);
                                    } else {
                                      setSelectedInvoiceIds((prev) =>
                                        prev.filter((id) => id !== inv.id)
                                      );
                                    }
                                  }}
                                />
                              </td>
                              <td>
                                {inv.groupedInvoiceNumber ? (
                                  <span className="text-primary fw-bold">
                                    <i className="bi bi-link me-1"></i>
                                    {inv.groupedInvoiceNumber}
                                  </span>
                                ) : (
                                  inv.invoiceNumber || inv.id
                                )}
                                {inv.locked && (
                                  <i
                                    className="bi bi-lock-fill text-secondary ms-1"
                                    title="Invoice is locked"
                                  ></i>
                                )}
                              </td>
                              <td>
                                {inv.date
                                  ? formatDateOnlySpanish(inv.date)
                                  : "-"}
                              </td>
                              <td>{inv.truckNumber || "-"}</td>
                              {/* Verifier cell */}
                              <td>{inv.verifiedBy || "-"}</td>
                              <td>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.1}
                                  value={
                                    typeof inv.totalWeight === "number"
                                      ? inv.totalWeight
                                      : ""
                                  }
                                  style={{
                                    width: 90,
                                    fontSize: 15,
                                    padding: "2px 6px",
                                    borderRadius: 6,
                                    border: "1px solid #ccc",
                                  }}
                                  onChange={async (e) => {
                                    const newWeight =
                                      e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value);
                                    // Update in Firestore and local state
                                    await updateInvoice(inv.id, {
                                      totalWeight: newWeight,
                                    });
                                    setInvoices((prev) =>
                                      prev.map((i) =>
                                        i.id === inv.id
                                          ? { ...i, totalWeight: newWeight }
                                          : i
                                      )
                                    );
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="-"
                                />
                              </td>
                              {productColumns.map((prod) => {
                                if (prod.name.toLowerCase().includes("peso")) {
                                  return (
                                    <td key={prod.id} style={nowrapCellStyle}>
                                      {pesoValue}
                                    </td>
                                  );
                                }
                                const qty = (inv.carts || []).reduce(
                                  (sum, cart) => {
                                    return (
                                      sum +
                                      (cart.items || [])
                                        .filter(
                                          (item) => item.productId === prod.id
                                        )
                                        .reduce(
                                          (s, item) =>
                                            s + (Number(item.quantity) || 0),
                                          0
                                        )
                                    );
                                  },
                                  0
                                );
                                const price = productPrices[prod.id];
                                let cell = null;
                                if (qty > 0 && price > 0) {
                                  const total = qty * price;
                                  subtotal += total;
                                  cell = `${qty} | `;
                                  return (
                                    <td key={prod.id} style={nowrapCellStyle}>
                                      {qty} |{" "}
                                      <span className="text-success">
                                        ${total.toFixed(2)}
                                      </span>
                                    </td>
                                  );
                                } else if (qty > 0) {
                                  return (
                                    <td key={prod.id} style={nowrapCellStyle}>
                                      {qty}
                                    </td>
                                  );
                                } else {
                                  return <td key={prod.id}></td>;
                                }
                                return <td key={prod.id}>{cell}</td>;
                              })}
                              {/* Base Subtotal (without minimum billing) */}
                              <td style={{
                                ...nowrapCellStyle,
                                backgroundColor: baseSubtotal > displaySubtotal ? '#28a745' : 'transparent',
                                color: baseSubtotal > displaySubtotal ? 'white' : 'inherit',
                                fontWeight: 'bold'
                              }}>
                                <b>
                                  {baseSubtotal > 0
                                    ? `$${baseSubtotal.toFixed(2)}`
                                    : ""}
                                </b>
                              </td>
                              {/* Minimum Billing column - shows only the minimum billing amount */}
                              <td style={{
                                ...nowrapCellStyle,
                                backgroundColor: minValue > 0 && baseSubtotal < minValue ? '#28a745' : 'transparent',
                                color: minValue > 0 && baseSubtotal < minValue ? 'white' : 'inherit',
                                fontWeight: 'bold'
                              }}>
                                <b>
                                  {minValue > 0 && baseSubtotal < minValue
                                    ? `$${minValue.toFixed(2)}`
                                    : ""}
                                </b>
                              </td>
                              {/* General Delivery */}
                              {generalDeliveryCharge && Number(generalDeliveryCharge) > 0 && (
                                <td style={nowrapCellStyle}>
                                  <b>
                                    {generalDeliveryChargeValue > 0
                                      ? `$${generalDeliveryChargeValue.toFixed(2)}`
                                      : ""}
                                  </b>
                                </td>
                              )}
                              {serviceChargeEnabled && (
                                <td style={nowrapCellStyle}>
                                  <b>
                                    {serviceCharge > 0
                                      ? `$${serviceCharge.toFixed(2)}`
                                      : ""}
                                  </b>
                                </td>
                              )}
                              {surchargeEnabled && (
                                <td style={nowrapCellStyle}>
                                  <b>
                                    {surchargeValue > 0
                                      ? `$${surchargeValue.toFixed(2)}`
                                      : ""}
                                  </b>
                                </td>
                              )}
                              <td style={nowrapCellStyle}>
                                <b>
                                  {grandTotal > 0
                                    ? `$${grandTotal.toFixed(2)}`
                                    : ""}
                                </b>
                              </td>
                              {fuelChargeEnabled && (
                                <td style={nowrapCellStyle}>
                                  <b>
                                    {fuelCharge > 0
                                      ? `$${fuelCharge.toFixed(2)}`
                                      : ""}
                                  </b>
                                </td>
                              )}
                              {nudosSabanasPrice && Number(nudosSabanasPrice) > 0 && (
                                <td style={nowrapCellStyle}>
                                  <b>
                                    {nudosSabanasCharge > 0
                                      ? `$${nudosSabanasCharge.toFixed(2)}`
                                      : ""}
                                  </b>
                                </td>
                              )}
                              {disposableFee && Number(disposableFee) > 0 && (
                                <td style={nowrapCellStyle}>
                                  <b>
                                    {disposableFeeValue > 0
                                      ? `$${disposableFeeValue.toFixed(2)}`
                                      : ""}
                                  </b>
                                </td>
                              )}
                              {deliveryCharge && Number(deliveryCharge) > 0 && (
                                <td style={nowrapCellStyle}>
                                  <b>
                                    {deliveryChargeValue > 0
                                      ? `$${deliveryChargeValue.toFixed(2)}`
                                      : ""}
                                  </b>
                                </td>
                              )}
                              <td>
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => handleEditInvoice(inv)}
                                  disabled={inv.locked}
                                  title={
                                    inv.locked
                                      ? "Invoice is locked and cannot be edited"
                                      : "Edit invoice"
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-secondary ms-2"
                                  onClick={() => setInvoiceToPrint(inv)}
                                >
                                  Print
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-danger ms-2"
                                  onClick={() => handleDeleteInvoice(inv)}
                                  disabled={inv.locked}
                                  title={
                                    inv.locked
                                      ? "Invoice is locked and cannot be deleted"
                                      : "Delete invoice"
                                  }
                                >
                                  Delete
                                </button>
                                {inv.locked && (
                                  <div className="mt-1 small text-muted">
                                    Locked by: {inv.lockedBy || "System"}
                                    <br />
                                    {inv.lockedAt &&
                                      new Date(inv.lockedAt).toLocaleString()}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot style={{ position: "sticky", bottom: 0, zIndex: 10, backgroundColor: "#f1f5f9" }}>
                      <tr style={{ fontWeight: 700, background: "#f1f5f9", borderTop: "2px solid #dee2e6" }}>
                        <td colSpan={5}>Total (Selected)</td>
                        {/* Only sum selected invoices */}
                        <td>
                          {clientInvoices
                            .filter((inv) =>
                              selectedInvoiceIds.includes(inv.id)
                            )
                            .reduce(
                              (sum, inv) =>
                                typeof inv.totalWeight === "number"
                                  ? sum + inv.totalWeight
                                  : sum,
                              0
                            )}
                        </td>
                        {/* Product columns totals */}
                        {productColumns.map((prod) => {
                          if (prod.name.toLowerCase().includes("peso")) {
                            // Peso column: sum total $ for all invoices
                            const pesoPrice = productPrices[prod.id];
                            const total = clientInvoices
                              .filter((inv) =>
                                selectedInvoiceIds.includes(inv.id)
                              )
                              .reduce((sum, inv) => {
                                if (
                                  typeof inv.totalWeight === "number" &&
                                  pesoPrice > 0
                                ) {
                                  return sum + inv.totalWeight * pesoPrice;
                                }
                                return sum;
                              }, 0);
                            return (
                              <td key={prod.id} style={nowrapCellStyle}>
                                {pesoPrice > 0 ? `$${total.toFixed(2)}` : ""}
                              </td>
                            );
                          }
                          // Sum qty and $ for this product
                          let totalQty = 0;
                          let totalValue = 0;
                          clientInvoices
                            .filter((inv) =>
                              selectedInvoiceIds.includes(inv.id)
                            )
                            .forEach((inv) => {
                              const qty = (inv.carts || []).reduce(
                                (sum, cart) => {
                                  return (
                                    sum +
                                    (cart.items || [])
                                      .filter(
                                        (item) => item.productId === prod.id
                                      )
                                      .reduce(
                                        (s, item) =>
                                          s + (Number(item.quantity) || 0),
                                        0
                                      )
                                  );
                                },
                                0
                              );
                              const price = productPrices[prod.id];
                              totalQty += qty;
                              if (qty > 0 && price > 0)
                                totalValue += qty * price;
                            });
                          return (
                            <td key={prod.id} style={nowrapCellStyle}>
                              {totalQty > 0 ? `${totalQty} | ` : ""}
                              {totalValue > 0 ? (
                                <span className="text-success">
                                  $${totalValue.toFixed(2)}
                                </span>
                              ) : (
                                ""
                              )}
                            </td>
                          );
                        })}
                        {/* Base Subtotal total (without minimum billing) */}
                        <td style={nowrapCellStyle}>
                          {(() => {
                            let baseTotal = 0;
                            let minTotal = 0;
                            
                            // Calculate both totals
                            clientInvoices
                              .filter((inv) =>
                                selectedInvoiceIds.includes(inv.id)
                              )
                              .forEach((inv) => {
                                let subtotal = 0;
                                let pesoSubtotal = 0;
                                productColumns.forEach((prod) => {
                                  if (
                                    prod.name.toLowerCase().includes("peso")
                                  ) {
                                    const pesoPrice = productPrices[prod.id];
                                    if (
                                      typeof inv.totalWeight === "number" &&
                                      pesoPrice > 0
                                    ) {
                                      pesoSubtotal +=
                                        inv.totalWeight * pesoPrice;
                                    }
                                  } else {
                                    const qty = (inv.carts || []).reduce(
                                      (sum, cart) => {
                                        return (
                                          sum +
                                          (cart.items || [])
                                            .filter(
                                              (item) =>
                                                item.productId === prod.id
                                            )
                                            .reduce(
                                              (s, item) =>
                                                s +
                                                (Number(item.quantity) || 0),
                                              0
                                            )
                                        );
                                      },
                                      0
                                    );
                                    const price = productPrices[prod.id];
                                    if (qty > 0 && price > 0)
                                      subtotal += qty * price;
                                  }
                                });
                                let deliveryChargeValue = 0;
                                
                                // Only apply delivery charge if special service is requested
                                if (inv.specialServiceRequested) {
                                  deliveryChargeValue = calculateCharge(
                                    deliveryChargeFormula,
                                    Number(deliveryCharge) || 0,
                                    subtotal + pesoSubtotal,
                                    1,
                                    0
                                  );
                                }
                                
                                // Apply general delivery charge to all invoices
                                let generalDeliveryChargeValue = 0;
                                if (generalDeliveryCharge && Number(generalDeliveryCharge) > 0) {
                                  generalDeliveryChargeValue = calculateCharge(
                                    generalDeliveryChargeFormula,
                                    Number(generalDeliveryCharge) || 0,
                                    subtotal + pesoSubtotal,
                                    1,
                                    0
                                  );
                                }
                                
                                let baseSubtotal = subtotal + pesoSubtotal + generalDeliveryChargeValue;
                                baseTotal += baseSubtotal;
                                
                                // Calculate with minimum billing
                                let minValue = minBilling ? Number(minBilling) : 0;
                                let displaySubtotal = subtotal + pesoSubtotal + generalDeliveryChargeValue + deliveryChargeValue;
                                if (minValue > 0 && (subtotal + pesoSubtotal) < minValue) {
                                  displaySubtotal = minValue + generalDeliveryChargeValue + deliveryChargeValue;
                                }
                                minTotal += displaySubtotal;
                              });
                              
                            return (
                              <span style={{
                                backgroundColor: baseTotal > minTotal ? '#28a745' : 'transparent',
                                color: baseTotal > minTotal ? 'white' : 'inherit',
                                fontWeight: 'bold',
                                padding: '2px 4px',
                                borderRadius: '3px'
                              }}>
                                {baseTotal > 0 ? `$${baseTotal.toFixed(2)}` : ""}
                              </span>
                            );
                          })()}
                        </td>
                        {/* Minimum Billing total */}
                        <td style={nowrapCellStyle}>
                          {(() => {
                            let minimumBillingTotal = 0;
                            
                            // Calculate minimum billing total
                            clientInvoices
                              .filter((inv) =>
                                selectedInvoiceIds.includes(inv.id)
                              )
                              .forEach((inv) => {
                                let subtotal = 0;
                                let pesoSubtotal = 0;
                                productColumns.forEach((prod) => {
                                  if (
                                    prod.name.toLowerCase().includes("peso")
                                  ) {
                                    const pesoPrice = productPrices[prod.id];
                                    if (
                                      typeof inv.totalWeight === "number" &&
                                      pesoPrice > 0
                                    ) {
                                      pesoSubtotal +=
                                        inv.totalWeight * pesoPrice;
                                    }
                                  } else {
                                    const qty = (inv.carts || []).reduce(
                                      (sum, cart) => {
                                        return (
                                          sum +
                                          (cart.items || [])
                                            .filter(
                                              (item) =>
                                                item.productId === prod.id
                                            )
                                            .reduce(
                                              (s, item) =>
                                                s +
                                                (Number(item.quantity) || 0),
                                              0
                                            )
                                        );
                                      },
                                      0
                                    );
                                    const price = productPrices[prod.id];
                                    if (qty > 0 && price > 0)
                                      subtotal += qty * price;
                                  }
                                });
                                let baseSubtotal = subtotal + pesoSubtotal;
                                
                                // Add minimum billing amount if applicable
                                let minValue = minBilling ? Number(minBilling) : 0;
                                if (minValue > 0 && baseSubtotal < minValue) {
                                  minimumBillingTotal += minValue;
                                }
                              });
                              
                            return (
                              <span style={{
                                backgroundColor: minimumBillingTotal > 0 ? '#28a745' : 'transparent',
                                color: minimumBillingTotal > 0 ? 'white' : 'inherit',
                                fontWeight: 'bold',
                                padding: '2px 4px',
                                borderRadius: '3px'
                              }}>
                                {minimumBillingTotal > 0 ? `$${minimumBillingTotal.toFixed(2)}` : ""}
                              </span>
                            );
                          })()}
                        </td>
                        {/* General Delivery total */}
                        {generalDeliveryCharge && Number(generalDeliveryCharge) > 0 && (
                          <td style={nowrapCellStyle}>
                            {(() => {
                              let total = 0;
                              clientInvoices
                                .filter((inv) =>
                                  selectedInvoiceIds.includes(inv.id)
                                )
                                .forEach((inv) => {
                                  let subtotal = 0;
                                  let pesoSubtotal = 0;
                                  productColumns.forEach((prod) => {
                                    if (prod.name.toLowerCase().includes("peso")) {
                                      const pesoPrice = productPrices[prod.id];
                                      if (typeof inv.totalWeight === "number" && pesoPrice > 0) {
                                        pesoSubtotal += inv.totalWeight * pesoPrice;
                                      }
                                    } else {
                                      const qty = (inv.carts || []).reduce((sum, cart) => {
                                        return sum + (cart.items || [])
                                          .filter((item) => item.productId === prod.id)
                                          .reduce((s, item) => s + (Number(item.quantity) || 0), 0);
                                      }, 0);
                                      const price = productPrices[prod.id];
                                      if (qty > 0 && price > 0) subtotal += qty * price;
                                    }
                                  });
                                  
                                  total += calculateCharge(
                                    generalDeliveryChargeFormula,
                                    Number(generalDeliveryCharge),
                                    subtotal + pesoSubtotal,
                                    1,
                                    0
                                  );
                                });
                              return total > 0 ? `$${total.toFixed(2)}` : "";
                            })()}
                          </td>
                        )}
                        {/* Service Charge total */}
                        {serviceChargeEnabled && (
                          <td style={nowrapCellStyle}>
                            {(() => {
                              let total = 0;
                              clientInvoices
                                .filter((inv) =>
                                  selectedInvoiceIds.includes(inv.id)
                                )
                                .forEach((inv) => {
                                  let subtotal = 0;
                                  let pesoSubtotal = 0;
                                  productColumns.forEach((prod) => {
                                    if (
                                      prod.name.toLowerCase().includes("peso")
                                    ) {
                                      const pesoPrice = productPrices[prod.id];
                                      if (
                                        typeof inv.totalWeight === "number" &&
                                        pesoPrice > 0
                                      ) {
                                        pesoSubtotal +=
                                          inv.totalWeight * pesoPrice;
                                      }
                                    } else {
                                      const qty = (inv.carts || []).reduce(
                                        (sum, cart) => {
                                          return (
                                            sum +
                                            (cart.items || [])
                                              .filter(
                                                (item) =>
                                                  item.productId === prod.id
                                              )
                                              .reduce(
                                                (s, item) =>
                                                  s +
                                                  (Number(item.quantity) || 0),
                                                0
                                              )
                                          );
                                        },
                                        0
                                      );
                                      const price = productPrices[prod.id];
                                      if (qty > 0 && price > 0)
                                        subtotal += qty * price;
                                    }
                                  });
                                  // Calculate the higher subtotal value for service charge calculation (without delivery charge)
                                  let baseSubtotal = subtotal + pesoSubtotal;
                                  let subtotalForServiceCharge = baseSubtotal;
                                  let minValue = minBilling ? Number(minBilling) : 0;
                                  if (minValue > 0 && baseSubtotal < minValue) {
                                    subtotalForServiceCharge = minValue;
                                  }
                                  if (serviceChargeEnabled && Number(serviceChargePercent) > 0) {
                                    total += calculateCharge(
                                      serviceChargeFormula,
                                      Number(serviceChargePercent),
                                      subtotalForServiceCharge,
                                      1,
                                      0
                                    );
                                  }
                                });
                              return total > 0 ? `$${total.toFixed(2)}` : "";
                            })()}
                          </td>
                        )}
                        {/* Fuel Charge total */}
                        {fuelChargeEnabled && (
                          <td style={nowrapCellStyle}>
                            {(() => {
                              let total = 0;
                              clientInvoices
                                .filter((inv) =>
                                  selectedInvoiceIds.includes(inv.id)
                                )
                                .forEach((inv) => {
                                  let subtotal = 0;
                                  let pesoSubtotal = 0;
                                  productColumns.forEach((prod) => {
                                    if (
                                      prod.name.toLowerCase().includes("peso")
                                    ) {
                                      const pesoPrice = productPrices[prod.id];
                                      if (
                                        typeof inv.totalWeight === "number" &&
                                        pesoPrice > 0
                                      ) {
                                        pesoSubtotal +=
                                          inv.totalWeight * pesoPrice;
                                      }
                                    } else {
                                      const qty = (inv.carts || []).reduce(
                                        (sum, cart) => {
                                          return (
                                            sum +
                                            (cart.items || [])
                                              .filter(
                                                (item) =>
                                                  item.productId === prod.id
                                              )
                                              .reduce(
                                                (s, item) =>
                                                  s +
                                                  (Number(item.quantity) || 0),
                                                0
                                              )
                                          );
                                        },
                                        0
                                      );
                                      const price = productPrices[prod.id];
                                      if (qty > 0 && price > 0)
                                        subtotal += qty * price;
                                    }
                                  });
                                  // Calculate the higher subtotal value for fuel charge calculation (without delivery charge)
                                  let baseSubtotal = subtotal + pesoSubtotal;
                                  let subtotalForServiceCharge = baseSubtotal;
                                  let minValue = minBilling ? Number(minBilling) : 0;
                                  if (minValue > 0 && baseSubtotal < minValue) {
                                    subtotalForServiceCharge = minValue;
                                  }
                                  if (fuelChargeEnabled && Number(fuelChargePercent) > 0) {
                                    total += calculateCharge(
                                      fuelChargeFormula,
                                      Number(fuelChargePercent),
                                      subtotalForServiceCharge,
                                      1,
                                      0
                                    );
                                  }
                                });
                              return total > 0 ? `$${total.toFixed(2)}` : "";
                            })()}
                          </td>
                        )}
                        {/* Surcharge total */}
                        {surchargeEnabled && (
                          <td style={nowrapCellStyle}>
                            {(() => {
                              let total = 0;
                              clientInvoices
                                .filter((inv) =>
                                  selectedInvoiceIds.includes(inv.id)
                                )
                                .forEach((inv) => {
                                  let subtotal = 0;
                                  let pesoSubtotal = 0;
                                  productColumns.forEach((prod) => {
                                    if (
                                      prod.name.toLowerCase().includes("peso")
                                    ) {
                                      const pesoPrice = productPrices[prod.id];
                                      if (
                                        typeof inv.totalWeight === "number" &&
                                        pesoPrice > 0
                                      ) {
                                        pesoSubtotal +=
                                          inv.totalWeight * pesoPrice;
                                      }
                                    } else {
                                      const qty = (inv.carts || []).reduce(
                                        (sum, cart) => {
                                          return (
                                            sum +
                                            (cart.items || [])
                                              .filter(
                                                (item) =>
                                                  item.productId === prod.id
                                              )
                                              .reduce(
                                                (s, item) =>
                                                  s +
                                                  (Number(item.quantity) || 0),
                                                0
                                              )
                                          );
                                        },
                                        0
                                      );
                                      const price = productPrices[prod.id];
                                      if (qty > 0 && price > 0)
                                        subtotal += qty * price;
                                    }
                                  });
                                  if (surchargeEnabled && Number(surchargePercent) > 0) {
                                    // Calculate the higher subtotal value for surcharge calculation (without delivery charge)
                                    let baseSubtotal = subtotal + pesoSubtotal;
                                    let subtotalForSurcharge = baseSubtotal;
                                    let minValue = minBilling ? Number(minBilling) : 0;
                                    if (minValue > 0 && baseSubtotal < minValue) {
                                      subtotalForSurcharge = minValue;
                                    }
                                    total += calculateCharge(
                                      surchargeFormula,
                                      Number(surchargePercent),
                                      subtotalForSurcharge,
                                      1,
                                      0
                                    );
                                  }
                                });
                              return total > 0 ? `$${total.toFixed(2)}` : "";
                            })()}
                          </td>
                        )}
                        {/* Nudos (Sabanas) total */}
                        {nudosSabanasPrice && Number(nudosSabanasPrice) > 0 && (
                          <td style={nowrapCellStyle}>
                            {(() => {
                              let total = 0;
                              const sabanasProd = productColumns.find(
                                (p) =>
                                  p.name.toLowerCase().includes("sabana") &&
                                  !p.name.toLowerCase().includes("nudo")
                              );
                              clientInvoices
                                .filter((inv) =>
                                  selectedInvoiceIds.includes(inv.id)
                                )
                                .forEach((inv) => {
                                  let sabanasQty = 0;
                                  if (sabanasProd) {
                                    sabanasQty = (inv.carts || []).reduce(
                                      (sum, cart) => {
                                        return (
                                          sum +
                                          (cart.items || [])
                                            .filter(
                                              (item) =>
                                                item.productId ===
                                                sabanasProd.id
                                            )
                                            .reduce(
                                              (s, item) =>
                                                s +
                                                (Number(item.quantity) || 0),
                                              0
                                            )
                                      );
                                    },
                                    0
                                  );
                                  }
                                  if (sabanasQty > 0 && Number(nudosSabanasPrice) > 0) {
                                    // Get subtotal for percentage-based calculations
                                    let subtotal = 0;
                                    let pesoSubtotal = 0;
                                    productColumns.forEach((prod) => {
                                      if (prod.name.toLowerCase().includes("peso")) {
                                        const pesoPrice = productPrices[prod.id];
                                        if (typeof inv.totalWeight === "number" && pesoPrice > 0) {
                                          pesoSubtotal += inv.totalWeight * pesoPrice;
                                        }
                                      } else {
                                        const qty = (inv.carts || []).reduce((sum, cart) => {
                                          return sum + (cart.items || [])
                                            .filter((item) => item.productId === prod.id)
                                            .reduce((s, item) => s + (Number(item.quantity) || 0), 0);
                                        }, 0);
                                        const price = productPrices[prod.id];
                                        if (qty > 0 && price > 0) subtotal += qty * price;
                                      }
                                    });
                                    
                                    total += calculateCharge(
                                      nudosSabanasFormula,
                                      Number(nudosSabanasPrice),
                                      subtotal + pesoSubtotal,
                                      1,
                                      sabanasQty
                                    );
                                  }
                                });
                              return total > 0 ? `$${total.toFixed(2)}` : "";
                            })()}
                          </td>
                        )}
                        {/* Disposable Fee total */}
                        {disposableFee && Number(disposableFee) > 0 && (
                          <td style={nowrapCellStyle}>
                            {(() => {
                              let total = 0;
                              clientInvoices
                                .filter((inv) =>
                                  selectedInvoiceIds.includes(inv.id)
                                )
                                .forEach((inv) => {
                                  let subtotal = 0;
                                  let pesoSubtotal = 0;
                                  productColumns.forEach((prod) => {
                                    if (prod.name.toLowerCase().includes("peso")) {
                                      const pesoPrice = productPrices[prod.id];
                                      if (typeof inv.totalWeight === "number" && pesoPrice > 0) {
                                        pesoSubtotal += inv.totalWeight * pesoPrice;
                                      }
                                    } else {
                                      const qty = (inv.carts || []).reduce((sum, cart) => {
                                        return sum + (cart.items || [])
                                          .filter((item) => item.productId === prod.id)
                                          .reduce((s, item) => s + (Number(item.quantity) || 0), 0);
                                      }, 0);
                                      const price = productPrices[prod.id];
                                      if (qty > 0 && price > 0) subtotal += qty * price;
                                    }
                                  });
                                  
                                  total += calculateCharge(
                                    disposableFeeFormula,
                                    Number(disposableFee),
                                    subtotal + pesoSubtotal,
                                    1,
                                    0
                                  );
                                });
                              return total > 0 ? `$${total.toFixed(2)}` : "";
                            })()}
                          </td>
                        )}
                        {/* Special Delivery total */}
                        {deliveryCharge && Number(deliveryCharge) > 0 && (
                          <td style={nowrapCellStyle}>
                            {(() => {
                              // Only count invoices with special service requested
                              const specialServiceInvoicesCount = clientInvoices.filter((inv) =>
                                selectedInvoiceIds.includes(inv.id) && inv.specialServiceRequested
                              ).length;
                              const totalDeliveryCharge = calculateCharge(
                                deliveryChargeFormula,
                                Number(deliveryCharge) || 0,
                                0, // Subtotal not needed for most delivery charge calculations
                                specialServiceInvoicesCount,
                                0
                              );
                              return totalDeliveryCharge > 0 ? `$${totalDeliveryCharge.toFixed(2)}` : "";
                            })()}
                          </td>
                        )}
                        {/* Actions column: empty */}
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          });
      })()}
      {/* Group Invoices Modal */}
      {showGroupInvoicesModal && (
        <div
          className="modal d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Group Selected Laundry Tickets</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowGroupInvoicesModal(false)}
                  disabled={isProcessingGroup}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body">
                <p>
                  You are about to group {selectedInvoiceIds.length} invoices
                  together. Once grouped, these invoices will be locked and
                  cannot be edited separately.
                </p>

                <div className="mb-3">
                  <label htmlFor="groupInvoiceNumber" className="form-label">
                    Enter Invoice Number
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="groupInvoiceNumber"
                    value={newGroupInvoiceNumber}
                    onChange={(e) => setNewGroupInvoiceNumber(e.target.value)}
                    placeholder="Enter a custom invoice number"
                    required
                  />
                  <div className="form-text">
                    This will be used as the main invoice number for all grouped
                    invoices.
                  </div>
                </div>

                <div className="mt-3">
                  <h6>Selected Laundry Tickets:</h6>
                  <ul className="list-group">
                    {invoices
                      .filter((inv) => selectedInvoiceIds.includes(inv.id))
                      .map((inv) => (
                        <li
                          key={inv.id}
                          className="list-group-item d-flex justify-content-between align-items-center"
                        >
                          <div>
                            <span className="fw-bold">
                              Invoice #{inv.invoiceNumber || inv.id}
                            </span>
                            <span className="ms-2 text-muted">
                              (
                              {inv.date
                                ? formatDateOnlySpanish(inv.date)
                                : "No date"}
                              )
                            </span>
                          </div>
                          <span className="badge bg-primary rounded-pill">
                            {inv.clientName}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowGroupInvoicesModal(false)}
                  disabled={isProcessingGroup}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary d-flex align-items-center"
                  onClick={groupAndLockInvoices}
                  disabled={isProcessingGroup || !newGroupInvoiceNumber.trim()}
                >
                  {isProcessingGroup ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-object-ungroup me-1"></i> Group
                      Laundry Tickets
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Modal - for editing invoices */}
      {showInvoiceDetailsModal && selectedInvoice && (
        <InvoiceDetailsModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowInvoiceDetailsModal(false);
            setSelectedInvoice(null);
            refreshInvoices();
          }}
          client={clients.find((c) => c.id === selectedInvoice.clientId)}
          products={allProducts}
          onAddCart={async (name) => {
            // Placeholder function as it's not needed in this context
            return { id: Date.now().toString(), name, isActive: true };
          }}
          onAddProductToCart={(cartId, productId, quantity) => {
            // Placeholder function as it's not needed in this context
          }}
          onUpdateInvoice={updateInvoice}
          refreshInvoices={refreshInvoices}
        />
      )}

      {/* Print Invoice Modal */}
      {invoiceToPrint && (
        <div
          className="modal show"
          style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
        >
          <div className="modal-dialog" style={{ maxWidth: 700 }}>
            <div className="modal-content">
              <div className="modal-header d-print-none">
                <h5 className="modal-title">
                  Imprimir Boleta de Lavandería #{invoiceToPrint.invoiceNumber}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setInvoiceToPrint(null)}
                ></button>
              </div>
              <div className="modal-body" id="print-area">
                <div
                  style={{
                    width: "8.5in",
                    height: "5.5in",
                    margin: "0 auto",
                    background: "#fff",
                    border: "2px solid #222",
                    padding: 32,
                    fontFamily: "Inter, Segoe UI, Arial, sans-serif",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <img
                      src={"/images/King Uniforms Logo.png"}
                      alt="King Uniforms Logo"
                      style={{ 
                        width: 200, 
                        height: "auto", 
                        marginBottom: 8,
                        maxWidth: 200,
                        maxHeight: 80,
                        objectFit: 'contain'
                      }}
                    />
                    <div style={{ textAlign: "right" }}>
                      <div
                        style={{ fontWeight: 800, fontSize: 32, color: "#111" }}
                      >
                        Invoice #
                      </div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 22,
                          color: "#0E62A0",
                        }}
                      >
                        {invoiceToPrint.invoiceNumber}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, marginBottom: 18 }}>
                    <div
                      style={{ fontWeight: 800, fontSize: 36, color: "#111" }}
                    >
                      Servicios de Lavandería
                    </div>
                  </div>
                  <div style={{ fontSize: 22, marginBottom: 18 }}>
                    <span style={{ fontWeight: 700 }}>Nombre: </span>
                    <span style={{ color: "#0E62A0", fontWeight: 700 }}>
                      {invoiceToPrint.clientName}
                    </span>
                    <br />
                    <span style={{ fontWeight: 700 }}>Fecha: </span>
                    <span style={{ color: "#0E62A0", fontWeight: 700 }}>
                      {invoiceToPrint.date
                        ? formatDateOnlySpanish(invoiceToPrint.date)
                        : "-"}
                    </span>
                    {/* Show verification status and verifier if present */}
                    {(invoiceToPrint.verified ||
                      invoiceToPrint.partiallyVerified) && (
                      <div style={{ marginTop: 8 }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: invoiceToPrint.verified
                              ? "#22c55e"
                              : "#fbbf24",
                          }}
                        >
                          {invoiceToPrint.verified
                            ? "Fully Verified"
                            : "Partially Verified"}
                        </span>
                        {invoiceToPrint.verifiedBy && (
                          <span
                            style={{
                              marginLeft: 12,
                              color: "#888",
                              fontWeight: 500,
                            }}
                          >
                            Verifier: {invoiceToPrint.verifiedBy}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <div style={{ maxHeight: "4.5in", overflowY: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          fontSize: 14,
                          fontWeight: 700,
                          borderCollapse: "collapse",
                          tableLayout: "fixed",
                          wordBreak: "break-word",
                        }}
                      >
                        <thead>
                          <tr>
                            <th
                              style={{
                                textAlign: "left",
                                paddingBottom: 4,
                                width: "70%",
                              }}
                            >
                              Producto
                            </th>
                            <th
                              style={{
                                textAlign: "right",
                                paddingBottom: 4,
                                width: "30%",
                              }}
                            >
                              Qty
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Group items by product name and sum quantities
                            const productMap: Record<string, number> = {};
                            invoiceToPrint.carts.forEach((cart) => {
                              cart.items.forEach((item) => {
                                if (!productMap[item.productName]) {
                                  productMap[item.productName] = 0;
                                }
                                productMap[item.productName] +=
                                  Number(item.quantity) || 0;
                              });
                            });
                            // --- BEGIN: NUDOS-SABANAS LOGIC (PRINT MODAL) ---
                            // Find sabanas and nudos (sabanas) keys
                            const sabanasKey = Object.keys(productMap).find(
                              (name) =>
                                name.toLowerCase().includes("sabana") &&
                                !name.toLowerCase().includes("nudo")
                            );
                            const nudosKey = Object.keys(productMap).find(
                              (name) =>
                                name.toLowerCase().includes("nudo") &&
                                name.toLowerCase().includes("sabana")
                            );
                            if (sabanasKey) {
                              // Always show Nudos (Sabanas) row with same qty as Sabanas
                              const nudosRowName =
                                nudosKey || "Nudos (Sabanas)";
                              productMap[nudosRowName] = productMap[sabanasKey];
                            }
                            // --- END: NUDOS-SABANAS LOGIC (PRINT MODAL) ---
                            const productRows = Object.entries(productMap)
                              .sort((a, b) => a[0].localeCompare(b[0]))
                              .map(([name, qty], idx) => {
                                const lower = name.toLowerCase();
                                return (
                                  <tr key={name + idx}>
                                    <td
                                      style={{
                                        fontWeight: 700,
                                        color: "#111",
                                        padding: "1px 0",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "normal",
                                        maxWidth: 0,
                                        fontSize: 13,
                                      }}
                                    >
                                      {name}
                                    </td>
                                    <td
                                      style={{
                                        fontWeight: 700,
                                        color: "#111",
                                        textAlign: "right",
                                        padding: "1px 0",
                                        fontSize: 13,
                                      }}
                                    >
                                      {Number(qty)}
                                    </td>
                                  </tr>
                                );
                              });
                            if (productRows.length === 0) {
                              return (
                                <tr>
                                  <td
                                    colSpan={2}
                                    style={{
                                      textAlign: "center",
                                      color: "#888",
                                      fontWeight: 400,
                                    }}
                                  >
                                    No hay productos
                                  </td>
                                </tr>
                              );
                            }
                            return productRows;
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer d-print-none">
                <button
                  className="btn btn-secondary"
                  onClick={() => setInvoiceToPrint(null)}
                >
                  Cerrar
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const printContents =
                      document.getElementById("print-area")?.innerHTML;
                    if (printContents) {
                      const logoUrl =
                        window.location.origin +
                        "/images/King Uniforms Logo.png";
                      const patched = printContents.replace(
                        /<img[^>]+src=["'][^"']*King Uniforms Logo.png["'][^>]*>/,
                        `<img src='${logoUrl}' alt='King Uniforms Logo' style='width:120px;height:auto;margin-bottom:8px;' />`
                      );
                      // Open the print window first to avoid pop-up blockers
                      const printWindow = window.open(
                        "",
                        "",
                        "height=800,width=600"
                      );
                      if (!printWindow) return;
                      // Write after a short delay to ensure window is ready
                      setTimeout(() => {
                        printWindow.document.write(`
                        <html>
                          <head>
                            <title>Print Laundry Ticket</title>
                            <style>
                              @media print {
                                @page { size: 5.5in 8.5in portrait; margin: 0; }
                                body { margin: 0; }
                                .modal-footer, .d-print-none { display: none !important; }
                                table { font-size: 12px !important; }
                                td, th { word-break: break-word; white-space: normal !important; padding: 1px 0 !important; }
                                .product-table-scroll { max-height: 4.5in !important; overflow-y: auto !important; }
                              }
                              body { background: #fff; }
                              table { font-size: 13px; }
                              td, th { word-break: break-word; white-space: normal; padding: 1px 0; }
                            </style>
                          </head>
                          <body>${patched}</body>
                        </html>
                      `);
                        printWindow.document.close();
                        printWindow.focus();
                        printWindow.print();
                        printWindow.close();
                      }, 100);
                    }
                  }}
                >
                  Imprimir
                </button>
                <div
                  className="d-flex flex-column align-items-end"
                  style={{ flex: 1 }}
                >
                  <div className="input-group mb-1" style={{ maxWidth: 320 }}>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="Recipient email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                    />
                    <button
                      className="btn btn-outline-primary"
                      onClick={sendInvoiceByEmail}
                    >
                      Send PDF by Email
                    </button>
                  </div>
                  {emailStatus && (
                    <div
                      className="text-end"
                      style={{
                        color: emailStatus.includes("success")
                          ? "green"
                          : "red",
                        fontSize: 14,
                      }}
                    >
                      {emailStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;


