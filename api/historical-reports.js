// API endpoint for historical reports
import { readdir, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Create reports directory if it doesn't exist
const reportsDir = path.join(process.cwd(), 'production-reports');

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      // List all available reports
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
      
      res.status(200).json({ success: true, reports });
      
    } else if (req.method === 'POST') {
      // Generate a new report
      const { action, date, startDate, endDate } = req.body;
      
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
      
      try {
        // Execute the command
        const { stdout, stderr } = await execAsync(command, { cwd: process.cwd() });
        
        if (stderr && !stderr.includes('Warning')) {
          console.error('Report generation stderr:', stderr);
        }
        
        res.status(200).json({ 
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
      
    } else {
      res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message
    });
  }
}
