// Synthetic-only maintenance. Restore requires a stopped server and a durable deletion ledger.
import {DatabaseSync,backup} from 'node:sqlite';
import {chmodSync,copyFileSync,existsSync,fsyncSync,openSync,closeSync,renameSync,unlinkSync,readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {migrate} from './migrations.mjs';
import {privateFile,readLedger,durableWrite,applyDeletions,leaseDB,syncDirectory} from './storage.mjs';
function integrity(path){const db=new DatabaseSync(path,{readOnly:true});try{const rows=db.prepare('PRAGMA integrity_check').all();if(rows.length!==1||Object.values(rows[0])[0]!=='ok')throw Error('Backup integrity check failed');const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));for(const [t,columns] of Object.entries({fields:['id','owner_id','season','region_id','geometry','crop','area_ha','declared_ha','start','end','families','price','status','visibility','version','created','updated'],applications:['id','owner_id','role','region_id','data','status','created'],deletions:['id','kind','created'],sessions:['id','actor','role','region','csrf','expires']})){if(!tables.has(t))throw Error('Not an Opylytel backup');const existing=new Set(db.prepare('PRAGMA table_info('+t+')').all().map(x=>x.name));if(columns.some(c=>!existing.has(c)))throw Error('Backup schema mismatch')}return true}finally{db.close()}}
function syncFile(path){const fd=openSync(path,'r');try{fsyncSync(fd)}finally{closeSync(fd)}}
function sha(path){return createHash('sha256').update(readFileSync(path)).digest('hex')}
export async function snapshot(dbPath,destination,{ledgerPath=dbPath+'.deletions.jsonl'}={}){
 privateFile(dbPath,{mustExist:true});const out=privateFile(destination);privateFile(ledgerPath,{mustExist:true});readLedger(ledgerPath);
 if(existsSync(out)||existsSync(out+'.manifest.json'))throw Error('Backup destination exists');const tmp=out+'.partial-'+randomUUID();const db=new DatabaseSync(dbPath,{readOnly:true});
 try{await backup(db,tmp);integrity(tmp);chmodSync(tmp,0o600);syncFile(tmp);renameSync(tmp,out);syncDirectory(dirname(out));durableWrite(out+'.manifest.json',JSON.stringify({format:'opy-synthetic-sqlite-v1',sha256:sha(out),created:new Date().toISOString(),ledgerRequired:true})+'\n');return out}
 finally{db.close();if(existsSync(tmp))unlinkSync(tmp)}
}
export function restoreOffline(dbPath,source,ledgerPath=dbPath+'.deletions.jsonl'){
 dbPath=privateFile(dbPath);source=privateFile(source,{mustExist:true});ledgerPath=privateFile(ledgerPath,{mustExist:true});
 if([source,ledgerPath].includes(dbPath)||source===ledgerPath)throw Error('Source, DB and ledger must differ');
 const release=leaseDB(dbPath);let stage=null;
 try{
  privateFile(source+'.manifest.json',{mustExist:true});const manifest=JSON.parse(readFileSync(source+'.manifest.json','utf8'));if(manifest.format!=='opy-synthetic-sqlite-v1'||manifest.sha256!==sha(source))throw Error('Backup checksum mismatch');
  integrity(source);const events=readLedger(ledgerPath);
  // Stage and fully validate BEFORE touching the live pathname. A failed restore leaves it unchanged.
  stage=dbPath+'.restore-'+randomUUID();copyFileSync(source,stage);chmodSync(stage,0o600);const db=new DatabaseSync(stage);
  try{db.exec('PRAGMA secure_delete=ON');migrate(db);applyDeletions(db,events);db.exec('DELETE FROM sessions; VACUUM')}finally{db.close()}
  integrity(stage);syncFile(stage);
  if(existsSync(dbPath)){const previous=dbPath+'.before-restore-'+randomUUID();copyFileSync(dbPath,previous);chmodSync(previous,0o600);syncFile(previous)}
  renameSync(stage,dbPath);syncDirectory(dirname(dbPath));stage=null;return {restored:true,appliedDeletions:events.length};
 }finally{if(stage&&existsSync(stage))unlinkSync(stage);release()}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [cmd,db,file,ledger]=process.argv.slice(2);if(cmd==='backup')await snapshot(db,file,{ledgerPath:ledger||db+'.deletions.jsonl'});else if(cmd==='restore')restoreOffline(db,file,ledger||db+'.deletions.jsonl');else throw Error('Use backup DB DEST [LEDGER] or restore DB BACKUP LEDGER with server STOPPED');
}
