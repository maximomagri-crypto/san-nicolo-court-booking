import type { FieldValue, Timestamp } from 'firebase/firestore'

type DateLikeValue = Timestamp | Date | FieldValue | null | undefined

export function formatTimestamp(value: Timestamp | FieldValue | null | undefined): string {
  if (!value || typeof (value as any).toDate !== 'function') {
    return '-'
  }

  try {
    return new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format((value as Timestamp).toDate())
  } catch {
    return '-'
  }
}

export function formatDateLike(value: DateLikeValue): string {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date
    ? value
    : typeof (value as any).toDate === 'function'
      ? (value as Timestamp).toDate()
      : null

  if (!date || Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function getNameParts(displayName: string) {
  const normalized = displayName.trim()
  if (!normalized) {
    return { firstName: '-', lastName: '-' }
  }

  const [firstName, ...rest] = normalized.split(/\s+/)
  return { firstName, lastName: rest.join(' ') || '-' }
}
