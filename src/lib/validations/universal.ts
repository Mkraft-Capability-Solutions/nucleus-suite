import { z } from "zod";
import registry from "@/config/ui/lib.operational-module-registry.json";
import {
  EMAIL_PATTERN,
  PAN_PATTERN,
  GSTIN_PATTERN,
  IFSC_PATTERN,
  PIN_PATTERN,
  CIN_LLPIN_PATTERN,
  TIME_24H_PATTERN,
  DATE_ISO_PATTERN,
  isValidPhoneNumber,
  isValidMobileOrEmail,
  detectSemanticType,
} from "./patterns";

export * from "./patterns";

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

      const labelOrKey = field.label || field.key;
      const semantic = detectSemanticType(field);

      if (isBool) {
        fieldSchema = z.union([
          z.boolean(),
          z.string().transform(v => v === 'true' || v === '1' || v === 'yes'),
          z.number().transform(v => v === 1)
        ]);
        if (!field.required) {
          fieldSchema = fieldSchema.optional().nullable().or(z.literal(''));
        }
      } else if (isNum) {
        let numSchema = z.number();
        if (field.min !== undefined && Number.isFinite(field.min)) {
          numSchema = numSchema.min(field.min, `${labelOrKey} must be at least ${field.min}`);
        }
        if (field.max !== undefined && Number.isFinite(field.max)) {
          numSchema = numSchema.max(field.max, `${labelOrKey} must not exceed ${field.max}`);
        }
        if (field.dataType?.startsWith('Int')) {
          numSchema = numSchema.int(`${labelOrKey} must be an integer`);
        }
        fieldSchema = z.preprocess(
          (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
          field.required ? numSchema : numSchema.optional().nullable()
        );
      } else if (isArray) {
        fieldSchema = z.union([
          z.array(z.any()),
          z.string().transform(v => v ? [v] : [])
        ]);
        if (!field.required) {
          fieldSchema = fieldSchema.optional().nullable().or(z.literal(''));
        }
      } else {
        // Build base string validation based on semantic type or field type
        let base: z.ZodType<string>;

        switch (semantic) {
          case 'mobileEmail':
            base = z.string().refine(
              v => !v || isValidMobileOrEmail(v),
              `${labelOrKey} must be a valid mobile number or email address`
            );
            break;
          case 'email':
            base = z.string().refine(
              v => !v || EMAIL_PATTERN.test(v.trim()),
              `${labelOrKey} must be a valid email address`
            );
            break;
          case 'phone':
            base = z.string().refine(
              v => !v || isValidPhoneNumber(v.trim()),
              `${labelOrKey} must be a valid mobile/phone number`
            );
            break;
          case 'pan':
            base = z.string().refine(
              v => !v || PAN_PATTERN.test(v.trim()),
              `${labelOrKey} must be a valid 10-character PAN (e.g. ABCDE1234F)`
            );
            break;
          case 'gstin':
            base = z.string().refine(
              v => !v || GSTIN_PATTERN.test(v.trim()),
              `${labelOrKey} must be a valid 15-character GSTIN (e.g. 29ABCDE1234F1Z5)`
            );
            break;
          case 'ifsc':
            base = z.string().refine(
              v => !v || IFSC_PATTERN.test(v.trim()),
              `${labelOrKey} must be a valid 11-character IFSC code (e.g. HDFC0001234)`
            );
            break;
          case 'cinLlpin':
            base = z.string().refine(
              v => !v || CIN_LLPIN_PATTERN.test(v.trim()),
              `${labelOrKey} must be a valid CIN (21 chars) or LLPIN`
            );
            break;
          case 'pinCode':
            base = z.string().refine(
              v => !v || PIN_PATTERN.test(v.trim()),
              `${labelOrKey} must be a valid 6-digit PIN code`
            );
            break;
          case 'dateOfBirth':
            base = z.string().refine(
              v => !v || (DATE_ISO_PATTERN.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v + 'T00:00:00Z').getTime() <= Date.now()),
              `${labelOrKey} must be a valid date of birth in the past`
            );
            break;
          default:
            switch (field.type) {
              case 'date':
                base = z.string().refine(
                  v => !v || (DATE_ISO_PATTERN.test(v) && !Number.isNaN(Date.parse(v))),
                  `${labelOrKey} must be a valid date (YYYY-MM-DD)`
                );
                break;
              case 'time':
                base = z.string().refine(
                  v => !v || TIME_24H_PATTERN.test(v.trim()),
                  `${labelOrKey} must be a valid time (HH:mm)`
                );
                break;
              default:
                base = z.string();
            }
        }

        // Apply max length if Char(N) is specified
        if (typeof field.dataType === 'string') {
          const charMatches = [...field.dataType.matchAll(/Char\((\d+)\)/g)];
          if (charMatches.length > 0) {
            const maxLen = Math.max(...charMatches.map(m => parseInt(m[1], 10)));
            if (maxLen > 0) {
              base = base.refine(
                v => !v || v.length <= maxLen,
                `${labelOrKey} must not exceed ${maxLen} characters`
              );
            }
          }
        }

        if (field.required) {
          fieldSchema = z.preprocess(
            (val) => (val === null || val === undefined ? '' : String(val).trim()),
            base.refine(v => typeof v === 'string' && v.trim().length > 0, `${labelOrKey} is required`)
          );
        } else {
          fieldSchema = z.preprocess(
            (val) => (val === null || val === undefined ? undefined : String(val).trim()),
            base.optional().nullable().or(z.literal(''))
          );
        }
      }

      shape[field.key] = fieldSchema;
    });
  }

  return z.object(shape).passthrough();
}
