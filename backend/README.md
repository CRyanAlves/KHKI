# Backend KHKI

## Organização por caso de uso

`br.com.khki.usecase` reúne cada fluxo com seus controllers, serviços, entidades e repositórios. Não existe mais um controller ou serviço central que misture todos os conteúdos.

| Pacote         | Responsabilidade                                                                   |
| -------------- | ---------------------------------------------------------------------------------- |
| `account`      | `User`, `UserRepository`, cadastro, autenticação e usuário atual                   |
| `bathroom`     | `Bathroom`, `AccessType`, consulta, detalhes, cadastro, correção e proximidade     |
| `review`       | `Review`, consulta e envio/correção de avaliações                                  |
| `contribution` | Contribuições do autor, sem recibos de envio                                       |
| `report`       | Denúncias autenticadas de banheiro ou avaliação                                    |
| `moderation`   | Fila, decisões, denúncias e auditoria                                              |
| `image`        | Upload de anexos e leitura autorizada dos arquivos, sem entidade ou tabela de foto |

`shared.api` contém somente o tratamento transversal de erros (`ApiException` e `ApiErrors`). Cada caso de uso mantém seus contratos HTTP em um subpacote `dto`, sem concentrá-los em uma classe `Contracts`. `shared.domain` reúne estado de moderação e referências comuns. `infrastructure` contém segurança/sessões, armazenamento privado, migrações, inicialização e health check.

| Pacote de contratos | Responsabilidade                                                                     |
| ------------------- | ------------------------------------------------------------------------------------ |
| `account.dto`       | Entrada, cadastro de conta e dados públicos do usuário                               |
| `bathroom.dto`      | Entrada, detalhes, apresentação e resultados de proximidade/duplicidade de banheiros |
| `review.dto`        | Entrada e apresentação das avaliações                                                |
| `contribution.dto`  | Resumo das contribuições do autor, também reutilizado nas respostas de outros fluxos |
| `report.dto`        | Entrada e apresentação das denúncias                                                 |
| `image.dto`         | Identificação dos anexos, sem criar entidade ou moderação independente de foto       |
| `moderation.dto`    | Decisão, inspeção, fila e histórico de auditoria                                     |

Um DTO reutilizado mantém uma única definição no caso de uso responsável. Por exemplo, `ModerationDetail` referencia `BathroomView`, `ContributionView` e `ImageView` dos respectivos pacotes. A mudança dos tipos Java não altera nomes de campos JSON, validações, endpoints ou regras de negócio; o frontend e as coleções HTTP continuam usando os mesmos contratos.

## Autenticação e sessão

`AuthController` delega a entrada a `LoginService` e o cadastro/consulta da conta a `AccountService`. `LoginService` normaliza o e-mail e pede a autenticação ao `AuthenticationManager`; o `DaoAuthenticationProvider` usa `AccountDetailsService` e `PasswordEncoder` para carregar a conta e verificar a senha. A validação de credenciais não é duplicada no controller.

`AccountDetailsService` implementa a interface `UserDetailsService` do Spring Security. `SecurityConfig` recebe essa interface e não importa entidades ou repositórios de `usecase.account`, eliminando a dependência circular entre os pacotes de conta e segurança. A configuração HTTP e o caso de uso compartilham o mesmo `AuthenticationManager`.

`SessionAuthenticationService` renova o identificador da sessão existente e salva o contexto autenticado pelo `SecurityContextRepository` compartilhado com a cadeia de filtros. `SessionPolicy`, `SessionExpiryFilter` e `SessionConfiguration` continuam separados: definem os prazos, rejeitam sessões vencidas e configuram o cookie. As credenciais são apagadas pelo `ProviderManager` antes da persistência do contexto.

`LoginRequest`, `RegisterRequest` e `UserView` são contratos locais de conta. Os endpoints `/api/auth/csrf`, `/api/auth/login`, `/api/auth/register`, `/api/auth/me` e `/api/auth/logout`, os campos JSON e as respostas permanecem iguais. A autenticação continua por sessão HTTP com CSRF e cookie HttpOnly; não foram introduzidos JWT ou refresh token. O limite de 72 bytes do BCrypt, as mensagens de credenciais inválidas, as permissões, a limitação de tentativas e a opção de manter conectado são preservados. Falhas internas de autenticação continuam sendo tratadas como falhas do servidor, sem serem confundidas com senha incorreta.

As entidades mantêm nomes do domínio em inglês: `User`, `Bathroom`, `Review`, `Report` e `ModerationAudit`. `AppUser` foi renomeada para `User`, `AppUserRepository` para `UserRepository`, `Access` para `AccessType` e `AdminController` para `ModerationController`. A entidade `User` está mapeada na tabela `user`, entre aspas no SQL por ser uma palavra reservada. V16 renomeia `app_users` preservando seus registros e relações. O `User` do Spring Security é referenciado explicitamente para não confundir os dois modelos.

Controllers delegam aos serviços do fluxo; serviços coordenam transações e consultam repositórios. Spring continua descobrindo os componentes abaixo de `KhkiApplication`. `BathroomService` e `ReviewService` reutilizam as regras de autoria e os DTOs de `ContributionService`; este depende somente dos repositórios, evitando uma dependência circular entre serviços.

As associações JPA são as únicas responsáveis pelas chaves `author_id`, `bathroom_id`, `moderator_id`, `duplicate_of_id`, `bathroom_target_id` e `review_target_id`. Os serviços resolvem entidades existentes antes da gravação, mantêm carregamento `LAZY` e não propagam exclusões aos usuários ou banheiros associados. Em `ModerationAudit`, o destino é armazenado somente em `ContentReference`: `getTargetType()` e `getTargetId()` são propriedades derivadas, sem campos ou colunas próprios. `/api/admin/audit` e o histórico continuam retornando os mesmos DTOs, com `targetType` e `targetId` calculados pela referência. `Report` mantém seu contrato e mapeamento atuais.

## Imagens anexadas ao conteúdo

Cada `Bathroom` e `Review` herda de `BaseModeratedEntity` o atributo `imageUrls`, uma lista de URLs persistida diretamente na coluna JSONB `image_urls` de sua própria tabela. Não existem tabelas `photos`, `bathroom_images` ou `review_images`, nem entidade JPA Foto. Os arquivos ficam no R2 privado em produção; o banco guarda somente as URLs estáveis da API. A lista é um valor do conteúdo, não um recurso moderável independente.

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

V17 remove `target_type` e `target_id` de `moderation_audit`, preservando as referências já preenchidas, IDs, decisões, datas e moderadores. A restrição exige exatamente uma FK de destino; os índices existentes das FKs são preservados para consultar o histórico. As migrações V1–V16 não foram alteradas. No diagrama de classes, retire `targetId` de `ModerationAudit` e sua ligação com `TargetType`; mantenha a composição com `ContentReference`, que aponta para banheiro ou avaliação. O enum continua necessário em `Report` e nos contratos HTTP.

## Validação

Execute `mvn test` para os fluxos HTTP e as regras de segurança. Para testar contra PostgreSQL local isolado, configure `TEST_DATABASE_URL`, `TEST_DATABASE_USER` e `TEST_DATABASE_PASSWORD`. O teste `StandaloneSchemaTest` requer PostgreSQL e verifica que a API inicia contra o DDL independente, com Hibernate em modo de validação e Flyway desativado. Os testes não alteram o Supabase ou o R2 de produção.

Verificação histórica da V14: 36 testes no PostgreSQL 17, sem falhas; suíte H2 sem falhas (o teste de DDL independente exige PostgreSQL). O backup de produção foi restaurado e migrado em banco local isolado: 21 banheiros, 72 avaliações com nota e 41 URLs preservadas, sem tabelas de imagens. As mesmas 33 imagens públicas foram lidas e as 8 privadas retornaram 404; nomes, notas, contagens e conjuntos de fotos públicas foram comparados com o baseline. O build Angular passou com os avisos de orçamento já existentes. Esta validação não representa publicação da V14 em produção.

## Reaproveitamento de regras

`GeographicDistance` centraliza a distância em linha reta usada na busca de duplicados e na verificação de proximidade. A montagem de `BathroomView` consulta as avaliações aprovadas uma única vez e reaproveita o resultado para nota, contagem e imagens; registros legados sem nota continuam contribuindo apenas com suas imagens. A moderação reutiliza o mesmo banheiro detalhado na resposta, uma única montagem de auditoria e as entidades já carregadas. Os contratos HTTP, as permissões, as regras de transição e as migrações históricas permanecem preservados.

## Remoção de recibos e nome da tabela de usuários

V15 remove `submission_receipts`, e V16 renomeia `app_users` para `"user"`, preservando dados, FKs e RLS. As migrações anteriores permanecem imutáveis para bancos antigos continuarem migrando. O Hibernate usa o nome delimitado de `user`. O DDL independente já representa a versão 17.

O contrato `submissionId` e a rota `/api/me/submissions/{id}` foram removidos. Cadastro e upload não calculam hashes nem guardam recibos. O frontend compartilha a requisição em andamento, bloqueia o botão e mantém o ID de um cadastro cuja resposta foi confirmada. Fotos confirmadas não são reenviadas. Se a resposta se perder, o formulário bloqueia a repetição automática e orienta conferir Minhas contribuições. Isso não garante idempotência entre abas, recargas ou requisições independentes.

Verificação da remoção dos recibos e renomeação: 34 testes passaram no PostgreSQL 17, incluindo migração, preservação do usuário, autenticação, sessões e DDL independente. Dois testes de navegador passaram para envio em andamento/resposta perdida e repetição apenas de fotos recusadas com resposta confirmada. O frontend compilou com os avisos de orçamento já existentes. V15 e V16 ainda não foram aplicadas em produção.
