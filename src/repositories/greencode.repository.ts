import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export class GreencodeRepository {
  constructor(private readonly db: PrismaClient | Prisma.TransactionClient = prisma) {}

  usuarioPorEmail(email: string) {
    return this.db.usuario.findUnique({ where: { email } });
  }

  criarUsuario(data: Prisma.UsuarioCreateInput) {
    return this.db.usuario.create({ data });
  }

  criarOrganizacao(data: Prisma.OrganizacaoCreateInput) {
    return this.db.organizacao.create({ data });
  }

  listarOrganizacoes() {
    return this.db.organizacao.findMany({ include: { contrato: true }, orderBy: { nome: 'asc' } });
  }

  criarContrato(data: Prisma.ContratoCreateInput) {
    return this.db.contrato.create({ data });
  }

  buscarLote(id: string) {
    return this.db.lote.findUnique({ where: { id } });
  }

  criarLote(data: Prisma.LoteCreateInput) {
    return this.db.lote.create({ data, include: { equipamentos: true } });
  }

  listarLotes() {
    return this.db.lote.findMany({ include: { organizacao: true, _count: { select: { equipamentos: true } } }, orderBy: { criadoEm: 'desc' } });
  }

  buscarEquipamento(id: string) {
    return this.db.equipamento.findUnique({ where: { id } });
  }

  rastrearEquipamento(codigoBarrasInterno: string) {
    return this.db.equipamento.findUnique({
      where: { codigoBarrasInterno },
      include: { lote: { include: { organizacao: true } }, movimentacoes: { include: { usuario: { select: { nome: true, email: true } } }, orderBy: { criadoEm: 'asc' } } }
    });
  }
}
