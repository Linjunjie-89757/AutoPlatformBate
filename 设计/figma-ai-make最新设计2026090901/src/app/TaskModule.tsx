import React, { useState } from "react";
import {
  Search, Plus, Play, Timer, Activity, Power, AlertTriangle, Sparkles,
  Layers, ClipboardList, Eye, Edit2, Trash2, X, CheckCircle, Clock,
  ExternalLink, Save,
} from "lucide-react";
import { BarChart, Bar, XAxis } from "recharts";

// ─── Palette (local copy) ─────────────────────────────────────────────────────

const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  cyan:"#0FC6C2",
  border:"#E5E6EB",  bg:"#F4F6FA",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type AutoTaskType   = "api-scenario"|"api-suite"|"webui-case"|"webui-suite";
export type TaskTrigger    = "manual"|"cron";
export type TaskExecStatus = "passed"|"failed"|"running"|"never";

export interface AutoTask {
  id:string; name:string; type:AutoTaskType; env:string;
  trigger:TaskTrigger; cron?:string; cronDesc?:string;
  enabled:boolean; lastStatus:TaskExecStatus|null;
  lastAt:string|null; lastDur:string|null;
  creator:string; createdAt:string; nextAt:string|null; desc?:string;
}
interface TaskRun {
  id:string; status:"passed"|"failed"|"running";
  startAt:string; dur:string; total:number; passed:number; failed:number;
  trigger:"manual"|"cron"; runner:string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_COLOR = "#F59E0B";
const TASK_TYPE_LABELS:Record<AutoTaskType,string> = {"api-scenario":"接口场景","api-suite":"接口套件","webui-case":"Web UI 用例","webui-suite":"Web UI 套件"};
const TASK_TYPE_COLOR:Record<AutoTaskType,string>  = {"api-scenario":T.warning,"api-suite":"#D97706","webui-case":T.cyan,"webui-suite":"#0891B2"};
const TASK_TYPE_BG:Record<AutoTaskType,string>     = {"api-scenario":"#FFF3E8","api-suite":"#FFFBEB","webui-case":"#E0FFFE","webui-suite":"#ECFEFF"};
const TASK_EXEC_STYLE:Record<TaskExecStatus,{label:string;color:string;bg:string;dot:string}> = {
  passed: {label:"通过",   color:"#00B42A",bg:"#E8FFEA",dot:"#00B42A"},
  failed: {label:"失败",   color:"#F53F3F",bg:"#FFE8E8",dot:"#F53F3F"},
  running:{label:"执行中", color:"#165DFF",bg:"#E8F3FF",dot:"#165DFF"},
  never:  {label:"从未执行",color:"#86909C",bg:"#F2F3F5",dot:"#C9CDD4"},
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const AUTO_TASKS:AutoTask[] = [
  {id:"T001",name:"订单接口回归-全量",type:"api-suite",env:"测试环境",trigger:"cron",cron:"0 2 * * *",cronDesc:"每天 02:00",enabled:true,lastStatus:"passed",lastAt:"2026-07-07 02:00",lastDur:"4m 32s",creator:"张程远",createdAt:"2026-05-01",nextAt:"2026-07-08 02:00",desc:"覆盖订单中心所有接口场景，执行前自动同步环境变量。"},
  {id:"T002",name:"风控中心-黑名单场景验证",type:"api-scenario",env:"预发布",trigger:"cron",cron:"0 1 * * 1",cronDesc:"每周一 01:00",enabled:true,lastStatus:"failed",lastAt:"2026-07-07 01:00",lastDur:"1m 18s",creator:"李明",createdAt:"2026-05-10",nextAt:"2026-07-14 01:00",desc:""},
  {id:"T003",name:"用户中心-登录注册 Web UI 回归",type:"webui-suite",env:"测试环境",trigger:"cron",cron:"0 23 * * 5",cronDesc:"每周五 23:00",enabled:true,lastStatus:"passed",lastAt:"2026-07-04 23:01",lastDur:"8m 55s",creator:"王芳",createdAt:"2026-06-01",nextAt:"2026-07-11 23:00",desc:""},
  {id:"T004",name:"获客中心-产品管理 UI 用例",type:"webui-case",env:"测试环境",trigger:"manual",enabled:false,lastStatus:"failed",lastAt:"2026-07-05 14:30",lastDur:"3m 02s",creator:"陈伟",createdAt:"2026-06-15",nextAt:null,desc:""},
  {id:"T005",name:"支付回调接口-烟雾测试",type:"api-scenario",env:"生产环境",trigger:"cron",cron:"*/30 * * * *",cronDesc:"每 30 分钟",enabled:true,lastStatus:"running",lastAt:"2026-07-07 10:30",lastDur:null,creator:"张程远",createdAt:"2026-06-20",nextAt:"2026-07-07 11:00",desc:""},
  {id:"T006",name:"订单退款-全流程场景",type:"api-scenario",env:"预发布",trigger:"cron",cron:"0 3 * * *",cronDesc:"每天 03:00",enabled:false,lastStatus:"never",lastAt:null,lastDur:null,creator:"李明",createdAt:"2026-07-01",nextAt:null,desc:""},
  {id:"T007",name:"系统并发压测套件",type:"api-suite",env:"测试环境",trigger:"manual",enabled:true,lastStatus:"failed",lastAt:"2026-07-06 16:00",lastDur:"12m 40s",creator:"陈伟",createdAt:"2026-07-03",nextAt:null,desc:""},
  {id:"T008",name:"获客中心-页面管理 Web UI",type:"webui-case",env:"测试环境",trigger:"cron",cron:"0 0 * * 1,4",cronDesc:"每周一、四 00:00",enabled:true,lastStatus:"passed",lastAt:"2026-07-07 00:00",lastDur:"5m 17s",creator:"王芳",createdAt:"2026-06-28",nextAt:"2026-07-10 00:00",desc:""},
];

const TASK_RUNS:TaskRun[] = [
  {id:"R001",status:"passed",startAt:"2026-07-07 02:00",dur:"4m 32s",total:48,passed:48,failed:0,trigger:"cron",runner:"runner-prod-01"},
  {id:"R002",status:"passed",startAt:"2026-07-06 02:00",dur:"4m 18s",total:48,passed:47,failed:1,trigger:"cron",runner:"runner-prod-01"},
  {id:"R003",status:"failed",startAt:"2026-07-05 02:00",dur:"3m 55s",total:48,passed:41,failed:7,trigger:"cron",runner:"runner-prod-01"},
  {id:"R004",status:"passed",startAt:"2026-07-04 02:00",dur:"4m 44s",total:48,passed:48,failed:0,trigger:"cron",runner:"runner-prod-02"},
  {id:"R005",status:"passed",startAt:"2026-07-03 02:00",dur:"4m 22s",total:48,passed:46,failed:2,trigger:"manual",runner:"runner-prod-01"},
  {id:"R006",status:"failed",startAt:"2026-07-02 02:00",dur:"2m 31s",total:48,passed:35,failed:13,trigger:"cron",runner:"runner-prod-01"},
  {id:"R007",status:"passed",startAt:"2026-07-01 02:00",dur:"4m 55s",total:48,passed:48,failed:0,trigger:"cron",runner:"runner-prod-02"},
  {id:"R008",status:"passed",startAt:"2026-06-30 02:00",dur:"4m 29s",total:48,passed:48,failed:0,trigger:"cron",runner:"runner-prod-01"},
  {id:"R009",status:"passed",startAt:"2026-06-29 02:00",dur:"4m 37s",total:48,passed:47,failed:1,trigger:"cron",runner:"runner-prod-01"},
  {id:"R010",status:"passed",startAt:"2026-06-28 02:00",dur:"4m 41s",total:48,passed:48,failed:0,trigger:"cron",runner:"runner-prod-02"},
];

const TASK_PASS_TREND = [
  {day:"6/28",pass:48,fail:0},{day:"6/29",pass:47,fail:1},{day:"6/30",pass:48,fail:0},
  {day:"7/1",pass:48,fail:0},{day:"7/2",pass:35,fail:13},{day:"7/3",pass:46,fail:2},
  {day:"7/4",pass:48,fail:0},{day:"7/5",pass:41,fail:7},{day:"7/6",pass:47,fail:1},{day:"7/7",pass:48,fail:0},
];

// ─── Local UI atoms (self-contained copy) ─────────────────────────────────────

function StatusDot({status}:{status:string}){
  const M:Record<string,{dot:string;text:string;tc:string}>={
    enabled:{dot:T.success,text:"已启用",tc:T.t2},disabled:{dot:T.t4,text:"已停用",tc:T.t3},
  };
  const c=M[status]??M.disabled;
  return<span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor:c.dot}}/><span className="text-[12px]" style={{color:c.tc}}>{c.text}</span></span>;
}

function PBtn({children,onClick,icon:Icon,small,color=T.primary,variant="primary"}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;variant?:"primary"|"ghost"}){
  if(variant==="ghost")return<button onClick={onClick} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium bg-white" style={{borderColor:T.border,color:T.t2}}>{Icon&&<Icon size={13}/>}{children}</button>;
  return<button onClick={onClick} className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-all active:scale-[0.98]" style={{backgroundColor:color,color:"#fff",height:small?28:32,padding:small?"0 10px":"0 14px",fontSize:small?12:13}} onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.1)"} onMouseLeave={e=>e.currentTarget.style.filter=""}>{Icon&&<Icon size={small?12:13}/>}{children}</button>;
}

function IBtn({icon:Icon,label,danger,onClick}:{icon:React.ElementType;label:string;danger?:boolean;onClick?:()=>void}){
  return<button title={label} onClick={e=>{e.stopPropagation();onClick?.();}} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{color:T.t4}} onMouseEnter={e=>{e.currentTarget.style.color=danger?T.danger:T.t1;e.currentTarget.style.backgroundColor=danger?"#FFF0F0":"#F2F3F5";}} onMouseLeave={e=>{e.currentTarget.style.color=T.t4;e.currentTarget.style.backgroundColor="transparent";}}><Icon size={13}/></button>;
}

function Inp({placeholder,prefix,mono,width,value,onChange}:{placeholder?:string;prefix?:React.ReactNode;mono?:boolean;width?:string|number;value?:string;onChange?:(v:string)=>void}){
  return<div className="relative flex items-center" style={{width}}>{prefix&&<span className="absolute left-2.5 pointer-events-none" style={{color:T.t3}}>{prefix}</span>}<input placeholder={placeholder} value={value} onChange={e=>onChange?.(e.target.value)} className={`h-8 border rounded-lg bg-white text-[13px] outline-none transition-all w-full ${prefix?"pl-8 pr-3":"px-3"} ${mono?"font-mono text-[12px]":""}`} style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.primary}18`;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/></div>;
}

function Toggle({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}){
  return<button onClick={()=>onChange(!on)} className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0" style={{backgroundColor:on?T.primary:"#C9CDD4"}}><span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all" style={{left:on?"calc(100% - 14px)":"2px"}}/></button>;
}

interface Col{label:string;width?:string;align?:"left"|"right"|"center"}
function ETable({cols,children,total}:{cols:Col[];children:React.ReactNode;total?:number}){
  const[page,setPage]=useState(1);const pages=total?Math.max(1,Math.ceil(total/10)):1;
  return<div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}><table className="w-full border-collapse"><thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>{cols.map((c,i)=><th key={i} style={{width:c.width,textAlign:c.align??"left",color:T.t3}} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">{c.label}</th>)}</tr></thead><tbody>{children}</tbody></table>{total!==undefined&&<div className="flex items-center justify-between px-4 py-2.5" style={{borderTop:`1px solid ${T.border}`}}><span className="text-[12px]" style={{color:T.t3}}>共 {total} 条</span><div className="flex items-center gap-1">{Array.from({length:pages}).map((_,i)=><button key={i} onClick={()=>setPage(i+1)} className="w-7 h-7 rounded-md text-[12px] font-medium" style={{backgroundColor:page===i+1?T.primary:"transparent",color:page===i+1?"#fff":T.t2,border:`1px solid ${page===i+1?T.primary:T.border}`}}>{i+1}</button>)}</div></div>}</div>;
}
function TR({children,active,onClick}:{children:React.ReactNode;active?:boolean;onClick?:()=>void}){
  return<tr onClick={onClick} className="border-b last:border-b-0 transition-colors" style={{borderColor:T.border,height:46,backgroundColor:active?`${T.primary}08`:"",cursor:onClick?"pointer":"default"}} onMouseEnter={e=>!active&&(e.currentTarget.style.backgroundColor="#FAFBFF")} onMouseLeave={e=>!active&&(e.currentTarget.style.backgroundColor="")}>{children}</tr>;
}
function TD({children,align="left",mono,muted}:{children?:React.ReactNode;align?:"left"|"right"|"center";mono?:boolean;muted?:boolean}){
  return<td className={`px-4 py-2 text-[13px] ${mono?"font-mono text-[12px]":""}`} style={{textAlign:align,color:muted?T.t3:T.t1}}>{children}</td>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TaskDetailInfo({task}:{task:AutoTask}){
  const st=task.lastStatus?TASK_EXEC_STYLE[task.lastStatus]:null;
  const rows:[string,React.ReactNode][]=[
    ["任务名称",<strong style={{color:T.t1}}>{task.name}</strong>],
    ["任务描述",task.desc||<span style={{color:T.t4}}>暂无描述</span>],
    ["任务类型",<span className="px-2 py-0.5 rounded text-[11px]" style={{backgroundColor:TASK_TYPE_BG[task.type],color:TASK_TYPE_COLOR[task.type]}}>{TASK_TYPE_LABELS[task.type]}</span>],
    ["执行环境",task.env],
    ["调度方式",task.trigger==="cron"
      ?<span className="inline-flex items-center gap-2 flex-wrap"><Timer size={12} style={{color:TASK_COLOR}}/>{task.cronDesc}<code className="px-1.5 py-px rounded font-mono text-[11px]" style={{backgroundColor:"#F2F3F5",color:T.t2}}>{task.cron}</code></span>
      :<span>手动触发</span>],
    ["下次执行",task.nextAt??<span style={{color:T.t4}}>—</span>],
    ["创建人",task.creator],
    ["创建时间",task.createdAt],
  ];
  return(
    <div>
      <div className="rounded-xl overflow-hidden mb-4" style={{border:`1px solid ${T.border}`}}>
        {rows.map(([label,value],i)=>(
          <div key={i} className="flex items-center px-4 py-2.5" style={{backgroundColor:i%2===0?"#FAFAFA":"#fff",borderTop:i>0?`1px solid ${T.border}`:"none"}}>
            <span className="w-20 flex-shrink-0 text-[12px]" style={{color:T.t3}}>{label}</span>
            <span className="flex-1 text-[13px]" style={{color:T.t2}}>{value}</span>
          </div>
        ))}
      </div>
      {task.lastStatus&&task.lastStatus!=="never"&&(
        <div className="rounded-xl p-4 mb-4" style={{border:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
          <div className="text-[12px] font-semibold mb-3" style={{color:T.t3}}>最近一次执行</div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              {label:"执行结果",value:st?<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px]" style={{backgroundColor:st.bg,color:st.color}}><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:st.dot}}/>{st.label}</span>:"—"},
              {label:"执行时间",value:<span className="font-mono text-[12px]">{task.lastAt}</span>},
              {label:"执行耗时",value:<span className="font-mono text-[12px]">{task.lastDur??"-"}</span>},
            ].map((c,ci)=>(
              <div key={ci} className="bg-white rounded-lg p-3" style={{border:`1px solid ${T.border}`}}>
                <div className="text-[11px] mb-1.5" style={{color:T.t3}}>{c.label}</div>
                <div style={{color:T.t1}}>{c.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <button className="text-[12px] flex items-center gap-1" style={{color:T.primary}}><ExternalLink size={10}/>查看完整报告</button>
          </div>
        </div>
      )}
      <div className="rounded-xl p-4" style={{border:`1px solid ${T.border}`}}>
        <div className="text-[12px] font-semibold mb-3" style={{color:T.t3}}>失败策略</div>
        {[["失败时继续执行","继续执行剩余步骤"],["失败时发送通知","是 · QA 团队机器人"],["日志保留","保留全部日志"]].map(([k,v],i)=>(
          <div key={i} className={`flex items-center justify-between text-[13px]${i>0?" mt-2":""}`}>
            <span style={{color:T.t3}}>{k}</span><span style={{color:T.t2}}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskDetailHistory(){
  return(
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] font-semibold" style={{color:T.t1}}>最近 10 次执行记录</span>
        <button className="text-[12px] flex items-center gap-1" style={{color:T.primary}}><ExternalLink size={11}/>查看全部历史</button>
      </div>
      <div className="bg-white rounded-xl p-4 mb-4" style={{border:`1px solid ${T.border}`}}>
        <div className="text-[11px] mb-3" style={{color:T.t3}}>通过 / 失败趋势（近 10 次）</div>
        <div style={{overflowX:"auto"}}>
          <BarChart width={520} height={72} data={TASK_PASS_TREND} barGap={2} margin={{top:0,right:0,bottom:0,left:-20}}>
            <XAxis dataKey="day" tick={{fontSize:10,fill:T.t3}} axisLine={false} tickLine={false}/>
            <Bar key="pass" dataKey="pass" stackId="a" fill="#00B42A" maxBarSize={16}/>
            <Bar key="fail" dataKey="fail" stackId="a" fill="#F53F3F" radius={[2,2,0,0]} maxBarSize={16}/>
          </BarChart>
        </div>
      </div>
      <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
        <table className="w-full border-collapse">
          <thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
            {["触发","执行时间","耗时","结果（总/过/败）","操作"].map((h,i)=>(
              <th key={i} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-left" style={{color:T.t3}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {TASK_RUNS.map(run=>{
              const s=TASK_EXEC_STYLE[run.status as TaskExecStatus];
              return(
                <tr key={run.id} className="border-b last:border-0" style={{borderColor:T.border,height:40}}>
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px]" style={{backgroundColor:s.bg,color:s.color}}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:s.dot}}/>{run.trigger==="cron"?"定时":"手动"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[12px] font-mono" style={{color:T.t2}}>{run.startAt}</td>
                  <td className="px-3 py-1.5 text-[12px] font-mono" style={{color:T.t2}}>{run.dur}</td>
                  <td className="px-3 py-1.5 text-[12px]">
                    <span style={{color:T.t2}}>{run.total}</span><span className="mx-1" style={{color:T.t4}}>/</span>
                    <span style={{color:"#00B42A"}}>{run.passed}</span><span className="mx-1" style={{color:T.t4}}>/</span>
                    <span style={{color:run.failed>0?"#F53F3F":T.t4}}>{run.failed}</span>
                  </td>
                  <td className="px-3 py-1.5">
                    <button className="text-[11px] flex items-center gap-0.5" style={{color:T.primary}}><ExternalLink size={10}/>报告</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaskDetailAI({task}:{task:AutoTask}){
  void task;
  return(
    <div>
      <div className="rounded-xl p-4 mb-4" style={{border:`1px solid ${TASK_COLOR}55`,background:"linear-gradient(135deg,#FFFBEB,#FEF3C7)"}}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Sparkles size={14} style={{color:TASK_COLOR}}/><span className="text-[13px] font-semibold" style={{color:T.t1}}>AI 稳定性分析</span></div>
          <span className="text-[11px]" style={{color:T.t3}}>基于最近 10 次执行</span>
        </div>
        <div className="flex items-end gap-5">
          <div>
            <div className="text-[36px] font-bold leading-none" style={{color:TASK_COLOR}}>80<span className="text-[18px] font-semibold">%</span></div>
            <div className="text-[12px] mt-1" style={{color:T.t3}}>近期通过率</div>
          </div>
          <div className="flex-1 mb-2">
            <div className="h-2 rounded-full overflow-hidden" style={{backgroundColor:"#E5E6EB"}}>
              <div className="h-2 rounded-full" style={{width:"80%",backgroundColor:TASK_COLOR}}/>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[11px]" style={{color:T.t3}}>8 / 10 次通过</span>
              <span className="text-[11px]" style={{color:T.t3}}>均耗时 4m 23s</span>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl p-4 mb-4" style={{border:`1px solid ${T.border}`}}>
        <div className="flex items-center gap-2 mb-3"><AlertTriangle size={13} style={{color:"#F53F3F"}}/><span className="text-[13px] font-semibold" style={{color:T.t1}}>高频失败步骤</span></div>
        <div className="text-[12px] mb-3" style={{color:T.t2}}>基于 <strong style={{color:"#F53F3F"}}>2 次失败记录</strong>（2026-07-02、2026-07-05）分析：</div>
        {[
          {step:"POST /api/v1/orders/refund",freq:"2/2",reason:"接口超时 30s，疑似测试环境连接不稳定"},
          {step:"断言 $.data.status === 'refunded'",freq:"1/2",reason:"状态流转延迟，建议增加重试等待断言"},
        ].map((f,i)=>(
          <div key={i} className={`rounded-lg p-3${i>0?" mt-2":""}`} style={{backgroundColor:"#FFF5F5",border:"1px solid #FFD6D6"}}>
            <div className="flex items-center justify-between gap-2">
              <code className="text-[11px] font-mono" style={{color:"#F53F3F"}}>{f.step}</code>
              <span className="text-[11px] flex-shrink-0 px-1.5 py-px rounded text-white" style={{backgroundColor:"#F53F3F"}}>{f.freq} 次</span>
            </div>
            <div className="text-[12px] mt-1.5" style={{color:T.t2}}>{f.reason}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl p-4" style={{border:`1px solid ${T.border}`,backgroundColor:"#F0F9FF"}}>
        <div className="flex items-center gap-2 mb-3"><Sparkles size={13} style={{color:T.primary}}/><span className="text-[13px] font-semibold" style={{color:T.t1}}>调度建议</span></div>
        {[
          {icon:Timer,title:"建议改为夜间 03:00 执行",desc:"分析发现凌晨 02:00 测试环境负载较高（与备份任务重叠），建议错峰到 03:00。"},
          {icon:Layers,title:"建议拆分高失败率场景",desc:"「退款接口」失败率 67%，建议拆离为独立任务并调低频率，避免影响整体通过率。"},
        ].map((r,i)=>(
          <div key={i} className={`flex gap-2.5${i>0?" mt-3":""}`}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{backgroundColor:"#DBEAFE"}}>
              <r.icon size={11} style={{color:T.primary}}/>
            </div>
            <div>
              <div className="text-[13px] font-medium" style={{color:T.t1}}>{r.title}</div>
              <div className="text-[12px] mt-0.5" style={{color:T.t3}}>{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TaskCreateProps{task:AutoTask|null;onClose:()=>void;onSave:(t:AutoTask)=>void;}

function TaskCreateDrawer({task,onClose,onSave}:TaskCreateProps){
  const[name,setName]=useState(task?.name??"");
  const[desc,setDesc]=useState(task?.desc??"");
  const[type,setType]=useState<AutoTaskType>(task?.type??"api-suite");
  const[env,setEnv]=useState(task?.env??"测试环境");
  const[trigger,setTrigger]=useState<TaskTrigger>(task?.trigger??"manual");
  const[cron,setCron]=useState(task?.cron??"0 2 * * *");
  const[notifyEnabled,setNotifyEnabled]=useState(false);
  const[failContinue,setFailContinue]=useState(true);
  const[failNotify,setFailNotify]=useState(true);
  const[keepLog,setKeepLog]=useState(true);
  const isEdit=!!task;

  const CRON_PRESETS:[string,string][]=[["每天 00:00","0 0 * * *"],["每天 02:00","0 2 * * *"],["每小时","0 * * * *"],["每 30 分钟","*/30 * * * *"],["每周一 01:00","0 1 * * 1"]];
  const CRON_PREVIEW:Record<string,string>={"0 0 * * *":"每天 00:00","0 2 * * *":"每天 02:00","0 * * * *":"每小时整点","*/30 * * * *":"每 30 分钟","0 1 * * 1":"每周一 01:00"};

  const Num=({n,label}:{n:number;label:string})=>(
    <div className="flex items-center gap-1.5 text-[12px] font-semibold mb-3" style={{color:T.t3}}>
      <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center text-white" style={{backgroundColor:TASK_COLOR}}>{n}</span>{label}
    </div>
  );

  return(
    <>
      <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
        <div>
          <div className="text-[15px] font-semibold" style={{color:T.t1}}>{isEdit?"编辑任务":"新建任务"}</div>
          <div className="text-[12px] mt-0.5" style={{color:T.t3}}>{isEdit?"修改任务配置和调度策略":"配置自动化任务和调度策略"}</div>
        </div>
        <IBtn icon={X} label="关闭" onClick={onClose}/>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
        {/* 基础信息 */}
        <div>
          <Num n={1} label="基础信息"/>
          <div className="flex flex-col gap-2.5">
            <div>
              <label className="block text-[12px] mb-1" style={{color:T.t2}}>任务名称 <span style={{color:"#F53F3F"}}>*</span></label>
              <Inp placeholder="输入任务名称，建议简洁清晰" value={name} onChange={setName}/>
            </div>
            <div>
              <label className="block text-[12px] mb-1" style={{color:T.t2}}>任务描述</label>
              <textarea placeholder="可选，描述任务用途和范围" value={desc} onChange={e=>setDesc(e.target.value)}
                className="w-full h-14 px-3 py-2 border rounded-lg text-[13px] outline-none resize-none"
                style={{borderColor:T.border,color:T.t1}}/>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[12px] mb-1" style={{color:T.t2}}>任务类型 <span style={{color:"#F53F3F"}}>*</span></label>
                <select className="w-full h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} value={type} onChange={e=>setType(e.target.value as AutoTaskType)}>
                  <option value="api-scenario">接口场景</option><option value="api-suite">接口套件</option>
                  <option value="webui-case">Web UI 用例</option><option value="webui-suite">Web UI 套件</option>
                </select>
              </div>
              <div>
                <label className="block text-[12px] mb-1" style={{color:T.t2}}>执行环境 <span style={{color:"#F53F3F"}}>*</span></label>
                <select className="w-full h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} value={env} onChange={e=>setEnv(e.target.value)}>
                  <option>测试环境</option><option>预发布</option><option>生产环境</option><option>开发环境</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="h-px" style={{backgroundColor:T.border}}/>
        {/* 触发方式 */}
        <div>
          <Num n={2} label="触发方式"/>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {(["manual","cron"] as TaskTrigger[]).map(t=>(
              <button key={t} onClick={()=>setTrigger(t)}
                className="flex items-center gap-2.5 p-3 rounded-xl text-left transition-all"
                style={{border:`${trigger===t?2:1}px solid ${trigger===t?TASK_COLOR:T.border}`,backgroundColor:trigger===t?"#FFFBEB":"#fff"}}>
                {t==="manual"?<Play size={14} style={{color:trigger===t?TASK_COLOR:T.t3}}/>:<Timer size={14} style={{color:trigger===t?TASK_COLOR:T.t3}}/>}
                <div>
                  <div className="text-[13px] font-medium" style={{color:trigger===t?TASK_COLOR:T.t1}}>{t==="manual"?"手动触发":"定时调度"}</div>
                  <div className="text-[11px]" style={{color:T.t3}}>{t==="manual"?"仅手动点击执行":"按 Cron 表达式定时执行"}</div>
                </div>
              </button>
            ))}
          </div>
          {trigger==="cron"&&(
            <div className="rounded-xl p-4" style={{border:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
              <div className="mb-3">
                <label className="block text-[12px] mb-1.5" style={{color:T.t2}}>Cron 表达式</label>
                <Inp mono placeholder="0 2 * * *" value={cron} onChange={setCron}/>
              </div>
              {CRON_PREVIEW[cron]&&(
                <div className="flex flex-col gap-1.5 mb-3">
                  <div className="flex items-center gap-2 text-[12px]"><CheckCircle size={12} style={{color:"#00B42A"}}/><span style={{color:T.t2}}>解析结果：<strong>{CRON_PREVIEW[cron]}</strong></span></div>
                  <div className="flex items-center gap-2 text-[12px]"><Clock size={12} style={{color:T.primary}}/><span style={{color:T.t2}}>下次执行：<strong>2026-07-08 02:00:00</strong></span></div>
                </div>
              )}
              <div>
                <div className="text-[11px] mb-2" style={{color:T.t3}}>快速选择</div>
                <div className="flex flex-wrap gap-1.5">
                  {CRON_PRESETS.map(([label,expr])=>(
                    <button key={expr} onClick={()=>setCron(expr)}
                      className="h-6 px-2.5 rounded-full text-[11px] border transition-all"
                      style={{borderColor:cron===expr?TASK_COLOR:T.border,backgroundColor:cron===expr?"#FFFBEB":"#fff",color:cron===expr?TASK_COLOR:T.t2}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="h-px" style={{backgroundColor:T.border}}/>
        {/* 通知配置 */}
        <div>
          <Num n={3} label="通知配置"/>
          <div className="flex items-center justify-between p-3 rounded-xl" style={{border:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
            <div>
              <div className="text-[13px] font-medium" style={{color:T.t1}}>企业微信通知</div>
              <div className="text-[12px] mt-0.5" style={{color:T.t3}}>执行完成后发送结果通知</div>
            </div>
            <Toggle on={notifyEnabled} onChange={setNotifyEnabled}/>
          </div>
          {notifyEnabled&&(
            <div className="mt-2">
              <label className="block text-[12px] mb-1" style={{color:T.t2}}>通知机器人</label>
              <select className="w-full h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}>
                <option>QA 团队机器人</option><option>故障告警机器人</option>
              </select>
            </div>
          )}
        </div>
        <div className="h-px" style={{backgroundColor:T.border}}/>
        {/* 失败策略 */}
        <div>
          <Num n={4} label="失败策略"/>
          <div className="flex flex-col gap-2">
            {[
              {label:"失败时继续执行",desc:"某步骤失败后，继续执行后续步骤",on:failContinue,set:setFailContinue},
              {label:"失败时发送通知",desc:"执行失败时触发企业微信告警",on:failNotify,set:setFailNotify},
              {label:"保留执行日志",desc:"保留详细的步骤级执行日志",on:keepLog,set:setKeepLog},
            ].map((s,i)=>(
              <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{border:`1px solid ${T.border}`}}>
                <div>
                  <div className="text-[13px] font-medium" style={{color:T.t1}}>{s.label}</div>
                  <div className="text-[12px] mt-0.5" style={{color:T.t3}}>{s.desc}</div>
                </div>
                <Toggle on={s.on} onChange={s.set}/>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5" style={{borderTop:`1px solid ${T.border}`}}>
        <button className="h-8 px-3 border rounded-lg text-[13px] flex items-center gap-1.5" style={{borderColor:T.border,color:T.t2}}>
          <Play size={12}/>测试执行
        </button>
        <div className="flex items-center gap-2">
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn color={TASK_COLOR} onClick={()=>onSave({
            id:task?.id??`T${Date.now()}`,name,desc,type,env,trigger,
            cron,cronDesc:CRON_PREVIEW[cron]??cron,
            enabled:task?.enabled??true,lastStatus:task?.lastStatus??null,
            lastAt:task?.lastAt??null,lastDur:task?.lastDur??null,
            creator:task?.creator??"张程远",createdAt:task?.createdAt??"2026-07-07",nextAt:null,
          })}>
            <Save size={12}/>{isEdit?"保存修改":"创建任务"}
          </PBtn>
        </div>
      </div>
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function TaskModule(){
  const[tasks,setTasks]=useState<AutoTask[]>(AUTO_TASKS);
  const[search,setSearch]=useState("");
  const[filterType,setFilterType]=useState("all");
  const[filterStatus,setFilterStatus]=useState("all");
  const[filterResult,setFilterResult]=useState("all");
  const[filterEnv,setFilterEnv]=useState("all");
  const[selectedTask,setSelectedTask]=useState<AutoTask|null>(null);
  const[detailTab,setDetailTab]=useState<"info"|"history"|"ai">("info");
  const[showCreate,setShowCreate]=useState(false);
  const[editingTask,setEditingTask]=useState<AutoTask|null>(null);
  const[confirmToggle,setConfirmToggle]=useState<AutoTask|null>(null);
  const[confirmDelete,setConfirmDelete]=useState<AutoTask|null>(null);

  const filtered=tasks.filter(t=>{
    if(search&&!t.name.toLowerCase().includes(search.toLowerCase()))return false;
    if(filterType!=="all"&&t.type!==filterType)return false;
    if(filterStatus==="enabled"&&!t.enabled)return false;
    if(filterStatus==="disabled"&&t.enabled)return false;
    if(filterResult!=="all"&&t.lastStatus!==filterResult)return false;
    if(filterEnv!=="all"&&t.env!==filterEnv)return false;
    return true;
  });

  const statCards=[
    {label:"任务总数",value:tasks.length,color:T.t2,bg:"#F2F3F5",Icon:ClipboardList},
    {label:"已启用",value:tasks.filter(t=>t.enabled).length,color:"#00B42A",bg:"#E8FFEA",Icon:Power},
    {label:"执行中",value:tasks.filter(t=>t.lastStatus==="running").length,color:T.primary,bg:"#E8F3FF",Icon:Activity},
    {label:"最近失败",value:tasks.filter(t=>t.lastStatus==="failed").length,color:"#F53F3F",bg:"#FFE8E8",Icon:AlertTriangle},
  ];

  const doToggle=(task:AutoTask)=>{
    setTasks(p=>p.map(t=>t.id===task.id?{...t,enabled:!t.enabled}:t));
    if(selectedTask?.id===task.id)setSelectedTask(p=>p?{...p,enabled:!p.enabled}:null);
    setConfirmToggle(null);
  };
  const doDelete=(task:AutoTask)=>{
    setTasks(p=>p.filter(t=>t.id!==task.id));
    if(selectedTask?.id===task.id)setSelectedTask(null);
    setConfirmDelete(null);
  };
  const doSave=(t:AutoTask)=>{
    if(editingTask)setTasks(p=>p.map(x=>x.id===editingTask.id?t:x));
    else setTasks(p=>[t,...p]);
    setShowCreate(false);setEditingTask(null);
  };

  return(
    <div className="flex-1 flex overflow-hidden" style={{backgroundColor:T.bg}}>
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 bg-white px-5 flex items-center" style={{borderBottom:`1px solid ${T.border}`,height:44}}>
          <span className="text-[13px] font-semibold border-b-2 h-full flex items-center" style={{color:TASK_COLOR,borderColor:TASK_COLOR}}>任务列表</span>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {statCards.map(({label,value,color,bg,Icon},i)=>(
              <div key={i} className="bg-white rounded-xl p-4 flex items-center gap-3" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:bg}}>
                  <Icon size={16} style={{color}}/>
                </div>
                <div>
                  <div className="text-[22px] font-bold leading-none" style={{color}}>{value}</div>
                  <div className="text-[12px] mt-1" style={{color:T.t3}}>{label}</div>
                </div>
              </div>
            ))}
          </div>
          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Inp placeholder="搜索任务名称" prefix={<Search size={12}/>} width={220} value={search} onChange={setSearch}/>
            <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:120}} value={filterType} onChange={e=>setFilterType(e.target.value)}>
              <option value="all">全部类型</option><option value="api-scenario">接口场景</option><option value="api-suite">接口套件</option>
              <option value="webui-case">Web UI 用例</option><option value="webui-suite">Web UI 套件</option>
            </select>
            <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:110}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
              <option value="all">全部状态</option><option value="enabled">已启用</option><option value="disabled">已停用</option>
            </select>
            <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:110}} value={filterResult} onChange={e=>setFilterResult(e.target.value)}>
              <option value="all">全部结果</option><option value="passed">通过</option><option value="failed">失败</option>
              <option value="running">执行中</option><option value="never">从未执行</option>
            </select>
            <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:110}} value={filterEnv} onChange={e=>setFilterEnv(e.target.value)}>
              <option value="all">全部环境</option><option value="测试环境">测试环境</option><option value="预发布">预发布</option><option value="生产环境">生产环境</option>
            </select>
            <div className="flex-1"/>
            <PBtn icon={Plus} color={TASK_COLOR} onClick={()=>{setEditingTask(null);setShowCreate(true);}}>新建任务</PBtn>
          </div>
          {/* Table or empty */}
          {filtered.length===0?(
            <div className="bg-white rounded-xl flex flex-col items-center justify-center py-20" style={{border:`1px solid ${T.border}`}}>
              <div className="w-14 h-14 rounded-2xl mb-4 flex items-center justify-center" style={{backgroundColor:"#FEF3C7"}}><Timer size={26} style={{color:TASK_COLOR}}/></div>
              <p className="text-[15px] font-medium" style={{color:T.t2}}>暂无匹配的自动化任务</p>
              <p className="text-[13px] mt-1.5 mb-5" style={{color:T.t3}}>尝试调整筛选条件，或新建一个任务</p>
              <PBtn color={TASK_COLOR} icon={Plus} onClick={()=>setShowCreate(true)}>新建任务</PBtn>
            </div>
          ):(
            <ETable total={filtered.length} cols={[
              {label:"任务名称",width:"22%"},{label:"类型",width:"9%"},{label:"环境",width:"8%"},
              {label:"调度方式",width:"13%"},{label:"启用",width:"5%",align:"center"},
              {label:"最近结果",width:"9%"},{label:"最近执行时间",width:"12%"},
              {label:"耗时",width:"6%"},{label:"创建人",width:"7%"},{label:"操作",width:"9%",align:"center"},
            ]}>
              {filtered.map(task=>{
                const s=task.lastStatus?TASK_EXEC_STYLE[task.lastStatus]:null;
                return(
                  <TR key={task.id} active={selectedTask?.id===task.id} onClick={()=>{setSelectedTask(task);setDetailTab("info");}}>
                    <TD>
                      <div className="font-medium text-[13px]" style={{color:T.t1}}>{task.name}</div>
                      {task.desc&&<div className="text-[11px] mt-0.5 truncate max-w-[240px]" style={{color:T.t3}}>{task.desc}</div>}
                    </TD>
                    <TD><span className="px-1.5 py-0.5 rounded text-[11px] font-medium whitespace-nowrap" style={{backgroundColor:TASK_TYPE_BG[task.type],color:TASK_TYPE_COLOR[task.type]}}>{TASK_TYPE_LABELS[task.type]}</span></TD>
                    <TD><span className="text-[12px]" style={{color:T.t2}}>{task.env}</span></TD>
                    <TD>
                      <div className="flex items-center gap-1.5">
                        {task.trigger==="cron"?<Timer size={12} style={{color:TASK_COLOR,flexShrink:0}}/>:<Play size={12} style={{color:T.t3,flexShrink:0}}/>}
                        <div>
                          <div className="text-[12px]" style={{color:T.t1}}>{task.trigger==="cron"?"定时":"手动"}</div>
                          {task.cronDesc&&<div className="text-[11px]" style={{color:T.t3}}>{task.cronDesc}</div>}
                        </div>
                      </div>
                    </TD>
                    <TD align="center"><Toggle on={task.enabled} onChange={()=>setConfirmToggle(task)}/></TD>
                    <TD>
                      {s?(
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] whitespace-nowrap" style={{backgroundColor:s.bg,color:s.color}}>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0${task.lastStatus==="running"?" animate-pulse":""}`} style={{backgroundColor:s.dot}}/>{s.label}
                        </span>
                      ):<span style={{color:T.t4}}>—</span>}
                    </TD>
                    <TD muted><span className="font-mono text-[12px]">{task.lastAt??"—"}</span></TD>
                    <TD><span className="font-mono text-[12px]" style={{color:T.t2}}>{task.lastDur??"—"}</span></TD>
                    <TD muted>{task.creator}</TD>
                    <TD align="center">
                      <div className="flex items-center justify-center gap-0.5">
                        <IBtn icon={Play} label="立即执行" onClick={()=>{}}/>
                        <IBtn icon={Eye} label="查看详情" onClick={()=>{setSelectedTask(task);setDetailTab("history");}}/>
                        <IBtn icon={Edit2} label="编辑" onClick={()=>{setEditingTask(task);setShowCreate(true);}}/>
                        <IBtn icon={Trash2} label="删除" danger onClick={()=>setConfirmDelete(task)}/>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </ETable>
          )}
        </div>
      </div>

      {/* Detail side drawer */}
      {selectedTask&&(
        <div className="flex-shrink-0 flex flex-col bg-white" style={{width:660,borderLeft:`1px solid ${T.border}`}}>
          <div className="flex items-start justify-between px-5 py-3.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
            <div className="flex-1 min-w-0 mr-3">
              <div className="text-[14px] font-semibold leading-snug" style={{color:T.t1}}>{selectedTask.name}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="px-2 py-0.5 rounded text-[11px]" style={{backgroundColor:TASK_TYPE_BG[selectedTask.type],color:TASK_TYPE_COLOR[selectedTask.type]}}>{TASK_TYPE_LABELS[selectedTask.type]}</span>
                <StatusDot status={selectedTask.enabled?"enabled":"disabled"}/>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <PBtn icon={Play} small color={TASK_COLOR} onClick={()=>{}}>立即执行</PBtn>
              <IBtn icon={Edit2} label="编辑" onClick={()=>{setEditingTask(selectedTask);setShowCreate(true);}}/>
              <IBtn icon={X} label="关闭" onClick={()=>setSelectedTask(null)}/>
            </div>
          </div>
          <div className="flex-shrink-0 flex px-5" style={{borderBottom:`1px solid ${T.border}`}}>
            {(["info","history","ai"] as const).map(tab=>{
              const l={info:"基本信息",history:"执行历史",ai:"AI 分析"};
              return<button key={tab} onClick={()=>setDetailTab(tab)}
                className="h-10 px-1 mr-5 text-[13px] border-b-2 transition-colors"
                style={{borderColor:detailTab===tab?TASK_COLOR:"transparent",color:detailTab===tab?TASK_COLOR:T.t2,fontWeight:detailTab===tab?600:400}}>
                {l[tab]}
              </button>;
            })}
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {detailTab==="info"&&<TaskDetailInfo task={selectedTask}/>}
            {detailTab==="history"&&<TaskDetailHistory/>}
            {detailTab==="ai"&&<TaskDetailAI task={selectedTask}/>}
          </div>
        </div>
      )}

      {/* Create/Edit overlay */}
      {showCreate&&(
        <>
          <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={()=>setShowCreate(false)}/>
          <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white" style={{width:560,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
            <TaskCreateDrawer task={editingTask} onClose={()=>{setShowCreate(false);setEditingTask(null);}} onSave={doSave}/>
          </div>
        </>
      )}

      {/* Toggle confirm */}
      {confirmToggle&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.28)"}}>
          <div className="bg-white rounded-2xl p-6 w-[380px]" style={{boxShadow:"0 20px 60px rgba(0,0,0,0.16)"}}>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{backgroundColor:confirmToggle.enabled?"#FFF3E8":"#E8FFEA"}}>
                <Power size={18} style={{color:confirmToggle.enabled?"#FF7D00":"#00B42A"}}/>
              </div>
              <div>
                <div className="text-[15px] font-semibold mb-1" style={{color:T.t1}}>{confirmToggle.enabled?"停用任务":"启用任务"}</div>
                <div className="text-[13px]" style={{color:T.t3}}>
                  {confirmToggle.enabled?`停用后「${confirmToggle.name}」将不再按计划调度执行。`:`启用后「${confirmToggle.name}」将恢复按计划调度执行。`}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <PBtn variant="ghost" onClick={()=>setConfirmToggle(null)}>取消</PBtn>
              <PBtn color={confirmToggle.enabled?"#FF7D00":"#00B42A"} onClick={()=>doToggle(confirmToggle)}>{confirmToggle.enabled?"确认停用":"确认启用"}</PBtn>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.28)"}}>
          <div className="bg-white rounded-2xl p-6 w-[400px]" style={{boxShadow:"0 20px 60px rgba(0,0,0,0.16)"}}>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{backgroundColor:"#FFE8E8"}}>
                <Trash2 size={18} style={{color:"#F53F3F"}}/>
              </div>
              <div>
                <div className="text-[15px] font-semibold mb-1" style={{color:T.t1}}>删除任务</div>
                <div className="text-[13px]" style={{color:T.t3}}>确认删除「{confirmDelete.name}」？删除后该任务及其执行历史将无法恢复。</div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <PBtn variant="ghost" onClick={()=>setConfirmDelete(null)}>取消</PBtn>
              <PBtn color="#F53F3F" onClick={()=>doDelete(confirmDelete)}>确认删除</PBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
