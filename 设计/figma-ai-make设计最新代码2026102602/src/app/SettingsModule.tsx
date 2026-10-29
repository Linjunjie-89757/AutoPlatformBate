import React, { useState } from "react";
import {
  LayoutDashboard, Building2, Users, Shield, Key, Clock, Crown,
  Plus, Edit2, Trash2, X, Save, Search, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle, Sparkles, Power, UserPlus, Eye, Lock,
} from "lucide-react";

// ─── Palette ─────────────────────────────────────────────────────────────────
const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F", border:"#E5E6EB", bg:"#F4F6FA",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};
const SC = "#334155"; // settings module accent (slate-700)

// ─── Types ────────────────────────────────────────────────────────────────────
type SettingsPage = "home"|"workspace"|"users"|"roles"|"perms"|"audit";
type PermState = Record<string, Record<string, boolean>>;

interface SUser {
  id:string; name:string; account:string; role:string;
  status:"active"|"disabled"; lastLogin:string; avatar:string;
}
interface SRole {
  id:string; name:string; desc:string; members:number;
  permCount:number; updatedAt:string; isSystem:boolean;
}
interface AuditRecord {
  id:string; time:string; operator:string; action:string;
  target:string; ip:string; result:"success"|"failed";
}

// ─── Permission tree config ───────────────────────────────────────────────────
const PERM_MODULES = [
  {id:"cases",   label:"用例中心",      perms:["查看","新建","编辑","删除","导出"]},
  {id:"api",     label:"接口自动化",    perms:["查看","新建","编辑","删除","执行","导出"]},
  {id:"webui",   label:"Web UI 自动化", perms:["查看","新建","编辑","删除","执行"]},
  {id:"bugs",    label:"缺陷管理",      perms:["查看","新建","编辑","删除","审核"]},
  {id:"config",  label:"配置中心",      perms:["查看","配置"]},
  {id:"reports", label:"报告中心",      perms:["查看","导出","分享"]},
  {id:"tasks",   label:"任务中心",      perms:["查看","新建","编辑","删除","执行"]},
  {id:"settings",label:"系统设置",      perms:["查看","配置","权限管理"]},
];
const RISKY = ["删除","权限管理","配置"];

const ROLE_PRESETS: Record<string,{label:string;desc:string;perms:Record<string,string[]>}> = {
  lead:{label:"测试负责人",desc:"团队管理者，有完整操作权限和报告分享权限，可查看系统设置。",
    perms:{cases:["查看","新建","编辑","删除","导出"],api:["查看","新建","编辑","删除","执行","导出"],webui:["查看","新建","编辑","删除","执行"],bugs:["查看","新建","编辑","删除","审核"],config:["查看","配置"],reports:["查看","导出","分享"],tasks:["查看","新建","编辑","删除","执行"],settings:["查看"]}},
  engineer:{label:"测试工程师",desc:"日常测试工作，有用例、自动化、缺陷完整操作权限，无系统配置权限。",
    perms:{cases:["查看","新建","编辑","导出"],api:["查看","新建","编辑","执行"],webui:["查看","新建","编辑","执行"],bugs:["查看","新建","编辑"],config:["查看"],reports:["查看","导出"],tasks:["查看","新建","执行"],settings:[]}},
  dev:{label:"开发人员",desc:"只读查看用例和报告，可新建缺陷，协助开发联调。",
    perms:{cases:["查看"],api:["查看"],webui:[],bugs:["查看","新建"],config:[],reports:["查看"],tasks:[],settings:[]}},
  guest:{label:"只读访客",desc:"仅可查看用例和报告，不可进行任何写操作。",
    perms:{cases:["查看"],api:[],webui:[],bugs:[],config:[],reports:["查看"],tasks:[],settings:[]}},
};

const makePerms = (presetKey:string): PermState =>
  Object.fromEntries(PERM_MODULES.map(m=>[m.id,Object.fromEntries((ROLE_PRESETS[presetKey]?.perms[m.id]??[]).map(p=>[p,true]))]));

// ─── Mock data ────────────────────────────────────────────────────────────────
const INIT_USERS:SUser[] = [
  {id:"U1",name:"张程远",account:"zhangcy@company.com",role:"测试负责人",status:"active",lastLogin:"2026-07-07 09:31",avatar:"张"},
  {id:"U2",name:"李明",  account:"liming@company.com",  role:"测试工程师",status:"active",lastLogin:"2026-07-07 08:45",avatar:"李"},
];
const INIT_ROLES:SRole[] = [
  {id:"R1",name:"测试负责人",desc:"负责测试团队管理、权限配置和报告审核",members:2,permCount:34,updatedAt:"2026-07-01",isSystem:false},
  {id:"R2",name:"测试工程师",desc:"负责用例编写、自动化脚本开发和执行",members:8,permCount:22,updatedAt:"2026-06-28",isSystem:false},
  {id:"R3",name:"开发人员",desc:"只读查看用例和缺陷，协助联调",members:5,permCount:8,updatedAt:"2026-06-20",isSystem:false},
  {id:"R4",name:"只读访客",desc:"仅可查看报告和用例，不可操作",members:3,permCount:4,updatedAt:"2026-06-15",isSystem:true},
];
const AUDIT_DATA:AuditRecord[] = [
  {id:"A1",time:"2026-07-07 10:15:32",operator:"张程远",action:"修改角色权限",target:"测试工程师",ip:"10.0.1.101",result:"success"},
  {id:"A2",time:"2026-07-07 09:31:08",operator:"张程远",action:"邀请成员",target:"zhounl@company.com",ip:"10.0.1.101",result:"success"},
  {id:"A3",time:"2026-07-06 17:45:22",operator:"李明",action:"修改工作区设置",target:"数据保留策略",ip:"10.0.1.102",result:"success"},
  {id:"A4",time:"2026-07-06 16:30:11",operator:"陈伟",action:"登录系统",target:"—",ip:"10.0.2.205",result:"success"},
  {id:"A5",time:"2026-07-05 14:20:45",operator:"系统",action:"自动禁用账号",target:"赵云 (30天未登录)",ip:"—",result:"success"},
  {id:"A6",time:"2026-07-04 11:05:33",operator:"张程远",action:"删除角色",target:"临时访问者",ip:"10.0.1.101",result:"success"},
];

const ROLE_AVATAR_COLOR: Record<string,string> = {
  "测试负责人":"#7816FF","测试工程师":T.primary,"开发人员":"#00B42A","只读访客":T.t3,
};
const ROLE_TAG_BG: Record<string,string> = {
  "测试负责人":"#F5E8FF","测试工程师":"#E8F3FF","开发人员":"#E8FFEA","只读访客":"#F2F3F5",
};

// ─── Platform user pool ───────────────────────────────────────────────────────
interface PoolUser { id:string; name:string; email:string; avatar:string; dept:string; }
const PLATFORM_POOL: PoolUser[] = [
  {id:"p1", name:"张程远", email:"zhangcy@company.com",  avatar:"张", dept:"研发部"},
  {id:"p2", name:"李明",   email:"liming@company.com",   avatar:"李", dept:"测试部"},
  {id:"p3", name:"王芳",   email:"wangfang@company.com", avatar:"王", dept:"数据组"},
  {id:"p4", name:"陈伟",   email:"chenwei@company.com",  avatar:"陈", dept:"支付团队"},
  {id:"p5", name:"赵云",   email:"zhaoyun@company.com",  avatar:"赵", dept:"基础架构组"},
  {id:"p6", name:"孙悟空", email:"sunwk@company.com",    avatar:"孙", dept:"用户中心"},
  {id:"p7", name:"周宁林", email:"zhounl@company.com",   avatar:"周", dept:"增长团队"},
  {id:"p8", name:"何梅",   email:"hm@partner.com",       avatar:"何", dept:"合作伙伴"},
  {id:"p9", name:"林峰",   email:"lf@company.com",       avatar:"林", dept:"消息团队"},
  {id:"p10",name:"吴晓",   email:"wux@company.com",      avatar:"吴", dept:"研发部"},
  {id:"p11",name:"郑凯",   email:"zhengk@company.com",   avatar:"郑", dept:"测试部"},
];

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function PBtn({children,onClick,icon:Icon,small,color=T.primary,variant="primary",disabled}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;variant?:"primary"|"ghost";disabled?:boolean}){
  if(variant==="ghost")return<button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium bg-white" style={{borderColor:T.border,color:T.t2,opacity:disabled?0.5:1}}>{Icon&&<Icon size={13}/>}{children}</button>;
  return<button disabled={disabled} onClick={onClick} className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-all active:scale-[0.98]" style={{backgroundColor:color,color:"#fff",height:small?28:32,padding:small?"0 10px":"0 14px",fontSize:small?12:13,opacity:disabled?0.6:1}} onMouseEnter={e=>{if(!disabled)(e.currentTarget as HTMLButtonElement).style.filter="brightness(1.1)";}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.filter=""}}>{Icon&&<Icon size={small?12:13}/>}{children}</button>;
}
function IBtn({icon:Icon,label,danger,onClick}:{icon:React.ElementType;label:string;danger?:boolean;onClick?:()=>void}){
  return<button title={label} onClick={e=>{e.stopPropagation();onClick?.();}} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{color:T.t4}} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color=danger?T.danger:T.t1;(e.currentTarget as HTMLButtonElement).style.backgroundColor=danger?"#FFF0F0":"#F2F3F5";}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color=T.t4;(e.currentTarget as HTMLButtonElement).style.backgroundColor="transparent";}}><Icon size={13}/></button>;
}
function Toggle({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}){
  return<button onClick={()=>onChange(!on)} className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0" style={{backgroundColor:on?T.primary:"#C9CDD4"}}><span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all" style={{left:on?"calc(100% - 14px)":"2px"}}/></button>;
}
function SInp({placeholder,value,onChange,prefix,width}:{placeholder?:string;value?:string;onChange?:(v:string)=>void;prefix?:React.ReactNode;width?:string|number}){
  return<div className="relative flex items-center" style={{width}}>{prefix&&<span className="absolute left-2.5 pointer-events-none" style={{color:T.t3}}>{prefix}</span>}<input placeholder={placeholder} value={value} onChange={e=>onChange?.(e.target.value)} className={`h-8 border rounded-lg bg-white text-[13px] outline-none transition-all w-full ${prefix?"pl-8 pr-3":"px-3"}`} style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.currentTarget.style.borderColor=T.primary;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/></div>;
}
function SavedBadge(){
  return<span className="text-[13px] flex items-center gap-1.5" style={{color:T.success}}><CheckCircle size={13}/>已保存</span>;
}

// ─── Permission tree ──────────────────────────────────────────────────────────
function PermTree({perms,onChange}:{perms:PermState;onChange:(p:PermState)=>void}){
  const[expanded,setExpanded]=useState<Record<string,boolean>>(Object.fromEntries(PERM_MODULES.map(m=>[m.id,true])));
  const toggle=(modId:string)=>{
    const mod=PERM_MODULES.find(m=>m.id===modId)!;
    const all=mod.perms.every(p=>perms[modId]?.[p]);
    onChange({...perms,[modId]:Object.fromEntries(mod.perms.map(p=>[p,!all]))});
  };
  const toggleP=(modId:string,perm:string)=>onChange({...perms,[modId]:{...perms[modId],[perm]:!perms[modId]?.[perm]}});
  return(
    <div className="flex flex-col gap-2">
      {PERM_MODULES.map(mod=>{
        const mp=perms[mod.id]??{};
        const cnt=mod.perms.filter(p=>mp[p]).length;
        const all=cnt===mod.perms.length;
        const some=cnt>0&&!all;
        const open=expanded[mod.id];
        const hasRisk=mod.perms.some(p=>mp[p]&&RISKY.includes(p));
        return(
          <div key={mod.id} className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
            <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none" style={{backgroundColor:"#FAFAFA"}}
              onClick={()=>setExpanded(e=>({...e,[mod.id]:!e[mod.id]}))}>
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={all} onChange={()=>toggle(mod.id)} onClick={e=>e.stopPropagation()}
                  ref={el=>{if(el)el.indeterminate=some;}} className="w-4 h-4 cursor-pointer" style={{accentColor:T.primary}}/>
                <span className="text-[13px] font-medium" style={{color:T.t1}}>{mod.label}</span>
                {cnt>0&&<span className="text-[11px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#E8F3FF",color:T.primary}}>{cnt}/{mod.perms.length}</span>}
                {hasRisk&&<span className="inline-flex items-center gap-1 text-[11px]" style={{color:T.warning}}><AlertTriangle size={10}/>含高风险</span>}
              </div>
              {open?<ChevronDown size={13} style={{color:T.t3}}/>:<ChevronRight size={13} style={{color:T.t3}}/>}
            </div>
            {open&&(
              <div className="px-4 py-3 flex flex-wrap gap-2">
                {mod.perms.map(perm=>{
                  const on=!!mp[perm]; const risky=RISKY.includes(perm);
                  return(
                    <label key={perm} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-[12px] transition-all"
                      style={{borderColor:on?(risky?T.warning:T.primary):T.border,backgroundColor:on?(risky?"#FFF3E8":"#E8F3FF"):"#fff",color:on?(risky?T.warning:T.primary):T.t2}}>
                      <input type="checkbox" checked={on} onChange={()=>toggleP(mod.id,perm)} className="w-3.5 h-3.5 cursor-pointer" style={{accentColor:risky?T.warning:T.primary}}/>
                      {perm}{risky&&<AlertTriangle size={10}/>}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings home ────────────────────────────────────────────────────────────
function SettingsHome({onNavigate}:{onNavigate:(p:SettingsPage)=>void}){
  const cards=[
    {icon:Users,label:"用户管理",desc:"管理平台成员和访问权限",page:"users" as SettingsPage,badge:"5 名成员",color:T.primary,bg:"#E8F3FF"},
    {icon:Crown,label:"角色管理",desc:"定义角色和分配职责",page:"roles" as SettingsPage,badge:"4 个角色",color:"#7816FF",bg:"#F5E8FF"},
    {icon:Building2,label:"工作区配置",desc:"工作区基础信息和策略",page:"workspace" as SettingsPage,badge:"X-MAN",color:"#00B42A",bg:"#E8FFEA"},
    {icon:Key,label:"权限配置",desc:"精细化权限树管理",page:"perms" as SettingsPage,badge:"8 个模块",color:"#FF7D00",bg:"#FFF3E8"},
  ];
  return(
    <div className="p-6 max-w-[900px]">
      {/* Workspace banner */}
      <div className="rounded-2xl p-6 mb-6 flex items-center justify-between" style={{background:"linear-gradient(135deg,#1D2129 0%,#2D3748 100%)"}}>
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] mb-2" style={{color:"rgba(255,255,255,0.45)"}}>当前工作区</div>
          <div className="text-[24px] font-bold text-white leading-none">X-MAN</div>
          <div className="text-[13px] mt-2" style={{color:"rgba(255,255,255,0.55)"}}>企业自动化测试平台 · 由张程远管理</div>
        </div>
        <div className="flex items-center gap-6">
          {[{n:5,label:"成员"},{n:4,label:"角色"},{n:8,label:"模块"}].map((s,i)=>(
            <div key={i} className="text-center">
              <div className="text-[26px] font-bold text-white leading-none">{s.n}</div>
              <div className="text-[11px] mt-1" style={{color:"rgba(255,255,255,0.45)"}}>{s.label}</div>
            </div>
          ))}
          <div className="w-px h-10 mx-2" style={{backgroundColor:"rgba(255,255,255,0.12)"}}/>
          <div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{backgroundColor:"#00B42A"}}/><span className="text-white text-[13px] font-medium">系统正常</span></div>
            <div className="text-[11px] mt-0.5" style={{color:"rgba(255,255,255,0.45)"}}>所有服务在线</div>
          </div>
        </div>
      </div>
      {/* Current user */}
      <div className="flex items-center gap-2.5 mb-6 px-1">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0" style={{backgroundColor:T.primary}}>张</div>
        <div>
          <span className="text-[13px] font-medium" style={{color:T.t1}}>张程远</span>
          <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-medium" style={{backgroundColor:"#F5E8FF",color:"#7816FF"}}>测试负责人</span>
        </div>
        <span className="text-[12px]" style={{color:T.t3}}>· 拥有工作区管理权限</span>
      </div>
      {/* Quick access */}
      <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{color:T.t4}}>快捷管理</div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {cards.map(({icon:Icon,label,desc,page,badge,color,bg})=>(
          <button key={page} onClick={()=>onNavigate(page)}
            className="bg-white rounded-2xl p-5 text-left flex items-start gap-4 transition-all"
            style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.boxShadow=`0 4px 16px rgba(0,0,0,0.08)`;(e.currentTarget as HTMLButtonElement).style.borderColor=color;}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";(e.currentTarget as HTMLButtonElement).style.borderColor=T.border;}}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{backgroundColor:bg}}>
              <Icon size={18} style={{color}}/>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[14px] font-semibold" style={{color:T.t1}}>{label}</span>
                <ChevronRight size={13} style={{color:T.t4}}/>
              </div>
              <div className="text-[12px]" style={{color:T.t3}}>{desc}</div>
              <div className="text-[12px] mt-2 font-medium" style={{color}}>{badge}</div>
            </div>
          </button>
        ))}
      </div>
      {/* System status */}
      <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{color:T.t4}}>系统状态</div>
      <div className="bg-white rounded-2xl p-4" style={{border:`1px solid ${T.border}`}}>
        <div className="grid grid-cols-3 divide-x" style={{divideColor:T.border}}>
          {[
            {label:"通知服务",ok:true,detail:"企业微信 · 已配置"},
            {label:"AI 能力",ok:true,detail:"GPT-4o + Claude 3.5"},
            {label:"Runner 节点",ok:true,detail:"2 在线 / 3 总计"},
          ].map((s,i)=>(
            <div key={i} className="flex items-center gap-3 px-5 first:pl-0 last:pr-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:s.ok?T.success:T.danger}}/>
              <div>
                <div className="text-[13px] font-medium" style={{color:T.t1}}>{s.label}</div>
                <div className="text-[11px]" style={{color:T.t3}}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Workspace settings ───────────────────────────────────────────────────────
function WorkspaceSettings(){
  const[name,setName]=useState("X-MAN");
  const[desc,setDesc]=useState("企业自动化测试平台，覆盖接口、UI、APP 多端自动化测试。");
  const[env,setEnv]=useState("测试环境");
  const[retention,setRetention]=useState("90");
  const[notify,setNotify]=useState(true);
  const[ai,setAi]=useState(true);
  const[saved,setSaved]=useState(false);
  return(
    <div className="p-6 max-w-[640px]">
      <div className="mb-6"><h3 className="text-[16px] font-semibold" style={{color:T.t1}}>工作区设置</h3><p className="text-[13px] mt-1" style={{color:T.t3}}>配置工作区基本信息、数据保留策略和功能开关</p></div>
      <div className="bg-white rounded-2xl p-6" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        <div className="flex flex-col gap-5">
          <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>工作区名称 <span style={{color:T.danger}}>*</span></label>
            <input className="h-8 w-full border rounded-lg px-3 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} value={name} onChange={e=>setName(e.target.value)}/></div>
          <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>工作区描述</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-[13px] outline-none resize-none h-16" style={{borderColor:T.border,color:T.t1}} value={desc} onChange={e=>setDesc(e.target.value)}/></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>默认执行环境</label>
              <select className="h-8 w-full border rounded-lg px-2.5 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} value={env} onChange={e=>setEnv(e.target.value)}>
                <option>测试环境</option><option>预发布</option><option>生产环境</option>
              </select></div>
            <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>数据保留天数</label>
              <div className="flex items-center gap-2">
                <input type="number" className="h-8 w-20 border rounded-lg px-3 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} value={retention} onChange={e=>setRetention(e.target.value)}/>
                <span className="text-[12px]" style={{color:T.t3}}>天</span>
              </div></div>
          </div>
          <div className="h-px" style={{backgroundColor:T.border}}/>
          <div className="text-[11px] font-semibold uppercase tracking-widest" style={{color:T.t4}}>功能开关</div>
          {[
            {label:"企业微信通知",desc:"启用后，告警和报告将通过企业微信发送",on:notify,set:setNotify},
            {label:"AI 能力",desc:"启用 AI 用例生成、智能分析和调度建议",on:ai,set:setAi},
          ].map((s,i)=>(
            <div key={i} className="flex items-center justify-between p-3.5 rounded-xl" style={{border:`1px solid ${T.border}`}}>
              <div><div className="text-[13px] font-medium" style={{color:T.t1}}>{s.label}</div><div className="text-[12px] mt-0.5" style={{color:T.t3}}>{s.desc}</div></div>
              <Toggle on={s.on} onChange={s.set}/>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-6 pt-5" style={{borderTop:`1px solid ${T.border}`}}>
          <PBtn icon={Save} color={SC} onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2500);}}>保存设置</PBtn>
          {saved&&<SavedBadge/>}
        </div>
      </div>
    </div>
  );
}

// ─── Add Member Modal（从平台账号池选人）──────────────────────────────────────
function AddMemberModal({onClose,onAdd,existingAccounts}:{
  onClose:()=>void;
  onAdd:(users:SUser[])=>void;
  existingAccounts:string[];
}){
  const[search,   setSearch]   = useState("");
  const[selected, setSelected] = useState<Set<string>>(new Set());
  const[identity, setIdentity] = useState<"member"|"admin">("member");
  const[role,     setRole]     = useState(INIT_ROLES[1]?.name ?? "测试工程师");
  const[done,     setDone]     = useState(false);

  const available = PLATFORM_POOL.filter(p=>
    !existingAccounts.includes(p.email) &&
    (!search || p.name.includes(search) || p.email.toLowerCase().includes(search.toLowerCase()) || p.dept.includes(search))
  );
  const allSel = available.length>0 && selected.size===available.length;
  const partSel = selected.size>0 && !allSel;
  const toggle = (id:string) => setSelected(prev=>{const s=new Set(prev);s.has(id)?s.delete(id):s.add(id);return s;});
  const toggleAll = () => { if(allSel) setSelected(new Set()); else setSelected(new Set(available.map(p=>p.id))); };
  const selUsers = PLATFORM_POOL.filter(p=>selected.has(p.id));

  const confirm = () => {
    onAdd(selUsers.map((p,i)=>({
      id:"U_"+Date.now()+i, name:p.name, account:p.email,
      avatar:p.avatar, role, status:"active" as const, lastLogin:"尚未登录",
    })));
    setDone(true);
  };

  const Bd = ()=><div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.35)"}} onClick={onClose}/>;

  if(done) return (
    <>
      <Bd/>
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-white rounded-2xl w-[380px] pointer-events-auto p-10 text-center"
          style={{boxShadow:"0 20px 60px rgba(0,0,0,0.18)"}}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{background:"#E8FFEA"}}>
            <CheckCircle size={26} color={T.success}/>
          </div>
          <div className="text-[16px] font-bold mb-2" style={{color:T.t1}}>添加成功</div>
          <div className="text-[13px] mb-1" style={{color:T.t3}}>
            已将 <strong style={{color:T.t1}}>{selUsers.length}</strong> 名成员添加到工作区
          </div>
          <div className="text-[12px] mb-8" style={{color:T.t4}}>
            身份：{identity==="admin"?"工作区管理员":"普通成员"} · 角色：{role}
          </div>
          <button onClick={onClose} className="h-9 px-8 rounded-xl text-[13px] font-semibold text-white"
            style={{background:SC,border:"none",cursor:"pointer"}}>完成</button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Bd/>
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-white rounded-2xl w-[600px] pointer-events-auto flex flex-col"
          style={{boxShadow:"0 20px 60px rgba(0,0,0,0.18)",maxHeight:"88vh"}}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
            <div>
              <div className="text-[15px] font-semibold" style={{color:T.t1}}>添加工作区成员</div>
              <div className="text-[12px] mt-0.5" style={{color:T.t3}}>从平台账号中选择成员加入此工作区</div>
            </div>
            <IBtn icon={X} label="关闭" onClick={onClose}/>
          </div>

          {/* Search */}
          <div className="px-5 py-3 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
            <div className="relative">
              <Search size={13} color={T.t4} style={{position:"absolute",left:10,top:12,pointerEvents:"none"}}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索姓名、邮箱或部门…"
                className="w-full h-9 rounded-lg border text-[13px] outline-none"
                style={{paddingLeft:32,paddingRight:12,borderColor:T.border,color:T.t1}}
                onFocus={e=>e.currentTarget.style.borderColor=SC}
                onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
            </div>
          </div>

          {/* List */}
          <div style={{overflowY:"auto",maxHeight:300}}>
            {available.length>0&&(
              <div className="flex items-center gap-3 px-5 py-2.5 cursor-pointer"
                style={{borderBottom:`1px solid ${T.border}`,background:"#FAFBFE"}} onClick={toggleAll}>
                <div style={{width:16,height:16,borderRadius:4,flexShrink:0,
                  border:`2px solid ${allSel||partSel?SC:T.t4}`,background:allSel?SC:"transparent",
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {allSel&&<svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  {partSel&&<div style={{width:8,height:2,background:SC,borderRadius:1}}/>}
                </div>
                <span className="text-[12px] font-medium" style={{color:T.t2}}>全选（{available.length} 人）</span>
                {selected.size>0&&<span className="text-[12px]" style={{color:SC}}>已选 {selected.size} 人</span>}
              </div>
            )}
            {available.length===0?(
              <div className="py-14 text-center text-[13px]" style={{color:T.t3}}>
                {search?"未找到匹配的平台账号":"所有平台成员均已在此工作区中"}
              </div>
            ):available.map(p=>{
              const isSel=selected.has(p.id);
              return(
                <div key={p.id} onClick={()=>toggle(p.id)}
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer"
                  style={{borderBottom:`1px solid ${T.border}`,background:isSel?`${SC}07`:"#fff"}}
                  onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.background="#F8F9FB";}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=isSel?`${SC}07`:"#fff";}}>
                  <div style={{width:16,height:16,borderRadius:4,flexShrink:0,border:`2px solid ${isSel?SC:T.t4}`,
                    background:isSel?SC:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {isSel&&<svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                    style={{background:T.primary}}>{p.avatar}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="text-[13px] font-medium" style={{color:T.t1}}>{p.name}</div>
                    <div className="text-[11px]" style={{color:T.t3}}>{p.email}</div>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{background:T.bg,color:T.t3}}>{p.dept}</span>
                </div>
              );
            })}
          </div>

          {/* Assignment panel */}
          <div className="flex-shrink-0" style={{borderTop:`1px solid ${T.border}`}}>
            {selected.size===0?(
              <div className="px-5 py-3 text-center text-[12px]" style={{color:T.t4}}>请从上方列表中勾选要添加的成员</div>
            ):(
              <div className="px-5 py-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex">
                    {selUsers.slice(0,5).map((p,i)=>(
                      <div key={p.id} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white"
                        style={{background:T.primary,marginLeft:i>0?-4:0}}>{p.avatar}</div>
                    ))}
                    {selUsers.length>5&&<div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white"
                      style={{background:T.t3,marginLeft:-4}}>+{selUsers.length-5}</div>}
                  </div>
                  <span className="text-[12px]" style={{color:T.t2}}>
                    已选 <strong style={{color:SC}}>{selected.size}</strong> 人 — 统一设置以下权限
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[12px] font-medium mb-2" style={{color:T.t2}}>工作区身份 <span style={{color:T.danger}}>*</span></div>
                    <div className="flex gap-2">
                      {([["member","普通成员","访问工作区功能"],["admin","工作区管理员","管理成员和设置"]] as const).map(([v,label,hint])=>(
                        <button key={v} onClick={()=>setIdentity(v)}
                          className="flex-1 px-3 py-2.5 rounded-xl text-left cursor-pointer"
                          style={{border:`1.5px solid ${identity===v?SC:T.border}`,background:identity===v?`${SC}09`:"#fff"}}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div style={{width:11,height:11,borderRadius:"50%",border:`2px solid ${identity===v?SC:T.t4}`,
                              display:"flex",alignItems:"center",justifyContent:"center"}}>
                              {identity===v&&<div style={{width:4,height:4,borderRadius:"50%",background:SC}}/>}
                            </div>
                            <span className="text-[12px] font-semibold" style={{color:identity===v?SC:T.t1}}>{label}</span>
                          </div>
                          <div className="text-[10px]" style={{color:T.t4,paddingLeft:16,lineHeight:1.4}}>{hint}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium mb-2" style={{color:T.t2}}>工作区角色 <span style={{color:T.danger}}>*</span></div>
                    <select value={role} onChange={e=>setRole(e.target.value)}
                      className="w-full h-9 border rounded-xl px-3 text-[13px] outline-none bg-white"
                      style={{borderColor:T.border,color:T.t1}}>
                      {INIT_ROLES.map(r=><option key={r.id}>{r.name}</option>)}
                    </select>
                    <div className="text-[11px] mt-1.5" style={{color:T.t4}}>{INIT_ROLES.find(r=>r.name===role)?.desc}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-5 py-3 flex-shrink-0" style={{borderTop:`1px solid ${T.border}`}}>
            <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
            <PBtn color={SC} onClick={confirm} disabled={selected.size===0}>
              确认添加{selected.size>0?` (${selected.size} 人)`:""}
            </PBtn>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Edit Member Dialog ────────────────────────────────────────────────────────
function EditMemberDialog({onClose,user}:{onClose:()=>void;user:SUser}){
  const[role,setRole]=useState(user.role);
  const[active,setActive]=useState(user.status!=="disabled");
  return(
    <>
      <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.3)"}} onClick={onClose}/>
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-white rounded-2xl w-[400px] pointer-events-auto" style={{boxShadow:"0 20px 60px rgba(0,0,0,0.16)"}}>
          <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:`1px solid ${T.border}`}}>
            <div>
              <div className="text-[15px] font-semibold" style={{color:T.t1}}>编辑成员</div>
              <div className="text-[12px] mt-0.5" style={{color:T.t3}}>修改 {user.name} 的角色和状态</div>
            </div>
            <IBtn icon={X} label="关闭" onClick={onClose}/>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{background:T.bg}}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white"
                style={{background:T.primary}}>{user.avatar}</div>
              <div>
                <div className="text-[13px] font-semibold" style={{color:T.t1}}>{user.name}</div>
                <div className="text-[11px]" style={{color:T.t3}}>{user.account}</div>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>工作区角色</label>
              <select className="h-9 w-full border rounded-xl px-3 text-[13px] outline-none bg-white"
                style={{borderColor:T.border,color:T.t1}} value={role} onChange={e=>setRole(e.target.value)}>
                {INIT_ROLES.map(r=><option key={r.id}>{r.name}</option>)}
              </select>
              <div className="text-[11px] mt-1" style={{color:T.t4}}>{INIT_ROLES.find(r=>r.name===role)?.desc}</div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl" style={{border:`1px solid ${T.border}`}}>
              <div className="text-[13px] font-medium" style={{color:T.t1}}>账号启用</div>
              <Toggle on={active} onChange={setActive}/>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`}}>
            <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
            <PBtn color={SC} onClick={onClose}>保存修改</PBtn>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── User management ──────────────────────────────────────────────────────────
function UserManagement(){
  const[users,setUsers]=useState<SUser[]>(INIT_USERS);
  const[search,setSearch]=useState("");
  const[filterRole,setFilterRole]=useState("all");
  const[filterStatus,setFilterStatus]=useState("all");
  const[showInvite,setShowInvite]=useState(false);
  const[editUser,setEditUser]=useState<SUser|null>(null);
  const[confirmToggle,setConfirmToggle]=useState<SUser|null>(null);
  const filtered=users.filter(u=>{
    if(search&&!u.name.includes(search)&&!u.account.includes(search))return false;
    if(filterRole!=="all"&&u.role!==filterRole)return false;
    if(filterStatus==="active"&&u.status!=="active")return false;
    if(filterStatus==="disabled"&&u.status!=="disabled")return false;
    return true;
  });
  return(
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div><h3 className="text-[16px] font-semibold" style={{color:T.t1}}>用户管理</h3><p className="text-[13px] mt-0.5" style={{color:T.t3}}>管理工作区成员、角色分配和账号状态</p></div>
        <PBtn icon={UserPlus} color={SC} onClick={()=>setShowInvite(true)}>添加成员</PBtn>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <SInp placeholder="搜索姓名或账号" prefix={<Search size={12}/>} width={220} value={search} onChange={setSearch}/>
        <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:130}} value={filterRole} onChange={e=>setFilterRole(e.target.value)}>
          <option value="all">全部角色</option>{INIT_ROLES.map(r=><option key={r.id}>{r.name}</option>)}
        </select>
        <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:110}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">全部状态</option><option value="active">已启用</option><option value="disabled">已禁用</option>
        </select>
      </div>
      <div className="bg-white rounded-2xl overflow-hidden" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        <table className="w-full border-collapse">
          <thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
            {["成员","账号","角色","状态","最近登录","操作"].map((h,i)=>(
              <th key={i} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-left" style={{color:T.t3}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length===0?(
              <tr><td colSpan={6} className="py-20 text-center">
                <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{backgroundColor:"#F2F3F5"}}><Users size={22} style={{color:T.t4}}/></div>
                <p className="text-[14px] font-medium" style={{color:T.t2}}>暂无匹配成员</p>
                <p className="text-[12px] mt-1" style={{color:T.t3}}>调整筛选条件，或邀请新成员加入</p>
              </td></tr>
            ):filtered.map(u=>(
              <tr key={u.id} className="border-b last:border-0" style={{borderColor:T.border,height:52}} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#FAFBFF"} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0" style={{backgroundColor:u.status==="disabled"?"#C9CDD4":T.primary}}>{u.avatar}</div>
                    <span className="text-[13px] font-medium" style={{color:u.status==="disabled"?T.t3:T.t1}}>{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-[12px] font-mono" style={{color:T.t3}}>{u.account}</td>
                <td className="px-4 py-2"><span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{backgroundColor:ROLE_TAG_BG[u.role]??"#F2F3F5",color:ROLE_AVATAR_COLOR[u.role]??T.t3}}>{u.role}</span></td>
                <td className="px-4 py-2"><span className="inline-flex items-center gap-1.5 text-[12px]"><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:u.status==="active"?T.success:T.t4}}/><span style={{color:u.status==="active"?T.t2:T.t3}}>{u.status==="active"?"已启用":"已禁用"}</span></span></td>
                <td className="px-4 py-2 text-[12px] font-mono" style={{color:T.t3}}>{u.lastLogin}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-0.5">
                    <IBtn icon={Edit2} label="编辑" onClick={()=>setEditUser(u)}/>
                    <IBtn icon={Power} label={u.status==="active"?"禁用账号":"启用账号"} onClick={()=>setConfirmToggle(u)}/>
                    <IBtn icon={Trash2} label="移除" danger onClick={()=>setUsers(p=>p.filter(x=>x.id!==u.id))}/>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2.5" style={{borderTop:`1px solid ${T.border}`}}>
          <span className="text-[12px]" style={{color:T.t3}}>共 {filtered.length} / {users.length} 名成员</span>
        </div>
      </div>
      {showInvite&&<AddMemberModal
        onClose={()=>setShowInvite(false)}
        onAdd={newUsers=>{setUsers(p=>[...p,...newUsers]);setShowInvite(false);}}
        existingAccounts={users.map(u=>u.account)}
      />}
      {editUser&&<EditMemberDialog onClose={()=>setEditUser(null)} user={editUser}/>}
      {confirmToggle&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.28)"}}>
          <div className="bg-white rounded-2xl p-6 w-[380px]" style={{boxShadow:"0 20px 60px rgba(0,0,0,0.16)"}}>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{backgroundColor:confirmToggle.status==="active"?"#FFF3E8":"#E8FFEA"}}><Power size={18} style={{color:confirmToggle.status==="active"?T.warning:T.success}}/></div>
              <div><div className="text-[15px] font-semibold mb-1" style={{color:T.t1}}>{confirmToggle.status==="active"?"禁用账号":"启用账号"}</div><div className="text-[13px]" style={{color:T.t3}}>{confirmToggle.status==="active"?`禁用后「${confirmToggle.name}」将无法登录平台。`:`启用后「${confirmToggle.name}」可重新登录平台。`}</div></div>
            </div>
            <div className="flex justify-end gap-2">
              <PBtn variant="ghost" onClick={()=>setConfirmToggle(null)}>取消</PBtn>
              <PBtn color={confirmToggle.status==="active"?T.warning:T.success} onClick={()=>{setUsers(p=>p.map(u=>u.id===confirmToggle.id?{...u,status:u.status==="active"?"disabled":"active"}:u));setConfirmToggle(null);}}>
                {confirmToggle.status==="active"?"确认禁用":"确认启用"}
              </PBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Role auth drawer ─────────────────────────────────────────────────────────
function RoleAuthDrawer({role,onClose}:{role:SRole;onClose:()=>void}){
  const getInitPerms=():PermState=>{
    const k=role.name==="测试负责人"?"lead":role.name==="测试工程师"?"engineer":role.name==="开发人员"?"dev":"guest";
    return makePerms(k);
  };
  const[perms,setPerms]=useState<PermState>(getInitPerms);
  const[aiPreset,setAiPreset]=useState<string|null>(null);
  const[showAi,setShowAi]=useState(false);
  const[saved,setSaved]=useState(false);
  const total=Object.values(perms).reduce((s,mp)=>s+Object.values(mp).filter(Boolean).length,0);
  const riskyList=PERM_MODULES.flatMap(m=>m.perms.filter(p=>RISKY.includes(p)&&perms[m.id]?.[p]).map(p=>`${m.label}·${p}`));
  const applyPreset=(key:string)=>{setPerms(makePerms(key));setAiPreset(key);};
  return(
    <>
      <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={onClose}/>
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white" style={{width:720,boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div className="flex items-start justify-between px-6 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div><div className="text-[15px] font-semibold" style={{color:T.t1}}>权限配置 — {role.name}</div><div className="text-[12px] mt-0.5" style={{color:T.t3}}>{role.desc}</div></div>
          <div className="flex items-center gap-2">
            <PBtn icon={Sparkles} small variant="ghost" onClick={()=>setShowAi(!showAi)}>AI 建议</PBtn>
            <IBtn icon={X} label="关闭" onClick={onClose}/>
          </div>
        </div>
        {showAi&&(
          <div className="flex-shrink-0 px-6 py-4" style={{borderBottom:`1px solid ${T.border}`,backgroundColor:"#FFFBEB"}}>
            <div className="flex items-center gap-2 mb-3"><Sparkles size={13} style={{color:"#F59E0B"}}/><span className="text-[13px] font-semibold" style={{color:T.t1}}>AI 权限建议</span><span className="text-[11px]" style={{color:T.t3}}>根据角色职责推荐权限组合，仅供参考</span></div>
            <div className="flex gap-2 mb-3">
              {Object.entries(ROLE_PRESETS).map(([key,p])=>(
                <button key={key} onClick={()=>applyPreset(key)}
                  className="flex-1 p-2.5 rounded-xl border text-left text-[12px] transition-all"
                  style={{borderColor:aiPreset===key?"#F59E0B":T.border,backgroundColor:aiPreset===key?"#FFFBEB":"#fff"}}>
                  <div className="font-medium" style={{color:aiPreset===key?"#F59E0B":T.t1}}>{p.label}</div>
                  <div className="text-[11px] mt-0.5" style={{color:T.t3}}>点击预览权限</div>
                </button>
              ))}
            </div>
            {aiPreset&&<div className="rounded-lg p-3" style={{backgroundColor:"#fff",border:"1px solid #FDE68A"}}><div className="text-[11px] font-semibold mb-1" style={{color:"#92400E"}}>推荐理由</div><div className="text-[12px]" style={{color:T.t2}}>{ROLE_PRESETS[aiPreset].desc}</div></div>}
          </div>
        )}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4"><span className="text-[13px] font-semibold" style={{color:T.t1}}>权限树</span><span className="px-2 py-0.5 rounded text-[12px]" style={{backgroundColor:"#E8F3FF",color:T.primary}}>已选 {total} 项</span></div>
            <PermTree perms={perms} onChange={setPerms}/>
          </div>
          <div className="flex-shrink-0 w-52 overflow-y-auto py-4 px-3" style={{borderLeft:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{color:T.t4}}>已选权限摘要</div>
            {PERM_MODULES.map(mod=>{
              const sel=mod.perms.filter(p=>perms[mod.id]?.[p]);
              return sel.length===0?null:(
                <div key={mod.id} className="mb-3">
                  <div className="text-[11px] font-medium mb-1" style={{color:T.t2}}>{mod.label}</div>
                  <div className="flex flex-wrap gap-1">{sel.map(p=><span key={p} className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:RISKY.includes(p)?"#FFF3E8":"#E8F3FF",color:RISKY.includes(p)?T.warning:T.primary}}>{p}</span>)}</div>
                </div>
              );
            })}
            {riskyList.length>0&&<div className="mt-3 p-2.5 rounded-lg" style={{backgroundColor:"#FFF3E8",border:"1px solid #FFD6A0"}}><div className="flex items-center gap-1 mb-1"><AlertTriangle size={11} style={{color:T.warning}}/><span className="text-[11px] font-medium" style={{color:T.warning}}>风险权限</span></div>{riskyList.map((r,i)=><div key={i} className="text-[10px]" style={{color:T.t2}}>· {r}</div>)}</div>}
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5" style={{borderTop:`1px solid ${T.border}`}}>
          <div className="text-[12px]" style={{color:T.t3}}>修改将立即对该角色下所有成员生效</div>
          <div className="flex items-center gap-2">
            {saved&&<SavedBadge/>}
            <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
            <PBtn color={SC} icon={Save} onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2500);}}>保存授权</PBtn>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Role management ──────────────────────────────────────────────────────────
function RoleManagement(){
  const[roles,setRoles]=useState<SRole[]>(INIT_ROLES);
  const[authRole,setAuthRole]=useState<SRole|null>(null);
  const[delConfirm,setDelConfirm]=useState<SRole|null>(null);
  const[showCreate,setShowCreate]=useState(false);
  const[newName,setNewName]=useState("");
  const[newDesc,setNewDesc]=useState("");
  const[editRole,setEditRole]=useState<SRole|null>(null);
  const[editName,setEditName]=useState("");
  const[editDesc,setEditDesc]=useState("");
  const ICON:Record<string,React.ElementType>={"测试负责人":Crown,"测试工程师":Users,"开发人员":Shield,"只读访客":Eye};
  return(
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div><h3 className="text-[16px] font-semibold" style={{color:T.t1}}>角色管理</h3><p className="text-[13px] mt-0.5" style={{color:T.t3}}>管理平台角色和功能权限分配</p></div>
        <PBtn icon={Plus} color={SC} onClick={()=>setShowCreate(true)}>新建角色</PBtn>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {roles.map(role=>{
          const RIcon=ICON[role.name]??Shield;
          const rc=ROLE_AVATAR_COLOR[role.name]??T.t2;
          return(
            <div key={role.id} className="bg-white rounded-2xl p-5" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{backgroundColor:`${rc}18`}}><RIcon size={18} style={{color:rc}}/></div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[14px] font-semibold" style={{color:T.t1}}>{role.name}</span>
                      {role.isSystem&&<span className="text-[10px] px-1.5 py-px rounded" style={{backgroundColor:"#F2F3F5",color:T.t3}}>系统内置</span>}
                    </div>
                    <div className="text-[12px]" style={{color:T.t3}}>{role.desc}</div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <IBtn icon={Key} label="授权配置" onClick={()=>setAuthRole(role)}/>
                  <IBtn icon={Edit2} label="编辑" onClick={()=>{setEditRole(role);setEditName(role.name);setEditDesc(role.desc);}}/>
                  {!role.isSystem&&<IBtn icon={Trash2} label="删除" danger onClick={()=>setDelConfirm(role)}/>}
                </div>
              </div>
              <div className="flex items-center gap-5 pt-3" style={{borderTop:`1px solid ${T.border}`}}>
                <div><div className="text-[18px] font-bold" style={{color:T.t1}}>{role.members}</div><div className="text-[11px]" style={{color:T.t3}}>成员</div></div>
                <div className="w-px h-8" style={{backgroundColor:T.border}}/>
                <div><div className="text-[18px] font-bold" style={{color:T.t1}}>{role.permCount}</div><div className="text-[11px]" style={{color:T.t3}}>权限项</div></div>
                <div className="w-px h-8" style={{backgroundColor:T.border}}/>
                <div><div className="text-[12px]" style={{color:T.t2}}>{role.updatedAt}</div><div className="text-[11px]" style={{color:T.t3}}>最近更新</div></div>
                <div className="flex-1 flex justify-end">
                  <button onClick={()=>setAuthRole(role)} className="h-7 px-3 rounded-lg text-[12px] font-medium border transition-all" style={{borderColor:rc,color:rc}} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.backgroundColor=`${rc}14`;}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.backgroundColor="transparent";}}>配置权限</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {authRole&&<RoleAuthDrawer role={authRole} onClose={()=>setAuthRole(null)}/>}
      {delConfirm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.28)"}}>
          <div className="bg-white rounded-2xl p-6 w-[400px]" style={{boxShadow:"0 20px 60px rgba(0,0,0,0.16)"}}>
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{backgroundColor:"#FFE8E8"}}><Trash2 size={18} style={{color:T.danger}}/></div>
              <div><div className="text-[15px] font-semibold mb-1" style={{color:T.t1}}>删除角色</div><div className="text-[13px]" style={{color:T.t3}}>「{delConfirm.name}」下有 {delConfirm.members} 名成员，删除后成员将失去该角色的所有权限。此操作不可撤销。</div></div>
            </div>
            <div className="flex justify-end gap-2">
              <PBtn variant="ghost" onClick={()=>setDelConfirm(null)}>取消</PBtn>
              <PBtn color={T.danger} onClick={()=>{setRoles(p=>p.filter(r=>r.id!==delConfirm.id));setDelConfirm(null);}}>确认删除</PBtn>
            </div>
          </div>
        </div>
      )}
      {showCreate&&(
        <>
          <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={()=>setShowCreate(false)}/>
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl w-[440px] pointer-events-auto" style={{boxShadow:"0 20px 60px rgba(0,0,0,0.16)"}}>
              <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:`1px solid ${T.border}`}}>
                <div className="text-[15px] font-semibold" style={{color:T.t1}}>新建角色</div>
                <IBtn icon={X} label="关闭" onClick={()=>setShowCreate(false)}/>
              </div>
              <div className="px-6 py-5 flex flex-col gap-4">
                <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>角色名称 <span style={{color:T.danger}}>*</span></label><input className="h-8 w-full border rounded-lg px-3 text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} placeholder="例：高级测试工程师" value={newName} onChange={e=>setNewName(e.target.value)}/></div>
                <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>角色描述</label><textarea placeholder="描述该角色的职责范围" value={newDesc} onChange={e=>setNewDesc(e.target.value)} className="w-full h-16 border rounded-lg px-3 py-2 text-[13px] outline-none resize-none" style={{borderColor:T.border,color:T.t1}}/></div>
                <div className="rounded-xl p-3" style={{backgroundColor:"#F0F9FF",border:"1px solid #BAE6FD"}}><div className="text-[12px]" style={{color:"#0369A1"}}>创建后可在「权限配置」中为该角色分配具体权限。</div></div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`}}>
                <PBtn variant="ghost" onClick={()=>setShowCreate(false)}>取消</PBtn>
                <PBtn color={SC} disabled={!newName.trim()} onClick={()=>{setRoles(p=>[...p,{id:`R${Date.now()}`,name:newName,desc:newDesc,members:0,permCount:0,updatedAt:"2026-07-07",isSystem:false}]);setShowCreate(false);setNewName("");setNewDesc("");}}>创建角色</PBtn>
              </div>
            </div>
          </div>
        </>
      )}
      {editRole&&(
        <>
          <div className="fixed inset-0 z-40" style={{backgroundColor:"rgba(0,0,0,0.28)"}} onClick={()=>setEditRole(null)}/>
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl w-[440px] pointer-events-auto" style={{boxShadow:"0 20px 60px rgba(0,0,0,0.16)"}}>
              <div className="flex items-center justify-between px-6 py-4" style={{borderBottom:`1px solid ${T.border}`}}>
                <div>
                  <div className="text-[15px] font-semibold" style={{color:T.t1}}>编辑角色</div>
                  <div className="text-[12px] mt-0.5" style={{color:T.t3}}>修改将对该角色下所有成员立即生效</div>
                </div>
                <IBtn icon={X} label="关闭" onClick={()=>setEditRole(null)}/>
              </div>
              <div className="px-6 py-5 flex flex-col gap-4">
                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>角色名称 <span style={{color:T.danger}}>*</span></label>
                  <input className="h-8 w-full border rounded-lg px-3 text-[13px] outline-none transition-all"
                    style={{borderColor:T.border,color:T.t1}}
                    value={editName} onChange={e=>setEditName(e.target.value)}
                    disabled={editRole.isSystem}
                    onFocus={e=>{e.currentTarget.style.borderColor=SC;e.currentTarget.style.boxShadow=`0 0 0 2px ${SC}18`;}}
                    onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
                  {editRole.isSystem&&<div className="text-[11px] mt-1" style={{color:T.t4}}>系统内置角色名称不可修改</div>}
                </div>
                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>角色描述</label>
                  <textarea value={editDesc} onChange={e=>setEditDesc(e.target.value)}
                    placeholder="描述该角色的职责范围"
                    className="w-full h-20 border rounded-lg px-3 py-2 text-[13px] outline-none resize-none transition-all"
                    style={{borderColor:T.border,color:T.t1}}
                    onFocus={e=>{e.currentTarget.style.borderColor=SC;e.currentTarget.style.boxShadow=`0 0 0 2px ${SC}18`;}}
                    onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1 pb-1 px-3 rounded-xl" style={{background:"#FAFAFA",border:`1px solid ${T.border}`}}>
                  <div className="py-2">
                    <div className="text-[11px] mb-0.5" style={{color:T.t3}}>成员数量</div>
                    <div className="text-[14px] font-semibold" style={{color:T.t1}}>{editRole.members} 人</div>
                  </div>
                  <div className="py-2">
                    <div className="text-[11px] mb-0.5" style={{color:T.t3}}>已配置权限</div>
                    <div className="text-[14px] font-semibold" style={{color:T.t1}}>{editRole.permCount} 项</div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`}}>
                <PBtn variant="ghost" onClick={()=>setEditRole(null)}>取消</PBtn>
                <PBtn color={SC} disabled={!editName.trim()}
                  onClick={()=>{
                    const today=new Date().toISOString().slice(0,10);
                    setRoles(p=>p.map(r=>r.id===editRole.id?{...r,name:editName.trim(),desc:editDesc,updatedAt:today}:r));
                    setEditRole(null);
                  }}>
                  保存修改
                </PBtn>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Permission config page ───────────────────────────────────────────────────
function PermConfig(){
  const[roleId,setRoleId]=useState("R2");
  const[perms,setPerms]=useState<PermState>(makePerms("engineer"));
  const[saved,setSaved]=useState(false);
  const role=INIT_ROLES.find(r=>r.id===roleId)??INIT_ROLES[0];
  const total=Object.values(perms).reduce((s,mp)=>s+Object.values(mp).filter(Boolean).length,0);
  const hasRisk=PERM_MODULES.some(m=>m.perms.some(p=>RISKY.includes(p)&&perms[m.id]?.[p]));
  const handleRoleChange=(id:string)=>{
    setRoleId(id);
    const r=INIT_ROLES.find(x=>x.id===id);
    const k=r?.name==="测试负责人"?"lead":r?.name==="测试工程师"?"engineer":r?.name==="开发人员"?"dev":"guest";
    setPerms(makePerms(k));setSaved(false);
  };
  return(
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div><h3 className="text-[16px] font-semibold" style={{color:T.t1}}>权限配置</h3><p className="text-[13px] mt-0.5" style={{color:T.t3}}>为角色配置模块级和操作级权限</p></div>
        <div className="flex items-center gap-2">
          <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:140}} value={roleId} onChange={e=>handleRoleChange(e.target.value)}>
            {INIT_ROLES.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button className="h-8 px-3 border rounded-lg text-[13px]" style={{borderColor:T.border,color:T.t2}} onClick={()=>setPerms({})}>清空</button>
          <button className="h-8 px-3 border rounded-lg text-[13px]" style={{borderColor:T.border,color:T.t2}} onClick={()=>setPerms(Object.fromEntries(PERM_MODULES.map(m=>[m.id,Object.fromEntries(m.perms.map(p=>[p,true]))])))}>全选</button>
          <PBtn color={SC} icon={Save} onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2500);}}>保存授权</PBtn>
          {saved&&<SavedBadge/>}
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="bg-white rounded-2xl p-5" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-semibold" style={{color:T.t1}}>权限树 — {role.name}</span>
              <span className="text-[12px] px-2 py-0.5 rounded" style={{backgroundColor:"#E8F3FF",color:T.primary}}>已选 {total} 项</span>
            </div>
            <PermTree perms={perms} onChange={setPerms}/>
          </div>
        </div>
        <div className="w-56 flex-shrink-0">
          <div className="bg-white rounded-2xl p-4 sticky top-0" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
            <div className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{color:T.t4}}>权限摘要</div>
            <div className="text-[28px] font-bold mb-0.5" style={{color:T.t1}}>{total}</div>
            <div className="text-[12px] mb-4" style={{color:T.t3}}>已选权限项</div>
            {PERM_MODULES.map(mod=>{
              const cnt=mod.perms.filter(p=>perms[mod.id]?.[p]).length;
              return cnt===0?null:(
                <div key={mod.id} className="flex items-center justify-between mb-2">
                  <span className="text-[12px]" style={{color:T.t2}}>{mod.label}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded" style={{backgroundColor:"#E8F3FF",color:T.primary}}>{cnt}</span>
                </div>
              );
            })}
            {hasRisk&&(
              <div className="mt-3 p-2.5 rounded-lg" style={{backgroundColor:"#FFF3E8",border:"1px solid #FFD6A0"}}>
                <div className="flex items-center gap-1 mb-1"><AlertTriangle size={11} style={{color:T.warning}}/><span className="text-[11px] font-medium" style={{color:T.warning}}>含高风险权限</span></div>
                <div className="text-[11px]" style={{color:T.t2}}>包含删除、配置等高风险操作，请确认是否必要。</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Audit log ────────────────────────────────────────────────────────────────
function AuditLog(){
  return(
    <div className="p-6">
      <div className="mb-5"><h3 className="text-[16px] font-semibold" style={{color:T.t1}}>操作日志</h3><p className="text-[13px] mt-0.5" style={{color:T.t3}}>记录平台关键操作和安全事件，保留 90 天</p></div>
      <div className="flex items-center gap-2 mb-4">
        <SInp placeholder="搜索操作或操作人" prefix={<Search size={12}/>} width={220}/>
        <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width:140}}>
          <option>全部操作类型</option><option>权限变更</option><option>成员管理</option><option>配置修改</option><option>登录记录</option>
        </select>
      </div>
      <div className="bg-white rounded-2xl overflow-hidden" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        <table className="w-full border-collapse">
          <thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
            {["时间","操作人","操作类型","操作对象","来源 IP","结果"].map((h,i)=>(
              <th key={i} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-left" style={{color:T.t3}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {AUDIT_DATA.map(r=>(
              <tr key={r.id} className="border-b last:border-0" style={{borderColor:T.border,height:46}} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#FAFBFF"} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}>
                <td className="px-4 py-2 text-[12px] font-mono" style={{color:T.t3}}>{r.time}</td>
                <td className="px-4 py-2 text-[13px]" style={{color:T.t1}}>{r.operator}</td>
                <td className="px-4 py-2 text-[13px]" style={{color:T.t2}}>{r.action}</td>
                <td className="px-4 py-2 text-[12px]" style={{color:T.t2}}>{r.target}</td>
                <td className="px-4 py-2 text-[12px] font-mono" style={{color:T.t3}}>{r.ip}</td>
                <td className="px-4 py-2"><span className="inline-flex items-center gap-1.5 text-[12px]"><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:r.result==="success"?T.success:T.danger}}/><span style={{color:r.result==="success"?T.t2:T.danger}}>{r.result==="success"?"成功":"失败"}</span></span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2.5" style={{borderTop:`1px solid ${T.border}`}}>
          <span className="text-[12px]" style={{color:T.t3}}>共 {AUDIT_DATA.length} 条记录 · 数据保留 90 天</span>
        </div>
      </div>
    </div>
  );
}

// ─── Left nav ─────────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {label:"概览",items:[{key:"home" as SettingsPage,label:"设置首页",Icon:LayoutDashboard}]},
  {label:"工作区",items:[{key:"workspace" as SettingsPage,label:"基本配置",Icon:Building2}]},
  {label:"用户与权限",items:[
    {key:"users" as SettingsPage,label:"用户管理",Icon:Users},
    {key:"roles" as SettingsPage,label:"角色管理",Icon:Crown},
    {key:"perms" as SettingsPage,label:"权限配置",Icon:Key},
  ]},
  {label:"审计",items:[{key:"audit" as SettingsPage,label:"操作日志",Icon:Clock}]},
];

function SettingsNav({active,onChange}:{active:SettingsPage;onChange:(p:SettingsPage)=>void}){
  return(
    <div className="flex-shrink-0 flex flex-col py-4" style={{width:216,borderRight:`1px solid ${T.border}`,backgroundColor:"#fff",overflowY:"auto"}}>
      {NAV_SECTIONS.map(({label,items})=>(
        <div key={label} className="mb-1">
          <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{color:T.t4}}>{label}</div>
          {items.map(({key,label:lbl,Icon})=>(
            <button key={key} onClick={()=>onChange(key)}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors text-left relative"
              style={{color:active===key?SC:T.t2,backgroundColor:active===key?"#F4F6FA":"transparent",fontWeight:active===key?600:400}}
              onMouseEnter={e=>{if(active!==key)(e.currentTarget as HTMLButtonElement).style.backgroundColor="#F4F6FA";}}
              onMouseLeave={e=>{if(active!==key)(e.currentTarget as HTMLButtonElement).style.backgroundColor="transparent";}}>
              {active===key&&<span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full" style={{backgroundColor:SC}}/>}
              <Icon size={14} style={{color:active===key?SC:T.t3}}/>
              {lbl}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function SettingsModule(){
  const[page,setPage]=useState<SettingsPage>("home");
  return(
    <div className="flex-1 flex overflow-hidden" style={{backgroundColor:T.bg}}>
      <SettingsNav active={page} onChange={setPage}/>
      <div className="flex-1 overflow-y-auto">
        {page==="home"     &&<SettingsHome onNavigate={setPage}/>}
        {page==="workspace"&&<WorkspaceSettings/>}
        {page==="users"    &&<UserManagement/>}
        {page==="roles"    &&<RoleManagement/>}
        {page==="perms"    &&<PermConfig/>}
        {page==="audit"    &&<AuditLog/>}
      </div>
    </div>
  );
}
