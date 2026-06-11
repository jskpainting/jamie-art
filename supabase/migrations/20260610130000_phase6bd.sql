-- Phase 6B-D: delete_section_safe RPC
-- Atomically moves all paintings from a section to Uncategorized, then deletes the section.
-- Returns the number of paintings moved.

create or replace function delete_section_safe(p_section_id uuid)
returns int language plpgsql security invoker as $$
declare
  v_uncategorized_id uuid;
  v_section_slug     text;
  v_moved_count      int;
begin
  select slug into v_section_slug from sections where id = p_section_id;
  if v_section_slug = 'uncategorized' then
    raise exception 'Cannot delete the Uncategorized section';
  end if;

  select id into v_uncategorized_id from sections where slug = 'uncategorized';
  if v_uncategorized_id is null then
    raise exception 'Uncategorized section not found';
  end if;

  update paintings set section_id = v_uncategorized_id where section_id = p_section_id;
  get diagnostics v_moved_count = row_count;

  delete from sections where id = p_section_id;
  return v_moved_count;
end;
$$;
