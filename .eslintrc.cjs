module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
    jest: true,
    browser: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/'],
  overrides: [
    {
      files: ['**/tests/**/*.js'],
      env: {
        jest: true,
      },
    },
  ],
  rules: {
    'no-console': 'off',
    'no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^(?:_|ignored)' }
    ],
  },
};
