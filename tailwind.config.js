/**
 * Design tokens ported verbatim from the `Preach.dc.html` prototype.
 * Every hex value below appears literally in that file — do not "improve" them.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        page: '#04060d',
        screen: '#07090f',
        nav: '#060810',
        surface: '#0b1422',
        sheet: '#0c1726',
        inset: '#08111e',
        chip: '#0d1525',
        bubble: '#0d1828',
        mic: '#152638',

        // Hairlines / borders
        line: {
          hair: '#0a0f1c',
          rule: '#0e1828',
          edge: '#162035',
          sheet: '#1e2c45',
          verse: '#07101a',
          deep: '#0a0d18',
        },

        // Warm gold — the primary accent
        gold: {
          DEFAULT: '#c9a86c',
          deep: '#a87c3a',
          dim: '#7a6040',
          faint: '#5a4a30',
          muted: '#6a5e48',
          soft: '#b09060',
        },

        // Violet — insights, community, shared journals
        violet: {
          DEFAULT: '#8b6fd0',
          deep: '#6b4fb8',
          light: '#a080e0',
          muted: '#8070a0',
          soft: '#9b7fd4',
          faint: '#5a4a80',
        },

        // Teal — presence, live state, affirmative actions
        teal: {
          DEFAULT: '#4aab9e',
          deep: '#2a8a80',
          muted: '#407068',
          soft: '#a0d4cc',
        },

        // Rose — destructive / decline
        rose: {
          DEFAULT: '#e07070',
          deep: '#c05050',
          danger: '#b93328',
        },

        // Foreground ramp
        ink: {
          DEFAULT: '#eeeae3',
          secondary: '#d8dce8',
          tertiary: '#d0d4e4',
          body: '#c0cad8',
          alt: '#c8cedd',
          note: '#b0bccc',
          cream: '#ede8df',
        },

        // Muted ramp (labels, meta, disabled)
        muted: {
          50: '#6a7a90',
          100: '#7a8a9e',
          200: '#4a5a72',
          250: '#5a6880',
          300: '#3d4d68',
          400: '#2d3d56',
          500: '#2a3850',
          600: '#1e2d40',
        },

        blue: {
          soft: '#a8c4e0',
        },
      },
      fontFamily: {
        sans: ['PlusJakartaSans_400Regular'],
        medium: ['PlusJakartaSans_500Medium'],
        semibold: ['PlusJakartaSans_600SemiBold'],
        bold: ['PlusJakartaSans_700Bold'],
        black: ['PlusJakartaSans_800ExtraBold'],
        serif: ['NotoSerif_400Regular'],
        'serif-italic': ['NotoSerif_400Regular_Italic'],
        'serif-bold': ['NotoSerif_700Bold'],
        mono: ['monospace'],
      },
      fontSize: {
        // The prototype uses sub-pixel sizes; preserved exactly.
        '2xs': '9px',
        'xs-': '9.5px',
        xs: '10px',
        'xs+': '10.5px',
        sm: '11px',
        'sm+': '11.5px',
        base: '12px',
        'base+': '12.5px',
        md: '13px',
        'md+': '13.5px',
        lg: '14px',
        'lg+': '14.5px',
        xl: '15px',
        '2xl': '16px',
        '3xl': '17px',
        '4xl': '19px',
        '5xl': '20px',
        '6xl': '21px',
        '7xl': '26px',
      },
      borderRadius: {
        chip: '6px',
        pill: '14px',
        card: '13px',
        panel: '16px',
        verse: '22px',
        sheet: '24px',
      },
      letterSpacing: {
        label: '0.14em',
        eyebrow: '0.13em',
        caps: '0.1em',
        wide: '0.16em',
        tight: '-0.02em',
        tighter: '-0.03em',
      },
    },
  },
  plugins: [],
};
