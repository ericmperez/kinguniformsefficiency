import React, { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { doc, updateDoc, Timestamp, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { logActivity } from "../services/firebaseService";
import { sendSignatureEmail } from "../services/emailService";
import { generateLaundryTicketPDF } from "../services/pdfService";
import { Client, Invoice } from "../types";

interface SignatureModalProps {
  show: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber?: string;
  clientName: string;
  clientId: string;
  invoice?: Invoice;
  onSignatureSaved?: () => void;
}

const SignatureModal: React.FC<SignatureModalProps> = ({
  show,
  onClose,
  invoiceId,
  invoiceNumber,
  clientName,
  clientId,
  invoice,
  onSignatureSaved,
}) => {
  const sigCanvas = useRef<SignatureCanvas | null>(null);
  const [sigName, setSigName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [noPersonnelAvailable, setNoPersonnelAvailable] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Enhanced close function with confirmation
  const handleClose = () => {
    if (!sigCanvas.current?.isEmpty() || sigName.trim() || noPersonnelAvailable) {
      setShowConfirmation(true);
    } else {
      onClose();
    }
  };

  const confirmClose = () => {
    setShowConfirmation(false);
    onClose();
  };

  const cancelClose = () => {
    setShowConfirmation(false);
  };

  // Mobile-specific configuration with landscape orientation lock
  useEffect(() => {
    if (!show) return;

    // Disable viewport zooming during signature capture on mobile
    const viewport = document.querySelector('meta[name="viewport"]');
    const originalViewportContent = viewport?.getAttribute('content');
    
    // Lock to landscape orientation on mobile devices
    const lockToLandscape = async () => {
      try {
        // Request landscape orientation if available (with proper type casting)
        const orientation = (screen as any).orientation;
        if (orientation && orientation.lock) {
          await orientation.lock('landscape');
        }
      } catch (error) {
        console.log('Screen orientation lock not available or denied:', error);
      }
    };

    // Apply mobile-optimized viewport settings
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }

    // Lock to landscape on mobile
    lockToLandscape();

    // Cleanup function
    return () => {
      // Restore original viewport settings when modal closes
      if (viewport && originalViewportContent) {
        viewport.setAttribute('content', originalViewportContent);
      }

      // Unlock orientation when modal closes
      try {
        const orientation = (screen as any).orientation;
        if (orientation && orientation.unlock) {
          orientation.unlock();
        }
      } catch (error) {
        console.log('Screen orientation unlock not available:', error);
      }
    };
  }, [show]);

  // Helper function to send signature email if configured
  const sendSignatureEmailIfEnabled = async (receivedByName: string) => {
    try {
      if (!clientId || !invoice) {
        console.log("Missing client ID or invoice data for signature email");
        return;
      }

      // Get client configuration from Firestore
      const clientRef = doc(db, "clients", clientId);
      const clientSnap = await getDoc(clientRef);
      
      if (!clientSnap.exists()) {
        console.log("Client not found for signature email");
        return;
      }

      const client = { id: clientSnap.id, ...clientSnap.data() } as Client;

      // Check if signature email is enabled
      const emailSettings = client.printConfig?.emailSettings;
      if (!emailSettings?.enabled || !emailSettings?.autoSendOnSignature) {
        console.log("Signature email not enabled for this client");
        return;
      }

      if (!client.email) {
        console.log("Client has no email address configured for signature email");
        return;
      }

      // Prepare signature data
      const now = new Date();
      const signatureData = {
        receivedBy: receivedByName,
        signatureDate: now.toLocaleDateString(),
        signatureTime: now.toLocaleTimeString(),
      };

      // Generate PDF for attachment
      let pdfContent: string | undefined;
      try {
        pdfContent = await generateLaundryTicketPDF(invoice, client);
      } catch (err) {
        console.error("Failed to generate PDF for signature email:", err);
      }

      // Send signature email
      const success = await sendSignatureEmail(
        client,
        invoice,
        emailSettings,
        signatureData,
        pdfContent
      );

      if (success) {
        // Log the email activity
        await logActivity({
          type: "Email",
          message: `Signature confirmation email sent automatically to ${client.name} (${client.email}) for laundry ticket #${invoice.invoiceNumber || invoice.id}`,
        });
        console.log("✅ Signature email sent successfully");
      } else {
        console.log("❌ Failed to send signature email");
      }
    } catch (error) {
      console.error("Error sending signature email:", error);
    }
  };

  // Clear the signature pad
  const clear = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
  };

  // Save the signature to Firebase
  const saveSignature = async () => {
    // If "no personnel available" is checked, allow saving without signature or name
    if (noPersonnelAvailable) {
      try {
        setIsSaving(true);
        setErrorMessage("");

        // Update the invoice document with no personnel flag
        const invoiceRef = doc(db, "invoices", invoiceId);
        await updateDoc(invoiceRef, {
          signature: {
            image: null,
            name: "No authorized personnel available at the time of delivery",
            timestamp: Timestamp.now(),
            noPersonnelAvailable: true,
          },
          receivedBy: "No authorized personnel available at the time of delivery",
        });

        // Send signature email if configured (even for no personnel case)
        await sendSignatureEmailIfEnabled("No authorized personnel available at the time of delivery");

        // Call the callback function if provided
        if (onSignatureSaved) {
          onSignatureSaved();
        }

        onClose();
        return;
      } catch (error) {
        console.error("Error saving no personnel signature:", error);
        setErrorMessage("Failed to save. Please try again.");
        setIsSaving(false);
        return;
      }
    }

    // Regular signature validation
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      setErrorMessage("Please provide a signature");
      return;
    }

    if (!sigName.trim()) {
      setErrorMessage("Please enter the name of the person signing");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");

      // Convert signature to data URL
      const signatureDataUrl = sigCanvas.current.toDataURL();

      // Update the invoice document
      const invoiceRef = doc(db, "invoices", invoiceId);
      await updateDoc(invoiceRef, {
        signature: {
          image: signatureDataUrl,
          name: sigName,
          timestamp: Timestamp.now(),
          noPersonnelAvailable: false,
        },
        receivedBy: sigName,
      });

      // Send signature email if configured
      await sendSignatureEmailIfEnabled(sigName);

      // Call the callback function if provided
      if (onSignatureSaved) {
        onSignatureSaved();
      }

      onClose();
    } catch (error) {
      console.error("Error saving signature:", error);
      setErrorMessage("Failed to save signature. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="modal show d-block"
      style={{ 
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1050,
        touchAction: "manipulation", // Improve touch responsiveness
      }}
    >
      <style>
        {`
          .signature-canvas {
            touch-action: none !important;
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
          }
          
          /* Prevent zoom on mobile when touching signature area */
          .signature-canvas canvas {
            touch-action: none !important;
          }
          
          /* Landscape-optimized layout */
          @media screen and (orientation: landscape) {
            .signature-modal-landscape {
              padding: 10px !important;
            }
            
            .signature-modal-landscape .modal-header {
              padding: 10px 15px !important;
              min-height: 60px;
            }
            
            .signature-modal-landscape .form-fields {
              padding: 10px 15px !important;
            }
            
            .signature-modal-landscape .signature-area {
              min-height: calc(100vh - 200px) !important;
            }
            
            .signature-modal-landscape .modal-footer {
              padding: 10px 15px !important;
              min-height: 60px;
            }
          }
          
          /* Portrait warning for mobile devices */
          @media screen and (orientation: portrait) and (max-width: 768px) {
            .orientation-warning {
              display: flex !important;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              height: 100vh;
              background: rgba(0, 0, 0, 0.95);
              color: white;
              text-align: center;
              padding: 20px;
            }
            
            .orientation-warning .rotate-icon {
              font-size: 4rem;
              margin-bottom: 20px;
              animation: rotate 2s linear infinite;
            }
            
            @keyframes rotate {
              from { transform: rotate(0deg); }
              to { transform: rotate(90deg); }
            }
          }
          
          /* Improve button touch targets for mobile */
          @media (max-width: 768px) {
            .btn-lg {
              min-height: 48px;
              font-size: 1.1rem;
            }
            
            .form-control-lg {
              min-height: 48px;
              font-size: 1.1rem;
            }
            
            /* Make signature area more prominent on mobile */
            .signature-canvas {
              min-height: 300px !important;
            }
          }
          
          /* Prevent mobile browser zoom when double-tapping */
          @media (max-width: 768px) {
            .signature-canvas, .signature-canvas canvas {
              touch-action: none !important;
              user-select: none !important;
              -webkit-user-select: none !important;
              -webkit-touch-callout: none !important;
            }
            
            /* Ensure footer stays visible above mobile keyboards */
            .modal-content {
              min-height: 100vh;
              display: flex;
              flex-direction: column;
            }
            
            /* Make sure action buttons are always reachable */
            .modal-footer-mobile {
              position: fixed !important;
              bottom: 0 !important;
              left: 0 !important;
              right: 0 !important;
              z-index: 9999 !important;
              background: white !important;
              border-top: 1px solid #dee2e6 !important;
              box-shadow: 0 -2px 10px rgba(0,0,0,0.1) !important;
            }
          }
        `}
      </style>
      {/* Orientation Warning for Portrait Mode on Mobile */}
      <div className="orientation-warning d-none">
        <div className="rotate-icon">
          <i className="bi bi-phone"></i>
        </div>
        <h3>Please Rotate Your Device</h3>
        <p>For the best signature experience, please rotate your device to landscape mode.</p>
        <div className="mt-3">
          <i className="bi bi-arrow-repeat me-2"></i>
          Rotate to continue
        </div>
      </div>

      <div 
        className="h-100 w-100 d-flex flex-column signature-modal-landscape"
        style={{ 
          maxWidth: "100vw",
          maxHeight: "100vh",
          margin: 0
        }}
      >
        <div className="flex-shrink-0 bg-white">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
            <div>
              <h4 className="mb-0">
                Signature for {clientName}
              </h4>
              {invoiceNumber && (
                <small className="text-muted">Laundry Ticket #{invoiceNumber}</small>
              )}
            </div>
            <div className="d-flex gap-2">
              {/* Mobile-friendly Save button in header */}
              <button
                className="btn btn-success btn-lg d-md-none"
                onClick={saveSignature}
                disabled={isSaving || (!noPersonnelAvailable && (!sigName.trim() || !sigCanvas.current || sigCanvas.current.isEmpty()))}
                style={{ minWidth: "120px" }}
              >
                {isSaving ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Saving...
                  </>
                ) : noPersonnelAvailable ? (
                  "Confirm"
                ) : (
                  "Save"
                )}
              </button>
              <button
                type="button"
                className="btn-close btn-close-dark"
                onClick={handleClose}
                disabled={isSaving}
                style={{ fontSize: "1.2rem" }}
              ></button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="alert alert-danger m-3 mb-0">{errorMessage}</div>
          )}

          {/* Delivery Summary */}
          {invoice && invoice.carts && (
            <div className="alert alert-success m-3 mb-0">
              <i className="bi bi-truck me-2"></i>
              <strong>🛒 Delivery Details:</strong>
              <div className="mt-2">
                <div className="row text-center">
                  <div className="col-6">
                    <h5 className="mb-0 text-success">{invoice.carts.length}</h5>
                    <small>Cart{invoice.carts.length !== 1 ? 's' : ''}</small>
                  </div>
                  <div className="col-6">
                    <h5 className="mb-0 text-success">{invoice.carts.reduce((total, cart) => total + cart.items.length, 0)}</h5>
                    <small>Total Items</small>
                  </div>
                </div>
                <div className="mt-2 small text-muted">
                  <strong>Cart breakdown:</strong> {invoice.carts.map((cart, index) => 
                    `${cart.name} (${cart.items.length} item${cart.items.length !== 1 ? 's' : ''})`
                  ).join(', ')}
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="alert alert-info m-3 mb-0">
            <i className="bi bi-info-circle-fill me-2"></i>
            Please have the person who received the delivery sign below to confirm receipt.
            <div className="small mt-1 text-muted">
              <strong>Mobile users:</strong> Use your finger to sign directly on the signature area below.
            </div>
          </div>

          {/* Form Fields - Compact for landscape */}
          <div className="p-3 form-fields">
            {/* Landscape-optimized layout */}
            <div className="row g-2">
              <div className="col-lg-6 col-12">
                <label className="form-label fw-bold">Receiver's Name</label>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  value={sigName}
                  onChange={(e) => setSigName(e.target.value)}
                  placeholder="Enter the name of person receiving"
                  disabled={isSaving || noPersonnelAvailable}
                  style={{ 
                    fontSize: "1.1rem",
                    minHeight: "50px", // Better touch target for mobile
                  }}
                />
              </div>
              <div className="col-lg-6 col-12">
                <div className="form-check h-100 d-flex align-items-center" style={{ 
                  padding: "15px", 
                  backgroundColor: "#f8f9fa", 
                  border: "1px solid #dee2e6", 
                  borderRadius: "8px",
                  minHeight: "60px"
                }}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="noPersonnelAvailable"
                    checked={noPersonnelAvailable}
                    onChange={(e) => {
                      setNoPersonnelAvailable(e.target.checked);
                      if (e.target.checked) {
                        setSigName("");
                        if (sigCanvas.current) {
                          sigCanvas.current.clear();
                        }
                      }
                      setErrorMessage("");
                    }}
                    disabled={isSaving}
                    style={{ marginRight: "10px", transform: "scale(1.2)" }}
                  />
                  <label className="form-check-label" htmlFor="noPersonnelAvailable" style={{ fontWeight: "500", color: "#495057" }}>
                    <i className="bi bi-exclamation-triangle-fill me-2" style={{ color: "#ffc107" }}></i>
                    No authorized personnel available at the time of delivery
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Area - Optimized for landscape */}
        <div className="flex-grow-1 bg-white mx-3 mb-3 border rounded signature-area" style={{ minHeight: "250px" }}>
          <div className="h-100 d-flex flex-column">
            <div className="p-2 border-bottom">
              <div className="d-flex justify-content-between align-items-center">
                <label className="form-label fw-bold mb-0">Signature</label>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={clear}
                  disabled={isSaving || noPersonnelAvailable}
                >
                  <i className="bi bi-x-lg me-1"></i>
                  Clear
                </button>
              </div>
            </div>
            <div
              className="flex-grow-1 position-relative"
              style={{
                backgroundColor: noPersonnelAvailable ? "#f1f3f5" : "#ffffff",
                opacity: noPersonnelAvailable ? 0.5 : 1,
                minHeight: "200px", // Optimized for landscape
              }}
              onTouchStart={(e) => {
                // Prevent default touch behavior that might interfere with signature
                if (!noPersonnelAvailable) {
                  e.preventDefault();
                }
              }}
            >
              <SignatureCanvas
                ref={sigCanvas}
                penColor="black"
                canvasProps={{
                  width: 1000, // Increased width for landscape
                  height: 400,
                  style: {
                    width: "100%",
                    height: "100%",
                    touchAction: "none", // Prevent scrolling on touch
                  },
                  className: "signature-canvas",
                }}
                // Mobile touch support optimized for landscape
                dotSize={2}
                minWidth={1}
                maxWidth={4} // Slightly thicker for landscape
                velocityFilterWeight={0.7}
                // Ensure touch events work properly
                backgroundColor="rgba(255,255,255,0)"
              />

              {(sigCanvas.current?.isEmpty() ?? true) && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    color: "#adb5bd",
                    pointerEvents: "none",
                    fontSize: "1.8rem", // Larger for landscape
                    textAlign: "center"
                  }}
                >
                  <div>
                    <i className="bi bi-pen" style={{ fontSize: "4rem", display: "block", marginBottom: "15px" }}></i>
                    {noPersonnelAvailable ? "Signature not required" : "Sign here with your finger"}
                  </div>
                  <div style={{ fontSize: "1rem", marginTop: "10px", color: "#6c757d" }}>
                    📱 Rotate to landscape for best experience
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - Fixed positioning on mobile */}
        <div className="flex-shrink-0 bg-white border-top" style={{
          position: "sticky",
          bottom: 0,
          zIndex: 10
        }}>
          <div className="p-3 d-flex justify-content-end gap-3">
            {/* Desktop buttons (hidden on mobile since we have header button) */}
            <button
              className="btn btn-secondary btn-lg d-none d-md-inline-block"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary btn-lg d-none d-md-inline-block"
              onClick={saveSignature}
              disabled={isSaving || (!noPersonnelAvailable && (!sigName.trim() || !sigCanvas.current || sigCanvas.current.isEmpty()))}
            >
              {isSaving ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  ></span>
                  Saving...
                </>
              ) : noPersonnelAvailable ? (
                "Confirm No Personnel Available"
              ) : (
                "Save Signature"
              )}
            </button>
            
            {/* Mobile-only action bar */}
            <div className="d-md-none w-100 d-flex gap-2">
              <button
                className="btn btn-outline-secondary flex-fill"
                onClick={handleClose}
                disabled={isSaving}
                style={{ minHeight: "50px" }}
              >
                <i className="bi bi-x-lg me-1"></i>
                Cancel
              </button>
              <button
                className="btn btn-success flex-fill"
                onClick={saveSignature}
                disabled={isSaving || (!noPersonnelAvailable && (!sigName.trim() || !sigCanvas.current || sigCanvas.current.isEmpty()))}
                style={{ minHeight: "50px" }}
              >
                {isSaving ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-1"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Saving...
                  </>
                ) : noPersonnelAvailable ? (
                  <>
                    <i className="bi bi-check-lg me-1"></i>
                    Confirm
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg me-1"></i>
                    Save Signature
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Floating Action Button for Mobile - Always visible */}
        <div 
          className="d-md-none position-fixed"
          style={{
            bottom: "20px",
            right: "20px",
            zIndex: 9999,
          }}
        >
          <button
            className="btn btn-success btn-lg rounded-circle shadow-lg"
            onClick={saveSignature}
            disabled={isSaving || (!noPersonnelAvailable && (!sigName.trim() || !sigCanvas.current || sigCanvas.current.isEmpty()))}
            style={{
              width: "60px",
              height: "60px",
              fontSize: "1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={noPersonnelAvailable ? "Confirm No Personnel Available" : "Save Signature"}
          >
            {isSaving ? (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              ></span>
            ) : (
              <i className="bi bi-check-lg"></i>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Exit */}
      {showConfirmation && (
        <div 
          className="modal show d-block"
          style={{ 
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            zIndex: 1060, // Higher than signature modal
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-exclamation-triangle-fill me-2 text-warning"></i>
                  Confirm Exit
                </h5>
              </div>
              <div className="modal-body">
                <p>You have unsaved changes to the signature. Are you sure you want to exit without saving?</p>
                <div className="alert alert-warning">
                  <small>
                    <i className="bi bi-info-circle me-1"></i>
                    Any signature or name entered will be lost if you continue.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={cancelClose}
                >
                  <i className="bi bi-arrow-left me-1"></i>
                  Continue Editing
                </button>
                <button
                  className="btn btn-danger"
                  onClick={confirmClose}
                >
                  <i className="bi bi-x-lg me-1"></i>
                  Exit Without Saving
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignatureModal;
