import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Card,
  CardContent,
  Grid,
  IconButton,
  Badge,
  Fab
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Add as AddIcon,
  Emergency as EmergencyIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  LocalShipping as TruckIcon
} from '@mui/icons-material';
import { useMobile } from '../../hooks/useMobile';

interface ShippingDashboardProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  availableDates: string[];
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onEmergencyDelivery?: () => void;
  onViewEmergencyDeliveries?: () => void;
  // Statistics
  totalTrucks?: number;
  completedTrucks?: number;
  pendingSignatures?: number;
  unassignedTrucks?: number;
}

export const ShippingDashboard: React.FC<ShippingDashboardProps> = ({
  selectedDate,
  onDateChange,
  availableDates,
  isRefreshing = false,
  onRefresh,
  onEmergencyDelivery,
  onViewEmergencyDeliveries,
  totalTrucks = 0,
  completedTrucks = 0,
  pendingSignatures = 0,
  unassignedTrucks = 0
}) => {
  const { isMobile } = useMobile();

  const formatDateOption = (date: string) => {
    try {
      const [year, month, day] = date.split("-").map(Number);
      const localDate = new Date(year, month - 1, day);
      return localDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return date;
    }
  };

  const getCompletionPercentage = () => {
    return totalTrucks > 0 ? Math.round((completedTrucks / totalTrucks) * 100) : 0;
  };

  if (isMobile) {
    return (
      <Box sx={{ mb: 3 }}>
        {/* Mobile Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#D72328' }}>
            🚛 Shipping
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton 
              onClick={onRefresh}
              disabled={isRefreshing}
              size="small"
              sx={{ 
                backgroundColor: '#f5f5f5',
                '&:hover': { backgroundColor: '#e0e0e0' }
              }}
            >
              <RefreshIcon sx={{ 
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
              }} />
            </IconButton>
          </Box>
        </Box>

        {/* Mobile Date Filter */}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Delivery Date</InputLabel>
          <Select
            value={selectedDate}
            label="Delivery Date"
            onChange={(e) => onDateChange(e.target.value)}
          >
            <MenuItem value="">All Dates</MenuItem>
            {availableDates.map((date) => (
              <MenuItem key={date} value={date}>
                {formatDateOption(date)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Mobile Stats Grid */}
        <div className="row mb-2">
          <div className="col-6">
            <Card sx={{ backgroundColor: '#e3f2fd' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  Total Trucks
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {totalTrucks}
                </Typography>
              </CardContent>
            </Card>
          </div>
          <div className="col-6">
            <Card sx={{ backgroundColor: '#e8f5e8' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  Completed
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#4caf50' }}>
                  {completedTrucks}
                </Typography>
              </CardContent>
            </Card>
          </div>
          <div className="col-6">
            <Card sx={{ backgroundColor: '#fff3e0' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  Pending Signatures
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#ff9800' }}>
                  {pendingSignatures}
                </Typography>
              </CardContent>
            </Card>
          </div>
          <div className="col-6">
            <Card sx={{ backgroundColor: '#ffebee' }}>
              <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  Unassigned
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#f44336' }}>
                  {unassignedTrucks}
                </Typography>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Mobile Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            fullWidth
            onClick={onEmergencyDelivery}
            startIcon={<EmergencyIcon />}
          >
            Emergency
          </Button>
          <Button
            variant="outlined"
            size="small"
            fullWidth
            onClick={onViewEmergencyDeliveries}
            startIcon={<AssignmentIcon />}
          >
            View Logs
          </Button>
        </Box>

        {/* Progress Indicator */}
        {selectedDate && (
          <Card sx={{ backgroundColor: '#f8f9fa', border: '1px solid #e0e0e0' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Daily Progress - {formatDateOption(selectedDate)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ 
                    height: 8, 
                    backgroundColor: '#e0e0e0', 
                    borderRadius: 4,
                    overflow: 'hidden'
                  }}>
                    <Box sx={{
                      height: '100%',
                      width: `${getCompletionPercentage()}%`,
                      backgroundColor: '#4caf50',
                      transition: 'width 0.3s ease'
                    }} />
                  </Box>
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {getCompletionPercentage()}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>
    );
  }

  // Desktop Layout
  return (
    <Box sx={{ mb: 4 }}>
      {/* Desktop Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#D72328', display: 'flex', alignItems: 'center', gap: 1 }}>
          <TruckIcon sx={{ fontSize: 36 }} />
          Shipping Dashboard
        </Typography>
        
        {isRefreshing && (
          <Box sx={{ display: 'flex', alignItems: 'center', color: '#2196f3' }}>
            <RefreshIcon sx={{ 
              mr: 1,
              animation: 'spin 1s linear infinite'
            }} />
            <Typography variant="body2">Refreshing data...</Typography>
          </Box>
        )}
      </Box>

      {/* Desktop Controls and Stats */}
      <div className="row mb-3">
        {/* Date Filter */}
        <div className="col-12 col-md-4">
          <FormControl fullWidth>
            <InputLabel>Filter by Delivery Date</InputLabel>
            <Select
              value={selectedDate}
              label="Filter by Delivery Date"
              onChange={(e) => onDateChange(e.target.value)}
            >
              <MenuItem value="">All Dates</MenuItem>
              {availableDates.map((date) => (
                <MenuItem key={date} value={date}>
                  {formatDateOption(date)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>

        {/* Action Buttons */}
        <div className="col-12 col-md-8">
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', height: '100%' }}>
            <Button
              variant="outlined"
              onClick={onRefresh}
              disabled={isRefreshing}
              startIcon={<RefreshIcon />}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={onEmergencyDelivery}
              startIcon={<EmergencyIcon />}
            >
              Emergency Delivery
            </Button>
            <Button
              variant="outlined"
              onClick={onViewEmergencyDeliveries}
              startIcon={<AssignmentIcon />}
            >
              View Emergency Logs
            </Button>
          </Box>
        </div>
      </div>

      {/* Desktop Stats Cards */}
      <div className="row mb-3">
        <div className="col-12 col-sm-6 col-md-3">
          <Card sx={{ backgroundColor: '#e3f2fd', border: '1px solid #2196f3' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <TruckIcon sx={{ fontSize: 40, color: '#2196f3', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#2196f3' }}>
                {totalTrucks}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Trucks
              </Typography>
            </CardContent>
          </Card>
        </div>
        
        <div className="col-12 col-sm-6 col-md-3">
          <Card sx={{ backgroundColor: '#e8f5e8', border: '1px solid #4caf50' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={getCompletionPercentage() + '%'} color="success">
                <TrendingUpIcon sx={{ fontSize: 40, color: '#4caf50', mb: 1 }} />
              </Badge>
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#4caf50' }}>
                {completedTrucks}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Completed
              </Typography>
            </CardContent>
          </Card>
        </div>
        
        <div className="col-12 col-sm-6 col-md-3">
          <Card sx={{ backgroundColor: '#fff3e0', border: '1px solid #ff9800' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <AssignmentIcon sx={{ fontSize: 40, color: '#ff9800', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#ff9800' }}>
                {pendingSignatures}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending Signatures
              </Typography>
            </CardContent>
          </Card>
        </div>
        
        <div className="col-12 col-sm-6 col-md-3">
          <Card sx={{ backgroundColor: '#ffebee', border: '1px solid #f44336' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <EmergencyIcon sx={{ fontSize: 40, color: '#f44336', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 700, color: '#f44336' }}>
                {unassignedTrucks}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Unassigned
              </Typography>
            </CardContent>
          </Card>
        </div>
      </div>
    </Box>
  );
};