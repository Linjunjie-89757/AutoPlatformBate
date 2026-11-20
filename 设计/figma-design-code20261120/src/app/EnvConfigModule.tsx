import React,{useState,useRef} from "react";
import {
  Plus,Trash2,Copy,Search,Globe,Power,CheckCircle,X,
  AlertTriangle,XCircle,Shield,ChevronDown,ChevronRight,Eye,EyeOff,
  Link2,Monitor,Smartphone,Variable,ExternalLink,Minus,Check,
  Clock,Key,User,Hash,ArrowUp,ArrowDown,
} from "lucide-react";

const T={primary:"#165DFF",success:"#00B42A",warning:"#FF7D00",danger:"#F53F3F",purple:"#7816FF",cyan:"#0FC6C2",bg:"#F4F6FA",border:"#E5E6EB",t1:"#1D2129",t2:"#4E5969",t3:"#86909C",t4:"#C9CDD4"};

// ─── Utility Components ───────────────────────────────────────────────────────

function PBtn({children,onClick,icon:Icon,small,color=T.primary,variant="primary",disabled}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;variant?:"primary"|"ghost";disabled?:boolean}){
  if(variant==="ghost") return <button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium bg-white transition-colors" style={{borderColor:T.border,color:disabled?T.t4:T.t2,cursor:disabled?"not-allowed":"pointer"}} onMouseEnter={e=>{if(!disabled){e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.color=T.primary;}}} onMouseLeave={e=>{if(!disabled){e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.t2;}}}>{Icon&&<Icon size={13}/>}{children}</button>;
  return <button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-all active:scale-[0.98]" style={{backgroundColor:disabled?"#C9CDD4":color,color:"#fff",height:small?28:32,padding:small?"0 10px":"0 14px",fontSize:small?12:13,cursor:disabled?"not-allowed":"pointer"}} onMouseEnter={e=>{if(!disabled)e.currentTarget.style.filter="brightness(1.1)";}} onMouseLeave={e=>e.currentTarget.style.filter=""}>{Icon&&<Icon size={small?12:13}/>}{children}</button>;
}
function IBtn({icon:Icon,label,danger,onClick}:{icon:React.ElementType;label:string;danger?:boolean;onClick?:()=>void}){return <button title={label} onClick={e=>{e.stopPropagation();onClick?.();}} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{color:T.t4}} onMouseEnter={e=>{e.currentTarget.style.color=danger?T.danger:T.t1;e.currentTarget.style.backgroundColor=danger?"#FFF0F0":"#F2F3F5";}} onMouseLeave={e=>{e.currentTarget.style.color=T.t4;e.currentTarget.style.backgroundColor="transparent";}}><Icon size={13}/></button>;}
function Inp({placeholder,type="text",prefix,mono,width,value,onChange,readOnly}:{placeholder?:string;type?:string;prefix?:React.ReactNode;mono?:boolean;width?:string|number;value?:string;onChange?:(v:string)=>void;readOnly?:boolean}){return <div className="relative flex items-center" style={{width}}>{prefix&&<span className="absolute left-2.5 pointer-events-none" style={{color:T.t3}}>{prefix}</span>}<input readOnly={readOnly} type={type} placeholder={placeholder} value={value??""} onChange={e=>onChange?.(e.target.value)} className={`h-8 border rounded-lg text-[13px] outline-none transition-all w-full ${prefix?"pl-8 pr-3":"px-3"} ${mono?"font-mono text-[12px]":""}`} style={{borderColor:T.border,color:T.t1,background:readOnly?"#FAFAFA":"#fff"}} onFocus={e=>{if(!readOnly){e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.primary}18`;}}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="";}}/></div>;}
function Toggle({on,onChange,disabled}:{on:boolean;onChange:(v:boolean)=>void;disabled?:boolean}){return <button onClick={()=>!disabled&&onChange(!on)} className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0" style={{backgroundColor:on?T.primary:"#C9CDD4",cursor:disabled?"not-allowed":"pointer"}}><span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all" style={{left:on?"calc(100% - 14px)":"2px"}}/></button>;}
function FieldLabel({label,required,hint}:{label:string;required?:boolean;hint?:string}){return <div className="mb-1.5"><label className="text-[12px] font-medium" style={{color:T.t2}}>{label}{required&&<span style={{color:T.danger}}> *</span>}</label>{hint&&<span className="text-[11px] ml-1.5" style={{color:T.t4}}>{hint}</span>}</div>;}
function ModalWrap({children,width=500}:{children:React.ReactNode;width?:number}){return <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:"rgba(29,33,41,0.5)"}}><div className="flex flex-col rounded-2xl overflow-hidden" style={{width,background:"#fff",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",maxHeight:"90vh"}}>{children}</div></div>;}
function ModalHead({title,subtitle,onClose}:{title:string;subtitle?:string;onClose:()=>void}){return <div className="flex items-start justify-between px-6 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}><div><h2 className="text-[15px] font-semibold" style={{color:T.t1}}>{title}</h2>{subtitle&&<p className="text-[12px] mt-0.5" style={{color:T.t3}}>{subtitle}</p>}</div><button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{color:T.t4,background:"none",border:"none",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}><X size={16}/></button></div>;}
function ModalFoot({children}:{children:React.ReactNode}){return <div className="flex justify-end gap-2 px-6 py-4 flex-shrink-0" style={{borderTop:`1px solid ${T.border}`,background:"#FAFAFA"}}>{children}</div>;}

// ─── Types ────────────────────────────────────────────────────────────────────

type EnvStage="dev"|"test"|"staging"|"prod"|"sandbox";
type ApplicableType="api"|"webui"|"app";
type AuthType="none"|"bearer"|"basic"|"apikey"|"digest";

interface EnvHeader{id:string;enabled:boolean;key:string;value:string;sensitive:boolean;}
interface ApiConfig{baseUrl:string;timeout:number;headers:EnvHeader[];authType:AuthType;authBearer:string;authBasicUser:string;authBasicPass:string;authApiKeyName:string;authApiKeyValue:string;authApiKeyIn:"header"|"query";authDigestUser:string;authDigestPass:string;}
interface WebUIConfig{entryUrl:string;pageLoadTimeout:number;enabled:boolean;}
interface BoundVarSet{id:string;name:string;applicableTypes:ApplicableType[];varCount:number;hasSensitive:boolean;version:string;sampleVarNames?:string[];}

interface Env{
  id:string;name:string;identifier:string;description:string;
  stage:EnvStage;isProd:boolean;enabled:boolean;
  updatedAt:string;updatedBy:string;
  apiConfig:ApiConfig|null;
  webUIConfig:WebUIConfig|null;
  boundVarSets:BoundVarSet[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_META:Record<EnvStage,{label:string;color:string;bg:string}> = {
  dev:{label:"开发",color:"#4E5969",bg:"#F2F3F5"},
  test:{label:"测试",color:T.primary,bg:"#E8F3FF"},
  staging:{label:"预发布",color:T.purple,bg:"#F5E8FF"},
  prod:{label:"生产",color:T.danger,bg:"#FFE8E8"},
  sandbox:{label:"沙箱",color:T.cyan,bg:"#E8FFFE"},
};

const APPLY_META:Record<ApplicableType,{label:string;color:string;bg:string;icon:React.ElementType}> = {
  api:{label:"接口自动化",color:T.primary,bg:"#E8F3FF",icon:Link2},
  webui:{label:"Web UI 自动化",color:T.cyan,bg:"#E8FFFE",icon:Monitor},
  app:{label:"APP 自动化",color:T.purple,bg:"#F5E8FF",icon:Smartphone},
};

const ALL_VAR_SETS:BoundVarSet[]=[
  {id:"vs1",name:"QA 公共变量集",applicableTypes:["api","webui"],varCount:24,hasSensitive:true,version:"v3.2",
    sampleVarNames:["API_GATEWAY_URL","AUTH_TOKEN","DB_HOST","RETRY_COUNT","LOG_LEVEL","TIMEOUT","BASE_URL","ENV_TAG"]},
  {id:"vs2",name:"订单模块变量集",applicableTypes:["api"],varCount:11,hasSensitive:false,version:"v1.0",
    sampleVarNames:["API_GATEWAY_URL","ORDER_SVC_URL","SIGN_KEY","MAX_AMOUNT","TIMEOUT"]},
  {id:"vs3",name:"用户中心变量集",applicableTypes:["api","webui"],varCount:8,hasSensitive:true,version:"v0.9",
    sampleVarNames:["USER_SVC_URL","AUTH_TOKEN","SESSION_TTL","LOGIN_URL"]},
  {id:"vs4",name:"性能基线变量集",applicableTypes:["api"],varCount:6,hasSensitive:false,version:"v1.1",
    sampleVarNames:["CONCURRENCY","DURATION","RAMP_UP","SAMPLE_RATE"]},
  {id:"vs5",name:"APP 回归变量集",applicableTypes:["app"],varCount:14,hasSensitive:false,version:"v2.0",
    sampleVarNames:["APP_ENTRY","DEVICE_ID","OS_VERSION","APP_VERSION"]},
  {id:"vs6",name:"全场景公共变量",applicableTypes:["api","webui","app"],varCount:5,hasSensitive:false,version:"v1.0",
    sampleVarNames:["LOG_LEVEL","ENV_TAG","BASE_URL"]},
];

const mkApiCfg=(baseUrl:string,extra?:Partial<ApiConfig>):ApiConfig=>({
  baseUrl,timeout:30000,
  headers:[
    {id:"h1",enabled:true,key:"Content-Type",value:"application/json",sensitive:false},
    {id:"h2",enabled:true,key:"X-Tenant-ID",value:"{{tenantId}}",sensitive:false},
  ],
  authType:"bearer",authBearer:"{{API_TOKEN}}",
  authBasicUser:"",authBasicPass:"",
  authApiKeyName:"X-API-Key",authApiKeyValue:"",authApiKeyIn:"header",
  authDigestUser:"",authDigestPass:"",
  ...extra,
});

const INIT_ENVS:Env[]=[
  {id:"e1",name:"功能测试环境",identifier:"test",description:"QA 日常接口与 UI 回归，接口 + Web UI 均配置",stage:"test",isProd:false,enabled:true,updatedAt:"2026-07-29 09:15",updatedBy:"张程远",
    apiConfig:mkApiCfg("https://api.test.internal"),
    webUIConfig:{entryUrl:"https://app.test.internal",pageLoadTimeout:30000,enabled:true},
    boundVarSets:[ALL_VAR_SETS[0],ALL_VAR_SETS[1]]},
  {id:"e2",name:"预发布环境",identifier:"staging",description:"上线前接口回归，仅配置接口层",stage:"staging",isProd:false,enabled:true,updatedAt:"2026-07-28 17:30",updatedBy:"王芳",
    apiConfig:mkApiCfg("https://api.staging.internal",{authType:"basic",authBasicUser:"qa-bot",authBasicPass:"••••••"}),
    webUIConfig:null,
    boundVarSets:[ALL_VAR_SETS[0]]},
  {id:"e3",name:"开发联调环境",identifier:"dev",description:"联调阶段，地址随迭代更新",stage:"dev",isProd:false,enabled:true,updatedAt:"2026-07-27 14:20",updatedBy:"陈伟",
    apiConfig:mkApiCfg("http://dev-gateway.internal:8080",{certValidation:false,authType:"none",headers:[]}),
    webUIConfig:null,
    boundVarSets:[]},
  {id:"e4",name:"生产巡检环境",identifier:"prod",description:"仅用于线上巡检，严禁写操作",stage:"prod",isProd:true,enabled:true,updatedAt:"2026-07-20 10:00",updatedBy:"张程远",
    apiConfig:mkApiCfg("https://api.example.com",{authType:"apikey",authApiKeyName:"X-Api-Key",authApiKeyValue:"••••••••",authApiKeyIn:"header"}),
    webUIConfig:{entryUrl:"https://www.example.com",pageLoadTimeout:60000,enabled:false},
    boundVarSets:[ALL_VAR_SETS[0]]},
  {id:"e5",name:"沙箱演示环境",identifier:"sandbox",description:"数据隔离，用于演示和培训",stage:"sandbox",isProd:false,enabled:false,updatedAt:"2026-07-25 11:00",updatedBy:"李明",
    apiConfig:null,webUIConfig:null,
    boundVarSets:[]},
];

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastItem={id:string;msg:string;type:"success"|"error"|"warn"};
function useToast(){
  const[items,setItems]=useState<ToastItem[]>([]);
  const show=(msg:string,type:ToastItem["type"]="success")=>{const id=Date.now().toString();setItems(p=>[...p,{id,msg,type}]);setTimeout(()=>setItems(p=>p.filter(x=>x.id!==id)),3500);};
  return{items,show};
}
function ToastList({items}:{items:ToastItem[]}){
  if(!items.length)return null;
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,display:"flex",flexDirection:"column",gap:8}}>{items.map(t=>{const c=t.type==="success"?{bg:"#E8FFEA",bd:T.success,ic:<CheckCircle size={14}/>,co:T.success}:t.type==="error"?{bg:"#FFE8E8",bd:T.danger,ic:<XCircle size={14}/>,co:T.danger}:{bg:"#FFF3E8",bd:T.warning,ic:<AlertTriangle size={14}/>,co:T.warning};return <div key={t.id} style={{background:c.bg,border:`1px solid ${c.bd}`,borderRadius:12,padding:"10px 16px",display:"flex",alignItems:"center",gap:8,color:c.co,fontSize:13,fontWeight:500,minWidth:280,boxShadow:"0 4px 20px rgba(0,0,0,0.12)"}}>{c.ic}{t.msg}</div>})}</div>;
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function CreateEnvModal({onClose,onCreate}:{onClose:()=>void;onCreate:(e:Env)=>void}){
  const[name,setName]=useState("");
  const[identifier,setIdentifier]=useState("");
  const[stage,setStage]=useState<EnvStage>("test");
  const[desc,setDesc]=useState("");
  const[isProd,setIsProd]=useState(false);
  const autoId=useRef(true);
  const handleNameChange=(v:string)=>{setName(v);if(autoId.current)setIdentifier(v.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""));};
  return(
    <ModalWrap>
      <ModalHead title="新建环境" subtitle="创建后可在详情页配置 API、Web UI 等连接参数" onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
        <div><FieldLabel label="环境名称" required/><Inp placeholder="例：功能测试环境" width="100%" value={name} onChange={handleNameChange}/></div>
        <div><FieldLabel label="环境标识符" hint="系统内部识别标识，不作为变量引用"/><Inp placeholder="例：test-env" mono width="100%" value={identifier} onChange={v=>{autoId.current=false;setIdentifier(v);}}/></div>
        <div><FieldLabel label="环境阶段"/>
          <div className="flex gap-2 flex-wrap">
            {(["dev","test","staging","prod","sandbox"] as EnvStage[]).map(s=>{const m=STAGE_META[s];const sel=stage===s;return <button key={s} onClick={()=>{setStage(s);if(s==="prod")setIsProd(true);}} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all" style={{border:`1.5px solid ${sel?m.color:T.border}`,background:sel?m.bg:"#fff",color:sel?m.color:T.t3,cursor:"pointer"}}>{m.label}</button>;})}
          </div>
        </div>
        <div className="flex items-center justify-between py-2.5 px-3 rounded-lg" style={{background:"#FAFAFA",border:`1px solid ${T.border}`}}>
          <div><p className="text-[13px] font-medium" style={{color:T.t1}}>标记为生产环境</p><p className="text-[11px] mt-0.5" style={{color:T.t3}}>保存生产环境配置时将额外要求确认</p></div>
          <Toggle on={isProd} onChange={setIsProd}/>
        </div>
        <div><FieldLabel label="描述"/><Inp placeholder="说明该环境的用途和范围" width="100%" value={desc} onChange={setDesc}/></div>
        {isProd&&<div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{background:"#FFE8E8",border:`1px solid #FBBBBB`}}><AlertTriangle size={14} style={{color:T.danger,flexShrink:0,marginTop:1}}/><p className="text-[12px]" style={{color:T.danger}}>已标记为生产环境，修改配置时将提示二次确认。</p></div>}
      </div>
      <ModalFoot>
        <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
        <PBtn onClick={()=>{if(!name.trim()||!identifier.trim())return;const ne:Env={id:"e_"+Date.now(),name,identifier,description:desc,stage,isProd,enabled:true,updatedAt:"刚刚",updatedBy:"我",apiConfig:null,webUIConfig:null,boundVarSets:[]};onCreate(ne);onClose();}}>创建环境</PBtn>
      </ModalFoot>
    </ModalWrap>
  );
}

function ProdSaveConfirm({envName,onClose,onConfirm}:{envName:string;onClose:()=>void;onConfirm:()=>void}){
  return(
    <ModalWrap width={440}>
      <ModalHead title="确认保存生产环境配置" onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4">
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{background:"#FFE8E8",border:`1px solid #FBBBBB`}}>
          <AlertTriangle size={18} style={{color:T.danger,flexShrink:0,marginTop:1}}/>
          <div><p className="text-[13px] font-semibold mb-1" style={{color:T.danger}}>你正在修改生产环境配置</p><p className="text-[12px]" style={{color:T.danger}}>「{envName}」已被标记为生产环境。配置变更将影响生产服务的连接参数，请确认已核实无误。</p></div>
        </div>
        <p className="text-[13px]" style={{color:T.t2}}>变更将立即生效，建议先在测试环境验证后再应用到生产。</p>
      </div>
      <ModalFoot><PBtn variant="ghost" onClick={onClose}>取消</PBtn><PBtn onClick={()=>{onConfirm();onClose();}} color={T.danger}>确认保存生产配置</PBtn></ModalFoot>
    </ModalWrap>
  );
}

function BindVarSetModal({bound,onClose,onBind}:{bound:BoundVarSet[];onClose:()=>void;onBind:(sets:BoundVarSet[])=>void}){
  const boundIds=bound.map(v=>v.id);
  const available=ALL_VAR_SETS.filter(v=>!boundIds.includes(v.id));
  const[selected,setSelected]=useState<string[]>([]);
  const toggle=(id:string)=>setSelected(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  return(
    <ModalWrap width={500}>
      <ModalHead title="绑定变量集" subtitle="选择已有变量集，适用自动化类型由变量集自身决定" onClose={onClose}/>
      <div className="px-6 py-4 flex flex-col gap-2 overflow-y-auto" style={{maxHeight:380}}>
        {available.length===0?<p className="text-[13px] py-8 text-center" style={{color:T.t3}}>所有变量集已绑定</p>:available.map(vs=>{
          const sel=selected.includes(vs.id);
          return(
            <div key={vs.id} onClick={()=>toggle(vs.id)} className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all" style={{border:`1.5px solid ${sel?T.primary:T.border}`,background:sel?`${T.primary}06`:"#fff"}}>
              <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{background:sel?T.primary:T.border}}>{sel&&<Check size={10} color="#fff"/>}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-medium" style={{color:T.t1}}>{vs.name}</span>
                  {vs.hasSensitive&&<span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"#FFF3E8",color:T.warning}}>含敏感变量</span>}
                </div>
                <div className="flex items-center gap-2">
                  {vs.applicableTypes.map(t=>{const m=APPLY_META[t];return <span key={t} className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{background:m.bg,color:m.color}}><m.icon size={9}/>{m.label}</span>;})}
                  <span className="text-[11px] font-mono" style={{color:T.t4}}>{vs.version}</span>
                  <span className="text-[11px]" style={{color:T.t3}}>{vs.varCount} 个变量</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <ModalFoot>
        <span className="mr-auto text-[12px]" style={{color:T.t3}}>已选 {selected.length} 个</span>
        <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
        <PBtn disabled={selected.length===0} onClick={()=>{onBind(ALL_VAR_SETS.filter(v=>selected.includes(v.id)));onClose();}}>确认绑定</PBtn>
      </ModalFoot>
    </ModalWrap>
  );
}

function DeleteEnvConfirm({env,onClose,onConfirm}:{env:Env;onClose:()=>void;onConfirm:()=>void}){
  const hasVarSets=env.boundVarSets.length>0;
  return(
    <ModalWrap width={440}>
      <ModalHead title="确认删除环境" onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4">
        <p className="text-[13px]" style={{color:T.t2}}>删除后「<strong>{env.name}</strong>」的所有连接配置将永久丢失，此操作不可恢复。</p>
        {hasVarSets&&<div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{background:"#FFF3E8",border:`1px solid ${T.warning}40`}}><AlertTriangle size={14} style={{color:T.warning,flexShrink:0,marginTop:1}}/><p className="text-[12px]" style={{color:T.t2}}>此环境已绑定 <strong>{env.boundVarSets.length}</strong> 个变量集，删除后绑定关系将一并移除。</p></div>}
        {env.isProd&&<div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{background:"#FFE8E8",border:`1px solid #FBBBBB`}}><AlertTriangle size={14} style={{color:T.danger,flexShrink:0,marginTop:1}}/><p className="text-[12px]" style={{color:T.danger}}>这是一个生产环境，请谨慎操作。</p></div>}
      </div>
      <ModalFoot><PBtn variant="ghost" onClick={onClose}>取消</PBtn><PBtn onClick={()=>{onConfirm();onClose();}} color={T.danger}>确认删除</PBtn></ModalFoot>
    </ModalWrap>
  );
}

// ─── Tab Panels ───────────────────────────────────────────────────────────────

function SectionCard({title,children,action}:{title:string;children:React.ReactNode;action?:React.ReactNode}){
  return(
    <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
      <div className="flex items-center justify-between px-5 py-3" style={{borderBottom:`1px solid ${T.border}`,background:"#FAFAFA"}}>
        <span className="text-[13px] font-semibold" style={{color:T.t1}}>{title}</span>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function BasicInfoPanel({env,onChange}:{env:Env;onChange:(patch:Partial<Env>)=>void}){
  const stM=STAGE_META[env.stage];
  return(
    <div className="flex flex-col gap-4">
      <SectionCard title="基本信息">
        <div className="grid grid-cols-2 gap-4">
          <div><FieldLabel label="环境名称" required/><Inp value={env.name} onChange={v=>onChange({name:v})} width="100%"/></div>
          <div><FieldLabel label="环境标识符" hint="系统内部识别，不作为变量引用"/><Inp value={env.identifier} onChange={v=>onChange({identifier:v})} mono width="100%"/></div>
        </div>
        <div className="mt-4"><FieldLabel label="描述"/><Inp value={env.description} onChange={v=>onChange({description:v})} placeholder="说明该环境的用途和范围" width="100%"/></div>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[12px] font-medium" style={{color:T.t2}}>环境阶段</span>
          <div className="flex gap-2 flex-wrap ml-1">
            {(["dev","test","staging","prod","sandbox"] as EnvStage[]).map(s=>{const m=STAGE_META[s];const sel=env.stage===s;return <button key={s} onClick={()=>onChange({stage:s})} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all" style={{border:`1.5px solid ${sel?m.color:T.border}`,background:sel?m.bg:"#fff",color:sel?m.color:T.t3,cursor:"pointer"}}>{m.label}</button>;})}
          </div>
        </div>
      </SectionCard>
      <SectionCard title="环境属性">
        <div className="flex items-center justify-between py-2">
          <div><p className="text-[13px] font-medium" style={{color:T.t1}}>标记为生产环境</p><p className="text-[12px] mt-0.5" style={{color:T.t3}}>保存时将弹出额外确认；建议仅对直连线上系统的环境开启</p></div>
          <Toggle on={env.isProd} onChange={v=>onChange({isProd:v})}/>
        </div>
        <div className="flex items-center justify-between py-2" style={{borderTop:`1px solid ${T.border}`,marginTop:8}}>
          <div><p className="text-[13px] font-medium" style={{color:T.t1}}>启用环境</p><p className="text-[12px] mt-0.5" style={{color:T.t3}}>停用后该环境不可被测试任务选择</p></div>
          <Toggle on={env.enabled} onChange={v=>onChange({enabled:v})}/>
        </div>
      </SectionCard>
      <div className="flex items-center gap-2 text-[12px]" style={{color:T.t4}}>
        <Clock size={12}/>
        <span>最后更新：{env.updatedAt} · {env.updatedBy}</span>
      </div>
    </div>
  );
}

function HeadersSection({headers,onChange}:{headers:EnvHeader[];onChange:(h:EnvHeader[])=>void}){
  // Default: collapsed when empty, expanded when already has headers
  const[expanded,setExpanded]=useState(headers.length>0);
  const[showValues,setShowValues]=useState<Record<string,boolean>>({});
  const update=(id:string,field:keyof EnvHeader,value:unknown)=>onChange(headers.map(h=>h.id===id?{...h,[field]:value}:h));
  const addRow=()=>{onChange([...headers,{id:"h_"+Date.now(),enabled:true,key:"",value:"",sensitive:false}]);setExpanded(true);};
  const del=(id:string)=>onChange(headers.filter(h=>h.id!==id));
  return(
    <div>
      <button onClick={()=>setExpanded(p=>!p)} className="flex items-center gap-2 mb-3 w-full text-left" style={{background:"none",border:"none",cursor:"pointer",padding:0}}>
        {expanded?<ChevronDown size={13} style={{color:T.t3}}/>:<ChevronRight size={13} style={{color:T.t3}}/>}
        <span className="text-[13px] font-semibold" style={{color:T.t1}}>公共请求头</span>
        {headers.length>0
          ?<span className="text-[11px] px-1.5 py-0.5 rounded" style={{background:"#F2F3F5",color:T.t3}}>{headers.length} 条</span>
          :<span className="text-[11px]" style={{color:T.t4}}>未配置</span>
        }
        {!expanded&&<span className="text-[12px] ml-1" style={{color:T.t4}}>每次请求自动携带</span>}
      </button>
      {expanded&&(
        headers.length===0?(
          // Empty state — no table, just an add button
          <div className="flex items-center justify-center py-6 rounded-xl" style={{border:`1px dashed ${T.border}`,background:"#FAFAFA"}}>
            <button onClick={addRow} className="flex items-center gap-2 text-[13px] font-medium transition-colors" style={{background:"none",border:"none",cursor:"pointer",color:T.t3}} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
              <Plus size={13}/><span>添加公共请求头</span>
            </button>
          </div>
        ):(
          <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
            <div style={{borderBottom:`1px solid ${T.border}`,background:"#FAFAFA",display:"grid",gridTemplateColumns:"32px 1fr 1fr 48px 32px",gap:0}}>
              {["启用","请求头名称","值","脱敏",""].map((h,i)=><div key={i} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{color:T.t3}}>{h}</div>)}
            </div>
            <div className="bg-white">
              {headers.map(h=>(
                <div key={h.id} style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr 48px 32px",gap:0,borderBottom:`1px solid ${T.border}`,alignItems:"center"}}>
                  <div className="flex justify-center py-2"><Toggle on={h.enabled} onChange={v=>update(h.id,"enabled",v)}/></div>
                  <div className="px-2 py-1.5"><input value={h.key} onChange={e=>update(h.id,"key",e.target.value)} placeholder="Header-Name" className="w-full h-7 px-2 rounded text-[12px] font-mono border outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.target.style.borderColor=T.primary;}} onBlur={e=>{e.target.style.borderColor=T.border;}}/></div>
                  <div className="px-2 py-1.5 flex items-center gap-1">
                    <input value={h.value} onChange={e=>update(h.id,"value",e.target.value)} type={h.sensitive&&!showValues[h.id]?"password":"text"} placeholder="值或 {{变量}}" className="w-full h-7 px-2 rounded text-[12px] font-mono border outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.target.style.borderColor=T.primary;}} onBlur={e=>{e.target.style.borderColor=T.border;}}/>
                    {h.sensitive&&<button onClick={()=>setShowValues(p=>({...p,[h.id]:!p[h.id]}))} style={{background:"none",border:"none",cursor:"pointer",color:T.t4,flexShrink:0}}>{showValues[h.id]?<EyeOff size={12}/>:<Eye size={12}/>}</button>}
                  </div>
                  <div className="flex justify-center"><Toggle on={h.sensitive} onChange={v=>update(h.id,"sensitive",v)}/></div>
                  <div className="flex justify-center"><button onClick={()=>del(h.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.t4}} onMouseEnter={e=>e.currentTarget.style.color=T.danger} onMouseLeave={e=>e.currentTarget.style.color=T.t4}><Minus size={13}/></button></div>
                </div>
              ))}
              <button onClick={addRow} className="flex items-center gap-2 px-4 py-2.5 w-full text-left transition-colors" style={{background:"none",border:"none",cursor:"pointer",color:T.t3}} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
                <Plus size={12}/><span className="text-[12px]">添加请求头</span>
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function AuthSection({cfg,onChange}:{cfg:ApiConfig;onChange:(patch:Partial<ApiConfig>)=>void}){
  const AUTH_OPTIONS:[AuthType,string,React.ElementType][]=[["none","不认证",Shield],["bearer","Bearer Token",Key],["basic","Basic Auth",User],["apikey","API Key",Hash],["digest","Digest Auth",Shield]];
  const[showPass,setShowPass]=useState(false);
  return(
    <div>
      <p className="text-[12px] font-semibold mb-3" style={{color:T.t2}}>认证方式</p>
      <div className="flex gap-2 flex-wrap mb-4">
        {AUTH_OPTIONS.map(([type,label,Icon])=>{const sel=cfg.authType===type;return <button key={type} onClick={()=>onChange({authType:type})} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all" style={{border:`1.5px solid ${sel?T.primary:T.border}`,background:sel?`${T.primary}08`:"#fff",color:sel?T.primary:T.t3,cursor:"pointer"}}><Icon size={11}/>{label}</button>;})}
      </div>
      {cfg.authType==="bearer"&&(
        <div><FieldLabel label="Token" hint="支持 {{变量}} 引用"/><Inp value={cfg.authBearer} onChange={v=>onChange({authBearer:v})} mono width="100%" placeholder="Bearer token 或 {{API_TOKEN}}"/></div>
      )}
      {cfg.authType==="basic"&&(
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel label="用户名"/><Inp value={cfg.authBasicUser} onChange={v=>onChange({authBasicUser:v})} width="100%" placeholder="Username"/></div>
          <div><FieldLabel label="密码"/>
            <div className="relative flex items-center">
              <input type={showPass?"text":"password"} value={cfg.authBasicPass} onChange={e=>onChange({authBasicPass:e.target.value})} className="h-8 px-3 pr-9 border rounded-lg text-[13px] outline-none w-full" style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.target.style.borderColor=T.primary;}} onBlur={e=>{e.target.style.borderColor=T.border;}}/>
              <button onClick={()=>setShowPass(p=>!p)} className="absolute right-2" style={{background:"none",border:"none",cursor:"pointer",color:T.t4}}>{showPass?<EyeOff size={14}/>:<Eye size={14}/>}</button>
            </div>
          </div>
        </div>
      )}
      {cfg.authType==="apikey"&&(
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel label="Header/参数名"/><Inp value={cfg.authApiKeyName} onChange={v=>onChange({authApiKeyName:v})} mono width="100%" placeholder="X-API-Key"/></div>
            <div><FieldLabel label="Key 值" hint="支持 {{变量}}"/><Inp value={cfg.authApiKeyValue} onChange={v=>onChange({authApiKeyValue:v})} type="password" width="100%"/></div>
          </div>
          <div>
            <p className="text-[12px] font-medium mb-1.5" style={{color:T.t2}}>传入方式</p>
            <div className="flex gap-2">
              {(["header","query"] as const).map(p=><button key={p} onClick={()=>onChange({authApiKeyIn:p})} className="px-3 py-1 rounded-lg text-[12px] font-medium" style={{border:`1.5px solid ${cfg.authApiKeyIn===p?T.primary:T.border}`,background:cfg.authApiKeyIn===p?`${T.primary}08`:"#fff",color:cfg.authApiKeyIn===p?T.primary:T.t3,cursor:"pointer"}}>{p==="header"?"请求头":"Query 参数"}</button>)}
            </div>
          </div>
        </div>
      )}
      {cfg.authType==="digest"&&(
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel label="用户名"/><Inp value={cfg.authDigestUser} onChange={v=>onChange({authDigestUser:v})} width="100%"/></div>
          <div><FieldLabel label="密码"/>
            <div className="relative flex items-center">
              <input type={showPass?"text":"password"} value={cfg.authDigestPass} onChange={e=>onChange({authDigestPass:e.target.value})} className="h-8 px-3 pr-9 border rounded-lg text-[13px] outline-none w-full" style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.target.style.borderColor=T.primary;}} onBlur={e=>{e.target.style.borderColor=T.border;}}/>
              <button onClick={()=>setShowPass(p=>!p)} className="absolute right-2" style={{background:"none",border:"none",cursor:"pointer",color:T.t4}}>{showPass?<EyeOff size={14}/>:<Eye size={14}/>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApiConfigPanel({env,onChange}:{env:Env;onChange:(patch:Partial<Env>)=>void}){
  const cfg=env.apiConfig;
  const updateCfg=(patch:Partial<ApiConfig>)=>{
    const base:ApiConfig=cfg??{baseUrl:"",timeout:30000,headers:[],authType:"none",authBearer:"",authBasicUser:"",authBasicPass:"",authApiKeyName:"X-API-Key",authApiKeyValue:"",authApiKeyIn:"header",authDigestUser:"",authDigestPass:""};
    onChange({apiConfig:{...base,...patch}});
  };
  return(
    <div className="flex flex-col gap-4">
      <SectionCard title="连接参数">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="col-span-2"><FieldLabel label="Base URL" required hint="所有接口请求的基础地址前缀"/><Inp value={cfg?.baseUrl??""} onChange={v=>updateCfg({baseUrl:v})} mono width="100%" placeholder="https://api.example.com"/></div>
          <div><FieldLabel label="默认请求超时 (ms)" hint="接口未单独配置超时时使用此值"/><Inp value={String(cfg?.timeout??30000)} onChange={v=>updateCfg({timeout:Number(v)||30000})} width="100%"/></div>
        </div>
      </SectionCard>
      <SectionCard title="公共请求头 & 认证">
        <div className="flex flex-col gap-5">
          <HeadersSection headers={cfg?.headers??[]} onChange={h=>updateCfg({headers:h})}/>
          <div style={{borderTop:`1px solid ${T.border}`,paddingTop:16}}>
            <AuthSection cfg={cfg??{baseUrl:"",timeout:30000,headers:[],authType:"none",authBearer:"",authBasicUser:"",authBasicPass:"",authApiKeyName:"X-API-Key",authApiKeyValue:"",authApiKeyIn:"header",authDigestUser:"",authDigestPass:""}} onChange={updateCfg}/>
          </div>
        </div>
      </SectionCard>
      {!cfg?.baseUrl&&<div className="flex items-start gap-2 px-4 py-3 rounded-xl" style={{background:"#F0F5FF",border:`1px solid ${T.primary}25`}}><AlertTriangle size={14} style={{color:T.primary,flexShrink:0,marginTop:1}}/><p className="text-[12px]" style={{color:T.t2}}>填写 Base URL 后，接口测试任务才能在此环境中执行。</p></div>}
    </div>
  );
}

function WebUIPanel({env,onChange}:{env:Env;onChange:(patch:Partial<Env>)=>void}){
  const cfg=env.webUIConfig;
  const updateCfg=(patch:Partial<WebUIConfig>)=>{
    const base:WebUIConfig=cfg??{entryUrl:"",pageLoadTimeout:30000,enabled:true};
    onChange({webUIConfig:{...base,...patch}});
  };
  return(
    <div className="flex flex-col gap-4">
      <SectionCard title="Web UI 连接参数">
        <div className="flex flex-col gap-4">
          <div><FieldLabel label="入口 URL" required hint="浏览器测试的起始页面地址"/><Inp value={cfg?.entryUrl??""} onChange={v=>updateCfg({entryUrl:v})} mono width="100%" placeholder="https://app.example.com"/></div>
          <div><FieldLabel label="页面加载超时 (ms)"/><Inp value={String(cfg?.pageLoadTimeout??30000)} onChange={v=>updateCfg({pageLoadTimeout:Number(v)||30000})} width="100%"/></div>
          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg" style={{background:"#FAFAFA",border:`1px solid ${T.border}`}}>
            <div><p className="text-[13px] font-medium" style={{color:T.t1}}>启用 Web UI 配置</p><p className="text-[12px] mt-0.5" style={{color:T.t3}}>停用后 Web UI 测试任务不可选择此环境</p></div>
            <Toggle on={cfg?.enabled??true} onChange={v=>updateCfg({enabled:v})}/>
          </div>
        </div>
      </SectionCard>
      {!cfg?.entryUrl&&<div className="flex items-start gap-2 px-4 py-3 rounded-xl" style={{background:"#F0F5FF",border:`1px solid ${T.primary}25`}}><AlertTriangle size={14} style={{color:T.primary,flexShrink:0,marginTop:1}}/><p className="text-[12px]" style={{color:T.t2}}>填写入口 URL 后，Web UI 测试任务才能在此环境中执行。</p></div>}
    </div>
  );
}

function AppPanel(){
  return(
    <div className="flex flex-col items-center justify-center py-20 rounded-xl" style={{border:`1px dashed ${T.border}`,background:"#FAFAFA"}}>
      <Smartphone size={40} style={{color:T.t4}} className="mb-4"/>
      <p className="text-[14px] font-semibold mb-1" style={{color:T.t2}}>APP 配置待开放</p>
      <p className="text-[13px]" style={{color:T.t3}}>APP 自动化环境参数配置功能即将上线，请关注版本更新。</p>
    </div>
  );
}

function VarBindingPanel({env,onChange,onOpenBind}:{env:Env;onChange:(patch:Partial<Env>)=>void;onOpenBind:()=>void}){
  const sets=env.boundVarSets;

  const moveUp=(idx:number)=>{
    if(idx===0)return;
    const next=[...sets];
    [next[idx-1],next[idx]]=[next[idx],next[idx-1]];
    onChange({boundVarSets:next});
  };
  const moveDown=(idx:number)=>{
    if(idx===sets.length-1)return;
    const next=[...sets];
    [next[idx],next[idx+1]]=[next[idx+1],next[idx]];
    onChange({boundVarSets:next});
  };
  const unbind=(id:string)=>onChange({boundVarSets:sets.filter(v=>v.id!==id)});

  // Conflict detection: find variable names appearing in more than one bound set
  const nameSources:Record<string,string[]>={};
  sets.forEach(vs=>(vs.sampleVarNames??[]).forEach(n=>{
    if(!nameSources[n])nameSources[n]=[];
    nameSources[n].push(vs.id);
  }));
  const conflictNames=Object.keys(nameSources).filter(n=>nameSources[n].length>1);
  const hasConflicts=conflictNames.length>0;

  // For each set, which conflict names does it "win" (earliest in list) vs "lose"
  const setConflicts=(vsId:string,idx:number)=>{
    const wins:string[]=[]; const loses:string[]=[];
    conflictNames.forEach(n=>{
      const srcs=nameSources[n];
      if(!srcs.includes(vsId))return;
      const winnerIdx=Math.min(...srcs.map(id=>sets.findIndex(s=>s.id===id)));
      if(winnerIdx===idx)wins.push(n);
      else loses.push(n);
    });
    return{wins,loses};
  };

  return(
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold" style={{color:T.t1}}>已绑定变量集</p>
          <p className="text-[12px] mt-0.5" style={{color:T.t3}}>数字越小优先级越高；同名变量以排序靠前的变量集为准</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>{}} className="text-[12px] flex items-center gap-1" style={{color:T.primary,background:"none",border:"none",cursor:"pointer"}}><ExternalLink size={12}/>前往变量配置</button>
          <PBtn variant="ghost" icon={Plus} onClick={onOpenBind}>绑定变量集</PBtn>
        </div>
      </div>

      {sets.length===0?(
        <div className="flex flex-col items-center justify-center py-14 rounded-xl" style={{border:`1px dashed ${T.border}`,background:"#FAFAFA"}}>
          <Variable size={32} style={{color:T.t4}} className="mb-3"/>
          <p className="text-[13px] font-medium mb-1" style={{color:T.t2}}>尚未绑定变量集</p>
          <p className="text-[12px] mb-4" style={{color:T.t3}}>从变量配置页面创建变量集后，可在此绑定以供测试使用</p>
          <PBtn variant="ghost" icon={Plus} onClick={onOpenBind}>绑定变量集</PBtn>
        </div>
      ):(
        <div className="flex flex-col gap-2">
          {sets.map((vs,idx)=>{
            const{wins,loses}=setConflicts(vs.id,idx);
            const hasCnf=wins.length>0||loses.length>0;
            return(
              <div key={vs.id} className="rounded-xl bg-white overflow-hidden" style={{border:`1px solid ${hasCnf?T.warning+"60":T.border}`}}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Priority badge */}
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold" style={{background:idx===0?`${T.primary}12`:"#F2F3F5",color:idx===0?T.primary:T.t3}}>
                    {idx+1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[13px] font-medium" style={{color:T.t1}}>{vs.name}</span>
                      {idx===0&&sets.length>1&&<span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{background:`${T.primary}12`,color:T.primary}}>最高优先级</span>}
                      {vs.hasSensitive&&<span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"#FFF3E8",color:T.warning}}>含敏感变量</span>}
                      <span className="text-[11px] font-mono" style={{color:T.t4}}>{vs.version}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {vs.applicableTypes.map(t=>{const m=APPLY_META[t];return <span key={t} className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{background:m.bg,color:m.color}}><m.icon size={9}/>{m.label}</span>;})}
                      <span style={{color:T.t4,fontSize:11}}>·</span>
                      <span className="text-[11px]" style={{color:T.t3}}>{vs.varCount} 个变量</span>
                    </div>
                  </div>
                  {/* Move buttons */}
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button onClick={()=>moveUp(idx)} disabled={idx===0} className="w-6 h-6 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:idx===0?"not-allowed":"pointer",color:idx===0?T.t4:T.t2}} onMouseEnter={e=>{if(idx>0)e.currentTarget.style.backgroundColor="#F2F3F5";}} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}><ArrowUp size={12}/></button>
                    <button onClick={()=>moveDown(idx)} disabled={idx===sets.length-1} className="w-6 h-6 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:idx===sets.length-1?"not-allowed":"pointer",color:idx===sets.length-1?T.t4:T.t2}} onMouseEnter={e=>{if(idx<sets.length-1)e.currentTarget.style.backgroundColor="#F2F3F5";}} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}><ArrowDown size={12}/></button>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <IBtn icon={ExternalLink} label="查看变量集" onClick={()=>{}}/>
                    <IBtn icon={Minus} label="解除绑定" danger onClick={()=>unbind(vs.id)}/>
                  </div>
                </div>
                {/* Conflict detail row */}
                {hasCnf&&(
                  <div className="px-4 py-2.5 flex items-start gap-2" style={{borderTop:`1px solid ${T.warning}30`,background:`${T.warning}06`}}>
                    <AlertTriangle size={11} style={{color:T.warning,flexShrink:0,marginTop:2}}/>
                    <div className="text-[11px] flex flex-wrap gap-x-3 gap-y-1" style={{color:T.t2}}>
                      {wins.length>0&&<span><span style={{color:T.success,fontWeight:600}}>生效：</span>{wins.map(n=><code key={n} className="font-mono text-[10px] mx-0.5 px-1 py-0.5 rounded" style={{background:"#E8FFEA",color:T.success}}>{n}</code>)}</span>}
                      {loses.length>0&&<span><span style={{color:T.t4,fontWeight:600}}>被覆盖：</span>{loses.map(n=><code key={n} className="font-mono text-[10px] mx-0.5 px-1 py-0.5 rounded line-through" style={{background:"#F2F3F5",color:T.t4}}>{n}</code>)}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Conflict summary */}
      {hasConflicts&&(
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl" style={{background:"#FFF3E8",border:`1px solid ${T.warning}40`}}>
          <AlertTriangle size={13} style={{color:T.warning,flexShrink:0,marginTop:1}}/>
          <div className="text-[12px]" style={{color:T.t2}}>
            <strong style={{color:T.warning}}>检测到 {conflictNames.length} 个同名变量冲突：</strong>
            {conflictNames.map(n=><code key={n} className="font-mono text-[11px] mx-1 px-1.5 py-0.5 rounded" style={{background:"#FFE8CC",color:T.warning}}>{n}</code>)}
            <span className="ml-1">— 以排序靠前的变量集为准。可拖动顺序调整优先级。</span>
          </div>
        </div>
      )}

      {/* Priority rule hint */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl" style={{background:"#F0F5FF",border:`1px solid ${T.primary}25`}}>
        <Variable size={13} style={{color:T.primary,flexShrink:0,marginTop:1}}/>
        <p className="text-[12px]" style={{color:T.t2}}>
          变量优先级（从高到低）：<strong>环境局部覆盖</strong> → <strong>排序靠前的变量集</strong> → <strong>排序靠后的变量集</strong> → <strong>工作区全局变量</strong>
        </p>
      </div>
    </div>
  );
}

// ─── Left Panel Env Item ──────────────────────────────────────────────────────

function StatusDot({ok,label}:{ok:boolean;label:string}){
  return(
    <span className="inline-flex items-center gap-1 text-[10px]" style={{color:ok?T.success:T.t4}}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:ok?T.success:T.t4}}/>
      {label}
    </span>
  );
}

function EnvItem({env,active,onSelect,onDelete}:{env:Env;active:boolean;onSelect:()=>void;onDelete:()=>void}){
  const[hover,setHover]=useState(false);
  const stM=STAGE_META[env.stage];
  return(
    <div onClick={onSelect} onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{background:active?`${stM.color}0D`:hover?"#F7F8FB":"transparent",border:`1px solid ${active?stM.color+"40":T.border}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",marginBottom:6,transition:"all 0.15s"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
        <span style={{fontSize:13,fontWeight:600,color:active?stM.color:T.t1,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{env.name}</span>
        <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:99,background:stM.bg,color:stM.color,flexShrink:0}}>{stM.label}</span>
        {env.isProd&&<span style={{fontSize:10,fontWeight:600,padding:"2px 6px",borderRadius:99,background:"#FFE8E8",color:T.danger,flexShrink:0}}>生产</span>}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:5}}>
        <code style={{fontSize:11,color:T.t4}}>{env.identifier}</code>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <StatusDot ok={!!env.apiConfig?.baseUrl} label="API"/>
        <StatusDot ok={!!env.webUIConfig?.entryUrl} label="Web UI"/>
        <div style={{flex:1}}/>
        {!env.enabled&&<span style={{fontSize:10,color:T.t4}}>已停用</span>}
        {(hover||active)&&<button onClick={e=>{e.stopPropagation();onDelete();}} style={{background:"none",border:"none",cursor:"pointer",padding:2,color:T.t4,borderRadius:4}} onMouseEnter={e=>{e.currentTarget.style.color=T.danger;e.currentTarget.style.backgroundColor="#FFF0F0";}} onMouseLeave={e=>{e.currentTarget.style.color=T.t4;e.currentTarget.style.backgroundColor="transparent";}}><Trash2 size={12}/></button>}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type DetailTab="basic"|"api"|"webui"|"app"|"vars";

export function EnvConfigPage(){
  const[envs,setEnvs]=useState<Env[]>(INIT_ENVS);
  const[selId,setSelId]=useState<string>(INIT_ENVS[0].id);
  const[editing,setEditing]=useState<Env>({...INIT_ENVS[0],apiConfig:INIT_ENVS[0].apiConfig?{...INIT_ENVS[0].apiConfig,headers:[...INIT_ENVS[0].apiConfig.headers]}:null,boundVarSets:[...INIT_ENVS[0].boundVarSets]});
  const[tab,setTab]=useState<DetailTab>("basic");
  const[showCreate,setShowCreate]=useState(false);
  const[showDelete,setShowDelete]=useState(false);
  const[showProdConfirm,setShowProdConfirm]=useState(false);
  const[showBindVarSet,setShowBindVarSet]=useState(false);
  const[search,setSearch]=useState("");
  const[dirty,setDirty]=useState(false);
  const{items:toasts,show:showToast}=useToast();

  const filtered=envs.filter(e=>!search||e.name.toLowerCase().includes(search.toLowerCase())||e.identifier.toLowerCase().includes(search.toLowerCase()));

  const selectEnv=(env:Env)=>{
    setSelId(env.id);
    setEditing({...env,apiConfig:env.apiConfig?{...env.apiConfig,headers:[...env.apiConfig.headers]}:null,boundVarSets:[...env.boundVarSets]});
    setDirty(false);
    setTab("basic");
  };

  const patch=(p:Partial<Env>)=>{setEditing(prev=>({...prev,...p}));setDirty(true);};

  const doSave=()=>{
    setEnvs(p=>p.map(e=>e.id===editing.id?{...editing,updatedAt:"刚刚",updatedBy:"我"}:e));
    setDirty(false);
    showToast("环境配置已保存","success");
  };

  const handleSave=()=>{
    if(editing.isProd){setShowProdConfirm(true);}
    else doSave();
  };

  const DETAIL_TABS:[DetailTab,string][]=[
    ["basic","基础信息"],
    ["api","API"],
    ["webui","Web UI"],
    ["app","APP"],
    ["vars","变量绑定"],
  ];

  const sel=envs.find(e=>e.id===selId)||envs[0];

  return(
    <div className="flex flex-1 overflow-hidden" style={{background:T.bg}}>
      {/* Left env list */}
      <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:264,background:"#fff",borderRight:`1px solid ${T.border}`}}>
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold" style={{color:T.t1}}>环境列表</span>
            <PBtn icon={Plus} small onClick={()=>setShowCreate(true)}>新建</PBtn>
          </div>
          <Inp placeholder="搜索名称或标识符" prefix={<Search size={12}/>} width="100%" value={search} onChange={setSearch}/>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {filtered.length===0&&<p className="text-[12px] text-center py-8" style={{color:T.t3}}>未找到匹配环境</p>}
          {filtered.map(env=>(
            <EnvItem key={env.id} env={env} active={env.id===selId} onSelect={()=>selectEnv(env)} onDelete={()=>{setSelId(env.id);setShowDelete(true);}}/>
          ))}
        </div>
        <div className="px-4 py-3 flex-shrink-0" style={{borderTop:`1px solid ${T.border}`,background:"#FAFAFA"}}>
          <p className="text-[11px]" style={{color:T.t3}}>共 {envs.length} 个环境</p>
        </div>
      </div>

      {/* Right detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 bg-white" style={{borderBottom:`1px solid ${T.border}`}}>
          <div className="flex items-center gap-4 px-6 py-3.5">
            <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{background:STAGE_META[sel.stage].bg}}>
              <Globe size={18} style={{color:STAGE_META[sel.stage].color}}/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] font-bold" style={{color:T.t1}}>{editing.name}</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:STAGE_META[editing.stage].bg,color:STAGE_META[editing.stage].color}}>{STAGE_META[editing.stage].label}</span>
                {editing.isProd&&<span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:"#FFE8E8",color:T.danger}}>生产</span>}
                {!editing.enabled&&<span className="text-[10px] px-2 py-0.5 rounded-full" style={{background:"#F2F3F5",color:T.t4}}>已停用</span>}
                {dirty&&<span className="text-[11px] px-2 py-0.5 rounded-full" style={{background:"#FFF3E8",color:T.warning}}>未保存</span>}
              </div>
              <p className="text-[12px] mt-0.5" style={{color:T.t3}}><code className="font-mono" style={{color:T.t4}}>{editing.identifier}</code>{editing.description&&<>&nbsp;·&nbsp;{editing.description}</>}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <PBtn variant="ghost" icon={Copy} onClick={()=>{const ne:Env={...sel,id:"e_"+Date.now(),name:`副本 - ${sel.name}`,identifier:`${sel.identifier}-copy`,updatedAt:"刚刚",updatedBy:"我"};setEnvs(p=>[...p,ne]);selectEnv(ne);showToast("环境副本已创建","success");}}>复制</PBtn>
              <PBtn variant="ghost" icon={sel.enabled?Power:CheckCircle} onClick={()=>{const updated={...sel,enabled:!sel.enabled};setEnvs(p=>p.map(e=>e.id===sel.id?updated:e));setEditing(prev=>({...prev,enabled:!prev.enabled}));showToast(sel.enabled?"环境已停用":"环境已启用",sel.enabled?"warn":"success");}}>{sel.enabled?"停用":"启用"}</PBtn>
              <PBtn icon={CheckCircle} disabled={!dirty} onClick={handleSave}>保存配置</PBtn>
            </div>
          </div>
          <div className="flex px-6" style={{borderTop:`1px solid ${T.border}`}}>
            {DETAIL_TABS.map(([key,label])=>(
              <button key={key} onClick={()=>setTab(key)} className="h-10 px-4 text-[13px] font-medium border-b-2 transition-colors" style={{borderBottomColor:tab===key?T.primary:"transparent",color:tab===key?T.primary:T.t3,background:"none",cursor:"pointer"}}>
                {label}
                {key==="api"&&editing.apiConfig?.baseUrl&&<span className="ml-1.5 w-1.5 h-1.5 rounded-full inline-block" style={{background:T.success,verticalAlign:"middle"}}/>}
                {key==="webui"&&editing.webUIConfig?.entryUrl&&<span className="ml-1.5 w-1.5 h-1.5 rounded-full inline-block" style={{background:T.success,verticalAlign:"middle"}}/>}
                {key==="vars"&&editing.boundVarSets.length>0&&<span className="ml-1 text-[10px] px-1 rounded" style={{background:`${T.primary}15`,color:T.primary}}>{editing.boundVarSets.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab==="basic"&&<BasicInfoPanel env={editing} onChange={patch}/>}
          {tab==="api"&&<ApiConfigPanel env={editing} onChange={patch}/>}
          {tab==="webui"&&<WebUIPanel env={editing} onChange={patch}/>}
          {tab==="app"&&<AppPanel/>}
          {tab==="vars"&&<VarBindingPanel env={editing} onChange={p=>{patch(p);}} onOpenBind={()=>setShowBindVarSet(true)}/>}
        </div>

        {/* Footer save bar */}
        {dirty&&(
          <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 py-3" style={{borderTop:`1px solid ${T.border}`,background:"#FAFAFA"}}>
            <span className="text-[12px]" style={{color:T.t3}}>有未保存的修改</span>
            <PBtn variant="ghost" onClick={()=>{const orig=envs.find(e=>e.id===selId);if(orig)setEditing({...orig,apiConfig:orig.apiConfig?{...orig.apiConfig,headers:[...orig.apiConfig.headers]}:null,boundVarSets:[...orig.boundVarSets]});setDirty(false);}}>放弃修改</PBtn>
            <PBtn onClick={handleSave}>保存配置</PBtn>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate&&<CreateEnvModal onClose={()=>setShowCreate(false)} onCreate={e=>{setEnvs(p=>[...p,e]);selectEnv(e);showToast("环境已创建","success");}}/>}
      {showDelete&&sel&&<DeleteEnvConfirm env={sel} onClose={()=>setShowDelete(false)} onConfirm={()=>{const remaining=envs.filter(e=>e.id!==sel.id);setEnvs(remaining);if(remaining.length>0)selectEnv(remaining[0]);showToast("环境已删除","warn");}}/>}
      {showProdConfirm&&<ProdSaveConfirm envName={editing.name} onClose={()=>setShowProdConfirm(false)} onConfirm={doSave}/>}
      {showBindVarSet&&<BindVarSetModal bound={editing.boundVarSets} onClose={()=>setShowBindVarSet(false)} onBind={newSets=>{patch({boundVarSets:[...editing.boundVarSets,...newSets]});showToast(`已绑定 ${newSets.length} 个变量集`,"success");}}/>}
      <ToastList items={toasts}/>
    </div>
  );
}
