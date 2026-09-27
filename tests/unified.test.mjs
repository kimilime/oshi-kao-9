import test from 'node:test';
import assert from 'node:assert/strict';
import {gameFromSelection,candidates,transition} from '../public/game.js';
import {posterSlots} from '../public/poster.js';
test('统一选人：不足九人拒绝；九人也进入 PK 排序',()=>{
  assert.throws(()=>gameFromSelection(['a']));
  const ids=Array.from({length:9},(_,i)=>`id-${i}`),s=gameFromSelection(ids);
  assert.equal(s.stage,'final');assert.deepEqual(s.ranking,[]);assert.deepEqual(s.order,ids);
});
test('统一选人：超过九人直接进入比较，只使用已选池',()=>{
  for(const n of [9,10,18,19,27,60]){
    const ids=Array.from({length:n},(_,i)=>`id-${i}`);let s=gameFromSelection(ids),steps=0;
    assert.equal(s.stage,'final');
    while(s.stage!=='ready'&&steps++<3000){s=transition(s,candidates(s).slice(0,s.stage==='final'?1:2));}
    assert.equal(s.stage,'ready');assert.equal(new Set(s.ranking).size,9);assert.ok(s.ranking.every(id=>ids.includes(id)));
  }
});
test('前三名按 2/1/3 排列且第一名最大，4–9 六张小图同排且不重叠',()=>{
  const p=posterSlots('podium');assert.equal(p.length,9);
  assert.ok(p[1].x<p[0].x&&p[0].x<p[2].x);assert.equal(p[0].x+p[0].w/2,540);assert.ok(p[0].w*p[0].h>p[1].w*p[1].h);
  assert.ok(p[0].y<p[1].y);
  assert.equal(new Set(p.slice(3).map(s=>s.y)).size,1);
  for(const s of p){assert.ok(s.x+s.w<=1080);assert.ok(s.y+s.h+68<1230-92);}
  for(let i=3;i<8;i++)assert.ok(p[i].x+p[i].w<p[i+1].x);
  assert.ok(p[0].w*p[0].h>p[3].w*p[3].h*3);
});

test('九人排名由 PK 偏好决定，不沿用预选顺序',()=>{
  const ids=Array.from({length:9},(_,i)=>String(i));let s=gameFromSelection(ids);
  while(s.stage!=='ready')s=transition(s,[[...candidates(s)].sort().at(-1)]);
  assert.deepEqual(s.ranking,[...ids].reverse());
});

test('第一居中版式按 234 / 516 / 789 排列，第一张单独放大',()=>{const slots=posterSlots('center');const rows=[[],[],[]];slots.forEach((s,i)=>rows[Math.round((s.y+s.h/2-390)/420)].push({rank:i+1,x:s.x+s.w/2}));assert.deepEqual(rows.map(row=>row.sort((a,b)=>a.x-b.x).map(s=>s.rank)),[[2,3,4],[5,1,6],[7,8,9]]);assert.equal(slots[0].x+slots[0].w/2,540);assert.ok(slots.slice(1).every(s=>s.w<slots[0].w&&s.h<slots[0].h));});
