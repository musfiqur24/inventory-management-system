import type { Prisma } from '../generated/prisma/client.js';
const tables = ['SalesOrder','ProductionRequisition','MaterialIssue','ProductionBatch'] as const;
export async function nextDocumentNumber(tx: Prisma.TransactionClient, organizationId:string, table:typeof tables[number], prefix:string, width=4) {
  // A common tenant lock prevents first-use counter races across app instances.
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId} FOR UPDATE`;
  const kind=table+':'+prefix;
  const existing=await tx.documentSequence.findUnique({where:{organizationId_kind:{organizationId,kind}}});
  let initial=1;
  if(!existing){
    const rows=await tx.$queryRawUnsafe<Array<{max:bigint|null}>>(`SELECT MAX(substring(number FROM '[0-9]+$')::bigint) AS max FROM "${table}" WHERE "organizationId"=$1 AND left(number,length($2))=$2`,organizationId,prefix);
    initial=Number(rows[0]?.max??0)+1;
  }
  const counter=await tx.documentSequence.upsert({where:{organizationId_kind:{organizationId,kind}},create:{organizationId,kind,value:initial},update:{value:{increment:1}}});
  return prefix+String(counter.value).padStart(width,'0');
}
