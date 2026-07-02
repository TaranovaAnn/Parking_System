const IMAGE_FILE_PATTERN = /\.(png|jpe?g|gif|webp)$/i;

export function isImageFile(fileName: string): boolean {
  return IMAGE_FILE_PATTERN.test(fileName);
}
