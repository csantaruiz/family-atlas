import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Phase 3.0 welcome / ending visitor copy', () => {
  it('uses Explore Our Family Story as the primary Atlas entry CTA', () => {
    const welcome = readFileSync(
      join(process.cwd(), 'src/documentary-engine/components/EngineWelcome.tsx'),
      'utf8',
    )
    const ending = readFileSync(
      join(process.cwd(), 'src/documentary-engine/components/EngineEnding.tsx'),
      'utf8',
    )
    expect(welcome).toContain('Explore Our Family Story')
    expect(welcome).toContain('Begin Documentary')
    expect(welcome).toContain('ancestors, historical events, and geographic journeys')
    expect(welcome).not.toContain('from Cheshire to')
    expect(ending).toContain('Explore Our Family Story')
  })

  it('does not force-complete journey intro when preparing Atlas entry', () => {
    const engine = readFileSync(
      join(process.cwd(), 'src/documentary-engine/context/DocumentaryEngineContext.tsx'),
      'utf8',
    )
    expect(engine).toContain('prepareAtlasEntry')
    expect(engine).not.toMatch(/prepareAtlasEntry[\s\S]*completeIntro\(\)/)
  })
})
