import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import http from 'node:http';
import {openDatabase} from '../server/database.js';
import {readConfig,loadSigningSecret} from '../server/config.js';
import {createRateLimit} from '../server/rate-limit.js';
import {createHttpServer,clientAddress} from '../server/http.js';
const ranking=JSON.parse(readFileSync(new URL('../public/data/idols.json',import.meta.url))).idols.slice(0,9).map(m=>m.id);
const temporary=()=>mkdtempSync(path.join(tmpdir(),'oshi9-selfhost-'));
function clean(dir){assert.equal(path.dirname(path.resolve(dir)),path.resolve(tmpdir()));assert.ok(path.basename(dir).startsWith('oshi9-selfhost-'));rmSync(dir,{recursive:true,force:true});}
async function serve(db,signingSecret,overrides={}){
 const config={port:0,host:'127.0.0.1',proxyHops:0,publicOrigin:null,...overrides};
 const services={db,signingSecret,apiIpLimit:createRateLimit(300),uploadIpLimit:createRateLimit(300),uploadVisitorLimit:createRateLimit(30)};
 const server=createHttpServer(config,services);await new Promise(resolve=>server.listen(overrides.listenPort||0,'127.0.0.1',resolve));config.port=server.address().port;
 const base=`http://127.0.0.1:${config.port}`;
 return {base,server,config,close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}

test('本机 HTTP 完整提交、持久化重启和无第三方配置运行',async()=>{
 const dir=temporary(),config=readConfig({DATA_DIR:dir}),secret=loadSigningSecret(config),filename=path.join(dir,'oshi9.sqlite');
 let db=openDatabase(filename),running=await serve(db,secret),cookie='';
 const call=async(route,body)=>{const r=await fetch(running.base+route,{method:body?'POST':'GET',headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json',Origin:running.base}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()};};
 try{
  const home=await fetch(running.base+'/');assert.equal(home.status,200);assert.match(await home.text(),/推颜九选/);
  const avatar=await fetch(running.base+'/images/demo/member-01.svg');assert.match(avatar.headers.get('content-type'),/image\/svg/);assert.match(await avatar.text(),/DEMO 01/);
  const id=crypto.randomUUID(),session=await call('/api/submission-session',{id,ranking});assert.equal(session.status,200);assert.match(cookie,/^oshi9_visitor=/);
  const body={id,ranking,submissionToken:session.data.token};assert.equal((await call('/api/results',body)).data.outcome,'recorded');
  assert.equal((await call('/api/results',body)).data.outcome,'already_recorded');
  const nextId=crypto.randomUUID(),next=await call('/api/submission-session',{id:nextId,ranking});
  assert.equal((await call('/api/results',{id:nextId,ranking,submissionToken:next.data.token})).status,429);
  assert.equal((await call('/api/result-status?id='+id)).data.recorded,true);
  const stats=await call('/api/ranking');assert.equal(stats.data.total,1);assert.equal(stats.data.rankings.length,9);
  assert.equal((await call('/api/insights')).status,404);
  const oldPort=running.config.port;await running.close();db.close();
  db=openDatabase(filename);assert.equal(loadSigningSecret(config),secret);assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM runs').get().n,1);assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n,4);
  running=await serve(db,secret,{listenPort:oldPort});
  const result=await new Promise((resolve,reject)=>{const req=http.get(running.base+'/api/result-status?id='+id,{agent:false,headers:{Cookie:cookie}},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(body)}));});req.on('error',reject);});assert.equal(result.status,200);assert.equal(result.data.recorded,true);
 }finally{await running.close();db.close();clean(dir);}
});

test('真实 HTTP 拒绝来源伪造、超长和分块请求、私有路径；静态 HEAD 正常',async()=>{
 const db=openDatabase(':memory:'),running=await serve(db,'x'.repeat(64));
 try{
  for(const pathname of ['/insights/','/storage/signing-key','/.env','/../LICENSE','/%2e%2e%5cLICENSE'])assert.equal((await fetch(running.base+pathname)).status,404);
  assert.equal((await fetch(running.base+'/%ZZ')).status,400);
  const badHost=await new Promise((resolve,reject)=>{const req=http.get(running.base+'/',{headers:{Host:'evil.example'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);});assert.equal(badHost,400);
  assert.equal((await fetch(running.base+'/style.css',{method:'HEAD'})).status,200);
  assert.equal((await fetch(running.base+'/',{method:'POST'})).status,405);
  const request={method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:JSON.stringify({id:crypto.randomUUID(),ranking})};
  assert.equal((await fetch(running.base+'/api/submission-session',request)).status,403);
  assert.equal((await fetch(running.base+'/api/results',{method:'POST',body:'x'.repeat(8193)})).status,413);
  const chunked=await new Promise((resolve,reject)=>{
   const req=http.request(running.base+'/api/results',{method:'POST',headers:{'Content-Type':'application/json','Transfer-Encoding':'chunked'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
   req.on('error',reject);req.write('x'.repeat(8193));req.end();
  });assert.equal(chunked,413);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM runs').get().n,0);
 }finally{await running.close();db.close();}
});

test('代理默认不受信，显式跳数从受控代理链右侧取 IP；IPv4 映射统一',()=>{
 const request={socket:{remoteAddress:'::ffff:127.0.0.1'},headers:{'x-forwarded-for':'198.51.100.1, 192.0.2.10'}};
 assert.equal(clientAddress(request), '127.0.0.1');assert.equal(clientAddress(request,1),'192.0.2.10');assert.equal(clientAddress(request,2),'198.51.100.1');
 assert.throws(()=>clientAddress(request,3));assert.throws(()=>clientAddress({...request,headers:{'x-forwarded-for':'evil'}},1));
 assert.throws(()=>readConfig({PUBLIC_ORIGIN:'https://site.example/path'}));assert.throws(()=>readConfig({TRUST_PROXY_HOPS:'-1'}));assert.throws(()=>readConfig({PORT:'bad'}));
 assert.throws(()=>readConfig({DATA_DIR:'public/storage'}));
});

test('内存限流限制大小，过期恢复；签名密钥跨启动保留且环境可覆盖',async()=>{
 let now=1000;const limiter=createRateLimit(2,{maxKeys:2,now:()=>now});
 assert.equal((await limiter.limit({key:'a'})).success,true);assert.equal((await limiter.limit({key:'a'})).success,true);assert.equal((await limiter.limit({key:'a'})).success,false);
 assert.equal((await limiter.limit({key:'b'})).success,true);assert.equal((await limiter.limit({key:'c'})).success,false);now+=60000;assert.equal((await limiter.limit({key:'c'})).success,true);
 const dir=temporary();try{const c=readConfig({DATA_DIR:dir}),first=loadSigningSecret(c);assert.equal(first.length,64);assert.equal(loadSigningSecret(c),first);assert.equal(loadSigningSecret({...c,signingSecret:'z'.repeat(32)}),'z'.repeat(32));assert.throws(()=>loadSigningSecret({...c,signingSecret:'short'}));}finally{clean(dir);}
});
