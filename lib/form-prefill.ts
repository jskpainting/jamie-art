const KEY = "jamie-art:form-data"

interface PrefillData {
  name?: string
  email?: string
  phone?: string
}

export function getPrefill(): PrefillData {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as PrefillData
  } catch {
    return {}
  }
}

export function savePrefill(data: PrefillData): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // ignore quota errors
  }
}
