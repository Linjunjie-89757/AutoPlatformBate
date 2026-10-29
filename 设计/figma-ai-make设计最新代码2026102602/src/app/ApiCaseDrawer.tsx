/**
 * ApiCaseDrawer — 新建 / 编辑 / AI 候选用例抽屉
 *
 * 布局与接口编辑器一致：
 *   ① 抽屉头部（标题 + 接口上下文 + 关闭）
 *   ② 用例基础信息条（名称 + 发送 / 级别 / 标签）
 *   ③ 请求 Tab 栏（Params · Auth · Headers · Body · 前置处理 · 后置处理 · 断言 · 设置）
 *   ④ 请求内容区（填满剩余高度，可滚动）
 *   ⑤ 响应内容区（固定底部分栏，同接口编辑器）
 *   ⑥ 页脚操作栏
 */
import React, { useState, useRef } from "react";
import {
  X, Plus, Trash2, RotateCcw, Play, Save,
  Loader2, Check, CheckCircle,
  AlertTriangle, Code2, ChevronDown,
  Bot, Info, Database, Clock, Layers,
  Hash, Server, FileText, Timer, Variable,
  Copy, ArrowUp, ArrowDown, Shield,
} from "lucide-react";

// ─── Design tokens ─────────────────────────────────────────────────────────────
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
type Level    = "P0"|"P1"|"P2"|"P3";
type BodyType = "none"|"form-data"|"urlencoded"|"json"|"xml"|"raw";
type ReqTab   = "Params"|"Auth"|"Headers"|"Body"|"前置处理"|"后置处理"|"断言"|"设置";
type RespTab  = "响应体"|"Headers"|"Cookies"|"断言结果";
type DrawerMode = "new"|"edit"|"ai";
type ParamSrc = "inherited"|"overridden"|"new"|"disabled";

interface ParamRow { id:string; enabled:boolean; name:string; value:string; desc:string; src:ParamSrc; }
// ── Assertion types (master-detail) ──────────────────────────────────────────
type AssertKind = "status"|"resp-header"|"resp-body"|"resp-time"|"variable"|"script";
interface AssertRow {
  id:string; name:string; kind:AssertKind; enabled:boolean; desc:string;
  statusOp:string; statusExpected:string;
  headerRows:{id:string;header:string;op:string;expected:string}[];
  bodySubType:"jsonpath"|"xpath"|"regex";
  bodyRows:{id:string;expr:string;op:string;expected:string}[];
  timeOp:string; timeMs:number;
  varRows:{id:string;varName:string;op:string;expected:string}[];
  script:string;
}
type ProcType = "JS脚本" | "SQL" | "等待" | "变量提取";
interface SqlColVar { id:string; col:string; varName:string; }
interface PrePost {
  id:string; enabled:boolean; name:string; type:ProcType;
  content:string;
  extractPath?:string; extractVar?:string; extractMethod?:"JSONPath"|"XPath"|"正则";
  waitMs?:number;
  sqlDbId?:string; sqlQuery?:string; sqlTimeout?:number;
  sqlColumnVars?:SqlColVar[]; sqlResultVar?:string;
  desc?:string;
}

function uid() { return Math.random().toString(36).slice(2,8); }

// ─── Param source badge ────────────────────────────────────────────────────────
const SRC: Record<ParamSrc,{label:string;bg:string;color:string}> = {
  inherited: {label:"继承",   bg:`${T.t4}22`,      color:T.t4    },
  overridden:{label:"已覆盖", bg:`${T.warning}18`, color:T.warning},
  new:       {label:"新增",   bg:`${T.success}14`, color:T.success},
  disabled:  {label:"停用",   bg:`${T.t4}18`,      color:T.t4    },
};
function SrcBadge({ s }:{s:ParamSrc}) {
  const c=SRC[s];
  return <span style={{fontSize:10,padding:"1px 5px",borderRadius:3,background:c.bg,color:c.color,fontWeight:600,flexShrink:0}}>{c.label}</span>;
}

// ─── Param table (shared by Params / Headers) ──────────────────────────────────
function ParamTable({ rows, onChange }:{ rows:ParamRow[]; onChange:(r:ParamRow[])=>void }) {
  const up = (id:string,f:keyof ParamRow,v:any) => onChange(rows.map(r=>r.id===id?{...r,[f]:v}:r));
  return (
    <div style={{borderRadius:6,border:`1px solid ${T.border}`,overflow:"hidden",margin:"12px 16px"}}>
      <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 1fr 72px 44px",background:"#F7F8FA",borderBottom:`1px solid ${T.border}`}}>
        {["","参数名","参数值","描述","来源",""].map((h,i)=><div key={i} style={{padding:"5px 8px",fontSize:11,fontWeight:600,color:T.t3}}>{h}</div>)}
      </div>
      {rows.map(row=>{
        const dim=!row.enabled||row.src==="disabled";
        return (
          <div key={row.id} style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 1fr 72px 44px",borderBottom:`1px solid ${T.border}`,background:dim?"#FAFAFA":"#fff",alignItems:"center"}}>
            <div style={{display:"flex",justifyContent:"center",padding:"6px 0"}}>
              <input type="checkbox" checked={row.enabled} onChange={e=>up(row.id,"enabled",e.target.checked)} style={{cursor:"pointer",accentColor:T.primary}}/>
            </div>
            {(["name","value","desc"] as const).map(f=>(
              <div key={f} style={{padding:"2px 4px"}}>
                <input value={row[f] as string} onChange={e=>up(row.id,f,e.target.value)}
                  placeholder={f==="name"?"参数名":f==="value"?"参数值":"备注"}
                  style={{width:"100%",boxSizing:"border-box",padding:"4px 7px",border:"1px solid transparent",borderRadius:4,fontSize:12,fontFamily:f==="name"?"'JetBrains Mono',monospace":"inherit",color:dim?T.t4:f==="name"?T.primary:T.t1,background:"transparent",outline:"none",textDecoration:dim?"line-through":"none"}}
                  onFocus={e=>{e.target.style.borderColor=T.primary;e.target.style.background="#fff";}}
                  onBlur={e=>{e.target.style.borderColor="transparent";e.target.style.background="transparent";}}/>
              </div>
            ))}
            <div style={{padding:"4px 8px",display:"flex",justifyContent:"center"}}><SrcBadge s={row.src}/></div>
            <div style={{padding:"4px 6px",display:"flex",gap:3,justifyContent:"center"}}>
              {row.src==="overridden"&&<button onClick={()=>up(row.id,"src","inherited")} style={{background:"none",border:"none",cursor:"pointer",lineHeight:0,color:T.t3}}><RotateCcw size={11}/></button>}
              {row.src==="new"&&<button onClick={()=>onChange(rows.filter(r=>r.id!==row.id))} style={{background:"none",border:"none",cursor:"pointer",lineHeight:0,color:T.danger}}><Trash2 size={11}/></button>}
            </div>
          </div>
        );
      })}
      <button onClick={()=>onChange([...rows,{id:uid(),enabled:true,name:"",value:"",desc:"",src:"new"}])}
        style={{width:"100%",padding:"6px 12px",display:"flex",alignItems:"center",gap:5,background:"none",border:"none",cursor:"pointer",fontSize:12,color:T.t3}}
        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=T.bg;(e.currentTarget as HTMLElement).style.color=T.primary;}}
        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";(e.currentTarget as HTMLElement).style.color=T.t3;}}>
        <Plus size={11}/>添加参数
      </button>
    </div>
  );
}

// ─── Light-theme editor (matches reference screenshot) ─────────────────────────
function MonacoEditor({ value, onChange, language="json", readOnly }:{
  value:string; onChange?:(v:string)=>void; language?:string; readOnly?:boolean;
}) {
  const lines = value.split("\n");
  return (
    <div style={{display:"flex",flex:1,minHeight:0,background:"#fff"}}>
      {/* Line numbers */}
      <div style={{width:40,flexShrink:0,paddingTop:10,paddingRight:6,textAlign:"right",userSelect:"none",background:"#F7F8FA",borderRight:`1px solid ${T.border}`}}>
        {lines.map((_,i)=><div key={i} style={{fontSize:12,lineHeight:"20px",color:T.t4,fontFamily:"'JetBrains Mono',monospace"}}>{i+1}</div>)}
      </div>
      <textarea value={value} onChange={readOnly?undefined:e=>onChange?.(e.target.value)} readOnly={readOnly}
        style={{flex:1,padding:"10px 12px",background:"transparent",color:T.t1,border:"none",outline:"none",fontFamily:"'JetBrains Mono','Fira Code',monospace",fontSize:13,lineHeight:"20px",resize:"none",cursor:readOnly?"default":"text"}}/>
    </div>
  );
}

// ─── Processor type config ───────────────────────────────────────────────────────
const PROC_TYPE_CFG: Record<ProcType,{label:string;short:string;bg:string;color:string;icon:React.ElementType;desc:string}> = {
  "JS脚本":  {label:"JS脚本",  short:"JS",  bg:`${T.warning}14`, color:T.warning, icon:Code2,    desc:"执行 JavaScript 脚本"},
  "SQL":     {label:"SQL",     short:"SQL", bg:`${T.primary}12`, color:T.primary, icon:Database, desc:"执行 SQL 查询并提取数据"},
  "等待":    {label:"等待",    short:"等",  bg:`${T.t4}18`,      color:T.t3,      icon:Clock,    desc:"插入等待延迟"},
  "变量提取":{label:"变量提取",short:"提取",bg:"#F0F9EB",        color:"#00B42A", icon:Layers,   desc:"从响应中提取变量"},
};
const PRE_PROC_TYPES:  ProcType[] = ["JS脚本","SQL","等待"];
const POST_PROC_TYPES: ProcType[] = ["JS脚本","SQL","等待","变量提取"];
const MOCK_DBS = [{id:"db1",name:"dev-mysql"},{id:"db2",name:"test-pg"},{id:"db3",name:"pre-oracle"}];

// ─── Processor master-detail panel ──────────────────────────────────────────────
function ProcMasterDetail({
  procs, onChange, emptyHint, allowedTypes,
}: {
  procs: PrePost[];
  onChange: (list: PrePost[]) => void;
  emptyHint: string;
  allowedTypes: ProcType[];
}) {
  const [selId, setSelId] = useState<string|null>(procs[0]?.id ?? null);
  const [addOpen, setAddOpen] = useState(false);

  const sel = procs.find(p => p.id === selId) ?? null;

  const addProc = (type: ProcType) => {
    const defaults: Record<ProcType, Partial<PrePost>> = {
      "JS脚本":   { name:"脚本处理器", content:"// 可使用 pm.variables.set / get\n// request / response 上下文可用\n" },
      "SQL":      { name:"SQL 查询",   sqlDbId:"db1", sqlQuery:"SELECT id, token FROM users WHERE username = '{{username}}' LIMIT 1", sqlTimeout:5000, sqlColumnVars:[{id:uid(),col:"token",varName:"db_token"}], sqlResultVar:"" },
      "等待":     { name:"等待",       waitMs:500 },
      "变量提取": { name:"变量提取",   content:"", extractPath:"$.data.token", extractVar:"token", extractMethod:"JSONPath" },
    };
    const np: PrePost = { id:uid(), enabled:true, type, content:"", ...defaults[type] } as PrePost;
    onChange([...procs, np]);
    setSelId(np.id);
    setAddOpen(false);
  };

  const upd = (p: PrePost) => onChange(procs.map(x => x.id === p.id ? p : x));
  const del = (id: string) => {
    const rest = procs.filter(x => x.id !== id);
    onChange(rest);
    if (selId === id) setSelId(rest[0]?.id ?? null);
  };
  const move = (id: string, dir: -1|1) => {
    const i = procs.findIndex(p => p.id === id);
    if (i < 0) return;
    const ni = i + dir;
    if (ni < 0 || ni >= procs.length) return;
    const next = [...procs];
    [next[i], next[ni]] = [next[ni], next[i]];
    onChange(next);
  };

  return (
    <div style={{flex:1,display:"flex",minHeight:0,overflow:"hidden"}}>

      {/* ── Left list ── */}
      <div style={{width:192,flexShrink:0,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",background:"#FAFAFA"}}>

        {/* Add button */}
        <div style={{padding:"10px 10px 8px",position:"relative"}}>
          <button onClick={()=>setAddOpen(v=>!v)}
            style={{width:"100%",padding:"7px 0",borderRadius:6,border:"none",background:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <Plus size={12}/>添加
          </button>
          {addOpen&&(
            <>
              <div onClick={()=>setAddOpen(false)} style={{position:"fixed",inset:0,zIndex:1000}}/>
              <div style={{position:"absolute",top:"calc(100% - 2px)",left:10,right:10,zIndex:1001,background:"#fff",border:`1px solid ${T.border}`,borderRadius:7,boxShadow:"0 4px 16px rgba(0,0,0,0.10)",padding:4}}>
                {allowedTypes.map(t=>(
                  <button key={t} onClick={()=>addProc(t)}
                    style={{width:"100%",display:"flex",alignItems:"center",padding:"7px 10px",background:"transparent",border:"none",cursor:"pointer",borderRadius:5,textAlign:"left",fontSize:12,color:T.t1}}
                    onMouseEnter={e=>(e.currentTarget.style.background=T.bg)}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    {PROC_TYPE_CFG[t].label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Processor list */}
        <div style={{flex:1,overflowY:"auto"}}>
          {procs.length===0
            ? <div style={{textAlign:"center",padding:"24px 12px",fontSize:12,color:T.t4}}>{emptyHint}</div>
            : procs.map((p,i)=>{
                const active = selId===p.id;
                return (
                  <div key={p.id} onClick={()=>setSelId(p.id)}
                    style={{padding:"8px 10px",display:"flex",alignItems:"center",gap:6,cursor:"pointer",
                      background:active?`${T.primary}0D`:"transparent",
                      borderLeft:`2px solid ${active?T.primary:"transparent"}`,
                      transition:"background .1s"}}
                    onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLElement).style.background=`${T.t4}18`;}}
                    onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLElement).style.background="transparent";}}>
                    {/* Toggle */}
                    <div onClick={e=>{e.stopPropagation();upd({...p,enabled:!p.enabled});}}
                      style={{width:26,height:14,borderRadius:7,background:p.enabled?T.primary:T.t4,position:"relative",cursor:"pointer",flexShrink:0,transition:"background .15s"}}>
                      <div style={{position:"absolute",top:2,left:p.enabled?12:2,width:10,height:10,borderRadius:"50%",background:"#fff",transition:"left .15s"}}/>
                    </div>
                    {/* Name */}
                    <span style={{flex:1,fontSize:12,color:active?T.primary:T.t1,fontWeight:active?500:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {p.name||PROC_TYPE_CFG[p.type].label}
                    </span>
                    {/* Up / down */}
                    <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
                      <button onClick={e=>{e.stopPropagation();move(p.id,-1);}} disabled={i===0}
                        style={{background:"none",border:"none",cursor:i===0?"default":"pointer",lineHeight:0,padding:0,color:T.t3,opacity:i===0?0.25:1}}>
                        <ChevronDown size={10} style={{transform:"rotate(180deg)"}}/>
                      </button>
                      <button onClick={e=>{e.stopPropagation();move(p.id,1);}} disabled={i===procs.length-1}
                        style={{background:"none",border:"none",cursor:i===procs.length-1?"default":"pointer",lineHeight:0,padding:0,color:T.t3,opacity:i===procs.length-1?0.25:1}}>
                        <ChevronDown size={10}/>
                      </button>
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>

      {/* ── Right detail panel ── */}
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",background:"#fff"}}>
        {!sel
          ? <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:T.t4}}>
              <Code2 size={24} style={{opacity:.3}}/>
              <span style={{fontSize:12}}>请选择或添加处理器</span>
            </div>
          : <>
              {/* Detail header */}
              <div style={{padding:"9px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,background:"#FAFAFA",flexShrink:0}}>
                <input value={sel.name} onChange={e=>upd({...sel,name:e.target.value})}
                  style={{flex:1,border:"none",background:"transparent",fontSize:13,fontWeight:500,color:T.t1,outline:"none"}}/>
                {/* Type badge */}
                {(()=>{const c=PROC_TYPE_CFG[sel.type];return(
                  <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:c.bg,color:c.color,fontWeight:600,flexShrink:0,fontFamily:"monospace"}}>{c.label}</span>
                );})()}
                {/* Copy */}
                <button onClick={()=>{
                  const copy:PrePost={...sel,id:uid(),name:`${sel.name} 副本`};
                  const idx=procs.findIndex(p=>p.id===sel.id);
                  const next=[...procs];next.splice(idx+1,0,copy);
                  onChange(next);setSelId(copy.id);
                }} style={{fontSize:12,padding:"3px 10px",border:`1px solid ${T.border}`,borderRadius:5,background:"#fff",color:T.t2,cursor:"pointer"}}>
                  复制
                </button>
                {/* Delete */}
                <button onClick={()=>del(sel.id)}
                  style={{fontSize:12,padding:"3px 10px",border:`1px solid ${T.danger}30`,borderRadius:5,background:`${T.danger}06`,color:T.danger,cursor:"pointer"}}>
                  删除
                </button>
              </div>

              {/* Detail content */}
              <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:14}}>

                {/* ── JS 脚本 ── */}
                {sel.type==="JS脚本"&&(<>
                  <div style={{fontSize:11,color:T.t3,fontWeight:600,marginBottom:-6}}>脚本内容</div>
                  <div style={{flex:1,minHeight:160,display:"flex",flexDirection:"column",border:`1px solid ${T.border}`,borderRadius:5,overflow:"hidden"}}>
                    <MonacoEditor value={sel.content} onChange={v=>upd({...sel,content:v})} language="javascript"/>
                  </div>
                  <div style={{padding:"8px 10px",borderRadius:5,background:"#FAFAFA",border:`1px solid ${T.border}`,fontSize:11,color:T.t3,lineHeight:1.7}}>
                    <span style={{fontFamily:"monospace",color:T.primary}}>pm.variables.set(name,val)</span> · <span style={{fontFamily:"monospace",color:T.primary}}>pm.variables.get(name)</span> · <span style={{fontFamily:"monospace",color:T.primary}}>pm.request</span> · <span style={{fontFamily:"monospace",color:T.primary}}>pm.response</span> · <span style={{fontFamily:"monospace",color:T.warning}}>pm.test()</span>
                  </div>
                </>)}

                {/* ── SQL ── */}
                {sel.type==="SQL"&&(<>
                  <div style={{display:"flex",gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,color:T.t3,fontWeight:600,marginBottom:4}}>数据源</div>
                      <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",border:`1px solid ${T.border}`,borderRadius:5,background:"#fff"}}>
                        <Database size={12} style={{color:T.t3,flexShrink:0}}/>
                        <select value={sel.sqlDbId??"db1"} onChange={e=>upd({...sel,sqlDbId:e.target.value})}
                          style={{flex:1,border:"none",background:"transparent",fontSize:12,color:T.t1,outline:"none",cursor:"pointer"}}>
                          {MOCK_DBS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{width:130}}>
                      <div style={{fontSize:11,color:T.t3,fontWeight:600,marginBottom:4}}>超时 (ms)</div>
                      <input type="number" value={sel.sqlTimeout??5000} min={100} max={60000}
                        onChange={e=>upd({...sel,sqlTimeout:+e.target.value})}
                        style={{width:"100%",boxSizing:"border-box",padding:"5px 10px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,color:T.t1,outline:"none"}}
                        onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
                    </div>
                  </div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:11,color:T.t3,fontWeight:600}}>查询语句</span>
                      <span style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:"#E8F3FF",color:T.primary}}>仅 SELECT</span>
                    </div>
                    <div style={{minHeight:100,display:"flex",flexDirection:"column",border:`1px solid ${T.border}`,borderRadius:5,overflow:"hidden"}}>
                      <MonacoEditor value={sel.sqlQuery??"SELECT "} onChange={v=>upd({...sel,sqlQuery:v})} language="sql"/>
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:T.t3,fontWeight:600,marginBottom:4}}>列 → 变量映射</div>
                    <div style={{border:`1px solid ${T.border}`,borderRadius:5,overflow:"hidden"}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 36px",background:"#FAFAFA",borderBottom:`1px solid ${T.border}`,padding:"4px 10px",gap:8}}>
                        {["列名","写入变量名",""].map((h,i)=><div key={i} style={{fontSize:10,fontWeight:600,color:T.t3}}>{h}</div>)}
                      </div>
                      {(sel.sqlColumnVars??[]).map((cv,ci)=>(
                        <div key={cv.id} style={{display:"grid",gridTemplateColumns:"1fr 1fr 36px",alignItems:"center",borderBottom:ci<(sel.sqlColumnVars??[]).length-1?`1px solid ${T.border}`:"none",padding:"2px 10px",gap:8}}>
                          <input value={cv.col} onChange={e=>{const vars=[...(sel.sqlColumnVars??[])];vars[ci]={...vars[ci],col:e.target.value};upd({...sel,sqlColumnVars:vars});}}
                            placeholder="列名" style={{width:"100%",border:"none",outline:"none",fontSize:12,fontFamily:"monospace",color:T.t1,padding:"4px 0"}}/>
                          <input value={cv.varName} onChange={e=>{const vars=[...(sel.sqlColumnVars??[])];vars[ci]={...vars[ci],varName:e.target.value};upd({...sel,sqlColumnVars:vars});}}
                            placeholder="变量名" style={{width:"100%",border:"none",outline:"none",fontSize:12,fontFamily:"monospace",color:T.primary,padding:"4px 0"}}/>
                          <button onClick={()=>upd({...sel,sqlColumnVars:(sel.sqlColumnVars??[]).filter((_,j)=>j!==ci)})}
                            style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:4}}
                            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=T.danger}
                            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=T.t3}>
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      ))}
                      <button onClick={()=>upd({...sel,sqlColumnVars:[...(sel.sqlColumnVars??[]),{id:uid(),col:"",varName:""}]})}
                        style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"7px 10px",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",color:T.t3,fontSize:12}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color=T.primary;}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color=T.t3;}}>
                        <Plus size={11}/>添加列映射
                      </button>
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:T.t3,fontWeight:600,marginBottom:4}}>完整结果变量 <span style={{fontWeight:400}}>(选填)</span></div>
                    <input value={sel.sqlResultVar??""} onChange={e=>upd({...sel,sqlResultVar:e.target.value})}
                      placeholder="将查询结果数组整体存入此变量，如 sql_rows"
                      style={{width:"100%",boxSizing:"border-box",padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,fontFamily:"monospace",color:T.primary,outline:"none"}}
                      onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
                  </div>
                </>)}

                {/* ── 等待 ── */}
                {sel.type==="等待"&&(<>
                  <div>
                    <div style={{fontSize:11,color:T.t3,fontWeight:600,marginBottom:8}}>等待时长</div>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <div style={{display:"inline-flex",alignItems:"center",border:`1px solid ${T.border}`,borderRadius:6,overflow:"hidden"}}>
                        <button onClick={()=>upd({...sel,waitMs:Math.max(100,(sel.waitMs??500)-100)})}
                          style={{width:34,height:36,border:"none",borderRight:`1px solid ${T.border}`,background:"#FAFAFA",cursor:"pointer",fontSize:18,color:T.t2,display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                        <input type="number" value={sel.waitMs??500} min={100} max={600000}
                          onChange={e=>upd({...sel,waitMs:Math.max(100,Number(e.target.value))})}
                          style={{width:80,height:36,border:"none",textAlign:"center",fontSize:14,fontWeight:500,color:T.t1,outline:"none",background:"#fff"}}/>
                        <button onClick={()=>upd({...sel,waitMs:(sel.waitMs??500)+100})}
                          style={{width:34,height:36,border:"none",borderLeft:`1px solid ${T.border}`,background:"#FAFAFA",cursor:"pointer",fontSize:18,color:T.t2,display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                      </div>
                      <span style={{fontSize:12,color:T.t3}}>毫秒 (ms)</span>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      {[500,1000,2000,5000].map(ms=>(
                        <button key={ms} onClick={()=>upd({...sel,waitMs:ms})}
                          style={{padding:"3px 12px",borderRadius:4,fontSize:11,cursor:"pointer",border:`1px solid ${(sel.waitMs??500)===ms?T.primary:T.border}`,background:(sel.waitMs??500)===ms?`${T.primary}0D`:"transparent",color:(sel.waitMs??500)===ms?T.primary:T.t3}}>
                          {ms>=1000?`${ms/1000}s`:`${ms}ms`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:T.t3,fontWeight:600,marginBottom:4}}>说明 <span style={{fontWeight:400}}>(选填)</span></div>
                    <input value={sel.desc??""} onChange={e=>upd({...sel,desc:e.target.value})}
                      placeholder="描述等待原因，如：等待异步任务初始化"
                      style={{width:"100%",boxSizing:"border-box",padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,color:T.t1,outline:"none"}}
                      onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
                  </div>
                </>)}

                {/* ── 变量提取 ── */}
                {sel.type==="变量提取"&&(<>
                  <div>
                    <div style={{fontSize:11,color:T.t3,fontWeight:600,marginBottom:6}}>提取方式</div>
                    <div style={{display:"inline-flex",background:T.bg,borderRadius:5,padding:2}}>
                      {(["JSONPath","XPath","正则"] as const).map(m=>(
                        <button key={m} onClick={()=>upd({...sel,extractMethod:m})}
                          style={{padding:"4px 14px",borderRadius:4,border:"none",fontSize:12,cursor:"pointer",
                            background:sel.extractMethod===m?T.primary:"transparent",
                            color:sel.extractMethod===m?"#fff":T.t3}}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:T.t3,fontWeight:600,marginBottom:4}}>
                      {sel.extractMethod==="正则"?"正则表达式":sel.extractMethod==="XPath"?"XPath 表达式":"JSONPath 表达式"}
                    </div>
                    <input value={sel.extractPath??""} onChange={e=>upd({...sel,extractPath:e.target.value})}
                      placeholder={sel.extractMethod==="正则"?"(?<=token\":\")(\\w+)":sel.extractMethod==="XPath"?"//response/token":"$.data.token"}
                      style={{width:"100%",boxSizing:"border-box",padding:"7px 10px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,fontFamily:"monospace",color:T.primary,outline:"none"}}
                      onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:T.t3,fontWeight:600,marginBottom:4}}>写入变量名</div>
                    <input value={sel.extractVar??""} onChange={e=>upd({...sel,extractVar:e.target.value})}
                      placeholder="如 token、userId"
                      style={{width:"100%",boxSizing:"border-box",padding:"7px 10px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,fontFamily:"monospace",color:T.t1,outline:"none"}}
                      onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
                  </div>
                  <div style={{padding:"8px 10px",borderRadius:5,background:"#F0F9EB",border:"1px solid #B7EB8F",fontSize:11,color:"#389E0D",lineHeight:1.7}}>
                    提取结果将以变量名注入环境，可在后续步骤通过 <span style={{fontFamily:"monospace"}}>{"{{变量名}}"}</span> 引用。
                  </div>
                </>)}

              </div>
            </>
        }
      </div>
    </div>
  );
}

// ─── Case Settings Tab ───────────────────────────────────────────────────────
const CONN_DEFAULT = 30000;
const RESP_DEFAULT = 60000;
const MIN_TIMEOUT  = 1000;
const STEP_MS      = 1000;

function CaseTimeoutStepper({ label, value, onChange }: { label:string; value:number; onChange:(v:number)=>void }) {
  const [focused, setFocused] = React.useState(false);
  const [raw,     setRaw]     = React.useState(String(value));
  const borderColor = focused ? T.primary : T.border;
  const commit = (s: string) => {
    const n = parseInt(s, 10);
    const clamped = isNaN(n) ? MIN_TIMEOUT : Math.max(MIN_TIMEOUT, n);
    onChange(clamped); setRaw(String(clamped));
  };
  const step = (d: number) => { const n = Math.max(MIN_TIMEOUT, value + d); onChange(n); setRaw(String(n)); };
  const btnS: React.CSSProperties = { width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",border:"none",cursor:"pointer",color:T.t3,flexShrink:0 };
  return (
    <div>
      <div style={{fontSize:12,color:T.t2,marginBottom:5}}>{label}</div>
      <div style={{display:"inline-flex",alignItems:"center",border:`1px solid ${borderColor}`,borderRadius:6,overflow:"hidden",height:28,transition:"border-color .15s"}}>
        <button style={btnS} onClick={()=>step(-STEP_MS)}
          onMouseEnter={e=>{e.currentTarget.style.color=T.primary;e.currentTarget.style.background=`${T.primary}0A`;}}
          onMouseLeave={e=>{e.currentTarget.style.color=T.t3;e.currentTarget.style.background="#fff";}}>
          <svg width="8" height="2" viewBox="0 0 8 2" fill="currentColor"><rect width="8" height="2" rx="1"/></svg>
        </button>
        <div style={{width:1,height:16,background:T.border,flexShrink:0}}/>
        <input type="text" inputMode="numeric" value={focused?raw:String(value)}
          onFocus={()=>{setFocused(true);setRaw(String(value));}}
          onBlur={()=>{setFocused(false);commit(raw);}}
          onChange={e=>setRaw(e.target.value)}
          style={{width:68,border:"none",outline:"none",textAlign:"center",fontSize:12,color:T.t1,background:"transparent",padding:"0 4px",height:"100%"}}/>
        <div style={{width:1,height:16,background:T.border,flexShrink:0}}/>
        <button style={btnS} onClick={()=>step(+STEP_MS)}
          onMouseEnter={e=>{e.currentTarget.style.color=T.primary;e.currentTarget.style.background=`${T.primary}0A`;}}
          onMouseLeave={e=>{e.currentTarget.style.color=T.t3;e.currentTarget.style.background="#fff";}}>
          <Plus size={9}/>
        </button>
      </div>
    </div>
  );
}

function CaseSettingsTab() {
  const [connTimeout,      setConnTimeout]      = React.useState(CONN_DEFAULT);
  const [respTimeout,      setRespTimeout]      = React.useState(RESP_DEFAULT);
  const [redirect,         setRedirect]         = React.useState(true);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  const handleReset = () => { setConnTimeout(CONN_DEFAULT); setRespTimeout(RESP_DEFAULT); setRedirect(true); setShowResetConfirm(false); };

  return (
    <div style={{flex:1,overflowY:"auto",padding:16}}>

      {/* 超时 */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:12,color:T.t3,marginBottom:10}}>超时（ms）</div>
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          <CaseTimeoutStepper label="连接超时" value={connTimeout} onChange={setConnTimeout}/>
          <CaseTimeoutStepper label="响应超时" value={respTimeout} onChange={setRespTimeout}/>
        </div>
      </div>

      {/* 重定向 */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:12,color:T.t3,marginBottom:10}}>重定向</div>
        <label style={{display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer"}}>
          <input type="checkbox" checked={redirect} onChange={e=>setRedirect(e.target.checked)}
            style={{width:14,height:14,cursor:"pointer",accentColor:T.primary}}/>
          <span style={{fontSize:13,color:T.t1}}>自动跟随重定向</span>
          <span style={{fontSize:11,color:T.t4}}>（301 / 302 / 307 / 308）</span>
        </label>
      </div>

      {/* 恢复默认 */}
      {!showResetConfirm
        ? <button onClick={()=>setShowResetConfirm(true)}
            style={{fontSize:12,color:T.t3,background:"none",border:"none",cursor:"pointer",padding:0}}
            onMouseEnter={e=>e.currentTarget.style.color=T.primary}
            onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
            恢复默认值
          </button>
        : <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:12,color:T.t2}}>确认恢复默认值？</span>
            <button onClick={()=>setShowResetConfirm(false)}
              style={{fontSize:12,color:T.t3,background:"none",border:"none",cursor:"pointer",padding:0}}>取消</button>
            <button onClick={handleReset}
              style={{fontSize:12,color:T.danger,background:"none",border:"none",cursor:"pointer",padding:0,fontWeight:500}}>确认</button>
          </div>
      }
    </div>
  );
}

// ─── Assertion master-detail ─────────────────────────────────────────────────

const ASSERT_KIND_CFG: Record<AssertKind,{label:string;color:string;bg:string;icon:React.ElementType}> = {
  "status":      {label:"状态码",   color:"#165DFF", bg:"#E8EEFF", icon:Hash},
  "resp-header": {label:"响应头",   color:"#00AECF", bg:"#E5F6FA", icon:Server},
  "resp-body":   {label:"响应体",   color:"#7816FF", bg:"#F0E8FF", icon:FileText},
  "resp-time":   {label:"响应时间", color:"#00B42A", bg:"#E6F9EC", icon:Timer},
  "variable":    {label:"变量",     color:"#FF7D00", bg:"#FFF2E5", icon:Variable},
  "script":      {label:"脚本",     color:"#E0186C", bg:"#FCE8F2", icon:Code2},
};
const ASSERT_KINDS: AssertKind[] = ["status","resp-header","resp-body","resp-time","variable","script"];
const ASSERT_KIND_NAMES: Record<AssertKind,string> = {
  status:"状态码断言","resp-header":"响应头断言","resp-body":"响应体断言",
  "resp-time":"响应时间断言",variable:"变量断言",script:"脚本断言",
};
const BODY_OPS = ["等于","不等于","包含","不包含","正则","存在","不存在"];
const ALL_CON  = ["等于","不等于","包含","不包含","正则","为空","不为空","大于","大于等于","小于","小于等于"];

function mkAssertRow(kind: AssertKind, idx: number): AssertRow {
  return {
    id: "a"+Date.now()+idx, name: ASSERT_KIND_NAMES[kind]+" "+(idx+1), kind, enabled:true, desc:"",
    statusOp:"等于", statusExpected:"",
    headerRows:[{id:"hr1",header:"Content-Type",op:"包含",expected:"application/json"}],
    bodySubType:"jsonpath",
    bodyRows:[{id:"br1",expr:"$.code",op:"等于",expected:""}],
    timeOp:"小于等于", timeMs:1000,
    varRows:[{id:"vr1",varName:"",op:"不为空",expected:""}],
    script:'// pm.expect(pm.response.json().code).to.eql(0);\n// pm.expect(pm.response.code).to.eql(200);\n',
  };
}

function SmToggle2({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}){
  return(
    <button onClick={e=>{e.stopPropagation();onChange(!on);}}
      style={{flexShrink:0,position:"relative",width:28,height:14,borderRadius:7,background:on?T.primary:"#C9CDD4",border:"none",cursor:"pointer",transition:"background .15s"}}>
      <div style={{position:"absolute",top:2,width:10,height:10,borderRadius:"50%",background:"#fff",transition:"left .15s",left:on?16:2}}/>
    </button>
  );
}

// ── Detail panels ──────────────────────────────────────────────────────────────
function StatusDetail({a,upd}:{a:AssertRow;upd:(p:Partial<AssertRow>)=>void}){
  return(
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"flex-end",gap:10}}>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:4}}>比较条件</div>
          <select value={a.statusOp} onChange={e=>upd({statusOp:e.target.value})}
            style={{height:32,padding:"0 10px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t2,outline:"none",width:120}}
            onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}>
            {["等于","不等于","大于","大于等于","小于","小于等于","包含于"].map(op=><option key={op}>{op}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:4}}>期望状态码</div>
          <input value={a.statusExpected} onChange={e=>upd({statusExpected:e.target.value})} placeholder="如 200、201、4xx"
            style={{height:32,padding:"0 12px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:13,fontWeight:600,color:T.t1,outline:"none",width:140,fontFamily:"monospace"}}
            onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
      </div>
      <div style={{padding:"8px 12px",borderRadius:6,background:"#FFF7E6",border:`1px solid ${T.warning}30`,fontSize:11,color:T.t2,lineHeight:1.7}}>
        留空期望值可用于<strong>负向用例</strong>——搭配「不等于 200」验证 4xx / 5xx 错误场景。
      </div>
    </div>
  );
}

function HeaderDetail({a,upd}:{a:AssertRow;upd:(p:Partial<AssertRow>)=>void}){
  const rows=a.headerRows;
  const addRow=()=>upd({headerRows:[...rows,{id:"hr"+Date.now(),header:"",op:"等于",expected:""}]});
  const updRow=(id:string,k:string,v:string)=>upd({headerRows:rows.map(r=>r.id===id?{...r,[k]:v}:r)});
  const delRow=(id:string)=>upd({headerRows:rows.filter(r=>r.id!==id)});
  return(
    <div style={{padding:16}}>
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 120px 1fr 36px",background:"#FAFAFA",borderBottom:`1px solid ${T.border}`,padding:"5px 10px",gap:8}}>
          {["Header 名称","比较条件","期望值",""].map((h,i)=><div key={i} style={{fontSize:10,fontWeight:600,color:T.t3}}>{h}</div>)}
        </div>
        {rows.map((r,i)=>(
          <div key={r.id} style={{display:"grid",gridTemplateColumns:"1fr 120px 1fr 36px",alignItems:"center",borderBottom:i<rows.length-1?`1px solid ${T.border}`:"none",padding:"3px 10px",gap:8}}>
            <input value={r.header} onChange={e=>updRow(r.id,"header",e.target.value)} placeholder="Content-Type"
              style={{border:"none",outline:"none",fontSize:12,fontFamily:"monospace",color:T.t1,padding:"4px 0",width:"100%"}}/>
            <select value={r.op} onChange={e=>updRow(r.id,"op",e.target.value)}
              style={{border:`1px solid ${T.border}`,borderRadius:4,padding:"3px 6px",fontSize:12,color:T.t2,outline:"none"}}>
              {["等于","不等于","包含","不为空","为空"].map(op=><option key={op}>{op}</option>)}
            </select>
            <input value={r.expected} onChange={e=>updRow(r.id,"expected",e.target.value)} placeholder="期望值"
              style={{border:"none",outline:"none",fontSize:12,fontFamily:"monospace",color:T.t1,padding:"4px 0",width:"100%"}}/>
            <button onClick={()=>delRow(r.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.t4,lineHeight:0,padding:4}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=T.danger}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=T.t4}><Trash2 size={12}/></button>
          </div>
        ))}
        <button onClick={addRow} style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",color:T.t3,fontSize:12}}
          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=T.primary}
          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=T.t3}><Plus size={11}/>添加项</button>
      </div>
    </div>
  );
}

function BodyDetail({a,upd}:{a:AssertRow;upd:(p:Partial<AssertRow>)=>void}){
  const rows=a.bodyRows;
  const addRow=()=>upd({bodyRows:[...rows,{id:"br"+Date.now(),expr:"",op:"等于",expected:""}]});
  const updRow=(id:string,k:string,v:string)=>upd({bodyRows:rows.map(r=>r.id===id?{...r,[k]:v}:r)});
  const delRow=(id:string)=>upd({bodyRows:rows.filter(r=>r.id!==id)});
  const ph=a.bodySubType==="jsonpath"?"$.data.token":a.bodySubType==="xpath"?"/response/data/token":"token=(\\w+)";
  return(
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:11,fontWeight:600,color:T.t3}}>断言类型</span>
        <div style={{display:"inline-flex",border:`1px solid ${T.border}`,borderRadius:6,overflow:"hidden"}}>
          {(["jsonpath","xpath","regex"] as const).map(m=>(
            <button key={m} onClick={()=>upd({bodySubType:m})}
              style={{padding:"4px 12px",fontSize:12,fontWeight:500,border:"none",cursor:"pointer",
                background:a.bodySubType===m?T.primary:"transparent",
                color:a.bodySubType===m?"#fff":T.t3}}>
              {m==="jsonpath"?"JSONPath":m==="xpath"?"XPath":"Regex"}
            </button>
          ))}
        </div>
      </div>
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 100px 1fr 36px",background:"#FAFAFA",borderBottom:`1px solid ${T.border}`,padding:"5px 10px",gap:8}}>
          {["表达式","比较条件","期望值",""].map((h,i)=><div key={i} style={{fontSize:10,fontWeight:600,color:T.t3}}>{h}</div>)}
        </div>
        {rows.map((r,i)=>(
          <div key={r.id} style={{display:"grid",gridTemplateColumns:"1fr 100px 1fr 36px",alignItems:"center",borderBottom:i<rows.length-1?`1px solid ${T.border}`:"none",padding:"3px 10px",gap:8}}>
            <input value={r.expr} onChange={e=>updRow(r.id,"expr",e.target.value)} placeholder={ph}
              style={{border:"none",outline:"none",fontSize:12,fontFamily:"monospace",color:T.primary,padding:"4px 0",width:"100%"}}/>
            <select value={r.op} onChange={e=>updRow(r.id,"op",e.target.value)}
              style={{border:`1px solid ${T.border}`,borderRadius:4,padding:"3px 6px",fontSize:12,color:T.t2,outline:"none"}}>
              {BODY_OPS.map(op=><option key={op}>{op}</option>)}
            </select>
            <input value={r.expected} onChange={e=>updRow(r.id,"expected",e.target.value)} placeholder="期望值"
              style={{border:"none",outline:"none",fontSize:12,fontFamily:"monospace",color:T.t1,padding:"4px 0",width:"100%"}}/>
            <button onClick={()=>delRow(r.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.t4,lineHeight:0,padding:4}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=T.danger}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=T.t4}><Trash2 size={12}/></button>
          </div>
        ))}
        <button onClick={addRow} style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",color:T.t3,fontSize:12}}
          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=T.primary}
          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=T.t3}><Plus size={11}/>添加项</button>
      </div>
    </div>
  );
}

function TimeDetail({a,upd}:{a:AssertRow;upd:(p:Partial<AssertRow>)=>void}){
  return(
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",alignItems:"flex-end",gap:10}}>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:4}}>比较条件</div>
          <select value={a.timeOp} onChange={e=>upd({timeOp:e.target.value})}
            style={{height:32,padding:"0 10px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t2,outline:"none",width:130}}
            onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}>
            {["小于","小于等于","大于","大于等于","等于"].map(op=><option key={op}>{op}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:4}}>阈值 (ms)</div>
          <input type="number" value={a.timeMs} onChange={e=>upd({timeMs:+e.target.value})} min={1}
            style={{height:32,padding:"0 12px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:13,fontWeight:600,color:T.t1,outline:"none",width:120}}
            onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
        <span style={{fontSize:12,color:T.t3,paddingBottom:6}}>ms</span>
      </div>
      <div style={{display:"flex",gap:6}}>
        {[200,500,1000,3000,5000].map(ms=>(
          <button key={ms} onClick={()=>upd({timeMs:ms})}
            style={{padding:"3px 10px",borderRadius:4,fontSize:11,cursor:"pointer",
              border:`1px solid ${a.timeMs===ms?T.primary:T.border}`,
              background:a.timeMs===ms?`${T.primary}0D`:"transparent",
              color:a.timeMs===ms?T.primary:T.t3}}>
            {ms>=1000?`${ms/1000}s`:`${ms}ms`}
          </button>
        ))}
      </div>
    </div>
  );
}

function VarDetail({a,upd}:{a:AssertRow;upd:(p:Partial<AssertRow>)=>void}){
  const rows=a.varRows;
  const addRow=()=>upd({varRows:[...rows,{id:"vr"+Date.now(),varName:"",op:"不为空",expected:""}]});
  const updRow=(id:string,k:string,v:string)=>upd({varRows:rows.map(r=>r.id===id?{...r,[k]:v}:r)});
  const delRow=(id:string)=>upd({varRows:rows.filter(r=>r.id!==id)});
  return(
    <div style={{padding:16}}>
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 120px 1fr 36px",background:"#FAFAFA",borderBottom:`1px solid ${T.border}`,padding:"5px 10px",gap:8}}>
          {["变量名","比较条件","期望值",""].map((h,i)=><div key={i} style={{fontSize:10,fontWeight:600,color:T.t3}}>{h}</div>)}
        </div>
        {rows.map((r,i)=>(
          <div key={r.id} style={{display:"grid",gridTemplateColumns:"1fr 120px 1fr 36px",alignItems:"center",borderBottom:i<rows.length-1?`1px solid ${T.border}`:"none",padding:"3px 10px",gap:8}}>
            <input value={r.varName} onChange={e=>updRow(r.id,"varName",e.target.value)} placeholder="变量名"
              style={{border:"none",outline:"none",fontSize:12,fontFamily:"monospace",color:T.primary,padding:"4px 0",width:"100%"}}/>
            <select value={r.op} onChange={e=>updRow(r.id,"op",e.target.value)}
              style={{border:`1px solid ${T.border}`,borderRadius:4,padding:"3px 6px",fontSize:12,color:T.t2,outline:"none"}}>
              {ALL_CON.map(op=><option key={op}>{op}</option>)}
            </select>
            <input value={r.expected} onChange={e=>updRow(r.id,"expected",e.target.value)} placeholder="期望值"
              style={{border:"none",outline:"none",fontSize:12,fontFamily:"monospace",color:T.t1,padding:"4px 0",width:"100%"}}/>
            <button onClick={()=>delRow(r.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.t4,lineHeight:0,padding:4}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=T.danger}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=T.t4}><Trash2 size={12}/></button>
          </div>
        ))}
        <button onClick={addRow} style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",color:T.t3,fontSize:12}}
          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=T.primary}
          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=T.t3}><Plus size={11}/>添加变量</button>
      </div>
    </div>
  );
}

function ScriptDetail({a,upd}:{a:AssertRow;upd:(p:Partial<AssertRow>)=>void}){
  return(
    <div style={{padding:16,display:"flex",flexDirection:"column",gap:12}}>
      <div style={{flex:1,minHeight:160,display:"flex",flexDirection:"column",border:`1px solid ${T.border}`,borderRadius:5,overflow:"hidden"}}>
        <MonacoEditor value={a.script} onChange={v=>upd({script:v})} language="javascript"/>
      </div>
      <div style={{padding:"8px 10px",borderRadius:5,background:"#FAFAFA",border:`1px solid ${T.border}`,fontSize:11,color:T.t3,lineHeight:1.7}}>
        <span style={{fontFamily:"monospace",color:T.primary}}>pm.expect(value).to.eql(expected)</span> · <span style={{fontFamily:"monospace",color:T.warning}}>pm.test(name, fn)</span> · <span style={{fontFamily:"monospace",color:T.danger}}>pm.expect.fail(msg)</span>
      </div>
      <div>
        <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:4}}>说明 <span style={{fontWeight:400}}>(选填)</span></div>
        <input value={a.desc} onChange={e=>upd({desc:e.target.value})} placeholder="描述此断言的用途"
          style={{width:"100%",boxSizing:"border-box",padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,color:T.t1,outline:"none"}}
          onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
      </div>
    </div>
  );
}

// ── Main AssertMasterDetail ───────────────────────────────────────────────────
function AssertSection({ rows, onChange }:{ rows:AssertRow[]; onChange:(r:AssertRow[])=>void }) {
  const [selId, setSelId] = useState<string|null>(rows[0]?.id ?? null);
  const [addOpen, setAddOpen] = useState(false);
  const sel = rows.find(a => a.id === selId) ?? null;

  const add = (kind: AssertKind) => {
    const na = mkAssertRow(kind, rows.length);
    onChange([...rows, na]);
    setSelId(na.id);
    setAddOpen(false);
  };
  const del = (id: string) => {
    const rest = rows.filter(a => a.id !== id);
    onChange(rest);
    if (selId === id) setSelId(rest[0]?.id ?? null);
  };
  const upd = (id: string, patch: Partial<AssertRow>) => onChange(rows.map(a => a.id===id ? {...a,...patch} : a));
  const move = (id: string, dir: -1|1) => {
    const i = rows.findIndex(a => a.id === id);
    if (i < 0) return;
    const ni = i + dir;
    if (ni < 0 || ni >= rows.length) return;
    const next = [...rows];
    [next[i], next[ni]] = [next[ni], next[i]];
    onChange(next);
  };
  const copy = (id: string) => {
    const src = rows.find(a => a.id === id);
    if (!src) return;
    const na: AssertRow = {...src, id:"a"+Date.now(), name:src.name+" 副本"};
    const idx = rows.findIndex(a => a.id === id);
    const next = [...rows];
    next.splice(idx+1, 0, na);
    onChange(next);
    setSelId(na.id);
  };

  return (
    <div style={{flex:1,display:"flex",minHeight:0,overflow:"hidden"}}>

      {/* ── Left list ── */}
      <div style={{width:200,flexShrink:0,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",background:"#FAFAFA"}}>

        {/* Add button */}
        <div style={{padding:"10px 10px 8px",position:"relative"}}>
          <button onClick={()=>setAddOpen(v=>!v)}
            style={{width:"100%",padding:"7px 0",borderRadius:6,border:"none",background:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
            <Plus size={12}/>添加断言<ChevronDown size={10}/>
          </button>
          {addOpen&&(
            <>
              <div onClick={()=>setAddOpen(false)} style={{position:"fixed",inset:0,zIndex:1000}}/>
              <div style={{position:"absolute",top:"calc(100% - 2px)",left:10,right:10,zIndex:1001,background:"#fff",border:`1px solid ${T.border}`,borderRadius:7,boxShadow:"0 4px 16px rgba(0,0,0,0.10)",padding:4}}>
                {ASSERT_KINDS.map(k=>(
                  <button key={k} onClick={()=>add(k)}
                    style={{width:"100%",display:"flex",alignItems:"center",padding:"7px 10px",background:"transparent",border:"none",cursor:"pointer",borderRadius:5,textAlign:"left",fontSize:12,color:T.t1}}
                    onMouseEnter={e=>(e.currentTarget.style.background=T.bg)}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    {ASSERT_KIND_CFG[k].label}断言
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Assert list */}
        <div style={{flex:1,overflowY:"auto",paddingBottom:4}}>
          {rows.length===0
            ? <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",padding:"24px 12px",color:T.t4,gap:6}}>
                <Shield size={22} style={{opacity:.3}}/>
                <span style={{fontSize:12}}>暂无断言</span>
                <span style={{fontSize:11,color:T.t4}}>建议添加状态码断言</span>
              </div>
            : rows.map((a,i)=>{
                const cfg=ASSERT_KIND_CFG[a.kind];
                const Icon=cfg.icon;
                const active=selId===a.id;
                return (
                  <div key={a.id} onClick={()=>setSelId(a.id)}
                    style={{padding:"7px 10px",display:"flex",alignItems:"center",gap:6,cursor:"pointer",
                      background:active?`${T.primary}0D`:"transparent",
                      borderLeft:`2px solid ${active?T.primary:"transparent"}`,
                      transition:"background .1s"}}
                    onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLElement).style.background=`${T.t4}14`;}}
                    onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLElement).style.background="transparent";}}>
                    {/* Toggle */}
                    <div onClick={e=>{e.stopPropagation();upd(a.id,{enabled:!a.enabled});}}>
                      <SmToggle2 on={a.enabled} onChange={v=>upd(a.id,{enabled:v})}/>
                    </div>
                    {/* Kind badge */}
                    <span style={{fontSize:10,fontWeight:600,color:cfg.color,background:cfg.bg,borderRadius:3,padding:"1px 5px",flexShrink:0}}>
                      {cfg.label}
                    </span>
                    {/* Name */}
                    <span style={{flex:1,fontSize:12,color:active?T.primary:a.enabled?T.t1:T.t4,fontWeight:active?500:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {a.name}
                    </span>
                    {/* Up/Down */}
                    <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
                      <button onClick={e=>{e.stopPropagation();move(a.id,-1);}} disabled={i===0}
                        style={{background:"none",border:"none",cursor:i===0?"default":"pointer",lineHeight:0,padding:0,color:T.t3,opacity:i===0?0.25:1}}>
                        <ChevronDown size={10} style={{transform:"rotate(180deg)"}}/>
                      </button>
                      <button onClick={e=>{e.stopPropagation();move(a.id,1);}} disabled={i===rows.length-1}
                        style={{background:"none",border:"none",cursor:i===rows.length-1?"default":"pointer",lineHeight:0,padding:0,color:T.t3,opacity:i===rows.length-1?0.25:1}}>
                        <ChevronDown size={10}/>
                      </button>
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>

      {/* ── Right detail ── */}
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",background:"#fff"}}>
        {!sel
          ? <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:T.t4}}>
              <Shield size={28} style={{opacity:.25}}/>
              <span style={{fontSize:12}}>请选择或添加断言</span>
            </div>
          : <>
              {/* Detail header */}
              <div style={{padding:"9px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,background:"#FAFAFA",flexShrink:0}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:600,color:T.t3,marginBottom:3}}>断言名称</div>
                  <input value={sel.name} onChange={e=>upd(sel.id,{name:e.target.value})}
                    style={{width:"100%",boxSizing:"border-box",padding:"4px 8px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:13,fontWeight:500,color:T.t1,outline:"none"}}
                    onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,paddingTop:16}}>
                  {/* Kind badge */}
                  {(()=>{const cfg=ASSERT_KIND_CFG[sel.kind];const Icon=cfg.icon;return(
                    <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,padding:"2px 8px",borderRadius:4,background:cfg.bg,color:cfg.color,fontWeight:600}}>
                      <Icon size={11}/>{cfg.label}
                    </span>
                  );})()}
                  <button onClick={()=>copy(sel.id)}
                    style={{fontSize:12,padding:"3px 10px",border:`1px solid ${T.border}`,borderRadius:5,background:"#fff",color:T.t2,cursor:"pointer"}}>
                    复制
                  </button>
                  <button onClick={()=>del(sel.id)}
                    style={{fontSize:12,padding:"3px 10px",border:`1px solid ${T.danger}30`,borderRadius:5,background:`${T.danger}06`,color:T.danger,cursor:"pointer"}}>
                    删除
                  </button>
                  <SmToggle2 on={sel.enabled} onChange={v=>upd(sel.id,{enabled:v})}/>
                </div>
              </div>

              {/* Detail content */}
              <div style={{flex:1,overflowY:"auto"}}>
                {sel.kind==="status"     && <StatusDetail a={sel} upd={p=>upd(sel.id,p)}/>}
                {sel.kind==="resp-header"&& <HeaderDetail a={sel} upd={p=>upd(sel.id,p)}/>}
                {sel.kind==="resp-body"  && <BodyDetail   a={sel} upd={p=>upd(sel.id,p)}/>}
                {sel.kind==="resp-time"  && <TimeDetail   a={sel} upd={p=>upd(sel.id,p)}/>}
                {sel.kind==="variable"   && <VarDetail    a={sel} upd={p=>upd(sel.id,p)}/>}
                {sel.kind==="script"     && <ScriptDetail a={sel} upd={p=>upd(sel.id,p)}/>}
              </div>
            </>
        }
      </div>
    </div>
  );
}

// ─── Initial state factory ──────────────────────────────────────────────────────
function initState(mode:DrawerMode) {
  const isNew=mode==="new";
  return {
    name:   isNew?"":mode==="ai"?"SQL注入检查 — 特殊字符过滤":"登录认证 — 正常登录",
    level:  (isNew?"P1":"P0") as Level,
    tags:   isNew?[]:(mode==="ai"?["安全","注入"]:["登录","正向"]) as string[],
    params: [
      {id:"p1",enabled:true, name:"_t",    value:"{{timestamp}}",desc:"防缓存",src:"inherited" as ParamSrc},
      {id:"p2",enabled:false,name:"debug", value:"true",         desc:"调试",  src:"disabled"  as ParamSrc},
    ],
    headers:[
      {id:"h1",enabled:true,name:"Authorization",value:"Bearer {{token}}",desc:"",src:"overridden" as ParamSrc},
      {id:"h2",enabled:true,name:"Content-Type", value:"application/json",desc:"",src:"inherited"  as ParamSrc},
    ],
    bodyType:"json" as BodyType,
    body: isNew
      ? '{\n  "username": "",\n  "password": ""\n}'
      : mode==="ai"
      ? "{\n  \"username\": \"admin' OR 1=1 --\",\n  \"password\": \"anything\"\n}"
      : "{\n  \"username\": \"test_user@example.com\",\n  \"password\": \"Passw0rd!\"\n}",
    pre:    isNew?[]:[
      {id:"pre1",enabled:true,name:"生成时间戳",type:"JS脚本" as ProcType,content:"pm.variables.set('timestamp', Date.now())\npm.request.headers['X-Timestamp'] = pm.variables.get('timestamp')\n"},
    ] as PrePost[],
    post:   isNew?[]:[
      {id:"post1",enabled:true,name:"提取 Token",type:"变量提取" as ProcType,content:"",extractPath:"$.data.token",extractVar:"token",extractMethod:"JSONPath" as const},
    ] as PrePost[],
    asserts:isNew?[]:[
      {...mkAssertRow("status",0),  name:"状态码 200",  statusOp:"等于", statusExpected:"200"},
      {...mkAssertRow("resp-body",1),name:"code 等于 0", bodyRows:[{id:"br1",expr:"$.code",op:"等于",expected:"0"}]},
      {...mkAssertRow("resp-body",2),name:"token 存在",  bodyRows:[{id:"br1",expr:"$.data.token",op:"存在",expected:""}]},
    ] as AssertRow[],
  };
}

const MOCK_RESP=`{\n  "code": 0,\n  "message": "success",\n  "data": {\n    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",\n    "userId": "u_10086",\n    "expireAt": 1753833600\n  }\n}`;

// ─── Saved data contract ────────────────────────────────────────────────────────
export interface SavedCaseData {
  name: string;
  level: Level;
  tags: string[];
  caseType: string;
  source: "manual" | "ai";
  enabled: boolean;
}

// ─── Main Drawer ────────────────────────────────────────────────────────────────
export interface ApiCaseDrawerProps {
  mode: DrawerMode;
  method?: string; path?: string; endpointName?: string;
  onClose: () => void; onSaved?: (data: SavedCaseData) => void;
}

export function ApiCaseDrawer({
  mode, method="POST",
  path="/user-auth/auth/v1/back-unified-login/by-pwd",
  endpointName="登录认证 · 登录",
  onClose, onSaved,
}: ApiCaseDrawerProps) {
  const s = initState(mode);
  const [name,       setName]       = useState(s.name);
  const [level,      setLevel]      = useState<Level>(s.level);
  const [tags,       setTags]       = useState<string[]>(s.tags);
  const [caseType,   setCaseType]   = useState("功能测试");
  const [enabled,    setEnabled]    = useState(true);
  const [tagInput,   setTagInput]   = useState("");
  const [addingTag,  setAddingTag]  = useState(false);
  const [reqTab,     setReqTab]     = useState<ReqTab>("Body");
  const [bodyType,   setBodyType]   = useState<BodyType>(s.bodyType);
  const [body,       setBody]       = useState(s.body);
  const [params,     setParams]     = useState<ParamRow[]>(s.params);
  const [headers,    setHeaders]    = useState<ParamRow[]>(s.headers);
  const [pre,        setPre]        = useState<PrePost[]>(s.pre);
  const [post,       setPost]       = useState<PrePost[]>(s.post);
  const [asserts,    setAsserts]    = useState<AssertRow[]>(s.asserts);
  const [isDirty,    setIsDirty]    = useState(false);
  const [nameErr,    setNameErr]    = useState("");
  const [saving,     setSaving]     = useState(false);
  const [saveOk,     setSaveOk]     = useState(false);

  // Response panel
  const [sending,    setSending]    = useState(false);
  const [hasSent,    setHasSent]    = useState(false);
  const [respTab,    setRespTab]    = useState<RespTab>("响应体");

  // Close confirm
  const [askClose,   setAskClose]   = useState(false);

  const dirty = () => setIsDirty(true);

  const handleSend = () => {
    setSending(true); setHasSent(false);
    setTimeout(()=>{ setSending(false); setHasSent(true); }, 1400);
  };

  const handleSave = () => {
    if (!name.trim()) { setNameErr("用例名称不能为空"); return; }
    setNameErr(""); setSaving(true);
    setTimeout(()=>{
      setSaving(false); setSaveOk(true); setIsDirty(false);
      onSaved?.({ name: name.trim(), level, tags, caseType, source: mode==="ai" ? "ai" : "manual", enabled });
      setTimeout(()=>setSaveOk(false),2500);
    }, 900);
  };

  const tryClose = () => { if(isDirty){ setAskClose(true); } else { onClose(); } };

  const LEVELS: Level[] = ["P0","P1","P2","P3"];
  const REQ_TABS: ReqTab[] = ["Params","Auth","Headers","Body","前置处理","后置处理","断言","设置"];
  const BODY_TYPES: {k:BodyType;l:string}[] = [
    {k:"none",l:"none"},{k:"form-data",l:"form-data"},{k:"urlencoded",l:"urlencoded"},
    {k:"json",l:"json"},{k:"xml",l:"xml"},{k:"raw",l:"raw"},
  ];
  const RESP_TABS: RespTab[] = ["响应体","Headers","Cookies","断言结果"];
  const methodColor = METHOD_COLOR[method]??T.t3;

  const levelCfg: Record<Level,{bg:string;color:string}> = {
    P0:{bg:"#FFF0F0",color:T.danger}, P1:{bg:"#FFF7E6",color:T.warning},
    P2:{bg:"#E8F0FF",color:T.primary},P3:{bg:T.bg,     color:T.t3},
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={tryClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.18)",zIndex:200}}/>

      {/* Drawer */}
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:820,zIndex:201,background:"#fff",boxShadow:"-4px 0 24px rgba(0,0,0,0.11)",display:"flex",flexDirection:"column"}}>

        {/* ① Header ──────────────────────────────────────────────── */}
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {mode==="ai"&&(
              <div style={{width:34,height:34,borderRadius:8,background:`${T.purple}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Bot size={17} color={T.purple}/>
              </div>
            )}
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,color:T.t1,marginBottom:4}}>
                {mode==="new"?"创建用例":mode==="ai"?"查看 AI 候选用例":"编辑用例"}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:T.t3}}>
                <span style={{fontWeight:700,fontSize:11,padding:"2px 6px",borderRadius:3,background:`${methodColor}12`,color:methodColor}}>{method}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",color:T.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:340}}>{path}</span>
                <span style={{color:T.t4}}>·</span>
                <span>{endpointName}</span>
              </div>
            </div>
            {isDirty&&<span style={{fontSize:11,color:T.warning,display:"flex",alignItems:"center",gap:3}}><span style={{width:5,height:5,borderRadius:"50%",background:T.warning,display:"inline-block"}}/>未保存</span>}
            <button onClick={tryClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:4,borderRadius:5}}
              onMouseEnter={e=>(e.currentTarget.style.background=T.bg)} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* ② Basic info strip ─────────────────────────────────────── */}
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          {/* Name row */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <div style={{flex:1,position:"relative"}}>
              <input value={name} onChange={e=>{setName(e.target.value);dirty();setNameErr("");}} maxLength={255}
                placeholder="请输入用例名称"
                style={{width:"100%",boxSizing:"border-box",padding:"8px 60px 8px 12px",border:`1.5px solid ${nameErr?T.danger:T.border}`,borderRadius:7,fontSize:13,color:T.t1,outline:"none"}}
                onFocus={e=>{if(!nameErr)e.target.style.borderColor=T.primary;}}
                onBlur={e=>{if(!nameErr)e.target.style.borderColor=T.border;}}/>
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:11,color:T.t4,pointerEvents:"none"}}>{name.length}/255</span>
            </div>
            {/* Send button */}
            <button onClick={handleSend} disabled={sending}
              style={{display:"flex",alignItems:"center",gap:6,padding:"8px 20px",border:"none",borderRadius:7,background:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:sending?"not-allowed":"pointer",flexShrink:0}}>
              {sending?<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>:<Play size={13}/>}
              {sending?"发送中":"发送"}
            </button>
          </div>
          {nameErr&&<div style={{fontSize:11,color:T.danger,marginBottom:6}}>{nameErr}</div>}

          {/* Level + Tags */}
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {/* Level segmented */}
            <div style={{display:"inline-flex",background:T.bg,borderRadius:6,padding:3,flexShrink:0}}>
              {LEVELS.map(l=>{
                const a=l===level, c=levelCfg[l];
                return <button key={l} onClick={()=>{setLevel(l);dirty();}} style={{padding:"3px 12px",borderRadius:5,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:a?c.bg:"transparent",color:a?c.color:T.t4}}>{l}</button>;
              })}
            </div>
            {/* Tags */}
            {tags.map(t=>(
              <span key={t} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,padding:"3px 9px",borderRadius:5,background:`${T.primary}0E`,color:T.primary}}>
                {t}
                <button onClick={()=>{setTags(tags.filter(x=>x!==t));dirty();}} style={{background:"none",border:"none",cursor:"pointer",lineHeight:0,color:`${T.primary}70`,padding:0}}><X size={10}/></button>
              </span>
            ))}
            {addingTag
              ? <input autoFocus value={tagInput} onChange={e=>setTagInput(e.target.value)}
                  onBlur={()=>{if(tagInput.trim()&&!tags.includes(tagInput.trim())){setTags([...tags,tagInput.trim()]);dirty();}setTagInput("");setAddingTag(false);}}
                  onKeyDown={e=>{if(e.key==="Enter"){if(tagInput.trim()&&!tags.includes(tagInput.trim())){setTags([...tags,tagInput.trim()]);dirty();}setTagInput("");setAddingTag(false);}if(e.key==="Escape"){setTagInput("");setAddingTag(false);}}}
                  style={{fontSize:12,padding:"3px 9px",border:`1px solid ${T.primary}`,borderRadius:5,outline:"none",width:80,color:T.t1}}/>
              : <button onClick={()=>setAddingTag(true)} style={{fontSize:12,padding:"3px 10px",border:`1px dashed ${T.border}`,borderRadius:5,background:"transparent",color:T.t4,cursor:"pointer"}}>+ 标签</button>
            }
          </div>
        </div>

        {/* ③ Request tab bar — same visual as interface editor ────── */}
        <div style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${T.border}`,background:"#fff",flexShrink:0,paddingLeft:4}}>
          {REQ_TABS.map(tab=>{
            const a=tab===reqTab;
            return (
              <button key={tab} onClick={()=>setReqTab(tab)}
                style={{height:44,padding:"0 16px",border:"none",borderBottom:`2px solid ${a?T.warning:"transparent"}`,background:"transparent",fontSize:13,fontWeight:a?600:400,color:a?T.warning:T.t2,cursor:"pointer",whiteSpace:"nowrap",transition:"color .1s"}}>
                {tab}
              </button>
            );
          })}
          <div style={{flex:1}}/>
          <span style={{fontSize:11,color:T.t4,marginRight:14,display:"flex",alignItems:"center",gap:3}}><Info size={11}/>修改不影响接口定义</span>
        </div>

        {/* ④ + ⑤ Split container: request (top half) + response (bottom half) */}
        <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* ④ Request content area */}
        <div style={{flex:"3 1 0",minHeight:0,display:"flex",flexDirection:"column",overflow:"hidden"}}>

          {/* Params */}
          {reqTab==="Params"&&(
            <div style={{flex:1,overflowY:"auto"}}>
              <div style={{padding:"10px 16px 4px",fontSize:12,fontWeight:600,color:T.t2}}>Query 参数</div>
              <ParamTable rows={params} onChange={r=>{setParams(r);dirty();}}/>
            </div>
          )}

          {/* Headers */}
          {reqTab==="Headers"&&(
            <div style={{flex:1,overflowY:"auto"}}>
              <div style={{padding:"10px 16px 4px",fontSize:12,fontWeight:600,color:T.t2}}>请求 Headers</div>
              <ParamTable rows={headers} onChange={r=>{setHeaders(r);dirty();}}/>
            </div>
          )}

          {/* Auth */}
          {reqTab==="Auth"&&(
            <div style={{flex:1,overflowY:"auto",display:"flex",alignItems:"center",justifyContent:"center",color:T.t4}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:13,color:T.t2,marginBottom:6}}>鉴权配置</div>
                <div style={{fontSize:12,color:T.t3}}>继承接口全局鉴权设置（Bearer Token）</div>
              </div>
            </div>
          )}

          {/* Body — full-height Monaco editor, same as interface editor */}
          {reqTab==="Body"&&(
            <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
              {/* Body type selector */}
              <div style={{padding:"8px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:2,flexShrink:0,background:"#fff"}}>
                {BODY_TYPES.map(bt=>{
                  const a=bodyType===bt.k;
                  return (
                    <button key={bt.k} onClick={()=>{setBodyType(bt.k);dirty();}}
                      style={{padding:"3px 12px",borderRadius:5,border:`1px solid ${a?T.primary+"50":T.border}`,background:a?`${T.primary}0C`:"transparent",fontSize:12,color:a?T.primary:T.t3,cursor:"pointer"}}>
                      {bt.l}
                    </button>
                  );
                })}
                {["json","xml","raw"].includes(bodyType)&&(
                  <button onClick={()=>{try{setBody(JSON.stringify(JSON.parse(body),null,2))}catch{}}}
                    style={{marginLeft:"auto",fontSize:11,color:T.t3,background:"none",border:`1px solid ${T.border}`,borderRadius:4,padding:"2px 9px",cursor:"pointer"}}>
                    格式化
                  </button>
                )}
              </div>
              {/* Monaco */}
              {bodyType==="none"
                ? <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:T.t4,fontSize:12}}>该请求没有 Body</div>
                : ["json","xml","raw"].includes(bodyType)
                  ? <MonacoEditor value={body} onChange={v=>{setBody(v);dirty();}} language={bodyType==="json"?"json":bodyType==="xml"?"xml":"text"}/>
                  : (
                    <div style={{flex:1,overflowY:"auto"}}>
                      <ParamTable rows={params.slice(0,2)} onChange={r=>{setParams(r);dirty();}}/>
                    </div>
                  )
              }
            </div>
          )}

          {/* 前置处理 */}
          {reqTab==="前置处理"&&(
            <ProcMasterDetail
              procs={pre}
              onChange={list=>{setPre(list);dirty();}}
              emptyHint="暂无前置处理器"
              allowedTypes={PRE_PROC_TYPES}
            />
          )}

          {/* 后置处理 */}
          {reqTab==="后置处理"&&(
            <ProcMasterDetail
              procs={post}
              onChange={list=>{setPost(list);dirty();}}
              emptyHint="暂无后置处理器"
              allowedTypes={POST_PROC_TYPES}
            />
          )}

          {/* 断言 */}
          {reqTab==="断言"&&(
            <AssertSection rows={asserts} onChange={r=>{setAsserts(r);dirty();}}/>
          )}

          {/* 设置 */}
          {reqTab==="设置"&&(
            <CaseSettingsTab/>
          )}
        </div>

        {/* ⑤ Response panel — always visible, splits space with request area */}
        <div style={{flex:"2 1 0",minHeight:140,borderTop:`2px solid ${T.border}`,background:"#fff",display:"flex",flexDirection:"column",overflow:"hidden"}}>
          {/* Response tab bar */}
          <div style={{height:40,flexShrink:0,display:"flex",alignItems:"center",paddingLeft:16,paddingRight:4,borderBottom:`1px solid ${T.border}`,gap:10,background:"#FAFAFA"}}>
            <span style={{fontSize:13,fontWeight:600,color:T.t1}}>响应内容</span>
            {hasSent&&(
              <>
                <span style={{padding:"1px 8px",borderRadius:4,fontSize:12,fontWeight:700,background:"#E8FFEA",color:T.success}}>200 OK</span>
                <span style={{fontSize:12,color:T.t3}}>187 ms</span>
                <span style={{fontSize:12,color:T.t3}}>1.84 KB</span>
              </>
            )}
            <div style={{flex:1}}/>
            <div style={{display:"flex"}}>
              {RESP_TABS.map(t=>(
                <button key={t} onClick={()=>setRespTab(t)}
                  style={{height:40,padding:"0 12px",fontSize:12,fontWeight:500,border:"none",borderBottom:`2px solid ${respTab===t?T.primary:"transparent"}`,background:"transparent",cursor:"pointer",color:respTab===t?T.primary:T.t3}}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {/* Response body or placeholder */}
          <div style={{flex:1,overflowY:"auto"}}>
            {!hasSent&&(
              <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:T.t4}}>
                <Play size={24} style={{opacity:.35}}/>
                <span style={{fontSize:12}}>点击「发送」获取响应内容</span>
              </div>
            )}
            {hasSent&&(
              <div style={{padding:"10px 16px"}}>
                {respTab==="响应体"&&<pre style={{margin:0,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:T.t1,lineHeight:1.7}}>{MOCK_RESP}</pre>}
                {respTab==="断言结果"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:6,paddingTop:4}}>
                    {asserts.length===0&&<div style={{color:T.t4,fontSize:12}}>没有断言规则</div>}
                    {asserts.map((a,i)=>{
                      const cfg=ASSERT_KIND_CFG[a.kind];
                      const Icon=cfg.icon;
                      const pass=i%3!==1;
                      return (
                        <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,padding:"5px 0",borderBottom:`1px solid ${T.border}`}}>
                          {pass
                            ? <CheckCircle size={13} color={T.success}/>
                            : <AlertTriangle size={13} color={T.danger}/>}
                          <span style={{fontSize:10,fontWeight:600,color:cfg.color,background:cfg.bg,borderRadius:3,padding:"1px 5px",flexShrink:0}}>{cfg.label}</span>
                          <span style={{flex:1,color:T.t2}}>{a.name}</span>
                          <span style={{color:pass?T.success:T.danger,fontWeight:500}}>{pass?"通过":"失败"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {(respTab==="Headers"||respTab==="Cookies")&&<div style={{color:T.t4,fontSize:12,paddingTop:8}}>（响应 {respTab}）</div>}
              </div>
            )}
          </div>
        </div>{/* end response panel */}
        </div>{/* end split container */}

        {/* ⑥ Footer ────────────────────────────────────────────────── */}
        <div style={{padding:"10px 20px",borderTop:`1px solid ${T.border}`,flexShrink:0,display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1,fontSize:12}}>
            {saveOk&&<span style={{color:T.success,display:"flex",alignItems:"center",gap:4}}><CheckCircle size={12}/>已保存</span>}
          </div>
          <button onClick={tryClose} style={{padding:"6px 18px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>取消</button>
          {mode!=="ai"&&(
            <button onClick={handleSave} disabled={saving}
              style={{display:"flex",alignItems:"center",gap:5,padding:"6px 20px",border:"none",borderRadius:6,background:saving?T.t4:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:saving?"not-allowed":"pointer"}}>
              {saving?<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>:<Save size={13}/>}
              {saving?"保存中…":mode==="new"?"创建":"保存"}
            </button>
          )}
          {mode==="ai"&&(
            <button onClick={handleSave} disabled={saving}
              style={{display:"flex",alignItems:"center",gap:5,padding:"6px 20px",border:"none",borderRadius:6,background:saving?T.t4:T.success,color:"#fff",fontSize:13,fontWeight:500,cursor:saving?"not-allowed":"pointer"}}>
              {saving?<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>:<Check size={13}/>}
              {saving?"采纳中…":"采纳并保存"}
            </button>
          )}
        </div>
      </div>

      {/* Close confirm */}
      {askClose&&(
        <>
          <div onClick={()=>setAskClose(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:300}}/>
          <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:301,background:"#fff",borderRadius:10,padding:"22px 26px",width:360,boxShadow:"0 8px 28px rgba(0,0,0,0.14)"}}>
            <div style={{display:"flex",gap:11,alignItems:"flex-start",marginBottom:18}}>
              <AlertTriangle size={17} color={T.warning} style={{flexShrink:0,marginTop:2}}/>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:T.t1,marginBottom:5}}>存在未保存的修改</div>
                <div style={{fontSize:13,color:T.t2,lineHeight:1.65}}>关闭后当前修改将丢失，是否确认关闭？</div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setAskClose(false)} style={{padding:"6px 16px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>继续编辑</button>
              <button onClick={onClose} style={{padding:"6px 16px",border:"none",borderRadius:6,background:T.danger,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"}}>放弃并关闭</button>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
