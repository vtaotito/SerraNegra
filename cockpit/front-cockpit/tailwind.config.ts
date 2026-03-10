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
          bg: "#f7f4f5",
          surface: "#ffffff",
          border: "#e5dfe1",
          muted: "#78696c",
          accent: "#A81C2C",
          accentHover: "#c42538",
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
