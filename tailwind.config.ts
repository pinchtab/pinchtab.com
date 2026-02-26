import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0f1117',
          surface: '#1a1d27',
          'surface-hover': '#222633',
          'surface-code': '#141720',
          border: 'rgba(251, 191, 36, 0.15)',
          'border-subtle': 'rgba(255, 255, 255, 0.06)',
          text: '#e2e8f0',
          'text-muted': '#94a3b8',
          'text-dim': '#64748b',
          accent: '#fbbf24',
          'accent-light': '#fde68a',
          'accent-dark': '#d97706',
          'accent-glow': 'rgba(251, 191, 36, 0.08)',
          'accent-glow-bright': 'rgba(251, 191, 36, 0.15)',
          success: '#00e5cc',
          red: '#ef4444',
          green: '#22c55e',
          blue: '#93c5fd',
        },
        slate: {
          '400': '#cbd5e1',
          '500': '#64748b',
          '800': '#1e293b',
          '900': '#0f172a',
          '950': '#020617',
        },
        yellow: {
          '400': '#eab308',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      borderRadius: {
        sm: '10px',
        md: '16px',
        lg: '16px',
      },
      spacing: {
        'header': '64px',
      },
      boxShadow: {
        glow: '0 0 40px rgba(251, 191, 36, 0.08)',
      },
      fontSize: {
        'code-sm': '0.82rem',
        'code-label': '0.72rem',
      },
      lineHeight: {
        'code': '1.8',
      },
      gap: {
        'dots': '6px',
      },
      scale: {
        '98': '0.98',
      },
      transitionTimingFunction: {
        'snappy': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
