// Test script to demonstrate the date fix for timezone issues
// This shows the difference between the old and new approaches

console.log("🧪 Date Normalization Test");
console.log("==========================");

// Sample invoice dates (how they're stored in Firebase)
const sampleInvoiceDates = [
  "2025-08-01T08:30:00.000Z",  // UTC time
  "2025-08-01",                // Date only
  "2025-08-02T15:45:30Z",      // UTC with seconds
  "2025-08-02T23:30:00-05:00", // With timezone offset
];

// Old problematic approach (what was causing the issue)
function oldDateComparison(invoiceDate, targetDate) {
  const invoiceDateNormalized = new Date(invoiceDate).toISOString().slice(0, 10);
  return invoiceDateNormalized === targetDate;
}

// New fixed approach (timezone-safe)
function normalizeDate(dateInput) {
  if (!dateInput) return '';
  
  let date;
  if (typeof dateInput === 'string') {
    if (dateInput.includes('T')) {
      // ISO string with time - parse and extract local date
      date = new Date(dateInput);
    } else if (dateInput.includes('-')) {
      // YYYY-MM-DD format - parse as local date to avoid timezone issues
      const [year, month, day] = dateInput.split('-').map(Number);
      date = new Date(year, month - 1, day); // month is 0-indexed
    } else {
      date = new Date(dateInput);
    }
  } else {
    date = dateInput;
  }
  
  // Return local date string in YYYY-MM-DD format
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

function newDateComparison(invoiceDate, targetDate) {
  const normalizedInvoiceDate = normalizeDate(invoiceDate);
  const normalizedTargetDate = normalizeDate(targetDate);
  return normalizedInvoiceDate === normalizedTargetDate;
}

// Test cases
const targetDate = "2025-08-01";

console.log(`\nTesting against target date: ${targetDate}`);
console.log("=" .repeat(50));

sampleInvoiceDates.forEach((invoiceDate, index) => {
  console.log(`\nTest ${index + 1}: ${invoiceDate}`);
  
  const oldResult = oldDateComparison(invoiceDate, targetDate);
  const newResult = newDateComparison(invoiceDate, targetDate);
  
  // Show what each approach produces
  const oldNormalized = new Date(invoiceDate).toISOString().slice(0, 10);
  const newNormalized = normalizeDate(invoiceDate);
  
  console.log(`  Old approach: ${oldNormalized} === ${targetDate} = ${oldResult}`);
  console.log(`  New approach: ${newNormalized} === ${targetDate} = ${newResult}`);
  
  if (oldResult !== newResult) {
    console.log(`  ⚠️  TIMEZONE ISSUE DETECTED! Old: ${oldResult}, New: ${newResult}`);
  } else {
    console.log(`  ✅ Both approaches agree`);
  }
});

console.log("\n" + "=".repeat(50));
console.log("🎯 SUMMARY:");
console.log("The new approach prevents timezone-related date shifting issues");
console.log("by parsing dates in local timezone instead of converting to UTC.");
console.log("This ensures that filtering by August 1st shows data from August 1st,");
console.log("not July 31st due to timezone conversion.");
console.log("=".repeat(50));
