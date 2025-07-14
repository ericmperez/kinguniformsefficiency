// Jest setup file to configure global test environment
import '@testing-library/jest-dom';

// Mock Firebase modules globally
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  onSnapshot: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
    fromDate: jest.fn((date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 })),
  },
  setDoc: jest.fn(),
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock('./firebase', () => ({
  db: {},
  storage: {},
}));

// Mock React hooks if needed
global.React = require('react');