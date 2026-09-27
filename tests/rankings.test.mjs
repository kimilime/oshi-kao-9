import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readRankings} from '../server/rankings.js';

test('集合查找与旧版连接查询及独立计数一致，保留整份排除、并列顺序和前100名',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE runs(ranking TEXT)');
 const ids=Array.from({length:1857},(_,i)=>`weibo-${10000+i}`),rows=[];
 const insert=sql.prepare('INSERT INTO runs VALUES(?)');
 for(let i=0;i<1350;i++)rows.push(Array.from({length:9},(_,j)=>ids[(i*17+j*101)%ids.length]));
 rows.push(rows[0],rows[0],ids.slice(0,8),[...ids.slice(0,8),'removed'],[...ids.slice(0,8),null],[],[...ids.slice(0,8),10000]);
 rows.forEach(r=>insert.run(JSON.stringify(r)));
 const adapter=legacy=>({prepare:q=>{if(legacy)q=q.replace('entry WHERE entry.value IS NULL OR entry.value NOT IN (SELECT id FROM allowed)','entry LEFT JOIN allowed ON entry.value=allowed.id WHERE allowed.id IS NULL');return {bind:(...args)=>({all:async()=>({results:sql.prepare(q).all(...args)}),first:async()=>sql.prepare(q).get(...args)})};}});
 for(const allowed of [ids,ids.slice(1),[]])for(const metric of ['top9','first']){
  const actual=await readRankings(adapter(false),allowed,metric);
  assert.deepEqual(actual,await readRankings(adapter(true),allowed,metric));
  const set=new Set(allowed),eligible=rows.filter(r=>r.length===9&&r.every(id=>set.has(id))),counts=new Map();
  for(const r of eligible)for(const id of metric==='first'?r.slice(0,1):r)counts.set(id,(counts.get(id)||0)+1);
  const expected=[...counts].map(([id,count])=>({id,count})).sort((a,b)=>b.count-a.count||(a.id<b.id?-1:a.id>b.id?1:0)).slice(0,100);
  assert.deepEqual(JSON.parse(JSON.stringify(actual)),{rankings:expected,total:eligible.length});
 }
 sql.close();
});
test('更换演示快照后，旧票和已移除成员不占排行名额或总数；支持千人快照',async()=>{
  const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE runs(ranking TEXT)');
  const ids=Array.from({length:1691},(_,i)=>`weibo-${10000+i}`),ranking=ids.slice(0,9);
  const insert=sql.prepare('INSERT INTO runs VALUES(?)');
  for(let i=0;i<110;i++)insert.run(JSON.stringify(Array.from({length:9},(_,j)=>`demo-${i}-${j}`)));
  insert.run(JSON.stringify([...ranking.slice(0,8),'removed']));
  insert.run(JSON.stringify([...ranking.slice(0,8),null]));
  insert.run(JSON.stringify(ranking));insert.run(JSON.stringify(ranking));
  const db={prepare:q=>({bind:(...args)=>({all:async()=>({results:sql.prepare(q).all(...args)}),first:async()=>sql.prepare(q).get(...args)})})};
  const top=await readRankings(db,ids,'top9'),first=await readRankings(db,ids,'first');
  assert.equal(top.total,2);assert.equal(top.rankings.length,9);assert.ok(top.rankings.every(r=>r.count===2));
  assert.equal(first.total,2);assert.equal(first.rankings.length,1);assert.equal(first.rankings[0].id,ranking[0]);sql.close();
});

import {readRankingsCached} from '../server/rankings.js';
test('榜单缓存合并并发读取，区分指标与名单，避免每次请求扫描数据库',async()=>{
 let reads=0;const db={prepare:()=>({bind:()=>({all:async()=>{reads++;await new Promise(r=>setTimeout(r,10));return {results:[]}},first:async()=>{reads++;return {count:0}}})})};
 let time=1000;const cache={now:()=>time};
 const ids=new Set(['one','two']);
 const batch=await Promise.all(Array.from({length:20},()=>readRankingsCached(db,ids,'top9','https://example.test',cache)));
 assert.equal(reads,2);assert.equal(batch.length,20);
 assert.equal((await readRankingsCached(db,ids,'top9','https://example.test',cache)).status,'HIT');assert.equal(reads,2);
 await readRankingsCached(db,ids,'first','https://example.test',cache);assert.equal(reads,4);
 await readRankingsCached(db,new Set(['new']),'top9','https://example.test',cache);assert.equal(reads,6);
 time+=31000;await readRankingsCached(db,ids,'top9','https://example.test',cache);assert.equal(reads,8);
});
