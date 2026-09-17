export const menuStyles = {
  components: {
    Menu: {
      baseStyle: {
        list: {
          bg: 'ink.card',
          border: '1px solid',
          borderColor: 'ink.cardBorder',
          boxShadow: '0 12px 30px -8px rgba(0, 0, 0, 0.6)',
        },
        groupTitle: {
          color: 'ink.textFaint',
        },
        divider: {
          borderColor: 'ink.divider',
        },
        item: {
          bg: 'none',
          color: 'ink.text',
          _hover: {
            bg: 'background.300',
          },
          _focus: {
            bg: 'background.300',
          },
        },
        button: {
          _hover: {
            '& svg': { color: 'gray.400' },
          },
          _focus: {
            '& svg': { color: 'gray.400' },
          },
        },
      },
    },
  },
};
