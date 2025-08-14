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
    pdfOptions: {
      scale: 0.75, // Reduced scale for smaller file sizes
      showSignatures: true,
      showTimestamp: false, // Reduced for smaller files
      showLocation: false,
      showQuantities: true,
      contentDisplay: 'summary', // Changed from detailed to summary
      paperSize: 'a4', // Changed from letter to a4
      orientation: 'portrait',
      margins: 'narrow', // Changed from normal to narrow
      fontSize: 'small', // Changed from medium to small
      showWatermark: false,
      headerText: '',
      footerText: '',
      logoSize: 'medium',
      showBorder: true,
      pagination: 'single'
    },
  });

  const [config, setConfig] = useState<PrintConfiguration>(getDefaultConfig());
  const [saving, setSaving] = useState(false);

  // Helper function to update PDF options with proper defaults
  const updatePdfOptions = (updates: Partial<PrintConfiguration['pdfOptions']>) => {
    const defaultPdfOptions = getDefaultConfig().pdfOptions;
    const currentPdfOptions = config.pdfOptions || defaultPdfOptions;
    setConfig({
      ...config,
      pdfOptions: {
        ...defaultPdfOptions,
        ...currentPdfOptions,
        ...updates
      } as PrintConfiguration['pdfOptions']
    });
  };

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

            {/* PDF Options Section */}
            <div className="row mt-4">
              <div className="col-12">
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">
                      <i className="bi bi-file-earmark-pdf me-2"></i>
                      PDF Generation Options
                    </h6>
                    <small className="text-muted">Customize how delivery ticket PDFs are generated for this client</small>
                  </div>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-md-4">
                        <h6 className="fw-bold text-primary mb-3">Layout & Size</h6>
                        
                        <div className="mb-3">
                          <label className="form-label small">Paper Size</label>
                          <select 
                            className="form-select form-select-sm"
                            value={config.pdfOptions?.paperSize || 'letter'}
                            onChange={(e) => updatePdfOptions({ paperSize: e.target.value as 'letter' | 'a4' | 'legal' })}
                          >
                            <option value="letter">Letter (8.5" × 11")</option>
                            <option value="a4">A4 (210 × 297 mm)</option>
                            <option value="legal">Legal (8.5" × 14")</option>
                          </select>
                        </div>

                        <div className="mb-3">
                          <label className="form-label small">Orientation</label>
                          <select 
                            className="form-select form-select-sm"
                            value={config.pdfOptions?.orientation || 'portrait'}
                            onChange={(e) => updatePdfOptions({ orientation: e.target.value as 'portrait' | 'landscape' })}
                          >
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Landscape</option>
                          </select>
                        </div>
                      </div>

                      <div className="col-md-4">
                        <h6 className="fw-bold text-primary mb-3">Display Options</h6>
                        
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="pdfShowTimestamp"
                            checked={config.pdfOptions?.showTimestamp !== false}
                            onChange={(e) => updatePdfOptions({ showTimestamp: e.target.checked })}
                          />
                          <label className="form-check-label small" htmlFor="pdfShowTimestamp">
                            Show Timestamp
                          </label>
                        </div>

                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="pdfShowLocation"
                            checked={config.pdfOptions?.showLocation === true}
                            onChange={(e) => updatePdfOptions({ showLocation: e.target.checked })}
                          />
                          <label className="form-check-label small" htmlFor="pdfShowLocation">
                            Show Location Info
                          </label>
                        </div>

                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="pdfShowQuantities"
                            checked={config.pdfOptions?.showQuantities !== false}
                            onChange={(e) => updatePdfOptions({ showQuantities: e.target.checked })}
                          />
                          <label className="form-check-label small" htmlFor="pdfShowQuantities">
                            Show Quantities
                          </label>
                        </div>
                      </div>

                      <div className="col-md-4">
                        <h6 className="fw-bold text-primary mb-3">Content & Style</h6>
                        
                        <div className="mb-3">
                          <label className="form-label small">Content Display</label>
                          <select 
                            className="form-select form-select-sm"
                            value={config.pdfOptions?.contentDisplay || 'detailed'}
                            onChange={(e) => updatePdfOptions({ contentDisplay: e.target.value as 'detailed' | 'summary' | 'weight-only' })}
                          >
                            <option value="detailed">Detailed Items List</option>
                            <option value="summary">Summary with Total Weight</option>
                            <option value="weight-only">Weight Only</option>
                          </select>
                        </div>

                        <div className="mb-3">
                          <label className="form-label small">Font Size</label>
                          <select 
                            className="form-select form-select-sm"
                            value={config.pdfOptions?.fontSize || 'medium'}
                            onChange={(e) => updatePdfOptions({ fontSize: e.target.value as 'small' | 'medium' | 'large' })}
                          >
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                          </select>
                        </div>
                      </div>
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
