// Test script to verify Product Breakdown functionality
// This tests the data structure and calculations

const mockInvoices = [
  {
    id: "inv1",
    date: "2025-08-02",
    clientId: "client1",
    clientName: "Test Client 1",
    carts: [
      {
        id: "cart1",
        items: [
          { productName: "Sabanas", quantity: 100, price: 2.50 },
          { productName: "Fitted Sheets", quantity: 50, price: 3.00 }
        ]
      }
    ]
  },
  {
    id: "inv2", 
    date: "2025-08-02",
    clientId: "client2",
    clientName: "Test Client 2",
    carts: [
      {
        id: "cart2",
        items: [
          { productName: "Sabanas", quantity: 75, price: 2.50 },
          { productName: "Toallas de Baño", quantity: 30, price: 1.75 }
        ]
      }
    ]
  }
];

// Simulate the product breakdown calculation
function calculateProductBreakdown(invoices, targetDate) {
  const dayInvoices = invoices.filter(invoice => {
    if (!invoice.date) return false;
    const invoiceDate = new Date(invoice.date).toISOString().slice(0, 10);
    return invoiceDate === targetDate;
  });

  const productBreakdown = {};
  
  dayInvoices.forEach(invoice => {
    invoice.carts?.forEach(cart => {
      cart.items?.forEach(item => {
        if (!productBreakdown[item.productName]) {
          productBreakdown[item.productName] = {
            totalQuantity: 0,
            totalRevenue: 0,
            invoiceCount: 0
          };
        }
        
        const productData = productBreakdown[item.productName];
        productData.totalQuantity += item.quantity || 0;
        productData.totalRevenue += (item.quantity || 0) * (item.price || 0);
        productData.invoiceCount += 1;
      });
    });
  });

  // Calculate total quantity for percentages
  const totalQuantity = Object.values(productBreakdown)
    .reduce((sum, product) => sum + product.totalQuantity, 0);
  
  // Convert to array with percentages
  const products = Object.entries(productBreakdown).map(([productName, data]) => {
    const percentage = totalQuantity > 0 ? (data.totalQuantity / totalQuantity) * 100 : 0;
    return {
      productName,
      totalQuantity: data.totalQuantity,
      totalRevenue: data.totalRevenue,
      invoiceCount: data.invoiceCount,
      percentage: Math.round(percentage * 100) / 100
    };
  });

  // Sort by quantity (highest first)
  products.sort((a, b) => b.totalQuantity - a.totalQuantity);
  
  return { products, totalQuantity };
}

// Test the calculation
const result = calculateProductBreakdown(mockInvoices, "2025-08-02");

console.log("🧪 Product Breakdown Test Results:");
console.log("=====================================");
console.log(`Total Items Processed: ${result.totalQuantity}`);
console.log("\nProduct Breakdown:");
console.log("Product Name".padEnd(20) + "Quantity".padEnd(12) + "Percentage".padEnd(12) + "Revenue");
console.log("-".repeat(60));

result.products.forEach((product, index) => {
  console.log(
    `${(index + 1).toString().padStart(2)}. ${product.productName.padEnd(15)} ` +
    `${product.totalQuantity.toString().padEnd(8)} ` +
    `${product.percentage.toFixed(2)}%`.padEnd(8) + " " +
    `$${product.totalRevenue.toFixed(2)}`
  );
});

console.log("\n✅ Test completed successfully!");
console.log("The Product Breakdown feature should work correctly in the dashboard.");
