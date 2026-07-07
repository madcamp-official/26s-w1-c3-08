import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          accent: "#6D48DB",
          main: "#F3EEFD",
          sub: "#9A85E1",
          bg: "#FBF9FC",
          gray: "#F3EFF7",
          ink: "#3A3D8D",
          muted: "#8588A1",
          line: "#E6E0F1",
        },
      },
    },
  },
  plugins: [],
};

export default config;
