// API configuration for development vs production
const getApiBaseUrl = () => {
  // Check if we're running in development mode
  if (import.meta.env.DEV) {
    return 'http://localhost:5173';
  }
  
  // Check if we're running locally (even in production build)
  // This handles the case when you run the built version locally for testing
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:5173';
  }
  
  // In actual production deployment (Vercel), use relative paths
  return '';
};

export const API_BASE_URL = getApiBaseUrl();
