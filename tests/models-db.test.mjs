import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("model tracker materializes sourced launch mentions without fabricated release dates or benchmarks", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table models(id bigserial primary key,name text unique,slug text unique,notes text,story_id bigint,observed_at timestamptz,source_url text,released_at date,benchmarks jsonb default '{}');
      create table entities(id bigint primary key,name text,slug text,kind text);
      create table story_entities(story_id bigint,entity_id bigint);
      create table stories(id bigint primary key,one_liner text,category text,enriched_at timestamptz,first_seen_at timestamptz);
      create table sources(id bigint primary key,weight real);
      create table articles(id bigint primary key,url text,source_id bigint,published_at timestamptz);
      create table story_articles(story_id bigint,article_id bigint);
      insert into sources values(1,1);
      insert into entities values(1,'Test Model','test-model','model'),(2,'Test Company','test-company','company');
      insert into stories values(1,'Test model launched','model_release',now(),now()),(2,'Company raises funding','funding',now(),now());
      insert into story_entities values(1,1),(2,2);
      insert into articles values(1,'https://example.test/source',1,now());
      insert into story_articles values(1,1);`);
    const source=readFileSync(new URL('../src/models.ts',import.meta.url),'utf8');
    const query=source.match(/const rows = await sql`([\s\S]*?)`;/)[1];
    assert.equal((await db.query(query)).rows.length,1);
    assert.equal((await db.query(query)).rows.length,0);
    const [row]=(await db.query("select * from models")).rows;
    assert.equal(row.name,"Test Model");assert.equal(row.source_url,"https://example.test/source");
    assert.equal(row.released_at,null);assert.deepEqual(row.benchmarks,{});
  } finally {await db.close();}
});
