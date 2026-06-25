import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        card: "#111111",
        border: "#222222",
        accent: "#7c3aed",
        success: "#22c55e",
        warning: "#eab308",
        danger: "#ef4444",
      },
    },
  },
  plugins: [],
};

export default config;
