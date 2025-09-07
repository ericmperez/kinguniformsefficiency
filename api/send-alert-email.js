import sgMail from '@sendgrid/mail';

// Configure SendGrid
if (!process.env.SENDGRID_API_KEY) {
  console.error('❌ SENDGRID_API_KEY environment variable is not set');
}
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    recipients, 
    subject, 
    alertType, 
    severity, 
    title, 
    message, 
    component, 
    clientName, 
    userName, 
    timestamp, 
    triggerData 
  } = req.body;
  
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Recipients array is required' });
  }

  if (!title || !message) {
    return res.status(400).json({ error: 'Alert title and message are required' });
  }

  try {
    // Clean up recipients
    const cleanRecipients = recipients.filter(email => email && email.trim().length > 0);
    
    if (cleanRecipients.length === 0) {
      return res.status(400).json({ error: 'No valid recipients found' });
    }

    // Determine severity emoji and color
    const severityInfo = getSeverityInfo(severity);
    
    // Generate HTML email content
    const htmlContent = generateAlertEmailHTML({
      alertType,
      severity,
      severityInfo,
      title,
      message,
      component,
      clientName,
      userName,
      timestamp,
      triggerData
    });

    // Generate plain text version
    const textContent = generateAlertEmailText({
      alertType,
      severity,
      title,
      message,
      component,
      clientName,
      userName,
      timestamp,
      triggerData
    });

    const msg = {
      to: cleanRecipients,
      from: {
        email: process.env.FROM_EMAIL || 'noreply@kinguniforms.net',
        name: 'King Uniforms Alert System'
      },
      subject: subject || `🚨 System Alert: ${title}`,
      text: textContent,
      html: htmlContent
    };

    console.log(`📧 Sending alert email to: ${cleanRecipients.join(', ')}`);
    console.log(`📧 Alert: ${title} (${severity})`);
    
    await sgMail.sendMultiple(msg);
    
    res.status(200).json({ 
      success: true, 
      message: 'Alert email sent successfully',
      recipients: cleanRecipients.length,
      alertType,
      severity 
    });
    
  } catch (error) {
    console.error('❌ Error sending alert email:', error);
    
    // Handle specific SendGrid errors
    if (error.response) {
      console.error('SendGrid error response:', error.response.body);
      return res.status(500).json({ 
        error: 'Failed to send alert email', 
        details: error.response.body?.errors?.[0]?.message || 'Unknown SendGrid error'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to send alert email', 
      details: error.message 
    });
  }
}

function getSeverityInfo(severity) {
  const severityMap = {
    critical: { emoji: '🔴', color: '#dc3545', label: 'CRITICAL' },
    high: { emoji: '🟠', color: '#fd7e14', label: 'HIGH' },
    medium: { emoji: '🟡', color: '#ffc107', label: 'MEDIUM' },
    low: { emoji: '🟢', color: '#28a745', label: 'LOW' },
    info: { emoji: 'ℹ️', color: '#17a2b8', label: 'INFO' }
  };
  
  return severityMap[severity] || severityMap.medium;
}

function generateAlertEmailHTML({ alertType, severity, severityInfo, title, message, component, clientName, userName, timestamp, triggerData }) {
  const formattedDate = new Date(timestamp).toLocaleString('en-US', {
    timeZone: 'America/Puerto_Rico',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f8f9fa; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, ${severityInfo.color}, ${severityInfo.color}dd); color: white; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .severity-badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-top: 10px; }
        .content { padding: 25px; }
        .alert-title { font-size: 20px; font-weight: 600; color: #333; margin-bottom: 15px; }
        .alert-message { font-size: 16px; line-height: 1.6; color: #555; margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; border-left: 4px solid ${severityInfo.color}; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .detail-item { background-color: #f8f9fa; padding: 12px; border-radius: 5px; }
        .detail-label { font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 5px; }
        .detail-value { font-size: 14px; color: #333; font-weight: 500; }
        .trigger-data { background-color: #f1f3f4; padding: 15px; border-radius: 5px; margin-top: 20px; }
        .trigger-data h4 { margin: 0 0 10px 0; color: #333; font-size: 14px; }
        .trigger-data pre { margin: 0; font-size: 12px; color: #666; white-space: pre-wrap; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; color: #666; font-size: 12px; }
        .company-logo { color: #0E62A0; font-weight: bold; font-size: 14px; }
        @media (max-width: 480px) {
          .details-grid { grid-template-columns: 1fr; }
          .container { margin: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${severityInfo.emoji} System Alert</h1>
          <div class="severity-badge">${severityInfo.label} PRIORITY</div>
        </div>
        
        <div class="content">
          <div class="alert-title">${title}</div>
          
          <div class="alert-message">
            ${message}
          </div>
          
          <div class="details-grid">
            <div class="detail-item">
              <div class="detail-label">Component</div>
              <div class="detail-value">${component}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Alert Type</div>
              <div class="detail-value">${alertType.replace('_', ' ').toUpperCase()}</div>
            </div>
            ${clientName ? `
            <div class="detail-item">
              <div class="detail-label">Client</div>
              <div class="detail-value">${clientName}</div>
            </div>
            ` : ''}
            ${userName ? `
            <div class="detail-item">
              <div class="detail-label">User</div>
              <div class="detail-value">${userName}</div>
            </div>
            ` : ''}
            <div class="detail-item">
              <div class="detail-label">Timestamp</div>
              <div class="detail-value">${formattedDate}</div>
            </div>
            <div class="detail-item">
              <div class="detail-label">Severity</div>
              <div class="detail-value" style="color: ${severityInfo.color}; font-weight: 600;">${severityInfo.label}</div>
            </div>
          </div>
          
          ${triggerData ? `
          <div class="trigger-data">
            <h4>Additional Details:</h4>
            <pre>${JSON.stringify(triggerData, null, 2)}</pre>
          </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <div class="company-logo">King Uniforms Alert System</div>
          <div>This is an automated system alert. Please do not reply to this email.</div>
          <div>Generated at ${formattedDate}</div>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateAlertEmailText({ alertType, severity, title, message, component, clientName, userName, timestamp, triggerData }) {
  const formattedDate = new Date(timestamp).toLocaleString('en-US', {
    timeZone: 'America/Puerto_Rico',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  let text = `🚨 KING UNIFORMS SYSTEM ALERT 🚨\n\n`;
  text += `SEVERITY: ${severity.toUpperCase()}\n`;
  text += `ALERT TYPE: ${alertType.replace('_', ' ').toUpperCase()}\n\n`;
  text += `TITLE: ${title}\n\n`;
  text += `MESSAGE: ${message}\n\n`;
  text += `DETAILS:\n`;
  text += `- Component: ${component}\n`;
  if (clientName) text += `- Client: ${clientName}\n`;
  if (userName) text += `- User: ${userName}\n`;
  text += `- Timestamp: ${formattedDate}\n\n`;
  
  if (triggerData) {
    text += `ADDITIONAL DETAILS:\n${JSON.stringify(triggerData, null, 2)}\n\n`;
  }
  
  text += `---\n`;
  text += `King Uniforms Alert System\n`;
  text += `This is an automated system alert. Please do not reply to this email.\n`;
  text += `Generated at ${formattedDate}`;
  
  return text;
}
