import {DatabaseSync} from 'node:sqlite';
import {readFileSync,existsSync,realpathSync,statSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readConfig} from './config.mjs';
import {appRoot,privateFile} from './storage.mjs';
export function preflight(file){const result={status:'blocked',checks:[],externalVerification:['Russian location, processor contracts and operator NOT_VERIFIED','TLS certificate and gateway owner/anonymous checks NOT_VERIFIED','nginx/systemd host installation NOT_RUN','Real intake remains forbidden']};function check(name,ok){result.checks.push({name,ok});if(!ok)throw Error(name)}
 try{check('Node24.x',Number(process.versions.node.split('.')[0])===24);const c=readConfig(file);check('strict synthetic configuration',true);check('Node bound to loopback',c.listenHost==='127.0.0.1');const db=new DatabaseSync(':memory:');try{db.exec('CREATE TABLE t(x INTEGER)');check('SQLite RETURNING',db.prepare('INSERT INTO t VALUES (1) RETURNING x').get().x===1);check('SQLite integrity_check',Object.values(db.prepare('PRAGMA integrity_check').get())[0]==='ok')}finally{db.close()}
 for(const [name,path] of [['database',c.dbPath],['independent ledger',c.ledgerPath]]){privateFile(path);const dir=realpathSync(dirname(path));check(name+' outside application root',dir!==appRoot&&!dir.startsWith(appRoot+'/'));check(name+' directory not accessible by other users',(statSync(dir).mode&0o077)===0)}
 check('migration files present',existsSync(new URL('./migrations/0001_initial.sql',import.meta.url)));result.status='local-ready';
 }catch(e){result.checks.push({name:'configuration/storage/runtime rejected',ok:false});result.status='blocked'}return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const r=preflight(process.argv[2]);console.log(JSON.stringify(r,null,2));if(r.status!=='local-ready')process.exitCode=1}
