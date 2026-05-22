#!/usr/bin/env node
/**
 * Render src/app/icon.svg into the PNG sizes the app + PWA + iOS need.
 *
 * Re-run whenever you change the icon SVG:
 *   node scripts/generate-icons.mjs
 *
 * Targets:
 *   - public/apple-touch-icon.png         180×180, green-soft background
 *                                          (iOS adds its own rounded mask;
 *                                          opaque looks best on home screen)
 *   - public/icons/icon-192x192.png       PWA manifest "any maskable"
 *   - public/icons/icon-512x512.png       PWA manifest "any maskable"
 *
 * The maskable PWA icons get a green-soft background flatten so the corners
 * are filled — Android may crop the corners under adaptive-icon masks, and
 * a green corner matches the brand. The favicon (handled separately by
 * Next.js via src/app/icon.svg) keeps its transparent corners.
 */

import sharp from 'sharp'
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SVG_PATH = join(ROOT, 'src/app/icon.svg')

// Light-green fill that matches the inner gradient stop on the SVG — corners
// on maskable icons read as "more green" rather than abruptly transitioning.
const GREEN_SOFT = { r: 197, g: 225, b: 165, alpha: 1 } // #C5E1A5

const TARGETS = [
  {
    out: 'public/apple-touch-icon.png',
    size: 180,
    flatten: GREEN_SOFT,
    note: 'iOS home-screen',
  },
  {
    out: 'public/icons/icon-192x192.png',
    size: 192,
    flatten: GREEN_SOFT,
    note: 'PWA maskable',
  },
  {
    out: 'public/icons/icon-512x512.png',
    size: 512,
    flatten: GREEN_SOFT,
    note: 'PWA maskable, splash',
  },
]

async function main() {
  if (!existsSync(SVG_PATH)) {
    console.error(`SVG not found: ${SVG_PATH}`)
    process.exit(1)
  }

  const svgContent = readFileSync(SVG_PATH, 'utf-8')
  const svgBuffer = Buffer.from(svgContent)

  for (const target of TARGETS) {
    const outPath = join(ROOT, target.out)
    mkdirSync(dirname(outPath), { recursive: true })

    // density: 384 gives a clean rasterization at the 512 target; smaller
    // sizes downsample with sharp's high-quality reducer.
    let pipeline = sharp(svgBuffer, { density: 384 }).resize(target.size, target.size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })

    if (target.flatten) {
      pipeline = pipeline.flatten({ background: target.flatten })
    }

    await pipeline.png({ compressionLevel: 9 }).toFile(outPath)
    console.log(`  ✓ ${target.out}  ${target.size}×${target.size}  (${target.note})`)
  }

  console.log('\nDone. Commit the regenerated PNGs alongside any SVG changes.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
