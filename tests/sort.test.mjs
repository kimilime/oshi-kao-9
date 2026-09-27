import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeInsertionSort,comparisonLimit} from '../public/sort.js';
import {gameFromSelection,candidates,transition} from '../public/game.js';
test('穷举 9! 种偏好：排序正确，最坏 19 次',()=>{
  const order=[0,1,2,3,4,5,6,7,8],rank=[],items=[...order];let count=0,max=0;
  function check(k){
    if(k===9){order.forEach((id,i)=>rank[id]=i);let calls=0;const result=mergeInsertionSort(items,(a,b)=>{calls++;return rank[a]<rank[b];});
      for(let i=0;i<9;i++)if(result[i]!==order[i])throw new Error('排序错误');
      if(calls>19)throw new Error('超出 19 次');max=Math.max(max,calls);count++;return;}
    for(let j=k;j<9;j++){[order[k],order[j]]=[order[j],order[k]];check(k+1);[order[k],order[j]]=[order[j],order[k]];}
  }
  check(0);assert.equal(count,362880);assert.equal(max,19);assert.equal(comparisonLimit(9),19);
});
test('交互排序支持序列化恢复、撤销和改变答案，不重复询问',()=>{
  const ids=Array.from({length:27},(_,i)=>`id-${i}`),rank=new Map(ids.map((id,i)=>[id,i]));let s=gameFromSelection(ids),seen=new Set(),steps=0;
  const original=structuredClone(s),first=candidates(s);s=transition(s,[first[0]]);
  const history=[...s.history],old=history.pop();s={...old,history};assert.deepEqual(s,original);
  s=transition(s,[first[1]]);assert.equal(s.answers[0][0],first[1]);
  // Start the known stable preference run after independently checking changed-answer undo.
  s=gameFromSelection(ids);
  while(s.stage!=='ready'){
    const pair=candidates(s),key=[...pair].sort().join('|');assert.ok(!seen.has(key));seen.add(key);
    const winner=rank.get(pair[0])>rank.get(pair[1])?pair[0]:pair[1];s=transition(JSON.parse(JSON.stringify(s)),[winner]);steps++;
  }
  assert.deepEqual(s.ranking,[...ids].reverse().slice(0,9));assert.ok(steps<=s.maxComparisons);
});
