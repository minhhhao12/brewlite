import path from "node:path";
import { fileURLToPath } from "node:url";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

// Khai báo __dirname trong môi trường ES Module (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
  { ignores: [".next/**", "next-env.d.ts", "node_modules/**", "public/sw.js"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true, // Cho phép typescript-eslint tự động quản lý tsconfig
        tsconfigRootDir: __dirname, // Chỉ định rõ thư mục gốc của file eslint.config hiện tại
      },
    },
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
