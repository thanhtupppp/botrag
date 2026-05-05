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
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            color: theme("colors.white/85"),
            lineHeight: "1.75",
            h1: {
              color: theme("colors.white"),
              fontWeight: "600",
              letterSpacing: "-0.03em",
            },
            h2: {
              color: theme("colors.white"),
              fontWeight: "600",
              letterSpacing: "-0.02em",
            },
            h3: {
              color: theme("colors.white"),
              fontWeight: "600",
            },
            a: {
              color: theme("colors.violet.300"),
              textDecoration: "underline",
              textUnderlineOffset: "0.2em",
              textDecorationThickness: "0.08em",
            },
            "a:hover": {
              color: theme("colors.violet.200"),
            },
            code: {
              color: theme("colors.white"),
              backgroundColor: "rgba(255,255,255,0.08)",
              paddingLeft: "0.25rem",
              paddingRight: "0.25rem",
              paddingTop: "0.15rem",
              paddingBottom: "0.15rem",
              borderRadius: theme("borderRadius.sm"),
              fontWeight: "500",
            },
            "pre code": {
              backgroundColor: "transparent",
              padding: 0,
            },
            ul: {
              marginTop: "1rem",
              marginBottom: "1rem",
            },
            ol: {
              marginTop: "1rem",
              marginBottom: "1rem",
            },
            li: {
              marginTop: "0.35rem",
              marginBottom: "0.35rem",
            },
            blockquote: {
              color: theme("colors.white/70"),
              borderLeftColor: theme("colors.violet.500/40"),
              fontStyle: "normal",
            },
          },
        },
      }),
    },
  },
  plugins: [],
};

export default config;
