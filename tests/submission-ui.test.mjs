import test from 'node:test';
import assert from 'node:assert/strict';
import {mountSubmission,disposeSubmission} from '../public/submission.js';
class Element {constructor(){this.isConnected=true;this.children=[]}setAttribute(){}replaceChildren(...children){this.children=children}}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('结果页自动提交一次签名会话，不加载第三方服务',async()=>{
 const oldDocument=globalThis.document;let submitted,calls=0;const container=new Element();globalThis.document={createElement:tag=>Object.assign(new Element(),{tag})};
 try{
  mountSubmission({container,eligible:true,runId:'run',api:async path=>{assert.match(path,/^result-status/);return {recorded:false}},createSession:async()=>({token:'signed'}),submit:async(...args)=>{calls++;submitted=args;return {outcome:'recorded'}}});
  await settle();assert.deepEqual(submitted,['signed']);assert.equal(calls,1);assert.match(container.children[0].textContent,/已提交并记录/);assert.equal(container.children.length,2);
 }finally{disposeSubmission();globalThis.document=oldDocument;}
});
test('自定义结果不申请验证；会话失败只显示原因，无手动重试按钮',async()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;globalThis.document={createElement:()=>new Element()};globalThis.window={};
 try{
  const custom=new Element();mountSubmission({container:custom,eligible:false,api:()=>assert.fail('不应请求上传接口')});assert.match(custom.children[0].textContent,/自定义成员/);
  const failed=new Element();mountSubmission({container:failed,eligible:true,runId:'run',api:async path=>path.startsWith('result-status')?{recorded:false}:{siteKey:'site'},createSession:async()=>{throw new Error('提交服务暂不可用，图片仍可保存')}});
  await settle();assert.match(failed.children[0].textContent,/提交服务暂不可用/);assert.equal(failed.children.some(el=>el.tag==='button'),false);
 }finally{disposeSubmission();globalThis.window=oldWindow;globalThis.document=oldDocument}
});

test('已尝试的结果重绘后只展示状态，不再申请验证或上传',async()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;globalThis.document={createElement:tag=>Object.assign(new Element(),{tag})};globalThis.window={};
 let savedState;const container=new Element();
 try{
  mountSubmission({container,eligible:true,runId:'once',remember:message=>{savedState=message},api:async()=>({recorded:false,retryAfter:20})});
  await settle();assert.match(savedState,/间隔未满一分钟/);
  mountSubmission({container:new Element(),eligible:true,runId:'once',savedState,api:()=>assert.fail('已结束的提交不应再次请求接口'),createSession:()=>assert.fail('不应再次申请验证'),submit:()=>assert.fail('不应再次上传')});
  await settle();assert.equal(container.children.some(el=>el.tag==='button'),false);
 }finally{disposeSubmission();globalThis.window=oldWindow;globalThis.document=oldDocument}
});
