/**
 * Email Configuration Component
 *
 * This component manages email settings for clients. It has been simplified to focus only on email
 * functionality without PDF attachments. Emails will include either:
 * 1. Total pounds processed (for clients billed by weight)
 * 2. Itemized breakdown of pieces processed (for clients billed by piece)
 */
import React, { useState, useEffect } from "react";
import { Client, PrintConfiguration } from "../types";
import {
  getClients,
  updateClient,
  logActivity,
} from "../services/firebaseService";
import {
  validateEmailSettings,
  sendTestEmail as sendTestEmailService,
} from "../services/emailService";
import LaundryTicketPreview from "./LaundryTicketPreview";
import LaundryTicketFieldsModal from "./LaundryTicketFieldsModal";
import "./LaundryTicketPreview.css";

interface PrintingSettingsProps {}

const PrintingSettings: React.FC<PrintingSettingsProps> = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showEmailConfigModal, setShowEmailConfigModal] = useState(false);
  const [showLaundryTicketPreview, setShowLaundryTicketPreview] =
    useState(false);
  const [showFieldsModal, setShowFieldsModal] = useState(false);
  const [fieldsModalClient, setFieldsModalClient] = useState<Client | null>(null);
  const [fieldsModalConfig, setFieldsModalConfig] = useState<PrintConfiguration["invoicePrintSettings"] | null>(null);

  // Email testing and preview states
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreviewClient, setEmailPreviewClient] = useState<Client | null>(
    null
  );
  const [testingEmail, setTestingEmail] = useState<string | null>(null);
  const [emailTestResults, setEmailTestResults] = useState<{
    [clientId: string]: { success: boolean; message: string; timestamp: Date };
  }>({});

  // Notification system
  const [notification, setNotification] = useState<{
    show: boolean;
    type: "success" | "error" | "info";
    message: string;
    timeout?: NodeJS.Timeout;
  }>({
    show: false,
    type: "info",
    message: "",
  });

  // Default print configuration template - focusing only on email settings
  const [defaultPrintConfig, setDefaultPrintConfig] =
    useState<PrintConfiguration>({
      cartPrintSettings: {
        enabled: false,
        showProductDetails: false,
        showQuantities: false,
        showPrices: false,
        showCartTotal: false,
        includeTimestamp: false,
        headerText: "",
        footerText: "",
      },
      invoicePrintSettings: {
        enabled: false,
        showClientInfo: false,
        showInvoiceNumber: false,
        showDate: false,
        showPickupDate: false,
        showCartBreakdown: false,
        showProductSummary: false,
        showTotalWeight: false,
        showSubtotal: false,
        showTaxes: false,
        showGrandTotal: false,
        includeSignature: false,
        headerText: "",
        footerText: "",
        logoUrl: "",
      },
      emailSettings: {
        enabled: false,
        autoSendOnApproval: false,
        autoSendOnShipping: false,
        autoSendOnSignature: false,
        ccEmails: [],
        subject: "Invoice #{invoiceNumber} for {clientName}",
        bodyTemplate: `Dear {clientName},

Here is your invoice summary #{invoiceNumber} dated {invoiceDate}.

Invoice Details:
- Client: {clientName}
- Date: {invoiceDate}
- Total Amount: ${"{totalAmount}"}

{processingSummary}

If you have any questions regarding this invoice, please don't hesitate to contact us.

Thank you for your business!

Best regards,
King Uniforms Team`,
        signatureEmailSubject: "",
        signatureEmailTemplate: "",
      },
    });

  useEffect(() => {
    loadClients();
    // Load default configuration from localStorage
    const savedDefaultConfig = localStorage.getItem("defaultPrintConfig");
    if (savedDefaultConfig) {
      try {
        const parsedConfig = JSON.parse(savedDefaultConfig);
        setDefaultPrintConfig(parsedConfig);
      } catch (error) {
        console.error("Failed to parse saved default config:", error);
      }
    }
  }, []);

  // Show notification function for displaying success, error, and info messages
  const showNotification = (
    type: "success" | "error" | "info",
    message: string,
    duration = 4000
  ) => {
    // Clear any existing timeout to prevent multiple notifications
    if (notification.timeout) {
      clearTimeout(notification.timeout);
    }

    // Set notification state
    setNotification({
      show: true,
      type,
      message,
      timeout: setTimeout(() => {
        setNotification((prev) => ({ ...prev, show: false }));
      }, duration),
    });
  };

  const loadClients = async () => {
    try {
      const clientsData = await getClients();
      setClients(clientsData);
    } catch (error) {
      console.error("Failed to load clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const openClientEmailConfiguration = (client: Client) => {
    // Ensure client has printConfig with emailSettings before opening modal
    const clientWithConfig = {
      ...client,
      printConfig: client.printConfig || {
        ...defaultPrintConfig,
      },
    };
    setSelectedClient(clientWithConfig);
    setShowEmailConfigModal(true);
  };

  const handleConfigurationSave = async (
    clientId: string,
    updatedConfig: PrintConfiguration,
    clientEmail?: string
  ) => {
    try {
      console.log("Updating client email config:", {
        clientId,
        updatedConfig,
        clientEmail,
      });

      // Find the current client to log existing data
      const currentClient = clients.find((c) => c.id === clientId);

      // Update both email and print configuration
      const updates: Partial<Client> = {
        printConfig: updatedConfig,
      };

      // Only include email in updates if it's provided and different
      if (clientEmail !== undefined && clientEmail !== currentClient?.email) {
        updates.email = clientEmail;
      }

      await updateClient(clientId, updates);

      await logActivity({
        type: "Client",
        message: `Email configuration updated for client '${
          currentClient?.name
        }'${
          clientEmail !== currentClient?.email
            ? " including new email address"
            : ""
        }`,
      });

      // Update local state
      setClients((prev) =>
        prev.map((c) => (c.id === clientId ? { ...c, ...updates } : c))
      );

      setShowEmailConfigModal(false);
      setSelectedClient(null);

      showNotification(
        "success",
        "Client email configuration updated successfully"
      );
      console.log("Client email configuration updated successfully");
    } catch (error) {
      console.error("Failed to save configuration:", error);
      showNotification("error", "Failed to save email configuration");
    }
  };

  const applyDefaultEmailConfigToClient = async (clientId: string) => {
    setSaving(clientId);
    try {
      // Get the client's existing config or create new one
      const client = clients.find((c) => c.id === clientId);
      const existingConfig = client?.printConfig || {
        cartPrintSettings: defaultPrintConfig.cartPrintSettings,
        invoicePrintSettings: defaultPrintConfig.invoicePrintSettings,
        emailSettings: defaultPrintConfig.emailSettings,
      };

      // Only update the email settings
      const updatedConfig = {
        ...existingConfig,
        emailSettings: defaultPrintConfig.emailSettings,
      };

      await updateClient(clientId, { printConfig: updatedConfig });

      await logActivity({
        type: "Client",
        message: `Default email configuration applied to client '${
          client?.name || clientId
        }'`,
      });

      // Update local state
      setClients((prev) =>
        prev.map((c) =>
          c.id === clientId ? { ...c, printConfig: updatedConfig } : c
        )
      );

      showNotification(
        "success",
        "Default email configuration applied successfully"
      );
    } catch (error) {
      console.error("Failed to apply default config:", error);
      showNotification("error", "Failed to apply default email configuration");
    } finally {
      setSaving(null);
    }
  };

  const sendTestEmail = async (client: Client) => {
    if (!client.email) {
      alert("Client does not have an email address configured.");
      return;
    }

    if (!client.printConfig?.emailSettings?.enabled) {
      alert(
        "Email is not enabled for this client. Please configure email settings first."
      );
      return;
    }

    setTestingEmail(client.id);

    try {
      // Validate email settings
      const validation = validateEmailSettings(
        client,
        client.printConfig.emailSettings
      );
      if (!validation.isValid) {
        setEmailTestResults((prev) => ({
          ...prev,
          [client.id]: {
            success: false,
            message: `Email configuration error: ${validation.errors.join(
              ", "
            )}`,
            timestamp: new Date(),
          },
        }));

        // Show error notification
        showNotification(
          "error",
          `Email configuration error: ${validation.errors.join(", ")}`
        );
        setTestingEmail(null);
        return;
      }

      // Send test email using the service
      const success = await sendTestEmailService(
        client,
        client.printConfig.emailSettings
      );

      setEmailTestResults((prev) => ({
        ...prev,
        [client.id]: {
          success,
          message: success
            ? `Test email sent successfully to ${client.email}`
            : "Failed to send test email",
          timestamp: new Date(),
        },
      }));

      if (success) {
        await logActivity({
          type: "Email",
          message: `Test email sent to client '${client.name}' (${client.email})`,
        });

        // Show success notification
        showNotification(
          "success",
          `Test email sent successfully to ${client.name} (${client.email})`
        );
      } else {
        // Show error notification for failed emails
        showNotification(
          "error",
          "Failed to send test email. Please check your configuration."
        );
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      setEmailTestResults((prev) => ({
        ...prev,
        [client.id]: {
          success: false,
          message: `Error sending test email: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          timestamp: new Date(),
        },
      }));

      // Show error notification for exceptions
      showNotification(
        "error",
        `Error sending test email: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setTestingEmail(null);
    }
  };

  const openEmailPreview = (client: Client) => {
    setEmailPreviewClient(client);
    setShowEmailPreview(true);
  };

  const generateEmailPreview = (client: Client) => {
    if (!client.printConfig?.emailSettings) {
      return {
        subject: "No email configuration",
        body: "Email settings not configured for this client.",
      };
    }

    const emailSettings = client.printConfig.emailSettings;

    // Create a mock invoice for preview
    const mockInvoice = {
      id: "preview-invoice",
      invoiceNumber: 12345,
      clientId: client.id,
      clientName: client.name,
      date: new Date().toISOString().split("T")[0],
      total: 250.0,
      totalWeight: client.billingCalculation === "byWeight" ? 125.5 : undefined,
      carts: [
        {
          id: "preview-cart-1",
          name: "Sample Cart 1",
          items: [
            {
              productId: "product-1",
              productName: "Scrub Shirts",
              quantity: 10,
              price: 15.0,
            },
            {
              productId: "product-2",
              productName: "Scrub Pants",
              quantity: 8,
              price: 12.5,
            },
          ],
          total: 250.0,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    // Generate subject
    const subject =
      emailSettings.subject ||
      `Invoice #${mockInvoice.invoiceNumber} - ${client.name}`;

    // Generate body with processing summary
    const getProcessingSummary = () => {
      if (client.billingCalculation === "byWeight" && mockInvoice.totalWeight) {
        return `Total Pounds Processed: ${mockInvoice.totalWeight.toFixed(
          2
        )} lbs`;
      } else {
        let result = "Items Processed:\n";
        result += "- Scrub Shirts: 10 pieces\n";
        result += "- Scrub Pants: 8 pieces\n";
        return result;
      }
    };

    const defaultTemplate = `Dear ${client.name},

Here is your invoice summary #${mockInvoice.invoiceNumber} dated ${
      mockInvoice.date
    }.

Invoice Details:
- Client: ${client.name}
- Date: ${mockInvoice.date}
- Total Amount: $${mockInvoice.total.toFixed(2)}

${getProcessingSummary()}

If you have any questions regarding this invoice, please don't hesitate to contact us.

Thank you for your business!

Best regards,
King Uniforms Team`;

    let body = defaultTemplate;
    if (emailSettings.bodyTemplate) {
      body = emailSettings.bodyTemplate
        .replace(/\{clientName\}/g, client.name)
        .replace(/\{invoiceNumber\}/g, String(mockInvoice.invoiceNumber))
        .replace(/\{invoiceDate\}/g, mockInvoice.date)
        .replace(/\{totalAmount\}/g, mockInvoice.total.toFixed(2))
        .replace(/\{cartCount\}/g, String(mockInvoice.carts.length))
        .replace(/\{clientEmail\}/g, client.email || "");

      // Add processing summary if {processingSummary} is in the template, otherwise append it
      if (body.includes("{processingSummary}")) {
        body = body.replace(/\{processingSummary\}/g, getProcessingSummary());
      } else {
        body += `\n\n${getProcessingSummary()}`;
      }
    }

    return { subject, body };
  };

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="card p-4 mb-4">
        <h3 className="mb-3">📧 Email Settings</h3>
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="printing-settings-container">
      {notification.show && (
        <div
          className={`alert alert-${
            notification.type === "success"
              ? "success"
              : notification.type === "error"
              ? "danger"
              : "info"
          } alert-dismissible fade show`}
          role="alert"
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 1050,
            minWidth: "300px",
            boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)",
          }}
        >
          {notification.type === "success" && (
            <i className="bi bi-check-circle-fill me-2"></i>
          )}
          {notification.type === "error" && (
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
          )}
          {notification.type === "info" && (
            <i className="bi bi-info-circle-fill me-2"></i>
          )}
          {notification.message}
          <button
            type="button"
            className="btn-close"
            onClick={() =>
              setNotification((prev) => ({ ...prev, show: false }))
            }
          ></button>
        </div>
      )}

      <div className="settings-header">
        <h1>Printing and Email Configuration</h1>
        <p>
          Manage how invoices and reports are generated, printed, and emailed to
          clients.
        </p>
        <button
          onClick={() => setShowLaundryTicketPreview(true)}
          className="button"
        >
          Preview Laundry Ticket
        </button>
      </div>

      {showLaundryTicketPreview && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "800px" }}>
            <div className="modal-header">
              <h2>Laundry Ticket Preview</h2>
              <button
                onClick={() => setShowLaundryTicketPreview(false)}
                className="modal-close-button"
              >
                &times;
              </button>
            </div>
            <LaundryTicketPreview
              ticketNumber="80167"
              clientName="Buen Samaritano"
              truck="34"
              pickupDate="6/19/2025"
              items={[
                { productName: "Flat Sheets", quantity: 500 },
                { productName: "Fitted Sheets", quantity: 100 },
                { productName: "Laundry Bags", quantity: 14 },
                { productName: "Patient Gowns", quantity: 7 },
                { productName: "Scrub Shirts", quantity: 45 },
                { productName: "Scrub Pants", quantity: 50 },
              ]}
              pounds={700}
            />
          </div>
        </div>
      )}

      <div className="search-and-filter-controls">
        <input
          type="text"
          className="form-control"
          placeholder="Search clients by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Client Email Configuration - Full Width */}
      <div className="container-fluid px-0 mb-5">
        <div className="card shadow-sm">
          <div className="card-header" style={{ background: '#0E62A0', color: 'white' }}>
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center">
                <i className="bi bi-envelope-gear me-3" style={{ fontSize: '1.5rem' }}></i>
                <div>
                  <h4 className="mb-0 fw-bold">Client Email Configuration</h4>
                  <small className="text-light opacity-75">
                    Configure email settings and templates for client notifications
                  </small>
                </div>
              </div>
              <div className="text-end">
                <img 
                  src="/api/placeholder/120/40" 
                  alt="King Uniforms" 
                  style={{ height: '32px', filter: 'brightness(0) invert(1)' }}
                />
              </div>
            </div>
          </div>
          <div className="card-body p-4">
            {/* Enhanced Search Bar */}
            <div className="row mb-4">
              <div className="col-md-6">
                <div className="position-relative">
                  <i className="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
                  <input
                    type="text"
                    className="form-control ps-5 py-2"
                    placeholder="Search clients by name, email, or billing type..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ borderColor: '#dee2e6', borderRadius: '8px' }}
                  />
                </div>
              </div>
              <div className="col-md-6 text-end">
                <span className="text-muted">
                  <i className="bi bi-people-fill me-1"></i>
                  {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''} found
                </span>
              </div>
            </div>

            {/* Enhanced Table */}
            <div className="table-responsive">
              <table className="table table-hover align-middle" style={{ borderRadius: '8px', overflow: 'hidden' }}>
                <thead style={{ background: '#f8f9fa', borderTop: '2px solid #0E62A0' }}>
                  <tr>
                    <th className="fw-semibold text-dark py-3" style={{ borderBottom: '2px solid #dee2e6' }}>
                      <i className="bi bi-person-fill me-2 text-primary"></i>Client
                    </th>
                    <th className="fw-semibold text-dark py-3" style={{ borderBottom: '2px solid #dee2e6' }}>
                      <i className="bi bi-envelope-fill me-2 text-primary"></i>Email Address
                    </th>
                    <th className="fw-semibold text-dark py-3" style={{ borderBottom: '2px solid #dee2e6' }}>
                      <i className="bi bi-calculator-fill me-2 text-primary"></i>Billing Type
                    </th>
                    <th className="fw-semibold text-dark py-3" style={{ borderBottom: '2px solid #dee2e6' }}>
                      <i className="bi bi-toggle-on me-2 text-primary"></i>Status
                    </th>
                    <th className="fw-semibold text-dark py-3 text-center" style={{ borderBottom: '2px solid #dee2e6' }}>
                      <i className="bi bi-gear-fill me-2 text-primary"></i>Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client, index) => (
                    <tr key={client.id} className="border-bottom" style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafbfc' }}>
                      <td className="py-3">
                        <div className="d-flex align-items-center">
                          <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3" 
                               style={{ width: '40px', height: '40px', fontSize: '14px', fontWeight: 'bold' }}>
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="fw-semibold text-dark">{client.name}</div>
                            <small className="text-muted">ID: {client.id}</small>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        {client.email ? (
                          <div className="d-flex align-items-center">
                            <div className="rounded-circle bg-success text-white d-flex align-items-center justify-content-center me-2" 
                                 style={{ width: '24px', height: '24px', fontSize: '12px' }}>
                              <i className="bi bi-check"></i>
                            </div>
                            <div>
                              <div className="text-dark">{client.email}</div>
                              <span className="badge bg-success-subtle text-success">
                                <i className="bi bi-envelope-check-fill me-1"></i>Configured
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="d-flex align-items-center">
                            <div className="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center me-2" 
                                 style={{ width: '24px', height: '24px', fontSize: '12px' }}>
                              <i className="bi bi-x"></i>
                            </div>
                            <div>
                              <div className="text-muted">No email address</div>
                              <span className="badge bg-danger-subtle text-danger">
                                <i className="bi bi-exclamation-triangle-fill me-1"></i>Not Configured
                              </span>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3">
                        {client.billingCalculation === "byWeight" ? (
                          <span className="badge bg-info-subtle text-info px-3 py-2" style={{ fontSize: '0.85rem' }}>
                            <i className="bi bi-speedometer2 me-1"></i>By Weight
                          </span>
                        ) : (
                          <span className="badge bg-secondary-subtle text-secondary px-3 py-2" style={{ fontSize: '0.85rem' }}>
                            <i className="bi bi-list-ol me-1"></i>By Item
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        {client.printConfig?.emailSettings?.enabled ? (
                          <span className="badge bg-success px-3 py-2" style={{ fontSize: '0.85rem' }}>
                            <i className="bi bi-toggle-on me-1"></i>Enabled
                          </span>
                        ) : (
                          <span className="badge bg-secondary px-3 py-2" style={{ fontSize: '0.85rem' }}>
                            <i className="bi bi-toggle-off me-1"></i>Disabled
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <div className="btn-group" role="group">
                          <button
                            className="btn btn-outline-primary btn-sm px-3"
                            onClick={() => openClientEmailConfiguration(client)}
                            title="Configure email settings"
                          >
                            <i className="bi bi-gear-fill me-1"></i>Configure
                          </button>
                          <button
                            className="btn btn-outline-info btn-sm px-3"
                            onClick={() => openEmailPreview(client)}
                            title="Preview email template"
                          >
                            <i className="bi bi-eye-fill me-1"></i>Preview
                          </button>
                          <button
                            className="btn btn-outline-success btn-sm px-3"
                            disabled={testingEmail === client.id || !client.email}
                            onClick={() => sendTestEmail(client)
                            }
                            title="Send test email"
                          >
                            {testingEmail === client.id ? (
                              <span className="spinner-border spinner-border-sm me-1" />
                            ) : (
                              <i className="bi bi-send-fill me-1"></i>
                            )}
                            Test
                          </button>
                          <button
                            className="btn btn-outline-secondary btn-sm px-3"
                            onClick={() => {
                              setFieldsModalClient(client);
                              setFieldsModalConfig(client.printConfig?.invoicePrintSettings || defaultPrintConfig.invoicePrintSettings);
                              setShowFieldsModal(true);
                            }}
                            title="Customize Laundry Ticket Fields"
                          >
                            <i className="bi bi-ui-checks-grid me-1"></i>Customize Ticket Fields
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Statistics */}
            <div className="row mt-4">
              <div className="col-md-3">
                <div className="card border-0 bg-light text-center">
                  <div className="card-body py-3">
                    <div className="text-primary fw-bold h4">{clients.length}</div>
                    <small className="text-muted">Total Clients</small>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-0 bg-light text-center">
                  <div className="card-body py-3">
                    <div className="text-success fw-bold h4">
                      {clients.filter(c => c.email && c.printConfig?.emailSettings?.enabled).length}
                    </div>
                    <small className="text-muted">Email Enabled</small>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-0 bg-light text-center">
                  <div className="card-body py-3">
                    <div className="text-info fw-bold h4">
                      {clients.filter(c => c.billingCalculation === "byWeight").length}
                    </div>
                    <small className="text-muted">By Weight</small>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-0 bg-light text-center">
                  <div className="card-body py-3">
                    <div className="text-secondary fw-bold h4">
                      {clients.filter(c => c.billingCalculation === "byItem").length}
                    </div>
                    <small className="text-muted">By Item</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Email Preview Section - Full Width Conditional Display */}
      {showEmailPreview && emailPreviewClient && (
        <div className="container-fluid px-0 mb-4">
          <div className="card shadow-sm">
            <div className="card-header" style={{ background: '#0E62A0', color: 'white' }}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <i className="bi bi-envelope-paper me-3" style={{ fontSize: '1.5rem' }}></i>
                  <div>
                    <h4 className="mb-0 fw-bold">Email Preview - {emailPreviewClient.name}</h4>
                    <small className="text-light opacity-75">
                      Preview how the email will appear to the recipient
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setShowEmailPreview(false);
                    setEmailPreviewClient(null);
                  }}
                ></button>
              </div>
            </div>
            <div className="card-body p-4">
              {(() => {
                const emailSettings = emailPreviewClient.printConfig?.emailSettings;
                const preview = generateEmailPreview(emailPreviewClient);
                return (
                  <div>
                    {/* Email Details */}
                    <div className="row mb-4">
                      <div className="col-md-6">
                        <div className="card">
                          <div className="card-header bg-light">
                            <h6 className="mb-0">📝 Email Details</h6>
                          </div>
                          <div className="card-body">
                            <div className="mb-2">
                              <strong>To:</strong>{" "}
                              {emailPreviewClient.email || (
                                <span className="text-warning">No email address</span>
                              )}
                            </div>
                            {emailSettings?.ccEmails &&
                              emailSettings.ccEmails.filter(email => email && email.trim() !== "").length > 0 && (
                                <div className="mb-2">
                                  <strong>CC:</strong>{" "}
                                  {emailSettings.ccEmails.filter(email => email && email.trim() !== "").join(", ")}
                                </div>
                              )}
                            <div className="mb-2">
                              <strong>From:</strong> emperez@kinguniforms.net
                            </div>
                            <div className="mb-2">
                              <strong>Billing Type:</strong>{" "}
                              {emailPreviewClient.billingCalculation === "byWeight" ? (
                                <span className="badge bg-info">By Weight</span>
                              ) : (
                                <span className="badge bg-secondary">By Item</span>
                              )}
                            </div>
                            <div className="mb-2">
                              <strong>Auto-send:</strong>
                              <div className="mt-1">
                                {emailSettings?.autoSendOnApproval && (
                                  <span className="badge bg-primary me-1">On Approval</span>
                                )}
                                {emailSettings?.autoSendOnShipping && (
                                  <span className="badge bg-success me-1">On Shipping</span>
                                )}
                                {emailSettings?.autoSendOnSignature && (
                                  <span className="badge bg-warning me-1">On Signature</span>
                                )}
                                {!emailSettings?.autoSendOnApproval &&
                                  !emailSettings?.autoSendOnShipping &&
                                  !emailSettings?.autoSendOnSignature && (
                                    <span className="badge bg-info">Manual Only</span>
                                  )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card">
                          <div className="card-header bg-light">
                            <h6 className="mb-0">⚙️ Configuration Status</h6>
                          </div>
                          <div className="card-body">
                            <div className="mb-2">
                              <strong>Email Enabled:</strong>
                              <span className={`badge ms-1 ${emailSettings?.enabled ? "bg-success" : "bg-danger"}`}>
                                {emailSettings?.enabled ? "Yes" : "No"}
                              </span>
                            </div>
                            <div className="mb-2">
                              <strong>Custom Subject:</strong>
                              <span className={`badge ms-1 ${emailSettings?.subject ? "bg-info" : "bg-secondary"}`}>
                                {emailSettings?.subject ? "Yes" : "Default"}
                              </span>
                            </div>
                            <div className="mb-2">
                              <strong>Custom Template:</strong>
                              <span className={`badge ms-1 ${emailSettings?.bodyTemplate ? "bg-info" : "bg-secondary"}`}>
                                {emailSettings?.bodyTemplate ? "Yes" : "Default"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Email Preview */}
                    <div className="card">
                      <div className="card-header bg-primary text-white">
                        <h6 className="mb-0">📬 Email Preview</h6>
                        <small className="text-light">
                          This is how the email will appear to the recipient
                        </small>
                      </div>
                      <div className="card-body">
                        {/* Subject Line */}
                        <div className="mb-3 p-3 bg-light rounded">
                          <strong>Subject:</strong> {preview.subject}
                        </div>

                        {/* Email Body */}
                        <div
                          className="border rounded p-3"
                          style={{
                            background: "#ffffff",
                            fontFamily: "Arial, sans-serif",
                            minHeight: "300px",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {preview.body}
                        </div>
                      </div>
                    </div>

                    {/* Template Variables Help */}
                    <div className="mt-3">
                      <div className="card">
                        <div className="card-header">
                          <h6 className="mb-0">💡 Template Variables</h6>
                        </div>
                        <div className="card-body">
                          <small className="text-muted">
                            <ul>
                              <li>{"{clientName}"} - Client name</li>
                              <li>{"{invoiceNumber}"} - Laundry Ticket number</li>
                              <li>{"{invoiceDate}"} - Laundry Ticket date</li>
                              <li>{"{totalAmount}"} - Total amount</li>
                              <li>{"{cartCount}"} - Number of carts</li>
                              <li>{"{clientEmail}"} - Client email</li>
                              <li>{"{processingSummary}"} - Processing summary (weight or items)</li>
                            </ul>
                          </small>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 d-flex justify-content-end">
                      <button
                        type="button"
                        className="btn btn-secondary me-2"
                        onClick={() => {
                          setShowEmailPreview(false);
                          setEmailPreviewClient(null);
                        }}
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        className="btn btn-warning me-2"
                        onClick={() => {
                          setShowEmailPreview(false);
                          setEmailPreviewClient(null);
                          openClientEmailConfiguration(emailPreviewClient);
                        }}
                      >
                        ⚙️ Edit Email Settings
                      </button>
                      {emailPreviewClient.email && emailSettings?.enabled && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            setShowEmailPreview(false);
                            setEmailPreviewClient(null);
                            sendTestEmail(emailPreviewClient);
                          }}
                          disabled={testingEmail === emailPreviewClient.id}
                        >
                          {testingEmail === emailPreviewClient.id ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-1" />
                              Sending...
                            </>
                          ) : (
                            <>📧 Send Test Email</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Email Content Guide - Full Width */}
      {!showEmailPreview && (
        <div className="container-fluid px-0 mb-4">
          <div className="card shadow-sm">
            <div className="card-header" style={{ background: '#0E62A0', color: 'white' }}>
              <div className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <i className="bi bi-lightbulb me-3" style={{ fontSize: '1.5rem' }}></i>
                  <div>
                    <h4 className="mb-0 fw-bold">Email Content Guide</h4>
                    <small className="text-light opacity-75">
                      Understanding how email content is generated based on billing types
                    </small>
                  </div>
                </div>
                <div className="text-end">
                  <img 
                    src="/api/placeholder/120/40" 
                    alt="King Uniforms" 
                    style={{ height: '32px', filter: 'brightness(0) invert(1)' }}
                  />
                </div>
              </div>
            </div>
            <div className="card-body p-4">
              <div className="row">
                {/* Billing Types Column */}
                <div className="col-md-6">
                  <h5 className="text-primary mb-4">
                    <i className="bi bi-calculator me-2"></i>Billing Types & Email Content
                  </h5>

                  <div className="alert alert-primary border-0 mb-4" style={{ backgroundColor: '#e3f2fd' }}>
                    <div className="d-flex align-items-start">
                      <div className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3" 
                           style={{ width: '40px', height: '40px', fontSize: '16px' }}>
                        <i className="bi bi-speedometer2"></i>
                      </div>
                      <div className="flex-grow-1">
                        <h6 className="fw-bold text-primary mb-2">Clients Billed by Weight</h6>
                        <p className="mb-3">Emails include the total pounds processed for the laundry ticket</p>
                        <div className="bg-white p-3 rounded border" style={{ fontFamily: 'Monaco, monospace', fontSize: '0.9rem' }}>
                          <strong>Example Output:</strong><br/>
                          <span className="text-success">Total Pounds Processed: 125.50 lbs</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="alert alert-secondary border-0" style={{ backgroundColor: '#f5f5f5' }}>
                    <div className="d-flex align-items-start">
                      <div className="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center me-3" 
                           style={{ width: '40px', height: '40px', fontSize: '16px' }}>
                        <i className="bi bi-list-ol"></i>
                      </div>
                      <div className="flex-grow-1">
                        <h6 className="fw-bold text-secondary mb-2">Clients Billed by Item</h6>
                        <p className="mb-3">Emails include an itemized breakdown of all processed items</p>
                        <div className="bg-white p-3 rounded border" style={{ fontFamily: 'Monaco, monospace', fontSize: '0.9rem' }}>
                          <strong>Example Output:</strong><br/>
                          <span className="text-info">Items Processed:</span><br/>
                          <span className="text-success">• Scrub Shirts: 10 pieces</span><br/>
                          <span className="text-success">• Scrub Pants: 8 pieces</span><br/>
                          <span className="text-success">• Lab Coats: 3 pieces</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Template Variables Column */}
                <div className="col-md-6">
                  <h5 className="text-primary mb-4">
                    <i className="bi bi-code-square me-2"></i>Template Variables
                  </h5>

                  <div className="card border-0" style={{ backgroundColor: '#f8f9fa' }}>
                    <div className="card-body">
                      <h6 className="fw-bold mb-3">
                        <i className="bi bi-person-fill me-2"></i>Client Information
                      </h6>
                      <div className="row g-2 mb-4">
                        <div className="col-6">
                          <code className="d-block p-2 bg-white rounded small">{"{clientName}"}</code>
                          <small className="text-muted">Client name</small>
                        </div>
                        <div className="col-6">
                          <code className="d-block p-2 bg-white rounded small">{"{clientEmail}"}</code>
                          <small className="text-muted">Client email</small>
                        </div>
                      </div>

                      <h6 className="fw-bold mb-3">
                        <i className="bi bi-receipt me-2"></i>Invoice Details
                      </h6>
                      <div className="row g-2 mb-4">
                        <div className="col-6">
                          <code className="d-block p-2 bg-white rounded small">{"{invoiceNumber}"}</code>
                          <small className="text-muted">Laundry Ticket #</small>
                        </div>
                        <div className="col-6">
                          <code className="d-block p-2 bg-white rounded small">{"{invoiceDate}"}</code>
                          <small className="text-muted">Ticket date</small>
                        </div>
                        <div className="col-6">
                          <code className="d-block p-2 bg-white rounded small">{"{totalAmount}"}</code>
                          <small className="text-muted">Total amount</small>
                        </div>
                        <div className="col-6">
                          <code className="d-block p-2 bg-white rounded small">{"{cartCount}"}</code>
                          <small className="text-muted">Number of carts</small>
                        </div>
                      </div>

                      <h6 className="fw-bold mb-3">
                        <i className="bi bi-gear-fill me-2"></i>Processing Data
                      </h6>
                      <div className="row g-2">
                        <div className="col-12">
                          <code className="d-block p-2 bg-white rounded small">{"{processingSummary}"}</code>
                          <small className="text-muted">Automatically includes weight totals or itemized breakdown based on client billing type</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="alert alert-info border-0 mt-3" style={{ backgroundColor: '#e1f5fe' }}>
                    <div className="d-flex align-items-center">
                      <i className="bi bi-info-circle-fill text-info me-3" style={{ fontSize: '1.2rem' }}></i>
                      <div>
                        <strong>Quick Actions:</strong>
                        <p className="mb-0 mt-1">Click <strong>"Preview"</strong> next to any client to see their email template, or <strong>"Configure"</strong> to customize it.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Configuration Modal */}
      {showEmailConfigModal && selectedClient && (
        <div className="modal show d-block" tabIndex={-1}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Email Configuration - {selectedClient.name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowEmailConfigModal(false);
                    setSelectedClient(null);
                  }}
                ></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-info">
                  <div className="d-flex">
                    <div className="me-3">ℹ️</div>
                    <div>
                      <strong>
                        Billing Type:{" "}
                        {selectedClient.billingCalculation === "byWeight"
                          ? "By Weight"
                          : "By Piece"}
                      </strong>
                      <p className="mb-0">
                        {selectedClient.billingCalculation === "byWeight"
                          ? "This client is billed by weight. Emails will include the total pounds processed."
                          : "This client is billed by piece. Emails will include a breakdown of items processed."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Email Settings Form */}
                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="emailEnabled"
                    checked={
                      selectedClient.printConfig?.emailSettings?.enabled ||
                      false
                    }
                    onChange={(e) => {
                      // Create a safe copy of the current config
                      const safeConfig = selectedClient.printConfig || {
                        ...defaultPrintConfig,
                      };
                      // Create a safe copy of email settings
                      const safeEmailSettings = safeConfig.emailSettings || {
                        ...defaultPrintConfig.emailSettings,
                      };

                      setSelectedClient({
                        ...selectedClient,
                        printConfig: {
                          ...safeConfig,
                          emailSettings: {
                            ...safeEmailSettings,
                            enabled: e.target.checked,
                          },
                        },
                      });
                    }}
                  />
                  <label className="form-check-label" htmlFor="emailEnabled">
                    Enable email functionality
                  </label>
                </div>

                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="autoSendOnApproval"
                    checked={
                      selectedClient.printConfig?.emailSettings
                        ?.autoSendOnApproval || false
                    }
                    onChange={(e) => {
                      // Create a safe copy of the current config
                      const safeConfig = selectedClient.printConfig || {
                        ...defaultPrintConfig,
                      };
                      // Create a safe copy of email settings
                      const safeEmailSettings = safeConfig.emailSettings || {
                        ...defaultPrintConfig.emailSettings,
                      };

                      setSelectedClient({
                        ...selectedClient,
                        printConfig: {
                          ...safeConfig,
                          emailSettings: {
                            ...safeEmailSettings,
                            autoSendOnApproval: e.target.checked,
                          },
                        },
                      });
                    }}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="autoSendOnApproval"
                  >
                    Auto-send on approval
                  </label>
                </div>

                <div className="mb-3">
                  <label htmlFor="clientEmail" className="form-label">
                    <strong>Client Email Address</strong>
                    {!selectedClient.email && (
                      <span className="badge bg-warning ms-2">Required</span>
                    )}
                  </label>
                  <input
                    type="email"
                    className={`form-control ${
                      !selectedClient.email ? "border-warning" : ""
                    }`}
                    id="clientEmail"
                    value={selectedClient.email || ""}
                    onChange={(e) => {
                      setSelectedClient({
                        ...selectedClient,
                        email: e.target.value,
                      });
                    }}
                    placeholder="client@example.com"
                  />
                  {!selectedClient.email ? (
                    <div className="alert alert-warning mt-2 py-2">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      Email address is required to send notifications when
                      orders are shipped.
                    </div>
                  ) : (
                    <div className="form-text text-muted">
                      This is the primary email address where invoices and
                      notifications will be sent.
                    </div>
                  )}
                </div>

                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="autoSendOnShipping"
                    checked={
                      selectedClient.printConfig?.emailSettings
                        ?.autoSendOnShipping || false
                    }
                    onChange={(e) => {
                      // Create a safe copy of the current config
                      const safeConfig = selectedClient.printConfig || {
                        ...defaultPrintConfig,
                      };
                      // Create a safe copy of email settings
                      const safeEmailSettings = safeConfig.emailSettings || {
                        ...defaultPrintConfig.emailSettings,
                      };

                      setSelectedClient({
                        ...selectedClient,
                        printConfig: {
                          ...safeConfig,
                          emailSettings: {
                            ...safeEmailSettings,
                            autoSendOnShipping: e.target.checked,
                          },
                        },
                      });
                    }}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="autoSendOnShipping"
                  >
                    Auto-send on shipping
                  </label>
                </div>

                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="autoSendOnSignature"
                    checked={
                      selectedClient.printConfig?.emailSettings
                        ?.autoSendOnSignature || false
                    }
                    onChange={(e) => {
                      // Create a safe copy of the current config
                      const safeConfig = selectedClient.printConfig || {
                        ...defaultPrintConfig,
                      };
                      // Create a safe copy of email settings
                      const safeEmailSettings = safeConfig.emailSettings || {
                        ...defaultPrintConfig.emailSettings,
                      };

                      setSelectedClient({
                        ...selectedClient,
                        printConfig: {
                          ...safeConfig,
                          emailSettings: {
                            ...safeEmailSettings,
                            autoSendOnSignature: e.target.checked,
                          },
                        },
                      });
                    }}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="autoSendOnSignature"
                  >
                    Auto-send on signature capture
                  </label>
                </div>

                <div className="mb-3">
                  <label htmlFor="emailSubject" className="form-label">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="emailSubject"
                    value={
                      selectedClient.printConfig?.emailSettings?.subject || ""
                    }
                    onChange={(e) => {
                      // Create a safe copy of the current config
                      const safeConfig = selectedClient.printConfig || {
                        ...defaultPrintConfig,
                      };
                      // Create a safe copy of email settings
                      const safeEmailSettings = safeConfig.emailSettings || {
                        ...defaultPrintConfig.emailSettings,
                      };

                      setSelectedClient({
                        ...selectedClient,
                        printConfig: {
                          ...safeConfig,
                          emailSettings: {
                            ...safeEmailSettings,
                            subject: e.target.value,
                          },
                        },
                      });
                    }}
                    placeholder="Invoice #{invoiceNumber} for {clientName}"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    CC Emails
                    <small className="text-muted ms-2">(Additional recipients)</small>
                  </label>
                  
                  {/* Existing CC Email inputs */}
                  {(selectedClient.printConfig?.emailSettings?.ccEmails || []).map((email, index) => (
                    <div key={index} className="input-group mb-2">
                      <input
                        type="email"
                        className="form-control"
                        value={email}
                        onChange={(e) => {
                          // Create a safe copy of the current config
                          const safeConfig = selectedClient.printConfig || {
                            ...defaultPrintConfig,
                          };
                          // Create a safe copy of email settings
                          const safeEmailSettings = safeConfig.emailSettings || {
                            ...defaultPrintConfig.emailSettings,
                          };
                          
                          const newCcEmails = [...(safeEmailSettings.ccEmails || [])];
                          newCcEmails[index] = e.target.value;

                          setSelectedClient({
                            ...selectedClient,
                            printConfig: {
                              ...safeConfig,
                              emailSettings: {
                                ...safeEmailSettings,
                                ccEmails: newCcEmails,
                              },
                            },
                          });
                        }}
                        placeholder={`cc-email-${index + 1}@example.com`}
                      />
                      <button
                        className="btn btn-outline-danger"
                        type="button"
                        onClick={() => {
                          // Create a safe copy of the current config
                          const safeConfig = selectedClient.printConfig || {
                            ...defaultPrintConfig,
                          };
                          // Create a safe copy of email settings
                          const safeEmailSettings = safeConfig.emailSettings || {
                            ...defaultPrintConfig.emailSettings,
                          };
                          
                          const newCcEmails = (safeEmailSettings.ccEmails || []).filter((_, i) => i !== index);

                          setSelectedClient({
                            ...selectedClient,
                            printConfig: {
                              ...safeConfig,
                              emailSettings: {
                                ...safeEmailSettings,
                                ccEmails: newCcEmails,
                              },
                            },
                          });
                        }}
                        title="Remove this CC email"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  ))}
                  
                  {/* Add new CC email button */}
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => {
                      // Create a safe copy of the current config
                      const safeConfig = selectedClient.printConfig || {
                        ...defaultPrintConfig,
                      };
                      // Create a safe copy of email settings
                      const safeEmailSettings = safeConfig.emailSettings || {
                        ...defaultPrintConfig.emailSettings,
                      };
                      
                      const newCcEmails = [...(safeEmailSettings.ccEmails || []), ""];

                      setSelectedClient({
                        ...selectedClient,
                        printConfig: {
                          ...safeConfig,
                          emailSettings: {
                            ...safeEmailSettings,
                            ccEmails: newCcEmails,
                          },
                        },
                      });
                    }}
                  >
                    <i className="bi bi-plus-circle me-1"></i>
                    Add CC Email
                  </button>
                  
                  {(selectedClient.printConfig?.emailSettings?.ccEmails || []).length === 0 && (
                    <div className="text-muted small mt-1">
                      Click "Add CC Email" to include additional recipients on all emails
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <label htmlFor="emailBodyTemplate" className="form-label">
                    Email Body Template
                  </label>
                  <textarea
                    className="form-control"
                    id="emailBodyTemplate"
                    rows={10}
                    value={
                      selectedClient.printConfig?.emailSettings?.bodyTemplate ||
                      ""
                    }
                    onChange={(e) => {
                      // Create a safe copy of the current config
                      const safeConfig = selectedClient.printConfig || {
                        ...defaultPrintConfig,
                      };
                      // Create a safe copy of email settings
                      const safeEmailSettings = safeConfig.emailSettings || {
                        ...defaultPrintConfig.emailSettings,
                      };

                      setSelectedClient({
                        ...selectedClient,
                        printConfig: {
                          ...safeConfig,
                          emailSettings: {
                            ...safeEmailSettings,
                            bodyTemplate: e.target.value,
                          },
                        },
                      });
                    }}
                    placeholder={`Dear {clientName},

Here is your invoice summary #{invoiceNumber} dated {invoiceDate}.

Invoice Details:
- Client: {clientName}
- Date: {invoiceDate}
- Total Amount: ${
                      selectedClient.printConfig?.emailSettings?.bodyTemplate ||
                      "{totalAmount}"
                    }

{processingSummary}

If you have any questions regarding this invoice, please don't hesitate to contact us.

Thank you for your business!

Best regards,
King Uniforms Team`}
                  />
                  <div className="form-text">
                    Available variables: {"{clientName}"}, {"{invoiceNumber}"},{" "}
                    {"{invoiceDate}"},{"{totalAmount}"}, {"{cartCount}"},{" "}
                    {"{clientEmail}"}, {"{processingSummary}"}
                  </div>
                  <div className="form-text text-primary">
                    Note: {"{processingSummary}"} will automatically show pounds
                    processed for weight-based clients or item counts for
                    piece-based clients.
                  </div>
                </div>

                {/* Signature-specific email fields */}
                <div className="mb-3">
                  <label htmlFor="signatureEmailSubject" className="form-label">
                    <strong>Signature Email Subject</strong>
                    <small className="text-muted ms-2">(Optional - different from regular emails)</small>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="signatureEmailSubject"
                    value={
                      selectedClient.printConfig?.emailSettings?.signatureEmailSubject || ""
                    }
                    onChange={(e) => {
                      // Create a safe copy of the current config
                      const safeConfig = selectedClient.printConfig || {
                        ...defaultPrintConfig,
                      };
                      // Create a safe copy of email settings
                      const safeEmailSettings = safeConfig.emailSettings || {
                        ...defaultPrintConfig.emailSettings,
                      };

                      setSelectedClient({
                        ...selectedClient,
                        printConfig: {
                          ...safeConfig,
                          emailSettings: {
                            ...safeEmailSettings,
                            signatureEmailSubject: e.target.value,
                          },
                        },
                      });
                    }}
                    placeholder="Delivery Confirmed - Invoice #{invoiceNumber} for {clientName}"
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="signatureEmailTemplate" className="form-label">
                    <strong>Signature Email Template</strong>
                    <small className="text-muted ms-2">(Optional - different from regular emails)</small>
                  </label>
                  <textarea
                    className="form-control"
                    id="signatureEmailTemplate"
                    rows={8}
                    value={
                      selectedClient.printConfig?.emailSettings?.signatureEmailTemplate || ""
                    }
                    onChange={(e) => {
                      // Create a safe copy of the current config
                      const safeConfig = selectedClient.printConfig || {
                        ...defaultPrintConfig,
                      };
                      // Create a safe copy of email settings
                      const safeEmailSettings = safeConfig.emailSettings || {
                        ...defaultPrintConfig.emailSettings,
                      };

                      setSelectedClient({
                        ...selectedClient,
                        printConfig: {
                          ...safeConfig,
                          emailSettings: {
                            ...safeEmailSettings,
                            signatureEmailTemplate: e.target.value,
                          },
                        },
                      });
                    }}
                    placeholder="Dear {clientName}, your delivery has been completed and signed for by {receivedBy}..."
                  />
                  <div className="form-text">
                    Additional signature placeholders: <code>{"{receivedBy}"}</code>, <code>{"{signatureDate}"}</code>, <code>{"{signatureTime}"}</code>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowEmailConfigModal(false);
                    setSelectedClient(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={
                    selectedClient.printConfig?.emailSettings?.enabled &&
                    !selectedClient.email
                  }
                  onClick={() => {
                    // Ensure we always have a valid configuration to save
                    const configToSave = selectedClient.printConfig || {
                      ...defaultPrintConfig,
                      emailSettings: {
                        ...defaultPrintConfig.emailSettings,
                        enabled: false,
                        autoSendOnApproval: false,
                        autoSendOnShipping: false,
                        autoSendOnSignature: false,
                        subject: "",
                        bodyTemplate: "",
                        signatureEmailSubject: "",
                        signatureEmailTemplate: "",
                        ccEmails: [],
                      },
                    };

                    // Get the updated email address
                    const emailToSave = selectedClient.email;

                    handleConfigurationSave(
                      selectedClient.id,
                      configToSave,
                      emailToSave
                    );
                  }}
                >
                  {selectedClient.printConfig?.emailSettings?.enabled &&
                  !selectedClient.email
                    ? "Email Required to Save"
                    : "Save Configuration"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Laundry Ticket Fields Modal */}
      {showFieldsModal && fieldsModalClient && fieldsModalConfig && (
        <LaundryTicketFieldsModal
          show={showFieldsModal}
          onClose={() => setShowFieldsModal(false)}
          initialConfig={fieldsModalConfig}
          onSave={async (newConfig: PrintConfiguration["invoicePrintSettings"]) => {
            setShowFieldsModal(false);
            // Save to Firestore
            const updatedConfig: PrintConfiguration = {
              ...(fieldsModalClient.printConfig || defaultPrintConfig),
              invoicePrintSettings: newConfig,
            };
            await updateClient(fieldsModalClient.id, { printConfig: updatedConfig });
            setClients((prev) => prev.map((c) => c.id === fieldsModalClient.id ? { ...c, printConfig: updatedConfig } : c));
            showNotification("success", "Laundry Ticket print fields updated.");
          }}
        />
      )}
    </div>
  );
};

export default PrintingSettings;
