import {mergeInsertionSort,winnerTreeTopK,isSortAlgorithm} from './sort.js?v=20260927-sort-record';

// Replay only the effective saved answers. This never advances or saves the game.
export function buildSortRecord(game){
  if(!game||!isSortAlgorithm(game.algorithm)||!Array.isArray(game.order)||game.order.length<9||new Set(game.order).size!==game.order.length||!Array.isArray(game.answers)||!Array.isArray(game.ranking)||game.ranking.length!==9)return null;
  const events=[],known=new Map();let next=0;
  const before=(a,b)=>{
    const key=JSON.stringify([a,b]);
    if(known.has(key))return known.get(key);
    const answer=game.answers[next];
    if(!Array.isArray(answer)||answer.length!==2||!((answer[0]===a&&answer[1]===b)||(answer[0]===b&&answer[1]===a)))throw Error('Incomplete comparison record');
    next++;
    const won=answer[0]===a;
    known.set(key,won);known.set(JSON.stringify([b,a]),!won);
    events.push({type:'comparison',number:next,left:a,right:b,winner:answer[0]});
    return won;
  };
  const rank=(id,place)=>events.push({type:'rank',id,place});
  try{
    const tournament=game.algorithm==='winner-tree-v1';
    const sorted=tournament?winnerTreeTopK([...game.order],before,9,rank):mergeInsertionSort([...game.order],before).slice(0,9);
    if(next!==game.answers.length||sorted.some((id,i)=>id!==game.ranking[i]))return null;
    if(!tournament)sorted.forEach((id,i)=>rank(id,i+1));
    return {initial:[...game.order],algorithm:tournament?'Tournament Tree':'Ford–Johnson',events};
  }catch{return null;}
}

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderSortRecord(record,byId){
  if(!record)return '<p class="tiny">这份结果未保存完整排序记录，暂时无法展示。</p>';
  const name=id=>escape(byId[id]?.name||'资料已不可用的成员');
  const person=(id,winner)=>id===winner?`<strong class="sort-winner">${name(id)}</strong>`:`<span class="sort-loser">${name(id)}</span>`;
  return `<p class="sort-initial"><b>初选名单（${record.initial.length}人）：</b>${record.initial.map(name).join('、')}</p><p><b>采用算法：</b>${record.algorithm}</p><h2>对决历程</h2>${record.algorithm==='Ford–Johnson'?'<p class="tiny">完整排序完成后，统一确定前九名。</p>':''}<ol class="sort-events">${record.events.map(event=>event.type==='comparison'?`<li class="sort-duel"><span class="sort-turn">第 ${event.number} 次</span><div>${person(event.left,event.winner)} <span class="sort-vs">vs</span> ${person(event.right,event.winner)}</div></li>`:`<li class="sort-milestone"><p><span>第${event.place}名确定：</span><strong>${name(event.id)}</strong></p><hr></li>`).join('')}</ol>`;
}

export function mountSortRecord(container,game,byId){
  if(!container)return;
  container.innerHTML='<details class="sort-record"><summary>展开排序记录</summary><div class="sort-record-content"></div></details>';
  const details=container.querySelector('details'),summary=details.querySelector('summary');let built=false;
  details.addEventListener('toggle',()=>{
    summary.textContent=details.open?'收起排序记录':'展开排序记录';
    if(details.open&&!built){details.querySelector('.sort-record-content').innerHTML=renderSortRecord(buildSortRecord(game),byId);built=true;}
  });
}
