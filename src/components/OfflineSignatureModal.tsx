import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  LinearProgress,
  Chip,
  IconButton,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  Clear as ClearIcon,
  CloudOff as OfflineIcon,
  CloudQueue as OnlineIcon,
  Sync as SyncIcon,
  LocationOn as LocationIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { offlineSignatureService } from '../services/offlineSignatureService';
import { useNotifications } from '../hooks/useNotifications';
import { SignatureEmailService } from '../services/signatureEmailService';

interface OfflineSignatureModalProps {
  open: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    clientId: string;
    clientName: string;
    invoiceNumber?: string;
    carts?: Array<{
      id: string;
      name: string;
      items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        price: number;
      }>;
    }>;
    total?: number;
  };
  onSignatureCapture?: (signatureId: string) => void;
}

export const OfflineSignatureModal: React.FC<OfflineSignatureModalProps> = ({
  open,
  onClose,
  invoice,
  onSignatureCapture
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [notes, setNotes] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [pendingCount, setPendingCount] = useState(0);
  
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();

  // Initialize canvas and listeners
  useEffect(() => {
    if (!open) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = 400;
    canvas.height = 200;

    // Setup canvas context
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    // Get sync status
    updateSyncStatus();

    // Listen for sync events
    const handleSyncStatus = (status: string) => {
      updateSyncStatus();
      
      switch (status) {
        case 'online':
          setIsOnline(true);
          showInfo('Connection restored. Syncing signatures...');
          break;
        case 'offline':
          setIsOnline(false);
          showWarning('Connection lost. Signatures will be saved offline.');
          break;
        case 'signature_synced':
          showSuccess('Signature synchronized successfully!');
          break;
        case 'sync_completed':
          showSuccess('All signatures synchronized!');
          break;
        case 'sync_failed':
          showError('Failed to sync some signatures. Will retry automatically.');
          break;
      }
    };

    offlineSignatureService.addSyncListener(handleSyncStatus);

    return () => {
      offlineSignatureService.removeSyncListener(handleSyncStatus);
    };
  }, [open, showSuccess, showError, showWarning, showInfo]);

  // Update sync status
  const updateSyncStatus = async () => {
    try {
      const status = await offlineSignatureService.getSyncStatus();
      setSyncStatus(status);
      setPendingCount(status.pendingCount + status.failedCount);
      setIsOnline(status.isOnline);
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  };

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setIsDrawing(true);
    setHasSignature(true);

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Clear signature
  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Save signature
  const saveSignature = async () => {
    if (!hasSignature || !receiverName.trim()) {
      showError('Please provide a signature and receiver name.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);

    try {
      // Convert canvas to data URL
      const signatureDataURL = canvas.toDataURL('image/png');

      // Save using offline service
      const signatureId = await offlineSignatureService.saveSignatureOffline({
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        receiverName: receiverName.trim(),
        signatureDataURL,
        notes: notes.trim(),
        timestamp: new Date().toISOString()
      });

      // Send signature email if online and enabled
      if (isOnline) {
        try {
          const now = new Date();
          const signatureData = {
            receivedBy: receiverName.trim(),
            signatureDate: now.toLocaleDateString(),
            signatureTime: now.toLocaleTimeString(),
            offlineSignature: true
          };

          const emailSuccess = await SignatureEmailService.sendSignatureEmail(
            invoice.id,
            invoice.clientId,
            signatureData
          );

          if (emailSuccess) {
            showSuccess('Signature captured, syncing, and email sent!');
          } else {
            showSuccess('Signature captured and syncing...');
          }
        } catch (emailError) {
          console.error('Failed to send signature email:', emailError);
          showSuccess('Signature captured and syncing...');
        }
      } else {
        showSuccess('Signature saved offline. Will sync when connection is restored.');
      }

      // Notify parent component
      onSignatureCapture?.(signatureId);

      // Update pending count
      updateSyncStatus();

      // Close modal
      onClose();
    } catch (error) {
      console.error('Failed to save signature:', error);
      showError('Failed to save signature. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Force sync
  const forceSync = async () => {
    if (!isOnline) {
      showWarning('Cannot sync while offline.');
      return;
    }

    try {
      await offlineSignatureService.forceSyncAll();
      showInfo('Manual sync initiated...');
      updateSyncStatus();
    } catch (error) {
      showError('Failed to start sync. Please try again.');
    }
  };

  // Reset form when modal closes
  const handleClose = () => {
    clearSignature();
    setReceiverName('');
    setNotes('');
    setSaving(false);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Capture Delivery Signature
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Connection Status */}
            <Chip
              icon={isOnline ? <OnlineIcon /> : <OfflineIcon />}
              label={isOnline ? 'Online' : 'Offline'}
              color={isOnline ? 'success' : 'warning'}
              size="small"
            />
            
            {/* Pending Count */}
            {pendingCount > 0 && (
              <Chip
                icon={<SyncIcon />}
                label={`${pendingCount} pending`}
                color="info"
                size="small"
                onClick={forceSync}
                sx={{ cursor: isOnline ? 'pointer' : 'default' }}
              />
            )}
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Invoice Info */}
        <Card sx={{ mb: 2, backgroundColor: '#f8f9fa' }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Delivery Details
            </Typography>
            <Typography variant="body2">
              <strong>Client:</strong> {invoice.clientName}
            </Typography>
            {invoice.invoiceNumber && (
              <Typography variant="body2">
                <strong>Invoice:</strong> {invoice.invoiceNumber}
              </Typography>
            )}
            
            {/* Cart Summary */}
            {invoice.carts && invoice.carts.length > 0 && (
              <Box sx={{ mt: 2, p: 2, backgroundColor: '#e8f5e8', borderRadius: 1, border: '1px solid #4caf50' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#2e7d32', mb: 1 }}>
                  🛒 Delivery Summary
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                      {invoice.carts.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Cart{invoice.carts.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                      {invoice.carts.reduce((total, cart) => total + cart.items.length, 0)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Total Items
                    </Typography>
                  </Box>
                  
                  {invoice.total !== undefined && (
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#2e7d32' }}>
                        ${invoice.total.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Total Value
                      </Typography>
                    </Box>
                  )}
                </Box>
                
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  <strong>Carts:</strong> {invoice.carts.map((cart, index) => 
                    `${cart.name} (${cart.items.length} item${cart.items.length !== 1 ? 's' : ''})`
                  ).join(', ')}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Offline Warning */}
        {!isOnline && (
          <Alert 
            severity="warning" 
            sx={{ mb: 2 }}
            icon={<OfflineIcon />}
          >
            You're offline. Signature will be saved locally and synced when connection is restored.
          </Alert>
        )}

        {/* Sync Status */}
        {syncStatus?.syncInProgress && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Syncing signatures...
            </Typography>
            <LinearProgress sx={{ mt: 0.5 }} />
          </Box>
        )}

        {/* Receiver Name */}
        <TextField
          fullWidth
          label="Received by (Name)"
          value={receiverName}
          onChange={(e) => setReceiverName(e.target.value)}
          required
          sx={{ mb: 2 }}
          placeholder="Enter receiver's full name"
        />

        {/* Signature Canvas */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Signature *
          </Typography>
          <Box sx={{ 
            border: '2px dashed #ccc', 
            borderRadius: 1, 
            p: 1,
            backgroundColor: '#fafafa',
            position: 'relative'
          }}>
            <canvas
              ref={canvasRef}
              style={{ 
                width: '100%', 
                height: 150,
                cursor: 'crosshair',
                backgroundColor: 'white',
                borderRadius: 4
              }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            
            {/* Clear Button */}
            {hasSignature && (
              <IconButton
                size="small"
                onClick={clearSignature}
                sx={{ 
                  position: 'absolute', 
                  top: 8, 
                  right: 8,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 1)' }
                }}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          
          {!hasSignature && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Draw your signature above using mouse or touch
            </Typography>
          )}
        </Box>

        {/* Notes */}
        <TextField
          fullWidth
          label="Delivery Notes (Optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          rows={2}
          placeholder="Any additional notes about the delivery..."
          sx={{ mb: 2 }}
        />

        {/* Additional Info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <LocationIcon fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary">
            Location and device info will be captured automatically
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button 
          onClick={handleClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={saveSignature}
          disabled={!hasSignature || !receiverName.trim() || saving}
          sx={{ minWidth: 120 }}
        >
          {saving ? (
            <>
              <SyncIcon sx={{ mr: 1, fontSize: 18, animation: 'spin 1s linear infinite' }} />
              Saving...
            </>
          ) : (
            'Confirm Delivery'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};