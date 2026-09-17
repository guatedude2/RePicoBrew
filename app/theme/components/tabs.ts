export const tabsStyles = {
  components: {
    Tabs: {
      variants: {
        line: {
          tablist: {
            gap: '4px',
            borderColor: 'transparent',
          },
          tab: {
            fontSize: '13px',
            fontWeight: '600',
            px: '16px',
            py: '10px',
            color: 'ink.textFaint',
            borderColor: 'transparent',
            _selected: {
              color: 'ink.text',
              borderColor: 'brand.500',
            },
          },
        },
      },
    },
  },
};
