import {readFileSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
export function readConfig(file){const c=JSON.parse(readFileSync(file,'utf8'));const keys=['mode','deployment','listenHost','port','publicOrigin','dbPath','ledgerPath','rateLimit','accessGate','releaseId'];
 if(!c||Array.isArray(c)||Object.keys(c).some(k=>!keys.includes(k)))throw Error('Unknown configuration key');
 if(c.mode!=='synthetic'||c.deployment!=='ru-synthetic')throw Error('This release cannot accept real data');
 if(c.listenHost!=='127.0.0.1'||!Number.isInteger(c.port)||c.port<1024||c.port>65535)throw Error('Loopback and a nonprivileged port are required');
 const origin=new URL(c.publicOrigin);if(origin.protocol!=='https:'||origin.origin!==c.publicOrigin||origin.username||origin.password)throw Error('Exact HTTPS publicOrigin required');
 if(c.accessGate!=='nginx-basic-tls')throw Error('Closed TLS gateway is required; verify it independently');
 if(!isAbsolute(c.dbPath)||!isAbsolute(c.ledgerPath)||resolve(c.dbPath)===resolve(c.ledgerPath))throw Error('Distinct absolute private paths required');
 if(!Number.isInteger(c.rateLimit)||c.rateLimit<10||c.rateLimit>600)throw Error('Rate limit must be 10..600');
 if(typeof c.releaseId!=='string'||!/^[a-z0-9._-]{1,80}$/.test(c.releaseId))throw Error('Invalid releaseId');return c;
}
