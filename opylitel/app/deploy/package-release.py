#!/usr/bin/env python3
"""Deterministic synthetic server release. No DBs, secrets, git or dependencies."""
from pathlib import Path
import hashlib, io, json, gzip, tarfile, argparse
app=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('output');p.add_argument('--version',default='opy-ru-synthetic-r3');args=p.parse_args()
files={}
for f in sorted(app.rglob('*')):
 if f.is_symlink():raise SystemExit('Symlink in source tree: '+str(f))
 if not f.is_file():continue
 rel=f.relative_to(app)
 if any(x in ['node_modules','__pycache__','.openai','.git'] for x in rel.parts) or str(rel).startswith('docs/evidence/'):continue
 if f.suffix.lower() in ['.sqlite','.sqlite3','.db','.log','.zip','.gz'] or f.name.startswith('.env'):raise SystemExit('Runtime/private file in release source: '+str(rel))
 files['app/'+str(rel)]=f.read_bytes()
for name in ['privacy.html','consent.html']:files[name]=(app.parent/name).read_bytes()
manifest={'version':args.version,'mode':'synthetic-only','runtime':'Node.js 24.x + SQLite native, Linux','files':{k:hashlib.sha256(v).hexdigest() for k,v in sorted(files.items())}}
files['manifest.json']=(json.dumps(manifest,ensure_ascii=False,sort_keys=True,indent=2)+'\n').encode()
out=Path(args.output).resolve();out.parent.mkdir(parents=True,exist_ok=True)
with out.open('wb') as raw:
 with gzip.GzipFile(filename='',fileobj=raw,mode='wb',mtime=0) as gz:
  with tarfile.open(fileobj=gz,mode='w',format=tarfile.PAX_FORMAT) as tar:
   for name,data in sorted(files.items()):
    info=tarfile.TarInfo(name);info.size=len(data);info.mtime=0;info.uid=info.gid=0;info.uname=info.gname='';info.mode=0o644
    tar.addfile(info,io.BytesIO(data))
print(json.dumps({'archive':str(out),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'files':len(files),'version':args.version}))
