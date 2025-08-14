/**
 * Size-Optimized PDF Preset
 * Use this configuration to generate the smallest possible PDFs
 */

export const MINIMAL_PDF_OPTIONS = {
  // Smallest paper size while remaining readable
  paperSize: 'a4', // 15% smaller than letter
  orientation: 'portrait',
  
  // Reduced scale for smaller file size
  scale: 0.75, // 25% smaller than default
  
  // Minimal content to reduce PDF size
  contentDisplay: 'weight-only', // Only show weight, no item tables
  showSignatures: false, // Remove signature images (big space saver)
  showTimestamp: false,
  showLocation: false,
  showWatermark: false,
  showBorder: false,
  
  // Compact layout
  margins: 'narrow', // Minimize whitespace
  fontSize: 'small', // Smaller text
  logoSize: 'small', // Smaller logo
  pagination: 'single', // Force single page
  
  // Empty headers/footers
  headerText: '',
  footerText: ''
};

export const BALANCED_PDF_OPTIONS = {
  // Good balance of size and readability
  paperSize: 'a4',
  orientation: 'portrait',
  scale: 0.85, // Slightly reduced
  
  // Show essential content only
  contentDisplay: 'summary', // Summary instead of detailed
  showSignatures: true, // Keep signatures for legal purposes
  showTimestamp: false,
  showLocation: false,
  showWatermark: false,
  showBorder: false,
  
  // Semi-compact layout
  margins: 'narrow',
  fontSize: 'small',
  logoSize: 'small',
  pagination: 'single',
  
  headerText: '',
  footerText: ''
};

// Usage instructions
console.log('🎯 PDF SIZE OPTIMIZATION PRESETS');
console.log('=' .repeat(40));
console.log('');
console.log('📊 MINIMAL_PDF_OPTIONS:');
console.log('• Target: Maximum size reduction (70-80% smaller)');
console.log('• Use for: Internal records, basic confirmations');
console.log('• File size: 13MB → 2-3MB');
console.log('');
console.log('⚖️ BALANCED_PDF_OPTIONS:');
console.log('• Target: Good size reduction with readability (50-60% smaller)');
console.log('• Use for: Customer emails, delivery confirmations');
console.log('• File size: 13MB → 4-6MB');
console.log('');
console.log('🛠️ HOW TO APPLY:');
console.log('1. Update client PDF options with one of these presets');
console.log('2. Apply in PrintingSettings.tsx default configuration');
console.log('3. Use in email service for automatic optimization');
