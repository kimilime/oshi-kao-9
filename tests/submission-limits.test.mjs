import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {submitLimited} from '../server/submission-limits.js';
function fixture(){const sql=new DatabaseSync(':memory:');for(const p of ['0001_initial.sql','0002_submission_limits.sql','0003_remove_ip_limit.sql','0004_cumulative_results.sql'])sql.exec(readFileSync(new URL('../migrations/'+p,import.meta.url),'utf8'));return {sql,prepare(q){return {bind(...args){return {q,args}}}},async batch(stmts){sql.exec('BEGIN');try{const out=stmts.map(s=>({meta:sql.prepare(s.q).run(...s.args)}));sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};}
const ranking=Array.from({length:9},(_,i)=>'demo-'+i);
const data=(visitor,now=1000,day='2026-09-25',ipHash='shared')=>({id:crypto.randomUUID(),visitor,now,day,ipHash,ranking});
test('浏览器间隔跨 IP 和跨日生效，60 秒边界允许，相同名单累计计票',async()=>{const db=fixture();assert.ok(await submitLimited(db,data('a')));assert.equal(await submitLimited(db,data('a',1059,'2026-09-26','other')),false);assert.ok(await submitLimited(db,data('a',1060)));assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM runs').get().n,2);db.sql.close();});
test('无 IP 每日上限；同浏览器并发仅接受一条',async()=>{const db=fixture();const all=await Promise.all(Array.from({length:30},(_,i)=>submitLimited(db,data('v'+i))));assert.equal(all.filter(Boolean).length,30);const concurrent=await Promise.all(Array.from({length:10},()=>submitLimited(db,data('same'))));assert.equal(concurrent.filter(Boolean).length,1);assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM runs').get().n,31);db.sql.close();});
test('保存失败时回滚次数；过期限流记录清理',async()=>{const db=fixture();const first=data('a');await submitLimited(db,first);await assert.rejects(submitLimited(db,{...data('b'),id:first.id}));assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM submission_limits').get().n,1);await submitLimited(db,data('c',174000,'2026-09-27'));assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM submission_limits').get().n,1);db.sql.close();});
