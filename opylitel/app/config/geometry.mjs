// RFC 7946 lon/lat. Pilot deliberately accepts a single simple exterior ring;
// disjoint parcels are separate permanent field IDs. Holes/MultiPolygon fail closed.
export class Invalid extends Error {constructor(message,status=422){super(message);this.status=status}}
const rad=x=>x*Math.PI/180, R=6371008.8;
export function hectares(g){let sum=0;const a=g.coordinates[0];for(let i=0;i<a.length-1;i++)sum+=rad(a[i+1][0]-a[i][0])*(2+Math.sin(rad(a[i][1]))+Math.sin(rad(a[i+1][1])));return Math.abs(sum)*R*R/2/10000}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on=(a,b,c)=>Math.abs(cross(a,b,c))<1e-12&&c[0]>=Math.min(a[0],b[0])-1e-12&&c[0]<=Math.max(a[0],b[0])+1e-12&&c[1]>=Math.min(a[1],b[1])-1e-12&&c[1]<=Math.max(a[1],b[1])+1e-12;
function intersects(a,b,c,d){let p=cross(a,b,c),q=cross(a,b,d),r=cross(c,d,a),s=cross(c,d,b);return (p*q<0&&r*s<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)}
export function validateGeometry(g){
 if(!g||g.type!=='Polygon'||!Array.isArray(g.coordinates)||g.coordinates.length!==1)throw new Invalid('Нужен Polygon с одним внешним контуром. Отдельные участки сохраняйте как отдельные поля.');
 const a=g.coordinates[0];if(!Array.isArray(a)||a.length<4||a.length>201)throw new Invalid('Контур: от 3 до 200 вершин и повтор первой точки.');
 for(const p of a)if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<-180||p[0]>180||p[1]<-85||p[1]>85)throw new Invalid('Координаты longitude/latitude вне допустимого диапазона.');
 if(a[0][0]!==a.at(-1)[0]||a[0][1]!==a.at(-1)[1])throw new Invalid('Контур не замкнут.');
 if(new Set(a.slice(0,-1).map(p=>p.join(','))).size!==a.length-1)throw new Invalid('Вершины повторяются.');
 if(Math.max(...a.map(p=>p[0]))-Math.min(...a.map(p=>p[0]))>5||Math.max(...a.map(p=>p[1]))-Math.min(...a.map(p=>p[1]))>5)throw new Invalid('Слишком большой контур или пересечение линии смены даты. Разделите поле.');
 for(let i=0;i<a.length-1;i++)for(let j=i+1;j<a.length-1;j++){if(j===i+1||(i===0&&j===a.length-2))continue;if(intersects(a[i],a[i+1],a[j],a[j+1]))throw new Invalid('Самопересечение или касание сторон контура.');}
 const ha=hectares(g);if(ha<.01||ha>100000)throw new Invalid('Площадь должна быть от 0,01 до 100 000 га.');
 return {geometry:{type:'Polygon',coordinates:[a.map(p=>[...p])]},area_ha:Math.round(ha*10000)/10000};
}
export function bboxIntersects(g,b){const a=g.coordinates[0],xs=a.map(p=>p[0]),ys=a.map(p=>p[1]);return Math.min(...xs)<=b[2]&&Math.max(...xs)>=b[0]&&Math.min(...ys)<=b[3]&&Math.max(...ys)>=b[1]}
export function km(a,b){const dl=rad(b[0]-a[0]),dp=rad(b[1]-a[1]);return 2*R*Math.asin(Math.sqrt(Math.sin(dp/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dl/2)**2))/1000}
