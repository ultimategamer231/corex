/** @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions} */
export default {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  plugins: ["prettier-plugin-tailwindcss"],
  // Sort classes using the Corex theme so custom tokens are recognised.
  tailwindStylesheet: "./apps/web/app/globals.css",
  tailwindFunctions: ["cn", "cva"],
};
