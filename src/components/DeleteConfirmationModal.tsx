import React from 'react';

interface DeleteConfirmationModalProps {
  show?: boolean;
  onClose?: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  invoice?: any; // Optional, for compatibility with invoice deletion
  onCancel?: () => void; // For compatibility with onCancel usage
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  show = true,
  onClose,
  onConfirm,
  title = "Delete Confirmation",
  message = "Are you sure you want to delete this item? This action cannot be undone.",
  invoice,
  onCancel,
}) => {
  if (show === false) return null;
  return (
    <div className="modal show d-block" tabIndex={-1}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose || onCancel}
              aria-label="Close"
            ></button>
          </div>
          <div className="modal-body">
            <p>{message}</p>
            {invoice && (
              <div className="alert alert-warning mt-2">
                Invoice #{invoice.id} for {invoice.clientName}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose || onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={onConfirm}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};