/**
 * Validation utilities for commission calculator
 */

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isAuthorizedDomain(email: string): boolean {
  const authorizedDomains = ['@kanvabotanicals.com', '@cwlbrands.com'];
  return authorizedDomains.some(domain => email.toLowerCase().endsWith(domain));
}

export function isStrongPassword(password: string): boolean {
  // Min 8 chars, at least one number, one special char
  const minLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  return minLength && hasNumber && hasSpecial;
}

export function validateWeightsSum(weights: number[], tolerance: number = 0.0001): boolean {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  return Math.abs(sum - 1.0) < tolerance;
}

export function validatePositiveNumber(value: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
}

export function validatePercentage(value: number): boolean {
  return validatePositiveNumber(value) && value >= 0 && value <= 1;
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}
