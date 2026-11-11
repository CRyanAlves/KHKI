-- Somente leitura. Não retorna senhas, sessões nem conteúdo das imagens.
SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'khki' AND table_type = 'BASE TABLE' ORDER BY table_name;
SELECT conrelid::regclass AS tabela, conname AS restricao, pg_get_constraintdef(oid) AS definicao FROM pg_constraint WHERE connamespace = 'khki'::regnamespace ORDER BY 1, 2;
SELECT version, description, success FROM khki.flyway_schema_history ORDER BY installed_rank;
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'khki' ORDER BY tablename;
