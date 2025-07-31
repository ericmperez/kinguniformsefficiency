import { checkAndNotifyUnassignedDrivers } from '../lib/truckAssignmentNotifier.js';

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

  // Only allow GET and POST methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Testing truck assignment check system...');
    
    // Recipients for the test notification
    const recipients = ['emperez@kinguniforms.net'];

    const result = await checkAndNotifyUnassignedDrivers(recipients);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Truck assignment test completed successfully',
      data: {
        unassignedTrucks: result.alert.unassignedTrucks,
        assignedTrucks: result.alert.assignedTrucks,
        totalScheduledTrucks: result.alert.totalScheduledTrucks,
        targetDate: result.alert.targetDate
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Test failed:', error);
    
    return res.status(500).json({ 
      success: false, 
      error: 'Truck assignment test failed', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
