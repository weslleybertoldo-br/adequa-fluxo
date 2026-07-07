-- Responsável dinâmico do adequa-fluxo, guardado em dashboard_settings (key/value).
-- Projeto Supabase: Dashadequaocao (jbizxnauupdzmlmhqbjq).
-- Acesso via RPC SECURITY DEFINER (anon), pois o app usa OAuth Google próprio
-- (não Supabase Auth) e o RLS da tabela só libera 'authenticated'.

create or replace function public.adequa_get_responsavel()
returns table(responsavel_id text, responsavel_nome text)
language sql
security definer
set search_path = public
as $$
  select
    (select valor from public.dashboard_settings where chave = 'responsavel_id'),
    (select valor from public.dashboard_settings where chave = 'responsavel_nome');
$$;

create or replace function public.adequa_set_responsavel(p_id text, p_nome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.dashboard_settings(chave, valor, atualizado_em)
    values ('responsavel_id', p_id, now())
    on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();
  insert into public.dashboard_settings(chave, valor, atualizado_em)
    values ('responsavel_nome', p_nome, now())
    on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();
end;
$$;

revoke all on function public.adequa_get_responsavel() from public;
revoke all on function public.adequa_set_responsavel(text, text) from public;
grant execute on function public.adequa_get_responsavel() to anon, authenticated;
grant execute on function public.adequa_set_responsavel(text, text) to anon, authenticated;

-- Seed inicial: Weslley Bertoldo (id que era hardcoded no código)
select public.adequa_set_responsavel('305932218', 'Weslley Bertoldo');
