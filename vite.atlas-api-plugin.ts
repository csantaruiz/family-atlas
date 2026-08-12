import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'

type VercelLikeReq = IncomingMessage & {
  query: Record<string, string | string[]>
  body: unknown
  cookies: Record<string, string>
}

type VercelLikeRes = ServerResponse & {
  status: (code: number) => VercelLikeRes
  json: (body: unknown) => VercelLikeRes
  send: (body: unknown) => VercelLikeRes
}

function parseQuery(url: string): Record<string, string> {
  const query: Record<string, string> = {}
  const q = url.split('?')[1]
  if (!q) return query
  for (const [key, value] of new URLSearchParams(q)) query[key] = value
  return query
}

function collectBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function wrapRes(res: ServerResponse): VercelLikeRes {
  const wrapped = res as VercelLikeRes
  wrapped.status = (code: number) => {
    res.statusCode = code
    return wrapped
  }
  wrapped.json = (body: unknown) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
    return wrapped
  }
  wrapped.send = (body: unknown) => {
    if (Buffer.isBuffer(body)) {
      res.end(body)
    } else if (typeof body === 'string') {
      res.end(body)
    } else {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(body))
    }
    return wrapped
  }
  return wrapped
}

async function loadHandler(server: ViteDevServer, filePath: string) {
  const mod = await server.ssrLoadModule(filePath)
  return (mod.default ?? mod) as (req: VercelLikeReq, res: VercelLikeRes) => Promise<void>
}

function resolveApiFile(urlPath: string, root: string): { file: string; query: Record<string, string> } | null {
  const [pathname, search = ''] = urlPath.split('?')
  const query = parseQuery(`?${search}`)
  if (pathname === '/api/health') return { file: join(root, 'api/health.ts'), query }
  if (pathname === '/api/unlock' || pathname === '/api/auth/unlock') {
    return { file: join(root, 'api/unlock.ts'), query }
  }
  if (pathname === '/api/media' || pathname === '/api/media/') {
    return { file: join(root, 'api/media/index.ts'), query }
  }
  const mediaMatch = pathname.match(/^\/api\/media\/([^/]+)$/)
  if (mediaMatch) {
    return { file: join(root, 'api/media/[assetId].ts'), query: { ...query, assetId: mediaMatch[1] } }
  }
  return null
}

export function atlasApiPlugin(): Plugin {
  return {
    name: 'atlas-local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/')) {
          next()
          return
        }

        const resolved = resolveApiFile(url.split('#')[0], server.config.root)
        if (!resolved) {
          next()
          return
        }

        try {
          const raw = await collectBody(req)
          let body: unknown = raw.length ? raw.toString('utf8') : undefined
          const contentType = String(req.headers['content-type'] ?? '')
          if (typeof body === 'string' && contentType.includes('application/json')) {
            try {
              body = JSON.parse(body)
            } catch {
              /* keep string */
            }
          }

          const vercelReq = req as VercelLikeReq
          vercelReq.query = resolved.query
          vercelReq.body = body
          vercelReq.cookies = {}

          const handler = await loadHandler(server, resolved.file)
          await handler(vercelReq, wrapRes(res))
          if (!res.writableEnded) res.end()
        } catch (error) {
          console.error('[atlas-local-api]', error)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
          }
          if (!res.writableEnded) {
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : 'Local API error',
              }),
            )
          }
        }
      })
    },
  }
}
