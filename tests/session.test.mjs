import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSelection,orderedMembers} from '../public/session.js';
test('新开局独立打乱、清空进度；恢复使用保存的顺序',()=>{
  const ids=Array.from({length:27},(_,i)=>String(i)),members=ids.map(id=>({id}));
  const a=freshSelection(ids,()=>.1),b=freshSelection(ids,()=>.8);
  assert.notDeepEqual(a.order,b.order);assert.deepEqual([...a.order].sort(),[...ids].sort());assert.deepEqual(a.ids,[]);assert.equal(a.page,0);
  a.ids=[a.order[12]];a.browsePage=1;
  const saved=JSON.parse(JSON.stringify(a));assert.deepEqual(orderedMembers(members,saved.order).map(m=>m.id),a.order);assert.equal(saved.browsePage,1);assert.deepEqual(saved.ids,a.ids);
});
test('恢复顺序兼容名单增删，新增人员追加且不重复',()=>{
  assert.deepEqual(orderedMembers([{id:'a'},{id:'b'},{id:'c'}],['b','gone','b','a']).map(m=>m.id),['b','a','c']);
});
