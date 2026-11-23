# KHKI

Aplicação acadêmica para encontrar, cadastrar e avaliar banheiros acessíveis ao público. Frontend Angular com SCSS + API Java Spring Boot, sessão segura, moderação humana e persistência relacional.

## Apresentar em outro PC Windows

Para uma instalação nova, instale Git (se for clonar), **Node.js 22.12 ou superior dentro da linha 22**, **JDK 17** e **Maven 3.9.x**. Java deve ser o JDK completo, com `java` e `javac` no PATH; Maven precisa usar esse mesmo JDK. Não é necessário instalar Angular globalmente, Docker, PostgreSQL, JMeter ou configurar Supabase/R2 para executar a aplicação com o banco H2 local.

Confira no CMD ou PowerShell, reabrindo o terminal após instalar as ferramentas:

```text
node --version
npm --version
java -version
javac -version
mvn -version
```

No CMD ou PowerShell:

```text
git clone --branch main https://github.com/CRyanAlves/KHKI.git
cd KHKI
npm.cmd ci --prefix frontend
```

Se já tiver uma cópia limpa, atualize com `git pull --ff-only origin main` em vez de clonar novamente. Se levar o projeto por ZIP, extraia a pasta completa; os arquivos da pasta `scripts` são necessários para iniciar e gerar a configuração do frontend.

Na raiz, crie um arquivo chamado `.env` (não `.env.txt`) com este conteúdo mínimo para a apresentação local:

```dotenv
DEMO_DATA=true
FRONTEND_ORIGIN=http://127.0.0.1:4200
COOKIE_SECURE=false
MEDIA_STORAGE_DRIVER=local
DEV_ROUTE_SIMULATION=false
```

Não copie `.env.example` inteiro para esse modo: ele seleciona PostgreSQL. Sem `DATABASE_URL`, o backend usa H2 persistente e cria a estrutura pelas migrações Flyway. A base nova contém três banheiros fictícios com `DEMO_DATA=true`; ela não recebe os dados ou as contas da produção. Para contribuir, cadastre um usuário pela interface. Para demonstrar moderação, acrescente `ADMIN_EMAIL` e `ADMIN_PASSWORD` ao `.env` antes de iniciar, usando um e-mail de demonstração e uma senha própria de pelo menos 12 caracteres e até 72 bytes.

Para mapa, busca de endereços e rotas reais, acrescente `GEOAPIFY_API_KEY` com sua chave Geoapify e confirme que as restrições dessa chave permitem `http://127.0.0.1:4200`. Sem chave válida, a aplicação abre, mas a integração de mapas fica limitada. Não leve credenciais de banco ou de R2 de produção para o computador da aula.

Inicie com dois cliques em `iniciar.bat`, ou no terminal:

```text
.\iniciar.bat
```

No Git Bash, use `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start.ps1` ou abra `iniciar.bat` pelo Explorador. Acesse [http://127.0.0.1:4200](http://127.0.0.1:4200). Aguarde tanto a compilação do Angular quanto a inicialização da API; a abertura automática do navegador, sozinha, não confirma que a API terminou de iniciar. A saúde deve responder `{"status":"UP"}` em [http://127.0.0.1:8080/api/health](http://127.0.0.1:8080/api/health).

Faça a primeira instalação e inicialização com internet antes da aula: npm e Maven precisam baixar dependências, e a integração de mapas/rotas também requer internet. Mantenha as portas 8080 e 4200 livres. O iniciador é voltado ao Windows; instruções de execução manual ficam abaixo.

Para os testes de carga, veja [o guia JMeter](tests/jmeter/README.md). Eles exigem instalar o Apache JMeter separadamente no outro PC; a instalação existente neste computador não acompanha o repositório. Os comandos npm e relatórios locais ainda não publicados precisam ser levados junto se você for demonstrá-los.

## Executar somente os testes de produção em outro PC

Não é necessário iniciar o Angular ou a API local, instalar PostgreSQL, Docker ou Maven, configurar `.env`, nem executar `npm ci --prefix frontend`. Os testes consultam a aplicação já publicada em `https://khki.cradev.workers.dev`, que usa o backend e o banco de produção.

Instale Node.js 22.12 ou superior na linha 22 e o JDK 17 completo (com `java` e `jar` no PATH). Na raiz, execute `npm run setup:jmeter` para baixar, verificar e extrair o Apache JMeter 5.6.3 automaticamente na pasta dos testes. Extraia o JMeter em `%USERPROFILE%\tools\apache-jmeter-5.6.3` para detecção automática, ou configure `JMETER_HOME` conforme [o guia JMeter](tests/jmeter/README.md). A instalação do JMeter e os relatórios deste computador não fazem parte do clone do Git. Copie os arquivos locais atualizados ou publique as alterações antes de clonar no PC da aula.

Na raiz do projeto, estes comandos são iguais no CMD, PowerShell e Git Bash:

```text
npm run test:jmeter:production:preflight
npm run test:jmeter:production
```

O primeiro executa somente a consulta de saúde. O segundo executa a verificação de saúde e, se passar, um usuário por 60 segundos, somente com consultas GET. Não há cadastro, avaliação ou upload. Os relatórios são salvos em `tests/jmeter/results/production/<data-hora>/`; abra o `index.html` da nova execução. As dependências do frontend não são usadas por esses executores, que utilizam módulos nativos do Node.js e o JMeter instalado.

O computador precisa de internet e a produção precisa estar saudável. Se Supabase estiver pausado, Render indisponível ou houver erro HTTP/de contrato no pré-teste, a etapa de carga não inicia. Rodar o teste não reativa esses serviços automaticamente. Um teste concluído sem erros ainda precisa ter latência e p95 avaliados.

## Executar no Windows

Requisitos verificados neste ambiente: Node.js **22.20.0**, Java **17.0.19**, Maven **3.9.15**. Angular **21.2.25**, CLI/build **21.2.28**, TypeScript **5.9**, Spring Boot **3.5.16**; versões efetivamente instaladas em `frontend/package-lock.json` e `backend/pom.xml`. Angular 21 foi escolhido por ser compatível com o Node instalado, conforme a [matriz oficial](https://angular.dev/reference/versions). Não é necessário instalar Angular globalmente.

Na pasta `frontend`, instale uma vez:

```powershell
npm.cmd ci
```

Na raiz do projeto, dê dois cliques em **iniciar.bat**, ou execute `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start.ps1`. O iniciador abre o navegador e executa os dois serviços; Ctrl+C encerra o iniciador. Ele lê as variáveis de `.env` se o arquivo existir. Não executa Docker nem instala dependências automaticamente.

Para iniciar manualmente, use **dois terminais**:

```powershell
# Terminal 1, pasta backend
mvn.cmd spring-boot:run
```

```powershell
# Terminal 2, pasta frontend
npm.cmd start
```

Abra [http://127.0.0.1:4200](http://127.0.0.1:4200). API em `http://127.0.0.1:8080/api`, encaminhada pelo proxy do Angular. Use sempre o mesmo hostname durante a sessão, pois os cookies de `localhost` e `127.0.0.1` são diferentes. Em execução manual, variáveis de `.env` não são carregadas automaticamente pelo Spring: exporte-as no terminal ou use o iniciador.

## Formatar o código

Na raiz, execute `npm.cmd run format` para aplicar o Prettier em todos os arquivos suportados da aplicação, incluindo Angular, SCSS, Java, scripts, JSON, YAML e Markdown. Execute `npm.cmd run format:check` para apenas conferir. As dependências ficam no frontend: `npm.cmd ci --prefix frontend`.

O comando reutiliza `frontend/.prettierrc`, sem vírgulas finais e com largura de 400 caracteres. Java usa `prettier-plugin-java`. Dependências, builds, arquivos gerados, dados, lockfiles e segredos são ignorados. Formatos sem parser configurado, como SQL e XML, não são alterados.

## Banco de dados

Sem variáveis, a aplicação usa **H2 persistente** em `backend/data/khki`. Isso permite executar a apresentação sem Docker. H2 console fica desabilitado. Flyway aplica as migrações versionadas, e Hibernate valida o schema sem alterá-lo. Consulte [a estrutura relacional e a migração das imagens](database/README.md) antes de atualizar uma base existente.

Para PostgreSQL, copie `.env.example` para `.env` e escolha uma senha local. Inicie Docker Desktop, execute `docker compose up -d database` e use:

```dotenv
DATABASE_URL=jdbc:postgresql://localhost:5432/khki
DATABASE_USER=khki
DATABASE_PASSWORD=sua-senha-local
```

Reinicie o backend com essas variáveis. O volume `khki-postgres` mantém os dados. H2 e PostgreSQL são bases independentes: mudar a URL não copia os registros. As migrações usam Flyway. Os testes rápidos usam H2 por padrão; o executor PostgreSQL utiliza uma base isolada.

Se a porta 5432 estiver ocupada ou bloqueada no novo computador, use `DATABASE_PORT=15432` e `DATABASE_URL=jdbc:postgresql://localhost:15432/khki` no `.env`. O Compose aceita `DATABASE_PORT` e usa 5432 por padrão. Não é necessário usar esse caminho para uma apresentação com H2.

## Administrador e demonstração

Não há administrador nem credenciais fixas no código. Antes de iniciar o backend, configure `ADMIN_EMAIL` e `ADMIN_PASSWORD` em `.env` ou no ambiente. Use uma senha de pelo menos 12 caracteres e até 72 bytes. A inicialização cria a conta com perfil ADMIN somente se o e-mail ainda não existir. Não promove uma conta USER existente nem troca sua senha silenciosamente. Cadastre-se e entre normalmente para contribuir como USER.

Se quiser manter H2 e configurar somente o administrador, crie `.env` com apenas `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Copiar todas as variáveis de `.env.example` seleciona PostgreSQL e exige o banco em execução.

Para carregar **três locais fictícios**, configure `DEMO_DATA=true` antes da primeira inicialização de uma base vazia. Eles não têm notas, fotos ou disponibilidade inventadas. O carregamento não se repete se já houver banheiros no banco. Desativar a variável não apaga dados previamente carregados. Não use a opção em um ambiente com usuários reais.

## Geoapify + MapLibre e rotas a pé

Configure `GEOAPIFY_API_KEY` no ambiente ou no `.env`. O comando de configuração publica somente os parâmetros de navegador em `frontend/public/config.js`. MapLibre renderiza o mapa; Geoapify fornece estilos, geocodificação e rotas. Credenciais de banco e sessão permanecem no backend.

## Estrutura do projeto

| Área                        | Arquivos                                   | Motivo                                                               |
| --------------------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| Páginas                     | `frontend/src/app/features/`               | Fluxos separados, carregados sob demanda pelo router                 |
| HTTP, sessão e preferências | `frontend/src/app/core/`                   | Infraestrutura HTTP, sessão autenticada, guards e tema               |
| Modelos de domínio          | `frontend/src/app/domain/`                 | Tipos de banheiro, avaliação, usuário, moderação e localização       |
| Layout persistente          | `frontend/src/app/layout/`                 | Mantém mapa, painéis e navegação mobile entre os casos de uso        |
| Integração de mapas         | `frontend/src/app/integrations/maps/`      | MapLibre, Geoapify e seletor de endereço compartilhado               |
| Componentes compartilhados  | `frontend/src/app/shared/`                 | Controles genéricos, diretivas, validações e utilitários             |
| Design system               | `frontend/src/styles/`                     | Temas e componentes usando tokens compartilhados                     |
| Controllers/DTOs            | `backend/src/main/java/br/com/khki/usecase/<caso>/controller/` e `dto/`                         | Entrada validada e retorno explícito, sem expor usuários ou senhas   |
| Regras                      | `backend/src/main/java/br/com/khki/usecase/<caso>/service/`                     | Publicação, média, privacidade e transições no servidor              |
| Persistência                | `backend/src/main/java/br/com/khki/usecase/<caso>/model/` e `model/repository/`       | Entidades JPA e repositórios injetados por construtor                |
| Segurança                   | `backend/src/main/java/br/com/khki/infrastructure/security/`                    | Sessão HttpOnly, CSRF, BCrypt, CORS, perfis e limite básico de POSTs |
| Migração                    | `backend/src/main/resources/db/migration/` | Schema versionado pelo Flyway                                        |
| Testes de interface         | `frontend/e2e/`                            | Fluxos públicos, autenticados, moderação, cadastro e navegação       |

Fotos são arquivos privados, locais no desenvolvimento e no Cloudflare R2 em produção. O PostgreSQL guarda listas de URLs diretamente em colunas JSONB do banheiro e da avaliação, sem entidade ou tabela de foto. Novos envios avulsos não são permitidos: fotos só podem acompanhar um cadastro ou uma avaliação. Denúncias e moderação têm somente banheiro ou avaliação como alvo. O backend continua validando tamanho, formato e resolução, regravando JPEG sem metadados. Aprovação, rejeição e denúncias são humanas. A remoção física usa uma fila persistente de tentativas, preservando o histórico da moderação. O [guia do banco](database/README.md) explica configuração, SQL independente, relações e migração sem perda dos bytes antigos. A produção exige um bucket R2 configurado antes da publicação desta versão.

O perfil ADMIN é exigido na cadeia Spring Security e no serviço de moderação. Ocultar um banheiro também impede consulta pública a suas avaliações e fotos. Avaliações negativas podem ser aprovadas e contam na média. O usuário pode corrigir e reenviar banheiros/avaliações rejeitados. As decisões mantêm responsável, data, motivo e alvo. Motivos e nomes são renderizados como texto pelo Angular, sem `innerHTML`.

## Sessão e autenticação

O login usa Spring Security com Spring Session JDBC. As sessões ficam no banco, em tabelas criadas pelo Flyway, e podem ser recuperadas após a reinicialização da API enquanto estiverem válidas. O navegador recebe somente o identificador opaco em cookie `KHKI_SESSION`, com `HttpOnly`, `SameSite=Lax`, caminho `/` e `Secure` no perfil de produção. Senhas e identificadores de sessão não são gravados em `localStorage`.

`POST /api/auth/login` preserva os campos `email` e `password` e aceita `rememberMe` booleano opcional, com padrão `false`. Sem essa opção, o cookie dura a sessão do navegador, a inatividade máxima continua em 30 minutos e o limite absoluto é de 12 horas. Ao marcar “Manter conectado neste dispositivo”, cookie e sessão podem durar até 14 dias, sem renovação indefinida. `SESSION_REMEMBER_DURATION` e `SESSION_MAXIMUM_DURATION` permitem ajustar esses limites entre 1 segundo e 90 dias. O login troca o identificador da sessão; `POST /api/auth/logout`, protegido por CSRF, remove a sessão no banco, invalidando também uma cópia do cookie antigo.

O Angular trata `401` como ausência ou expiração da autenticação, mantém a conta diante de erros de conexão/servidor e não interpreta `403` como logout. Se a verificação inicial estiver indisponível, mostra uma ação de nova tentativa, sem exigir a senha novamente. A recuperação da sessão retoma o destino protegido que motivou a ação. As regras de autorização continuam sendo aplicadas no backend.

As tabelas de sessão usam o schema `khki` no perfil de produção. A migração desse perfil remove o acesso de `PUBLIC` e habilita RLS, seguindo o isolamento das demais tabelas; o usuário de banco da API precisa manter acesso ao schema e às tabelas. A primeira atualização para este modelo exige um novo login, pois as sessões antigas em memória não são migradas.

## Testes

```powershell
# Na pasta backend, banco em memória isolado
mvn.cmd test

# Na raiz, PostgreSQL do Compose já iniciado e .env configurado
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-postgres.ps1

# Na pasta frontend
npm.cmd run test:config
npm.cmd run build
npm.cmd audit
npx.cmd playwright install chromium
npm.cmd test
```

`npm.cmd test` inicia seus próprios serviços isolados nas portas **8082 e 4202**, além do servidor HTTP de mapas de teste na **4900**, com banco em memória, três locais de demonstração e senha administrativa aleatória mantida apenas no processo. O servidor de mapas está em `scripts/fixtures/geoapify.cjs` e utiliza somente o Node.js. Os serviços de teste são encerrados no final. O executor não depende dos serviços da apresentação nem altera seu banco. Requer Java, Maven, Node e Chromium instalado pelo Playwright; foi escrito para Windows. Para usar serviços já iniciados em 8080/4200, use `npm.cmd run test:running` (o teste administrativo exige variáveis próprias e será ignorado sem elas). Capturas e relatórios ficam em `test-results/`; falhas também têm trace.

O executor PostgreSQL cria um banco com nome aleatório, executa os mesmos testes Spring e remove somente esse banco ao terminar. As variáveis `TEST_DATABASE_URL`, `TEST_DATABASE_USER` e `TEST_DATABASE_PASSWORD` permitem selecionar o banco de testes sem alterar o datasource padrão. Os testes de interface usam respostas HTTP locais; a integração externa real depende da chave Geoapify.

## Escopo pronto e limites

Prontos: consulta pública e filtros por acesso/acessibilidade/fraldário; detalhes e fotos aprovadas; cadastro/login/logout; preservação da intenção após login; cadastro com revisão, duplicados por proximidade/nome e fotos opcionais; avaliações com duas notas; contribuições privadas; moderação, denúncias, ocultação/restauração/remoção e auditoria; cadastro e avaliação rejeitados com reenvio; integração Geoapify + MapLibre implementada com estados de ausência/falha.

Limites deliberados: horário é texto informativo (sem indicador automático “aberto agora”); não há recuperação de senha/e-mail transacional, navegação por voz, acompanhamento contínuo, paginação de grandes volumes, antispam distribuído. Pesquisa pública retorna até 200 aprovados; fila/histórico ainda não são paginados. Duplicidade considera apenas locais aprovados para não expor contribuições privadas. Fotos rejeitadas são privadas e podem ser substituídas por novo envio, sem editor de fotos na área de contribuições. A ordem por nome/nota evita fingir proximidade sem localização.

Antes de disponibilizar para usuários reais: validar Geoapify com a chave real, configurar HTTPS e cookies Secure, backups e criptografia do disco/banco, retenção/exclusão de dados pessoais, responsável pela moderação, proxy confiável e limites distribuídos. As senhas já usam BCrypt; a aplicação não implementa criptografia própria do volume de fotos. Para produção, sirva o build Angular com fallback para `index.html` e encaminhe `/api` ao backend no mesmo domínio.

## Aplicação publicada

Acesse [KHKI](https://khki.cradev.workers.dev). O Angular está na Cloudflare, a API Java Spring no Render Free e o PostgreSQL no Supabase Free, em schema privado. O primeiro acesso à API pode demorar por suspensão do serviço gratuito. O Worker utiliza `cloudflare/wrangler.jsonc` e encaminha `/api` para `API_ORIGIN`. Após gerar o build Angular, execute os testes e o deploy na pasta `cloudflare`. O comando de publicação preserva as variáveis remotas com `--keep-vars`. Credenciais privadas devem permanecer no ambiente do serviço e fora do Git.

A organização dos casos de uso e as mudanças de contrato estão no [guia do backend](backend/README.md).

## Remoção de recibos e nome da tabela de usuários

V15 remove `submission_receipts`, e V16 renomeia `app_users` para `"user"`, preservando dados, FKs e RLS. As migrações anteriores permanecem imutáveis para bancos antigos continuarem migrando. O Hibernate usa o nome delimitado de `user`. O DDL independente já representa a versão 16.

O contrato `submissionId` e a rota `/api/me/submissions/{id}` foram removidos. Cadastro e upload não calculam hashes nem guardam recibos. O frontend compartilha a requisição em andamento, bloqueia o botão e mantém o ID de um cadastro cuja resposta foi confirmada. Fotos confirmadas não são reenviadas. Se a resposta se perder, o formulário bloqueia a repetição automática e orienta conferir Minhas contribuições. Isso não garante idempotência entre abas, recargas ou requisições independentes.