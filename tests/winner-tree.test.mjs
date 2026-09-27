import test from 'node:test';
import assert from 'node:assert/strict';
import {winnerTreeTopK,winnerComparisonLimit,selectionPlan,comparisonLimit,advanceSort} from '../public/sort.js';
import {gameFromSelection,candidates,transition,isSortingGame} from '../public/game.js';

const idsFor=n=>Array.from({length:n},(_,i)=>`member-${i}`);
const saved=state=>JSON.parse(JSON.stringify(state));
function undo(state){const history=[...state.history],previous=history.pop();return {...previous,history};}
function finish(state,rank){
  const seen=new Set(state.answers.map(pair=>JSON.stringify([...pair].sort())));
  while(state.stage!=='ready'){
    const pair=candidates(state),key=JSON.stringify([...pair].sort());
    assert.equal(pair.length,2);assert.notEqual(pair[0],pair[1]);
    assert.ok(!seen.has(key),'a resolved pair must not be asked again');seen.add(key);
    state=transition(saved(state),[rank.get(pair[0])<rank.get(pair[1])?pair[0]:pair[1]]);
    assert.ok(state.answers.length<=state.maxComparisons);
  }
  return state;
}

test('按较小的次数上界选择算法，九人仍最多 19 次，14 人起用胜者树',()=>{
  for(const [n,limit] of [[9,19],[10,22],[13,34],[14,37],[18,49],[27,58],[30,61],[60,99],[100,147]]){
    const plan=selectionPlan(n),game=gameFromSelection(idsFor(n));
    assert.equal(plan.algorithm,n<14?'ford-johnson-v1':'winner-tree-v1');
    assert.equal(plan.maxComparisons,limit);assert.equal(game.maxComparisons,limit);
    assert.equal(game.algorithm,plan.algorithm);assert.ok(isSortingGame(game));
  }
  for(let n=9;n<=1500;n++)assert.ok(selectionPlan(n).maxComparisons<=comparisonLimit(n));
});

test('胜者树穷举 8! 种偏好：只取有序前五，兼容空池、单个元素和空分支',()=>{
  assert.deepEqual(winnerTreeTopK([],()=>assert.fail()),[]);
  assert.deepEqual(winnerTreeTopK(['only'],()=>assert.fail()),['only']);
  assert.deepEqual(winnerTreeTopK([1,2],()=>assert.fail(),0),[]);
  const items=[0,1,2,3,4,5,6,7],order=[...items],rank=[];let checked=0;
  function visit(start){
    if(start===items.length){
      order.forEach((id,i)=>rank[id]=i);let calls=0;
      const result=winnerTreeTopK(items,(a,b)=>{calls++;return rank[a]<rank[b];},5);
      assert.deepEqual(result,order.slice(0,5));assert.ok(calls<=winnerComparisonLimit(8,5));checked++;return;
    }
    for(let i=start;i<items.length;i++){
      [order[start],order[i]]=[order[i],order[start]];visit(start+1);
      [order[start],order[i]]=[order[i],order[start]];
    }
  }
  visit(0);assert.equal(checked,40320);assert.deepEqual(items,[0,1,2,3,4,5,6,7]);
});

test('奇数、幂边界及 1500 人的随机偏好均返回正确前九，比较数不超上界',()=>{
  let seed=20260926;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(const n of [9,10,13,14,15,16,17,18,27,30,31,32,33,60,63,64,65,100,1500]){
    const items=idsFor(n);
    for(let trial=0;trial<64;trial++){
      const expected=[...items];
      for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[expected[i],expected[j]]=[expected[j],expected[i]];}
      const rank=new Map(expected.map((id,i)=>[id,i])),seen=new Set();let calls=0;
      const result=winnerTreeTopK(items,(a,b)=>{
        const key=JSON.stringify([a,b].sort());assert.ok(!seen.has(key));seen.add(key);
        calls++;return rank.get(a)<rank.get(b);
      });
      assert.deepEqual(result,expected.slice(0,9));assert.ok(calls<=winnerComparisonLimit(n));
    }
  }
});

test('确定第九名即停止，不为第十名继续修复树',()=>{
  const items=Array.from({length:32},(_,i)=>i),top=[0,2,4,6,8,10,12,14,1];
  const order=[...top,...items.filter(id=>!top.includes(id))],rank=new Map(order.map((id,i)=>[id,i]));
  let calls=0;
  assert.deepEqual(winnerTreeTopK(items,(a,b)=>{calls++;return rank.get(a)<rank.get(b);}),top);
  assert.equal(calls,63);assert.equal(calls,winnerComparisonLimit(32));
});

test('两种算法的每一步可序列化续选，胜者树中途及结束后撤销保留原题',()=>{
  for(const n of [9,13,14,18,30,60,100]){
    const ids=idsFor(n),rank=new Map([...ids].reverse().map((id,i)=>[id,i]));let game=gameFromSelection(ids);
    for(let step=0;step<n;step++){
      const before=saved(game),pair=candidates(game);
      const winner=rank.get(pair[0])<rank.get(pair[1])?pair[0]:pair[1];
      const next=transition(saved(game),[winner]);assert.deepEqual(undo(next),before);
      // Changing this answer branches without retaining the discarded answer.
      const changed=transition(undo(next),[pair.find(id=>id!==winner)]);
      assert.equal(changed.answers.at(-1)[0],pair.find(id=>id!==winner));
      game=next;
    }
    game=finish(game,rank);assert.deepEqual(game.ranking,[...ids].reverse().slice(0,9));
    const previous=undo(saved(game));assert.equal(previous.stage,'final');
    const [lastWinner]=game.answers.at(-1);
    assert.deepEqual(transition(previous,[lastWinner]),game);
  }
});

test('旧的 27 人 Ford–Johnson 存档继续原算法和题目，不迁移赛程',()=>{
  const ids=idsFor(27),rank=new Map(ids.map((id,i)=>[id,i]));let game=gameFromSelection(ids);
  Object.assign(game,{algorithm:'ford-johnson-v1',maxComparisons:comparisonLimit(ids.length),answers:[]});
  advanceSort(game);
  for(let i=0;i<10;i++){
    const pair=candidates(game);game=transition(game,[rank.get(pair[0])<rank.get(pair[1])?pair[0]:pair[1]]);
  }
  const resume=saved(game),pair=[...resume.pair];advanceSort(resume);
  assert.deepEqual(resume.pair,pair);assert.equal(resume.algorithm,'ford-johnson-v1');
  assert.equal(resume.maxComparisons,96);
  const result=finish(resume,rank);assert.deepEqual(result.ranking,ids.slice(0,9));
  assert.equal(result.algorithm,'ford-johnson-v1');
});

test('9–1500名候选全部至少参与一次比较，完整排序的前九与选择算法完全一致',()=>{
  let seed=20260927;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let n=9;n<=1500;n++){
    const ids=idsFor(n),expected=[...ids];
    for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[expected[i],expected[j]]=[expected[j],expected[i]];}
    const rank=new Map(expected.map((id,i)=>[id,i])),shown=new Set();
    const top=winnerTreeTopK(ids,(a,b)=>{shown.add(a);shown.add(b);return rank.get(a)<rank.get(b);});
    assert.equal(shown.size,n,`${n}名候选不得有任何一名未参加比较`);
    assert.deepEqual(top,expected.slice(0,9));
  }
});

test('真实交互及续选：所有候选均出题，且已答比较能推导前九每个名次',()=>{
  for(const n of [9,10,13,14,15,16,17,18,27,30,31,32,33,63,64,65,100,129]){
    const ids=idsFor(n);
    // Alternate favourites across tree halves, including odd trailing leaves.
    const expected=[...ids].sort((a,b)=>((Number(a.slice(7))*37)%n)-((Number(b.slice(7))*37)%n));
    const rank=new Map(expected.map((id,i)=>[id,i]));
    let game=gameFromSelection(ids);
    assert.deepEqual(game.order,ids,'开始PK不得丢失任何预选成员');
    game=finish(game,rank);
    assert.deepEqual(game.ranking,expected.slice(0,9));
    const shown=new Set(game.answers.flat());
    assert.equal(shown.size,n,`${n}人交互流程全部出题`);
    const edges=new Map(ids.map(id=>[id,[]]));
    for(const [winner,loser] of game.answers)edges.get(winner).push(loser);
    for(let place=0;place<9;place++){
      const reachable=new Set(),pending=[game.ranking[place]];
      while(pending.length){const id=pending.pop();if(reachable.has(id))continue;reachable.add(id);pending.push(...edges.get(id));}
      for(const lower of expected.slice(place+1))assert.ok(reachable.has(lower),`第${place+1}名高于${lower}必须有已答比较或传递关系作为依据`);
    }
  }
});
