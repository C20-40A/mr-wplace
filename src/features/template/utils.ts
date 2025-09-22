/** Converts a Uint8 array to base64 using the browser's built-in binary to ASCII function
 * @param uint8 - The Uint8Array to convert
 * @returns The base64 encoded string
 */
export function uint8ToBase64(uint8: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary); // Binary to ASCII
}
