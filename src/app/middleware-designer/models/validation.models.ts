export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  middlewareId: string;
  message: string;
}

export interface ValidationWarning {
  middlewareId: string;
  message: string;
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  middlewareId: string;
  message: string;
}
