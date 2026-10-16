import JSEncrypt from 'jsencrypt/bin/jsencrypt.min'

// Optional encryption with a caller-supplied public key. Private keys belong on the server.
export function encrypt(txt, publicKey) {
  if (!publicKey) throw new Error('A public key is required')
  const encryptor = new JSEncrypt()
  encryptor.setPublicKey(publicKey)
  return encryptor.encrypt(txt)
}
