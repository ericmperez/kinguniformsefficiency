import React from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip, 
  Button, 
  Badge,
  IconButton,
  Tooltip,
  LinearProgress
} from '@mui/material';
import {
  LocalShipping as TruckIcon,
  Person as DriverIcon,
  Assignment as TaskIcon,
  CheckCircle as CompleteIcon,
  Warning as WarningIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon
} from '@mui/icons-material';

interface TruckCardProps {
  truckNumber: string;
  invoices: Array<{
    id: string;
    clientName: string;
    cartCount: number;
    hasSignature?: boolean;
    tripNumber?: number;
  }>;
  assignedDriver?: string;
  isCompleted?: boolean;
  canAcceptNewInvoices?: boolean;
  currentTrip?: number;
  onAssignDriver?: (truckNumber: string) => void;
  onViewTruck?: (truckNumber: string) => void;
  onCompleteTruck?: (truckNumber: string) => void;
  onVerifyLoading?: (truckNumber: string) => void;
  loading?: boolean;
  tripStatusMessage?: string;
}

export const TruckCard: React.FC<TruckCardProps> = ({
  truckNumber,
  invoices,
  assignedDriver,
  isCompleted,
  canAcceptNewInvoices,
  currentTrip = 1,
  onAssignDriver,
  onViewTruck,
  onCompleteTruck,
  onVerifyLoading,
  loading = false,
  tripStatusMessage
}) => {
  const totalCarts = invoices.reduce((sum, inv) => sum + (inv.cartCount || 0), 0);
  const signedInvoices = invoices.filter(inv => inv.hasSignature).length;
  const completionPercentage = invoices.length > 0 ? (signedInvoices / invoices.length) * 100 : 0;

  const getTruckStatusColor = () => {
    if (isCompleted) return 'success';
    if (loading) return 'warning';
    if (!assignedDriver) return 'default';
    if (completionPercentage === 100) return 'success';
    if (completionPercentage > 50) return 'info';
    return 'primary';
  };

  const getTruckStatusText = () => {
    if (isCompleted) return `Completed (Trip ${currentTrip})`;
    if (loading) return 'Processing...';
    if (!assignedDriver) return 'Unassigned';
    if (completionPercentage === 100) return 'Ready to Complete';
    return `In Progress (${signedInvoices}/${invoices.length} signed)`;
  };

  return (
    <Card 
      sx={{ 
        mb: 2, 
        border: isCompleted ? '2px solid #4caf50' : '1px solid #e0e0e0',
        boxShadow: isCompleted ? '0 4px 16px rgba(76, 175, 80, 0.2)' : undefined,
        opacity: loading ? 0.7 : 1,
        transition: 'all 0.3s ease'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TruckIcon sx={{ fontSize: 28, color: '#D72328' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#D72328' }}>
              Truck {truckNumber}
            </Typography>
            <Chip 
              label={`Trip ${currentTrip}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
          
          <Chip 
            label={getTruckStatusText()}
            color={getTruckStatusColor() as any}
            icon={isCompleted ? <CompleteIcon /> : undefined}
          />
        </Box>

        {/* Driver Assignment */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <DriverIcon sx={{ color: '#666' }} />
          {assignedDriver ? (
            <Typography variant="body2">
              <strong>Driver:</strong> {assignedDriver}
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="error">
                No driver assigned
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => onAssignDriver?.(truckNumber)}
                disabled={loading}
              >
                Assign Driver
              </Button>
            </Box>
          )}
        </Box>

        {/* Progress Bar */}
        {invoices.length > 0 && !isCompleted && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Delivery Progress
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {signedInvoices}/{invoices.length} signed
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={completionPercentage}
              sx={{ 
                height: 8, 
                borderRadius: 4,
                '& .MuiLinearProgress-bar': {
                  backgroundColor: completionPercentage === 100 ? '#4caf50' : '#2196f3'
                }
              }}
            />
          </Box>
        )}

        {/* Invoices Summary */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>{invoices.length}</strong> deliveries • <strong>{totalCarts}</strong> carts
          </Typography>
          
          {tripStatusMessage && (
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {tripStatusMessage}
            </Typography>
          )}
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => onViewTruck?.(truckNumber)}
            disabled={loading}
          >
            View Details
          </Button>
          
          {assignedDriver && !isCompleted && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => onVerifyLoading?.(truckNumber)}
              disabled={loading}
            >
              Verify Loading
            </Button>
          )}
          
          {assignedDriver && completionPercentage === 100 && !isCompleted && (
            <Button
              variant="contained"
              size="small"
              color="success"
              onClick={() => onCompleteTruck?.(truckNumber)}
              disabled={loading}
              startIcon={<CompleteIcon />}
            >
              Complete Trip
            </Button>
          )}
          
          {!canAcceptNewInvoices && (
            <Tooltip title="Truck is at capacity">
              <Chip 
                label="At Capacity" 
                size="small" 
                color="warning" 
                icon={<WarningIcon />}
              />
            </Tooltip>
          )}
        </Box>

        {/* Capacity Warning */}
        {totalCarts > 15 && (
          <Box sx={{ mt: 2, p: 1, backgroundColor: '#fff3cd', borderRadius: 1 }}>
            <Typography variant="caption" color="warning.dark">
              ⚠️ High cart count ({totalCarts}). Consider redistributing load.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}; 