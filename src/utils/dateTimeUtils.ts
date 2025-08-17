// Centralized date/time utilities for consistent handling across the prediction system
// File: src/utils/dateTimeUtils.ts

import { Timestamp } from "firebase/firestore";

/**
 * Standardizes any date input to a JavaScript Date object
 * Handles Firebase Timestamps, Date objects, strings, and numbers
 */
export const parseTimestamp = (timestamp: any): Date => {
  if (!timestamp) {
    console.warn('Invalid timestamp provided, using current date');
    return new Date();
  }
  
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }
  
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  if (typeof timestamp === 'string' || typeof timestamp === 'number') {
    const parsed = new Date(timestamp);
    if (isNaN(parsed.getTime())) {
      console.warn('Invalid date format:', timestamp, 'using current date');
      return new Date();
    }
    return parsed;
  }
  
  console.warn('Unknown timestamp format:', timestamp, 'using current date');
  return new Date();
};

/**
 * Converts any date input to a Firebase Timestamp for database storage
 */
export const standardizeDateForFirestore = (date: any): Timestamp => {
  const parsedDate = parseTimestamp(date);
  return Timestamp.fromDate(parsedDate);
};

/**
 * Formats date for comparison (YYYY-MM-DD format)
 * Useful for grouping entries by day
 * Handles timezone issues for date-only strings
 */
export const formatDateForComparison = (date: Date | any): string => {
  // If it's already a YYYY-MM-DD string, return as-is
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  
  // For Date objects, use local timezone conversion to avoid UTC issues
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // For other formats, parse and convert carefully
  const parsedDate = parseTimestamp(date);
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const day = String(parsedDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Creates a date range for a specific day (start of day to end of day)
 * Returns Firebase Timestamps for querying
 */
export const createDateRange = (date: Date): { start: Timestamp; end: Timestamp } => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end)
  };
};

/**
 * Gets a date N days from now
 * Used for prediction calculations
 */
export const getDaysFromNow = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

/**
 * Calculates the number of days between two dates
 */
export const daysBetweenDates = (date1: any, date2: any): number => {
  const d1 = parseTimestamp(date1);
  const d2 = parseTimestamp(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Checks if a date falls within a specified range
 */
export const isDateInRange = (date: any, startDate: any, endDate: any): boolean => {
  const checkDate = parseTimestamp(date);
  const start = parseTimestamp(startDate);
  const end = parseTimestamp(endDate);
  return checkDate >= start && checkDate <= end;
};

/**
 * Gets the start and end of today in local timezone
 */
export const getTodayRange = (): { start: Date; end: Date } => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
};

/**
 * Formats a date for user display (locale-aware)
 * Handles timezone issues for date-only strings (YYYY-MM-DD format)
 */
export const formatDateForDisplay = (date: any, locale: string = 'en-US'): string => {
  // Handle date-only strings (YYYY-MM-DD format) to avoid timezone issues
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day); // month is 0-based in JS
    return localDate.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  
  // For other date formats, use the standard parsing
  const parsedDate = parseTimestamp(date);
  return parsedDate.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Formats time for user display (24-hour format)
 */
export const formatTimeForDisplay = (date: any): string => {
  const parsedDate = parseTimestamp(date);
  const hours = parsedDate.getHours().toString().padStart(2, '0');
  const minutes = parsedDate.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Checks if two dates are the same day
 */
export const isSameDay = (date1: any, date2: any): boolean => {
  const d1 = parseTimestamp(date1);
  const d2 = parseTimestamp(date2);
  return formatDateForComparison(d1) === formatDateForComparison(d2);
};

/**
 * Gets the day of week for a date (0 = Sunday, 6 = Saturday)
 */
export const getDayOfWeek = (date: any): number => {
  const parsedDate = parseTimestamp(date);
  return parsedDate.getDay();
};

/**
 * Creates a standardized date query for Firebase collections
 * Handles timezone issues by using local time boundaries
 */
export const createFirebaseDateQuery = (startDate: Date, endDate?: Date) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  let end: Date;
  if (endDate) {
    end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  } else {
    end = new Date(start);
    end.setDate(start.getDate() + 1);
    end.setMilliseconds(end.getMilliseconds() - 1);
  }
  
  return {
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end)
  };
};

/**
 * Holiday detection helper (can be extended)
 */
export const isHoliday = (date: any): boolean => {
  const parsedDate = parseTimestamp(date);
  const month = parsedDate.getMonth();
  const day = parsedDate.getDate();
  
  // Basic US holidays - can be extended
  const holidays = [
    { month: 0, day: 1 },   // New Year's Day
    { month: 6, day: 4 },   // Independence Day
    { month: 11, day: 25 }, // Christmas Day
    // Add more holidays as needed
  ];
  
  return holidays.some(holiday => holiday.month === month && holiday.day === day);
};

/**
 * Gets the week number of the year for a given date
 */
export const getWeekNumber = (date: any): number => {
  const parsedDate = parseTimestamp(date);
  const startOfYear = new Date(parsedDate.getFullYear(), 0, 1);
  const millisecondsInWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.ceil(((parsedDate.getTime() - startOfYear.getTime()) / millisecondsInWeek));
};

/**
 * Validation function for date inputs
 */
export const isValidDate = (date: any): boolean => {
  if (!date) return false;
  const parsed = parseTimestamp(date);
  return !isNaN(parsed.getTime());
};

export default {
  parseTimestamp,
  standardizeDateForFirestore,
  formatDateForComparison,
  createDateRange,
  getDaysFromNow,
  daysBetweenDates,
  isDateInRange,
  getTodayRange,
  formatDateForDisplay,
  formatTimeForDisplay,
  isSameDay,
  getDayOfWeek,
  createFirebaseDateQuery,
  isHoliday,
  getWeekNumber,
  isValidDate
};
