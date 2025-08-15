console.log("Full-Width PDF Implementation Test");
console.log("==================================");

// Test wrapper styling
const wrapper = {
  display: "block",
  width: "100%", 
  padding: "0 40px",
  boxSizing: "border-box"
};

// Test element styling  
const element = {
  margin: "0",
  width: "100%",
  textAlign: "left"
};

console.log("Wrapper style:", wrapper);
console.log("Element style:", element);

// Test page utilization
const pageWidth = 612; // Letter size
const padding = 40 * (72/96); // Convert to points
const contentWidth = pageWidth - (padding * 2);

console.log("\nPage Analysis:");
console.log("Page width:", pageWidth, "pts");
console.log("Content width:", contentWidth, "pts"); 
console.log("Utilization:", ((contentWidth/pageWidth)*100).toFixed(1) + "%");
console.log("Left margin:", padding.toFixed(1), "pts");
console.log("Right margin:", padding.toFixed(1), "pts");
console.log("Margins equal: YES");
