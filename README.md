# greencode — AV2

Servidor monolítico para logística reversa de eletrônicos. A implementação da AV2 migra o domínio para uma API REST em Node.js/TypeScript, Fastify, Prisma e PostgreSQL.

## Execução

Requer Node.js 22+ e PostgreSQL 14+. Os comandos funcionam no Windows 10+ (PowerShell), Ubuntu 24.04.03+ e derivados.

```bash
cp .env.example .env
# ajuste DATABASE_URL e JWT_SECRET no .env
npm install
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

Acesse `http://localhost:3000/docs` para a documentação OpenAPI interativa. O login inicial usa `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` do `.env`. Para produção, defina credenciais e segredo próprios antes de executar o seed.

## Endpoints

- `POST /auth/login`
- `POST /usuarios` (ADMIN)
- `POST|GET /organizacoes`
- `POST /contratos`
- `POST|GET /lotes`
- `PATCH /equipamentos/:id/triagem`
- `PATCH /equipamentos/:id/status`
- `PATCH /equipamentos/:id/estado-fisico`
- `GET /equipamentos/:codigo/rastreabilidade`

Exceto login e health check, os endpoints exigem `Authorization: Bearer <token>`. As rotas de escrita verificam os papéis ADMIN, OPERADOR ou ALMOXARIFE conforme a operação; AUDITOR possui somente consulta.

## Arquitetura e decisões

A estrutura Controller → Service → Repository isola HTTP, regras de negócio e Prisma. O PostgreSQL mantém as relações Organização–Contrato/Lote–Equipamento–Movimentação, chaves estrangeiras e unicidade de CNPJ/código de barras. A migration inicial está em `prisma/migrations`.

JWT mantém a API stateless e carrega somente id e papel. Senhas usam bcrypt com custo 12; o segredo JWT vem exclusivamente de variável de ambiente. Transações Prisma protegem criação de lote com equipamentos e toda alteração acompanhada por movimentação. O campo `versao` evita atualização perdida: envie a versão atual em cada `PATCH`; divergência retorna 409.

Regras mantidas no serviço: CNPJ válido, data de entrada entre hoje e os últimos 90 dias, triagem antes de desmonte e justificativa para queda de duas ou mais categorias do estado físico. Erros de validação retornam 400, credenciais inválidas 401, falta de permissão 403, recurso ausente 404, e conflito/versão obsoleta 409. O encerramento SIGINT/SIGTERM fecha HTTP e Prisma de forma ordenada.
