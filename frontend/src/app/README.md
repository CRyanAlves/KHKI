# Organização do frontend

O frontend é dividido por caso de uso. As URLs públicas e os contratos HTTP são independentes dos nomes das pastas.

- `features`: funcionalidades alinhadas ao backend (`user`, `login`, `bathroom`, `review`, `report`, `moderation` e `image`), além de `route`, específico do frontend. A divisão principal é por fluxo; dentro dele, `view` reúne apresentação, `service` reúne operações e coordenação, e `model` reúne tipos e regras puras específicos. Só existem camadas com arquivos reais. Funcionalidades pequenas, como `login` e `review`, possuem as camadas diretamente na própria pasta, sem um subfluxo artificial.
- `domain`: modelos e funções puras do domínio compartilhados por vários casos de uso. Não contém componentes Angular nem depende das funcionalidades.
- `core/http`: transporte HTTP e tratamento de falhas. Não contém regras de formulário.
- `core/session`: sessão autenticada e guards de acesso. Login e cadastro continuam usando os mesmos endpoints e a mesma sessão.
- `core/preferences`: preferências de aparência.
- `layout`: composição persistente do mapa e dos painéis, superfície comum de autenticação, gestos mobile e animação da navbar. O mapa não é recriado na troca de rota filha.
- `integrations/maps`: integração com MapLibre e Geoapify, renderização do mapa e seletor de endereço reutilizado pelo cadastro e pelo planejamento.
- `shared`: controles visuais genéricos, diretivas, validações e utilitários sem responsabilidade exclusiva de um caso de uso.

## Responsabilidades e nomes da busca

- `view/results/bathroom-search-results.component.*`: campo de busca desktop, ordenação e lista. `bathroom-search-result-card.component.*` apresenta cada resultado.
- `view/search-input/mobile-bathroom-search-input.component.*`: apresentação do campo mobile, navegação por teclado, foco e escolha de sugestões.
- `view/filters/bathroom-search-filters-bar.component.*` e `bathroom-search-filters-panel.component.*`: atalhos, chips e painel de filtros.
- `view/bathroom-search-entry.component.ts`: entrada da rota de busca no workspace existente, sem criar outra tela ou outro mapa.
- `service/bathroom-search.service.ts`: paginação completa e proteção contra páginas repetidas; o workspace preserva a ordem das buscas e o contexto do mapa.
- `service/bathroom-search-suggestions.service.ts`: consulta de banheiros e endereços, atraso de digitação, cancelamento, descarte de respostas antigas e falhas parciais. É fornecido por instância do componente mobile, sem compartilhar sugestões entre componentes.
- `service/bathroom-search-filtering.ts`: funções puras de criação, cópia, aplicação e descrição dos filtros.
- `model/bathroom-search-filters.model.ts` e `bathroom-search-suggestion.model.ts`: contratos de dados da busca, sem consultas HTTP ou dependência das views.

`AddressSuggestion` fica em `integrations/maps/model/address-suggestion.model.ts`, para que os modelos da busca possam referenciar o formato de endereço sem importar um arquivo de serviço. O seletor de origem e `MapsService` usam esse mesmo contrato, sem duplicação.

O padrão dos nomes identifica o assunto e a responsabilidade: `UserRegistrationService` cadastra usuários; `BathroomReviewService` opera avaliações; `ContentReportService` envia denúncias; `ContentImageUploadService` envia imagens; `ContentModerationApiService` opera a moderação; `RouteNavigationService` acompanha a navegação. `BathroomApiService` concentra as chamadas HTTP compartilhadas dos banheiros. Formulários usam nomes como `BathroomRegistrationFormComponent`, `UserRegistrationFormComponent` e `BathroomReviewFormComponent`. Os seletores e classes CSS continuam iguais para preservar os fluxos e o visual.

## Autenticação

`layout/authentication-panel/AuthenticationPanelComponent` mantém a superfície comum de autenticação e a adaptação ao teclado. `login/view/UserLoginFormComponent` chama `login/service/UserLoginService`; `user/register/view/UserRegistrationFormComponent` chama `user/register/service/UserRegistrationService`. Os contratos enviados ficam em `login/model/user-login-request.model.ts` e `user/register/model/user-registration-request.model.ts`. Ambos reutilizam os campos, templates e validações de `shared/forms/authentication/AuthenticationForm`, preservando os dados durante a troca de modo.

`UserLoginService` envia as credenciais; `UserRegistrationService` cadastra a conta e inicia o login automático, como antes. `core/session/AuthService` mantém o estado da sessão, valida o usuário retornado, renova o CSRF após o login, controla a expiração e retoma a ação protegida. A dependência segue `user → login → core/session`, sem o núcleo depender de funcionalidades. Logout e restauração da sessão continuam no núcleo compartilhado.

`bathroom/register/view/BathroomRegistrationFormComponent` representa exclusivamente o cadastro de banheiro. Seu guard de saída e `BathroomRegistrationService` ficam em `bathroom/register/service`, incluindo o bloqueio de envio simultâneo e o tratamento de respostas não confirmadas. Esse serviço continua sendo fornecido por instância do componente para não compartilhar rascunhos entre cadastros. O estado dos horários e o tipo `BathroomRegistrationPhotoDraft` ficam em `bathroom/register/model`. `bathroom/service/BathroomApiService` (`bathroom-api.service.ts`) permanece no nível comum porque atende à busca, aos detalhes e à gravação. Os tipos de filtros ficam em `bathroom/search/model/bathroom-search-filters.model.ts`; as operações de filtragem ficam em `bathroom/search/service/bathroom-search-filtering.ts`. Ambos são consumidos pela busca e pelo estado da exploração.

Em `user`, cadastro, contribuições e menu da conta ficam em `register`, `contributions` e `account-menu`. Cada fluxo contém apenas suas camadas necessárias: o menu da conta tem somente `view`; os outros possuem `view` e `service`. `UserContributionsApiService` acompanha o fluxo de contribuições e continua disponível aos demais fluxos que precisam atualizar essa lista. Em `route`, as telas ficam em `planning/view` e `navigation/view`; `RouteNavigationService` fica em `route/navigation/service` e é utilizado pelo planejamento e pelo painel de navegação. Os modelos específicos de navegação ficam em `route/navigation/model`; os tipos de manobra compartilhados ficam em `route/model`, e as operações de orientação ficam em `route/service`. A animação visual do trajeto fica em `navigation/view/map`.

## Camadas dentro dos fluxos

```text
features/
  bathroom/
    search/
      view/
        results/
        search-input/
        filters/
      service/
      model/
    register/
      view/
      service/
      model/
    details/
      view/
        panel/
        gallery/
      service/
      model/
    service/
      bathroom-api.service.ts
  user/
    register/
      view/
      service/
    contributions/
      view/
      service/
    account-menu/
      view/
  review/
    view/
    service/
    model/
```

As views dependem dos serviços e dos modelos; os serviços podem depender dos modelos e do transporte HTTP. Modelos não importam componentes ou serviços da aplicação. Tipos compartilhados entre funcionalidades, como `User`, `Bathroom` e `Review`, continuam em `domain`, sem cópias locais. `BathroomReviewInput` pertence a `review/model/bathroom-review-input.model.ts`, os modelos exclusivos da fila de moderação pertencem a `moderation/model` e `NavigationFrame` pertence a `route/model`. A interface `NavigationFrame` referencia apenas tipos de localização e rota, sem importar `RouteNavigationService`. A integração de mapas existente mantém seus contratos atuais. `ExplorationState.select` aceita opcionalmente uma promessa de banheiro já carregado: detalhes usa essa entrada para compartilhar a seleção com o mapa sem repetir a consulta. Os demais callers mantêm a chamada original por identificador.

## Rastreabilidade dos módulos

| Módulo       | Views e operações                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| `user`       | Cadastro, menu da conta e minhas contribuições; `UserRegistrationService` e `UserContributionsApiService` |
| `login`      | Formulário de entrada e `UserLoginService`                                                                |
| `bathroom`   | Busca/filtros, detalhes/galeria e cadastro/correção; `BathroomApiService` e `BathroomRegistrationService` |
| `review`     | Formulário de avaliação e `BathroomReviewService`                                                         |
| `report`     | Denúncia de conteúdo e `ContentReportService`                                                             |
| `moderation` | Painel de moderação e `ContentModerationApiService`                                                       |
| `image`      | Serviço de upload vinculado ao cadastro ou à avaliação, sem tela independente                             |
| `route`      | Planejamento e navegação; `RouteNavigationService` e regras de orientação                                 |

Componentes usam nomes explícitos, como `BathroomDetailsPanelComponent`, `BathroomSearchResultsComponent`, `BathroomReviewFormComponent`, `RoutePlanningComponent` e `ContentModerationPanelComponent`. Os seletores Angular e as classes CSS foram preservados para manter o comportamento e a apresentação existentes.

As views não injetam `ApiService` ou `HttpClient` para consultar ou enviar dados; os endpoints dessas operações ficam nos serviços. As URLs de imagens usadas pelos templates continuam preservadas. Os serviços das funcionalidades oferecem operações tipadas e usam `core/http/ApiService` para o transporte. `apiError` centraliza a apresentação das falhas sem exigir que um componente injete o transporte HTTP apenas para formatar mensagens. Tipos de domínio compartilhados permanecem em `domain`; os modelos exclusivos da fila estão em `features/moderation/model/moderation-queue.model.ts`. Serviços não importam componentes; o guard de saída utiliza somente uma referência de tipo ao componente protegido.

`ExplorationState` permanece no workspace porque coordena mapa, lista e painéis de vários fluxos, mas consulta os banheiros por `BathroomApiService`. Planejamento, navegação, geocodificação e renderização continuam usando a integração de mapas existente. As URLs públicas, campos JSON, uploads, regras de autenticação, moderação e retomada dos fluxos não foram alterados.

## Dependências e estilos

Use imports diretos para explicitar as dependências. Componentes reutilizáveis de um provedor ficam em `integrations`; tipos de domínio ficam em `domain`, evitando importar um componente de outra funcionalidade para compartilhar um tipo.

`shared/bathroom-metadata` contém o componente de apresentação dos dados do banheiro reutilizado por detalhes e moderação. Os tipos e funções puras que ele consome continuam em `domain/bathrooms`.

Os tokens e estilos globais existentes continuam em `src/styles`. Os SCSS que já eram locais acompanham seus componentes. Esta organização não modifica o design system nem a estrutura visual.

## Responsabilidades em todas as funcionalidades

| Funcionalidade       | Apresentação                                                      | Operações e modelos                                                                                                                        |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `bathroom/search`    | Resultados, entrada mobile e filtros em grupos próprios de `view` | Paginação, sugestões e filtragem em `service`; contratos em `model`                                                                        |
| `bathroom/register`  | Formulário e interação com o mapa                                 | Envio e fotos, preparação da correção e validações em `service`; horários e fotos do rascunho em `model`                                   |
| `bathroom/details`   | Painel em `view/panel` e galeria em `view/gallery`                | `BathroomDetailsService` carrega banheiro e avaliações; resultado em `model`                                                               |
| `user/register`      | `UserRegistrationFormComponent`                                   | `UserRegistrationService` e contrato `UserRegistrationRequest`                                                                             |
| `user/contributions` | Página em `view/page` e lista mobile em `view/list`               | `UserContributionsApiService`, carregamento por `UserContributionsFeedService`, filtragem e modelo das linhas                              |
| `user/account-menu`  | `MobileAccountPopoverComponent`, foco e posicionamento            | Sessão e aparência delegadas aos serviços existentes de `core`; sem serviço vazio                                                          |
| `login`              | `UserLoginFormComponent`                                          | `UserLoginService` e contrato `UserLoginRequest`                                                                                           |
| `review`             | `BathroomReviewFormComponent`, estrelas e prévia da foto          | `BathroomReviewService` consulta/salva; `BathroomReviewSubmissionService` coordena envio com foto; entrada e resultado em `model`          |
| `report`             | `ContentReportFormComponent`, login contextual e fechamento       | `ContentReportService` acessa a API; `ContentReportSubmissionService` controla envio, falhas e duplicidade por formulário; alvo em `model` |
| `moderation`         | Painel, diálogos, foco, scroll e seleção                          | `ContentModerationApiService`, `ContentModerationWorkflowService`, funções de fila e transições; decisões e fila em `model`                |
| `route/planning`     | Seleção de origem, transporte e contexto do mapa                  | `RoutePlanningService` consulta e mantém o cache de rotas por instância do painel                                                          |
| `route/navigation`   | Painel, ícones e animação em grupos próprios                      | `RouteNavigationService` coordena GPS/simulação, com modelos e política de navegação                                                       |
| `image`              | Sem tela independente                                             | `ContentImageUploadService` faz o upload vinculado ao cadastro ou à avaliação, reutilizando a validação de arquivo existente               |

Serviços de estado de formulário/lista são fornecidos no componente que os utiliza, evitando compartilhar rascunhos, erros ou carregamentos entre instâncias. Permissões, endpoints, campos JSON e regras de publicação/moderação permanecem os mesmos. A revisão não altera o backend ou os diagramas.

## Verificação

Execute `npm.cmd run build --prefix frontend` para compilar e `npm.cmd test --prefix frontend` para executar os testes de navegador com serviços e banco de teste isolados.

As movimentações são registradas pelo Git. Para revisar os renomes junto das alterações, use `git diff --cached --find-renames --stat` e `git diff --cached --find-renames`.
