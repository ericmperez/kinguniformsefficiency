// API configuration for development vs production
const getApiBaseUrl = () => {
  // In development, use the Express server
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5173';
  }
  // In production, use relative paths (Vercel will handle routing)
  return '';
};

export const API_BASE_URL = getApiBaseUrl();
