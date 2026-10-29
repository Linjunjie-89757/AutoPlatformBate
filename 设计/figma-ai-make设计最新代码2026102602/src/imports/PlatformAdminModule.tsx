import { useState, useRef } from "react";
import {
  LayoutDashboard, Building2, Users, ClipboardCheck, ScrollText,
  Plus, Search, CheckCircle2, ShieldAlert, AlertTriangle,
  Eye, RotateCcw, Trash2, X, Upload, Mail, UserPlus,
  Download, FileSpreadsheet, ChevronDown, CheckCircle,
  Bell, Server, Send, ToggleLeft, ToggleRight, Loader2, Lock,
} from "lucide-react";

// ─── Palette ──────────────────────────────────────────────────────────────────
const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  border:"#E5E6EB",  bg:"#F4F6FA",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
  card:"#FFFFFF",
};
const ADM = "#DB2777"; // admin accent (rose)
const ADM_BG = "#FDF2F8";

// ─── Types ────────────────────────────────────────────────────────────────────
type AdminPage = "overview"|"workspaces"|"accounts"|"requests"|"audit"|"notify";

interface PlatformWs {
  id:string; name:string; desc:string; members:number;
  createdAt:string; status:"active"|"disabled"; owner:string; color:string;
}
interface PlatformUser {
  id:string; name:string; email:string; avatar:string;
  role:"super-admin"|"user"; status:"active"|"disabled";
  workspaces:number; createdAt:string; lastLogin:string;
}
interface JoinRequest {
  id:string; applicant:string; email:string; avatar:string;
  workspace:string; wsDesc:string; appliedAt:string;
  status:"pending"|"approved"|"rejected"; reason?:string;
}
interface AuditEntry {
  id:string; time:string; operator:string; action:string;
  target:string; ip:string; result:"success"|"fail";
}
type InviteStatus = "pending-send"|"sending"|"sent"|"activated"|"expired"|"revoked"|"failed";
interface InviteRecord {
  id:string; name:string; email:string; role:"user"|"super-admin";
  invitedAt:string; expiresAt:string; status:InviteStatus; failReason?:string; operator:string;
  source:"manual"|"batch";
}

// ─── Invite status config ────────────────────────────────────────────────────
const INVITE_STATUS_CFG:Record<InviteStatus,{label:string;color:string;bg:string}> = {
  "pending-send":{label:"待发送",   color:T.t3,      bg:"#F2F3F5"},
  "sending":     {label:"发送中",   color:T.primary, bg:"#EBF3FF"},
  "sent":        {label:"待激活",   color:T.warning, bg:"#FFF5EB"},
  "activated":   {label:"已激活",   color:T.success, bg:"#E8FFEA"},
  "expired":     {label:"已过期",   color:T.t4,      bg:"#F2F3F5"},
  "revoked":     {label:"已撤销",   color:T.t3,      bg:"#F2F3F5"},
  "failed":      {label:"发送失败", color:T.danger,  bg:"#FFF0F0"},
};

// ─── Mock data ─────────────────────────────────────────────────────────────────
const WS_COLORS = ["#165DFF","#8B5CF6","#10B981","#F59E0B","#EF4444","#06B6D4","#EC4899"];

const PLATFORM_WS: PlatformWs[] = [
  { id:"w1", name:"X-MAN",    desc:"电商平台 · 订单/风控全链路自动化",   members:8,  createdAt:"2025-11-02", status:"active",   owner:"张程远", color:WS_COLORS[0] },
  { id:"w2", name:"KRATOS",   desc:"风控中台 · 规则引擎和策略测试",       members:12, createdAt:"2025-11-15", status:"active",   owner:"李明",   color:WS_COLORS[1] },
  { id:"w3", name:"MINERVA",  desc:"数据平台 · BI 报表和数据质量测试",    members:5,  createdAt:"2025-12-01", status:"active",   owner:"王芳",   color:WS_COLORS[2] },
  { id:"w4", name:"PHOENIX",  desc:"支付中台 · 资金账户和清结算测试",     members:6,  createdAt:"2026-01-10", status:"active",   owner:"陈伟",   color:WS_COLORS[3] },
  { id:"w5", name:"TITAN",    desc:"基础设施 · 网关和微服务压测平台",     members:3,  createdAt:"2026-02-20", status:"active",   owner:"赵云",   color:WS_COLORS[4] },
  { id:"w6", name:"APOLLO",   desc:"用户中台 · 账号体系和权限管理测试",   members:9,  createdAt:"2026-03-05", status:"disabled", owner:"孙悟空", color:WS_COLORS[5] },
  { id:"w7", name:"LEGACY-QA",desc:"旧版测试环境 · 已归档",              members:2,  createdAt:"2024-06-01", status:"disabled", owner:"退出员工",color:WS_COLORS[6] },
];

const PLATFORM_USERS: PlatformUser[] = [
  { id:"u1", name:"张程远", email:"zhangcy@company.com",  avatar:"张", role:"super-admin", status:"active",   workspaces:3, createdAt:"2025-10-01", lastLogin:"今天 09:31" },
  { id:"u2", name:"李明",   email:"liming@company.com",   avatar:"李", role:"user",        status:"active",   workspaces:2, createdAt:"2025-11-02", lastLogin:"今天 08:45" },
  { id:"u3", name:"王芳",   email:"wangfang@company.com", avatar:"王", role:"user",        status:"active",   workspaces:2, createdAt:"2025-11-15", lastLogin:"昨天 17:20" },
  { id:"u4", name:"陈伟",   email:"chenwei@company.com",  avatar:"陈", role:"user",        status:"active",   workspaces:3, createdAt:"2025-12-01", lastLogin:"2 天前" },
  { id:"u5", name:"赵云",   email:"zhaoyun@company.com",  avatar:"赵", role:"user",        status:"active",   workspaces:1, createdAt:"2026-01-10", lastLogin:"5 天前" },
  { id:"u6", name:"孙悟空", email:"sunwk@company.com",    avatar:"孙", role:"user",        status:"disabled", workspaces:1, createdAt:"2026-01-20", lastLogin:"30 天前" },
  { id:"u7", name:"周宁林", email:"zhounl@company.com",   avatar:"周", role:"user",        status:"active",   workspaces:0, createdAt:"2026-07-07", lastLogin:"刚刚注册" },
];

const INIT_REQUESTS: JoinRequest[] = [
  { id:"r1", applicant:"周宁林", email:"zhounl@company.com",  avatar:"周", workspace:"X-MAN",   wsDesc:"电商平台 · 订单/风控全链路自动化", appliedAt:"今天 11:22", status:"pending" },
  { id:"r2", applicant:"何梅",   email:"hm@partner.com",       avatar:"何", workspace:"KRATOS",  wsDesc:"风控中台 · 规则引擎和策略测试",     appliedAt:"今天 09:05", status:"pending" },
  { id:"r3", applicant:"林峰",   email:"lf@company.com",       avatar:"林", workspace:"PHOENIX", wsDesc:"支付中台 · 资金账户和清结算测试",   appliedAt:"昨天 16:40", status:"pending" },
  { id:"r4", applicant:"张三",   email:"z3@demo.com",          avatar:"张", workspace:"TITAN",   wsDesc:"基础设施 · 网关和微服务压测平台",   appliedAt:"3 天前",     status:"approved" },
  { id:"r5", applicant:"李四",   email:"l4@demo.com",          avatar:"李", workspace:"X-MAN",   wsDesc:"电商平台 · 订单/风控全链路自动化", appliedAt:"5 天前",     status:"rejected", reason:"不在项目授权名单内" },
];

const AUDIT_LOG: AuditEntry[] = [
  { id:"a1",  time:"2026-07-07 11:22",    operator:"张程远", action:"审批加入申请",  target:"周宁林 → X-MAN",         ip:"10.0.1.101", result:"success" },
  { id:"a2",  time:"2026-07-07 10:15",    operator:"张程远", action:"停用工作区",   target:"LEGACY-QA",               ip:"10.0.1.101", result:"success" },
  { id:"a3",  time:"2026-07-07 09:31",    operator:"系统",   action:"用户登录",     target:"张程远",                  ip:"10.0.1.101", result:"success" },
  { id:"a4",  time:"2026-07-06 17:45",    operator:"张程远", action:"重置密码",     target:"孙悟空",                  ip:"10.0.1.101", result:"success" },
  { id:"a5",  time:"2026-07-06 15:30",    operator:"张程远", action:"禁用账号",     target:"孙悟空",                  ip:"10.0.1.101", result:"success" },
  { id:"a6",  time:"2026-07-06 14:20",    operator:"张程远", action:"拒绝加入申请", target:"李四 → X-MAN",            ip:"10.0.1.101", result:"success" },
  { id:"a7",  time:"2026-07-05 10:00",    operator:"张程远", action:"创建工作区",   target:"TITAN",                   ip:"10.0.1.101", result:"success" },
  { id:"a8",  time:"2026-07-04 16:00",    operator:"系统",   action:"定时备份",     target:"全平台数据",               ip:"-",          result:"success" },
  { id:"a9",  time:"2026-07-03 09:15",    operator:"张程远", action:"修改平台配置", target:"邮件通知策略",             ip:"10.0.1.101", result:"success" },
  { id:"a10", time:"2026-07-02 14:50",    operator:"张程远", action:"删除工作区",   target:"TEST-TEMP（已归档）",      ip:"10.0.1.101", result:"fail"    },
];

const MOCK_INVITES:InviteRecord[] = [
  {id:"i1",name:"何梅",   email:"hm@partner.com",      role:"user",       invitedAt:"2026-08-21 11:22",expiresAt:"2026-08-23 11:22",status:"sent",        operator:"张程远",source:"manual"},
  {id:"i2",name:"林峰",   email:"lf@company.com",      role:"user",       invitedAt:"2026-08-21 09:05",expiresAt:"2026-08-23 09:05",status:"sending",     operator:"张程远",source:"manual"},
  {id:"i3",name:"王建国", email:"wjg@company.com",     role:"user",       invitedAt:"2026-08-20 16:30",expiresAt:"2026-08-22 16:30",status:"activated",   operator:"张程远",source:"manual"},
  {id:"i4",name:"赵敏",   email:"zhaomin@partner.com", role:"user",       invitedAt:"2026-08-19 14:00",expiresAt:"2026-08-21 14:00",status:"expired",     operator:"李明",  source:"manual"},
  {id:"i5",name:"钱磊",   email:"qianlei@company.com", role:"super-admin",invitedAt:"2026-08-18 10:15",expiresAt:"2026-08-20 10:15",status:"failed",
    failReason:"SMTP 连接超时（smtp.company.com:465），目标服务器拒绝连接，请检查服务器配置或网络状态",operator:"张程远",source:"manual"},
  {id:"i6",name:"孙静",   email:"sunjing@company.com", role:"user",       invitedAt:"2026-08-17 15:40",expiresAt:"2026-08-19 15:40",status:"revoked",     operator:"张程远",source:"manual"},
  {id:"i7",name:"周伟",   email:"zhouwei@company.com", role:"user",       invitedAt:"2026-08-16 09:00",expiresAt:"2026-08-18 09:00",status:"pending-send",operator:"李明",  source:"manual"},
  {id:"i8",name:"吴磊",   email:"wulei@company.com",   role:"user",       invitedAt:"2026-08-15 10:00",expiresAt:"2026-08-17 10:00",status:"activated",   operator:"张程远",source:"batch"},
  {id:"i9",name:"郑燕",   email:"zhengyan@company.com",role:"user",       invitedAt:"2026-08-15 10:00",expiresAt:"2026-08-17 10:00",status:"activated",   operator:"张程远",source:"batch"},
  {id:"i10",name:"徐志强", email:"xuzq@company.com",   role:"user",       invitedAt:"2026-08-15 10:00",expiresAt:"2026-08-17 10:00",status:"expired",     operator:"张程远",source:"batch"},
  {id:"i11",name:"黄晓燕", email:"huangxy@company.com",role:"user",       invitedAt:"2026-08-15 10:00",expiresAt:"2026-08-17 10:00",status:"failed",
    failReason:"邮件地址不存在，退信码 550 5.1.1",operator:"张程远",source:"batch"},
];

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function WsAvatar({ name, color, size=36 }:{ name:string; color:string; size?:number }) {
  return (
    <div style={{ width:size, height:size, borderRadius:size*0.28, flexShrink:0,
      background:`linear-gradient(135deg,${color},${color}99)`,
      display:"flex", alignItems:"center", justifyContent:"center",
      color:"#fff", fontWeight:700, fontSize:size*0.36 }}>
      {name[0]}
    </div>
  );
}

function UserAvatar({ avatar, size=32 }:{ avatar:string; size?:number }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:`linear-gradient(135deg,${ADM},${ADM}99)`,
      display:"flex", alignItems:"center", justifyContent:"center",
      color:"#fff", fontWeight:700, fontSize:size*0.38 }}>
      {avatar}
    </div>
  );
}

function Badge({ label, color, bg }:{ label:string; color:string; bg:string }) {
  return <span style={{ fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:10, color, background:bg }}>{label}</span>;
}

function SBtn({ children, color=T.primary, onClick, disabled }:{
  children:React.ReactNode; color?:string; onClick?:()=>void; disabled?:boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ height:30, padding:"0 12px", borderRadius:7, fontSize:12, fontWeight:500,
        background:disabled?T.t4:`${color}15`, color:disabled?T.t4:color,
        border:`1px solid ${disabled?T.t4:`${color}40`}`,
        cursor:disabled?"not-allowed":"pointer", whiteSpace:"nowrap", transition:"all 0.12s" }}
      onMouseEnter={e=>{ if(!disabled) e.currentTarget.style.background=`${color}25`; }}
      onMouseLeave={e=>{ if(!disabled) e.currentTarget.style.background=`${color}15`; }}>
      {children}
    </button>
  );
}

function SectionCard({ title, children, action }:{
  title:string; children:React.ReactNode; action?:React.ReactNode;
}) {
  return (
    <div style={{ background:T.card, borderRadius:14, border:`1px solid ${T.border}`,
      boxShadow:"0 1px 6px rgba(0,0,0,0.05)", marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"16px 20px", borderBottom:`1px solid ${T.border}` }}>
        <span style={{ fontSize:14, fontWeight:700, color:T.t1 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Page 1: Overview ─────────────────────────────────────────────────────────
function AdminOverview({ requests }:{ requests:JoinRequest[] }) {
  const pending = requests.filter(r=>r.status==="pending").length;
  const kpis = [
    { label:"工作区总数", value:PLATFORM_WS.length,                         unit:"个", color:ADM,        bg:ADM_BG      },
    { label:"注册用户数", value:PLATFORM_USERS.length,                       unit:"人", color:T.primary,  bg:"#EBF3FF"  },
    { label:"今日活跃",  value:5,                                            unit:"人", color:T.success,  bg:"#E8FFEA"  },
    { label:"待审批申请",value:pending,                                       unit:"条", color:pending>0?T.warning:T.t4, bg:pending>0?"#FFF5EB":"#F2F3F5" },
  ];

  return (
    <div style={{ padding:"24px", overflowY:"auto" }}>
      {/* KPI */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
        {kpis.map(k=>(
          <div key={k.label} style={{ background:T.card, borderRadius:14, padding:"20px",
            border:`1px solid ${T.border}`, boxShadow:"0 1px 6px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize:32, fontWeight:800, color:k.color, lineHeight:1, marginBottom:6 }}>{k.value}</div>
            <div style={{ fontSize:12, color:T.t3 }}>{k.label}</div>
            <div style={{ fontSize:11, color:T.t4, marginTop:2 }}>{k.unit}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {/* 工作区状态 */}
        <SectionCard title="工作区状态">
          <div style={{ padding:"12px 20px" }}>
            {PLATFORM_WS.slice(0,5).map((ws,i)=>(
              <div key={ws.id} style={{ display:"flex", alignItems:"center", gap:12,
                padding:"10px 0", borderBottom: i<4?`1px solid ${T.border}`:"none" }}>
                <WsAvatar name={ws.name} color={ws.color} size={32}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.t1 }}>{ws.name}</div>
                  <div style={{ fontSize:11, color:T.t3 }}>{ws.members} 名成员</div>
                </div>
                <Badge
                  label={ws.status==="active"?"正常":"已停用"}
                  color={ws.status==="active"?T.success:T.t3}
                  bg={ws.status==="active"?"#E8FFEA":"#F2F3F5"}/>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 最近审计 */}
        <SectionCard title="最近平台操作">
          <div style={{ padding:"12px 20px" }}>
            {AUDIT_LOG.slice(0,6).map((a,i)=>(
              <div key={a.id} style={{ display:"flex", alignItems:"flex-start", gap:10,
                padding:"9px 0", borderBottom: i<5?`1px solid ${T.border}`:"none" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", marginTop:5, flexShrink:0,
                  background:a.result==="success"?T.success:T.danger }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:T.t1 }}>
                    <strong>{a.operator}</strong> {a.action}
                    <span style={{ color:T.t3 }}> · {a.target}</span>
                  </div>
                  <div style={{ fontSize:11, color:T.t4, marginTop:2 }}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Page 2: Workspaces ───────────────────────────────────────────────────────
function WorkspaceManagement() {
  const [wsList, setWsList] = useState(PLATFORM_WS);
  const [query,  setQuery]  = useState("");
  const [filter, setFilter] = useState<"all"|"active"|"disabled">("all");

  const filtered = wsList.filter(w=>{
    if (filter==="active"   && w.status!=="active")   return false;
    if (filter==="disabled" && w.status!=="disabled") return false;
    return !query || w.name.toLowerCase().includes(query.toLowerCase()) || w.desc.includes(query);
  });

  const toggleStatus = (id:string) =>
    setWsList(list=>list.map(w=>w.id===id?{...w,status:w.status==="active"?"disabled":"active"}:w));

  return (
    <div style={{ padding:"24px", overflowY:"auto" }}>
      <SectionCard title={`工作区管理（共 ${wsList.length} 个）`}
        action={
          <SBtn color={ADM}>
            <Plus size={12} style={{ marginRight:4, display:"inline" }}/>新建工作区
          </SBtn>
        }>
        {/* Toolbar */}
        <div style={{ display:"flex", gap:10, padding:"14px 20px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ position:"relative", flex:1 }}>
            <Search size={13} color={T.t4} style={{ position:"absolute", left:10, top:11 }}/>
            <input value={query} onChange={e=>setQuery(e.target.value)}
              placeholder="搜索工作区名称…"
              style={{ width:"100%", height:34, borderRadius:8, border:`1px solid ${T.border}`,
                paddingLeft:30, fontSize:13, color:T.t1, outline:"none", boxSizing:"border-box" }}
              onFocus={e=>e.currentTarget.style.borderColor=ADM}
              onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {(["all","active","disabled"] as const).map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                style={{ height:34, padding:"0 12px", borderRadius:8, fontSize:12,
                  border:`1px solid ${filter===f?ADM:T.border}`,
                  background:filter===f?ADM_BG:"transparent",
                  color:filter===f?ADM:T.t2, cursor:"pointer" }}>
                {f==="all"?"全部":f==="active"?"正常":"已停用"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 80px 90px 90px 130px",
            padding:"10px 20px", background:T.bg }}>
            {["工作区","成员","状态","创建时间","负责人","操作"].map(h=>(
              <div key={h} style={{ fontSize:11, fontWeight:600, color:T.t3, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</div>
            ))}
          </div>
          {filtered.map((ws,i)=>(
            <div key={ws.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 80px 90px 90px 130px",
              padding:"14px 20px", alignItems:"center",
              borderTop:`1px solid ${T.border}`,
              background: ws.status==="disabled"?"#FAFBFE":T.card }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <WsAvatar name={ws.name} color={ws.color} size={32}/>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:ws.status==="disabled"?T.t3:T.t1 }}>{ws.name}</div>
                  <div style={{ fontSize:11, color:T.t4, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ws.desc}</div>
                </div>
              </div>
              <div style={{ fontSize:13, color:T.t2 }}>{ws.members} 人</div>
              <div>
                <Badge
                  label={ws.status==="active"?"正常":"已停用"}
                  color={ws.status==="active"?T.success:T.t3}
                  bg={ws.status==="active"?"#E8FFEA":"#F2F3F5"}/>
              </div>
              <div style={{ fontSize:12, color:T.t3 }}>{ws.createdAt}</div>
              <div style={{ fontSize:12, color:T.t2 }}>{ws.owner}</div>
              <div style={{ display:"flex", gap:6 }}>
                <SBtn color={T.primary}><Eye size={11}/></SBtn>
                <SBtn color={ws.status==="active"?T.warning:T.success}
                  onClick={()=>toggleStatus(ws.id)}>
                  {ws.status==="active"?"停用":"启用"}
                </SBtn>
                <SBtn color={T.danger}><Trash2 size={11}/></SBtn>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────
function InviteModal({ onClose, onDone }:{ onClose:()=>void; onDone:(u:PlatformUser)=>void }) {
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [dept,  setDept]  = useState("");
  const [role,  setRole]  = useState<"user"|"super-admin">("user");
  const [step,  setStep]  = useState<"form"|"success">("form");
  const [err,   setErr]   = useState<{name?:string;email?:string}>({});

  const validate = () => {
    const e:typeof err = {};
    if (!name.trim())  e.name  = "请输入姓名";
    if (!email.trim()) e.email = "请输入邮箱";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "邮箱格式不正确";
    setErr(e);
    return Object.keys(e).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    const newUser: PlatformUser = {
      id: "u" + Date.now(), name: name.trim(), email: email.trim(),
      avatar: name.trim()[0], role, status:"active",
      workspaces:0, createdAt: new Date().toISOString().slice(0,10), lastLogin:"尚未登录",
    };
    onDone(newUser);
    setStep("success");
  };

  const Field = ({ label, required, error, children }:{
    label:string; required?:boolean; error?:string; children:React.ReactNode;
  }) => (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:12, fontWeight:500, color:T.t2, marginBottom:6 }}>
        {label}{required&&<span style={{ color:T.danger, marginLeft:2 }}>*</span>}
      </div>
      {children}
      {error && <div style={{ fontSize:11, color:T.danger, marginTop:4 }}>{error}</div>}
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}
      onClick={onClose}>
      <div style={{ width:460, background:"#fff", borderRadius:18, overflow:"hidden",
        boxShadow:"0 24px 64px rgba(0,0,0,0.2)" }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${T.border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:ADM_BG,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <UserPlus size={16} color={ADM}/>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:T.t1 }}>邀请账号</div>
              <div style={{ fontSize:11, color:T.t3 }}>发送邮件邀请用户加入平台</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border:"none", background:"none", cursor:"pointer", color:T.t4 }}>
            <X size={18}/>
          </button>
        </div>

        {step==="form" ? (
          <div style={{ padding:"24px" }}>
            <Field label="姓名" required error={err.name}>
              <input value={name} onChange={e=>{setName(e.target.value);setErr(p=>({...p,name:undefined}));}}
                placeholder="请输入真实姓名"
                style={{ width:"100%", height:36, borderRadius:8, border:`1px solid ${err.name?T.danger:T.border}`,
                  padding:"0 12px", fontSize:13, color:T.t1, outline:"none", boxSizing:"border-box" }}
                onFocus={e=>e.currentTarget.style.borderColor=err.name?T.danger:ADM}
                onBlur={e=>e.currentTarget.style.borderColor=err.name?T.danger:T.border}/>
            </Field>

            <Field label="邮箱地址" required error={err.email}>
              <input value={email} onChange={e=>{setEmail(e.target.value);setErr(p=>({...p,email:undefined}));}}
                placeholder="user@company.com" type="email"
                style={{ width:"100%", height:36, borderRadius:8, border:`1px solid ${err.email?T.danger:T.border}`,
                  padding:"0 12px", fontSize:13, color:T.t1, outline:"none", boxSizing:"border-box" }}
                onFocus={e=>e.currentTarget.style.borderColor=err.email?T.danger:ADM}
                onBlur={e=>e.currentTarget.style.borderColor=err.email?T.danger:T.border}/>
            </Field>

            <Field label="所属部门">
              <input value={dept} onChange={e=>setDept(e.target.value)}
                placeholder="例如：测试团队、基础架构组（选填）"
                style={{ width:"100%", height:36, borderRadius:8, border:`1px solid ${T.border}`,
                  padding:"0 12px", fontSize:13, color:T.t1, outline:"none", boxSizing:"border-box" }}
                onFocus={e=>e.currentTarget.style.borderColor=ADM}
                onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
            </Field>

            <Field label="平台角色">
              <div style={{ display:"flex", gap:10 }}>
                {([["user","普通用户","拥有工作区成员权限，由工作区管理员分配具体角色"],
                   ["super-admin","超级管理员","可访问平台管理后台，管理所有工作区和账号"]] as const).map(([v,label,desc])=>(
                  <button key={v} onClick={()=>setRole(v)}
                    style={{ flex:1, padding:"10px 12px", borderRadius:10, textAlign:"left", cursor:"pointer",
                      border:`1.5px solid ${role===v?ADM:T.border}`,
                      background:role===v?ADM_BG:"#fff", transition:"all 0.15s" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                      <div style={{ width:14, height:14, borderRadius:"50%", flexShrink:0,
                        border:`2px solid ${role===v?ADM:T.t4}`,
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {role===v&&<div style={{ width:6, height:6, borderRadius:"50%", background:ADM }}/>}
                      </div>
                      <span style={{ fontSize:12, fontWeight:600, color:role===v?ADM:T.t1 }}>{label}</span>
                    </div>
                    <div style={{ fontSize:11, color:T.t3, lineHeight:1.5, paddingLeft:20 }}>{desc}</div>
                  </button>
                ))}
              </div>
            </Field>

            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px",
              borderRadius:9, background:"#EBF3FF", marginBottom:20 }}>
              <Mail size={13} color={T.primary}/>
              <span style={{ fontSize:12, color:T.primary }}>
                系统将向 <strong>{email||"填写的邮箱"}</strong> 发送激活链接，有效期 48 小时
              </span>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={onClose}
                style={{ flex:1, height:38, borderRadius:9, border:`1px solid ${T.border}`,
                  background:"#fff", color:T.t2, cursor:"pointer", fontSize:13 }}>取消</button>
              <button onClick={submit}
                style={{ flex:2, height:38, borderRadius:9, border:"none",
                  background:ADM, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>
                发送邀请
              </button>
            </div>
          </div>
        ) : (
          <div style={{ padding:"40px 24px", textAlign:"center" }}>
            <div style={{ width:60, height:60, borderRadius:"50%", background:"#E8FFEA",
              display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <CheckCircle size={28} color={T.success}/>
            </div>
            <div style={{ fontSize:16, fontWeight:700, color:T.t1, marginBottom:8 }}>邀请已发送</div>
            <div style={{ fontSize:13, color:T.t3, marginBottom:4 }}>
              已向 <strong style={{ color:T.t1 }}>{email}</strong> 发送激活邮件
            </div>
            <div style={{ fontSize:12, color:T.t4, marginBottom:28 }}>用户点击邮件中的链接后即可完成注册并登录平台</div>
            <button onClick={onClose}
              style={{ height:38, padding:"0 32px", borderRadius:9, border:"none",
                background:ADM, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>
              完成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Batch Import Modal ────────────────────────────────────────────────────────
type ImportRow = { name:string; email:string; dept:string; valid:boolean; error?:string };

function BatchImportModal({ onClose, onDone }:{ onClose:()=>void; onDone:(rows:ImportRow[])=>void }) {
  const [tab,     setTab]     = useState<"paste"|"upload">("paste");
  const [raw,     setRaw]     = useState("");
  const [rows,    setRows]    = useState<ImportRow[]>([]);
  const [step,    setStep]    = useState<"edit"|"preview"|"success">("edit");
  const [dragOn,  setDragOn]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const TEMPLATE = "姓名,邮箱,部门\n张三,zhangsan@company.com,研发部\n李四,lisi@company.com,测试部";

  const parse = () => {
    const lines = raw.trim().split("\n").filter(l=>l.trim());
    const parsed: ImportRow[] = lines.map(line=>{
      const parts = line.split(",").map(s=>s.trim());
      const name  = parts[0]||"";
      const email = parts[1]||"";
      const dept  = parts[2]||"";
      let error:string|undefined;
      if (!name)  error = "缺少姓名";
      else if (!email) error = "缺少邮箱";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = "邮箱格式错误";
      return { name, email, dept, valid:!error, error };
    });
    setRows(parsed);
    setStep("preview");
  };

  const validRows = rows.filter(r=>r.valid);

  const confirm = () => {
    onDone(validRows);
    setStep("success");
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type:"text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download="账号导入模板.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}
      onClick={onClose}>
      <div style={{ width:580, background:"#fff", borderRadius:18, overflow:"hidden",
        boxShadow:"0 24px 64px rgba(0,0,0,0.2)", maxHeight:"85vh", display:"flex", flexDirection:"column" }}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:`1px solid ${T.border}`, flexShrink:0,
          display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:"#EBF3FF",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <FileSpreadsheet size={16} color={T.primary}/>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:T.t1 }}>批量导入账号</div>
              <div style={{ fontSize:11, color:T.t3 }}>支持粘贴名单或上传 CSV 文件</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border:"none", background:"none", cursor:"pointer", color:T.t4 }}>
            <X size={18}/>
          </button>
        </div>

        {step==="edit" && (
          <>
            {/* Tabs */}
            <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
              {([["paste","粘贴名单"],["upload","上传文件"]] as const).map(([t,label])=>(
                <button key={t} onClick={()=>setTab(t)}
                  style={{ padding:"12px 20px", fontSize:13, fontWeight:tab===t?600:400,
                    border:"none", borderBottom:`2px solid ${tab===t?T.primary:"transparent"}`,
                    background:"transparent", color:tab===t?T.primary:T.t3, cursor:"pointer" }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ padding:"20px 24px", flex:1, overflowY:"auto" }}>
              {tab==="paste" ? (
                <>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"10px 12px",
                    borderRadius:9, background:T.bg, marginBottom:14 }}>
                    <AlertTriangle size={13} color={T.t3} style={{ marginTop:1, flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:T.t3, lineHeight:1.6 }}>
                      每行一个用户，格式：<code style={{ background:"#E5E6EB", padding:"1px 5px", borderRadius:4 }}>姓名,邮箱,部门</code>（部门可省略）。
                      首行如为表头将自动跳过。
                    </span>
                  </div>
                  <textarea value={raw} onChange={e=>setRaw(e.target.value)}
                    placeholder={"张三,zhangsan@company.com,研发部\n李四,lisi@company.com,测试部\n王五,wangwu@company.com"}
                    rows={10}
                    style={{ width:"100%", borderRadius:9, border:`1px solid ${T.border}`,
                      padding:"10px 12px", fontSize:12, color:T.t1, outline:"none",
                      resize:"vertical", boxSizing:"border-box", fontFamily:"monospace", lineHeight:1.8 }}
                    onFocus={e=>e.currentTarget.style.borderColor=T.primary}
                    onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
                  <div style={{ fontSize:11, color:T.t4, marginTop:6 }}>
                    已输入 {raw.trim()?raw.trim().split("\n").filter(l=>l.trim()).length:0} 行
                  </div>
                </>
              ) : (
                <>
                  <div onDragOver={e=>{e.preventDefault();setDragOn(true);}}
                    onDragLeave={()=>setDragOn(false)}
                    onDrop={e=>{e.preventDefault();setDragOn(false);
                      const f=e.dataTransfer.files[0];
                      if(f){ const r=new FileReader(); r.onload=ev=>setRaw(ev.target?.result as string); r.readAsText(f);}}}
                    onClick={()=>fileRef.current?.click()}
                    style={{ border:`2px dashed ${dragOn?T.primary:T.border}`, borderRadius:12,
                      padding:"40px 20px", textAlign:"center", cursor:"pointer",
                      background:dragOn?`${T.primary}06`:"#FAFBFE", transition:"all 0.15s", marginBottom:16 }}>
                    <Upload size={28} color={dragOn?T.primary:T.t4} style={{ margin:"0 auto 12px" }}/>
                    <div style={{ fontSize:13, fontWeight:500, color:T.t2, marginBottom:4 }}>
                      拖拽文件到此处，或<span style={{ color:T.primary }}>点击选择文件</span>
                    </div>
                    <div style={{ fontSize:11, color:T.t4 }}>支持 .csv / .xlsx 格式，最大 2MB</div>
                    <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{ display:"none" }}
                      onChange={e=>{ const f=e.target.files?.[0];
                        if(f){ const r=new FileReader(); r.onload=ev=>{ setRaw(ev.target?.result as string); setTab("paste"); }; r.readAsText(f); }}}/>
                  </div>
                  <button onClick={downloadTemplate}
                    style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
                      borderRadius:8, border:`1px solid ${T.border}`, background:"#fff",
                      fontSize:12, color:T.t2, cursor:"pointer" }}>
                    <Download size={13}/> 下载导入模板
                  </button>
                </>
              )}
            </div>

            <div style={{ padding:"16px 24px", borderTop:`1px solid ${T.border}`, flexShrink:0,
              display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button onClick={onClose}
                style={{ height:36, padding:"0 20px", borderRadius:8, border:`1px solid ${T.border}`,
                  background:"#fff", color:T.t2, cursor:"pointer", fontSize:13 }}>取消</button>
              <button onClick={parse} disabled={!raw.trim()}
                style={{ height:36, padding:"0 24px", borderRadius:8, border:"none",
                  background:raw.trim()?T.primary:"#C9CDD4", color:"#fff",
                  cursor:raw.trim()?"pointer":"not-allowed", fontSize:13, fontWeight:600 }}>
                解析预览
              </button>
            </div>
          </>
        )}

        {step==="preview" && (
          <>
            <div style={{ padding:"16px 24px", flex:1, overflowY:"auto" }}>
              <div style={{ display:"flex", gap:12, marginBottom:16 }}>
                <div style={{ padding:"10px 16px", borderRadius:10, background:"#E8FFEA", flex:1, textAlign:"center" }}>
                  <div style={{ fontSize:20, fontWeight:700, color:T.success }}>{validRows.length}</div>
                  <div style={{ fontSize:11, color:T.t3 }}>可导入</div>
                </div>
                <div style={{ padding:"10px 16px", borderRadius:10, background: rows.filter(r=>!r.valid).length>0?"#FFF0F0":"#F2F3F5", flex:1, textAlign:"center" }}>
                  <div style={{ fontSize:20, fontWeight:700, color:rows.filter(r=>!r.valid).length>0?T.danger:T.t4 }}>
                    {rows.filter(r=>!r.valid).length}
                  </div>
                  <div style={{ fontSize:11, color:T.t3 }}>数据异常</div>
                </div>
                <div style={{ padding:"10px 16px", borderRadius:10, background:T.bg, flex:1, textAlign:"center" }}>
                  <div style={{ fontSize:20, fontWeight:700, color:T.t1 }}>{rows.length}</div>
                  <div style={{ fontSize:11, color:T.t3 }}>共识别</div>
                </div>
              </div>

              <div style={{ borderRadius:10, border:`1px solid ${T.border}`, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr 1fr 80px",
                  padding:"8px 14px", background:T.bg }}>
                  {["姓名","邮箱","部门","状态"].map(h=>(
                    <div key={h} style={{ fontSize:11, fontWeight:600, color:T.t3, textTransform:"uppercase" }}>{h}</div>
                  ))}
                </div>
                {rows.map((row,i)=>(
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 2fr 1fr 80px",
                    padding:"10px 14px", alignItems:"center", borderTop:`1px solid ${T.border}`,
                    background:row.valid?"#fff":"#FFF8F8" }}>
                    <div style={{ fontSize:12, color:row.valid?T.t1:T.t3 }}>{row.name||"—"}</div>
                    <div style={{ fontSize:12, color:T.t3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{row.email||"—"}</div>
                    <div style={{ fontSize:12, color:T.t3 }}>{row.dept||"—"}</div>
                    <div>
                      {row.valid
                        ? <Badge label="正常" color={T.success} bg="#E8FFEA"/>
                        : <span title={row.error}><Badge label="异常" color={T.danger} bg="#FFF0F0"/></span>}
                    </div>
                  </div>
                ))}
              </div>
              {rows.some(r=>!r.valid) && (
                <div style={{ marginTop:10, fontSize:11, color:T.t3 }}>
                  异常行将被跳过，仅导入状态正常的 {validRows.length} 条记录。
                </div>
              )}
            </div>

            <div style={{ padding:"16px 24px", borderTop:`1px solid ${T.border}`, flexShrink:0,
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <button onClick={()=>setStep("edit")}
                style={{ height:36, padding:"0 20px", borderRadius:8, border:`1px solid ${T.border}`,
                  background:"#fff", color:T.t2, cursor:"pointer", fontSize:13 }}>← 返回修改</button>
              <button onClick={confirm} disabled={validRows.length===0}
                style={{ height:36, padding:"0 24px", borderRadius:8, border:"none",
                  background:validRows.length>0?T.primary:"#C9CDD4", color:"#fff",
                  cursor:validRows.length>0?"pointer":"not-allowed", fontSize:13, fontWeight:600 }}>
                确认导入 {validRows.length} 个账号
              </button>
            </div>
          </>
        )}

        {step==="success" && (
          <div style={{ padding:"48px 24px", textAlign:"center" }}>
            <div style={{ width:60, height:60, borderRadius:"50%", background:"#E8FFEA",
              display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <CheckCircle size={28} color={T.success}/>
            </div>
            <div style={{ fontSize:16, fontWeight:700, color:T.t1, marginBottom:8 }}>导入完成</div>
            <div style={{ fontSize:13, color:T.t3, marginBottom:4 }}>
              已成功创建 <strong style={{ color:T.t1 }}>{validRows.length}</strong> 个平台账号
            </div>
            <div style={{ fontSize:12, color:T.t4, marginBottom:28 }}>系统已自动向每位用户发送激活邮件</div>
            <button onClick={onClose}
              style={{ height:38, padding:"0 32px", borderRadius:9, border:"none",
                background:T.primary, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>
              完成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Invite Records Tab ───────────────────────────────────────────────────────
function InviteRecordsTab({ records, setRecords }:{
  records:InviteRecord[];
  setRecords:React.Dispatch<React.SetStateAction<InviteRecord[]>>;
}) {
  const [query, setQuery] = useState("");
  const [statusF, setStatusF] = useState<"all"|InviteStatus>("all");
  const [sourceF, setSourceF] = useState<"all"|"manual"|"batch">("all");
  const [detailId, setDetailId] = useState<string|null>(null);
  const [revokeId, setRevokeId] = useState<string|null>(null);
  const [resendId, setResendId] = useState<string|null>(null);

  const filtered = records.filter(r=>{
    if(statusF!=="all"&&r.status!==statusF) return false;
    if(sourceF!=="all"&&r.source!==sourceF) return false;
    return !query||r.name.includes(query)||r.email.toLowerCase().includes(query.toLowerCase());
  });

  const detailRec  = detailId ? records.find(r=>r.id===detailId)  : null;
  const revokeRec  = revokeId ? records.find(r=>r.id===revokeId)  : null;

  const doResend = (id:string) => {
    setResendId(null);
    const now = new Date();
    const fmt = (d:Date) => d.toISOString().slice(0,16).replace("T"," ");
    const exp = new Date(now.getTime()+48*3600*1000);
    setRecords(list=>list.map(r=>r.id===id?{...r,status:"sending"}:r));
    setTimeout(()=>setRecords(list=>list.map(r=>r.id===id
      ?{...r,status:"sent",invitedAt:fmt(now),expiresAt:fmt(exp),failReason:undefined}:r)),1600);
  };

  const doRevoke = (id:string) => {
    setRecords(list=>list.map(r=>r.id===id?{...r,status:"revoked"}:r));
    setRevokeId(null);
  };

  const canResend = (s:InviteStatus) => s==="failed"||s==="expired";
  const canRevoke = (s:InviteStatus) => s==="pending-send"||s==="sent";

  const TH = ({children,w}:{children:React.ReactNode;w?:number|string})=>(
    <div style={{fontSize:11,fontWeight:600,color:T.t3,textTransform:"uppercase" as const,
      letterSpacing:"0.05em",width:w,flexShrink:0}}>{children}</div>
  );

  const STATUS_FILTERS:(["all"|InviteStatus,string])[] = [
    ["all","全部"],["failed","发送失败"],["sent","待激活"],["activated","已激活"],
    ["expired","已过期"],["revoked","已撤销"],
  ];

  const failCount = records.filter(r=>r.status==="failed").length;
  const pendingCount = records.filter(r=>r.status==="sent"||r.status==="sending"||r.status==="pending-send").length;

  return (
    <div>
      {/* Summary strip */}
      <div style={{display:"flex",gap:10,padding:"14px 20px",borderBottom:`1px solid ${T.border}`,background:T.bg}}>
        {([
          {label:"发送失败",val:failCount,    color:T.danger,  bg:"#FFF0F0"},
          {label:"待激活",  val:pendingCount, color:T.warning, bg:"#FFF5EB"},
          {label:"已激活",  val:records.filter(r=>r.status==="activated").length, color:T.success, bg:"#E8FFEA"},
          {label:"全部邀请",val:records.length,color:T.t2,     bg:"#F2F3F5"},
        ]).map(s=>(
          <div key={s.label} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",
            borderRadius:8,background:s.bg,border:`1px solid ${s.color}20`}}>
            <span style={{fontSize:18,fontWeight:700,color:s.color,lineHeight:1}}>{s.val}</span>
            <span style={{fontSize:11,color:s.color}}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{display:"flex",gap:10,padding:"12px 20px",borderBottom:`1px solid ${T.border}`,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{position:"relative",width:220}}>
          <Search size={13} color={T.t4} style={{position:"absolute",left:10,top:10}}/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索姓名或邮箱…"
            style={{width:"100%",height:32,borderRadius:8,border:`1px solid ${T.border}`,
              paddingLeft:30,fontSize:12,color:T.t1,outline:"none",boxSizing:"border-box" as const}}
            onFocus={e=>e.currentTarget.style.borderColor=ADM}
            onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        {/* Source filter */}
        <div style={{display:"flex",gap:3,borderRadius:8,border:`1px solid ${T.border}`,overflow:"hidden"}}>
          {([["all","全部来源"],["manual","单次邀请"],["batch","批量导入"]] as const).map(([s,label])=>(
            <button key={s} onClick={()=>setSourceF(s)}
              style={{height:32,padding:"0 12px",fontSize:12,cursor:"pointer",border:"none",
                borderRight:s!=="batch"?`1px solid ${T.border}`:"none",
                background:sourceF===s?ADM_BG:"transparent",
                color:sourceF===s?ADM:T.t2,fontWeight:sourceF===s?600:400}}>
              {label}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {STATUS_FILTERS.map(([s,label])=>{
            const cfg = s==="all"?null:INVITE_STATUS_CFG[s];
            const active = statusF===s;
            return(
              <button key={s} onClick={()=>setStatusF(s)}
                style={{height:32,padding:"0 12px",borderRadius:8,fontSize:12,cursor:"pointer",
                  border:`1px solid ${active?(cfg?.color||ADM):T.border}`,
                  background:active?(cfg?cfg.bg:ADM_BG):"transparent",
                  color:active?(cfg?.color||ADM):T.t2,fontWeight:active?600:400}}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table header */}
      <div style={{display:"flex",alignItems:"center",gap:0,padding:"10px 20px",background:T.bg}}>
        <TH w={152}>被邀请人</TH>
        <TH w={192}>邮箱</TH>
        <TH w={72}>角色</TH>
        <TH w={80}>邀请方式</TH>
        <TH w={126}>邀请时间</TH>
        <TH w={126}>过期时间</TH>
        <TH w={80}>状态</TH>
        <div style={{flex:1,fontSize:11,fontWeight:600,color:T.t3,textTransform:"uppercase" as const,letterSpacing:"0.05em"}}>失败原因</div>
        <TH w={64}>操作人</TH>
        <TH w={140}>操作</TH>
      </div>

      {/* Rows */}
      {filtered.map((r,i)=>{
        const sc=INVITE_STATUS_CFG[r.status];
        return(
          <div key={r.id} style={{display:"flex",alignItems:"center",gap:0,padding:"13px 20px",
            borderTop:`1px solid ${T.border}`,background:r.status==="failed"?"#FFFAFA":T.card,
            transition:"background 0.1s"}}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=r.status==="failed"?"#FFF5F5":"#FAFBFE"}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=r.status==="failed"?"#FFFAFA":T.card}>
            {/* 被邀请人 */}
            <div style={{width:152,flexShrink:0,display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,
                background:`linear-gradient(135deg,${ADM},${ADM}99)`,
                display:"flex",alignItems:"center",justifyContent:"center",
                color:"#fff",fontWeight:700,fontSize:12}}>{r.name[0]}</div>
              <span style={{fontSize:13,fontWeight:500,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</span>
            </div>
            {/* 邮箱 */}
            <div style={{width:192,flexShrink:0,fontSize:12,color:T.t3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.email}</div>
            {/* 角色 */}
            <div style={{width:72,flexShrink:0}}>
              {r.role==="super-admin"
                ?<Badge label="管理员" color={ADM} bg={ADM_BG}/>
                :<Badge label="普通用户" color={T.t3} bg="#F2F3F5"/>}
            </div>
            {/* 邀请方式 */}
            <div style={{width:80,flexShrink:0}}>
              {r.source==="batch"
                ?<Badge label="批量导入" color={T.primary} bg="#EBF3FF"/>
                :<Badge label="单次邀请" color={T.t3} bg="#F2F3F5"/>}
            </div>
            {/* 邀请时间 */}
            <div style={{width:126,flexShrink:0,fontSize:11,color:T.t3,fontFamily:"monospace"}}>{r.invitedAt}</div>
            {/* 过期时间 */}
            <div style={{width:126,flexShrink:0,fontSize:11,color:T.t3,fontFamily:"monospace"}}>{r.expiresAt}</div>
            {/* 状态 */}
            <div style={{width:80,flexShrink:0}}>
              <span style={{fontSize:11,fontWeight:500,padding:"2px 8px",borderRadius:10,
                background:sc.bg,color:sc.color,whiteSpace:"nowrap" as const,display:"inline-flex",alignItems:"center",gap:4}}>
                {r.status==="sending"&&(
                  <span className="animate-pulse" style={{width:6,height:6,borderRadius:"50%",
                    background:T.primary,display:"inline-block"}}/>
                )}
                {sc.label}
              </span>
            </div>
            {/* 失败原因 */}
            <div style={{flex:1,minWidth:0,fontSize:11,color:r.failReason?T.danger:T.t4,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const,paddingRight:8}}
              title={r.failReason||""}>
              {r.failReason||"—"}
            </div>
            {/* 操作人 */}
            <div style={{width:64,flexShrink:0,fontSize:12,color:T.t2}}>{r.operator}</div>
            {/* 操作 */}
            <div style={{width:140,flexShrink:0,display:"flex",gap:5}}>
              <SBtn color={T.primary} onClick={()=>setDetailId(r.id)}>查看</SBtn>
              {canResend(r.status)&&(
                <SBtn color={T.warning} onClick={()=>setResendId(r.id)}>重发</SBtn>
              )}
              {canRevoke(r.status)&&(
                <SBtn color={T.danger} onClick={()=>setRevokeId(r.id)}>撤销</SBtn>
              )}
            </div>
          </div>
        );
      })}
      {filtered.length===0&&(
        <div style={{padding:"56px 0",textAlign:"center",color:T.t4,fontSize:13}}>暂无匹配的邀请记录</div>
      )}

      {/* ── Detail drawer ── */}
      {detailRec&&(
        <div style={{position:"fixed",inset:0,zIndex:300}}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.35)"}} onClick={()=>setDetailId(null)}/>
          <div style={{position:"absolute",top:0,right:0,bottom:0,width:420,background:"#fff",
            boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column"}}>
            <div style={{padding:"18px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:600,color:T.t1}}>邀请详情</div>
                <div style={{fontSize:11,color:T.t3,marginTop:2}}>{detailRec.email}</div>
              </div>
              <button onClick={()=>setDetailId(null)} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,padding:4,display:"flex"}}>
                <X size={16}/>
              </button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"20px"}}>
              {([
                ["被邀请人",detailRec.name],
                ["邮箱地址",detailRec.email],
                ["平台角色",detailRec.role==="super-admin"?"超级管理员":"普通用户"],
                ["邀请时间",detailRec.invitedAt],
                ["过期时间",detailRec.expiresAt],
                ["操作人",  detailRec.operator],
              ] as [string,string][]).map(([label,val])=>(
                <div key={label} style={{display:"flex",padding:"12px 0",borderBottom:`1px solid ${T.border}`}}>
                  <div style={{width:80,flexShrink:0,fontSize:12,color:T.t3}}>{label}</div>
                  <div style={{fontSize:13,color:T.t1,fontWeight:500}}>{val}</div>
                </div>
              ))}
              <div style={{display:"flex",padding:"12px 0",borderBottom:`1px solid ${T.border}`}}>
                <div style={{width:80,flexShrink:0,fontSize:12,color:T.t3}}>邀请状态</div>
                <div>
                  <span style={{fontSize:12,fontWeight:500,padding:"2px 8px",borderRadius:10,
                    background:INVITE_STATUS_CFG[detailRec.status].bg,
                    color:INVITE_STATUS_CFG[detailRec.status].color}}>
                    {INVITE_STATUS_CFG[detailRec.status].label}
                  </span>
                </div>
              </div>
              {detailRec.failReason&&(
                <div style={{marginTop:16,padding:"12px 14px",borderRadius:9,
                  background:"#FFF0F0",border:`1px solid ${T.danger}25`}}>
                  <div style={{fontSize:11,fontWeight:600,color:T.danger,marginBottom:6}}>失败原因</div>
                  <div style={{fontSize:12,color:T.danger,lineHeight:1.6}}>{detailRec.failReason}</div>
                </div>
              )}
            </div>
            <div style={{padding:"14px 20px",borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"flex-end",gap:8,flexShrink:0}}>
              {canResend(detailRec.status)&&(
                <button onClick={()=>{setDetailId(null);doResend(detailRec.id);}}
                  style={{height:32,padding:"0 16px",borderRadius:8,border:"none",
                    background:T.warning,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",
                    display:"flex",alignItems:"center",gap:5}}>
                  <Send size={12}/>重新发送
                </button>
              )}
              {canRevoke(detailRec.status)&&(
                <button onClick={()=>{setDetailId(null);setRevokeId(detailRec.id);}}
                  style={{height:32,padding:"0 16px",borderRadius:8,border:`1px solid ${T.danger}40`,
                    background:`${T.danger}0D`,color:T.danger,fontSize:12,fontWeight:500,cursor:"pointer"}}>
                  撤销邀请
                </button>
              )}
              <button onClick={()=>setDetailId(null)}
                style={{height:32,padding:"0 16px",borderRadius:8,border:`1px solid ${T.border}`,
                  background:"#fff",color:T.t2,fontSize:12,cursor:"pointer"}}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Resend confirm ── */}
      {resendId&&(()=>{const rec=records.find(r=>r.id===resendId)!;return(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",
          alignItems:"center",justifyContent:"center",zIndex:300}} onClick={()=>setResendId(null)}>
          <div style={{width:400,background:"#fff",borderRadius:16,padding:"24px",
            boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:36,height:36,borderRadius:10,background:"#FFF5EB",
                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Send size={16} color={T.warning}/>
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:600,color:T.t1}}>重新发送邀请</div>
                <div style={{fontSize:11,color:T.t3,marginTop:2}}>{rec.email}</div>
              </div>
            </div>
            <p style={{fontSize:13,color:T.t2,lineHeight:1.6,margin:"0 0 16px"}}>
              旧的邀请链接将立即失效，系统将向 <strong style={{color:T.t1}}>{rec.email}</strong> 发送新的激活链接，有效期 48 小时。
            </p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setResendId(null)}
                style={{flex:1,height:36,borderRadius:8,border:`1px solid ${T.border}`,
                  background:"#fff",color:T.t2,cursor:"pointer",fontSize:13}}>取消</button>
              <button onClick={()=>doResend(resendId)}
                style={{flex:2,height:36,borderRadius:8,border:"none",
                  background:T.warning,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}}>
                确认重发
              </button>
            </div>
          </div>
        </div>
      );})()}

      {/* ── Revoke confirm ── */}
      {revokeId&&(()=>{const rec=records.find(r=>r.id===revokeId)!;return(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",
          alignItems:"center",justifyContent:"center",zIndex:300}} onClick={()=>setRevokeId(null)}>
          <div style={{width:400,background:"#fff",borderRadius:16,padding:"24px",
            boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:36,height:36,borderRadius:10,background:`${T.danger}12`,
                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <X size={16} color={T.danger}/>
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:600,color:T.t1}}>撤销邀请</div>
                <div style={{fontSize:11,color:T.t3,marginTop:2}}>{rec.name} · {rec.email}</div>
              </div>
            </div>
            <p style={{fontSize:13,color:T.t2,lineHeight:1.6,margin:"0 0 16px"}}>
              撤销后，该邀请链接将立即失效，<strong>{rec.name}</strong> 将无法通过该链接激活账号。
              如需重新邀请，可在记录中再次发送。
            </p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setRevokeId(null)}
                style={{flex:1,height:36,borderRadius:8,border:`1px solid ${T.border}`,
                  background:"#fff",color:T.t2,cursor:"pointer",fontSize:13}}>取消</button>
              <button onClick={()=>doRevoke(revokeId)}
                style={{flex:2,height:36,borderRadius:8,border:"none",
                  background:T.danger,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:600}}>
                确认撤销
              </button>
            </div>
          </div>
        </div>
      );})()}
    </div>
  );
}

// ─── Page 3: Accounts ─────────────────────────────────────────────────────────
function AccountManagement() {
  const [subTab,         setSubTab]         = useState<"list"|"invites">("list");
  const [users,          setUsers]          = useState(PLATFORM_USERS);
  const [inviteRecords,  setInviteRecords]  = useState<InviteRecord[]>(MOCK_INVITES);
  const [query,          setQuery]          = useState("");
  const [filter,         setFilter]         = useState<"all"|"active"|"disabled">("all");
  const [showInvite,     setShowInvite]     = useState(false);
  const [showBatch,      setShowBatch]      = useState(false);

  const filtered = users.filter(u=>{
    if (filter==="active"   && u.status!=="active")   return false;
    if (filter==="disabled" && u.status!=="disabled") return false;
    return !query || u.name.includes(query) || u.email.toLowerCase().includes(query.toLowerCase());
  });

  const toggleUser = (id:string) =>
    setUsers(list=>list.map(u=>u.id===id?{...u,status:u.status==="active"?"disabled":"active"}:u));

  const fmtDate = (d:Date) => d.toISOString().slice(0,16).replace("T"," ");

  const addUser = (u:PlatformUser) => {
    setUsers(list=>[u,...list]);
    const now = new Date();
    const rec: InviteRecord = {
      id:"i_"+u.id, name:u.name, email:u.email, role:u.role,
      invitedAt:fmtDate(now), expiresAt:fmtDate(new Date(now.getTime()+48*3600*1000)),
      status:"sent", operator:"张程远", source:"manual",
    };
    setInviteRecords(list=>[rec,...list]);
  };

  const addBatch = (rows:ImportRow[]) => {
    const now = new Date();
    const exp = new Date(now.getTime()+48*3600*1000);
    const newRecs: InviteRecord[] = rows.map((r,i)=>({
      id:"i_b"+Date.now()+i, name:r.name, email:r.email, role:"user" as const,
      invitedAt:fmtDate(now), expiresAt:fmtDate(exp),
      status:"sent" as InviteStatus, operator:"张程远", source:"batch" as const,
    }));
    setInviteRecords(list=>[...newRecs,...list]);
  };

  return (
    <div style={{ padding:"24px", overflowY:"auto" }}>
      {showInvite && <InviteModal onClose={()=>setShowInvite(false)} onDone={u=>{ addUser(u); }}/>}
      {showBatch  && <BatchImportModal onClose={()=>setShowBatch(false)} onDone={rows=>{ addBatch(rows); setSubTab("invites"); }}/>}

      <SectionCard title="账号管理"
        action={
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setShowBatch(true)}
              style={{ height:32, padding:"0 14px", borderRadius:8, fontSize:12, fontWeight:500,
                border:`1px solid ${T.border}`, background:"#fff", color:T.t2, cursor:"pointer",
                display:"flex", alignItems:"center", gap:5 }}>
              <Upload size={12}/>批量导入
            </button>
            <button onClick={()=>setShowInvite(true)}
              style={{ height:32, padding:"0 14px", borderRadius:8, fontSize:12, fontWeight:600,
                border:"none", background:ADM, color:"#fff", cursor:"pointer",
                display:"flex", alignItems:"center", gap:5 }}>
              <UserPlus size={12}/>邀请账号
            </button>
          </div>
        }>

        {/* Sub-tabs */}
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`}}>
          {([["list",`账号列表（${users.length}）`],["invites",`邀请记录（${inviteRecords.length}）`]] as const).map(([t,label])=>(
            <button key={t} onClick={()=>setSubTab(t)}
              style={{padding:"11px 20px",fontSize:13,fontWeight:subTab===t?700:400,
                border:"none",borderBottom:`2px solid ${subTab===t?ADM:"transparent"}`,
                background:"transparent",color:subTab===t?ADM:T.t3,cursor:"pointer",
                display:"flex",alignItems:"center",gap:6}}>
              {label}
              {t==="invites"&&inviteRecords.filter(r=>r.status==="failed").length>0&&(
                <span style={{minWidth:16,height:16,borderRadius:8,background:T.danger,
                  color:"#fff",fontSize:10,fontWeight:700,display:"inline-flex",
                  alignItems:"center",justifyContent:"center",padding:"0 4px"}}>
                  {inviteRecords.filter(r=>r.status==="failed").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {subTab==="invites"&&<InviteRecordsTab records={inviteRecords} setRecords={setInviteRecords}/>}

        {subTab==="list"&&<>
        {/* Toolbar */}
        <div style={{ display:"flex", gap:10, padding:"14px 20px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ position:"relative", flex:1 }}>
            <Search size={13} color={T.t4} style={{ position:"absolute", left:10, top:11 }}/>
            <input value={query} onChange={e=>setQuery(e.target.value)}
              placeholder="搜索姓名或邮箱…"
              style={{ width:"100%", height:34, borderRadius:8, border:`1px solid ${T.border}`,
                paddingLeft:30, fontSize:13, color:T.t1, outline:"none", boxSizing:"border-box" }}
              onFocus={e=>e.currentTarget.style.borderColor=ADM}
              onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {(["all","active","disabled"] as const).map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                style={{ height:34, padding:"0 12px", borderRadius:8, fontSize:12,
                  border:`1px solid ${filter===f?ADM:T.border}`,
                  background:filter===f?ADM_BG:"transparent",
                  color:filter===f?ADM:T.t2, cursor:"pointer" }}>
                {f==="all"?"全部":f==="active"?"正常":"已禁用"}
              </button>
            ))}
          </div>
        </div>

        {/* Table header */}
        <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 80px 70px 110px 140px",
          padding:"10px 20px", background:T.bg }}>
          {["用户","邮箱","状态","工作区数","最近登录","操作"].map(h=>(
            <div key={h} style={{ fontSize:11, fontWeight:600, color:T.t3, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</div>
          ))}
        </div>
        {filtered.map((u)=>(
          <div key={u.id} style={{ display:"grid", gridTemplateColumns:"2fr 2fr 80px 70px 110px 140px",
            padding:"13px 20px", alignItems:"center", borderTop:`1px solid ${T.border}`,
            background: u.status==="disabled"?"#FAFBFE":T.card }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <UserAvatar avatar={u.avatar}/>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:u.status==="disabled"?T.t3:T.t1 }}>{u.name}</div>
                {u.role==="super-admin"&&<Badge label="超级管理员" color={ADM} bg={ADM_BG}/>}
              </div>
            </div>
            <div style={{ fontSize:12, color:T.t3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</div>
            <div>
              <Badge
                label={u.status==="active"?"正常":"已禁用"}
                color={u.status==="active"?T.success:T.t3}
                bg={u.status==="active"?"#E8FFEA":"#F2F3F5"}/>
            </div>
            <div style={{ fontSize:13, color:T.t2 }}>{u.workspaces} 个</div>
            <div style={{ fontSize:12, color:T.t3 }}>{u.lastLogin}</div>
            <div style={{ display:"flex", gap:5 }}>
              <SBtn color={T.warning} onClick={()=>{}} disabled={u.role==="super-admin"}>
                <RotateCcw size={11}/>
              </SBtn>
              <SBtn color={u.status==="active"?T.danger:T.success}
                onClick={()=>toggleUser(u.id)} disabled={u.role==="super-admin"}>
                {u.status==="active"?"禁用":"启用"}
              </SBtn>
            </div>
          </div>
        ))}
        </>}
      </SectionCard>
    </div>
  );
}

// ─── Page 4: Requests ─────────────────────────────────────────────────────────
function RequestApprovals() {
  const [requests, setRequests] = useState(INIT_REQUESTS);
  const [tab, setTab]           = useState<"pending"|"handled">("pending");
  const [rejectId, setRejectId] = useState<string|null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const shown = requests.filter(r=> tab==="pending" ? r.status==="pending" : r.status!=="pending");

  const approve = (id:string) =>
    setRequests(list=>list.map(r=>r.id===id?{...r,status:"approved"}:r));

  const reject = (id:string, reason:string) => {
    setRequests(list=>list.map(r=>r.id===id?{...r,status:"rejected",reason}:r));
    setRejectId(null); setRejectReason("");
  };

  const pendingCount = requests.filter(r=>r.status==="pending").length;

  return (
    <div style={{ padding:"24px", overflowY:"auto" }}>
      <SectionCard title="加入申请审批">
        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:`1px solid ${T.border}` }}>
          {([
            ["pending", `待审批（${pendingCount}）`],
            ["handled", "已处理"],
          ] as const).map(([t, label])=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{ padding:"12px 20px", fontSize:13, fontWeight:tab===t?700:400,
                border:"none", borderBottom:`2px solid ${tab===t?ADM:"transparent"}`,
                background:"transparent", color:tab===t?ADM:T.t3, cursor:"pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {shown.length===0 ? (
          <div style={{ padding:"48px 0", textAlign:"center", color:T.t4, fontSize:13 }}>
            {tab==="pending"?"暂无待审批的申请":"暂无已处理的申请"}
          </div>
        ) : shown.map((req,i)=>(
          <div key={req.id} style={{ padding:"20px", borderTop: i>0?`1px solid ${T.border}`:"none",
            background: req.status==="pending"?T.card:"#FAFBFE" }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
              {/* 申请人 */}
              <UserAvatar avatar={req.avatar} size={40}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:T.t1 }}>{req.applicant}</span>
                  <span style={{ fontSize:12, color:T.t3 }}>{req.email}</span>
                  <span style={{ fontSize:11, color:T.t4, marginLeft:"auto" }}>{req.appliedAt}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: req.reason?8:0 }}>
                  <span style={{ fontSize:12, color:T.t2 }}>申请加入</span>
                  <div style={{ display:"flex", alignItems:"center", gap:6,
                    padding:"4px 10px", borderRadius:8, background:ADM_BG, border:`1px solid ${ADM}30` }}>
                    <Building2 size={12} color={ADM}/>
                    <span style={{ fontSize:12, fontWeight:600, color:ADM }}>{req.workspace}</span>
                    <span style={{ fontSize:11, color:T.t3 }}>· {req.wsDesc}</span>
                  </div>
                </div>
                {req.reason && (
                  <div style={{ fontSize:12, color:T.t3, marginTop:4 }}>
                    拒绝原因：<span style={{ color:T.danger }}>{req.reason}</span>
                  </div>
                )}
              </div>

              {/* 操作 */}
              <div style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
                {req.status==="pending" && (
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>{ setRejectId(req.id); setRejectReason(""); }}
                      style={{ height:32, padding:"0 14px", borderRadius:8, fontSize:12, fontWeight:500,
                        border:`1px solid ${T.danger}40`, background:`${T.danger}0D`,
                        color:T.danger, cursor:"pointer" }}>
                      <X size={12} style={{ marginRight:4, display:"inline" }}/>拒绝
                    </button>
                    <button onClick={()=>approve(req.id)}
                      style={{ height:32, padding:"0 14px", borderRadius:8, fontSize:12, fontWeight:500,
                        border:"none", background:T.success, color:"#fff", cursor:"pointer" }}>
                      <CheckCircle2 size={12} style={{ marginRight:4, display:"inline" }}/>批准
                    </button>
                  </div>
                )}
                {req.status!=="pending" && (
                  <Badge
                    label={req.status==="approved"?"已批准":"已拒绝"}
                    color={req.status==="approved"?T.success:T.danger}
                    bg={req.status==="approved"?"#E8FFEA":"#FFF0F0"}/>
                )}
              </div>
            </div>
          </div>
        ))}
      </SectionCard>

      {/* 拒绝原因弹窗 */}
      {rejectId && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}
          onClick={()=>setRejectId(null)}>
          <div style={{ width:400, background:"#fff", borderRadius:16, padding:"24px",
            boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:16, fontWeight:600, color:T.t1, marginBottom:6 }}>拒绝申请</div>
            <p style={{ fontSize:13, color:T.t3, marginBottom:16 }}>请填写拒绝原因，将通过邮件告知申请人。</p>
            <textarea value={rejectReason} onChange={e=>setRejectReason(e.target.value)}
              placeholder="例如：不在项目授权名单内，请联系项目负责人" rows={3}
              style={{ width:"100%", borderRadius:9, border:`1px solid ${T.border}`,
                padding:"10px 12px", fontSize:13, color:T.t1, outline:"none",
                resize:"none", boxSizing:"border-box" }}
              onFocus={e=>e.currentTarget.style.borderColor=ADM}
              onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={()=>setRejectId(null)}
                style={{ flex:1, height:38, borderRadius:9, border:`1px solid ${T.border}`,
                  background:"#fff", color:T.t2, cursor:"pointer", fontSize:13 }}>取消</button>
              <button onClick={()=>reject(rejectId, rejectReason||"申请被管理员拒绝")}
                style={{ flex:2, height:38, borderRadius:9, border:"none",
                  background:T.danger, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>
                确认拒绝
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page 5: Audit Log ────────────────────────────────────────────────────────
function AuditLogPage() {
  const [query, setQuery] = useState("");
  const filtered = AUDIT_LOG.filter(a=>
    !query || a.operator.includes(query) || a.action.includes(query) || a.target.includes(query)
  );

  return (
    <div style={{ padding:"24px", overflowY:"auto" }}>
      <SectionCard title="平台操作日志">
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ position:"relative", maxWidth:320 }}>
            <Search size={13} color={T.t4} style={{ position:"absolute", left:10, top:11 }}/>
            <input value={query} onChange={e=>setQuery(e.target.value)}
              placeholder="搜索操作人、动作或对象…"
              style={{ width:"100%", height:34, borderRadius:8, border:`1px solid ${T.border}`,
                paddingLeft:30, fontSize:13, color:T.t1, outline:"none", boxSizing:"border-box" }}
              onFocus={e=>e.currentTarget.style.borderColor=ADM}
              onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"150px 80px 100px 1fr 90px 60px",
          padding:"10px 20px", background:T.bg }}>
          {["时间","操作人","动作","对象","IP","结果"].map(h=>(
            <div key={h} style={{ fontSize:11, fontWeight:600, color:T.t3, textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</div>
          ))}
        </div>
        {filtered.map((a,i)=>(
          <div key={a.id} style={{ display:"grid", gridTemplateColumns:"150px 80px 100px 1fr 90px 60px",
            padding:"13px 20px", alignItems:"center", borderTop:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11, color:T.t3, fontFamily:"monospace" }}>{a.time}</div>
            <div style={{ fontSize:12, fontWeight:500, color:T.t1 }}>{a.operator}</div>
            <div style={{ fontSize:12, color:T.t2 }}>{a.action}</div>
            <div style={{ fontSize:12, color:T.t3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.target}</div>
            <div style={{ fontSize:11, color:T.t4, fontFamily:"monospace" }}>{a.ip}</div>
            <div>
              <Badge
                label={a.result==="success"?"成功":"失败"}
                color={a.result==="success"?T.success:T.danger}
                bg={a.result==="success"?"#E8FFEA":"#FFF0F0"}/>
            </div>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

// ─── Notify Page ──────────────────────────────────────────────────────────────
const NOTIFY_RULES = [
  { id:"invite",    label:"邀请成员",         desc:"管理员通过平台邀请新账号时发送确认邮件给被邀请人",           channel:"邮件", defaultOn:true  },
  { id:"welcome",   label:"账号激活",         desc:"新账号首次设置密码后，发送欢迎邮件及平台使用指引",           channel:"邮件", defaultOn:true  },
  { id:"reset",     label:"密码重置",         desc:"用户发起忘记密码请求时，发送重置链接邮件",                   channel:"邮件", defaultOn:true  },
  { id:"approve",   label:"申请审批通知",     desc:"工作区加入申请被审批通过或拒绝时，通知申请人结果",           channel:"邮件", defaultOn:true  },
  { id:"disable",   label:"账号禁用告警",     desc:"账号被管理员手动禁用时，发送告警邮件给该账号",               channel:"邮件", defaultOn:false },
  { id:"login_fail",label:"连续登录失败",     desc:"同一账号 5 次密码错误后，发送安全告警给账号及超级管理员",     channel:"邮件", defaultOn:true  },
  { id:"task_done", label:"自动化任务完成",   desc:"执行任务完成时（不论成功失败），通知任务创建人",             channel:"邮件", defaultOn:false },
  { id:"daily",     label:"每日质量报告",     desc:"每天早 9 点，向所有工作区管理员发送前一日测试质量摘要",       channel:"邮件", defaultOn:false },
];

function NotifyPage() {
  const[host,    setHost]    = useState("smtp.company.com");
  const[port,    setPort]    = useState("465");
  const[user,    setUser]    = useState("autotest-notify@company.com");
  const[pw,      setPw]      = useState("••••••••••••");
  const[showPw,  setShowPw]  = useState(false);
  const[enc,     setEnc]     = useState("SSL/TLS");
  const[from,    setFrom]    = useState("AutoTest 平台通知");
  const[testing, setTesting] = useState(false);
  const[testOk,  setTestOk]  = useState<boolean|null>(null);
  const[saved,   setSaved]   = useState(false);
  const[rules,   setRules]   = useState<Record<string,boolean>>(
    Object.fromEntries(NOTIFY_RULES.map(r=>[r.id, r.defaultOn]))
  );

  const toggleRule = (id:string) => setRules(p=>({...p,[id]:!p[id]}));
  const sendTest = () => {
    setTesting(true); setTestOk(null);
    setTimeout(()=>{ setTesting(false); setTestOk(true); }, 2000);
  };
  const save = () => {
    setSaved(true); setTimeout(()=>setSaved(false), 2500);
  };

  const Field = ({label,value,onChange,type="text",placeholder="",right}:{
    label:string;value:string;onChange:(v:string)=>void;type?:string;placeholder?:string;right?:React.ReactNode;
  }) => (
    <div>
      <label style={{display:"block",fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>{label}</label>
      <div style={{position:"relative"}}>
        <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
          style={{width:"100%",height:36,border:`1px solid ${T.border}`,borderRadius:8,
            padding:right?"0 36px 0 12px":"0 12px",fontSize:13,color:T.t1,outline:"none",
            boxSizing:"border-box",background:"#fff"}}
          onFocus={e=>{e.currentTarget.style.borderColor=ADM;e.currentTarget.style.boxShadow=`0 0 0 2px ${ADM}20`;}}
          onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
        {right&&<div style={{position:"absolute",right:10,top:9}}>{right}</div>}
      </div>
    </div>
  );

  return (
    <div style={{padding:28}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <div>
          <h3 style={{fontSize:16,fontWeight:700,color:T.t1,margin:"0 0 4px"}}>消息与通知</h3>
          <p style={{fontSize:13,color:T.t3,margin:0}}>配置邮件服务和系统通知的触发规则</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {saved&&<span style={{fontSize:13,color:T.success,display:"flex",alignItems:"center",gap:5}}>
            <CheckCircle size={14} color={T.success}/>已保存</span>}
          <button onClick={save} style={{height:34,padding:"0 18px",borderRadius:8,border:"none",
            background:ADM,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
            onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.08)"}
            onMouseLeave={e=>e.currentTarget.style.filter=""}>
            <CheckCircle size={13} color="#fff"/>保存配置
          </button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>

        {/* ── Left: SMTP config ── */}
        <div style={{background:"#fff",borderRadius:14,border:`1px solid ${T.border}`,
          boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,
            display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:8,background:ADM_BG,
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Server size={15} color={ADM}/>
            </div>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:T.t1}}>SMTP 邮件服务</div>
              <div style={{fontSize:11,color:T.t3}}>配置发件服务器连接参数</div>
            </div>
          </div>
          <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10}}>
              <Field label="SMTP 服务器" value={host} onChange={setHost} placeholder="smtp.example.com"/>
              <div>
                <label style={{display:"block",fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>端口</label>
                <select value={port} onChange={e=>setPort(e.target.value)}
                  style={{width:90,height:36,border:`1px solid ${T.border}`,borderRadius:8,
                    padding:"0 8px",fontSize:13,color:T.t1,outline:"none",background:"#fff"}}>
                  {["25","465","587","994"].map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <Field label="发件人账号" value={user} onChange={setUser} placeholder="noreply@example.com"/>
            <Field label="授权密码 / SMTP 密钥" value={showPw?pw:"••••••••••••"}
              onChange={setPw} type={showPw?"text":"password"}
              right={<button onClick={()=>setShowPw(!showPw)}
                style={{background:"none",border:"none",cursor:"pointer",color:T.t4,padding:0}}>
                {showPw?<Eye size={14}/>:<Lock size={14}/>}
              </button>}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={{display:"block",fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>加密方式</label>
                <select value={enc} onChange={e=>setEnc(e.target.value)}
                  style={{width:"100%",height:36,border:`1px solid ${T.border}`,borderRadius:8,
                    padding:"0 10px",fontSize:13,color:T.t1,outline:"none",background:"#fff"}}>
                  {["SSL/TLS","STARTTLS","无加密"].map(v=><option key={v}>{v}</option>)}
                </select>
              </div>
              <Field label="发件人显示名" value={from} onChange={setFrom} placeholder="AutoTest 平台"/>
            </div>

            {/* Test button */}
            <div style={{paddingTop:4,borderTop:`1px dashed ${T.border}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{fontSize:12,color:T.t3}}>向当前登录账号发送测试邮件</div>
                <button onClick={sendTest} disabled={testing}
                  style={{height:32,padding:"0 14px",borderRadius:8,
                    border:`1px solid ${T.border}`,background:"#fff",
                    fontSize:13,cursor:testing?"not-allowed":"pointer",
                    color:T.t2,display:"flex",alignItems:"center",gap:6}}>
                  {testing
                    ? <><Loader2 size={13} className="animate-spin"/>发送中…</>
                    : <><Send size={13}/>发送测试邮件</>}
                </button>
              </div>
              {testOk===true&&(
                <div style={{marginTop:8,fontSize:12,color:T.success,
                  display:"flex",alignItems:"center",gap:5}}>
                  <CheckCircle size={13} color={T.success}/>测试邮件已发送，请检查收件箱
                </div>
              )}
              {testOk===false&&(
                <div style={{marginTop:8,fontSize:12,color:T.danger}}>
                  连接失败，请检查服务器地址和密码
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Notification rules ── */}
        <div style={{background:"#fff",borderRadius:14,border:`1px solid ${T.border}`,
          boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:8,background:"#E8F3FF",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Bell size={15} color={T.primary}/>
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:T.t1}}>通知触发规则</div>
                <div style={{fontSize:11,color:T.t3}}>
                  已开启 {Object.values(rules).filter(Boolean).length} / {NOTIFY_RULES.length} 项
                </div>
              </div>
            </div>
            <button onClick={()=>setRules(Object.fromEntries(NOTIFY_RULES.map(r=>[r.id,true])))}
              style={{fontSize:12,color:T.primary,background:"none",border:"none",cursor:"pointer",padding:0}}>
              全部开启
            </button>
          </div>
          <div>
            {NOTIFY_RULES.map((rule,i)=>{
              const on = rules[rule.id];
              return (
                <div key={rule.id}
                  style={{padding:"14px 20px",borderBottom:i<NOTIFY_RULES.length-1?`1px solid ${T.border}`:"none",
                    display:"flex",alignItems:"flex-start",gap:12}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <span style={{fontSize:13,fontWeight:500,color:on?T.t1:T.t3}}>{rule.label}</span>
                      <span style={{fontSize:10,padding:"1px 6px",borderRadius:10,
                        background:"#E8F3FF",color:T.primary}}>{rule.channel}</span>
                    </div>
                    <p style={{fontSize:11,color:T.t4,margin:0,lineHeight:1.5}}>{rule.desc}</p>
                  </div>
                  <button onClick={()=>toggleRule(rule.id)} style={{background:"none",border:"none",
                    cursor:"pointer",padding:0,flexShrink:0,marginTop:1}}>
                    {on
                      ? <ToggleRight size={26} color={ADM}/>
                      : <ToggleLeft  size={26} color={T.t4}/>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const ADMIN_NAV: { key:AdminPage; label:string; icon:React.ElementType; badge?:(r:JoinRequest[])=>number }[] = [
  { key:"overview",   label:"平台概览",   icon:LayoutDashboard  },
  { key:"workspaces", label:"工作区管理", icon:Building2        },
  { key:"accounts",   label:"账号管理",   icon:Users            },
  { key:"requests",   label:"申请审批",   icon:ClipboardCheck, badge:(r)=>r.filter(x=>x.status==="pending").length },
  { key:"audit",      label:"操作日志",   icon:ScrollText       },
  { key:"notify",     label:"消息与通知", icon:Bell             },
];

// ─── Main export ──────────────────────────────────────────────────────────────
export function PlatformAdminModule() {
  const [page, setPage] = useState<AdminPage>("overview");
  const [requests, setRequests] = useState(INIT_REQUESTS);
  const pendingCount = requests.filter(r=>r.status==="pending").length;

  return (
    <div style={{ flex:1, display:"flex", overflow:"hidden", background:T.bg }}>

      {/* Sidebar */}
      <div style={{ width:200, flexShrink:0, background:"#fff", borderRight:`1px solid ${T.border}`,
        display:"flex", flexDirection:"column", padding:"16px 0" }}>

        {/* Admin badge */}
        <div style={{ padding:"0 16px 16px", borderBottom:`1px solid ${T.border}`, marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px",
            borderRadius:10, background:ADM_BG, border:`1px solid ${ADM}30` }}>
            <ShieldAlert size={15} color={ADM}/>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:ADM }}>平台管理后台</div>
              <div style={{ fontSize:10, color:T.t3 }}>超级管理员专属</div>
            </div>
          </div>
        </div>

        {ADMIN_NAV.map(nav=>{
          const active = page===nav.key;
          const badge = nav.badge?.(requests);
          return (
            <button key={nav.key} onClick={()=>setPage(nav.key)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 16px",
                margin:"0 8px", borderRadius:9, border:"none", cursor:"pointer", textAlign:"left",
                background:active?ADM_BG:"transparent", transition:"background 0.15s" }}
              onMouseEnter={e=>{ if(!active) e.currentTarget.style.background=T.bg; }}
              onMouseLeave={e=>{ if(!active) e.currentTarget.style.background="transparent"; }}>
              <nav.icon size={16} color={active?ADM:T.t3}/>
              <span style={{ fontSize:13, fontWeight:active?600:400, color:active?ADM:T.t2, flex:1 }}>
                {nav.label}
              </span>
              {badge!=null && badge>0 && (
                <span style={{ minWidth:18, height:18, borderRadius:9, background:T.warning,
                  color:"#fff", fontSize:10, fontWeight:700,
                  display:"flex", alignItems:"center", justifyContent:"center", padding:"0 4px" }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex:1, minWidth:0, overflowY:"auto" }}>
        {page==="overview"   && <AdminOverview requests={requests}/>}
        {page==="workspaces" && <WorkspaceManagement/>}
        {page==="accounts"   && <AccountManagement/>}
        {page==="requests"   && <RequestApprovals/>}
        {page==="audit"      && <AuditLogPage/>}
        {page==="notify"     && <NotifyPage/>}
      </div>
    </div>
  );
}
