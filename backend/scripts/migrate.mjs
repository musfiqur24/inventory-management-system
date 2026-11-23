// Safe migration adoption for an existing db-push installation. Never resets data.
import { spawnSync } from 'node:child_process';
import pg from 'pg';
process.env.DATABASE_URL=process.env.MIGRATION_DATABASE_URL||process.env.DATABASE_URL;
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
function cli(args,allowed=[0]){const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js',...args],{encoding:'utf8',env:process.env});if(!allowed.includes(result.status)){process.stderr.write(result.stderr);process.stderr.write(result.stdout);throw new Error('Migration command failed; database was not reset.');}return result;}
await client.connect();
try{
 await client.query("SELECT pg_advisory_lock(831142,1)");
 const {rows}=await client.query(`SELECT to_regclass('public."_prisma_migrations"') AS history,to_regclass('public."User"') AS users`);
 if(!rows[0].history&&rows[0].users){
   const diff=cli(['migrate','diff','--from-config-datasource','--to-schema','prisma/baseline.prisma','--exit-code'],[0,2]);
   if(diff.status===2)throw new Error('Existing database differs from the recorded baseline. Review drift before adoption; no reset or forced change was attempted.');
   cli(['migrate','resolve','--applied','202611230001_baseline']);
 }
 const result=cli(['migrate','deploy']);process.stdout.write(result.stdout);
 if(process.env.APP_DB_PASSWORD){
   const present=await client.query("SELECT 1 FROM pg_roles WHERE rolname='inventory_app'");
   if(!present.rowCount)await client.query('CREATE ROLE inventory_app LOGIN');
   const quoted=await client.query('SELECT quote_literal($1) AS value',[process.env.APP_DB_PASSWORD]);
   await client.query('ALTER ROLE inventory_app PASSWORD '+quoted.rows[0].value);
   await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
   await client.query('GRANT USAGE ON SCHEMA public TO inventory_app');
   await client.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO inventory_app');
   await client.query('REVOKE ALL ON TABLE "_prisma_migrations" FROM inventory_app');
   await client.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO inventory_app');
 }

}finally{await client.query('SELECT pg_advisory_unlock(831142,1)');await client.end();}
