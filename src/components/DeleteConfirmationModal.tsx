import React from "react";

interface DeleteConfirmationModalProps {
  show?: boolean;
  onClose?: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  invoice?: any; // Optional, for compatibility with invoice deletion
  onCancel?: () => void; // For compatibility with onCancel usage
  confirmButtonText?: string;
  confirmButtonClass?: string;
  fullscreen?: boolean; // Option to make modal full screen
}

export const DeleteConfirmationModal: React.FC<
  DeleteConfirmationModalProps
> = ({
  show = true,
  onClose,
  onConfirm,
  title = "Delete Confirmation",
  message = "Are you sure you want to delete this item? This action cannot be undone.",
  invoice,
  onCancel,
  confirmButtonText = "Delete",
  confirmButtonClass = "btn-danger",
  fullscreen = false,
}) => {
  if (show === false) return null;
  return (
    <div
      className="modal show d-block"
      tabIndex={-1}
      style={
        fullscreen
          ? {
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.8)",
              zIndex: 3000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }
          : undefined
      }
    >
      <div
        className="modal-dialog"
        style={
          fullscreen
            ? {
                maxWidth: "100vw",
                width: "100vw",
                height: "100vh",
                margin: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }
            : undefined
        }
      >
        <div
          className="modal-content"
          style={
            fullscreen
              ? {
                  width: "100vw",
                  height: "100vh",
                  border: "none",
                  borderRadius: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }
              : undefined
          }
        >
          <div
            className="modal-header"
            style={
              fullscreen
                ? {
                    background: "linear-gradient(135deg, #007bff, #0056b3)",
                    color: "white",
                    borderBottom: "none",
                    padding: "2rem",
                    flexShrink: 0,
                    textAlign: "center",
                  }
                : undefined
            }
          >
            <h5
              className="modal-title"
              style={
                fullscreen
                  ? {
                      fontSize: "3rem",
                      fontWeight: "bold",
                      width: "100%",
                      textAlign: "center",
                    }
                  : undefined
              }
            >
              {title}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose || onCancel}
              aria-label="Close"
              style={
                fullscreen
                  ? {
                      position: "absolute",
                      top: "1rem",
                      right: "1rem",
                      fontSize: "2rem",
                      width: "3rem",
                      height: "3rem",
                    }
                  : undefined
              }
            ></button>
          </div>
          <div
            className="modal-body"
            style={
              fullscreen
                ? {
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2.5rem",
                    textAlign: "center",
                    padding: "4rem",
                    background: "linear-gradient(180deg, #f8f9fa, #ffffff)",
                  }
                : undefined
            }
          >
            <div>
              <p
                style={
                  fullscreen
                    ? {
                        fontSize: "2.5rem",
                        lineHeight: "1.4",
                        margin: 0,
                        fontWeight: "500",
                        color: "#333",
                      }
                    : undefined
                }
              >
                {message}
              </p>
              {invoice && (
                <div
                  className="alert alert-warning mt-4"
                  style={
                    fullscreen
                      ? {
                          fontSize: "2rem",
                          padding: "2rem",
                          margin: "3rem 0 0 0",
                          borderRadius: "15px",
                        }
                      : undefined
                  }
                >
                  Invoice #{invoice.id} for {invoice.clientName}
                </div>
              )}
            </div>
          </div>
          <div
            className="modal-footer"
            style={
              fullscreen
                ? {
                    padding: "3rem",
                    borderTop: "none",
                    flexShrink: 0,
                    display: "flex",
                    justifyContent: "center",
                    gap: "4rem",
                    background: "#f8f9fa",
                  }
                : undefined
            }
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose || onCancel}
              style={
                fullscreen
                  ? {
                      fontSize: "2.5rem",
                      padding: "2rem 5rem",
                      minWidth: "300px",
                      fontWeight: "bold",
                      borderRadius: "15px",
                      border: "3px solid #6c757d",
                    }
                  : undefined
              }
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${confirmButtonClass}`}
              onClick={onConfirm}
              style={
                fullscreen
                  ? {
                      fontSize: "2.5rem",
                      padding: "2rem 5rem",
                      minWidth: "300px",
                      fontWeight: "bold",
                      borderRadius: "15px",
                      border: confirmButtonClass.includes("success")
                        ? "3px solid #198754"
                        : "3px solid #dc3545",
                    }
                  : undefined
              }
            >
              {confirmButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
