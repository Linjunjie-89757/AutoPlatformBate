import { useState, useEffect } from "react";
import {
  Search, Plus, Edit2, Trash2, Eye, Check, Clock,
  CheckCircle, XCircle, ChevronDown, Zap,
  Monitor, Shield, LayoutGrid,
  ChevronRight, Activity, ArrowUpRight, Folder, FolderOpen,
  Play, Save, Upload, X, GripVertical, Sparkles, RefreshCw,
  Code2, ChevronLeft, Layers, ThumbsUp, ThumbsDown, Send, AlertTriangle,
  MousePointer, Type, Timer, Camera, Variable, Globe2, Copy, ArrowUp, ArrowDown,
  ClipboardList, Share2, Download, ExternalLink, Minus, Filter,
  Video, Pause, Square, SkipForward, RotateCcw, PlusCircle, FlaskConical, Lock,
} from "lucide-react";
// recharts unused in this module

// ─── Palette (local copy) ─────────────────────────────────────────────────────
const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  cyan:"#0FC6C2",
  slate:"#4E5969",   bg:"#F4F6FA",      border:"#E5E6EB",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};
const METHOD_COLOR: Record<string,string> = {GET:"#00B42A",POST:"#FF7D00",PUT:"#165DFF",DELETE:"#F53F3F",PATCH:"#7816FF"};
const METHOD_BG:    Record<string,string> = {GET:"#E8FFEA",POST:"#FFF3E8",PUT:"#E8F3FF",DELETE:"#FFE8E8",PATCH:"#F5E8FF"};
const PRIORITY_STYLE: Record<string,{bg:string;color:string}> = {
  P0:{bg:"#F53F3F",color:"#fff"},P1:{bg:"#FF7D00",color:"#fff"},
  P2:{bg:"#FAAD14",color:"#fff"},P3:{bg:"#165DFF",color:"#fff"},P4:{bg:"#C9CDD4",color:"#4E5969"},
};

// ─── Shared atoms (local copy) ──────────────────────────────────────────────


function IcoSquare({color,bg,size=32,children}:{color:string;bg:string;size?:number;children:React.ReactNode}){return <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{width:size,height:size,backgroundColor:bg}}><span style={{color,display:"flex"}}>{children}</span></div>;}

function StatusDot({status,label}:{status:string;label?:string}){
  const M:Record<string,{dot:string;text:string;tc:string}>={enabled:{dot:T.success,text:"已启用",tc:T.t2},disabled:{dot:T.t4,text:"已停用",tc:T.t3},online:{dot:T.success,text:"在线",tc:T.t2},offline:{dot:T.t4,text:"离线",tc:T.t3},success:{dot:T.success,text:"成功",tc:T.t2},failed:{dot:T.danger,text:"失败",tc:T.danger},pass:{dot:T.success,text:"通过",tc:T.success},fail:{dot:T.danger,text:"失败",tc:T.danger},running:{dot:T.primary,text:"运行中",tc:T.primary},configured:{dot:T.success,text:"已配置",tc:T.t2},unconfigured:{dot:T.t4,text:"未配置",tc:T.danger}};
  const c=M[status]??M.disabled;
  return <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor:c.dot}}/><span className="text-[12px]" style={{color:c.tc}}>{label??c.text}</span></span>;
}

function PBtn({children,onClick,icon:Icon,small,color=T.primary,variant="primary"}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;variant?:"primary"|"ghost"}){
  if(variant==="ghost") return <button onClick={onClick} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium bg-white transition-colors" style={{borderColor:T.border,color:T.t2}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.color=T.primary;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.t2;}}>{Icon&&<Icon size={13}/>}{children}</button>;
  return <button onClick={onClick} className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-all active:scale-[0.98]" style={{backgroundColor:color,color:"#fff",height:small?28:32,padding:small?"0 10px":"0 14px",fontSize:small?12:13}} onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.1)"} onMouseLeave={e=>e.currentTarget.style.filter=""}>{Icon&&<Icon size={small?12:13}/>}{children}</button>;
}

function IBtn({icon:Icon,label,danger,onClick}:{icon:React.ElementType;label:string;danger?:boolean;onClick?:()=>void}){return <button title={label} onClick={e=>{e.stopPropagation();onClick?.();}} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{color:T.t4}} onMouseEnter={e=>{e.currentTarget.style.color=danger?T.danger:T.t1;e.currentTarget.style.backgroundColor=danger?"#FFF0F0":"#F2F3F5";}} onMouseLeave={e=>{e.currentTarget.style.color=T.t4;e.currentTarget.style.backgroundColor="transparent";}}><Icon size={13}/></button>;}

function Inp({placeholder,type="text",prefix,mono,width,value,onChange}:{placeholder?:string;type?:string;prefix?:React.ReactNode;mono?:boolean;width?:string|number;value?:string;onChange?:(v:string)=>void}){return <div className="relative flex items-center" style={{width}}>{prefix&&<span className="absolute left-2.5 pointer-events-none" style={{color:T.t3}}>{prefix}</span>}<input type={type} placeholder={placeholder} value={value} onChange={e=>onChange?.(e.target.value)} className={`h-8 border rounded-lg bg-white text-[13px] outline-none transition-all w-full ${prefix?"pl-8 pr-3":"px-3"} ${mono?"font-mono text-[12px]":""}`} style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.primary}18`;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/></div>;}

function Sel({children,width=130}:{children:React.ReactNode;width?:number}){return <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width}}>{children}</select>;}

function Toggle({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}){return <button onClick={()=>onChange(!on)} className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0" style={{backgroundColor:on?T.primary:"#C9CDD4"}}><span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all" style={{left:on?"calc(100% - 14px)":"2px"}}/></button>;}

function MethodBadge({method}:{method:string}){return <span className="inline-block px-1.5 py-px rounded text-[10px] font-bold text-center" style={{minWidth:44,backgroundColor:METHOD_BG[method]??"#F2F3F5",color:METHOD_COLOR[method]??"#4E5969"}}>{method}</span>;}

interface Col{label:string;width?:string;align?:"left"|"right"|"center"}
function ETable({cols,children,total}:{cols:Col[];children:React.ReactNode;total?:number}){const[page,setPage]=useState(1);const pages=total?Math.max(1,Math.ceil(total/10)):1;return <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}><table className="w-full border-collapse"><thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>{cols.map((c,i)=><th key={i} style={{width:c.width,textAlign:c.align??"left",color:T.t3}} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">{c.label}</th>)}</tr></thead><tbody>{children}</tbody></table>{total!==undefined&&<div className="flex items-center justify-between px-4 py-2.5" style={{borderTop:`1px solid ${T.border}`}}><span className="text-[12px]" style={{color:T.t3}}>共 {total} 条</span><div className="flex items-center gap-1">{Array.from({length:pages}).map((_,i)=><button key={i} onClick={()=>setPage(i+1)} className="w-7 h-7 rounded-md text-[12px] font-medium" style={{backgroundColor:page===i+1?T.primary:"transparent",color:page===i+1?"#fff":T.t2,border:`1px solid ${page===i+1?T.primary:T.border}`}}>{i+1}</button>)}</div></div>}</div>;}
function TR({children,active,onClick}:{children:React.ReactNode;active?:boolean;onClick?:()=>void}){return <tr onClick={onClick} className="border-b last:border-b-0 transition-colors" style={{borderColor:T.border,height:46,backgroundColor:active?`${T.primary}08`:"",cursor:onClick?"pointer":"default"}} onMouseEnter={e=>!active&&(e.currentTarget.style.backgroundColor="#FAFBFF")} onMouseLeave={e=>!active&&(e.currentTarget.style.backgroundColor="")}>{children}</tr>;}
function TD({children,align="left",mono,muted}:{children?:React.ReactNode;align?:"left"|"right"|"center";mono?:boolean;muted?:boolean}){return <td className={`px-4 py-2 text-[13px] ${mono?"font-mono text-[12px]":""}`} style={{textAlign:align,color:muted?T.t3:T.t1}}>{children}</td>;}

function FilterBar({children,onAdd,addLabel,extra}:{children?:React.ReactNode;onAdd:()=>void;addLabel:string;extra?:React.ReactNode}){return <div className="flex items-center gap-2 mb-4">{children}<div className="flex-1"/>{extra}{extra&&" "}<PBtn icon={Plus} onClick={onAdd}>{addLabel}</PBtn></div>;}
function PageHead({title,desc}:{title:string;desc:string}){return <div className="mb-5"><h2 className="text-[16px] font-semibold" style={{color:T.t1}}>{title}</h2><p className="text-[12px] mt-0.5" style={{color:T.t3}}>{desc}</p></div>;}


// ═══════════════════════════════════════════════════════════════════════════════

type UISubPage   = "cases"|"elements"|"suites"|"records"|"env";
type StepType    = "navigate"|"click"|"input"|"wait"|"assert"|"screenshot"|"variable";
type UIRunStatus = "pass"|"fail"|"running"|"pending";

interface UICase { id:string; name:string; directory:string; status:"active"|"inactive"|"draft"; priority:Priority; lastRunResult:UIRunStatus|null; lastRunAt:string; creator:string; browser:string; tags:string[]; }
interface UIStep { id:string; order:number; enabled:boolean; type:StepType; description:string; element?:string; value?:string; }
interface UIElement { id:string; name:string; page:string; group:string; locatorType:"id"|"css"|"xpath"|"text"|"role"; locatorValue:string; description:string; refCount:number; lastVerified:"pass"|"fail"|null; lastVerifiedAt:string; }
interface UIRun { id:string; caseName:string; status:UIRunStatus; browser:string; env:string; startedAt:string; duration:string; steps:UIRunStep[]; }
interface UIRunStep { id:string; type:StepType; description:string; status:"pass"|"fail"|"skip"; duration:string; hasScreenshot:boolean; errorMsg?:string; }
interface AIEl { id:string; name:string; elType:string; purpose:string; locatorType:string; locatorValue:string; confidence:number; adoptStatus:"adopted"|"ignored"|"pending"; page?:string; }

// ─── Config ───────────────────────────────────────────────────────────────────

const STEP_CFG: Record<StepType,{label:string;color:string;bg:string;icon:React.ElementType}> = {
  navigate:   {label:"打开页面", color:"#165DFF", bg:"#E8F3FF", icon:Globe2},
  click:      {label:"点击",     color:"#00B42A", bg:"#E8FFEA", icon:MousePointer},
  input:      {label:"输入",     color:"#7816FF", bg:"#F5E8FF", icon:Type},
  wait:       {label:"等待",     color:"#FF7D00", bg:"#FFF3E8", icon:Timer},
  assert:     {label:"断言",     color:"#0FC6C2", bg:"#E8FFFB", icon:CheckCircle},
  screenshot: {label:"截图",     color:"#4E5969", bg:"#F2F3F5", icon:Camera},
  variable:   {label:"变量处理", color:"#FAAD14", bg:"#FFFBE8", icon:Variable},
};

const UI_RUN_CFG: Record<UIRunStatus,{label:string;bg:string;color:string}> = {
  pass:    {label:"通过",  bg:"#E8FFEA", color:"#00B42A"},
  fail:    {label:"失败",  bg:"#FFE8E8", color:"#F53F3F"},
  running: {label:"运行中",bg:"#E8F3FF", color:"#165DFF"},
  pending: {label:"待运行",bg:"#F2F3F5", color:"#86909C"},
};

// ─── Mock data ─────────────────────────────────────────────────────────────────

const UI_CASES: UICase[] = [
  {id:"UC-001",name:"用户登录正常流程",directory:"电商平台/用户模块",status:"active",priority:"P0",lastRunResult:"pass",lastRunAt:"2026-07-05 14:30",creator:"张程远",browser:"Chrome",tags:["登录","核心流程","P0"]},
  {id:"UC-002",name:"商品搜索与筛选",directory:"电商平台/商品模块",status:"active",priority:"P1",lastRunResult:"fail",lastRunAt:"2026-07-05 11:20",creator:"李明",browser:"Chrome",tags:["搜索","筛选"]},
  {id:"UC-003",name:"购物车加购与结算",directory:"电商平台/购物车",status:"active",priority:"P0",lastRunResult:"pass",lastRunAt:"2026-07-04 16:45",creator:"王芳",browser:"Chrome",tags:["购物车","结算","P0"]},
  {id:"UC-004",name:"用户注册验证码校验",directory:"电商平台/用户模块",status:"inactive",priority:"P2",lastRunResult:null,lastRunAt:"—",creator:"陈伟",browser:"Firefox",tags:["注册","验证码"]},
  {id:"UC-005",name:"商品详情页图片预览",directory:"电商平台/商品模块",status:"draft",priority:"P2",lastRunResult:null,lastRunAt:"—",creator:"张程远",browser:"Chrome",tags:["商品详情"]},
  {id:"UC-006",name:"订单状态流转核心路径",directory:"电商平台/订单模块",status:"active",priority:"P1",lastRunResult:"pass",lastRunAt:"2026-07-05 09:00",creator:"李明",browser:"Chrome",tags:["订单","核心流程"]},
];

const SAMPLE_STEPS: UIStep[] = [
  {id:"s1",order:1,enabled:true,type:"navigate",description:"打开登录页面",value:"https://test.example.com/login"},
  {id:"s2",order:2,enabled:true,type:"click",description:"点击「用户名输入框」",element:"用户名输入框"},
  {id:"s3",order:3,enabled:true,type:"input",description:"输入测试账号",element:"用户名输入框",value:"{{test_username}}"},
  {id:"s4",order:4,enabled:true,type:"click",description:"点击「密码输入框」",element:"密码输入框"},
  {id:"s5",order:5,enabled:true,type:"input",description:"输入密码",element:"密码输入框",value:"{{test_password}}"},
  {id:"s6",order:6,enabled:true,type:"click",description:"点击「登录按钮」",element:"登录按钮"},
  {id:"s7",order:7,enabled:true,type:"wait",description:"等待页面跳转完成",value:"3000"},
  {id:"s8",order:8,enabled:true,type:"assert",description:"断言欢迎文字可见",element:"欢迎提示文字",value:"包含：欢迎"},
  {id:"s9",order:9,enabled:true,type:"screenshot",description:"截图记录登录成功状态"},
];

const UI_ELEMENTS: UIElement[] = [
  {id:"el-001",name:"用户名输入框",page:"登录页",group:"登录表单",locatorType:"id",locatorValue:"#username-input",description:"主登录表单的用户名输入字段",refCount:14,lastVerified:"pass",lastVerifiedAt:"2026-07-05 14:30"},
  {id:"el-002",name:"密码输入框",page:"登录页",group:"登录表单",locatorType:"id",locatorValue:"#password-input",description:"主登录表单的密码输入字段",refCount:12,lastVerified:"pass",lastVerifiedAt:"2026-07-05 14:30"},
  {id:"el-003",name:"登录按钮",page:"登录页",group:"登录表单",locatorType:"css",locatorValue:".btn-login",description:"提交登录表单的主操作按钮",refCount:18,lastVerified:"pass",lastVerifiedAt:"2026-07-05 14:30"},
  {id:"el-004",name:"欢迎提示文字",page:"首页",group:"顶部栏",locatorType:"xpath",locatorValue:"//span[@class='welcome-text']",description:"登录成功后显示的用户欢迎语",refCount:8,lastVerified:"pass",lastVerifiedAt:"2026-07-05 14:30"},
  {id:"el-005",name:"搜索输入框",page:"首页",group:"搜索栏",locatorType:"role",locatorValue:"searchbox",description:"全站主搜索输入框",refCount:22,lastVerified:"fail",lastVerifiedAt:"2026-07-05 11:20"},
  {id:"el-006",name:"加入购物车按钮",page:"商品详情页",group:"商品操作",locatorType:"text",locatorValue:"加入购物车",description:"商品详情页加购操作按钮",refCount:9,lastVerified:"pass",lastVerifiedAt:"2026-07-04 16:45"},
  {id:"el-007",name:"购物车数量徽章",page:"首页",group:"导航栏",locatorType:"css",locatorValue:".cart-badge",description:"导航栏上的购物车商品数量提示",refCount:6,lastVerified:null,lastVerifiedAt:"—"},
];

const UI_RUNS: UIRun[] = [
  {id:"run-001",caseName:"用户登录正常流程",status:"pass",browser:"Chrome 126",env:"测试环境",startedAt:"2026-07-05 14:30:05",duration:"8.3s",steps:[
    {id:"rs1",type:"navigate",description:"打开登录页面",status:"pass",duration:"1.2s",hasScreenshot:true},
    {id:"rs2",type:"click",description:"点击「用户名输入框」",status:"pass",duration:"0.3s",hasScreenshot:false},
    {id:"rs3",type:"input",description:"输入测试账号",status:"pass",duration:"0.1s",hasScreenshot:false},
    {id:"rs4",type:"click",description:"点击「密码输入框」",status:"pass",duration:"0.2s",hasScreenshot:false},
    {id:"rs5",type:"input",description:"输入密码",status:"pass",duration:"0.1s",hasScreenshot:false},
    {id:"rs6",type:"click",description:"点击「登录按钮」",status:"pass",duration:"0.4s",hasScreenshot:false},
    {id:"rs7",type:"wait",description:"等待页面跳转完成",status:"pass",duration:"2.1s",hasScreenshot:false},
    {id:"rs8",type:"assert",description:"断言欢迎文字可见",status:"pass",duration:"0.5s",hasScreenshot:true},
    {id:"rs9",type:"screenshot",description:"截图记录登录成功状态",status:"pass",duration:"3.4s",hasScreenshot:true},
  ]},
  {id:"run-002",caseName:"商品搜索与筛选",status:"fail",browser:"Chrome 126",env:"测试环境",startedAt:"2026-07-05 11:20:33",duration:"12.7s",steps:[
    {id:"rs10",type:"navigate",description:"打开首页",status:"pass",duration:"1.5s",hasScreenshot:true},
    {id:"rs11",type:"click",description:"点击「搜索输入框」",status:"pass",duration:"0.3s",hasScreenshot:false},
    {id:"rs12",type:"input",description:"输入搜索关键词「手机」",status:"pass",duration:"0.2s",hasScreenshot:false},
    {id:"rs13",type:"assert",description:"断言搜索结果列表可见",status:"fail",duration:"5.0s",hasScreenshot:true,errorMsg:"Element not found: [data-testid='search-result-list']\nTimeout exceeded after 5000ms\nSelector: css=[data-testid='search-result-list']\nExpected: element to be visible\nActual: element not found in DOM"},
    {id:"rs14",type:"screenshot",description:"截图记录失败状态",status:"skip",duration:"—",hasScreenshot:false},
  ]},
  {id:"run-003",caseName:"购物车加购与结算",status:"pass",browser:"Chrome 126",env:"测试环境",startedAt:"2026-07-04 16:45:12",duration:"15.2s",steps:[]},
  {id:"run-004",caseName:"订单状态流转核心路径",status:"running",browser:"Chrome 126",env:"预发布环境",startedAt:"2026-07-05 15:00:00",duration:"—",steps:[]},
];

const AI_ELEMENTS: AIEl[] = [
  {id:"ai-1",name:"登录按钮",elType:"button",purpose:"触发用户登录操作，提交表单数据",locatorType:"role",locatorValue:"button[name='登录']",confidence:97,adoptStatus:"pending"},
  {id:"ai-2",name:"用户名输入框",elType:"input",purpose:"接收用户输入的账号或手机号",locatorType:"id",locatorValue:"#username",confidence:95,adoptStatus:"pending"},
  {id:"ai-3",name:"密码输入框",elType:"input",purpose:"接收用户输入的登录密码",locatorType:"id",locatorValue:"#password",confidence:95,adoptStatus:"adopted"},
  {id:"ai-4",name:"忘记密码链接",elType:"link",purpose:"跳转到密码重置流程的入口链接",locatorType:"text",locatorValue:"忘记密码",confidence:88,adoptStatus:"pending"},
  {id:"ai-5",name:"第三方登录-微信",elType:"button",purpose:"使用微信账号授权登录",locatorType:"css",locatorValue:".login-wechat-btn",confidence:82,adoptStatus:"ignored"},
  {id:"ai-6",name:"错误提示文字",elType:"text",purpose:"显示登录失败或参数错误信息",locatorType:"css",locatorValue:".error-msg",confidence:91,adoptStatus:"pending"},
];

// ─── Atom components ──────────────────────────────────────────────────────────

function StepBadge({type}:{type:StepType}) {
  const c=STEP_CFG[type];const Icon=c.icon;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold" style={{backgroundColor:c.bg,color:c.color}}><Icon size={10}/>{c.label}</span>;
}

function UIRunBadge({status}:{status:UIRunStatus}) {
  const c=UI_RUN_CFG[status];
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium" style={{backgroundColor:c.bg,color:c.color}}>{c.label}</span>;
}

// ─── Case List ────────────────────────────────────────────────────────────────

function UICaseList({onEdit,onRecord}:{onEdit:(c:UICase)=>void;onRecord?:()=>void}) {
  const [cases]=useState<UICase[]>(UI_CASES);
  const [selDir,setSelDir]=useState("root");
  const [selected,setSelected]=useState<string[]>([]);
  const toggleSel=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);

  const STATUS_CFG:Record<"active"|"inactive"|"draft",{label:string;dot:string}> = {
    active:{label:"已启用",dot:T.success}, inactive:{label:"已停用",dot:T.t4}, draft:{label:"草稿",dot:T.warning},
  };

  const tree=[{id:"root",label:"电商平台",count:cases.length,children:[
    {id:"user",label:"用户模块",count:2,children:[]},
    {id:"goods",label:"商品模块",count:2,children:[]},
    {id:"cart",label:"购物车",count:1,children:[]},
    {id:"order",label:"订单模块",count:1,children:[]},
  ]}];

  const renderNode=(n:any,depth=0)=>(
    <div key={n.id}>
      <button onClick={()=>setSelDir(n.id)} className="w-full flex items-center gap-1.5 py-1.5 rounded-md text-[12px] transition-colors text-left"
        style={{paddingLeft:10+depth*14,backgroundColor:selDir===n.id?`${T.cyan}12`:""}}
        onMouseEnter={e=>selDir!==n.id&&(e.currentTarget.style.backgroundColor="#F4F6FA")}
        onMouseLeave={e=>selDir!==n.id&&(e.currentTarget.style.backgroundColor="")}>
        <Folder size={12} style={{color:T.cyan,flexShrink:0}}/>
        <span className="flex-1 truncate" style={{color:selDir===n.id?T.cyan:T.t1}}>{n.label}</span>
        <span className="text-[10px] mr-1" style={{color:T.t4}}>{n.count}</span>
      </button>
      {n.children?.map((c:any)=>renderNode(c,depth+1))}
    </div>
  );

  return(
    <div className="flex flex-1 overflow-hidden">
      {/* Tree */}
      <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:220,backgroundColor:"#fff",borderRight:`1px solid ${T.border}`}}>
        <div className="px-3 pt-3 pb-2"><PBtn icon={Plus} onClick={()=>{}} small color={T.cyan}>新建目录</PBtn></div>
        <div className="px-3 pb-2"><Inp placeholder="搜索目录" prefix={<Search size={12}/>} width="100%"/></div>
        <div className="flex-1 overflow-y-auto px-2 py-1">{tree.map(n=>renderNode(n))}</div>
      </div>

      {/* Case table */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-2.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
          <Inp placeholder="搜索用例名称" prefix={<Search size={13}/>} width={200}/>
          <Sel width={100}><option>全部状态</option><option>已启用</option><option>已停用</option><option>草稿</option></Sel>
          <Sel width={100}><option>全部优先级</option><option>P0</option><option>P1</option><option>P2</option></Sel>
          <Sel width={110}><option>全部浏览器</option><option>Chrome</option><option>Firefox</option><option>Safari</option></Sel>
          <div className="flex-1"/>
          {selected.length>0&&<div className="flex items-center gap-1.5 mr-2"><span className="text-[12px]" style={{color:T.t3}}>已选 {selected.length}</span><PBtn variant="ghost" icon={Play} color={T.cyan}>批量运行</PBtn><PBtn variant="ghost" icon={Trash2} color={T.danger}>删除</PBtn></div>}
          <button onClick={onRecord}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium transition-all"
            style={{borderColor:`${T.cyan}60`,color:T.cyan,backgroundColor:`${T.cyan}08`}}
            onMouseEnter={e=>{e.currentTarget.style.backgroundColor=`${T.cyan}14`;}}
            onMouseLeave={e=>{e.currentTarget.style.backgroundColor=`${T.cyan}08`;}}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{backgroundColor:T.danger}}/>
            录制用例
          </button>
          <PBtn icon={Plus} onClick={()=>{}} color={T.cyan}>新建用例</PBtn>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ETable total={cases.length} cols={[
            {label:"",width:"3%"},{label:"用例名称",width:"25%"},{label:"所属目录",width:"15%"},
            {label:"状态",width:"8%"},{label:"优先级",width:"7%"},{label:"最近结果",width:"9%"},
            {label:"最近运行",width:"12%"},{label:"创建人",width:"7%"},{label:"操作",width:"14%",align:"right"},
          ]}>
            {cases.map(c=>{
              const sc=STATUS_CFG[c.status];const ps=PRIORITY_STYLE[c.priority];
              return(
                <TR key={c.id} onClick={()=>onEdit(c)}>
                  <TD><input type="checkbox" checked={selected.includes(c.id)} onChange={()=>toggleSel(c.id)} onClick={e=>e.stopPropagation()} className="w-3.5 h-3.5" style={{accentColor:T.cyan}}/></TD>
                  <TD>
                    <div>
                      <p className="font-medium truncate max-w-[200px]" style={{color:T.primary}}>{c.name}</p>
                      <div className="flex gap-1 mt-0.5">{c.tags.slice(0,2).map(t=><span key={t} className="px-1.5 py-px rounded text-[10px]" style={{backgroundColor:"#F2F3F5",color:T.t3}}>{t}</span>)}</div>
                    </div>
                  </TD>
                  <TD muted><span className="truncate block max-w-[130px]">{c.directory}</span></TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 text-[12px]">
                      <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:sc.dot}}/>
                      <span style={{color:T.t2}}>{sc.label}</span>
                    </span>
                  </TD>
                  <TD><span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:ps.bg,color:ps.color}}>{c.priority}</span></TD>
                  <TD>{c.lastRunResult?<UIRunBadge status={c.lastRunResult}/>:<span className="text-[12px]" style={{color:T.t4}}>未运行</span>}</TD>
                  <TD mono muted>{c.lastRunAt}</TD>
                  <TD muted>{c.creator}</TD>
                  <TD align="right">
                    <div className="flex items-center justify-end">
                      <IBtn icon={Edit2} label="编辑" onClick={()=>onEdit(c)}/>
                      <IBtn icon={Play} label="运行" onClick={()=>{}}/>
                      <IBtn icon={Copy} label="复制" onClick={()=>{}}/>
                      <IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </ETable>
        </div>
      </div>
    </div>
  );
}

// ─── Case Editor ──────────────────────────────────────────────────────────────

function UICaseEditor({case_,onBack,onReRecord,onAppendRecord,onUnsavedClose,onAddStep,onEditStep,onSingleDebug}:{case_:UICase;onBack:()=>void;onReRecord?:()=>void;onAppendRecord?:()=>void;onUnsavedClose?:()=>void;onAddStep?:()=>void;onEditStep?:()=>void;onSingleDebug?:()=>void}) {
  const [steps,setSteps]=useState<UIStep[]>(SAMPLE_STEPS);
  const [editorTab,setEditorTab]=useState<"steps"|"info"|"settings">("steps");
  const [selectedStep,setSelectedStep]=useState<string|null>(null);
  const toggleStep=(id:string)=>setSteps(ss=>ss.map(s=>s.id===id?{...s,enabled:!s.enabled}:s));
  const moveStep=(id:string,dir:-1|1)=>setSteps(ss=>{const idx=ss.findIndex(s=>s.id===id);if(idx+dir<0||idx+dir>=ss.length)return ss;const a=[...ss];[a[idx],a[idx+dir]]=[a[idx+dir],a[idx]];return a.map((s,i)=>({...s,order:i+1}));});

  return(
    <div className="flex flex-1 overflow-hidden">
      {/* Main editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Editor header */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0 bg-white" style={{borderBottom:`1px solid ${T.border}`}}>
          <button onClick={onUnsavedClose??onBack} className="flex items-center gap-1 text-[13px] transition-colors" style={{color:T.t3}} onMouseEnter={e=>e.currentTarget.style.color=T.cyan} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
            <ChevronLeft size={14}/> 返回列表
          </button>
          <span style={{color:T.t4}}>|</span>
          <span className="text-[14px] font-semibold" style={{color:T.t1}}>{case_.name}</span>
          <UIRunBadge status={case_.lastRunResult||"pending"}/>
          <div className="flex-1"/>
          {/* Recording actions */}
          <div className="flex items-center gap-1 mr-1">
            {onReRecord&&<button onClick={onReRecord} className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-medium transition-colors" style={{color:T.danger,border:`1px solid ${T.danger}40`,backgroundColor:`${T.danger}06`}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=`${T.danger}10`} onMouseLeave={e=>e.currentTarget.style.backgroundColor=`${T.danger}06`}><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:T.danger}}/>重新录制</button>}
            {onAppendRecord&&<button onClick={onAppendRecord} className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-medium transition-colors" style={{color:T.t2,border:`1px solid ${T.border}`}} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#F4F6FA"} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}><PlusCircle size={11}/>追加录制</button>}
          </div>
          <div className="h-5 w-px flex-shrink-0" style={{backgroundColor:T.border}}/>
          <button onClick={onSingleDebug} className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-medium transition-colors" style={{color:T.t2,border:`1px solid ${T.border}`}} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#F4F6FA"} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}><SkipForward size={11}/>单步调试</button>
          <button className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-medium transition-colors" style={{color:T.t2,border:`1px solid ${T.border}`}} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#F4F6FA"} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}><Play size={11}/>整体回放</button>
          <div className="h-5 w-px flex-shrink-0" style={{backgroundColor:T.border}}/>
          <PBtn icon={Play} onClick={()=>{}} color={T.cyan}>调试运行</PBtn>
          <PBtn icon={Save} onClick={()=>{}} variant="ghost">保存</PBtn>
        </div>

        {/* Editor tabs */}
        <div className="flex flex-shrink-0 px-5 bg-white" style={{borderBottom:`1px solid ${T.border}`}}>
          {(["steps","info","settings"] as const).map(t=>{
            const labels={steps:`测试步骤 (${steps.length})`,info:"基本信息",settings:"运行设置"};
            return <button key={t} onClick={()=>setEditorTab(t)} className="h-10 px-4 text-[13px] font-medium border-b-2 transition-colors" style={{borderBottomColor:editorTab===t?T.cyan:"transparent",color:editorTab===t?T.cyan:T.t3}}>{labels[t]}</button>;
          })}
        </div>

        {/* Steps editor */}
        {editorTab==="steps"&&(
          <div className="flex-1 overflow-y-auto p-5">
            {/* AI suggestion banner */}
            <AiStepSuggestions/>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px]" style={{color:T.t3}}>拖拽调整步骤顺序，点击步骤行进入详细编辑</p>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-[12px] transition-colors" style={{borderColor:T.border,color:T.t3}} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#F4F6FA"} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}><RotateCcw size={11}/>重置</button>
                <PBtn icon={Plus} onClick={()=>{}} small color={T.cyan}>添加步骤</PBtn>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`,backgroundColor:"#fff"}}>
              {steps.map((step,i)=>{
                const sc=STEP_CFG[step.type];const Icon=sc.icon;
                const isSelected=selectedStep===step.id;
                return(
                  <div key={step.id}
                    className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 cursor-pointer transition-all"
                    style={{borderColor:T.border,borderLeft:`3px solid ${step.enabled?sc.color:T.t4}`,backgroundColor:isSelected?`${sc.color}06`:"",opacity:step.enabled?1:0.5}}
                    onClick={()=>{setSelectedStep(isSelected?null:step.id);onEditStep?.();}}>
                    <GripVertical size={14} style={{color:T.t4,cursor:"grab",flexShrink:0}}/>
                    <Toggle on={step.enabled} onChange={()=>toggleStep(step.id)}/>
                    <span className="text-[12px] font-mono w-5 text-right flex-shrink-0" style={{color:T.t4}}>{step.order}</span>
                    <StepBadge type={step.type}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium" style={{color:step.enabled?T.t1:T.t3}}>{step.description}</p>
                      {step.element&&<p className="text-[11px] mt-0.5" style={{color:T.t3}}>元素：<code className="px-1 py-px rounded" style={{backgroundColor:"#F2F3F5"}}>{step.element}</code></p>}
                      {step.value&&!step.element&&<p className="text-[11px] mt-0.5 font-mono" style={{color:T.t3}}>{step.value}</p>}
                    </div>
                    {/* Move up/down + action icons */}
                    <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>moveStep(step.id,-1)} disabled={i===0} className="w-6 h-6 flex items-center justify-center rounded transition-colors" style={{color:i===0?T.t4:T.t3}} onMouseEnter={e=>i>0&&(e.currentTarget.style.backgroundColor="#F2F3F5")} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}><ArrowUp size={12}/></button>
                      <button onClick={()=>moveStep(step.id,1)} disabled={i===steps.length-1} className="w-6 h-6 flex items-center justify-center rounded transition-colors" style={{color:i===steps.length-1?T.t4:T.t3}} onMouseEnter={e=>i<steps.length-1&&(e.currentTarget.style.backgroundColor="#F2F3F5")} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}><ArrowDown size={12}/></button>
                      <IBtn icon={Copy} label="复制步骤" onClick={()=>{}}/>
                      <IBtn icon={Trash2} label="删除" danger onClick={onUnsavedClose}/>
                    </div>
                  </div>
                );
              })}

              {/* Add step row */}
              <button onClick={onAddStep} className="w-full flex items-center justify-center gap-2 py-3 transition-colors text-[13px]"
                style={{color:T.t4}} onMouseEnter={e=>{e.currentTarget.style.backgroundColor="#F4F6FA";e.currentTarget.style.color=T.cyan;}} onMouseLeave={e=>{e.currentTarget.style.backgroundColor="";e.currentTarget.style.color=T.t4;}}>
                <Plus size={14}/>添加测试步骤
              </button>
            </div>
          </div>
        )}

        {editorTab==="info"&&(
          <div className="flex-1 overflow-y-auto p-5">
            <div className="bg-white rounded-xl p-5" style={{border:`1px solid ${T.border}`}}>
              <div className="grid grid-cols-2 gap-4">
                {[{l:"用例名称",v:case_.name},{l:"所属目录",v:case_.directory},{l:"优先级",v:case_.priority},{l:"浏览器",v:case_.browser},{l:"创建人",v:case_.creator},{l:"状态",v:"已启用"}].map((f,i)=>(
                  <div key={i}><label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}>{f.l}</label><input defaultValue={f.v} className="w-full h-9 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}/></div>
                ))}
                <div className="col-span-2"><label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}>标签</label><input defaultValue={case_.tags.join(", ")} className="w-full h-9 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}/></div>
              </div>
            </div>
          </div>
        )}

        {editorTab==="settings"&&(
          <div className="flex-1 overflow-y-auto p-5">
            <div className="bg-white rounded-xl p-5" style={{border:`1px solid ${T.border}`}}>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}>执行环境</label><select className="w-full h-9 px-2.5 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}><option>测试环境</option><option>预发布环境</option></select></div>
                <div><label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}>浏览器</label><select className="w-full h-9 px-2.5 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}><option>Chrome (headless)</option><option>Chrome (headed)</option><option>Firefox</option></select></div>
                <div><label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}>默认超时时长 (ms)</label><input defaultValue="30000" className="w-full h-9 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}/></div>
                <div><label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}>失败重试次数</label><input defaultValue="2" className="w-full h-9 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}/></div>
                <div><label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}>截图策略</label><select className="w-full h-9 px-2.5 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}><option>仅失败时截图</option><option>每步均截图</option><option>不截图</option></select></div>
                <div><label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}>变量集</label><select className="w-full h-9 px-2.5 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}><option>默认变量集</option><option>测试数据集A</option></select></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: Quick run panel */}
      <div className="flex-shrink-0 flex flex-col p-4 gap-3" style={{width:210,borderLeft:`1px solid ${T.border}`,backgroundColor:"#fff"}}>
        <p className="text-[12px] font-semibold" style={{color:T.t2}}>快速运行</p>
        <select className="w-full h-8 px-2.5 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}}><option>测试环境</option><option>预发布环境</option></select>
        <select className="w-full h-8 px-2.5 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}}><option>Chrome (headless)</option><option>Chrome</option><option>Firefox</option></select>
        <PBtn icon={Play} onClick={()=>{}} color={T.cyan} small>运行此用例</PBtn>
        <div className="h-px" style={{backgroundColor:T.border}}/>
        <div className="space-y-2">
          {[{l:"步骤数",v:steps.length},{l:"已启用",v:steps.filter(s=>s.enabled).length},{l:"最近结果",v:case_.lastRunResult||"—"},{l:"最近运行",v:case_.lastRunAt}].map(f=>(
            <div key={f.l} className="flex justify-between">
              <span className="text-[11px]" style={{color:T.t3}}>{f.l}</span>
              <span className="text-[11px] font-medium" style={{color:T.t1}}>{f.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── AI Step Suggestions Panel ───────────────────────────────────────────────

function AiStepSuggestions() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const suggestions = [
    { type:"rename" as const, step:"步骤 3 · 步骤 5", msg:"「输入文本」建议改为「输入用户名」和「输入密码」，名称更具可读性", reason:"元素绑定为 #username-input / #password-input，业务语义明确" },
    { type:"assert" as const, step:"步骤 6 后", msg:"建议在点击登录后添加断言：当前 URL 包含 /dashboard 或 /home", reason:"登录成功后 URL 必然跳转，该断言可明确验证登录结果" },
    { type:"duplicate" as const, step:"步骤 2 · 步骤 4", msg:"「点击输入框」步骤通常可以省略，直接输入即可定位到元素", reason:"Playwright / Selenium 输入前不需要显式 click 聚焦，可精简步骤" },
  ];

  const typeStyle = {
    rename:    { color:"#7816FF", bg:"#F5E8FF", label:"优化名称" },
    assert:    { color:T.cyan,    bg:"#E8FFFB", label:"推荐断言" },
    duplicate: { color:T.warning, bg:"#FFF3E8", label:"冗余步骤" },
  };

  return (
    <div className="mb-4 rounded-xl overflow-hidden" style={{ border:`1px solid ${T.cyan}50` }}>
      <button onClick={()=>setOpen(!open)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left" style={{ backgroundColor:`${T.cyan}0D` }}>
        <Sparkles size={13} style={{ color:T.cyan }}/>
        <span className="text-[12px] font-semibold flex-1" style={{ color:T.t1 }}>AI 步骤优化建议 <span className="font-normal" style={{ color:T.t3 }}>· 3 条</span></span>
        <button onClick={e=>{e.stopPropagation();setDismissed(true);}} className="text-[11px] px-2 py-0.5 rounded transition-colors" style={{ color:T.t3 }} onMouseEnter={e=>e.currentTarget.style.color=T.t1} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>忽略全部</button>
        <ChevronDown size={13} style={{ color:T.t3, transform:open?"rotate(180deg)":"", transition:"transform 0.2s" }}/>
      </button>
      {open && (
        <div className="divide-y" style={{ backgroundColor:"#FAFFFE", borderColor:T.border }}>
          {suggestions.map((s,i) => {
            const ts = typeStyle[s.type];
            return (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 mt-0.5" style={{ backgroundColor:ts.bg, color:ts.color }}>{ts.label}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <code className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor:"#F2F3F5", color:T.t2 }}>{s.step}</code>
                    <p className="text-[12px]" style={{ color:T.t1 }}>{s.msg}</p>
                  </div>
                  <p className="text-[11px]" style={{ color:T.t3 }}>理由：{s.reason}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button className="h-6 px-2 rounded text-[11px] font-medium transition-colors" style={{ backgroundColor:`${T.cyan}15`, color:T.cyan }} onMouseEnter={e=>e.currentTarget.style.backgroundColor=`${T.cyan}25`} onMouseLeave={e=>e.currentTarget.style.backgroundColor=`${T.cyan}15`}>采纳</button>
                  <button className="h-6 px-2 rounded text-[11px] transition-colors" style={{ color:T.t3 }} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#F2F3F5"} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>忽略</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Record Config Modal ──────────────────────────────────────────────────────

interface RecordCfg {
  name: string; directory: string; env: string; startUrl: string;
  browser: string; autoCapture: boolean; autoAssert: boolean;
}

function RecordConfigModal({ onClose, onStart }:{ onClose:()=>void; onStart:(cfg:RecordCfg)=>void }) {
  const [cfg, setCfg] = useState<RecordCfg>({
    name:"", directory:"电商平台/用户模块", env:"测试环境",
    startUrl:"https://test.example.com", browser:"Chrome (headed)",
    autoCapture:true, autoAssert:true,
  });
  const valid = cfg.name.trim().length > 0 && cfg.startUrl.trim().length > 0;

  const Field = ({ label, req, children }:{ label:string; req?:boolean; children:React.ReactNode }) => (
    <div>
      <label className="text-[12px] font-medium mb-1.5 flex items-center gap-0.5" style={{ color:T.t2 }}>
        {req && <span style={{ color:T.danger }}>*</span>}{label}
      </label>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{ backgroundColor:"rgba(29,33,41,0.5)" }} onClick={onClose}/>
      <div className="relative bg-white rounded-2xl overflow-hidden flex" style={{ width:840, maxHeight:"88vh", boxShadow:"0 24px 64px rgba(0,0,0,0.22)" }}>
        {/* Left intro panel */}
        <div className="flex-shrink-0 flex flex-col p-6" style={{ width:280, backgroundColor:"#0F1923" }}>
          <div className="flex items-center gap-2 mb-6">
            <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor:T.danger }}/>
            <span className="text-[13px] font-semibold" style={{ color:"#E5EAF0" }}>用例录制</span>
          </div>
          <p className="text-[12px] leading-relaxed mb-6" style={{ color:"#6B7D93" }}>
            平台将打开指定浏览器并启动录制代理。在浏览器中的每次操作都会被自动捕获为测试步骤，无需手动编写代码。
          </p>
          <div className="space-y-3">
            {[
              { icon:<Monitor size={13}/>, title:"自动捕获操作", desc:"点击、输入、导航均自动转为步骤" },
              { icon:<Sparkles size={13}/>, title:"AI 智能优化", desc:"自动生成步骤名称和断言建议" },
              { icon:<Edit2 size={13}/>, title:"录制后可编辑", desc:"录完即可删除、调序、修改步骤" },
            ].map((tip,i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg" style={{ backgroundColor:"#1A2635" }}>
                <span className="flex-shrink-0 mt-0.5" style={{ color:T.cyan }}>{tip.icon}</span>
                <div>
                  <p className="text-[12px] font-semibold" style={{ color:"#C5D3E0" }}>{tip.title}</p>
                  <p className="text-[11px] mt-0.5" style={{ color:"#6B7D93" }}>{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex-1"/>
          <div className="rounded-lg px-3 py-2.5 mt-4" style={{ backgroundColor:"#1A2635", border:`1px solid ${T.warning}30` }}>
            <p className="text-[11px]" style={{ color:T.warning }}>录制期间浏览器将以有头模式运行（headed），完成后自动转为用例步骤。</p>
          </div>
        </div>

        {/* Right form */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom:`1px solid ${T.border}` }}>
            <h2 className="text-[15px] font-semibold" style={{ color:T.t1 }}>录制配置</h2>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors" style={{ color:T.t4 }} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>
              <X size={15}/>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <Field label="用例名称" req>
                <input placeholder="例：用户登录正常流程"
                  value={cfg.name} onChange={e=>setCfg({...cfg,name:e.target.value})}
                  className="w-full h-9 px-3 border rounded-lg text-[13px] outline-none transition-all"
                  style={{ borderColor:T.border, color:T.t1 }}
                  onFocus={e=>{e.currentTarget.style.borderColor=T.cyan;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.cyan}18`;}}
                  onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="所属目录" req>
                  <select className="w-full h-9 px-2.5 border rounded-lg text-[13px] outline-none bg-white" style={{ borderColor:T.border, color:T.t1 }} value={cfg.directory} onChange={e=>setCfg({...cfg,directory:e.target.value})}>
                    <option>电商平台/用户模块</option>
                    <option>电商平台/商品模块</option>
                    <option>电商平台/购物车</option>
                    <option>电商平台/订单模块</option>
                  </select>
                </Field>
                <Field label="目标环境" req>
                  <select className="w-full h-9 px-2.5 border rounded-lg text-[13px] outline-none bg-white" style={{ borderColor:T.border, color:T.t1 }} value={cfg.env} onChange={e=>setCfg({...cfg,env:e.target.value})}>
                    <option>测试环境</option>
                    <option>预发布环境</option>
                    <option>开发环境</option>
                  </select>
                </Field>
              </div>

              <Field label="起始 URL" req>
                <input placeholder="https://test.example.com/login"
                  value={cfg.startUrl} onChange={e=>setCfg({...cfg,startUrl:e.target.value})}
                  className="w-full h-9 px-3 border rounded-lg text-[13px] font-mono outline-none transition-all"
                  style={{ borderColor:T.border, color:T.t1 }}
                  onFocus={e=>{e.currentTarget.style.borderColor=T.cyan;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.cyan}18`;}}
                  onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
              </Field>

              <Field label="浏览器">
                <div className="grid grid-cols-3 gap-2">
                  {["Chrome (headed)","Firefox (headed)","Safari"].map(b=>(
                    <button key={b} onClick={()=>setCfg({...cfg,browser:b})}
                      className="h-9 px-2 rounded-lg border text-[12px] font-medium transition-all"
                      style={{ borderColor:cfg.browser===b?T.cyan:T.border, color:cfg.browser===b?T.cyan:T.t2, backgroundColor:cfg.browser===b?`${T.cyan}08`:"transparent" }}>
                      {b}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor:"#F7F8FA" }}>
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color:T.t3 }}>AI 辅助选项</p>
                {[
                  { key:"autoCapture" as const, label:"自动采集页面元素", desc:"录制过程中自动识别并采集页面元素，录制完成后同步到元素库" },
                  { key:"autoAssert"  as const, label:"自动生成断言建议", desc:"AI 根据页面状态变化推荐断言规则，在步骤确认页显示" },
                ].map(opt=>(
                  <div key={opt.key} className="flex items-start gap-3">
                    <Toggle on={cfg[opt.key]} onChange={v=>setCfg({...cfg,[opt.key]:v})}/>
                    <div className="flex-1">
                      <p className="text-[12px] font-medium" style={{ color:T.t1 }}>{opt.label}</p>
                      <p className="text-[11px] mt-0.5" style={{ color:T.t3 }}>{opt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 flex-shrink-0" style={{ borderTop:`1px solid ${T.border}` }}>
            <PBtn onClick={onClose} variant="ghost">取消</PBtn>
            <button onClick={()=>valid&&onStart(cfg)}
              className="inline-flex items-center gap-2 h-8 px-4 rounded-lg text-[13px] font-semibold transition-all"
              style={{ backgroundColor:valid?T.danger:"#C9CDD4", color:"#fff", cursor:valid?"pointer":"not-allowed" }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor:"#fff" }}/>
              开始录制
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Recording Workspace ──────────────────────────────────────────────────────

const REC_MOCK_STEPS: UIStep[] = [
  { id:"r1", order:1, enabled:true, type:"navigate",   description:"打开登录页面",           value:"https://test.example.com/login" },
  { id:"r2", order:2, enabled:true, type:"click",      description:"点击「用户名输入框」",   element:"用户名输入框" },
  { id:"r3", order:3, enabled:true, type:"input",      description:"输入用户名",              element:"用户名输入框", value:"qatest001" },
  { id:"r4", order:4, enabled:true, type:"click",      description:"点击「密码输入框」",     element:"密码输入框" },
  { id:"r5", order:5, enabled:true, type:"input",      description:"输入密码",                element:"密码输入框", value:"••••••••" },
  { id:"r6", order:6, enabled:true, type:"click",      description:"点击「登录按钮」",       element:"登录按钮" },
  { id:"r7", order:7, enabled:true, type:"wait",       description:"等待页面跳转完成",       value:"3000" },
  { id:"r8", order:8, enabled:true, type:"screenshot", description:"截图 — 登录后首页状态"  },
  { id:"r9", order:9, enabled:true, type:"assert",     description:"AI 建议：断言欢迎文字可见", element:"欢迎提示文字", value:"包含：欢迎" },
];

function RecordingWorkspace({ config, onStop, onDiscard }:{
  config: RecordCfg;
  onStop: (steps: UIStep[]) => void;
  onDiscard: () => void;
}) {
  const [phase, setPhase] = useState<"recording"|"paused">("recording");
  const [visibleCount, setVisibleCount] = useState(1);
  const [currentUrl, setCurrentUrl] = useState(config.startUrl);

  const urls = [
    config.startUrl,
    config.startUrl,
    config.startUrl,
    config.startUrl,
    config.startUrl,
    config.startUrl + "/dashboard",
    config.startUrl + "/dashboard",
    config.startUrl + "/dashboard",
    config.startUrl + "/dashboard",
  ];

  useEffect(() => {
    if (phase !== "recording") return;
    if (visibleCount >= REC_MOCK_STEPS.length) return;
    const t = setTimeout(() => {
      setVisibleCount(v => {
        const next = Math.min(v + 1, REC_MOCK_STEPS.length);
        setCurrentUrl(urls[next - 1] ?? config.startUrl);
        return next;
      });
    }, 1400);
    return () => clearTimeout(t);
  }, [visibleCount, phase]);

  const visibleSteps = REC_MOCK_STEPS.slice(0, visibleCount);
  const isComplete   = visibleCount >= REC_MOCK_STEPS.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor:T.bg }}>
      {/* Recording status bar */}
      <div className="flex-shrink-0 flex items-center gap-4 px-5 py-3 bg-white" style={{ borderBottom:`1px solid ${T.border}` }}>
        {/* State pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: phase==="recording"?`${T.danger}12`:`${T.warning}12` }}>
          {phase==="recording"
            ? <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor:T.danger }}/>
            : <span className="w-2 h-2 rounded-full" style={{ backgroundColor:T.warning }}/>}
          <span className="text-[12px] font-bold" style={{ color: phase==="recording"?T.danger:T.warning }}>
            {phase==="recording" ? "录制中" : "已暂停"}
          </span>
        </div>

        {/* URL bar */}
        <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-1.5 rounded-lg" style={{ backgroundColor:"#F7F8FA", border:`1px solid ${T.border}` }}>
          <Globe2 size={12} style={{ color:T.t4, flexShrink:0 }}/>
          <code className="text-[12px] truncate flex-1" style={{ color:T.t2 }}>{currentUrl}</code>
        </div>

        {/* Step counter */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[22px] font-bold font-mono" style={{ color:T.t1 }}>{visibleCount}</span>
          <span className="text-[11px]" style={{ color:T.t3 }}>步骤</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {phase==="recording"
            ? <button onClick={()=>setPhase("paused")} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium transition-colors" style={{ borderColor:T.border, color:T.t2 }} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#F4F6FA"} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}><Pause size={12}/>暂停</button>
            : <button onClick={()=>setPhase("recording")} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium transition-colors" style={{ borderColor:T.border, color:T.t2 }} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#F4F6FA"} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}><Play size={12}/>继续</button>}
          <button onClick={()=>onStop(visibleSteps)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium transition-all" style={{ backgroundColor:T.t1, color:"#fff" }} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#2E3542"} onMouseLeave={e=>e.currentTarget.style.backgroundColor=T.t1}><Square size={12}/>停止</button>
          {isComplete && <button onClick={()=>onStop(visibleSteps)} className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-semibold" style={{ backgroundColor:T.cyan, color:"#fff" }}><Save size={12}/>进入步骤确认</button>}
          <button onClick={onDiscard} className="h-8 px-3 rounded-lg border text-[13px] transition-colors" style={{ borderColor:T.border, color:T.t3 }} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.danger;e.currentTarget.style.color=T.danger;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.t3;}}>放弃</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Live step list */}
        <div className="flex-shrink-0 flex flex-col bg-white overflow-hidden" style={{ width:380, borderRight:`1px solid ${T.border}` }}>
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ borderBottom:`1px solid ${T.border}` }}>
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color:T.t3 }}>已录制步骤</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ backgroundColor:`${T.danger}12`, color:T.danger }}>{visibleCount} 步</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {visibleSteps.map((step, i) => {
              const sc = STEP_CFG[step.type];
              const isNew = i === visibleCount - 1 && phase === "recording";
              return (
                <div key={step.id}
                  className="flex items-center gap-2.5 px-4 py-2.5 border-b transition-all"
                  style={{ borderColor:T.border, backgroundColor:isNew?`${sc.color}06`:"transparent", borderLeft:`3px solid ${isNew?sc.color:"transparent"}` }}>
                  <span className="w-4 text-[10px] font-mono text-right flex-shrink-0" style={{ color:T.t4 }}>{step.order}</span>
                  <StepBadge type={step.type}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] truncate" style={{ color:T.t1 }}>{step.description}</p>
                    {step.value && !step.element && <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color:T.t3 }}>{step.value}</p>}
                    {step.element && <p className="text-[10px] mt-0.5" style={{ color:T.t3 }}>元素：{step.element}</p>}
                  </div>
                  {isNew && <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded animate-pulse" style={{ backgroundColor:`${sc.color}20`, color:sc.color }}>新增</span>}
                </div>
              );
            })}
            {/* Next step placeholder */}
            {phase==="recording" && !isComplete && (
              <div className="flex items-center gap-2.5 px-4 py-2.5 opacity-40">
                <span className="w-4 text-[10px] font-mono text-right flex-shrink-0" style={{ color:T.t4 }}>{visibleCount+1}</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-14 h-5 rounded animate-pulse" style={{ backgroundColor:"#F2F3F5" }}/>
                </div>
                <div className="flex-1">
                  <div className="w-32 h-3 rounded animate-pulse" style={{ backgroundColor:"#F2F3F5" }}/>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right info area */}
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-sm">
            {/* Browser mock frame */}
            <div className="rounded-2xl overflow-hidden mb-6" style={{ border:`1px solid ${T.border}`, boxShadow:"0 4px 20px rgba(0,0,0,0.08)" }}>
              <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor:"#1D2129" }}>
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor:"#F53F3F" }}/>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor:"#FAAD14" }}/>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor:"#00B42A" }}/>
                </div>
                <div className="flex-1 rounded px-3 py-1 text-[11px] font-mono truncate" style={{ backgroundColor:"#2C3342", color:"#94A3B8" }}>{currentUrl}</div>
              </div>
              <div className="flex flex-col items-center justify-center" style={{ height:160, backgroundColor:"#F7F9FC" }}>
                <Monitor size={28} style={{ color:T.t4 }} className="mb-2"/>
                <p className="text-[12px]" style={{ color:T.t3 }}>在浏览器中操作，步骤将自动捕获</p>
              </div>
            </div>

            {/* Tips */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color:T.t3 }}>操作提示</p>
              {[
                "在已打开的浏览器窗口中正常操作",
                "每次点击、输入都会自动生成步骤",
                "录制完成后点击「停止」进行步骤确认",
                "若有重复步骤，确认页可删除或合并",
              ].map((t,i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5" style={{ backgroundColor:`${T.cyan}20`, color:T.cyan }}>{i+1}</span>
                  <p className="text-[12px]" style={{ color:T.t2 }}>{t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Record Confirm Page ──────────────────────────────────────────────────────

function RecordConfirmPage({ steps: initSteps, config, onSave, onBack }:{
  steps: UIStep[];
  config: RecordCfg;
  onSave: (c: UICase) => void;
  onBack: () => void;
}) {
  const [steps, setSteps] = useState<UIStep[]>(initSteps);
  const [selStep, setSelStep] = useState<UIStep|null>(steps[0] ?? null);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [caseName, setCaseName] = useState(config.name);

  const toggleEnabled = (id:string) => setSteps(ss => ss.map(s => s.id===id?{...s,enabled:!s.enabled}:s));
  const deleteStep    = (id:string) => setSteps(ss => ss.filter(s => s.id!==id).map((s,i)=>({...s,order:i+1})));
  const moveStep      = (id:string, dir:-1|1) => setSteps(ss => {
    const idx = ss.findIndex(s=>s.id===id);
    if (idx+dir<0||idx+dir>=ss.length) return ss;
    const a=[...ss];[a[idx],a[idx+dir]]=[a[idx+dir],a[idx]];
    return a.map((s,i)=>({...s,order:i+1}));
  });

  const aiSuggestions = [
    { id:"a1", type:"rename",    target:"r2, r4", msg:"「点击输入框」步骤可以省略，Playwright 输入前无需显式聚焦", action:"移除步骤 2 和 4" },
    { id:"a2", type:"assert",    target:"r6 后",  msg:"建议在登录后添加断言：URL 包含 /dashboard，明确验证登录结果",  action:"插入断言步骤" },
    { id:"a3", type:"rename",    target:"r3",     msg:"步骤 3 名称「输入文本」建议改为「输入用户名」，语义更清晰",   action:"采纳改名" },
  ];

  const typeStyle:Record<string,{c:string;bg:string;l:string}> = {
    rename: {c:"#7816FF",bg:"#F5E8FF",l:"优化名称"},
    assert: {c:T.cyan,   bg:"#E8FFFB",l:"推荐断言"},
  };

  const doneCase: UICase = {
    id:"UC-NEW-001", name:caseName, directory:config.directory,
    status:"draft", priority:"P1", lastRunResult:null,
    lastRunAt:"—", creator:"张程远", browser:config.browser.split(" ")[0],
    tags:["录制生成"],
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0 bg-white" style={{ borderBottom:`1px solid ${T.border}` }}>
        <button onClick={onBack} className="flex items-center gap-1 text-[12px] transition-colors" style={{ color:T.t3 }} onMouseEnter={e=>e.currentTarget.style.color=T.cyan} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
          <ChevronLeft size={13}/> 录制工作台
        </button>
        <ChevronRight size={12} style={{ color:T.t4 }}/>
        <span className="text-[13px] font-medium" style={{ color:T.t1 }}>步骤确认</span>
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ backgroundColor:"#E8FFEA", color:T.success }}>录制完成</span>
        <span className="text-[12px]" style={{ color:T.t3 }}>{steps.length} 个步骤</span>
        <div className="flex-1"/>
        <PBtn icon={Layers} onClick={()=>{}} variant="ghost">追加到已有用例</PBtn>
        <PBtn icon={Save} onClick={()=>onSave(doneCase)} color={T.cyan}>保存为新用例</PBtn>
      </div>

      {/* Case name bar */}
      <div className="flex items-center gap-3 px-5 py-2 flex-shrink-0" style={{ backgroundColor:"#FAFAFA", borderBottom:`1px solid ${T.border}` }}>
        <span className="text-[12px] font-medium flex-shrink-0" style={{ color:T.t2 }}>用例名称</span>
        <input value={caseName} onChange={e=>setCaseName(e.target.value)}
          className="h-7 px-3 border rounded-lg text-[13px] font-medium outline-none transition-all"
          style={{ borderColor:T.border, color:T.t1, width:320 }}
          onFocus={e=>{e.currentTarget.style.borderColor=T.cyan;}}
          onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
        <span className="text-[12px]" style={{ color:T.t3 }}>目录：{config.directory} · 环境：{config.env} · 浏览器：{config.browser.split(" ")[0]}</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden" style={{ backgroundColor:T.bg }}>
        {/* Left step list */}
        <div className="flex-shrink-0 flex flex-col bg-white overflow-hidden" style={{ width:340, borderRight:`1px solid ${T.border}` }}>
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ borderBottom:`1px solid ${T.border}` }}>
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color:T.t3 }}>步骤列表 ({steps.length})</span>
            <button className="flex items-center gap-1 text-[11px] text-[12px] h-6 px-2 rounded-lg border transition-colors" style={{ borderColor:T.border, color:T.t3 }}><Plus size={10}/>添加步骤</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {steps.map((step, i) => {
              const sc = STEP_CFG[step.type];
              const isSel = selStep?.id === step.id;
              const isAiStep = step.id === "r9";
              return (
                <div key={step.id}
                  className="group flex items-center gap-2 px-3 py-2.5 border-b cursor-pointer transition-all"
                  style={{ borderColor:T.border, borderLeft:`3px solid ${isSel?sc.color:"transparent"}`, backgroundColor:isSel?`${sc.color}06`:"transparent" }}
                  onClick={()=>setSelStep(step)}
                  onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.backgroundColor="#FAFBFF"; }}
                  onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.backgroundColor="transparent"; }}>
                  <Toggle on={step.enabled} onChange={()=>toggleEnabled(step.id)}/>
                  <span className="w-4 text-[10px] font-mono text-right flex-shrink-0" style={{ color:T.t4 }}>{step.order}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <StepBadge type={step.type}/>
                      {isAiStep && <span className="text-[9px] font-bold px-1 py-px rounded" style={{ backgroundColor:`${T.cyan}20`, color:T.cyan }}>AI</span>}
                    </div>
                    <p className="text-[12px] mt-0.5 truncate" style={{ color:step.enabled?T.t1:T.t3, fontWeight:isSel?500:400, opacity:step.enabled?1:0.5 }}>{step.description}</p>
                  </div>
                  <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>moveStep(step.id,-1)} disabled={i===0} className="w-5 h-5 flex items-center justify-center rounded" style={{ color:T.t4 }}><ArrowUp size={11}/></button>
                    <button onClick={()=>moveStep(step.id,1)} disabled={i===steps.length-1} className="w-5 h-5 flex items-center justify-center rounded" style={{ color:T.t4 }}><ArrowDown size={11}/></button>
                    <button onClick={()=>deleteStep(step.id)} className="w-5 h-5 flex items-center justify-center rounded transition-colors" style={{ color:T.t4 }} onMouseEnter={e=>e.currentTarget.style.color=T.danger} onMouseLeave={e=>e.currentTarget.style.color=T.t4}><Trash2 size={11}/></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: step edit + AI panel */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* AI suggestions */}
          {showAiPanel && (
            <div className="bg-white rounded-xl overflow-hidden" style={{ border:`1px solid ${T.cyan}50` }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor:`${T.cyan}0D`, borderBottom:`1px solid ${T.cyan}30` }}>
                <Sparkles size={13} style={{ color:T.cyan }}/>
                <span className="text-[12px] font-semibold flex-1" style={{ color:T.t1 }}>AI 优化建议 · {aiSuggestions.length} 条</span>
                <button onClick={()=>setShowAiPanel(false)} className="text-[11px] px-2 py-0.5 rounded" style={{ color:T.t3 }}>忽略全部</button>
              </div>
              <div className="divide-y" style={{ borderColor:T.border }}>
                {aiSuggestions.map(s => {
                  const ts = typeStyle[s.type] ?? {c:T.t2,bg:"#F2F3F5",l:"建议"};
                  return (
                    <div key={s.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 mt-0.5" style={{ backgroundColor:ts.bg, color:ts.c }}>{ts.l}</span>
                      <div className="flex-1">
                        <p className="text-[12px]" style={{ color:T.t1 }}>
                          <code className="px-1 py-px rounded text-[10px] mr-1" style={{ backgroundColor:"#F2F3F5", color:T.t2 }}>{s.target}</code>
                          {s.msg}
                        </p>
                      </div>
                      <button className="flex-shrink-0 h-6 px-2.5 rounded text-[11px] font-medium transition-colors" style={{ backgroundColor:`${T.cyan}15`, color:T.cyan }} onMouseEnter={e=>e.currentTarget.style.backgroundColor=`${T.cyan}25`} onMouseLeave={e=>e.currentTarget.style.backgroundColor=`${T.cyan}15`}>{s.action}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected step editor */}
          {selStep && (
            <div className="bg-white rounded-xl p-5" style={{ border:`1px solid ${T.border}` }}>
              <div className="flex items-center gap-2 mb-4">
                <StepBadge type={selStep.type}/>
                <span className="text-[13px] font-semibold" style={{ color:T.t1 }}>步骤 {selStep.order} 编辑</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color:T.t3 }}>步骤名称</label>
                  <input defaultValue={selStep.description} className="w-full h-9 px-3 border rounded-lg text-[13px] outline-none transition-all" style={{ borderColor:T.border, color:T.t1 }}
                    onFocus={e=>{e.currentTarget.style.borderColor=T.cyan;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
                </div>
                {selStep.element !== undefined && (
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color:T.t3 }}>目标元素</label>
                    <div className="flex gap-2">
                      <input defaultValue={selStep.element} className="flex-1 h-9 px-3 border rounded-lg text-[13px] outline-none transition-all" style={{ borderColor:T.border, color:T.t1 }}
                        onFocus={e=>{e.currentTarget.style.borderColor=T.cyan;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
                      <button className="flex-shrink-0 h-9 px-3 rounded-lg border text-[12px] transition-colors" style={{ borderColor:T.border, color:T.t2 }} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#F4F6FA"} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>从元素库选择</button>
                    </div>
                  </div>
                )}
                {selStep.type === "navigate" && (
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color:T.t3 }}>目标 URL</label>
                    <input defaultValue={selStep.value} className="w-full h-9 px-3 border rounded-lg text-[12px] font-mono outline-none transition-all" style={{ borderColor:T.border, color:T.t1 }}
                      onFocus={e=>{e.currentTarget.style.borderColor=T.cyan;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
                  </div>
                )}
                {selStep.type === "assert" && (
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color:T.t3 }}>断言规则</label>
                    <div className="flex gap-2">
                      <select className="h-9 px-2 border rounded-lg text-[12px] outline-none bg-white" style={{ borderColor:T.border, color:T.t1, width:110 }}>
                        <option>包含</option><option>等于</option><option>存在</option><option>不存在</option>
                      </select>
                      <input defaultValue={selStep.value?.split("：")[1] ?? ""} className="flex-1 h-9 px-3 border rounded-lg text-[13px] outline-none transition-all" style={{ borderColor:T.border, color:T.t1 }}
                        onFocus={e=>{e.currentTarget.style.borderColor=T.cyan;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
                    </div>
                  </div>
                )}
                {(selStep.type === "input" || selStep.type === "wait") && (
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color:T.t3 }}>{selStep.type==="input"?"输入值":"等待时长 (ms)"}</label>
                    <input defaultValue={selStep.value} className="w-full h-9 px-3 border rounded-lg text-[13px] font-mono outline-none transition-all" style={{ borderColor:T.border, color:T.t1 }}
                      onFocus={e=>{e.currentTarget.style.borderColor=T.cyan;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <PBtn onClick={onUnsavedClose??(() =>deleteStep(selStep.id))} icon={Trash2} color={T.danger} variant="ghost">删除步骤</PBtn>
                  <PBtn onClick={()=>{}} icon={Check} color={T.cyan} small>确认修改</PBtn>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Element Library ──────────────────────────────────────────────────────────

function UIElementLibrary({onAICapture,onDeleteElement,onAddElement,onEditElement,onVerifyElement,onViewElement}:{onAICapture:()=>void;onDeleteElement?:()=>void;onAddElement?:()=>void;onEditElement?:()=>void;onVerifyElement?:()=>void;onViewElement?:()=>void}) {
  const[elements]=useState<UIElement[]>(UI_ELEMENTS);
  const[selPage,setSelPage]=useState("root");
  const pages=[{id:"root",label:"全部元素",count:elements.length},{id:"login",label:"登录页",count:3},{id:"home",label:"首页",count:2},{id:"product",label:"商品详情页",count:1},{id:"cart",label:"购物车页面",count:1}];
  return(
    <div className="flex flex-1 overflow-hidden">
      {/* Tree */}
      <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:220,backgroundColor:"#fff",borderRight:`1px solid ${T.border}`}}>
        <div className="px-3 pt-3 pb-2"><PBtn icon={Sparkles} onClick={onAICapture} small color={T.cyan}>AI 采集元素</PBtn></div>
        <div className="px-3 pb-2"><Inp placeholder="搜索页面" prefix={<Search size={12}/>} width="100%"/></div>
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {pages.map(p=>(
            <button key={p.id} onClick={()=>setSelPage(p.id)} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-[12px] transition-colors text-left" style={{backgroundColor:selPage===p.id?`${T.cyan}12`:"transparent",color:selPage===p.id?T.cyan:T.t2}} onMouseEnter={e=>selPage!==p.id&&(e.currentTarget.style.backgroundColor="#F4F6FA")} onMouseLeave={e=>selPage!==p.id&&(e.currentTarget.style.backgroundColor="transparent")}>
              <Monitor size={12} style={{color:selPage===p.id?T.cyan:T.t4,flexShrink:0}}/>{p.label}<span className="ml-auto text-[10px]" style={{color:T.t4}}>{p.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Element table */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-2.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
          <Inp placeholder="搜索元素名称或定位值" prefix={<Search size={13}/>} width={220}/>
          <Sel width={120}><option>全部定位方式</option><option>id</option><option>css</option><option>xpath</option><option>text</option><option>role</option></Sel>
          <Sel width={110}><option>全部验证状态</option><option>已通过</option><option>已失败</option><option>未验证</option></Sel>
          <div className="flex-1"/>
          <PBtn icon={Plus} onClick={onAddElement} variant="ghost">手动添加</PBtn>
          <PBtn icon={Sparkles} onClick={onAICapture} color={T.cyan}>AI 采集</PBtn>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ETable total={elements.length} cols={[
            {label:"元素名称",width:"18%"},{label:"所属页面",width:"10%"},{label:"分组",width:"9%"},
            {label:"定位方式",width:"8%"},{label:"定位值",width:"22%"},{label:"引用次数",width:"8%"},
            {label:"最近验证",width:"9%"},{label:"操作",width:"16%",align:"right"},
          ]}>
            {elements.map(el=>(
              <TR key={el.id}>
                <TD>
                  <p className="font-medium cursor-pointer" style={{color:T.primary}} onClick={onViewElement}>{el.name}</p>
                  <p className="text-[11px] mt-0.5" style={{color:T.t3}}>{el.description}</p>
                </TD>
                <TD muted>{el.page}</TD>
                <TD muted>{el.group}</TD>
                <TD><code className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{backgroundColor:"#EEF0FA",color:"#4E5AC8"}}>{el.locatorType}</code></TD>
                <TD mono muted><span className="block truncate max-w-[180px]">{el.locatorValue}</span></TD>
                <TD align="center">
                  <button onClick={onViewElement} style={{background:"none",border:"none",cursor:"pointer",color:el.refCount>10?T.cyan:T.t2,fontWeight:el.refCount>10?600:400,fontSize:13}}>{el.refCount}</button>
                </TD>
                <TD>
                  {el.lastVerified ? <StatusDot status={el.lastVerified} label={el.lastVerified==="pass"?"验证通过":"验证失败"}/> : <span className="text-[12px]" style={{color:T.t4}}>未验证</span>}
                </TD>
                <TD align="right">
                  <div className="flex items-center justify-end">
                    <IBtn icon={CheckCircle} label="验证元素" onClick={onVerifyElement}/>
                    <IBtn icon={Eye} label="查看详情" onClick={onViewElement}/>
                    <IBtn icon={Edit2} label="编辑" onClick={onEditElement}/>
                    <IBtn icon={Trash2} label="删除" danger onClick={onDeleteElement}/>
                  </div>
                </TD>
              </TR>
            ))}
          </ETable>
        </div>
      </div>
    </div>
  );
}

// ─── AI Capture Page (full-page, replaces drawer) ────────────────────────────

const AI_ELS_FULL: AIEl[] = [
  {id:"ai-1",name:"登录按钮",elType:"button",purpose:"触发用户登录操作，提交表单数据",locatorType:"role",locatorValue:"button[name='登录']",confidence:97,adoptStatus:"pending",page:"登录页"},
  {id:"ai-2",name:"用户名输入框",elType:"input",purpose:"接收用户输入的账号或手机号",locatorType:"id",locatorValue:"#username",confidence:95,adoptStatus:"pending",page:"登录页"},
  {id:"ai-3",name:"密码输入框",elType:"input",purpose:"接收用户输入的登录密码",locatorType:"id",locatorValue:"#password",confidence:95,adoptStatus:"adopted",page:"登录页"},
  {id:"ai-4",name:"忘记密码链接",elType:"link",purpose:"跳转到密码重置流程的入口链接",locatorType:"text",locatorValue:"忘记密码",confidence:88,adoptStatus:"pending",page:"登录页"},
  {id:"ai-5",name:"第三方登录-微信",elType:"button",purpose:"使用微信账号授权登录",locatorType:"css",locatorValue:".login-wechat-btn",confidence:82,adoptStatus:"ignored",page:"登录页"},
  {id:"ai-6",name:"登录错误提示",elType:"text",purpose:"显示登录失败或参数错误信息",locatorType:"css",locatorValue:".error-msg",confidence:91,adoptStatus:"pending",page:"登录页"},
  {id:"ai-7",name:"搜索输入框",elType:"input",purpose:"商品关键词搜索入口",locatorType:"placeholder",locatorValue:"请输入商品名称、品牌",confidence:96,adoptStatus:"pending",page:"商品列表页"},
  {id:"ai-8",name:"搜索提交按钮",elType:"button",purpose:"触发商品搜索请求",locatorType:"css",locatorValue:".search-submit-btn",confidence:93,adoptStatus:"pending",page:"商品列表页"},
  {id:"ai-9",name:"加入购物车按钮",elType:"button",purpose:"将选中商品加入购物车",locatorType:"xpath",locatorValue:"//button[contains(@class,'add-cart')]",confidence:89,adoptStatus:"pending",page:"商品列表页"},
  {id:"ai-10",name:"价格区间-最低价",elType:"input",purpose:"商品价格筛选区间最低值",locatorType:"css",locatorValue:"input.price-min",confidence:85,adoptStatus:"pending",page:"商品列表页"},
  {id:"ai-11",name:"价格区间-最高价",elType:"input",purpose:"商品价格筛选区间最高值",locatorType:"css",locatorValue:"input.price-max",confidence:85,adoptStatus:"pending",page:"商品列表页"},
  {id:"ai-12",name:"分类筛选-下拉框",elType:"select",purpose:"按商品分类筛选列表结果",locatorType:"role",locatorValue:"combobox[name='商品分类']",confidence:79,adoptStatus:"pending",page:"商品列表页"},
  {id:"ai-13",name:"结算按钮",elType:"button",purpose:"跳转到订单确认页完成结算",locatorType:"role",locatorValue:"button[name='去结算']",confidence:98,adoptStatus:"pending",page:"购物车页"},
  {id:"ai-14",name:"全选复选框",elType:"checkbox",purpose:"一键选中购物车内所有商品",locatorType:"css",locatorValue:"input.select-all-checkbox",confidence:94,adoptStatus:"pending",page:"购物车页"},
  {id:"ai-15",name:"商品数量+号",elType:"button",purpose:"增加购物车内对应商品数量",locatorType:"xpath",locatorValue:"//button[@data-action='quantity-increase']",confidence:90,adoptStatus:"pending",page:"购物车页"},
  {id:"ai-16",name:"删除商品按钮",elType:"button",purpose:"从购物车中移除选中商品",locatorType:"css",locatorValue:".cart-delete-btn",confidence:87,adoptStatus:"ignored",page:"购物车页"},
  {id:"ai-17",name:"收货地址-下拉",elType:"select",purpose:"选择已保存收货地址",locatorType:"role",locatorValue:"combobox[name='收货地址']",confidence:92,adoptStatus:"pending",page:"订单确认页"},
  {id:"ai-18",name:"支付方式-微信",elType:"radio",purpose:"选择微信支付方式",locatorType:"css",locatorValue:"input[value='wechat']",confidence:96,adoptStatus:"pending",page:"订单确认页"},
  {id:"ai-19",name:"提交订单按钮",elType:"button",purpose:"最终提交订单并发起支付",locatorType:"role",locatorValue:"button[name='提交订单']",confidence:99,adoptStatus:"pending",page:"订单确认页"},
  {id:"ai-20",name:"优惠券输入框",elType:"input",purpose:"手动输入优惠码兑换折扣",locatorType:"placeholder",locatorValue:"输入优惠码",confidence:83,adoptStatus:"pending",page:"订单确认页"},
];

function AiCapturePage({onBack}:{onBack:()=>void}){
  const[url,setUrl]=useState("https://test.example.com/login");
  const[scope,setScope]=useState("全页可操作元素");
  const[scanning,setScanning]=useState(false);
  const[scanStep,setScanStep]=useState(0);
  const[done,setDone]=useState(false);
  const[elements,setElements]=useState<AIEl[]>([]);
  const[filterStatus,setFilterStatus]=useState<"all"|"pending"|"adopted"|"ignored">("all");
  const[filterType,setFilterType]=useState("全部类型");
  const[filterConf,setFilterConf]=useState("全部置信度");

  const scanSteps=["连接目标页面","解析 DOM 树","AI 识别元素","生成定位策略","完成"];

  const startScan=()=>{
    setScanning(true);setDone(false);setScanStep(0);setElements([]);
    const t1=setTimeout(()=>setScanStep(1),800);
    const t2=setTimeout(()=>setScanStep(2),1800);
    const t3=setTimeout(()=>setScanStep(3),3000);
    const t4=setTimeout(()=>setScanStep(4),4000);
    const t5=setTimeout(()=>{setScanning(false);setDone(true);setElements(AI_ELS_FULL.map(e=>({...e,adoptStatus:"pending" as const})));},4200);
    return ()=>[t1,t2,t3,t4,t5].forEach(clearTimeout);
  };

  const adopt=(id:string,s:"adopted"|"ignored"|"pending")=>setElements(els=>els.map(e=>e.id===id?{...e,adoptStatus:s}:e));
  const adoptAll=()=>setElements(els=>els.map(e=>e.adoptStatus==="pending"?{...e,adoptStatus:"adopted"}:e));

  const filtered=elements.filter(e=>{
    if(filterStatus!=="all"&&e.adoptStatus!==filterStatus)return false;
    if(filterType!=="全部类型"&&e.elType!==filterType)return false;
    if(filterConf==="高 (≥90%)"&&e.confidence<90)return false;
    if(filterConf==="中 (80-89%)"&&(e.confidence<80||e.confidence>=90))return false;
    if(filterConf==="低 (<80%)"&&e.confidence>=80)return false;
    return true;
  });

  const pages=[...new Set(filtered.map(e=>e.page))];
  const adoptedCount=elements.filter(e=>e.adoptStatus==="adopted").length;
  const pendingCount=elements.filter(e=>e.adoptStatus==="pending").length;
  const ignoredCount=elements.filter(e=>e.adoptStatus==="ignored").length;
  const elTypes=[...new Set(elements.map(e=>e.elType))];

  return(
    <div className="flex-1 flex flex-col overflow-hidden" style={{backgroundColor:"#F7F8FC"}}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 flex-shrink-0" style={{height:48,backgroundColor:"#fff",borderBottom:`1px solid ${T.border}`}}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{color:T.t2}} onMouseEnter={e=>e.currentTarget.style.color=T.cyan} onMouseLeave={e=>e.currentTarget.style.color=T.t2}>
          <ChevronLeft size={15}/>返回元素库
        </button>
        <div className="w-px h-4 flex-shrink-0" style={{backgroundColor:T.border}}/>
        <IcoSquare color={T.cyan} bg="#E8FFFB" size={28}><Sparkles size={14}/></IcoSquare>
        <p className="text-[15px] font-semibold" style={{color:T.t1}}>AI 元素采集</p>
        {done&&<span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium" style={{backgroundColor:"#E8FFFB",color:T.cyan}}>
          采集完成 · {elements.length} 个候选元素
        </span>}
        <div className="flex-1"/>
        {done&&adoptedCount>0&&(
          <button onClick={onBack}
            className="h-8 px-5 rounded-xl text-[13px] font-semibold text-white flex items-center gap-1.5"
            style={{background:`linear-gradient(135deg,${T.cyan},${T.primary})`}}>
            <Check size={13}/>确认入库 ({adoptedCount})
          </button>
        )}
      </div>

      {/* Main two-pane layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left config pane */}
        <div className="flex-shrink-0 flex flex-col overflow-y-auto" style={{width:300,backgroundColor:"#fff",borderRight:`1px solid ${T.border}`}}>
          <div className="p-4 space-y-4">
            {/* URL */}
            <div>
              <label className="text-[12px] font-semibold block mb-1.5" style={{color:T.t2}}>目标页面地址</label>
              <input value={url} onChange={e=>setUrl(e.target.value)}
                className="w-full h-9 px-3 border rounded-xl text-[12px] font-mono outline-none"
                style={{borderColor:T.border,color:T.t1}}/>
              <p className="text-[11px] mt-1" style={{color:T.t3}}>确保测试环境 / Runner 可访问该地址</p>
            </div>
            {/* Scope */}
            <div>
              <label className="text-[12px] font-semibold block mb-2" style={{color:T.t2}}>采集范围</label>
              <div className="space-y-1">
                {["全页可操作元素","仅表单元素","按钮与链接"].map(s=>(
                  <label key={s} className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-colors"
                    style={{backgroundColor:scope===s?"#E8FFFB":"transparent"}}>
                    <input type="radio" checked={scope===s} onChange={()=>setScope(s)} className="accent-cyan-500 flex-shrink-0"/>
                    <span className="text-[12px]" style={{color:scope===s?T.cyan:T.t2}}>{s}</span>
                  </label>
                ))}
              </div>
            </div>
            {/* Advanced */}
            <div style={{borderTop:`1px solid ${T.border}`,paddingTop:16}}>
              <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>高级选项</p>
              {[{l:"包含 iframe 内元素",type:"toggle"},{l:"等待动态渲染 (ms)",type:"number",v:"2000"},{l:"最大采集元素数",type:"number",v:"50"}].map(o=>(
                <div key={o.l} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${T.border}`}}>
                  <span className="text-[12px]" style={{color:T.t1}}>{o.l}</span>
                  {o.type==="toggle"
                    ? <Toggle on={false} onChange={()=>{}}/>
                    : <input type="number" defaultValue={o.v} className="h-6 w-20 px-2 border rounded text-[12px] text-right outline-none" style={{borderColor:T.border}}/>
                  }
                </div>
              ))}
            </div>
            {/* Start button */}
            <button onClick={startScan} disabled={scanning}
              className="w-full h-10 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-all"
              style={{background:scanning?"#C9CDD4":`linear-gradient(135deg,${T.cyan},${T.primary})`}}>
              {scanning?<><RefreshCw size={14} className="animate-spin"/>AI 采集中...</>:<><Sparkles size={14}/>开始 AI 采集</>}
            </button>
            {/* Progress */}
            {(scanning||done)&&(
              <div className="rounded-xl border p-4" style={{borderColor:T.border,backgroundColor:"#FAFBFE"}}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-semibold" style={{color:T.t2}}>采集进度</span>
                  <span className="text-[11px]" style={{color:T.t3}}>{done?"✓ 已完成":scanSteps[Math.min(scanStep,4)]}</span>
                </div>
                <div className="space-y-2.5">
                  {scanSteps.map((s,i)=>(
                    <div key={s} className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{backgroundColor:done||i<scanStep?T.cyan:i===scanStep&&scanning?"#FFF3E8":"#F2F3F5"}}>
                        {(done||i<scanStep)
                          ? <Check size={10} color="#fff"/>
                          : i===scanStep&&scanning
                            ? <RefreshCw size={10} style={{color:T.warning}} className="animate-spin"/>
                            : <span className="text-[9px]" style={{color:T.t4}}>{i+1}</span>
                        }
                      </div>
                      <span className="text-[12px]" style={{color:(done||i<=scanStep)?T.t1:T.t4}}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Stats after done */}
            {done&&(
              <div className="grid grid-cols-3 gap-2">
                {[
                  {l:"高置信度",n:elements.filter(e=>e.confidence>=90).length,c:T.success},
                  {l:"中置信度",n:elements.filter(e=>e.confidence>=80&&e.confidence<90).length,c:T.warning},
                  {l:"低置信度",n:elements.filter(e=>e.confidence<80).length,c:T.danger},
                ].map(s=>(
                  <div key={s.l} className="rounded-xl p-3 text-center" style={{backgroundColor:`${s.c}12`}}>
                    <p className="text-[20px] font-bold" style={{color:s.c}}>{s.n}</p>
                    <p className="text-[10px] mt-0.5" style={{color:s.c}}>{s.l}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right results pane */}
        {!done&&!scanning&&(
          <div className="flex-1 flex items-center justify-center flex-col gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{backgroundColor:"#F0FFFE"}}>
              <Sparkles size={32} style={{color:T.t4}}/>
            </div>
            <p className="text-[15px] font-semibold" style={{color:T.t2}}>配置目标地址后开始采集</p>
            <p className="text-[13px]" style={{color:T.t3}}>AI 将自动识别页面所有可操作元素，人工确认后一键入库</p>
          </div>
        )}
        {scanning&&!done&&(
          <div className="flex-1 flex items-center justify-center flex-col gap-4">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{background:`linear-gradient(135deg,${T.cyan},${T.primary})`}}>
              <Sparkles size={36} color="#fff" className="animate-pulse"/>
            </div>
            <p className="text-[16px] font-semibold" style={{color:T.t1}}>AI 正在分析页面结构...</p>
            <p className="text-[13px]" style={{color:T.t3}}>{scanSteps[Math.min(scanStep,scanSteps.length-1)]}</p>
          </div>
        )}
        {done&&(
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filter bar */}
            <div className="flex items-center gap-2.5 px-5 py-3 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`,backgroundColor:"#fff"}}>
              {/* Status filter tabs */}
              <div className="flex rounded-xl overflow-hidden border" style={{borderColor:T.border}}>
                {([["all","全部",elements.length],["pending","待确认",pendingCount],["adopted","已采纳",adoptedCount],["ignored","已忽略",ignoredCount]] as const).map(([k,l,c],i)=>(
                  <button key={k} onClick={()=>setFilterStatus(k)}
                    className="px-3 py-1.5 text-[12px] font-medium transition-colors"
                    style={{backgroundColor:filterStatus===k?"#E8FFFB":"#fff",color:filterStatus===k?T.cyan:T.t2,
                      borderLeft:i>0?`1px solid ${T.border}`:"none"}}>
                    {l}&nbsp;<span style={{opacity:.7}}>{c}</span>
                  </button>
                ))}
              </div>
              <select value={filterType} onChange={e=>setFilterType(e.target.value)}
                className="h-8 px-2.5 border rounded-lg text-[12px] outline-none bg-white" style={{borderColor:T.border,color:T.t2}}>
                <option>全部类型</option>
                {elTypes.map(t=><option key={t}>{t}</option>)}
              </select>
              <select value={filterConf} onChange={e=>setFilterConf(e.target.value)}
                className="h-8 px-2.5 border rounded-lg text-[12px] outline-none bg-white" style={{borderColor:T.border,color:T.t2}}>
                <option>全部置信度</option>
                <option>高 (≥90%)</option>
                <option>中 (80-89%)</option>
                <option>低 (&lt;80%)</option>
              </select>
              <div className="flex-1"/>
              <span className="text-[12px]" style={{color:T.t3}}>共 <strong style={{color:T.t1}}>{filtered.length}</strong> 个</span>
              <button onClick={adoptAll} className="h-8 px-4 rounded-xl text-[12px] font-medium transition-colors"
                style={{backgroundColor:`${T.cyan}15`,color:T.cyan}}>全部采纳</button>
            </div>
            {/* Element cards grouped by page */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {pages.map(page=>{
                const pageEls=filtered.filter(e=>e.page===page);
                if(pageEls.length===0)return null;
                return(
                  <div key={page} className="mb-7">
                    <div className="flex items-center gap-2 mb-3">
                      <Monitor size={14} style={{color:T.cyan,flexShrink:0}}/>
                      <span className="text-[13px] font-semibold" style={{color:T.t1}}>{page}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{backgroundColor:"#E8FFFB",color:T.cyan}}>{pageEls.length} 个元素</span>
                    </div>
                    <div className="space-y-2.5">
                      {pageEls.map(el=>(
                        <div key={el.id}
                          className="rounded-2xl border bg-white transition-all"
                          style={{borderColor:el.adoptStatus==="adopted"?T.cyan:T.border,
                            borderWidth:el.adoptStatus==="adopted"?1.5:1,
                            opacity:el.adoptStatus==="ignored"?.45:1}}>
                          <div className="flex items-start gap-4 px-5 py-4">
                            {/* Confidence ring */}
                            <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                              <div className="w-12 h-12 rounded-full flex items-center justify-center"
                                style={{border:`3px solid ${el.confidence>=90?T.success:el.confidence>=80?T.warning:T.danger}`}}>
                                <span className="text-[12px] font-bold leading-none"
                                  style={{color:el.confidence>=90?T.success:el.confidence>=80?T.warning:T.danger}}>
                                  {el.confidence}%
                                </span>
                              </div>
                              <span className="text-[9px] mt-1" style={{color:T.t4}}>置信度</span>
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[14px] font-semibold" style={{color:T.t1}}>{el.name}</span>
                                <span className="px-1.5 py-px rounded text-[10px] font-medium" style={{backgroundColor:"#F2F3F5",color:T.t2}}>{el.elType}</span>
                                {el.adoptStatus==="adopted"&&<span className="px-1.5 py-px rounded text-[10px] font-medium" style={{backgroundColor:"#E8FFFB",color:T.cyan}}>已采纳</span>}
                              </div>
                              <p className="text-[12px] mb-2.5" style={{color:T.t3}}>{el.purpose}</p>
                              <div className="flex items-center gap-2">
                                <code className="px-2 py-0.5 rounded text-[10px] font-bold" style={{backgroundColor:"#EEF0FA",color:"#4E5AC8"}}>{el.locatorType}</code>
                                <code className="text-[12px] font-mono" style={{color:T.t2}}>{el.locatorValue}</code>
                              </div>
                            </div>
                            {/* Actions */}
                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pt-0.5">
                              {el.adoptStatus==="pending"&&(
                                <>
                                  <button onClick={()=>adopt(el.id,"adopted")}
                                    className="h-7 px-4 rounded-lg text-[12px] font-medium text-white"
                                    style={{backgroundColor:T.cyan}}>采纳</button>
                                  <button className="h-7 px-3 rounded-lg border text-[12px]" style={{borderColor:T.border,color:T.t2}}>编辑</button>
                                  <button onClick={()=>adopt(el.id,"ignored")}
                                    className="h-7 px-3 text-[12px]" style={{color:T.t3}}>忽略</button>
                                </>
                              )}
                              {el.adoptStatus==="adopted"&&(
                                <div className="flex flex-col items-end gap-1.5">
                                  <div className="flex items-center gap-1" style={{color:T.cyan}}>
                                    <CheckCircle size={13}/>
                                    <span className="text-[12px] font-medium">已采纳</span>
                                  </div>
                                  <button onClick={()=>adopt(el.id,"pending")} className="text-[11px]" style={{color:T.t3}}>撤销</button>
                                </div>
                              )}
                              {el.adoptStatus==="ignored"&&(
                                <button onClick={()=>adopt(el.id,"pending")} className="h-7 px-3 rounded-lg text-[12px]" style={{color:T.primary}}>恢复</button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filtered.length===0&&(
                <div className="flex flex-col items-center justify-center py-20" style={{color:T.t3}}>
                  <Filter size={32} style={{color:T.t4,marginBottom:12}}/>
                  <p className="text-[13px]">当前筛选条件下无匹配元素</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI Element Capture Drawer (legacy — kept for reference) ─────────────────

function AICaptureDrawer({onClose}:{onClose:()=>void}) {
  const[url,setUrl]=useState("https://test.example.com/login");
  const[scanning,setScanning]=useState(false);
  const[scanStep,setScanStep]=useState(0);
  const[done,setDone]=useState(false);
  const[aiEls,setAiEls]=useState<AIEl[]>(AI_ELEMENTS);

  const startScan=()=>{
    setScanning(true);setDone(false);setScanStep(0);
    const t1=setTimeout(()=>setScanStep(1),700);
    const t2=setTimeout(()=>setScanStep(2),1600);
    const t3=setTimeout(()=>setScanStep(3),2800);
    const t4=setTimeout(()=>{setScanStep(4);setScanning(false);setDone(true);},3800);
    return ()=>{[t1,t2,t3,t4].forEach(clearTimeout);};
  };

  const adopt=(id:string,status:"adopted"|"ignored")=>setAiEls(els=>els.map(e=>e.id===id?{...e,adoptStatus:status}:e));

  const scanSteps=["页面加载中","分析 DOM 结构","AI 识别元素","完成"];

  return(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0" style={{backgroundColor:"rgba(29,33,41,0.4)"}} onClick={onClose}/>
      <div className="relative flex flex-col overflow-hidden" style={{width:600,backgroundColor:"#fff",boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div className="flex items-center gap-2.5">
            <IcoSquare color={T.cyan} bg="#E8FFFB" size={36}><Sparkles size={18}/></IcoSquare>
            <div>
              <p className="text-[14px] font-semibold" style={{color:T.t1}}>AI 元素采集</p>
              <p className="text-[12px] mt-0.5" style={{color:T.t3}}>AI 自动识别页面可操作元素，辅助人工确认后入库</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[18px]" style={{color:T.t4}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>×</button>
        </div>

        {/* Config area */}
        <div className="px-6 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}>页面地址</label>
              <input value={url} onChange={e=>setUrl(e.target.value)} className="w-full h-9 px-3 border rounded-lg text-[13px] font-mono outline-none" style={{borderColor:T.border,color:T.t1}}/>
            </div>
            <div>
              <label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}>采集范围</label>
              <select className="h-9 px-2.5 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:130}}><option>全页可操作元素</option><option>表单元素</option><option>按钮链接</option></select>
            </div>
          </div>
          <button onClick={startScan} disabled={scanning}
            className="w-full h-9 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2"
            style={{background:scanning?"#C9CDD4":`linear-gradient(135deg,${T.cyan},${T.primary})`}}>
            {scanning?<><RefreshCw size={14} className="animate-spin"/>采集中...</>:<><Sparkles size={14}/>开始 AI 采集</>}
          </button>

          {/* Progress */}
          {(scanning||done)&&(
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px]" style={{color:T.t2}}>采集进度</span>
                <span className="text-[12px]" style={{color:T.t3}}>{scanStep}/{scanSteps.length}</span>
              </div>
              <div className="flex items-center gap-2">
                {scanSteps.map((s,i)=>(
                  <div key={s} className="flex items-center gap-1 flex-1">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{backgroundColor:i<scanStep?T.cyan:i===scanStep&&scanning?"#FFF3E8":"#F2F3F5"}}>
                      {i<scanStep?<Check size={11} color="#fff"/>:i===scanStep&&scanning?<RefreshCw size={10} style={{color:T.warning}} className="animate-spin"/>:<span className="text-[9px]" style={{color:T.t4}}>{i+1}</span>}
                    </div>
                    <span className="text-[10px] truncate" style={{color:i<=scanStep?T.t2:T.t4}}>{s}</span>
                    {i<scanSteps.length-1&&<div className="flex-1 h-px" style={{backgroundColor:i<scanStep?T.cyan:T.border}}/>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {done&&(
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-3" style={{borderBottom:`1px solid ${T.border}`}}>
              <p className="text-[13px] font-semibold" style={{color:T.t1}}>采集结果 <span style={{color:T.t3}}>({aiEls.length} 个候选元素)</span></p>
              <div className="flex items-center gap-2">
                <button onClick={()=>setAiEls(els=>els.map(e=>({...e,adoptStatus:"adopted"})))} className="h-7 px-3 rounded-lg text-[12px] font-medium" style={{backgroundColor:`${T.cyan}12`,color:T.cyan}}>全部采纳</button>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              {aiEls.map(el=>(
                <div key={el.id} className="rounded-xl overflow-hidden transition-all" style={{border:`1.5px solid ${el.adoptStatus==="adopted"?T.cyan:el.adoptStatus==="ignored"?T.border:T.border}`,opacity:el.adoptStatus==="ignored"?0.45:1}}>
                  <div className="px-4 py-3 flex items-start gap-3">
                    {/* Confidence ring */}
                    <div className="flex-shrink-0 flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{border:`3px solid ${el.confidence>=90?T.success:el.confidence>=80?T.warning:T.danger}`,backgroundColor:"#fff"}}>
                        <span className="text-[11px] font-bold" style={{color:el.confidence>=90?T.success:el.confidence>=80?T.warning:T.danger}}>{el.confidence}%</span>
                      </div>
                      <span className="text-[9px] mt-0.5" style={{color:T.t4}}>置信度</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[13px] font-semibold" style={{color:T.t1}}>{el.name}</p>
                        <span className="px-1.5 py-px rounded text-[10px]" style={{backgroundColor:"#F2F3F5",color:T.t2}}>{el.elType}</span>
                        {el.adoptStatus==="adopted"&&<span className="px-1.5 py-px rounded text-[10px] font-medium" style={{backgroundColor:`${T.cyan}15`,color:T.cyan}}>已采纳</span>}
                      </div>
                      <p className="text-[12px] mb-1.5" style={{color:T.t3}}>{el.purpose}</p>
                      <div className="flex items-center gap-2">
                        <code className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{backgroundColor:"#EEF0FA",color:"#4E5AC8"}}>{el.locatorType}</code>
                        <code className="text-[11px] font-mono" style={{color:T.t2}}>{el.locatorValue}</code>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2.5" style={{borderTop:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
                    {el.adoptStatus==="pending"?(
                      <><button onClick={()=>adopt(el.id,"adopted")} className="flex-1 h-7 rounded-lg text-[12px] font-medium text-white" style={{backgroundColor:T.cyan}}>采纳入库</button>
                      <button className="h-7 px-3 rounded-lg border text-[12px] font-medium" style={{borderColor:T.border,color:T.t2}}>编辑后采纳</button>
                      <button onClick={()=>adopt(el.id,"ignored")} className="h-7 px-3 rounded-lg text-[12px]" style={{color:T.t3}}>忽略</button></>
                    ):el.adoptStatus==="adopted"?(
                      <div className="flex-1 flex items-center gap-2"><CheckCircle size={13} style={{color:T.cyan}}/><span className="text-[12px]" style={{color:T.cyan}}>已采纳到元素库</span><button onClick={()=>adopt(el.id,"pending")} className="ml-auto text-[11px]" style={{color:T.t3}}>撤销</button></div>
                    ):(
                      <div className="flex-1 flex items-center gap-2"><span className="text-[12px]" style={{color:T.t3}}>已忽略</span><button onClick={()=>adopt(el.id,"pending")} className="ml-auto text-[11px]" style={{color:T.primary}}>恢复</button></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!done&&!scanning&&(
          <div className="flex-1 flex items-center justify-center flex-col gap-3">
            <Sparkles size={36} style={{color:T.t4}}/>
            <p className="text-[13px]" style={{color:T.t3}}>输入页面地址后点击开始采集</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Run Records ──────────────────────────────────────────────────────────────

function UIRunList({onView}:{onView:(r:UIRun)=>void}) {
  const[runs]=useState<UIRun[]>(UI_RUNS);
  const stats=[{label:"全部执行",value:runs.length,color:T.t1},{label:"通过",value:runs.filter(r=>r.status==="pass").length,color:T.success},{label:"失败",value:runs.filter(r=>r.status==="fail").length,color:T.danger},{label:"运行中",value:runs.filter(r=>r.status==="running").length,color:T.cyan}];
  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-3 flex-shrink-0 bg-white" style={{borderBottom:`1px solid ${T.border}`}}>
        {stats.map((s,i)=><div key={s.label} className="flex items-center gap-2">{i>0&&<div className="w-px h-4" style={{backgroundColor:T.border}}/>}<span className="text-[22px] font-bold" style={{color:s.color}}>{s.value}</span><span className="text-[12px]" style={{color:T.t3}}>{s.label}</span></div>)}
        <div className="flex-1"/>
        <PBtn icon={Play} onClick={()=>{}} color={T.cyan}>批量执行</PBtn>
      </div>
      <div className="flex items-center gap-2 px-6 py-2.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
        <Inp placeholder="搜索用例名称" prefix={<Search size={13}/>} width={200}/>
        <Sel width={110}><option>全部状态</option><option>通过</option><option>失败</option><option>运行中</option></Sel>
        <Sel width={120}><option>全部环境</option><option>测试环境</option><option>预发布环境</option></Sel>
        <Sel width={120}><option>全部浏览器</option><option>Chrome</option><option>Firefox</option></Sel>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <ETable total={runs.length} cols={[
          {label:"状态",width:"8%"},{label:"用例名称",width:"24%"},{label:"执行环境",width:"11%"},
          {label:"浏览器",width:"10%"},{label:"开始时间",width:"15%"},{label:"耗时",width:"8%"},
          {label:"步骤",width:"9%"},{label:"操作",width:"15%",align:"right"},
        ]}>
          {runs.map(r=>{
            const passCount=r.steps.filter(s=>s.status==="pass").length;
            const failCount=r.steps.filter(s=>s.status==="fail").length;
            return(
              <TR key={r.id} onClick={()=>onView(r)}>
                <TD><UIRunBadge status={r.status}/></TD>
                <TD><span className="font-medium" style={{color:T.primary}}>{r.caseName}</span></TD>
                <TD muted>{r.env}</TD>
                <TD muted>{r.browser}</TD>
                <TD mono muted>{r.startedAt}</TD>
                <TD mono muted>{r.duration}</TD>
                <TD>
                  {r.steps.length>0?(
                    <span className="text-[12px]"><span style={{color:T.success}}>{passCount}✓</span>{failCount>0&&<> <span style={{color:T.danger}}>{failCount}✗</span></>}</span>
                  ):<span style={{color:T.t4,fontSize:12}}>—</span>}
                </TD>
                <TD align="right">
                  <div className="flex items-center justify-end">
                    <IBtn icon={Eye} label="查看详情" onClick={()=>onView(r)}/>
                    <IBtn icon={Play} label="重跑" onClick={()=>{}}/>
                    <IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/>
                  </div>
                </TD>
              </TR>
            );
          })}
        </ETable>
      </div>
    </div>
  );
}

// ─── Run Detail ───────────────────────────────────────────────────────────────

function UIRunDetail({run,onBack}:{run:UIRun;onBack:()=>void}) {
  const[selStep,setSelStep]=useState<UIRunStep|null>(run.steps[0]||null);
  const rc=UI_RUN_CFG[run.status];
  const passCount=run.steps.filter(s=>s.status==="pass").length;
  const failCount=run.steps.filter(s=>s.status==="fail").length;

  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0 bg-white" style={{borderBottom:`1px solid ${T.border}`}}>
        <button onClick={onBack} className="flex items-center gap-1 text-[13px] transition-colors" style={{color:T.t3}} onMouseEnter={e=>e.currentTarget.style.color=T.cyan} onMouseLeave={e=>e.currentTarget.style.color=T.t3}><ChevronLeft size={14}/>执行记录</button>
        <span style={{color:T.t4}}>|</span>
        <span className="text-[14px] font-semibold" style={{color:T.t1}}>{run.caseName}</span>
        <UIRunBadge status={run.status}/>
        <div className="flex-1"/>
        <PBtn icon={Play} onClick={()=>{}} variant="ghost">重跑</PBtn>
        <PBtn icon={Bug} onClick={()=>{}} color={T.danger} variant="ghost">关联缺陷</PBtn>
      </div>

      {/* Overview strip */}
      <div className="flex items-center gap-6 px-5 py-3 flex-shrink-0" style={{backgroundColor:"#fff",borderBottom:`1px solid ${T.border}`}}>
        {[{l:"执行环境",v:run.env},{l:"浏览器",v:run.browser},{l:"开始时间",v:run.startedAt},{l:"总耗时",v:run.duration},{l:"步骤通过",v:`${passCount}/${run.steps.length}`},{l:"步骤失败",v:String(failCount)}].map(f=>(
          <div key={f.l}>
            <p className="text-[10px]" style={{color:T.t3}}>{f.l}</p>
            <p className="text-[13px] font-semibold mt-0.5" style={{color:f.l==="步骤失败"&&failCount>0?T.danger:T.t1}}>{f.v}</p>
          </div>
        ))}
      </div>

      {/* Two-column: timeline + detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Step timeline */}
        <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:300,borderRight:`1px solid ${T.border}`,backgroundColor:"#fff"}}>
          <p className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide flex-shrink-0" style={{color:T.t3,borderBottom:`1px solid ${T.border}`}}>步骤时间线</p>
          <div className="flex-1 overflow-y-auto">
            {run.steps.map((step,i)=>{
              const sc=STEP_CFG[step.type];const Icon=sc.icon;
              const isSel=selStep?.id===step.id;
              const statusColor={pass:T.success,fail:T.danger,skip:T.t4}[step.status];
              return(
                <button key={step.id} onClick={()=>setSelStep(step)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b text-left transition-colors"
                  style={{borderColor:T.border,backgroundColor:isSel?`${sc.color}08`:"transparent",borderLeft:`3px solid ${isSel?sc.color:step.status==="fail"?T.danger:"transparent"}`}}>
                  {/* Status indicator */}
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{backgroundColor:step.status==="pass"?T.success:step.status==="fail"?T.danger:"#F2F3F5"}}>
                    {step.status==="pass"&&<Check size={12} color="#fff"/>}
                    {step.status==="fail"&&<X size={12} color="#fff"/>}
                    {step.status==="skip"&&<span className="text-[9px]" style={{color:T.t3}}>-</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <StepBadge type={step.type}/>
                      <span className="text-[11px] font-mono" style={{color:T.t3}}>{step.duration}</span>
                    </div>
                    <p className="text-[12px] mt-0.5 truncate" style={{color:isSel?T.t1:T.t2}}>{step.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selStep?(
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center gap-3 mb-4">
                <StepBadge type={selStep.type}/>
                <p className="text-[14px] font-semibold" style={{color:T.t1}}>{selStep.description}</p>
                <UIRunBadge status={selStep.status==="pass"?"pass":selStep.status==="fail"?"fail":"pending"}/>
                <span className="text-[12px] font-mono ml-auto" style={{color:T.t3}}>{selStep.duration}</span>
              </div>

              {/* Screenshot area */}
              {selStep.hasScreenshot&&(
                <div className="mb-4">
                  <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>步骤截图</p>
                  <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
                    <div className="flex items-center gap-2 px-4 py-2.5" style={{backgroundColor:"#1D2129"}}>
                      <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full" style={{backgroundColor:"#F53F3F"}}/><div className="w-3 h-3 rounded-full" style={{backgroundColor:"#FAAD14"}}/><div className="w-3 h-3 rounded-full" style={{backgroundColor:"#00B42A"}}/></div>
                      <div className="flex-1 rounded px-3 py-1 text-[11px] font-mono" style={{backgroundColor:"#2C3342",color:"#94A3B8"}}>https://test.example.com/login</div>
                    </div>
                    <div className="flex flex-col items-center justify-center" style={{height:240,backgroundColor:"#F7F8FA"}}>
                      <Monitor size={32} style={{color:T.t4}} className="mb-2"/>
                      <p className="text-[12px]" style={{color:T.t3}}>步骤截图 · {selStep.description}</p>
                      {selStep.status==="fail"&&<p className="text-[11px] mt-1 px-3 py-1 rounded" style={{backgroundColor:"#FFE8E8",color:T.danger}}>元素定位失败时刻</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Error log */}
              {selStep.errorMsg&&(
                <div>
                  <p className="text-[12px] font-semibold mb-2 flex items-center gap-1.5" style={{color:T.danger}}><AlertTriangle size={13}/>失败原因</p>
                  <div className="rounded-xl p-4 font-mono text-[12px] leading-relaxed overflow-x-auto" style={{backgroundColor:"#1D2129",color:"#F87171",border:`1px solid ${T.danger}30`}}>
                    {selStep.errorMsg.split("\n").map((line,i)=><div key={i}>{line}</div>)}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <PBtn icon={Bug} onClick={()=>{}} color={T.danger} variant="ghost">关联缺陷</PBtn>
                    <PBtn icon={Sparkles} onClick={()=>{}} variant="ghost" color={T.cyan}>AI 分析失败原因</PBtn>
                  </div>
                </div>
              )}

              {!selStep.hasScreenshot&&!selStep.errorMsg&&(
                <div className="flex flex-col items-center justify-center py-12" style={{color:T.t4}}>
                  <CheckCircle size={28} className="mb-2" style={{color:T.success}}/>
                  <p className="text-[13px]" style={{color:T.t3}}>该步骤执行成功，无截图记录</p>
                </div>
              )}
            </div>
          ):(
            <div className="flex-1 flex items-center justify-center" style={{color:T.t4}}>
              <p className="text-[13px]" style={{color:T.t3}}>选择左侧步骤查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Env Config ───────────────────────────────────────────────────────────────

function UIEnvConfig() {
  const envs=[{name:"测试环境",url:"https://test.example.com",browser:"Chrome (headless)",timeout:"30000",status:"active"},{name:"预发布环境",url:"https://staging.example.com",browser:"Chrome (headless)",timeout:"30000",status:"active"},{name:"本地开发",url:"http://localhost:3000",browser:"Chrome (headed)",timeout:"60000",status:"inactive"}];
  const vars=[{name:"test_username",value:"qatest001",sensitive:false},{name:"test_password",value:"••••••••",sensitive:true},{name:"admin_token",value:"••••••••",sensitive:true},{name:"base_timeout",value:"30000",sensitive:false}];

  return(
    <div className="flex-1 overflow-y-auto p-6">
      <PageHead title="环境与变量配置" desc="配置 Web UI 自动化使用的运行环境、浏览器参数和全局变量集"/>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4"><h3 className="text-[14px] font-semibold" style={{color:T.t1}}>Web 环境列表</h3><PBtn icon={Plus} onClick={()=>{}} small color={T.cyan}>新增环境</PBtn></div>
        <ETable total={envs.length} cols={[{label:"环境名称",width:"14%"},{label:"基础地址",width:"25%"},{label:"默认浏览器",width:"16%"},{label:"默认超时 (ms)",width:"12%"},{label:"状态",width:"8%"},{label:"操作",width:"25%",align:"right"}]}>
          {envs.map((e,i)=><TR key={i}><TD><span className="font-medium" style={{color:T.t1}}>{e.name}</span></TD><TD mono muted>{e.url}</TD><TD muted>{e.browser}</TD><TD mono muted>{e.timeout}</TD><TD><StatusDot status={e.status==="active"?"enabled":"disabled"}/></TD><TD align="right"><div className="flex items-center justify-end"><IBtn icon={Edit2} label="编辑" onClick={()=>{}}/><IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/></div></TD></TR>)}
        </ETable>
      </div>
      <div>
        <div className="flex items-center justify-between mb-4"><h3 className="text-[14px] font-semibold" style={{color:T.t1}}>全局变量集</h3><PBtn icon={Plus} onClick={()=>{}} small color={T.cyan}>新增变量</PBtn></div>
        <ETable total={vars.length} cols={[{label:"变量名",width:"22%"},{label:"变量值",width:"28%"},{label:"敏感变量",width:"12%"},{label:"操作",width:"38%",align:"right"}]}>
          {vars.map((v,i)=><TR key={i}><TD><code className="font-mono text-[12px] font-semibold" style={{color:T.t1}}>{v.name}</code></TD><TD>{v.sensitive?<span className="flex items-center gap-1 text-[12px]" style={{color:T.t3}}><Lock size={11}/>{v.value}</span>:<code className="font-mono text-[12px]" style={{color:T.t2}}>{v.value}</code>}</TD><TD>{v.sensitive?<span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{backgroundColor:"#FFF3E8",color:T.warning}}>敏感</span>:<span style={{color:T.t4}}>—</span>}</TD><TD align="right"><div className="flex items-center justify-end"><IBtn icon={Edit2} label="编辑" onClick={()=>{}}/><IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/></div></TD></TR>)}
        </ETable>
      </div>
    </div>
  );
}

// ─── WebUI Module container ───────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// WEB UI SUITE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

interface UIWebSuiteItem {
  id:string; caseId:string; caseName:string; directory:string;
  priority:Priority; status:"active"|"inactive"|"draft"; enabled:boolean;
  lastRunResult:UIRunStatus|null;
}
interface UIWebSuite {
  id:string; name:string; priority:Priority; desc:string;
  items:UIWebSuiteItem[]; env:string; browser:string;
  runMode:"serial"|"parallel"; runLocation:"server"|"runner";
  runnerId?:string; notify:boolean;
  lastRun:string|null; lastResult:"pass"|"fail"|null;
}
interface UISuiteRunRecord {
  id:string; startAt:string; env:string; browser:string;
  pass:number; fail:number; total:number; duration:string;
  operator:string; status:"pass"|"fail";
}

const BROWSERS=["Chrome","Firefox","Safari","Edge","Chrome (无头)"];
const WEBUI_ENVS=["测试环境","预发布环境","生产环境(只读)","本地联调"];
const WEBUI_RUNNERS=[{id:"wr1",name:"Runner-Linux-A",status:"在线"},{id:"wr2",name:"Runner-Mac-B",status:"离线"}];

const INIT_UI_SUITES:UIWebSuite[]=[
  {
    id:"ws1",name:"用户中心-登录注册核心回归",priority:"P0",
    desc:"覆盖用户注册、登录、找回密码完整 UI 链路，每次发版前必跑。",
    browser:"Chrome",env:"测试环境",runMode:"serial",runLocation:"server",notify:true,
    lastRun:"2026-07-07 23:01",lastResult:"pass",
    items:[
      {id:"wi1",caseId:"UC-001",caseName:"用户登录正常流程",directory:"电商平台/用户模块",priority:"P0",status:"active",enabled:true,lastRunResult:"pass"},
      {id:"wi2",caseId:"UC-004",caseName:"用户注册验证码校验",directory:"电商平台/用户模块",priority:"P2",status:"inactive",enabled:true,lastRunResult:null},
    ],
  },
  {
    id:"ws2",name:"购物主链路 UI 回归",priority:"P1",
    desc:"从搜索商品到加购到下单完整 UI 链路验证。",
    browser:"Chrome",env:"测试环境",runMode:"serial",runLocation:"server",notify:false,
    lastRun:"2026-07-05 18:00",lastResult:"fail",
    items:[
      {id:"wi3",caseId:"UC-002",caseName:"商品搜索与筛选",directory:"电商平台/商品模块",priority:"P1",status:"active",enabled:true,lastRunResult:"fail"},
      {id:"wi4",caseId:"UC-003",caseName:"购物车加购与结算",directory:"电商平台/购物车",priority:"P0",status:"active",enabled:true,lastRunResult:"pass"},
      {id:"wi5",caseId:"UC-006",caseName:"订单状态流转核心路径",directory:"电商平台/订单模块",priority:"P1",status:"active",enabled:true,lastRunResult:"pass"},
    ],
  },
  {
    id:"ws3",name:"P0 冒烟套件",priority:"P0",
    desc:"快速冒烟，确认核心功能可用。",
    browser:"Chrome (无头)",env:"预发布环境",runMode:"parallel",runLocation:"runner",runnerId:"wr1",notify:true,
    lastRun:"2026-07-06 08:00",lastResult:"pass",
    items:[
      {id:"wi6",caseId:"UC-001",caseName:"用户登录正常流程",directory:"电商平台/用户模块",priority:"P0",status:"active",enabled:true,lastRunResult:"pass"},
      {id:"wi7",caseId:"UC-003",caseName:"购物车加购与结算",directory:"电商平台/购物车",priority:"P0",status:"active",enabled:true,lastRunResult:"pass"},
    ],
  },
];

const SUITE_RUN_RECORDS:UISuiteRunRecord[]=[
  {id:"sr1",startAt:"2026-07-07 23:01",env:"测试环境",browser:"Chrome",pass:2,fail:0,total:2,duration:"18.4s",operator:"自动调度",status:"pass"},
  {id:"sr2",startAt:"2026-07-06 20:00",env:"测试环境",browser:"Chrome",pass:1,fail:1,total:2,duration:"22.1s",operator:"张程远",status:"fail"},
  {id:"sr3",startAt:"2026-07-05 14:00",env:"测试环境",browser:"Chrome",pass:2,fail:0,total:2,duration:"17.8s",operator:"自动调度",status:"pass"},
];

// ─── Priority style helper (local, avoids coupling to App.tsx) ────────────────
const P_STYLE_WUI:Record<Priority,{color:string;bg:string}>={
  P0:{color:"#F53F3F",bg:"#FFEEEE"},P1:{color:"#FF7D00",bg:"#FFF3E8"},
  P2:{color:T.primary,bg:"#E8F3FF"},P3:{color:T.t3,bg:"#F2F3F5"},
};

// ─── Add Case Dialog ──────────────────────────────────────────────────────────
function AddCaseToSuiteDialog({existing,onClose}:{existing:Set<string>;onClose:(ids:string[])=>void}){
  const[sel,setSel]=useState<Set<string>>(new Set());
  const toggle=(id:string)=>{const n=new Set(sel);n.has(id)?n.delete(id):n.add(id);setSel(n);};
  const STATUS_CFG:{[k:string]:{label:string;dot:string}}={
    active:{label:"已启用",dot:T.success},inactive:{label:"已停用",dot:T.t4},draft:{label:"草稿",dot:T.warning},
  };
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,.36)"}}>
      <div className="flex flex-col rounded-2xl shadow-2xl bg-white overflow-hidden" style={{width:680,maxHeight:"78vh"}}>
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <p className="font-semibold text-[14px]" style={{color:T.t1}}>添加 Web UI 用例</p>
          <button onClick={()=>onClose([])} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"><X size={14} style={{color:T.t3}}/></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead style={{position:"sticky",top:0}}>
              <tr style={{backgroundColor:T.bg,borderBottom:`1px solid ${T.border}`}}>
                <th className="px-4 py-2.5 w-8"/>
                {["用例名称","所属目录","优先级","状态","最近结果"].map(h=>(
                  <th key={h} className="px-3 py-2.5 text-left font-medium" style={{color:T.t3}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {UI_CASES.map((c,i)=>{
                const inSuite=existing.has(c.id);
                const sc=STATUS_CFG[c.status];
                return(
                  <tr key={c.id} style={{borderBottom:`1px solid ${T.border}`,backgroundColor:i%2===0?"#fff":T.bg+"80",opacity:inSuite?.5:1}}>
                    <td className="px-4 py-2.5">
                      {inSuite
                        ? <span className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#F2F3F5",color:T.t3}}>已在套件</span>
                        : <input type="checkbox" checked={sel.has(c.id)} onChange={()=>toggle(c.id)} className="rounded accent-cyan-500"/>
                      }
                    </td>
                    <td className="px-3 py-2.5 font-medium" style={{color:T.t1}}>{c.name}</td>
                    <td className="px-3 py-2.5" style={{color:T.t3}}>{c.directory}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:P_STYLE_WUI[c.priority].bg,color:P_STYLE_WUI[c.priority].color}}>{c.priority}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-[12px]">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor:sc.dot}}/>
                        <span style={{color:T.t2}}>{sc.label}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {c.lastRunResult
                        ? <span className="text-[12px] font-medium" style={{color:c.lastRunResult==="pass"?T.success:T.danger}}>{c.lastRunResult==="pass"?"通过":"失败"}</span>
                        : <span className="text-[11px]" style={{color:T.t4}}>未运行</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{borderTop:`1px solid ${T.border}`}}>
          <p className="text-[12px]" style={{color:T.t3}}>已选 <strong style={{color:T.cyan}}>{sel.size}</strong> 个用例</p>
          <div className="flex gap-2">
            <button onClick={()=>onClose([])} className="h-8 px-4 border rounded-xl text-[12px]" style={{borderColor:T.border,color:T.t2}}>取消</button>
            <button onClick={()=>onClose([...sel])} disabled={sel.size===0}
              className="h-8 px-5 rounded-xl text-[12px] font-semibold text-white"
              style={{backgroundColor:T.cyan,opacity:sel.size===0?.5:1}}>
              添加 {sel.size>0?`(${sel.size})`:""} 个用例
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Suite run records tab ────────────────────────────────────────────────────
function UISuiteRunRecordsTab({suiteId}:{suiteId:string}){
  return(
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-semibold" style={{color:T.t1}}>最近运行记录</p>
        <button className="h-7 px-3 border rounded-lg text-[11px] flex items-center gap-1.5 bg-white" style={{borderColor:T.border,color:T.t2}}><RefreshCw size={11}/>刷新</button>
      </div>
      <div className="space-y-2">
        {SUITE_RUN_RECORDS.map(r=>(
          <div key={r.id} className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-white border hover:shadow-sm cursor-pointer transition-shadow"
            style={{borderColor:T.border}}>
            <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full flex-shrink-0"
              style={{backgroundColor:r.status==="pass"?"#E8FFEA":"#FFEEEE",color:r.status==="pass"?T.success:T.danger}}>
              {r.status==="pass"?"通过":"失败"}
            </span>
            <div className="flex-1">
              <p className="text-[12px] font-medium" style={{color:T.t1}}>{r.browser} · {r.env}</p>
              <p className="text-[11px]" style={{color:T.t3}}>{r.startAt} · {r.operator}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[13px] font-bold" style={{color:r.fail>0?T.danger:T.success}}>{r.pass}/{r.total} 通过</p>
              <p className="text-[11px]" style={{color:T.t3}}>{r.duration}</p>
            </div>
            <ChevronRight size={14} style={{color:T.t4}}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Suite Editor ─────────────────────────────────────────────────────────────
function UIWebSuiteEditor({suite,onChange}:{suite:UIWebSuite;onChange:(s:UIWebSuite)=>void}){
  const[subTab,setSubTab]=useState<"arrange"|"records">("arrange");
  const[editingName,setEditingName]=useState(false);
  const[showAddCase,setShowAddCase]=useState(false);
  const existing=new Set(suite.items.map(i=>i.caseId));

  const addCases=(ids:string[])=>{
    const newItems:UIWebSuiteItem[]=ids.map(id=>{
      const c=UI_CASES.find(x=>x.id===id)!;
      return{id:`wi${Date.now()}_${id}`,caseId:c.id,caseName:c.name,directory:c.directory,
        priority:c.priority,status:c.status,enabled:true,lastRunResult:c.lastRunResult};
    });
    onChange({...suite,items:[...suite.items,...newItems]});
  };

  const moveItem=(i:number,dir:-1|1)=>{
    const arr=[...suite.items];
    if(i+dir<0||i+dir>=arr.length)return;
    [arr[i],arr[i+dir]]=[arr[i+dir],arr[i]];
    onChange({...suite,items:arr});
  };

  const P=suite.priority as Priority;

  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top action bar */}
      <div className="flex items-center gap-2.5 px-4 flex-shrink-0"
        style={{height:46,borderBottom:`1px solid ${T.border}`,backgroundColor:"#fff"}}>
        <select value={P} onChange={e=>onChange({...suite,priority:e.target.value as Priority})}
          className="h-6 border rounded-lg text-[11px] font-bold px-1.5 outline-none flex-shrink-0"
          style={{borderColor:P_STYLE_WUI[P].color,backgroundColor:P_STYLE_WUI[P].bg,color:P_STYLE_WUI[P].color}}>
          {(["P0","P1","P2","P3"] as Priority[]).map(p=><option key={p}>{p}</option>)}
        </select>
        {editingName
          ? <input autoFocus value={suite.name} onChange={e=>onChange({...suite,name:e.target.value})}
              onBlur={()=>setEditingName(false)} onKeyDown={e=>e.key==="Enter"&&setEditingName(false)}
              className="text-[14px] font-semibold outline-none border-b px-0.5"
              style={{color:T.t1,borderColor:T.cyan,minWidth:200}}/>
          : <button onClick={()=>setEditingName(true)} className="flex items-center gap-1.5 group/n min-w-0">
              <span className="text-[14px] font-semibold truncate" style={{color:T.t1,maxWidth:300}}>{suite.name}</span>
              <Edit2 size={12} className="opacity-0 group-hover/n:opacity-100 flex-shrink-0" style={{color:T.t3}}/>
            </button>
        }
        <div className="flex-1"/>
        {/* Run mode toggle */}
        <div className="flex rounded-xl overflow-hidden border flex-shrink-0" style={{borderColor:T.border}}>
          {(["serial","parallel"] as const).map((m,i)=>(
            <button key={m} onClick={()=>onChange({...suite,runMode:m})}
              className="px-3 py-1 text-[11px] font-medium"
              style={{backgroundColor:suite.runMode===m?"#E8FFFB":"#fff",color:suite.runMode===m?T.cyan:T.t2,
                borderLeft:i>0?`1px solid ${T.border}`:"none"}}>
              {m==="serial"?"串行":"并行"}
            </button>
          ))}
        </div>
        {/* Env picker */}
        <div className="flex items-center gap-1.5 h-8 px-2.5 border rounded-xl bg-white flex-shrink-0" style={{borderColor:T.border}}>
          <span className="text-[11px]" style={{color:T.t3}}>环境</span>
          <select value={suite.env} onChange={e=>onChange({...suite,env:e.target.value})}
            className="text-[12px] font-medium outline-none bg-transparent" style={{color:T.t1}}>
            {WEBUI_ENVS.map(e=><option key={e}>{e}</option>)}
          </select>
        </div>
        {/* Browser picker */}
        <div className="flex items-center gap-1.5 h-8 px-2.5 border rounded-xl bg-white flex-shrink-0" style={{borderColor:T.border}}>
          <Monitor size={12} style={{color:T.t3}}/>
          <select value={suite.browser} onChange={e=>onChange({...suite,browser:e.target.value})}
            className="text-[12px] font-medium outline-none bg-transparent" style={{color:T.t1}}>
            {BROWSERS.map(b=><option key={b}>{b}</option>)}
          </select>
        </div>
        {/* Notify */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px]" style={{color:T.t3}}>通知</span>
          <Toggle on={suite.notify} onChange={v=>onChange({...suite,notify:v})}/>
        </div>
        <button className="h-8 px-3 flex items-center gap-1.5 border rounded-xl text-[12px] font-medium flex-shrink-0"
          style={{borderColor:T.border,color:T.t1}}><Save size={13}/>保存</button>
        <button className="h-8 px-4 flex items-center gap-1.5 rounded-xl text-[12px] font-semibold text-white flex-shrink-0"
          style={{backgroundColor:T.cyan}}><Play size={13}/>运行</button>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center px-4 flex-shrink-0"
        style={{height:36,borderBottom:`1px solid ${T.border}`,backgroundColor:"#FAFBFE"}}>
        {([["arrange",`用例编排 (${suite.items.length})`],["records","运行结果"]] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setSubTab(k)}
            className="h-full px-4 text-[12px] font-medium border-b-2 transition-colors"
            style={{borderBottomColor:subTab===k?T.cyan:"transparent",color:subTab===k?T.cyan:T.t3}}>
            {l}
          </button>
        ))}
      </div>

      {subTab==="records"&&<UISuiteRunRecordsTab suiteId={suite.id}/>}

      {subTab==="arrange"&&(
        <div className="flex flex-1 overflow-hidden">
          {/* Cases list */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
              <span className="text-[12px]" style={{color:T.t3}}>
                共 <strong style={{color:T.t1}}>{suite.items.length}</strong> 个用例，按顺序执行
              </span>
              <button onClick={()=>setShowAddCase(true)}
                className="h-7 px-3 rounded-lg text-[12px] font-medium text-white flex items-center gap-1.5"
                style={{backgroundColor:T.cyan}}>
                <Plus size={12}/>添加用例
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4" style={{backgroundColor:"#F7F8FC"}}>
              {suite.items.length===0
                ? <div className="flex flex-col items-center justify-center py-20" style={{color:T.t3}}>
                    <Layers size={40} style={{color:T.t4,marginBottom:12}}/>
                    <p className="text-[14px] font-medium mb-4" style={{color:T.t2}}>套件还没有用例</p>
                    <button onClick={()=>setShowAddCase(true)}
                      className="h-8 px-5 rounded-xl text-[12px] font-medium text-white flex items-center gap-1.5"
                      style={{backgroundColor:T.cyan}}><Plus size={13}/>添加 Web UI 用例</button>
                  </div>
                : <>
                    {suite.items.map((item,i)=>{
                      const P2=item.priority as Priority;
                      return(
                        <div key={item.id}
                          className="flex items-center gap-2.5 px-3 py-2.5 mb-1.5 rounded-xl border bg-white group/item hover:shadow-sm transition-shadow"
                          style={{borderColor:T.border,borderLeft:`3px solid ${item.enabled?T.cyan:T.t4}`,opacity:item.enabled?1:.55}}>
                          <GripVertical size={13} className="flex-shrink-0 opacity-20 cursor-grab group-hover/item:opacity-50" style={{color:T.t3}}/>
                          <Toggle on={item.enabled} onChange={v=>onChange({...suite,items:suite.items.map(x=>x.id===item.id?{...x,enabled:v}:x)})}/>
                          <span className="w-5 text-center text-[11px] font-mono flex-shrink-0" style={{color:T.t4}}>{i+1}</span>
                          <span className="px-1.5 py-px rounded text-[10px] font-bold flex-shrink-0"
                            style={{backgroundColor:P_STYLE_WUI[P2].bg,color:P_STYLE_WUI[P2].color}}>{P2}</span>
                          <span className="flex-1 text-[13px] font-medium truncate" style={{color:T.t1}}>{item.caseName}</span>
                          <span className="text-[11px] truncate" style={{color:T.t3,maxWidth:180}}>{item.directory}</span>
                          {item.lastRunResult
                            ? <span className="text-[11px] font-medium flex-shrink-0" style={{color:item.lastRunResult==="pass"?T.success:T.danger}}>
                                {item.lastRunResult==="pass"?"✓ 通过":"✗ 失败"}
                              </span>
                            : <span className="text-[10px] flex-shrink-0" style={{color:T.t4}}>未运行</span>
                          }
                          <div className="flex items-center gap-0 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0">
                            <button onClick={()=>moveItem(i,-1)} disabled={i===0} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100" style={{color:T.t3,opacity:i===0?.3:1}}><ArrowUp size={11}/></button>
                            <button onClick={()=>moveItem(i,1)} disabled={i===suite.items.length-1} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100" style={{color:T.t3,opacity:i===suite.items.length-1?.3:1}}><ArrowDown size={11}/></button>
                            <button onClick={()=>onChange({...suite,items:suite.items.filter(x=>x.id!==item.id)})} className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50" style={{color:T.danger}}><Trash2 size={11}/></button>
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={()=>setShowAddCase(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-3 mt-1 rounded-xl border-dashed border text-[12px] hover:bg-cyan-50/60 transition-colors"
                      style={{borderColor:T.border,color:T.t3}}>
                      <Plus size={13}/>添加用例
                    </button>
                  </>
              }
            </div>
          </div>

          {/* Right config panel */}
          <div className="flex-shrink-0 border-l overflow-y-auto p-4 space-y-4 text-[12px]"
            style={{width:212,borderColor:T.border,backgroundColor:"#FAFBFE"}}>
            <div>
              <p className="font-medium mb-1.5" style={{color:T.t2}}>运行位置</p>
              <div className="flex rounded-xl overflow-hidden border" style={{borderColor:T.border}}>
                {(["server","runner"] as const).map((k,i)=>(
                  <button key={k} onClick={()=>onChange({...suite,runLocation:k})}
                    className="flex-1 py-1.5 text-[11px] font-medium transition-colors"
                    style={{backgroundColor:suite.runLocation===k?"#E8FFFB":"#fff",color:suite.runLocation===k?T.cyan:T.t2,
                      borderLeft:i>0?`1px solid ${T.border}`:"none"}}>
                    {k==="server"?"服务端":"Runner"}
                  </button>
                ))}
              </div>
            </div>
            {suite.runLocation==="runner"&&(
              <div className="rounded-xl border overflow-hidden" style={{borderColor:T.border}}>
                {WEBUI_RUNNERS.map((r,i)=>(
                  <label key={r.id} className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
                    style={{borderTop:i>0?`1px solid ${T.border}`:"none",backgroundColor:"#fff"}}>
                    <input type="radio" name="wuir" defaultChecked={i===0} className="accent-cyan-500"/>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor:r.status==="在线"?T.success:T.t4}}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate" style={{color:T.t1}}>{r.name}</p>
                      <p className="text-[10px]" style={{color:T.t3}}>{r.status}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div>
              <p className="font-medium mb-1.5" style={{color:T.t2}}>失败策略</p>
              <select className="w-full h-7 px-2 border rounded-xl text-[11px] outline-none bg-white" style={{borderColor:T.border,color:T.t1}}>
                <option>遇到失败继续执行</option>
                <option>遇到失败立即中止</option>
                <option>当前用例失败跳过</option>
              </select>
            </div>
            <div>
              <p className="font-medium mb-1.5" style={{color:T.t2}}>截图策略</p>
              <select className="w-full h-7 px-2 border rounded-xl text-[11px] outline-none bg-white" style={{borderColor:T.border,color:T.t1}}>
                <option>仅失败时截图</option>
                <option>每步都截图</option>
                <option>不截图</option>
              </select>
            </div>
            <div>
              <p className="font-medium mb-1.5" style={{color:T.t2}}>超时 (s)</p>
              <input type="number" defaultValue={60} className="w-full h-7 px-2 border rounded-xl text-[11px] text-center outline-none bg-white" style={{borderColor:T.border}}/>
            </div>
            {suite.lastRun&&(
              <div className="pt-3" style={{borderTop:`1px solid ${T.border}`}}>
                <p className="font-medium mb-1.5" style={{color:T.t2}}>上次运行</p>
                <span className="text-[12px] font-medium" style={{color:suite.lastResult==="pass"?T.success:T.danger}}>
                  {suite.lastResult==="pass"?"通过":"失败"}
                </span>
                <p className="text-[10px] mt-0.5" style={{color:T.t4}}>{suite.lastRun}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddCase&&(
        <AddCaseToSuiteDialog existing={existing} onClose={ids=>{if(ids.length>0)addCases(ids);setShowAddCase(false);}}/>
      )}
    </div>
  );
}

// ─── Suite list pane (left) ───────────────────────────────────────────────────
function UIWebSuiteListPane({suites,selectedId,onSelect,onCreate}:{
  suites:UIWebSuite[];selectedId:string;onSelect:(id:string)=>void;onCreate:()=>void;
}){
  const[search,setSearch]=useState("");
  const filtered=suites.filter(s=>!search||s.name.toLowerCase().includes(search.toLowerCase()));
  return(
    <div className="flex-shrink-0 flex flex-col border-r overflow-hidden"
      style={{width:252,borderColor:T.border,backgroundColor:"#fff"}}>
      <div className="px-3 py-2.5 flex items-center gap-2 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
        <div className="relative flex-1">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索套件..."
            className="w-full h-7 pl-7 pr-2 rounded-lg text-[12px] outline-none border"
            style={{borderColor:T.border,backgroundColor:T.bg}}/>
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{color:T.t3}}/>
        </div>
        <button onClick={onCreate} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg hover:bg-cyan-50 border" style={{borderColor:T.border}}>
          <Plus size={14} style={{color:T.cyan}}/>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.map(s=>{
          const isActive=s.id===selectedId;
          const P2=s.priority as Priority;
          return(
            <button key={s.id} onClick={()=>onSelect(s.id)}
              className="w-full text-left px-3 py-2.5 transition-colors border-b"
              style={{backgroundColor:isActive?"#E0FFFE":"transparent",borderColor:T.border+"60"}}
              onMouseEnter={e=>{if(!isActive)e.currentTarget.style.backgroundColor=T.bg;}}
              onMouseLeave={e=>{if(!isActive)e.currentTarget.style.backgroundColor="transparent";}}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="px-1.5 py-px rounded text-[10px] font-bold flex-shrink-0"
                  style={{backgroundColor:P_STYLE_WUI[P2].bg,color:P_STYLE_WUI[P2].color}}>{P2}</span>
                <span className="flex-1 text-[12px] font-medium truncate" style={{color:isActive?T.cyan:T.t1}}>{s.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{color:T.t3}}>{s.items.length} 个用例</span>
                <span style={{color:T.t4}}>·</span>
                {s.lastResult
                  ? <span className="text-[10px] font-medium" style={{color:s.lastResult==="pass"?T.success:T.danger}}>{s.lastResult==="pass"?"通过":"失败"}</span>
                  : <span className="text-[10px]" style={{color:T.t4}}>未运行</span>
                }
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex-shrink-0 p-2.5" style={{borderTop:`1px solid ${T.border}`}}>
        <button onClick={onCreate}
          className="w-full h-8 flex items-center justify-center gap-1.5 rounded-xl border text-[12px] font-medium hover:bg-cyan-50 transition-colors"
          style={{borderColor:T.cyan,color:T.cyan,borderStyle:"dashed"}}>
          <Plus size={13}/>新建套件
        </button>
      </div>
    </div>
  );
}

// ─── Suite Management (exported) ──────────────────────────────────────────────
function UIWebSuiteManagement(){
  const[suites,setSuites]=useState<UIWebSuite[]>(INIT_UI_SUITES);
  const[selectedId,setSelectedId]=useState<string>(INIT_UI_SUITES[0].id);

  const createSuite=()=>{
    const id=`ws${Date.now()}`;
    const s:UIWebSuite={id,name:"未命名套件",priority:"P2",desc:"",items:[],
      env:"测试环境",browser:"Chrome",runMode:"serial",runLocation:"server",notify:false,
      lastRun:null,lastResult:null};
    setSuites(p=>[...p,s]);
    setSelectedId(id);
  };

  const selected=suites.find(s=>s.id===selectedId)??suites[0];

  return(
    <div className="flex-1 flex overflow-hidden">
      <UIWebSuiteListPane suites={suites} selectedId={selectedId} onSelect={setSelectedId} onCreate={createSuite}/>
      {selected
        ? <UIWebSuiteEditor key={selected.id} suite={selected}
            onChange={updated=>setSuites(p=>p.map(s=>s.id===updated.id?updated:s))}/>
        : <div className="flex-1 flex items-center justify-center" style={{backgroundColor:"#F7F8FC"}}>
            <p className="text-[14px]" style={{color:T.t3}}>从左侧选择套件或新建套件</p>
          </div>
      }
    </div>
  );
}

export function WebUIModule({onDeleteElement,onUnsavedClose,onAddElement,onEditElement,onVerifyElement,onViewElement,onAddStep,onEditStep,onSingleDebug,onImpact,onViewRefs,onQualityAnalysis}:{onDeleteElement?:()=>void;onUnsavedClose?:()=>void;onAddElement?:()=>void;onEditElement?:()=>void;onVerifyElement?:()=>void;onViewElement?:()=>void;onAddStep?:()=>void;onEditStep?:()=>void;onSingleDebug?:()=>void;onImpact?:()=>void;onViewRefs?:()=>void;onQualityAnalysis?:()=>void}={}) {
  const[sub,setSub]=useState<UISubPage>("cases");
  const[editCase,setEditCase]=useState<UICase|null>(null);
  const[viewRun,setViewRun]=useState<UIRun|null>(null);
  const[aiCapturePage,setAiCapturePage]=useState(false);
  const[recordPhase,setRecordPhase]=useState<null|"config"|"recording"|"confirm">(null);
  const[recordCfg,setRecordCfg]=useState<RecordCfg|null>(null);

  const tabs:[UISubPage,string][]=[["cases","用例管理"],["elements","元素库"],["suites","执行套件"],["records","执行记录"],["env","环境配置"]];

  // Full-page overrides (AI capture, recording)
  if(aiCapturePage){
    return <AiCapturePage onBack={()=>{setAiCapturePage(false);setSub("elements");}}/>;
  }
  if (recordPhase==="recording"&&recordCfg) {
    return <RecordingWorkspace config={recordCfg} onStop={steps=>setRecordPhase("confirm")} onDiscard={()=>setRecordPhase(null)}/>;
  }
  if (recordPhase==="confirm"&&recordCfg) {
    return <RecordConfirmPage steps={REC_MOCK_STEPS} config={recordCfg} onSave={c=>{setEditCase(c);setRecordPhase(null);}} onBack={()=>setRecordPhase("recording")}/>;
  }

  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center flex-shrink-0 px-5 bg-white" style={{borderBottom:`1px solid ${T.border}`,height:44}}>
        {tabs.map(([key,label])=>(
          <button key={key} onClick={()=>{setSub(key);setEditCase(null);setViewRun(null);}}
            className="h-full px-4 text-[13px] font-medium border-b-2 transition-colors"
            style={{borderBottomColor:sub===key?T.cyan:"transparent",color:sub===key?T.cyan:T.t3}}>
            {label}
          </button>
        ))}
      </div>

      {/* Page content */}
      {sub==="cases"&&!editCase&&<UICaseList onEdit={setEditCase} onRecord={()=>setRecordPhase("config")}/>}
      {sub==="cases"&&editCase&&<UICaseEditor case_={editCase} onBack={()=>setEditCase(null)} onReRecord={()=>setRecordPhase("config")} onAppendRecord={()=>setRecordPhase("config")} onUnsavedClose={onUnsavedClose} onAddStep={onAddStep} onEditStep={onEditStep} onSingleDebug={onSingleDebug}/>}
      {sub==="elements"&&<UIElementLibrary onAICapture={()=>setAiCapturePage(true)} onDeleteElement={onDeleteElement} onAddElement={onAddElement} onEditElement={onEditElement} onVerifyElement={onVerifyElement} onViewElement={onViewElement}/>}
      {sub==="suites"&&<UIWebSuiteManagement/>}
      {sub==="records"&&!viewRun&&<UIRunList onView={setViewRun}/>}
      {sub==="records"&&viewRun&&<UIRunDetail run={viewRun} onBack={()=>setViewRun(null)}/>}
      {sub==="env"&&<UIEnvConfig/>}

      {/* Record config modal overlay */}
      {recordPhase==="config"&&(
        <RecordConfigModal
          onClose={()=>setRecordPhase(null)}
          onStart={cfg=>{setRecordCfg(cfg);setRecordPhase("recording");}}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT CENTER MODULE
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Report Types ─────────────────────────────────────────────────────────────

type ReportType = "api-scene" | "api-suite" | "webui-case" | "webui-suite";
type ReportRunStatus = "passed" | "failed" | "running" | "aborted";
type ReportTriggerMode = "manual" | "scheduled" | "ci";
type RStepStatus = "pass" | "fail" | "skip" | "error";

export interface ReportRecord {
  id: string; name: string; type: ReportType; status: ReportRunStatus;
  passRate: number; totalSteps: number; passSteps: number; failSteps: number; skipSteps: number;
  duration: string; executor: string; env: string; trigger: ReportTriggerMode;
  startAt: string; endAt: string;
}
interface RAssertion { path: string; op: string; expected: string; actual: string; pass: boolean; msg?: string; }
interface RStep {
  id: string; seq: number; name: string; status: RStepStatus; duration: string;
  isApi?: boolean; url?: string; method?: HttpMethod;
  reqBody?: string; resStatus?: number; resBody?: string; resDuration?: string;
  assertions?: RAssertion[]; errorLog?: string; screenshot?: boolean;
  aiAnalysis?: { summary: string; basis: string[]; suggestions: string[]; };
}
interface ReportDetail extends ReportRecord { steps: RStep[]; scenario?: string; suite?: string; }

// ─── Report Mock Data ─────────────────────────────────────────────────────────

const RPT_TYPE: Record<ReportType, { label: string; color: string; bg: string }> = {
  "api-scene":  { label: "接口场景",   color: T.primary,  bg: "#E8F3FF" },
  "api-suite":  { label: "接口套件",   color: "#4E5AC8",  bg: "#ECEEFF" },
  "webui-case": { label: "Web UI 用例", color: T.cyan,    bg: "#E6FFFE" },
  "webui-suite":{ label: "Web UI 套件", color: T.purple,  bg: "#F5E8FF" },
};

const RPT_STATUS: Record<ReportRunStatus, { label: string; color: string; bg: string; dot: string }> = {
  passed:  { label: "成功",   color: "#00B42A", bg: "#E8FFEA", dot: "#00B42A" },
  failed:  { label: "失败",   color: "#F53F3F", bg: "#FFE8E8", dot: "#F53F3F" },
  running: { label: "执行中", color: "#165DFF", bg: "#E8F3FF", dot: "#165DFF" },
  aborted: { label: "已中断", color: "#FF7D00", bg: "#FFF3E8", dot: "#FF7D00" },
};

const REPORTS: ReportRecord[] = [
  { id:"RPT-2026-0703-001", name:"订单中心-主流程回归", type:"api-suite", status:"passed", passRate:100, totalSteps:48, passSteps:48, failSteps:0, skipSteps:0, duration:"2m 34s", executor:"张程远", env:"测试环境", trigger:"manual", startAt:"2026-07-03 14:00:12", endAt:"2026-07-03 14:02:46" },
  { id:"RPT-2026-0703-002", name:"风控中心-黑名单拦截场景", type:"api-scene", status:"failed", passRate:50, totalSteps:8, passSteps:4, failSteps:3, skipSteps:1, duration:"48s", executor:"李明", env:"预发布", trigger:"ci", startAt:"2026-07-03 13:30:05", endAt:"2026-07-03 13:30:53" },
  { id:"RPT-2026-0703-003", name:"用户中心-注册登录 UI 套件", type:"webui-suite", status:"failed", passRate:80, totalSteps:35, passSteps:28, failSteps:7, skipSteps:0, duration:"5m 12s", executor:"王芳", env:"测试环境", trigger:"scheduled", startAt:"2026-07-03 09:00:00", endAt:"2026-07-03 09:05:12" },
  { id:"RPT-2026-0703-004", name:"获客中心-产品新增 UI 用例", type:"webui-case", status:"passed", passRate:100, totalSteps:18, passSteps:18, failSteps:0, skipSteps:0, duration:"1m 05s", executor:"张程远", env:"测试环境", trigger:"manual", startAt:"2026-07-03 10:15:00", endAt:"2026-07-03 10:16:05" },
  { id:"RPT-2026-0702-001", name:"获客中心-全量回归套件", type:"api-suite", status:"failed", passRate:87.5, totalSteps:64, passSteps:56, failSteps:8, skipSteps:0, duration:"4m 18s", executor:"陈伟", env:"预发布", trigger:"ci", startAt:"2026-07-02 18:00:00", endAt:"2026-07-02 18:04:18" },
  { id:"RPT-2026-0702-002", name:"风控统计-只读查询场景", type:"api-scene", status:"passed", passRate:100, totalSteps:6, passSteps:6, failSteps:0, skipSteps:0, duration:"12s", executor:"李明", env:"生产环境", trigger:"manual", startAt:"2026-07-02 15:20:00", endAt:"2026-07-02 15:20:12" },
  { id:"RPT-2026-0701-001", name:"订单退款流程-异常分支", type:"api-scene", status:"aborted", passRate:25, totalSteps:8, passSteps:2, failSteps:2, skipSteps:4, duration:"22s", executor:"张程远", env:"测试环境", trigger:"manual", startAt:"2026-07-01 16:40:00", endAt:"2026-07-01 16:40:22" },
];

const REPORT_DETAIL: ReportDetail = {
  ...REPORTS[1],
  scenario: "风控中心-黑名单拦截场景",
  steps: [
    { id:"s1", seq:1, name:"POST /api/auth/login", status:"pass", duration:"120ms", isApi:true, url:"https://staging-api.company.com/api/auth/login", method:"POST", reqBody:'{\n  "username": "qatest001",\n  "password": "Test@1234"\n}', resStatus:200, resBody:'{\n  "code": 0,\n  "data": {\n    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",\n    "userId": 10042,\n    "role": "user"\n  }\n}', resDuration:"98ms", assertions:[{path:"$.code",op:"等于",expected:"0",actual:"0",pass:true},{path:"$.data.token",op:"存在",expected:"—",actual:"eyJhbGci...",pass:true}] },
    { id:"s2", seq:2, name:"POST /api/risk/blacklist/add", status:"pass", duration:"85ms", isApi:true, url:"https://staging-api.company.com/api/risk/blacklist/add", method:"POST", reqBody:'{\n  "userId": 99999,\n  "reason": "测试黑名单拦截",\n  "operatorId": 10042\n}', resStatus:200, resBody:'{\n  "code": 0,\n  "message": "success",\n  "data": { "blacklistId": 5501 }\n}', resDuration:"62ms", assertions:[{path:"$.code",op:"等于",expected:"0",actual:"0",pass:true},{path:"$.data.blacklistId",op:"大于",expected:"0",actual:"5501",pass:true}] },
    { id:"s3", seq:3, name:"GET /api/risk/blacklist/query", status:"pass", duration:"67ms", isApi:true, url:"https://staging-api.company.com/api/risk/blacklist/query?userId=99999", method:"GET", resStatus:200, resBody:'{\n  "code": 0,\n  "data": {\n    "inBlacklist": true,\n    "userId": 99999,\n    "addedAt": "2026-07-03 13:30:20"\n  }\n}', resDuration:"51ms", assertions:[{path:"$.data.inBlacklist",op:"等于",expected:"true",actual:"true",pass:true}] },
    { id:"s4", seq:4, name:"POST /api/orders/create（黑名单用户下单）", status:"fail", duration:"210ms", isApi:true, url:"https://staging-api.company.com/api/orders/create", method:"POST", reqBody:'{\n  "userId": 99999,\n  "productId": 1001,\n  "quantity": 1,\n  "paymentMethod": "alipay"\n}', resStatus:200, resBody:'{\n  "code": 0,\n  "message": "success",\n  "data": { "orderId": "ORD-20260703-99001" }\n}', resDuration:"188ms", assertions:[{path:"$.code",op:"等于",expected:"403",actual:"0",pass:false,msg:"期望返回 403 被拦截，实际返回 0（下单成功）"},{path:"$.message",op:"包含",expected:"blacklist",actual:"success",pass:false,msg:"响应消息不含 blacklist 关键字"}], errorLog:`[2026-07-03 13:30:38.214] [ASSERT FAIL] Step 4: POST /api/orders/create\n断言失败: $.code 期望 403，实际 0\n断言失败: $.message 期望包含 "blacklist"，实际 "success"\n\n环境: 预发布 (https://staging-api.company.com)\n推断: 预发布环境风控中间件未正确拦截黑名单用户下单请求。`, aiAnalysis:{ summary:"风控中间件未在预发布环境正确拦截黑名单用户下单，接口返回 200 而非预期 403，表明黑名单校验逻辑未在该环境生效。", basis:["步骤 2 成功将 userId=99999 写入黑名单，blacklistId=5501 表明入库成功","步骤 3 查询确认 inBlacklist=true，黑名单数据写入正确","步骤 4 下单请求接口返回 code=0 而非 403，风控拦截未被触发","响应体包含正常 orderId，表明订单已实际创建成功"], suggestions:["检查预发布环境风控中间件是否已部署最新版本","对比测试环境与预发布环境 risk-middleware 配置差异","排查黑名单缓存同步（预发布可能使用独立 Redis 实例）","联系后端确认 /api/orders/create 在预发布的中间件链路是否完整"] } },
    { id:"s5", seq:5, name:"POST /api/risk/blacklist/remove", status:"skip", duration:"—", isApi:true },
    { id:"s6", seq:6, name:"GET /api/risk/blacklist/query（验证移除）", status:"skip", duration:"—", isApi:true },
    { id:"s7", seq:7, name:"DELETE /api/test/cleanup", status:"fail", duration:"315ms", isApi:true, url:"https://staging-api.company.com/api/test/cleanup", method:"DELETE", resStatus:500, resBody:'{\n  "code": 500,\n  "message": "Internal Server Error",\n  "trace": "NullPointerException at com.company.cleanup.CleanupService:142"\n}', resDuration:"290ms", assertions:[{path:"$.code",op:"等于",expected:"0",actual:"500",pass:false,msg:"清理接口 500 异常"}], errorLog:`[2026-07-03 13:30:42.512] [ERROR] Step 7: DELETE /api/test/cleanup\nHTTP 500 Internal Server Error\nNullPointerException at com.company.cleanup.CleanupService:142\n\n清理步骤异常可能导致测试数据残留，建议手动清理。`, aiAnalysis:{ summary:"清理接口返回 500 服务端空指针，与风控逻辑无关，但会导致测试数据残留影响后续用例执行。", basis:["HTTP 500 和 NullPointerException 定位在 CleanupService:142","该步骤在风控断言失败后仍执行，continue-on-fail 配置生效","错误发生在数据清理阶段，与核心业务逻辑无关"], suggestions:["修复 CleanupService 空指针异常（后端缺陷）","在用例开始时做前置清理，减少对末尾清理步骤的依赖","临时方案：手动清理 userId=99999 的黑名单记录和测试订单"] } },
    { id:"s8", seq:8, name:"GET /api/orders/list（验证无残留订单）", status:"fail", duration:"74ms", isApi:true, url:"https://staging-api.company.com/api/orders/list?userId=99999", method:"GET", resStatus:200, resBody:'{\n  "code": 0,\n  "data": {\n    "list": [\n      { "orderId": "ORD-20260703-99001", "status": "pending" }\n    ],\n    "total": 1\n  }\n}', resDuration:"61ms", assertions:[{path:"$.data.total",op:"等于",expected:"0",actual:"1",pass:false,msg:"黑名单用户下单应被拦截，但残留订单 ORD-20260703-99001"}], errorLog:`[2026-07-03 13:30:43.821] [ASSERT FAIL] Step 8\n$.data.total 期望 0，实际 1\n残留订单: ORD-20260703-99001 (status=pending)` },
  ]
};

// ─── Report UI Primitives ─────────────────────────────────────────────────────

function RptTypeBadge({ type }:{ type:ReportType }) {
  const c = RPT_TYPE[type];
  return <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium" style={{ backgroundColor:c.bg, color:c.color }}>{c.label}</span>;
}

function RptStatusBadge({ status, large }:{ status:ReportRunStatus; large?:boolean }) {
  const c = RPT_STATUS[status];
  return (
    <span className="inline-flex items-center gap-1.5" style={{ padding: large ? "4px 10px" : "0", borderRadius: large ? 6 : 0, backgroundColor: large ? c.bg : "transparent" }}>
      <span className={large ? "w-2 h-2 rounded-full" : "w-1.5 h-1.5 rounded-full"} style={{ backgroundColor:c.dot }}/>
      <span className={large ? "text-[13px] font-bold" : "text-[12px] font-medium"} style={{ color:c.color }}>{c.label}</span>
    </span>
  );
}

function PassBar({ rate }:{ rate:number }) {
  const color = rate >= 90 ? T.success : rate >= 70 ? T.warning : T.danger;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 rounded-full overflow-hidden flex-1" style={{ backgroundColor:"#F2F3F5", minWidth:50 }}>
        <div className="h-full rounded-full" style={{ width:`${rate}%`, backgroundColor:color }}/>
      </div>
      <span className="text-[12px] font-mono font-semibold w-10 text-right" style={{ color }}>{rate.toFixed(0)}%</span>
    </div>
  );
}

function StepStatusDot({ status }:{ status:RStepStatus }) {
  const cfg = {
    pass:  { bg:T.success,  icon:<Check size={11} color="#fff"/> },
    fail:  { bg:T.danger,   icon:<X size={11} color="#fff"/> },
    skip:  { bg:"#C9CDD4",  icon:<Minus size={11} color="#fff"/> },
    error: { bg:T.warning,  icon:<AlertTriangle size={10} color="#fff"/> },
  }[status];
  return <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor:cfg.bg }}>{cfg.icon}</div>;
}

function CodeBlock({ content, lang="json" }:{ content:string; lang?:string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg overflow-hidden" style={{ border:`1px solid ${T.border}` }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor:"#1B202B" }}>
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color:"#4E6080" }}>{lang}</span>
        <button onClick={() => { setCopied(true); setTimeout(()=>setCopied(false),1500); }}
          className="flex items-center gap-1 text-[10px] transition-colors"
          style={{ color: copied ? T.success : "#4E6080" }}>
          {copied ? <><Check size={9}/> 已复制</> : <><Copy size={9}/> 复制</>}
        </button>
      </div>
      <pre className="p-3 text-[12px] font-mono leading-relaxed overflow-auto" style={{ backgroundColor:"#13181F", color:"#9DB5CC", margin:0, maxHeight:220 }}>{content}</pre>
    </div>
  );
}

// ─── AI Diagnosis Panel ───────────────────────────────────────────────────────

function AiDiagPanel({ analysis }:{ analysis?:RStep["aiAnalysis"] }) {
  const [open, setOpen] = useState(false);

  if (!analysis) {
    return (
      <button className="flex items-center gap-2 h-8 px-4 rounded-lg border text-[13px] transition-all"
        style={{ borderColor:`${T.cyan}60`, color:T.cyan }}
        onMouseEnter={e=>e.currentTarget.style.backgroundColor=`${T.cyan}0A`}
        onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>
        <Sparkles size={13}/> 让 AI 分析失败原因
      </button>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border:`1px solid ${T.cyan}50` }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors"
        style={{ backgroundColor:`${T.cyan}0D` }}
        onMouseEnter={e=>e.currentTarget.style.backgroundColor=`${T.cyan}18`}
        onMouseLeave={e=>e.currentTarget.style.backgroundColor=`${T.cyan}0D`}>
        <Sparkles size={13} style={{ color:T.cyan, flexShrink:0 }}/>
        <span className="text-[12px] font-semibold flex-1" style={{ color:T.t1 }}>AI 失败诊断</span>
        <span className="text-[11px] mr-2" style={{ color:T.t3 }}>{open ? "收起" : "展开"}</span>
        <ChevronDown size={13} style={{ color:T.t3, transform:open?"rotate(180deg)":"", transition:"transform 0.2s", flexShrink:0 }}/>
      </button>
      {open && (
        <div className="px-4 py-4 space-y-4" style={{ backgroundColor:"#FAFFFE" }}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color:T.t3 }}>诊断结论</p>
            <p className="text-[13px] leading-relaxed" style={{ color:T.t1 }}>{analysis.summary}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color:T.t3 }}>分析依据</p>
            <div className="space-y-1.5">
              {analysis.basis.map((b,i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-[10px] font-bold w-4 text-center rounded flex-shrink-0 mt-0.5" style={{ backgroundColor:`${T.cyan}20`, color:T.cyan, lineHeight:"16px" }}>{i+1}</span>
                  <p className="text-[12px] leading-relaxed" style={{ color:T.t2 }}>{b}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color:T.t3 }}>排查建议</p>
            <div className="space-y-1.5">
              {analysis.suggestions.map((s,i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[11px] flex-shrink-0 mt-0.5" style={{ color:T.warning }}>→</span>
                  <p className="text-[12px] leading-relaxed" style={{ color:T.t2 }}>{s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step Detail Drawer ───────────────────────────────────────────────────────

function StepDetailDrawer({ step, onClose }:{ step:RStep|null; onClose:()=>void }) {
  const [tab, setTab] = useState<"req"|"res"|"assert"|"log"|"ai">("req");
  useEffect(() => { if (step) setTab(step.status==="fail"||step.status==="error" ? "assert" : "req"); }, [step?.id]);
  if (!step) return null;

  const sc = RPT_STATUS[step.status==="pass"?"passed":step.status==="fail"?"failed":step.status==="skip"?"aborted":"failed"];
  const failMode = step.status==="fail"||step.status==="error";

  const tabs = [
    { k:"req" as const, l:`请求`, hide:!step.isApi },
    { k:"res" as const, l:`响应`, hide:!step.resStatus },
    { k:"assert" as const, l:`断言 (${step.assertions?.length??0})` },
    { k:"log" as const, l:"日志" },
    { k:"ai" as const, l:"AI 分析", badge:failMode },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0" style={{ backgroundColor:"rgba(29,33,41,0.45)" }} onClick={onClose}/>
      <div className="relative flex flex-col overflow-hidden" style={{ width:700, backgroundColor:"#fff", boxShadow:"-4px 0 28px rgba(0,0,0,0.14)" }}>
        {/* Colored accent on top */}
        <div className="h-0.5 flex-shrink-0" style={{ backgroundColor: failMode ? T.danger : T.success }}/>

        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 flex-shrink-0" style={{ borderBottom:`1px solid ${T.border}` }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor:"#F2F3F5", color:T.t2 }}>步骤 {step.seq}</span>
              <StepStatusDot status={step.status}/>
              <span className="text-[11px] font-semibold" style={{ color:sc.color }}>{{ pass:"执行通过", fail:"执行失败", skip:"已跳过", error:"执行异常" }[step.status]}</span>
              <span className="text-[11px] font-mono" style={{ color:T.t3 }}>{step.duration}</span>
            </div>
            <p className="text-[15px] font-semibold leading-snug" style={{ color:T.t1 }}>{step.name}</p>
            {step.url && <p className="text-[11px] font-mono mt-1 truncate" style={{ color:T.t3 }}>{step.url}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {failMode && <PBtn icon={Bug} onClick={()=>{}} color={T.danger} variant="ghost">关联缺陷</PBtn>}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors" style={{ color:T.t4 }}
              onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>
              <X size={15}/>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 px-5" style={{ borderBottom:`1px solid ${T.border}` }}>
          {tabs.filter(t=>!t.hide).map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)}
              className="relative h-10 px-4 text-[13px] font-medium border-b-2 transition-colors"
              style={{ borderBottomColor:tab===t.k?T.primary:"transparent", color:tab===t.k?T.primary:T.t3 }}>
              {t.l}
              {t.badge && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor:T.danger }}/>}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab==="req" && (
            <div className="space-y-4">
              {step.method && step.url ? (
                <>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color:T.t3 }}>请求地址</p>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor:"#F7F8FA", border:`1px solid ${T.border}` }}>
                      <MethodBadge method={step.method}/>
                      <code className="text-[12px] font-mono break-all flex-1" style={{ color:T.t1 }}>{step.url}</code>
                    </div>
                  </div>
                  {step.reqBody && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color:T.t3 }}>Request Body</p>
                      <CodeBlock content={step.reqBody} lang="json"/>
                    </div>
                  )}
                  {!step.reqBody && <p className="text-[13px] py-6 text-center" style={{ color:T.t3 }}>无 Request Body</p>}
                </>
              ) : (
                <p className="text-[13px] py-8 text-center" style={{ color:T.t3 }}>该步骤无请求信息</p>
              )}
            </div>
          )}

          {tab==="res" && (
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-[10px]" style={{ color:T.t3 }}>Status Code</p>
                  <span className="text-[22px] font-bold font-mono" style={{ color: (step.resStatus??0)<300 ? T.success : (step.resStatus??0)<500 ? T.warning : T.danger }}>{step.resStatus}</span>
                </div>
                <div>
                  <p className="text-[10px]" style={{ color:T.t3 }}>响应耗时</p>
                  <span className="text-[15px] font-mono font-semibold" style={{ color:T.t1 }}>{step.resDuration}</span>
                </div>
              </div>
              {step.resBody && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color:T.t3 }}>Response Body</p>
                  <CodeBlock content={step.resBody} lang="json"/>
                </div>
              )}
            </div>
          )}

          {tab==="assert" && (
            <div className="space-y-2.5">
              {step.assertions && step.assertions.length>0 ? (
                step.assertions.map((a,i) => (
                  <div key={i} className="rounded-xl overflow-hidden" style={{ border:`1px solid ${a.pass?T.success+"40":T.danger+"40"}` }}>
                    <div className="flex items-center gap-2.5 px-3 py-2" style={{ backgroundColor: a.pass?"#F6FFED":"#FFF8F8", borderBottom:`1px solid ${a.pass?T.success+"30":T.danger+"30"}` }}>
                      {a.pass ? <CheckCircle size={13} style={{ color:T.success }}/> : <XCircle size={13} style={{ color:T.danger }}/>}
                      <code className="text-[12px] font-mono font-semibold flex-1" style={{ color:T.t1 }}>{a.path}</code>
                      <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor:a.pass?T.success+"20":T.danger+"20", color:a.pass?T.success:T.danger }}>{a.pass?"通过":"失败"}</span>
                    </div>
                    <div className="px-3 py-2.5 grid grid-cols-3 gap-3" style={{ backgroundColor:"#FAFAFA" }}>
                      {[{l:"操作符",v:a.op,c:T.t2},{l:"期望值",v:a.expected,c:T.t1},{l:"实际值",v:a.actual,c:a.pass?T.success:T.danger}].map(f=>(
                        <div key={f.l}>
                          <p className="text-[10px] mb-1" style={{ color:T.t3 }}>{f.l}</p>
                          <code className="text-[12px] font-mono" style={{ color:f.c }}>{f.v}</code>
                        </div>
                      ))}
                    </div>
                    {a.msg && <div className="px-3 py-2" style={{ borderTop:`1px solid ${T.danger}20` }}><p className="text-[11px]" style={{ color:T.danger }}>{a.msg}</p></div>}
                  </div>
                ))
              ) : (
                <p className="text-[13px] py-8 text-center" style={{ color:T.t3 }}>该步骤无断言配置</p>
              )}
            </div>
          )}

          {tab==="log" && (
            step.errorLog
              ? <CodeBlock content={step.errorLog} lang="log"/>
              : (
                <div className="flex flex-col items-center justify-center py-10">
                  <CheckCircle size={26} style={{ color:T.success }} className="mb-2"/>
                  <p className="text-[13px]" style={{ color:T.t3 }}>该步骤执行成功，无错误日志</p>
                </div>
              )
          )}

          {tab==="ai" && (
            failMode
              ? <AiDiagPanel analysis={step.aiAnalysis}/>
              : (
                <div className="flex flex-col items-center justify-center py-10">
                  <Sparkles size={24} style={{ color:T.t4 }} className="mb-2"/>
                  <p className="text-[13px]" style={{ color:T.t3 }}>仅在步骤失败时提供 AI 分析</p>
                </div>
              )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Report List Page ─────────────────────────────────────────────────────────

export function ReportListPage({ onView, onShare }:{ onView:(r:ReportRecord)=>void; onShare:(r:ReportRecord)=>void }) {
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [statusF, setStatusF] = useState("all");

  const stats = [
    { l:"全部报告", v:REPORTS.length,                                    c:T.t1 },
    { l:"成功",     v:REPORTS.filter(r=>r.status==="passed").length,     c:T.success },
    { l:"失败",     v:REPORTS.filter(r=>r.status==="failed").length,     c:T.danger },
    { l:"中断 / 执行中", v:REPORTS.filter(r=>r.status==="aborted"||r.status==="running").length, c:T.warning },
  ];

  const rows = REPORTS.filter(r =>
    (typeF==="all"||r.type===typeF) &&
    (statusF==="all"||r.status===statusF) &&
    (!search||r.name.includes(search)||r.id.includes(search))
  );

  const trigLabel:Record<ReportTriggerMode,string> = { manual:"手动", scheduled:"定时", ci:"CI/CD" };

  return (
    <div className="flex-1 overflow-y-auto p-5">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {stats.map(s=>(
          <div key={s.l} className="bg-white rounded-xl px-5 py-4 flex items-center gap-4" style={{ border:`1px solid ${T.border}` }}>
            <div>
              <p className="text-[26px] font-bold leading-none" style={{ color:s.c }}>{s.v}</p>
              <p className="text-[11px] mt-1.5" style={{ color:T.t3 }}>{s.l}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        <Inp placeholder="搜索报告名称或 ID" prefix={<Search size={13}/>} width={220} value={search} onChange={setSearch}/>
        <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{ borderColor:T.border, color:T.t1, width:120 }} onChange={e=>setTypeF(e.target.value)}>
          <option value="all">全部类型</option>
          <option value="api-scene">接口场景</option>
          <option value="api-suite">接口套件</option>
          <option value="webui-case">Web UI 用例</option>
          <option value="webui-suite">Web UI 套件</option>
        </select>
        <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{ borderColor:T.border, color:T.t1, width:110 }} onChange={e=>setStatusF(e.target.value)}>
          <option value="all">全部状态</option>
          <option value="passed">成功</option>
          <option value="failed">失败</option>
          <option value="running">执行中</option>
          <option value="aborted">已中断</option>
        </select>
        <div className="flex-1"/>
        <PBtn icon={Download} onClick={()=>{}} variant="ghost">批量导出</PBtn>
        <PBtn icon={Play} onClick={()=>{}}>立即执行</PBtn>
      </div>

      {/* Table */}
      {rows.length > 0 ? (
        <ETable total={rows.length} cols={[
          { label:"报告 ID",   width:"13%" },
          { label:"报告名称 / 触发", width:"20%" },
          { label:"类型",      width:"9%" },
          { label:"状态",      width:"8%" },
          { label:"通过率",    width:"12%" },
          { label:"步骤统计",  width:"11%" },
          { label:"耗时",      width:"6%" },
          { label:"执行人",    width:"6%" },
          { label:"环境",      width:"6%" },
          { label:"开始时间",  width:"9%", align:"right" as const },
        ]}>
          {rows.map(r => {
            const sc = RPT_STATUS[r.status];
            return (
              <TR key={r.id} onClick={()=>onView(r)}>
                <TD mono><span className="text-[11px]" style={{ color:T.t3 }}>{r.id}</span></TD>
                <TD>
                  <p className="font-medium truncate max-w-[160px]" style={{ color:T.t1 }}>{r.name}</p>
                  <span className="text-[11px]" style={{ color:T.t3 }}>{trigLabel[r.trigger]}</span>
                </TD>
                <TD><RptTypeBadge type={r.type}/></TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor:sc.dot }}/>
                    <span className="text-[12px] font-medium" style={{ color:sc.color }}>{sc.label}</span>
                  </span>
                </TD>
                <TD><PassBar rate={r.passRate}/></TD>
                <TD>
                  <div className="flex items-center gap-1.5 text-[12px]">
                    <span style={{ color:T.success }}>{r.passSteps}✓</span>
                    {r.failSteps>0&&<span style={{ color:T.danger }}>{r.failSteps}✗</span>}
                    {r.skipSteps>0&&<span style={{ color:T.t3 }}>{r.skipSteps}—</span>}
                  </div>
                </TD>
                <TD mono muted>{r.duration}</TD>
                <TD muted>{r.executor}</TD>
                <TD><span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor:"#F2F3F5", color:T.t3 }}>{r.env}</span></TD>
                <TD align="right">
                  <div className="flex items-center justify-end">
                    <IBtn icon={Eye}    label="查看详情" onClick={()=>onView(r)}/>
                    <IBtn icon={Share2} label="分享"     onClick={()=>onShare(r)}/>
                    <IBtn icon={Copy}   label="复制链接" onClick={()=>{}}/>
                    <IBtn icon={Trash2} label="删除"     danger onClick={()=>{}}/>
                  </div>
                </TD>
              </TR>
            );
          })}
        </ETable>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl" style={{ border:`1px solid ${T.border}` }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor:"#F2F3F5" }}>
            <ClipboardList size={26} style={{ color:T.t4 }}/>
          </div>
          <p className="text-[14px] font-medium" style={{ color:T.t2 }}>没有找到匹配的报告</p>
          <p className="text-[12px] mt-1" style={{ color:T.t3 }}>调整筛选条件或执行用例生成第一份报告</p>
        </div>
      )}
    </div>
  );
}

// ─── Report Detail Page ───────────────────────────────────────────────────────

export function ReportDetailPage({ report, onBack, onShare }:{ report:ReportRecord; onBack:()=>void; onShare:()=>void }) {
  const detail = REPORT_DETAIL;
  const [selStep, setSelStep]     = useState<RStep|null>(null);
  const [drawerStep, setDrawerStep] = useState<RStep|null>(null);
  const [failOnly, setFailOnly]   = useState(false);

  const sc = RPT_STATUS[detail.status];
  const passColor = detail.passRate>=90 ? T.success : detail.passRate>=70 ? T.warning : T.danger;
  const failCount = detail.steps.filter(s=>s.status==="fail"||s.status==="error").length;
  const filteredSteps = failOnly ? detail.steps.filter(s=>s.status==="fail"||s.status==="error") : detail.steps;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Overview bar */}
      <div className="flex-shrink-0 bg-white px-5 py-3" style={{ borderBottom:`1px solid ${T.border}` }}>
        {/* Breadcrumb + actions */}
        <div className="flex items-center gap-2 mb-2.5">
          <button onClick={onBack} className="flex items-center gap-1 text-[12px] transition-colors" style={{ color:T.t3 }}
            onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
            <ChevronLeft size={13}/> 报告列表
          </button>
          <ChevronRight size={12} style={{ color:T.t4 }}/>
          <span className="text-[13px] font-medium truncate max-w-[320px]" style={{ color:T.t1 }}>{detail.name}</span>
          <div className="flex-1"/>
          <PBtn icon={Share2}   onClick={onShare}  variant="ghost">分享报告</PBtn>
          <PBtn icon={Download} onClick={()=>{}}   variant="ghost">导出</PBtn>
          <PBtn icon={Play}     onClick={()=>{}}   variant="ghost">重新执行</PBtn>
        </div>

        {/* Metric strip */}
        <div className="flex items-center gap-5 flex-wrap">
          {/* Status pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ backgroundColor:sc.bg }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor:sc.dot }}/>
            <span className="text-[13px] font-bold" style={{ color:sc.color }}>{sc.label}</span>
          </div>

          {/* Pass rate */}
          <div className="flex items-baseline gap-1">
            <span className="text-[22px] font-bold font-mono" style={{ color:passColor }}>{detail.passRate.toFixed(1)}%</span>
            <span className="text-[11px]" style={{ color:T.t3 }}>通过率</span>
          </div>

          <div className="h-4 w-px flex-shrink-0" style={{ backgroundColor:T.border }}/>

          {/* Step counts */}
          <div className="flex items-center gap-3 text-[12px]">
            <span style={{ color:T.t2 }}>总步骤 <b style={{ color:T.t1 }}>{detail.totalSteps}</b></span>
            <span style={{ color:T.success }}>成功 <b>{detail.passSteps}</b></span>
            {detail.failSteps>0 && <span style={{ color:T.danger }}>失败 <b>{detail.failSteps}</b></span>}
            {detail.skipSteps>0 && <span style={{ color:T.t3 }}>跳过 <b>{detail.skipSteps}</b></span>}
          </div>

          <div className="h-4 w-px flex-shrink-0" style={{ backgroundColor:T.border }}/>

          {/* Meta fields */}
          {([
            { l:"耗时",     v:detail.duration },
            { l:"执行环境", v:detail.env },
            { l:"执行人",   v:detail.executor },
            { l:"触发方式", v:{ manual:"手动触发", scheduled:"定时触发", ci:"CI/CD" }[detail.trigger] },
            { l:"开始",     v:detail.startAt.slice(5,16) },
          ] as const).map(f=>(
            <div key={f.l} className="flex-shrink-0">
              <p className="text-[10px]" style={{ color:T.t3 }}>{f.l}</p>
              <p className="text-[12px] font-medium" style={{ color:T.t2 }}>{f.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: step rail */}
        <div className="flex-shrink-0 flex flex-col bg-white overflow-hidden" style={{ width:296, borderRight:`1px solid ${T.border}` }}>
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ borderBottom:`1px solid ${T.border}` }}>
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color:T.t3 }}>步骤 ({detail.steps.length})</span>
            <button onClick={()=>setFailOnly(!failOnly)}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
              style={{ backgroundColor:failOnly?`${T.danger}12`:"transparent", color:failOnly?T.danger:T.t3, border:`1px solid ${failOnly?T.danger+"40":T.border}` }}>
              <Filter size={9}/> {failOnly?`失败 (${failCount})`:"全部"}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredSteps.map(step=>{
              const isFail = step.status==="fail"||step.status==="error";
              const isSel  = selStep?.id===step.id;
              return (
                <button key={step.id} onClick={()=>setSelStep(step)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 border-b text-left transition-all"
                  style={{
                    borderColor:T.border,
                    borderLeft:`3px solid ${isFail?T.danger:isSel?T.primary:"transparent"}`,
                    backgroundColor: isSel?`${T.primary}08` : isFail?`${T.danger}04`:"transparent",
                  }}
                  onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.backgroundColor=isFail?`${T.danger}08`:"#FAFBFF"; }}
                  onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.backgroundColor=isFail?`${T.danger}04`:"transparent"; }}>
                  <StepStatusDot status={step.status}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] truncate" style={{ color:isSel?T.t1:T.t2, fontWeight:isSel?500:400 }}>{step.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {step.method && <MethodBadge method={step.method}/>}
                      <span className="text-[10px] font-mono" style={{ color:T.t4 }}>{step.duration}</span>
                    </div>
                  </div>
                  <button onClick={e=>{ e.stopPropagation(); setDrawerStep(step); }}
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                    style={{ color:T.t3 }} title="展开详情">
                    <ExternalLink size={10}/>
                  </button>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: step content */}
        <div className="flex-1 overflow-y-auto p-5" style={{ backgroundColor:T.bg }}>
          {selStep ? (
            <div className="space-y-4">
              {/* Step header card */}
              <div className="bg-white rounded-xl p-4" style={{ border:`1px solid ${T.border}` }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor:"#F2F3F5", color:T.t2 }}>步骤 {selStep.seq}</span>
                      <StepStatusDot status={selStep.status}/>
                      <span className="text-[12px] font-semibold" style={{ color:{ pass:T.success, fail:T.danger, skip:T.t3, error:T.warning }[selStep.status] }}>
                        {{ pass:"执行通过", fail:"执行失败", skip:"已跳过", error:"执行异常" }[selStep.status]}
                      </span>
                      <span className="text-[11px] font-mono" style={{ color:T.t3 }}>{selStep.duration}</span>
                    </div>
                    <p className="text-[14px] font-semibold" style={{ color:T.t1 }}>{selStep.name}</p>
                    {selStep.url && (
                      <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg" style={{ backgroundColor:"#F7F8FA" }}>
                        {selStep.method && <MethodBadge method={selStep.method}/>}
                        <code className="text-[11px] font-mono break-all" style={{ color:T.t2 }}>{selStep.url}</code>
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setDrawerStep(selStep)}
                    className="ml-3 flex-shrink-0 flex items-center gap-1.5 text-[12px] h-7 px-3 rounded-lg border transition-colors"
                    style={{ borderColor:T.border, color:T.t3 }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor=T.primary; e.currentTarget.style.color=T.primary; }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border;  e.currentTarget.style.color=T.t3; }}>
                    <ExternalLink size={11}/> 展开详情
                  </button>
                </div>
              </div>

              {/* Assertions */}
              {selStep.assertions && selStep.assertions.length>0 && (
                <div className="bg-white rounded-xl p-4" style={{ border:`1px solid ${T.border}` }}>
                  <p className="text-[12px] font-semibold mb-3" style={{ color:T.t2 }}>断言结果 ({selStep.assertions.length})</p>
                  <div className="space-y-2">
                    {selStep.assertions.map((a,i)=>(
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor:a.pass?"#F6FFED":"#FFF8F8" }}>
                        {a.pass ? <CheckCircle size={13} style={{ color:T.success }}/> : <XCircle size={13} style={{ color:T.danger }}/>}
                        <code className="text-[12px] font-mono flex-1" style={{ color:T.t1 }}>{a.path}</code>
                        <span className="text-[11px]" style={{ color:T.t3 }}>{a.op}</span>
                        <code className="text-[12px] font-mono" style={{ color:a.pass?T.success:T.danger }}>{a.actual}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Response status + error log */}
              {selStep.resStatus && (
                <div className="bg-white rounded-xl p-4" style={{ border:`1px solid ${T.border}` }}>
                  <p className="text-[12px] font-semibold mb-3" style={{ color:T.t2 }}>响应摘要</p>
                  <div className="flex items-center gap-6 mb-3">
                    <div>
                      <p className="text-[10px]" style={{ color:T.t3 }}>Status Code</p>
                      <span className="text-[20px] font-bold font-mono" style={{ color:selStep.resStatus<300?T.success:selStep.resStatus<500?T.warning:T.danger }}>{selStep.resStatus}</span>
                    </div>
                    {selStep.resDuration && <div>
                      <p className="text-[10px]" style={{ color:T.t3 }}>响应耗时</p>
                      <span className="text-[14px] font-mono font-semibold" style={{ color:T.t1 }}>{selStep.resDuration}</span>
                    </div>}
                  </div>
                  {selStep.resBody && <CodeBlock content={selStep.resBody} lang="json"/>}
                </div>
              )}

              {/* Error log */}
              {selStep.errorLog && (
                <div className="bg-white rounded-xl p-4" style={{ border:`1px solid ${T.danger}30` }}>
                  <p className="text-[12px] font-semibold mb-3 flex items-center gap-1.5" style={{ color:T.danger }}>
                    <AlertTriangle size={13}/> 错误日志
                  </p>
                  <CodeBlock content={selStep.errorLog} lang="log"/>
                </div>
              )}

              {/* AI Analysis */}
              {(selStep.status==="fail"||selStep.status==="error") && (
                <div className="bg-white rounded-xl p-4" style={{ border:`1px solid ${T.border}` }}>
                  <p className="text-[12px] font-semibold mb-3" style={{ color:T.t2 }}>AI 失败诊断</p>
                  <AiDiagPanel analysis={selStep.aiAnalysis}/>
                </div>
              )}

              {selStep.status==="pass" && !selStep.errorLog && (
                <div className="bg-white rounded-xl p-6 flex flex-col items-center" style={{ border:`1px solid ${T.border}` }}>
                  <CheckCircle size={26} style={{ color:T.success }} className="mb-2"/>
                  <p className="text-[13px]" style={{ color:T.t2 }}>步骤执行通过</p>
                  <p className="text-[12px] mt-0.5" style={{ color:T.t3 }}>点击「展开详情」查看完整请求和响应</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor:"#F2F3F5" }}>
                <ClipboardList size={22} style={{ color:T.t4 }}/>
              </div>
              <p className="text-[13px]" style={{ color:T.t3 }}>选择左侧步骤查看执行详情</p>
              {failCount>0 && (
                <button onClick={()=>setFailOnly(true)} className="mt-2 text-[12px] transition-colors" style={{ color:T.primary }}>
                  仅查看失败步骤 ({failCount})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {drawerStep && <StepDetailDrawer step={drawerStep} onClose={()=>setDrawerStep(null)}/>}
    </div>
  );
}

// ─── Share Report Page ────────────────────────────────────────────────────────

export function ShareReportPage({ onBack }:{ onBack:()=>void }) {
  const detail = REPORT_DETAIL;
  const [expandedStep, setExpandedStep] = useState<string|null>("s4");
  const sc = RPT_STATUS[detail.status];
  const passColor = detail.passRate>=90 ? T.success : detail.passRate>=70 ? T.warning : T.danger;

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor:"#F4F6FA" }}>
      {/* Minimal top bar */}
      <div className="bg-white sticky top-0 z-10" style={{ borderBottom:`1px solid ${T.border}` }}>
        <div className="max-w-[860px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:`linear-gradient(135deg,${T.primary},#4F8EFF)` }}>
              <FlaskConical size={14} color="#fff"/>
            </div>
            <span className="text-[13px] font-medium" style={{ color:T.t2 }}>AutoTest · 分享报告</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 h-7 px-3 rounded-lg border text-[12px]" style={{ borderColor:T.border, color:T.t2 }}>
              <Copy size={11}/> 复制链接
            </button>
            <button className="flex items-center gap-1.5 h-7 px-3 rounded-lg border text-[12px]" style={{ borderColor:T.border, color:T.t2 }}>
              <Download size={11}/> 导出 PDF
            </button>
            <button onClick={onBack} className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-medium" style={{ backgroundColor:T.primary, color:"#fff" }}>
              进入后台
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[860px] mx-auto px-6 py-6 space-y-4">
        {/* Status card */}
        <div className="bg-white rounded-2xl p-6" style={{ border:`1px solid ${T.border}`, boxShadow:"0 2px 10px rgba(0,0,0,0.04)" }}>
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <RptTypeBadge type={detail.type}/>
                <span className="text-[12px]" style={{ color:T.t3 }}>{{ manual:"手动触发", scheduled:"定时触发", ci:"CI/CD 触发" }[detail.trigger]}</span>
              </div>
              <h1 className="text-[20px] font-bold mb-4" style={{ color:T.t1 }}>{detail.name}</h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor:sc.bg }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor:sc.dot }}/>
                  <span className="text-[15px] font-bold" style={{ color:sc.color }}>{sc.label}</span>
                </div>
                <div>
                  <span className="text-[28px] font-bold font-mono" style={{ color:passColor }}>{detail.passRate.toFixed(1)}%</span>
                  <span className="text-[12px] ml-1" style={{ color:T.t3 }}>通过率</span>
                </div>
              </div>
            </div>
            {/* Stat boxes */}
            <div className="flex gap-3 flex-shrink-0">
              {[
                { l:"总步骤", v:detail.totalSteps, c:T.t1 },
                { l:"成功",   v:detail.passSteps,  c:T.success },
                { l:"失败",   v:detail.failSteps,  c:T.danger },
                { l:"跳过",   v:detail.skipSteps,  c:T.t3 },
              ].map(s=>(
                <div key={s.l} className="text-center px-4 py-3 rounded-xl" style={{ backgroundColor:"#F7F8FA", minWidth:56 }}>
                  <p className="text-[22px] font-bold" style={{ color:s.c }}>{s.v}</p>
                  <p className="text-[10px] mt-0.5" style={{ color:T.t3 }}>{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-6 flex-wrap mt-5 pt-4" style={{ borderTop:`1px solid ${T.border}` }}>
            {([
              { l:"执行环境", v:detail.env },
              { l:"执行人",   v:detail.executor },
              { l:"总耗时",   v:detail.duration },
              { l:"开始时间", v:detail.startAt },
              { l:"结束时间", v:detail.endAt },
            ] as const).map(f=>(
              <div key={f.l}>
                <p className="text-[10px]" style={{ color:T.t3 }}>{f.l}</p>
                <p className="text-[12px] font-medium" style={{ color:T.t2 }}>{f.v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border:`1px solid ${T.border}`, boxShadow:"0 2px 10px rgba(0,0,0,0.04)" }}>
          <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom:`1px solid ${T.border}` }}>
            <p className="text-[13px] font-semibold" style={{ color:T.t1 }}>步骤执行详情</p>
            <span className="text-[12px]" style={{ color:T.t3 }}>{detail.steps.length} 个步骤 · 点击步骤查看证据</span>
          </div>

          {detail.steps.map((step,idx)=>{
            const isFail = step.status==="fail"||step.status==="error";
            const isOpen = expandedStep===step.id;
            const leftColor = step.status==="pass" ? T.success : isFail ? T.danger : "#C9CDD4";
            return (
              <div key={step.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                <button onClick={()=>setExpandedStep(isOpen?null:step.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                  style={{
                    borderLeft:`3px solid ${leftColor}`,
                    backgroundColor: isOpen ? "#FAFBFF" : isFail ? `${T.danger}04` : "transparent",
                  }}
                  onMouseEnter={e=>{ if(!isOpen) e.currentTarget.style.backgroundColor=isFail?`${T.danger}06`:"#FAFBFF"; }}
                  onMouseLeave={e=>{ if(!isOpen) e.currentTarget.style.backgroundColor=isFail?`${T.danger}04`:"transparent"; }}>
                  <StepStatusDot status={step.status}/>
                  <span className="w-5 text-[11px] font-mono flex-shrink-0" style={{ color:T.t4 }}>{step.seq}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium" style={{ color:T.t1 }}>{step.name}</p>
                    {step.url && <p className="text-[11px] font-mono truncate mt-0.5" style={{ color:T.t3 }}>{step.url}</p>}
                  </div>
                  {step.method && <MethodBadge method={step.method}/>}
                  {step.resStatus && (
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: step.resStatus<300?"#E8FFEA":step.resStatus<500?"#FFF3E8":"#FFE8E8", color: step.resStatus<300?T.success:step.resStatus<500?T.warning:T.danger }}>{step.resStatus}</span>
                  )}
                  <span className="text-[11px] font-mono w-12 text-right flex-shrink-0" style={{ color:T.t3 }}>{step.duration}</span>
                  <ChevronDown size={13} style={{ color:T.t4, transform:isOpen?"rotate(180deg)":"", transition:"transform 0.2s", flexShrink:0 }}/>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-3 space-y-3" style={{ backgroundColor:"#FAFBFF" }}>
                    {/* Assertions */}
                    {step.assertions && step.assertions.length>0 && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color:T.t3 }}>断言结果</p>
                        <div className="space-y-1.5">
                          {step.assertions.map((a,i)=>(
                            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg text-[12px]" style={{ backgroundColor:a.pass?"#F6FFED":"#FFF8F8" }}>
                              {a.pass ? <CheckCircle size={12} style={{ color:T.success }}/> : <XCircle size={12} style={{ color:T.danger }}/>}
                              <code className="font-mono flex-1">{a.path}</code>
                              <span style={{ color:T.t3 }}>{a.op}</span>
                              <code className="font-mono" style={{ color:a.pass?T.success:T.danger }}>{a.actual}</code>
                              {!a.pass && a.msg && <span style={{ color:T.danger }}>{a.msg}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error log */}
                    {step.errorLog && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color:T.t3 }}>错误日志</p>
                        <CodeBlock content={step.errorLog} lang="log"/>
                      </div>
                    )}

                    {/* Response body */}
                    {step.resBody && step.status!=="skip" && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color:T.t3 }}>Response Body</p>
                        <CodeBlock content={step.resBody} lang="json"/>
                      </div>
                    )}

                    {/* AI Analysis (share mode) */}
                    {isFail && <AiDiagPanel analysis={step.aiAnalysis}/>}

                    {step.status==="pass" && !step.assertions && !step.errorLog && (
                      <p className="text-[12px] py-2 text-center" style={{ color:T.t3 }}>步骤执行通过，无附加信息</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-center text-[12px] pb-4" style={{ color:T.t3 }}>由 AutoTest 平台生成 · {detail.startAt}</p>
      </div>
    </div>
  );
}

// ─── Report Module Container ──────────────────────────────────────────────────
