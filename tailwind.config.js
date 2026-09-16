/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Skyview Construction brand: sky/steel blue primary, safety-orange accent.
        brand: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',  // primary CTA blue (good contrast w/ white text)
          800: '#1E40AF',
          900: '#1E3A8A',  // dark blue — header backgrounds
        },
        accent: {
          50:  '#FFF7ED',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',  // safety orange highlight
          700: '#C2410C',
        },
      },
    },
  },
  plugins: [],
};
