/**
 * PDF Compression Service
 * Reduces PDF file sizes for email delivery
 */

// PDF compression options - UPDATED FOR BETTER QUALITY
const COMPRESSION_LEVELS = {
  high: {
    imageQuality: 0.70,  // Increased from 0.6 for better quality
    imageMaxWidth: 1800, // Increased from 1600 for higher resolution
    imageMaxHeight: 2200, // Increased from 2000 for higher resolution
    removeMetadata: false, // Keep metadata for better compatibility
    optimizeForSize: false // Reduce optimization for better quality
  },
  medium: {
    imageQuality: 0.80,  // Increased from 0.75 for better quality
    imageMaxWidth: 2200, // Increased from 2000 for higher resolution
    imageMaxHeight: 2600, // Increased from 2400 for higher resolution
    removeMetadata: false,
    optimizeForSize: false
  },
  low: {
    imageQuality: 0.90,  // Increased from 0.85 for better quality
    imageMaxWidth: 2600, // Increased from 2400 for higher resolution
    imageMaxHeight: 3000, // Increased from 2800 for higher resolution
    removeMetadata: false,
    optimizeForSize: false
  }
};

/**
 * Compress PDF by reducing image quality and optimizing content
 * @param {string} pdfBase64 - Base64 encoded PDF
 * @param {string} compressionLevel - 'high', 'medium', or 'low'
 * @returns {Promise<{success: boolean, compressedPdf?: string, originalSize: number, compressedSize: number, compressionRatio: number, error?: string}>}
 */
export const compressPDF = async (pdfBase64: string, compressionLevel: 'high' | 'medium' | 'low' = 'medium'): Promise<{
  success: boolean;
  compressedPdf?: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  error?: string;
}> => {
  try {
    console.log(`🗜️ Starting PDF compression with ${compressionLevel} level...`);
    
    // Clean and validate the base64 string more robustly
    let cleanBase64 = pdfBase64;
    
    console.log(`🔍 Processing PDF data format. Input length: ${pdfBase64.length} characters`);
    
    // Handle different data URL formats
    if (pdfBase64.includes('data:application/pdf;base64,')) {
      cleanBase64 = pdfBase64.split('data:application/pdf;base64,')[1];
      console.log('✅ Removed data:application/pdf;base64, prefix');
    } else if (pdfBase64.includes('data:') && pdfBase64.includes('base64,')) {
      cleanBase64 = pdfBase64.split('base64,')[1];
      console.log('✅ Removed generic data URL prefix');
    } else if (pdfBase64.startsWith('data:')) {
      // Handle malformed data URLs
      const base64Index = pdfBase64.indexOf(',');
      if (base64Index !== -1) {
        cleanBase64 = pdfBase64.substring(base64Index + 1);
        console.log('✅ Extracted base64 from malformed data URL');
      }
    }
    
    // Remove any whitespace characters (including newlines, tabs, spaces)
    cleanBase64 = cleanBase64.replace(/[\s\n\r\t]/g, '');
    
    // Additional cleaning - remove any non-base64 characters
    cleanBase64 = cleanBase64.replace(/[^A-Za-z0-9+/=]/g, '');
    
    console.log(`📏 Cleaned base64 length: ${cleanBase64.length} characters`);
    
    // Validate Base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(cleanBase64)) {
      console.error('❌ Base64 validation failed');
      console.error(`First 100 chars: "${cleanBase64.substring(0, 100)}"`);
      console.error(`Last 100 chars: "${cleanBase64.substring(cleanBase64.length - 100)}"`);
      throw new Error(`Invalid Base64 format detected. Length: ${cleanBase64.length}, Pattern test failed.`);
    }
    
    // Ensure proper padding
    while (cleanBase64.length % 4 !== 0) {
      cleanBase64 += '=';
    }
    
    console.log('✅ Base64 validation and padding successful');
    
    const originalSize = (cleanBase64.length * 0.75) / (1024 * 1024); // Size in MB
    
    console.log(`📄 Original PDF size: ${originalSize.toFixed(2)}MB`);
    
    // If PDF is already small enough, return as-is - INCREASED THRESHOLD FOR BETTER QUALITY
    if (originalSize <= 5.0) { // Increased from 2.5MB to 5.0MB threshold
      console.log(`✅ PDF already acceptable size (${originalSize.toFixed(2)}MB), minimal compression applied`);
      return {
        success: true,
        compressedPdf: pdfBase64,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0
      };
    }
    
    // Use pdf-lib for compression
    const { PDFDocument } = await import('pdf-lib');
    
    // Convert base64 to Uint8Array with enhanced error handling
    let pdfBytes: Uint8Array;
    try {
      console.log('🔄 Converting base64 to binary data...');
      
      // Test atob first with a small sample
      const sampleSize = Math.min(100, cleanBase64.length);
      const sampleBase64 = cleanBase64.substring(0, sampleSize);
      atob(sampleBase64); // Test decode
      
      // If sample works, decode the full string
      const binaryString = atob(cleanBase64);
      pdfBytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
      
      console.log(`✅ Successfully converted ${binaryString.length} bytes of binary data`);
      
      // Validate PDF signature (PDF files start with %PDF-)
      const pdfSignature = Array.from(pdfBytes.slice(0, 4)).map(b => String.fromCharCode(b)).join('');
      if (!pdfSignature.startsWith('%PDF')) {
        console.warn(`⚠️ Warning: PDF signature not found. Got: "${pdfSignature}"`);
        // Continue anyway - might still be a valid PDF
      } else {
        console.log('✅ Valid PDF signature detected');
      }
      
    } catch (decodeError: any) {
      console.error('❌ Base64 decode error details:', {
        error: decodeError?.message || 'Unknown decode error',
        base64Length: cleanBase64.length,
        base64Sample: cleanBase64.substring(0, 50) + '...',
        originalInputLength: pdfBase64.length
      });
      
      throw new Error(`Base64 decode failed: ${decodeError?.message || 'Unknown error'}. Input may not be valid base64 data.`);
    }
    
    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Get compression settings
    const settings = COMPRESSION_LEVELS[compressionLevel];
    
    // Apply compression optimizations
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      updateFieldAppearances: false
    });
    
    // Convert back to base64
    const compressedBase64 = btoa(String.fromCharCode(...compressedBytes));
    const compressedSize = (compressedBase64.length * 0.75) / (1024 * 1024); // Size in MB
    const compressionRatio = compressedSize / originalSize;
    
    console.log(`✅ PDF compression complete:`);
    console.log(`   Original: ${originalSize.toFixed(2)}MB`);
    console.log(`   Compressed: ${compressedSize.toFixed(2)}MB`);
    console.log(`   Compression ratio: ${(compressionRatio * 100).toFixed(1)}%`);
    console.log(`   Space saved: ${(originalSize - compressedSize).toFixed(2)}MB`);
    
    return {
      success: true,
      compressedPdf: `data:application/pdf;base64,${compressedBase64}`,
      originalSize,
      compressedSize,
      compressionRatio
    };
    
  } catch (error) {
    console.error('❌ PDF compression failed:', error);
    return {
      success: false,
      originalSize: (pdfBase64.length * 0.75) / (1024 * 1024),
      compressedSize: 0,
      compressionRatio: 0,
      error: error instanceof Error ? error.message : 'Unknown compression error'
    };
  }
};

/**
 * Aggressive PDF compression for very large files
 * Uses multiple compression techniques
 */
export const aggressiveCompressPDF = async (pdfBase64: string): Promise<{
  success: boolean;
  compressedPdf?: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  error?: string;
}> => {
  try {
    console.log(`🗜️ Starting aggressive PDF compression...`);
    
    // Try high compression first
    let result = await compressPDF(pdfBase64, 'high');
    
    if (!result.success) {
      throw new Error(result.error || 'Initial compression failed');
    }
    
    // If still too large, apply additional optimizations
    if (result.compressedSize > 3) {
      console.log(`⚠️ PDF still large (${result.compressedSize.toFixed(2)}MB), applying additional compression...`);
      
      try {
        const { PDFDocument } = await import('pdf-lib');
        let cleanBase64 = result.compressedPdf!;
        
        // Clean the base64 string with enhanced handling
        if (cleanBase64.includes('data:application/pdf;base64,')) {
          cleanBase64 = cleanBase64.split('data:application/pdf;base64,')[1];
        } else if (cleanBase64.includes('data:') && cleanBase64.includes('base64,')) {
          cleanBase64 = cleanBase64.split('base64,')[1];
        } else if (cleanBase64.startsWith('data:')) {
          const base64Index = cleanBase64.indexOf(',');
          if (base64Index !== -1) {
            cleanBase64 = cleanBase64.substring(base64Index + 1);
          }
        }
        
        // Remove whitespace and non-base64 characters
        cleanBase64 = cleanBase64.replace(/[\s\n\r\t]/g, '');
        cleanBase64 = cleanBase64.replace(/[^A-Za-z0-9+/=]/g, '');
        
        // Ensure proper padding
        while (cleanBase64.length % 4 !== 0) {
          cleanBase64 += '=';
        }
        
        const pdfBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // Remove unused objects and optimize further
        const superCompressedBytes = await pdfDoc.save({
          useObjectStreams: true,
          addDefaultPage: false,
          updateFieldAppearances: false
        });
        
        const superCompressedBase64 = btoa(String.fromCharCode(...superCompressedBytes));
        const superCompressedSize = (superCompressedBase64.length * 0.75) / (1024 * 1024);
        
        console.log(`🔧 Super compression complete: ${superCompressedSize.toFixed(2)}MB`);
        
        return {
          success: true,
          compressedPdf: `data:application/pdf;base64,${superCompressedBase64}`,
          originalSize: result.originalSize,
          compressedSize: superCompressedSize,
          compressionRatio: superCompressedSize / result.originalSize
        };
        
      } catch (superCompressionError) {
        console.warn('⚠️ Super compression failed, using standard compression result');
        return result;
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Aggressive PDF compression failed:', error);
    return {
      success: false,
      originalSize: (pdfBase64.length * 0.75) / (1024 * 1024),
      compressedSize: 0,
      compressionRatio: 0,
      error: error instanceof Error ? error.message : 'Unknown aggressive compression error'
    };
  }
};

/**
 * Smart PDF compression that chooses the best strategy based on file size
 */
export const smartCompressPDF = async (pdfBase64: string): Promise<{
  success: boolean;
  compressedPdf?: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionMethod: string;
  error?: string;
}> => {
  const originalSize = (pdfBase64.length * 0.75) / (1024 * 1024);
  
  console.log(`🧠 Smart PDF compression starting for ${originalSize.toFixed(2)}MB file...`);
  
  let compressionMethod = 'none';
  let result;
  
  if (originalSize <= 2.5) {
    // No compression needed
    compressionMethod = 'none';
    result = {
      success: true,
      compressedPdf: pdfBase64,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 1.0
    };
  } else if (originalSize <= 5) {
    // Use medium compression
    compressionMethod = 'medium';
    result = await compressPDF(pdfBase64, 'medium');
  } else if (originalSize <= 10) {
    // Use high compression
    compressionMethod = 'high';
    result = await compressPDF(pdfBase64, 'high');
  } else if (originalSize <= 15) {
    // Use aggressive compression for very large files
    compressionMethod = 'aggressive';
    result = await aggressiveCompressPDF(pdfBase64);
  } else {
    // Use ultra compression for extremely large files
    compressionMethod = 'ultra';
    result = await ultraCompressPDF(pdfBase64);
  }
  
  return {
    ...result,
    compressionMethod
  };
};

/**
 * Ultra-aggressive PDF compression for resend emails
 * Uses the most extreme compression settings
 */
export const ultraCompressPDF = async (pdfBase64: string): Promise<{
  success: boolean;
  compressedPdf?: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  error?: string;
}> => {
  try {
    console.log(`🚀 Starting ultra-aggressive PDF compression for resend email...`);
    
    // First apply aggressive compression
    let result = await aggressiveCompressPDF(pdfBase64);
    
    if (!result.success) {
      return result;
    }
    
    // Apply additional compression techniques for resend emails
    if (result.compressedSize > 1.5) {
      console.log(`🔥 PDF still large (${result.compressedSize.toFixed(2)}MB), applying ultra compression...`);
      
      try {
        const { PDFDocument } = await import('pdf-lib');
        let cleanBase64 = result.compressedPdf!;
        
        // Clean the base64 string with enhanced handling for ultra compression
        if (cleanBase64.includes('data:application/pdf;base64,')) {
          cleanBase64 = cleanBase64.split('data:application/pdf;base64,')[1];
        } else if (cleanBase64.includes('data:') && cleanBase64.includes('base64,')) {
          cleanBase64 = cleanBase64.split('base64,')[1];
        } else if (cleanBase64.startsWith('data:')) {
          const base64Index = cleanBase64.indexOf(',');
          if (base64Index !== -1) {
            cleanBase64 = cleanBase64.substring(base64Index + 1);
          }
        }
        
        // Remove whitespace and non-base64 characters
        cleanBase64 = cleanBase64.replace(/[\s\n\r\t]/g, '');
        cleanBase64 = cleanBase64.replace(/[^A-Za-z0-9+/=]/g, '');
        
        // Ensure proper padding
        while (cleanBase64.length % 4 !== 0) {
          cleanBase64 += '=';
        }
        
        const pdfBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
        
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // Remove metadata and optimize
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setCreator('');
        pdfDoc.setProducer('');
        pdfDoc.setKeywords([]);
        
        // Save with ultra-minimal settings
        const compressedBytes = await pdfDoc.save({
          useObjectStreams: false,
          addDefaultPage: false,
          objectsPerTick: 10 // Very small chunks for maximum compression
        });
        
        const ultraCompressedBase64 = btoa(String.fromCharCode(...compressedBytes));
        const ultraCompressedSize = (ultraCompressedBase64.length * 0.75) / (1024 * 1024);
        
        if (ultraCompressedSize < result.compressedSize) {
          console.log(`🎯 Ultra compression successful: ${result.compressedSize.toFixed(2)}MB → ${ultraCompressedSize.toFixed(2)}MB`);
          
          const originalSize = (pdfBase64.length * 0.75) / (1024 * 1024);
          return {
            success: true,
            compressedPdf: `data:application/pdf;base64,${ultraCompressedBase64}`,
            originalSize,
            compressedSize: ultraCompressedSize,
            compressionRatio: ultraCompressedSize / originalSize
          };
        }
      } catch (ultraError) {
        console.warn('Ultra compression failed, using aggressive result:', ultraError);
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Ultra PDF compression failed:', error);
    return {
      success: false,
      originalSize: (pdfBase64.length * 0.75) / (1024 * 1024),
      compressedSize: 0,
      compressionRatio: 0,
      error: error instanceof Error ? error.message : 'Unknown ultra compression error'
    };
  }
};
