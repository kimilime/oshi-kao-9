export const reserveSQL = `INSERT OR IGNORE INTO submission_limits (id,visitor,ip_hash,day,submitted_at)
SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM submission_limits WHERE visitor=? AND submitted_at>?)`;
export const saveSQL = `INSERT INTO runs (id,visitor,day,ranking)
SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM submission_limits WHERE id=? AND visitor=?)`;
export async function submitLimited(db,{id,visitor,day,now,ranking}){
  const receipt=crypto.randomUUID();
  const results=await db.batch([
    db.prepare('DELETE FROM submission_limits WHERE submitted_at < ?').bind(now-172800),
    db.prepare(reserveSQL).bind(receipt,visitor,'',day,now,visitor,now-60),
    db.prepare(saveSQL).bind(id,visitor,day,JSON.stringify(ranking),receipt,visitor)
  ]);
  return results[1].meta.changes===1;
}
