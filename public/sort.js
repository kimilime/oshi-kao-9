// Ford–Johnson merge-insertion sorting. `before(a,b)` means a ranks above b.
// Partner bounds and Jacobsthal insertion order minimize expensive user comparisons.
export function mergeInsertionSort(items,before){
  if(items.length<2)return [...items];
  const partners=new Map(),anchors=[];
  for(let i=0;i+1<items.length;i+=2){
    const [a,b]=before(items[i],items[i+1])?[items[i],items[i+1]]:[items[i+1],items[i]];
    partners.set(b,a);anchors.push(b);
  }
  const ordered=mergeInsertionSort(anchors,before);
  const chain=[partners.get(ordered[0]),...ordered];
  const pending=ordered.map(anchor=>({value:partners.get(anchor),anchor}));
  if(items.length%2)pending.push({value:items.at(-1)});
  let done=1,previous=1,boundary=3;
  while(done<pending.length){
    const end=Math.min(boundary,pending.length);
    for(let i=end-1;i>=done;i--){
      const {value,anchor}=pending[i];let lo=0,hi=anchor===undefined?chain.length:chain.indexOf(anchor);
      while(lo<hi){const mid=Math.floor((lo+hi)/2);if(before(value,chain[mid]))hi=mid;else lo=mid+1;}
      chain.splice(lo,0,value);
    }
    done=end;[previous,boundary]=[boundary,boundary+2*previous];
  }
  return chain;
}
export function comparisonLimit(n){let sum=0;for(let k=1;k<=n;k++)sum+=Math.ceil(Math.log2(3*k/4));return sum;}

// Keep each subtree's winner. Removing a winner only replays its ancestor path;
// empty branches advance for free, and the last requested winner needs no repair.
export function winnerTreeTopK(items,before,k=9,onRank){
  const count=Math.min(items.length,Math.max(0,Math.floor(k)));
  if(!count)return [];
  let size=1;while(size<items.length)size*=2;
  const tree=new Array(2*size).fill(-1);
  for(let i=0;i<items.length;i++)tree[size+i]=i;
  const update=node=>{
    const left=tree[node*2],right=tree[node*2+1];
    tree[node]=left<0?right:right<0?left:before(items[left],items[right])?left:right;
  };
  for(let node=size-1;node>0;node--)update(node);
  const result=[];
  for(let place=0;place<count;place++){
    const winner=tree[1];result.push(items[winner]);
    onRank?.(items[winner],place+1);
    if(place===count-1)break;
    let node=size+winner;tree[node]=-1;
    while(node>1){node=Math.floor(node/2);update(node);}
  }
  return result;
}
export function winnerComparisonLimit(n,k=9){
  const count=Math.min(n,Math.max(0,Math.floor(k)));
  if(n<2||!count)return 0;
  const height=Math.ceil(Math.log2(n));let total=n-1;
  for(let removed=1;removed<count;removed++)total+=Math.min(height-1,n-removed-1);
  return total;
}
// Prefer the lower guaranteed bound, not a claim of optimality for every order.
// For ordered top nine this keeps Ford–Johnson through 13 and switches at 14.
export function selectionPlan(n){
  const full=comparisonLimit(n),top=winnerComparisonLimit(n);
  return top<full?{algorithm:'winner-tree-v1',maxComparisons:top}:{algorithm:'ford-johnson-v1',maxComparisons:full};
}
export function isSortAlgorithm(algorithm){return algorithm==='ford-johnson-v1'||algorithm==='winner-tree-v1';}
// Replay saved answers to the next unresolved comparison. Only plain data is persisted.
export function advanceSort(s){
  const known=new Map();for(const [a,b] of s.answers){known.set(JSON.stringify([a,b]),true);known.set(JSON.stringify([b,a]),false);}
  const waiting={};
  try{
    const sort=s.algorithm==='winner-tree-v1'?winnerTreeTopK:mergeInsertionSort;
    const sorted=sort(s.order,(a,b)=>{
      const key=JSON.stringify([a,b]);if(known.has(key))return known.get(key);
      s.pair=[a,b];throw waiting;
    });
    s.ranking=sorted.slice(0,9);s.stage='ready';s.pair=[];
  }catch(error){if(error!==waiting)throw error;}
}
