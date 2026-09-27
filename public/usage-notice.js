const KEY='oshi9-usage-notice-v1';
export const usageNoticeBody='<p>推颜九选提供成员资料浏览、图片选择与排版功能。使用前，请确认：</p><ol><li>使用站内资料或自行上传的内容时，您拥有相应使用权，或已取得必要授权。</li><li>不利用本站制作、传播违法、侵权、冒充或误导他人的内容。</li><li>生成图片由用户自行选择和组合，不代表本站的立场或认可。请对您分享的内容及其使用方式负责。</li></ol>';
export async function requireUsageNotice(){
 try{if(localStorage.getItem(KEY)==='accepted')return;}catch{}
 return new Promise(resolve=>{
 const dialog=document.createElement('dialog');dialog.id='usage-notice';dialog.className='usage-notice';dialog.setAttribute('aria-labelledby','usage-notice-title');
 dialog.innerHTML='<div class="usage-notice-content"><h2 id="usage-notice-title" tabindex="-1">使用须知</h2>'+usageNoticeBody+'<p class="usage-confirm">继续使用即表示您已阅读并同意以上内容。</p></div><div class="usage-notice-actions"><button class="text-btn" data-notice="decline">暂不使用</button><button class="primary" data-notice="accept">同意并继续</button></div>';
 document.body.append(dialog);dialog.addEventListener('cancel',e=>e.preventDefault());
 dialog.querySelector('[data-notice="accept"]').addEventListener('click',()=>{try{localStorage.setItem(KEY,'accepted');}catch{}dialog.close();dialog.remove();resolve();});
 dialog.querySelector('[data-notice="decline"]').addEventListener('click',()=>{dialog.close();const app=document.getElementById('app');app.innerHTML='<section class="page"><h1>尚未开始使用</h1><p class="page-intro">阅读并同意使用须知后，即可开始制作。</p><button class="secondary" id="reopen-notice">查看使用须知</button></section>';app.querySelector('#reopen-notice').addEventListener('click',()=>{dialog.showModal();dialog.querySelector('h2').focus();});});
 dialog.showModal();dialog.querySelector('h2').focus();
 });
}
