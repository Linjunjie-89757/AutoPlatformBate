import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  Database, Hash, Server, Search, Plus, Trash2,
  CheckCircle, XCircle, FlaskConical, ChevronDown,
  ChevronRight, Folder, FolderOpen,
  Play, Upload, X, Sparkles,
  Code2, Layers, Timer, Variable,
  Copy, ArrowUp, ArrowDown,
  Zap, Shield, MoreHorizontal, Clock, FileText,
} from "lucide-react";

// ─── Palette (duplicated from App.tsx) ────────────────────────────────────────

const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  cyan:"#0FC6C2",
  slate:"#4E5969",   bg:"#F4F6FA",      border:"#E5E6EB",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};

// ─── Types (duplicated from App.tsx) ─────────────────────────────────────────

type HttpMethod = "GET"|"POST"|"PUT"|"DELETE"|"PATCH";
interface ApiEndpoint { id:string; name:string; method:HttpMethod; path:string; }
interface ApiFolder { id:string; name:string; count:number; expanded:boolean; items:ApiEndpoint[]; }

// ─── Method color maps (duplicated from App.tsx) ──────────────────────────────

const METHOD_COLOR: Record<HttpMethod,string> = {GET:"#00B42A",POST:"#FF7D00",PUT:"#165DFF",DELETE:"#F53F3F",PATCH:"#7816FF"};
const METHOD_BG:    Record<HttpMethod,string> = {GET:"#E8FFEA",POST:"#FFF3E8",PUT:"#E8F3FF",DELETE:"#FFE8E8",PATCH:"#F5E8FF"};

// ─── API_FOLDERS mock data (duplicated from App.tsx) ─────────────────────────

const API_FOLDERS: ApiFolder[] = [
  {id:"f1",name:"订单中心管理端",count:204,expanded:true,items:[{id:"e1",name:"获取订单列表",method:"GET",path:"/api/v1/orders"},{id:"e2",name:"创建订单",method:"POST",path:"/api/v1/orders"},{id:"e3",name:"更新订单状态",method:"PUT",path:"/api/v1/orders/{id}/status"}]},
  {id:"f2",name:"用户中心",count:67,expanded:false,items:[{id:"e5",name:"获取用户信息",method:"GET",path:"/api/v1/users/{id}"},{id:"e6",name:"用户注册",method:"POST",path:"/api/v1/users/register"}]},
  {id:"f3",name:"获客中心",count:65,expanded:false,items:[{id:"e8",name:"获取产品列表",method:"GET",path:"/api/v1/products"},{id:"e9",name:"新增产品",method:"POST",path:"/api/v1/products"}]},
];

// ─── Shared UI atoms (duplicated from App.tsx) ────────────────────────────────

function PBtn({children,onClick,icon:Icon,small,color=T.primary,variant="primary"}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;variant?:"primary"|"ghost"}){
  if(variant==="ghost") return <button onClick={onClick} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium bg-white transition-colors" style={{borderColor:T.border,color:T.t2}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.color=T.primary;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.t2;}}>{Icon&&<Icon size={13}/>}{children}</button>;
  return <button onClick={onClick} className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-all active:scale-[0.98]" style={{backgroundColor:color,color:"#fff",height:small?28:32,padding:small?"0 10px":"0 14px",fontSize:small?12:13}} onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.1)"} onMouseLeave={e=>e.currentTarget.style.filter=""}>{Icon&&<Icon size={small?12:13}/>}{children}</button>;
}

function Inp({placeholder,type="text",prefix,mono,width,value,onChange}:{placeholder?:string;type?:string;prefix?:React.ReactNode;mono?:boolean;width?:string|number;value?:string;onChange?:(v:string)=>void}){return <div className="relative flex items-center" style={{width}}>{prefix&&<span className="absolute left-2.5 pointer-events-none" style={{color:T.t3}}>{prefix}</span>}<input type={type} placeholder={placeholder} value={value} onChange={e=>onChange?.(e.target.value)} className={`h-8 border rounded-lg bg-white text-[13px] outline-none transition-all w-full ${prefix?"pl-8 pr-3":"px-3"} ${mono?"font-mono text-[12px]":""}`} style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.primary}18`;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/></div>;}

function MethodBadge({method}:{method:HttpMethod}){return <span className="inline-block px-1.5 py-px rounded text-[10px] font-bold text-center" style={{minWidth:44,backgroundColor:METHOD_BG[method],color:METHOD_COLOR[method]}}>{method}</span>;}

// ─── Mock response JSON (used in RespBodyTab) ─────────────────────────────────

const MOCK_RESPONSE_JSON = `{\n  "code": 0,\n  "message": "success",\n  "data": {\n    "list": [\n      {"id": 1001, "orderId": "ORD-001", "amount": 299.00, "status": "completed"},\n      {"id": 1002, "orderId": "ORD-002", "amount": 156.50, "status": "pending"}\n    ],\n    "total": 48, "page": 1, "pageSize": 20\n  }\n}`;

// ─── Extracted components (lines 3932–6097 of App.tsx) ────────────────────────

function SmToggle({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}){
  return(
    <button onClick={e=>{e.stopPropagation();onChange(!on);}} className="flex-shrink-0 relative w-8 h-4 rounded-full transition-colors" style={{backgroundColor:on?T.primary:"#C9CDD4"}}>
      <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform" style={{transform:on?"translateX(16px)":"translateX(0)"}}/>
    </button>
  );
}

function SmCodeEditor({value,onChange,rows=10}:{value:string;onChange:(v:string)=>void;rows?:number}){
  return(
    <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#1E1E2E"}}>
      <div className="flex items-center gap-2 px-3 py-1.5" style={{background:"#16162A",borderBottom:"1px solid #2D2D3F"}}>
        <Code2 size={11} style={{color:"#7C7C9A"}}/><span className="text-[11px]" style={{color:"#7C7C9A"}}>JavaScript</span>
        <div className="flex-1"/>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"#2D2D3F",color:"#7C7C9A"}}>setVar / getVar / request / response / log / fail</span>
      </div>
      <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} className="w-full outline-none resize-none p-3 text-[12px] leading-relaxed"
        style={{fontFamily:"'JetBrains Mono',monospace",color:"#CDD6F4",background:"#1E1E2E",caretColor:"#CBA6F7"}} spellCheck={false}/>
    </div>
  );
}

function SmSqlEditor({value,onChange,rows=8}:{value:string;onChange:(v:string)=>void;rows?:number}){
  return(
    <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#1A2035"}}>
      <div className="flex items-center gap-2 px-3 py-1.5" style={{background:"#141B2D",borderBottom:"1px solid #243050"}}>
        <Database size={11} style={{color:"#7C9ABF"}}/><span className="text-[11px]" style={{color:"#7C9ABF"}}>SQL</span>
      </div>
      <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} className="w-full outline-none resize-none p-3 text-[12px] leading-relaxed"
        style={{fontFamily:"'JetBrains Mono',monospace",color:"#A8D8FF",background:"#1A2035",caretColor:"#7EB8F7"}} spellCheck={false}/>
    </div>
  );
}

const ALL_CONDITIONS=["等于","不等于","包含","不包含","为空","不为空","开头是","结尾是","正则匹配","大于","大于等于","小于","小于等于","长度等于","长度大于","长度小于","不校验"];

// ─── Processor list panel (shared by Pre and Post) ────────────────────────────

type ProcType="script"|"sql"|"wait"|"extract";
interface Proc{
  id:string;name:string;type:ProcType;enabled:boolean;desc:string;
  script:string;
  dbId:string;timeout:number;sql:string;columnVars:{id:string;varName:string;col:string}[];resultVar:string;
  waitMs:number;
  extractItems:ExItem[];
}
interface ExItem{
  id:string;enabled:boolean;varName:string;desc:string;varType:"temp"|"env";
  method:"jsonpath"|"xpath"|"regex";scope:"body"|"header"|"req-header"|"status"|"msg"|"url";
  expr:string;matchRule:"random"|"index"|"all";matchIndex:number;regexGroup:"full"|"group1";xpathFmt:"xml"|"html";
}

const PROC_TYPE_CFG:Record<ProcType,{label:string;color:string;bg:string;icon:React.ElementType}>={
  script: {label:"脚本",  color:"#7816FF",bg:"#F0E8FF",icon:Code2},
  sql:    {label:"SQL",   color:"#165DFF",bg:"#E8EEFF",icon:Database},
  wait:   {label:"等待",  color:"#FF7D00",bg:"#FFF2E5",icon:Clock},
  extract:{label:"提取",  color:"#00B42A",bg:"#E6F9EC",icon:Layers},
};

function mkProc(type:ProcType,idx:number):Proc{
  const names:Record<ProcType,string>={script:"脚本处理器",sql:"SQL处理器",wait:"等待处理器",extract:"提取处理器"};
  const scripts:Record<ProcType,string>={
    script:"const timestamp = Date.now()\nsetVar('timestamp', timestamp)\nrequest.headers['X-Timestamp'] = timestamp\nlog('前置处理完成')",
    sql:"",wait:"",extract:"",
  };
  const sqls:Record<ProcType,string>={sql:"select id, token from test_user where username = 'admin'",script:"",wait:"",extract:""};
  return{
    id:"p"+Date.now()+idx,name:names[type]+" "+(idx+1),type,enabled:true,desc:"",
    script:scripts[type],dbId:"db1",timeout:5000,sql:sqls[type],columnVars:[{id:"cv1",varName:"userId",col:"id"},{id:"cv2",varName:"token",col:"token"}],resultVar:"",
    waitMs:1000,extractItems:[],
  };
}

function mkExItem():ExItem{
  return{id:"ex"+Date.now(),enabled:true,varName:"",desc:"",varType:"temp",method:"jsonpath",scope:"body",expr:"",matchRule:"random",matchIndex:0,regexGroup:"full",xpathFmt:"xml"};
}

const MOCK_DBS=[{id:"db1",name:"测试数据库 (MySQL)"},{id:"db2",name:"预发布 (PostgreSQL)"}];

function ProcListItem({p,selected,onSelect,onToggle,onMoveUp,onMoveDown,onCopy,onDel,isFirst,isLast}:{
  p:Proc;selected:boolean;onSelect:()=>void;onToggle:(v:boolean)=>void;
  onMoveUp:()=>void;onMoveDown:()=>void;onCopy:()=>void;onDel:()=>void;
  isFirst:boolean;isLast:boolean;
}){
  const cfg=PROC_TYPE_CFG[p.type];
  const Icon=cfg.icon;
  return(
    <div onClick={onSelect} className="flex items-center gap-2 px-2 py-2 cursor-pointer rounded-lg mx-1 mb-0.5 group transition-colors"
      style={{background:selected?"#EEF3FF":"transparent",border:selected?`1px solid ${T.primary}20`:"1px solid transparent"}}>
      <SmToggle on={p.enabled} onChange={onToggle}/>
      <div className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center" style={{background:selected?`${T.primary}14`:T.bg}}>
        <Icon size={12} style={{color:selected?T.primary:T.t3}}/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium truncate" style={{color:selected?T.primary:T.t1}}>{p.name}</div>
        <div className="text-[11px] truncate" style={{color:T.t4}}>{cfg.label}处理器{!p.enabled&&" · 已禁用"}</div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e=>{e.stopPropagation();onMoveUp();}} disabled={isFirst} title="上移" className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100" style={{color:isFirst?T.t4:T.t2}}><ArrowUp size={10}/></button>
        <button onClick={e=>{e.stopPropagation();onMoveDown();}} disabled={isLast} title="下移" className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100" style={{color:isLast?T.t4:T.t2}}><ArrowDown size={10}/></button>
        <button onClick={e=>{e.stopPropagation();onCopy();}} title="复制" className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100" style={{color:T.t2}}><Copy size={10}/></button>
        <button onClick={e=>{e.stopPropagation();onDel();}} title="删除" className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50" style={{color:T.danger}}><Trash2 size={10}/></button>
      </div>
    </div>
  );
}

function ScriptDetail({p,onChange}:{p:Proc;onChange:(patch:Partial<Proc>)=>void}){
  return(
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>处理器名称</label>
          <input value={p.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={p.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-[11px] font-semibold" style={{color:T.t3}}>脚本内容</label>
          <div className="flex-1"/>
          <button onClick={()=>onChange({script:""})} className="h-6 px-2 rounded border text-[11px]" style={{borderColor:T.border,color:T.t3}}>清空</button>
          <button className="h-6 px-2 rounded border text-[11px]" style={{borderColor:T.border,color:T.t3}}>格式化</button>
        </div>
        <SmCodeEditor value={p.script} onChange={v=>onChange({script:v})} rows={10}/>
      </div>
      <div className="rounded-lg p-3 flex-shrink-0" style={{background:"#F8F9FC",border:`1px solid ${T.border}`}}>
        <p className="text-[11px] font-semibold mb-2" style={{color:T.t2}}>可用脚本 API</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[["setVar(name,val)","设置变量"],["getVar(name)","读取变量"],["removeVar(name)","删除变量"],["log(msg)","输出日志"],["fail(msg)","主动失败"],["request","请求上下文"],["response","响应上下文（后置）"]].map(([api,desc])=>(
            <div key={api} className="flex items-baseline gap-1.5">
              <code className="text-[11px] font-mono" style={{color:"#7816FF"}}>{api}</code>
              <span className="text-[10px]" style={{color:T.t3}}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>说明</label>
        <input value={p.desc} onChange={e=>onChange({desc:e.target.value})} placeholder="选填，添加处理器说明" className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
    </div>
  );
}

function SqlDetail({p,onChange}:{p:Proc;onChange:(patch:Partial<Proc>)=>void}){
  const addCol=()=>onChange({columnVars:[...p.columnVars,{id:"cv"+Date.now(),varName:"",col:""}]});
  const delCol=(id:string)=>onChange({columnVars:p.columnVars.filter(c=>c.id!==id)});
  const updCol=(id:string,k:"varName"|"col",v:string)=>onChange({columnVars:p.columnVars.map(c=>c.id===id?{...c,[k]:v}:c)});
  return(
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>处理器名称</label>
          <input value={p.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={p.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
      </div>
      <div className="flex gap-3 flex-shrink-0">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>数据库连接</label>
          <select value={p.dbId} onChange={e=>onChange({dbId:e.target.value})} className="w-full h-8 px-2.5 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}}>
            {MOCK_DBS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div style={{width:160}}><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>查询超时 (ms)</label>
          <input type="number" value={p.timeout} onChange={e=>onChange({timeout:+e.target.value})} min={100} max={60000} className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}}/>
        </div>
      </div>
      <div><label className="block text-[11px] font-semibold mb-1.5" style={{color:T.t3}}>SQL 语句</label><SmSqlEditor value={p.sql} onChange={v=>onChange({sql:v})} rows={6}/></div>
      <div>
        <label className="block text-[11px] font-semibold mb-2" style={{color:T.t3}}>按列提取变量</label>
        <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}>
          <table className="w-full text-[12px]">
            <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>{["变量名","列名","操作"].map(h=><th key={h} className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
            <tbody>{p.columnVars.map(c=>(
              <tr key={c.id} className="border-b" style={{borderColor:T.border}}>
                <td className="px-3 py-1.5"><input value={c.varName} onChange={e=>updCol(c.id,"varName",e.target.value)} className="w-full outline-none text-[12px] font-mono" style={{color:T.primary}} placeholder="变量名"/></td>
                <td className="px-3 py-1.5"><input value={c.col} onChange={e=>updCol(c.id,"col",e.target.value)} className="w-full outline-none text-[12px] font-mono" style={{color:T.t1}} placeholder="列名"/></td>
                <td className="px-3 py-1.5"><button onClick={()=>delCol(c.id)} title="删除" className="w-6 h-6 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:"pointer",color:T.t3}} onMouseEnter={e=>{e.currentTarget.style.background="#FEF2F2";e.currentTarget.style.color=T.danger;}} onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.t3;}}><Trash2 size={13}/></button></td>
              </tr>
            ))}</tbody>
          </table>
          <button onClick={addCol} style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",color:T.t3,fontSize:12}} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}><Plus size={12}/>添加列</button>
        </div>
      </div>
      <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>完整结果变量（选填）</label>
        <input value={p.resultVar} onChange={e=>onChange({resultVar:e.target.value})} placeholder="将查询结果数组存入该变量" className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none font-mono" style={{borderColor:T.border,color:T.primary}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
    </div>
  );
}

function WaitDetail({p,onChange}:{p:Proc;onChange:(patch:Partial<Proc>)=>void}){
  return(
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>处理器名称</label>
          <input value={p.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={p.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
      </div>
      <div style={{maxWidth:300}}>
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>等待时长 (ms)</label>
        <div className="flex items-center gap-2">
          <input type="number" value={p.waitMs} onChange={e=>onChange({waitMs:Math.min(600000,Math.max(1,+e.target.value))})} min={1} max={600000} className="flex-1 h-9 px-3 border rounded-lg text-[14px] font-semibold outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
          <span className="text-[12px]" style={{color:T.t3}}>ms</span>
        </div>
        <p className="text-[11px] mt-1" style={{color:T.t3}}>范围：1 — 600,000 ms（最长 10 分钟）</p>
      </div>
      <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>说明</label>
        <input value={p.desc} onChange={e=>onChange({desc:e.target.value})} placeholder="选填，添加等待说明" className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
      <div className="rounded-xl p-3 flex-shrink-0" style={{background:"#FFFBE8",border:`1px solid #876800 30`}}>
        <p className="text-[11px]" style={{color:"#876800"}}>等待处理器会暂停当前请求执行流，适用于需要轮询或延迟的场景。等待时间过长会影响测试执行效率。</p>
      </div>
    </div>
  );
}

function ExItemRow({item,onUpdate,onCopy,onDel,hasSent}:{item:ExItem;onUpdate:(p:Partial<ExItem>)=>void;onCopy:()=>void;onDel:()=>void;hasSent:boolean}){
  const[showAdv,setShowAdv]=useState(false);
  const scopeOpts:Record<string,string>={body:"响应体",header:"响应头","req-header":"请求头",status:"状态码",msg:"响应消息",url:"URL"};
  return(
    <div className="rounded-xl overflow-hidden mb-2" style={{border:`1px solid ${T.border}`,background:item.enabled?"#fff":"#FAFAFA"}}>
      <div className="flex items-center gap-2 px-3 py-2" style={{borderBottom:`1px solid ${T.border}`,background:"#FAFAFA"}}>
        <SmToggle on={item.enabled} onChange={v=>onUpdate({enabled:v})}/>
        <input value={item.varName} onChange={e=>onUpdate({varName:e.target.value})} placeholder="变量名" className="font-mono text-[12px] outline-none px-1.5 py-0.5 rounded border" style={{borderColor:T.border,color:T.primary,width:140}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        <select value={item.varType} onChange={e=>onUpdate({varType:e.target.value as any})} className="h-6 px-1.5 border rounded text-[11px] outline-none" style={{borderColor:T.border,color:T.t2}}>
          <option value="temp">临时变量</option><option value="env">环境变量</option>
        </select>
        <div className="flex-1"/>
        <button onClick={()=>setShowAdv(v=>!v)} className="h-6 px-2 rounded border text-[10px]" style={{borderColor:T.border,color:T.t3}}>更多设置</button>
        <button onClick={onCopy} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100" style={{color:T.t2}}><Copy size={11}/></button>
        <button onClick={onDel} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50" style={{color:T.danger}}><Trash2 size={11}/></button>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex rounded overflow-hidden flex-shrink-0" style={{border:`1px solid ${T.border}`}}>
          {(["jsonpath","xpath","regex"] as const).map(m=>(
            <button key={m} onClick={()=>onUpdate({method:m})} className="px-2.5 h-7 text-[11px] font-medium transition-colors" style={{background:item.method===m?T.primary:"transparent",color:item.method===m?"#fff":T.t3}}>
              {m==="jsonpath"?"JSONPath":m==="xpath"?"XPath":"Regex"}
            </button>
          ))}
        </div>
        {item.method==="regex"&&(
          <select value={item.scope} onChange={e=>onUpdate({scope:e.target.value as any})} className="h-7 px-2 border rounded text-[11px] outline-none flex-shrink-0" style={{borderColor:T.border,color:T.t2}}>
            {Object.entries(scopeOpts).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <input value={item.expr} onChange={e=>onUpdate({expr:e.target.value})} placeholder={item.method==="jsonpath"?"$.data.token":item.method==="xpath"?"/response/data/token":'"token":"([^"]+)"'} className="flex-1 h-7 px-2.5 border rounded text-[12px] font-mono outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        <button disabled={!hasSent} className="h-7 px-2.5 rounded border text-[11px] flex items-center gap-1 flex-shrink-0" style={{borderColor:hasSent?T.primary+"50":T.border,color:hasSent?T.primary:T.t4,background:hasSent?"#EEF6FF":"transparent",cursor:hasSent?"pointer":"not-allowed"}}>
          <Zap size={10}/>快速提取
        </button>
      </div>
      {showAdv&&(
        <div className="px-3 py-2.5 flex items-center gap-4" style={{borderTop:`1px solid ${T.border}`,background:"#F8F9FC"}}>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{color:T.t3}}>结果匹配</span>
            <select value={item.matchRule} onChange={e=>onUpdate({matchRule:e.target.value as any})} className="h-6 px-1.5 border rounded text-[11px] outline-none" style={{borderColor:T.border,color:T.t2}}>
              <option value="random">随机</option><option value="index">指定序号</option><option value="all">全部</option>
            </select>
            {item.matchRule==="index"&&<input type="number" value={item.matchIndex} onChange={e=>onUpdate({matchIndex:+e.target.value})} className="w-14 h-6 px-1.5 border rounded text-[11px] outline-none" style={{borderColor:T.border,color:T.t1}} min={0}/>}
          </div>
          {item.method==="regex"&&<div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{color:T.t3}}>匹配规则</span>
            <select value={item.regexGroup} onChange={e=>onUpdate({regexGroup:e.target.value as any})} className="h-6 px-1.5 border rounded text-[11px] outline-none" style={{borderColor:T.border,color:T.t2}}>
              <option value="full">整段匹配</option><option value="group1">分组 1</option>
            </select>
          </div>}
          {item.method==="xpath"&&<div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{color:T.t3}}>内容格式</span>
            <select value={item.xpathFmt} onChange={e=>onUpdate({xpathFmt:e.target.value as any})} className="h-6 px-1.5 border rounded text-[11px] outline-none" style={{borderColor:T.border,color:T.t2}}>
              <option value="xml">XML</option><option value="html">HTML</option>
            </select>
          </div>}
          <input value={item.desc} onChange={e=>onUpdate({desc:e.target.value})} placeholder="变量描述（选填）" className="flex-1 h-6 px-2 border rounded text-[11px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
      )}
    </div>
  );
}

function ExtractDetail({p,onChange,hasSent}:{p:Proc;onChange:(patch:Partial<Proc>)=>void;hasSent:boolean}){
  const items=p.extractItems;
  const add=()=>onChange({extractItems:[...items,mkExItem()]});
  const upd=(id:string,patch:Partial<ExItem>)=>onChange({extractItems:items.map(i=>i.id===id?{...i,...patch}:i)});
  const cp=(id:string)=>{const src=items.find(i=>i.id===id);if(src)onChange({extractItems:[...items,{...src,id:"ex"+Date.now()}]});};
  const del=(id:string)=>onChange({extractItems:items.filter(i=>i.id!==id)});
  return(
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>处理器名称</label>
          <input value={p.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={p.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
      </div>
      {items.length===0?(
        <div className="flex-1 flex flex-col items-center justify-center" style={{color:T.t4}}>
          <Layers size={28} className="mb-2"/>
          <p className="text-[13px] mb-1">暂无提取项</p>
          <button onClick={add} style={{marginTop:4,fontSize:12,color:T.t3,background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:4}} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}><Plus size={12}/>添加提取项</button>
        </div>
      ):(
        <div className="flex-1 overflow-y-auto flex flex-col">
          {items.map(item=><ExItemRow key={item.id} item={item} onUpdate={p=>upd(item.id,p)} onCopy={()=>cp(item.id)} onDel={()=>del(item.id)} hasSent={hasSent}/>)}
          <button onClick={add} style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",color:T.t3,fontSize:12,marginTop:"auto"}} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}><Plus size={12}/>添加提取项</button>
        </div>
      )}
    </div>
  );
}

function ProcessorPanel({procs,setProcs,allowExtract,hasSent}:{procs:Proc[];setProcs:(ps:Proc[])=>void;allowExtract:boolean;hasSent:boolean}){
  const[selId,setSelId]=useState<string|null>(null);
  const[showAdd,setShowAdd]=useState(false);
  const selProc=procs.find(p=>p.id===selId)||null;
  const upd=(id:string,patch:Partial<Proc>)=>setProcs(procs.map(p=>p.id===id?{...p,...patch}:p));
  const addProc=(type:ProcType)=>{
    const np=mkProc(type,procs.length);
    setProcs([...procs,np]);setSelId(np.id);setShowAdd(false);
  };
  const delProc=(id:string)=>{setProcs(procs.filter(p=>p.id!==id));if(selId===id)setSelId(null);};
  const moveUp=(id:string)=>{const i=procs.findIndex(p=>p.id===id);if(i>0){const a=[...procs];[a[i-1],a[i]]=[a[i],a[i-1]];setProcs(a);}};
  const moveDown=(id:string)=>{const i=procs.findIndex(p=>p.id===id);if(i<procs.length-1){const a=[...procs];[a[i],a[i+1]]=[a[i+1],a[i]];setProcs(a);}};
  const copyProc=(id:string)=>{const src=procs.find(p=>p.id===id);if(src){const np={...src,id:"p"+Date.now(),name:src.name+" 副本"};setProcs([...procs,np]);setSelId(np.id);}};
  const types:ProcType[]=allowExtract?["script","sql","wait","extract"]:["script","sql","wait"];

  return(
    <div className="flex flex-1 overflow-hidden">
      {/* Left list */}
      <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:240,borderRight:`1px solid ${T.border}`,background:"#FAFAFA"}}>
        <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div className="relative">
            <button onClick={()=>setShowAdd(v=>!v)} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-medium" style={{background:T.primary,color:"#fff"}}>
              <Plus size={12}/>添加处理器<ChevronDown size={10}/>
            </button>
            {showAdd&&(
              <div className="absolute top-full left-0 mt-1 rounded-lg shadow-lg py-1 z-10 w-36" style={{background:"#fff",border:`1px solid ${T.border}`}}>
                {types.map(t=>{const cfg=PROC_TYPE_CFG[t];return(
                  <button key={t} onClick={()=>addProc(t)} className="w-full flex items-center px-3 py-2 text-[12px] hover:bg-gray-50 text-left" style={{color:T.t1,border:"none",background:"transparent",cursor:"pointer"}}>
                    {cfg.label}处理器
                  </button>
                );})}
              </div>
            )}
          </div>
          <span className="text-[11px]" style={{color:T.t4}}>{procs.length} 项</span>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {procs.length===0?(
            <div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}>
              <p className="text-[12px]">暂无处理器</p>
              <p className="text-[11px] mt-0.5">点击「添加处理器」开始</p>
            </div>
          ):(
            procs.map((p,i)=>(
              <ProcListItem key={p.id} p={p} selected={selId===p.id}
                onSelect={()=>setSelId(p.id)} onToggle={v=>upd(p.id,{enabled:v})}
                onMoveUp={()=>moveUp(p.id)} onMoveDown={()=>moveDown(p.id)}
                onCopy={()=>copyProc(p.id)} onDel={()=>delProc(p.id)}
                isFirst={i===0} isLast={i===procs.length-1}/>
            ))
          )}
        </div>
      </div>
      {/* Right detail */}
      <div className="flex-1 overflow-hidden bg-white">
        {!selProc?(
          <div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}>
            <Layers size={32} className="mb-2.5"/>
            <p className="text-[13px]">请选择一个处理器进行编辑</p>
          </div>
        ):selProc.type==="script"?<ScriptDetail p={selProc} onChange={p=>upd(selProc.id,p)}/>
          :selProc.type==="sql"?<SqlDetail p={selProc} onChange={p=>upd(selProc.id,p)}/>
          :selProc.type==="wait"?<WaitDetail p={selProc} onChange={p=>upd(selProc.id,p)}/>
          :<ExtractDetail p={selProc} onChange={p=>upd(selProc.id,p)} hasSent={hasSent}/>
        }
      </div>
    </div>
  );
}

// ─── Pre / Post Tab wrappers ──────────────────────────────────────────────────

// ─── PreScriptTab V2 ─────────────────────────────────────────────────────────

interface PreExecProcResult{id:string;name:string;status:"success"|"failed"|"skipped";ms:number;error?:string}
interface PreExecResult{status:"success"|"failed";totalMs:number;procResults:PreExecProcResult[];varChanges:{name:string;before:string|null;after:string;masked:boolean}[];logs:{level:"info"|"warn"|"error";time:string;msg:string}[]}

const MOCK_PRE_EXEC:PreExecResult={
  status:"success",totalMs:23,
  procResults:[{id:"p0",name:"生成签名",status:"success",ms:21}],
  varChanges:[
    {name:"timestamp",before:null,after:"1736848234123",masked:false},
    {name:"access_token",before:null,after:"eyJhbGciOiJIUzI1NiJ9.••••••",masked:true},
  ],
  logs:[
    {level:"info",time:"10:23:54.112",msg:"[生成签名] 开始执行"},
    {level:"info",time:"10:23:54.130",msg:"setVar('timestamp') = 1736848234123"},
    {level:"info",time:"10:23:54.131",msg:"request.headers['X-Timestamp'] = 1736848234123"},
    {level:"info",time:"10:23:54.132",msg:"access_token 已写入（已脱敏）"},
    {level:"info",time:"10:23:54.133",msg:"[生成签名] 执行完成，耗时 21ms"},
  ],
};

const PRE_ONLY_TYPES:ProcType[]=["script","sql","wait"];
const PRE_TYPE_ICON:Record<ProcType,React.ElementType>={script:Code2,sql:Database,wait:Clock,extract:Layers};
const PRE_TYPE_LABEL:Record<ProcType,string>={script:"脚本",sql:"SQL",wait:"等待",extract:"提取"};

function PreProcItem({p,selected,onSelect,onToggle,onMoveUp,onMoveDown,isFirst,isLast}:{
  p:Proc;selected:boolean;onSelect:()=>void;onToggle:(v:boolean)=>void;
  onMoveUp:()=>void;onMoveDown:()=>void;isFirst:boolean;isLast:boolean;
}){
  const cfg=PROC_TYPE_CFG[p.type];
  return(
    <div onClick={onSelect} className="group flex items-center gap-2 cursor-pointer transition-colors mx-1 mb-0.5"
      style={{padding:"6px 8px 6px 10px",borderRadius:8,
        background:selected?"#EEF3FF":"transparent"}}>
      <div onClick={e=>e.stopPropagation()} style={{flexShrink:0}}>
        <SmToggle on={p.enabled} onChange={onToggle}/>
      </div>
      <span style={{flexShrink:0,fontSize:11,fontWeight:600,color:cfg.color,background:cfg.bg,
        borderRadius:4,padding:"1px 6px"}}>{cfg.label}</span>
      <span style={{flex:1,minWidth:0,fontSize:12,fontWeight:selected?500:400,
        color:selected?T.primary:p.enabled?T.t1:T.t4,
        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={e=>{e.stopPropagation();onMoveUp();}} disabled={isFirst}
          style={{width:17,height:17,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"none",background:"none",cursor:isFirst?"default":"pointer",color:isFirst?T.t4:T.t2}}><ArrowUp size={10}/></button>
        <button onClick={e=>{e.stopPropagation();onMoveDown();}} disabled={isLast}
          style={{width:17,height:17,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"none",background:"none",cursor:isLast?"default":"pointer",color:isLast?T.t4:T.t2}}><ArrowDown size={10}/></button>
      </div>
    </div>
  );
}

function PreScriptDetail({p,onChange,onCopy,onDel}:{p:Proc;onChange:(patch:Partial<Proc>)=>void;onCopy:()=>void;onDel:()=>void}){
  const VARS=[["setVar(name,val)","写入变量"],["getVar(name)","读取变量"],["log(msg)","输出日志"],["fail(msg)","主动失败"],["request.headers","修改请求头"],["request.query","修改 Query"],["request.body","修改 Body"]];
  return(
    <div className="flex flex-col gap-3 p-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>处理器名称</label>
          <input value={p.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <div className="flex items-center gap-3 pt-5 flex-shrink-0">
          <button onClick={onCopy} style={{fontSize:12,color:T.t2,background:"none",border:"none",cursor:"pointer",padding:0}}>复制</button>
          <button onClick={onDel} style={{fontSize:12,color:T.danger,background:"none",border:"none",cursor:"pointer",padding:0}}>删除</button>
          <div style={{width:1,height:14,background:T.border}}/>
          <SmToggle on={p.enabled} onChange={v=>onChange({enabled:v})}/>
          <span style={{fontSize:12,color:T.t2}}>启用</span>
        </div>
      </div>
      <div className="flex-shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <label className="text-[11px] font-semibold" style={{color:T.t3}}>脚本内容</label>
          <div className="flex-1"/>
          <button onClick={()=>onChange({script:""})} className="h-5 px-2 rounded text-[10px]" style={{border:`1px solid ${T.border}`,color:T.t3,background:"transparent"}}>清空</button>
        </div>
        <SmCodeEditor value={p.script} onChange={v=>onChange({script:v})} rows={10}/>
      </div>
      <div className="rounded-lg p-3 flex-shrink-0" style={{background:"#F8F9FC",border:`1px solid ${T.border}`}}>
        <p className="text-[11px] font-semibold mb-2" style={{color:T.t2}}>可用 API</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {VARS.map(([api,desc])=>(
            <div key={api} className="flex items-baseline gap-1.5">
              <code className="text-[11px]" style={{fontFamily:"'JetBrains Mono',monospace",color:"#7816FF"}}>{api}</code>
              <span className="text-[10px]" style={{color:T.t3}}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-shrink-0">
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>说明（选填）</label>
        <input value={p.desc} onChange={e=>onChange({desc:e.target.value})} placeholder="描述此处理器的用途" className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
    </div>
  );
}

function PreSqlDetail({p,onChange,onCopy,onDel}:{p:Proc;onChange:(patch:Partial<Proc>)=>void;onCopy:()=>void;onDel:()=>void}){
  const addCol=()=>onChange({columnVars:[...p.columnVars,{id:"cv"+Date.now(),varName:"",col:""}]});
  const delCol=(id:string)=>onChange({columnVars:p.columnVars.filter(c=>c.id!==id)});
  const updCol=(id:string,k:"varName"|"col",v:string)=>onChange({columnVars:p.columnVars.map(c=>c.id===id?{...c,[k]:v}:c)});
  return(
    <div className="flex flex-col gap-3 p-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>处理器名称</label>
          <input value={p.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <div className="flex items-center gap-3 pt-5 flex-shrink-0">
          <button onClick={onCopy} style={{fontSize:12,color:T.t2,background:"none",border:"none",cursor:"pointer",padding:0}}>复制</button>
          <button onClick={onDel} style={{fontSize:12,color:T.danger,background:"none",border:"none",cursor:"pointer",padding:0}}>删除</button>
          <div style={{width:1,height:14,background:T.border}}/>
          <SmToggle on={p.enabled} onChange={v=>onChange({enabled:v})}/>
          <span style={{fontSize:12,color:T.t2}}>启用</span>
        </div>
      </div>
      <div className="flex gap-3 flex-shrink-0">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>数据源</label>
          <div className="flex items-center gap-1.5">
            <Database size={13} style={{color:T.t3,flexShrink:0}}/>
            <select value={p.dbId} onChange={e=>onChange({dbId:e.target.value})} className="flex-1 h-8 px-2 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}}>
              {MOCK_DBS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{width:150}}>
          <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>查询超时 (ms)</label>
          <input type="number" value={p.timeout} onChange={e=>onChange({timeout:+e.target.value})} min={100} max={60000} className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}}/>
        </div>
      </div>
      <div className="flex-shrink-0">
        <div className="flex items-center mb-1.5">
          <label className="text-[11px] font-semibold" style={{color:T.t3}}>查询语句</label>
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{background:"#E8F3FF",color:T.primary}}>仅支持 SELECT</span>
        </div>
        <SmSqlEditor value={p.sql} onChange={v=>onChange({sql:v})} rows={5}/>
      </div>
      <div className="flex-shrink-0">
        <label className="block text-[11px] font-semibold mb-1.5" style={{color:T.t3}}>列 → 变量映射</label>
        <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}>
          <table className="w-full text-[12px]" style={{borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
              {["列名","写入变量名","操作"].map(h=><th key={h} className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3,whiteSpace:"nowrap"}}>{h}</th>)}
            </tr></thead>
            <tbody>{p.columnVars.map((c,i)=>(
              <tr key={c.id} style={{borderBottom:i<p.columnVars.length-1?`1px solid ${T.border}`:"none"}}>
                <td className="px-3 py-1.5"><input value={c.col} onChange={e=>updCol(c.id,"col",e.target.value)} className="w-full outline-none text-[12px]" style={{fontFamily:"'JetBrains Mono',monospace",color:T.t1}} placeholder="e.g. token"/></td>
                <td className="px-3 py-1.5"><input value={c.varName} onChange={e=>updCol(c.id,"varName",e.target.value)} className="w-full outline-none text-[12px]" style={{fontFamily:"'JetBrains Mono',monospace",color:T.primary}} placeholder="变量名"/></td>
                <td className="px-3 py-1.5"><button onClick={()=>delCol(c.id)} title="删除" className="w-6 h-6 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:"pointer",color:T.t3}} onMouseEnter={e=>{e.currentTarget.style.background="#FEF2F2";e.currentTarget.style.color=T.danger;}} onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.t3;}}><Trash2 size={13}/></button></td>
              </tr>
            ))}</tbody>
          </table>
          <button onClick={addCol} style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",color:T.t3,fontSize:12}} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}><Plus size={12}/>添加列</button>
        </div>
      </div>
      <div className="flex-shrink-0">
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>完整结果变量（选填）</label>
        <input value={p.resultVar} onChange={e=>onChange({resultVar:e.target.value})} placeholder="将查询结果数组整体存入此变量" className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.primary,fontFamily:"'JetBrains Mono',monospace"}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
      <div className="flex-shrink-0">
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>说明（选填）</label>
        <input value={p.desc} onChange={e=>onChange({desc:e.target.value})} placeholder="描述此处理器的用途" className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
    </div>
  );
}

function PreWaitDetail({p,onChange,onCopy,onDel}:{p:Proc;onChange:(patch:Partial<Proc>)=>void;onCopy:()=>void;onDel:()=>void}){
  const presets=[500,1000,2000,5000];
  return(
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>处理器名称</label>
          <input value={p.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <div className="flex items-center gap-3 pt-5 flex-shrink-0">
          <button onClick={onCopy} style={{fontSize:12,color:T.t2,background:"none",border:"none",cursor:"pointer",padding:0}}>复制</button>
          <button onClick={onDel} style={{fontSize:12,color:T.danger,background:"none",border:"none",cursor:"pointer",padding:0}}>删除</button>
          <div style={{width:1,height:14,background:T.border}}/>
          <SmToggle on={p.enabled} onChange={v=>onChange({enabled:v})}/>
          <span style={{fontSize:12,color:T.t2}}>启用</span>
        </div>
      </div>
      <div className="flex-shrink-0" style={{maxWidth:360}}>
        <label className="block text-[11px] font-semibold mb-1.5" style={{color:T.t3}}>等待时长</label>
        <div className="flex items-center gap-2 mb-2">
          <input type="number" value={p.waitMs} onChange={e=>onChange({waitMs:Math.min(600000,Math.max(1,+e.target.value))})} min={1} max={600000}
            className="flex-1 h-9 px-3 border rounded-lg text-[14px] font-semibold outline-none" style={{borderColor:T.border,color:T.t1}}
            onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
          <span className="text-[12px] flex-shrink-0" style={{color:T.t3}}>毫秒 (ms)</span>
        </div>
        <div className="flex gap-1.5">
          {presets.map(ms=>(
            <button key={ms} onClick={()=>onChange({waitMs:ms})}
              className="h-6 px-3 rounded text-[11px] transition-colors"
              style={{border:`1px solid ${p.waitMs===ms?T.primary:T.border}`,background:p.waitMs===ms?`${T.primary}0D`:"transparent",color:p.waitMs===ms?T.primary:T.t3,cursor:"pointer"}}>
              {ms>=1000?`${ms/1000}s`:`${ms}ms`}
            </button>
          ))}
        </div>
        <p className="text-[11px] mt-2" style={{color:T.t4}}>最长 600,000 ms（10 分钟）</p>
      </div>
      <div className="flex-shrink-0">
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>说明（选填）</label>
        <input value={p.desc} onChange={e=>onChange({desc:e.target.value})} placeholder="描述等待原因，如：等待任务队列初始化" className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
    </div>
  );
}

function PreExecPanel({result,hasSent}:{result:PreExecResult|null;hasSent:boolean}){
  const[open,setOpen]=useState(true);
  const[tab,setTab]=useState<"overview"|"vars"|"logs">("overview");
  if(!hasSent) return null;
  const res=result??MOCK_PRE_EXEC;
  const logColor:Record<string,string>={info:T.t3,warn:T.warning,error:T.danger};
  return(
    <div style={{borderTop:`1px solid ${T.border}`,background:"#FAFAFA",flexShrink:0}}>
      <div className="flex items-center gap-2 px-3 py-1.5 cursor-pointer" style={{borderBottom:open?`1px solid ${T.border}`:"none"}} onClick={()=>setOpen(v=>!v)}>
        <div className="flex items-center gap-1.5">
          {res.status==="success"
            ?<CheckCircle size={13} style={{color:T.success}}/>
            :<XCircle size={13} style={{color:T.danger}}/>}
          <span className="text-[12px] font-medium" style={{color:res.status==="success"?T.success:T.danger}}>{res.status==="success"?"执行成功":"执行失败"}</span>
          <span className="text-[11px]" style={{color:T.t4}}>· {res.totalMs}ms</span>
        </div>
        <div className="flex-1"/>
        <span className="text-[11px]" style={{color:T.t3}}>执行结果</span>
        <ChevronDown size={12} style={{color:T.t3,transform:open?"rotate(180deg)":"none",transition:"transform 0.15s"}}/>
      </div>
      {open&&(
        <div style={{height:160,display:"flex",flexDirection:"column"}}>
          <div className="flex items-center gap-1 px-3 pt-1.5 flex-shrink-0">
            {(["overview","vars","logs"] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className="h-6 px-2.5 rounded text-[11px] transition-colors"
                style={{background:tab===t?`${T.primary}0D`:"transparent",color:tab===t?T.primary:T.t3,border:tab===t?`1px solid ${T.primary}20`:"1px solid transparent",cursor:"pointer"}}>
                {t==="overview"?"概览":t==="vars"?"变量变化":"执行日志"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {tab==="overview"&&(
              <div className="flex flex-col gap-1">
                {res.procResults.map(pr=>(
                  <div key={pr.id} className="flex items-center gap-2 py-1">
                    {pr.status==="success"?<CheckCircle size={11} style={{color:T.success,flexShrink:0}}/>:pr.status==="failed"?<XCircle size={11} style={{color:T.danger,flexShrink:0}}/>:<div style={{width:11,height:11,borderRadius:"50%",background:T.bg,border:`1px solid ${T.border}`,flexShrink:0}}/>}
                    <span className="text-[12px] flex-1" style={{color:T.t1}}>{pr.name}</span>
                    <span className="text-[11px]" style={{color:T.t4}}>{pr.ms}ms</span>
                    {pr.error&&<span className="text-[11px]" style={{color:T.danger}}>{pr.error}</span>}
                  </div>
                ))}
              </div>
            )}
            {tab==="vars"&&(
              res.varChanges.length===0
                ?<div className="flex items-center justify-center h-full text-[12px]" style={{color:T.t4}}>本次执行无变量变化</div>
                :<table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
                  <thead><tr style={{color:T.t3}}>
                    <th style={{textAlign:"left",paddingBottom:4,fontWeight:600,fontSize:11}}>变量名</th>
                    <th style={{textAlign:"left",paddingBottom:4,fontWeight:600,fontSize:11}}>执行前</th>
                    <th style={{textAlign:"left",paddingBottom:4,fontWeight:600,fontSize:11}}>执行后</th>
                  </tr></thead>
                  <tbody>{res.varChanges.map(v=>(
                    <tr key={v.name}>
                      <td style={{padding:"2px 8px 2px 0",fontFamily:"'JetBrains Mono',monospace",color:T.primary,fontSize:11}}>{v.name}</td>
                      <td style={{padding:"2px 8px 2px 0",color:T.t4,fontSize:11}}>{v.before??<span style={{fontStyle:"italic"}}>未设置</span>}</td>
                      <td style={{padding:"2px 0",color:T.t1,fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>{v.masked?"••••••":v.after}</td>
                    </tr>
                  ))}</tbody>
                </table>
            )}
            {tab==="logs"&&(
              <div className="flex flex-col gap-0.5">
                {res.logs.map((l,i)=>(
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[10px] flex-shrink-0 mt-0.5" style={{fontFamily:"'JetBrains Mono',monospace",color:T.t4}}>{l.time}</span>
                    <span className="text-[11px] leading-relaxed" style={{color:logColor[l.level]??T.t2}}>{l.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PreScriptTab({hasSent}:{hasSent:boolean}){
  const[procs,setProcs]=useState<Proc[]>([
    {...mkProc("script",0),name:"生成签名",script:"const timestamp = Date.now()\nsetVar('timestamp', timestamp)\nrequest.headers['X-Timestamp'] = timestamp\n\nconst token = getVar('access_token')\nif(!token) fail('access_token 未设置')\nrequest.headers['Authorization'] = 'Bearer ' + token\nlog('前置处理完成')"},
  ]);
  const[selId,setSelId]=useState<string|null>("p"+0);
  const[showAdd,setShowAdd]=useState(false);
  const sel=procs.find(p=>p.id===selId)||null;
  const upd=(id:string,patch:Partial<Proc>)=>setProcs(procs.map(p=>p.id===id?{...p,...patch}:p));
  const add=(type:ProcType)=>{const np=mkProc(type,procs.length);setProcs(ps=>[...ps,np]);setSelId(np.id);setShowAdd(false);};
  const del=(id:string)=>{setProcs(ps=>ps.filter(p=>p.id!==id));if(selId===id)setSelId(null);};
  const moveUp=(id:string)=>{const i=procs.findIndex(p=>p.id===id);if(i>0){const a=[...procs];[a[i-1],a[i]]=[a[i],a[i-1]];setProcs(a);}};
  const moveDown=(id:string)=>{const i=procs.findIndex(p=>p.id===id);if(i<procs.length-1){const a=[...procs];[a[i],a[i+1]]=[a[i+1],a[i]];setProcs(a);}};
  const copy=(id:string)=>{const src=procs.find(p=>p.id===id);if(src){const np={...src,id:"p"+Date.now(),name:src.name+" 副本"};setProcs(ps=>[...ps,np]);setSelId(np.id);}};

  return(
    <div style={{display:"flex",flex:1,overflow:"hidden"}}>
      {/* ── Left list ── */}
      <div style={{width:264,borderRight:`1px solid ${T.border}`,background:"#fff",display:"flex",flexDirection:"column",flexShrink:0}}>
        {/* header */}
        <div style={{padding:"8px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowAdd(v=>!v)}
              className="inline-flex items-center gap-1"
              style={{height:26,padding:"0 10px",borderRadius:6,border:`1px solid ${T.border}`,background:"#fff",color:T.t1,fontSize:12,cursor:"pointer",fontWeight:500}}>
              <Plus size={11}/>添加处理器<ChevronDown size={9}/>
            </button>
            {showAdd&&(
              <div style={{position:"absolute",top:"calc(100% + 4px)",right:0,background:"#fff",border:`1px solid ${T.border}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.10)",padding:"4px 0",zIndex:20,width:132}}>
                {PRE_ONLY_TYPES.map(t=>(
                  <button key={t} onClick={()=>add(t)}
                    className="w-full flex items-center px-3 py-2 text-[12px] hover:bg-gray-50 text-left"
                    style={{color:T.t1,border:"none",background:"transparent",cursor:"pointer"}}>
                    {PRE_TYPE_LABEL[t]}处理器
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* list */}
        <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
          {procs.length===0?(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:6,color:T.t4}}>
              <Code2 size={24} style={{opacity:0.3}}/>
              <p style={{fontSize:12,margin:0}}>暂无处理器</p>
              <p style={{fontSize:11,margin:0,color:T.t4}}>点击「添加」开始配置</p>
            </div>
          ):(
            procs.map((p,i)=>(
              <PreProcItem key={p.id} p={p} selected={selId===p.id}
                onSelect={()=>setSelId(p.id)} onToggle={v=>upd(p.id,{enabled:v})}
                onMoveUp={()=>moveUp(p.id)} onMoveDown={()=>moveDown(p.id)}
                isFirst={i===0} isLast={i===procs.length-1}/>
            ))
          )}
        </div>
      </div>

      {/* ── Right detail + results ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#fff"}}>
        <div style={{flex:1,overflow:"hidden"}}>
          {!sel?(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:6,color:T.t4}}>
              <Layers size={28} style={{opacity:0.3}}/>
              <p style={{fontSize:13,margin:0}}>选择左侧处理器进行编辑</p>
            </div>
          ):sel.type==="script"?<PreScriptDetail p={sel} onChange={p=>upd(sel.id,p)} onCopy={()=>copy(sel.id)} onDel={()=>del(sel.id)}/>
           :sel.type==="sql"?<PreSqlDetail p={sel} onChange={p=>upd(sel.id,p)} onCopy={()=>copy(sel.id)} onDel={()=>del(sel.id)}/>
           :<PreWaitDetail p={sel} onChange={p=>upd(sel.id,p)} onCopy={()=>copy(sel.id)} onDel={()=>del(sel.id)}/>}
        </div>
      </div>
    </div>
  );
}

// ─── PostScriptTab V2 ────────────────────────────────────────────────────────

const POST_ONLY_TYPES:ProcType[]=["extract","script","sql","wait"];
const POST_TYPE_ICON:Record<ProcType,React.ElementType>={extract:Layers,script:Code2,sql:Database,wait:Clock};
const POST_TYPE_LABEL:Record<ProcType,string>={extract:"提取",script:"脚本",sql:"SQL",wait:"等待"};

const MOCK_POST_EXEC:PreExecResult={
  status:"success",totalMs:18,
  procResults:[
    {id:"p0",name:"提取 token",status:"success",ms:14},
    {id:"p1",name:"提取 userId",status:"success",ms:2},
  ],
  varChanges:[
    {name:"access_token",before:null,after:"eyJhbGciOiJIUzI1NiJ9.••••••",masked:true},
    {name:"userId",before:null,after:"100234",masked:false},
  ],
  logs:[
    {level:"info",time:"10:23:54.201",msg:"[提取 token] 开始执行"},
    {level:"info",time:"10:23:54.211",msg:"JSONPath $.data.token → 已提取（已脱敏）"},
    {level:"info",time:"10:23:54.212",msg:"setVar('access_token') 写入成功"},
    {level:"info",time:"10:23:54.213",msg:"JSONPath $.data.userId → 100234"},
    {level:"info",time:"10:23:54.215",msg:"setVar('userId') 写入成功"},
    {level:"info",time:"10:23:54.216",msg:"全部后置处理完成，耗时 18ms"},
  ],
};

function PostProcItem({p,selected,onSelect,onToggle,onMoveUp,onMoveDown,isFirst,isLast}:{
  p:Proc;selected:boolean;onSelect:()=>void;onToggle:(v:boolean)=>void;
  onMoveUp:()=>void;onMoveDown:()=>void;isFirst:boolean;isLast:boolean;
}){
  const cfg=PROC_TYPE_CFG[p.type];
  return(
    <div onClick={onSelect} className="group flex items-center gap-2 cursor-pointer transition-colors mx-1 mb-0.5"
      style={{padding:"6px 8px 6px 10px",borderRadius:8,
        background:selected?"#EEF3FF":"transparent"}}>
      <div onClick={e=>e.stopPropagation()} style={{flexShrink:0}}>
        <SmToggle on={p.enabled} onChange={onToggle}/>
      </div>
      <span style={{flexShrink:0,fontSize:11,fontWeight:600,color:cfg.color,background:cfg.bg,
        borderRadius:4,padding:"1px 6px"}}>{cfg.label}</span>
      <span style={{flex:1,minWidth:0,fontSize:12,fontWeight:selected?500:400,
        color:selected?T.primary:p.enabled?T.t1:T.t4,
        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={e=>{e.stopPropagation();onMoveUp();}} disabled={isFirst}
          style={{width:17,height:17,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"none",background:"none",cursor:isFirst?"default":"pointer",color:isFirst?T.t4:T.t2}}><ArrowUp size={10}/></button>
        <button onClick={e=>{e.stopPropagation();onMoveDown();}} disabled={isLast}
          style={{width:17,height:17,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"none",background:"none",cursor:isLast?"default":"pointer",color:isLast?T.t4:T.t2}}><ArrowDown size={10}/></button>
      </div>
    </div>
  );
}

// ── Detail header shared bar ──────────────────────────────────────────────────
function PostDetailHeader({name,enabled,onChange,onCopy,onDel}:{name:string;enabled:boolean;onChange:(p:{name?:string;enabled?:boolean})=>void;onCopy:()=>void;onDel:()=>void}){
  return(
    <div className="flex items-center gap-2 flex-shrink-0" style={{padding:"14px 16px 12px"}}>
      <div className="flex-1">
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>处理器名称</label>
        <input value={name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
      <div className="flex items-center gap-3 pt-5 flex-shrink-0">
        <button onClick={onCopy} style={{fontSize:12,color:T.t2,background:"none",border:"none",cursor:"pointer",padding:0}}>复制</button>
        <button onClick={onDel} style={{fontSize:12,color:T.danger,background:"none",border:"none",cursor:"pointer",padding:0}}>删除</button>
        <div style={{width:1,height:14,background:T.border}}/>
        <SmToggle on={enabled} onChange={v=>onChange({enabled:v})}/>
        <span style={{fontSize:12,color:T.t2}}>启用</span>
      </div>
    </div>
  );
}

// ── Extract item row (table row) ─────────────────────────────────────────────
function PostExtractItemRow({item,onUpdate,onCopy,onDel,hasSent,onOpenQE}:{
  item:ExItem;onUpdate:(p:Partial<ExItem>)=>void;onCopy:()=>void;onDel:()=>void;hasSent:boolean;
  onOpenQE?:()=>void;
}){
  const[showMenu,setShowMenu]=useState(false);
  const[menuPos,setMenuPos]=useState({top:0,left:0});
  const btnRef=React.useRef<HTMLButtonElement>(null);
  const menuRef=React.useRef<HTMLDivElement>(null);
  const scopeOpts=[
    {value:"body",label:"响应体"},{value:"header",label:"响应头"},{value:"cookie",label:"Cookie"},
    {value:"status",label:"状态码"},{value:"url",label:"URL"},
  ];
  const placeholder:Record<string,string>={jsonpath:"$.data.token",xpath:"/response/data/token",regex:'"token":"([^"]+)"'};
  const cell:React.CSSProperties={padding:"6px 8px",verticalAlign:"middle",borderBottom:`1px solid ${T.border}`};
  const inputS:React.CSSProperties={width:"100%",height:28,padding:"0 8px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,outline:"none",color:T.t1,background:"none",boxSizing:"border-box"};
  const selS:React.CSSProperties={width:"100%",height:28,padding:"0 6px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,outline:"none",color:T.t2,background:"#fff",boxSizing:"border-box"};
  const radioRow=(label:string,val:string)=>(
    <label key={val} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:12,color:T.t1}}>
      <input type="radio" name={"mr"+item.id} checked={item.matchRule===val}
        onChange={()=>onUpdate({matchRule:val as ExItem["matchRule"]})}
        style={{accentColor:T.primary,cursor:"pointer"}}/>
      {label}
    </label>
  );
  const openMenu=()=>{
    if(btnRef.current){
      const r=btnRef.current.getBoundingClientRect();
      setMenuPos({top:r.bottom+4,left:r.right-220});
    }
    setShowMenu(v=>!v);
  };
  useEffect(()=>{
    if(!showMenu) return;
    const h=(e:MouseEvent)=>{if(menuRef.current&&!menuRef.current.contains(e.target as Node))setShowMenu(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[showMenu]);
  return(
    <tr style={{background:"#fff"}}>
      <td style={cell}>
        <input value={item.varName} onChange={e=>onUpdate({varName:e.target.value})} placeholder="例如 token"
          style={{...inputS,fontFamily:"'JetBrains Mono',monospace",color:T.primary}}
          onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </td>
      <td style={cell}>
        <input value={item.desc} onChange={e=>onUpdate({desc:e.target.value})} placeholder="可选"
          style={inputS}
          onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </td>
      <td style={cell}>
        <select value={item.varType} onChange={e=>onUpdate({varType:e.target.value as ExItem["varType"]})} style={selS}>
          <option value="temp">临时变量</option><option value="env">环境变量</option>
        </select>
      </td>
      <td style={cell}>
        <select value={item.method} onChange={e=>onUpdate({method:e.target.value as ExItem["method"]})} style={selS}>
          <option value="jsonpath">JSONPath</option><option value="xpath">XPath</option><option value="regex">Regex</option>
        </select>
      </td>
      <td style={cell}>
        <select value={item.scope} onChange={e=>onUpdate({scope:e.target.value as ExItem["scope"]})} style={selS}>
          {scopeOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>
      {/* expression + inline quick-extract icon */}
      <td style={cell}>
        <div style={{position:"relative"}}>
          <input value={item.expr} onChange={e=>onUpdate({expr:e.target.value})}
            placeholder={placeholder[item.method]||""}
            style={{...inputS,fontFamily:"'JetBrains Mono',monospace",color:T.t1,paddingRight:26}}
            onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
          <button onClick={()=>hasSent&&onOpenQE&&onOpenQE()} title={hasSent?"从响应快速提取":"请先发送请求，再使用快速提取"}
            style={{position:"absolute",right:4,top:"50%",transform:"translateY(-50%)",width:18,height:18,
              border:"none",background:"none",cursor:hasSent?"pointer":"not-allowed",padding:0,
              display:"flex",alignItems:"center",justifyContent:"center",color:hasSent?T.success:T.t4}}>
            <Sparkles size={11}/>
          </button>
        </div>
      </td>
      {/* actions */}
      <td style={{...cell,width:68,textAlign:"right" as "right"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:2}}>
          <button ref={btnRef} onClick={openMenu}
            style={{width:26,height:26,border:"none",borderRadius:5,
              background:showMenu?`${T.primary}10`:"none",cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",
              color:showMenu?T.primary:T.t3}}>
            <MoreHorizontal size={14}/>
          </button>
          {showMenu&&ReactDOM.createPortal(
            <div ref={menuRef}
              style={{position:"fixed",top:menuPos.top,left:menuPos.left,zIndex:9999,
                background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,
                boxShadow:"0 8px 24px rgba(0,0,0,0.14)",padding:"6px 0",minWidth:220}}>
              <button onClick={()=>{onCopy();setShowMenu(false);}}
                style={{width:"100%",padding:"7px 14px",border:"none",background:"none",cursor:"pointer",
                  textAlign:"left" as "left",fontSize:12,color:T.primary,display:"block"}}>
                复制当前提取项
              </button>
              <div style={{height:1,background:T.border,margin:"4px 0"}}/>
              <div style={{padding:"6px 14px 4px",fontSize:11,fontWeight:600,color:T.t3,letterSpacing:"0.5px"}}>高级设置</div>
              <div style={{padding:"4px 14px 8px"}}>
                <div style={{fontSize:11,color:T.t2,marginBottom:6}}>结果匹配规则</div>
                <div style={{display:"flex",gap:14,flexWrap:"wrap" as "wrap"}}>
                  {radioRow("随机","random")}
                  {radioRow("指定","index")}
                  {radioRow("全部","all")}
                </div>
                {item.matchRule==="index"&&(
                  <input type="number" value={item.matchIndex} onChange={e=>onUpdate({matchIndex:+e.target.value})} min={0}
                    style={{marginTop:6,width:70,height:26,padding:"0 8px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:12,color:T.t1,outline:"none"}}/>
                )}
              </div>
              {item.method==="regex"&&(
                <div style={{padding:"0 14px 8px",display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,color:T.t3,flexShrink:0}}>Regex 分组</span>
                  <select value={item.regexGroup} onChange={e=>onUpdate({regexGroup:e.target.value as ExItem["regexGroup"]})}
                    style={{flex:1,height:26,padding:"0 6px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:11,color:T.t2,outline:"none"}}>
                    <option value="full">整段匹配</option><option value="group1">分组 1</option>
                  </select>
                </div>
              )}
              {item.method==="xpath"&&(
                <div style={{padding:"0 14px 8px",display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,color:T.t3,flexShrink:0}}>内容格式</span>
                  <select value={item.xpathFmt} onChange={e=>onUpdate({xpathFmt:e.target.value as ExItem["xpathFmt"]})}
                    style={{flex:1,height:26,padding:"0 6px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:11,color:T.t2,outline:"none"}}>
                    <option value="xml">XML</option><option value="html">HTML</option>
                  </select>
                </div>
              )}
            </div>,
            document.body
          )}
          <button onClick={onDel} title="删除"
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50"
            style={{border:"none",background:"none",cursor:"pointer",color:T.t3,flexShrink:0}}>
            <Trash2 size={13}/>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Extract detail ────────────────────────────────────────────────────────────
function PostExtractDetail({p,onChange,onCopy,onDel,hasSent}:{p:Proc;onChange:(patch:Partial<Proc>)=>void;onCopy:()=>void;onDel:()=>void;hasSent:boolean}){
  const items=p.extractItems;
  const add=()=>onChange({extractItems:[...items,mkExItem()]});
  const upd=(id:string,patch:Partial<ExItem>)=>onChange({extractItems:items.map(i=>i.id===id?{...i,...patch}:i)});
  const del=(id:string)=>onChange({extractItems:items.filter(i=>i.id!==id)});
  const[qeOpen,setQeOpen]=useState(false);
  const[qeCfg,setQeCfg]=useState<{method:QEMethod;itemId:string}>({method:"jsonpath",itemId:""});
  const openQE=(method:QEMethod,itemId:string)=>{setQeCfg({method,itemId});setQeOpen(true);};
  return(<>
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <PostDetailHeader name={p.name} enabled={p.enabled} onChange={onChange} onCopy={onCopy} onDel={onDel}/>
      <div style={{flex:1,overflowY:"auto",padding:"16px"}}>
        <div style={{marginBottom:10}}>
          <span style={{fontSize:13,fontWeight:600,color:T.t1}}>提取参数</span>
        </div>
        <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse" as "collapse",fontSize:12,tableLayout:"fixed"}}>
            <colgroup>
              <col style={{width:116}}/>{/* 变量名 */}
              <col style={{width:90}}/>{/* 描述 */}
              <col style={{width:88}}/>{/* 变量类型 */}
              <col style={{width:90}}/>{/* 提取方式 */}
              <col style={{width:76}}/>{/* 提取范围 */}
              <col/>{/* 表达式 flex */}
              <col style={{width:68}}/>{/* 操作 */}
            </colgroup>
            <thead>
              <tr style={{background:"#F8F9FC"}}>
                {["变量名","描述","变量类型","提取方式","提取范围","表达式","操作"].map((h,i)=>(
                  <th key={i} style={{padding:"7px 8px",textAlign:"left" as "left",fontSize:11,fontWeight:600,color:T.t3,borderBottom:`1px solid ${T.border}`,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length===0?(
                <tr><td colSpan={7} style={{padding:"32px 0",textAlign:"center" as "center",color:T.t4}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
                    <Layers size={22} style={{opacity:0.3}}/>
                    <span style={{fontSize:12}}>暂无提取项</span>
                  </div>
                </td></tr>
              ):(
                items.map(item=>(
                  <PostExtractItemRow key={item.id} item={item} hasSent={hasSent}
                    onUpdate={patch=>upd(item.id,patch)}
                    onCopy={()=>{const src=items.find(i=>i.id===item.id);if(src)onChange({extractItems:[...items,{...src,id:"ex"+Date.now()}]});}}
                    onDel={()=>del(item.id)}
                    onOpenQE={()=>openQE(item.method as QEMethod,item.id)}/>
                ))
              )}
            </tbody>
          </table>
          <button onClick={add} style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",color:T.t3,fontSize:12}} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}><Plus size={12}/>添加提取项</button>
        </div>
        <div style={{marginTop:16}}>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:T.t3,marginBottom:4}}>说明（选填）</label>
          <input value={p.desc} onChange={e=>onChange({desc:e.target.value})} placeholder="描述此处理器的用途"
            style={{width:"100%",height:32,padding:"0 12px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,outline:"none",color:T.t1,boxSizing:"border-box" as "border-box"}}
            onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
      </div>
    </div>
    <QuickExtractDrawer open={qeOpen} onClose={()=>setQeOpen(false)}
      initialMethod={qeCfg.method} source="extract-var" hasSent={hasSent}
      onConfirm={(expr,method)=>upd(qeCfg.itemId,{expr,method:method as ExItem["method"]})}/>
    </>
  );
}

// ── Script detail ─────────────────────────────────────────────────────────────
function PostScriptDetail({p,onChange,onCopy,onDel}:{p:Proc;onChange:(patch:Partial<Proc>)=>void;onCopy:()=>void;onDel:()=>void}){
  const APIS=[["response.status","响应状态码"],["response.body","响应体对象"],["response.headers","响应头"],["setVar(name,val)","写入变量"],["getVar(name)","读取变量"],["log(msg)","输出日志"],["fail(msg)","主动失败"]];
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <PostDetailHeader name={p.name} enabled={p.enabled} onChange={onChange} onCopy={onCopy} onDel={onDel}/>
      <div className="flex flex-col gap-3 overflow-y-auto" style={{flex:1,padding:"0 16px 16px"}}>
      <div className="flex-shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <label className="text-[11px] font-semibold" style={{color:T.t3}}>脚本内容</label>
          <div className="flex-1"/>
          <button onClick={()=>onChange({script:""})} className="h-5 px-2 rounded text-[10px]" style={{border:`1px solid ${T.border}`,color:T.t3,background:"transparent"}}>清空</button>
        </div>
        <SmCodeEditor value={p.script} onChange={v=>onChange({script:v})} rows={10}/>
      </div>
      <div className="rounded-lg p-3 flex-shrink-0" style={{background:"#F8F9FC",border:`1px solid ${T.border}`}}>
        <p className="text-[11px] font-semibold mb-2" style={{color:T.t2}}>可用 API</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {APIS.map(([api,desc])=>(
            <div key={api} className="flex items-baseline gap-1.5">
              <code className="text-[11px]" style={{fontFamily:"'JetBrains Mono',monospace",color:"#7816FF"}}>{api}</code>
              <span className="text-[10px]" style={{color:T.t3}}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-shrink-0">
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>说明（选填）</label>
        <input value={p.desc} onChange={e=>onChange({desc:e.target.value})} placeholder="描述此处理器的用途"
          className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none"
          style={{borderColor:T.border,color:T.t1}}
          onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
      </div>
    </div>
  );
}

// ── SQL detail ────────────────────────────────────────────────────────────────
function PostSqlDetail({p,onChange,onCopy,onDel}:{p:Proc;onChange:(patch:Partial<Proc>)=>void;onCopy:()=>void;onDel:()=>void}){
  const addCol=()=>onChange({columnVars:[...p.columnVars,{id:"cv"+Date.now(),varName:"",col:""}]});
  const delCol=(id:string)=>onChange({columnVars:p.columnVars.filter(c=>c.id!==id)});
  const updCol=(id:string,k:"varName"|"col",v:string)=>onChange({columnVars:p.columnVars.map(c=>c.id===id?{...c,[k]:v}:c)});
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <PostDetailHeader name={p.name} enabled={p.enabled} onChange={onChange} onCopy={onCopy} onDel={onDel}/>
      <div className="flex flex-col gap-3 overflow-y-auto" style={{flex:1,padding:"0 16px 16px"}}>
      <div className="flex gap-3 flex-shrink-0">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>数据源</label>
          <div className="flex items-center gap-1.5">
            <Database size={13} style={{color:T.t3,flexShrink:0}}/>
            <select value={p.dbId} onChange={e=>onChange({dbId:e.target.value})} className="flex-1 h-8 px-2 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}}>
              {MOCK_DBS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{width:150}}>
          <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>查询超时 (ms)</label>
          <input type="number" value={p.timeout} onChange={e=>onChange({timeout:+e.target.value})} min={100} max={60000}
            className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}}/>
        </div>
      </div>
      <div className="flex-shrink-0">
        <div className="flex items-center mb-1.5">
          <label className="text-[11px] font-semibold" style={{color:T.t3}}>查询语句</label>
          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{background:"#E8F3FF",color:T.primary}}>仅支持 SELECT</span>
        </div>
        <SmSqlEditor value={p.sql} onChange={v=>onChange({sql:v})} rows={5}/>
      </div>
      <div className="flex-shrink-0">
        <label className="block text-[11px] font-semibold mb-1.5" style={{color:T.t3}}>列 → 变量映射</label>
        <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}>
          <table className="w-full text-[12px]" style={{borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
              {["列名","写入变量名","操作"].map(h=><th key={h} className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3,whiteSpace:"nowrap"}}>{h}</th>)}
            </tr></thead>
            <tbody>{p.columnVars.map((c,i)=>(
              <tr key={c.id} style={{borderBottom:i<p.columnVars.length-1?`1px solid ${T.border}`:"none"}}>
                <td className="px-3 py-1.5"><input value={c.col} onChange={e=>updCol(c.id,"col",e.target.value)} className="w-full outline-none text-[12px]" style={{fontFamily:"'JetBrains Mono',monospace",color:T.t1}} placeholder="e.g. token"/></td>
                <td className="px-3 py-1.5"><input value={c.varName} onChange={e=>updCol(c.id,"varName",e.target.value)} className="w-full outline-none text-[12px]" style={{fontFamily:"'JetBrains Mono',monospace",color:T.primary}} placeholder="变量名"/></td>
                <td className="px-3 py-1.5"><button onClick={()=>delCol(c.id)} title="删除" className="w-6 h-6 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:"pointer",color:T.t3}} onMouseEnter={e=>{e.currentTarget.style.background="#FEF2F2";e.currentTarget.style.color=T.danger;}} onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.t3;}}><Trash2 size={13}/></button></td>
              </tr>
            ))}</tbody>
          </table>
          <button onClick={addCol} style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",color:T.t3,fontSize:12}} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}><Plus size={12}/>添加列</button>
        </div>
      </div>
      <div className="flex-shrink-0">
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>完整结果变量（选填）</label>
        <input value={p.resultVar} onChange={e=>onChange({resultVar:e.target.value})}
          placeholder="将查询结果数组整体存入此变量"
          className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none"
          style={{borderColor:T.border,color:T.primary,fontFamily:"'JetBrains Mono',monospace"}}
          onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
      <div className="flex-shrink-0">
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>说明（选填）</label>
        <input value={p.desc} onChange={e=>onChange({desc:e.target.value})} placeholder="描述此处理器的用途"
          className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none"
          style={{borderColor:T.border,color:T.t1}}
          onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
      </div>
    </div>
  );
}

// ── Wait detail ───────────────────────────────────────────────────────────────
function PostWaitDetail({p,onChange,onCopy,onDel}:{p:Proc;onChange:(patch:Partial<Proc>)=>void;onCopy:()=>void;onDel:()=>void}){
  const presets=[500,1000,2000,5000];
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      <PostDetailHeader name={p.name} enabled={p.enabled} onChange={onChange} onCopy={onCopy} onDel={onDel}/>
      <div className="flex flex-col gap-4 overflow-y-auto" style={{flex:1,padding:"0 16px 16px"}}>
      <div className="flex-shrink-0" style={{maxWidth:360}}>
        <label className="block text-[11px] font-semibold mb-1.5" style={{color:T.t3}}>等待时长</label>
        <div className="flex items-center gap-2 mb-2">
          <input type="number" value={p.waitMs} onChange={e=>onChange({waitMs:Math.min(600000,Math.max(1,+e.target.value))})} min={1} max={600000}
            className="flex-1 h-9 px-3 border rounded-lg text-[14px] font-semibold outline-none"
            style={{borderColor:T.border,color:T.t1}}
            onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
          <span className="text-[12px] flex-shrink-0" style={{color:T.t3}}>毫秒 (ms)</span>
        </div>
        <div className="flex gap-1.5">
          {presets.map(ms=>(
            <button key={ms} onClick={()=>onChange({waitMs:ms})}
              className="h-6 px-3 rounded text-[11px] transition-colors"
              style={{border:`1px solid ${p.waitMs===ms?T.primary:T.border}`,background:p.waitMs===ms?`${T.primary}0D`:"transparent",color:p.waitMs===ms?T.primary:T.t3,cursor:"pointer"}}>
              {ms>=1000?`${ms/1000}s`:`${ms}ms`}
            </button>
          ))}
        </div>
        <p className="text-[11px] mt-2" style={{color:T.t4}}>最长 600,000 ms（10 分钟）</p>
      </div>
      <div className="flex-shrink-0">
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>说明（选填）</label>
        <input value={p.desc} onChange={e=>onChange({desc:e.target.value})} placeholder="描述等待原因"
          className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none"
          style={{borderColor:T.border,color:T.t1}}
          onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
      </div>
    </div>
  );
}

// ── Main PostScriptTab ────────────────────────────────────────────────────────
function PostScriptTab({hasSent}:{hasSent:boolean}){
  const[procs,setProcs]=useState<Proc[]>([
    {...mkProc("extract",0),name:"提取 token",extractItems:[
      {id:"ex1",enabled:true,varName:"access_token",desc:"登录 token",varType:"temp",method:"jsonpath",scope:"body",expr:"$.data.token",matchRule:"random",matchIndex:0,regexGroup:"full",xpathFmt:"xml"},
      {id:"ex2",enabled:true,varName:"userId",desc:"用户 ID",varType:"temp",method:"jsonpath",scope:"body",expr:"$.data.userId",matchRule:"random",matchIndex:0,regexGroup:"full",xpathFmt:"xml"},
    ]},
  ]);
  const[selId,setSelId]=useState<string|null>(procs[0]?.id||null);
  const[showAdd,setShowAdd]=useState(false);
  const sel=procs.find(p=>p.id===selId)||null;
  const upd=(id:string,patch:Partial<Proc>)=>setProcs(procs.map(p=>p.id===id?{...p,...patch}:p));
  const add=(type:ProcType)=>{const np=mkProc(type,procs.length);setProcs(ps=>[...ps,np]);setSelId(np.id);setShowAdd(false);};
  const del=(id:string)=>{setProcs(ps=>ps.filter(p=>p.id!==id));if(selId===id)setSelId(null);};
  const moveUp=(id:string)=>{const i=procs.findIndex(p=>p.id===id);if(i>0){const a=[...procs];[a[i-1],a[i]]=[a[i],a[i-1]];setProcs(a);}};
  const moveDown=(id:string)=>{const i=procs.findIndex(p=>p.id===id);if(i<procs.length-1){const a=[...procs];[a[i],a[i+1]]=[a[i+1],a[i]];setProcs(a);}};
  const copy=(id:string)=>{const src=procs.find(p=>p.id===id);if(src){const np={...src,id:"p"+Date.now(),name:src.name+" 副本"};setProcs(ps=>[...ps,np]);setSelId(np.id);}};

  return(
    <div style={{display:"flex",flex:1,overflow:"hidden"}}>
      {/* ── Left list ── */}
      <div style={{width:264,borderRight:`1px solid ${T.border}`,background:"#fff",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"8px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowAdd(v=>!v)}
              style={{height:26,padding:"0 10px",borderRadius:6,border:`1px solid ${T.border}`,background:"#fff",color:T.t1,fontSize:12,cursor:"pointer",fontWeight:500,display:"inline-flex",alignItems:"center",gap:4}}>
              <Plus size={11}/>添加处理器<ChevronDown size={9}/>
            </button>
            {showAdd&&(
              <div style={{position:"absolute",top:"calc(100% + 4px)",right:0,background:"#fff",border:`1px solid ${T.border}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.10)",padding:"4px 0",zIndex:20,width:128}}>
                {POST_ONLY_TYPES.map(t=>(
                  <button key={t} onClick={()=>add(t)}
                    style={{width:"100%",padding:"7px 12px",fontSize:12,color:T.t1,border:"none",background:"transparent",cursor:"pointer",textAlign:"left" as "left"}}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="#F5F6F8"}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}>
                    {POST_TYPE_LABEL[t]}处理器
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"6px 0"}}>
          {procs.length===0?(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:6,color:T.t4}}>
              <Layers size={24} style={{opacity:0.3}}/>
              <p style={{fontSize:12,margin:0}}>暂无处理器</p>
              <p style={{fontSize:11,margin:0}}>点击「添加」开始配置</p>
            </div>
          ):(
            procs.map((p,i)=>(
              <PostProcItem key={p.id} p={p} selected={selId===p.id}
                onSelect={()=>setSelId(p.id)} onToggle={v=>upd(p.id,{enabled:v})}
                onMoveUp={()=>moveUp(p.id)} onMoveDown={()=>moveDown(p.id)}
                isFirst={i===0} isLast={i===procs.length-1}/>
            ))
          )}
        </div>
      </div>

      {/* ── Right detail + results ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#fff"}}>
        <div style={{flex:1,overflow:"hidden"}}>
          {!sel?(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:6,color:T.t4}}>
              <Layers size={28} style={{opacity:0.3}}/>
              <p style={{fontSize:13,margin:0}}>选择左侧处理器进行编辑</p>
            </div>
          ):sel.type==="extract"
            ?<PostExtractDetail p={sel} onChange={p=>upd(sel.id,p)} onCopy={()=>copy(sel.id)} onDel={()=>del(sel.id)} hasSent={hasSent}/>
            :sel.type==="script"
            ?<PostScriptDetail p={sel} onChange={p=>upd(sel.id,p)} onCopy={()=>copy(sel.id)} onDel={()=>del(sel.id)}/>
            :sel.type==="sql"
            ?<PostSqlDetail p={sel} onChange={p=>upd(sel.id,p)} onCopy={()=>copy(sel.id)} onDel={()=>del(sel.id)}/>
            :<PostWaitDetail p={sel} onChange={p=>upd(sel.id,p)} onCopy={()=>copy(sel.id)} onDel={()=>del(sel.id)}/>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Assert Tab ───────────────────────────────────────────────────────────────

type AssertKind="status"|"resp-header"|"resp-body"|"resp-time"|"variable"|"script";
interface Assert2{
  id:string;name:string;kind:AssertKind;enabled:boolean;desc:string;
  statusOp:string;statusExpected:number;
  headerRows:{id:string;header:string;op:string;expected:string;current:string}[];
  bodySubType:"jsonpath"|"xpath"|"regex";
  bodyRows:{id:string;expr:string;op:string;expected:string;current:string}[];
  timeOp:string;timeMs:number;lastTimeMs:number|null;
  varRows:{id:string;varName:string;op:string;expected:string;current:string}[];
  script:string;
}
const ASSERT_KIND_CFG:Record<AssertKind,{label:string;color:string;bg:string;icon:React.ElementType}>={
  "status":     {label:"状态码",  color:"#165DFF",bg:"#E8EEFF", icon:Hash},
  "resp-header":{label:"响应头",  color:"#00AECF",bg:"#E5F6FA", icon:Server},
  "resp-body":  {label:"响应体",  color:"#7816FF",bg:"#F0E8FF", icon:FileText},
  "resp-time":  {label:"响应时间",color:"#00B42A",bg:"#E6F9EC", icon:Timer},
  "variable":   {label:"变量",    color:"#FF7D00",bg:"#FFF2E5", icon:Variable},
  "script":     {label:"脚本",    color:"#E0186C",bg:"#FCE8F2", icon:Code2},
};

function mkAssert(kind:AssertKind,idx:number):Assert2{
  const names:Record<AssertKind,string>={status:"状态码断言","resp-header":"响应头断言","resp-body":"响应体断言","resp-time":"响应时间断言",variable:"变量断言",script:"脚本断言"};
  return{
    id:"as"+Date.now()+idx,name:names[kind]+" "+(idx+1),kind,enabled:true,desc:"",
    statusOp:"等于",statusExpected:200,
    headerRows:[{id:"h1",header:"Content-Type",op:"包含",expected:"application/json",current:""}],
    bodySubType:"jsonpath",bodyRows:[{id:"b1",expr:"$.code",op:"等于",expected:"0",current:""}],
    timeOp:"小于等于",timeMs:1000,lastTimeMs:null,
    varRows:[{id:"v1",varName:"access_token",op:"不为空",expected:"",current:""}],
    script:'if (response.statusCode !== 200) {\n  fail("状态码不是 200")\n}\nlog("断言通过")',
  };
}


// ─── Quick Extract Drawer ───────────────────────────────────────────────────
type QEMethod="jsonpath"|"xpath"|"regex";
type QESource="extract-var"|"body-assert";

const MOCK_QE_JSON:Record<string,unknown>={
  code:0,message:"success",
  data:{userId:12345,username:"john_doe",email:"john@example.com",
    token:"eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjEyMzQ1fQ.Abc123",
    roles:["admin","user"],
    profile:{nickname:"John",avatar:"https://cdn.example.com/avatars/12345.jpg",createdAt:"2024-01-15T08:30:00Z"}}
};
const MOCK_QE_XML=`<?xml version="1.0" encoding="UTF-8"?>
<response>
  <code>0</code>
  <message>success</message>
  <data>
    <userId>12345</userId>
    <username>john_doe</username>
    <token>eyJhbGciOiJIUzI1NiJ9...</token>
    <roles>
      <role>admin</role>
      <role>user</role>
    </roles>
  </data>
</response>`;
const MOCK_QE_TEXT=JSON.stringify(MOCK_QE_JSON,null,2);

function evalQEPath(obj:unknown,path:string):string[]{
  try{
    if(path==="$")return[JSON.stringify(obj)];
    const parts=path.replace(/\[(\d+)\]/g,".$1").split(".").slice(1);
    let cur:unknown=obj;
    for(const p of parts){
      if(cur==null)return[];
      if(Array.isArray(cur)){const i=parseInt(p);cur=isNaN(i)?undefined:cur[i];}
      else cur=(cur as Record<string,unknown>)[p];
    }
    if(cur==null)return[];
    if(Array.isArray(cur))return(cur as unknown[]).map(v=>typeof v==="string"?v:JSON.stringify(v));
    if(typeof cur==="object")return[JSON.stringify(cur)];
    return[String(cur)];
  }catch{return[];}
}
function evalQERegex(text:string,pat:string,group:"full"|"group1"):string[]{
  try{
    const re=new RegExp(pat,"g");const out:string[]=[];let m:RegExpExecArray|null;
    while((m=re.exec(text))!==null){out.push(group==="group1"&&m[1]!=null?m[1]:m[0]);if(out.length>=10)break;}
    return out;
  }catch{return[];}
}

function QEJsonNode({k,val,path,depth,onSelect}:{k:string|number;val:unknown;path:string;depth:number;onSelect:(p:string)=>void}){
  const isArr=Array.isArray(val);
  const isObj=val!==null&&typeof val==="object"&&!isArr;
  const isExp=isArr||isObj;
  const[open,setOpen]=useState(depth<2);
  const dk=typeof k==="number"?`[${k}]`:k;
  const vc=(v:unknown):string=>{
    if(v===null)return T.t4;
    if(typeof v==="string")return T.success;
    if(typeof v==="number")return T.primary;
    if(typeof v==="boolean")return T.warning;
    return T.t1;
  };
  const dv=(v:unknown):string=>{
    if(v===null)return"null";
    if(typeof v==="string")return`"${v}"`;
    return String(v);
  };
  return(
    <div style={{paddingLeft:depth>0?16:0}}>
      <div className="group flex items-center gap-1 rounded" style={{padding:"2px 4px",cursor:"pointer",userSelect:"none" as "none"}}
        onMouseEnter={e=>e.currentTarget.style.background="#F4F6FA"}
        onMouseLeave={e=>e.currentTarget.style.background="none"}
        onClick={()=>isExp?setOpen(v=>!v):onSelect(path)}>
        <div style={{width:14,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {isExp&&<ChevronRight size={11} style={{color:T.t3,transition:"transform 0.12s",transform:open?"rotate(90deg)":"none"}}/>}
        </div>
        <span style={{fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}>
          {k!==""&&<><span style={{color:T.t1,fontWeight:500}}>{dk}</span><span style={{color:T.t4}}>: </span></>}
          {isArr&&<span style={{color:T.t3}}>Array [{(val as unknown[]).length}]</span>}
          {isObj&&<span style={{color:T.t3}}>Object</span>}
          {!isExp&&<span style={{color:vc(val)}}>{dv(val)}</span>}
        </span>
        {!isExp&&(
          <button onClick={e=>{e.stopPropagation();onSelect(path);}}
            style={{marginLeft:"auto",fontSize:10,padding:"1px 7px",borderRadius:4,
              background:`${T.primary}15`,color:T.primary,border:"none",cursor:"pointer",fontWeight:500,
              opacity:0,whiteSpace:"nowrap" as "nowrap"}}
            className="group-hover:opacity-100">选取</button>
        )}
      </div>
      {open&&isExp&&(
        isArr
          ?(val as unknown[]).map((v,i)=><QEJsonNode key={i} k={i} val={v} path={`${path}[${i}]`} depth={depth+1} onSelect={onSelect}/>)
          :Object.entries(val as Record<string,unknown>).map(([k2,v])=><QEJsonNode key={k2} k={k2} val={v} path={`${path}.${k2}`} depth={depth+1} onSelect={onSelect}/>)
      )}
    </div>
  );
}

function QuickExtractDrawer({open,onClose,initialMethod,source,hasSent,onConfirm}:{
  open:boolean;onClose:()=>void;initialMethod:QEMethod;source:QESource;hasSent:boolean;
  onConfirm:(expr:string,method:QEMethod,firstMatch?:string)=>void;
}){
  const[method,setMethod]=useState<QEMethod>(initialMethod);
  const[expr,setExpr]=useState("");
  const[results,setResults]=useState<string[]|null>(null);
  const[tested,setTested]=useState(false);
  const[regexGroup,setRegexGroup]=useState<"full"|"group1">("full");
  const[xpathFmt,setXpathFmt]=useState<"xml"|"html">("xml");

  useEffect(()=>{if(open){setMethod(initialMethod);setExpr("");setResults(null);setTested(false);}},[open,initialMethod]);

  const srcLabel=source==="extract-var"?"提取变量":"响应体断言";
  const srcCfg=source==="extract-var"?{color:"#00B42A",bg:"#E6F9EC"}:{color:"#7816FF",bg:"#F0E8FF"};

  const doTest=()=>{
    if(!expr.trim())return;
    if(method==="jsonpath")setResults(evalQEPath(MOCK_QE_JSON,expr));
    else if(method==="regex")setResults(evalQERegex(MOCK_QE_TEXT,expr,regexGroup));
    else setResults(["12345"]);  // XPath mock
    setTested(true);
  };

  const doConfirm=()=>{
    onConfirm(expr,method,results&&results.length>0?results[0]:undefined);
    onClose();
  };

  if(!open)return null;
  return ReactDOM.createPortal(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:1000}}/>
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:720,background:"#fff",zIndex:1001,
        display:"flex",flexDirection:"column",boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <span style={{fontSize:15,fontWeight:600,color:T.t1}}>快速提取</span>
          <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,color:srcCfg.color,background:srcCfg.bg}}>{srcLabel}</span>
          <div style={{flex:1}}/>
          <button onClick={onClose} style={{width:28,height:28,border:"none",background:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:6,color:T.t3}}
            onMouseEnter={e=>e.currentTarget.style.background=T.bg} onMouseLeave={e=>e.currentTarget.style.background="none"}>
            <X size={16}/>
          </button>
        </div>

        {/* Method tabs */}
        <div style={{padding:"0 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex"}}>
          {([["jsonpath","JSONPath"],["xpath","XPath"],["regex","Regex"]] as [QEMethod,string][]).map(([m,label])=>(
            <button key={m} onClick={()=>{setMethod(m);setExpr("");setResults(null);setTested(false);}}
              style={{padding:"10px 16px",border:"none",background:"none",cursor:"pointer",fontSize:13,
                fontWeight:method===m?600:400,color:method===m?T.primary:T.t2,
                borderBottom:method===m?`2px solid ${T.primary}`:"2px solid transparent",marginBottom:-1}}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:20}}>

          {/* Response preview */}
          <div>
            <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:8}}>响应内容</div>
            <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
              <div style={{padding:"6px 12px",background:"#F8F9FC",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:T.success,flexShrink:0}}/>
                <span style={{fontSize:11,color:T.t3,fontWeight:500}}>200 OK · 128ms</span>
                <span style={{fontSize:11,color:T.t4,marginLeft:"auto"}}>
                  {method==="jsonpath"?"application/json":method==="xpath"?"application/xml":"text/plain"}
                </span>
              </div>
              <div style={{maxHeight:260,overflowY:"auto",padding:"10px 12px",background:"#fff"}}>
                {method==="jsonpath"&&(
                  <QEJsonNode k="" val={MOCK_QE_JSON} path="$" depth={0} onSelect={p=>{setExpr(p);setResults(null);setTested(false);}}/>
                )}
                {(method==="xpath"||method==="regex")&&(
                  <pre style={{margin:0,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:T.t1,lineHeight:1.7,whiteSpace:"pre-wrap" as "pre-wrap"}}>
                    {method==="xpath"?MOCK_QE_XML:MOCK_QE_TEXT}
                  </pre>
                )}
              </div>
            </div>
            <p style={{fontSize:11,color:T.t3,marginTop:6,marginBottom:0}}>
              {method==="jsonpath"?"点击字段值自动生成 JSONPath，点击对象 / 数组节点展开"
               :method==="xpath"?"手动输入 XPath 表达式，或参考上方节点结构"
               :"在下方输入正则表达式，支持分组捕获"}
            </p>
          </div>

          {/* Expression */}
          <div>
            <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:8}}>表达式配置</div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <input value={expr} onChange={e=>{setExpr(e.target.value);setResults(null);setTested(false);}}
                placeholder={method==="jsonpath"?"$.data.token":method==="xpath"?"/response/data/token":'"token":"([^"]+)"'}
                style={{flex:1,height:34,padding:"0 12px",border:`1px solid ${T.border}`,borderRadius:8,
                  fontSize:13,fontFamily:"'JetBrains Mono',monospace",color:T.t1,outline:"none"}}
                onFocus={e=>e.currentTarget.style.borderColor=T.primary}
                onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
              <button onClick={doTest} disabled={!expr.trim()}
                style={{height:34,padding:"0 20px",borderRadius:8,border:"none",fontSize:13,fontWeight:500,flexShrink:0,
                  background:expr.trim()?T.primary:"#F2F3F5",color:expr.trim()?"#fff":T.t4,
                  cursor:expr.trim()?"pointer":"not-allowed"}}>测试</button>
            </div>
            {method==="regex"&&(
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:12,color:T.t3}}>匹配内容</span>
                {([["full","完整匹配"],["group1","分组 1"]] as ["full"|"group1",string][]).map(([v,l])=>(
                  <label key={v} style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:12,color:T.t1}}>
                    <input type="radio" checked={regexGroup===v} onChange={()=>setRegexGroup(v)} style={{accentColor:T.primary}}/>
                    {l}
                  </label>
                ))}
              </div>
            )}
            {method==="xpath"&&(
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:12,color:T.t3}}>文档格式</span>
                {([["xml","XML"],["html","HTML"]] as ["xml"|"html",string][]).map(([v,l])=>(
                  <label key={v} style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:12,color:T.t1}}>
                    <input type="radio" checked={xpathFmt===v} onChange={()=>setXpathFmt(v)} style={{accentColor:T.primary}}/>
                    {l}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          <div>
            <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:8}}>匹配结果</div>
            {!tested?(
              <div style={{padding:"32px 0",textAlign:"center" as "center",color:T.t4}}>
                <Search size={22} style={{opacity:0.3,display:"block",margin:"0 auto 8px"}}/>
                <span style={{fontSize:12}}>点击「测试」查看匹配结果</span>
              </div>
            ):results&&results.length>0?(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {results.map((r,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"9px 12px",
                    background:"#F0FFF4",border:`1px solid ${T.success}40`,borderRadius:8}}>
                    <CheckCircle size={14} style={{color:T.success,flexShrink:0,marginTop:1}}/>
                    <span style={{fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:T.t1,wordBreak:"break-all" as "break-all",flex:1,lineHeight:1.6}}>{r}</span>
                    <span style={{fontSize:11,color:T.t4,flexShrink:0,alignSelf:"flex-end"}}>#{i+1}</span>
                  </div>
                ))}
              </div>
            ):(
              <div style={{padding:"32px 0",textAlign:"center" as "center",color:T.t4}}>
                <XCircle size={22} style={{opacity:0.3,display:"block",margin:"0 auto 8px"}}/>
                <span style={{fontSize:12}}>未匹配到结果，请检查表达式</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:"12px 20px",borderTop:`1px solid ${T.border}`,flexShrink:0,
          display:"flex",justifyContent:"flex-end",gap:8,background:"#fff"}}>
          <button onClick={onClose}
            style={{height:32,padding:"0 16px",border:`1px solid ${T.border}`,borderRadius:8,
              background:"#fff",color:T.t1,fontSize:13,cursor:"pointer"}}>取消</button>
          <button onClick={doConfirm} disabled={!expr.trim()}
            style={{height:32,padding:"0 16px",border:"none",borderRadius:8,fontSize:13,fontWeight:500,
              background:expr.trim()?T.primary:"#F2F3F5",color:expr.trim()?"#fff":T.t4,
              cursor:expr.trim()?"pointer":"not-allowed"}}>确认回填</button>
        </div>
      </div>
    </>,
    document.body
  );
}

function AssertListItem({a,selected,onSelect,onToggle,onMoveUp,onMoveDown,isFirst,isLast}:{
  a:Assert2;selected:boolean;onSelect:()=>void;onToggle:(v:boolean)=>void;
  onMoveUp:()=>void;onMoveDown:()=>void;isFirst:boolean;isLast:boolean;
}){
  const cfg=ASSERT_KIND_CFG[a.kind];
  return(
    <div onClick={onSelect} className="group flex items-center gap-2 cursor-pointer transition-colors mx-1 mb-0.5"
      style={{padding:"6px 8px 6px 10px",borderRadius:8,
        background:selected?"#EEF3FF":"transparent"}}>
      <div onClick={e=>e.stopPropagation()} style={{flexShrink:0}}>
        <SmToggle on={a.enabled} onChange={onToggle}/>
      </div>
      <span style={{flexShrink:0,fontSize:11,fontWeight:600,color:cfg.color,background:cfg.bg,
        borderRadius:4,padding:"1px 6px"}}>{cfg.label}</span>
      <span style={{flex:1,minWidth:0,fontSize:12,fontWeight:selected?500:400,
        color:selected?T.primary:a.enabled?T.t1:T.t4,
        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={e=>{e.stopPropagation();onMoveUp();}} disabled={isFirst}
          style={{width:17,height:17,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"none",background:"none",cursor:isFirst?"default":"pointer",color:isFirst?T.t4:T.t2}}><ArrowUp size={10}/></button>
        <button onClick={e=>{e.stopPropagation();onMoveDown();}} disabled={isLast}
          style={{width:17,height:17,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:3,border:"none",background:"none",cursor:isLast?"default":"pointer",color:isLast?T.t4:T.t2}}><ArrowDown size={10}/></button>
      </div>
    </div>
  );
}

function AssertDetailHeader({name,enabled,onChange,onCopy,onDel}:{
  name:string;enabled:boolean;
  onChange:(p:{name?:string;enabled?:boolean})=>void;
  onCopy:()=>void;onDel:()=>void;
}){
  return(
    <div className="flex items-center gap-2 flex-shrink-0 px-4 py-3" style={{borderBottom:`1px solid ${T.border}`}}>
      <div className="flex-1 min-w-0">
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>断言名称</label>
        <input value={name} onChange={e=>onChange({name:e.target.value})}
          className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none"
          style={{borderColor:T.border,color:T.t1}}
          onFocus={e=>e.currentTarget.style.borderColor=T.primary}
          onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
      <div className="flex items-center gap-3 pt-5 flex-shrink-0">
        <button onClick={onCopy} style={{fontSize:12,color:T.t2,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",borderRadius:4}}>复制</button>
        <button onClick={onDel} style={{fontSize:12,color:T.danger,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",borderRadius:4}}>删除</button>
        <div style={{width:1,height:14,background:T.border}}/>
        <SmToggle on={enabled} onChange={v=>onChange({enabled:v})}/>
        <span style={{fontSize:12,color:T.t2}}>启用</span>
      </div>
    </div>
  );
}

type AssertResultStatus="pass"|"fail"|"skip";
type AssertResult={id:string;name:string;kindLabel:string;subject:string;condition:string;expected:string;actual:string;status:AssertResultStatus;failReason?:string};

// ─── Response area tab panels ───────────────────────────────────────────────
const MOCK_RESP_HEADERS=[
  {name:"Content-Type",value:"application/json; charset=utf-8"},
  {name:"Content-Length",value:"512"},
  {name:"Cache-Control",value:"no-cache, no-store, must-revalidate"},
  {name:"X-Request-Id",value:"a3f9d2c1-4b82-4e7a-9f3d-1a2b3c4d5e6f"},
  {name:"X-RateLimit-Limit",value:"1000"},
  {name:"X-RateLimit-Remaining",value:"998"},
  {name:"Access-Control-Allow-Origin",value:"*"},
  {name:"Server",value:"nginx/1.24.0"},
];
const MOCK_RESP_COOKIES=[
  {name:"session_id",value:"eyJhbGciOiJIUzI1NiJ9.session.xyz",attrs:"HttpOnly; Secure; SameSite=Strict"},
  {name:"csrf_token",value:"a7f3d2c1b4e9",attrs:"SameSite=Lax"},
];

function RespBodyTab({hasSent}:{hasSent:boolean}){
  if(!hasSent)return(
    <div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}>
      <Play size={28} className="mb-2"/><p className="text-[13px]">点击「发送」获取响应内容</p>
    </div>
  );
  return(
    <pre className="text-[12px] leading-relaxed" style={{fontFamily:"'JetBrains Mono',monospace",color:T.t1,margin:0}}>
      {MOCK_RESPONSE_JSON}
    </pre>
  );
}

function RespHeadersTab({hasSent}:{hasSent:boolean}){
  const[copied,setCopied]=useState<string|null>(null);
  const copy=(v:string)=>{navigator.clipboard?.writeText(v);setCopied(v);setTimeout(()=>setCopied(null),1500);};
  if(!hasSent)return(
    <div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}>
      <Play size={28} className="mb-2"/><p className="text-[13px]">点击「发送」获取响应内容</p>
    </div>
  );
  return(
    <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse" as "collapse",fontSize:12}}>
        <thead>
          <tr style={{background:"#F8F9FC"}}>
            <th style={{padding:"7px 14px",textAlign:"left" as "left",fontSize:11,fontWeight:600,color:T.t3,borderBottom:`1px solid ${T.border}`,width:"36%"}}>Header 名称</th>
            <th style={{padding:"7px 14px",textAlign:"left" as "left",fontSize:11,fontWeight:600,color:T.t3,borderBottom:`1px solid ${T.border}`}}>值</th>
            <th style={{padding:"7px 8px",width:36,borderBottom:`1px solid ${T.border}`}}/>
          </tr>
        </thead>
        <tbody>
          {MOCK_RESP_HEADERS.map((h,i)=>(
            <tr key={h.name} className="group" style={{borderBottom:i<MOCK_RESP_HEADERS.length-1?`1px solid ${T.border}`:"none"}}>
              <td style={{padding:"7px 14px",color:T.t2,fontFamily:"'JetBrains Mono',monospace",fontWeight:500,wordBreak:"break-all" as "break-all"}}>{h.name}</td>
              <td style={{padding:"7px 14px",color:T.t1,fontFamily:"'JetBrains Mono',monospace",wordBreak:"break-all" as "break-all",lineHeight:1.6}}>{h.value}</td>
              <td style={{padding:"4px 8px",textAlign:"center" as "center"}}>
                <button onClick={()=>copy(h.value)} title="复制"
                  style={{width:24,height:24,border:"none",background:"none",cursor:"pointer",borderRadius:4,
                    color:copied===h.value?T.success:T.t4,display:"inline-flex",alignItems:"center",justifyContent:"center"}}
                  onMouseEnter={e=>e.currentTarget.style.color=T.primary}
                  onMouseLeave={e=>e.currentTarget.style.color=copied===h.value?T.success:T.t4}>
                  {copied===h.value?<CheckCircle size={13}/>:<Copy size={13}/>}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RespCookiesTab({hasSent}:{hasSent:boolean}){
  if(!hasSent)return(
    <div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}>
      <Play size={28} className="mb-2"/><p className="text-[13px]">点击「发送」获取响应内容</p>
    </div>
  );
  if(MOCK_RESP_COOKIES.length===0)return(
    <div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}>
      <p className="text-[13px]">当前响应暂无 Cookies</p>
    </div>
  );
  return(
    <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse" as "collapse",fontSize:12}}>
        <thead>
          <tr style={{background:"#F8F9FC"}}>
            {["Cookie 名称","值","属性"].map((h,i)=>(
              <th key={i} style={{padding:"7px 14px",textAlign:"left" as "left",fontSize:11,fontWeight:600,color:T.t3,borderBottom:`1px solid ${T.border}`}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MOCK_RESP_COOKIES.map((c,i)=>(
            <tr key={c.name} style={{borderBottom:i<MOCK_RESP_COOKIES.length-1?`1px solid ${T.border}`:"none"}}>
              <td style={{padding:"7px 14px",color:T.t2,fontFamily:"'JetBrains Mono',monospace",fontWeight:500,whiteSpace:"nowrap" as "nowrap"}}>{c.name}</td>
              <td style={{padding:"7px 14px",color:T.t1,fontFamily:"'JetBrains Mono',monospace",wordBreak:"break-all" as "break-all",maxWidth:280,lineHeight:1.5}}>{c.value}</td>
              <td style={{padding:"7px 14px",color:T.t3,fontSize:11}}>{c.attrs||"—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RespAssertTab({results,hasSent}:{results:AssertResult[];hasSent:boolean}){
  if(!hasSent)return(
    <div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}>
      <Play size={28} className="mb-2"/><p className="text-[13px]">点击「发送」查看断言结果</p>
    </div>
  );
  if(results.length===0)return(
    <div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}>
      <FlaskConical size={28} className="mb-2" style={{opacity:0.3}}/>
      <p className="text-[13px]">当前请求未配置断言</p>
    </div>
  );
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* table */}
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse" as "collapse",fontSize:12}}>
          <thead>
            <tr style={{background:"#F8F9FC"}}>
              {["断言名称","断言对象","判断条件","期望值","实际值","结果"].map((h,i)=>(
                <th key={i} style={{padding:"7px 12px",textAlign:"left" as "left",fontSize:11,fontWeight:600,
                  color:T.t3,borderBottom:`1px solid ${T.border}`,whiteSpace:"nowrap" as "nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r,i)=>{
              const isLast=i===results.length-1;
              const isFail=r.status==="fail";
              const isSkip=r.status==="skip";
              return(
                <React.Fragment key={r.id}>
                  <tr style={{borderBottom:!isLast?`1px solid ${T.border}`:"none",background:"#fff"}}>
                    <td style={{padding:"8px 12px",color:T.t1,fontWeight:500}}>{r.name}</td>
                    <td style={{padding:"8px 12px",color:T.t3}}>{r.subject}</td>
                    <td style={{padding:"8px 12px",color:T.t2}}>{r.condition}</td>
                    <td style={{padding:"8px 12px",fontFamily:"'JetBrains Mono',monospace",color:T.t2,maxWidth:160,wordBreak:"break-all" as "break-all"}}>{r.expected||"—"}</td>
                    <td style={{padding:"8px 12px",fontFamily:"'JetBrains Mono',monospace",
                      color:isFail?T.danger:T.t2,maxWidth:160,wordBreak:"break-all" as "break-all"}}>{r.actual||"—"}</td>
                    <td style={{padding:"8px 12px",whiteSpace:"nowrap" as "nowrap"}}>
                      {r.status==="pass"&&<span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,fontWeight:500,color:T.success}}><CheckCircle size={12}/>通过</span>}
                      {r.status==="fail"&&<span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,fontWeight:500,color:T.danger}}><XCircle size={12}/>失败</span>}
                      {r.status==="skip"&&<span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,color:T.t3}}>未执行</span>}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Legacy AssertExecPanel kept for backward compat (used in AssertTab)
function AssertExecPanel({results,hasSent}:{results:AssertResult[];hasSent:boolean}){
  if(!hasSent) return null;
  const pass=results.filter(r=>r.status==="pass").length;
  const total=results.length;
  return(
    <div style={{borderTop:`1px solid ${T.border}`,flexShrink:0}}>
      <div className="flex items-center gap-2 px-3 py-2" style={{background:"#FAFAFA"}}>
        <span style={{fontSize:12,fontWeight:500,color:T.t2}}>执行结果</span>
        <div style={{flex:1}}/>
        <span style={{fontSize:11,fontWeight:500,color:pass===total?T.success:T.danger}}>{pass}/{total} 通过</span>
      </div>
      <div style={{maxHeight:180,overflowY:"auto"}}>
        <table style={{width:"100%",fontSize:12,borderCollapse:"collapse" as "collapse"}}>
          <thead>
            <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
              {["断言名称","类型","期望值","实际值","结果"].map((h,i)=>(
                <th key={i} style={{padding:"4px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:T.t3}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map(r=>(
              <tr key={r.id} style={{borderBottom:`1px solid ${T.border}`}}>
                <td style={{padding:"6px 12px",color:T.t1,fontSize:12}}>{r.name}</td>
                <td style={{padding:"6px 12px",color:T.t3,fontSize:12}}>{r.kindLabel}</td>
                <td style={{padding:"6px 12px",color:T.t2,fontFamily:"monospace",fontSize:12}}>{r.expected}</td>
                <td style={{padding:"6px 12px",color:T.t2,fontFamily:"monospace",fontSize:12}}>{r.actual}</td>
                <td style={{padding:"6px 12px"}}>
                  {r.status==="pass"
                    ?<span style={{color:T.success,display:"flex",alignItems:"center",gap:4,fontSize:12}}><CheckCircle size={11}/>通过</span>
                    :<span style={{color:T.danger,display:"flex",alignItems:"center",gap:4,fontSize:12}}><XCircle size={11}/>失败</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusAssertDetail({a,onChange,hasSent}:{a:Assert2;onChange:(p:Partial<Assert2>)=>void;hasSent:boolean}){
  return(
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-end gap-3">
        <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>比较条件</label>
          <select value={a.statusOp} onChange={e=>onChange({statusOp:e.target.value})} className="h-8 px-2.5 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t2,width:120}}>
            {["等于","不等于","大于","大于等于","小于","小于等于"].map(op=><option key={op}>{op}</option>)}
          </select>
        </div>
        <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>期望状态码</label>
          <input type="number" value={a.statusExpected} onChange={e=>onChange({statusExpected:+e.target.value})} className="h-8 px-3 border rounded-lg text-[13px] font-semibold outline-none" style={{borderColor:T.border,color:T.t1,width:100}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
      </div>
      {hasSent&&<div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{background:"#F0F7FF",border:`1px solid ${T.primary}20`}}>
        <span className="text-[11px] font-semibold" style={{color:T.t3}}>最近响应状态码</span>
        <span className="font-mono font-bold text-[13px]" style={{color:T.primary}}>200</span>
        <span className="text-[11px] px-1.5 py-0.5 rounded" style={{background:"#E8FFEA",color:T.success}}>OK</span>
      </div>}
    </div>
  );
}

function HeaderAssertDetail({a,onChange,hasSent}:{a:Assert2;onChange:(p:Partial<Assert2>)=>void;hasSent:boolean}){
  const rows=a.headerRows;
  const addRow=()=>onChange({headerRows:[...rows,{id:"h"+Date.now(),header:"",op:"等于",expected:"",current:""}]});
  const updRow=(id:string,k:string,v:string)=>onChange({headerRows:rows.map(r=>r.id===id?{...r,[k]:v}:r)});
  const delRow=(id:string)=>onChange({headerRows:rows.filter(r=>r.id!==id)});
  const copyRow=(id:string)=>{const src=rows.find(r=>r.id===id);if(src)onChange({headerRows:[...rows,{...src,id:"h"+Date.now()}]});};
  return(
    <div className="flex flex-col p-4">
      <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
        <table className="w-full text-[12px]">
          <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
            {["Header 名称","比较条件","期望值"].map((h,i)=>(
              <th key={i} className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3}}>{h}</th>
            ))}
            {hasSent&&<th className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3}}>当前值</th>}
            <th className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3,whiteSpace:"nowrap"}}>操作</th>
          </tr></thead>
          <tbody>{rows.map(r=>(
            <tr key={r.id} className="border-b" style={{borderColor:T.border}}>
              <td className="px-3 py-1.5"><input value={r.header} onChange={e=>updRow(r.id,"header",e.target.value)} className="outline-none text-[12px] font-mono w-full" style={{color:T.t1}} placeholder="Content-Type"/></td>
              <td className="px-3 py-1.5"><select value={r.op} onChange={e=>updRow(r.id,"op",e.target.value)} className="outline-none text-[12px] rounded border px-1 py-0.5" style={{borderColor:T.border,color:T.t2}}>{["等于","不等于","包含","不为空","为空"].map(op=><option key={op}>{op}</option>)}</select></td>
              <td className="px-3 py-1.5"><input value={r.expected} onChange={e=>updRow(r.id,"expected",e.target.value)} className="outline-none text-[12px] font-mono w-full" style={{color:T.t1}} placeholder="期望值"/></td>
              {hasSent&&<td className="px-3 py-1.5"><span className="text-[11px] font-mono" style={{color:T.t3}}>{r.current||"—"}</span></td>}
              <td className="px-3 py-1.5" style={{whiteSpace:"nowrap"}}>
                <div className="flex items-center gap-0.5">
                  <button onClick={()=>copyRow(r.id)} title="复制" className="w-6 h-6 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:"pointer",color:T.t3}} onMouseEnter={e=>{e.currentTarget.style.background="#F3F4F6";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}><Copy size={13}/></button>
                  <button onClick={()=>delRow(r.id)} title="删除" className="w-6 h-6 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:"pointer",color:T.t3}} onMouseEnter={e=>{e.currentTarget.style.background="#FEF2F2";e.currentTarget.style.color=T.danger;}} onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.t3;}}><Trash2 size={13}/></button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
        <button onClick={addRow} style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",color:T.t3,fontSize:12}} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}><Plus size={12}/>添加项</button>
      </div>
    </div>
  );
}

function BodyAssertDetail({a,onChange,hasSent}:{a:Assert2;onChange:(p:Partial<Assert2>)=>void;hasSent:boolean}){
  const rows=a.bodyRows;
  const addRow=()=>onChange({bodyRows:[...rows,{id:"b"+Date.now(),expr:"",op:"等于",expected:"",current:""}]});
  const updRow=(id:string,k:string,v:string)=>onChange({bodyRows:rows.map(r=>r.id===id?{...r,[k]:v}:r)});
  const delRow=(id:string)=>onChange({bodyRows:rows.filter(r=>r.id!==id)});
  const copyRow=(id:string)=>{const src=rows.find(r=>r.id===id);if(src)onChange({bodyRows:[...rows,{...src,id:"b"+Date.now()}]});};
  const[qeOpen,setQeOpen]=useState(false);
  const[qeRowId,setQeRowId]=useState("");
  const openQE=(rowId:string)=>{setQeRowId(rowId);setQeOpen(true);};
  const ph=a.bodySubType==="jsonpath"?"$.data.token":a.bodySubType==="xpath"?"/response/data/token":'"success":true';
  return(<>
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold" style={{color:T.t3}}>断言类型</span>
        <div className="flex rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}>
          {(["jsonpath","xpath","regex"] as const).map(m=>(
            <button key={m} onClick={()=>onChange({bodySubType:m})} className="px-3 h-7 text-[12px] font-medium transition-colors" style={{background:a.bodySubType===m?T.primary:"transparent",color:a.bodySubType===m?"#fff":T.t3,border:"none",cursor:"pointer"}}>
              {m==="jsonpath"?"JSONPath":m==="xpath"?"XPath":"Regex"}
            </button>
          ))}
        </div>
        <button disabled={!hasSent} className="h-7 px-2.5 rounded border text-[11px] flex items-center gap-1" style={{borderColor:hasSent?T.primary+"50":T.border,color:hasSent?T.primary:T.t4,cursor:hasSent?"pointer":"not-allowed",background:"none"}}>
          <Zap size={10}/>快速提取
        </button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
        <table className="w-full text-[12px]">
          <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
            {["表达式","比较条件","期望值"].map((h,i)=>(
              <th key={i} className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3}}>{h}</th>
            ))}
            {hasSent&&<th className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3}}>当前值</th>}
            <th className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3,whiteSpace:"nowrap"}}>操作</th>
          </tr></thead>
          <tbody>{rows.map(r=>(
            <tr key={r.id} className="border-b" style={{borderColor:T.border}}>
              <td className="px-3 py-1.5"><input value={r.expr} onChange={e=>updRow(r.id,"expr",e.target.value)} className="outline-none text-[12px] font-mono" style={{color:T.primary,width:150}} placeholder={ph}/></td>
              <td className="px-3 py-1.5"><select value={r.op} onChange={e=>updRow(r.id,"op",e.target.value)} className="outline-none text-[12px] rounded border px-1 py-0.5" style={{borderColor:T.border,color:T.t2}}>{ALL_CONDITIONS.map(op=><option key={op}>{op}</option>)}</select></td>
              <td className="px-3 py-1.5"><input value={r.expected} onChange={e=>updRow(r.id,"expected",e.target.value)} className="outline-none text-[12px] font-mono" style={{color:T.t1,width:100}} placeholder="期望值"/></td>
              {hasSent&&<td className="px-3 py-1.5"><span className="text-[11px] font-mono" style={{color:T.t3}}>{r.current||"—"}</span></td>}
              <td className="px-3 py-1.5" style={{whiteSpace:"nowrap"}}>
                <div className="flex items-center gap-0.5">
                  <button onClick={()=>hasSent&&openQE(r.id)} title={hasSent?"从响应快速提取":"请先发送请求，再使用快速提取"} className="w-6 h-6 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:hasSent?"pointer":"not-allowed",color:hasSent?T.success:T.t4}} onMouseEnter={e=>{if(hasSent)e.currentTarget.style.background="#E6F9EC";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}><Sparkles size={13}/></button>
                  <button onClick={()=>copyRow(r.id)} title="复制" className="w-6 h-6 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:"pointer",color:T.t3}} onMouseEnter={e=>{e.currentTarget.style.background="#F3F4F6";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}><Copy size={13}/></button>
                  <button onClick={()=>delRow(r.id)} title="删除" className="w-6 h-6 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:"pointer",color:T.t3}} onMouseEnter={e=>{e.currentTarget.style.background="#FEF2F2";e.currentTarget.style.color=T.danger;}} onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.t3;}}><Trash2 size={13}/></button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
        <button onClick={addRow} style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",color:T.t3,fontSize:12}} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}><Plus size={12}/>添加项</button>
      </div>
    </div>
    <QuickExtractDrawer open={qeOpen} onClose={()=>setQeOpen(false)}
      initialMethod={a.bodySubType as QEMethod} source="body-assert" hasSent={hasSent}
      onConfirm={(expr,_m,firstMatch)=>{
        updRow(qeRowId,"expr",expr);
        if(firstMatch)updRow(qeRowId,"expected",firstMatch);
      }}/>
    </>
  );
}

function TimeAssertDetail({a,onChange,hasSent}:{a:Assert2;onChange:(p:Partial<Assert2>)=>void;hasSent:boolean}){
  return(
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-end gap-3">
        <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>比较条件</label>
          <select value={a.timeOp} onChange={e=>onChange({timeOp:e.target.value})} className="h-8 px-2.5 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t2,width:130}}>
            {["小于","小于等于","大于","大于等于","等于"].map(op=><option key={op}>{op}</option>)}
          </select>
        </div>
        <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>阈值 (ms)</label>
          <input type="number" value={a.timeMs} onChange={e=>onChange({timeMs:+e.target.value})} className="h-8 px-3 border rounded-lg text-[13px] font-semibold outline-none" style={{borderColor:T.border,color:T.t1,width:120}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <span className="text-[12px] pb-1.5" style={{color:T.t3}}>ms</span>
      </div>
      {hasSent&&<div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{background:"#F0F7FF",border:`1px solid ${T.primary}20`}}>
        <span className="text-[11px] font-semibold" style={{color:T.t3}}>最近响应耗时</span>
        <span className="font-mono font-bold text-[13px]" style={{color:T.primary}}>123</span>
        <span className="text-[11px]" style={{color:T.t3}}>ms</span>
      </div>}
    </div>
  );
}

function VarAssertDetail({a,onChange,hasSent}:{a:Assert2;onChange:(p:Partial<Assert2>)=>void;hasSent:boolean}){
  const rows=a.varRows;
  const addRow=()=>onChange({varRows:[...rows,{id:"v"+Date.now(),varName:"",op:"不为空",expected:"",current:""}]});
  const updRow=(id:string,k:string,v:string)=>onChange({varRows:rows.map(r=>r.id===id?{...r,[k]:v}:r)});
  const delRow=(id:string)=>onChange({varRows:rows.filter(r=>r.id!==id)});
  const copyRow=(id:string)=>{const src=rows.find(r=>r.id===id);if(src)onChange({varRows:[...rows,{...src,id:"v"+Date.now()}]});};
  return(
    <div className="flex flex-col p-4">
      <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
        <table className="w-full text-[12px]">
          <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
            {["变量名","比较条件","期望值"].map((h,i)=>(
              <th key={i} className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3}}>{h}</th>
            ))}
            {hasSent&&<th className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3}}>当前值</th>}
            <th className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3,whiteSpace:"nowrap"}}>操作</th>
          </tr></thead>
          <tbody>{rows.map(r=>(
            <tr key={r.id} className="border-b" style={{borderColor:T.border}}>
              <td className="px-3 py-1.5"><input value={r.varName} onChange={e=>updRow(r.id,"varName",e.target.value)} className="outline-none text-[12px] font-mono" style={{color:T.primary,width:130}} placeholder="变量名"/></td>
              <td className="px-3 py-1.5"><select value={r.op} onChange={e=>updRow(r.id,"op",e.target.value)} className="outline-none text-[12px] rounded border px-1 py-0.5" style={{borderColor:T.border,color:T.t2}}>{ALL_CONDITIONS.map(op=><option key={op}>{op}</option>)}</select></td>
              <td className="px-3 py-1.5"><input value={r.expected} onChange={e=>updRow(r.id,"expected",e.target.value)} className="outline-none text-[12px] font-mono" style={{color:T.t1,width:100}} placeholder="期望值"/></td>
              {hasSent&&<td className="px-3 py-1.5"><span className="text-[11px] font-mono" style={{color:T.t3}}>{r.current||"—"}</span></td>}
              <td className="px-3 py-1.5" style={{whiteSpace:"nowrap"}}>
                <div className="flex items-center gap-0.5">
                  <button onClick={()=>copyRow(r.id)} title="复制" className="w-6 h-6 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:"pointer",color:T.t3}} onMouseEnter={e=>{e.currentTarget.style.background="#F3F4F6";}} onMouseLeave={e=>{e.currentTarget.style.background="none";}}><Copy size={13}/></button>
                  <button onClick={()=>delRow(r.id)} title="删除" className="w-6 h-6 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:"pointer",color:T.t3}} onMouseEnter={e=>{e.currentTarget.style.background="#FEF2F2";e.currentTarget.style.color=T.danger;}} onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.t3;}}><Trash2 size={13}/></button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
        <button onClick={addRow} style={{width:"100%",display:"flex",alignItems:"center",gap:4,padding:"8px 12px",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",color:T.t3,fontSize:12}} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}><Plus size={12}/>添加项</button>
      </div>
    </div>
  );
}

function ScriptAssertDetail({a,onChange}:{a:Assert2;onChange:(p:Partial<Assert2>)=>void}){
  return(
    <div className="flex flex-col gap-3 p-4">
      <SmCodeEditor value={a.script} onChange={v=>onChange({script:v})} rows={10}/>
      <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>说明</label>
        <input value={a.desc} onChange={e=>onChange({desc:e.target.value})} placeholder="选填" className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
    </div>
  );
}

function AssertTab({hasSent}:{hasSent:boolean}){
  const[asserts,setAsserts]=useState<Assert2[]>([
    {...mkAssert("status",0),name:"状态码 200"},
    {...mkAssert("resp-body",1),name:"响应体断言"},
  ]);
  const[selId,setSelId]=useState<string|null>(asserts[0]?.id||null);
  const[showAdd,setShowAdd]=useState(false);
  const addDropRef=React.useRef<HTMLDivElement>(null);
  const selA=asserts.find(a=>a.id===selId)||null;
  const upd=(id:string,p:Partial<Assert2>)=>setAsserts(as=>as.map(a=>a.id===id?{...a,...p}:a));
  const addA=(kind:AssertKind)=>{const na=mkAssert(kind,asserts.length);setAsserts(as=>[...as,na]);setSelId(na.id);setShowAdd(false);};
  const delA=(id:string)=>{const remaining=asserts.filter(a=>a.id!==id);setAsserts(remaining);if(selId===id)setSelId(remaining[0]?.id||null);};
  const moveUp=(id:string)=>{const i=asserts.findIndex(a=>a.id===id);if(i>0){const ar=[...asserts];[ar[i-1],ar[i]]=[ar[i],ar[i-1]];setAsserts(ar);}};
  const moveDown=(id:string)=>{const i=asserts.findIndex(a=>a.id===id);if(i<asserts.length-1){const ar=[...asserts];[ar[i],ar[i+1]]=[ar[i+1],ar[i]];setAsserts(ar);}};
  const copyA=(id:string)=>{const src=asserts.find(a=>a.id===id);if(src){const na={...src,id:"as"+Date.now(),name:src.name+" 副本"};setAsserts(as=>[...as,na]);setSelId(na.id);}};
  const kinds:AssertKind[]=["status","resp-header","resp-body","resp-time","variable","script"];
  const mockResults:AssertResult[]=asserts.filter(a=>a.enabled).map((a,i)=>({
    id:a.id,name:a.name,kindLabel:ASSERT_KIND_CFG[a.kind].label,
    subject:a.kind==="status"?"HTTP 状态码":a.kind==="resp-time"?"响应时间":a.kind==="resp-body"?"响应体":a.kind==="resp-header"?"响应头":"变量",
    condition:a.kind==="status"?a.statusOp:a.kind==="resp-time"?a.timeOp:"等于",
    expected:a.kind==="status"?String(a.statusExpected):a.kind==="resp-time"?`${a.timeMs}ms`:"—",
    actual:a.kind==="status"?"200":a.kind==="resp-time"?"123ms":"—",
    status:(i%3===0?"pass":i%3===1?"fail":"skip") as AssertResultStatus,
    failReason:i%3===1?"实际值与期望值不匹配，请检查断言配置":undefined,
  }));

  useEffect(()=>{
    if(!showAdd) return;
    const h=(e:MouseEvent)=>{if(addDropRef.current&&!addDropRef.current.contains(e.target as Node))setShowAdd(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[showAdd]);

  return(
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel */}
      <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:264,borderRight:`1px solid ${T.border}`,background:"#fff"}}>
        <div style={{padding:"8px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div style={{position:"relative"}} ref={addDropRef}>
            <button onClick={()=>setShowAdd(v=>!v)}
              style={{height:26,padding:"0 10px",borderRadius:6,border:`1px solid ${T.border}`,background:"#fff",color:T.t1,fontSize:12,cursor:"pointer",fontWeight:500,display:"inline-flex",alignItems:"center",gap:4}}>
              <Plus size={11}/>添加断言<ChevronDown size={9}/>
            </button>
            {showAdd&&(
              <div style={{position:"absolute",top:"calc(100% + 4px)",right:0,background:"#fff",border:`1px solid ${T.border}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.10)",padding:"4px 0",zIndex:20,width:136}}>
                {kinds.map(k=>{const cfg=ASSERT_KIND_CFG[k];const Icon=cfg.icon;return(
                  <button key={k} onClick={()=>addA(k)}
                    style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 12px",fontSize:12,color:T.t1,border:"none",background:"transparent",cursor:"pointer",textAlign:"left"}}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="#F5F6F8"}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}>
                    <Icon size={13} style={{color:T.t3,flexShrink:0}}/>{cfg.label}断言
                  </button>
                );})}
              </div>
            )}
          </div>
          <button disabled={!hasSent}
            style={{height:26,padding:"0 8px",borderRadius:6,border:`1px solid ${hasSent?`${T.primary}50`:T.border}`,background:"#fff",color:hasSent?T.primary:T.t4,fontSize:11,cursor:hasSent?"pointer":"not-allowed",display:"inline-flex",alignItems:"center",gap:4}}>
            <Zap size={10}/>快速生成
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1.5">
          {asserts.length===0?(
            <div className="flex flex-col items-center justify-center h-full py-12" style={{color:T.t4}}>
              <Shield size={24} style={{opacity:0.3}}/>
              <p style={{fontSize:12,margin:"8px 0 0"}}>暂无断言</p>
              <p style={{fontSize:11,margin:"2px 0 0",color:T.t4}}>点击「添加」开始配置</p>
            </div>
          ):(
            asserts.map((a,i)=>(
              <AssertListItem key={a.id} a={a} selected={selId===a.id}
                onSelect={()=>setSelId(a.id)} onToggle={v=>upd(a.id,{enabled:v})}
                onMoveUp={()=>moveUp(a.id)} onMoveDown={()=>moveDown(a.id)}
                isFirst={i===0} isLast={i===asserts.length-1}/>
            ))
          )}
        </div>
      </div>
      {/* Right panel */}
      <div className="flex flex-col flex-1 overflow-hidden bg-white">
        {!selA?(
          <div className="flex flex-col items-center justify-center flex-1" style={{color:T.t4}}>
            <Shield size={32} className="mb-2.5"/>
            <p className="text-[13px]">请选择一个断言进行编辑</p>
          </div>
        ):(
          <>
            <AssertDetailHeader name={selA.name} enabled={selA.enabled}
              onChange={p=>upd(selA.id,p as Partial<Assert2>)}
              onCopy={()=>copyA(selA.id)} onDel={()=>delA(selA.id)}/>
            <div className="flex-1 overflow-y-auto">
              {selA.kind==="status"?<StatusAssertDetail a={selA} onChange={p=>upd(selA.id,p)} hasSent={hasSent}/>
              :selA.kind==="resp-header"?<HeaderAssertDetail a={selA} onChange={p=>upd(selA.id,p)} hasSent={hasSent}/>
              :selA.kind==="resp-body"?<BodyAssertDetail a={selA} onChange={p=>upd(selA.id,p)} hasSent={hasSent}/>
              :selA.kind==="resp-time"?<TimeAssertDetail a={selA} onChange={p=>upd(selA.id,p)} hasSent={hasSent}/>
              :selA.kind==="variable"?<VarAssertDetail a={selA} onChange={p=>upd(selA.id,p)} hasSent={hasSent}/>
              :<ScriptAssertDetail a={selA} onChange={p=>upd(selA.id,p)}/>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


function ApiLeftPanel({selectedId,onSelect,onImport}:{selectedId?:string;onSelect:(id:string,item?:ApiEndpoint)=>void;onImport?:()=>void}){
  const[folders,setFolders]=useState<ApiFolder[]>(API_FOLDERS);
  const toggleFolder=(id:string)=>setFolders(fs=>fs.map(f=>f.id===id?{...f,expanded:!f.expanded}:f));
  return(
    <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:250,backgroundColor:"#fff",borderRight:`1px solid ${T.border}`}}>
      <div className="px-3 pt-3 pb-2 flex-shrink-0 flex gap-2">
        <PBtn icon={Plus} onClick={()=>{}} small>新建请求</PBtn>
        <PBtn icon={Upload} onClick={()=>onImport?.()} variant="ghost"><span className="text-[12px]">导入</span></PBtn>
      </div>
      <div className="px-3 pb-2 flex-shrink-0"><Inp placeholder="搜索请求" prefix={<Search size={12}/>} width="100%"/></div>
      <div className="px-2 py-1 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}><p className="px-2 py-1 text-[12px] font-medium" style={{color:T.t3}}>请求目录</p></div>
      <div className="flex-1 overflow-y-auto py-1">
        <div className="px-3 py-1.5 flex items-center gap-1.5 text-[13px] font-semibold" style={{color:T.t1}}><FolderOpen size={13} style={{color:T.warning}}/><span>X-MAN</span><span className="ml-auto text-[11px]" style={{color:T.t3}}>1165</span></div>
        {folders.map(f=>(
          <div key={f.id}>
            <button onClick={()=>toggleFolder(f.id)} className="w-full flex items-center gap-1.5 px-4 py-1.5 text-[13px] text-left transition-colors" style={{color:T.t1}} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#F4F6FA"} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}>
              {f.expanded?<ChevronDown size={11} style={{color:T.t3}}/>:<ChevronRight size={11} style={{color:T.t3}}/>}
              <Folder size={12} style={{color:T.warning,flexShrink:0}}/>
              <span className="flex-1 truncate">{f.name}</span><span className="text-[11px]" style={{color:T.t4}}>{f.count}</span>
            </button>
            {f.expanded&&f.items.map(item=>(
              <button key={item.id} onClick={()=>onSelect(item.id,item)} className="w-full flex items-center gap-2 py-1.5 pl-8 pr-3 text-[12px] text-left transition-colors" style={{backgroundColor:selectedId===item.id?"#FFF3E8":""}} onMouseEnter={e=>selectedId!==item.id&&(e.currentTarget.style.backgroundColor="#F4F6FA")} onMouseLeave={e=>selectedId!==item.id&&(e.currentTarget.style.backgroundColor="")}>
                <MethodBadge method={item.method}/><span className="truncate flex-1" style={{color:T.t2}}>{item.name}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export type { AssertResultStatus, AssertResult };
export { PreScriptTab, PostScriptTab, AssertTab, RespBodyTab, RespHeadersTab, RespCookiesTab, RespAssertTab, ApiLeftPanel };
