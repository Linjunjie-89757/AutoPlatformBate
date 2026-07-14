import React, { useState } from "react";
import {
  Play, FileText, Sparkles, Bug, ArrowUpRight, ChevronRight,
  CheckCircle, XCircle, Activity, AlertTriangle,
  Bell, Server, Link2, Monitor, Timer,
  TrendingUp, Zap,
} from "lucide-react";

// ─── Palette ──────────────────────────────────────────────────────────────────
const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  border:"#E5E6EB",
  bg:"#F4F6FA",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};

// ─── Data ─────────────────────────────────────────────────────────────────────

interface RecentTask {
  id:string; name:string; type:"api"|"webui";
  status:"passed"|"failed"|"running"|"aborted";
  time:string; duration:string|null; trigger:"cron"|"manual";
}
interface AttentionItem {
  id:string; kind:"failed-task"|"pending-ai"|"p0-bug";
  title:string; desc:string; time:string; actionLabel:string; actionColor:string;
}
interface SystemItem { label:string; ok:boolean; detail:string; icon:React.ElementType; }
interface UpcomingTask { name:string; time:string; type:string; done:boolean; }

const RECENT_TASKS:RecentTask[] = [
  {id:"T005",name:"支付回调接口-烟雾测试",type:"api",status:"running",time:"10:30",duration:null,trigger:"cron"},
  {id:"T001",name:"订单接口回归-全量",type:"api",status:"passed",time:"02:00",duration:"4m 32s",trigger:"cron"},
  {id:"T002",name:"风控中心-黑名单场景验证",type:"api",status:"failed",time:"01:00",duration:"1m 18s",trigger:"cron"},
  {id:"T003",name:"用户中心-登录注册 Web UI 回归",type:"webui",status:"passed",time:"昨天 23:01",duration:"8m 55s",trigger:"cron"},
  {id:"T007",name:"系统并发压测套件",type:"api",status:"failed",time:"昨天 16:00",duration:"12m 40s",trigger:"manual"},
  {id:"T004",name:"获客中心-产品管理 UI 用例",type:"webui",status:"aborted",time:"昨天 14:30",duration:"3m 02s",trigger:"manual"},
];

const ATTENTION:AttentionItem[] = [
  {id:"a1",kind:"failed-task",title:"风控接口场景连续失败 2 次",desc:"T002 · 超时 1018ms，疑似测试环境问题",time:"01:00",actionLabel:"查看报告",actionColor:T.danger},
  {id:"a2",kind:"pending-ai",title:"28 条 AI 生成用例待评审",desc:"TSK_T3O04 · 退款超时校验流程",time:"昨天",actionLabel:"去评审",actionColor:T.purple},
  {id:"a3",kind:"p0-bug",title:"BUG-038 · 登录白屏复现率 100%",desc:"P0 · 风控中心 · 指派李明 · 已超 24h 未处理",time:"2 天前",actionLabel:"跟进",actionColor:T.danger},
  {id:"a4",kind:"failed-task",title:"并发压测套件失败",desc:"T007 · 12m 40s 中止，返回 503",time:"昨天 16:00",actionLabel:"查看日志",actionColor:T.warning},
];

const SYSTEM:SystemItem[] = [
  {label:"Runner 节点",ok:true,detail:"2 在线 · 1 忙碌 · 1 离线",icon:Server},
  {label:"AI 连接池",ok:false,detail:"2 正常 · 1 异常（Key 未配置）",icon:Sparkles},
  {label:"通知渠道",ok:true,detail:"QA 机器人正常 · 邮件已停用",icon:Bell},
  {label:"接口自动化",ok:true,detail:"4 个场景 · 3 个套件就绪",icon:Link2},
  {label:"Web UI 自动化",ok:true,detail:"Chrome / Edge 驱动正常",icon:Monitor},
];

const UPCOMING:UpcomingTask[] = [
  {name:"每日测试报告推送",time:"今天 09:00",type:"通知",done:true},
  {name:"订单接口回归-全量",time:"明天 02:00",type:"接口套件",done:false},
  {name:"登录注册 Web UI 回归",time:"周五 23:00",type:"Web UI 套件",done:false},
];

const MODULE_QUALITY = [
  {name:"订单中心",pass:97,runs:52,color:T.success},
  {name:"风控中心",pass:68,runs:18,color:T.warning},
  {name:"用户中心",pass:91,runs:34,color:T.success},
  {name:"获客中心",pass:100,runs:29,color:T.success},
];

const STATS = [
  {label:"今日执行",value:"236",sub:"次",color:T.primary},
  {label:"通过率",value:"93.6",sub:"%",color:T.success,trend:true},
  {label:"进行中",value:"2",sub:"个任务",color:"#F59E0B"},
  {label:"待处理缺陷",value:"8",sub:"P0×2",color:T.danger},
  {label:"AI待审",value:"28",sub:"条用例",color:T.purple},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusDot({status}:{status:RecentTask["status"]}){
  if(status==="running")return<div className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse" style={{backgroundColor:T.primary}}/>;
  if(status==="passed") return<CheckCircle size={13} color={T.success} style={{flexShrink:0}}/>;
  if(status==="failed") return<XCircle size={13} color={T.danger} style={{flexShrink:0}}/>;
  return<div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor:T.t4}}/>;
}

function TypeChip({type}:{type:RecentTask["type"]}){
  const cfg={api:{color:T.warning,bg:"#FFF3E8",label:"接口"},webui:{color:"#0FC6C2",bg:"#E0FFFE",label:"UI"}};
  const c=cfg[type];
  return<span className="text-[10px] px-1.5 py-px rounded flex-shrink-0" style={{backgroundColor:c.bg,color:c.color}}>{c.label}</span>;
}

const KIND_CFG:{[k:string]:{icon:React.ElementType;color:string;bg:string}}={
  "failed-task":{icon:XCircle,  color:T.danger, bg:"#FFE8E8"},
  "pending-ai": {icon:Sparkles, color:T.purple, bg:"#F5E8FF"},
  "p0-bug":     {icon:Bug,      color:T.danger, bg:"#FFE8E8"},
};

// ─── Main export ──────────────────────────────────────────────────────────────
export function OverviewModule({onNavigate}:{onNavigate:(k:string)=>void}){

  const quickActions=[
    {label:"执行任务",icon:Play,color:T.primary,nav:"tasks"},
    {label:"新建用例",icon:FileText,color:T.success,nav:"cases-list"},
    {label:"AI 生成",icon:Sparkles,color:T.purple,nav:"cases-ai-gen"},
    {label:"查看报告",icon:Activity,color:"#7816FF",nav:"reports"},
  ];

  return(
    // ── No outer scroll: flex-col fills the parent flex-1 slot
    <div className="flex-1 flex flex-col overflow-hidden" style={{backgroundColor:T.bg,padding:14,gap:10}}>

      {/* ── WELCOME BANNER (fixed height) ─────────────────────────────── */}
      <div className="flex-shrink-0 rounded-2xl px-5 py-3 flex items-center gap-6"
        style={{background:"linear-gradient(135deg,#1D2129 0%,#2D3748 100%)",minHeight:62}}>
        {/* Greeting */}
        <div className="flex-shrink-0">
          <div className="text-[10px] uppercase tracking-widest" style={{color:"rgba(255,255,255,0.4)"}}>工作台 · X-MAN · 2026-07-07</div>
          <div className="text-[17px] font-semibold text-white mt-0.5">早上好，张程远
            <span className="text-[12px] font-normal ml-2" style={{color:"rgba(255,255,255,0.45)"}}>测试负责人</span>
          </div>
        </div>
        <div className="w-px h-8 flex-shrink-0" style={{backgroundColor:"rgba(255,255,255,0.15)"}}/>
        {/* Inline stats */}
        <div className="flex items-center gap-5 flex-1">
          {STATS.map(s=>(
            <div key={s.label} className="flex items-baseline gap-1">
              <span className="text-[22px] font-bold leading-none" style={{color:s.color}}>{s.value}</span>
              <span className="text-[11px]" style={{color:"rgba(255,255,255,0.4)"}}>{s.sub}</span>
              <span className="text-[10px] ml-1" style={{color:"rgba(255,255,255,0.35)"}}>{s.label}</span>
              {s.trend&&<TrendingUp size={11} color={T.success} style={{marginLeft:2}}/>}
            </div>
          ))}
        </div>
        {/* Quick actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {quickActions.map(a=>(
            <button key={a.label} onClick={()=>onNavigate(a.nav)}
              className="flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-medium text-white"
              style={{backgroundColor:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.18)"}}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.backgroundColor=`${a.color}80`;}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.backgroundColor="rgba(255,255,255,0.1)";}}>
              <a.icon size={11}/>{a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── THREE-COLUMN MAIN AREA (flex-1 min-h-0 = fills remaining height) ── */}
      <div className="flex-1 min-h-0 flex gap-3">

        {/* ── COL 1: Execution timeline ───────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl flex flex-col overflow-hidden"
          style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 pt-4 pb-3" style={{borderBottom:`1px solid ${T.border}`}}>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold" style={{color:T.t1}}>今日执行动态</span>
              <span className="text-[11px] px-2 py-px rounded-full" style={{backgroundColor:"#E8F3FF",color:T.primary}}>最近 6 条</span>
            </div>
            <button onClick={()=>onNavigate("tasks")} className="flex items-center gap-0.5 text-[12px]" style={{color:T.primary,background:"none",border:"none",cursor:"pointer"}}>
              全部<ChevronRight size={12}/>
            </button>
          </div>
          {/* Scrollable list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-2">
            {RECENT_TASKS.map((task,i)=>{
              const isLast=i===RECENT_TASKS.length-1;
              const statusColor={passed:T.success,failed:T.danger,running:T.primary,aborted:T.t4}[task.status];
              return(
                <div key={task.id} className="flex items-center gap-3 py-3 group cursor-pointer"
                  style={{borderBottom:isLast?"none":`1px solid ${T.border}`}}>
                  <StatusDot status={task.status}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-medium truncate" style={{color:T.t1}}>{task.name}</span>
                      <TypeChip type={task.type}/>
                      <span className="text-[10px] px-1.5 py-px rounded flex-shrink-0" style={{backgroundColor:task.trigger==="cron"?"#F5F0FF":"#F2F3F5",color:task.trigger==="cron"?T.purple:T.t3}}>{task.trigger==="cron"?"定时":"手动"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span style={{color:statusColor}}>{task.status==="running"?"执行中...":task.status==="passed"?"通过":task.status==="failed"?"失败":"已中止"}</span>
                      {task.duration&&<span className="font-mono" style={{color:T.t3}}>{task.duration}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] font-mono" style={{color:T.t4}}>{task.time}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity" style={{color:T.primary}}>
                      <ArrowUpRight size={13}/>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Footer stat bar */}
          <div className="flex-shrink-0 px-5 py-2.5 flex items-center gap-4 text-[12px]" style={{borderTop:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
            <span style={{color:T.t3}}>今日共</span>
            <span style={{color:T.primary,fontWeight:600}}>236 次</span>
            <span className="w-px h-3" style={{backgroundColor:T.border}}/>
            <span style={{color:T.success}}>221 通过</span>
            <span style={{color:T.danger}}>15 失败</span>
            <span style={{color:"#F59E0B"}}>2 进行中</span>
          </div>
        </div>

        {/* ── COL 2: Attention + Trend/Module ─────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Needs attention (fills most of col 2) */}
          <div className="flex-1 min-h-0 bg-white rounded-2xl flex flex-col overflow-hidden"
            style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div className="flex-shrink-0 flex items-center gap-2 px-5 pt-4 pb-3" style={{borderBottom:`1px solid ${T.border}`}}>
              <AlertTriangle size={14} color={T.warning}/>
              <span className="text-[14px] font-semibold" style={{color:T.t1}}>需要关注</span>
              <span className="text-[11px] px-2 py-px rounded-full font-medium" style={{backgroundColor:"#FFE8E8",color:T.danger}}>{ATTENTION.length}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {ATTENTION.map(item=>{
                const kc=KIND_CFG[item.kind];
                return(
                  <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl" style={{backgroundColor:"#FAFAFA",border:`1px solid ${T.border}`}}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:kc.bg}}>
                      <kc.icon size={13} style={{color:kc.color}}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium" style={{color:T.t1}}>{item.title}</div>
                      <div className="text-[11px] mt-0.5 truncate" style={{color:T.t3}}>{item.desc}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px]" style={{color:T.t4}}>{item.time}</span>
                      <button className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{backgroundColor:`${item.actionColor}18`,color:item.actionColor,border:`1px solid ${item.actionColor}30`,cursor:"pointer"}}>
                        {item.actionLabel}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Module quality quick view (fixed height) */}
          <div className="flex-shrink-0 bg-white rounded-2xl px-5 py-4" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold" style={{color:T.t1}}>模块质量</span>
              <span className="text-[11px]" style={{color:T.t3}}>近 7 天</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              {MODULE_QUALITY.map(m=>(
                <div key={m.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px]" style={{color:T.t2}}>{m.name}</span>
                    <span className="text-[11px] font-semibold font-mono" style={{color:m.color}}>{m.pass}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{backgroundColor:"#F2F3F5"}}>
                    <div className="h-1.5 rounded-full" style={{width:`${m.pass}%`,backgroundColor:m.color}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── COL 3: Right sidebar ─────────────────────────────────────── */}
        <div className="flex-shrink-0 flex flex-col gap-3" style={{width:256}}>

          {/* System health */}
          <div className="flex-shrink-0 bg-white rounded-2xl px-4 py-4" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold" style={{color:T.t1}}>系统健康</span>
              <span className="text-[11px] flex items-center gap-1" style={{color:SYSTEM.every(s=>s.ok)?T.success:T.warning}}>
                <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:SYSTEM.every(s=>s.ok)?T.success:T.warning}}/>
                {SYSTEM.every(s=>s.ok)?"全部正常":"部分异常"}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {SYSTEM.map((s,i)=>(
                <div key={i} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{backgroundColor:s.ok?"#E8FFEA":"#FFE8E8"}}>
                    <s.icon size={11} style={{color:s.ok?T.success:T.danger}}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium" style={{color:T.t1}}>{s.label}</span>
                      <span style={{color:s.ok?T.success:T.danger,fontSize:9}}>{s.ok?"正常":"异常"}</span>
                    </div>
                    <div className="text-[10px] truncate" style={{color:T.t3}}>{s.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming tasks */}
          <div className="flex-shrink-0 bg-white rounded-2xl px-4 py-4" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold" style={{color:T.t1}}>即将执行</span>
              <button onClick={()=>onNavigate("tasks")} style={{color:T.primary,background:"none",border:"none",cursor:"pointer",fontSize:11}} className="flex items-center gap-0.5">
                全部<ChevronRight size={10}/>
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {UPCOMING.map((u,i)=>(
                <div key={i} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor:u.done?T.t4:T.primary}}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium truncate" style={{color:u.done?T.t3:T.t1}}>{u.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px]" style={{color:u.done?T.t4:T.primary}}>{u.time}</span>
                      <span className="text-[9px] px-1 py-px rounded" style={{backgroundColor:"#F2F3F5",color:T.t3}}>{u.type}</span>
                      {u.done&&<span className="text-[9px]" style={{color:T.t4}}>已完成</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI insights (fills remaining height) */}
          <div className="flex-1 min-h-0 rounded-2xl px-4 py-4 flex flex-col overflow-hidden"
            style={{border:`1px solid #D8B4FE`,background:"linear-gradient(160deg,#FAFAFF,#F5F0FF)"}}>
            <div className="flex items-center gap-1.5 mb-3 flex-shrink-0">
              <Sparkles size={13} color={T.purple}/>
              <span className="text-[13px] font-semibold" style={{color:T.t1}}>AI 洞察</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
              {[
                {title:"质量摘要",body:"近 7 天通过率 93.6%，较上周 ↑2.1%。失败集中在风控中心（5次）和订单中心（3次）。"},
                {title:"根因分析",body:"/api/v1/blacklist 接口超时率偏高，建议检查服务响应延迟，考虑增加重试断言。"},
                {title:"调度建议",body:"风控场景与订单回归在 01:00 重叠，建议错峰到 03:00，避免资源竞争。"},
              ].map((ai,i)=>(
                <div key={i} className="rounded-xl p-3" style={{backgroundColor:"rgba(255,255,255,0.8)",border:"1px solid #E9D5FF"}}>
                  <div className="text-[11px] font-semibold mb-1" style={{color:T.purple}}>{ai.title}</div>
                  <div className="text-[11px] leading-relaxed" style={{color:T.t2}}>{ai.body}</div>
                </div>
              ))}
            </div>
            <button className="flex-shrink-0 w-full mt-2.5 h-7 rounded-lg text-[11px] font-medium" style={{backgroundColor:"#F5E8FF",color:T.purple,border:"1px solid #D8B4FE",cursor:"pointer"}}>
              查看完整 AI 分析
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
