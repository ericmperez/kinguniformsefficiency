import React, { useState, useEffect, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Invoice } from "../types";
import SignatureModal from "./SignatureModal";
import { API_BASE_URL } from "../config/api";

interface InvoiceDetailsPopupProps {
  invoiceId: string;
  onClose: () => void;
  onRefresh?: () => void;
}

const InvoiceDetailsPopup: React.FC<InvoiceDetailsPopupProps> = ({
  invoiceId,
  onClose,
  onRefresh,
}) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showSignatureModal, setShowSignatureModal] = useState<boolean>(false);
  const printableContentRef = useRef<HTMLDivElement>(null);

  // Email state
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [emailTo, setEmailTo] = useState<string>("");
  const [emailStatus, setEmailStatus] = useState<string>("");
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      try {
        setLoading(true);
        const invoiceRef = doc(db, "invoices", invoiceId);
        const invoiceSnapshot = await getDoc(invoiceRef);

        if (invoiceSnapshot.exists()) {
          setInvoice({
            id: invoiceSnapshot.id,
            ...invoiceSnapshot.data(),
          } as Invoice);
        } else {
          console.error("Invoice not found");
        }
      } catch (error) {
        console.error("Error fetching invoice details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceDetails();
  }, [invoiceId]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow && printableContentRef.current) {
      const content = printableContentRef.current.innerHTML;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice #${
            invoice?.invoiceNumber || invoice?.id?.substring(0, 8)
          }</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .signature-img { max-width: 100%; max-height: 150px; }
            @media print {
              .no-print { display: none; }
              .page-break { page-break-before: always; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h4>King Uniforms - Delivery Confirmation</h4>
              <button onclick="window.print()" class="btn btn-primary no-print">Print</button>
            </div>
            <div class="content">
              ${content}
            </div>
          </div>
        </body>
        </html>
      `);

      printWindow.document.close();
    }
  };

  // Function to send invoice via email
  const sendEmail = async () => {
    if (!emailTo) {
      setEmailStatus("Please enter an email address");
      return;
    }

    setIsSendingEmail(true);
    setEmailStatus("");

    try {
      if (!printableContentRef.current) {
        throw new Error("Invoice content not found");
      }

      // Clone the content to modify it for email
      const emailContent = printableContentRef.current.cloneNode(
        true
      ) as HTMLElement;

      // Generate HTML content for the email
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
          <h2 style="color: #0d6efd;">King Uniforms - Delivery Confirmation</h2>
          <p>Please find the attached delivery confirmation for invoice #${
            invoice?.invoiceNumber || invoice?.id?.substring(0, 8)
          }.</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;" />
          ${emailContent.innerHTML}
          <hr style="border: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">This is an automated message from King Uniforms.</p>
        </div>
      `;

      const response = await fetch(`${API_BASE_URL}/api/send-invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: emailTo,
          subject: `Delivery Confirmation - Invoice #${
            invoice?.invoiceNumber || invoice?.id?.substring(0, 8)
          }`,
          text: "Please see the attached delivery confirmation.",
          html: htmlContent,
        }),
      });

      if (response.ok) {
        setEmailStatus("Email sent successfully");
        setShowEmailModal(false);
      } else {
        throw new Error("Failed to send email");
      }
    } catch (error) {
      console.error("Error sending email:", error);
      setEmailStatus("Failed to send email. Please try again.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendEmail = async () => {
    if (!invoice) return;

    setIsSendingEmail(true);
    setEmailStatus("");

    try {
      // Simulate email sending process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setEmailStatus("Email sent successfully!");

      // Optionally, you can trigger the email sending function from your backend here
      // For example, by calling a cloud function or an API endpoint
    } catch (error) {
      console.error("Error sending email:", error);
      setEmailStatus("Failed to send email. Please try again later.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div
        className="modal show d-block"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Loading Laundry Ticket Details...</h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body text-center py-4">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div
        className="modal show d-block"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Laundry Ticket Not Found</h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body">
              <p>Sorry, the laundry ticket details could not be found.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="modal show d-block"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      >
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                Laundry Ticket{" "}
                {invoice.invoiceNumber
                  ? `#${invoice.invoiceNumber}`
                  : invoice.id.substring(0, 8)}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body" ref={printableContentRef}>
              <div className="row mb-4">
                <div className="col-md-6">
                  <div className="card h-100">
                    <div className="card-header bg-light">
                      <h6 className="mb-0">Client Information</h6>
                    </div>
                    <div className="card-body">
                      <p className="mb-2">
                        <strong>Name:</strong> {invoice.clientName}
                      </p>
                      <p className="mb-2">
                        <strong>Laundry Ticket Date:</strong>{" "}
                        {formatDate(invoice.date)}
                      </p>
                      <p className="mb-2">
                        <strong>Delivery Date:</strong>{" "}
                        {formatDate(invoice.deliveryDate)}
                      </p>
                      <p className="mb-2">
                        <strong>Laundry Ticket #:</strong>{" "}
                        {invoice.invoiceNumber || invoice.id.substring(0, 8)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card h-100">
                    <div className="card-header bg-light">
                      <h6 className="mb-0">Shipping Information</h6>
                    </div>
                    <div className="card-body">
                      <p className="mb-2">
                        <strong>Truck Number:</strong> {invoice.truckNumber}
                      </p>
                      <p className="mb-2">
                        <strong>Status:</strong>{" "}
                        <span className="badge bg-success">
                          {invoice.status}
                        </span>
                      </p>
                      {invoice.receivedBy && (
                        <p className="mb-2">
                          <strong>Received By:</strong> {invoice.receivedBy}
                        </p>
                      )}
                      {invoice.signature && invoice.signature.timestamp && (
                        <p className="mb-2">
                          <strong>Signed On:</strong>{" "}
                          {new Date(
                            invoice.signature.timestamp.toDate()
                          ).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h6 className="border-bottom pb-2">Carts & Items</h6>
                {invoice.carts && invoice.carts.length > 0 ? (
                  <div className="accordion" id="cartsAccordion">
                    {invoice.carts.map((cart, index) => (
                      <div className="accordion-item" key={cart.id}>
                        <h2 className="accordion-header">
                          <button
                            className="accordion-button collapsed"
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target={`#collapse-${cart.id}`}
                            aria-expanded="false"
                            aria-controls={`collapse-${cart.id}`}
                          >
                            <span className="fw-bold me-2">{cart.name}</span>
                            <span className="badge bg-secondary rounded-pill ms-2">
                              {cart.items.length} items
                            </span>
                          </button>
                        </h2>
                        <div
                          id={`collapse-${cart.id}`}
                          className="accordion-collapse collapse"
                          data-bs-parent="#cartsAccordion"
                        >
                          <div className="accordion-body p-0">
                            <table className="table table-sm mb-0">
                              <thead>
                                <tr>
                                  <th>Product</th>
                                  <th>Quantity</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cart.items.length > 0 ? (
                                  cart.items.map((item, itemIdx) => (
                                    <tr key={`${item.productId}-${itemIdx}`}>
                                      <td>{item.productName}</td>
                                      <td>{item.quantity}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={2} className="text-center">
                                      Empty cart
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted">No carts found</p>
                )}
              </div>

              <div className="mb-4">
                <h6 className="border-bottom pb-2">Product Summary</h6>
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th className="text-end">Total Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Calculate product totals across all carts
                        const productTotals: {
                          [key: string]: { name: string; quantity: number };
                        } = {};

                        invoice.carts?.forEach((cart) => {
                          cart.items.forEach((item) => {
                            if (!productTotals[item.productId]) {
                              productTotals[item.productId] = {
                                name: item.productName,
                                quantity: 0,
                              };
                            }
                            productTotals[item.productId].quantity +=
                              item.quantity;
                          });
                        });

                        const sortedProducts = Object.values(
                          productTotals
                        ).sort((a, b) => b.quantity - a.quantity);

                        return sortedProducts.length > 0 ? (
                          sortedProducts.map((product, idx) => (
                            <tr key={idx}>
                              <td>{product.name}</td>
                              <td className="text-end">{product.quantity}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2} className="text-center">
                              No products found
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {invoice.signature && (
                <div className="mb-4">
                  <div className="card">
                    <div className="card-header bg-success text-white d-flex align-items-center">
                      <i className="bi bi-pen-fill me-2"></i>
                      <h6 className="mb-0">Signature Confirmation</h6>
                    </div>
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-6 d-flex flex-column align-items-center justify-content-center">
                          {invoice.signature?.noPersonnelAvailable ? (
                            <div className="alert alert-warning text-center">
                              <i className="bi bi-exclamation-triangle-fill me-2"></i>
                              <strong>No Signature Available</strong>
                              <br />
                              <small>No authorized personnel was available at the time of delivery</small>
                            </div>
                          ) : invoice.signature?.image ? (
                            <div
                              className="border rounded p-2 mb-3 bg-light"
                              style={{ width: "100%" }}
                            >
                              <img
                                src={invoice.signature.image}
                                alt="Signature"
                                className="signature-img"
                              />
                            </div>
                          ) : (
                            <div className="alert alert-info text-center">
                              <i className="bi bi-info-circle me-2"></i>
                              <small>No signature image available</small>
                            </div>
                          )}
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="text-muted small">
                              SIGNED BY
                            </label>
                            <h5>{invoice.signature.name}</h5>
                          </div>
                          <div className="mb-3">
                            <label className="text-muted small">
                              DATE & TIME
                            </label>
                            <h5>
                              {invoice.signature.timestamp &&
                                new Date(
                                  invoice.signature.timestamp.toDate()
                                ).toLocaleString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                            </h5>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {!invoice.signature && (
                <button
                  className="btn btn-success me-auto"
                  onClick={() => setShowSignatureModal(true)}
                >
                  <i className="bi bi-pen me-1"></i> Capture Signature
                </button>
              )}
              <button
                className="btn btn-primary me-2"
                onClick={() => setShowEmailModal(true)}
                title="Email laundry ticket details"
              >
                <i className="bi bi-envelope me-1"></i> Email
              </button>
              <button
                className="btn btn-primary me-2"
                onClick={handlePrint}
                title="Print laundry ticket details"
              >
                <i className="bi bi-printer-fill me-1"></i> Print
              </button>
              <button className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      {showSignatureModal && (
        <SignatureModal
          show={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber?.toString()}
          clientName={invoice.clientName}
          clientId={invoice.clientId}
          invoice={invoice}
          onSignatureSaved={() => {
            // Refresh the invoice details
            const fetchInvoiceDetails = async () => {
              try {
                const invoiceRef = doc(db, "invoices", invoiceId);
                const invoiceSnapshot = await getDoc(invoiceRef);

                if (invoiceSnapshot.exists()) {
                  setInvoice({
                    id: invoiceSnapshot.id,
                    ...invoiceSnapshot.data(),
                  } as Invoice);
                }

                // Call parent refresh if provided
                if (onRefresh) {
                  onRefresh();
                }
              } catch (error) {
                console.error("Error refreshing invoice details:", error);
              }
            };
            fetchInvoiceDetails();
          }}
        />
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Email Laundry Ticket{" "}
                  {invoice?.invoiceNumber
                    ? `#${invoice.invoiceNumber}`
                    : invoice?.id.substring(0, 8)}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowEmailModal(false)}
                  disabled={isSendingEmail}
                ></button>
              </div>
              <div className="modal-body">
                {emailStatus && (
                  <div
                    className={`alert ${
                      emailStatus.includes("success")
                        ? "alert-success"
                        : "alert-danger"
                    }`}
                  >
                    {emailStatus}
                  </div>
                )}

                <div className="alert alert-info">
                  <i className="bi bi-info-circle-fill me-2"></i>
                  Send a delivery confirmation email with all laundry ticket details.
                </div>

                <div className="mb-3">
                  <label className="form-label">Recipient Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="Enter email address"
                    disabled={isSendingEmail}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowEmailModal(false)}
                  disabled={isSendingEmail}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={sendEmail}
                  disabled={isSendingEmail || !emailTo}
                >
                  {isSendingEmail ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-1"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-envelope-fill me-1"></i>
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InvoiceDetailsPopup;
