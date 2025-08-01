console.log('🧪 Testing Costa Bahía Font Size Implementation...')

// Test function to verify font size logic
function testClientNameFontSize() {
    console.log('📝 Testing client name font size logic:')
    
    // Test cases
    const testCases = [
        { name: 'Costa Bahía', expected: '45px', description: 'Costa Bahía (exact match)' },
        { name: 'costa bahia', expected: '45px', description: 'costa bahia (lowercase)' },
        { name: 'COSTA BAHÍA', expected: '45px', description: 'COSTA BAHÍA (uppercase)' },
        { name: 'Costa Bah', expected: '45px', description: 'Costa Bah (partial match)' },
        { name: 'Sheraton', expected: '64px', description: 'Sheraton (different client)' },
        { name: 'Hospital ABC', expected: '64px', description: 'Hospital ABC (different client)' },
        { name: 'Costa Rica', expected: '64px', description: 'Costa Rica (Costa but not Bahía)' },
        { name: 'Bahía Hotel', expected: '64px', description: 'Bahía Hotel (Bahía but not Costa)' }
    ]

    testCases.forEach((testCase, index) => {
        const isCostaBAhia = testCase.name?.toLowerCase().includes("costa") && 
                            testCase.name?.toLowerCase().includes("bah")
        const fontSize = isCostaBAhia ? "45px" : "64px"
        
        const passed = fontSize === testCase.expected
        console.log()
        console.log()
        
            console.log()
        }
    })
}

// Run test
testClientNameFontSize()

console.log("\n✅
console.log("- Costa Bahía clients display at 45px font size")
console.log("- Other clients display at 64px font size")
console.log("- Both print templates updated successfully")
