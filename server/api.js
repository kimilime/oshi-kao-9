import {visitorIdentity,createSubmission,verifySubmission,checkBurst,checkApiBurst,isUploadPath,readUploadBody} from './submission-security.js';

import {submitLimited} from './submission-limits.js';
import {readRankingsCached} from './rankings.js';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('../public/data/idols.json',import.meta.url),'utf8'));
const ids = new Set(catalog.idols.map(i => i.id));
const uuid = /^[a-f0-9-]{36}$/i;
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return json({error:'接口不存在'},404);
    let visitor, headers = {};
    const respond = (body, status = 200) => json(body, status, headers);
    try {
      if(!await checkApiBurst(request,env))return json({error:'请求过于密集，请稍候一分钟再试。',code:'api_burst_limit',retryAfter:60},429,{'Retry-After':'60'});
      if(isUploadPath(url.pathname) || request.method === 'POST') {
        ({visitor,headers}=await visitorIdentity(request,env.signingSecret));
        if(!await checkBurst(request,env,visitor))return json({error:'上传相关请求过于密集，请稍候一分钟再试。',code:'burst_limit',retryAfter:60},429,{...headers,'Retry-After':'60'});
      }

      if(request.method==='GET' && url.pathname==='/api/result-status'){
        const id=url.searchParams.get('id');
        if(!uuid.test(id||''))return respond({error:'结果编号无效'},400);
        const recorded=await env.db.prepare('SELECT id FROM runs WHERE id=? AND visitor=?').bind(id,visitor).first();
        const latest=await env.db.prepare('SELECT MAX(submitted_at) AS time FROM submission_limits WHERE visitor=?').bind(visitor).first();
        return respond({recorded:Boolean(recorded),retryAfter:Math.max(0,(latest.time||0)+60-Math.floor(Date.now()/1000))});
      }
      if (request.method === 'GET' && url.pathname === '/api/ranking') {
        const metric = url.searchParams.get('metric') === 'first' ? 'first' : 'top9';
        const cached=await readRankingsCached(env.db,ids,metric,url.origin);
        return json(cached.data,200,{'X-Ranking-Cache':cached.status});
      }

      if (request.method === 'GET' && url.pathname === '/api/reviews') {
        if(!catalog.reviews_enabled) return respond({ reviews:[], disabled:true });
        const id = url.searchParams.get('id');
        if (!ids.has(id)) return respond({ error: '成员不存在' }, 404);
        const { results } = await env.db.prepare('SELECT id, body, created_at FROM reviews WHERE idol_id = ? AND hidden = 0 ORDER BY created_at DESC LIMIT 100').bind(id).all();
        return respond({ reviews: results });
      }
      if (request.method !== 'POST') return respond({ error: '接口不存在' }, 404);
      if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return respond({ error: '请求来源无效' }, 403);
      if (!request.headers.get('Content-Type')?.includes('application/json')) return respond({ error: '需要 JSON 数据' }, 415);
      const raw = await readUploadBody(request); if (raw === null) return respond({ error: '内容过长' }, 413);
      let body; try { body = JSON.parse(raw); } catch { return respond({ error: 'JSON 格式错误' }, 400); }
      if (!body || typeof body !== 'object') return respond({ error: '数据无效' }, 400);
      if (url.pathname === '/api/results' || url.pathname === '/api/submission-session') {
        // Accept only complete fixed-catalog results; reject custom or legacy mixed lists.
        if (!uuid.test(body.id) || !Array.isArray(body.ranking) || body.ranking.length !== 9 || new Set(body.ranking).size !== 9 || body.ranking.some(id => !ids.has(id))) return respond({ error: '仅接受九位均来自固定名单的结果；含自定义成员的整份名单不参与统计' }, 400);
        if(url.pathname === '/api/submission-session') {
          return respond(await createSubmission(env.signingSecret,url.origin,visitor,body.id,body.ranking));
        }
        const session=await verifySubmission(body.submissionToken,env.signingSecret,url.origin,visitor,body.id,body.ranking);
        if(!session)return respond({error:'本次提交会话无效或已过期。'},403);
        const existing = await env.db.prepare('SELECT id,visitor FROM runs WHERE id = ?').bind(body.id).first();
        if (existing) return existing.visitor === visitor ? respond({ id: existing.id, outcome:'already_recorded' }) : respond({ error: '结果编号已使用' }, 409);
        let day = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
        let now=Math.floor(Date.now()/1000);
        const latestBefore=await env.db.prepare('SELECT MAX(submitted_at) AS time FROM submission_limits WHERE visitor=?').bind(visitor).first();
        const wait=Math.max(0,(latestBefore.time||0)+60-now);
        if(wait)return json({error:`同一浏览器每分钟最多提交一份新结果，请 ${wait} 秒后重试。`,retryAfter:wait},429,{...headers,'Retry-After':String(wait)});
        const accepted=await submitLimited(env.db,{id:body.id,visitor,day,now,ranking:body.ranking});
        if(!accepted){
          // A concurrent retry may have committed the same result while this request waited.
          const duplicate=await env.db.prepare('SELECT id FROM runs WHERE id=? AND visitor=?').bind(body.id,visitor).first();
          if(duplicate)return respond({id:body.id,outcome:'already_recorded'});
          const latest=await env.db.prepare('SELECT MAX(submitted_at) AS time FROM submission_limits WHERE visitor=?').bind(visitor).first();
          const retryAfter=Math.max(1,(latest.time||now)+60-now);
          return json({error:`同一浏览器每分钟最多提交一份新结果，请 ${retryAfter} 秒后重试。`,retryAfter},429,{...headers,'Retry-After':String(retryAfter)});
        }
        return respond({ id: body.id, outcome:'recorded' });
      }
      if (url.pathname === '/api/reviews') {
        if(!catalog.reviews_enabled) return respond({error:'本站未开放公开评价'},403);
        if (typeof body.body !== 'string' || body.body.trim().length < 2 || body.body.trim().length > 300 || body.consent !== true || !uuid.test(body.runId)) return respond({ error: '请写下 2–300 字评价，并同意匿名公开' }, 400);
        const run = await env.db.prepare('SELECT ranking FROM runs WHERE id = ? AND visitor = ?').bind(body.runId, visitor).first();
        if (!run) return respond({ error: '请重新保存你的九选结果' }, 404);
        if (!ids.has(JSON.parse(run.ranking)[0])) return respond({ error: '自定义成员的评价仅保存在本机' }, 400);
        await env.db.prepare('INSERT INTO reviews (id,run_id,idol_id,body) VALUES (?,?,?,?) ON CONFLICT(run_id) DO NOTHING').bind(crypto.randomUUID(), body.runId, JSON.parse(run.ranking)[0], body.body.trim()).run();
        return respond({ ok: true });
      }
      if (url.pathname === '/api/report') {
        if(!catalog.reviews_enabled) return respond({error:'本站未开放公开评价'},403);
        if (!uuid.test(body.reviewId)) return respond({ error: '评价编号无效' }, 400);
        const review = await env.db.prepare('SELECT id FROM reviews WHERE id = ?').bind(body.reviewId).first();
        if (!review) return respond({ error: '评价不存在' }, 404);
        await env.db.prepare('INSERT OR IGNORE INTO reports (review_id,visitor) VALUES (?,?)').bind(body.reviewId, visitor).run();
        return respond({ ok: true });
      }
      return respond({ error: '接口不存在' }, 404);
    } catch (e) { if(e.code==='body_timeout')return respond({error:'请求发送超时，请重试。'},408);console.error(e); return respond({ error: '服务暂时不可用，请稍后重试' }, 503); }
  }
};
