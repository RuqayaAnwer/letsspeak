import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  
  // 👇 هذا هو الجزء الجديد الذي يمنع حذف تنسيقات الشاشات الصغيرة
  safelist: [
    {
      pattern: /^(sm|md|lg|xl|2xl):/,
    }
  ],
  // 👆 نهاية الجزء الجديد

  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Redefine Tailwind's default colors used in the app to match the Logo's Green/Orange theme
        blue: colors.emerald,
        indigo: colors.orange,
        purple: colors.orange,
        primary: colors.emerald,
        accent: colors.orange,
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
