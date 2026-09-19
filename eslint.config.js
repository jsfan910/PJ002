// @ts-check
import tseslint from "typescript-eslint";

/**
 * ESLint flat config（ESM）。
 * 涵蓋 src/ 與 tests/ 下的 TypeScript 檔案；node_modules、dist 排除。
 * D-02（Leader 裁決）：本檔未列於 SD §8.1 目錄樹，屬目錄樹未窮舉，非設計錯誤。
 */
export default tseslint.config(
  {
    ignores: ["node_modules/**", "dist/**", "coverage/**"]
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ]
    }
  }
);
