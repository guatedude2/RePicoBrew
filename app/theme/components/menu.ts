export const menuStyles = {
  components: {
    Menu: {
      baseStyle: {
        item: {
          bg: 'none',
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
