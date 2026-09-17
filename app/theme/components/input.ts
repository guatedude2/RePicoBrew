export const fieldBase = {
  bg: 'ink.inputBg',
  border: '1px solid',
  borderColor: 'ink.inputBorder',
  color: 'ink.text',
  borderRadius: '8px',
  fontSize: 'sm',
  _hover: { borderColor: 'ink.borderStrong' },
  _focus: { borderColor: 'brand.500', boxShadow: 'none' },
  _invalid: { borderColor: 'danger.500' },
  _placeholder: { color: 'ink.textFaintest', fontWeight: '400' },
  _autofill: {
    textFillColor: 'ink.text',
    boxShadow: '0 0 0px 1000px oklch(0.15 0.004 260) inset',
    transition: 'background-color 5000s ease-in-out 0s',
  },
};

export const inputStyles = {
  components: {
    Input: {
      defaultProps: { variant: 'main' },
      baseStyle: { field: { fontWeight: 400, borderRadius: '8px' } },
      variants: {
        main: { field: fieldBase },
        auth: { field: fieldBase },
        search: () => ({
          field: { border: 'none', py: '11px', borderRadius: 'inherit', _placeholder: { color: 'ink.textFaintest' } },
        }),
      },
    },
    NumberInput: {
      baseStyle: { field: { fontWeight: 400 } },
      variants: {
        main: () => ({ field: fieldBase }),
        auth: () => ({ field: fieldBase }),
        authSecondary: () => ({ field: fieldBase }),
        search: () => ({
          field: { border: 'none', py: '11px', borderRadius: 'inherit', _placeholder: { color: 'ink.textFaintest' } },
        }),
      },
    },
    Select: {
      defaultProps: { variant: 'main' },
      baseStyle: { field: { fontWeight: 400 } },
      variants: {
        main: {
          field: fieldBase,
          icon: { color: 'ink.textFaint' },
        },
        mini: () => ({
          field: { bg: 'ink.inputBg', border: '0px solid transparent', fontSize: '0px', p: '10px' },
          icon: { color: 'ink.textFaint' },
        }),
        subtle: () => ({
          box: { width: 'unset' },
          field: {
            bg: 'transparent',
            border: '0px solid',
            color: 'ink.textFaint',
            borderColor: 'transparent',
            width: 'max-content',
          },
          icon: { color: 'ink.textFaint' },
        }),
        transparent: () => ({
          field: {
            bg: 'transparent',
            border: '0px solid',
            width: 'min-content',
            color: 'ink.textFaint',
            borderColor: 'transparent',
            padding: '0px',
            paddingLeft: '8px',
            paddingRight: '20px',
            fontWeight: '700',
            fontSize: '14px',
          },
          icon: {
            transform: 'none !important',
            position: 'unset !important',
            width: 'unset',
            color: 'ink.textFaint',
            right: '0px',
          },
        }),
        auth: () => ({ field: fieldBase }),
        authSecondary: () => ({ field: fieldBase }),
        search: () => ({
          field: { border: 'none', py: '11px', borderRadius: 'inherit' },
        }),
      },
    },
  },
};
