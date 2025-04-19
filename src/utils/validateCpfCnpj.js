function sanitizeCpfCnpj(value) {
  return value.replace(/\D/g, "");
}

function isValidCpfCnpj(value) {
  const clean = sanitizeCpfCnpj(value);

  if (clean.length === 11) {
    return isValidCpf(clean);
  }

  if (clean.length === 14) {
    return isValidCnpj(clean);
  }

  return false;
}

// Validação de CPF (simplificada)
function isValidCpf(cpf) {
  if (/^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === Number(cpf[10]);
}

// Validação de CNPJ (simplificada)
function isValidCnpj(cnpj) {
  if (/^(\d)\1+$/.test(cnpj)) return false;

  let t = cnpj.length - 2;
  let d = cnpj.substring(t);
  let d1 = 0;

  for (let i = 0, j = 5; i < t; i++) {
    d1 += Number(cnpj[i]) * j;
    j = j === 2 ? 9 : j - 1;
  }

  d1 = d1 % 11 < 2 ? 0 : 11 - (d1 % 11);
  if (d1 !== Number(d[0])) return false;

  t += 1;
  d1 = 0;

  for (let i = 0, j = 6; i < t; i++) {
    d1 += Number(cnpj[i]) * j;
    j = j === 2 ? 9 : j - 1;
  }

  d1 = d1 % 11 < 2 ? 0 : 11 - (d1 % 11);
  return d1 === Number(d[1]);
}

export { sanitizeCpfCnpj, isValidCpfCnpj };
