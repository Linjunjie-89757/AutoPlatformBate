import React, { useState } from "react";
import {
  Plus, Search, Edit2, Trash2, Play, X, ChevronDown, ChevronRight,
  Copy, Settings, Upload, Clock, Layers, Repeat, Filter, Link2,
  FileText, ArrowUp, ArrowDown, Terminal, Globe, Shield,
  CheckCircle, XCircle, AlertCircle, GripVertical, MoreHorizontal,
  Save, RefreshCw, Database, AlignLeft, Code, Info, Zap,
  ToggleLeft, Eye, ChevronUp, Lock
} from "lucide-react";

// ─── Palette (matches App.tsx) ────────────────────────────────────────────────
const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  cyan:"#0891B2",
  border:"#E5E6EB",  bg:"#F4F6FA",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type StepType = "import"|"custom"|"ref-api"|"ref-case"|"ref-scene"|"loop"|"condition"|"once"|"script"|"wait";
type Method   = "GET"|"POST"|"PUT"|"DELETE"|"PATCH";
type Priority = "P0"|"P1"|"P2"|"P3";

interface Step {
  id: string; type: StepType; name: string;
  method?: Method; path?: string;
  enabled: boolean; depth: number;
  children?: Step[];
}
interface Scene {
  id: string; name: string; module: string; priority: Priority;
  status: "active"|"inactive"; desc: string; tags: string[];
  env: string; testData: string|null; iterations: number; threads: number;
  runLocation: "server"|"runner"; runnerId?: string; variableSet: string|null;
  steps: Step[]; lastRun: string|null; lastResult: "pass"|"fail"|null;
}
type SuiteItemType = "api"|"scene";
interface SuiteItem {
  id: string; type: SuiteItemType; name: string;
  method?: Method; path?: string; desc?: string;
}
interface Suite {
  id: string; name: string; module: string; priority: Priority;
  status: "ACTIVE"|"INACTIVE"; desc: string;
  items: SuiteItem[]; env: string; runMode: "serial"|"parallel";
  runLocation: "server"|"runner"; notify: boolean;
  lastRun: string|null; lastResult: "pass"|"fail"|null;
}
interface RunRecord {
  id: string; startTime: string; env: string;
  pass: number; total: number; fail: number;
  duration: string; operator: string; status: "pass"|"fail"|"running";
}

// ─── Step type config ─────────────────────────────────────────────────────────
const STEP_CFG: Record<StepType,{label:string;color:string;bg:string;icon:React.ElementType;desc:string}> = {
  import:    {label:"导入",    color:"#FF7D00",bg:"#FFF3E8",icon:Upload,   desc:"从系统导入接口 / 用例"},
  custom:    {label:"自定义",  color:T.primary,bg:"#E8F3FF",icon:Globe,    desc:"配置自定义 HTTP 请求"},
  "ref-api": {label:"引用接口",color:T.purple, bg:"#F5E8FF",icon:Link2,    desc:"引用已有接口定义"},
  "ref-case":{label:"引用用例",color:T.cyan,   bg:"#E0F7FA",icon:FileText, desc:"引用接口用例"},
  "ref-scene":{label:"引用场景",color:T.success,bg:"#E8FFEA",icon:Layers,  desc:"引用已有场景"},
  loop:      {label:"循环",    color:"#4E5AC8",bg:"#EEEEFF",icon:Repeat,   desc:"循环执行子步骤"},
  condition: {label:"条件",    color:"#E91E8C",bg:"#FFE8F5",icon:Filter,   desc:"按条件分支执行"},
  once:      {label:"仅一次",  color:"#6B7280",bg:"#F2F3F5",icon:Shield,   desc:"整个场景只执行一次"},
  script:    {label:"脚本",    color:"#F59E0B",bg:"#FFFBEB",icon:Terminal, desc:"执行 JavaScript 脚本"},
  wait:      {label:"等待",    color:"#64748B",bg:"#F8FAFC",icon:Clock,    desc:"等待指定时间 (ms)"},
};
const METHOD_STYLE: Record<Method,{color:string;bg:string}> = {
  GET:    {color:T.success, bg:"#E8FFEA"},
  POST:   {color:T.primary, bg:"#E8F3FF"},
  PUT:    {color:T.warning, bg:"#FFF3E8"},
  DELETE: {color:T.danger,  bg:"#FFEEEE"},
  PATCH:  {color:T.purple,  bg:"#F5E8FF"},
};
const PRIORITY_STYLE: Record<Priority,{color:string;bg:string}> = {
  P0:{color:"#F53F3F",bg:"#FFEEEE"},
  P1:{color:"#FF7D00",bg:"#FFF3E8"},
  P2:{color:T.primary,bg:"#E8F3FF"},
  P3:{color:T.t3,     bg:"#F2F3F5"},
};

// ─── Mock data ────────────────────────────────────────────────────────────────
const INIT_SCENES: Scene[] = [
  {
    id:"s1", name:"产品管理-新增编辑删除闭环", module:"获客中心", priority:"P1",
    status:"active", desc:"由 Codex 根据获客中心低风险新增编辑删除接口生成的可重复闭环场景。",
    tags:["获客中心","CRUD闭环","Codex生成"], env:"测试环境", testData:null,
    iterations:1, threads:1, runLocation:"server", variableSet:null,
    lastRun:"2026-07-14 09:30", lastResult:"pass",
    steps:[
      {id:"st1",type:"ref-scene",name:"登录",enabled:true,depth:0},
      {id:"st2",type:"script",name:"生成本次测试数据",enabled:true,depth:0},
      {id:"st3",type:"custom",name:"新增产品",method:"POST",path:"/api/products",enabled:true,depth:0},
      {id:"st4",type:"custom",name:"查询新增产品并提取ID",method:"GET",path:"/api/products",enabled:true,depth:0},
      {id:"st5",type:"custom",name:"编辑产品",method:"PUT",path:"/api/products/{id}",enabled:true,depth:0},
      {id:"st6",type:"custom",name:"查询验证产品已编辑",method:"GET",path:"/api/products/{id}",enabled:true,depth:0},
      {id:"st7",type:"custom",name:"停用产品",method:"POST",path:"/api/products/{id}/disable",enabled:true,depth:0},
      {id:"st8",type:"custom",name:"查询验证产品已停用",method:"GET",path:"/api/products/{id}",enabled:true,depth:0},
      {id:"st9",type:"custom",name:"删除产品",method:"DELETE",path:"/api/products/{id}",enabled:true,depth:0},
      {id:"st10",type:"custom",name:"查询验证产品已删除",method:"GET",path:"/api/products/{id}",enabled:true,depth:0},
    ],
  },
  {
    id:"s2", name:"用户注册登录完整流程", module:"用户中心", priority:"P0",
    status:"active", desc:"覆盖注册→验证码→登录→Token刷新完整链路。",
    tags:["用户中心","核心链路"], env:"测试环境", testData:"注册测试数据集",
    iterations:3, threads:2, runLocation:"server", variableSet:"公共变量集",
    lastRun:"2026-07-13 22:00", lastResult:"fail",
    steps:[
      {id:"st11",type:"custom",name:"发送验证码",method:"POST",path:"/auth/sms/send",enabled:true,depth:0},
      {id:"st12",type:"wait",name:"等待短信到达 1500ms",enabled:true,depth:0},
      {id:"st13",type:"custom",name:"注册账户",method:"POST",path:"/auth/register",enabled:true,depth:0},
      {id:"st14",type:"custom",name:"登录获取Token",method:"POST",path:"/auth/login",enabled:true,depth:0},
      {id:"st15",type:"script",name:"提取并存储Token",enabled:true,depth:0},
      {id:"st16",type:"custom",name:"刷新Token",method:"POST",path:"/auth/refresh",enabled:true,depth:0},
    ],
  },
  {
    id:"s3", name:"订单全链路压测场景", module:"订单中心", priority:"P0",
    status:"active", desc:"从创建订单到支付到履约的完整业务链路。",
    tags:["订单","压测","主链路"], env:"预发布环境", testData:"订单压测数据集",
    iterations:50, threads:10, runLocation:"runner", runnerId:"runner-001",
    variableSet:"订单变量集", lastRun:"2026-07-12 03:00", lastResult:"pass",
    steps:[
      {id:"st17",type:"custom",name:"创建购物车",method:"POST",path:"/cart/create",enabled:true,depth:0},
      {id:"st18",type:"loop",name:"批量加入商品 (循环3次)",enabled:true,depth:0,
        children:[
          {id:"st18a",type:"custom",name:"加入商品",method:"POST",path:"/cart/items",enabled:true,depth:1},
        ]},
      {id:"st19",type:"custom",name:"下单",method:"POST",path:"/orders",enabled:true,depth:0},
      {id:"st20",type:"custom",name:"支付",method:"POST",path:"/orders/{id}/pay",enabled:true,depth:0},
      {id:"st21",type:"condition",name:"判断支付状态",enabled:true,depth:0,
        children:[
          {id:"st21a",type:"custom",name:"查询履约进度",method:"GET",path:"/fulfillment/{id}",enabled:true,depth:1},
        ]},
    ],
  },
  {
    id:"s4", name:"权限校验场景", module:"权限中心", priority:"P2",
    status:"inactive", desc:"验证各角色对敏感接口的权限边界。",
    tags:["权限","安全"], env:"测试环境", testData:null,
    iterations:1, threads:1, runLocation:"server", variableSet:null,
    lastRun:null, lastResult:null,
    steps:[
      {id:"st22",type:"ref-scene",name:"管理员登录",enabled:true,depth:0},
      {id:"st23",type:"custom",name:"访问管理员接口",method:"GET",path:"/admin/users",enabled:true,depth:0},
      {id:"st24",type:"ref-scene",name:"普通用户登录",enabled:true,depth:0},
      {id:"st25",type:"custom",name:"访问管理员接口（期望403）",method:"GET",path:"/admin/users",enabled:true,depth:0},
    ],
  },
];

const INIT_SUITES: Suite[] = [
  {
    id:"su1", name:"核心业务回归套件", module:"全部", priority:"P0",
    status:"ACTIVE", desc:"每次发版前必跑，覆盖用户、产品、订单核心链路",
    env:"测试环境", runMode:"serial", runLocation:"server", notify:true,
    lastRun:"2026-07-14 08:00", lastResult:"pass",
    items:[
      {id:"i1",type:"api",name:"用户注册",method:"POST",path:"/auth/register"},
      {id:"i2",type:"api",name:"用户登录",method:"POST",path:"/auth/login"},
      {id:"i3",type:"scene",name:"产品管理-新增编辑删除闭环",desc:"10个步骤"},
      {id:"i4",type:"scene",name:"订单全链路压测场景",desc:"5个步骤，循环嵌套"},
      {id:"i5",type:"api",name:"获取订单列表",method:"GET",path:"/orders"},
    ],
  },
  {
    id:"su2", name:"权限安全回归套件", module:"权限中心", priority:"P1",
    status:"ACTIVE", desc:"验证各角色权限边界，安全合规必跑",
    env:"测试环境", runMode:"parallel", runLocation:"runner", notify:false,
    lastRun:"2026-07-13 20:00", lastResult:"fail",
    items:[
      {id:"i6",type:"scene",name:"权限校验场景",desc:"4个步骤"},
      {id:"i7",type:"api",name:"查询用户权限",method:"GET",path:"/permissions"},
    ],
  },
  {
    id:"su3", name:"P0 接口冒烟套件", module:"全部", priority:"P0",
    status:"ACTIVE", desc:"上线前快速冒烟，核心接口可用性验证",
    env:"预发布环境", runMode:"parallel", runLocation:"server", notify:true,
    lastRun:"2026-07-14 07:30", lastResult:"pass",
    items:[
      {id:"i8",type:"api",name:"健康检查",method:"GET",path:"/health"},
      {id:"i9",type:"api",name:"获取配置",method:"GET",path:"/config"},
      {id:"i10",type:"api",name:"用户登录",method:"POST",path:"/auth/login"},
    ],
  },
];

const MOCK_RUN_RECORDS: RunRecord[] = [
  {id:"r1",startTime:"2026-07-14 08:00:12",env:"测试环境",pass:18,total:20,fail:2,duration:"2m 34s",operator:"张程远",status:"fail"},
  {id:"r2",startTime:"2026-07-13 20:01:05",env:"测试环境",pass:20,total:20,fail:0,duration:"2m 01s",operator:"自动调度",status:"pass"},
  {id:"r3",startTime:"2026-07-13 12:00:00",env:"测试环境",pass:19,total:20,fail:1,duration:"2m 18s",operator:"李雷",status:"fail"},
  {id:"r4",startTime:"2026-07-12 08:00:10",env:"预发布环境",pass:20,total:20,fail:0,duration:"1m 58s",operator:"自动调度",status:"pass"},
];

const MOCK_CANDIDATE_CASES = [
  {id:"c001",name:"查询商品列表",method:"GET" as Method,path:"/products",api:"商品接口",inSuite:false},
  {id:"c002",name:"新增商品",method:"POST" as Method,path:"/products",api:"商品接口",inSuite:true},
  {id:"c003",name:"获取用户信息",method:"GET" as Method,path:"/users/{id}",api:"用户接口",inSuite:false},
  {id:"c004",name:"更新用户信息",method:"PUT" as Method,path:"/users/{id}",api:"用户接口",inSuite:false},
  {id:"c005",name:"删除订单",method:"DELETE" as Method,path:"/orders/{id}",api:"订单接口",inSuite:false},
  {id:"c006",name:"创建订单",method:"POST" as Method,path:"/orders",api:"订单接口",inSuite:false},
];

const MOCK_CANDIDATE_SCENES = [
  {id:"s1",name:"产品管理-新增编辑删除闭环",module:"获客中心",steps:10,status:"active",inSuite:true},
  {id:"s2",name:"用户注册登录完整流程",module:"用户中心",steps:6,status:"active",inSuite:false},
  {id:"s3",name:"订单全链路压测场景",module:"订单中心",steps:5,status:"active",inSuite:true},
  {id:"s4",name:"权限校验场景",module:"权限中心",steps:4,status:"inactive",inSuite:false},
];

const ENVS = ["测试环境","预发布环境","生产环境(只读)","本地联调"];
const MODULES = ["全部","获客中心","用户中心","订单中心","权限中心","结算中心"];
const VARIABLE_SETS = ["公共变量集","订单变量集","用户变量集"];
const RUNNERS = [{id:"runner-001",name:"Runner-主机A",status:"在线"},{id:"runner-002",name:"Runner-主机B",status:"离线"}];

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Btn({children,onClick,small,color=T.primary,ghost,danger,icon:Icon,disabled}:{
  children?:React.ReactNode;onClick?:()=>void;small?:boolean;color?:string;ghost?:boolean;danger?:boolean;icon?:React.ElementType;disabled?:boolean}){
  if(ghost)return(
    <button disabled={disabled} onClick={onClick}
      className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border text-[12px] font-medium bg-white transition-colors"
      style={{borderColor:T.border,color:danger?T.danger:T.t2,opacity:disabled?.5:1}}>
      {Icon&&<Icon size={12}/>}{children}
    </button>
  );
  return(
    <button disabled={disabled} onClick={onClick}
      className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-all active:scale-[.98]"
      style={{backgroundColor:danger?T.danger:color,color:"#fff",height:small?26:32,padding:small?"0 10px":"0 14px",fontSize:small?11:13,opacity:disabled?.5:1}}>
      {Icon&&<Icon size={small?11:13}/>}{children}
    </button>
  );
}
function IBtn({icon:Icon,label,danger,onClick}:{icon:React.ElementType;label:string;danger?:boolean;onClick?:()=>void}){
  return(
    <button title={label} onClick={onClick}
      className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:opacity-80"
      style={{color:danger?T.danger:T.t3}}
      onMouseEnter={e=>{e.currentTarget.style.backgroundColor=danger?"#FFEEEE":"#F2F3F5";}}
      onMouseLeave={e=>{e.currentTarget.style.backgroundColor="transparent";}}>
      <Icon size={13}/>
    </button>
  );
}
function Sel({value,onChange,options,width=120}:{value:string;onChange:(v:string)=>void;options:string[];width?:number}){
  return(
    <select value={value} onChange={e=>onChange(e.target.value)}
      className="h-7 px-2.5 border rounded-lg text-[12px] outline-none appearance-none bg-white"
      style={{borderColor:T.border,color:T.t1,width}}>
      {options.map(o=><option key={o}>{o}</option>)}
    </select>
  );
}
function Inp({value,onChange,placeholder,width=120}:{value?:string;onChange?:(v:string)=>void;placeholder?:string;width?:number|string}){
  return(
    <input value={value} onChange={e=>onChange?.(e.target.value)} placeholder={placeholder}
      className="h-7 px-2.5 border rounded-lg text-[12px] outline-none bg-white"
      style={{borderColor:T.border,color:T.t1,width}}/>
  );
}
function NumInp({value,onChange,min=1,max=999,width=56}:{value:number;onChange:(v:number)=>void;min?:number;max?:number;width?:number}){
  return(
    <input type="number" value={value} min={min} max={max}
      onChange={e=>onChange(Math.min(max,Math.max(min,Number(e.target.value))))}
      className="h-7 px-2 border rounded-lg text-[12px] text-center outline-none bg-white"
      style={{borderColor:T.border,color:T.t1,width}}/>
  );
}
function Toggle({on,onToggle}:{on:boolean;onToggle:()=>void}){
  return(
    <button onClick={onToggle} className="relative flex-shrink-0 rounded-full transition-colors"
      style={{width:28,height:16,backgroundColor:on?T.primary:T.t4}}>
      <span className="absolute top-[2px] rounded-full bg-white transition-all"
        style={{width:12,height:12,left:on?14:2}}/>
    </button>
  );
}
function StatusDot({status}:{status:"pass"|"fail"|"running"|null}){
  if(!status) return <span className="text-[11px]" style={{color:T.t4}}>未运行</span>;
  const cfg={pass:{color:T.success,label:"通过"},fail:{color:T.danger,label:"失败"},running:{color:T.primary,label:"运行中"}};
  const c=cfg[status];
  return(
    <span className="flex items-center gap-1.5 text-[12px] font-medium" style={{color:c.color}}>
      <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:c.color}}/>
      {c.label}
    </span>
  );
}
function PTag({p}:{p:Priority}){
  const s=PRIORITY_STYLE[p];
  return<span className="px-1.5 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:s.bg,color:s.color}}>{p}</span>;
}
function MethodTag({m}:{m:Method}){
  const s=METHOD_STYLE[m];
  return<span className="w-14 text-center rounded text-[10px] font-bold py-0.5" style={{backgroundColor:s.bg,color:s.color}}>{m}</span>;
}
function StepBadge({type}:{type:StepType}){
  const c=STEP_CFG[type];
  return<span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0" style={{backgroundColor:c.bg,color:c.color}}>{c.label}</span>;
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({title,onClose,children,width=560}:{title:string;onClose:()=>void;children:React.ReactNode;width?:number}){
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.36)"}}>
      <div className="rounded-2xl shadow-2xl bg-white flex flex-col overflow-hidden" style={{width,maxHeight:"82vh"}}>
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <p className="font-semibold text-[15px]" style={{color:T.t1}}>{title}</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100">
            <X size={15} style={{color:T.t3}}/>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ─── Add Step Dialog ──────────────────────────────────────────────────────────
function AddStepDialog({onAdd,onClose}:{onAdd:(type:StepType)=>void;onClose:()=>void}){
  return(
    <Modal title="选择步骤类型" onClose={onClose} width={640}>
      <div className="p-5 grid grid-cols-2 gap-3">
        {(Object.keys(STEP_CFG) as StepType[]).map(type=>{
          const c=STEP_CFG[type];
          const Icon=c.icon;
          return(
            <button key={type} onClick={()=>{onAdd(type);onClose();}}
              className="flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-md"
              style={{borderColor:T.border}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=c.color;e.currentTarget.style.backgroundColor=c.bg;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.backgroundColor="transparent";}}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{backgroundColor:c.bg}}>
                <Icon size={16} color={c.color}/>
              </div>
              <div>
                <p className="text-[13px] font-semibold" style={{color:T.t1}}>{c.label}</p>
                <p className="text-[12px] mt-0.5" style={{color:T.t3}}>{c.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

// ─── Import Resource Dialog ───────────────────────────────────────────────────
function ImportResourceDialog({onClose}:{onClose:(steps:Step[])=>void}){
  const[tab,setTab]=useState<"api"|"case"|"scene">("case");
  const[search,setSearch]=useState("");
  const[selected,setSelected]=useState<Set<string>>(new Set());
  const[importMode,setImportMode]=useState<"ref"|"copy">("ref");

  const buildSteps=():Step[]=>{
    const now=Date.now();
    if(tab==="case"){
      return MOCK_CANDIDATE_CASES.filter(c=>selected.has(c.id)).map((c,i)=>({
        id:`st${now}_${i}`,
        type:(importMode==="ref"?"ref-case":"custom") as StepType,
        name:c.name, method:c.method, path:c.path,
        enabled:true, depth:0,
      }));
    }
    if(tab==="scene"){
      return MOCK_CANDIDATE_SCENES.filter(s=>selected.has(s.id)).map((s,i)=>({
        id:`st${now}_${i}`,
        type:"ref-scene" as StepType,
        name:s.name, enabled:true, depth:0,
      }));
    }
    return [];
  };

  const caseRows=MOCK_CANDIDATE_CASES.filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase()));
  const sceneRows=MOCK_CANDIDATE_SCENES.filter(s=>!search||s.name.toLowerCase().includes(search.toLowerCase()));

  const toggle=(id:string)=>{
    const n=new Set(selected);
    if(n.has(id))n.delete(id);else n.add(id);
    setSelected(n);
  };

  return(
    <Modal title="导入步骤" onClose={()=>onClose([])} width={720}>
      <div className="flex flex-col" style={{height:500}}>
        {/* Tabs + search */}
        <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div className="flex gap-1">
            {([["case","接口用例"],["scene","场景"],["api","接口"]] as const).map(([k,l])=>(
              <button key={k} onClick={()=>{setTab(k);setSelected(new Set());}}
                className="px-3 py-1 rounded-md text-[12px] font-medium transition-colors"
                style={{backgroundColor:tab===k?T.primary:"transparent",color:tab===k?"#fff":T.t2}}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Sel value="X-MAN" onChange={()=>{}} options={["X-MAN","全部工作空间"]} width={120}/>
            <div className="relative">
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索名称 / 路径"
                className="h-7 pl-7 pr-3 border rounded-lg text-[12px] outline-none"
                style={{borderColor:T.border,color:T.t1,width:180}}/>
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{color:T.t3}}/>
            </div>
          </div>
        </div>
        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {tab==="case"&&(
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{backgroundColor:T.bg,borderBottom:`1px solid ${T.border}`}}>
                  <th className="px-4 py-2 text-left w-8"><input type="checkbox" className="rounded"/></th>
                  <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>ID</th>
                  <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>用例名称</th>
                  <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>方法</th>
                  <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>请求路径</th>
                  <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>所属接口</th>
                </tr>
              </thead>
              <tbody>
                {caseRows.map((c,i)=>(
                  <tr key={c.id} style={{borderBottom:`1px solid ${T.border}`,backgroundColor:i%2===0?"transparent":T.bg+"80",opacity:c.inSuite?.6:1}}>
                    <td className="px-4 py-2.5">
                      {c.inSuite
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#F2F3F5",color:T.t3}}>已在套件</span>
                        : <input type="checkbox" checked={selected.has(c.id)} onChange={()=>toggle(c.id)} className="rounded"/>
                      }
                    </td>
                    <td className="px-2 py-2.5 font-mono" style={{color:T.t3}}>{c.id}</td>
                    <td className="px-2 py-2.5 font-medium" style={{color:T.t1}}>{c.name}</td>
                    <td className="px-2 py-2.5"><MethodTag m={c.method}/></td>
                    <td className="px-2 py-2.5 font-mono" style={{color:T.t2}}>{c.path}</td>
                    <td className="px-2 py-2.5" style={{color:T.t3}}>{c.api}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab==="scene"&&(
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{backgroundColor:T.bg,borderBottom:`1px solid ${T.border}`}}>
                  <th className="px-4 py-2 text-left w-8"><input type="checkbox" className="rounded"/></th>
                  <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>ID</th>
                  <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>场景名称</th>
                  <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>所属模块</th>
                  <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>步骤数</th>
                  <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>状态</th>
                </tr>
              </thead>
              <tbody>
                {sceneRows.map((s,i)=>(
                  <tr key={s.id} style={{borderBottom:`1px solid ${T.border}`,backgroundColor:i%2===0?"transparent":T.bg+"80",opacity:s.inSuite?.6:1}}>
                    <td className="px-4 py-2.5">
                      {s.inSuite
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#F2F3F5",color:T.t3}}>已在套件</span>
                        : <input type="checkbox" checked={selected.has(s.id)} onChange={()=>toggle(s.id)} className="rounded"/>
                      }
                    </td>
                    <td className="px-2 py-2.5 font-mono" style={{color:T.t3}}>{s.id}</td>
                    <td className="px-2 py-2.5 font-medium" style={{color:T.t1}}>{s.name}</td>
                    <td className="px-2 py-2.5" style={{color:T.t3}}>{s.module}</td>
                    <td className="px-2 py-2.5" style={{color:T.t2}}>{s.steps} 个</td>
                    <td className="px-2 py-2.5"><StatusDot status={s.status==="active"?"pass":null}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab==="api"&&(
            <div className="flex items-center justify-center py-16" style={{color:T.t3}}>
              <p className="text-[13px]">请从左侧选择模块以浏览接口</p>
            </div>
          )}
        </div>
        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{borderTop:`1px solid ${T.border}`}}>
          <p className="text-[12px]" style={{color:T.t3}}>
            已选择 <strong style={{color:T.primary}}>{selected.size}</strong> 项
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[12px]" style={{color:T.t3}}>导入方式：</span>
            {(["ref","copy"] as const).map(m=>(
              <button key={m} onClick={()=>setImportMode(m)}
                className="h-6 px-2.5 rounded text-[11px] font-medium border transition-colors"
                style={{borderColor:m===importMode?T.primary:T.border,
                  backgroundColor:m===importMode?"#E8F3FF":"transparent",
                  color:m===importMode?T.primary:T.t2}}>
                {m==="ref"?"引用":"复制"}
              </button>
            ))}
            <div className="w-px h-4 mx-1" style={{backgroundColor:T.border}}/>
            <Btn ghost onClick={()=>onClose([])}>取消</Btn>
            <Btn onClick={()=>onClose(buildSteps())} disabled={selected.size===0}>
              导入 {selected.size>0?`(${selected.size})`:""}
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Custom Request Panel ─────────────────────────────────────────────────────
function CustomRequestPanel({step,onClose}:{step:Step;onClose:()=>void}){
  const[method,setMethod]=useState<Method>(step.method||"POST");
  const[url,setUrl]=useState(step.path||"");
  const[tab,setTab]=useState("params");
  const[ran,setRan]=useState(false);
  const methods:Method[]=["GET","POST","PUT","DELETE","PATCH"];
  const configTabs=[
    {k:"params",l:"Params"},{k:"headers",l:"Headers"},{k:"body",l:"Body"},
    {k:"auth",l:"Auth"},{k:"pre",l:"前置处理"},{k:"post",l:"后置处理"},
    {k:"assert",l:"断言"},{k:"settings",l:"设置"},
  ];
  return(
    <div className="fixed inset-0 z-50 flex items-end justify-end" style={{backgroundColor:"rgba(0,0,0,.3)"}}>
      <div className="flex flex-col bg-white shadow-2xl" style={{width:680,height:"100vh",borderLeft:`1px solid ${T.border}`}}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <p className="font-semibold text-[14px]" style={{color:T.t1}}>配置步骤 · {step.name}</p>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100">
            <X size={15} style={{color:T.t3}}/>
          </button>
        </div>
        {/* URL bar */}
        <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <select value={method} onChange={e=>setMethod(e.target.value as Method)}
            className="h-8 px-2 border rounded-lg text-[12px] font-bold outline-none"
            style={{borderColor:METHOD_STYLE[method].color,color:METHOD_STYLE[method].color,backgroundColor:METHOD_STYLE[method].bg,width:88}}>
            {methods.map(m=><option key={m}>{m}</option>)}
          </select>
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="请输入请求 URL"
            className="flex-1 h-8 px-3 border rounded-lg text-[12px] outline-none font-mono"
            style={{borderColor:T.border,color:T.t1}}/>
          <button onClick={()=>setRan(true)}
            className="h-8 px-4 rounded-lg text-[12px] font-medium text-white flex items-center gap-1.5"
            style={{backgroundColor:T.success}}>
            <Zap size={12}/>调试
          </button>
        </div>
        {/* Tabs */}
        <div className="flex gap-0 flex-shrink-0 px-4" style={{borderBottom:`1px solid ${T.border}`}}>
          {configTabs.map(({k,l})=>(
            <button key={k} onClick={()=>setTab(k)}
              className="px-3 py-2 text-[12px] font-medium border-b-2 transition-colors"
              style={{borderBottomColor:tab===k?T.primary:"transparent",color:tab===k?T.primary:T.t3}}>
              {l}
            </button>
          ))}
        </div>
        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {tab==="params"&&(
            <div>
              <table className="w-full text-[12px] mb-3">
                <thead><tr style={{color:T.t3}}>
                  <th className="text-left py-1 w-8"/>
                  <th className="text-left py-1 w-1/3">参数名</th>
                  <th className="text-left py-1">参数值</th>
                  <th className="text-left py-1 w-8"/>
                </tr></thead>
                <tbody>
                  {[{k:"pageSize",v:"20"},{k:"pageNum",v:"1"}].map((r,i)=>(
                    <tr key={i}>
                      <td className="py-1"><input type="checkbox" defaultChecked className="rounded"/></td>
                      <td className="py-1 pr-2"><input defaultValue={r.k} className="w-full h-7 px-2 border rounded text-[12px] outline-none" style={{borderColor:T.border}}/></td>
                      <td className="py-1 pr-2"><input defaultValue={r.v} className="w-full h-7 px-2 border rounded text-[12px] outline-none" style={{borderColor:T.border}}/></td>
                      <td className="py-1"><IBtn icon={Trash2} label="删除" danger/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="text-[12px] flex items-center gap-1" style={{color:T.primary}}>
                <Plus size={12}/>添加参数
              </button>
            </div>
          )}
          {tab==="body"&&(
            <div>
              <div className="flex gap-3 mb-3">
                {["none","json","form-data","x-www-form-urlencoded","raw"].map(m=>(
                  <label key={m} className="flex items-center gap-1 text-[12px] cursor-pointer" style={{color:T.t2}}>
                    <input type="radio" name="bodyType" defaultChecked={m==="json"} className="accent-blue-600"/>{m}
                  </label>
                ))}
              </div>
              <textarea defaultValue={'{\n  "name": "测试产品",\n  "price": 99.9,\n  "category": "{{category}}"\n}'}
                className="w-full border rounded-lg p-3 text-[12px] font-mono outline-none resize-none"
                style={{height:200,borderColor:T.border,color:T.t1,backgroundColor:"#FAFAFA"}}/>
            </div>
          )}
          {tab==="assert"&&(
            <div className="space-y-3">
              <div className="p-3 rounded-xl border" style={{borderColor:T.border}}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-semibold" style={{color:T.t1}}>断言规则</p>
                  <Btn small ghost icon={Plus}>添加断言</Btn>
                </div>
                {[
                  {type:"状态码",op:"等于",val:"200"},
                  {type:"响应体",op:"JSON路径",val:"$.data.id 不为空"},
                ].map((a,i)=>(
                  <div key={i} className="flex items-center gap-2 py-2" style={{borderTop:`1px solid ${T.border}`}}>
                    <select className="h-6 px-2 border rounded text-[11px] outline-none" style={{borderColor:T.border}}><option>{a.type}</option></select>
                    <select className="h-6 px-2 border rounded text-[11px] outline-none" style={{borderColor:T.border}}><option>{a.op}</option></select>
                    <input defaultValue={a.val} className="flex-1 h-6 px-2 border rounded text-[11px] outline-none" style={{borderColor:T.border}}/>
                    <IBtn icon={Trash2} label="删除" danger/>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(tab==="pre"||tab==="post")&&(
            <div className="space-y-2">
              {[{type:"脚本",desc:"JavaScript 前置脚本"}].map((item,i)=>(
                <div key={i} className="p-3 rounded-xl border" style={{borderColor:T.border}}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-medium" style={{color:T.t1}}>{item.type}</span>
                    <IBtn icon={Trash2} label="删除" danger/>
                  </div>
                  <textarea defaultValue="// pm.variables.set('token', pm.response.json().data.token);"
                    className="w-full border rounded p-2 text-[11px] font-mono outline-none resize-none"
                    style={{height:80,borderColor:T.border,backgroundColor:"#FAFAFA"}}/>
                </div>
              ))}
              <button className="text-[12px] flex items-center gap-1" style={{color:T.primary}}>
                <Plus size={12}/>添加{tab==="pre"?"前置":"后置"}处理
              </button>
            </div>
          )}
          {(tab==="headers"||tab==="auth"||tab==="settings")&&(
            <div className="flex items-center justify-center py-12" style={{color:T.t3}}>
              <p className="text-[12px]">{tab==="settings"?"步骤超时、重试等配置":"请配置相应参数"}</p>
            </div>
          )}
        </div>
        {/* Response panel */}
        {ran&&(
          <div className="flex-shrink-0" style={{borderTop:`1px solid ${T.border}`,height:220}}>
            <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded" style={{backgroundColor:"#E8FFEA",color:T.success}}>200 OK</span>
              <span className="text-[11px]" style={{color:T.t3}}>342 ms · 1.2 KB</span>
              <div className="flex-1"/>
              {["Body","响应头","断言结果","控制台"].map(t=>(
                <button key={t} className="text-[11px] px-2 py-0.5 rounded hover:bg-gray-100" style={{color:T.t2}}>{t}</button>
              ))}
            </div>
            <pre className="p-4 text-[11px] font-mono overflow-auto" style={{height:176,color:T.t1}}>
{`{
  "code": 0,
  "data": {
    "id": "prod_20240714_001",
    "name": "测试产品",
    "status": "active"
  },
  "message": "success"
}`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step Row ─────────────────────────────────────────────────────────────────
function StepRow({step,index,total,onToggle,onDelete,onMoveUp,onMoveDown,onCopy,onConfig,onUpdateChildren}:{
  step:Step;index:number;total:number;
  onToggle:()=>void;onDelete:()=>void;onMoveUp:()=>void;onMoveDown:()=>void;onCopy:()=>void;onConfig:()=>void;
  onUpdateChildren?:(children:Step[])=>void;
}){
  const isCtrl=step.type==="loop"||step.type==="condition"||step.type==="once";
  const rowBg=step.depth>0?"#FAFBFF":"#fff";
  return(
    <div>
      <div className="flex items-center gap-2 px-3 py-2.5 group rounded-lg transition-colors"
        style={{paddingLeft:12+step.depth*20,backgroundColor:rowBg,opacity:step.enabled?1:.5,
          borderLeft:isCtrl?`3px solid ${STEP_CFG[step.type].color}`:"3px solid transparent"}}>
        {/* Drag handle */}
        <GripVertical size={14} className="flex-shrink-0 opacity-30 cursor-grab group-hover:opacity-60" style={{color:T.t3}}/>
        {/* Toggle */}
        <Toggle on={step.enabled} onToggle={onToggle}/>
        {/* Index */}
        <span className="w-5 text-center text-[11px] flex-shrink-0" style={{color:T.t4}}>{index+1}</span>
        {/* Step type badge */}
        <StepBadge type={step.type}/>
        {/* Method badge (for HTTP steps) */}
        {step.method&&<MethodTag m={step.method}/>}
        {/* Name */}
        <span className="flex-1 text-[13px] truncate" style={{color:T.t1}}>{step.name}</span>
        {/* Path (for HTTP steps) */}
        {step.path&&<span className="text-[11px] font-mono truncate max-w-[200px]" style={{color:T.t3}}>{step.path}</span>}
        {/* Children count (for controllers) */}
        {isCtrl&&step.children&&(
          <span className="text-[11px] px-1.5 py-0.5 rounded" style={{backgroundColor:STEP_CFG[step.type].bg,color:STEP_CFG[step.type].color}}>
            {step.children.length} 子步骤
          </span>
        )}
        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <IBtn icon={ChevronRight} label="配置" onClick={onConfig}/>
          <IBtn icon={ArrowUp} label="上移" onClick={onMoveUp} disabled={index===0}/>
          <IBtn icon={ArrowDown} label="下移" onClick={onMoveDown} disabled={index===total-1}/>
          <IBtn icon={Copy} label="复制" onClick={onCopy}/>
          <IBtn icon={Trash2} label="删除" danger onClick={onDelete}/>
        </div>
      </div>
      {/* Nested children */}
      {isCtrl&&step.children&&step.children.map((child,ci)=>{
        const ch=step.children!;
        const upd=(next:Step[])=>onUpdateChildren?.(next);
        return(
          <StepRow key={child.id} step={child} index={ci} total={ch.length}
            onToggle={()=>upd(ch.map(c=>c.id===child.id?{...c,enabled:!c.enabled}:c))}
            onDelete={()=>upd(ch.filter(c=>c.id!==child.id))}
            onMoveUp={()=>{if(ci===0)return;const a=[...ch];[a[ci],a[ci-1]]=[a[ci-1],a[ci]];upd(a);}}
            onMoveDown={()=>{if(ci===ch.length-1)return;const a=[...ch];[a[ci],a[ci+1]]=[a[ci+1],a[ci]];upd(a);}}
            onCopy={()=>{const a=[...ch];a.splice(ci+1,0,{...child,id:`st${Date.now()}`,name:child.name+" (副本)"});upd(a);}}
            onConfig={onConfig}/>
        );
      })}
      {/* Add child step button for controllers */}
      {isCtrl&&(
        <button className="flex items-center gap-1.5 text-[11px] py-1.5 rounded-lg transition-colors"
          style={{paddingLeft:32+step.depth*20,color:STEP_CFG[step.type].color}}>
          <Plus size={11}/>添加子步骤
        </button>
      )}
    </div>
  );
}

// ─── Test Data Tab ────────────────────────────────────────────────────────────
function TestDataTab(){
  const[datasets]=useState([{id:"ds1",name:"注册测试数据集",enabled:true,rows:5},{id:"ds2",name:"批量导入数据",enabled:false,rows:20}]);
  const[selDs,setSelDs]=useState("ds1");
  const cols=["描述(caseDesc)","用户名","密码","手机号","期望状态"];
  const rows=[
    ["正常注册","user_001","Aa123456","13800001001","success"],
    ["重复手机号","user_002","Aa123456","13800001001","fail"],
    ["弱密码","user_003","123456","13800001003","fail"],
    ["正常注册2","user_004","Aa123456","13800001004","success"],
    ["特殊字符","user_005","Aa!@#456","13800001005","success"],
  ];
  return(
    <div className="flex-1 flex overflow-hidden">
      {/* Left: dataset list */}
      <div className="flex-shrink-0 border-r overflow-y-auto" style={{width:220,borderColor:T.border}}>
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-semibold" style={{color:T.t2}}>数据集列表</p>
            <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100"><Plus size={13} style={{color:T.primary}}/></button>
          </div>
          {datasets.map(ds=>(
            <div key={ds.id} onClick={()=>setSelDs(ds.id)}
              className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer mb-1 transition-colors"
              style={{backgroundColor:selDs===ds.id?"#E8F3FF":"transparent"}}>
              <Toggle on={ds.enabled} onToggle={()=>{}}/>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium truncate" style={{color:selDs===ds.id?T.primary:T.t1}}>{ds.name}</p>
                <p className="text-[11px]" style={{color:T.t3}}>{ds.rows} 行数据</p>
              </div>
              <IBtn icon={MoreHorizontal} label="操作"/>
            </div>
          ))}
        </div>
      </div>
      {/* Right: dataset editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <p className="text-[13px] font-semibold flex-1" style={{color:T.t1}}>注册测试数据集</p>
          <Btn ghost small icon={Upload}>导入 CSV</Btn>
          <Btn ghost small icon={Database}>导入 JSON</Btn>
          <div className="w-px h-4 mx-1" style={{backgroundColor:T.border}}/>
          <Btn ghost small icon={Database}>导出 CSV</Btn>
          <Btn ghost small>添加变量列</Btn>
          <Btn small icon={Plus} color={T.success}>添加数据行</Btn>
        </div>
        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="text-[12px]" style={{minWidth:"100%"}}>
            <thead>
              <tr style={{backgroundColor:T.bg,position:"sticky",top:0}}>
                <th className="px-3 py-2 text-left font-medium w-8" style={{color:T.t3}}>#</th>
                {cols.map(c=>(
                  <th key={c} className="px-3 py-2 text-left font-medium whitespace-nowrap" style={{color:T.t3,minWidth:120}}>
                    <div className="flex items-center gap-1">{c}<IBtn icon={Trash2} label="删除列" danger/></div>
                  </th>
                ))}
                <th className="px-3 py-2 w-8"/>
              </tr>
            </thead>
            <tbody>
              {rows.map((row,ri)=>(
                <tr key={ri} style={{borderBottom:`1px solid ${T.border}`}} className="hover:bg-blue-50/30">
                  <td className="px-3 py-2 text-center" style={{color:T.t4}}>{ri+1}</td>
                  {row.map((cell,ci)=>(
                    <td key={ci} className="px-2 py-1.5">
                      <input defaultValue={cell} className="w-full h-6 px-2 border rounded text-[11px] outline-none" style={{borderColor:"transparent",color:T.t1,backgroundColor:"transparent"}}
                        onFocus={e=>{e.target.style.borderColor=T.primary;e.target.style.backgroundColor="#fff";}}
                        onBlur={e=>{e.target.style.borderColor="transparent";e.target.style.backgroundColor="transparent";}}/>
                    </td>
                  ))}
                  <td className="px-2 py-1.5"><IBtn icon={Trash2} label="删除行" danger/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Scene Settings Tab ───────────────────────────────────────────────────────
function SceneSettingsTab(){
  return(
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-lg space-y-5">
        {[
          {label:"失败后继续执行",desc:"单步失败后继续执行后续步骤",type:"toggle",default:false},
          {label:"全局超时时间 (ms)",desc:"整个场景的最大执行时间",type:"number",default:"30000"},
          {label:"步骤失败重试次数",desc:"单步失败时自动重试次数，0 表示不重试",type:"number",default:"0"},
          {label:"步骤间默认等待 (ms)",desc:"每个步骤执行前的默认等待时间",type:"number",default:"0"},
        ].map(item=>(
          <div key={item.label} className="flex items-center justify-between p-4 rounded-xl border" style={{borderColor:T.border}}>
            <div>
              <p className="text-[13px] font-medium" style={{color:T.t1}}>{item.label}</p>
              <p className="text-[12px] mt-0.5" style={{color:T.t3}}>{item.desc}</p>
            </div>
            {item.type==="toggle"
              ? <Toggle on={item.default as boolean} onToggle={()=>{}}/>
              : <input type="number" defaultValue={item.default as string}
                  className="h-8 w-24 px-3 border rounded-lg text-[13px] text-right outline-none"
                  style={{borderColor:T.border}}/>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Right Run Config Panel ───────────────────────────────────────────────────
function SceneRunConfig({scene,onChange}:{scene:Scene;onChange:(s:Scene)=>void}){
  return(
    <div className="flex-shrink-0 overflow-y-auto flex flex-col gap-0"
      style={{width:220,borderLeft:`1px solid ${T.border}`,backgroundColor:"#FAFBFE"}}>
      {/* Env + buttons */}
      <div className="p-3 space-y-2" style={{borderBottom:`1px solid ${T.border}`}}>
        <div className="flex items-center gap-1.5">
          <select value={scene.env} onChange={e=>onChange({...scene,env:e.target.value})}
            className="flex-1 h-7 px-2 border rounded-lg text-[12px] outline-none bg-white"
            style={{borderColor:T.border,color:T.t1}}>
            {ENVS.map(e=><option key={e}>{e}</option>)}
          </select>
          <button className="w-7 h-7 flex items-center justify-center rounded-lg border bg-white" style={{borderColor:T.border}}>
            <Settings size={12} style={{color:T.t3}}/>
          </button>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 h-8 rounded-lg text-[12px] font-semibold text-white flex items-center justify-center gap-1.5"
            style={{backgroundColor:T.primary}}>
            <Play size={12}/>运行
          </button>
          <button className="flex-1 h-8 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1.5 border bg-white"
            style={{borderColor:T.border,color:T.t2}}>
            <Save size={12}/>保存
          </button>
        </div>
      </div>
      {/* Config fields */}
      <div className="p-3 space-y-3 text-[12px]">
        {/* Module */}
        <div>
          <p className="font-medium mb-1" style={{color:T.t2}}>
            <span style={{color:T.danger}}>*</span> 所属模块
          </p>
          <select value={scene.module} onChange={e=>onChange({...scene,module:e.target.value})}
            className="w-full h-7 px-2 border rounded-lg text-[12px] outline-none bg-white"
            style={{borderColor:T.border,color:T.t1}}>
            {MODULES.filter(m=>m!=="全部").map(m=><option key={m}>{m}</option>)}
          </select>
        </div>
        {/* Test data */}
        <div>
          <p className="font-medium mb-1" style={{color:T.t2}}>测试数据</p>
          <select value={scene.testData||"不使用测试数据"} onChange={e=>onChange({...scene,testData:e.target.value==="不使用测试数据"?null:e.target.value})}
            className="w-full h-7 px-2 border rounded-lg text-[12px] outline-none bg-white"
            style={{borderColor:T.border,color:T.t1}}>
            {["不使用测试数据","注册测试数据集","订单压测数据集"].map(d=><option key={d}>{d}</option>)}
          </select>
        </div>
        {/* Iterations + threads */}
        <div className="flex gap-2">
          <div className="flex-1">
            <p className="font-medium mb-1" style={{color:T.t2}}>循环次数</p>
            <NumInp value={scene.iterations} onChange={v=>onChange({...scene,iterations:v})} max={999}/>
          </div>
          <div className="flex-1">
            <p className="font-medium mb-1" style={{color:T.t2}}>线程数</p>
            <NumInp value={scene.threads} onChange={v=>onChange({...scene,threads:v})} max={99}/>
          </div>
        </div>
        {/* Run location */}
        <div>
          <p className="font-medium mb-1" style={{color:T.t2}}>运行于</p>
          <select value={scene.runLocation==="server"?"服务端执行":"本地执行器"}
            onChange={e=>onChange({...scene,runLocation:e.target.value.includes("服务端")?"server":"runner"})}
            className="w-full h-7 px-2 border rounded-lg text-[12px] outline-none bg-white"
            style={{borderColor:T.border,color:T.t1}}>
            <option>服务端执行</option>
            <option>本地执行器</option>
          </select>
        </div>
        {/* Runner picker */}
        {scene.runLocation==="runner"&&(
          <div>
            <p className="font-medium mb-1" style={{color:T.t2}}>选择 Runner</p>
            <select value={scene.runnerId||RUNNERS[0].id} onChange={e=>onChange({...scene,runnerId:e.target.value})}
              className="w-full h-7 px-2 border rounded-lg text-[12px] outline-none bg-white"
              style={{borderColor:T.border,color:T.t1}}>
              {RUNNERS.map(r=><option key={r.id} value={r.id}>{r.name} ({r.status})</option>)}
            </select>
          </div>
        )}
        {/* Variable set */}
        <div>
          <p className="font-medium mb-1" style={{color:T.t2}}>变量集</p>
          <select value={scene.variableSet||"请选择变量集"}
            onChange={e=>onChange({...scene,variableSet:e.target.value==="请选择变量集"?null:e.target.value})}
            className="w-full h-7 px-2 border rounded-lg text-[12px] outline-none bg-white"
            style={{borderColor:T.border,color:T.t1}}>
            <option>请选择变量集</option>
            {VARIABLE_SETS.map(v=><option key={v}>{v}</option>)}
          </select>
        </div>
        {/* Tags */}
        <div>
          <p className="font-medium mb-1.5" style={{color:T.t2}}>标签</p>
          <div className="flex flex-wrap gap-1">
            {scene.tags.map(tag=>(
              <span key={tag} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px]"
                style={{backgroundColor:"#E8F3FF",color:T.primary}}>
                {tag}
                <button onClick={()=>onChange({...scene,tags:scene.tags.filter(t=>t!==tag)})} className="hover:opacity-70">
                  <X size={9}/>
                </button>
              </span>
            ))}
            <button className="text-[11px]" style={{color:T.t3}}>+ 添加</button>
          </div>
        </div>
      </div>
      {/* Last run */}
      {scene.lastRun&&(
        <div className="p-3 mt-auto" style={{borderTop:`1px solid ${T.border}`}}>
          <p className="text-[11px] font-medium mb-1" style={{color:T.t3}}>上次运行</p>
          <StatusDot status={scene.lastResult}/>
          <p className="text-[10px] mt-0.5" style={{color:T.t4}}>{scene.lastRun}</p>
        </div>
      )}
    </div>
  );
}

// ─── Scene Editor (step orchestration) ───────────────────────────────────────
function SceneEditor({scene,onChange}:{scene:Scene;onChange:(s:Scene)=>void}){
  const[subTab,setSubTab]=useState<"steps"|"data"|"settings">("steps");
  const[editingName,setEditingName]=useState(false);
  const[nameVal,setNameVal]=useState(scene.name);
  const[showAddStep,setShowAddStep]=useState(false);
  const[showImport,setShowImport]=useState(false);
  const[configStep,setConfigStep]=useState<Step|null>(null);

  const flatSteps=scene.steps;

  const addStep=(type:StepType)=>{
    const newStep:Step={
      id:`st${Date.now()}`,type,
      name:STEP_CFG[type].label+(type==="custom"?" 请求":" 步骤"),
      enabled:true,depth:0,
      ...(type==="loop"||type==="condition"||type==="once"?{children:[]}:{}),
    };
    onChange({...scene,steps:[...scene.steps,newStep]});
  };

  const deleteStep=(id:string)=>{
    onChange({...scene,steps:scene.steps.filter(s=>s.id!==id)});
  };

  const toggleStep=(id:string)=>{
    onChange({...scene,steps:scene.steps.map(s=>s.id===id?{...s,enabled:!s.enabled}:s)});
  };

  const moveStep=(id:string,dir:-1|1)=>{
    const arr=[...scene.steps];
    const i=arr.findIndex(s=>s.id===id);
    if(i+dir<0||i+dir>=arr.length)return;
    [arr[i],arr[i+dir]]=[arr[i+dir],arr[i]];
    onChange({...scene,steps:arr});
  };

  const subTabs=[{k:"steps",l:`步骤 (${flatSteps.length})`},{k:"data",l:"测试数据"},{k:"settings",l:"设置"}] as const;

  return(
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sub-tab bar */}
        <div className="flex items-center flex-shrink-0 px-4" style={{borderBottom:`1px solid ${T.border}`,height:38,backgroundColor:"#fff"}}>
          {subTabs.map(({k,l})=>(
            <button key={k} onClick={()=>setSubTab(k)}
              className="h-full px-4 text-[12px] font-medium border-b-2 transition-colors"
              style={{borderBottomColor:subTab===k?T.primary:"transparent",color:subTab===k?T.primary:T.t3}}>
              {l}
            </button>
          ))}
        </div>

        {subTab==="steps"&&(
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Scene info bar */}
            <div className="flex-shrink-0 px-4 py-3" style={{borderBottom:`1px solid ${T.border}`,backgroundColor:"#FAFBFE"}}>
              <div className="flex items-center gap-2 mb-1.5">
                {/* Priority dropdown */}
                <select value={scene.priority} onChange={e=>onChange({...scene,priority:e.target.value as Priority})}
                  className="h-6 px-2 rounded text-[11px] font-bold border outline-none"
                  style={{backgroundColor:PRIORITY_STYLE[scene.priority].bg,color:PRIORITY_STYLE[scene.priority].color,borderColor:PRIORITY_STYLE[scene.priority].color}}>
                  {(["P0","P1","P2","P3"] as Priority[]).map(p=><option key={p}>{p}</option>)}
                </select>
                {/* Name */}
                {editingName
                  ? <input autoFocus value={nameVal} onChange={e=>setNameVal(e.target.value)}
                      onBlur={()=>{onChange({...scene,name:nameVal});setEditingName(false);}}
                      onKeyDown={e=>{if(e.key==="Enter"){onChange({...scene,name:nameVal});setEditingName(false);}}}
                      className="text-[14px] font-semibold outline-none border-b px-1"
                      style={{color:T.t1,borderColor:T.primary}}/>
                  : <span className="text-[14px] font-semibold flex items-center gap-1.5 cursor-pointer" style={{color:T.t1}}
                      onClick={()=>setEditingName(true)}>
                      {scene.name}<Edit2 size={12} style={{color:T.t3}}/>
                    </span>
                }
              </div>
              {scene.desc&&<p className="text-[12px] mb-1" style={{color:T.t3}}>{scene.desc}</p>}
              <p className="text-[11px]" style={{color:T.t4}}>
                X-MAN · 更新于 2026-07-14 · {scene.module}
              </p>
            </div>
            {/* Steps header */}
            <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
              <p className="text-[12px]" style={{color:T.t2}}>共 <strong>{flatSteps.length}</strong> 个步骤</p>
              <div className="flex items-center gap-2">
                <Btn ghost small icon={Upload} onClick={()=>setShowImport(true)}>导入步骤</Btn>
                <Btn small icon={Plus} onClick={()=>setShowAddStep(true)}>添加步骤</Btn>
              </div>
            </div>
            {/* Step list */}
            <div className="flex-1 overflow-y-auto py-2 px-3" style={{backgroundColor:"#FAFBFE"}}>
              {flatSteps.length===0
                ? (
                  <div className="flex flex-col items-center justify-center py-16" style={{color:T.t3}}>
                    <Layers size={32} style={{color:T.t4,marginBottom:8}}/>
                    <p className="text-[13px] mb-3">还没有步骤，点击添加开始编排</p>
                    <Btn small icon={Plus} onClick={()=>setShowAddStep(true)}>添加步骤</Btn>
                  </div>
                )
                : flatSteps.map((step,i)=>(
                  <div key={step.id} className="mb-1 rounded-lg border overflow-hidden" style={{borderColor:T.border}}>
                    <StepRow
                      step={step} index={i} total={flatSteps.length}
                      onToggle={()=>toggleStep(step.id)}
                      onDelete={()=>deleteStep(step.id)}
                      onMoveUp={()=>moveStep(step.id,-1)}
                      onMoveDown={()=>moveStep(step.id,1)}
                      onCopy={()=>{
                        const copy:Step={...step,id:`st${Date.now()}`,name:step.name+" (副本)"};
                        const arr=[...scene.steps];arr.splice(i+1,0,copy);
                        onChange({...scene,steps:arr});
                      }}
                      onConfig={()=>setConfigStep(step)}
                      onUpdateChildren={(children)=>onChange({...scene,steps:scene.steps.map(s=>s.id===step.id?{...s,children}:s)})}
                    />
                  </div>
                ))
              }
              {flatSteps.length>0&&(
                <button onClick={()=>setShowAddStep(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-dashed border text-[12px] transition-colors mt-2 hover:bg-blue-50"
                  style={{borderColor:T.border,color:T.t3}}>
                  <Plus size={13}/>添加测试步骤
                </button>
              )}
            </div>
          </div>
        )}

        {subTab==="data"&&<TestDataTab/>}
        {subTab==="settings"&&<SceneSettingsTab/>}
      </div>

      {/* Right config panel */}
      <SceneRunConfig scene={scene} onChange={onChange}/>

      {/* Dialogs */}
      {showAddStep&&<AddStepDialog onAdd={addStep} onClose={()=>setShowAddStep(false)}/>}
      {showImport&&<ImportResourceDialog onClose={steps=>{if(steps.length>0)onChange({...scene,steps:[...scene.steps,...steps]});setShowImport(false);}}/>}
      {configStep&&<CustomRequestPanel step={configStep} onClose={()=>setConfigStep(null)}/>}
    </div>
  );
}

// ─── Scene List Page ──────────────────────────────────────────────────────────
function SceneListPage({scenes,onOpen,onCreate}:{scenes:Scene[];onOpen:(id:string)=>void;onCreate:()=>void}){
  const[search,setSearch]=useState("");
  const[filterModule,setFilterModule]=useState("全部");
  const[filterStatus,setFilterStatus]=useState("全部");
  const filtered=scenes.filter(s=>{
    if(search&&!s.name.toLowerCase().includes(search.toLowerCase()))return false;
    if(filterModule!=="全部"&&s.module!==filterModule)return false;
    if(filterStatus!=="全部"&&(filterStatus==="进行中"?s.status!=="active":s.status==="active"))return false;
    return true;
  });
  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
        <div className="relative">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索场景名称"
            className="h-8 pl-8 pr-3 border rounded-lg text-[12px] outline-none"
            style={{borderColor:T.border,color:T.t1,width:220}}/>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{color:T.t3}}/>
        </div>
        <Sel value={filterModule} onChange={setFilterModule} options={MODULES} width={120}/>
        <Sel value={filterStatus} onChange={setFilterStatus} options={["全部","进行中","未激活"]} width={100}/>
        <div className="flex-1"/>
        <Btn icon={Plus} onClick={onCreate}>新建场景</Btn>
      </div>
      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-[12px]">
          <thead style={{position:"sticky",top:0,zIndex:1}}>
            <tr style={{backgroundColor:T.bg,borderBottom:`1px solid ${T.border}`}}>
              {["ID","场景名称","优先级","所属模块","步骤数","最近结果","操作"].map((h,i)=>(
                <th key={h} className={`px-4 py-2.5 text-left font-medium ${i===6?"text-right":""}`} style={{color:T.t3}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s,i)=>(
              <tr key={s.id} className="group hover:bg-blue-50/30 transition-colors"
                style={{borderBottom:`1px solid ${T.border}`,backgroundColor:i%2===0?"#fff":"#FAFBFE"}}>
                <td className="px-4 py-3 font-mono" style={{color:T.t3}}>{s.id}</td>
                <td className="px-4 py-3">
                  <button onClick={()=>onOpen(s.id)} className="font-medium hover:underline text-left" style={{color:T.primary}}>{s.name}</button>
                  {s.tags.length>0&&(
                    <div className="flex gap-1 mt-1">
                      {s.tags.slice(0,3).map(tag=>(
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#F2F3F5",color:T.t3}}>{tag}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3"><PTag p={s.priority}/></td>
                <td className="px-4 py-3" style={{color:T.t2}}>{s.module}</td>
                <td className="px-4 py-3" style={{color:T.t2}}>{s.steps.length} 个</td>
                <td className="px-4 py-3"><StatusDot status={s.lastResult}/></td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IBtn icon={Edit2} label="编辑" onClick={()=>onOpen(s.id)}/>
                    <IBtn icon={Play} label="运行"/>
                    <IBtn icon={Copy} label="复制"/>
                    <IBtn icon={Trash2} label="删除" danger/>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&(
          <div className="flex flex-col items-center justify-center py-16" style={{color:T.t3}}>
            <p className="text-[13px]">暂无符合条件的场景</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Scene Management (multi-tab) ─────────────────────────────────────────────
export function SceneManagement(){
  const[scenes,setScenes]=useState<Scene[]>(INIT_SCENES);
  const[openIds,setOpenIds]=useState<string[]>([]);
  const[activeTab,setActiveTab]=useState<string>("list");

  const openScene=(id:string)=>{
    if(!openIds.includes(id))setOpenIds(p=>[...p,id]);
    setActiveTab(id);
  };
  const closeScene=(id:string,e:React.MouseEvent)=>{
    e.stopPropagation();
    const next=openIds.filter(x=>x!==id);
    setOpenIds(next);
    if(activeTab===id)setActiveTab(next[next.length-1]??"list");
  };
  const createScene=()=>{
    const id=`new-${Date.now()}`;
    const newS:Scene={
      id,name:`新建场景 ${scenes.length+1}`,module:"获客中心",priority:"P2",
      status:"active",desc:"",tags:[],env:"测试环境",testData:null,
      iterations:1,threads:1,runLocation:"server",variableSet:null,
      steps:[],lastRun:null,lastResult:null,
    };
    setScenes(p=>[...p,newS]);
    openScene(id);
  };

  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Multi-tab bar */}
      <div className="flex items-center flex-shrink-0 border-b px-2 gap-0" style={{height:38,borderColor:T.border,backgroundColor:"#fff"}}>
        {/* List tab */}
        <button onClick={()=>setActiveTab("list")}
          className="px-3 py-1 text-[12px] font-medium rounded-md mr-1 transition-colors flex-shrink-0"
          style={{backgroundColor:activeTab==="list"?"#E8F3FF":"transparent",color:activeTab==="list"?T.primary:T.t3}}>
          全部场景
        </button>
        <div className="w-px h-4 flex-shrink-0" style={{backgroundColor:T.border}}/>
        {/* Open scene tabs */}
        <div className="flex-1 flex items-center gap-0.5 overflow-x-auto px-1">
          {openIds.map(id=>{
            const s=scenes.find(x=>x.id===id);
            const isActive=activeTab===id;
            return(
              <button key={id} onClick={()=>setActiveTab(id)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium whitespace-nowrap flex-shrink-0 transition-colors group/tab"
                style={{backgroundColor:isActive?"#E8F3FF":"transparent",color:isActive?T.primary:T.t3}}>
                <span className="max-w-[120px] truncate">{s?.name??"未命名场景"}</span>
                <span onClick={e=>closeScene(id,e)}
                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-blue-200/60 opacity-0 group-hover/tab:opacity-100 transition-opacity">
                  <X size={10}/>
                </span>
              </button>
            );
          })}
        </div>
        {/* New tab button */}
        <button onClick={createScene}
          className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors">
          <Plus size={14} style={{color:T.t3}}/>
        </button>
        <span className="text-[11px] px-2 flex-shrink-0" style={{color:T.t4}}>···</span>
      </div>
      {/* Content */}
      {activeTab==="list"&&<SceneListPage scenes={scenes} onOpen={openScene} onCreate={createScene}/>}
      {openIds.map(id=>(
        activeTab===id&&(
          <SceneEditor key={id}
            scene={scenes.find(s=>s.id===id)!}
            onChange={updated=>setScenes(p=>p.map(s=>s.id===id?updated:s))}/>
        )
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SUITE MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════════

// ─── Suite Run Config ─────────────────────────────────────────────────────────
function SuiteRunConfig({suite,onChange}:{suite:Suite;onChange:(s:Suite)=>void}){
  return(
    <div className="flex-shrink-0 overflow-y-auto" style={{width:220,borderLeft:`1px solid ${T.border}`,backgroundColor:"#FAFBFE"}}>
      <div className="p-3 space-y-2" style={{borderBottom:`1px solid ${T.border}`}}>
        <select value={suite.env} onChange={e=>onChange({...suite,env:e.target.value})}
          className="w-full h-7 px-2 border rounded-lg text-[12px] outline-none bg-white"
          style={{borderColor:T.border,color:T.t1}}>
          {ENVS.map(e=><option key={e}>{e}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="flex-1 h-8 rounded-lg text-[12px] font-semibold text-white flex items-center justify-center gap-1.5"
            style={{backgroundColor:T.primary}}>
            <Play size={12}/>运行
          </button>
          <button className="flex-1 h-8 rounded-lg text-[12px] font-medium flex items-center justify-center gap-1.5 border bg-white"
            style={{borderColor:T.border,color:T.t2}}>
            <Save size={12}/>保存
          </button>
        </div>
      </div>
      <div className="p-3 space-y-3 text-[12px]">
        {/* Module */}
        <div>
          <p className="font-medium mb-1" style={{color:T.t2}}><span style={{color:T.danger}}>*</span> 所属模块</p>
          <select value={suite.module} onChange={e=>onChange({...suite,module:e.target.value})}
            className="w-full h-7 px-2 border rounded-lg text-[12px] outline-none bg-white"
            style={{borderColor:T.border,color:T.t1}}>
            {MODULES.map(m=><option key={m}>{m}</option>)}
          </select>
        </div>
        {/* Run mode */}
        <div>
          <p className="font-medium mb-1.5" style={{color:T.t2}}>运行模式</p>
          <div className="flex gap-3">
            {(["serial","parallel"] as const).map(m=>(
              <label key={m} className="flex items-center gap-1.5 cursor-pointer text-[12px]" style={{color:T.t1}}>
                <input type="radio" name="runMode" checked={suite.runMode===m} onChange={()=>onChange({...suite,runMode:m})}
                  className="accent-blue-600"/>
                {m==="serial"?"串行":"并行"}
              </label>
            ))}
          </div>
        </div>
        {/* Run location */}
        <div>
          <p className="font-medium mb-1" style={{color:T.t2}}>运行于</p>
          <select value={suite.runLocation==="server"?"服务端执行":"本地执行器"}
            onChange={e=>onChange({...suite,runLocation:e.target.value.includes("服务端")?"server":"runner"})}
            className="w-full h-7 px-2 border rounded-lg text-[12px] outline-none bg-white"
            style={{borderColor:T.border,color:T.t1}}>
            <option>服务端执行</option>
            <option>本地执行器</option>
          </select>
        </div>
        {suite.runLocation==="runner"&&(
          <div className="p-2.5 rounded-xl border" style={{borderColor:T.border}}>
            {RUNNERS.map(r=>(
              <div key={r.id} className="flex items-center gap-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor:r.status==="在线"?T.success:T.t4}}/>
                <div className="flex-1">
                  <p className="text-[11px] font-medium" style={{color:T.t1}}>{r.name}</p>
                  <p className="text-[10px]" style={{color:T.t3}}>{r.id} · {r.status}</p>
                </div>
                <input type="radio" name="runnerId" defaultChecked={r.status==="在线"} className="accent-blue-600"/>
              </div>
            ))}
          </div>
        )}
        {/* Notify */}
        <div className="flex items-center justify-between">
          <p className="font-medium" style={{color:T.t2}}>运行通知</p>
          <Toggle on={suite.notify} onToggle={()=>onChange({...suite,notify:!suite.notify})}/>
        </div>
        {/* Last run */}
        {suite.lastRun&&(
          <div className="pt-3" style={{borderTop:`1px solid ${T.border}`}}>
            <p className="font-medium mb-1" style={{color:T.t2}}>上次运行结果</p>
            <StatusDot status={suite.lastResult}/>
            <p className="text-[10px] mt-0.5" style={{color:T.t4}}>{suite.lastRun}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Case Dialog ──────────────────────────────────────────────────────────
function AddCaseDialog({onClose,existing}:{onClose:(added:string[])=>void;existing:Set<string>}){
  const[selected,setSelected]=useState<Set<string>>(new Set());
  const[search,setSearch]=useState("");
  const rows=MOCK_CANDIDATE_CASES.filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase()));
  const toggle=(id:string)=>{if(existing.has(id))return;const n=new Set(selected);n.has(id)?n.delete(id):n.add(id);setSelected(n);};
  return(
    <Modal title="添加接口用例" onClose={()=>onClose([])} width={680}>
      <div className="flex flex-col" style={{height:480}}>
        <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <select className="h-7 px-2 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,width:120}}><option>X-MAN</option></select>
          <select className="h-7 px-2 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,width:80}}><option>HTTP</option></select>
          <div className="relative flex-1">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索用例名称"
              className="w-full h-7 pl-7 pr-3 border rounded-lg text-[12px] outline-none"
              style={{borderColor:T.border}}/>
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{color:T.t3}}/>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead style={{position:"sticky",top:0}}>
              <tr style={{backgroundColor:T.bg,borderBottom:`1px solid ${T.border}`}}>
                <th className="px-4 py-2 w-8"><input type="checkbox" className="rounded"/></th>
                <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>ID</th>
                <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>用例名称</th>
                <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>方法</th>
                <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>请求路径</th>
                <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>所属接口</th>
                <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>运行状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c,i)=>{
                const inSuite=existing.has(c.id);
                return(
                  <tr key={c.id} style={{borderBottom:`1px solid ${T.border}`,opacity:inSuite?.5:1,backgroundColor:i%2===0?"transparent":T.bg+"80"}}>
                    <td className="px-4 py-2.5">
                      {inSuite
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#F2F3F5",color:T.t3}}>已在套件</span>
                        : <input type="checkbox" checked={selected.has(c.id)} onChange={()=>toggle(c.id)} className="rounded"/>
                      }
                    </td>
                    <td className="px-2 py-2.5 font-mono" style={{color:T.t3}}>{c.id}</td>
                    <td className="px-2 py-2.5 font-medium" style={{color:T.t1}}>{c.name}</td>
                    <td className="px-2 py-2.5"><MethodTag m={c.method}/></td>
                    <td className="px-2 py-2.5 font-mono text-[11px]" style={{color:T.t2}}>{c.path}</td>
                    <td className="px-2 py-2.5" style={{color:T.t3}}>{c.api}</td>
                    <td className="px-2 py-2.5"><StatusDot status={null}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{borderTop:`1px solid ${T.border}`}}>
          <p className="text-[12px]" style={{color:T.t3}}>
            已选 <strong style={{color:T.primary}}>{selected.size}</strong> · 当前页 {rows.length} · 共 {MOCK_CANDIDATE_CASES.length}
          </p>
          <div className="flex gap-2">
            <Btn ghost onClick={()=>onClose([])}>取消</Btn>
            <Btn onClick={()=>onClose([...selected])} disabled={selected.size===0}>添加 {selected.size>0?`(${selected.size})`:""}</Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Scene Dialog ─────────────────────────────────────────────────────────
function AddSceneDialog({onClose,existing}:{onClose:(added:string[])=>void;existing:Set<string>}){
  const[selected,setSelected]=useState<Set<string>>(new Set());
  const[search,setSearch]=useState("");
  const rows=MOCK_CANDIDATE_SCENES.filter(s=>!search||s.name.toLowerCase().includes(search.toLowerCase()));
  const toggle=(id:string)=>{if(existing.has(id))return;const n=new Set(selected);n.has(id)?n.delete(id):n.add(id);setSelected(n);};
  return(
    <Modal title="添加场景" onClose={()=>onClose([])} width={680}>
      <div className="flex flex-col" style={{height:440}}>
        <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <select className="h-7 px-2 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,width:120}}><option>X-MAN</option></select>
          <div className="relative flex-1">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索场景名称"
              className="w-full h-7 pl-7 pr-3 border rounded-lg text-[12px] outline-none"
              style={{borderColor:T.border}}/>
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{color:T.t3}}/>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead style={{position:"sticky",top:0}}>
              <tr style={{backgroundColor:T.bg,borderBottom:`1px solid ${T.border}`}}>
                <th className="px-4 py-2 w-8"><input type="checkbox" className="rounded"/></th>
                <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>ID</th>
                <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>场景名称</th>
                <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>所属模块</th>
                <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>步骤数</th>
                <th className="px-2 py-2 text-left font-medium" style={{color:T.t3}}>状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s,i)=>{
                const inSuite=existing.has(s.id);
                return(
                  <tr key={s.id} style={{borderBottom:`1px solid ${T.border}`,opacity:inSuite?.5:1,backgroundColor:i%2===0?"transparent":T.bg+"80"}}>
                    <td className="px-4 py-2.5">
                      {inSuite
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#F2F3F5",color:T.t3}}>已在套件</span>
                        : <input type="checkbox" checked={selected.has(s.id)} onChange={()=>toggle(s.id)} className="rounded"/>
                      }
                    </td>
                    <td className="px-2 py-2.5 font-mono" style={{color:T.t3}}>{s.id}</td>
                    <td className="px-2 py-2.5 font-medium" style={{color:T.t1}}>{s.name}</td>
                    <td className="px-2 py-2.5" style={{color:T.t3}}>{s.module}</td>
                    <td className="px-2 py-2.5" style={{color:T.t2}}>{s.steps} 个</td>
                    <td className="px-2 py-2.5"><StatusDot status={s.status==="active"?"pass":null}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{borderTop:`1px solid ${T.border}`}}>
          <p className="text-[12px]" style={{color:T.t3}}>
            已选 <strong style={{color:T.primary}}>{selected.size}</strong> · 当前页 {rows.length} · 共 {MOCK_CANDIDATE_SCENES.length}
          </p>
          <div className="flex gap-2">
            <Btn ghost onClick={()=>onClose([])}>取消</Btn>
            <Btn onClick={()=>onClose([...selected])} disabled={selected.size===0}>添加 {selected.size>0?`(${selected.size})`:""}</Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Suite Run Records ────────────────────────────────────────────────────────
function SuiteRunRecordsTab({suiteId}:{suiteId:string}){
  const[selRecord,setSelRecord]=useState<RunRecord|null>(null);
  const records=MOCK_RUN_RECORDS;

  if(selRecord){
    return(
      <div className="flex-1 overflow-y-auto p-5">
        {/* Breadcrumb */}
        <button onClick={()=>setSelRecord(null)} className="flex items-center gap-1.5 mb-4 text-[12px]" style={{color:T.t3}}>
          <ChevronRight size={12} style={{transform:"rotate(180deg)"}}/>返回运行结果列表
        </button>
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            {label:"通过",value:selRecord.pass,color:T.success},
            {label:"失败",value:selRecord.fail,color:T.danger},
            {label:"跳过",value:0,color:T.t3},
            {label:"耗时",value:selRecord.duration,color:T.primary},
          ].map(s=>(
            <div key={s.label} className="rounded-xl p-4 bg-white border" style={{borderColor:T.border}}>
              <p className="text-[11px]" style={{color:T.t3}}>{s.label}</p>
              <p className="text-[22px] font-bold mt-1" style={{color:s.color}}>{s.value}</p>
            </div>
          ))}
        </div>
        {/* Meta */}
        <div className="flex gap-4 mb-4 text-[12px]" style={{color:T.t3}}>
          {[["环境","测试环境"],["变量集","公共变量集"],["失败后继续","是"],["重试次数","0"]].map(([k,v])=>(
            <span key={k}><strong>{k}：</strong>{v}</span>
          ))}
        </div>
        {/* Items */}
        <div className="space-y-2">
          {[
            {name:"用户注册",type:"api" as SuiteItemType,result:"pass" as const,steps:3,duration:"1.2s",fail:""},
            {name:"产品管理-新增编辑删除闭环",type:"scene" as SuiteItemType,result:"fail" as const,steps:10,duration:"8.4s",fail:"步骤 4 断言失败：期望 200 实际 404"},
            {name:"创建订单",type:"api" as SuiteItemType,result:"pass" as const,steps:2,duration:"0.8s",fail:""},
          ].map((item,i)=>{
            const[expanded,setExpanded]=React.useState(item.result==="fail");
            return(
              <div key={i} className="rounded-xl border overflow-hidden" style={{borderColor:T.border}}>
                <div className="flex items-center gap-3 px-4 py-3 bg-white cursor-pointer" onClick={()=>setExpanded(p=>!p)}>
                  {item.result==="pass"
                    ? <CheckCircle size={16} style={{color:T.success,flexShrink:0}}/>
                    : <XCircle size={16} style={{color:T.danger,flexShrink:0}}/>
                  }
                  <span className="text-[11px] px-1.5 py-0.5 rounded" style={{backgroundColor:item.type==="api"?"#E8F3FF":"#E8FFEA",color:item.type==="api"?T.primary:T.success}}>{item.type==="api"?"接口用例":"场景"}</span>
                  <p className="flex-1 text-[13px] font-medium" style={{color:T.t1}}>{item.name}</p>
                  <span className="text-[11px]" style={{color:T.t3}}>{item.steps} 步骤 · {item.duration}</span>
                  {item.fail&&<AlertCircle size={14} style={{color:T.danger}}/>}
                  {expanded?<ChevronUp size={14} style={{color:T.t3}}/>:<ChevronDown size={14} style={{color:T.t3}}/>}
                </div>
                {expanded&&(
                  <div style={{backgroundColor:T.bg,borderTop:`1px solid ${T.border}`}}>
                    {item.fail&&(
                      <div className="px-4 py-2.5 flex items-start gap-2" style={{borderBottom:`1px solid ${T.border}`}}>
                        <AlertCircle size={13} style={{color:T.danger,flexShrink:0,marginTop:1}}/>
                        <p className="text-[12px]" style={{color:T.danger}}>{item.fail}</p>
                      </div>
                    )}
                    {Array.from({length:Math.min(item.steps,4)}).map((_,si)=>(
                      <div key={si} className="flex items-center gap-3 px-6 py-2" style={{borderBottom:`1px solid ${T.border}`}}>
                        {si===3&&item.result==="fail"
                          ? <XCircle size={12} style={{color:T.danger}}/>
                          : <CheckCircle size={12} style={{color:T.success}}/>
                        }
                        <span className="text-[11px] flex-1" style={{color:T.t2}}>步骤 {si+1} · {["发送验证码","注册账户","登录获取Token","查询用户(失败)"][si]}</span>
                        <span className="text-[10px] font-mono" style={{color:T.t3}}>{si===3?"404":200}</span>
                        <span className="text-[10px]" style={{color:T.t3}}>{[120,340,280,150][si]}ms</span>
                        <IBtn icon={Eye} label="查看详情"/>
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

  return(
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold" style={{color:T.t1}}>运行记录</p>
        <Btn ghost small icon={RefreshCw}>刷新</Btn>
      </div>
      <table className="w-full text-[12px]">
        <thead>
          <tr style={{backgroundColor:T.bg,borderBottom:`1px solid ${T.border}`}}>
            {["开始时间","环境","通过/总数","失败","耗时","执行人","状态","操作"].map((h,i)=>(
              <th key={h} className={`px-4 py-2.5 text-left font-medium ${i===7?"text-right":""}`} style={{color:T.t3}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((r,i)=>(
            <tr key={r.id} className="hover:bg-blue-50/30" style={{borderBottom:`1px solid ${T.border}`,backgroundColor:i%2===0?"#fff":"#FAFBFE"}}>
              <td className="px-4 py-3 font-mono text-[11px]" style={{color:T.t2}}>{r.startTime}</td>
              <td className="px-4 py-3" style={{color:T.t2}}>{r.env}</td>
              <td className="px-4 py-3">
                <span className="font-bold" style={{color:T.success}}>{r.pass}</span>
                <span style={{color:T.t3}}> / {r.total}</span>
              </td>
              <td className="px-4 py-3">
                {r.fail>0?<span className="font-bold" style={{color:T.danger}}>{r.fail}</span>:<span style={{color:T.t4}}>0</span>}
              </td>
              <td className="px-4 py-3 font-mono text-[11px]" style={{color:T.t2}}>{r.duration}</td>
              <td className="px-4 py-3" style={{color:T.t2}}>{r.operator}</td>
              <td className="px-4 py-3"><StatusDot status={r.status==="running"?"running":r.status}/></td>
              <td className="px-4 py-3 text-right">
                <IBtn icon={Eye} label="查看详情" onClick={()=>setSelRecord(r)}/>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Suite Editor ─────────────────────────────────────────────────────────────
function SuiteEditor({suite,onChange}:{suite:Suite;onChange:(s:Suite)=>void}){
  const[subTab,setSubTab]=useState<"arrange"|"results">("arrange");
  const[editingName,setEditingName]=useState(false);
  const[nameVal,setNameVal]=useState(suite.name);
  const[showAddCase,setShowAddCase]=useState(false);
  const[showAddScene,setShowAddScene]=useState(false);
  const existingIds=new Set(suite.items.map(i=>i.id));

  const moveItem=(idx:number,dir:-1|1)=>{
    const arr=[...suite.items];
    if(idx+dir<0||idx+dir>=arr.length)return;
    [arr[idx],arr[idx+dir]]=[arr[idx+dir],arr[idx]];
    onChange({...suite,items:arr});
  };
  const deleteItem=(id:string)=>onChange({...suite,items:suite.items.filter(i=>i.id!==id)});

  const subTabs=[
    {k:"arrange",l:`编排 (${suite.items.length})`},
    {k:"results",l:"运行结果"},
  ] as const;

  return(
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sub-tabs */}
        <div className="flex items-center flex-shrink-0 px-4" style={{borderBottom:`1px solid ${T.border}`,height:38,backgroundColor:"#fff"}}>
          {subTabs.map(({k,l})=>(
            <button key={k} onClick={()=>setSubTab(k)}
              className="h-full px-4 text-[12px] font-medium border-b-2 transition-colors"
              style={{borderBottomColor:subTab===k?T.primary:"transparent",color:subTab===k?T.primary:T.t3}}>
              {l}
            </button>
          ))}
        </div>

        {subTab==="arrange"&&(
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Suite info */}
            <div className="flex-shrink-0 px-4 py-3" style={{borderBottom:`1px solid ${T.border}`,backgroundColor:"#FAFBFE"}}>
              <div className="flex items-center gap-2 mb-1">
                <select value={suite.priority} onChange={e=>onChange({...suite,priority:e.target.value as Priority})}
                  className="h-6 px-2 rounded text-[11px] font-bold border outline-none"
                  style={{backgroundColor:PRIORITY_STYLE[suite.priority as Priority].bg,color:PRIORITY_STYLE[suite.priority as Priority].color,borderColor:PRIORITY_STYLE[suite.priority as Priority].color}}>
                  {["P0","P1","P2","P3"].map(p=><option key={p}>{p}</option>)}
                </select>
                {editingName
                  ? <input autoFocus value={nameVal} onChange={e=>setNameVal(e.target.value)}
                      onBlur={()=>{onChange({...suite,name:nameVal});setEditingName(false);}}
                      onKeyDown={e=>{if(e.key==="Enter"){onChange({...suite,name:nameVal});setEditingName(false);}}}
                      className="text-[14px] font-semibold outline-none border-b px-1"
                      style={{color:T.t1,borderColor:T.primary}}/>
                  : <span onClick={()=>setEditingName(true)} className="text-[14px] font-semibold flex items-center gap-1.5 cursor-pointer" style={{color:T.t1}}>
                      {suite.name}<Edit2 size={12} style={{color:T.t3}}/>
                    </span>
                }
              </div>
              {suite.desc&&<p className="text-[12px]" style={{color:T.t3}}>{suite.desc}</p>}
            </div>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
              <p className="text-[12px]" style={{color:T.t2}}>共 <strong>{suite.items.length}</strong> 个编排项，执行顺序即保存顺序</p>
              <div className="flex gap-2">
                <Btn ghost small icon={FileText} onClick={()=>setShowAddCase(true)}>添加接口用例</Btn>
                <Btn ghost small icon={Layers} onClick={()=>setShowAddScene(true)}>添加场景</Btn>
              </div>
            </div>
            {/* Items */}
            <div className="flex-1 overflow-y-auto py-2 px-3" style={{backgroundColor:"#FAFBFE"}}>
              {suite.items.length===0
                ? (
                  <div className="flex flex-col items-center justify-center py-16" style={{color:T.t3}}>
                    <FileText size={32} style={{color:T.t4,marginBottom:8}}/>
                    <p className="text-[13px] mb-3">还没有编排项，添加接口用例或场景开始</p>
                    <div className="flex gap-2">
                      <Btn ghost small icon={FileText} onClick={()=>setShowAddCase(true)}>添加用例</Btn>
                      <Btn ghost small icon={Layers} onClick={()=>setShowAddScene(true)}>添加场景</Btn>
                    </div>
                  </div>
                )
                : suite.items.map((item,i)=>(
                  <div key={item.id} className="mb-1.5 flex items-center gap-2 px-3 py-3 rounded-xl border bg-white group hover:shadow-sm transition-shadow"
                    style={{borderColor:T.border}}>
                    <GripVertical size={14} className="opacity-30 cursor-grab group-hover:opacity-60 flex-shrink-0" style={{color:T.t3}}/>
                    <span className="w-5 text-center text-[11px] flex-shrink-0" style={{color:T.t4}}>{i+1}</span>
                    {/* Type badge */}
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
                      style={{backgroundColor:item.type==="api"?"#E8F3FF":"#E8FFEA",color:item.type==="api"?T.primary:T.success}}>
                      {item.type==="api"?"接口":"场景"}
                    </span>
                    {item.method&&<MethodTag m={item.method}/>}
                    <p className="flex-1 text-[13px] font-medium truncate" style={{color:T.t1}}>{item.name}</p>
                    {item.path&&<span className="text-[11px] font-mono" style={{color:T.t3}}>{item.path}</span>}
                    {item.desc&&<span className="text-[11px]" style={{color:T.t3}}>{item.desc}</span>}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <IBtn icon={ArrowUp} label="上移" onClick={()=>moveItem(i,-1)}/>
                      <IBtn icon={ArrowDown} label="下移" onClick={()=>moveItem(i,1)}/>
                      <IBtn icon={Trash2} label="移除" danger onClick={()=>deleteItem(item.id)}/>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {subTab==="results"&&<SuiteRunRecordsTab suiteId={suite.id}/>}
      </div>

      {/* Right config */}
      <SuiteRunConfig suite={suite} onChange={onChange}/>

      {showAddCase&&<AddCaseDialog existing={existingIds} onClose={ids=>{
        if(ids.length>0){
          const newItems:SuiteItem[]=MOCK_CANDIDATE_CASES
            .filter(c=>ids.includes(c.id))
            .map(c=>({id:c.id,type:"api" as SuiteItemType,name:c.name,method:c.method,path:c.path}));
          onChange({...suite,items:[...suite.items,...newItems]});
        }
        setShowAddCase(false);
      }}/>}
      {showAddScene&&<AddSceneDialog existing={existingIds} onClose={ids=>{
        if(ids.length>0){
          const newItems:SuiteItem[]=MOCK_CANDIDATE_SCENES
            .filter(s=>ids.includes(s.id))
            .map(s=>({id:s.id,type:"scene" as SuiteItemType,name:s.name,desc:`${s.steps} 个步骤`}));
          onChange({...suite,items:[...suite.items,...newItems]});
        }
        setShowAddScene(false);
      }}/>}
    </div>
  );
}

// ─── Suite List Page ──────────────────────────────────────────────────────────
function SuiteListPage({suites,onOpen,onCreate}:{suites:Suite[];onOpen:(id:string)=>void;onCreate:()=>void}){
  const[search,setSearch]=useState("");
  const filtered=suites.filter(s=>!search||s.name.toLowerCase().includes(search.toLowerCase()));
  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
        <div className="relative">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索套件名称"
            className="h-8 pl-8 pr-3 border rounded-lg text-[12px] outline-none"
            style={{borderColor:T.border,color:T.t1,width:220}}/>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{color:T.t3}}/>
        </div>
        <Sel value="全部" onChange={()=>{}} options={MODULES} width={120}/>
        <div className="flex-1"/>
        <Btn icon={Plus} onClick={onCreate}>新建套件</Btn>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-[12px]">
          <thead style={{position:"sticky",top:0,zIndex:1}}>
            <tr style={{backgroundColor:T.bg,borderBottom:`1px solid ${T.border}`}}>
              {["套件名称","优先级","所属模块","编排项","最近结果","最近运行","操作"].map((h,i)=>(
                <th key={h} className={`px-4 py-2.5 text-left font-medium ${i===6?"text-right":""}`} style={{color:T.t3}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s,i)=>(
              <tr key={s.id} className="group hover:bg-blue-50/30"
                style={{borderBottom:`1px solid ${T.border}`,backgroundColor:i%2===0?"#fff":"#FAFBFE"}}>
                <td className="px-4 py-3">
                  <button onClick={()=>onOpen(s.id)} className="font-semibold hover:underline text-left" style={{color:T.primary}}>{s.name}</button>
                  <p className="text-[11px] mt-0.5" style={{color:T.t3}}>{s.desc}</p>
                </td>
                <td className="px-4 py-3"><PTag p={s.priority as Priority}/></td>
                <td className="px-4 py-3" style={{color:T.t2}}>{s.module}</td>
                <td className="px-4 py-3" style={{color:T.t2}}>{s.items.length} 项</td>
                <td className="px-4 py-3"><StatusDot status={s.lastResult}/></td>
                <td className="px-4 py-3 font-mono text-[11px]" style={{color:T.t3}}>{s.lastRun??"-"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IBtn icon={Edit2} label="编辑" onClick={()=>onOpen(s.id)}/>
                    <IBtn icon={Play} label="运行"/>
                    <IBtn icon={Trash2} label="删除" danger/>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Suite Management (multi-tab) ─────────────────────────────────────────────
export function SuiteManagement(){
  const[suites,setSuites]=useState<Suite[]>(INIT_SUITES);
  const[openIds,setOpenIds]=useState<string[]>([]);
  const[activeTab,setActiveTab]=useState<string>("list");

  const openSuite=(id:string)=>{
    if(!openIds.includes(id))setOpenIds(p=>[...p,id]);
    setActiveTab(id);
  };
  const closeSuite=(id:string,e:React.MouseEvent)=>{
    e.stopPropagation();
    const next=openIds.filter(x=>x!==id);
    setOpenIds(next);
    if(activeTab===id)setActiveTab(next[next.length-1]??"list");
  };
  const createSuite=()=>{
    const id=`new-${Date.now()}`;
    const newS:Suite={
      id,name:`未命名套件`,module:"全部",priority:"P2",
      status:"ACTIVE",desc:"",items:[],env:"测试环境",
      runMode:"serial",runLocation:"server",notify:false,
      lastRun:null,lastResult:null,
    };
    setSuites(p=>[...p,newS]);
    openSuite(id);
  };

  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Multi-tab bar */}
      <div className="flex items-center flex-shrink-0 border-b px-2 gap-0" style={{height:38,borderColor:T.border,backgroundColor:"#fff"}}>
        <button onClick={()=>setActiveTab("list")}
          className="px-3 py-1 text-[12px] font-medium rounded-md mr-1 transition-colors flex-shrink-0"
          style={{backgroundColor:activeTab==="list"?"#E8F3FF":"transparent",color:activeTab==="list"?T.primary:T.t3}}>
          全部套件
        </button>
        <div className="w-px h-4 flex-shrink-0" style={{backgroundColor:T.border}}/>
        <div className="flex-1 flex items-center gap-0.5 overflow-x-auto px-1">
          {openIds.map(id=>{
            const s=suites.find(x=>x.id===id);
            const isActive=activeTab===id;
            return(
              <button key={id} onClick={()=>setActiveTab(id)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium whitespace-nowrap flex-shrink-0 transition-colors group/tab"
                style={{backgroundColor:isActive?"#E8F3FF":"transparent",color:isActive?T.primary:T.t3}}>
                <span className="max-w-[140px] truncate">{s?.name??"未命名套件"}</span>
                <span onClick={e=>closeSuite(id,e)}
                  className="w-4 h-4 flex items-center justify-center rounded hover:bg-blue-200/60 opacity-0 group-hover/tab:opacity-100 transition-opacity">
                  <X size={10}/>
                </span>
              </button>
            );
          })}
        </div>
        <button onClick={createSuite}
          className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-md hover:bg-gray-100">
          <Plus size={14} style={{color:T.t3}}/>
        </button>
      </div>
      {/* Content */}
      {activeTab==="list"&&<SuiteListPage suites={suites} onOpen={openSuite} onCreate={createSuite}/>}
      {openIds.map(id=>(
        activeTab===id&&(
          <SuiteEditor key={id}
            suite={suites.find(s=>s.id===id)!}
            onChange={updated=>setSuites(p=>p.map(s=>s.id===id?updated:s))}/>
        )
      ))}
    </div>
  );
}
