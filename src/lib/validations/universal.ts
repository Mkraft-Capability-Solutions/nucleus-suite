import { z } from "zod";
import registry from "@/config/ui/lib.operational-module-registry.json";

/**
 * Dynamically builds a Zod schema from a given module's field configurations.
 */
export function buildZodSchemaForModule(moduleId: string) {
  const moduleDef = registry.modules.find(m => m.id === moduleId);
  if (!moduleDef) return z.any();

  const shape: Record<string, z.ZodTypeAny> = {};
  
  if (moduleDef.fields && Array.isArray(moduleDef.fields)) {
    moduleDef.fields.forEach(field => {
      let fieldSchema: z.ZodTypeAny;

      const isBool = 
        field.type === 'switch' || 
        field.type === 'boolean' || 
        field.type === 'checkbox' || 
        field.dataType === 'Bool' || 
        field.control === 'Toggle' || 
        field.control === 'Checkbox';

      const isNum = 
        field.type === 'number' || 
        field.type === 'currency' || 
        field.dataType?.startsWith('Int') || 
        field.dataType?.startsWith('Dec');

      const isArray = 
        field.dataType === 'Ref[]' || 
        field.dataType === 'Char[]' || 
        Array.isArray(field.default);

      if (isBool) {
        fieldSchema = z.union([
          z.boolean(),
          z.string().transform(v => v === 'true' || v === '1' || v === 'yes'),
          z.number().transform(v => v === 1)
        ]);
      } else if (isNum) {
        fieldSchema = z.preprocess(
          (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
          field.required ? z.number() : z.number().optional().nullable()
        );
      } else if (isArray) {
        fieldSchema = z.union([
          z.array(z.any()),
          z.string().transform(v => v ? [v] : [])
        ]);
      } else {
        switch (field.type) {
          case 'date':
            fieldSchema = z.string().refine(v => !v || /^\d{4}-\d{2}-\d{2}/.test(v), "Must be a valid date YYYY-MM-DD");
            break;
          case 'time':
            fieldSchema = z.string().refine(v => !v || /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v), "Must be a valid time (HH:mm)");
            break;
          case 'email':
            fieldSchema = z.string().refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Must be a valid email");
            break;
          default:
            fieldSchema = z.union([z.string(), z.number().transform(String), z.boolean().transform(String)]);
        }
      }

      if (!field.required) {
        fieldSchema = fieldSchema.optional().nullable().or(z.literal(''));
      } else {
        if (fieldSchema instanceof z.ZodString) {
          fieldSchema = fieldSchema.min(1, `${field.label || field.key} is required`);
        }
      }

      shape[field.key] = fieldSchema;
    });
  }

  return z.object(shape).passthrough(); // passthrough allows extra fields (like employeeId, tenantId metadata)
}
