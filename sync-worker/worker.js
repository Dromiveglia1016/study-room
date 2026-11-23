/* ============================================================
   study room · 云同步后端 (Cloudflare Worker + KV)

   【部署步骤 · 约 3 分钟 · 全免费，不用信用卡】
   1) 打开 https://dash.cloudflare.com 注册/登录
   2) 左侧 Workers & Pages → KV → Create a namespace
      名字随便填，例如 studyroom-sync
   3) Workers & Pages → Create → Create Worker → 名字随便填 → Deploy
   4) 点右上角 Edit code，把本文件全部内容粘贴进去（覆盖默认代码）
      → 点 Save and Deploy
   5) 回到这个 Worker → Settings → Variables → KV Namespace Bindings
      → Add binding：
         Variable name : SYNC      （必须一模一样，大写）
         KV namespace  : 选第 2 步建的那个
      → Save and deploy
   6) 复制 Worker 的网址（形如 https://xxxx.workers.dev），
      填到网站左下角云朵按钮 → 云同步面板里的「Worker 地址」

   【它做什么】
   - 只按 k=<同步码的 SHA-256> 存取一整包密文，看不到原始同步码
   - AES-GCM 的加解密全在浏览器里做，KV 里存的是加密后的 blob
   - PUT 带 baseRev 乐观锁：两台设备同时写，后写的会收到 409，
     前端重新拉一次再决定，避免悄悄覆盖
   - 免费额度：每天 10 万次请求、1000 次写入、1 GB 存储，
     一个人用远远用不完

   【可选】想只允许自己的网站调用：在 Worker 的 Settings → Variables
   加一个变量 ALLOW_ORIGIN，值填 https://dromiveglia1016.github.io
   （不填则允许任何来源；填了以后本地 localhost 测试会被挡住）
   ============================================================ */

const MAX_BLOB = 64 * 1024;   // 一包学习数据远小于 64 KB
const KEY_RE = /^[0-9a-f]{64}$/;

function corsHeaders(env) {
  const origin = env && env.ALLOW_ORIGIN ? env.ALLOW_ORIGIN : '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(obj, status, env) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }, corsHeaders(env))
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });

    const url = new URL(request.url);
    if (url.pathname !== '/sync') return json({ error: 'not found' }, 404, env);

    // k 是同步码的 SHA-256，不是同步码本身
    const k = url.searchParams.get('k') || '';
    if (!KEY_RE.test(k)) return json({ error: 'bad key' }, 400, env);
    const id = 'sr:' + k;

    if (request.method === 'GET') {
      const cur = await env.SYNC.get(id, 'json');
      return json(cur || { rev: 0, updatedAt: 0, blob: null }, 200, env);
    }

    if (request.method === 'PUT') {
      let body;
      try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400, env); }
      const blob = typeof body.blob === 'string' ? body.blob : '';
      if (!blob || blob.length > MAX_BLOB) return json({ error: 'too big' }, 413, env);

      const cur = (await env.SYNC.get(id, 'json')) || { rev: 0, updatedAt: 0, blob: null };
      if ((+body.baseRev || 0) !== (+cur.rev || 0)) {
        // 有人抢先写过了：把当前内容一起返回，前端据此重新判断
        return json({ rev: cur.rev, updatedAt: cur.updatedAt, blob: cur.blob }, 409, env);
      }
      const next = {
        rev: (+cur.rev || 0) + 1,
        updatedAt: +body.updatedAt || Date.now(),
        blob
      };
      await env.SYNC.put(id, JSON.stringify(next));
      return json({ rev: next.rev, updatedAt: next.updatedAt }, 200, env);
    }

    if (request.method === 'DELETE') {
      await env.SYNC.delete(id);
      return json({ ok: true }, 200, env);
    }

    return json({ error: 'method not allowed' }, 405, env);
  }
};
