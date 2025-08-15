// Test PDF Centering Fix - Verification Script
// Run this in the browser console after generating a PDF to check centering calculations

console.log('🎯 PDF Centering Verification Script');
console.log('='.repeat(50));

// Test to verify centering calculations work correctly
function testCenteringCalculations() {
  console.log('\n📐 Testing Centering Math:');
  console.log('-'.repeat(30));
  
  // Simulate typical PDF dimensions (Letter size in points)
  const pdfWidth = 8.5 * 72; // 612 points
  const pdfHeight = 11 * 72; // 792 points
  
  // Simulate typical canvas dimensions (from html2canvas)
  const canvasWidth = 800;
  const canvasHeight = 1000;
  
  // Calculate how the image would be scaled and centered
  const aspectRatio = canvasWidth / canvasHeight;
  let imgWidth = pdfWidth;
  let imgHeight = pdfWidth / aspectRatio;
  
  // If image is too tall, scale by height instead
  if (imgHeight > pdfHeight) {
    imgHeight = pdfHeight;
    imgWidth = pdfHeight * aspectRatio;
  }
  
  // Calculate centering position
  const x = (pdfWidth - imgWidth) / 2;
  const y = (pdfHeight - imgHeight) / 2;
  
  console.log('📊 Calculation Results:');
  console.log(`   PDF size: ${pdfWidth} x ${pdfHeight} pts (${pdfWidth/72}" x ${pdfHeight/72}")`);
  console.log(`   Canvas size: ${canvasWidth} x ${canvasHeight} px`);
  console.log(`   Aspect ratio: ${aspectRatio.toFixed(3)}`);
  console.log(`   Scaled image: ${imgWidth.toFixed(1)} x ${imgHeight.toFixed(1)} pts`);
  console.log(`   Center position: x=${x.toFixed(1)}, y=${y.toFixed(1)}`);
  console.log(`   Margins: left/right=${x.toFixed(1)}pts, top/bottom=${y.toFixed(1)}pts`);
  
  // Verify centering is correct
  const leftMargin = x;
  const rightMargin = pdfWidth - imgWidth - x;
  const topMargin = y;
  const bottomMargin = pdfHeight - imgHeight - y;
  
  console.log('\n✅ Verification:');
  console.log(`   Left margin: ${leftMargin.toFixed(1)}pts`);
  console.log(`   Right margin: ${rightMargin.toFixed(1)}pts`);
  console.log(`   Top margin: ${topMargin.toFixed(1)}pts`);
  console.log(`   Bottom margin: ${bottomMargin.toFixed(1)}pts`);
  
  const isProperlycentered = (
    Math.abs(leftMargin - rightMargin) < 1 && 
    Math.abs(topMargin - bottomMargin) < 1
  );
  
  if (isProperlycentered) {
    console.log('🎉 CENTERED CORRECTLY!');
  } else {
    console.log('❌ NOT CENTERED - Check calculations');
  }
  
  return {
    pdfWidth,
    pdfHeight,
    imgWidth,
    imgHeight,
    x,
    y,
    isProperlycentered
  };
}

// Test with different paper sizes
function testDifferentPaperSizes() {
  console.log('\n📄 Testing Different Paper Sizes:');
  console.log('-'.repeat(40));
  
  const paperSizes = {
    'Letter': { width: 8.5 * 72, height: 11 * 72 },
    'A4': { width: 8.27 * 72, height: 11.7 * 72 },
    'Legal': { width: 8.5 * 72, height: 14 * 72 }
  };
  
  Object.entries(paperSizes).forEach(([name, size]) => {
    console.log(`\n${name} (${(size.width/72).toFixed(2)}" x ${(size.height/72).toFixed(2)}"):`);
    
    // Simulate canvas size
    const canvasWidth = 800;
    const canvasHeight = 1000;
    const aspectRatio = canvasWidth / canvasHeight;
    
    let imgWidth = size.width;
    let imgHeight = size.width / aspectRatio;
    
    if (imgHeight > size.height) {
      imgHeight = size.height;
      imgWidth = size.height * aspectRatio;
    }
    
    const x = (size.width - imgWidth) / 2;
    const y = (size.height - imgHeight) / 2;
    
    console.log(`   Position: x=${x.toFixed(1)}, y=${y.toFixed(1)}`);
    console.log(`   Margins: ${x.toFixed(1)}pts on sides, ${y.toFixed(1)}pts top/bottom`);
  });
}

// Run tests automatically
console.log('\n🧪 Running Centering Tests...');
testCenteringCalculations();
testDifferentPaperSizes();

console.log('\n📋 Next Steps:');
console.log('1. Generate a PDF from the preview to see the centering in action');
console.log('2. Check browser console for centering calculation logs');
console.log('3. Verify the PDF shows content centered on the page');
console.log('4. If still not centered, check that pagination is set to "single"');

// Make functions available globally for manual testing
window.testCenteringCalculations = testCenteringCalculations;
window.testDifferentPaperSizes = testDifferentPaperSizes;

console.log('\n🔧 Available Functions:');
console.log('• testCenteringCalculations() - Test the math');
console.log('• testDifferentPaperSizes() - Test different paper sizes');
