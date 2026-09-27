import test from 'node:test';
import assert from 'node:assert/strict';
import {filterMembers,memberCity,moveSelection} from '../public/selection.js';
import {resultPhoto,publicRanking,validateMember} from '../public/local-members.js';
const members=Array.from({length:1500},(_,i)=>({id:`member-${i}`,name:`成员${i}`,group:`团体${i%400}`,city:['上海','广州','成都'][i%3],pic:`/images/${i}.jpg`}));
test('1500 人 / 400 团：城市和人名团名联合匹配',()=>{
  assert.equal(filterMembers(members).length,1500);
  assert.equal(filterMembers(members,{city:'上海'}).length,500);
  const hit=filterMembers(members,{query:' 成员1200 团体0 ',city:'上海'});assert.deepEqual(hit.map(m=>m.id),['member-1200']);
  assert.equal(filterMembers(members,{query:'成员1200',city:'广州'}).length,0);
  assert.equal(filterMembers(members,{query:'不存在'}).length,0);
  assert.equal(memberCity({}),'未填写');
});
test('跨城市筛选不会改变已选名单；排名调整不修改输入',()=>{
  const picks=['member-0','member-1','member-2'];filterMembers(members,{city:'广州'});assert.deepEqual(picks,['member-0','member-1','member-2']);
  assert.deepEqual(moveSelection(picks,1,-1),['member-1','member-0','member-2']);assert.deepEqual(moveSelection(picks,0,-1),picks);assert.deepEqual(moveSelection(picks,2,1),picks);
});
test('本机结果照片覆盖不改原图与公共成员身份',()=>{
  const member=members[0],original=member.pic,overrides={[member.id]:'data:image/jpeg;base64,LOCAL'};
  assert.equal(resultPhoto(member,overrides),overrides[member.id]);assert.equal(member.pic,original);assert.equal(resultPhoto(member,{}),original);
  assert.deepEqual(publicRanking([member.id,'local-private'],new Set([member.id])),null);
});
test('表单城市字段校验，兼容旧本机备份',()=>{
  assert.equal(validateMember({name:'小星',group:'月亮',city:' 上海 '}).city,'上海');assert.equal(validateMember({name:'小星',group:'月亮'}).city,'未填写');
  assert.throws(()=>validateMember({name:'小星',group:'月亮',city:'城'.repeat(31)}));
});

test('自定义省级行政区与来源、搜索联合筛选，原名单顺序不变',()=>{
 const rows=[{id:'a',name:'甲',group:'A',province:'上海市'},{id:'b',name:'乙',group:'B',province:'广东省',local:true},{id:'c',name:'丙',group:'B',province:'广东省'}];
 assert.deepEqual(filterMembers(rows,{source:'custom',province:'广东省',query:'B'}).map(m=>m.id),['b']);
 assert.deepEqual(filterMembers(rows,{source:'standard'}).map(m=>m.id),['a','c']);
 assert.deepEqual(filterMembers(rows).map(m=>m.id),['a','b','c']);
 assert.equal(memberCity({city:'广州'}),'广东省');assert.equal(validateMember({name:'甲',group:'A',province:'四川省'}).province,'四川省');
});

test('多选省级行政区：空选不显示、全选恢复，多地区与关键词/来源组合且保持顺序',()=>{
 const rows=[{id:'a',name:'甲',group:'A',province:'上海市'},{id:'b',name:'乙',group:'B',province:'广东省',local:true},{id:'c',name:'丙',group:'B',province:'四川省'},{id:'d',name:'丁',group:'B',province:'广东省'}];
 assert.deepEqual(filterMembers(rows,{provinces:[]}),[]);
 assert.deepEqual(filterMembers(rows,{provinces:['广东省','上海市']}).map(m=>m.id),['a','b','d']);
 assert.deepEqual(filterMembers(rows,{provinces:['广东省','四川省'],source:'standard',query:'B'}).map(m=>m.id),['c','d']);
 assert.deepEqual(filterMembers(rows,{provinces:['广东省','四川省'],source:'custom'}).map(m=>m.id),['b']);
 assert.deepEqual(filterMembers(rows,{provinces:['上海市','广东省','四川省']}),rows);
 assert.deepEqual(rows.map(m=>m.id),['a','b','c','d']);
});
