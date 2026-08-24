import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { ManageFamilyTree } from './ManageFamilyTree'

type ManageFamilyTreeContextValue = {
  open: boolean
  openManage: () => void
  closeManage: () => void
}

const ManageFamilyTreeContext = createContext<ManageFamilyTreeContextValue | null>(null)

export function useManageFamilyTree(): ManageFamilyTreeContextValue {
  const value = useContext(ManageFamilyTreeContext)
  if (!value) {
    return { open: false, openManage: () => undefined, closeManage: () => undefined }
  }
  return value
}

export function ManageFamilyTreeRoot({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(
    () => ({
      open,
      openManage: () => setOpen(true),
      closeManage: () => setOpen(false),
    }),
    [open],
  )
  return (
    <ManageFamilyTreeContext.Provider value={value}>
      {children}
      <ManageFamilyTree open={open} onClose={() => setOpen(false)} />
    </ManageFamilyTreeContext.Provider>
  )
}
