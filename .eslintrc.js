module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['react', '@typescript-eslint', 'react-hooks', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  env: {
    browser: true,
    node: true,
    jest: true,
    es6: true,
  },
  settings: {
    react: {
      pragma: 'React',
      version: 'detect',
    },
  },
  rules: {
    'prettier/prettier': 'warn',
    // OVERRIDE PLUGIN DEFAULTS: turn rules off
    'react/react-in-jsx-scope': 'off',
    // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/display-name.md
    'react/display-name': 'off',
    // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/prop-types.md
    'react/prop-types': 'off',
    // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/explicit-function-return-type.md
    '@typescript-eslint/explicit-function-return-type': 'off',
    // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/explicit-member-accessibility.md
    '@typescript-eslint/explicit-member-accessibility': 'off',
    // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/prefer-interface.md
    '@typescript-eslint/prefer-interface': 'off',
    // https://github.com/typescript-eslint/typescript-eslint/blob/v3.2.0/packages/eslint-plugin/docs/rules/explicit-module-boundary-types.md
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // OVERRIDE PLUGIN DEFAULTS: change severity or rule config
    // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/no-non-null-assertion.md
    '@typescript-eslint/no-non-null-assertion': 'warn',
    // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/array-type.md
    '@typescript-eslint/array-type': [
      'warn',
      {
        default: 'array-simple',
      },
    ],
    // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-unescaped-entities.md
    'react/no-unescaped-entities': [
      'error',
      {
        forbid: [
          {
            char: '>',
            alternatives: ['&gt;'],
          },
          {
            char: '}',
            alternatives: ['&#125;'],
          },
        ],
      },
    ],
    // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/no-use-before-define.md
    '@typescript-eslint/no-use-before-define': [
      'error',
      {
        functions: false,
        typedefs: false,
      },
    ],
    // ADD IN EXTRAS
    // https://eslint.org/docs/rules/eqeqeq
    eqeqeq: [
      'error',
      'always',
      {
        null: 'ignore',
      },
    ],
    // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/no-shadow.md
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': ['error'],
    // https://eslint.org/docs/rules/array-callback-return
    'array-callback-return': 'error',
    // https://github.com/yannickcr/eslint-plugin-react/pull/1103/
    'react/no-unused-state': 'error',
    // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-curly-brace-presence.md
    'react/jsx-curly-brace-presence': [
      'error',
      {
        props: 'never',
        children: 'never',
      },
    ],
    // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/no-unused-vars.md
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        args: 'all',
        argsIgnorePattern: '^_',
      },
    ],
    // https://eslint.org/docs/rules/prefer-template.html
    'prefer-template': 'warn',
    // https://eslint.org/docs/rules/no-param-reassign.html
    'no-param-reassign': 'warn',
    // https://eslint.org/docs/rules/prefer-arrow-callback.html
    'prefer-arrow-callback': 'warn',
    // https://eslint.org/docs/rules/dot-notation.html
    'dot-notation': 'warn',
    // https://eslint.org/docs/rules/no-multi-assign
    'no-multi-assign': 'warn',
    // https://eslint.org/docs/rules/no-plusplus
    'no-plusplus': [
      'warn',
      {
        allowForLoopAfterthoughts: true,
      },
    ],
    // https://eslint.org/docs/rules/no-nested-ternary.html
    'no-nested-ternary': 'warn',
    // https://eslint.org/docs/rules/no-unneeded-ternary.html
    'no-unneeded-ternary': 'warn',
    // https://eslint.org/docs/rules/no-useless-concat
    'no-useless-concat': 'warn',
    // https://eslint.org/docs/rules/no-else-return
    'no-else-return': 'warn',
    // https://eslint.org/docs/rules/object-shorthand
    'object-shorthand': 'warn',
    // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/no-array-index-key.md
    'react/no-array-index-key': 'warn',
    // https://github.com/yannickcr/eslint-plugin-react/blob/master/docs/rules/jsx-no-useless-fragment.md
    'react/jsx-no-useless-fragment': 'warn',
    'react/self-closing-comp': [
      'error',
      {
        component: true,
        html: true,
      },
    ],
    'arrow-body-style': ['warn', 'as-needed'],
    //https://eslint.org/docs/2.0.0/rules/curly
    curly: ['warn', 'all'],
  },
};
