/** Single source for the product name, shared with the document title in index.html. */
export const APP_NAME =
  (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'iCollect';
