import React, { useState } from "react";
import { Client, PrintConfiguration } from "../types";

interface PrintConfigModalProps {
  show: boolean;
  onClose: () => void;
  client: Client | null; // Allow null for default template editing
  onSave: (clientId: string, printConfig: PrintConfiguration) => Promise<void>;
  initialConfig?: PrintConfiguration; // Optional initial config for default template editing
}

const PrintConfigModal: React.FC<PrintConfigModalProps> = ({
  show,
  onClose,
  client,
  onSave,
  initialConfig,
}) => {
  const [config, setConfig] = useState<PrintConfiguration>(
    initialConfig ||
      client?.printConfig || {
        cartPrintSettings: {
          enabled: true,
          showProductDetails: true,
          showQuantities: true,
          showPrices: false,
          showCartTotal: true,
          includeTimestamp: true,
          headerText: "Cart Contents",
          footerText: "",
        },
        invoicePrintSettings: {
          enabled: true,
          showClientInfo: true,
          showInvoiceNumber: true,
          showDate: true,
          showPickupDate: false,
          showCartBreakdown: true,
          showProductSummary: true,
          showTotalWeight: false,
          showSubtotal: true,
          showTaxes: false,
          showGrandTotal: true,
          includeSignature: false,
          headerText: "Invoice",
          footerText: "",
          logoUrl: "",
        },
        emailSettings: {
          enabled: false,
          autoSendOnApproval: false,
          autoSendOnShipping: false,
          autoSendOnSignature: false,
          ccEmails: [],
          subject: "",
          bodyTemplate: "",
          signatureEmailSubject: "",
          signatureEmailTemplate: "",
        },
      }
  );

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(client?.id || "", config);
      onClose();
    } catch (error) {
      console.error("Error saving print configuration:", error);
      alert("Error saving configuration");
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal show d-block" tabIndex={-1}>
      <div className="modal-dialog modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {client
                ? `Print Configuration - ${client.name}`
                : "Default Print Template Configuration"}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            <div className="row">
              {/* Cart Print Settings */}
              <div className="col-md-6">
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">Cart Print Settings</h6>
                  </div>
                  <div className="card-body">
                    <div className="form-check mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="cartEnabled"
                        checked={config.cartPrintSettings.enabled}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            cartPrintSettings: {
                              ...config.cartPrintSettings,
                              enabled: e.target.checked,
                            },
                          })
                        }
                      />
                      <label className="form-check-label" htmlFor="cartEnabled">
                        Enable cart printing
                      </label>
                    </div>

                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="showProductDetails"
                        checked={config.cartPrintSettings.showProductDetails}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            cartPrintSettings: {
                              ...config.cartPrintSettings,
                              showProductDetails: e.target.checked,
                            },
                          })
                        }
                      />
                      <label
                        className="form-check-label"
                        htmlFor="showProductDetails"
                      >
                        Show product details
                      </label>
                    </div>

                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="showQuantities"
                        checked={config.cartPrintSettings.showQuantities}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            cartPrintSettings: {
                              ...config.cartPrintSettings,
                              showQuantities: e.target.checked,
                            },
                          })
                        }
                      />
                      <label
                        className="form-check-label"
                        htmlFor="showQuantities"
                      >
                        Show quantities
                      </label>
                    </div>

                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="showPrices"
                        checked={config.cartPrintSettings.showPrices}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            cartPrintSettings: {
                              ...config.cartPrintSettings,
                              showPrices: e.target.checked,
                            },
                          })
                        }
                      />
                      <label className="form-check-label" htmlFor="showPrices">
                        Show prices
                      </label>
                    </div>

                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="showCartTotal"
                        checked={config.cartPrintSettings.showCartTotal}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            cartPrintSettings: {
                              ...config.cartPrintSettings,
                              showCartTotal: e.target.checked,
                            },
                          })
                        }
                      />
                      <label
                        className="form-check-label"
                        htmlFor="showCartTotal"
                      >
                        Show cart total
                      </label>
                    </div>

                    <div className="form-check mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="includeTimestamp"
                        checked={config.cartPrintSettings.includeTimestamp}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            cartPrintSettings: {
                              ...config.cartPrintSettings,
                              includeTimestamp: e.target.checked,
                            },
                          })
                        }
                      />
                      <label
                        className="form-check-label"
                        htmlFor="includeTimestamp"
                      >
                        Include timestamp
                      </label>
                    </div>

                    <div className="mb-3">
                      <label htmlFor="cartHeaderText" className="form-label">
                        Header Text
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="cartHeaderText"
                        value={config.cartPrintSettings.headerText || ""}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            cartPrintSettings: {
                              ...config.cartPrintSettings,
                              headerText: e.target.value,
                            },
                          })
                        }
                      />
                    </div>

                    <div className="mb-3">
                      <label htmlFor="cartFooterText" className="form-label">
                        Footer Text
                      </label>
                      <textarea
                        className="form-control"
                        id="cartFooterText"
                        rows={2}
                        value={config.cartPrintSettings.footerText || ""}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            cartPrintSettings: {
                              ...config.cartPrintSettings,
                              footerText: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice Print Settings */}
              <div className="col-md-6">
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">Laundry Ticket Print Settings</h6>
                  </div>
                  <div className="card-body">
                    <div className="form-check mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="invoiceEnabled"
                        checked={config.invoicePrintSettings.enabled}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            invoicePrintSettings: {
                              ...config.invoicePrintSettings,
                              enabled: e.target.checked,
                            },
                          })
                        }
                      />
                      <label
                        className="form-check-label"
                        htmlFor="invoiceEnabled"
                      >
                        Enable invoice printing
                      </label>
                    </div>

                    <div className="row">
                      <div className="col-6">
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="showClientInfo"
                            checked={config.invoicePrintSettings.showClientInfo}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                invoicePrintSettings: {
                                  ...config.invoicePrintSettings,
                                  showClientInfo: e.target.checked,
                                },
                              })
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="showClientInfo"
                          >
                            Show client info
                          </label>
                        </div>

                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="showInvoiceNumber"
                            checked={
                              config.invoicePrintSettings.showInvoiceNumber
                            }
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                invoicePrintSettings: {
                                  ...config.invoicePrintSettings,
                                  showInvoiceNumber: e.target.checked,
                                },
                              })
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="showInvoiceNumber"
                          >
                            Show invoice number
                          </label>
                        </div>

                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="showDate"
                            checked={config.invoicePrintSettings.showDate}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                invoicePrintSettings: {
                                  ...config.invoicePrintSettings,
                                  showDate: e.target.checked,
                                },
                              })
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="showDate"
                          >
                            Show date
                          </label>
                        </div>

                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="showCartBreakdown"
                            checked={
                              config.invoicePrintSettings.showCartBreakdown
                            }
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                invoicePrintSettings: {
                                  ...config.invoicePrintSettings,
                                  showCartBreakdown: e.target.checked,
                                },
                              })
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="showCartBreakdown"
                          >
                            Show cart breakdown
                          </label>
                        </div>

                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="showProductSummary"
                            checked={
                              config.invoicePrintSettings.showProductSummary
                            }
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                invoicePrintSettings: {
                                  ...config.invoicePrintSettings,
                                  showProductSummary: e.target.checked,
                                },
                              })
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="showProductSummary"
                          >
                            Show product summary
                          </label>
                        </div>

                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="showTotalWeight"
                            checked={
                              config.invoicePrintSettings.showTotalWeight
                            }
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                invoicePrintSettings: {
                                  ...config.invoicePrintSettings,
                                  showTotalWeight: e.target.checked,
                                },
                              })
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="showTotalWeight"
                          >
                            Show total weight
                          </label>
                        </div>
                      </div>

                      <div className="col-6">
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="showSubtotal"
                            checked={config.invoicePrintSettings.showSubtotal}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                invoicePrintSettings: {
                                  ...config.invoicePrintSettings,
                                  showSubtotal: e.target.checked,
                                },
                              })
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="showSubtotal"
                          >
                            Show subtotal
                          </label>
                        </div>

                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="showTaxes"
                            checked={config.invoicePrintSettings.showTaxes}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                invoicePrintSettings: {
                                  ...config.invoicePrintSettings,
                                  showTaxes: e.target.checked,
                                },
                              })
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="showTaxes"
                          >
                            Show taxes
                          </label>
                        </div>

                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="showGrandTotal"
                            checked={config.invoicePrintSettings.showGrandTotal}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                invoicePrintSettings: {
                                  ...config.invoicePrintSettings,
                                  showGrandTotal: e.target.checked,
                                },
                              })
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="showGrandTotal"
                          >
                            Show grand total
                          </label>
                        </div>

                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="includeSignature"
                            checked={
                              config.invoicePrintSettings.includeSignature
                            }
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                invoicePrintSettings: {
                                  ...config.invoicePrintSettings,
                                  includeSignature: e.target.checked,
                                },
                              })
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="includeSignature"
                          >
                            Include signature line
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label htmlFor="invoiceHeaderText" className="form-label">
                        Header Text
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="invoiceHeaderText"
                        value={config.invoicePrintSettings.headerText || ""}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            invoicePrintSettings: {
                              ...config.invoicePrintSettings,
                              headerText: e.target.value,
                            },
                          })
                        }
                      />
                    </div>

                    <div className="mb-3">
                      <label htmlFor="logoUrl" className="form-label">
                        Logo URL
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        id="logoUrl"
                        value={config.invoicePrintSettings.logoUrl || ""}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            invoicePrintSettings: {
                              ...config.invoicePrintSettings,
                              logoUrl: e.target.value,
                            },
                          })
                        }
                      />
                    </div>

                    <div className="mb-3">
                      <label htmlFor="invoiceFooterText" className="form-label">
                        Footer Text
                      </label>
                      <textarea
                        className="form-control"
                        id="invoiceFooterText"
                        rows={2}
                        value={config.invoicePrintSettings.footerText || ""}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            invoicePrintSettings: {
                              ...config.invoicePrintSettings,
                              footerText: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Settings */}
            <div className="row mt-3">
              <div className="col-12">
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">Email Settings</h6>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      {/* Configuration Panel */}
                      <div className="col-md-6">
                        <h6 className="text-primary mb-3">Configuration</h6>

                        <div className="form-check mb-3">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="emailEnabled"
                            checked={config.emailSettings.enabled}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                emailSettings: {
                                  ...config.emailSettings,
                                  enabled: e.target.checked,
                                },
                              })
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="emailEnabled"
                          >
                            Enable email functionality
                          </label>
                        </div>

                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="autoSendOnApproval"
                            checked={config.emailSettings.autoSendOnApproval}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                emailSettings: {
                                  ...config.emailSettings,
                                  autoSendOnApproval: e.target.checked,
                                },
                              })
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor="autoSendOnApproval"
                          >
                            Auto-send on approval
                          </label>
                        </div>

                        <div className="form-check mb-3">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="autoSendOnShipping"
                            checked={config.emailSettings.autoSendOnShipping}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                emailSettings: {
                                  ...config.emailSettings,
                                  autoSendOnShipping: e.target.checked,
                                },
                              })
                            }
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
                            checked={config.emailSettings.autoSendOnSignature}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                emailSettings: {
                                  ...config.emailSettings,
                                  autoSendOnSignature: e.target.checked,
                                },
                              })
                            }
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
                            value={config.emailSettings.subject || ""}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                emailSettings: {
                                  ...config.emailSettings,
                                  subject: e.target.value,
                                },
                              })
                            }
                            placeholder="Invoice #{invoiceNumber} for {clientName}"
                          />
                        </div>

                        <div className="mb-3">
                          <label className="form-label">
                            CC Emails
                            <small className="text-muted ms-2">(Additional recipients)</small>
                          </label>
                          
                          {/* Existing CC Email inputs */}
                          {(config.emailSettings.ccEmails || []).map((email, index) => (
                            <div key={index} className="input-group mb-2">
                              <input
                                type="email"
                                className="form-control"
                                value={email}
                                onChange={(e) => {
                                  const newCcEmails = [...(config.emailSettings.ccEmails || [])];
                                  newCcEmails[index] = e.target.value;
                                  setConfig({
                                    ...config,
                                    emailSettings: {
                                      ...config.emailSettings,
                                      ccEmails: newCcEmails,
                                    },
                                  });
                                }}
                                placeholder={`cc-email-${index + 1}@example.com`}
                              />
                              <button
                                className="btn btn-outline-danger"
                                type="button"
                                onClick={() => {
                                  const newCcEmails = (config.emailSettings.ccEmails || []).filter((_, i) => i !== index);
                                  setConfig({
                                    ...config,
                                    emailSettings: {
                                      ...config.emailSettings,
                                      ccEmails: newCcEmails,
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
                              const newCcEmails = [...(config.emailSettings.ccEmails || []), ""];
                              setConfig({
                                ...config,
                                emailSettings: {
                                  ...config.emailSettings,
                                  ccEmails: newCcEmails,
                                },
                              });
                            }}
                          >
                            <i className="bi bi-plus-circle me-1"></i>
                            Add CC Email
                          </button>
                          
                          {(config.emailSettings.ccEmails || []).length === 0 && (
                            <div className="text-muted small mt-1">
                              Click "Add CC Email" to include additional recipients on all emails
                            </div>
                          )}
                        </div>

                        <div className="mb-3">
                          <label
                            htmlFor="emailBodyTemplate"
                            className="form-label"
                          >
                            Email Body Template
                          </label>
                          <textarea
                            className="form-control"
                            id="emailBodyTemplate"
                            rows={6}
                            value={config.emailSettings.bodyTemplate || ""}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                emailSettings: {
                                  ...config.emailSettings,
                                  bodyTemplate: e.target.value,
                                },
                              })
                            }
                            placeholder="Dear {clientName}, please find attached your invoice #{invoiceNumber}..."
                          />
                          <div className="form-text">
                            Available placeholders:{" "}
                            <code>{"{clientName}"}</code>,{" "}
                            <code>{"{invoiceNumber}"}</code> - Laundry Ticket number,{" "}
                            <code>{"{date}"}</code>,{" "}
                            <code>{"{truckNumber}"}</code>,{" "}
                            <code>{"{deliveryDate}"}</code>
                          </div>
                        </div>

                        {/* Signature Email Settings */}
                        <div className="mb-3">
                          <label
                            htmlFor="signatureEmailSubject"
                            className="form-label"
                          >
                            <strong>Signature Email Subject</strong>
                            <small className="text-muted ms-2">(Optional - different from regular emails)</small>
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            id="signatureEmailSubject"
                            value={config.emailSettings.signatureEmailSubject || ""}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                emailSettings: {
                                  ...config.emailSettings,
                                  signatureEmailSubject: e.target.value,
                                },
                              })
                            }
                            placeholder="Delivery Confirmed - Invoice #{invoiceNumber} for {clientName}"
                          />
                        </div>

                        <div className="mb-3">
                          <label
                            htmlFor="signatureEmailTemplate"
                            className="form-label"
                          >
                            <strong>Signature Email Template</strong>
                            <small className="text-muted ms-2">(Optional - different from regular emails)</small>
                          </label>
                          <textarea
                            className="form-control"
                            id="signatureEmailTemplate"
                            rows={6}
                            value={config.emailSettings.signatureEmailTemplate || ""}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                emailSettings: {
                                  ...config.emailSettings,
                                  signatureEmailTemplate: e.target.value,
                                },
                              })
                            }
                            placeholder="Dear {clientName}, your delivery has been completed and signed for by {receivedBy}..."
                          />
                          <div className="form-text">
                            Additional signature placeholders:{" "}
                            <code>{"{receivedBy}"}</code>,{" "}
                            <code>{"{signatureDate}"}</code>,{" "}
                            <code>{"{signatureTime}"}</code>
                          </div>
                        </div>
                      </div>

                      {/* Email Preview Panel */}
                      <div className="col-md-6">
                        <h6 className="text-primary mb-3">Email Preview</h6>

                        <div
                          className="border rounded p-3"
                          style={{
                            backgroundColor: "#f8f9fa",
                            minHeight: "400px",
                            fontFamily: "Arial, sans-serif",
                          }}
                        >
                          {/* Email Header */}
                          <div
                            className="border-bottom pb-2 mb-3"
                            style={{ borderColor: "#dee2e6" }}
                          >
                            <div className="row">
                              <div className="col-3 text-muted small">
                                From:
                              </div>
                              <div className="col-9 small">
                                emperez@kinguniforms.net
                              </div>
                            </div>
                            <div className="row">
                              <div className="col-3 text-muted small">To:</div>
                              <div className="col-9 small">
                                {client?.email || "client@example.com"}
                              </div>
                            </div>
                            {config.emailSettings.ccEmails &&
                              config.emailSettings.ccEmails.filter(email => email && email.trim() !== "").length > 0 && (
                                <div className="row">
                                  <div className="col-3 text-muted small">
                                    CC:
                                  </div>
                                  <div className="col-9 small">
                                    {config.emailSettings.ccEmails.filter(email => email && email.trim() !== "").join(", ")}
                                  </div>
                                </div>
                              )}
                            <div className="row">
                              <div className="col-3 text-muted small">
                                Subject:
                              </div>
                              <div className="col-9 small font-weight-bold">
                                {config.emailSettings.subject
                                  ? config.emailSettings.subject
                                      .replace(
                                        /\{clientName\}/g,
                                        client?.name || "ABC Company"
                                      )
                                      .replace(
                                        /\{invoiceNumber\}/g,
                                        "INV-2024-001"
                                      )
                                      .replace(
                                        /\{date\}/g,
                                        new Date().toLocaleDateString()
                                      )
                                      .replace(/\{truckNumber\}/g, "Truck 5")
                                      .replace(
                                        /\{deliveryDate\}/g,
                                        new Date().toLocaleDateString()
                                      )
                                  : "Invoice #INV-2024-001 for " +
                                    (client?.name || "ABC Company")}
                              </div>
                            </div>
                          </div>

                          {/* Email Body */}
                          <div
                            className="email-body"
                            style={{
                              whiteSpace: "pre-wrap",
                              lineHeight: "1.5",
                              fontSize: "14px",
                            }}
                          >
                            {config.emailSettings.bodyTemplate
                              ? config.emailSettings.bodyTemplate
                                  .replace(
                                    /\{clientName\}/g,
                                    client?.name || "ABC Company"
                                  )
                                  .replace(/\{invoiceNumber\}/g, "INV-2024-001")
                                  .replace(
                                    /\{date\}/g,
                                    new Date().toLocaleDateString()
                                  )
                                  .replace(/\{truckNumber\}/g, "Truck 5")
                                  .replace(
                                    /\{deliveryDate\}/g,
                                    new Date().toLocaleDateString()
                                  )
                              : `Dear ${client?.name || "ABC Company"},

Please find attached your invoice #INV-2024-001 dated ${new Date().toLocaleDateString()}.

If you have any questions regarding this invoice, please don't hesitate to contact us.

Best regards,
King Uniforms Team`}
                          </div>

                          {/* Attachment indicator */}
                          <div
                            className="mt-3 pt-2 border-top"
                            style={{ borderColor: "#dee2e6" }}
                          >
                            <div className="d-flex align-items-center text-muted small">
                              <i className="bi bi-paperclip me-2"></i>
                              <span>📎 laundry-ticket.pdf (attached)</span>
                            </div>
                          </div>

                          {/* Status indicator */}
                          <div className="mt-3">
                            <span
                              className={`badge ${
                                config.emailSettings.enabled
                                  ? "bg-success"
                                  : "bg-secondary"
                              }`}
                            >
                              {config.emailSettings.enabled
                                ? "✓ Email Enabled"
                                : "✗ Email Disabled"}
                            </span>
                            {config.emailSettings.autoSendOnApproval && (
                              <span className="badge bg-info ms-2">
                                Auto-send on Approval
                              </span>
                            )}
                            {config.emailSettings.autoSendOnShipping && (
                              <span className="badge bg-warning ms-2">
                                Auto-send on Shipping
                              </span>
                            )}
                            {config.emailSettings.autoSendOnSignature && (
                              <span className="badge bg-success ms-2">
                                Auto-send on Signature
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintConfigModal;
