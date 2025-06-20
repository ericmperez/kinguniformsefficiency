import * as React from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import AppTheme from './AppTheme';
import ColorModeSelect from './ColorModeSelect';
import SignInCard from './SignInCard';
import Content from './Content';
import kingUniformsLogo from '../assets/King Uniforms Logo.jpeg';

export default function SignInSide(props: { disableCustomTheme?: boolean }) {
  // Read announcements and image from localStorage
  const [announcements, setAnnouncements] = React.useState<string>(
    localStorage.getItem('loginAnnouncements') || ''
  );
  const [announcementImage, setAnnouncementImage] = React.useState<string | null>(
    localStorage.getItem('loginAnnouncementImage') || null
  );

  // Listen for changes in localStorage (in case settings are updated while login page is open)
  React.useEffect(() => {
    const onStorage = () => {
      setAnnouncements(localStorage.getItem('loginAnnouncements') || '');
      setAnnouncementImage(localStorage.getItem('loginAnnouncementImage') || null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <ColorModeSelect sx={{ position: 'fixed', top: '1rem', right: '1rem' }} />
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        component="main"
        sx={{
          minHeight: '100vh',
          width: '100vw',
          background: '#fff',
          alignItems: 'stretch',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Full-height blue left column */}
        <Stack
          sx={{
            width: { xs: '100%', md: '45%' },
            minWidth: { xs: '100%', md: 300 },
            minHeight: { xs: 220, md: '100vh' },
            background: '#007bff', // Match login button blue
            borderRadius: 0,
            boxShadow: 'none',
            p: { xs: 3, md: 6 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#fff', // Ensure all text is white
            textAlign: { xs: 'center', md: 'left' },
          }}
        >
          <Content announcements={announcements} announcementImage={announcementImage} />
        </Stack>
        {/* Sign In Section - No card, just form */}
        <Stack
          sx={{
            width: { xs: '100%', md: '55%' },
            minWidth: { xs: '100%', md: 320 },
            minHeight: { xs: 320, md: '100vh' },
            background: 'transparent',
            borderRadius: 0,
            boxShadow: 'none',
            p: { xs: 3, md: 6 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <SignInCard noCard headingProps={{
            style: {
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: 1,
              color: '#0E62A0',
              marginBottom: 28,
              textAlign: 'center',
              fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
              textTransform: 'uppercase',
            }
          }} />
        </Stack>
      </Stack>
    </AppTheme>
  );
}
