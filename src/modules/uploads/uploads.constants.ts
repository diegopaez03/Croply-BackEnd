export const IMAGEN_MIME_TYPES_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const IMAGEN_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGEN_MAX_MB = IMAGEN_MAX_BYTES / (1024 * 1024);
