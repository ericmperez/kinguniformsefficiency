/**
 * PDF Size Test - Quick Test for New Optimized Settings
 * This test verifies that PDFs are now generated with smaller file sizes
 */

import { generateInvoicePDF } from './src/services/emailService.js';

// Mock data for testing
const mockClient = {
  id: 'test-client',
  name: 'Test Client',
  email: 'test@example.com',
  billingCalculation: 'byWeight'
};

const mockInvoice = {
  id: 'test-invoice',
  invoiceNumber: '12345',
  clientId: 'test-client',
  clientName: 'Test Client',
  date: '2025-08-14',
  deliveryDate: '2025-08-14',
  total: 150.00,
  totalWeight: 85.5,
  truckNumber: '34',
  carts: [
    {
      id: 'cart-1',
      name: 'Cart 1',
      items: [
        { productId: '1', productName: 'Scrub Shirts', quantity: 25, price: 3.00 },
        { productId: '2', productName: 'Scrub Pants', quantity: 20, price: 3.75 }
      ],
      total: 150.00,
      createdAt: '2025-08-14T10:00:00Z'
    }
  ]
};

const mockPrintConfig = {
  pdfOptions: {
    scale: 0.75, // New reduced scale
    showSignatures: true,
    showTimestamp: false,
    showLocation: false,
    showQuantities: true,
    contentDisplay: 'summary', // New summary mode
    paperSize: 'a4', // Changed from letter to a4
    orientation: 'portrait',
    margins: 'narrow', // New narrow margins
    fontSize: 'small', // New small font
    showWatermark: false,
    headerText: '',
    footerText: '',
    logoSize: 'small', // New small logo
    showBorder: false, // Removed border
    pagination: 'single'
  }
};

async function testPDFSize() {
  try {
    console.log('🧪 Testing PDF generation with new optimized settings...');
    
    const startTime = Date.now();
    const pdfBase64 = await generateInvoicePDF(
      mockClient,
      mockInvoice,
      mockPrintConfig,
      'Test Driver',
      true // optimizeForEmail = true
    );
    const endTime = Date.now();
    
    if (!pdfBase64) {
      console.error('❌ PDF generation failed - returned undefined');
      return;
    }
    
    // Calculate PDF size
    const pdfSizeBytes = (pdfBase64.length * 3) / 4; // Base64 to bytes conversion
    const pdfSizeMB = pdfSizeBytes / (1024 * 1024);
    
    console.log('✅ PDF generated successfully!');
    console.log(`📄 PDF Size: ${pdfSizeMB.toFixed(2)} MB (${pdfSizeBytes.toFixed(0)} bytes)`);
    console.log(`⏱️  Generation Time: ${endTime - startTime}ms`);
    
    // Check if size is reasonable for email
    if (pdfSizeMB <= 5) {
      console.log('🎯 PDF size is good for email delivery (≤ 5MB)');
    } else if (pdfSizeMB <= 10) {
      console.log('⚠️  PDF size is borderline for email (5-10MB)');
    } else {
      console.log('❌ PDF size is too large for email (> 10MB)');
    }
    
    // Compare with expected size
    console.log('\n📊 Size Analysis:');
    console.log(`• Base64 string length: ${pdfBase64.length.toLocaleString()} characters`);
    console.log(`• Estimated binary size: ${(pdfSizeBytes / 1024).toFixed(0)} KB`);
    console.log(`• Size in MB: ${pdfSizeMB.toFixed(3)} MB`);
    
    if (pdfSizeMB < 3) {
      console.log('🎉 Excellent! PDF is very compact and email-friendly');
    } else if (pdfSizeMB < 5) {
      console.log('👍 Good! PDF size is reasonable for email delivery');
    } else {
      console.log('⚠️  PDF could be smaller for better email delivery');
    }
    
  } catch (error) {
    console.error('❌ PDF generation test failed:', error);
  }
}

console.log('📄 PDF Size Optimization Test');
console.log('=' .repeat(50));
console.log('\n🎯 Testing with optimized settings:');
console.log('• Paper Size: A4 (instead of Letter)');
console.log('• Scale: 75% (instead of 100%)');
console.log('• Content: Summary (instead of Detailed)');
console.log('• Margins: Narrow (instead of Normal)');
console.log('• Font: Small (instead of Medium)');
console.log('• Logo: Small (instead of Medium)');
console.log('• Border: Disabled');
console.log('');

testPDFSize();
