import { checkAndNotifyUnassignedDrivers } from '../lib/truckAssignmentNotifier.js';
import { getNotificationRecipients } from '../lib/notificationConfig.js';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verify this is a cron request (optional security check)
  const authHeader = req.headers.authorization;
  if (req.method === 'POST' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Running scheduled truck assignment check...');
    
    // Get recipients from configuration (saved in database)
    const recipients = await getNotificationRecipients();

    const result = await checkAndNotifyUnassignedDrivers(recipients);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Truck assignment check completed successfully',
      unassignedTrucks: result.alert.unassignedTrucks.length,
      totalScheduledTrucks: result.alert.totalScheduledTrucks,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    
    // Send error notification
    try {
      const response = await fetch(process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}/api/send-test-email`
        : 'http://localhost:5173/api/send-test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: 'rmperez@kinguniforms.net, eric.perez.pr@gmail.com, jperez@kinguniforms.net',
          subject: '🚨 King Uniforms - Truck Assignment Check Failed',
          body: `The automated truck assignment check failed at ${new Date().toLocaleString("en-US")}.\n\nError: ${error.message}\n\nPlease check the system manually and contact technical support if needed.`
        }),
      });
    } catch (emailError) {
      console.error("Failed to send error notification:", emailError);
    }
    
    return res.status(500).json({ 
      success: false, 
      error: 'Truck assignment check failed', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Truck assignment check failed', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
