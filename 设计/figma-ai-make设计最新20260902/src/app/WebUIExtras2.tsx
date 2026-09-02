/**
 * WebUIExtras2.tsx — Web UI 自动化：步骤编辑 + 调试 设计稿
 * 第二阶段：第 7-12 项步骤编辑和调试相关设计
 */

import React, { useState } from "react";
import {
  X, Plus, Search, ChevronRight, Check, AlertTriangle,
  AlertCircle, Info, CheckCircle, XCircle, Loader2,
  Trash2, Save, GripVertical, Lock,
  Globe2, MousePointer, Type, Timer, Terminal, Upload,
  Monitor, Layers, ArrowRight, ExternalLink, Zap,
  Crosshair, Sparkles,
  Settings, Target,
  FolderOpen, FileText,
} from "lucide-react";
import { WebUIModule } from "./WebUIModule";
import {
  ElementEditorDrawer, LocatorVerifyDialog,
  ElementDetailDrawer, ElementReferenceDrawer,
  ImpactAnalysisDialog, QualityAnalysisDrawer,
} from "./WebUIExtras";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  cyan:"#0FC6C2",
  bg:"#F4F6FA",      border:"#E5E6EB",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};

// ─── WebUI step type config ───────────────────────────────────────────────────
type UIStepType = "click"|"input"|"navigate"|"wait"|"script"|"upload"|"switch-win";
const UI_STEP_CFG: Record<UIStepType,{label:string;color:string;bg:string;icon:React.ElementType;group:string}> = {
  "click":      {label:"点击",      color:T.success,  bg:"#E8FFEA",icon:MousePointer,group:"元素交互"},
  "input":      {label:"输入文本",  color:T.purple,   bg:"#F5E8FF",icon:Type,        group:"元素交互"},
  "navigate":   {label:"页面导航",  color:T.primary,  bg:"#E8F3FF",icon:Globe2,       group:"页面导航"},
  "wait":       {label:"等待",      color:T.warning,  bg:"#FFF3E8",icon:Timer,        group:"等待步骤"},
  "script":     {label:"JS 脚本",  color:"#F59E0B",  bg:"#FFFBEB",icon:Terminal,     group:"文件和脚本"},
  "upload":     {label:"上传文件",  color:T.cyan,     bg:"#E8FFFB",icon:Upload,       group:"文件和脚本"},
  "switch-win": {label:"切换窗口",  color:T.t2,       bg:"#F2F3F5",icon:Monitor,      group:"上下文切换"},
};

type UIStepState = "editing"|"saving"|"debug-running"|"debug-success"|"debug-fail"|"debug-timeout"|"debug-crash"|"locate-fail"|"runner-offline"|"cancelled";

// ─── Shared primitives ────────────────────────────────────────────────────────
function DemoBar<S extends string>({states,current,onChange,label="设计状态",bottom=0}:{
  states:{value:S;label:string}[];current:S;onChange:(v:S)=>void;label?:string;bottom?:number;
}){
  return(
    <div style={{position:"fixed",bottom,left:0,right:0,height:44,background:"#fff",borderTop:`2px solid ${current==="editing"||bottom>0?T.primary:T.purple}`,display:"flex",alignItems:"center",gap:6,padding:"0 16px",zIndex:9999,boxShadow:"0 -2px 12px rgba(0,0,0,0.1)"}}>
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

function SCard({title,children,action,compact}:{title:string;children:React.ReactNode;action?:React.ReactNode;compact?:boolean}){
  return(
    <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:compact?"6px 12px":"8px 14px",background:"#FAFBFE",borderBottom:`1px solid ${T.border}`}}>
        <span style={{fontSize:12,fontWeight:600,color:T.t2}}>{title}</span>
        {action}
      </div>
      <div style={{padding:compact?10:14}}>{children}</div>
    </div>
  );
}

function FL({children,required,tip}:{children:React.ReactNode;required?:boolean;tip?:string}){
  return(
    <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:5,display:"flex",alignItems:"center",gap:4}}>
      {children}{required&&<span style={{color:T.danger}}>*</span>}
      {tip&&<span title={tip} style={{color:T.t4,cursor:"help",lineHeight:0}}><Info size={11}/></span>}
    </div>
  );
}

function FInput({value,onChange,placeholder,mono,disabled,error,width,type}:{value?:string;onChange?:(v:string)=>void;placeholder?:string;mono?:boolean;disabled?:boolean;error?:boolean;width?:number|string;type?:string}){
  return(
    <input type={type||"text"} value={value} onChange={e=>onChange?.(e.target.value)} placeholder={placeholder} disabled={disabled}
      style={{width:width||"100%",boxSizing:"border-box",height:34,padding:"0 10px",border:`1.5px solid ${error?T.danger:T.border}`,borderRadius:7,fontSize:12,fontFamily:mono?"'JetBrains Mono',monospace":"inherit",color:T.t1,outline:"none",background:disabled?"#F7F8FA":"#fff"}}/>
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

function UIStepBadge({type}:{type:UIStepType}){
  const cfg=UI_STEP_CFG[type];
  const Icon=cfg.icon;
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:5,background:cfg.bg,fontSize:11,fontWeight:700,color:cfg.color}}>
      <Icon size={10}/>{cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AddStepModal — 新增步骤弹窗（两步走：选类型 → 填配置）
// ─────────────────────────────────────────────────────────────────────────────
type StepTypeKey = "navigate"|"click"|"input"|"wait"|"assert"|"screenshot"|"script"|"upload";
type AddStepView = "type-select"|"click-config"|"input-config"|"navigate-config"|"wait-config"|"assert-config"|"screenshot-config"|"script-config"|"upload-config";
type ElemInputMode = "manual"|"library";

const STEP_TYPE_CARDS: {key:StepTypeKey;icon:React.ElementType;label:string;desc:string;color:string;bg:string}[] = [
  {key:"navigate",  icon:Globe2,        label:"打开页面",   desc:"导航到指定 URL",          color:"#165DFF",bg:"#E8F3FF"},
  {key:"click",     icon:MousePointer,  label:"点击元素",   desc:"点击页面上的目标元素",    color:"#7816FF",bg:"#F5E8FF"},
  {key:"input",     icon:Type,          label:"输入文字",   desc:"在输入框中填入内容",      color:"#0FC6C2",bg:"#E8FFFE"},
  {key:"wait",      icon:Timer,         label:"等待",       desc:"等待元素出现或固定时长",  color:"#FF7D00",bg:"#FFF3E8"},
  {key:"assert",    icon:CheckCircle,   label:"断言验证",   desc:"验证页面元素或内容",      color:"#00B42A",bg:"#E8FFEA"},
  {key:"screenshot",icon:Monitor,       label:"截图",       desc:"对当前页面或元素截图",    color:"#86909C",bg:"#F2F3F5"},
  {key:"script",    icon:Terminal,      label:"执行脚本",   desc:"运行自定义 JavaScript",   color:"#1D2129",bg:"#F2F3F5"},
  {key:"upload",    icon:Upload,        label:"文件上传",   desc:"向文件控件上传本地文件",  color:"#165DFF",bg:"#E8F3FF"},
];

const VIEW_TO_TYPE: Record<AddStepView,StepTypeKey|null> = {
  "type-select":null,"click-config":"click","input-config":"input","navigate-config":"navigate",
  "wait-config":"wait","assert-config":"assert","screenshot-config":"screenshot",
  "script-config":"script","upload-config":"upload",
};

const ADD_STEP_DEMO:{value:AddStepView;label:string}[] = [
  {value:"type-select",      label:"选步骤类型"},
  {value:"navigate-config",  label:"打开页面配置"},
  {value:"click-config",     label:"点击元素配置"},
  {value:"input-config",     label:"输入文字配置"},
  {value:"wait-config",      label:"等待配置"},
  {value:"assert-config",    label:"断言配置"},
  {value:"screenshot-config",label:"截图配置"},
  {value:"script-config",    label:"脚本配置"},
  {value:"upload-config",    label:"文件上传配置"},
];

const ADD_STEP_LIB = [
  {id:"e1",name:"登录按钮",    page:"登录页",  loc:"role:button[name='登录']"},
  {id:"e2",name:"用户名输入框", page:"登录页",  loc:"id:#username"},
  {id:"e3",name:"密码输入框",   page:"登录页",  loc:"id:#password"},
  {id:"e4",name:"搜索框",       page:"商品列表",loc:"placeholder:请输入商品名称"},
  {id:"e5",name:"加入购物车",   page:"商品列表",loc:"css:.add-cart-btn"},
];

export function AddStepModal({onClose}:{onClose:()=>void}){
  const [view,setView]=useState<AddStepView>("type-select");
  const [elemMode,setElemMode]=useState<ElemInputMode>("manual");
  const [locatorVal,setLocatorVal]=useState("");
  const [stepName,setStepName]=useState("");
  const [inputVal,setInputVal]=useState("");
  const [url,setUrl]=useState("");
  const [waitMs,setWaitMs]=useState("2000");
  const [waitType,setWaitType]=useState<"fixed"|"element">("element");
  const [libSearch,setLibSearch]=useState("");
  const [selectedLib,setSelectedLib]=useState<string|null>(null);
  const [scriptVal,setScriptVal]=useState("// 在此编写 JavaScript\nreturn document.title;");
  const [assertTarget,setAssertTarget]=useState<"text"|"attr"|"visible">("text");

  const currentType = VIEW_TO_TYPE[view];
  const typeCard = STEP_TYPE_CARDS.find(c=>c.key===currentType);
  const filteredLib = ADD_STEP_LIB.filter(e=>
    !libSearch||e.name.includes(libSearch)||e.page.includes(libSearch)
  );

  const autoName = currentType
    ? (currentType==="navigate"?`打开页面${url?` · ${url.slice(0,20)}`:""}`:
       currentType==="click"?`点击${selectedLib?ADD_STEP_LIB.find(e=>e.id===selectedLib)?.name||"元素":"元素"}`:
       currentType==="input"?`输入「${inputVal.slice(0,10)||"…"}」`:
       currentType==="wait"?`等待${waitType==="fixed"?` ${waitMs}ms`:"元素出现"}`:
       currentType==="assert"?"验证元素内容":
       currentType==="screenshot"?"截图":
       currentType==="script"?"执行脚本":
       currentType==="upload"?"上传文件":"新步骤")
    : "";

  const isConfigView = view!=="type-select";

  // Element selector sub-section (used in click/input/assert/screenshot steps)
  const needsElement = currentType==="click"||currentType==="input"||currentType==="assert"||currentType==="screenshot";

  const ElementSection = (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>
        目标元素 <span style={{color:T.danger}}>*</span>
      </div>
      {/* Mode switcher */}
      <div style={{display:"flex",gap:0,marginBottom:8,border:`1px solid ${T.border}`,borderRadius:7,overflow:"hidden",width:"fit-content"}}>
        {([["manual","手动输入定位器"],["library","从元素库选择"]] as const).map(([m,label])=>(
          <button key={m} onClick={()=>setElemMode(m)}
            style={{padding:"5px 14px",border:"none",fontSize:12,fontWeight:elemMode===m?600:400,cursor:"pointer",background:elemMode===m?T.primary:"#fff",color:elemMode===m?"#fff":T.t2}}>
            {label}
          </button>
        ))}
      </div>

      {elemMode==="manual"&&(
        <div>
          <div style={{display:"flex",gap:6,marginBottom:4}}>
            <select style={{height:32,padding:"0 8px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t2,background:"#fff"}}>
              <option>CSS Selector</option><option>XPath</option><option>ID</option><option>文本内容</option><option>Role</option>
            </select>
            <input value={locatorVal} onChange={e=>setLocatorVal(e.target.value)}
              placeholder="输入定位表达式，如 #login-btn 或 .submit"
              style={{flex:1,height:32,padding:"0 10px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,fontFamily:"'JetBrains Mono',monospace",outline:"none"}}
              onFocus={e=>e.currentTarget.style.borderColor=T.primary}
              onBlur={e=>e.currentTarget.style.borderColor=T.border}
            />
            <button style={{height:32,padding:"0 12px",border:`1px solid ${T.primary}`,borderRadius:6,fontSize:12,color:T.primary,background:`${T.primary}08`,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",gap:4}}>
              <Zap size={11}/>验证
            </button>
          </div>
          <div style={{fontSize:11,color:T.t4}}>支持 CSS、XPath、ID、文本、Role 等定位策略</div>
        </div>
      )}

      {elemMode==="library"&&(
        <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
          {/* Search */}
          <div style={{padding:"8px 10px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:6}}>
            <Search size={13} style={{color:T.t4,flexShrink:0}}/>
            <input value={libSearch} onChange={e=>setLibSearch(e.target.value)}
              placeholder="搜索元素名称或页面…"
              style={{flex:1,border:"none",outline:"none",fontSize:12,color:T.t1,background:"transparent"}}
            />
          </div>
          {/* List */}
          <div style={{maxHeight:160,overflowY:"auto"}}>
            {filteredLib.map(el=>(
              <div key={el.id} onClick={()=>setSelectedLib(el.id)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",cursor:"pointer",background:selectedLib===el.id?`${T.primary}08`:"#fff",borderBottom:`1px solid ${T.border}`}}
                onMouseEnter={e=>selectedLib!==el.id&&(e.currentTarget.style.background="#F4F6FA")}
                onMouseLeave={e=>selectedLib!==el.id&&(e.currentTarget.style.background="#fff")}>
                <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${selectedLib===el.id?T.primary:T.t4}`,background:selectedLib===el.id?T.primary:"#fff",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {selectedLib===el.id&&<div style={{width:5,height:5,borderRadius:"50%",background:"#fff"}}/>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:500,color:T.t1}}>{el.name}</div>
                  <div style={{fontSize:10,color:T.t4,fontFamily:"monospace"}}>{el.page} · {el.loc}</div>
                </div>
                {selectedLib===el.id&&<Check size={12} style={{color:T.primary,flexShrink:0}}/>}
              </div>
            ))}
            {filteredLib.length===0&&<div style={{padding:"16px",textAlign:"center",fontSize:12,color:T.t4}}>未找到匹配元素</div>}
          </div>
        </div>
      )}
    </div>
  );

  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.18)",zIndex:1100}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:1101,background:"#fff",borderRadius:12,width:isConfigView?580:620,maxHeight:"84vh",display:"flex",flexDirection:"column",boxShadow:"0 12px 48px rgba(0,0,0,0.16)"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          {isConfigView&&(
            <button onClick={()=>setView("type-select")} style={{width:28,height:28,border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <ChevronRight size={14} style={{transform:"rotate(180deg)",color:T.t3}}/>
            </button>
          )}
          {typeCard&&(
            <div style={{width:32,height:32,borderRadius:8,background:typeCard.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <typeCard.icon size={15} style={{color:typeCard.color}}/>
            </div>
          )}
          {!typeCard&&<div style={{width:32,height:32,borderRadius:8,background:"#EEF0FA",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Plus size={15} style={{color:T.primary}}/></div>}
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:T.t1}}>
              {isConfigView?`${typeCard?.label} 步骤配置`:"添加测试步骤"}
            </div>
            <div style={{fontSize:11,color:T.t3,marginTop:1}}>
              {isConfigView?"填写步骤基本配置，更多高级选项可在步骤详情中编辑":"选择要添加的步骤类型"}
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0}}><X size={15}/></button>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"18px 20px",minHeight:0}}>

          {/* ── Step 1: Type Select ── */}
          {view==="type-select"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {STEP_TYPE_CARDS.map(card=>(
                <button key={card.key}
                  onClick={()=>setView(`${card.key}-config` as AddStepView)}
                  style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px",border:`1.5px solid ${T.border}`,borderRadius:10,background:"#fff",cursor:"pointer",textAlign:"left",transition:"all 0.12s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=card.color;e.currentTarget.style.background=card.bg;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background="#fff";}}>
                  <div style={{width:36,height:36,borderRadius:8,background:card.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <card.icon size={16} style={{color:card.color}}/>
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:T.t1,marginBottom:3}}>{card.label}</div>
                    <div style={{fontSize:11,color:T.t3,lineHeight:1.5}}>{card.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Step 2: Navigate ── */}
          {view==="navigate-config"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>目标 URL <span style={{color:T.danger}}>*</span></div>
                <input value={url} onChange={e=>setUrl(e.target.value)}
                  placeholder="https://example.com/login 或 {{env.baseUrl}}/login"
                  style={{width:"100%",height:34,padding:"0 10px",border:`1px solid ${T.border}`,borderRadius:7,fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box"}}
                  onFocus={e=>e.currentTarget.style.borderColor=T.primary}
                  onBlur={e=>e.currentTarget.style.borderColor=T.border}
                />
                <div style={{fontSize:11,color:T.t4,marginTop:4}}>支持变量 {"{{env.baseUrl}}"}，在运行时替换为环境变量值</div>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>等待页面加载</div>
                <select style={{height:32,padding:"0 8px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,background:"#fff",width:"100%"}}>
                  <option>等待 DOMContentLoaded</option><option>等待 networkidle</option><option>不等待，立即继续</option>
                </select>
              </div>
            </div>
          )}

          {/* ── Step 2: Click ── */}
          {view==="click-config"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {ElementSection}
              <div>
                <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>点击方式</div>
                <div style={{display:"flex",gap:8}}>
                  {["单击","双击","右键"].map(t=>(
                    <button key={t} style={{padding:"5px 16px",border:`1.5px solid ${t==="单击"?T.primary:T.border}`,borderRadius:6,fontSize:12,fontWeight:t==="单击"?600:400,color:t==="单击"?T.primary:T.t2,background:t==="单击"?`${T.primary}08`:"#fff",cursor:"pointer"}}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Input ── */}
          {view==="input-config"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {ElementSection}
              <div>
                <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>输入内容 <span style={{color:T.danger}}>*</span></div>
                <input value={inputVal} onChange={e=>setInputVal(e.target.value)}
                  placeholder="输入文字，或使用 {{变量名}} 引用变量"
                  style={{width:"100%",height:34,padding:"0 10px",border:`1px solid ${T.border}`,borderRadius:7,fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box"}}
                  onFocus={e=>e.currentTarget.style.borderColor=T.primary}
                  onBlur={e=>e.currentTarget.style.borderColor=T.border}
                />
              </div>
              <div style={{display:"flex",gap:6}}>
                <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:T.t2,cursor:"pointer"}}>
                  <input type="checkbox" style={{accentColor:T.primary}}/>清空后输入
                </label>
                <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:T.t2,cursor:"pointer",marginLeft:12}}>
                  <input type="checkbox" style={{accentColor:T.primary}}/>输入后按 Enter
                </label>
              </div>
            </div>
          )}

          {/* ── Step 2: Wait ── */}
          {view==="wait-config"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:8}}>等待方式</div>
                <div style={{display:"flex",gap:0,border:`1px solid ${T.border}`,borderRadius:7,overflow:"hidden",width:"fit-content"}}>
                  {([["element","等待元素出现"],["fixed","固定等待时长"]] as const).map(([t,label])=>(
                    <button key={t} onClick={()=>setWaitType(t)}
                      style={{padding:"6px 16px",border:"none",fontSize:12,fontWeight:waitType===t?600:400,cursor:"pointer",background:waitType===t?T.primary:"#fff",color:waitType===t?"#fff":T.t2}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {waitType==="element"&&ElementSection}
              {waitType==="fixed"&&(
                <div>
                  <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>等待时长（毫秒）</div>
                  <input value={waitMs} onChange={e=>setWaitMs(e.target.value)} type="number"
                    style={{width:160,height:34,padding:"0 10px",border:`1px solid ${T.border}`,borderRadius:7,fontSize:13,color:T.t1,outline:"none"}}
                    onFocus={e=>e.currentTarget.style.borderColor=T.primary}
                    onBlur={e=>e.currentTarget.style.borderColor=T.border}
                  />
                  <div style={{fontSize:11,color:T.t4,marginTop:4}}>建议不超过 10000ms，避免用例执行超时</div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Assert ── */}
          {view==="assert-config"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {ElementSection}
              <div>
                <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>断言类型</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {([["text","文本内容"],["attr","属性值"],["visible","元素可见"]] as const).map(([t,label])=>(
                    <button key={t} onClick={()=>setAssertTarget(t)}
                      style={{padding:"5px 14px",border:`1.5px solid ${assertTarget===t?T.success:T.border}`,borderRadius:6,fontSize:12,fontWeight:assertTarget===t?600:400,color:assertTarget===t?T.success:T.t2,background:assertTarget===t?"#E8FFEA":"#fff",cursor:"pointer"}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {assertTarget!=="visible"&&(
                <div>
                  <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>期望值</div>
                  <input placeholder={assertTarget==="text"?"期望的文本内容":"期望的属性值"}
                    style={{width:"100%",height:34,padding:"0 10px",border:`1px solid ${T.border}`,borderRadius:7,fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box"}}
                    onFocus={e=>e.currentTarget.style.borderColor=T.success}
                    onBlur={e=>e.currentTarget.style.borderColor=T.border}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Screenshot ── */}
          {view==="screenshot-config"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>截图范围</div>
                <div style={{display:"flex",gap:8}}>
                  {["整个页面","指定元素","视口区域"].map((t,i)=>(
                    <button key={t} style={{padding:"5px 14px",border:`1.5px solid ${i===0?T.primary:T.border}`,borderRadius:6,fontSize:12,fontWeight:i===0?600:400,color:i===0?T.primary:T.t2,background:i===0?`${T.primary}08`:"#fff",cursor:"pointer"}}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={{padding:"10px 14px",border:`1px solid ${T.border}`,borderRadius:8,background:"#FAFAFA",fontSize:12,color:T.t3,lineHeight:1.7}}>
                截图将保存到执行记录中，可在报告页查看。如配置了视觉基线对比，本次截图将与基线比对。
              </div>
            </div>
          )}

          {/* ── Step 2: Script ── */}
          {view==="script-config"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>脚本内容 <span style={{color:T.danger}}>*</span></div>
                <textarea value={scriptVal} onChange={e=>setScriptVal(e.target.value)}
                  style={{width:"100%",height:120,padding:"10px",border:`1px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,fontFamily:"'JetBrains Mono',monospace",outline:"none",resize:"none",boxSizing:"border-box",lineHeight:1.6}}
                  onFocus={e=>e.currentTarget.style.borderColor=T.primary}
                  onBlur={e=>e.currentTarget.style.borderColor=T.border}
                />
                <div style={{fontSize:11,color:T.t4,marginTop:4}}>可使用 <code style={{fontFamily:"monospace",background:"#F2F3F5",padding:"1px 4px",borderRadius:3}}>page</code>、<code style={{fontFamily:"monospace",background:"#F2F3F5",padding:"1px 4px",borderRadius:3}}>context</code> 对象，return 值将存入变量</div>
              </div>
            </div>
          )}

          {/* ── Step 2: Upload ── */}
          {view==="upload-config"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {ElementSection}
              <div>
                <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>上传文件来源</div>
                <div style={{display:"flex",gap:8}}>
                  {["平台文件","本地路径变量"].map((t,i)=>(
                    <button key={t} style={{padding:"5px 14px",border:`1.5px solid ${i===0?T.primary:T.border}`,borderRadius:6,fontSize:12,fontWeight:i===0?600:400,color:i===0?T.primary:T.t2,background:i===0?`${T.primary}08`:"#fff",cursor:"pointer"}}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",border:`1.5px dashed ${T.border}`,borderRadius:8,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.primary} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                <Upload size={18} style={{color:T.t4}}/>
                <div>
                  <div style={{fontSize:13,color:T.t2,fontWeight:500}}>点击上传或拖拽文件到此处</div>
                  <div style={{fontSize:11,color:T.t4,marginTop:2}}>支持所有格式，最大 50MB</div>
                </div>
              </div>
            </div>
          )}

          {/* Step name (shown in all config views) */}
          {isConfigView&&(
            <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
              <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>步骤名称（可选）</div>
              <input value={stepName} onChange={e=>setStepName(e.target.value)}
                placeholder={autoName||"留空将自动生成步骤名称"}
                style={{width:"100%",height:34,padding:"0 10px",border:`1px solid ${T.border}`,borderRadius:7,fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box"}}
                onFocus={e=>e.currentTarget.style.borderColor=T.primary}
                onBlur={e=>e.currentTarget.style.borderColor=T.border}
              />
              {!stepName&&autoName&&<div style={{fontSize:11,color:T.t4,marginTop:3}}>自动命名：{autoName}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        {isConfigView&&(
          <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",gap:8,justifyContent:"flex-end",background:"#fff"}}>
            <button onClick={()=>setView("type-select")} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>返回</button>
            <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>取消</button>
            <button onClick={onClose} style={{padding:"7px 22px",border:"none",borderRadius:7,background:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
              <Check size={13}/>添加步骤
            </button>
          </div>
        )}
      </div>

      <DemoBar states={ADD_STEP_DEMO} current={view} onChange={setView} label="新增步骤状态"/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. ElementSelectorPanel — 目标元素选择（元素库 / 临时定位器）
// ─────────────────────────────────────────────────────────────────────────────
type ElemSrcMode = "library"|"inline";
type ElemSrcState = "library-empty"|"library-selected"|"inline-locator"|"override"|"element-changed"|"element-deleted"|"no-permission";

const ELEM_SRC_DEMO:{value:ElemSrcState;label:string}[] = [
  {value:"library-empty",    label:"未选择元素"},
  {value:"library-selected", label:"已选元素"},
  {value:"inline-locator",   label:"临时定位器"},
  {value:"override",         label:"覆盖元素定位器"},
  {value:"element-changed",  label:"元素已变更"},
  {value:"element-deleted",  label:"元素已删除"},
  {value:"no-permission",    label:"无权限"},
];

const MOCK_LIB_ELEMENTS = [
  {id:"el-001",name:"用户名输入框",page:"登录页",locType:"ID",  lastResult:"pass",  refCount:14,disabled:false},
  {id:"el-002",name:"密码输入框",  page:"登录页",locType:"ID",  lastResult:"pass",  refCount:12,disabled:false},
  {id:"el-003",name:"登录按钮",    page:"登录页",locType:"CSS", lastResult:"pass",  refCount:20,disabled:false},
  {id:"el-004",name:"欢迎提示文字",page:"首页",  locType:"Text",lastResult:"warn",  refCount:3, disabled:false},
  {id:"el-005",name:"购物车图标",  page:"首页",  locType:"CSS", lastResult:"fail",  refCount:8, disabled:true},
  {id:"el-006",name:"搜索输入框",  page:"首页",  locType:"ID",  lastResult:null,    refCount:5, disabled:false},
];

function VerifyBadge({result}:{result:"pass"|"fail"|"warn"|null}){
  if(!result) return <span style={{fontSize:10,color:T.t4}}>未验证</span>;
  const m={pass:{c:T.success,l:"通过"},fail:{c:T.danger,l:"失败"},warn:{c:T.warning,l:"多个匹配"}}[result];
  return <span style={{fontSize:10,fontWeight:600,color:m.c}}>{m.l}</span>;
}

interface ElementSelectorPanelProps {
  demoState: ElemSrcState;
  onFrameShadow?: ()=>void;
}

function ElementSelectorPanel({demoState,onFrameShadow}:ElementSelectorPanelProps){
  const [mode,setMode]=useState<ElemSrcMode>(
    demoState==="inline-locator"||demoState==="override"?"inline":"library"
  );
  const [search,setSearch]=useState("");
  const [selectedDir,setSelectedDir]=useState("登录页");
  const [selectedEl,setSelectedEl]=useState(
    demoState==="library-selected"||demoState==="override"||demoState==="element-changed"||demoState==="element-deleted"?"el-001":""
  );
  const [locType,setLocType]=useState("CSS Selector");
  const [locValue,setLocValue]=useState(demoState==="override"?".login-form input[name='user']":"");
  const [showSaveDrawer,setShowSaveDrawer]=useState(false);

  const isDeleted  = demoState==="element-deleted";
  const isChanged  = demoState==="element-changed";
  const isNoPerm   = demoState==="no-permission";
  const isOverride = demoState==="override";
  const hasElement = ["library-selected","override","element-changed","element-deleted"].includes(demoState);

  const dirs=["登录页","首页","商品详情页","购物车页"];
  const filteredEls = MOCK_LIB_ELEMENTS.filter(e=>e.page===selectedDir);

  return(
    <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
      {/* Mode toggle */}
      <div style={{display:"flex",alignItems:"center",gap:0,padding:"10px 14px",background:"#FAFBFE",borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",gap:1,background:T.bg,borderRadius:7,padding:2,flex:1}}>
          {(["library","inline"] as ElemSrcMode[]).map(m=>(
            <button key={m} onClick={()=>setMode(m)}
              style={{flex:1,padding:"5px 0",borderRadius:5,border:"none",fontSize:12,fontWeight:mode===m?700:400,cursor:"pointer",background:mode===m?"#fff":"transparent",color:mode===m?T.primary:T.t3,boxShadow:mode===m?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
              {m==="library"?"从元素库选择":"临时定位器"}
            </button>
          ))}
        </div>
        {hasElement&&!isDeleted&&(
          <div style={{marginLeft:10,display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:6,background:isChanged?"#FFF3E8":isOverride?`${T.purple}10`:"#E8FFEA",border:`1px solid ${isChanged?T.warning:isOverride?T.purple:T.success}30`,flexShrink:0}}>
            {isChanged?<AlertTriangle size={11} style={{color:T.warning}}/>:isOverride?<AlertCircle size={11} style={{color:T.purple}}/>:<CheckCircle size={11} style={{color:T.success}}/>}
            <span style={{fontSize:11,fontWeight:600,color:isChanged?T.warning:isOverride?T.purple:T.success}}>
              {isChanged?"元素已变更":isOverride?"已覆盖定位器":"已绑定元素"}
            </span>
          </div>
        )}
        {isDeleted&&(
          <div style={{marginLeft:10,padding:"4px 10px",borderRadius:6,background:"#FFE8E8",border:`1px solid ${T.danger}30`,fontSize:11,fontWeight:600,color:T.danger,display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
            <XCircle size={11}/>元素已删除
          </div>
        )}
      </div>

      {/* Status banners */}
      {(isChanged||isDeleted||isOverride)&&(
        <div style={{padding:"0 14px",paddingTop:10}}>
          {isDeleted&&<AlertBanner type="error"><strong>引用的元素已被删除</strong> — 「用户名输入框」已从元素库移除，步骤执行时将无法定位元素。请重新选择或改用临时定位器。</AlertBanner>}
          {isChanged&&<AlertBanner type="warn"><strong>元素定位器已变更</strong> — 「用户名输入框」的主定位器于 2026-07-31 被修改。当前步骤可能受影响，建议重新验证或更新绑定。<div style={{marginTop:5,display:"flex",gap:6}}><button style={{fontSize:11,padding:"2px 8px",border:`1px solid ${T.warning}`,borderRadius:4,background:"#fff",color:T.warning,cursor:"pointer"}}>查看变更内容</button><button style={{fontSize:11,padding:"2px 8px",border:`1px solid ${T.border}`,borderRadius:4,background:"#fff",color:T.t2,cursor:"pointer"}}>忽略并继续</button></div></AlertBanner>}
          {isOverride&&<AlertBanner type="info">当前步骤已覆盖元素库定位器，将使用下方临时定位器定位元素，而非元素库中的配置。元素库定位器发生变更时不会影响本步骤。</AlertBanner>}
        </div>
      )}

      {/* Library mode */}
      {mode==="library"&&(
        <div style={{display:"flex",minHeight:240}}>
          {/* Directory tree */}
          <div style={{width:160,borderRight:`1px solid ${T.border}`,padding:"10px 8px",flexShrink:0}}>
            <div style={{fontSize:11,fontWeight:600,color:T.t4,marginBottom:6}}>页面 / 模块</div>
            {dirs.map(d=>(
              <button key={d} onClick={()=>setSelectedDir(d)}
                style={{display:"flex",alignItems:"center",gap:5,width:"100%",padding:"5px 8px",border:"none",borderRadius:6,fontSize:12,color:selectedDir===d?T.primary:T.t2,background:selectedDir===d?`${T.primary}0D`:"transparent",cursor:"pointer",textAlign:"left"}}>
                <FolderOpen size={11} style={{color:selectedDir===d?T.primary:T.warning,flexShrink:0}}/>
                {d}
              </button>
            ))}
          </div>

          {/* Element list */}
          <div style={{flex:1,padding:"10px 14px",overflowY:"auto"}}>
            {isNoPerm?(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 0",gap:8,color:T.t4}}>
                <Lock size={24} style={{opacity:0.4}}/>
                <div style={{fontSize:12,color:T.t3}}>无权限查看该目录的元素</div>
              </div>
            ):(
              <>
                <div style={{position:"relative",marginBottom:10}}>
                  <Search size={12} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:T.t4}}/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索元素名称…"
                    style={{width:"100%",boxSizing:"border-box",height:30,paddingLeft:28,paddingRight:10,border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/>
                </div>

                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {filteredEls.map(el=>{
                    const isSelected = selectedEl===el.id;
                    const isDisabled = el.disabled;
                    return(
                      <div key={el.id} onClick={()=>!isDisabled&&setSelectedEl(el.id)}
                        style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,border:`1px solid ${isSelected?T.primary:T.border}`,background:isSelected?`${T.primary}08`:isDisabled?"#FAFAFA":"#fff",cursor:isDisabled?"not-allowed":"pointer",opacity:isDisabled?0.6:1}}>
                        <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${isSelected?T.primary:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:isSelected?T.primary:"#fff"}}>
                          {isSelected&&<div style={{width:6,height:6,borderRadius:"50%",background:"#fff"}}/>}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:500,color:isDisabled?T.t4:T.t1,display:"flex",alignItems:"center",gap:5}}>
                            {el.name}
                            {isDisabled&&<span style={{fontSize:10,color:T.t4,background:T.bg,padding:"0 4px",borderRadius:3}}>已停用</span>}
                          </div>
                          <div style={{fontSize:10,color:T.t4,marginTop:1}}>{el.locType} · 引用 {el.refCount} 次</div>
                        </div>
                        <VerifyBadge result={el.lastResult as any}/>
                        <button onClick={e=>{e.stopPropagation();}} style={{background:"none",border:"none",cursor:"pointer",color:T.t4,lineHeight:0,padding:2}} title="查看详情"><ExternalLink size={10}/></button>
                      </div>
                    );
                  })}
                </div>

                {selectedEl&&(
                  <div style={{marginTop:10,padding:"8px 10px",border:`1px solid ${T.primary}30`,borderRadius:7,background:`${T.primary}05`,display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                    <CheckCircle size={12} style={{color:T.success,flexShrink:0}}/>
                    <span style={{color:T.t1,fontWeight:500}}>已选：{filteredEls.find(e=>e.id===selectedEl)?.name||"—"}</span>
                    <div style={{flex:1}}/>
                    <button style={{fontSize:11,padding:"2px 8px",border:`1px solid ${T.border}`,borderRadius:4,background:"#fff",color:T.t2,cursor:"pointer"}}>使用元素定位器覆盖</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Inline locator mode */}
      {mode==="inline"&&(
        <div style={{padding:"14px"}}>
          <div style={{display:"flex",gap:10,marginBottom:12}}>
            <div style={{flex:"0 0 160px"}}>
              <FL required>定位方式</FL>
              <select value={locType} onChange={e=>setLocType(e.target.value)}
                style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
                {["CSS Selector","XPath","ID","Name","Text","Playwright Role","Label","Placeholder","Test ID","自定义属性"].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
            <div style={{flex:1}}>
              <FL required>定位值</FL>
              <FInput value={locValue} onChange={setLocValue} placeholder={locType==="CSS Selector"?"例如：#login-btn":locType==="XPath"?"例如：//input[@name='user']":"输入定位值…"} mono/>
            </div>
          </div>

          {/* Frame / Shadow DOM */}
          <div style={{marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
              <Layers size={12} style={{color:T.t3}}/>
              <span style={{fontSize:12,fontWeight:500,color:T.t3}}>Frame / Shadow DOM 路径</span>
              <button onClick={onFrameShadow} style={{marginLeft:"auto",fontSize:11,padding:"2px 8px",border:`1px solid ${T.border}`,borderRadius:4,background:"#fff",color:T.t2,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><Plus size={9}/>添加层级</button>
            </div>
            <div style={{padding:"8px 12px",border:`1px dashed ${T.border}`,borderRadius:7,fontSize:12,color:T.t4,textAlign:"center"}}>
              未配置（元素在主文档中）
            </div>
          </div>

          <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:6}}>
              <button style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",border:`1px solid ${T.primary}`,borderRadius:7,background:`${T.primary}0D`,color:T.primary,fontSize:12,cursor:"pointer"}}><Zap size={11}/>在线验证</button>
            </div>
            <button onClick={()=>setShowSaveDrawer(true)}
              style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",color:T.t2,fontSize:12,cursor:"pointer"}}>
              <Save size={11}/>保存到元素库
            </button>
          </div>

          {showSaveDrawer&&(
            <div style={{marginTop:10,padding:"12px",border:`1px solid ${T.primary}30`,borderRadius:8,background:`${T.primary}05`}}>
              <div style={{fontSize:12,fontWeight:600,color:T.t1,marginBottom:8}}>保存到元素库</div>
              <div style={{marginBottom:8}}>
                <FL required>元素名称</FL>
                <FInput placeholder="为此定位器命名，以便在其他步骤复用"/>
              </div>
              <div style={{marginBottom:8}}>
                <FL required>所属页面</FL>
                <select style={{width:"100%",height:32,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}>
                  <option>登录页</option><option>首页</option><option>商品详情页</option>
                </select>
              </div>
              <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                <button onClick={()=>setShowSaveDrawer(false)} style={{padding:"5px 12px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",fontSize:12,color:T.t2,cursor:"pointer"}}>取消</button>
                <button style={{padding:"5px 14px",border:"none",borderRadius:6,background:T.primary,color:"#fff",fontSize:12,cursor:"pointer"}}>保存</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. FrameShadowConfig — Frame / Shadow DOM 层级配置
// ─────────────────────────────────────────────────────────────────────────────
type FrameState = "success"|"frame-not-found"|"cross-origin"|"shadow-not-found"|"mid-fail"|"unmatched"|"idle";

const FRAME_DEMO:{value:FrameState;label:string}[] = [
  {value:"idle",           label:"未配置"},
  {value:"success",        label:"层级验证成功"},
  {value:"frame-not-found",label:"Frame 不存在"},
  {value:"cross-origin",   label:"跨域无法访问"},
  {value:"shadow-not-found",label:"Shadow Root 未找到"},
  {value:"mid-fail",       label:"中间层级失效"},
  {value:"unmatched",      label:"最终元素未匹配"},
];

interface FrameLayer {id:string;kind:"frame"|"shadow";selector:string;alias:string;status:"ok"|"fail"|"warn"|"idle";}

export function FrameShadowConfig({onClose}:{onClose:()=>void}){
  const [demoState,setDemoState]=useState<FrameState>("success");
  const [showPath,setShowPath]=useState(false);

  const layers:FrameLayer[] = demoState==="idle"?[]:[
    {id:"l1",kind:"frame",selector:"iframe#payment-frame",alias:"支付 Frame",status:demoState==="frame-not-found"?"fail":demoState==="cross-origin"?"warn":demoState==="mid-fail"?"fail":"ok"},
    {id:"l2",kind:"shadow",selector:".card-form",alias:"卡片表单 Shadow Root",status:demoState==="shadow-not-found"?"fail":demoState==="mid-fail"?"warn":demoState==="success"||demoState==="unmatched"?"ok":"idle"},
  ];

  const isSuccess = demoState==="success";
  const isFail = ["frame-not-found","cross-origin","shadow-not-found","mid-fail","unmatched"].includes(demoState);

  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.18)",zIndex:1100}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:1101,background:"#fff",borderRadius:12,width:620,maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 12px 48px rgba(0,0,0,0.14)"}}>

        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <Layers size={14} style={{color:T.primary}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:T.t1}}>Frame / Shadow DOM 路径配置</div>
            <div style={{fontSize:12,color:T.t3}}>配置元素所在的 Frame 和 Shadow DOM 层级</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0}}><X size={15}/></button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",minHeight:0}}>

          <AlertBanner type="info">
            如果目标元素在 iframe 或 Shadow DOM 内，请按从外到内的顺序添加层级。执行时将按层级逐步进入，最终定位到元素。
          </AlertBanner>

          {demoState==="frame-not-found"&&<AlertBanner type="error"><strong>Frame 不存在</strong> — 未在当前页面找到 <code style={{fontFamily:"monospace",fontSize:11}}>iframe#payment-frame</code>。Frame 可能尚未加载，或 selector 有误。</AlertBanner>}
          {demoState==="cross-origin"&&<AlertBanner type="error"><strong>跨域 Frame 无法访问</strong> — <code style={{fontFamily:"monospace",fontSize:11}}>iframe#payment-frame</code> 来自不同域名，受浏览器同源策略限制，无法进入。如需访问，请联系开发团队配置 CORS 或使用 Playwright 的 frame 穿透模式。</AlertBanner>}
          {demoState==="shadow-not-found"&&<AlertBanner type="error"><strong>Shadow Root 未找到</strong> — 元素 <code style={{fontFamily:"monospace",fontSize:11}}>.card-form</code> 不包含 Shadow Root，无法进入。请确认该元素是否使用了 Web Components。</AlertBanner>}
          {demoState==="mid-fail"&&<AlertBanner type="error"><strong>中间层级失效</strong> — 第 1 层 Frame 验证通过，但第 2 层 Shadow Root 定位失败。请检查中间层级的定位器。</AlertBanner>}
          {demoState==="unmatched"&&<AlertBanner type="warn"><strong>最终元素未匹配</strong> — 所有层级进入成功，但在最后的 Shadow DOM 内未找到目标元素。请检查元素定位器或层级配置。</AlertBanner>}

          {/* Layers */}
          {layers.length===0?(
            <div style={{padding:"24px",border:`2px dashed ${T.border}`,borderRadius:10,textAlign:"center",color:T.t4}}>
              <Layers size={28} style={{margin:"0 auto 8px",display:"block",opacity:0.3}}/>
              <div style={{fontSize:13,color:T.t3,marginBottom:4}}>暂无层级配置</div>
              <div style={{fontSize:12,color:T.t4}}>如果元素在主文档中，无需配置</div>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
              {layers.map((layer,i)=>{
                const statusColor=layer.status==="ok"?T.success:layer.status==="fail"?T.danger:layer.status==="warn"?T.warning:T.t4;
                const statusBg=layer.status==="ok"?"#E8FFEA":layer.status==="fail"?"#FFE8E8":layer.status==="warn"?"#FFF3E8":"#F2F3F5";
                const StatusIcon=layer.status==="ok"?CheckCircle:layer.status==="fail"?XCircle:layer.status==="warn"?AlertTriangle:Timer;
                return(
                  <div key={layer.id} style={{border:`1px solid ${layer.status==="fail"?T.danger:layer.status==="warn"?T.warning:T.border}`,borderRadius:9,overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:layer.status==="fail"?"#FFF5F5":layer.status==="warn"?"#FFFBE8":"#FAFBFE"}}>
                      <GripVertical size={13} style={{color:T.t4,cursor:"grab"}}/>
                      <span style={{fontSize:12,fontWeight:700,width:20,color:T.t4}}>{i+1}</span>
                      <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,fontWeight:700,background:layer.kind==="frame"?"#E8F3FF":"#F5E8FF",color:layer.kind==="frame"?T.primary:T.purple}}>
                        {layer.kind==="frame"?"Frame":"Shadow Root"}
                      </span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:500,color:T.t1}}>{layer.alias}</div>
                        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.t3}}>{layer.selector}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:5,background:statusBg}}>
                        <StatusIcon size={11} style={{color:statusColor}}/>
                        <span style={{fontSize:11,fontWeight:600,color:statusColor}}>
                          {layer.status==="ok"?"验证通过":layer.status==="fail"?"失败":layer.status==="warn"?"警告":"未验证"}
                        </span>
                      </div>
                      <button style={{padding:"3px 8px",border:`1px solid ${T.border}`,borderRadius:5,background:"#fff",fontSize:11,color:T.t2,cursor:"pointer"}}>验证此层</button>
                      <button style={{background:"none",border:"none",cursor:"pointer",color:T.danger,lineHeight:0,padding:2}}><Trash2 size={12}/></button>
                    </div>
                    {i<layers.length-1&&(
                      <div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 14px 4px 52px",borderTop:`1px solid ${T.border}`,background:"#F7F8FB",fontSize:11,color:T.t4}}>
                        <ArrowRight size={10}/>进入后查找下一层级
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Final element indicator */}
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px 8px 52px",border:`1px solid ${demoState==="unmatched"?T.warning:T.border}`,borderRadius:9,background:demoState==="unmatched"?"#FFFBE8":"#fff"}}>
                <Target size={13} style={{color:demoState==="unmatched"?T.warning:T.t3,flexShrink:0}}/>
                <span style={{fontSize:12,color:T.t2}}>目标元素（由步骤定位器指定）</span>
                {demoState==="unmatched"&&<span style={{marginLeft:"auto",fontSize:11,color:T.warning,fontWeight:600}}>未匹配</span>}
                {isSuccess&&<span style={{marginLeft:"auto",fontSize:11,color:T.success,fontWeight:600}}>匹配成功</span>}
              </div>
            </div>
          )}

          {/* Add buttons */}
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <button style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:12,color:T.t2,cursor:"pointer"}}><Plus size={11}/>添加 Frame 层级</button>
            <button style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:12,color:T.t2,cursor:"pointer"}}><Plus size={11}/>添加 Shadow Root 层级</button>
          </div>

          {/* Full path */}
          {layers.length>0&&(
            <div>
              <button onClick={()=>setShowPath(!showPath)} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:T.t3,border:"none",background:"none",cursor:"pointer",padding:"4px 0",marginBottom:4}}>
                <ChevronRight size={12} style={{transform:showPath?"rotate(90deg)":"none",transition:".15s"}}/>完整定位路径
              </button>
              {showPath&&(
                <div style={{padding:"10px 14px",border:`1px solid ${T.border}`,borderRadius:8,background:"#111",fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#D4D4D4",lineHeight:1.8}}>
                  {`page.frameLocator('iframe#payment-frame')\n  .locator('.card-form')\n  .shadowRoot()\n  .locator('#card-number-input')`}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{padding:"12px 20px",borderTop:`1px solid ${T.border}`,flexShrink:0,display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>取消</button>
          {layers.length>0&&<button style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><Zap size={12}/>逐层验证</button>}
          <button onClick={onClose} style={{padding:"7px 22px",border:"none",borderRadius:7,background:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"}}>确认配置</button>
        </div>
      </div>
      <DemoBar states={FRAME_DEMO} current={demoState} onChange={setDemoState} label="Frame / Shadow DOM 状态"/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. FileUploadConfig — 文件上传步骤配置面板（内嵌于步骤抽屉）
// ─────────────────────────────────────────────────────────────────────────────
type FileUploadState = "no-file"|"platform-file"|"var-path"|"file-not-found"|"format-error"|"too-large"|"control-not-found"|"uploading"|"success"|"failed";

const FILE_DEMO:{value:FileUploadState;label:string}[] = [
  {value:"no-file",          label:"未选文件"},
  {value:"platform-file",    label:"平台文件"},
  {value:"var-path",         label:"变量路径"},
  {value:"file-not-found",   label:"文件不存在"},
  {value:"format-error",     label:"格式不支持"},
  {value:"too-large",        label:"文件过大"},
  {value:"control-not-found",label:"控件无法定位"},
  {value:"uploading",        label:"上传中"},
  {value:"success",          label:"上传成功"},
  {value:"failed",           label:"上传失败"},
];

function FileUploadConfig({demoState}:{demoState:FileUploadState}){
  const [fileSource,setFileSource]=useState<"platform"|"var">(
    demoState==="var-path"?"var":"platform"
  );
  const [multi,setMulti]=useState(false);
  const [maxSizeMb,setMaxSizeMb]=useState("10");
  const [typeLimit,setTypeLimit]=useState(".jpg,.png,.pdf");

  const isPlatform = fileSource==="platform";
  const isVar      = fileSource==="var";
  const hasBanner  = ["file-not-found","format-error","too-large","control-not-found","failed"].includes(demoState);

  return(
    <div>
      {demoState==="file-not-found"&&<AlertBanner type="error"><strong>文件不存在</strong> — 平台文件「订单导入模板.xlsx」已被删除或移动，无法上传。请重新选择文件。</AlertBanner>}
      {demoState==="format-error"&&<AlertBanner type="error"><strong>文件格式不支持</strong> — 「头像.gif」不在允许的格式列表中（.jpg, .png, .pdf）。请检查类型限制配置。</AlertBanner>}
      {demoState==="too-large"&&<AlertBanner type="error"><strong>文件超过大小限制</strong> — 文件大小 23.4 MB，超过限制的 10 MB。请压缩后重新选择，或调整大小限制。</AlertBanner>}
      {demoState==="control-not-found"&&<AlertBanner type="error"><strong>上传控件无法定位</strong> — 未找到目标文件上传控件（input[type=file]）。请检查元素绑定是否正确，或该控件在当前状态下不可见。</AlertBanner>}
      {demoState==="failed"&&<AlertBanner type="error"><strong>上传失败</strong> — 文件已选取，但上传过程中服务器返回错误。错误信息：413 Request Entity Too Large。</AlertBanner>}

      {/* File source */}
      <div style={{marginBottom:14}}>
        <FL required>文件来源</FL>
        <div style={{display:"flex",gap:2,background:T.bg,borderRadius:7,padding:2,width:"fit-content"}}>
          {(["platform","var"] as const).map(s=>(
            <button key={s} onClick={()=>setFileSource(s)}
              style={{padding:"5px 20px",borderRadius:5,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",background:fileSource===s?"#fff":"transparent",color:fileSource===s?T.primary:T.t3,boxShadow:fileSource===s?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
              {s==="platform"?"平台文件资源":"变量生成路径"}
            </button>
          ))}
        </div>
      </div>

      {/* Platform file */}
      {isPlatform&&(
        <div style={{marginBottom:14}}>
          <FL required>选择文件</FL>
          <div style={{border:`1.5px solid ${["file-not-found","format-error","too-large"].includes(demoState)?T.danger:T.border}`,borderRadius:8,overflow:"hidden"}}>
            {demoState==="no-file"?(
              <div style={{padding:"24px",textAlign:"center",background:"#FAFBFE"}}>
                <Upload size={24} style={{margin:"0 auto 8px",display:"block",color:T.t4,opacity:0.5}}/>
                <div style={{fontSize:12,color:T.t3,marginBottom:6}}>从平台文件资源中选择</div>
                <button style={{display:"inline-flex",alignItems:"center",gap:5,padding:"6px 14px",border:`1px solid ${T.primary}`,borderRadius:7,background:`${T.primary}0D`,color:T.primary,fontSize:12,cursor:"pointer"}}><FolderOpen size={11}/>浏览文件资源</button>
              </div>
            ):(
              <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:10,background:demoState==="file-not-found"?"#FFF5F5":"#fff"}}>
                <FileText size={22} style={{color:["file-not-found","format-error","too-large"].includes(demoState)?T.danger:T.primary,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,color:demoState==="file-not-found"?T.danger:T.t1}}>
                    {demoState==="format-error"?"头像.gif":demoState==="too-large"?"商品数据_2026Q3.xlsx":"订单导入模板.xlsx"}
                    {demoState==="file-not-found"&&<span style={{marginLeft:6,fontSize:11,color:T.danger}}>(文件已删除)</span>}
                  </div>
                  <div style={{fontSize:11,color:T.t4,marginTop:1}}>
                    {demoState==="too-large"?"23.4 MB · 超过限制":demoState==="format-error"?"格式 .gif · 不在允许列表中":"文件资源 / 上传测试数据 · 4.2 KB"}
                  </div>
                </div>
                <button style={{padding:"4px 10px",border:`1px solid ${T.border}`,borderRadius:5,background:"#fff",fontSize:11,color:T.t2,cursor:"pointer"}}>更换文件</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Variable path */}
      {isVar&&(
        <div style={{marginBottom:14}}>
          <FL required tip="执行时将从变量中读取文件路径，路径必须是 Runner 节点可访问的绝对路径或平台存储路径">文件路径变量</FL>
          <FInput value="{{uploadFilePath}}" mono placeholder="输入包含文件路径的变量名，例如：{{filePath}}"/>
          <div style={{fontSize:11,color:T.t4,marginTop:4}}>变量值应为执行节点可访问的路径，例如：/opt/testdata/sample.xlsx</div>
        </div>
      )}

      {/* Target element */}
      <div style={{marginBottom:14}}>
        <FL required tip="文件上传控件，通常是 <input type='file'> 元素">上传控件元素</FL>
        <div style={{display:"flex",gap:6}}>
          <div style={{flex:1,height:34,border:`1.5px solid ${demoState==="control-not-found"?T.danger:T.border}`,borderRadius:7,display:"flex",alignItems:"center",gap:8,padding:"0 10px",background:demoState==="control-not-found"?"#FFF5F5":"#fff"}}>
            <Target size={12} style={{color:demoState==="control-not-found"?T.danger:T.t4,flexShrink:0}}/>
            <span style={{fontSize:12,color:demoState==="control-not-found"?T.danger:T.t1}}>文件上传输入框</span>
            <span style={{fontSize:11,color:T.t4,fontFamily:"'JetBrains Mono',monospace"}}>input[type=file]</span>
          </div>
          <button style={{padding:"0 12px",height:34,border:`1px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t2,background:"#fff",cursor:"pointer"}}>更换</button>
        </div>
      </div>

      {/* Constraints */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
        <div>
          <FL>允许的文件类型</FL>
          <FInput value={typeLimit} onChange={setTypeLimit} placeholder=".jpg,.png,.pdf（留空不限制）" mono/>
        </div>
        <div>
          <FL>最大文件大小</FL>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <input type="number" value={maxSizeMb} onChange={e=>setMaxSizeMb(e.target.value)}
              style={{width:70,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/>
            <span style={{fontSize:12,color:T.t4}}>MB（0 = 不限制）</span>
          </div>
        </div>
      </div>

      <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:10,padding:"8px 12px",border:`1px solid ${T.border}`,borderRadius:8}}>
        <div style={{flex:1}}>
          <div style={{fontSize:12,fontWeight:500,color:T.t1}}>允许多文件上传</div>
          <div style={{fontSize:11,color:T.t4}}>开启后可一次选择多个文件，控件需支持 multiple 属性</div>
        </div>
        <SmToggle on={multi} onChange={setMulti}/>
      </div>

      {/* Upload validation */}
      <SCard title="上传后校验（可选）">
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            {label:"验证上传成功提示出现",desc:"上传后等待页面出现成功提示元素",enabled:true},
            {label:"验证文件名显示正确",desc:"检查页面中显示的文件名与上传文件一致",enabled:false},
          ].map((v,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",border:`1px solid ${T.border}`,borderRadius:7}}>
              <SmToggle on={v.enabled} onChange={()=>{}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:500,color:T.t1}}>{v.label}</div>
                <div style={{fontSize:11,color:T.t4}}>{v.desc}</div>
              </div>
            </div>
          ))}
          <button style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:T.primary,border:"none",background:"none",cursor:"pointer",padding:"3px 0"}}><Plus size={11}/>添加校验项</button>
        </div>
      </SCard>

      {/* Uploading / success state display */}
      {demoState==="uploading"&&(
        <div style={{padding:"14px",border:`1px solid ${T.primary}30`,borderRadius:8,background:`${T.primary}05`,display:"flex",alignItems:"center",gap:12}}>
          <Loader2 size={20} style={{color:T.primary,animation:"spin 1s linear infinite",flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:500,color:T.t1}}>正在上传文件…</div>
            <div style={{height:4,borderRadius:2,background:T.border,marginTop:6,overflow:"hidden"}}>
              <div style={{width:"65%",height:"100%",background:T.primary,borderRadius:2}}/>
            </div>
            <div style={{fontSize:11,color:T.t4,marginTop:4}}>订单导入模板.xlsx · 2.7 MB / 4.2 MB</div>
          </div>
        </div>
      )}
      {demoState==="success"&&(
        <div style={{padding:"14px",border:`1px solid ${T.success}30`,borderRadius:8,background:"#F0FFF4",display:"flex",alignItems:"center",gap:10}}>
          <CheckCircle size={20} style={{color:T.success,flexShrink:0}}/>
          <div>
            <div style={{fontSize:13,fontWeight:500,color:T.success}}>上传成功</div>
            <div style={{fontSize:11,color:T.t3,marginTop:2}}>订单导入模板.xlsx · 4.2 MB · 耗时 1.24s</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. WebUIAssertionEditor — Web UI 断言编辑
// ─────────────────────────────────────────────────────────────────────────────
type AssertionState = "multi"|"pass"|"fail"|"element-not-found"|"screenshot-diff"|"baseline-missing"|"unresolved";

const ASSERT_DEMO:{value:AssertionState;label:string}[] = [
  {value:"multi",            label:"多条断言"},
  {value:"pass",             label:"全部通过"},
  {value:"fail",             label:"断言失败"},
  {value:"element-not-found",label:"元素未找到"},
  {value:"screenshot-diff",  label:"截图差异"},
  {value:"baseline-missing", label:"基准截图缺失"},
  {value:"unresolved",       label:"变量无法解析"},
];

type AssertType = "el-exist"|"el-not-exist"|"el-visible"|"el-not-visible"|"el-enabled"|"el-text"|"el-attr"|"input-val"|"el-count"|"page-title"|"page-url"|"cookie"|"screenshot"|"js-expr";

const ASSERT_CFG: Record<AssertType,{label:string;needsEl:boolean;ops:string[]}> = {
  "el-exist":      {label:"元素存在",       needsEl:true, ops:["存在","不存在"]},
  "el-not-exist":  {label:"元素不存在",     needsEl:true, ops:["不存在"]},
  "el-visible":    {label:"元素可见",       needsEl:true, ops:["可见","不可见"]},
  "el-not-visible":{label:"元素不可见",     needsEl:true, ops:["不可见"]},
  "el-enabled":    {label:"元素可点击",     needsEl:true, ops:["可点击","不可点击"]},
  "el-text":       {label:"元素文本",       needsEl:true, ops:["等于","包含","不包含","正则匹配"]},
  "el-attr":       {label:"元素属性",       needsEl:true, ops:["等于","包含","不包含","存在","不存在"]},
  "input-val":     {label:"输入框值",       needsEl:true, ops:["等于","包含","不为空"]},
  "el-count":      {label:"元素数量",       needsEl:true, ops:["等于","大于","小于","大于等于","小于等于"]},
  "page-title":    {label:"页面标题",       needsEl:false,ops:["等于","包含","正则匹配"]},
  "page-url":      {label:"页面 URL",      needsEl:false,ops:["等于","包含","正则匹配","以...开头"]},
  "cookie":        {label:"Cookie 值",     needsEl:false,ops:["等于","包含","存在","不存在"]},
  "screenshot":    {label:"页面截图对比",   needsEl:false,ops:["与基准匹配"]},
  "js-expr":       {label:"JavaScript 表达式",needsEl:false,ops:["结果为 true"]},
};

interface AssertRow {
  id:string;type:AssertType;op:string;expected:string;
  element?:string;attrName?:string;enabled:boolean;
  result?:"pass"|"fail"|"skip";actualVal?:string;errMsg?:string;
}

const MOCK_ASSERTIONS: AssertRow[] = [
  {id:"a1",type:"page-url",    op:"包含",    expected:"/dashboard",element:undefined,enabled:true, result:"pass",actualVal:"https://test.example.com/dashboard"},
  {id:"a2",type:"el-visible",  op:"可见",    expected:"",          element:"欢迎提示文字",enabled:true,result:"pass",actualVal:"可见"},
  {id:"a3",type:"el-text",     op:"包含",    expected:"欢迎回来",   element:"欢迎提示文字",enabled:true,result:"fail",actualVal:"Welcome back",errMsg:"期望包含「欢迎回来」，实际值：「Welcome back」"},
  {id:"a4",type:"el-exist",    op:"存在",    expected:"",          element:"错误提示",   enabled:false,result:"skip",actualVal:""},
];

function AssertTypeBadge({type}:{type:AssertType}){
  const isEl = ASSERT_CFG[type]?.needsEl;
  return(
    <span style={{fontSize:10,padding:"1px 6px",borderRadius:4,fontWeight:700,background:isEl?`${T.purple}10`:`${T.primary}10`,color:isEl?T.purple:T.primary}}>
      {ASSERT_CFG[type]?.label||type}
    </span>
  );
}

function WebUIAssertionEditor({demoState}:{demoState:AssertionState}){
  const [logic,setLogic]=useState<"AND"|"OR">("AND");
  const showResults = ["pass","fail","element-not-found","screenshot-diff","baseline-missing","unresolved"].includes(demoState);

  const rows = MOCK_ASSERTIONS.map(a=>{
    let result = a.result;
    let errMsg = a.errMsg;
    if(demoState==="pass") result="pass";
    if(demoState==="fail"&&a.id==="a3") result="fail";
    if(demoState==="fail"&&a.id!=="a3") result="pass";
    if(demoState==="element-not-found"&&a.element) { result="fail"; errMsg="元素「"+a.element+"」在页面中未找到"; }
    if(demoState==="unresolved"&&a.expected.includes("{{")) { result="fail"; errMsg="变量 {{env_host}} 无法解析"; }
    return {...a,result,errMsg};
  });

  return(
    <div>
      {/* Logic + add */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <span style={{fontSize:12,color:T.t3}}>断言关系</span>
        <div style={{display:"flex",gap:2,background:T.bg,borderRadius:6,padding:2}}>
          {(["AND","OR"] as const).map(l=>(
            <button key={l} onClick={()=>setLogic(l)}
              style={{padding:"3px 16px",borderRadius:5,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:logic===l?"#fff":"transparent",color:logic===l?T.primary:T.t3,boxShadow:logic===l?"0 1px 4px rgba(0,0,0,0.06)":"none"}}>
              {l}
            </button>
          ))}
        </div>
        <span style={{fontSize:11,color:T.t4}}>{logic==="AND"?"所有断言通过才算成功":"任意一个通过即算成功"}</span>
        <div style={{flex:1}}/>
        <button style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",border:`1px solid ${T.primary}`,borderRadius:7,background:`${T.primary}0D`,color:T.primary,fontSize:12,cursor:"pointer"}}><Plus size={11}/>添加断言</button>
      </div>

      {/* Result summary */}
      {showResults&&(
        <div style={{display:"flex",gap:10,marginBottom:12}}>
          {[
            {label:"通过",count:demoState==="pass"?3:demoState==="fail"||demoState==="element-not-found"||demoState==="screenshot-diff"?2:demoState==="baseline-missing"?0:3,color:T.success},
            {label:"失败",count:demoState==="pass"?0:demoState==="fail"||demoState==="element-not-found"?1:demoState==="screenshot-diff"?1:demoState==="baseline-missing"?1:0,color:T.danger},
            {label:"跳过",count:1,color:T.t4},
          ].map(s=>(
            <div key={s.label} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,background:`${s.color}0D`}}>
              <span style={{fontSize:14,fontWeight:800,color:s.color}}>{s.count}</span>
              <span style={{fontSize:11,color:s.color}}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Screenshot diff / baseline */}
      {demoState==="screenshot-diff"&&(
        <AlertBanner type="warn"><strong>截图对比差异</strong> — 实际截图与基准截图相似度 87.3%（阈值 95%），存在明显差异区域。<div style={{marginTop:5,display:"flex",gap:6}}><button style={{fontSize:11,padding:"2px 8px",border:`1px solid ${T.warning}`,borderRadius:4,background:"#fff",color:T.warning,cursor:"pointer"}}>查看差异图</button><button style={{fontSize:11,padding:"2px 8px",border:`1px solid ${T.border}`,borderRadius:4,background:"#fff",color:T.t2,cursor:"pointer"}}>更新基准截图</button></div></AlertBanner>
      )}
      {demoState==="baseline-missing"&&(
        <AlertBanner type="error"><strong>基准截图缺失</strong> — 「页面截图对比」断言尚未设置基准截图，无法执行对比。请先执行一次通过的用例，系统将自动保存基准截图。<div style={{marginTop:5}}><button style={{fontSize:11,padding:"2px 8px",border:`1px solid ${T.danger}`,borderRadius:4,background:"#fff",color:T.danger,cursor:"pointer"}}>手动上传基准截图</button></div></AlertBanner>
      )}
      {demoState==="unresolved"&&(
        <AlertBanner type="error"><strong>变量无法解析</strong> — 断言期望值中引用的 <code style={{fontFamily:"monospace",fontSize:11}}>{"{{env_host}}"}</code> 在当前环境中未定义，断言将无法执行。</AlertBanner>
      )}

      {/* Assertion rows */}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {rows.map((row,i)=>{
          const isPass   = showResults&&row.result==="pass";
          const isFail   = showResults&&row.result==="fail";
          const isSkip   = showResults&&row.result==="skip";
          const typeCfg  = ASSERT_CFG[row.type];
          return(
            <div key={row.id} style={{border:`1px solid ${isFail?T.danger:isPass?T.success:T.border}`,borderRadius:9,overflow:"hidden",opacity:row.enabled?1:0.6}}>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:isFail?"#FFF5F5":isPass?"#F0FFF4":isSkip?"#FAFAFA":"#fff"}}>
                <GripVertical size={13} style={{color:T.t4,cursor:"grab"}}/>
                <SmToggle on={row.enabled} onChange={()=>{}}/>
                {i>0&&<span style={{fontSize:10,fontWeight:700,color:T.t4,width:22,flexShrink:0}}>{logic}</span>}
                {i===0&&<span style={{width:22,flexShrink:0}}/>}
                <AssertTypeBadge type={row.type}/>
                {typeCfg.needsEl&&row.element&&(
                  <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:11,color:T.t2,background:T.bg,padding:"1px 7px",borderRadius:4,flexShrink:0}}>
                    <Target size={9}/>{row.element}
                  </span>
                )}
                {row.attrName&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.t3}}>{row.attrName}</span>}
                <span style={{fontSize:11,color:T.t3}}>{row.op}</span>
                {row.expected&&(
                  <code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.primary,background:`${T.primary}0A`,padding:"1px 6px",borderRadius:4}}>{row.expected}</code>
                )}
                <div style={{flex:1}}/>
                {showResults&&(
                  <span style={{fontSize:11,padding:"2px 7px",borderRadius:4,fontWeight:600,background:isPass?"#E8FFEA":isFail?"#FFE8E8":"#F2F3F5",color:isPass?T.success:isFail?T.danger:T.t4}}>
                    {isPass?"通过":isFail?"失败":"跳过"}
                  </span>
                )}
                <button style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:2}}><Settings size={11}/></button>
                <button style={{background:"none",border:"none",cursor:"pointer",color:T.danger,lineHeight:0,padding:2}}><Trash2 size={11}/></button>
              </div>

              {/* Actual value preview */}
              {showResults&&row.actualVal&&(
                <div style={{padding:"5px 12px 6px",borderTop:`1px solid ${T.border}`,background:"#FAFBFE",display:"flex",gap:8,alignItems:"flex-start",fontSize:11}}>
                  <span style={{color:T.t4,flexShrink:0}}>实际值：</span>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",color:isFail?T.danger:T.t1,flex:1}}>{row.actualVal}</span>
                  {isFail&&row.errMsg&&(
                    <span style={{color:T.danger,flex:2,lineHeight:1.5}}>{row.errMsg}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Screenshot compare row (shown for screenshot states) */}
      {(demoState==="screenshot-diff"||demoState==="baseline-missing")&&(
        <div style={{marginTop:8,border:`1px solid ${demoState==="screenshot-diff"?T.warning:T.danger}`,borderRadius:9,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:demoState==="screenshot-diff"?"#FFFBE8":"#FFF5F5"}}>
            <GripVertical size={13} style={{color:T.t4,cursor:"grab"}}/>
            <SmToggle on={true} onChange={()=>{}}/>
            <span style={{width:22,flexShrink:0}}/>
            <AssertTypeBadge type="screenshot"/>
            <span style={{fontSize:11,color:T.t3}}>与基准匹配</span>
            <span style={{fontSize:11,color:T.t4}}>阈值 95%</span>
            <div style={{flex:1}}/>
            <span style={{fontSize:11,padding:"2px 7px",borderRadius:4,fontWeight:600,background:"#FFE8E8",color:T.danger}}>
              {demoState==="screenshot-diff"?"差异 12.7%":"无基准截图"}
            </span>
          </div>
          {demoState==="screenshot-diff"&&(
            <div style={{padding:"8px 12px",borderTop:`1px solid ${T.border}`,display:"flex",gap:10}}>
              <div style={{flex:1,height:64,border:`1px solid ${T.border}`,borderRadius:6,background:"#E8F3FF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:T.primary}}>基准截图</div>
              <div style={{flex:1,height:64,border:`1px solid ${T.warning}`,borderRadius:6,background:"#FFFBE8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:T.warning}}>实际截图（差异高亮）</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. StepDebugPanel — 单步骤调试
// ─────────────────────────────────────────────────────────────────────────────
type DebugState = "idle"|"waiting-runner"|"launching"|"loading"|"locating"|"executing"|"success"|"locate-fail"|"timeout"|"page-closed"|"crash"|"runner-offline"|"cancelled";

const DEBUG_DEMO:{value:DebugState;label:string}[] = [
  {value:"idle",           label:"未调试"},
  {value:"waiting-runner", label:"等待 Runner"},
  {value:"launching",      label:"启动浏览器"},
  {value:"loading",        label:"页面加载中"},
  {value:"locating",       label:"定位元素"},
  {value:"executing",      label:"执行中"},
  {value:"success",        label:"调试成功"},
  {value:"locate-fail",    label:"定位失败"},
  {value:"timeout",        label:"操作超时"},
  {value:"page-closed",    label:"页面已关闭"},
  {value:"crash",          label:"浏览器崩溃"},
  {value:"runner-offline", label:"Runner 离线"},
  {value:"cancelled",      label:"用户取消"},
];

const DEBUG_PHASES = [
  {key:"launching",label:"启动浏览器"},
  {key:"loading",  label:"打开页面"},
  {key:"locating", label:"定位元素"},
  {key:"executing",label:"执行步骤"},
];

function StepDebugPanel({demoState}:{demoState:DebugState}){
  const [env,setEnv]=useState("测试环境");
  const [browser,setBrowser]=useState("Chromium");
  const [runner,setRunner]=useState("自动分配");
  const [startUrl,setStartUrl]=useState("https://test.example.com/login");
  const [useLogin,setUseLogin]=useState(true);
  const [maxTime,setMaxTime]=useState("30000");
  const [showBefore,setShowBefore]=useState(false);
  const [showAfter,setShowAfter]=useState(false);
  const [showLog,setShowLog]=useState(true);

  const isIdle    = demoState==="idle";
  const isRunning = ["waiting-runner","launching","loading","locating","executing"].includes(demoState);
  const isTerminal= !isIdle&&!isRunning;
  const isSuccess = demoState==="success";

  const phaseIdx = DEBUG_PHASES.findIndex(p=>p.key===demoState);

  return(
    <div>
      {isIdle&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"50px 0",gap:12,color:T.t4}}>
          <Crosshair size={40} style={{opacity:0.22}}/>
          <div style={{fontSize:13,color:T.t3}}>尚未调试</div>
          <div style={{fontSize:12,color:T.t4}}>配置完步骤后点击底部「保存并调试」</div>
        </div>
      )}

      {/* Config (shown when idle or terminal for re-run) */}
      {(isIdle||isTerminal)&&(
        <SCard title="调试配置" compact>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[
              {label:"运行环境",content:<select value={env} onChange={e=>setEnv(e.target.value)} style={{width:"100%",height:30,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}><option>测试环境</option><option>预发布</option></select>},
              {label:"浏览器",  content:<select value={browser} onChange={e=>setBrowser(e.target.value)} style={{width:"100%",height:30,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}><option>Chromium</option><option>Firefox</option><option>WebKit</option></select>},
              {label:"Runner 节点",content:<select value={runner} onChange={e=>setRunner(e.target.value)} style={{width:"100%",height:30,padding:"0 8px",border:`1.5px solid ${demoState==="runner-offline"?T.danger:T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}><option>自动分配</option><option>Node-01</option><option>Node-02</option></select>},
              {label:"最大执行时间",content:<div style={{display:"flex",alignItems:"center",gap:5}}><input type="number" value={maxTime} onChange={e=>setMaxTime(e.target.value)} style={{flex:1,height:30,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}/><span style={{fontSize:11,color:T.t4,flexShrink:0}}>ms</span></div>},
            ].map(f=>(
              <div key={f.label}>
                <div style={{fontSize:11,fontWeight:500,color:T.t3,marginBottom:3}}>{f.label}</div>
                {f.content}
              </div>
            ))}
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:11,fontWeight:500,color:T.t3,marginBottom:3}}>页面起始地址</div>
              <FInput value={startUrl} onChange={setStartUrl} mono/>
            </div>
            <div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:10,padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:7}}>
              <div style={{flex:1,fontSize:12,color:T.t2}}>复用登录状态</div>
              <SmToggle on={useLogin} onChange={setUseLogin}/>
            </div>
          </div>
        </SCard>
      )}

      {/* Running phases */}
      {isRunning&&(
        <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:16}}>
          {DEBUG_PHASES.map((p,i)=>{
            const done = phaseIdx>i;
            const active= phaseIdx===i;
            return(
              <React.Fragment key={p.key}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:done?T.success:active?T.primary:T.border,flexShrink:0}}>
                    {done?<Check size={12} style={{color:"#fff"}}/>:active?<Loader2 size={12} style={{color:"#fff",animation:"spin 1s linear infinite"}}/>:<span style={{fontSize:11,fontWeight:700,color:"#fff"}}>{i+1}</span>}
                  </div>
                  <div style={{fontSize:10,color:done?T.success:active?T.primary:T.t4,fontWeight:active?700:400,whiteSpace:"nowrap"}}>{p.label}</div>
                </div>
                {i<DEBUG_PHASES.length-1&&<div style={{flex:1,height:2,background:done?T.success:T.border,marginBottom:16,margin:"0 4px 16px"}}/>}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {isRunning&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"30px 0",gap:10}}>
          <Loader2 size={32} style={{color:T.primary,animation:"spin 1s linear infinite"}}/>
          <div style={{fontSize:13,fontWeight:500,color:T.t1}}>
            {demoState==="waiting-runner"?"等待 Runner 节点分配…":demoState==="launching"?"正在启动 Chromium…":demoState==="loading"?"正在打开页面…":demoState==="locating"?"正在定位目标元素…":"正在执行步骤操作…"}
          </div>
          <div style={{fontSize:12,color:T.t4}}>
            {demoState==="waiting-runner"?"排队中，前方 2 个任务":"Runner: Node-01 · 已用时 1.2s"}
          </div>
        </div>
      )}

      {/* Terminal states */}
      {demoState==="runner-offline"&&(
        <AlertBanner type="error"><strong>Runner 节点离线</strong> — 自动分配失败，当前所有 Runner 节点均不可用。请检查节点状态或稍后重试。<div style={{marginTop:4}}><button style={{fontSize:11,padding:"2px 8px",border:`1px solid ${T.border}`,borderRadius:4,background:"#fff",color:T.t2,cursor:"pointer"}}>查看 Runner 状态</button></div></AlertBanner>
      )}
      {demoState==="crash"&&(
        <AlertBanner type="error"><strong>浏览器崩溃</strong> — Chromium 进程在执行过程中意外退出（退出码 -1）。可能原因：内存不足、GPU 崩溃或页面引发了严重错误。<div style={{marginTop:4,display:"flex",gap:6}}><button style={{fontSize:11,padding:"2px 8px",border:`1px solid ${T.border}`,borderRadius:4,background:"#fff",color:T.t2,cursor:"pointer"}}>下载崩溃日志</button></div></AlertBanner>
      )}
      {demoState==="page-closed"&&(
        <AlertBanner type="error"><strong>页面已关闭</strong> — 步骤执行过程中，浏览器页面被意外关闭（可能是弹窗触发了页面跳转或关闭）。建议在等待策略中添加「等待页面稳定」。</AlertBanner>
      )}
      {demoState==="timeout"&&(
        <AlertBanner type="error"><strong>操作超时</strong> — 点击操作等待 30,000 ms 后仍未完成。可能原因：元素存在但处于禁用状态，或点击后页面未响应。</AlertBanner>
      )}
      {demoState==="cancelled"&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 0",gap:8,color:T.t4}}>
          <X size={28} style={{opacity:0.3}}/>
          <div style={{fontSize:13,color:T.t3}}>调试已取消</div>
        </div>
      )}

      {/* Locate fail detail */}
      {demoState==="locate-fail"&&(
        <div style={{marginBottom:14}}>
          <AlertBanner type="error"><strong>元素定位失败</strong> — 定位器 <code style={{fontFamily:"monospace",fontSize:11}}>CSS: #login-btn</code> 在 30,000 ms 内未匹配到任何元素。</AlertBanner>
          <SCard title="定位尝试过程" compact>
            {[
              {loc:"CSS: #login-btn",priority:1,result:"fail",msg:"等待 30s 超时，未找到元素"},
              {loc:"XPath: //button[text()='登录']",priority:2,result:"fail",msg:"备用定位器：同样未找到"},
              {loc:"Text: 登录",priority:3,result:"fail",msg:"备用定位器：页面中未找到该文本"},
            ].map((a,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<2?`1px solid ${T.border}`:"none",fontSize:12}}>
                <span style={{fontSize:10,fontWeight:700,width:20,height:20,borderRadius:"50%",background:T.t4,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{a.priority}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.t2,flex:1}}>{a.loc}</span>
                <XCircle size={11} style={{color:T.danger,flexShrink:0}}/>
                <span style={{fontSize:11,color:T.danger}}>{a.msg}</span>
              </div>
            ))}
          </SCard>
        </div>
      )}

      {/* Success result */}
      {isSuccess&&(
        <div>
          <AlertBanner type="success"><strong>调试成功</strong> — 步骤执行完成。耗时 2,341 ms，使用主定位器（ID）定位成功，断言 2 条全部通过。</AlertBanner>

          {/* Execution detail */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[
              {l:"执行耗时",v:"2,341 ms"},
              {l:"浏览器",v:"Chromium 126"},
              {l:"使用的定位器",v:"ID: login-btn（主）"},
              {l:"是否使用备用",v:"否"},
              {l:"输入内容",v:"'{{test_username}}' → 'user@test.com'"},
              {l:"Runner 节点",v:"Node-01 (192.168.1.101)"},
            ].map(item=>(
              <div key={item.l} style={{padding:"8px 12px",border:`1px solid ${T.border}`,borderRadius:7}}>
                <div style={{fontSize:11,color:T.t4,marginBottom:2}}>{item.l}</div>
                <div style={{fontSize:12,fontWeight:500,color:T.t1}}>{item.v}</div>
              </div>
            ))}
          </div>

          {/* Screenshots */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[{label:"执行前截图",click:()=>setShowBefore(!showBefore),open:showBefore},{label:"执行后截图",click:()=>setShowAfter(!showAfter),open:showAfter}].map(s=>(
              <div key={s.label}>
                <button onClick={s.click} style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:4,fontSize:12,color:T.t2,border:"none",background:"none",cursor:"pointer",padding:"4px 0",marginBottom:4}}>
                  <ChevronRight size={12} style={{transform:s.open?"rotate(90deg)":"none",transition:".15s"}}/>{s.label}
                </button>
                {s.open&&(
                  <div style={{height:80,border:`1px solid ${T.border}`,borderRadius:8,background:"#F0F2F5",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:T.t4}}>截图预览</div>
                )}
              </div>
            ))}
          </div>

          {/* Assertions */}
          <SCard title="断言结果">
            {[
              {name:"页面 URL 包含 /dashboard",pass:true,actual:"https://test.example.com/dashboard"},
              {name:"欢迎提示文字可见",         pass:true,actual:"可见"},
            ].map((a,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<1?`1px solid ${T.border}`:"none",fontSize:12}}>
                {a.pass?<CheckCircle size={12} style={{color:T.success}}/>:<XCircle size={12} style={{color:T.danger}}/>}
                <span style={{flex:1,color:T.t1}}>{a.name}</span>
                <span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:T.t3}}>{a.actual}</span>
              </div>
            ))}
          </SCard>

          {/* Log */}
          <div>
            <button onClick={()=>setShowLog(!showLog)} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:T.t3,border:"none",background:"none",cursor:"pointer",padding:"4px 0",marginBottom:4}}>
              <ChevronRight size={12} style={{transform:showLog?"rotate(90deg)":"none",transition:".15s"}}/>控制台日志
            </button>
            {showLog&&(
              <div style={{padding:10,border:`1px solid ${T.border}`,borderRadius:8,background:"#111",fontFamily:"'JetBrains Mono',monospace",fontSize:11,lineHeight:1.9,color:"#D4D4D4"}}>
                {[
                  {t:"14:23:07.001",l:"INFO",c:"#86D9CA",m:"Chromium 已启动 (PID 12345)"},
                  {t:"14:23:07.220",l:"INFO",c:"#86D9CA",m:"页面打开成功: https://test.example.com/login"},
                  {t:"14:23:07.501",l:"INFO",c:"#86D9CA",m:"定位元素: ID → login-btn (主定位器)"},
                  {t:"14:23:07.504",l:"INFO",c:"#86D9CA",m:"元素找到，1 个匹配，可见且可交互"},
                  {t:"14:23:07.510",l:"INFO",c:"#86D9CA",m:"执行点击操作"},
                  {t:"14:23:08.340",l:"INFO",c:"#86D9CA",m:"页面跳转至 /dashboard"},
                  {t:"14:23:09.340",l:"PASS",c:"#52D273",m:"断言通过: 页面 URL 包含 /dashboard"},
                  {t:"14:23:09.341",l:"PASS",c:"#52D273",m:"断言通过: 欢迎提示文字可见"},
                  {t:"14:23:09.342",l:"INFO",c:"#86D9CA",m:"步骤执行完成 (2,341ms)"},
                ].map((log,i)=>(
                  <div key={i}>
                    <span style={{color:"#6B7280"}}>{log.t} </span>
                    <span style={{color:log.c}}>[{log.l}] </span>
                    <span>{log.m}</span>
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

// ─────────────────────────────────────────────────────────────────────────────
// 7. StepConfigDrawer — Web UI 步骤配置抽屉（统一框架）
// ─────────────────────────────────────────────────────────────────────────────

const STEP_TYPE_DEMO:{value:UIStepType;label:string}[] = [
  {value:"click",      label:"点击"},
  {value:"input",      label:"输入文本"},
  {value:"navigate",   label:"页面导航"},
  {value:"wait",       label:"等待"},
  {value:"script",     label:"JS 脚本"},
  {value:"upload",     label:"上传文件"},
  {value:"switch-win", label:"切换窗口"},
];

const STEP_STATE_DEMO:{value:UIStepState;label:string}[] = [
  {value:"editing",       label:"编辑"},
  {value:"saving",        label:"保存中"},
  {value:"debug-running", label:"调试中"},
  {value:"debug-success", label:"调试成功"},
  {value:"debug-fail",    label:"调试失败"},
  {value:"debug-timeout", label:"调试超时"},
  {value:"debug-crash",   label:"浏览器崩溃"},
  {value:"locate-fail",   label:"定位失败"},
  {value:"runner-offline",label:"Runner 离线"},
  {value:"cancelled",     label:"已取消"},
];

// Navigate sub-action type
type NavAction = "open-url"|"refresh"|"back"|"forward"|"wait-load";
// Wait sub-type
type WaitKind = "fixed"|"el-appear"|"el-disappear"|"el-clickable"|"url"|"network"|"js-cond";

function NavigateConfig(){
  const [action,setAction]=useState<NavAction>("open-url");
  const actions:{value:NavAction;label:string}[] = [
    {value:"open-url",  label:"打开 URL"},
    {value:"refresh",   label:"刷新页面"},
    {value:"back",      label:"页面后退"},
    {value:"forward",   label:"页面前进"},
    {value:"wait-load", label:"等待页面加载"},
  ];
  return(
    <div>
      <div style={{marginBottom:14}}>
        <FL required>导航操作</FL>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {actions.map(a=>(
            <button key={a.value} onClick={()=>setAction(a.value)}
              style={{padding:"5px 14px",borderRadius:7,border:`1px solid ${action===a.value?T.primary:T.border}`,fontSize:12,fontWeight:action===a.value?700:400,background:action===a.value?`${T.primary}0D`:"#fff",color:action===a.value?T.primary:T.t3,cursor:"pointer"}}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {action==="open-url"&&(
        <>
          <div style={{marginBottom:12}}>
            <FL required>目标 URL</FL>
            <FInput defaultValue="{{base_url}}/login" mono placeholder="支持变量，例如：{{base_url}}/path"/>
            <div style={{fontSize:11,color:T.t4,marginTop:3}}>变量将在执行时从当前环境自动替换</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <FL>等待页面加载完成</FL>
              <select style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
                <option>networkidle（推荐）</option><option>load</option><option>domcontentloaded</option><option>commit</option>
              </select>
            </div>
            <div>
              <FL>加载超时</FL>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <input type="number" defaultValue="30000" style={{flex:1,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/>
                <span style={{fontSize:12,color:T.t4}}>ms</span>
              </div>
            </div>
          </div>
        </>
      )}

      {action==="wait-load"&&(
        <>
          <div style={{marginBottom:12}}>
            <FL required>等待条件</FL>
            <select style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
              <option>networkidle</option><option>load</option><option>domcontentloaded</option>
            </select>
          </div>
          <div>
            <FL>最大等待时间</FL>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <input type="number" defaultValue="30000" style={{width:100,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/>
              <span style={{fontSize:12,color:T.t4}}>ms</span>
            </div>
          </div>
        </>
      )}

      {(action==="back"||action==="forward"||action==="refresh")&&(
        <div>
          <FL>执行后等待</FL>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <input type="number" defaultValue="1000" style={{width:100,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/>
            <span style={{fontSize:12,color:T.t4}}>ms</span>
          </div>
        </div>
      )}
    </div>
  );
}

function WaitConfig(){
  const [kind,setKind]=useState<WaitKind>("el-appear");
  const kinds:{value:WaitKind;label:string}[] = [
    {value:"fixed",        label:"固定等待"},
    {value:"el-appear",    label:"等待元素出现"},
    {value:"el-disappear", label:"等待元素消失"},
    {value:"el-clickable", label:"等待可点击"},
    {value:"url",          label:"等待页面 URL"},
    {value:"network",      label:"等待网络请求"},
    {value:"js-cond",      label:"等待 JS 条件"},
  ];
  return(
    <div>
      <div style={{marginBottom:14}}>
        <FL required>等待类型</FL>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {kinds.map(k=>(
            <button key={k.value} onClick={()=>setKind(k.value)}
              style={{padding:"5px 14px",borderRadius:7,border:`1px solid ${kind===k.value?T.primary:T.border}`,fontSize:12,fontWeight:kind===k.value?700:400,background:kind===k.value?`${T.primary}0D`:"#fff",color:kind===k.value?T.primary:T.t3,cursor:"pointer"}}>
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {kind==="fixed"&&(
        <div><FL required>等待时间</FL>
          <div style={{display:"flex",alignItems:"center",gap:6}}><input type="number" defaultValue="2000" style={{width:100,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/><span style={{fontSize:12,color:T.t4}}>ms</span></div>
        </div>
      )}
      {["el-appear","el-disappear","el-clickable"].includes(kind)&&(
        <div style={{marginBottom:12}}>
          <FL required>目标元素（在「目标元素」Tab 中配置）</FL>
          <div style={{padding:"8px 12px",border:`1px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t3,background:"#FAFBFE",display:"flex",alignItems:"center",gap:5}}><Target size={12}/> 请在「目标元素」Tab 中选择目标元素</div>
        </div>
      )}
      {(["el-appear","el-disappear","el-clickable"].includes(kind)||kind==="url"||kind==="network"||kind==="js-cond")&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><FL required>最大等待时间</FL>
            <div style={{display:"flex",alignItems:"center",gap:6}}><input type="number" defaultValue="30000" style={{flex:1,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/><span style={{fontSize:12,color:T.t4}}>ms</span></div>
          </div>
          <div><FL>超时处理</FL>
            <select style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
              <option>中止步骤，标记失败</option><option>跳过，继续执行</option><option>记录警告并继续</option>
            </select>
          </div>
        </div>
      )}
      {kind==="url"&&(
        <div style={{marginTop:12}}>
          <FL required>期望 URL 条件</FL>
          <div style={{display:"flex",gap:6}}>
            <select style={{width:120,height:34,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}><option>等于</option><option>包含</option><option>正则</option></select>
            <FInput defaultValue="{{base_url}}/dashboard" mono/>
          </div>
        </div>
      )}
      {kind==="js-cond"&&(
        <div style={{marginTop:12}}>
          <FL required>JavaScript 条件</FL>
          <textarea defaultValue="() => document.readyState === 'complete' && window.__appReady === true" rows={3}
            style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:T.t1,outline:"none",resize:"none"}}/>
        </div>
      )}
    </div>
  );
}

function ClickInputConfig({stepType}:{stepType:UIStepType}){
  const isInput = stepType==="input";
  const [subAction,setSubAction]=useState(isInput?"input-text":"left-click");
  const [clearFirst,setClearFirst]=useState(true);
  const [pressEnter,setPressEnter]=useState(false);

  const clickActions = [{v:"left-click",l:"左键单击"},{v:"right-click",l:"右键单击"},{v:"dbl-click",l:"双击"},{v:"hover",l:"悬停"},{v:"scroll-to",l:"滚动到此元素"}];
  const inputActions = [{v:"input-text",l:"输入文本"},{v:"clear",l:"清空输入框"},{v:"select-option",l:"选择下拉项"},{v:"check",l:"勾选"},{v:"uncheck",l:"取消勾选"},{v:"keyboard",l:"键盘输入"}];
  const actions = isInput ? inputActions : clickActions;

  return(
    <div>
      <div style={{marginBottom:14}}>
        <FL required>操作类型</FL>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {actions.map(a=>(
            <button key={a.v} onClick={()=>setSubAction(a.v)}
              style={{padding:"5px 14px",borderRadius:7,border:`1px solid ${subAction===a.v?T.primary:T.border}`,fontSize:12,fontWeight:subAction===a.v?700:400,background:subAction===a.v?`${T.primary}0D`:"#fff",color:subAction===a.v?T.primary:T.t3,cursor:"pointer"}}>
              {a.l}
            </button>
          ))}
        </div>
      </div>

      {(subAction==="input-text"||subAction==="select-option")&&(
        <div style={{marginBottom:14}}>
          <FL required>{subAction==="input-text"?"输入内容":"选项值"}</FL>
          <FInput defaultValue={subAction==="input-text"?"{{test_username}}":"{{dropdown_value}}"} mono placeholder={subAction==="input-text"?"输入内容，支持 {{变量}} 引用":"选项文本或 value 值，支持 {{变量}}"}/>
          {subAction==="input-text"&&(
            <div style={{fontSize:11,color:T.t4,marginTop:3}}>支持变量替换，例如 {"{{username}}"} 将在执行时被替换为环境变量值</div>
          )}
        </div>
      )}

      {subAction==="keyboard"&&(
        <div style={{marginBottom:14}}>
          <FL required>按键序列</FL>
          <FInput defaultValue="Control+A, Control+C" mono placeholder="例如：Enter, Tab, Control+A"/>
          <div style={{fontSize:11,color:T.t4,marginTop:3}}>使用逗号分隔多个按键，修饰键用 + 连接，例如 Control+Shift+F5</div>
        </div>
      )}

      {subAction==="input-text"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            {label:"输入前清空输入框",desc:"输入内容前先清空原有内容",val:clearFirst,set:setClearFirst},
            {label:"输入后按 Enter 提交",desc:"输入完成后模拟按下回车键",val:pressEnter,set:setPressEnter},
          ].map(s=>(
            <div key={s.label} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:7}}>
              <div style={{flex:1,fontSize:12}}>
                <div style={{color:T.t1,fontWeight:500}}>{s.label}</div>
                <div style={{color:T.t4,fontSize:11}}>{s.desc}</div>
              </div>
              <SmToggle on={s.val} onChange={s.set}/>
            </div>
          ))}
        </div>
      )}

      {(subAction==="left-click"||subAction==="dbl-click")&&(
        <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:7}}>
            <div style={{flex:1,fontSize:12,color:T.t1,fontWeight:500}}>点击后等待页面稳定</div>
            <SmToggle on={true} onChange={()=>{}}/>
          </div>
          <div>
            <FL>点击偏移（可选）</FL>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontSize:12,color:T.t3}}>X:</span>
              <input type="number" defaultValue="0" style={{width:60,height:32,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}/>
              <span style={{fontSize:12,color:T.t3}}>Y:</span>
              <input type="number" defaultValue="0" style={{width:60,height:32,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}/>
              <span style={{fontSize:11,color:T.t4}}>像素偏移（相对元素中心）</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScriptStepConfig(){
  const SAMPLE=`// 可用对象: page, context, browser, env, log, assert
// 当前页面引用: page
const url = await page.url();
log.info('当前页面: ' + url);

// 设置场景变量
env.set('currentUrl', url);

// 自定义断言
assert(url.includes('/dashboard'), '页面应在 dashboard');`;
  return(
    <div>
      <div style={{marginBottom:12}}>
        <FL>运行超时</FL>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <input type="number" defaultValue="10000" style={{width:100,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/>
          <span style={{fontSize:12,color:T.t4}}>ms</span>
        </div>
      </div>
      <div style={{marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <FL>脚本内容</FL>
        <div style={{display:"flex",gap:6}}>
          <button style={{fontSize:11,padding:"3px 10px",border:`1px solid ${T.border}`,borderRadius:5,background:"#fff",color:T.t2,cursor:"pointer"}}>内置函数</button>
          <button style={{fontSize:11,padding:"3px 10px",border:`1px solid ${T.border}`,borderRadius:5,background:"#fff",color:T.t2,cursor:"pointer"}}>可用变量</button>
        </div>
      </div>
      <div style={{border:`1.5px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",padding:"5px 12px",background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
          <Terminal size={11} style={{color:T.warning,marginRight:5}}/>
          <span style={{fontSize:11,fontWeight:600,color:T.t3}}>JavaScript (Playwright API)</span>
          <div style={{flex:1}}/>
          <button style={{fontSize:11,color:T.primary,border:"none",background:"none",cursor:"pointer"}}>验证语法</button>
        </div>
        <textarea defaultValue={SAMPLE} rows={9} spellCheck={false}
          style={{width:"100%",boxSizing:"border-box",border:"none",outline:"none",resize:"none",fontFamily:"'JetBrains Mono',monospace",fontSize:12,lineHeight:1.7,color:T.t1,padding:"10px 14px"}}/>
      </div>
    </div>
  );
}

function SwitchWindowConfig(){
  const [switchTo,setSwitchTo]=useState<"new-window"|"tab-index"|"tab-url">("new-window");
  return(
    <div>
      <div style={{marginBottom:14}}>
        <FL required>切换目标</FL>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
          {[{v:"new-window",l:"切换到新弹出窗口"},{v:"tab-index",l:"按 Tab 索引"},{v:"tab-url",l:"按 Tab URL"}].map(o=>(
            <button key={o.v} onClick={()=>setSwitchTo(o.v as any)}
              style={{padding:"5px 14px",borderRadius:7,border:`1px solid ${switchTo===o.v?T.primary:T.border}`,fontSize:12,fontWeight:switchTo===o.v?700:400,background:switchTo===o.v?`${T.primary}0D`:"#fff",color:switchTo===o.v?T.primary:T.t3,cursor:"pointer"}}>
              {o.l}
            </button>
          ))}
        </div>
        {switchTo==="new-window"&&<AlertBanner type="info">执行此步骤后，后续步骤将在新弹出的浏览器窗口中执行。如需返回原窗口，添加「切换浏览器窗口」步骤并选择原窗口索引。</AlertBanner>}
        {switchTo==="tab-index"&&(
          <div><FL required>Tab 索引（从 0 开始）</FL>
            <input type="number" defaultValue="1" style={{width:80,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/>
          </div>
        )}
        {switchTo==="tab-url"&&(
          <div><FL required>Tab URL 匹配</FL>
            <FInput defaultValue="{{base_url}}/payment" mono placeholder="URL 包含该字符串的 Tab"/>
          </div>
        )}
      </div>
      <div>
        <FL>等待新窗口超时</FL>
        <div style={{display:"flex",alignItems:"center",gap:6}}><input type="number" defaultValue="10000" style={{width:100,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/><span style={{fontSize:12,color:T.t4}}>ms</span></div>
      </div>
    </div>
  );
}

function WaitStrategyTab(){
  const [waitFor,setWaitFor]=useState<"networkidle"|"element"|"fixed"|"none">("element");
  return(
    <div>
      <div style={{marginBottom:14}}>
        <FL tip="步骤操作完成后，等待满足条件再继续下一步骤">操作后等待策略</FL>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {[{v:"none",l:"不等待（立即继续）"},{v:"fixed",l:"固定时间等待"},{v:"element",l:"等待特定元素"},{v:"networkidle",l:"等待网络空闲"}].map(o=>(
            <button key={o.v} onClick={()=>setWaitFor(o.v as any)}
              style={{padding:"5px 14px",borderRadius:7,border:`1px solid ${waitFor===o.v?T.primary:T.border}`,fontSize:12,fontWeight:waitFor===o.v?700:400,background:waitFor===o.v?`${T.primary}0D`:"#fff",color:waitFor===o.v?T.primary:T.t3,cursor:"pointer"}}>
              {o.l}
            </button>
          ))}
        </div>
      </div>
      {waitFor==="fixed"&&(
        <div><FL required>等待时间</FL>
          <div style={{display:"flex",alignItems:"center",gap:6}}><input type="number" defaultValue="1000" style={{width:100,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/><span style={{fontSize:12,color:T.t4}}>ms</span></div>
        </div>
      )}
      {waitFor==="element"&&(
        <div style={{marginBottom:14}}>
          <FL required>等待条件</FL>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <select style={{width:160,height:34,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
              <option>元素出现</option><option>元素消失</option><option>元素可点击</option><option>元素可见</option>
            </select>
            <div style={{flex:1,height:34,border:`1.5px solid ${T.border}`,borderRadius:7,display:"flex",alignItems:"center",gap:6,padding:"0 10px",fontSize:12,color:T.t2}}>
              <Target size={12} style={{color:T.t4}}/> 欢迎提示文字
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:12,color:T.t3}}>超时</span>
            <input type="number" defaultValue="10000" style={{width:90,height:32,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}/>
            <span style={{fontSize:12,color:T.t4}}>ms</span>
          </div>
        </div>
      )}
      {waitFor==="networkidle"&&(
        <div>
          <FL>网络空闲等待时间</FL>
          <div style={{display:"flex",alignItems:"center",gap:6}}><input type="number" defaultValue="500" style={{width:90,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/><span style={{fontSize:12,color:T.t4}}>ms（连续无网络请求的持续时间）</span></div>
        </div>
      )}

      <div style={{marginTop:16}}>
        <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:10}}>步骤超时</div>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",border:`1px solid ${T.border}`,borderRadius:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:500,color:T.t1}}>步骤最大执行时间</div>
            <div style={{fontSize:11,color:T.t4}}>超过此时间强制终止步骤，设为 0 则使用用例默认超时</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <input type="number" defaultValue="0" style={{width:72,height:32,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}/>
            <span style={{fontSize:11,color:T.t4}}>ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FailHandleTab(){
  const [onFail,setOnFail]=useState<"stop"|"continue"|"retry">("stop");
  const [retryCount,setRetryCount]=useState("2");
  return(
    <div>
      <div style={{marginBottom:14}}>
        <FL required>步骤失败处理</FL>
        {[
          {v:"stop",    l:"中止用例",      d:"步骤失败后立即停止执行，标记用例为失败"},
          {v:"continue",l:"忽略并继续",    d:"步骤失败后记录错误，但继续执行后续步骤"},
          {v:"retry",   l:"自动重试",      d:"失败后自动重试指定次数，全部失败后再决定"},
        ].map(o=>(
          <div key={o.v} onClick={()=>setOnFail(o.v as any)}
            style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 14px",border:`1px solid ${onFail===o.v?T.primary:T.border}`,borderRadius:8,marginBottom:8,cursor:"pointer",background:onFail===o.v?`${T.primary}05`:"#fff"}}>
            <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${onFail===o.v?T.primary:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,background:onFail===o.v?T.primary:"#fff"}}>
              {onFail===o.v&&<div style={{width:6,height:6,borderRadius:"50%",background:"#fff"}}/>}
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:onFail===o.v?T.primary:T.t1,marginBottom:2}}>{o.l}</div>
              <div style={{fontSize:12,color:T.t3}}>{o.d}</div>
            </div>
          </div>
        ))}
      </div>

      {onFail==="retry"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div>
            <FL required>重试次数</FL>
            <div style={{display:"flex",alignItems:"center",gap:6}}><input type="number" value={retryCount} onChange={e=>setRetryCount(e.target.value)} style={{width:60,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/><span style={{fontSize:12,color:T.t4}}>次</span></div>
          </div>
          <div>
            <FL>重试间隔</FL>
            <div style={{display:"flex",alignItems:"center",gap:6}}><input type="number" defaultValue="1000" style={{width:80,height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}/><span style={{fontSize:12,color:T.t4}}>ms</span></div>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <FL>全部重试失败后</FL>
            <select style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}><option>中止用例</option><option>忽略并继续</option></select>
          </div>
        </div>
      )}

      <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",border:`1px solid ${T.border}`,borderRadius:8}}>
        <div style={{flex:1}}>
          <div style={{fontSize:12,fontWeight:500,color:T.t1}}>失败时截图</div>
          <div style={{fontSize:11,color:T.t4}}>步骤失败时自动截取页面截图，附加到执行报告</div>
        </div>
        <SmToggle on={true} onChange={()=>{}}/>
      </div>
    </div>
  );
}

export function StepConfigDrawer({onClose,onFrameShadow}:{onClose:()=>void;onFrameShadow?:()=>void}){
  const [stepType,setStepType]=useState<UIStepType>("click");
  const [stepState,setStepState]=useState<UIStepState>("editing");
  const [stepName,setStepName]=useState("点击「登录按钮」");
  const [enabled,setEnabled]=useState(true);
  const [activeTab,setActiveTab]=useState("基础配置");
  const [elemSrcState,setElemSrcState]=useState<ElemSrcState>("library-selected");
  const [assertState,setAssertState]=useState<AssertionState>("multi");
  const [debugState,setDebugState]=useState<DebugState>("idle");
  const [fileState,setFileState]=useState<FileUploadState>("platform-file");

  const cfg=UI_STEP_CFG[stepType];
  const Icon=cfg.icon;
  const isSaving = stepState==="saving";
  const isDebugging = stepState==="debug-running";

  const debugStateForPanel: DebugState =
    stepState==="debug-running"?"executing":
    stepState==="debug-success"?"success":
    stepState==="debug-fail"?"locate-fail":
    stepState==="debug-timeout"?"timeout":
    stepState==="debug-crash"?"crash":
    stepState==="locate-fail"?"locate-fail":
    stepState==="runner-offline"?"runner-offline":
    stepState==="cancelled"?"cancelled":
    debugState;

  const tabs = ["基础配置","目标元素","等待策略","失败处理","断言","调试结果"];
  const needsElement = ["click","input","upload","wait"].includes(stepType);

  const tabLabels = tabs.map(t=>{
    const hasDot = t==="调试结果"&&["debug-success","debug-fail","debug-timeout","debug-crash","locate-fail"].includes(stepState);
    const dotColor = stepState==="debug-success"?T.success:T.danger;
    return {label:t,hasDot,dotColor};
  });

  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.18)",zIndex:800}}/>
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:740,zIndex:801,background:"#fff",boxShadow:"-4px 0 28px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column"}}>

        {/* Fixed header */}
        <div style={{flexShrink:0,borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 20px 8px"}}>
            <div style={{width:32,height:32,borderRadius:8,background:cfg.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <Icon size={15} style={{color:cfg.color}}/>
            </div>
            <div style={{flex:1}}>
              <input value={stepName} onChange={e=>setStepName(e.target.value)}
                style={{fontSize:15,fontWeight:700,color:T.t1,border:"none",outline:"none",width:"100%",padding:0,background:"transparent"}}/>
            </div>
            <UIStepBadge type={stepType}/>
            <SmToggle on={enabled} onChange={setEnabled}/>
            <span style={{fontSize:11,color:enabled?T.success:T.t4}}>{enabled?"已启用":"已停用"}</span>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:4}}><X size={16}/></button>
          </div>

          {/* Step type selector (demo) */}
          <div style={{display:"flex",gap:2,padding:"4px 20px 6px",overflowX:"auto"}}>
            {STEP_TYPE_DEMO.map(s=>(
              <button key={s.value} onClick={()=>{setStepType(s.value);setActiveTab("基础配置");setStepName(s.label==="点击"?"点击「登录按钮」":s.label==="输入文本"?"输入用户名":s.label==="上传文件"?"上传头像文件":s.label);}}
                style={{padding:"3px 10px",borderRadius:5,border:`1px solid ${stepType===s.value?cfg.color:T.border}`,fontSize:11,fontWeight:stepType===s.value?700:400,background:stepType===s.value?cfg.bg:"transparent",color:stepType===s.value?cfg.color:T.t3,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div style={{display:"flex",borderTop:`1px solid ${T.border}`}}>
            {tabLabels.map(({label:t,hasDot,dotColor})=>(
              <button key={t} onClick={()=>setActiveTab(t)}
                style={{height:36,padding:"0 14px",border:"none",borderBottom:`2px solid ${activeTab===t?T.primary:"transparent"}`,background:"transparent",fontSize:12,fontWeight:500,color:activeTab===t?T.primary:T.t3,cursor:"pointer",position:"relative",whiteSpace:"nowrap"}}>
                {t}
                {hasDot&&<span style={{position:"absolute",top:6,right:5,width:6,height:6,borderRadius:"50%",background:dotColor}}/>}
                {t==="目标元素"&&!needsElement&&<span style={{fontSize:9,color:T.t4,marginLeft:2}}>N/A</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",minHeight:0}}>

          {activeTab==="基础配置"&&(
            stepType==="navigate"?<NavigateConfig/>:
            stepType==="wait"?<WaitConfig/>:
            stepType==="script"?<ScriptStepConfig/>:
            stepType==="upload"?<FileUploadConfig demoState={fileState}/>:
            stepType==="switch-win"?<SwitchWindowConfig/>:
            <ClickInputConfig stepType={stepType}/>
          )}

          {activeTab==="目标元素"&&(
            !needsElement?(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"50px 0",gap:8,color:T.t4}}>
                <Target size={28} style={{opacity:0.25}}/>
                <div style={{fontSize:13,color:T.t3}}>{stepType==="navigate"?"页面导航步骤不需要目标元素":stepType==="script"?"脚本步骤通过代码访问页面元素":"此步骤类型无需配置目标元素"}</div>
              </div>
            ):(
              <div>
                <div style={{marginBottom:14}}>
                  <FL required>目标元素</FL>
                  <ElementSelectorPanel demoState={elemSrcState} onFrameShadow={onFrameShadow}/>
                  <div style={{marginTop:6,display:"flex",gap:6,flexWrap:"wrap"}}>
                    {(["library-empty","library-selected","inline-locator","override","element-changed","element-deleted","no-permission"] as ElemSrcState[]).map(s=>(
                      <button key={s} onClick={()=>setElemSrcState(s)}
                        style={{padding:"2px 8px",borderRadius:4,border:`1px solid ${elemSrcState===s?T.primary:T.border}`,fontSize:10,color:elemSrcState===s?T.primary:T.t4,background:elemSrcState===s?`${T.primary}0A`:"transparent",cursor:"pointer"}}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}

          {activeTab==="等待策略"&&<WaitStrategyTab/>}
          {activeTab==="失败处理"&&<FailHandleTab/>}

          {activeTab==="断言"&&(
            <div>
              <WebUIAssertionEditor demoState={assertState}/>
              <div style={{marginTop:10,display:"flex",gap:4,flexWrap:"wrap"}}>
                {(["multi","pass","fail","element-not-found","screenshot-diff","baseline-missing","unresolved"] as AssertionState[]).map(s=>(
                  <button key={s} onClick={()=>setAssertState(s)}
                    style={{padding:"2px 8px",borderRadius:4,border:`1px solid ${assertState===s?T.primary:T.border}`,fontSize:10,color:assertState===s?T.primary:T.t4,background:assertState===s?`${T.primary}0A`:"transparent",cursor:"pointer"}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab==="调试结果"&&(
            <div>
              <StepDebugPanel demoState={debugStateForPanel}/>
              {stepState==="editing"&&(
                <div style={{marginTop:10}}>
                  <div style={{fontSize:11,color:T.t4,marginBottom:6}}>调试状态预览（仅限设计稿）：</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {(["idle","waiting-runner","launching","loading","locating","executing","success","locate-fail","timeout","page-closed","crash","runner-offline","cancelled"] as DebugState[]).map(s=>(
                      <button key={s} onClick={()=>setDebugState(s)}
                        style={{padding:"2px 8px",borderRadius:4,border:`1px solid ${debugState===s?T.primary:T.border}`,fontSize:10,color:debugState===s?T.primary:T.t4,background:debugState===s?`${T.primary}0A`:"transparent",cursor:"pointer"}}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed footer */}
        <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",gap:8,justifyContent:"flex-end",background:"#fff"}}>
          <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>取消</button>
          <button disabled={isSaving} onClick={()=>setStepState("saving")}
            style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer",display:"flex",alignItems:"center",gap:5,opacity:isSaving?0.6:1}}>
            {isSaving&&<Loader2 size={12} style={{animation:"spin 1s linear infinite"}}/>}
            {isSaving?"保存中…":"保存"}
          </button>
          <button disabled={isDebugging} onClick={()=>{setStepState("debug-running");setActiveTab("调试结果");setTimeout(()=>setStepState("debug-success"),1800);}}
            style={{padding:"7px 22px",border:"none",borderRadius:7,background:isDebugging?T.t4:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:isDebugging?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:5}}>
            {isDebugging&&<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>}
            <Zap size={13}/>{isDebugging?"调试中…":"保存并调试"}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Step type DemoBar at bottom+44 */}
      <DemoBar states={STEP_TYPE_DEMO} current={stepType} onChange={v=>{setStepType(v);setActiveTab("基础配置");}} label="步骤类型" bottom={44}/>
      {/* Step state DemoBar at bottom */}
      <DemoBar states={STEP_STATE_DEMO} current={stepState} onChange={setStepState} label="调试状态" bottom={0}/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. ElementDeleteDialog — 删除 / 禁用元素确认弹窗
// ─────────────────────────────────────────────────────────────────────────────
type DeleteState = "no-refs"|"has-refs"|"disable-instead"|"batch-delete"|"batch-disable"|"partial-success"|"no-permission"|"delete-failed";

const DELETE_DEMO:{value:DeleteState;label:string}[] = [
  {value:"no-refs",         label:"无引用删除"},
  {value:"has-refs",        label:"存在引用"},
  {value:"disable-instead", label:"改为禁用"},
  {value:"batch-delete",    label:"批量删除"},
  {value:"batch-disable",   label:"批量禁用"},
  {value:"partial-success", label:"部分成功"},
  {value:"no-permission",   label:"无权限"},
  {value:"delete-failed",   label:"删除失败"},
];

const BATCH_ITEMS = [
  {id:"e1",name:"登录按钮",    refs:14,canDelete:false,result:null as null|"ok"|"fail"|"blocked"},
  {id:"e2",name:"用户名输入框", refs:12,canDelete:false,result:null as null|"ok"|"fail"|"blocked"},
  {id:"e3",name:"欢迎提示文字", refs:0, canDelete:true, result:null as null|"ok"|"fail"|"blocked"},
  {id:"e4",name:"页脚版权文字", refs:1, canDelete:false,result:null as null|"ok"|"fail"|"blocked"},
];

export function ElementDeleteDialog({onClose}:{onClose:()=>void}){
  const [demoState,setDemoState]=useState<DeleteState>("has-refs");
  const [confirmText,setConfirmText]=useState("");

  const isHasRefs      = demoState==="has-refs";
  const isNoRefs       = demoState==="no-refs";
  const isDisableAlt   = demoState==="disable-instead";
  const isBatchDelete  = demoState==="batch-delete";
  const isBatchDisable = demoState==="batch-disable";
  const isPartial      = demoState==="partial-success";
  const isNoPerm       = demoState==="no-permission";
  const isFailed       = demoState==="delete-failed";

  const batchItems = BATCH_ITEMS.map(i=>({
    ...i,
    result: isPartial?(i.id==="e3"?"ok":i.id==="e4"?"fail":i.canDelete?"ok":"blocked"):null,
  }));

  const needsConfirmInput = isHasRefs;
  const confirmMatch = confirmText==="登录按钮";
  const canSubmit = !needsConfirmInput||confirmMatch;

  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.2)",zIndex:1100}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:1101,background:"#fff",borderRadius:12,width:520,maxHeight:"82vh",display:"flex",flexDirection:"column",boxShadow:"0 12px 48px rgba(0,0,0,0.16)"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{width:36,height:36,borderRadius:8,background:"#FFE8E8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Trash2 size={16} style={{color:T.danger}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:T.t1}}>
              {isBatchDelete?"批量删除元素":isBatchDisable?"批量禁用元素":isDisableAlt?"禁用元素":"删除元素"}
            </div>
            <div style={{fontSize:12,color:T.t3,marginTop:1}}>
              {isBatchDelete||isBatchDisable?`已选 ${BATCH_ITEMS.length} 个元素`:"登录按钮 · 登录页"}
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0}}><X size={15}/></button>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",minHeight:0}}>

          {/* No permission */}
          {isNoPerm&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"40px 0",gap:10}}>
              <Lock size={36} style={{color:T.t4,opacity:0.4}}/>
              <div style={{fontSize:14,color:T.t2,fontWeight:500}}>无操作权限</div>
              <div style={{fontSize:12,color:T.t4,textAlign:"center"}}>您没有删除该元素的权限，请联系项目管理员。</div>
            </div>
          )}

          {/* Delete failed */}
          {isFailed&&(
            <div>
              <AlertBanner type="error"><strong>删除失败</strong> — 服务器处理删除请求时出现异常（500 Internal Server Error）。元素未被删除，请稍后重试或联系管理员。</AlertBanner>
              <div style={{padding:"12px 14px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.t2}}>
                <div style={{fontWeight:500,color:T.t1,marginBottom:6}}>元素信息</div>
                <div style={{display:"flex",gap:10}}>
                  <span style={{color:T.t4,width:80}}>名称</span><span>登录按钮</span>
                </div>
                <div style={{display:"flex",gap:10,marginTop:4}}>
                  <span style={{color:T.t4,width:80}}>所属页面</span><span>登录页</span>
                </div>
              </div>
            </div>
          )}

          {/* No refs — simple confirm */}
          {isNoRefs&&(
            <div>
              <AlertBanner type="warn">删除后元素将永久移除，无法恢复。该元素当前没有被任何用例或步骤引用，可以安全删除。</AlertBanner>
              <div style={{padding:"12px 14px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.t2,display:"flex",gap:16}}>
                <div>
                  <div style={{color:T.t4,marginBottom:3}}>元素名称</div>
                  <div style={{fontWeight:500,color:T.t1}}>欢迎提示文字</div>
                </div>
                <div>
                  <div style={{color:T.t4,marginBottom:3}}>所属页面</div>
                  <div style={{fontWeight:500,color:T.t1}}>首页</div>
                </div>
                <div>
                  <div style={{color:T.t4,marginBottom:3}}>定位器数量</div>
                  <div style={{fontWeight:500,color:T.t1}}>2 条</div>
                </div>
              </div>
            </div>
          )}

          {/* Has refs — block direct delete */}
          {isHasRefs&&(
            <div>
              <AlertBanner type="error">
                <strong>无法直接删除</strong> — 该元素被 <strong>14 个用例</strong> 的 <strong>21 个步骤</strong>引用，删除后这些步骤将无法定位目标元素，导致用例执行失败。
                <div style={{marginTop:6}}>请先解除引用，或选择「禁用元素」代替删除。</div>
              </AlertBanner>

              {/* Impact stats */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                {[{l:"引用用例",v:"14",c:T.danger},{l:"引用步骤",v:"21",c:T.danger},{l:"所属套件",v:"3",c:T.t1}].map(s=>(
                  <div key={s.l} style={{padding:"10px",border:`1px solid ${T.border}`,borderRadius:8,textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:11,color:T.t4,marginTop:2}}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* High-priority refs */}
              <SCard title="引用该元素的用例（前 5 条）" action={<button style={{fontSize:11,color:T.primary,border:"none",background:"none",cursor:"pointer"}}>查看全部</button>}>
                {[
                  {name:"用户正常登录流程",priority:"P0",steps:4,suite:"冒烟测试套件"},
                  {name:"记住密码功能验证", priority:"P0",steps:1,suite:"回归测试套件"},
                  {name:"多账号切换场景",   priority:"P1",steps:2,suite:"—"},
                  {name:"登录超时处理",     priority:"P1",steps:1,suite:"—"},
                  {name:"第三方登录（Google）",priority:"P2",steps:3,suite:"—"},
                ].map((r,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:i<4?`1px solid ${T.border}`:"none",fontSize:12}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"1px 5px",borderRadius:3,background:r.priority==="P0"?"#FFE8E8":r.priority==="P1"?"#FFF3E8":"#F2F3F5",color:r.priority==="P0"?T.danger:r.priority==="P1"?T.warning:T.t4}}>{r.priority}</span>
                    <span style={{flex:1,color:T.t1}}>{r.name}</span>
                    <span style={{color:T.t4}}>{r.steps} 步骤</span>
                    <ExternalLink size={10} style={{color:T.t4,cursor:"pointer"}}/>
                  </div>
                ))}
              </SCard>

              {/* Disable alternative */}
              <div style={{padding:"12px 14px",border:`2px solid ${T.primary}30`,borderRadius:9,background:`${T.primary}04`,marginBottom:14}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <AlertCircle size={15} style={{color:T.primary,flexShrink:0,marginTop:1}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:T.primary,marginBottom:3}}>建议：禁用元素代替删除</div>
                    <div style={{fontSize:12,color:T.t2,lineHeight:1.6}}>禁用后元素会保留在库中，引用该元素的步骤在执行时会跳过或标记为警告，不会直接失败。待引用关系处理完毕后再彻底删除。</div>
                  </div>
                </div>
              </div>

              {/* Confirm input — force type name */}
              <div>
                <div style={{fontSize:12,color:T.t2,marginBottom:6}}>
                  如果确认要强制删除，请输入元素名称 <code style={{fontFamily:"monospace",background:"#F2F3F5",padding:"1px 5px",borderRadius:3}}>登录按钮</code> 进行确认：
                </div>
                <FInput value={confirmText} onChange={setConfirmText} placeholder="请输入元素名称…" error={confirmText.length>0&&!confirmMatch}/>
                {confirmText.length>0&&!confirmMatch&&<div style={{fontSize:11,color:T.danger,marginTop:3}}>名称不匹配，请确认输入</div>}
              </div>
            </div>
          )}

          {/* Disable instead confirm */}
          {isDisableAlt&&(
            <div>
              <AlertBanner type="info">禁用元素后，该元素仍会保留在元素库中，但引用它的步骤在执行时将被跳过并记录警告。您可以随时重新启用该元素。</AlertBanner>
              <div style={{padding:"12px 14px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,display:"flex",gap:16,marginBottom:12}}>
                <div>
                  <div style={{color:T.t4,marginBottom:3}}>元素名称</div>
                  <div style={{fontWeight:500,color:T.t1}}>登录按钮</div>
                </div>
                <div>
                  <div style={{color:T.t4,marginBottom:3}}>引用用例数</div>
                  <div style={{fontWeight:500,color:T.t1}}>14 个</div>
                </div>
                <div>
                  <div style={{color:T.t4,marginBottom:3}}>引用步骤数</div>
                  <div style={{fontWeight:500,color:T.t1}}>21 个</div>
                </div>
              </div>
              <AlertBanner type="warn">禁用后，<strong>14 个用例</strong>中引用该元素的步骤将在下次执行时标记为「已跳过（元素不可用）」，不会失败但会影响覆盖率统计。</AlertBanner>
            </div>
          )}

          {/* Batch delete */}
          {(isBatchDelete||isBatchDisable)&&(
            <div>
              {isBatchDelete&&<AlertBanner type="error">以下 <strong>4 个元素</strong>中，<strong>3 个存在引用关系</strong>，无法直接删除。仅 1 个无引用元素可以删除。如需删除存在引用的元素，请逐一处理引用关系。</AlertBanner>}
              {isBatchDisable&&<AlertBanner type="warn">禁用后，所有引用这 4 个元素的步骤将在执行时被跳过并记录警告。请确认影响范围。</AlertBanner>}

              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {batchItems.map((item,i)=>(
                  <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:`1px solid ${item.canDelete||isBatchDisable?T.border:T.danger}30`,borderRadius:8,background:!item.canDelete&&isBatchDelete?"#FFF5F5":"#fff",fontSize:12}}>
                    {isBatchDelete?(
                      item.canDelete?<CheckCircle size={14} style={{color:T.success,flexShrink:0}}/>:<XCircle size={14} style={{color:T.danger,flexShrink:0}}/>
                    ):<CheckCircle size={14} style={{color:T.warning,flexShrink:0}}/>}
                    <span style={{flex:1,fontWeight:500,color:T.t1}}>{item.name}</span>
                    {item.refs>0?(
                      <span style={{fontSize:11,color:isBatchDelete?T.danger:T.warning}}>引用 {item.refs} 个用例</span>
                    ):(
                      <span style={{fontSize:11,color:T.t4}}>无引用</span>
                    )}
                    {isBatchDelete&&(
                      <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,background:item.canDelete?"#E8FFEA":"#FFE8E8",color:item.canDelete?T.success:T.danger}}>
                        {item.canDelete?"可删除":"有引用"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Partial success */}
          {isPartial&&(
            <div>
              <AlertBanner type="warn"><strong>部分操作成功</strong> — 4 个元素中，2 个已成功删除，1 个因存在引用被阻止，1 个因服务器错误删除失败。</AlertBanner>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {batchItems.map((item,i)=>{
                  const r=item.result;
                  const bc=r==="ok"?T.success:r==="fail"?T.danger:T.warning;
                  const bg=r==="ok"?"#E8FFEA":r==="fail"?"#FFE8E8":"#FFF3E8";
                  const rl=r==="ok"?"已删除":r==="fail"?"删除失败（服务器错误）":"有引用，已阻止";
                  const Icon=r==="ok"?CheckCircle:r==="fail"?XCircle:AlertTriangle;
                  return(
                    <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:`1px solid ${bc}20`,borderRadius:8,background:bg,fontSize:12}}>
                      <Icon size={14} style={{color:bc,flexShrink:0}}/>
                      <span style={{flex:1,fontWeight:500,color:T.t1}}>{item.name}</span>
                      <span style={{fontSize:11,color:bc,fontWeight:600}}>{rl}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isNoPerm&&!isPartial&&!isFailed&&(
          <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",gap:8,justifyContent:"flex-end",background:"#fff"}}>
            <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>取消</button>
            {isHasRefs&&(
              <button onClick={()=>setDemoState("disable-instead")} style={{padding:"7px 18px",border:`1px solid ${T.primary}`,borderRadius:7,background:"#fff",fontSize:13,color:T.primary,cursor:"pointer"}}>改为禁用</button>
            )}
            {isBatchDelete&&(
              <button style={{padding:"7px 18px",border:`1px solid ${T.primary}`,borderRadius:7,background:"#fff",fontSize:13,color:T.primary,cursor:"pointer"}}>仅删除可删除项（1 个）</button>
            )}
            <button onClick={onClose} disabled={needsConfirmInput&&!confirmMatch}
              style={{padding:"7px 22px",border:"none",borderRadius:7,background:needsConfirmInput&&!confirmMatch?T.t4:T.danger,color:"#fff",fontSize:13,fontWeight:500,cursor:needsConfirmInput&&!confirmMatch?"not-allowed":"pointer"}}>
              {isDisableAlt?"确认禁用":isBatchDisable?"全部禁用":isBatchDelete?"强制删除所有":"确认删除"}
            </button>
          </div>
        )}
        {(isPartial||isFailed)&&(
          <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{padding:"7px 22px",border:"none",borderRadius:7,background:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"}}>知道了</button>
          </div>
        )}
        {isNoPerm&&(
          <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>关闭</button>
          </div>
        )}
      </div>

      <DemoBar states={DELETE_DEMO} current={demoState} onChange={setDemoState} label="删除确认状态"/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. UnsavedChangesDialog — 未保存修改确认弹窗
// ─────────────────────────────────────────────────────────────────────────────
type UnsavedState = "single"|"multi"|"saving"|"autosaved";

const UNSAVED_DEMO:{value:UnsavedState;label:string}[] = [
  {value:"single",    label:"单步骤未保存"},
  {value:"multi",     label:"多步骤未保存"},
  {value:"saving",    label:"正在保存中"},
  {value:"autosaved", label:"已自动保存草稿"},
];

export function UnsavedChangesDialog({onClose}:{onClose:()=>void}){
  const [demoState,setDemoState]=useState<UnsavedState>("single");

  const isSingle    = demoState==="single";
  const isMulti     = demoState==="multi";
  const isSaving    = demoState==="saving";
  const isAutosaved = demoState==="autosaved";

  const changedFields = [
    {field:"步骤名称",from:"点击登录按钮",to:"点击「登录」按钮"},
    {field:"等待策略",from:"不等待",to:"等待元素出现（欢迎提示）"},
    {field:"失败处理",from:"中止用例",to:"自动重试 2 次"},
  ];

  const multiSteps = [
    {name:"点击「登录按钮」",   changes:3,type:"click"},
    {name:"输入用户名",          changes:1,type:"input"},
    {name:"等待欢迎页面加载",    changes:2,type:"wait"},
  ];

  return(
    <>
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.18)",zIndex:1100}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:1101,background:"#fff",borderRadius:12,width:480,maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 12px 48px rgba(0,0,0,0.16)"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{width:36,height:36,borderRadius:8,background:"#FFF3E8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <AlertTriangle size={16} style={{color:T.warning}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:T.t1}}>
              {isSaving?"正在保存中…":isAutosaved?"已自动保存草稿":"有未保存的修改"}
            </div>
            <div style={{fontSize:12,color:T.t3,marginTop:1}}>
              {isSaving?"请等待当前保存操作完成":isMulti?`${multiSteps.length} 个步骤有未保存的修改`:"离开后修改将丢失"}
            </div>
          </div>
          {!isSaving&&<button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0}}><X size={15}/></button>}
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",minHeight:0}}>

          {/* Saving state */}
          {isSaving&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"30px 0",gap:12}}>
              <Loader2 size={36} style={{color:T.primary,animation:"spin 1s linear infinite"}}/>
              <div style={{fontSize:13,fontWeight:500,color:T.t1}}>正在保存步骤修改…</div>
              <div style={{fontSize:12,color:T.t4}}>保存完成前请不要关闭窗口</div>
              <div style={{width:"100%",height:4,borderRadius:2,background:T.border,overflow:"hidden"}}>
                <div style={{width:"60%",height:"100%",background:T.primary,borderRadius:2,animation:"progress 1.5s ease-in-out infinite"}}/>
              </div>
            </div>
          )}

          {/* Autosaved state */}
          {isAutosaved&&(
            <div>
              <AlertBanner type="success"><strong>草稿已自动保存</strong> — 系统在 2026-08-02 14:23:07 自动保存了您的修改草稿。离开后可以在下次打开步骤时恢复草稿，也可以选择直接丢弃。</AlertBanner>
              <div style={{padding:"12px 14px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:12}}>
                <div style={{fontWeight:500,color:T.t1,marginBottom:8}}>自动保存的内容</div>
                {changedFields.slice(0,2).map((f,i)=>(
                  <div key={i} style={{display:"flex",gap:10,padding:"5px 0",borderBottom:i<1?`1px solid ${T.border}`:"none"}}>
                    <span style={{color:T.t4,width:80,flexShrink:0}}>{f.field}</span>
                    <span style={{flex:1,color:T.t2,textDecoration:"line-through"}}>{f.from}</span>
                    <ArrowRight size={12} style={{color:T.t4,flexShrink:0}}/>
                    <span style={{flex:1,color:T.success}}>{f.to}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single step changes */}
          {isSingle&&(
            <div>
              <div style={{fontSize:12,color:T.t2,marginBottom:10,lineHeight:1.6}}>步骤「<strong>点击「登录按钮」</strong>」有以下未保存的修改，离开将丢失这些更改：</div>
              <SCard title={`变更内容（${changedFields.length} 项）`}>
                {changedFields.map((f,i)=>(
                  <div key={i} style={{padding:"8px 0",borderBottom:i<changedFields.length-1?`1px solid ${T.border}`:"none"}}>
                    <div style={{fontSize:11,color:T.t4,marginBottom:4}}>{f.field}</div>
                    <div style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:12}}>
                      <div style={{flex:1,padding:"4px 8px",borderRadius:5,background:"#FFF5F5",color:T.danger,fontFamily:"inherit"}}>{f.from}</div>
                      <ArrowRight size={12} style={{color:T.t4,flexShrink:0,marginTop:4}}/>
                      <div style={{flex:1,padding:"4px 8px",borderRadius:5,background:"#F0FFF4",color:T.success,fontFamily:"inherit"}}>{f.to}</div>
                    </div>
                  </div>
                ))}
              </SCard>
            </div>
          )}

          {/* Multi step changes */}
          {isMulti&&(
            <div>
              <AlertBanner type="warn">以下 <strong>{multiSteps.length} 个步骤</strong>有未保存的修改。离开后所有修改将丢失，无法恢复。</AlertBanner>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {multiSteps.map((s,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:12}}>
                    <span style={{fontSize:10,fontWeight:700,width:20,height:20,borderRadius:"50%",background:T.warning,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:500,color:T.t1}}>{s.name}</div>
                      <div style={{fontSize:11,color:T.t4,marginTop:1}}>{s.changes} 项修改</div>
                    </div>
                    <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:`${T.warning}15`,color:T.warning,fontWeight:600}}>未保存</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:12,padding:"8px 12px",border:`1px solid ${T.border}`,borderRadius:7,fontSize:11,color:T.t3,lineHeight:1.6}}>
                提示：批量保存将按顺序依次保存所有步骤。如果某个步骤保存失败，后续步骤仍会尝试保存，失败项需要手动处理。
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",gap:8,justifyContent:"flex-end",background:"#fff"}}>
          {isSaving?(
            <button disabled style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#F7F8FA",fontSize:13,color:T.t4,cursor:"not-allowed"}}>请等待保存完成…</button>
          ):isAutosaved?(
            <>
              <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>丢弃草稿</button>
              <button onClick={onClose} style={{padding:"7px 22px",border:"none",borderRadius:7,background:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"}}>恢复草稿并继续编辑</button>
            </>
          ):isMulti?(
            <>
              <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.danger}`,borderRadius:7,background:"#fff",fontSize:13,color:T.danger,cursor:"pointer"}}>全部丢弃</button>
              <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>继续编辑</button>
              <button onClick={onClose} style={{padding:"7px 22px",border:"none",borderRadius:7,background:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><Save size={12}/>全部保存并关闭</button>
            </>
          ):(
            <>
              <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.danger}`,borderRadius:7,background:"#fff",fontSize:13,color:T.danger,cursor:"pointer"}}>丢弃修改</button>
              <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>继续编辑</button>
              <button onClick={onClose} style={{padding:"7px 22px",border:"none",borderRadius:7,background:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><Save size={12}/>保存并关闭</button>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes progress{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
      <DemoBar states={UNSAVED_DEMO} current={demoState} onChange={setDemoState} label="未保存确认状态"/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined Phase 1 + Phase 2 + Phase 3 Showcase
// ─────────────────────────────────────────────────────────────────────────────
type AllOverlay =
  "none"|
  // Phase 1
  "element-editor"|"locator-verify"|"element-detail"|"element-refs"|"impact-analysis"|"quality-analysis"|
  // Phase 2
  "add-step"|"step-config"|"frame-shadow"|
  // Phase 3
  "element-delete"|"unsaved-changes";

const ALL_OVERLAYS: {key:AllOverlay;label:string;phase:string}[] = [
  {key:"element-editor",   label:"新增 / 编辑元素",  phase:"1"},
  {key:"locator-verify",   label:"定位器在线验证",    phase:"1"},
  {key:"element-detail",   label:"元素详情",          phase:"1"},
  {key:"element-refs",     label:"引用关系",          phase:"1"},
  {key:"impact-analysis",  label:"修改影响分析",      phase:"1"},
  {key:"quality-analysis", label:"质量分析",          phase:"1"},
  {key:"step-config",      label:"步骤配置抽屉",      phase:"2"},
  {key:"frame-shadow",     label:"Frame/Shadow 配置", phase:"2"},
  {key:"element-delete",   label:"删除 / 禁用元素",   phase:"3"},
  {key:"unsaved-changes",  label:"未保存修改确认",     phase:"3"},
];

// 浮动面板分组配置
const PANEL_GROUPS = [
  {
    page: "元素管理页",
    color: T.primary,
    hint: "切换到「元素库」标签 → 点击按钮触发",
    items: [
      {key:"element-editor"   as AllOverlay, label:"新增/编辑元素",    entry:"手动添加 · 编辑按钮"},
      {key:"locator-verify"   as AllOverlay, label:"定位器在线验证",   entry:"验证按钮 · 编辑抽屉内验证"},
      {key:"element-detail"   as AllOverlay, label:"元素详情抽屉",     entry:"元素名称 · 查看详情"},
      {key:"element-refs"     as AllOverlay, label:"引用关系抽屉",     entry:"详情抽屉→引用关系"},
      {key:"impact-analysis"  as AllOverlay, label:"修改影响分析",     entry:"编辑抽屉→保存"},
      {key:"quality-analysis" as AllOverlay, label:"质量分析抽屉",     entry:"详情抽屉→质量分析"},
      {key:"element-delete"   as AllOverlay, label:"删除/禁用确认",    entry:"删除按钮"},
    ],
  },
  {
    page: "用例详情页",
    color: T.purple,
    hint: "切换到「用例管理」→ 进入用例编辑 → 点击按钮触发",
    items: [
      {key:"add-step"         as AllOverlay, label:"新增步骤弹窗",     entry:"添加测试步骤按钮"},
      {key:"step-config"      as AllOverlay, label:"步骤配置抽屉",     entry:"点击已有步骤行"},
      {key:"frame-shadow"     as AllOverlay, label:"Frame/Shadow 配置", entry:"步骤配置→Frame 层级"},
      {key:"unsaved-changes"  as AllOverlay, label:"未保存修改确认",   entry:"返回列表 · 删除步骤"},
    ],
  },
];

export function WebUIPhase2Showcase(){
  const [overlay,setOverlay]=useState<AllOverlay>("none");
  const [panelOpen,setPanelOpen]=useState(false);

  const open=(key:AllOverlay)=>{setOverlay(key);setPanelOpen(false);};
  const close=()=>setOverlay("none");

  return(
    <div style={{position:"relative",flex:1,display:"flex",overflow:"hidden"}}>
      {/* Background: WebUIModule with all real button callbacks wired */}
      <WebUIModule
        /* 元素管理入口 */
        onAddElement     ={()=>open("element-editor")}
        onEditElement    ={()=>open("element-editor")}
        onVerifyElement  ={()=>open("locator-verify")}
        onViewElement    ={()=>open("element-detail")}
        onDeleteElement  ={()=>open("element-delete")}
        /* 用例详情入口 */
        onAddStep        ={()=>open("add-step")}
        onEditStep       ={()=>open("step-config")}
        onSingleDebug    ={()=>open("step-config")}
        /* 公共 */
        onUnsavedClose   ={()=>open("unsaved-changes")}
      />

      {/* Floating design-preview panel */}
      <div style={{position:"fixed",bottom:96,right:16,zIndex:500,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
        {panelOpen&&(
          <div style={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",boxShadow:"0 6px 24px rgba(0,0,0,0.14)",display:"flex",flexDirection:"column",gap:4,minWidth:232,maxHeight:"70vh",overflowY:"auto"}}>
            <div style={{fontSize:11,fontWeight:700,color:T.t3,marginBottom:4,letterSpacing:0.6}}>设计稿预览（按页面归属）</div>
            {PANEL_GROUPS.map((group,gi)=>(
              <React.Fragment key={gi}>
                {gi>0&&<div style={{height:1,background:T.border,margin:"4px 0"}}/>}
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
                  <span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:10,background:group.color,color:"#fff"}}>{group.page}</span>
                </div>
                <div style={{fontSize:10,color:T.t4,marginBottom:4,lineHeight:1.4}}>{group.hint}</div>
                {group.items.map(item=>(
                  <button key={item.key} onClick={()=>open(item.key)}
                    style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:1,padding:"5px 8px",borderRadius:7,border:`1px solid ${overlay===item.key?group.color:T.border}`,background:overlay===item.key?`${group.color}0D`:"#fff",fontSize:12,color:overlay===item.key?group.color:T.t2,cursor:"pointer",textAlign:"left",width:"100%"}}>
                    <span style={{fontWeight:500}}>{item.label}</span>
                    <span style={{fontSize:10,color:T.t4}}>入口：{item.entry}</span>
                  </button>
                ))}
              </React.Fragment>
            ))}
            <div style={{height:1,background:T.border,margin:"4px 0"}}/>
            <button onClick={()=>{close();setPanelOpen(false);}} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${T.border}`,background:"transparent",fontSize:11,color:T.t4,cursor:"pointer"}}>关闭当前弹窗</button>
          </div>
        )}
        <button onClick={()=>setPanelOpen(v=>!v)}
          style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",border:"none",borderRadius:8,background:overlay==="none"?T.purple:"#1D2129",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",boxShadow:`0 2px 10px ${overlay==="none"?"rgba(120,22,255,0.3)":"rgba(0,0,0,0.25)"}`}}>
          <Sparkles size={13}/>{panelOpen?"收起":(overlay==="none"?"设计预览":"当前预览中")}
        </button>
      </div>

      {/* ── 元素管理页 overlays ── */}
      {overlay==="element-editor"  &&<ElementEditorDrawer
          onClose={close}
          onImpact={()=>open("impact-analysis")}
        />}
      {overlay==="locator-verify"  &&<LocatorVerifyDialog  onClose={close}/>}
      {overlay==="element-detail"  &&<ElementDetailDrawer
          onClose={close}
          onViewRefs      ={()=>open("element-refs")}
          onQualityAnalysis={()=>open("quality-analysis")}
          onEdit          ={()=>open("element-editor")}
          onDelete        ={()=>open("element-delete")}
        />}
      {overlay==="element-refs"    &&<ElementReferenceDrawer onClose={close}/>}
      {overlay==="impact-analysis" &&<ImpactAnalysisDialog  onClose={close}/>}
      {overlay==="quality-analysis"&&<QualityAnalysisDrawer onClose={close}/>}
      {overlay==="element-delete"  &&<ElementDeleteDialog   onClose={close}/>}

      {/* ── 用例详情页 overlays ── */}
      {overlay==="add-step"     &&<AddStepModal      onClose={close}/>}
      {overlay==="step-config"  &&<StepConfigDrawer
          onClose={close}
          onFrameShadow={()=>open("frame-shadow")}
        />}
      {overlay==="frame-shadow" &&<FrameShadowConfig onClose={()=>open("step-config")}/>}

      {/* ── 公共 overlay ── */}
      {overlay==="unsaved-changes"&&<UnsavedChangesDialog onClose={close}/>}
    </div>
  );
}
