// server/routes/tidal.js
import express from 'express'
import axios from 'axios'

const router = express.Router()
const BASE_URL = 'https://openapi.tidal.com/v2'

// Proxy recherche par mots-clés
router.get('/search', async (req, res) => {
  try {
    const { q, countryCode = 'FR' } = req.query
    if (!q) return res.status(400).json({ error: 'Missing q param' })

    const token = req.headers['authorization']?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Missing TIDAL token' })

    const url = `${BASE_URL}/searchResults/${encodeURIComponent(q)}`
    console.log('[TIDAL-BACK][search] URL:', url, 'params:', { countryCode, include: 'tracks', explicitFilter: 'include,exclude' })

    const r = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.api+json' },
      params: { countryCode, include: 'tracks', explicitFilter: 'include,exclude' }
    })

    console.log('[TIDAL-BACK][search] response status:', r.status)
    res.json(r.data)
  } catch (err) {
    console.error('[TIDAL-BACK][search] error:', err.response?.data || err.message)
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message })
  }
})

// Proxy recherche par ISRC
router.get('/tracks', async (req, res) => {
  try {
    const { isrc, countryCode = 'FR' } = req.query
    if (!isrc) return res.status(400).json({ error: 'Missing isrc param' })

    const token = req.headers['authorization']?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Missing TIDAL token' })

    const url = `${BASE_URL}/searchResults/${encodeURIComponent(isrc)}`
    console.log('[TIDAL-BACK][tracks] URL:', url, 'params:', { countryCode, include: 'tracks', explicitFilter: 'include,exclude' })

    const r = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.api+json' },
      params: { countryCode, include: 'tracks', explicitFilter: 'include,exclude' }
    })

    console.log('[TIDAL-BACK][tracks] response status:', r.status)
    res.json(r.data)
  } catch (err) {
    console.error('[TIDAL-BACK][tracks] error:', err.response?.data || err.message)
    res.status(err.response?.status || 500).json(err.response?.data || { error: err.message })
  }
})

export default router
