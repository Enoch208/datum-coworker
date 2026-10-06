export interface CardLighting {
  readonly glare: number;
  readonly shadow: number;
  readonly haze: number;
}

const cardWidthMm = 105;

const svg = (width: number, height: number, body: string): Buffer =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}">${body}</svg>`,
  );

const glareBody = (width: number, strength: number): string => {
  const at = (millimetres: number) => String((millimetres / cardWidthMm) * width);
  return `<defs><radialGradient id="g"><stop offset="0" stop-color="#fff" stop-opacity="${String(strength)}"/><stop offset="0.6" stop-color="#fff" stop-opacity="${String(strength * 0.8)}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><ellipse cx="${at(60)}" cy="${at(106)}" rx="${at(17)}" ry="${at(11)}" fill="url(#g)"/>`;
};

const shadowBody = (width: number, height: number, strength: number): string =>
  `<defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0.35" stop-color="#000" stop-opacity="${String(strength)}"/><stop offset="0.55" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect width="${String(width)}" height="${String(height)}" fill="url(#s)"/>`;

const hazeBody = (width: number, height: number, strength: number): string =>
  `<defs><linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfe6ee" stop-opacity="${String(strength * 0.6)}"/><stop offset="0.5" stop-color="#f4f7fa" stop-opacity="${String(strength)}"/><stop offset="1" stop-color="#dfe6ee" stop-opacity="${String(strength * 0.6)}"/></linearGradient></defs><rect width="${String(width)}" height="${String(height)}" fill="url(#h)"/>`;

export function lightingOverlays(
  width: number,
  height: number,
  lighting: CardLighting,
): { input: Buffer }[] {
  const bodies = [
    lighting.shadow > 0 ? shadowBody(width, height, lighting.shadow) : null,
    lighting.haze > 0 ? hazeBody(width, height, lighting.haze) : null,
    lighting.glare > 0 ? glareBody(width, lighting.glare) : null,
  ];
  return bodies
    .filter((body): body is string => body !== null)
    .map((body) => ({ input: svg(width, height, body) }));
}
