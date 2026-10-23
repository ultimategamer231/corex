import corex from "@corex/config/eslint";

// Root files only (e2e tests, configs). Each workspace lints itself.
const config = [
  { ignores: ["apps/**", "packages/**", "docs/**"] },
  ...corex,
  { settings: { react: { version: "19" } } },
];

export default config;
