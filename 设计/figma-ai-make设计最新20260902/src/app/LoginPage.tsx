import { useState, useEffect } from "react";
import {
  Eye, EyeOff, AlertCircle, Loader2, FlaskConical, ChevronRight,
  Bot, Globe2, Bug, FileText, Timer, Activity,
  Plus, Users, Search, ArrowLeft, CheckCircle2, Clock,
  Building2, Send, XCircle, ChevronDown, Mail, KeyRound, RotateCcw,
} from "lucide-react";

// ─── Palette ──────────────────────────────────────────────────────────────────
const PNL  = "#0D1117";
const CARD = "#161B22";
const DBR  = "#21262D";
const TEXT = "#E6EDF3";
const MTD  = "#7D8590";
const BLU  = "#165DFF";
const LBR  = "#E5E6EB";
const LT1  = "#1D2129";
const LT2  = "#4E5969";
const LT3  = "#86909C";
const LT4  = "#C9CDD4";
const SUC  = "#00B42A";
const DAN  = "#F53F3F";
const BG   = "#F4F6FA";

const LOG_C: Record<string,string> = {
  ok:"#3FB950", fail:"#F85149", warn:"#E3B341",
  ai:"#A78BFA", dim:"#7D8590", sum:"#79C0FF",
};

// ─── Static data ──────────────────────────────────────────────────────────────
const FEATURES = [
  { icon:Bot,      label:"AI 用例生成",   desc:"需求驱动，自动生成",  col:"#8B5CF6" },
  { icon:Globe2,   label:"接口自动化",    desc:"场景化测试套件执行",  col:BLU       },
  { icon:Activity, label:"Web UI 自动化", desc:"录制 + AI 优化断言",  col:"#10B981" },
  { icon:Bug,      label:"缺陷追踪",      desc:"发现到修复全流程",    col:"#EF4444" },
  { icon:Timer,    label:"任务调度",      desc:"定时执行和历史查看",  col:"#F59E0B" },
  { icon:FileText, label:"智能报告",      desc:"多维度数据可视化",    col:"#06B6D4" },
];

const LOG = [
  { t:"dim",  s:"# 2026-07-07 14:30:01  触发: 定时调度" },
  { t:"ok",   s:"✓  POST /api/v1/orders            200  142ms" },
  { t:"ok",   s:"✓  GET  /api/v1/orders/list       200   89ms" },
  { t:"ok",   s:"✓  PUT  /api/v1/orders/status     200  204ms" },
  { t:"fail", s:"✗  DELETE /api/v1/orders/52       500 3021ms" },
  { t:"warn", s:"△  超时 > 3s，已推送企业微信告警通知" },
  { t:"ai",   s:"◆  AI 分析: 建议增加重试断言，生成 3 个边界用例" },
  { t:"sum",  s:"▸  通过 47/48  失败 1  耗时 4m 22s" },
];

// 当前用户已加入的工作区
const INIT_MY_WS = [
  { id:"w1", name:"X-MAN",   desc:"电商平台 · 订单/风控全链路自动化",  members:8,  role:"测试负责人", lastVisit:"今天 09:31", recent:true  },
  { id:"w2", name:"KRATOS",  desc:"风控中台 · 规则引擎和策略测试",      members:12, role:"测试工程师", lastVisit:"3 天前",     recent:false },
  { id:"w3", name:"MINERVA", desc:"数据平台 · BI 报表和数据质量测试",   members:5,  role:"只读访客",   lastVisit:"7 天前",     recent:false },
];

// 平台上其他可申请加入的工作区
const PUBLIC_WS = [
  { id:"p1", name:"PHOENIX", desc:"支付中台 · 资金账户和清结算测试",   members:6,  owner:"支付团队"   },
  { id:"p2", name:"TITAN",   desc:"基础设施 · 网关和微服务压测平台",   members:3,  owner:"基础架构组"  },
  { id:"p3", name:"APOLLO",  desc:"用户中台 · 账号体系和权限管理测试", members:9,  owner:"用户中心"   },
  { id:"p4", name:"HERMES",  desc:"消息中台 · 推送和消息队列测试",     members:4,  owner:"消息团队"   },
  { id:"p5", name:"ORION",   desc:"营销中心 · 活动、券和推广自动化",   members:7,  owner:"增长团队"   },
];

const INDUSTRIES = ["电商 / 零售","金融 / 支付","政务 / 公共服务","医疗 / 健康",
                    "教育 / 培训","游戏 / 娱乐","企业服务 / SaaS","其他"];
const WS_COLORS  = [BLU,"#8B5CF6","#10B981","#F59E0B","#EF4444","#06B6D4"];

type LoginView = "login"|"workspace"|"no-workspace"|"create-ws"|"join-ws"|"pending"|"forgot"|"forgot-sent"|"reset-pw";
type MyWs = typeof INIT_MY_WS[number];

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function WsAvatar({ name, idx, size=48 }:{ name:string; idx:number; size?:number }) {
  const c = WS_COLORS[idx % WS_COLORS.length];
  return (
    <div style={{ width:size, height:size, borderRadius:size*0.26, flexShrink:0,
      background:`linear-gradient(135deg,${c},${c}99)`,
      display:"flex", alignItems:"center", justifyContent:"center",
      color:"#fff", fontWeight:700, fontSize:size*0.35 }}>
      {name[0]}
    </div>
  );
}

function PageShell({ children, width=560 }:{ children:React.ReactNode; width?:number }) {
  return (
    <div style={{ minHeight:"100vh", background:BG, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:"40px 20px",
      fontFamily:"'Inter','PingFang SC',sans-serif" }}>
      <div style={{ width, maxWidth:"100%" }}>{children}</div>
    </div>
  );
}

function SysIcon({ size=16 }:{ size?:number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="5.5" r="3" fill="white"/>
      <circle cx="7" cy="23" r="3" fill="white"/>
      <circle cx="25" cy="23" r="3" fill="white"/>
      <line x1="14.1" y1="8.1" x2="9" y2="20.3" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="17.9" y1="8.1" x2="23" y2="20.3" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="10" y1="23" x2="22" y2="23" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function PageLogo() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:28 }}>
      <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
        background:`linear-gradient(135deg,${BLU},#4F8EFF)`,
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:"0 2px 10px rgba(22,93,255,0.35)" }}>
        <SysIcon size={18}/>
      </div>
      <span style={{ fontSize:17, fontWeight:700, color:LT1 }}>AutoTest</span>
    </div>
  );
}

function BackBtn({ onClick, label="返回" }:{ onClick:()=>void; label?:string }) {
  return (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:5,
      background:"none", border:"none", cursor:"pointer", color:LT3, fontSize:13, padding:0, marginBottom:20 }}
      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=LT2}
      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=LT3}>
      <ArrowLeft size={14}/>{label}
    </button>
  );
}

// ─── Checkbox (login form only) ───────────────────────────────────────────────
function Checkbox({ on, onChange }:{ on:boolean; onChange:()=>void }) {
  return (
    <div onClick={onChange} style={{ width:16, height:16, borderRadius:4, flexShrink:0, cursor:"pointer",
      border:`2px solid ${on?BLU:LT4}`, backgroundColor:on?BLU:"transparent",
      display:"flex", alignItems:"center", justifyContent:"center" }}>
      {on && <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
        <path d="M1 3.5L3.2 5.5L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>}
    </div>
  );
}

// ─── View 1: WorkspaceSelect ──────────────────────────────────────────────────
function WorkspaceSelect({ workspaces, onEnter, onBack, onCreate, onJoin, onDemoEmpty }:{
  workspaces:MyWs[]; onEnter:()=>void; onBack:()=>void;
  onCreate:()=>void; onJoin:()=>void; onDemoEmpty:()=>void;
}) {
  return (
    <PageShell width={680}>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
        <PageLogo/>
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <h2 style={{ fontSize:22, fontWeight:600, color:LT1, margin:"0 0 8px" }}>选择工作区</h2>
          <p style={{ fontSize:13, color:LT3, margin:0 }}>你的账号下有 {workspaces.length} 个工作区</p>
        </div>

        <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:10 }}>
          {workspaces.map((ws,idx) => (
            <button key={ws.id} onClick={onEnter}
              style={{ background:"#fff", borderRadius:16, textAlign:"left", display:"flex",
                alignItems:"center", gap:16, padding:"18px 22px",
                border:`1px solid ${LBR}`, boxShadow:"0 1px 4px rgba(0,0,0,0.04)",
                cursor:"pointer", width:"100%", transition:"all 0.15s" }}
              onMouseEnter={e=>{ const b=e.currentTarget; b.style.borderColor=BLU; b.style.boxShadow="0 4px 20px rgba(22,93,255,0.12)"; }}
              onMouseLeave={e=>{ const b=e.currentTarget; b.style.borderColor=LBR; b.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"; }}>
              <WsAvatar name={ws.name} idx={idx}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5 }}>
                  <span style={{ fontSize:15, fontWeight:600, color:LT1 }}>{ws.name}</span>
                  {ws.recent && <span style={{ fontSize:10, padding:"2px 7px", borderRadius:10, background:"#E8F3FF", color:BLU, fontWeight:500 }}>最近访问</span>}
                  <span style={{ fontSize:10, padding:"2px 7px", borderRadius:10, background:"#F2F3F5", color:LT3 }}>{ws.role}</span>
                </div>
                <div style={{ fontSize:12, color:LT3, marginBottom:4 }}>{ws.desc}</div>
                <div style={{ display:"flex", gap:16, fontSize:11, color:LT4 }}>
                  <span>{ws.members} 名成员</span>
                  <span>上次访问 {ws.lastVisit}</span>
                </div>
              </div>
              <ChevronRight size={16} color={LT4}/>
            </button>
          ))}

          {/* 创建 / 申请加入 — 两个独立操作按钮 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <button onClick={onCreate}
              style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                padding:"14px", borderRadius:14, border:`1.5px dashed ${LBR}`,
                background:"transparent", color:LT2, cursor:"pointer", fontSize:13, fontWeight:500,
                transition:"all 0.15s" }}
              onMouseEnter={e=>{ const b=e.currentTarget; b.style.borderColor=BLU; b.style.color=BLU; b.style.background=`${BLU}07`; }}
              onMouseLeave={e=>{ const b=e.currentTarget; b.style.borderColor=LBR; b.style.color=LT2; b.style.background="transparent"; }}>
              <Plus size={15}/> 创建新工作区
            </button>
            <button onClick={onJoin}
              style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                padding:"14px", borderRadius:14, border:`1.5px dashed ${LBR}`,
                background:"transparent", color:LT2, cursor:"pointer", fontSize:13, fontWeight:500,
                transition:"all 0.15s" }}
              onMouseEnter={e=>{ const b=e.currentTarget; b.style.borderColor="#8B5CF6"; b.style.color="#8B5CF6"; b.style.background="#F5EEFF"; }}
              onMouseLeave={e=>{ const b=e.currentTarget; b.style.borderColor=LBR; b.style.color=LT2; b.style.background="transparent"; }}>
              <Users size={15}/> 申请加入工作区
            </button>
          </div>
        </div>

        <div style={{ marginTop:20, fontSize:12, color:LT4, display:"flex", gap:12, alignItems:"center" }}>
          <span>不是你的账号？
            <button onClick={onBack} style={{ color:BLU, background:"none", border:"none", cursor:"pointer", fontSize:12, marginLeft:4 }}>退出登录</button>
          </span>
          <span style={{ color:LT4 }}>·</span>
          <button onClick={onDemoEmpty} style={{ color:LT4, background:"none", border:"none", cursor:"pointer", fontSize:12 }}>演示无工作区状态</button>
        </div>
      </div>
    </PageShell>
  );
}

// ─── View 2: NoWorkspaceEmpty ─────────────────────────────────────────────────
function NoWorkspaceEmpty({ onCreate, onJoin, onBack }:{
  onCreate:()=>void; onJoin:()=>void; onBack:()=>void;
}) {
  return (
    <PageShell width={460}>
      <PageLogo/>
      <div style={{ textAlign:"center", marginBottom:28 }}>
        <div style={{ width:72, height:72, borderRadius:20, background:"#F0F3F8",
          display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
          <Building2 size={32} color={LT4}/>
        </div>
        <h2 style={{ fontSize:22, fontWeight:600, color:LT1, margin:"0 0 10px" }}>你还没有工作区</h2>
        <p style={{ fontSize:13, color:LT3, lineHeight:1.7, margin:0 }}>
          工作区是团队协作的基本单元，包含用例、自动化任务和测试报告。<br/>
          创建一个属于你的工作区，或申请加入已有工作区开始使用。
        </p>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <button onClick={onCreate}
          style={{ width:"100%", padding:"18px 22px", borderRadius:16, border:"none",
            background:BLU, color:"#fff", cursor:"pointer",
            display:"flex", alignItems:"center", gap:14, textAlign:"left",
            transition:"filter 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.08)"}
          onMouseLeave={e=>e.currentTarget.style.filter=""}>
          <div style={{ width:40, height:40, borderRadius:10, background:"rgba(255,255,255,0.2)",
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Plus size={20} color="#fff"/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:3 }}>创建新工作区</div>
            <div style={{ fontSize:12, opacity:0.8 }}>从零开始配置，你将成为超级管理员</div>
          </div>
          <ChevronRight size={16} color="rgba(255,255,255,0.6)"/>
        </button>

        <button onClick={onJoin}
          style={{ width:"100%", padding:"18px 22px", borderRadius:16,
            border:`1.5px solid ${LBR}`, background:"#fff", color:LT1, cursor:"pointer",
            display:"flex", alignItems:"center", gap:14, textAlign:"left",
            boxShadow:"0 1px 4px rgba(0,0,0,0.04)", transition:"all 0.15s" }}
          onMouseEnter={e=>{ const b=e.currentTarget; b.style.borderColor="#8B5CF6"; b.style.boxShadow="0 4px 16px rgba(139,92,246,0.1)"; }}
          onMouseLeave={e=>{ const b=e.currentTarget; b.style.borderColor=LBR; b.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"; }}>
          <div style={{ width:40, height:40, borderRadius:10, background:"#F5EEFF",
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Users size={20} color="#8B5CF6"/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, color:LT1, marginBottom:3 }}>申请加入已有工作区</div>
            <div style={{ fontSize:12, color:LT3 }}>搜索工作区或使用邀请码加入团队</div>
          </div>
          <ChevronRight size={16} color={LT4}/>
        </button>
      </div>

      <div style={{ textAlign:"center", marginTop:20 }}>
        <button onClick={onBack} style={{ color:LT3, background:"none", border:"none", cursor:"pointer", fontSize:12 }}>
          ← 返回登录
        </button>
      </div>
    </PageShell>
  );
}

// ─── View 3: CreateWorkspace ──────────────────────────────────────────────────
function CreateWorkspace({ onBack, onSuccess }:{
  onBack:()=>void; onSuccess:(name:string)=>void;
}) {
  const [name,     setName]     = useState("");
  const [desc,     setDesc]     = useState("");
  const [industry, setIndustry] = useState("");
  const [template, setTemplate] = useState<"blank"|"sample">("blank");
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [nameErr,  setNameErr]  = useState("");

  const handleNameChange = (v:string) => {
    setName(v); if (nameErr) setNameErr("");
  };

  const handleCreate = () => {
    if (!name.trim()) { setNameErr("请输入工作区名称"); return; }
    setLoading(true);
    setTimeout(()=>{ setLoading(false); setDone(true); }, 1500);
  };

  const inp: React.CSSProperties = {
    width:"100%", height:38, borderRadius:9, border:`1px solid ${LBR}`,
    padding:"0 12px", fontSize:13, color:LT1, outline:"none",
    background:"#fff", boxSizing:"border-box",
  };

  if (done) return (
    <PageShell width={460}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:72, height:72, borderRadius:20, background:"#E8FFEA",
          display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
          <CheckCircle2 size={36} color={SUC}/>
        </div>
        <h2 style={{ fontSize:22, fontWeight:600, color:LT1, margin:"0 0 10px" }}>工作区已创建</h2>
        <p style={{ fontSize:13, color:LT3, marginBottom:24 }}>
          工作区 <strong style={{ color:LT1 }}>{name}</strong> 已成功创建，你已被设为超级管理员。
        </p>
        <div style={{ background:"#fff", borderRadius:16, padding:"18px 20px",
          border:`1px solid ${LBR}`, display:"flex", alignItems:"center", gap:14,
          marginBottom:24, textAlign:"left", boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
          <WsAvatar name={name} idx={0}/>
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:LT1, marginBottom:4 }}>{name}</div>
            <div style={{ fontSize:11, color:LT4 }}>1 名成员 · 刚刚创建</div>
          </div>
        </div>
        <button onClick={()=>onSuccess(name)}
          style={{ width:"100%", height:44, borderRadius:12, border:"none",
            background:BLU, color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600 }}
          onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.08)"}
          onMouseLeave={e=>e.currentTarget.style.filter=""}>
          进入工作区 →
        </button>
      </div>
    </PageShell>
  );

  return (
    <PageShell width={560}>
      <PageLogo/>
      <BackBtn onClick={onBack} label="返回工作区选择"/>

      <div style={{ background:"#fff", borderRadius:20, border:`1px solid ${LBR}`,
        padding:"28px 32px", boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ marginBottom:24 }}>
          <h2 style={{ fontSize:20, fontWeight:600, color:LT1, margin:"0 0 6px" }}>创建工作区</h2>
          <p style={{ fontSize:13, color:LT3, margin:0 }}>工作区是团队和项目的容器，创建后可邀请成员加入。</p>
        </div>

        {/* 名称 */}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:500, color:LT2, marginBottom:6 }}>
            工作区名称 <span style={{ color:DAN }}>*</span>
          </label>
          <input value={name} onChange={e=>handleNameChange(e.target.value)}
            placeholder="例如：X-MAN、订单中心测试团队"
            style={{ ...inp, borderColor:nameErr?DAN:LBR }}
            onFocus={e=>{ e.currentTarget.style.borderColor=BLU; e.currentTarget.style.boxShadow=`0 0 0 3px ${BLU}18`; }}
            onBlur={e=>{ e.currentTarget.style.borderColor=nameErr?DAN:LBR; e.currentTarget.style.boxShadow="none"; }}/>
          {nameErr && <p style={{ fontSize:12, color:DAN, marginTop:5 }}>{nameErr}</p>}
        </div>

        {/* 描述 */}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:500, color:LT2, marginBottom:6 }}>工作区描述（选填）</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3}
            placeholder="简要描述该工作区的用途和覆盖的业务范围"
            style={{ ...inp, height:"auto", padding:"10px 12px", resize:"none", lineHeight:1.6 }}
            onFocus={e=>{ e.currentTarget.style.borderColor=BLU; e.currentTarget.style.boxShadow=`0 0 0 3px ${BLU}18`; }}
            onBlur={e=>{ e.currentTarget.style.borderColor=LBR; e.currentTarget.style.boxShadow="none"; }}/>
        </div>

        {/* 行业 */}
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:500, color:LT2, marginBottom:6 }}>所属行业（选填）</label>
          <div style={{ position:"relative" }}>
            <select value={industry} onChange={e=>setIndustry(e.target.value)}
              style={{ ...inp, appearance:"none", paddingRight:32, color:industry?LT1:LT4 }}>
              <option value="">请选择所属行业</option>
              {INDUSTRIES.map(i=><option key={i} value={i}>{i}</option>)}
            </select>
            <ChevronDown size={13} color={LT4} style={{ position:"absolute", right:10, top:13, pointerEvents:"none" }}/>
          </div>
        </div>

        {/* 初始化数据 */}
        <div style={{ marginBottom:24 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:500, color:LT2, marginBottom:8 }}>初始化数据</label>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {([
              { v:"blank",  title:"空白工作区",   desc:"从零开始，适合自定义需求"   },
              { v:"sample", title:"导入示例数据", desc:"预置用例，快速熟悉平台功能"  },
            ] as const).map(opt=>(
              <button key={opt.v} onClick={()=>setTemplate(opt.v)}
                style={{ padding:"13px 15px", borderRadius:12, cursor:"pointer", textAlign:"left",
                  border:`1.5px solid ${template===opt.v?BLU:LBR}`,
                  background:template===opt.v?`${BLU}08`:"#FAFBFE" }}>
                <div style={{ fontSize:13, fontWeight:600, color:template===opt.v?BLU:LT1, marginBottom:3 }}>{opt.title}</div>
                <div style={{ fontSize:11, color:LT3, lineHeight:1.5 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onBack}
            style={{ flex:1, height:40, borderRadius:10, border:`1px solid ${LBR}`,
              background:"#fff", color:LT2, cursor:"pointer", fontSize:13, fontWeight:500 }}>
            取消
          </button>
          <button onClick={handleCreate} disabled={loading}
            style={{ flex:2, height:40, borderRadius:10, border:"none",
              background:loading?"#94BFFF":BLU, color:"#fff",
              cursor:loading?"not-allowed":"pointer", fontSize:13, fontWeight:600,
              display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
            {loading?<><Loader2 size={14} className="animate-spin"/>创建中...</>:"创建工作区"}
          </button>
        </div>
      </div>
    </PageShell>
  );
}

// ─── View 4: JoinWorkspace ────────────────────────────────────────────────────
function JoinWorkspace({ onBack, onApplied }:{
  onBack:()=>void;
  onApplied:(ws:{name:string;desc:string})=>void;
}) {
  const [tab,      setTab]      = useState<"search"|"code">("search");
  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState<string|null>(null);
  const [code,     setCode]     = useState("");
  const [codeErr,  setCodeErr]  = useState("");
  const [applying, setApplying] = useState(false);

  const filtered = PUBLIC_WS.filter(w =>
    !query || w.name.toLowerCase().includes(query.toLowerCase()) || w.desc.includes(query)
  );

  const doApply = (ws:{name:string;desc:string}) => {
    setApplying(true);
    setTimeout(()=>{ setApplying(false); onApplied(ws); }, 1200);
  };

  const handleApplyCode = () => {
    if (code.trim().length < 6) { setCodeErr("邀请码格式不正确，请检查后重试"); return; }
    setCodeErr("");
    doApply({ name:"PHOENIX", desc:"支付中台 · 资金账户和清结算测试" });
  };

  return (
    <PageShell width={580}>
      <PageLogo/>
      <BackBtn onClick={onBack} label="返回工作区选择"/>

      <div style={{ background:"#fff", borderRadius:20, border:`1px solid ${LBR}`,
        boxShadow:"0 2px 12px rgba(0,0,0,0.05)", overflow:"hidden" }}>
        <div style={{ padding:"28px 32px 0" }}>
          <h2 style={{ fontSize:20, fontWeight:600, color:LT1, margin:"0 0 6px" }}>申请加入工作区</h2>
          <p style={{ fontSize:13, color:LT3, margin:"0 0 20px" }}>
            搜索平台上的工作区，或使用管理员提供的邀请码直接加入。
          </p>
          {/* Tabs */}
          <div style={{ display:"flex", borderBottom:`1px solid ${LBR}` }}>
            {([["search","搜索工作区"],["code","邀请码加入"]] as const).map(([t,label])=>(
              <button key={t} onClick={()=>setTab(t)}
                style={{ padding:"10px 18px", fontSize:13, fontWeight:tab===t?600:400,
                  border:"none", borderBottom:`2px solid ${tab===t?BLU:"transparent"}`,
                  background:"transparent", color:tab===t?BLU:LT3, cursor:"pointer" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab==="search" && (
          <div style={{ padding:"20px 32px 28px" }}>
            <div style={{ position:"relative", marginBottom:14 }}>
              <Search size={14} color={LT4} style={{ position:"absolute", left:11, top:12 }}/>
              <input value={query} onChange={e=>setQuery(e.target.value)}
                placeholder="搜索工作区名称或描述…"
                style={{ width:"100%", height:38, borderRadius:9, border:`1px solid ${LBR}`,
                  paddingLeft:32, paddingRight:12, fontSize:13, color:LT1, outline:"none", boxSizing:"border-box" }}
                onFocus={e=>{ e.currentTarget.style.borderColor=BLU; e.currentTarget.style.boxShadow=`0 0 0 3px ${BLU}18`; }}
                onBlur={e=>{ e.currentTarget.style.borderColor=LBR; e.currentTarget.style.boxShadow="none"; }}/>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:260, overflowY:"auto" }}>
              {filtered.length===0
                ? <div style={{ textAlign:"center", padding:"28px 0", color:LT4, fontSize:13 }}>未找到匹配的工作区</div>
                : filtered.map((ws,idx)=>(
                  <button key={ws.id} onClick={()=>setSelected(selected===ws.id?null:ws.id)}
                    style={{ display:"flex", alignItems:"center", gap:13, padding:"13px 15px",
                      borderRadius:12, cursor:"pointer", textAlign:"left", transition:"all 0.12s",
                      border:`1.5px solid ${selected===ws.id?BLU:LBR}`,
                      background:selected===ws.id?`${BLU}07`:"#FAFBFE" }}
                    onMouseEnter={e=>{ if(selected!==ws.id) e.currentTarget.style.borderColor=LT3; }}
                    onMouseLeave={e=>{ if(selected!==ws.id) e.currentTarget.style.borderColor=LBR; }}>
                    <WsAvatar name={ws.name} idx={idx} size={40}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, color:selected===ws.id?BLU:LT1, marginBottom:3 }}>{ws.name}</div>
                      <div style={{ fontSize:11, color:LT3 }}>{ws.desc}</div>
                      <div style={{ fontSize:10, color:LT4, marginTop:2 }}>{ws.members} 名成员 · 负责人：{ws.owner}</div>
                    </div>
                    <div style={{ width:18, height:18, borderRadius:"50%", flexShrink:0,
                      border:`2px solid ${selected===ws.id?BLU:LT4}`,
                      background:selected===ws.id?BLU:"transparent",
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {selected===ws.id&&<div style={{ width:6, height:6, borderRadius:"50%", background:"#fff" }}/>}
                    </div>
                  </button>
                ))
              }
            </div>

            {selected && (
              <button onClick={()=>{ const ws=PUBLIC_WS.find(w=>w.id===selected)!; doApply(ws); }}
                disabled={applying}
                style={{ width:"100%", height:40, marginTop:16, borderRadius:10, border:"none",
                  background:applying?"#94BFFF":BLU, color:"#fff",
                  cursor:applying?"not-allowed":"pointer", fontSize:13, fontWeight:600,
                  display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                {applying
                  ?<><Loader2 size={14} className="animate-spin"/>提交申请中...</>
                  :<><Send size={13}/>申请加入 {PUBLIC_WS.find(w=>w.id===selected)?.name}</>
                }
              </button>
            )}
          </div>
        )}

        {tab==="code" && (
          <div style={{ padding:"24px 32px 28px" }}>
            <div style={{ background:"#F8F9FC", borderRadius:12, padding:"20px",
              marginBottom:16, border:`1px solid ${LBR}` }}>
              <div style={{ fontSize:12, fontWeight:500, color:LT2, marginBottom:10 }}>输入邀请码</div>
              <input value={code} onChange={e=>{ setCode(e.target.value.toUpperCase()); setCodeErr(""); }}
                placeholder="例如：XMAN-8F2K"
                maxLength={12}
                style={{ width:"100%", height:48, borderRadius:10, boxSizing:"border-box",
                  border:`1.5px solid ${codeErr?DAN:LBR}`, padding:"0 16px",
                  fontSize:20, fontWeight:700, color:LT1, outline:"none",
                  letterSpacing:4, textAlign:"center", fontFamily:"monospace" }}
                onFocus={e=>{ e.currentTarget.style.borderColor=codeErr?DAN:BLU; e.currentTarget.style.boxShadow=`0 0 0 3px ${codeErr?DAN:BLU}18`; }}
                onBlur={e=>{ e.currentTarget.style.borderColor=codeErr?DAN:LBR; e.currentTarget.style.boxShadow="none"; }}/>
              {codeErr&&<p style={{ fontSize:12, color:DAN, marginTop:8 }}>{codeErr}</p>}
            </div>
            <p style={{ fontSize:12, color:LT3, lineHeight:1.7, marginBottom:20 }}>
              邀请码由工作区管理员在「系统设置 → 用户管理」中生成，有效期 7 天。
              请联系管理员获取最新邀请码。
            </p>
            <button onClick={handleApplyCode} disabled={applying||!code.trim()}
              style={{ width:"100%", height:40, borderRadius:10, border:"none",
                background:(applying||!code.trim())?"#94BFFF":BLU, color:"#fff",
                cursor:(applying||!code.trim())?"not-allowed":"pointer",
                fontSize:13, fontWeight:600,
                display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
              {applying?<><Loader2 size={14} className="animate-spin"/>验证中...</>:"使用邀请码加入"}
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}

// ─── View 5: PendingApproval ──────────────────────────────────────────────────
function PendingApproval({ workspace, onBackToList, onCancel }:{
  workspace:{name:string;desc:string};
  onBackToList:()=>void; onCancel:()=>void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const handleCancel = () => { setCancelling(true); setTimeout(()=>{ setCancelling(false); onCancel(); }, 800); };

  return (
    <PageShell width={460}>
      <PageLogo/>
      <div style={{ textAlign:"center", marginBottom:24 }}>
        <div style={{ width:72, height:72, borderRadius:20, background:"#FFF5E8",
          display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px" }}>
          <Clock size={34} color="#FF7D00"/>
        </div>
        <h2 style={{ fontSize:22, fontWeight:600, color:LT1, margin:"0 0 10px" }}>申请已提交</h2>
        <p style={{ fontSize:13, color:LT3, lineHeight:1.7, margin:0 }}>
          你的申请已发送给工作区管理员。<br/>
          审批通过后你将收到邮件通知，届时可重新登录进入工作区。
        </p>
      </div>

      {/* 申请详情 */}
      <div style={{ background:"#fff", borderRadius:16, padding:"18px 20px",
        border:`1px solid ${LBR}`, marginBottom:14, boxShadow:"0 1px 6px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize:10, fontWeight:600, color:LT4, textTransform:"uppercase",
          letterSpacing:"0.08em", marginBottom:12 }}>申请详情</div>
        <div style={{ display:"flex", alignItems:"center", gap:13, marginBottom:14,
          paddingBottom:14, borderBottom:`1px solid ${LBR}` }}>
          <WsAvatar name={workspace.name} idx={0}/>
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:LT1, marginBottom:4 }}>{workspace.name}</div>
            <div style={{ fontSize:12, color:LT3 }}>{workspace.desc}</div>
          </div>
        </div>
        {[
          ["申请状态", <span style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:"#FF7D00", display:"inline-block" }}/>
            <span style={{ color:"#FF7D00", fontWeight:500 }}>等待管理员审批</span>
          </span>],
          ["提交时间", <span style={{ color:LT2 }}>刚刚</span>],
          ["预计时效", <span style={{ color:LT2 }}>通常 1 个工作日内完成</span>],
        ].map(([lbl,val],i)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            fontSize:12, marginBottom: i < 2 ? 8 : 0 }}>
            <span style={{ color:LT3 }}>{lbl}</span>{val}
          </div>
        ))}
      </div>

      {/* 提示 */}
      <div style={{ background:"#EBF3FF", borderRadius:12, padding:"12px 15px",
        border:"1px solid #B3D0FF", marginBottom:20, display:"flex", gap:10 }}>
        <AlertCircle size={14} color={BLU} style={{ flexShrink:0, marginTop:1 }}/>
        <p style={{ fontSize:12, color:"#1248AA", lineHeight:1.6, margin:0 }}>
          如审批长时间未处理，可联系工作区管理员催办。通知将发送至你的注册邮箱。
        </p>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <button onClick={onBackToList}
          style={{ width:"100%", height:42, borderRadius:11, border:"none",
            background:BLU, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>
          返回工作区列表
        </button>
        <button onClick={handleCancel} disabled={cancelling}
          style={{ width:"100%", height:38, borderRadius:11, border:`1px solid ${LBR}`,
            background:"transparent", color:cancelling?LT4:DAN,
            cursor:cancelling?"not-allowed":"pointer", fontSize:13,
            display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          {cancelling?<><Loader2 size={13} className="animate-spin"/>撤销中...</>:<><XCircle size={13}/>撤销申请</>}
        </button>
      </div>
    </PageShell>
  );
}

// ─── Forgot password — Step 1: enter email ────────────────────────────────────
function ForgotView({ onBack, onSent }:{ onBack:()=>void; onSent:(email:string)=>void }) {
  const [email, setEmail] = useState("");
  const [err,   setErr]   = useState("");
  const submit = () => {
    if (!email.trim())          { setErr("请输入邮箱地址"); return; }
    if (!email.includes("@"))   { setErr("请输入有效的邮箱地址"); return; }
    setErr(""); onSent(email);
  };
  return (
    <PageShell width={460}>
      <PageLogo/>
      <BackBtn onClick={onBack} label="返回登录"/>
      <div style={{ background:"#fff", borderRadius:16, padding:"32px 36px",
        boxShadow:"0 2px 16px rgba(0,0,0,0.08)", border:`1px solid ${LBR}` }}>
        <div style={{ width:48, height:48, borderRadius:12, background:"#E8F3FF",
          display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20 }}>
          <Mail size={22} color={BLU}/>
        </div>
        <h2 style={{ fontSize:20, fontWeight:700, color:LT1, margin:"0 0 8px" }}>找回密码</h2>
        <p style={{ fontSize:13, color:LT3, margin:"0 0 24px", lineHeight:1.6 }}>
          输入你注册时使用的邮箱，我们将向该邮箱发送密码重置链接。
        </p>
        <label style={{ display:"block", fontSize:13, fontWeight:500, color:LT2, marginBottom:6 }}>
          注册邮箱 <span style={{ color:DAN }}>*</span>
        </label>
        <input type="email" placeholder="请输入邮箱地址" value={email}
          onChange={e=>{ setEmail(e.target.value); if(err) setErr(""); }}
          onKeyDown={e=>e.key==="Enter"&&submit()}
          style={{ width:"100%", height:40, border:`1px solid ${err?DAN:LBR}`, borderRadius:10,
            padding:"0 14px", fontSize:14, color:LT1, outline:"none",
            boxSizing:"border-box", background:"#fff" }}
          onFocus={e=>{ e.currentTarget.style.borderColor=err?DAN:BLU;
            e.currentTarget.style.boxShadow=`0 0 0 3px ${err?DAN:BLU}18`; }}
          onBlur={e=>{ e.currentTarget.style.borderColor=err?DAN:LBR;
            e.currentTarget.style.boxShadow="none"; }}/>
        {err && <p style={{ fontSize:12, color:DAN, marginTop:6 }}>{err}</p>}
        <button onClick={submit}
          style={{ width:"100%", height:40, marginTop:20, borderRadius:10, border:"none",
            background:BLU, color:"#fff", fontSize:14, fontWeight:500, cursor:"pointer" }}
          onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.08)"}
          onMouseLeave={e=>e.currentTarget.style.filter=""}>
          发送重置邮件
        </button>
      </div>
      <p style={{ textAlign:"center", fontSize:12, color:LT4, marginTop:20 }}>
        想起密码了？<button onClick={onBack}
          style={{ background:"none", border:"none", color:BLU, cursor:"pointer", fontSize:12, padding:0 }}>
          返回登录
        </button>
      </p>
    </PageShell>
  );
}

// ─── Forgot password — Step 2: email sent ─────────────────────────────────────
function ForgotSentView({ email, onBack, onDemoReset }:{
  email:string; onBack:()=>void; onDemoReset:()=>void;
}) {
  const [countdown, setCountdown] = useState(60);
  const [sending,   setSending]   = useState(false);
  useEffect(()=>{
    if (countdown <= 0) return;
    const t = setTimeout(()=>setCountdown(c=>c-1), 1000);
    return ()=>clearTimeout(t);
  }, [countdown]);

  const maskedEmail = email.replace(/(.{2})(.+)(@.+)/, (_,a,_b,c)=> a+"***"+c);
  const resend = () => {
    setSending(true);
    setTimeout(()=>{ setSending(false); setCountdown(60); }, 1200);
  };

  return (
    <PageShell width={460}>
      <PageLogo/>
      <div style={{ background:"#fff", borderRadius:16, padding:"36px 36px 32px",
        boxShadow:"0 2px 16px rgba(0,0,0,0.08)", border:`1px solid ${LBR}`, textAlign:"center" }}>
        <div style={{ width:64, height:64, borderRadius:"50%", background:"#E8FFEA",
          display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
          <CheckCircle2 size={28} color={SUC}/>
        </div>
        <h2 style={{ fontSize:20, fontWeight:700, color:LT1, margin:"0 0 10px" }}>邮件已发送</h2>
        <p style={{ fontSize:13, color:LT3, margin:"0 0 6px", lineHeight:1.7 }}>
          重置链接已发送至
        </p>
        <p style={{ fontSize:14, fontWeight:600, color:LT1, margin:"0 0 24px",
          background:BG, padding:"8px 16px", borderRadius:8, display:"inline-block" }}>
          {maskedEmail}
        </p>
        <div style={{ fontSize:12, color:LT3, marginBottom:28, lineHeight:1.7 }}>
          链接有效期 <strong>30 分钟</strong>，请尽快操作。<br/>
          没收到邮件？请检查垃圾邮件或重新发送。
        </div>

        {/* Resend */}
        <button onClick={resend} disabled={countdown>0||sending}
          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            width:"100%", height:38, border:`1px solid ${LBR}`, borderRadius:10,
            background:"#fff", fontSize:13, cursor:countdown>0?"not-allowed":"pointer",
            color:countdown>0?LT4:LT2, marginBottom:10 }}>
          {sending ? <><Loader2 size={14} className="animate-spin"/>发送中…</>
            : countdown>0 ? <><RotateCcw size={13}/>{countdown} 秒后可重新发送</>
            : <><RotateCcw size={13}/>重新发送</>}
        </button>

        <button onClick={onBack}
          style={{ width:"100%", height:38, border:"none", borderRadius:10,
            background:BLU, color:"#fff", fontSize:13, fontWeight:500, cursor:"pointer" }}
          onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.08)"}
          onMouseLeave={e=>e.currentTarget.style.filter=""}>
          返回登录
        </button>

        {/* Demo shortcut */}
        <button onClick={onDemoReset}
          style={{ marginTop:16, background:"none", border:"none", cursor:"pointer",
            fontSize:12, color:LT4, textDecoration:"underline" }}>
          演示：直接进入设置新密码 →
        </button>
      </div>
    </PageShell>
  );
}

// ─── Forgot password — Step 3: set new password ───────────────────────────────
function ResetPwView({ onBack, onDone }:{ onBack:()=>void; onDone:()=>void }) {
  const [pw,     setPw]     = useState("");
  const [pw2,    setPw2]    = useState("");
  const [show1,  setShow1]  = useState(false);
  const [show2,  setShow2]  = useState(false);
  const [done,   setDone]   = useState(false);
  const [err,    setErr]    = useState("");

  const rules = [
    { label:"至少 8 个字符",       ok: pw.length>=8 },
    { label:"包含字母和数字",       ok: /[a-zA-Z]/.test(pw)&&/\d/.test(pw) },
    { label:"两次密码输入一致",     ok: pw===pw2&&pw.length>0 },
  ];
  const allOk = rules.every(r=>r.ok);

  const submit = () => {
    if (!allOk) { setErr("请满足所有密码要求"); return; }
    setErr(""); setDone(true);
  };

  if (done) return (
    <PageShell width={460}>
      <PageLogo/>
      <div style={{ background:"#fff", borderRadius:16, padding:"48px 36px",
        boxShadow:"0 2px 16px rgba(0,0,0,0.08)", border:`1px solid ${LBR}`, textAlign:"center" }}>
        <div style={{ width:64, height:64, borderRadius:"50%", background:"#E8FFEA",
          display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
          <CheckCircle2 size={28} color={SUC}/>
        </div>
        <h2 style={{ fontSize:20, fontWeight:700, color:LT1, margin:"0 0 10px" }}>密码已重置</h2>
        <p style={{ fontSize:13, color:LT3, margin:"0 0 28px" }}>你的密码已成功更新，请使用新密码登录。</p>
        <button onClick={onDone}
          style={{ width:"100%", height:40, border:"none", borderRadius:10,
            background:BLU, color:"#fff", fontSize:14, fontWeight:500, cursor:"pointer" }}
          onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.08)"}
          onMouseLeave={e=>e.currentTarget.style.filter=""}>
          去登录
        </button>
      </div>
    </PageShell>
  );

  return (
    <PageShell width={460}>
      <PageLogo/>
      <BackBtn onClick={onBack} label="返回"/>
      <div style={{ background:"#fff", borderRadius:16, padding:"32px 36px",
        boxShadow:"0 2px 16px rgba(0,0,0,0.08)", border:`1px solid ${LBR}` }}>
        <div style={{ width:48, height:48, borderRadius:12, background:"#F5E8FF",
          display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20 }}>
          <KeyRound size={22} color="#7816FF"/>
        </div>
        <h2 style={{ fontSize:20, fontWeight:700, color:LT1, margin:"0 0 8px" }}>设置新密码</h2>
        <p style={{ fontSize:13, color:LT3, margin:"0 0 24px" }}>请为你的账号设置一个新密码。</p>

        {/* New password */}
        <label style={{ display:"block", fontSize:13, fontWeight:500, color:LT2, marginBottom:6 }}>新密码</label>
        <div style={{ position:"relative", marginBottom:16 }}>
          <input type={show1?"text":"password"} placeholder="请输入新密码" value={pw}
            onChange={e=>{ setPw(e.target.value); if(err) setErr(""); }}
            style={{ width:"100%", height:40, border:`1px solid ${LBR}`, borderRadius:10,
              padding:"0 40px 0 14px", fontSize:14, color:LT1, outline:"none",
              boxSizing:"border-box", background:"#fff" }}
            onFocus={e=>{ e.currentTarget.style.borderColor=BLU; e.currentTarget.style.boxShadow=`0 0 0 3px ${BLU}18`; }}
            onBlur={e=>{ e.currentTarget.style.borderColor=LBR; e.currentTarget.style.boxShadow="none"; }}/>
          <button onClick={()=>setShow1(!show1)} style={{ position:"absolute", right:12, top:11,
            background:"none", border:"none", cursor:"pointer", color:show1?LT3:LT4, padding:0 }}>
            {show1?<EyeOff size={16}/>:<Eye size={16}/>}
          </button>
        </div>

        {/* Confirm password */}
        <label style={{ display:"block", fontSize:13, fontWeight:500, color:LT2, marginBottom:6 }}>确认密码</label>
        <div style={{ position:"relative", marginBottom:16 }}>
          <input type={show2?"text":"password"} placeholder="再次输入新密码" value={pw2}
            onChange={e=>{ setPw2(e.target.value); if(err) setErr(""); }}
            onKeyDown={e=>e.key==="Enter"&&submit()}
            style={{ width:"100%", height:40, border:`1px solid ${LBR}`, borderRadius:10,
              padding:"0 40px 0 14px", fontSize:14, color:LT1, outline:"none",
              boxSizing:"border-box", background:"#fff" }}
            onFocus={e=>{ e.currentTarget.style.borderColor=BLU; e.currentTarget.style.boxShadow=`0 0 0 3px ${BLU}18`; }}
            onBlur={e=>{ e.currentTarget.style.borderColor=LBR; e.currentTarget.style.boxShadow="none"; }}/>
          <button onClick={()=>setShow2(!show2)} style={{ position:"absolute", right:12, top:11,
            background:"none", border:"none", cursor:"pointer", color:show2?LT3:LT4, padding:0 }}>
            {show2?<EyeOff size={16}/>:<Eye size={16}/>}
          </button>
        </div>

        {/* Rules checklist */}
        <div style={{ background:BG, borderRadius:10, padding:"10px 14px", marginBottom:16 }}>
          {rules.map(r=>(
            <div key={r.label} style={{ display:"flex", alignItems:"center", gap:8,
              fontSize:12, color:r.ok?SUC:LT3, marginBottom:4 }}>
              <div style={{ width:14, height:14, borderRadius:"50%", flexShrink:0,
                background:r.ok?SUC:LT4, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {r.ok && <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                  <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>}
              </div>
              {r.label}
            </div>
          ))}
        </div>

        {err && <p style={{ fontSize:12, color:DAN, marginBottom:10 }}>{err}</p>}
        <button onClick={submit}
          style={{ width:"100%", height:40, border:"none", borderRadius:10,
            background:allOk?BLU:"#94BFFF", color:"#fff", fontSize:14,
            fontWeight:500, cursor:allOk?"pointer":"not-allowed" }}
          onMouseEnter={e=>{ if(allOk) e.currentTarget.style.filter="brightness(1.08)"; }}
          onMouseLeave={e=>e.currentTarget.style.filter=""}>
          确认重置密码
        </button>
      </div>
    </PageShell>
  );
}

// ─── LoginPage root ───────────────────────────────────────────────────────────
export function LoginPage({ onLogin }:{ onLogin:()=>void }) {
  const [view,       setView]       = useState<LoginView>("login");
  const [account,    setAccount]    = useState("");
  const [password,   setPassword]   = useState("");
  const [remember,   setRemember]   = useState(false);
  const [showPw,     setShowPw]     = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [aErr,       setAErr]       = useState("");
  const [pErr,       setPErr]       = useState("");
  const [workspaces, setWorkspaces] = useState(INIT_MY_WS as typeof INIT_MY_WS);
  const [pendingWs,  setPendingWs]  = useState<{name:string;desc:string}|null>(null);
  const [resetEmail, setResetEmail] = useState("");

  const backTo = (v: LoginView) => () => setView(v);
  const wsView = ():LoginView => workspaces.length > 0 ? "workspace" : "no-workspace";

  const handleLogin = () => {
    let ok = true;
    if (!account.trim()) { setAErr("请输入账号"); ok=false; } else setAErr("");
    if (!password.trim()) { setPErr("请输入密码"); ok=false; } else setPErr("");
    if (!ok) return;
    setError(""); setLoading(true);
    setTimeout(()=>{
      setLoading(false);
      if (password==="wrong") setError("账号或密码错误，请检查后重试");
      else setView("workspace");
    }, 1600);
  };

  const inputStyle = (hasErr:boolean, focused=false):React.CSSProperties => ({
    border:`1px solid ${hasErr?DAN:focused?BLU:LBR}`,
    color:LT1, outline:"none", width:"100%", backgroundColor:"#fff",
    boxShadow: focused?`0 0 0 3px ${hasErr?DAN:BLU}18`:"none",
  });

  // ── View routing ─────────────────────────────────────────────────────────
  if (view==="workspace")
    return <WorkspaceSelect workspaces={workspaces} onEnter={onLogin}
      onBack={()=>{ setView("login"); setPassword(""); setError(""); }}
      onCreate={()=>setView("create-ws")} onJoin={()=>setView("join-ws")}
      onDemoEmpty={()=>setView("no-workspace")}/>;

  if (view==="no-workspace")
    return <NoWorkspaceEmpty onCreate={()=>setView("create-ws")}
      onJoin={()=>setView("join-ws")}
      onBack={()=>{ setView("login"); setPassword(""); setError(""); }}/>;

  if (view==="create-ws")
    return <CreateWorkspace onBack={()=>setView(wsView())}
      onSuccess={name=>{
        setWorkspaces(ws=>[{ id:`w${Date.now()}`, name, desc:"新建工作区",
          members:1, role:"超级管理员", lastVisit:"刚刚", recent:true }, ...ws]);
        onLogin();
      }}/>;

  if (view==="join-ws")
    return <JoinWorkspace onBack={()=>setView(wsView())}
      onApplied={ws=>{ setPendingWs(ws); setView("pending"); }}/>;

  if (view==="pending" && pendingWs)
    return <PendingApproval workspace={pendingWs}
      onBackToList={()=>setView(wsView())}
      onCancel={()=>{ setPendingWs(null); setView(wsView()); }}/>;

  if (view==="forgot")
    return <ForgotView onBack={()=>setView("login")}
      onSent={email=>{ setResetEmail(email); setView("forgot-sent"); }}/>;

  if (view==="forgot-sent")
    return <ForgotSentView email={resetEmail}
      onBack={()=>setView("login")}
      onDemoReset={()=>setView("reset-pw")}/>;

  if (view==="reset-pw")
    return <ResetPwView onBack={()=>setView("forgot-sent")}
      onDone={()=>{ setView("login"); setPassword(""); setError(""); }}/>;

  // ── Login form ────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex overflow-hidden"
      style={{ fontFamily:"'Inter','PingFang SC','Microsoft YaHei',sans-serif", fontSize:14 }}>

      {/* ── Left dark panel ─────────────────────────────────────────────── */}
      <div className="flex flex-col h-full" style={{ width:"58%", backgroundColor:PNL, padding:"44px 52px" }}>
        <div className="flex items-center gap-2.5 mb-12">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background:`linear-gradient(135deg,${BLU},#4F8EFF)`,
              boxShadow:"0 2px 10px rgba(22,93,255,0.35)" }}>
            <SysIcon size={20}/>
          </div>
          <span className="text-[18px] font-bold" style={{ color:TEXT }}>AutoTest</span>
          <span className="ml-1 text-[10px] px-2 py-0.5 rounded font-mono"
            style={{ backgroundColor:DBR, color:MTD, border:"1px solid #30363D" }}>v2.4.1</span>
        </div>

        <div className="mb-10">
          <h1 className="text-[27px] font-semibold leading-tight mb-3" style={{ color:TEXT }}>
            工程效率，<br/>从测试开始
          </h1>
          <p className="text-[14px] leading-relaxed" style={{ color:MTD, maxWidth:360 }}>
            AI 驱动的企业级自动化测试平台，<br/>让质量保障不再成为交付的瓶颈
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-7">
          {FEATURES.map(f=>(
            <div key={f.label} className="flex items-center gap-3 p-3 rounded-xl"
              style={{ backgroundColor:CARD, border:`1px solid ${DBR}` }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor:`${f.col}22` }}>
                <f.icon size={14} style={{ color:f.col }}/>
              </div>
              <div>
                <div className="text-[12px] font-medium" style={{ color:TEXT }}>{f.label}</div>
                <div className="text-[11px]" style={{ color:MTD }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 rounded-xl overflow-hidden flex flex-col"
          style={{ backgroundColor:"#010409", border:`1px solid ${DBR}` }}>
          <div className="flex items-center gap-1.5 px-4 py-2.5 flex-shrink-0"
            style={{ backgroundColor:CARD, borderBottom:`1px solid ${DBR}` }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor:"#F85149" }}/>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor:"#E3B341" }}/>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor:"#3FB950" }}/>
            <span className="ml-3 text-[11px] font-mono" style={{ color:MTD }}>execution.log</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded font-mono"
              style={{ backgroundColor:"#1B2A1B", color:"#3FB950", border:"1px solid #2EA043" }}>● LIVE</span>
          </div>
          <div className="flex-1 p-4 flex flex-col gap-1 overflow-hidden"
            style={{ fontFamily:"'JetBrains Mono','Fira Code',monospace", fontSize:11 }}>
            {LOG.map((line,i)=><div key={i} style={{ color:LOG_C[line.t] }}>{line.s}</div>)}
          </div>
        </div>

        <div className="flex items-center gap-8 mt-5">
          {[
            { label:"今日执行",    value:"236 次", color:TEXT      },
            { label:"整体通过率",  value:"93.6%",  color:"#3FB950" },
            { label:"在线 Runner", value:"6 个",   color:"#79C0FF" },
          ].map((s,i)=>(
            <div key={i}>
              <div className="text-[17px] font-bold" style={{ color:s.color }}>{s.value}</div>
              <div className="text-[10px] mt-0.5" style={{ color:MTD }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center h-full"
        style={{ width:"42%", backgroundColor:"#fff" }}>
        <div style={{ width:"100%", maxWidth:360, padding:"0 40px" }}>
          <div className="flex items-center gap-2 mb-10">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background:`linear-gradient(135deg,${BLU},#4F8EFF)`,
                boxShadow:"0 2px 8px rgba(22,93,255,0.3)" }}>
              <SysIcon size={15}/>
            </div>
            <span className="text-[13px] font-semibold" style={{ color:LT1 }}>AutoTest</span>
          </div>

          <h2 className="text-[24px] font-semibold mb-1.5" style={{ color:LT1 }}>欢迎回来</h2>
          <p className="text-[13px] mb-7" style={{ color:LT3 }}>请使用企业账号登录以继续使用平台</p>

          {error&&(
            <div className="flex items-start gap-2.5 rounded-xl mb-5"
              style={{ backgroundColor:"#FFF0F0", border:"1px solid #FFCCC7", padding:"12px 14px" }}>
              <AlertCircle size={15} color={DAN} style={{ flexShrink:0, marginTop:1 }}/>
              <span className="text-[13px]" style={{ color:DAN }}>{error}</span>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[13px] font-medium mb-1.5" style={{ color:LT2 }}>账号</label>
            <input type="text" placeholder="请输入邮箱或用户名"
              value={account}
              onChange={e=>{ setAccount(e.target.value); if(aErr)setAErr(""); if(error)setError(""); }}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()}
              className="h-10 rounded-xl px-3.5 text-[14px] transition-all"
              style={inputStyle(!!aErr)}
              onFocus={e=>Object.assign(e.currentTarget.style, inputStyle(!!aErr,true))}
              onBlur={e=>Object.assign(e.currentTarget.style, inputStyle(!!aErr,false))}/>
            {aErr&&<p className="text-[12px] mt-1.5" style={{ color:DAN }}>{aErr}</p>}
          </div>

          <div className="mb-4">
            <label className="block text-[13px] font-medium mb-1.5" style={{ color:LT2 }}>密码</label>
            <div className="relative">
              <input type={showPw?"text":"password"} placeholder="请输入密码"
                value={password}
                onChange={e=>{ setPassword(e.target.value); if(pErr)setPErr(""); if(error)setError(""); }}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                className="h-10 rounded-xl pl-3.5 pr-10 text-[14px] transition-all"
                style={inputStyle(!!pErr)}
                onFocus={e=>Object.assign(e.currentTarget.style, inputStyle(!!pErr,true))}
                onBlur={e=>Object.assign(e.currentTarget.style, inputStyle(!!pErr,false))}/>
              <button onClick={()=>setShowPw(!showPw)}
                className="absolute right-3 top-2.5"
                style={{ background:"none", border:"none", cursor:"pointer", color:showPw?LT3:LT4, padding:0 }}>
                {showPw?<EyeOff size={16}/>:<Eye size={16}/>}
              </button>
            </div>
            {pErr&&<p className="text-[12px] mt-1.5" style={{ color:DAN }}>{pErr}</p>}
          </div>

          <div className="flex items-center justify-between mb-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox on={remember} onChange={()=>setRemember(!remember)}/>
              <span className="text-[13px]" style={{ color:LT2 }}>记住账号</span>
            </label>
            <button onClick={()=>setView("forgot")} style={{ color:BLU, background:"none", border:"none", cursor:"pointer", fontSize:13 }}>忘记密码</button>
          </div>

          <button onClick={handleLogin} disabled={loading}
            className="w-full h-10 rounded-xl text-white text-[14px] font-medium flex items-center justify-center gap-2"
            style={{ backgroundColor:loading?"#94BFFF":BLU, border:"none", cursor:loading?"not-allowed":"pointer" }}
            onMouseEnter={e=>{ if(!loading) e.currentTarget.style.filter="brightness(1.08)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.filter=""; }}>
            {loading?<><Loader2 size={15} className="animate-spin"/>登录中...</>:"登录"}
          </button>

          <div className="mt-4 text-center">
            <span className="text-[11px]" style={{ color:LT4 }}>输入密码 &ldquo;wrong&rdquo; 可演示错误状态</span>
          </div>
          <p className="text-[11px] text-center mt-7" style={{ color:LT4 }}>
            如需账号，请联系管理员邀请 · AutoTest v2.4.1
          </p>
        </div>
      </div>
    </div>
  );
}
