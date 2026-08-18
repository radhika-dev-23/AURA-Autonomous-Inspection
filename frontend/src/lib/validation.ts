import { z } from 'zod';

export const BBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const DefectSchema = z.object({
  bbox: BBoxSchema.optional(),
  severity: z.string().optional(),
  defect_type: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().optional(),
  h: z.number().optional(),
  type: z.string().optional(),
}).transform((data) => {
  const bbox = data.bbox || {
    x: data.x ?? 0,
    y: data.y ?? 0,
    w: data.w ?? 0,
    h: data.h ?? 0,
  };
  return {
    bbox,
    severity: data.severity || 'HIGH',
    defect_type: data.defect_type || data.type || 'DEFECT',
  };
});

export const TimelineItemSchema = z.object({
  time: z.string(),
  state: z.string(),
  event: z.string(),
  desc: z.string(),
});

export const WSStateUpdateSchema = z.object({
  type: z.literal('state_update'),
  state: z.string(),
  scenario: z.string().optional(),
  rechecks: z.number().default(0),
  current_image_path: z.string().nullable().optional(),
  current_score: z.number().nullable().optional(),
  confidence: z.number().nullable().optional(),
  fused_score: z.number().nullable().optional(),
  defects: z.array(DefectSchema).optional().default([]),
  obs_scores: z.array(z.number()).optional().default([]),
  timeline: z.array(TimelineItemSchema).optional().default([]),
});

export const WSInspectionCompleteSchema = z.object({
  type: z.literal('inspection_complete'),
  decision: z.enum(['PASS', 'FAIL']),
  defect_score: z.number().optional(),
  confidence: z.number().optional(),
  rechecks: z.number().default(0),
  observations: z.number().optional(),
  final_image: z.string().nullable().optional(),
  reasoning: z.array(z.string()).optional().default([]),
  fused_score: z.number().nullable().optional(),
  defects: z.array(DefectSchema).optional().default([]),
});

export const WSErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});
