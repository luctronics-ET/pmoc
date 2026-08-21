-- 39 — Refrigeração — edição completa do cadastro
-- Adiciona os campos que o app já espera/expõe sem mexer nos dados existentes.

alter table equipamentos
  add column if not exists criticidade_manual boolean not null default false;

alter table equipamentos
  add column if not exists modelo text;
