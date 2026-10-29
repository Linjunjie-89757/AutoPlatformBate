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
  Bot, Info,
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
interface AssertRow { id:string; enabled:boolean; type:string; path:string; op:string; expected:string; }
type ProcType = "JS脚本" | "变量提取" | "等待";
interface PrePost   { id:string; enabled:boolean; name:string; type:ProcType; content:string; extractPath?:string; extractVar?:string; extractMethod?:"JSONPath"|"正则"; waitMs?:number; }

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
const PROC_TYPE_CFG: Record<ProcType,{label:string;short:string;bg:string;color:string;desc:string}> = {
  "JS脚本":  {label:"JS脚本",  short:"JS",   bg:`${T.warning}14`,  color:T.warning, desc:"执行 JavaScript 脚本"},
  "变量提取":{label:"变量提取",short:"提取", bg:`${T.primary}12`,  color:T.primary, desc:"从响应中提取变量"},
  "等待":    {label:"等待",    short:"等待", bg:`${T.t4}18`,        color:T.t3,      desc:"插入等待延迟"},
};
const PROC_TYPES: ProcType[] = ["JS脚本","变量提取","等待"];

// ─── Processor master-detail panel ──────────────────────────────────────────────
function ProcMasterDetail({
  procs, onChange, emptyHint,
}: {
  procs: PrePost[];
  onChange: (list: PrePost[]) => void;
  emptyHint: string;
}) {
  const [selId, setSelId] = useState<string|null>(procs[0]?.id ?? null);
  const [addOpen, setAddOpen] = useState(false);

  const sel = procs.find(p => p.id === selId) ?? null;

  const addProc = (type: ProcType) => {
    const defaults: Record<ProcType, Partial<PrePost>> = {
      "JS脚本":   { name:"脚本处理器",  content:"// script\n" },
      "变量提取": { name:"变量提取",    content:"", extractPath:"$.data.token", extractVar:"token", extractMethod:"JSONPath" },
      "等待":     { name:"等待处理器",  waitMs:500 },
    };
    const np: PrePost = { id:uid(), enabled:true, type, ...defaults[type] } as PrePost;
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
                {PROC_TYPES.map(t=>{
                  const c=PROC_TYPE_CFG[t];
                  return (
                    <button key={t} onClick={()=>addProc(t)}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"transparent",border:"none",cursor:"pointer",borderRadius:5,textAlign:"left"}}
                      onMouseEnter={e=>(e.currentTarget.style.background=T.bg)}
                      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                      <span style={{width:20,height:20,borderRadius:4,background:c.bg,color:c.color,fontSize:10,fontWeight:700,fontFamily:"monospace",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{c.short}</span>
                      <span style={{fontSize:12,color:T.t1}}>{c.label}</span>
                    </button>
                  );
                })}
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
              <div style={{flex:1,overflowY:"auto",padding:"16px"}}>
                {sel.type==="JS脚本"&&(
                  <div style={{height:"100%",minHeight:120,display:"flex",flexDirection:"column",border:`1px solid ${T.border}`,borderRadius:5,overflow:"hidden"}}>
                    <MonacoEditor value={sel.content} onChange={v=>upd({...sel,content:v})} language="javascript"/>
                  </div>
                )}
                {sel.type==="变量提取"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:12,color:T.t3,width:60,flexShrink:0}}>提取方式</span>
                      <div style={{display:"inline-flex",background:T.bg,borderRadius:5,padding:2}}>
                        {(["JSONPath","正则"] as const).map(m=>(
                          <button key={m} onClick={()=>upd({...sel,extractMethod:m})}
                            style={{padding:"3px 12px",borderRadius:4,border:"none",fontSize:12,cursor:"pointer",background:sel.extractMethod===m?T.primary:"transparent",color:sel.extractMethod===m?"#fff":T.t3}}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:12,color:T.t3,width:60,flexShrink:0}}>{sel.extractMethod==="正则"?"正则式":"JSONPath"}</span>
                      <input value={sel.extractPath??""} onChange={e=>upd({...sel,extractPath:e.target.value})}
                        placeholder={sel.extractMethod==="正则"?"(.+)":"$.data.token"}
                        style={{flex:1,padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,fontFamily:"monospace",color:T.primary,outline:"none"}}
                        onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:12,color:T.t3,width:60,flexShrink:0}}>变量名</span>
                      <input value={sel.extractVar??""} onChange={e=>upd({...sel,extractVar:e.target.value})}
                        placeholder="token"
                        style={{flex:1,padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,fontFamily:"monospace",color:T.t1,outline:"none"}}
                        onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
                    </div>
                  </div>
                )}
                {sel.type==="等待"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{fontSize:13,fontWeight:500,color:T.t2}}>等待时长(ms)</div>
                    <div style={{display:"inline-flex",alignItems:"center",border:`1px solid ${T.border}`,borderRadius:6,overflow:"hidden"}}>
                      <button onClick={()=>upd({...sel,waitMs:Math.max(0,(sel.waitMs??500)-100)})}
                        style={{width:34,height:36,border:"none",borderRight:`1px solid ${T.border}`,background:"#FAFAFA",cursor:"pointer",fontSize:18,color:T.t2,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        −
                      </button>
                      <input type="number" value={sel.waitMs??500} min={0} max={60000}
                        onChange={e=>upd({...sel,waitMs:Number(e.target.value)})}
                        style={{width:84,height:36,border:"none",textAlign:"center",fontSize:14,fontWeight:500,color:T.t1,outline:"none",background:"#fff"}}/>
                      <button onClick={()=>upd({...sel,waitMs:(sel.waitMs??500)+100})}
                        style={{width:34,height:36,border:"none",borderLeft:`1px solid ${T.border}`,background:"#FAFAFA",cursor:"pointer",fontSize:18,color:T.t2,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
        }
      </div>
    </div>
  );
}

// ─── Assertion table ────────────────────────────────────────────────────────────
const ASSERT_TYPES = ["HTTP状态码","响应时间(ms)","JSONPath","XPath","响应Header","响应文本","JSON Schema"];
const OPS: Record<string,string[]> = {
  "HTTP状态码":  ["等于","不等于","包含于"],
  "响应时间(ms)":["小于","小于等于","大于"],
  "JSONPath":    ["等于","不等于","存在","包含","正则"],
  "XPath":       ["等于","存在","包含"],
  "响应Header":  ["等于","存在","包含"],
  "响应文本":    ["包含","等于","正则"],
  "JSON Schema": ["验证通过"],
};
function AssertSection({ rows, onChange }:{ rows:AssertRow[]; onChange:(r:AssertRow[])=>void }) {
  const upd=(id:string,f:keyof AssertRow,v:any)=>onChange(rows.map(r=>r.id===id?{...r,[f]:v}:r));
  const del=(id:string)=>onChange(rows.filter(r=>r.id!==id));
  const add=()=>onChange([...rows,{id:uid(),enabled:true,type:"HTTP状态码",path:"",op:"等于",expected:"200"}]);
  return (
    <div style={{padding:"12px 16px"}}>
      {rows.length===0&&(
        <div style={{padding:"8px 10px",borderRadius:6,background:"#FFF7E6",border:`1px solid ${T.warning}30`,fontSize:12,color:T.warning,marginBottom:12}}>
          建议至少添加 HTTP 状态码断言
        </div>
      )}
      {rows.map(a=>{
        const ops=OPS[a.type]??OPS["JSONPath"];
        const needPath=["JSONPath","XPath","响应Header"].includes(a.type);
        const needExp=a.op!=="存在"&&a.op!=="验证通过";
        const isSchema=a.type==="JSON Schema";
        return (
          <div key={a.id} style={{borderBottom:`1px solid ${T.border}`,padding:"6px 0"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <input type="checkbox" checked={a.enabled} onChange={e=>upd(a.id,"enabled",e.target.checked)} style={{cursor:"pointer",accentColor:T.primary,flexShrink:0}}/>
              <select value={a.type} onChange={e=>{const t=e.target.value;const newOp=(OPS[t]??OPS["JSONPath"])[0];upd(a.id,"type",t);setTimeout(()=>upd(a.id,"op",newOp),0);}}
                style={{padding:"4px 6px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,color:T.t1,outline:"none",background:"#fff",minWidth:108}}>
                {ASSERT_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
              {needPath
                ? <input value={a.path} onChange={e=>upd(a.id,"path",e.target.value)}
                    placeholder={a.type==="XPath"?"//root/item":"$.data.token"}
                    style={{flex:1,padding:"4px 8px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,color:T.primary,outline:"none",fontFamily:"monospace",minWidth:80}}
                    onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
                : <div style={{flex:1}}/>}
              <select value={a.op} onChange={e=>upd(a.id,"op",e.target.value)}
                style={{padding:"4px 6px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,color:T.t1,outline:"none",background:"#fff",minWidth:72}}>
                {ops.map(o=><option key={o}>{o}</option>)}
              </select>
              {needExp&&!isSchema&&(
                <input value={a.expected} onChange={e=>upd(a.id,"expected",e.target.value)} placeholder="期望值"
                  style={{width:100,padding:"4px 8px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,color:T.t1,outline:"none"}}
                  onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
              )}
              <button onClick={()=>del(a.id)} style={{background:"none",border:"none",cursor:"pointer",lineHeight:0,color:T.danger,padding:3}}><Trash2 size={11}/></button>
            </div>
            {isSchema&&(
              <textarea value={a.expected} onChange={e=>upd(a.id,"expected",e.target.value)}
                placeholder={'{\n  "type": "object",\n  "required": ["code"]\n}'}
                rows={4}
                style={{display:"block",width:"calc(100% - 28px)",marginLeft:28,marginTop:6,padding:"6px 8px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:T.t1,outline:"none",resize:"vertical",boxSizing:"border-box"}}
                onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
            )}
          </div>
        );
      })}
      <button onClick={add} style={{display:"flex",alignItems:"center",gap:5,marginTop:10,padding:"4px 12px",border:`1px solid ${T.primary}30`,borderRadius:6,background:`${T.primary}06`,color:T.primary,fontSize:12,cursor:"pointer"}}>
        <Plus size={11}/>添加断言
      </button>
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
    pre:    isNew?[]:[{id:"pre1",enabled:true,name:"生成时间戳",type:"JS脚本" as ProcType,content:"pm.environment.set('timestamp', Date.now())"}] as PrePost[],
    post:   isNew?[]:[{id:"post1",enabled:true,name:"提取 Token",type:"变量提取" as ProcType,content:"",extractPath:"$.data.token",extractVar:"token",extractMethod:"JSONPath" as const}] as PrePost[],
    asserts:isNew?[]:[
      {id:"a1",enabled:true,type:"HTTP状态码",path:"",      op:"等于", expected:"200"},
      {id:"a2",enabled:true,type:"JSONPath",  path:"$.code",op:"等于", expected:"0"},
      {id:"a3",enabled:true,type:"JSONPath",  path:"$.data.token",op:"存在",expected:""},
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
            />
          )}

          {/* 后置处理 */}
          {reqTab==="后置处理"&&(
            <ProcMasterDetail
              procs={post}
              onChange={list=>{setPost(list);dirty();}}
              emptyHint="暂无后置处理器"
            />
          )}

          {/* 断言 */}
          {reqTab==="断言"&&(
            <div style={{flex:1,overflowY:"auto"}}>
              <AssertSection rows={asserts} onChange={r=>{setAsserts(r);dirty();}}/>
            </div>
          )}

          {/* 设置 */}
          {reqTab==="设置"&&(
            <div style={{flex:1,overflowY:"auto",padding:"16px"}}>
              {[
                {label:"跟随接口重定向",desc:"自动跟随 301/302 重定向",on:true},
                {label:"SSL 证书验证",  desc:"验证服务端 SSL 证书",    on:false},
              ].map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",border:`1px solid ${T.border}`,borderRadius:7,marginBottom:8}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:T.t1}}>{s.label}</div>
                    <div style={{fontSize:11,color:T.t4,marginTop:2}}>{s.desc}</div>
                  </div>
                  <div style={{width:32,height:18,borderRadius:9,background:s.on?T.primary:T.t4,position:"relative",cursor:"pointer"}}>
                    <div style={{position:"absolute",top:2,left:s.on?14:2,width:14,height:14,borderRadius:"50%",background:"#fff"}}/>
                  </div>
                </div>
              ))}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",border:`1px solid ${T.border}`,borderRadius:7}}>
                <div><div style={{fontSize:13,fontWeight:500,color:T.t1}}>超时设置</div><div style={{fontSize:11,color:T.t4,marginTop:2}}>请求超时时间（ms）</div></div>
                <input defaultValue="30000" style={{width:80,padding:"4px 8px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,color:T.t1,outline:"none",textAlign:"right"}}/>
              </div>
            </div>
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
                    {asserts.map(a=>(
                      <div key={a.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                        <CheckCircle size={12} color={T.success}/>
                        <span style={{color:T.t2}}>{a.type}{a.path?` · ${a.path}`:""} {a.op}{a.expected?` ${a.expected}`:""}</span>
                        <span style={{color:T.success,marginLeft:"auto"}}>通过</span>
                      </div>
                    ))}
                    {asserts.length===0&&<div style={{color:T.t4,fontSize:12}}>没有断言规则</div>}
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
