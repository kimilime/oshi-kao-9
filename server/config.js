import {mkdirSync,readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';

export function readConfig(env=process.env){
 const port=Number(env.PORT||8788),proxyHops=Number(env.TRUST_PROXY_HOPS||0);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be 1–65535');
 if(!Number.isInteger(proxyHops)||proxyHops<0||proxyHops>10)throw Error('TRUST_PROXY_HOPS must be 0–10');
 const dataDir=path.resolve(env.DATA_DIR||'storage'),publicOrigin=env.PUBLIC_ORIGIN?.trim()||null;
 const publicDir=realpathSync(new URL('../public/',import.meta.url)),actualData=existsSync(dataDir)?realpathSync(dataDir):dataDir;
 if(actualData===publicDir||actualData.startsWith(publicDir+path.sep))throw Error('DATA_DIR must be outside public/');
 if(publicOrigin){const url=new URL(publicOrigin);if(!['http:','https:'].includes(url.protocol)||url.origin!==publicOrigin)throw Error('PUBLIC_ORIGIN must be an http(s) origin without a trailing slash or path');}
 return {port,host:env.HOST||'127.0.0.1',proxyHops,dataDir,publicOrigin,signingSecret:env.SUBMISSION_SECRET||null};
}
export function loadSigningSecret(config){
 if(config.signingSecret){if(config.signingSecret.length<32)throw Error('SUBMISSION_SECRET must contain at least 32 characters');return config.signingSecret;}
 mkdirSync(config.dataDir,{recursive:true,mode:0o700});
 const filename=path.join(config.dataDir,'signing-key');
 try{writeFileSync(filename,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});}
 catch(error){if(error.code!=='EEXIST')throw error;}
 const secret=readFileSync(filename,'utf8').trim();
 if(secret.length<32)throw Error('Stored signing key is invalid');
 return secret;
}
