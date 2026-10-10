/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta Cordillera Obsidian
        cordillera: {
          950: '#070a0e',
          900: '#0d1117',
          800: '#161b22',
          700: '#21262d',
          600: '#30363d',
          500: '#484f58',
          400: '#8b949e',
          300: '#c9d1d9',
        },
        // Naranja Cobre (Ala izquierda del Cóndor)
        cobre: {
          300: '#ffa85c',
          400: '#ff9233',
          500: '#ff7a00',
          600: '#e56a00',
          700: '#b85200',
        },
        // Cian Tecnológico (Ala derecha y vector alcista)
        cian: {
          300: '#67f5ff',
          400: '#33f2ff',
          500: '#00f0ff',
          600: '#00c2cf',
          700: '#0096a0',
        },
      },
      backdropBlur: {
        xs: '2px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
        'glass-cobre': '0 0 25px -5px rgba(255, 122, 0, 0.25), inset 0 1px 1px 0 rgba(255, 255, 255, 0.05)',
        'glass-cian': '0 0 25px -5px rgba(0, 240, 255, 0.25), inset 0 1px 1px 0 rgba(255, 255, 255, 0.05)',
        'neon-cobre': '0 0 15px rgba(255, 122, 0, 0.4)',
        'neon-cian': '0 0 15px rgba(0, 240, 255, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-bot': 'floatBot 5s ease-in-out infinite',
        'float-bot-alt': 'floatBotAlt 6s ease-in-out infinite',
        'radar-sweep': 'radarSweep 6s linear infinite',
        'shimmer': 'shimmer 2.5s infinite linear',
      },
      keyframes: {
        floatBot: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%': { transform: 'translateY(-8px) translateX(4px)' },
        },
        floatBotAlt: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%': { transform: 'translateY(6px) translateX(-5px)' },
        },
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
