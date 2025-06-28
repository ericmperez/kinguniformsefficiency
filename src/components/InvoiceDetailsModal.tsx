import React from "react";
import { Invoice } from "../types";

interface InvoiceDetailsModalProps {
  invoice: Invoice;
  onClose: () => void;
}

const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  invoice,
  onClose,
}) => {
  return (
    <div
      className="modal show"
      style={{ display: "block", background: "rgba(0,0,0,0.3)" }}
    >
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Invoice #{invoice.invoiceNumber}</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            <h6>Client: {invoice.clientName}</h6>
            <h6>Date: {invoice.date}</h6>
            <h6>Total Carts: {invoice.carts.length}</h6>
            {invoice.carts.map((cart) => (
              <div key={cart.id} className="cart-section">
                <h6>Cart: {cart.name}</h6>
                <h6>Total: ${cart.total}</h6>
                <ul>
                  {cart.items.map((item) => (
                    <li key={item.productId}>
                      {item.productName} - {item.quantity} x ${item.price}{" "}
                      (Added by: {item.addedBy})
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceDetailsModal;
