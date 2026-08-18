# Ticketabit

Sistema de gestão interna de tickets com Next.js, TypeScript, autenticação própria e banco MySQL. A aplicação não utiliza dados fictícios nem `localStorage`: tickets, usuários, histórico e configurações são lidos e gravados no banco.

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

4. Preencha `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env` e crie o primeiro acesso:

```bash
npm run db:create-admin
```

5. Inicie a aplicação:

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
```

Quando a aplicação e o banco estiverem na mesma conta Hostinger, o host normalmente é `localhost`. Para executar as migrations de uma máquina externa, habilite o IP da máquina em **Remote MySQL** e use o hostname mostrado pelo hPanel.

Use os comandos de implantação:

```text
Build: npm run build
Start: npm run start
```

Execute `npm run db:migrate` e `npm run db:create-admin` uma vez em um ambiente com acesso ao banco.

## Estrutura de dados

O arquivo `database/schema.sql` contém as tabelas:

- `users`;
- `systems`;
- `categories`;
- `stages`;
- `tickets`;
- `ticket_stages`;
- `ticket_history`.

As senhas são armazenadas apenas como hash bcrypt. A autenticação gera uma sessão assinada em cookie `httpOnly`, `SameSite=Lax` e `Secure` em produção.
