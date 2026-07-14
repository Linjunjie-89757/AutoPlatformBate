import React, { useState } from "react";
import {
  Plus, Edit2, Trash2, X, Save, Search, Server, Cpu,
  CheckCircle, AlertTriangle, Clock, Eye, Power, RefreshCw,
  Wifi, WifiOff, Activity, FileText, Terminal, ChevronRight,
  Play, Shield, Globe2, Camera, Upload,
} from "lucide-react";

// ─── Palette ──────────────────────────────────────────────────────────────────
const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  border:"#E5E6EB",  bg:"#F4F6FA",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};
const RC = "#0284C7"; // runner module accent (sky-700)

// ─── Types ────────────────────────────────────────────────────────────────────
type RunnerStatus = "online"|"offline"|"busy"|"disabled";
type RunnerCap    = "api"|"webui"|"recording"|"screenshot"|"upload";
type BrowserCap   = "chrome"|"edge"|"firefox";
type TaskType     = "接口场景"|"接口套件"|"Web UI 用例"|"Web UI 套件"|"录制任务";
type TaskStatus   = "running"|"passed"|"failed"|"aborted";

interface Runner {
  id:string; name:string; host:string; port:number; version:string;
  status:RunnerStatus; env:string; maxConcurrent:number;
  caps:RunnerCap[]; browsers:BrowserCap[];
  currentTask:string|null; currentTaskId:string|null;
  lastHeartbeat:string; cpu:number; memory:number; disk:number;
  todayRuns:number; todayPassed:number; todayFailed:number;
  note?:string;
}
interface RunnerTask {
  id:string; type:TaskType; status:TaskStatus;
  startAt:string; duration:string|null; operator:string;
}
interface RunnerError {
  time:string; level:"error"|"warn"; message:string;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG:Record<RunnerStatus,{label:string;color:string;bg:string;dot:string;icon:React.ElementType}> = {
  online:   {label:"在线",  color:T.success, bg:"#E8FFEA",  dot:T.success, icon:Wifi},
  offline:  {label:"离线",  color:T.t3,      bg:"#F2F3F5",  dot:T.t4,      icon:WifiOff},
  busy:     {label:"忙碌",  color:T.warning, bg:"#FFF3E8",  dot:T.warning, icon:Activity},
  disabled: {label:"已禁用",color:T.t4,      bg:"#F2F3F5",  dot:T.t4,      icon:Power},
};

const CAP_CFG:Record<RunnerCap,{label:string;color:string;bg:string;icon:React.ElementType}> = {
  api:        {label:"接口自动化",  color:T.warning, bg:"#FFF3E8", icon:Globe2},
  webui:      {label:"Web UI 自动化",color:RC,       bg:"#E0F2FE", icon:Activity},
  recording:  {label:"浏览器录制",  color:"#8B5CF6", bg:"#F5F0FF", icon:Play},
  screenshot: {label:"截图",        color:T.success, bg:"#E8FFEA", icon:Camera},
  upload:     {label:"文件上传",    color:T.t3,      bg:"#F2F3F5", icon:Upload},
};

const BROWSER_CFG:Record<BrowserCap,{label:string;color:string}> = {
  chrome:  {label:"Chrome",  color:"#4285F4"},
  edge:    {label:"Edge",    color:"#0078D4"},
  firefox: {label:"Firefox", color:"#FF6611"},
};

const TASK_STATUS_CFG:Record<TaskStatus,{label:string;color:string;bg:string}> = {
  running:{label:"执行中",color:T.primary, bg:"#E8F3FF"},
  passed: {label:"通过",  color:T.success, bg:"#E8FFEA"},
  failed: {label:"失败",  color:T.danger,  bg:"#FFE8E8"},
  aborted:{label:"已中止",color:T.t3,      bg:"#F2F3F5"},
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const INIT_RUNNERS:Runner[] = [
  {id:"r1",name:"runner-prod-01",host:"10.0.1.101",port:9000,version:"2.4.1",status:"busy",env:"生产环境",maxConcurrent:4,caps:["api","webui","screenshot"],browsers:["chrome","edge"],currentTask:"订单接口回归-全量",currentTaskId:"T001",lastHeartbeat:"5 秒前",cpu:68,memory:72,disk:34,todayRuns:24,todayPassed:22,todayFailed:2,note:"主力执行节点"},
  {id:"r2",name:"runner-prod-02",host:"10.0.1.102",port:9000,version:"2.4.1",status:"online",env:"生产环境",maxConcurrent:4,caps:["api"],browsers:["chrome"],currentTask:null,currentTaskId:null,lastHeartbeat:"12 秒前",cpu:14,memory:31,disk:28,todayRuns:18,todayPassed:18,todayFailed:0,note:""},
  {id:"r3",name:"runner-test-01",host:"10.0.2.201",port:9000,version:"2.3.8",status:"offline",env:"测试环境",maxConcurrent:2,caps:["api","webui"],browsers:["chrome","firefox"],currentTask:null,currentTaskId:null,lastHeartbeat:"2 小时前",cpu:0,memory:0,disk:41,todayRuns:0,todayPassed:0,todayFailed:0,note:"版本过旧，建议升级"},
  {id:"r4",name:"runner-test-02",host:"10.0.2.202",port:9000,version:"2.4.1",status:"busy",env:"测试环境",maxConcurrent:3,caps:["api","webui","recording","screenshot","upload"],browsers:["chrome","edge","firefox"],currentTask:"Web UI 登录注册回归",currentTaskId:"T003",lastHeartbeat:"8 秒前",cpu:87,memory:79,disk:55,todayRuns:31,todayPassed:28,todayFailed:3,note:""},
  {id:"r5",name:"runner-dev-01",host:"10.0.3.101",port:9000,version:"2.4.0",status:"disabled",env:"开发环境",maxConcurrent:1,caps:["api"],browsers:["chrome"],currentTask:null,currentTaskId:null,lastHeartbeat:"1 天前",cpu:0,memory:0,disk:22,todayRuns:0,todayPassed:0,todayFailed:0,note:"联调专用，长期禁用"},
];

const MOCK_TASKS:RunnerTask[] = [
  {id:"T001",type:"接口套件",status:"running",startAt:"10:30:22",duration:null,operator:"定时任务"},
  {id:"T008",type:"接口场景",status:"passed",startAt:"09:15:01",duration:"4m 32s",operator:"张程远"},
  {id:"T007",type:"Web UI 用例",status:"failed",startAt:"08:00:15",duration:"2m 18s",operator:"定时任务"},
  {id:"T006",type:"接口套件",status:"passed",startAt:"07:30:00",duration:"8m 55s",operator:"定时任务"},
  {id:"T005",type:"Web UI 套件",status:"aborted",startAt:"昨天 23:01",duration:"1m 02s",operator:"李明"},
];

const MOCK_ERRORS:RunnerError[] = [
  {time:"08:00:38",level:"error",message:"Chrome 驱动启动失败：找不到 chromedriver，版本 115.0.5790.98 不兼容"},
  {time:"08:00:15",level:"error",message:"任务 T007 执行超时（300s），强制中止并上报失败"},
  {time:"昨天 22:15",level:"warn",message:"内存使用率超过 80%，建议检查或重启节点"},
  {time:"昨天 21:00",level:"warn",message:"心跳响应延迟 > 5s，网络可能不稳定"},
];

// ─── Local atoms ──────────────────────────────────────────────────────────────
function RBtn({children,onClick,icon:Icon,small,color=T.primary,ghost,disabled}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;ghost?:boolean;disabled?:boolean}){
  if(ghost)return<button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium bg-white" style={{borderColor:T.border,color:T.t2,opacity:disabled?.5:1}}>{Icon&&<Icon size={13}/>}{children}</button>;
  return<button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-all active:scale-[0.98]" style={{backgroundColor:color,color:"#fff",height:small?28:32,padding:small?"0 10px":"0 14px",fontSize:small?12:13,opacity:disabled?.6:1}} onMouseEnter={e=>{if(!disabled)(e.currentTarget as HTMLButtonElement).style.filter="brightness(1.1)";}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.filter=""}}>{Icon&&<Icon size={small?12:13}/>}{children}</button>;
}
function IBtn({icon:Icon,label,danger,onClick}:{icon:React.ElementType;label:string;danger?:boolean;onClick?:()=>void}){
  return<button title={label} onClick={e=>{e.stopPropagation();onClick?.();}} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{color:T.t4}} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color=danger?T.danger:T.t1;(e.currentTarget as HTMLButtonElement).style.backgroundColor=danger?"#FFF0F0":"#F2F3F5";}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color=T.t4;(e.currentTarget as HTMLButtonElement).style.backgroundColor="transparent";}}><Icon size={13}/></button>;
}
function Toggle({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}){
  return<button onClick={()=>onChange(!on)} className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0" style={{backgroundColor:on?T.primary:"#C9CDD4"}}><span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all" style={{left:on?"calc(100% - 14px)":"2px"}}/></button>;
}
function SInp({value,onChange,placeholder,prefix}:{value?:string;onChange?:(v:string)=>void;placeholder?:string;prefix?:React.ReactNode}){
  return<div className="relative flex items-center">{prefix&&<span className="absolute left-2.5 pointer-events-none" style={{color:T.t3}}>{prefix}</span>}<input value={value} onChange={e=>onChange?.(e.target.value)} placeholder={placeholder} className="h-8 w-full border rounded-lg text-[13px] outline-none transition-all" style={{borderColor:T.border,color:T.t1,paddingLeft:prefix?"32px":"12px",paddingRight:"12px"}} onFocus={e=>{e.currentTarget.style.borderColor=RC;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/></div>;
}
function ResourceBar({label,value,warn=70,danger=85}:{label:string;value:number;warn?:number;danger?:number}){
  const color=value>=danger?T.danger:value>=warn?T.warning:T.success;
  return<div>
    <div className="flex items-center justify-between mb-1">
      <span className="text-[11px]" style={{color:T.t3}}>{label}</span>
      <span className="text-[12px] font-semibold font-mono" style={{color}}>{value}%</span>
    </div>
    <div className="h-1.5 rounded-full overflow-hidden" style={{backgroundColor:"#F2F3F5"}}>
      <div className="h-1.5 rounded-full transition-all" style={{width:`${value}%`,backgroundColor:color}}/>
    </div>
  </div>;
}

// ─── Edit drawer ──────────────────────────────────────────────────────────────
function EditDrawer({runner,onClose,onSave}:{runner?:Runner;onClose:()=>void;onSave:(r:Runner)=>void}){
  const[name,setName]=useState(runner?.name??"");
  const[host,setHost]=useState(runner?.host??"");
  const[port,setPort]=useState(runner?.port??9000);
  const[token,setToken]=useState("");
  const[env,setEnv]=useState(runner?.env??"测试环境");
  const[maxC,setMaxC]=useState(runner?.maxConcurrent??2);
  const[caps,setCaps]=useState<RunnerCap[]>(runner?.caps??["api"]);
  const[enabled,setEnabled]=useState(runner?.status!=="disabled");
  const[note,setNote]=useState(runner?.note??"");
  const isEdit=!!runner;
  const toggleCap=(c:RunnerCap)=>setCaps(p=>p.includes(c)?p.filter(x=>x!==c):[...p,c]);

  return(
    <>
      <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={onClose}/>
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white" style={{width:520,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div><div className="text-[15px] font-semibold" style={{color:T.t1}}>{isEdit?"编辑 Runner 节点":"注册 Runner 节点"}</div>
            <div className="text-[12px] mt-0.5" style={{color:T.t3}}>配置执行节点的连接信息和执行能力</div></div>
          <IBtn icon={X} label="关闭" onClick={onClose}/>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>节点名称 <span style={{color:T.danger}}>*</span></label>
            <SInp placeholder="例：runner-prod-01" value={name} onChange={setName}/></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2"><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>Host / IP <span style={{color:T.danger}}>*</span></label>
              <SInp placeholder="10.0.1.101" value={host} onChange={setHost}/></div>
            <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>端口</label>
              <input type="number" value={port} onChange={e=>setPort(Number(e.target.value))} className="h-8 w-full border rounded-lg px-3 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}/></div>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>节点 Token</label>
            <input type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder={isEdit?"已配置，输入新 Token 以替换":"输入连接 Token"} className="h-8 w-full border rounded-lg px-3 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}/>
            <p className="text-[11px] mt-1" style={{color:T.t3}}>Token 加密存储，用于平台与节点之间的身份校验</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>所属环境</label>
              <select className="w-full h-8 border rounded-lg px-2.5 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} value={env} onChange={e=>setEnv(e.target.value)}>
                <option>生产环境</option><option>测试环境</option><option>预发布</option><option>开发环境</option>
              </select></div>
            <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>最大并发数</label>
              <input type="number" value={maxC} onChange={e=>setMaxC(Number(e.target.value))} min={1} max={8} className="h-8 w-full border rounded-lg px-3 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}/></div>
          </div>
          <div className="h-px" style={{backgroundColor:T.border}}/>
          <div>
            <div className="text-[12px] font-semibold mb-2.5" style={{color:T.t3}}>执行能力</div>
            <div className="flex flex-col gap-2">
              {(Object.keys(CAP_CFG) as RunnerCap[]).map(cap=>{
                const cfg=CAP_CFG[cap]; const on=caps.includes(cap);
                return<label key={cap} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all"
                  style={{borderColor:on?RC:T.border,backgroundColor:on?"#E0F2FE":"#fff"}}>
                  <input type="checkbox" checked={on} onChange={()=>toggleCap(cap)} className="w-4 h-4" style={{accentColor:RC}}/>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:cfg.bg}}>
                    <cfg.icon size={13} style={{color:cfg.color}}/>
                  </div>
                  <span className="text-[13px]" style={{color:on?RC:T.t1}}>{cfg.label}</span>
                </label>;
              })}
            </div>
          </div>
          <div className="h-px" style={{backgroundColor:T.border}}/>
          <div className="flex items-center justify-between p-3.5 rounded-xl" style={{border:`1px solid ${T.border}`}}>
            <div><div className="text-[13px] font-medium" style={{color:T.t1}}>启用节点</div>
              <div className="text-[12px] mt-0.5" style={{color:T.t3}}>停用后该节点不会被分配任何执行任务</div></div>
            <Toggle on={enabled} onChange={setEnabled}/>
          </div>
          <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>备注</label>
            <textarea placeholder="可选" value={note} onChange={e=>setNote(e.target.value)} className="w-full h-14 border rounded-lg px-3 py-2 text-[13px] outline-none resize-none" style={{borderColor:T.border,color:T.t1}}/></div>
        </div>
        <div className="flex-shrink-0 flex justify-end gap-2 px-5 py-3.5" style={{borderTop:`1px solid ${T.border}`}}>
          <RBtn ghost onClick={onClose}>取消</RBtn>
          <RBtn color={RC} icon={Save} onClick={()=>onSave({id:runner?.id??`r${Date.now()}`,name:name||"新节点",host,port,version:runner?.version??"2.4.1",status:enabled?"online":"disabled",env,maxConcurrent:maxC,caps,browsers:runner?.browsers??["chrome"],currentTask:null,currentTaskId:null,lastHeartbeat:"刚刚",cpu:0,memory:0,disk:0,todayRuns:0,todayPassed:0,todayFailed:0,note})}>{isEdit?"保存修改":"注册节点"}</RBtn>
        </div>
      </div>
    </>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────
function DetailDrawer({runner,onClose,onToggle,onRestart}:{runner:Runner;onClose:()=>void;onToggle:()=>void;onRestart:()=>void}){
  const[detailTab,setDetailTab]=useState<"info"|"tasks"|"logs">("info");
  const s=STATUS_CFG[runner.status];
  return(
    <>
      <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={onClose}/>
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white" style={{width:700,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{backgroundColor:s.bg}}><s.icon size={16} style={{color:s.color}}/></div>
              <div className="text-[15px] font-semibold" style={{color:T.t1}}>{runner.name}</div>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{backgroundColor:s.bg,color:s.color}}>{s.label}</span>
              {runner.cpu>=85&&<span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{backgroundColor:"#FFE8E8",color:T.danger}}><AlertTriangle size={9}/>资源告警</span>}
            </div>
            <div className="text-[12px] font-mono" style={{color:T.t3}}>{runner.host}:{runner.port} · v{runner.version} · {runner.env}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <RBtn icon={RefreshCw} small ghost onClick={onRestart}>重启</RBtn>
            <RBtn icon={Power} small color={runner.status==="disabled"?T.success:T.warning} onClick={onToggle}>{runner.status==="disabled"?"启用":"禁用"}</RBtn>
            <IBtn icon={X} label="关闭" onClick={onClose}/>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex-shrink-0 flex px-6" style={{borderBottom:`1px solid ${T.border}`}}>
          {(["info","tasks","logs"] as const).map(tab=>{
            const l={info:"基本信息",tasks:"任务记录",logs:"异常日志"};
            return<button key={tab} onClick={()=>setDetailTab(tab)}
              className="h-10 px-1 mr-5 text-[13px] border-b-2 transition-colors"
              style={{borderColor:detailTab===tab?RC:"transparent",color:detailTab===tab?RC:T.t2,fontWeight:detailTab===tab?600:400}}>
              {l[tab]}
            </button>;
          })}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {detailTab==="info"&&(
            <div className="flex flex-col gap-5">
              {/* Current task */}
              {runner.currentTask&&(
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{backgroundColor:"#E0F2FE",border:`1px solid ${RC}30`}}>
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor:RC}}/>
                  <div>
                    <div className="text-[12px]" style={{color:T.t3}}>正在执行</div>
                    <div className="text-[13px] font-medium" style={{color:RC}}>{runner.currentTask}</div>
                  </div>
                  <button className="ml-auto text-[12px] flex items-center gap-1" style={{color:RC}}><ChevronRight size={12}/>查看任务</button>
                </div>
              )}
              {/* Resources */}
              <div className="rounded-xl p-4" style={{border:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
                <div className="text-[12px] font-semibold mb-3" style={{color:T.t3}}>资源占用</div>
                <div className="flex flex-col gap-3">
                  <ResourceBar label="CPU" value={runner.cpu} warn={70} danger={85}/>
                  <ResourceBar label="内存" value={runner.memory} warn={75} danger={90}/>
                  <ResourceBar label="磁盘" value={runner.disk} warn={70} danger={85}/>
                </div>
              </div>
              {/* Today stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:"今日执行",value:runner.todayRuns,color:T.t1,bg:"#F2F3F5"},
                  {label:"通过",value:runner.todayPassed,color:T.success,bg:"#E8FFEA"},
                  {label:"失败",value:runner.todayFailed,color:runner.todayFailed>0?T.danger:T.t4,bg:runner.todayFailed>0?"#FFE8E8":"#F2F3F5"},
                ].map((s,i)=>(
                  <div key={i} className="bg-white rounded-xl p-3 text-center" style={{border:`1px solid ${T.border}`}}>
                    <div className="text-[22px] font-bold" style={{color:s.color}}>{s.value}</div>
                    <div className="text-[11px] mt-0.5" style={{color:T.t3}}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Capabilities */}
              <div>
                <div className="text-[12px] font-semibold mb-2.5" style={{color:T.t3}}>执行能力</div>
                <div className="flex flex-wrap gap-2">
                  {runner.caps.map(cap=>{
                    const cfg=CAP_CFG[cap];
                    return<span key={cap} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px]" style={{backgroundColor:cfg.bg,color:cfg.color}}>
                      <cfg.icon size={11}/>{cfg.label}
                    </span>;
                  })}
                  {runner.browsers.map(b=>{
                    const cfg=BROWSER_CFG[b];
                    return<span key={b} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px]" style={{backgroundColor:"#F2F3F5",color:cfg.color}}>
                      <Globe2 size={11}/>{cfg.label}
                    </span>;
                  })}
                </div>
              </div>
              {/* Info rows */}
              <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
                {[
                  ["节点地址",`${runner.host}:${runner.port}`],
                  ["所属环境",runner.env],
                  ["版本",`v${runner.version}`],
                  ["最后心跳",runner.lastHeartbeat],
                  ["最大并发",`${runner.maxConcurrent} 个任务`],
                  ...(runner.note?[["备注",runner.note]]:[]),
                ].map(([k,v],i)=>(
                  <div key={i} className="flex items-center px-4 py-2.5" style={{backgroundColor:i%2===0?"#FAFAFA":"#fff",borderTop:i>0?`1px solid ${T.border}`:"none"}}>
                    <span className="w-20 flex-shrink-0 text-[12px]" style={{color:T.t3}}>{k}</span>
                    <span className="flex-1 text-[13px] font-mono" style={{color:T.t2}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {detailTab==="tasks"&&(
            <div>
              <p className="text-[12px] mb-4" style={{color:T.t3}}>最近 10 条任务执行记录</p>
              <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
                <table className="w-full border-collapse">
                  <thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                    {["任务 ID","类型","状态","开始时间","耗时","执行人","操作"].map((h,i)=>(
                      <th key={i} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-left" style={{color:T.t3}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {MOCK_TASKS.map(t=>{
                      const sc=TASK_STATUS_CFG[t.status];
                      return<tr key={t.id} className="border-b last:border-0" style={{borderColor:T.border,height:44}}>
                        <td className="px-3 py-2 text-[12px] font-mono" style={{color:T.primary}}>{t.id}</td>
                        <td className="px-3 py-2 text-[12px]" style={{color:T.t2}}>{t.type}</td>
                        <td className="px-3 py-2"><span className="text-[11px] px-1.5 py-0.5 rounded" style={{backgroundColor:sc.bg,color:sc.color}}>{sc.label}</span></td>
                        <td className="px-3 py-2 text-[12px] font-mono" style={{color:T.t3}}>{t.startAt}</td>
                        <td className="px-3 py-2 text-[12px] font-mono" style={{color:T.t2}}>{t.duration??<span style={{color:T.t4}}>—</span>}</td>
                        <td className="px-3 py-2 text-[12px]" style={{color:T.t2}}>{t.operator}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-0.5">
                            <IBtn icon={FileText} label="查看报告" onClick={()=>{}}/>
                            <IBtn icon={Terminal} label="查看日志" onClick={()=>{}}/>
                          </div>
                        </td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {detailTab==="logs"&&(
            <div>
              <p className="text-[12px] mb-4" style={{color:T.t3}}>最近异常日志（最多展示 50 条）</p>
              {MOCK_ERRORS.length===0?(
                <div className="flex flex-col items-center py-16">
                  <CheckCircle size={28} color={T.t4} className="mb-2"/>
                  <p className="text-[13px]" style={{color:T.t3}}>暂无异常日志</p>
                </div>
              ):(
                <div className="flex flex-col gap-2">
                  {MOCK_ERRORS.map((e,i)=>(
                    <div key={i} className="flex gap-3 p-3 rounded-xl" style={{backgroundColor:e.level==="error"?"#FFF0F0":"#FFFBEB",border:`1px solid ${e.level==="error"?"#FFCCC7":"#FDE68A"}`}}>
                      <AlertTriangle size={14} color={e.level==="error"?T.danger:T.warning} style={{flexShrink:0,marginTop:2}}/>
                      <div>
                        <div className="text-[12px] font-mono mb-0.5" style={{color:e.level==="error"?T.danger:T.warning}}>{e.time}</div>
                        <div className="text-[12px]" style={{color:T.t1}}>{e.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function RunnerModule(){
  const[runners,setRunners]=useState<Runner[]>(INIT_RUNNERS);
  const[search,setSearch]=useState("");
  const[filterStatus,setFilterStatus]=useState("all");
  const[filterEnv,setFilterEnv]=useState("all");
  const[showEdit,setShowEdit]=useState(false);
  const[editRunner,setEditRunner]=useState<Runner|null>(null);
  const[detailRunner,setDetailRunner]=useState<Runner|null>(null);
  const[delConfirm,setDelConfirm]=useState<Runner|null>(null);

  const filtered=runners.filter(r=>{
    if(search&&!r.name.includes(search)&&!r.host.includes(search))return false;
    if(filterStatus!=="all"&&r.status!==filterStatus)return false;
    if(filterEnv!=="all"&&r.env!==filterEnv)return false;
    return true;
  });

  const statCards=[
    {label:"节点总数",value:runners.length,color:T.t2,bg:"#F2F3F5"},
    {label:"在线",value:runners.filter(r=>r.status==="online").length,color:T.success,bg:"#E8FFEA"},
    {label:"忙碌",value:runners.filter(r=>r.status==="busy").length,color:T.warning,bg:"#FFF3E8"},
    {label:"离线",value:runners.filter(r=>r.status==="offline").length,color:T.danger,bg:"#FFE8E8"},
    {label:"当前任务数",value:runners.filter(r=>r.currentTask).length,color:RC,bg:"#E0F2FE"},
    {label:"今日执行",value:runners.reduce((s,r)=>s+r.todayRuns,0),color:T.t2,bg:"#F2F3F5"},
  ];

  const doToggle=(r:Runner)=>setRunners(p=>p.map(x=>x.id===r.id?{...x,status:x.status==="disabled"?"online":"disabled"}:x));
  const doDelete=(r:Runner)=>{setRunners(p=>p.filter(x=>x.id!==r.id));setDelConfirm(null);if(detailRunner?.id===r.id)setDetailRunner(null);};
  const doSave=(r:Runner)=>{if(editRunner)setRunners(p=>p.map(x=>x.id===editRunner.id?r:x));else setRunners(p=>[...p,r]);setShowEdit(false);setEditRunner(null);};

  return(
    <div className="flex-1 flex overflow-hidden" style={{backgroundColor:T.bg}}>
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 bg-white px-5 flex items-center" style={{borderBottom:`1px solid ${T.border}`,height:44}}>
          <span className="text-[13px] font-semibold border-b-2 h-full flex items-center" style={{color:RC,borderColor:RC}}>Runner 节点</span>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {/* Stats */}
          <div className="grid grid-cols-6 gap-3 mb-5">
            {statCards.map(({label,value,color,bg},i)=>(
              <div key={i} className="bg-white rounded-xl p-3.5 flex items-center gap-2.5" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:bg}}>
                  <span className="text-[16px] font-bold" style={{color}}>{value}</span>
                </div>
                <span className="text-[11px] leading-tight" style={{color:T.t3}}>{label}</span>
              </div>
            ))}
          </div>
          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-4">
            <SInp placeholder="搜索节点名称或 IP" prefix={<Search size={12}/>} value={search} onChange={setSearch}/>
            <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:120}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
              <option value="all">全部状态</option><option value="online">在线</option><option value="busy">忙碌</option><option value="offline">离线</option><option value="disabled">已禁用</option>
            </select>
            <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:120}} value={filterEnv} onChange={e=>setFilterEnv(e.target.value)}>
              <option value="all">全部环境</option><option value="生产环境">生产环境</option><option value="测试环境">测试环境</option><option value="预发布">预发布</option><option value="开发环境">开发环境</option>
            </select>
            <div className="flex-1"/>
            <RBtn ghost icon={RefreshCw} onClick={()=>{}}>刷新</RBtn>
            <RBtn icon={Plus} color={RC} onClick={()=>{setEditRunner(null);setShowEdit(true);}}>注册节点</RBtn>
          </div>
          {/* Table */}
          {filtered.length===0?(
            <div className="bg-white rounded-2xl flex flex-col items-center justify-center py-20" style={{border:`1px solid ${T.border}`}}>
              <Server size={32} color={T.t4} className="mb-3"/>
              <p className="text-[14px] font-medium" style={{color:T.t2}}>暂无 Runner 节点</p>
              <p className="text-[12px] mt-1.5 mb-5" style={{color:T.t3}}>注册执行节点以开始运行自动化任务</p>
              <RBtn icon={Plus} color={RC} onClick={()=>setShowEdit(true)}>注册节点</RBtn>
            </div>
          ):(
            <div className="bg-white rounded-2xl overflow-hidden" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
              <table className="w-full border-collapse">
                <thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                  {["节点","地址","状态","当前任务","执行能力","浏览器","版本","心跳","CPU/内存","操作"].map((h,i)=>(
                    <th key={i} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-left" style={{color:T.t3}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filtered.map(r=>{
                    const s=STATUS_CFG[r.status];
                    const cpuHigh=r.cpu>=85; const memHigh=r.memory>=85;
                    return(
                      <tr key={r.id} className="border-b last:border-0 cursor-pointer" style={{borderColor:T.border,height:56}} onClick={()=>setDetailRunner(r)} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#FAFBFF"} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:s.bg}}><s.icon size={13} style={{color:s.color}}/></div>
                            <div>
                              <div className="text-[13px] font-medium" style={{color:T.t1}}>{r.name}</div>
                              {r.note&&<div className="text-[10px]" style={{color:T.t4}}>{r.note}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[11px] font-mono" style={{color:T.t3}}>{r.host}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{backgroundColor:s.bg,color:s.color}}>
                            <span className={`w-1.5 h-1.5 rounded-full${r.status==="busy"?" animate-pulse":""}`} style={{backgroundColor:s.dot}}/>
                            {s.label}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {r.currentTask?(
                            <div className="max-w-[140px]">
                              <div className="text-[11px] truncate" style={{color:RC}}>{r.currentTask}</div>
                              <div className="text-[10px]" style={{color:T.t4}}>{r.currentTaskId}</div>
                            </div>
                          ):<span style={{color:T.t4,fontSize:11}}>空闲</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {r.caps.slice(0,3).map(cap=><span key={cap} className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:CAP_CFG[cap].bg,color:CAP_CFG[cap].color}}>{CAP_CFG[cap].label.replace("自动化","").trim()}</span>)}
                            {r.caps.length>3&&<span className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#F2F3F5",color:T.t3}}>+{r.caps.length-3}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            {r.browsers.map(b=><span key={b} className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{backgroundColor:"#F2F3F5",color:BROWSER_CFG[b].color}}>{b[0].toUpperCase()}</span>)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[11px] font-mono" style={{color:T.t3}}>v{r.version}</td>
                        <td className="px-3 py-2 text-[11px]" style={{color:r.status==="offline"?T.danger:T.t3}}>{r.lastHeartbeat}</td>
                        <td className="px-3 py-2">
                          {r.status==="online"||r.status==="busy"?(
                            <div className="flex flex-col gap-1 w-20">
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{backgroundColor:"#F2F3F5"}}><div className="h-1 rounded-full" style={{width:`${r.cpu}%`,backgroundColor:cpuHigh?T.danger:T.success}}/></div>
                                <span className="text-[10px] font-mono w-7 text-right" style={{color:cpuHigh?T.danger:T.t3}}>{r.cpu}%</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{backgroundColor:"#F2F3F5"}}><div className="h-1 rounded-full" style={{width:`${r.memory}%`,backgroundColor:memHigh?T.danger:T.warning}}/></div>
                                <span className="text-[10px] font-mono w-7 text-right" style={{color:memHigh?T.danger:T.t3}}>{r.memory}%</span>
                              </div>
                            </div>
                          ):<span style={{color:T.t4,fontSize:11}}>—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-0.5">
                            <IBtn icon={Eye} label="查看详情" onClick={()=>setDetailRunner(r)}/>
                            <IBtn icon={Edit2} label="编辑" onClick={()=>{setEditRunner(r);setShowEdit(true);}}/>
                            <IBtn icon={Power} label={r.status==="disabled"?"启用":"禁用"} onClick={()=>doToggle(r)}/>
                            <IBtn icon={Trash2} label="删除" danger onClick={()=>setDelConfirm(r)}/>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Warning strip */}
              {runners.some(r=>r.status==="offline"||r.cpu>=85||r.memory>=85)&&(
                <div className="px-4 py-2.5 flex items-center gap-2" style={{borderTop:`1px solid ${T.border}`,backgroundColor:"#FFFBEB"}}>
                  <AlertTriangle size={13} color={T.warning}/>
                  <span className="text-[12px]" style={{color:T.warning}}>
                    {runners.filter(r=>r.status==="offline").length>0&&`${runners.filter(r=>r.status==="offline").length} 个节点离线　`}
                    {runners.filter(r=>r.cpu>=85||r.memory>=85).length>0&&`${runners.filter(r=>r.cpu>=85||r.memory>=85).length} 个节点资源占用过高`}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detail side panel */}
      {detailRunner&&<DetailDrawer runner={detailRunner} onClose={()=>setDetailRunner(null)} onToggle={()=>{doToggle(detailRunner);setDetailRunner(p=>p?{...p,status:p.status==="disabled"?"online":"disabled"}:null);}} onRestart={()=>{}}/>}

      {/* Edit drawer */}
      {(showEdit||editRunner)&&<EditDrawer runner={editRunner??undefined} onClose={()=>{setShowEdit(false);setEditRunner(null);}} onSave={doSave}/>}

      {/* Delete confirm */}
      {delConfirm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.28)"}}>
          <div className="bg-white rounded-2xl p-6 w-[400px]" style={{boxShadow:"0 20px 60px rgba(0,0,0,0.16)"}}>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{backgroundColor:"#FFE8E8"}}><Trash2 size={18} color={T.danger}/></div>
              <div><div className="text-[15px] font-semibold mb-1" style={{color:T.t1}}>删除节点</div>
                <div className="text-[13px]" style={{color:T.t3}}>确认删除「{delConfirm.name}」？删除后任务调度将不再使用该节点，已执行的历史记录不受影响。</div></div>
            </div>
            <div className="flex justify-end gap-2">
              <RBtn ghost onClick={()=>setDelConfirm(null)}>取消</RBtn>
              <RBtn color={T.danger} onClick={()=>doDelete(delConfirm)}>确认删除</RBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
