# Ticketabit — Sistema simples de gestão de tickets

Crie um sistema web chamado **Ticketabit**, voltado para gerenciamento interno de tickets, demandas, correções, melhorias e implementações.

O sistema deve substituir uma planilha utilizada atualmente para acompanhar tickets.

A principal referência funcional é uma planilha onde cada linha representa um ticket e possui informações como:

* Ticket
* Sistema
* Status
* Categoria
* Descrição
* Responsável
* Data de recebimento
* Data de finalização
* Pequenos marcadores/etapas internos

Use como inspiração conceitual produtos como:

* Linear
* Jira Service Management
* Zendesk
* Freshdesk

Porém, **não copie a complexidade dessas ferramentas**.

O Ticketabit deve ser propositalmente simples.

A filosofia deve ser:

> abrir → encontrar o ticket → alterar → salvar.

Evite menus desnecessários, dezenas de configurações, dashboards gigantes, gráficos sem utilidade, automações complexas ou funcionalidades que não contribuam diretamente para o gerenciamento dos tickets.

---

# 1. Objetivo

Transformar o processo atual feito em planilha em uma aplicação web organizada, rápida e agradável de utilizar.

O usuário deve conseguir:

1. cadastrar um ticket;
2. visualizar os tickets;
3. pesquisar;
4. filtrar;
5. alterar rapidamente status, categoria ou responsável;
6. editar informações;
7. finalizar um ticket;
8. identificar facilmente o que está parado, em andamento ou concluído.

A aplicação deve funcionar muito bem principalmente em desktop, pois será utilizada como ferramenta de trabalho durante o dia.

Também deve ser responsiva para tablets e celulares.

---

# 2. Identidade

Nome:

**Ticketabit**

Criar uma identidade visual simples e profissional.

Não criar:

* mascotes;
* ilustrações genéricas;
* fundos extravagantes;
* gradientes exagerados;
* efeitos neon;
* visual futurista;
* elementos típicos de dashboard criado por IA.

O produto deve parecer uma ferramenta SaaS profissional realmente utilizada por uma empresa.

Referências visuais:

* Linear
* Notion
* Jira
* Vercel
* GitHub
* interfaces modernas de administração

A inspiração principal de limpeza visual deve ser o **Linear**.

---

# 3. Design

Utilizar design:

* moderno;
* minimalista;
* extremamente limpo;
* profissional;
* compacto;
* rápido;
* com excelente hierarquia visual.

Fundo geral claro.

Utilizar predominantemente:

* branco;
* cinzas neutros;
* azul escuro ou grafite para elementos estruturais;
* cores apenas quando elas possuírem significado.

Não transformar cada informação em um card.

Evitar excesso de:

* bordas;
* sombras;
* arredondamento;
* cores;
* ícones.

Bordas devem ser discretas.

Sombras somente quando necessárias.

Utilizar bastante espaço em branco, porém sem deixar a tabela exageradamente espaçada.

O sistema deve comportar bastante informação na tela.

---

# 4. Estrutura principal

Criar uma estrutura extremamente simples.

Utilizar uma barra de navegação compacta, centralizada na parte inferior, contendo:

* Dashboard
* Tickets
* Anotações
* Configurações

Exibir somente os ícones na barra, sem os nomes escritos. Manter nomes acessíveis e tooltips para identificação ao passar o mouse.

A barra deve possuir um botão para ser escondida. Quando estiver fechada, manter um controle discreto para mostrá-la novamente e guardar a preferência no navegador.

O controle de esconder deve ficar centralizado abaixo dos itens da barra, e não ao lado. O item selecionado deve ser indicado apenas pela cor e pelo fundo, sem ponto inferior.

A barra deve flutuar sobre o conteúdo da página. Na tela de tickets, ela deve sobrepor o `tbody` sem reduzir ou alterar a altura disponível para a tabela, esteja visível ou escondida.

No menu do usuário no header:

* usuário logado;
* configurações da conta;
* sair.

O item mais importante é:

**Tickets**

Ele deve ser a tela principal do sistema.

---

# 5. Header

Criar um header simples contendo:

**Ticketabit**

e na direita:

* pesquisa;
* botão "+ Novo ticket";
* usuário.

O botão **Novo ticket** deve ser visualmente destacado sem ser exagerado.

---

# 6. Tela de Tickets

Esta é a tela principal da aplicação.

Ela deve lembrar a eficiência de uma planilha, porém com aparência muito mais organizada e profissional.

Criar uma tabela contendo:

| Campo       | Descrição                     |
| ----------- | ----------------------------- |
| Ticket      | número ou código do ticket    |
| Sistema     | sistema relacionado           |
| Status      | situação atual                |
| Categoria   | tipo da demanda               |
| Descrição   | resumo do ticket              |
| Responsável | pessoa responsável            |
| Recebido    | data de recebimento           |
| Finalizado  | data de conclusão             |
| Etapas      | marcadores internos opcionais |

A tabela deve ser o elemento dominante da tela.

Não substitua a tabela por dezenas de cards.

---

# 7. Status

Criar inicialmente os seguintes status:

* Não iniciado
* Em atendimento
* Em espera
* Teste Centauro
* Teste Oficial
* Finalizado

Utilizar cores profissionais e discretas.

Sugestão:

### Não iniciado

Cinza.

### Em atendimento

Azul.

### Em espera

Amarelo/âmbar.

### Teste Centauro

Roxo.

### Teste Oficial

Vermelho.

### Finalizado

Verde.

IMPORTANTE:

As cores devem servir para reconhecimento rápido.

Não utilizar fundos extremamente saturados.

Preferir:

* fundo levemente colorido;
* texto mais escuro;
* borda opcional extremamente discreta.

Exemplo visual:

`● Em atendimento`

ou

`Em atendimento`

dentro de uma pequena pill.

Não criar pills gigantes.

---

# 8. Categorias

Criar inicialmente:

* Correção
* Melhoria
* Implementação
* Suporte

Categorias também podem possuir pequenas cores próprias, porém devem ser ainda mais discretas do que os status.

Não transformar a tabela em um arco-íris.

---

# 9. Sistemas

Criar inicialmente:

* PGP/PCI
* PTS
* PGE

Esses valores devem vir do banco de dados e posteriormente poder ser cadastrados ou alterados em Configurações.

Não deixar os sistemas hardcoded permanentemente no frontend.

---

# 10. Cadastro de ticket

Ao clicar em:

**+ Novo ticket**

abrir um modal grande ou drawer lateral.

Não redirecionar para uma tela completamente diferente sem necessidade.

Campos:

### Ticket

Número/código.

Obrigatório.

Não permitir dois tickets iguais.

### Sistema

Select.

### Status

Select.

Valor inicial:

**Não iniciado**

### Categoria

Select.

### Descrição

Textarea.

### Responsáveis

Seleção múltipla de usuários, exigindo ao menos um responsável.

Ao abrir o cadastro, selecionar inicialmente o próprio usuário autenticado como responsável.

### Data de recebimento

Preencher automaticamente com a data atual, permitindo alteração.

### Data de finalização

Mostrar como campo opcional e permitir informar manualmente a data real.

### Etapas

Opcional.

Criar pequenos checkboxes caso as etapas estejam habilitadas.

Botões:

**Cancelar**

**Criar ticket**

---

# 11. Edição extremamente rápida

Um dos principais diferenciais do Ticketabit deve ser a velocidade para atualizar informações.

Permitir alterar diretamente pela tabela:

* status;
* categoria;
* sistema;
* responsável.

Exemplo:

Ao clicar no status:

`Em atendimento`

abrir imediatamente um dropdown com:

* Não iniciado
* Em atendimento
* Em espera
* Teste Centauro
* Teste Oficial
* Finalizado

Selecionou → salva automaticamente.

Não obrigar o usuário a abrir uma tela de edição para alterações simples.

Mostrar feedback discreto:

**Salvo**

Não utilizar popups grandes.

---

# 12. Abrir ticket

Ao clicar na linha ou no número do ticket, abrir um modal central.

Exemplo:

## Ticket #21256

**Sistema**
PGP/PCI

**Status**
Teste Oficial

**Categoria**
Correção

**Responsável**
Gabriel

**Recebido**
06/08/2026

**Finalizado**
06/08/2026

### Descrição

Correção de caractere especial na geração CSV.

Permitir editar as informações dentro do modal.

O modal deve permitir visualizar tudo sem abandonar a lista de tickets.

---

# 13. Data de finalização manual

A data de finalização deve ser informada manualmente pelo usuário.

Alterar o status para:

**Finalizado**

não deve preencher nem apagar automaticamente a data de finalização.

O modal do ticket deve permitir:

* informar a data real de finalização;
* corrigir uma data existente;
* limpar a data quando necessário.

---

# 14. Filtros

Acima da tabela criar filtros compactos.

Filtros:

* Status
* Sistema
* Categoria
* Responsável
* Data

Adicionar também:

**Limpar filtros**

Não criar um painel enorme de filtros.

Utilizar dropdowns pequenos na mesma linha.

---

# 15. Pesquisa

Adicionar pesquisa global na tela de tickets.

Pesquisar por:

* número do ticket;
* descrição;
* responsável;
* sistema.

A pesquisa deve funcionar enquanto o usuário digita.

Exemplo:

`Pesquisar tickets...`

---

# 16. Ordenação

Permitir clicar no cabeçalho das principais colunas para ordenar.

Exemplo:

Ticket ↑

Recebido ↓

Finalizado ↓

Responsável ↑

---

# 17. Rolagem dos tickets

Não criar paginação na lista de tickets. Mostrar todos os registros correspondentes aos filtros dentro da área fixa da tabela e utilizar rolagem interna no `tbody`.

---

# 18. Dashboard

O dashboard deve ser extremamente simples.

Não criar dashboard cheio de gráficos.

Mostrar apenas informações úteis.

Na parte superior:

### Total

187

### Em atendimento

14

### Em espera

8

### Em teste

21

### Finalizados

144

Abaixo mostrar:

## Tickets recentes

Uma tabela compacta com os últimos tickets alterados.

E:

## Tickets aguardando há mais tempo

Mostrar os tickets que estão em:

* Não iniciado;
* Em atendimento;
* Em espera;

há mais tempo.

Não adicionar gráficos inicialmente.

---

# 19. Contadores rápidos

Na página de tickets, acima da tabela, pode existir uma pequena linha:

`Execução 43`

`Todos 187`

`Em atendimento 14`

`Em espera 8`

`Teste 21`

`Finalizados 144`

Clicar em um contador aplica automaticamente o filtro correspondente.

**Execução** deve ser o primeiro contador e o filtro selecionado por padrão. Ele reúne todos os tickets cujo status não esteja configurado como finalizado.

---

# 20. Configurações

Criar uma única página simples de configurações.

Separar em:

### Sistemas

Adicionar, editar e desativar sistemas.

### Categorias

Adicionar, editar e desativar categorias.

### Usuários

Adicionar, editar e desativar usuários. A edição permite alterar nome, e-mail e, opcionalmente, redefinir a senha.

### Status

Adicionar, editar e desativar status, incluindo sua cor e identificação como status de conclusão.

Não criar um painel administrativo gigantesco.

---

# 21. Usuários

Criar autenticação simples.

Campos:

* nome;
* email;
* senha.

Todos os usuários possuem o mesmo nível de acesso.

Podem:

* visualizar, criar e editar tickets;
* cadastrar usuários;
* cadastrar sistemas;
* cadastrar categorias;
* configurar status.

Não implementar cargos ou níveis diferentes de permissão.

---

# 22. Histórico

Guardar automaticamente:

* criado em;
* criado por;
* atualizado em;
* atualizado por.

No painel do ticket mostrar discretamente:

`Atualizado por João há 15 minutos`

Não criar inicialmente um sistema gigantesco de logs.

Opcionalmente disponibilizar:

**Ver histórico**

Mostrando alterações importantes como:

`Status alterado de Em atendimento para Teste Oficial`

---

# 23. Etapas / checkboxes

A planilha atual possui pequenas colunas com checkboxes.

Implemente esse conceito como uma funcionalidade opcional chamada:

**Etapas**

Uma etapa contém:

* nome;
* abreviação;
* ordem.

Exemplo:

T
M
J
K
G

Cada ticket pode marcar ou desmarcar essas etapas.

Na tabela elas aparecem de forma compacta.

Nas configurações é possível definir quais etapas existem.

Não torne isso obrigatório para utilizar o sistema.

---

# 24. Importação e exportação CSV

Adicionar a opção:

**Importar CSV ou Excel**

Após selecionar o arquivo, mostrar todas as colunas encontradas e permitir mapear cada uma para um campo do Ticketabit.

Arquivos `.xlsx` podem possuir várias abas. Listar todas as abas com dados, permitir configurar o mapeamento de cada aba separadamente e possibilitar desmarcar abas que não devem ser importadas. Validar conjuntamente todas as abas selecionadas e identificar o nome da aba e o número da linha em cada erro.

Também permitir selecionar vários arquivos `.csv` ao mesmo tempo. Cada CSV representa uma aba exportada e deve aparecer no mesmo seletor de abas. Quando o nome seguir o padrão `Nome da planilha - Nome da aba.csv`, exibir somente o nome da aba no seletor.

Exemplo:

`objetivo` no CSV → `Descrição` no Ticketabit.

O usuário pode ignorar colunas que não deseja importar. Antes de gravar, validar campos obrigatórios, datas, opções cadastradas e tickets duplicados. Na validação normal, caso exista qualquer erro, não importar parcialmente o arquivo e informar as linhas que precisam ser corrigidas.

Quando a validação encontrar tickets repetidos no arquivo ou já existentes no banco, oferecer a ação **Importar mesmo assim**. Essa ação deve importar também os registros duplicados. Linhas com outros erros impeditivos, como sistema, categoria, status ou responsável não encontrado, continuam inválidas e devem ser ignoradas, com a quantidade apresentada ao usuário. A criação manual de tickets continua impedindo números duplicados.

Sempre mostrar todas as colunas existentes no arquivo. Colunas sem mapeamento devem continuar visíveis, com aparência cinza e a opção `Ignorar coluna` selecionada.

Aceitar `.xlsx` com múltiplas abas e CSV separado por ponto e vírgula, vírgula ou tabulação, com datas em `DD/MM/AAAA` ou `AAAA-MM-DD`.

Adicionar uma opção discreta:

**Exportar CSV**

Exportar os tickets respeitando os filtros atualmente aplicados.

Isso facilita abrir os dados posteriormente no Excel.

Não é necessário implementar Excel avançado.

CSV é suficiente para a primeira versão.

---

# 25. Responsividade

Desktop deve receber prioridade.

Em telas grandes:

usar tabela completa.

Em tablet:

reduzir colunas menos importantes.

Em celular:

não tentar comprimir todas as colunas.

Transformar cada ticket em uma linha/card compacto contendo:

Ticket
Descrição
Status
Responsável

Ao tocar, abrir os detalhes.

---

# 25.1. Anotações

Adicionar uma página **Anotações** à barra de navegação principal.

Cada usuário deve possuir seu próprio espaço de anotações no banco de dados. O usuário pode:

* criar, renomear e excluir pastas;
* criar páginas do tipo texto ou checklist dentro de cada pasta;
* escolher o tipo ao criar um arquivo;
* escolher um responsável diferente para cada item de checklist;
* mover um arquivo para outra pasta;
* editar o nome e o conteúdo do arquivo;
* escrever em uma superfície simples, sem seletores de tipo ou barra de blocos;
* manter arquivos de texto em um único bloco de notas, sem separar o conteúdo em blocos ou parágrafos independentes;
* usar `Enter` ou `Shift+Enter` apenas para quebrar a linha no bloco de notas;
* em checklists, usar `Enter` para criar um novo item e `Shift+Enter` para quebrar a linha no item atual;
* acompanhar o progresso dos itens de checklist;
* salvar com botão ou pelo atalho `Ctrl/Cmd + S`.

A exclusão de uma pasta deve pedir confirmação e excluir também seus arquivos. As anotações não devem ser mockadas nem armazenadas somente no navegador.

Em celulares, mostrar uma etapa por vez: pastas → arquivos → editor.

---

# 26. Banco de dados

Criar estrutura simples e normalizada.

Entidades principais:

## users

* id
* name
* email
* password/auth_id
* created_at

## tickets

* id
* ticket_number
* system_id
* status
* category_id
* description
* received_at
* finished_at
* created_by
* created_at
* updated_at

## ticket_responsibles

* ticket_id
* user_id

Um ticket pode possuir um ou vários responsáveis.

## note_folders

* id
* user_id
* name
* position
* created_at
* updated_at

## notes

* id
* folder_id
* user_id
* title
* type (`text` ou `checklist`)
* content
* created_at
* updated_at

O conteúdo da anotação guarda os blocos estruturados em JSON dentro de um campo de texto longo. Pastas e arquivos pertencem ao usuário autenticado.

## systems

* id
* name
* active
* created_at

## categories

* id
* name
* active
* created_at

## stages

* id
* name
* abbreviation
* position
* active

## ticket_stages

* ticket_id
* stage_id
* checked

Caso seja necessário para histórico:

## ticket_history

* id
* ticket_id
* user_id
* field
* previous_value
* new_value
* created_at

Não criar tabelas desnecessárias.

---

# 27. Stack

Utilizar uma stack moderna e simples.

Preferência:

### Frontend

* Next.js
* React
* TypeScript

### UI

* Tailwind CSS
* shadcn/ui quando realmente necessário

### Backend/banco

* rotas do Next.js
* MySQL 8 ou MariaDB compatível com a Hostinger

### Autenticação

* sessão própria assinada em cookie `httpOnly`

Evitar adicionar bibliotecas sem necessidade.

Não instalar uma biblioteca para algo que pode ser resolvido facilmente com recursos já disponíveis.

---

# 28. Componentes

Separar de maneira organizada.

Exemplo:

```text
components/
  tickets/
    ticket-table
    ticket-row
    ticket-status
    ticket-filters
    ticket-drawer
    ticket-form

  dashboard/
    stats
    recent-tickets

  layout/
    sidebar
    header

  ui/
```

Não criar abstrações exageradas.

---

# 29. Estados da interface

Implementar corretamente:

* loading;
* vazio;
* erro;
* sucesso.

Exemplo de tabela vazia:

## Nenhum ticket encontrado

Não encontramos tickets com os filtros selecionados.

`Limpar filtros`

Se não existir nenhum ticket:

## Nenhum ticket cadastrado

Crie seu primeiro ticket para começar.

`+ Novo ticket`

---

# 30. Feedback de ações

As ações precisam parecer rápidas.

Ao atualizar:

`Salvando...`

depois:

`Salvo`

Ao criar:

`Ticket criado`

Ao excluir:

pedir confirmação.

Não utilizar alert() do navegador.

---

# 31. Exclusão

Tickets não devem ser excluídos acidentalmente.

Dentro das opções do ticket:

`Editar`

`Excluir ticket`

Ao excluir:

**Excluir ticket #21256?**

Esta ação não poderá ser desfeita.

Cancelar | Excluir

---

# 32. Interações

Adicionar microinterações discretas.

Exemplos:

* hover em linhas;
* transição de dropdown;
* abertura suave do drawer;
* feedback ao salvar;
* destaque rápido após atualização.

Todas entre aproximadamente 100–250ms.

Não criar animações chamativas.

O sistema é uma ferramenta de produtividade.

---

# 33. Atalhos úteis

Se for simples implementar:

`N`

Novo ticket.

`/`

Focar pesquisa.

`Esc`

Fechar drawer/modal.

Não criar dezenas de atalhos.

---

# 34. Visual da tabela

A tabela deve ser muito bem trabalhada.

Cabeçalho:

* altura reduzida;
* texto pequeno;
* sem excesso de contraste;
* posição sticky durante scroll.

Na página de tickets, o conjunto de filtros e tabela deve ocupar uma área fixa dentro do container principal. A página não deve possuir rolagem própria: somente as linhas da tabela devem rolar, mantendo cabeçalho e filtros visíveis.

A listagem deve aproveitar praticamente toda a largura do container principal, mantendo apenas uma margem externa pequena e uniforme.

Linhas:

* compactas;
* separadores discretos;
* hover leve;
* sem zebra striping exagerado.

Descrição deve ocupar maior espaço.

Ticket, status, categoria e datas devem ocupar menos.

Exemplo estrutural:

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ Tickets                                         Pesquisar...      + Novo     │
├───────────────────────────────────────────────────────────────────────────────┤
│ Todos 187   Atendimento 14   Espera 8   Teste 21   Finalizados 144          │
│                                                                               │
│ Status ▾   Sistema ▾   Categoria ▾   Responsável ▾            Limpar filtros │
├────────┬──────────┬─────────────┬────────────┬───────────────────────────────┤
│ Ticket │ Sistema  │ Status      │ Categoria  │ Descrição                     │
├────────┼──────────┼─────────────┼────────────┼───────────────────────────────┤
│ 21326  │ PGE      │ Atendimento │ Correção   │ Análise de Campo              │
│ 21330  │ PGE      │ Teste       │ Correção   │ Corrigir cadastro...          │
│ 21320  │ PTS      │ Teste Of.   │ Correção   │ Erro no select de ajustes...  │
└────────┴──────────┴─────────────┴────────────┴───────────────────────────────┘
```

---

# 35. Experiência semelhante a planilha

Apesar de ser um sistema web, preservar a principal vantagem da planilha:

**velocidade.**

O usuário não deve precisar abrir quatro telas para alterar um campo.

Sempre que possível:

clicar → escolher → salvar.

Por exemplo:

Sistema:

`PGP/PCI ▾`

Status:

`Teste Oficial ▾`

Categoria:

`Correção ▾`

Responsável:

`Thiago ▾`

Isso deve acontecer diretamente na tabela.

---

# 36. O que NÃO implementar

Não implementar inicialmente:

* Kanban;
* calendário;
* chat;
* comentários complexos;
* anexos complexos;
* SLA;
* inteligência artificial;
* chatbot;
* CRM;
* projetos;
* sprints;
* automações avançadas;
* integrações externas;
* webhooks;
* notificações por email;
* notificações push;
* gráficos avançados;
* gamificação;
* sistema complexo de permissões;
* temas personalizados;
* marketplace;
* sistema de plugins.

Essas funcionalidades fogem da proposta inicial.

---

# 37. Prioridades

Prioridade absoluta:

1. tabela excelente;
2. cadastro rápido;
3. edição rápida;
4. filtros;
5. pesquisa;
6. organização visual;
7. persistência correta;
8. responsividade;
9. autenticação;
10. configurações básicas.

O restante é secundário.

---

# 38. Regra de simplicidade

Antes de adicionar qualquer elemento pergunte:

> Isso ajuda alguém a cadastrar, localizar, acompanhar ou atualizar um ticket?

Se não:

**não adicione.**

---

# 39. Qualidade

Não entregue apenas uma tela visual.

Implemente o sistema funcionalmente.

Precisa existir:

* frontend;
* banco;
* autenticação;
* criação;
* edição;
* exclusão;
* filtros;
* pesquisa;
* paginação;
* alteração inline;
* persistência;
* estados de erro/loading;
* responsividade.

Não utilizar dados mockados na versão final.

Mocks podem ser utilizados somente durante o desenvolvimento.

---

# 40. Dados iniciais

Criar como opções iniciais:

### Sistemas

* PGP/PCI
* PTS
* PGE

### Categorias

* Correção
* Melhoria
* Implementação
* Suporte

### Status

* Não iniciado
* Em atendimento
* Em espera
* Teste Centauro
* Teste Oficial
* Finalizado

Esses dados devem ser fáceis de adaptar posteriormente.

---

# 41. Direção final

O Ticketabit não deve tentar competir com o Jira oferecendo 500 funcionalidades.

Ele deve resolver muito bem apenas um problema:

> controlar os tickets que hoje são controlados em uma planilha.

A experiência ideal é uma mistura de:

**simplicidade visual do Linear**

*

**organização de tickets do Jira/Zendesk**

*

**velocidade de edição de uma planilha**

O resultado deve parecer um produto SaaS profissional, não um template administrativo genérico.

Priorize funcionalidade, velocidade e clareza.

Não adicione funcionalidades apenas para fazer o sistema parecer maior.

**Menos funcionalidades, melhor executadas.**
