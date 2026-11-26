function fsReadValidation(){return require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../../deploy/validate-restored-inventory.sql'),'utf8');}
// A disposable PostgreSQL instance; never connects to the user's local/server DB.
const {spawn,spawnSync}=require('node:child_process');
const path=require('node:path');
const name='inventory-integration-'+Date.now();
function docker(args){const r=spawnSync('docker',args,{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return r.stdout.trim();}
(async()=>{try{
 docker(['run','-d','--rm','--name',name,'-e','POSTGRES_USER=inventory','-e','POSTGRES_PASSWORD=integration-only','-e','POSTGRES_DB=inventory','-p','127.0.0.1::5432','postgres:17-alpine@sha256:f9cf3e1f0066f0eb0c48707d864f0ac5941e9ff454a072077d97a4d278d07d73']);
 let ready=false;for(let i=0;i<60;i++){if(spawnSync('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','inventory','-d','inventory'],{stdio:'ignore'}).status===0){ready=true;break;}await new Promise(r=>setTimeout(r,300));}if(!ready)throw Error('Test DB did not become ready');
 const info=JSON.parse(docker(['inspect','--format','{{json .NetworkSettings.Ports}}',name]));const port=info['5432/tcp'][0].HostPort;
 const env={...process.env,DATABASE_URL:`postgresql://inventory:integration-only@127.0.0.1:${port}/inventory`,NODE_ENV:'test',JWT_SECRET:'integration-test-only-secret-with-at-least-32-characters',WEB_ORIGIN:'http://localhost:5173',SESSION_COOKIE_SECURE:'false',LOG_LEVEL:'error',INITIAL_SUPER_ADMIN_EMAIL:'admin@example.com',INITIAL_SUPER_ADMIN_PASSWORD:'IntegrationPassword123',APP_DB_PASSWORD:'integration-app-only'};
 env.MIGRATION_DATABASE_URL=env.DATABASE_URL;
 const pg=require(path.resolve(__dirname,'../../backend/node_modules/pg'));
 const baseline=require('node:fs').readFileSync(path.resolve(__dirname,'../../backend/prisma/migrations/202611230001_baseline/migration.sql'),'utf8');
 await require('./role-upgrade.cjs')(pg,env.DATABASE_URL);
 const connection=new pg.Client({connectionString:env.DATABASE_URL});await connection.connect();
 try{
   for(const database of ['legacy_upgrade','legacy_drift','legacy_history','legacy_failed_baseline']){
     await connection.query('CREATE DATABASE '+database);
     const url=new URL(env.DATABASE_URL);url.pathname='/'+database;
     const legacy=new pg.Client({connectionString:url.toString()});await legacy.connect();
     try{await legacy.query(baseline);await legacy.query(`INSERT INTO "Organization" (id,code,name,"updatedAt") VALUES ('legacy-kept','LEGACY','Preserve me',now())`);if(database==='legacy_drift')await legacy.query('ALTER TABLE "User" ADD COLUMN unexpected text');}finally{await legacy.end();}
     if(['legacy_history','legacy_failed_baseline'].includes(database)){
       const args=['node_modules/prisma/build/index.js','migrate'];
       const seeded=spawnSync(process.execPath,[...args,'resolve','--applied','202611230001_baseline'],{cwd:path.resolve(__dirname,'../../backend'),env:{...env,DATABASE_URL:url.toString(),MIGRATION_DATABASE_URL:url.toString()},encoding:'utf8'});
       if(seeded.status!==0)throw Error(seeded.stderr||seeded.stdout);
       const history=new pg.Client({connectionString:url.toString()});await history.connect();
       try{await history.query(`UPDATE "_prisma_migrations" SET migration_name='20260906090000_baseline_auth_rbac' WHERE migration_name='202611230001_baseline'`);}finally{await history.end();}
       if(database==='legacy_failed_baseline'){
         const failed=spawnSync(process.execPath,[...args,'deploy'],{cwd:path.resolve(__dirname,'../../backend'),env:{...env,DATABASE_URL:url.toString(),MIGRATION_DATABASE_URL:url.toString()},encoding:'utf8'});
         if(failed.status===0||!(failed.stderr+failed.stdout).includes('StoreType'))throw Error('Failed-baseline fixture did not reproduce the enum collision');
       }
     }
     const migrated=spawnSync(process.execPath,['scripts/migrate.mjs'],{cwd:path.resolve(__dirname,'../../backend'),env:{...env,DATABASE_URL:url.toString(),MIGRATION_DATABASE_URL:url.toString()},encoding:'utf8'});
     if(database!=='legacy_drift'&&migrated.status!==0)throw Error(migrated.stderr||migrated.stdout);
     if(database==='legacy_drift'&&migrated.status===0)throw Error('Schema drift was not rejected');
     const verify=new pg.Client({connectionString:url.toString()});await verify.connect();try{const result=await verify.query(`SELECT name FROM "Organization" WHERE id='legacy-kept'`);if(result.rows[0]?.name!=='Preserve me')throw Error('Migration changed legacy data');}finally{await verify.end();}
   }
   console.log('PASS: existing-db baseline adoption preserves data; unexpected drift stops migration');
 }finally{await connection.end();}
 for(const args of [['scripts/migrate.mjs'],['node_modules/tsx/dist/cli.mjs','--test','tests/integration/security-stock.test.ts']]){
   const code=await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:path.resolve(__dirname,'../../backend'),env,stdio:'inherit'});child.on('exit',resolve);});if(code!==0)throw Error('Integration command failed: '+args[0]);
 }
 // A dump must restore into a second, empty database and reconcile its ledger.
 const dump=spawnSync('docker',['exec',name,'pg_dump','-U','inventory','-d','inventory','-Fc'],{maxBuffer:64*1024*1024});if(dump.status!==0)throw Error('Backup failed');
 docker(['exec',name,'createdb','-U','inventory','restored']);
 const restored=spawnSync('docker',['exec','-i',name,'pg_restore','-U','inventory','-d','restored','--no-owner','--no-acl','--exit-on-error'],{input:dump.stdout,encoding:'utf8'});if(restored.status!==0)throw Error(restored.stderr);
 const check=JSON.parse(docker(['exec',name,'psql','-U','inventory','-d','restored','-Atc',`SELECT json_build_object('users',(SELECT count(*) FROM "User"),'invalid',(SELECT count(*) FROM "InventoryBalance" WHERE quantity<0 OR "reservedQty"<0 OR "reservedQty">quantity))`]));if(check.users<1||check.invalid!==0)throw Error('Restored records failed validation');
 const validation=spawnSync('docker',['exec','-i',name,'psql','-U','inventory','-d','restored','-v','ON_ERROR_STOP=1'],{input:fsReadValidation(),encoding:'utf8'});if(validation.status!==0)throw Error(validation.stderr);
 console.log('PASS: restored ledger and reservation reconciliation');
 console.log('PASS: real database dump restored into an empty database with users and valid balances');
 console.log('PASS: real PostgreSQL migrations and API integration tests');
}finally{spawnSync('docker',['rm','-f',name],{stdio:'ignore'});}})().catch(e=>{console.error(e.message);process.exitCode=1;});
