import assert from 'node:assert/strict';
const base=new URL('/api/',process.argv[2]||'http://127.0.0.1:8788').href;
let cookie='';
async function req(path,body){const r=await fetch(base+path,{headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});const c=r.headers.get('set-cookie');if(c)cookie=c.split(';')[0];return {status:r.status,data:await r.json()};}
const catalog=await (await fetch(new URL('/data/idols.json',base))).json();
const ranking=catalog.idols.slice(0,9).map(m=>m.id),id=crypto.randomUUID();
assert.equal((await req('results',{id,ranking:[...ranking.slice(0,8),'local-private']})).status,400);
assert.equal((await req('results',{id,ranking})).status,403);
const session=await req('submission-session',{id,ranking});
assert.equal(session.status,200);assert.match(cookie,/^oshi9_visitor=/);
const body={id,ranking,submissionToken:session.data.token};
assert.equal((await req('results',{...body,ranking:[...ranking].reverse()})).status,403);
assert.equal((await req('results',{...body,submissionToken:'x'+body.submissionToken})).status,403);
assert.equal((await req('results',{...body,id:crypto.randomUUID()})).status,403);
const top=await req('ranking');assert.equal(top.status,200);
console.log('线上拒绝路径通过：自定义名单、缺少会话、改顺序、改签名、改结果编号均无法计票。未写入测试票。');
