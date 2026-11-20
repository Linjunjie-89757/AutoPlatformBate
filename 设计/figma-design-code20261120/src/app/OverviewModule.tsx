import React, { useState } from "react";
import {
  Bug, CheckCircle, ChevronRight,
  Play, FileText, Activity,
  FlaskConical, TrendingUp, TrendingDown,
  Link2, Monitor, Shield, Timer, ClipboardList,
  Sparkles, BarChart2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  cyan:"#00AECF",
  bg:"#F4F6FA",      border:"#E5E6EB",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const USER = { name:"超级管理员", id:"SUPER_ADMIN" };
const TODAY = "2026-07-07";

const BANNER_STATS = [
  { value:"236", unit:"次",   label:"今日执行",    color:"#4D9EFF" },
  { value:"93.6", unit:"%",   label:"通过率",      color:"#00CC7A", up:true },
  { value:"2",   unit:"个",   label:"任务进行中",  color:"#FF9D3D" },
  { value:"8",   unit:"P0×2", label:"待处理缺陷",  color:"#FF6B6B" },
  { value:"28",  unit:"条",   label:"AI 待审用例", color:"#C57BFF" },
];

const PLANS = [
  { id:"P1", no:"TP-001", name:"v2.4.0 全量回归测试",    version:"v2.4.0",
    total:80,  passed:58, failed:4,  blocked:2, deadline:"今日 18:00", urgent:true,  pending:false, owner:"李明" },
  { id:"P2", no:"TP-005", name:"风控规则引擎专项测试",   version:null,
    total:28,  passed:15, failed:3,  blocked:1, deadline:"07/09",      urgent:false, pending:false, owner:"陈伟" },
  { id:"P3", no:"TP-004", name:"v2.3.5 发布验证",        version:"v2.3.5",
    total:20,  passed:0,  failed:0,  blocked:0, deadline:"07/08",      urgent:false, pending:true,  owner:"张程远" },
];

const TODOS = [
  { id:"t1", type:"bug"  as const, pri:"P0", title:"密码找回验证码有效期判断错误", meta:"BUG-142 · 已超 18 小时", age:"18h", urgent:true, action:"立即处理", nav:"bugs" },
  { id:"t2", type:"plan" as const, pri:null,  title:"v2.3.5 发布验证 — 确认开始",  meta:"TP-004 · 计划明日发布",  age:"2h",  urgent:false,action:"开始计划", nav:"testmgmt" },
  { id:"t3", type:"ai"   as const, pri:null,  title:"28 条 AI 生成用例待审核",      meta:"风控规则引擎专项",        age:"昨天",urgent:false,action:"去评审",   nav:"cases-ai-gen" },
  { id:"t4", type:"bug"  as const, pri:"P1",  title:"商品超卖库存扣减并发问题",     meta:"BUG-143 · 等待修复方案", age:"1天", urgent:false,action:"查看",     nav:"bugs" },
  { id:"t5", type:"gate" as const, pri:null,  title:"v2.4.0 质量准出签字确认",      meta:"TP-001 · 全部指标达标", age:"今天",urgent:false,action:"确认",     nav:"testmgmt" },
];

const TODO_CFG = {
  bug:  { icon:Bug,          color:T.danger,  bg:"#FFECEC" },
  plan: { icon:FlaskConical, color:"#0D7A5F", bg:"#E3FFF5" },
  ai:   { icon:Sparkles,     color:T.purple,  bg:"#F3EEFF" },
  gate: { icon:CheckCircle,  color:T.success, bg:"#E6FFE8" },
};

const TREND = [
  { d:"07/01", v:88 },{ d:"07/02", v:91 },{ d:"07/03", v:85 },
  { d:"07/04", v:94 },{ d:"07/05", v:90 },{ d:"07/06", v:96 },
  { d:"07/07", v:93 },
];

const MODULE_HEALTH = [
  { name:"订单中心", rate:97, color:"#165DFF" },
  { name:"用户中心", rate:91, color:"#00CC7A" },
  { name:"获客中心", rate:100,color:"#0FC6C2" },
  { name:"风控中心", rate:68, color:"#FF9D3D" },
];

const ACTIVITY = [
  { actor:"陈伟",  action:"标记用例阻塞",  detail:"TC-006 订单批量取消操作",      time:"10:40", dot:"#FF9D3D" },
  { actor:"王芳",  action:"新建缺陷",      detail:"BUG-143 商品超卖并发问题",     time:"09:55", dot:T.danger  },
  { actor:"系统",  action:"定时任务触发",  detail:"v2.4.0 全量回归 · 自动启动",  time:"09:00", dot:T.t4      },
  { actor:"李明",  action:"标记用例通过",  detail:"TC-001 用户登录核心流程",      time:"08:30", dot:T.success },
  { actor:"张程远",action:"创建测试计划",  detail:"TP-004 v2.3.5 发布验证",       time:"08:10", dot:T.primary },
  { actor:"系统",  action:"夜间任务完成",  detail:"订单接口回归 · 92通过 6失败",  time:"昨天",  dot:T.t4      },
];

const NAV_MODULES = [
  { key:"cases-list",  label:"用例中心",   icon:FileText,     color:T.success,  bg:"#E6FFF0" },
  { key:"api",         label:"接口自动化", icon:Link2,        color:T.warning,  bg:"#FFF3E8" },
  { key:"testmgmt",    label:"测试管理",   icon:FlaskConical, color:"#0EA5E9",  bg:"#E0F5FE" },
  { key:"bugs",        label:"缺陷管理",   icon:Bug,          color:T.danger,   bg:"#FFECEC" },
  { key:"webui",       label:"Web UI",     icon:Monitor,      color:T.cyan,     bg:"#E5F8FA" },
  { key:"tasks",       label:"任务中心",   icon:Timer,        color:"#F59E0B",  bg:"#FFFBEB" },
  { key:"reports",     label:"报告中心",   icon:ClipboardList,color:T.purple,   bg:"#F3EEFF" },
  { key:"settings",    label:"系统设置",   icon:Shield,       color:T.t3,       bg:"#F4F6FA" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Card({ children, style }:{ children:React.ReactNode; style?:React.CSSProperties }) {
  return (
    <div style={{
      background:"#fff", borderRadius:12, border:`1px solid ${T.border}`,
      boxShadow:"0 1px 4px rgba(0,0,0,0.04)", overflow:"hidden", ...style,
    }}>
      {children}
    </div>
  );
}

function CardHeader({ title, sub, action, onAction }:{
  title:string; sub?:string; action?:string; onAction?:()=>void;
}) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"16px 20px 0" }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
        <span style={{ fontSize:13, fontWeight:700, color:T.t1 }}>{title}</span>
        {sub && <span style={{ fontSize:11, color:T.t4 }}>{sub}</span>}
      </div>
      {action && (
        <button onClick={onAction} style={{
          fontSize:11, color:T.primary, background:"none", border:"none",
          cursor:"pointer", display:"flex", alignItems:"center", gap:2, padding:0,
        }}
        onMouseEnter={e=>e.currentTarget.style.opacity="0.7"}
        onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          {action}<ChevronRight size={10}/>
        </button>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function OverviewModule({ onNavigate }:{ onNavigate:(k:string)=>void }) {
  const [actTab, setActTab] = useState<"activity"|"schedule">("activity");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:T.bg }}>

      {/* ── 深色 Banner ─────────────────────────────────────────────── */}
      <div style={{ flexShrink:0, padding:"16px 24px 0" }}>
        <div style={{
          borderRadius:16,
          background:"linear-gradient(135deg, #1D2129 0%, #2D3748 100%)",
          padding:"18px 24px",
          display:"flex", alignItems:"center", gap:24,
          position:"relative", overflow:"hidden",
        }}>
          {/* 装饰光斑 */}
          <div style={{ position:"absolute", top:-40, right:220, width:180, height:180,
            borderRadius:"50%", background:"rgba(22,93,255,0.12)", pointerEvents:"none" }}/>
          <div style={{ position:"absolute", bottom:-60, right:80, width:200, height:200,
            borderRadius:"50%", background:"rgba(120,22,255,0.08)", pointerEvents:"none" }}/>

          {/* 问候语 */}
          <div style={{ flexShrink:0 }}>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", marginBottom:4,
              letterSpacing:0.5 }}>
              工作台 · {USER.id} · {TODAY}
            </div>
            <div style={{ fontSize:18, fontWeight:700, color:"#fff", letterSpacing:-0.3,
              whiteSpace:"nowrap" }}>
              {greeting}，{USER.name}
            </div>
          </div>

          {/* 分割线 */}
          <div style={{ width:1, height:40, background:"rgba(255,255,255,0.12)", flexShrink:0 }}/>

          {/* 指标 */}
          <div style={{ display:"flex", gap:0, flex:1 }}>
            {BANNER_STATS.map((s,i)=>(
              <React.Fragment key={i}>
                {i>0 && <div style={{ width:1, height:32, background:"rgba(255,255,255,0.1)",
                  alignSelf:"center", flexShrink:0, margin:"0 20px" }}/>}
                <div style={{ display:"flex", alignItems:"baseline", gap:4, whiteSpace:"nowrap" }}>
                  <span style={{ fontSize:22, fontWeight:800, color:s.color,
                    fontVariantNumeric:"tabular-nums", lineHeight:1 }}>{s.value}</span>
                  <span style={{ fontSize:11, color:s.color, opacity:0.8 }}>{s.unit}</span>
                  {s.up && <TrendingUp size={11} style={{ color:s.color, opacity:0.8 }}/>}
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.45)", marginLeft:2 }}>{s.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* 快捷操作 */}
          <div style={{ display:"flex", gap:8, flexShrink:0 }}>
            {[
              { label:"执行任务", icon:Play,     nav:"testmgmt",    primary:true  },
              { label:"新建用例", icon:FileText,  nav:"cases-list",  primary:false },
              { label:"AI 生成",  icon:Sparkles,  nav:"cases-ai-gen",primary:false },
              { label:"查看报告", icon:BarChart2, nav:"reports",     primary:false },
            ].map(a=>(
              <button key={a.label} onClick={()=>onNavigate(a.nav)} style={{
                height:30, padding:"0 12px", borderRadius:7, fontSize:11, fontWeight:500,
                border: a.primary ? "none" : "1px solid rgba(255,255,255,0.18)",
                background: a.primary ? T.primary : "rgba(255,255,255,0.08)",
                color:"#fff", cursor:"pointer",
                display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap",
              }}
              onMouseEnter={e=>{ e.currentTarget.style.background = a.primary ? "#0E4FE8" : "rgba(255,255,255,0.15)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.background = a.primary ? T.primary : "rgba(255,255,255,0.08)"; }}>
                <a.icon size={11}/>{a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 主体（不整体滚动，内部各列各自处理） ──────────────────── */}
      <div style={{ flex:1, minHeight:0, padding:"14px 24px 16px", display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ display:"flex", gap:14, alignItems:"stretch", flex:1, minHeight:0 }}>

          {/* ── 左列（内部滚动） ── */}
          <div style={{ flex:"0 0 380px", display:"flex", flexDirection:"column", gap:14, overflowY:"auto" }}>

            {/* 测试计划 */}
            <Card>
              <CardHeader title="进行中的测试计划" sub={`${PLANS.length} 个`}
                action="全部计划" onAction={()=>onNavigate("testmgmt")}/>
              <div style={{ padding:"12px 0 0" }}>
                {PLANS.map((plan,i)=>{
                  const done = plan.passed + plan.failed + plan.blocked;
                  const rate = done > 0 ? Math.round(plan.passed / done * 100) : 0;
                  const accent = plan.urgent ? T.danger : plan.pending ? T.t4 : T.success;
                  return (
                    <div key={plan.id} style={{
                      padding:"12px 20px", borderTop: i>0 ? `1px solid ${T.border}` : "none",
                      borderLeft:`3px solid ${accent}`, cursor:"pointer",
                    }}
                    onMouseEnter={e=>{ e.currentTarget.style.background="#F7F8FB"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5 }}>
                            {plan.urgent && <span style={{ fontSize:9, padding:"1px 5px", borderRadius:3,
                              background:`${T.danger}15`, color:T.danger, fontWeight:700 }}>截止今日</span>}
                            {plan.pending && <span style={{ fontSize:9, padding:"1px 5px", borderRadius:3,
                              background:"#F2F3F5", color:T.t3, fontWeight:600 }}>待开始</span>}
                            {plan.version && <span style={{ fontSize:10, padding:"1px 5px", borderRadius:3,
                              background:"#E8FFF5", color:"#009960", fontWeight:500 }}>{plan.version}</span>}
                          </div>
                          <div style={{ fontSize:13, fontWeight:600, color:T.t1,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{plan.name}</div>
                          <div style={{ fontSize:11, color:T.t4, marginTop:2 }}>
                            {plan.owner} · {plan.no} · 截止 {plan.deadline}
                          </div>
                        </div>
                        {!plan.pending && (
                          <div style={{ textAlign:"right", flexShrink:0 }}>
                            <div style={{ fontSize:20, fontWeight:800, lineHeight:1,
                              color: rate >= 85 ? T.success : T.warning }}>{rate}%</div>
                            <div style={{ fontSize:10, color:T.t4, marginTop:2 }}>通过率</div>
                          </div>
                        )}
                      </div>
                      {!plan.pending ? (
                        <div style={{ marginTop:10 }}>
                          <div style={{ height:5, borderRadius:3, background:"#F0F2F5", overflow:"hidden",
                            position:"relative", marginBottom:7 }}>
                            <div style={{ position:"absolute", left:0, top:0, height:"100%",
                              width:`${Math.round(plan.passed/plan.total*100)}%`,
                              background:T.success, borderRadius:3 }}/>
                            <div style={{ position:"absolute",
                              left:`${Math.round(plan.passed/plan.total*100)}%`, top:0, height:"100%",
                              width:`${Math.round(plan.failed/plan.total*100)}%`, background:T.danger }}/>
                            <div style={{ position:"absolute",
                              left:`${Math.round((plan.passed+plan.failed)/plan.total*100)}%`, top:0, height:"100%",
                              width:`${Math.round(plan.blocked/plan.total*100)}%`, background:T.warning }}/>
                          </div>
                          <div style={{ display:"flex", gap:12 }}>
                            {[["通过",plan.passed,T.success],["失败",plan.failed,T.danger],
                              ["阻塞",plan.blocked,T.warning],["未执行",plan.total-done,T.t4]].map(([l,v,c])=>(
                              <div key={l as string} style={{ display:"flex", alignItems:"center", gap:3 }}>
                                <div style={{ width:5, height:5, borderRadius:"50%", background:c as string }}/>
                                <span style={{ fontSize:10, color:T.t3 }}>{l}</span>
                                <span style={{ fontSize:11, fontWeight:700, color:c as string }}>{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ flex:1, height:5, borderRadius:3, background:"#F0F2F5" }}/>
                          <span style={{ fontSize:10, color:T.t4 }}>{plan.total} 条用例</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ padding:"10px 20px 14px", borderTop:`1px solid ${T.border}`, background:"#FAFBFE" }}>
                  <button onClick={()=>onNavigate("testmgmt")} style={{
                    width:"100%", height:30, borderRadius:7, fontSize:12, fontWeight:500,
                    background:"transparent", color:T.primary,
                    border:`1px dashed ${T.primary}60`, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:4,
                  }}
                  onMouseEnter={e=>{ e.currentTarget.style.background=`${T.primary}08`; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}>
                    <Play size={10}/> 新建测试计划
                  </button>
                </div>
              </div>
            </Card>

            {/* 快速导航 */}
            <Card style={{ padding:"16px 20px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:T.t1, marginBottom:12 }}>快速导航</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                {NAV_MODULES.map(m=>(
                  <button key={m.key} onClick={()=>onNavigate(m.key)} style={{
                    padding:"10px 6px", borderRadius:9, border:`1px solid ${T.border}`,
                    background:"#FAFBFE", cursor:"pointer",
                    display:"flex", flexDirection:"column", alignItems:"center", gap:6,
                  }}
                  onMouseEnter={e=>{ e.currentTarget.style.background=m.bg; e.currentTarget.style.borderColor=`${m.color}40`; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background="#FAFBFE"; e.currentTarget.style.borderColor=T.border; }}>
                    <div style={{ width:28, height:28, borderRadius:7, background:m.bg,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <m.icon size={13} style={{ color:m.color }}/>
                    </div>
                    <span style={{ fontSize:11, color:T.t2, whiteSpace:"nowrap" }}>{m.label}</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* ── 中列：待办（撑满高度） ── */}
          <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column" }}>
            <Card style={{ flex:1, display:"flex", flexDirection:"column" }}>
              {/* 卡片头 */}
              <div style={{ flexShrink:0, padding:"16px 20px 12px",
                borderBottom:`1px solid ${T.border}`,
                display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.t1 }}>今日待办</div>
                  <div style={{ fontSize:11, color:T.t4, marginTop:3 }}>
                    {TODOS.length} 项 · 按优先级排序
                  </div>
                </div>
                {TODOS.some(t=>t.urgent) && (
                  <div style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px",
                    borderRadius:16, background:`${T.danger}10`, border:`1px solid ${T.danger}30` }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:T.danger }}/>
                    <span style={{ fontSize:11, color:T.danger, fontWeight:600 }}>P0 待处理</span>
                  </div>
                )}
              </div>
              {/* 列表（可滚动） */}
              <div style={{ flex:1, minHeight:0, overflowY:"auto", padding:"10px 16px 14px" }}>
                {TODOS.map(task=>{
                  const cfg = TODO_CFG[task.type];
                  return (
                    <div key={task.id} style={{
                      display:"flex", alignItems:"center", gap:12,
                      padding:"11px 14px", marginBottom:6, borderRadius:10,
                      border:`1.5px solid ${task.urgent ? T.danger : T.border}`,
                      background: task.urgent ? "#FFF6F6" : "#FAFBFE",
                      cursor:"default",
                    }}
                    onMouseEnter={e=>{ e.currentTarget.style.background = task.urgent ? "#FFF0F0" : "#F0F2F7"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background = task.urgent ? "#FFF6F6" : "#FAFBFE"; }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:cfg.bg,
                        display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <cfg.icon size={14} style={{ color:cfg.color }}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                          {task.pri && (
                            <span style={{
                              fontSize:10, fontWeight:700, padding:"1px 5px", borderRadius:3,
                              background: task.pri==="P0" ? `${T.danger}15` : `${T.warning}15`,
                              color: task.pri==="P0" ? T.danger : T.warning,
                            }}>{task.pri}</span>
                          )}
                          <span style={{ fontSize:13, fontWeight:500, color:T.t1,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {task.title}
                          </span>
                        </div>
                        <div style={{ fontSize:11, color:T.t3 }}>{task.meta}</div>
                      </div>
                      <div style={{ flexShrink:0, display:"flex", flexDirection:"column",
                        alignItems:"flex-end", gap:4 }}>
                        <span style={{ fontSize:10, color:T.t4 }}>{task.age}</span>
                        <button onClick={()=>onNavigate(task.nav)} style={{
                          height:26, padding:"0 10px", borderRadius:6, fontSize:11, fontWeight:600,
                          background: task.urgent ? T.danger : cfg.bg,
                          color: task.urgent ? "#fff" : cfg.color,
                          border:`1px solid ${task.urgent ? T.danger : `${cfg.color}35`}`,
                          cursor:"pointer", whiteSpace:"nowrap",
                        }}
                        onMouseEnter={e=>e.currentTarget.style.opacity="0.85"}
                        onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                          {task.action}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* ── 右列（内部滚动） ── */}
          <div style={{ flex:"0 0 272px", display:"flex", flexDirection:"column", gap:14, overflowY:"auto" }}>

            {/* 质量趋势 */}
            <Card style={{ padding:"16px 20px 18px" }}>
              <div style={{ display:"flex", alignItems:"flex-start",
                justifyContent:"space-between", marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.t1 }}>质量趋势</div>
                  <div style={{ fontSize:11, color:T.t4, marginTop:3 }}>近 7 天通过率</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:24, fontWeight:800, color:T.success, lineHeight:1 }}>93.6%</div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end",
                    gap:3, marginTop:3 }}>
                    <TrendingUp size={10} style={{ color:T.success }}/>
                    <span style={{ fontSize:10, color:T.success, fontWeight:600 }}>↑1.4%</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={TREND} margin={{ top:0, right:0, left:0, bottom:0 }}>
                  <XAxis dataKey="d" tick={{ fontSize:9, fill:T.t4 }} axisLine={false} tickLine={false}/>
                  <YAxis domain={[70,100]} hide/>
                  <Tooltip contentStyle={{ borderRadius:8, border:`1px solid ${T.border}`,
                    fontSize:11, padding:"4px 10px" }}
                    formatter={(v:number)=>[`${v}%`,"通过率"]}/>
                  <Area type="monotone" dataKey="v" stroke={T.success} strokeWidth={2}
                    fill={`${T.success}18`} dot={false} activeDot={{ r:3, fill:T.success }}/>
                </AreaChart>
              </ResponsiveContainer>

              <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:8 }}>
                {MODULE_HEALTH.map(m=>(
                  <div key={m.name}>
                    <div style={{ display:"flex", alignItems:"center",
                      justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:11, color:T.t2 }}>{m.name}</span>
                      <span style={{ fontSize:11, fontWeight:700, color:m.color,
                        minWidth:30, textAlign:"right" }}>{m.rate}%</span>
                    </div>
                    <div style={{ height:4, borderRadius:2, background:"#F0F2F5", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${m.rate}%`,
                        background:m.color, borderRadius:2 }}/>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* 团队动态 */}
            <Card style={{ overflow:"hidden" }}>
              <div style={{ display:"flex", borderBottom:`1px solid ${T.border}` }}>
                {(["activity","schedule"] as const).map(t=>(
                  <button key={t} onClick={()=>setActTab(t)} style={{
                    flex:1, height:38, fontSize:12,
                    fontWeight: actTab===t ? 600 : 400,
                    border:"none",
                    borderBottom:`2px solid ${actTab===t ? T.primary : "transparent"}`,
                    background:"transparent",
                    color: actTab===t ? T.primary : T.t3,
                    cursor:"pointer",
                  }}>
                    {t==="activity" ? "团队动态" : "日程"}
                  </button>
                ))}
              </div>
              <div style={{ padding:"12px 16px 14px" }}>
                {actTab==="activity" ? (
                  <div>
                    {ACTIVITY.map((item,i)=>(
                      <div key={i} style={{ display:"flex", gap:10,
                        paddingBottom: i<ACTIVITY.length-1 ? 13 : 0,
                        margin:"0 -16px", padding:`0 16px ${i<ACTIVITY.length-1?"13px":"0"} 16px`,
                        borderRadius:7, cursor:"default",
                      }}
                      onMouseEnter={e=>{ e.currentTarget.style.background="#F7F8FB"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}>
                        <div style={{ display:"flex", flexDirection:"column",
                          alignItems:"center", flexShrink:0 }}>
                          <div style={{ width:26, height:26, borderRadius:"50%",
                            background:`${item.dot}15`, display:"flex", alignItems:"center",
                            justifyContent:"center", fontSize:11, fontWeight:700, color:item.dot }}>
                            {item.actor.slice(0,1)}
                          </div>
                          {i<ACTIVITY.length-1 && (
                            <div style={{ width:1, flex:1, background:T.border,
                              minHeight:6, marginTop:3 }}/>
                          )}
                        </div>
                        <div style={{ flex:1, paddingTop:3 }}>
                          <div style={{ display:"flex", alignItems:"baseline",
                            gap:4, flexWrap:"wrap" }}>
                            <span style={{ fontSize:12, fontWeight:600, color:T.t1 }}>{item.actor}</span>
                            <span style={{ fontSize:11, color:T.t2 }}>{item.action}</span>
                            <span style={{ fontSize:10, color:T.t4, marginLeft:"auto",
                              whiteSpace:"nowrap" }}>{item.time}</span>
                          </div>
                          <div style={{ fontSize:11, color:T.t3, marginTop:1 }}>{item.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {[
                      { name:"v2.4.0 回归截止",    when:"今天", time:"18:00", urgent:true  },
                      { name:"每日报告推送",        when:"今天", time:"18:30", urgent:false },
                      { name:"订单接口全量回归",    when:"明天", time:"02:00", urgent:false },
                      { name:"v2.3.5 发布验证会",  when:"周四", time:"10:00", urgent:false },
                    ].map((s,i)=>(
                      <div key={i} style={{
                        display:"flex", alignItems:"center", gap:10, padding:"8px 10px",
                        borderRadius:8, background: s.urgent ? "#FFF6F6" : "#F9FAFC",
                        border:`1px solid ${s.urgent ? `${T.danger}35` : T.border}`,
                        cursor:"default",
                      }}
                      onMouseEnter={e=>{ e.currentTarget.style.background = s.urgent ? "#FFF0F0" : "#F0F2F7"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background = s.urgent ? "#FFF6F6" : "#F9FAFC"; }}>
                        <div style={{ flexShrink:0, textAlign:"center", lineHeight:1.3 }}>
                          <div style={{ fontSize:10, fontWeight:700,
                            color: s.urgent ? T.danger : T.primary }}>{s.when}</div>
                          <div style={{ fontSize:10,
                            color: s.urgent ? T.danger : T.t3, marginTop:1 }}>{s.time}</div>
                        </div>
                        <div style={{ width:1, height:24,
                          background: s.urgent ? `${T.danger}30` : T.border, flexShrink:0 }}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:500, color:T.t1,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {s.name}
                          </div>
                          {s.urgent && (
                            <div style={{ fontSize:10, color:T.danger, marginTop:1 }}>截止时间临近</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
