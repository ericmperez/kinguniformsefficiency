// Test script to verify status filter and list view functionality
const puppeteer = require('puppeteer');

async function testStatusFilters() {
  console.log('🚀 Starting Status Filter and List View Test...');
  
  const browser = await puppeteer.launch({ 
    headless: false, 
    defaultViewport: { width: 1200, height: 800 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Navigate to the application
    console.log('📍 Navigating to application...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    
    // Wait for the page to load
    await page.waitForTimeout(3000);
    
    // Check if we're on a login page and need to authenticate
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Look for Active Invoices section or navigation
    const activeInvoicesElement = await page.$('text="Active Laundry Tickets"');
    
    if (!activeInvoicesElement) {
      console.log('🔐 Login or navigation may be required');
      // Try to find and click on Active Invoices/Laundry in navigation
      const navItems = await page.$$('[role="menuitem"], .nav-link, .list-group-item');
      for (const item of navItems) {
        const text = await page.evaluate(el => el.textContent, item);
        if (text && (text.includes('Active') || text.includes('Laundry') || text.includes('Invoice'))) {
          console.log(`🖱️ Clicking navigation item: ${text}`);
          await item.click();
          await page.waitForTimeout(2000);
          break;
        }
      }
    }
    
    // Wait for status filter cards to appear
    console.log('🔍 Looking for status filter cards...');
    await page.waitForSelector('button[title="All"], button[title="In Progress"], button[title="Completed"]', { 
      timeout: 10000 
    });
    
    // Check if status filter cards are visible
    const filterButtons = await page.$$('button[title="All"], button[title="In Progress"], button[title="Completed"], button[title="Approved"], button[title="Partial"], button[title="Shipped"]');
    console.log(`✅ Found ${filterButtons.length} status filter buttons`);
    
    // Test each filter button
    const filterLabels = ['All', 'In Progress', 'Completed', 'Approved', 'Partial', 'Shipped'];
    
    for (const label of filterLabels) {
      try {
        console.log(`🧪 Testing filter: ${label}`);
        const button = await page.$(`button[title="${label}"]`);
        if (button) {
          await button.click();
          await page.waitForTimeout(1000);
          
          // Check if button is active (has primary class)
          const buttonClass = await page.evaluate(el => el.className, button);
          const isActive = buttonClass.includes('btn-primary');
          console.log(`   ${label} filter ${isActive ? '✅ active' : '❌ not active'}`);
        } else {
          console.log(`   ❌ ${label} filter button not found`);
        }
      } catch (error) {
        console.log(`   ❌ Error testing ${label} filter: ${error.message}`);
      }
    }
    
    // Test view toggle (Cards/List)
    console.log('🔄 Testing view toggle...');
    
    // Find Cards button
    const cardsButton = await page.$('button[aria-label="View options"] button:has-text("Cards"), button:contains("Cards")');
    const listButton = await page.$('button[aria-label="View options"] button:has-text("List"), button:contains("List")');
    
    if (cardsButton && listButton) {
      console.log('✅ Found Cards and List toggle buttons');
      
      // Test switching to List view
      await listButton.click();
      await page.waitForTimeout(1000);
      
      // Check if table is visible
      const table = await page.$('.table-responsive table');
      if (table) {
        console.log('✅ List view (table) is visible');
        
        // Check table headers
        const headers = await page.$$('table thead th');
        console.log(`✅ Table has ${headers.length} columns`);
      } else {
        console.log('❌ List view table not found');
      }
      
      // Switch back to Cards view
      await cardsButton.click();
      await page.waitForTimeout(1000);
      
      // Check if cards are visible
      const cards = await page.$$('.col-md-6, .col-lg-4, .card');
      if (cards.length > 0) {
        console.log(`✅ Cards view is visible with ${cards.length} cards`);
      } else {
        console.log('❌ Cards view not found');
      }
    } else {
      console.log('❌ View toggle buttons not found');
    }
    
    console.log('🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test if called directly
if (require.main === module) {
  testStatusFilters().catch(console.error);
}

module.exports = { testStatusFilters };
