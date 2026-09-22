import { describe, expect, it } from 'vitest'
import { Mutex } from '../../server/utils/mutex'

describe('Mutex', () => {
  it('runs queued calls one at a time, in order', async () => {
    const mutex = new Mutex()
    const order: number[] = []

    async function task(n: number, delayMs: number) {
      return mutex.run(async () => {
        order.push(n)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        order.push(-n)
      })
    }

    // Even though the first call is the slowest, no other call's body may
    // start until it finishes — a shared counter incremented non-atomically
    // inside `run` would prove interleaving occurred.
    await Promise.all([task(1, 20), task(2, 5), task(3, 1)])
    expect(order).toEqual([1, -1, 2, -2, 3, -3])
  })

  it('releases the lock even when the queued function throws', async () => {
    const mutex = new Mutex()
    await expect(
      mutex.run(() => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')

    // If the failed run had not released, this would hang until the test times out.
    const result = await mutex.run(() => 'ok')
    expect(result).toBe('ok')
  })

  it('serializes a batch of concurrent read-modify-write increments without losing updates', async () => {
    const mutex = new Mutex()
    let counter = 0
    await Promise.all(
      Array.from({ length: 20 }, () =>
        mutex.run(async () => {
          const current = counter
          await Promise.resolve() // force a real await between read and write
          counter = current + 1
        })
      )
    )
    expect(counter).toBe(20)
  })
})
