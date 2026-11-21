# Backend KHKI

## Organização por caso de uso

`br.com.khki.usecase` reúne cada fluxo com seus controllers, serviços, entidades e repositórios. Não existe mais um controller ou serviço central que misture todos os conteúdos.

| Pacote | Responsabilidade |
| --- | --- |
| `account` | `User`, `UserRepository`, cadastro, autenticação e usuário atual |
| `bathroom` | `Bathroom`, `AccessType`, consulta, detalhes, cadastro, correção e proximidade |
| `review` | `Review`, consulta e envio/correção de avaliações |
| `contribution` | Contribuições do autor, sem recibos de envio |
| `report` | Denúncias autenticadas de banheiro ou avaliação |
| `moderation` | Fila, decisões, denúncias e auditoria |
| `image` | Upload de anexos e leitura autorizada dos arquivos, sem entidade ou tabela de foto |

`shared.api` contém os contratos HTTP e o tratamento de erros. `shared.domain` reúne estado de moderação e referências comuns. `infrastructure` contém segurança/sessões, armazenamento privado, migrações, inicialização e health check.

As entidades mantêm nomes do domínio em inglês: `User`, `Bathroom`, `Review`, `Report` e `ModerationAudit`. `AppUser` foi renomeada para `User`, `AppUserRepository` para `UserRepository`, `Access` para `AccessType` e `AdminController` para `ModerationController`. A entidade `User` está mapeada na tabela `user`, entre aspas no SQL por ser uma palavra reservada. V16 renomeia `app_users` preservando seus registros e relações. O `User` do Spring Security é referenciado explicitamente para não confundir os dois modelos.

Controllers delegam aos serviços do fluxo; serviços coordenam transações e consultam repositórios. Spring continua descobrindo os componentes abaixo de `KhkiApplication`. `BathroomService` e `ReviewService` reutilizam as regras de autoria e os DTOs de `ContributionService`; este depende somente dos repositórios, evitando uma dependência circular entre serviços.

## Imagens anexadas ao conteúdo

Cada `Bathroom` e `Review` tem `imageUrls`, uma lista de URLs persistida diretamente na coluna JSONB `image_urls`. Não existem tabelas `photos`, `bathroom_images` ou `review_images`, nem entidade JPA Foto. Os arquivos ficam no R2 privado em produção; o banco guarda somente as URLs estáveis da API. A lista é um valor do conteúdo, não um recurso moderável independente.

- Cadastro: o autor envia as fotos enquanto seu banheiro está pendente.
- Avaliação: o autor envia as fotos enquanto sua avaliação está pendente e o banheiro está publicado.
- Upload avulso é rejeitado no backend, inclusive para administradores.
- Aprovar, rejeitar ou ocultar o conteúdo determina também a visibilidade de todas as suas fotos.
- Remover o conteúdo enfileira a exclusão física dos seus anexos.
- Somente `BATHROOM` e `REVIEW` são alvos de denúncia, auditoria e decisão.

A galeria continua usando `photoIds` e `/api/photos/{id}` para leitura compatível. O POST multipart `/api/bathrooms/{id}/photos` exige `registrationAttachment=true` ou `reviewId`, e retorna a contribuição do conteúdo pai. A validação de JPG/PNG, tamanho, dimensões, reprocessamento e remoção de metadados permanece. As permissões são conferidas no servidor.

O frontend removeu o envio avulso, denúncias de fotos e decisões independentes sobre anexos. Links antigos `/banheiros/:id/fotos` redirecionam ao formulário de avaliação, que exige notas e permite foto opcional. A galeria e as denúncias de banheiro/avaliação permanecem.

## Migração e compatibilidade

V1–V13 permanecem imutáveis. A migração Java V14 move as URLs das tabelas anteriores para os pais e redireciona denúncias, auditorias e recibos antigos. Fotos históricas avulsas permanecem como avaliações legadas sem nota; novos envios nesse formato não são permitidos e essas avaliações não entram na média. Quando um anexo tinha estado diferente do pai, V14 preserva esse estado em uma avaliação histórica sem nota, evitando publicar imagens pendentes/rejeitadas e preservando os arquivos. O histórico não é apagado.

O esquema PostgreSQL completo está em `../database/schema.sql`. A arquitetura e o DDL não devem ser confundidos com o diagrama ilustrativo: uma URL não é um número inteiro, e imagens múltiplas exigem uma lista. Sessões, auditoria e restrições relacionais continuam preservadas. V15 remove `submission_receipts` e todo o controle de recibos/hash; V16 renomeia `app_users` para `user`.

## Validação

Execute `mvn test` para os fluxos HTTP e as regras de segurança. Para testar contra PostgreSQL local isolado, configure `TEST_DATABASE_URL`, `TEST_DATABASE_USER` e `TEST_DATABASE_PASSWORD`. O teste `StandaloneSchemaTest` requer PostgreSQL e verifica que a API inicia contra o DDL independente, com Hibernate em modo de validação e Flyway desativado. Os testes não alteram o Supabase ou o R2 de produção.

Verificação histórica da V14: 36 testes no PostgreSQL 17, sem falhas; suíte H2 sem falhas (o teste de DDL independente exige PostgreSQL). O backup de produção foi restaurado e migrado em banco local isolado: 21 banheiros, 72 avaliações com nota e 41 URLs preservadas, sem tabelas de imagens. As mesmas 33 imagens públicas foram lidas e as 8 privadas retornaram 404; nomes, notas, contagens e conjuntos de fotos públicas foram comparados com o baseline. O build Angular passou com os avisos de orçamento já existentes. Esta validação não representa publicação da V14 em produção.

## Remoção de recibos e nome da tabela de usuários

V15 remove `submission_receipts`, e V16 renomeia `app_users` para `"user"`, preservando dados, FKs e RLS. As migrações anteriores permanecem imutáveis para bancos antigos continuarem migrando. O Hibernate usa o nome delimitado de `user`. O DDL independente já representa a versão 16.

O contrato `submissionId` e a rota `/api/me/submissions/{id}` foram removidos. Cadastro e upload não calculam hashes nem guardam recibos. O frontend compartilha a requisição em andamento, bloqueia o botão e mantém o ID de um cadastro cuja resposta foi confirmada. Fotos confirmadas não são reenviadas. Se a resposta se perder, o formulário bloqueia a repetição automática e orienta conferir Minhas contribuições. Isso não garante idempotência entre abas, recargas ou requisições independentes.

Verificação da remoção dos recibos e renomeação: 34 testes passaram no PostgreSQL 17, incluindo migração, preservação do usuário, autenticação, sessões e DDL independente. Dois testes de navegador passaram para envio em andamento/resposta perdida e repetição apenas de fotos recusadas com resposta confirmada. O frontend compilou com os avisos de orçamento já existentes. V15 e V16 ainda não foram aplicadas em produção.
