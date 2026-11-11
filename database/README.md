# Estrutura relacional do KHKI

## Diagnóstico

As tabelas de produção estão no schema privado `khki` do PostgreSQL do Supabase. O Table Editor pode abrir inicialmente o schema `public`, que não contém as tabelas da aplicação. Selecione `khki` no seletor de schema. No SQL Editor, execute `inspect.sql` para conferir tabelas, relações e migrações.

O banco anterior já possuía chaves estrangeiras entre autores, banheiros, avaliações e fotos. A mudança completa os vínculos de denúncias, decisões e recibos, normaliza listas e retira os arquivos da persistência relacional. Não é necessário expor as tabelas na Data API do Supabase. A autenticação e a autorização continuam no Spring; RLS sem políticas públicas mantém acesso direto bloqueado.

## Modelo

- `app_users`: autores e administradores.
- `bathrooms`: local, coordenadas, acesso, acessibilidade e estado de moderação.
- `reviews`: avaliações vinculadas a autor e banheiro. `photo_only=true` identifica exclusivamente registros históricos sem comentário e sem notas; novos envios avulsos são proibidos. Esses registros não entram na média nem na contagem de avaliações com nota.
- `bathrooms.image_urls` e `reviews.image_urls`: listas de URLs em colunas JSONB diretamente nos respectivos conteúdos, sem tabelas de imagens.
- `bathroom_items` e `bathroom_types`: coleções normalizadas, com PK composta e FK para catálogos de valores permitidos.
- `reports`, `moderation_audit` e `submission_receipts`: destinos tipados com FKs e uma restrição que exige exatamente um destino compatível com `target_type` e `target_id`.
- `image_deletions`: fila persistente para repetir exclusões físicas que falhem temporariamente.
- `spring_session` e `spring_session_attributes`: sessões persistentes; seus bytes são atributos de sessão, não imagens.

Não existe entidade ou tabela de foto. `imageUrls` é uma lista de strings mapeada com `@JdbcTypeCode(SqlTypes.JSON)`. Apenas o banheiro e a avaliação possuem status, recebem denúncias e são moderados. O arquivo privado é lido por `/api/photos/{id}` após autorização sobre o conteúdo pai.

Os vínculos JPA usam `@ManyToOne`, `@OneToMany`, `@JoinColumn`, `@CollectionTable`, `@JdbcTypeCode` e `FetchType.LAZY`. Os IDs escalares existentes continuam como entrada compatível dos serviços; as associações que compartilham essas colunas são de leitura (`insertable=false, updatable=false`). As entidades têm campos privados e getters/setters para respeitar os proxies do Hibernate. Não se usa `CascadeType.REMOVE` sobre usuários ou conteúdo moderado. Remover conteúdo continua sendo uma decisão auditável, sem apagar seus vínculos históricos.

## Criar um banco vazio sem iniciar a aplicação

`schema.sql` contém o DDL completo do modelo novo para PostgreSQL 17, incluindo chaves, índices, catálogos e RLS. Não contém usuários, senhas, arquivos nem a seed. Execute apenas em um banco vazio:

```powershell
psql --dbname=CONEXAO_CONFIGURADA -v ON_ERROR_STOP=1 -f database/schema.sql
```

Use `.pgpass` ou o gerenciador de segredos para autenticar; não grave senhas no comando. A aplicação usa `ddl-auto=validate`: Hibernate valida o esquema, sem criá-lo nem alterá-lo automaticamente.

Se o esquema foi criado manualmente, inicie com `SPRING_FLYWAY_ENABLED=false` e configure o schema JPA e a tabela de sessões como `khki`. Para voltar a gerenciar esse banco com Flyway, estabeleça explicitamente o baseline na versão 14 antes de habilitá-lo; não aplique V1 sobre o esquema pronto. O fluxo habitual de bancos existentes continua pelas migrações versionadas.

## Armazenamento das imagens

O banco guarda uma URL estável como `/api/photos/UUID`, não o JPEG. Essa URL passa pelo backend para verificar aprovação, autor e perfil administrativo. Não se deve persistir uma URL assinada que expire nem publicar o bucket de anexos pendentes.

Desenvolvimento:

```text
MEDIA_STORAGE_DRIVER=local
MEDIA_STORAGE_DIRECTORY=./data/images
```

Produção com bucket R2 privado:

```text
MEDIA_STORAGE_DRIVER=r2
R2_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
R2_BUCKET=NOME_DO_BUCKET
R2_ACCESS_KEY_ID=CONFIGURAR_NO_GERENCIADOR_DE_SEGREDOS
R2_SECRET_ACCESS_KEY=CONFIGURAR_NO_GERENCIADOR_DE_SEGREDOS
```

Crie uma credencial limitada ao bucket necessário. O SDK S3 usa a região `auto`. O aplicativo recusa o armazenamento local no perfil `production`, pois o disco efêmero do Render perderia os arquivos. O backend continua validando formato, tamanho, dimensões e reencodificando imagens recebidas para JPEG sem metadados.

## Migrar dados existentes

Não execute `schema.sql` para atualizar produção. A migração das imagens exige uma janela sem uploads nem decisões concorrentes, backup completo do banco e armazenamento persistente configurado.

1. Habilite o R2 no painel da Cloudflare, crie o bucket privado e configure as variáveis do backend.
2. Faça backup do PostgreSQL e confirme que pode restaurá-lo. Preserve também os arquivos exportados durante toda a janela de rollback.
3. Configure `MEDIA_MIGRATE_LEGACY=true` somente para a execução da migração.
4. A aplicação aplica V10, que acrescenta `photos.storage_url` sem apagar bytes. O exportador copia cada imagem não removida, lê o arquivo novamente e compara o conteúdo integral. Só então grava a URL confirmada.
5. V11 recusa avançar se houver imagem sem URL de exportação, anexo incoerente ou listas com valores fora dos catálogos. Copia os IDs, estados, motivos, datas e versões para as coleções, converte fotos avulsas em avaliações sem nota e retira a tabela `photos`.
6. V12 adiciona FKs tipadas aos destinos e a fila de exclusões. V13 aplica RLS às novas tabelas de produção.
7. V14 incorpora as URLs aos conteúdos, redireciona referências históricas e remove as tabelas de imagens. Anexos com estado diferente do pai são preservados em avaliações históricas com o mesmo estado, sem publicação indevida.
8. Confira contagens, URLs, notas e moderação antes de liberar os uploads. Volte `MEDIA_MIGRATE_LEGACY=false`.

Arquivos exportados têm chaves determinísticas `images/UUID.jpg` no R2. Uma tentativa de exportação interrompida pode ser repetida sem duplicar arquivos. As migrações históricas V1–V9 permanecem imutáveis. O SQL e o código novos precisam ser publicados juntos; a versão antiga do backend consulta a tabela `photos`.

O SQL impede remover bytes não exportados, mas não substitui a cópia dos arquivos nem o backup. O rollback depois de V11 exige restaurar o backup e a versão anterior da aplicação; não basta trocar o código.

## Contratos e validação

Login, permissões, IDs das imagens, leitura e galeria permanecem. O upload avulso foi removido: é necessário anexar a um cadastro ou a uma avaliação pendente do próprio autor. A resposta do upload identifica o conteúdo pai, e não uma contribuição de foto. Somente `BATHROOM` e `REVIEW` são alvos válidos. A decisão de moderação é aplicada ao conteúdo inteiro, incluindo imagens. A organização dos pacotes e os contratos alterados estão em `../backend/README.md`.

Os testes exercitam o fluxo HTTP com Spring MockMvc, PostgreSQL e H2, incluindo moderação, privacidade, idempotência, sessão e restrições do banco. `RelationalMigrationTest` valida exportação, preservação de metadados, bloqueio de migração sem cópia confirmada e rejeição de referências inválidas. Os testes locais não comprovam credenciais nem operação do R2 de produção.

A publicação anterior de V13 foi verificada em produção. V14 e a reorganização por caso de uso são uma nova alteração: a execução local dos testes não significa que essa versão já foi publicada no Render ou aplicada no Supabase.
