import test from 'node:test';
import assert from 'node:assert/strict';
import {gameFromSelection,candidates,transition} from '../public/game.js';
import {buildSortRecord,renderSortRecord} from '../public/sort-record.js';
import {winnerTreeTopK} from '../public/sort.js';

function finish(n){
  const ids=Array.from({length:n},(_,i)=>`id-${i}`),rank=id=>Number(id.slice(3));
  let game=gameFromSelection(ids);
  while(game.stage!=='ready'){const pair=candidates(game);game=transition(game,[rank(pair[0])>rank(pair[1])?pair[0]:pair[1]]);}
  return game;
}
test('文本历程逐条对应有效答案，保持左右顺序，且不修改完成存档',()=>{
  for(const n of [9,13,14,17,30,33]){
    const game=finish(n),original=JSON.stringify(game),record=buildSortRecord(JSON.parse(original));
    assert.ok(record);assert.deepEqual(record.initial,game.order);
    assert.equal(record.algorithm,n<14?'Ford–Johnson':'Tournament Tree');
    const comparisons=record.events.filter(e=>e.type==='comparison');
    assert.equal(comparisons.length,game.answers.length);
    comparisons.forEach((event,i)=>{assert.equal(event.winner,game.answers[i][0]);assert.deepEqual(new Set([event.left,event.right]),new Set(game.answers[i]));assert.equal(event.number,i+1);assert.deepEqual([event.left,event.right],game.history[i].pair);});
    assert.deepEqual(record.events.filter(e=>e.type==='rank').map(e=>e.id),game.ranking);
    assert.equal(JSON.stringify(game),original);
  }
});
test('胜者树在实际确定时插入名次；F-J在完整排序结束后列出九个名次',()=>{
  for(const n of [14,17,30]){
    const game=finish(n),events=buildSortRecord(game).events;let answers=0;
    for(const event of events){if(event.type==='comparison'){answers++;continue;}
      const known=new Map(game.answers.slice(0,answers).flatMap(([a,b])=>[[JSON.stringify([a,b]),true],[JSON.stringify([b,a]),false]]));
      const established=[];
      try{winnerTreeTopK(game.order,(a,b)=>{const key=JSON.stringify([a,b]);if(!known.has(key))throw Error('Next question');return known.get(key);},9,id=>established.push(id));}catch{}
      assert.ok(established.includes(event.id));
    }
    assert.equal(events.findIndex(e=>e.type==='rank'),n-1);
  }
  const game=finish(9),record=buildSortRecord(game);
  assert.ok(record.events.slice(0,game.answers.length).every(e=>e.type==='comparison'));
  assert.ok(record.events.slice(game.answers.length).every(e=>e.type==='rank'));
});
test('不完整、旧算法、不匹配结果不补造记录；成员名称进行HTML转义且不包含图片',()=>{
  const game=finish(14);
  assert.equal(buildSortRecord(null),null);
  assert.equal(buildSortRecord({...game,algorithm:'old'}),null);
  assert.equal(buildSortRecord({...game,answers:game.answers.slice(1)}),null);
  assert.equal(buildSortRecord({...game,ranking:[...game.ranking].reverse()}),null);
  assert.equal(buildSortRecord({...game,answers:[...game.answers,game.answers[0]]}),null);
  const byId=Object.fromEntries(game.order.map(id=>[id,{name:'<img src=x onerror=alert(1)>'}]));
  const html=renderSortRecord(buildSortRecord(game),byId);
  assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('sort-winner'));assert.ok(html.includes('sort-loser'));
});
test('撤销并改选后仅显示当前分支，已完成的本机结果可重建同一历程',()=>{
  let game=finish(14);const history=[...game.history],previous=history.pop();game={...previous,history};
  const opposite=game.pair.find(id=>id!==finish(14).answers.at(-1)[0]);game=transition(game,[opposite]);
  while(game.stage!=='ready')game=transition(game,[game.pair[0]]);
  assert.ok(buildSortRecord(game));
  assert.deepEqual(buildSortRecord({...JSON.parse(JSON.stringify(game)),stage:'result'}),buildSortRecord(game));
});
