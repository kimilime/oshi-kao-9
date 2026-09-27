import {shuffle} from './game.js';
export function freshSelection(ids,random=Math.random){
  return {ids:[],order:shuffle(ids,random),query:'',city:'',page:0,browsePage:0};
}
export function orderedMembers(members,order=[]){
  const byId=new Map(members.map(m=>[m.id,m])),seen=new Set(),result=[];
  for(const id of order){if(byId.has(id)&&!seen.has(id)){result.push(byId.get(id));seen.add(id);}}
  for(const member of members)if(!seen.has(member.id)){result.push(member);seen.add(member.id);}
  return result;
}
