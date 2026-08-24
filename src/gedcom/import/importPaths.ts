export function gedcomImportPathnames(atlasId: string, importId: string): {
  gedcomPath: string
  snapshotPath: string
  activatedSnapshotPath: string
} {
  const atlas = atlasId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const id = importId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const base = `atlases/${atlas}/gedcom-imports/${id}`
  return {
    gedcomPath: `${base}/source.ged`,
    snapshotPath: `${base}/snapshot.json`,
    activatedSnapshotPath: `${base}/activated-snapshot.json`,
  }
}

export function isPrivateImportPath(pathname: string, atlasId: string): boolean {
  const atlas = atlasId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return pathname.startsWith(`atlases/${atlas}/gedcom-imports/`) && !pathname.startsWith('http')
}
