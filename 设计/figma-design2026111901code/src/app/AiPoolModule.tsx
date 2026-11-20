import React, { useState } from "react";
import {
  Plus, RefreshCw, Zap, Layers, Edit2, Trash2, X, Save,
  CheckCircle, AlertTriangle, Clock, Eye, EyeOff, Power,
  Search, ChevronDown, ChevronRight, Shield, AlertCircle,
  Sparkles,
} from "lucide-react";

// ─── Palette ──────────────────────────────────────────────────────────────────
const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  border:"#E5E6EB",
  bg:"#F4F6FA",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};
const AC = "#7816FF"; // AI module accent

// ─── Types ────────────────────────────────────────────────────────────────────
type AiProvider  = "openai"|"anthropic"|"google"|"deepseek"|"qwen"|"azure"|"ollama"|"minimax"|"zhipu"|"kimi"|"custom";
type Capability  = "text"|"vision"|"long-ctx"|"json";
type AiUsage     = "case-gen"|"case-review"|"fail-analysis"|"element-id"|"assert-suggest";
type ConnStatus  = "active"|"inactive"|"error";
type ModelType   = "generate"|"review"|"vision"|"embedding";

interface AiPool {
  id:string; name:string; provider:AiProvider; apiUrl:string;
  apiKeySet:boolean; defaultGenModel:string; defaultReviewModel:string;
  capabilities:Capability[]; usages:AiUsage[]; status:ConnStatus;
  timeout:number; maxRetry:number;
  lastTestTime:string|null; lastTestResult:"success"|"failed"|null; lastTestLatency:number|null;
}
interface AiModel {
  id:string; name:string; modelId:string; type:ModelType;
  maxContext:number; supportsImage:boolean; supportsJson:boolean;
  isDefault:boolean; status:"active"|"inactive";
}

// ─── Config maps ──────────────────────────────────────────────────────────────
const PROVIDER_CFG: Record<AiProvider,{label:string;color:string;bg:string;initial:string}> = {
  openai:    {label:"OpenAI",    color:"#10A37F",bg:"#E8FFF9",initial:"O"},
  anthropic: {label:"Anthropic", color:"#CF5600",bg:"#FFF3E8",initial:"A"},
  google:    {label:"Google",    color:"#4285F4",bg:"#E8F3FF",initial:"G"},
  deepseek:  {label:"DeepSeek",  color:"#1E40AF",bg:"#EFF6FF",initial:"D"},
  qwen:      {label:"通义千问",   color:"#FF6A00",bg:"#FFF5EB",initial:"千"},
  azure:     {label:"Azure",     color:"#0078D4",bg:"#E8F4FF",initial:"Az"},
  ollama:    {label:"Ollama",    color:"#555555",bg:"#F2F3F5",initial:"Ol"},
  minimax:   {label:"MiniMax",   color:"#E91E8C",bg:"#FFE8F5",initial:"M"},
  zhipu:     {label:"智谱 AI",   color:"#5C6BC0",bg:"#ECEFF8",initial:"智"},
  kimi:      {label:"Kimi",      color:"#1C1C1C",bg:"#F5F5F5",initial:"K"},
  custom:    {label:"自定义",    color:"#6B7280",bg:"#F2F3F5",initial:"*"},
};
const CAP_CFG: Record<Capability,{label:string;color:string;bg:string}> = {
  text:      {label:"文本",    color:T.primary,bg:"#E8F3FF"},
  vision:    {label:"视觉",    color:AC,       bg:"#F5E8FF"},
  "long-ctx":{label:"长上下文",color:T.success, bg:"#E8FFEA"},
  json:      {label:"JSON",   color:T.warning, bg:"#FFF3E8"},
};
const USAGE_CFG: Record<AiUsage,string> = {
  "case-gen":       "用例生成",
  "case-review":    "用例评审",
  "fail-analysis":  "失败分析",
  "element-id":     "元素识别",
  "assert-suggest": "断言建议",
};
const MODEL_TYPE_CFG: Record<ModelType,{label:string;color:string}> = {
  generate:  {label:"生成模型",  color:T.primary},
  review:    {label:"评审模型",  color:AC},
  vision:    {label:"视觉模型",  color:T.success},
  embedding: {label:"向量模型",  color:T.warning},
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const INIT_POOLS: AiPool[] = [
  {id:"c1",name:"GPT-4o 生成连接",provider:"openai",apiUrl:"https://api.openai.com/v1",apiKeySet:true,defaultGenModel:"gpt-4o",defaultReviewModel:"gpt-4o-mini",capabilities:["text","vision","long-ctx","json"],usages:["case-gen","case-review","assert-suggest"],status:"active",timeout:30,maxRetry:3,lastTestTime:"2026-07-07 09:30",lastTestResult:"success",lastTestLatency:342},
  {id:"c2",name:"Claude 3.5 评审连接",provider:"anthropic",apiUrl:"https://api.anthropic.com",apiKeySet:true,defaultGenModel:"claude-3-5-sonnet-20241022",defaultReviewModel:"claude-3-5-sonnet-20241022",capabilities:["text","long-ctx","json"],usages:["fail-analysis"],status:"active",timeout:60,maxRetry:2,lastTestTime:"2026-07-07 08:45",lastTestResult:"success",lastTestLatency:891},
  {id:"c3",name:"通义千问-Max",provider:"qwen",apiUrl:"https://dashscope.aliyuncs.com/compatible-mode/v1",apiKeySet:false,defaultGenModel:"qwen-max",defaultReviewModel:"qwen-plus",capabilities:["text","vision"],usages:[],status:"error",timeout:30,maxRetry:3,lastTestTime:"2026-07-06 15:22",lastTestResult:"failed",lastTestLatency:null},
  {id:"c4",name:"DeepSeek 本地部署",provider:"deepseek",apiUrl:"http://10.0.1.50:8080/v1",apiKeySet:true,defaultGenModel:"deepseek-chat",defaultReviewModel:"deepseek-chat",capabilities:["text","json"],usages:["case-gen"],status:"inactive",timeout:120,maxRetry:1,lastTestTime:null,lastTestResult:null,lastTestLatency:null},
];

const MODELS_BY_CONN: Record<string,AiModel[]> = {
  c1:[
    {id:"m1",name:"GPT-4o",modelId:"gpt-4o",type:"generate",maxContext:128000,supportsImage:true,supportsJson:true,isDefault:true,status:"active"},
    {id:"m2",name:"GPT-4o mini",modelId:"gpt-4o-mini",type:"review",maxContext:128000,supportsImage:false,supportsJson:true,isDefault:false,status:"active"},
    {id:"m3",name:"GPT-4 Turbo",modelId:"gpt-4-turbo",type:"generate",maxContext:128000,supportsImage:true,supportsJson:true,isDefault:false,status:"inactive"},
  ],
  c2:[
    {id:"m4",name:"Claude 3.5 Sonnet",modelId:"claude-3-5-sonnet-20241022",type:"review",maxContext:200000,supportsImage:true,supportsJson:true,isDefault:true,status:"active"},
    {id:"m5",name:"Claude 3 Opus",modelId:"claude-3-opus-20240229",type:"generate",maxContext:200000,supportsImage:true,supportsJson:true,isDefault:false,status:"inactive"},
  ],
  c3:[
    {id:"m6",name:"通义千问 Max",modelId:"qwen-max",type:"generate",maxContext:32000,supportsImage:false,supportsJson:false,isDefault:true,status:"active"},
  ],
  c4:[
    {id:"m7",name:"DeepSeek Chat",modelId:"deepseek-chat",type:"generate",maxContext:64000,supportsImage:false,supportsJson:true,isDefault:true,status:"inactive"},
  ],
};

const ALL_PROVIDERS: AiProvider[] = ["openai","anthropic","google","deepseek","qwen","azure","minimax","zhipu","kimi","ollama","custom"];

// ─── Local atoms ──────────────────────────────────────────────────────────────
function Btn({children,onClick,icon:Icon,small,color=T.primary,ghost,disabled}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;ghost?:boolean;disabled?:boolean}){
  if(ghost)return<button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium bg-white" style={{borderColor:T.border,color:T.t2,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.5:1}}>{Icon&&<Icon size={13}/>}{children}</button>;
  return<button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-all active:scale-[0.98]" style={{backgroundColor:color,color:"#fff",height:small?28:32,padding:small?"0 10px":"0 14px",fontSize:small?12:13,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.6:1}} onMouseEnter={e=>{if(!disabled)(e.currentTarget as HTMLButtonElement).style.filter="brightness(1.1)";}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.filter=""}}>{Icon&&<Icon size={small?12:13}/>}{children}</button>;
}
function IBtn({icon:Icon,label,danger,onClick}:{icon:React.ElementType;label:string;danger?:boolean;onClick?:()=>void}){
  return<button title={label} onClick={e=>{e.stopPropagation();onClick?.();}} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{color:T.t4}} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color=danger?T.danger:T.t1;(e.currentTarget as HTMLButtonElement).style.backgroundColor=danger?"#FFF0F0":"#F2F3F5";}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color=T.t4;(e.currentTarget as HTMLButtonElement).style.backgroundColor="transparent";}}><Icon size={13}/></button>;
}
function Chip({label,color,bg,small}:{label:string;color:string;bg:string;small?:boolean}){
  return<span className="inline-block rounded px-1.5 font-medium whitespace-nowrap" style={{fontSize:small?10:11,padding:small?"1px 6px":"2px 8px",color,backgroundColor:bg}}>{label}</span>;
}
function Toggle({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}){
  return<button onClick={()=>onChange(!on)} className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0" style={{backgroundColor:on?T.primary:"#C9CDD4"}}><span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all" style={{left:on?"calc(100% - 14px)":"2px"}}/></button>;
}
function SInput({value,onChange,placeholder,type="text",suffix}:{value?:string;onChange?:(v:string)=>void;placeholder?:string;type?:string;suffix?:React.ReactNode}){
  return<div className="relative flex items-center"><input type={type} value={value} onChange={e=>onChange?.(e.target.value)} placeholder={placeholder} className="h-8 w-full border rounded-lg px-3 text-[13px] outline-none transition-all" style={{borderColor:T.border,color:T.t1,paddingRight:suffix?"36px":"12px"}} onFocus={e=>{e.currentTarget.style.borderColor=AC;e.currentTarget.style.boxShadow=`0 0 0 2px ${AC}18`;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>{suffix&&<span className="absolute right-2.5 text-[12px]" style={{color:T.t3}}>{suffix}</span>}</div>;
}
function ProviderAvatar({provider,size=32}:{provider:AiProvider;size?:number}){
  const c=PROVIDER_CFG[provider];
  return<div className="flex items-center justify-center rounded-xl flex-shrink-0 font-bold" style={{width:size,height:size,backgroundColor:c.bg,color:c.color,fontSize:size>28?12:10}}>{c.initial}</div>;
}

// ─── Connection Test Result Dialog ────────────────────────────────────────────
interface TestResult{ok:boolean;latency:number|null;model:string;error?:string;time:string;}
function TestResultDialog({result,onClose}:{result:TestResult;onClose:()=>void}){
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.3)"}}>
      <div className="bg-white rounded-2xl w-[440px]" style={{boxShadow:"0 20px 60px rgba(0,0,0,0.16)"}}>
        <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:`1px solid ${T.border}`}}>
          <span className="text-[15px] font-semibold" style={{color:T.t1}}>连接测试结果</span>
          <IBtn icon={X} label="关闭" onClick={onClose}/>
        </div>
        <div className="px-6 py-5">
          <div className={`flex items-center gap-3 p-4 rounded-xl mb-4`} style={{backgroundColor:result.ok?"#E8FFEA":"#FFE8E8"}}>
            {result.ok?<CheckCircle size={22} color={T.success}/>:<AlertTriangle size={22} color={T.danger}/>}
            <div>
              <div className="text-[14px] font-semibold" style={{color:result.ok?T.success:T.danger}}>{result.ok?"连接测试成功":"连接测试失败"}</div>
              <div className="text-[12px] mt-0.5" style={{color:result.ok?"#009922":"#CC2222"}}>{result.ok?"API 正常响应，连接可用":"无法建立连接，请检查配置"}</div>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
            {[
              ["响应耗时", result.latency ? `${result.latency} ms` : "—"],
              ["返回模型", result.model || "—"],
              ["测试时间", result.time],
              ...(result.error ? [["错误信息", result.error]] : []),
            ].map(([k,v],i)=>(
              <div key={i} className="flex items-start px-4 py-2.5" style={{backgroundColor:i%2===0?"#FAFAFA":"#fff",borderTop:i>0?`1px solid ${T.border}`:"none"}}>
                <span className="w-20 flex-shrink-0 text-[12px]" style={{color:T.t3}}>{k}</span>
                <span className="flex-1 text-[13px] break-all" style={{color:k==="错误信息"?T.danger:T.t2}}>{v}</span>
              </div>
            ))}
          </div>
          {!result.ok&&(
            <div className="mt-4 p-3 rounded-xl" style={{backgroundColor:"#FFF3E8",border:`1px solid #FFD6A0`}}>
              <div className="text-[12px] font-semibold mb-1.5" style={{color:T.warning}}>建议处理方式</div>
              <ul className="text-[12px] flex flex-col gap-1" style={{color:T.t2}}>
                <li>· 检查 API Key 是否正确配置且未过期</li>
                <li>· 确认 API Base URL 格式正确</li>
                <li>· 检查网络连通性和防火墙设置</li>
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end px-6 py-4" style={{borderTop:`1px solid ${T.border}`}}>
          <Btn color={result.ok?T.success:T.t2} onClick={onClose}>确定</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Provider Picker Dialog ───────────────────────────────────────────────────
function ProviderPickerDialog({onSelect,onClose}:{onSelect:(p:AiProvider)=>void;onClose:()=>void}){
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.3)"}}>
      <div className="bg-white rounded-2xl w-[580px]" style={{boxShadow:"0 20px 60px rgba(0,0,0,0.16)"}}>
        <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:`1px solid ${T.border}`}}>
          <div>
            <div className="text-[15px] font-semibold" style={{color:T.t1}}>选择 AI 服务商</div>
            <div className="text-[12px] mt-0.5" style={{color:T.t3}}>选择要接入的 AI 模型服务提供商</div>
          </div>
          <IBtn icon={X} label="关闭" onClick={onClose}/>
        </div>
        <div className="p-5 grid grid-cols-2 gap-2.5 max-h-[440px] overflow-y-auto">
          {ALL_PROVIDERS.map(p=>{
            const c=PROVIDER_CFG[p];
            const descs:Record<AiProvider,string>={
              openai:"GPT-4o、GPT-4 Turbo 等系列",anthropic:"Claude 3.5 Sonnet、Claude 3 Opus",
              google:"Gemini 1.5 Pro、Gemini Flash",deepseek:"DeepSeek-V3、DeepSeek-R1",
              qwen:"Qwen-Max、Qwen-Plus、Qwen-Turbo",azure:"微软 Azure 托管的 OpenAI 模型",
              minimax:"MiniMax-Text、abab 系列",zhipu:"GLM-4、GLM-4-Flash 系列",
              kimi:"Moonshot AI，擅长长文本理解",ollama:"本地部署的开源大模型",
              custom:"支持 OpenAI API 规范的其他供应商",
            };
            return(
              <button key={p} onClick={()=>onSelect(p)}
                className="flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all"
                style={{borderColor:T.border,backgroundColor:"#fff"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=c.color;(e.currentTarget as HTMLButtonElement).style.backgroundColor=c.bg;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=T.border;(e.currentTarget as HTMLButtonElement).style.backgroundColor="#fff";}}>
                <ProviderAvatar provider={p} size={36}/>
                <div>
                  <div className="text-[13px] font-semibold" style={{color:T.t1}}>{c.label}</div>
                  <div className="text-[11px] mt-0.5 line-clamp-1" style={{color:T.t3}}>{descs[p]}</div>
                </div>
                <ChevronRight size={14} color={T.t4} style={{marginLeft:"auto",flexShrink:0}}/>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Drawer ─────────────────────────────────────────────────────
interface CreateDrawerProps{pool?:AiPool;onClose:()=>void;onSave:(p:AiPool)=>void;}
function CreateDrawer({pool,onClose,onSave}:CreateDrawerProps){
  const[step,setStep]=useState<"pick"|"form">(pool?"form":"pick");
  const[provider,setProvider]=useState<AiProvider>(pool?.provider??"openai");
  const[name,setName]=useState(pool?.name??"");
  const[apiUrl,setApiUrl]=useState(pool?.apiUrl??"");
  const[apiKey,setApiKey]=useState("");
  const[showKey,setShowKey]=useState(false);
  const[genModel,setGenModel]=useState(pool?.defaultGenModel??"");
  const[reviewModel,setReviewModel]=useState(pool?.defaultReviewModel??"");
  const[timeout,setTimeout_]=useState(pool?.timeout??30);
  const[maxRetry,setMaxRetry]=useState(pool?.maxRetry??3);
  const[caps,setCaps]=useState<Capability[]>(pool?.capabilities??["text"]);
  const[usages,setUsages]=useState<AiUsage[]>(pool?.usages??[]);
  const[enabled,setEnabled]=useState(pool?.status!=="inactive");
  const[testing,setTesting]=useState(false);
  const isEdit=!!pool;
  const c=PROVIDER_CFG[provider];

  const URLS:Partial<Record<AiProvider,string>>={
    openai:"https://api.openai.com/v1",anthropic:"https://api.anthropic.com",
    google:"https://generativelanguage.googleapis.com/v1",
    deepseek:"https://api.deepseek.com/v1",qwen:"https://dashscope.aliyuncs.com/compatible-mode/v1",
  };

  const handleProviderPick=(p:AiProvider)=>{
    setProvider(p);setStep("form");
    if(!name)setName(`${PROVIDER_CFG[p].label} 连接`);
    if(!apiUrl&&URLS[p])setApiUrl(URLS[p]!);
  };
  const toggleCap=(cap:Capability)=>setCaps(prev=>prev.includes(cap)?prev.filter(c=>c!==cap):[...prev,cap]);
  const toggleUsage=(u:AiUsage)=>setUsages(prev=>prev.includes(u)?prev.filter(x=>x!==u):[...prev,u]);
  const handleTest=()=>{setTesting(true);setTimeout(()=>setTesting(false),1500);};

  if(step==="pick")return(
    <>
      <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={onClose}/>
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white" style={{width:560,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div><div className="text-[15px] font-semibold" style={{color:T.t1}}>新建 AI 连接</div><div className="text-[12px] mt-0.5" style={{color:T.t3}}>选择服务商以开始配置</div></div>
          <IBtn icon={X} label="关闭" onClick={onClose}/>
        </div>
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 gap-2.5 content-start">
          {ALL_PROVIDERS.map(p=>{
            const pc=PROVIDER_CFG[p];
            return(
              <button key={p} onClick={()=>handleProviderPick(p)}
                className="flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all"
                style={{borderColor:T.border}}
                onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=pc.color;(e.currentTarget as HTMLButtonElement).style.backgroundColor=pc.bg;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=T.border;(e.currentTarget as HTMLButtonElement).style.backgroundColor="transparent";}}>
                <ProviderAvatar provider={p} size={36}/>
                <span className="text-[13px] font-medium" style={{color:T.t1}}>{pc.label}</span>
                <ChevronRight size={13} color={T.t4} style={{marginLeft:"auto"}}/>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  return(
    <>
      <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={onClose}/>
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white" style={{width:560,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div>
            <div className="text-[15px] font-semibold" style={{color:T.t1}}>{isEdit?"编辑 AI 连接":"配置 AI 连接"}</div>
            {!isEdit&&<button className="text-[12px] mt-0.5" style={{color:AC,background:"none",border:"none",cursor:"pointer",padding:0}} onClick={()=>setStep("pick")}>← 重新选择服务商</button>}
          </div>
          <IBtn icon={X} label="关闭" onClick={onClose}/>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Provider banner */}
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{backgroundColor:c.bg,border:`1px solid ${c.color}30`}}>
            <ProviderAvatar provider={provider} size={40}/>
            <div><div className="text-[13px] font-semibold" style={{color:c.color}}>{c.label}</div><div className="text-[11px]" style={{color:T.t3}}>选择的服务商</div></div>
          </div>
          {/* Basic info */}
          <div className="flex flex-col gap-3">
            <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>连接名称 <span style={{color:T.danger}}>*</span></label><SInput placeholder="输入连接名称" value={name} onChange={setName}/></div>
            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>API Base URL</label>
              <div className="flex gap-2">
                <SInput placeholder="https://api.openai.com/v1" value={apiUrl} onChange={setApiUrl}/>
                {URLS[provider]&&<button className="h-8 px-2.5 rounded-lg border text-[11px] flex-shrink-0" style={{borderColor:T.border,color:T.t3,whiteSpace:"nowrap"}} onClick={()=>setApiUrl(URLS[provider]!)}>恢复默认</button>}
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>API Key <span style={{color:T.danger}}>*</span></label>
              <SInput type={showKey?"text":"password"} placeholder={isEdit?"已配置，输入新 Key 以替换":"请输入 API Key"} value={apiKey} onChange={setApiKey} suffix={<button style={{background:"none",border:"none",cursor:"pointer",color:T.t3,padding:0}} onClick={()=>setShowKey(!showKey)}>{showKey?<EyeOff size={14}/>:<Eye size={14}/>}</button>}/>
              <p className="text-[11px] mt-1" style={{color:T.t3}}>Key 将加密存储，配置后以脱敏形式展示</p>
            </div>
          </div>
          <div className="h-px" style={{backgroundColor:T.border}}/>
          {/* Models */}
          <div className="flex flex-col gap-3">
            <div className="text-[12px] font-semibold" style={{color:T.t3}}>默认模型配置</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>默认生成模型</label><SInput placeholder="gpt-4o" value={genModel} onChange={setGenModel}/></div>
              <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>默认评审模型</label><SInput placeholder="gpt-4o-mini" value={reviewModel} onChange={setReviewModel}/></div>
            </div>
          </div>
          <div className="h-px" style={{backgroundColor:T.border}}/>
          {/* Advanced */}
          <div className="flex flex-col gap-3">
            <div className="text-[12px] font-semibold" style={{color:T.t3}}>高级配置</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>超时时间（秒）</label><input type="number" value={timeout} onChange={e=>setTimeout_(Number(e.target.value))} className="h-8 w-full border rounded-lg px-3 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}/></div>
              <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>最大重试次数</label><input type="number" value={maxRetry} onChange={e=>setMaxRetry(Number(e.target.value))} min={0} max={5} className="h-8 w-full border rounded-lg px-3 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}/></div>
            </div>
          </div>
          <div className="h-px" style={{backgroundColor:T.border}}/>
          {/* Capabilities */}
          <div>
            <div className="text-[12px] font-semibold mb-2.5" style={{color:T.t3}}>支持能力</div>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(CAP_CFG) as Capability[]).map(cap=>{
                const on=caps.includes(cap); const cc=CAP_CFG[cap];
                return<label key={cap} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-[12px] transition-all" style={{borderColor:on?cc.color:T.border,backgroundColor:on?cc.bg:"#fff",color:on?cc.color:T.t2}}><input type="checkbox" checked={on} onChange={()=>toggleCap(cap)} className="w-3.5 h-3.5"/>{cc.label}</label>;
              })}
            </div>
          </div>
          <div className="h-px" style={{backgroundColor:T.border}}/>
          {/* Usages */}
          <div>
            <div className="text-[12px] font-semibold mb-2.5" style={{color:T.t3}}>绑定用途</div>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(USAGE_CFG) as AiUsage[]).map(u=>{
                const on=usages.includes(u);
                return<label key={u} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-[12px] transition-all" style={{borderColor:on?AC:T.border,backgroundColor:on?"#F5E8FF":"#fff",color:on?AC:T.t2}}><input type="checkbox" checked={on} onChange={()=>toggleUsage(u)} className="w-3.5 h-3.5"/>{USAGE_CFG[u]}</label>;
              })}
            </div>
          </div>
          <div className="h-px" style={{backgroundColor:T.border}}/>
          {/* Enable toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl" style={{border:`1px solid ${T.border}`}}>
            <div><div className="text-[13px] font-medium" style={{color:T.t1}}>启用此连接</div><div className="text-[12px] mt-0.5" style={{color:T.t3}}>停用后该连接不会被平台调用</div></div>
            <Toggle on={enabled} onChange={setEnabled}/>
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5" style={{borderTop:`1px solid ${T.border}`}}>
          <button onClick={handleTest} disabled={testing} className="flex items-center gap-1.5 text-[13px]" style={{color:AC,background:"none",border:"none",cursor:"pointer"}}>
            {testing?<div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{borderColor:`${AC}30`,borderTopColor:AC}}/>:<Zap size={14}/>}
            {testing?"测试中...":"测试连接"}
          </button>
          <div className="flex gap-2">
            <Btn ghost onClick={onClose}>取消</Btn>
            <Btn color={AC} icon={Save} onClick={()=>onSave({id:pool?.id??`c${Date.now()}`,name:name||`${c.label} 连接`,provider,apiUrl,apiKeySet:!!apiKey||!!pool?.apiKeySet,defaultGenModel:genModel,defaultReviewModel:reviewModel,capabilities:caps,usages,status:enabled?"active":"inactive",timeout,maxRetry,lastTestTime:pool?.lastTestTime??null,lastTestResult:pool?.lastTestResult??null,lastTestLatency:pool?.lastTestLatency??null})}>{isEdit?"保存修改":"添加连接"}</Btn>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Model Management Drawer ──────────────────────────────────────────────────
function ModelMgmtDrawer({poolId,poolName,onClose}:{poolId:string;poolName:string;onClose:()=>void}){
  const[models,setModels]=useState<AiModel[]>(MODELS_BY_CONN[poolId]??[]);
  return(
    <>
      <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={onClose}/>
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white" style={{width:720,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div><div className="text-[15px] font-semibold" style={{color:T.t1}}>模型管理 — {poolName}</div><div className="text-[12px] mt-0.5" style={{color:T.t3}}>管理该连接下的可用模型列表</div></div>
          <div className="flex items-center gap-2">
            <Btn icon={Plus} small color={AC} onClick={()=>{}}>添加模型</Btn>
            <IBtn icon={X} label="关闭" onClick={onClose}/>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {models.length===0?(
            <div className="flex flex-col items-center justify-center h-48">
              <Sparkles size={28} color={T.t4} className="mb-3"/>
              <p className="text-[14px]" style={{color:T.t2}}>暂无模型</p>
              <p className="text-[12px] mt-1" style={{color:T.t3}}>点击「获取模型列表」自动拉取，或手动添加</p>
              <Btn icon={RefreshCw} small ghost onClick={()=>{}} style={{marginTop:16}}>获取模型列表</Btn>
            </div>
          ):(
            <div className="rounded-2xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
              <table className="w-full border-collapse">
                <thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                  {["模型名称","模型 ID","类型","最大上下文","图片","JSON","默认","状态","操作"].map((h,i)=>(
                    <th key={i} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-left" style={{color:T.t3}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {models.map(m=>{
                    const tc=MODEL_TYPE_CFG[m.type];
                    return(
                      <tr key={m.id} className="border-b last:border-0" style={{borderColor:T.border,height:48}} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#FAFBFF"} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium" style={{color:T.t1}}>{m.name}</span>
                            {m.isDefault&&<span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{backgroundColor:"#E8F3FF",color:T.primary}}>默认</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[11px] font-mono" style={{color:T.t3}}>{m.modelId}</td>
                        <td className="px-3 py-2"><Chip label={tc.label} color={tc.color} bg={`${tc.color}18`} small/></td>
                        <td className="px-3 py-2 text-[12px]" style={{color:T.t2}}>{(m.maxContext/1000).toFixed(0)}K</td>
                        <td className="px-3 py-2 text-center">{m.supportsImage?<CheckCircle size={13} color={T.success}/>:<span style={{color:T.t4}}>—</span>}</td>
                        <td className="px-3 py-2 text-center">{m.supportsJson?<CheckCircle size={13} color={T.success}/>:<span style={{color:T.t4}}>—</span>}</td>
                        <td className="px-3 py-2 text-center">
                          <Toggle on={m.isDefault} onChange={()=>setModels(prev=>prev.map(x=>({...x,isDefault:x.id===m.id})))}/>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1.5 text-[12px]">
                            <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:m.status==="active"?T.success:T.t4}}/>
                            <span style={{color:m.status==="active"?T.t2:T.t3}}>{m.status==="active"?"启用":"停用"}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-0.5">
                            <IBtn icon={Zap} label="测试" onClick={()=>{}}/>
                            <IBtn icon={Power} label={m.status==="active"?"停用":"启用"} onClick={()=>setModels(prev=>prev.map(x=>x.id===m.id?{...x,status:x.status==="active"?"inactive":"active"}:x))}/>
                            <IBtn icon={Trash2} label="删除" danger onClick={()=>setModels(prev=>prev.filter(x=>x.id!==m.id))}/>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Usage Binding Section ────────────────────────────────────────────────────
function UsageBindSection({pools}:{pools:AiPool[]}){
  const[open,setOpen]=useState(false);
  const activePools=pools.filter(p=>p.status==="active");
  const modelOptions=activePools.flatMap(p=>[{value:`${p.id}:${p.defaultGenModel}`,label:`${p.name} / ${p.defaultGenModel}`}]);

  const[config,setConfig]=useState<Record<AiUsage,{primary:string;backup:string}>>({
    "case-gen":     {primary:modelOptions[0]?.value??"",backup:""},
    "case-review":  {primary:modelOptions[1]?.value??"",backup:modelOptions[0]?.value??""},
    "fail-analysis":{primary:modelOptions[1]?.value??"",backup:""},
    "element-id":   {primary:modelOptions[0]?.value??"",backup:""},
    "assert-suggest":{primary:modelOptions[0]?.value??"",backup:modelOptions[1]?.value??""},
  });

  return(
    <div className="bg-white rounded-2xl overflow-hidden" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
      <button onClick={()=>setOpen(!open)} className="w-full flex items-center justify-between px-5 py-3.5 text-left" style={{borderBottom:open?`1px solid ${T.border}`:"none"}}>
        <div className="flex items-center gap-2.5">
          <Sparkles size={15} style={{color:AC}}/>
          <span className="text-[14px] font-semibold" style={{color:T.t1}}>AI 调用用途配置</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{backgroundColor:"#F5E8FF",color:AC}}>5 个用途</span>
        </div>
        {open?<ChevronDown size={15} color={T.t3}/>:<ChevronRight size={15} color={T.t3}/>}
      </button>
      {open&&(
        <div className="p-5">
          <p className="text-[12px] mb-4" style={{color:T.t3}}>为每种 AI 能力指定主模型和备用模型，当主模型不可用时自动切换到备用模型。</p>
          <table className="w-full border-collapse">
            <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>
              {["AI 能力","主模型","备用模型"].map((h,i)=>(
                <th key={i} className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-left" style={{color:T.t3,width:i===0?"180px":undefined}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {(Object.keys(config) as AiUsage[]).map((usage,i)=>(
                <tr key={usage} style={{borderBottom:i<4?`1px solid ${T.border}`:"none"}}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <Sparkles size={12} color={AC}/>
                      <span className="text-[13px] font-medium" style={{color:T.t1}}>{USAGE_CFG[usage]}</span>
                    </div>
                  </td>
                  {["primary","backup"].map(k=>(
                    <td key={k} className="py-3 pr-4">
                      <select className="w-full h-8 px-2.5 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}}
                        value={config[usage][k as "primary"|"backup"]} onChange={e=>setConfig(prev=>({...prev,[usage]:{...prev[usage],[k]:e.target.value}}))}>
                        <option value="">— 未指定 —</option>
                        {modelOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end mt-4">
            <Btn color={AC} icon={Save} onClick={()=>{}}>保存配置</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function AiPoolModule(){
  const[pools,setPools]=useState<AiPool[]>(INIT_POOLS);
  const[search,setSearch]=useState("");
  const[filterStatus,setFilterStatus]=useState("all");
  const[filterProvider,setFilterProvider]=useState("all");
  const[showCreate,setShowCreate]=useState(false);
  const[editPool,setEditPool]=useState<AiPool|null>(null);
  const[modelPool,setModelPool]=useState<AiPool|null>(null);
  const[testResult,setTestResult]=useState<TestResult|null>(null);
  const[delConfirm,setDelConfirm]=useState<AiPool|null>(null);
  const[testing,setTesting]=useState<string|null>(null);

  const filtered=pools.filter(p=>{
    if(search&&!p.name.toLowerCase().includes(search.toLowerCase()))return false;
    if(filterStatus!=="all"&&p.status!==filterStatus)return false;
    if(filterProvider!=="all"&&p.provider!==filterProvider)return false;
    return true;
  });

  const stats=[
    {label:"连接总数",value:pools.length,color:T.t1,bg:"#F2F3F5"},
    {label:"正常连接",value:pools.filter(p=>p.status==="active").length,color:T.success,bg:"#E8FFEA"},
    {label:"异常连接",value:pools.filter(p=>p.status==="error").length,color:T.danger,bg:"#FFE8E8"},
    {label:"已停用",value:pools.filter(p=>p.status==="inactive").length,color:T.t3,bg:"#F2F3F5"},
  ];

  const handleTest=(pool:AiPool)=>{
    setTesting(pool.id);
    setTimeout(()=>{
      setTesting(null);
      const ok=pool.status==="active"&&pool.apiKeySet;
      setTestResult({ok,latency:ok?Math.floor(200+Math.random()*800):null,model:pool.defaultGenModel,error:ok?undefined:"Connection timed out after 30s",time:new Date().toLocaleString("zh-CN")});
    },1800);
  };
  const doDelete=(pool:AiPool)=>{setPools(p=>p.filter(x=>x.id!==pool.id));setDelConfirm(null);};
  const handleToggle=(pool:AiPool)=>setPools(p=>p.map(x=>x.id===pool.id?{...x,status:x.status==="inactive"?"active":"inactive"}:x));
  const handleSave=(p:AiPool)=>{
    if(editPool)setPools(prev=>prev.map(x=>x.id===editPool.id?p:x));
    else setPools(prev=>[...prev,p]);
    setShowCreate(false);setEditPool(null);
  };

  return(
    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4" style={{backgroundColor:T.bg}}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-semibold" style={{color:T.t1}}>AI 连接池</h3>
          <p className="text-[12px] mt-0.5" style={{color:T.t3}}>管理 AI 服务商连接、模型和调用用途绑定</p>
        </div>
        <div className="flex items-center gap-2">
          <Btn ghost icon={RefreshCw} onClick={()=>{}}>刷新</Btn>
          <Btn icon={Plus} color={AC} onClick={()=>{setEditPool(null);setShowCreate(true);}}>+ 新增连接</Btn>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s,i)=>(
          <div key={i} className="bg-white rounded-xl p-4 flex items-center gap-3" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:s.bg}}>
              <span className="text-[16px] font-bold" style={{color:s.color}}>{s.value}</span>
            </div>
            <div className="text-[12px]" style={{color:T.t3}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex items-center">
          <Search size={12} style={{position:"absolute",left:10,color:T.t3,pointerEvents:"none"}}/>
          <input placeholder="搜索连接名称" value={search} onChange={e=>setSearch(e.target.value)} className="h-8 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,paddingLeft:30,paddingRight:12,width:200,backgroundColor:"#fff"}}/>
        </div>
        <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:110}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">全部状态</option><option value="active">正常</option><option value="error">异常</option><option value="inactive">已停用</option>
        </select>
        <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:120}} value={filterProvider} onChange={e=>setFilterProvider(e.target.value)}>
          <option value="all">全部服务商</option>{ALL_PROVIDERS.map(p=><option key={p} value={p}>{PROVIDER_CFG[p].label}</option>)}
        </select>
      </div>

      {/* Connection table */}
      {filtered.length===0?(
        <div className="bg-white rounded-2xl flex flex-col items-center justify-center py-20" style={{border:`1px solid ${T.border}`}}>
          <Sparkles size={32} color={T.t4} className="mb-3"/>
          <p className="text-[15px] font-medium" style={{color:T.t2}}>暂无 AI 连接</p>
          <p className="text-[12px] mt-1.5 mb-5" style={{color:T.t3}}>点击「新增连接」添加第一个 AI 服务商配置</p>
          <Btn icon={Plus} color={AC} onClick={()=>setShowCreate(true)}>新增连接</Btn>
        </div>
      ):(
        <div className="bg-white rounded-2xl overflow-hidden" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <table className="w-full border-collapse">
            <thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
              {["连接 / 服务商","默认模型","API 地址","Key","支持能力","绑定用途","状态","最近测试","操作"].map((h,i)=>(
                <th key={i} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-left" style={{color:T.t3}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(pool=>{
                const pc=PROVIDER_CFG[pool.provider];
                const isRunning=testing===pool.id;
                return(
                  <tr key={pool.id} className="border-b last:border-0" style={{borderColor:T.border,height:54}} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#FAFBFF"} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2.5">
                        <ProviderAvatar provider={pool.provider} size={30}/>
                        <div>
                          <div className="text-[13px] font-medium" style={{color:T.t1}}>{pool.name}</div>
                          <div className="text-[11px]" style={{color:T.t3}}>{pc.label}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="text-[12px]" style={{color:T.t1}}>{pool.defaultGenModel}</div>
                      <div className="text-[11px]" style={{color:T.t3}}>{pool.defaultReviewModel}</div>
                    </td>
                    <td className="px-4 py-2 max-w-[140px]">
                      <div className="text-[11px] font-mono truncate" style={{color:T.t3}} title={pool.apiUrl}>{pool.apiUrl}</div>
                    </td>
                    <td className="px-4 py-2">
                      {pool.apiKeySet?(
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{backgroundColor:"#E8FFEA",color:T.success}}><Shield size={10}/>已配置</span>
                      ):(
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{backgroundColor:"#FFF3E8",color:T.warning}}><AlertCircle size={10}/>未配置</span>
                      )}
                    </td>
                    <td className="px-4 py-2"><div className="flex flex-wrap gap-1">{pool.capabilities.map(cap=><Chip key={cap} label={CAP_CFG[cap].label} color={CAP_CFG[cap].color} bg={CAP_CFG[cap].bg} small/>)}</div></td>
                    <td className="px-4 py-2">
                      {pool.usages.length>0?<span className="text-[11px] px-2 py-0.5 rounded-full" style={{backgroundColor:"#F5E8FF",color:AC}}>{pool.usages.length} 个用途</span>:<span className="text-[11px]" style={{color:T.t4}}>未绑定</span>}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[12px]">
                        <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:pool.status==="active"?T.success:pool.status==="error"?T.danger:T.t4}}/>
                        <span style={{color:pool.status==="active"?T.t2:pool.status==="error"?T.danger:T.t3}}>
                          {pool.status==="active"?"正常":pool.status==="error"?"异常":"已停用"}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {pool.lastTestTime?(
                        <div>
                          <div className="text-[11px] font-mono" style={{color:pool.lastTestResult==="failed"?T.danger:T.t2}}>
                            {pool.lastTestResult==="success"?`✓ ${pool.lastTestLatency}ms`:"✗ 失败"}
                          </div>
                          <div className="text-[10px]" style={{color:T.t4}}>{pool.lastTestTime}</div>
                        </div>
                      ):<span className="text-[11px]" style={{color:T.t4}}>从未测试</span>}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-0.5">
                        <IBtn icon={isRunning?Clock:Zap} label="测试连接" onClick={()=>!isRunning&&handleTest(pool)}/>
                        <IBtn icon={Layers} label="模型管理" onClick={()=>setModelPool(pool)}/>
                        <IBtn icon={Edit2} label="编辑" onClick={()=>{setEditPool(pool);setShowCreate(true);}}/>
                        <IBtn icon={Power} label={pool.status==="inactive"?"启用":"停用"} onClick={()=>handleToggle(pool)}/>
                        <IBtn icon={Trash2} label="删除" danger onClick={()=>setDelConfirm(pool)}/>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Risk warnings */}
          {pools.some(p=>p.status==="error"||!p.apiKeySet)&&(
            <div className="px-5 py-3 flex items-center gap-2.5" style={{borderTop:`1px solid ${T.border}`,backgroundColor:"#FFFBEB"}}>
              <AlertTriangle size={13} color={T.warning}/>
              <span className="text-[12px]" style={{color:T.warning}}>
                {pools.filter(p=>!p.apiKeySet).length>0&&`${pools.filter(p=>!p.apiKeySet).length} 个连接未配置 API Key　`}
                {pools.filter(p=>p.status==="error").length>0&&`${pools.filter(p=>p.status==="error").length} 个连接状态异常`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Usage binding */}
      <UsageBindSection pools={pools}/>

      {/* Overlays */}
      {(showCreate||editPool)&&<CreateDrawer pool={editPool??undefined} onClose={()=>{setShowCreate(false);setEditPool(null);}} onSave={handleSave}/>}
      {modelPool&&<ModelMgmtDrawer poolId={modelPool.id} poolName={modelPool.name} onClose={()=>setModelPool(null)}/>}
      {testResult&&<TestResultDialog result={testResult} onClose={()=>setTestResult(null)}/>}

      {/* Delete confirm */}
      {delConfirm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.28)"}}>
          <div className="bg-white rounded-2xl p-6 w-[400px]" style={{boxShadow:"0 20px 60px rgba(0,0,0,0.16)"}}>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{backgroundColor:"#FFE8E8"}}><Trash2 size={18} color={T.danger}/></div>
              <div><div className="text-[15px] font-semibold mb-1" style={{color:T.t1}}>删除 AI 连接</div>
                <div className="text-[13px]" style={{color:T.t3}}>确认删除「{delConfirm.name}」？删除后依赖该连接的 AI 能力将无法正常运行。</div></div>
            </div>
            <div className="flex justify-end gap-2">
              <Btn ghost onClick={()=>setDelConfirm(null)}>取消</Btn>
              <Btn color={T.danger} onClick={()=>doDelete(delConfirm)}>确认删除</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
