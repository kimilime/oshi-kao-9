import {advanceSort,selectionPlan,isSortAlgorithm} from './sort.js?v=20260926-winner-tree';
export const isSortingGame=s=>isSortAlgorithm(s.algorithm);
export function shuffle(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function createGame(ids) {
  if (ids.length < 9 || new Set(ids).size !== ids.length) throw new Error('至少需要 9 位不重复的成员');
  return { version: 1, stage: 'prelim', order: shuffle(ids), page: 0, selected: [], picks: [], history: [] };
}
function final(s, pool) { s.stage = 'final'; s.pool = [...pool]; s.ranking = []; beginBracket(s); }
function beginBracket(s) { s.queue = [...s.pool]; s.winners = []; s.pair = []; advanceBracket(s); }
function advanceBracket(s) {
  while (true) {
    if (s.queue.length >= 2) { s.pair = s.queue.splice(0, 2); return; }
    if (s.queue.length) s.winners.push(s.queue.shift());
    if (s.winners.length === 1) {
      const winner = s.winners[0]; s.ranking.push(winner); s.pool = s.pool.filter(id => id !== winner);
      if (s.ranking.length === 9) { s.stage = 'ready'; s.pair = []; return; }
      s.queue = [...s.pool]; s.winners = []; continue;
    }
    s.queue = s.winners; s.winners = [];
  }
}
function mainOrFinal(s) {
  s.picks = [];
  if (s.selected.length <= 18) return final(s, s.selected);
  s.stage = 'main'; s.round = 1; s.rounds=3; s.page = 0; s.mainOrder = [...s.selected]; s.scores = Object.fromEntries(s.selected.map(id => [id, 1500]));s.encounters={};s.groups=makeGroups(s);
}
const pairKey=(a,b)=>[a,b].sort().join('|');
function makeGroups(s){
  const remaining=[...s.mainOrder].sort((a,b)=>s.scores[b]-s.scores[a]);const count=Math.ceil(remaining.length/4),base=Math.floor(remaining.length/count),extra=remaining.length%count,groups=[];
  for(let i=0;i<count;i++){const size=base+(i<extra?1:0),group=[remaining.shift()];while(group.length<size){let best=0,cost=Infinity;remaining.forEach((id,index)=>{const value=group.reduce((sum,other)=>sum+(s.encounters[pairKey(id,other)]||0)*100000+Math.abs(s.scores[id]-s.scores[other]),0);if(value<cost){cost=value;best=index;}});group.push(remaining.splice(best,1)[0]);}groups.push(group);}return groups;
}
function scoreGroup(s,picks){
  const group=candidates(s),delta=Object.fromEntries(group.map(id=>[id,0]));
  for(let place=0;place<2;place++){const winner=picks[place];for(const loser of group.filter(id=>!picks.slice(0,place+1).includes(id))){const adjustment=32/(group.length-1)*(1-1/(1+10**((s.scores[loser]-s.scores[winner])/400)));delta[winner]+=adjustment;delta[loser]-=adjustment;}}
  for(const id of group)s.scores[id]+=delta[id];for(let a=0;a<group.length;a++)for(let b=a+1;b<group.length;b++){const key=pairKey(group[a],group[b]);s.encounters[key]=(s.encounters[key]||0)+1;}
}
export function candidates(s) {
  if (s.stage === 'prelim') return s.order.slice(s.page * 9, s.page * 9 + 9);
  if (s.stage === 'supplement') return s.order.filter(id => !s.selected.includes(id));
  if (s.stage === 'main'||s.stage==='rescue') return s.groups[s.page];
  if (s.stage === 'final') return s.pair;
  return [];
}
export function transition(state, picks) {
  const {history:priorHistory=[],...current}=state;
  const s = structuredClone(current);
  if (!Array.isArray(picks) || new Set(picks).size !== picks.length || picks.some(id => !candidates(s).includes(id))) throw new Error('无效的选择');
  if (s.stage === 'prelim') {
    s.selected.push(...picks); s.page++;
    if (s.page * 9 >= s.order.length) { if (s.selected.length < 9) { s.stage = 'supplement'; s.page = 0; } else mainOrFinal(s); }
  } else if (s.stage === 'supplement') {
    if (s.selected.length + picks.length < 9) throw new Error('请至少选满 9 人');
    s.selected.push(...picks); mainOrFinal(s);
  } else if (s.stage === 'main'||s.stage==='rescue') {
    if (picks.length !== Math.min(2, candidates(s).length)) throw new Error('请按喜欢的顺序选出两人');
    scoreGroup(s,picks); s.page++;
    if (s.page >= s.groups.length) {
      if (s.round < s.rounds) { s.round++; s.page = 0; s.groups=makeGroups(s); }
      else { const sorted = [...s.mainOrder].sort((a, b) => s.scores[b] - s.scores[a]);
        if(s.stage==='rescue')final(s,[...s.locked,...sorted.slice(0,8)]);
        else{s.locked=sorted.slice(0,10);s.mainOrder=sorted.slice(10,30);s.stage='rescue';s.round=1;s.rounds=s.selected.length>45?2:1;s.page=0;s.scores=Object.fromEntries(s.mainOrder.map(id=>[id,1500]));s.groups=makeGroups(s);}
      }
    }
  } else if (s.stage === 'final') {
    if (picks.length !== 1) throw new Error('请选择一人');
    if(isSortingGame(s)){s.answers.push([picks[0],s.pair.find(id=>id!==picks[0])]);advanceSort(s);}
    else{s.winners.push(picks[0]); advanceBracket(s);}
  } else throw new Error('当前阶段不可选择');
  s.picks = [];
  const old = structuredClone(current);
  s.history = [...priorHistory, old];
  return s;
}

// Continue from the unified browser's already chosen pool, skipping preliminary pages.
export function gameFromSelection(ids) {
  const s=createGame(ids);
  s.order=[...ids];s.selected=[...ids];
  s.pk=true;
  Object.assign(s,selectionPlan(ids.length));s.answers=[];
  s.stage='final';s.ranking=[];advanceSort(s);
  return s;
}
