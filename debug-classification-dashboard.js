// Debug script for Production Classification Dashboard
// Run this in the browser console on the classification dashboard page

console.log('=== PRODUCTION CLASSIFICATION DEBUG ===');

// Check if the dashboard component is loaded
const dashboardElement = document.querySelector('.container-fluid');
if (!dashboardElement) {
  console.error('❌ Dashboard element not found');
} else {
  console.log('✅ Dashboard element found');
}

// Check for React component state
if (window.React) {
  console.log('✅ React is available');
} else {
  console.log('❌ React not found');
}

// Look for debug data in the DOM
const debugSection = document.querySelector('.card.border-warning');
if (debugSection) {
  console.log('✅ Debug section found');
  const listItems = debugSection.querySelectorAll('.list-group-item');
  listItems.forEach((item, index) => {
    console.log(`Debug Item ${index}:`, item.textContent?.trim());
  });
} else {
  console.log('❌ Debug section not found');
}

// Check for table data
const hourlyTable = document.querySelector('.table-striped.table-hover');
if (hourlyTable) {
  console.log('✅ Hourly table found');
  const rows = hourlyTable.querySelectorAll('tbody tr');
  console.log(`Table has ${rows.length} rows`);
  
  rows.forEach((row, index) => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 5) {
      console.log(`Row ${index}:`, {
        hour: cells[0]?.textContent?.trim(),
        items: cells[1]?.textContent?.trim(),
        units: cells[2]?.textContent?.trim(),
        clients: cells[3]?.textContent?.trim(),
        products: cells[4]?.textContent?.trim()
      });
    }
  });
} else {
  console.log('❌ Hourly table not found');
}

// Check for any errors in console
console.log('=== END DEBUG ===');
