export const buttonStyles = {
  components: {
    Button: {
      baseStyle: {
        borderRadius: '8px',
        fontWeight: '700',
        transition: '.2s all ease',
        _focus: {
          boxShadow: 'none',
        },
        _active: {
          boxShadow: 'none',
        },
        // pointerEvents: 'none' stops :hover from ever activating while disabled, so this always
        // wins over each variant's own _hover — relying on opacity/specificity alone doesn't,
        // since _hover and _disabled are equal-specificity pseudo-classes.
        _disabled: {
          pointerEvents: 'none',
          opacity: 1,
          boxShadow: 'none',
          bg: 'ink.borderStrong',
          color: 'ink.textFaint',
          borderColor: 'ink.borderStrong',
        },
      },
      variants: {
        solid: {
          bg: 'ink.card',
          color: 'ink.text',
          border: '1px solid',
          borderColor: 'ink.borderStrong',
          _hover: {
            bg: 'ink.cardHover',
          },
        },
        outline: {
          bg: 'transparent',
          border: '1px solid',
          borderColor: 'ink.borderStrong',
          color: 'ink.textSecondary',
          _hover: {
            bg: 'ink.card',
          },
        },
        brand: {
          bg: 'brand.500',
          color: 'ink.onBrand',
          boxShadow: '0 8px 20px -8px oklch(0.78 0.135 65 / 0.6)',
          _hover: {
            bg: 'brand.600',
          },
          _active: {
            bg: 'brand.600',
          },
        },
        danger: {
          bg: 'danger.600',
          color: 'white',
          _hover: {
            bg: 'danger.500',
          },
        },
        ghost: {
          color: 'ink.textSecondary',
          _hover: {
            bg: 'ink.card',
            color: 'ink.text',
          },
        },
        link: {
          color: 'brand.500',
          fontWeight: '600',
          _hover: {
            color: 'brand.300',
            textDecoration: 'none',
          },
        },
      },
      defaultProps: {
        variant: 'solid',
      },
    },
  },
};
