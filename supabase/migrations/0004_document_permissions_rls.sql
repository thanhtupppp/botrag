-- 0004_document_permissions_rls.sql

-- Replace broad policy with explicit owner/grantee rules.
drop policy if exists "owner can manage permissions" on document_permissions;

create policy "owner can select permissions"
  on document_permissions
  for select
  using (
    exists (
      select 1
      from documents d
      where d.id = document_id
        and d.owner_id = auth.uid()
    )
  );

create policy "owner can write permissions"
  on document_permissions
  for insert
  with check (
    exists (
      select 1
      from documents d
      where d.id = document_id
        and d.owner_id = auth.uid()
    )
  );

create policy "owner can update permissions"
  on document_permissions
  for update
  using (
    exists (
      select 1
      from documents d
      where d.id = document_id
        and d.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from documents d
      where d.id = document_id
        and d.owner_id = auth.uid()
    )
  );

create policy "owner can delete permissions"
  on document_permissions
  for delete
  using (
    exists (
      select 1
      from documents d
      where d.id = document_id
        and d.owner_id = auth.uid()
    )
  );

create policy "grantee can see own permissions"
  on document_permissions
  for select
  using (user_id = auth.uid());
