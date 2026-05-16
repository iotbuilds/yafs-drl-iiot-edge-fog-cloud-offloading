module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        yafsDark: {
          primary: '#3b82f6',
          secondary: '#06b6d4',
          accent: '#10b981',
          neutral: '#15152f',
          'base-100': '#0f1024',
          'base-200': '#171832',
          'base-300': '#25264d',
          info: '#38bdf8',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444'
        }
      },
      'light'
    ]
  }
};
