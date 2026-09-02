/**
 * ApiSceneExtras.tsx
 * 接口场景模块的辅助弹窗、抽屉和结果详情组件。
 * 每个组件均有内置 DemoBar 用于切换设计状态。
 */

import React, { useState } from "react";
import {
  X, Plus, Search, ChevronDown, ChevronRight, Check, AlertTriangle,
  AlertCircle, Info, CheckCircle, XCircle, Loader2, Play, RefreshCw,
  Upload, Link2, FileText, Layers, Terminal, Clock, Filter, Repeat,
  Database, Code2, Save, Settings, Eye, EyeOff, Copy, Trash2,
  Globe, FolderOpen, Lock, Shield, ArrowRight, Download, Zap,
  AlignLeft, RotateCcw, Square, SkipForward, GripVertical,
  MoreHorizontal, ExternalLink, Hash, Activity, List, GitBranch,
  Cpu, Bug, BookOpen, Columns, Sparkles,
} from "lucide-react";
import { SceneManagement } from "./ApiSceneModule";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  cyan:"#0891B2",
  bg:"#F4F6FA",      border:"#E5E6EB",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};

// ─── Step type registry ───────────────────────────────────────────────────────
const STEP_CFG: Record<string,{label:string;color:string;bg:string;icon:React.ElementType;desc:string;category:string}> = {
  "ref-api":   {label:"引用接口",  color:T.purple, bg:"#F5E8FF", icon:Link2,    desc:"引用已有接口定义发起 HTTP 请求",  category:"HTTP"},
  "ref-case":  {label:"引用用例",  color:T.cyan,   bg:"#E0F7FA", icon:FileText, desc:"引用接口用例，复用参数和断言配置",  category:"HTTP"},
  "ref-scene": {label:"引用场景",  color:T.success,bg:"#E8FFEA", icon:Layers,   desc:"嵌套调用并执行另一个场景",         category:"控制"},
  "script":    {label:"JS 脚本",   color:"#F59E0B",bg:"#FFFBEB", icon:Terminal, desc:"执行 JavaScript 脚本，支持内置函数", category:"脚本"},
  "wait":      {label:"等待",      color:T.t3,     bg:"#F2F3F5", icon:Clock,    desc:"固定时间等待或轮询等待条件成立",    category:"控制"},
  "condition": {label:"条件判断",  color:"#E91E8C",bg:"#FFE8F5", icon:GitBranch,desc:"按条件控制后续步骤执行路径",        category:"控制"},
  "loop":      {label:"循环",      color:"#4E5AC8",bg:"#EEEEFF", icon:Repeat,   desc:"对数据集合或次数进行循环执行",      category:"控制"},
  "database":  {label:"数据库",    color:T.cyan,   bg:"#E0F7FA", icon:Database, desc:"执行 SQL 查询或增删改操作",         category:"数据"},
  "var-set":   {label:"变量赋值",  color:T.warning,bg:"#FFF3E8", icon:Hash,     desc:"创建或更新场景变量值",              category:"数据"},
  "log":       {label:"日志输出",  color:T.t2,     bg:"#F2F3F5", icon:AlignLeft,desc:"向控制台输出调试日志",              category:"脚本"},
  "assert":    {label:"断言",      color:T.danger, bg:"#FFE8E8", icon:Check,    desc:"验证条件，失败时可中断场景",        category:"验证"},
};

type ExecStatus = "pending"|"running"|"success"|"fail"|"skip"|"cancelled";
const EXEC_CFG: Record<ExecStatus,{label:string;color:string;bg:string;icon:React.ElementType}> = {
  pending:   {label:"等待执行",color:T.t3,    bg:"#F2F3F5",icon:Clock},
  running:   {label:"执行中", color:T.primary,bg:"#E8F3FF",icon:Loader2},
  success:   {label:"成功",   color:T.success,bg:"#E8FFEA",icon:CheckCircle},
  fail:      {label:"失败",   color:T.danger, bg:"#FFE8E8",icon:XCircle},
  skip:      {label:"跳过",   color:T.warning,bg:"#FFF3E8",icon:SkipForward},
  cancelled: {label:"已取消", color:T.t4,     bg:"#F2F3F5",icon:Square},
};

// ─── Primitive components ─────────────────────────────────────────────────────

function DemoBar<S extends string>({states,current,onChange,label="设计状态"}:{
  states:{value:S;label:string}[];current:S;onChange:(v:S)=>void;label?:string;
}){
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,height:44,background:"#fff",borderTop:`2px solid ${T.primary}`,display:"flex",alignItems:"center",gap:6,padding:"0 16px",zIndex:9999,boxShadow:"0 -2px 12px rgba(0,0,0,0.1)"}}>
      <span style={{fontSize:11,fontWeight:700,color:T.primary,letterSpacing:0.5,flexShrink:0}}>{label}</span>
      <span style={{width:1,height:20,background:T.border,flexShrink:0}}/>
      <div style={{display:"flex",gap:4,overflowX:"auto"}}>
        {states.map(s=>(
          <button key={s.value} onClick={()=>onChange(s.value)}
            style={{padding:"3px 10px",borderRadius:5,border:`1px solid ${current===s.value?T.primary:T.border}`,fontSize:11,fontWeight:current===s.value?700:400,background:current===s.value?T.primary:"transparent",color:current===s.value?"#fff":T.t3,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SmToggle({on,onChange,disabled}:{on:boolean;onChange:(v:boolean)=>void;disabled?:boolean}){
  return(
    <div onClick={()=>!disabled&&onChange(!on)}
      style={{width:28,height:16,borderRadius:8,background:on?T.primary:T.t4,position:"relative",cursor:disabled?"not-allowed":"pointer",flexShrink:0,opacity:disabled?0.5:1}}>
      <div style={{position:"absolute",top:2,left:on?14:2,width:12,height:12,borderRadius:"50%",background:"#fff",transition:"left .15s"}}/>
    </div>
  );
}

function AlertBanner({type,children}:{type:"info"|"warn"|"error"|"success";children:React.ReactNode}){
  const cfg={
    info:   {bg:"#E8F3FF",border:`${T.primary}40`,color:T.primary,icon:Info},
    warn:   {bg:"#FFF3E8",border:`${T.warning}40`,color:T.warning,icon:AlertTriangle},
    error:  {bg:"#FFE8E8",border:`${T.danger}40`, color:T.danger, icon:AlertCircle},
    success:{bg:"#E8FFEA",border:`${T.success}40`,color:T.success,icon:CheckCircle},
  }[type];
  const Icon=cfg.icon;
  return(
    <div style={{display:"flex",gap:8,padding:"10px 12px",border:`1px solid ${cfg.border}`,borderRadius:8,background:cfg.bg,marginBottom:12,fontSize:12,color:T.t2,lineHeight:1.65}}>
      <Icon size={14} style={{color:cfg.color,flexShrink:0,marginTop:1}}/>
      <div style={{flex:1}}>{children}</div>
    </div>
  );
}

function SectionCard({title,children,action}:{title:string;children:React.ReactNode;action?:React.ReactNode}){
  return(
    <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:"#FAFBFE",borderBottom:`1px solid ${T.border}`}}>
        <span style={{fontSize:12,fontWeight:600,color:T.t2}}>{title}</span>
        {action}
      </div>
      <div style={{padding:14}}>
        {children}
      </div>
    </div>
  );
}

function FL({children,required}:{children:React.ReactNode;required?:boolean}){
  return(
    <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:5}}>
      {children}{required&&<span style={{color:T.danger,marginLeft:2}}>*</span>}
    </div>
  );
}

function FInput({value,onChange,placeholder,mono,disabled,type,width}:{value?:string;onChange?:(v:string)=>void;placeholder?:string;mono?:boolean;disabled?:boolean;type?:string;width?:number|string}){
  return(
    <input type={type||"text"} value={value} onChange={e=>onChange?.(e.target.value)} placeholder={placeholder} disabled={disabled}
      style={{width:width||"100%",boxSizing:"border-box",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,fontFamily:mono?"'JetBrains Mono',monospace":"inherit",color:T.t1,outline:"none",background:disabled?"#F7F8FA":"#fff"}}/>
  );
}

function StepTypeBadge({type}:{type:string}){
  const cfg=STEP_CFG[type]||{label:type,color:T.t3,bg:T.bg,icon:Settings};
  const Icon=cfg.icon;
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:5,background:cfg.bg,fontSize:11,fontWeight:700,color:cfg.color}}>
      <Icon size={10}/>{cfg.label}
    </span>
  );
}

function ExecStatusBadge({status}:{status:ExecStatus}){
  const cfg=EXEC_CFG[status];
  const Icon=cfg.icon;
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:5,background:cfg.bg,fontSize:11,fontWeight:700,color:cfg.color}}>
      {status==="running"
        ?<Loader2 size={10} style={{animation:"spin 1s linear infinite"}}/>
        :<Icon size={10}/>}
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ImportStepDialog — 从接口/用例/场景导入步骤
// ─────────────────────────────────────────────────────────────────────────────

type ImportState = "default"|"loading"|"partial-selected"|"all-selected"|"load-failed"|"no-permission"|"importing"|"success"|"partial-fail"|"duplicate-warn"|"search-empty"|"no-content";

const IMPORT_DEMO: {value:ImportState;label:string}[] = [
  {value:"default",       label:"默认"},
  {value:"loading",       label:"目录加载中"},
  {value:"partial-selected",label:"部分已选"},
  {value:"all-selected",  label:"全选"},
  {value:"load-failed",   label:"加载失败"},
  {value:"no-permission", label:"部分无权限"},
  {value:"importing",     label:"导入中"},
  {value:"success",       label:"导入成功"},
  {value:"partial-fail",  label:"部分失败"},
  {value:"duplicate-warn",label:"重复步骤"},
  {value:"search-empty",  label:"搜索无结果"},
  {value:"no-content",    label:"无可导入内容"},
];

const MOCK_DIR = [
  {id:"d1",label:"获客中心",children:[
    {id:"d1a",label:"用户管理",children:[]},
    {id:"d1b",label:"订单接口",children:[]},
  ]},
  {id:"d2",label:"支付模块",children:[
    {id:"d2a",label:"收单接口",children:[]},
  ]},
];

const MOCK_CASES = [
  {id:"c1",name:"登录 - 正常账号",method:"POST",path:"/auth/login",module:"用户管理",hasConflict:false,noPermission:false},
  {id:"c2",name:"查询订单列表",  method:"GET", path:"/orders",     module:"订单接口",hasConflict:true, noPermission:false},
  {id:"c3",name:"创建订单",      method:"POST",path:"/orders",     module:"订单接口",hasConflict:false,noPermission:false},
  {id:"c4",name:"支付接口 - 微信",method:"POST",path:"/pay/wechat",module:"收单接口",hasConflict:false,noPermission:true},
  {id:"c5",name:"退款申请",      method:"POST",path:"/pay/refund", module:"收单接口",hasConflict:false,noPermission:false},
];

export function ImportStepDialog({onClose}:{onClose:()=>void}){
  const [demoState,setDemoState]=useState<ImportState>("default");
  const [tab,setTab]=useState<"case"|"api"|"scene">("case");
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [expandedDirs,setExpandedDirs]=useState<Set<string>>(new Set(["d1"]));
  const [insertPos,setInsertPos]=useState("末尾");
  const [importMode,setImportMode]=useState<"ref"|"copy">("ref");

  const isLoading=demoState==="loading";
  const isFailed=demoState==="load-failed";
  const isNoPermission=demoState==="no-permission";
  const isImporting=demoState==="importing";
  const isSuccess=demoState==="success";
  const isPartialFail=demoState==="partial-fail";
  const isDuplicate=demoState==="duplicate-warn";
  const isSearchEmpty=demoState==="search-empty";
  const isNoContent=demoState==="no-content";

  const displaySelected = demoState==="partial-selected" ? new Set(["c1","c3"]) :
    demoState==="all-selected" ? new Set(["c1","c2","c3","c5"]) : selected;

  const visibleCases = isSearchEmpty||isNoContent ? [] :
    isNoPermission ? MOCK_CASES :
    MOCK_CASES.filter(c=>!c.noPermission);

  const toggleDir=(id:string)=>{
    const s=new Set(expandedDirs);
    s.has(id)?s.delete(id):s.add(id);
    setExpandedDirs(s);
  };

  const toggleCase=(id:string)=>{
    const s=new Set(displaySelected);
    s.has(id)?s.delete(id):s.add(id);
    setSelected(s);
  };

  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:600}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:601,background:"#fff",borderRadius:12,width:860,maxHeight:"82vh",display:"flex",flexDirection:"column",boxShadow:"0 12px 48px rgba(0,0,0,0.16)"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <Upload size={15} style={{color:T.primary}}/>
          <span style={{fontSize:15,fontWeight:700,color:T.t1,flex:1}}>导入步骤</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:4,borderRadius:5}}><X size={16}/></button>
        </div>

        {/* Source tabs */}
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,padding:"0 20px",flexShrink:0,background:"#FAFBFE"}}>
          {(["case","api","scene"] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{height:38,padding:"0 16px",border:"none",borderBottom:`2px solid ${tab===t?T.primary:"transparent"}`,background:"transparent",fontSize:12,fontWeight:500,color:tab===t?T.primary:T.t3,cursor:"pointer"}}>
              {t==="case"?"引用接口用例":t==="api"?"引用接口":"引用其他场景"}
            </button>
          ))}
          <div style={{flex:1}}/>
          {/* Search */}
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 0"}}>
            <div style={{position:"relative"}}>
              <Search size={13} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:T.t4}}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索接口名 / 路径"
                style={{height:28,paddingLeft:28,paddingRight:10,border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none",width:180}}/>
            </div>
          </div>
        </div>

        {/* Body — split layout */}
        <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>

          {/* Left directory tree */}
          <div style={{width:200,borderRight:`1px solid ${T.border}`,overflowY:"auto",flexShrink:0,padding:"10px 8px"}}>
            <div style={{fontSize:11,fontWeight:600,color:T.t4,padding:"2px 8px",marginBottom:4}}>目录</div>
            {isLoading?(
              <div style={{display:"flex",flexDirection:"column",gap:8,padding:"8px 8px"}}>
                {[60,80,50,70,45].map((w,i)=>(
                  <div key={i} style={{height:10,borderRadius:4,background:T.border,width:`${w}%`}}/>
                ))}
              </div>
            ):isFailed?(
              <div style={{padding:"24px 8px",textAlign:"center",color:T.danger,fontSize:12}}>
                <XCircle size={20} style={{margin:"0 auto 6px",display:"block"}}/> 目录加载失败
              </div>
            ):(
              MOCK_DIR.map(dir=>(
                <div key={dir.id}>
                  <button onClick={()=>toggleDir(dir.id)} style={{display:"flex",alignItems:"center",gap:5,width:"100%",padding:"5px 8px",border:"none",background:"transparent",cursor:"pointer",borderRadius:5,fontSize:12,color:T.t2,textAlign:"left"}}>
                    {expandedDirs.has(dir.id)?<ChevronDown size={12}/>:<ChevronRight size={12}/>}
                    <FolderOpen size={12} style={{color:T.warning,flexShrink:0}}/>
                    {dir.label}
                  </button>
                  {expandedDirs.has(dir.id)&&dir.children.map(child=>(
                    <button key={child.id} style={{display:"flex",alignItems:"center",gap:5,width:"100%",padding:"4px 8px 4px 28px",border:"none",background:"transparent",cursor:"pointer",borderRadius:5,fontSize:12,color:T.t3,textAlign:"left"}}>
                      <FolderOpen size={11} style={{color:T.t4,flexShrink:0}}/>{child.label}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Right list */}
          <div style={{flex:1,overflowY:"auto",padding:"10px 16px"}}>

            {isDuplicate&&<AlertBanner type="warn"><strong>检测到重复步骤</strong> — 已选的 2 个步骤在当前场景中存在同名引用。可选择跳过重复或全部导入（将添加数字后缀）。</AlertBanner>}
            {isPartialFail&&<AlertBanner type="error"><strong>部分步骤导入失败</strong> — 3 个步骤成功导入，1 个步骤因权限不足被跳过。<span style={{marginLeft:6,fontSize:11,color:T.t3}}>已跳过：支付接口 - 微信</span></AlertBanner>}
            {isSuccess&&<AlertBanner type="success"><strong>导入成功</strong> — 已将 3 个步骤插入到场景末尾，步骤将以"引用"模式运行。</AlertBanner>}
            {isNoPermission&&<AlertBanner type="warn">当前目录中有 <strong>1 个接口</strong>无查看权限，已用灰色标注，无法选择。</AlertBanner>}

            {isNoContent&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 0",color:T.t4}}>
                <Layers size={32} style={{opacity:0.3,marginBottom:10}}/>
                <div style={{fontSize:13,color:T.t2,marginBottom:4}}>该目录下暂无可导入的用例</div>
                <div style={{fontSize:12,color:T.t4}}>请切换到其他目录或创建接口用例后再导入</div>
              </div>
            )}

            {isSearchEmpty&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 0",color:T.t4}}>
                <Search size={32} style={{opacity:0.3,marginBottom:10}}/>
                <div style={{fontSize:13,color:T.t2,marginBottom:4}}>未找到匹配的接口用例</div>
                <div style={{fontSize:12,color:T.t4}}>请尝试其他关键词</div>
              </div>
            )}

            {!isNoContent&&!isSearchEmpty&&(
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                    <th style={{padding:"7px 10px",width:32}}>
                      <input type="checkbox" style={{accentColor:T.primary}}
                        checked={displaySelected.size===visibleCases.filter(c=>!c.noPermission).length && visibleCases.filter(c=>!c.noPermission).length>0}
                        onChange={()=>{}}/>
                    </th>
                    {["名称","Method / 路径","所属目录",""].map((h,i)=>(
                      <th key={i} style={{padding:"7px 10px",textAlign:"left",fontSize:11,fontWeight:600,color:T.t3}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleCases.map((c,i)=>{
                    const locked=c.noPermission;
                    const conflicted=c.hasConflict&&isDuplicate;
                    const checked=displaySelected.has(c.id);
                    const mc=c.method as "GET"|"POST"|"PUT"|"DELETE"|"PATCH";
                    const mcol={GET:"#00B42A",POST:"#165DFF",PUT:"#FF7D00",DELETE:"#F53F3F",PATCH:"#7816FF"}[mc];
                    const mbg={GET:"#E8FFEA",POST:"#E8F3FF",PUT:"#FFF3E8",DELETE:"#FFEEEE",PATCH:"#F5E8FF"}[mc];
                    return(
                      <tr key={c.id} style={{borderBottom:i<visibleCases.length-1?`1px solid ${T.border}`:"none",background:checked?"#F0F5FF":conflicted?"#FFFBE8":locked?"#FAFAFA":"#fff",opacity:locked?0.6:1}}>
                        <td style={{padding:"8px 10px"}}>
                          {locked
                            ?<Lock size={11} style={{color:T.t4}}/>
                            :<input type="checkbox" checked={checked} onChange={()=>toggleCase(c.id)} style={{accentColor:T.primary}}/>}
                        </td>
                        <td style={{padding:"8px 10px",color:T.t1,fontWeight:500}}>
                          {c.name}
                          {conflicted&&<span style={{marginLeft:6,fontSize:10,color:T.warning,background:"#FFF3E8",padding:"1px 5px",borderRadius:3,fontWeight:700}}>重复</span>}
                        </td>
                        <td style={{padding:"8px 10px"}}>
                          <span style={{fontSize:10,padding:"1px 6px",borderRadius:4,fontWeight:700,color:mcol,background:mbg,marginRight:6}}>{c.method}</span>
                          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.t2}}>{c.path}</span>
                        </td>
                        <td style={{padding:"8px 10px",color:T.t4}}>{c.module}</td>
                        <td style={{padding:"8px 10px",width:28}}>
                          {locked&&<span style={{fontSize:10,color:T.t4,background:T.bg,padding:"1px 5px",borderRadius:3}}>无权限</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Config bar */}
        {!isSuccess&&(
          <div style={{padding:"10px 20px",borderTop:`1px solid ${T.border}`,background:"#FAFBFE",flexShrink:0,display:"flex",alignItems:"center",gap:16,fontSize:12}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{color:T.t3}}>导入方式</span>
              {(["ref","copy"] as const).map(m=>(
                <button key={m} onClick={()=>setImportMode(m)}
                  style={{padding:"3px 10px",borderRadius:5,border:`1px solid ${importMode===m?T.primary:T.border}`,fontSize:11,fontWeight:importMode===m?700:400,background:importMode===m?`${T.primary}0D`:"transparent",color:importMode===m?T.primary:T.t3,cursor:"pointer"}}>
                  {m==="ref"?"引用步骤":"复制步骤"}
                </button>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{color:T.t3}}>插入到</span>
              <select value={insertPos} onChange={e=>setInsertPos(e.target.value)}
                style={{height:28,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}>
                <option>末尾</option><option>当前步骤后</option><option>场景开头</option>
              </select>
            </div>
            {isDuplicate&&(
              <div style={{display:"flex",gap:6}}>
                <button style={{fontSize:11,padding:"3px 10px",border:`1px solid ${T.border}`,borderRadius:5,background:"#fff",color:T.t2,cursor:"pointer"}}>跳过重复</button>
                <button style={{fontSize:11,padding:"3px 10px",border:`1px solid ${T.warning}`,borderRadius:5,background:"#FFF3E8",color:T.warning,cursor:"pointer"}}>全部导入（自动重命名）</button>
              </div>
            )}
            <div style={{flex:1}}/>
            <span style={{color:T.t3}}>已选 <strong style={{color:displaySelected.size>0?T.primary:T.t4}}>{displaySelected.size}</strong> 个步骤</span>
          </div>
        )}

        {/* Footer */}
        <div style={{padding:"12px 20px",borderTop:`1px solid ${T.border}`,flexShrink:0,display:"flex",justifyContent:"flex-end",gap:8}}>
          <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>取消</button>
          {!isSuccess&&(
            <button onClick={()=>setDemoState("importing")}
              disabled={displaySelected.size===0||isImporting}
              style={{padding:"7px 22px",border:"none",borderRadius:7,background:displaySelected.size===0?T.t4:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:displaySelected.size===0?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6,opacity:isImporting?0.8:1}}>
              {isImporting&&<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>}
              {isImporting?"正在导入…":`导入 ${displaySelected.size} 个步骤`}
            </button>
          )}
          {isSuccess&&<button onClick={onClose} style={{padding:"7px 22px",border:"none",borderRadius:7,background:T.success,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><CheckCircle size={13}/>完成</button>}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <DemoBar states={IMPORT_DEMO} current={demoState} onChange={setDemoState}/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. AddStepMenuPanel — 添加步骤选择面板
// ─────────────────────────────────────────────────────────────────────────────

type AddStepMenuState = "default"|"search"|"recent"|"no-results"|"disabled";
const ADD_STEP_DEMO: {value:AddStepMenuState;label:string}[] = [
  {value:"default",   label:"默认"},
  {value:"search",    label:"搜索中"},
  {value:"recent",    label:"显示最近"},
  {value:"no-results",label:"无结果"},
  {value:"disabled",  label:"含禁用项"},
];

const STEP_CATEGORIES = ["HTTP","控制","脚本","数据","验证"] as const;
const RECENT_STEPS = ["ref-api","script","condition"];
const DISABLED_STEPS = ["database","var-set"];

export function AddStepMenuPanel({onClose,onAdd}:{onClose:()=>void;onAdd:(type:string)=>void}){
  const [demoState,setDemoState]=useState<AddStepMenuState>("default");
  const [search,setSearch]=useState("");
  const [activeCategory,setActiveCategory]=useState<string>("全部");

  const showRecent = demoState==="recent";
  const showSearch = demoState==="search"||demoState==="no-results";
  const noResults  = demoState==="no-results";
  const hasDisabled= demoState==="disabled";

  const allTypes = Object.keys(STEP_CFG) as string[];
  const filteredTypes = activeCategory==="全部" ? allTypes : allTypes.filter(k=>STEP_CFG[k].category===activeCategory);
  const recentTypes = RECENT_STEPS;

  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:700}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:701,background:"#fff",borderRadius:12,width:580,maxHeight:"72vh",display:"flex",flexDirection:"column",boxShadow:"0 12px 40px rgba(0,0,0,0.14)",border:`1px solid ${T.border}`}}>

        {/* Search */}
        <div style={{padding:"12px 14px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"0 10px",border:`1.5px solid ${T.primary}`,borderRadius:8,background:"#fff"}}>
            <Search size={14} style={{color:T.t3,flexShrink:0}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索步骤类型…"
              style={{flex:1,border:"none",outline:"none",fontSize:13,color:T.t1,padding:"8px 0"}} autoFocus/>
            {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:T.t4,lineHeight:0}}><X size={13}/></button>}
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",minHeight:0}}>

          {/* Category tabs */}
          {!showSearch&&(
            <div style={{display:"flex",gap:2,padding:"8px 14px 4px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
              {["全部",...STEP_CATEGORIES].map(cat=>(
                <button key={cat} onClick={()=>setActiveCategory(cat)}
                  style={{padding:"4px 10px",borderRadius:5,border:`1px solid ${activeCategory===cat?T.primary:T.border}`,fontSize:11,fontWeight:activeCategory===cat?700:400,background:activeCategory===cat?`${T.primary}0D`:"transparent",color:activeCategory===cat?T.primary:T.t3,cursor:"pointer"}}>
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Recent */}
          {showRecent&&!showSearch&&(
            <div style={{padding:"12px 14px 0"}}>
              <div style={{fontSize:11,fontWeight:600,color:T.t4,marginBottom:8}}>最近使用</div>
              <div style={{display:"flex",gap:6,marginBottom:4}}>
                {recentTypes.map(type=>{
                  const cfg=STEP_CFG[type];
                  const Icon=cfg.icon;
                  return(
                    <button key={type} onClick={()=>{onAdd(type);onClose();}}
                      style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",cursor:"pointer",fontSize:12,color:T.t2}}>
                      <Icon size={12} style={{color:cfg.color}}/>{cfg.label}
                    </button>
                  );
                })}
              </div>
              <div style={{height:1,background:T.border,margin:"10px 0"}}/>
              <div style={{fontSize:11,fontWeight:600,color:T.t4,marginBottom:8}}>全部步骤</div>
            </div>
          )}

          {noResults&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 0",color:T.t4}}>
              <Search size={28} style={{opacity:0.3,marginBottom:8}}/>
              <div style={{fontSize:13,color:T.t3}}>未找到匹配的步骤类型</div>
            </div>
          )}

          {!noResults&&(
            <div style={{padding:"10px 14px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {filteredTypes.map(type=>{
                const cfg=STEP_CFG[type];
                const Icon=cfg.icon;
                const disabled=hasDisabled&&DISABLED_STEPS.includes(type);
                return(
                  <button key={type} onClick={()=>{if(!disabled){onAdd(type);onClose();}}}
                    disabled={disabled}
                    style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:9,background:disabled?"#FAFAFA":"#fff",cursor:disabled?"not-allowed":"pointer",textAlign:"left",opacity:disabled?0.5:1,transition:"border-color .12s,background .12s"}}
                    onMouseEnter={e=>{if(!disabled){e.currentTarget.style.borderColor=cfg.color;e.currentTarget.style.background=cfg.bg;}}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=disabled?"#FAFAFA":"#fff";}}>
                    <div style={{width:30,height:30,borderRadius:7,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <Icon size={14} style={{color:cfg.color}}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.t1,display:"flex",alignItems:"center",gap:5}}>
                        {cfg.label}
                        {disabled&&<span style={{fontSize:10,color:T.t4,background:T.bg,padding:"0 4px",borderRadius:3}}>无权限</span>}
                      </div>
                      <div style={{fontSize:11,color:T.t4,marginTop:2,lineHeight:1.4}}>{cfg.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{padding:"8px 14px",borderTop:`1px solid ${T.border}`,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11,color:T.t4}}>↑↓ 方向键选择 · Enter 确认 · Esc 取消</span>
          <button onClick={onClose} style={{padding:"5px 14px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",fontSize:12,color:T.t2,cursor:"pointer"}}>取消</button>
        </div>
      </div>
      <DemoBar states={ADD_STEP_DEMO} current={demoState} onChange={setDemoState} label="添加步骤菜单状态"/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. StepConfigDrawer — 步骤配置抽屉 (统一框架 + 6 种类型)
// ─────────────────────────────────────────────────────────────────────────────

type StepConfigType = "ref-api"|"script"|"wait"|"condition"|"loop"|"database";
type StepConfigState = "editing"|"saving"|"debug-running"|"debug-success"|"debug-fail"|"debug-timeout"|"debug-script-error"|"no-permission";

const STEP_TYPE_DEMO: {value:StepConfigType;label:string}[] = [
  {value:"ref-api",  label:"引用接口"},
  {value:"script",   label:"JS 脚本"},
  {value:"wait",     label:"等待"},
  {value:"condition",label:"条件判断"},
  {value:"loop",     label:"循环"},
  {value:"database", label:"数据库"},
];

const STEP_STATE_DEMO: {value:StepConfigState;label:string}[] = [
  {value:"editing",          label:"编辑"},
  {value:"saving",           label:"保存中"},
  {value:"debug-running",    label:"调试中"},
  {value:"debug-success",    label:"调试成功"},
  {value:"debug-fail",       label:"调试失败"},
  {value:"debug-timeout",    label:"调试超时"},
  {value:"debug-script-error",label:"脚本错误"},
  {value:"no-permission",    label:"无权限"},
];

// ── Sub-panels for each step type ─────────────────────────────────────────

function RefApiConfig(){
  const [selectedApi,setSelectedApi]=useState("POST /api/v1/orders");
  const [overrideParams,setOverrideParams]=useState([
    {key:"page",value:"1",enabled:true},
    {key:"pageSize",value:"{{PAGE_SIZE}}",enabled:true},
    {key:"status",value:"",enabled:false},
  ]);
  const tabs=["参数覆盖","Headers","Body","Auth","请求预览"] as const;
  const [tab,setTab]=useState<typeof tabs[number]>("参数覆盖");

  return(
    <div>
      <div style={{marginBottom:12}}>
        <FL required>接口 / 用例</FL>
        <div style={{display:"flex",gap:6}}>
          <div style={{flex:1,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,display:"flex",alignItems:"center",gap:6,fontSize:12,color:T.t1}}>
            <span style={{fontSize:10,padding:"1px 6px",borderRadius:4,fontWeight:700,color:"#165DFF",background:"#E8F3FF"}}>POST</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace"}}>/api/v1/orders</span>
          </div>
          <button style={{padding:"0 12px",height:34,border:`1px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t2,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><Search size={12}/>选择</button>
        </div>
        <div style={{fontSize:11,color:T.t4,marginTop:4}}>创建订单 — 获客中心 / 订单接口</div>
      </div>

      {/* Override tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,marginBottom:12}}>
        {tabs.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{height:32,padding:"0 12px",border:"none",borderBottom:`2px solid ${tab===t?T.primary:"transparent"}`,background:"transparent",fontSize:12,fontWeight:500,color:tab===t?T.primary:T.t3,cursor:"pointer"}}>
            {t}
          </button>
        ))}
      </div>

      {tab==="参数覆盖"&&(
        <div>
          <AlertBanner type="info">以下参数覆盖仅在本步骤中生效，不修改接口用例原始配置。支持 <code style={{fontFamily:"monospace",fontSize:11}}>{"{{变量名}}"}</code> 引用场景变量。</AlertBanner>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
            <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
              {["","参数名","覆盖值",""].map((h,i)=><th key={i} style={{padding:"6px 10px",textAlign:"left",fontSize:11,fontWeight:600,color:T.t3}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {overrideParams.map((r,i)=>(
                <tr key={i} style={{borderBottom:i<overrideParams.length-1?`1px solid ${T.border}`:"none"}}>
                  <td style={{padding:"6px 10px",width:28}}><input type="checkbox" checked={r.enabled} onChange={()=>{}} style={{accentColor:T.primary}}/></td>
                  <td style={{padding:"6px 10px",fontFamily:"'JetBrains Mono',monospace",color:T.t2,fontSize:11}}>{r.key}</td>
                  <td style={{padding:"6px 10px"}}>
                    <input value={r.value} onChange={()=>{}} style={{width:"100%",border:"none",outline:"none",fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:r.value.includes("{{")?T.primary:T.t1}}/>
                  </td>
                  <td style={{padding:"6px 10px",width:24}}><button style={{background:"none",border:"none",cursor:"pointer",color:T.t4,lineHeight:0}}><X size={12}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button style={{display:"flex",alignItems:"center",gap:4,marginTop:8,padding:"4px 0",border:"none",background:"transparent",fontSize:12,color:T.primary,cursor:"pointer"}}><Plus size={12}/>添加参数覆盖</button>
        </div>
      )}

      {tab==="请求预览"&&(
        <div style={{padding:12,border:`1px solid ${T.border}`,borderRadius:8,background:"#FAFBFE"}}>
          <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:8}}>变量替换后的实际请求</div>
          <pre style={{margin:0,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:T.t1,lineHeight:1.7}}>{`POST https://test-api.company.com/api/v1/orders
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJSUzI1...

{
  "page": 1,
  "pageSize": 20,
  "status": ""
}`}</pre>
        </div>
      )}

      {(tab==="Headers"||tab==="Body"||tab==="Auth")&&(
        <div style={{textAlign:"center",padding:"24px 0",color:T.t4,fontSize:12}}>
          <Settings size={20} style={{opacity:0.3,margin:"0 auto 8px",display:"block"}}/>{tab} 覆盖配置（与接口管理工作台保持一致）
        </div>
      )}
    </div>
  );
}

function ScriptConfig(){
  const [timeout,setTimeout_]=useState("10000");
  const SCRIPT_SAMPLE=`// 可用内置对象: pm, env, log, assert
const token = pm.environment.get('access_token');
const resp = pm.response.json();

// 提取并存储变量
pm.environment.set('userId', resp.data.id);
pm.environment.set('createdAt', resp.data.createdAt);

// 自定义断言
pm.test('响应码为 200', () => {
  pm.response.to.have.status(200);
});

log.info('当前 userId: ' + resp.data.id);`;

  return(
    <div>
      <div style={{marginBottom:12}}>
        <FL>运行超时</FL>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <input type="number" value={timeout} onChange={e=>setTimeout_(e.target.value)}
            style={{width:80,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:13,color:T.t1,outline:"none"}}/>
          <span style={{fontSize:12,color:T.t3}}>ms</span>
        </div>
      </div>

      <div style={{marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <FL>脚本内容</FL>
        <div style={{display:"flex",gap:6}}>
          <button style={{fontSize:11,padding:"3px 10px",border:`1px solid ${T.border}`,borderRadius:5,background:"#fff",color:T.t2,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><BookOpen size={10}/>内置函数</button>
          <button style={{fontSize:11,padding:"3px 10px",border:`1px solid ${T.border}`,borderRadius:5,background:"#fff",color:T.t2,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><Hash size={10}/>可用变量</button>
        </div>
      </div>
      <div style={{border:`1.5px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
          <Terminal size={11} style={{color:T.warning}}/>
          <span style={{fontSize:11,fontWeight:600,color:T.t3}}>JavaScript</span>
          <div style={{flex:1}}/>
          <button style={{fontSize:11,color:T.primary,border:"none",background:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><Play size={10}/>验证语法</button>
        </div>
        <textarea defaultValue={SCRIPT_SAMPLE} rows={12} spellCheck={false}
          style={{width:"100%",boxSizing:"border-box",border:"none",outline:"none",resize:"none",fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:1.7,color:T.t1,padding:"12px 14px"}}/>
      </div>
    </div>
  );
}

function WaitConfig(){
  const [waitType,setWaitType]=useState<"fixed"|"condition">("fixed");
  const [ms,setMs]=useState("3000");
  const [pollInterval,setPollInterval]=useState("500");
  const [maxWait,setMaxWait]=useState("30000");
  const [onTimeout,setOnTimeout]=useState("fail");

  return(
    <div>
      <div style={{marginBottom:14}}>
        <FL>等待类型</FL>
        <div style={{display:"flex",gap:2,background:T.bg,borderRadius:7,padding:2,width:"fit-content"}}>
          {(["fixed","condition"] as const).map(t=>(
            <button key={t} onClick={()=>setWaitType(t)} style={{padding:"5px 18px",borderRadius:5,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",background:waitType===t?"#fff":"transparent",color:waitType===t?T.primary:T.t3,boxShadow:waitType===t?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
              {t==="fixed"?"固定等待":"条件等待"}
            </button>
          ))}
        </div>
      </div>

      {waitType==="fixed"&&(
        <div style={{marginBottom:12}}>
          <FL required>等待时间</FL>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <input type="number" value={ms} onChange={e=>setMs(e.target.value)}
              style={{width:100,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:13,color:T.t1,outline:"none"}}/>
            <span style={{fontSize:12,color:T.t3}}>ms</span>
          </div>
          <div style={{fontSize:11,color:T.t4,marginTop:4}}>等待 {(Number(ms)/1000).toFixed(1)} 秒后继续执行后续步骤</div>
        </div>
      )}

      {waitType==="condition"&&(
        <>
          <div style={{marginBottom:12}}>
            <FL required>等待条件</FL>
            <div style={{padding:12,border:`1px solid ${T.border}`,borderRadius:8,background:"#FAFBFE"}}>
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                <select style={{height:30,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}>
                  <option>变量</option><option>响应体</option><option>JavaScript</option>
                </select>
                <input defaultValue="{{orderStatus}}" style={{flex:1,height:30,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:T.primary,outline:"none"}}/>
                <select style={{height:30,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}>
                  <option>等于</option><option>包含</option><option>不等于</option>
                </select>
                <input defaultValue="COMPLETED" style={{width:100,height:30,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}/>
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div>
              <FL required>轮询间隔</FL>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <input type="number" value={pollInterval} onChange={e=>setPollInterval(e.target.value)}
                  style={{width:80,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:13,color:T.t1,outline:"none"}}/>
                <span style={{fontSize:12,color:T.t3}}>ms</span>
              </div>
            </div>
            <div>
              <FL required>最大等待</FL>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <input type="number" value={maxWait} onChange={e=>setMaxWait(e.target.value)}
                  style={{width:80,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:13,color:T.t1,outline:"none"}}/>
                <span style={{fontSize:12,color:T.t3}}>ms</span>
              </div>
            </div>
          </div>
          <div>
            <FL>超时处理</FL>
            <select value={onTimeout} onChange={e=>setOnTimeout(e.target.value)}
              style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
              <option value="fail">中止场景，标记为失败</option>
              <option value="skip">跳过后续步骤，继续运行</option>
              <option value="continue">忽略超时，继续执行</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}

function ConditionConfig(){
  const [logic,setLogic]=useState<"AND"|"OR">("AND");
  const [conditions,setConditions]=useState([
    {id:"c1",source:"变量",field:"{{orderStatus}}",op:"等于",value:"COMPLETED"},
    {id:"c2",source:"响应体",field:"$.data.count",op:"大于",value:"0"},
  ]);

  return(
    <div>
      <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
        <FL>条件关系</FL>
        <div style={{display:"flex",gap:2,background:T.bg,borderRadius:6,padding:2}}>
          {(["AND","OR"] as const).map(l=>(
            <button key={l} onClick={()=>setLogic(l)} style={{padding:"3px 16px",borderRadius:5,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:logic===l?"#fff":"transparent",color:logic===l?T.primary:T.t3,boxShadow:logic===l?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
              {l}
            </button>
          ))}
        </div>
        <span style={{fontSize:11,color:T.t4}}>所有条件同时满足时执行 True 分支</span>
      </div>

      {conditions.map((cond,i)=>(
        <div key={cond.id} style={{display:"flex",gap:6,alignItems:"center",marginBottom:8}}>
          {i>0&&<span style={{fontSize:10,fontWeight:700,color:T.t3,width:28,textAlign:"center",flexShrink:0}}>{logic}</span>}
          {i===0&&<span style={{width:28,flexShrink:0}}/>}
          <select value={cond.source} onChange={()=>{}} style={{height:32,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}>
            <option>变量</option><option>响应体</option><option>JavaScript</option><option>状态码</option>
          </select>
          <input value={cond.field} onChange={()=>{}} style={{flex:1,height:32,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:T.primary,outline:"none"}}/>
          <select value={cond.op} onChange={()=>{}} style={{height:32,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}>
            {["等于","不等于","包含","大于","小于","存在","不存在"].map(o=><option key={o}>{o}</option>)}
          </select>
          <input value={cond.value} onChange={()=>{}} style={{width:100,height:32,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}/>
          <button onClick={()=>setConditions(c=>c.filter(x=>x.id!==cond.id))} style={{background:"none",border:"none",cursor:"pointer",color:T.danger,lineHeight:0,padding:4}}><Trash2 size={12}/></button>
        </div>
      ))}
      <button onClick={()=>setConditions(c=>[...c,{id:`c${Date.now()}`,source:"变量",field:"",op:"等于",value:""}])}
        style={{display:"flex",alignItems:"center",gap:4,padding:"5px 0",border:"none",background:"transparent",fontSize:12,color:T.primary,cursor:"pointer"}}><Plus size={12}/>添加条件</button>

      <div style={{marginTop:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[{label:"条件成立 (True)",color:T.success,bg:"#E8FFEA"},{label:"条件不成立 (False)",color:T.t3,bg:T.bg}].map(branch=>(
          <div key={branch.label} style={{padding:12,border:`1px solid ${branch.color}40`,borderRadius:8,background:branch.bg}}>
            <div style={{fontSize:11,fontWeight:600,color:branch.color,marginBottom:6}}>{branch.label}</div>
            <select style={{width:"100%",height:30,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none",background:"#fff"}}>
              <option>继续执行后续步骤</option><option>跳过后续步骤</option><option>中止场景</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoopConfig(){
  const [dataSource,setDataSource]=useState<"list"|"count"|"script">("list");
  const [maxCount,setMaxCount]=useState("100");
  const [loopVar,setLoopVar]=useState("item");
  const [indexVar,setIndexVar]=useState("index");
  const [onEmpty,setOnEmpty]=useState("skip");

  return(
    <div>
      <div style={{marginBottom:14}}>
        <FL required>循环数据来源</FL>
        <div style={{display:"flex",gap:2,background:T.bg,borderRadius:7,padding:2,width:"fit-content"}}>
          {(["list","count","script"] as const).map(t=>(
            <button key={t} onClick={()=>setDataSource(t)} style={{padding:"4px 14px",borderRadius:5,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",background:dataSource===t?"#fff":"transparent",color:dataSource===t?T.primary:T.t3,boxShadow:dataSource===t?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
              {t==="list"?"变量列表":t==="count"?"固定次数":"脚本生成"}
            </button>
          ))}
        </div>
      </div>

      {dataSource==="list"&&(
        <div style={{marginBottom:12}}>
          <FL required>数据变量</FL>
          <div style={{display:"flex",gap:6}}>
            <input defaultValue="{{orderList}}" style={{flex:1,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:T.primary,outline:"none"}}/>
            <button style={{padding:"0 12px",height:34,border:`1px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t2,background:"#fff",cursor:"pointer"}}>选择变量</button>
          </div>
          <div style={{fontSize:11,color:T.t4,marginTop:4}}>将对列表中的每个元素执行一次子步骤</div>
        </div>
      )}

      {dataSource==="count"&&(
        <div style={{marginBottom:12}}>
          <FL required>循环次数</FL>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <input type="number" defaultValue="10" style={{width:80,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:13,color:T.t1,outline:"none"}}/>
            <span style={{fontSize:12,color:T.t3}}>次</span>
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div>
          <FL>循环变量名</FL>
          <input value={loopVar} onChange={e=>setLoopVar(e.target.value)} style={{width:"100%",boxSizing:"border-box",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:T.primary,outline:"none"}}/>
          <div style={{fontSize:11,color:T.t4,marginTop:3}}>子步骤中用 {"{{item}}"} 引用当前元素</div>
        </div>
        <div>
          <FL>索引变量名</FL>
          <input value={indexVar} onChange={e=>setIndexVar(e.target.value)} style={{width:"100%",boxSizing:"border-box",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:T.primary,outline:"none"}}/>
          <div style={{fontSize:11,color:T.t4,marginTop:3}}>从 0 开始的循环计数</div>
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <FL>最大循环次数（安全限制）</FL>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <input type="number" value={maxCount} onChange={e=>setMaxCount(e.target.value)}
            style={{width:80,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:13,color:T.t1,outline:"none"}}/>
          <span style={{fontSize:12,color:T.t3}}>次</span>
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <FL>数据为空时</FL>
        <select value={onEmpty} onChange={e=>setOnEmpty(e.target.value)}
          style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
          <option value="skip">跳过循环，继续执行</option>
          <option value="fail">中止场景，标记为失败</option>
          <option value="warn">记录警告并继续</option>
        </select>
      </div>

      <div style={{marginBottom:12}}>
        <FL>中止条件（可选）</FL>
        <input placeholder="例如：{{loopBreak}} === true（为空则不设置中止条件）"
          style={{width:"100%",boxSizing:"border-box",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:T.t1,outline:"none"}}/>
      </div>
    </div>
  );
}

function DatabaseConfig(){
  const [connection,setConnection]=useState("MySQL — 测试环境");
  const [resultVar,setResultVar]=useState("queryResult");
  const SQL_SAMPLE=`SELECT id, status, amount, created_at
FROM orders
WHERE user_id = :userId
  AND status IN ('PENDING', 'COMPLETED')
ORDER BY created_at DESC
LIMIT :limit;`;

  return(
    <div>
      <div style={{marginBottom:12}}>
        <FL required>数据库连接</FL>
        <div style={{display:"flex",gap:6}}>
          <select value={connection} onChange={e=>setConnection(e.target.value)} style={{flex:1,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
            <option>MySQL — 测试环境</option><option>PostgreSQL — 预发布</option><option>Redis — 缓存</option>
          </select>
          <button style={{padding:"0 12px",height:34,border:`1px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t2,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><Activity size={12}/>测试连接</button>
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <FL required>SQL 语句</FL>
        <div style={{border:`1.5px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
            <Database size={11} style={{color:T.cyan}}/>
            <span style={{fontSize:11,fontWeight:600,color:T.t3}}>SQL</span>
            <div style={{flex:1}}/>
            <span style={{fontSize:11,color:T.t4}}>参数用 <code style={{fontFamily:"monospace"}}>:名称</code> 引用</span>
          </div>
          <textarea defaultValue={SQL_SAMPLE} rows={7} spellCheck={false}
            style={{width:"100%",boxSizing:"border-box",border:"none",outline:"none",resize:"none",fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:1.7,color:T.t1,padding:"10px 14px"}}/>
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <FL>SQL 参数绑定</FL>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
          <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
            {["参数名","值 / 变量"].map((h,i)=><th key={i} style={{padding:"6px 10px",textAlign:"left",fontSize:11,fontWeight:600,color:T.t3}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[{k:"userId",v:"{{userId}}"},{k:"limit",v:"20"}].map((r,i)=>(
              <tr key={i} style={{borderBottom:i===0?`1px solid ${T.border}`:"none"}}>
                <td style={{padding:"6px 10px",fontFamily:"'JetBrains Mono',monospace",color:T.t2}}>{r.k}</td>
                <td style={{padding:"6px 10px",fontFamily:"'JetBrains Mono',monospace",color:r.v.includes("{{")?T.primary:T.t1}}>{r.v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{marginBottom:12}}>
        <FL>将结果保存到变量</FL>
        <div style={{display:"flex",gap:6}}>
          <input value={resultVar} onChange={e=>setResultVar(e.target.value)}
            style={{flex:1,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:T.primary,outline:"none"}}/>
          <select style={{height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
            <option>全部行 (Array)</option><option>第一行 (Object)</option><option>行数 (Number)</option>
          </select>
        </div>
      </div>

      <div>
        <FL>执行超时</FL>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <input type="number" defaultValue="30000" style={{width:80,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:13,color:T.t1,outline:"none"}}/>
          <span style={{fontSize:12,color:T.t3}}>ms</span>
        </div>
      </div>
    </div>
  );
}

// ── Debug Result Panel ────────────────────────────────────────────────────────

function DebugResultPanel({debugState}:{debugState:StepConfigState}){
  const isRunning = debugState==="debug-running";
  const isSuccess = debugState==="debug-success";
  const isFail    = debugState==="debug-fail";
  const isTimeout = debugState==="debug-timeout";
  const isError   = debugState==="debug-script-error";
  const isIdle    = debugState==="editing"||debugState==="saving"||debugState==="no-permission";
  const [resTab,setResTab]=useState("响应体");

  if(isIdle) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 0",color:T.t4}}>
      <Bug size={36} style={{opacity:0.25,marginBottom:10}}/>
      <div style={{fontSize:13,color:T.t3,marginBottom:4}}>尚未调试</div>
      <div style={{fontSize:12,color:T.t4}}>点击「保存并调试」后，执行结果将在此展示</div>
    </div>
  );

  if(isRunning) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 0",color:T.t4,gap:12}}>
      <Loader2 size={32} style={{color:T.primary,animation:"spin 1s linear infinite"}}/>
      <div style={{fontSize:14,fontWeight:500,color:T.t1}}>正在调试步骤…</div>
      <div style={{fontSize:12,color:T.t4}}>POST /api/v1/orders</div>
    </div>
  );

  if(isTimeout) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 0",gap:10}}>
      <div style={{width:48,height:48,borderRadius:"50%",background:"#FFF3E8",display:"flex",alignItems:"center",justifyContent:"center"}}><AlertTriangle size={24} style={{color:T.warning}}/></div>
      <div style={{fontSize:14,fontWeight:500,color:T.t1}}>调试超时</div>
      <div style={{fontSize:12,color:T.t3,textAlign:"center",lineHeight:1.8}}>超出设定的 10,000 ms 超时时间<br/>请检查接口响应速度或调整运行设置中的超时配置</div>
    </div>
  );

  if(isError) return(
    <div style={{padding:"16px 0"}}>
      <AlertBanner type="error">
        <strong>脚本执行错误</strong><br/>
        <code style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:T.danger}}>TypeError: Cannot read properties of undefined (reading 'data')<br/>  at &lt;anonymous&gt;:4:24<br/>  at pm.test (&lt;anonymous&gt;:1:15)</code>
      </AlertBanner>
      <div style={{padding:12,border:`1px solid ${T.border}`,borderRadius:8,background:"#FAFBFE",fontSize:12}}>
        <div style={{fontWeight:600,color:T.t2,marginBottom:6}}>控制台输出</div>
        <pre style={{margin:0,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.t3}}>{`[INFO] 开始执行脚本\n[INFO] 当前环境: 测试环境\n[ERROR] 脚本执行失败 (12ms)`}</pre>
      </div>
    </div>
  );

  // Success or Fail
  const success = isSuccess;
  const resTabs=["响应体","响应 Headers","变量提取","断言结果","控制台日志"];

  return(
    <div>
      {/* Summary */}
      <div style={{display:"flex",gap:16,padding:"10px 14px",border:`1px solid ${success?T.success+"30":T.danger+"30"}`,borderRadius:8,background:success?"#F0FFF4":"#FFF5F5",marginBottom:14}}>
        {[
          {label:"状态",value:success?"调试成功":"调试失败",color:success?T.success:T.danger},
          {label:"耗时",value:"312 ms",color:T.t1},
          {label:"响应码",value:"200 OK",color:T.success},
          {label:"Body 大小",value:"1.84 KB",color:T.t1},
          {label:"开始时间",value:"14:23:07.482",color:T.t1},
        ].map(item=>(
          <div key={item.label}>
            <div style={{fontSize:10,color:T.t4,marginBottom:2}}>{item.label}</div>
            <div style={{fontSize:12,fontWeight:700,color:item.color}}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,marginBottom:12}}>
        {resTabs.map(t=>(
          <button key={t} onClick={()=>setResTab(t)} style={{height:32,padding:"0 12px",border:"none",borderBottom:`2px solid ${resTab===t?T.primary:"transparent"}`,background:"transparent",fontSize:11,fontWeight:500,color:resTab===t?T.primary:T.t3,cursor:"pointer"}}>
            {t}
          </button>
        ))}
      </div>

      {resTab==="响应体"&&(
        <div style={{padding:10,border:`1px solid ${T.border}`,borderRadius:8,background:"#FAFBFE"}}>
          <pre style={{margin:0,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:T.t1,lineHeight:1.7}}>{`{
  "code": 0,
  "msg": "success",
  "data": {
    "id": "ord_20260731_001",
    "status": "PENDING",
    "amount": 299.00,
    "userId": "10086"
  }
}`}</pre>
        </div>
      )}

      {resTab==="变量提取"&&(
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
          <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
            {["变量名","提取表达式","提取值","状态"].map((h,i)=><th key={i} style={{padding:"6px 10px",textAlign:"left",fontSize:11,fontWeight:600,color:T.t3}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[
              {name:"orderId",expr:"$.data.id",value:"ord_20260731_001",ok:true},
              {name:"orderStatus",expr:"$.data.status",value:"PENDING",ok:true},
              {name:"userId",expr:"$.data.userId",value:"10086",ok:true},
            ].map((r,i)=>(
              <tr key={i} style={{borderBottom:i<2?`1px solid ${T.border}`:"none"}}>
                <td style={{padding:"6px 10px",fontFamily:"'JetBrains Mono',monospace",color:T.primary}}>{r.name}</td>
                <td style={{padding:"6px 10px",fontFamily:"'JetBrains Mono',monospace",color:T.t2,fontSize:11}}>{r.expr}</td>
                <td style={{padding:"6px 10px",fontFamily:"'JetBrains Mono',monospace",color:T.t1}}>{r.value}</td>
                <td style={{padding:"6px 10px"}}><CheckCircle size={12} style={{color:T.success}}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {resTab==="断言结果"&&(
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
          <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
            {["断言名称","期望","实际","结果"].map((h,i)=><th key={i} style={{padding:"6px 10px",textAlign:"left",fontSize:11,fontWeight:600,color:T.t3}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[
              {name:"状态码断言",expect:"200",actual:"200",ok:true},
              {name:"响应码为 0",expect:"$.code == 0",actual:"0",ok:success},
              {name:"包含 orderId",expect:"exists $.data.id",actual:"存在",ok:true},
            ].map((r,i)=>(
              <tr key={i} style={{borderBottom:i<2?`1px solid ${T.border}`:"none",background:!r.ok?"#FFF5F5":"transparent"}}>
                <td style={{padding:"6px 10px",color:T.t1}}>{r.name}</td>
                <td style={{padding:"6px 10px",fontFamily:"'JetBrains Mono',monospace",color:T.t2,fontSize:11}}>{r.expect}</td>
                <td style={{padding:"6px 10px",fontFamily:"'JetBrains Mono',monospace",color:T.t1,fontSize:11}}>{r.actual}</td>
                <td style={{padding:"6px 10px"}}>{r.ok?<CheckCircle size={12} style={{color:T.success}}/>:<XCircle size={12} style={{color:T.danger}}/>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {resTab==="控制台日志"&&(
        <div style={{padding:10,border:`1px solid ${T.border}`,borderRadius:8,background:"#111",fontFamily:"'JetBrains Mono',monospace",fontSize:11,lineHeight:1.8}}>
          {[
            {level:"INFO", color:"#86D9CA", msg:"场景变量已注入: userId=10086, access_token=***"},
            {level:"INFO", color:"#86D9CA", msg:"发送请求: POST https://test-api.company.com/api/v1/orders"},
            {level:"INFO", color:"#86D9CA", msg:"响应: 200 OK (312ms)"},
            {level:"INFO", color:"#86D9CA", msg:"变量提取完成: orderId=ord_20260731_001"},
            success
              ?{level:"PASS", color:"#52D273", msg:"所有断言通过 (3/3)"}
              :{level:"FAIL", color:"#F87171", msg:"断言失败: '响应码为 0' 期望 0, 实际 1"},
          ].map((log,i)=>(
            <div key={i}><span style={{color:log.color}}>[{log.level}]</span> <span style={{color:"#D4D4D4"}}>{log.msg}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main StepConfigDrawer ─────────────────────────────────────────────────────

export function StepConfigDrawer({onClose}:{onClose:()=>void}){
  const [stepType,setStepType]=useState<StepConfigType>("ref-api");
  const [stepState,setStepState]=useState<StepConfigState>("editing");
  const [stepName,setStepName]=useState("创建订单 — 步骤 3");
  const [enabled,setEnabled]=useState(true);
  const [activeTab,setActiveTab]=useState("基础配置");

  const cfg=STEP_CFG[stepType]||{label:stepType,color:T.t3,bg:T.bg,icon:Settings};
  const Icon=cfg.icon;
  const isSaving=stepState==="saving";
  const isNoPermission=stepState==="no-permission";
  const isDebugging=stepState==="debug-running";
  const hasDebugResult=["debug-running","debug-success","debug-fail","debug-timeout","debug-script-error"].includes(stepState);

  const tabList=["基础配置","前置处理","后置处理","断言","运行设置","调试结果"];

  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.18)",zIndex:800}}/>
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:700,zIndex:801,background:"#fff",boxShadow:"-4px 0 28px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column"}}>

        {/* Fixed header */}
        <div style={{flexShrink:0,borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 20px 0"}}>
            <div style={{width:30,height:30,borderRadius:7,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Icon size={14} style={{color:cfg.color}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <StepTypeBadge type={stepType}/>
                <SmToggle on={enabled} onChange={setEnabled}/>
                <span style={{fontSize:11,color:enabled?T.success:T.t4}}>{enabled?"启用":"已禁用"}</span>
              </div>
              <input value={stepName} onChange={e=>setStepName(e.target.value)}
                style={{fontSize:14,fontWeight:700,color:T.t1,border:"none",outline:"none",width:"100%",padding:0,background:"transparent"}}/>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:4}}><X size={16}/></button>
          </div>

          {/* Type switcher (demo only) */}
          <div style={{display:"flex",gap:2,padding:"8px 20px 0",overflowX:"auto"}}>
            {STEP_TYPE_DEMO.map(s=>(
              <button key={s.value} onClick={()=>{setStepType(s.value);setActiveTab("基础配置");}}
                style={{padding:"3px 10px",borderRadius:5,border:`1px solid ${stepType===s.value?cfg.color:T.border}`,fontSize:11,fontWeight:stepType===s.value?700:400,background:stepType===s.value?cfg.bg:"transparent",color:stepType===s.value?cfg.color:T.t3,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div style={{display:"flex",borderTop:`1px solid ${T.border}`,marginTop:8}}>
            {tabList.map(t=>{
              const isDebugTab=t==="调试结果";
              return(
                <button key={t} onClick={()=>setActiveTab(t)}
                  style={{height:36,padding:"0 14px",border:"none",borderBottom:`2px solid ${activeTab===t?T.primary:"transparent"}`,background:"transparent",fontSize:12,fontWeight:500,color:activeTab===t?T.primary:T.t3,cursor:"pointer",position:"relative",whiteSpace:"nowrap"}}>
                  {t}
                  {isDebugTab&&hasDebugResult&&(
                    <span style={{width:6,height:6,borderRadius:"50%",background:stepState==="debug-success"?T.success:T.danger,position:"absolute",top:6,right:6}}/>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",minHeight:0}}>
          {isNoPermission&&<AlertBanner type="error"><strong>无操作权限</strong> — 您没有编辑此步骤的权限，请联系项目管理员。</AlertBanner>}

          {activeTab==="基础配置"&&(
            stepType==="ref-api"?<RefApiConfig/>:
            stepType==="script"?<ScriptConfig/>:
            stepType==="wait"?<WaitConfig/>:
            stepType==="condition"?<ConditionConfig/>:
            stepType==="loop"?<LoopConfig/>:
            <DatabaseConfig/>
          )}

          {activeTab==="前置处理"&&(
            <div>
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
                <button style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",border:`1px solid ${T.primary}`,borderRadius:7,background:`${T.primary}0D`,color:T.primary,fontSize:12,cursor:"pointer"}}><Plus size={12}/>添加处理器</button>
              </div>
              {[
                {name:"提取 access_token",type:"变量提取",enabled:true},
                {name:"设置请求时间戳",type:"变量赋值",enabled:true},
              ].map((proc,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8,marginBottom:8,background:"#fff"}}>
                  <GripVertical size={14} style={{color:T.t4,cursor:"grab"}}/>
                  <span style={{fontSize:10,fontWeight:700,width:20,color:T.t4,flexShrink:0}}>{i+1}</span>
                  <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:`${T.primary}0D`,color:T.primary,fontWeight:600}}>{proc.type}</span>
                  <span style={{flex:1,fontSize:12,fontWeight:500,color:T.t1}}>{proc.name}</span>
                  <SmToggle on={proc.enabled} onChange={()=>{}}/>
                  <button style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0}}><Copy size={12}/></button>
                  <button style={{background:"none",border:"none",cursor:"pointer",color:T.danger,lineHeight:0}}><Trash2 size={12}/></button>
                </div>
              ))}
            </div>
          )}

          {activeTab==="后置处理"&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 0",color:T.t4,gap:10}}>
              <AlignLeft size={28} style={{opacity:0.3}}/>
              <div style={{fontSize:13,color:T.t3}}>暂无后置处理器</div>
              <button style={{display:"flex",alignItems:"center",gap:4,padding:"6px 14px",border:`1px solid ${T.primary}`,borderRadius:7,background:`${T.primary}0D`,color:T.primary,fontSize:12,cursor:"pointer"}}><Plus size={12}/>添加处理器</button>
            </div>
          )}

          {activeTab==="断言"&&(
            <div>
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
                <button style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",border:`1px solid ${T.primary}`,borderRadius:7,background:`${T.primary}0D`,color:T.primary,fontSize:12,cursor:"pointer"}}><Plus size={12}/>添加断言</button>
              </div>
              {[
                {name:"状态码为 200",kind:"状态码",expect:"200",ok:true},
                {name:"响应码为 0",kind:"响应体 JSONPath",expect:"$.code === 0",ok:false},
              ].map((a,i)=>(
                <div key={i} style={{padding:"10px 12px",border:`1px solid ${a.ok===false?T.danger+"30":T.border}`,borderRadius:8,marginBottom:8,background:a.ok===false?"#FFF5F5":"#fff",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:`${T.primary}0D`,color:T.primary,fontWeight:600}}>{a.kind}</span>
                  <span style={{flex:1,fontSize:12,color:T.t1}}>{a.name}</span>
                  <span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:T.t3}}>{a.expect}</span>
                  <SmToggle on={true} onChange={()=>{}}/>
                  <button style={{background:"none",border:"none",cursor:"pointer",color:T.danger,lineHeight:0}}><Trash2 size={12}/></button>
                </div>
              ))}
            </div>
          )}

          {activeTab==="运行设置"&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {[
                {label:"步骤超时时间",desc:"单个步骤最长执行时间",type:"number",unit:"ms",value:"10000"},
                {label:"失败时继续",desc:"此步骤失败后是否继续执行下一步骤",type:"toggle",value:false},
                {label:"重试次数",desc:"失败后自动重试次数（0 表示不重试）",type:"number",unit:"次",value:"0"},
                {label:"保存请求响应",desc:"将完整请求和响应数据保存到执行报告",type:"toggle",value:true},
              ].map(s=>(
                <div key={s.label} style={{display:"flex",alignItems:"center",padding:"10px 14px",border:`1px solid ${T.border}`,borderRadius:8,background:"#fff"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500,color:T.t1}}>{s.label}</div>
                    <div style={{fontSize:11,color:T.t4,marginTop:2}}>{s.desc}</div>
                  </div>
                  {s.type==="toggle"&&<SmToggle on={!!s.value} onChange={()=>{}}/>}
                  {s.type==="number"&&(
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <input type="number" defaultValue={s.value as string}
                        style={{width:72,padding:"4px 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none",textAlign:"right"}}/>
                      {s.unit&&<span style={{fontSize:12,color:T.t4}}>{s.unit}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab==="调试结果"&&<DebugResultPanel debugState={stepState}/>}
        </div>

        {/* Fixed footer */}
        <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",gap:8,justifyContent:"flex-end",background:"#fff"}}>
          <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>取消</button>
          <button onClick={()=>setStepState("saving")} disabled={isNoPermission||isSaving}
            style={{padding:"7px 20px",border:`1px solid ${T.border}`,borderRadius:7,background:isNoPermission?"#F7F8FA":"#fff",fontSize:13,color:isNoPermission?T.t4:T.t1,cursor:isNoPermission?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:5,opacity:isSaving?0.7:1}}>
            {isSaving&&<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>}
            {isSaving?"保存中…":"保存"}
          </button>
          <button onClick={()=>{setStepState("debug-running");setActiveTab("调试结果");setTimeout(()=>setStepState("debug-success"),1500);}}
            disabled={isNoPermission||isDebugging}
            style={{padding:"7px 20px",border:"none",borderRadius:7,background:isNoPermission?T.t4:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:isNoPermission?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:5}}>
            {isDebugging&&<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>}
            <Zap size={13}/>{isDebugging?"调试中…":"保存并调试"}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <DemoBar states={STEP_STATE_DEMO} current={stepState} onChange={setStepState} label="调试状态"/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SceneRunConfigDialog — 场景运行配置弹窗
// ─────────────────────────────────────────────────────────────────────────────

type RunConfigState = "ready"|"no-env"|"env-error"|"runner-unavailable"|"var-conflict"|"mock-invalid"|"no-test-data"|"creating"|"create-fail";

const RUN_CONFIG_DEMO: {value:RunConfigState;label:string}[] = [
  {value:"ready",            label:"就绪"},
  {value:"no-env",           label:"未选择环境"},
  {value:"env-error",        label:"环境异常"},
  {value:"runner-unavailable",label:"Runner 不可用"},
  {value:"var-conflict",     label:"变量冲突"},
  {value:"mock-invalid",     label:"Mock 引用失效"},
  {value:"no-test-data",     label:"测试数据为空"},
  {value:"creating",         label:"创建任务中"},
  {value:"create-fail",      label:"创建失败"},
];

export function SceneRunConfigDialog({onClose}:{onClose:()=>void}){
  const [demoState,setDemoState]=useState<RunConfigState>("ready");
  const [env,setEnv]=useState("测试环境");
  const [varSet,setVarSet]=useState("默认变量集");
  const [testData,setTestData]=useState("用户测试数据集 v2");
  const [dataMode,setDataMode]=useState<"sequential"|"parallel"|"random">("sequential");
  const [runner,setRunner]=useState("自动分配");
  const [timeout,setTimeout_]=useState("300000");
  const [failStrategy,setFailStrategy]=useState("continue");
  const [stopOnFail,setStopOnFail]=useState(false);
  const [saveReqResp,setSaveReqResp]=useState(true);
  const [notes,setNotes]=useState("");

  const isNoEnv=demoState==="no-env";
  const isEnvError=demoState==="env-error";
  const isRunnerUnavail=demoState==="runner-unavailable";
  const isVarConflict=demoState==="var-conflict";
  const isMockInvalid=demoState==="mock-invalid";
  const isNoTestData=demoState==="no-test-data";
  const isCreating=demoState==="creating";
  const isCreateFail=demoState==="create-fail";
  const canRun=!isNoEnv&&!isEnvError&&!isRunnerUnavail&&!isCreating;

  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:900}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:901,background:"#fff",borderRadius:12,width:640,maxHeight:"86vh",display:"flex",flexDirection:"column",boxShadow:"0 12px 48px rgba(0,0,0,0.16)"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <Play size={15} style={{color:T.primary}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700,color:T.t1}}>运行场景</div>
            <div style={{fontSize:12,color:T.t3}}>用户下单完整流程 v2.1</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:4}}><X size={16}/></button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",minHeight:0}}>

          {/* Status banners */}
          {isNoEnv&&<AlertBanner type="warn"><strong>未选择运行环境</strong> — 请选择一个运行环境后才能执行场景。</AlertBanner>}
          {isEnvError&&<AlertBanner type="error"><strong>环境配置异常</strong> — 测试环境连接失败，无法获取变量配置。<div style={{marginTop:4}}><button style={{fontSize:11,padding:"2px 8px",border:`1px solid ${T.danger}`,borderRadius:4,background:"#fff",color:T.danger,cursor:"pointer"}}>查看详情</button></div></AlertBanner>}
          {isRunnerUnavail&&<AlertBanner type="error"><strong>Runner 节点不可用</strong> — 当前没有在线的 Runner 节点，请前往 Runner 管理检查节点状态或选择其他节点。</AlertBanner>}
          {isVarConflict&&<AlertBanner type="warn"><strong>变量冲突</strong> — 环境变量和变量集中均定义了 <code style={{fontFamily:"monospace",fontSize:11}}>BASE_URL</code>，将优先使用环境变量的值。</AlertBanner>}
          {isMockInvalid&&<AlertBanner type="warn"><strong>Mock 引用失效</strong> — 当前环境启用的 Mock 发布版本 v1.2 已被删除，将跳过 Mock 直接访问真实接口。<div style={{marginTop:4}}><button style={{fontSize:11,padding:"2px 8px",border:`1px solid ${T.warning}`,borderRadius:4,background:"#fff",color:T.warning,cursor:"pointer"}}>前往环境管理</button></div></AlertBanner>}
          {isNoTestData&&<AlertBanner type="warn"><strong>测试数据为空</strong> — 已选的测试数据集"用户测试数据集 v2"当前没有数据行，场景将只执行 1 次。</AlertBanner>}
          {isCreateFail&&<AlertBanner type="error"><strong>创建执行任务失败</strong> — 服务器返回错误，请稍后重试。<span style={{fontSize:11,color:T.danger,marginLeft:6}}>500 Internal Server Error</span></AlertBanner>}

          {/* Config fields */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>

            <div>
              <FL required>运行环境</FL>
              <select value={env} onChange={e=>setEnv(e.target.value)}
                style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${isNoEnv||isEnvError?T.danger:T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
                <option>— 不使用环境 —</option>
                <option>测试环境</option><option>预发布环境</option><option>生产环境</option>
              </select>
            </div>

            <div>
              <FL>变量集</FL>
              <select value={varSet} onChange={e=>setVarSet(e.target.value)}
                style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
                <option>— 不使用变量集 —</option>
                <option>默认变量集</option><option>高并发测试变量</option>
              </select>
            </div>

            <div>
              <FL>测试数据</FL>
              <select value={testData} onChange={e=>setTestData(e.target.value)}
                style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
                <option>— 不使用测试数据 —</option>
                <option>用户测试数据集 v2</option><option>批量订单数据</option>
              </select>
            </div>

            <div>
              <FL>数据驱动方式</FL>
              <div style={{display:"flex",gap:2,background:T.bg,borderRadius:6,padding:2}}>
                {(["sequential","parallel","random"] as const).map(m=>(
                  <button key={m} onClick={()=>setDataMode(m)} style={{flex:1,padding:"4px 0",borderRadius:5,border:"none",fontSize:11,fontWeight:dataMode===m?700:400,cursor:"pointer",background:dataMode===m?"#fff":"transparent",color:dataMode===m?T.primary:T.t3,boxShadow:dataMode===m?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
                    {m==="sequential"?"顺序":m==="parallel"?"并行":"随机"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <FL required>Runner 节点</FL>
              <select value={runner} onChange={e=>setRunner(e.target.value)}
                style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${isRunnerUnavail?T.danger:T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
                <option>自动分配</option><option>Runner-Node-01 (在线)</option><option>Runner-Node-02 (离线)</option>
              </select>
            </div>

            <div>
              <FL>执行超时</FL>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <input type="number" value={timeout} onChange={e=>setTimeout_(e.target.value)}
                  style={{flex:1,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/>
                <span style={{fontSize:11,color:T.t3}}>ms</span>
              </div>
            </div>
          </div>

          {/* Toggle settings */}
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
            {[
              {label:"遇到步骤失败立即停止",desc:"有步骤失败时立即中止场景，不再执行后续步骤",state:stopOnFail,toggle:()=>setStopOnFail(v=>!v)},
              {label:"保存完整请求响应",desc:"将每个步骤的请求和响应数据完整保存到报告（会增加存储占用）",state:saveReqResp,toggle:()=>setSaveReqResp(v=>!v)},
            ].map(s=>(
              <div key={s.label} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",border:`1px solid ${T.border}`,borderRadius:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:500,color:T.t1}}>{s.label}</div>
                  <div style={{fontSize:11,color:T.t4}}>{s.desc}</div>
                </div>
                <SmToggle on={s.state} onChange={s.toggle}/>
              </div>
            ))}
          </div>

          {/* Mock status (read-only) */}
          <div style={{padding:"10px 14px",border:`1px solid ${T.border}`,borderRadius:8,background:T.bg,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:12,fontWeight:600,color:T.t2}}>Mock 状态（只读）</span>
              <button style={{fontSize:11,color:T.primary,border:"none",background:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><ExternalLink size={10}/>前往环境管理</button>
            </div>
            <div style={{display:"flex",gap:16,fontSize:12}}>
              <span><span style={{color:T.t4}}>状态：</span><span style={{fontWeight:600,color:isMockInvalid?T.danger:T.success}}>{isMockInvalid?"引用失效":"已启用"}</span></span>
              <span><span style={{color:T.t4}}>Mock 应用：</span><span style={{color:T.t1}}>订单中心 Mock</span></span>
              <span><span style={{color:T.t4}}>发布版本：</span><span style={{fontFamily:"'JetBrains Mono',monospace",color:isMockInvalid?T.danger:T.t2}}>{isMockInvalid?"v1.2 (已删除)":"v2.3"}</span></span>
            </div>
          </div>

          <div>
            <FL>执行说明（可选）</FL>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="填写本次执行的目的或备注…" rows={2}
              style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none",resize:"none"}}/>
          </div>
        </div>

        {/* Footer */}
        <div style={{padding:"12px 20px",borderTop:`1px solid ${T.border}`,flexShrink:0,display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>取消</button>
          <button onClick={()=>setDemoState("creating")} disabled={!canRun||isCreating}
            style={{padding:"7px 24px",border:"none",borderRadius:7,background:canRun?T.primary:T.t4,color:"#fff",fontSize:13,fontWeight:500,cursor:canRun?"pointer":"not-allowed",display:"flex",alignItems:"center",gap:6}}>
            {isCreating&&<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>}
            <Play size={13}/>{isCreating?"创建执行任务中…":"开始执行"}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <DemoBar states={RUN_CONFIG_DEMO} current={demoState} onChange={setDemoState} label="运行配置状态"/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. StepResultDrawer — 执行步骤详情抽屉
// ─────────────────────────────────────────────────────────────────────────────

export function StepResultDrawer({onClose,stepName="创建订单",stepType="ref-api",execStatus="success"}:{
  onClose:()=>void;stepName?:string;stepType?:string;execStatus?:ExecStatus;
}){
  const [resTab,setResTab]=useState("请求");
  const resTabs=["基本信息","请求","响应","前置结果","后置结果","变量","断言","日志","Mock 信息"];
  const cfg=STEP_CFG[stepType]||{label:stepType,color:T.t3,bg:T.bg,icon:Settings};
  const Icon=cfg.icon;
  const hasMock=true;

  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.1)",zIndex:1050}}/>
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:700,zIndex:1051,background:"#fff",boxShadow:"-4px 0 28px rgba(0,0,0,0.14)",display:"flex",flexDirection:"column",borderLeft:`1px solid ${T.border}`}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0,background:"#FAFBFE"}}>
          <div style={{width:28,height:28,borderRadius:6,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon size={13} style={{color:cfg.color}}/></div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
              <StepTypeBadge type={stepType}/>
              <ExecStatusBadge status={execStatus}/>
            </div>
            <div style={{fontSize:13,fontWeight:600,color:T.t1}}>{stepName}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:4}}><X size={16}/></button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,overflowX:"auto",flexShrink:0,background:"#FAFBFE"}}>
          {resTabs.map(t=>(
            <button key={t} onClick={()=>setResTab(t)}
              style={{height:36,padding:"0 12px",border:"none",borderBottom:`2px solid ${resTab===t?T.primary:"transparent"}`,background:"transparent",fontSize:11,fontWeight:500,color:resTab===t?T.primary:T.t3,cursor:"pointer",whiteSpace:"nowrap"}}>
              {t}
              {t==="Mock 信息"&&hasMock&&<span style={{marginLeft:4,width:5,height:5,borderRadius:"50%",background:T.primary,display:"inline-block"}}/>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"14px 20px",minHeight:0}}>

          {resTab==="基本信息"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[
                {label:"步骤名称",  value:stepName},
                {label:"步骤类型",  value:STEP_CFG[stepType]?.label||stepType},
                {label:"执行状态",  value:"成功"},
                {label:"开始时间",  value:"2026-07-31 14:23:07.482"},
                {label:"执行耗时",  value:"312 ms"},
                {label:"重试次数",  value:"0"},
                {label:"实际请求地址",value:"POST https://test-api.company.com/api/v1/orders"},
                {label:"响应状态码",value:"200 OK"},
              ].map(item=>(
                <div key={item.label} style={{padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8}}>
                  <div style={{fontSize:11,color:T.t4,marginBottom:3}}>{item.label}</div>
                  <div style={{fontSize:12,fontWeight:500,color:T.t1,fontFamily:item.label.includes("地址")||item.label.includes("状态码")?"'JetBrains Mono',monospace":"inherit"}}>{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {resTab==="请求"&&(
            <div>
              <SectionCard title="请求 Headers">
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <tbody>
                    {[["Content-Type","application/json"],["Authorization","Bearer eyJhbGci…(脱敏)"],["X-Request-Id","req_20260731_001"]].map((r,i)=>(
                      <tr key={i} style={{borderBottom:i<2?`1px solid ${T.border}`:"none"}}>
                        <td style={{padding:"6px 10px",fontFamily:"'JetBrains Mono',monospace",color:T.t2,fontSize:11,width:180}}>{r[0]}</td>
                        <td style={{padding:"6px 10px",fontFamily:"'JetBrains Mono',monospace",color:T.t1,fontSize:11}}>{r[1]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionCard>
              <SectionCard title="请求 Body">
                <pre style={{margin:0,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:T.t1,lineHeight:1.7}}>{`{
  "page": 1,
  "pageSize": 20,
  "status": "PENDING"
}`}</pre>
              </SectionCard>
            </div>
          )}

          {resTab==="响应"&&(
            <div>
              <div style={{display:"flex",gap:12,marginBottom:12}}>
                {[{l:"状态码",v:"200 OK",c:T.success},{l:"耗时",v:"312 ms",c:T.t1},{l:"Body 大小",v:"1.84 KB",c:T.t1}].map(i=>(
                  <div key={i.l} style={{padding:"8px 14px",border:`1px solid ${T.border}`,borderRadius:8,background:"#fff"}}>
                    <div style={{fontSize:11,color:T.t4}}>{i.l}</div>
                    <div style={{fontSize:13,fontWeight:700,color:i.c,marginTop:1}}>{i.v}</div>
                  </div>
                ))}
              </div>
              <SectionCard title="响应 Body（执行快照，只读）">
                <pre style={{margin:0,fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:T.t1,lineHeight:1.7}}>{`{
  "code": 0,
  "msg": "success",
  "data": {
    "id": "ord_20260731_001",
    "status": "PENDING",
    "amount": 299.00
  }
}`}</pre>
              </SectionCard>
            </div>
          )}

          {resTab==="变量"&&(
            <div>
              <div style={{fontSize:11,fontWeight:600,color:T.t4,marginBottom:8}}>变量解析过程</div>
              {[
                {name:"userId",before:"{{userId}}",after:"10086",ok:true},
                {name:"access_token",before:"{{access_token}}",after:"eyJhbGci…(脱敏)",ok:true},
                {name:"PAGE_SIZE",before:"{{PAGE_SIZE}}",after:"20",ok:true},
              ].map((v,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",border:`1px solid ${T.border}`,borderRadius:7,marginBottom:6,fontSize:12}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",color:T.primary,width:100,flexShrink:0}}>{v.name}</span>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",color:T.t3,fontSize:11}}>{v.before}</span>
                  <ArrowRight size={10} style={{color:T.t4,flexShrink:0}}/>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",color:T.t1,flex:1}}>{v.after}</span>
                  {v.ok?<CheckCircle size={12} style={{color:T.success}}/>:<XCircle size={12} style={{color:T.danger}}/>}
                </div>
              ))}
              <div style={{fontSize:11,fontWeight:600,color:T.t4,margin:"12px 0 8px"}}>提取变量（本步骤输出）</div>
              {[{name:"orderId",value:"ord_20260731_001"},{name:"orderStatus",value:"PENDING"}].map((v,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",border:`1px solid ${T.success}30`,borderRadius:7,marginBottom:6,fontSize:12,background:"#F0FFF4"}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",color:T.primary,width:120,flexShrink:0}}>{v.name}</span>
                  <CheckCircle size={11} style={{color:T.success,flexShrink:0}}/>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",color:T.t1,flex:1}}>{v.value}</span>
                </div>
              ))}
            </div>
          )}

          {resTab==="断言"&&(
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
              <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                {["断言名称","类型","期望","实际值","结果"].map((h,i)=><th key={i} style={{padding:"6px 10px",textAlign:"left",fontSize:11,fontWeight:600,color:T.t3}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[
                  {name:"状态码为 200",kind:"状态码",expect:"200",actual:"200",ok:true},
                  {name:"响应码为 0",kind:"JSONPath",expect:"$.code == 0",actual:"0",ok:true},
                  {name:"包含 orderId",kind:"JSONPath",expect:"exists $.data.id",actual:"存在",ok:true},
                ].map((a,i)=>(
                  <tr key={i} style={{borderBottom:i<2?`1px solid ${T.border}`:"none",background:!a.ok?"#FFF5F5":"transparent"}}>
                    <td style={{padding:"7px 10px",color:T.t1}}>{a.name}</td>
                    <td style={{padding:"7px 10px"}}><span style={{fontSize:10,padding:"1px 5px",borderRadius:3,background:`${T.primary}0D`,color:T.primary,fontWeight:600}}>{a.kind}</span></td>
                    <td style={{padding:"7px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.t2}}>{a.expect}</td>
                    <td style={{padding:"7px 10px",fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.t1}}>{a.actual}</td>
                    <td style={{padding:"7px 10px"}}>{a.ok?<CheckCircle size={12} style={{color:T.success}}/>:<XCircle size={12} style={{color:T.danger}}/>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {resTab==="日志"&&(
            <div style={{padding:12,border:`1px solid ${T.border}`,borderRadius:8,background:"#111",fontFamily:"'JetBrains Mono',monospace",fontSize:11,lineHeight:1.9}}>
              {[
                {t:"14:23:07.482",l:"INFO",c:"#86D9CA",m:"步骤开始执行: 创建订单"},
                {t:"14:23:07.483",l:"INFO",c:"#86D9CA",m:"变量注入完成: userId=10086"},
                {t:"14:23:07.485",l:"INFO",c:"#86D9CA",m:"发送请求: POST https://test-api.company.com/api/v1/orders"},
                {t:"14:23:07.796",l:"INFO",c:"#86D9CA",m:"收到响应: 200 OK (311ms)"},
                {t:"14:23:07.797",l:"INFO",c:"#86D9CA",m:"变量提取: orderId=ord_20260731_001"},
                {t:"14:23:07.798",l:"PASS",c:"#52D273",m:"断言全部通过 (3/3)"},
                {t:"14:23:07.799",l:"INFO",c:"#86D9CA",m:"步骤执行完成"},
              ].map((log,i)=>(
                <div key={i}>
                  <span style={{color:"#6B7280"}}>{log.t} </span>
                  <span style={{color:log.c}}>[{log.l}] </span>
                  <span style={{color:"#D4D4D4"}}>{log.m}</span>
                </div>
              ))}
            </div>
          )}

          {resTab==="Mock 信息"&&(
            <div>
              <AlertBanner type="info">以下为本次执行时的 Mock 快照信息，仅供追踪溯源，不允许在此修改 Mock 配置。</AlertBanner>
              <SectionCard title="Mock 命中详情">
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,fontSize:12,marginBottom:12}}>
                  {[
                    {l:"经过 Mock",v:"是"},
                    {l:"Mock 应用",v:"订单中心 Mock"},
                    {l:"发布版本",v:"v2.3"},
                    {l:"命中接口",v:"POST /api/v1/orders"},
                  ].map(item=>(
                    <div key={item.l}>
                      <span style={{color:T.t4,marginRight:5}}>{item.l}：</span>
                      <span style={{color:T.t1,fontWeight:500}}>{item.v}</span>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:11,fontWeight:600,color:T.t4,marginBottom:6}}>匹配的 Mock 场景</div>
                  <div style={{padding:"8px 12px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:12}}>
                    <div style={{fontWeight:500,color:T.t1,marginBottom:3}}>创建订单 — 正常流程返回</div>
                    <div style={{fontSize:11,color:T.t3}}>匹配规则：Body.status === "PENDING" AND method === "POST"</div>
                  </div>
                </div>
                <button style={{fontSize:11,padding:"4px 10px",border:`1px solid ${T.border}`,borderRadius:5,background:"#fff",color:T.t2,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><ExternalLink size={10}/>前往 Mock 调用日志</button>
              </SectionCard>
            </div>
          )}

          {["前置结果","后置结果"].includes(resTab)&&(
            <div style={{fontSize:12,color:T.t3,textAlign:"center",padding:"32px 0"}}>
              <CheckCircle size={24} style={{color:T.success,margin:"0 auto 8px",display:"block"}}/>
              {resTab === "前置结果" ? "前置处理器执行成功（2 个）" : "无后置处理器"}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"10px 20px",borderTop:`1px solid ${T.border}`,flexShrink:0,display:"flex",gap:8,justifyContent:"space-between",alignItems:"center"}}>
          <button style={{fontSize:12,padding:"5px 12px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",color:T.t2,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><ExternalLink size={12}/>在接口管理中打开</button>
          <button onClick={onClose} style={{padding:"6px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>关闭</button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SceneResultDetailDrawer — 场景执行结果详情大抽屉
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_EXEC_STEPS: {id:string;name:string;type:string;status:ExecStatus;duration:string;depth:number}[] = [
  {id:"s1",name:"获取 access_token",  type:"ref-api",  status:"success",  duration:"234 ms",depth:0},
  {id:"s2",name:"查询商品库存",       type:"ref-api",  status:"success",  duration:"182 ms",depth:0},
  {id:"s3",name:"条件判断 — 库存充足",type:"condition",status:"success",  duration:"1 ms",  depth:0},
  {id:"s4",name:"创建订单",           type:"ref-api",  status:"success",  duration:"312 ms",depth:1},
  {id:"s5",name:"提取订单 ID",        type:"script",   status:"success",  duration:"3 ms",  depth:1},
  {id:"s6",name:"查询订单状态",       type:"ref-api",  status:"fail",     duration:"5001 ms",depth:0},
  {id:"s7",name:"等待 1s",           type:"wait",     status:"skip",     duration:"—",     depth:0},
  {id:"s8",name:"验证最终状态",       type:"assert",   status:"skip",     duration:"—",     depth:0},
];

export function SceneResultDetailDrawer({onClose}:{onClose:()=>void}){
  const [selectedStep,setSelectedStep]=useState<string|null>(null);
  const [showStepResult,setShowStepResult]=useState(false);
  const [activeTab,setActiveTab]=useState("步骤列表");
  const tabs=["步骤列表","运行日志","配置快照"];

  const totalSteps=MOCK_EXEC_STEPS.length;
  const successCount=MOCK_EXEC_STEPS.filter(s=>s.status==="success").length;
  const failCount=MOCK_EXEC_STEPS.filter(s=>s.status==="fail").length;
  const skipCount=MOCK_EXEC_STEPS.filter(s=>s.status==="skip").length;

  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.22)",zIndex:1000}}/>
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:940,zIndex:1001,background:"#fff",boxShadow:"-4px 0 32px rgba(0,0,0,0.14)",display:"flex",flexDirection:"column"}}>

        {/* Header */}
        <div style={{flexShrink:0,borderBottom:`1px solid ${T.border}`,background:"#FAFBFE"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 24px 10px"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontSize:15,fontWeight:700,color:T.t1}}>用户下单完整流程 v2.1</span>
                <ExecStatusBadge status="fail"/>
                <span style={{fontSize:11,color:T.t4}}>执行 ID: run_20260731_083</span>
              </div>
              <div style={{display:"flex",gap:16,fontSize:12,color:T.t3}}>
                <span><span style={{color:T.t4}}>执行人：</span>张工</span>
                <span><span style={{color:T.t4}}>开始时间：</span>2026-07-31 14:23:07</span>
                <span><span style={{color:T.t4}}>总耗时：</span><strong style={{color:T.t1}}>5.733 s</strong></span>
                <span><span style={{color:T.t4}}>运行环境：</span>测试环境</span>
                <span><span style={{color:T.t4}}>Runner：</span>Node-01</span>
              </div>
            </div>
            <div style={{flex:1}}/>
            <div style={{display:"flex",gap:8}}>
              <button style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:12,color:T.t2,cursor:"pointer"}}><Download size={12}/>下载报告</button>
              <button style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",border:"none",borderRadius:7,background:T.primary,color:"#fff",fontSize:12,fontWeight:500,cursor:"pointer"}}><RotateCcw size={12}/>重新执行</button>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:4}}><X size={16}/></button>
          </div>

          {/* Step summary stats */}
          <div style={{display:"flex",gap:0,padding:"0 24px 10px"}}>
            {[
              {label:"总步骤",value:totalSteps,color:T.t1},
              {label:"成功",value:successCount,color:T.success},
              {label:"失败",value:failCount,color:T.danger},
              {label:"跳过",value:skipCount,color:T.warning},
            ].map((s,i)=>(
              <div key={s.label} style={{display:"flex",alignItems:"center",gap:6,marginRight:20}}>
                {i>0&&<span style={{width:1,height:16,background:T.border,marginRight:20}}/>}
                <span style={{fontSize:22,fontWeight:800,color:s.color}}>{s.value}</span>
                <span style={{fontSize:12,color:T.t3}}>{s.label}</span>
              </div>
            ))}
            <div style={{flex:1}}/>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <div style={{width:160,height:6,borderRadius:3,background:T.border,overflow:"hidden",display:"flex"}}>
                <div style={{width:`${(successCount/totalSteps)*100}%`,background:T.success}}/>
                <div style={{width:`${(failCount/totalSteps)*100}%`,background:T.danger}}/>
                <div style={{width:`${(skipCount/totalSteps)*100}%`,background:T.warning}}/>
              </div>
              <span style={{fontSize:11,color:T.t3}}>{Math.round((successCount/totalSteps)*100)}% 通过</span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{display:"flex",borderTop:`1px solid ${T.border}`,padding:"0 24px"}}>
            {tabs.map(t=>(
              <button key={t} onClick={()=>setActiveTab(t)} style={{height:36,padding:"0 14px",border:"none",borderBottom:`2px solid ${activeTab===t?T.primary:"transparent"}`,background:"transparent",fontSize:12,fontWeight:500,color:activeTab===t?T.primary:T.t3,cursor:"pointer"}}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>

          {activeTab==="步骤列表"&&(
            <div style={{flex:1,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`,position:"sticky",top:0}}>
                    {["#","步骤名称","类型","耗时","状态",""].map((h,i)=>(
                      <th key={i} style={{padding:"7px 16px",textAlign:i===3?"right":"left",fontSize:11,fontWeight:600,color:T.t3}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_EXEC_STEPS.map((step,i)=>{
                    const cfg2=STEP_CFG[step.type]||{label:step.type,color:T.t3,bg:T.bg,icon:Settings};
                    const Icon2=cfg2.icon;
                    const isSelected=selectedStep===step.id;
                    return(
                      <tr key={step.id}
                        onClick={()=>{setSelectedStep(step.id);setShowStepResult(true);}}
                        style={{borderBottom:`1px solid ${T.border}`,background:isSelected?`${T.primary}08`:step.status==="fail"?"#FFF5F5":step.depth>0?"#FAFBFE":"#fff",cursor:"pointer"}}
                        onMouseEnter={e=>{if(!isSelected)e.currentTarget.style.background=step.depth>0?"#F2F4FF":"#F5F7FF";}}
                        onMouseLeave={e=>{e.currentTarget.style.background=isSelected?`${T.primary}08`:step.status==="fail"?"#FFF5F5":step.depth>0?"#FAFBFE":"#fff";}}>
                        <td style={{padding:"10px 16px",color:T.t4,width:40}}>{i+1}</td>
                        <td style={{padding:"10px 16px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            {step.depth>0&&<div style={{width:16,height:16,borderLeft:`2px solid ${T.border}`,borderBottom:`2px solid ${T.border}`,marginLeft:8,flexShrink:0}}/>}
                            <div style={{width:22,height:22,borderRadius:5,background:cfg2.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              <Icon2 size={11} style={{color:cfg2.color}}/>
                            </div>
                            <span style={{fontWeight:500,color:T.t1}}>{step.name}</span>
                          </div>
                        </td>
                        <td style={{padding:"10px 16px"}}><StepTypeBadge type={step.type}/></td>
                        <td style={{padding:"10px 16px",textAlign:"right",fontFamily:"'JetBrains Mono',monospace",color:step.status==="fail"?T.danger:T.t2}}>{step.duration}</td>
                        <td style={{padding:"10px 16px"}}><ExecStatusBadge status={step.status}/></td>
                        <td style={{padding:"10px 16px",textAlign:"right"}}>
                          <button style={{padding:"3px 10px",border:`1px solid ${T.border}`,borderRadius:5,background:"#fff",fontSize:11,color:T.t2,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>
                            <List size={10}/>详情
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab==="运行日志"&&(
            <div style={{flex:1,overflowY:"auto",padding:"16px 24px"}}>
              <div style={{padding:12,border:`1px solid ${T.border}`,borderRadius:8,background:"#111",fontFamily:"'JetBrains Mono',monospace",fontSize:11,lineHeight:1.9}}>
                {[
                  {t:"14:23:07.000",l:"INFO",c:"#86D9CA",m:"场景执行开始: 用户下单完整流程 v2.1"},
                  {t:"14:23:07.001",l:"INFO",c:"#86D9CA",m:"运行环境: 测试环境 | Runner: Node-01"},
                  {t:"14:23:07.002",l:"INFO",c:"#86D9CA",m:"[步骤 1/8] 获取 access_token - 开始"},
                  {t:"14:23:07.236",l:"PASS",c:"#52D273",m:"[步骤 1/8] 获取 access_token - 成功 (234ms)"},
                  {t:"14:23:07.237",l:"INFO",c:"#86D9CA",m:"[步骤 2/8] 查询商品库存 - 开始"},
                  {t:"14:23:07.419",l:"PASS",c:"#52D273",m:"[步骤 2/8] 查询商品库存 - 成功 (182ms)"},
                  {t:"14:23:07.420",l:"INFO",c:"#86D9CA",m:"[步骤 3/8] 条件判断 - 库存充足: True"},
                  {t:"14:23:07.421",l:"INFO",c:"#86D9CA",m:"[步骤 4/8] 创建订单 - 开始"},
                  {t:"14:23:07.733",l:"PASS",c:"#52D273",m:"[步骤 4/8] 创建订单 - 成功 (312ms)"},
                  {t:"14:23:07.734",l:"INFO",c:"#86D9CA",m:"[步骤 5/8] 提取订单 ID - 成功 (3ms)"},
                  {t:"14:23:07.737",l:"INFO",c:"#86D9CA",m:"[步骤 6/8] 查询订单状态 - 开始"},
                  {t:"14:23:12.738",l:"FAIL",c:"#F87171",m:"[步骤 6/8] 查询订单状态 - 超时 (5001ms) → 中止场景"},
                  {t:"14:23:12.739",l:"SKIP",c:"#FBBF24",m:"[步骤 7/8] 等待 1s - 跳过（上游失败）"},
                  {t:"14:23:12.740",l:"SKIP",c:"#FBBF24",m:"[步骤 8/8] 验证最终状态 - 跳过（上游失败）"},
                  {t:"14:23:12.741",l:"FAIL",c:"#F87171",m:"场景执行结束: 失败 (总耗时: 5.733s)"},
                ].map((log,i)=>(
                  <div key={i}>
                    <span style={{color:"#6B7280"}}>{log.t} </span>
                    <span style={{color:log.c}}>[{log.l}] </span>
                    <span style={{color:"#D4D4D4"}}>{log.m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab==="配置快照"&&(
            <div style={{flex:1,overflowY:"auto",padding:"16px 24px"}}>
              <AlertBanner type="info">以下为本次执行时的配置快照，不反映后续修改。</AlertBanner>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[
                  {l:"场景版本",v:"v2.1 (Snapshot)"},
                  {l:"运行环境",v:"测试环境"},
                  {l:"变量集",v:"默认变量集"},
                  {l:"测试数据",v:"用户测试数据集 v2"},
                  {l:"Runner 节点",v:"Node-01 (192.168.1.101)"},
                  {l:"失败处理策略",v:"立即停止"},
                  {l:"保存请求响应",v:"是"},
                  {l:"Mock 版本",v:"v2.3 (订单中心 Mock)"},
                ].map(item=>(
                  <div key={item.l} style={{padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:12}}>
                    <div style={{color:T.t4,marginBottom:2}}>{item.l}</div>
                    <div style={{fontWeight:500,color:T.t1}}>{item.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"10px 24px",borderTop:`1px solid ${T.border}`,flexShrink:0,display:"flex",gap:8,justifyContent:"flex-end",background:"#FAFBFE"}}>
          <button onClick={onClose} style={{padding:"6px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>关闭</button>
        </div>
      </div>

      {/* Nested step result drawer */}
      {showStepResult&&selectedStep&&(()=>{
        const step=MOCK_EXEC_STEPS.find(s=>s.id===selectedStep);
        if(!step)return null;
        return(
          <StepResultDrawer
            onClose={()=>setShowStepResult(false)}
            stepName={step.name}
            stepType={step.type}
            execStatus={step.status}/>
        );
      })()}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. UnsavedSceneConfirm — 未保存修改确认
// ─────────────────────────────────────────────────────────────────────────────

export function UnsavedSceneConfirm({onClose,onDiscard}:{onClose:()=>void;onDiscard:()=>void}){
  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:1100}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:1101,background:"#fff",borderRadius:10,width:400,boxShadow:"0 8px 40px rgba(0,0,0,0.16)",padding:"24px 24px 20px"}}>
        <div style={{display:"flex",gap:12,marginBottom:18}}>
          <div style={{width:38,height:38,borderRadius:8,background:"#FFF3E8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <AlertTriangle size={18} style={{color:T.warning}}/>
          </div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:T.t1,marginBottom:6}}>存在未保存的场景修改</div>
            <div style={{fontSize:13,color:T.t2,lineHeight:1.65}}>
              以下内容尚未保存：
              <ul style={{margin:"6px 0 0 16px",padding:0,color:T.t2,lineHeight:2}}>
                <li>新增了 2 个步骤</li>
                <li>修改了"创建订单"步骤配置</li>
                <li>更新了断言规则</li>
              </ul>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"7px 16px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>继续编辑</button>
          <button onClick={()=>{onDiscard();onClose();}}
            style={{padding:"7px 18px",border:"none",borderRadius:7,background:T.warning,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            <AlertTriangle size={12}/>放弃修改
          </button>
          <button style={{padding:"7px 18px",border:"none",borderRadius:7,background:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            <Save size={12}/>保存并离开
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. SceneExtrasShowcase — 主展示包装器
// ─────────────────────────────────────────────────────────────────────────────

type OverlayKey = "none"|"import-step"|"add-step"|"step-config"|"run-config"|"result-detail"|"unsaved-confirm";

const OVERLAY_LIST: {key:OverlayKey;label:string}[] = [
  {key:"import-step",    label:"导入步骤"},
  {key:"add-step",       label:"添加步骤菜单"},
  {key:"step-config",    label:"步骤配置抽屉"},
  {key:"run-config",     label:"运行配置"},
  {key:"result-detail",  label:"执行结果详情"},
  {key:"unsaved-confirm",label:"未保存确认"},
];

export function SceneExtrasShowcase(){
  const [overlay,setOverlay]=useState<OverlayKey>("none");
  const [panelOpen,setPanelOpen]=useState(false);

  return(
    <div style={{position:"relative",flex:1,display:"flex",overflow:"hidden"}}>
      {/* Background: real scene management */}
      <SceneManagement/>

      {/* Floating design preview control */}
      <div style={{position:"fixed",bottom:52,right:16,zIndex:500,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
        {panelOpen&&(
          <div style={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",boxShadow:"0 4px 16px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column",gap:4,minWidth:160}}>
            <div style={{fontSize:11,fontWeight:700,color:T.t4,marginBottom:4,letterSpacing:0.5}}>设计预览</div>
            {OVERLAY_LIST.map(item=>(
              <button key={item.key} onClick={()=>{setOverlay(item.key);setPanelOpen(false);}}
                style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:6,border:`1px solid ${overlay===item.key?T.primary:T.border}`,background:overlay===item.key?`${T.primary}0D`:"#fff",fontSize:12,color:overlay===item.key?T.primary:T.t2,cursor:"pointer",textAlign:"left"}}>
                <ChevronRight size={11}/>{item.label}
              </button>
            ))}
            <div style={{height:1,background:T.border,margin:"4px 0"}}/>
            <button onClick={()=>{setOverlay("none");setPanelOpen(false);}}
              style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${T.border}`,background:"transparent",fontSize:11,color:T.t4,cursor:"pointer"}}>
              关闭当前弹窗
            </button>
          </div>
        )}
        <button onClick={()=>setPanelOpen(v=>!v)}
          style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",border:"none",borderRadius:8,background:T.primary,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 10px rgba(22,93,255,0.35)"}}>
          <Sparkles size={13}/>{panelOpen?"收起":"设计预览"}
        </button>
      </div>

      {/* Overlay components */}
      {overlay==="import-step"    &&<ImportStepDialog onClose={()=>setOverlay("none")}/>}
      {overlay==="add-step"       &&<AddStepMenuPanel onClose={()=>setOverlay("none")} onAdd={()=>setOverlay("none")}/>}
      {overlay==="step-config"    &&<StepConfigDrawer onClose={()=>setOverlay("none")}/>}
      {overlay==="run-config"     &&<SceneRunConfigDialog onClose={()=>setOverlay("none")}/>}
      {overlay==="result-detail"  &&<SceneResultDetailDrawer onClose={()=>setOverlay("none")}/>}
      {overlay==="unsaved-confirm"&&<UnsavedSceneConfirm onClose={()=>setOverlay("none")} onDiscard={()=>setOverlay("none")}/>}
    </div>
  );
}
