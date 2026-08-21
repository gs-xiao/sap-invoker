// SAP 接口调用层：地址拼接、认证头、获取元数据、提交调用。与 UI 无关的纯网络逻辑。
// 环境地址、元数据服务名等来自 ../config，改配置不用动这里。
import { ENVIRONMENTS, SAP, IS_DEV } from '../config'

// 本地开发一律不带 cookie。
//
// 走 vite 代理时 SAP 的 Set-Cookie 会透传下来落在 localhost 上，只要成功登录过一次，
// 之后每个请求都自动带 SAP_SESSIONID，而 SAP 认 cookie 优先于 Authorization —— 结果就是
// 密码填错也照样通，换个用户名也还是旧身份在跑，「连接设置」形同虚设。omit 同时还能挡掉
// 浏览器在收到 401 时自己弹原生登录框（那个框一登又会种回 cookie），而我们手写的
// Authorization 头不受它影响，照发。
//
// 生产构建（部署到 BSP）反过来：同源、没有账号密码可填，靠的就是浏览器已有的 SAP 会话。
const CREDENTIALS = IS_DEV ? 'omit' : 'same-origin'

// 拼接调用地址：baseUrl 已带 ? 参数时用 &，否则用 ? 起头，避免 zpub_api&action=… 的错误
function buildActionUrl(baseUrl, action) {
  const sep = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${sep}action=${encodeURIComponent(action)}`
}

// Basic 认证串。btoa 只吃 Latin-1，密码里但凡有个中文或全角字符就直接抛
// InvalidCharacterError，报到界面上是句看不懂的「连接失败：Invalid character」。
// 先按 UTF-8 编码成字节再逐字节转 Latin-1，btoa 就能安全吃下（RFC 7617 也是这么约定的）。
function basicToken(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let latin1 = ''
  for (const b of bytes) latin1 += String.fromCharCode(b)
  return btoa(latin1)
}

// Basic 认证头（未填用户名则不带 Authorization）
function authHeaders(username, password) {
  const headers = { 'Content-Type': 'application/json' }
  if (username) headers['Authorization'] = 'Basic ' + basicToken(username, password)
  // 本地开发既不带 cookie 也没有账号，那就一定是 401。与其让调用方看到 SAP 的原始报文，
  // 不如直接说该去哪儿填。生产构建下没有这个问题（走会话）。
  else if (IS_DEV) throw new Error('未填写 SAP 用户名：点顶栏的环境标签填账号密码后「应用并连接」')
  return headers
}

// 取环境配置，地址未配置直接抛错（调用方 catch 后提示）
function requireEnv(env) {
  const envCfg = ENVIRONMENTS[env]
  if (!envCfg?.url) throw new Error(`【${envCfg?.label || env}】环境地址未配置`)
  return envCfg
}

// 获取元数据：返回后端「中性元数据」对象（未转 Schema）。失败抛 Error，message 含原因。
// action 缺省走普通元数据服务；传 SAP.metadataAiAction 即走 AI 方式（入参/出参一致）。
export async function fetchMetadata({ env, username, password, funcName, action = SAP.metadataAction }) {
  const envCfg = requireEnv(env)
  const url = buildActionUrl(envCfg.url, action)
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(username, password),
    credentials: CREDENTIALS,
    // 后端服务的入参名如与此不同，改 config 里的 SAP.metadataFuncKey 即可
    body: JSON.stringify({ [SAP.metadataFuncKey]: funcName }),
  })
  const raw = await resp.text()
  if (!resp.ok) throw new Error(`接口返回 HTTP ${resp.status}：${raw}`)
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('返回内容不是合法 JSON：' + raw)
  }
}

// 提交调用：payload 为已剥离内部 key 的 FM 入参。返回 { ok, status, body }（body 尽量格式化 JSON）。
export async function submitCall({ env, username, password, action, payload }) {
  const envCfg = requireEnv(env)
  const url = buildActionUrl(envCfg.url, action)
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(username, password),
    credentials: CREDENTIALS,
    body: JSON.stringify(payload),
  })
  const raw = await resp.text()
  let body = raw
  // 存紧凑 JSON（无换行/缩进）——避免带换行的字符串经 SAP /ui2/cl_json 往返时转义被破坏；
  // 显示时由 ResultModal 再美化。非 JSON 原样保留。
  try { body = JSON.stringify(JSON.parse(raw)) } catch { /* 非 JSON，原样展示 */ }
  return { ok: resp.ok, status: resp.status, body }
}

// ---- 调用记录 / 变式 / 分享 存储（单入口 Z_INVOKER_STORE，按 body.op 分派）----
//
// 后端分发器 ZCL_HTTP_HANDLE 把 FM 出参序列化为信封 { "EV_JSON": "<内层JSON字符串>" }，
// 这里负责拆信封 + 二次解析；内层若含 { error } 视为业务失败抛错。
// 兼容：分发器层错误信封 { STATUS:'E', MSG } / { TYPE:'E', TEXT }，以及极端情况下的未包裹返回。
async function callStore(op, body, { env, username, password }) {
  const envCfg = requireEnv(env)
  const url = buildActionUrl(envCfg.url, SAP.storeAction)
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(username, password),
    credentials: CREDENTIALS,
    body: JSON.stringify({ op, ...body }),
  })
  const raw = await resp.text()
  if (!resp.ok) throw new Error(`接口返回 HTTP ${resp.status}：${raw}`)

  let parsed
  try { parsed = JSON.parse(raw) } catch { throw new Error('返回内容不是合法 JSON：' + raw) }

  // 分发器层错误（FM 不存在 / 运行期异常）
  if (parsed && (parsed.STATUS === 'E' || parsed.TYPE === 'E')) {
    throw new Error('接口错误：' + (parsed.MSG || parsed.TEXT || raw))
  }

  // 正常路径：拆 EV_JSON 信封（大小写兜底），未包裹时回退把 parsed 当数据
  let data = parsed
  const inner = parsed?.EV_JSON ?? parsed?.ev_json
  if (inner !== undefined) {
    data = typeof inner === 'string' ? (inner ? JSON.parse(inner) : null) : inner
  }
  if (data && data.error) throw new Error(data.error)
  return data
}

// 10 个逻辑操作，最后一个参数统一为 auth = { env, username, password }
export const store = {
  recList:     (kind, auth)                  => callStore('REC_LIST',     { kind }, auth),
  recGet:      (id, auth)                     => callStore('REC_GET',      { rec_id: id }, auth),
  recSave:     (rec, auth)                    => callStore('REC_SAVE',     rec, auth),
  recRename:   (id, name, auth)               => callStore('REC_RENAME',   { rec_id: id, rec_name: name }, auth),
  recDelete:   (id, auth)                     => callStore('REC_DELETE',   { rec_id: id }, auth),
  recClear:    (kind, auth)                   => callStore('REC_CLEAR',    { kind }, auth),
  shareAdd:    (recId, toUname, note, auth)   => callStore('SHARE_ADD',    { rec_id: recId, to_uname: toUname, note }, auth),
  shareInbox:  (auth)                         => callStore('SHARE_INBOX',  {}, auth),
  shareGet:    (shareId, auth)                => callStore('SHARE_GET',     { share_id: shareId }, auth),
  shareRemove: (shareId, auth)                => callStore('SHARE_REMOVE',  { share_id: shareId }, auth),
}
