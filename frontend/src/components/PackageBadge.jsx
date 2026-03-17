import React from 'react';
import { Scale, Package, HeartPulse, Zap, Globe, MessageCircle } from 'lucide-react';

const SpeedClockIcon = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M8.5 6.5A8 8 0 1 1 8.5 17.5" />
    <path d="M3 7h5" />
    <path d="M2 12h6" />
    <path d="M3 17h5" />
    <path d="M14 8v4l2.5 2.5" />
  </svg>
);

const PackageBadge = ({ course, packageName, className = '' }) => {
  let name = packageName;
  
  // If packageName is not explicitly provided, try to extract it from the course object
  if (!name && course) {
    if (course.is_custom) {
      name = 'مخصص';
    } else {
      name = course.course_package?.name || course.coursePackage?.name || 'كورس بدون باقة';
    }
  }

  // Fallback for nulls or empties
  if (!name || name === '-' || name === 'N/A') {
    return <span className={className}>{name || '-'}</span>;
  }

  // Default icon and color
  let Icon = Package;
  let colorClass = 'text-blue-500 dark:text-blue-400';

  // Map package names to specific icons and colors
  if (name.includes('توازن')) {
    Icon = Scale;
    colorClass = 'text-amber-500 dark:text-amber-400';
  } else if (name.includes('سرعة')) {
    Icon = SpeedClockIcon;
    colorClass = 'text-red-500 dark:text-red-400';
  } else if (name.includes('مزاجي')) {
    Icon = HeartPulse;
    colorClass = 'text-pink-500 dark:text-pink-400';
  } else if (name.includes('أساس')) {
    Icon = Zap;
    colorClass = 'text-green-500 dark:text-green-400';
  } else if (name.toLowerCase().includes('ielts') || name.includes('ايلتس')) {
    Icon = Globe;
    colorClass = 'text-emerald-500 dark:text-emerald-400';
  } else if (name.includes('محادثة')) {
    Icon = MessageCircle;
    colorClass = 'text-purple-500 dark:text-purple-400';
  }

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <Icon className={`w-4 h-4 flex-shrink-0 ${colorClass}`} />
      <span>{name}</span>
    </div>
  );
};

export default PackageBadge;
