import { fieldBase } from './input';

// Textarea is a single-part Chakra component (unlike Input/Select, which are multi-part with a
// "field" anatomy key) — styles go directly on baseStyle/variants, not wrapped in `{ field: {} }`.
export const textareaStyles = {
  components: {
    Textarea: {
      defaultProps: { variant: 'main' },
      baseStyle: {
        fontWeight: 400,
        borderRadius: '8px',
      },
      variants: {
        main: fieldBase,
        search: { border: 'none', py: '11px', borderRadius: 'inherit', _placeholder: { color: 'ink.textFaintest' } },
      },
    },
  },
};
