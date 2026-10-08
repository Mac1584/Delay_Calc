// Presets are assumptions for planning, not measured product specifications.
export const DEFAULTS = {
  version: '1.0.0',
  encoders: {
    hevc: { label: 'Generic HEVC / H.265', encodeMs: 150, decodeMs: 10 },
    avc: { label: 'Generic AVC / H.264', encodeMs: 100, decodeMs: 10 },
    jpegxs: { label: 'Generic JPEG XS', encodeMs: 8, decodeMs: 8 },
    custom: { label: 'Custom', encodeMs: 0, decodeMs: 0 },
  },
  transports: {
    geo: 300,
    leo: 60,
    internetLocal: 15,
    internetRegional: 30,
    internetLong: 60,
    custom: 0,
  },
  assumptions: {
    lightSpeedKmS: 299792.458,
    fiberSpeedFraction: 0.65,
    fiberRouteFactor: 1.25,
    microwaveSpeedFraction: 0.99,
    displayMs: 15,
    frameRate: 60,
  },
  units: { kmPerMile: 1.609344 },
};
