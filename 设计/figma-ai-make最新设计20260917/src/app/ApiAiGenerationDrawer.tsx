/**
 * ApiAiGenerationDrawer
 * AI 生成接口用例配置抽屉
 *
 * 功能结构继承自 ApiAiGenerationDrawer.vue / ApiAiCaseModule.vue / useApiAiCaseGeneration.ts
 * 视觉语言完全按照当前 T 设计系统重铸。
 *
 * 继承内容：
 *  - 四组生成类型（正向/负向/边界值/安全性）及每项选项
 *  - 用例数选项（自动/10/20/40/80）
 *  - AI 模型选择（来自连接池）
 *  - 不重复生成用例开关
 *  - 补充要求文本框
 *  - 生成流程：校验 → 创建任务 → 关闭抽屉 → 打开 AI 工作标签
 *
 * 视觉升级内容：
 *  - 复选框网格密度优化，两列 + 分组标头（全选）
 *  - 按钮、选择器、开关均套用 T token
 *  - 头部接口上下文轻量展示（不做巨型卡片）
 *  - 所有 10 种状态通过 demoState 切换器演示
 *
 * 未改动的功能和交互：
 *  - 未删减任何选项
 *  - 未增加代码不支持的新能力（无 Token 成本估算等）
 *  - 未改为聊天气泡或向导表单
 */
import React, { useState, useRef } from "react";
import {
  X, Bot, Loader2, AlertTriangle, AlertCircle,
  CheckCircle, ChevronDown, Zap, ExternalLink,
  RefreshCw, Info,
} from "lucide-react";

const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F", purple:"#7816FF",
  bg:"#F4F6FA", border:"#E5E6EB",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};
const METHOD_COLOR: Record<string,string> = {
  GET:"#00B42A", POST:"#FF7D00", PUT:"#165DFF", DELETE:"#F53F3F", PATCH:"#7816FF",
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const CASE_GROUPS = [
  {
    key: "positive",
    label: "正向",
    items: [
      { key: "necessary_fields",  label: "仅传必要字段"  },
      { key: "semantic_valid",    label: "语义合法"      },
      { key: "enum_combinations", label: "覆盖枚举组合"  },
      { key: "other_positive",    label: "其他正向"      },
    ],
  },
  {
    key: "negative",
    label: "负向",
    items: [
      { key: "invalid_value",     label: "无效值"       },
      { key: "missing_required",  label: "缺失必填字段" },
      { key: "format_error",      label: "格式错误"     },
      { key: "type_error",        label: "类型错误"     },
      { key: "semantic_illegal",  label: "语义非法"     },
      { key: "other_negative",    label: "其他负向"     },
    ],
  },
  {
    key: "boundary",
    label: "边界值",
    items: [
      { key: "max_min_value",     label: "极大值/极小值"    },
      { key: "exceed_boundary",   label: "超出最大、最小边界值" },
      { key: "null_zero_empty",   label: "Null/零值/空值"   },
      { key: "string_length",     label: "字符串过长、过短" },
    ],
  },
  {
    key: "security",
    label: "安全性",
    items: [
      { key: "auth_control",      label: "鉴权控制"     },
      { key: "sql_injection",     label: "SQL 注入"     },
      { key: "fuzzy_input",       label: "模糊输入"     },
      { key: "xss_injection",     label: "XSS 注入"     },
      { key: "command_injection", label: "命令行注入"   },
      { key: "json_injection",    label: "JSON 注入"    },
      { key: "nosql_injection",   label: "NoSQL 注入"   },
    ],
  },
] as const;

type CaseKey = typeof CASE_GROUPS[number]["items"][number]["key"];

const ALL_ITEM_KEYS: CaseKey[] = CASE_GROUPS.flatMap(g => g.items.map(i => i.key));

const COUNT_OPTIONS = [
  { value: "auto", label: "自动" },
  { value: "10",   label: "10 条" },
  { value: "20",   label: "20 条" },
  { value: "40",   label: "40 条" },
  { value: "80",   label: "80 条" },
] as const;

interface AiModel {
  connectionId: string;
  connectionName: string;
  modelId: string;
  modelLabel: string;
}
const MOCK_MODELS: AiModel[] = [
  { connectionId:"c1", connectionName:"DeepSeek 连接",  modelId:"deepseek-chat",       modelLabel:"deepseek · chat"       },
  { connectionId:"c2", connectionName:"OpenAI 连接",    modelId:"gpt-4o",               modelLabel:"GPT-4o"                },
  { connectionId:"c3", connectionName:"Claude 连接",    modelId:"claude-sonnet-4-6",    modelLabel:"claude-sonnet-4-6"     },
];

// ─── Demo states ──────────────────────────────────────────────────────────────
type DemoState =
  | "default"        // 1. 默认（部分已选）
  | "partial"        // 2. 仅选少量
  | "all"            // 3. 全选
  | "model-open"     // 4. 模型下拉展开
  | "model-loading"  // 5. 模型加载中
  | "no-model"       // 6. 无可用模型
  | "not-saved"      // 7. 接口未保存
  | "no-type"        // 8. 未选类型
  | "submitting"     // 9. 正在创建任务
  | "submit-fail";   // 10. 创建任务失败

const DEMO_LABELS: Record<DemoState,string> = {
  "default":      "① 默认",
  "partial":      "② 少量选择",
  "all":          "③ 全选",
  "model-open":   "④ 模型展开",
  "model-loading":"⑤ 模型加载",
  "no-model":     "⑥ 无可用模型",
  "not-saved":    "⑦ 接口未保存",
  "no-type":      "⑧ 未选类型",
  "submitting":   "⑨ 创建中",
  "submit-fail":  "⑩ 创建失败",
};

// ─── Sub-components ────────────────────────────────────────────────────────────
function Checkbox({ checked, indeterminate, onChange, disabled }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void; disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange} disabled={disabled}
      style={{ width:14, height:14, cursor:disabled?"not-allowed":"pointer", accentColor:T.primary, flexShrink:0 }}/>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div onClick={onChange} style={{ width:36, height:20, borderRadius:10, background:on?T.primary:T.t4, position:"relative", cursor:"pointer", flexShrink:0, transition:"background .15s" }}>
      <div style={{ position:"absolute", top:2, left:on?18:2, width:16, height:16, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 3px rgba(0,0,0,0.2)", transition:"left .15s" }}/>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export interface ApiAiGenerationDrawerProps {
  method?: string;
  path?: string;
  endpointName?: string;
  isSaved?: boolean;
  onClose: () => void;
  onGenerate?: () => void;
}

export function ApiAiGenerationDrawer({
  method="POST",
  path="/user-auth/auth/v1/back-unified-login/by-pwd",
  endpointName="登录认证 · 登录",
  onClose,
  onGenerate,
}: ApiAiGenerationDrawerProps) {

  // ── Demo state switcher ──
  const [demoState, setDemoState] = useState<DemoState>("default");

  // ── Business state ──
  const getInitSelected = (ds: DemoState): Set<CaseKey> => {
    if (ds==="no-type")  return new Set();
    if (ds==="partial")  return new Set(["necessary_fields","invalid_value","auth_control"] as CaseKey[]);
    if (ds==="all")      return new Set(ALL_ITEM_KEYS);
    // default / others — first 12
    return new Set(ALL_ITEM_KEYS.slice(0, 12));
  };

  const [selected,   setSelected]   = useState<Set<CaseKey>>(getInitSelected("default"));
  const [count,      setCount]      = useState<string>("auto");
  const [modelOpen,  setModelOpen]  = useState(false);
  const [activeModel,setActiveModel]= useState<AiModel>(MOCK_MODELS[0]);
  const [noRepeat,   setNoRepeat]   = useState(true);
  const [extraReqs,  setExtraReqs]  = useState("");

  const switchDemo = (ds: DemoState) => {
    setDemoState(ds);
    setSelected(getInitSelected(ds));
    setModelOpen(ds==="model-open");
  };

  // Derived flags from demoState
  const isModelLoading  = demoState==="model-loading";
  const isNoModel       = demoState==="no-model";
  const isNotSaved      = demoState==="not-saved";
  const isSubmitting    = demoState==="submitting";
  const isSubmitFail    = demoState==="submit-fail";
  const hasModels       = !isModelLoading && !isNoModel;

  // Toggle item
  const toggleItem = (key: CaseKey) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelected(next);
  };

  // Group all-select logic
  const groupState = (groupItems: readonly { key: CaseKey }[]) => {
    const keys = groupItems.map(i => i.key);
    const cnt = keys.filter(k => selected.has(k)).length;
    return { all: cnt===keys.length, some: cnt>0&&cnt<keys.length };
  };
  const toggleGroup = (groupItems: readonly { key: CaseKey }[]) => {
    const keys = groupItems.map(i => i.key);
    const { all } = groupState(groupItems);
    const next = new Set(selected);
    keys.forEach(k => all ? next.delete(k) : next.add(k));
    setSelected(next);
  };

  // Overall all-select
  const overallAll  = selected.size === ALL_ITEM_KEYS.length;
  const overallSome = selected.size > 0 && selected.size < ALL_ITEM_KEYS.length;

  // Generate button state
  const canGenerate = selected.size > 0 && hasModels && !isNotSaved && !isSubmitting;
  const methodColor = METHOD_COLOR[method] ?? T.t3;

  // Button label + icon
  const btnLabel = (() => {
    if (isSubmitting)        return "正在创建任务…";
    if (isSubmitFail)        return "重新生成";
    if (isNotSaved)          return "接口未保存，无法生成";
    if (selected.size===0)   return "请选择生成类型";
    if (isNoModel)           return "无可用 AI 模型";
    return "生成";
  })();
  const btnIcon = (() => {
    if (isSubmitting)   return <Loader2 size={14} style={{ animation:"spin 1s linear infinite" }}/>;
    if (isSubmitFail)   return <RefreshCw size={14}/>;
    if (isNotSaved)     return <AlertTriangle size={14}/>;
    if (!canGenerate)   return <AlertCircle size={14}/>;
    return <Zap size={14}/>;
  })();

  const handleGenerate = () => {
    if (!canGenerate) return;
    onGenerate?.();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.15)",zIndex:200 }}/>

      {/* Drawer */}
      <div style={{
        position:"fixed",top:0,right:0,bottom:0,width:640,zIndex:201,
        background:"#fff",boxShadow:"-4px 0 24px rgba(0,0,0,0.10)",
        display:"flex",flexDirection:"column",
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ padding:"14px 20px 12px", borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            {/* AI icon */}
            <div style={{ width:32,height:32,borderRadius:8,background:`${T.purple}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
              <Bot size={16} color={T.purple}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14,fontWeight:700,color:T.t1,lineHeight:1.3 }}>AI 生成接口用例</div>
              {/* Interface context — lightweight, no giant card */}
              <div style={{ display:"flex",alignItems:"center",gap:5,marginTop:3,fontSize:11,color:T.t3 }}>
                <span style={{ fontWeight:700,fontSize:10,padding:"1px 5px",borderRadius:3,background:`${methodColor}12`,color:methodColor }}>{method}</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace",color:T.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:260 }}>{path}</span>
                <span style={{ color:T.t4,flexShrink:0 }}>·</span>
                <span style={{ flexShrink:0 }}>{endpointName}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",lineHeight:0,color:T.t3,padding:4,borderRadius:5 }}
              onMouseEnter={e=>(e.currentTarget.style.background=T.bg)} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div style={{ flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:18,minHeight:0 }}>

          {/* interface-not-saved warning banner */}
          {isNotSaved && (
            <div style={{ padding:"9px 12px",borderRadius:7,background:"#FFF7E6",border:`1px solid ${T.warning}30`,display:"flex",alignItems:"center",gap:8,fontSize:12,color:T.warning }}>
              <AlertTriangle size={14} style={{ flexShrink:0 }}/>
              <span>当前接口尚未保存，请先保存接口后再生成用例。</span>
            </div>
          )}

          {/* submit-fail banner */}
          {isSubmitFail && (
            <div style={{ padding:"9px 12px",borderRadius:7,background:"#FFF0F0",border:`1px solid ${T.danger}30`,display:"flex",alignItems:"center",gap:8,fontSize:12,color:T.danger }}>
              <AlertCircle size={14} style={{ flexShrink:0 }}/>
              <span>生成任务创建失败，请检查 AI 服务连接后重试。</span>
            </div>
          )}

          {/* ── Section: Type selection ─────────────────────────────────── */}
          <section>
            {/* Section header */}
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
              <span style={{ fontSize:12,fontWeight:600,color:T.t1 }}>选择生成的用例类型</span>
              {/* Overall select-all */}
              <div style={{ display:"flex",alignItems:"center",gap:5,marginLeft:0 }}>
                <Checkbox checked={overallAll} indeterminate={overallSome}
                  onChange={()=>{
                    if(overallAll) setSelected(new Set());
                    else           setSelected(new Set(ALL_ITEM_KEYS));
                  }}/>
                <span style={{ fontSize:11,color:T.t3 }}>全选</span>
              </div>
              {/* Selected count badge */}
              <div style={{ marginLeft:"auto",fontSize:11,color:T.t3,background:selected.size>0?`${T.primary}0D`:T.bg,borderRadius:4,padding:"1px 7px",color:selected.size>0?T.primary:T.t4,fontWeight:selected.size>0?600:400 }}>
                已选 {selected.size} / {ALL_ITEM_KEYS.length} 项
              </div>
            </div>

            {/* No-type warning */}
            {selected.size===0 && (
              <div style={{ marginBottom:10,padding:"7px 10px",borderRadius:6,background:"#FFF7E6",border:`1px solid ${T.warning}25`,fontSize:11,color:T.warning,display:"flex",alignItems:"center",gap:6 }}>
                <AlertTriangle size={11}/>请至少选择一个生成类型
              </div>
            )}

            {/* Group grid */}
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {CASE_GROUPS.map(group => {
                const gs = groupState(group.items);
                return (
                  <div key={group.key} style={{ border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden" }}>
                    {/* Group header */}
                    <div style={{ padding:"7px 12px",background:T.bg,display:"flex",alignItems:"center",gap:8,borderBottom:`1px solid ${T.border}` }}>
                      <Checkbox checked={gs.all} indeterminate={gs.some} onChange={()=>toggleGroup(group.items)}/>
                      <span style={{ fontSize:12,fontWeight:600,color:T.t1 }}>{group.label}</span>
                      <button onClick={()=>toggleGroup(group.items)}
                        style={{ marginLeft:"auto",fontSize:11,color:gs.all?T.t3:T.primary,background:"none",border:"none",cursor:"pointer",padding:0 }}>
                        {gs.all?"取消全选":"全选"}
                      </button>
                    </div>
                    {/* Items grid — 2 cols */}
                    <div style={{ padding:"8px 12px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"7px 16px",background:"#fff" }}>
                      {group.items.map(item => {
                        const checked = selected.has(item.key);
                        return (
                          <label key={item.key} style={{ display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:T.t2,userSelect:"none" }}
                            onMouseEnter={e=>(e.currentTarget.style.color=T.t1)}
                            onMouseLeave={e=>(e.currentTarget.style.color=T.t2)}>
                            <Checkbox checked={checked} onChange={()=>toggleItem(item.key)}/>
                            <span style={{ color:checked?T.t1:T.t2 }}>{item.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Section: Count ──────────────────────────────────────────── */}
          <section>
            <div style={{ fontSize:12,fontWeight:600,color:T.t1,marginBottom:8 }}>用例数</div>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {COUNT_OPTIONS.map(opt=>{
                const active = count===opt.value;
                return (
                  <button key={opt.value} onClick={()=>setCount(opt.value)}
                    style={{ padding:"5px 16px",borderRadius:6,fontSize:12,fontWeight:active?600:400,border:`1px solid ${active?T.primary+"50":T.border}`,background:active?`${T.primary}0D`:"#fff",color:active?T.primary:T.t2,cursor:"pointer" }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {/* Hint for large counts */}
            {(count==="40"||count==="80") && (
              <div style={{ marginTop:7,fontSize:11,color:T.t3,display:"flex",alignItems:"center",gap:4 }}>
                <Info size={10}/>数量较多时生成耗时可能增加；类型过多而数量较少时可能无法覆盖所有组合。
              </div>
            )}
          </section>

          {/* ── Section: AI Model ───────────────────────────────────────── */}
          <section>
            <div style={{ fontSize:12,fontWeight:600,color:T.t1,marginBottom:8 }}>AI 模型</div>

            {/* Loading state */}
            {isModelLoading && (
              <div style={{ padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:7,display:"flex",alignItems:"center",gap:8,color:T.t3,fontSize:12 }}>
                <Loader2 size={13} style={{ animation:"spin 1s linear infinite",color:T.primary }}/>
                正在加载可用模型…
              </div>
            )}

            {/* No model */}
            {isNoModel && (
              <div style={{ padding:"10px 12px",border:`1px solid ${T.danger}25`,borderRadius:7,background:"#FFF0F0" }}>
                <div style={{ fontSize:12,color:T.danger,display:"flex",alignItems:"center",gap:6,marginBottom:6 }}>
                  <AlertCircle size={13}/>暂无可用的 AI 模型
                </div>
                <div style={{ fontSize:11,color:T.t3,marginBottom:8 }}>请先在配置中心配置 AI 连接，或联系管理员授权。</div>
                <button style={{ display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:T.primary,background:`${T.primary}08`,border:`1px solid ${T.primary}30`,borderRadius:5,padding:"4px 10px",cursor:"pointer" }}>
                  <ExternalLink size={10}/>前往 AI 连接配置
                </button>
              </div>
            )}

            {/* Model select dropdown (custom) */}
            {hasModels && (
              <div style={{ position:"relative" }}>
                <div onClick={()=>setModelOpen(v=>!v)}
                  style={{ padding:"8px 12px",border:`1px solid ${modelOpen?T.primary:T.border}`,borderRadius:7,background:"#fff",display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:12,color:T.t1 }}>
                  <div style={{ width:20,height:20,borderRadius:4,background:`${T.purple}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <Bot size={11} color={T.purple}/>
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:11,color:T.t3,marginBottom:1 }}>{activeModel.connectionName}</div>
                    <div style={{ fontWeight:600,color:T.t1,fontSize:12 }}>{activeModel.modelLabel}</div>
                  </div>
                  <ChevronDown size={13} color={T.t4} style={{ transform:modelOpen?"rotate(180deg)":"none",transition:"transform .15s",flexShrink:0 }}/>
                </div>
                {modelOpen && (
                  <div style={{ position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#fff",border:`1px solid ${T.border}`,borderRadius:7,boxShadow:"0 4px 16px rgba(0,0,0,0.10)",zIndex:10,overflow:"hidden" }}>
                    {MOCK_MODELS.map(m=>{
                      const active = m.connectionId===activeModel.connectionId;
                      return (
                        <div key={m.connectionId} onClick={()=>{ setActiveModel(m); setModelOpen(false); }}
                          style={{ padding:"8px 12px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",background:active?`${T.primary}06`:"#fff" }}
                          onMouseEnter={e=>{if(!active)(e.currentTarget as HTMLElement).style.background=T.bg;}}
                          onMouseLeave={e=>{if(!active)(e.currentTarget as HTMLElement).style.background="#fff";}}>
                          <div style={{ width:20,height:20,borderRadius:4,background:`${T.purple}10`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                            <Bot size={11} color={T.purple}/>
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:11,color:T.t3 }}>{m.connectionName}</div>
                            <div style={{ fontSize:12,fontWeight:600,color:active?T.primary:T.t1 }}>{m.modelLabel}</div>
                          </div>
                          {active && <CheckCircle size={13} color={T.primary}/>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Section: Dedup toggle ───────────────────────────────────── */}
          <section>
            <div style={{ padding:"10px 12px",border:`1px solid ${T.border}`,borderRadius:7,background:"#fff",display:"flex",alignItems:"flex-start",gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12,fontWeight:600,color:T.t1,marginBottom:3 }}>不重复生成用例</div>
                <div style={{ fontSize:11,color:T.t3,lineHeight:1.55 }}>
                  {noRepeat
                    ? "不生成与当前接口已有用例类型重复的用例。"
                    : "AI 生成不受当前已有用例影响，可能产生同类型用例。"}
                </div>
              </div>
              <Toggle on={noRepeat} onChange={()=>setNoRepeat(v=>!v)}/>
            </div>
          </section>

          {/* ── Section: Extra requirements ─────────────────────────────── */}
          <section>
            <div style={{ fontSize:12,fontWeight:600,color:T.t1,marginBottom:8 }}>补充要求
              <span style={{ fontWeight:400,color:T.t3,marginLeft:6 }}>（可选）</span>
            </div>
            <textarea value={extraReqs} onChange={e=>setExtraReqs(e.target.value)} maxLength={1000}
              placeholder={"例如：\n• 重点覆盖鉴权失败场景\n• 金额字段最大值为 100000\n• 需要覆盖重复提交情况\n• 重点检查空字符串与 null 的区别"}
              style={{ width:"100%",boxSizing:"border-box",padding:"9px 12px",border:`1px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none",resize:"none",lineHeight:1.65,minHeight:90,fontFamily:"inherit" }}
              onFocus={e=>e.target.style.borderColor=T.primary}
              onBlur={e=>e.target.style.borderColor=T.border}/>
            <div style={{ textAlign:"right",fontSize:10,color:T.t4,marginTop:3 }}>{extraReqs.length}/1000</div>
          </section>

        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={{ padding:"12px 20px",borderTop:`1px solid ${T.border}`,flexShrink:0,background:"#fff" }}>

          {/* No-model footer guidance */}
          {isNoModel && (
            <div style={{ marginBottom:10,fontSize:11,color:T.t3,textAlign:"center" }}>
              需配置 AI 模型才能使用生成功能 ·{" "}
              <button style={{ color:T.primary,background:"none",border:"none",cursor:"pointer",padding:0,fontSize:11 }}>
                前往 AI 连接配置 <ExternalLink size={9} style={{ verticalAlign:"middle" }}/>
              </button>
            </div>
          )}

          <button onClick={handleGenerate} disabled={!canGenerate}
            style={{
              width:"100%",padding:"10px 0",border:"none",borderRadius:7,
              background: canGenerate ? T.primary : T.t4,
              color:"#fff",fontSize:13,fontWeight:600,cursor:canGenerate?"pointer":"not-allowed",
              display:"flex",alignItems:"center",justifyContent:"center",gap:7,
              transition:"background .15s",
            }}
            onMouseEnter={e=>{ if(canGenerate)(e.currentTarget as HTMLElement).style.background="#0E4ECC"; }}
            onMouseLeave={e=>{ if(canGenerate)(e.currentTarget as HTMLElement).style.background=T.primary; }}>
            {btnIcon}
            {btnLabel}
          </button>

          {/* Generate hint */}
          {canGenerate && !isSubmitting && (
            <div style={{ marginTop:7,fontSize:11,color:T.t3,textAlign:"center" }}>
              生成后将在接口编辑器中打开"AI 生成用例"工作标签，逐条展示候选用例
            </div>
          )}
        </div>

        {/* ── Dev: Demo state switcher ─────────────────────────────────── */}
        <div style={{ padding:"8px 20px",borderTop:`1px solid ${T.border}`,flexShrink:0,background:"#FAFAFA" }}>
          <div style={{ fontSize:10,color:T.t4,marginBottom:5 }}>演示状态</div>
          <div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>
            {(Object.keys(DEMO_LABELS) as DemoState[]).map(ds=>(
              <button key={ds} onClick={()=>switchDemo(ds)}
                style={{ fontSize:10,padding:"2px 7px",borderRadius:4,border:`1px solid ${demoState===ds?T.primary:T.border}`,background:demoState===ds?`${T.primary}0D`:"#fff",color:demoState===ds?T.primary:T.t3,cursor:"pointer" }}>
                {DEMO_LABELS[ds]}
              </button>
            ))}
          </div>
        </div>

      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
