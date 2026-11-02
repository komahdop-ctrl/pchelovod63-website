import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('./migrations/',import.meta.url));
export function migrate(db){
 db.exec('CREATE TABLE IF NOT EXISTS _opy_migrations (id TEXT PRIMARY KEY, sha256 TEXT NOT NULL)');
 const files=readdirSync(dir).filter(x=>/^\d{4}_[a-z_]+\.sql$/.test(x)).sort();
 for(const row of db.prepare('SELECT id FROM _opy_migrations').all())if(!files.includes(row.id))throw Error('Database is newer than this server. Refusing startup.');
 for(const id of files){const sql=readFileSync(dir+'/'+id,'utf8'),sha=createHash('sha256').update(sql).digest('hex'),old=db.prepare('SELECT sha256 FROM _opy_migrations WHERE id=?').get(id);if(old){if(old.sha256!==sha)throw Error('Migration checksum mismatch: '+id);continue}
  db.exec('BEGIN IMMEDIATE');try{db.exec(sql);db.prepare('INSERT INTO _opy_migrations VALUES (?,?)').run(id,sha);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}
 }
 return files;
}
