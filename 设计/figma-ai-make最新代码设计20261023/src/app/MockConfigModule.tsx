import React,{useState} from "react";
import {
  Search,Plus,Edit2,Trash2,Copy,X,CheckCircle,XCircle,AlertTriangle,
  Activity,Globe,Layers,Play,Upload,Download,RefreshCw,Eye,Power,
  ArrowUpRight,ChevronDown,ChevronRight,Minus,Zap,
} from "lucide-react";

const T={primary:"#165DFF",success:"#00B42A",warning:"#FF7D00",danger:"#F53F3F",purple:"#7816FF",cyan:"#0FC6C2",slate:"#4E5969",bg:"#F4F6FA",border:"#E5E6EB",t1:"#1D2129",t2:"#4E5969",t3:"#86909C",t4:"#C9CDD4"};

function PBtn({children,onClick,icon:Icon,small,color=T.primary,variant="primary",className}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;variant?:"primary"|"ghost";className?:string}){
  if(variant==="ghost") return <button onClick={onClick} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium bg-white transition-colors ${className??""}`} style={{borderColor:T.border,color:T.t2}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.color=T.primary;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.t2;}}>{Icon&&<Icon size={13}/>}{children}</button>;
  return <button onClick={onClick} className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-all active:scale-[0.98] ${className??""}`} style={{backgroundColor:color,color:"#fff",height:small?28:32,padding:small?"0 10px":"0 14px",fontSize:small?12:13}} onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.1)"} onMouseLeave={e=>e.currentTarget.style.filter=""}>{Icon&&<Icon size={small?12:13}/>}{children}</button>;
}
function IBtn({icon:Icon,label,danger,onClick}:{icon:React.ElementType;label:string;danger?:boolean;onClick?:()=>void}){return <button title={label} onClick={e=>{e.stopPropagation();onClick?.();}} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{color:T.t4}} onMouseEnter={e=>{e.currentTarget.style.color=danger?T.danger:T.t1;e.currentTarget.style.backgroundColor=danger?"#FFF0F0":"#F2F3F5";}} onMouseLeave={e=>{e.currentTarget.style.color=T.t4;e.currentTarget.style.backgroundColor="transparent";}}><Icon size={13}/></button>;}
function IcoSquare({color,bg,size=32,children}:{color:string;bg:string;size?:number;children:React.ReactNode}){return <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{width:size,height:size,backgroundColor:bg}}><span style={{color,display:"flex"}}>{children}</span></div>;}
function Inp({placeholder,type="text",prefix,mono,width,value,onChange}:{placeholder?:string;type?:string;prefix?:React.ReactNode;mono?:boolean;width?:string|number;value?:string;onChange?:(v:string)=>void}){return <div className="relative flex items-center" style={{width}}>{prefix&&<span className="absolute left-2.5 pointer-events-none" style={{color:T.t3}}>{prefix}</span>}<input type={type} placeholder={placeholder} value={value} onChange={e=>onChange?.(e.target.value)} className={`h-8 border rounded-lg bg-white text-[13px] outline-none transition-all w-full ${prefix?"pl-8 pr-3":"px-3"} ${mono?"font-mono text-[12px]":""}`} style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.primary}18`;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/></div>;}
function Sel({children,width=130}:{children:React.ReactNode;width?:string|number}){return <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width}}>{children}</select>;}
function Toggle({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}){return <button onClick={()=>onChange(!on)} className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0" style={{backgroundColor:on?T.primary:"#C9CDD4"}}><span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all" style={{left:on?"calc(100% - 14px)":"2px"}}/></button>;}
function StatusDot({status,label}:{status:string;label?:string}){
  const M:Record<string,{dot:string;text:string;tc:string}>={enabled:{dot:T.success,text:"已启用",tc:T.t2},disabled:{dot:T.t4,text:"已停用",tc:T.t3}};
  const c=M[status]??M.disabled;
  return <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor:c.dot}}/><span className="text-[12px]" style={{color:c.tc}}>{label??c.text}</span></span>;
}
interface Col{label:string;width?:string;align?:"left"|"right"|"center"}
function ETable({cols,children,total}:{cols:Col[];children:React.ReactNode;total?:number}){const[page,setPage]=useState(1);const pages=total?Math.max(1,Math.ceil(total/10)):1;return <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}><table className="w-full border-collapse"><thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>{cols.map((c,i)=><th key={i} style={{width:c.width,textAlign:c.align??"left",color:T.t3}} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">{c.label}</th>)}</tr></thead><tbody>{children}</tbody></table>{total!==undefined&&<div className="flex items-center justify-between px-4 py-2.5" style={{borderTop:`1px solid ${T.border}`}}><span className="text-[12px]" style={{color:T.t3}}>共 {total} 条</span><div className="flex items-center gap-1">{Array.from({length:pages}).map((_,i)=><button key={i} onClick={()=>setPage(i+1)} className="w-7 h-7 rounded-md text-[12px] font-medium" style={{backgroundColor:page===i+1?T.primary:"transparent",color:page===i+1?"#fff":T.t2,border:`1px solid ${page===i+1?T.primary:T.border}`}}>{i+1}</button>)}</div></div>}</div>;}
function TR({children,active,onClick}:{children:React.ReactNode;active?:boolean;onClick?:()=>void}){return <tr onClick={onClick} className="border-b last:border-b-0 transition-colors" style={{borderColor:T.border,height:46,backgroundColor:active?`${T.primary}08`:"",cursor:onClick?"pointer":"default"}} onMouseEnter={e=>!active&&(e.currentTarget.style.backgroundColor="#FAFBFF")} onMouseLeave={e=>!active&&(e.currentTarget.style.backgroundColor="")}>{children}</tr>;}
function TD({children,align="left",mono,muted}:{children?:React.ReactNode;align?:"left"|"right"|"center";mono?:boolean;muted?:boolean}){return <td className={`px-4 py-2 text-[13px] ${mono?"font-mono text-[12px]":""}`} style={{textAlign:align,color:muted?T.t3:T.t1}}>{children}</td>;}

// ─── Types ────────────────────────────────────────────────────────────────────

type MockAppStatus="draft"|"published"|"disabled"|"error"|"modified";
type MockPublishStatus="published"|"draft"|"unpublished";
type MockMethod="GET"|"POST"|"PUT"|"DELETE"|"PATCH"|"ANY";
type MockMatchResult="hit"|"miss"|"error";

interface MockApp{id:string;name:string;code:string;status:MockAppStatus;version:string;ifaceCount:number;sceneCount:number;envCount:number;todayCalls:number;unmatchedCount:number;lastPublished:string;updatedBy:string;baseUrl:string;authEnabled:boolean;defaultDelay:number;unmatchedPolicy:"strict-fail"|"passthrough"|"empty";}
interface MockIface{id:string;appId:string;name:string;method:MockMethod;path:string;sceneCount:number;defaultScene:string;unmatchedPolicy:"strict-fail"|"passthrough"|"empty";enabled:boolean;publishStatus:MockPublishStatus;updatedAt:string;}
interface MockScene{id:string;ifaceId:string;name:string;priority:number;statusCode:number;delay:number;isDefault:boolean;enabled:boolean;publishStatus:MockPublishStatus;updatedAt:string;conditions:number;}
interface MockRelease{id:string;appId:string;version:string;publishedAt:string;publishedBy:string;note:string;ifaceCount:number;sceneCount:number;status:"active"|"superseded"|"disabled";envRefs:string[];}
interface MockEnvRef{id:string;appId:string;envName:string;version:string;enabled:boolean;unmatchedPolicy:"strict-fail"|"passthrough"|"empty";lastUsed:string;taskCount:number;}
interface MockLog{id:string;time:string;appName:string;ifaceName:string;method:MockMethod;path:string;hitScene:string|null;version:string;matchResult:MockMatchResult;statusCode:number;responseTime:number;task:string|null;sourceIp:string;}

// ─── Data ─────────────────────────────────────────────────────────────────────

const MOCK_APPS:MockApp[]=[
  {id:"ma1",name:"订单中心 Mock",code:"order-mock",status:"published",version:"v1.4.2",ifaceCount:18,sceneCount:46,envCount:2,todayCalls:1284,unmatchedCount:3,lastPublished:"2026-07-28 14:30",updatedBy:"张程远",baseUrl:"https://mock.test.internal/order-mock",authEnabled:true,defaultDelay:50,unmatchedPolicy:"strict-fail"},
  {id:"ma2",name:"用户中心 Mock",code:"user-mock",status:"modified",version:"v2.1.0",ifaceCount:12,sceneCount:31,envCount:1,todayCalls:562,unmatchedCount:0,lastPublished:"2026-07-25 09:15",updatedBy:"王芳",baseUrl:"https://mock.test.internal/user-mock",authEnabled:false,defaultDelay:30,unmatchedPolicy:"strict-fail"},
  {id:"ma3",name:"支付网关 Mock",code:"payment-mock",status:"published",version:"v0.9.1",ifaceCount:7,sceneCount:19,envCount:3,todayCalls:338,unmatchedCount:12,lastPublished:"2026-07-20 17:45",updatedBy:"李明",baseUrl:"https://mock.test.internal/payment-mock",authEnabled:true,defaultDelay:100,unmatchedPolicy:"passthrough"},
  {id:"ma4",name:"风控引擎 Mock",code:"risk-mock",status:"draft",version:"—",ifaceCount:4,sceneCount:8,envCount:0,todayCalls:0,unmatchedCount:0,lastPublished:"—",updatedBy:"陈伟",baseUrl:"https://mock.test.internal/risk-mock",authEnabled:false,defaultDelay:20,unmatchedPolicy:"strict-fail"},
  {id:"ma5",name:"短信网关 Mock",code:"sms-mock",status:"disabled",version:"v1.0.0",ifaceCount:3,sceneCount:6,envCount:0,todayCalls:0,unmatchedCount:0,lastPublished:"2026-06-01 10:00",updatedBy:"王芳",baseUrl:"https://mock.test.internal/sms-mock",authEnabled:false,defaultDelay:200,unmatchedPolicy:"empty"},
];
const MOCK_IFACES:MockIface[]=[
  {id:"mi1",appId:"ma1",name:"创建订单",method:"POST",path:"/api/v1/orders",sceneCount:5,defaultScene:"正常创建成功",unmatchedPolicy:"strict-fail",enabled:true,publishStatus:"published",updatedAt:"2026-07-28 14:20"},
  {id:"mi2",appId:"ma1",name:"查询订单详情",method:"GET",path:"/api/v1/orders/{id}",sceneCount:4,defaultScene:"正常返回",unmatchedPolicy:"strict-fail",enabled:true,publishStatus:"published",updatedAt:"2026-07-28 14:20"},
  {id:"mi3",appId:"ma1",name:"更新订单状态",method:"PUT",path:"/api/v1/orders/{id}/status",sceneCount:3,defaultScene:"状态更新成功",unmatchedPolicy:"strict-fail",enabled:true,publishStatus:"draft",updatedAt:"2026-07-29 10:05"},
  {id:"mi4",appId:"ma1",name:"申请退款",method:"POST",path:"/api/v1/orders/{id}/refund",sceneCount:6,defaultScene:"退款申请成功",unmatchedPolicy:"strict-fail",enabled:true,publishStatus:"published",updatedAt:"2026-07-28 14:20"},
  {id:"mi5",appId:"ma1",name:"获取订单列表",method:"GET",path:"/api/v1/orders",sceneCount:3,defaultScene:"返回列表",unmatchedPolicy:"passthrough",enabled:true,publishStatus:"published",updatedAt:"2026-07-28 14:20"},
  {id:"mi6",appId:"ma1",name:"取消订单",method:"POST",path:"/api/v1/orders/{id}/cancel",sceneCount:4,defaultScene:"取消成功",unmatchedPolicy:"strict-fail",enabled:false,publishStatus:"published",updatedAt:"2026-07-28 14:20"},
];
const MOCK_SCENES:MockScene[]=[
  {id:"ms1",ifaceId:"mi1",name:"正常创建成功",priority:100,statusCode:200,delay:50,isDefault:true,enabled:true,publishStatus:"published",updatedAt:"2026-07-28 14:00",conditions:2},
  {id:"ms2",ifaceId:"mi1",name:"库存不足",priority:80,statusCode:200,delay:30,isDefault:false,enabled:true,publishStatus:"published",updatedAt:"2026-07-28 13:50",conditions:3},
  {id:"ms3",ifaceId:"mi1",name:"金额超限触发风控",priority:70,statusCode:200,delay:50,isDefault:false,enabled:true,publishStatus:"draft",updatedAt:"2026-07-29 10:00",conditions:2},
  {id:"ms4",ifaceId:"mi1",name:"用户账号已冻结",priority:60,statusCode:403,delay:20,isDefault:false,enabled:true,publishStatus:"published",updatedAt:"2026-07-28 14:00",conditions:1},
  {id:"ms5",ifaceId:"mi1",name:"服务端异常模拟",priority:10,statusCode:500,delay:100,isDefault:false,enabled:false,publishStatus:"published",updatedAt:"2026-07-28 14:00",conditions:1},
];
const MOCK_RELEASES:MockRelease[]=[
  {id:"mr1",appId:"ma1",version:"v1.4.2",publishedAt:"2026-07-28 14:30",publishedBy:"张程远",note:"新增退款超时场景；修复订单状态更新匹配规则",ifaceCount:18,sceneCount:46,status:"active",envRefs:["测试环境","预发布环境"]},
  {id:"mr2",appId:"ma1",version:"v1.4.1",publishedAt:"2026-07-22 10:15",publishedBy:"张程远",note:"补充库存不足边界场景",ifaceCount:17,sceneCount:43,status:"superseded",envRefs:[]},
  {id:"mr3",appId:"ma1",version:"v1.4.0",publishedAt:"2026-07-15 17:00",publishedBy:"王芳",note:"创建订单接口场景重构",ifaceCount:16,sceneCount:40,status:"superseded",envRefs:[]},
];
const MOCK_ENV_REFS:MockEnvRef[]=[
  {id:"er1",appId:"ma1",envName:"测试环境",version:"v1.4.2",enabled:true,unmatchedPolicy:"strict-fail",lastUsed:"5 分钟前",taskCount:12},
  {id:"er2",appId:"ma1",envName:"预发布环境",version:"v1.4.2",enabled:true,unmatchedPolicy:"passthrough",lastUsed:"2 小时前",taskCount:3},
];
const MOCK_LOGS:MockLog[]=[
  {id:"ml1",time:"14:32:01",appName:"订单中心 Mock",ifaceName:"创建订单",method:"POST",path:"/api/v1/orders",hitScene:"正常创建成功",version:"v1.4.2",matchResult:"hit",statusCode:200,responseTime:52,task:"任务 #2341",sourceIp:"10.0.2.15"},
  {id:"ml2",time:"14:31:48",appName:"订单中心 Mock",ifaceName:"查询订单详情",method:"GET",path:"/api/v1/orders/1234",hitScene:"正常返回",version:"v1.4.2",matchResult:"hit",statusCode:200,responseTime:31,task:"任务 #2341",sourceIp:"10.0.2.15"},
  {id:"ml3",time:"14:31:22",appName:"订单中心 Mock",ifaceName:"申请退款",method:"POST",path:"/api/v1/orders/1230/refund",hitScene:null,version:"v1.4.2",matchResult:"miss",statusCode:404,responseTime:8,task:"任务 #2340",sourceIp:"10.0.2.16"},
  {id:"ml4",time:"14:30:57",appName:"支付网关 Mock",ifaceName:"发起支付",method:"POST",path:"/api/v1/pay/create",hitScene:"正常支付成功",version:"v0.9.1",matchResult:"hit",statusCode:200,responseTime:105,task:null,sourceIp:"10.0.2.15"},
  {id:"ml5",time:"14:30:31",appName:"订单中心 Mock",ifaceName:"取消订单",method:"POST",path:"/api/v1/orders/1229/cancel",hitScene:null,version:"v1.4.2",matchResult:"error",statusCode:500,responseTime:12,task:"任务 #2339",sourceIp:"10.0.2.17"},
];

// ─── Atoms ────────────────────────────────────────────────────────────────────

const MOCK_APP_ST:Record<MockAppStatus,{label:string;bg:string;color:string;dot:string}>={
  draft:{label:"草稿",bg:"#F2F3F5",color:T.t3,dot:T.t4},
  published:{label:"已发布",bg:"#E8FFEA",color:T.success,dot:T.success},
  disabled:{label:"已停用",bg:"#F2F3F5",color:T.t3,dot:T.t4},
  error:{label:"配置异常",bg:"#FFF3E8",color:T.warning,dot:T.warning},
  modified:{label:"有未发布修改",bg:"#E8F3FF",color:T.primary,dot:T.primary},
};
const MOCK_PUB_ST:Record<MockPublishStatus,{label:string;color:string;bg:string}>={
  published:{label:"已发布",color:T.success,bg:"#E8FFEA"},
  draft:{label:"草稿",color:T.t3,bg:"#F2F3F5"},
  unpublished:{label:"待发布",color:T.primary,bg:"#E8F3FF"},
};
const MOCK_MATCH:Record<MockMatchResult,{label:string;color:string;icon:React.ElementType}>={
  hit:{label:"命中",color:T.success,icon:CheckCircle},
  miss:{label:"未匹配",color:T.warning,icon:AlertTriangle},
  error:{label:"异常",color:T.danger,icon:XCircle},
};
const MOCK_METHOD_COLOR:Record<string,{color:string;bg:string}>={
  GET:{color:"#00B42A",bg:"#E8FFEA"},POST:{color:"#FF7D00",bg:"#FFF3E8"},PUT:{color:"#165DFF",bg:"#E8F3FF"},
  DELETE:{color:"#F53F3F",bg:"#FFE8E8"},PATCH:{color:"#7816FF",bg:"#F5E8FF"},ANY:{color:"#4E5969",bg:"#F2F3F5"},
};
const UNMATCHED_LABEL:Record<string,string>={"strict-fail":"严格失败","passthrough":"透传真实服务","empty":"返回空响应"};

function MockMethodBadge({method}:{method:string}){
  const s=MOCK_METHOD_COLOR[method]??MOCK_METHOD_COLOR.ANY;
  return <span className="inline-block text-[10px] font-bold rounded px-1.5 py-px" style={{background:s.bg,color:s.color,minWidth:46,textAlign:"center"}}>{method}</span>;
}

// ─── Scene Editor Drawer ──────────────────────────────────────────────────────

function MockSceneEditor({scene,iface,onClose}:{scene:MockScene|null;iface:MockIface|null;onClose:()=>void}){
  const[editorTab,setEditorTab]=useState<"match"|"response"|"vars">("match");
  const[matchMode,setMatchMode]=useState<"simple"|"advanced">("simple");
  if(!scene||!iface) return null;

  const matchConditions=[
    {type:"Query",field:"userId",op:"存在",value:""},
    {type:"Body.JSON",field:"amount",op:"大于",value:"0"},
    {type:"Header",field:"X-Tenant",op:"等于",value:"test-env"},
  ];

  return(
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1" style={{background:"rgba(29,33,41,0.4)"}} onClick={onClose}/>
      <div className="flex flex-col" style={{width:760,background:"#fff",boxShadow:"-4px 0 32px rgba(0,0,0,0.15)"}}>
        <div className="flex items-center gap-3 px-6 flex-shrink-0" style={{height:56,borderBottom:`1px solid ${T.border}`}}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MockMethodBadge method={iface.method}/>
            <code className="text-[12px] font-mono truncate" style={{color:T.t2}}>{iface.path}</code>
            <span className="text-[13px] font-semibold truncate" style={{color:T.t1}}>/ {scene.name}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Toggle on={scene.enabled} onChange={()=>{}}/>
            <span className="text-[12px]" style={{color:T.t3}}>启用</span>
            <span className="px-2 py-0.5 rounded text-[11px]" style={{background:MOCK_PUB_ST[scene.publishStatus].bg,color:MOCK_PUB_ST[scene.publishStatus].color}}>{MOCK_PUB_ST[scene.publishStatus].label}</span>
            <PBtn variant="ghost" icon={Play} onClick={()=>{}}>调试</PBtn>
            <PBtn onClick={()=>{}}>保存</PBtn>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{color:T.t4,background:"none",border:"none",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}><X size={16}/></button>
          </div>
        </div>
        <div className="flex items-center gap-6 px-6 py-2.5 flex-shrink-0" style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
          {[
            {l:"场景名称",v:<span className="text-[13px]" style={{color:T.t1}}>{scene.name}</span>},
            {l:"优先级",v:<span className="text-[13px] font-mono font-semibold" style={{color:T.primary}}>{scene.priority}</span>},
            {l:"默认场景",v:scene.isDefault?<span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{background:"#E8FFEA",color:T.success}}>是</span>:<span className="text-[11px]" style={{color:T.t4}}>否</span>},
            {l:"响应码",v:<span className="font-mono text-[13px] font-semibold" style={{color:scene.statusCode<400?T.success:scene.statusCode<500?T.warning:T.danger}}>{scene.statusCode}</span>},
            {l:"延迟",v:<span className="text-[13px] font-mono" style={{color:T.t2}}>{scene.delay} ms</span>},
          ].map(({l,v})=>(
            <div key={l} className="flex items-center gap-2">
              <span className="text-[11px] font-medium" style={{color:T.t4}}>{l}</span>
              {v}
            </div>
          ))}
        </div>
        <div className="flex flex-shrink-0 px-6" style={{borderBottom:`1px solid ${T.border}`,height:42}}>
          {[{key:"match" as const,label:"请求匹配"},{key:"response" as const,label:"响应配置"},{key:"vars" as const,label:"变量替换"}].map(t=>(
            <button key={t.key} onClick={()=>setEditorTab(t.key)} className="h-full px-4 text-[13px] font-medium border-b-2 transition-colors"
              style={{borderBottomColor:editorTab===t.key?T.primary:"transparent",color:editorTab===t.key?T.primary:T.t3}}>{t.label}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {editorTab==="match"&&(
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[13px] font-semibold" style={{color:T.t1}}>匹配条件</h3>
                  <p className="text-[12px] mt-0.5" style={{color:T.t3}}>所有条件均满足时命中此场景。按优先级从高到低匹配。</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px]" style={{color:T.t3}}>模式：</span>
                  <div className="flex rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}>
                    {(["simple","advanced"] as const).map(m=>(
                      <button key={m} onClick={()=>setMatchMode(m)} className="px-3 h-7 text-[12px] transition-colors"
                        style={{background:matchMode===m?T.primary:"#fff",color:matchMode===m?"#fff":T.t2}}>{m==="simple"?"简单配置":"高级模式"}</button>
                    ))}
                  </div>
                </div>
              </div>
              {matchMode==="simple"&&(
                <div className="flex flex-col gap-2">
                  <div className="grid text-[11px] font-semibold uppercase tracking-wide px-3 py-2 rounded-lg" style={{gridTemplateColumns:"100px 1fr 120px 1fr 36px",gap:"0 12px",background:"#FAFAFA",border:`1px solid ${T.border}`,color:T.t3}}>
                    <span>来源</span><span>字段 / JSONPath</span><span>操作符</span><span>期望值</span><span/>
                  </div>
                  {matchConditions.map((c,i)=>(
                    <div key={i} className="grid items-center px-3 py-2 rounded-lg gap-x-3" style={{gridTemplateColumns:"100px 1fr 120px 1fr 36px",border:`1px solid ${T.border}`,background:"#fff"}}>
                      <span className="text-[12px] px-2 py-0.5 rounded font-medium" style={{background:"#F2F3F5",color:T.t2}}>{c.type}</span>
                      <code className="text-[12px] font-mono" style={{color:T.t1}}>{c.field}</code>
                      <select className="h-7 px-2 border rounded text-[12px] outline-none w-full" style={{borderColor:T.border,color:T.t1}}>
                        <option>{c.op}</option><option>等于</option><option>包含</option><option>存在</option><option>正则匹配</option>
                      </select>
                      <input defaultValue={c.value} placeholder="期望值" className="h-7 px-2 border rounded text-[12px] outline-none w-full" style={{borderColor:T.border,color:T.t1}}/>
                      <button className="w-7 h-7 flex items-center justify-center rounded" style={{color:T.t4,background:"none",border:"none",cursor:"pointer"}} onMouseEnter={e=>{e.currentTarget.style.color=T.danger;e.currentTarget.style.backgroundColor="#FFF0F0";}} onMouseLeave={e=>{e.currentTarget.style.color=T.t4;e.currentTarget.style.backgroundColor="";}}>×</button>
                    </div>
                  ))}
                  <button className="flex items-center gap-1.5 mt-1 text-[12px]" style={{color:T.primary,background:"none",border:"none",cursor:"pointer",padding:0}}>
                    <Plus size={13}/>添加匹配条件
                  </button>
                </div>
              )}
              {matchMode==="advanced"&&(
                <div>
                  <div className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-lg" style={{background:"#FFF3E8",border:`1px solid #FFD595`}}>
                    <AlertTriangle size={14} style={{color:T.warning,flexShrink:0,marginTop:1}}/>
                    <p className="text-[12px]" style={{color:T.warning}}>高级模式下你可以使用 JSONPath / XPath / 正则表达式直接编写匹配规则。错误的规则将导致场景永不命中。</p>
                  </div>
                  <div className="rounded-lg overflow-hidden font-mono text-[12px]" style={{border:`1px solid ${T.border}`,background:"#1E1E1E",color:"#D4D4D4",minHeight:160,padding:"14px 16px",lineHeight:"22px"}}>
                    <span style={{color:"#569CD6"}}>{"{"}</span><br/>
                    <span style={{paddingLeft:24,color:"#9CDCFE"}}>"matchMode"</span><span>: </span><span style={{color:"#CE9178"}}>"all"</span><span>,</span><br/>
                    <span style={{paddingLeft:24,color:"#9CDCFE"}}>"conditions"</span><span>: [</span><br/>
                    <span style={{paddingLeft:48}}><span style={{color:"#569CD6"}}>{"{"}</span><span style={{color:"#9CDCFE"}}>"source"</span><span>: </span><span style={{color:"#CE9178"}}>"body.jsonpath"</span><span>, </span><span style={{color:"#9CDCFE"}}>"op"</span><span>: </span><span style={{color:"#CE9178"}}>"exists"</span><span style={{color:"#569CD6"}}>{"}"}</span></span><br/>
                    <span style={{paddingLeft:24}}>]</span><br/>
                    <span style={{color:"#569CD6"}}>{"}"}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {editorTab==="response"&&(
            <div className="p-6 flex flex-col gap-5">
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>HTTP 状态码</label>
                  <Sel width="100%"><option>200 OK</option><option>201 Created</option><option>400 Bad Request</option><option>403 Forbidden</option><option>404 Not Found</option><option>500 Internal Server Error</option></Sel></div>
                <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>Content-Type</label>
                  <Sel width="100%"><option>application/json</option><option>application/xml</option><option>text/plain</option></Sel></div>
                <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>响应延迟 (ms)</label>
                  <Inp value="50" width="100%"/></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-medium" style={{color:T.t2}}>响应 Headers</label>
                  <button className="text-[12px] flex items-center gap-1" style={{color:T.primary,background:"none",border:"none",cursor:"pointer"}}><Plus size={12}/>添加</button>
                </div>
                {[["Content-Type","application/json"],["X-Mock-Version","v1.4.2"]].map(([k,v],i)=>(
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <Inp placeholder="Header 名称" value={k} width={200}/>
                    <span style={{color:T.t4}}>:</span>
                    <Inp placeholder="值" value={v} width="100%"/>
                    <button className="w-6 h-6 flex items-center justify-center" style={{color:T.t4,background:"none",border:"none",cursor:"pointer"}}>×</button>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-medium" style={{color:T.t2}}>响应 Body</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px]" style={{color:T.t3}}>可用变量：</span>
                    <code className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{background:"#F2F3F5",color:T.t2}}>{"{{env.API_URL}}"}</code>
                    <code className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{background:"#F2F3F5",color:T.t2}}>{"{{faker.uuid}}"}</code>
                  </div>
                </div>
                <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#1E1E1E",minHeight:220}}>
                  <div className="flex items-center gap-2 px-3 py-1.5" style={{borderBottom:"1px solid #333",background:"#252526"}}>
                    <span className="text-[11px]" style={{color:"#9CDCFE"}}>response.json</span>
                    <span className="ml-auto text-[11px]" style={{color:"#888"}}>Monaco Editor</span>
                  </div>
                  <div className="p-3 font-mono text-[12px] leading-6" style={{color:"#D4D4D4"}}>
                    <span style={{color:"#569CD6"}}>{"{"}</span><br/>
                    <span style={{paddingLeft:16,color:"#9CDCFE"}}>"code"</span><span>: </span><span style={{color:"#B5CEA8"}}>0</span><span>,</span><br/>
                    <span style={{paddingLeft:16,color:"#9CDCFE"}}>"message"</span><span>: </span><span style={{color:"#CE9178"}}>"success"</span><span>,</span><br/>
                    <span style={{paddingLeft:16,color:"#9CDCFE"}}>"data"</span><span>: {"{"}</span><br/>
                    <span style={{paddingLeft:32,color:"#9CDCFE"}}>"orderId"</span><span>: </span><span style={{color:"#CE9178"}}>"{'{{faker.uuid}}'}"</span><span>,</span><br/>
                    <span style={{paddingLeft:32,color:"#9CDCFE"}}>"status"</span><span>: </span><span style={{color:"#CE9178"}}>"created"</span><br/>
                    <span style={{paddingLeft:16}}>{"}"}</span><br/>
                    <span style={{color:"#569CD6"}}>{"}"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {editorTab==="vars"&&(
            <div className="p-6">
              <div className="flex items-start gap-3 mb-5 px-3 py-2.5 rounded-lg" style={{background:"#F0F5FF",border:`1px solid ${T.primary}30`}}>
                <Zap size={14} style={{color:T.primary,flexShrink:0,marginTop:2}}/>
                <div>
                  <p className="text-[12px] font-semibold mb-1" style={{color:T.primary}}>变量替换说明</p>
                  <p className="text-[12px] leading-relaxed" style={{color:T.t2}}>在响应 Body 中使用 <code className="font-mono px-1 rounded" style={{background:"#E8F3FF"}}>{"{{变量名}}"}</code> 语法引用变量。系统将按作用域优先级解析：场景变量 › 环境变量 › 工作区变量 › 系统内置变量。</p>
                </div>
              </div>
              <ETable cols={[{label:"变量名",width:"22%"},{label:"来源",width:"14%"},{label:"当前值预览",width:"30%"},{label:"说明"},{label:"状态",width:"10%",align:"center"}]}>
                {[
                  {name:"faker.uuid",scope:"系统内置",preview:"a4b3-8c2e-...",desc:"UUID v4 随机值",ok:true,sensitive:false},
                  {name:"faker.timestamp",scope:"系统内置",preview:"1722154321",desc:"当前 Unix 时间戳",ok:true,sensitive:false},
                  {name:"request.body.amount",scope:"请求上下文",preview:"<运行时>",desc:"提取自请求体 JSON",ok:true,sensitive:false},
                  {name:"env.API_URL",scope:"环境变量",preview:"https://api.test.com",desc:"测试环境 API 基础地址",ok:true,sensitive:false},
                  {name:"ws.TEST_TOKEN",scope:"工作区变量",preview:"••••••••",desc:"敏感变量，已脱敏",ok:true,sensitive:true},
                  {name:"env.UNDEFINED_VAR",scope:"环境变量",preview:"—",desc:"变量不存在，将输出空字符串",ok:false,sensitive:false},
                ].map((v,i)=>(
                  <TR key={i}>
                    <TD><code className="text-[12px] font-mono" style={{color:T.t1}}>{"{{"+v.name+"}}"}</code></TD>
                    <TD><span className="text-[11px] px-1.5 py-0.5 rounded" style={{background:"#F2F3F5",color:T.t2}}>{v.scope}</span></TD>
                    <TD mono muted>{v.sensitive?<span style={{color:T.t4}}>••••••••</span>:v.preview}</TD>
                    <TD muted>{v.desc}</TD>
                    <TD align="center">{v.ok?<CheckCircle size={14} style={{color:T.success}}/>:<AlertTriangle size={14} style={{color:T.warning}}/>}</TD>
                  </TR>
                ))}
              </ETable>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Publish Modal ────────────────────────────────────────────────────────────

function MockPublishModal({app,onClose,onConfirm}:{app:MockApp;onClose:()=>void;onConfirm:()=>void}){
  const[note,setNote]=useState("");
  const changes=[
    {type:"modified",label:"更新订单状态",detail:"新增场景「超时自动关闭」，修改默认响应"},
    {type:"added",label:"批量查询接口",detail:"新接口：POST /api/v1/orders/batch-query，3 个场景"},
    {type:"deleted",label:"旧版取消订单",detail:"已迁移至新路径，原接口删除"},
  ];
  const typeStyle:{[k:string]:{icon:React.ElementType;color:string;bg:string;label:string}}={
    modified:{icon:Edit2,color:T.primary,bg:T.primary+"18",label:"修改"},
    added:{icon:Plus,color:T.success,bg:T.success+"18",label:"新增"},
    deleted:{icon:Trash2,color:T.danger,bg:T.danger+"18",label:"删除"},
  };
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:"rgba(29,33,41,0.5)"}}>
      <div className="flex flex-col rounded-2xl overflow-hidden" style={{width:560,maxHeight:"85vh",background:"#fff",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
        <div className="px-6 py-5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <h2 className="text-[16px] font-semibold" style={{color:T.t1}}>确认发布 — {app.name}</h2>
          <p className="text-[12px] mt-1" style={{color:T.t3}}>发布后当前版本不可变，引用此应用的环境将在下次请求时使用新版本。</p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[["当前版本",app.version],["新版本","v1.4.3"],["引用环境","测试环境、预发布环境"]].map(([k,v])=>(
              <div key={k} className="rounded-xl px-3 py-3" style={{background:"#FAFAFA",border:`1px solid ${T.border}`}}>
                <p className="text-[11px] font-medium mb-1" style={{color:T.t4}}>{k}</p>
                <p className="text-[13px] font-semibold" style={{color:T.t1}}>{v}</p>
              </div>
            ))}
          </div>
          <div className="mb-5">
            <p className="text-[12px] font-semibold mb-3" style={{color:T.t2}}>本次修改摘要</p>
            <div className="flex flex-col gap-2">
              {changes.map((c,i)=>{const s=typeStyle[c.type];const Icon=s.icon;return(
                <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{background:"#FAFAFA",border:`1px solid ${T.border}`}}>
                  <span className="flex items-center justify-center w-5 h-5 rounded flex-shrink-0 mt-0.5" style={{background:s.bg}}><Icon size={11} style={{color:s.color}}/></span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-bold" style={{color:s.color}}>{s.label}</span>
                      <span className="text-[13px] font-medium" style={{color:T.t1}}>{c.label}</span>
                    </div>
                    <p className="text-[12px]" style={{color:T.t3}}>{c.detail}</p>
                  </div>
                </div>
              );})}
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>发布说明 <span style={{color:T.t4,fontWeight:400}}>(选填)</span></label>
            <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="描述本次发布的主要变更…"
              className="w-full px-3 py-2 border rounded-lg text-[13px] outline-none resize-none"
              style={{borderColor:T.border,color:T.t1,fontFamily:"inherit"}}/>
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{borderTop:`1px solid ${T.border}`,background:"#FAFAFA"}}>
          <div className="flex items-center gap-1.5 text-[12px]" style={{color:T.warning}}>
            <AlertTriangle size={13}/>
            <span>引用此应用的测试任务将在下次运行时切换到新版本</span>
          </div>
          <div className="flex gap-2">
            <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
            <PBtn onClick={()=>{onConfirm();onClose();}}>确认发布</PBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function MockServicePage(){
  const[apps,setApps]=useState<MockApp[]>(MOCK_APPS);
  const[selectedApp,setSelectedApp]=useState<MockApp>(MOCK_APPS[0]);
  const[innerTab,setInnerTab]=useState<"interfaces"|"releases"|"envrefs"|"logs">("interfaces");
  const[expandedIface,setExpandedIface]=useState<string|null>("mi1");
  const[editScene,setEditScene]=useState<{scene:MockScene;iface:MockIface}|null>(null);
  const[showPublish,setShowPublish]=useState(false);
  const[showCreateApp,setShowCreateApp]=useState(false);
  const[appSearch,setAppSearch]=useState("");
  const[logSearch,setLogSearch]=useState("");

  const filteredApps=apps.filter(a=>!appSearch||a.name.toLowerCase().includes(appSearch.toLowerCase())||a.code.includes(appSearch));
  const appIfaces=MOCK_IFACES.filter(i=>i.appId===selectedApp.id);
  const appReleases=MOCK_RELEASES.filter(r=>r.appId===selectedApp.id);
  const appEnvRefs=MOCK_ENV_REFS.filter(e=>e.appId===selectedApp.id);
  const st=MOCK_APP_ST[selectedApp.status];

  return(
    <div className="flex flex-1 overflow-hidden" style={{background:T.bg}}>
      {/* Left app list */}
      <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:268,background:"#fff",borderRight:`1px solid ${T.border}`}}>
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[13px] font-semibold" style={{color:T.t1}}>Mock 应用</span>
            <PBtn icon={Plus} small onClick={()=>setShowCreateApp(true)}>新建</PBtn>
          </div>
          <Inp placeholder="搜索应用名称或编码" prefix={<Search size={12}/>} width="100%" value={appSearch} onChange={setAppSearch}/>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {filteredApps.map(app=>{
            const ast=MOCK_APP_ST[app.status];const active=app.id===selectedApp.id;
            return(
              <button key={app.id} onClick={()=>{setSelectedApp(app);setInnerTab("interfaces");setExpandedIface(null);}}
                className="w-full text-left rounded-xl px-3 py-2.5 mb-1.5 transition-all"
                style={{background:active?`${T.primary}0F`:"transparent",border:`1px solid ${active?T.primary+"30":T.border}`,cursor:"pointer"}}>
                <div className="flex items-start justify-between gap-1.5 mb-1">
                  <span className="text-[13px] font-semibold leading-5 flex-1 min-w-0 truncate" style={{color:active?T.primary:T.t1}}>{app.name}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full" style={{background:ast.bg,color:ast.color}}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:ast.dot}}/>
                    {ast.label}
                  </span>
                </div>
                <code className="text-[11px] font-mono mb-1.5 block" style={{color:T.t4}}>{app.code}</code>
                <div className="flex items-center gap-3 text-[11px]">
                  <span style={{color:T.t3}}>{app.version==="—"?"无版本":app.version}</span>
                  <span style={{color:T.t4}}>·</span>
                  <span style={{color:T.t3}}>{app.ifaceCount} 接口</span>
                  <span style={{color:T.t4}}>·</span>
                  {app.unmatchedCount>0
                    ?<span style={{color:T.danger,fontWeight:600}}>{app.unmatchedCount} 未匹配</span>
                    :<span style={{color:T.t4}}>{app.todayCalls} 次调用</span>
                  }
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
            <IcoSquare color={T.primary} bg={`${T.primary}15`} size={44}><Layers size={22}/></IcoSquare>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                <h2 className="text-[16px] font-bold" style={{color:T.t1}}>{selectedApp.name}</h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{background:st.bg,color:st.color}}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{background:st.dot}}/>{st.label}
                </span>
                {selectedApp.version!=="—"&&<span className="text-[11px] font-mono px-2 py-0.5 rounded-full" style={{background:"#F2F3F5",color:T.t2}}>{selectedApp.version}</span>}
              </div>
              <div className="flex items-center gap-4 text-[12px] flex-wrap">
                <span className="font-mono" style={{color:T.t3}}><span style={{color:T.t4}}>编码：</span>{selectedApp.code}</span>
                <span style={{color:T.t4}}>·</span>
                <span style={{color:T.t3}}>Mock 地址：<code className="font-mono text-[11px]" style={{color:T.primary}}>{selectedApp.baseUrl}</code></span>
                <span style={{color:T.t4}}>·</span>
                <span style={{color:T.t3}}>延迟：{selectedApp.defaultDelay} ms</span>
                <span style={{color:T.t4}}>·</span>
                <span style={{color:T.t3}}>访问凭据：{selectedApp.authEnabled?<span style={{color:T.success}}>已启用</span>:<span style={{color:T.t4}}>未启用</span>}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {[{v:selectedApp.ifaceCount,l:"接口"},{v:selectedApp.sceneCount,l:"场景"},{v:selectedApp.unmatchedCount,l:"未匹配",warn:selectedApp.unmatchedCount>0}].map(({v,l,warn})=>(
                <div key={l} className="flex flex-col items-center px-3 py-1.5 rounded-lg" style={{background:warn?"#FFF3E8":"#FAFAFA",border:`1px solid ${warn?"#FFD595":T.border}`,minWidth:56,textAlign:"center"}}>
                  <span className="text-[18px] font-bold leading-none" style={{color:warn?T.warning:T.t1}}>{v}</span>
                  <span className="text-[10px] mt-0.5" style={{color:warn?T.warning:T.t4}}>{l}</span>
                </div>
              ))}
              <span className="w-px h-8" style={{background:T.border}}/>
              <PBtn variant="ghost" icon={Edit2} onClick={()=>{}}>编辑</PBtn>
              {selectedApp.status!=="draft"&&selectedApp.status!=="disabled"&&(
                <PBtn variant="ghost" icon={Power} onClick={()=>{}} color={T.danger}>停用</PBtn>
              )}
              <PBtn icon={ArrowUpRight} onClick={()=>setShowPublish(true)} color={selectedApp.status==="modified"?T.warning:T.primary}>
                {selectedApp.status==="draft"?"首次发布":"发布新版本"}
              </PBtn>
            </div>
          </div>
          <div className="flex px-6" style={{borderTop:`1px solid ${T.border}`}}>
            {([
              {key:"interfaces" as const,label:`接口与场景 (${selectedApp.ifaceCount})`},
              {key:"releases" as const,label:`发布版本 (${appReleases.length})`},
              {key:"envrefs" as const,label:`环境引用 (${selectedApp.envCount})`},
              {key:"logs" as const,label:"调用日志"},
            ]).map(t=>(
              <button key={t.key} onClick={()=>setInnerTab(t.key)} className="h-10 px-4 text-[13px] font-medium border-b-2 transition-colors"
                style={{borderBottomColor:innerTab===t.key?"#4E5AC8":"transparent",color:innerTab===t.key?"#4E5AC8":T.t3}}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 接口与场景 */}
          {innerTab==="interfaces"&&(
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Inp placeholder="搜索接口名称或路径" prefix={<Search size={13}/>} width={220}/>
                <Sel width={100}><option>全部方法</option><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></Sel>
                <Sel width={110}><option>全部状态</option><option>已启用</option><option>已停用</option></Sel>
                <Sel width={100}><option>全部版本</option><option>已发布</option><option>草稿</option></Sel>
                <div className="flex-1"/>
                <PBtn variant="ghost" icon={Upload} onClick={()=>{}}>导入</PBtn>
                <PBtn icon={Plus} onClick={()=>{}}>新增接口</PBtn>
              </div>
              <div className="flex flex-col gap-2">
                {appIfaces.map(iface=>{
                  const expanded=expandedIface===iface.id;
                  const ps=MOCK_PUB_ST[iface.publishStatus];
                  const ifScenes=MOCK_SCENES.filter(s=>s.ifaceId===iface.id);
                  return(
                    <div key={iface.id} className="rounded-xl overflow-hidden" style={{border:`1px solid ${expanded?T.primary+"40":T.border}`,background:"#fff",boxShadow:expanded?"0 2px 12px rgba(22,93,255,0.06)":"0 1px 4px rgba(0,0,0,0.03)"}}>
                      <div className="flex items-center gap-3 px-4 py-3" style={{background:expanded?"#FAFBFF":"#fff",borderBottom:expanded?`1px solid ${T.border}`:"none"}}>
                        <button onClick={()=>setExpandedIface(expanded?null:iface.id)} className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded" style={{color:T.t3,background:"none",border:"none",cursor:"pointer"}}>
                          {expanded?<ChevronDown size={14}/>:<ChevronRight size={14}/>}
                        </button>
                        <MockMethodBadge method={iface.method}/>
                        <code className="text-[13px] font-mono flex-1 min-w-0" style={{color:T.t1}}>{iface.path}</code>
                        <span className="text-[13px]" style={{color:T.t2}}>{iface.name}</span>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{background:ps.bg,color:ps.color}}>{ps.label}</span>
                        <span className="text-[12px]" style={{color:T.t3}}>{iface.sceneCount} 场景</span>
                        <span className="text-[12px]" style={{color:iface.enabled?T.success:T.t4}}>{iface.enabled?"启用":"停用"}</span>
                        <div className="flex items-center">
                          <IBtn icon={Plus} label="添加场景" onClick={()=>{}}/>
                          <IBtn icon={Edit2} label="编辑接口" onClick={()=>{}}/>
                          <IBtn icon={Copy} label="复制接口" onClick={()=>{}}/>
                          <IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/>
                        </div>
                      </div>
                      {expanded&&(
                        <div>
                          {ifScenes.length===0?(
                            <div className="py-8 text-center text-[13px]" style={{color:T.t4}}>暂无场景，点击上方「添加场景」开始创建</div>
                          ):(
                            <div>
                              <div className="grid text-[11px] font-semibold uppercase tracking-wide px-4 py-2" style={{gridTemplateColumns:"220px 64px 80px 80px 80px 80px 1fr 100px",gap:"0 12px",background:"#FAFAFA",borderBottom:`1px solid ${T.border}`,color:T.t3}}>
                                <span>场景名称</span><span>优先级</span><span>状态码</span><span>延迟</span><span>默认</span><span>版本</span><span>更新时间</span><span className="text-right">操作</span>
                              </div>
                              {ifScenes.map(scene=>{
                                const sps=MOCK_PUB_ST[scene.publishStatus];
                                return(
                                  <div key={scene.id} className="grid items-center px-4 py-2.5" style={{gridTemplateColumns:"220px 64px 80px 80px 80px 80px 1fr 100px",gap:"0 12px",borderBottom:`1px solid ${T.border}`}}
                                    onMouseEnter={e=>e.currentTarget.style.background="#FAFBFF"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {scene.isDefault&&<span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:T.primary}}/>}
                                      <button onClick={()=>setEditScene({scene,iface})} className="text-[13px] font-medium truncate hover:underline" style={{color:scene.isDefault?T.primary:T.t1,background:"none",border:"none",cursor:"pointer",textAlign:"left"}}>{scene.name}</button>
                                    </div>
                                    <span className="text-[12px] font-mono font-semibold" style={{color:T.t2}}>{scene.priority}</span>
                                    <span className="text-[12px] font-mono font-semibold" style={{color:scene.statusCode<400?T.success:scene.statusCode<500?T.warning:T.danger}}>{scene.statusCode}</span>
                                    <span className="text-[12px] font-mono" style={{color:T.t3}}>{scene.delay} ms</span>
                                    <span>{scene.isDefault?<span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{background:"#E8FFEA",color:T.success}}>默认</span>:<span style={{color:T.t4}}>—</span>}</span>
                                    <span className="text-[11px] px-1.5 py-0.5 rounded" style={{background:sps.bg,color:sps.color}}>{sps.label}</span>
                                    <span className="text-[12px] font-mono" style={{color:T.t4}}>{scene.updatedAt}</span>
                                    <div className="flex items-center justify-end gap-0.5">
                                      <IBtn icon={Play} label="调试" onClick={()=>setEditScene({scene,iface})}/>
                                      <IBtn icon={Edit2} label="编辑场景" onClick={()=>setEditScene({scene,iface})}/>
                                      <IBtn icon={Copy} label="复制" onClick={()=>{}}/>
                                      <IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 发布版本 */}
          {innerTab==="releases"&&(
            <div className="p-5">
              {appReleases.length===0?(
                <div className="flex flex-col items-center justify-center py-20" style={{color:T.t4}}>
                  <ArrowUpRight size={40} className="mb-3"/>
                  <p className="text-[14px] font-medium" style={{color:T.t2}}>尚未发布</p>
                  <p className="text-[13px] mt-1" style={{color:T.t3}}>完成接口和场景配置后，发布为不可变版本供测试环境使用</p>
                  <PBtn icon={ArrowUpRight} onClick={()=>setShowPublish(true)} className="mt-4">立即发布</PBtn>
                </div>
              ):(
                <div className="flex flex-col gap-3">
                  {appReleases.map(r=>{
                    const isActive=r.status==="active";
                    return(
                      <div key={r.id} className="rounded-xl overflow-hidden" style={{border:`1px solid ${isActive?T.success+"40":T.border}`,background:"#fff",boxShadow:isActive?"0 1px 8px rgba(0,180,42,0.08)":"0 1px 4px rgba(0,0,0,0.03)"}}>
                        <div className="flex items-center gap-4 px-5 py-4">
                          <div className="flex flex-col items-center flex-shrink-0" style={{minWidth:72}}>
                            <span className="text-[20px] font-bold font-mono" style={{color:isActive?T.success:T.t3}}>{r.version}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full mt-1 font-medium" style={{background:isActive?"#E8FFEA":r.status==="disabled"?"#FFE8E8":"#F2F3F5",color:isActive?T.success:r.status==="disabled"?T.danger:T.t4}}>
                              {isActive?"当前版本":r.status==="disabled"?"已停用":"已超用"}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] mb-1.5" style={{color:T.t1}}>{r.note||<span style={{color:T.t4}}>无发布说明</span>}</p>
                            <div className="flex items-center gap-4 text-[12px]">
                              <span style={{color:T.t3}}>{r.publishedAt}</span>
                              <span style={{color:T.t4}}>·</span>
                              <span style={{color:T.t3}}>发布人：{r.publishedBy}</span>
                              <span style={{color:T.t4}}>·</span>
                              <span style={{color:T.t3}}>{r.ifaceCount} 接口 / {r.sceneCount} 场景</span>
                              {r.envRefs.length>0&&<><span style={{color:T.t4}}>·</span><span style={{color:T.t3}}>引用：{r.envRefs.join("、")}</span></>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <PBtn variant="ghost" icon={Eye} onClick={()=>{}}>查看</PBtn>
                            <PBtn variant="ghost" icon={RefreshCw} onClick={()=>{}}>对比</PBtn>
                            {isActive&&r.envRefs.length===0&&<PBtn variant="ghost" icon={Power} onClick={()=>{}} color={T.danger}>停用</PBtn>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 环境引用 */}
          {innerTab==="envrefs"&&(
            <div className="p-5">
              {appEnvRefs.length===0?(
                <div className="flex flex-col items-center justify-center py-20">
                  <Globe size={40} style={{color:T.t4}} className="mb-3"/>
                  <p className="text-[14px] font-medium" style={{color:T.t2}}>暂无环境引用</p>
                  <p className="text-[13px] mt-1" style={{color:T.t3}}>在「配置中心 › 环境配置」中选择对应 Mock 版本并启用</p>
                </div>
              ):(
                <ETable total={appEnvRefs.length} cols={[{label:"环境名称",width:"16%"},{label:"使用版本",width:"10%"},{label:"Mock 状态",width:"10%"},{label:"未匹配策略",width:"14%"},{label:"最近使用",width:"14%"},{label:"关联任务",width:"10%",align:"center"},{label:"操作",width:"10%",align:"right"}]}>
                  {appEnvRefs.map(ref=>(
                    <TR key={ref.id}>
                      <TD><span className="font-medium" style={{color:T.t1}}>{ref.envName}</span></TD>
                      <TD mono><span className="font-mono font-semibold" style={{color:T.success}}>{ref.version}</span></TD>
                      <TD><StatusDot status={ref.enabled?"enabled":"disabled"}/></TD>
                      <TD muted>{UNMATCHED_LABEL[ref.unmatchedPolicy]}</TD>
                      <TD muted>{ref.lastUsed}</TD>
                      <TD align="center"><span className="font-semibold" style={{color:T.primary}}>{ref.taskCount}</span></TD>
                      <TD align="right"><button className="text-[12px]" style={{color:T.primary,background:"none",border:"none",cursor:"pointer"}}>前往环境配置</button></TD>
                    </TR>
                  ))}
                </ETable>
              )}
            </div>
          )}

          {/* 调用日志 */}
          {innerTab==="logs"&&(
            <div className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Inp placeholder="搜索路径、场景名" prefix={<Search size={13}/>} width={220} value={logSearch} onChange={setLogSearch}/>
                <Sel width={100}><option>全部方法</option><option>GET</option><option>POST</option></Sel>
                <Sel width={100}><option>全部结果</option><option>命中</option><option>未匹配</option><option>异常</option></Sel>
                <Sel width={120}><option>今日</option><option>最近 1 小时</option><option>最近 24 小时</option></Sel>
                <div className="flex-1"/>
                <PBtn variant="ghost" icon={Download} onClick={()=>{}}>导出日志</PBtn>
              </div>
              <ETable total={MOCK_LOGS.length} cols={[{label:"时间",width:"8%"},{label:"接口名称",width:"16%"},{label:"路径",width:"18%"},{label:"命中场景",width:"16%"},{label:"结果",width:"8%"},{label:"状态码",width:"7%",align:"center"},{label:"耗时",width:"7%",align:"right"},{label:"关联任务",width:"11%"},{label:"操作",width:"8%",align:"right"}]}>
                {MOCK_LOGS.map(log=>{
                  const mr=MOCK_MATCH[log.matchResult];const MrIcon=mr.icon;
                  return(
                    <TR key={log.id}>
                      <TD mono muted>{log.time}</TD>
                      <TD><span className="flex items-center gap-1.5"><MockMethodBadge method={log.method}/><span className="text-[12px]">{log.ifaceName}</span></span></TD>
                      <TD mono><code className="text-[12px]" style={{color:T.t2}}>{log.path}</code></TD>
                      <TD>{log.hitScene?<span style={{color:T.t1}}>{log.hitScene}</span>:<span style={{color:T.t4}}>—</span>}</TD>
                      <TD><span className="inline-flex items-center gap-1 text-[12px]"><MrIcon size={12} style={{color:mr.color}}/><span style={{color:mr.color}}>{mr.label}</span></span></TD>
                      <TD align="center"><span className="font-mono text-[12px] font-semibold" style={{color:log.statusCode<400?T.success:log.statusCode<500?T.warning:T.danger}}>{log.statusCode}</span></TD>
                      <TD align="right"><span className="font-mono text-[12px]" style={{color:T.t3}}>{log.responseTime} ms</span></TD>
                      <TD>{log.task?<button className="text-[12px] hover:underline" style={{color:T.primary,background:"none",border:"none",cursor:"pointer"}}>{log.task}</button>:<span style={{color:T.t4}}>—</span>}</TD>
                      <TD align="right"><button className="text-[12px]" style={{color:T.primary,background:"none",border:"none",cursor:"pointer"}}>详情</button></TD>
                    </TR>
                  );
                })}
              </ETable>
            </div>
          )}
        </div>
      </div>

      {editScene&&<MockSceneEditor scene={editScene.scene} iface={editScene.iface} onClose={()=>setEditScene(null)}/>}
      {showPublish&&<MockPublishModal app={selectedApp} onClose={()=>setShowPublish(false)} onConfirm={()=>{setApps(a=>a.map(x=>x.id===selectedApp.id?{...x,status:"published" as MockAppStatus}:x));setSelectedApp(a=>({...a,status:"published" as MockAppStatus}));}}/>}
      {showCreateApp&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:"rgba(29,33,41,0.5)"}}>
          <div className="rounded-2xl overflow-hidden" style={{width:520,background:"#fff",boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
            <div className="px-6 py-5 flex items-center justify-between" style={{borderBottom:`1px solid ${T.border}`}}>
              <h2 className="text-[16px] font-semibold" style={{color:T.t1}}>新建 Mock 应用</h2>
              <button onClick={()=>setShowCreateApp(false)} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{color:T.t4,background:"none",border:"none",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}><X size={16}/></button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>应用名称 <span style={{color:T.danger}}>*</span></label><Inp placeholder="例：支付网关 Mock" width="100%"/></div>
              <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>应用编码 <span style={{color:T.danger}}>*</span></label><Inp placeholder="例：payment-mock（仅英文、数字、-）" mono width="100%"/><p className="text-[11px] mt-1" style={{color:T.t4}}>编码将作为 Mock 基础路径的一部分，创建后不可修改。</p></div>
              <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>描述</label><Inp placeholder="说明此 Mock 应用的用途和范围" width="100%"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>默认响应延迟 (ms)</label><Inp value="50" width="100%"/></div>
                <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>未匹配策略</label><Sel width="100%"><option>严格失败 (推荐)</option><option>返回空响应</option><option>透传真实服务</option></Sel></div>
              </div>
              <div className="flex items-center justify-between py-2.5 px-3 rounded-lg" style={{background:"#FAFAFA",border:`1px solid ${T.border}`}}>
                <div><p className="text-[13px] font-medium" style={{color:T.t1}}>启用访问凭据</p><p className="text-[11px] mt-0.5" style={{color:T.t3}}>启用后调用 Mock 接口需携带 Token，提升安全性</p></div>
                <Toggle on={false} onChange={()=>{}}/>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`,background:"#FAFAFA"}}>
              <PBtn variant="ghost" onClick={()=>setShowCreateApp(false)}>取消</PBtn>
              <PBtn onClick={()=>setShowCreateApp(false)}>创建</PBtn>
            </div>
          </div>
        </div>
      )}
      {/* suppress unused warning */}
      {logSearch&&null}
    </div>
  );
}
