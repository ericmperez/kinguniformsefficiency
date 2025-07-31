// src/permissions.ts
// Map of roles to allowed component keys
export type Role = 'Employee' | 'Supervisor' | 'Admin' | 'Owner' | 'Driver';

// List the keys for each component you want to control
export type AppComponentKey =
  | 'PickupWashing'
  | 'ActiveLaundryTickets'
  | 'UserManagement'
  | 'Report'
  | 'Segregation'
  | 'Washing'
  | 'GlobalActivityLog'
  | 'RealTimeActivityDashboard'
  | 'LaundryTicketDetailsModal'
  | 'LaundryCartModal'
  | 'DriverManagement'
  | 'BillingPage'
  | 'RutasPorCamion'
  | 'SendLaundryTicketPage'
  | 'ShippingPage'
  | 'SuggestionsPanel';

// Map roles to allowed components
export const roleComponentPermissions: Record<Role, AppComponentKey[]> = {
  Employee: ['PickupWashing', 'ActiveLaundryTickets'],
  Supervisor: ['PickupWashing', 'ActiveLaundryTickets', 'Report', 'Segregation', 'Washing', 'ShippingPage', 'SuggestionsPanel'],
  Driver: ['ShippingPage'], // Drivers can only see ShippingPage
  Admin: [
    'PickupWashing',
    'ActiveLaundryTickets',
    'UserManagement',
    'Report',
    'Segregation',
    'Washing',
    'GlobalActivityLog',
    'RealTimeActivityDashboard',
    'LaundryTicketDetailsModal',
    'LaundryCartModal',
    'DriverManagement',
    'BillingPage',
    'RutasPorCamion',
    'SendLaundryTicketPage',
    'ShippingPage',
    'SuggestionsPanel',
  ],
  Owner: [
    'PickupWashing',
    'ActiveLaundryTickets',
    'UserManagement',
    'Report',
    'Segregation',
    'Washing',
    'GlobalActivityLog',
    'RealTimeActivityDashboard',
    'LaundryTicketDetailsModal',
    'LaundryCartModal',
    'DriverManagement',
    'BillingPage',
    'RutasPorCamion',
    'SendLaundryTicketPage',
    'ShippingPage',
    'SuggestionsPanel',
  ],
};

// Helper to check if a role can see a component
export function canRoleSeeComponent(role: Role, component: AppComponentKey): boolean {
  return roleComponentPermissions[role]?.includes(component) ?? false;
}

// Add per-user component permissions support
export interface UserComponentPermissions {
  allowedComponents?: AppComponentKey[];
  defaultPage?: AppComponentKey;
}

// Helper to check if a user can see a component (per-user or fallback to role)
export function canUserSeeComponent(
  user: { id?: string; role: Role; allowedComponents?: AppComponentKey[] },
  component: AppComponentKey
): boolean {
  if (user.role === 'Owner') return true; // Owner always sees all
  
  // Special case: User 1991 (Eric) can always see SuggestionsPanel
  if (component === 'SuggestionsPanel' && user.id === '1991') return true;
  
  // Special case: Only specific users can see RealTimeActivityDashboard
  if (component === 'RealTimeActivityDashboard') {
    return user.id === '1991' || user.id === '1995' || user.id === '1167';
  }
  
  if (user.allowedComponents) {
    return user.allowedComponents.includes(component);
  }
  return canRoleSeeComponent(user.role, component);
}
