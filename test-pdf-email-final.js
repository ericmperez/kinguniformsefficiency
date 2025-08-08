// Test script to verify PDF email functionality
console.log('=== PDF Email Test Script ===\n');

// Test if required libraries are available
console.log('1. Testing PDF dependencies...');
try {
  const jsPDF = window.jspdf?.jsPDF;
  const html2canvas = window.html2canvas;
  
  if (!jsPDF) {
    console.error('❌ jsPDF not available');
  } else {
    console.log('✅ jsPDF available');
  }
  
  if (!html2canvas) {
    console.error('❌ html2canvas not available');
  } else {
    console.log('✅ html2canvas available');
  }
} catch (error) {
  console.error('❌ Error checking dependencies:', error);
}

console.log('\n2. Testing PDF generation...');

// Import the simple PDF service
async function testPDFGeneration() {
  try {
    // Create a sample invoice data structure
    const sampleInvoice = {
      id: 'test-123',
      invoiceNumber: 'INV-2025-001',
      clientId: 'client-1',
      pickupDate: new Date().toISOString(),
      deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      cart: [
        {
          product: 'Shirts',
          quantity: 5,
          price: 2.50,
          total: 12.50
        },
        {
          product: 'Pants',
          quantity: 3,
          price: 3.00,
          total: 9.00
        }
      ],
      total: 21.50,
      status: 'pending'
    };

    const sampleClient = {
      id: 'client-1',
      name: 'Test Client Co.',
      email: 'test@client.com',
      address: '123 Business St, City, State 12345'
    };

    // Generate PDF using the simple PDF service
    console.log('Generating sample PDF...');
    
    // Create HTML content for PDF
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjUwIiB2aWV3Qm94PSIwIDAgMTAwIDUwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8dGV4dCB4PSI1MCIgeT0iMzAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IiMwMDMzNjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiPktpbmcgVW5pZm9ybXM8L3RleHQ+Cjwvc3ZnPgo=" alt="King Uniforms" style="height: 50px;">
          <h1 style="color: #003366; margin: 10px 0;">LAUNDRY TICKET</h1>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
          <div>
            <h3>Client Information</h3>
            <p><strong>${sampleClient.name}</strong></p>
            <p>${sampleClient.address}</p>
            <p>Email: ${sampleClient.email}</p>
          </div>
          <div style="text-align: right;">
            <h3>Invoice Details</h3>
            <p><strong>Invoice #:</strong> ${sampleInvoice.invoiceNumber}</p>
            <p><strong>Pickup Date:</strong> ${new Date(sampleInvoice.pickupDate).toLocaleDateString()}</p>
            <p><strong>Delivery Date:</strong> ${new Date(sampleInvoice.deliveryDate).toLocaleDateString()}</p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f0f0f0;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Item</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantity</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Price</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${sampleInvoice.cart.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.product}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${item.price.toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #f0f0f0; font-weight: bold;">
              <td colspan="3" style="border: 1px solid #ddd; padding: 8px; text-align: right;">Total:</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${sampleInvoice.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        
        <div style="margin-top: 30px; text-align: center; color: #666;">
          <p>Thank you for your business!</p>
          <p style="font-size: 12px;">King Uniforms - Professional Laundry Services</p>
        </div>
      </div>
    `;

    // Create a temporary div for the content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    document.body.appendChild(tempDiv);

    // Generate PDF using html2canvas and jsPDF
    const canvas = await html2canvas(tempDiv, {
      width: 800,
      height: 1000,
      scale: 2
    });
    
    document.body.removeChild(tempDiv);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const pdfBase64 = pdf.output('dataurlstring').split(',')[1];
    console.log('✅ PDF generated successfully');
    console.log('PDF size:', pdfBase64.length, 'characters');

    return pdfBase64;
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    return null;
  }
}

// Test sending email with PDF
async function testEmailWithPDF() {
  console.log('\n3. Testing email with PDF...');
  
  try {
    const pdfBase64 = await testPDFGeneration();
    
    if (!pdfBase64) {
      console.error('❌ Cannot test email - PDF generation failed');
      return;
    }

    const emailData = {
      to: 'test@example.com',
      subject: 'Test Laundry Ticket PDF',
      text: 'Please find attached your laundry ticket.',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Laundry Ticket Attached</h2>
          <p>Dear Customer,</p>
          <p>Please find your laundry ticket attached as a PDF file.</p>
          <p>Thank you for choosing King Uniforms!</p>
          <br>
          <p>Best regards,<br>King Uniforms Team</p>
        </div>
      `,
      pdfBase64: pdfBase64
    };

    console.log('Sending email with PDF attachment...');
    
    const response = await fetch('/api/send-test-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    if (response.ok) {
      const result = await response.text();
      console.log('✅ Email sent successfully!');
      console.log('Server response:', result);
    } else {
      const error = await response.text();
      console.error('❌ Email sending failed');
      console.error('Server error:', error);
    }
  } catch (error) {
    console.error('❌ Email test failed:', error);
  }
}

// Run all tests
async function runAllTests() {
  try {
    await testEmailWithPDF();
    console.log('\n=== Test Complete ===');
    console.log('If you received an email with a PDF attachment, the system is working correctly!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Start tests
runAllTests();
