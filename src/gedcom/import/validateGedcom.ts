import { MAX_GEDCOM_BYTES } from './constants'

export type GedcomValidationFailure = {
  ok: false
  code: 'empty' | 'too_large' | 'malformed'
  message: string
}

export type GedcomValidationSuccess = {
  ok: true
  text: string
}

export function decodeGedcomBytes(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

export function validateGedcomBytes(bytes: Uint8Array): GedcomValidationFailure | GedcomValidationSuccess {
  if (bytes.byteLength === 0) {
    return { ok: false, code: 'empty', message: 'The file is empty.' }
  }
  if (bytes.byteLength > MAX_GEDCOM_BYTES) {
    return {
      ok: false,
      code: 'too_large',
      message: `The file is larger than ${MAX_GEDCOM_BYTES} bytes.`,
    }
  }
  const text = decodeGedcomBytes(bytes).replace(/^\uFEFF/, '')
  if (!text.trim()) {
    return { ok: false, code: 'empty', message: 'The file is empty.' }
  }
  if (!/^0\s+HEAD\b/m.test(text) && !/^0\s+@.+@\s+INDI\b/m.test(text)) {
    return { ok: false, code: 'malformed', message: 'This does not look like a GEDCOM file.' }
  }
  return { ok: true, text }
}
