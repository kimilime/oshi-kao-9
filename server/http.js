import http from 'node:http';
import {isIP} from 'node:net';
import {createReadStream} from 'node:fs';
import {stat,realpath,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import api from './api.js';

const publicRoot=path.resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon'};
export function clientAddress(request,proxyHops=0){
 const direct=request.socket.remoteAddress||'';
 const normalized=ip=>ip.startsWith('::ffff:')&&isIP(ip.slice(7))===4?ip.slice(7):ip;
 if(!proxyHops)return normalized(direct);
 const raw=request.headers['x-forwarded-for'],addresses=typeof raw==='string'?raw.split(',').map(s=>s.trim()):[];
 if(addresses.length<proxyHops||addresses.some(ip=>!isIP(ip)))throw Object.assign(Error('Invalid proxy chain'),{status:400});
 return normalized([...addresses,direct].at(-1-proxyHops));
}
function requestOrigin(request,config){
 const host=request.headers.host;
 if(config.publicOrigin){if(host!==new URL(config.publicOrigin).host)throw Object.assign(Error('Unexpected Host'),{status:400});return config.publicOrigin;}
 if(![`localhost:${config.port}`,`127.0.0.1:${config.port}`,`[::1]:${config.port}`].includes(host))throw Object.assign(Error('Set PUBLIC_ORIGIN for remote access'),{status:400});
 return 'http://'+host;
}
function requestBody(req,res){
 let onData,onEnd,onError,onClose;
 const cleanup=()=>{req.off('data',onData);req.off('end',onEnd);req.off('error',onError);req.off('close',onClose);};
 return new ReadableStream({
  start(controller){
   onData=chunk=>{controller.enqueue(new Uint8Array(chunk));if(controller.desiredSize<=0)req.pause();};
   onEnd=()=>{cleanup();controller.close();};
   onError=error=>{cleanup();controller.error(error);};
   onClose=()=>{if(!req.complete)onError(Error('Client disconnected'));};
   req.on('data',onData);req.on('end',onEnd);req.on('error',onError);req.on('close',onClose);
  },
  pull(){req.resume();},
  cancel(){cleanup();req.pause();if(!res.headersSent)res.setHeader('Connection','close');}
 },{highWaterMark:8192,size:chunk=>chunk.byteLength});
}
export function createHttpServer(config,services){
 const server=http.createServer({maxHeaderSize:16384},async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  try{
   const origin=requestOrigin(req,config);
   if(!req.url.startsWith('/')||req.url.startsWith('//'))throw Object.assign(Error('Invalid path'),{status:400});
   const rawPath=req.url.split('?')[0],decoded=decodeURIComponent(rawPath);
   if(decoded.includes('\\')||decoded.includes('\0')||decoded.split('/').some(part=>part.startsWith('.')))throw Object.assign(Error('Not found'),{status:404});
   const url=new URL(req.url,origin);
   if(url.pathname.startsWith('/api/')){
    if(req.headers['content-length']&&Number(req.headers['content-length'])>8192){res.setHeader('Connection','close');throw Object.assign(Error('Request too large'),{status:413});}
    const headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(value!==undefined)headers.set(name,Array.isArray(value)?value.join(','):value);
    const options={method:req.method,headers};
    if(!['GET','HEAD'].includes(req.method)){options.body=requestBody(req,res);options.duplex='half';}
    const webRequest=new Request(url,options);
    const response=await api.fetch(webRequest,{...services,clientAddress:clientAddress(req,config.proxyHops)});
    if(webRequest.body&&!webRequest.bodyUsed)await webRequest.body.cancel();
    res.statusCode=response.status;response.headers.forEach((value,name)=>res.setHeader(name,value));
    if(req.method==='HEAD'||!response.body)return res.end();
    return await pipeline(Readable.fromWeb(response.body),res);
   }
   if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');throw Object.assign(Error('Method not allowed'),{status:405});}
   const filename=path.resolve(publicRoot,'.'+(decoded==='/'?'/index.html':decoded));
   if(!filename.startsWith(publicRoot+path.sep))throw Object.assign(Error('Not found'),{status:404});
   let info,actual;
   try{actual=await realpath(filename);info=await stat(actual);}catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))throw Object.assign(Error('Not found'),{status:404});throw error;}
   if(!actual.startsWith(publicRoot+path.sep)||!info.isFile())throw Object.assign(Error('Not found'),{status:404});
   res.setHeader('Content-Type',mime[path.extname(actual)]||'application/octet-stream');
   res.setHeader('Cache-Control','no-cache');res.setHeader('Content-Length',info.size);
   if(req.method==='HEAD')return res.end();
   await pipeline(createReadStream(actual),res);
  }catch(error){
   if(res.headersSent){res.destroy();return;}
   const code=error instanceof URIError?400:error.status||500;
   res.statusCode=code;res.setHeader('Cache-Control','no-store');
   if(code===404){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(req.method==='HEAD'?undefined:await readFile(path.join(publicRoot,'404.html')));}
   res.setHeader('Content-Type','application/json');res.end(req.method==='HEAD'?undefined:JSON.stringify({error:code===500?'服务暂时不可用':http.STATUS_CODES[code]}));
   if(code===500)console.error('HTTP request failed:',error.message);
  }
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=100;
 return server;
}
