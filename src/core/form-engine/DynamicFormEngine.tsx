"use client";
import React, { useState, useMemo } from 'react';
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
    schema.sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        const val = formData[f.key];
        if (f.required && (val === undefined || val === '' || val === null)) {
          newErrors[f.key] = `${f.label} is required`;
        }
      });
    });
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
