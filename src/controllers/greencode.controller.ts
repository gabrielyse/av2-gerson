import type { FastifyInstance, FastifyRequest } from 'fastify';
import { EstadoFisico, Papel, StatusEquipamento } from '@prisma/client';
import { GreencodeService } from '../services/greencode.service.js';

const service = new GreencodeService();
const autenticado = { security: [{ bearerAuth: [] }] };
const enumValues = <T extends object>(en: T) => Object.values(en);

function usuario(request: FastifyRequest) {
  return request.usuario;
}

export async function registrarRotas(app: FastifyInstance) {
  app.post('/auth/login', {
    schema: { tags: ['Autenticação'], summary: 'Autentica e emite um JWT', body: { type: 'object', required: ['email', 'senha'], properties: { email: { type: 'string', format: 'email' }, senha: { type: 'string', minLength: 8 } } } }
  }, async (request) => {
    const { email, senha } = request.body as { email: string; senha: string };
    const user = await service.autenticar(email, senha);
    return { token: app.jwt.sign({ id: user.id, papel: user.papel }), usuario: { id: user.id, nome: user.nome, papel: user.papel } };
  });

  app.post('/usuarios', {
    preHandler: [app.authenticate], schema: { ...autenticado, tags: ['Usuários'], body: { type: 'object', required: ['nome', 'email', 'senha', 'papel'], properties: { nome: { type: 'string', minLength: 2 }, email: { type: 'string', format: 'email' }, senha: { type: 'string', minLength: 8 }, papel: { type: 'string', enum: enumValues(Papel) } } } }
  }, async (request, reply) => {
    const criado = await service.criarUsuario(request.body as { nome: string; email: string; senha: string; papel: Papel }, usuario(request).papel);
    return reply.code(201).send({ id: criado.id, nome: criado.nome, email: criado.email, papel: criado.papel });
  });

  app.post('/organizacoes', {
    preHandler: [app.authenticate], schema: { ...autenticado, tags: ['Organizações'], body: { type: 'object', required: ['codigo', 'nome', 'cnpj'], properties: { codigo: { type: 'string', minLength: 1 }, nome: { type: 'string', minLength: 2 }, cnpj: { type: 'string', minLength: 14 } } } }
  }, async (request, reply) => reply.code(201).send(await service.criarOrganizacao(request.body as { codigo: string; nome: string; cnpj: string }, usuario(request).papel)));

  app.get('/organizacoes', { preHandler: [app.authenticate], schema: { ...autenticado, tags: ['Organizações'] } }, () => service.listarOrganizacoes());

  app.post('/contratos', {
    preHandler: [app.authenticate], schema: { ...autenticado, tags: ['Contratos'], body: { type: 'object', required: ['organizacaoId', 'numero', 'inicio'], properties: { organizacaoId: { type: 'string', format: 'uuid' }, numero: { type: 'string' }, inicio: { type: 'string', format: 'date-time' }, fim: { type: 'string', format: 'date-time' }, clausulas: {} } } }
  }, async (request, reply) => reply.code(201).send(await service.criarContrato(request.body as { organizacaoId: string; numero: string; inicio: string; fim?: string }, usuario(request).papel)));

  app.post('/lotes', {
    preHandler: [app.authenticate], schema: { ...autenticado, tags: ['Lotes'], summary: 'Cria lote e equipamentos em transação', body: { type: 'object', required: ['organizacaoId', 'notaFiscal', 'transportadora', 'dataEntrada'], properties: { organizacaoId: { type: 'string', format: 'uuid' }, notaFiscal: { type: 'string' }, transportadora: { type: 'string' }, dataEntrada: { type: 'string', format: 'date-time' }, equipamentos: { type: 'array', items: { type: 'object', required: ['codigoBarrasInterno', 'tipo'], properties: { codigoBarrasInterno: { type: 'string' }, tipo: { type: 'string' }, marca: { type: 'string' }, modelo: { type: 'string' }, estadoFisico: { type: 'string', enum: enumValues(EstadoFisico) } } } } } } }
  }, async (request, reply) => reply.code(201).send(await service.criarLote(request.body as never, usuario(request).papel)));

  app.get('/lotes', { preHandler: [app.authenticate], schema: { ...autenticado, tags: ['Lotes'] } }, () => service.listarLotes());

  app.patch('/equipamentos/:id/triagem', {
    preHandler: [app.authenticate], schema: { ...autenticado, tags: ['Equipamentos'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } }, body: { type: 'object', required: ['versao'], properties: { versao: { type: 'integer', minimum: 1 } } } }
  }, async (request) => {
    const { id } = request.params as { id: string };
    const { versao } = request.body as { versao: number };
    return service.concluirTriagem(id, versao, usuario(request).id, usuario(request).papel);
  });

  app.patch('/equipamentos/:id/status', {
    preHandler: [app.authenticate], schema: { ...autenticado, tags: ['Equipamentos'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } }, body: { type: 'object', required: ['status', 'versao'], properties: { status: { type: 'string', enum: enumValues(StatusEquipamento) }, versao: { type: 'integer', minimum: 1 }, justificativa: { type: 'string' } } } }
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status: StatusEquipamento; versao: number; justificativa?: string };
    return service.atualizarStatus(id, body.status, body.versao, usuario(request).id, usuario(request).papel, body.justificativa);
  });

  app.patch('/equipamentos/:id/estado-fisico', {
    preHandler: [app.authenticate], schema: { ...autenticado, tags: ['Equipamentos'], params: { type: 'object', required: ['id'], properties: { id: { type: 'string', format: 'uuid' } } }, body: { type: 'object', required: ['estadoFisico', 'versao'], properties: { estadoFisico: { type: 'string', enum: enumValues(EstadoFisico) }, versao: { type: 'integer', minimum: 1 }, justificativa: { type: 'string' } } } }
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { estadoFisico: EstadoFisico; versao: number; justificativa?: string };
    return service.atualizarEstadoFisico(id, body.estadoFisico, body.versao, usuario(request).id, usuario(request).papel, body.justificativa);
  });

  app.get('/equipamentos/:codigo/rastreabilidade', {
    preHandler: [app.authenticate], schema: { ...autenticado, tags: ['Equipamentos'], params: { type: 'object', required: ['codigo'], properties: { codigo: { type: 'string' } } } }
  }, async (request) => service.rastrearEquipamento((request.params as { codigo: string }).codigo));
}
