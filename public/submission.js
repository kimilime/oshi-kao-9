let dispose=()=>{};
export function disposeSubmission(){dispose();dispose=()=>{};}
export function mountSubmission({container,eligible,runId,api,createSession,submit,savedState,remember=()=>{}}){
 disposeSubmission();let active=true,sent=false;
 const status=document.createElement('p');status.className='tiny';status.setAttribute('role','status');
 const note=document.createElement('p');note.className='tiny';note.textContent='提交间隔仅用于榜单；选人、生成、换图、保存与分享图片均不受影响。';
 container.replaceChildren(status,note);
 const alive=()=>active&&container.isConnected;dispose=()=>{active=false;};
 async function start(){
  status.textContent='正在确认本次结果是否已计入榜单…';
  try{
   const saved=await api('result-status?id='+encodeURIComponent(runId));if(!alive())return;
   if(saved.recorded){status.textContent='本次结果已计入“大家的选择”。';remember(status.textContent);return;}
   if(saved.retryAfter)throw new Error('提交间隔未满一分钟。');
   const session=await createSession();if(!alive())return;
   status.textContent='正在提交本次结果…';sent=true;
   const result=await submit(session.token);if(!alive())return;
   status.textContent=result.outcome==='already_recorded'?'本次结果已计入“大家的选择”。':'本次结果已提交并记录到“大家的选择”。';remember(status.textContent);
  }catch(error){
   if(!alive())return;
   const prefix=!sent||error.status?'本次未提交到':'暂未确认是否计入';
   status.textContent=`${prefix}“大家的选择”：${error.message||'网络连接失败。'} 图片仍可保存。`;remember(status.textContent);
  }
 }
 if(!eligible){status.textContent='本次九选包含自定义成员，整份名单未提交到“大家的选择”。';return;}
 if(savedState){status.textContent=savedState;return;}
 remember('本次提交未完成，暂未确认是否计入“大家的选择”。图片仍可保存。');start();
}
