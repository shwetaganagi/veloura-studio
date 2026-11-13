export const CUSTOMER_PASSWORD_MIN_LENGTH = 12;
export const CUSTOMER_PASSWORD_MAX_BYTES = 72;

export function isValidCustomerPassword(password: string) {
  return password.length >= CUSTOMER_PASSWORD_MIN_LENGTH &&
    new TextEncoder().encode(password).length <= CUSTOMER_PASSWORD_MAX_BYTES;
}

export const CUSTOMER_PASSWORD_ERROR =
  "Use at least 12 characters and no more than 72 UTF-8 bytes.";
