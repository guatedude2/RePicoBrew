import { mode } from '@chakra-ui/theme-tools';

type ColorModeProps = { colorMode: 'light' | 'dark' };

export const sliderStyles = {
  components: {
    RangeSlider: {
      variants: {
        main: (props: ColorModeProps) => ({
          thumb: {
            bg: mode('brand.500', 'brand.400')(props),
          },
        }),
      },
    },
  },
};
