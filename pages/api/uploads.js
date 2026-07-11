import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { getCurrentUser } from '../../src/lib/auth.js'

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'wgd-portal-uploads')

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  const user = getCurrentUser(req)
  if (!user) return res.status(401).json({ error: 'unauthorized' })

  // Use busboy to parse multipart
  const Busboy = (await import('busboy')).default
  const bb = Busboy({ headers: req.headers, limits: { fileSize: 25 * 1024 * 1024 } })

  await fs.mkdir(UPLOAD_DIR, { recursive: true })

  const result = await new Promise((resolve, reject) => {
    const files = []
    bb.on('file', (_name, stream, info) => {
      // Browser typically sends UTF-8 bytes in the filename field but no `filename*` header,
      // so busboy interprets them as latin1. Reinterpret as UTF-8 to recover the original name.
      const rawName = info.filename
      let decoded = rawName
      try {
        const buf = Buffer.from(rawName, 'latin1')
        const candidate = buf.toString('utf8')
        // Round-trip check: re-encoding utf8 → latin1 should match the original
        if (Buffer.from(candidate, 'utf8').toString('latin1') === rawName) {
          decoded = candidate
        }
      } catch {
        /* keep original */
      }
      info.filename = decoded
      const chunks = []
      stream.on('data', (c) => chunks.push(c))
      stream.on('end', () => {
        files.push({ info, buffer: Buffer.concat(chunks) })
      })
    })
    bb.on('finish', async () => {
      try {
        if (files.length === 0) return resolve(null)
        const f = files[0]
        const ext = f.info.filename.includes('.') ? '.' + f.info.filename.split('.').pop() : ''
        const id = crypto.randomUUID()
        const filename = `${id}${ext}`
        const fp = path.join(UPLOAD_DIR, filename)
        await fs.writeFile(fp, f.buffer)
        resolve({
          uploadId: id,
          filename: f.info.filename,
          storedAs: filename,
          mimeType: f.info.mimeType,
          size: f.buffer.length,
        })
      } catch (e) {
        reject(e)
      }
    })
    bb.on('error', reject)
    req.pipe(bb)
  })

  if (!result) return res.status(400).json({ error: 'no_file' })
  return res.status(201).json(result)
}