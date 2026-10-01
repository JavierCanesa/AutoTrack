export const PERSON_NAME_PATTERN =
  "[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'\\-]*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ .'\\-]*";
export const PHONE_PATTERN = "\\+?(?:[ ()\\-]*[0-9]){8,15}[ ()\\-]*";
export const NON_BLANK_PATTERN = ".*\\S.*";

export function passwordValidationError(value: string) {
  if (value.length < 8)
    return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[a-z]/.test(value))
    return "La contraseña debe incluir al menos una letra minúscula.";
  if (!/[A-Z]/.test(value))
    return "La contraseña debe incluir al menos una letra mayúscula.";
  if (!/[0-9]/.test(value))
    return "La contraseña debe incluir al menos un número.";
  if (!/[^A-Za-z0-9\s]/.test(value))
    return "La contraseña debe incluir al menos un símbolo.";
  return null;
}

export function localDateInput(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function requiredText(
  form: HTMLFormElement,
  name: string,
  message: string,
) {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement))
    return null;
  const value = field.value.trim();
  if (value) return value;
  field.setCustomValidity(message);
  field.reportValidity();
  field.addEventListener("input", () => field.setCustomValidity(""), {
    once: true,
  });
  field.focus();
  return null;
}

export function optionalText(value: FormDataEntryValue | null) {
  const normalized = String(value || "").trim();
  return normalized || null;
}
