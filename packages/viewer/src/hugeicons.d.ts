declare module '@hugeicons/core-free-icons/*' {
  import type { IconSvgElement } from '@hugeicons/react';

  const icon: IconSvgElement;
  export default icon;
}

declare module 'shiki/langs/*.mjs' {
  import type { LanguageInput } from 'shiki/types';

  const language: LanguageInput;
  export default language;
}
