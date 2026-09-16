import { describe, expect, it } from "vitest";

import {
  CAPABILITY_DIMENSIONS,
  CAPABILITY_NO_BASELINE_NOTE,
  CAPABILITY_NO_SCORES_NOTE,
  FUNNEL_OMITTED_STAGES,
  deriveCapabilityMovement,
  deriveLearningFunnel,
  deriveLearningVolume,
  type CapabilityRunRow,
} from "./capability-intelligence";

function run(employeeId: string, createdAt: string, inputs: Record<string, number>, index: number): CapabilityRunRow {
  return { employee_id: employeeId, created_at: createdAt, attributes: { inputs, index } };
}

const low = { performance: 40, skills: 40, learning: 40, engagement: 40, tenure: 40 };
const high = { performance: 80, skills: 60, learning: 70, engagement: 50, tenure: 90 };

describe("deriveCapabilityMovement", () => {
  it("reports no scores when nothing is recorded", () => {
    const movement = deriveCapabilityMovement([]);
    expect(movement.axes).toEqual([]);
    expect(movement.current).toEqual([]);
    expect(movement.baselineRecorded).toBe(false);
    expect(movement.averageIndex).toBeNull();
    expect(movement.note).toBe(CAPABILITY_NO_SCORES_NOTE);
  });

  it("renders the current series alone when no employee has a second run", () => {
    const movement = deriveCapabilityMovement([run("a", "2026-01-01", high, 72)]);
    expect(movement.baselineRecorded).toBe(false);
    expect(movement.axes).toEqual([]);
    expect(movement.current).toHaveLength(CAPABILITY_DIMENSIONS.length);
    expect(movement.current[0]).toEqual({ axis: "Performance", value: 80 });
    expect(movement.employeesScored).toBe(1);
    expect(movement.employeesWithBaseline).toBe(0);
    expect(movement.note).toBe(CAPABILITY_NO_BASELINE_NOTE);
  });

  it("compares the earliest run against the latest over the same cohort", () => {
    const movement = deriveCapabilityMovement([
      run("a", "2026-01-01T00:00:00.000Z", low, 40),
      run("a", "2026-06-01T00:00:00.000Z", high, 72),
      // A single-run employee contributes to the current reading only, never to
      // the baseline, so the two series always describe the same people.
      run("b", "2026-06-01T00:00:00.000Z", low, 40),
    ]);
    expect(movement.baselineRecorded).toBe(true);
    expect(movement.employeesWithBaseline).toBe(1);
    expect(movement.employeesScored).toBe(2);
    expect(movement.axes[0]).toEqual({ axis: "Performance", current: 80, comparison: 40 });
    expect(movement.current[0]).toEqual({ axis: "Performance", value: 60 });
    expect(movement.averageIndex).toBe(56);
  });

  it("skips a dimension no run records rather than defaulting it to zero", () => {
    const movement = deriveCapabilityMovement([
      { employee_id: "a", created_at: "2026-01-01", attributes: { inputs: { performance: 50 }, index: 12.5 } },
    ]);
    expect(movement.current).toEqual([{ axis: "Performance", value: 50 }]);
  });
});

describe("deriveLearningFunnel", () => {
  it("counts only the stages the enrolment state machine records", () => {
    const funnel = deriveLearningFunnel([
      { completed: false, scoreRecorded: false, certified: false },
      { completed: true, scoreRecorded: false, certified: false },
      { completed: true, scoreRecorded: true, certified: false },
      { completed: true, scoreRecorded: true, certified: true },
    ]);
    expect(funnel.stages.map((stage) => [stage.label, stage.value])).toEqual([
      ["Assigned", 4],
      ["Verified complete", 3],
      ["Assessed", 2],
      ["Certified", 1],
    ]);
  });

  it("never counts a score or a certificate without a recorded completion", () => {
    const funnel = deriveLearningFunnel([{ completed: false, scoreRecorded: true, certified: true }]);
    expect(funnel.stages.map((stage) => stage.value)).toEqual([1, 0, 0, 0]);
  });

  it("names the stages the platform cannot produce instead of drawing them as zero", () => {
    const funnel = deriveLearningFunnel([]);
    expect(funnel.stages.every((stage) => stage.value === 0)).toBe(true);
    expect(funnel.omitted.map((stage) => stage.label)).toEqual(["Started", "Applied at work"]);
    expect(funnel.omitted).toEqual([...FUNNEL_OMITTED_STAGES]);
  });
});

describe("deriveLearningVolume", () => {
  const durations = new Map<string, number | null>([
    ["SAFETY", 120],
    ["ETHICS", 30],
    ["NO-DURATION", null],
  ]);

  it("converts recorded course minutes into hours by department", () => {
    const volume = deriveLearningVolume({
      completions: [
        { department: "Engineering", courseCode: "SAFETY" },
        { department: "Engineering", courseCode: "ETHICS" },
        { department: "Sales", courseCode: "ETHICS" },
      ],
      durationMinutesByCourse: durations,
    });
    expect(volume.measure).toBe("hours");
    expect(volume.axisLabel).toBe("Learning hours");
    expect(volume.bars).toEqual([
      { label: "Engineering", value: 2.5 },
      { label: "Sales", value: 0.5 },
    ]);
    expect(volume.completionsMeasured).toBe(3);
    expect(volume.completionsWithoutDuration).toBe(0);
  });

  it("excludes a completion whose course records no duration and says how many", () => {
    const volume = deriveLearningVolume({
      completions: [
        { department: "Engineering", courseCode: "SAFETY" },
        { department: "Engineering", courseCode: "NO-DURATION" },
      ],
      durationMinutesByCourse: durations,
    });
    expect(volume.measure).toBe("hours");
    expect(volume.bars).toEqual([{ label: "Engineering", value: 2 }]);
    expect(volume.completionsWithoutDuration).toBe(1);
    expect(volume.note).toContain("1 completion could not be counted");
  });

  it("relabels the axis as completions when no course carries a duration", () => {
    const volume = deriveLearningVolume({
      completions: [
        { department: "Engineering", courseCode: "NO-DURATION" },
        { department: "Engineering", courseCode: "UNKNOWN" },
        { department: null, courseCode: "NO-DURATION" },
      ],
      durationMinutesByCourse: durations,
    });
    expect(volume.measure).toBe("completions");
    expect(volume.axisLabel).toBe("Verified completions");
    expect(volume.bars).toEqual([
      { label: "Engineering", value: 2 },
      { label: "No department recorded", value: 1 },
    ]);
    expect(volume.note).toContain("not hours");
  });

  it("reports nothing to attribute when no completion exists", () => {
    const volume = deriveLearningVolume({ completions: [], durationMinutesByCourse: durations });
    expect(volume.bars).toEqual([]);
    expect(volume.note).toContain("No verified completion is recorded");
  });
});
