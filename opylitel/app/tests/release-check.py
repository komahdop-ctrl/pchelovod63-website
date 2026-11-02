#!/usr/bin/env python3
"""Build twice, compare byte hashes, verify manifest and run extracted Node suites."""
from pathlib import Path
import subprocess, tempfile, tarfile, json, hashlib, os
app=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='opy-release-') as temp:
 t=Path(temp);a=t/'a.tar.gz';b=t/'b.tar.gz'
 for p in [a,b]:subprocess.run(['python3',str(app/'deploy/package-release.py'),str(p)],check=True,capture_output=True)
 assert a.read_bytes()==b.read_bytes(),'Release not reproducible'
 root=t/'extracted';root.mkdir()
 with tarfile.open(a) as tar:
  assert all(m.isfile() and not m.name.startswith('/') and '..' not in Path(m.name).parts for m in tar)
  tar.extractall(root,filter='data')
 manifest=json.loads((root/'manifest.json').read_text())
 for path,sha in manifest['files'].items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==sha,path
 tests=[str(p) for p in (root/'app/tests').glob('*.test.mjs')]
 r=subprocess.run(['node','--test',*tests],cwd=root,capture_output=True,text=True);assert r.returncode==0,r.stdout+r.stderr
 cfg=json.loads((root/'app/deploy/ru-synthetic.example.json').read_text());private=t/'private';private.mkdir(mode=0o700);cfg['dbPath']=str(private/'data.sqlite');cfg['ledgerPath']=str(private/'deleted.jsonl');conf=t/'config.json';conf.write_text(json.dumps(cfg))
 pre=subprocess.run(['node',str(root/'app/server/preflight.mjs'),str(conf)],capture_output=True,text=True);assert pre.returncode==0,pre.stdout+pre.stderr
 control=str(root/'app/deploy/release-control.py'); releases=t/'releases'; current=t/'current'; backups=t/'backups'
 def command(*args):
  return json.loads(subprocess.check_output(['python3',control,*map(str,args)],text=True))
 staged=command('stage',a,releases,'--sha256',hashlib.sha256(a.read_bytes()).hexdigest());target=Path(staged['staged'])
 prev=t/'prev.tar.gz';subprocess.run(['python3',str(app/'deploy/package-release.py'),str(prev),'--version','opy-ru-synthetic-r3-prev'],check=True,capture_output=True)
 previous=command('stage',prev,releases,'--sha256',hashlib.sha256(prev.read_bytes()).hexdigest())
 # Initialize only synthetic runtime state using the extracted server.
 init="const {pathToFileURL}=await import('node:url');const {openDB}=await import(pathToFileURL(process.argv[1]));const db=openDB(process.argv[2],{ledgerPath:process.argv[3]});db.sqlite.close();"
 subprocess.run(['node','--input-type=module','-e',init,str(target/'app/server/storage.mjs'),cfg['dbPath'],cfg['ledgerPath']],check=True,capture_output=True)
 switched=command('activate',current,target,conf,backups,'--server-stopped');assert current.resolve()==target.resolve();assert Path(switched['backup']).is_file()
 rolled=command('rollback',current,previous['staged'],conf,backups,'--server-stopped');assert current.resolve()==Path(previous['staged']).resolve();assert Path(rolled['backup']).is_file()
 blocked=subprocess.run(['python3',control,'activate',str(current),str(target),str(conf),str(backups)],capture_output=True);assert blocked.returncode!=0
 print(json.dumps({'status':'PASS','archive_sha256':hashlib.sha256(a.read_bytes()).hexdigest(),'files_verified':len(manifest['files']),'two_builds_byte_identical':True,'extracted_node_suites':'PASS','stage_activate_rollback':'PASS','no_stop_confirmation_refused':True,'extracted_preflight':json.loads(pre.stdout)['status']},indent=2))
