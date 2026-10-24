import corex from "@corex/config/eslint";

const config = [...corex, { settings: { react: { version: "19" } } }];

export default config;
