export default {
  root: true,
  extends: [
    'eslint:recommended',
    '@eslint/js/recommended',
    'prettier'
  ],
  plugins: ['svelte'],
  overrides: [
    {
      files: ['*.svelte'],
      parser: 'svelte-eslint-parser',
      extends: ['plugin:svelte/recommended', 'prettier'],
      rules: {
        'svelte/no-target-blank': 'error',
        'svelte/no-at-debug-tags': 'warn',
        'svelte/no-reactive-functions': 'error',
        'svelte/no-reactive-literals': 'error'
      }
    }
  ],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2024
  },
  env: {
    browser: true,
    es2024: true,
    node: true,
    mocha: true
  },
  rules: {
    // Code quality
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    
    // Modern JavaScript
    'prefer-const': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'prefer-destructuring': ['error', {
      'array': true,
      'object': true
    }],
    
    // Error prevention
    'no-var': 'error',
    'no-implicit-globals': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // Best practices
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'dot-notation': 'error',
    'no-eval': 'error',
    'no-extend-native': 'error',
    'no-extra-bind': 'error',
    'no-floating-decimal': 'error',
    'no-implicit-coercion': 'error',
    'no-multi-spaces': 'error',
    'no-new-wrappers': 'error',
    'no-throw-literal': 'error',
    'no-trailing-spaces': 'error',
    'no-undef-init': 'error',
    'no-unused-expressions': 'error',
    'radix': 'error',
    'wrap-iife': ['error', 'inside'],
    
    // Async/await
    'require-await': 'error',
    'no-async-promise-executor': 'error',
    'no-await-in-loop': 'warn',
    'no-promise-executor-return': 'error',
    'prefer-promise-reject-errors': 'error'
  },
  globals: {
    ethereum: 'readonly',
    web3: 'readonly'
  }
};