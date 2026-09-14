/**
 * ApiAiCaseWorkbench — AI 生成接口用例工作台
 *
 * v2 优化：
 *  - 列精简：# | 名称 | 类型 | 分组 | 运行结果 | 操作
 *  - 操作列改为文字按钮（运行 / 采纳 / 废弃 / 恢复）
 *  - 批量操作移入筛选栏右侧，不再独占一行，避免列表下挤
 *  - 名称仅单行展示，去掉 description 副标题
 */
import React, { useState, useEffect, useRef } from "react";
import {
  X, Bot, Zap, Play, Check, Trash2, Eye,
  Search, RefreshCw, StopCircle, AlertCircle, AlertTriangle,
  CheckCircle, XCircle, Loader2, ChevronDown,
  Clock, Ban, RotateCcw, WifiOff, Lock, FileX,
} from "lucide-react";
import { ApiCaseDrawer } from "./ApiCaseDrawer";
import { ApiAiGenerationDrawer } from "./ApiAiGenerationDrawer";

const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F", purple:"#7816FF",
  bg:"#F4F6FA", border:"#E5E6EB",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};
const METHOD_COLOR: Record<string,string> = {
  GET:"#00B42A", POST:"#FF7D00", PUT:"#165DFF", DELETE:"#F53F3F", PATCH:"#7816FF",
};

// ─── Types ─────────────────────────────────────────────────────────────────────
type TaskStatus = "waiting"|"generating"|"completed"|"partial-fail"|"failed"|"stopped";
type GenStatus  = "generating"|"done"|"failed";
type ProcStatus = "pending"|"adopted"|"discarded";
type RunStatus  = "unrun"|"running"|"passed"|"assert-fail"|"request-error";
type ProcTab    = "pending"|"adopted"|"discarded";

interface RunResult { statusCode:number; duration:number; passCount:number; failCount:number; }
interface CandidateCase {
  id:string; name:string;
  group:"正向"|"负向"|"边界值"|"安全性";
  type:string;
  assertionCount:number;
  genStatus:GenStatus; procStatus:ProcStatus; runStatus:RunStatus;
  runResult?:RunResult;
  level:"P0"|"P1"|"P2"|"P3";
}

type DemoState =
  |"streaming"|"partial"|"completed"|"batch-select"
  |"running"|"run-pass"|"assert-fail"
  |"detail"|"adopt-confirm"|"batch-adopt-confirm"
  |"partial-fail"|"full-fail"|"stopped"
  |"all-done"|"no-results"|"no-permission";

const DEMO_LABELS: Record<DemoState,string> = {
  "streaming":           "① 流式生成",
  "partial":             "② 部分生成",
  "completed":           "③ 完成",
  "batch-select":        "④ 批量选择",
  "running":             "⑤ 运行中",
  "run-pass":            "⑥ 运行通过",
  "assert-fail":         "⑦ 断言失败",
  "detail":              "⑧ 详情",
  "adopt-confirm":       "⑨ 单条采纳",
  "batch-adopt-confirm": "⑩ 批量采纳",
  "partial-fail":        "⑪ 部分失败",
  "full-fail":           "⑫ 整体失败",
  "stopped":             "⑬ 已停止",
  "all-done":            "⑭ 全处理完",
  "no-results":          "⑮ 无结果",
  "no-permission":       "⑯ 无权限",
};

// ─── Mock data ──────────────────────────────────────────────────────────────────
const BASE: CandidateCase[] = [
  { id:"1",  name:"仅传必要字段 — 登录成功返回 token",           group:"正向",  type:"仅传必要字段",       assertionCount:4, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P1" },
  { id:"2",  name:"语义合法 — 正确账号密码登录",                 group:"正向",  type:"语义合法",           assertionCount:3, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P1" },
  { id:"3",  name:"覆盖枚举组合 — 不同账号类型组合",             group:"正向",  type:"覆盖枚举组合",       assertionCount:3, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P2" },
  { id:"4",  name:"其他正向 — 携带可选参数登录",                 group:"正向",  type:"其他正向",           assertionCount:2, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P2" },
  { id:"5",  name:"无效值 — 空字符串账号密码",                   group:"负向",  type:"无效值",             assertionCount:3, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P0" },
  { id:"6",  name:"缺失必填字段 — 缺少 password 字段",           group:"负向",  type:"缺失必填字段",       assertionCount:3, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P0" },
  { id:"7",  name:"格式错误 — 账号非合法邮箱格式",               group:"负向",  type:"格式错误",           assertionCount:2, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P1" },
  { id:"8",  name:"类型错误 — 密码传数字类型",                   group:"负向",  type:"类型错误",           assertionCount:2, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P1" },
  { id:"9",  name:"语义非法 — 正确账号错误密码",                 group:"负向",  type:"语义非法",           assertionCount:3, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P0" },
  { id:"10", name:"其他负向 — 请求体为空 JSON",                  group:"负向",  type:"其他负向",           assertionCount:2, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P1" },
  { id:"11", name:"极大值/极小值 — 超长 username",               group:"边界值",type:"极大值/极小值",      assertionCount:3, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P2" },
  { id:"12", name:"超出最大/最小边界值 — password 超长",         group:"边界值",type:"超出最大/最小边界值", assertionCount:2, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P2" },
  { id:"13", name:"Null/零值/空值 — username 传 null",           group:"边界值",type:"Null/零值/空值",     assertionCount:2, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P1" },
  { id:"14", name:"字符串过长/过短 — 单字符密码",                group:"边界值",type:"字符串过长/过短",    assertionCount:2, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P2" },
  { id:"15", name:"鉴权控制 — 无 token 访问",                    group:"安全性",type:"鉴权控制",           assertionCount:2, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P0" },
  { id:"16", name:"SQL 注入 — username 传注入语句",              group:"安全性",type:"SQL 注入",           assertionCount:3, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P0" },
  { id:"17", name:"XSS 注入 — username 传 script 标签",          group:"安全性",type:"XSS 注入",           assertionCount:2, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P0" },
  { id:"18", name:"模糊输入 — 随机特殊字符组合",                 group:"安全性",type:"模糊输入",           assertionCount:2, genStatus:"done", procStatus:"pending", runStatus:"unrun", level:"P1" },
];

function buildCases(ds: DemoState): CandidateCase[] {
  const b = BASE.map(c=>({...c}));
  if (ds==="streaming") return b.slice(0,5).concat([{...b[5],genStatus:"generating",name:""}]);
  if (ds==="partial")   return b.slice(0,12).concat([{...b[12],genStatus:"generating",name:""}]);
  if (ds==="partial-fail") return b.map((c,i)=>i>=15?{...c,genStatus:"failed" as GenStatus}:c);
  if (ds==="full-fail") return b.slice(0,3).map(c=>({...c,genStatus:"failed" as GenStatus}));
  if (ds==="stopped")   return b.slice(0,10);
  if (ds==="running")   return b.map((c,i)=>i===2?{...c,runStatus:"running" as RunStatus}:c);
  if (ds==="run-pass")  return b.map((c,i)=>
    i<4  ? {...c,runStatus:"passed"      as RunStatus,runResult:{statusCode:200,duration:143+i*22,passCount:c.assertionCount,failCount:0}} :
    i===4? {...c,runStatus:"assert-fail" as RunStatus,runResult:{statusCode:200,duration:211,passCount:1,failCount:2}} :
    i===5? {...c,runStatus:"request-error" as RunStatus,runResult:{statusCode:500,duration:32,passCount:0,failCount:c.assertionCount}} :
    c);
  if (ds==="assert-fail") return b.map((c,i)=>
    i===0? {...c,runStatus:"passed"        as RunStatus,runResult:{statusCode:200,duration:143,passCount:4,failCount:0}} :
    i===1? {...c,runStatus:"assert-fail"   as RunStatus,runResult:{statusCode:200,duration:211,passCount:1,failCount:2}} :
    i===2? {...c,runStatus:"request-error" as RunStatus,runResult:{statusCode:500,duration:32 ,passCount:0,failCount:3}} :
    c);
  if (ds==="all-done")  return b.map((c,i)=>({...c,procStatus:(i%2===0?"adopted":"discarded") as ProcStatus,runStatus:"passed" as RunStatus,runResult:{statusCode:200,duration:160,passCount:c.assertionCount,failCount:0}}));
  if (ds==="batch-select"||ds==="batch-adopt-confirm"||ds==="adopt-confirm"||ds==="detail") return b;
  return b;
}

// ─── Group / level config ───────────────────────────────────────────────────────
const GROUP_CFG: Record<string,{bg:string;color:string}> = {
  "正向":  { bg:`${T.success}12`, color:T.success },
  "负向":  { bg:`${T.warning}12`, color:T.warning },
  "边界值":{ bg:`${T.purple}10`,  color:T.purple  },
  "安全性":{ bg:`${T.danger}10`,  color:T.danger  },
};

// ─── Status cells ───────────────────────────────────────────────────────────────
function RunCell({ s, r }: { s:RunStatus; r?:RunResult }) {
  if (s==="unrun")   return <span style={{color:T.t4,fontSize:12}}>—</span>;
  if (s==="running") return <span style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:T.primary}}><Loader2 size={11} style={{animation:"spin 1s linear infinite"}}/>运行中</span>;
  if (s==="passed")  return <span style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:T.success}}><CheckCircle size={11}/>通过{r&&<span style={{color:T.t3}}>{r.duration}ms</span>}</span>;
  if (s==="assert-fail") return <span style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:T.warning}}><AlertTriangle size={11}/>断言失败{r&&<span style={{color:T.t3}}>{r.failCount}项</span>}</span>;
  return <span style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:T.danger}}><AlertCircle size={11}/>请求异常{r&&<span style={{color:T.t3}}>{r.statusCode}</span>}</span>;
}

// ─── Skeleton row ───────────────────────────────────────────────────────────────
function SkeletonRow({ idx }: { idx:number }) {
  return (
    <tr style={{borderBottom:`1px solid ${T.border}`}}>
      <td style={{width:36,padding:"0 8px",textAlign:"center"}}/>
      <td style={{padding:"10px 8px",width:44,textAlign:"center",color:T.t4,fontSize:12}}>{idx+1}</td>
      <td style={{padding:"10px 12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:200,height:10,borderRadius:3,background:"#EEF0F5",animation:"pulse 1.2s ease-in-out infinite"}}/>
          <span style={{fontSize:11,color:T.primary,display:"flex",alignItems:"center",gap:3}}><Loader2 size={10} style={{animation:"spin 1s linear infinite"}}/>生成中</span>
        </div>
      </td>
      <td style={{padding:"10px 8px"}}><div style={{width:60,height:10,borderRadius:3,background:"#EEF0F5"}}/></td>
      <td style={{padding:"10px 8px"}}><div style={{width:36,height:10,borderRadius:3,background:"#EEF0F5"}}/></td>
      <td style={{padding:"10px 8px"}}/>
      <td style={{padding:"10px 8px"}}/>
    </tr>
  );
}

// ─── Confirm dialog ─────────────────────────────────────────────────────────────
function Confirm({ icon, title, body, confirmLabel, confirmColor, onOk, onCancel, loading }: {
  icon:React.ReactNode; title:string; body:React.ReactNode;
  confirmLabel:string; confirmColor:string;
  onOk:()=>void; onCancel:()=>void; loading?:boolean;
}) {
  return (
    <>
      <div onClick={onCancel} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.22)",zIndex:300}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:301,background:"#fff",borderRadius:10,padding:"22px 26px",width:380,boxShadow:"0 8px 28px rgba(0,0,0,0.14)"}}>
        <div style={{display:"flex",gap:11,alignItems:"flex-start",marginBottom:18}}>
          {icon}
          <div>
            <div style={{fontSize:14,fontWeight:700,color:T.t1,marginBottom:5}}>{title}</div>
            <div style={{fontSize:13,color:T.t2,lineHeight:1.65}}>{body}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onCancel} style={{padding:"6px 16px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>取消</button>
          <button onClick={onOk} disabled={loading}
            style={{display:"flex",alignItems:"center",gap:5,padding:"6px 18px",border:"none",borderRadius:6,background:loading?T.t4:confirmColor,color:"#fff",fontSize:13,fontWeight:500,cursor:loading?"not-allowed":"pointer"}}>
            {loading&&<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>}{confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────
export interface ApiAiCaseWorkbenchProps {
  method?:string; path?:string; endpointName?:string; onClose?:()=>void;
}

export function ApiAiCaseWorkbench({
  method="POST", path="/user-auth/auth/v1/back-unified-login/by-pwd",
  endpointName="登录认证 · 登录", onClose,
}: ApiAiCaseWorkbenchProps) {

  const [demo,       setDemo]       = useState<DemoState>("completed");
  const [cases,      setCases]      = useState<CandidateCase[]>(buildCases("completed"));
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [procTab,    setProcTab]    = useState<ProcTab>("pending");
  const [search,     setSearch]     = useState("");
  const [fGroup,     setFGroup]     = useState("all");
  const [fType,      setFType]      = useState("all");
  const [showDetail, setShowDetail] = useState(false);
  const [confirmType,setConfirmType]= useState<"adopt-single"|"adopt-batch"|"discard-batch"|"stop"|null>(null);
  const [confirmCase,setConfirmCase]= useState<CandidateCase|null>(null);
  const [confirmLoad,setConfirmLoad]= useState(false);
  const [showRegen,  setShowRegen]  = useState(false);

  // Task status derived from demo
  const taskStatus: TaskStatus = (()=>{
    switch(demo){
      case "streaming": case "partial": case "running": return "generating";
      case "partial-fail":  return "partial-fail";
      case "full-fail":     return "failed";
      case "stopped":       return "stopped";
      default:              return "completed";
    }
  })();
  const isGenerating = taskStatus==="generating";

  // Progress animation
  const [progress, setProgress] = useState(0);
  useEffect(()=>{
    if(!isGenerating){setProgress(100);return;}
    let p = demo==="streaming"?20:58;
    setProgress(p);
    const t = setInterval(()=>{ p=Math.min(p+0.35,demo==="streaming"?38:72); setProgress(p); },120);
    return ()=>clearInterval(t);
  },[isGenerating,demo]);

  const switchDemo = (ds: DemoState) => {
    setDemo(ds); setCases(buildCases(ds));
    setSelected(ds==="batch-select"||ds==="batch-adopt-confirm"
      ? new Set(["1","2","3","4","5"]) : new Set());
    setShowDetail(ds==="detail");
    setConfirmType(ds==="adopt-confirm"?"adopt-single":ds==="batch-adopt-confirm"?"adopt-batch":null);
    setConfirmCase(ds==="adopt-confirm"?buildCases("completed")[0]:null);
    setProcTab(ds==="all-done"?"adopted":"pending");
    setFGroup("all"); setFType("all");
    setSearch(ds==="no-results"?"不存在的搜索词xyz":"");
  };

  // Derived counts
  const done      = cases.filter(c=>c.genStatus==="done");
  const failedGen = cases.filter(c=>c.genStatus==="failed");
  const pending   = done.filter(c=>c.procStatus==="pending");
  const adopted   = done.filter(c=>c.procStatus==="adopted");
  const discarded = done.filter(c=>c.procStatus==="discarded");

  // Tab-filtered, then search-filtered
  const tabCases = cases.filter(c=>{
    if(c.genStatus==="generating") return procTab==="pending";
    return c.procStatus===procTab;
  });
  const visible = tabCases.filter(c=>{
    if(search && c.genStatus!=="generating" && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if(fGroup!=="all" && c.group!==fGroup) return false;
    if(fType !=="all" && c.type !==fType)  return false;
    return true;
  });

  // Selection helpers
  const actionable  = visible.filter(c=>c.genStatus==="done");
  const allSel      = actionable.length>0 && actionable.every(c=>selected.has(c.id));
  const someSel     = actionable.some(c=>selected.has(c.id));
  const selCount    = actionable.filter(c=>selected.has(c.id)).length;
  const toggleAll   = ()=>{ const ids=actionable.map(c=>c.id); if(allSel) setSelected(p=>{const n=new Set(p);ids.forEach(id=>n.delete(id));return n;}); else setSelected(p=>{const n=new Set(p);ids.forEach(id=>n.add(id));return n;}); };
  const toggleOne   = (id:string)=>setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});

  // Operations
  const doAdopt   = (c:CandidateCase)=>{setConfirmLoad(true);setTimeout(()=>{setCases(p=>p.map(x=>x.id===c.id?{...x,procStatus:"adopted"}:x));setConfirmType(null);setConfirmCase(null);setConfirmLoad(false);},700);};
  const doDiscard = (id:string)=>setCases(p=>p.map(c=>c.id===id?{...c,procStatus:"discarded"}:c));
  const doRestore = (id:string)=>setCases(p=>p.map(c=>c.id===id?{...c,procStatus:"pending"}:c));
  const doRun     = (id:string)=>{
    setCases(p=>p.map(c=>c.id===id?{...c,runStatus:"running"}:c));
    setTimeout(()=>setCases(p=>p.map(c=>c.id===id?{...c,runStatus:"passed",runResult:{statusCode:200,duration:178,passCount:c.assertionCount,failCount:0}}:c)),1800);
  };
  const doBatchAdopt  =()=>{setConfirmLoad(true);setTimeout(()=>{setCases(p=>p.map(c=>selected.has(c.id)&&c.genStatus==="done"?{...c,procStatus:"adopted"}:c));setSelected(new Set());setConfirmType(null);setConfirmLoad(false);},800);};
  const doBatchDiscard=()=>{setConfirmLoad(true);setTimeout(()=>{setCases(p=>p.map(c=>selected.has(c.id)&&c.genStatus==="done"?{...c,procStatus:"discarded"}:c));setSelected(new Set());setConfirmType(null);setConfirmLoad(false);},700);};

  // Filter dropdown options
  const groups = [...new Set(done.map(c=>c.group))];
  const types  = [...new Set(done.filter(c=>fGroup==="all"||c.group===fGroup).map(c=>c.type))];

  const methodColor = METHOD_COLOR[method]??T.t3;

  // ── Task status config ──
  const TS_CFG: Record<TaskStatus,{label:string;color:string;icon:React.ReactNode}> = {
    waiting:      {label:"等待生成",color:T.t3,   icon:<Clock size={11}/>},
    generating:   {label:"正在生成",color:T.primary,icon:<Loader2 size={11} style={{animation:"spin 1s linear infinite"}}/>},
    completed:    {label:"生成完成",color:T.success,icon:<CheckCircle size={11}/>},
    "partial-fail":{label:"部分失败",color:T.warning,icon:<AlertTriangle size={11}/>},
    failed:       {label:"生成失败",color:T.danger,icon:<XCircle size={11}/>},
    stopped:      {label:"已停止",  color:T.t3,   icon:<Ban size={11}/>},
  };
  const ts = TS_CFG[taskStatus];

  // ── No-permission state ──
  if (demo==="no-permission") return (
    <div style={{flex:1,display:"flex",flexDirection:"column",background:"#fff"}}>
      <Header method={method} path={path} endpointName={endpointName} methodColor={methodColor} ts={ts} isGenerating={false} cases={cases} progress={progress} onStop={()=>{}} onRegen={()=>setShowRegen(true)}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
        <Lock size={40} color={T.t4}/><div style={{fontSize:13,fontWeight:600,color:T.t2}}>无操作权限</div>
        <div style={{fontSize:12,color:T.t3}}>您没有查看 AI 生成用例的权限，请联系管理员。</div>
      </div>
      <DemoBar demo={demo} switchDemo={switchDemo}/>
    </div>
  );

  // ── Full-fail state ──
  if (taskStatus==="failed" && cases.every(c=>c.genStatus==="failed")) return (
    <div style={{flex:1,display:"flex",flexDirection:"column",background:"#fff"}}>
      <Header method={method} path={path} endpointName={endpointName} methodColor={methodColor} ts={ts} isGenerating={false} cases={cases} progress={0} onStop={()=>{}} onRegen={()=>setShowRegen(true)}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
        <AlertCircle size={40} color={T.danger}/><div style={{fontSize:13,fontWeight:600,color:T.t1}}>AI 生成失败</div>
        <div style={{fontSize:12,color:T.t2,textAlign:"center",maxWidth:360,lineHeight:1.7}}>AI 服务返回错误，未能生成任何有效用例。<br/>可尝试更换模型后重新生成。</div>
        <button onClick={()=>setShowRegen(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 18px",border:"none",borderRadius:6,background:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"}}><RefreshCw size={13}/>重新生成</button>
      </div>
      {showRegen&&<ApiAiGenerationDrawer method={method} path={path} endpointName={endpointName} onClose={()=>setShowRegen(false)}/>}
      <DemoBar demo={demo} switchDemo={switchDemo}/>
    </div>
  );

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",background:"#fff",overflow:"hidden"}}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Header method={method} path={path} endpointName={endpointName} methodColor={methodColor} ts={ts}
        isGenerating={isGenerating} cases={cases} progress={progress}
        onStop={()=>setConfirmType("stop")} onRegen={()=>setShowRegen(true)}/>

      {/* ── Proc-tab + search + filter + batch (single row) ──────────── */}
      <div style={{padding:"0 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",alignItems:"center",gap:0,height:44}}>

        {/* Proc tabs */}
        <div style={{display:"flex",height:"100%",marginRight:16}}>
          {([
            {k:"pending"   as ProcTab,l:`待处理(${pending.length+cases.filter(c=>c.genStatus==="generating").length})`},
            {k:"adopted"   as ProcTab,l:`已采纳(${adopted.length})`},
            {k:"discarded" as ProcTab,l:`已丢弃(${discarded.length})`},
          ]).map(t=>{
            const a = procTab===t.k;
            return (
              <button key={t.k} onClick={()=>{setProcTab(t.k);setSelected(new Set());}}
                style={{height:"100%",padding:"0 14px",border:"none",borderBottom:`2px solid ${a?T.warning:"transparent"}`,background:"transparent",fontSize:13,fontWeight:a?600:400,color:a?T.t1:T.t3,cursor:"pointer",whiteSpace:"nowrap"}}>
                {t.l}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{position:"relative",marginRight:8}}>
          <Search size={11} color={T.t4} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索"
            style={{padding:"4px 26px 4px 26px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none",width:140}}
            onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
          {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",lineHeight:0,color:T.t4}}><X size={10}/></button>}
        </div>

        {/* Group */}
        <FSelect value={fGroup} onChange={v=>{setFGroup(v);setFType("all");}} opts={[{v:"all",l:"全部分组"},...groups.map(g=>({v:g,l:g}))]}/>
        {/* Type */}
        <FSelect value={fType} onChange={setFType} opts={[{v:"all",l:"全部类型"},...types.map(t=>({v:t,l:t}))]} style={{marginLeft:6}}/>

        {(search||fGroup!=="all"||fType!=="all")&&(
          <button onClick={()=>{setSearch("");setFGroup("all");setFType("all");}}
            style={{marginLeft:4,fontSize:11,color:T.t3,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>清除</button>
        )}

        <div style={{flex:1}}/>

        {/* ── Batch buttons — right side of toolbar, no layout shift ── */}
        {selCount>0 ? (
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,color:T.t2}}>已选 <strong style={{color:T.primary}}>{selCount}</strong> 条</span>
            <TxtBtn label="批量运行"  icon={<Play size={11}/>}  onClick={()=>{actionable.filter(c=>selected.has(c.id)).forEach(c=>doRun(c.id));setSelected(new Set());}}/>
            <TxtBtn label="批量采纳"  icon={<Check size={11}/>} onClick={()=>setConfirmType("adopt-batch")}  color={T.success}/>
            <TxtBtn label="批量丢弃"  icon={<Trash2 size={11}/>}onClick={()=>setConfirmType("discard-batch")} color={T.danger}/>
            <button onClick={()=>setSelected(new Set())} style={{marginLeft:2,background:"none",border:"none",cursor:"pointer",lineHeight:0,color:T.t4}}><X size={13}/></button>
          </div>
        ) : (taskStatus==="stopped"||taskStatus==="partial-fail")&&(
          <span style={{fontSize:11,color:T.t3,display:"flex",alignItems:"center",gap:5}}>
            {taskStatus==="stopped"?<Ban size={10}/>:<AlertTriangle size={10}/>}
            {taskStatus==="stopped"?`已停止，保留 ${done.length} 条`:`${failedGen.length} 条生成失败`}
          </span>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div style={{flex:1,overflowY:"auto",minHeight:0}}>

        {/* Empty states */}
        {visible.length===0&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 0",gap:12}}>
            {(search||fGroup!=="all"||fType!=="all") ? (
              <><FileX size={36} color={T.t4}/><div style={{fontSize:13,color:T.t2}}>没有匹配的用例</div><button onClick={()=>{setSearch("");setFGroup("all");setFType("all");}} style={{fontSize:12,color:T.primary,border:`1px solid ${T.primary}30`,borderRadius:5,padding:"4px 14px",background:`${T.primary}06`,cursor:"pointer"}}>清除筛选</button></>
            ) : demo==="all-done"&&procTab==="pending" ? (
              <><CheckCircle size={40} color={T.success}/><div style={{fontSize:14,fontWeight:600,color:T.t1}}>所有候选用例已处理完成</div><div style={{fontSize:12,color:T.t2}}>已采纳 {adopted.length} 条 · 已丢弃 {discarded.length} 条</div><button onClick={()=>setShowRegen(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 18px",border:`1px solid ${T.primary}40`,borderRadius:6,background:`${T.primary}08`,color:T.primary,fontSize:13,fontWeight:500,cursor:"pointer"}}><Zap size={13}/>生成新一批</button></>
            ) : (
              <><Bot size={36} color={T.t4}/><div style={{fontSize:13,color:T.t2}}>暂无{procTab==="adopted"?"已采纳":procTab==="discarded"?"已丢弃":"候选"}用例</div></>
            )}
          </div>
        )}

        {visible.length>0&&(
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead style={{position:"sticky",top:0,zIndex:5,background:"#F7F8FA"}}>
              <tr style={{borderBottom:`1px solid ${T.border}`}}>
                <th style={{width:36,padding:"9px 8px",textAlign:"center"}}>
                  <input type="checkbox" checked={allSel}
                    ref={el=>{if(el)el.indeterminate=someSel&&!allSel;}}
                    onChange={toggleAll} style={{cursor:"pointer",accentColor:T.primary}}/>
                </th>
                <TH w={40}>#</TH>
                <TH left>名称</TH>
                <TH w={90}>类型</TH>
                <TH w={72}>分组</TH>
                <TH w={140}>运行结果</TH>
                <TH w={160}>操作</TH>
              </tr>
            </thead>
            <tbody>
              {visible.map((c,i)=>{
                if(c.genStatus==="generating") return <SkeletonRow key={c.id} idx={i}/>;
                const isSel    = selected.has(c.id);
                const dimmed   = c.procStatus==="discarded";
                const canRun   = c.runStatus!=="running" && c.procStatus!=="discarded";
                const canAdopt = c.procStatus==="pending";
                const gc       = GROUP_CFG[c.group]??{bg:T.bg,color:T.t3};
                return (
                  <tr key={c.id}
                    style={{borderBottom:`1px solid ${T.border}`,background:isSel?`${T.primary}05`:dimmed?"#FAFAFA":"#fff"}}
                    onMouseEnter={e=>{if(!isSel&&!dimmed)(e.currentTarget as HTMLElement).style.background=T.bg;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=isSel?`${T.primary}05`:dimmed?"#FAFAFA":"#fff";}}>

                    {/* Checkbox */}
                    <td style={{padding:"0 8px",textAlign:"center"}}>
                      <input type="checkbox" checked={isSel} onChange={()=>toggleOne(c.id)}
                        style={{cursor:"pointer",accentColor:T.primary}}/>
                    </td>

                    {/* # */}
                    <td style={{padding:"10px 8px",textAlign:"center",color:T.t4}}>{i+1}</td>

                    {/* Name — single line, with level badge */}
                    <td style={{padding:"10px 12px",maxWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,overflow:"hidden"}}>
                        <LvBadge lv={c.level}/>
                        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:dimmed?T.t4:T.t1,fontWeight:500,textDecoration:dimmed?"line-through":"none"}} title={c.name}>
                          {c.name}
                        </span>
                        {c.genStatus==="failed"&&<span style={{flexShrink:0,fontSize:10,padding:"1px 5px",borderRadius:3,background:`${T.danger}10`,color:T.danger}}>生成失败</span>}
                      </div>
                    </td>

                    {/* Type */}
                    <td style={{padding:"10px 8px",color:T.t3,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:90}} title={c.type}>{c.type}</td>

                    {/* Group */}
                    <td style={{padding:"10px 8px"}}>
                      <span style={{fontSize:11,padding:"1px 6px",borderRadius:4,background:gc.bg,color:gc.color,fontWeight:500,whiteSpace:"nowrap"}}>{c.group}</span>
                    </td>

                    {/* Run result */}
                    <td style={{padding:"10px 8px"}}><RunCell s={c.runStatus} r={c.runResult}/></td>

                    {/* Operations — text buttons */}
                    <td style={{padding:"8px 12px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <RowBtn label="详情" onClick={()=>{ setShowDetail(true); }} icon={<Eye size={11}/>}/>
                        {canRun&&<RowBtn label="运行" onClick={()=>doRun(c.id)} icon={<Play size={11}/>} color={T.primary}/>}
                        {canAdopt&&<RowBtn label="采纳" onClick={()=>{setConfirmCase(c);setConfirmType("adopt-single");}} icon={<Check size={11}/>} color={T.success}/>}
                        {canAdopt&&<RowBtn label="丢弃" onClick={()=>doDiscard(c.id)} icon={<Trash2 size={11}/>} color={T.danger}/>}
                        {c.procStatus==="discarded"&&<RowBtn label="恢复" onClick={()=>doRestore(c.id)} icon={<RotateCcw size={11}/>}/>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Confirm dialogs ────────────────────────────────────────────── */}
      {confirmType==="stop"&&(
        <Confirm icon={<StopCircle size={17} color={T.warning} style={{flexShrink:0,marginTop:2}}/>}
          title="停止生成" confirmLabel="停止" confirmColor={T.warning}
          body={<>停止后已生成的 <strong>{done.length}</strong> 条用例仍可正常处理，未完成项将标记为已停止。</>}
          onOk={()=>{switchDemo("stopped");setConfirmType(null);}} onCancel={()=>setConfirmType(null)}/>
      )}
      {confirmType==="adopt-single"&&confirmCase&&(
        <Confirm icon={<CheckCircle size={17} color={T.success} style={{flexShrink:0,marginTop:2}}/>}
          title="采纳并保存" confirmLabel="确认采纳" confirmColor={T.success} loading={confirmLoad}
          body={<>将 <strong>「{confirmCase.name}」</strong> 保存为当前接口的正式用例，接口「用例」Tab 将自动刷新。</>}
          onOk={()=>doAdopt(confirmCase)} onCancel={()=>{setConfirmType(null);setConfirmCase(null);}}/>
      )}
      {confirmType==="adopt-batch"&&(
        <Confirm icon={<CheckCircle size={17} color={T.success} style={{flexShrink:0,marginTop:2}}/>}
          title="批量采纳" confirmLabel={`采纳 ${selCount} 条`} confirmColor={T.success} loading={confirmLoad}
          body={<>将已选 <strong>{selCount}</strong> 条待处理用例保存为正式用例。已采纳或已丢弃的不重复处理。</>}
          onOk={doBatchAdopt} onCancel={()=>setConfirmType(null)}/>
      )}
      {confirmType==="discard-batch"&&(
        <Confirm icon={<Trash2 size={17} color={T.warning} style={{flexShrink:0,marginTop:2}}/>}
          title="批量丢弃" confirmLabel={`丢弃 ${selCount} 条`} confirmColor={T.warning} loading={confirmLoad}
          body={<>丢弃后可通过「已丢弃」Tab 重新查看和恢复，不会永久删除。</>}
          onOk={doBatchDiscard} onCancel={()=>setConfirmType(null)}/>
      )}

      {/* ── Detail drawer ──────────────────────────────────────────────── */}
      {showDetail&&<ApiCaseDrawer mode="ai" onClose={()=>setShowDetail(false)} method={method} path={path} endpointName={endpointName}/>}

      {/* ── Re-generate drawer ─────────────────────────────────────────── */}
      {showRegen&&<ApiAiGenerationDrawer method={method} path={path} endpointName={endpointName} onClose={()=>setShowRegen(false)}/>}

      {/* ── Demo bar ───────────────────────────────────────────────────── */}
      <DemoBar demo={demo} switchDemo={switchDemo}/>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}

// ─── Shared small components ───────────────────────────────────────────────────
function Header({ method, path, endpointName, methodColor, ts, isGenerating, cases, progress, onStop, onRegen }: {
  method:string; path:string; endpointName:string; methodColor:string;
  ts:{label:string;color:string;icon:React.ReactNode};
  isGenerating:boolean; cases:CandidateCase[]; progress:number;
  onStop:()=>void; onRegen:()=>void;
}) {
  const done = cases.filter(c=>c.genStatus==="done").length;
  return (
    <div style={{padding:"10px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:28,height:28,borderRadius:7,background:`${T.purple}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Bot size={14} color={T.purple}/>
        </div>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
            <span style={{fontSize:13,fontWeight:700,color:T.t1}}>AI 生成单接口用例</span>
            <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:ts.color}}>{ts.icon}{ts.label}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:T.t3}}>
            <span style={{fontWeight:700,fontSize:10,padding:"1px 5px",borderRadius:3,background:`${methodColor}12`,color:methodColor}}>{method}</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",color:T.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:280}}>{path}</span>
            <span style={{color:T.t4}}>·</span><span>{endpointName}</span>
            <span style={{color:T.t4}}>·</span><span>DeepSeek / deepseek-chat</span>
          </div>
        </div>
        {isGenerating
          ? <button onClick={onStop} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",border:`1px solid ${T.danger}30`,borderRadius:6,background:`${T.danger}06`,color:T.danger,fontSize:12,fontWeight:500,cursor:"pointer"}}><StopCircle size={12}/>停止生成</button>
          : <button onClick={onRegen} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",border:`1px solid ${T.primary}30`,borderRadius:6,background:`${T.primary}06`,color:T.primary,fontSize:12,fontWeight:500,cursor:"pointer"}}><Zap size={12}/>生成新一批</button>
        }
      </div>
      {isGenerating&&(
        <div style={{marginTop:8,display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1,height:3,borderRadius:2,background:T.border,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${progress}%`,background:T.primary,borderRadius:2,transition:"width .3s"}}/>
          </div>
          <span style={{fontSize:11,color:T.t3,flexShrink:0}}>{done} 条已生成</span>
        </div>
      )}
    </div>
  );
}

function TH({ children, w, left }: { children?:React.ReactNode; w?:number; left?:boolean }) {
  return <th style={{padding:"8px 8px",textAlign:left?"left":"center",fontSize:11,fontWeight:600,color:T.t3,letterSpacing:".3px",whiteSpace:"nowrap",width:w}}>{children}</th>;
}

function LvBadge({ lv }: { lv:string }) {
  const cfg: Record<string,{bg:string;color:string}> = {
    P0:{bg:"#FFF0F0",color:T.danger},P1:{bg:"#FFF7E6",color:T.warning},
    P2:{bg:"#E8F0FF",color:T.primary},P3:{bg:T.bg,color:T.t3},
  };
  const c = cfg[lv]??{bg:T.bg,color:T.t3};
  return <span style={{fontSize:10,fontWeight:700,padding:"1px 5px",borderRadius:3,background:c.bg,color:c.color,flexShrink:0}}>{lv}</span>;
}

function RowBtn({ label, icon, onClick, color }: { label:string; icon:React.ReactNode; onClick:()=>void; color?:string }) {
  return (
    <button onClick={onClick}
      style={{display:"inline-flex",alignItems:"center",gap:3,padding:"3px 9px",border:`1px solid ${color?color+"30":T.border}`,borderRadius:5,background:color?`${color}08`:"#fff",color:color??T.t2,fontSize:11,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap"}}
      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=color?`${color}14`:T.bg;}}
      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=color?`${color}08`:"#fff";}}>
      {icon}{label}
    </button>
  );
}

function TxtBtn({ label, icon, onClick, color }: { label:string; icon:React.ReactNode; onClick:()=>void; color?:string }) {
  return (
    <button onClick={onClick}
      style={{display:"inline-flex",alignItems:"center",gap:3,padding:"3px 10px",border:`1px solid ${color?color+"30":T.border}`,borderRadius:5,background:color?`${color}08`:"#fff",color:color??T.t2,fontSize:12,cursor:"pointer"}}>
      {icon}{label}
    </button>
  );
}

function FSelect({ value, onChange, opts, style }: { value:string; onChange:(v:string)=>void; opts:{v:string;l:string}[]; style?:React.CSSProperties }) {
  return (
    <div style={{position:"relative",...style}}>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{padding:"4px 24px 4px 10px",border:`1px solid ${value!=="all"?T.primary:T.border}`,borderRadius:6,fontSize:12,color:value!=="all"?T.primary:T.t2,background:value!=="all"?`${T.primary}06`:"#fff",outline:"none",appearance:"none",cursor:"pointer"}}>
        {opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <ChevronDown size={11} color={T.t4} style={{position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
    </div>
  );
}

function DemoBar({ demo, switchDemo }: { demo:DemoState; switchDemo:(d:DemoState)=>void }) {
  return (
    <div style={{padding:"6px 20px",borderTop:`1px solid ${T.border}`,flexShrink:0,background:"#FAFAFA"}}>
      <div style={{fontSize:10,color:T.t4,marginBottom:4}}>演示状态</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
        {(Object.keys(DEMO_LABELS) as DemoState[]).map(ds=>(
          <button key={ds} onClick={()=>switchDemo(ds)}
            style={{fontSize:10,padding:"2px 7px",borderRadius:4,border:`1px solid ${demo===ds?T.primary:T.border}`,background:demo===ds?`${T.primary}0D`:"#fff",color:demo===ds?T.primary:T.t3,cursor:"pointer"}}>
            {DEMO_LABELS[ds]}
          </button>
        ))}
      </div>
    </div>
  );
}
