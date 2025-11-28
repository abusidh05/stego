// IMAGE LSB embedding: use canvas, modify LSB of R,G,B channels per pixel
export async function embedInImage(imageArrayBuffer, payloadUint8Array, options = {}){
  const blob = new Blob([imageArrayBuffer])
  const url = URL.createObjectURL(blob)
  const img = await loadImage(url)
  URL.revokeObjectURL(url)

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const imgd = ctx.getImageData(0,0,canvas.width,canvas.height)
  const data = imgd.data // Uint8ClampedArray

  const capacityBits = canvas.width * canvas.height * 3
  const neededBits = payloadUint8Array.length * 8
  if(neededBits > capacityBits) throw new Error(`Payload too large for this image. Capacity ${Math.floor(capacityBits/8)} bytes, need ${payloadUint8Array.length} bytes.`)

  const payloadBits = []
  for(let i=0;i<payloadUint8Array.length;i++){
    const b = payloadUint8Array[i]
    for(let bit=7;bit>=0;bit--){
      payloadBits.push((b >> bit) & 1)
    }
  }

  let bitIdx = 0
  for(let px=0; px<canvas.width*canvas.height; px++){
    const base = px*4
    for(let channel=0; channel<3; channel++){
      if(bitIdx >= payloadBits.length) break
      const val = data[base + channel]
      data[base + channel] = (val & 0xFE) | payloadBits[bitIdx]
      bitIdx++
    }
    if(bitIdx >= payloadBits.length) break
  }

  ctx.putImageData(imgd,0,0)
  const outBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  return outBlob
}

export async function extractFromImage(imageArrayBuffer){
  const blob = new Blob([imageArrayBuffer])
  const url = URL.createObjectURL(blob)
  const img = await loadImage(url)
  URL.revokeObjectURL(url)

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const imgd = ctx.getImageData(0,0,canvas.width,canvas.height)
  const data = imgd.data

  const bits = []
  for(let i=0;i<data.length;i++){
    const pixChannelIdx = i % 4
    if(pixChannelIdx === 3) continue
    bits.push(data[i] & 1)
  }

  const bytes = new Uint8Array(Math.floor(bits.length/8))
  for(let i=0;i<bytes.length;i++){
    let val = 0
    for(let b=0;b<8;b++){
      val = (val << 1) | bits[i*8 + b]
    }
    bytes[i] = val
  }

  if(bytes.length < 11) throw new Error('Not enough embedded data')
  if(String.fromCharCode(bytes[0],bytes[1],bytes[2],bytes[3]) !== 'STEG') throw new Error('No STEG header found')
  const flags = bytes[4]
  const fnameLen = (bytes[5]<<8) | bytes[6]
  const payloadLen = (bytes[7]<<24) | (bytes[8]<<16) | (bytes[9]<<8) | bytes[10]
  const totalNeeded = 11 + fnameLen + payloadLen
  if(bytes.length < totalNeeded) throw new Error('Incomplete embedded data or wrong carrier (not all bits present)')
  const out = bytes.slice(0, totalNeeded)
  return out
}

export async function embedInWav(wavArrayBuffer, payloadUint8Array, options = {}){
  const parsed = parseWav(new DataView(wavArrayBuffer))
  if(parsed.bitsPerSample !== 16 && parsed.bitsPerSample !== 8) {
    throw new Error('Unsupported WAV sample size. Only 8-bit or 16-bit PCM supported.')
  }
  const numSamples = parsed.dataSamples.length
  const capacityBits = numSamples
  const neededBits = payloadUint8Array.length * 8
  if(neededBits > capacityBits) throw new Error(`Payload too large for this WAV. Capacity ${Math.floor(capacityBits/8)} bytes, need ${payloadUint8Array.length} bytes.`)

  const payloadBits = []
  for(let i=0;i<payloadUint8Array.length;i++){
    const b = payloadUint8Array[i]
    for(let bit=7;bit>=0;bit--){
      payloadBits.push((b >> bit) & 1)
    }
  }

  const samples = parsed.dataSamples.slice()
  for(let i=0;i<payloadBits.length;i++){
    const v = samples[i]
    const newV = (v & ~1) | payloadBits[i]
    samples[i] = newV
  }

  const outBuffer = makeWavFromSamples(parsed, samples)
  const blob = new Blob([outBuffer], {type:'audio/wav'})
  return blob
}

export async function extractFromWav(wavArrayBuffer){
  const parsed = parseWav(new DataView(wavArrayBuffer))
  const samples = parsed.dataSamples
  const bits = new Uint8Array(samples.length)
  for(let i=0;i<samples.length;i++){
    bits[i] = samples[i] & 1
  }
  const bytes = new Uint8Array(Math.floor(bits.length/8))
  for(let i=0;i<bytes.length;i++){
    let v=0
    for(let b=0;b<8;b++){
      v = (v<<1) | bits[i*8 + b]
    }
    bytes[i] = v
  }
  if(bytes.length < 11) throw new Error('Not enough embedded data')
  if(String.fromCharCode(bytes[0],bytes[1],bytes[2],bytes[3]) !== 'STEG') throw new Error('No STEG header found')
  const fnameLen = (bytes[5]<<8) | bytes[6]
  const payloadLen = (bytes[7]<<24) | (bytes[8]<<16) | (bytes[9]<<8) | bytes[10]
  const totalNeeded = 11 + fnameLen + payloadLen
  if(bytes.length < totalNeeded) throw new Error('Incomplete embedded data')
  const out = bytes.slice(0, totalNeeded)
  return out
}

/* Helpers */
function loadImage(url){
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = ()=>res(img)
    img.onerror = (e)=>rej(new Error('Failed to load image'))
    img.src = url
  })
}

/* WAV parsing & making functions */
export function parseWav(dv){
  if(String.fromCharCode(dv.getUint8(0),dv.getUint8(1),dv.getUint8(2),dv.getUint8(3)) !== 'RIFF') throw new Error('Not a RIFF file')
  if(String.fromCharCode(dv.getUint8(8),dv.getUint8(9),dv.getUint8(10),dv.getUint8(11)) !== 'WAVE') throw new Error('Not a WAVE file')
  let offset = 12
  let fmt = null
  let dataOffset = null
  let dataSize = null
  while(offset < dv.byteLength){
    const chunkId = String.fromCharCode(dv.getUint8(offset), dv.getUint8(offset+1), dv.getUint8(offset+2), dv.getUint8(offset+3))
    const chunkSize = dv.getUint32(offset+4, true)
    if(chunkId === 'fmt '){
      const audioFormat = dv.getUint16(offset+8, true)
      const numChannels = dv.getUint16(offset+10, true)
      const sampleRate = dv.getUint32(offset+12, true)
      const byteRate = dv.getUint32(offset+16, true)
      const blockAlign = dv.getUint16(offset+20, true)
      const bitsPerSample = dv.getUint16(offset+22, true)
      fmt = { audioFormat, numChannels, sampleRate, byteRate, blockAlign, bitsPerSample }
    } else if(chunkId === 'data'){
      dataOffset = offset + 8
      dataSize = chunkSize
      break
    }
    offset += (8 + chunkSize)
  }
  if(!fmt) throw new Error('fmt chunk not found')
  if(dataOffset === null) throw new Error('data chunk not found')
  const bitsPerSample = fmt.bitsPerSample
  const numSamples = dataSize * 8 / bitsPerSample
  let samples
  if(bitsPerSample === 16){
    samples = new Int16Array(numSamples)
    let pos = dataOffset
    let idx = 0
    while(pos < dataOffset + dataSize){
      samples[idx++] = dv.getInt16(pos, true)
      pos += 2
    }
  } else if(bitsPerSample === 8){
    samples = new Uint8Array(numSamples)
    let pos = dataOffset
    let idx = 0
    while(pos < dataOffset + dataSize){
      samples[idx++] = dv.getUint8(pos)
      pos += 1
    }
  } else {
    throw new Error('Unsupported bits per sample')
  }
  return {
    sampleRate: fmt.sampleRate,
    numChannels: fmt.numChannels,
    bitsPerSample: fmt.bitsPerSample,
    dataOffset,
    dataSize,
    dataSamples: samples,
    fmt
  }
}

export function makeWavFromSamples(parsed, samples){
  const bitsPerSample = parsed.bitsPerSample
  const numChannels = parsed.numChannels
  const sampleRate = parsed.sampleRate
  const bytesPerSample = bitsPerSample / 8
  const dataSize = samples.length * bytesPerSample
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const headerSize = 44
  const buffer = new ArrayBuffer(headerSize + dataSize)
  const dv = new DataView(buffer)
  writeString(dv, 0, 'RIFF')
  dv.setUint32(4, 36 + dataSize, true)
  writeString(dv, 8, 'WAVE')
  writeString(dv, 12, 'fmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true)
  dv.setUint16(22, numChannels, true)
  dv.setUint32(24, sampleRate, true)
  dv.setUint32(28, byteRate, true)
  dv.setUint16(32, blockAlign, true)
  dv.setUint16(34, bitsPerSample, true)
  writeString(dv, 36, 'data')
  dv.setUint32(40, dataSize, true)
  let offset = 44
  if(bitsPerSample === 16){
    for(let i=0;i<samples.length;i++){
      dv.setInt16(offset, samples[i], true)
      offset += 2
    }
  } else if(bitsPerSample === 8){
    for(let i=0;i<samples.length;i++){
      dv.setUint8(offset, samples[i])
      offset += 1
    }
  }
  return buffer
}

function writeString(dv, offset, str){
  for(let i=0;i<str.length;i++){
    dv.setUint8(offset + i, str.charCodeAt(i))
  }
}
