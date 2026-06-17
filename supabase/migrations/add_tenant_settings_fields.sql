-- Adds General-settings fields to existing tenants tables.
-- Safe to run multiple times.

alter table tenants add column if not exists whatsapp_number text;
alter table tenants add column if not exists industry text;
alter table tenants add column if not exists social_links jsonb not null default '{}'::jsonb;
