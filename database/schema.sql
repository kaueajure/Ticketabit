set names utf8mb4;

create table if not exists users (
  id char(36) primary key,
  name varchar(120) not null,
  email varchar(190) not null unique,
  password_hash varchar(255) not null,
  role enum('Administrador', 'Usuário') not null default 'Usuário',
  active boolean not null default true,
  created_at timestamp not null default current_timestamp,
  updated_at timestamp not null default current_timestamp on update current_timestamp
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

create table if not exists stages (
  id varchar(64) primary key,
  name varchar(100) not null unique,
  abbreviation varchar(2) not null,
  position int not null default 0,
  active boolean not null default true
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists tickets (
  id char(36) primary key,
  ticket_number varchar(80) not null unique,
  system_id varchar(64) not null,
  status enum('Não iniciado','Em atendimento','Em espera','Teste Centauro','Teste Oficial','Finalizado') not null default 'Não iniciado',
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

create table if not exists ticket_stages (
  ticket_id char(36) not null,
  stage_id varchar(64) not null,
  checked boolean not null default false,
  primary key (ticket_id, stage_id),
  constraint fk_ticket_stages_ticket foreign key (ticket_id) references tickets(id) on delete cascade,
  constraint fk_ticket_stages_stage foreign key (stage_id) references stages(id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

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

insert ignore into systems (id, name) values
  ('sys-pgp', 'PGP/PCI'), ('sys-pts', 'PTS'), ('sys-pge', 'PGE');

insert ignore into categories (id, name, color) values
  ('cat-correcao', 'Correção', 'rose'),
  ('cat-melhoria', 'Melhoria', 'blue'),
  ('cat-implementacao', 'Implementação', 'violet'),
  ('cat-suporte', 'Suporte', 'slate');

insert ignore into stages (id, name, abbreviation, position) values
  ('st-triagem', 'Triagem', 'T', 1),
  ('st-mapeamento', 'Mapeamento', 'M', 2),
  ('st-jira', 'Jira', 'J', 3),
  ('st-kanban', 'Kanban', 'K', 4),
  ('st-golive', 'Go-live', 'G', 5);
