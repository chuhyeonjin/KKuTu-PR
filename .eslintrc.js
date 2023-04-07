module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: 'eslint:recommended',
  overrides: [
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    'semi': ['error', 'always'],
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'arrow-spacing': ['error', { before: true, after: true }],
    'block-spacing': ['error', 'always'],
    'comma-spacing': ['error'],
    'comma-style': ['error', 'last'],
    'indent': ['error', 2],
    'max-len': ['error', { code: 120, ignoreComments: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
    'object-curly-spacing': ['error', 'always'],
    'space-before-function-paren': ['error', { asyncArrow: 'always', anonymous: 'never', named: 'never' }],
    'quotes': ['error', 'single', { allowTemplateLiterals: true }],
    'quote-props': ['error', 'consistent-as-needed'],
    'no-trailing-spaces': ['error', { skipBlankLines: true }],
    'comma-dangle': ['error', 'never'],
    'space-infix-ops': ['error'],
    'keyword-spacing': ['error', { before: true, after: true }],
    'space-before-blocks': ['error', 'always'],
    'curly': ['error', 'multi-line'],
    'array-bracket-spacing': ['error', 'never'],
    'computed-property-spacing': ['error', 'never'],
    'func-call-spacing': ['error', 'never'],
    'key-spacing': 'error',
    'one-var': ['error', 'never'],
    'operator-linebreak': ['error', 'after'],
    'switch-colon-spacing': 'error',
    'arrow-parens': ['error', 'always'],
    'prefer-const': ['error', { destructuring: 'all' }],
    'rest-spread-spacing': 'error'
  }
};
