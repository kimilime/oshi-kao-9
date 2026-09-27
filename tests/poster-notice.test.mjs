import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadNotice} from '../public/poster.js';
test('上传来源标注覆盖换图、自定义、混合；仅检查当前入选成员',()=>{
  const byId={a:{},b:{local:true},c:{}};
  assert.equal(uploadNotice(['a'],byId,{}),'');
  assert.equal(uploadNotice(['a'],byId,{c:'data:image/png'}),'');
  const expected='部分或全部内容由用户上传';
  assert.equal(uploadNotice(['a'],byId,{a:'data:image/png'}),expected);
  assert.equal(uploadNotice(['b'],byId,{}),expected);
  assert.equal(uploadNotice(['a','b'],byId,{}),expected);
  assert.equal(uploadNotice(['a'],byId,{a:undefined}),'');
});
