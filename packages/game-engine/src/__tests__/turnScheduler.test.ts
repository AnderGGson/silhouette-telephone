import { describe, expect, it } from "vitest";
import {
  assignmentsForStep,
  resolveMaxChainSteps,
  scheduleParallelChains,
} from "../turnScheduler";

describe("resolveMaxChainSteps", () => {
  it("clamps into the 3-6 range", () => {
    expect(resolveMaxChainSteps(1, 5)).toBe(3);
    expect(resolveMaxChainSteps(10, 5)).toBe(6);
    expect(resolveMaxChainSteps(4, 5)).toBe(4);
  });

  it("forces at least 4 steps when there are exactly 2 players", () => {
    expect(resolveMaxChainSteps(3, 2)).toBe(4);
    expect(resolveMaxChainSteps(5, 2)).toBe(5);
  });
});

describe("scheduleParallelChains with 2 players", () => {
  const players = ["p0", "p1"];
  const schedule = scheduleParallelChains(players, 4);

  it("produces exactly chainCount * totalSteps assignments", () => {
    expect(schedule).toHaveLength(3 * 4);
  });

  it("splits chains 2-1 between players at every step", () => {
    for (let step = 1; step <= 4; step++) {
      const stepAssignments = assignmentsForStep(schedule, step);
      const counts = stepAssignments.reduce<Record<string, number>>(
        (acc, a) => {
          acc[a.assignedPlayerId] = (acc[a.assignedPlayerId] ?? 0) + 1;
          return acc;
        },
        {},
      );
      const values = Object.values(counts).sort();
      expect(values).toEqual([1, 2]);
    }
  });

  it("never repeats the same player on consecutive steps of the same chain", () => {
    for (const chainIndex of [0, 1, 2] as const) {
      const chainSteps = schedule
        .filter((a) => a.chainIndex === chainIndex)
        .sort((a, b) => a.stepNumber - b.stepNumber);
      for (let i = 1; i < chainSteps.length; i++) {
        expect(chainSteps[i]?.assignedPlayerId).not.toBe(
          chainSteps[i - 1]?.assignedPlayerId,
        );
      }
    }
  });

  it("is deterministic for the same input", () => {
    const again = scheduleParallelChains(players, 4);
    expect(again).toEqual(schedule);
  });
});

describe("scheduleParallelChains with 3 players", () => {
  const players = ["p0", "p1", "p2"];
  const schedule = scheduleParallelChains(players, 3);

  it("assigns 3 distinct players on step 1, one per chain", () => {
    const step1 = assignmentsForStep(schedule, 1);
    const ids = step1.map((a) => a.assignedPlayerId);
    expect(new Set(ids).size).toBe(3);
    expect(step1.find((a) => a.chainIndex === 0)?.assignedPlayerId).toBe("p0");
    expect(step1.find((a) => a.chainIndex === 1)?.assignedPlayerId).toBe("p1");
    expect(step1.find((a) => a.chainIndex === 2)?.assignedPlayerId).toBe("p2");
  });

  it("never assigns the same player twice to the same chain while unused players remain", () => {
    for (const chainIndex of [0, 1, 2] as const) {
      const ids = schedule
        .filter((a) => a.chainIndex === chainIndex)
        .map((a) => a.assignedPlayerId);
      expect(new Set(ids).size).toBe(ids.length); // 3 steps, 3 players, all distinct
    }
  });
});

describe("scheduleParallelChains with 4 players", () => {
  const players = ["p0", "p1", "p2", "p3"];
  const schedule = scheduleParallelChains(players, 4);

  it("assigns 3 distinct players on step 1", () => {
    const step1 = assignmentsForStep(schedule, 1);
    expect(new Set(step1.map((a) => a.assignedPlayerId)).size).toBe(3);
  });

  it("reuses a player only after everyone else has played that chain, and never repeats consecutively", () => {
    for (const chainIndex of [0, 1, 2] as const) {
      const ids = schedule
        .filter((a) => a.chainIndex === chainIndex)
        .map((a) => a.assignedPlayerId);
      // 4 steps, 4 players -> with totalSteps == players, no reuse needed at all
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("balances load reasonably across a round (no player does all 3 chains in one step)", () => {
    for (let step = 1; step <= 4; step++) {
      const stepAssignments = assignmentsForStep(schedule, step);
      const counts = new Map<string, number>();
      for (const a of stepAssignments) {
        counts.set(a.assignedPlayerId, (counts.get(a.assignedPlayerId) ?? 0) + 1);
      }
      for (const count of counts.values()) {
        expect(count).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("scheduleParallelChains with 8 players", () => {
  const players = Array.from({ length: 8 }, (_, i) => `p${i}`);
  const schedule = scheduleParallelChains(players, 6);

  it("produces chainCount * totalSteps assignments", () => {
    expect(schedule).toHaveLength(3 * 6);
  });

  it("never repeats the same player on consecutive steps of any chain", () => {
    for (const chainIndex of [0, 1, 2] as const) {
      const chainSteps = schedule
        .filter((a) => a.chainIndex === chainIndex)
        .sort((a, b) => a.stepNumber - b.stepNumber);
      for (let i = 1; i < chainSteps.length; i++) {
        expect(chainSteps[i]?.assignedPlayerId).not.toBe(
          chainSteps[i - 1]?.assignedPlayerId,
        );
      }
    }
  });

  it("every player is used at least once across the whole schedule", () => {
    const usedIds = new Set(schedule.map((a) => a.assignedPlayerId));
    expect(usedIds.size).toBe(8);
  });
});

describe("scheduleParallelChains validation", () => {
  it("rejects fewer than 2 players", () => {
    expect(() => scheduleParallelChains(["only-one"], 3)).toThrow();
  });

  it("rejects more than 8 players", () => {
    const tooMany = Array.from({ length: 9 }, (_, i) => `p${i}`);
    expect(() => scheduleParallelChains(tooMany, 3)).toThrow();
  });

  it("rejects duplicate player ids", () => {
    expect(() => scheduleParallelChains(["p0", "p0", "p1"], 3)).toThrow();
  });

  it("rejects totalSteps < 1", () => {
    expect(() => scheduleParallelChains(["p0", "p1"], 0)).toThrow();
  });
});
