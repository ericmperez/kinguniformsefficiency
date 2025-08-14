/**
 * Test PDF Compression Service
 * Tests the compression functionality with different PDF sizes
 */

import { smartCompressPDF, compressPDF, aggressiveCompressPDF } from '../src/services/pdfCompressionService.js';

// Create a mock large PDF for testing (simulate 13MB PDF)
function createMockLargePDF() {
  // Create a base64 string that represents a large PDF
  const mockPdfHeader = 'data:application/pdf;base64,JVBERi0xLjQK'; // PDF header in base64
  
  // Add mock content to simulate a 13MB file
  const mockContent = 'A'.repeat(17000000); // ~17MB when base64 encoded to simulate 13MB binary
  const mockBase64 = btoa(mockContent);
  
  return mockPdfHeader + mockBase64;
}

async function testPDFCompression() {
  console.log('🧪 Testing PDF Compression Service...\n');
  
  try {
    // Test 1: Small PDF (should not be compressed)
    console.log('📋 Test 1: Small PDF (2MB)');
    const smallPDF = 'data:application/pdf;base64,' + 'A'.repeat(2700000); // ~2MB
    const smallResult = await smartCompressPDF(smallPDF);
    console.log(`   Result: ${smallResult.success ? '✅' : '❌'}`);
    console.log(`   Method: ${smallResult.compressionMethod}`);
    console.log(`   Size: ${smallResult.originalSize.toFixed(2)}MB → ${smallResult.compressedSize.toFixed(2)}MB`);
    console.log('');
    
    // Test 2: Medium PDF (should use medium compression)
    console.log('📋 Test 2: Medium PDF (4MB)');
    const mediumPDF = 'data:application/pdf;base64,' + 'B'.repeat(5400000); // ~4MB
    const mediumResult = await smartCompressPDF(mediumPDF);
    console.log(`   Result: ${mediumResult.success ? '✅' : '❌'}`);
    console.log(`   Method: ${mediumResult.compressionMethod}`);
    console.log(`   Size: ${mediumResult.originalSize.toFixed(2)}MB → ${mediumResult.compressedSize.toFixed(2)}MB`);
    console.log('');
    
    // Test 3: Large PDF (should use high compression)
    console.log('📋 Test 3: Large PDF (8MB)');
    const largePDF = 'data:application/pdf;base64,' + 'C'.repeat(10800000); // ~8MB
    const largeResult = await smartCompressPDF(largePDF);
    console.log(`   Result: ${largeResult.success ? '✅' : '❌'}`);
    console.log(`   Method: ${largeResult.compressionMethod}`);
    console.log(`   Size: ${largeResult.originalSize.toFixed(2)}MB → ${largeResult.compressedSize.toFixed(2)}MB`);
    console.log('');
    
    // Test 4: Very Large PDF (should use aggressive compression)
    console.log('📋 Test 4: Very Large PDF (13MB)');
    const veryLargePDF = createMockLargePDF();
    const veryLargeResult = await smartCompressPDF(veryLargePDF);
    console.log(`   Result: ${veryLargeResult.success ? '✅' : '❌'}`);
    console.log(`   Method: ${veryLargeResult.compressionMethod}`);
    console.log(`   Size: ${veryLargeResult.originalSize.toFixed(2)}MB → ${veryLargeResult.compressedSize.toFixed(2)}MB`);
    if (veryLargeResult.success) {
      console.log(`   Compression: ${(veryLargeResult.compressionRatio * 100).toFixed(1)}% of original size`);
      console.log(`   Space saved: ${(veryLargeResult.originalSize - veryLargeResult.compressedSize).toFixed(2)}MB`);
    }
    console.log('');
    
    // Test 5: Aggressive compression specifically
    console.log('📋 Test 5: Aggressive Compression on 13MB PDF');
    const aggressiveResult = await aggressiveCompressPDF(veryLargePDF);
    console.log(`   Result: ${aggressiveResult.success ? '✅' : '❌'}`);
    console.log(`   Size: ${aggressiveResult.originalSize.toFixed(2)}MB → ${aggressiveResult.compressedSize.toFixed(2)}MB`);
    if (aggressiveResult.success) {
      console.log(`   Compression: ${(aggressiveResult.compressionRatio * 100).toFixed(1)}% of original size`);
      console.log(`   Space saved: ${(aggressiveResult.originalSize - aggressiveResult.compressedSize).toFixed(2)}MB`);
      
      // Check if it's now small enough for email
      if (aggressiveResult.compressedSize <= 3) {
        console.log(`   ✅ PDF is now small enough for email (≤3MB)`);
      } else {
        console.log(`   ⚠️ PDF still too large for email (>3MB)`);
      }
    }
    console.log('');
    
    console.log('🎉 PDF Compression Service tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPDFCompression();
}

export { testPDFCompression };
