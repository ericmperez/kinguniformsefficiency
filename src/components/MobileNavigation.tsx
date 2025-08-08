import React from 'react';
import { 
  BottomNavigation, 
  BottomNavigationAction, 
  Paper,
  Badge,
  Box,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon
} from '@mui/material';
import {
  Home as HomeIcon,
  ListAlt as ListAltIcon,
  LocalLaundryService as LaundryIcon,
  LocalShipping as ShippingIcon,
  Assessment as ReportsIcon,
  Settings as SettingsIcon,
  GroupWork as SegregationIcon,
  Calculate as BillingIcon,
  MoreVert as MoreIcon
} from '@mui/icons-material';

interface MobileNavigationProps {
  activePage: string;
  onPageChange: (page: string) => void;
  canSee: (component: string) => boolean;
  notificationCount?: number;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  activePage,
  onPageChange,
  canSee,
  notificationCount = 0
}) => {
  const [speedDialOpen, setSpeedDialOpen] = React.useState(false);

  // Primary navigation items (always visible)
  const primaryNavItems = [
    {
      label: 'Home',
      value: 'home',
      icon: <HomeIcon />,
      visible: true
    },
    {
      label: 'Entradas',
      value: 'entradas',
      icon: <ListAltIcon />,
      visible: canSee('PickupWashing')
    },
    {
      label: 'Washing',
      value: 'washing',
      icon: <LaundryIcon />,
      visible: canSee('Washing')
    },
    {
      label: 'Shipping',
      value: 'shipping',
      icon: <ShippingIcon />,
      visible: canSee('ShippingPage')
    }
  ].filter(item => item.visible);

  // Secondary navigation items (in speed dial)
  const secondaryNavItems = [
    {
      label: 'Segregation',
      value: 'segregation',
      icon: <SegregationIcon />,
      visible: canSee('Segregation')
    },
    {
      label: 'Reports',
      value: 'reports',
      icon: <ReportsIcon />,
      visible: canSee('Report')
    },
    {
      label: 'Delivered Invoices',
      value: 'deliveredInvoices',
      icon: <ShippingIcon />,
      visible: canSee('ShippingPage')
    },
    {
      label: 'Analytics',
      value: 'analytics',
      icon: <ReportsIcon />,
      visible: canSee('Report')
    },
    {
      label: 'Daily Analytics',
      value: 'dailyProductAnalytics',
      icon: <ReportsIcon />,
      visible: canSee('Report')
    },
    {
      label: 'Billing',
      value: 'billing',
      icon: <BillingIcon />,
      visible: canSee('BillingPage')
    },
    {
      label: 'Settings',
      value: 'settings',
      icon: <SettingsIcon />,
      visible: canSee('UserManagement')
    }
  ].filter(item => item.visible);

  const handleNavigation = (value: string) => {
    onPageChange(value);
    setSpeedDialOpen(false);
  };

  const getCurrentNavValue = () => {
    // Map current page to navigation value
    if (primaryNavItems.some(item => item.value === activePage)) {
      return primaryNavItems.findIndex(item => item.value === activePage);
    }
    return -1; // No primary nav item selected
  };

  return (
    <>
      {/* Bottom Navigation */}
      <Paper 
        sx={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          zIndex: 1000,
          borderTop: '1px solid #e0e0e0'
        }} 
        elevation={3}
      >
        <BottomNavigation
          value={getCurrentNavValue()}
          onChange={(event, newValue) => {
            if (newValue !== -1 && primaryNavItems[newValue]) {
              handleNavigation(primaryNavItems[newValue].value);
            }
          }}
          sx={{ 
            height: 70,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 60,
              '&.Mui-selected': {
                color: '#D72328'
              }
            }
          }}
        >
          {primaryNavItems.map((item) => (
            <BottomNavigationAction
              key={item.value}
              label={item.label}
              icon={
                item.value === 'home' && notificationCount > 0 ? (
                  <Badge badgeContent={notificationCount} color="error">
                    {item.icon}
                  </Badge>
                ) : (
                  item.icon
                )
              }
              sx={{
                fontSize: '0.75rem',
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.75rem'
                }
              }}
            />
          ))}
          
          {/* More menu item */}
          {secondaryNavItems.length > 0 && (
            <BottomNavigationAction
              label="More"
              icon={<MoreIcon />}
              onClick={() => setSpeedDialOpen(true)}
              sx={{
                fontSize: '0.75rem',
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.75rem'
                }
              }}
            />
          )}
        </BottomNavigation>
      </Paper>

      {/* Speed Dial for secondary navigation */}
      {secondaryNavItems.length > 0 && (
        <SpeedDial
          ariaLabel="More navigation options"
          sx={{ 
            position: 'fixed', 
            bottom: 80, 
            right: 16,
            zIndex: 1001,
            '& .MuiSpeedDial-fab': {
              backgroundColor: '#D72328',
              '&:hover': {
                backgroundColor: '#B01E22'
              }
            }
          }}
          icon={<SpeedDialIcon />}
          open={speedDialOpen}
          onClose={() => setSpeedDialOpen(false)}
          onOpen={() => setSpeedDialOpen(true)}
        >
          {secondaryNavItems.map((item) => (
            <SpeedDialAction
              key={item.value}
              icon={item.icon}
              tooltipTitle={item.label}
              onClick={() => handleNavigation(item.value)}
              sx={{
                '& .MuiSpeedDialAction-fab': {
                  backgroundColor: '#FAC61B',
                  color: '#000',
                  '&:hover': {
                    backgroundColor: '#E6B317'
                  }
                }
              }}
            />
          ))}
        </SpeedDial>
      )}

      {/* Bottom padding for content to prevent overlap */}
      <Box sx={{ height: 70 }} />
    </>
  );
};

// Mobile-optimized floating action button
export const MobileFAB: React.FC<{
  icon: React.ReactNode;
  onClick: () => void;
  label?: string;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}> = ({ icon, onClick, label, color = 'primary' }) => {
  const colorMap = {
    primary: '#D72328',
    secondary: '#FAC61B',
    error: '#f44336',
    warning: '#ff9800',
    info: '#2196f3',
    success: '#4caf50'
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 90, // Above bottom navigation
        right: 16,
        zIndex: 1000
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: colorMap[color],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          color: 'white',
          fontSize: 24,
          transition: 'all 0.2s ease',
        }}
        onClick={onClick}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title={label}
      >
        {icon}
      </div>
    </Box>
  );
}; 