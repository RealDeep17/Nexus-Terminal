/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        fontFamily: {
            sans: ['-apple-system', 'BlinkMacSystemFont', '"Trebuchet MS"', 'Roboto', 'Ubuntu', 'sans-serif'],
        },
        fontSize: {
            'xs': ['11px', '14px'],
            'sm': ['12px', '16px'],
            'base': ['13px', '18px'],
            'md': ['14px', '20px'],
            'lg': ['16px', '24px'],
            'xl': ['20px', '28px'],
            '2xl': ['24px', '32px'],
        },
        extend: {
            colors: {
                'bg-chart': 'var(--bg-chart)',
                'bg-app': 'var(--bg-app)',
                'bg-panel': 'var(--bg-panel)',
                'bg-dropdown': 'var(--bg-dropdown)',
                'bg-modal': 'var(--bg-modal)',
                'bg-input': 'var(--bg-input)',
                'bg-hover': 'var(--bg-hover)',
                'bg-selected': 'rgba(41,98,255,0.1)',
                'bg-tooltip': 'var(--bg-tooltip)',

                'border-default': 'var(--border)',
                'border-light': 'var(--border-light)',
                'border-focus': 'var(--border-focus)',

                'text-primary': 'var(--text-primary)',
                'text-secondary': 'var(--text-secondary)',
                'text-muted': 'var(--text-muted)',
                'text-link': 'var(--text-link)',
                'text-inverse': 'var(--text-inverse)',

                'tv-bg': 'var(--bg-chart)',
                'tv-panel': 'var(--bg-panel)',
                'tv-border': 'var(--border)',
                'tv-hover': 'var(--bg-hover)',
                'tv-input': 'var(--bg-input)',
                'tv-text': 'var(--text-primary)',
                'tv-muted': 'var(--text-secondary)',
                'tv-dim': 'var(--text-muted)',
                'tv-tooltip': 'var(--bg-tooltip)',

                'tv-blue': 'var(--blue)',
                'tv-blue-hover': 'var(--blue-hover)',
                'tv-blue-dim': 'var(--blue-dim)',

                'tv-green': 'var(--green)',
                'tv-green-dim': 'var(--green-dim)',
                'tv-red': 'var(--red)',
                'tv-red-dim': 'var(--red-dim)',
                'tv-amber': 'var(--amber)',
                'tv-amber-dim': 'var(--amber-dim)',
            },
        },
    },
    plugins: [],
};
