import '@testing-library/jest-dom';
import {
  canRoleSeeComponent,
  canUserSeeComponent,
  roleComponentPermissions,
  type Role,
  type AppComponentKey,
} from './permissions';

describe('Permissions', () => {
  describe('canRoleSeeComponent', () => {
    it('should return true when Employee role can see allowed components', () => {
      expect(canRoleSeeComponent('Employee', 'PickupWashing')).toBe(true);
      expect(canRoleSeeComponent('Employee', 'ActiveInvoices')).toBe(true);
    });

    it('should return false when Employee role cannot see restricted components', () => {
      expect(canRoleSeeComponent('Employee', 'UserManagement')).toBe(false);
      expect(canRoleSeeComponent('Employee', 'Report')).toBe(false);
      expect(canRoleSeeComponent('Employee', 'Segregation')).toBe(false);
      expect(canRoleSeeComponent('Employee', 'GlobalActivityLog')).toBe(false);
    });

    it('should return true when Supervisor role can see allowed components', () => {
      expect(canRoleSeeComponent('Supervisor', 'PickupWashing')).toBe(true);
      expect(canRoleSeeComponent('Supervisor', 'ActiveInvoices')).toBe(true);
      expect(canRoleSeeComponent('Supervisor', 'Report')).toBe(true);
      expect(canRoleSeeComponent('Supervisor', 'Segregation')).toBe(true);
      expect(canRoleSeeComponent('Supervisor', 'Washing')).toBe(true);
    });

    it('should return false when Supervisor role cannot see admin/owner components', () => {
      expect(canRoleSeeComponent('Supervisor', 'UserManagement')).toBe(false);
      expect(canRoleSeeComponent('Supervisor', 'GlobalActivityLog')).toBe(false);
      expect(canRoleSeeComponent('Supervisor', 'DriverManagement')).toBe(false);
    });

    it('should return true when Admin role can see all allowed components', () => {
      const adminComponents: AppComponentKey[] = [
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
      ];

      adminComponents.forEach(component => {
        expect(canRoleSeeComponent('Admin', component)).toBe(true);
      });
    });

    it('should return true when Owner role can see all components', () => {
      const ownerComponents: AppComponentKey[] = [
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
      ];

      ownerComponents.forEach(component => {
        expect(canRoleSeeComponent('Owner', component)).toBe(true);
      });
    });

    it('should handle invalid role gracefully', () => {
      expect(canRoleSeeComponent('InvalidRole' as Role, 'PickupWashing')).toBe(false);
    });

    it('should ensure role permissions are properly defined', () => {
      expect(roleComponentPermissions.Employee).toHaveLength(2);
      expect(roleComponentPermissions.Supervisor).toHaveLength(5);
      expect(roleComponentPermissions.Admin).toHaveLength(13);
      expect(roleComponentPermissions.Owner).toHaveLength(13);
    });
  });

  describe('canUserSeeComponent', () => {
    it('should always return true for Owner role regardless of allowedComponents', () => {
      const ownerUser = {
        role: 'Owner' as Role,
        allowedComponents: ['PickupWashing'] as AppComponentKey[],
      };

      expect(canUserSeeComponent(ownerUser, 'UserManagement')).toBe(true);
      expect(canUserSeeComponent(ownerUser, 'GlobalActivityLog')).toBe(true);
      expect(canUserSeeComponent(ownerUser, 'PickupWashing')).toBe(true);
    });

    it('should use allowedComponents when user has custom permissions', () => {
      const userWithCustomPermissions = {
        role: 'Employee' as Role,
        allowedComponents: ['UserManagement', 'Report'] as AppComponentKey[],
      };

      expect(canUserSeeComponent(userWithCustomPermissions, 'UserManagement')).toBe(true);
      expect(canUserSeeComponent(userWithCustomPermissions, 'Report')).toBe(true);
      expect(canUserSeeComponent(userWithCustomPermissions, 'PickupWashing')).toBe(false);
      expect(canUserSeeComponent(userWithCustomPermissions, 'ActiveInvoices')).toBe(false);
    });

    it('should fallback to role permissions when user has no custom allowedComponents', () => {
      const employeeUser = {
        role: 'Employee' as Role,
      };

      expect(canUserSeeComponent(employeeUser, 'PickupWashing')).toBe(true);
      expect(canUserSeeComponent(employeeUser, 'ActiveInvoices')).toBe(true);
      expect(canUserSeeComponent(employeeUser, 'UserManagement')).toBe(false);
      expect(canUserSeeComponent(employeeUser, 'Report')).toBe(false);
    });

    it('should fallback to role permissions when allowedComponents is undefined', () => {
      const supervisorUser = {
        role: 'Supervisor' as Role,
        allowedComponents: undefined,
      };

      expect(canUserSeeComponent(supervisorUser, 'PickupWashing')).toBe(true);
      expect(canUserSeeComponent(supervisorUser, 'Report')).toBe(true);
      expect(canUserSeeComponent(supervisorUser, 'Segregation')).toBe(true);
      expect(canUserSeeComponent(supervisorUser, 'UserManagement')).toBe(false);
    });

    it('should handle empty allowedComponents array', () => {
      const userWithNoPermissions = {
        role: 'Admin' as Role,
        allowedComponents: [] as AppComponentKey[],
      };

      expect(canUserSeeComponent(userWithNoPermissions, 'PickupWashing')).toBe(false);
      expect(canUserSeeComponent(userWithNoPermissions, 'UserManagement')).toBe(false);
      expect(canUserSeeComponent(userWithNoPermissions, 'Report')).toBe(false);
    });

    it('should handle Admin user with custom restricted permissions', () => {
      const restrictedAdminUser = {
        role: 'Admin' as Role,
        allowedComponents: ['PickupWashing', 'ActiveInvoices'] as AppComponentKey[],
      };

      expect(canUserSeeComponent(restrictedAdminUser, 'PickupWashing')).toBe(true);
      expect(canUserSeeComponent(restrictedAdminUser, 'ActiveInvoices')).toBe(true);
      expect(canUserSeeComponent(restrictedAdminUser, 'UserManagement')).toBe(false);
      expect(canUserSeeComponent(restrictedAdminUser, 'GlobalActivityLog')).toBe(false);
    });

    it('should handle invalid component gracefully', () => {
      const user = {
        role: 'Admin' as Role,
      };

      expect(canUserSeeComponent(user, 'InvalidComponent' as AppComponentKey)).toBe(false);
    });
  });

  describe('Role Component Permissions Data Integrity', () => {
    it('should have consistent permissions between Admin and Owner', () => {
      const adminComponents = roleComponentPermissions.Admin;
      const ownerComponents = roleComponentPermissions.Owner;

      expect(adminComponents).toEqual(ownerComponents);
    });

    it('should ensure Employee permissions are subset of Supervisor permissions', () => {
      const employeeComponents = roleComponentPermissions.Employee;
      const supervisorComponents = roleComponentPermissions.Supervisor;

      employeeComponents.forEach(component => {
        expect(supervisorComponents).toContain(component);
      });
    });

    it('should ensure Supervisor permissions are subset of Admin permissions', () => {
      const supervisorComponents = roleComponentPermissions.Supervisor;
      const adminComponents = roleComponentPermissions.Admin;

      supervisorComponents.forEach(component => {
        expect(adminComponents).toContain(component);
      });
    });

    it('should have no duplicate components in any role', () => {
      Object.values(roleComponentPermissions).forEach(components => {
        const uniqueComponents = [...new Set(components)];
        expect(components).toEqual(uniqueComponents);
      });
    });

    it('should define permissions for all known roles', () => {
      const expectedRoles: Role[] = ['Employee', 'Supervisor', 'Admin', 'Owner'];
      const definedRoles = Object.keys(roleComponentPermissions) as Role[];

      expectedRoles.forEach(role => {
        expect(definedRoles).toContain(role);
      });
    });
  });
});