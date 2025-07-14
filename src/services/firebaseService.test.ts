import '@testing-library/jest-dom';
import { getClientAvatarUrl } from './firebaseService';

describe('Firebase Service - Utility Functions', () => {
  describe('getClientAvatarUrl', () => {
    it('should return client image URL when available', () => {
      const client = { imageUrl: 'https://example.com/avatar.jpg' };
      const result = getClientAvatarUrl(client);
      expect(result).toBe('https://example.com/avatar.jpg');
    });

    it('should return default avatar when imageUrl is empty', () => {
      const client = { imageUrl: '' };
      const result = getClientAvatarUrl(client);
      expect(result).toBe('/images/clients/default-avatar.png');
    });

    it('should return default avatar when imageUrl is undefined', () => {
      const client = {};
      const result = getClientAvatarUrl(client);
      expect(result).toBe('/images/clients/default-avatar.png');
    });

    it('should return default avatar when client is null', () => {
      const result = getClientAvatarUrl(null as any);
      expect(result).toBe('/images/clients/default-avatar.png');
    });

    it('should return default avatar when imageUrl is whitespace only', () => {
      const client = { imageUrl: '   ' };
      const result = getClientAvatarUrl(client);
      expect(result).toBe('/images/clients/default-avatar.png');
    });

    it('should handle client object with other properties', () => {
      const client = { 
        id: 'client1',
        name: 'Test Client',
        imageUrl: 'https://example.com/test.png',
        otherProperty: 'value'
      };
      const result = getClientAvatarUrl(client);
      expect(result).toBe('https://example.com/test.png');
    });
  });
});