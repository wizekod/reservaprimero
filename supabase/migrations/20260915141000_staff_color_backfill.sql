-- Reparte la paleta entre los profesionales que ya existían. Los nuevos
-- reciben color al crearse (`nextStaffColor` en lib/staff/actions.ts); sin
-- esto, los de antes se quedarían grises en el calendario.
--
-- El orden es el de antigüedad dentro de cada negocio, así que el reparto es
-- estable y no depende de cuándo se ejecute.
with numerados as (
  select id,
         row_number() over (partition by business_id order by created_at, id) - 1 as n
    from public.staff_members
   where color is null
),
paleta as (
  select hex, idx
    from unnest(array[
      '#6366f1', '#10b981', '#f59e0b', '#ec4899',
      '#0ea5e9', '#8b5cf6', '#14b8a6', '#f43f5e'
    ]) with ordinality as p(hex, idx)
)
update public.staff_members s
   set color = paleta.hex
  from numerados
  join paleta on paleta.idx = (numerados.n % 8) + 1
 where s.id = numerados.id;
