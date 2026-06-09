#!/usr/bin/env node
// Generate PNG icons using raw bytes + zlib (no external deps)
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

function writePNG(filePath, width, height, pixelFn) {
  // pixelFn(x, y) => [r, g, b, a]
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const crcBuf = Buffer.alloc(4)
    const crcData = Buffer.concat([typeBuf, data])
    let crc = 0xffffffff
    const table = []
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
      table[i] = c
    }
    for (let i = 0; i < crcData.length; i++) crc = table[(crc ^ crcData[i]) & 0xff] ^ (crc >>> 8)
    crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
    return Buffer.concat([len, crcBuf.slice(0, 0), typeBuf, data, crcBuf])
    // actually: len | type | data | crc
  }

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const crcData = Buffer.concat([typeBuf, data])
    let crc = 0xffffffff
    const table = []
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
      table[i] = c
    }
    for (let i = 0; i < crcData.length; i++) crc = table[(crc ^ crcData[i]) & 0xff] ^ (crc >>> 8)
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
    return Buffer.concat([len, typeBuf, data, crcBuf])
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type RGB (we'll use RGBA so 6)
  ihdr[9] = 6  // RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // Image data
  const rawData = []
  for (let y = 0; y < height; y++) {
    rawData.push(0) // filter type none
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y)
      rawData.push(r, g, b, a)
    }
  }
  const rawBuf = Buffer.from(rawData)
  const compressed = zlib.deflateSync(rawBuf, { level: 6 })

  const png = Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
  fs.writeFileSync(filePath, png)
  console.log(`Written: ${filePath} (${width}x${height})`)
}

function makeIconPixel(size) {
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2
  const borderW = Math.round(size * 0.04)

  // Colors
  const green = [27, 94, 32]    // #1B5E20
  const red = [183, 28, 28]     // #B71C1C
  const white = [255, 255, 255]
  const transparent = [0, 0, 0, 0]

  return function(x, y) {
    const dx = x - cx
    const dy = y - cy
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Outside circle
    if (dist > radius) return [0, 0, 0, 0]

    // Red border ring
    if (dist > radius - borderW) return [...red, 255]

    // Green background
    const innerRadius = radius - borderW

    // Draw letter "R" centered
    // Simple pixel "R" at center
    const lx = dx / innerRadius  // -1 to 1
    const ly = dy / innerRadius  // -1 to 1

    // Letter R bounding box: roughly -0.25 to 0.25 wide, -0.45 to 0.45 tall
    const charW = 0.28
    const charH = 0.55
    const strokeW = 0.08

    // Check if pixel is in letter R
    // Vertical bar (left side)
    if (lx >= -charW && lx <= -charW + strokeW && ly >= -charH && ly <= charH) {
      return [...white, 255]
    }

    // Top horizontal bar
    if (lx >= -charW && lx <= charW && ly >= -charH && ly <= -charH + strokeW) {
      return [...white, 255]
    }

    // Middle horizontal bar
    if (lx >= -charW && lx <= charW * 0.8 && ly >= -strokeW/2 && ly <= strokeW/2) {
      return [...white, 255]
    }

    // Top-right curve (right side of upper bowl)
    if (lx >= charW - strokeW && lx <= charW && ly >= -charH && ly <= 0) {
      return [...white, 255]
    }

    // Diagonal leg going bottom-right
    const legSlope = (ly - 0) / (lx - (-charW + strokeW))
    if (lx >= -charW + strokeW && lx <= charW + 0.05 && ly >= 0 && ly <= charH) {
      // Line from (-charW+strokeW, 0) to (charW+0.05, charH)
      const expectedLx = (-charW + strokeW) + (ly / charH) * (charW + 0.05 - (-charW + strokeW))
      if (Math.abs(lx - expectedLx) < strokeW / 1.5) {
        return [...white, 255]
      }
    }

    return [...green, 255]
  }
}

const publicDir = path.join(__dirname, 'public')

writePNG(path.join(publicDir, 'icon-192.png'), 192, 192, makeIconPixel(192))
writePNG(path.join(publicDir, 'icon-512.png'), 512, 512, makeIconPixel(512))
writePNG(path.join(publicDir, 'apple-touch-icon.png'), 180, 180, makeIconPixel(180))

console.log('All icons generated!')
