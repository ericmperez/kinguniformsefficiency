import React, { useState, useEffect } from 'react';
import { Client, PrintConfiguration } from '../types';

interface PrintConfigModalProps {
  show: boolean;
  onClose: () => void;
  client: Client | null;
  onSave: (clientId: string, config: PrintConfiguration) => void;
}

const PrintConfigModal: React.FC<PrintConfigModalProps> = ({
  show,
  onClose,
  client,
  onSave
}) => {
  const getDefaultConfig = (): PrintConfiguration => ({
    cartPrintSettings: {
      enabled: true,
      showProductDetails: true,
      showProductSummary: false,
      showQuantities: true,
      showPrices: false,
      showCartTotal: true,
      includeTimestamp: true,
      headerText: "",
      footerText: "",
      clientNameFontSize: "large",
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
      headerText: "",
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
  });

  const [config, setConfig] = useState<PrintConfiguration>(getDefaultConfig());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setConfig(client.printConfig || getDefaultConfig());
    }
  }, [client]);

  const handleSave = async () => {
    if (!client) return;
    
    setSaving(true);
    try {
      await onSave(client.id, config);
      onClose();
    } catch (error) {
      console.error('Error saving print configuration:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!show || !client) return null;

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}>
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
        <div className="modal-content" style={{ height: '100%' }}>
          <div 
            className="modal-header text-white"
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '1.5rem'
            }}
          >
            <h5 className="modal-title fw-bold" style={{ fontSize: "1.4rem" }}>
              <i className="bi bi-gear-fill me-3"></i>
              Print Configuration - {client.name}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
            ></button>
          </div>
          
          <div className="modal-body" style={{ overflow: "auto", padding: "1.5rem" }}>
            <div className="row">
              <div className="col-md-6">
                <div className="card h-100">
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
                        onChange={(e) => setConfig({
                          ...config,
                          cartPrintSettings: {
                            ...config.cartPrintSettings,
                            enabled: e.target.checked,
                          },
                        })}
                      />
                      <label className="form-check-label" htmlFor="cartEnabled">
                        Enable cart printing
                      </label>
                    </div>

                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="showQuantities"
                        checked={config.cartPrintSettings.showQuantities}
                        onChange={(e) => setConfig({
                          ...config,
                          cartPrintSettings: {
                            ...config.cartPrintSettings,
                            showQuantities: e.target.checked,
                          },
                        })}
                      />
                      <label className="form-check-label" htmlFor="showQuantities">
                        Show quantities
                      </label>
                    </div>

                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="showProductDetails"
                        checked={config.cartPrintSettings.showProductDetails}
                        onChange={(e) => setConfig({
                          ...config,
                          cartPrintSettings: {
                            ...config.cartPrintSettings,
                            showProductDetails: e.target.checked,
                          },
                        })}
                      />
                      <label className="form-check-label" htmlFor="showProductDetails">
                        Show product details
                      </label>
                    </div>

                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="showPrices"
                        checked={config.cartPrintSettings.showPrices}
                        onChange={(e) => setConfig({
                          ...config,
                          cartPrintSettings: {
                            ...config.cartPrintSettings,
                            showPrices: e.target.checked,
                          },
                        })}
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
                        onChange={(e) => setConfig({
                          ...config,
                          cartPrintSettings: {
                            ...config.cartPrintSettings,
                            showCartTotal: e.target.checked,
                          },
                        })}
                      />
                      <label className="form-check-label" htmlFor="showCartTotal">
                        Show cart total
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card h-100">
                  <div className="card-header">
                    <h6 className="mb-0">Invoice Print Settings</h6>
                  </div>
                  <div className="card-body">
                    <div className="form-check mb-3">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="invoiceEnabled"
                        checked={config.invoicePrintSettings.enabled}
                        onChange={(e) => setConfig({
                          ...config,
                          invoicePrintSettings: {
                            ...config.invoicePrintSettings,
                            enabled: e.target.checked,
                          },
                        })}
                      />
                      <label className="form-check-label" htmlFor="invoiceEnabled">
                        Enable invoice printing
                      </label>
                    </div>

                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="showCartBreakdown"
                        checked={config.invoicePrintSettings.showCartBreakdown}
                        onChange={(e) => setConfig({
                          ...config,
                          invoicePrintSettings: {
                            ...config.invoicePrintSettings,
                            showCartBreakdown: e.target.checked,
                          },
                        })}
                      />
                      <label className="form-check-label" htmlFor="showCartBreakdown">
                        Show cart breakdown
                      </label>
                    </div>

                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="showTotalWeight"
                        checked={config.invoicePrintSettings.showTotalWeight}
                        onChange={(e) => setConfig({
                          ...config,
                          invoicePrintSettings: {
                            ...config.invoicePrintSettings,
                            showTotalWeight: e.target.checked,
                          },
                        })}
                      />
                      <label className="form-check-label" htmlFor="showTotalWeight">
                        Show total weight
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Saving...
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg me-2"></i>
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
