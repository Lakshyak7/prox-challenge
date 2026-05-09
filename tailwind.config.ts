import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        garage: {
          50: "#f8f6f1",
          100: "#ede9dd",
          200: "#d9d0bb",
          300: "#c0b18f",
          400: "#a89269",
          500: "#8f7550",
          600: "#735e40",
          700: "#5c4a33",
          800: "#3d3122",
          900: "#1e1810",
          950: "#0f0c08",
        },
      },
    },
  },
  plugins: [],
};

export default config;
