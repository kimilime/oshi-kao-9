// Restrict complete runs before LIMIT, so removed/demo accounts cannot crowd out
// current members or inflate the current snapshot's total.
export async function readRankings(db, ids, metric) {
  const allowed=JSON.stringify([...ids]);
  const eligible=`WITH allowed AS (SELECT value AS id FROM json_each(?)), eligible AS (
    SELECT ranking FROM runs WHERE json_array_length(ranking)=9 AND NOT EXISTS (
      SELECT 1 FROM json_each(runs.ranking) entry WHERE entry.value IS NULL OR entry.value NOT IN (SELECT id FROM allowed)
    )
  )`;
  const {results}=await db.prepare(`${eligible} SELECT j.value AS id, COUNT(*) AS count FROM eligible, json_each(eligible.ranking) j ${metric==='first'?'WHERE j.key=0':''} GROUP BY j.value ORDER BY count DESC,j.value ASC LIMIT 100`).bind(allowed).all();
  const total=await db.prepare(`${eligible} SELECT COUNT(*) AS count FROM eligible`).bind(allowed).first();
  return {rankings:results,total:total.count};
}

// Two cache entries per active catalog, local to one process. No external cache API.
const state=new WeakMap();
export async function readRankingsCached(db,ids,metric,origin,{now=Date.now,ttl=30000}={}){
 let catalog=state.get(db);if(!catalog||catalog.ids!==ids){catalog={ids,entries:new Map(),pending:new Map()};state.set(db,catalog);}
 const hit=catalog.entries.get(metric);
 if(hit&&hit.expires>now())return {data:hit.data,status:'HIT'};
 let pending=catalog.pending.get(metric);
 if(!pending){
  pending=(async()=>{const data=await readRankings(db,ids,metric);catalog.entries.set(metric,{data,expires:now()+ttl});return data;})();
  catalog.pending.set(metric,pending);pending.finally(()=>catalog.pending.delete(metric)).catch(()=>{});
 }
 return {data:await pending,status:'MISS'};
}
