// Test file to validate date filtering logic
console.log('Testing date filtering logic...');

// Mock invoice data with various dates
const mockInvoices = [
  { id: '1', clientName: 'Client A', date: '2025-07-25T10:00:00.000Z' },
  { id: '2', clientName: 'Client B', date: '2025-07-26T15:30:00.000Z' },
  { id: '3', clientName: 'Client C', date: '2025-07-27T08:45:00.000Z' },
  { id: '4', clientName: 'Client D', date: '2025-07-28T12:00:00.000Z' },
  { id: '5', clientName: 'Client E', date: '2025-07-29T16:20:00.000Z' },
  { id: '6', clientName: 'Client F', date: null }, // No date
];

// Test filtering logic (same as implemented in BillingPage)
function testDateFilter(invoices, startDate, endDate) {
  console.log(`\nFiltering with startDate: ${startDate}, endDate: ${endDate}`);
  
  let filteredInvoices = invoices;
  
  if (startDate || endDate) {
    filteredInvoices = invoices.filter((inv) => {
      if (!inv.date) return false; // Exclude invoices without dates
      
      const invoiceDate = new Date(inv.date);
      const startDateTime = startDate ? new Date(startDate).getTime() : 0;
      const endDateTime = endDate ? new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1) : Date.now(); // End of day
      
      const invoiceDateTime = invoiceDate.getTime();
      
      return invoiceDateTime >= startDateTime && invoiceDateTime <= endDateTime;
    });
  }
  
  console.log(`Found ${filteredInvoices.length} invoices:`);
  filteredInvoices.forEach(inv => {
    console.log(`  - ${inv.clientName}: ${inv.date ? new Date(inv.date).toLocaleDateString() : 'No date'}`);
  });
  
  return filteredInvoices;
}

// Test cases
console.log('=== Test Case 1: Single date filter (July 26, 2025) ===');
testDateFilter(mockInvoices, '2025-07-26', '2025-07-26');

console.log('\n=== Test Case 2: Date range filter (July 25-27, 2025) ===');
testDateFilter(mockInvoices, '2025-07-25', '2025-07-27');

console.log('\n=== Test Case 3: Start date only (from July 27, 2025) ===');
testDateFilter(mockInvoices, '2025-07-27', '');

console.log('\n=== Test Case 4: End date only (until July 26, 2025) ===');
testDateFilter(mockInvoices, '', '2025-07-26');

console.log('\n=== Test Case 5: No date filter (all invoices) ===');
testDateFilter(mockInvoices, '', '');

console.log('\n=== Date filtering tests completed ===');
