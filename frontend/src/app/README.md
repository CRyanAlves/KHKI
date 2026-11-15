# Organização do frontend

O frontend é dividido por caso de uso. As URLs públicas e os contratos HTTP são independentes dos nomes das pastas.

- `features`: exploração, detalhes, cadastro de banheiro, avaliação, denúncia, autenticação, contribuições, planejamento, navegação e moderação. Componentes, templates, SCSS e serviços exclusivos ficam junto do caso de uso.
- `domain`: modelos e regras de apresentação do domínio compartilhados por vários casos de uso. Não depende de componentes das funcionalidades.
- `core/http`: transporte HTTP e tratamento de falhas. Não contém regras de formulário.
- `core/session`: sessão autenticada e guards de acesso. Login e cadastro continuam usando os mesmos endpoints e a mesma sessão.
- `core/preferences`: preferências de aparência.
- `layout`: composição persistente do mapa e dos painéis, gestos mobile e animação da navbar. O mapa não é recriado na troca de rota filha.
- `integrations/maps`: integração com MapLibre e Geoapify, renderização do mapa e seletor de endereço reutilizado pelo cadastro e pelo planejamento.
- `shared`: controles visuais genéricos, diretivas, validações e utilitários sem responsabilidade exclusiva de um caso de uso.

## Autenticação

`AuthenticationComponent` mantém a superfície de autenticação e a adaptação ao teclado. `LoginFormComponent` executa a entrada e `RegisterUserFormComponent` executa o cadastro da conta. Ambos reutilizam a apresentação dos campos e o comportamento de validação de `AuthenticationForm`; os dados digitados são preservados durante a troca. `AuthService` continua responsável pela sessão e pela retomada da ação protegida.

`RegisterBathroomComponent` representa exclusivamente o cadastro de banheiro. Seu guard de saída permanece na própria funcionalidade.

## Dependências e estilos

Use imports diretos para explicitar as dependências. Componentes reutilizáveis de um provedor ficam em `integrations`; tipos de domínio ficam em `domain`, evitando importar um componente de outra funcionalidade para compartilhar um tipo.

Os tokens e estilos globais existentes continuam em `src/styles`. Os SCSS que já eram locais acompanham seus componentes. Esta organização não modifica o design system nem a estrutura visual.

## Verificação

Execute `npm.cmd run build --prefix frontend` para compilar e `npm.cmd test --prefix frontend` para executar os testes de navegador com serviços e banco de teste isolados.

As movimentações são registradas pelo Git. Para revisar os renomes junto das alterações, use `git diff --cached --find-renames --stat` e `git diff --cached --find-renames`.
