// Spanish date formatter utility
export function formatDateSpanish(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return "-";
  }

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hour = date.getHours();
  const minute = date.getMinutes().toString().padStart(2, '0');
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;

  return `${month} ${day}, ${year} ${hour12}:${minute}${ampm}`;
}

// Format date only (without time)
export function formatDateOnlySpanish(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return "-";
  }

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${month} ${day}, ${year}`;
}

// English date formatter - formats as "Month Day, Year" (e.g., "August 13, 2025")
export function formatDateEnglish(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  if (isNaN(date.getTime())) {
    return "-";
  }

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${month} ${day}, ${year}`;
}

// Timezone-aware date utilities
export function getCurrentLocalDate(): string {
  // Returns YYYY-MM-DD in local timezone
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateForInput(dateString: string | Date): string {
  // Converts any date to YYYY-MM-DD format for HTML date inputs
  if (!dateString) return "";
  
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return "";
  
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createLocalDate(dateString: string): Date {
  // Creates a Date object treating the input as local timezone
  // Input format: YYYY-MM-DD
  if (!dateString) return new Date();
  
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

export function dateToLocalISOString(date: Date): string {
  // Convert a Date to an ISO-like string that preserves the local calendar date
  // by including the local timezone offset (e.g. "2025-09-01T00:00:00-04:00").
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  // Build timezone offset like +HH:MM or -HH:MM
  const offsetMinutes = -date.getTimezoneOffset(); // offset in minutes relative to UTC (+ for east)
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absOffset / 60)
    .toString()
    .padStart(2, '0');
  const offsetMins = (absOffset % 60).toString().padStart(2, '0');
  const tz = `${sign}${offsetHours}:${offsetMins}`;

  return `${year}-${month}-${day}T00:00:00${tz}`;
}

export function dateStringToLocalISOString(dateString: string): string {
  // Converts YYYY-MM-DD to an ISO-like string that preserves the local date
  if (!dateString) return "";

  const localDate = createLocalDate(dateString);
  return dateToLocalISOString(localDate);
}
