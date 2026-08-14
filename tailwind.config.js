/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
    "./App.tsx",
  ],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#F3EDE1",
          dark: "#E8E0D0",
          line: "#D4C9B8",
        },
        pen: {
          DEFAULT: "#B0432E",
          light: "#C5562E",
          muted: "#B0432E99",
        },
        ink: {
          50: "#f7f6f3",
          100: "#ece9e1",
          200: "#d9d3c4",
          300: "#c0b6a0",
          400: "#a6977c",
          500: "#8f7d62",
          600: "#7a6a54",
          700: "#645646",
          800: "#54493c",
          900: "#483f35",
          950: "#272119",
        },
        sage: {
          50: "#f4f7f4",
          100: "#e4ebe4",
          200: "#c9d7ca",
          300: "#a3b8a5",
          400: "#77957a",
          500: "#5a7a5e",
          600: "#466149",
          700: "#394e3c",
          800: "#304032",
          900: "#29352b",
          950: "#141c15",
        },
        coral: {
          50: "#fff5f2",
          100: "#ffe8e1",
          200: "#ffd5c8",
          300: "#ffb8a1",
          400: "#ff8f6b",
          500: "#f86a3f",
          600: "#e54e22",
          700: "#c13d18",
          800: "#a03418",
          900: "#842f1a",
          950: "#48150a",
        },
      },
      fontFamily: {
        // Loaded via expo-google-fonts (see app/_layout.tsx)
        display: ["Fraunces_600SemiBold"],
        "display-regular": ["Fraunces_400Regular"],
        mono: ["CourierPrime_400Regular"],
        "mono-bold": ["CourierPrime_700Bold"],
        sans: ["System"],
      },
      maxWidth: {
        sheet: "800px",
      },
      keyframes: {
        "drawer-in-left": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "drawer-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "drawer-in-left": "drawer-in-left 0.25s ease-out",
        "drawer-in-right": "drawer-in-right 0.25s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
