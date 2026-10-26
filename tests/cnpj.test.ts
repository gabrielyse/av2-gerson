import { describe, expect, it } from 'vitest';
import { validarCnpj } from '../src/lib/cnpj.js';

describe('validarCnpj', () => {
  it('aceita CNPJ com dígitos verificadores corretos', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('rejeita CNPJ inválido', () => {
    expect(validarCnpj('11.222.333/0001-80')).toBe(false);
  });
});
