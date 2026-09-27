// Opt-in via ?debug=images. Measurements stay on the device unless the user copies them.
export function imageDiagnostics(){
 const box=element=>{if(!element)return null;const r=element.getBoundingClientRect();return [r.width,r.height,r.x,r.y].map(n=>Math.round(n*10)/10);};
 const appearance=element=>{if(!element)return null;const s=getComputedStyle(element);return {display:s.display,position:s.position,visibility:s.visibility,opacity:s.opacity,overflow:s.overflow};};
 return {
  build:'20260926-card-layout',browser:navigator.userAgent,
  viewport:[innerWidth,innerHeight,devicePixelRatio],
  selecting:document.body.classList.contains('is-selecting'),
  css:{has:CSS.supports('selector(:has(*))'),dvh:CSS.supports('height','100dvh')},
  styles:[...document.querySelectorAll('link[rel=stylesheet]')].map(el=>new URL(el.href).pathname+new URL(el.href).search),
  main:box(document.querySelector('main')),grid:box(document.getElementById('pick-grid')),
  photos:[...document.querySelectorAll('#pick-grid [data-pick-id]')].slice(0,9).map((card,index)=>{
   const photo=card.querySelector('.candidate-photo'),img=photo?.querySelector('img');
   return {index:index+1,card:box(card),photo:box(photo),image:box(img),photoStyle:appearance(photo),imageStyle:appearance(img),complete:img?.complete,natural:[img?.naturalWidth,img?.naturalHeight],loading:img?.loading,fallback:img?.dataset.fallback==='true'};
  })
 };
}
export function mountImageDiagnostics(){
 if(document.getElementById('image-diagnostics-button'))return;
 const button=document.createElement('button');button.id='image-diagnostics-button';button.textContent='图片检查';
 button.style.cssText='position:fixed;right:12px;bottom:12px;z-index:9999;min-height:44px;padding:10px 14px;border:1px solid #999;border-radius:8px;background:#fff;color:#222;font:14px system-ui;box-shadow:0 2px 12px #0002';
 button.onclick=()=>{
  const text=JSON.stringify(imageDiagnostics());
  const panel=document.createElement('dialog');panel.setAttribute('aria-labelledby','image-check-title');
  panel.style.cssText='width:calc(100% - 32px);max-width:540px;max-height:85vh;padding:20px;border:1px solid #ddd;border-radius:12px;background:#fff;color:#222';
  panel.innerHTML='<h2 id="image-check-title" style="margin:0 0 12px;font-size:20px">图片显示检查</h2><p style="font-size:14px;line-height:1.6">复制检查结果，发给维护者帮助定位问题。这里只包含浏览器和图片显示状态，不包含上传照片或选择记录。</p><textarea aria-label="图片检查结果" readonly style="box-sizing:border-box;width:100%;height:170px;font:12px monospace"></textarea><p role="status" style="font-size:14px"></p><div style="display:flex;gap:12px"><button data-copy style="min-height:44px;padding:10px 16px">复制检查结果</button><button data-close style="min-height:44px;padding:10px 16px">关闭</button></div>';
  const textarea=panel.querySelector('textarea');textarea.value=text;
  panel.querySelector('[data-close]').onclick=()=>panel.close();
  panel.addEventListener('close',()=>panel.remove());
  panel.querySelector('[data-copy]').onclick=async()=>{
   try{await navigator.clipboard.writeText(text);panel.querySelector('[role=status]').textContent='已复制，可粘贴发送。';}
   catch{textarea.focus();textarea.select();panel.querySelector('[role=status]').textContent='请长按已选中的文字，选择复制。';}
  };
  document.body.append(panel);panel.showModal();
 };
 document.body.append(button);
}
