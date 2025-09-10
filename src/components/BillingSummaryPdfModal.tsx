import React, { useState } from 'react';
import { 
  BillingSummarySettings, 
  DEFAULT_BILLING_SUMMARY_SETTINGS,
  generateBillingSummaryPDF 
} from '../services/billingSummaryPdfService';
import { Invoice, Client, Product } from '../types';

interface BillingSummaryPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedInvoices: Invoice[];
  clients: Client[];
  products: Product[];
  chargeSettings?: any;
  onGenerated?: (pdfDataUri: string, settings: BillingSummarySettings) => void;
}

export default function BillingSummaryPdfModal({
  isOpen,
  onClose,
  selectedInvoices,
  clients,
  products,
  chargeSettings,
  onGenerated
}: BillingSummaryPdfModalProps) {
  const [settings, setSettings] = useState<BillingSummarySettings>(DEFAULT_BILLING_SUMMARY_SETTINGS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (!isOpen) return null;

  const handleSettingChange = (key: keyof BillingSummarySettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async () => {
    if (selectedInvoices.length === 0) {
      alert('Please select at least one invoice to include in the PDF summary.');
      return;
    }

    setIsGenerating(true);
    try {
      console.log('🔄 Generating PDF with settings:', settings);
      const pdfDataUri = await generateBillingSummaryPDF(
        selectedInvoices,
        clients,
        products,
        settings,
        chargeSettings
      );
      
      if (onGenerated) {
        onGenerated(pdfDataUri, settings);
      } else {
        // Default: download the PDF
        const link = document.createElement('a');
        link.href = pdfDataUri;
        const filename = `${settings.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        link.download = filename;
        link.click();
      }
      
      onClose();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF summary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = () => {
    setShowPreview(!showPreview);
  };

  return (
    <div 
      className="modal show d-block" 
      style={{ 
        backgroundColor: 'rgba(0,0,0,0.6)', 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '1rem'
      }}
    >
      <div 
        className="modal-dialog" 
        style={{ 
          maxWidth: '1200px', 
          width: '100%', 
          margin: '0',
          maxHeight: '90vh'
        }}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="bi bi-file-earmark-pdf me-2"></i>
              Generate PDF Summary Report
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={isGenerating}
            ></button>
          </div>

          <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', padding: '1.5rem' }}>
            {selectedInvoices.length === 0 && (
              <div className="alert alert-warning mb-3">
                <i className="bi bi-exclamation-triangle me-2"></i>
                <strong>No invoices selected!</strong> Please go back to the billing page and select some invoices to generate a PDF summary.
              </div>
            )}
            <div className="row g-3">
              {/* Left Column - Settings */}
              <div className="col-lg-8 col-md-12">
                <div className="row g-3">
                  {/* Basic Settings */}
                  <div className="col-xl-6 col-md-12">
                    <div className="card mb-3 h-100">
                      <div className="card-header">
                        <h6 className="mb-0">Basic Settings</h6>
                      </div>
                      <div className="card-body">
                        <div className="mb-3">
                          <label className="form-label">Title</label>
                          <input
                            type="text"
                            className="form-control"
                            value={settings.title}
                            onChange={(e) => handleSettingChange('title', e.target.value)}
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Subtitle</label>
                          <input
                            type="text"
                            className="form-control"
                            value={settings.subtitle}
                            onChange={(e) => handleSettingChange('subtitle', e.target.value)}
                          />
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Paper Size</label>
                          <select
                            className="form-select"
                            value={settings.paperSize}
                            onChange={(e) => handleSettingChange('paperSize', e.target.value as 'letter' | 'a4' | 'legal')}
                          >
                            <option value="letter">Letter</option>
                            <option value="a4">A4</option>
                            <option value="legal">Legal</option>
                          </select>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Orientation</label>
                          <select
                            className="form-select"
                            value={settings.orientation}
                            onChange={(e) => handleSettingChange('orientation', e.target.value as 'portrait' | 'landscape')}
                          >
                            <option value="portrait">Portrait</option>
                            <option value="landscape">Landscape</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Content Settings */}
                  <div className="col-xl-6 col-md-12">
                    <div className="card mb-3 h-100">
                      <div className="card-header">
                        <h6 className="mb-0">Content Options</h6>
                      </div>
                      <div className="card-body">
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={settings.includeDateRange}
                            onChange={(e) => handleSettingChange('includeDateRange', e.target.checked)}
                            id="includeDateRange"
                          />
                          <label className="form-check-label" htmlFor="includeDateRange">
                            Include Date Range
                          </label>
                        </div>
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={settings.includeStatistics}
                            onChange={(e) => handleSettingChange('includeStatistics', e.target.checked)}
                            id="includeStatistics"
                          />
                          <label className="form-check-label" htmlFor="includeStatistics">
                            Include Statistics Summary
                          </label>
                        </div>
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={settings.includeSummaryTable}
                            onChange={(e) => handleSettingChange('includeSummaryTable', e.target.checked)}
                            id="includeSummaryTable"
                          />
                          <label className="form-check-label" htmlFor="includeSummaryTable">
                            Include Client Summary Table
                          </label>
                        </div>
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={settings.includeInvoiceList}
                            onChange={(e) => handleSettingChange('includeInvoiceList', e.target.checked)}
                            id="includeInvoiceList"
                          />
                          <label className="form-check-label" htmlFor="includeInvoiceList">
                            Include Detailed Invoice List
                          </label>
                        </div>
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={settings.includeChargeDetails}
                            onChange={(e) => handleSettingChange('includeChargeDetails', e.target.checked)}
                            id="includeChargeDetails"
                          />
                          <label className="form-check-label" htmlFor="includeChargeDetails">
                            Include Charge Breakdown
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Display Settings */}
                  <div className="col-md-6">
                    <div className="card mb-3">
                      <div className="card-header">
                        <h6 className="mb-0">Display Options</h6>
                      </div>
                      <div className="card-body">
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={settings.showSubtotals}
                            onChange={(e) => handleSettingChange('showSubtotals', e.target.checked)}
                            id="showSubtotals"
                          />
                          <label className="form-check-label" htmlFor="showSubtotals">
                            Show Subtotals
                          </label>
                        </div>
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={settings.showCharges}
                            onChange={(e) => handleSettingChange('showCharges', e.target.checked)}
                            id="showCharges"
                          />
                          <label className="form-check-label" htmlFor="showCharges">
                            Show Charges
                          </label>
                        </div>
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={settings.showTotals}
                            onChange={(e) => handleSettingChange('showTotals', e.target.checked)}
                            id="showTotals"
                          />
                          <label className="form-check-label" htmlFor="showTotals">
                            Show Totals
                          </label>
                        </div>
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={settings.showQuantities}
                            onChange={(e) => handleSettingChange('showQuantities', e.target.checked)}
                            id="showQuantities"
                          />
                          <label className="form-check-label" htmlFor="showQuantities">
                            Show Quantities
                          </label>
                        </div>
                        <div className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={settings.showPrices}
                            onChange={(e) => handleSettingChange('showPrices', e.target.checked)}
                            id="showPrices"
                          />
                          <label className="form-check-label" htmlFor="showPrices">
                            Show Prices
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sorting & Grouping */}
                  <div className="col-md-6">
                    <div className="card mb-3">
                      <div className="card-header">
                        <h6 className="mb-0">Sorting & Grouping</h6>
                      </div>
                      <div className="card-body">
                        <div className="mb-3">
                          <label className="form-label">Group By</label>
                          <select
                            className="form-select"
                            value={settings.groupBy}
                            onChange={(e) => handleSettingChange('groupBy', e.target.value as any)}
                          >
                            <option value="none">No Grouping</option>
                            <option value="client">Client</option>
                            <option value="deliveryDate">Delivery Date</option>
                            <option value="invoiceNumber">Invoice Number</option>
                          </select>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Sort By</label>
                          <select
                            className="form-select"
                            value={settings.sortBy}
                            onChange={(e) => handleSettingChange('sortBy', e.target.value as any)}
                          >
                            <option value="invoiceNumber">Invoice Number</option>
                            <option value="deliveryDate">Delivery Date</option>
                            <option value="clientName">Client Name</option>
                            <option value="total">Total Amount</option>
                          </select>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Sort Order</label>
                          <select
                            className="form-select"
                            value={settings.sortOrder}
                            onChange={(e) => handleSettingChange('sortOrder', e.target.value as 'asc' | 'desc')}
                          >
                            <option value="asc">Ascending</option>
                            <option value="desc">Descending</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Styling Settings */}
                  <div className="col-md-12">
                    <div className="card mb-3">
                      <div className="card-header">
                        <h6 className="mb-0">Styling & Footer</h6>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label">Header Color</label>
                              <input
                                type="color"
                                className="form-control form-control-color"
                                value={settings.headerColor}
                                onChange={(e) => handleSettingChange('headerColor', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label">Font Size</label>
                              <input
                                type="number"
                                className="form-control"
                                value={settings.fontSize}
                                min="8"
                                max="16"
                                onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
                              />
                            </div>
                          </div>
                          <div className="col-md-4">
                            <div className="mb-3">
                              <label className="form-label">Margins (mm)</label>
                              <input
                                type="number"
                                className="form-control"
                                value={settings.margins}
                                min="5"
                                max="30"
                                onChange={(e) => handleSettingChange('margins', parseInt(e.target.value))}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Footer Text</label>
                          <textarea
                            className="form-control"
                            rows={2}
                            value={settings.footerText}
                            onChange={(e) => handleSettingChange('footerText', e.target.value)}
                            placeholder="Custom footer text (optional)"
                          />
                        </div>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={settings.includeTimestamp}
                            onChange={(e) => handleSettingChange('includeTimestamp', e.target.checked)}
                            id="includeTimestamp"
                          />
                          <label className="form-check-label" htmlFor="includeTimestamp">
                            Include Generation Timestamp
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Preview Info */}
              <div className="col-lg-4 col-md-12">
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">
                      <i className="bi bi-eye me-1"></i>
                      Preview Information
                    </h6>
                  </div>
                  <div className="card-body">
                    <div className="mb-3">
                      <div className="d-flex justify-content-between">
                        <strong>Selected Invoices:</strong> 
                        <span className={`badge ${selectedInvoices.length > 0 ? 'bg-primary' : 'bg-secondary'}`}>
                          {selectedInvoices.length}
                        </span>
                      </div>
                    </div>
                    <div className="mb-3">
                      <div className="d-flex justify-content-between">
                        <strong>Unique Clients:</strong> 
                        <span className="badge bg-info">
                          {new Set(selectedInvoices.map(inv => inv.clientId)).size}
                        </span>
                      </div>
                    </div>
                    <div className="mb-3">
                      <strong>Date Range:</strong>
                      <br />
                      <small className="text-muted">
                        {selectedInvoices.length > 0 ? (() => {
                          const dates = selectedInvoices
                            .map(inv => inv.deliveryDate || inv.date)
                            .filter(Boolean)
                            .map(date => new Date(date!))
                            .sort((a, b) => a.getTime() - b.getTime());
                          
                          if (dates.length === 0) return 'No dates available';
                          
                          const start = dates[0].toLocaleDateString();
                          const end = dates[dates.length - 1].toLocaleDateString();
                          return start === end ? start : `${start} to ${end}`;
                        })() : 'No invoices selected'}
                      </small>
                    </div>
                    
                    <hr />
                    
                    <div className="mb-3">
                      <strong>PDF Configuration:</strong>
                      <ul className="list-unstyled small mt-2">
                        <li>📄 {settings.paperSize.toUpperCase()} - {settings.orientation}</li>
                        <li>📊 Statistics: {settings.includeStatistics ? '✅' : '❌'}</li>
                        <li>📋 Summary Table: {settings.includeSummaryTable ? '✅' : '❌'}</li>
                        <li>📑 Invoice List: {settings.includeInvoiceList ? '✅' : '❌'}</li>
                        <li>💰 Charges: {settings.showCharges ? '✅' : '❌'}</li>
                      </ul>
                    </div>

                    <div className="alert alert-info">
                      <small>
                        <i className="bi bi-info-circle me-1"></i>
                        The PDF will be generated with all selected settings and downloaded automatically when ready.
                      </small>
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
              disabled={isGenerating}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${selectedInvoices.length === 0 ? 'btn-outline-primary' : 'btn-primary'}`}
              onClick={handleGenerate}
              disabled={isGenerating || selectedInvoices.length === 0}
            >
              {isGenerating ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Generating PDF...
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-pdf me-1"></i>
                  Generate PDF {selectedInvoices.length > 0 ? `(${selectedInvoices.length} invoices)` : '(No invoices selected)'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
