import {DatabaseSync} from 'node:sqlite';
import {appendFileSync,closeSync,existsSync,fsyncSync,lstatSync,mkdirSync,openSync,readFileSync,realpathSync,unlinkSync,writeFileSync,chmodSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {migrate} from './migrations.mjs';
export const appRoot=realpathSync(resolve(new URL('..',import.meta.url).pathname));
export function privateFile(path,{mustExist=false}={}){
 path=resolve(path);mkdirSync(dirname(path),{recursive:true,mode:0o700});const dir=realpathSync(dirname(path));
 if(dir===appRoot||dir.startsWith(appRoot+'/'))throw Error('Storage must be outside webroot');
 const st=lstatSync(path,{throwIfNoEntry:false});if(st){if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1)throw Error('Storage must be a regular unlinked private file');}
 else if(mustExist)throw Error('Required private file is missing');return path;
}
export function syncDirectory(path){const fd=openSync(path,'r');try{fsyncSync(fd)}finally{closeSync(fd)}}
export function durableWrite(path,text){const fd=openSync(path,'w',0o600);try{writeFileSync(fd,text);fsyncSync(fd)}finally{closeSync(fd)}chmodSync(path,0o600);syncDirectory(dirname(path))}
export function readLedger(path){privateFile(path,{mustExist:true});const text=readFileSync(path,'utf8');const events=[];for(const line of text.split('\n')){if(!line)continue;let e;try{e=JSON.parse(line)}catch{throw Error('Deletion ledger is corrupt; recovery blocked')}
 if(!e||!/^[a-f0-9-]{36}$/.test(e.id)||!['field','application'].includes(e.kind)||!Number.isFinite(Date.parse(e.created))||Object.keys(e).sort().join(',')!=='created,id,kind')throw Error('Invalid deletion ledger event');events.push(e)}return [...new Map(events.map(e=>[e.id,e])).values()]}
export function appendDeletion(path,event){privateFile(path);if(!existsSync(path))durableWrite(path,'');const fd=openSync(path,'a',0o600);try{appendFileSync(fd,JSON.stringify(event)+'\n');fsyncSync(fd)}finally{closeSync(fd)}}
export function applyDeletions(db,events){db.exec('BEGIN IMMEDIATE');try{for(const e of events){const table=e.kind==='field'?'fields':'applications';db.prepare(`DELETE FROM ${table} WHERE id=?`).run(e.id);db.prepare('INSERT OR IGNORE INTO deletions VALUES (?,?,?)').run(e.id,e.kind,e.created)}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}
export function leaseDB(path){const lock=privateFile(path+'.lock');let fd;try{fd=openSync(lock,'wx',0o600)}catch{throw Error('Database is locked. Stop the server; inspect a stale lease manually.')}writeFileSync(fd,JSON.stringify({pid:process.pid,started:new Date().toISOString()}));closeSync(fd);let released=false;return ()=>{if(!released){unlinkSync(lock);released=true}}}
export function openDB(path,{ledgerPath=path+'.deletions.jsonl'}={}){
 path=privateFile(path);ledgerPath=privateFile(ledgerPath);if(path===ledgerPath)throw Error('Ledger and database must differ');
 const sqlite=new DatabaseSync(path);try{chmodSync(path,0o600);sqlite.exec('PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON; PRAGMA journal_mode=DELETE; PRAGMA foreign_keys=ON');migrate(sqlite);
 if(!existsSync(ledgerPath)){durableWrite(ledgerPath,'');for(const e of sqlite.prepare('SELECT * FROM deletions').all())appendDeletion(ledgerPath,e)}applyDeletions(sqlite,readLedger(ledgerPath));
 return {sqlite,ledgerPath,one:async(sql,p=[])=>sqlite.prepare(sql).get(...p),all:async(sql,p=[])=>sqlite.prepare(sql).all(...p),run:async(sql,p=[])=>sqlite.prepare(sql).run(...p),batch:async a=>{sqlite.exec('BEGIN IMMEDIATE');try{for(const x of a)sqlite.prepare(x.sql).run(...x.params);sqlite.exec('COMMIT')}catch(e){sqlite.exec('ROLLBACK');throw e}},deleteRecord:async(kind,id,created)=>{const e={id,kind,created};appendDeletion(ledgerPath,e);applyDeletions(sqlite,[e])}};
 }catch(e){sqlite.close();throw e}
}
