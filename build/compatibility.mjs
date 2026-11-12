/** Small packaging-only gate. Compatible browsers see the unchanged app. */
export const compatibilityGate=`
const pictoraSupported = typeof Worker === 'function' && typeof createImageBitmap === 'function' && typeof OffscreenCanvas === 'function' && typeof URL.createObjectURL === 'function' && typeof HTMLCanvasElement.prototype.toBlob === 'function';
if (!pictoraSupported) {
  const message = document.createElement('main');
  message.style.cssText = 'max-width:34rem;margin:12vh auto;padding:2rem;font-family:Arial,sans-serif;line-height:1.6';
  message.setAttribute('role', 'alert');
  const heading = document.createElement('h1'); heading.textContent = 'Pictora';
  const explanation = document.createElement('p'); explanation.textContent = 'This browser cannot run Pictora here. Open this file in a current desktop version of Google Chrome or Microsoft Edge.';
  message.append(heading, explanation); document.getElementById('root').append(message);
} else {
`;
