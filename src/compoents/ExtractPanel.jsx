import React, { useState } from 'react'
import * as Stego from '../lib/stego'
import * as Crypto from '../lib/crypto'
import { readFileAsArrayBuffer } from '../lib/utils'

export default function ExtractPanel({ pushHistory }){
  const [stegoFile, setStegoFile] = useState(null)
  const [status, setStatus] = useState({msg:'', type:''})
  const [password, setPassword] = useState('')
  const [extractedText, setExtractedText] = useState(null)
  const [extractedFileObj, setExtractedFileObj] = useState(null)
  const [carrierType, setCarrierType] = useState(null)

  async function handleFile(f){
    setStatus({msg:'', type:''})
    setStegoFile(f)
    if(!f) return
    if(f.type && f.type.startsWith('image/')) setCarrierType('image')
    else if(f.type === 'audio/wav' || f.name.toLowerCase().endsWith('.wav')) setCarrierType('audio')
    else setCarrierType(null)
  }

  async function onExtract(){
    setStatus({msg:'Processing...', type:''})
    setExtractedText(null)
    setExtractedFileObj(null)
    try{
      if(!stegoFile) throw new Error('No file selected')
      const ab = await readFileAsArrayBuffer(stegoFile)
      let containerBytes
      if(carrierType === 'image'){
        containerBytes = await Stego.extractFromImage(ab)
      }else if(carrierType === 'audio'){
        containerBytes = await Stego.extractFromWav(ab)
      }else{
        try{
          containerBytes = await Stego.extractFromImage(ab)
        }catch(e){
          containerBytes = await Stego.extractFromWav(ab)
        }
      }

      if(!containerBytes || containerBytes.length < 11) throw new Error('No hidden payload found or corrupted container')

      const flags = containerBytes[4]
      const encrypted = !!(flags & 0x80)
      const isText = !!(flags & 1)
      const fnameLen = (containerBytes[5]<<8) | containerBytes[6]
      const payloadLen = (containerBytes[7]<<24) | (containerBytes[8]<<16) | (containerBytes[9]<<8) | (containerBytes[10])
      const headerLen = 11
      const fnameBytes = containerBytes.slice(headerLen, headerLen + fnameLen)
      const filename = new TextDecoder().decode(fnameBytes)
      const payloadStart = headerLen + fnameLen
      const payload = containerBytes.slice(payloadStart, payloadStart + payloadLen)

      let finalPayload = payload
      if(encrypted){
        if(!password || password.length === 0) throw new Error('Password required to decrypt payload')
        if(payload.length < 28) throw new Error('Encrypted payload too short')
        const salt = payload.slice(0,16)
        const iv = payload.slice(16,28)
        const ciphertext = payload.slice(28)
        const decrypted = await Crypto.decryptWithPassword({salt, iv, ciphertext}, password)
        finalPayload = decrypted
      }

      if(isText){
        const text = new TextDecoder().decode(finalPayload)
        setExtractedText(text)
        setStatus({msg:`Extracted text (${text.length} chars)`, type:'ok'})
        pushHistory({op:'extract', resultType:'text', filename:'', encrypted:encrypted})
      }else{
        const blob = new Blob([finalPayload])
        const name = filename || 'extracted.bin'
        setExtractedFileObj({blob, name})
        setStatus({msg:`Extracted file: ${name} (${Math.round(blob.size/1024)} KB)`, type:'ok'})
        pushHistory({op:'extract', resultType:'file', filename: name, encrypted: encrypted})
      }
    }catch(e){
      console.error(e)
      setStatus({msg: e.message || 'Extraction failed', type:'err'})
    }
  }

  return (
    <div style={{marginTop:16}}>
      <div className="panel-desc">Upload a stego image or WAV file and extract the hidden message/file. Enter password if the payload was encrypted.</div>

      <div className="controls">
        <div className="field watermark" data-watermark="Watermark: Stego file (drop or select)">
          <label className="help">Stego file (PNG/WAV)</label>
          <input type="file" accept=".png,image/*,.wav,audio/wav" onChange={e=>handleFile(e.target.files[0])} />
          <div className="help">Detected type: {carrierType || '—'}</div>
        </div>

        <div className="field watermark" data-watermark="Watermark: Password (if used)">
          <label className="help">Password (if used when embedding)</label>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (Optional)"/>
        </div>

        <div style={{display:'flex',gap:8}}>
          <button onClick={onExtract}>Extract</button>
          <button className="secondary" onClick={()=>{ setStegoFile(null); setPassword(''); setExtractedText(null); setExtractedFileObj(null); setStatus({msg:'',type:''}) }}>Clear</button>
        </div>

        <div className="output">
          { status.msg ? <div className={status.type === 'ok' ? 'ok' : status.type === 'err' ? 'err' : ''}>{status.msg}</div> : <div className="help">Extraction status appears here.</div> }
          { extractedText && (
            <div style={{marginTop:10}}>
              <div className="help">Extracted text:</div>
              <textarea readOnly value={extractedText} />
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button onClick={()=>navigator.clipboard.writeText(extractedText)}>Copy</button>
              </div>
            </div>
          )}
          { extractedFileObj && (
            <div style={{marginTop:10}}>
              <div className="help">Extracted file: {extractedFileObj.name}</div>
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <a href={URL.createObjectURL(extractedFileObj.blob)} download={extractedFileObj.name}><button>Download file</button></a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
