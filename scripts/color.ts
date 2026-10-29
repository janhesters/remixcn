/** A gamma-encoded sRGB color with channels from 0 to 1. */
export interface Rgba {
  r: number
  g: number
  b: number
  alpha: number
}

const oklchPattern = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?)\s*)?\)$/

function readNumber(value: string, percent: string, scale = 1) {
  return percent ? (Number(value) / 100) * scale : Number(value)
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const encode = (linear: number) => (linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055)
const decode = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)

/**
 * Converts an `oklch()` color, the form RemixCN's tokens use, to sRGB with
 * Björn Ottosson's OKLab matrices. Out-of-gamut channels are clipped.
 */
export function parseColor(text: string): Rgba {
  let match = oklchPattern.exec(text.trim())
  if (!match) throw new Error(`Can only measure oklch() colors, got "${text}"`)

  let [, lightness, lightnessPercent, chroma, hue, alpha = '1', alphaPercent] = match
  let l = readNumber(lightness, lightnessPercent)
  let c = Number(chroma)
  let h = (Number(hue) * Math.PI) / 180
  let a = c * Math.cos(h)
  let b = c * Math.sin(h)

  let long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  let medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  let short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3

  return {
    r: encode(clamp(4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short)),
    g: encode(clamp(-1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short)),
    b: encode(clamp(-0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short)),
    alpha: readNumber(alpha, alphaPercent),
  }
}

function luminance({ r, g, b }: Rgba) {
  return 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b)
}

function blend(foreground: Rgba, background: Rgba): Rgba {
  let mix = (top: number, bottom: number) => top * foreground.alpha + bottom * (1 - foreground.alpha)
  return { r: mix(foreground.r, background.r), g: mix(foreground.g, background.g), b: mix(foreground.b, background.b), alpha: 1 }
}

/**
 * Measures WCAG 2 contrast. A translucent foreground is blended over the
 * background first, as browsers paint it.
 */
export function contrastRatio(foreground: Rgba, background: Rgba): number {
  let [lighter, darker] = [luminance(blend(foreground, background)), luminance(background)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}
