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
          bg: "#100c0e",
          surface: "#1a1517",
          border: "#33292c",
          muted: "#948a8d",
          accent: "#A81C2C",
          accentHover: "#c42538",
          gold: "#d4a853",
          danger: "#e5484d",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
