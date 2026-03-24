import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cockpit: {
          bg: "#faf7f7",
          surface: "#ffffff",
          border: "#e8e0e1",
          muted: "#78696c",
          accent: "#AA1A1B",
          accentHover: "#d42b2c",
          gold: "#a07828",
          danger: "#d32f2f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
