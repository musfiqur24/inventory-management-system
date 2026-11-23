import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '../src/generated/prisma/client.js';
import { postStock } from '../src/services/stock.js';
const d = (n: number) => new Prisma.Decimal(n);
async function release(before: number, quantity: number, factor = 1, otherBin = 0, fm = false) {
  const notices: any[] = [];
  const unit = { id: 'unit', dimension: 'WEIGHT', factorToBase: d(factor) };
  const store = { id: 'store', storeType: fm ? 'FM_STORE' : 'RM_STORE', isActive: true, name: 'Main RM' };
  const tx: any = {
    $queryRaw: async () => [],
    auditEvent:{create:async()=>({})},
    reorderState:{findUnique:async()=>({low:(before+otherBin)*factor<20}),upsert:async()=>({})},
    bin: { findFirst: async () => ({ id: 'bin', storeId: 'store', isActive: true, store }) },
    product: { findFirst: async () => ({ id: 'product', type: fm ? 'FINISHED_GOOD' : 'RAW_MATERIAL', baseUomId: 'unit', name: 'Corn', sku: 'CORN' }) },
    lot: { findFirst: async () => ({ qualityStatus: 'RELEASED' }) },
    unitOfMeasure: { findMany: async () => [unit], findUniqueOrThrow: async () => unit },
    inventoryBalance: {
      findUnique: async () => ({ quantity: d(before), reservedQty: d(0), uomId: 'unit' }),
      update: async () => ({ quantity: d(before - quantity) }),
      findMany: async (query: any) => {
        assert.equal(query.where.bin.storeId, 'store');
        assert.equal(query.where.organizationId, 'org');
        return [{ quantity: d(before - quantity), uom: unit }, { quantity: d(otherBin), uom: unit }];
      },
    },
    stockMovement: { create: async () => ({ id: 'movement' }) },
    organizationMember: { findMany: async (query: any) => {
      assert.deepEqual(query.where, { organizationId: 'org', isActive: true, user: { isActive: true } });
      return [{ userId: 'user1' }, { userId: 'user2' }];
    } },
    notification: { createMany: async ({ data }: any) => { notices.push(...data); } },
  };
  await postStock(tx, { organizationId: 'org', binId: 'bin', productId: 'product', lotId: 'lot', uomId: 'unit', quantity,
    direction: 'OUT', storeType: fm ? 'FM_STORE' : 'RM_STORE', movementType: 'ISSUE', documentType: 'TEST', documentId: 'test', sourceDocumentId: 'test' } as any);
  return notices;
}
test('crossing below 20 kg notifies every active member', async () => {
  const notices = await release(25, 6);
  assert.deepEqual(notices.map(n => n.recipientId), ['user1', 'user2']);
  assert.match(notices[0].message, /19 kg/);
});
test('exactly 20 kg does not alert', async () => assert.equal((await release(25, 5)).length, 0));
test('continued consumption below threshold does not repeat alerts', async () => assert.equal((await release(19, 1)).length, 0));
test('depletion to zero triggers an alert', async () => assert.equal((await release(20, 20)).length, 2));
test('grams are converted to kilograms', async () => assert.equal((await release(25000, 6000, 0.001)).length, 2));
test('stock in other bins counts toward the threshold', async () => assert.equal((await release(25, 6, 1, 10)).length, 0));
test('FM stock does not trigger RM alerts', async () => assert.equal((await release(25, 6, 1, 0, true)).length, 0));
