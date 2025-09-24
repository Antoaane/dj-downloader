import { Router } from 'express'
import { spawn } from 'child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

const router = Router()

const QUAL = new Set(['Normal','High','HiFi','Master'])
const OUTPUT_BASE = process.env.OUTPUT_BASE || 'downloads'
const WORKDIR = process.env.WORKDIR || path.resolve('./work')
const TIDAL_CMD = process.env.TIDAL_CMD || 'tidal-dl'

// Sanitize très basique pour dossiers
const ILLEGAL = /[<>:"/\\|?*\u0000-\u001F]/g
const sanitize = s => String(s).replace(ILLEGAL, '_').trim()

async function writeLinksFile(links) {
  await fs.mkdir(WORKDIR, { recursive: true })
  const file = path.join(WORKDIR, `links-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
  await fs.writeFile(file, links.join('\n'), 'utf8')
  return file
}

function spawnJob({ quality, listPath, output }) {
  const args = (TIDAL_CMD === 'py')
    ? ['-m', 'tidal_dl', '-q', quality, '-l', listPath, '-o', output]
    : ['-q', quality, '-l', listPath, '-o', output]

  const child = spawn(TIDAL_CMD, args, { stdio: 'ignore', shell: false })
  child.on('close', async () => {
    try { await fs.unlink(listPath) } catch {}
  })
}

router.post('/jobs', async (req, res) => {
  const jobs = Array.isArray(req.body?.jobs) ? req.body.jobs : []
  if (!jobs.length) return res.status(400).json({ error: 'no jobs' })

  const accepted = []
  for (const raw of jobs) {
    const quality = String(raw.quality || '').trim()
    const links = Array.isArray(raw.links) ? raw.links.filter(Boolean) : []
    const out = sanitize(raw.output || OUTPUT_BASE)

    if (!QUAL.has(quality)) continue
    if (!links.length) continue
    if (out.includes('..')) continue

    // Assure l’existence du dossier de sortie
    await fs.mkdir(out, { recursive: true })

    const listPath = await writeLinksFile(links)
    spawnJob({ quality, listPath, output: out })
    accepted.push({ quality, output: out, count: links.length })
  }

  res.json({ accepted: accepted.length, details: accepted })
})

export default router
