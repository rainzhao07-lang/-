import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 全站基调:奶油底 + 暖橘主色(任务书:温暖、治愈、有猫的柔软感)
        cream: "#FAF6EF",
        milk: "#F3ECDF",
        ink: "#3E3226",
        soft: "#8A7B68",
        accent: "#D97E45",
        accentDeep: "#B96432",
      },
      borderRadius: {
        card: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
