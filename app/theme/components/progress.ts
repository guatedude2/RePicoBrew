export const progressStyles = {
  components: {
    Progress: {
      baseStyle: {
        track: {
          bg: 'ink.divider',
        },
        filledTrack: {
          bg: 'brand.500',
        },
      },
      variants: {
        table: {
          filledTrack: { bg: 'brand.500' },
          track: { bg: 'ink.divider', h: '8px', w: '54px' },
        },
      },
    },
  },
};
