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
          showProductSummary: false,
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
          logoUrl: "/images/King Uniforms Logo.png",
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
    <div 
      className="modal show d-block" 
      tabIndex={-1}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(3px)'
      }}
    >
      <div 
        className="modal-dialog" 
        style={{
          maxWidth: '70vw',
          width: '70vw',
          minWidth: '800px',
          margin: '2vh auto',
          height: '96vh'
        }}
      >
        <div 
          className="modal-content"
          style={{
            height: '100%',
            borderRadius: '12px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            border: 'none',
            overflow: 'hidden'
          }}
        >
          <div 
            className="modal-header"
            style={{
              background: 'linear-gradient(135deg, #0E62A0 0%, #1976d2 100%)',
              color: 'white',
              padding: '1.5rem 2rem',
              borderBottom: 'none'
            }}
          >
            <div className="d-flex align-items-center">
              <i className="bi bi-printer-fill me-3" style={{ fontSize: '1.5rem' }}></i>
              <h4 className="modal-title mb-0" style={{ fontWeight: '600', fontSize: '1.4rem' }}>
                {client
                  ? `Print Configuration - ${client.name}`
                  : "Default Print Template Configuration"}
              </h4>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Close"
              style={{
                fontSize: '1.2rem',
                opacity: 0.8
              }}
            ></button>
          </div>
          <div 
            className="modal-body"
            style={{
              padding: '2rem',
              height: 'calc(100% - 140px)',
              overflowY: 'auto',
              backgroundColor: '#f8f9fa'
            }}
          >
            <div className="row g-4">
              {/* Cart Print Settings */}
              <div className="col-md-6">
                <div 
                  className="card h-100"
                  style={{
                    borderRadius: '10px',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                    transition: 'transform 0.2s ease'
                  }}
                >
                  <div 
                    className="card-header"
                    style={{
                      backgroundColor: '#fff',
                      borderBottom: '2px solid #e9ecef',
                      borderRadius: '10px 10px 0 0',
                      padding: '1.25rem 1.5rem'
                    }}
                  >
                    <div className="d-flex align-items-center">
                      <i className="bi bi-cart-fill me-2 text-primary" style={{ fontSize: '1.2rem' }}></i>
                      <h6 className="mb-0 fw-bold text-dark">Cart Print Settings</h6>
                    </div>
                  </div>
                  <div 
                    className="card-body"
                    style={{
                      padding: '1.5rem'
                    }}
                  >
                    <div 
                      className="form-check mb-4 p-3"
                      style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        border: '1px solid #e9ecef'
                      }}
                    >
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
                        style={{
                          transform: 'scale(1.2)',
                          marginTop: '0.2rem'
                        }}
                      />
                      <label 
                        className="form-check-label fw-semibold ms-2" 
                        htmlFor="cartEnabled"
                        style={{ fontSize: '1.1rem' }}
                      >
                        <i className="bi bi-toggle-on me-2 text-success"></i>
                        Enable cart printing
                      </label>
                    </div>

                    <div 
                      className="border-top pt-3 mt-3 mb-3"
                      style={{
                        borderColor: '#e9ecef !important'
                      }}
                    >
                      <h6 className="text-secondary mb-3 fw-semibold">
                        <i className="bi bi-list-check me-2"></i>
                        Display Options
                      </h6>
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
                        id="cartShowProductSummary"
                        checked={config.cartPrintSettings.showProductSummary}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            cartPrintSettings: {
                              ...config.cartPrintSettings,
                              showProductSummary: e.target.checked,
                            },
                          })
                        }
                      />
                      <label
                        className="form-check-label"
                        htmlFor="cartShowProductSummary"
                      >
                        Show product summary
                      </label>
                    </div>

                    <div 
                      className="form-check mb-3 p-3"
                      style={{
                        backgroundColor: '#fff3cd',
                        borderRadius: '8px',
                        border: '2px solid #ffeaa7',
                        boxShadow: '0 2px 8px rgba(255, 193, 7, 0.2)'
                      }}
                    >
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
                        style={{
                          transform: 'scale(1.3)',
                          marginTop: '0.2rem'
                        }}
                      />
                      <label
                        className="form-check-label fw-bold ms-2"
                        htmlFor="showQuantities"
                        style={{ 
                          fontSize: '1.1rem',
                          color: '#856404'
                        }}
                      >
                        <i className="bi bi-123 me-2 text-warning"></i>
                        Show quantities
                        <small className="d-block text-muted mt-1" style={{ fontSize: '0.85rem', fontWeight: 'normal' }}>
                          Control whether quantities appear on printed cart contents
                        </small>
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

                    <div 
                      className="border-top pt-3 mt-4 mb-3"
                      style={{
                        borderColor: '#e9ecef !important'
                      }}
                    >
                      <h6 className="text-secondary mb-3 fw-semibold">
                        <i className="bi bi-card-text me-2"></i>
                        Custom Text
                      </h6>
                    </div>

                    <div className="mb-3">
                      <label htmlFor="cartHeaderText" className="form-label fw-semibold">
                        <i className="bi bi-arrow-up-circle me-1 text-info"></i>
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
                      <label htmlFor="cartFooterText" className="form-label fw-semibold">
                        <i className="bi bi-arrow-down-circle me-1 text-info"></i>
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

                    <div className="mb-3">
                      <label htmlFor="clientNameFontSize" className="form-label fw-semibold">
                        <i className="bi bi-fonts me-1 text-warning"></i>
                        Client Name Size
                      </label>
                      <select
                        className="form-select"
                        id="clientNameFontSize"
                        value={config.cartPrintSettings.clientNameFontSize || "large"}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            cartPrintSettings: {
                              ...config.cartPrintSettings,
                              clientNameFontSize: e.target.value as 'small' | 'medium' | 'large',
                            },
                          })
                        }
                      >
                        <option value="small">Small (28px)</option>
                        <option value="medium">Medium (35px)</option>
                        <option value="large">Large (45px)</option>
                      </select>
                      <div className="form-text text-muted">
                        <i className="bi bi-info-circle me-1"></i>
                        Choose the font size for the client name on printed cart labels
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice Print Settings */}
              <div className="col-md-6">
                <div 
                  className="card h-100"
                  style={{
                    borderRadius: '10px',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                    transition: 'transform 0.2s ease'
                  }}
                >
                  <div 
                    className="card-header"
                    style={{
                      backgroundColor: '#fff',
                      borderBottom: '2px solid #e9ecef',
                      borderRadius: '10px 10px 0 0',
                      padding: '1.25rem 1.5rem'
                    }}
                  >
                    <div className="d-flex align-items-center">
                      <i className="bi bi-file-earmark-text-fill me-2 text-success" style={{ fontSize: '1.2rem' }}></i>
                      <h6 className="mb-0 fw-bold text-dark">Laundry Ticket Print Settings</h6>
                    </div>
                  </div>
                  <div 
                    className="card-body"
                    style={{
                      padding: '1.5rem'
                    }}
                  >
                    <div 
                      className="form-check mb-4 p-3"
                      style={{
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        border: '1px solid #e9ecef'
                      }}
                    >
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
                        style={{
                          transform: 'scale(1.2)',
                          marginTop: '0.2rem'
                        }}
                      />
                      <label 
                        className="form-check-label fw-semibold ms-2" 
                        htmlFor="invoiceEnabled"
                        style={{ fontSize: '1.1rem' }}
                      >
                        <i className="bi bi-toggle-on me-2 text-success"></i>
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
            <div className="row mt-4">
              <div className="col-12">
                <div 
                  className="card"
                  style={{
                    borderRadius: '10px',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)'
                  }}
                >
                  <div 
                    className="card-header"
                    style={{
                      backgroundColor: '#fff',
                      borderBottom: '2px solid #e9ecef',
                      borderRadius: '10px 10px 0 0',
                      padding: '1.25rem 1.5rem'
                    }}
                  >
                    <div className="d-flex align-items-center">
                      <i className="bi bi-envelope-fill me-2 text-info" style={{ fontSize: '1.2rem' }}></i>
                      <h6 className="mb-0 fw-bold text-dark">Email Settings</h6>
                    </div>
                  </div>
                  <div 
                    className="card-body"
                    style={{
                      padding: '1.5rem'
                    }}
                  >
                    <div className="row">
                      {/* Configuration Panel */}
                      <div className="col-md-6">
                        <h6 className="text-primary mb-3">
                          <i className="bi bi-gear-fill me-2"></i>
                          Configuration
                        </h6>

                        <div 
                          className="form-check mb-4 p-3"
                          style={{
                            backgroundColor: '#f8f9fa',
                            borderRadius: '8px',
                            border: '1px solid #e9ecef'
                          }}
                        >
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
                            style={{
                              transform: 'scale(1.2)',
                              marginTop: '0.2rem'
                            }}
                          />
                          <label
                            className="form-check-label fw-semibold ms-2"
                            htmlFor="emailEnabled"
                            style={{ fontSize: '1.1rem' }}
                          >
                            <i className="bi bi-toggle-on me-2 text-success"></i>
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
          <div 
            className="modal-footer"
            style={{
              backgroundColor: '#fff',
              borderTop: '2px solid #e9ecef',
              padding: '1.5rem 2rem',
              borderRadius: '0 0 12px 12px'
            }}
          >
            <button
              type="button"
              className="btn btn-outline-secondary btn-lg px-4"
              onClick={onClose}
              disabled={saving}
              style={{
                borderRadius: '8px',
                fontWeight: '500'
              }}
            >
              <i className="bi bi-x-circle me-2"></i>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg px-4"
              onClick={handleSave}
              disabled={saving}
              style={{
                borderRadius: '8px',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #0E62A0 0%, #1976d2 100%)',
                border: 'none',
                boxShadow: '0 4px 15px rgba(14, 98, 160, 0.3)'
              }}
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Saving...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle-fill me-2"></i>
                  Save Configuration
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintConfigModal;
