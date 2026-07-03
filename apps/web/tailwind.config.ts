import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f2933",
        paper: "#fffaf0",
        petal: "#d9467a",
        moss: "#567568",
        amberline: "#d69e2e",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(31, 41, 51, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
