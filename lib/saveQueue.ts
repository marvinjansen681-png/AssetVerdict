/**
 * Serial save queue (Phase 4.22, requirement 11).
 *
 * Prevents autosave out-of-order races: "Save A starts, user edits again,
 * Save B starts, B completes, A completes afterwards — the final server
 * state must NOT become A." Two independent guarantees, both structural
 * (not timing-dependent):
 *
 *   1. At most one save request is ever in flight at a time — a new
 *      schedule() call while a save is running never fires a second
 *      concurrent request; it just records the latest snapshot to send next.
 *   2. Only the LATEST scheduled snapshot is ever sent once the in-flight
 *      save completes — an intermediate snapshot superseded by a newer edit
 *      before its turn is simply dropped (it would have been immediately
 *      overwritten anyway), never sent late and never allowed to "win"
 *      against newer data.
 *
 * Together these make it structurally impossible for an older save to
 * finish after, and overwrite, a newer one — there is never more than one
 * request in flight to race against.
 *
 * Deliberately has no dependency on React — testable directly in Node, and
 * reusable by any autosave surface, not just Furniture/Renovation.
 */
export interface SerialSaveQueue<T> {
  /** Records `snapshot` as the latest state to persist and kicks off the save loop if it isn't already running. Safe to call as often as needed (e.g. on every keystroke via a debounce) — only the latest snapshot per idle period is actually sent. */
  schedule(snapshot: T): void;
  /**
   * Forces the CURRENT latest scheduled snapshot (if any) to be sent now,
   * without waiting for a debounce timer — used to flush a pending edit
   * before navigation/unmount (requirement 10). Returns the in-flight
   * promise so a caller that can afford to wait may `await` it; callers
   * that cannot (e.g. a synchronous unmount cleanup) may safely ignore the
   * returned promise — the save still proceeds in the background.
   */
  flush(): Promise<void>;
}

export function createSerialSaveQueue<T>(save: (snapshot: T) => Promise<void>): SerialSaveQueue<T> {
  let pending: T | null = null;
  let hasPending = false;
  let runningLoop: Promise<void> | null = null;

  async function runLoop(): Promise<void> {
    while (hasPending) {
      const snapshot = pending as T;
      hasPending = false;
      pending = null;
      try {
        await save(snapshot);
      } catch {
        // A failed save must not wedge the queue — later, newer snapshots
        // (already possibly queued while this one was in flight) still get
        // their turn. Surfacing the error to the user is the caller's
        // responsibility (save() itself), not this queue's.
      }
    }
  }

  function schedule(snapshot: T): void {
    pending = snapshot;
    hasPending = true;
    if (!runningLoop) {
      runningLoop = runLoop().finally(() => {
        runningLoop = null;
      });
    }
  }

  function flush(): Promise<void> {
    if (!hasPending && !runningLoop) return Promise.resolve();
    if (!runningLoop && hasPending) {
      runningLoop = runLoop().finally(() => {
        runningLoop = null;
      });
    }
    return runningLoop ?? Promise.resolve();
  }

  return { schedule, flush };
}
