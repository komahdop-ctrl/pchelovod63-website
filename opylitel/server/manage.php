<?php
declare(strict_types=1);
// Private CLI utility only: NEVER expose via the web.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
function usage(): never {fwrite(STDERR,"php manage.php init | stats | public-stats | export /private/out.csv | delete B27-...\n");exit(2);}
$path=getenv('OPYLITEL_DB_PATH')?:'';
if(!str_starts_with($path,'/')||is_dir($path)||!is_dir(dirname($path))){fwrite(STDERR,"Set OPYLITEL_DB_PATH to a private absolute path.\n");exit(2);}
if(!in_array('sqlite',PDO::getAvailableDrivers(),true)){fwrite(STDERR,"PDO SQLite is unavailable on this PHP installation.\n");exit(1);}
try{$db=new PDO('sqlite:'.$path,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$db->exec('PRAGMA busy_timeout=5000');}
catch(Throwable $e){fwrite(STDERR,"Cannot open database.\n");exit(1);}
$cmd=$argv[1]??'';
if($cmd==='init'){
$db->exec('CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY AUTOINCREMENT,request_code TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,telegram TEXT,region TEXT NOT NULL,locality TEXT NOT NULL,available_families INTEGER NOT NULL,total_families INTEGER,max_distance TEXT NOT NULL,months_json TEXT NOT NULL,crops TEXT,comments TEXT,consent_version TEXT NOT NULL,ip_hash TEXT NOT NULL)');
$columns=[
 'long_trip'=>"TEXT NOT NULL DEFAULT 'maybe'",
 'price_mode'=>"TEXT NOT NULL DEFAULT 'discuss'",
 'desired_price_rub'=>'INTEGER',
 'min_acceptable_rub'=>'INTEGER',
 'far_price_rub'=>'INTEGER',
 'transport_payment'=>"TEXT NOT NULL DEFAULT 'discuss'",
 'extra_transport_rub'=>'INTEGER',
 'advance_percent'=>"TEXT NOT NULL DEFAULT 'discuss'",
 'payment_channel'=>"TEXT NOT NULL DEFAULT 'discuss'",
 'final_payment'=>"TEXT NOT NULL DEFAULT 'discuss'",
 'min_lot'=>'INTEGER',
 'consent_sha256'=>"TEXT NOT NULL DEFAULT ''",
 'consent_recorded_at'=>"TEXT NOT NULL DEFAULT ''"
];
$present=array_column($db->query('PRAGMA table_info(requests)')->fetchAll(PDO::FETCH_ASSOC),'name');
foreach($columns as $col=>$ddl){if(!in_array($col,$present,true))$db->exec('ALTER TABLE requests ADD COLUMN '.$col.' '.$ddl);}
$db->exec('CREATE INDEX IF NOT EXISTS idx_r_region ON requests(region)');
$db->exec('CREATE INDEX IF NOT EXISTS idx_r_ip ON requests(ip_hash,created_at)');
echo "Schema ready. Keep the SQLite file OUTSIDE public_html.\n";exit;
}
if($cmd==='stats'||$cmd==='public-stats'){
$s=$db->query('SELECT COUNT(*) AS requests,COALESCE(SUM(available_families),0) AS families,COUNT(DISTINCT region) AS regions FROM requests')->fetch(PDO::FETCH_ASSOC);
$by=$db->query('SELECT region,COUNT(*) AS requests,SUM(available_families) AS families FROM requests GROUP BY region ORDER BY families DESC')->fetchAll(PDO::FETCH_ASSOC);
if($cmd==='public-stats'){
// Suppress small groups to avoid identifying participants. These are NOT confirmed contracts.
$eligible=(int)$s['requests']>=5;
$by=array_values(array_filter($by,fn(array $r):bool=>(int)$r['requests']>=5));
$out=['status'=>$eligible?'preliminary':'insufficient_data','season'=>2027,'applications'=>$eligible?(int)$s['requests']:null,'families_offered'=>$eligible?(int)$s['families']:null,'regions_count'=>$eligible?(int)$s['regions']:null,'regions'=>$eligible?array_map(fn(array $r):array=>['region'=>$r['region'],'applications'=>(int)$r['requests'],'families_offered'=>(int)$r['families']],$by):[],'note'=>'Предварительные предложения, не подтверждённые договоры'];
}else{$out=['applications'=>(int)$s['requests'],'families_offered'=>(int)$s['families'],'regions_count'=>(int)$s['regions'],'regions'=>$by];}
echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)."\n";exit;
}
if($cmd==='export'){
$dest=$argv[2]??'';
if(!str_starts_with($dest,'/')||!is_dir(dirname($dest))||is_link($dest)||file_exists($dest)){fwrite(STDERR,"Specify a NEW absolute CSV file in a private directory.\n");exit(2);}
$fp=fopen($dest,'x');if(!$fp)exit(1);chmod($dest,0600);fwrite($fp,"\xEF\xBB\xBF");
$columns=['request_code','created_at','name','phone','region','locality','available_families','total_families','max_distance','months_json','crops','comments','consent_version','consent_sha256','consent_recorded_at','long_trip','price_mode','desired_price_rub','min_acceptable_rub','far_price_rub','advance_percent','payment_channel','final_payment','min_lot'];
fputcsv($fp,$columns,';');
$stmt=$db->query('SELECT '.implode(',',$columns).' FROM requests ORDER BY created_at DESC');
foreach($stmt as $row){$values=[];foreach($columns as $key){$v=(string)($row[$key]??'');if(preg_match('/^[\s\x00-\x1f]*[=+@-]/u',$v))$v="'".$v;$values[]=$v;}fputcsv($fp,$values,';');}
fclose($fp);echo "Private CSV created: ".$dest."\n";exit;
}
if($cmd==='delete'){
$code=$argv[2]??'';if(!preg_match('/^B27-[0-9A-F]{10}$/D',$code))usage();
$stmt=$db->prepare('DELETE FROM requests WHERE request_code=:code');$stmt->execute([':code'=>$code]);echo "Deleted: ".$stmt->rowCount()."\n";exit;
}
usage();
