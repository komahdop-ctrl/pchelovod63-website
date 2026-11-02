#!/usr/bin/env python3
"""Local release staging/symlink switch. Never touches DNS, nginx, systemd or real intake."""
from pathlib import Path, PurePosixPath
import argparse, hashlib, json, os, re, shutil, subprocess, tarfile, tempfile, uuid

def verify_tree(root):
 manifest=json.loads((root/'manifest.json').read_text())
 if manifest.get('mode')!='synthetic-only' or not re.fullmatch(r'[a-z0-9._-]{1,80}',manifest.get('version','')):raise ValueError('Invalid release manifest')
 files=manifest.get('files',{})
 actual={str(p.relative_to(root)) for p in root.rglob('*') if p.is_file()}
 if actual!=set(files)|{'manifest.json'}:raise ValueError('Unexpected/missing release files')
 for name,digest in files.items():
  path=root/name
  if path.is_symlink() or path.resolve().is_relative_to(root.resolve()) is False:raise ValueError('Unsafe file')
  if hashlib.sha256(path.read_bytes()).hexdigest()!=digest:raise ValueError('Release checksum mismatch: '+name)
 return manifest

def stage(archive,releases,expected):
 if hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:raise ValueError('Archive checksum mismatch')
 releases.mkdir(parents=True,exist_ok=True);temporary=Path(tempfile.mkdtemp(prefix='.staging-',dir=releases))
 try:
  with tarfile.open(archive) as tar:
   members=tar.getmembers();names=[m.name for m in members]
   if len(names)>200 or len(set(names))!=len(names) or sum(m.size for m in members)>8_000_000:raise ValueError('Archive limits/duplicate path')
   for m in members:
    n=PurePosixPath(m.name)
    if not m.isfile() or n.is_absolute() or '..' in n.parts or '\\' in m.name:raise ValueError('Unsafe archive member')
   tar.extractall(temporary,filter='data')
  manifest=verify_tree(temporary);target=releases/manifest['version']
  if target.exists():raise ValueError('Release exists; never overwrite a version')
  temporary.rename(target);return {'staged':str(target),'version':manifest['version']}
 finally:
  if temporary.exists():shutil.rmtree(temporary)

def switch(current,target,config,backups,stopped):
 if not stopped:raise ValueError('Stop the service and explicitly confirm --server-stopped')
 target=target.resolve();manifest=verify_tree(target);c=json.loads(config.read_text());db=Path(c['dbPath']);ledger=Path(c['ledgerPath'])
 if c.get('mode')!='synthetic' or c.get('deployment')!='ru-synthetic':raise ValueError('Not a synthetic config')
 if Path(str(db)+'.lock').exists():raise ValueError('Active/stale DB lease: switch blocked')
 subprocess.run(['node',str(target/'app/server/preflight.mjs'),str(config)],check=True,capture_output=True)
 # Read-only schema compatibility check, no migration or data alteration on switching.
 check="""const {DatabaseSync}=require('node:sqlite'),fs=require('node:fs'),crypto=require('node:crypto');const d=new DatabaseSync(process.argv[1],{readOnly:true});try{if(d.prepare(\"SELECT name FROM sqlite_master WHERE name='_opy_migrations'\").get()){for(const r of d.prepare('SELECT * FROM _opy_migrations').all()){const f=process.argv[2]+'/'+r.id;if(!fs.existsSync(f)||crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')!==r.sha256)throw Error('Target release is incompatible with database migrations')}}}finally{d.close()}"""
 backup_path=None
 if db.exists():
  subprocess.run(['node','-e',check,str(db),str(target/'app/server/migrations')],check=True,capture_output=True)
  backups.mkdir(parents=True,exist_ok=True,mode=0o700);backup_path=backups/(manifest['version']+'-'+uuid.uuid4().hex+'.sqlite')
  subprocess.run(['node',str(target/'app/server/maintenance.mjs'),'backup',str(db),str(backup_path),str(ledger)],check=True,capture_output=True)
 if current.exists() and not current.is_symlink():raise ValueError('current must be a symlink, never an ordinary directory')
 current.parent.mkdir(parents=True,exist_ok=True);old=os.readlink(current) if current.is_symlink() else None
 temp=current.with_name('.current-'+uuid.uuid4().hex);temp.symlink_to(target,target_is_directory=True)
 try:os.replace(temp,current)
 finally:
  if temp.is_symlink():temp.unlink()
 return {'selected':str(target),'previous':old,'backup':str(backup_path) if backup_path else None,'serviceStarted':False,'realIntake':False}

if __name__=='__main__':
 p=argparse.ArgumentParser();sub=p.add_subparsers(dest='cmd',required=True)
 a=sub.add_parser('stage');a.add_argument('archive',type=Path);a.add_argument('releases',type=Path);a.add_argument('--sha256',required=True)
 for cmd in ['activate','rollback']:
  a=sub.add_parser(cmd);a.add_argument('current',type=Path);a.add_argument('target',type=Path);a.add_argument('config',type=Path);a.add_argument('backups',type=Path);a.add_argument('--server-stopped',action='store_true')
 args=p.parse_args()
 try:r=stage(args.archive,args.releases,args.sha256) if args.cmd=='stage' else switch(args.current,args.target,args.config,args.backups,args.server_stopped);print(json.dumps(r))
 except Exception as e:p.exit(1,'Release operation blocked: '+str(e)+'\n')
