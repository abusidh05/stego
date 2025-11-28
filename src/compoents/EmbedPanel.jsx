import React, { useState, useRef } from 'react'
import * as Stego from '../lib/stego'
import * as Crypto from '../lib/crypto'
import { readFileAsArrayBuffer, estimateCapacity } from '../lib/utils'

export default function EmbedPanel({ pushHistory }){
  const [carrierFile, setCarrierFile] = useState(null)
  const [carrierType, setCarrierType] = useState(null)
  const [mode, setMode] = useState('text')
  const [secretText, setSecretText] = useState('')
  const [secretFile, setSecretFile] = useState(null)
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState({msg:'', type:''})
  const [capacityInfo, setCapacityInfo] = useState(null)
  const fileInputRef = useRef()

  async function handleCarrierSelected(f){
    setStatus({msg:'', type:''})
    setCarrierFile(f)
    if(!f) return
    // detect type by MIME or extension
    if(f.type && f.type.startsWith('image/')) setCarrierType('image')
    else if(f.type === 'audio/wav' || f.name.toLowerCase().endsWith('.wav')) setCarrierType('audio')
    else setCarrierType(null)

    try{
      const ab = await readFileAsArrayBuffer(f)
      const estimate = await estimateCapacity(ab, carrierType || (f.type && f.type.startsWith('image/') ? 'image' : 'audio'))
      setCapacityInfo(estimate)
      setStatus({msg:`Carrier loaded (${f.name}, ${Math.round(f.size/1024)} KB). Capacity: ${estimate.human}`, type:'ok'})
    }catch(e){
      setCapacityInfo(null)
      setStatus({msg:'Failed to read carrier: '+e.message, type:'err'})
    }
  }

  // drag-drop
  function onCarrierDrop(e){
    e.preventDefault()
    if(e.dataTransfer.files && e.dataTransfer.files.length){
      handleCarrierSelected(e.dataTransfer.files[0])
    }
  }

  async function onEmbed(){
    setStatus({msg:'Processing...', type:''})
    try{
      if(!carrierFile) throw new Error('No carrier file selected')
      let payloadBytes, filename=null, isText=false
      if(mode === 'text'){
        isText = true
        payloadBytes = new TextEncoder().encode(secretText || '')
        filename = ''
      }else{
        if(!secretFile) throw new Error('No secret file selected')
        const ab = await readFileAsArrayBuffer(secretFile)
        payloadBytes = new Uint8Array(ab)
        filename = secretFile.name
      }

      let encrypted = false
      if(password && password.length){
        const encryptedObj = await Crypto.encryptWithPassword(payloadBytes, password)
        const combined = new Uint8Array(encryptedObj.salt.length + encryptedObj.iv.length + encryptedObj.ciphertext.length)
        combined.set(encryptedObj.salt, 0)
        combined.set(encryptedObj.iv, encryptedObj.salt.length)
        combined.set(encryptedObj.ciphertext, encryptedObj.salt.length + encryptedObj.iv.length)
        payloadBytes = combined
        encrypted = true
      }

      const magic = [0x53,0x54,0x45,0x47]
      const flags = (isText ? 1 : 0) | (encrypted ? 0x80 : 0)
      const filenameBytes = filename ? new TextEncoder().encode(filename) : new Uint8Array(0)
      const filenameLen = filenameBytes.length
      const payloadLen = payloadBytes.length

      const header = new Uint8Array(11)
      header.set(magic,0)
      header[4] = flags
      header[5] = (filenameLen >> 8) & 0xff
      header[6] = filenameLen & 0xff
      header[7] = (payloadLen >> 24) & 0xff
      header[8] = (payloadLen >> 16) & 0xff
      header[9] = (payloadLen >> 8) & 0xff
      header[10] = (payloadLen) & 0xff

      const total = new Uint8Array(header.length + filenameBytes.length + payloadBytes.length)
      total.set(header, 0)
      total.set(filenameBytes, header.length)
      total.set(payloadBytes, header.length + filenameBytes.length)

      const carrierAb = await readFileAsArrayBuffer(carrierFile)

      let outBlob
      if(carrierType === 'image'){
        outBlob = await Stego.embedInImage(carrierAb, total, { outputFilename: `stego-${carrierFile.name}.png` })
      }else if(carrierType === 'audio'){
        outBlob = await Stego.embedInWav(carrierAb, total, { outputFilename: `stego-${carrierFile.name}` })
      }else{
        throw new Error('Unsupported carrier type')
      }

      const url = URL.createObjectURL(outBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = carrierType === 'image' ? `stego-${carrierFile.name}.png` : `stego-${carrierFile.name}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setStatus({msg:`Embedded ${mode === 'text' ? 'text' : 'file'} into ${carrierFile.name}. Encrypted: ${encrypted ? 'Yes' : 'No'}`, type:'ok'})
      pushHistory({op:'embed', carrier:carrierFile.name, payloadType: mode === 'text' ? 'text' : secretFile?.name || 'file', encrypted})
    }catch(e){
      console.error(e)
      setStatus({msg: e.message || 'Failed', type:'err'})
    }
  }

  return (
    <div>
      <div className="panel-desc">Hide text or a file inside a PNG image or WAV audio. Optional password encryption.</div>

      <div className="controls">
        <div className="row">
          <div className="field watermark" data-watermark="Watermark: Drop carrier file here or click to select" style={{flex:1}}>
            <label className="help">Carrier file (PNG preferred / WAV)</label>
            <input ref={fileInputRef} type="file" accept=".png,image/*,.wav,audio/wav" onChange={e=>handleCarrierSelected(e.target.files[0])}/>
            <div onDrop={onCarrierDrop} onDragOver={(e)=>e.preventDefault()} className="help">Or drag & drop carrier file here</div>
          </div>
          <div style={{minWidth:150,display:'flex',flexDirection:'column',gap:6}}>
            <div className="capacity">{capacityInfo ? `Capacity: ${capacityInfo.human}` : 'Capacity: —'}</div>
            <div className="help">Carrier type: {carrierType || '—'}</div>
          </div>
        </div>

        <div style={{display:'flex',gap:8}}>
          <button className={`small ${mode==='text' ? '' : 'secondary'}`} onClick={()=>setMode('text')}>Text Mode</button>
          <button className={`small ${mode==='file' ? '' : 'secondary'}`} onClick={()=>setMode('file')}>File Mode</button>
        </div>

        {mode === 'text' ? (
          <div className="field watermark" data-watermark="Watermark: Secret text appears here">
            <div className="help">Enter secret text to embed</div>
            <textarea value={secretText} onChange={e=>setSecretText(e.target.value)} placeholder="Type or paste secret text here..." />
          </div>
        ) : (
          <div className="field watermark" data-watermark="Watermark: Choose secret file">
            <label className="help">Select secret file</label>
            <input type="file" onChange={e=>setSecretFile(e.target.files[0])} />
            <div className="help">{secretFile ? `${secretFile.name} (${Math.round(secretFile.size/1024)} KB)` : 'No file selected'}</div>
          </div>
        )}

        <div className="field watermark" data-watermark="Watermark: Password (optional)">
          <label className="help">Password (Optional – used for encryption)</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (Optional)" />
        </div>

        <div style={{display:'flex',gap:8}}>
          <button onClick={onEmbed}>Embed</button>
          <button className="secondary" onClick={()=>{
            setCarrierFile(null); setSecretFile(null); setSecretText(''); setPassword(''); setStatus({msg:'',type:''}); setCapacityInfo(null)
          }}>Clear</button>
        </div>

        <div className="output">
          { status.msg ? <div className={status.type==='ok' ? 'ok' : status.type==='err' ? 'err' : ''}>{status.msg}</div> : <div className="help">Status messages appear here.</div> }
        </div>
      </div>
    </div>
  )
}
