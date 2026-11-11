# Estrutura relacional do KHKI

## Diagnóstico

As tabelas de produção estão no schema privado `khki` do PostgreSQL do Supabase. O Table Editor pode abrir inicialmente o schema `public`, que não contém as tabelas da aplicação. Selecione `khki` no seletor de schema. No SQL Editor, execute `inspect.sql` para conferir tabelas, relações e migrações.

O banco anterior já possuía chaves estrangeiras entre autores, banheiros, avaliações e fotos. A mudança completa os vínculos de denúncias, decisões e recibos, normaliza listas e retira os arquivos da persistência relacional. Não é necessário expor as tabelas na Data API do Supabase. A autenticação e a autorização continuam no Spring; RLS sem políticas públicas mantém acesso direto bloqueado.

## Modelo

- `app_users`: autores e administradores.
- `bathrooms`: local, coordenadas, acesso, acessibilidade e estado de moderação.
- `reviews`: avaliações vinculadas a autor e banheiro. `photo_only=true` representa envio avulso de imagem, sem comentário e sem notas. Esses registros não entram na média nem na contagem de avaliações com nota.
- `bathroom_images`: URLs e metadados dos anexos do cadastro, com FK para o banheiro.
- `review_images`: URLs e metadados dos anexos da avaliação, com FK para a avaliação.
- `bathroom_items` e `bathroom_types`: coleções normalizadas, com PK composta e FK para catálogos de valores permitidos.
- `reports`, `moderation_audit` e `submission_receipts`: destinos tipados com FKs e uma restrição que exige exatamente um destino compatível com `target_type` e `target_id`.
- `image_deletions`: fila persistente para repetir exclusões físicas que falhem temporariamente.
- `spring_session` e `spring_session_attributes`: sessões persistentes; seus bytes são atributos de sessão, não imagens.

Não existe mais uma entidade JPA `Photo`. `ImageReference` é um valor `@Embeddable`, armazenado com `@ElementCollection` no banheiro ou na avaliação. `ImageContribution` é apenas uma projeção de compatibilidade para as rotas existentes `/photos` e para as telas que usam o tipo `PHOTO`.

Os vínculos JPA usam `@ManyToOne`, `@OneToMany`, `@JoinColumn`, `@CollectionTable`, `@OrderColumn` e `FetchType.LAZY`. Os IDs escalares existentes continuam como entrada compatível dos serviços; as associações que compartilham essas colunas são de leitura (`insertable=false, updatable=false`). As entidades têm campos privados e getters/setters para respeitar os proxies do Hibernate. Não se usa `CascadeType.REMOVE` sobre usuários ou conteúdo moderado. Remover conteúdo continua sendo uma decisão auditável, sem apagar seus vínculos históricos.

## Criar um banco vazio sem iniciar a aplicação

`schema.sql` contém o DDL completo do modelo novo para PostgreSQL 17, incluindo chaves, índices, catálogos e RLS. Não contém usuários, senhas, arquivos nem a seed. Execute apenas em um banco vazio:

```powershell
psql --dbname=CONEXAO_CONFIGURADA -v ON_ERROR_STOP=1 -f database/schema.sql
```

Use `.pgpass` ou o gerenciador de segredos para autenticar; não grave senhas no comando. A aplicação usa `ddl-auto=validate`: Hibernate valida o esquema, sem criá-lo nem alterá-lo automaticamente.

Se o esquema foi criado manualmente, inicie com `SPRING_FLYWAY_ENABLED=false` e configure o schema JPA e a tabela de sessões como `khki`. Para voltar a gerenciar esse banco com Flyway, estabeleça explicitamente o baseline na versão 12 antes de habilitá-lo; não aplique V1 sobre o esquema pronto. O fluxo habitual de bancos existentes continua pelas migrações versionadas.

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
7. Confira contagens, URLs, notas e moderação antes de liberar os uploads. Volte `MEDIA_MIGRATE_LEGACY=false`.

Arquivos exportados têm chaves determinísticas `images/UUID.jpg` no R2. Uma tentativa de exportação interrompida pode ser repetida sem duplicar arquivos. As migrações históricas V1–V9 permanecem imutáveis. O SQL e o código novos precisam ser publicados juntos; a versão antiga do backend consulta a tabela `photos`.

O SQL impede remover bytes não exportados, mas não substitui a cópia dos arquivos nem o backup. O rollback depois de V11 exige restaurar o backup e a versão anterior da aplicação; não basta trocar o código.

## Contratos e validação

As rotas, IDs de fotos, DTOs, login, permissões, galeria e filas atuais foram mantidos. Fotos de cadastro ou de avaliação continuam acompanhando a aprovação do pai. Fotos avulsas continuam aparecendo como `PHOTO` na API por compatibilidade, embora sua persistência seja uma avaliação sem comentário e sem nota. Ocultar o pai continua ocultando suas imagens publicamente.

Os testes exercitam o fluxo HTTP com Spring MockMvc, PostgreSQL e H2, incluindo moderação, privacidade, idempotência, sessão e restrições do banco. `RelationalMigrationTest` valida exportação, preservação de metadados, bloqueio de migração sem cópia confirmada e rejeição de referências inválidas. Os testes locais não comprovam credenciais nem operação do R2 de produção.

Em 11/11/2026, a inspeção de produção encontrou 21 banheiros, 72 avaliações e 41 imagens no schema `khki`. O backup foi restaurado em um PostgreSQL local e migrado com sucesso: 72 avaliações com nota, 32 avaliações somente com fotos, 2 URLs de anexos de cadastro e 39 URLs de anexos de avaliações. A API dessa cópia abriu 17 banheiros públicos e 33 imagens públicas. O R2 foi habilitado pelo responsável pela conta, o bucket privado `khki` foi confirmado e uma credencial de leitura/escrita restrita a esse bucket foi configurada no Render. A aplicação aplica a migração coordenada durante a publicação; a confirmação da execução em produção depende do estado do deploy e das verificações posteriores.
