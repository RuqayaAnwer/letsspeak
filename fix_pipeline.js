const fs = require('fs');
const path = 'frontend/src/pages/CustomerService/Pipeline.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix Search Logic
content = content.replace(
  "fetchLeads(1, activeTab);\n  }, [activeTab]);",
  "fetchLeads(1, activeTab, search);\n  }, [activeTab]);\n\n  useEffect(() => {\n    const delayDebounceFn = setTimeout(() => {\n      fetchLeads(1, activeTab, search);\n    }, 500);\n    return () => clearTimeout(delayDebounceFn);\n  }, [search]);"
);

content = content.replace(
  "const fetchLeads = async (page = 1, status = 'all') => {",
  "const fetchLeads = async (page = 1, status = 'all', searchQuery = search) => {"
);

content = content.replace(
  "const res = await api.get(/leads?page=\&status=\);",
  "const res = await api.get('/leads', {\n        params: {\n          page: page,\n          status: status === 'all' ? 'all' : status,\n          search: searchQuery || ''\n        }\n      });"
);

content = content.replace(
  "leads.filter(l => l.name.includes(search) || l.phone_whatsapp.includes(search)).length === 0",
  "leads.length === 0"
);

content = content.replace(
  "leads.filter(l => l.name.includes(search) || l.phone_whatsapp.includes(search)).map((lead, index) => (",
  "leads.map((lead, index) => ("
);

// 2. Fix Dark/Light Mode Colors
content = content.replace(/bg-\[#0f172a\]/g, 'bg-white dark:bg-[#0f172a]');
content = content.replace(/border-\[#1e293b\]/g, 'border-gray-200 dark:border-[#1e293b]');
content = content.replace(/divide-\[#1e293b\]/g, 'divide-gray-200 dark:divide-[#1e293b]');
content = content.replace(/text-slate-200/g, 'text-gray-800 dark:text-slate-200');
content = content.replace(/text-slate-300/g, 'text-gray-700 dark:text-slate-300');
content = content.replace(/text-slate-400/g, 'text-gray-500 dark:text-slate-400');
content = content.replace(/text-slate-500/g, 'text-gray-500 dark:text-slate-500');
content = content.replace(/bg-\[#0b1221\]/g, 'bg-gray-50 dark:bg-[#0b1221]');
content = content.replace(/bg-\[#1e293b\]/g, 'bg-gray-100 dark:bg-[#1e293b]');
content = content.replace(/hover:bg-\[#1e293b\]\/40/g, 'hover:bg-gray-50 dark:hover:bg-[#1e293b]/40');
content = content.replace(/hover:bg-\[#1e293b\]/g, 'hover:bg-gray-100 dark:hover:bg-[#1e293b]');
content = content.replace(/bg-\[#1e293b\]\/50/g, 'bg-gray-50 dark:bg-[#1e293b]/50');
content = content.replace(/ring-white\/5/g, 'ring-gray-200 dark:ring-white/5');
content = content.replace(/text-teal-400/g, 'text-teal-600 dark:text-teal-400');
content = content.replace(/hover:bg-slate-800/g, 'hover:bg-gray-200 dark:hover:bg-slate-800');
content = content.replace(/text-slate-100/g, 'text-gray-900 dark:text-slate-100');

fs.writeFileSync(path, content, 'utf8');
