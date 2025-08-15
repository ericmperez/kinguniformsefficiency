import { useState, useEffect, useRef, useMemo } from 'react';
import { Client, PrintConfiguration, Invoice } from '../types';
import SignedDeliveryTicket from './SignedDeliveryTicket';
import { downloadSignedDeliveryPDF } from '../services/signedDeliveryPdfService';
import { formatDateEnglish } from '../utils/dateFormatter';

interface SignedDeliveryTicketPreviewProps {
  client: Client | null;
  config: PrintConfiguration;
  onConfigUpdate?: (clientId: string, updatedConfig: PrintConfiguration) => void;
}

const SignedDeliveryTicketPreview: React.FC<SignedDeliveryTicketPreviewProps> = ({
  client,
  config,
  onConfigUpdate
}) => {
  const [showPreview, setShowPreview] = useState(true);
  const [sampleSignature, setSampleSignature] = useState('');
  const hasLoadedInitially = useRef(false);
  const lastLoadedClientOptions = useRef<any>(null);
  
  // PDF Customization Options - properly typed
  const [pdfOptions, setPdfOptions] = useState<NonNullable<PrintConfiguration['pdfOptions']>>({
    scale: 0.75, // Reduced scale for smaller file sizes
    showSignatures: true,
    showTimestamp: false,
    showLocation: false,
    showQuantities: true,
    contentDisplay: 'summary', // Changed from detailed to summary for smaller files
    paperSize: 'a4', // Changed from letter to a4 for smaller size
    orientation: 'portrait',
    margins: 'narrow', // Changed from normal to narrow
    fontSize: 'small', // Changed from medium to small
    showWatermark: false,
    headerText: '',
    footerText: '',
    logoSize: 'small', // Changed from medium to small
    showBorder: false, // Changed from true to false
    pagination: 'single'
  });
  
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);

  // Generate sample signature using canvas
  const generateSampleSignature = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#0E62A0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, 60);
      ctx.quadraticCurveTo(50, 30, 80, 50);
      ctx.quadraticCurveTo(120, 70, 150, 40);
      ctx.quadraticCurveTo(180, 20, 220, 60);
      ctx.quadraticCurveTo(250, 80, 280, 50);
      ctx.stroke();
      return canvas.toDataURL();
    }
    return '';
  };

  // Generate initial signature and load client-specific PDF options
  useEffect(() => {
    setSampleSignature(generateSampleSignature());
    
    // Only load client options if they've actually changed (not from our own updates)
    const currentClientOptions = client?.printConfig?.pdfOptions;
    const currentClientOptionsString = JSON.stringify(currentClientOptions);
    const lastLoadedString = JSON.stringify(lastLoadedClientOptions.current);
    
    // Load client-specific PDF options if available and different from what we last loaded
    if (currentClientOptions && currentClientOptionsString !== lastLoadedString) {
      setPdfOptions(currentClientOptions);
      lastLoadedClientOptions.current = currentClientOptions;
      console.log('📄 Loaded client-specific PDF options:', currentClientOptions);
    } else if (!currentClientOptions && !hasLoadedInitially.current) {
      console.log('📄 Using default PDF options for client:', client?.name);
    }
    hasLoadedInitially.current = true;
  }, [client?.id]);

  // Auto-save PDF options to client configuration whenever they change (but skip initial load)
  useEffect(() => {
    // Skip saving on the initial load or if no client/update handler
    if (!hasLoadedInitially.current || !client || !onConfigUpdate) {
      return;
    }
    
    // Update the client's configuration with new PDF options
    const handlePdfOptionsUpdate = async () => {
      try {
        const updatedConfig = {
          ...config,
          pdfOptions: pdfOptions
        };
        
        await onConfigUpdate(client.id, updatedConfig);
        console.log('📄 PDF options auto-saved to client configuration:', pdfOptions);
        console.log('🔄 PDF preview should update now with new options');
      } catch (error) {
        console.error('Failed to auto-save PDF options to client:', error);
      }
    };

    handlePdfOptionsUpdate();
  }, [pdfOptions, client?.id, onConfigUpdate]); // Removed config from dependencies to prevent circular updates

  // Generate sample data - this will update when options or signature changes
  const sampleData = useMemo(() => {
    const names = ['John Smith', 'Maria Garcia', 'Robert Johnson', 'Lisa Chen'];
    
    return {
      signatureData: {
        signatureDataUrl: sampleSignature,
        signedByName: names[Math.floor(Math.random() * names.length)],
        driverName: 'Mike Johnson',
        deliveryDate: formatDateEnglish(new Date())
      },
      sampleInvoice: {
        id: 'preview-001',
        invoiceNumber: 2024001, // Should be number, not string
        clientId: client?.id || 'sample-client',
        clientName: client?.name || 'Sample Client',
        date: new Date().toISOString(),
        products: [], // Required by Invoice interface
        total: 250.0, // Required by Invoice interface
        truckNumber: 'TRUCK-05',
        totalWeight: 45.8,
        carts: [{
          id: 'cart-1',
          name: 'Standard Cart',
          items: [
            { productId: '1', productName: 'Scrub Shirts - Blue', quantity: 12, price: 15.0 },
            { productId: '2', productName: 'Scrub Pants - Blue', quantity: 8, price: 12.5 },
            { productId: '3', productName: 'Lab Coats - White', quantity: 5, price: 10.0 },
            { productId: '4', productName: 'Servilletas Blancas', quantity: 150, price: 0.25 },
            { productId: '5', productName: 'Servilletas de Papel', quantity: 200, price: 0.20 },
            { productId: '6', productName: 'Napkins - Brown', quantity: 75, price: 0.30 }
          ],
          total: 250.0, // Add total to cart as well
          createdAt: new Date().toISOString()
        }]
      } as Invoice
    };
  }, [sampleSignature, client?.id, client?.name, pdfOptions]);

  // Handle configuration updates
  const handleConfigToggle = async (section: 'cart' | 'invoice', setting: string, currentValue: boolean) => {
    if (!client || !onConfigUpdate) {
      console.log('Cannot update config: missing client or update handler');
      return;
    }

    try {
      const updatedConfig = { ...config };
      
      if (section === 'cart') {
        updatedConfig.cartPrintSettings = {
          ...updatedConfig.cartPrintSettings,
          [setting]: !currentValue
        };
      } else if (section === 'invoice') {
        updatedConfig.invoicePrintSettings = {
          ...updatedConfig.invoicePrintSettings,
          [setting]: !currentValue
        };
      }

      await onConfigUpdate(client.id, updatedConfig);
      console.log(`✅ Updated ${section} setting: ${setting} = ${!currentValue}`);
    } catch (error) {
      console.error('❌ Failed to update configuration:', error);
    }
  };

  return (
    <>
      {/* Add styles for clickable badges */}
      <style>{`
        .clickable-badge:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
          opacity: 0.9;
        }
        .clickable-badge:active {
          transform: scale(0.95) !important;
        }
      `}</style>
      
    <div className="row mt-4">
      <div className="col-12">
        <div className="card h-100" style={{ 
          borderRadius: "10px", 
          border: "none", 
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)" 
        }}>
          <div className="card-header" style={{ 
            backgroundColor: "#fff", 
            borderBottom: "2px solid #e9ecef", 
            borderRadius: "10px 10px 0 0", 
            padding: "1.25rem 1.5rem" 
          }}>
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center">
                <i className="bi bi-file-earmark-pdf-fill me-2 text-danger" style={{ fontSize: "1.2rem" }}></i>
                <h6 className="mb-0 fw-bold text-dark">Signed Delivery Ticket Preview</h6>
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${showPreview ? 'btn-success' : 'btn-outline-success'}`}
                  onClick={() => setShowPreview(!showPreview)}
                >
                  <i className="bi bi-eye me-1"></i>
                  {showPreview ? 'Hide Preview' : 'Show Preview'}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${showCustomizationPanel ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setShowCustomizationPanel(!showCustomizationPanel)}
                >
                  <i className="bi bi-sliders me-1"></i>
                  PDF Options
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setSampleSignature(generateSampleSignature())}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  New Sample
                </button>
              </div>
            </div>
          </div>

          {showPreview && (
            <div className="card-body" style={{ 
              padding: "1.5rem", 
              minHeight: "400px",
              display: "flex",
              flexDirection: "column",
              flex: 1
            }}>
              <div className="alert alert-info border-0 mb-3" style={{ backgroundColor: "#e3f2fd" }}>
                <div className="d-flex align-items-center">
                  <i className="bi bi-info-circle-fill text-info me-3"></i>
                  <div>
                    <strong>Preview Information:</strong>
                    <p className="mb-0">This shows how the signed delivery ticket PDF will appear when emailed to clients. The content adapts based on your print configuration settings above.</p>
                  </div>
                </div>
              </div>

              {/* Configuration Impact Display */}
              <div className="row mb-4">
                <div className="col-lg-4">
                  <div className="card border-0" style={{ backgroundColor: "#f8f9fa" }}>
                    <div className="card-body p-3">
                      <h6 className="fw-bold text-primary mb-2">
                        <i className="bi bi-gear-fill me-2"></i>
                        Current Settings Impact
                        {onConfigUpdate && (
                          <small className="text-muted ms-2" style={{ fontSize: '10px', fontWeight: 'normal' }}>
                            (click to toggle)
                          </small>
                        )}
                      </h6>
                      <div className="small">
                        <div className="d-flex justify-content-between mb-1">
                          <span>Show Items:</span>
                          <span 
                            className={`badge ${config.cartPrintSettings.showProductDetails ? 'bg-success' : 'bg-secondary'} ${onConfigUpdate ? 'clickable-badge' : ''}`}
                            onClick={() => onConfigUpdate && handleConfigToggle('cart', 'showProductDetails', config.cartPrintSettings.showProductDetails)}
                            style={{ 
                              cursor: onConfigUpdate ? 'pointer' : 'default',
                              transition: 'all 0.2s ease',
                              ...(onConfigUpdate && {
                                ':hover': {
                                  transform: 'scale(1.05)',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }
                              })
                            }}
                            title={onConfigUpdate ? 'Click to toggle Show Items setting' : undefined}
                          >
                            {config.cartPrintSettings.showProductDetails ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                          <span>Show Quantities:</span>
                          <span 
                            className={`badge ${config.cartPrintSettings.showQuantities ? 'bg-success' : 'bg-secondary'} ${onConfigUpdate ? 'clickable-badge' : ''}`}
                            onClick={() => onConfigUpdate && handleConfigToggle('cart', 'showQuantities', config.cartPrintSettings.showQuantities)}
                            style={{ 
                              cursor: onConfigUpdate ? 'pointer' : 'default',
                              transition: 'all 0.2s ease'
                            }}
                            title={onConfigUpdate ? 'Click to toggle Show Quantities setting' : undefined}
                          >
                            {config.cartPrintSettings.showQuantities ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                          <span>Show Total Weight:</span>
                          <span 
                            className={`badge ${config.invoicePrintSettings.showTotalWeight ? 'bg-success' : 'bg-secondary'} ${onConfigUpdate ? 'clickable-badge' : ''}`}
                            onClick={() => onConfigUpdate && handleConfigToggle('invoice', 'showTotalWeight', config.invoicePrintSettings.showTotalWeight)}
                            style={{ 
                              cursor: onConfigUpdate ? 'pointer' : 'default',
                              transition: 'all 0.2s ease'
                            }}
                            title={onConfigUpdate ? 'Click to toggle Show Total Weight setting' : undefined}
                          >
                            {config.invoicePrintSettings.showTotalWeight ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span>Billing Type:</span>
                          <span className="badge bg-info">
                            {client?.billingCalculation === 'byWeight' ? 'By Weight' : 'By Item'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-lg-8">
                  <div className="card border-0" style={{ backgroundColor: "#fff3cd" }}>
                    <div className="card-body p-3">
                      <h6 className="fw-bold text-warning mb-2">
                        <i className="bi bi-lightbulb-fill me-2"></i>
                        Email Delivery Information
                      </h6>
                      <div className="small text-dark">
                        <div className="row">
                          <div className="col-md-6">
                            <p className="mb-1"><strong>When sent:</strong> When delivery signature is captured</p>
                            <p className="mb-1"><strong>Recipients:</strong> {client?.email || 'Client email'}</p>
                            {config.emailSettings.ccEmails && config.emailSettings.ccEmails.length > 0 && (
                              <p className="mb-1"><strong>CC:</strong> {config.emailSettings.ccEmails.filter(e => e.trim()).join(', ')}</p>
                            )}
                          </div>
                          <div className="col-md-6">
                            <p className="mb-1"><strong>Auto-send:</strong> {config.emailSettings.autoSendOnSignature ? 'Enabled' : 'Disabled'}</p>
                            <p className="mb-1"><strong>Attachment:</strong> signed-delivery-ticket.pdf</p>
                            <p className="mb-0"><strong>Format:</strong> Professional PDF with signatures</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PDF Customization Panel */}
              {showCustomizationPanel && (
                <div className="row mb-4">
                  <div className="col-12">
                    <div className="card border-primary" style={{ backgroundColor: "#f8f9ff" }}>
                      <div className="card-header bg-primary text-white">
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center">
                            <i className="bi bi-sliders me-2"></i>
                            <h6 className="mb-0 fw-bold">PDF Customization Options</h6>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-light"
                            onClick={() => {
                              const resetOptions: NonNullable<PrintConfiguration['pdfOptions']> = {
                                scale: 0.75, // Reduced scale for smaller file sizes
                                showSignatures: true,
                                showTimestamp: false,
                                showLocation: false,
                                showQuantities: true,
                                contentDisplay: 'summary', // Changed from detailed to summary
                                paperSize: 'a4', // Changed from letter to a4
                                orientation: 'portrait',
                                margins: 'narrow', // Changed from normal to narrow
                                fontSize: 'medium',
                                showWatermark: false,
                                headerText: '',
                                footerText: '',
                                logoSize: 'medium',
                                showBorder: true,
                                pagination: 'single'
                              };
                              setPdfOptions(resetOptions);
                            }}
                          >
                            <i className="bi bi-arrow-counterclockwise me-1"></i>
                            Reset
                          </button>
                        </div>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          {/* Layout Options */}
                          <div className="col-lg-3">
                            <h6 className="fw-bold text-primary mb-3">
                              <i className="bi bi-layout-text-sidebar me-1"></i>
                              Layout & Size
                            </h6>
                            
                            <div className="mb-3">
                              <label className="form-label small fw-bold">Paper Size</label>
                              <select 
                                className="form-select form-select-sm"
                                value={pdfOptions.paperSize}
                                onChange={(e) => setPdfOptions({...pdfOptions, paperSize: e.target.value as 'letter' | 'a4' | 'legal'})}
                              >
                                <option value="letter">Letter (8.5" × 11")</option>
                                <option value="a4">A4 (210 × 297 mm)</option>
                                <option value="legal">Legal (8.5" × 14")</option>
                              </select>
                            </div>

                            <div className="mb-3">
                              <label className="form-label small fw-bold">Orientation</label>
                              <select 
                                className="form-select form-select-sm"
                                value={pdfOptions.orientation}
                                onChange={(e) => setPdfOptions({...pdfOptions, orientation: e.target.value as 'portrait' | 'landscape'})}
                              >
                                <option value="portrait">Portrait</option>
                                <option value="landscape">Landscape</option>
                              </select>
                            </div>

                            <div className="mb-3">
                              <label className="form-label small fw-bold">Margins</label>
                              <select 
                                className="form-select form-select-sm"
                                value={pdfOptions.margins}
                                onChange={(e) => setPdfOptions({...pdfOptions, margins: e.target.value as 'narrow' | 'normal' | 'wide'})}
                              >
                                <option value="narrow">Narrow</option>
                                <option value="normal">Normal</option>
                                <option value="wide">Wide</option>
                              </select>
                            </div>

                            <div className="mb-3">
                              <label className="form-label small fw-bold">Scale ({(pdfOptions.scale * 100).toFixed(0)}%)</label>
                              <input
                                type="range"
                                className="form-range"
                                min="0.5"
                                max="2.0"
                                step="0.1"
                                value={pdfOptions.scale}
                                onChange={(e) => setPdfOptions({...pdfOptions, scale: parseFloat(e.target.value)})}
                              />
                            </div>

                            <div className="mb-3">
                              <label className="form-label small fw-bold">Pagination</label>
                              <select 
                                className="form-select form-select-sm"
                                value={pdfOptions.pagination}
                                onChange={(e) => setPdfOptions({...pdfOptions, pagination: e.target.value as 'single' | 'multiple'})}
                              >
                                <option value="single">Single Page (compressed)</option>
                                <option value="multiple">Multiple Pages (natural flow)</option>
                              </select>
                            </div>
                          </div>

                          {/* Content Options */}
                          <div className="col-lg-3">
                            <h6 className="fw-bold text-primary mb-3">
                              <i className="bi bi-file-text me-1"></i>
                              Content & Text
                            </h6>
                            
                            <div className="mb-3">
                              <label className="form-label small fw-bold">Font Size</label>
                              <select 
                                className="form-select form-select-sm"
                                value={pdfOptions.fontSize}
                                onChange={(e) => setPdfOptions({...pdfOptions, fontSize: e.target.value as 'small' | 'medium' | 'large'})}
                              >
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                              </select>
                            </div>

                            <div className="mb-3">
                              <label className="form-label small fw-bold">Logo Size</label>
                              <select 
                                className="form-select form-select-sm"
                                value={pdfOptions.logoSize}
                                onChange={(e) => setPdfOptions({...pdfOptions, logoSize: e.target.value as 'small' | 'medium' | 'large'})}
                              >
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                              </select>
                            </div>

                            <div className="mb-3">
                              <label className="form-label small fw-bold">Custom Header</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Optional header text"
                                value={pdfOptions.headerText}
                                onChange={(e) => setPdfOptions({...pdfOptions, headerText: e.target.value})}
                              />
                            </div>

                            <div className="mb-3">
                              <label className="form-label small fw-bold">Custom Footer</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Optional footer text"
                                value={pdfOptions.footerText}
                                onChange={(e) => setPdfOptions({...pdfOptions, footerText: e.target.value})}
                              />
                            </div>
                          </div>

                          {/* Display Options */}
                          <div className="col-lg-3">
                            <h6 className="fw-bold text-primary mb-3">
                              <i className="bi bi-eye me-1"></i>
                              Display Options
                            </h6>
                            
                            <div className="form-check mb-2">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={pdfOptions.showSignatures}
                                onChange={(e) => setPdfOptions({...pdfOptions, showSignatures: e.target.checked})}
                                id="showSignatures"
                              />
                              <label className="form-check-label small" htmlFor="showSignatures">
                                Show Signatures
                              </label>
                            </div>

                            <div className="form-check mb-2">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={pdfOptions.showTimestamp}
                                onChange={(e) => setPdfOptions({...pdfOptions, showTimestamp: e.target.checked})}
                                id="showTimestamp"
                              />
                              <label className="form-check-label small" htmlFor="showTimestamp">
                                Show Timestamp
                              </label>
                            </div>

                            <div className="form-check mb-2">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={pdfOptions.showLocation}
                                onChange={(e) => setPdfOptions({...pdfOptions, showLocation: e.target.checked})}
                                id="showLocation"
                              />
                              <label className="form-check-label small" htmlFor="showLocation">
                                Show Location Info
                              </label>
                            </div>

                            <div className="form-check mb-2">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={pdfOptions.showQuantities}
                                onChange={(e) => setPdfOptions({...pdfOptions, showQuantities: e.target.checked})}
                                id="showQuantities"
                              />
                              <label className="form-check-label small" htmlFor="showQuantities">
                                Show Quantities
                              </label>
                            </div>

                            <div className="form-check mb-2">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={pdfOptions.showBorder}
                                onChange={(e) => setPdfOptions({...pdfOptions, showBorder: e.target.checked})}
                                id="showBorder"
                              />
                              <label className="form-check-label small" htmlFor="showBorder">
                                Show Border
                              </label>
                            </div>

                            <div className="form-check mb-2">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={pdfOptions.showWatermark}
                                onChange={(e) => setPdfOptions({...pdfOptions, showWatermark: e.target.checked})}
                                id="showWatermark"
                              />
                              <label className="form-check-label small" htmlFor="showWatermark">
                                Show Watermark
                              </label>
                            </div>
                          </div>

                          {/* Content Display Options */}
                          <div className="col-lg-3">
                            <h6 className="fw-bold text-primary mb-3">
                              <i className="bi bi-list-ul me-1"></i>
                              Content Display
                            </h6>
                            
                            <div className="mb-3">
                              <label className="form-label small fw-bold">Show Items As</label>
                              <select 
                                className="form-select form-select-sm"
                                value={pdfOptions.contentDisplay}
                                onChange={(e) => setPdfOptions({...pdfOptions, contentDisplay: e.target.value as 'detailed' | 'summary' | 'weight-only' | 'servilletas-summary'})}
                              >
                                <option value="detailed">Detailed Items List</option>
                                <option value="summary">Summary with Total Weight</option>
                                <option value="weight-only">Weight Only</option>
                                <option value="servilletas-summary">Servilletas by Product & Qty + Weight</option>
                              </select>
                              <div className="form-text small text-muted mt-1">
                                {pdfOptions.contentDisplay === 'detailed' && 'Shows each item with quantities and details'}
                                {pdfOptions.contentDisplay === 'summary' && 'Shows summary with total weight and item count'}
                                {pdfOptions.contentDisplay === 'weight-only' && 'Shows only total weight delivered'}
                                {pdfOptions.contentDisplay === 'servilletas-summary' && 'Shows Servilletas grouped by Product & Qty + Client total weight'}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="col-lg-3">
                            <h6 className="fw-bold text-primary mb-3">
                              <i className="bi bi-download me-1"></i>
                              Export Options
                            </h6>
                            
                            <div className="d-grid gap-2">
                              <button 
                                className="btn btn-outline-primary btn-sm"
                                onClick={async () => {
                                  try {
                                    await downloadSignedDeliveryPDF(
                                      sampleData.sampleInvoice,
                                      client || sampleData.sampleInvoice as any,
                                      sampleData.signatureData,
                                      pdfOptions
                                    );
                                    console.log('✅ PDF downloaded successfully with options:', pdfOptions);
                                  } catch (error) {
                                    console.error('❌ Error downloading PDF:', error);
                                    alert('Error generating PDF. Please try again.');
                                  }
                                }}
                              >
                                <i className="bi bi-download me-1"></i>
                                Download PDF
                              </button>
                              
                              <button 
                                className="btn btn-outline-secondary btn-sm"
                                onClick={() => {
                                  // Print with current options
                                  window.print();
                                }}
                              >
                                <i className="bi bi-printer me-1"></i>
                                Print Preview
                              </button>
                              
                              <button 
                                className="btn btn-outline-info btn-sm"
                                onClick={async () => {
                                  if (!client || !onConfigUpdate) {
                                    alert('❌ Cannot save: No client selected or save function not available.');
                                    return;
                                  }
                                  
                                  try {
                                    const updatedConfig = {
                                      ...config,
                                      pdfOptions: pdfOptions
                                    };
                                    
                                    await onConfigUpdate(client.id, updatedConfig);
                                    alert('✅ PDF options saved as default for this client! All future delivery tickets will use these settings.');
                                  } catch (error) {
                                    console.error('Error saving PDF options:', error);
                                    alert('❌ Error saving preferences. Please try again.');
                                  }
                                }}
                              >
                                <i className="bi bi-bookmark me-1"></i>
                                Save as Default
                              </button>
                              
                              <button 
                                className="btn btn-outline-warning btn-sm"
                                onClick={() => {
                                  // Reset to default options
                                  const defaultOptions: NonNullable<PrintConfiguration['pdfOptions']> = {
                                    scale: 0.75, // Reduced scale for smaller file sizes
                                    showSignatures: true,
                                    showTimestamp: false,
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
                                  };
                                  setPdfOptions(defaultOptions);
                                  console.log('🔄 PDF options reset to defaults');
                                }}
                              >
                                <i className="bi bi-arrow-counterclockwise me-1"></i>
                                Reset to Defaults
                              </button>
                            </div>

                            <div className="mt-3">
                              <div className="small text-muted">
                                <strong>Preview Scale:</strong> {(pdfOptions.scale * 100).toFixed(0)}%<br/>
                                <strong>Paper:</strong> {pdfOptions.paperSize.toUpperCase()}<br/>
                                <strong>Layout:</strong> {pdfOptions.orientation}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PDF Preview Container */}
              <div style={{
                border: pdfOptions.showBorder ? "2px solid #dee2e6" : "none",
                borderRadius: "8px",
                backgroundColor: "#fff",
                flex: 1,
                overflowY: "auto",
                overflowX: "auto",
                padding: pdfOptions.margins === 'narrow' ? "15px" : 
                        pdfOptions.margins === 'wide' ? "45px" : "30px",
                margin: "10px 0",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                minHeight: "70vh",
                position: "relative"
              }}>
                {pdfOptions.showWatermark && (
                  <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%) rotate(-45deg)",
                    fontSize: "4rem",
                    color: "rgba(0, 0, 0, 0.05)",
                    fontWeight: "bold",
                    zIndex: 1,
                    pointerEvents: "none"
                  }}>
                    PREVIEW
                  </div>
                )}
                <div style={{ 
                  width: "100%",
                  maxWidth: pdfOptions.paperSize === 'a4' ? "800px" : 
                           pdfOptions.paperSize === 'legal' ? "850px" : "800px",
                  transform: `scale(${pdfOptions.scale})`,
                  transformOrigin: "top center",
                  fontSize: pdfOptions.fontSize === 'small' ? '12px' : 
                           pdfOptions.fontSize === 'large' ? '16px' : '14px',
                  aspectRatio: pdfOptions.orientation === 'landscape' ? '1.3' : '1.3'
                }}>
                  <SignedDeliveryTicket
                    key={JSON.stringify(pdfOptions)}
                    ticketNumber={String(sampleData.sampleInvoice.invoiceNumber || 'LT-2024-001')}
                    clientName={client?.name || 'Sample Client'}
                    driverName={sampleData.signatureData.driverName}
                    deliveryDate={sampleData.signatureData.deliveryDate}
                    invoice={sampleData.sampleInvoice}
                    client={client || {
                      id: 'sample',
                      name: 'Sample Client',
                      email: 'sample@example.com',
                      billingCalculation: 'byWeight',
                      selectedProducts: [],
                      image: new File([], 'sample.jpg'),
                      isRented: false,
                      printConfig: config
                    } as Client}
                    signatureDataUrl={sampleData.signatureData.signatureDataUrl}
                    signedByName={sampleData.signatureData.signedByName}
                    pdfOptions={pdfOptions}
                  />
                </div>
              </div>

              {/* Configuration Tips */}
              <div className="alert alert-light border mt-3">
                <h6 className="fw-bold text-secondary mb-2">
                  <i className="bi bi-question-circle-fill me-2"></i>
                  Configuration Tips
                </h6>
                <div className="row small text-secondary">
                  <div className="col-md-4">
                    <ul className="mb-0 ps-3">
                      <li>Toggle settings above to see changes reflected in the preview</li>
                      <li>For by-weight clients, weight totals are automatically included</li>
                      <li>Item details can be hidden for simplified tickets</li>
                    </ul>
                  </div>
                  <div className="col-md-4">
                    <ul className="mb-0 ps-3">
                      <li>Custom logos and footer text are supported</li>
                      <li>Signatures are captured and embedded automatically</li>
                      <li>Professional formatting ensures printable PDFs</li>
                    </ul>
                  </div>
                  <div className="col-md-4">
                    <ul className="mb-0 ps-3">
                      <li><strong>PDF Options:</strong> Click "PDF Options" to customize layout, size, and content</li>
                      <li><strong>Save Settings:</strong> Your PDF preferences can be saved as default</li>
                      <li><strong>Export Ready:</strong> Download or print directly from the preview</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default SignedDeliveryTicketPreview;
