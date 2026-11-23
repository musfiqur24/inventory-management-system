// Production-shaped smoke test with disposable containers and fake credentials.
const {spawnSync}=require('node:child_process'),path=require('node:path'),https=require('node:https'),assert=require('node:assert/strict');
const network='inventory-smoke-'+Date.now(),names=[];
const image={backend:process.env.SMOKE_BACKEND_IMAGE||'inventory-audit-backend:check',frontend:process.env.SMOKE_FRONTEND_IMAGE||'inventory-audit-frontend:check',migration:process.env.SMOKE_MIGRATION_IMAGE||'inventory-audit-migration:check'};
function run(args){const r=spawnSync('docker',args,{encoding:'utf8',timeout:120000});if(r.status!==0)throw Error(r.stderr||r.stdout);return r.stdout.trim();}
const pause=()=>new Promise(r=>setTimeout(r,300));
async function retry(task){let error;for(let i=0;i<100;i++){try{return await task();}catch(cause){error=cause;await pause();}}throw error;}
function start(alias,args){const name=network+'-'+alias;names.push(name);run(['run','-d','--rm','--name',name,'--network',network,'--network-alias',alias,...args]);return name;}
function request(port,ca,url,method='GET',body,headers={}){return new Promise((resolve,reject)=>{const req=https.request({hostname:'127.0.0.1',port,path:url,ca,method,agent:false,headers:{Host:'127.0.0.1',Origin:'https://127.0.0.1','Content-Type':'application/json',...headers}},res=>{let text='';res.on('data',b=>text+=b);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.setTimeout(10000,()=>req.destroy(Error('Request timeout')));req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});}
(async()=>{try{
 run(['network','create',network]);
 const db=start('db',['-e','POSTGRES_USER=inventory','-e','POSTGRES_PASSWORD=smoke-db-only','-e','POSTGRES_DB=inventory',process.env.SMOKE_DB_IMAGE||'inventory-audit-db:check']);
 await retry(()=>run(['exec',db,'pg_isready','-h','127.0.0.1','-U','inventory']));
 run(['run','--rm','--network',network,'-e','DATABASE_URL=postgresql://inventory:smoke-db-only@db:5432/inventory','-e','APP_DB_PASSWORD=smoke-app-only',image.migration]);
 const api=start('backend',['--read-only','--tmpfs','/tmp','--cap-drop','ALL','--security-opt','no-new-privileges:true','-e','NODE_ENV=production','-e','DATABASE_URL=postgresql://inventory_app:smoke-app-only@db:5432/inventory','-e','JWT_SECRET=smoke-jwt-key-at-least-32-characters-long','-e','MFA_ENCRYPTION_KEY=smoke-mfa-key-at-least-32-characters','-e','WEB_ORIGIN=https://127.0.0.1','-e','INITIAL_SUPER_ADMIN_EMAIL=smoke@example.com','-e','INITIAL_SUPER_ADMIN_PASSWORD=SmokeAdminPassword123','-e','PORT=4000',image.backend]);
 assert.equal(run(['exec',api,'id','-u']),'1000');
 const immutable=spawnSync('docker',['exec',api,'touch','/app/should-not-write'],{encoding:'utf8'});assert.notEqual(immutable.status,0);
 await retry(()=>run(['exec',api,'node','-e',"fetch('http://127.0.0.1:4000/api/v1/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]));
 const frontend=start('frontend',[image.frontend]);
 const caddy=start('caddy',['-e','SERVER_IP=127.0.0.1','-p','127.0.0.1::443','--mount','type=bind,source='+path.resolve(__dirname,'../../deploy/Caddyfile')+',target=/etc/caddy/Caddyfile,readonly',process.env.SMOKE_CADDY_IMAGE||'inventory-audit-caddy:check']);
 const info=JSON.parse(run(['inspect','--format','{{json .NetworkSettings.Ports}}',caddy]));const port=Number(info['443/tcp'][0].HostPort);
 const ca=await retry(()=>run(['exec',caddy,'cat','/data/caddy/pki/authorities/local/root.crt']));
 const home=await retry(()=>request(port,ca,'/'));assert.equal(home.status,200);assert.ok(home.headers['content-security-policy'].includes("script-src 'self'"));
 const resetPage=await request(port,ca,'/reset-password?token=smoke-query-token-never-log');assert.equal(resetPage.status,200);assert.ok(!run(['logs',frontend]).includes('smoke-query-token-never-log'));
 const ready=await request(port,ca,'/api/v1/ready');assert.equal(ready.status,200);
 const login=await request(port,ca,'/api/v1/auth/login','POST',{email:'smoke@example.com',password:'SmokeAdminPassword123'});assert.equal(login.status,200,login.text);const auth=JSON.parse(login.text).data;assert.equal(auth.refreshToken,undefined);assert.match(login.headers['set-cookie'][0],/Secure/);assert.match(login.headers['set-cookie'][0],/HttpOnly/);
 const org=auth.user.organizations[0].id;
 const blocked=await request(port,ca,'/api/v1/organizations','POST',{code:'NEW',name:'New organization'},{Authorization:'Bearer '+auth.accessToken,'x-organization-id':org});assert.equal(blocked.status,403);assert.equal(JSON.parse(blocked.text).error.code,'MFA_SETUP_REQUIRED');
 const cookie=login.headers['set-cookie'][0].split(';')[0];await request(port,ca,'/api/v1/auth/refresh','POST',{}, {Cookie:cookie});
 const logs=run(['logs',api]);assert.ok(!logs.includes(cookie));assert.ok(!logs.includes(auth.accessToken));
 console.log('PASS: production migrations, non-root/read-only runtime, HTTPS, frontend CSP, secure cookies, mandatory admin MFA, and credential log redaction');
}finally{for(const name of names.reverse())spawnSync('docker',['rm','-f',name],{stdio:'ignore'});spawnSync('docker',['network','rm',network],{stdio:'ignore'});}})().catch(error=>{console.error(error);process.exitCode=1;});
