const express = require('express');
const sgMail = require('@sendgrid/mail');
const { readdir, readFile, mkdir } = require('fs').promises;
const { existsSync } = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const app = express();

// Add CORS support to allow requests from our frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '30mb' })); // Increased limit to 30mb for large PDF attachments

// Configure SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/api/send-invoice', async (req, res) => {
  const { to, subject, text, pdfBase64, invoiceNumber } = req.body;
  if (!to || !pdfBase64) return res.status(400).json({ error: 'Missing data' });
  const msg = {
    to,
    from: 'notifications@kinguniforms.net',
    subject,
    text,
    attachments: [
      {
        content: pdfBase64,
        filename: invoiceNumber ? `deliveryticket#${invoiceNumber}.pdf` : 'deliveryticket.pdf',
        type: 'application/pdf',
        disposition: 'attachment'
      }
    ]
  };
  try {
    await sgMail.send(msg);
    res.json({ success: true });
  } catch (err) {
    console.error('SendGrid email error:', err);
    res.status(500).json({ error: 'Failed to send email', details: err.message });
  }
});

// New endpoint for sending test emails (now supports PDF attachments)
app.post('/api/send-test-email', async (req, res) => {
  const { to, cc, subject, body, pdfBase64, invoiceNumber } = req.body;
  if (!to) return res.status(400).json({ error: 'Recipient email is required' });
  
  try {
    const msg = {
      to,
      from: 'notifications@kinguniforms.net',
      cc: cc || [],
      subject,
      text: body
    };

    // Add PDF attachment if provided
    if (pdfBase64) {
      msg.attachments = [
        {
          content: pdfBase64,
          filename: invoiceNumber ? `deliveryticket#${invoiceNumber}.pdf` : 'deliveryticket-test.pdf',
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ];
    }

    await sgMail.send(msg);
    console.log(`Test email sent successfully to ${to}${pdfBase64 ? ' with PDF attachment' : ''}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Test email send error:', err);
    res.status(500).json({ error: 'Failed to send test email', details: err.message });
  }
});

// Historical Reports API endpoint
app.get('/api/historical-reports', async (req, res) => {
  const reportsDir = path.join(__dirname, 'production-reports');
  
  try {
    // Create reports directory if it doesn't exist
    if (!existsSync(reportsDir)) {
      await mkdir(reportsDir, { recursive: true });
    }

    const files = await readdir(reportsDir);
    const reportFiles = files.filter(file => file.endsWith('.json'));
    
    const reports = [];
    
    for (const file of reportFiles) {
      try {
        const filePath = path.join(reportsDir, file);
        const content = await readFile(filePath, 'utf8');
        const reportData = JSON.parse(content);
        reports.push(reportData);
      } catch (error) {
        console.error(`Error reading report file ${file}:`, error);
        // Skip invalid files
      }
    }

    // Sort reports by date (newest first)
    reports.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json({ success: true, reports });
  } catch (error) {
    console.error('Error loading reports:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load reports',
      details: error.message
    });
  }
});

app.post('/api/historical-reports', async (req, res) => {
  const { action, date, startDate, endDate } = req.body;
  
  try {
    let command;
    
    switch (action) {
      case 'today':
        command = 'node historical-production-report.js today';
        break;
      case 'date':
        if (!date) {
          return res.status(400).json({ success: false, error: 'Date is required for date action' });
        }
        command = `node historical-production-report.js date ${date}`;
        break;
      case 'range':
        if (!startDate || !endDate) {
          return res.status(400).json({ success: false, error: 'Start and end dates are required for range action' });
        }
        command = `node historical-production-report.js range ${startDate} ${endDate}`;
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    // Execute the command
    const { stdout, stderr } = await execAsync(command, { cwd: __dirname });
    
    if (stderr && !stderr.includes('Warning')) {
      console.error('Report generation stderr:', stderr);
    }
    
    res.json({ 
      success: true, 
      message: 'Report generated successfully',
      output: stdout
    });
    
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate report',
      details: error.message
    });
  }
});

// Endpoint for sending cart verification error emails
app.post('/api/send-verification-error-email', async (req, res) => {
  const { clientName, expectedCount, actualCount, username, date } = req.body;
  
  if (!clientName || !expectedCount || !actualCount || !username) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const subject = `🚨 Cart Verification Error - ${clientName}`;
  const text = `
Cart Count Verification Error

Client: ${clientName}
Employee: ${username}
Date: ${formattedDate}

Expected Cart Count: ${expectedCount}
Actual Cart Count: ${actualCount}
Difference: ${Math.abs(expectedCount - actualCount)} cart(s)

This error has been logged in the system activity logs.

Please review with the employee to ensure accurate counting procedures are being followed.

---
King Uniforms Laundry Management System
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 20px; border-radius: 8px;">
      <div style="background: #dc3545; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <h2 style="margin: 0; font-size: 24px;">🚨 Cart Verification Error</h2>
      </div>
      
      <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #dc3545;">
        <h3 style="color: #dc3545; margin-top: 0;">Verification Details</h3>
        
        <div style="margin: 15px 0;">
          <strong>Client:</strong> ${clientName}<br>
          <strong>Employee:</strong> ${username}<br>
          <strong>Date:</strong> ${formattedDate}
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span><strong>Expected Count:</strong></span>
            <span style="color: #28a745; font-weight: bold;">${expectedCount} carts</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <span><strong>Actual Count:</strong></span>
            <span style="color: #dc3545; font-weight: bold;">${actualCount} carts</span>
          </div>
          <div style="display: flex; justify-content: space-between; border-top: 1px solid #dee2e6; padding-top: 10px;">
            <span><strong>Difference:</strong></span>
            <span style="color: #dc3545; font-weight: bold;">${Math.abs(expectedCount - actualCount)} cart(s)</span>
          </div>
        </div>
        
        <div style="background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 12px; border-radius: 6px; margin: 15px 0;">
          <strong>⚠️ Action Required:</strong> Please review counting procedures with the employee to ensure accuracy.
        </div>
        
        <div style="font-size: 12px; color: #6c757d; border-top: 1px solid #dee2e6; padding-top: 15px; margin-top: 20px;">
          This error has been automatically logged in the system activity logs.<br>
          <em>King Uniforms Laundry Management System</em>
        </div>
      </div>
    </div>
  `;

  const msg = {
    to: [
      'rmperez@kinguniforms.net',
      'jperez@kinguniforms.net',
      'eric.perez.pr@gmail.com'
    ],
    from: 'notifications@kinguniforms.net',
    subject,
    text,
    html
  };

  try {
    await sgMail.send(msg);
    console.log(`Verification error email sent for ${clientName} - Employee: ${username}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending verification error email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.listen(3001, () => console.log('Backend listening on port 3001'));
