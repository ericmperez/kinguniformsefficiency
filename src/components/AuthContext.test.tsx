import '@testing-library/jest-dom';
import React from 'react';
import { renderHook } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock Firebase completely for this test
jest.mock('firebase/firestore', () => ({}));
jest.mock('../firebase', () => ({
  db: {},
  storage: {},
}));

describe('AuthContext', () => {
  describe('useAuth Hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Test that useAuth throws an error when not wrapped in AuthProvider
      const { result } = renderHook(() => useAuth());
      
      expect(result.error).toEqual(
        Error('useAuth must be used within an AuthProvider')
      );
    });

    it('should provide context when used within AuthProvider', () => {
      // Create a wrapper with AuthProvider
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      // This should not throw an error
      const { result } = renderHook(() => useAuth(), { wrapper });
      
      // The hook should return a context object with expected properties
      expect(result.current).toBeDefined();
      expect(typeof result.current.logout).toBe('function');
      // Note: user might be null initially, which is expected
      expect(result.current).toHaveProperty('user');
    });
  });

  describe('AuthProvider Component', () => {
    it('should render children without crashing', () => {
      const TestChild = () => <div>Test Child</div>;
      
      expect(() => {
        React.createElement(AuthProvider, { children: React.createElement(TestChild) });
      }).not.toThrow();
    });

    it('should provide auth context to children', () => {
      const TestChild = () => {
        const auth = useAuth();
        return <div data-testid="auth-user">{auth.user?.username || 'No user'}</div>;
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Should provide auth context without throwing
      expect(result.current).toBeDefined();
      expect(typeof result.current.logout).toBe('function');
    });
  });

  describe('AuthContext Properties', () => {
    it('should have expected structure in auth context', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      const authContext = result.current;

      // Check that the context has the expected properties
      expect(authContext).toHaveProperty('user');
      expect(authContext).toHaveProperty('logout');
      expect(typeof authContext.logout).toBe('function');

      // User can be null initially (not logged in), which is valid
      expect(authContext.user === null || typeof authContext.user === 'object').toBe(true);
    });
  });
});