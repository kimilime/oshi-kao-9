// Single-process fixed windows. Never evict active buckets to make space.
export function createRateLimit(limit,{windowMs=60000,maxKeys=20000,now=Date.now}={}){
 const entries=new Map();let nextSweep=0;
 return {async limit({key}){
  const time=now();
  if(time>=nextSweep){for(const [key,value] of entries)if(value.until<=time)entries.delete(key);nextSweep=time+1000;}
  let value=entries.get(key);
  if(!value||value.until<=time){
   if(!value&&entries.size>=maxKeys)return {success:false};
   value={count:0,until:time+windowMs};entries.set(key,value);
  }
  return {success:++value.count<=limit};
 }};
}
