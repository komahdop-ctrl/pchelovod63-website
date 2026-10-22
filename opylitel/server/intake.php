<?php
declare(strict_types=1);
/**
 * Opylytel 2027 intake. Deploy on a Russian-based HTTPS/PHP 8.1+ server.
 * Do not turn on before legal/privacy requirements and production security review.
 * Database file MUST be outside document root. No read/list endpoint is exposed.
 */
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
function fail(int $code, string $error): never { http_response_code($code);echo json_encode(['ok'=>false,'error'=>$error]);exit; }
$origins = array_filter(array_map('trim',explode(',',getenv('OPYLITEL_ALLOWED_ORIGINS') ?: 'https://pchelovod63.ru,https://www.pchelovod63.ru')));
$origin=$_SERVER['HTTP_ORIGIN'] ?? '';
if (!$origin || !in_array($origin,$origins,true)) fail(403,'forbidden_origin');
header('Access-Control-Allow-Origin: '.$origin); header('Vary: Origin');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD']==='OPTIONS') {http_response_code(204);exit;}
if ($_SERVER['REQUEST_METHOD']!=='POST') fail(405,'method');
if (getenv('OPYLITEL_ACCEPTING')!=='1') fail(503,'intake_closed');
if (stripos($_SERVER['CONTENT_TYPE']??'','application/json')!==0) fail(415,'json_required');
if ((int)($_SERVER['CONTENT_LENGTH']??0)>8192) fail(413,'too_large');
$raw=file_get_contents('php://input',false,null,0,8193);
if($raw===false||strlen($raw)>8192) fail(413,'too_large');
$d=json_decode($raw,true);
if(!is_array($d)||!empty($d['website']))fail(422,'invalid_payload');
function getstr(array $d,string $key,int $max,bool $required=false): string{
 $v=$d[$key]??'';if(!is_string($v))fail(422,'invalid_'.$key);
 $v=trim($v);if(($required&&$v==='')||mb_strlen($v,'UTF-8')>$max)fail(422,'invalid_'.$key);
 return $v;
}
$name=getstr($d,'fullName',100,true);
$phone=getstr($d,'phone',25,true);
if(!preg_match('~^[+]?[0-9 ()-]{10,25}$~D',$phone))fail(422,'phone');
$telegram=getstr($d,'telegram',90);
$region=getstr($d,'region',100,true);
$locality=getstr($d,'locality',120,true);
$crops=getstr($d,'crops',180);$comments=getstr($d,'comments',800);
$n=filter_var($d['availableFamilies']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>10000]]);
$t=($d['totalFamilies']??null)===null?null:filter_var($d['totalFamilies'],FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>10000]]);
if(!is_int($n)||($t!==null&&!is_int($t))||($t!==null&&$t<$n))fail(422,'families');
$distance=$d['maxDistance']??null;
if(!in_array($distance,['50','100','200','300','500','negotiable'],true))fail(422,'distance');
$months=$d['months']??null;
if(!is_array($months)||count($months)<1||count($months)>7||count(array_unique($months))!==count($months))fail(422,'months');
foreach($months as $v)if(!is_string($v)||!in_array($v,['04','05','06','07','08','09','10'],true))fail(422,'months');
if(($d['consent']??null)!==true||($d['season']??null)!==2027||($d['schemaVersion']??null)!==1)fail(422,'consent_or_version');
$path=getenv('OPYLITEL_DB_PATH')?:'';$salt=getenv('OPYLITEL_HASH_SALT')?:'';
$consentVersion=getenv('OPYLITEL_CONSENT_VERSION')?:'';
if(!$salt||strlen($salt)<32||!str_starts_with($path,'/')||!$consentVersion)fail(503,'not_configured');
$privateDir=realpath(dirname($path));$docRoot=realpath($_SERVER['DOCUMENT_ROOT']??'');
if(!$privateDir||!$docRoot||($privateDir===$docRoot||str_starts_with($privateDir,$docRoot.DIRECTORY_SEPARATOR)))fail(503,'unsafe_storage_path');
if(!in_array('sqlite',PDO::getAvailableDrivers(),true))fail(503,'sqlite_unavailable');
if(($d['consentVersion']??null)!==$consentVersion)fail(422,'consent_version');
umask(0077);
try{
 $db=new PDO('sqlite:'.$path,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_TIMEOUT=>5]);
 $db->exec('PRAGMA busy_timeout=5000');
 $db->exec('CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY AUTOINCREMENT, request_code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, telegram TEXT, region TEXT NOT NULL, locality TEXT NOT NULL, available_families INTEGER NOT NULL, total_families INTEGER, max_distance TEXT NOT NULL, months_json TEXT NOT NULL, crops TEXT, comments TEXT, consent_version TEXT NOT NULL, ip_hash TEXT NOT NULL)');
 $db->exec('CREATE INDEX IF NOT EXISTS idx_r_region ON requests(region)');
 $db->exec('CREATE INDEX IF NOT EXISTS idx_r_ip ON requests(ip_hash,created_at)');
 $iphash=hash_hmac('sha256',($_SERVER['REMOTE_ADDR']??'unknown'),$salt);
 $check=$db->prepare('SELECT COUNT(*) FROM requests WHERE ip_hash=:ip AND created_at>=:since');
 $check->execute([':ip'=>$iphash,':since'=>gmdate('c',time()-3600)]);
 if((int)$check->fetchColumn()>=4)fail(429,'rate_limit');
 $code='B27-'.strtoupper(bin2hex(random_bytes(5)));
 $ins=$db->prepare('INSERT INTO requests(request_code,created_at,name,phone,telegram,region,locality,available_families,total_families,max_distance,months_json,crops,comments,consent_version,ip_hash) VALUES(:code,:time,:name,:phone,:tg,:region,:locality,:n,:t,:distance,:months,:crops,:comments,:consent,:ip)');
 $ins->execute([':code'=>$code,':time'=>gmdate('c'),':name'=>$name,':phone'=>$phone,':tg'=>$telegram,':region'=>$region,':locality'=>$locality,':n'=>$n,':t'=>$t,':distance'=>$distance,':months'=>json_encode($months),':crops'=>$crops,':comments'=>$comments,':consent'=>$consentVersion,':ip'=>$iphash]);
 http_response_code(201);echo json_encode(['ok'=>true,'requestId'=>$code]);exit;
}catch(Throwable $e){error_log('opylitel_db: '.$e->getMessage());fail(503,'storage_error');}
