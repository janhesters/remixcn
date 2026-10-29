// Measures colors as the browser paints them, for contrast checks in
// end-to-end tests: a canvas resolves every color syntax, translucent
// backgrounds and all, to sRGB bytes.
import type { Page } from 'playwright'

/** Paints each element's background and text on a canvas, as the browser composites them, and returns sRGB bytes. */
export function paintColors(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((elements) => {
    let canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    let context = canvas.getContext('2d', { willReadFrequently: true })!
    let paint = (color: string) => {
      // A canvas that can't parse a color keeps its previous fill, so fail instead of measuring that.
      context.fillStyle = '#010203'
      context.fillStyle = color
      if (context.fillStyle === '#010203') throw new Error(`The canvas can't paint ${color}`)
      context.fillRect(0, 0, 1, 1)
    }
    let read = () => [...context.getImageData(0, 0, 1, 1).data]
    let isOpaque = (color: string) => {
      context.clearRect(0, 0, 1, 1)
      paint(color)
      return read()[3] === 255
    }

    return elements.map((element) => {
      let layers: string[] = []
      for (let node: Element | null = element; node; node = node.parentElement) {
        let background = getComputedStyle(node).backgroundColor
        layers.unshift(background)
        if (isOpaque(background)) break
      }
      context.clearRect(0, 0, 1, 1)
      for (let layer of layers) paint(layer)
      let background = read()
      paint(getComputedStyle(element).color)
      return {
        label: `${element.getAttribute('data-slot')}: ${element.textContent?.trim().slice(0, 30)}`,
        background,
        text: read(),
      }
    })
  })
}

/** Turns the sRGB bytes paintColors returns into a color for contrastRatio. */
export const toRgba = ([r, g, b]: number[]) => ({ r: r / 255, g: g / 255, b: b / 255, alpha: 1 })
