import 'dotenv/config';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { Prisma } from '@prisma/client';
import { registrarRotas } from './controllers/greencode.controller.js';
import { AppError } from './lib/errors.js';
import { prisma } from './lib/prisma.js';

const segredo = process.env.JWT_SECRET;
if (!segredo) throw new Error('JWT_SECRET deve ser definido.');

const app = Fastify({ logger: true });

await app.register(jwt, { secret: segredo });
await app.register(swagger, {
  openapi: {
    info: { title: 'greencode API', version: '2.0.0', description: 'API de logística reversa de equipamentos eletrônicos.' },
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }
  }
});
await app.register(swaggerUi, { routePrefix: '/docs' });

app.decorate('authenticate', async function (request) {
  await request.jwtVerify();
  request.usuario = request.user;
});

app.get('/health', { schema: { tags: ['Infraestrutura'], summary: 'Verifica a disponibilidade do servidor' } }, async () => ({ status: 'ok' }));
await registrarRotas(app);

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof AppError) return reply.code(error.statusCode).send({ erro: error.message });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return reply.code(409).send({ erro: 'Registro duplicado para um campo único.' });
  if (typeof error === 'object' && error !== null && 'validation' in error) return reply.code(400).send({ erro: (error as unknown as Error).message });
  app.log.error(error);
  return reply.code(500).send({ erro: 'Erro interno do servidor.' });
});

const encerrar = async () => {
  await app.close();
  await prisma.$disconnect();
};
process.once('SIGINT', () => void encerrar());
process.once('SIGTERM', () => void encerrar());

try {
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  await encerrar();
  process.exit(1);
}
