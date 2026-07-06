export function normalizeEmailContact(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeOptionalEmailContact(email?: string | null) {
  const value = email ? normalizeEmailContact(email) : "";
  return value.length > 0 ? value : null;
}

export function sanitizePhoneNumber(phone: string) {
  return phone.replace(/\D/g, "");
}

export function normalizePhoneContact(phone: string) {
  const value = sanitizePhoneNumber(phone);
  return isDomesticPhoneNumber(value) ? value : null;
}

export function normalizeOptionalPhoneContact(phone?: string | null) {
  return phone ? normalizePhoneContact(phone) : null;
}

export function isDomesticPhoneNumber(phone: string) {
  return /^0\d{9,10}$/.test(phone);
}

export function normalizeStrictKoreanMobilePhone(phone: string) {
  const digits = sanitizePhoneNumber(phone);

  if (/^010\d{8}$/.test(digits)) {
    return digits;
  }

  if (/^8210\d{8}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }

  return null;
}

export function isStrictKoreanMobilePhone(phone: string) {
  return /^010\d{8}$/.test(phone);
}
