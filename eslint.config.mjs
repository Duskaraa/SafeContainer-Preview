import minecraftLinting from "eslint-plugin-minecraft-linting";
export default [
  {
    files: ["scripts/**/*.{js,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      "minecraft-linting": minecraftLinting,
    },
    rules: {
      "minecraft-linting/avoid-unnecessary-command": "error",
    },
  },
];
