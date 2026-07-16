import { useState } from 'react'

/** Stub for Settings tab until hook-transpiler settings are wired to relay-runtime only. */
export function useTranspilerSetting<T> (_key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState(initial)
  return [v, setV]
}
