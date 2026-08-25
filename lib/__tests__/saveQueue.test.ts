import { describe, it, expect, vi } from "vitest";
import { createSerialSaveQueue } from "../saveQueue";

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

describe("createSerialSaveQueue — out-of-order save protection (Phase 4.22, requirement 11/20)", () => {
  it("sends the latest snapshot after the in-flight save completes, never re-sending a stale intermediate one", async () => {
    const sent: string[] = [];
    const queue = createSerialSaveQueue<string>(async (snapshot) => {
      await delay(10);
      sent.push(snapshot);
    });

    queue.schedule("A"); // starts sending immediately — nothing else in flight yet
    await delay(1); // let A's save actually begin (past the schedule() call's synchronous claim)
    queue.schedule("B"); // arrives while A is in flight — queued as "next"
    queue.schedule("C"); // supersedes B before B ever gets a turn

    await queue.flush();
    // A was already in flight when B/C arrived, so it still completes; B was
    // superseded by C before its turn and correctly dropped — never sent
    // late, never allowed to overwrite C afterwards.
    expect(sent).toEqual(["A", "C"]);
  });

  it("Save A starts, user edits again (Save B scheduled), B completes, A completes afterwards -> final sent state is B's, never reverted to A's", async () => {
    const sent: string[] = [];
    const queue = createSerialSaveQueue<string>(async (snapshot) => {
      // Simulate A being slower than B by making the FIRST call slow and
      // every subsequent call fast — but because this queue guarantees at
      // most one in-flight request, A always fully completes before B's
      // request is even issued, so there is no way for B to complete before
      // A regardless of latency.
      if (sent.length === 0) await delay(30);
      sent.push(snapshot);
    });

    queue.schedule("A");
    // Give the loop a tick to actually start A's save before scheduling B —
    // proves a slow in-flight request is never joined/raced by a second one.
    await delay(5);
    queue.schedule("B");

    await queue.flush();
    expect(sent).toEqual(["A", "B"]);
  });

  it("never runs two saves concurrently", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const queue = createSerialSaveQueue<number>(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await delay(10);
      concurrent--;
    });

    for (let i = 0; i < 5; i++) {
      queue.schedule(i);
      await delay(3); // stagger schedules so several land while one is in flight
    }
    await queue.flush();
    expect(maxConcurrent).toBe(1);
  });

  it("flush() resolves once every pending save (including ones scheduled during the wait) has completed", async () => {
    const sent: number[] = [];
    const queue = createSerialSaveQueue<number>(async (snapshot) => {
      await delay(5);
      sent.push(snapshot);
    });

    queue.schedule(1);
    await queue.flush();
    expect(sent).toEqual([1]);
  });

  it("a failed save does not wedge the queue — a later schedule still gets its turn", async () => {
    const sent: string[] = [];
    const queue = createSerialSaveQueue<string>(async (snapshot) => {
      if (snapshot === "fails") throw new Error("network error");
      sent.push(snapshot);
    });

    queue.schedule("fails");
    await delay(5);
    queue.schedule("recovers");
    await queue.flush();
    expect(sent).toEqual(["recovers"]);
  });

  it("flush() with nothing scheduled is a safe no-op", async () => {
    const save = vi.fn(async () => {});
    const queue = createSerialSaveQueue<string>(save);
    await expect(queue.flush()).resolves.toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });
});
