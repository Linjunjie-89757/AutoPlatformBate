/**
 * WebUIExtras.tsx — Web UI 自动化：元素管理 设计稿
 * 第一阶段：第 1-6 项元素管理相关设计
 */

import React, { useState } from "react";
import {
  X, Plus, ChevronRight, Check, AlertTriangle,
  AlertCircle, Info, CheckCircle, XCircle, Loader2,
  Trash2, Save, GripVertical, Lock, Search,
  Copy, Eye, Settings, Target, ExternalLink, Zap,
  ChevronDown, Star, Tag, FileText, Globe2, Layers,
  BarChart2, RefreshCw, Clock, User, Shield, ArrowRight, Edit2,
} from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  cyan:"#0FC6C2",
  bg:"#F4F6FA",      border:"#E5E6EB",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type LocStrategy = "css"|"xpath"|"id"|"name"|"text"|"role"|"label"|"placeholder"|"testid"|"attr";
type EditorState = "edit"|"new"|"adding-locator"|"format-error"|"multi-match"|"no-match"|"main-unavail"|"alt-avail"|"name-duplicate"|"url-invalid"|"saving"|"save-failed"|"unsaved-confirm";
type VerifyPhase = "idle"|"launching"|"loading"|"locating"|"success"|"no-match"|"multi-match"|"page-failed"|"login-expired"|"browser-unavail"|"runner-offline"|"timeout"|"cancelled";
type DetailState = "normal"|"never-verified"|"locator-invalid"|"multi-match"|"low-quality"|"disabled"|"no-permission";
type RefState = "normal"|"no-refs"|"case-deleted"|"step-disabled"|"load-failed"|"no-permission";
type ImpactState = "no-impact"|"low-risk"|"high-risk"|"analysis-failed"|"partial-no-perm";
type QualityState = "high"|"medium"|"low"|"unverified"|"loading";

// ─── Shared primitives ────────────────────────────────────────────────────────
function DemoBar<S extends string>({states,current,onChange,label="设计状态",bottom=0}:{
  states:{value:S;label:string}[];current:S;onChange:(v:S)=>void;label?:string;bottom?:number;
}){
  return(
    <div style={{position:"fixed",bottom,left:0,right:0,height:44,background:"#fff",borderTop:`2px solid ${T.primary}`,display:"flex",alignItems:"center",gap:6,padding:"0 16px",zIndex:9999,boxShadow:"0 -2px 12px rgba(0,0,0,0.1)"}}>
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

function SCard({title,children,action}:{title:string;children:React.ReactNode;action?:React.ReactNode}){
  return(
    <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:"#FAFBFE",borderBottom:`1px solid ${T.border}`}}>
        <span style={{fontSize:12,fontWeight:600,color:T.t2}}>{title}</span>
        {action}
      </div>
      <div style={{padding:14}}>{children}</div>
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

function FInput({value,onChange,placeholder,mono,disabled,error,width,defaultValue}:{value?:string;onChange?:(v:string)=>void;placeholder?:string;mono?:boolean;disabled?:boolean;error?:boolean;width?:number|string;defaultValue?:string}){
  return(
    <input value={value} defaultValue={defaultValue} onChange={e=>onChange?.(e.target.value)} placeholder={placeholder} disabled={disabled}
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

// Locator strategy badge
const LOC_CFG: Record<LocStrategy,{label:string;color:string;bg:string}> = {
  css:         {label:"CSS",        color:T.primary,  bg:"#E8F3FF"},
  xpath:       {label:"XPath",      color:T.purple,   bg:"#F5E8FF"},
  id:          {label:"ID",         color:T.success,  bg:"#E8FFEA"},
  name:        {label:"Name",       color:T.cyan,     bg:"#E8FFFB"},
  text:        {label:"Text",       color:"#F59E0B",  bg:"#FFFBEB"},
  role:        {label:"Role",       color:T.warning,  bg:"#FFF3E8"},
  label:       {label:"Label",      color:"#8B5CF6",  bg:"#F5F0FF"},
  placeholder: {label:"PH",         color:T.t2,       bg:"#F2F3F5"},
  testid:      {label:"TestID",     color:T.danger,   bg:"#FFE8E8"},
  attr:        {label:"Attr",       color:"#0D9488",  bg:"#CCFBF1"},
};

function LocTypeBadge({type}:{type:LocStrategy}){
  const c=LOC_CFG[type];
  return <span style={{fontSize:10,padding:"1px 6px",borderRadius:4,fontWeight:700,background:c.bg,color:c.color,flexShrink:0}}>{c.label}</span>;
}

function VerifyResultBadge({result}:{result:"pass"|"fail"|"warn"|"pending"|null}){
  if(!result) return <span style={{fontSize:10,color:T.t4}}>未验证</span>;
  const m={pass:{c:T.success,l:"通过"},fail:{c:T.danger,l:"失败"},warn:{c:T.warning,l:"多个匹配"},pending:{c:T.t4,l:"验证中"}}[result];
  return <span style={{fontSize:10,fontWeight:600,color:m.c}}>{m.l}</span>;
}

// Quality score ring (SVG)
function QualityScore({score,size=56}:{score:number;size?:number}){
  const r=size/2-5;const circ=2*Math.PI*r;const pct=score/100;
  const color=score>=80?T.success:score>=60?T.warning:T.danger;
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.border} strokeWidth={4}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${circ*pct} ${circ*(1-pct)}`} strokeLinecap="round"/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:size>48?15:12,fontWeight:800,color}}>{score}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ElementEditorDrawer
// ─────────────────────────────────────────────────────────────────────────────
const EDITOR_STATES:{value:EditorState;label:string}[] = [
  {value:"new",            label:"新增"},
  {value:"edit",           label:"编辑"},
  {value:"adding-locator", label:"添加定位器"},
  {value:"format-error",   label:"格式错误"},
  {value:"multi-match",    label:"多个匹配"},
  {value:"no-match",       label:"无匹配"},
  {value:"main-unavail",   label:"主定位器不可用"},
  {value:"alt-avail",      label:"备用可用"},
  {value:"name-duplicate", label:"名称重复"},
  {value:"url-invalid",    label:"URL无效"},
  {value:"saving",         label:"保存中"},
  {value:"save-failed",    label:"保存失败"},
  {value:"unsaved-confirm",label:"未保存确认"},
];

interface LocatorRow {
  id:string;strategy:LocStrategy;value:string;priority:number;
  enabled:boolean;result:"pass"|"fail"|"warn"|"pending"|null;matchCount:number|null;
}

const MOCK_LOCS: LocatorRow[] = [
  {id:"l1",strategy:"id",   value:"login-btn",                     priority:1,enabled:true, result:"pass",matchCount:1},
  {id:"l2",strategy:"css",  value:".login-form button[type=submit]",priority:2,enabled:true, result:"warn",matchCount:3},
  {id:"l3",strategy:"xpath",value:"//button[text()='登录']",         priority:3,enabled:false,result:"fail",matchCount:0},
];

export function ElementEditorDrawer({onClose,onImpact}:{onClose:()=>void;onImpact?:()=>void}){
  const [demoState,setDemoState]=useState<EditorState>("edit");
  const [activeTab,setActiveTab]=useState("基础信息");
  const [locs,setLocs]=useState<LocatorRow[]>(MOCK_LOCS);
  const [addingLoc,setAddingLoc]=useState(false);
  const [newLocType,setNewLocType]=useState<LocStrategy>("css");
  const [newLocVal,setNewLocVal]=useState("");
  const [enabled,setEnabled]=useState(true);

  const isNew = demoState==="new";
  const isSaving = demoState==="saving";
  const showUnsaved = demoState==="unsaved-confirm";
  const tabs = ["基础信息","定位器","Frame/Shadow DOM","测试环境","元素截图","标签与备注"];

  return(
    <>
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:720,zIndex:900,background:"#fff",boxShadow:"-4px 0 28px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{flexShrink:0,borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px 10px"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,color:T.t1}}>{isNew?"新增元素":"编辑元素"}</div>
              <div style={{fontSize:12,color:T.t3,marginTop:1}}>登录页 / 按钮类元素</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:enabled?T.success:T.t4}}>{enabled?"已启用":"已停用"}</span>
              <SmToggle on={enabled} onChange={setEnabled}/>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:4}}><X size={16}/></button>
          </div>
          <div style={{display:"flex",borderTop:`1px solid ${T.border}`}}>
            {tabs.map(t=>(
              <button key={t} onClick={()=>setActiveTab(t)}
                style={{height:36,padding:"0 14px",border:"none",borderBottom:`2px solid ${activeTab===t?T.primary:"transparent"}`,background:"transparent",fontSize:12,fontWeight:500,color:activeTab===t?T.primary:T.t3,cursor:"pointer",whiteSpace:"nowrap"}}>
                {t}{t==="定位器"&&<span style={{marginLeft:4,fontSize:10,fontWeight:700,color:T.primary}}>{locs.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",minHeight:0}}>

          {/* Banner states */}
          {demoState==="name-duplicate"&&<AlertBanner type="error">元素名称「登录按钮」已在「登录页」中存在，请修改名称后保存。</AlertBanner>}
          {demoState==="url-invalid"&&<AlertBanner type="error">页面地址格式无效，请输入以 http:// 或 https:// 开头的完整 URL，或使用 {"{{变量}}"} 引用。</AlertBanner>}
          {demoState==="save-failed"&&<AlertBanner type="error"><strong>保存失败</strong> — 服务器返回错误（500）。请稍后重试，或联系管理员。<div style={{marginTop:4}}><button style={{fontSize:11,padding:"2px 8px",border:`1px solid ${T.danger}`,borderRadius:4,background:"#fff",color:T.danger,cursor:"pointer"}}>复制错误信息</button></div></AlertBanner>}
          {demoState==="main-unavail"&&<AlertBanner type="error"><strong>主定位器不可用</strong> — ID: login-btn 验证失败（未找到匹配元素）。建议将备用定位器提升为主定位器后保存。</AlertBanner>}
          {demoState==="alt-avail"&&<AlertBanner type="success"><strong>备用定位器可用</strong> — CSS Selector 验证通过（1 个匹配），可设为主定位器使用。</AlertBanner>}

          {activeTab==="基础信息"&&(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                <div style={{gridColumn:"1/-1"}}>
                  <FL required>元素名称</FL>
                  <FInput defaultValue={isNew?"":"登录按钮"} placeholder="输入元素名称，建议语义化命名" error={demoState==="name-duplicate"}/>
                  {demoState==="name-duplicate"&&<div style={{fontSize:11,color:T.danger,marginTop:3}}>名称在当前页面中已存在</div>}
                </div>
                <div>
                  <FL required>所属页面 / 模块</FL>
                  <select style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
                    <option>登录页</option><option>首页</option><option>商品详情页</option><option>购物车</option>
                  </select>
                </div>
                <div>
                  <FL>元素类型</FL>
                  <select style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none"}}>
                    <option>按钮 (Button)</option><option>输入框 (Input)</option><option>链接 (Link)</option><option>文本 (Text)</option><option>其他</option>
                  </select>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <FL>元素描述</FL>
                  <textarea rows={2} defaultValue={isNew?"":"用于提交登录表单的主操作按钮，点击后触发登录流程。"}
                    style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none",resize:"none"}}/>
                </div>
              </div>
            </div>
          )}

          {activeTab==="定位器"&&(
            <div>
              {(demoState==="format-error"||demoState==="multi-match"||demoState==="no-match")&&(
                demoState==="format-error"?<AlertBanner type="error">CSS Selector 格式错误：<code style={{fontFamily:"monospace",fontSize:11}}>.login-form button[type=submit</code>（缺少右括号）</AlertBanner>:
                demoState==="multi-match"?<AlertBanner type="warn">CSS Selector 匹配到 <strong>3 个元素</strong>，建议使用更精确的选择器以确保点击到正确目标。</AlertBanner>:
                <AlertBanner type="error">XPath 未找到任何匹配元素，请检查路径是否正确。</AlertBanner>
              )}

              <div style={{marginBottom:10,fontSize:12,color:T.t3}}>按优先级从高到低排列，执行时依次尝试，首个成功的定位器生效。</div>

              {/* Locator table */}
              <div style={{border:`1px solid ${T.border}`,borderRadius:9,overflow:"hidden",marginBottom:10}}>
                <div style={{display:"grid",gridTemplateColumns:"20px 28px 70px 1fr 60px 60px 60px 80px",gap:0,padding:"5px 10px",background:"#FAFBFE",borderBottom:`1px solid ${T.border}`,fontSize:11,fontWeight:600,color:T.t3}}>
                  <div/><div>#</div><div>类型</div><div>定位值</div><div>匹配数</div><div>验证</div><div>启用</div><div>操作</div>
                </div>
                {locs.map((loc,i)=>(
                  <div key={loc.id} style={{display:"grid",gridTemplateColumns:"20px 28px 70px 1fr 60px 60px 60px 80px",alignItems:"center",gap:0,padding:"8px 10px",borderBottom:i<locs.length-1?`1px solid ${T.border}`:"none",background:loc.id==="l2"&&demoState==="format-error"?"#FFF5F5":loc.id==="l2"&&demoState==="multi-match"?"#FFFBE8":"#fff"}}>
                    <GripVertical size={12} style={{color:T.t4,cursor:"grab"}}/>
                    <span style={{fontSize:11,fontWeight:700,color:T.t4}}>{loc.priority}</span>
                    <LocTypeBadge type={loc.strategy}/>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:8}}>{loc.value}</span>
                    <span style={{fontSize:11,color:loc.matchCount===0?T.danger:loc.matchCount&&loc.matchCount>1?T.warning:T.t2}}>
                      {loc.matchCount===null?"—":loc.matchCount}
                    </span>
                    <VerifyResultBadge result={loc.result}/>
                    <SmToggle on={loc.enabled} onChange={v=>setLocs(ls=>ls.map(l=>l.id===loc.id?{...l,enabled:v}:l))}/>
                    <div style={{display:"flex",gap:3}}>
                      <button style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:2}} title="复制"><Copy size={11}/></button>
                      <button style={{background:"none",border:"none",cursor:"pointer",color:T.primary,lineHeight:0,padding:2}} title="验证"><Zap size={11}/></button>
                      <button style={{background:"none",border:"none",cursor:"pointer",color:T.danger,lineHeight:0,padding:2}} title="删除"><Trash2 size={11}/></button>
                    </div>
                  </div>
                ))}

                {/* Inline add row */}
                {(demoState==="adding-locator"||addingLoc)&&(
                  <div style={{padding:"10px",borderTop:`1px solid ${T.border}`,background:`${T.primary}04`}}>
                    <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                      <select value={newLocType} onChange={e=>setNewLocType(e.target.value as LocStrategy)}
                        style={{width:110,height:32,padding:"0 6px",border:`1.5px solid ${T.primary}`,borderRadius:6,fontSize:11,color:T.t1,outline:"none",flexShrink:0}}>
                        {(Object.keys(LOC_CFG) as LocStrategy[]).map(k=><option key={k} value={k}>{LOC_CFG[k].label}</option>)}
                      </select>
                      <input value={newLocVal} onChange={e=>setNewLocVal(e.target.value)} placeholder="输入定位值，例如：#login-btn"
                        style={{flex:1,height:32,padding:"0 10px",border:`1.5px solid ${demoState==="format-error"?T.danger:T.primary}`,borderRadius:6,fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:T.t1,outline:"none"}}/>
                      <button onClick={()=>{setAddingLoc(false);}} style={{height:32,padding:"0 14px",border:"none",borderRadius:6,background:T.primary,color:"#fff",fontSize:12,cursor:"pointer",flexShrink:0}}>确认</button>
                      <button onClick={()=>setAddingLoc(false)} style={{height:32,padding:"0 12px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",fontSize:12,color:T.t2,cursor:"pointer",flexShrink:0}}>取消</button>
                    </div>
                    {demoState==="format-error"&&<div style={{fontSize:11,color:T.danger,marginTop:4}}>格式错误：缺少右括号或无效属性选择器</div>}
                  </div>
                )}
              </div>

              <button onClick={()=>setAddingLoc(true)}
                style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",border:`1px dashed ${T.primary}`,borderRadius:7,background:`${T.primary}06`,color:T.primary,fontSize:12,cursor:"pointer"}}>
                <Plus size={11}/>添加定位器
              </button>
            </div>
          )}

          {activeTab==="Frame/Shadow DOM"&&(
            <div>
              <AlertBanner type="info">配置元素所在的 Frame 或 Shadow DOM 层级。如果元素在主文档中，无需配置。</AlertBanner>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{padding:"14px",border:`1px dashed ${T.border}`,borderRadius:9,textAlign:"center",color:T.t4,fontSize:12}}>
                  <Layers size={24} style={{margin:"0 auto 6px",display:"block",opacity:0.3}}/>当前元素在主文档中，未配置 Frame / Shadow DOM
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button style={{display:"flex",alignItems:"center",gap:4,padding:"6px 14px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:12,color:T.t2,cursor:"pointer"}}><Plus size={11}/>添加 Frame</button>
                  <button style={{display:"flex",alignItems:"center",gap:4,padding:"6px 14px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:12,color:T.t2,cursor:"pointer"}}><Plus size={11}/>添加 Shadow Root</button>
                </div>
              </div>
            </div>
          )}

          {activeTab==="测试环境"&&(
            <div>
              <SCard title="环境适用范围">
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {["测试环境（test）","预发布环境（staging）","生产环境（prod）"].map((env,i)=>(
                    <div key={env} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",border:`1px solid ${T.border}`,borderRadius:7}}>
                      <SmToggle on={i<2} onChange={()=>{}}/>
                      <span style={{fontSize:12,color:T.t1,flex:1}}>{env}</span>
                      {i<2&&<span style={{fontSize:11,color:T.success}}>已启用</span>}
                    </div>
                  ))}
                </div>
              </SCard>
              <div style={{marginBottom:14}}>
                <FL tip="用于在线验证定位器时打开的默认页面">默认验证地址</FL>
                <FInput defaultValue="https://test.example.com/login" placeholder="https://example.com/page" error={demoState==="url-invalid"} mono/>
                {demoState==="url-invalid"&&<div style={{fontSize:11,color:T.danger,marginTop:3}}>URL 格式无效，请以 http:// 或 https:// 开头</div>}
              </div>
            </div>
          )}

          {activeTab==="元素截图"&&(
            <div>
              <AlertBanner type="info">上传元素在页面中的参考截图，有助于团队成员理解该元素的位置和外观。截图不影响执行，仅用于展示和文档记录。</AlertBanner>
              <div style={{height:160,border:`2px dashed ${T.border}`,borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,color:T.t4,cursor:"pointer",background:"#FAFBFE"}}>
                <Eye size={28} style={{opacity:0.3}}/>
                <div style={{fontSize:12,color:T.t3}}>点击上传截图，或从剪贴板粘贴</div>
                <div style={{fontSize:11,color:T.t4}}>支持 PNG、JPG、WebP，最大 5 MB</div>
              </div>
            </div>
          )}

          {activeTab==="标签与备注"&&(
            <div>
              <div style={{marginBottom:14}}>
                <FL>标签</FL>
                <div style={{display:"flex",flexWrap:"wrap",gap:5,padding:"8px 10px",border:`1.5px solid ${T.border}`,borderRadius:7,minHeight:40,background:"#fff"}}>
                  {["核心元素","P0"].map(t=>(
                    <span key={t} style={{display:"flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:4,background:`${T.primary}10`,fontSize:11,color:T.primary}}>
                      {t}<button style={{background:"none",border:"none",cursor:"pointer",color:T.primary,lineHeight:0,padding:0}}><X size={9}/></button>
                    </span>
                  ))}
                  <input placeholder="+ 添加标签" style={{border:"none",outline:"none",fontSize:11,color:T.t2,minWidth:60}}/>
                </div>
              </div>
              <div>
                <FL>备注</FL>
                <textarea rows={4} defaultValue="该按钮为登录流程的关键操作元素，优先维护定位器稳定性。"
                  style={{width:"100%",boxSizing:"border-box",padding:"8px 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none",resize:"none"}}/>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",justifyContent:"flex-end",gap:8,background:"#fff"}}>
          <button onClick={()=>setDemoState("unsaved-confirm")} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>取消</button>
          <button disabled={isSaving} onClick={()=>{setDemoState("saving");onImpact?.();}}
            style={{padding:"7px 22px",border:"none",borderRadius:7,background:isSaving?T.t4:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:isSaving?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6}}>
            {isSaving&&<Loader2 size={13} style={{animation:"spin 1s linear infinite"}}/>}
            {isSaving?"保存中…":"保存"}
          </button>
        </div>

        {/* Unsaved confirm modal */}
        {showUnsaved&&(
          <>
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.3)",zIndex:1100}}/>
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:1101,background:"#fff",borderRadius:12,padding:"28px 32px",width:380,boxShadow:"0 12px 40px rgba(0,0,0,0.16)"}}>
              <div style={{fontSize:15,fontWeight:700,color:T.t1,marginBottom:8}}>有未保存的修改</div>
              <div style={{fontSize:13,color:T.t2,lineHeight:1.7,marginBottom:22}}>当前表单存在未保存的修改，离开后修改将丢失。是否继续？</div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button onClick={()=>setDemoState("edit")} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>继续编辑</button>
                <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.danger}`,borderRadius:7,background:"#fff",fontSize:13,color:T.danger,cursor:"pointer"}}>丢弃并关闭</button>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <DemoBar states={EDITOR_STATES} current={demoState} onChange={setDemoState} label="编辑器状态"/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LocatorVerifyDialog
// ─────────────────────────────────────────────────────────────────────────────
const VERIFY_PHASES:{value:VerifyPhase;label:string}[] = [
  {value:"idle",          label:"等待验证"},
  {value:"launching",     label:"启动浏览器"},
  {value:"loading",       label:"页面加载中"},
  {value:"locating",      label:"查找元素"},
  {value:"success",       label:"验证成功"},
  {value:"no-match",      label:"无匹配"},
  {value:"multi-match",   label:"多个匹配"},
  {value:"page-failed",   label:"页面失败"},
  {value:"login-expired", label:"登录失效"},
  {value:"browser-unavail",label:"浏览器不可用"},
  {value:"runner-offline",label:"Runner 离线"},
  {value:"timeout",       label:"超时"},
  {value:"cancelled",     label:"已取消"},
];

const VERIFY_STEPS = ["启动浏览器","打开页面","查找元素","采集结果"];

export function LocatorVerifyDialog({onClose}:{onClose:()=>void}){
  const [phase,setPhase]=useState<VerifyPhase>("idle");
  const [showDom,setShowDom]=useState(false);

  const isRunning = ["launching","loading","locating"].includes(phase);
  const isTerminal = !["idle","launching","loading","locating"].includes(phase);
  const isSuccess = phase==="success";
  const isError = ["no-match","multi-match","page-failed","login-expired","browser-unavail","runner-offline","timeout","cancelled"].includes(phase);

  const stepIdx = phase==="launching"?0:phase==="loading"?1:phase==="locating"?2:isTerminal?3:-1;

  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.18)",zIndex:1050}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:1051,background:"#fff",borderRadius:12,width:880,maxHeight:"86vh",display:"flex",flexDirection:"column",boxShadow:"0 12px 48px rgba(0,0,0,0.14)"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <Zap size={14} style={{color:T.primary}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:T.t1}}>定位器在线验证</div>
            <div style={{fontSize:12,color:T.t3,marginFamily:"'JetBrains Mono',monospace"}}>ID: login-btn</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0}}><X size={15}/></button>
        </div>

        {/* Body */}
        <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>

          {/* Left config */}
          <div style={{width:280,flexShrink:0,borderRight:`1px solid ${T.border}`,padding:"16px 16px",overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <FL required>运行环境</FL>
              <select style={{width:"100%",height:32,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}>
                <option>测试环境（test）</option><option>预发布</option>
              </select>
            </div>
            <div>
              <FL required>页面地址</FL>
              <FInput defaultValue="https://test.example.com/login" mono/>
            </div>
            <div>
              <FL>浏览器</FL>
              <select style={{width:"100%",height:32,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}>
                <option>Chromium</option><option>Firefox</option><option>WebKit</option>
              </select>
            </div>
            <div>
              <FL>窗口尺寸</FL>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input defaultValue="1440" style={{flex:1,height:32,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}/>
                <span style={{fontSize:12,color:T.t4}}>×</span>
                <input defaultValue="900" style={{flex:1,height:32,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}/>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <SmToggle on={true} onChange={()=>{}}/>
              <span style={{fontSize:12,color:T.t2}}>等待页面加载完成</span>
            </div>
            <div>
              <FL>最大等待时间</FL>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <input defaultValue="30000" style={{flex:1,height:32,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}/>
                <span style={{fontSize:12,color:T.t4}}>ms</span>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <SmToggle on={true} onChange={()=>{}}/>
              <span style={{fontSize:12,color:T.t2}}>使用登录状态</span>
            </div>

            {/* Locator selector */}
            <div>
              <FL>验证定位器</FL>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {MOCK_LOCS.map(l=>(
                  <label key={l.id} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 8px",border:`1px solid ${T.border}`,borderRadius:6,cursor:"pointer"}}>
                    <input type="radio" name="loc" defaultChecked={l.id==="l1"} style={{flexShrink:0}}/>
                    <LocTypeBadge type={l.strategy}/>
                    <span style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:T.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{l.value}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:"auto",paddingTop:12,borderTop:`1px solid ${T.border}`}}>
              {isRunning?(
                <button onClick={()=>setPhase("cancelled")} style={{width:"100%",padding:"8px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>取消验证</button>
              ):(
                <button onClick={()=>setPhase("launching")} style={{width:"100%",padding:"8px",border:"none",borderRadius:7,background:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <Zap size={13}/>{phase==="idle"?"开始验证":"重新验证"}
                </button>
              )}
            </div>
          </div>

          {/* Right result */}
          <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>

            {/* Step indicator */}
            {(isRunning||isTerminal)&&(
              <div style={{display:"flex",alignItems:"center",marginBottom:20}}>
                {VERIFY_STEPS.map((s,i)=>{
                  const done = stepIdx>i||(isTerminal&&i<4);
                  const active = stepIdx===i&&isRunning;
                  const failed = isTerminal&&i===3&&isError;
                  const c = failed?T.danger:done?T.success:active?T.primary:T.t4;
                  return(
                    <React.Fragment key={s}>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                        <div style={{width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:done?c:active?T.primary:T.border,flexShrink:0}}>
                          {done?<Check size={12} style={{color:"#fff"}}/>:active?<Loader2 size={12} style={{color:"#fff",animation:"spin 1s linear infinite"}}/>:<span style={{fontSize:10,fontWeight:700,color:"#fff"}}>{i+1}</span>}
                        </div>
                        <span style={{fontSize:10,color:active?T.primary:done?c:T.t4,whiteSpace:"nowrap"}}>{s}</span>
                      </div>
                      {i<3&&<div style={{flex:1,height:2,background:done?c:T.border,margin:"0 6px 16px"}}/>}
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* State content */}
            {phase==="idle"&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:240,gap:10,color:T.t4}}>
                <Zap size={40} style={{opacity:0.2}}/>
                <div style={{fontSize:13,color:T.t3}}>配置验证参数后点击「开始验证」</div>
              </div>
            )}

            {isRunning&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"40px 0",gap:10}}>
                <Loader2 size={36} style={{color:T.primary,animation:"spin 1s linear infinite"}}/>
                <div style={{fontSize:14,fontWeight:500,color:T.t1}}>
                  {phase==="launching"?"正在启动浏览器…":phase==="loading"?"正在打开页面…":"正在查找元素…"}
                </div>
                <div style={{fontSize:12,color:T.t4}}>Runner: Node-01 · 已用时 1.3s</div>
              </div>
            )}

            {isSuccess&&(
              <div>
                <AlertBanner type="success"><strong>验证成功</strong> — ID 定位器匹配到 1 个元素，元素可见且可交互。耗时 2,041 ms。</AlertBanner>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                  {[{l:"匹配数量",v:"1 个",c:T.success},{l:"是否可见",v:"可见",c:T.success},{l:"是否可交互",v:"可点击",c:T.success},{l:"元素标签",v:"<button>",c:T.t1},{l:"元素文本",v:"登录",c:T.t1},{l:"执行耗时",v:"2,041 ms",c:T.t1}].map(item=>(
                    <div key={item.l} style={{padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8}}>
                      <div style={{fontSize:11,color:T.t4,marginBottom:3}}>{item.l}</div>
                      <div style={{fontSize:13,fontWeight:600,color:item.c}}>{item.v}</div>
                    </div>
                  ))}
                </div>
                <SCard title="元素属性">
                  <div style={{display:"flex",flexDirection:"column",gap:5}}>
                    {[{k:"id",v:"login-btn"},{k:"type",v:"submit"},{k:"class",v:"btn btn-primary btn-lg"}].map(a=>(
                      <div key={a.k} style={{display:"flex",gap:8,fontSize:12}}>
                        <span style={{color:T.t4,width:80,flexShrink:0}}>{a.k}</span>
                        <code style={{fontFamily:"'JetBrains Mono',monospace",color:T.t1}}>{a.v}</code>
                      </div>
                    ))}
                  </div>
                </SCard>
                <div>
                  <button onClick={()=>setShowDom(!showDom)} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:T.t3,border:"none",background:"none",cursor:"pointer",padding:"4px 0",marginBottom:4}}>
                    <ChevronRight size={12} style={{transform:showDom?"rotate(90deg)":"none",transition:".15s"}}/>DOM 片段
                  </button>
                  {showDom&&(
                    <div style={{padding:"10px 14px",background:"#111",borderRadius:8,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"#D4D4D4",lineHeight:1.7}}>
                      {`<button id="login-btn"\n  type="submit"\n  class="btn btn-primary btn-lg">\n  登录\n</button>`}
                    </div>
                  )}
                </div>
              </div>
            )}

            {phase==="no-match"&&<AlertBanner type="error"><strong>未找到匹配元素</strong> — 在页面 <code style={{fontFamily:"monospace",fontSize:11}}>https://test.example.com/login</code> 中，使用 ID: <code style={{fontFamily:"monospace",fontSize:11}}>login-btn</code> 等待 30s 后仍未匹配到任何元素。<div style={{marginTop:6,fontSize:11,color:T.t3}}>建议：检查拼写、尝试 CSS 或 XPath 定位、确认页面是否已完全加载。</div></AlertBanner>}
            {phase==="multi-match"&&(
              <div>
                <AlertBanner type="warn"><strong>匹配到 3 个元素</strong> — 建议修改定位器使其仅匹配唯一元素，否则执行时将操作第一个匹配项，可能导致误操作。</AlertBanner>
                <SCard title="匹配元素列表">
                  {[{i:1,text:"登录",class:"btn btn-primary"},{i:2,text:"注册",class:"btn btn-secondary"},{i:3,text:"忘记密码",class:"btn btn-link"}].map(e=>(
                    <div key={e.i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:e.i<3?`1px solid ${T.border}`:"none",fontSize:12}}>
                      <span style={{fontSize:10,fontWeight:700,width:18,height:18,borderRadius:"50%",background:T.t4,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{e.i}</span>
                      <code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.t2}}>{"<button>"}</code>
                      <span style={{flex:1,color:T.t1}}>文本：「{e.text}」</span>
                      <span style={{fontSize:11,color:T.t4}}>{e.class}</span>
                    </div>
                  ))}
                </SCard>
              </div>
            )}
            {phase==="page-failed"&&<AlertBanner type="error"><strong>页面打开失败</strong> — 访问 https://test.example.com/login 返回 404。请确认 URL 是否正确，以及测试环境是否正常运行。</AlertBanner>}
            {phase==="login-expired"&&<AlertBanner type="error"><strong>登录状态已失效</strong> — 当前环境的登录 Cookie 已过期，页面跳转至登录页，无法在目标页面定位元素。请刷新登录状态后重试。<div style={{marginTop:6}}><button style={{fontSize:11,padding:"2px 8px",border:`1px solid ${T.border}`,borderRadius:4,background:"#fff",color:T.t2,cursor:"pointer"}}>刷新登录状态</button></div></AlertBanner>}
            {phase==="browser-unavail"&&<AlertBanner type="error"><strong>浏览器不可用</strong> — Runner 节点上未安装或无法启动 Chromium。请联系运维检查 Runner 环境配置。</AlertBanner>}
            {phase==="runner-offline"&&<AlertBanner type="error"><strong>Runner 节点离线</strong> — 当前没有可用的 Runner 节点。请检查节点状态或稍后重试。<div style={{marginTop:6}}><button style={{fontSize:11,padding:"2px 8px",border:`1px solid ${T.border}`,borderRadius:4,background:"#fff",color:T.t2,cursor:"pointer"}}>查看节点状态</button></div></AlertBanner>}
            {phase==="timeout"&&<AlertBanner type="error"><strong>验证超时</strong> — 在 30,000 ms 内未完成查找操作，任务已终止。建议增大等待时间或检查页面加载速度。</AlertBanner>}
            {phase==="cancelled"&&(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:200,gap:8,color:T.t4}}>
                <X size={28} style={{opacity:0.3}}/>
                <div style={{fontSize:13,color:T.t3}}>验证已取消</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {isTerminal&&(
          <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",gap:8,justifyContent:"flex-end"}}>
            <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>关闭</button>
            <button onClick={()=>setPhase("launching")} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}><RefreshCw size={12}/>重新验证</button>
            {isSuccess&&<button onClick={onClose} style={{padding:"7px 20px",border:"none",borderRadius:7,background:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"}}>更新验证结果</button>}
          </div>
        )}
      </div>

      <DemoBar states={VERIFY_PHASES} current={phase} onChange={setPhase} label="验证阶段"/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ElementDetailDrawer
// ─────────────────────────────────────────────────────────────────────────────
const DETAIL_STATES:{value:DetailState;label:string}[] = [
  {value:"normal",         label:"正常"},
  {value:"never-verified", label:"从未验证"},
  {value:"locator-invalid",label:"定位器失效"},
  {value:"multi-match",    label:"多个匹配"},
  {value:"low-quality",    label:"低质量"},
  {value:"disabled",       label:"已禁用"},
  {value:"no-permission",  label:"无权限"},
];

export function ElementDetailDrawer({onClose,onViewRefs,onQualityAnalysis,onEdit,onDelete}:{onClose:()=>void;onViewRefs?:()=>void;onQualityAnalysis?:()=>void;onEdit?:()=>void;onDelete?:()=>void}){
  const [demoState,setDemoState]=useState<DetailState>("normal");
  const [activeTab,setActiveTab]=useState("概览");
  const [showVerify,setShowVerify]=useState(false);
  const tabs = ["概览","定位器","引用","变更记录"];
  const isDisabled = demoState==="disabled";
  const isNoPerm = demoState==="no-permission";

  return(
    <>
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:640,zIndex:900,background:"#fff",boxShadow:"-4px 0 28px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{flexShrink:0,borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px 10px"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:15,fontWeight:700,color:isDisabled?T.t4:T.t1}}>登录按钮</span>
                {isDisabled&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:4,background:"#F2F3F5",color:T.t4,fontWeight:600}}>已停用</span>}
                {demoState==="locator-invalid"&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:4,background:"#FFE8E8",color:T.danger,fontWeight:600}}>定位器失效</span>}
                {demoState==="low-quality"&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:4,background:"#FFF3E8",color:T.warning,fontWeight:600}}>低质量</span>}
                {demoState==="never-verified"&&<span style={{fontSize:11,padding:"2px 6px",borderRadius:4,background:"#FFF3E8",color:T.warning,fontWeight:600}}>从未验证</span>}
              </div>
              <div style={{fontSize:12,color:T.t3,marginTop:1}}>登录页 · 按钮 (Button) · 引用 14 次</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {!isNoPerm&&<>
                <button style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",fontSize:11,color:T.t2,cursor:"pointer"}}><Settings size={11}/>编辑</button>
                <button onClick={()=>setShowVerify(true)} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",fontSize:11,color:T.t2,cursor:"pointer"}}><Zap size={11}/>验证</button>
                <button style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",fontSize:11,color:T.t2,cursor:"pointer"}}><BarChart2 size={11}/>质量</button>
              </>}
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:4}}><X size={16}/></button>
          </div>
          <div style={{display:"flex",borderTop:`1px solid ${T.border}`}}>
            {tabs.map(t=>(
              <button key={t} onClick={()=>setActiveTab(t)}
                style={{height:36,padding:"0 14px",border:"none",borderBottom:`2px solid ${activeTab===t?T.primary:"transparent"}`,background:"transparent",fontSize:12,fontWeight:500,color:activeTab===t?T.primary:T.t3,cursor:"pointer"}}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",minHeight:0}}>
          {isNoPerm?(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:10}}>
              <Lock size={36} style={{color:T.t4,opacity:0.4}}/>
              <div style={{fontSize:14,color:T.t2,fontWeight:500}}>无查看权限</div>
              <div style={{fontSize:12,color:T.t4}}>您没有权限查看该元素的详情，请联系管理员分配权限。</div>
            </div>
          ):(
            <>
              {demoState==="locator-invalid"&&<AlertBanner type="error"><strong>主定位器已失效</strong> — ID: login-btn 最近一次验证未找到匹配元素（2026-07-28）。建议立即验证并更新定位器。</AlertBanner>}
              {demoState==="multi-match"&&<AlertBanner type="warn"><strong>存在多个匹配</strong> — 主定位器 CSS: .btn-primary 匹配到 3 个元素，可能导致步骤操作错误目标。建议使用更精确的定位器。</AlertBanner>}
              {demoState==="never-verified"&&<AlertBanner type="warn"><strong>从未验证</strong> — 该元素创建后尚未进行在线验证，定位器可靠性未知。建议在验证环境中完成至少一次验证。</AlertBanner>}
              {demoState==="low-quality"&&<AlertBanner type="warn"><strong>质量评分偏低（42 分）</strong> — 定位器依赖不稳定的动态 class，且未配置备用定位器。建议查看质量分析报告进行优化。</AlertBanner>}

              {activeTab==="概览"&&(
                <div>
                  {/* Stats row */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 80px",gap:10,marginBottom:16}}>
                    {[
                      {l:"质量评分",v:<QualityScore score={demoState==="low-quality"?42:demoState==="never-verified"?0:78} size={48}/>,raw:true},
                      {l:"引用用例",v:"14"},
                      {l:"引用步骤",v:"21"},
                      {l:"最近验证",v:demoState==="never-verified"?"—":demoState==="locator-invalid"?"失败":"通过"},
                    ].map(item=>(
                      <div key={item.l} style={{padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8,display:"flex",flexDirection:"column",gap:4}}>
                        <div style={{fontSize:11,color:T.t4}}>{item.l}</div>
                        {item.raw?item.v:<div style={{fontSize:18,fontWeight:700,color:T.t1}}>{item.v as string}</div>}
                      </div>
                    ))}
                  </div>

                  <SCard title="基础信息">
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
                      {[
                        {l:"所属页面",v:"登录页"},
                        {l:"元素类型",v:"按钮 (Button)"},
                        {l:"创建人",v:"张三"},
                        {l:"创建时间",v:"2026-06-15"},
                        {l:"最近修改人",v:"李四"},
                        {l:"最近修改时间",v:"2026-07-28"},
                        {l:"标签",v:"核心元素, P0"},
                        {l:"Frame/Shadow",v:"主文档（无）"},
                      ].map(item=>(
                        <div key={item.l} style={{display:"flex",gap:8}}>
                          <span style={{color:T.t4,minWidth:90,flexShrink:0}}>{item.l}</span>
                          <span style={{color:T.t1}}>{item.v}</span>
                        </div>
                      ))}
                      <div style={{gridColumn:"1/-1",display:"flex",gap:8}}>
                        <span style={{color:T.t4,minWidth:90,flexShrink:0}}>描述</span>
                        <span style={{color:T.t1}}>用于提交登录表单的主操作按钮</span>
                      </div>
                    </div>
                  </SCard>

                  {/* Latest verify result */}
                  {demoState!=="never-verified"&&(
                    <SCard title="最近验证结果">
                      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                        {demoState==="locator-invalid"?<XCircle size={16} style={{color:T.danger,flexShrink:0}}/>:<CheckCircle size={16} style={{color:T.success,flexShrink:0}}/>}
                        <div style={{fontSize:12,color:T.t2}}>
                          <div style={{fontWeight:500,color:demoState==="locator-invalid"?T.danger:T.success}}>
                            {demoState==="locator-invalid"?"验证失败 — 未找到匹配元素":"验证通过 — 1 个匹配，可见且可交互"}
                          </div>
                          <div style={{marginTop:3,color:T.t4}}>2026-07-{demoState==="locator-invalid"?"28":"30"} 14:23 · Node-01 · Chromium 126 · 耗时 2.1s</div>
                        </div>
                      </div>
                    </SCard>
                  )}
                </div>
              )}

              {activeTab==="定位器"&&(
                <div>
                  <div style={{marginBottom:10,fontSize:12,color:T.t3}}>按优先级排列，执行时从高到低依次尝试。</div>
                  {MOCK_LOCS.map((loc,i)=>(
                    <div key={loc.id} style={{marginBottom:8,border:`1px solid ${loc.id==="l1"&&demoState==="locator-invalid"?T.danger:T.border}`,borderRadius:9,overflow:"hidden"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:loc.id==="l1"&&demoState==="locator-invalid"?"#FFF5F5":"#FAFBFE",borderBottom:`1px solid ${T.border}`}}>
                        <span style={{fontSize:11,fontWeight:700,color:T.t4,width:16}}>{loc.priority}</span>
                        <LocTypeBadge type={loc.strategy}/>
                        {!loc.enabled&&<span style={{fontSize:10,color:T.t4,background:"#F2F3F5",padding:"1px 5px",borderRadius:3}}>停用</span>}
                        {loc.id==="l1"&&i===0&&<span style={{fontSize:10,color:T.primary,fontWeight:700}}>主定位器</span>}
                        <div style={{flex:1}}/>
                        <VerifyResultBadge result={loc.result}/>
                        <span style={{fontSize:11,color:T.t4}}>{loc.matchCount!=null?`${loc.matchCount} 个匹配`:"—"}</span>
                      </div>
                      <div style={{padding:"8px 12px"}}>
                        <code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:T.t1}}>{loc.value}</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab==="引用"&&(
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
                    {[{l:"引用用例",v:"14"},{l:"引用步骤",v:"21"},{l:"最近执行失败",v:"3"}].map(s=>(
                      <div key={s.l} style={{padding:"10px",border:`1px solid ${T.border}`,borderRadius:8,textAlign:"center"}}>
                        <div style={{fontSize:18,fontWeight:700,color:T.t1}}>{s.v}</div>
                        <div style={{fontSize:11,color:T.t4,marginTop:2}}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <AlertBanner type="info">在「引用关系」抽屉中查看详细的用例和步骤列表。</AlertBanner>
                </div>
              )}

              {activeTab==="变更记录"&&(
                <div>
                  {[
                    {time:"2026-07-28 14:20",user:"李四",action:"修改主定位器",detail:"ID: login-button → ID: login-btn"},
                    {time:"2026-07-15 10:05",user:"张三",action:"添加备用定位器",detail:"添加 CSS: .login-form button[type=submit]"},
                    {time:"2026-06-15 09:30",user:"张三",action:"创建元素",detail:"初始定位器：ID: login-btn"},
                  ].map((r,i)=>(
                    <div key={i} style={{display:"flex",gap:12,paddingBottom:14,marginBottom:14,borderBottom:i<2?`1px solid ${T.border}`:"none"}}>
                      <div style={{width:2,background:T.border,borderRadius:1,flexShrink:0,position:"relative"}}>
                        <div style={{position:"absolute",top:4,left:-4,width:10,height:10,borderRadius:"50%",background:T.primary,border:"2px solid #fff"}}/>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3}}>
                          <span style={{fontSize:12,fontWeight:500,color:T.t1}}>{r.action}</span>
                          <span style={{fontSize:11,color:T.t4}}>{r.user}</span>
                        </div>
                        <div style={{fontSize:11,color:T.t3}}>{r.detail}</div>
                        <div style={{fontSize:11,color:T.t4,marginTop:2}}>{r.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {!isNoPerm&&(
          <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"10px 20px",display:"flex",gap:6,alignItems:"center"}}>
            <button onClick={onViewRefs} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",fontSize:12,color:T.t2,cursor:"pointer"}}><Eye size={11}/>引用关系</button>
            <button onClick={onQualityAnalysis} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",fontSize:12,color:T.t2,cursor:"pointer"}}><BarChart2 size={11}/>质量分析</button>
            <div style={{flex:1}}/>
            <button onClick={onEdit} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",fontSize:12,color:T.t2,cursor:"pointer"}}><Edit2 size={11}/>编辑</button>
            <button onClick={onDelete} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",border:`1px solid ${T.danger}30`,borderRadius:6,background:"#fff",fontSize:12,color:T.danger,cursor:"pointer"}}><Trash2 size={11}/>删除</button>
          </div>
        )}
      </div>

      {showVerify&&<LocatorVerifyDialog onClose={()=>setShowVerify(false)}/>}
      <DemoBar states={DETAIL_STATES} current={demoState} onChange={setDemoState} label="详情状态"/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ElementReferenceDrawer
// ─────────────────────────────────────────────────────────────────────────────
const REF_STATES:{value:RefState;label:string}[] = [
  {value:"normal",       label:"正常引用"},
  {value:"no-refs",      label:"无引用"},
  {value:"case-deleted", label:"用例已删除"},
  {value:"step-disabled",label:"步骤已停用"},
  {value:"load-failed",  label:"加载失败"},
  {value:"no-permission",label:"无权限"},
];

const MOCK_REFS = [
  {id:"c1",name:"用户正常登录流程",module:"登录模块",steps:3,lastRun:"通过",lastTime:"2026-07-31",deleted:false,disabled:false,stepDisabled:false},
  {id:"c2",name:"记住密码功能验证",module:"登录模块",steps:1,lastRun:"失败",lastTime:"2026-07-30",deleted:false,disabled:false,stepDisabled:false},
  {id:"c3",name:"登录失败错误提示",module:"登录模块",steps:2,lastRun:"通过",lastTime:"2026-07-28",deleted:true,disabled:false,stepDisabled:false},
  {id:"c4",name:"多因素认证登录",  module:"安全模块",steps:4,lastRun:"未执行",lastTime:"—",deleted:false,disabled:false,stepDisabled:true},
];

export function ElementReferenceDrawer({onClose}:{onClose:()=>void}){
  const [demoState,setDemoState]=useState<RefState>("normal");
  const [search,setSearch]=useState("");
  const [failOnly,setFailOnly]=useState(false);
  const [expanded,setExpanded]=useState<string[]>(["c1"]);

  const isNoPerm = demoState==="no-permission";
  const isLoadFailed = demoState==="load-failed";
  const isNoRefs = demoState==="no-refs";

  const refs = MOCK_REFS.map(r=>({
    ...r,
    deleted: demoState==="case-deleted"&&r.id==="c3"?true:r.deleted,
    stepDisabled: demoState==="step-disabled"&&r.id==="c4"?true:r.stepDisabled,
  }));

  return(
    <>
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:660,zIndex:900,background:"#fff",boxShadow:"-4px 0 28px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{flexShrink:0,borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px 10px"}}>
            <Eye size={15} style={{color:T.primary}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,color:T.t1}}>元素引用关系</div>
              <div style={{fontSize:12,color:T.t3}}>登录按钮 · 登录页</div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0}}><X size={16}/></button>
          </div>

          {!isNoPerm&&!isLoadFailed&&!isNoRefs&&(
            <div style={{padding:"8px 20px",display:"flex",gap:8,alignItems:"center",borderTop:`1px solid ${T.border}`}}>
              <div style={{position:"relative",flex:1}}>
                <Search size={12} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:T.t4}}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索用例名称…"
                  style={{width:"100%",boxSizing:"border-box",height:30,paddingLeft:28,paddingRight:10,border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}/>
              </div>
              <select style={{height:30,padding:"0 8px",border:`1.5px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none"}}>
                <option>全部模块</option><option>登录模块</option><option>安全模块</option>
              </select>
              <label style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:T.t2,whiteSpace:"nowrap",cursor:"pointer"}}>
                <input type="checkbox" checked={failOnly} onChange={e=>setFailOnly(e.target.checked)}/>只看失败
              </label>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",minHeight:0}}>

          {isNoPerm&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60%",gap:10}}>
              <Lock size={36} style={{color:T.t4,opacity:0.4}}/>
              <div style={{fontSize:14,color:T.t2,fontWeight:500}}>无查看权限</div>
              <div style={{fontSize:12,color:T.t4}}>您没有权限查看关联用例，请联系管理员。</div>
            </div>
          )}

          {isLoadFailed&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 0",gap:10}}>
              <AlertCircle size={36} style={{color:T.danger,opacity:0.6}}/>
              <div style={{fontSize:14,color:T.t2,fontWeight:500}}>数据加载失败</div>
              <div style={{fontSize:12,color:T.t4}}>无法获取引用数据，请检查网络后重试。</div>
              <button style={{display:"flex",alignItems:"center",gap:5,padding:"6px 16px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:12,color:T.t2,cursor:"pointer"}}><RefreshCw size={12}/>重新加载</button>
            </div>
          )}

          {isNoRefs&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 0",gap:8}}>
              <Eye size={36} style={{color:T.t4,opacity:0.3}}/>
              <div style={{fontSize:14,color:T.t2,fontWeight:500}}>暂无引用</div>
              <div style={{fontSize:12,color:T.t4}}>该元素尚未被任何 Web UI 用例引用。</div>
            </div>
          )}

          {!isNoPerm&&!isLoadFailed&&!isNoRefs&&(
            <>
              {/* Summary stats */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:16}}>
                {[{l:"引用用例",v:"4"},{l:"引用步骤",v:"10"},{l:"最近执行失败",v:"1",c:T.danger},{l:"已删除用例",v:demoState==="case-deleted"?"1":"0",c:demoState==="case-deleted"?T.danger:T.t1}].map(s=>(
                  <div key={s.l} style={{padding:"8px 10px",border:`1px solid ${T.border}`,borderRadius:8,textAlign:"center"}}>
                    <div style={{fontSize:16,fontWeight:700,color:s.c||T.t1}}>{s.v}</div>
                    <div style={{fontSize:10,color:T.t4,marginTop:1}}>{s.l}</div>
                  </div>
                ))}
              </div>

              {refs.filter(r=>!search||(r.name.includes(search))).map(ref=>{
                const isExp = expanded.includes(ref.id);
                return(
                  <div key={ref.id} style={{marginBottom:8,border:`1px solid ${ref.deleted?T.danger:ref.stepDisabled?T.warning:T.border}`,borderRadius:9,overflow:"hidden"}}>
                    <div onClick={()=>setExpanded(e=>isExp?e.filter(x=>x!==ref.id):[...e,ref.id])}
                      style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",cursor:"pointer",background:ref.deleted?"#FFF5F5":ref.stepDisabled?"#FFFBE8":"#FAFBFE"}}>
                      <ChevronRight size={13} style={{color:T.t4,transform:isExp?"rotate(90deg)":"none",transition:".15s",flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                          <span style={{fontSize:13,fontWeight:500,color:ref.deleted?T.danger:T.t1}}>{ref.name}</span>
                          {ref.deleted&&<span style={{fontSize:10,color:T.danger,background:"#FFE8E8",padding:"1px 5px",borderRadius:3,fontWeight:600}}>已删除</span>}
                          {ref.stepDisabled&&<span style={{fontSize:10,color:T.warning,background:"#FFF3E8",padding:"1px 5px",borderRadius:3,fontWeight:600}}>含停用步骤</span>}
                        </div>
                        <div style={{fontSize:11,color:T.t4}}>{ref.module} · {ref.steps} 个步骤引用 · 最近执行：{ref.lastTime}</div>
                      </div>
                      <span style={{fontSize:11,fontWeight:600,color:ref.lastRun==="通过"?T.success:ref.lastRun==="失败"?T.danger:T.t4}}>{ref.lastRun}</span>
                      {!ref.deleted&&<button onClick={e=>{e.stopPropagation();}} style={{background:"none",border:"none",cursor:"pointer",color:T.t4,lineHeight:0,padding:2}} title="前往用例"><ExternalLink size={11}/></button>}
                    </div>
                    {isExp&&(
                      <div style={{borderTop:`1px solid ${T.border}`,background:"#fff"}}>
                        {Array.from({length:ref.steps}).map((_,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px 8px 36px",borderBottom:i<ref.steps-1?`1px solid ${T.border}`:"none",fontSize:12}}>
                            <span style={{fontSize:10,fontWeight:700,color:T.t4,width:20,flexShrink:0}}>#{i+1}</span>
                            <span style={{fontSize:10,padding:"1px 6px",borderRadius:4,background:"#E8FFEA",color:T.success,fontWeight:700,flexShrink:0}}>点击</span>
                            <span style={{color:T.t2,flex:1}}>点击「{ref.name.split("").slice(0,4).join("")}」按钮</span>
                            {ref.stepDisabled&&i===0&&<span style={{fontSize:10,color:T.warning}}>步骤已停用</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {demoState==="case-deleted"&&<AlertBanner type="warn">1 个引用用例已被删除，这些引用将不再执行，建议清理对应步骤。</AlertBanner>}
              {demoState==="step-disabled"&&<AlertBanner type="info">1 个引用步骤当前处于停用状态，执行套件时不会执行该步骤。</AlertBanner>}
            </>
          )}
        </div>
      </div>

      <DemoBar states={REF_STATES} current={demoState} onChange={setDemoState} label="引用关系状态"/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ImpactAnalysisDialog
// ─────────────────────────────────────────────────────────────────────────────
const IMPACT_STATES:{value:ImpactState;label:string}[] = [
  {value:"no-impact",       label:"无影响"},
  {value:"low-risk",        label:"低风险"},
  {value:"high-risk",       label:"高风险"},
  {value:"analysis-failed", label:"分析失败"},
  {value:"partial-no-perm", label:"部分无权限"},
];

export function ImpactAnalysisDialog({onClose}:{onClose:()=>void}){
  const [demoState,setDemoState]=useState<ImpactState>("high-risk");

  const isHighRisk = demoState==="high-risk";
  const isLowRisk = demoState==="low-risk";
  const isNoImpact = demoState==="no-impact";
  const isFailed = demoState==="analysis-failed";
  const isPartial = demoState==="partial-no-perm";

  const riskColor = isHighRisk?T.danger:isLowRisk?T.warning:T.success;
  const riskBg = isHighRisk?"#FFE8E8":isLowRisk?"#FFF3E8":"#E8FFEA";
  const riskLabel = isHighRisk?"高风险":isLowRisk?"低风险":"无影响";

  return(
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.18)",zIndex:1050}}/>
      <div style={{position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",zIndex:1051,background:"#fff",borderRadius:12,width:700,maxHeight:"86vh",display:"flex",flexDirection:"column",boxShadow:"0 12px 48px rgba(0,0,0,0.14)"}}>

        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 20px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <AlertTriangle size={14} style={{color:riskColor}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:T.t1}}>修改影响分析</div>
            <div style={{fontSize:12,color:T.t3}}>保存前请确认影响范围</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0}}><X size={15}/></button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",minHeight:0}}>

          {isFailed&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"50px 0",gap:10}}>
              <AlertCircle size={36} style={{color:T.danger,opacity:0.6}}/>
              <div style={{fontSize:14,color:T.t2,fontWeight:500}}>影响分析失败</div>
              <div style={{fontSize:12,color:T.t4,textAlign:"center"}}>无法完成影响范围扫描，可能是数据库连接异常。<br/>您仍可选择保存，但无法预览影响范围。</div>
            </div>
          )}

          {!isFailed&&(
            <>
              {/* Risk summary card */}
              <div style={{padding:"14px 16px",border:`2px solid ${riskColor}30`,borderRadius:10,background:riskBg,marginBottom:14,display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:48,height:48,borderRadius:"50%",background:`${riskColor}20`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {isHighRisk?<AlertTriangle size={22} style={{color:riskColor}}/>:isLowRisk?<AlertCircle size={22} style={{color:riskColor}}/>:<CheckCircle size={22} style={{color:riskColor}}/>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700,color:riskColor,marginBottom:3}}>{riskLabel}</div>
                  <div style={{fontSize:12,color:T.t2}}>
                    {isNoImpact?"此次修改不影响任何已有用例或套件，可以安全保存。":isLowRisk?"修改将影响 2 个用例中的 3 个步骤，涉及模块影响范围较小。":"修改将影响 8 个用例中的 14 个步骤，其中包含 3 个 P0 核心用例，建议谨慎操作。"}
                  </div>
                </div>
                {!isNoImpact&&<button style={{padding:"5px 14px",border:`1px solid ${riskColor}`,borderRadius:7,background:"#fff",fontSize:12,color:riskColor,cursor:"pointer",flexShrink:0}}>查看详细清单</button>}
              </div>

              {/* Locator diff */}
              {!isNoImpact&&(
                <SCard title="定位器变更内容">
                  <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <div style={{flex:1,padding:"8px 10px",border:`1px solid ${T.border}`,borderRadius:7,background:"#FFF5F5"}}>
                      <div style={{fontSize:10,color:T.danger,fontWeight:600,marginBottom:4}}>变更前</div>
                      <code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:T.t2}}>CSS: .login-form button.btn-primary</code>
                    </div>
                    <ArrowRight size={14} style={{color:T.t4,flexShrink:0,marginTop:12}}/>
                    <div style={{flex:1,padding:"8px 10px",border:`1px solid ${T.border}`,borderRadius:7,background:"#F0FFF4"}}>
                      <div style={{fontSize:10,color:T.success,fontWeight:600,marginBottom:4}}>变更后</div>
                      <code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:T.t1}}>ID: login-btn</code>
                    </div>
                  </div>
                </SCard>
              )}

              {/* Stats */}
              {!isNoImpact&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:14}}>
                  {[
                    {l:"受影响用例",v:isHighRisk?"8":"2",c:isHighRisk?T.danger:T.t1},
                    {l:"受影响步骤",v:isHighRisk?"14":"3",c:isHighRisk?T.danger:T.t1},
                    {l:"受影响套件",v:isHighRisk?"3":"1",c:T.t1},
                    {l:"最近执行失败",v:isHighRisk?"3":"0",c:isHighRisk?T.danger:T.t1},
                  ].map(s=>(
                    <div key={s.l} style={{padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8,textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div>
                      <div style={{fontSize:10,color:T.t4,marginTop:2}}>{s.l}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* High-risk list */}
              {isHighRisk&&(
                <SCard title="高风险引用（P0 / P1）" action={<span style={{fontSize:11,color:T.t4}}>共 3 条</span>}>
                  {[
                    {name:"用户正常登录流程",priority:"P0",steps:4,lastFail:"2026-07-30"},
                    {name:"记住密码功能验证",priority:"P0",steps:1,lastFail:"—"},
                    {name:"多账号切换场景",  priority:"P1",steps:2,lastFail:"2026-07-28"},
                  ].map((r,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 0",borderBottom:i<2?`1px solid ${T.border}`:"none",fontSize:12}}>
                      <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:4,background:r.priority==="P0"?"#FFE8E8":"#FFF3E8",color:r.priority==="P0"?T.danger:T.warning}}>{r.priority}</span>
                      <span style={{flex:1,color:T.t1}}>{r.name}</span>
                      <span style={{color:T.t4}}>{r.steps} 个步骤</span>
                      {r.lastFail!=="—"&&<span style={{fontSize:11,color:T.danger}}>最近失败 {r.lastFail}</span>}
                    </div>
                  ))}
                </SCard>
              )}

              {isPartial&&<AlertBanner type="warn"><strong>部分引用无查看权限</strong> — 有 3 个用例您没有权限查看，实际影响范围可能比显示的更大。建议联系管理员确认后再保存。</AlertBanner>}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>返回修改</button>
          {!isFailed&&!isNoImpact&&<button style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>保存但不启用</button>}
          {!isFailed&&!isNoImpact&&<button style={{padding:"7px 18px",border:`1px solid ${T.primary}`,borderRadius:7,background:"#fff",fontSize:13,color:T.primary,cursor:"pointer"}}>保存并验证</button>}
          <button onClick={onClose} style={{padding:"7px 22px",border:"none",borderRadius:7,background:isHighRisk?T.danger:T.primary,color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer"}}>
            {isFailed?"仍然保存":"确认更新"}
          </button>
        </div>
      </div>

      <DemoBar states={IMPACT_STATES} current={demoState} onChange={setDemoState} label="影响分析状态"/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. QualityAnalysisDrawer
// ─────────────────────────────────────────────────────────────────────────────
const QUALITY_STATES:{value:QualityState;label:string}[] = [
  {value:"high",      label:"高质量（78分）"},
  {value:"medium",    label:"中等（58分）"},
  {value:"low",       label:"低质量（32分）"},
  {value:"unverified",label:"未验证"},
  {value:"loading",   label:"加载中"},
];

const QUALITY_DIMS = [
  {key:"unique",   label:"唯一性",    tips:"定位器是否仅匹配唯一元素"},
  {key:"stable",   label:"稳定性",    tips:"是否依赖动态生成的 class 或属性"},
  {key:"readable", label:"可读性",    tips:"定位器是否语义清晰、易于理解"},
  {key:"attr",     label:"推荐属性",  tips:"是否使用 id / test-id 等推荐属性"},
  {key:"depth",    label:"层级深度",  tips:"XPath / CSS 选择器层级是否过深"},
  {key:"dynamic",  label:"动态 class",tips:"是否依赖随构建变化的 class 名"},
  {key:"backup",   label:"备用定位器",tips:"是否配置了有效的备用定位器"},
  {key:"verify",   label:"验证成功率",tips:"历史验证通过的比例"},
];

function getDimScores(qs:QualityState):{[k:string]:number}{
  if(qs==="high")      return {unique:95,stable:85,readable:90,attr:100,depth:88,dynamic:95,backup:80,verify:92};
  if(qs==="medium")    return {unique:70,stable:55,readable:65,attr:80,depth:60,dynamic:50,backup:40,verify:70};
  if(qs==="low")       return {unique:90,stable:20,readable:40,attr:30,depth:25,dynamic:10,backup:0, verify:45};
  return {};
}

export function QualityAnalysisDrawer({onClose}:{onClose:()=>void}){
  const [demoState,setDemoState]=useState<QualityState>("high");

  const isLoading  = demoState==="loading";
  const isUnverif  = demoState==="unverified";
  const totalScore = demoState==="high"?78:demoState==="medium"?58:demoState==="low"?32:0;
  const dimScores  = getDimScores(demoState);
  const scoreColor = totalScore>=70?T.success:totalScore>=50?T.warning:T.danger;

  const dimLevel = (s:number) => s>=80?"优秀":s>=60?"良好":s>=40?"待优化":"需改善";
  const dimLevelColor = (s:number) => s>=80?T.success:s>=60?T.primary:s>=40?T.warning:T.danger;

  return(
    <>
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:660,zIndex:900,background:"#fff",boxShadow:"-4px 0 28px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{flexShrink:0,borderBottom:`1px solid ${T.border}`,padding:"14px 20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <BarChart2 size={15} style={{color:T.primary}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,color:T.t1}}>元素质量分析</div>
              <div style={{fontSize:12,color:T.t3}}>登录按钮 · 登录页</div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0}}><X size={16}/></button>
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px",minHeight:0}}>

          {isLoading&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60%",gap:12}}>
              <Loader2 size={36} style={{color:T.primary,animation:"spin 1s linear infinite"}}/>
              <div style={{fontSize:13,color:T.t3}}>正在分析定位器质量…</div>
            </div>
          )}

          {isUnverif&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 0",gap:10}}>
              <AlertCircle size={36} style={{color:T.warning,opacity:0.6}}/>
              <div style={{fontSize:14,color:T.t2,fontWeight:500}}>无法评分</div>
              <div style={{fontSize:12,color:T.t4,textAlign:"center"}}>该元素尚未进行在线验证，部分质量维度无法评估。<br/>请先验证定位器，再查看完整质量报告。</div>
              <button style={{display:"flex",alignItems:"center",gap:5,padding:"6px 16px",border:`1px solid ${T.primary}`,borderRadius:7,background:`${T.primary}0D`,color:T.primary,fontSize:12,cursor:"pointer"}}><Zap size={11}/>立即验证</button>
            </div>
          )}

          {!isLoading&&!isUnverif&&(
            <>
              {/* Overall score */}
              <div style={{display:"flex",gap:16,padding:"16px",border:`1px solid ${scoreColor}30`,borderRadius:12,background:`${scoreColor}06`,marginBottom:16,alignItems:"center"}}>
                <QualityScore score={totalScore} size={72}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:700,color:scoreColor,marginBottom:4}}>
                    {totalScore>=70?"质量良好":totalScore>=50?"质量中等":"质量偏低"} · {totalScore} 分
                  </div>
                  <div style={{fontSize:12,color:T.t2,lineHeight:1.6}}>
                    {totalScore>=70?"主定位器唯一稳定，建议继续保持备用定位器覆盖。":
                     totalScore>=50?"定位器存在稳定性隐患，建议优化动态 class 依赖并补充备用定位器。":
                     "定位器严重依赖动态属性，稳定性极低，未配置备用定位器，存在高执行风险。"}
                  </div>
                  <div style={{display:"flex",gap:6,marginTop:8}}>
                    {demoState==="low"&&(
                      <>
                        <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"#FFE8E8",color:T.danger,fontWeight:600}}>动态 class 依赖</span>
                        <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"#FFE8E8",color:T.danger,fontWeight:600}}>无备用定位器</span>
                        <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"#FFF3E8",color:T.warning,fontWeight:600}}>推荐属性缺失</span>
                      </>
                    )}
                    {demoState==="medium"&&(
                      <>
                        <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"#FFF3E8",color:T.warning,fontWeight:600}}>备用定位器不足</span>
                        <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"#FFF3E8",color:T.warning,fontWeight:600}}>稳定性一般</span>
                      </>
                    )}
                    {demoState==="high"&&(
                      <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"#E8FFEA",color:T.success,fontWeight:600}}>主定位器优秀</span>
                    )}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,flexShrink:0}}>
                  {[{l:"历史验证次数",v:"24"},{l:"最近30天失败",v:demoState==="low"?"9":demoState==="medium"?"4":"1"},{l:"备用定位器",v:demoState==="low"?"0":demoState==="medium"?"1":"2"},{l:"最近验证时间",v:"2026-07-30"}].map(m=>(
                    <div key={m.l} style={{textAlign:"right"}}>
                      <div style={{fontSize:13,fontWeight:700,color:T.t1}}>{m.v}</div>
                      <div style={{fontSize:10,color:T.t4}}>{m.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dimension bars */}
              <SCard title="质量维度详情">
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {QUALITY_DIMS.map(dim=>{
                    const s = dimScores[dim.key]??0;
                    const lv = dimLevel(s);
                    const lc = dimLevelColor(s);
                    return(
                      <div key={dim.key}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                          <span style={{fontSize:12,color:T.t2,width:80,flexShrink:0}}>{dim.label}</span>
                          <div style={{flex:1,height:6,borderRadius:3,background:T.border,overflow:"hidden"}}>
                            <div style={{width:`${s}%`,height:"100%",borderRadius:3,background:lc,transition:"width .3s"}}/>
                          </div>
                          <span style={{fontSize:12,fontWeight:700,color:lc,width:28,textAlign:"right",flexShrink:0}}>{s}</span>
                          <span style={{fontSize:10,padding:"1px 6px",borderRadius:4,background:`${lc}15`,color:lc,fontWeight:600,width:42,textAlign:"center",flexShrink:0}}>{lv}</span>
                          <span title={dim.tips} style={{cursor:"help",color:T.t4,lineHeight:0}}><Info size={11}/></span>
                        </div>
                        {s<50&&(
                          <div style={{fontSize:11,color:T.t4,paddingLeft:86,lineHeight:1.5}}>
                            {dim.key==="dynamic"?"当前 class 名包含随构建生成的哈希值，版本更新后可能失效":
                             dim.key==="backup"?"未配置备用定位器，主定位器失效时无法降级恢复":
                             dim.key==="depth"?"XPath 层级超过 6 层，DOM 结构变化时极易失效":
                             "该维度评分偏低，建议参考推荐定位器进行优化"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </SCard>

              {/* Recommendations */}
              <SCard title="推荐定位器" action={<span style={{fontSize:11,color:T.t4}}>由系统自动分析生成</span>}>
                {(demoState==="low"||demoState==="medium")?(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {[
                      {strategy:"testid" as LocStrategy,value:"[data-testid='login-submit-btn']",score:96,reason:"使用专用测试属性，稳定性最高"},
                      {strategy:"id" as LocStrategy,     value:"#login-btn",                     score:92,reason:"ID 定位器，唯一性强"},
                      {strategy:"role" as LocStrategy,   value:"role=button[name='登录']",       score:84,reason:"Playwright Role，语义清晰"},
                    ].map((r,i)=>(
                      <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:8}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                            <LocTypeBadge type={r.strategy}/>
                            <span style={{fontSize:10,fontWeight:700,color:T.success}}>置信度 {r.score}%</span>
                          </div>
                          <code style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.t1}}>{r.value}</code>
                          <div style={{fontSize:11,color:T.t4,marginTop:3}}>{r.reason}</div>
                        </div>
                        <div style={{display:"flex",gap:5,flexShrink:0}}>
                          <button style={{padding:"4px 10px",border:`1px solid ${T.primary}`,borderRadius:6,background:`${T.primary}0D`,color:T.primary,fontSize:11,cursor:"pointer"}}>应用</button>
                          <button style={{padding:"4px 8px",border:`1px solid ${T.border}`,borderRadius:6,background:"#fff",color:T.t3,fontSize:11,cursor:"pointer"}}><Copy size={10}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ):(
                  <div style={{fontSize:12,color:T.t3,textAlign:"center",padding:"16px 0"}}>
                    <CheckCircle size={20} style={{color:T.success,margin:"0 auto 6px",display:"block"}}/>
                    当前定位器质量良好，无需替换
                  </div>
                )}
              </SCard>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>关闭</button>
          {!isLoading&&!isUnverif&&<button style={{display:"flex",alignItems:"center",gap:5,padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}><RefreshCw size={12}/>重新分析</button>}
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <DemoBar states={QUALITY_STATES} current={demoState} onChange={setDemoState} label="质量分析状态"/>
    </>
  );
}
