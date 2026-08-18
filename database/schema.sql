set names utf8mb4;

create table if not exists users (
  id char(36) primary key,
  name varchar(120) not null,
  email varchar(190) not null unique,
  password_hash varchar(255) not null,
  active boolean not null default true,
  avatar_data mediumblob null,
  avatar_mime varchar(50) null,
  avatar_updated_at timestamp null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

alter table users add column if not exists avatar_data mediumblob null;
alter table users add column if not exists avatar_mime varchar(50) null;
alter table users add column if not exists avatar_updated_at timestamp null;
alter table users drop column if exists role;

create table if not exists note_folders (
  id char(36) primary key,
  user_id char(36) not null,
  name varchar(120) not null,
  position int not null default 0,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_note_folders_user foreign key (user_id) references users(id) on delete cascade,
  unique key uq_note_folders_user_name (user_id, name),
  index idx_note_folders_user (user_id, position, created_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists notes (
  id char(36) primary key,
  folder_id char(36) not null,
  user_id char(36) not null,
  title varchar(180) not null,
  content longtext not null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_notes_folder foreign key (folder_id) references note_folders(id) on delete cascade,
  constraint fk_notes_user foreign key (user_id) references users(id) on delete cascade,
  index idx_notes_folder (folder_id, updated_at),
  index idx_notes_user (user_id, updated_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists systems (
  id varchar(64) primary key,
  name varchar(100) not null unique,
  active boolean not null default true,
  created_at timestamp not null default current_timestamp
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists categories (
  id varchar(64) primary key,
  name varchar(100) not null unique,
  color enum('blue','amber','violet','slate','emerald','rose') not null default 'slate',
  active boolean not null default true,
  created_at timestamp not null default current_timestamp
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists statuses (
  id varchar(64) primary key,
  name varchar(100) not null unique,
  color enum('neutral','blue','amber','violet','red','green') not null default 'neutral',
  position int not null default 0,
  active boolean not null default true,
  is_final boolean not null default false,
  created_at timestamp not null default current_timestamp
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists tickets (
  id char(36) primary key,
  ticket_number varchar(80) not null unique,
  system_id varchar(64) not null,
  status varchar(100) not null default 'Não iniciado',
  category_id varchar(64) not null,
  description text not null,
  responsible_id char(36) not null,
  received_at date not null,
  finished_at date null,
  created_by char(36) not null,
  updated_by char(36) null,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp,
  constraint fk_tickets_system foreign key (system_id) references systems(id),
  constraint fk_tickets_category foreign key (category_id) references categories(id),
  constraint fk_tickets_responsible foreign key (responsible_id) references users(id),
  constraint fk_tickets_created_by foreign key (created_by) references users(id),
  constraint fk_tickets_updated_by foreign key (updated_by) references users(id),
  index idx_tickets_status (status),
  index idx_tickets_received (received_at desc),
  index idx_tickets_responsible (responsible_id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Duplicidades continuam bloqueadas na criação manual, mas podem ser aceitas
-- explicitamente durante uma importação forçada.
set @ticket_unique_index = (
  select index_name from information_schema.statistics
  where table_schema = database() and table_name = 'tickets' and column_name = 'ticket_number'
    and non_unique = 0 and index_name <> 'PRIMARY'
  limit 1
);
set @drop_ticket_unique = if(
  @ticket_unique_index is null,
  'select 1',
  concat('alter table tickets drop index `', replace(@ticket_unique_index, '`', '``'), '`')
);
prepare drop_ticket_unique_statement from @drop_ticket_unique;
execute drop_ticket_unique_statement;
deallocate prepare drop_ticket_unique_statement;

set @has_ticket_number_index = (
  select count(*) from information_schema.statistics
  where table_schema = database() and table_name = 'tickets' and column_name = 'ticket_number'
);
set @create_ticket_number_index = if(
  @has_ticket_number_index = 0,
  'create index idx_tickets_number on tickets (ticket_number)',
  'select 1'
);
prepare create_ticket_number_index_statement from @create_ticket_number_index;
execute create_ticket_number_index_statement;
deallocate prepare create_ticket_number_index_statement;

-- Remove a limitação antiga por ENUM para que novos status cadastrados nas
-- configurações possam ser usados imediatamente nos tickets.
alter table tickets modify column status varchar(100) not null default 'Não iniciado';

create table if not exists ticket_history (
  id char(36) primary key,
  ticket_id char(36) not null,
  user_id char(36) not null,
  field varchar(80) not null,
  previous_value text null,
  new_value text not null,
  created_at timestamp not null default current_timestamp,
  constraint fk_history_ticket foreign key (ticket_id) references tickets(id) on delete cascade,
  constraint fk_history_user foreign key (user_id) references users(id),
  index idx_history_ticket (ticket_id, created_at desc)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists ticket_responsibles (
  ticket_id char(36) not null,
  user_id char(36) not null,
  created_at timestamp not null default current_timestamp,
  primary key (ticket_id, user_id),
  constraint fk_ticket_responsibles_ticket foreign key (ticket_id) references tickets(id) on delete cascade,
  constraint fk_ticket_responsibles_user foreign key (user_id) references users(id),
  index idx_ticket_responsibles_user (user_id, ticket_id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Preserva os responsáveis já cadastrados antes do suporte a múltiplos usuários.
insert ignore into ticket_responsibles (ticket_id, user_id)
select id, responsible_id from tickets where responsible_id is not null;

-- A funcionalidade antiga de etapas não faz parte do fluxo real.
drop table if exists ticket_stages;
drop table if exists stages;

insert ignore into systems (id, name) values
  ('sys-pgp', 'PGP/PCI'), ('sys-pts', 'PTS'), ('sys-pge', 'PGE');

insert ignore into categories (id, name, color) values
  ('cat-correcao', 'Correção', 'rose'),
  ('cat-melhoria', 'Melhoria', 'blue'),
  ('cat-implementacao', 'Implementação', 'violet'),
  ('cat-suporte', 'Suporte', 'slate');

insert ignore into statuses (id, name, color, position, active, is_final) values
  ('status-nao-iniciado', 'Não iniciado', 'neutral', 1, true, false),
  ('status-em-atendimento', 'Em atendimento', 'blue', 2, true, false),
  ('status-em-espera', 'Em espera', 'amber', 3, true, false),
  ('status-teste-centauro', 'Teste Centauro', 'violet', 4, true, false),
  ('status-teste-oficial', 'Teste Oficial', 'red', 5, true, false),
  ('status-finalizado', 'Finalizado', 'green', 6, true, true);
