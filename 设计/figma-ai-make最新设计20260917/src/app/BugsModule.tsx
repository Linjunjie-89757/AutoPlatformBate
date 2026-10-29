import React, { useState, useEffect } from "react";
import {
  Plus, Eye, Edit2, Trash2, Search, RefreshCw, CheckCircle, AlertTriangle,
  Zap, Bug, Send, Upload, ChevronLeft, LayoutGrid, Folder, X, UserCheck,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from "recharts";

// ─── Shared palette (mirrored from App.tsx) ────────────────────────────────────

const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  cyan:"#0FC6C2",
  slate:"#4E5969",   bg:"#F4F6FA",      border:"#E5E6EB",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};

type Priority = "P0"|"P1"|"P2"|"P3"|"P4";

const PRIORITY_STYLE: Record<Priority,{bg:string;color:string}> = {
  P0:{bg:"#F53F3F",color:"#fff"},P1:{bg:"#FF7D00",color:"#fff"},
  P2:{bg:"#FAAD14",color:"#fff"},P3:{bg:"#165DFF",color:"#fff"},P4:{bg:"#C9CDD4",color:"#4E5969"},
};

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

function IcoSquare({color,bg,size=32,children}:{color:string;bg:string;size?:number;children:React.ReactNode}){
  return <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{width:size,height:size,backgroundColor:bg}}><span style={{color,display:"flex"}}>{children}</span></div>;
}

function PBtn({children,onClick,icon:Icon,small,color=T.primary,variant="primary"}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;variant?:"primary"|"ghost"}){
  const ghost=variant==="ghost";
  return(
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-all ${small?"h-7 px-2.5 text-[12px]":"h-8 px-3 text-[13px]"}`}
      style={{backgroundColor:ghost?"transparent":color,color:ghost?T.t2:"#fff",border:`1px solid ${ghost?T.border:"transparent"}`}}
      onMouseEnter={e=>{if(ghost){e.currentTarget.style.backgroundColor=T.bg;e.currentTarget.style.color=T.t1;}}}
      onMouseLeave={e=>{if(ghost){e.currentTarget.style.backgroundColor="transparent";e.currentTarget.style.color=T.t2;}}}>
      {Icon&&<Icon size={small?11:13}/>}{children}
    </button>
  );
}

function IBtn({icon:Icon,label,danger,onClick}:{icon:React.ElementType;label:string;danger?:boolean;onClick?:()=>void}){
  return(
    <button title={label} onClick={e=>{e.stopPropagation();onClick?.();}}
      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
      style={{color:T.t4}}
      onMouseEnter={e=>{e.currentTarget.style.color=danger?T.danger:T.t1;e.currentTarget.style.backgroundColor=danger?"#FFF0F0":"#F2F3F5";}}
      onMouseLeave={e=>{e.currentTarget.style.color=T.t4;e.currentTarget.style.backgroundColor="transparent";}}>
      <Icon size={13}/>
    </button>
  );
}

function Inp({placeholder,prefix,mono,width,value,onChange}:{placeholder?:string;prefix?:React.ReactNode;mono?:boolean;width?:string|number;value?:string;onChange?:(v:string)=>void}){
  return(
    <div className="relative flex items-center" style={{width}}>
      {prefix&&<span className="absolute left-2.5 pointer-events-none" style={{color:T.t3}}>{prefix}</span>}
      <input placeholder={placeholder} value={value} onChange={e=>onChange?.(e.target.value)}
        className={`h-8 border rounded-lg bg-white text-[13px] outline-none transition-all w-full ${prefix?"pl-8 pr-3":"px-3"} ${mono?"font-mono text-[12px]":""}`}
        style={{borderColor:T.border,color:T.t1}}
        onFocus={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.primary}18`;}}
        onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
    </div>
  );
}

function Sel({children,width=130}:{children:React.ReactNode;width?:number}){
  return <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width}}>{children}</select>;
}

interface Col { label:string; width?:string; align?:"left"|"right"|"center"; }
function ETable({cols,children,total}:{cols:Col[];children:React.ReactNode;total?:number}){
  const [page,setPage]=useState(1);
  const pages=total?Math.max(1,Math.ceil(total/10)):1;
  return(
    <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
      <table className="w-full border-collapse">
        <thead>
          <tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
            {cols.map((c,i)=><th key={i} style={{width:c.width,textAlign:c.align??"left",color:T.t3}} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {total!==undefined&&(
        <div className="flex items-center justify-between px-4 py-2.5" style={{borderTop:`1px solid ${T.border}`}}>
          <span className="text-[12px]" style={{color:T.t3}}>共 {total} 条</span>
          <div className="flex items-center gap-1">
            {Array.from({length:pages}).map((_,i)=>(
              <button key={i} onClick={()=>setPage(i+1)} className="w-7 h-7 rounded-md text-[12px] font-medium"
                style={{backgroundColor:page===i+1?T.primary:"transparent",color:page===i+1?"#fff":T.t2,border:`1px solid ${page===i+1?T.primary:T.border}`}}>
                {i+1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TR({children,active,onClick}:{children:React.ReactNode;active?:boolean;onClick?:()=>void}){
  return(
    <tr onClick={onClick} className="border-b last:border-b-0 transition-colors"
      style={{borderColor:T.border,height:46,backgroundColor:active?`${T.primary}08`:"",cursor:onClick?"pointer":"default"}}
      onMouseEnter={e=>!active&&(e.currentTarget.style.backgroundColor="#FAFBFF")}
      onMouseLeave={e=>!active&&(e.currentTarget.style.backgroundColor="")}>
      {children}
    </tr>
  );
}

function TD({children,align="left",mono,muted}:{children?:React.ReactNode;align?:"left"|"right"|"center";mono?:boolean;muted?:boolean}){
  return <td className={`px-4 py-2 text-[13px] ${mono?"font-mono text-[12px]":""}`} style={{textAlign:align,color:muted?T.t3:T.t1}}>{children}</td>;
}

function PageHead({title,desc}:{title:string;desc:string}){
  return <div className="mb-5"><h2 className="text-[16px] font-semibold" style={{color:T.t1}}>{title}</h2><p className="text-[12px] mt-0.5" style={{color:T.t3}}>{desc}</p></div>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUGS MODULE
// ═══════════════════════════════════════════════════════════════════════════════

type BugStatus   = "new"|"assigned"|"in-progress"|"pending-verify"|"closed"|"rejected";
type BugSeverity = "critical"|"major"|"minor"|"trivial";

interface Bug {
  id:string; title:string; status:BugStatus; severity:BugSeverity; priority:Priority;
  assignee:string; creator:string; module:string; relatedCase:string|null;
  createdAt:string; updatedAt:string; description:string; steps:string[];
  expected:string; actual:string; tags:string[];
}
interface BugHistoryItem { id:number; from:BugStatus|null; to:BugStatus; operator:string; note:string; time:string; }
interface BugComment { id:number; author:string; content:string; createdAt:string; }

const BUG_STATUS_CFG:Record<BugStatus,{label:string;bg:string;color:string}> = {
  "new":            {label:"新建",   bg:"#E8F3FF",color:"#165DFF"},
  "assigned":       {label:"已指派", bg:"#F5E8FF",color:"#7816FF"},
  "in-progress":    {label:"处理中", bg:"#FFF3E8",color:"#FF7D00"},
  "pending-verify": {label:"待验证", bg:"#FFFBE8",color:"#C89B00"},
  "closed":         {label:"已关闭", bg:"#E8FFEA",color:"#00B42A"},
  "rejected":       {label:"已驳回", bg:"#FFE8E8",color:"#F53F3F"},
};
const BUG_SEVERITY_CFG:Record<BugSeverity,{label:string;border:string;color:string;dot:string}> = {
  "critical":{label:"致命",border:"#F53F3F",color:"#F53F3F",dot:"#F53F3F"},
  "major":   {label:"严重",border:"#FF7D00",color:"#FF7D00",dot:"#FF7D00"},
  "minor":   {label:"一般",border:"#FAAD14",color:"#FAAD14",dot:"#FAAD14"},
  "trivial": {label:"轻微",border:"#86909C",color:"#86909C",dot:"#86909C"},
};
const STATUS_NEXT:Record<BugStatus,{to:BugStatus;label:string;color:string}[]> = {
  "new":            [{to:"assigned",       label:"指派处理",  color:"#7816FF"}],
  "assigned":       [{to:"in-progress",    label:"开始处理",  color:T.warning},{to:"closed",label:"直接关闭",color:T.success}],
  "in-progress":    [{to:"pending-verify", label:"提交验证",  color:"#C89B00"},{to:"closed",label:"直接关闭",color:T.success}],
  "pending-verify": [{to:"closed",         label:"验证通过",  color:T.success},{to:"rejected",label:"验证驳回",color:T.danger}],
  "closed":         [{to:"assigned",       label:"重新打开",  color:"#7816FF"}],
  "rejected":       [{to:"assigned",       label:"重新指派",  color:"#7816FF"},{to:"in-progress",label:"重新处理",color:T.warning}],
};

const BUGS_DATA:Bug[] = [
  {id:"BUG-001",title:"用户登录后首页数据不刷新，需要手动 reload",status:"in-progress",severity:"major",priority:"P1",assignee:"李明",creator:"张程远",module:"用户中心",relatedCase:"Case-07-44",createdAt:"2026-07-01 10:20",updatedAt:"2026-07-03 14:30",description:"用户登录成功后跳转至首页，首页的统计数据不会自动更新，仍然显示上一次访问的缓存数据，直到手动刷新页面才恢复正常。该问题在 Chrome 110+ 版本稳定复现。",steps:["打开平台登录页","输入正确的账号和密码","点击登录按钮，系统跳转至首页","观察首页各模块的统计数据是否刷新"],expected:"首页数据应在登录成功后自动刷新，显示最新统计信息",actual:"首页仍然显示旧的缓存数据，需要手动 Ctrl+Shift+R 强制刷新",tags:["首页","缓存"]},
  {id:"BUG-002",title:"订单导出 Excel 时金额字段小数点丢失",status:"pending-verify",severity:"major",priority:"P1",assignee:"王芳",creator:"张程远",module:"订单中心",relatedCase:"Case-01-40",createdAt:"2026-07-01 14:35",updatedAt:"2026-07-04 09:10",description:"导出订单列表时，金额字段（如 299.50）在 Excel 中显示为整数（299），小数部分被截断，影响财务对账准确性。",steps:["进入订单管理页","筛选有小数金额的订单","点击导出 Excel","打开导出文件查看金额列"],expected:"导出金额保留两位小数，如 299.50",actual:"金额显示为 299，小数丢失",tags:["导出","Excel","金额"]},
  {id:"BUG-003",title:"批量删除操作无确认弹窗直接执行，存在误操作风险",status:"assigned",severity:"critical",priority:"P0",assignee:"陈伟",creator:"李明",module:"获客中心",relatedCase:null,createdAt:"2026-07-02 09:15",updatedAt:"2026-07-02 11:30",description:"在产品管理页，选中多条记录后点击批量删除，系统没有弹出确认对话框直接执行删除操作，存在严重误操作风险。",steps:["进入获客中心-产品管理","选中多条产品记录","点击批量删除按钮","观察系统行为"],expected:"应弹出确认对话框，用户二次确认后才执行删除",actual:"系统直接执行删除，无任何确认提示",tags:["批量操作","UX","风险"]},
  {id:"BUG-004",title:"搜索框输入特殊字符 % 导致 500 错误",status:"closed",severity:"critical",priority:"P0",assignee:"李明",creator:"王芳",module:"用户中心",relatedCase:"Case-03-25",createdAt:"2026-06-28 16:40",updatedAt:"2026-07-01 10:00",description:"在用户搜索框中输入 % 等 SQL 特殊字符后，接口返回 500 Internal Server Error，页面出现空白，存在 SQL 注入风险。",steps:["进入用户管理页","在搜索框输入 %","点击搜索"],expected:"正确处理特殊字符，返回空列表或提示无结果",actual:"接口返回 500 错误，页面白屏",tags:["安全","SQL注入"]},
  {id:"BUG-005",title:"风控规则编辑页在 Firefox 下布局错乱",status:"new",severity:"minor",priority:"P2",assignee:"",creator:"陈伟",module:"风控中心",relatedCase:null,createdAt:"2026-07-03 11:20",updatedAt:"2026-07-03 11:20",description:"风控规则编辑页的表单在 Firefox 124 版本下输入框和标签错位，部分按钮被遮挡。Chrome 和 Safari 不受影响。",steps:["使用 Firefox 124 打开平台","进入风控中心-规则管理","打开任意规则编辑页","观察布局"],expected:"各浏览器布局一致，操作正常",actual:"Firefox 下表单布局错乱",tags:["兼容性","Firefox"]},
  {id:"BUG-006",title:"报告下载链接过期后无任何提示信息",status:"rejected",severity:"minor",priority:"P3",assignee:"张程远",creator:"王芳",module:"报告",relatedCase:null,createdAt:"2026-07-02 15:00",updatedAt:"2026-07-03 09:00",description:"测试报告下载链接有效期 24 小时，过期后点击下载失败且无任何提示，用户不知道需要重新生成。",steps:["生成一份测试报告","等待 24 小时","进入报告列表","点击下载按钮"],expected:"过期后提示链接已失效，并提供重新生成入口",actual:"下载失败，没有任何提示",tags:["报告","下载","体验"]},
  {id:"BUG-007",title:"接口用例批量执行时进度条不实时更新",status:"in-progress",severity:"major",priority:"P1",assignee:"王芳",creator:"陈伟",module:"接口自动化",relatedCase:"Case-05-31",createdAt:"2026-07-03 09:30",updatedAt:"2026-07-04 10:15",description:"对包含 20+ 个用例的套件执行批量运行时，进度条一直保持 0%，所有用例执行完成后才一次性跳到 100%。",steps:["进入执行套件页","选择 20+ 用例的套件","点击运行","观察进度条变化"],expected:"进度条随用例执行逐步更新",actual:"进度条一直 0%，执行完成才跳至 100%",tags:["套件","进度条","实时反馈"]},
  {id:"BUG-008",title:"iOS 16 下表单底部按钮被虚拟键盘遮挡",status:"new",severity:"trivial",priority:"P3",assignee:"",creator:"李明",module:"Web UI 自动化",relatedCase:null,createdAt:"2026-07-04 14:00",updatedAt:"2026-07-04 14:00",description:"在 iOS 16 的 Safari 下，点击输入框弹出虚拟键盘后，底部操作按钮被遮挡，需要滚动才能点击。",steps:["iPhone iOS 16，打开平台","进入包含底部按钮的表单","点击输入框弹出键盘","尝试点击底部按钮"],expected:"底部按钮始终可见或自动上移",actual:"按钮被键盘遮挡",tags:["移动端","iOS"]},
];

const BUG_HISTORY_DATA:BugHistoryItem[] = [
  {id:1,from:null,to:"new",operator:"张程远",note:"发现并记录该缺陷，在 Chrome 110 稳定复现",time:"2026-07-01 10:20"},
  {id:2,from:"new",to:"assigned",operator:"张程远",note:"指派给李明处理，影响用户登录体验，需优先跟进",time:"2026-07-01 10:35"},
  {id:3,from:"assigned",to:"in-progress",operator:"李明",note:"开始排查，已定位到 store 初始化逻辑缺失 reset，正在修复",time:"2026-07-02 10:00"},
];
const BUG_COMMENTS_DATA:BugComment[] = [
  {id:1,author:"李明",content:"已定位到问题，是前端页面初始化时没有触发 store 的 reset 操作导致的。正在修复中。",createdAt:"2026-07-02 10:15"},
  {id:2,author:"张程远",content:"这个问题之前在 staging 也出现过，建议顺带检查一下其他需要重置状态的页面，避免遗漏。",createdAt:"2026-07-02 11:30"},
  {id:3,author:"李明",content:"已检查了其他 5 个页面，只有登录跳转首页这里有问题。预计今天下班前提交修复。",createdAt:"2026-07-02 16:45"},
];
const BUGS_TREND_DATA = [
  {day:"6/5",新增:8,关闭:5},{day:"6/10",新增:12,关闭:9},{day:"6/15",新增:6,关闭:11},
  {day:"6/20",新增:15,关闭:8},{day:"6/25",新增:9,关闭:13},{day:"6/30",新增:11,关闭:7},{day:"7/5",新增:8,关闭:11},
];
const BUGS_MODULE_DIST = [
  {name:"订单中心",count:24},{name:"用户中心",count:18},{name:"获客中心",count:15},
  {name:"风控中心",count:11},{name:"接口自动化",count:8},{name:"报告",count:6},
];
const BUGS_STATUS_DIST = [
  {name:"已关闭",value:28,color:"#00B42A"},{name:"处理中",value:15,color:"#FF7D00"},
  {name:"新建",value:12,color:"#165DFF"},{name:"待验证",value:9,color:"#FAAD14"},
  {name:"已指派",value:8,color:"#7816FF"},{name:"已驳回",value:4,color:"#F53F3F"},
];

// ─── Bug atom components ──────────────────────────────────────────────────────

function BugStatusTag({status}:{status:BugStatus}) {
  const c=BUG_STATUS_CFG[status];
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium" style={{backgroundColor:c.bg,color:c.color}}>{c.label}</span>;
}
function SeverityTag({severity}:{severity:BugSeverity}) {
  const c=BUG_SEVERITY_CFG[severity];
  return(
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold"
      style={{border:`1.5px solid ${c.border}`,color:c.color,background:`${c.border}0D`}}>
      <span style={{width:5,height:5,borderRadius:"50%",background:c.dot,flexShrink:0,display:"inline-block"}}/>
      {c.label}
    </span>
  );
}

// ─── Bug Detail Drawer ────────────────────────────────────────────────────────

function BugDetailDrawer({bug,onClose,onTransition,onEdit}:{bug:Bug;onClose:()=>void;onTransition:(b:Bug)=>void;onEdit:(b:Bug)=>void}) {
  const[tab,setTab]=useState<"detail"|"history"|"comments">("detail");
  const[comment,setComment]=useState("");
  const ps=PRIORITY_STYLE[bug.priority];
  const nexts=STATUS_NEXT[bug.status];

  return(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0" style={{backgroundColor:"rgba(29,33,41,0.4)"}} onClick={onClose}/>
      <div className="relative flex flex-col overflow-hidden" style={{width:720,backgroundColor:"#fff",boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div className="h-1 flex-shrink-0" style={{backgroundColor:BUG_SEVERITY_CFG[bug.severity].border}}/>
        <div className="px-6 pt-4 pb-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-2">
                <code className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{backgroundColor:"#F2F3F5",color:T.t2}}>{bug.id}</code>
                <SeverityTag severity={bug.severity}/>
                <BugStatusTag status={bug.status}/>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:ps.bg,color:ps.color}}>{bug.priority}</span>
                {bug.tags.map(t=><span key={t} className="px-1.5 py-0.5 rounded text-[10px]" style={{backgroundColor:"#F2F3F5",color:T.t3}}>{t}</span>)}
              </div>
              <h2 className="text-[16px] font-semibold leading-snug" style={{color:T.t1}}>{bug.title}</h2>
              <p className="text-[12px] mt-1.5 flex items-center gap-3 flex-wrap" style={{color:T.t3}}>
                <span>{bug.module}</span>
                <span>创建人：{bug.creator}</span>
                <span>{bug.createdAt}</span>
                {bug.assignee&&<span>负责人：<span style={{color:T.t1,fontWeight:500}}>{bug.assignee}</span></span>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <PBtn icon={Edit2} onClick={()=>onEdit(bug)} variant="ghost">编辑</PBtn>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[18px]" style={{color:T.t4}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>×</button>
            </div>
          </div>
          {nexts.length>0&&(
            <div className="flex items-center gap-2 mt-3 pt-3" style={{borderTop:`1px solid ${T.border}`}}>
              <span className="text-[11px] font-medium" style={{color:T.t3}}>流转至：</span>
              {nexts.map(n=>(
                <button key={n.to} onClick={()=>onTransition(bug)}
                  className="h-7 px-3 rounded-lg text-[12px] font-medium border transition-all"
                  style={{borderColor:`${n.color}40`,color:n.color,backgroundColor:`${n.color}0C`}}
                  onMouseEnter={e=>e.currentTarget.style.backgroundColor=`${n.color}18`}
                  onMouseLeave={e=>e.currentTarget.style.backgroundColor=`${n.color}0C`}>
                  {n.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 px-6" style={{borderBottom:`1px solid ${T.border}`}}>
          {(["detail","history","comments"] as const).map(t=>{
            const labels={detail:"缺陷详情",history:`流转记录（${BUG_HISTORY_DATA.length}）`,comments:`评论（${BUG_COMMENTS_DATA.length}）`};
            return(
              <button key={t} onClick={()=>setTab(t)}
                className="h-10 px-4 text-[13px] font-medium border-b-2 transition-colors"
                style={{borderBottomColor:tab===t?T.danger:"transparent",color:tab===t?T.danger:T.t3}}>
                {labels[t]}
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          {tab==="detail"&&(
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 pb-5" style={{borderBottom:`1px solid ${T.border}`}}>
                {[{l:"所属模块",v:bug.module},{l:"负责人",v:bug.assignee||"—"},{l:"创建人",v:bug.creator},{l:"创建时间",v:bug.createdAt},{l:"最后更新",v:bug.updatedAt},{l:"关联用例",v:bug.relatedCase||"—"}].map((f,i)=>(
                  <div key={i}><p className="text-[11px] font-medium mb-0.5" style={{color:T.t3}}>{f.l}</p><p className="text-[13px]" style={{color:T.t1}}>{f.v}</p></div>
                ))}
              </div>
              <div>
                <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>问题描述</p>
                <div className="text-[13px] leading-relaxed px-4 py-3 rounded-xl" style={{backgroundColor:"#F7F8FA",color:T.t1}}>{bug.description}</div>
              </div>
              <div>
                <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>复现步骤</p>
                <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
                  {bug.steps.map((s,i)=>(
                    <div key={i} className="flex items-start gap-3 px-4 py-2.5 border-b last:border-b-0" style={{borderColor:T.border}}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5" style={{backgroundColor:`${T.danger}15`,color:T.danger}}>{i+1}</span>
                      <span className="text-[13px]" style={{color:T.t1}}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>预期结果</p>
                  <div className="text-[13px] leading-relaxed px-4 py-3 rounded-xl" style={{backgroundColor:"#F6FFED",border:`1px solid #B7EB8F`,color:T.t1}}>{bug.expected}</div>
                </div>
                <div>
                  <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>实际结果</p>
                  <div className="text-[13px] leading-relaxed px-4 py-3 rounded-xl" style={{backgroundColor:"#FFF0F0",border:`1px solid #FFA39E`,color:T.t1}}>{bug.actual}</div>
                </div>
              </div>
              <div>
                <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>附件 / 截图</p>
                <div className="flex items-center justify-center py-8 rounded-xl border-2 border-dashed" style={{borderColor:T.border}}>
                  <p className="text-[12px]" style={{color:T.t4}}>暂无附件</p>
                </div>
              </div>
            </div>
          )}
          {tab==="history"&&(
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-0">
                {BUG_HISTORY_DATA.map((h,i)=>{
                  const tc=BUG_STATUS_CFG[h.to];
                  return(
                    <div key={h.id} className="flex gap-4">
                      <div className="flex flex-col items-center" style={{width:36}}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] flex-shrink-0" style={{backgroundColor:tc.bg,border:`2px solid ${tc.color}`}}>
                          <span style={{color:tc.color}}>{i===0?"🐞":"→"}</span>
                        </div>
                        {i<BUG_HISTORY_DATA.length-1&&<div className="w-0.5 flex-1 my-1" style={{backgroundColor:T.border,minHeight:28}}/>}
                      </div>
                      <div className="flex-1 pb-5">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <span className="text-[13px] font-medium" style={{color:T.t1}}>{h.operator}</span>
                          {h.from&&<><span className="text-[12px]" style={{color:T.t3}}>将状态从</span><BugStatusTag status={h.from}/></>}
                          <span className="text-[12px]" style={{color:T.t3}}>{h.from?"改为":"创建了缺陷"}</span>
                          <BugStatusTag status={h.to}/>
                        </div>
                        <p className="text-[12px] mb-1" style={{color:T.t2}}>{h.note}</p>
                        <p className="text-[11px]" style={{color:T.t4}}>{h.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {tab==="comments"&&(
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {BUG_COMMENTS_DATA.map(c=>(
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0" style={{backgroundColor:T.primary}}>{c.author[0]}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-medium" style={{color:T.t1}}>{c.author}</span>
                        <span className="text-[11px]" style={{color:T.t4}}>{c.createdAt}</span>
                      </div>
                      <div className="text-[13px] leading-relaxed px-4 py-3 rounded-xl" style={{backgroundColor:"#F7F8FA",color:T.t1}}>{c.content}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex-shrink-0 px-6 py-4" style={{borderTop:`1px solid ${T.border}`}}>
                <textarea value={comment} onChange={e=>setComment(e.target.value)}
                  placeholder="添加评论，可以 @提及成员..."
                  className="w-full px-3 py-2.5 border rounded-xl text-[13px] outline-none resize-none transition-all" rows={3}
                  style={{borderColor:T.border,color:T.t1}}
                  onFocus={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.primary}18`;}}
                  onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
                <div className="flex justify-end mt-2">
                  <PBtn icon={Send} onClick={()=>setComment("")}>提交评论</PBtn>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Status Transition Modal ──────────────────────────────────────────────────

function StatusTransitionModal({open,bug,onClose}:{open:boolean;bug:Bug|null;onClose:()=>void}) {
  const[targetStatus,setTargetStatus]=useState<BugStatus|null>(null);
  const[handler,setHandler]=useState("");
  const[note,setNote]=useState("");
  useEffect(()=>{if(open){setTargetStatus(null);setHandler("");setNote("");}}, [open]);

  if(!open||!bug)return null;
  const nexts=STATUS_NEXT[bug.status];
  const tc=targetStatus?BUG_STATUS_CFG[targetStatus]:null;

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{backgroundColor:"rgba(29,33,41,0.55)"}} onClick={onClose}/>
      <div className="relative bg-white rounded-2xl w-[480px] overflow-hidden" style={{boxShadow:"0 24px 64px rgba(0,0,0,0.2)"}}>
        <div className="h-1" style={{backgroundColor:T.danger}}/>
        <div className="px-6 py-5" style={{borderBottom:`1px solid ${T.border}`}}>
          <h3 className="text-[15px] font-semibold" style={{color:T.t1}}>状态流转</h3>
          <p className="text-[12px] mt-0.5 truncate" style={{color:T.t3}}>{bug.id} · {bug.title}</p>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[11px] font-medium mb-1.5" style={{color:T.t3}}>当前状态</p>
              <BugStatusTag status={bug.status}/>
            </div>
            {targetStatus&&<><span className="text-[18px]" style={{color:T.t4}}>→</span><div><p className="text-[11px] font-medium mb-1.5" style={{color:T.t3}}>目标状态</p><BugStatusTag status={targetStatus}/></div></>}
          </div>
          <div>
            <p className="text-[12px] font-medium mb-2" style={{color:T.t2}}>流转至</p>
            <div className="flex flex-wrap gap-2">
              {nexts.map(n=>(
                <button key={n.to} onClick={()=>setTargetStatus(n.to)}
                  className="h-8 px-4 rounded-xl text-[13px] font-medium border-2 transition-all"
                  style={{borderColor:targetStatus===n.to?n.color:`${n.color}35`,color:n.color,backgroundColor:targetStatus===n.to?`${n.color}12`:"transparent"}}>
                  {n.label}
                </button>
              ))}
            </div>
          </div>
          {targetStatus&&["assigned","in-progress"].includes(targetStatus)&&(
            <div>
              <p className="text-[12px] font-medium mb-1.5" style={{color:T.t2}}>指派给</p>
              <select value={handler} onChange={e=>setHandler(e.target.value)} className="w-full h-9 px-2.5 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}>
                <option value="">请选择处理人</option>
                {["李明","王芳","陈伟","张程远"].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
          )}
          <div>
            <p className="text-[12px] font-medium mb-1.5" style={{color:T.t2}}>处理说明 <span style={{color:T.t4,fontWeight:400}}>(可选)</span></p>
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="填写本次流转的处理说明..." rows={3}
              className="w-full px-3 py-2.5 border rounded-xl text-[13px] outline-none resize-none" style={{borderColor:T.border,color:T.t1}}
              onFocus={e=>{e.currentTarget.style.borderColor=T.danger;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.danger}18`;}}
              onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn onClick={onClose} color={tc?.color||T.danger}>确认流转</PBtn>
        </div>
      </div>
    </div>
  );
}

// ─── New / Edit Bug Modal ─────────────────────────────────────────────────────

function NewBugModal({open,bug,onClose}:{open:boolean;bug:Bug|null;onClose:()=>void}) {
  const[isDirty,setIsDirty]=useState(false);
  const[showUnsaved,setShowUnsaved]=useState(false);

  useEffect(()=>{if(open)setIsDirty(false);},[open]);

  const handleClose=()=>{
    if(isDirty){setShowUnsaved(true);}else{onClose();}
  };
  const handleDiscard=()=>{setShowUnsaved(false);setIsDirty(false);onClose();};

  if(!open)return null;
  const isEdit=!!bug;
  const markDirty=()=>setIsDirty(true);
  const fInp=(placeholder:string,defaultVal?:string,mono?:boolean)=>(
    <input defaultValue={defaultVal} placeholder={placeholder} onChange={markDirty}
      className={`w-full h-9 px-3 border rounded-lg text-[13px] outline-none transition-all ${mono?"font-mono text-[12px]":""}`}
      style={{borderColor:T.border,color:T.t1}}
      onFocus={e=>{e.currentTarget.style.borderColor=T.danger;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.danger}18`;}}
      onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
  );
  const fTa=(placeholder:string,rows:number,defaultVal?:string)=>(
    <textarea defaultValue={defaultVal} placeholder={placeholder} rows={rows} onChange={markDirty}
      className="w-full px-3 py-2.5 border rounded-lg text-[13px] outline-none resize-none"
      style={{borderColor:T.border,color:T.t1}}
      onFocus={e=>{e.currentTarget.style.borderColor=T.danger;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.danger}18`;}}
      onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
  );
  const fSel=(options:string[],placeholder?:string)=>(
    <select onChange={markDirty} className="w-full h-9 px-2.5 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}>
      {placeholder&&<option value="">{placeholder}</option>}
      {options.map(o=><option key={o}>{o}</option>)}
    </select>
  );
  const fLabel=(label:string,required?:boolean)=>(
    <label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}>{required&&<span style={{color:T.danger}}>* </span>}{label}</label>
  );

  return(
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0" style={{backgroundColor:"rgba(29,33,41,0.55)"}} onClick={handleClose}/>
        <div className="relative bg-white rounded-2xl w-[640px] max-h-[90vh] flex flex-col overflow-hidden" style={{boxShadow:"0 24px 64px rgba(0,0,0,0.2)"}}>
          <div className="h-1 flex-shrink-0" style={{backgroundColor:T.danger}}/>
          <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold" style={{color:T.t1}}>{isEdit?"编辑缺陷":"新增缺陷"}</span>
              {isDirty&&<span className="text-[11px] px-2 py-0.5 rounded-full" style={{background:`${T.warning}15`,color:T.warning}}>未保存</span>}
            </div>
            <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[18px]" style={{color:T.t4}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>×</button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>{fLabel("缺陷标题",true)}{fInp("简洁描述问题",bug?.title)}</div>
            <div className="grid grid-cols-2 gap-4">
              <div>{fLabel("严重程度",true)}{fSel(["致命","严重","一般","轻微"])}</div>
              <div>{fLabel("优先级",true)}{fSel(["P0","P1","P2","P3","P4"])}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>{fLabel("所属模块",true)}{fSel(["用户中心","订单中心","获客中心","风控中心","接口自动化","报告"])}</div>
              <div>{fLabel("指派给")}{fSel(["李明","王芳","陈伟","张程远"],"暂不指派")}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>{fLabel("来源类型")}{fSel(["手动发现","用例执行","AI 检测","代码审查"])}</div>
              <div>{fLabel("关联用例")}{fInp("输入用例 ID，如 Case-07-44",bug?.relatedCase||undefined)}</div>
            </div>
            <div>{fLabel("问题描述")}{fTa("详细描述问题现象...",3,bug?.description)}</div>
            <div>{fLabel("复现步骤")}{fTa("1. 打开页面\n2. 执行操作\n3. 观察结果",4,bug?.steps.join("\n"))}</div>
            <div className="grid grid-cols-2 gap-4">
              <div>{fLabel("预期结果")}{fTa("描述期望的正确结果",2,bug?.expected)}</div>
              <div>{fLabel("实际结果")}{fTa("描述实际发生的错误结果",2,bug?.actual)}</div>
            </div>
            <div>
              {fLabel("附件 / 截图")}
              <div className="flex flex-col items-center justify-center py-6 rounded-xl border-2 border-dashed" style={{borderColor:T.border}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.danger} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                <Upload size={22} className="mb-2" style={{color:T.t4}}/>
                <p className="text-[12px]" style={{color:T.t3}}>点击或拖拽文件到此处上传</p>
                <p className="text-[11px] mt-0.5" style={{color:T.t4}}>支持 PNG、JPG、GIF、MP4，最大 20MB</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
            <PBtn variant="ghost" onClick={handleClose}>取消</PBtn>
            <PBtn onClick={()=>{setIsDirty(false);onClose();}} color={T.danger}>{isEdit?"保存修改":"提交缺陷"}</PBtn>
          </div>
        </div>
      </div>
      {showUnsaved&&<UnsavedConfirmModal onStay={()=>setShowUnsaved(false)} onDiscard={handleDiscard}/>}
    </>
  );
}

// ─── Related Case Picker Modal ────────────────────────────────────────────────

interface PickerCase {
  id:string; title:string; module:string; priority:Priority;
  execStatus:"pass"|"fail"|"not-run"|"running"; type:string;
}

const PICKER_CASES: PickerCase[] = [
  {id:"Case-00150",title:"边界值：查询内输入500个字节",     module:"订单中心",  priority:"P1",execStatus:"fail",   type:"功能"},
  {id:"Case-00149",title:"异常场景：必填字段为空时提交失败", module:"用户中心",  priority:"P0",execStatus:"pass",   type:"功能"},
  {id:"Case-00155",title:"状态迁移：编辑后取消删改状态",     module:"获客中心",  priority:"P2",execStatus:"not-run",type:"功能"},
  {id:"Case-00154",title:"状态迁移：登记记录后编辑删改状态", module:"获客中心",  priority:"P2",execStatus:"not-run",type:"功能"},
  {id:"Case-00153",title:"边界值：回查内容输入501个字节",    module:"订单中心",  priority:"P1",execStatus:"fail",   type:"功能"},
  {id:"Case-00152",title:"边界值：回查内容输入500个字节",    module:"订单中心",  priority:"P1",execStatus:"pass",   type:"功能"},
  {id:"Case-00151",title:"边界值：查询字段输入501个字节",    module:"用户中心",  priority:"P1",execStatus:"pass",   type:"功能"},
  {id:"Case-00148",title:"正常流程：登记-条其他类记录（传达信息）",module:"风控中心",priority:"P0",execStatus:"fail",type:"功能"},
  {id:"Case-00147",title:"正常流程：成功登记一条完整的来电咨询记录",module:"风控中心",priority:"P0",execStatus:"pass",type:"功能"},
  {id:"Case-00051",title:"通道访客登记：异常场景-通过未过滤选项",module:"用户中心",priority:"P2",execStatus:"not-run",type:"边界"},
  {id:"Case-00044",title:"正常提交问题描述且内容超过限制后按钮灰化",module:"订单中心",priority:"P1",execStatus:"not-run",type:"功能"},
  {id:"Case-00038",title:"批量操作：全选后取消部分选中状态",  module:"获客中心", priority:"P2",execStatus:"pass",   type:"功能"},
  {id:"Case-00031",title:"权限验证：无权限用户无法访问管理页",module:"用户中心", priority:"P0",execStatus:"pass",   type:"安全"},
];

const PICKER_DIRS = [
  {id:"all",label:"全部用例",count:PICKER_CASES.length},
  {id:"user",label:"用户中心",count:PICKER_CASES.filter(c=>c.module==="用户中心").length},
  {id:"order",label:"订单中心",count:PICKER_CASES.filter(c=>c.module==="订单中心").length},
  {id:"growth",label:"获客中心",count:PICKER_CASES.filter(c=>c.module==="获客中心").length},
  {id:"risk",label:"风控中心",count:PICKER_CASES.filter(c=>c.module==="风控中心").length},
];

const EXEC_CFG:{[k:string]:{dot:string;label:string}} = {
  "pass":    {dot:T.success,label:"通过"},
  "fail":    {dot:T.danger, label:"失败"},
  "not-run": {dot:T.t4,     label:"未执行"},
  "running": {dot:T.primary,label:"运行中"},
};

function RelatedCaseModal({selected:initSel=[],onClose}:{selected?:string[];onClose:(ids:string[])=>void}){
  const [selDir,setSelDir]=useState("all");
  const [search,setSearch]=useState("");
  const [selPriority,setSelPriority]=useState<Priority|"all">("all");
  const [selExec,setSelExec]=useState<string>("all");
  const [checked,setChecked]=useState<Set<string>>(new Set(initSel));

  const PRIORITY_COLOR:Record<Priority,{bg:string;color:string}> = {
    P0:{bg:"#F53F3F",color:"#fff"},P1:{bg:"#FF7D00",color:"#fff"},
    P2:{bg:"#FAAD14",color:"#fff"},P3:{bg:"#165DFF",color:"#fff"},P4:{bg:"#C9CDD4",color:"#4E5969"},
  };

  const filtered = PICKER_CASES.filter(c=>{
    if(selDir!=="all"){
      const dirMap:Record<string,string>={user:"用户中心",order:"订单中心",growth:"获客中心",risk:"风控中心"};
      if(c.module!==dirMap[selDir])return false;
    }
    if(selPriority!=="all"&&c.priority!==selPriority)return false;
    if(selExec!=="all"&&c.execStatus!==selExec)return false;
    if(search&&!c.title.includes(search)&&!c.id.includes(search))return false;
    return true;
  });

  const allChecked = filtered.length>0 && filtered.every(c=>checked.has(c.id));
  const someChecked = filtered.some(c=>checked.has(c.id));
  const toggleAll=()=>{const next=new Set(checked);if(allChecked)filtered.forEach(c=>next.delete(c.id));else filtered.forEach(c=>next.add(c.id));setChecked(next);};
  const toggle=(id:string)=>{const next=new Set(checked);next.has(id)?next.delete(id):next.add(id);setChecked(next);};
  const selectedCases = PICKER_CASES.filter(c=>checked.has(c.id));

  return(
    <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div onClick={()=>onClose([])} style={{position:"absolute",inset:0,background:"rgba(29,33,41,0.5)"}}/>
      <div style={{position:"relative",background:"#fff",borderRadius:14,width:860,height:600,display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.2)",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",padding:"0 20px",height:52,borderBottom:`1px solid ${T.border}`,flexShrink:0,background:"#fff"}}>
          <div style={{width:4,height:18,borderRadius:2,background:T.danger,marginRight:10}}/>
          <span style={{fontSize:15,fontWeight:700,color:T.t1}}>关联用例</span>
          <span style={{marginLeft:8,fontSize:12,color:T.t4}}>选择与该缺陷相关的测试用例</span>
          <div style={{flex:1}}/>
          <button onClick={()=>onClose([])} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0}}><X size={16}/></button>
        </div>
        <div style={{flex:1,display:"flex",minHeight:0}}>
          <div style={{width:186,flexShrink:0,borderRight:`1px solid ${T.border}`,overflowY:"auto",background:"#FAFBFE",padding:"10px 8px"}}>
            <div style={{fontSize:11,fontWeight:700,color:T.t4,padding:"4px 8px",letterSpacing:0.5,marginBottom:4}}>用例目录</div>
            {PICKER_DIRS.map(d=>(
              <button key={d.id} onClick={()=>setSelDir(d.id)}
                style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 10px",borderRadius:7,border:"none",background:selDir===d.id?`${T.danger}12`:"transparent",cursor:"pointer",marginBottom:2}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  {d.id==="all"?<LayoutGrid size={12} style={{color:selDir===d.id?T.danger:T.t4,flexShrink:0}}/>:<Folder size={12} style={{color:selDir===d.id?T.danger:T.t4,flexShrink:0}}/>}
                  <span style={{fontSize:13,color:selDir===d.id?T.danger:T.t2,fontWeight:selDir===d.id?600:400}}>{d.label}</span>
                </div>
                <span style={{fontSize:10,color:selDir===d.id?T.danger:T.t4,fontWeight:600}}>{d.count}</span>
              </button>
            ))}
          </div>
          <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,flexShrink:0,background:"#fff"}}>
              <div style={{position:"relative",flex:1}}>
                <Search size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.t4}}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索用例 ID 或名称…"
                  style={{width:"100%",height:32,paddingLeft:30,paddingRight:10,border:`1px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none",boxSizing:"border-box"}}
                  onFocus={e=>e.currentTarget.style.borderColor=T.danger} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
              </div>
              <div style={{display:"flex",gap:3}}>
                {(["all","P0","P1","P2","P3"] as const).map(p=>(
                  <button key={p} onClick={()=>setSelPriority(p)}
                    style={{height:28,padding:"0 10px",borderRadius:6,border:`1px solid ${selPriority===p?(p==="all"?T.danger:PRIORITY_COLOR[p as Priority]?.bg||T.danger):T.border}`,fontSize:11,fontWeight:selPriority===p?700:400,cursor:"pointer",
                      background:selPriority===p?(p==="all"?T.danger:PRIORITY_COLOR[p as Priority]?.bg||T.danger):"#fff",
                      color:selPriority===p?"#fff":T.t3}}>
                    {p==="all"?"全部":p}
                  </button>
                ))}
              </div>
              <select value={selExec} onChange={e=>setSelExec(e.target.value)}
                style={{height:28,padding:"0 8px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t2,background:"#fff",outline:"none"}}>
                <option value="all">全部状态</option>
                <option value="pass">已通过</option>
                <option value="fail">失败</option>
                <option value="not-run">未执行</option>
              </select>
            </div>
            <div style={{flex:1,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                    <th style={{width:36,padding:"8px 0 8px 14px",textAlign:"center"}}>
                      <input type="checkbox" checked={allChecked} ref={el=>{if(el)el.indeterminate=someChecked&&!allChecked;}} onChange={toggleAll} style={{accentColor:T.danger,cursor:"pointer"}}/>
                    </th>
                    <th style={{width:110,padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.t3,letterSpacing:0.4}}>用例编号</th>
                    <th style={{padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.t3,letterSpacing:0.4}}>用例名称</th>
                    <th style={{width:72,padding:"8px 12px",textAlign:"center",fontSize:11,fontWeight:700,color:T.t3,letterSpacing:0.4}}>优先级</th>
                    <th style={{width:80,padding:"8px 12px",textAlign:"center",fontSize:11,fontWeight:700,color:T.t3,letterSpacing:0.4}}>执行状态</th>
                    <th style={{width:90,padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.t3,letterSpacing:0.4}}>所属模块</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length===0?(
                    <tr><td colSpan={6} style={{padding:"48px",textAlign:"center",color:T.t4,fontSize:13}}>暂无匹配的用例</td></tr>
                  ):filtered.map((c,i)=>{
                    const isChecked=checked.has(c.id);
                    const exec=EXEC_CFG[c.execStatus];
                    const pri=PRIORITY_COLOR[c.priority];
                    return(
                      <tr key={c.id} onClick={()=>toggle(c.id)}
                        style={{borderBottom:i<filtered.length-1?`1px solid ${T.border}`:"none",background:isChecked?`${T.danger}06`:"#fff",cursor:"pointer"}}
                        onMouseEnter={e=>!isChecked&&(e.currentTarget.style.background="#FAFBFF")}
                        onMouseLeave={e=>!isChecked&&(e.currentTarget.style.background="#fff")}>
                        <td style={{padding:"9px 0 9px 14px",textAlign:"center"}}>
                          <input type="checkbox" checked={isChecked} onChange={()=>toggle(c.id)} onClick={e=>e.stopPropagation()} style={{accentColor:T.danger,cursor:"pointer"}}/>
                        </td>
                        <td style={{padding:"9px 12px"}}><span style={{fontFamily:"monospace",fontSize:11,color:T.primary,fontWeight:600}}>{c.id}</span></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:13,color:T.t1,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:280}}>{c.title}</span></td>
                        <td style={{padding:"9px 12px",textAlign:"center"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:4,background:pri.bg,color:pri.color}}>{c.priority}</span></td>
                        <td style={{padding:"9px 12px",textAlign:"center"}}>
                          <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:exec.dot}}>
                            <span style={{width:6,height:6,borderRadius:"50%",background:exec.dot,flexShrink:0}}/>{exec.label}
                          </span>
                        </td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:11,color:T.t3}}>{c.module}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,background:"#fff"}}>
          <div style={{flex:1,display:"flex",alignItems:"center",gap:6,overflow:"hidden"}}>
            {checked.size>0?(
              <>
                <span style={{fontSize:12,color:T.t2,flexShrink:0}}>已选</span>
                <span style={{fontSize:13,fontWeight:700,color:T.danger,flexShrink:0}}>{checked.size}</span>
                <span style={{fontSize:12,color:T.t2,flexShrink:0}}>个用例：</span>
                <div style={{display:"flex",gap:4,overflow:"hidden",flex:1}}>
                  {selectedCases.slice(0,3).map(c=>(
                    <span key={c.id} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:12,background:`${T.danger}10`,border:`1px solid ${T.danger}30`,fontSize:11,color:T.danger,flexShrink:0}}>
                      {c.id}
                      <button onClick={e=>{e.stopPropagation();toggle(c.id);}} style={{background:"none",border:"none",cursor:"pointer",padding:0,lineHeight:0,color:T.danger,opacity:0.7}}>×</button>
                    </span>
                  ))}
                  {checked.size>3&&<span style={{fontSize:11,color:T.t4,flexShrink:0}}>+{checked.size-3} 个</span>}
                </div>
              </>
            ):(
              <span style={{fontSize:12,color:T.t4}}>请从列表中选择要关联的用例（可多选）</span>
            )}
          </div>
          <button onClick={()=>onClose([])} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer",flexShrink:0}}>取消</button>
          <button onClick={()=>onClose([...checked])} disabled={checked.size===0}
            style={{padding:"7px 22px",border:"none",borderRadius:7,background:checked.size>0?T.danger:T.t4,color:"#fff",fontSize:13,fontWeight:600,cursor:checked.size>0?"pointer":"not-allowed",flexShrink:0}}>
            确认关联{checked.size>0?` (${checked.size})`:""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bug List ─────────────────────────────────────────────────────────────────

function BugList({onAddNew,onEditFull}:{onAddNew?:()=>void;onEditFull?:(b:Bug)=>void}) {
  const[bugs,setBugs]=useState<Bug[]>(BUGS_DATA);
  const[selected,setSelected]=useState<string[]>([]);
  const[drawer,setDrawer]=useState<Bug|null>(null);
  const[editModal,setEditModal]=useState<Bug|null>(null);
  const[newModal,setNewModal]=useState(false);
  const[transitionModal,setTransitionModal]=useState<Bug|null>(null);
  const[batchAssign,setBatchAssign]=useState(false);
  const[batchClose,setBatchClose]=useState(false);
  const[batchDelete,setBatchDelete]=useState(false);
  const[singleDelete,setSingleDelete]=useState<Bug|null>(null);
  const[toast,setToast]=useState<{msg:string;type:"success"|"danger"|"info"}|null>(null);
  const toggleSel=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const clearSel=()=>setSelected([]);

  const showToast=(msg:string,type:"success"|"danger"|"info"="success")=>{
    setToast({msg,type});
  };

  const handleBatchAssign=(assignee:string)=>{
    setBugs(prev=>prev.map(b=>selected.includes(b.id)?{...b,assignee,status:b.status==="new"?"assigned":b.status}:b));
    setBatchAssign(false);
    clearSel();
    showToast(`已将 ${selected.length} 条缺陷指派给 ${assignee}`);
  };

  const handleBatchClose=()=>{
    const n=selected.length;
    setBugs(prev=>prev.map(b=>selected.includes(b.id)?{...b,status:"closed" as const}:b));
    setBatchClose(false);
    clearSel();
    showToast(`已关闭 ${n} 条缺陷`);
  };

  const handleBatchDelete=()=>{
    const n=selected.length;
    setBugs(prev=>prev.filter(b=>!selected.includes(b.id)));
    setBatchDelete(false);
    clearSel();
    showToast(`已删除 ${n} 条缺陷`,"danger");
  };

  const handleSingleDelete=(b:Bug)=>{
    setBugs(prev=>prev.filter(x=>x.id!==b.id));
    setSingleDelete(null);
    showToast(`已删除缺陷 ${b.id}`,"danger");
  };

  const miniStats=[
    {label:"缺陷总数",value:bugs.length,color:T.t1},
    {label:"待处理",value:bugs.filter(b=>["new","assigned"].includes(b.status)).length,color:T.warning},
    {label:"高优先级",value:bugs.filter(b=>["P0","P1"].includes(b.priority)).length,color:T.danger},
    {label:"待验证",value:bugs.filter(b=>b.status==="pending-verify").length,color:"#C89B00"},
  ];

  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-0 px-6 flex-shrink-0 bg-white" style={{height:48,borderBottom:`1px solid ${T.border}`}}>
        {miniStats.map((s,i)=>(
          <div key={s.label} className="flex items-center gap-2 mr-5">
            <span className="text-[24px] font-bold" style={{color:s.color}}>{s.value}</span>
            <span className="text-[12px]" style={{color:T.t3}}>{s.label}</span>
            {i<miniStats.length-1&&<div className="w-px h-4 ml-5" style={{backgroundColor:T.border}}/>}
          </div>
        ))}
        <div className="flex-1"/>
        <PBtn icon={Plus} onClick={onAddNew??(() =>setNewModal(true))} color={T.danger}>新增缺陷</PBtn>
      </div>
      <div className="flex items-center gap-2 px-6 py-2.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
        <Inp placeholder="搜索缺陷标题或 ID" prefix={<Search size={13}/>} width={220}/>
        <Sel width={100}><option>全部状态</option>{(Object.keys(BUG_STATUS_CFG) as BugStatus[]).map(k=><option key={k}>{BUG_STATUS_CFG[k].label}</option>)}</Sel>
        <Sel width={110}><option>全部严重程度</option>{(Object.keys(BUG_SEVERITY_CFG) as BugSeverity[]).map(k=><option key={k}>{BUG_SEVERITY_CFG[k].label}</option>)}</Sel>
        <Sel width={100}><option>全部优先级</option>{(["P0","P1","P2","P3","P4"] as Priority[]).map(p=><option key={p}>{p}</option>)}</Sel>
        <Sel width={110}><option>全部模块</option>{["用户中心","订单中心","获客中心","风控中心","接口自动化"].map(m=><option key={m}>{m}</option>)}</Sel>
        <Sel width={100}><option>全部负责人</option>{["李明","王芳","陈伟","张程远"].map(p=><option key={p}>{p}</option>)}</Sel>
        <div className="flex-1"/>
        {selected.length>0&&(
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-[12px]" style={{color:T.t3}}>已选 {selected.length}</span>
            <PBtn variant="ghost" icon={UserCheck} onClick={()=>setBatchAssign(true)}>批量指派</PBtn>
            <PBtn variant="ghost" icon={CheckCircle} onClick={()=>setBatchClose(true)}>批量关闭</PBtn>
            <PBtn variant="ghost" icon={Trash2} color={T.danger} onClick={()=>setBatchDelete(true)}>删除</PBtn>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <ETable total={bugs.length} cols={[
          {label:"",width:"3%"},{label:"缺陷 ID",width:"9%"},{label:"缺陷标题",width:"25%"},
          {label:"严重程度",width:"8%"},{label:"优先级",width:"7%"},{label:"状态",width:"8%"},
          {label:"负责人",width:"7%"},{label:"所属模块",width:"9%"},{label:"更新时间",width:"12%"},
          {label:"操作",width:"12%",align:"right"},
        ]}>
          {bugs.length===0?(
            <TR><td colSpan={10} style={{textAlign:"center",padding:"60px"}}>
              <div className="flex flex-col items-center gap-2">
                <Bug size={32} style={{color:T.t4}}/><p className="text-[13px]" style={{color:T.t3}}>暂无缺陷记录</p>
                <PBtn icon={Plus} onClick={()=>setNewModal(true)} color={T.danger} small>新增缺陷</PBtn>
              </div>
            </td></TR>
          ):bugs.map(b=>{
            const ps=PRIORITY_STYLE[b.priority];
            return(
              <TR key={b.id} onClick={()=>setDrawer(b)}>
                <TD><input type="checkbox" checked={selected.includes(b.id)} onChange={()=>toggleSel(b.id)} onClick={e=>e.stopPropagation()} className="w-3.5 h-3.5" style={{accentColor:T.danger}}/></TD>
                <TD><button onClick={e=>{e.stopPropagation();setDrawer(b);}} className="font-mono text-[12px] hover:underline" style={{color:T.danger}}>{b.id}</button></TD>
                <TD>
                  <div>
                    <p className="font-medium truncate max-w-[200px]" style={{color:T.t1}}>{b.title}</p>
                    {b.tags.length>0&&<div className="flex gap-1 mt-0.5">{b.tags.slice(0,2).map(t=><span key={t} className="px-1.5 py-px rounded text-[10px]" style={{backgroundColor:"#F2F3F5",color:T.t3}}>{t}</span>)}</div>}
                  </div>
                </TD>
                <TD><SeverityTag severity={b.severity}/></TD>
                <TD><span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:ps.bg,color:ps.color}}>{b.priority}</span></TD>
                <TD><BugStatusTag status={b.status}/></TD>
                <TD muted>{b.assignee||"—"}</TD>
                <TD muted><span className="truncate block max-w-[80px]">{b.module}</span></TD>
                <TD mono muted>{b.updatedAt}</TD>
                <TD align="right">
                  <div className="flex items-center justify-end">
                    <IBtn icon={Eye} label="详情" onClick={()=>setDrawer(b)}/>
                    <IBtn icon={RefreshCw} label="状态流转" onClick={()=>setTransitionModal(b)}/>
                    <IBtn icon={Edit2} label="编辑" onClick={()=>{onEditFull?onEditFull(b):setEditModal(b);}}/>
                    <IBtn icon={Trash2} label="删除" danger onClick={e=>{e.stopPropagation();setSingleDelete(b);}}/>
                  </div>
                </TD>
              </TR>
            );
          })}
        </ETable>
      </div>

      {drawer&&<BugDetailDrawer bug={drawer} onClose={()=>setDrawer(null)} onTransition={b=>setTransitionModal(b)} onEdit={b=>setEditModal(b)}/>}
      <NewBugModal open={newModal||!!editModal} bug={editModal} onClose={()=>{setNewModal(false);setEditModal(null);}}/>
      <StatusTransitionModal open={!!transitionModal} bug={transitionModal} onClose={()=>setTransitionModal(null)}/>

      {batchAssign&&<BatchAssignModal count={selected.length} onClose={()=>setBatchAssign(false)} onConfirm={handleBatchAssign}/>}

      {batchClose&&<BatchConfirmModal
        title="批量关闭缺陷"
        body="确认后所选缺陷将全部变更为「已关闭」状态。已关闭的缺陷随时可以重新打开继续跟进。"
        count={selected.length}
        confirmLabel="确认关闭"
        onClose={()=>setBatchClose(false)}
        onConfirm={handleBatchClose}
      />}

      {batchDelete&&<BatchConfirmModal
        title="批量删除缺陷"
        body="删除后数据将无法恢复，关联的用例引用也将一并清除。请确认您已知晓影响范围。"
        count={selected.length}
        confirmLabel="确认删除"
        danger
        needCheck
        onClose={()=>setBatchDelete(false)}
        onConfirm={handleBatchDelete}
      />}

      {singleDelete&&<BatchConfirmModal
        title={`删除缺陷 ${singleDelete.id}`}
        body={`"${singleDelete.title.slice(0,30)}${singleDelete.title.length>30?"…":""}" 删除后无法恢复。`}
        count={1}
        confirmLabel="确认删除"
        danger
        needCheck
        onClose={()=>setSingleDelete(null)}
        onConfirm={()=>handleSingleDelete(singleDelete)}
      />}

      {toast&&<BugToast message={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
    </div>
  );
}

// ─── Unsaved Confirm Modal ────────────────────────────────────────────────────

function UnsavedConfirmModal({onStay,onDiscard}:{onStay:()=>void;onDiscard:()=>void}){
  return(
    <div className="fixed inset-0 flex items-center justify-center" style={{zIndex:70}}>
      <div className="absolute inset-0" style={{backgroundColor:"rgba(29,33,41,0.4)"}} onClick={onStay}/>
      <div className="relative bg-white rounded-2xl overflow-hidden" style={{width:380,boxShadow:"0 16px 48px rgba(0,0,0,0.18)"}}>
        <div className="h-1" style={{backgroundColor:T.warning}}/>
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{background:`${T.warning}15`}}>
              <AlertTriangle size={16} style={{color:T.warning}}/>
            </div>
            <span className="text-[15px] font-semibold" style={{color:T.t1}}>放弃未保存的修改？</span>
          </div>
          <p className="text-[13px] leading-relaxed pl-12" style={{color:T.t2}}>
            您填写的内容尚未保存，离开后将全部丢失，此操作无法撤销。
          </p>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <PBtn variant="ghost" onClick={onStay}>继续编辑</PBtn>
          <PBtn color={T.warning} onClick={onDiscard}>放弃修改</PBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Batch Assign Modal ───────────────────────────────────────────────────────

const ASSIGNEES=["李明","王芳","陈伟","张程远"];

function BatchAssignModal({count,onClose,onConfirm}:{count:number;onClose:()=>void;onConfirm:(assignee:string,note:string)=>void}){
  const[assignee,setAssignee]=useState("");
  const[note,setNote]=useState("");
  const[err,setErr]=useState(false);
  const confirm=()=>{
    if(!assignee){setErr(true);return;}
    onConfirm(assignee,note);
  };
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{backgroundColor:"rgba(29,33,41,0.55)"}} onClick={onClose}/>
      <div className="relative bg-white rounded-2xl overflow-hidden" style={{width:440,boxShadow:"0 24px 64px rgba(0,0,0,0.2)"}}>
        <div className="h-1" style={{backgroundColor:T.purple}}/>
        <div className="px-6 py-4 flex items-center justify-between" style={{borderBottom:`1px solid ${T.border}`}}>
          <div>
            <span className="text-[15px] font-semibold" style={{color:T.t1}}>批量指派</span>
            <span className="ml-2 text-[12px] px-2 py-0.5 rounded-full" style={{background:`${T.purple}12`,color:T.purple}}>已选 {count} 条缺陷</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[18px]" style={{color:T.t4}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}><span style={{color:T.danger}}>* </span>指派负责人</label>
            <div className="grid grid-cols-2 gap-2">
              {ASSIGNEES.map(a=>(
                <button key={a} onClick={()=>{setAssignee(a);setErr(false);}}
                  className="flex items-center gap-2.5 h-10 px-3 rounded-lg border text-[13px] font-medium transition-all"
                  style={{borderColor:assignee===a?T.purple:T.border,background:assignee===a?`${T.purple}08`:"#fff",color:assignee===a?T.purple:T.t1}}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                    style={{background:["#165DFF","#00B42A","#FF7D00","#F53F3F"][ASSIGNEES.indexOf(a)%4]}}>
                    {a[0]}
                  </div>
                  {a}
                </button>
              ))}
            </div>
            {err&&<p className="text-[11px] mt-1.5" style={{color:T.danger}}>请选择负责人</p>}
          </div>
          <div>
            <label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}>指派备注 <span style={{color:T.t4}}>（选填）</span></label>
            <textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}
              placeholder="说明指派原因或处理要求…"
              className="w-full px-3 py-2.5 border rounded-lg text-[13px] outline-none resize-none"
              style={{borderColor:T.border,color:T.t1,lineHeight:1.6}}
              onFocus={e=>e.currentTarget.style.borderColor=T.purple}
              onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn color={T.purple} onClick={confirm} icon={UserCheck}>确认指派</PBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Batch Confirm Modal (close / delete) ─────────────────────────────────────

function BatchConfirmModal({title,body,count,confirmLabel,danger=false,needCheck=false,onClose,onConfirm}:{
  title:string;body:string;count:number;confirmLabel:string;danger?:boolean;needCheck?:boolean;
  onClose:()=>void;onConfirm:()=>void;
}){
  const[checked,setChecked]=useState(false);
  const color=danger?T.danger:T.success;
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{backgroundColor:"rgba(29,33,41,0.55)"}} onClick={onClose}/>
      <div className="relative bg-white rounded-2xl overflow-hidden" style={{width:400,boxShadow:"0 24px 64px rgba(0,0,0,0.2)"}}>
        <div className="h-1" style={{backgroundColor:color}}/>
        <div className="px-6 py-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{background:`${color}12`}}>
              {danger?<AlertTriangle size={16} style={{color}}/>:<CheckCircle size={16} style={{color}}/>}
            </div>
            <div>
              <div className="text-[15px] font-semibold mb-0.5" style={{color:T.t1}}>{title}</div>
              <span className="text-[12px] px-2 py-0.5 rounded-full" style={{background:`${color}10`,color}}>共 {count} 条缺陷</span>
            </div>
          </div>
          <p className="text-[13px] leading-relaxed pl-12" style={{color:T.t2}}>{body}</p>
          {needCheck&&(
            <label className="flex items-center gap-2 mt-4 pl-12 cursor-pointer">
              <input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} style={{accentColor:color,width:14,height:14}}/>
              <span className="text-[12px]" style={{color:T.t2}}>我已了解，确认执行此操作</span>
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn color={color} onClick={onConfirm} {...(needCheck&&!checked?{onClick:()=>{}}:{})}>
            <span style={{opacity:needCheck&&!checked?0.45:1}}>{confirmLabel}</span>
          </PBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Bug Toast ────────────────────────────────────────────────────────────────

function BugToast({message,type="success",onClose}:{message:string;type?:"success"|"danger"|"info";onClose:()=>void}){
  useEffect(()=>{const t=setTimeout(onClose,3500);return()=>clearTimeout(t);},[]);
  const color=type==="success"?T.success:type==="danger"?T.danger:T.primary;
  return(
    <div style={{position:"fixed",bottom:28,right:28,zIndex:200,background:"#fff",borderRadius:10,
      boxShadow:"0 4px 24px rgba(0,0,0,0.14)",border:`1px solid ${color}30`,
      padding:"12px 16px",display:"flex",alignItems:"center",gap:10,minWidth:280,maxWidth:380,
      animation:"slideUp 0.2s ease"}}>
      <div style={{width:28,height:28,borderRadius:"50%",background:`${color}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        {type==="success"?<CheckCircle size={14} style={{color}}/>:<AlertTriangle size={14} style={{color}}/>}
      </div>
      <span style={{fontSize:13,color:T.t1,flex:1,lineHeight:1.5}}>{message}</span>
      <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t4,lineHeight:0,flexShrink:0}}>
        <X size={14}/>
      </button>
    </div>
  );
}

// ─── Bug Stats ────────────────────────────────────────────────────────────────

function BugStats() {
  return(
    <div className="flex-1 overflow-y-auto p-6">
      <PageHead title="缺陷统计" desc="汇总当前项目的缺陷分布、严重程度和趋势，快速识别质量风险"/>
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          {label:"缺陷总数",value:"76",sub:"本月新增 23 条",color:T.t1,bg:"#F2F3F5",icon:Bug},
          {label:"待处理",value:"28",sub:"新建 + 已指派",color:T.warning,bg:"#FFF3E8",icon:AlertTriangle},
          {label:"高优先级",value:"15",sub:"P0 + P1 缺陷",color:T.danger,bg:"#FFE8E8",icon:Zap},
          {label:"待验证",value:"9",sub:"开发已修复",color:"#C89B00",bg:"#FFFBE8",icon:CheckCircle},
        ].map(s=>{const Icon=s.icon;return(
          <div key={s.label} className="rounded-xl p-4 bg-white flex items-center gap-3" style={{border:`1px solid ${T.border}`}}>
            <IcoSquare color={s.color} bg={s.bg} size={44}><Icon size={20}/></IcoSquare>
            <div><p className="text-[24px] font-bold leading-none" style={{color:s.color}}>{s.value}</p><p className="text-[12px] font-medium mt-1" style={{color:T.t1}}>{s.label}</p><p className="text-[11px] mt-0.5" style={{color:T.t3}}>{s.sub}</p></div>
          </div>
        );})}
      </div>
      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-xl p-5" style={{border:`1px solid ${T.border}`}}>
          <p className="text-[14px] font-semibold mb-3" style={{color:T.t1}}>状态分布</p>
          <div style={{overflowX:"auto"}}>
            <PieChart width={400} height={200}>
              <Pie data={BUGS_STATUS_DIST} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                {BUGS_STATUS_DIST.map((e,i)=><Cell key={`bsd-${i}`} fill={e.color}/>)}
              </Pie>
              <Tooltip contentStyle={{borderRadius:8,border:`1px solid ${T.border}`,fontSize:12}}/>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:12}}/>
            </PieChart>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5" style={{border:`1px solid ${T.border}`}}>
          <p className="text-[14px] font-semibold mb-4" style={{color:T.t1}}>严重程度分布</p>
          <div className="space-y-4 mt-2">
            {[{label:"致命",count:6,color:"#F53F3F"},{label:"严重",count:22,color:"#FF7D00"},{label:"一般",count:35,color:"#FAAD14"},{label:"轻微",count:13,color:"#86909C"}].map(s=>(
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1"><span className="text-[12px] font-medium" style={{color:T.t2}}>{s.label}</span><span className="text-[12px] font-bold" style={{color:s.color}}>{s.count}</span></div>
                <div className="h-2 rounded-full" style={{backgroundColor:"#F2F3F5"}}><div className="h-2 rounded-full" style={{backgroundColor:s.color,width:`${(s.count/76)*100}%`}}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5 mb-5" style={{border:`1px solid ${T.border}`}}>
        <p className="text-[14px] font-semibold mb-4" style={{color:T.t1}}>模块缺陷分布</p>
        <div style={{overflowX:"auto"}}>
          <BarChart width={600} height={200} data={BUGS_MODULE_DIST} layout="vertical" margin={{top:0,right:30,left:60,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F5" horizontal={false}/>
            <XAxis type="number" tick={{fontSize:12,fill:T.t3}} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="name" tick={{fontSize:12,fill:T.t2}} axisLine={false} tickLine={false} width={60}/>
            <Tooltip contentStyle={{borderRadius:8,border:`1px solid ${T.border}`,fontSize:12}}/>
            <Bar dataKey="count" fill={T.danger} radius={[0,4,4,0]} name="缺陷数"/>
          </BarChart>
        </div>
      </div>
      <div className="bg-white rounded-xl p-5" style={{border:`1px solid ${T.border}`}}>
        <p className="text-[14px] font-semibold mb-4" style={{color:T.t1}}>新增 vs 关闭趋势</p>
        <div style={{overflowX:"auto"}}>
          <AreaChart width={600} height={200} data={BUGS_TREND_DATA} margin={{top:5,right:10,left:-20,bottom:0}}>
            <defs>
              <linearGradient key="gBNew" id="gBNew" x1="0" y1="0" x2="0" y2="1"><stop key="s1" offset="5%" stopColor={T.danger} stopOpacity={0.12}/><stop key="s2" offset="95%" stopColor={T.danger} stopOpacity={0}/></linearGradient>
              <linearGradient key="gBClose" id="gBClose" x1="0" y1="0" x2="0" y2="1"><stop key="s1" offset="5%" stopColor={T.success} stopOpacity={0.12}/><stop key="s2" offset="95%" stopColor={T.success} stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F5" vertical={false}/>
            <XAxis dataKey="day" tick={{fontSize:12,fill:T.t3}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:12,fill:T.t3}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{borderRadius:10,border:`1px solid ${T.border}`,fontSize:13}}/>
            <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:12,paddingTop:12}}/>
            <Area key="new" type="monotone" dataKey="新增" stroke={T.danger} strokeWidth={2.5} fill="url(#gBNew)" dot={false}/>
            <Area key="close" type="monotone" dataKey="关闭" stroke={T.success} strokeWidth={2.5} fill="url(#gBClose)" dot={false}/>
          </AreaChart>
        </div>
      </div>
    </div>
  );
}

// ─── Add Defect Full Page ─────────────────────────────────────────────────────

type DefectPriority = "P0"|"P1"|"P2"|"P3";
type DefectSeverity = "致命"|"严重"|"一般"|"轻微";

const PRIORITY_BTN_CFG:Record<DefectPriority,{color:string;bg:string;border:string}> = {
  P0:{color:"#fff",bg:T.danger,border:T.danger},
  P1:{color:"#fff",bg:"#FF7D00",border:"#FF7D00"},
  P2:{color:"#fff",bg:T.primary,border:T.primary},
  P3:{color:T.t2,bg:"#fff",border:T.border},
};

const RICH_TEXT_TOOLS = [
  {icon:"↩",tip:"撤销"},{icon:"↪",tip:"重做"},null,
  {icon:"B",tip:"加粗",bold:true},{icon:"I",tip:"斜体",italic:true},{icon:"U",tip:"下划线",under:true},
  {icon:"S̶",tip:"删除线"},{icon:"M",tip:"高亮"},null,
  {icon:"≡",tip:"无序列表"},{icon:"1.",tip:"有序列表"},{icon:"☑",tip:"任务列表"},null,
  {icon:"⬅",tip:"左对齐"},{icon:"⊟",tip:"居中"},{icon:"➡",tip:"右对齐"},{icon:"⇔",tip:"两端对齐"},null,
  {icon:"🖼",tip:"插入图片"},{icon:"⊞",tip:"插入表格"},{icon:"🗑",tip:"清除格式"},
];

function AddDefectPage({onBack,bug}:{onBack:()=>void;bug?:Bug|null}){
  const isEdit = !!bug;
  const [title,setTitle]=useState(bug?.title||"");
  const [priority,setPriority]=useState<DefectPriority>("P1");
  const [severity,setSeverity]=useState<DefectSeverity>("一般");
  const [assignee,setAssignee]=useState("");
  const [module_,setModule]=useState(bug?.module||"");
  const [tags,setTags]=useState<string[]>(["登录","UI"]);
  const [tagInput,setTagInput]=useState("");
  const [desc,setDesc]=useState(bug?.description||"");
  const [steps,setSteps]=useState(bug?.steps.join("\n")||"");
  const [expected,setExpected]=useState(bug?.expected||"");
  const [actual,setActual]=useState(bug?.actual||"");
  const [relatedCases,setRelatedCases]=useState<string[]>(bug?.relatedCase?[bug.relatedCase]:[]);
  const [showCasePicker,setShowCasePicker]=useState(false);
  const [dragging,setDragging]=useState(false);
  const [isDirty,setIsDirty]=useState(false);
  const [showUnsaved,setShowUnsaved]=useState(false);

  const markDirty=()=>setIsDirty(true);
  const handleBack=()=>{if(isDirty){setShowUnsaved(true);}else{onBack();}};

  const addTag = ()=>{const t=tagInput.trim();if(t&&!tags.includes(t)){setTags(ts=>[...ts,t]);markDirty();}setTagInput("");};

  const fInpStyle = {
    width:"100%",height:34,padding:"0 12px",
    border:`1.5px solid ${T.border}`,
    borderRadius:8,fontSize:13,color:T.t1,outline:"none",
    boxSizing:"border-box",background:"#fff",
  };
  const fSelStyle = {
    width:"100%",height:34,padding:"0 10px",
    border:`1.5px solid ${T.border}`,borderRadius:8,
    fontSize:13,color:T.t1,outline:"none",background:"#fff",
  };

  const SectionLabel = ({label,required}:{label:string;required?:boolean})=>(
    <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:6}}>
      {required&&<span style={{color:T.danger,marginRight:2}}>*</span>}{label}
    </div>
  );

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg}}>
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,padding:"0 24px",display:"flex",alignItems:"center",height:48,gap:10}}>
        <button onClick={handleBack} style={{display:"flex",alignItems:"center",gap:5,fontSize:13,color:T.t3,background:"none",border:"none",cursor:"pointer",padding:"4px 8px",borderRadius:6}}
          onMouseEnter={e=>e.currentTarget.style.color=T.danger} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
          <ChevronLeft size={14}/> 返回缺陷管理
        </button>
        <div style={{width:1,height:14,background:T.border}}/>
        <div style={{fontSize:15,fontWeight:700,color:T.t1}}>{isEdit?"编辑缺陷":"新增缺陷"}</div>
        {isDirty&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:`${T.warning}15`,color:T.warning,fontWeight:500}}>未保存</span>}
        <div style={{flex:1}}/>
        <div style={{fontSize:11,color:T.t4}}>当前项目：X-MAN · 测试平台</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"24px"}}>
        <div style={{display:"flex",gap:20,maxWidth:1280,margin:"0 auto"}}>
          <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:16}}>
            <div style={{background:"#fff",borderRadius:10,border:`1px solid ${T.border}`,padding:"16px 20px"}}>
              <SectionLabel label="缺陷标题" required/>
              <div style={{position:"relative"}}>
                <input value={title} onChange={e=>{setTitle(e.target.value.slice(0,120));markDirty();}} placeholder="简洁描述问题，例如：登录页输入正确密码后提示密码错误"
                  style={fInpStyle} onFocus={e=>e.currentTarget.style.borderColor=T.danger} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
                <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:title.length>100?T.warning:T.t4}}>{title.length}/120</span>
              </div>
            </div>
            <div style={{background:"#fff",borderRadius:10,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:2,flexWrap:"wrap"}}>
                <span style={{fontSize:11,fontWeight:600,color:T.t2,marginRight:8}}>缺陷描述 <span style={{color:T.danger}}>*</span></span>
                {RICH_TEXT_TOOLS.map((tool,i)=>
                  tool===null
                    ? <div key={i} style={{width:1,height:16,background:T.border,margin:"0 4px"}}/>
                    : <button key={i} title={tool.tip} style={{width:26,height:26,border:`1px solid transparent`,borderRadius:5,background:"transparent",fontSize:12,cursor:"pointer",color:T.t2,fontWeight:tool.bold?"700":tool.italic?"normal":"inherit",fontStyle:tool.italic?"italic":"normal",textDecoration:tool.under?"underline":"none",display:"flex",alignItems:"center",justifyContent:"center"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="#F4F6FA";e.currentTarget.style.borderColor=T.border;}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="transparent";}}>
                        {tool.icon}
                      </button>
                )}
              </div>
              <textarea value={desc} onChange={e=>{setDesc(e.target.value);markDirty();}} placeholder="请输入缺陷描述…" rows={7}
                style={{width:"100%",border:"none",outline:"none",resize:"none",padding:"14px 16px",fontSize:13,color:T.t1,lineHeight:1.7,boxSizing:"border-box"}}/>
            </div>
            <div style={{background:"#fff",borderRadius:10,border:`1px solid ${T.border}`,padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <SectionLabel label="复现步骤"/>
                <textarea value={steps} onChange={e=>{setSteps(e.target.value);markDirty();}} placeholder={"1. 打开登录页\n2. 输入正确的账号密码\n3. 点击登录按钮\n4. 观察结果"} rows={5}
                  style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,outline:"none",resize:"none",padding:"10px 12px",fontSize:13,color:T.t1,lineHeight:1.7,boxSizing:"border-box"}}
                  onFocus={e=>e.currentTarget.style.borderColor=T.danger} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div>
                  <SectionLabel label="预期结果"/>
                  <textarea value={expected} onChange={e=>{setExpected(e.target.value);markDirty();}} placeholder="描述期望的正确结果" rows={3}
                    style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,outline:"none",resize:"none",padding:"10px 12px",fontSize:13,color:T.t1,lineHeight:1.7,boxSizing:"border-box"}}
                    onFocus={e=>e.currentTarget.style.borderColor=T.danger} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
                </div>
                <div>
                  <SectionLabel label="实际结果"/>
                  <textarea value={actual} onChange={e=>{setActual(e.target.value);markDirty();}} placeholder="描述实际发生的错误结果" rows={3}
                    style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,outline:"none",resize:"none",padding:"10px 12px",fontSize:13,color:T.t1,lineHeight:1.7,boxSizing:"border-box"}}
                    onFocus={e=>e.currentTarget.style.borderColor=T.danger} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
                </div>
              </div>
            </div>
            <div style={{background:"#fff",borderRadius:10,border:`1px solid ${T.border}`,padding:"16px 20px"}}>
              <SectionLabel label="附件 / 截图"/>
              <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);}}
                style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"36px 20px",border:`2px dashed ${dragging?T.danger:T.border}`,borderRadius:10,background:dragging?`${T.danger}05`:"#FAFBFE",cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.borderColor=T.danger;(e.currentTarget as HTMLDivElement).style.background=`${T.danger}04`;}}
                onMouseLeave={e=>{if(!dragging){(e.currentTarget as HTMLDivElement).style.borderColor=T.border;(e.currentTarget as HTMLDivElement).style.background="#FAFBFE";}}}>
                <Upload size={22} style={{color:T.t4,marginBottom:8}}/>
                <div style={{fontSize:13,color:T.t2,fontWeight:500}}>点击上传，或将文件拖拽到此处</div>
                <div style={{fontSize:11,color:T.t4,marginTop:4}}>支持图片 / 文档，截图可直接粘贴（Ctrl+V），单文件不超过 20MB</div>
              </div>
            </div>
          </div>
          <div style={{width:260,flexShrink:0,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{background:"#fff",borderRadius:10,border:`1px solid ${T.border}`,padding:"16px",display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <SectionLabel label="处理人" required/>
                <select value={assignee} onChange={e=>{setAssignee(e.target.value);markDirty();}} style={fSelStyle}>
                  <option value="">请选择处理人</option>
                  <option>李明</option><option>王芳</option><option>陈伟</option><option>张程远</option>
                </select>
              </div>
              <div>
                <SectionLabel label="优先级" required/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                  {(["P0","P1","P2","P3"] as DefectPriority[]).map(p=>{
                    const cfg=PRIORITY_BTN_CFG[p];const sel=priority===p;
                    return(
                      <button key={p} onClick={()=>{setPriority(p);markDirty();}}
                        style={{height:32,border:`1.5px solid ${sel?cfg.border:T.border}`,borderRadius:7,fontSize:12,fontWeight:sel?700:400,cursor:"pointer",background:sel?cfg.bg:"#fff",color:sel?cfg.color:T.t3,transition:"all 0.12s"}}>
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <SectionLabel label="严重级别" required/>
                <select value={severity} onChange={e=>{setSeverity(e.target.value as DefectSeverity);markDirty();}} style={fSelStyle}>
                  {(["致命","严重","一般","轻微"] as DefectSeverity[]).map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <SectionLabel label="Bug 类型"/>
                <select style={fSelStyle}>
                  <option value="">请选择类型</option>
                  <option>功能缺陷</option><option>UI/样式</option><option>性能问题</option>
                  <option>兼容性</option><option>安全漏洞</option><option>逻辑错误</option><option>数据问题</option>
                </select>
              </div>
              <div>
                <SectionLabel label="所属模块"/>
                <select value={module_} onChange={e=>{setModule(e.target.value);markDirty();}} style={fSelStyle}>
                  <option value="">请选择模块</option>
                  {["用户中心","订单中心","获客中心","风控中心","接口自动化","报告"].map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div>
                  <SectionLabel label="影响版本"/>
                  <select style={{...fSelStyle,padding:"0 6px"}}>
                    <option value="">版本</option>
                    <option>v2.4.0</option><option>v2.3.5</option><option>v2.3.0</option>
                    <option>v2.2.1</option><option>v2.1.0</option>
                  </select>
                </div>
                <div>
                  <SectionLabel label="发现环境"/>
                  <select style={{...fSelStyle,padding:"0 6px"}}>
                    <option value="">环境</option>
                    <option>生产环境</option><option>预发布</option><option>测试环境</option>
                    <option>开发环境</option><option>本地</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{background:"#fff",borderRadius:10,border:`1px solid ${T.border}`,padding:"16px"}}>
              <div style={{display:"flex",alignItems:"center",marginBottom:8}}>
                <SectionLabel label="关联用例"/>
                <div style={{flex:1}}/>
                <button onClick={()=>setShowCasePicker(true)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"4px 12px",border:`1.5px solid ${T.danger}`,borderRadius:6,fontSize:12,color:T.danger,background:`${T.danger}06`,cursor:"pointer",fontWeight:500}}>
                  <Plus size={11}/>{relatedCases.length>0?"管理关联":"选择用例"}
                </button>
              </div>
              {relatedCases.length===0?(
                <div style={{padding:"10px 12px",border:`1.5px dashed ${T.border}`,borderRadius:8,fontSize:12,color:T.t4,textAlign:"center"}}>
                  未关联用例 — 点击「选择用例」从用例库中选择
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {relatedCases.map(id=>(
                    <div key={id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",border:`1px solid ${T.border}`,borderRadius:7,background:"#FAFBFE"}}>
                      <span style={{fontFamily:"monospace",fontSize:11,color:T.primary,fontWeight:700}}>{id}</span>
                      <span style={{flex:1,fontSize:12,color:T.t3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {PICKER_CASES.find(c=>c.id===id)?.title||""}
                      </span>
                      <button onClick={()=>setRelatedCases(cs=>cs.filter(x=>x!==id))} style={{background:"none",border:"none",cursor:"pointer",color:T.t4,lineHeight:0,padding:2}}
                        onMouseEnter={e=>e.currentTarget.style.color=T.danger} onMouseLeave={e=>e.currentTarget.style.color=T.t4}>
                        <X size={12}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{background:"#fff",borderRadius:10,border:`1px solid ${T.border}`,padding:"16px"}}>
              <SectionLabel label="标签"/>
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:tags.length?8:0}}>
                {tags.map(t=>(
                  <span key={t} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:12,background:`${T.danger}12`,border:`1px solid ${T.danger}30`,fontSize:11,color:T.danger}}>
                    {t}
                    <button onClick={()=>setTags(ts=>ts.filter(x=>x!==t))} style={{background:"none",border:"none",cursor:"pointer",padding:0,lineHeight:0,color:T.danger,opacity:0.6}}>×</button>
                  </span>
                ))}
              </div>
              <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();addTag();}}}
                placeholder="输入后按回车添加标签"
                style={{width:"100%",height:32,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none",boxSizing:"border-box"}}
                onFocus={e=>e.currentTarget.style.borderColor=T.danger} onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
            </div>
            <div style={{background:"#fff",borderRadius:10,border:`1px solid ${T.border}`,padding:"16px"}}>
              <SectionLabel label="来源类型"/>
              <select style={fSelStyle}>
                <option>手动发现</option><option>用例执行</option><option>AI 检测</option><option>代码审查</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <div style={{flexShrink:0,background:"#fff",borderTop:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"flex-end",gap:8}}>
        <button onClick={handleBack} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:8,background:"#fff",fontSize:13,color:T.t2,cursor:"pointer"}}>取消</button>
        <button onClick={()=>{setIsDirty(false);}} style={{padding:"7px 18px",border:`1px solid ${T.danger}`,borderRadius:8,background:"#fff",fontSize:13,color:T.danger,cursor:"pointer"}}>保存并继续创建</button>
        <button onClick={()=>{setIsDirty(false);onBack();}} style={{padding:"7px 24px",border:"none",borderRadius:8,background:T.danger,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          {isEdit?"保存修改":"创建缺陷"}
        </button>
      </div>
      {showCasePicker&&<RelatedCaseModal selected={relatedCases} onClose={(ids)=>{if(ids.length){setRelatedCases(ids);markDirty();}setShowCasePicker(false);}}/>}
      {showUnsaved&&<UnsavedConfirmModal onStay={()=>setShowUnsaved(false)} onDiscard={()=>{setShowUnsaved(false);setIsDirty(false);onBack();}}/>}
    </div>
  );
}

// ─── BugsModule container ─────────────────────────────────────────────────────

export function BugsModule() {
  const[view,setView]=useState<"list"|"stats"|"add-defect"|"edit-defect">("list");
  const[editBug,setEditBug]=useState<Bug|null>(null);

  if(view==="add-defect"||view==="edit-defect"){
    return <AddDefectPage bug={editBug} onBack={()=>{setEditBug(null);setView("list");}}/>;
  }

  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center flex-shrink-0 px-5 bg-white" style={{borderBottom:`1px solid ${T.border}`,height:44}}>
        {[{key:"list",label:"缺陷列表"},{key:"stats",label:"统计视图"}].map(t=>(
          <button key={t.key} onClick={()=>setView(t.key as any)}
            className="h-full px-4 text-[13px] font-medium border-b-2 transition-colors"
            style={{borderBottomColor:view===t.key?T.danger:"transparent",color:view===t.key?T.danger:T.t3}}>
            {t.label}
          </button>
        ))}
      </div>
      {view==="list"&&<BugList onAddNew={()=>setView("add-defect")} onEditFull={(b)=>{setEditBug(b);setView("edit-defect");}}/>}
      {view==="stats"&&<BugStats/>}
    </div>
  );
}
