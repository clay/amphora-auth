'use strict';

const js = require('@eslint/js'),
  globals = require('globals');

// A translation of the old .eslintrc.js, which extended eslint:recommended.
// valid-jsdoc was removed in ESLint 9, so it is no longer listed.
module.exports = [
  { ignores: ['coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    linterOptions: {
      // ESLint 5 did not report unused eslint-disable comments
      reportUnusedDisableDirectives: 'off'
    },
    rules: {
      // possible errors
      'no-extra-parens': 1,
      // best practices
      complexity: [2, 8],
      'default-case': 2,
      'guard-for-in': 0,
      'no-alert': 1,
      'no-floating-decimal': 1,
      'no-self-compare': 2,
      'no-throw-literal': 2,
      'no-void': 2,
      'quote-props': [2, 'as-needed'],
      'vars-on-top': 2,
      'wrap-iife': 2,
      // strict mode
      strict: [2, 'global'],
      // variables (ESLint 9 started checking catch parameters by default; ESLint 5 did not)
      'no-unused-vars': [2, { caughtErrors: 'none' }],
      // node.js
      'handle-callback-err': [2, '^.*(e|E)rr'],
      'no-mixed-requires': 0,
      'no-new-require': 2,
      'no-path-concat': 2,
      // stylistic issues
      'brace-style': [2, '1tbs', { allowSingleLine: true }],
      'comma-style': [2, 'last'],
      indent: [2, 2, { SwitchCase: 1 }],
      'max-nested-callbacks': [2, 4],
      'newline-after-var': [2, 'always'],
      'no-nested-ternary': 2,
      'no-spaced-func': 0,
      'no-trailing-spaces': 2,
      'no-underscore-dangle': 0,
      'no-unneeded-ternary': 1,
      'one-var': 2,
      quotes: [2, 'single', 'avoid-escape'],
      semi: [2, 'always'],
      'keyword-spacing': 2,
      'space-before-blocks': [2, 'always'],
      'space-before-function-paren': [2, { anonymous: 'always', named: 'never' }],
      'space-infix-ops': [1, { int32Hint: false }],
      'spaced-comment': [2, 'always'],
      // es6
      'generator-star-spacing': [2, 'before'],
      // legacy jshint rules
      'max-depth': [2, 4],
      'max-params': [2, 4],
      'no-console': 0
    }
  },
  {
    // node:test and node:assert are required in the test files; describe/it nest deeper than the callback limit
    files: ['**/*.test.js', 'test/**/*.js'],
    rules: { complexity: 'off', 'max-nested-callbacks': 'off', 'one-var': 'off' }
  },
  {
    // a compact fake server, not written in the style of the package
    files: ['test/helpers/resp-server.js'],
    rules: { 'no-extra-parens': 'off', 'no-nested-ternary': 'off', 'newline-after-var': 'off' }
  }
];
