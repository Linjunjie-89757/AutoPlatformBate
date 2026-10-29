/**
 * ApiCaseTab — Test case management for a single API endpoint.
 *
 * Tab order rationale: Params → Auth → Headers → Body → 前置处理 → 后置处理 → 断言 → 提取器 → 设置 → **用例** → 定义
 * - 用例 follows 设置 because it is a management / testing layer on top of the
 *   interface definition; 定义 is the spec reference and naturally closes the row.
 * - Keeping 用例 before 定义 lets the user flow: configure → manage cases → view spec.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Sparkles, Search, RefreshCw, SlidersHorizontal,
  Play, Edit2, Eye, Copy, Trash2, MoreHorizontal,
  CheckCircle, XCircle, AlertCircle, Clock, X,
  AlertTriangle, Bot, User2, ChevronDown, Filter,
  Loader2, Ban, ArrowRight, StopCircle, Settings2,
  Info, Save, ChevronRight,
} from "lucide-react";
import { ApiCaseDrawer } from "./ApiCaseDrawer";
import { ApiAiGenerationDrawer } from "./ApiAiGenerationDrawer";

// ─── Design tokens (mirrors App.tsx T) ────────────────────────────────────────
const T = {
  primary: "#165DFF", success: "#00B42A", warning: "#FF7D00",
  danger: "#F53F3F", purple: "#7816FF", cyan: "#0FC6C2",
  slate: "#4E5969",   bg: "#F4F6FA",    border: "#E5E6EB",
  t1: "#1D2129", t2: "#4E5969", t3: "#86909C", t4: "#C9CDD4",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type CaseLevel  = "P0" | "P1" | "P2" | "P3";
type CaseResult = "pending" | "running" | "passed" | "failed" | "error" | "cancelled";
type CaseSource = "manual" | "ai";
type PageState  = "loading" | "loaded" | "empty" | "no-results" | "error" | "unsaved";

interface ApiCase {
  id: string; name: string; level: CaseLevel; type: string;
  source: CaseSource; tags: string[]; enabled: boolean;
  lastResult: CaseResult; lastRunTime: string;
  updatedAt: string; creator: string;
}

// ─── Mock data (used when a real endpoint is selected) ───────────────────────
const MOCK_CASES: ApiCase[] = [
  { id:"TC-001", name:"正常登录 — 有效用户名密码",    level:"P0", type:"功能测试", source:"manual", tags:["登录","正向流程"], enabled:true,  lastResult:"passed",   lastRunTime:"2026-07-30 14:23", updatedAt:"2026-07-28", creator:"李明"   },
  { id:"TC-002", name:"密码错误 — 返回 401",          level:"P0", type:"异常测试", source:"manual", tags:["登录","异常"],    enabled:true,  lastResult:"failed",   lastRunTime:"2026-07-30 14:23", updatedAt:"2026-07-28", creator:"李明"   },
  { id:"TC-003", name:"用户不存在 — 返回 404",        level:"P1", type:"异常测试", source:"manual", tags:["登录"],           enabled:true,  lastResult:"passed",   lastRunTime:"2026-07-29 09:15", updatedAt:"2026-07-25", creator:"王芳"   },
  { id:"TC-004", name:"缺少 username 字段 — 返回 400",level:"P1", type:"边界测试", source:"manual", tags:["参数验证"],       enabled:true,  lastResult:"pending",  lastRunTime:"",                updatedAt:"2026-07-25", creator:"王芳"   },
  { id:"TC-005", name:"SQL 注入检查 — 特殊字符过滤",  level:"P0", type:"安全测试", source:"ai",     tags:["安全","注入"],    enabled:true,  lastResult:"passed",   lastRunTime:"2026-07-30 14:23", updatedAt:"2026-07-30", creator:"AI 生成" },
  { id:"TC-006", name:"密码长度边界 — 最大 256 位",   level:"P2", type:"边界测试", source:"ai",     tags:["边界","参数"],    enabled:true,  lastResult:"error",    lastRunTime:"2026-07-29 16:45", updatedAt:"2026-07-30", creator:"AI 生成" },
  { id:"TC-007", name:"Token 失效后重新登录",          level:"P1", type:"功能测试", source:"manual", tags:["Token","鉴权"],   enabled:false, lastResult:"pending",  lastRunTime:"",                updatedAt:"2026-07-20", creator:"张程远"  },
  { id:"TC-008", name:"权限不足 — 普通用户调用管理接口",level:"P0",type:"安全测试",source:"manual",  tags:["权限","安全"],    enabled:true,  lastResult:"passed",   lastRunTime:"2026-07-28 11:30", updatedAt:"2026-07-22", creator:"李明"   },
];

// ─── Small atoms ──────────────────────────────────────────────────────────────
const LEVEL_CFG: Record<CaseLevel, {bg:string;color:string}> = {
  P0:{ bg:"#FFF0F0", color:T.danger  },
  P1:{ bg:"#FFF7E6", color:T.warning },
  P2:{ bg:"#E8F0FF", color:T.primary },
  P3:{ bg:"#F4F6FA", color:T.t3     },
};
function LevelBadge({ level }: { level: CaseLevel }) {
  const c = LEVEL_CFG[level];
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:"1px 6px", borderRadius:3, background:c.bg, color:c.color, whiteSpace:"nowrap" }}>
      {level}
    </span>
  );
}

const RESULT_CFG: Record<CaseResult, {icon:React.ReactNode;label:string;color:string}> = {
  pending:   { icon:<Clock size={12}/>,            label:"未执行", color:T.t4    },
  running:   { icon:<Loader2 size={12} className="animate-spin"/>, label:"执行中", color:T.primary },
  passed:    { icon:<CheckCircle size={12}/>,      label:"通过",   color:T.success},
  failed:    { icon:<XCircle size={12}/>,          label:"失败",   color:T.danger },
  error:     { icon:<AlertCircle size={12}/>,      label:"执行异常",color:T.warning},
  cancelled: { icon:<Ban size={12}/>,              label:"已取消", color:T.t3    },
};
function ResultBadge({ result }: { result: CaseResult }) {
  const c = RESULT_CFG[result];
  return (
    <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:c.color, whiteSpace:"nowrap" }}>
      {c.icon}{c.label}
    </span>
  );
}

function SourceTag({ source }: { source: CaseSource }) {
  if (source === "ai") return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:11, padding:"1px 7px", borderRadius:3, background:`${T.purple}12`, color:T.purple }}>
      <Bot size={10}/>AI 生成
    </span>
  );
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:11, padding:"1px 7px", borderRadius:3, background:`${T.t4}30`, color:T.t3 }}>
      <User2 size={10}/>手工
    </span>
  );
}

function TypeTag({ type }: { type: string }) {
  const map: Record<string,string> = { "功能测试":T.primary, "异常测试":T.danger, "边界测试":T.warning, "安全测试":T.purple };
  const color = map[type] ?? T.t3;
  return (
    <span style={{ fontSize:11, padding:"1px 6px", borderRadius:3, border:`1px solid ${color}30`, color, background:`${color}0A` }}>{type}</span>
  );
}

function Dot({ enabled }: { enabled: boolean }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, color: enabled ? T.success : T.t3 }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background: enabled ? T.success : T.t4, flexShrink:0 }}/>
      {enabled ? "启用" : "停用"}
    </span>
  );
}

// ─── Tooltip wrapper ──────────────────────────────────────────────────────────
function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position:"relative", display:"inline-flex" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span style={{
          position:"absolute", bottom:"calc(100% + 4px)", left:"50%", transform:"translateX(-50%)",
          whiteSpace:"nowrap", padding:"4px 8px", borderRadius:5, fontSize:11,
          background:"#1D2129", color:"#fff", zIndex:9999, pointerEvents:"none",
          boxShadow:"0 2px 8px rgba(0,0,0,0.18)",
        }}>{text}</span>
      )}
    </span>
  );
}

// ─── Icon button ──────────────────────────────────────────────────────────────
function IconBtn({ icon:Icon, title, onClick, danger, disabled }: {
  icon:React.ElementType; title:string; onClick?:()=>void; danger?:boolean; disabled?:boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <Tip text={title}>
      <button onClick={disabled ? undefined : onClick} title={title}
        style={{
          display:"flex", alignItems:"center", justifyContent:"center",
          width:26, height:26, borderRadius:5, border:"none", cursor:disabled?"not-allowed":"pointer",
          background: hov && !disabled ? (danger ? `${T.danger}10` : T.bg) : "transparent",
          color: disabled ? T.t4 : danger ? T.danger : T.t2, opacity:disabled?0.5:1, transition:"all .12s",
        }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
        <Icon size={13}/>
      </button>
    </Tip>
  );
}

// ─── New Case Drawer ──────────────────────────────────────────────────────────
function NewCaseDrawer({ onClose, onSave }: { onClose:()=>void; onSave:(c:ApiCase)=>void }) {
  const [name, setName]       = useState("");
  const [desc, setDesc]       = useState("");
  const [level, setLevel]     = useState<CaseLevel>("P1");
  const [tagsText, setTagsText] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [drawerTab, setDrawerTab] = useState("params");

  const drawerTabs = [
    {key:"params",label:"请求参数"},{key:"headers",label:"Headers"},{key:"body",label:"Body"},
    {key:"pre",label:"前置处理"},{key:"post",label:"后置处理"},{key:"assert",label:"断言"},
  ];

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: `TC-00${Math.floor(Math.random() * 90 + 10)}`,
      name: name.trim(), level, type: "功能测试", source: "manual",
      tags: tagsText.split(",").map(t=>t.trim()).filter(Boolean),
      enabled, lastResult: "pending", lastRunTime: "", updatedAt: "刚刚", creator: "张程远",
    });
    onClose();
  };

  return (
    <>
      {/* Mask */}
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.25)", zIndex:200 }}/>
      {/* Drawer */}
      <div style={{
        position:"fixed", top:0, right:0, bottom:0, width:640, zIndex:201,
        background:"#fff", boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",
        display:"flex", flexDirection:"column",
      }}>
        {/* Header */}
        <div style={{ padding:"16px 24px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:15, fontWeight:600, color:T.t1, flex:1 }}>新建接口用例</span>
          <div style={{ fontSize:11, padding:"2px 8px", borderRadius:4, background:`${T.primary}10`, color:T.primary }}>
            当前接口定义将作为基础，可单独覆盖
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:T.t3 }}><X size={16}/></button>
        </div>

        {/* Form — scrollable */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
          {/* Basic fields */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:500, color:T.t2, marginBottom:5 }}>
              用例名称 <span style={{ color:T.danger }}>*</span>
            </label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="如：正常登录 — 有效用户名密码"
              style={{ width:"100%", boxSizing:"border-box", padding:"7px 11px", border:`1.5px solid ${name?T.border:T.border}`, borderRadius:6, fontSize:13, color:T.t1, outline:"none" }}
              onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:500, color:T.t2, marginBottom:5 }}>用例描述</label>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} placeholder="可选，说明本用例的测试目标..."
              style={{ width:"100%", boxSizing:"border-box", padding:"7px 11px", border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:13, color:T.t1, outline:"none", resize:"vertical", fontFamily:"inherit" }}
              onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            <div>
              <label style={{ display:"block", fontSize:12, fontWeight:500, color:T.t2, marginBottom:5 }}>
                用例等级 <span style={{ color:T.danger }}>*</span>
              </label>
              <select value={level} onChange={e=>setLevel(e.target.value as CaseLevel)}
                style={{ width:"100%", padding:"7px 10px", border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:13, color:T.t1, outline:"none", background:"#fff" }}>
                {(["P0","P1","P2","P3"] as CaseLevel[]).map(l=><option key={l} value={l}>{l} — {["核心冒烟","高优先级","中优先级","低优先级"][["P0","P1","P2","P3"].indexOf(l)]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display:"block", fontSize:12, fontWeight:500, color:T.t2, marginBottom:5 }}>标签</label>
              <input value={tagsText} onChange={e=>setTagsText(e.target.value)} placeholder="多个标签用逗号分隔"
                style={{ width:"100%", boxSizing:"border-box", padding:"7px 11px", border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:13, color:T.t1, outline:"none" }}
                onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
          </div>
          <div style={{ marginBottom:20, display:"flex", alignItems:"center", gap:10 }}>
            <label style={{ fontSize:12, fontWeight:500, color:T.t2 }}>是否启用</label>
            <div onClick={()=>setEnabled(v=>!v)} style={{
              width:36, height:20, borderRadius:10, background:enabled?T.primary:T.t4, position:"relative",
              cursor:"pointer", transition:"background .2s", flexShrink:0,
            }}>
              <div style={{ position:"absolute", top:2, left:enabled?18:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }}/>
            </div>
            <span style={{ fontSize:12, color:enabled?T.success:T.t3 }}>{enabled?"启用":"停用"}</span>
          </div>

          {/* Request override tabs */}
          <div style={{ borderRadius:8, border:`1px solid ${T.border}`, overflow:"hidden" }}>
            <div style={{ display:"flex", background:"#FAFAFA", borderBottom:`1px solid ${T.border}` }}>
              {drawerTabs.map(t=>(
                <button key={t.key} onClick={()=>setDrawerTab(t.key)}
                  style={{ padding:"8px 14px", fontSize:12, fontWeight:drawerTab===t.key?600:400, border:"none", background:"transparent", cursor:"pointer", color:drawerTab===t.key?T.primary:T.t3, borderBottom:`2px solid ${drawerTab===t.key?T.primary:"transparent"}` }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ padding:16, minHeight:120, display:"flex", alignItems:"center", justifyContent:"center" }}>
              {drawerTab === "params" && (
                <div style={{ width:"100%", fontSize:12, color:T.t3, textAlign:"center" }}>
                  <Info size={16} style={{ margin:"0 auto 6px", display:"block", color:T.t4 }}/>
                  将继承接口定义中的 Params，此处可覆盖特定值
                  <div style={{ marginTop:12 }}>
                    <button style={{ fontSize:12, color:T.primary, background:`${T.primary}0A`, border:`1px solid ${T.primary}30`, borderRadius:5, padding:"5px 14px", cursor:"pointer" }}>
                      + 覆盖参数
                    </button>
                  </div>
                </div>
              )}
              {drawerTab !== "params" && (
                <div style={{ fontSize:12, color:T.t4, textAlign:"center" }}>
                  <Info size={16} style={{ margin:"0 auto 6px", display:"block" }}/>
                  继承接口定义，可在此单独覆盖
                </div>
              )}
            </div>
          </div>

          {/* Assertion quick-add */}
          {drawerTab === "assert" && (
            <div style={{ marginTop:16, padding:12, borderRadius:8, background:T.bg, border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.t2, marginBottom:8 }}>断言规则</div>
              <div style={{ fontSize:12, color:T.t3 }}>暂无断言，点击上方 + 断言 添加验证规则</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"12px 24px", borderTop:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:8, justifyContent:"flex-end", background:"#fff" }}>
          <button onClick={onClose}
            style={{ padding:"6px 18px", border:`1px solid ${T.border}`, borderRadius:6, background:"#fff", fontSize:13, color:T.t2, cursor:"pointer" }}>
            取消
          </button>
          <button onClick={handleSave} disabled={!canSave}
            style={{ padding:"6px 18px", border:"none", borderRadius:6, background:canSave?T.primary:T.t4, color:"#fff", fontSize:13, fontWeight:500, cursor:canSave?"pointer":"not-allowed", display:"flex", alignItems:"center", gap:6 }}>
            <Save size={13}/>保存用例
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Column settings popover ──────────────────────────────────────────────────
const ALL_COLS = [
  {key:"id",label:"用例 ID",default:true,required:false},
  {key:"name",label:"用例名称",default:true,required:true},
  {key:"level",label:"等级",default:true,required:false},
  {key:"type",label:"类型",default:true,required:false},
  {key:"source",label:"来源",default:true,required:false},
  {key:"tags",label:"标签",default:false,required:false},
  {key:"enabled",label:"启用状态",default:false,required:false},
  {key:"lastResult",label:"最近执行",default:true,required:false},
  {key:"lastRunTime",label:"执行时间",default:false,required:false},
  {key:"updatedAt",label:"更新时间",default:false,required:false},
  {key:"creator",label:"创建人",default:true,required:false},
];

function ColumnSettings({ visible, onChange, onClose }: {
  visible: Set<string>; onChange:(k:string,v:boolean)=>void; onClose:()=>void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h = (e:MouseEvent) => { if(ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[onClose]);
  return (
    <div ref={ref} style={{
      position:"absolute", top:"calc(100% + 4px)", right:0, zIndex:100,
      background:"#fff", border:`1px solid ${T.border}`, borderRadius:8,
      boxShadow:"0 6px 20px rgba(0,0,0,0.10)", padding:"8px 0", minWidth:160,
    }}>
      <div style={{ padding:"4px 14px 8px", fontSize:11, fontWeight:600, color:T.t3, textTransform:"uppercase", letterSpacing:".4px" }}>显示列</div>
      {ALL_COLS.map(col=>(
        <label key={col.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 14px", cursor:col.required?"not-allowed":"pointer" }}>
          <input type="checkbox" checked={visible.has(col.key)} disabled={col.required}
            onChange={e=>!col.required&&onChange(col.key,e.target.checked)}
            style={{ accentColor:T.primary, cursor:col.required?"not-allowed":"pointer" }}/>
          <span style={{ fontSize:12, color:col.required?T.t3:T.t2 }}>{col.label}{col.required&&" *"}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Row actions dropdown ─────────────────────────────────────────────────────
function RowMoreMenu({ onDetail, onCopy, onDelete, onClose }: {
  onDetail:()=>void; onCopy:()=>void; onDelete:()=>void; onClose:()=>void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const h = (e:MouseEvent) => { if(ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[onClose]);
  return (
    <div ref={ref} style={{
      position:"absolute", top:"calc(100% + 2px)", right:0, zIndex:100,
      background:"#fff", border:`1px solid ${T.border}`, borderRadius:7,
      boxShadow:"0 6px 18px rgba(0,0,0,0.10)", minWidth:120, padding:"4px 0",
    }}>
      {[
        {icon:Eye, label:"查看详情", action:onDetail, danger:false},
        {icon:Copy, label:"复制用例", action:onCopy, danger:false},
        {icon:Trash2, label:"删除", action:onDelete, danger:true},
      ].map(({icon:Icon,label,action,danger})=>(
        <button key={label} onClick={()=>{action();onClose();}}
          style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"7px 14px", border:"none", background:"transparent", cursor:"pointer", fontSize:13, color:danger?T.danger:T.t2, textAlign:"left" }}
          onMouseEnter={e=>{e.currentTarget.style.background=danger?`${T.danger}08`:T.bg;}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
          <Icon size={12}/>{label}
        </button>
      ))}
    </div>
  );
}

// ─── Delete confirm overlay ───────────────────────────────────────────────────
function DeleteConfirm({ count, onConfirm, onCancel }: {
  count:number; onConfirm:()=>void; onCancel:()=>void;
}) {
  return (
    <>
      <div onClick={onCancel} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:300 }}/>
      <div style={{
        position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:301,
        background:"#fff", borderRadius:10, padding:"28px 32px", width:380,
        boxShadow:"0 8px 32px rgba(0,0,0,0.16)",
      }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:20 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:`${T.danger}12`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <AlertTriangle size={18} color={T.danger}/>
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:600, color:T.t1, marginBottom:6 }}>确认删除</div>
            <div style={{ fontSize:13, color:T.t2, lineHeight:1.6 }}>
              即将删除 <strong>{count}</strong> 条用例，此操作不可撤销。<br/>删除后相关执行记录将一并清除。
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onCancel}
            style={{ padding:"6px 18px", border:`1px solid ${T.border}`, borderRadius:6, background:"#fff", fontSize:13, color:T.t2, cursor:"pointer" }}>
            取消
          </button>
          <button onClick={onConfirm}
            style={{ padding:"6px 18px", border:"none", borderRadius:6, background:T.danger, color:"#fff", fontSize:13, fontWeight:500, cursor:"pointer" }}>
            确认删除
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div style={{ padding:"0 0 8px" }}>
      {Array.from({length:6}).map((_,i)=>(
        <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ width:16, height:16, borderRadius:3, background:`${T.border}`, flexShrink:0 }}/>
          <div style={{ width:60, height:12, borderRadius:4, background:T.border }}/>
          <div style={{ flex:1, height:12, borderRadius:4, background:T.border }}/>
          <div style={{ width:36, height:18, borderRadius:3, background:T.border }}/>
          <div style={{ width:60, height:18, borderRadius:3, background:T.border }}/>
          <div style={{ width:48, height:18, borderRadius:3, background:T.border }}/>
          <div style={{ width:80, height:12, borderRadius:4, background:T.border }}/>
          <div style={{ width:60, height:12, borderRadius:4, background:T.border }}/>
          <div style={{ width:80, height:24, borderRadius:5, background:T.border }}/>
        </div>
      ))}
      <style>{`
        @keyframes shimmer { 0%{opacity:.6} 50%{opacity:1} 100%{opacity:.6} }
        [style*="background:#E5E6EB"]{animation:shimmer 1.4s ease-in-out infinite}
      `}</style>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export interface ApiCaseTabProps {
  isSaved: boolean;
  method?: string;
  path?: string;
  endpointName?: string;
  envSelected?: boolean;
}

export function ApiCaseTab({ isSaved, method="GET", path="/api/auth/login", endpointName="用户登录", envSelected=true }: ApiCaseTabProps) {
  // Page state (demo: toggle via debug controls)
  const [demoState, setDemoState] = useState<PageState>(isSaved ? "loaded" : "unsaved");
  const [cases, setCases] = useState<ApiCase[]>(MOCK_CASES);

  useEffect(() => { setDemoState(isSaved ? "loaded" : "unsaved"); }, [isSaved]);

  // Filters
  const [searchQ,    setSearchQ]    = useState("");
  const [filterResult,setFilterResult] = useState("all");
  const [filterLevel, setFilterLevel]  = useState("all");
  const [filterSource,setFilterSource] = useState("all");
  const [aiLoading,  setAiLoading]  = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Dialogs
  const [showNewCase,   setShowNewCase]   = useState(false);
  const [editCaseId,    setEditCaseId]    = useState<string|null>(null);
  const [showColSettings, setShowColSettings] = useState(false);
  const [deleteTarget,  setDeleteTarget]  = useState<string[]|null>(null);
  const [moreMenuId,    setMoreMenuId]    = useState<string|null>(null);
  const [runningIds,    setRunningIds]    = useState<Set<string>>(new Set());

  // Visible columns
  const [visibleCols, setVisibleCols] = useState<Set<string>>(
    new Set(ALL_COLS.filter(c=>c.default||c.required).map(c=>c.key))
  );
  const toggleCol = useCallback((k:string,v:boolean)=>{
    setVisibleCols(prev=>{const n=new Set(prev);v?n.add(k):n.delete(k);return n;});
  },[]);

  // Derived
  const filtered = cases.filter(c => {
    if (searchQ    && !c.name.includes(searchQ) && !c.id.includes(searchQ)) return false;
    if (filterResult !== "all" && c.lastResult !== filterResult) return false;
    if (filterLevel  !== "all" && c.level       !== filterLevel)  return false;
    if (filterSource !== "all" && c.source      !== filterSource) return false;
    return true;
  });
  const hasFilters = searchQ || filterResult !== "all" || filterLevel !== "all" || filterSource !== "all";
  const allSelected = filtered.length > 0 && filtered.every(c=>selected.has(c.id));
  const someSelected = selected.size > 0;

  const clearFilters = () => { setSearchQ(""); setFilterResult("all"); setFilterLevel("all"); setFilterSource("all"); };

  const runCase = (id: string) => {
    if (!envSelected) { alert("请先在接口编辑区选择运行环境"); return; }
    if (runningIds.has(id)) return;
    setRunningIds(prev => new Set([...prev, id]));
    setCases(p => p.map(c => c.id===id ? {...c, lastResult:"running"} : c));
    setTimeout(() => {
      const pass = Math.random() > 0.3;
      setCases(p => p.map(c => c.id===id ? {...c, lastResult: pass?"passed":"failed", lastRunTime:"刚刚"} : c));
      setRunningIds(prev => { const n=new Set(prev); n.delete(id); return n; });
    }, 2200);
  };

  const runSelected = () => {
    [...selected].forEach(id => runCase(id));
    setSelected(new Set());
  };

  const addCase = (c: ApiCase) => {
    setCases(p => [c, ...p]);
    setDemoState("loaded");
  };

  const copyCase = (id: string) => {
    const orig = cases.find(c=>c.id===id);
    if (!orig) return;
    setCases(p => [{ ...orig, id:`TC-${String(Math.floor(Math.random()*900+100))}}`, name:`${orig.name} (副本)`, lastResult:"pending", lastRunTime:"" }, ...p]);
  };

  const deleteCase = (ids: string[]) => {
    setCases(p => p.filter(c=>!ids.includes(c.id)));
    setSelected(new Set());
    if (cases.length - ids.length === 0) setDemoState("empty");
  };

  const toggleEnabled = (id: string) => {
    setCases(p => p.map(c => c.id===id ? {...c, enabled:!c.enabled} : c));
  };

  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const handleAiGenerate = () => {
    if (!isSaved) return;
    setShowAiDrawer(true);
  };

  const METHOD_COLOR: Record<string,string> = {
    GET:"#00B42A", POST:"#FF7D00", PUT:"#165DFF", DELETE:"#F53F3F", PATCH:"#7816FF",
  };

  // ── Toolbar ──────────────────────────────────────────────────────────────
  const ToolBar = () => (
    <div style={{
      padding:"10px 16px", background:"#fff", borderBottom:`1px solid ${T.border}`,
      display:"flex", alignItems:"center", gap:8, flexShrink:0,
    }}>
      {/* Context hint */}
      <span style={{ fontSize:11, color:T.t4, display:"flex", alignItems:"center", gap:4, flexShrink:0, marginRight:4 }}>
        <span style={{ fontWeight:700, color:METHOD_COLOR[method]??T.t3, fontSize:11 }}>{method}</span>
        <span style={{ color:T.t3, fontFamily:"'JetBrains Mono',monospace", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{path}</span>
        <span style={{ color:T.t4 }}>·</span>
        <span style={{ color:T.t3 }}>{cases.length} 条用例</span>
      </span>

      {/* Primary: New case */}
      <button onClick={isSaved ? ()=>setShowNewCase(true) : undefined}
        disabled={!isSaved}
        style={{
          display:"flex", alignItems:"center", gap:5, padding:"5px 14px", border:"none",
          borderRadius:6, background:isSaved?T.primary:T.t4, color:"#fff",
          fontSize:12, fontWeight:500, cursor:isSaved?"pointer":"not-allowed", flexShrink:0,
        }}>
        <Plus size={13}/>新建用例
      </button>

      {/* Secondary: AI generate */}
      <Tip text={!isSaved ? "请先保存当前接口" : "通过 AI 批量生成候选用例"}>
        <button onClick={isSaved && !aiLoading ? handleAiGenerate : undefined}
          style={{
            display:"flex", alignItems:"center", gap:5, padding:"5px 12px",
            border:`1.5px solid ${isSaved ? `${T.purple}40` : T.border}`,
            borderRadius:6, background: isSaved ? `${T.purple}08` : "#fff",
            color: isSaved ? T.purple : T.t4, fontSize:12, fontWeight:500,
            cursor: isSaved && !aiLoading ? "pointer" : "not-allowed", flexShrink:0,
            opacity: isSaved ? 1 : 0.5, transition:"all .15s",
          }}>
          {aiLoading
            ? <><Loader2 size={13} className="animate-spin"/>生成中…</>
            : <><Sparkles size={13}/>AI 生成</>}
        </button>
      </Tip>

      <div style={{ flex:1 }}/>

      {/* Search */}
      <div style={{ position:"relative", flexShrink:0 }}>
        <Search size={12} style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", color:T.t4 }}/>
        <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="搜索用例名称 / ID"
          style={{ paddingLeft:28, paddingRight:searchQ?28:10, paddingTop:5, paddingBottom:5, border:`1.5px solid ${T.border}`, borderRadius:6, fontSize:12, color:T.t1, outline:"none", width:180 }}
          onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}/>
        {searchQ && <button onClick={()=>setSearchQ("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", lineHeight:0, color:T.t4 }}><X size={11}/></button>}
      </div>

      {/* Filter: status */}
      <select value={filterResult} onChange={e=>setFilterResult(e.target.value)}
        style={{ padding:"5px 8px", border:`1.5px solid ${filterResult!=="all"?T.primary:T.border}`, borderRadius:6, fontSize:12, color:filterResult!=="all"?T.primary:T.t2, outline:"none", background:"#fff", cursor:"pointer" }}>
        <option value="all">全部状态</option>
        {(["passed","failed","error","pending","running","cancelled"] as CaseResult[]).map(r=><option key={r} value={r}>{RESULT_CFG[r].label}</option>)}
      </select>

      {/* Filter: level */}
      <select value={filterLevel} onChange={e=>setFilterLevel(e.target.value)}
        style={{ padding:"5px 8px", border:`1.5px solid ${filterLevel!=="all"?T.primary:T.border}`, borderRadius:6, fontSize:12, color:filterLevel!=="all"?T.primary:T.t2, outline:"none", background:"#fff", cursor:"pointer" }}>
        <option value="all">全部等级</option>
        {(["P0","P1","P2","P3"]).map(l=><option key={l} value={l}>{l}</option>)}
      </select>

      {/* Filter: source */}
      <select value={filterSource} onChange={e=>setFilterSource(e.target.value)}
        style={{ padding:"5px 8px", border:`1.5px solid ${filterSource!=="all"?T.primary:T.border}`, borderRadius:6, fontSize:12, color:filterSource!=="all"?T.primary:T.t2, outline:"none", background:"#fff", cursor:"pointer" }}>
        <option value="all">全部来源</option>
        <option value="manual">手工创建</option>
        <option value="ai">AI 生成</option>
      </select>

      {/* Refresh */}
      <Tip text="刷新">
        <button onClick={()=>{ setDemoState("loading"); setTimeout(()=>setDemoState("loaded"),900); }}
          style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, border:`1px solid ${T.border}`, borderRadius:6, background:"#fff", cursor:"pointer", color:T.t2 }}>
          <RefreshCw size={13}/>
        </button>
      </Tip>

      {/* Column settings */}
      <div style={{ position:"relative" }}>
        <Tip text="列设置">
          <button onClick={()=>setShowColSettings(v=>!v)}
            style={{ display:"flex", alignItems:"center", justifyContent:"center", width:30, height:30, border:`1px solid ${T.border}`, borderRadius:6, background:"#fff", cursor:"pointer", color:T.t2 }}>
            <SlidersHorizontal size={13}/>
          </button>
        </Tip>
        {showColSettings && <ColumnSettings visible={visibleCols} onChange={toggleCol} onClose={()=>setShowColSettings(false)}/>}
      </div>
    </div>
  );

  // ── Batch bar ────────────────────────────────────────────────────────────
  const BatchBar = () => (
    <div style={{
      padding:"7px 16px", background:`${T.primary}06`, borderBottom:`1px solid ${T.primary}20`,
      display:"flex", alignItems:"center", gap:10, flexShrink:0,
    }}>
      <span style={{ fontSize:12, fontWeight:500, color:T.primary, marginRight:4 }}>已选 {selected.size} 条</span>
      <button onClick={runSelected}
        style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 12px", border:`1px solid ${T.primary}40`, borderRadius:5, background:`${T.primary}0A`, color:T.primary, fontSize:12, cursor:"pointer" }}>
        <Play size={11}/>批量执行
      </button>
      <button onClick={()=>setCases(p=>p.map(c=>selected.has(c.id)?{...c,enabled:true}:c))}
        style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 12px", border:`1px solid ${T.success}40`, borderRadius:5, background:`${T.success}08`, color:T.success, fontSize:12, cursor:"pointer" }}>
        批量启用
      </button>
      <button onClick={()=>setCases(p=>p.map(c=>selected.has(c.id)?{...c,enabled:false}:c))}
        style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 12px", border:`1px solid ${T.border}`, borderRadius:5, background:"#fff", color:T.t2, fontSize:12, cursor:"pointer" }}>
        批量停用
      </button>
      <button onClick={()=>setDeleteTarget([...selected])}
        style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 12px", border:`1px solid ${T.danger}40`, borderRadius:5, background:`${T.danger}08`, color:T.danger, fontSize:12, cursor:"pointer" }}>
        <Trash2 size={11}/>批量删除
      </button>
      <div style={{ flex:1 }}/>
      <button onClick={()=>setSelected(new Set())}
        style={{ display:"flex", alignItems:"center", gap:3, padding:"4px 10px", border:"none", background:"transparent", color:T.t3, fontSize:12, cursor:"pointer" }}>
        <X size={11}/>取消选择
      </button>
    </div>
  );

  // ── Table ────────────────────────────────────────────────────────────────
  const Table = () => (
    <div style={{ flex:1, overflowY:"auto", overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed", minWidth:860 }}>
        <colgroup>
          <col style={{ width:40 }}/>
          {visibleCols.has("id")         && <col style={{ width:88 }}/>}
          <col style={{ width:"auto" }}/>  {/* name — flex */}
          {visibleCols.has("level")      && <col style={{ width:64 }}/>}
          {visibleCols.has("type")       && <col style={{ width:92 }}/>}
          {visibleCols.has("source")     && <col style={{ width:88 }}/>}
          {visibleCols.has("tags")       && <col style={{ width:140 }}/>}
          {visibleCols.has("enabled")    && <col style={{ width:72 }}/>}
          {visibleCols.has("lastResult") && <col style={{ width:108 }}/>}
          {visibleCols.has("lastRunTime")&& <col style={{ width:120 }}/>}
          {visibleCols.has("updatedAt")  && <col style={{ width:100 }}/>}
          {visibleCols.has("creator")    && <col style={{ width:80 }}/>}
          <col style={{ width:108 }}/>  {/* ops — fixed right */}
        </colgroup>
        <thead style={{ position:"sticky", top:0, zIndex:10 }}>
          <tr style={{ background:"#F7F8FA", borderBottom:`1px solid ${T.border}` }}>
            <th style={{ padding:"9px 12px", textAlign:"center" }}>
              <input type="checkbox" checked={allSelected} onChange={()=>allSelected?setSelected(new Set()):setSelected(new Set(filtered.map(c=>c.id)))}
                style={{ cursor:"pointer", accentColor:T.primary, width:14, height:14 }}/>
            </th>
            {visibleCols.has("id")          && <Th>ID</Th>}
            <Th left>用例名称</Th>
            {visibleCols.has("level")       && <Th>等级</Th>}
            {visibleCols.has("type")        && <Th>类型</Th>}
            {visibleCols.has("source")      && <Th>来源</Th>}
            {visibleCols.has("tags")        && <Th left>标签</Th>}
            {visibleCols.has("enabled")     && <Th>状态</Th>}
            {visibleCols.has("lastResult")  && <Th>最近执行</Th>}
            {visibleCols.has("lastRunTime") && <Th>执行时间</Th>}
            {visibleCols.has("updatedAt")   && <Th>更新时间</Th>}
            {visibleCols.has("creator")     && <Th>创建人</Th>}
            <Th>操作</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(c => {
            const isRunning = runningIds.has(c.id);
            const isSelected = selected.has(c.id);
            return (
              <tr key={c.id}
                style={{ borderBottom:`1px solid ${T.border}`, background: isSelected ? `${T.primary}06` : "#fff", transition:"background .1s" }}
                onMouseEnter={e=>{ if(!isSelected)(e.currentTarget as HTMLElement).style.background=T.bg; }}
                onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background=isSelected?`${T.primary}06`:"#fff"; }}>
                <td style={{ padding:"11px 12px", textAlign:"center" }}>
                  <input type="checkbox" checked={isSelected}
                    onChange={()=>setSelected(prev=>{const n=new Set(prev);isSelected?n.delete(c.id):n.add(c.id);return n;})}
                    style={{ cursor:"pointer", accentColor:T.primary, width:14, height:14 }}/>
                </td>
                {visibleCols.has("id") && (
                  <td style={{ padding:"11px 12px" }}>
                    <span style={{ fontSize:11, color:T.t3, fontFamily:"'JetBrains Mono',monospace" }}>{c.id}</span>
                  </td>
                )}
                <td style={{ padding:"11px 12px", overflow:"hidden" }}>
                  <Tip text={c.name}>
                    <span style={{ fontSize:13, color:T.t1, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block", cursor:"default" }}>{c.name}</span>
                  </Tip>
                </td>
                {visibleCols.has("level")      && <td style={{ padding:"11px 8px", textAlign:"center" }}><LevelBadge level={c.level}/></td>}
                {visibleCols.has("type")       && <td style={{ padding:"11px 8px", textAlign:"center" }}><TypeTag type={c.type}/></td>}
                {visibleCols.has("source")     && <td style={{ padding:"11px 8px", textAlign:"center" }}><SourceTag source={c.source}/></td>}
                {visibleCols.has("tags")       && (
                  <td style={{ padding:"11px 8px", overflow:"hidden" }}>
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {c.tags.slice(0,2).map(tag=><span key={tag} style={{ fontSize:10, padding:"1px 5px", borderRadius:3, background:T.bg, color:T.t3, whiteSpace:"nowrap" }}>{tag}</span>)}
                      {c.tags.length>2&&<span style={{ fontSize:10, color:T.t4 }}>+{c.tags.length-2}</span>}
                    </div>
                  </td>
                )}
                {visibleCols.has("enabled")    && (
                  <td style={{ padding:"11px 8px", textAlign:"center" }}>
                    <button onClick={()=>toggleEnabled(c.id)} style={{ background:"none", border:"none", cursor:"pointer" }}>
                      <Dot enabled={c.enabled}/>
                    </button>
                  </td>
                )}
                {visibleCols.has("lastResult") && (
                  <td style={{ padding:"11px 8px" }}>
                    <ResultBadge result={isRunning ? "running" : c.lastResult}/>
                  </td>
                )}
                {visibleCols.has("lastRunTime")&& <td style={{ padding:"11px 8px" }}><span style={{ fontSize:11, color:T.t3 }}>{c.lastRunTime||"—"}</span></td>}
                {visibleCols.has("updatedAt")  && <td style={{ padding:"11px 8px" }}><span style={{ fontSize:11, color:T.t3 }}>{c.updatedAt}</span></td>}
                {visibleCols.has("creator")    && <td style={{ padding:"11px 8px" }}><span style={{ fontSize:12, color:T.t2 }}>{c.creator}</span></td>}
                {/* Ops — fixed right */}
                <td style={{ padding:"11px 12px", textAlign:"right" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:2, position:"relative" }}>
                    <IconBtn icon={Edit2} title="编辑用例" onClick={()=>setEditCaseId(c.id)}/>
                    {isRunning
                      ? <IconBtn icon={StopCircle} title="取消执行" onClick={()=>{setRunningIds(prev=>{const n=new Set(prev);n.delete(c.id);return n;});setCases(p=>p.map(x=>x.id===c.id?{...x,lastResult:"cancelled"}:x));}}/>
                      : <IconBtn icon={Play} title={envSelected?"执行用例":"请先选择运行环境"} onClick={()=>runCase(c.id)} disabled={!envSelected}/>
                    }
                    <div style={{ position:"relative" }}>
                      <IconBtn icon={MoreHorizontal} title="更多操作" onClick={()=>setMoreMenuId(moreMenuId===c.id?null:c.id)}/>
                      {moreMenuId===c.id && (
                        <RowMoreMenu
                          onDetail={()=>{}}
                          onCopy={()=>copyCase(c.id)}
                          onDelete={()=>setDeleteTarget([c.id])}
                          onClose={()=>setMoreMenuId(null)}
                        />
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // ── State renders ────────────────────────────────────────────────────────

  // Unsaved banner
  const UnsavedBanner = () => (
    <div style={{ padding:"10px 16px", background:"#FFF7E6", borderBottom:`1px solid ${T.warning}30`, display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
      <AlertTriangle size={14} color={T.warning}/>
      <span style={{ fontSize:12, color:T.warning, flex:1 }}>
        请先<strong>保存当前接口</strong>，再创建或生成用例
      </span>
      <span style={{ fontSize:11, color:T.t4 }}>未保存的接口不支持绑定用例</span>
    </div>
  );

  const EmptyState = () => (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40 }}>
      <div style={{ width:56, height:56, borderRadius:16, background:`${T.primary}0A`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
        <FileTestIcon/>
      </div>
      <div style={{ fontSize:14, fontWeight:600, color:T.t1, marginBottom:6 }}>
        {endpointName} 暂无用例
      </div>
      <div style={{ fontSize:13, color:T.t3, marginBottom:24, textAlign:"center", maxWidth:320, lineHeight:1.7 }}>
        为当前接口创建测试用例，覆盖正向流程、异常场景和边界条件。
      </div>
      <div style={{ display:"flex", gap:10 }}>
        <button onClick={()=>setShowNewCase(true)}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 18px", border:"none", borderRadius:7, background:T.primary, color:"#fff", fontSize:13, fontWeight:500, cursor:"pointer" }}>
          <Plus size={13}/>新建用例
        </button>
        <button onClick={handleAiGenerate}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 18px", border:`1.5px solid ${T.purple}40`, borderRadius:7, background:`${T.purple}08`, color:T.purple, fontSize:13, fontWeight:500, cursor:"pointer" }}>
          <Sparkles size={13}/>AI 生成
        </button>
      </div>
    </div>
  );

  const NoResultsState = () => (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40 }}>
      <Search size={32} style={{ color:T.t4, marginBottom:12 }}/>
      <div style={{ fontSize:14, fontWeight:600, color:T.t2, marginBottom:6 }}>未找到匹配用例</div>
      <div style={{ fontSize:13, color:T.t3, marginBottom:16 }}>
        当前筛选条件下没有结果，共 {cases.length} 条用例
      </div>
      <button onClick={clearFilters}
        style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 16px", border:`1px solid ${T.border}`, borderRadius:6, background:"#fff", color:T.t2, fontSize:13, cursor:"pointer" }}>
        <X size={12}/>清除筛选条件
      </button>
    </div>
  );

  const ErrorState = () => (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40 }}>
      <div style={{ width:48, height:48, borderRadius:"50%", background:`${T.danger}10`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
        <AlertCircle size={22} color={T.danger}/>
      </div>
      <div style={{ fontSize:14, fontWeight:600, color:T.t1, marginBottom:6 }}>加载失败</div>
      <div style={{ fontSize:12, color:T.t3, marginBottom:16 }}>网络错误，无法获取用例数据（ERR_CONNECTION_REFUSED）</div>
      <button onClick={()=>{ setDemoState("loading"); setTimeout(()=>setDemoState("loaded"),900); }}
        style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 16px", border:`1px solid ${T.border}`, borderRadius:6, background:"#fff", color:T.t2, fontSize:13, cursor:"pointer" }}>
        <RefreshCw size={12}/>重新加载
      </button>
      <div style={{ marginTop:10, fontSize:11, color:T.t4 }}>加载失败不影响接口其他配置的编辑</div>
    </div>
  );

  const UnsavedContentState = () => (
    <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:40 }}>
      <div style={{ width:48, height:48, borderRadius:14, background:`${T.warning}10`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
        <AlertTriangle size={22} color={T.warning}/>
      </div>
      <div style={{ fontSize:14, fontWeight:600, color:T.t1, marginBottom:6 }}>接口尚未保存</div>
      <div style={{ fontSize:13, color:T.t3, marginBottom:6, textAlign:"center", maxWidth:300, lineHeight:1.7 }}>
        请先保存当前接口，再创建或通过 AI 生成用例。
      </div>
      <div style={{ fontSize:11, color:T.t4 }}>已有用例不受影响，保存后即可访问</div>
    </div>
  );

  // ── Demo state switcher (dev only) ───────────────────────────────────────
  const DevBar = () => (
    <div style={{ padding:"4px 16px", background:"#F0F4FF", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
      <span style={{ fontSize:10, color:T.t4 }}>演示状态：</span>
      {(["loading","loaded","empty","no-results","error","unsaved"] as PageState[]).map(s=>(
        <button key={s} onClick={()=>setDemoState(s)}
          style={{ fontSize:10, padding:"2px 7px", borderRadius:3, border:`1px solid ${demoState===s?T.primary:T.border}`, background:demoState===s?`${T.primary}10`:"#fff", color:demoState===s?T.primary:T.t3, cursor:"pointer" }}>
          {s}
        </button>
      ))}
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#fff" }}>
      <DevBar/>
      {demoState==="unsaved" && <UnsavedBanner/>}
      <ToolBar/>
      {someSelected && <BatchBar/>}

      {/* Content area */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {demoState==="loading"    && <TableSkeleton/>}
        {demoState==="error"      && <ErrorState/>}
        {demoState==="unsaved"    && <UnsavedContentState/>}
        {demoState==="empty"      && <EmptyState/>}
        {demoState==="no-results" && (
          <>
            <ToolBar/>
            <NoResultsState/>
          </>
        )}
        {demoState==="loaded" && (
          filtered.length===0 && hasFilters
            ? <NoResultsState/>
            : <Table/>
        )}
      </div>

      {/* Pagination */}
      {(demoState==="loaded") && filtered.length > 0 && (
        <div style={{
          padding:"8px 16px", borderTop:`1px solid ${T.border}`, background:"#fff",
          display:"flex", alignItems:"center", gap:8, flexShrink:0,
        }}>
          <span style={{ fontSize:12, color:T.t3, flex:1 }}>共 {filtered.length} 条</span>
          <select style={{ padding:"3px 8px", border:`1px solid ${T.border}`, borderRadius:5, fontSize:12, color:T.t2, outline:"none", background:"#fff" }}>
            <option>20 / 页</option><option>50 / 页</option><option>100 / 页</option>
          </select>
          {[1,2,3].map(p=>(
            <button key={p} style={{ width:28, height:28, borderRadius:5, border:`1px solid ${p===1?T.primary:T.border}`, background:p===1?T.primary:"#fff", color:p===1?"#fff":T.t2, fontSize:12, cursor:"pointer" }}>{p}</button>
          ))}
        </div>
      )}

      {/* Drawers & dialogs */}
      {showNewCase && (
        <ApiCaseDrawer mode="new" method={method} path={path} endpointName={endpointName}
          onClose={()=>setShowNewCase(false)}
          onSaved={(f)=>{ addCase({ id:`TC-${Math.floor(Math.random()*900+100)}`, name:f.name, level:f.level, type:f.caseType, source:f.source, tags:f.tags, enabled:f.enabled, lastResult:"pending", lastRunTime:"", updatedAt:"刚刚", creator:"张程远" }); setShowNewCase(false); }}/>
      )}
      {editCaseId && (()=>{
        const c = cases.find(x=>x.id===editCaseId);
        if(!c) return null;
        const drawerMode = c.source==="ai" ? "ai" : "edit";
        return (
          <ApiCaseDrawer mode={drawerMode} method={method} path={path} endpointName={endpointName}
            onClose={()=>setEditCaseId(null)}
            onSaved={()=>setEditCaseId(null)}/>
        );
      })()}
      {deleteTarget && (
        <DeleteConfirm
          count={deleteTarget.length}
          onConfirm={()=>{ deleteCase(deleteTarget); setDeleteTarget(null); }}
          onCancel={()=>setDeleteTarget(null)}
        />
      )}
      {showAiDrawer && (
        <ApiAiGenerationDrawer
          method="POST"
          path="/user-auth/auth/v1/back-unified-login/by-pwd"
          endpointName="登录认证 · 登录"
          isSaved={demoState!=="unsaved"}
          onClose={()=>setShowAiDrawer(false)}
          onGenerate={()=>{ setShowAiDrawer(false); }}
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Th({ children, left }: { children?: React.ReactNode; left?: boolean }) {
  return (
    <th style={{ padding:"9px 8px", textAlign:left?"left":"center", fontSize:11, fontWeight:600, color:T.t3, textTransform:"uppercase", letterSpacing:".4px", whiteSpace:"nowrap" }}>
      {children}
    </th>
  );
}

function FileTestIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="12" y2="17"/>
      <polyline points="9 9 9 9"/>
    </svg>
  );
}
