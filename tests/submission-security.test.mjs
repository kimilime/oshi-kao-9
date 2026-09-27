import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/api.js';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {visitorIdentity,createSubmission,verifySubmission,readClaims,signClaims,checkBurst,readUploadBody} from '../server/submission-security.js';
const secret='a'.repeat(64), origin='https://site.example', ranking=JSON.parse(readFileSync(new URL('../public/data/idols.json',import.meta.url),'utf8')).idols.slice(0,9).map(m=>m.id);
const limiter=limit=>{const counts=new Map();return {counts,async limit({key}){const n=(counts.get(key)||0)+1;counts.set(key,n);return {success:n<=limit}}}};
const request=(path='/api/results',body,headers={})=>new Request(origin+path,{method:body?'POST':'GET',headers:{'X-Untrusted-IP':'192.0.2.1',...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
test('签名会话绑定身份、来源、名单顺序、结果编号和期限，拒绝篡改及用途混用',async()=>{
 const session=await createSubmission(secret,origin,'visitor','run',ranking,1000);
 assert.ok(await verifySubmission(session.token,secret,origin,'visitor','run',ranking,1599));
 for(const args of [ [origin,'other','run',ranking,1001],['https://other.example','visitor','run',ranking,1001],[origin,'visitor','other',ranking,1001],[origin,'visitor','run',[...ranking].reverse(),1001],[origin,'visitor','run',ranking,1600],[origin,'visitor','run',ranking,999]])assert.equal(await verifySubmission(session.token,secret,...args),null);
 assert.equal(await verifySubmission('x'+session.token,secret,origin,'visitor','run',ranking,1001),null);
 assert.equal(await verifySubmission(session.token,secret+'bad',origin,'visitor','run',ranking,1001),null);
 const forged=await signClaims({v:1,type:'visitor',origin,visitor:'visitor',id:'run',iat:1000,exp:2000},secret);
 assert.equal(await verifySubmission(forged,secret,origin,'visitor','run',ranking,1001),null);
 assert.equal(await readClaims(session.token+'.extra',secret,'submission',origin,1001),null);
});
test('Cookie 只能由服务器签发；旧 UUID 或篡改 Cookie 不被承认为原身份',async()=>{
 const first=await visitorIdentity(request(),secret), cookie=first.headers['Set-Cookie'].split(';')[0];
 assert.match(first.headers['Set-Cookie'],/HttpOnly; SameSite=Lax.*Secure/);
 assert.equal((await visitorIdentity(request('/api/results',null,{Cookie:cookie}),secret)).visitor,first.visitor);
 assert.notEqual((await visitorIdentity(request('/api/results',null,{Cookie:cookie.replace('=','=x')}),secret)).visitor,first.visitor);
 assert.notEqual((await visitorIdentity(request('/api/results',null,{Cookie:'untrusted_visitor='+first.visitor}),secret)).visitor,first.visitor);
});
test('只限上传接口；同 IP 多浏览器共享宽松上限，IP 不以明文作为键',async()=>{
 const env={signingSecret:secret,apiIpLimit:limiter(120),uploadIpLimit:limiter(300),uploadVisitorLimit:limiter(30)};
 for(let i=0;i<30;i++)assert.equal(await checkBurst(request(),env,'v'),true);
 assert.equal(await checkBurst(request(),env,'v'),false);
 for(let i=31;i<300;i++)assert.equal(await checkBurst(request(),env,'new'+i),true);
 assert.equal(await checkBurst(request(),env,'fresh'),false);
 for(const path of ['/','/api/ranking','/api/reviews','/images/a.webp'])assert.equal(await checkBurst(request(path),env,'v'),true);
 assert.ok([...env.uploadIpLimit.counts.keys()].every(key=>!key.includes('192.0.2.1')));
 await assert.rejects(checkBurst(request(),{signingSecret:secret},'v'));
});
test('流式限制上传体积，不依赖 Content-Length',async()=>{
 assert.equal(await readUploadBody(new Request(origin,{method:'POST',body:'x'.repeat(8193)})),null);
 assert.equal((await readUploadBody(new Request(origin,{method:'POST',body:'x'.repeat(8192)}))).length,8192);
});
function database(){
 const sql=new DatabaseSync(':memory:');
 for(const file of ['0001_initial.sql','0002_submission_limits.sql','0003_remove_ip_limit.sql','0004_cumulative_results.sql'])sql.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
 const db={sql,prepare(q){return {async first(){return sql.prepare(q).get()||null},async all(){return {results:sql.prepare(q).all()}},bind(...args){return {q,args,async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}}}}}},async batch(stmts){sql.exec('BEGIN');try{const result=stmts.map(s=>({meta:sql.prepare(s.q).run(...s.args)}));sql.exec('COMMIT');return result}catch(e){sql.exec('ROLLBACK');throw e}}};return db;
}

test('自部署新库为空、签名会话无需第三方服务，统计接口不存在',async()=>{
 const db=database(),env={db,signingSecret:secret,apiIpLimit:limiter(120),uploadIpLimit:limiter(300),uploadVisitorLimit:limiter(30)};
 try{
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM runs').get().n,0);
  assert.deepEqual(await (await worker.fetch(request('/api/ranking'),env)).json(),{rankings:[],total:0});
  assert.equal((await worker.fetch(request('/api/insights'),env)).status,404);
  assert.equal((await worker.fetch(request('/api/submission-session',{id:crypto.randomUUID(),ranking}),env)).status,200);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM runs').get().n,0);
 }finally{db.sql.close();}
});
test('完整提交：签名绑定名单和身份，同次不重复，新一局一分钟受限',async()=>{
 const db=database(),env={db,signingSecret:secret,apiIpLimit:limiter(120),uploadIpLimit:limiter(300),uploadVisitorLimit:limiter(30)};
 let cookie='';const call=async(path,body)=>{const r=await worker.fetch(request(path,body,{Cookie:cookie,Origin:origin}),env);if(r.headers.get('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];return {status:r.status,data:await r.json()};};
 try{
  const id=crypto.randomUUID();assert.equal((await call('/api/results',{id,ranking})).status,403);
  const session=await call('/api/submission-session',{id,ranking});assert.equal(session.status,200);
  const body={id,ranking,submissionToken:session.data.token};
  assert.equal((await call('/api/results',{...body,ranking:[...ranking].reverse()})).status,403);
  assert.equal((await call('/api/results',body)).data.outcome,'recorded');
  assert.equal((await call('/api/results',body)).data.outcome,'already_recorded');
  const nextId=crypto.randomUUID(),next=await call('/api/submission-session',{id:nextId,ranking});
  assert.equal((await call('/api/results',{id:nextId,ranking,submissionToken:next.data.token})).status,429);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM runs').get().n,1);
 }finally{db.sql.close();}
});
test('失败请求在读取数据/访问数据库之前计入限流，触发时给出重试时间；榜单读取不受影响',async()=>{
 const env={signingSecret:secret,apiIpLimit:limiter(120),uploadIpLimit:limiter(3),uploadVisitorLimit:limiter(2)};
 let cookie='';
 for(let i=0;i<4;i++){
  const r=await worker.fetch(request('/api/results',{bad:true},{Cookie:cookie}),env);
  if(r.headers.get('Set-Cookie'))cookie=r.headers.get('Set-Cookie').split(';')[0];
  assert.equal(r.status,i<2?400:429);
  if(i>=2){assert.equal(r.headers.get('Retry-After'),'60');assert.equal((await r.json()).code,'burst_limit')}
 }
 assert.equal((await worker.fetch(request('/api/result-status'),env)).status,429);
 const db=database();try{assert.equal((await worker.fetch(request('/api/ranking'),{...env,db:db})).status,200)}finally{db.sql.close()}
});

import {checkApiBurst,networkBucket} from '../server/submission-security.js';
test('所有API先做IP限流，IPv6同网段轮换共享桶；限流前不读数据库不签发身份',async()=>{
 const env={signingSecret:secret,apiIpLimit:limiter(2)};
 assert.equal(networkBucket('2001:0db8:abcd:0001::1'),networkBucket('2001:db8:abcd:1:1234:5678:9abc:def0'));
 assert.notEqual(networkBucket('2001:db8:abcd:2::1'),networkBucket('2001:db8:abcd:1::1'));
 await checkApiBurst(request('/api/ranking'),env);await checkApiBurst(request('/api/ranking'),env);
 const res=await worker.fetch(request('/api/ranking?metric=top9&random=123'),env);
 assert.equal(res.status,429);assert.equal(res.headers.get('Set-Cookie'),null);assert.equal(res.headers.get('Retry-After'),'60');
});
test('禁用评价及未知POST也受到上传限流，不只保护results路径',async()=>{
 const env={signingSecret:secret,uploadIpLimit:limiter(2),uploadVisitorLimit:limiter(2)};
 assert.equal(await checkBurst(request('/api/report',{}),env,'v'),true);
 assert.equal(await checkBurst(request('/api/not-a-route',{}),env,'v'),true);
 assert.equal(await checkBurst(request('/api/reviews',{}),env,'v'),false);
});

test('缓慢请求体在截止时间取消，避免连接无限等待',async()=>{
 let cancelled=false;
 const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'))},cancel(){cancelled=true}});
 await assert.rejects(readUploadBody(new Request(origin,{method:'POST',body,duplex:'half'}),10),e=>e.code==='body_timeout');
 assert.equal(cancelled,true);
});
