/** @type {import('tailwindcss').Config} */

// Gera a função de cor no formato que o Tailwind precisa pra suportar opacidade
// (ex: bg-primary/10) enquanto o valor em si vem de uma variável CSS — isso é
// o que permite o modo escuro trocar as cores só mudando a classe .dark no
// <html>, sem precisar duplicar "dark:" em cada componente.
function corViaVariavel(nomeVariavel) {
  return `rgb(var(${nomeVariavel}) / <alpha-value>)`;
}

const nomesDeCor = [
  'on-tertiary-fixed', 'surface-container', 'tertiary-container', 'on-error-container',
  'tertiary-fixed-dim', 'on-secondary-fixed-variant', 'on-secondary', 'on-secondary-container',
  'surface-container-highest', 'on-primary-fixed-variant', 'on-tertiary', 'secondary-container',
  'tertiary-fixed', 'on-background', 'on-primary-container', 'on-primary', 'primary-fixed',
  'on-primary-fixed', 'surface-container-high', 'inverse-surface', 'outline', 'surface-container-low',
  'inverse-on-surface', 'primary', 'on-error', 'secondary-fixed-dim', 'tertiary',
  'surface-container-lowest', 'inverse-primary', 'background', 'secondary-fixed', 'on-tertiary-container',
  'surface-bright', 'secondary', 'primary-container', 'surface-dim', 'surface-variant', 'error-container',
  'on-tertiary-fixed-variant', 'on-secondary-fixed', 'primary-fixed-dim', 'surface', 'on-surface', 'error',
  'outline-variant', 'on-surface-variant', 'surface-tint',
];

const colors = Object.fromEntries(nomesDeCor.map((nome) => [nome, corViaVariavel(`--color-${nome}`)]));

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors,
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      spacing: {
        '2xl': '48px',
        xl: '32px',
        unit: '4px',
        'container-padding': '20px',
        'touch-target-min': '48px',
        md: '16px',
        xs: '4px',
        sm: '8px',
        lg: '24px',
      },
      fontFamily: {
        'display-lg': ['Montserrat', 'sans-serif'],
        'headline-lg-mobile': ['Montserrat', 'sans-serif'],
        'body-lg': ['Inter', 'sans-serif'],
        'label-sm': ['Inter', 'sans-serif'],
        'headline-lg': ['Montserrat', 'sans-serif'],
        'headline-md': ['Montserrat', 'sans-serif'],
        'label-bold': ['Inter', 'sans-serif'],
        'body-md': ['Inter', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '800' }],
        'headline-lg-mobile': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'label-sm': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'label-bold': ['14px', { lineHeight: '20px', letterSpacing: '0.05em', fontWeight: '700' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};
