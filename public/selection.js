import {memberRegion,memberRegions,memberGroups} from './regions.js?v=20260926-supplement';
export const memberCity = member => memberRegions(member).join(" / ");
export function filterMembers(members,{query='',city='',province=city,provinces,source='all',group=''}={}) {
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const retained=Array.isArray(provinces)?new Set(provinces.map(province=>memberRegion({province}))):null;
  return members.filter(m=>(retained?memberRegions(m).some(r=>retained.has(r)):(!province||memberRegions(m).includes(memberRegion({province}))))&&(source==='all'||(source==='custom'?Boolean(m.local):!m.local))&&(!group||memberGroups(m).includes(group))&&terms.every(t=>`${m.name} ${m.group} ${(m.aliases||[]).join(" ")}`.toLocaleLowerCase().includes(t)));
}
export function moveSelection(ids,index,offset){const next=[...ids],other=index+offset;if(index<0||other<0||index>=next.length||other>=next.length)return next;[next[index],next[other]]=[next[other],next[index]];return next;}
export function renderSelection({app,members,esc,image,state,onState,onComplete,toast}) {
  state.ids=state.ids.filter(id=>members.some(m=>m.id===id));
  let searching=false, browsePage=state.browsePage ?? state.page ?? 0, searchPage=0;
  state.query='';state.city='';state.source='all';state.page=browsePage;
  const byId=Object.fromEntries(members.map(m=>[m.id,m]));
  const provinceCounts=new Map();
  for(const member of members)for(const province of memberRegions(member))provinceCounts.set(province,(provinceCounts.get(province)||0)+1);
  const cities=[...provinceCounts.keys()].sort((a,b)=>provinceCounts.get(b)-provinceCounts.get(a)||a.localeCompare(b,'zh-CN'));
  const provinceLabel=province=>province.replace(/(壮族|回族|维吾尔)?自治区$|省$|市$/,'');
  state.provinces=[...cities];
  app.innerHTML=`<section class="selection-page selection-viewport">
    <div class="selection-workspace">
    <header class="selection-topbar workflow-heading"><div class="selection-heading"><a class="secondary selection-back" href="#" aria-label="返回首页，保留本次预选">←</a><h1><span>第一轮 · </span>预选</h1></div><div class="selection-tools"><button class="secondary" id="open-picked">已选 <span id="pick-count">0</span></button><button class="secondary" id="toggle-search" aria-haspopup="dialog" aria-expanded="false">搜索 / 筛选</button></div></header>
    <div class="selection-status" id="selection-status" hidden><span id="filter-status" aria-live="polite"></span><button id="return-browse" class="text-btn" hidden>返回全部</button><span id="browse-position" hidden></span></div>
    <div class="pick-grid" id="pick-grid"></div>
    <div class="selection-dock"><div class="pagination" id="pick-pagination"></div><button class="primary" id="finish-picks">进入 PK →</button></div>
    <dialog id="search-panel" class="selection-dialog" aria-labelledby="filter-title"><div class="dialog-heading"><h2 id="filter-title">搜索 / 筛选</h2><button class="secondary" id="close-search" autofocus>关闭</button></div><div class="dialog-content"><p id="catalog-count" class="catalog-count" aria-live="polite"></p><div class="filters selection-filters"><input id="pick-search" type="search" aria-label="搜索团名或人名" placeholder="搜索团名 / 人名"><select id="pick-source" aria-label="成员类型"><option value="all">全部</option><option value="standard">标准</option><option value="custom">自定义</option></select></div><fieldset class="province-filter"><legend id="province-summary">省级行政区 · 全部保留</legend><div class="province-tools"><button class="text-btn" id="regions-all">全选</button><button class="text-btn" id="regions-none">清空</button></div><div class="province-options">${cities.map(c=>`<label><input type="checkbox" data-province value="${esc(c)}" checked><span>${esc(provinceLabel(c))}（${provinceCounts.get(c)}）</span></label>`).join('')}</div></fieldset></div><div class="dialog-actions"><button class="text-btn" id="clear-filters">清除筛选</button><button class="primary" id="apply-filters">查看成员</button></div></dialog>
    <dialog id="picked-panel" class="selection-dialog" aria-labelledby="picked-title"><div class="dialog-heading"><h2 id="picked-title">预选名单</h2><button class="secondary" id="close-picked" autofocus>关闭</button></div><div class="dialog-content"><p class="tiny">至少选择九位，再通过两两 PK 排出前九名。</p><ol id="picked-list"></ol><a class="secondary" href="#custom">＋ 添加自定义成员</a></div><div class="dialog-actions"><button class="text-btn" id="clear-picks">清空已选</button><button class="primary" id="continue-picking">继续选人</button></div></dialog>
    </div>
  </section>`;
  const pageSize=9;
  let visibleKey;
  function render(focus){
    state.page=searching?searchPage:browsePage;
    const matches=searching?filterMembers(members,state):members,pages=Math.max(1,Math.ceil(matches.length/pageSize));state.page=Math.max(0,Math.min(state.page||0,pages-1));const shown=matches.slice(state.page*pageSize,(state.page+1)*pageSize);
    if(searching)searchPage=state.page;else browsePage=state.page;state.browsePage=browsePage;
    app.querySelector('#browse-position').textContent=searching?'搜索与筛选':`浏览名单 · 第 ${browsePage+1} 页`;
    app.querySelector('#catalog-count').textContent=`找到 ${matches.length} 位成员 · 共 ${new Set(matches.flatMap(memberGroups)).size} 个团体${searching&&state.provinces.length!==cities.length?' · 保留 '+state.provinces.length+' 个省级行政区':''}`;
    const nextVisibleKey=JSON.stringify(shown.map(m=>m.id));
    if(nextVisibleKey!==visibleKey){
      visibleKey=nextVisibleKey;
    app.querySelector('#pick-grid').innerHTML=shown.length?shown.map(m=>`<div class="candidate-cell"><button class="candidate ${state.ids.includes(m.id)?'selected':''}" data-pick-id="${esc(m.id)}" aria-pressed="${state.ids.includes(m.id)}" aria-label="${state.ids.includes(m.id)?'取消':'选择'} ${esc(m.name)}（${esc(m.group)}）"><span class="candidate-photo">${image(m.id,'loading="eager" decoding="async"')}</span><span class="tick">${state.ids.includes(m.id)?'✓':''}</span><span class="candidate-caption"><strong title="${esc(m.name)}">${esc(m.name)}</strong><small title="${esc(m.group)}">${esc(m.group)}</small></span></button></div>`).join(''):'<div class="empty">没有找到匹配的成员。<br>换个关键词或省级行政区试试，也可以添加自定义成员。</div>';
    }
    for(const button of app.querySelectorAll('[data-pick-id]')){
      const member=byId[button.dataset.pickId],selected=state.ids.includes(member.id);
      button.classList.toggle('selected',selected);
      button.setAttribute('aria-pressed',String(selected));
      button.setAttribute('aria-label',`${selected?'取消':'选择'} ${member.name}（${member.group}）`);
      button.querySelector('.tick').textContent=selected?'✓':'';
    }
    app.querySelector('#pick-pagination').innerHTML=`<button class="secondary" id="prev-page" aria-label="上一页" ${state.page===0?'disabled':''}>←</button><span aria-label="第 ${state.page+1} 页，共 ${pages} 页">${state.page+1} / ${pages}</span><button class="secondary" id="next-page" aria-label="下一页" ${state.page>=pages-1?'disabled':''}>→</button>`;
    app.querySelector('#pick-count').textContent=`${state.ids.length}`;
    app.querySelector('#picked-list').innerHTML=Array.from({length:state.ids.length},(_,index)=>{const id=state.ids[index],m=byId[id];return m?`<li><span class="tray-rank">${index+1}</span>${image(id)}<div class="tray-name"><b>${esc(m.name)}</b><small>${esc(m.group)}</small></div><div class="tray-tools"><button data-remove="${esc(id)}" aria-label="移除 ${esc(m.name)}">×</button></div></li>`:`<li class="tray-empty"><span class="tray-rank">${index+1}</span><span>尚未选择</span></li>`;}).join('');
    app.querySelector('#finish-picks').disabled=state.ids.length<9;
    app.querySelector('#finish-picks').textContent=state.ids.length>=9?'进入 PK →':`还差 ${9-state.ids.length} 人`;
    app.querySelector('#finish-picks').setAttribute('aria-label',state.ids.length>=9?`已选 ${state.ids.length} 人，结束预选并进入 PK`:`至少选九人，还差 ${9-state.ids.length} 人`);
    for(const b of app.querySelectorAll('[data-pick-id]'))b.onclick=()=>{const id=b.dataset.pickId;if(state.ids.includes(id))state.ids=state.ids.filter(v=>v!==id);else state.ids.push(id);render({kind:'pick',id});};
    for(const b of app.querySelectorAll('[data-remove]'))b.onclick=()=>{const index=state.ids.indexOf(b.dataset.remove);state.ids=state.ids.filter(id=>id!==b.dataset.remove);render({kind:'remove',index});};
    for(const b of app.querySelectorAll('[data-move]'))b.onclick=()=>{const id=state.ids[Number(b.dataset.move)],offset=Number(b.dataset.offset);state.ids=moveSelection(state.ids,Number(b.dataset.move),offset);render({kind:'move',id,offset});};
    app.querySelector('#prev-page').onclick=()=>{if(searching)searchPage--;else browsePage--;render({kind:'page'});};
    app.querySelector('#next-page').onclick=()=>{if(searching)searchPage++;else browsePage++;render({kind:'page'});};
    app.querySelector('#return-browse').hidden=!searching;
    app.querySelector('#selection-status').hidden=!searching;
    app.querySelector('.selection-viewport').classList.toggle('is-filtered',searching);
    app.querySelector('#filter-status').textContent=`筛选结果 · ${matches.length} 位成员`;
    app.querySelector('#apply-filters').textContent=`查看 ${matches.length} 位成员`;
    onState(state);
    let target;
    if(focus?.kind==='pick')target=[...app.querySelectorAll('[data-pick-id]')].find(b=>b.dataset.pickId===focus.id);
    if(focus?.kind==='move'){const index=state.ids.indexOf(focus.id);const controls=[...app.querySelectorAll('[data-move]')].filter(b=>Number(b.dataset.move)===index&&!b.disabled);target=controls.find(b=>Number(b.dataset.offset)===focus.offset)||controls[0];}
    if(focus?.kind==='remove'){const buttons=app.querySelectorAll('[data-remove]');target=buttons[Math.min(focus.index,buttons.length-1)]||app.querySelector('#toggle-search');}
    if(focus?.kind==='page'){window.scrollTo(0,0);target=app.querySelector('[data-pick-id]');}
    target?.focus({preventScroll:true});
  }
  function changed(){searching=Boolean(state.query.trim()||state.source!=='all'||state.provinces.length!==cities.length);searchPage=0;render();}
  app.querySelector('#pick-search').oninput=e=>{state.query=e.target.value;changed();};
  function updateRegions(){
    const all=state.provinces.length===cities.length;
    app.querySelector('#province-summary').textContent=all?'省级行政区 · 全部保留':state.provinces.length?'省级行政区 · 已保留 '+state.provinces.length+' 个':'省级行政区 · 未保留';
    for(const input of app.querySelectorAll('[data-province]'))input.checked=state.provinces.includes(input.value);
    changed();
  }
  for(const input of app.querySelectorAll('[data-province]'))input.onchange=()=>{state.provinces=[...app.querySelectorAll('[data-province]')].filter(el=>el.checked).map(el=>el.value);updateRegions();};
  app.querySelector('#regions-all').onclick=()=>{state.provinces=[...cities];updateRegions();};
  app.querySelector('#regions-none').onclick=()=>{state.provinces=[];updateRegions();};
  app.querySelector('#pick-source').onchange=e=>{state.source=e.target.value;changed();};
  app.querySelector('#clear-filters').onclick=()=>{state.query='';state.city='';state.source='all';app.querySelector('#pick-source').value='all';searchPage=0;app.querySelector('#pick-search').value='';state.provinces=[...cities];updateRegions();};
  app.querySelector('#clear-picks').onclick=()=>{state.ids=[];render();};
  app.querySelector('#finish-picks').onclick=()=>{if(state.ids.length>=9)onComplete([...state.ids]);};
  const filters=app.querySelector('#search-panel'),picked=app.querySelector('#picked-panel');
  function closeFilters(){document.activeElement?.blur();filters.close();}
  app.querySelector('#toggle-search').onclick=()=>{filters.showModal();app.querySelector('#toggle-search').setAttribute('aria-expanded','true');};
  filters.onclose=()=>app.querySelector('#toggle-search').setAttribute('aria-expanded','false');
  app.querySelector('#close-search').onclick=closeFilters;
  app.querySelector('#apply-filters').onclick=closeFilters;
  app.querySelector('#return-browse').onclick=()=>app.querySelector('#clear-filters').click();
  app.querySelector('#open-picked').onclick=()=>picked.showModal();
  app.querySelector('#close-picked').onclick=()=>picked.close();
  app.querySelector('#continue-picking').onclick=()=>picked.close();
  render();
}
