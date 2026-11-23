import {test} from 'node:test';
import assert from 'node:assert/strict';
import {availableForSource} from '../../frontend/src/shared/stockAvailability.js';
test('the owning order can use its reservation but cannot use another order allocation',()=>{
 const stock={quantity:10,reservedQty:8,lot:{qualityStatus:'RELEASED'},reservations:[{sourceId:'mine',quantity:5},{sourceId:'other',quantity:3}]};
 assert.equal(availableForSource(stock,'mine'),7);
 assert.equal(availableForSource(stock,'other'),5);
 assert.equal(availableForSource(stock,'unallocated'),2);
 assert.equal(availableForSource({...stock,lot:{qualityStatus:'HOLD'}},'mine'),0);
 assert.equal(availableForSource({...stock,lot:{qualityStatus:'RELEASED',expiryDate:'2000-01-01'}},'mine'),0);
});
