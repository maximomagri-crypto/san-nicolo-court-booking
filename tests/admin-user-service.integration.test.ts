import { beforeEach, describe, expect, it, vi } from 'vitest'

const firestoreMocks = vi.hoisted(() => {
  return {
    collection: vi.fn(() => ({ _tag: 'collection' })),
    doc: vi.fn((_collectionRef?: unknown, id?: string) => ({ id: id ?? 'generated-id' })),
    updateDoc: vi.fn(),
    setDoc: vi.fn(),
    query: vi.fn(() => ({ _tag: 'query' })),
    where: vi.fn(() => ({ _tag: 'where' })),
    orderBy: vi.fn(() => ({ _tag: 'orderBy' })),
    serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  }
})

vi.mock('firebase/firestore', () => firestoreMocks)
vi.mock('../src/firebase/firebase', () => ({ db: {} }))

describe('AdminUserService integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('approves user and writes USER_APPROVED audit log', async () => {
    const { approveUser } = await import('../src/services/AdminUserService')

    await approveUser('user-1', 'admin-1')

    expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1)
    expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1)

    const updatePayload = firestoreMocks.updateDoc.mock.calls[0][1] as {
      status: string
      approvedBy: string
    }
    expect(updatePayload.status).toBe('ACTIVE')
    expect(updatePayload.approvedBy).toBe('admin-1')

    const logPayload = firestoreMocks.setDoc.mock.calls[0][1] as {
      eventType: string
      actorUid: string
      targetUid: string
      payload: Record<string, unknown>
    }
    expect(logPayload.eventType).toBe('USER_APPROVED')
    expect(logPayload.actorUid).toBe('admin-1')
    expect(logPayload.targetUid).toBe('user-1')
    expect(logPayload.payload).toEqual({})
  })

  it('changes role and writes ROLE_CHANGED audit log payload', async () => {
    const { changeRole } = await import('../src/services/AdminUserService')

    await changeRole('user-2', 'SUB_ADMIN', 'admin-2')

    expect(firestoreMocks.updateDoc).toHaveBeenCalledTimes(1)
    expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1)

    const updatePayload = firestoreMocks.updateDoc.mock.calls[0][1] as {
      role: string
    }
    expect(updatePayload.role).toBe('SUB_ADMIN')

    const logPayload = firestoreMocks.setDoc.mock.calls[0][1] as {
      eventType: string
      actorUid: string
      targetUid: string
      payload: Record<string, unknown>
    }
    expect(logPayload.eventType).toBe('ROLE_CHANGED')
    expect(logPayload.actorUid).toBe('admin-2')
    expect(logPayload.targetUid).toBe('user-2')
    expect(logPayload.payload).toEqual({ role: 'SUB_ADMIN' })
  })
})
