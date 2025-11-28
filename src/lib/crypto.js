const subtle = window.crypto.subtle

export async function deriveKey(password, salt, iterations = 200000){
  const enc = new TextEncoder()
  const pwKey = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
    pwKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt','decrypt']
  )
  return key
}

export async function encryptWithPassword(plainUint8Array, password){
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const ciphertextBuffer = await subtle.encrypt({name:'AES-GCM', iv}, key, plainUint8Array)
  const ciphertext = new Uint8Array(ciphertextBuffer)
  return { salt, iv, ciphertext }
}

export async function decryptWithPassword({salt, iv, ciphertext}, password){
  const key = await deriveKey(password, salt)
  const plain = await subtle.decrypt({name:'AES-GCM', iv}, key, ciphertext)
  return new Uint8Array(plain)
}
