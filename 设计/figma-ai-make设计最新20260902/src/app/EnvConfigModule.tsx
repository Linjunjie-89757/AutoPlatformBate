import React,{useState,useEffect,useRef} from "react";
import {
  Link2,Monitor,Layers,Search,Plus,Edit2,Trash2,Eye,CheckCircle,XCircle,
  Activity,AlertTriangle,Globe,Server,Power,Copy,Minus,RefreshCw,Clock,
  Zap,Code2,Variable,ArrowUp,ArrowDown,ChevronRight,X,Timer,Wifi,WifiOff,
  Check,RotateCcw,Shield,
} from "lucide-react";

const T={primary:"#165DFF",success:"#00B42A",warning:"#FF7D00",danger:"#F53F3F",purple:"#7816FF",cyan:"#0FC6C2",slate:"#4E5969",bg:"#F4F6FA",border:"#E5E6EB",t1:"#1D2129",t2:"#4E5969",t3:"#86909C",t4:"#C9CDD4"};

function PBtn({children,onClick,icon:Icon,small,color=T.primary,variant="primary",disabled}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;variant?:"primary"|"ghost";disabled?:boolean}){
  if(variant==="ghost") return <button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium bg-white transition-colors" style={{borderColor:T.border,color:disabled?T.t4:T.t2,cursor:disabled?"not-allowed":"pointer"}} onMouseEnter={e=>{if(!disabled){e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.color=T.primary;}}} onMouseLeave={e=>{if(!disabled){e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.t2;}}}>{Icon&&<Icon size={13}/>}{children}</button>;
  return <button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-all active:scale-[0.98]" style={{backgroundColor:disabled?"#C9CDD4":color,color:"#fff",height:small?28:32,padding:small?"0 10px":"0 14px",fontSize:small?12:13,cursor:disabled?"not-allowed":"pointer"}} onMouseEnter={e=>{if(!disabled)e.currentTarget.style.filter="brightness(1.1)";}} onMouseLeave={e=>e.currentTarget.style.filter=""}>{Icon&&<Icon size={small?12:13}/>}{children}</button>;
}
function IBtn({icon:Icon,label,danger,onClick}:{icon:React.ElementType;label:string;danger?:boolean;onClick?:()=>void}){return <button title={label} onClick={e=>{e.stopPropagation();onClick?.();}} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{color:T.t4}} onMouseEnter={e=>{e.currentTarget.style.color=danger?T.danger:T.t1;e.currentTarget.style.backgroundColor=danger?"#FFF0F0":"#F2F3F5";}} onMouseLeave={e=>{e.currentTarget.style.color=T.t4;e.currentTarget.style.backgroundColor="transparent";}}><Icon size={13}/></button>;}
function Inp({placeholder,type="text",prefix,mono,width,value,onChange}:{placeholder?:string;type?:string;prefix?:React.ReactNode;mono?:boolean;width?:string|number;value?:string;onChange?:(v:string)=>void}){return <div className="relative flex items-center" style={{width}}>{prefix&&<span className="absolute left-2.5 pointer-events-none" style={{color:T.t3}}>{prefix}</span>}<input type={type} placeholder={placeholder} value={value} onChange={e=>onChange?.(e.target.value)} className={`h-8 border rounded-lg bg-white text-[13px] outline-none transition-all w-full ${prefix?"pl-8 pr-3":"px-3"} ${mono?"font-mono text-[12px]":""}`} style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.primary}18`;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/></div>;}
function Sel({children,width=130,value,onChange}:{children:React.ReactNode;width?:string|number;value?:string;onChange?:(v:string)=>void}){return <select value={value} onChange={e=>onChange?.(e.target.value)} className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width}}>{children}</select>;}
function Toggle({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}){return <button onClick={()=>onChange(!on)} className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0" style={{backgroundColor:on?T.primary:"#C9CDD4"}}><span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all" style={{left:on?"calc(100% - 14px)":"2px"}}/></button>;}
interface Col{label:string;width?:string;align?:"left"|"right"|"center"}
function ETable({cols,children,total}:{cols:Col[];children:React.ReactNode;total?:number}){const[page,setPage]=useState(1);const pages=total?Math.max(1,Math.ceil(total/10)):1;return <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}><table className="w-full border-collapse"><thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>{cols.map((c,i)=><th key={i} style={{width:c.width,textAlign:c.align??"left",color:T.t3}} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">{c.label}</th>)}</tr></thead><tbody>{children}</tbody></table>{total!==undefined&&<div className="flex items-center justify-between px-4 py-2.5" style={{borderTop:`1px solid ${T.border}`}}><span className="text-[12px]" style={{color:T.t3}}>共 {total} 条</span><div className="flex items-center gap-1">{Array.from({length:pages}).map((_,i)=><button key={i} onClick={()=>setPage(i+1)} className="w-7 h-7 rounded-md text-[12px] font-medium" style={{backgroundColor:page===i+1?T.primary:"transparent",color:page===i+1?"#fff":T.t2,border:`1px solid ${page===i+1?T.primary:T.border}`}}>{i+1}</button>)}</div></div>}</div>;}
function TR({children,active,onClick}:{children:React.ReactNode;active?:boolean;onClick?:()=>void}){return <tr onClick={onClick} className="border-b last:border-b-0 transition-colors" style={{borderColor:T.border,height:46,backgroundColor:active?`${T.primary}08`:"",cursor:onClick?"pointer":"default"}} onMouseEnter={e=>!active&&(e.currentTarget.style.backgroundColor="#FAFBFF")} onMouseLeave={e=>!active&&(e.currentTarget.style.backgroundColor="")}>{children}</tr>;}
function TD({children,align="left",mono,muted}:{children?:React.ReactNode;align?:"left"|"right"|"center";mono?:boolean;muted?:boolean}){return <td className={`px-4 py-2 text-[13px] ${mono?"font-mono text-[12px]":""}`} style={{textAlign:align,color:muted?T.t3:T.t1}}>{children}</td>;}

// ─── Types ────────────────────────────────────────────────────────────────────

type EnvStage="dev"|"test"|"staging"|"prod"|"sandbox";
type EnvApplicability="api"|"webui"|"both";
type SvcTestResult="success"|"failed"|"testing"|"untested";
type SvcTestStatus="idle"|"testing"|"success"|"failed"|"timeout";
interface SvcTestDetail{status:SvcTestStatus;testedAt:string|null;duration:number|null;failReason:string|null;}

interface TestEnv{id:string;name:string;stage:EnvStage;applicability:EnvApplicability;description:string;enabled:boolean;serviceCount:number;varSetCount:number;localVarCount:number;mockEnabled:boolean;mockApp:string|null;mockVersion:string|null;configComplete:boolean;configIssues:number;refTaskCount:number;updatedAt:string;updatedBy:string;}
interface EnvService{id:string;envId:string;name:string;baseUrl:string;isDefault:boolean;timeout:number;enabled:boolean;testResult:SvcTestResult;lastTestedAt:string|null;}
interface EnvVarSet{id:string;name:string;scope:string;varCount:number;hasSensitive:boolean;version:string;enabled:boolean;priority:number;}
interface EnvLocalVar{id:string;name:string;value:string;type:"string"|"integer"|"boolean"|"secret";sensitive:boolean;description:string;enabled:boolean;}
interface EnvMockBind{appId:string;appName:string;appCode:string;version:string;baseUrl:string;ifaceCount:number;sceneCount:number;unmatchedPolicy:string;authEnabled:boolean;enabled:boolean;}
interface EnvRef{id:string;type:"scenario"|"suite"|"webui"|"task";name:string;lastRun:string|null;running:boolean;}

// ─── Toast ───────────────────────────────────────────────────────────────────

type ToastItem={id:string;msg:string;type:"success"|"error"|"warn"};
function useToast(){
  const[items,setItems]=useState<ToastItem[]>([]);
  const show=(msg:string,type:ToastItem["type"]="success")=>{
    const id=Date.now().toString();
    setItems(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setItems(p=>p.filter(x=>x.id!==id)),3500);
  };
  return{items,show};
}
function ToastList({items}:{items:ToastItem[]}){
  if(!items.length)return null;
  return(<div style={{position:"fixed",bottom:24,right:24,zIndex:9999,display:"flex",flexDirection:"column",gap:8}}>
    {items.map(t=>{
      const c=t.type==="success"?{bg:"#E8FFEA",bd:T.success,ic:<CheckCircle size={14}/>,co:T.success}:t.type==="error"?{bg:"#FFE8E8",bd:T.danger,ic:<XCircle size={14}/>,co:T.danger}:{bg:"#FFF3E8",bd:T.warning,ic:<AlertTriangle size={14}/>,co:T.warning};
      return(<div key={t.id} style={{background:c.bg,border:`1px solid ${c.bd}`,borderRadius:12,padding:"10px 16px",display:"flex",alignItems:"center",gap:8,color:c.co,fontSize:13,fontWeight:500,minWidth:280,boxShadow:"0 4px 20px rgba(0,0,0,0.12)"}}>{c.ic}{t.msg}</div>);
    })}
  </div>);
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const STAGE_META:Record<EnvStage,{label:string;color:string;bg:string;shortColor:string}>={
  dev:{label:"开发",color:"#4E5969",bg:"#F2F3F5",shortColor:"#4E5969"},
  test:{label:"测试",color:T.primary,bg:"#E8F3FF",shortColor:T.primary},
  staging:{label:"预发布",color:T.purple,bg:"#F5E8FF",shortColor:T.purple},
  prod:{label:"生产",color:T.danger,bg:"#FFE8E8",shortColor:T.danger},
  sandbox:{label:"沙箱",color:T.cyan,bg:"#E8FFFE",shortColor:T.cyan},
};
const APPLY_META:Record<EnvApplicability,{label:string;icon:React.ElementType}>={
  api:{label:"接口自动化",icon:Link2},
  webui:{label:"Web UI 自动化",icon:Monitor},
  both:{label:"接口 + Web UI",icon:Layers},
};
const TEST_ENVS:TestEnv[]=[
  {id:"e1",name:"测试环境",stage:"test",applicability:"both",description:"QA 日常接口与 UI 回归测试，接入 Mock 和全部变量集",enabled:true,serviceCount:5,varSetCount:2,localVarCount:3,mockEnabled:true,mockApp:"订单中心 Mock",mockVersion:"v1.4.2",configComplete:true,configIssues:0,refTaskCount:8,updatedAt:"2026-07-29 09:15",updatedBy:"张程远"},
  {id:"e2",name:"预发布环境",stage:"staging",applicability:"api",description:"上线前 API 回归，Mock 设置为透传",enabled:true,serviceCount:5,varSetCount:2,localVarCount:1,mockEnabled:true,mockApp:"订单中心 Mock",mockVersion:"v1.4.2",configComplete:true,configIssues:0,refTaskCount:3,updatedAt:"2026-07-28 17:30",updatedBy:"王芳"},
  {id:"e3",name:"开发环境",stage:"dev",applicability:"api",description:"联调阶段，服务地址随迭代更新",enabled:true,serviceCount:3,varSetCount:1,localVarCount:5,mockEnabled:false,mockApp:null,mockVersion:null,configComplete:false,configIssues:2,refTaskCount:1,updatedAt:"2026-07-27 14:20",updatedBy:"陈伟"},
  {id:"e4",name:"沙箱环境",stage:"sandbox",applicability:"both",description:"独立沙箱，数据隔离，用于演示和培训",enabled:true,serviceCount:4,varSetCount:1,localVarCount:2,mockEnabled:true,mockApp:"支付网关 Mock",mockVersion:"v0.9.1",configComplete:true,configIssues:0,refTaskCount:0,updatedAt:"2026-07-25 11:00",updatedBy:"李明"},
  {id:"e5",name:"生产只读环境",stage:"prod",applicability:"api",description:"仅用于生产巡检，严格禁用 Mock，只读变量",enabled:false,serviceCount:4,varSetCount:1,localVarCount:0,mockEnabled:false,mockApp:null,mockVersion:null,configComplete:true,configIssues:0,refTaskCount:0,updatedAt:"2026-07-20 10:00",updatedBy:"张程远"},
];
const ENV_SERVICES:Record<string,EnvService[]>={
  e1:[
    {id:"s1",envId:"e1",name:"订单服务",baseUrl:"https://order-api.test.internal",isDefault:true,timeout:30000,enabled:true,testResult:"success",lastTestedAt:"2026-07-29 09:10"},
    {id:"s2",envId:"e1",name:"用户服务",baseUrl:"https://user-api.test.internal",isDefault:false,timeout:30000,enabled:true,testResult:"success",lastTestedAt:"2026-07-29 09:10"},
    {id:"s3",envId:"e1",name:"支付服务",baseUrl:"https://pay-api.test.internal",isDefault:false,timeout:15000,enabled:true,testResult:"failed",lastTestedAt:"2026-07-29 09:10"},
    {id:"s4",envId:"e1",name:"风控服务",baseUrl:"https://risk-api.test.internal",isDefault:false,timeout:10000,enabled:true,testResult:"untested",lastTestedAt:null},
    {id:"s5",envId:"e1",name:"Web 前端",baseUrl:"https://app.test.internal",isDefault:false,timeout:60000,enabled:true,testResult:"success",lastTestedAt:"2026-07-29 09:10"},
  ],
  e2:[
    {id:"s6",envId:"e2",name:"订单服务",baseUrl:"https://order-api.staging.internal",isDefault:true,timeout:30000,enabled:true,testResult:"success",lastTestedAt:"2026-07-28 17:00"},
    {id:"s7",envId:"e2",name:"用户服务",baseUrl:"https://user-api.staging.internal",isDefault:false,timeout:30000,enabled:true,testResult:"success",lastTestedAt:"2026-07-28 17:00"},
  ],
};
const ENV_VAR_SETS:Record<string,EnvVarSet[]>={
  e1:[
    {id:"vs1",name:"QA 公共变量集",scope:"全局",varCount:24,hasSensitive:true,version:"v3.2",enabled:true,priority:1},
    {id:"vs2",name:"订单模块变量集",scope:"订单中心",varCount:11,hasSensitive:false,version:"v1.0",enabled:true,priority:2},
  ],
};
const ENV_LOCAL_VARS:Record<string,EnvLocalVar[]>={
  e1:[
    {id:"lv1",name:"API_GATEWAY_URL",value:"https://gw.test.internal/v2",type:"string",sensitive:false,description:"测试环境覆盖网关地址",enabled:true},
    {id:"lv2",name:"TEST_ADMIN_TOKEN",value:"••••••••••••",type:"secret",sensitive:true,description:"测试专用管理员 Token",enabled:true},
    {id:"lv3",name:"PAGE_TIMEOUT",value:"45000",type:"integer",sensitive:false,description:"UI 测试页面超时（测试环境更长）",enabled:true},
  ],
};
const UNMATCHED_LABEL:Record<string,string>={"strict-fail":"严格失败","passthrough":"透传真实服务","empty":"返回空响应"};
const ENV_MOCK_BINDS:Record<string,EnvMockBind>={
  e1:{appId:"ma1",appName:"订单中心 Mock",appCode:"order-mock",version:"v1.4.2",baseUrl:"https://mock.test.internal/order-mock",ifaceCount:18,sceneCount:46,unmatchedPolicy:"strict-fail",authEnabled:true,enabled:true},
  e2:{appId:"ma1",appName:"订单中心 Mock",appCode:"order-mock",version:"v1.4.2",baseUrl:"https://mock.test.internal/order-mock",ifaceCount:18,sceneCount:46,unmatchedPolicy:"passthrough",authEnabled:true,enabled:true},
  e4:{appId:"ma3",appName:"支付网关 Mock",appCode:"payment-mock",version:"v0.9.1",baseUrl:"https://mock.test.internal/payment-mock",ifaceCount:7,sceneCount:19,unmatchedPolicy:"strict-fail",authEnabled:false,enabled:true},
};
const ENV_REFS:Record<string,EnvRef[]>={
  e1:[
    {id:"r1",type:"task",name:"订单回归 — 每日定时",lastRun:"2026-07-29 06:00",running:false},
    {id:"r2",type:"scenario",name:"产品管理-CRUD闭环",lastRun:"2026-07-28 18:30",running:false},
    {id:"r3",type:"suite",name:"订单中心-回归套件",lastRun:"2026-07-29 09:00",running:true},
    {id:"r4",type:"webui",name:"用户注册登录 UI 回归",lastRun:"2026-07-28 21:00",running:false},
    {id:"r5",type:"task",name:"UI 冒烟 — PR 触发",lastRun:"2026-07-29 08:45",running:false},
  ],
};
const SVC_TEST_META:Record<SvcTestResult,{label:string;color:string;icon:React.ElementType}>={
  success:{label:"连通",color:T.success,icon:CheckCircle},
  failed:{label:"失败",color:T.danger,icon:XCircle},
  testing:{label:"检测中",color:T.primary,icon:RefreshCw},
  untested:{label:"未检测",color:T.t4,icon:Clock},
};
const REF_TYPE_META:Record<string,{label:string;color:string;bg:string;icon:React.ElementType}>={
  scenario:{label:"接口场景",color:T.warning,bg:"#FFF3E8",icon:Zap},
  suite:{label:"接口套件",color:T.primary,bg:"#E8F3FF",icon:Layers},
  webui:{label:"Web UI",color:T.cyan,bg:"#E8FFFE",icon:Monitor},
  task:{label:"定时任务",color:T.purple,bg:"#F5E8FF",icon:Timer},
};

const AVAILABLE_VAR_SETS:EnvVarSet[]=[
  {id:"vs1",name:"QA 公共变量集",scope:"全局",varCount:24,hasSensitive:true,version:"v3.2",enabled:true,priority:1},
  {id:"vs2",name:"订单模块变量集",scope:"订单中心",varCount:11,hasSensitive:false,version:"v1.0",enabled:true,priority:2},
  {id:"vs3",name:"用户中心变量集",scope:"用户中心",varCount:8,hasSensitive:true,version:"v0.9",enabled:true,priority:3},
  {id:"vs4",name:"性能基线变量集",scope:"性能测试",varCount:6,hasSensitive:false,version:"v1.1",enabled:true,priority:4},
  {id:"vs5",name:"风控规则变量集",scope:"风控中心",varCount:14,hasSensitive:true,version:"v2.0",enabled:true,priority:5},
];
const AVAILABLE_MOCK_VERSIONS=["v1.4.3 (最新草稿)","v1.4.2 (当前)","v1.4.1","v1.4.0"];

// ─── Atoms ────────────────────────────────────────────────────────────────────

function EnvStageBadge({stage}:{stage:EnvStage}){
  const m=STAGE_META[stage];
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{background:m.bg,color:m.color}}>{m.label}</span>;
}
function EnvApplyBadge({apply}:{apply:EnvApplicability}){
  const m=APPLY_META[apply];const Icon=m.icon;
  return <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded" style={{background:"#F2F3F5",color:T.t2}}><Icon size={10}/>{m.label}</span>;
}
function ConfigCompleteness({complete,issues}:{complete:boolean;issues:number}){
  if(complete) return <span className="inline-flex items-center gap-1 text-[11px]" style={{color:T.success}}><CheckCircle size={12}/>配置完整</span>;
  return <span className="inline-flex items-center gap-1 text-[11px]" style={{color:T.warning}}><AlertTriangle size={12}/>{issues} 项待完善</span>;
}

function ModalWrap({children,width=500}:{children:React.ReactNode;width?:number}){
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:"rgba(29,33,41,0.5)"}}>
      <div className="flex flex-col rounded-2xl overflow-hidden" style={{width,background:"#fff",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",maxHeight:"90vh"}}>
        {children}
      </div>
    </div>
  );
}
function ModalHead({title,subtitle,onClose}:{title:string;subtitle?:string;onClose:()=>void}){
  return(
    <div className="flex items-start justify-between px-6 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
      <div><h2 className="text-[15px] font-semibold" style={{color:T.t1}}>{title}</h2>{subtitle&&<p className="text-[12px] mt-0.5" style={{color:T.t3}}>{subtitle}</p>}</div>
      <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0" style={{color:T.t4,background:"none",border:"none",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}><X size={16}/></button>
    </div>
  );
}
function ModalFoot({children}:{children:React.ReactNode}){return <div className="flex justify-end gap-2 px-6 py-4 flex-shrink-0" style={{borderTop:`1px solid ${T.border}`,background:"#FAFAFA"}}>{children}</div>;}
function FieldLabel({label,required}:{label:string;required?:boolean}){return <label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>{label}{required&&<span style={{color:T.danger}}> *</span>}</label>;}

// ─── Modals ───────────────────────────────────────────────────────────────────

function EditEnvModal({env,onClose,onSave}:{env:TestEnv;onClose:()=>void;onSave:(e:TestEnv)=>void}){
  const[name,setName]=useState(env.name);
  const[stage,setStage]=useState<EnvStage>(env.stage);
  const[apply,setApply]=useState<EnvApplicability>(env.applicability);
  const[desc,setDesc]=useState(env.description);
  return(
    <ModalWrap>
      <ModalHead title="编辑环境" onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
        <div><FieldLabel label="环境名称" required/><Inp placeholder="例：功能测试环境" width="100%" value={name} onChange={setName}/></div>
        <div><FieldLabel label="环境阶段"/>
          <div className="flex gap-2 flex-wrap">
            {(["dev","test","staging","prod","sandbox"] as EnvStage[]).map(s=>{const m=STAGE_META[s];const sel=stage===s;return(
              <button key={s} onClick={()=>setStage(s)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all" style={{border:`1.5px solid ${sel?m.color:T.border}`,background:sel?m.bg:"#fff",color:sel?m.color:T.t3,cursor:"pointer"}}>{m.label}</button>
            );})}
          </div>
        </div>
        <div><FieldLabel label="适用范围"/>
          <div className="flex gap-2">
            {(["api","webui","both"] as EnvApplicability[]).map(a=>{const m=APPLY_META[a];const Icon=m.icon;const sel=apply===a;return(
              <button key={a} onClick={()=>setApply(a)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all" style={{border:`1.5px solid ${sel?T.primary:T.border}`,background:sel?`${T.primary}08`:"#fff",color:sel?T.primary:T.t3,cursor:"pointer"}}><Icon size={12}/>{m.label}</button>
            );})}
          </div>
        </div>
        <div><FieldLabel label="描述"/><Inp placeholder="说明该环境的用途和范围" width="100%" value={desc} onChange={setDesc}/></div>
        {stage==="prod"&&<div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{background:"#FFE8E8",border:`1px solid #FBBBBB`}}><AlertTriangle size={14} style={{color:T.danger,flexShrink:0,marginTop:1}}/><p className="text-[12px]" style={{color:T.danger}}>生产阶段环境默认禁用 Mock，且禁止在此类环境中绑定 Mock 版本。</p></div>}
      </div>
      <ModalFoot><PBtn variant="ghost" onClick={onClose}>取消</PBtn><PBtn onClick={()=>{if(!name.trim())return;onSave({...env,name,stage,applicability:apply,description:desc,updatedAt:"刚刚",updatedBy:"我"});onClose();}}>保存</PBtn></ModalFoot>
    </ModalWrap>
  );
}

function CopyEnvModal({env,onClose,onCreate}:{env:TestEnv;onClose:()=>void;onCreate:(e:TestEnv)=>void}){
  const[name,setName]=useState(`副本 - ${env.name}`);
  return(
    <ModalWrap width={460}>
      <ModalHead title="复制环境" onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4">
        <div><FieldLabel label="新环境名称" required/><Inp placeholder="副本名称" width="100%" value={name} onChange={setName}/></div>
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{background:"#F0F5FF",border:`1px solid ${T.primary}25`}}>
          <AlertTriangle size={14} style={{color:T.primary,flexShrink:0,marginTop:1}}/>
          <p className="text-[12px]" style={{color:T.t2}}>复制后将创建独立环境，服务地址和变量集需重新配置</p>
        </div>
      </div>
      <ModalFoot>
        <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
        <PBtn onClick={()=>{if(!name.trim())return;const ne:TestEnv={...env,id:"e_copy_"+Date.now(),name,configComplete:false,configIssues:3,refTaskCount:0,updatedAt:"刚刚",updatedBy:"我"};onCreate(ne);onClose();}}>创建副本</PBtn>
      </ModalFoot>
    </ModalWrap>
  );
}

function DisableEnvModal({env,refs,onClose,onConfirm}:{env:TestEnv;refs:EnvRef[];onClose:()=>void;onConfirm:()=>void}){
  const running=refs.filter(r=>r.running);
  const hasRunning=running.length>0;
  return(
    <ModalWrap width={480}>
      <ModalHead title="停用环境" onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4">
        {hasRunning?(
          <div className="flex items-start gap-2 px-3 py-3 rounded-lg" style={{background:"#FFE8E8",border:`1px solid #FBBBBB`}}>
            <XCircle size={14} style={{color:T.danger,flexShrink:0,marginTop:1}}/>
            <div>
              <p className="text-[13px] font-semibold" style={{color:T.danger}}>存在运行中任务，无法停用</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {running.map(r=><li key={r.id} className="text-[12px]" style={{color:T.danger}}>• {r.name}</li>)}
              </ul>
            </div>
          </div>
        ):(
          <>
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{background:"#FFF3E8",border:`1px solid #FFD595`}}>
              <AlertTriangle size={14} style={{color:T.warning,flexShrink:0,marginTop:1}}/>
              <p className="text-[12px]" style={{color:T.t2}}>停用后以下 <strong>{refs.length}</strong> 个引用任务将无法使用此环境</p>
            </div>
            {refs.length>0&&<div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {refs.map(r=>{const m=REF_TYPE_META[r.type];const Icon=m.icon;return(<div key={r.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{background:"#FAFAFA",border:`1px solid ${T.border}`}}><Icon size={13} style={{color:m.color}}/><span className="text-[13px]" style={{color:T.t1}}>{r.name}</span><span className="ml-auto text-[11px] px-1.5 py-0.5 rounded" style={{background:m.bg,color:m.color}}>{m.label}</span></div>);})}
            </div>}
          </>
        )}
      </div>
      <ModalFoot>
        <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
        <PBtn disabled={hasRunning} onClick={()=>{if(hasRunning)return;onConfirm();onClose();}} color={T.warning}>{hasRunning?"存在运行中任务，无法停用":"确认停用"}</PBtn>
      </ModalFoot>
    </ModalWrap>
  );
}

function AddEditServiceModal({mode,initial,onClose,onSave}:{mode:"add"|"edit";initial?:EnvService;onClose:()=>void;onSave:(s:EnvService)=>void}){
  const[name,setName]=useState(initial?.name??"");
  const[baseUrl,setBaseUrl]=useState(initial?.baseUrl??"");
  const[timeout,setTimeout2]=useState(String(initial?.timeout??30000));
  const[isDefault,setIsDefault]=useState(initial?.isDefault??false);
  const[enabled,setEnabled]=useState(initial?.enabled??true);
  const[testStatus,setTestStatus]=useState<"idle"|"testing"|"ok"|"fail">("idle");
  const runQuickTest=async()=>{
    setTestStatus("testing");
    await new Promise(r=>setTimeout2(v=>{setTimeout(r,1200);return v;}));
    await new Promise(r=>setTimeout(r,1200));
    setTestStatus(Math.random()>0.4?"ok":"fail");
  };
  return(
    <ModalWrap width={520}>
      <ModalHead title={mode==="add"?"添加服务":"编辑服务"} onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
        <div><FieldLabel label="服务名称" required/><Inp placeholder="例：订单服务" width="100%" value={name} onChange={setName}/></div>
        <div>
          <FieldLabel label="Base URL" required/>
          <div className="flex gap-2">
            <div className="flex-1"><Inp placeholder="https://api.example.com" mono width="100%" value={baseUrl} onChange={setBaseUrl}/></div>
            <button onClick={runQuickTest} className="inline-flex items-center gap-1 text-[12px] px-3 h-8 rounded-lg border transition-colors flex-shrink-0" style={{borderColor:T.border,color:T.t2,background:"#fff",cursor:"pointer"}}>
              {testStatus==="testing"?<><RefreshCw size={12} className="animate-spin"/>测试中</>:testStatus==="ok"?<><CheckCircle size={12} style={{color:T.success}}/>连通</>:testStatus==="fail"?<><XCircle size={12} style={{color:T.danger}}/>失败</>:<><Activity size={12}/>连接测试</>}
            </button>
          </div>
          {testStatus==="fail"&&<p className="text-[12px] mt-1" style={{color:T.danger}}>连接失败，请检查地址是否正确</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><FieldLabel label="连接超时 (ms)"/><Inp value={timeout} onChange={setTimeout2} width="100%"/></div>
          <div className="flex items-end gap-3 pb-0.5"><label className="text-[12px] font-medium" style={{color:T.t2}}>设为默认入口</label><Toggle on={isDefault} onChange={setIsDefault}/></div>
        </div>
        <div className="flex items-center justify-between py-2.5 px-3 rounded-lg" style={{background:"#FAFAFA",border:`1px solid ${T.border}`}}>
          <div><p className="text-[13px] font-medium" style={{color:T.t1}}>是否启用</p><p className="text-[11px] mt-0.5" style={{color:T.t3}}>停用后此服务地址不参与执行</p></div>
          <Toggle on={enabled} onChange={setEnabled}/>
        </div>
      </div>
      <ModalFoot>
        <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
        <PBtn onClick={()=>{if(!name.trim()||!baseUrl.trim())return;const s:EnvService={id:initial?.id??"svc_"+Date.now(),envId:initial?.envId??"",name,baseUrl,isDefault,timeout:Number(timeout)||30000,enabled,testResult:"untested",lastTestedAt:null};onSave(s);onClose();}}>保存</PBtn>
      </ModalFoot>
    </ModalWrap>
  );
}

function BindVarSetModal({boundIds,onClose,onBind}:{boundIds:string[];onClose:()=>void;onBind:(sets:EnvVarSet[])=>void}){
  const available=AVAILABLE_VAR_SETS.filter(v=>!boundIds.includes(v.id));
  const[selected,setSelected]=useState<string[]>([]);
  const toggle=(id:string)=>setSelected(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  return(
    <ModalWrap width={480}>
      <ModalHead title="绑定变量集" subtitle={`已绑定 ${boundIds.length} 个，可绑定 ${available.length} 个`} onClose={onClose}/>
      <div className="px-6 py-4 flex-1 overflow-y-auto flex flex-col gap-2">
        {available.length===0?<p className="text-[13px] py-6 text-center" style={{color:T.t3}}>暂无可绑定的变量集</p>:available.map(vs=>{
          const sel=selected.includes(vs.id);
          return(<div key={vs.id} onClick={()=>toggle(vs.id)} className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all" style={{border:`1.5px solid ${sel?T.primary:T.border}`,background:sel?`${T.primary}06`:"#fff"}}>
            <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0" style={{background:sel?T.primary:T.border}}>{sel&&<Check size={10} color="#fff"/>}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5"><span className="text-[13px] font-medium" style={{color:T.t1}}>{vs.name}</span><span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"#F2F3F5",color:T.t3}}>{vs.scope}</span>{vs.hasSensitive&&<span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"#FFF3E8",color:T.warning}}>含敏感变量</span>}</div>
              <div className="flex items-center gap-2 text-[12px]"><span style={{color:T.t3}}>{vs.varCount} 个变量</span><span style={{color:T.t4}}>·</span><span className="font-mono" style={{color:T.t4}}>{vs.version}</span></div>
            </div>
          </div>);
        })}
      </div>
      <ModalFoot>
        <span className="mr-auto text-[12px]" style={{color:T.t3}}>已选 {selected.length} 个</span>
        <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
        <PBtn disabled={selected.length===0} onClick={()=>{onBind(AVAILABLE_VAR_SETS.filter(v=>selected.includes(v.id)));onClose();}}>确认绑定</PBtn>
      </ModalFoot>
    </ModalWrap>
  );
}

function VarSetPriorityModal({sets,onClose,onSave}:{sets:EnvVarSet[];onClose:()=>void;onSave:(sets:EnvVarSet[])=>void}){
  const[ordered,setOrdered]=useState<EnvVarSet[]>([...sets]);
  const move=(i:number,dir:-1|1)=>{
    const n=[...ordered];const j=i+dir;
    if(j<0||j>=n.length)return;
    [n[i],n[j]]=[n[j],n[i]];
    setOrdered(n.map((s,idx)=>({...s,priority:idx+1})));
  };
  const CONFLICTS=[
    {key:"API_GATEWAY_URL",sets:["QA 公共变量集","订单模块变量集"]},
    {key:"DB_TIMEOUT",sets:["QA 公共变量集","订单模块变量集"]},
  ];
  return(
    <ModalWrap width={620}>
      <ModalHead title="调整优先级" subtitle="数字越小优先级越高，同名变量将以高优先级变量集为准" onClose={onClose}/>
      <div className="px-6 py-4 flex-1 overflow-y-auto flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>当前顺序（可调整）</p>
            <div className="flex flex-col gap-2">
              {ordered.map((vs,i)=>(
                <div key={vs.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white" style={{border:`1px solid ${T.border}`}}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{background:`${T.primary}15`,color:T.primary}}>{i+1}</div>
                  <div className="flex-1 min-w-0"><p className="text-[13px] font-medium truncate" style={{color:T.t1}}>{vs.name}</p><p className="text-[11px]" style={{color:T.t3}}>{vs.varCount} 变量 · {vs.version}</p></div>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={()=>move(i,-1)} disabled={i===0} className="w-5 h-5 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:i===0?"not-allowed":"pointer",color:i===0?T.t4:T.t2}}><ArrowUp size={12}/></button>
                    <button onClick={()=>move(i,1)} disabled={i===ordered.length-1} className="w-5 h-5 flex items-center justify-center rounded" style={{background:"none",border:"none",cursor:i===ordered.length-1?"not-allowed":"pointer",color:i===ordered.length-1?T.t4:T.t2}}><ArrowDown size={12}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>调整后预览</p>
            <div className="flex flex-col gap-2">
              {ordered.map((vs,i)=>(
                <div key={vs.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{border:`1px solid ${T.border}`,background:"#FAFAFA"}}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{background:`${T.primary}15`,color:T.primary}}>{i+1}</div>
                  <p className="text-[13px] font-medium truncate" style={{color:T.t1}}>{vs.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.warning}40`}}>
          <div className="px-4 py-2.5" style={{background:"#FFF3E8",borderBottom:`1px solid ${T.warning}30`}}>
            <p className="text-[12px] font-semibold" style={{color:T.warning}}>以下变量存在同名冲突，高优先级将覆盖低优先级</p>
          </div>
          <div className="px-4 py-3 flex flex-col gap-2 bg-white">
            {CONFLICTS.map(c=>(
              <div key={c.key} className="flex items-center gap-2 text-[12px]">
                <code className="font-mono font-semibold" style={{color:T.t1}}>{c.key}</code>
                <span style={{color:T.t3}}>存在于</span>
                {c.sets.map((s,i)=><React.Fragment key={s}><span style={{color:T.t2}}>{s}</span>{i<c.sets.length-1&&<span style={{color:T.t4}}>和</span>}</React.Fragment>)}
                <span style={{color:T.t3}}>，以</span>
                <span className="font-semibold" style={{color:T.primary}}>{ordered[0]?.name}</span>
                <span style={{color:T.t3}}>为准</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ModalFoot><PBtn variant="ghost" onClick={onClose}>取消</PBtn><PBtn onClick={()=>{onSave(ordered);onClose();}}>保存优先级</PBtn></ModalFoot>
    </ModalWrap>
  );
}

function LocalVarModal({mode,initial,onClose,onSave}:{mode:"add"|"edit";initial?:EnvLocalVar;onClose:()=>void;onSave:(v:EnvLocalVar)=>void}){
  const[name,setName]=useState(initial?.name??"");
  const[value,setValue]=useState(initial?.sensitive?"":(initial?.value??""));
  const[type,setType]=useState<EnvLocalVar["type"]>(initial?.type??"string");
  const[sensitive,setSensitive]=useState(initial?.sensitive??false);
  const[desc,setDesc]=useState(initial?.description??"");
  const[enabled,setEnabled]=useState(initial?.enabled??true);
  return(
    <ModalWrap width={500}>
      <ModalHead title={mode==="add"?"添加局部变量":"编辑局部变量"} onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
        <div><FieldLabel label="变量名" required/><Inp placeholder="例：API_GATEWAY_URL" mono width="100%" value={name} onChange={setName}/></div>
        <div><FieldLabel label="值"/><Inp placeholder={type==="secret"?"输入后将加密存储":""} type={type==="secret"?"password":"text"} width="100%" value={value} onChange={setValue}/></div>
        <div className="grid grid-cols-2 gap-4">
          <div><FieldLabel label="类型"/>
            <Sel value={type} onChange={v=>setType(v as EnvLocalVar["type"])} width="100%">
              <option value="string">string</option>
              <option value="integer">integer</option>
              <option value="boolean">boolean</option>
              <option value="secret">secret</option>
            </Sel>
          </div>
          <div className="flex items-end gap-3 pb-0.5"><label className="text-[12px] font-medium" style={{color:T.t2}}>敏感变量</label><Toggle on={sensitive} onChange={setSensitive}/></div>
        </div>
        <div><FieldLabel label="说明"/><Inp placeholder="简要描述此变量的用途" width="100%" value={desc} onChange={setDesc}/></div>
        <div className="flex items-center justify-between py-2.5 px-3 rounded-lg" style={{background:"#FAFAFA",border:`1px solid ${T.border}`}}>
          <p className="text-[13px] font-medium" style={{color:T.t1}}>是否启用</p>
          <Toggle on={enabled} onChange={setEnabled}/>
        </div>
      </div>
      <ModalFoot>
        <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
        <PBtn onClick={()=>{if(!name.trim())return;const v:EnvLocalVar={id:initial?.id??"lv_"+Date.now(),name,value:type==="secret"?(value?"••••••••":initial?.value??""):value,type,sensitive,description:desc,enabled};onSave(v);onClose();}}>保存</PBtn>
      </ModalFoot>
    </ModalWrap>
  );
}

function DeleteLocalVarConfirm({v,onClose,onConfirm}:{v:EnvLocalVar;onClose:()=>void;onConfirm:()=>void}){
  return(
    <ModalWrap width={420}>
      <ModalHead title="删除局部变量" onClose={onClose}/>
      <div className="px-6 py-5">
        <p className="text-[13px]" style={{color:T.t2}}>确认删除变量「<strong>{v.name}</strong>」？此操作不可恢复。</p>
      </div>
      <ModalFoot><PBtn variant="ghost" onClick={onClose}>取消</PBtn><PBtn onClick={()=>{onConfirm();onClose();}} color={T.danger}>确认删除</PBtn></ModalFoot>
    </ModalWrap>
  );
}

function MockVersionSwitchModal({bind,onClose,onSwitch}:{bind:EnvMockBind;onClose:()=>void;onSwitch:(version:string)=>void}){
  const options=AVAILABLE_MOCK_VERSIONS.filter(v=>!v.includes(bind.version.split(" ")[0]));
  const[sel,setSel]=useState(options[0]??"");
  return(
    <ModalWrap width={500}>
      <ModalHead title="切换 Mock 版本" onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{background:"#FAFAFA",border:`1px solid ${T.border}`}}>
          <span className="text-[12px]" style={{color:T.t3}}>当前版本：</span>
          <span className="font-mono font-semibold text-[13px]" style={{color:T.success}}>{bind.version}</span>
        </div>
        <div className="flex flex-col gap-2">
          {AVAILABLE_MOCK_VERSIONS.map(v=>{
            const isCurrent=v.includes(bind.version.split(" ")[0]);
            return(
              <div key={v} onClick={()=>!isCurrent&&setSel(v)} className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all" style={{border:`1.5px solid ${sel===v&&!isCurrent?T.primary:T.border}`,background:sel===v&&!isCurrent?`${T.primary}06`:isCurrent?"#FAFAFA":"#fff",cursor:isCurrent?"default":"pointer",opacity:isCurrent?0.6:1}}>
                <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{background:sel===v&&!isCurrent?T.primary:T.border}}>{sel===v&&!isCurrent&&<span className="w-1.5 h-1.5 bg-white rounded-full block"/>}</div>
                <span className="text-[13px] font-mono" style={{color:T.t1}}>{v}</span>
                {isCurrent&&<span className="ml-auto text-[11px] px-1.5 py-0.5 rounded" style={{background:"#E8F3FF",color:T.primary}}>当前</span>}
              </div>
            );
          })}
        </div>
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{background:"#FFF3E8",border:`1px solid ${T.warning}40`}}>
          <AlertTriangle size={14} style={{color:T.warning,flexShrink:0,marginTop:1}}/>
          <div>
            <p className="text-[12px]" style={{color:T.t2}}>版本切换将立即生效，当前正在运行的测试任务会在下次调用时使用新版本</p>
            <p className="text-[12px] mt-1" style={{color:T.t3}}>v1.4.3 相较 v1.4.2 新增 2 个接口场景，移除 1 个废弃接口</p>
          </div>
        </div>
      </div>
      <ModalFoot><PBtn variant="ghost" onClick={onClose}>取消</PBtn><PBtn disabled={!sel} onClick={()=>{if(sel){onSwitch(sel);onClose();}}}>确认切换</PBtn></ModalFoot>
    </ModalWrap>
  );
}

function MockUnbindConfirm({bind,onClose,onConfirm}:{bind:EnvMockBind;onClose:()=>void;onConfirm:()=>void}){
  return(
    <ModalWrap width={460}>
      <ModalHead title="解除 Mock 绑定" onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4">
        <p className="text-[13px]" style={{color:T.t2}}>解除后，测试请求将直接发送到真实服务，不再经过 Mock 拦截</p>
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{background:"#FFE8E8",border:`1px solid #FBBBBB`}}>
          <AlertTriangle size={14} style={{color:T.danger,flexShrink:0,marginTop:1}}/>
          <p className="text-[12px]" style={{color:T.danger}}>当前有 3 个测试任务引用此环境的 Mock 配置，解除后这些任务需要重新配置</p>
        </div>
        <div className="px-3 py-2.5 rounded-lg" style={{background:"#FAFAFA",border:`1px solid ${T.border}`}}>
          <p className="text-[12px]" style={{color:T.t3}}>即将解除：<span className="font-semibold" style={{color:T.t1}}>{bind.appName}</span> · <span className="font-mono">{bind.version}</span></p>
        </div>
      </div>
      <ModalFoot><PBtn variant="ghost" onClick={onClose}>取消</PBtn><PBtn onClick={()=>{onConfirm();onClose();}} color={T.danger}>确认解除绑定</PBtn></ModalFoot>
    </ModalWrap>
  );
}

function CreateEnvModal({onClose,onCreate}:{onClose:()=>void;onCreate:(e:TestEnv)=>void}){
  const[name,setName]=useState("");
  const[stage,setStage]=useState<EnvStage>("test");
  const[apply,setApply]=useState<EnvApplicability>("both");
  const[desc,setDesc]=useState("");
  return(
    <ModalWrap>
      <ModalHead title="新建环境" subtitle="先创建环境，再配置服务地址、变量和 Mock" onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
        <div><FieldLabel label="环境名称" required/><Inp placeholder="例：功能测试环境、性能测试环境" width="100%" value={name} onChange={setName}/></div>
        <div><FieldLabel label="环境阶段"/>
          <div className="flex gap-2 flex-wrap">
            {(["dev","test","staging","prod","sandbox"] as EnvStage[]).map(s=>{const m=STAGE_META[s];const sel=stage===s;return(
              <button key={s} onClick={()=>setStage(s)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all" style={{border:`1.5px solid ${sel?m.color:T.border}`,background:sel?m.bg:"#fff",color:sel?m.color:T.t3,cursor:"pointer"}}>{m.label}</button>
            );})}
          </div>
        </div>
        <div><FieldLabel label="适用范围"/>
          <div className="flex gap-2">
            {(["api","webui","both"] as EnvApplicability[]).map(a=>{const m=APPLY_META[a];const Icon=m.icon;const sel=apply===a;return(
              <button key={a} onClick={()=>setApply(a)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-medium transition-all" style={{border:`1.5px solid ${sel?T.primary:T.border}`,background:sel?`${T.primary}08`:"#fff",color:sel?T.primary:T.t3,cursor:"pointer"}}><Icon size={12}/>{m.label}</button>
            );})}
          </div>
        </div>
        <div><FieldLabel label="描述"/><Inp placeholder="说明该环境的用途和范围" width="100%" value={desc} onChange={setDesc}/></div>
        {stage==="prod"&&<div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{background:"#FFE8E8",border:`1px solid #FBBBBB`}}><AlertTriangle size={14} style={{color:T.danger,flexShrink:0,marginTop:1}}/><p className="text-[12px]" style={{color:T.danger}}>生产阶段环境默认禁用 Mock，且禁止在此类环境中绑定 Mock 版本，以防止生产请求被拦截。</p></div>}
      </div>
      <ModalFoot>
        <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
        <PBtn onClick={()=>{if(!name.trim())return;const ne:TestEnv={id:"e_new_"+Date.now(),name,stage,applicability:apply,description:desc,enabled:true,serviceCount:0,varSetCount:0,localVarCount:0,mockEnabled:false,mockApp:null,mockVersion:null,configComplete:false,configIssues:3,refTaskCount:0,updatedAt:"刚刚",updatedBy:"我"};onCreate(ne);onClose();}}>创建环境</PBtn>
      </ModalFoot>
    </ModalWrap>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function EnvConfigPage(){
  const[envs,setEnvs]=useState<TestEnv[]>(TEST_ENVS);
  const[sel,setSel]=useState<TestEnv>(TEST_ENVS[0]);
  const[innerTab,setInnerTab]=useState<"services"|"variables"|"mock"|"effective"|"refs">("services");
  const[showCreate,setShowCreate]=useState(false);
  const[showEdit,setShowEdit]=useState(false);
  const[showCopy,setShowCopy]=useState(false);
  const[showDisable,setShowDisable]=useState(false);
  const[showDeleteConfirm,setShowDeleteConfirm]=useState(false);
  const[showBindVarSet,setShowBindVarSet]=useState(false);
  const[showPriority,setShowPriority]=useState(false);
  const[localVarForm,setLocalVarForm]=useState<"add"|EnvLocalVar|null>(null);
  const[deleteVar,setDeleteVar]=useState<EnvLocalVar|null>(null);
  const[showMockSwitch,setShowMockSwitch]=useState(false);
  const[showMockUnbind,setShowMockUnbind]=useState(false);
  const[svcModal,setSvcModal]=useState<"add"|EnvService|null>(null);
  const[svcTests,setSvcTests]=useState<Record<string,SvcTestDetail>>({});
  const[batchTesting,setBatchTesting]=useState(false);
  const[varSetsState,setVarSetsState]=useState<Record<string,EnvVarSet[]>>(ENV_VAR_SETS);
  const[localVarsState,setLocalVarsState]=useState<Record<string,EnvLocalVar[]>>(ENV_LOCAL_VARS);
  const[mockBindsState,setMockBindsState]=useState<Record<string,EnvMockBind|undefined>>({...ENV_MOCK_BINDS} as Record<string,EnvMockBind|undefined>);
  const[servicesState,setServicesState]=useState<Record<string,EnvService[]>>(ENV_SERVICES);
  const[envSearch,setEnvSearch]=useState("");
  const{items:toasts,show:showToast}=useToast();

  const filteredEnvs=envs.filter(e=>!envSearch||e.name.toLowerCase().includes(envSearch.toLowerCase()));
  const services=servicesState[sel.id]??[];
  const varSets=varSetsState[sel.id]??[];
  const localVars=localVarsState[sel.id]??[];
  const mockBind=mockBindsState[sel.id]??null;
  const refs=ENV_REFS[sel.id]??[];
  const hasRunning=refs.some(r=>r.running);
  const stM=STAGE_META[sel.stage];

  const simulateTest=(svcId:string):Promise<SvcTestDetail>=>{
    return new Promise(res=>{
      const rand=Math.random();
      const duration=Math.floor(Math.random()*400+80);
      const now=new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
      if(rand<0.6) res({status:"success",testedAt:now,duration,failReason:null});
      else if(rand<0.8) res({status:"failed",testedAt:now,duration:null,failReason:"Connection refused: ECONNREFUSED"});
      else res({status:"timeout",testedAt:now,duration:null,failReason:"Request timeout after 10000ms"});
    });
  };

  const runTest=async(svcId:string)=>{
    setSvcTests(p=>({...p,[svcId]:{status:"testing",testedAt:null,duration:null,failReason:null}}));
    await new Promise(r=>setTimeout(r,1500));
    const result=await simulateTest(svcId);
    setSvcTests(p=>({...p,[svcId]:result}));
    if(result.status==="success") showToast(`服务连接成功 (${result.duration}ms)`,"success");
    else showToast(result.status==="timeout"?"连接超时":"连接失败，请检查地址","error");
  };

  const batchTest=async()=>{
    const svcs=services;
    setBatchTesting(true);
    for(const svc of svcs){
      setSvcTests(p=>({...p,[svc.id]:{status:"testing",testedAt:null,duration:null,failReason:null}}));
      await new Promise(r=>setTimeout(r,800));
      const result=await simulateTest(svc.id);
      setSvcTests(p=>({...p,[svc.id]:result}));
    }
    setBatchTesting(false);
    showToast("批量连接测试完成","success");
  };

  const updateSel=(updated:TestEnv)=>{
    setEnvs(p=>p.map(e=>e.id===updated.id?updated:e));
    setSel(updated);
  };

  const INNER_TABS=[
    {key:"services" as const,label:`服务配置 (${sel.serviceCount})`},
    {key:"variables" as const,label:`变量配置 (${sel.varSetCount+sel.localVarCount})`},
    {key:"mock" as const,label:sel.mockEnabled?"Mock 已启用":"Mock 配置"},
    {key:"effective" as const,label:"最终生效预览"},
    {key:"refs" as const,label:`引用分析 (${sel.refTaskCount})`},
  ];

  // Render svc test status
  const renderSvcStatus=(svc:EnvService)=>{
    const ts=svcTests[svc.id];
    if(!ts||ts.status==="idle"){
      const tm=SVC_TEST_META[svc.testResult];const TIcon=tm.icon;
      return(<span className="inline-flex items-center gap-1.5 text-[12px]"><TIcon size={13} style={{color:tm.color}}/><span style={{color:tm.color}}>{tm.label}</span>{svc.lastTestedAt&&<span className="text-[11px]" style={{color:T.t4}}>{svc.lastTestedAt}</span>}</span>);
    }
    if(ts.status==="testing") return <span className="inline-flex items-center gap-1.5 text-[12px]"><RefreshCw size={13} className="animate-spin" style={{color:T.primary}}/><span style={{color:T.primary}}>测试中...</span></span>;
    if(ts.status==="success") return <span className="inline-flex items-center gap-1.5 text-[12px]"><CheckCircle size={13} style={{color:T.success}}/><span style={{color:T.success}}>连通</span><span style={{color:T.t4}}>{ts.duration}ms</span>{ts.testedAt&&<span style={{color:T.t4}}>{ts.testedAt}</span>}</span>;
    if(ts.status==="failed") return <span className="inline-flex items-center gap-1.5 text-[12px]" title={ts.failReason??""}><XCircle size={13} style={{color:T.danger}}/><span style={{color:T.danger}}>失败</span>{ts.testedAt&&<span style={{color:T.t4}}>{ts.testedAt}</span>}</span>;
    if(ts.status==="timeout") return <span className="inline-flex items-center gap-1.5 text-[12px]"><Clock size={13} style={{color:T.warning}}/><span style={{color:T.warning}}>超时</span>{ts.testedAt&&<span style={{color:T.t4}}>{ts.testedAt}</span>}</span>;
    return null;
  };

  return(
    <div className="flex flex-1 overflow-hidden" style={{background:T.bg}}>
      {/* Left env list */}
      <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:260,background:"#fff",borderRight:`1px solid ${T.border}`}}>
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[13px] font-semibold" style={{color:T.t1}}>测试环境</span>
            <PBtn icon={Plus} small onClick={()=>setShowCreate(true)}>新建</PBtn>
          </div>
          <Inp placeholder="搜索环境名称" prefix={<Search size={12}/>} width="100%" value={envSearch} onChange={setEnvSearch}/>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {filteredEnvs.map(env=>{
            const m=STAGE_META[env.stage];const active=env.id===sel.id;
            return(
              <button key={env.id} onClick={()=>{setSel(env);setInnerTab("services");}}
                className="w-full text-left rounded-xl px-3 py-2.5 mb-1.5 transition-all"
                style={{background:active?`${m.shortColor}0D`:"transparent",border:`1px solid ${active?m.shortColor+"40":T.border}`,cursor:"pointer"}}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1 h-8 rounded-full flex-shrink-0" style={{background:m.color}}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[13px] font-semibold truncate" style={{color:active?m.color:T.t1}}>{env.name}</span>
                      {!env.enabled&&<span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"#F2F3F5",color:T.t4}}>停用</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{background:m.bg,color:m.color}}>{m.label}</span>
                      <span className="text-[10px]" style={{color:T.t4}}>{env.serviceCount} 服务 · {env.varSetCount} 变量集</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pl-3">
                  <ConfigCompleteness complete={env.configComplete} issues={env.configIssues}/>
                  {env.mockEnabled&&<span className="text-[10px]" style={{color:T.cyan}}>Mock 已接入</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 bg-white" style={{borderBottom:`1px solid ${T.border}`}}>
          <div className="flex items-start gap-4 px-6 py-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{background:stM.bg}}>
              <Globe size={20} style={{color:stM.color}}/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                <h2 className="text-[16px] font-bold" style={{color:T.t1}}>{sel.name}</h2>
                <EnvStageBadge stage={sel.stage}/>
                <EnvApplyBadge apply={sel.applicability}/>
                {!sel.enabled&&<span className="text-[11px] px-2 py-0.5 rounded-full" style={{background:"#F2F3F5",color:T.t4}}>已停用</span>}
              </div>
              <div className="flex items-center gap-3 text-[12px] flex-wrap">
                {sel.description&&<span style={{color:T.t3}}>{sel.description}</span>}
                {sel.description&&<span style={{color:T.t4}}>·</span>}
                <span style={{color:T.t3}}>更新人：{sel.updatedBy}</span>
                <span style={{color:T.t4}}>·</span>
                <span style={{color:T.t3}}>{sel.updatedAt}</span>
                {!sel.configComplete&&(
                  <><span style={{color:T.t4}}>·</span><span className="inline-flex items-center gap-1" style={{color:T.warning}}><AlertTriangle size={12}/>{sel.configIssues} 项配置待完善</span></>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {[{v:sel.serviceCount,l:"服务"},{v:sel.varSetCount,l:"变量集"},{v:sel.refTaskCount,l:"引用任务"}].map(({v,l})=>(
                <div key={l} className="flex flex-col items-center px-2.5 py-1.5 rounded-lg" style={{background:"#FAFAFA",border:`1px solid ${T.border}`,minWidth:48,textAlign:"center"}}>
                  <span className="text-[17px] font-bold leading-none" style={{color:T.t1}}>{v}</span>
                  <span className="text-[10px] mt-0.5" style={{color:T.t4}}>{l}</span>
                </div>
              ))}
              <span className="w-px h-8" style={{background:T.border}}/>
              <PBtn variant="ghost" icon={Copy} onClick={()=>setShowCopy(true)}>复制</PBtn>
              <PBtn variant="ghost" icon={Edit2} onClick={()=>setShowEdit(true)}>编辑</PBtn>
              <PBtn variant="ghost" icon={sel.enabled?Power:CheckCircle} onClick={()=>{
                if(sel.enabled){setShowDisable(true);}
                else{const updated={...sel,enabled:true};updateSel(updated);showToast("环境已启用","success");}
              }} color={sel.enabled?T.warning:T.success}>{sel.enabled?"停用":"启用"}</PBtn>
              <IBtn icon={Trash2} label="删除环境" danger onClick={()=>setShowDeleteConfirm(true)}/>
            </div>
          </div>
          <div className="flex px-6" style={{borderTop:`1px solid ${T.border}`}}>
            {INNER_TABS.map(t=>(
              <button key={t.key} onClick={()=>setInnerTab(t.key)} className="h-10 px-4 text-[13px] font-medium border-b-2 transition-colors"
                style={{borderBottomColor:innerTab===t.key?"#4E5AC8":"transparent",color:innerTab===t.key?"#4E5AC8":T.t3}}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 服务配置 */}
          {innerTab==="services"&&(
            <div className="p-5">
              {services.some(s=>{const ts=svcTests[s.id];return ts?ts.status==="failed":s.testResult==="failed";})&&(
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4" style={{background:"#FFE8E8",border:`1px solid #FBBBBB`}}>
                  <XCircle size={14} style={{color:T.danger,flexShrink:0}}/>
                  <span className="text-[13px]" style={{color:T.danger}}>有服务连接失败，请检查地址配置或网络状态，失败服务不会参与测试执行。</span>
                  <button onClick={batchTest} disabled={batchTesting} className="ml-auto text-[12px] font-medium flex-shrink-0" style={{color:T.danger,background:"none",border:"none",cursor:"pointer"}}>全部重新测试</button>
                </div>
              )}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[13px]" style={{color:T.t3}}>共 {services.length} 个服务，其中 {services.filter(s=>s.isDefault).length} 个默认入口</span>
                <div className="flex-1"/>
                <PBtn variant="ghost" icon={Activity} onClick={batchTest}>{batchTesting?"测试中...":"批量连接测试"}</PBtn>
                <PBtn icon={Plus} onClick={()=>setSvcModal("add")}>添加服务</PBtn>
              </div>
              <div className="flex flex-col gap-3">
                {services.map(svc=>(
                  <div key={svc.id} className="rounded-xl overflow-hidden bg-white" style={{border:`1px solid ${(svcTests[svc.id]?.status==="failed"||(!svcTests[svc.id]&&svc.testResult==="failed"))?"#FBBBBB":T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
                    <div className="flex items-center gap-4 px-4 py-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{background:svc.isDefault?`${T.primary}15`:"#F2F3F5"}}>
                        {svc.isDefault?<Globe size={15} style={{color:T.primary}}/>:<Server size={15} style={{color:T.t4}}/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[13px] font-semibold" style={{color:T.t1}}>{svc.name}</span>
                          {svc.isDefault&&<span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{background:`${T.primary}15`,color:T.primary}}>默认入口</span>}
                          {!svc.enabled&&<span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"#F2F3F5",color:T.t4}}>已停用</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-[12px] font-mono" style={{color:T.t2}}>{svc.baseUrl}</code>
                          <span style={{color:T.t4}}>·</span>
                          <span className="text-[12px]" style={{color:T.t3}}>超时 {svc.timeout/1000}s</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {renderSvcStatus(svc)}
                        <button onClick={()=>runTest(svc.id)} disabled={svcTests[svc.id]?.status==="testing"} className="flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-lg border transition-colors" style={{border:`1px solid ${T.border}`,color:T.t2,background:"#fff",cursor:"pointer"}}>
                          <Activity size={12}/>测试连接
                        </button>
                        <div className="flex">
                          <IBtn icon={Edit2} label="编辑" onClick={()=>setSvcModal(svc)}/>
                          <IBtn icon={Copy} label="复制" onClick={()=>{}}/>
                          <IBtn icon={Trash2} label="删除" danger onClick={()=>{setServicesState(p=>({...p,[sel.id]:(p[sel.id]??[]).filter(s=>s.id!==svc.id)}));}}/>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {services.length===0&&(
                  <div className="flex flex-col items-center justify-center py-20" style={{color:T.t4}}>
                    <Server size={40} className="mb-3"/>
                    <p className="text-[14px] font-medium mb-1" style={{color:T.t2}}>暂无服务配置</p>
                    <p className="text-[13px] mb-4" style={{color:T.t3}}>添加业务服务地址，接口和 UI 测试将使用这些地址发起请求</p>
                    <PBtn icon={Plus} onClick={()=>setSvcModal("add")}>添加第一个服务</PBtn>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 变量配置 */}
          {innerTab==="variables"&&(
            <div className="p-5 flex flex-col gap-5">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{background:"#F0F5FF",border:`1px solid ${T.primary}25`}}>
                <Zap size={13} style={{color:T.primary,flexShrink:0}}/>
                <span className="text-[12px]" style={{color:T.t2}}>变量优先级：</span>
                {["环境局部覆盖","环境绑定变量集","工作区全局变量"].map((l,i,arr)=>(
                  <React.Fragment key={l}>
                    <span className="text-[12px] font-semibold" style={{color:T.primary}}>{l}</span>
                    {i<arr.length-1&&<ChevronRight size={12} style={{color:T.t4}}/>}
                  </React.Fragment>
                ))}
                <span className="text-[12px] ml-1" style={{color:T.t4}}>（优先级从高到低）</span>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-[13px] font-semibold" style={{color:T.t1}}>绑定变量集</h3>
                    <p className="text-[12px] mt-0.5" style={{color:T.t3}}>从变量配置页面选择已有变量集，多个变量集按优先级顺序生效</p>
                  </div>
                  <div className="flex gap-2">
                    {varSets.length>1&&<PBtn variant="ghost" icon={ArrowUp} onClick={()=>setShowPriority(true)}>调整优先级</PBtn>}
                    <PBtn icon={Plus} variant="ghost" onClick={()=>setShowBindVarSet(true)}>绑定变量集</PBtn>
                  </div>
                </div>
                {varSets.length>0?(
                  <div className="flex flex-col gap-2">
                    {varSets.map((vs,i)=>(
                      <div key={vs.id} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white" style={{border:`1px solid ${T.border}`}}>
                        <div onClick={()=>setShowPriority(true)} className="flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 text-[11px] font-bold cursor-pointer" style={{background:`${T.primary}15`,color:T.primary}}>{vs.priority}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[13px] font-medium" style={{color:T.t1}}>{vs.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"#F2F3F5",color:T.t3}}>{vs.scope}</span>
                            {vs.hasSensitive&&<span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"#FFF3E8",color:T.warning}}>含敏感变量</span>}
                          </div>
                          <div className="flex items-center gap-3 text-[12px]">
                            <span style={{color:T.t3}}>{vs.varCount} 个变量</span>
                            <span style={{color:T.t4}}>·</span>
                            <span className="font-mono" style={{color:T.t4}}>{vs.version}</span>
                          </div>
                        </div>
                        <Toggle on={vs.enabled} onChange={v=>setVarSetsState(p=>({...p,[sel.id]:(p[sel.id]??[]).map(s=>s.id===vs.id?{...s,enabled:v}:s)}))}/>
                        <div className="flex">
                          <button title="上移" disabled={i===0} onClick={()=>{
                            setVarSetsState(p=>{const arr=[...(p[sel.id]??[])];[arr[i],arr[i-1]]=[arr[i-1],arr[i]];return {...p,[sel.id]:arr.map((s,idx)=>({...s,priority:idx+1}))};});
                          }} style={{padding:"4px 2px",background:"none",border:"none",cursor:i===0?"not-allowed":"pointer",color:i===0?T.t4:T.t2}}><ArrowUp size={13}/></button>
                          <button title="下移" disabled={i===varSets.length-1} onClick={()=>{
                            setVarSetsState(p=>{const arr=[...(p[sel.id]??[])];[arr[i],arr[i+1]]=[arr[i+1],arr[i]];return {...p,[sel.id]:arr.map((s,idx)=>({...s,priority:idx+1}))};});
                          }} style={{padding:"4px 2px",background:"none",border:"none",cursor:i===varSets.length-1?"not-allowed":"pointer",color:i===varSets.length-1?T.t4:T.t2}}><ArrowDown size={13}/></button>
                        </div>
                        <div className="flex">
                          <IBtn icon={Eye} label="查看变量集" onClick={()=>{}}/>
                          <IBtn icon={Minus} label="解除绑定" danger onClick={()=>setVarSetsState(p=>({...p,[sel.id]:(p[sel.id]??[]).filter(s=>s.id!==vs.id)}))}/>
                        </div>
                      </div>
                    ))}
                  </div>
                ):(
                  <div className="flex flex-col items-center justify-center py-10 rounded-xl" style={{border:`1px dashed ${T.border}`,background:"#FAFAFA"}}>
                    <Variable size={28} style={{color:T.t4}} className="mb-2"/>
                    <p className="text-[13px]" style={{color:T.t3}}>尚未绑定变量集，请前往「变量配置」创建后在此绑定</p>
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-[13px] font-semibold" style={{color:T.t1}}>环境局部变量</h3>
                    <p className="text-[12px] mt-0.5" style={{color:T.t3}}>用于覆盖少量环境差异，此处定义的变量优先级最高</p>
                  </div>
                  <PBtn icon={Plus} variant="ghost" onClick={()=>setLocalVarForm("add")}>添加变量</PBtn>
                </div>
                {localVars.length>0?(
                  <ETable cols={[{label:"变量名",width:"22%"},{label:"值",width:"28%"},{label:"类型",width:"10%"},{label:"说明"},{label:"状态",width:"8%"},{label:"操作",width:"10%",align:"right"}]}>
                    {localVars.map(v=>(
                      <TR key={v.id}>
                        <TD><code className="text-[12px] font-mono font-semibold" style={{color:T.t1}}>{v.name}</code></TD>
                        <TD mono>{v.sensitive?<span className="text-[12px]" style={{color:T.t4}}>••••••••</span>:<span className="text-[12px]" style={{color:T.t2}}>{v.value}</span>}</TD>
                        <TD><span className="text-[11px] px-1.5 py-0.5 rounded" style={{background:"#F2F3F5",color:T.t3}}>{v.type}</span></TD>
                        <TD muted>{v.description}</TD>
                        <TD><Toggle on={v.enabled} onChange={en=>setLocalVarsState(p=>({...p,[sel.id]:(p[sel.id]??[]).map(lv=>lv.id===v.id?{...lv,enabled:en}:lv)}))}/></TD>
                        <TD align="right"><div className="flex justify-end"><IBtn icon={Edit2} label="编辑" onClick={()=>setLocalVarForm(v)}/><IBtn icon={Trash2} label="删除" danger onClick={()=>setDeleteVar(v)}/></div></TD>
                      </TR>
                    ))}
                  </ETable>
                ):(
                  <div className="flex flex-col items-center justify-center py-8 rounded-xl" style={{border:`1px dashed ${T.border}`,background:"#FAFAFA"}}>
                    <p className="text-[13px]" style={{color:T.t3}}>暂无局部变量，当需要覆盖特定环境差异时添加</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mock 配置 */}
          {innerTab==="mock"&&(
            <div className="p-5">
              {sel.stage==="prod"&&(
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl mb-5" style={{background:"#FFE8E8",border:`1px solid #FBBBBB`}}>
                  <AlertTriangle size={14} style={{color:T.danger,flexShrink:0,marginTop:1}}/>
                  <div>
                    <p className="text-[13px] font-semibold" style={{color:T.danger}}>生产环境禁止启用 Mock</p>
                    <p className="text-[12px] mt-0.5" style={{color:T.danger}}>生产阶段的环境中不允许绑定 Mock 版本，以防止生产请求被拦截或返回模拟数据。</p>
                  </div>
                </div>
              )}
              {!mockBind&&sel.stage!=="prod"&&(
                <div className="flex flex-col items-center justify-center py-20" style={{color:T.t4}}>
                  <Code2 size={40} className="mb-3"/>
                  <p className="text-[14px] font-medium mb-1" style={{color:T.t2}}>尚未绑定 Mock</p>
                  <p className="text-[13px] mb-4" style={{color:T.t3}}>绑定后，测试执行中的接口请求将由 Mock 服务拦截并返回模拟响应</p>
                  <PBtn icon={Plus} onClick={()=>showToast("请在 Mock 服务页面配置后绑定","warn")}>绑定 Mock 应用</PBtn>
                </div>
              )}
              {mockBind&&(
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[13px] font-semibold" style={{color:T.t1}}>当前绑定</h3>
                    <div className="flex gap-2">
                      <PBtn variant="ghost" icon={RefreshCw} onClick={()=>setShowMockSwitch(true)}>切换版本</PBtn>
                      <PBtn variant="ghost" icon={Minus} onClick={()=>setShowMockUnbind(true)} color={T.danger}>解除绑定</PBtn>
                    </div>
                  </div>
                  <div className="rounded-xl overflow-hidden bg-white" style={{border:`1px solid ${T.border}`}}>
                    <div className="flex items-center justify-between px-5 py-3" style={{borderBottom:`1px solid ${T.border}`,background:"#FAFAFA"}}>
                      <div className="flex items-center gap-2">
                        <Toggle on={mockBind.enabled} onChange={v=>setMockBindsState(p=>({...p,[sel.id]:p[sel.id]?{...p[sel.id]!,enabled:v}:undefined}))}/>
                        <span className="text-[13px] font-medium" style={{color:T.t1}}>{mockBind.enabled?"Mock 已启用，接口请求将被拦截":"Mock 已停用，接口请求将直接到达真实服务"}</span>
                      </div>
                      <button className="text-[12px]" style={{color:T.primary,background:"none",border:"none",cursor:"pointer"}}>前往 Mock 服务查看详情 →</button>
                    </div>
                    <div className="grid grid-cols-2 gap-0" style={{borderBottom:`1px solid ${T.border}`}}>
                      {[
                        {l:"Mock 应用",v:<span className="text-[13px] font-medium" style={{color:T.t1}}>{mockBind.appName}</span>},
                        {l:"应用编码",v:<code className="text-[12px] font-mono" style={{color:T.t2}}>{mockBind.appCode}</code>},
                        {l:"当前版本",v:<span className="text-[13px] font-mono font-semibold" style={{color:T.success}}>{mockBind.version}</span>},
                        {l:"Mock 基础地址",v:<code className="text-[12px] font-mono truncate block" style={{color:T.primary}}>{mockBind.baseUrl}</code>},
                        {l:"接口 / 场景",v:<span className="text-[13px]" style={{color:T.t1}}>{mockBind.ifaceCount} 接口 · {mockBind.sceneCount} 场景</span>},
                        {l:"访问凭据",v:<span className="text-[12px]" style={{color:mockBind.authEnabled?T.success:T.t4}}>{mockBind.authEnabled?"已启用（Token 独立管理）":"未启用"}</span>},
                        {l:"未匹配策略",v:<span className="text-[13px]" style={{color:T.t2}}>{UNMATCHED_LABEL[mockBind.unmatchedPolicy]}</span>},
                      ].map(({l,v},i)=>(
                        <div key={i} className="flex items-center gap-3 px-5 py-3" style={{borderBottom:`1px solid ${T.border}`,borderRight:i%2===0?`1px solid ${T.border}`:"none"}}>
                          <span className="text-[12px] font-medium flex-shrink-0" style={{color:T.t4,minWidth:80}}>{l}</span>
                          <div className="flex-1 min-w-0">{v}</div>
                        </div>
                      ))}
                    </div>
                    {sel.id==="e1"&&(
                      <div className="flex items-center gap-2 px-5 py-2.5" style={{background:"#FFF3E8"}}>
                        <AlertTriangle size={13} style={{color:T.warning}}/>
                        <span className="text-[12px]" style={{color:T.warning}}>过去 24 小时内有 3 次请求未匹配到任何场景，可在 Mock 服务调用日志中查看详情</span>
                        <button className="ml-auto text-[12px] font-medium" style={{color:T.warning,background:"none",border:"none",cursor:"pointer"}}>查看日志 →</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 最终生效预览 */}
          {innerTab==="effective"&&(
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <p className="text-[13px]" style={{color:T.t3}}>下表展示当前环境执行时各变量的最终生效值及来源。敏感变量已脱敏，同名变量按优先级覆盖。</p>
                <div className="flex-1"/>
                <Sel width={130}><option>全部变量</option><option>环境局部覆盖</option><option>变量集变量</option><option>工作区变量</option></Sel>
                <Inp placeholder="搜索变量名" prefix={<Search size={12}/>} width={180}/>
              </div>
              {localVars.length===0&&varSets.length===0?(
                <div className="flex flex-col items-center justify-center py-16" style={{color:T.t4}}>
                  <Variable size={36} className="mb-3"/>
                  <p className="text-[13px]" style={{color:T.t3}}>尚未配置任何变量，请先绑定变量集或添加局部变量</p>
                </div>
              ):(
                <ETable cols={[{label:"变量名",width:"22%"},{label:"最终值",width:"22%"},{label:"来源",width:"16%"},{label:"是否覆盖",width:"10%"},{label:"说明"},{label:"状态",width:"8%",align:"center"}]}>
                  {[
                    {name:"API_GATEWAY_URL",value:"https://gw.test.internal/v2",source:"环境局部覆盖",overrides:"QA 公共变量集",desc:"局部变量覆盖了变量集中的同名变量",ok:true,sensitive:false},
                    {name:"TEST_ADMIN_TOKEN",value:"••••••••",source:"环境局部覆盖",overrides:null,desc:"敏感变量，已脱敏",ok:true,sensitive:true},
                    {name:"PAGE_TIMEOUT",value:"45000",source:"环境局部覆盖",overrides:"QA 公共变量集",desc:"覆盖变量集中的 30000",ok:true,sensitive:false},
                    {name:"DB_HOST",value:"db.test.internal",source:"QA 公共变量集",overrides:null,desc:"",ok:true,sensitive:false},
                    {name:"RETRY_COUNT",value:"3",source:"工作区全局变量",overrides:null,desc:"",ok:true,sensitive:false},
                    {name:"UNKNOWN_REF",value:"—",source:"QA 公共变量集",overrides:null,desc:"引用了无法解析的变量 {{env.NOT_FOUND}}",ok:false,sensitive:false},
                  ].map((v,i)=>(
                    <TR key={i}>
                      <TD><code className="text-[12px] font-mono font-semibold" style={{color:T.t1}}>{v.name}</code></TD>
                      <TD mono>{v.sensitive?<span style={{color:T.t4}}>••••••••</span>:<span style={{color:T.t2}}>{v.value}</span>}</TD>
                      <TD><span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{background:v.source==="环境局部覆盖"?`${T.primary}15`:v.source==="工作区全局变量"?"#F2F3F5":"#F5E8FF",color:v.source==="环境局部覆盖"?T.primary:v.source==="工作区全局变量"?T.t3:T.purple}}>{v.source}</span></TD>
                      <TD>{v.overrides?<span className="text-[11px]" style={{color:T.warning}}>覆盖自 {v.overrides}</span>:<span style={{color:T.t4}}>—</span>}</TD>
                      <TD muted>{v.desc||"—"}</TD>
                      <TD align="center">{v.ok?<CheckCircle size={14} style={{color:T.success}}/>:<AlertTriangle size={14} style={{color:T.danger}}/>}</TD>
                    </TR>
                  ))}
                </ETable>
              )}
            </div>
          )}

          {/* 引用分析 */}
          {innerTab==="refs"&&(
            <div className="p-5">
              {hasRunning&&(
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4" style={{background:"#FFF3E8",border:`1px solid #FFD595`}}>
                  <AlertTriangle size={14} style={{color:T.warning,flexShrink:0}}/>
                  <span className="text-[13px]" style={{color:T.warning}}>当前有任务正在使用此环境运行，停用或删除操作将被阻止。</span>
                </div>
              )}
              {refs.length===0?(
                <div className="flex flex-col items-center justify-center py-20" style={{color:T.t4}}>
                  <Activity size={40} className="mb-3"/>
                  <p className="text-[14px] font-medium mb-1" style={{color:T.t2}}>暂无引用</p>
                  <p className="text-[13px]" style={{color:T.t3}}>此环境尚未被任何接口场景、套件或定时任务引用</p>
                </div>
              ):(
                <>
                  <div className="flex gap-3 mb-5">
                    {Object.entries(REF_TYPE_META).map(([type,m])=>{
                      const count=refs.filter(r=>r.type===type).length;
                      const Icon=m.icon;
                      return count>0?(
                        <div key={type} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl" style={{background:m.bg,border:`1px solid ${m.color}25`}}>
                          <Icon size={16} style={{color:m.color}}/>
                          <div><p className="text-[20px] font-bold leading-none" style={{color:m.color}}>{count}</p><p className="text-[11px] mt-0.5" style={{color:m.color}}>{m.label}</p></div>
                        </div>
                      ):null;
                    })}
                  </div>
                  <ETable cols={[{label:"类型",width:"12%"},{label:"资源名称"},{label:"最近执行",width:"18%"},{label:"状态",width:"10%",align:"center"},{label:"操作",width:"8%",align:"right"}]}>
                    {refs.map(ref=>{const m=REF_TYPE_META[ref.type];const Icon=m.icon;return(
                      <TR key={ref.id}>
                        <TD><span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded" style={{background:m.bg,color:m.color}}><Icon size={10}/>{m.label}</span></TD>
                        <TD><span className="font-medium" style={{color:T.t1}}>{ref.name}</span></TD>
                        <TD mono muted>{ref.lastRun??'—'}</TD>
                        <TD align="center">{ref.running?<span className="inline-flex items-center gap-1 text-[11px]" style={{color:T.primary}}><Activity size={11}/>运行中</span>:<span className="text-[11px]" style={{color:T.t4}}>空闲</span>}</TD>
                        <TD align="right"><button className="text-[12px]" style={{color:T.primary,background:"none",border:"none",cursor:"pointer"}}>查看</button></TD>
                      </TR>
                    );})}
                  </ETable>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate&&<CreateEnvModal onClose={()=>setShowCreate(false)} onCreate={e=>{setEnvs(prev=>[...prev,e]);setSel(e);showToast("环境已创建","success");}}/>}
      {showEdit&&<EditEnvModal env={sel} onClose={()=>setShowEdit(false)} onSave={e=>{updateSel(e);showToast("环境配置已保存","success");}}/>}
      {showCopy&&<CopyEnvModal env={sel} onClose={()=>setShowCopy(false)} onCreate={e=>{setEnvs(prev=>[...prev,e]);setSel(e);showToast("环境副本已创建","success");}}/>}
      {showDisable&&<DisableEnvModal env={sel} refs={refs} onClose={()=>setShowDisable(false)} onConfirm={()=>{updateSel({...sel,enabled:false});showToast("环境已停用","warn");}}/>}
      {svcModal&&<AddEditServiceModal
        mode={typeof svcModal==="string"?"add":"edit"}
        initial={typeof svcModal==="string"?undefined:svcModal}
        onClose={()=>setSvcModal(null)}
        onSave={s=>{
          setServicesState(p=>{
            const cur=p[sel.id]??[];
            const exists=cur.find(x=>x.id===s.id);
            const next=exists?cur.map(x=>x.id===s.id?s:x):[...cur,{...s,envId:sel.id}];
            return {...p,[sel.id]:next};
          });
          showToast(typeof svcModal==="string"?"服务已添加":"服务已更新","success");
        }}
      />}
      {showBindVarSet&&<BindVarSetModal boundIds={varSets.map(v=>v.id)} onClose={()=>setShowBindVarSet(false)} onBind={newSets=>{
        setVarSetsState(p=>{const cur=p[sel.id]??[];const next=[...cur,...newSets.map((s,i)=>({...s,priority:cur.length+i+1}))];return {...p,[sel.id]:next};});
        showToast(`已绑定 ${newSets.length} 个变量集`,"success");
      }}/>}
      {showPriority&&varSets.length>0&&<VarSetPriorityModal sets={varSets} onClose={()=>setShowPriority(false)} onSave={newSets=>{setVarSetsState(p=>({...p,[sel.id]:newSets}));showToast("优先级已保存","success");}}/>}
      {localVarForm!==null&&<LocalVarModal
        mode={localVarForm==="add"?"add":"edit"}
        initial={localVarForm==="add"?undefined:localVarForm}
        onClose={()=>setLocalVarForm(null)}
        onSave={v=>{
          setLocalVarsState(p=>{
            const cur=p[sel.id]??[];
            const exists=cur.find(x=>x.id===v.id);
            const next=exists?cur.map(x=>x.id===v.id?v:x):[...cur,v];
            return {...p,[sel.id]:next};
          });
          showToast(localVarForm==="add"?"变量已添加":"变量已更新","success");
        }}
      />}
      {deleteVar&&<DeleteLocalVarConfirm v={deleteVar} onClose={()=>setDeleteVar(null)} onConfirm={()=>{setLocalVarsState(p=>({...p,[sel.id]:(p[sel.id]??[]).filter(v=>v.id!==deleteVar.id)}));showToast("变量已删除","success");}}/>}
      {showMockSwitch&&mockBind&&<MockVersionSwitchModal bind={mockBind} onClose={()=>setShowMockSwitch(false)} onSwitch={version=>{
        setMockBindsState(p=>({...p,[sel.id]:p[sel.id]?{...p[sel.id]!,version:version.split(" ")[0]}:undefined}));
        showToast(`Mock 版本已切换至 ${version.split(" ")[0]}`,"success");
      }}/>}
      {showMockUnbind&&mockBind&&<MockUnbindConfirm bind={mockBind} onClose={()=>setShowMockUnbind(false)} onConfirm={()=>{
        setMockBindsState(p=>({...p,[sel.id]:undefined}));
        updateSel({...sel,mockEnabled:false,mockApp:null,mockVersion:null});
        showToast("Mock 绑定已解除","warn");
      }}/>}
      {showDeleteConfirm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:"rgba(29,33,41,0.5)"}}>
          <div className="rounded-2xl overflow-hidden" style={{width:440,background:"#fff",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
            <div className="px-6 py-5" style={{borderBottom:`1px solid ${T.border}`}}>
              <h2 className="text-[15px] font-semibold" style={{color:T.t1}}>确认删除环境</h2>
            </div>
            <div className="px-6 py-5">
              {sel.refTaskCount>0?(
                <div className="flex items-start gap-2 px-3 py-3 rounded-lg mb-4" style={{background:"#FFE8E8",border:`1px solid #FBBBBB`}}>
                  <XCircle size={14} style={{color:T.danger,flexShrink:0,marginTop:1}}/>
                  <p className="text-[13px]" style={{color:T.danger}}>此环境被 <strong>{sel.refTaskCount}</strong> 个任务引用，删除前请先解除所有引用关系。</p>
                </div>
              ):(
                <p className="text-[13px] mb-4" style={{color:T.t2}}>删除后「<strong>{sel.name}</strong>」的所有配置将永久丢失，此操作不可恢复。</p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`,background:"#FAFAFA"}}>
              <PBtn variant="ghost" onClick={()=>setShowDeleteConfirm(false)}>取消</PBtn>
              <PBtn onClick={()=>{if(sel.refTaskCount>0)return;setEnvs(p=>p.filter(e=>e.id!==sel.id));setSel(TEST_ENVS[0]);setShowDeleteConfirm(false);showToast("环境已删除","warn");}} color={T.danger}>{sel.refTaskCount>0?"无法删除（存在引用）":"确认删除"}</PBtn>
            </div>
          </div>
        </div>
      )}
      <ToastList items={toasts}/>
    </div>
  );
}
