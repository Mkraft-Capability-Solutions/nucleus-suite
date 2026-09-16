import { z } from 'zod';

export const shiftWindowSchema = z.object({
  earliest_in: z.string(),
  latest_in: z.string(),
});

export const shiftRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  duration_minutes: z.number(),
  grace_in_minutes: z.number(),
  half_day_minutes: z.number(),
  absent_minutes: z.number(),
  window: shiftWindowSchema.optional(),
});

export type ShiftRule = z.infer<typeof shiftRuleSchema>;

export const rawPunchSchema = z.object({
  timestamp: z.string(),
  type: z.enum(['IN', 'OUT']),
  source: z.string().optional(),
  device_id: z.string().optional(),
});

export type RawPunch = z.infer<typeof rawPunchSchema>;

export const gatePassSchema = z.object({
  minutes: z.number(),
});

export type GatePass = z.infer<typeof gatePassSchema>;

export const employeeContextSchema = z.object({
  location_id: z.string().optional(),
  worker_category_code: z.string().optional(),
  overrides: z.object({
    has_rest_days: z.boolean().optional(),
    rest_day_override: z.array(z.number()).optional(),
  }).optional(),
  ot_eligibility_override: z.string().optional(),
  designation: z.string().optional(),
});

export type EmployeeContext = z.infer<typeof employeeContextSchema>;
