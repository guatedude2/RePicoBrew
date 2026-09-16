export const inputStyles = {
  components: {
    Input: {
      defaultProps: {
        variant: 'main',
      },
      baseStyle: {
        field: {
          fontWeight: 400,
          borderRadius: '8px',
        },
      },

      variants: {
        main: {
          field: {
            bg: 'background.400',
            border: '1px solid',
            color: 'white',
            borderColor: 'whiteAlpha.500',
            borderRadius: '16px',
            fontSize: 'sm',
            p: '20px',
            _focus: { borderColor: 'whiteAlpha.800' },
            _invalid: { borderColor: 'red.500' },
            _placeholder: { color: 'secondaryGray.600', fontWeight: '400' },
            _autofill: {
              // border: '1px solid transparent',
              textFillColor: '#c6c6c6',
              boxShadow: '0 0 0px 1000px #434248 inset',
              transition: 'background-color 5000s ease-in-out 0s',
            },
          },
        },
        auth: {
          field: {
            fontWeight: '500',
            color: 'white',
            bg: 'transparent',
            border: '1px solid',
            borderColor: 'whiteAlpha.500',
            borderRadius: '16px',
            _focus: { borderColor: 'whiteAlpha.800' },
            _invalid: { borderColor: 'red.500' },
            _placeholder: { color: 'secondaryGray.600', fontWeight: '400' },
            _autofill: {
              // border: '1px solid transparent',
              textFillColor: '#c6c6c6',
              boxShadow: '0 0 0px 1000px #434248 inset',
              transition: 'background-color 5000s ease-in-out 0s',
            },
          },
        },
        search: () => ({
          field: {
            border: 'none',
            py: '11px',
            borderRadius: 'inherit',
            _placeholder: { color: 'secondaryGray.600' },
          },
        }),
      },
    },
    NumberInput: {
      baseStyle: {
        field: {
          fontWeight: 400,
        },
      },

      variants: {
        main: () => ({
          field: {
            bg: 'transparent',
            border: '1px solid',

            borderColor: 'secondaryGray.100',
            borderRadius: '16px',
            _placeholder: { color: 'secondaryGray.600' },
          },
        }),
        auth: () => ({
          field: {
            bg: 'transparent',
            border: '1px solid',

            borderColor: 'secondaryGray.100',
            borderRadius: '16px',
            _placeholder: { color: 'secondaryGray.600' },
          },
        }),
        authSecondary: () => ({
          field: {
            bg: 'transparent',
            border: '1px solid',

            borderColor: 'secondaryGray.100',
            borderRadius: '16px',
            _placeholder: { color: 'secondaryGray.600' },
          },
        }),
        search: () => ({
          field: {
            border: 'none',
            py: '11px',
            borderRadius: 'inherit',
            _placeholder: { color: 'secondaryGray.600' },
          },
        }),
      },
    },
    Select: {
      defaultProps: {
        variant: 'main',
      },
      baseStyle: {
        field: {
          fontWeight: 400,
        },
      },

      variants: {
        main: {
          field: {
            fontSize: 'sm',
            bg: 'background.400',
            border: '1px solid',
            color: 'white',
            borderColor: 'whiteAlpha.500',
            borderRadius: '16px',
            _focus: { borderColor: 'whiteAlpha.800' },
            _placeholder: { color: 'secondaryGray.600' },
          },
          icon: {
            color: 'secondaryGray.600',
          },
        },
        mini: () => ({
          field: {
            bg: 'background.400',
            border: '0px solid transparent',
            fontSize: '0px',
            p: '10px',
            _placeholder: { color: 'secondaryGray.600' },
          },
          icon: {
            color: 'secondaryGray.600',
          },
        }),
        subtle: () => ({
          box: {
            width: 'unset',
          },
          field: {
            bg: 'transparent',
            border: '0px solid',
            color: 'secondaryGray.600',
            borderColor: 'transparent',
            width: 'max-content',
            _placeholder: { color: 'secondaryGray.600' },
          },
          icon: {
            color: 'secondaryGray.600',
          },
        }),
        transparent: () => ({
          field: {
            bg: 'transparent',
            border: '0px solid',
            width: 'min-content',
            color: 'secondaryGray.600',
            borderColor: 'transparent',
            padding: '0px',
            paddingLeft: '8px',
            paddingRight: '20px',
            fontWeight: '700',
            fontSize: '14px',
            _placeholder: { color: 'secondaryGray.600' },
          },
          icon: {
            transform: 'none !important',
            position: 'unset !important',
            width: 'unset',
            color: 'secondaryGray.600',
            right: '0px',
          },
        }),
        auth: () => ({
          field: {
            bg: 'transparent',
            border: '1px solid',

            borderColor: 'secondaryGray.100',
            borderRadius: '16px',
            _placeholder: { color: 'secondaryGray.600' },
          },
        }),
        authSecondary: () => ({
          field: {
            bg: 'transparent',
            border: '1px solid',

            borderColor: 'secondaryGray.100',
            borderRadius: '16px',
            _placeholder: { color: 'secondaryGray.600' },
          },
        }),
        search: () => ({
          field: {
            border: 'none',
            py: '11px',
            borderRadius: 'inherit',
            _placeholder: { color: 'secondaryGray.600' },
          },
        }),
      },
    },
  },
};
