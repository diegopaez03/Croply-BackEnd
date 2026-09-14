/**
 * ESLint 9 — flat config.
 *
 * Analiza el backend NestJS/TypeScript en busca de errores y olores de código
 * (variables no usadas, promesas sin await/catch, usos inseguros de `any`, etc.).
 *
 * No usa eslint-plugin-prettier: el formato lo cubre Prettier por separado
 * (`pnpm format`). eslint-config-prettier solo apaga reglas de ESLint que
 * chocarían con Prettier, para que el conteo de errores/advertencias refleje
 * calidad de código y no espacios o comillas.
 *
 * Ejecutar: `pnpm lint` (reporte, no modifica archivos)
 * Auto-fix: `pnpm lint:fix`
 */
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Artefactos de build, dependencias y el propio config no se analizan.
    ignores: [
      'eslint.config.mjs',
      'dist/**',
      'node_modules/**',
      'coverage/**',
    ],
  },

  // Reglas base de ESLint (eq. eslint:recommended).
  eslint.configs.recommended,

  // Reglas type-aware de typescript-eslint: usan el type-checker de TS
  // (projectService) y detectan problemas que el linter “ciego” no ve,
  // p. ej. promesas flotantes o argumentos potencialmente `any`.
  ...tseslint.configs.recommendedTypeChecked,

  // Apaga reglas de estilo que duplicarían o pelearían con Prettier.
  eslintConfigPrettier,

  {
    languageOptions: {
      // Entorno Node (process, __dirname, …) y Jest (describe, expect, …).
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        // Type-aware linting sin listar cada tsconfig a mano.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    rules: {
      // NestJS/TypeORM a menudo necesitan `any` en bordes (JSON, getResponse()).
      // Se deja como advertencia para visibilidad, no como error bloqueante.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Promesa sin await/.catch()/.then(): puede tumbar el proceso (p. ej. bootstrap()).
      '@typescript-eslint/no-floating-promises': 'error',

      // Argumento cuyo tipo es `any` implícito: oculta fallos en tiempo de ejecución.
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Asignar un `any` a una variable tipada pierde las garantías del compilador.
      '@typescript-eslint/no-unsafe-assignment': 'warn',

      // Llamar métodos sobre un valor `any` (mismo riesgo que no-unsafe-argument).
      '@typescript-eslint/no-unsafe-call': 'warn',

      // Leer miembros de un `any` (p. ej. exception.getResponse() sin narrowing).
      '@typescript-eslint/no-unsafe-member-access': 'warn',

      // Variables/args declarados y no usados. `_` al inicio = intencional (Nest DI).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // console.log en arranque (main.ts) es útil en dev; no se trata como error.
      'no-console': 'off',
    },
  },
);
