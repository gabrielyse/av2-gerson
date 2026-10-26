CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "Papel" AS ENUM ('ADMIN', 'OPERADOR', 'ALMOXARIFE', 'AUDITOR');
CREATE TYPE "StatusEquipamento" AS ENUM ('RECEBIDO', 'TRIADO', 'DESMONTE', 'REUTILIZACAO', 'RECICLAGEM', 'DESCARTE');
CREATE TYPE "EstadoFisico" AS ENUM ('EXCELENTE', 'BOM', 'REGULAR', 'RUIM', 'IRRECUPERAVEL');

CREATE TABLE "Usuario" (
    "id" UUID NOT NULL, "nome" TEXT NOT NULL, "email" TEXT NOT NULL, "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL, "versao" INTEGER NOT NULL DEFAULT 1, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Organizacao" (
    "id" UUID NOT NULL, "codigo" TEXT NOT NULL, "nome" TEXT NOT NULL, "cnpj" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organizacao_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Contrato" (
    "id" UUID NOT NULL, "organizacaoId" UUID NOT NULL, "numero" TEXT NOT NULL, "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3), "clausulas" JSONB, "versao" INTEGER NOT NULL DEFAULT 1, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Lote" (
    "id" UUID NOT NULL, "organizacaoId" UUID NOT NULL, "notaFiscal" TEXT NOT NULL, "transportadora" TEXT NOT NULL,
    "dataEntrada" TIMESTAMP(3) NOT NULL, "versao" INTEGER NOT NULL DEFAULT 1, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Equipamento" (
    "id" UUID NOT NULL, "loteId" UUID NOT NULL, "codigoBarrasInterno" TEXT NOT NULL, "tipo" TEXT NOT NULL,
    "marca" TEXT, "modelo" TEXT, "status" "StatusEquipamento" NOT NULL DEFAULT 'RECEBIDO',
    "estadoFisico" "EstadoFisico" NOT NULL DEFAULT 'BOM', "triagemConcluida" BOOLEAN NOT NULL DEFAULT false,
    "versao" INTEGER NOT NULL DEFAULT 1, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Equipamento_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Movimentacao" (
    "id" UUID NOT NULL, "equipamentoId" UUID NOT NULL, "usuarioId" UUID NOT NULL,
    "statusAnterior" "StatusEquipamento", "statusNovo" "StatusEquipamento", "estadoFisicoAnterior" "EstadoFisico",
    "estadoFisicoNovo" "EstadoFisico", "justificativa" TEXT, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Movimentacao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
CREATE UNIQUE INDEX "Organizacao_codigo_key" ON "Organizacao"("codigo");
CREATE UNIQUE INDEX "Organizacao_cnpj_key" ON "Organizacao"("cnpj");
CREATE UNIQUE INDEX "Contrato_organizacaoId_key" ON "Contrato"("organizacaoId");
CREATE UNIQUE INDEX "Contrato_numero_key" ON "Contrato"("numero");
CREATE UNIQUE INDEX "Lote_organizacaoId_notaFiscal_key" ON "Lote"("organizacaoId", "notaFiscal");
CREATE UNIQUE INDEX "Equipamento_codigoBarrasInterno_key" ON "Equipamento"("codigoBarrasInterno");
CREATE INDEX "Movimentacao_equipamentoId_criadoEm_idx" ON "Movimentacao"("equipamentoId", "criadoEm");

ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Equipamento" ADD CONSTRAINT "Equipamento_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
