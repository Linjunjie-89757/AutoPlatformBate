import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Edit2, Trash2, X, Save, Search, Server,
  CheckCircle, AlertTriangle, Clock, Eye, Power, RefreshCw,
  Wifi, WifiOff, Activity, FileText, Terminal, ChevronRight,
  Play, Shield, Globe2, Camera, Upload, Download, Copy, Check,
  Loader, Link, Monitor,
} from "lucide-react";

// ─── Palette ──────────────────────────────────────────────────────────────────
const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  border:"#E5E6EB",  bg:"#F4F6FA",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};
const RC = "#0284C7";

// ─── Types ────────────────────────────────────────────────────────────────────
type RunnerStatus = "online"|"offline"|"busy"|"disabled";
type RunnerCap    = "api"|"webui"|"recording"|"screenshot"|"upload";
type BrowserCap   = "chrome"|"edge"|"firefox";
type TaskType     = "接口场景"|"接口套件"|"Web UI 用例"|"Web UI 套件"|"录制任务";
type TaskStatus   = "running"|"passed"|"failed"|"aborted";
type DlPlatform   = "linux"|"macos"|"windows";
type DlArch       = "amd64"|"arm64";
type DlState      = "idle"|"downloading"|"done"|"error";
type RegStep      = "select"|"generating"|"code"|"waiting"|"success"|"error";
type RegErrorKind = "expired"|"timeout"|"incompatible"|"failed";

interface Runner {
  id:string; name:string; host:string; port:number; version:string;
  status:RunnerStatus; maxConcurrent:number;
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

// ─── Status / capability config ───────────────────────────────────────────────
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

// ─── Download config ──────────────────────────────────────────────────────────
const DL_VERSIONS = [
  {ver:"2.4.1",badge:"推荐"},
  {ver:"2.4.0",badge:""},
  {ver:"2.3.8",badge:"旧版"},
];
const DL_SIZES:Record<DlPlatform,Record<DlArch,string>> = {
  linux:   {amd64:"47.3 MB", arm64:"44.8 MB"},
  macos:   {amd64:"52.1 MB", arm64:"49.6 MB"},
  windows: {amd64:"55.4 MB", arm64:"—"},
};
const DL_FILENAMES:Record<DlPlatform,Record<DlArch,(v:string)=>string>> = {
  linux:   {amd64:(v)=>`autotest-runner-${v}-linux-amd64.tar.gz`,  arm64:(v)=>`autotest-runner-${v}-linux-arm64.tar.gz`},
  macos:   {amd64:(v)=>`autotest-runner-${v}-darwin-amd64.tar.gz`, arm64:(v)=>`autotest-runner-${v}-darwin-arm64.tar.gz`},
  windows: {amd64:(v)=>`autotest-runner-${v}-windows-amd64.zip`,   arm64:()=>"—"},
};
const DL_INSTRUCTIONS:Record<DlPlatform,(v:string,a:DlArch)=>string[]> = {
  linux: (v,a)=>[
    `# 1. 解压`,
    `tar -xzf autotest-runner-${v}-linux-${a}.tar.gz`,
    ``,
    `# 2. 授予执行权限`,
    `chmod +x autotest-runner`,
    ``,
    `# 3. 启动（启动后使用"注册节点"完成注册）`,
    `./autotest-runner start`,
  ],
  macos: (v,a)=>[
    `# 1. 解压`,
    `tar -xzf autotest-runner-${v}-darwin-${a}.tar.gz`,
    ``,
    `# 2. 授予执行权限`,
    `chmod +x autotest-runner`,
    `# macOS 首次运行可能需要在「系统设置 → 隐私与安全性」中允许`,
    ``,
    `# 3. 启动`,
    `./autotest-runner start`,
  ],
  windows: (v,_a)=>[
    `# 解压 zip 文件后，在命令行中执行：`,
    ``,
    `autotest-runner-${v}-windows-amd64.exe start`,
    ``,
    `# 或双击 autotest-runner.exe 直接启动`,
  ],
};

// ─── Registration error config ────────────────────────────────────────────────
const REG_ERRORS:Record<RegErrorKind,{title:string;desc:string;action:string}> = {
  expired:      {title:"注册码已过期",  desc:"注册码的有效期（5 分钟）已结束，请重新生成。",              action:"重新生成"},
  timeout:      {title:"等待连接超时",  desc:"Runner 未在限定时间内连接，请确认 Runner 已正常启动。",      action:"重试"},
  incompatible: {title:"版本不兼容",    desc:"Runner 版本过低（检测到 v2.2.x），平台要求 v2.3.0 及以上。", action:"下载最新版"},
  failed:       {title:"连接失败",      desc:"Runner 无法连接到平台，请检查网络及防火墙配置。",            action:"重试"},
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const INIT_RUNNERS:Runner[] = [
  {id:"r1",name:"runner-prod-01",host:"10.0.1.101",port:9000,version:"2.4.1",status:"busy",maxConcurrent:4,caps:["api","webui","screenshot"],browsers:["chrome","edge"],currentTask:"订单接口回归-全量",currentTaskId:"T001",lastHeartbeat:"5 秒前",cpu:68,memory:72,disk:34,todayRuns:24,todayPassed:22,todayFailed:2,note:"主力执行节点"},
  {id:"r2",name:"runner-prod-02",host:"10.0.1.102",port:9000,version:"2.4.1",status:"online",maxConcurrent:4,caps:["api"],browsers:["chrome"],currentTask:null,currentTaskId:null,lastHeartbeat:"12 秒前",cpu:14,memory:31,disk:28,todayRuns:18,todayPassed:18,todayFailed:0,note:""},
  {id:"r3",name:"runner-test-01",host:"10.0.2.201",port:9000,version:"2.3.8",status:"offline",maxConcurrent:2,caps:["api","webui"],browsers:["chrome","firefox"],currentTask:null,currentTaskId:null,lastHeartbeat:"2 小时前",cpu:0,memory:0,disk:41,todayRuns:0,todayPassed:0,todayFailed:0,note:"版本过旧，建议升级"},
  {id:"r4",name:"runner-test-02",host:"10.0.2.202",port:9000,version:"2.4.1",status:"busy",maxConcurrent:3,caps:["api","webui","recording","screenshot","upload"],browsers:["chrome","edge","firefox"],currentTask:"Web UI 登录注册回归",currentTaskId:"T003",lastHeartbeat:"8 秒前",cpu:87,memory:79,disk:55,todayRuns:31,todayPassed:28,todayFailed:3,note:""},
  {id:"r5",name:"runner-dev-01",host:"10.0.3.101",port:9000,version:"2.4.0",status:"disabled",maxConcurrent:1,caps:["api"],browsers:["chrome"],currentTask:null,currentTaskId:null,lastHeartbeat:"1 天前",cpu:0,memory:0,disk:22,todayRuns:0,todayPassed:0,todayFailed:0,note:"联调专用，长期禁用"},
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
function CodeBlock({lines}:{lines:string[]}){
  const[copied,setCopied]=useState(false);
  const text=lines.join("\n");
  const copy=()=>{
    navigator.clipboard.writeText(text).catch(()=>{});
    setCopied(true);
    setTimeout(()=>setCopied(false),2000);
  };
  return(
    <div className="relative rounded-lg overflow-hidden" style={{backgroundColor:"#1A1D2E",border:"1px solid #2D3148"}}>
      <button onClick={copy} className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-all" style={{backgroundColor:copied?"#00B42A22":"#FFFFFF15",color:copied?T.success:"#9CA3AF"}}>
        {copied?<Check size={11}/>:<Copy size={11}/>}
        {copied?"已复制":"复制"}
      </button>
      <pre className="p-4 text-[12px] font-mono overflow-x-auto" style={{color:"#E2E8F0",lineHeight:1.7,margin:0}}>
        {lines.map((l,i)=>(
          <div key={i}>
            {l.startsWith("#")?<span style={{color:"#6B7280"}}>{l}</span>:l===""?<span>&nbsp;</span>:<span style={{color:"#E2E8F0"}}>{l}</span>}
          </div>
        ))}
      </pre>
    </div>
  );
}

// ─── Download Drawer ──────────────────────────────────────────────────────────
function DownloadDrawer({onClose}:{onClose:()=>void}){
  const[selVer,setSelVer]=useState("2.4.1");
  const[platform,setPlatform]=useState<DlPlatform>("linux");
  const[arch,setArch]=useState<DlArch>("amd64");
  const[dlState,setDlState]=useState<DlState>("idle");
  const[dlProgress,setDlProgress]=useState(0);
  const timerRef=useRef<ReturnType<typeof setInterval>|null>(null);

  const filename=DL_FILENAMES[platform][arch](selVer);
  const size=DL_SIZES[platform][arch];
  const unavailable=filename==="—"||size==="—";

  const startDownload=()=>{
    if(unavailable)return;
    setDlState("downloading");
    setDlProgress(0);
    let p=0;
    timerRef.current=setInterval(()=>{
      p+=Math.random()*18+4;
      if(p>=100){
        clearInterval(timerRef.current!);
        setDlProgress(100);
        if(Math.random()<0.1){setDlState("error");}
        else{setDlState("done");}
        return;
      }
      setDlProgress(p);
    },200);
  };
  const cancelDownload=()=>{
    if(timerRef.current)clearInterval(timerRef.current);
    setDlState("idle");setDlProgress(0);
  };
  useEffect(()=>()=>{if(timerRef.current)clearInterval(timerRef.current);},[]);

  const instructions=DL_INSTRUCTIONS[platform](selVer,arch);
  const platTabs:Array<{key:DlPlatform;label:string}> = [{key:"linux",label:"Linux"},{key:"macos",label:"macOS"},{key:"windows",label:"Windows"}];

  return(
    <>
      <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={onClose}/>
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white" style={{width:560,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div>
            <div className="text-[15px] font-semibold" style={{color:T.t1}}>下载 Runner</div>
            <div className="text-[12px] mt-0.5" style={{color:T.t3}}>选择适合您运行环境的 Runner 安装包</div>
          </div>
          <IBtn icon={X} label="关闭" onClick={onClose}/>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Version */}
          <div>
            <div className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>版本</div>
            <div className="flex gap-2">
              {DL_VERSIONS.map(({ver,badge})=>(
                <button key={ver} onClick={()=>{setSelVer(ver);setDlState("idle");setDlProgress(0);}}
                  className="flex-1 flex flex-col items-center py-2.5 rounded-lg border transition-all"
                  style={{borderColor:selVer===ver?RC:T.border,backgroundColor:selVer===ver?"#E0F2FE":"#fff"}}>
                  <span className="text-[13px] font-semibold font-mono" style={{color:selVer===ver?RC:T.t1}}>v{ver}</span>
                  {badge&&<span className="text-[10px] px-1.5 py-0.5 rounded mt-1" style={{backgroundColor:ver==="2.4.1"?"#E8FFEA":"#F2F3F5",color:ver==="2.4.1"?T.success:T.t3}}>{badge}</span>}
                </button>
              ))}
            </div>
          </div>
          {/* Platform tabs */}
          <div>
            <div className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>操作系统</div>
            <div className="flex rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}>
              {platTabs.map(({key,label},i)=>(
                <button key={key} onClick={()=>{setPlatform(key);setDlState("idle");setDlProgress(0);setArch("amd64");}}
                  className="flex-1 flex items-center justify-center py-2 text-[13px] transition-all"
                  style={{borderLeft:i>0?`1px solid ${T.border}`:"none",backgroundColor:platform===key?RC:"#fff",color:platform===key?"#fff":T.t2,fontWeight:platform===key?600:400}}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Arch */}
          <div>
            <div className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>处理器架构</div>
            <div className="flex gap-2">
              {(["amd64","arm64"] as DlArch[]).map(a=>{
                const unavail=DL_SIZES[platform][a]==="—";
                return(
                  <button key={a} onClick={()=>{if(!unavail){setArch(a);setDlState("idle");setDlProgress(0);}}}
                    disabled={unavail}
                    className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all"
                    style={{borderColor:arch===a&&!unavail?RC:T.border,backgroundColor:arch===a&&!unavail?"#E0F2FE":"#fff",opacity:unavail?.4:1,cursor:unavail?"not-allowed":"pointer"}}>
                    <span className="text-[13px] font-mono font-semibold" style={{color:arch===a&&!unavail?RC:T.t1}}>{a}</span>
                    <span className="text-[11px]" style={{color:T.t3}}>{DL_SIZES[platform][a]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* File + download */}
          <div className="rounded-xl p-4" style={{border:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:"#E0F2FE"}}>
                <Download size={16} style={{color:RC}}/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate" style={{color:T.t1}}>{unavailable?"该架构暂无安装包":filename}</div>
                <div className="text-[11px] mt-0.5" style={{color:T.t3}}>{unavailable?"—":size}</div>
              </div>
            </div>
            {dlState==="idle"&&<RBtn color={RC} icon={Download} disabled={unavailable} onClick={startDownload}>{unavailable?"暂不支持":"下载安装包"}</RBtn>}
            {dlState==="downloading"&&(
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px]" style={{color:T.t2}}>正在下载…</span>
                  <span className="text-[12px] font-mono" style={{color:T.t2}}>{Math.round(dlProgress)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden mb-2.5" style={{backgroundColor:"#E5E6EB"}}>
                  <div className="h-1.5 rounded-full transition-all" style={{width:`${dlProgress}%`,backgroundColor:RC}}/>
                </div>
                <button onClick={cancelDownload} className="text-[12px]" style={{color:T.t3}}>取消</button>
              </div>
            )}
            {dlState==="done"&&(
              <div className="flex items-center gap-2">
                <CheckCircle size={15} color={T.success}/>
                <span className="text-[13px]" style={{color:T.success}}>下载完成</span>
                <button onClick={()=>setDlState("idle")} className="ml-auto text-[12px]" style={{color:T.t3}}>重新下载</button>
              </div>
            )}
            {dlState==="error"&&(
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={13} color={T.danger}/>
                  <span className="text-[12px]" style={{color:T.danger}}>下载失败，请检查网络连接后重试</span>
                </div>
                <RBtn ghost small onClick={()=>{setDlState("idle");setDlProgress(0);}}>重试</RBtn>
              </div>
            )}
          </div>
          {/* Install instructions */}
          <div>
            <div className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>安装与启动</div>
            <CodeBlock lines={instructions}/>
          </div>
          <div className="rounded-lg px-3 py-2.5 flex gap-2" style={{backgroundColor:"#E0F2FE",border:`1px solid ${RC}30`}}>
            <Shield size={13} style={{color:RC,flexShrink:0,marginTop:1}}/>
            <span className="text-[12px]" style={{color:RC,lineHeight:1.6}}>Runner 启动后，前往「注册节点」生成一次性注册码，完成节点与平台的绑定。</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Register Drawer ──────────────────────────────────────────────────────────
function RegisterDrawer({onClose,onRegister}:{onClose:()=>void;onRegister:(r:Runner)=>void}){
  const[step,setStep]=useState<RegStep>("select");
  const[regCode,setRegCode]=useState("");
  const[countdown,setCountdown]=useState(300);
  const[waitElapsed,setWaitElapsed]=useState(0);
  const[errorKind,setErrorKind]=useState<RegErrorKind|null>(null);
  const[copiedCode,setCopiedCode]=useState(false);
  const[registeredRunner,setRegisteredRunner]=useState<Runner|null>(null);
  const countdownRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const waitRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const waitTimeoutRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const PLATFORM_URL="https://autotest.example.com";

  const stopTimers=()=>{
    if(countdownRef.current)clearInterval(countdownRef.current);
    if(waitRef.current)clearInterval(waitRef.current);
    if(waitTimeoutRef.current)clearTimeout(waitTimeoutRef.current);
  };
  useEffect(()=>()=>stopTimers(),[]);

  const generateCode=()=>{
    setStep("generating");
    setTimeout(()=>{
      const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const rnd=()=>Array.from({length:4},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
      setRegCode(`${rnd()}-${rnd()}-${rnd()}-${rnd()}`);
      setCountdown(300);
      setStep("code");
      countdownRef.current=setInterval(()=>{
        setCountdown(c=>{if(c<=1){clearInterval(countdownRef.current!);return 0;}return c-1;});
      },1000);
    },1400);
  };

  const startWaiting=()=>{
    setStep("waiting");
    setWaitElapsed(0);
    waitRef.current=setInterval(()=>setWaitElapsed(e=>e+1),1000);
    const ERRORS:RegErrorKind[]=["timeout","failed","incompatible","expired"];
    const willError=Math.random()<0.25;
    waitTimeoutRef.current=setTimeout(()=>{
      clearInterval(waitRef.current!);
      if(willError){
        setErrorKind(ERRORS[Math.floor(Math.random()*ERRORS.length)]);
        setStep("error");
      } else {
        const r:Runner={
          id:`r${Date.now()}`,
          name:`runner-${Math.floor(Math.random()*90+10)}`,
          host:"auto-registered",port:9000,version:"2.4.1",status:"online",
          maxConcurrent:4,caps:["api","webui","screenshot"],
          browsers:["chrome"],currentTask:null,currentTaskId:null,
          lastHeartbeat:"刚刚",cpu:5,memory:12,disk:28,
          todayRuns:0,todayPassed:0,todayFailed:0,note:"",
        };
        setRegisteredRunner(r);
        setStep("success");
      }
    },3200);
  };

  const cancelWaiting=()=>{stopTimers();setStep("code");};
  const retry=()=>{
    stopTimers();
    if(errorKind==="expired"||errorKind==="incompatible"){setStep("select");setRegCode("");}
    else{startWaiting();}
  };
  const copyCode=()=>{
    navigator.clipboard.writeText(regCode).catch(()=>{});
    setCopiedCode(true);
    setTimeout(()=>setCopiedCode(false),2000);
  };
  const fmt=(s:number)=>`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;

  const stepOrder:RegStep[]=["select","generating","code","waiting"];
  const stepLabels=[{key:"select",label:"确认信息"},{key:"code",label:"获取注册码"},{key:"waiting",label:"等待连接"}];

  const isDone=(key:string)=>
    (key==="select"&&(step==="generating"||step==="code"||step==="waiting"||step==="success"||step==="error"))||
    (key==="code"&&(step==="waiting"||step==="success"||step==="error"));
  const isActive=(key:string)=>
    (key==="select"&&step==="select")||
    (key==="code"&&(step==="code"||step==="generating"))||
    (key==="waiting"&&(step==="waiting"||step==="success"||step==="error"));

  const registerCmd=[
    `./autotest-runner register \\`,
    `  --server ${PLATFORM_URL} \\`,
    `  --code   ${regCode||"<注册码>"}`,
  ];

  return(
    <>
      <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={onClose}/>
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white" style={{width:540,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div>
            <div className="text-[15px] font-semibold" style={{color:T.t1}}>注册 Runner 节点</div>
            <div className="text-[12px] mt-0.5" style={{color:T.t3}}>Runner 客户端通过注册码主动连接并绑定平台</div>
          </div>
          <IBtn icon={X} label="关闭" onClick={onClose}/>
        </div>
        {/* Step bar */}
        <div className="flex-shrink-0 px-5 py-3 flex items-center" style={{borderBottom:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
          {stepLabels.map(({key,label},i)=>(
            <React.Fragment key={key}>
              {i>0&&<div className="flex-1 h-px mx-2" style={{backgroundColor:isDone(stepLabels[i-1].key)?RC:T.border}}/>}
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{backgroundColor:isDone(key)?RC:isActive(key)?`${RC}20`:"#F2F3F5",color:isDone(key)?"#fff":isActive(key)?RC:T.t4}}>
                  {isDone(key)?<Check size={10}/>:i+1}
                </div>
                <span className="text-[12px]" style={{color:isDone(key)||isActive(key)?RC:T.t4,fontWeight:isDone(key)||isActive(key)?600:400}}>{label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          {/* Step: select */}
          {step==="select"&&(
            <>
              <div className="rounded-xl p-4 flex gap-3" style={{backgroundColor:"#E0F2FE",border:`1px solid ${RC}25`}}>
                <Shield size={16} style={{color:RC,flexShrink:0,marginTop:1}}/>
                <div className="text-[13px]" style={{color:RC,lineHeight:1.65}}>注册码是一次性凭证（有效期 5 分钟），Runner 使用注册码主动发起连接，无需在平台手动填写节点地址或 Token。</div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{color:T.t2}}>平台地址</label>
                <div className="h-9 px-3 rounded-lg border flex items-center gap-2" style={{borderColor:T.border,backgroundColor:"#FAFAFA"}}>
                  <Link size={12} style={{color:T.t4}}/>
                  <span className="text-[13px] font-mono" style={{color:T.t2}}>{PLATFORM_URL}</span>
                </div>
                <p className="text-[11px] mt-1.5" style={{color:T.t3}}>Runner 将连接到此地址，请确保网络可达。</p>
              </div>
              <RBtn color={RC} onClick={generateCode}>生成注册码</RBtn>
            </>
          )}

          {/* Step: generating */}
          {step==="generating"&&(
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{backgroundColor:"#E0F2FE"}}>
                <Loader size={22} style={{color:RC}} className="animate-spin"/>
              </div>
              <div className="text-center">
                <div className="text-[14px] font-medium" style={{color:T.t1}}>正在生成注册码…</div>
                <div className="text-[12px] mt-1" style={{color:T.t3}}>请稍候</div>
              </div>
            </div>
          )}

          {/* Step: code */}
          {step==="code"&&(
            <>
              <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{backgroundColor:countdown<60?"#FFF3E8":"#E8FFEA",border:`1px solid ${countdown<60?T.warning:T.success}30`}}>
                <div className="flex items-center gap-1.5">
                  <Clock size={13} style={{color:countdown<60?T.warning:T.success}}/>
                  <span className="text-[12px]" style={{color:countdown<60?T.warning:T.success}}>注册码有效期</span>
                </div>
                <span className="text-[13px] font-bold font-mono" style={{color:countdown<60?T.danger:T.success}}>{fmt(countdown)}</span>
              </div>
              <div>
                <div className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>注册码</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center justify-center py-3.5 rounded-xl" style={{backgroundColor:"#1A1D2E",border:"1px solid #2D3148"}}>
                    <span className="text-[22px] font-bold font-mono tracking-[0.15em]" style={{color:"#60A5FA"}}>{regCode}</span>
                  </div>
                  <button onClick={copyCode} className="w-10 h-10 flex items-center justify-center rounded-lg border transition-all flex-shrink-0"
                    style={{borderColor:copiedCode?T.success:T.border,backgroundColor:copiedCode?"#E8FFEA":"#fff",color:copiedCode?T.success:T.t3}}>
                    {copiedCode?<Check size={15}/>:<Copy size={15}/>}
                  </button>
                </div>
              </div>
              <div>
                <div className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>平台地址</div>
                <div className="flex items-center gap-2 h-8 px-3 rounded-lg border" style={{borderColor:T.border,backgroundColor:"#FAFAFA"}}>
                  <Link size={12} style={{color:T.t4}}/>
                  <span className="text-[12px] font-mono flex-1" style={{color:T.t2}}>{PLATFORM_URL}</span>
                </div>
              </div>
              <div>
                <div className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>在 Runner 机器上执行</div>
                <CodeBlock lines={registerCmd}/>
              </div>
              <div className="rounded-lg px-3 py-2.5 flex gap-2" style={{backgroundColor:"#FFFBEB",border:`1px solid ${T.warning}30`}}>
                <AlertTriangle size={13} style={{color:T.warning,flexShrink:0,marginTop:1}}/>
                <span className="text-[12px]" style={{color:T.warning,lineHeight:1.6}}>注册码仅能使用一次，请勿分享给他人。有效期结束后需重新生成。</span>
              </div>
              <RBtn color={RC} onClick={startWaiting} disabled={countdown===0}>
                {countdown===0?"注册码已过期，请重新生成":"我已启动 Runner，开始等待连接"}
              </RBtn>
              {countdown===0&&<button onClick={()=>{stopTimers();setStep("select");setRegCode("");}} className="text-[13px] text-center" style={{color:RC}}>重新生成注册码</button>}
            </>
          )}

          {/* Step: waiting */}
          {step==="waiting"&&(
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{backgroundColor:"#E0F2FE"}}>
                <Loader size={26} style={{color:RC}} className="animate-spin"/>
              </div>
              <div className="text-center">
                <div className="text-[15px] font-semibold" style={{color:T.t1}}>正在等待 Runner 连接…</div>
                <div className="text-[12px] mt-1" style={{color:T.t3}}>已等待 {waitElapsed} 秒 · 最长等待 60 秒</div>
              </div>
              <div className="w-full px-4 py-3 rounded-xl flex flex-col gap-2" style={{backgroundColor:"#FAFAFA",border:`1px solid ${T.border}`}}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:T.success}}/>
                  <span className="text-[12px]" style={{color:T.t2}}>注册码已生成：<span className="font-mono font-semibold" style={{color:RC}}>{regCode}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{backgroundColor:RC}}/>
                  <span className="text-[12px]" style={{color:T.t2}}>等待 Runner 发起连接</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:T.border}}/>
                  <span className="text-[12px]" style={{color:T.t4}}>校验版本与能力</span>
                </div>
              </div>
              <button onClick={cancelWaiting} className="text-[13px]" style={{color:T.t3}}>取消</button>
            </div>
          )}

          {/* Step: success */}
          {step==="success"&&registeredRunner&&(
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{backgroundColor:"#E8FFEA"}}>
                  <CheckCircle size={28} style={{color:T.success}}/>
                </div>
                <div className="text-center">
                  <div className="text-[16px] font-semibold" style={{color:T.t1}}>注册成功</div>
                  <div className="text-[13px] mt-1" style={{color:T.t3}}>Runner 已连接并完成注册</div>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
                {[
                  ["节点名称",registeredRunner.name],
                  ["Runner 版本",`v${registeredRunner.version}`],
                  ["操作系统","Linux / Ubuntu 22.04 LTS"],
                  ["最大并发",`${registeredRunner.maxConcurrent} 个任务`],
                  ["执行能力",registeredRunner.caps.map(c=>CAP_CFG[c].label).join("、")],
                  ["浏览器",registeredRunner.browsers.map(b=>BROWSER_CFG[b].label).join("、")],
                  ["最后心跳",registeredRunner.lastHeartbeat],
                ].map(([k,v],i)=>(
                  <div key={i} className="flex items-start px-4 py-2.5" style={{backgroundColor:i%2===0?"#FAFAFA":"#fff",borderTop:i>0?`1px solid ${T.border}`:"none"}}>
                    <span className="w-20 flex-shrink-0 text-[12px] pt-0.5" style={{color:T.t3}}>{k}</span>
                    <span className="flex-1 text-[13px]" style={{color:T.t1}}>{v}</span>
                  </div>
                ))}
              </div>
              <RBtn color={RC} onClick={()=>{onRegister(registeredRunner);onClose();}}>完成</RBtn>
            </div>
          )}

          {/* Step: error */}
          {step==="error"&&errorKind&&(
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{backgroundColor:"#FFE8E8"}}>
                  <AlertTriangle size={28} style={{color:T.danger}}/>
                </div>
                <div className="text-center">
                  <div className="text-[16px] font-semibold" style={{color:T.t1}}>{REG_ERRORS[errorKind].title}</div>
                  <div className="text-[13px] mt-2 max-w-xs" style={{color:T.t3,lineHeight:1.6}}>{REG_ERRORS[errorKind].desc}</div>
                </div>
              </div>
              <div className="rounded-xl p-4 flex flex-col gap-2.5" style={{border:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] w-16 flex-shrink-0" style={{color:T.t3}}>注册码</span>
                  <span className="text-[12px] font-mono" style={{color:T.t2}}>{regCode}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <RBtn ghost onClick={()=>{stopTimers();setStep("select");setRegCode("");}}>重新开始</RBtn>
                <RBtn color={RC} onClick={retry}>{REG_ERRORS[errorKind].action}</RBtn>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Edit drawer (edit existing runners only) ─────────────────────────────────
function EditDrawer({runner,onClose,onSave}:{runner:Runner;onClose:()=>void;onSave:(r:Runner)=>void}){
  const[name,setName]=useState(runner.name);
  const[maxC,setMaxC]=useState(runner.maxConcurrent);
  const[caps,setCaps]=useState<RunnerCap[]>(runner.caps);
  const[enabled,setEnabled]=useState(runner.status!=="disabled");
  const[note,setNote]=useState(runner.note??"");
  const toggleCap=(c:RunnerCap)=>setCaps(p=>p.includes(c)?p.filter(x=>x!==c):[...p,c]);

  return(
    <>
      <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={onClose}/>
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white" style={{width:520,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div>
            <div className="text-[15px] font-semibold" style={{color:T.t1}}>编辑 Runner 节点</div>
            <div className="text-[12px] mt-0.5" style={{color:T.t3}}>修改节点配置与执行能力</div>
          </div>
          <IBtn icon={X} label="关闭" onClick={onClose}/>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>节点名称</label>
            <SInp placeholder="例：runner-prod-01" value={name} onChange={setName}/>
            <p className="text-[11px] mt-1" style={{color:T.t3}}>节点名称由 Runner 客户端注册时自动上报，修改仅影响平台展示。</p>
          </div>
          <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
            {[["节点地址",`${runner.host}:${runner.port}`],["Runner 版本",`v${runner.version}`]].map(([k,v],i)=>(
              <div key={i} className="flex items-center px-4 py-2.5" style={{backgroundColor:i%2===0?"#FAFAFA":"#fff",borderTop:i>0?`1px solid ${T.border}`:"none"}}>
                <span className="w-24 flex-shrink-0 text-[12px]" style={{color:T.t3}}>{k}</span>
                <span className="flex-1 text-[13px] font-mono" style={{color:T.t2}}>{v}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#F2F3F5",color:T.t4}}>只读</span>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>最大并发数</label>
            <input type="number" value={maxC} onChange={e=>setMaxC(Number(e.target.value))} min={1} max={8} className="h-8 w-full border rounded-lg px-3 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}/>
          </div>
          <div className="h-px" style={{backgroundColor:T.border}}/>
          <div>
            <div className="text-[12px] font-semibold mb-2.5" style={{color:T.t3}}>执行能力（可手动调整）</div>
            <div className="flex flex-col gap-2">
              {(Object.keys(CAP_CFG) as RunnerCap[]).map(cap=>{
                const cfg=CAP_CFG[cap];const on=caps.includes(cap);
                return<label key={cap} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all" style={{borderColor:on?RC:T.border,backgroundColor:on?"#E0F2FE":"#fff"}}>
                  <input type="checkbox" checked={on} onChange={()=>toggleCap(cap)} className="w-4 h-4" style={{accentColor:RC}}/>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:cfg.bg}}><cfg.icon size={13} style={{color:cfg.color}}/></div>
                  <span className="text-[13px]" style={{color:on?RC:T.t1}}>{cfg.label}</span>
                </label>;
              })}
            </div>
          </div>
          <div className="h-px" style={{backgroundColor:T.border}}/>
          <div className="flex items-center justify-between p-3.5 rounded-xl" style={{border:`1px solid ${T.border}`}}>
            <div>
              <div className="text-[13px] font-medium" style={{color:T.t1}}>启用节点</div>
              <div className="text-[12px] mt-0.5" style={{color:T.t3}}>停用后该节点不会被分配任何执行任务</div>
            </div>
            <Toggle on={enabled} onChange={setEnabled}/>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>备注</label>
            <textarea placeholder="可选" value={note} onChange={e=>setNote(e.target.value)} className="w-full h-14 border rounded-lg px-3 py-2 text-[13px] outline-none resize-none" style={{borderColor:T.border,color:T.t1}}/>
          </div>
        </div>
        <div className="flex-shrink-0 flex justify-end gap-2 px-5 py-3.5" style={{borderTop:`1px solid ${T.border}`}}>
          <RBtn ghost onClick={onClose}>取消</RBtn>
          <RBtn color={RC} icon={Save} onClick={()=>onSave({...runner,name:name||runner.name,maxConcurrent:maxC,caps,status:enabled?(runner.status==="disabled"?"online":runner.status):"disabled",note})}>保存修改</RBtn>
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
        <div className="flex items-start justify-between px-6 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{backgroundColor:s.bg}}><s.icon size={16} style={{color:s.color}}/></div>
              <div className="text-[15px] font-semibold" style={{color:T.t1}}>{runner.name}</div>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{backgroundColor:s.bg,color:s.color}}>{s.label}</span>
              {runner.cpu>=85&&<span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{backgroundColor:"#FFE8E8",color:T.danger}}><AlertTriangle size={9}/>资源告警</span>}
            </div>
            <div className="text-[12px] font-mono" style={{color:T.t3}}>{runner.host}:{runner.port} · v{runner.version}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <RBtn icon={RefreshCw} small ghost onClick={onRestart}>重启</RBtn>
            <RBtn icon={Power} small color={runner.status==="disabled"?T.success:T.warning} onClick={onToggle}>{runner.status==="disabled"?"启用":"禁用"}</RBtn>
            <IBtn icon={X} label="关闭" onClick={onClose}/>
          </div>
        </div>
        <div className="flex-shrink-0 flex px-6" style={{borderBottom:`1px solid ${T.border}`}}>
          {(["info","tasks","logs"] as const).map(tab=>{
            const l={info:"基本信息",tasks:"任务记录",logs:"异常日志"};
            return<button key={tab} onClick={()=>setDetailTab(tab)} className="h-10 px-1 mr-5 text-[13px] border-b-2 transition-colors"
              style={{borderColor:detailTab===tab?RC:"transparent",color:detailTab===tab?RC:T.t2,fontWeight:detailTab===tab?600:400}}>
              {l[tab]}
            </button>;
          })}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {detailTab==="info"&&(
            <div className="flex flex-col gap-5">
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
              <div className="rounded-xl p-4" style={{border:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
                <div className="text-[12px] font-semibold mb-3" style={{color:T.t3}}>资源占用</div>
                <div className="flex flex-col gap-3">
                  <ResourceBar label="CPU" value={runner.cpu} warn={70} danger={85}/>
                  <ResourceBar label="内存" value={runner.memory} warn={75} danger={90}/>
                  <ResourceBar label="磁盘" value={runner.disk} warn={70} danger={85}/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {label:"今日执行",value:runner.todayRuns,color:T.t1,bg:"#F2F3F5"},
                  {label:"通过",value:runner.todayPassed,color:T.success,bg:"#E8FFEA"},
                  {label:"失败",value:runner.todayFailed,color:runner.todayFailed>0?T.danger:T.t4,bg:runner.todayFailed>0?"#FFE8E8":"#F2F3F5"},
                ].map((st,i)=>(
                  <div key={i} className="bg-white rounded-xl p-3 text-center" style={{border:`1px solid ${T.border}`}}>
                    <div className="text-[22px] font-bold" style={{color:st.color}}>{st.value}</div>
                    <div className="text-[11px] mt-0.5" style={{color:T.t3}}>{st.label}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[12px] font-semibold mb-2.5" style={{color:T.t3}}>执行能力</div>
                <div className="flex flex-wrap gap-2">
                  {runner.caps.map(cap=>{const cfg=CAP_CFG[cap];return<span key={cap} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px]" style={{backgroundColor:cfg.bg,color:cfg.color}}><cfg.icon size={11}/>{cfg.label}</span>;})}
                  {runner.browsers.map(b=>{const cfg=BROWSER_CFG[b];return<span key={b} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px]" style={{backgroundColor:"#F2F3F5",color:cfg.color}}><Globe2 size={11}/>{cfg.label}</span>;})}
                </div>
              </div>
              <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
                {[
                  ["节点地址",`${runner.host}:${runner.port}`],
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
                        <td className="px-3 py-2"><div className="flex gap-0.5"><IBtn icon={FileText} label="查看报告" onClick={()=>{}}/><IBtn icon={Terminal} label="查看日志" onClick={()=>{}}/></div></td>
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
                <div className="flex flex-col items-center py-16"><CheckCircle size={28} color={T.t4} className="mb-2"/><p className="text-[13px]" style={{color:T.t3}}>暂无异常日志</p></div>
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
  const[showDownload,setShowDownload]=useState(false);
  const[showRegister,setShowRegister]=useState(false);
  const[editRunner,setEditRunner]=useState<Runner|null>(null);
  const[detailRunner,setDetailRunner]=useState<Runner|null>(null);
  const[delConfirm,setDelConfirm]=useState<Runner|null>(null);

  const filtered=runners.filter(r=>{
    if(search&&!r.name.includes(search)&&!r.host.includes(search))return false;
    if(filterStatus!=="all"&&r.status!==filterStatus)return false;
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
  const doSave=(r:Runner)=>{setRunners(p=>p.map(x=>x.id===r.id?r:x));setEditRunner(null);};
  const doRegister=(r:Runner)=>setRunners(p=>[...p,r]);

  return(
    <div className="flex-1 flex overflow-hidden" style={{backgroundColor:T.bg}}>
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
            <div className="flex-1"/>
            <RBtn ghost icon={Download} onClick={()=>setShowDownload(true)}>下载 Runner</RBtn>
            <RBtn ghost icon={RefreshCw} onClick={()=>{}}>刷新</RBtn>
            <RBtn icon={Plus} color={RC} onClick={()=>setShowRegister(true)}>注册节点</RBtn>
          </div>
          {/* Table */}
          {filtered.length===0?(
            <div className="bg-white rounded-2xl flex flex-col items-center justify-center py-20" style={{border:`1px solid ${T.border}`}}>
              <Server size={32} color={T.t4} className="mb-3"/>
              <p className="text-[14px] font-medium" style={{color:T.t2}}>暂无 Runner 节点</p>
              <p className="text-[12px] mt-1.5 mb-5" style={{color:T.t3}}>注册执行节点以开始运行自动化任务</p>
              <div className="flex gap-2">
                <RBtn ghost icon={Download} onClick={()=>setShowDownload(true)}>下载 Runner</RBtn>
                <RBtn icon={Plus} color={RC} onClick={()=>setShowRegister(true)}>注册节点</RBtn>
              </div>
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
                    const cpuHigh=r.cpu>=85;const memHigh=r.memory>=85;
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
                            <IBtn icon={Edit2} label="编辑" onClick={()=>setEditRunner(r)}/>
                            <IBtn icon={Power} label={r.status==="disabled"?"启用":"禁用"} onClick={()=>doToggle(r)}/>
                            <IBtn icon={Trash2} label="删除" danger onClick={()=>setDelConfirm(r)}/>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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

      {detailRunner&&<DetailDrawer runner={detailRunner} onClose={()=>setDetailRunner(null)} onToggle={()=>{doToggle(detailRunner);setDetailRunner(p=>p?{...p,status:p.status==="disabled"?"online":"disabled"}:null);}} onRestart={()=>{}}/>}
      {editRunner&&<EditDrawer runner={editRunner} onClose={()=>setEditRunner(null)} onSave={doSave}/>}
      {showDownload&&<DownloadDrawer onClose={()=>setShowDownload(false)}/>}
      {showRegister&&<RegisterDrawer onClose={()=>setShowRegister(false)} onRegister={doRegister}/>}

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
