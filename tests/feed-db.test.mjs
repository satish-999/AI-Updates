import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
test('feed SQL separates updates/news, preserves unclassified events, searches bodies and prefers authoritative links', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table sources(id int primary key, name text, weight real, active boolean, last_ok_at timestamptz, last_error text);
      create table stories(id bigint primary key, one_liner text, category text, first_seen_at timestamptz, article_count int, importance real, search_tsv tsvector);
      create table articles(id bigint primary key, source_id int, title text, url text, published_at timestamptz, search_full tsvector);
      create table story_articles(story_id bigint, article_id bigint);
      insert into sources values (1,'Primary',1,true,now(),null),(2,'Press',0.7,true,now(),'timeout');
      insert into stories values (1,'A new model','model_release',now(),2,0.8,to_tsvector('model')),(2,'Funding news','funding',now(),1,0.5,to_tsvector('funding')),(3,null,null,now(),1,null,null);
      insert into articles values (1,2,'Press model','https://press.test/model',now(),to_tsvector('special detail')),(2,1,'Primary model','https://primary.test/model',now(),to_tsvector('model')),(3,2,'Funding','https://press.test/fund',now(),to_tsvector('funding')),(4,1,'Unclassified','https://primary.test/new',now(),to_tsvector('unclassified'));
      insert into story_articles values(1,1),(1,2),(2,3),(3,4);`);
    const source = readFileSync(new URL('../lib/feed.ts', import.meta.url),'utf8');
    const template = source.match(/const rows = await sql`([\s\S]*?)` as FeedStory/)[1];
    const query = template.replaceAll('${kind}','$1').replaceAll('${UPDATE_CATEGORIES}','$2').replaceAll('${q}','$3').replaceAll('${sort}','$4').replaceAll('${(page - 1) * 20}','$5');
    const run = (kind,q='',sort='latest',offset=0) => db.query(query,[kind,['model_release','product'],q,sort,offset]);
    const updates = (await run('updates')).rows;
    assert.equal(updates.length,1); assert.equal(updates[0].source_name,'Primary');
    assert.equal(updates[0].source_url,'https://primary.test/model');
    assert.equal((await run('news')).rows.length,2);
    assert.equal((await run('updates','special detail')).rows.length,1);
    assert.equal((await run('news','model')).rows.length,0);
    assert.equal((await run('news','','latest',20)).rows.length,0);
    const healthQuery = source.match(/const \[row\] = await sql`([\s\S]*?)`;/)[1];
    const health = (await db.query(healthQuery)).rows[0];
    assert.equal(health.failing,1); assert.equal(health.total,2); assert.equal(health.stale,0); assert.ok(health.latest);
  } finally { await db.close(); }
});
