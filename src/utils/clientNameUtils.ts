/**
 * Utility functions for client name transformations
 */

/**
 * Transforms client names for display purposes
 * - "Doctor Center" clients → "D.C."
 * - "Children's Hospital" clients → Keep full name (no transformation)
 * @param clientName - The original client name
 * @returns The transformed client name for display
 */
export function transformClientNameForDisplay(clientName: string | undefined | null): string {
  if (!clientName) return '';
  
  // Transform "Doctor Center" variations to "D.C."
  if (clientName.toLowerCase().includes('doctor') && clientName.toLowerCase().includes('center')) {
    // Replace "Doctor Center" with "D.C." while preserving any additional text
    return clientName
      .replace(/doctor\s+center/gi, 'D.C.')
      .trim();
  }
  
  // Children's Hospital: Keep full name, no transformation
  // (This is handled by returning the original clientName at the end)
  
  return clientName;
}

/**
 * Checks if a client is an Oncologico client
 * @param clientName - The client name to check
 * @returns True if the client is an Oncologico client
 */
export function isOncologicoClient(clientName: string | undefined | null): boolean {
  if (!clientName) return false;
  return clientName.toLowerCase().includes('oncologico');
}

/**
 * Checks if a client is a Children's Hospital client
 * @param clientName - The client name to check
 * @returns True if the client is a Children's Hospital client
 */
export function isChildrensHospitalClient(clientName: string | undefined | null): boolean {
  if (!clientName) return false;
  return clientName.toLowerCase().includes('children') && clientName.toLowerCase().includes('hospital');
}

/**
 * Checks if a client should NOT show quantities (excluded clients)
 * @param clientName - The client name to check
 * @returns True if the client is in the excluded list
 */
export function isExcludedFromQuantities(clientName: string | undefined | null): boolean {
  if (!clientName) return false;
  
  const lowerName = clientName.toLowerCase();
  
  // List of clients that should NOT show quantities
  const excludedClients = [
    'costa bahía', 'costa bahia',
    'dorado aquarius', 'dorado acquarius',
    'plantation rooms',
    'hyatt',
    'sheraton convenciones',
    'aloft'
  ];
  
  return excludedClients.some(excluded => lowerName.includes(excluded));
}

/**
 * Determines if quantities should always be shown for a specific client
 * All clients show quantities EXCEPT: Costa Bahía, Dorado Aquarius, Plantation Rooms, Hyatt, Sheraton Convenciones, Aloft
 * @param clientName - The client name to check
 * @returns True if quantities should always be shown for this client
 */
export function shouldAlwaysShowQuantities(clientName: string | undefined | null): boolean {
  // Show quantities for all clients except the excluded ones
  return !isExcludedFromQuantities(clientName);
}

/**
 * Gets the original client name (for database operations)
 * @param clientName - The client name (could be transformed or original)
 * @returns The original client name
 */
export function getOriginalClientName(clientName: string | undefined | null): string {
  if (!clientName) return '';
  
  // If it's already a D.C. name, keep it as is
  // The transformation is only for display purposes
  return clientName;
}
