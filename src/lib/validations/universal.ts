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

      switch (field.type) {
        case 'number':
        case 'currency':
          fieldSchema = z.number();
          break;
        case 'switch':
        case 'boolean':
          fieldSchema = z.boolean();
          break;
        case 'date':
          fieldSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a valid date YYYY-MM-DD");
          break;
        case 'email':
          fieldSchema = z.string().email();
          break;
        default:
          fieldSchema = z.string();
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
