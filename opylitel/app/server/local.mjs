import http from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {api} from './core.mjs';
import {appRoot,leaseDB,openDB} from './storage.mjs';
import {readConfig} from './config.mjs';
export {openDB};export const root=appRoot;
const CSP="default-src 'self'; img-src 'self' data: https://tile.openstreetmap.org; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
function send(res,status,body,extra={}){res.writeHead(status,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':CSP,...extra});res.end(body)}
export async function start({port=8787,dbPath=resolve(root,'../../../../opy-private/demo.sqlite'),ledgerPath,limit=180,publicOrigin=null,releaseId='opy-r3-dev'}={}){
 const release=leaseDB(dbPath);let db;try{db=openDB(dbPath,{ledgerPath:ledgerPath||dbPath+'.deletions.jsonl'})}catch(e){release();throw e}
 const server=http.createServer(async(req,res)=>{try{
  if(publicOrigin&&req.headers.host!==new URL(publicOrigin).host){send(res,421,'Unrecognised host');return}
  const incoming=new URL(req.url,'http://local.invalid'),path=incoming.pathname.replace(/^\/opylitel\/app(?=\/|$)/,'')||'/';
  if(path.startsWith('/api/')){
   let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>32768){send(res,413,'Request too large');return}chunks.push(c)}
   // Explicit origin is the only authority in hosted mode. Forwarded headers are ignored.
   const origin=publicOrigin||`http://${req.headers.host}`;
   const request=new Request(`${origin}${path}${incoming.search}`,{method:req.method,headers:{...req.headers},body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
   const r=await api(request,db,{mode:'synthetic',limit,clientKey:req.socket.remoteAddress,releaseId});send(res,r.status,Buffer.from(await r.arrayBuffer()),Object.fromEntries(r.headers));return;
  }
  const relative=path==='/'?'index.html':decodeURIComponent(path.slice(1));
  const allowed=relative==='index.html'||relative==='privacy.html'||relative==='consent.html'||/^(assets|config)\/[a-zA-Z0-9_./-]+\.(css|js|mjs|svg|webp)$/.test(relative);
  const f=relative==='privacy.html'||relative==='consent.html'?resolve(root,'..',relative):resolve(root,relative);
  if(!allowed||relative.split('/').includes('..')||!existsSync(f)){send(res,404,'Not found');return}
  const type=({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml','.webp':'image/webp'})[extname(f)];send(res,200,readFileSync(f),{'Content-Type':type});
 }catch{send(res,500,'Server error')}});
 server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
 server.on('close',release);
 try{await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',ok)})}catch(e){db.sqlite.close();release();throw e}
 return {server,db,port:server.address().port};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const c=process.env.OPY_CONFIG?readConfig(process.env.OPY_CONFIG):null;
 start(c?{port:c.port,dbPath:c.dbPath,ledgerPath:c.ledgerPath,limit:c.rateLimit,publicOrigin:c.publicOrigin,releaseId:c.releaseId}:{port:Number(process.env.PORT||8787),dbPath:process.env.OPY_TEST_DB})
 .then(({port,server,db})=>{console.log(`Synthetic-only server listening on 127.0.0.1:${port}`);for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close(()=>{db.sqlite.close();process.exit(0)}))})
 .catch(()=>{console.error('Startup blocked: check configuration, private storage, migrations and lease.');process.exitCode=1});
}
