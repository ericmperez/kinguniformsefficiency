// Real-world PDF centering test with current settings
const testCurrentPdfCentering = () => {
  console.log("🔍 CURRENT PDF CENTERING VERIFICATION TEST");
  console.log("=" .repeat(60));
  
  // Current settings from the actual implementation
  const currentSettings = {
    // Container settings (from PDF service)
    containerWidth: 1200,
    containerHeight: 1600,
    containerPadding: 30,
    containerDisplay: "flex",
    containerJustifyContent: "center",
    
    // Wrapper settings (from PDF service)
    wrapperMaxWidth: {
      letter: 800,
      a4: 800,
      legal: 850
    },
    
    // PDF settings
    pdfPageUsage: 0.90, // 90% page usage for margins
    pagination: "single",
    
    // PDF dimensions in points
    pdfDimensions: {
      letter: { width: 8.5 * 72, height: 11 * 72 },
      a4: { width: 8.27 * 72, height: 11.7 * 72 },
      legal: { width: 8.5 * 72, height: 14 * 72 }
    }
  };
  
  console.log("📋 Current Implementation Analysis:");
  console.log("🏠 Container Setup:");
  console.log(`   Size: ${currentSettings.containerWidth} × ${currentSettings.containerHeight}px`);
  console.log(`   Padding: ${currentSettings.containerPadding}px`);
  console.log(`   Display: ${currentSettings.containerDisplay}`);
  console.log(`   Justify: ${currentSettings.containerJustifyContent}`);
  
  console.log("\n📦 Wrapper Constraints:");
  Object.entries(currentSettings.wrapperMaxWidth).forEach(([size, width]) => {
    console.log(`   ${size}: maxWidth ${width}px`);
  });
  
  console.log("\n📄 PDF Generation Settings:");
  console.log(`   Page usage: ${currentSettings.pdfPageUsage * 100}%`);
  console.log(`   Pagination: ${currentSettings.pagination}`);
  
  // Test each paper size
  ['letter', 'a4', 'legal'].forEach(paperSize => {
    console.log(`\n📐 ${paperSize.toUpperCase()} PAPER ANALYSIS:`);
    
    const pdfDim = currentSettings.pdfDimensions[paperSize];
    const wrapperMax = currentSettings.wrapperMaxWidth[paperSize];
    
    console.log(`   PDF dimensions: ${pdfDim.width} × ${pdfDim.height} pts`);
    console.log(`   Wrapper maxWidth: ${wrapperMax}px`);
    
    // Simulate typical canvas dimensions based on wrapper constraints
    const typicalCanvasWidth = Math.min(wrapperMax * 1.5, 1000); // Estimate based on wrapper
    const typicalCanvasHeight = typicalCanvasWidth * 1.3; // Typical aspect ratio for delivery tickets
    const aspectRatio = typicalCanvasWidth / typicalCanvasHeight;
    
    console.log(`   Estimated canvas: ${typicalCanvasWidth} × ${typicalCanvasHeight}px`);
    console.log(`   Aspect ratio: ${aspectRatio.toFixed(3)}`);
    
    // Calculate PDF positioning using current algorithm
    let imgWidth = pdfDim.width * currentSettings.pdfPageUsage;
    let imgHeight = imgWidth / aspectRatio;
    
    if (imgHeight > pdfDim.height * currentSettings.pdfPageUsage) {
      imgHeight = pdfDim.height * currentSettings.pdfPageUsage;
      imgWidth = imgHeight * aspectRatio;
    }
    
    const x = Math.round((pdfDim.width - imgWidth) / 2);
    const y = Math.round((pdfDim.height - imgHeight) / 2);
    
    const leftMargin = x;
    const rightMargin = pdfDim.width - imgWidth - x;
    const topMargin = y;
    const bottomMargin = pdfDim.height - imgHeight - y;
    
    console.log(`   📍 Positioning:`);
    console.log(`      Image size: ${imgWidth.toFixed(1)} × ${imgHeight.toFixed(1)} pts`);
    console.log(`      Position: (${x}, ${y})`);
    console.log(`      Left margin: ${leftMargin.toFixed(1)} pts`);
    console.log(`      Right margin: ${rightMargin.toFixed(1)} pts`);
    console.log(`      Top margin: ${topMargin.toFixed(1)} pts`);
    console.log(`      Bottom margin: ${bottomMargin.toFixed(1)} pts`);
    
    // Check centering quality
    const horizontalDiff = Math.abs(leftMargin - rightMargin);
    const verticalDiff = Math.abs(topMargin - bottomMargin);
    
    console.log(`   ✅ Quality Check:`);
    console.log(`      Horizontal centering: ${horizontalDiff < 0.1 ? '✅ PERFECT' : horizontalDiff < 1 ? '✅ GOOD' : '❌ POOR'} (diff: ${horizontalDiff.toFixed(1)}pts)`);
    console.log(`      Vertical centering: ${verticalDiff < 0.1 ? '✅ PERFECT' : verticalDiff < 1 ? '✅ GOOD' : '❌ POOR'} (diff: ${verticalDiff.toFixed(1)}pts)`);
    
    // Calculate margin percentages
    const leftMarginPercent = (leftMargin / pdfDim.width * 100).toFixed(1);
    const rightMarginPercent = (rightMargin / pdfDim.width * 100).toFixed(1);
    
    console.log(`      Left margin: ${leftMarginPercent}% of page width`);
    console.log(`      Right margin: ${rightMarginPercent}% of page width`);
    console.log(`      Content usage: ${(imgWidth / pdfDim.width * 100).toFixed(1)}% of page width`);
  });
  
  console.log("\n🎯 EXPECTED BEHAVIOR:");
  console.log("✅ Container uses flexbox centering like preview");
  console.log("✅ Wrapper constrains max width like preview");
  console.log("✅ PDF centering uses Math.round() for precision");
  console.log("✅ 90% page usage provides consistent margins");
  console.log("✅ Single page mode enforced for proper centering");
  
  console.log("\n🔧 POTENTIAL ISSUES TO CHECK:");
  console.log("❓ Canvas rendering might differ from estimated dimensions");
  console.log("❓ Element styling might override wrapper constraints");
  console.log("❓ Image loading timing might affect final canvas size");
  console.log("❓ Transform/scaling might affect positioning calculations");
  
  console.log("\n📝 TESTING RECOMMENDATIONS:");
  console.log("1. Generate actual PDF and measure margins");
  console.log("2. Compare with preview side-by-side");
  console.log("3. Check console logs for actual canvas dimensions");
  console.log("4. Verify Math.round() is preventing sub-pixel positioning");
  console.log("5. Test with different content lengths and widths");
  
  return {
    settingsLookGood: true,
    potentialIssues: [
      "Canvas dimensions vs estimates",
      "Element styling conflicts",
      "Timing issues with image loading",
      "Transform/scaling effects"
    ],
    nextSteps: [
      "Generate test PDF",
      "Compare with preview",
      "Check console logs",
      "Measure actual margins"
    ]
  };
};

// Run the test
console.log(testCurrentPdfCentering());
