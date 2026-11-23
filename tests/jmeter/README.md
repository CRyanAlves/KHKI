# Testes da API KHKI com Apache JMeter

## Preparar o JMeter automaticamente em outro PC

Instale **Node.js 22.12 ou superior na linha 22** e **JDK 17 completo**, deixando `node`, `java` e `jar` disponíveis no PATH. Baixe ou clone a versão atualizada do KHKI e abra o terminal na raiz do projeto. No Bash, CMD ou PowerShell:

```bash
npm run setup:jmeter
npm run test:jmeter:production:preflight
npm run test:jmeter:production -- --requests=100
```

`setup:jmeter` baixa o ZIP binário oficial do Apache JMeter 5.6.3 para `tests/jmeter/tools/`, compara seu SHA-512 com o valor oficial fixado no instalador e somente então extrai os arquivos. A instalação fica em `tests/jmeter/tools/apache-jmeter-5.6.3/`. O ZIP é mantido como cache; ambos ficam ignorados pelo Git. Não é necessário criar uma Release do KHKI nem versionar uma cópia da ferramenta: o download vem diretamente do arquivo oficial da Apache.

O instalador não baixa Node.js ou Java, não inicia a aplicação e não envia consultas de teste para produção. A extração usa o comando `jar` do JDK, sem dependências npm adicionais. Em caso de checksum inválido, download incompleto ou instalação local preexistente sem confirmação de integridade, ele falha em vez de sobrescrever os arquivos. Uma instalação já preparada por ele é reutilizada ao repetir o comando.

Os executores escolhem a instalação nesta ordem: `JMETER_HOME` explícito, instalação em `tests/jmeter/tools/apache-jmeter-5.6.3` e instalação em `~/tools/apache-jmeter-5.6.3`. Se existir um `JMETER_HOME` antigo apontando para uma pasta inexistente, corrija ou remova essa variável; a opção explícita não é ignorada silenciosamente.

Para levar tudo por pendrive e evitar o download na aula, execute `setup:jmeter` antes e copie a pasta do projeto incluindo `tests/jmeter/tools/`. Ao usar um clone/ZIP do GitHub, essa pasta não vem junto e precisa ser preparada no outro computador. Consultas à produção continuam exigindo internet. Para o teste local, Maven também deve estar instalado.

## Onde encontrar tudo

Esta pasta concentra os planos, o executor e todos os resultados JMeter já produzidos. Abra o [índice dos resultados](results/index.html) para acessar os resumos e dashboards de cada execução local ou de produção. Os relatórios são arquivos locais ignorados pelo Git.

```text
tests/jmeter/
  README.md                         Guia de execução e interpretação
  khki.jmx                          Plano local
  khki-production-preflight.jmx      Uma consulta de saúde em produção
  khki-production-readonly.jmx       Consultas públicas em produção
  run-local.cjs                     Executor local
  run-production.cjs                Executor de produção (pré-teste e um usuário)
  setup.cjs                         Download e extração com verificação SHA-512
  jmeter-installation.cjs            Descoberta compartilhada da instalação
  tools/                            JMeter e ZIP baixados, ignorados pelo Git
  results/
    index.html                      Índice com links para os relatórios
    local/                          Resultados locais por data
    production/                     Resultados de produção por data
```

Os arquivos `results.jtl` contêm as amostras; `summary.md` resume a execução; `dashboard/index.html` abre o relatório visual do JMeter. Os nomes das pastas usam data e hora UTC, preservadas das execuções originais. O executor local já salva novas execuções em `results/local`; ao executar produção manualmente, use uma pasta nova em `tests/jmeter/results/production/<data-hora>/` para `-l`, `-j` e `-o`. O índice lista as execuções reunidas nesta organização.


O plano `khki.jmx` executa requisições HTTP reais contra a API Java local. O executor `run-local.cjs` compila o backend, inicia uma instância isolada na porta 8083 e encerra essa instância ao concluir. O banco H2 é temporário, em modo de compatibilidade com PostgreSQL; armazenamento, conta administrativa e dados de demonstração são exclusivos do teste. Não são utilizados Supabase, R2 ou credenciais de produção.

## Executar

Requisitos: Java 17, Maven, Node.js 22 ou superior e a distribuição oficial do Apache JMeter 5.6.3. Baixe o ZIP em [Apache JMeter](https://jmeter.apache.org/download_jmeter.cgi), confira seu SHA-512 e extraia fora do repositório. Defina `JMETER_HOME` com o diretório de instalação. Sem essa variável, o executor procura primeiro na instalação preparada em `tests/jmeter/tools/apache-jmeter-5.6.3` e depois em `~/tools/apache-jmeter-5.6.3`. Você pode usar `npm run setup:jmeter` para baixar, verificar e extrair a distribuição automaticamente.

Na raiz do projeto, use `npm run test:jmeter` no Bash, CMD ou PowerShell após executar `npm run setup:jmeter` ou configurar `JMETER_HOME` para o seu terminal. Esse comando executa somente o ambiente local isolado.

Exemplo em PowerShell:

```powershell
# Informe o diretório de instalação do JMeter:
$env:JMETER_HOME = 'C:\Ferramentas\apache-jmeter-5.6.3'
npm run test:jmeter
```

A porta 8083 deve estar livre. O executor não encerra aplicações preexistentes. Ele gera uma senha aleatória local, não salva corpos de requisição ou resposta no JTL e remove o arquivo temporário de credenciais ao finalizar. Não publique logs que tenham sido gerados com opções extras de depuração HTTP.

## Perfil e verificações

| Etapa | Usuários públicos simultâneos | Duração pública | Subida gradual |
| --- | --- | --- | --- |
| Aquecimento | 1 | 10 segundos | 1 segundo |
| Carga inicial | 5 | 30 segundos | 5 segundos |
| Carga moderada local | 10 | 45 segundos | 10 segundos |

Cada etapa realiza seis consultas públicas por iteração: saúde, listagem, busca por nome, filtro de acesso/acessibilidade, detalhes e avaliações. Há uma pausa de 250 ms entre requisições. O banheiro utilizado nos detalhes é extraído da resposta da listagem, sem ID fixo.

Depois das consultas públicas de cada etapa, um único usuário virtual executa duas sessões autenticadas sequenciais: obter CSRF, entrar, obter CSRF novamente, consultar a conta, consultar contribuições, consultar a fila administrativa, sair e verificar que a conta retorna HTTP 401. O cookie é gerenciado pelo JMeter. O 401 posterior ao logout é um resultado esperado e validado, não uma falha de carga. O login não é submetido a dez usuários concorrentes; os números de concorrência da tabela se aplicam às consultas públicas.

O plano verifica os códigos HTTP e a estrutura/conteúdo relevante do JSON. Uma resposta 200 com corpo incorreto também falha. Se uma etapa apresentar falhas, o executor interrompe o aumento de carga.

## Resultados

Cada execução cria uma pasta nova em `tests/jmeter/results/local/<data-hora>/`, ignorada pelo Git:

- `summary.md` e `summary.json`: amostras, erros, média, percentis, vazão e resultados por endpoint.
- `<etapa>/results.jtl`: amostras individuais em CSV.
- `<etapa>/dashboard/index.html`: dashboard HTML nativo do JMeter.
- Logs de compilação, API e JMeter para diagnóstico local.

Abra `khki.jmx` na interface gráfica do JMeter para inspecionar ou editar o plano. O executor usa o modo CLI, recomendado pela Apache para gerar carga. Os relatórios também podem ser recriados a partir do JTL com `jmeter -g results.jtl -o dashboard`, usando uma pasta de saída nova ou vazia.

O critério inicial de observação é zero falhas e p95 até 1000 ms. Trata-se de uma referência para este ensaio, não de um SLA definido para o produto. O aquecimento é identificado separadamente.

Os percentis do resumo seguem a mesma convenção de interpolação do dashboard do JMeter. Amostras pequenas, especialmente as duas sessões autenticadas por etapa, não fornecem um percentil estável de desempenho do login.

## Limites da interpretação

Este ensaio não determina a capacidade máxima do sistema. A API e o gerador compartilham CPU e memória, usam três banheiros de demonstração e um banco H2 em memória. Não reproduz latência e volume do PostgreSQL/Supabase, suspensão do Render Free, CDN, R2 ou serviços de mapa. O JMeter testa o protocolo HTTP e não executa a interface Angular como um navegador; layout, teclado mobile, GPS e animações exigem testes de navegador. O plano não testa upload, cadastro, avaliação ou decisões de moderação por escrita.

Para avaliar produção ou estresse, defina antes o ambiente, o conjunto de dados, a concorrência, os limites e a janela autorizada. O executor `run-local.cjs` mantém o destino fixo em loopback para evitar carga acidental na aplicação publicada.

## Planos separados de produção

`khki-production-preflight.jmx` executa exatamente uma consulta GET de saúde em `https://khki.cradev.workers.dev/api/health`. O resultado deve ser HTTP 200 com JSON contendo `status: UP` antes de iniciar qualquer carga. O processo JMeter pode terminar com código zero mesmo com falhas de asserção; confira `success` no JTL ou `errorCount` nas estatísticas do dashboard.

`khki-production-readonly.jmx` contém apenas as seis consultas públicas GET, usa HTTPS na URL publicada e pausa de 1000 ms entre requisições. No modo padrão, a duração é de 60 segundos; o executor fixa um usuário e subida de um segundo. O modo `--requests` encerra por quantidade, conforme explicado abaixo; as propriedades internas `users` e `ramp` pertencem ao plano JMeter e não são argumentos npm liberados pelo executor. O banheiro dos detalhes é selecionado da listagem, sem identificador fixo, e o termo da busca é obtido de um resultado real. O plano encerra o teste ao encontrar uma falha HTTP ou de contrato.

O perfil autorizado nesta sessão foi de 1, 3 e 5 usuários, em etapas separadas de 60 segundos. As etapas não são promovidas automaticamente: a seguinte depende de uma análise saudável da anterior e de monitoramento durante a execução. Interrompa também em caso de degradação sustentada, sem esperar o fim da etapa. Esses planos não enviam login, cadastros, avaliações, denúncias, uploads ou decisões administrativas.

As primeiras tentativas de produção pararam no pré-teste por HTTP 429; nessas tentativas, a carga não chegou a começar. Posteriormente, houve execuções completas de um usuário, inclusive com 100 consultas, como documentado no guia explicativo ao final deste arquivo. O diagnóstico e o dashboard estão em `tests/jmeter/results/production/`, separados dos resultados locais. O pré-teste precisa passar antes de repetir o perfil na janela autorizada; não altere proteções de acesso para mascarar falhas do teste.

## Identificação do cliente em produção

Os dois planos de produção enviam `User-Agent: KHKI-PerformanceTest/1.0`, identificando explicitamente o cliente automatizado. Isso segue a orientação da Cloudflare para evitar bloqueios de assinatura associados ao User-Agent padrão das bibliotecas em `workers.dev`; não simula um navegador nem exige desativar proteções. Clientes auxiliares de diagnóstico também devem enviar um identificador descritivo.

Essa identificação não ignora limites de requisição. HTTP 429 continua sendo falha e deve interromper o teste, respeitando `Retry-After` quando presente. Antes de medir desempenho, confirme que o Supabase está ativo e a API responde HTTP 200 com `status: UP`; indisponibilidade do banco e inicialização do Render são problemas separados do bloqueio 403/1010.

Referência: [Cloudflare Error 1010](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/).

## Comandos npm para produção

Depois de executar `npm run setup:jmeter` ou configurar `JMETER_HOME`, use os mesmos comandos no Bash, CMD ou PowerShell, na raiz do projeto:

```bash
npm run test:jmeter:production:preflight
npm run test:jmeter:production
```

O primeiro executa somente uma consulta de saúde. O segundo começa pelo mesmo pré-teste e, se não houver falha HTTP ou de contrato JSON, executa um usuário por 60 segundos quando não recebe argumentos. Não há aumento automático para três ou cinco usuários. Os planos mantêm o destino HTTPS fixo e realizam somente consultas públicas GET.

Os resultados são salvos automaticamente em `tests/jmeter/results/production/<data-hora>-preflight/` ou `<data-hora>-1-vu/`. Abra `index.html` dentro da nova execução para acessar os dashboards, ou `summary.md` para o resumo. Falhas interrompem a execução e retornam código de saída diferente de zero, mesmo se o processo JMeter tiver terminado com código zero. O resumo registra o erro. Um p95 acima de 1000 ms gera aviso, não aprovação de desempenho.

## Executar por quantidade de consultas

Para executar até 100 consultas de carga sequenciais, com um único usuário, use:

```bash
npm run test:jmeter:production -- --requests=100
```

`--requests` aceita números inteiros entre 1 e 100. A requisição do pré-teste não entra nesse limite: uma execução completa de `--requests=100` contém uma consulta de saúde no pré-teste e 100 amostras na carga. As consultas seguem a sequência existente (saúde, listagem, busca, filtro, detalhes e avaliações), repetida até o limite, encerrando mesmo no meio do último ciclo para não arredondar para 102. A pausa de 1000 ms entre consultas é mantida.

Nesse modo não há corte aos 60 segundos; a duração depende das respostas. Uma falha HTTP ou de contrato interrompe o teste antes das 100 consultas. O executor também informa erro se o JMeter encerrar sem falhas, mas sem atingir a quantidade solicitada. Não há aumento de concorrência nem tentativas automáticas de repetir uma etapa com falha.

Os relatórios ficam em `tests/jmeter/results/production/<data-hora>-100-requests/`, com `preflight` e `load-1-vu` separados. O `summary.json` registra `mode: requests`, `requestLimit: 100` e `durationSeconds: null`; no modo antigo, `mode: duration` e `durationSeconds: 60`. Abra `index.html` da execução ou `summary.md` para consultar o resultado. Sem `--requests`, o comando mantém o comportamento de 60 segundos.

## Guia para iniciantes: o que fizemos e como tudo funciona

### O que é o Apache JMeter?

O Apache JMeter é uma ferramenta gratuita e de código aberto, escrita em Java, que envia pedidos a um sistema e mede as respostas. Esses pedidos são chamados de requisições. No KHKI, um exemplo é pedir à API a lista de banheiros. A API é a parte do sistema que recebe a solicitação, consulta os dados e devolve a resposta.

Imagine um atendente recebendo pedidos. O JMeter representa clientes fazendo esses pedidos: ele registra quantos foram atendidos, quanto demoraram e quantos deram errado. Podemos configurar uma pessoa pedindo uma coisa de cada vez ou várias pessoas pedindo ao mesmo tempo. Essas pessoas simuladas são os usuários virtuais; eles não precisam corresponder a contas cadastradas.

O JMeter não abre o Angular como uma pessoa navegando. Ele conversa diretamente com a API por HTTP, o protocolo usado para trocar mensagens na web. Portanto, nossos testes não medem a aparência da tela, animações, tempo de desenhar o mapa, teclado do celular ou GPS. Testes de navegador, como os do Playwright existentes no projeto, cobrem outra parte dessa experiência.

### O que queríamos verificar no KHKI?

Queríamos observar se as consultas devolvem respostas corretas e quanto tempo levam quando repetidas. Há duas perguntas diferentes: “a consulta funcionou?” e “ela foi rápida?”. Uma consulta pode funcionar sem erro e ainda levar vários segundos.

Separamos o ambiente local, criado apenas para os testes, da aplicação publicada. No teste local, conseguimos conferir também entrada, sessão e permissões com uma conta temporária. Em produção, usamos somente consultas públicas para não cadastrar banheiros, publicar avaliações, enviar arquivos ou tomar decisões de moderação durante a medição.

| Ambiente | Para onde vão os pedidos | Banco utilizado | Operações do ensaio |
| --- | --- | --- | --- |
| Local | API isolada em `127.0.0.1:8083` | H2 temporário em memória | Consultas públicas e duas sessões autenticadas sequenciais por etapa |
| Produção | `https://khki.cradev.workers.dev` | Banco real acessado pela API publicada | Somente consultas públicas GET |

O teste local não utiliza as credenciais do Supabase ou do R2. Já o teste de produção percorre o caminho público até a API real; por isso, o resultado inclui a rede e os serviços envolvidos nessa chamada. Ele não mede o banco isoladamente nem baixa automaticamente as fotos ou o mapa referenciados nas respostas.

### Qual é o papel de cada arquivo?

| Arquivo | Explicação simples |
| --- | --- |
| `package.json`, na raiz | Guarda os atalhos `npm run ...` que chamam os executores |
| `run-local.cjs` | Prepara a API local, chama o JMeter, lê os resultados e encerra a API de teste |
| `run-production.cjs` | Valida as opções, executa o pré-teste e chama o plano de produção escolhido |
| `khki.jmx` | Roteiro do teste local: pedidos, usuários, pausas, autenticação e verificações |
| `khki-production-preflight.jmx` | Roteiro com uma única consulta de saúde antes da carga |
| `khki-production-readonly.jmx` | Roteiro das seis consultas públicas, repetidas por tempo ou quantidade |
| `results.jtl`, gerado por execução | Registro de cada pedido: endereço, código de resposta, duração e sucesso ou falha |
| `summary.md` e `summary.json` | Resumos montados pelos nossos executores, para leitura humana e por programas |
| `dashboard/index.html` | Relatório visual nativo do JMeter, com tabelas e gráficos |
| `jmeter.log` | Mensagens internas do JMeter para investigar problemas na execução |

A extensão `.cjs` significa JavaScript no formato CommonJS. O Node.js executa esses arquivos, que usam `require()` para importar funções. Eles são os organizadores do teste, mas quem envia as requisições e mede suas respostas é o JMeter, iniciado pelo Java. Os planos `.jmx` são arquivos XML; também podem ser abertos e editados pela interface gráfica do JMeter.

### Como configuramos a ferramenta?

Instalamos a distribuição Apache JMeter 5.6.3 separadamente do projeto. O executor procura primeiro na pasta indicada pela variável de ambiente `JMETER_HOME`. Se ela não existir, procura primeiro em `tests/jmeter/tools/apache-jmeter-5.6.3` e depois em `tools/apache-jmeter-5.6.3` dentro da pasta pessoal do usuário. O comando `npm run setup:jmeter` prepara a instalação dentro do projeto, verificando o SHA-512 antes de extrair. Essa variável é apenas um endereço de instalação, não uma senha ou chave de acesso.

Java 17 inicia o arquivo `bin/ApacheJMeter.jar`. Node.js executa os organizadores `.cjs`. Para produção não é necessário iniciar a aplicação local, instalar Maven, PostgreSQL ou Docker. Para o teste local, Maven também é necessário porque o executor compila e inicia a API Java. Não é preciso instalar as dependências Angular para rodar somente esses testes JMeter.

Os executores iniciam o Java com `spawn`, uma função do Node.js que abre outro processo. Passamos o comando e a lista de argumentos separadamente, sem montar uma linha de shell com texto fornecido pelo usuário. O código aguarda o processo JMeter terminar antes de ler o resultado ou seguir para outra etapa.

| Argumento interno | O que significa |
| --- | --- |
| `-Xms128m` e `-Xmx512m` | Memória inicial e limite máximo da memória heap do processo Java |
| `-jar` | Arquivo Java do JMeter que será executado |
| `-d` | Pasta de instalação do JMeter |
| `-n` | Executar pelo terminal, sem abrir a interface gráfica |
| `-t` | Plano `.jmx` que deve ser utilizado |
| `-Jusers=1` | Propriedade do plano que define um usuário virtual |
| `-Jramp=1` | Propriedade que define um segundo de subida gradual dos usuários |
| `-Jrequests=100` | Propriedade usada pelo contador para limitar as amostras de carga |
| `-Jscheduled=false` | No modo por quantidade, desliga o encerramento por duração |
| `-l` | Caminho do arquivo de resultados `.jtl` |
| `-j` | Caminho do log do JMeter |
| `-e` e `-o` | Pedem a geração do dashboard e informam sua pasta de saída |

Você não precisa escrever todos esses argumentos: os atalhos npm e os executores fazem isso. O `--` de `npm run test:jmeter:production -- --requests=100` separa o comando npm dos argumentos que ele deve entregar ao nosso executor.

### O que acontece no teste local, passo a passo?

`npm run test:jmeter` chama `run-local.cjs`. O executor verifica se o JMeter existe e se a porta 8083 está livre. Cria uma pasta de resultados com data e hora e gera uma senha aleatória para uma conta administrativa temporária, usada apenas no teste.

Depois, compila a API com Maven e inicia o arquivo Java gerado, apontando para H2 em memória, três banheiros de demonstração e armazenamento local temporário. Ele substitui as configurações de banco e de armazenamento do processo de teste para não utilizar produção. A aplicação cria a estrutura do banco pelas migrações Flyway. O executor consulta `/api/health` até a API confirmar que está pronta.

Com a API disponível, executa três etapas: um usuário por 10 segundos para aquecimento, cinco por 30 segundos e dez por 45 segundos. As subidas graduais são de um, cinco e dez segundos, respectivamente. As consultas públicas usam pausa de 250 ms. Os usuários de cada etapa fazem pedidos em paralelo, mas cada usuário segue seu próprio roteiro de maneira sequencial.

Após a parte pública de cada etapa, um único usuário virtual faz duas sessões autenticadas, uma após a outra. O roteiro obtém um token CSRF, entra, consulta a conta, as contribuições e a fila administrativa, sai e confirma que o acesso à conta passa a retornar 401. O CSRF é uma proteção exigida para operações autenticadas de escrita; o plano obtém esse valor da API e o envia nos pedidos apropriados. O gerenciador de cookies do JMeter mantém a sessão durante o fluxo.

Se uma etapa apresentar erro HTTP ou de validação, a seguinte não começa. Ao terminar, o executor monta os resumos e tenta encerrar somente a API que ele próprio iniciou, removendo o arquivo temporário de credenciais. Ele não encerra uma aplicação preexistente para liberar a porta. O comando Maven desse executor usa `-DskipTests`: ele compila a API para o ensaio, mas não substitui a execução separada dos testes JUnit.

### O que acontece no teste de produção, passo a passo?

Os comandos começam em `run-production.cjs`. A função `parseOptions` verifica os argumentos: aceita `--preflight` sozinho ou `--requests=N`, com inteiro entre 1 e 100, e rejeita opções desconhecidas, repetidas ou combinações incompatíveis. Por exemplo, `--requests=0`, `--requests=101` e `--users=2` não são configurações permitidas pelo executor atual.

Em seguida, ele encontra o JMeter, cria uma pasta de resultados e define quais etapas executar. Os três caminhos disponíveis são:

| Comando | Comportamento |
| --- | --- |
| `npm run test:jmeter:production:preflight` | Uma consulta de saúde e encerramento |
| `npm run test:jmeter:production` | Pré-teste e, se passar, um usuário por 60 segundos |
| `npm run test:jmeter:production -- --requests=100` | Pré-teste e, se passar, até 100 amostras de carga com um usuário |

O pré-teste faz `GET /api/health`. Duas verificações precisam passar: receber HTTP 200 e receber JSON contendo `status: UP`. Ele não faz login e não testa todos os fluxos; apenas confirma a resposta esperada desse endereço antes de iniciar a carga. Uma resposta saudável ali não garante, sozinha, que todos os outros endereços funcionam.

Depois que o processo JMeter termina, o executor lê o JTL para conferir o sucesso real. Isso é necessário porque o JMeter pode encerrar com código de processo zero mesmo quando uma resposta falha na validação. Se a amostra estiver marcada como falha, nosso executor não inicia a carga e retorna erro para o terminal.

Quando o pré-teste passa, a carga repete este roteiro:

| Ordem | Pedido | O que verifica |
| --- | --- | --- |
| 1 | `GET /api/health` | Resposta de saúde esperada |
| 2 | `GET /api/bathrooms` | Lista não vazia com identificadores e nomes |
| 3 | `GET /api/bathrooms?q=...` | Busca usando um nome obtido da listagem |
| 4 | `GET /api/bathrooms` com filtros | Resultados compatíveis com acesso livre e acessibilidade |
| 5 | `GET /api/bathrooms/{id}` | Detalhes correspondentes ao banheiro selecionado |
| 6 | `GET /api/bathrooms/{id}/reviews` | Lista de avaliações públicas |

O identificador `{id}` não está fixado em um banheiro específico. Um extrator JSON guarda um ID retornado pela listagem em uma variável do JMeter; os pedidos seguintes reutilizam essa variável. Isso evita quebrar o roteiro apenas porque os IDs mudaram. Por outro lado, uma base pública vazia não atende ao cenário desse plano: não haveria banheiro para consultar nos detalhes.

Há uma pausa de 1000 ms entre os pedidos. No modo padrão, o agendador encerra a carga após aproximadamente 60 segundos. Uma requisição em andamento e o processamento do relatório podem fazer o comando terminar um pouco depois desse tempo.

No modo por quantidade, um pós-processador Groovy, executado após cada amostra, aumenta a variável `completedRequests`. Ao atingir o valor de `requests`, ele chama `prev.setStopThread(true)` para encerrar o usuário virtual. Como usamos um único usuário, esse contador representa a quantidade total de amostras da carga. A contagem para mesmo no meio do ciclo: 100 não é arredondado para 102. O pré-teste é outro processo e não entra nessa contagem; uma execução completa pode ter 101 amostras somando as duas etapas.

O modo por quantidade desliga o agendador de duração. Assim, consultas lentas podem fazer o teste de 100 amostras levar vários minutos. Isso não aumenta a concorrência: continua sendo um usuário. Apenas mudar o número de usuários no plano faria esse contador valer por usuário; suportar um limite compartilhado entre vários usuários exigiria adaptar a implementação.

O plano usa `stoptestnow` para interromper em falha HTTP ou de contrato. O executor também verifica se uma carga encerrada sem falhas alcançou a quantidade pedida; se faltarem amostras, informa execução incompleta. Em um bloco `finally`, que roda mesmo se houver uma exceção, ele tenta salvar `summary.json`, `summary.md` e o índice HTML com as etapas disponíveis. Erros anteriores à criação da pasta, como argumento inválido ou instalação ausente, são apresentados diretamente no terminal.

### Como as validações decidem se houve erro?

As asserções são as regras de conferência da resposta. Os planos combinam uma conferência do código HTTP com regras Groovy que leem o JSON. Por isso, receber HTTP 200 com HTML ou JSON incompatível ainda é uma falha. Esses testes verificam condições específicas de cada consulta, não todos os campos de todos os contratos da API.

Nos pedidos públicos de produção, esperamos HTTP 200. No teste local, há resultados diferentes esperados em etapas próprias: por exemplo, o logout retorna 204 e consultar a conta após sair deve retornar 401. Nessa situação específica, 401 comprova o comportamento esperado; não é erro de carga. Já 429 ou um timeout no pré-teste são falhas, pois não confirmam disponibilidade.

Os avisos `package scanning ... is deprecated` são avisos do JMeter sobre um mecanismo de descoberta de plugins. Eles não equivalem a uma requisição falhando. Consulte `Err`, o código da resposta e as falhas de asserção para saber o resultado efetivo.

### Como lemos o JTL e calculamos o resumo?

A função `csvRows`, reutilizada pelos dois executores, lê as linhas do JTL, trata os campos CSV e os transforma em objetos com nomes como `elapsed`, `success` e `responseCode`. Cada linha representa uma amostra registrada pelo JMeter.

A função `metrics` reúne as amostras, conta as que possuem `success` diferente de `true` e calcula o percentual de erro. Soma os tempos `elapsed` e divide pela quantidade para obter a média. Ordena esses tempos para calcular mediana e percentis, usando interpolação compatível com a convenção do dashboard. O p95 não é uma média nem o tempo de uma consulta obrigatoriamente existente: é um ponto da distribuição ordenada, que pode resultar de interpolação.

Para estimar requisições por segundo, o resumo divide a quantidade de amostras pela janela entre o início da primeira e o fim da última. Esse intervalo inclui as pausas entre pedidos, mas não a geração posterior do dashboard. A média de `elapsed` mede as requisições e não soma a pausa de 1 segundo do plano. Por isso, o tempo total da carga não é simplesmente a quantidade multiplicada pela média.

Os executores também agrupam as amostras pelo nome da consulta, como `P02 Listar banheiros`, usando `Object.groupBy`. Calculam as mesmas métricas por grupo e guardam em `endpoints` no JSON. Isso permite localizar uma consulta lenta que uma média geral esconderia.

| Campo | Como explicar |
| --- | --- |
| `Samples` ou `samples` | Quantidade de amostras realizadas, não quantidade de usuários |
| `FAIL`, `failures` ou `Error %` | Falhas de comunicação, HTTP ou validação da resposta |
| `Average`, `Avg` ou `averageMs` | Tempo médio de resposta, em milissegundos |
| `Min` e `Max` | Resposta mais rápida e mais lenta observadas |
| `95th pct`, p95 ou `p95Ms` | Tempo que cobre aproximadamente 95% das respostas da amostra |
| `Throughput` ou `requestsPerSecond` | Ritmo observado de pedidos por segundo |
| `initialGate.passed` | Se não houve falhas e o p95 ficou dentro da referência de 1000 ms |

Nos executores atuais, p95 acima de 1000 ms registra uma referência não atendida e gera aviso. Isso não provoca sozinho a interrupção automática da execução nem código de saída de erro. A interrupção automática acontece em falha HTTP/de contrato, problema do processo ou contagem incompleta no modo por quantidade. Portanto, “Execução concluída” não significa “desempenho aprovado”.

### Como entender o terminal e abrir os gráficos?

Uma linha como esta mostra o acumulado:

```text
summary = 100 in 00:05:46 ... Avg: 2437 ... Max: 6918 Err: 0 (0,00%)
```

Ela informa 100 amostras em cerca de cinco minutos e 46 segundos, média aproximada de 2,437 segundos, máximo de 6,918 segundos e nenhuma falha. `summary +` mostra somente o intervalo mais recente; `summary =` mostra o total acumulado. `Active: 1` significa que há um usuário virtual em atividade; não é sinal de travamento.

O executor imprime a pasta completa dos relatórios. No teste de produção, abra o `index.html` dessa execução, depois o dashboard `load-1-vu` para analisar a carga. O dashboard `preflight` contém apenas a consulta inicial. Abra `summary.md` se quiser ler o resultado resumido. O índice geral `results/index.html` reúne os relatórios organizados anteriormente; novas execuções de produção possuem seu próprio índice, sem atualização automática daquele índice geral.

No dashboard, comece por `Error %` e pela tabela `Errors`. Depois compare o p95 e a média de cada consulta na tabela `Statistics` e observe os gráficos de tempo. Para um diagnóstico específico, `results.jtl` contém o código HTTP ou a descrição de falha de conexão e `jmeter.log` contém mensagens do processo. Não interprete uma resposta rápida com erro como desempenho bom.

### O que o resultado real de 100 consultas nos mostrou?

Na execução de produção iniciada em 23/11/2026, às 16h05 de Brasília, o pré-teste passou em 928 ms. A carga completou 100 amostras com um usuário, sem falhas, em aproximadamente cinco minutos e 46 segundos. O terminal mostrou média aproximada de 2437 ms, máximo de 6918 ms e o resumo calculou p95 de 6626,05 ms. Os dados dessa execução ficam em `results/production/2026-11-23T19-05-13-674Z-100-requests/` neste computador.

A conclusão é: as consultas testadas passaram nas validações, mas apresentaram latência alta naquele cenário. Não é correto afirmar que a aplicação suporta 100 usuários simultâneos: fizemos 100 pedidos com um único usuário. Também não medimos capacidade máxima nem demonstramos a causa da lentidão apenas com esses números. É preciso separar a influência da API, do banco, dos recursos da hospedagem e da rede com evidências adicionais.

Em tentativas anteriores, houve bloqueio 403/1010 associado ao cliente e respostas 429. A identificação `User-Agent: KHKI-PerformanceTest/1.0` segue a orientação de uso de um cliente descritivo; não desliga proteções nem garante acesso quando há limitação. Uma resposta 429 foi posteriormente identificada com o cabeçalho `x-render-routing: hibernate-rate-limited`. Em outra tentativa, os logs mostraram que o backend ainda inicializava quando ocorreu timeout. São situações distintas, que devem ser diagnosticadas separadamente, sem transformar uma falha em aprovação aumentando limites indiscriminadamente.

### Como conferimos se nosso próprio executor funciona?

Durante o desenvolvimento, validamos argumentos corretos e incorretos e usamos um pequeno servidor HTTP local com respostas controladas. Uma cópia temporária do plano apontou para `127.0.0.1`, com pausa reduzida somente nessa cópia. Esses ensaios não acessaram produção.

Com o JMeter real, conferimos quantidades exatas de 7 e 100 amostras, encerramento na quinta amostra por erro HTTP ou JSON incompatível e funcionamento do modo por tempo. Também conferimos a prioridade da instalação e a rejeição de arquivo adulterado por SHA-512. São verificações da implementação, não uma certificação do desempenho da aplicação. Os arquivos auxiliares desses ensaios não fazem parte desta versão do repositório; os executores e planos usados para testar o KHKI permanecem disponíveis.

Referências: [Apache JMeter — visão geral](https://jmeter.apache.org/), [execução pelo terminal](https://jmeter.apache.org/usermanual/get-started.html#non_gui), [componentes dos planos](https://jmeter.apache.org/usermanual/component_reference.html) e [relatório HTML](https://jmeter.apache.org/usermanual/generating-dashboard.html).

### Como funciona a preparação automática?

`setup.cjs` fixa a versão 5.6.3, a URL oficial e o SHA-512 publicado pela Apache. Ele baixa o ZIP por HTTPS com limite de tamanho e prazo, grava primeiro um arquivo parcial e calcula seu hash lendo o arquivo em partes. Um hash diferente bloqueia a instalação. Somente o ZIP aprovado passa para a extração em uma pasta temporária, após conferir que as entradas pertencem à pasta esperada. A distribuição completa é movida para o destino final, com um marcador de verificação, e os temporários são removidos. O ZIP aprovado é preservado para reutilização.

`jmeter-installation.cjs` centraliza a resolução do caminho, reutilizada pelos dois executores. Assim, não há um caminho pessoal fixado no código. A implementação foi conferida quanto à prioridade de `JMETER_HOME`, à descoberta automática e à rejeição de conteúdo adulterado. O checksum fixado protege contra arquivo diferente do esperado; ele não equivale a uma validação de assinatura PGP.

Fonte do checksum: [SHA-512 oficial do ZIP 5.6.3](https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-5.6.3.zip.sha512).