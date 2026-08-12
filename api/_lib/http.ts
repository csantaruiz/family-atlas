import type { VercelRequest, VercelResponse } from '@vercel/node'

export function allowCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method !== 'OPTIONS') return false
  allowCors(res)
  res.status(204).end()
  return true
}

export function sendError(res: VercelResponse, status: number, error: string): void {
  allowCors(res)
  res.status(status).json({ error })
}
