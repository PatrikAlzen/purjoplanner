/**
 * A simple FIFO async mutex: `run(fn)` queues `fn` behind any call already
 * queued on this instance, so overlapping async work targeting the same
 * resource never interleaves. SQLite's own transactions don't help here —
 * they make a single write atomic, but two concurrent callers can each read
 * a row, apply their own change to an in-memory copy, and then both write
 * back; the second write silently clobbers the first. This serializes the
 * whole read-modify-write cycle instead.
 */
export class Mutex {
  private tail: Promise<void> = Promise.resolve()

  async run<T>(fn: () => T | Promise<T>): Promise<T> {
    const previous = this.tail
    let release!: () => void
    this.tail = new Promise((resolve) => {
      release = resolve
    })
    await previous
    try {
      return await fn()
    } finally {
      release()
    }
  }
}
