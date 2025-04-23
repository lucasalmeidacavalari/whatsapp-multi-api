export function normalizeNumber(input) {
  if (!input || typeof input !== "string") return null;

  // Remove espaços invisíveis (non-breaking space, etc)
  input = input.replace(/\s/g, "").replace(/\u00A0/g, "");

  // Remove todos os caracteres que não são dígitos
  let digits = input.replace(/\D/g, "");

  // Remove prefixo local (ex: 011...)
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // 🆕 Detecta número brasileiro sem DDI (10 ou 11 dígitos, sem 55)
  if (/^\d{10,11}$/.test(digits) && !digits.startsWith("55")) {
    digits = "55" + digits;
  }

  // Se for número nacional (com DDI 55)
  if (digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);

    // Se for número fixo com 8 dígitos, insere o 9 pra virar celular
    if (/^\d{8}$/.test(rest)) {
      return `55${ddd}9${rest}`;
    }

    // Se já tem 9 dígitos, retorna como está
    if (/^\d{9}$/.test(rest)) {
      return digits;
    }
  }

  // Se parece internacional (10 a 15 dígitos), retorna direto
  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }

  // Número inválido
  return null;
}
