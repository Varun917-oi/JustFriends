const signatures: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (bytes) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes.subarray(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index]),
  "image/gif": (bytes) => /^GIF8[79]a$/.test(String.fromCharCode(...bytes.subarray(0, 6))),
  "image/webp": (bytes) =>
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP",
  "video/mp4": (bytes) => String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp",
  "video/webm": (bytes) => bytes.subarray(0, 4).every((byte, index) => byte === [0x1a, 0x45, 0xdf, 0xa3][index]),
};

export function isSupportedMediaType(mimeType: string) {
  return Object.hasOwn(signatures, mimeType);
}

export function hasValidMediaSignature(mimeType: string, bytes: Uint8Array) {
  return signatures[mimeType]?.(bytes) ?? false;
}
