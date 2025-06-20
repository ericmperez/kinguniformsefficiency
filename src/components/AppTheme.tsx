import * as React from 'react';

export default function AppTheme({ children }: { children: React.ReactNode }) {
  // For now, just render children directly. You can add MUI ThemeProvider here if needed.
  return <>{children}</>;
}
