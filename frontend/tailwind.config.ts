import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charbon: {
          950: "#06070A",
          900: "#0A0C10",
          850: "#0E1116",
          800: "#12151B",
          700: "#1A1E26",
        },
        carbone: {
          700: "#232833",
          600: "#2C323F",
          500: "#3A4150",
        },
        rouge: {
          500: "#E23A3A",
          400: "#F05454",
          600: "#C62F2F",
          300: "#FF7A7A",
        },
        accent: {
          DEFAULT: "#E23A3A",
          light: "#FF7A7A",
          dark: "#B32424",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: [
          "var(--font-display)",
          "Space Grotesk",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(226, 58, 58, 0.45)",
        "glow-sm": "0 0 20px -8px rgba(226, 58, 58, 0.5)",
        card: "0 20px 60px -30px rgba(0, 0, 0, 0.8)",
        "inner-line": "inset 0 1px 0 0 rgba(255, 255, 255, 0.06)",
      },
      backgroundImage: {
        "radial-glow":
          "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(226,58,58,0.18), transparent 70%)",
        "aurora":
          "linear-gradient(120deg, rgba(226,58,58,0.12), rgba(99,102,241,0.08), rgba(226,58,58,0.06))",
      },
      animation: {
        "pulse-dot": "pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 6s ease-in-out infinite",
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 2.5s linear infinite",
        "gradient-shift": "gradient-shift 8s ease infinite",
        "spin-slow": "spin 14s linear infinite",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
