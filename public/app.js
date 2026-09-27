import {mountSortRecord} from './sort-record.js?v=20260927-sort-record';
import {memberGroups} from './regions.js?v=20260926-supplement';
import {requireUsageNotice,usageNoticeBody} from './usage-notice.js?v=1';
await requireUsageNotice();
import {createSolo} from './solo.js?v=20260927-caption';
import {mountSubmission,disposeSubmission} from './submission.js?v=selfhost-1';
import {freshSelection,orderedMembers} from './session.js';
import { createPoster } from './poster.js?v=20260926-poster-url';
import { gameFromSelection, candidates, transition, shuffle, isSortingGame } from './game.js?v=20260926-winner-tree';
import { renderCustom } from './custom-ui.js';
import { renderSelection, filterMembers, memberCity } from './selection.js?v=20260927-stage-heading';
import { loadLocalMembers, publicRanking, resultPhoto, readPhoto, clearLocalData } from './local-members.js?v=20260926-supplement';
const app = document.querySelector('#app');
const KEY = 'chekimate-faces-v1';
let mode='dd',solo;
const modeTabs=()=>`<div class="mode-tabs" role="tablist" aria-label="选择模式"><button role="tab" id="mode-dd" aria-controls="mode-panel" aria-selected="${mode==='dd'}" tabindex="${mode==='dd'?0:-1}" data-action="mode" data-mode="dd">誰でも</button><button role="tab" id="mode-solo" aria-controls="mode-panel" aria-selected="${mode==='solo'}" tabindex="${mode==='solo'?0:-1}" data-action="mode" data-mode="solo">君だけ</button></div>`;

let sessionActive=false,posterFile=null,posterUrl=null;
let posterLayout='grid',posterToken=0;
let catalog, idols, byId, game, metric = 'top9', rankingData, routeVersion = 0, localMembers=[], officialIds, photoOverrides={}, selection={ids:[],query:'',city:'',page:0};
function refreshMembers() { idols=[...catalog.idols,...localMembers];byId=Object.fromEntries(idols.map(i=>[i.id,i])); }
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const image = (id, extra = '') => `<img src="${esc(byId[id].pic)}" alt="${esc(byId[id].name)}" ${extra}>`;
const resultImage = id => `<img src="${esc(resultPhoto(byId[id],photoOverrides))}" alt="${esc(byId[id].name)}">`;
const label = id => `${esc(byId[id].name)}<small>${esc(byId[id].group)}${byId[id].local?' · 本机':''}</small>`;
const primary = (text, action, disabled = false) => `<button class="primary" data-action="${action}" ${disabled ? 'disabled' : ''}>${text}</button>`;
function toast(text) { const el = document.querySelector('#toast'); el.textContent = text; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 4000); }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(game)); } catch { toast('浏览器存储不可用，请在离开前保存结果图片'); } }
function selectionView(){renderSelection({app,members:orderedMembers(idols,selection.order),esc,image,state:selection,toast,onState:state=>{selection=state;try{localStorage.setItem('chekimate-selection',JSON.stringify(selection));}catch{}},onComplete:ids=>{
  const dialog=document.createElement('dialog');dialog.className='clear-dialog';
  dialog.innerHTML='<form method="dialog"><h2>进入两两 PK 排序</h2><p>确认后将开始两两比较，无法返回预选阶段调整已选成员。</p><div class="actions"><button class="secondary" value="cancel">取消</button><button class="primary" value="confirm">确认进入</button></div></form>';
  document.body.append(dialog);
  dialog.addEventListener('close',()=>{const proceed=dialog.returnValue==='confirm';dialog.remove();if(proceed){game=gameFromSelection(ids);persist();location.hash='play';}});
  dialog.showModal();
}});}
async function api(path, body) { const r = await fetch('/api/' + path, body ? { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) } : {}); const result = await r.json(); if (!r.ok) throw Object.assign(new Error(result.error || '请求失败'),{status:r.status,retryAfter:result.retryAfter}); return result; }
function demo() { return catalog.demo ? '<div class="demo">框架预览 · 当前为虚构演示数据</div>' : ''; }
function home() {
  if(mode==='solo'&&solo){solo.home(modeTabs());return;}
  const resumable = game ? !['ready','result'].includes(game.stage) : Boolean(selection.order?.length || selection.ids.length);
  const finished = Boolean(game && game.stage==='result');
  const hasRecords = Boolean(game || selection.order?.length || selection.ids.length || localMembers.length || Object.keys(photoOverrides).length);
  app.innerHTML = `${modeTabs()}<section id="mode-panel" role="tabpanel" aria-labelledby="mode-dd" class="hero"><div>${demo()}<h1>那张面孔，<br><em>毋庸置疑。</em></h1><p class="intro">浏览全部，或者定制筛选，支持自定义上传，<br>制作你的中国大陆地下偶像推颜九选。</p><p class="intro home-data-note">当前为虚构示意名单，人物和团体均不对应真实对象。</p><div class="numbers"><div><strong>${idols.length}</strong><small>位候选成员</small></div><div><strong>${new Set(idols.flatMap(memberGroups)).size}</strong><small>个偶像团体</small></div><div><strong>9</strong><small>个你的选择</small></div></div><div class="actions">${primary('开始选择 <span>↗</span>','start',idols.length < 9)}${resumable ? '<button class="text-btn" data-action="resume">继续上次</button>' : finished ? '<button class="text-btn" data-action="last-result">上次结果</button>' : ''}${hasRecords?'<button class="text-btn" data-action="clear-records">清除记录</button>':''}</div><div class="home-custom"><a href="#custom"><span class="home-custom-icon" aria-hidden="true">＋</span><span>添加自定义成员</span></a><p class="home-local-note">资料和照片仅保存在本机</p></div>${idols.length < 9 ? '<p class="error">名单至少需要 9 位成员才能开始。</p>' : ''}</div><div class="hero-sheet home-poster" role="img" aria-label="随机成员九宫格示例"><p class="tiny">正在生成九宫格预览…</p></div></section><section class="how" aria-label="玩法"><div class="how-item"><span>01</span><div><b>搜索成员</b><p>按省级行政区筛选，搜团名或人名，预选你喜欢的颜。</p></div></div><div class="how-item"><span>02</span><div><b>两两 PK 排序</b><p>两两比较谁的颜更合你意，排出最喜欢的九位。</p></div></div><div class="how-item"><span>03</span><div><b>保存与分享</b><p>分享你的颜偏好，也可按需更换成员照片。</p></div></div></section>`;
  const preview=app.querySelector('.home-poster'),sample=shuffle(catalog.idols).slice(0,9);
  preview.dataset.memberIds=sample.map(m=>m.id).join(',');
  preview.setAttribute('aria-label',`随机成员九宫格示例：${sample.map(m=>m.name).join('、')}`);
  createPoster(sample.map(m=>m.id),byId,{}, {layout:'grid',demo:true,footer:false}).then(({canvas})=>{
    if(preview.isConnected){canvas.setAttribute('aria-hidden','true');preview.replaceChildren(canvas);}
  }).catch(()=>{if(preview.isConnected)preview.innerHTML='<p class="tiny">图片预览暂时无法加载，请刷新重试。</p>';});
}
function gameView() {
  if (!game) { location.hash = ''; return; }
  if (game.stage === 'result') return resultView(game.ranking);
  if (game.stage === 'ready') return readyView();
  const ids = candidates(game), picks = game.picks || [], stage = game.stage, isMain=stage==='main'||stage==='rescue';
  const sorting=isSortingGame(game);
  const step = game.pk ? 1 : ['prelim','supplement'].includes(stage) ? 0 : isMain ? 1 : 2;
  const total = Math.ceil(game.order.length / 9);
  const progress = sorting ? game.answers.length/game.maxComparisons : game.pk ? game.ranking.length/9 : step === 0 ? (stage === 'supplement' ? 1 : game.page/total) : step === 1 ? ((game.round-1)*game.groups.length+game.page)/(game.rounds*game.groups.length) : game.ranking.length/9;
  const counter = sorting ? `已比较 ${game.answers.length} 次 · 最多 ${game.maxComparisons} 次` : stage === 'prelim' ? `${game.page+1} / ${total} 页` : stage === 'supplement' ? `还需 ${Math.max(0,9-game.selected.length-picks.length)} 人` : isMain ? `${stage==='rescue'?'晋级加赛 · ':''}${game.round} / ${game.rounds} 轮 · ${game.page+1} / ${game.groups.length} 组` : `已确定 ${game.ranking.length} / 9 位`;
  const title = stage === 'final' ? `这两位，你更喜欢谁的颜？` : isMain ? (stage==='rescue'?'晋级加赛':'按颜的喜好顺序选出两人') : stage === 'supplement' ? '补选成员' : '选择这一组中你喜欢的颜';
  const subtitle = sorting ? '点击你更喜欢的颜，按你的喜好排出前九名。' : stage === 'final' ? `正在选出第 ${game.ranking.length+1} 名。点击你更喜欢的颜，进入下一组。` : isMain ? (stage==='rescue'?'前 10 人已晋级；从晋级线附近的成员中再选出 8 人。':'按颜的喜好顺序选择两人。完成三轮比较后进入晋级加赛。') : stage === 'supplement' ? '之前选择不足 9 人，从未入选的成员中补选。' : '选几位都可以；也可以不选，直接进入下一组。';
  const enabled = stage === 'prelim' || (stage === 'supplement' && game.selected.length+picks.length>=9) || (isMain && picks.length===Math.min(2,ids.length));
  const gameHeader = game.pk ? `<div class="workflow-heading"><h1>第二轮 · PK 排序</h1><span class="counter">${counter.split(' · ').map(part=>`<span>${esc(part)}</span>`).join('')}</span></div><h2 class="pk-prompt">这两位，你更喜欢谁的颜？</h2>` : `<div class="game-top"><span class="kicker pink" style="margin:0">浏览比较</span><button class="text-btn" data-action="pause">保存并退出 ↗</button></div><div class="steps" aria-label="选择阶段">${['01 预选','02 复选','03 决赛'].map((s,i)=>`<span class="${i===step?'current':''}" ${i===step?'aria-current="step"':''}>${s}</span>`).join('')}</div><div class="progress" role="progressbar" aria-label="当前阶段进度" aria-valuenow="${Math.round(progress*100)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${progress*100}%"></div></div><div class="game-heading"><div><h1>${title}</h1><p>${subtitle}</p></div><span class="counter">${counter}</span></div>`;
  app.innerHTML = `<section class="game ${game.pk?'pk-game':''}">${gameHeader}<div class="candidate-grid ${stage==='final'?'duel':isMain?'quad':''}">${ids.map(id=>`<button class="candidate ${picks.includes(id)?'selected':''}" data-id="${esc(id)}" data-action="pick" aria-pressed="${picks.includes(id)}" aria-label="选择 ${esc(byId[id].name)}（${esc(byId[id].group)}）">${image(id)}<span class="tick">${picks.includes(id)?(isMain?picks.indexOf(id)+1:'✓'):''}</span><strong>${esc(byId[id].name)}</strong><small>${esc(byId[id].group)}</small></button>`).join('')}</div><div class="game-bar"><button class="text-btn" data-action="back" ${!game.history?.length?'disabled':''}>← 上一步</button><span>${stage==='final'?'请选择一位':`本页已选 <strong>${picks.length}</strong> 人`}</span>${stage==='final'?(game.pk?'<button class="text-btn" data-action="pause">保存并退出 ↗</button>':'<span class="tiny">点击照片选择</span>'):primary(stage==='prelim'&&game.page+1<total?'下一组 →':isMain?'确认选择 →':'进入下一阶段 →','next',!enabled)}</div><p class="tiny center">${catalog.demo?'演示成员仅用于体验流程 · ':''}选择进度自动保存在此浏览器</p></section>`;
}
function readyView() {
  const winner = game.ranking[0];
  if(!catalog.reviews_enabled){game.stage='result';persist();resultView(game.ranking);return;}
  if(game.ranking.some(id=>byId[id].local)){
    app.innerHTML=`<section class="page center"><h1>你最喜欢的颜</h1>${image(winner,'class="winner"')}<h2>${esc(byId[winner].name)}</h2><p class="page-intro">这一轮包含你添加的自定义成员。<br>自定义资料、照片和完整组合只保存在本机，可以直接生成图片。</p><div class="actions" style="justify-content:center;margin-top:24px">${primary('查看我的九宫格 →','local-result')}</div><p class="tiny">最终九选包含自定义成员时，整份名单不计入公共排行。</p></section>`;
    return;
  }
  app.innerHTML = `<section class="page center"><h1>你最喜欢的颜</h1><p class="page-intro">你的推颜九选已确定，先揭晓你最喜欢的颜。</p>${image(winner,'class="winner"')}<h2>${esc(byId[winner].name)}</h2><p class="tiny">${esc(byId[winner].group)}</p><form id="review-form" class="review-box" style="text-align:left"><label for="review-body"><b>这位成员的颜，哪里最让你喜欢？</b><br>写下 2–300 字评价后，即可查看完整九宫格。</label><textarea id="review-body" name="body" minlength="2" maxlength="300" required placeholder="写下你喜欢的五官、笑容或神态…">${esc(game.draft||'')}</textarea><label><input type="checkbox" name="consent" required> 我同意匿名公开这条评价，不包含个人隐私或攻击性内容。</label>${primary('发表评价，查看我的 9 选 →','submit-review')}<p class="tiny">${catalog.demo?'本地预览：评价与排行仅写入本地数据库。':'评价会显示在该成员的页面。'}</p><p id="form-error" class="error" hidden></p></form><button class="text-btn" data-action="undo-final">← 返回，调整最后一次选择</button></section>`;
  app.querySelector('textarea').addEventListener('input', e => { game.draft=e.target.value; persist(); });
  app.querySelector('form').addEventListener('submit', submitReview);
}
async function saveRun() { if(!game.runId){game.runId=crypto.randomUUID();persist();} const ranking=publicRanking(game.ranking,officialIds);if(!ranking)return false;const session=await api('submission-session',{id:game.runId,ranking});return api('results',{id:game.runId,ranking,submissionToken:session.token}); }
async function submitReview(e) {
  e.preventDefault(); const form = e.target, button = form.querySelector('button'); button.disabled=true; button.textContent='正在保存…';
  try { await saveRun(); await api('reviews',{runId:game.runId,body:form.elements.body.value,consent:form.elements.consent.checked}); game.stage='result'; game.draft=''; persist(); resultView(game.ranking); window.scrollTo(0,0); }
  catch(err) { const out=form.querySelector('#form-error'); out.hidden=false; out.textContent=err.message; button.disabled=false; button.textContent='重试发表评价'; }
}
function resultView(ids, mode = 'live') {
  disposeSubmission();
  const editing=app.querySelector('.photo-editor')?.open || false;
  const title={live:'你的推颜九选已生成',shared:'分享的推颜九选',own:'上次的推颜九选结果'}[mode];
  const status={shared:'分享的结果不会重复计入排行榜。',own:'重复进入过往结果，不会重复提交至“大家的选择”。'}[mode];
  app.innerHTML = `<section class="page center"><h1>${title}</h1><p class="page-intro">保存或分享你最喜欢的颜，也可按需更换成员照片。</p><div class="poster-switch" role="group" aria-label="图片版式"><button data-action="poster-layout" data-layout="grid" aria-pressed="${posterLayout==='grid'}">布局一</button><button data-action="poster-layout" data-layout="podium" aria-pressed="${posterLayout==='podium'}">布局二</button><button data-action="poster-layout" data-layout="center" aria-pressed="${posterLayout==='center'}">布局三</button></div><div id="poster-preview" class="poster-preview" aria-live="polite"><p class="tiny">正在生成图片预览…</p></div><div class="actions export-actions" style="justify-content:center"><button class="primary" data-action="share-image" disabled>分享当前图片 ↗</button>${primary('保存图片 ↓','export')}<button class="text-btn" data-action="start">重新选择 →</button></div><p class="tiny">手机可长按保存，电脑可右键保存</p><div id="ranking-status" class="submission-status">${mode==='live'?'正在确认提交状态…':`<p class="tiny" role="status">${status}</p>`}</div><p id="export-error" class="error" hidden></p><div id="export-output"></div>${mode!=='shared'?'<div id="sort-record"></div>':''}<details class="photo-editor" ${editing?'open':''}><summary>更换成员照片</summary><p class="tiny">替换照片仅用于本次结果，重新选择或下次打开时恢复默认图。</p><ol class="photo-edit-list">${ids.map((id,i)=>`<li><span class="photo-edit-rank">${String(i+1).padStart(2,'0')}</span>${resultImage(id)}<div class="photo-edit-name"><b>${esc(byId[id].name)}</b><small>${esc(byId[id].group)}</small><span>${byId[id].local?'自定义成员':photoOverrides[id]?'已替换照片':'默认照片'}</span></div><div class="photo-edit-actions"><label class="photo-upload">上传照片<input type="file" data-photo-id="${esc(id)}" aria-label="更换 ${esc(byId[id].name)} 的照片" accept="image/jpeg,image/png,image/webp,image/gif"></label><button class="restore-photo" data-action="restore-photo" data-id="${esc(id)}" aria-label="恢复 ${esc(byId[id].name)} 的默认照片" ${photoOverrides[id]?'':'disabled'}>重设照片</button></div></li>`).join('')}</ol><p class="tiny">含自定义成员或替换照片时，导出图片底部会注明“部分或全部内容由用户上传”。</p></details></section>`;
  app.dataset.result=JSON.stringify(ids);app.dataset.mode=mode;
  mountSortRecord(app.querySelector('#sort-record'),game?.ranking?.length===ids.length&&game.ranking.every((id,i)=>id===ids[i])?game:null,byId);
  previewPoster(ids);
  if(mode==='live'){
    if(!game.runId){game.runId=crypto.randomUUID();persist();}
    const runId=game.runId,ranking=publicRanking(ids,officialIds);
    const container=app.querySelector('#ranking-status');container.dataset.runId=runId;
    mountSubmission({container,eligible:Boolean(ranking),runId,api,savedState:game.submissionState,
      remember:message=>{if(game?.runId===runId){game.submissionState=message;persist();}},
      createSession:()=>api('submission-session',{id:runId,ranking}),
      submit:submissionToken=>api('results',{id:runId,ranking,submissionToken})});
  }
}
function refreshResultPhoto(id,ids){
  const input=[...app.querySelectorAll('[data-photo-id]')].find(el=>el.dataset.photoId===id);
  const row=input?.closest('li');
  if(row){row.querySelector('img').src=resultPhoto(byId[id],photoOverrides);row.querySelector('.photo-edit-name span').textContent=byId[id].local?'自定义成员':photoOverrides[id]?'已替换照片':'默认照片';row.querySelector('.restore-photo').disabled=!photoOverrides[id];input.disabled=false;input.value='';}
  previewPoster(ids);
}
async function previewPoster(ids){
  const token=++posterToken,layout=posterLayout,container=app.querySelector('#poster-preview');
  posterFile=null;const shareButton=app.querySelector('[data-action=share-image]');if(shareButton)shareButton.disabled=true;
  try{const {canvas,missing}=await createPoster(ids,byId,photoOverrides,{layout,demo:catalog.demo});
    if(token!==posterToken||!container.isConnected)return;
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('图片生成失败');
    if(token!==posterToken||!container.isConnected)return;
    const url=URL.createObjectURL(blob),img=new Image();img.alt=layout==='grid'?'九宫格图片预览':'突出前三名的图片预览';img.src=url;
    await img.decode();if(token!==posterToken||!container.isConnected){URL.revokeObjectURL(url);return;}
    if(posterUrl)URL.revokeObjectURL(posterUrl);posterUrl=url;
    posterFile=new File([blob],`推颜九选-${layout==='grid'?'九宫格':'前三名'}.png`,{type:'image/png'});
    container.replaceChildren(img);if(shareButton)shareButton.disabled=false;
    if(missing){const note=document.createElement('p');note.className='tiny';note.textContent=`${missing} 张照片无法读取，导出时将使用占位图。`;container.append(note);}
  }catch{if(container.isConnected)container.textContent='预览暂时无法生成，请重试或更换照片。';}
}
async function exportImage(button,layout='grid') {
  const original=button.textContent;button.disabled=true;button.textContent='正在制作图片…';
  const output=app.querySelector('#export-output'),error=app.querySelector('#export-error');error.hidden=true;
  try{
    const ids=JSON.parse(app.dataset.result),{canvas,missing}=await createPoster(ids,byId,photoOverrides,{layout,demo:catalog.demo});
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('图片生成失败');
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`推颜九选-${layout==='grid'?'九宫格':'前三名'}.png`;a.click();
    if(exportImage.url)URL.revokeObjectURL(exportImage.url);exportImage.url=url;
    if(output.isConnected)output.innerHTML=`<p class="tiny">图片已生成；如未自动下载，可<a href="${url}" target="_blank" rel="noopener">打开图片保存</a>。</p>`;
    toast(missing?`${missing} 张照片无法读取，已使用占位图`:'图片已生成');
  }catch(err){if(error.isConnected){error.hidden=false;error.textContent='导出失败：'+err.message;}}
  finally{button.disabled=false;button.textContent=original;}
}
async function rankingView(version) {
  const labels={top9:"进入九选",first:"成为第一"};
  app.innerHTML=`<section class="page ranking-page"><div class="page-head"><div><h1># 大家的选择</h1><p class="page-intro">看看大家喜欢的颜！</p><p class="ranking-disclaimer">排名仅为基于本站数据的娱乐性质，并无其他实际意义。</p><p class="tiny">仅统计已提交且全部来自固定名单的九选结果。</p></div><div class="tabs"><button data-action="metric" data-metric="top9" class="${metric==='top9'?'active':''}">${labels.top9}</button><button data-action="metric" data-metric="first" class="${metric==='first'?'active':''}">${labels.first}</button></div></div>${demo()}<h2 class="section-title" id="ranking-metric-title">${labels[metric]}</h2><div id="rankings" aria-labelledby="ranking-metric-title"><p class="loading">正在读取排行…</p></div></section>`;
  try { rankingData=await api('ranking?metric='+metric);if(version!==routeVersion)return;app.querySelector('#rankings').innerHTML=rankingData.rankings.length?`<p class="tiny">已记录 ${rankingData.total} 份选择 · 每次完成并成功提交均计入统计</p>${rankingData.rankings.map((r,i)=>`<a class="rank-row${i<3?' rank-top':''}" href="#idol/${encodeURIComponent(r.id)}"><span class="rank">${String(i+1).padStart(2,'0')}</span>${image(r.id)}<div><strong>${esc(byId[r.id].name)}</strong><small>${esc(byId[r.id].group)}</small></div><span class="count">${r.count} <small>次</small></span><span>↗</span></a>`).join('')}`:'<div class="empty">还没有符合条件的已提交结果。<br>九位成员均来自固定名单时，结果才会计入排行榜。</div>'; }
  catch(err){if(version===routeVersion)app.querySelector('#rankings').innerHTML=`<p class="error">${esc(err.message)} <button class="text-btn" data-action="retry">重试</button></p>`;}
}
async function profileView(id,version) {
  const idol=byId[id];if(!idol){app.innerHTML='<section class="page"><h1>这位成员暂未收录</h1><a href="#ranking">返回成员列表 →</a></section>';return;}
  const showReviews=catalog.reviews_enabled&&!idol.local;
  app.innerHTML=`<section class="page" style="max-width:700px"><a class="tiny" href="#ranking">← 大家的选择</a><div class="profile">${image(id)}<div><h1>${esc(idol.name)}</h1><p class="page-intro">${esc(idol.group)} · ${esc(memberCity(idol))}</p>${idol.weibo_link?`<a class="secondary" style="margin-top:18px" href="${esc(idol.weibo_link)}" target="_blank" rel="noopener noreferrer">查看成员微博 ↗</a>`:'<p class="tiny">微博资料待补充</p>'}</div></div>${showReviews?'<h2 class="section-title">成员评价</h2><p class="tiny">完成九选后，可以为你最喜欢的颜写下评价。</p><div id="reviews"><p class="loading">正在读取评价…</p></div>':''}</section>`;
  if(!showReviews)return;
  try {const data=await api('reviews?id='+encodeURIComponent(id));if(version!==routeVersion)return;app.querySelector('#reviews').innerHTML=data.reviews.length?data.reviews.map(r=>`<article class="review"><p>${esc(r.body)}</p><div class="review-meta"><span>匿名评价 · ${esc(r.created_at.slice(0,10))}</span><button class="text-btn" data-action="report" data-id="${esc(r.id)}">举报不当内容</button></div></article>`).join(''):'<div class="empty">还没有评价，完成九选后可为第一名写评价。</div>';}catch(err){if(version===routeVersion)app.querySelector('#reviews').innerHTML=`<p class="error">${esc(err.message)} <button class="text-btn" data-action="retry">重试</button></p>`;}
}
function about() {app.innerHTML=`<section class="page prose"><h1>玩法与说明</h1><h2>使用须知</h2>${usageNoticeBody}<h2>DD版（誰でも）怎么选人？</h2><p>在选人页按省级行政区筛选，输入团名或人名搜索。不同省级行政区、团体的成员可以混选，已选人员不会因切换筛选丢失。按你对颜的喜好，第一轮预选至少九位成员，再进入第二轮两两 PK，选出最喜欢的九位并排序；结果页可为每位成员上传本机替换照片或恢复默认图。替换图不会上传服务器，不改变公共排名。搜索和筛选可随时打开，收起后保留筛选结果；点击「返回全部」恢复原来的浏览页。预选结束后点击「进入 PK」。不足九位时需要继续补选；即使恰好九位，也会通过 PK 决定排名。</p><h2>单推版（君だけ）怎么玩？</h2><p>填写名字，添加同一个人的 9–30 张照片，通过两两 PK 选出最喜欢的九个瞬间。照片可填写备注、调整取景重心；结果可生成九宫格或突出前三名的图片。名字、照片和进度仅保存在本机，单推版（君だけ）不加载榜单验证、不提交排行榜。两个模式分别保存，重新选择或清除记录只影响当前模式。只有尚未完成的选择会显示“继续上次”。</p><h2>PK 怎么排序？</h2><p>每次展示两位预选成员，点击你更喜欢的颜。按稳定、可传递的颜偏好排序：若你更喜欢 A 的颜而非 B，又更喜欢 B 的颜而非 C，就会沿用 A、B、C 的先后顺序，无需重复询问。系统会根据预选人数安排比较：人数较少时确定完整顺序，人数较多时只排出前九名，减少 PK 次数。九位成员最多需要 19 次 PK，三十位最多 61 次（不含撤销后重选）。预选时的点击顺序不等于最终排名。可以返回上一步修改选择，进度自动保存在当前浏览器。</p><h2>结果和评价</h2><p>九位成员均来自固定名单时，结果会提交到排行榜；包含自定义成员时，整份名单不提交。两种情况均可保存或分享图片。${catalog.reviews_enabled?'本站已开启评价模式：纯固定名单的结果需先为第一名发表 2–300 字的匿名评价。':'本站未开放公开评价。'}图片底部标注网站主页网址。</p><h2>排行榜怎么统计？</h2><p>每次重新完成九选并成功提交，都会新增一份记录；名单和顺序相同也可再次计入。入选次数和第一名次数分别统计。同一浏览器每分钟最多成功提交一份结果，不设 IP 每日次数上限。API 请求另有短时频率限制，排行榜最多延迟约30秒更新。同一次提交的网络重试不会重复计票。选人和图片生成次数不受限制。含自定义成员的结果不提交，也不占用次数。榜单反映参与者对颜的个人喜好，不代表成员的综合评价。更换浏览器或清除 Cookie 后无法识别为同一个访问者。</p><h2>自定义成员</h2><p>通过分字段表单添加成员：名字、团体、省级行政区、照片及选填的微博链接。自定义资料只保存在当前浏览器，不上传数据库，也不计入公共排行。只要最终九选包含自定义成员，整份名单都不提交到“大家的选择”。仅替换固定成员的照片不影响统计。含自定义成员的结果仍可保存或分享图片。可导出备份，在清除浏览器数据前保存。</p><h2>数据与隐私</h2><p>${catalog.demo?'目前的名字、团体和照片均为演示占位，等待正式资料补充。':''}选择进度保存在当前浏览器。匿名浏览器标识和每次提交的九选结果保存在服务端；限流记录仅使用匿名浏览器标识和提交时间，不保存 IP 或 IP 摘要，超过 48 小时的限流记录会在后续提交时清理。提交榜单不要求填写姓名、手机号或登录信息；短时限流仅在服务器内存中处理网络地址。${catalog.reviews_enabled?'评价草稿保存在当前浏览器，提交后公开显示；已提交评价和举报记录保存在服务端。请勿提交个人隐私、传闻或人身攻击，可通过评价旁的举报按钮反馈不当内容。':''}</p><p>玩法参考 <a href="https://oshi-torisetsu.com/sukigao-girls" target="_blank" rel="noopener noreferrer">女ドル好き顔9選</a>。本项目为独立实现，未使用原站成员数据与照片。</p><a class="primary" href="#">开始我的 9 选 →</a></section>`;}
function customView(){renderCustom({app,members:localMembers,esc,image,toast,onChange:(members,removed)=>{localMembers=members;if(removed)selection.ids=selection.ids.filter(id=>id!==removed);if(removed&&game?.order.includes(removed)){game=null;persist();}refreshMembers();customView();}});}
function route() {
  solo?.leave();
  disposeSubmission();
  if(!idols)return;
  const version=++routeVersion;let hash=location.hash.slice(1);
  if(!solo?.active&&hash.startsWith('solo-')){mode='dd';history.replaceState(null,'',location.pathname+location.search+'#');hash='';}
  if(!sessionActive&&['select','play'].includes(hash)){history.replaceState(null,'',location.pathname+location.search+'#');hash='';}
  document.querySelector('#nav-play').classList.toggle('active',!hash||hash==='play'||hash==='select');document.querySelector('#nav-ranking').classList.toggle('active',hash==='ranking'||hash.startsWith('idol/'));
  for(const link of document.querySelectorAll('header nav a')){if(link.classList.contains('active'))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
  // Keep preselection sizing compatible with browsers without CSS :has().
  document.body.classList.toggle('is-selecting',hash==='select');
  delete app.dataset.result;
  if(hash.startsWith('solo-')){mode='solo';solo.render(hash);}else if(hash==='select')selectionView();else if(hash==='play')gameView();else if(hash==='ranking')rankingView(version);else if(hash==='about')about();else if(hash==='custom')customView();else if(hash.startsWith('idol/')) {try{profileView(decodeURIComponent(hash.slice(5)),version)}catch{home()}}
  else if(hash.startsWith('share/')){try{const ids=JSON.parse(decodeURIComponent(hash.slice(6)));if(!Array.isArray(ids)||ids.length!==9||new Set(ids).size!==9||ids.some(id=>!byId[id]))throw new Error();resultView(ids,'shared');}catch{app.innerHTML='<section class="page"><h1>这份分享暂时无法打开</h1><p class="page-intro">链接不完整，或其中的成员已不在当前名单中。</p><a class="secondary" href="#">制作自己的 9 选</a></section>';}}
  else home();
  window.scrollTo(0,0);
}
app.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const action=b.dataset.action;
  try{
    if(action==='mode'){mode=b.dataset.mode;home();app.querySelector('#mode-'+mode)?.focus();return;}
    if(action==='clear-records'){
      const dialog=document.createElement('dialog');dialog.className='clear-dialog';dialog.innerHTML=`<form method="dialog"><h2>清除记录</h2><p>清除当前浏览器保存的预选、PK 进度和上次结果。</p><label><input type="checkbox" name="photos"> 同时删除自定义成员和替换照片</label><p class="tiny">此操作无法撤销，公共排行榜记录不受影响。</p><div class="actions"><button class="secondary" value="cancel">取消</button><button class="primary" value="clear">确认清除</button></div></form>`;
      document.body.append(dialog);dialog.addEventListener('close',async()=>{try{if(dialog.returnValue==='clear'){if(dialog.querySelector('[name=photos]').checked){await clearLocalData();localMembers=[];photoOverrides={};refreshMembers();}localStorage.removeItem(KEY);localStorage.removeItem('chekimate-selection');game=null;photoOverrides={};selection={ids:[],order:[],page:0,query:'',city:''};sessionActive=false;posterToken++;posterFile=null;if(posterUrl){URL.revokeObjectURL(posterUrl);posterUrl=null;}if(exportImage.url){URL.revokeObjectURL(exportImage.url);exportImage.url=null;}home();toast('记录已清除');}}catch(err){toast(err.message);}finally{dialog.remove();}});dialog.showModal();
    }
    if(action==='share-image'){
      if(!posterFile)return toast('图片正在生成，请稍后再试');
      if(navigator.canShare?.({files:[posterFile]})){try{await navigator.share({files:[posterFile],title:'我的推颜九选'});}catch(err){if(err.name!=='AbortError')toast('分享暂不可用，请长按或右键保存预览图片');}}
      else{window.open(posterUrl,'_blank','noopener');toast('可长按或右键保存图片，再分享给朋友');}
    }
    if(action==='start'){photoOverrides={};sessionActive=true;selection=freshSelection(idols.map(i=>i.id));game=null;persist();try{localStorage.setItem('chekimate-selection',JSON.stringify(selection));}catch{}if(location.hash==='#select')route();else location.hash='select';}
    if(action==='resume'){if(game&&['ready','result'].includes(game.stage)){home();return;}sessionActive=true;location.hash=game?'play':'select';}
    if(action==='return-selection'){if(!selection.order?.length)selection=freshSelection(idols.map(i=>i.id));sessionActive=true;location.hash='select';}
    if(action==='local-result'){game.stage='result';persist();resultView(game.ranking);}
    if(action==='last-result'){resultView(game.ranking,'own');}
    if(action==='pause'){persist();location.hash='';toast('已保存，下次回来可以继续');}
    if(action==='pick'){
      const id=b.dataset.id;
      if(game.stage==='final'){game=transition(game,[id]);persist();gameView();}
      else{const picks=game.picks||[];if(picks.includes(id))game.picks=picks.filter(i=>i!==id);else if(!['main','rescue'].includes(game.stage)||picks.length<Math.min(2,candidates(game).length))game.picks=[...picks,id];else return toast('已选两人，可先取消一位再选');persist();const y=window.scrollY;gameView();[...app.querySelectorAll('[data-action=pick]')].find(button=>button.dataset.id===id)?.focus({preventScroll:true});window.scrollTo(0,y);}
    }
    if(action==='next'){game=transition(game,game.picks||[]);persist();gameView();window.scrollTo(0,0);}
    if(action==='back'||action==='undo-final'){const history=[...(game.history||[])];const previous=history.pop();if(previous){game={...previous,history};persist();gameView();}}
    if(action==='metric'){metric=b.dataset.metric;route();}
    if(action==='retry')route();
    if(action==='edit-selection'){sessionActive=true;selection.ids=JSON.parse(app.dataset.result);game=null;persist();location.hash='select';}
    if(action==='restore-photo'){const ids=JSON.parse(app.dataset.result);delete photoOverrides[b.dataset.id];refreshResultPhoto(b.dataset.id,ids);toast('已恢复默认照片');}
    if(action==='export')await exportImage(b,posterLayout);
    if(action==='poster-layout'){posterLayout=b.dataset.layout;for(const control of app.querySelectorAll('[data-action=poster-layout]'))control.setAttribute('aria-pressed',String(control===b));previewPoster(JSON.parse(app.dataset.result));}
    if(action==='report'){b.disabled=true;await api('report',{reviewId:b.dataset.id});b.textContent='已举报';toast('举报已记录，等待运营者处理');}
  }catch(err){toast(err.message);if(action==='report')b.disabled=false;}
});
app.addEventListener('change',async e=>{
  const input=e.target;if(!input.matches('[data-photo-id]')||!input.files[0])return;
  const id=input.dataset.photoId,ids=JSON.parse(app.dataset.result),version=routeVersion;
  input.disabled=true;
  try{const pic=await readPhoto(input.files[0]);if(version!==routeVersion)return;photoOverrides[id]=pic;if(version===routeVersion){refreshResultPhoto(id,ids);}toast('照片已替换，仅本次生效');}
  catch(err){toast(err.message);input.disabled=false;input.value='';}
});
app.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&!e.target.dataset.fallback){e.target.dataset.fallback='true';e.target.src='/images/fallback.svg';}},true);
app.addEventListener('keydown',e=>{if(e.target.getAttribute('role')==='tab'&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'dd':e.key==='End'?'solo':mode==='dd'?'solo':'dd';app.querySelector('#mode-'+next).click();}});
window.addEventListener('hashchange',route);
document.querySelector('header').addEventListener('click',e=>{
  const a=e.target.closest('a[href="#"]');
  if(!a)return;
  if(location.hash===''||location.hash==='#'){e.preventDefault();route();}
});
try{
  try{const stored=JSON.parse(localStorage.getItem('chekimate-selection'));if(stored&&Array.isArray(stored.ids))selection={ids:stored.ids,order:Array.isArray(stored.order)?stored.order.filter(id=>typeof id==='string'):[],query:typeof stored.query==='string'?stored.query:'',city:typeof stored.city==='string'?stored.city:'',page:Number.isInteger(stored.browsePage)?stored.browsePage:(Number.isInteger(stored.page)?stored.page:0)};}catch{}
  const r=await fetch('/data/idols.json');if(!r.ok)throw new Error('候选名单加载失败');catalog=await r.json();officialIds=new Set(catalog.idols.map(i=>i.id));try{localMembers=await loadLocalMembers();}catch{toast('本地自定义资料暂时无法读取');}refreshMembers();
  try{game=JSON.parse(localStorage.getItem(KEY));if(game&&(game.version!==1||!Array.isArray(game.order)||game.order.some(id=>!byId[id])||!['prelim','supplement','main','rescue','final','ready','result'].includes(game.stage)))game=null;}catch{game=null;}
  solo=await createSolo({app,esc,toast,home});
  route();
}catch(err){app.innerHTML=`<section class="page"><h1>暂时无法载入名单</h1><p class="error">${esc(err.message)}</p><a class="secondary" href="/">重新加载</a></section>`;}

if(new URLSearchParams(location.search).get('debug')==='images'){
  import('./image-diagnostics.js?v=20260926-card-layout').then(({mountImageDiagnostics})=>mountImageDiagnostics()).catch(()=>{});
}
