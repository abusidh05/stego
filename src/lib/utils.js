export function readFileAsArrayBuffer(file){
  return new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = ()=>res(fr.result)
    fr.onerror = ()=>rej(fr.error)
    fr.readAsArrayBuffer(file)
  })
}

export function readFileAsText(file){
  return new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = ()=>res(fr.result)
    fr.onerror = ()=>rej(fr.error)
    fr.readAsText(file)
  })
}

export async function estimateCapacity(arrayBuffer, type){
  if(!type){
    try{
      const riff = String.fromCharCode(...new Uint8Array(arrayBuffer.slice(0,4)))
      if(riff === 'RIFF') type='audio'
      else type='image'
    }catch(e){
      type='image'
    }
  }
  if(type === 'audio'){
    const dv = new DataView(arrayBuffer)
    const dataChunkPos = findDataChunkPos(dv)
    if(!dataChunkPos) return {bits:0,bytes:0,human:'Unknown'}
    const bitsPerSample = dv.getUint16(34, true)
    const dataChunkSize = dv.getUint32(dataChunkPos+4, true)
    const numSamples = dataChunkSize * 8 / bitsPerSample
    const capacityBits = Math.floor(numSamples)
    const capacityBytes = Math.floor(capacityBits/8)
    return { bits: capacityBits, bytes: capacityBytes, human: `${capacityBytes} bytes (~${Math.round(capacityBytes/1024)} KB)` }
  }else{
    const blob = new Blob([arrayBuffer])
    const url = URL.createObjectURL(blob)
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img,0,0)
    const pixels = canvas.width * canvas.height
    const capacityBits = pixels * 3
    const capacityBytes = Math.floor(capacityBits/8)
    URL.revokeObjectURL(url)
    return { bits: capacityBits, bytes: capacityBytes, human: `${capacityBytes} bytes (~${Math.round(capacityBytes/1024)} KB)` }
  }

  function findDataChunkPos(dv){
    for(let i=12;i<dv.byteLength-8;i++){
      if(String.fromCharCode(dv.getUint8(i), dv.getUint8(i+1), dv.getUint8(i+2), dv.getUint8(i+3)) === 'data'){
        return i
      }
    }
    return null
  }

  function loadImage(url){
    return new Promise((res, rej) => {
      const img = new Image()
      img.onload = ()=>{res(img)}
      img.onerror = (e)=>rej(e)
      img.src = url
    })
  }
}
