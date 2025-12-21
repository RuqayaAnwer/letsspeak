/**
 * Date formatting utilities
 * Formats dates with English numbers and Arabic day/month names
 */

// Arabic day names
const arabicDays = {
  Sunday: 'الأحد',
  Monday: 'الإثنين',
  Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday: 'الخميس',
  Friday: 'الجمعة',
  Saturday: 'السبت',
};

// Arabic short day names
const arabicShortDays = {
  Sun: 'أحد',
  Mon: 'إثنين',
  Tue: 'ثلاثاء',
  Wed: 'أربعاء',
  Thu: 'خميس',
  Fri: 'جمعة',
  Sat: 'سبت',
};

// Arabic month names
const arabicMonths = {
  January: 'يناير',
  February: 'فبراير',
  March: 'مارس',
  April: 'أبريل',
  May: 'مايو',
  June: 'يونيو',
  July: 'يوليو',
  August: 'أغسطس',
  September: 'سبتمبر',
  October: 'أكتوبر',
  November: 'نوفمبر',
  December: 'ديسمبر',
};

// Arabic short month names
const arabicShortMonths = {
  Jan: 'يناير',
  Feb: 'فبراير',
  Mar: 'مارس',
  Apr: 'أبريل',
  May: 'مايو',
  Jun: 'يونيو',
  Jul: 'يوليو',
  Aug: 'أغسطس',
  Sep: 'سبتمبر',
  Oct: 'أكتوبر',
  Nov: 'نوفمبر',
  Dec: 'ديسمبر',
};

/**
 * Convert English digits to English digits (no change, but ensures consistency)
 * This function is kept for consistency, but actually just returns the string
 */
const toEnglishDigits = (str) => {
  if (!str) return str;
  return String(str);
};

/**
 * Format date with English numbers and Arabic day/month names
 * @param {Date|string} date - Date object or date string
 * @param {Object} options - Formatting options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = {}) => {
  if (!date) return '-';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return '-';

  const {
    weekday = 'short',
    month = 'short',
    day = 'numeric',
    year = undefined, // Default to no year
    hour,
    minute,
  } = options;

  // Format using English locale to get English numbers
  const enDate = dateObj.toLocaleDateString('en-US', {
    weekday: weekday === 'long' ? 'long' : 'short',
    month: month === 'long' ? 'long' : 'short',
    day: 'numeric',
    year: year === 'numeric' ? 'numeric' : undefined,
    hour: hour ? 'numeric' : undefined,
    minute: minute ? '2-digit' : undefined,
    hour12: hour ? true : undefined,
  });

  // Replace English day/month names with Arabic
  let formatted = enDate;
  
  // Replace day names
  Object.entries(arabicDays).forEach(([en, ar]) => {
    formatted = formatted.replace(new RegExp(en, 'g'), ar);
  });
  Object.entries(arabicShortDays).forEach(([en, ar]) => {
    formatted = formatted.replace(new RegExp(en, 'g'), ar);
  });
  
  // Replace month names
  Object.entries(arabicMonths).forEach(([en, ar]) => {
    formatted = formatted.replace(new RegExp(en, 'g'), ar);
  });
  Object.entries(arabicShortMonths).forEach(([en, ar]) => {
    formatted = formatted.replace(new RegExp(en, 'g'), ar);
  });

  return formatted;
};

/**
 * Format date for display in tables (short format)
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date string (e.g., "أحد، 15 ديسمبر")
 */
export const formatDateShort = (date) => {
  return formatDate(date, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: undefined, // No year
  });
};

/**
 * Format date with time
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date and time string
 */
export const formatDateTime = (date) => {
  return formatDate(date, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: undefined, // No year
    hour: true,
    minute: true,
  });
};

/**
 * Format date for activity logs (full format with time)
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date and time string
 */
export const formatDateForLogs = (date) => {
  if (!date) return '-';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return '-';

  // Get English formatted date (without year)
  const day = dateObj.toLocaleDateString('en-US', { day: 'numeric' });
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
  const time = dateObj.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });

  // Replace with Arabic names
  const arabicWeekday = arabicShortDays[weekday] || weekday;
  const arabicMonth = arabicShortMonths[month] || month;

  return `${arabicWeekday}، ${day} ${arabicMonth} - ${time}`;
};

/**
 * Format date for simple display (just date, no day, no year)
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date string (e.g., "15 ديسمبر")
 */
export const formatDateSimple = (date) => {
  if (!date) return '-';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return '-';

  const day = dateObj.toLocaleDateString('en-US', { day: 'numeric' });
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });

  const arabicMonth = arabicShortMonths[month] || month;

  return `${day} ${arabicMonth}`;
};

