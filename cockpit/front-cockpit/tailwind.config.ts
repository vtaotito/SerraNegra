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
          bg: "#0d1117",
          surface: "#161b22",
          border: "#30363d",
          muted: "#8b949e",
          accent: "#238636",
          accentHover: "#2ea043",
          gold: "#d4a853",
          danger: "#da3633",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
