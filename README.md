# Ticketabit

Sistema de gestão interna de tickets e anotações com Next.js, TypeScript, autenticação própria e banco MySQL. A aplicação não utiliza dados fictícios: tickets, anotações, usuários, histórico e configurações são lidos e gravados no banco. O `localStorage` é usado somente para preferências visuais, como mostrar ou esconder a navegação inferior.

## Requisitos

- Node.js 22 ou superior;
- MySQL 8 ou MariaDB compatível;
- um banco e usuário MySQL com permissão para criar e alterar tabelas.

## Configuração local

1. Copie `.env.example` para `.env`.
2. Preencha os dados reais do MySQL e defina uma `AUTH_SECRET` aleatória com no mínimo 32 caracteres.
3. Instale as dependências e crie as tabelas:

```bash
npm install
npm run db:migrate
```

4. Inicie a aplicação:

```bash
npm run dev
```

Acesse `http://localhost:3000/login`.

## Configuração na Hostinger

No hPanel, crie o banco em **Bancos de dados → Bancos MySQL**. Na aplicação Node.js, cadastre estas variáveis de ambiente:

```text
DB_HOST=localhost
DB_PORT=3306
DB_USER=usuario_fornecido_pela_hostinger
DB_PASSWORD=senha_do_banco
DB_NAME=nome_do_banco
DB_SSL=false
AUTH_SECRET=uma_chave_aleatoria_com_32_ou_mais_caracteres
UPLOADS_DIR=../uploads
```

Quando a aplicação e o banco estiverem na mesma conta Hostinger, o host normalmente é `localhost`. Para executar as migrations de uma máquina externa, habilite o IP da máquina em **Remote MySQL** e use o hostname mostrado pelo hPanel.

`UPLOADS_DIR` deve apontar para a pasta `uploads` que fica no mesmo nível de `public_html`. Você também pode usar o caminho absoluto fornecido pela Hostinger, como `/home/SEU_USUARIO/uploads`. O processo Node.js precisa ter permissão de escrita nessa pasta. As imagens das anotações ficam em `uploads/notes/<id-do-usuário>` e, por estarem fora de `public_html`, não são removidas durante o deploy.

Use os comandos de implantação:

```text
Build: npm run build
Start: npm run start
```

Execute `npm run db:migrate` em um ambiente com acesso ao banco. Nenhum usuário ou credencial é criado automaticamente pelo código.

## Estrutura de dados

O arquivo `database/schema.sql` contém as tabelas:

- `users`;
- `systems`;
- `categories`;
- `statuses`;
- `tickets`;
- `ticket_responsibles`;
- `ticket_history`;
- `note_folders`;
- `notes` (arquivos de texto e checklist com conteúdo em blocos e referências aos anexos persistentes).

As senhas são armazenadas apenas como hash bcrypt. A autenticação gera uma sessão assinada em cookie `httpOnly`, `SameSite=Lax` e `Secure` em produção.
Todos os usuários possuem as mesmas permissões no sistema.

## Integração direta com a Ticketensão

As rotas internas em `/api/extension/tickets` permitem carregar opções oficiais, consultar duplicidade, criar tickets e substituir o status de um ticket existente sem abrir o site. Configure no ambiente de produção:

```text
EXTENSION_API_KEY=1544752770fcf0c0951fe2e021b8a60813789f0c199d67695b6a7f9395765250
EXTENSION_DEFAULT_CATEGORY=Suporte
EXTENSION_DEFAULT_STATUS=Não iniciado
```

A chave já corresponde à versão interna da extensão. O usuário configura somente o próprio e-mail; sistemas, categorias e status ativos são carregados pela API e exibidos como opções reais. Antes da criação, o número é consultado. Quando ele já existe, a extensão mantém o mesmo registro e pode substituir somente o status, registrando a alteração no histórico.

## Sincronização com o Movidesk

O botão **Sincronizar** da tela de tickets consulta o Movidesk usando o e-mail de cada usuário ativo do Ticketabit como responsável. A consulta inclui tickets recentes e históricos: registros novos são importados quando serviço/sistema, categoria e status possuem correspondência ativa; registros existentes mantêm todos os seus dados e recebem somente a atualização de status. Configure `MOVIDESK_API_TOKEN` e, se necessário, `MOVIDESK_API_URL` no ambiente do servidor.
