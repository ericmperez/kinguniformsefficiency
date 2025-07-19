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

interface PrintingSettingsProps {}

const PrintingSettings: React.FC<PrintingSettingsProps> = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showEmailConfigModal, setShowEmailConfigModal] = useState(false);

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
    <div className="card p-4 mb-4">
      <h3 className="mb-3">📧 Email Configuration</h3>
      <p className="text-muted mb-4">
        Configure email content for your invoices. Emails will show either the
        total weight processed (pounds) or a breakdown of items with quantities
        depending on how each client is billed.
      </p>

      {/* Notification toast */}
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

      <div className="row">
        <div className="col-md-6">
          <div className="card mb-4">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">Email Configuration</h5>
            </div>
            <div className="card-body">
              <input
                type="text"
                className="form-control mb-3"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <table className="table table-bordered table-hover">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Email</th>
                    <th>Billing Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.name}</td>
                      <td>
                        {client.email ? (
                          <span className="text-success">
                            <i className="bi bi-envelope-fill me-1"></i>
                            {client.email}
                          </span>
                        ) : (
                          <span className="text-danger">
                            <i className="bi bi-exclamation-triangle-fill me-1"></i>
                            No email configured
                          </span>
                        )}
                      </td>
                      <td>
                        {client.billingCalculation === "byWeight" ? (
                          <span className="badge bg-info">By Weight</span>
                        ) : (
                          <span className="badge bg-secondary">By Piece</span>
                        )}
                      </td>
                      <td>
                        {client.printConfig?.emailSettings?.enabled ? (
                          <span className="badge bg-success">Enabled</span>
                        ) : (
                          <span className="badge bg-secondary">Disabled</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-outline-primary btn-sm me-2"
                          onClick={() => openClientEmailConfiguration(client)}
                        >
                          Configure
                        </button>
                        <button
                          className="btn btn-outline-info btn-sm me-2"
                          onClick={() => openEmailPreview(client)}
                        >
                          Preview
                        </button>
                        <button
                          className="btn btn-outline-success btn-sm"
                          disabled={testingEmail === client.id}
                          onClick={() => sendTestEmail(client)}
                        >
                          {testingEmail === client.id ? (
                            <span className="spinner-border spinner-border-sm me-2" />
                          ) : null}
                          Send Test Email
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          {/* Email Preview Modal (side-by-side) */}
          {showEmailPreview &&
            emailPreviewClient &&
            (() => {
              const emailSettings =
                emailPreviewClient.printConfig?.emailSettings;
              const preview = generateEmailPreview(emailPreviewClient);
              return (
                <div className="card">
                  <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">
                      📧 Email Preview - {emailPreviewClient.name}
                    </h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      onClick={() => {
                        setShowEmailPreview(false);
                        setEmailPreviewClient(null);
                      }}
                    ></button>
                  </div>
                  <div className="card-body">
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
                                <span className="text-warning">
                                  No email address
                                </span>
                              )}
                            </div>
                            {emailSettings?.ccEmails &&
                              emailSettings.ccEmails.length > 0 && (
                                <div className="mb-2">
                                  <strong>CC:</strong>{" "}
                                  {emailSettings.ccEmails.join(", ")}
                                </div>
                              )}
                            <div className="mb-2">
                              <strong>From:</strong> emperez@kinguniforms.net
                            </div>
                            <div className="mb-2">
                              <strong>Billing Type:</strong>{" "}
                              {emailPreviewClient.billingCalculation ===
                              "byWeight" ? (
                                <span className="badge bg-info">By Weight</span>
                              ) : (
                                <span className="badge bg-secondary">
                                  By Piece
                                </span>
                              )}
                            </div>
                            <div className="mb-2">
                              <strong>Auto-send:</strong>
                              <div className="mt-1">
                                {emailSettings?.autoSendOnApproval && (
                                  <span className="badge bg-primary me-1">
                                    On Approval
                                  </span>
                                )}
                                {emailSettings?.autoSendOnShipping && (
                                  <span className="badge bg-success me-1">
                                    On Shipping
                                  </span>
                                )}
                                {!emailSettings?.autoSendOnApproval &&
                                  !emailSettings?.autoSendOnShipping && (
                                    <span className="badge bg-info">
                                      Manual Only
                                    </span>
                                  )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="card">
                          <div className="card-header bg-light">
                            <h6 className="mb-0">🔧 Configuration Status</h6>
                          </div>
                          <div className="card-body">
                            <div className="mb-2">
                              <strong>Email Enabled:</strong>
                              <span
                                className={`badge ms-1 ${
                                  emailSettings?.enabled
                                    ? "bg-success"
                                    : "bg-danger"
                                }`}
                              >
                                {emailSettings?.enabled ? "Yes" : "No"}
                              </span>
                            </div>
                            <div className="mb-2">
                              <strong>Custom Subject:</strong>
                              <span
                                className={`badge ms-1 ${
                                  emailSettings?.subject
                                    ? "bg-info"
                                    : "bg-secondary"
                                }`}
                              >
                                {emailSettings?.subject ? "Yes" : "Default"}
                              </span>
                            </div>
                            <div className="mb-2">
                              <strong>Custom Template:</strong>
                              <span
                                className={`badge ms-1 ${
                                  emailSettings?.bodyTemplate
                                    ? "bg-info"
                                    : "bg-secondary"
                                }`}
                              >
                                {emailSettings?.bodyTemplate
                                  ? "Yes"
                                  : "Default"}
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
                              <li>{"{invoiceNumber}"} - Invoice number</li>
                              <li>{"{invoiceDate}"} - Invoice date</li>
                              <li>{"{totalAmount}"} - Total amount</li>
                              <li>{"{cartCount}"} - Number of carts</li>
                              <li>{"{clientEmail}"} - Client email</li>
                              <li>
                                {"{processingSummary}"} - Processing summary
                                (weight or items)
                              </li>
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
                </div>
              );
            })()}

          {/* Instructions if no preview is shown */}
          {!showEmailPreview && (
            <div className="card">
              <div className="card-header bg-info text-white">
                <h5 className="mb-0">💡 How Email Content Works</h5>
              </div>
              <div className="card-body">
                <h6 className="mb-3">Based on Client Billing Type:</h6>

                <div className="alert alert-primary">
                  <strong>For clients billed by weight:</strong>
                  <p>Emails will include the total pounds processed</p>
                  <div className="bg-light p-2 rounded">
                    <small>
                      <strong>Example:</strong> Total Pounds Processed: 125.50
                      lbs
                    </small>
                  </div>
                </div>

                <div className="alert alert-secondary">
                  <strong>For clients billed by piece:</strong>
                  <p>Emails will include an itemized list of processed items</p>
                  <div className="bg-light p-2 rounded">
                    <small>
                      <strong>Example:</strong>
                      <br />
                      Items Processed:
                      <br />
                      - Scrub Shirts: 10 pieces
                      <br />- Scrub Pants: 8 pieces
                    </small>
                  </div>
                </div>

                <p className="mt-3">
                  Click "Preview" next to any client to see how their email will
                  look. You can customize templates for each client by clicking
                  "Configure".
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

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
                  <label htmlFor="ccEmails" className="form-label">
                    CC Emails (comma-separated)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="ccEmails"
                    value={
                      selectedClient.printConfig?.emailSettings?.ccEmails?.join(
                        ", "
                      ) || ""
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
                            ccEmails: e.target.value
                              .split(",")
                              .map((email) => email.trim())
                              .filter((email) => email),
                          },
                        },
                      });
                    }}
                    placeholder="admin@example.com, manager@example.com"
                  />
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
                        subject: "",
                        bodyTemplate: "",
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
    </div>
  );
};

export default PrintingSettings;
