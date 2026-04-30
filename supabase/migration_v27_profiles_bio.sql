alter table profiles add column if not exists bio text;
alter table profiles add constraint profiles_bio_length check (bio is null or length(bio) <= 280);
