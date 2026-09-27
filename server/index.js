import path from 'node:path';
import {readConfig,loadSigningSecret} from './config.js';
import {openDatabase} from './database.js';
import {createRateLimit} from './rate-limit.js';
import {createHttpServer} from './http.js';

const config=readConfig(),signingSecret=loadSigningSecret(config);
const db=openDatabase(path.join(config.dataDir,'oshi9.sqlite'));
const server=createHttpServer(config,{db,signingSecret,apiIpLimit:createRateLimit(300),uploadIpLimit:createRateLimit(300),uploadVisitorLimit:createRateLimit(30)});
server.listen(config.port,config.host,()=>console.log(`推颜九选已启动：${config.publicOrigin||'http://localhost:'+config.port}`));
server.on('error',error=>{console.error(error.message);db.close();process.exitCode=1;});
let stopping=false;
function stop(){if(stopping)return;stopping=true;const timer=setTimeout(()=>server.closeAllConnections(),10000);timer.unref();server.close(()=>{clearTimeout(timer);db.close();});}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
