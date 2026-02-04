/**
 * Format currency amount in Iraqi Dinar format
 * Smart formatting: Only multiplies by 1000 if the number is small (< 1000)
 * This ensures:
 * - Small numbers like 50 -> "50.000 د.ع" (50 * 1000 = 50000)
 * - Large numbers like 50000 -> "50.000 د.ع" (already in correct format, no multiplication)
 * 
 * Examples:
 * - 50 -> "50.000 د.ع" (50 * 1000 = 50000)
 * - 100 -> "100.000 د.ع" (100 * 1000 = 100000)
 * - 50000 -> "50.000 د.ع" (already correct, no multiplication)
 * - 100000 -> "100.000 د.ع" (already correct, no multiplication)
 */
export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '0 د.ع';
  
  const num = parseFloat(amount || 0);
  
  // If number is less than 1000, multiply by 1000 (e.g., 50 -> 50000)
  // If number is >= 1000, use it as is (e.g., 50000 -> 50000)
  let amountInThousands;
  if (num > 0 && num < 1000) {
    amountInThousands = Math.floor(num * 1000);
  } else {
    amountInThousands = Math.floor(num);
  }
  
  // Format with dots as thousands separator
  const formatted = amountInThousands.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `${formatted} د.ع`;
};

/**
 * Format currency amount without the currency symbol
 * Smart formatting: Only multiplies by 1000 if the number is small (< 1000)
 * Example: 50 -> "50.000"
 * Example: 50000 -> "50.000"
 */
export const formatCurrencyAmount = (amount) => {
  if (!amount && amount !== 0) return '0';
  
  const num = parseFloat(amount || 0);
  
  // If number is less than 1000, multiply by 1000
  // If number is >= 1000, use it as is
  let amountInThousands;
  if (num > 0 && num < 1000) {
    amountInThousands = Math.floor(num * 1000);
  } else {
    amountInThousands = Math.floor(num);
  }
  
  // Format with dots as thousands separator
  const formatted = amountInThousands.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return formatted;
};
