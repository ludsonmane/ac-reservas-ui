/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // texto padrão da UI
        sans: ['Comfortaa', 'ui-sans-serif', 'system-ui'],
        // títulos (peso 400)
        title: ['"Alfa Slab One"', 'serif'],
      },
      colors: {
        // tema claro
        bg: '#f7f7f5',          // fundo geral claro
        panel: '#ffffff',       // topo
        card: '#fffaf0',        // card bege suave
        border: '#e7e2d7',
        muted: '#6b7280',       // cinza texto secundário
        text: '#1f2937',        // texto escuro
        primary: '#2ea44f',     // verde primário (botões/ações)
        primaryDark: '#20853c', // hover
        accent: '#3fbf62',      // barras/realces
        danger: '#dc2626',      // vermelho
        ok: '#16a34a'
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: {
        soft: '0 8px 24px rgba(0,0,0,.08)',
        card: '0 6px 18px rgba(0,0,0,.06)'
      }
    },
  },
  plugins: [],
};
