const encoder = new TextEncoder();
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode = text => Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')), c => c.charCodeAt(0));
let cachedSecret,cachedKey;
const key = secret => {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Submission signing key unavailable');
  if(secret!==cachedSecret){cachedSecret=secret;cachedKey=crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
  return cachedKey;
};
export async function signClaims(claims, secret) {
  const payload = encode(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}
export async function readClaims(token, secret, type, origin, now = Math.floor(Date.now()/1000)) {
  if(typeof token !== 'string' || token.length > 3000) return null;
  try {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined || !await crypto.subtle.verify('HMAC', await key(secret), decode(signature), encoder.encode(payload))) return null;
    const claims = JSON.parse(new TextDecoder().decode(decode(payload)));
    return claims.v === 1 && claims.type === type && claims.origin === origin && Number.isInteger(claims.iat) && Number.isInteger(claims.exp) && claims.iat <= now && claims.exp > now ? claims : null;
  } catch { return null; }
}
export async function visitorIdentity(request, secret) {
  const url = new URL(request.url), now = Math.floor(Date.now()/1000);
  const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)oshi9_visitor=([^;]+)/)?.[1];
  const saved = await readClaims(token, secret, 'visitor', url.origin, now);
  if(saved && typeof saved.id === 'string') return {visitor:saved.id,headers:{}};
  const visitor = crypto.randomUUID();
  const signed = await signClaims({v:1,type:'visitor',id:visitor,origin:url.origin,iat:now,exp:now+31536000}, secret);
  return {visitor,headers:{'Set-Cookie':`oshi9_visitor=${signed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}`}};
}
const rankingHash = async ranking => encode(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(ranking)))));
export async function createSubmission(secret, origin, visitor, id, ranking, now = Math.floor(Date.now()/1000)) {
  const nonce = crypto.randomUUID();
  const token = await signClaims({v:1,type:'submission',origin,visitor,id,hash:await rankingHash(ranking),nonce,iat:now,exp:now+600}, secret);
  return {token,nonce,expiresAt:now+600};
}
export async function verifySubmission(token, secret, origin, visitor, id, ranking, now) {
  const claims = await readClaims(token, secret, 'submission', origin, now);
  return claims && claims.visitor === visitor && claims.id === id && claims.hash === await rankingHash(ranking) && typeof claims.nonce === 'string' ? claims : null;
}
const protectedPaths = new Set(['/api/results','/api/submission-session','/api/result-status']);
export const isUploadPath = path => protectedPaths.has(path);
export async function readUploadBody(request,timeoutMs=5000) {
  const reader=request.body?.getReader();if(!reader)return '';
  const chunks=[];let size=0,timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('Request body timed out'),{code:'body_timeout'})),timeoutMs);});
  try{
    while(true){
      const {done,value}=await Promise.race([reader.read(),timeout]);if(done)break;
      size+=value.byteLength;
      if(size>8192){reader.cancel().catch(()=>{});return null;}chunks.push(value);
    }
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return new TextDecoder().decode(bytes);
  }catch(error){reader.cancel().catch(()=>{});throw error;}finally{clearTimeout(timer);}
}
export async function checkBurst(request, env, visitor) {
  if(!isUploadPath(new URL(request.url).pathname)&&request.method!=='POST') return true;
  if(!env.uploadIpLimit || !env.uploadVisitorLimit) throw new Error('Upload rate limit unavailable');
  // The HTTP adapter supplies the client address; never trust a browser-supplied header.
  const ip = env.clientAddress || 'local';
  const digest = await crypto.subtle.sign('HMAC', await key(env.signingSecret), encoder.encode(`upload-ip:${networkBucket(ip)}`));
  const ipResult = await env.uploadIpLimit.limit({key:encode(new Uint8Array(digest))});
  if(!ipResult.success) return false;
  const browserResult = await env.uploadVisitorLimit.limit({key:visitor});
  return browserResult.success;
}

// Group IPv6 privacy addresses by /64 so rotating the host portion cannot reset a bucket.
export function networkBucket(ip){
  if(!ip.includes(':'))return ip;
  const text=ip.toLowerCase().split('%')[0];
  const [left,right]=text.split('::'),a=left?left.split(':'):[],b=right?right.split(':'):[];
  const parts=right===undefined?a:[...a,...Array(Math.max(0,8-a.length-b.length)).fill('0'),...b];
  return parts.slice(0,4).map(p=>parseInt(p||'0',16).toString(16)).join(':')+'::/64';
}
export async function checkApiBurst(request,env){
  if(!env.apiIpLimit)throw new Error('API rate limit unavailable');
  const address=networkBucket(env.clientAddress||'local');
  const digest=await crypto.subtle.sign('HMAC',await key(env.signingSecret),encoder.encode(`api-ip:${address}`));
  return (await env.apiIpLimit.limit({key:encode(new Uint8Array(digest))})).success;
}
