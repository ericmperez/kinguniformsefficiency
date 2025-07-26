import React, { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { doc, updateDoc, Timestamp, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { logActivity } from "../services/firebaseService";
import { sendSignatureEmail } from "../services/emailService";
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

      // Send signature email
      const success = await sendSignatureEmail(
        client,
        invoice,
        emailSettings,
        signatureData
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
        zIndex: 1050
      }}
    >
      <div 
        className="h-100 w-100 d-flex flex-column"
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
            <button
              type="button"
              className="btn-close btn-close-dark"
              onClick={onClose}
              disabled={isSaving}
              style={{ fontSize: "1.2rem" }}
            ></button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="alert alert-danger m-3 mb-0">{errorMessage}</div>
          )}

          {/* Instructions */}
          <div className="alert alert-info m-3 mb-0">
            <i className="bi bi-info-circle-fill me-2"></i>
            Please have the person who received the delivery sign below to confirm receipt.
          </div>

          {/* Form Fields */}
          <div className="p-3">
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label fw-bold">Receiver's Name</label>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  value={sigName}
                  onChange={(e) => setSigName(e.target.value)}
                  placeholder="Enter the name of person receiving"
                  disabled={isSaving || noPersonnelAvailable}
                  style={{ fontSize: "1.1rem" }}
                />
              </div>
              <div className="col-md-6 mb-3">
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

        {/* Signature Area - Takes remaining space */}
        <div className="flex-grow-1 bg-white mx-3 mb-3 border rounded" style={{ minHeight: "300px" }}>
          <div className="h-100 d-flex flex-column">
            <div className="p-3 border-bottom">
              <div className="d-flex justify-content-between align-items-center">
                <label className="form-label fw-bold mb-0">Signature</label>
                <button
                  className="btn btn-outline-secondary"
                  onClick={clear}
                  disabled={isSaving || noPersonnelAvailable}
                >
                  <i className="bi bi-x-lg me-1"></i>
                  Clear Signature
                </button>
              </div>
            </div>
            <div
              className="flex-grow-1 position-relative"
              style={{
                backgroundColor: noPersonnelAvailable ? "#f1f3f5" : "#ffffff",
                opacity: noPersonnelAvailable ? 0.5 : 1,
              }}
            >
              <SignatureCanvas
                ref={sigCanvas}
                penColor="black"
                canvasProps={{
                  style: {
                    width: "100%",
                    height: "100%"
                  },
                  className: "signature-canvas",
                }}
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
                    fontSize: "1.5rem",
                    textAlign: "center"
                  }}
                >
                  <div>
                    <i className="bi bi-pen" style={{ fontSize: "3rem", display: "block", marginBottom: "10px" }}></i>
                    {noPersonnelAvailable ? "Signature not required" : "Sign here"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 bg-white border-top">
          <div className="p-3 d-flex justify-content-end gap-3">
            <button
              className="btn btn-secondary btn-lg"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary btn-lg"
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;
