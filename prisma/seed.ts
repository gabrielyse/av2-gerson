import 'dotenv/config';
import bcrypt from 'bcrypt';
import { EstadoFisico, Papel, StatusEquipamento } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@greencode.local';
  const senha = process.env.SEED_ADMIN_PASSWORD ?? 'troque-esta-senha';
  const admin = await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: { nome: 'Administrador', email, senhaHash: await bcrypt.hash(senha, 12), papel: Papel.ADMIN }
  });

  const organizacao = await prisma.organizacao.upsert({
    where: { codigo: 'ORG001' },
    update: {},
    create: { codigo: 'ORG001', nome: 'Empresa Demonstração Ltda.', cnpj: '11222333000181' }
  });
  await prisma.contrato.upsert({
    where: { organizacaoId: organizacao.id },
    update: {},
    create: { organizacaoId: organizacao.id, numero: 'CT-001', inicio: new Date('2025-01-01'), clausulas: { coleta: 'mensal' } }
  });

  const lote = await prisma.lote.upsert({
    where: { organizacaoId_notaFiscal: { organizacaoId: organizacao.id, notaFiscal: 'NF-0001' } },
    update: {},
    create: { organizacaoId: organizacao.id, notaFiscal: 'NF-0001', transportadora: 'TransRápida', dataEntrada: new Date() }
  });
  const equipamento = await prisma.equipamento.upsert({
    where: { codigoBarrasInterno: 'GC-000001' },
    update: {},
    create: { loteId: lote.id, codigoBarrasInterno: 'GC-000001', tipo: 'Notebook', marca: 'Exemplo', modelo: 'Eco 14', status: StatusEquipamento.TRIADO, estadoFisico: EstadoFisico.BOM, triagemConcluida: true }
  });
  const movimento = await prisma.movimentacao.findFirst({ where: { equipamentoId: equipamento.id } });
  if (!movimento) await prisma.movimentacao.create({ data: { equipamentoId: equipamento.id, usuarioId: admin.id, statusAnterior: StatusEquipamento.RECEBIDO, statusNovo: StatusEquipamento.TRIADO } });
}

main().then(() => prisma.$disconnect()).catch(async (erro) => {
  console.error(erro);
  await prisma.$disconnect();
  process.exit(1);
});
