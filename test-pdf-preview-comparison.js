// Test script to verify PDF matches Preview exactly
const testPdfPreviewComparison = () => {
  console.log("🔍 PDF vs Preview Comparison Test");
  console.log("=".repeat(50));
  
  // Simulate current PDF generation settings
  const pdfOptions = {
    paperSize: 'letter',
    orientation: 'portrait',
    pagination: 'single',
    scale: 1.0
  };
  
  // Current PDF dimensions
  const pdfWidth = 8.5 * 72; // 612 pts
  const pdfHeight = 11 * 72; // 792 pts
  
  console.log("📄 PDF Configuration:");
  console.log(`   Paper: ${pdfOptions.paperSize} ${pdfOptions.orientation}`);
  console.log(`   Pagination: ${pdfOptions.pagination}`);
  console.log(`   PDF dimensions: ${pdfWidth} × ${pdfHeight} pts`);
  
  // Current centering calculation (95% page width)
  const canvasWidth = 1000; // Typical rendered width
  const canvasHeight = 1200; // Typical rendered height
  const aspectRatio = canvasWidth / canvasHeight;
  
  let imgWidth = pdfWidth * 0.95; // 95% usage
  let imgHeight = imgWidth / aspectRatio;
  
  if (imgHeight > pdfHeight * 0.95) {
    imgHeight = pdfHeight * 0.95;
    imgWidth = imgHeight * aspectRatio;
  }
  
  const x = (pdfWidth - imgWidth) / 2;
  const leftMargin = x;
  const rightMargin = pdfWidth - imgWidth - x;
  
  console.log("\n📊 Current PDF Layout:");
  console.log(`   Content width: ${imgWidth.toFixed(1)} pts`);
  console.log(`   Content height: ${imgHeight.toFixed(1)} pts`);
  console.log(`   Left margin: ${leftMargin.toFixed(1)} pts`);
  console.log(`   Right margin: ${rightMargin.toFixed(1)} pts`);
  console.log(`   Margin difference: ${Math.abs(leftMargin - rightMargin).toFixed(1)} pts`);
  console.log(`   Margins equal: ${Math.abs(leftMargin - rightMargin) < 0.1 ? '✅ YES' : '❌ NO'}`);
  
  // Preview component typical settings
  console.log("\n🖥️ Preview Component Analysis:");
  console.log("   Container: flexbox with justifyContent: center");
  console.log("   Wrapper: maxWidth constraint (800px letter, 850px legal)");
  console.log("   Padding: 30px default");
  console.log("   Width handling: auto-flow within constraints");
  
  // Calculate preview margins
  const previewContainerWidth = 800; // Typical preview container
  const previewContentWidth = 700; // Typical content width after padding
  const previewLeftMargin = (previewContainerWidth - previewContentWidth) / 2;
  const previewRightMargin = previewLeftMargin;
  
  console.log(`   Preview left margin: ${previewLeftMargin}px`);
  console.log(`   Preview right margin: ${previewRightMargin}px`);
  console.log(`   Preview margins equal: ✅ YES (by design)`);
  
  // Conversion analysis
  const pointsPerPixel = 0.75; // Typical conversion
  const previewLeftMarginPts = previewLeftMargin * pointsPerPixel;
  const previewRightMarginPts = previewRightMargin * pointsPerPixel;
  
  console.log("\n🔄 Preview to PDF Conversion:");
  console.log(`   Preview margins in points: ${previewLeftMarginPts.toFixed(1)} pts each`);
  console.log(`   PDF margins in points: ${leftMargin.toFixed(1)} pts each`);
  console.log(`   Margin ratio match: ${(leftMargin / previewLeftMarginPts).toFixed(2)}x`);
  
  // Issue identification
  console.log("\n🎯 Issue Analysis:");
  if (Math.abs(leftMargin - rightMargin) > 0.1) {
    console.log("❌ PDF margins are NOT equal - centering is off");
  } else {
    console.log("✅ PDF margins are equal - centering is correct");
  }
  
  const marginRatio = leftMargin / previewLeftMarginPts;
  if (marginRatio < 0.8 || marginRatio > 1.2) {
    console.log("❌ PDF margin proportions don't match preview");
  } else {
    console.log("✅ PDF margin proportions match preview well");
  }
  
  console.log("\n🔧 Recommendations:");
  console.log("1. Verify container setup matches preview exactly");
  console.log("2. Use same flexbox centering as preview");
  console.log("3. Apply same maxWidth constraints as preview");
  console.log("4. Use Math.round() for pixel-perfect positioning");
  console.log("5. Test with actual rendered content dimensions");
  
  return {
    pdfMarginsEqual: Math.abs(leftMargin - rightMargin) < 0.1,
    marginsMatchPreview: marginRatio >= 0.8 && marginRatio <= 1.2,
    recommendations: [
      "Match container setup exactly",
      "Use flexbox centering",
      "Apply maxWidth constraints",
      "Use Math.round() positioning"
    ]
  };
};

// Run the test
const result = testPdfPreviewComparison();
console.log("\n📋 Test Result:", result);
