/**
 * Authentication utilities
 */

/**
 * Check if email is from an allowed domain
 */
export function isAllowedDomain(email: string): boolean {
  const allowedDomains = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS?.split(',') || [
    'kanvabotanicals.com',
    'cwlbrands.com'
  ];
  
  const emailDomain = email.toLowerCase().split('@')[1];
  return allowedDomains.some(domain => emailDomain === domain.trim().toLowerCase());
}

/**
 * Check if email is an admin email
 */
export function isAdminEmail(email: string): boolean {
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
  return adminEmails.some(adminEmail => 
    adminEmail.trim().toLowerCase() === email.toLowerCase()
  );
}

/**
 * Get user role based on email
 */
export function getUserRole(email: string): 'admin' | 'sales' {
  return isAdminEmail(email) ? 'admin' : 'sales';
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  
  if (!/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }
  
  return { valid: true };
}
