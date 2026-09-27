import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

export function openDatabase(filename,{migrations=new URL('../migrations/',import.meta.url)}={}){
 if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
 const sql=new DatabaseSync(filename);
 try{
  sql.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  sql.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  for(const name of readdirSync(migrations).filter(name=>/^\d+.*\.sql$/.test(name)).sort()){
   sql.exec('BEGIN IMMEDIATE');
   try{
    if(!sql.prepare('SELECT 1 FROM schema_migrations WHERE name=?').get(name)){
     sql.exec(readFileSync(new URL(name,migrations),'utf8'));
     sql.prepare('INSERT INTO schema_migrations(name) VALUES(?)').run(name);
    }
    sql.exec('COMMIT');
   }catch(error){sql.exec('ROLLBACK');throw error;}
  }
 }catch(error){sql.close();throw error;}
 const prepare=(query,args=[])=>({query,args,bind:(...values)=>prepare(query,values),
  async all(){return {results:sql.prepare(query).all(...args)};},
  async first(){return sql.prepare(query).get(...args)||null;},
  async run(){return {meta:sql.prepare(query).run(...args)};}
 });
 return {sql,prepare,close:()=>sql.close(),async batch(statements){
  sql.exec('BEGIN IMMEDIATE');
  try{const result=statements.map(({query,args})=>({meta:sql.prepare(query).run(...args)}));sql.exec('COMMIT');return result;}
  catch(error){sql.exec('ROLLBACK');throw error;}
 }};
}
