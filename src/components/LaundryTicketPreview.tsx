import React from 'react';
import './LaundryTicketPreview.css';

interface LaundryTicketPreviewProps {
  ticketNumber: string;
  clientName: string;
  truck: string;
  pickupDate: string;
  items: { productName: string; quantity: number }[];
  pounds: number;
  logoUrl?: string;
}

const LaundryTicketPreview: React.FC<LaundryTicketPreviewProps> = ({
  ticketNumber,
  clientName,
  truck,
  pickupDate,
  items,
  pounds,
  logoUrl,
}) => {
  return (
    <div className="laundry-ticket-preview">
      <div className="ticket-header">
        <img 
          src={logoUrl || "/images/King Uniforms Logo.png"} 
          alt="Company Logo" 
          className="logo" 
          style={{
            maxWidth: '200px',
            maxHeight: '80px',
            objectFit: 'contain',
            imageRendering: 'crisp-edges'
          }}
        />
        <div className="ticket-info">
          <p>Ticket #: {ticketNumber}</p>
        </div>
      </div>
      <div className="laundry-service-info">
        <h2>Laundry Service</h2>
        <h1>{clientName}</h1>
        <p>Truck: {truck}</p>
        <p>Pick Up Date: {pickupDate}</p>
      </div>
      <div className="merchandise-table">
        <table>
          <thead>
            <tr>
              <th>MERCHANDISE</th>
              <th>QUANTITY</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>{item.productName}</td>
                <td>{item.quantity}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Pounds</td>
              <td>{pounds.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="signature-section">
        <div className="signature-line">
          <p>KUIL Representative</p>
        </div>
        <div className="signature-line">
          <p>Delivery Date</p>
        </div>
        <div className="signature-line">
          <p>Client Representative</p>
        </div>
      </div>
    </div>
  );
};

export default LaundryTicketPreview;
