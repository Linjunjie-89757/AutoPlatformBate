import React,{useState,useEffect,useRef} from "react";
import {
  Search,Plus,Edit2,Trash2,Copy,X,Eye,EyeOff,AlertTriangle,CheckCircle,
  ChevronRight,ChevronDown,Variable,Layers,Globe,Zap,Hash,Lock,
  ArrowUp,ArrowDown,Download,Upload,Filter,Shield,Clock,RefreshCw,
  XCircle,FileText,CheckSquare,Loader,RotateCcw,
} from "lucide-react";

const T={primary:"#165DFF",success:"#00B42A",warning:"#FF7D00",danger:"#F53F3F",purple:"#7816FF",cyan:"#0FC6C2",slate:"#4E5969",bg:"#F4F6FA",border:"#E5E6EB",t1:"#1D2129",t2:"#4E5969",t3:"#86909C",t4:"#C9CDD4"};

// ─── Atoms ────────────────────────────────────────────────────────────────────

function PBtn({children,onClick,icon:Icon,small,color=T.primary,variant="primary",disabled}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;variant?:"primary"|"ghost";disabled?:boolean}){
  if(variant==="ghost") return <button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium bg-white transition-colors" style={{borderColor:T.border,color:T.t2,opacity:disabled?0.5:1}} onMouseEnter={e=>{if(!disabled){e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.color=T.primary;}}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.t2;}}>{Icon&&<Icon size={13}/>}{children}</button>;
  return <button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-all active:scale-[0.98]" style={{backgroundColor:color,color:"#fff",height:small?28:32,padding:small?"0 10px":"0 14px",fontSize:small?12:13,opacity:disabled?0.5:1}} onMouseEnter={e=>!disabled&&(e.currentTarget.style.filter="brightness(1.1)")} onMouseLeave={e=>e.currentTarget.style.filter=""}>{Icon&&<Icon size={small?12:13}/>}{children}</button>;
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

type VarType="string"|"integer"|"boolean"|"secret"|"json";
type VarScope="global"|"varset"|"builtin";

interface GlobalVar {id:string;name:string;value:string;type:VarType;sensitive:boolean;description:string;enabled:boolean;updatedAt:string;updatedBy:string;}
interface VarSet {id:string;name:string;description:string;scope:string;varCount:number;sensitiveCount:number;version:string;enabled:boolean;envBindCount:number;updatedAt:string;updatedBy:string;}
interface VarSetItem {id:string;setId:string;name:string;value:string;type:VarType;sensitive:boolean;description:string;enabled:boolean;}
interface BuiltinCategory {id:string;label:string;icon:React.ElementType;color:string;bg:string;items:{name:string;syntax:string;desc:string;example:string;}[];}

// ─── Data ─────────────────────────────────────────────────────────────────────

const GLOBAL_VARS:GlobalVar[]=[
  {id:"gv1",name:"DEFAULT_TIMEOUT",value:"30000",type:"integer",sensitive:false,description:"全局默认请求超时时间（毫秒）",enabled:true,updatedAt:"2026-07-28",updatedBy:"张程远"},
  {id:"gv2",name:"BASE_RETRY_COUNT",value:"3",type:"integer",sensitive:false,description:"请求失败自动重试次数",enabled:true,updatedAt:"2026-07-25",updatedBy:"王芳"},
  {id:"gv3",name:"WS_API_SECRET",value:"••••••••••••",type:"secret",sensitive:true,description:"工作区级别 API 访问密钥，所有模块共用",enabled:true,updatedAt:"2026-07-20",updatedBy:"张程远"},
  {id:"gv4",name:"LOG_LEVEL",value:"INFO",type:"string",sensitive:false,description:"全局日志输出级别",enabled:true,updatedAt:"2026-07-10",updatedBy:"李明"},
  {id:"gv5",name:"FEATURE_MOCK_ENABLED",value:"true",type:"boolean",sensitive:false,description:"全局 Mock 功能开关",enabled:false,updatedAt:"2026-07-05",updatedBy:"陈伟"},
];

const VAR_SETS:VarSet[]=[
  {id:"vs1",name:"QA 公共变量集",description:"QA 团队所有测试场景共用的公共变量，含服务地址、账号等",scope:"全局",varCount:24,sensitiveCount:3,version:"v3.2",enabled:true,envBindCount:3,updatedAt:"2026-07-29",updatedBy:"张程远"},
  {id:"vs2",name:"订单模块变量集",description:"订单中心相关接口测试专用变量",scope:"订单中心",varCount:11,sensitiveCount:1,version:"v1.0",enabled:true,envBindCount:1,updatedAt:"2026-07-20",updatedBy:"王芳"},
  {id:"vs3",name:"用户模块变量集",description:"用户中心功能测试：注册、登录、权限等场景",scope:"用户中心",varCount:8,sensitiveCount:2,version:"v0.9",enabled:true,envBindCount:1,updatedAt:"2026-07-15",updatedBy:"李明"},
  {id:"vs4",name:"性能测试变量集",description:"性能压测专用：并发数、持续时长、采样率",scope:"性能测试",varCount:6,sensitiveCount:0,version:"v1.1",enabled:false,envBindCount:0,updatedAt:"2026-07-01",updatedBy:"陈伟"},
];

const VAR_SET_ITEMS:Record<string,VarSetItem[]>={
  vs1:[
    {id:"vi1",setId:"vs1",name:"API_GATEWAY_URL",value:"https://api-qa.example.com",type:"string",sensitive:false,description:"QA 网关地址",enabled:true},
    {id:"vi2",setId:"vs1",name:"AUTH_TOKEN_SECRET",value:"••••••••••••",type:"secret",sensitive:true,description:"JWT 签名密钥",enabled:true},
    {id:"vi3",setId:"vs1",name:"DB_HOST",value:"db-qa.internal",type:"string",sensitive:false,description:"测试数据库主机",enabled:true},
    {id:"vi4",setId:"vs1",name:"RETRY_DELAY_MS",value:"500",type:"integer",sensitive:false,description:"重试间隔时间",enabled:true},
    {id:"vi5",setId:"vs1",name:"FEATURE_FLAG_NEW_UI",value:"false",type:"boolean",sensitive:false,description:"新 UI 特性开关",enabled:false},
  ],
  vs2:[
    {id:"vi6",setId:"vs2",name:"ORDER_SVC_URL",value:"https://order-qa.example.com",type:"string",sensitive:false,description:"订单服务基础地址",enabled:true},
    {id:"vi7",setId:"vs2",name:"ORDER_SIGN_KEY",value:"••••••••••••",type:"secret",sensitive:true,description:"订单签名密钥",enabled:true},
    {id:"vi8",setId:"vs2",name:"MAX_ORDER_AMOUNT",value:"99999",type:"integer",sensitive:false,description:"单笔最大金额",enabled:true},
  ],
};

const BUILTIN_CATEGORIES:BuiltinCategory[]=[
  {id:"faker",label:"数据生成",icon:Hash,color:"#7816FF",bg:"#F5F0FF",items:[
    {name:"$faker.name",syntax:"{{$faker.name()}}",desc:"随机中文姓名",example:"张伟"},
    {name:"$faker.phone",syntax:"{{$faker.phone()}}",desc:"随机手机号",example:"138****5678"},
    {name:"$faker.email",syntax:"{{$faker.email()}}",desc:"随机邮箱地址",example:"user@example.com"},
    {name:"$faker.uuid",syntax:"{{$faker.uuid()}}",desc:"随机 UUID v4",example:"550e8400-..."},
    {name:"$faker.idCard",syntax:"{{$faker.idCard()}}",desc:"随机身份证号",example:"310..."},
  ]},
  {id:"datetime",label:"时间日期",icon:Clock,color:"#0FC6C2",bg:"#E8FAFA",items:[
    {name:"$now",syntax:"{{$now}}",desc:"当前 ISO 时间戳",example:"2026-08-01T10:00:00Z"},
    {name:"$today",syntax:"{{$today}}",desc:"今日日期",example:"2026-08-01"},
    {name:"$timestamp",syntax:"{{$timestamp}}",desc:"Unix 毫秒时间戳",example:"1754035200000"},
    {name:"$dateAdd",syntax:"{{$dateAdd(days)}}",desc:"当前日期加 N 天",example:"2026-08-08"},
  ]},
  {id:"ctx",label:"运行上下文",icon:Zap,color:"#FF7D00",bg:"#FFF3E8",items:[
    {name:"$env.name",syntax:"{{$env.name}}",desc:"当前环境名称",example:"QA-压测"},
    {name:"$run.id",syntax:"{{$run.id}}",desc:"当前执行 ID",example:"run_abc123"},
    {name:"$run.index",syntax:"{{$run.index}}",desc:"当前循环索引",example:"0"},
    {name:"$prev.response",syntax:"{{$prev.response.data.id}}",desc:"上一步响应取值",example:"42"},
  ]},
  {id:"crypto",label:"加密&编解码",icon:Lock,color:"#165DFF",bg:"#EBF0FF",items:[
    {name:"$base64.encode",syntax:"{{$base64.encode(value)}}",desc:"Base64 编码",example:"aGVsbG8="},
    {name:"$md5",syntax:"{{$md5(value)}}",desc:"MD5 摘要",example:"5d41402a..."},
    {name:"$hmac.sha256",syntax:"{{$hmac.sha256(key,value)}}",desc:"HMAC-SHA256 签名",example:"a7b3c9..."},
  ]},
];

const VAR_TYPE_STYLE:Record<VarType,{label:string;color:string;bg:string}>={
  string: {label:"文本",  color:T.primary, bg:"#E8F3FF"},
  integer:{label:"整数",  color:T.cyan,   bg:"#E8FFFE"},
  boolean:{label:"布尔",  color:T.purple, bg:"#F5E8FF"},
  secret: {label:"密钥",  color:T.danger, bg:"#FFE8E8"},
  json:   {label:"JSON",  color:T.warning,bg:"#FFF3E8"},
};

// ─── Toast ────────────────────────────────────────────────────────────────────

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
      const c=t.type==="success"?{bg:"#E8FFEA",bd:T.success,ic:<CheckCircle size={14}/>,co:T.success}
        :t.type==="error"?{bg:"#FFE8E8",bd:T.danger,ic:<XCircle size={14}/>,co:T.danger}
        :{bg:"#FFF3E8",bd:T.warning,ic:<AlertTriangle size={14}/>,co:T.warning};
      return(<div key={t.id} style={{background:c.bg,border:`1px solid ${c.bd}`,borderRadius:12,padding:"10px 16px",display:"flex",alignItems:"center",gap:8,color:c.co,fontSize:13,fontWeight:500,minWidth:280,boxShadow:"0 4px 20px rgba(0,0,0,0.12)"}}>{c.ic}{t.msg}</div>);
    })}
  </div>);
}

// ─── ModalWrap ────────────────────────────────────────────────────────────────

function ModalWrap({children,onClose,width=520}:{children:React.ReactNode;onClose:()=>void;width?:number}){
  return <div className="fixed inset-0 flex items-center justify-center" style={{zIndex:1000,background:"rgba(0,0,0,0.35)"}}>
    <div style={{width,background:"#fff",borderRadius:16,boxShadow:"0 24px 80px rgba(0,0,0,0.20)",display:"flex",flexDirection:"column",maxHeight:"85vh"}}>
      {children}
    </div>
  </div>;
}

// ─── Modal header helper ──────────────────────────────────────────────────────

function MHead({title,onClose}:{title:string;onClose:()=>void}){
  return <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
    <h2 className="text-[15px] font-semibold" style={{color:T.t1}}>{title}</h2>
    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{color:T.t4,background:"none",border:"none",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}><X size={16}/></button>
  </div>;
}

// ─── VarEditModal ─────────────────────────────────────────────────────────────

function VarEditModal({mode,initial,onClose,onSave}:{mode:"add"|"edit";initial?:GlobalVar|VarSetItem;onClose:()=>void;onSave:(v:any)=>void}){
  const[name,setName]=useState(initial?.name??"");
  const[value,setValue]=useState(initial?.sensitive?"":(initial?.value??""));
  const[type,setType]=useState<VarType>(initial?.type??"string");
  const[sensitive,setSensitive]=useState(initial?.sensitive??false);
  const[desc,setDesc]=useState(initial?.description??"");
  const[enabled,setEnabled]=useState(initial?.enabled??true);
  const valid=name.trim()&&(type==="json"||value.trim()||sensitive);
  const save=()=>{
    if(!valid)return;
    onSave({...(initial??{}),name:name.trim(),value:sensitive?"••••••••••••":value,type,sensitive,description:desc,enabled,updatedAt:"2026-08-01",updatedBy:"张程远"});
    onClose();
  };
  return(
    <ModalWrap onClose={onClose}>
      <MHead title={mode==="add"?"添加变量":"编辑变量"} onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">
        <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>变量名 <span style={{color:T.danger}}>*</span></label><Inp placeholder="例：API_BASE_URL（仅大写字母、数字、下划线）" mono width="100%" value={name} onChange={setName}/></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>类型</label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(VAR_TYPE_STYLE) as VarType[]).map(t=>{const s=VAR_TYPE_STYLE[t];const sel=type===t;return(
                <button key={t} onClick={()=>setType(t)} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all" style={{border:`1.5px solid ${sel?s.color:T.border}`,background:sel?s.bg:"#fff",color:sel?s.color:T.t3,cursor:"pointer"}}>{s.label}</button>
              );})}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="block text-[12px] font-medium" style={{color:T.t2}}>敏感变量</label>
            <div className="flex items-center gap-2"><Toggle on={sensitive} onChange={setSensitive}/><span className="text-[12px]" style={{color:T.t3}}>{sensitive?"值将在界面上隐藏显示":"值明文可见"}</span></div>
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>值 <span style={{color:T.danger}}>*</span></label>
          {type==="json"?(
            <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#1E1E1E",minHeight:100}}>
              <div className="p-3 font-mono text-[12px] leading-6" style={{color:"#D4D4D4"}}>
                <span style={{color:"#569CD6"}}>{"{"}</span><br/>
                <span style={{paddingLeft:16,color:"#9CDCFE"}}>"key"</span><span style={{color:"#D4D4D4"}}>: </span><span style={{color:"#CE9178"}}>"value"</span><br/>
                <span style={{color:"#569CD6"}}>{"}"}</span>
              </div>
            </div>
          ):(
            <Inp type={sensitive?"password":"text"} placeholder={type==="boolean"?"true 或 false":type==="integer"?"整数值":"变量值"} mono width="100%" value={value} onChange={setValue}/>
          )}
        </div>
        <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>说明</label><Inp placeholder="描述该变量的用途、注意事项" width="100%" value={desc} onChange={setDesc}/></div>
        <div className="flex items-center gap-3"><label className="text-[12px] font-medium" style={{color:T.t2}}>是否启用</label><Toggle on={enabled} onChange={setEnabled}/><span className="text-[12px]" style={{color:T.t3}}>{enabled?"已启用":"已停用"}</span></div>
        {sensitive&&(
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{background:"#FFF3E8",border:`1px solid #FFD595`}}>
            <AlertTriangle size={13} style={{color:T.warning,flexShrink:0,marginTop:1}}/>
            <p className="text-[12px]" style={{color:T.warning}}>敏感变量保存后，值将不再以明文展示。如需修改请重新输入。</p>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`,background:"#FAFAFA"}}>
        <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
        <PBtn disabled={!valid} onClick={save}>保存变量</PBtn>
      </div>
    </ModalWrap>
  );
}

// ─── SensitiveRevealModal ─────────────────────────────────────────────────────

function SensitiveRevealModal({varName,maskedValue,onClose}:{varName:string;maskedValue:string;onClose:()=>void}){
  const[step,setStep]=useState<"confirm"|"revealed"|"done">("confirm");
  const[count,setCount]=useState(30);
  const now=new Date().toLocaleString("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
  useEffect(()=>{
    if(step!=="revealed")return;
    if(count<=0){setStep("done");setTimeout(onClose,1000);return;}
    const t=setTimeout(()=>setCount(c=>c-1),1000);
    return()=>clearTimeout(t);
  },[step,count]);
  return(
    <ModalWrap onClose={onClose} width={480}>
      <MHead title="查看敏感变量" onClose={onClose}/>
      <div className="px-6 py-6 flex flex-col gap-4">
        {step==="confirm"&&(
          <>
            <div className="flex items-start gap-3 p-4 rounded-xl" style={{background:"#FFF3E8",border:`1px solid #FFD595`}}>
              <AlertTriangle size={18} style={{color:T.warning,flexShrink:0,marginTop:2}}/>
              <div>
                <p className="text-[13px] font-medium mb-1" style={{color:T.t1}}>您即将查看敏感变量 「{varName}」 的明文值</p>
                <p className="text-[12px]" style={{color:T.warning}}>此操作将被记入审计日志</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{background:"#F4F6FA",border:`1px solid ${T.border}`}}>
              <Shield size={13} style={{color:T.t3}}/>
              <span className="text-[12px]" style={{color:T.t3}}>明文值将在 30 秒后自动脱敏</span>
            </div>
            <div className="flex justify-end gap-2">
              <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
              <PBtn color={T.warning} onClick={()=>setStep("revealed")}>确认查看</PBtn>
            </div>
          </>
        )}
        {step==="revealed"&&(
          <>
            <div>
              <label className="block text-[12px] font-medium mb-2" style={{color:T.t2}}>变量名</label>
              <code className="text-[13px] font-mono font-semibold" style={{color:T.t1}}>{varName}</code>
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-2" style={{color:T.t2}}>明文值</label>
              <div className="p-3 rounded-lg font-mono text-[13px] select-all" style={{background:"#F4F6FA",border:`1px solid ${T.border}`,color:T.t1,wordBreak:"break-all"}}>sk-abc12345xyz</div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{background:"#FFE8E8",border:`1px solid ${T.danger}40`}}>
              <Clock size={13} style={{color:T.danger}}/>
              <span className="text-[12px] font-medium" style={{color:T.danger}}>{count} 秒后自动脱敏</span>
            </div>
            <div className="p-3 rounded-lg" style={{background:"#F4F6FA",border:`1px solid ${T.border}`}}>
              <p className="text-[11px]" style={{color:T.t3}}>查看记录已写入操作审计：{now} 张程远 查看了 {varName}</p>
            </div>
            <div className="flex justify-end gap-2">
              <PBtn color={T.danger} onClick={()=>{setStep("done");setTimeout(onClose,1000);}}>立即脱敏</PBtn>
            </div>
          </>
        )}
        {step==="done"&&(
          <div className="flex flex-col items-center py-6 gap-3">
            <CheckCircle size={40} style={{color:T.success}}/>
            <p className="text-[14px] font-medium" style={{color:T.t1}}>已脱敏</p>
          </div>
        )}
      </div>
    </ModalWrap>
  );
}

// ─── ImportFlowModal ──────────────────────────────────────────────────────────

const IMPORT_STEPS=["选择文件","格式校验","导入预览","冲突处理","导入完成"];
const PREVIEW_VARS=[
  {name:"NEW_VAR_1",type:"string",status:"new"},
  {name:"NEW_VAR_2",type:"integer",status:"new"},
  {name:"NEW_VAR_3",type:"boolean",status:"new"},
  {name:"NEW_VAR_4",type:"string",status:"new"},
  {name:"DEFAULT_TIMEOUT",type:"integer",status:"conflict"},
  {name:"LOG_LEVEL",type:"string",status:"conflict"},
];
type ConflictAction="skip"|"overwrite"|"rename";

function ImportFlowModal({onClose,onImported}:{onClose:()=>void;onImported:(vars:any[])=>void}){
  const[step,setStep]=useState(0);
  const[conflictActions,setConflictActions]=useState<Record<string,ConflictAction>>({DEFAULT_TIMEOUT:"skip",LOG_LEVEL:"skip"});
  useEffect(()=>{
    if(step!==1)return;
    const t=setTimeout(()=>setStep(2),1500);
    return()=>clearTimeout(t);
  },[step]);
  const conflicts=PREVIEW_VARS.filter(v=>v.status==="conflict");
  const overwritten=conflicts.filter(v=>conflictActions[v.name]==="overwrite").length;
  const skipped=conflicts.filter(v=>conflictActions[v.name]==="skip").length;
  return(
    <ModalWrap onClose={onClose} width={580}>
      <MHead title={`导入变量 — ${IMPORT_STEPS[step]}`} onClose={onClose}/>
      {/* Step indicator */}
      <div className="flex items-center px-6 py-3 gap-0" style={{borderBottom:`1px solid ${T.border}`,background:"#FAFAFA"}}>
        {IMPORT_STEPS.map((s,i)=>(
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{background:i<step?T.success:i===step?T.primary:T.border,color:i<=step?"#fff":T.t3}}>{i<step?<CheckCircle size={12}/>:i+1}</div>
              <span className="text-[10px] whitespace-nowrap" style={{color:i===step?T.primary:T.t4}}>{s}</span>
            </div>
            {i<IMPORT_STEPS.length-1&&<div className="flex-1 h-px mx-1 mt-[-10px]" style={{background:i<step?T.success:T.border}}/>}
          </React.Fragment>
        ))}
      </div>
      <div className="px-6 py-6 flex flex-col gap-4 overflow-y-auto" style={{minHeight:260}}>
        {step===0&&(
          <>
            <div className="flex flex-col items-center justify-center gap-4 py-8 rounded-xl" style={{border:`2px dashed ${T.border}`,background:"#FAFAFA"}}>
              <Upload size={32} style={{color:T.t4}}/>
              <div className="text-center">
                <p className="text-[13px] font-medium" style={{color:T.t2}}>拖放 JSON/YAML/CSV 文件到此处，或点击选择文件</p>
                <p className="text-[12px] mt-1" style={{color:T.t4}}>支持 .json、.yaml、.yml、.csv 格式，最大 2MB</p>
              </div>
            </div>
            <div className="flex justify-center">
              <PBtn variant="ghost" icon={FileText} onClick={()=>setStep(1)}>模拟选择文件（QA_vars_20260731.json）</PBtn>
            </div>
          </>
        )}
        {step===1&&(
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{borderColor:`${T.primary}30`,borderTopColor:T.primary}}/>
            <p className="text-[13px]" style={{color:T.t2}}>正在校验文件格式...</p>
          </div>
        )}
        {step===2&&(
          <>
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{background:"#E8F3FF",border:`1px solid ${T.primary}30`}}>
              <CheckCircle size={16} style={{color:T.primary}}/>
              <span className="text-[13px]" style={{color:T.primary}}>检测到 6 个变量，其中 2 个变量名与现有变量重复</span>
            </div>
            <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
              <table className="w-full border-collapse">
                <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide" style={{color:T.t3}}>变量名</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide" style={{color:T.t3}}>类型</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide" style={{color:T.t3}}>操作</th>
                </tr></thead>
                <tbody>
                  {PREVIEW_VARS.map((v,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${T.border}`,height:40}}>
                      <td className="px-4 py-2"><code className="text-[12px] font-mono font-semibold" style={{color:T.t1}}>{v.name}</code></td>
                      <td className="px-4 py-2"><span className="text-[11px]" style={{color:T.t3}}>{VAR_TYPE_STYLE[v.type as VarType]?.label}</span></td>
                      <td className="px-4 py-2"><span className="text-[11px] px-2 py-0.5 rounded font-semibold" style={{background:v.status==="new"?"#E8FFEA":"#FFF3E8",color:v.status==="new"?T.success:T.warning}}>{v.status==="new"?"新增":"冲突"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end"><PBtn onClick={()=>setStep(3)}>下一步：处理冲突</PBtn></div>
          </>
        )}
        {step===3&&(
          <>
            <p className="text-[13px]" style={{color:T.t2}}>以下变量与现有变量同名，请选择处理方式：</p>
            {conflicts.map(v=>(
              <div key={v.name} className="p-4 rounded-xl flex flex-col gap-3" style={{border:`1px solid ${T.border}`,background:"#FAFAFA"}}>
                <div className="flex items-center gap-2">
                  <code className="text-[13px] font-mono font-semibold" style={{color:T.t1}}>{v.name}</code>
                  <span className="text-[11px] px-2 py-0.5 rounded font-semibold" style={{background:"#FFF3E8",color:T.warning}}>冲突</span>
                </div>
                <div className="flex gap-2">
                  {([["skip","跳过（保留现有）"],["overwrite","覆盖（使用导入值）"],["rename","重命名（追加 _IMPORT 后缀）"]] as [ConflictAction,string][]).map(([a,l])=>(
                    <button key={a} onClick={()=>setConflictActions(s=>({...s,[v.name]:a}))} className="flex-1 py-2 px-3 rounded-lg text-[12px] font-medium transition-all" style={{border:`1.5px solid ${conflictActions[v.name]===a?T.primary:T.border}`,background:conflictActions[v.name]===a?`${T.primary}08`:"#fff",color:conflictActions[v.name]===a?T.primary:T.t2,cursor:"pointer"}}>{l}</button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <PBtn variant="ghost" onClick={()=>setStep(2)}>上一步</PBtn>
              <PBtn onClick={()=>setStep(4)}>确认导入</PBtn>
            </div>
          </>
        )}
        {step===4&&(
          <>
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle size={40} style={{color:T.success}}/>
              <p className="text-[15px] font-semibold" style={{color:T.t1}}>导入完成</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{background:"#E8FFEA",border:`1px solid ${T.success}40`}}>
                <CheckCircle size={14} style={{color:T.success}}/>
                <span className="text-[13px]" style={{color:T.success}}>成功新增 4 个变量</span>
              </div>
              {overwritten>0&&<div className="flex items-center gap-3 p-3 rounded-lg" style={{background:"#E8F3FF",border:`1px solid ${T.primary}40`}}>
                <CheckCircle size={14} style={{color:T.primary}}/>
                <span className="text-[13px]" style={{color:T.primary}}>覆盖更新 {overwritten} 个变量</span>
              </div>}
              {skipped>0&&<div className="flex items-center gap-3 p-3 rounded-lg" style={{background:"#F4F6FA",border:`1px solid ${T.border}`}}>
                <XCircle size={14} style={{color:T.t3}}/>
                <span className="text-[13px]" style={{color:T.t2}}>跳过 {skipped} 个变量</span>
              </div>}
            </div>
            <div className="flex justify-end">
              <PBtn onClick={()=>{onImported([]);onClose();}}>完成</PBtn>
            </div>
          </>
        )}
      </div>
    </ModalWrap>
  );
}

// ─── VarSetEditModal ──────────────────────────────────────────────────────────

function VarSetEditModal({mode,initial,onClose,onSave}:{mode:"add"|"edit";initial?:VarSet;onClose:()=>void;onSave:(vs:VarSet)=>void}){
  const[name,setName]=useState(initial?.name??"");
  const[scope,setScope]=useState(initial?.scope??"全局");
  const[desc,setDesc]=useState(initial?.description??"");
  const[enabled,setEnabled]=useState(initial?.enabled??true);
  const valid=name.trim();
  const save=()=>{
    if(!valid)return;
    const vs:VarSet={
      id:initial?.id??`vs${Date.now()}`,
      name:name.trim(),scope,description:desc,
      varCount:initial?.varCount??0,sensitiveCount:initial?.sensitiveCount??0,
      version:initial?.version??"v1.0",enabled,
      envBindCount:initial?.envBindCount??0,
      updatedAt:"2026-08-01",updatedBy:"张程远",
    };
    onSave(vs);
    onClose();
  };
  return(
    <ModalWrap onClose={onClose} width={480}>
      <MHead title={mode==="add"?"创建变量集":"编辑变量集"} onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4">
        <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>变量集名称 <span style={{color:T.danger}}>*</span></label><Inp placeholder="例：QA 公共变量集、订单模块变量集" width="100%" value={name} onChange={setName}/></div>
        <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>适用范围</label>
          <div className="flex gap-2 flex-wrap">
            {["全局","订单中心","用户中心","获客中心","风控中心","性能测试","其他"].map(s=>(
              <button key={s} onClick={()=>setScope(s)} className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all" style={{border:`1.5px solid ${scope===s?T.primary:T.border}`,background:scope===s?`${T.primary}08`:"#fff",color:scope===s?T.primary:T.t3,cursor:"pointer"}}>{s}</button>
            ))}
          </div>
        </div>
        <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>描述</label>
          <textarea placeholder="说明变量集的用途和包含内容" value={desc} onChange={e=>setDesc(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-[13px] outline-none resize-none" style={{borderColor:T.border,color:T.t1,minHeight:80}} onFocus={e=>{e.currentTarget.style.borderColor=T.primary;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
        </div>
        <div className="flex items-center gap-3"><label className="text-[12px] font-medium" style={{color:T.t2}}>是否启用</label><Toggle on={enabled} onChange={setEnabled}/><span className="text-[12px]" style={{color:T.t3}}>{enabled?"已启用":"已停用"}</span></div>
      </div>
      <div className="flex justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`,background:"#FAFAFA"}}>
        <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
        <PBtn disabled={!valid} onClick={save}>{mode==="add"?"创建变量集":"保存更改"}</PBtn>
      </div>
    </ModalWrap>
  );
}

// ─── DeleteVarSetConfirm ──────────────────────────────────────────────────────

function DeleteVarSetConfirm({vs,onClose,onConfirm}:{vs:VarSet;onClose:()=>void;onConfirm:()=>void}){
  return(
    <ModalWrap onClose={onClose} width={420}>
      <MHead title="删除变量集" onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4">
        <div className="flex items-start gap-3 p-4 rounded-xl" style={{background:"#FFE8E8",border:`1px solid ${T.danger}40`}}>
          <AlertTriangle size={18} style={{color:T.danger,flexShrink:0,marginTop:2}}/>
          <div>
            <p className="text-[13px] font-medium mb-1" style={{color:T.t1}}>确认删除变量集「{vs.name}」？</p>
            {vs.envBindCount>0&&<p className="text-[12px]" style={{color:T.danger}}>该变量集已绑定到 {vs.envBindCount} 个环境，删除后这些环境将无法使用此变量集。</p>}
            <p className="text-[12px] mt-1" style={{color:T.t2}}>此操作不可恢复。</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`,background:"#FAFAFA"}}>
        <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
        <PBtn color={T.danger} onClick={()=>{onConfirm();onClose();}}>确认删除</PBtn>
      </div>
    </ModalWrap>
  );
}

// ─── DeleteVarConfirm ─────────────────────────────────────────────────────────

function DeleteVarConfirm({varName,onClose,onConfirm}:{varName:string;onClose:()=>void;onConfirm:()=>void}){
  return(
    <ModalWrap onClose={onClose} width={400}>
      <MHead title="删除变量" onClose={onClose}/>
      <div className="px-6 py-5 flex flex-col gap-4">
        <div className="flex items-start gap-3 p-4 rounded-xl" style={{background:"#FFE8E8",border:`1px solid ${T.danger}40`}}>
          <AlertTriangle size={18} style={{color:T.danger,flexShrink:0,marginTop:2}}/>
          <p className="text-[13px]" style={{color:T.t1}}>确认删除变量「<code className="font-mono font-semibold">{varName}</code>」？此操作不可恢复。</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`,background:"#FAFAFA"}}>
        <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
        <PBtn color={T.danger} onClick={()=>{onConfirm();onClose();}}>确认删除</PBtn>
      </div>
    </ModalWrap>
  );
}

// ─── Left sidebar nav items ───────────────────────────────────────────────────

type LeftNav = {type:"global"}|{type:"varset";id:string}|{type:"builtin"};

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonRows(){
  return(
    <div className="flex-1 px-5 pb-5">
      <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#fff"}}>
        {[0,1,2].map(i=>(
          <div key={i} className="flex items-center gap-4 px-4 py-3" style={{borderBottom:i<2?`1px solid ${T.border}`:"none"}}>
            <div className="h-3 rounded" style={{width:"22%",background:"#E5E6EB",animation:"pulse 1.5s ease-in-out infinite"}}/>
            <div className="h-3 rounded" style={{width:"18%",background:"#E5E6EB",animation:"pulse 1.5s ease-in-out infinite",animationDelay:"0.1s"}}/>
            <div className="h-3 rounded" style={{width:"6%",background:"#E5E6EB",animation:"pulse 1.5s ease-in-out infinite",animationDelay:"0.2s"}}/>
            <div className="h-3 rounded" style={{width:"28%",background:"#E5E6EB",animation:"pulse 1.5s ease-in-out infinite",animationDelay:"0.15s"}}/>
            <div className="h-3 rounded" style={{width:"8%",background:"#E5E6EB",animation:"pulse 1.5s ease-in-out infinite"}}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GlobalVarsPanel ─────────────────────────────────────────────────────────

function GlobalVarsPanel({
  loading,loadError,vars,onSetVars,showToast,
  onAddVar,onEditVar,onDeleteVar,onRevealSensitive,onImport,onExport,
}:{
  loading:boolean;loadError:boolean;vars:GlobalVar[];
  onSetVars:(fn:(prev:GlobalVar[])=>GlobalVar[])=>void;
  showToast:(msg:string,type?:ToastItem["type"])=>void;
  onAddVar:()=>void;onEditVar:(v:GlobalVar)=>void;
  onDeleteVar:(v:GlobalVar)=>void;onRevealSensitive:(v:GlobalVar)=>void;
  onImport:()=>void;onExport:()=>void;
}){
  const[search,setSearch]=useState("");
  const[typeFilter,setTypeFilter]=useState("all");

  const filtered=vars.filter(v=>
    (!search||v.name.toLowerCase().includes(search.toLowerCase())||v.description.includes(search))&&
    (typeFilter==="all"||v.type===typeFilter)
  );

  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-[15px] font-semibold" style={{color:T.t1}}>全局变量</h2>
            <p className="text-[12px] mt-0.5" style={{color:T.t3}}>工作区级别共享变量，所有测试环境和场景均可引用，优先级最低</p>
          </div>
          <div className="flex items-center gap-2">
            <PBtn variant="ghost" icon={Download} onClick={onExport}>导出</PBtn>
            <PBtn variant="ghost" icon={Upload} onClick={onImport}>导入</PBtn>
            <PBtn icon={Plus} onClick={onAddVar}>添加变量</PBtn>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Inp placeholder="搜索变量名或描述" prefix={<Search size={12}/>} width={220} value={search} onChange={setSearch}/>
          <Sel width={110} value={typeFilter} onChange={setTypeFilter}>
            <option value="all">全部类型</option>
            {(Object.keys(VAR_TYPE_STYLE) as VarType[]).map(t=><option key={t} value={t}>{VAR_TYPE_STYLE[t].label}</option>)}
          </Sel>
          <Sel width={100}><option>全部状态</option><option>已启用</option><option>已停用</option></Sel>
          <div className="flex-1"/>
          <span className="text-[12px]" style={{color:T.t3}}>共 {vars.length} 个变量，其中 {vars.filter(v=>v.sensitive).length} 个敏感</span>
        </div>
      </div>
      {loading?<SkeletonRows/>:loadError?(
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <AlertTriangle size={36} style={{color:T.warning}}/>
          <p className="text-[13px]" style={{color:T.t2}}>加载失败，请重试</p>
          <PBtn variant="ghost" icon={RotateCcw} onClick={()=>{}}>重试</PBtn>
        </div>
      ):(
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {vars.length===0?(
            <div className="flex flex-col items-center justify-center py-16" style={{color:T.t4}}>
              <Variable size={36} className="mb-3"/>
              <p className="text-[13px]" style={{color:T.t3}}>暂无变量，点击「添加变量」创建第一个变量</p>
            </div>
          ):(
            <>
              <ETable total={filtered.length} cols={[{label:"变量名",width:"24%"},{label:"值",width:"22%"},{label:"类型",width:"8%"},{label:"说明",width:"22%"},{label:"状态",width:"7%"},{label:"更新",width:"11%"},{label:"操作",width:"6%",align:"right"}]}>
                {filtered.map(v=>{
                  const ts=VAR_TYPE_STYLE[v.type];
                  return(
                    <TR key={v.id}>
                      <TD>
                        <div className="flex items-center gap-2">
                          {v.sensitive&&<Lock size={11} style={{color:T.danger,flexShrink:0}}/>}
                          <code className="text-[12px] font-mono font-semibold" style={{color:T.t1}}>{v.name}</code>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-1.5">
                          {v.sensitive?(
                            <>
                              <code className="text-[12px] font-mono" style={{color:T.t3}}>••••••••••••</code>
                              <button onClick={()=>onRevealSensitive(v)} title="查看" className="w-5 h-5 flex items-center justify-center rounded" style={{color:T.t4,background:"none",border:"none",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.color=T.t1} onMouseLeave={e=>e.currentTarget.style.color=T.t4}><Eye size={11}/></button>
                            </>
                          ):(
                            <code className="text-[12px] font-mono truncate max-w-[160px]" style={{color:T.t2}}>{v.value}</code>
                          )}
                        </div>
                      </TD>
                      <TD><span className="text-[11px] px-1.5 py-0.5 rounded font-semibold" style={{background:ts.bg,color:ts.color}}>{ts.label}</span></TD>
                      <TD muted><span className="text-[12px] truncate block" style={{maxWidth:180}}>{v.description||"—"}</span></TD>
                      <TD><Toggle on={v.enabled} onChange={on=>onSetVars(a=>a.map(x=>x.id===v.id?{...x,enabled:on}:x))}/></TD>
                      <TD muted>
                        <div className="text-[11px]">{v.updatedAt}</div>
                        <div className="text-[10px]" style={{color:T.t4}}>{v.updatedBy}</div>
                      </TD>
                      <TD align="right"><div className="flex justify-end"><IBtn icon={Edit2} label="编辑" onClick={()=>onEditVar(v)}/><IBtn icon={Trash2} label="删除" danger onClick={()=>onDeleteVar(v)}/></div></TD>
                    </TR>
                  );
                })}
              </ETable>
              {filtered.length===0&&search&&(
                <div className="flex flex-col items-center justify-center py-16" style={{color:T.t4}}>
                  <Variable size={36} className="mb-3"/>
                  <p className="text-[13px]" style={{color:T.t3}}>未找到匹配的变量</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── VarSetDetailPanel ────────────────────────────────────────────────────────

function VarSetDetailPanel({
  vs,items,loading,
  onEditVarSet,onDeleteVarSet,onAddItem,onEditItem,onDeleteItem,onRevealSensitive,onExport,onSetItems,
}:{
  vs:VarSet;items:VarSetItem[];loading:boolean;
  onEditVarSet:()=>void;onDeleteVarSet:()=>void;
  onAddItem:()=>void;onEditItem:(item:VarSetItem)=>void;
  onDeleteItem:(item:VarSetItem)=>void;onRevealSensitive:(item:VarSetItem)=>void;
  onExport:()=>void;onSetItems:(fn:(prev:VarSetItem[])=>VarSetItem[])=>void;
}){
  const[search,setSearch]=useState("");
  const filtered=items.filter(v=>!search||v.name.toLowerCase().includes(search.toLowerCase()));

  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-5 pt-5 pb-3" style={{borderBottom:`1px solid ${T.border}`,background:"#fff"}}>
        <div className="flex items-start gap-4 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:`${T.primary}12`}}>
            <Layers size={20} style={{color:T.primary}}/>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <h2 className="text-[16px] font-bold" style={{color:T.t1}}>{vs.name}</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{background:"#F2F3F5",color:T.t3}}>{vs.scope}</span>
              {!vs.enabled&&<span className="text-[11px] px-2 py-0.5 rounded-full" style={{background:"#FFE8E8",color:T.danger}}>已停用</span>}
            </div>
            <div className="flex items-center gap-4 text-[12px] flex-wrap">
              <span style={{color:T.t3}}>{vs.description||"暂无描述"}</span>
              <span style={{color:T.t4}}>·</span>
              <span style={{color:T.t3}}>{vs.varCount} 个变量</span>
              {vs.sensitiveCount>0&&<><span style={{color:T.t4}}>·</span><span style={{color:T.danger}}>{vs.sensitiveCount} 个敏感</span></>}
              <span style={{color:T.t4}}>·</span>
              <span style={{color:T.t3}}>引用 {vs.envBindCount} 个环境</span>
              <span style={{color:T.t4}}>·</span>
              <span style={{color:T.t3}}>最后更新: {vs.updatedAt} 由 {vs.updatedBy}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PBtn variant="ghost" icon={Download} onClick={onExport}>导出</PBtn>
            <PBtn variant="ghost" icon={Edit2} onClick={onEditVarSet}>编辑</PBtn>
            <IBtn icon={Trash2} label="删除变量集" danger onClick={onDeleteVarSet}/>
            <PBtn icon={Plus} onClick={onAddItem}>添加变量</PBtn>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Inp placeholder="搜索变量名" prefix={<Search size={12}/>} width={200} value={search} onChange={setSearch}/>
          <Sel width={110}><option>全部类型</option>{(Object.keys(VAR_TYPE_STYLE) as VarType[]).map(t=><option key={t}>{VAR_TYPE_STYLE[t].label}</option>)}</Sel>
          <Sel width={100}><option>全部状态</option><option>已启用</option><option>已停用</option></Sel>
        </div>
      </div>
      {loading?<SkeletonRows/>:(
        <div className="flex-1 overflow-y-auto p-5">
          {filtered.length===0?(
            <div className="flex flex-col items-center justify-center py-16" style={{color:T.t4}}>
              <Variable size={36} className="mb-3"/>
              <p className="text-[13px]" style={{color:T.t3}}>{search?"未找到匹配的变量":"此变量集暂无变量"}</p>
            </div>
          ):(
            <ETable total={filtered.length} cols={[{label:"变量名",width:"24%"},{label:"值",width:"24%"},{label:"类型",width:"8%"},{label:"说明"},{label:"状态",width:"7%"},{label:"操作",width:"10%",align:"right"}]}>
              {filtered.map(v=>{
                const ts=VAR_TYPE_STYLE[v.type];
                return(
                  <TR key={v.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        {v.sensitive&&<Lock size={11} style={{color:T.danger,flexShrink:0}}/>}
                        <code className="text-[12px] font-mono font-semibold" style={{color:T.t1}}>{v.name}</code>
                      </div>
                    </TD>
                    <TD>
                      {v.sensitive?(
                        <div className="flex items-center gap-1.5">
                          <code className="text-[12px] font-mono" style={{color:T.t3}}>••••••••</code>
                          <button onClick={()=>onRevealSensitive(v)} title="查看" className="w-5 h-5 flex items-center justify-center rounded" style={{color:T.t4,background:"none",border:"none",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.color=T.t1} onMouseLeave={e=>e.currentTarget.style.color=T.t4}><Eye size={11}/></button>
                        </div>
                      ):(
                        <code className="text-[12px] font-mono truncate block" style={{color:T.t2,maxWidth:180}}>{v.value}</code>
                      )}
                    </TD>
                    <TD><span className="text-[11px] px-1.5 py-0.5 rounded font-semibold" style={{background:ts.bg,color:ts.color}}>{ts.label}</span></TD>
                    <TD muted>{v.description||"—"}</TD>
                    <TD><Toggle on={v.enabled} onChange={on=>onSetItems(a=>a.map(x=>x.id===v.id?{...x,enabled:on}:x))}/></TD>
                    <TD align="right"><div className="flex justify-end"><IBtn icon={Edit2} label="编辑" onClick={()=>onEditItem(v)}/><IBtn icon={Copy} label="复制" onClick={()=>{}}/><IBtn icon={Trash2} label="删除" danger onClick={()=>onDeleteItem(v)}/></div></TD>
                  </TR>
                );
              })}
            </ETable>
          )}
        </div>
      )}
    </div>
  );
}

// ─── BuiltinPanel ─────────────────────────────────────────────────────────────

function BuiltinPanel(){
  const[search,setSearch]=useState("");
  const[expanded,setExpanded]=useState<Set<string>>(new Set(["faker","datetime"]));
  const toggle=(id:string)=>setExpanded(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n;});
  const filtered=BUILTIN_CATEGORIES.map(cat=>({
    ...cat,
    items:cat.items.filter(i=>!search||i.name.toLowerCase().includes(search.toLowerCase())||i.desc.includes(search)||i.syntax.includes(search)),
  })).filter(cat=>!search||cat.items.length>0);
  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[15px] font-semibold" style={{color:T.t1}}>内置 & 动态函数</h2>
            <p className="text-[12px] mt-0.5" style={{color:T.t3}}>只读参考手册。在变量值或响应 Body 中使用 {"{{函数名}}"} 语法调用</p>
          </div>
        </div>
        <Inp placeholder="搜索函数名、说明" prefix={<Search size={12}/>} width={240} value={search} onChange={setSearch}/>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5 flex flex-col gap-3">
        {filtered.map(cat=>{
          const Icon=cat.icon;const isOpen=expanded.has(cat.id)||!!search;
          return(
            <div key={cat.id} className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#fff"}}>
              <button onClick={()=>toggle(cat.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left" style={{background:isOpen?`${cat.color}08`:"#fff",border:"none",cursor:"pointer"}}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:cat.bg}}>
                  <Icon size={15} style={{color:cat.color}}/>
                </div>
                <div className="flex-1">
                  <span className="text-[13px] font-semibold" style={{color:T.t1}}>{cat.label}</span>
                  <span className="text-[12px] ml-2" style={{color:T.t4}}>{cat.items.length} 个函数</span>
                </div>
                {isOpen?<ChevronDown size={14} style={{color:T.t3}}/>:<ChevronRight size={14} style={{color:T.t3}}/>}
              </button>
              {isOpen&&(
                <div style={{borderTop:`1px solid ${T.border}`}}>
                  <div className="grid text-[11px] font-semibold uppercase tracking-wide px-4 py-2" style={{gridTemplateColumns:"200px 1fr 1fr 140px",gap:"0 16px",background:"#FAFAFA",color:T.t3}}>
                    <span>函数名</span><span>语法</span><span>说明</span><span>示例输出</span>
                  </div>
                  {cat.items.map((item,i)=>(
                    <div key={i} className="grid items-center px-4 py-3" style={{gridTemplateColumns:"200px 1fr 1fr 140px",gap:"0 16px",borderTop:`1px solid ${T.border}`}}
                      onMouseEnter={e=>e.currentTarget.style.background="#FAFBFF"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                      <span className="text-[12px] font-mono font-semibold" style={{color:cat.color}}>{item.name}</span>
                      <code className="text-[11px] font-mono px-2 py-0.5 rounded w-fit" style={{background:`${cat.color}10`,color:cat.color}}>{item.syntax}</code>
                      <span className="text-[12px]" style={{color:T.t2}}>{item.desc}</span>
                      <code className="text-[11px] font-mono" style={{color:T.t3}}>{item.example}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function VarConfigPage(){
  const{items:toasts,show:showToast}=useToast();
  const[loading,setLoading]=useState(true);
  const[loadError,setLoadError]=useState(false);

  const[globalVars,setGlobalVars]=useState<GlobalVar[]>(GLOBAL_VARS);
  const[varSets,setVarSets]=useState<VarSet[]>(VAR_SETS);
  const[varSetItems,setVarSetItems]=useState<Record<string,VarSetItem[]>>(VAR_SET_ITEMS);

  const[showImport,setShowImport]=useState(false);
  const[sensitiveVar,setSensitiveVar]=useState<{name:string;value:string}|null>(null);
  const[varEditModal,setVarEditModal]=useState<"add"|GlobalVar|VarSetItem|null>(null);
  const[varSetEdit,setVarSetEdit]=useState<"add"|VarSet|null>(null);
  const[deleteVarSet,setDeleteVarSet]=useState<VarSet|null>(null);
  const[deleteVarItem,setDeleteVarItem]=useState<{name:string;id:string;scope:"global"|string}|null>(null);
  const[varSetItemEdit,setVarSetItemEdit]=useState<"add"|VarSetItem|null>(null);

  const[leftNav,setLeftNav]=useState<LeftNav>({type:"global"});
  const[expandVarSets,setExpandVarSets]=useState(true);

  useEffect(()=>{
    const t=setTimeout(()=>setLoading(false),800);
    return()=>clearTimeout(t);
  },[]);

  const isGlobal=leftNav.type==="global";
  const isBuiltin=leftNav.type==="builtin";
  const activeSetId=leftNav.type==="varset"?leftNav.id:null;
  const selectedSet=activeSetId?varSets.find(s=>s.id===activeSetId):null;

  const handleExport=()=>{
    showToast("变量集已导出为 vars_export_20260801.json","success");
    const a=document.createElement("a");
    a.href="data:application/json,{}";
    a.download="vars_export_20260801.json";
    a.click();
  };

  // Global var handlers
  const handleSaveGlobalVar=(v:any)=>{
    if(varEditModal==="add"){
      setGlobalVars(a=>[...a,{...v,id:`gv${Date.now()}`}]);
      showToast("变量已添加","success");
    } else {
      setGlobalVars(a=>a.map(x=>x.id===v.id?v:x));
      showToast("变量已保存","success");
    }
  };

  // VarSet item handlers (used when viewing a varset)
  const handleSaveVarSetItem=(v:any)=>{
    if(!activeSetId)return;
    if(varSetItemEdit==="add"||varEditModal==="add"){
      setVarSetItems(m=>({...m,[activeSetId]:[...(m[activeSetId]??[]),{...v,id:`vi${Date.now()}`,setId:activeSetId}]}));
      showToast("变量已添加","success");
    } else {
      setVarSetItems(m=>({...m,[activeSetId]:(m[activeSetId]??[]).map(x=>x.id===v.id?v:x)}));
      showToast("变量已保存","success");
    }
  };

  // VarSet handlers
  const handleSaveVarSet=(vs:VarSet)=>{
    if(varSetEdit==="add"){
      setVarSets(a=>[...a,vs]);
    } else {
      setVarSets(a=>a.map(x=>x.id===vs.id?vs:x));
    }
    showToast("变量集已保存","success");
  };

  const handleDeleteVarSet=(vsId:string)=>{
    setVarSets(a=>a.filter(x=>x.id!==vsId));
    if(activeSetId===vsId)setLeftNav({type:"global"});
    showToast("变量集已删除","success");
  };

  const handleDeleteVarItem=()=>{
    if(!deleteVarItem)return;
    if(deleteVarItem.scope==="global"){
      setGlobalVars(a=>a.filter(x=>x.id!==deleteVarItem.id));
    } else {
      const sid=deleteVarItem.scope;
      setVarSetItems(m=>({...m,[sid]:(m[sid]??[]).filter(x=>x.id!==deleteVarItem.id)}));
    }
    showToast("变量已删除","success");
  };

  const activeItems=activeSetId?(varSetItems[activeSetId]??[]):[];

  return(
    <div className="flex flex-1 overflow-hidden" style={{background:T.bg}}>
      {/* Left sidebar */}
      <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:252,background:"#fff",borderRight:`1px solid ${T.border}`}}>
        {/* Search */}
        <div style={{padding:"14px 12px 10px",flexShrink:0}}>
          <div style={{position:"relative"}}>
            <Search size={13} style={{position:"absolute",left:10,top:10,color:T.t4,pointerEvents:"none"}}/>
            <input placeholder="搜索变量和函数…" style={{
              width:"100%",height:34,paddingLeft:32,paddingRight:10,
              border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,
              color:T.t1,background:"#FAFBFE",outline:"none",boxSizing:"border-box" as const,
            }}
              onFocus={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.background="#fff";}}
              onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background="#FAFBFE";}}
            />
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"2px 8px 16px"}}>
          {/* Global vars */}
          {(()=>{
            const ac=isGlobal;const col=T.primary;
            return(
              <button onClick={()=>setLeftNav({type:"global"})}
                style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 10px",
                  borderRadius:9,border:"none",cursor:"pointer",textAlign:"left" as const,marginBottom:2,
                  background:ac?`${col}08`:"transparent",position:"relative" as const}}
                onMouseEnter={e=>!ac&&(e.currentTarget.style.background="#F4F6FA")}
                onMouseLeave={e=>!ac&&(e.currentTarget.style.background="transparent")}>
                {ac&&<div style={{position:"absolute",left:0,top:8,bottom:8,width:3,borderRadius:2,background:col}}/>}
                <div style={{width:32,height:32,borderRadius:9,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                  background:ac?col:`${col}12`}}>
                  <Globe size={16} style={{color:ac?"#fff":col}}/>
                </div>
                <span style={{flex:1,fontSize:13,fontWeight:ac?600:500,color:ac?col:T.t2}}>全局变量</span>
                <span style={{fontSize:11,fontWeight:600,color:ac?col:T.t4}}>{globalVars.length}</span>
              </button>
            );
          })()}

          {/* Var sets section */}
          <div style={{marginTop:6}}>
            <div style={{display:"flex",alignItems:"center",gap:2,padding:"6px 4px 4px"}}>
              <button onClick={()=>setExpandVarSets(e=>!e)}
                style={{display:"flex",alignItems:"center",gap:4,flex:1,background:"none",border:"none",
                  cursor:"pointer",padding:"3px 4px",borderRadius:5}}
                onMouseEnter={e=>(e.currentTarget.style.background="#F4F6FA")}
                onMouseLeave={e=>(e.currentTarget.style.background="none")}>
                {expandVarSets
                  ?<ChevronDown size={11} style={{color:T.t4}}/>
                  :<ChevronRight size={11} style={{color:T.t4}}/>}
                <span style={{fontSize:10,fontWeight:700,color:T.t4,letterSpacing:"0.07em",textTransform:"uppercase" as const}}>变量集</span>
                <span style={{fontSize:10,color:T.t4,marginLeft:3}}>{varSets.length}</span>
              </button>
              <button title="新建变量集" onClick={()=>setVarSetEdit("add")}
                style={{width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",
                  borderRadius:6,color:T.t4,background:"none",border:"none",cursor:"pointer"}}
                onMouseEnter={e=>{e.currentTarget.style.color=T.primary;e.currentTarget.style.background=`${T.primary}12`;}}
                onMouseLeave={e=>{e.currentTarget.style.color=T.t4;e.currentTarget.style.background="";}}>
                <Plus size={13}/>
              </button>
            </div>

            {expandVarSets&&varSets.map(vs=>{
              const ac=activeSetId===vs.id;
              return(
                <button key={vs.id} onClick={()=>setLeftNav({type:"varset",id:vs.id})}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px 8px 14px",
                    borderRadius:9,marginBottom:2,border:"none",cursor:"pointer",textAlign:"left" as const,
                    background:ac?`${T.primary}08`:"transparent",position:"relative" as const}}
                  onMouseEnter={e=>!ac&&(e.currentTarget.style.background="#F4F6FA")}
                  onMouseLeave={e=>!ac&&(e.currentTarget.style.background="transparent")}>
                  {ac&&<div style={{position:"absolute",left:0,top:6,bottom:6,width:3,borderRadius:2,background:T.primary}}/>}
                  <div style={{width:6,height:6,borderRadius:"50%",flexShrink:0,
                    background:ac?T.primary:T.t4}}/>
                  <span style={{flex:1,fontSize:13,fontWeight:ac?600:400,color:ac?T.primary:T.t2,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{vs.name}</span>
                </button>
              );
            })}
          </div>

          {/* Builtin */}
          <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.border}`}}>
            {(()=>{
              const ac=isBuiltin;const col=T.purple;
              return(
                <button onClick={()=>setLeftNav({type:"builtin"})}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 10px",
                    borderRadius:9,border:"none",cursor:"pointer",textAlign:"left" as const,
                    background:ac?`${col}08`:"transparent",position:"relative" as const}}
                  onMouseEnter={e=>!ac&&(e.currentTarget.style.background="#F4F6FA")}
                  onMouseLeave={e=>!ac&&(e.currentTarget.style.background="transparent")}>
                  {ac&&<div style={{position:"absolute",left:0,top:8,bottom:8,width:3,borderRadius:2,background:col}}/>}
                  <div style={{width:32,height:32,borderRadius:9,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                    background:ac?col:`${col}12`}}>
                    <Zap size={16} style={{color:ac?"#fff":col}}/>
                  </div>
                  <span style={{flex:1,fontSize:13,fontWeight:ac?600:500,color:ac?col:T.t2}}>内置 & 动态函数</span>
                </button>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {isGlobal&&(
          <GlobalVarsPanel
            loading={loading} loadError={loadError}
            vars={globalVars} onSetVars={setGlobalVars}
            showToast={showToast}
            onAddVar={()=>setVarEditModal("add")}
            onEditVar={v=>setVarEditModal(v)}
            onDeleteVar={v=>setDeleteVarItem({name:v.name,id:v.id,scope:"global"})}
            onRevealSensitive={v=>setSensitiveVar({name:v.name,value:v.value})}
            onImport={()=>setShowImport(true)}
            onExport={handleExport}
          />
        )}
        {activeSetId&&selectedSet&&(
          <VarSetDetailPanel
            vs={selectedSet}
            items={activeItems}
            loading={loading}
            onEditVarSet={()=>setVarSetEdit(selectedSet)}
            onDeleteVarSet={()=>setDeleteVarSet(selectedSet)}
            onAddItem={()=>setVarSetItemEdit("add")}
            onEditItem={item=>setVarSetItemEdit(item)}
            onDeleteItem={item=>setDeleteVarItem({name:item.name,id:item.id,scope:activeSetId})}
            onRevealSensitive={item=>setSensitiveVar({name:item.name,value:item.value})}
            onExport={handleExport}
            onSetItems={fn=>setVarSetItems(m=>({...m,[activeSetId]:fn(m[activeSetId]??[])}))}
          />
        )}
        {isBuiltin&&<BuiltinPanel/>}
      </div>

      {/* Modals */}
      {showImport&&(
        <ImportFlowModal onClose={()=>setShowImport(false)} onImported={()=>showToast("变量导入完成","success")}/>
      )}
      {sensitiveVar&&(
        <SensitiveRevealModal varName={sensitiveVar.name} maskedValue={sensitiveVar.value} onClose={()=>setSensitiveVar(null)}/>
      )}
      {varEditModal!==null&&isGlobal&&(
        <VarEditModal
          mode={varEditModal==="add"?"add":"edit"}
          initial={varEditModal==="add"?undefined:varEditModal as GlobalVar}
          onClose={()=>setVarEditModal(null)}
          onSave={handleSaveGlobalVar}
        />
      )}
      {varSetItemEdit!==null&&(
        <VarEditModal
          mode={varSetItemEdit==="add"?"add":"edit"}
          initial={varSetItemEdit==="add"?undefined:varSetItemEdit as VarSetItem}
          onClose={()=>setVarSetItemEdit(null)}
          onSave={handleSaveVarSetItem}
        />
      )}
      {varSetEdit!==null&&(
        <VarSetEditModal
          mode={varSetEdit==="add"?"add":"edit"}
          initial={varSetEdit==="add"?undefined:varSetEdit as VarSet}
          onClose={()=>setVarSetEdit(null)}
          onSave={handleSaveVarSet}
        />
      )}
      {deleteVarSet&&(
        <DeleteVarSetConfirm
          vs={deleteVarSet}
          onClose={()=>setDeleteVarSet(null)}
          onConfirm={()=>handleDeleteVarSet(deleteVarSet.id)}
        />
      )}
      {deleteVarItem&&(
        <DeleteVarConfirm
          varName={deleteVarItem.name}
          onClose={()=>setDeleteVarItem(null)}
          onConfirm={handleDeleteVarItem}
        />
      )}
      <ToastList items={toasts}/>
    </div>
  );
}
