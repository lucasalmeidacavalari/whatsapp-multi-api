export function normalizeNumber(input) {
  if (!input || typeof input !== "string") return null;

  // Remove todos os caracteres que não são dígitos
  let digits = input.replace(/\D/g, "");

  // Se começar com 0, remove (prefixo local)
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Se for número nacional (começa com 55)
  if (digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);

    // Se tiver 8 dígitos, assume fixo e tenta celular com 9
    if (/^\d{8}$/.test(rest)) {
      return `55${ddd}9${rest}`;
    }

    // Se já tem 9 dígitos ou 11 no total, mantém
    if (/^\d{9}$/.test(rest)) {
      return digits;
    }
  }

  // Se o número tem entre 10 e 15 dígitos e parece internacional
  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }

  // Número inválido
  return null;
}
