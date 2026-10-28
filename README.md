# KHKI

Aplicação acadêmica para encontrar, cadastrar e avaliar banheiros acessíveis ao público. Frontend Angular com SCSS + API Java Spring Boot, sessão segura, moderação humana e persistência relacional.

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

## Banco de dados

Sem variáveis, a aplicação usa **H2 persistente** em `backend/data/khki`. Isso permite executar a apresentação sem Docker. H2 console fica desabilitado. Flyway aplica `V1__initial_schema.sql`, e Hibernate valida o schema sem alterá-lo.

Para PostgreSQL, copie `.env.example` para `.env` e escolha uma senha local. Inicie Docker Desktop, execute `docker compose up -d database` e use:

```dotenv
DATABASE_URL=jdbc:postgresql://localhost:5432/khki
DATABASE_USER=khki
DATABASE_PASSWORD=sua-senha-local
```


Neste computador, o Windows bloqueou a porta 5432. A configuração local em `.env` usa `DATABASE_PORT=15432` e `DATABASE_URL=jdbc:postgresql://localhost:15432/khki`. O Compose aceita `DATABASE_PORT` e usa 5432 quando a variável não está definida. A senha local foi gerada aleatoriamente e não é versionada. A aplicação em execução usa PostgreSQL; os registros da base H2 anterior não foram transferidos.

## Administrador e demonstração

Não há administrador nem credenciais fixas no código. Antes de iniciar o backend, configure `ADMIN_EMAIL` e `ADMIN_PASSWORD` em `.env` ou no ambiente. Use uma senha de pelo menos 12 caracteres e até 72 bytes. A inicialização cria a conta com perfil ADMIN somente se o e-mail ainda não existir. Não promove uma conta USER existente nem troca sua senha silenciosamente. Cadastre-se e entre normalmente para contribuir como USER.

Se quiser manter H2 e configurar somente o administrador, crie `.env` com apenas `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Copiar todas as variáveis de `.env.example` seleciona PostgreSQL e exige o banco em execução.

Para carregar **três locais fictícios**, configure `DEMO_DATA=true` antes da primeira inicialização de uma base vazia. Os cards e detalhes identificam esses locais como demonstração. Eles não têm notas, fotos ou disponibilidade inventadas. O carregamento não se repete se já houver banheiros no banco. Desativar a variável não apaga dados previamente carregados. Não use a opção em um ambiente com usuários reais.

## Geoapify + MapLibre e rotas a pé


## Organização e decisões para o reviewer

| Área | Arquivos | Motivo |
| --- | --- | --- |
| Páginas | `frontend/src/app/features/` | Fluxos separados, carregados sob demanda pelo router |
| HTTP, sessão e mapa | `frontend/src/app/core/` | Centraliza contrato, comunicação, autenticação e integração externa |
| Componentes compartilhados | `frontend/src/app/shared/` | Reutiliza ícones, cards, mapa, login e denúncia |
| Controllers/DTOs | `backend/.../api/` | Entrada validada e retorno explícito, sem expor usuários ou senhas |
| Regras | `backend/.../service/` | Publicação, média, privacidade e transições no servidor |
| Persistência | `backend/.../domain/`, `repository/` | Entidades JPA e repositórios injetados por construtor |
| Segurança | `backend/.../security/` | Sessão HttpOnly, CSRF, BCrypt, CORS, perfis e limite básico de POSTs |
| Migração | `backend/src/main/resources/db/migration/` | Schema versionado pelo Flyway |

Fotos ficam como bytes privados no banco, adequados ao MVP de pequeno volume. O backend valida assinatura/formato real, tamanho e resolução e regrava JPEG sem metadados originais. A aprovação é humana, sem promessa de detecção automática de pessoas/reflexos. Uma foto rejeitada não rejeita seu cadastro ou avaliação. Ao remover uma foto, os bytes são apagados, mantendo o registro de moderação.

O perfil ADMIN é exigido na cadeia Spring Security e no serviço de moderação. Ocultar um banheiro também impede consulta pública a suas avaliações e fotos. Avaliações negativas podem ser aprovadas e contam na média. O usuário pode corrigir e reenviar banheiros/avaliações rejeitados. As decisões mantêm responsável, data, motivo e alvo. Motivos e nomes são renderizados como texto pelo Angular, sem `innerHTML`.

## Testes

```powershell
# Na pasta backend, banco em memória isolado
mvn.cmd test

# Na raiz, com API em execução: cria conta e contribuição PENDING de teste

# Na raiz, PostgreSQL do Compose já iniciado e .env configurado
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-postgres.ps1

# Na pasta frontend
npm.cmd run test:config
npm.cmd run build
npm.cmd audit
npx.cmd playwright install chromium
npm.cmd test
```



## Escopo pronto e limites

Prontos: consulta pública e filtros por acesso/acessibilidade/fraldário; detalhes e fotos aprovadas; cadastro/login/logout; preservação da intenção após login; cadastro com revisão, duplicados por proximidade/nome e fotos opcionais; avaliações com duas notas; contribuições privadas; moderação, denúncias, ocultação/restauração/remoção e auditoria; cadastro e avaliação rejeitados com reenvio; integração Geoapify + MapLibre implementada com estados de ausência/falha.

Limites deliberados: horário é texto informativo (sem indicador automático “aberto agora”); não há recuperação de senha/e-mail transacional, navegação por voz, acompanhamento contínuo, paginação de grandes volumes, antispam distribuído ou armazenamento de objetos. Pesquisa pública retorna até 200 aprovados; fila/histórico ainda não são paginados. Duplicidade considera apenas locais aprovados para não expor contribuições privadas. Fotos rejeitadas são privadas e podem ser substituídas por novo envio, sem editor de fotos na área de contribuições. A ordem por nome/nota evita fingir proximidade sem localização.

Antes de disponibilizar para usuários reais: validar Geoapify com a chave real, configurar HTTPS e cookies Secure, backups e criptografia do disco/banco, retenção/exclusão de dados pessoais, responsável pela moderação, proxy confiável e limites distribuídos. As senhas já usam BCrypt; a aplicação não implementa criptografia própria do volume de fotos. Para produção, sirva o build Angular com fallback para `index.html` e encaminhe `/api` ao backend no mesmo domínio.
