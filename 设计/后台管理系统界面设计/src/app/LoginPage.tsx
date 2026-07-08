import { useState } from "react";
import {
  Eye, EyeOff, AlertCircle, Loader2, FlaskConical, ChevronRight,
  Bot, Globe2, Bug, FileText, Timer, Activity,
} from "lucide-react";

// ─── Palette ──────────────────────────────────────────────────────────────────
const PNL  = "#0D1117";   // dark panel
const CARD = "#161B22";   // dark card
const DBR  = "#21262D";   // dark card border
const TEXT = "#E6EDF3";   // dark text
const MTD  = "#7D8590";   // dark muted
const BLU  = "#165DFF";   // accent
const LBR  = "#E5E6EB";   // light border
const LT1  = "#1D2129";   // light text-1
const LT3  = "#86909C";   // light text-3

const LOG_C: Record<string, string> = {
  ok: "#3FB950", fail: "#F85149", warn: "#E3B341",
  ai: "#A78BFA", dim: "#7D8590", sum: "#79C0FF",
};

// ─── Static data ──────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Bot,      label: "AI 用例生成",   desc: "需求驱动，自动生成",  col: "#8B5CF6" },
  { icon: Globe2,   label: "接口自动化",    desc: "场景化测试套件执行",  col: BLU       },
  { icon: Activity, label: "Web UI 自动化", desc: "录制 + AI 优化断言",  col: "#10B981" },
  { icon: Bug,      label: "缺陷追踪",      desc: "发现到修复全流程",    col: "#EF4444" },
  { icon: Timer,    label: "任务调度",      desc: "定时执行和历史查看",  col: "#F59E0B" },
  { icon: FileText, label: "智能报告",      desc: "多维度数据可视化",    col: "#06B6D4" },
];

const LOG = [
  { t: "dim",  s: "# 2026-07-07 14:30:01  触发: 定时调度" },
  { t: "ok",   s: "✓  POST /api/v1/orders            200  142ms" },
  { t: "ok",   s: "✓  GET  /api/v1/orders/list       200   89ms" },
  { t: "ok",   s: "✓  PUT  /api/v1/orders/status     200  204ms" },
  { t: "fail", s: "✗  DELETE /api/v1/orders/52       500 3021ms" },
  { t: "warn", s: "△  超时 > 3s，已推送企业微信告警通知" },
  { t: "ai",   s: "◆  AI 分析: 建议增加重试断言，生成 3 个边界用例" },
  { t: "sum",  s: "▸  通过 47/48  失败 1  耗时 4m 22s" },
];

const WORKSPACES = [
  { id: "w1", name: "X-MAN",   desc: "电商平台 · 订单/风控全链路自动化",  members: 8,  role: "测试负责人", recent: true,  lastVisit: "今天 09:31" },
  { id: "w2", name: "KRATOS",  desc: "风控中台 · 规则引擎和策略测试",      members: 12, role: "测试工程师", recent: false, lastVisit: "3 天前" },
  { id: "w3", name: "MINERVA", desc: "数据平台 · BI 报表和数据质量测试",   members: 5,  role: "只读访客",   recent: false, lastVisit: "7 天前" },
];

const WS_COLORS = [BLU, "#8B5CF6", "#10B981"];

// ─── Custom checkbox ──────────────────────────────────────────────────────────
function Checkbox({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div onClick={onChange}
      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 cursor-pointer transition-all"
      style={{ border: `2px solid ${on ? BLU : "#C9CDD4"}`, backgroundColor: on ? BLU : "transparent" }}>
      {on && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.2 5.5L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// ─── Workspace selection ──────────────────────────────────────────────────────
function WorkspaceSelect({ onEnter, onBack }: { onEnter: () => void; onBack: () => void }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center"
      style={{ backgroundColor: "#F4F6FA", fontFamily: "'Inter','PingFang SC',sans-serif" }}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `linear-gradient(135deg,${BLU},#4F8EFF)` }}>
          <FlaskConical size={17} color="#fff" />
        </div>
        <span className="text-[17px] font-bold" style={{ color: LT1 }}>AutoTest</span>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-[22px] font-semibold mb-1.5" style={{ color: LT1 }}>选择工作区</h2>
        <p className="text-[13px]" style={{ color: LT3 }}>你的账号下有 {WORKSPACES.length} 个工作区</p>
      </div>

      <div className="flex flex-col gap-3" style={{ width: 660 }}>
        {WORKSPACES.map((ws, idx) => (
          <button key={ws.id} onClick={onEnter}
            className="bg-white rounded-2xl text-left flex items-center gap-4 transition-all"
            style={{ padding: "20px 24px", border: `1px solid ${LBR}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", cursor: "pointer", width: "100%" }}
            onMouseEnter={e => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = BLU;
              b.style.boxShadow = "0 4px 20px rgba(22,93,255,0.12)";
            }}
            onMouseLeave={e => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = LBR;
              b.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
            }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-[16px]"
              style={{ background: `linear-gradient(135deg,${WS_COLORS[idx % WS_COLORS.length]},${WS_COLORS[idx % WS_COLORS.length]}BB)` }}>
              {ws.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[15px] font-semibold" style={{ color: LT1 }}>{ws.name}</span>
                {ws.recent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: "#E8F3FF", color: BLU }}>最近访问</span>
                )}
                <span className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "#F2F3F5", color: LT3 }}>{ws.role}</span>
              </div>
              <div className="text-[12px] mb-1.5" style={{ color: LT3 }}>{ws.desc}</div>
              <div className="flex items-center gap-4 text-[11px]" style={{ color: "#C9CDD4" }}>
                <span>{ws.members} 名成员</span>
                <span>上次访问 {ws.lastVisit}</span>
              </div>
            </div>
            <ChevronRight size={16} color="#C9CDD4" />
          </button>
        ))}

        <button className="rounded-2xl text-[13px] transition-all"
          style={{ padding: "14px 24px", border: `1.5px dashed ${LBR}`, background: "transparent", color: LT3, cursor: "pointer" }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = BLU; b.style.color = BLU; }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = LBR; b.style.color = LT3; }}>
          + 创建新工作区 或 申请加入其他工作区
        </button>
      </div>

      <div className="mt-8 text-[12px]" style={{ color: "#C9CDD4" }}>
        不是你的账号？
        <button onClick={onBack}
          style={{ color: BLU, background: "none", border: "none", cursor: "pointer", fontSize: 12, marginLeft: 4 }}>
          退出登录
        </button>
      </div>
    </div>
  );
}

// ─── Login page ───────────────────────────────────────────────────────────────
export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [view, setView]         = useState<"login" | "workspace">("login");
  const [account, setAccount]   = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [aErr, setAErr]         = useState("");
  const [pErr, setPErr]         = useState("");

  const handleLogin = () => {
    let ok = true;
    if (!account.trim()) { setAErr("请输入账号"); ok = false; } else setAErr("");
    if (!password.trim()) { setPErr("请输入密码"); ok = false; } else setPErr("");
    if (!ok) return;
    setError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (password === "wrong") {
        setError("账号或密码错误，请检查后重试");
      } else {
        setView("workspace");
      }
    }, 1600);
  };

  const inputStyle = (hasErr: boolean, focused = false) => ({
    border: `1px solid ${hasErr ? "#F53F3F" : focused ? BLU : LBR}`,
    color: LT1, outline: "none", width: "100%", backgroundColor: "#fff",
    boxShadow: focused ? `0 0 0 3px ${hasErr ? "#F53F3F" : BLU}18` : "none",
  });

  if (view === "workspace") {
    return <WorkspaceSelect onEnter={onLogin} onBack={() => { setView("login"); setPassword(""); setError(""); }} />;
  }

  return (
    <div className="h-screen flex overflow-hidden"
      style={{ fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif", fontSize: 14 }}>

      {/* ── Left dark panel ────────────────────────────────────────────── */}
      <div className="flex flex-col h-full" style={{ width: "58%", backgroundColor: PNL, padding: "44px 52px" }}>

        {/* Logo row */}
        <div className="flex items-center gap-2.5 mb-12">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg,${BLU},#4F8EFF)` }}>
            <FlaskConical size={18} color="#fff" />
          </div>
          <span className="text-[18px] font-bold" style={{ color: TEXT }}>AutoTest</span>
          <span className="ml-1 text-[10px] px-2 py-0.5 rounded font-mono"
            style={{ backgroundColor: DBR, color: MTD, border: "1px solid #30363D" }}>v2.4.1</span>
        </div>

        {/* Headline */}
        <div className="mb-10">
          <h1 className="text-[27px] font-semibold leading-tight mb-3" style={{ color: TEXT }}>
            工程效率，<br />从测试开始
          </h1>
          <p className="text-[14px] leading-relaxed" style={{ color: MTD, maxWidth: 360 }}>
            AI 驱动的企业级自动化测试平台，<br />让质量保障不再成为交付的瓶颈
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-7">
          {FEATURES.map(f => (
            <div key={f.label} className="flex items-center gap-3 p-3 rounded-xl"
              style={{ backgroundColor: CARD, border: `1px solid ${DBR}` }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${f.col}22` }}>
                <f.icon size={14} style={{ color: f.col }} />
              </div>
              <div>
                <div className="text-[12px] font-medium" style={{ color: TEXT }}>{f.label}</div>
                <div className="text-[11px]" style={{ color: MTD }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Terminal log */}
        <div className="flex-1 rounded-xl overflow-hidden flex flex-col"
          style={{ backgroundColor: "#010409", border: `1px solid ${DBR}` }}>
          {/* Title bar */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 flex-shrink-0"
            style={{ backgroundColor: CARD, borderBottom: `1px solid ${DBR}` }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#F85149" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#E3B341" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#3FB950" }} />
            <span className="ml-3 text-[11px] font-mono" style={{ color: MTD }}>execution.log</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded font-mono"
              style={{ backgroundColor: "#1B2A1B", color: "#3FB950", border: "1px solid #2EA043" }}>● LIVE</span>
          </div>
          {/* Log lines */}
          <div className="flex-1 p-4 flex flex-col gap-1 overflow-hidden" style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: 11 }}>
            {LOG.map((line, i) => (
              <div key={i} style={{ color: LOG_C[line.t] }}>{line.s}</div>
            ))}
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-8 mt-5">
          {[
            { label: "今日执行",   value: "236 次",  color: TEXT },
            { label: "整体通过率", value: "93.6%",   color: "#3FB950" },
            { label: "在线 Runner",value: "6 个",    color: "#79C0FF" },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-[17px] font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10px] mt-0.5" style={{ color: MTD }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center h-full"
        style={{ width: "42%", backgroundColor: "#fff" }}>
        <div style={{ width: "100%", maxWidth: 360, padding: "0 40px" }}>

          {/* Top platform mark */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg,${BLU},#4F8EFF)` }}>
              <FlaskConical size={13} color="#fff" />
            </div>
            <span className="text-[13px] font-semibold" style={{ color: LT1 }}>AutoTest</span>
          </div>

          <h2 className="text-[24px] font-semibold mb-1.5" style={{ color: LT1 }}>欢迎回来</h2>
          <p className="text-[13px] mb-7" style={{ color: LT3 }}>请使用企业账号登录以继续使用平台</p>

          {/* Error alert */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl mb-5"
              style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFCCC7", padding: "12px 14px" }}>
              <AlertCircle size={15} color="#F53F3F" style={{ flexShrink: 0, marginTop: 1 }} />
              <span className="text-[13px]" style={{ color: "#F53F3F" }}>{error}</span>
            </div>
          )}

          {/* Account */}
          <div className="mb-4">
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: "#4E5969" }}>账号</label>
            <input type="text" placeholder="请输入邮箱或用户名"
              value={account}
              onChange={e => { setAccount(e.target.value); if (aErr) setAErr(""); if (error) setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="h-10 rounded-xl px-3.5 text-[14px] transition-all"
              style={inputStyle(!!aErr)}
              onFocus={e => { Object.assign(e.currentTarget.style, inputStyle(!!aErr, true)); }}
              onBlur={e => { Object.assign(e.currentTarget.style, inputStyle(!!aErr, false)); }}
            />
            {aErr && <p className="text-[12px] mt-1.5" style={{ color: "#F53F3F" }}>{aErr}</p>}
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="block text-[13px] font-medium mb-1.5" style={{ color: "#4E5969" }}>密码</label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} placeholder="请输入密码"
                value={password}
                onChange={e => { setPassword(e.target.value); if (pErr) setPErr(""); if (error) setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                className="h-10 rounded-xl pl-3.5 pr-10 text-[14px] transition-all"
                style={inputStyle(!!pErr)}
                onFocus={e => { Object.assign(e.currentTarget.style, inputStyle(!!pErr, true)); }}
                onBlur={e => { Object.assign(e.currentTarget.style, inputStyle(!!pErr, false)); }}
              />
              <button onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-2.5 transition-colors"
                style={{ background: "none", border: "none", cursor: "pointer", color: showPw ? LT3 : "#C9CDD4", padding: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = LT3; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = showPw ? LT3 : "#C9CDD4"; }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {pErr && <p className="text-[12px] mt-1.5" style={{ color: "#F53F3F" }}>{pErr}</p>}
          </div>

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between mb-6">
            <label className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setRemember(!remember)}>
              <Checkbox on={remember} onChange={() => setRemember(!remember)} />
              <span className="text-[13px]" style={{ color: "#4E5969" }}>记住账号</span>
            </label>
            <button style={{ color: BLU, background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
              忘记密码
            </button>
          </div>

          {/* Login button */}
          <button onClick={handleLogin} disabled={loading}
            className="w-full h-10 rounded-xl text-white text-[14px] font-medium flex items-center justify-center gap-2 transition-all"
            style={{ backgroundColor: loading ? "#94BFFF" : BLU, border: "none", cursor: loading ? "not-allowed" : "pointer" }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = ""; }}>
            {loading ? <><Loader2 size={15} className="animate-spin" />登录中...</> : "登录"}
          </button>

          {/* Network error demo hint */}
          <div className="mt-4 text-center">
            <span className="text-[11px]" style={{ color: "#C9CDD4" }}>
              输入密码 &ldquo;wrong&rdquo; 可演示错误状态
            </span>
          </div>

          {/* Footer */}
          <p className="text-[11px] text-center mt-7" style={{ color: "#C9CDD4" }}>
            如需账号，请联系管理员邀请 · AutoTest v2.4.1
          </p>
        </div>
      </div>
    </div>
  );
}
