/**
 * Utility functions for client name transformations
 */

/**
 * Transforms client names for display purposes
 * - "Doctor Center" clients → "D.C."
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
 * Determines if quantities should always be shown for a specific client
 * @param clientName - The client name to check
 * @returns True if quantities should always be shown for this client
 */
export function shouldAlwaysShowQuantities(clientName: string | undefined | null): boolean {
  return isOncologicoClient(clientName);
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
