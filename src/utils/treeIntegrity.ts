import type { Person } from '../types'
import type { FocusTreeLayout } from './buildFocusTreeLayout'

type IntegrityContext = {
  directChildIds: Set<string>
  focalPair: string[]
}

function hasParentChildConnector(
  connectors: FocusTreeLayout['connectors'],
  parentId: string,
  childId: string,
) {
  return connectors.some((c) => {
    if (c.kind !== 'parent-child') return false
    if (c.id === `pc-${parentId}-${childId}`) return true
    if (c.id.startsWith('pc-union-') && c.id.endsWith(`-${childId}`)) {
      const rest = c.id.slice('pc-union-'.length, -(childId.length + 1))
      return rest.split('_').includes(parentId)
    }
    // Focal-union shorthand: primary id may stand in for either parent.
    return false
  })
}

/**
 * Dev-only sanity checks for focus-tree layout integrity.
 */
export function assertFocusTreeIntegrity(
  layout: FocusTreeLayout,
  peopleById: Record<string, Person>,
  ctx: IntegrityContext,
) {
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) return

  const warn = (message: string) => {
    console.warn(`[tree-integrity] ${message}`)
  }

  const ids = layout.nodes.map((n) => n.person.id)
  if (new Set(ids).size !== ids.length) {
    warn('Duplicate person IDs in rendered nodes')
  }

  const visible = new Set(ids)
  const positions = new Map(layout.nodes.map((n) => [n.person.id, { x: n.x, y: n.y }]))

  for (const node of layout.nodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      warn(`Person ${node.person.id} has non-finite position`)
    }
  }

  for (const connector of layout.connectors) {
    if (!connector.path || /NaN|undefined|Infinity/.test(connector.path)) {
      warn(`Connector ${connector.id} has invalid path: ${connector.path}`)
      continue
    }
    if (connector.kind === 'continuation') {
      warn(`Continuation connectors must not exist — overlays only (${connector.id})`)
    }
  }

  // Every visible canonical parent→child must have a connector.
  for (const childId of visible) {
    const child = peopleById[childId]
    if (!child) continue
    const visibleParents = (child.parents ?? []).filter((pid) => visible.has(pid))
    if (!visibleParents.length) continue

    const covered = visibleParents.every(
      (parentId) =>
        hasParentChildConnector(layout.connectors, parentId, childId) ||
        // Union from spouse pair: accept if any union connector ends at child
        // and includes this parent, OR a couple+union from the other visible parent.
        layout.connectors.some(
          (c) =>
            c.kind === 'parent-child' &&
            c.id.startsWith('pc-union-') &&
            c.id.endsWith(`-${childId}`) &&
            c.id.includes(parentId),
        ),
    )

    // Also accept single drop from one visible parent when only one parent is placed,
    // or union covering all visible parents.
    const union = layout.connectors.find(
      (c) => c.kind === 'parent-child' && c.id.startsWith('pc-union-') && c.id.endsWith(`-${childId}`),
    )
    const singles = visibleParents.filter((parentId) =>
      hasParentChildConnector(layout.connectors, parentId, childId),
    )

    if (union) {
      const parentPart = union.id.slice('pc-union-'.length, -(childId.length + 1))
      const inUnion = parentPart.split('_')
      for (const parentId of visibleParents) {
        if (!inUnion.includes(parentId)) {
          warn(
            `Missing parent-child connector: ${parentId} → ${childId} (parent-child)`,
          )
        }
      }
    } else if (singles.length < visibleParents.length && visibleParents.length === 1) {
      if (!singles.length) {
        warn(`Missing parent-child connector: ${visibleParents[0]} → ${childId} (parent-child)`)
      }
    } else if (!union && visibleParents.length >= 2) {
      // Expect either union or individual edges from each parent.
      for (const parentId of visibleParents) {
        if (!hasParentChildConnector(layout.connectors, parentId, childId)) {
          warn(`Missing parent-child connector: ${parentId} → ${childId} (parent-child)`)
        }
      }
    } else if (!covered && !union && !singles.length) {
      warn(
        `Missing parent-child connector(s) for child ${childId} from [${visibleParents.join(', ')}]`,
      )
    }
  }

  for (const overlay of layout.parentsOverlays) {
    if (!visible.has(overlay.personId)) {
      warn(`Parents overlay for non-visible person ${overlay.personId}`)
    }
    if (overlay.parentIds.some((id) => visible.has(id))) {
      warn(`Parents overlay on ${overlay.personId} while a parent is visible`)
    }
    if (!Number.isFinite(overlay.x) || !Number.isFinite(overlay.y)) {
      warn(`Parents overlay on ${overlay.personId} has non-finite position`)
    }
  }

  const sampleChild = layout.nodes.find((n) => ctx.directChildIds.has(n.person.id))
  const rowY = sampleChild?.y
  if (rowY != null && layout.pathTowardHome.length > 2) {
    for (const pathId of layout.pathTowardHome) {
      if (layout.focusIds.includes(pathId)) continue
      if (ctx.directChildIds.has(pathId)) continue
      const node = positions.get(pathId)
      if (node && Math.abs(node.y - rowY) < 2) {
        warn(`Path member ${pathId} shares focal child row (sibling-row artifact)`)
      }
    }
  }
}
