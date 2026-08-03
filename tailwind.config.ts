import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        av: {
          navy: "#0F1F3D",
          gold: "#C9A84C",
          white: "#F8F9FA",
          slate: "#4A5568",
          green: "#27AE60",
          orange: "#E67E22",
          red: "#E74C3C",
          "light-grey": "#EDF2F7",
        },
      },
      fontFamily: {
        display: ["var(--font-dm-serif)", "serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-roboto-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
