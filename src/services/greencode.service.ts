import bcrypt from 'bcrypt';
import { EstadoFisico, Papel, Prisma, StatusEquipamento } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { normalizarCnpj, validarCnpj } from '../lib/cnpj.js';
import { prisma } from '../lib/prisma.js';
import { GreencodeRepository } from '../repositories/greencode.repository.js';

const podeAlterar = new Set<Papel>([Papel.ADMIN, Papel.OPERADOR, Papel.ALMOXARIFE]);
const podeGerirEstoque = new Set<Papel>([Papel.ADMIN, Papel.ALMOXARIFE]);
const ordemEstado = [EstadoFisico.EXCELENTE, EstadoFisico.BOM, EstadoFisico.REGULAR, EstadoFisico.RUIM, EstadoFisico.IRRECUPERAVEL];

function exigirPapel(papel: Papel, permitidos: Set<Papel>) {
  if (!permitidos.has(papel)) throw new AppError(403, 'Usuário sem permissão para esta operação.');
}

function validarDataEntrada(data: string) {
  const entrada = new Date(data);
  if (Number.isNaN(entrada.valueOf())) throw new AppError(400, 'Data de entrada inválida.');
  const agora = new Date();
  const limite = new Date(agora);
  limite.setDate(limite.getDate() - 90);
  if (entrada > agora || entrada < limite) throw new AppError(400, 'A data de entrada deve estar entre hoje e os últimos 90 dias.');
  return entrada;
}

export class GreencodeService {
  private readonly repository = new GreencodeRepository();

  async autenticar(email: string, senha: string) {
    const usuario = await this.repository.usuarioPorEmail(email.toLowerCase());
    if (!usuario || !(await bcrypt.compare(senha, usuario.senhaHash))) throw new AppError(401, 'Credenciais inválidas.');
    return usuario;
  }

  async criarUsuario(dados: { nome: string; email: string; senha: string; papel: Papel }, papelSolicitante: Papel) {
    exigirPapel(papelSolicitante, new Set([Papel.ADMIN]));
    const senhaHash = await bcrypt.hash(dados.senha, 12);
    return this.repository.criarUsuario({ nome: dados.nome, email: dados.email.toLowerCase(), senhaHash, papel: dados.papel });
  }

  async criarOrganizacao(dados: { codigo: string; nome: string; cnpj: string }, papel: Papel) {
    exigirPapel(papel, podeAlterar);
    const cnpj = normalizarCnpj(dados.cnpj);
    if (!validarCnpj(cnpj)) throw new AppError(400, 'CNPJ inválido.');
    return this.repository.criarOrganizacao({ ...dados, cnpj });
  }

  listarOrganizacoes() {
    return this.repository.listarOrganizacoes();
  }

  async criarContrato(dados: { organizacaoId: string; numero: string; inicio: string; fim?: string; clausulas?: Prisma.InputJsonValue }, papel: Papel) {
    exigirPapel(papel, new Set([Papel.ADMIN, Papel.OPERADOR]));
    const inicio = new Date(dados.inicio);
    const fim = dados.fim ? new Date(dados.fim) : undefined;
    if (Number.isNaN(inicio.valueOf()) || (fim && (Number.isNaN(fim.valueOf()) || fim < inicio))) throw new AppError(400, 'Período de contrato inválido.');
    return this.repository.criarContrato({ numero: dados.numero, inicio, fim, clausulas: dados.clausulas, organizacao: { connect: { id: dados.organizacaoId } } });
  }

  async criarLote(dados: { organizacaoId: string; notaFiscal: string; transportadora: string; dataEntrada: string; equipamentos?: Array<{ codigoBarrasInterno: string; tipo: string; marca?: string; modelo?: string; estadoFisico?: EstadoFisico }> }, papel: Papel) {
    exigirPapel(papel, podeGerirEstoque);
    const dataEntrada = validarDataEntrada(dados.dataEntrada);
    return prisma.$transaction(async (tx) => {
      const organizacao = await tx.organizacao.findUnique({ where: { id: dados.organizacaoId } });
      if (!organizacao) throw new AppError(404, 'Organização não encontrada.');
      const repo = new GreencodeRepository(tx);
      return repo.criarLote({
        notaFiscal: dados.notaFiscal,
        transportadora: dados.transportadora,
        dataEntrada,
        organizacao: { connect: { id: dados.organizacaoId } },
        equipamentos: dados.equipamentos?.length ? { create: dados.equipamentos } : undefined
      });
    });
  }

  listarLotes() {
    return this.repository.listarLotes();
  }

  async concluirTriagem(equipamentoId: string, versao: number, usuarioId: string, papel: Papel) {
    exigirPapel(papel, podeGerirEstoque);
    return prisma.$transaction(async (tx) => {
      const equipamento = await tx.equipamento.findUnique({ where: { id: equipamentoId } });
      if (!equipamento) throw new AppError(404, 'Equipamento não encontrado.');
      if (equipamento.versao !== versao) throw new AppError(409, 'Equipamento desatualizado.');
      if (equipamento.triagemConcluida) throw new AppError(400, 'A triagem já foi concluída.');
      const atualizado = await tx.equipamento.updateMany({ where: { id: equipamentoId, versao }, data: { triagemConcluida: true, status: StatusEquipamento.TRIADO, versao: { increment: 1 } } });
      if (!atualizado.count) throw new AppError(409, 'Equipamento desatualizado.');
      await tx.movimentacao.create({ data: { equipamentoId, usuarioId, statusAnterior: equipamento.status, statusNovo: StatusEquipamento.TRIADO } });
      return tx.equipamento.findUnique({ where: { id: equipamentoId } });
    });
  }

  async atualizarStatus(equipamentoId: string, statusNovo: StatusEquipamento, versao: number, usuarioId: string, papel: Papel, justificativa?: string) {
    exigirPapel(papel, podeGerirEstoque);
    return prisma.$transaction(async (tx) => {
      const equipamento = await tx.equipamento.findUnique({ where: { id: equipamentoId } });
      if (!equipamento) throw new AppError(404, 'Equipamento não encontrado.');
      if (equipamento.versao !== versao) throw new AppError(409, 'Equipamento desatualizado.');
      if (statusNovo === StatusEquipamento.DESMONTE && !equipamento.triagemConcluida) throw new AppError(400, 'A triagem deve ser concluída antes do desmonte.');
      if (statusNovo === equipamento.status) throw new AppError(400, 'O equipamento já possui este status.');
      const atualizado = await tx.equipamento.updateMany({ where: { id: equipamentoId, versao }, data: { status: statusNovo, versao: { increment: 1 } } });
      if (!atualizado.count) throw new AppError(409, 'Equipamento desatualizado.');
      await tx.movimentacao.create({ data: { equipamentoId, usuarioId, statusAnterior: equipamento.status, statusNovo, justificativa } });
      return tx.equipamento.findUnique({ where: { id: equipamentoId } });
    });
  }

  async atualizarEstadoFisico(equipamentoId: string, estadoFisicoNovo: EstadoFisico, versao: number, usuarioId: string, papel: Papel, justificativa?: string) {
    exigirPapel(papel, podeGerirEstoque);
    return prisma.$transaction(async (tx) => {
      const equipamento = await tx.equipamento.findUnique({ where: { id: equipamentoId } });
      if (!equipamento) throw new AppError(404, 'Equipamento não encontrado.');
      if (equipamento.versao !== versao) throw new AppError(409, 'Equipamento desatualizado.');
      const queda = ordemEstado.indexOf(estadoFisicoNovo) - ordemEstado.indexOf(equipamento.estadoFisico);
      if (queda >= 2 && !justificativa?.trim()) throw new AppError(400, 'Justificativa é obrigatória para redução de duas ou mais categorias.');
      if (estadoFisicoNovo === equipamento.estadoFisico) throw new AppError(400, 'O equipamento já possui este estado físico.');
      const atualizado = await tx.equipamento.updateMany({ where: { id: equipamentoId, versao }, data: { estadoFisico: estadoFisicoNovo, versao: { increment: 1 } } });
      if (!atualizado.count) throw new AppError(409, 'Equipamento desatualizado.');
      await tx.movimentacao.create({ data: { equipamentoId, usuarioId, estadoFisicoAnterior: equipamento.estadoFisico, estadoFisicoNovo, justificativa } });
      return tx.equipamento.findUnique({ where: { id: equipamentoId } });
    });
  }

  async rastrearEquipamento(codigo: string) {
    const equipamento = await this.repository.rastrearEquipamento(codigo);
    if (!equipamento) throw new AppError(404, 'Equipamento não encontrado.');
    return equipamento;
  }
}
