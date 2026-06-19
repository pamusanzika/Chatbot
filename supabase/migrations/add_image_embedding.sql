create extension if not exists vector;

alter table products add column if not exists image_embedding vector(1024);

create index if not exists products_image_embedding_idx
  on products using hnsw (image_embedding vector_cosine_ops);

create or replace function match_products_by_image(
  p_tenant uuid, p_query vector(1024), p_limit int
) returns table (product_id uuid, name text, image_url text, similarity float)
language sql stable as $$
  select p.id, p.name, p.image_urls[1] as image_url,
         1 - (p.image_embedding <=> p_query) as similarity
  from products p
  where p.tenant_id = p_tenant
    and p.is_active = true
    and p.image_embedding is not null
  order by p.image_embedding <=> p_query
  limit p_limit;
$$;
