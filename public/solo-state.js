export const SOLO_DB='oshi9-solo-v1';
export const DEFAULT_SOLO_CAPTION='九个瞬间，同一个你。';
export const soloCaption=state=>state.caption??DEFAULT_SOLO_CAPTION;
export const emptySolo=()=>({version:1,name:'',caption:DEFAULT_SOLO_CAPTION,photos:[],game:null});
export function isSoloUnfinished(state){return Boolean(state.photos.length && (!state.game || !['ready','result'].includes(state.game.stage)));}
export function validateSolo(state){if(typeof soloCaption(state)!=='string'||soloCaption(state).length>40)throw Error('图片文案请控制在 40 字以内');if(!state.name.trim()||state.name.trim().length>40)throw Error('请填写名字（1–40 字）');if(state.photos.length<9||state.photos.length>30)throw Error('请选择 9–30 张照片');if(new Set(state.photos.map(p=>p.id)).size!==state.photos.length)throw Error('照片编号重复');}
async function store(mode,action){const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(SOLO_DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('session');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('单推版本机存储暂不可用'));});try{return await new Promise((resolve,reject)=>{const tx=db.transaction('session',mode),r=action(tx.objectStore('session'));tx.oncomplete=()=>resolve(r.result);tx.onerror=tx.onabort=()=>reject(Error('单推版保存失败，请检查本机可用空间'));});}finally{db.close();}}
export const loadSolo=async()=>await store('readonly',s=>s.get('current'))||emptySolo();
export const saveSolo=state=>store('readwrite',s=>s.put(state,'current'));
