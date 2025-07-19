import React, { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";

interface SignatureModalProps {
  show: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber?: string;
  clientName: string;
  onSignatureSaved?: () => void;
}

const SignatureModal: React.FC<SignatureModalProps> = ({
  show,
  onClose,
  invoiceId,
  invoiceNumber,
  clientName,
  onSignatureSaved,
}) => {
  const sigCanvas = useRef<SignatureCanvas | null>(null);
  const [sigName, setSigName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Clear the signature pad
  const clear = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
    }
  };

  // Save the signature to Firebase
  const saveSignature = async () => {
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
        },
        receivedBy: sigName,
      });

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
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
    >
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              Signature for {clientName}
              {invoiceNumber && <span> - Invoice #{invoiceNumber}</span>}
            </h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={isSaving}
            ></button>
          </div>
          <div className="modal-body">
            {errorMessage && (
              <div className="alert alert-danger">{errorMessage}</div>
            )}

            <div className="alert alert-info">
              <i className="bi bi-info-circle-fill me-2"></i>
              Please have the person who received the delivery sign below to
              confirm receipt.
            </div>

            <div className="mb-3">
              <label className="form-label">Receiver's Name</label>
              <input
                type="text"
                className="form-control"
                value={sigName}
                onChange={(e) => setSigName(e.target.value)}
                placeholder="Enter the name of person receiving"
                disabled={isSaving}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Signature</label>
              <div
                className="signature-container border rounded"
                style={{
                  width: "100%",
                  height: "200px",
                  backgroundColor: "#f8f9fa",
                  position: "relative",
                }}
              >
                <SignatureCanvas
                  ref={sigCanvas}
                  penColor="black"
                  canvasProps={{
                    width: "100%",
                    height: "200px",
                    className: "signature-canvas",
                  }}
                />

                {sigCanvas.current && sigCanvas.current.isEmpty() && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      color: "#adb5bd",
                      pointerEvents: "none",
                    }}
                  >
                    <i className="bi bi-pen me-2"></i>
                    Sign here
                  </div>
                )}
              </div>
              <div className="mt-2 d-flex gap-2">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={clear}
                  disabled={isSaving}
                >
                  <i className="bi bi-x-lg me-1"></i>
                  Clear Signature
                </button>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={saveSignature}
              disabled={isSaving}
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
