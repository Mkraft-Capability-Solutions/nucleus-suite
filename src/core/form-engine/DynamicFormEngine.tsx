"use client";
import React, { useState, useMemo } from 'react';
import { z } from "zod";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Box,
  IconButton,
  Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { FormSchemaSpec, FormFieldSpec } from './types';
import { getPicklistOptions } from '@/lib/picklist-catalog';

interface DynamicFormEngineProps {
  open: boolean;
  schema: FormSchemaSpec;
  initialValues?: Record<string, any>;
  onClose: () => void;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  isSubmitting?: boolean;
}

export function DynamicFormEngine({
  open,
  schema,
  initialValues = {},
  onClose,
  onSubmit,
  isSubmitting = false,
}: DynamicFormEngineProps) {
  // Initialize form state
  const defaultState = useMemo(() => {
    const state: Record<string, any> = { ...initialValues };
    schema.sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        if (state[f.key] === undefined) {
          state[f.key] = f.defaultValue !== undefined ? f.defaultValue : f.type === 'switch' ? false : '';
        }
      });
    });
    return state;
  }, [schema, initialValues]);

  const [formData, setFormData] = useState<Record<string, any>>(defaultState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const shape: Record<string, z.ZodTypeAny> = {};
    
    schema.sections.forEach((sec) => {
      sec.fields.forEach((field) => {
        let fieldSchema: z.ZodTypeAny;
        switch (field.type) {
          case 'number':
          case 'currency':
            fieldSchema = z.number();
            break;
          case 'switch':
          case 'checkbox':
            fieldSchema = z.boolean();
            break;
          case 'date':
            fieldSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a valid date YYYY-MM-DD");
            break;
          case 'email':
            fieldSchema = z.string().email();
            break;
          case 'file':
            fieldSchema = z.any(); // Basic validation, actual file is handled in state
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
    });

    const zodSchema = z.object(shape).passthrough();
    const result = zodSchema.safeParse(formData);

    if (!result.success) {
      (result.error as z.ZodError).issues.forEach(err => {
        const key = err.path[0] as string;
        if (key) newErrors[key] = err.message;
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitError(null);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit form.');
    }
  };

  const renderField = (field: FormFieldSpec) => {
    const value = formData[field.key] ?? '';
    const errorText = errors[field.key];
    const isError = Boolean(errorText);

    // If picklist is configured, resolve options dynamically
    let fieldOptions: { value: string | number; label: string }[] = [];
    if (field.picklistCode) {
      fieldOptions = getPicklistOptions(field.picklistCode);
    } else if (field.options) {
      fieldOptions = field.options.map((opt) =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      );
    }

    // Deduplicate options by unique value to fix dropdown duplication bugs
    fieldOptions = Array.from(new Map(fieldOptions.map(opt => [opt.value, opt])).values());

    if (field.type === 'switch') {
      return (
        <FormControlLabel
          key={field.key}
          control={
            <Switch
              checked={Boolean(value)}
              onChange={(e) => handleChange(field.key, e.target.checked)}
              disabled={field.disabled || isSubmitting}
            />
          }
          label={field.label}
          sx={{ gridColumn: `span ${field.colSpan || 1}` }}
        />
      );
    }

    if (field.type === 'file') {
      return (
        <Box key={field.key} sx={{ gridColumn: `span ${field.colSpan || 1}` }}>
          <Button
            variant="outlined"
            component="label"
            fullWidth
            disabled={field.disabled || isSubmitting}
            sx={{
              height: '40px',
              justifyContent: 'flex-start',
              textTransform: 'none',
              color: isError ? 'error.main' : 'text.primary',
              borderColor: isError ? 'error.main' : 'divider',
              overflow: 'hidden'
            }}
          >
            <Typography variant="body2" noWrap sx={{ width: '100%', textAlign: 'left' }}>
              {value ? (value as File).name || 'File selected' : field.label || 'Upload File'}
            </Typography>
            <input
              type="file"
              hidden
              accept={field.accept || '.pdf'}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleChange(field.key, file);
              }}
              required={field.required && !value}
            />
          </Button>
          {(errorText || field.helperText) && (
            <Typography variant="caption" color={isError ? 'error' : 'text.secondary'} sx={{ ml: 1, mt: 0.5, display: 'block' }}>
              {errorText || field.helperText}
            </Typography>
          )}
        </Box>
      );
    }

    if (field.type === 'select' || field.type === 'searchable-select') {
      return (
        <TextField
          key={field.key}
          select
          fullWidth
          size="small"
          label={field.label}
          value={value}
          onChange={(e) => handleChange(field.key, e.target.value)}
          required={field.required}
          error={isError}
          helperText={errorText || field.helperText}
          disabled={field.disabled || isSubmitting}
          sx={{ gridColumn: `span ${field.colSpan || 1}` }}
        >
          {fieldOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      );
    }

    return (
      <TextField
        key={field.key}
        fullWidth
        size="small"
        label={field.label}
        type={field.type === 'number' || field.type === 'currency' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={value}
        onChange={(e) => handleChange(field.key, e.target.value)}
        required={field.required}
        error={isError}
        helperText={errorText || field.helperText}
        placeholder={field.placeholder}
        multiline={field.type === 'textarea'}
        rows={field.type === 'textarea' ? 3 : 1}
        disabled={field.disabled || isSubmitting}
        InputLabelProps={field.type === 'date' ? { shrink: true } : undefined}
        sx={{ gridColumn: `span ${field.colSpan || 1}` }}
      />
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" component="div" fontWeight={700}>
            {schema.title}
          </Typography>
          {schema.description && (
            <Typography variant="body2" color="text.secondary">
              {schema.description}
            </Typography>
          )}
        </Box>
        <IconButton aria-label="close" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers sx={{ p: 3 }}>
          {submitError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {submitError}
            </Alert>
          )}

          {schema.sections.map((section) => (
            <Box key={section.id} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} color="primary" sx={{ mb: 1.5 }}>
                {section.title}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                }}
              >
                {section.fields.map(renderField)}
              </Box>
            </Box>
          ))}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} disabled={isSubmitting} variant="outlined" color="inherit">
            {schema.cancelLabel || 'Cancel'}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting}
            startIcon={<CheckCircleOutlineIcon />}
          >
            {isSubmitting ? 'Saving...' : schema.submitLabel || 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
