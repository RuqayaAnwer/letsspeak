/**
 * Convert 24-hour time format to 12-hour format with AM/PM
 * @param {string} time - Time in 24-hour format (HH:mm or HH:mm:ss)
 * @returns {string} Time in 12-hour format (hh:mm AM/PM)
 */
export const formatTime12Hour = (time) => {
  if (!time) return '-';
  
  // Handle different time formats
  const timeParts = time.split(':');
  if (timeParts.length < 2) return time;
  
  let hours = parseInt(timeParts[0], 10);
  const minutes = timeParts[1];
  
  if (isNaN(hours)) return time;
  
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours === 0 ? 12 : hours;
  
  return `${hours}:${minutes} ${period}`;
};

/**
 * Convert 12-hour time format to 24-hour format
 * @param {string} time12 - Time in 12-hour format (hh:mm AM/PM)
 * @returns {string} Time in 24-hour format (HH:mm)
 */
export const formatTime24Hour = (time12) => {
  if (!time12) return '';
  
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return time12;
  
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
};












