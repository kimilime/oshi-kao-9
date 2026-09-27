import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,candidates,transition} from '../public/game.js';
import {publicRanking,validateMember} from '../public/local-members.js';
const ids=n=>Array.from({length:n},(_,i)=>String(i+1).padStart(3,'0'));
test('9–60 人完整流程、加赛和最终顺序正确',()=>{
  for(const n of [9,10,18,19,27,46,60]){
    let s=createGame(ids(n)),steps=0,rescue=false;
    while(s.stage!=='ready'){
      const c=candidates(s);assert.ok(c.length);let pick;
      if(s.stage==='prelim')pick=c;
      else if(['main','rescue'].includes(s.stage)){assert.ok(c.length>=2&&c.length<=4);pick=[...c].sort().slice(0,2);rescue ||= s.stage==='rescue';}
      else pick=[[...c].sort()[0]];
      s=transition(s,pick);assert.ok(++steps<1000);
    }
    assert.equal(s.ranking.length,9);assert.equal(new Set(s.ranking).size,9);assert.deepEqual(s.ranking,[...s.ranking].sort());assert.equal(rescue,n>18);
  }
});
test('零预选进入补选；不足九人不可继续；历史支持返回',()=>{
  let s=createGame(ids(10));s=transition(s,[]);s=transition(s,[]);assert.equal(s.stage,'supplement');assert.throws(()=>transition(s,ids(8)));s=transition(s,ids(9));assert.equal(s.stage,'final');const previous=structuredClone(s);s=transition(s,[candidates(s)[0]]);const history=[...s.history],last=history.pop();assert.deepEqual({...last,history},previous);
});
test('拒绝重复选择、陌生成员和决赛空选',()=>{let s=createGame(ids(9));assert.throws(()=>transition(s,['alien']));assert.throws(()=>transition(s,[candidates(s)[0],candidates(s)[0]]));s=transition(s,candidates(s));assert.throws(()=>transition(s,[]));});
test('含自定义成员的整份名单不提交，纯固定名单保持顺序',()=>{const set=new Set(['official-a','official-b']);assert.deepEqual(publicRanking(['official-b','official-a'],set),['official-b','official-a']);assert.deepEqual(publicRanking(['local-secret','official-b','official-a'],set),null);assert.deepEqual(publicRanking(['local-a','local-b'],set),null);});
test('微博链接和用户资料校验',()=>{assert.throws(()=>validateMember({name:'',group:'A'}));assert.throws(()=>validateMember({name:'a',group:'b',weibo_link:'javascript:alert(1)'}));assert.throws(()=>validateMember({name:'a',group:'b',weibo_link:'https://weibo.com.attacker.test/a'}));assert.equal(validateMember({name:' a ',group:'b',weibo_link:'https://weibo.com/u/123'}).name,'a');});
