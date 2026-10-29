import React, { useState } from "react";
import {
  Bug, CheckCircle, AlertTriangle, Sparkles,
  ChevronRight, Play, FileText, Activity, CalendarClock,
  BarChart2, FlaskConical, TrendingUp,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ─── Palette ──────────────────────────────────────────────────────────────────
const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  teal:"#0D7A5F",
  cyan:"#0FC6C2",    bg:"#F0F3F8",      border:"#E5E6EB",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const USER = { name:"李明", role:"测试组长", initial:"李" };
const DATE_STR = "2026年07月07日（周二）";

const KPIS = [
  { id:"exec",   label:"今日执行", value:236,    unit:"次", delta:+12,  color:"#3DD5C8", sub:null         },
  { id:"pass",   label:"通过率",   value:"93.6", unit:"%",  delta:+1.4, color:"#3DCC6E", sub:null         },
  { id:"running",label:"任务进行中",value:2,     unit:"个", delta:null, color:"#FFAA3C", sub:null         },
  { id:"mybugs", label:"待处理缺陷",value:5,     unit:"个", delta:null, color:"#FF6B6B", sub:"P0×1 P1×2" },
  { id:"ai",     label:"AI用例待审",value:28,    unit:"条", delta:null, color:"#BB85FF", sub:null         },
];

const QUICK_ACTIONS = [
  { label:"执行任务", icon:Play,       nav:"cases"        },
  { label:"新建用例", icon:FileText,   nav:"cases-list"   },
  { label:"AI 生成",  icon:Sparkles,   nav:"cases-ai-gen" },
  { label:"查看报告", icon:TrendingUp, nav:"reports"      },
];

interface ActivePlan {
  id:string; no:string; name:string; version:string|null;
  total:number; passed:number; failed:number; blocked:number;
  deadline:string|null; isUrgent:boolean; isPending:boolean; owner:string;
}
const ACTIVE_PLANS:ActivePlan[] = [
  { id:"P1",no:"TP-001",name:"v2.4.0 全量回归测试",version:"v2.4.0",
    total:80,passed:58,failed:4,blocked:2,deadline:"今日 18:00",isUrgent:true,isPending:false,owner:"李明" },
  { id:"P5",no:"TP-005",name:"风控规则引擎专项测试",version:null,
    total:28,passed:15,failed:3,blocked:1,deadline:"07/09",isUrgent:false,isPending:false,owner:"陈伟" },
  { id:"P4",no:"TP-004",name:"v2.3.5 发布验证",version:"v2.3.5",
    total:20,passed:0,failed:0,blocked:0,deadline:"07/08",isUrgent:false,isPending:true,owner:"张程远" },
];

interface MyTask {
  id:string; type:"bug"|"plan"|"ai"|"gate";
  priority:"P0"|"P1"|null; title:string; meta:string; age:string;
  urgent:boolean; actionLabel:string; nav:string;
}
const MY_TASKS:MyTask[] = [
  { id:"m1",type:"bug",priority:"P0",title:"密码找回验证码有效期判断错误",
    meta:"BUG-142 · 指派给我 · 已超 18 小时",age:"18h",urgent:true,actionLabel:"立即处理",nav:"bugs" },
  { id:"m2",type:"plan",priority:null,title:"v2.3.5 发布验证 — 确认开始",
    meta:"TP-004 · 计划明日发布，需今日启动",age:"2h",urgent:false,actionLabel:"开始计划",nav:"testmgmt" },
  { id:"m3",type:"ai",priority:null,title:"28 条 AI 生成用例待审核",
    meta:"风控规则引擎专项 · 昨日批量生成",age:"昨天",urgent:false,actionLabel:"去评审",nav:"cases-ai-gen" },
  { id:"m4",type:"bug",priority:"P1",title:"商品超卖库存扣减并发问题",
    meta:"BUG-143 · 已复现，等待修复方案",age:"1 天",urgent:false,actionLabel:"查看",nav:"bugs" },
  { id:"m5",type:"gate",priority:null,title:"v2.4.0 质量准出签字确认",
    meta:"TP-001 · 全部指标达标，负责人需签字",age:"今天",urgent:false,actionLabel:"确认",nav:"testmgmt" },
];

interface ActivityItem {
  id:string; actor:string; action:string; detail:string;
  time:string; type:"mark"|"bug"|"system"|"create"|"pass";
}
const ACTIVITY:ActivityItem[] = [
  { id:"ac1",actor:"陈伟",action:"标记用例阻塞",detail:"TC-006 订单批量取消操作",time:"10:40",type:"mark" },
  { id:"ac2",actor:"王芳",action:"新建缺陷",detail:"BUG-143 商品超卖并发问题",time:"09:55",type:"bug" },
  { id:"ac3",actor:"系统",action:"定时任务触发",detail:"v2.4.0 全量回归 · 自动启动",time:"09:00",type:"system" },
  { id:"ac4",actor:"李明",action:"标记用例通过",detail:"TC-001 用户登录核心流程",time:"08:30",type:"pass" },
  { id:"ac5",actor:"张程远",action:"创建测试计划",detail:"TP-004 v2.3.5 发布验证",time:"08:10",type:"create" },
  { id:"ac6",actor:"系统",action:"夜间任务完成",detail:"订单接口回归 · 92通过 6失败",time:"昨天 02:35",type:"system" },
];

const SCHEDULE = [
  { name:"v2.4.0 回归截止",   when:"今天", time:"18:00", urgent:true  },
  { name:"每日报告推送",       when:"今天", time:"18:30", urgent:false },
  { name:"订单接口全量回归",   when:"明天", time:"02:00", urgent:false },
  { name:"v2.3.5 发布验证会", when:"周四", time:"10:00", urgent:false },
  { name:"月度质量复盘",       when:"07/14",time:"14:00", urgent:false },
];

const TREND_7D = [
  { date:"07/01",rate:88 },{ date:"07/02",rate:91 },{ date:"07/03",rate:85 },
  { date:"07/04",rate:94 },{ date:"07/05",rate:90 },{ date:"07/06",rate:96 },
  { date:"07/07",rate:93 },
];

const MODULE_HEALTH = [
  { name:"订单中心", pass:97, total:52, color:"#165DFF" },
  { name:"用户中心", pass:91, total:34, color:"#00CC7A" },
  { name:"获客中心", pass:100,total:29, color:"#0FC6C2" },
  { name:"风控中心", pass:68, total:18, color:"#FF9D3D" },
];

const MODULES = [
  { key:"cases-list",label:"用例管理",   icon:FileText,     color:"#165DFF", bg:"#EBF3FF" },
  { key:"api",       label:"接口自动化", icon:Activity,     color:"#FF7D00", bg:"#FFF3E8" },
  { key:"testmgmt",  label:"测试管理",   icon:FlaskConical, color:"#0EA5E9", bg:"#E0F5FE" },
  { key:"bugs",      label:"缺陷管理",   icon:Bug,          color:"#F53F3F", bg:"#FFECEC" },
  { key:"reports",   label:"报表分析",   icon:BarChart2,    color:"#7816FF", bg:"#F3EEFF" },
  { key:"tasks",     label:"任务调度",   icon:CalendarClock,color:"#0FC6C2", bg:"#E0FFFE" },
];

const TASK_CFG = {
  bug:  { icon:Bug,          color:T.danger,  bg:"#FFECEC" },
  plan: { icon:FlaskConical, color:T.teal,    bg:"#E3FFF5" },
  ai:   { icon:Sparkles,     color:T.purple,  bg:"#F3EEFF" },
  gate: { icon:CheckCircle,  color:T.success, bg:"#E6FFE8" },
};
const ACT_CFG = {
  mark:   { dot:"#FF9D3D" },
  bug:    { dot:"#F53F3F" },
  system: { dot:"#C9CDD4" },
  create: { dot:"#165DFF" },
  pass:   { dot:"#00B42A" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionHead({ title, sub, action, onAction }:{ title:string; sub?:string; action?:string; onAction?:()=>void }) {
  return (
    <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
        <span style={{ fontSize:14, fontWeight:700, color:T.t1 }}>{title}</span>
        {sub && <span style={{ fontSize:11, color:T.t4 }}>{sub}</span>}
      </div>
      {action && (
        <button onClick={onAction} style={{ fontSize:11, color:T.primary, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:2, padding:0, opacity:1, transition:"opacity 0.15s" }}
          onMouseEnter={e=>e.currentTarget.style.opacity="0.65"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
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
  const hasUrgent = MY_TASKS.some(t => t.urgent);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:T.bg }}>

      {/* ══ 顶部横幅条 ════════════════════════════════════════════════════ */}
      <div style={{ flexShrink:0, background:"#0D1523", padding:"9px 24px 11px" }}>

        {/* 第一行：面包屑 + 快捷按钮 */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.28)", letterSpacing:0.2 }}>
            工作台 · {USER.name} · {DATE_STR}
          </span>
          <div style={{ display:"flex", gap:7 }}>
            {QUICK_ACTIONS.map(a => (
              <button key={a.label} onClick={() => onNavigate(a.nav)} style={{
                height:25, padding:"0 9px", borderRadius:5, fontSize:11, fontWeight:500,
                background:"rgba(255,255,255,0.07)", color:"rgba(255,255,255,0.65)",
                border:"1px solid rgba(255,255,255,0.11)", cursor:"pointer",
                display:"flex", alignItems:"center", gap:4, transition:"background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.14)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}>
                <a.icon size={10} />
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* 第二行：问候 + KPI 指标 */}
        <div style={{ display:"flex", alignItems:"center" }}>

          {/* 问候区 */}
          <div style={{ flexShrink:0, minWidth:230 }}>
            <span style={{ fontSize:18, fontWeight:700, color:"#fff", letterSpacing:-0.3 }}>
              {greeting}，{USER.name}
            </span>
            <span style={{
              fontSize:10, fontWeight:500, color:"rgba(255,255,255,0.38)",
              marginLeft:8, letterSpacing:0.8, textTransform:"uppercase",
            }}>{USER.role}</span>
          </div>

          {/* 分隔线 */}
          <div style={{ width:1, height:28, background:"rgba(255,255,255,0.1)", marginRight:22, flexShrink:0 }} />

          {/* KPI 指标（内联） */}
          <div style={{ display:"flex", alignItems:"center", flex:1 }}>
            {KPIS.map((kpi, i) => (
              <React.Fragment key={kpi.id}>
                {i > 0 && (
                  <div style={{ width:1, height:20, background:"rgba(255,255,255,0.09)", margin:"0 18px", flexShrink:0 }} />
                )}
                <div style={{ display:"flex", alignItems:"baseline", gap:0, flexShrink:0 }}>
                  <span style={{
                    fontSize:23, fontWeight:800, color:kpi.color,
                    lineHeight:1, fontVariantNumeric:"tabular-nums", letterSpacing:-0.5,
                  }}>{kpi.value}</span>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginLeft:3 }}>{kpi.unit}</span>
                  {kpi.delta !== null && (
                    <span style={{ fontSize:11, color:kpi.color, marginLeft:2, opacity:0.8 }}>↗</span>
                  )}
                  {kpi.sub && (
                    <span style={{ fontSize:10, color:kpi.color, marginLeft:4, opacity:0.75, fontWeight:600 }}>{kpi.sub}</span>
                  )}
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.38)", marginLeft:5, whiteSpace:"nowrap" }}>
                    {kpi.label}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* 紧急提示（仅有 urgent 时显示） */}
          {hasUrgent && (
            <div style={{
              flexShrink:0, marginLeft:16,
              display:"flex", alignItems:"center", gap:5,
              background:"rgba(245,63,63,0.14)", border:"1px solid rgba(245,63,63,0.28)",
              borderRadius:5, padding:"3px 10px",
            }}>
              <AlertTriangle size={11} style={{ color:"#FF6B6B" }} />
              <span style={{ fontSize:11, color:"#FF8080", whiteSpace:"nowrap" }}>有 P0 缺陷待处理</span>
            </div>
          )}
        </div>
      </div>

      {/* ══ 滚动主体 ════════════════════════════════════════════════════════ */}
      <div style={{ flex:1, minHeight:0, overflowY:"auto", padding:"16px 20px 24px" }}>
        <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>

          {/* ── 左列：进行中的计划 + 快速入口 ──────────────────────────── */}
          <div style={{ flex:"0 0 400px", display:"flex", flexDirection:"column", gap:16 }}>

            {/* 进行中的测试计划 */}
            <div style={{
              background:"#fff", borderRadius:14, border:`1px solid ${T.border}`,
              overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
            }}>
              <div style={{ padding:"18px 20px 0" }}>
                <SectionHead title="进行中的测试计划" sub={`共 ${ACTIVE_PLANS.length} 个`} action="全部计划" onAction={() => onNavigate("testmgmt")} />
              </div>

              {ACTIVE_PLANS.map((plan, i) => {
                const execed = plan.passed + plan.failed + plan.blocked;
                const passRate = execed > 0 ? Math.round(plan.passed / execed * 100) : 0;
                const accentColor = plan.isUrgent ? T.danger : plan.isPending ? T.t4 : "#00CC7A";
                return (
                  <div key={plan.id} style={{
                    padding:"14px 20px",
                    borderTop: i > 0 ? `1px solid ${T.border}` : "none",
                    borderLeft:`4px solid ${accentColor}`,
                  }}>
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:9 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:5, flexWrap:"wrap" }}>
                          {plan.isUrgent && <span style={{ fontSize:9, padding:"2px 6px", borderRadius:4, background:`${T.danger}18`, color:T.danger, fontWeight:700 }}>截止今日</span>}
                          {plan.isPending && <span style={{ fontSize:9, padding:"2px 6px", borderRadius:4, background:"#F2F3F5", color:T.t3, fontWeight:600 }}>待开始</span>}
                          {plan.version && <span style={{ fontSize:10, padding:"2px 6px", borderRadius:4, background:"#E8FFF5", color:"#009960", fontWeight:500 }}>{plan.version}</span>}
                        </div>
                        <div style={{ fontSize:13, fontWeight:600, color:T.t1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{plan.name}</div>
                        <div style={{ fontSize:11, color:T.t3, marginTop:3 }}>负责人：{plan.owner} · {plan.no}</div>
                      </div>
                      {!plan.isPending && (
                        <div style={{ textAlign:"right", flexShrink:0, marginLeft:14 }}>
                          <div style={{ fontSize:22, fontWeight:800, color: passRate >= 85 ? "#00CC7A" : T.warning, lineHeight:1 }}>{passRate}%</div>
                          <div style={{ fontSize:10, color:T.t4, marginTop:2 }}>通过率</div>
                        </div>
                      )}
                    </div>

                    {!plan.isPending ? (
                      <>
                        <div style={{ height:6, borderRadius:3, background:"#F0F2F5", overflow:"hidden", position:"relative", marginBottom:8 }}>
                          <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${Math.round(plan.passed/plan.total*100)}%`, background:"#00CC7A", borderRadius:3 }} />
                          <div style={{ position:"absolute", left:`${Math.round(plan.passed/plan.total*100)}%`, top:0, height:"100%", width:`${Math.round(plan.failed/plan.total*100)}%`, background:T.danger }} />
                          <div style={{ position:"absolute", left:`${Math.round((plan.passed+plan.failed)/plan.total*100)}%`, top:0, height:"100%", width:`${Math.round(plan.blocked/plan.total*100)}%`, background:T.warning }} />
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                          {[
                            { label:"通过", value:plan.passed, color:"#00CC7A" },
                            { label:"失败", value:plan.failed, color:T.danger },
                            { label:"阻塞", value:plan.blocked, color:T.warning },
                            { label:"未执行", value:plan.total - execed, color:T.t4 },
                          ].map(s => (
                            <div key={s.label} style={{ display:"flex", alignItems:"center", gap:3 }}>
                              <div style={{ width:6, height:6, borderRadius:"50%", background:s.color, flexShrink:0 }} />
                              <span style={{ fontSize:10, color:T.t3 }}>{s.label}</span>
                              <span style={{ fontSize:11, fontWeight:700, color:s.color }}>{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ flex:1, height:6, borderRadius:3, background:"#F0F2F5" }} />
                        <span style={{ fontSize:10, color:T.t4 }}>{plan.total} 个用例待执行</span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div style={{ padding:"10px 20px", borderTop:`1px solid ${T.border}`, background:"#FAFBFE" }}>
                <button onClick={() => onNavigate("testmgmt")} style={{
                  width:"100%", height:32, borderRadius:8, fontSize:12, fontWeight:500,
                  background:"#E3FFF5", color:"#009960", border:"1px solid #9DEFCF",
                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                }}>
                  <Play size={11}/> 新建测试计划
                </button>
              </div>
            </div>

            {/* 快速入口 */}
            <div style={{
              background:"#fff", borderRadius:14, border:`1px solid ${T.border}`,
              padding:"18px 20px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
            }}>
              <SectionHead title="快速入口" />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                {MODULES.map(m => (
                  <button key={m.key} onClick={() => onNavigate(m.key)} style={{
                    padding:"13px 10px", borderRadius:10, border:`1px solid ${T.border}`,
                    background:"#FAFBFE", cursor:"pointer", display:"flex", flexDirection:"column",
                    alignItems:"flex-start", gap:7, transition:"all 0.12s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = m.bg; e.currentTarget.style.borderColor = `${m.color}50`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#FAFBFE"; e.currentTarget.style.borderColor = T.border; }}>
                    <div style={{ width:30, height:30, borderRadius:8, background:m.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <m.icon size={15} style={{ color:m.color }} />
                    </div>
                    <span style={{ fontSize:12, fontWeight:500, color:T.t1 }}>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── 中列：今天需要我做的 ──────────────────────────────────── */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              background:"#fff", borderRadius:14, border:`1px solid ${T.border}`,
              overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
            }}>
              {/* Header */}
              <div style={{ padding:"18px 20px 14px", borderBottom:`1px solid ${T.border}` }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:T.t1 }}>今天需要我做的</div>
                    <div style={{ fontSize:11, color:T.t4, marginTop:4 }}>按优先级排序 · {MY_TASKS.length} 项待处理</div>
                  </div>
                  {hasUrgent && (
                    <div style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:20, background:`${T.danger}12`, border:`1px solid ${T.danger}35` }}>
                      <div style={{ width:7, height:7, borderRadius:"50%", background:T.danger }} />
                      <span style={{ fontSize:11, color:T.danger, fontWeight:700 }}>P0 待处理</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Task list */}
              <div style={{ padding:"10px 16px 14px" }}>
                {MY_TASKS.map(task => {
                  const cfg = TASK_CFG[task.type];
                  return (
                    <div key={task.id} style={{
                      display:"flex", alignItems:"flex-start", gap:12,
                      padding:"13px 14px", marginBottom:6, borderRadius:10,
                      border:`1.5px solid ${task.urgent ? T.danger : T.border}`,
                      background: task.urgent ? "#FFF6F6" : "#FAFBFE",
                    }}>
                      <div style={{ width:34, height:34, borderRadius:9, background:cfg.bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <cfg.icon size={15} style={{ color:cfg.color }} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
                          {task.priority && (
                            <span style={{
                              fontSize:10, fontWeight:800, padding:"2px 6px", borderRadius:4,
                              background: task.priority === "P0" ? `${T.danger}18` : `${T.warning}18`,
                              color: task.priority === "P0" ? T.danger : T.warning,
                            }}>{task.priority}</span>
                          )}
                          <span style={{ fontSize:13, fontWeight:600, color:T.t1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.title}</span>
                        </div>
                        <div style={{ fontSize:11, color:T.t3 }}>{task.meta}</div>
                      </div>
                      <div style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5 }}>
                        <span style={{ fontSize:10, color:T.t4 }}>{task.age}</span>
                        <button onClick={() => onNavigate(task.nav)} style={{
                          height:27, padding:"0 11px", borderRadius:7, fontSize:11, fontWeight:600,
                          background: task.urgent ? T.danger : cfg.bg,
                          color: task.urgent ? "#fff" : cfg.color,
                          border: `1px solid ${task.urgent ? T.danger : `${cfg.color}40`}`,
                          cursor:"pointer", whiteSpace:"nowrap",
                        }}>
                          {task.actionLabel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── 右列：趋势 + 动态 ──────────────────────────────────────── */}
          <div style={{ flex:"0 0 288px", display:"flex", flexDirection:"column", gap:16 }}>

            {/* 质量趋势 */}
            <div style={{
              background:"#fff", borderRadius:14, border:`1px solid ${T.border}`,
              padding:"18px 20px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
            }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:T.t1 }}>质量趋势</div>
                  <div style={{ fontSize:11, color:T.t4, marginTop:3 }}>近 7 天通过率</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:26, fontWeight:800, color:"#00CC7A", lineHeight:1 }}>93.6%</div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:3, marginTop:3 }}>
                    <TrendingUp size={10} style={{ color:"#00B42A" }} />
                    <span style={{ fontSize:10, color:"#00B42A", fontWeight:600 }}>↑1.4%</span>
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={72}>
                <AreaChart data={TREND_7D} margin={{ top:0, right:0, left:0, bottom:0 }}>
                  <XAxis dataKey="date" tick={{ fontSize:9, fill:T.t4 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[70,100]} hide />
                  <Tooltip
                    contentStyle={{ borderRadius:8, border:`1px solid ${T.border}`, fontSize:11, padding:"4px 10px" }}
                    formatter={(v:number) => [`${v}%`, "通过率"]} />
                  <Area type="monotone" dataKey="rate" stroke="#00CC7A" strokeWidth={2}
                    fill="#00CC7A20" dot={false} activeDot={{ r:3, fill:"#00CC7A" }} />
                </AreaChart>
              </ResponsiveContainer>

              <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:9 }}>
                {MODULE_HEALTH.map(m => (
                  <div key={m.name}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                      <span style={{ fontSize:11, color:T.t2 }}>{m.name}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:10, color:T.t4 }}>{m.total}次</span>
                        <span style={{ fontSize:11, fontWeight:700, color:m.color, minWidth:32, textAlign:"right" }}>{m.pass}%</span>
                      </div>
                    </div>
                    <div style={{ height:5, borderRadius:3, background:"#F0F2F5", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${m.pass}%`, background:m.color, borderRadius:3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 团队动态 / 日程计划 */}
            <div style={{
              background:"#fff", borderRadius:14, border:`1px solid ${T.border}`,
              overflow:"hidden", boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
            }}>
              {/* Tabs */}
              <div style={{ display:"flex", borderBottom:`1px solid ${T.border}` }}>
                {(["activity","schedule"] as const).map(t => (
                  <button key={t} onClick={() => setActTab(t)} style={{
                    flex:1, height:40, fontSize:12, fontWeight: actTab===t ? 700 : 400,
                    border:"none", borderBottom:`2px solid ${actTab===t ? T.primary : "transparent"}`,
                    background:"transparent", color: actTab===t ? T.primary : T.t3,
                    cursor:"pointer", transition:"all 0.15s",
                  }}>
                    {t === "activity" ? "团队动态" : "日程计划"}
                  </button>
                ))}
              </div>

              <div style={{ padding:"12px 16px 16px" }}>
                {actTab === "activity" ? (
                  <div>
                    {ACTIVITY.map((item, i) => {
                      const dot = ACT_CFG[item.type].dot;
                      return (
                        <div key={item.id} style={{ display:"flex", gap:10, paddingBottom: i < ACTIVITY.length-1 ? 14 : 0 }}>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                            <div style={{
                              width:28, height:28, borderRadius:"50%", flexShrink:0,
                              background:`${dot}15`, display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:11, fontWeight:800, color:dot,
                            }}>{item.actor.slice(0,1)}</div>
                            {i < ACTIVITY.length-1 && <div style={{ width:1, flex:1, background:T.border, minHeight:8, marginTop:3 }} />}
                          </div>
                          <div style={{ flex:1, paddingTop:4 }}>
                            <div style={{ display:"flex", alignItems:"baseline", gap:4, flexWrap:"wrap" }}>
                              <span style={{ fontSize:12, fontWeight:600, color:T.t1 }}>{item.actor}</span>
                              <span style={{ fontSize:11, color:T.t2 }}>{item.action}</span>
                              <span style={{ fontSize:10, color:T.t4, marginLeft:"auto", whiteSpace:"nowrap" }}>{item.time}</span>
                            </div>
                            <div style={{ fontSize:11, color:T.t3, marginTop:2 }}>{item.detail}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {SCHEDULE.map((s, i) => (
                      <div key={i} style={{
                        display:"flex", alignItems:"center", gap:10, padding:"9px 10px",
                        borderRadius:9, background: s.urgent ? "#FFF6F6" : "#F9FAFC",
                        border:`1px solid ${s.urgent ? `${T.danger}40` : T.border}`,
                      }}>
                        <div style={{ flexShrink:0, textAlign:"center", lineHeight:1.3 }}>
                          <div style={{ fontSize:10, fontWeight:700, color: s.urgent ? T.danger : T.primary }}>{s.when}</div>
                          <div style={{ fontSize:10, color: s.urgent ? T.danger : T.t3, marginTop:1 }}>{s.time}</div>
                        </div>
                        <div style={{ width:1, height:26, background: s.urgent ? `${T.danger}35` : T.border, flexShrink:0 }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, fontWeight:500, color:T.t1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</div>
                          {s.urgent && <div style={{ fontSize:10, color:T.danger, marginTop:1 }}>截止时间临近</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
