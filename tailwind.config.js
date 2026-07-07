/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.04)',
          border: 'rgba(255, 255, 255, 0.08)',
          hover: 'rgba(255, 255, 255, 0.08)',
        },
        neon: {
          cyan: '#00d4ff',
          purple: '#7c3aed',
        },
        space: {
          DEFAULT: '#0a0e1a',
          light: '#0d1117',
        },
        // chat theme (claude.ai light)
        paper: '#FBFAF7',
        ink: '#2D2A26',
        muted: '#6B6760',
        line: '#E8E4DC',
        claude: '#C96442',
        hover: '#F0EDE5',
      },
      backdropBlur: {
        glass: '20px',
      },
    },
  },
  plugins: [],
}
