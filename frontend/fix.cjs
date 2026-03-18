const fs = require('fs');
const file = 'c:/Users/MSI/Desktop/letspeak/frontend/src/pages/Accounting/Payments.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\.toFixed\(2\)/g, '.toString()');
content = content.replace(/'0\.00'/g, "'0'");
content = content.replace(/"0\.00"/g, "'0'");

// Create a helper function definition
const helper = `
// Helper to normalize amounts (so 150 becomes 150000)
const normalizeAmount = (val) => {
  const n = parseFloat(val);
  if (isNaN(n)) return 0;
  return (n > 0 && n < 1000) ? Math.floor(n * 1000) : Math.floor(n);
};
`;

// Inject helper after imports
content = content.replace(/(import.*?;[\s\n]+)(const Payments =)/s, '$1' + helper + '\n$2');

// Replace parseFloats
content = content.replace(/parseFloat\(p\.amount\)/g, 'normalizeAmount(p.amount)');
content = content.replace(/parseFloat\(payment\.amount\)/g, 'normalizeAmount(payment.amount)');
content = content.replace(/parseFloat\(formData\.amount\)/g, 'normalizeAmount(formData.amount)');
content = content.replace(/parseFloat\(editFormData\.amount\)/g, 'normalizeAmount(editFormData.amount)');
content = content.replace(/parseFloat\(remainingPayment\.amount\)/g, 'normalizeAmount(remainingPayment.amount)');
content = content.replace(/parseFloat\(value\)/g, 'normalizeAmount(value)');

fs.writeFileSync(file, content);
console.log('Fixed Payments.jsx amounts and formatting');
