// Simple test to check PDF generation in browser
console.log('🧪 PDF Generation Debug Test');

// Test if dependencies are available
console.log('📦 Checking dependencies...');
console.log('html2canvas available:', typeof html2canvas !== 'undefined');
console.log('jsPDF available:', typeof jsPDF !== 'undefined' || typeof window.jsPDF !== 'undefined');
console.log('React available:', typeof React !== 'undefined');

// Test PDF generation function
window.testPDFGeneration = async function() {
  console.log('🔧 Starting PDF generation test...');
  
  try {
    // Create a simple div for testing
    const testDiv = document.createElement('div');
    testDiv.innerHTML = `
      <div style="padding: 20px; font-family: Arial;">
        <h1>Test PDF</h1>
        <p>This is a test PDF generation.</p>
        <p>Date: ${new Date().toLocaleDateString()}</p>
      </div>
    `;
    testDiv.style.position = 'absolute';
    testDiv.style.left = '-9999px';
    document.body.appendChild(testDiv);
    
    console.log('📄 Test element created');
    
    // Try to generate PDF
    if (typeof html2canvas !== 'undefined') {
      console.log('🖼️ Generating canvas...');
      const canvas = await html2canvas(testDiv);
      console.log('✅ Canvas generated:', canvas.width, 'x', canvas.height);
      
      if (typeof jsPDF !== 'undefined' || typeof window.jsPDF !== 'undefined') {
        console.log('📋 Generating PDF...');
        const jsPDFConstructor = jsPDF || window.jsPDF;
        const pdf = new jsPDFConstructor();
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 10, 10, 190, 0);
        const pdfOutput = pdf.output('datauristring');
        
        console.log('✅ PDF generated successfully!');
        console.log('📊 PDF size:', pdfOutput.length, 'characters');
        
        // Clean up
        document.body.removeChild(testDiv);
        
        return pdfOutput;
      } else {
        throw new Error('jsPDF not available');
      }
    } else {
      throw new Error('html2canvas not available');
    }
    
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    return null;
  }
};

console.log('📝 PDF debug test loaded. Run testPDFGeneration() to test.');
