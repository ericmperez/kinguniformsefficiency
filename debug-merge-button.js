// Debug script to check merge button visibility conditions
// Open browser console and paste this code to debug

console.log("=== MERGE BUTTON DEBUG ===");

// Check if we're on the right page
if (window.location.pathname.includes('active') || window.location.pathname === '/') {
  console.log("✓ On Active Invoices page");
} else {
  console.log("✗ Not on Active Invoices page:", window.location.pathname);
}

// Try to find invoices data in React components
let invoicesData = null;
let userData = null;

// Look for React Fiber to access component state
function findReactFiber(element) {
  for (let key in element) {
    if (key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')) {
      return element[key];
    }
  }
  return null;
}

function findInvoicesInComponents(fiber) {
  if (!fiber) return null;
  
  // Check current component for invoices
  if (fiber.memoizedProps && fiber.memoizedProps.invoices) {
    return fiber.memoizedProps.invoices;
  }
  
  if (fiber.memoizedState) {
    let state = fiber.memoizedState;
    while (state) {
      if (state.memoizedState && Array.isArray(state.memoizedState)) {
        const potential = state.memoizedState;
        if (potential.length > 0 && potential[0].clientName) {
          return potential;
        }
      }
      state = state.next;
    }
  }
  
  // Check children
  if (fiber.child) {
    const result = findInvoicesInComponents(fiber.child);
    if (result) return result;
  }
  
  // Check siblings
  if (fiber.sibling) {
    const result = findInvoicesInComponents(fiber.sibling);
    if (result) return result;
  }
  
  return null;
}

// Try to find the main app container
const appElement = document.querySelector('#root') || document.querySelector('.container-fluid');
if (appElement) {
  const fiber = findReactFiber(appElement);
  if (fiber) {
    invoicesData = findInvoicesInComponents(fiber);
  }
}

if (invoicesData && invoicesData.length > 0) {
  console.log("✓ Found invoices data:", invoicesData.length, "invoices");
  
  // Group by client name
  const clientGroups = {};
  invoicesData.forEach(invoice => {
    const clientName = invoice.clientName;
    if (!clientGroups[clientName]) {
      clientGroups[clientName] = [];
    }
    clientGroups[clientName].push(invoice);
  });
  
  console.log("Client groups:");
  Object.keys(clientGroups).forEach(clientName => {
    const invoices = clientGroups[clientName];
    console.log(`  ${clientName}: ${invoices.length} invoice(s)`);
    if (invoices.length > 1) {
      console.log(`    ✓ MERGEABLE! Invoice IDs:`, invoices.map(inv => inv.id || inv.invoiceNumber));
    }
  });
  
  // Check for mergeable invoices
  const mergeableClients = Object.keys(clientGroups).filter(clientName => 
    clientGroups[clientName].length > 1
  );
  
  if (mergeableClients.length > 0) {
    console.log("✓ Found mergeable clients:", mergeableClients);
  } else {
    console.log("✗ No mergeable clients found - you need at least 2 invoices with the same client name");
  }
} else {
  console.log("✗ Could not find invoices data");
}

// Check Bootstrap Icons
const hasBootstrapIcons = document.querySelector('link[href*="bootstrap-icons"]') || 
                         document.querySelector('i[class*="bi-"]');
console.log(hasBootstrapIcons ? "✓ Bootstrap Icons loaded" : "✗ Bootstrap Icons not found");

// Check for delete buttons (merge button should be near them)
const deleteButtons = document.querySelectorAll('button i.bi-trash');
console.log("Delete buttons found:", deleteButtons.length);

// Check for merge buttons
const mergeButtons = document.querySelectorAll('button i.bi-arrow-left-right');
console.log("Merge buttons found:", mergeButtons.length);

console.log("=== END DEBUG ===");
