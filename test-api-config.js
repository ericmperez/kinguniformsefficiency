// Test script to verify API configuration works correctly
import { API_BASE_URL } from './src/config/api.ts';

console.log('API_BASE_URL:', API_BASE_URL);
console.log('Environment:', process.env.NODE_ENV || 'development');

// Test if the API URL is constructed correctly
const testUrl = `${API_BASE_URL}/api/send-test-email`;
console.log('Test API URL:', testUrl);
