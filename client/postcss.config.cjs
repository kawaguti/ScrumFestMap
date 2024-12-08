module.exports = {
  plugins: {
    'postcss-import': {},
    '@tailwindcss/nesting': {},
    'tailwindcss/nesting': 'postcss-nesting',
    'tailwindcss': {
      config: './tailwind.config.ts'
    },
    'autoprefixer': {},
  }
}
