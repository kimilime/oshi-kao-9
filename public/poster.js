import {homeLabel} from './site-address.js?v=20260926-poster-url';
import { resultPhoto } from './local-members.js';
export function uploadNotice(ids,byId,overrides={}){return ids.some(id=>byId[id]?.local||overrides[id])?'部分或全部内容由用户上传':'';}
export function posterSlots(layout) {
  if(layout==='center'){const positions=[4,0,1,2,3,5,6,7,8];return positions.map((pos,i)=>{const w=i===0?320:278,h=i===0?310:286;return {x:214+(pos%3)*326-w/2,y:390+Math.floor(pos/3)*420-h/2,w,h};});}
  if(layout==='podium')return [
    {x:362,y:258,w:356,h:432}, {x:64,y:360,w:270,h:330}, {x:746,y:360,w:270,h:330},
    ...Array.from({length:6},(_,i)=>({x:64+i*162,y:820,w:142,h:194}))
  ];
  return Array.from({length:9},(_,i)=>({x:64+(i%3)*326,y:240+Math.floor(i/3)*400,w:300,h:308}));
}
function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.crossOrigin='anonymous';const timer=setTimeout(()=>reject(new Error('图片加载超时')),8000);im.onload=()=>{clearTimeout(timer);resolve(im);};im.onerror=()=>{clearTimeout(timer);reject(new Error('图片加载失败'));};im.src=src;});}
function fitText(ctx,text,x,y,width,size,weight='600',color='#19191f'){
  ctx.fillStyle=color;let n=size;ctx.font=`${weight} ${n}px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;
  while(ctx.measureText(text).width>width&&n>size*.75){n--;ctx.font=`${weight} ${n}px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`;}
  let value=text;if(ctx.measureText(value).width>width){while(value&&ctx.measureText(value+'…').width>width)value=value.slice(0,-1);value+='…';}
  ctx.fillText(value,x,y);
}
export async function createPoster(ids,byId,overrides,{layout='grid',demo=false,soloName=null,soloCaption='九个瞬间，同一个你。',footer=true}={}){
  await document.fonts.ready;
  const solo=soloName!==null,notice=solo?'内容由用户提供':uploadNotice(ids,byId,overrides),footerY=layout==='podium'?1116:layout==='center'?1504:1464;
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=footerY+(footer?128:0);
  const ctx=canvas.getContext('2d'),H=canvas.height;
  ctx.fillStyle='#f3f3f5';ctx.fillRect(0,0,1080,H);
  const generatedAt=new Date();
  const title=demo?'推颜九选（随机示例）':solo?soloName:'我的推颜九选';
  const subtitle=demo?`图片生成于 ${new Intl.DateTimeFormat('zh-CN',{dateStyle:'medium',timeStyle:'short'}).format(generatedAt)}`:solo?soloCaption:'中国地下偶像我最喜欢的9张面孔';
  ctx.textAlign='left';fitText(ctx,title,64,116,850,64,'900');
  ctx.fillStyle='#e60063';ctx.fillRect(66,142,286,8);
  fitText(ctx,subtitle,66,189,900,23,'400','#696973');
  if(layout==='podium'){
    // A restrained crown and starbursts frame the winner without covering faces.
    ctx.save();ctx.fillStyle='#e60063';ctx.beginPath();ctx.moveTo(508,235);ctx.lineTo(501,212);ctx.lineTo(523,222);ctx.lineTo(540,200);ctx.lineTo(557,222);ctx.lineTo(579,212);ctx.lineTo(572,235);ctx.closePath();ctx.fill();
    const star=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.quadraticCurveTo(x,y,x,y+r);ctx.quadraticCurveTo(x,y,x-r,y);ctx.quadraticCurveTo(x,y,x,y-r);ctx.fill();};
    star(320,275,15,'#e60063');star(762,273,10,'#e60063');star(291,242,6,'#c79148');ctx.restore();
  }
  const slots=posterSlots(layout),images=await Promise.all(ids.map(id=>loadImage(resultPhoto(byId[id],overrides)).catch(()=>null)));
  const order=layout==='center'?[1,2,3,4,5,6,7,8,0]:slots.map((_,i)=>i);
  order.forEach(i=>{const {x,y,w,h}=slots[i];ctx.save();if(layout==='center'){const angle=[-3,-5,2,5,3,-3,-4,3,4][i]*Math.PI/180;ctx.translate(x+w/2,y+h/2);ctx.rotate(angle);ctx.translate(-x-w/2,-y-h/2);}
    const member=byId[ids[i]],img=images[i],small=layout==='podium'&&i>=3;ctx.save();
    if(layout==='center'){ctx.shadowColor='#17172224';ctx.shadowBlur=i===0?28:15;ctx.shadowOffsetY=8;ctx.fillStyle=i===0?'#fff0f6':'#fff';ctx.fillRect(x-12,y-12,w+24,h+94);ctx.shadowColor='transparent';if(i===0){ctx.strokeStyle='#e60063';ctx.lineWidth=4;ctx.strokeRect(x-12,y-12,w+24,h+94);}}
    ctx.shadowColor='#17172218';ctx.shadowBlur=22;ctx.shadowOffsetY=8;ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(x,y,w,h,9);ctx.fill();ctx.restore();
    if(layout==='podium'&&i<3){ctx.save();ctx.strokeStyle=i===0?'#e60063':i===1?'#b1a2bc':'#c99a6d';ctx.lineWidth=i===0?4:2;ctx.beginPath();ctx.roundRect(x-6,y-6,w+12,h+12,12);ctx.stroke();ctx.restore();}
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,9);ctx.clip();
    if(img){const scale=Math.max(w/img.width,h/img.height);ctx.drawImage(img,x+(w-img.width*scale)*(solo?(member.x??50)/100:.5),y+(h-img.height*scale)*(solo?(member.y??35)/100:.35),img.width*scale,img.height*scale);}
    else{ctx.fillStyle='#e5e5ea';ctx.fillRect(x,y,w,h);ctx.textAlign='center';fitText(ctx,'照片暂缺',x+w/2,y+h/2,w-30,23,'400','#777780');}
    ctx.restore();
    ctx.save();ctx.translate(x-9,y-12);ctx.rotate(-.055);if(small)ctx.scale(.68,.68);ctx.fillStyle=i===0?'#e60063':layout==='podium'&&i===1?'#76627f':layout==='podium'&&i===2?'#93633c':'#202027';ctx.fillRect(0,0,i===0&&['podium','center'].includes(layout)?110:62,55);ctx.textAlign='left';fitText(ctx,String(i+1).padStart(2,'0'),13,39,50,34,'900','#fff');if(i===0&&['podium','center'].includes(layout))fitText(ctx,'最爱',65,34,40,16,'700','#fff');ctx.restore();
    ctx.textAlign='center';fitText(ctx,member.name,x+w/2,y+h+(small?30:39),w,small?20:layout==='podium'&&i===0?36:28,'800');fitText(ctx,member.group,x+w/2,y+h+(small?54:68),w,small?16:19,'400','#696973');
    ctx.restore();
  });
  if(footer){
  ctx.strokeStyle='#d7d7de';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(64,footerY);ctx.lineTo(1016,footerY);ctx.stroke();
  // Attribution and the plain homepage address share one baseline.
  const titleY=footerY+(notice?46:64);
  ctx.save();ctx.textAlign='left';ctx.textBaseline='middle';
  fitText(ctx,'使用推颜九选制作',64,titleY,520,30,'800');
  if(notice)fitText(ctx,notice,64,titleY+39,520,20,'400','#696973');
  ctx.textAlign='right';
  fitText(ctx,homeLabel(location.href),1016,titleY,392,30,'500','#696973');
  ctx.restore();
  }
  return {canvas,missing:images.filter(i=>!i).length};
}
