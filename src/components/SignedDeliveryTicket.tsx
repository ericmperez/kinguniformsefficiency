import React from 'react';
import { Invoice, Client } from '../types';

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
    showTimestamp: true,
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
  const showDetailedItems = contentDisplay === 'detailed' && showItems;
  const showSummaryOnly = contentDisplay === 'summary';
  const showWeightOnly = contentDisplay === 'weight-only';
  
  const items = invoice.carts.flatMap((cart) => cart.items || []);
  const totalWeight = invoice.totalWeight || 0;
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  return (
    <div className="signed-delivery-ticket" style={{
      fontFamily: 'Arial, sans-serif',
      padding: '20px',
      backgroundColor: 'white',
      width: '8.5in',
      minHeight: '11in',
      margin: '0 auto',
      boxSizing: 'border-box'
    }}>
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
          style={{ width: '160px', height: '53px' }}
        />
        <div style={{ textAlign: 'right' }}>
          <h2 style={{ margin: '0', color: '#0E62A0', fontSize: '24px' }}>
            DELIVERY CONFIRMATION
          </h2>
          <p style={{ margin: '5px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Ticket #{ticketNumber}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '25px' }}>
        <div>
          <h3 style={{ color: '#0E62A0', marginBottom: '10px', fontSize: '18px' }}>
            CLIENT INFORMATION
          </h3>
          <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '5px 0' }}>
            {clientName}
          </p>
        </div>
        <div>
          <p style={{ margin: '5px 0', fontSize: '18px', fontWeight: 'bold' }}>
            Delivery Date: {deliveryDate}
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '25px' }}>
        <h3 style={{ color: '#0E62A0', marginBottom: '15px', fontSize: '18px' }}>
          SERVICES PROVIDED
        </h3>
        
        {showDetailedItems && items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ border: '1px solid #dee2e6', padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>
                  ITEM/SERVICE
                </th>
                {showQuantities && (
                  <th style={{ border: '1px solid #dee2e6', padding: '10px', textAlign: 'center', fontWeight: 'bold', width: '120px' }}>
                    QUANTITY
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>
                    {item.productName}
                  </td>
                  {showQuantities && (
                    <td style={{ border: '1px solid #dee2e6', padding: '8px', textAlign: 'center' }}>
                      {item.quantity}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {(showDetailedItems || showSummaryOnly) && showWeights && totalWeight > 0 && (
          <div style={{ backgroundColor: '#e3f2fd', padding: '15px', borderRadius: '5px', marginTop: '10px' }}>
            <p style={{ margin: '0', fontSize: '18px', fontWeight: 'bold', color: '#0E62A0' }}>
              Total Weight: {totalWeight.toFixed(2)} lbs
            </p>
          </div>
        )}
      </div>

      <div style={{ border: '2px solid #0E62A0', borderRadius: '8px', padding: '20px', marginTop: '30px' }}>
        <h3 style={{ color: '#0E62A0', marginBottom: '20px', fontSize: '18px' }}>
          DELIVERY CONFIRMATION
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
          <div>
            <p style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>Driver:</p>
            <div style={{
              border: '1px solid #ccc', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#f9f9f9', fontSize: '14px', fontWeight: 'bold'
            }}>
              <span style={{ color: '#333', fontSize: '14px', fontWeight: 'bold' }}>
                {driverName || 'Not Assigned'}
              </span>
            </div>
          </div>

          <div>
            <p style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>Client Signature:</p>
            <div style={{
              border: '1px solid #ccc', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9f9f9'
            }}>
              {signatureDataUrl ? (
                <img src={signatureDataUrl} alt="Client Signature" style={{ maxHeight: '50px', maxWidth: '100%' }} />
              ) : (
                <span style={{ color: '#666', fontSize: '14px' }}>No signature captured</span>
              )}
            </div>
            <p style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
              Signed by: {signedByName}
            </p>
          </div>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
            By signing above, I acknowledge receipt of the services listed on this delivery ticket.
            <br />Date: {deliveryDate}
          </p>
        </div>
      </div>

      <div style={{ marginTop: '30px', textAlign: 'center', fontSize: '12px', color: '#666', borderTop: '1px solid #eee', paddingTop: '15px' }}>
        Thank you for choosing King Uniforms
        <br />
        Delivery Ticket #{ticketNumber} • {clientName}
      </div>
    </div>
  );
};

export default SignedDeliveryTicket;
