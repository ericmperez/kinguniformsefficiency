// src/permissions.ts
// Map of roles to allowed component keys
export type Role = 'Employee' | 'Supervisor' | 'Admin' | 'Owner';

// List the keys for each component you want to control
export type AppComponentKey =
  | 'PickupWashing'
  | 'ActiveInvoices'
  | 'UserManagement'
  | 'Report'
  | 'Segregation'
  | 'Washing'
  | 'GlobalActivityLog'
  | 'InvoiceDetailsModal'
  | 'LaundryCartModal'
  | 'DriverManagement'
  | 'BillingPage'
  | 'RutasPorCamion'
  | 'SendInvoicePage';

// Map roles to allowed components
export const roleComponentPermissions: Record<Role, AppComponentKey[]> = {
  Employee: ['PickupWashing', 'ActiveInvoices'],
  Supervisor: ['PickupWashing', 'ActiveInvoices', 'Report', 'Segregation', 'Washing'],
  Admin: [
    'PickupWashing',
    'ActiveInvoices',
    'UserManagement',
    'Report',
    'Segregation',
    'Washing',
    'GlobalActivityLog',
    'InvoiceDetailsModal',
    'LaundryCartModal',
    'DriverManagement',
    'BillingPage',
    'RutasPorCamion',
    'SendInvoicePage',
  ],
  Owner: [
    'PickupWashing',
    'ActiveInvoices',
    'UserManagement',
    'Report',
    'Segregation',
    'Washing',
    'GlobalActivityLog',
    'InvoiceDetailsModal',
    'LaundryCartModal',
    'DriverManagement',
    'BillingPage',
    'RutasPorCamion',
    'SendInvoicePage',
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
