import {readFile,access} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {memberGroups} from '../public/regions.js';
import {validateMember} from '../public/local-members.js';
const root=resolve('public'),catalog=JSON.parse(await readFile(resolve(root,'data/idols.json'),'utf8'));
if(typeof catalog.demo!=='boolean'||!Array.isArray(catalog.idols)||catalog.idols.length<9)throw new Error('数据需包含 demo 布尔值及至少 9 人的 idols 数组');
const ids=new Set();
for(const [index,idol]of catalog.idols.entries()){
  const prefix=`第 ${index+1} 行`;
  if(typeof idol.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(idol.id)||idol.id.startsWith('local-')||ids.has(idol.id))throw new Error(`${prefix}：id 不合法、重复或使用了保留前缀 local-`);
  ids.add(idol.id);validateMember(idol);
  if(typeof idol.province!=='string'||!idol.province.trim()||idol.province.trim().length>30)throw new Error(`${prefix}：province（省级行政区）必填，1–30 字`);
  if(typeof idol.pic!=='string')throw new Error(`${prefix}：缺少 pic`);
  if(idol.pic.startsWith('/')&&!idol.pic.startsWith('//')){
    const path=resolve(root,'.'+idol.pic);if(!path.startsWith(root+sep))throw new Error(`${prefix}：图片路径超出 public`);await access(path);
  }else{const u=new URL(idol.pic);if(u.protocol!=='https:'||u.username||u.password)throw new Error(`${prefix}：远程图片需为 HTTPS`);}
}
console.log(`数据验证通过：${ids.size} 位成员，${new Set(catalog.idols.flatMap(memberGroups)).size} 个团体，${catalog.demo?'演示':'正式'}快照。`);
