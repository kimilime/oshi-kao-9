import {memberRegion} from './regions.js';
// This module never makes a network request. Photos and records stay in IndexedDB.
const DB_NAME = 'chekimate-private-members';
function openDB() { return new Promise((resolve, reject) => { const r=indexedDB.open(DB_NAME,2);r.onupgradeneeded=()=>{for(const name of ['members','photos'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('浏览器不允许本地存储，请退出无痕模式后重试')); }); }
async function transaction(mode, action, name='members') { const db=await openDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(name,mode),store=tx.objectStore(name);const request=action(store);tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(new Error('本地存储失败，可能空间不足'));tx.onabort=()=>reject(new Error('本地保存已取消'));});}finally{db.close();} }
export const loadLocalMembers = () => transaction('readonly',store=>store.getAll());
export const saveLocalMembers = members => transaction('readwrite',store=>{for(const member of members)store.put(member);});
export const removeLocalMember = id => transaction('readwrite',store=>store.delete(id));
export const loadPhotoOverrides = () => transaction('readonly',store=>store.getAll(),'photos');
export const savePhotoOverride = (id,pic) => transaction('readwrite',store=>store.put({id,pic}),'photos');
export const removePhotoOverride = id => transaction('readwrite',store=>store.delete(id),'photos');
export const resultPhoto = (member,overrides) => overrides[member.id] || member.pic;
export function publicRanking(ranking, officialIds) { return ranking.every(id=>officialIds.has(id)) ? [...ranking] : null; }
export function validateMember(fields) {
  if(typeof fields.name!=='string'||!fields.name.trim()||fields.name.trim().length>60)throw new Error('名字请填写 1–60 字');
  if(typeof fields.group!=='string'||fields.group.trim().length>60)throw new Error('团体名称不能超过 60 字，可留空');
  const link=String(fields.weibo_link||'').trim();
  if(link){let u;try{u=new URL(link);}catch{throw new Error('微博链接格式不正确');}if(u.protocol!=='https:'||!(u.hostname==='weibo.com'||u.hostname.endsWith('.weibo.com')||u.hostname==='weibo.cn'||u.hostname.endsWith('.weibo.cn'))||u.username||u.password)throw new Error('请输入 https://weibo.com/ 或 https://weibo.cn/ 的微博链接');}
  const region=fields.province ?? fields.city;
  if(region!==undefined&&(typeof region!=='string'||region.trim().length>30))throw new Error('省级行政区名称不能超过 30 字');
  return {name:fields.name.trim(),group:fields.group.trim(),province:memberRegion(fields),city:fields.city?.trim()||'未填写',weibo_link:link};
}
export async function readPhoto(file) {
  if(!file||!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw new Error('照片请选择 JPG、PNG、WebP 或 GIF 文件');
  if(file.size>8*1024*1024)throw new Error('每张照片不能超过 8 MB');
  const url=URL.createObjectURL(file);
  try{const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('无法读取这张照片'));im.src=url;});
    const c=document.createElement('canvas'),ratio=Math.min(1,800/Math.max(img.width,img.height));c.width=Math.max(1,Math.round(img.width*ratio));c.height=Math.max(1,Math.round(img.height*ratio));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.88);
  }finally{URL.revokeObjectURL(url);}
}
export async function importMembers(jsonFile, photos, existingCount) {
  if(!jsonFile||jsonFile.size>40*1024*1024)throw new Error('请选择不超过 40 MB 的 JSON 文件');
  let parsed;try{parsed=JSON.parse(await jsonFile.text());}catch{throw new Error('JSON 格式不正确');}
  const rows=Array.isArray(parsed)?parsed:parsed?.idols;
  if(!Array.isArray(rows)||!rows.length||rows.length+existingCount>200)throw new Error('请使用人员数组或含 idols 数组的 JSON；本地最多保存 200 人');
  const files=new Map();for(const file of photos){if(files.has(file.name))throw new Error('照片文件名重复，请先重命名');files.set(file.name,file);}
  const result=[];
  for(let i=0;i<rows.length;i++){
    const row=rows[i];let fields;try{fields=validateMember(row);}catch(e){throw new Error(`第 ${i+1} 行：${e.message}`);}
    let pic;
    if(typeof row.pic==='string'&&/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(row.pic)){
      const [header,data]=row.pic.split(',');const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));pic=await readPhoto(new File([bytes],'photo',{type:header.slice(5,header.indexOf(';'))}));
    }else{
      // Only explicitly chosen local files are read. Remote URLs are never fetched.
      const filename=typeof row.pic==='string'?row.pic.split(/[\\/]/).at(-1):'';
      const file=files.get(filename);if(!file)throw new Error(`第 ${i+1} 行缺少照片 ${filename||'pic'}，请一并选择对应的本地图片`);pic=await readPhoto(file);
    }
    result.push({id:'local-'+crypto.randomUUID(),...fields,pic,local:true});
  }
  return result;
}

export async function clearLocalData(){
  const db=await openDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction(['members','photos'],'readwrite');tx.objectStore('members').clear();tx.objectStore('photos').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(new Error('本机资料清除失败'));tx.onabort=()=>reject(new Error('本机资料清除已取消'));});}finally{db.close();}
}
