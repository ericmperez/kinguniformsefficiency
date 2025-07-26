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
  | 'LaundryTicketDetailsModal'
  | 'LaundryCartModal'
  | 'DriverManagement'
  | 'BillingPage'
  | 'RutasPorCamion'
  | 'SendLaundryTicketPage'
  | 'ShippingPage';

// Map roles to allowed components
export const roleComponentPermissions: Record<Role, AppComponentKey[]> = {
  Employee: ['PickupWashing', 'ActiveLaundryTickets'],
  Supervisor: ['PickupWashing', 'ActiveLaundryTickets', 'Report', 'Segregation', 'Washing', 'ShippingPage'],
  Driver: ['ShippingPage'], // Drivers can only see ShippingPage
  Admin: [
    'PickupWashing',
    'ActiveLaundryTickets',
    'UserManagement',
    'Report',
    'Segregation',
    'Washing',
    'GlobalActivityLog',
    'LaundryTicketDetailsModal',
    'LaundryCartModal',
    'DriverManagement',
    'BillingPage',
    'RutasPorCamion',
    'SendLaundryTicketPage',
    'ShippingPage',
  ],
  Owner: [
    'PickupWashing',
    'ActiveLaundryTickets',
    'UserManagement',
    'Report',
    'Segregation',
    'Washing',
    'GlobalActivityLog',
    'LaundryTicketDetailsModal',
    'LaundryCartModal',
    'DriverManagement',
    'BillingPage',
    'RutasPorCamion',
    'SendLaundryTicketPage',
    'ShippingPage',
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
  user: { role: Role; allowedComponents?: AppComponentKey[] },
  component: AppComponentKey
): boolean {
  if (user.role === 'Owner') return true; // Owner always sees all
  if (user.allowedComponents) {
    return user.allowedComponents.includes(component);
  }
  return canRoleSeeComponent(user.role, component);
}
