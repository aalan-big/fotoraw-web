-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "plano" AS ENUM ('GRATUITO', 'PRO');

-- CreateEnum
CREATE TYPE "status_plano" AS ENUM ('ATIVO', 'TRIAL', 'INADIMPLENTE', 'CANCELADO');

-- CreateEnum
CREATE TYPE "tipo_galeria" AS ENUM ('EVENTO', 'PRIVADO');

-- CreateEnum
CREATE TYPE "modo_venda" AS ENUM ('AVULSO', 'PACOTE', 'ENTREGA');

-- CreateEnum
CREATE TYPE "status_galeria" AS ENUM ('RASCUNHO', 'PUBLICADA', 'ARQUIVADA');

-- CreateEnum
CREATE TYPE "status_pedido" AS ENUM ('ABERTO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'EXPIRADO', 'CANCELADO', 'REEMBOLSADO');

-- CreateEnum
CREATE TYPE "provedor_pagamento" AS ENUM ('ASAAS', 'MERCADO_PAGO');

-- CreateEnum
CREATE TYPE "metodo_pagamento" AS ENUM ('PIX', 'CARTAO');

-- CreateEnum
CREATE TYPE "status_pagamento" AS ENUM ('PENDENTE', 'CONFIRMADO', 'RECUSADO', 'ESTORNADO');

-- CreateEnum
CREATE TYPE "status_assinatura" AS ENUM ('ATIVA', 'PENDENTE', 'INADIMPLENTE', 'CANCELADA');

-- CreateTable
CREATE TABLE "contas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "plano" "plano" NOT NULL DEFAULT 'GRATUITO',
    "status_plano" "status_plano" NOT NULL DEFAULT 'ATIVO',
    "api_token_hash" TEXT,
    "api_token_criado_em" TIMESTAMP(3),
    "provedor_pagamento" "provedor_pagamento",
    "provedor_pagamento_ref" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinaturas" (
    "id" UUID NOT NULL,
    "conta_id" UUID NOT NULL,
    "plano" "plano" NOT NULL,
    "status" "status_assinatura" NOT NULL DEFAULT 'PENDENTE',
    "provedor" "provedor_pagamento" NOT NULL,
    "provedor_ref" TEXT NOT NULL,
    "valor_mensal" DECIMAL(10,2) NOT NULL,
    "inicio_em" TIMESTAMP(3) NOT NULL,
    "proxima_cobranca" TIMESTAMP(3),
    "cancelada_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assinaturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "galerias" (
    "id" UUID NOT NULL,
    "conta_id" UUID NOT NULL,
    "ensaio_id_desktop" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "tipo_galeria" NOT NULL,
    "modo_venda" "modo_venda" NOT NULL,
    "status" "status_galeria" NOT NULL DEFAULT 'RASCUNHO',
    "preco_foto" DECIMAL(10,2),
    "fotos_incluidas" INTEGER,
    "preco_extra" DECIMAL(10,2),
    "capa_url" TEXT,
    "senha_hash" TEXT,
    "publicada_em" TIMESTAMP(3),
    "expira_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "galerias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos" (
    "id" UUID NOT NULL,
    "galeria_id" UUID NOT NULL,
    "foto_id_desktop" TEXT NOT NULL,
    "preview_key" TEXT NOT NULL,
    "alta_key" TEXT,
    "largura" INTEGER,
    "altura" INTEGER,
    "numero_identificacao" TEXT,
    "preco" DECIMAL(10,2),
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fotos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compradores" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT,
    "cpf" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" UUID NOT NULL,
    "numero" SERIAL NOT NULL,
    "galeria_id" UUID NOT NULL,
    "comprador_id" UUID NOT NULL,
    "conta_id" UUID NOT NULL,
    "status" "status_pedido" NOT NULL DEFAULT 'ABERTO',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "comissao" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "expira_em" TIMESTAMP(3),
    "pago_em" TIMESTAMP(3),
    "sincronizado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_pedido" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "foto_id" UUID NOT NULL,
    "preco_unitario" DECIMAL(10,2) NOT NULL,
    "incluida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "itens_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamentos" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "provedor" "provedor_pagamento" NOT NULL,
    "metodo" "metodo_pagamento" NOT NULL,
    "provedor_ref" TEXT NOT NULL,
    "status" "status_pagamento" NOT NULL DEFAULT 'PENDENTE',
    "valor" DECIMAL(10,2) NOT NULL,
    "pix_qr_code" TEXT,
    "pix_copia_cola" TEXT,
    "pix_expira_em" TIMESTAMP(3),
    "payload" JSONB,
    "confirmado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks_recebidos" (
    "id" UUID NOT NULL,
    "provedor" "provedor_pagamento" NOT NULL,
    "evento_ref" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processado_em" TIMESTAMP(3),
    "erro" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_recebidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downloads" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "foto_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "baixado_em" TIMESTAMP(3),
    "contagem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "downloads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contas_slug_key" ON "contas"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "contas_email_key" ON "contas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contas_api_token_hash_key" ON "contas"("api_token_hash");

-- CreateIndex
CREATE INDEX "assinaturas_conta_id_idx" ON "assinaturas"("conta_id");

-- CreateIndex
CREATE UNIQUE INDEX "assinaturas_provedor_provedor_ref_key" ON "assinaturas"("provedor", "provedor_ref");

-- CreateIndex
CREATE INDEX "galerias_status_publicada_em_idx" ON "galerias"("status", "publicada_em");

-- CreateIndex
CREATE UNIQUE INDEX "galerias_conta_id_slug_key" ON "galerias"("conta_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "galerias_conta_id_ensaio_id_desktop_key" ON "galerias"("conta_id", "ensaio_id_desktop");

-- CreateIndex
CREATE INDEX "fotos_galeria_id_numero_identificacao_idx" ON "fotos"("galeria_id", "numero_identificacao");

-- CreateIndex
CREATE INDEX "fotos_galeria_id_ordem_idx" ON "fotos"("galeria_id", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "fotos_galeria_id_foto_id_desktop_key" ON "fotos"("galeria_id", "foto_id_desktop");

-- CreateIndex
CREATE INDEX "compradores_email_idx" ON "compradores"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_numero_key" ON "pedidos"("numero");

-- CreateIndex
CREATE INDEX "pedidos_conta_id_status_idx" ON "pedidos"("conta_id", "status");

-- CreateIndex
CREATE INDEX "pedidos_conta_id_sincronizado_em_idx" ON "pedidos"("conta_id", "sincronizado_em");

-- CreateIndex
CREATE INDEX "pedidos_galeria_id_idx" ON "pedidos"("galeria_id");

-- CreateIndex
CREATE INDEX "pedidos_comprador_id_idx" ON "pedidos"("comprador_id");

-- CreateIndex
CREATE UNIQUE INDEX "itens_pedido_pedido_id_foto_id_key" ON "itens_pedido"("pedido_id", "foto_id");

-- CreateIndex
CREATE INDEX "pagamentos_pedido_id_idx" ON "pagamentos"("pedido_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamentos_provedor_provedor_ref_key" ON "pagamentos"("provedor", "provedor_ref");

-- CreateIndex
CREATE INDEX "webhooks_recebidos_processado_em_idx" ON "webhooks_recebidos"("processado_em");

-- CreateIndex
CREATE UNIQUE INDEX "webhooks_recebidos_provedor_evento_ref_key" ON "webhooks_recebidos"("provedor", "evento_ref");

-- CreateIndex
CREATE UNIQUE INDEX "downloads_token_key" ON "downloads"("token");

-- CreateIndex
CREATE UNIQUE INDEX "downloads_pedido_id_foto_id_key" ON "downloads"("pedido_id", "foto_id");

-- AddForeignKey
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "galerias" ADD CONSTRAINT "galerias_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos" ADD CONSTRAINT "fotos_galeria_id_fkey" FOREIGN KEY ("galeria_id") REFERENCES "galerias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_galeria_id_fkey" FOREIGN KEY ("galeria_id") REFERENCES "galerias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_comprador_id_fkey" FOREIGN KEY ("comprador_id") REFERENCES "compradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_pedido" ADD CONSTRAINT "itens_pedido_foto_id_fkey" FOREIGN KEY ("foto_id") REFERENCES "fotos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_foto_id_fkey" FOREIGN KEY ("foto_id") REFERENCES "fotos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

