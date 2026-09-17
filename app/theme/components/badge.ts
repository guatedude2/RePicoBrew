export const badgeStyles = {
  components: {
    Badge: {
      baseStyle: {
        borderRadius: '999px',
        lineHeight: '100%',
        fontWeight: '700',
        textTransform: 'none',
        padding: '5px 12px',
      },
      variants: {
        brand: {
          bg: 'brand.100',
          color: 'brand.500',
        },
        subtle: {
          bg: 'ink.card',
          color: 'ink.textSecondary',
        },
      },
      defaultProps: {
        variant: 'brand',
      },
    },
  },
};
