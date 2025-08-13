import React from 'react';
import { Invoice, Client } from '../types';
import { formatDateEnglish } from '../utils/dateFormatter';

interface SignedDeliveryTicketProps {
  ticketNumber: string;
  clientName: string;
  driverName: string;
  deliveryDate: string;
  invoice: Invoice;
  client: Client;
  signatureDataUrl?: string;
  signedByName: string;
  pdfOptions?: {
    scale?: number;
    showSignatures?: boolean;
    showTimestamp?: boolean;
    showLocation?: boolean;
    showQuantities?: boolean;
    contentDisplay?: string;
    paperSize?: string;
    orientation?: string;
    margins?: string;
    fontSize?: string;
    showWatermark?: boolean;
    headerText?: string;
    footerText?: string;
    logoSize?: string;
    showBorder?: boolean;
    pagination?: string;
  };
}

const SignedDeliveryTicket: React.FC<SignedDeliveryTicketProps> = ({
  ticketNumber,
  clientName,
  driverName,
  deliveryDate,
  invoice,
  client,
  signatureDataUrl,
  signedByName,
  pdfOptions = {}
}) => {
  const defaultOptions = {
    scale: 1.0,
    showSignatures: true,
    showTimestamp: false,
    showLocation: false,
    showQuantities: true,
    contentDisplay: 'detailed',
    paperSize: 'letter',
    orientation: 'portrait',
    margins: 'normal',
    fontSize: 'medium',
    showWatermark: false,
    headerText: '',
    footerText: '',
    logoSize: 'medium',
    showBorder: true
  };
  
  const options = { ...defaultOptions, ...pdfOptions };
  const printConfig = client.printConfig?.invoicePrintSettings;
  const showWeights = printConfig?.showTotalWeight !== false;
  const showQuantities = options.showQuantities !== false;
  const showItems = printConfig?.showProductSummary !== false;
  
  const contentDisplay = options.contentDisplay || 'detailed';
  // Fix: PDF contentDisplay setting should override invoicePrintSettings.showProductSummary
  // When contentDisplay is explicitly set to 'detailed', show detailed items regardless of showProductSummary
  const showDetailedItems = contentDisplay === 'detailed';
  const showSummaryOnly = contentDisplay === 'summary';
  const showWeightOnly = contentDisplay === 'weight-only';
  
  const items = invoice.carts.flatMap((cart) => cart.items || []);
  const totalWeight = invoice.totalWeight || 0;
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartCount = invoice.carts.length; // Total number of carts delivered
  
  // Font size mapping
  const getFontSize = (baseSize: string) => {
    const multiplier = options.fontSize === 'small' ? 0.85 : 
                     options.fontSize === 'large' ? 1.15 : 1.0;
    const numericSize = parseFloat(baseSize.replace('px', ''));
    return `${Math.round(numericSize * multiplier)}px`;
  };
  
  // Logo size mapping - maintain proper aspect ratio for King Uniforms logo
  const getLogoSize = () => {
    // King Uniforms logo dimensions based on actual logo proportions
    // Approximately 4:2.5 aspect ratio to accommodate crown, shield and text
    const baseWidth = 180;
    const baseHeight = 110;
    const multiplier = options.logoSize === 'small' ? 0.7 : 
                     options.logoSize === 'large' ? 1.3 : 1.0;
    return {
      width: `${Math.round(baseWidth * multiplier)}px`,
      height: `${Math.round(baseHeight * multiplier)}px`
    };
  };
  
  const logoSize = getLogoSize();
  
  return (
    <div className="signed-delivery-ticket" style={{
      fontFamily: 'Arial, sans-serif',
      padding: '20px',
      backgroundColor: 'white',
      width: '8.5in',
      minHeight: '11in',
      margin: '0 auto',
      boxSizing: 'border-box',
      fontSize: getFontSize('14px')
    }}>
      {/* Custom Header */}
      {options.headerText && (
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '20px', 
          padding: '10px',
          backgroundColor: '#f8f9fa',
          borderRadius: '5px',
          fontSize: getFontSize('16px'),
          fontWeight: 'bold',
          color: '#0E62A0'
        }}>
          {options.headerText}
        </div>
      )}
      
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '3px solid #0E62A0',
        paddingBottom: '15px',
        marginBottom: '20px'
      }}>
        <img 
          src="/images/King Uniforms Logo.png" 
          alt="Company Logo" 
          style={{ 
            width: logoSize.width, 
            height: logoSize.height,
            objectFit: 'contain',
            objectPosition: 'left center',
            maxWidth: logoSize.width,
            maxHeight: logoSize.height,
            display: 'block'
          }}
        />
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: '0', color: '#0E62A0', fontSize: getFontSize('24px') }}>
            DELIVERY CONFIRMATION
          </h2>
          <p style={{ margin: '5px 0', fontSize: getFontSize('18px'), fontWeight: 'bold' }}>
            Ticket #{ticketNumber}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '25px' }}>
        <div>
          <h3 style={{ color: '#0E62A0', marginBottom: '10px', fontSize: getFontSize('18px') }}>
            CLIENT INFORMATION
          </h3>
          <p style={{ fontSize: getFontSize('20px'), fontWeight: 'bold', margin: '5px 0' }}>
            {clientName}
          </p>
          {options.showLocation && (
            <div style={{ marginTop: '10px', fontSize: getFontSize('14px') }}>
              <p style={{ margin: '2px 0', color: '#666' }}>
                <strong>Location:</strong> On-site delivery
              </p>
              <p style={{ margin: '2px 0', color: '#666' }}>
                <strong>Route:</strong> Standard delivery route
              </p>
            </div>
          )}
        </div>
        <div>
          <p style={{ margin: '5px 0', fontSize: getFontSize('18px'), fontWeight: 'bold' }}>
            Delivery Date: {formatDateEnglish(deliveryDate)}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '25px' }}>
        <h3 style={{ color: '#0E62A0', marginBottom: '15px', fontSize: getFontSize('18px') }}>
          SERVICES PROVIDED
        </h3>
        
        {/* Cart delivery summary - always shown */}
        <div style={{ backgroundColor: '#e3f2fd', padding: '15px', borderRadius: '5px', marginBottom: '15px' }}>
          <p style={{ margin: '0', fontSize: getFontSize('16px'), fontWeight: 'bold', color: '#0E62A0', textAlign: 'center' }}>
            {totalCartCount} Cart{totalCartCount !== 1 ? 's' : ''} Delivered
          </p>
        </div>
        
        {showDetailedItems && items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ border: '1px solid #dee2e6', padding: '10px', textAlign: 'left', fontWeight: 'bold', fontSize: getFontSize('14px') }}>
                  ITEM/SERVICE
                </th>
                {showQuantities && (
                  <th style={{ border: '1px solid #dee2e6', padding: '10px', textAlign: 'center', fontWeight: 'bold', width: '120px', fontSize: getFontSize('14px') }}>
                    QUANTITY
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Consolidate duplicate items by summing their quantities
                const consolidatedItems = items.reduce((acc, item) => {
                  const existingItem = acc.find(consolidated => consolidated.productName === item.productName);
                  if (existingItem) {
                    existingItem.quantity += item.quantity;
                  } else {
                    acc.push({ ...item });
                  }
                  return acc;
                }, [] as typeof items);

                return consolidatedItems.map((item, index) => (
                  <tr key={index}>
                    <td style={{ border: '1px solid #dee2e6', padding: '8px', fontSize: getFontSize('13px') }}>
                      {item.productName}
                    </td>
                    {showQuantities && (
                      <td style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'center', fontSize: getFontSize('13px') }}>
                        {item.quantity}
                      </td>
                    )}
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        )}

        {/* Summary display mode - shows summary with item count and total weight */}
        {showSummaryOnly && (
          <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '5px', marginBottom: '15px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              <div>
                <p style={{ margin: '0', fontSize: getFontSize('16px'), fontWeight: 'bold', color: '#0E62A0' }}>
                  Total Carts: {totalCartCount}
                </p>
              </div>
              <div>
                <p style={{ margin: '0', fontSize: getFontSize('16px'), fontWeight: 'bold', color: '#0E62A0' }}>
                  Total Items: {totalItemCount}
                </p>
              </div>
              {showWeights && totalWeight > 0 && (
                <div>
                  <p style={{ margin: '0', fontSize: getFontSize('16px'), fontWeight: 'bold', color: '#0E62A0' }}>
                    Total Weight: {totalWeight.toFixed(2)} lbs
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Weight-only display mode - shows only total weight */}
        {showWeightOnly && showWeights && totalWeight > 0 && (
          <div style={{ backgroundColor: '#e3f2fd', padding: '20px', borderRadius: '5px', marginBottom: '15px', textAlign: 'center' }}>
            <p style={{ margin: '0', fontSize: getFontSize('20px'), fontWeight: 'bold', color: '#0E62A0' }}>
              Total Weight Delivered: {totalWeight.toFixed(2)} lbs
            </p>
          </div>
        )}

        {/* Total weight section for detailed and summary modes */}
        {(showDetailedItems || showSummaryOnly) && showWeights && totalWeight > 0 && !showSummaryOnly && (
          <div style={{ backgroundColor: '#e3f2fd', padding: '15px', borderRadius: '5px', marginTop: '10px' }}>
            <p style={{ margin: '0', fontSize: getFontSize('18px'), fontWeight: 'bold', color: '#0E62A0' }}>
              Total Weight: {totalWeight.toFixed(2)} lbs
            </p>
          </div>
        )}
      </div>

      {options.showSignatures && (
        <div style={{ border: '2px solid #0E62A0', borderRadius: '8px', padding: '20px', marginTop: '30px' }}>
          <h3 style={{ color: '#0E62A0', marginBottom: '20px', fontSize: getFontSize('18px') }}>
            DELIVERY CONFIRMATION
          </h3>
          
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '400px' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: getFontSize('14px'), textAlign: 'center' }}>Client Signature:</p>
              <div style={{
                border: '1px solid #ccc', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9f9f9'
              }}>
                {signatureDataUrl ? (
                  <img src={signatureDataUrl} alt="Client Signature" style={{ maxHeight: '50px', maxWidth: '100%' }} />
                ) : signedByName === "No authorized personnel available at the time of delivery" ? (
                  <span style={{ color: '#333', fontSize: getFontSize('12px'), fontWeight: 'bold', textAlign: 'center', padding: '5px' }}>
                    No authorized personnel available at the time of delivery
                  </span>
                ) : (
                  <span style={{ color: '#666', fontSize: getFontSize('14px') }}>No signature captured</span>
                )}
              </div>
              <p style={{ marginTop: '5px', fontSize: getFontSize('12px'), color: '#666', textAlign: 'center' }}>
                Signed by: {signedByName}
              </p>
            </div>
          </div>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <p style={{ fontSize: getFontSize('12px'), color: '#666', fontStyle: 'italic' }}>
              By signing above, I acknowledge receipt of the services listed on this delivery ticket.
              <br />Date: {formatDateEnglish(deliveryDate)}
            </p>
          </div>
        </div>
      )}

      <div style={{ marginTop: '30px', textAlign: 'center', fontSize: getFontSize('12px'), color: '#666', borderTop: '1px solid #eee', paddingTop: '15px' }}>
        Thank you for choosing King Uniforms
        <br />
        Delivery Ticket #{ticketNumber} • {clientName}
      </div>
      
      {/* Custom Footer */}
      {options.footerText && (
        <div style={{ 
          textAlign: 'center', 
          marginTop: '15px', 
          padding: '10px',
          backgroundColor: '#f8f9fa',
          borderRadius: '5px',
          fontSize: getFontSize('12px'),
          color: '#666',
          fontStyle: 'italic'
        }}>
          {options.footerText}
        </div>
      )}
    </div>
  );
};

export default SignedDeliveryTicket;
