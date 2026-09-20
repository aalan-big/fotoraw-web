-- Licença de trial passa a registrar de qual plano veio (prefixo "plano:<id> · " no motivo,
-- a mesma convenção da emissão manual). É assim que o admin conta as licenças ativas de um
-- plano e as reemite quando o plano muda. Corrige as já emitidas.
UPDATE "licencas"
SET "motivo" = 'plano:' || p."id" || ' · ' || COALESCE("motivo", 'trial no cadastro')
FROM "planos" p
WHERE p."codigo" = 'pro_mensal'
  AND "licencas"."tipo" = 'trial'
  AND ("licencas"."motivo" IS NULL OR "licencas"."motivo" NOT LIKE 'plano:%');
