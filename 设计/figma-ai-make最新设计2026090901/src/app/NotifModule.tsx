import React, { useState } from "react";
import {
  Plus, Edit2, Trash2, X, Save, Search, Bell, Mail, Globe2,
  CheckCircle, AlertTriangle, AlertCircle, Clock, Eye, EyeOff,
  Power, RefreshCw, ExternalLink, ChevronRight, Send, Copy,
  FileText, Zap, RotateCcw, Shield,
} from "lucide-react";

// ─── Palette ──────────────────────────────────────────────────────────────────
const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  border:"#E5E6EB",  bg:"#F4F6FA",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};
const NC = "#8B5CF6"; // notification module accent (violet)

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifTab   = "channels"|"rules"|"history";
type ChanType   = "企业微信"|"钉钉"|"邮件"|"Webhook";
type SendResult = "success"|"failed"|null;
type TriggerEvent = "执行失败"|"执行完成"|"套件失败"|"缺陷创建"|"缺陷流转"|"AI生成失败"|"定时报告";
type ApplyModule  = "全部"|"接口自动化"|"Web UI 自动化"|"任务中心"|"缺陷管理";
type TriggerCond  = "全部通知"|"仅失败"|"仅 P0/P1"|"连续失败 3 次";

interface NotifChannel {
  id:string; name:string; type:ChanType; webhook:string;
  secret?:string; enabled:boolean; note?:string;
  lastSentAt:string|null; lastResult:SendResult; linkedRules:number;
}
interface NotifRule {
  id:string; name:string; event:TriggerEvent; module:ApplyModule;
  condition:TriggerCond; channelId:string; channelName:string;
  inclReport:boolean; inclFailStep:boolean; inclAiSummary:boolean;
  enabled:boolean; createdAt:string;
}
interface NotifHistory {
  id:string; sentAt:string; channelId:string; channelName:string;
  channelType:ChanType; event:TriggerEvent; target:string;
  result:SendResult; failReason?:string; duration:number;
  payload?:string; response?:string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const INIT_CHANNELS: NotifChannel[] = [
  {id:"c1",name:"QA 团队机器人",type:"企业微信",webhook:"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=••••••••",secret:"••••••",enabled:true,note:"QA日常测试结果通知，主要渠道",lastSentAt:"2026-07-07 10:15",lastResult:"success",linkedRules:3},
  {id:"c2",name:"故障告警机器人",type:"企业微信",webhook:"https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=••••••••",enabled:true,note:"P0/P1 故障专用告警",lastSentAt:"2026-07-07 01:08",lastResult:"failed",linkedRules:2},
  {id:"c3",name:"缺陷邮件通知",type:"邮件",webhook:"smtp://mail.company.com:465",enabled:false,note:"备用邮件通知渠道",lastSentAt:"2026-07-05 09:00",lastResult:"failed",linkedRules:1},
  {id:"c4",name:"第三方 Webhook",type:"Webhook",webhook:"https://hooks.example.com/services/T••••/B••••/••••",enabled:true,lastSentAt:null,lastResult:null,linkedRules:0},
];

const INIT_RULES: NotifRule[] = [
  {id:"r1",name:"接口执行失败告警",event:"执行失败",module:"接口自动化",condition:"仅失败",channelId:"c1",channelName:"QA 团队机器人",inclReport:true,inclFailStep:true,inclAiSummary:true,enabled:true,createdAt:"2026-01-01"},
  {id:"r2",name:"每日测试报告推送",event:"定时报告",module:"全部",condition:"全部通知",channelId:"c1",channelName:"QA 团队机器人",inclReport:true,inclFailStep:false,inclAiSummary:false,enabled:true,createdAt:"2026-01-15"},
  {id:"r3",name:"P0 任务连续失败",event:"执行失败",module:"任务中心",condition:"连续失败 3 次",channelId:"c2",channelName:"故障告警机器人",inclReport:true,inclFailStep:true,inclAiSummary:true,enabled:true,createdAt:"2026-03-10"},
  {id:"r4",name:"高优缺陷创建通知",event:"缺陷创建",module:"缺陷管理",condition:"仅 P0/P1",channelId:"c2",channelName:"故障告警机器人",inclReport:false,inclFailStep:false,inclAiSummary:false,enabled:false,createdAt:"2026-02-20"},
  {id:"r5",name:"Web UI 套件失败",event:"套件失败",module:"Web UI 自动化",condition:"仅失败",channelId:"c1",channelName:"QA 团队机器人",inclReport:true,inclFailStep:true,inclAiSummary:false,enabled:true,createdAt:"2026-04-01"},
];

const INIT_HISTORY: NotifHistory[] = [
  {id:"h1",sentAt:"2026-07-07 10:15:32",channelId:"c1",channelName:"QA 团队机器人",channelType:"企业微信",event:"执行失败",target:"任务 #T001 · 订单接口回归",result:"success",duration:312,payload:'{"msgtype":"markdown","markdown":{"content":"## 执行失败告警..."}}',response:'{"errcode":0,"errmsg":"ok"}'},
  {id:"h2",sentAt:"2026-07-07 09:00:05",channelId:"c1",channelName:"QA 团队机器人",channelType:"企业微信",event:"定时报告",target:"每日测试报告 2026-07-07",result:"success",duration:445},
  {id:"h3",sentAt:"2026-07-07 01:08:22",channelId:"c2",channelName:"故障告警机器人",channelType:"企业微信",event:"执行失败",target:"任务 #T002 · 风控场景验证",result:"failed",failReason:"Webhook 响应超时（30s），连接被重置",duration:30000},
  {id:"h4",sentAt:"2026-07-06 17:45:11",channelId:"c1",channelName:"QA 团队机器人",channelType:"企业微信",event:"缺陷创建",target:"BUG-042 · 订单金额计算错误",result:"success",duration:289},
  {id:"h5",sentAt:"2026-07-06 16:30:08",channelId:"c3",channelName:"缺陷邮件通知",channelType:"邮件",event:"缺陷流转",target:"BUG-038 · 登录异常",result:"failed",failReason:"SMTP 认证失败：用户名或密码错误",duration:5023},
  {id:"h6",sentAt:"2026-07-06 09:00:03",channelId:"c1",channelName:"QA 团队机器人",channelType:"企业微信",event:"定时报告",target:"每日测试报告 2026-07-06",result:"success",duration:391},
];

const CHAN_TYPE_CFG: Record<ChanType,{icon:React.ElementType;color:string;bg:string}> = {
  "企业微信": {icon:Bell,  color:"#07C160",bg:"#E8FFEE"},
  "钉钉":     {icon:Bell,  color:"#FF6900",bg:"#FFF3E8"},
  "邮件":     {icon:Mail,  color:T.primary, bg:"#E8F3FF"},
  "Webhook":  {icon:Globe2,color:NC,        bg:"#F5F0FF"},
};

const TRIGGER_EVENTS: TriggerEvent[] = ["执行失败","执行完成","套件失败","缺陷创建","缺陷流转","AI生成失败","定时报告"];
const APPLY_MODULES: ApplyModule[]   = ["全部","接口自动化","Web UI 自动化","任务中心","缺陷管理"];
const TRIGGER_CONDS: TriggerCond[]   = ["全部通知","仅失败","仅 P0/P1","连续失败 3 次"];

// ─── Local atoms ──────────────────────────────────────────────────────────────
function NBtn({children,onClick,icon:Icon,small,color=T.primary,ghost,disabled}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;ghost?:boolean;disabled?:boolean}){
  if(ghost)return<button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium bg-white" style={{borderColor:T.border,color:T.t2,opacity:disabled?.5:1}}>{Icon&&<Icon size={13}/>}{children}</button>;
  return<button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-all active:scale-[0.98]" style={{backgroundColor:color,color:"#fff",height:small?28:32,padding:small?"0 10px":"0 14px",fontSize:small?12:13,opacity:disabled?.6:1}} onMouseEnter={e=>{if(!disabled)(e.currentTarget as HTMLButtonElement).style.filter="brightness(1.1)";}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.filter=""}}>{Icon&&<Icon size={small?12:13}/>}{children}</button>;
}
function IBtn({icon:Icon,label,danger,onClick}:{icon:React.ElementType;label:string;danger?:boolean;onClick?:()=>void}){
  return<button title={label} onClick={e=>{e.stopPropagation();onClick?.();}} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{color:T.t4}} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color=danger?T.danger:T.t1;(e.currentTarget as HTMLButtonElement).style.backgroundColor=danger?"#FFF0F0":"#F2F3F5";}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color=T.t4;(e.currentTarget as HTMLButtonElement).style.backgroundColor="transparent";}}><Icon size={13}/></button>;
}
function Toggle({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}){
  return<button onClick={()=>onChange(!on)} className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0" style={{backgroundColor:on?T.primary:"#C9CDD4"}}><span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all" style={{left:on?"calc(100% - 14px)":"2px"}}/></button>;
}
function SInp({value,onChange,placeholder,type="text",suffix,prefix}:{value?:string;onChange?:(v:string)=>void;placeholder?:string;type?:string;suffix?:React.ReactNode;prefix?:React.ReactNode}){
  return<div className="relative flex items-center">{prefix&&<span className="absolute left-2.5 pointer-events-none" style={{color:T.t3}}>{prefix}</span>}<input type={type} value={value} onChange={e=>onChange?.(e.target.value)} placeholder={placeholder} className="h-8 w-full border rounded-lg text-[13px] outline-none transition-all" style={{borderColor:T.border,color:T.t1,paddingLeft:prefix?"32px":"12px",paddingRight:suffix?"36px":"12px"}} onFocus={e=>{e.currentTarget.style.borderColor=NC;e.currentTarget.style.boxShadow=`0 0 0 2px ${NC}18`;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>{suffix&&<span className="absolute right-2.5" style={{color:T.t3}}>{suffix}</span>}</div>;
}
function SendResultBadge({result}:{result:SendResult}){
  if(!result)return<span style={{color:T.t4}}>—</span>;
  return<span className="inline-flex items-center gap-1.5 text-[12px]">
    <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:result==="success"?T.success:T.danger}}/>
    <span style={{color:result==="success"?T.t2:T.danger}}>{result==="success"?"成功":"失败"}</span>
  </span>;
}

// ─── Channel create/edit drawer ───────────────────────────────────────────────
function ChannelDrawer({channel,onClose,onSave}:{channel?:NotifChannel;onClose:()=>void;onSave:(c:NotifChannel)=>void}){
  const[name,setName]=useState(channel?.name??"");
  const[type,setType]=useState<ChanType>(channel?.type??"企业微信");
  const[webhook,setWebhook]=useState("");
  const[secret,setSecret]=useState("");
  const[showSecret,setShowSecret]=useState(false);
  const[enabled,setEnabled]=useState(channel?.enabled??true);
  const[note,setNote]=useState(channel?.note??"");
  const[testing,setTesting]=useState(false);
  const[testOk,setTestOk]=useState<boolean|null>(null);
  const isEdit=!!channel;

  const handleTest=()=>{
    setTesting(true);setTestOk(null);
    setTimeout(()=>{setTesting(false);setTestOk(webhook.length>0||!!channel);},1800);
  };

  return(
    <>
      <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={onClose}/>
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white" style={{width:520,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div><div className="text-[15px] font-semibold" style={{color:T.t1}}>{isEdit?"编辑通知渠道":"新增通知渠道"}</div>
            <div className="text-[12px] mt-0.5" style={{color:T.t3}}>配置 Webhook 地址和发送策略</div></div>
          <IBtn icon={X} label="关闭" onClick={onClose}/>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>渠道名称 <span style={{color:T.danger}}>*</span></label>
            <SInp placeholder="输入渠道名称" value={name} onChange={setName}/></div>
          <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>渠道类型 <span style={{color:T.danger}}>*</span></label>
            <div className="grid grid-cols-4 gap-2">
              {(["企业微信","钉钉","邮件","Webhook"] as ChanType[]).map(t=>{
                const cfg=CHAN_TYPE_CFG[t]; const on=type===t;
                return<button key={t} onClick={()=>setType(t)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border text-[12px] transition-all"
                  style={{borderColor:on?NC:T.border,backgroundColor:on?"#F5F0FF":"#fff",color:on?NC:T.t2,borderWidth:on?2:1}}>
                  <cfg.icon size={16} style={{color:on?NC:cfg.color}}/>
                  {t}
                </button>;
              })}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-medium" style={{color:T.t2}}>Webhook 地址 <span style={{color:T.danger}}>*</span></label>
              {isEdit&&<span className="text-[11px]" style={{color:T.t3}}>已配置，输入新地址以替换</span>}
            </div>
            <SInp placeholder={isEdit?"••••••••••••• (已配置)":`https://${type==="企业微信"?"qyapi.weixin.qq.com/...":type==="钉钉"?"oapi.dingtalk.com/...":"your-webhook-url"}`} value={webhook} onChange={setWebhook}/>
          </div>
          <div>
            <label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>
              {type==="企业微信"?"机器人密钥（可选）":type==="钉钉"?"签名密钥":"认证 Token"}
            </label>
            <SInp type={showSecret?"text":"password"} placeholder={isEdit?"已配置":"输入密钥（可选）"} value={secret} onChange={setSecret}
              suffix={<button style={{background:"none",border:"none",cursor:"pointer",padding:0}} onClick={()=>setShowSecret(!showSecret)}>{showSecret?<EyeOff size={14}/>:<Eye size={14}/>}</button>}/>
            <p className="text-[11px] mt-1" style={{color:T.t3}}>密钥加密存储，配置后以脱敏形式展示</p>
          </div>
          <div className="h-px" style={{backgroundColor:T.border}}/>
          <div className="flex items-center justify-between p-3.5 rounded-xl" style={{border:`1px solid ${T.border}`}}>
            <div><div className="text-[13px] font-medium" style={{color:T.t1}}>启用此渠道</div>
              <div className="text-[12px] mt-0.5" style={{color:T.t3}}>停用后该渠道将不再接收任何通知</div></div>
            <Toggle on={enabled} onChange={setEnabled}/>
          </div>
          <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>备注</label>
            <textarea placeholder="可选，描述该渠道的用途" value={note} onChange={e=>setNote(e.target.value)}
              className="w-full h-14 border rounded-lg px-3 py-2 text-[13px] outline-none resize-none"
              style={{borderColor:T.border,color:T.t1}}/></div>
          {testOk!==null&&(
            <div className="flex items-center gap-2.5 p-3 rounded-xl" style={{backgroundColor:testOk?"#E8FFEA":"#FFE8E8",border:`1px solid ${testOk?"#B7EBCA":"#FFCCC7"}`}}>
              {testOk?<CheckCircle size={15} color={T.success}/>:<AlertTriangle size={15} color={T.danger}/>}
              <span className="text-[13px]" style={{color:testOk?T.success:T.danger}}>
                {testOk?"测试发送成功，消息已送达目标渠道":"测试发送失败，请检查 Webhook 地址是否正确"}
              </span>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5" style={{borderTop:`1px solid ${T.border}`}}>
          <button onClick={handleTest} disabled={testing} className="flex items-center gap-1.5 text-[13px]" style={{color:NC,background:"none",border:"none",cursor:"pointer"}}>
            {testing?<div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{borderColor:`${NC}30`,borderTopColor:NC}}/>:<Send size={14}/>}
            {testing?"发送中...":"测试发送"}
          </button>
          <div className="flex gap-2">
            <NBtn ghost onClick={onClose}>取消</NBtn>
            <NBtn color={NC} icon={Save} onClick={()=>onSave({id:channel?.id??`c${Date.now()}`,name:name||"新渠道",type,webhook:webhook||channel?.webhook||"",secret,enabled,note,lastSentAt:channel?.lastSentAt??null,lastResult:channel?.lastResult??null,linkedRules:channel?.linkedRules??0})}>{isEdit?"保存修改":"添加渠道"}</NBtn>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Rule create/edit drawer ──────────────────────────────────────────────────
function RuleDrawer({rule,channels,onClose,onSave}:{rule?:NotifRule;channels:NotifChannel[];onClose:()=>void;onSave:(r:NotifRule)=>void}){
  const[name,setName]=useState(rule?.name??"");
  const[event,setEvent]=useState<TriggerEvent>(rule?.event??"执行失败");
  const[mod,setMod]=useState<ApplyModule>(rule?.module??"全部");
  const[cond,setCond]=useState<TriggerCond>(rule?.condition??"仅失败");
  const[chanId,setChanId]=useState(rule?.channelId??channels[0]?.id??"");
  const[inclReport,setInclReport]=useState(rule?.inclReport??true);
  const[inclFailStep,setInclFailStep]=useState(rule?.inclFailStep??false);
  const[inclAiSummary,setInclAiSummary]=useState(rule?.inclAiSummary??false);
  const[enabled,setEnabled]=useState(rule?.enabled??true);
  const isEdit=!!rule;
  const selChan=channels.find(c=>c.id===chanId);

  return(
    <>
      <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={onClose}/>
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white" style={{width:560,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div><div className="text-[15px] font-semibold" style={{color:T.t1}}>{isEdit?"编辑通知规则":"新增通知规则"}</div>
            <div className="text-[12px] mt-0.5" style={{color:T.t3}}>定义触发事件、通知渠道和内容策略</div></div>
          <IBtn icon={X} label="关闭" onClick={onClose}/>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>规则名称 <span style={{color:T.danger}}>*</span></label>
            <SInp placeholder="输入规则名称" value={name} onChange={setName}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>触发事件 <span style={{color:T.danger}}>*</span></label>
              <select className="w-full h-8 border rounded-lg px-2.5 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} value={event} onChange={e=>setEvent(e.target.value as TriggerEvent)}>
                {TRIGGER_EVENTS.map(e=><option key={e}>{e}</option>)}
              </select></div>
            <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>适用模块</label>
              <select className="w-full h-8 border rounded-lg px-2.5 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} value={mod} onChange={e=>setMod(e.target.value as ApplyModule)}>
                {APPLY_MODULES.map(m=><option key={m}>{m}</option>)}
              </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>触发条件</label>
              <select className="w-full h-8 border rounded-lg px-2.5 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} value={cond} onChange={e=>setCond(e.target.value as TriggerCond)}>
                {TRIGGER_CONDS.map(c=><option key={c}>{c}</option>)}
              </select></div>
            <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>通知渠道 <span style={{color:T.danger}}>*</span></label>
              <select className="w-full h-8 border rounded-lg px-2.5 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} value={chanId} onChange={e=>setChanId(e.target.value)}>
                {channels.filter(c=>c.enabled).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
          </div>
          {selChan&&(
            <div className="flex items-center gap-2 p-2.5 rounded-lg" style={{backgroundColor:"#F5F0FF",border:`1px solid ${NC}30`}}>
              <Bell size={13} color={NC}/>
              <span className="text-[12px]" style={{color:NC}}>将通知到「{selChan.name}」({selChan.type})</span>
            </div>
          )}
          <div className="h-px" style={{backgroundColor:T.border}}/>
          <div>
            <div className="text-[12px] font-semibold mb-3" style={{color:T.t3}}>通知内容</div>
            <div className="flex flex-col gap-2">
              {[
                {label:"包含报告链接",desc:"在通知消息中附上测试报告的访问链接",on:inclReport,set:setInclReport},
                {label:"包含失败步骤",desc:"在通知消息中展示前 5 个失败步骤详情",on:inclFailStep,set:setInclFailStep},
                {label:"包含 AI 分析摘要",desc:"在通知消息中包含 AI 失败原因分析（需配置 AI 连接）",on:inclAiSummary,set:setInclAiSummary},
              ].map((s,i)=>(
                <div key={i} className="flex items-center justify-between p-3 rounded-xl" style={{border:`1px solid ${T.border}`}}>
                  <div><div className="text-[13px] font-medium" style={{color:T.t1}}>{s.label}</div>
                    <div className="text-[12px] mt-0.5" style={{color:T.t3}}>{s.desc}</div></div>
                  <Toggle on={s.on} onChange={s.set}/>
                </div>
              ))}
            </div>
          </div>
          <div className="h-px" style={{backgroundColor:T.border}}/>
          <div className="flex items-center justify-between p-3.5 rounded-xl" style={{border:`1px solid ${T.border}`}}>
            <div><div className="text-[13px] font-medium" style={{color:T.t1}}>启用此规则</div>
              <div className="text-[12px] mt-0.5" style={{color:T.t3}}>停用后该规则不会触发任何通知</div></div>
            <Toggle on={enabled} onChange={setEnabled}/>
          </div>
        </div>
        <div className="flex-shrink-0 flex justify-end gap-2 px-5 py-3.5" style={{borderTop:`1px solid ${T.border}`}}>
          <NBtn ghost onClick={onClose}>取消</NBtn>
          <NBtn color={NC} icon={Save} onClick={()=>onSave({id:rule?.id??`r${Date.now()}`,name:name||"新规则",event,module:mod,condition:cond,channelId:chanId,channelName:selChan?.name??"-",inclReport,inclFailStep,inclAiSummary,enabled,createdAt:rule?.createdAt??"2026-07-07"})}>{isEdit?"保存修改":"创建规则"}</NBtn>
        </div>
      </div>
    </>
  );
}

// ─── History detail drawer ────────────────────────────────────────────────────
function HistoryDetailDrawer({record,onClose,onRetry}:{record:NotifHistory;onClose:()=>void;onRetry:()=>void}){
  const ok=record.result==="success";
  const rows:[string,React.ReactNode][]=[
    ["发送时间",<span className="font-mono text-[12px]">{record.sentAt}</span>],
    ["通知渠道",record.channelName],
    ["渠道类型",record.channelType],
    ["触发事件",<span className="px-2 py-0.5 rounded text-[11px]" style={{backgroundColor:"#F5F0FF",color:NC}}>{record.event}</span>],
    ["关联对象",record.target],
    ["发送结果",<span className="inline-flex items-center gap-1.5 text-[12px]"><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:ok?T.success:T.danger}}/><span style={{color:ok?T.success:T.danger}}>{ok?"成功":"失败"}</span></span>],
    ["耗时",<span className="font-mono text-[12px]">{record.duration>=1000?`${(record.duration/1000).toFixed(1)}s`:`${record.duration}ms`}</span>],
  ];
  return(
    <>
      <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={onClose}/>
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white" style={{width:680,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div><div className="text-[15px] font-semibold" style={{color:T.t1}}>发送详情</div>
            <div className="text-[12px] mt-0.5" style={{color:T.t3}}>{record.sentAt}</div></div>
          <div className="flex items-center gap-2">
            {!ok&&<NBtn icon={RotateCcw} small color={T.warning} onClick={onRetry}>重试发送</NBtn>}
            <IBtn icon={X} label="关闭" onClick={onClose}/>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {/* Status banner */}
          <div className={`flex items-center gap-3 p-4 rounded-xl mb-5`} style={{backgroundColor:ok?"#E8FFEA":"#FFE8E8"}}>
            {ok?<CheckCircle size={22} color={T.success}/>:<AlertTriangle size={22} color={T.danger}/>}
            <div>
              <div className="text-[14px] font-semibold" style={{color:ok?T.success:T.danger}}>{ok?"通知发送成功":"通知发送失败"}</div>
              {!ok&&record.failReason&&<div className="text-[12px] mt-0.5" style={{color:"#CC2222"}}>{record.failReason}</div>}
            </div>
          </div>
          {/* Basic info */}
          <div className="rounded-xl overflow-hidden mb-4" style={{border:`1px solid ${T.border}`}}>
            {rows.map(([label,value],i)=>(
              <div key={i} className="flex items-center px-4 py-2.5" style={{backgroundColor:i%2===0?"#FAFAFA":"#fff",borderTop:i>0?`1px solid ${T.border}`:"none"}}>
                <span className="w-20 flex-shrink-0 text-[12px]" style={{color:T.t3}}>{label}</span>
                <span className="flex-1 text-[13px]" style={{color:T.t2}}>{value}</span>
              </div>
            ))}
          </div>
          {/* Payload preview */}
          {record.payload&&(
            <div className="mb-4">
              <div className="text-[12px] font-semibold mb-2" style={{color:T.t3}}>通知内容（Payload）</div>
              <div className="rounded-xl p-4 font-mono text-[11px] overflow-x-auto" style={{backgroundColor:"#010409",color:"#79C0FF",border:`1px solid #21262D`}}>
                {record.payload}
              </div>
            </div>
          )}
          {/* Response */}
          {record.response&&(
            <div className="mb-4">
              <div className="text-[12px] font-semibold mb-2" style={{color:T.t3}}>Webhook 响应</div>
              <div className="rounded-xl p-4 font-mono text-[11px] overflow-x-auto" style={{backgroundColor:"#010409",color:"#3FB950",border:`1px solid #21262D`}}>
                {record.response}
              </div>
            </div>
          )}
          {/* Recommendations */}
          {!ok&&(
            <div className="p-4 rounded-xl" style={{backgroundColor:"#FFF3E8",border:"1px solid #FFD6A0"}}>
              <div className="text-[12px] font-semibold mb-2" style={{color:T.warning}}>排查建议</div>
              <ul className="flex flex-col gap-1.5 text-[12px]" style={{color:T.t2}}>
                <li>· 确认 Webhook 地址是否有效，可在渠道管理中点击「测试发送」验证</li>
                <li>· 检查机器人密钥或签名是否配置正确</li>
                <li>· 若超时，可适当提高网络超时配置，或检查企业微信服务状态</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Channels tab ─────────────────────────────────────────────────────────────
function ChannelsTab(){
  const[channels,setChannels]=useState<NotifChannel[]>(INIT_CHANNELS);
  const[search,setSearch]=useState("");
  const[showDrawer,setShowDrawer]=useState(false);
  const[editChan,setEditChan]=useState<NotifChannel|null>(null);
  const[delConfirm,setDelConfirm]=useState<NotifChannel|null>(null);
  const[testingId,setTestingId]=useState<string|null>(null);
  const filtered=channels.filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase())||c.type.includes(search));
  const handleTest=(c:NotifChannel)=>{
    setTestingId(c.id);
    setTimeout(()=>setTestingId(null),2000);
  };
  const stats=[
    {label:"渠道总数",value:channels.length,color:T.t2,bg:"#F2F3F5"},
    {label:"已启用",value:channels.filter(c=>c.enabled).length,color:T.success,bg:"#E8FFEA"},
    {label:"发送异常",value:channels.filter(c=>c.lastResult==="failed").length,color:T.danger,bg:"#FFE8E8"},
    {label:"关联规则",value:channels.reduce((s,c)=>s+c.linkedRules,0),color:NC,bg:"#F5F0FF"},
  ];
  return(
    <div className="flex-1 overflow-y-auto p-5">
      <div className="grid grid-cols-4 gap-3 mb-5">
        {stats.map(({label,value,color,bg},i)=>(
          <div key={i} className="bg-white rounded-xl p-4 flex items-center gap-3" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:bg}}>
              <span className="text-[18px] font-bold" style={{color}}>{value}</span>
            </div>
            <span className="text-[12px]" style={{color:T.t3}}>{label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-4">
        <SInp placeholder="搜索渠道名称或类型" prefix={<Search size={12}/>} value={search} onChange={setSearch}/>
        <NBtn icon={Plus} color={NC} onClick={()=>{setEditChan(null);setShowDrawer(true);}}>新增渠道</NBtn>
      </div>
      {filtered.length===0?(
        <div className="bg-white rounded-2xl flex flex-col items-center justify-center py-20" style={{border:`1px solid ${T.border}`}}>
          <Bell size={32} color={T.t4} className="mb-3"/>
          <p className="text-[14px] font-medium" style={{color:T.t2}}>暂无通知渠道</p>
          <p className="text-[12px] mt-1.5 mb-5" style={{color:T.t3}}>添加企业微信机器人、邮件或 Webhook 通知渠道</p>
          <NBtn icon={Plus} color={NC} onClick={()=>setShowDrawer(true)}>新增渠道</NBtn>
        </div>
      ):(
        <div className="bg-white rounded-2xl overflow-hidden" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <table className="w-full border-collapse">
            <thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
              {["渠道名称","类型","Webhook 地址","状态","最近发送","关联规则","操作"].map((h,i)=>(
                <th key={i} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-left" style={{color:T.t3}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(c=>{
                const cfg=CHAN_TYPE_CFG[c.type]; const isTest=testingId===c.id;
                return(
                  <tr key={c.id} className="border-b last:border-0" style={{borderColor:T.border,height:52}} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#FAFBFF"} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:cfg.bg}}><cfg.icon size={14} style={{color:cfg.color}}/></div>
                        <div><div className="text-[13px] font-medium" style={{color:T.t1}}>{c.name}</div>
                          {c.note&&<div className="text-[11px]" style={{color:T.t3}}>{c.note}</div>}</div>
                      </div>
                    </td>
                    <td className="px-4 py-2"><span className="text-[12px] px-2 py-0.5 rounded" style={{backgroundColor:cfg.bg,color:cfg.color}}>{c.type}</span></td>
                    <td className="px-4 py-2 max-w-[180px]"><code className="text-[11px] font-mono truncate block" style={{color:T.t3}} title={c.webhook}>{c.webhook}</code></td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[12px]">
                        <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:c.enabled?T.success:T.t4}}/>
                        <span style={{color:c.enabled?T.t2:T.t3}}>{c.enabled?"已启用":"已停用"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {c.lastSentAt?(
                        <div><SendResultBadge result={c.lastResult}/>
                          <div className="text-[10px] font-mono mt-0.5" style={{color:T.t4}}>{c.lastSentAt}</div></div>
                      ):<span style={{color:T.t4,fontSize:12}}>从未发送</span>}
                    </td>
                    <td className="px-4 py-2"><span className="text-[12px] px-2 py-0.5 rounded" style={{backgroundColor:"#F5F0FF",color:NC}}>{c.linkedRules} 条规则</span></td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-0.5">
                        <IBtn icon={isTest?Clock:Send} label="测试发送" onClick={()=>!isTest&&handleTest(c)}/>
                        <IBtn icon={Edit2} label="编辑" onClick={()=>{setEditChan(c);setShowDrawer(true);}}/>
                        <IBtn icon={Power} label={c.enabled?"停用":"启用"} onClick={()=>setChannels(prev=>prev.map(x=>x.id===c.id?{...x,enabled:!x.enabled}:x))}/>
                        <IBtn icon={Trash2} label="删除" danger onClick={()=>setDelConfirm(c)}/>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(showDrawer||editChan)&&<ChannelDrawer channel={editChan??undefined} onClose={()=>{setShowDrawer(false);setEditChan(null);}} onSave={c=>{if(editChan)setChannels(p=>p.map(x=>x.id===editChan.id?c:x));else setChannels(p=>[...p,c]);setShowDrawer(false);setEditChan(null);}}/>}
      {delConfirm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.28)"}}>
          <div className="bg-white rounded-2xl p-6 w-[400px]" style={{boxShadow:"0 20px 60px rgba(0,0,0,0.16)"}}>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{backgroundColor:"#FFE8E8"}}><Trash2 size={18} color={T.danger}/></div>
              <div><div className="text-[15px] font-semibold mb-1" style={{color:T.t1}}>删除渠道</div>
                <div className="text-[13px]" style={{color:T.t3}}>确认删除「{delConfirm.name}」？该渠道关联了 {delConfirm.linkedRules} 条通知规则，删除后相关规则将停止发送。</div></div>
            </div>
            <div className="flex justify-end gap-2">
              <NBtn ghost onClick={()=>setDelConfirm(null)}>取消</NBtn>
              <NBtn color={T.danger} onClick={()=>{setChannels(p=>p.filter(c=>c.id!==delConfirm.id));setDelConfirm(null);}}>确认删除</NBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Rules tab ────────────────────────────────────────────────────────────────
function RulesTab({channels}:{channels:NotifChannel[]}){
  const[rules,setRules]=useState<NotifRule[]>(INIT_RULES);
  const[search,setSearch]=useState("");
  const[showDrawer,setShowDrawer]=useState(false);
  const[editRule,setEditRule]=useState<NotifRule|null>(null);
  const filtered=rules.filter(r=>!search||r.name.includes(search)||r.event.includes(search));
  return(
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex items-center gap-2 mb-4">
        <SInp placeholder="搜索规则名称或事件" prefix={<Search size={12}/>} value={search} onChange={setSearch}/>
        <NBtn icon={Plus} color={NC} onClick={()=>{setEditRule(null);setShowDrawer(true);}}>新增规则</NBtn>
      </div>
      {filtered.length===0?(
        <div className="bg-white rounded-2xl flex flex-col items-center justify-center py-20" style={{border:`1px solid ${T.border}`}}>
          <Zap size={32} color={T.t4} className="mb-3"/>
          <p className="text-[14px] font-medium" style={{color:T.t2}}>暂无通知规则</p>
          <p className="text-[12px] mt-1.5 mb-5" style={{color:T.t3}}>创建规则以定义哪些事件会触发通知</p>
          <NBtn icon={Plus} color={NC} onClick={()=>setShowDrawer(true)}>新增规则</NBtn>
        </div>
      ):(
        <div className="bg-white rounded-2xl overflow-hidden" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <table className="w-full border-collapse">
            <thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
              {["规则名称","触发事件","适用模块","触发条件","通知渠道","内容选项","状态","创建时间","操作"].map((h,i)=>(
                <th key={i} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-left" style={{color:T.t3}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(r=>(
                <tr key={r.id} className="border-b last:border-0" style={{borderColor:T.border,height:52}} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#FAFBFF"} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}>
                  <td className="px-3 py-2 text-[13px] font-medium" style={{color:T.t1}}>{r.name}</td>
                  <td className="px-3 py-2"><span className="text-[11px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#F5F0FF",color:NC}}>{r.event}</span></td>
                  <td className="px-3 py-2 text-[12px]" style={{color:T.t2}}>{r.module}</td>
                  <td className="px-3 py-2 text-[12px]" style={{color:T.t2}}>{r.condition}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Bell size={11} color={NC}/>
                      <span className="text-[12px]" style={{color:T.t2}}>{r.channelName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {r.inclReport&&<span className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#E8F3FF",color:T.primary}}>报告</span>}
                      {r.inclFailStep&&<span className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#FFE8E8",color:T.danger}}>步骤</span>}
                      {r.inclAiSummary&&<span className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#F5F0FF",color:NC}}>AI</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-[12px]">
                      <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:r.enabled?T.success:T.t4}}/>
                      <span style={{color:r.enabled?T.t2:T.t3}}>{r.enabled?"已启用":"已停用"}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px]" style={{color:T.t4}}>{r.createdAt}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-0.5">
                      <IBtn icon={Edit2} label="编辑" onClick={()=>{setEditRule(r);setShowDrawer(true);}}/>
                      <IBtn icon={Copy} label="复制" onClick={()=>setRules(p=>[...p,{...r,id:`r${Date.now()}`,name:`${r.name}（副本）`,enabled:false}])}/>
                      <IBtn icon={Power} label={r.enabled?"停用":"启用"} onClick={()=>setRules(p=>p.map(x=>x.id===r.id?{...x,enabled:!x.enabled}:x))}/>
                      <IBtn icon={Trash2} label="删除" danger onClick={()=>setRules(p=>p.filter(x=>x.id!==r.id))}/>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(showDrawer||editRule)&&<RuleDrawer rule={editRule??undefined} channels={channels} onClose={()=>{setShowDrawer(false);setEditRule(null);}} onSave={r=>{if(editRule)setRules(p=>p.map(x=>x.id===editRule.id?r:x));else setRules(p=>[...p,r]);setShowDrawer(false);setEditRule(null);}}/>}
    </div>
  );
}

// ─── History tab ──────────────────────────────────────────────────────────────
function HistoryTab(){
  const[history]=useState<NotifHistory[]>(INIT_HISTORY);
  const[search,setSearch]=useState("");
  const[filterResult,setFilterResult]=useState("all");
  const[detail,setDetail]=useState<NotifHistory|null>(null);
  const filtered=history.filter(h=>{
    if(search&&!h.channelName.includes(search)&&!h.event.includes(search)&&!h.target.includes(search))return false;
    if(filterResult==="success"&&h.result!=="success")return false;
    if(filterResult==="failed"&&h.result!=="failed")return false;
    return true;
  });
  return(
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex items-center gap-2 mb-4">
        <SInp placeholder="搜索渠道、事件或关联对象" prefix={<Search size={12}/>} value={search} onChange={setSearch}/>
        <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:120}} value={filterResult} onChange={e=>setFilterResult(e.target.value)}>
          <option value="all">全部结果</option><option value="success">成功</option><option value="failed">失败</option>
        </select>
      </div>
      <div className="bg-white rounded-2xl overflow-hidden" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        <table className="w-full border-collapse">
          <thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
            {["发送时间","通知渠道","触发事件","关联对象","结果","耗时","操作"].map((h,i)=>(
              <th key={i} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-left" style={{color:T.t3}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length===0?(
              <tr><td colSpan={7} className="py-16 text-center">
                <Clock size={28} color={T.t4} className="mx-auto mb-2"/>
                <p className="text-[13px]" style={{color:T.t3}}>暂无发送记录</p>
              </td></tr>
            ):filtered.map(h=>{
              const ok=h.result==="success";
              const cfg=CHAN_TYPE_CFG[h.channelType];
              return(
                <tr key={h.id} className="border-b last:border-0" style={{borderColor:T.border,height:48}} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#FAFBFF"} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}>
                  <td className="px-4 py-2 text-[12px] font-mono" style={{color:T.t3}}>{h.sentAt}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{backgroundColor:cfg.bg}}><cfg.icon size={11} style={{color:cfg.color}}/></div>
                      <span className="text-[12px]" style={{color:T.t2}}>{h.channelName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2"><span className="text-[11px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#F5F0FF",color:NC}}>{h.event}</span></td>
                  <td className="px-4 py-2 text-[12px]" style={{color:T.t2}}>{h.target}</td>
                  <td className="px-4 py-2">
                    {ok?(
                      <SendResultBadge result="success"/>
                    ):(
                      <div>
                        <SendResultBadge result="failed"/>
                        {h.failReason&&<div className="text-[10px] mt-0.5 truncate max-w-[160px]" style={{color:T.danger}} title={h.failReason}>{h.failReason}</div>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-[12px] font-mono" style={{color:T.t2}}>{h.duration>=1000?`${(h.duration/1000).toFixed(1)}s`:`${h.duration}ms`}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-0.5">
                      <IBtn icon={Eye} label="查看详情" onClick={()=>setDetail(h)}/>
                      {!ok&&<IBtn icon={RotateCcw} label="重试发送" onClick={()=>{}}/>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-2.5" style={{borderTop:`1px solid ${T.border}`}}>
          <span className="text-[12px]" style={{color:T.t3}}>共 {filtered.length} 条记录 · 历史数据保留 90 天</span>
        </div>
      </div>
      {detail&&<HistoryDetailDrawer record={detail} onClose={()=>setDetail(null)} onRetry={()=>setDetail(null)}/>}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function NotifModule(){
  const[tab,setTab]=useState<NotifTab>("channels");
  const[channels]=useState<NotifChannel[]>(INIT_CHANNELS);
  const tabs:[NotifTab,string,React.ElementType][]=[["channels","通知渠道",Bell],["rules","通知规则",Zap],["history","发送历史",Clock]];
  return(
    <div className="flex-1 flex flex-col overflow-hidden" style={{backgroundColor:T.bg}}>
      {/* Inner sub-tab bar */}
      <div className="flex-shrink-0 bg-white px-5 flex items-center" style={{borderBottom:`1px solid ${T.border}`,height:44}}>
        {tabs.map(([key,label,Icon])=>(
          <button key={key} onClick={()=>setTab(key)}
            className="h-full flex items-center gap-1.5 px-4 text-[13px] font-medium border-b-2 transition-colors mr-1"
            style={{borderBottomColor:tab===key?NC:"transparent",color:tab===key?NC:T.t3}}>
            <Icon size={13}/>
            {label}
          </button>
        ))}
      </div>
      {tab==="channels"&&<ChannelsTab/>}
      {tab==="rules"&&<RulesTab channels={channels}/>}
      {tab==="history"&&<HistoryTab/>}
    </div>
  );
}
