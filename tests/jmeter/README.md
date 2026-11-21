# Testes da API KHKI com Apache JMeter

O plano `khki.jmx` executa requisições HTTP reais contra a API Java local. O executor `run-local.cjs` compila o backend, inicia uma instância isolada na porta 8083 e encerra essa instância ao concluir. O banco H2 é temporário, em modo de compatibilidade com PostgreSQL; armazenamento, conta administrativa e dados de demonstração são exclusivos do teste. Não são utilizados Supabase, R2 ou credenciais de produção.

## Executar

Requisitos: Java 17, Maven, Node.js 22 ou superior e a distribuição oficial do Apache JMeter 5.6.3. Baixe o ZIP em [Apache JMeter](https://jmeter.apache.org/download_jmeter.cgi), confira seu SHA-512 e extraia fora do repositório. Nesta máquina, a instalação verificada fica em `C:\Users\cryan\.codex\tools\apache-jmeter-5.6.3`.

Na raiz do projeto:

```powershell
# Opcional quando o JMeter estiver em outro diretório:
$env:JMETER_HOME = 'C:\Ferramentas\apache-jmeter-5.6.3'
node tests/jmeter/run-local.cjs
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

Cada execução cria uma pasta nova em `test-results/jmeter/<data-hora>/`, ignorada pelo Git:

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

`khki-production-readonly.jmx` contém apenas as seis consultas públicas GET, usa HTTPS na URL publicada e pausa de 1000 ms entre requisições. A duração é de 60 segundos por execução; as propriedades `users` e `ramp` definem a concorrência e a subida gradual. O banheiro dos detalhes é selecionado da listagem, sem identificador fixo, e o termo da busca é obtido de um resultado real. O plano encerra o teste ao encontrar uma falha HTTP ou de contrato.

O perfil autorizado nesta sessão foi de 1, 3 e 5 usuários, em etapas separadas de 60 segundos. As etapas não são promovidas automaticamente: a seguinte depende de uma análise saudável da anterior e de monitoramento durante a execução. Interrompa também em caso de degradação sustentada, sem esperar o fim da etapa. Esses planos não enviam login, cadastros, avaliações, denúncias, uploads ou decisões administrativas.

A tentativa de produção desta sessão parou no pré-teste por HTTP 429. Não foram executadas as etapas de carga. O diagnóstico e o dashboard estão em `test-results/jmeter-production/`, separados dos resultados locais. O pré-teste precisa passar antes de repetir o perfil na janela autorizada; não altere proteções de acesso para mascarar falhas do teste.
