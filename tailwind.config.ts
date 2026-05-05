import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#070b14",
        panel: "rgba(255,255,255,0.06)",
        line: "rgba(255,255,255,0.10)",
        accent: "#7c3aed",
      },
    },
  },
  plugins: [],
};

export default config;
