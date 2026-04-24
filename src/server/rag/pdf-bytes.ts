export function splitPdfBytes(bytes: Uint8Array): {
  ingestBytes: Uint8Array;
  storageBytes: Uint8Array;
} {
  return {
    ingestBytes: bytes.slice(),
    storageBytes: bytes.slice(),
  };
}
