/**
 * Nucleus Enterprise Dynamic Form Engine Specification
 * Connects 50 Form Schemas and 909 Field Specs with strict runtime typing & validation
 */

export type FormFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'datetime'
  | 'select'
  | 'searchable-select'
  | 'multi-select'
  | 'textarea'
  | 'switch'
  | 'checkbox'
  | 'file';

export interface FormFieldOption {
  value: string | number;
  label: string;
}

export interface FormFieldSpec {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  options?: string[] | FormFieldOption[];
  picklistCode?: string;
  colSpan?: 1 | 2 | 3 | 4;
  disabled?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  helperText?: string;
  accept?: string;
}

export interface FormSectionSpec {
  id: string;
  title: string;
  description?: string;
  fields: FormFieldSpec[];
}

export interface FormSchemaSpec {
  formId: string;
  title: string;
  description?: string;
  sections: FormSectionSpec[];
  submitLabel?: string;
  cancelLabel?: string;
}
