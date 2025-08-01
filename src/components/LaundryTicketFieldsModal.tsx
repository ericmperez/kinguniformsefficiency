import React, { useState } from "react";
import { PrintConfiguration } from "../types";

export interface LaundryTicketFieldsModalProps {
  show: boolean;
  onClose: () => void;
  initialConfig: PrintConfiguration["invoicePrintSettings"];
  onSave: (newConfig: PrintConfiguration["invoicePrintSettings"]) => void;
}

const FIELD_OPTIONS = [
  { key: "showClientInfo", label: "Show client info", help: "Show the client's name and info at the top of the ticket.", example: "ABC Medical Center\nID: CLIENT-001" },
  { key: "showInvoiceNumber", label: "Show ticket number", help: "Show the unique laundry ticket number.", example: "Ticket #: LT-2025-001234" },
  { key: "showDate", label: "Show date", help: "Show the date the ticket was created.", example: "Date: July 28, 2025" },
  { key: "showCartBreakdown", label: "Show cart breakdown", help: "Show a breakdown of all carts included in this ticket.", example: "Cart A: 15 items\nCart B: 8 items\nCart C: 12 items" },
  { key: "showProductSummary", label: "Show product summary", help: "Show a summary of all products on the ticket.", example: "Scrub Shirts: 25 pcs\nScrub Pants: 18 pcs\nLab Coats: 7 pcs" },
  { key: "showTotalWeight", label: "Show total weight", help: "Show the total weight processed (for weight-based clients).", example: "Total Weight: 45.2 lbs" },
  { key: "showSubtotal", label: "Show subtotal", help: "Show the subtotal before taxes.", example: "Subtotal: $127.50" },
  { key: "showTaxes", label: "Show taxes", help: "Show taxes if applicable.", example: "Tax (8.25%): $10.52" },
  { key: "showGrandTotal", label: "Show grand total", help: "Show the final total after all charges.", example: "Grand Total: $138.02" },
  { key: "includeSignature", label: "Include signature line", help: "Include a signature line for delivery confirmation.", example: "Signature: ________________\nDate: _______ Time: _______" },
  { key: "headerText", label: "Header text", help: "Custom text to show at the top of the ticket.", type: "text", example: "King Uniforms - Professional Laundry Service" },
  { key: "footerText", label: "Footer text", help: "Custom text to show at the bottom of the ticket.", type: "text", example: "Thank you for your business! Call (555) 123-4567 for any questions." },
  { key: "logoUrl", label: "Logo URL", help: "URL for a custom logo to show on the ticket.", type: "text", example: "/images/King Uniforms Logo.png" },
];

const SAMPLE_DATA = {
  clientName: "ABC Medical Center",
  clientId: "CLIENT-001",
  ticketNumber: "LT-2025-001234",
  date: "July 28, 2025",
  carts: [
    { name: "Cart A", items: 15, total: 67.50 },
    { name: "Cart B", items: 8, total: 36.00 },
    { name: "Cart C", items: 12, total: 54.00 }
  ],
  products: [
    { name: "Scrub Shirts", quantity: 25, price: 3.50 },
    { name: "Scrub Pants", quantity: 18, price: 4.25 },
    { name: "Lab Coats", quantity: 7, price: 8.00 }
  ],
  totalWeight: 45.2,
  subtotal: 127.50,
  tax: 10.52,
  taxRate: 8.25,
  grandTotal: 138.02
};

const LaundryTicketFieldsModal: React.FC<LaundryTicketFieldsModalProps> = ({
  show,
  onClose,
  initialConfig,
  onSave,
}) => {
  const [config, setConfig] = useState(initialConfig);
  
  if (!show) return null;
  
  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-white" style={{ zIndex: 1060 }}>
      <div className="d-flex h-100">
        <div className="bg-light border-end" style={{ width: '400px', minWidth: '400px' }}>
          <div className="p-3 border-bottom bg-white">
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="bi bi-ui-checks-grid me-2"></i>
                Customize Ticket Fields
              </h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
          </div>
          
          <div className="p-3" style={{ height: 'calc(100vh - 140px)', overflowY: 'auto' }}>
            <div className="mb-3">
              <h6 className="text-muted">
                <i className="bi bi-toggles me-2"></i>
                Field Configuration
              </h6>
            </div>
            
            {FIELD_OPTIONS.map((field) => (
              <div className="mb-3 p-3 border rounded bg-white" key={field.key}>
                {field.type === "text" ? (
                  <>
                    <label className="form-label fw-semibold">
                      {field.label}
                    </label>
                    <input
                      type="text"
                      className="form-control mb-2"
                      value={(config as any)[field.key] || ""}
                      onChange={e => setConfig({ ...config, [field.key]: e.target.value })}
                      placeholder={field.example}
                    />
                    <small className="text-muted d-block mb-2">{field.help}</small>
                    <div className="bg-light p-2 rounded">
                      <small className="text-primary fw-semibold">Example:</small>
                      <div className="text-dark small font-monospace">{field.example}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={field.key}
                        checked={!!(config as any)[field.key]}
                        onChange={e => setConfig({ ...config, [field.key]: e.target.checked })}
                      />
                      <label className="form-check-label fw-semibold" htmlFor={field.key}>
                        {field.label}
                      </label>
                    </div>
                    <small className="text-muted d-block mb-2">{field.help}</small>
                    <div className="bg-light p-2 rounded">
                      <small className="text-primary fw-semibold">Example:</small>
                      <div className="text-dark small font-monospace" style={{ whiteSpace: 'pre-line' }}>
                        {field.example}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          
          <div className="p-3 border-top bg-white">
            <div className="d-flex gap-2">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={() => onSave(config)}>
                <i className="bi bi-check-lg me-1"></i>
                Save Configuration
              </button>
            </div>
          </div>
        </div>

        <div className="flex-grow-1 bg-white">
          <div className="p-3 border-bottom bg-light">
            <h6 className="mb-0">
              <i className="bi bi-eye me-2"></i>
              Live Preview - Full Screen
            </h6>
          </div>
          
          <div className="p-4" style={{ height: 'calc(100vh - 70px)', overflowY: 'auto' }}>
            <div className="mx-auto" style={{ 
              maxWidth: '800px',
              backgroundColor: '#fff', 
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '40px',
              fontFamily: 'Arial, sans-serif',
              fontSize: '14px',
              lineHeight: '1.4',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
              {config.headerText && (
                <div className="text-center mb-3" style={{ fontSize: '16px', fontWeight: 'bold', color: '#0E62A0' }}>
                  {config.headerText}
                </div>
              )}

              {config.logoUrl && (
                <div className="text-center mb-3">
                  <img 
                    src={config.logoUrl} 
                    alt="Logo" 
                    style={{ maxHeight: '120px', maxWidth: '400px' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              <div className="text-center mb-4">
                <h4 className="mb-0" style={{ color: '#0E62A0', fontSize: '24px', fontWeight: 'bold' }}>LAUNDRY TICKET</h4>
              </div>

              {config.showClientInfo && (
                <div className="mb-4">
                  <div className="fw-bold" style={{ fontSize: '18px' }}>{SAMPLE_DATA.clientName}</div>
                  <div className="text-muted">Client ID: {SAMPLE_DATA.clientId}</div>
                </div>
              )}

              <div className="row mb-4">
                {config.showInvoiceNumber && (
                  <div className="col-6">
                    <strong>Ticket #:</strong> {SAMPLE_DATA.ticketNumber}
                  </div>
                )}
                {config.showDate && (
                  <div className="col-6">
                    <strong>Date:</strong> {SAMPLE_DATA.date}
                  </div>
                )}
              </div>

              {config.showCartBreakdown && (
                <div className="mb-4">
                  <div className="fw-bold mb-3" style={{ fontSize: '16px' }}>Cart Breakdown:</div>
                  <div className="table-responsive">
                    <table className="table table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th style={{ fontSize: '14px' }}>Cart</th>
                          <th style={{ fontSize: '14px' }}>Items</th>
                          <th style={{ fontSize: '14px' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SAMPLE_DATA.carts.map((cart, index) => (
                          <tr key={index}>
                            <td>{cart.name}</td>
                            <td>{cart.items}</td>
                            <td>${cart.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {config.showProductSummary && (
                <div className="mb-4">
                  <div className="fw-bold mb-3" style={{ fontSize: '16px' }}>Product Summary:</div>
                  <div className="table-responsive">
                    <table className="table table-bordered">
                      <thead className="table-light">
                        <tr>
                          <th style={{ fontSize: '14px' }}>Product</th>
                          <th style={{ fontSize: '14px' }}>Quantity</th>
                          <th style={{ fontSize: '14px' }}>Rate</th>
                          <th style={{ fontSize: '14px' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SAMPLE_DATA.products.map((product, index) => (
                          <tr key={index}>
                            <td>{product.name}</td>
                            <td>{product.quantity}</td>
                            <td>${product.price.toFixed(2)}</td>
                            <td>${(product.quantity * product.price).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {config.showTotalWeight && (
                <div className="mb-4">
                  <div className="d-flex justify-content-between border-top pt-3">
                    <span className="fw-bold" style={{ fontSize: '16px' }}>Total Weight:</span>
                    <span style={{ fontSize: '16px' }}>{SAMPLE_DATA.totalWeight} lbs</span>
                  </div>
                </div>
              )}

              <div className="border-top pt-3">
                {config.showSubtotal && (
                  <div className="d-flex justify-content-between mb-2">
                    <span style={{ fontSize: '16px' }}>Subtotal:</span>
                    <span style={{ fontSize: '16px' }}>${SAMPLE_DATA.subtotal.toFixed(2)}</span>
                  </div>
                )}
                {config.showTaxes && (
                  <div className="d-flex justify-content-between mb-2">
                    <span style={{ fontSize: '16px' }}>Tax ({SAMPLE_DATA.taxRate}%):</span>
                    <span style={{ fontSize: '16px' }}>${SAMPLE_DATA.tax.toFixed(2)}</span>
                  </div>
                )}
                {config.showGrandTotal && (
                  <div className="d-flex justify-content-between fw-bold border-top pt-3" style={{ fontSize: '18px' }}>
                    <span>Grand Total:</span>
                    <span>${SAMPLE_DATA.grandTotal.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {config.includeSignature && (
                <div className="mt-5 pt-4 border-top">
                  <div className="row">
                    <div className="col-6">
                      <div className="border-bottom mb-2" style={{ height: '40px' }}></div>
                      <div style={{ fontSize: '14px' }}>Customer Signature</div>
                    </div>
                    <div className="col-3">
                      <div className="border-bottom mb-2" style={{ height: '40px' }}></div>
                      <div style={{ fontSize: '14px' }}>Date</div>
                    </div>
                    <div className="col-3">
                      <div className="border-bottom mb-2" style={{ height: '40px' }}></div>
                      <div style={{ fontSize: '14px' }}>Time</div>
                    </div>
                  </div>
                </div>
              )}

              {config.footerText && (
                <div className="text-center mt-4 pt-4 border-top">
                  <div className="text-muted" style={{ fontSize: '13px' }}>{config.footerText}</div>
                </div>
              )}
            </div>

            <div className="mt-4 p-3 bg-light rounded mx-auto" style={{ maxWidth: '800px' }}>
              <div className="text-muted" style={{ fontSize: '14px' }}>
                <i className="bi bi-info-circle me-2"></i>
                This preview updates in real-time as you change the field settings on the left.
                Toggle fields on/off or modify text to see how your laundry ticket will look when printed.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaundryTicketFieldsModal;
