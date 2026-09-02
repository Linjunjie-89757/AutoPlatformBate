/**
 * ApiWorkbenchExtras.tsx
 *
 * Supplementary modals, drawers, and panels for the 接口管理 workbench.
 * Each exported component is an overlay or inline panel; all include
 * an internal DemoBar for cycling through design states.
 *
 * Exports:
 *  - SaveApiDialog       — 保存接口弹窗
 *  - ImportApiDialog     — 导入接口弹窗
 *  - EnvDetailDrawer     — 运行环境详情抽屉
 *  - AuthConfigSection   — Auth 认证配置 (inline)
 *  - UnsavedConfirmDialog — 未保存修改确认弹窗
 */

import React, { useState, useRef } from "react";
import {
  X, ChevronDown, FolderOpen, Check, AlertTriangle, Lock, Loader2,
  Upload, Link2, Code2, FileText, Eye, EyeOff, RefreshCw, Globe,
  ExternalLink, Copy, Plus, Trash2, Save, ChevronRight,
  Info, Shield, Key, User, Zap, Settings, AlertCircle,
  CheckCircle, XCircle, Database, ArrowRight, Search, HelpCircle,
  Play, Sparkles, Bot,
} from "lucide-react";

// ─── Design tokens (same palette as App.tsx) ─────────────────────────────────

const T = {
  primary: "#165DFF", success: "#00B42A", warning: "#FF7D00",
  danger: "#F53F3F", purple: "#7816FF", cyan: "#0FC6C2",
  bg: "#F4F6FA", border: "#E5E6EB",
  t1: "#1D2129", t2: "#4E5969", t3: "#86909C", t4: "#C9CDD4",
};

type HttpMethod = "GET"|"POST"|"PUT"|"DELETE"|"PATCH";
const METHOD_COLOR: Record<HttpMethod,string> = {GET:"#00B42A",POST:"#FF7D00",PUT:"#165DFF",DELETE:"#F53F3F",PATCH:"#7816FF"};
const METHOD_BG:    Record<HttpMethod,string> = {GET:"#E8FFEA",POST:"#FFF3E8",PUT:"#E8F3FF",DELETE:"#FFE8E8",PATCH:"#F5E8FF"};

// ─── Shared primitives ────────────────────────────────────────────────────────

function SmToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width: 28, height: 16, borderRadius: 8, background: on ? T.primary : T.t4, position: "relative", cursor: "pointer", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 2, left: on ? 14 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left .15s" }}/>
    </div>
  );
}

function FInput({ label, value, onChange, placeholder, error, required, type, addon, helpText, disabled }:{
  label?: string; value?: string; onChange?: (v: string) => void; placeholder?: string;
  error?: string; required?: boolean; type?: string; addon?: React.ReactNode;
  helpText?: string; disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = disabled ? T.t4 : error ? T.danger : focused ? T.primary : T.border;
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, marginBottom: 6 }}>
          {required && <span style={{ color: T.danger, marginRight: 2 }}>*</span>}
          {label}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${borderColor}`, borderRadius: 7, background: disabled ? T.bg : "#fff", overflow: "hidden", transition: "border-color .15s" }}>
        {addon && <div style={{ padding: "0 10px", borderRight: `1px solid ${T.border}`, height: "100%", display: "flex", alignItems: "center" }}>{addon}</div>}
        <input
          type={type || "text"}
          value={value ?? ""}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ flex: 1, border: "none", outline: "none", padding: "8px 12px", fontSize: 13, color: disabled ? T.t3 : T.t1, background: "transparent" }}
        />
      </div>
      {error && <div style={{ fontSize: 11, color: T.danger, marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}><AlertCircle size={10}/>{error}</div>}
      {!error && helpText && <div style={{ fontSize: 11, color: T.t4, marginTop: 4 }}>{helpText}</div>}
    </div>
  );
}

function FLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, marginBottom: 6 }}>{required && <span style={{ color: T.danger, marginRight: 2 }}>*</span>}{children}</div>;
}

function Btn({ children, onClick, variant = "primary", disabled, icon: Icon, size: sz = "md" }: {
  children?: React.ReactNode; onClick?: () => void; variant?: "primary"|"ghost"|"danger"|"success";
  disabled?: boolean; icon?: React.ElementType; size?: "sm"|"md";
}) {
  const bgMap = { primary: T.primary, ghost: "#fff", danger: T.danger, success: T.success };
  const colorMap = { primary: "#fff", ghost: T.t2, danger: "#fff", success: "#fff" };
  const borderMap = { primary: T.primary, ghost: T.border, danger: T.danger, success: T.success };
  const padding = sz === "sm" ? "5px 12px" : "7px 18px";
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: "flex", alignItems: "center", gap: 5, padding, border: `1px solid ${borderMap[variant]}`, borderRadius: 7, background: disabled ? T.t4 : bgMap[variant], color: disabled ? "#fff" : colorMap[variant], fontSize: 13, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0 }}>
      {Icon && <Icon size={13}/>}
      {children}
    </button>
  );
}

function AlertBanner({ type, children }: { type: "info"|"warn"|"error"|"success"; children: React.ReactNode }) {
  const map = {
    info:    { bg: "#E8F3FF", border: `${T.primary}30`, color: T.primary, icon: Info },
    warn:    { bg: "#FFF3E8", border: `${T.warning}30`, color: T.warning, icon: AlertTriangle },
    error:   { bg: "#FFF2F2", border: `${T.danger}30`,  color: T.danger,  icon: XCircle },
    success: { bg: "#E8FFEA", border: `${T.success}30`, color: T.success, icon: CheckCircle },
  };
  const c = map[type];
  return (
    <div style={{ display: "flex", gap: 8, padding: "9px 12px", borderRadius: 7, border: `1px solid ${c.border}`, background: c.bg, marginBottom: 16, fontSize: 12, color: c.color, lineHeight: 1.6 }}>
      <c.icon size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
      <div>{children}</div>
    </div>
  );
}

// ─── DemoBar ──────────────────────────────────────────────────────────────────

function DemoBar<S extends string>({ states, current, onChange }: {
  states: { value: S; label: string }[];
  current: S;
  onChange: (v: S) => void;
}) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, padding: "6px 16px 6px", background: "#fff", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, color: T.t4, fontWeight: 600, marginRight: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Design Preview</span>
      {states.map(s => (
        <button key={s.value} onClick={() => onChange(s.value)}
          style={{ fontSize: 11, padding: "2px 9px", borderRadius: 5, border: `1px solid ${current === s.value ? T.primary : T.border}`, background: current === s.value ? `${T.primary}0D` : "transparent", color: current === s.value ? T.primary : T.t3, cursor: "pointer", fontWeight: current === s.value ? 600 : 400 }}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SaveApiDialog — 保存接口弹窗
// ─────────────────────────────────────────────────────────────────────────────

type SaveApiState = "default"|"validation"|"duplicate"|"saving"|"success"|"no-permission";

const SAVE_DEMO: { value: SaveApiState; label: string }[] = [
  { value: "default",       label: "默认状态" },
  { value: "validation",    label: "校验错误" },
  { value: "duplicate",     label: "路径重复" },
  { value: "saving",        label: "保存中" },
  { value: "success",       label: "保存成功" },
  { value: "no-permission", label: "无权限" },
];

const FOLDER_TREE = ["X-MAN", "X-MAN / 订单中心管理端", "X-MAN / 用户中心", "X-MAN / 获客中心", "X-MAN / 风控中心"];

export function SaveApiDialog({ onClose }: { onClose: () => void }) {
  const [demoState, setDemoState] = useState<SaveApiState>("default");
  const [name, setName]  = useState("获取订单列表");
  const [path, setPath]  = useState("/api/v1/orders");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [folder, setFolder] = useState("X-MAN / 订单中心管理端");
  const [desc, setDesc]  = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [showFolderDrop, setShowFolderDrop] = useState(false);

  const noPermission  = demoState === "no-permission";
  const isSaving      = demoState === "saving";
  const isSuccess     = demoState === "success";
  const isValidation  = demoState === "validation";
  const isDuplicate   = demoState === "duplicate";

  const nameErr  = isValidation && !name ? "接口名称不能为空" : "";
  const pathErr  = isValidation && !path ? "请求路径不能为空" : "";

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 400 }}/>
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 401, background: "#fff", borderRadius: 10, width: 560, boxShadow: "0 8px 40px rgba(0,0,0,0.14)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <Save size={16} style={{ color: T.primary, marginRight: 8 }}/>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.t1, flex: 1 }}>保存接口</span>
          {!isSuccess && <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, padding: 4, borderRadius: 5, lineHeight: 0 }}><X size={16}/></button>}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>

          {/* Banners */}
          {isSuccess && (
            <AlertBanner type="success">
              接口已成功保存至 <strong>{folder}</strong>，可在左侧目录树中找到。
            </AlertBanner>
          )}
          {noPermission && (
            <AlertBanner type="error">
              <strong>无保存权限</strong> — 您没有在当前目录新增或覆盖接口的权限，请联系项目管理员。
            </AlertBanner>
          )}
          {isDuplicate && (
            <AlertBanner type="warn">
              <strong>路径已存在</strong> — <code style={{ fontFamily: "monospace", fontSize: 11 }}>POST {path}</code> 与 <strong>创建订单</strong> 路径重复。如继续保存，建议勾选"覆盖已有接口"或修改路径。
            </AlertBanner>
          )}

          {/* Method + Path */}
          <FLabel required>HTTP Method &amp; 请求路径</FLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: pathErr ? 4 : 16 }}>
            <select value={method} onChange={e => setMethod(e.target.value as HttpMethod)} disabled={noPermission}
              style={{ height: 36, padding: "0 10px", border: `1.5px solid ${METHOD_BG[method]}`, borderRadius: 7, background: METHOD_BG[method], color: METHOD_COLOR[method], fontSize: 12, fontWeight: 700, outline: "none", width: 100, cursor: noPermission ? "not-allowed" : "pointer" }}>
              {(["GET","POST","PUT","DELETE","PATCH"] as HttpMethod[]).map(m => <option key={m}>{m}</option>)}
            </select>
            <input value={path} onChange={e => setPath(e.target.value)} placeholder="/api/v1/..." disabled={noPermission}
              style={{ flex: 1, height: 36, padding: "0 12px", border: `1.5px solid ${pathErr ? T.danger : T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none", fontFamily: "'JetBrains Mono',monospace", background: noPermission ? T.bg : "#fff" }}/>
          </div>
          {pathErr && <div style={{ fontSize: 11, color: T.danger, marginBottom: 12, display: "flex", alignItems: "center", gap: 3 }}><AlertCircle size={10}/>{pathErr}</div>}

          {/* Name */}
          <div style={{ marginBottom: nameErr ? 4 : 16 }}>
            <FLabel required>接口名称</FLabel>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="请输入接口名称" disabled={noPermission}
              style={{ width: "100%", boxSizing: "border-box", height: 36, padding: "0 12px", border: `1.5px solid ${nameErr ? T.danger : T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none", background: noPermission ? T.bg : "#fff" }}/>
          </div>
          {nameErr && <div style={{ fontSize: 11, color: T.danger, marginBottom: 12, display: "flex", alignItems: "center", gap: 3 }}><AlertCircle size={10}/>{nameErr}</div>}

          {/* Directory */}
          <FLabel required>保存目录</FLabel>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <div onClick={() => !noPermission && setShowFolderDrop(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, cursor: noPermission ? "not-allowed" : "pointer", background: noPermission ? T.bg : "#fff" }}>
              <FolderOpen size={13} style={{ color: T.warning }}/>
              <span style={{ flex: 1, fontSize: 13, color: T.t1 }}>{folder}</span>
              <ChevronDown size={13} style={{ color: T.t3 }}/>
            </div>
            {showFolderDrop && (
              <div style={{ position: "absolute", top: 40, left: 0, right: 0, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 10 }}>
                {FOLDER_TREE.map(f => (
                  <div key={f} onClick={() => { setFolder(f); setShowFolderDrop(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 13, color: folder === f ? T.primary : T.t1, background: folder === f ? `${T.primary}08` : "transparent", cursor: "pointer" }}>
                    <FolderOpen size={12} style={{ color: T.warning }}/>{f}
                    {folder === f && <Check size={11} style={{ marginLeft: "auto", color: T.primary }}/>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <FLabel>接口描述</FLabel>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="（选填）描述该接口的功能与用途" disabled={noPermission}
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none", resize: "vertical", fontFamily: "inherit", background: noPermission ? T.bg : "#fff", marginBottom: 16 }}/>

          {/* Overwrite toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: 8, background: isDuplicate ? `${T.warning}06` : "transparent" }}>
            <SmToggle on={overwrite} onChange={v => !noPermission && setOverwrite(v)}/>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>覆盖已有接口</div>
              <div style={{ fontSize: 11, color: T.t4, marginTop: 1 }}>相同 Method + Path 的已有接口将被本次内容覆盖，历史版本不可恢复</div>
            </div>
          </div>

        </div>

        {/* Footer */}
        {!isSuccess && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
            <button onClick={onClose} style={{ padding: "7px 16px", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", fontSize: 13, color: T.t2, cursor: "pointer" }}>取消</button>
            <div style={{ flex: 1 }}/>
            {!noPermission && (
              <button disabled={isSaving}
                style={{ padding: "7px 16px", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", fontSize: 13, color: T.t2, cursor: isSaving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                {isSaving && <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }}/>}
                保存并继续编辑
              </button>
            )}
            <Btn icon={noPermission ? Lock : isSaving ? Loader2 : Save} disabled={noPermission || isSaving} variant="primary">
              {noPermission ? "无权限" : isSaving ? "保存中…" : "保存"}
            </Btn>
          </div>
        )}
        {isSuccess && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
            <Btn onClick={onClose} icon={Check} variant="success">完成</Btn>
          </div>
        )}

        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>

      <DemoBar states={SAVE_DEMO} current={demoState} onChange={setDemoState}/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ImportApiDialog — 导入接口弹窗
// ─────────────────────────────────────────────────────────────────────────────

type ImportTab   = "curl"|"openapi-file"|"openapi-url"|"raw-http";
type ImportState = "idle"|"parsing"|"parse-success"|"parse-error"|"format-error"|"size-error"|"duplicate-prompt";

const IMPORT_DEMO: { value: ImportState; label: string }[] = [
  { value: "idle",             label: "等待上传" },
  { value: "parsing",          label: "解析中" },
  { value: "parse-success",    label: "解析成功" },
  { value: "parse-error",      label: "解析失败" },
  { value: "format-error",     label: "格式不支持" },
  { value: "size-error",       label: "文件过大" },
  { value: "duplicate-prompt", label: "重复接口提示" },
];

const IMPORT_TABS: { key: ImportTab; label: string; icon: React.ElementType }[] = [
  { key: "curl",         label: "cURL",           icon: Code2 },
  { key: "openapi-file", label: "OpenAPI 文件",   icon: Upload },
  { key: "openapi-url",  label: "OpenAPI URL",    icon: Link2 },
  { key: "raw-http",     label: "原始 HTTP",      icon: FileText },
];

const IMPORT_PREVIEW = [
  { method: "GET",    path: "/api/v1/orders",         name: "获取订单列表",    tag: "订单中心", dup: false },
  { method: "POST",   path: "/api/v1/orders",         name: "创建订单",        tag: "订单中心", dup: true  },
  { method: "PUT",    path: "/api/v1/orders/{id}",    name: "更新订单状态",    tag: "订单中心", dup: false },
  { method: "DELETE", path: "/api/v1/orders/{id}",    name: "删除订单",        tag: "订单中心", dup: false },
  { method: "GET",    path: "/api/v1/users",          name: "获取用户列表",    tag: "用户中心", dup: false },
  { method: "POST",   path: "/api/v1/users/register", name: "用户注册",        tag: "用户中心", dup: true  },
];

const DEDUP_OPTIONS = ["跳过已有接口","覆盖已有接口","仅更新参数，保留断言和脚本"];

export function ImportApiDialog({ onClose }: { onClose: () => void }) {
  const [demoState, setDemoState]  = useState<ImportState>("idle");
  const [tab, setTab]              = useState<ImportTab>("openapi-file");
  const [curlText, setCurlText]    = useState("");
  const [openapiUrl, setOpenapiUrl] = useState("https://api.company.com/v3/openapi.json");
  const [rawText, setRawText]      = useState("");
  const [targetDir, setTargetDir]  = useState("X-MAN / 订单中心管理端");
  const [dedupStrategy, setDedupStrategy] = useState(DEDUP_OPTIONS[0]);
  const [selectedRows, setSelectedRows]   = useState<Set<number>>(new Set(IMPORT_PREVIEW.map((_,i) => i)));

  const isIdle      = demoState === "idle";
  const isParsing   = demoState === "parsing";
  const isSuccess   = demoState === "parse-success";
  const isError     = demoState === "parse-error";
  const isFormat    = demoState === "format-error";
  const isSize      = demoState === "size-error";
  const isDuplicate = demoState === "duplicate-prompt";
  const showPreview = isSuccess || isDuplicate;

  const toggleRow = (i: number) => {
    const s = new Set(selectedRows);
    s.has(i) ? s.delete(i) : s.add(i);
    setSelectedRows(s);
  };
  const allChecked = selectedRows.size === IMPORT_PREVIEW.length;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 400 }}/>
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 401, background: "#fff", borderRadius: 10, width: 700, boxShadow: "0 8px 40px rgba(0,0,0,0.14)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <Upload size={15} style={{ color: T.primary, marginRight: 8 }}/>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.t1, flex: 1 }}>导入接口</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, padding: 4, borderRadius: 5, lineHeight: 0 }}><X size={16}/></button>
        </div>

        {/* Import type tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, flexShrink: 0, paddingLeft: 4 }}>
          {IMPORT_TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setDemoState("idle"); }}
              style={{ display: "flex", alignItems: "center", gap: 5, height: 40, padding: "0 16px", border: "none", borderBottom: `2px solid ${tab === t.key ? T.primary : "transparent"}`, background: "transparent", fontSize: 13, fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? T.primary : T.t3, cursor: "pointer" }}>
              <t.icon size={13}/>{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>

          {/* Status banners */}
          {isError   && <AlertBanner type="error"><strong>解析失败</strong> — 无法识别文件内容，请确认文件格式为有效的 OpenAPI 2.0 / 3.0 JSON 或 YAML 格式。<br/><code style={{ fontSize: 11, fontFamily: "monospace" }}>SyntaxError: Unexpected token 'f', "format: ..." is not valid JSON</code></AlertBanner>}
          {isFormat  && <AlertBanner type="error"><strong>格式不支持</strong> — 仅支持 OpenAPI / Swagger 的 .json 和 .yaml 文件，不支持 Postman Collection、HAR 或其他格式。</AlertBanner>}
          {isSize    && <AlertBanner type="error"><strong>文件过大</strong> — 当前文件大小 18.6 MB，超出单次上传限制 10 MB。请拆分文件后分批导入。</AlertBanner>}
          {isDuplicate && <AlertBanner type="warn">检测到 <strong>2 个接口路径</strong>与已有接口重复（下方已标红），请选择处理策略后继续导入。</AlertBanner>}

          {/* Input area per tab */}
          {tab === "curl" && !showPreview && !isParsing && (
            <div style={{ marginBottom: 16 }}>
              <FLabel>粘贴 cURL 命令</FLabel>
              <textarea value={curlText} onChange={e => setCurlText(e.target.value)} rows={7}
                placeholder={`curl -X POST 'https://api.company.com/v1/orders' \\\n  -H 'Authorization: Bearer {{token}}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"page":1,"pageSize":20}'`}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: T.t1, outline: "none", resize: "vertical" }}/>
            </div>
          )}

          {tab === "openapi-file" && !showPreview && !isParsing && !isError && !isFormat && !isSize && (
            <div style={{ border: `2px dashed ${T.border}`, borderRadius: 10, padding: "40px 24px", textAlign: "center", marginBottom: 16, background: T.bg }}>
              <Upload size={28} style={{ color: T.t4, marginBottom: 12 }}/>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.t1, marginBottom: 6 }}>拖拽文件到此处，或点击上传</div>
              <div style={{ fontSize: 12, color: T.t3, marginBottom: 16 }}>支持 OpenAPI 2.0 / 3.0 的 .json 和 .yaml 格式，最大 10 MB</div>
              <button style={{ padding: "7px 20px", border: `1px solid ${T.primary}`, borderRadius: 7, background: `${T.primary}0D`, color: T.primary, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>选择文件</button>
            </div>
          )}

          {tab === "openapi-url" && !showPreview && !isParsing && (
            <div style={{ marginBottom: 16 }}>
              <FLabel>OpenAPI 文档 URL</FLabel>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={openapiUrl} onChange={e => setOpenapiUrl(e.target.value)} placeholder="https://api.example.com/v3/openapi.json"
                  style={{ flex: 1, height: 36, padding: "0 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none", fontFamily: "'JetBrains Mono',monospace" }}/>
                <button onClick={() => setDemoState("parsing")} style={{ padding: "0 14px", border: `1px solid ${T.primary}`, borderRadius: 7, background: `${T.primary}0D`, color: T.primary, fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <Globe size={13}/>获取
                </button>
              </div>
              <div style={{ fontSize: 11, color: T.t4, marginTop: 5 }}>服务端需支持跨域访问，或已配置 CORS 允许当前来源</div>
            </div>
          )}

          {tab === "raw-http" && !showPreview && !isParsing && (
            <div style={{ marginBottom: 16 }}>
              <FLabel>原始 HTTP 请求</FLabel>
              <textarea value={rawText} onChange={e => setRawText(e.target.value)} rows={8}
                placeholder={`POST /api/v1/orders HTTP/1.1\nHost: api.company.com\nContent-Type: application/json\nAuthorization: Bearer {{token}}\n\n{"page":1,"pageSize":20}`}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: T.t1, outline: "none", resize: "vertical" }}/>
            </div>
          )}

          {/* Parsing state */}
          {isParsing && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 14 }}>
              <Loader2 size={32} style={{ color: T.primary, animation: "spin 1s linear infinite" }}/>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.t1 }}>正在解析文件…</div>
              <div style={{ fontSize: 12, color: T.t3 }}>识别接口定义、提取参数和 Schema</div>
            </div>
          )}

          {/* Preview table */}
          {showPreview && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <CheckCircle size={14} style={{ color: T.success }}/>
                <span style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>识别到 {IMPORT_PREVIEW.length} 个接口</span>
                <span style={{ fontSize: 12, color: T.t3 }}>请确认要导入的接口</span>
              </div>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                      <th style={{ width: 32, padding: "8px 12px", textAlign: "left" }}>
                        <input type="checkbox" checked={allChecked} onChange={() => setSelectedRows(allChecked ? new Set() : new Set(IMPORT_PREVIEW.map((_,i)=>i)))} style={{ accentColor: T.primary }}/>
                      </th>
                      {["Method","路径","接口名称","分组","状态"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 600, color: T.t3 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {IMPORT_PREVIEW.map((row, i) => (
                      <tr key={i} style={{ borderBottom: i < IMPORT_PREVIEW.length-1 ? `1px solid ${T.border}` : "none", background: row.dup && isDuplicate ? "#FFF8F0" : selectedRows.has(i) ? "transparent" : "#FAFAFA" }}>
                        <td style={{ padding: "7px 12px" }}>
                          <input type="checkbox" checked={selectedRows.has(i)} onChange={() => toggleRow(i)} style={{ accentColor: T.primary }}/>
                        </td>
                        <td style={{ padding: "7px 10px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: METHOD_BG[row.method as HttpMethod], color: METHOD_COLOR[row.method as HttpMethod] }}>{row.method}</span>
                        </td>
                        <td style={{ padding: "7px 10px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: T.t2 }}>{row.path}</td>
                        <td style={{ padding: "7px 10px", color: T.t1 }}>{row.name}</td>
                        <td style={{ padding: "7px 10px", color: T.t3 }}>{row.tag}</td>
                        <td style={{ padding: "7px 10px" }}>
                          {row.dup && isDuplicate
                            ? <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "#FFF3E8", color: T.warning, fontWeight: 600 }}>路径重复</span>
                            : <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "#E8FFEA", color: T.success, fontWeight: 600 }}>待导入</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Target dir + dedup strategy */}
          {(showPreview || (!isParsing && !isError && !isFormat && !isSize)) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <FLabel required>导入到目录</FLabel>
                <select value={targetDir} onChange={e => setTargetDir(e.target.value)}
                  style={{ width: "100%", height: 36, padding: "0 10px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none", background: "#fff" }}>
                  {FOLDER_TREE.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <FLabel>重复接口处理策略</FLabel>
                <select value={dedupStrategy} onChange={e => setDedupStrategy(e.target.value)}
                  style={{ width: "100%", height: 36, padding: "0 10px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none", background: "#fff" }}>
                  {DEDUP_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          {showPreview && <span style={{ fontSize: 12, color: T.t3 }}>已选 {selectedRows.size} / {IMPORT_PREVIEW.length} 个接口</span>}
          <div style={{ flex: 1 }}/>
          <button onClick={onClose} style={{ padding: "7px 16px", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", fontSize: 13, color: T.t2, cursor: "pointer" }}>取消</button>
          {isIdle && (
            <Btn icon={isParsing ? Loader2 : Upload} onClick={() => setDemoState("parsing")} variant="primary">
              {tab === "openapi-file" ? "上传并解析" : tab === "openapi-url" ? "获取并解析" : "解析"}
            </Btn>
          )}
          {showPreview && (
            <Btn icon={Check} disabled={selectedRows.size === 0} variant="primary">
              导入 {selectedRows.size} 个接口
            </Btn>
          )}
        </div>

        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>

      <DemoBar states={IMPORT_DEMO} current={demoState} onChange={setDemoState}/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. EnvDetailDrawer — 运行环境详情抽屉
// ─────────────────────────────────────────────────────────────────────────────

type EnvDrawerState = "no-env"|"loaded"|"env-error"|"sensitive"|"no-permission"|"unresolved";

const ENV_DEMO: { value: EnvDrawerState; label: string }[] = [
  { value: "no-env",       label: "未选择环境" },
  { value: "loaded",       label: "已加载" },
  { value: "env-error",    label: "连接失败" },
  { value: "sensitive",    label: "含敏感变量" },
  { value: "no-permission",label: "无权限" },
  { value: "unresolved",   label: "变量解析失败" },
];

type VarScope = "env"|"workspace"|"global"|"builtin";
interface EnvVar { name: string; value: string; scope: VarScope; sensitive?: boolean; source?: string; resolved?: boolean; }

const ENV_VARS: EnvVar[] = [
  { name: "BASE_URL",       value: "https://test-api.company.com",  scope: "env",       sensitive: false, resolved: true },
  { name: "access_token",   value: "eyJhbGciOiJSUzI1...",           scope: "env",       sensitive: true,  resolved: true },
  { name: "API_SECRET_KEY", value: "sk-••••••••••••••••",            scope: "workspace", sensitive: true,  resolved: false },
  { name: "userId",         value: "10086",                          scope: "workspace", sensitive: false, resolved: true },
  { name: "timestamp",      value: "1748419200000",                  scope: "global",    sensitive: false, resolved: true },
  { name: "RETRY_COUNT",    value: "3",                              scope: "global",    sensitive: false, resolved: true },
  { name: "__ENV_ID__",     value: "2",                              scope: "builtin",   sensitive: false, resolved: true },
  { name: "__ENV_NAME__",   value: "测试环境",                       scope: "builtin",   sensitive: false, resolved: true },
];

const SCOPE_CFG: Record<VarScope,{ label:string; color:string; bg:string }> = {
  env:       { label: "环境变量",   color: "#0E42D2", bg: "#E8F3FF" },
  workspace: { label: "工作区变量", color: "#876800", bg: "#FFFBE8" },
  global:    { label: "全局变量",   color: "#4E5AC8", bg: "#EEF0FA" },
  builtin:   { label: "内置变量",   color: T.t3,      bg: T.bg },
};

export function EnvDetailDrawer({ onClose }: { onClose: () => void }) {
  const [demoState, setDemoState] = useState<EnvDrawerState>("no-env");
  const [showSecret, setShowSecret] = useState<Set<string>>(new Set());
  const [activeEnv, setActiveEnv] = useState("测试环境");
  const [search, setSearch] = useState("");

  const toggleSecret = (name: string) => {
    const s = new Set(showSecret);
    s.has(name) ? s.delete(name) : s.add(name);
    setShowSecret(s);
  };

  const noEnv      = demoState === "no-env";
  const envError   = demoState === "env-error";
  const noPermission = demoState === "no-permission";
  const hasSensitive = demoState === "sensitive";
  const hasUnresolved = demoState === "unresolved";
  const showVars   = demoState === "loaded" || hasSensitive || hasUnresolved;

  const filtered = ENV_VARS.filter(v => !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.value.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.12)", zIndex: 400 }}/>
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, zIndex: 401, background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.11)", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <Globe size={15} style={{ color: T.primary }}/>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.t1, flex: 1 }}>运行环境详情</span>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, padding: 4, borderRadius: 5, lineHeight: 0 }}><X size={16}/></button>
          </div>
          <div style={{ fontSize: 12, color: T.t3 }}>当前接口发送时使用的变量上下文</div>
        </div>

        {/* Env selector */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <FolderOpen size={13} style={{ color: T.warning }}/>
          <select value={activeEnv} onChange={e => setActiveEnv(e.target.value)} style={{ flex: 1, height: 34, padding: "0 10px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none", background: "#fff" }}>
            <option>— 不使用环境 —</option>
            <option>测试环境</option>
            <option>预发布环境</option>
            <option>生产环境</option>
          </select>
          <button style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", cursor: "pointer", color: T.t2 }}><RefreshCw size={13}/></button>
          <button style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", cursor: "pointer", color: T.t2 }}><ExternalLink size={13}/></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {noEnv && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12, color: T.t4 }}>
              <Globe size={40} style={{ opacity: 0.3 }}/>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.t2 }}>未选择运行环境</div>
              <div style={{ fontSize: 12, color: T.t4, textAlign: "center", lineHeight: 1.8 }}>
                未选择环境时，接口将不注入任何环境变量。<br/>可在上方下拉框切换运行环境。
              </div>
              <button style={{ marginTop: 8, padding: "7px 16px", border: `1px solid ${T.primary}`, borderRadius: 7, background: `${T.primary}0D`, color: T.primary, fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}><ExternalLink size={13}/>前往环境管理</button>
            </div>
          )}

          {envError && (
            <>
              <AlertBanner type="error">
                <strong>环境加载失败</strong> — 无法获取"测试环境"的变量配置，请检查网络连接或联系管理员。<br/>
                <span style={{ fontSize: 11, color: T.danger }}>Error: Request timeout after 10000ms</span>
              </AlertBanner>
              <div style={{ textAlign: "center", paddingTop: 24 }}>
                <button style={{ padding: "7px 18px", border: `1px solid ${T.primary}`, borderRadius: 7, background: `${T.primary}0D`, color: T.primary, fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, margin: "0 auto" }}><RefreshCw size={13}/>重新加载</button>
              </div>
            </>
          )}

          {noPermission && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 }}>
              <Lock size={36} style={{ color: T.t4 }}/>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.t2 }}>无变量查看权限</div>
              <div style={{ fontSize: 12, color: T.t4, textAlign: "center", lineHeight: 1.8 }}>您没有查看"生产环境"变量的权限，<br/>请联系项目管理员获取访问授权。</div>
            </div>
          )}

          {showVars && (
            <>
              {/* Env info */}
              <div style={{ padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 14, background: T.bg }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                  {[
                    { label: "环境名称", value: "测试环境" },
                    { label: "Base URL", value: "https://test-api.company.com" },
                    { label: "标识符",   value: "test" },
                    { label: "更新时间", value: "2026-05-18 17:32" },
                  ].map(row => (
                    <div key={row.label}>
                      <span style={{ color: T.t4, marginRight: 5 }}>{row.label}:</span>
                      <span style={{ color: T.t1, fontFamily: row.label === "Base URL" ? "'JetBrains Mono',monospace" : "inherit", fontSize: row.label === "Base URL" ? 11 : 12 }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sensitive warning */}
              {hasSensitive && <AlertBanner type="warn">当前环境包含 <strong>2 个敏感变量</strong>，值已默认脱敏。点击眼睛图标可临时查看明文（仅对您可见）。</AlertBanner>}

              {/* Unresolved warning */}
              {hasUnresolved && (
                <AlertBanner type="error">
                  <strong>1 个变量无法解析</strong> — 请求中引用的 <code style={{ fontFamily: "monospace", fontSize: 11 }}>{"{{API_SECRET_KEY}}"}</code> 在当前环境中未找到定义，发送时将保留原始占位符。
                  <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                    <button style={{ fontSize: 11, padding: "3px 10px", border: `1px solid ${T.danger}`, borderRadius: 5, background: "#fff", color: T.danger, cursor: "pointer" }}>查看引用位置</button>
                    <button style={{ fontSize: 11, padding: "3px 10px", border: `1px solid ${T.border}`, borderRadius: 5, background: "#fff", color: T.t2, cursor: "pointer" }}>前往环境管理添加变量</button>
                  </div>
                </AlertBanner>
              )}

              {/* Search */}
              <div style={{ position: "relative", marginBottom: 12 }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.t4 }}/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索变量名或变量值" style={{ width: "100%", boxSizing: "border-box", height: 34, paddingLeft: 30, paddingRight: 12, border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none" }}/>
              </div>

              {/* Variable table */}
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                      {["变量名","当前值","来源",""].map((h, i) => (
                        <th key={i} style={{ padding: "7px 10px", textAlign: "left", fontSize: 11, fontWeight: 600, color: T.t3 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((v, i) => {
                      const cfg = SCOPE_CFG[v.scope];
                      const masked = v.sensitive && !showSecret.has(v.name);
                      const displayVal = masked ? "•".repeat(16) : v.value;
                      return (
                        <tr key={v.name} style={{ borderBottom: i < filtered.length-1 ? `1px solid ${T.border}` : "none", background: !v.resolved ? "#FFF5F5" : "transparent" }}>
                          <td style={{ padding: "8px 10px", fontFamily: "'JetBrains Mono',monospace", color: T.t1, fontWeight: 500 }}>
                            {v.name}
                            {!v.resolved && (
                              <span style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", gap: 2, fontSize: 10, color: T.danger, background: "#FFE8E8", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>
                                <AlertCircle size={9}/>无法解析
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "8px 10px", color: masked ? T.t4 : T.t2, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace" }}>
                            {displayVal}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: cfg.bg, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                          </td>
                          <td style={{ padding: "8px 10px", width: 28 }}>
                            {v.sensitive && (
                              <button onClick={() => toggleSecret(v.name)} style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, lineHeight: 0, padding: 2 }}>
                                {masked ? <Eye size={13}/> : <EyeOff size={13}/>}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: T.t4, fontSize: 12 }}>没有匹配的变量</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ fontSize: 11, color: T.t4, marginTop: 10, lineHeight: 1.8 }}>
                变量优先级（由高到低）：<strong>环境变量</strong> &gt; <strong>工作区变量</strong> &gt; <strong>全局变量</strong> &gt; <strong>内置变量</strong>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", fontSize: 12, color: T.t2, cursor: "pointer" }}><ExternalLink size={12}/>前往环境管理</button>
          <button onClick={onClose} style={{ padding: "6px 18px", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", fontSize: 13, color: T.t2, cursor: "pointer" }}>关闭</button>
        </div>

      </div>

      <DemoBar states={ENV_DEMO} current={demoState} onChange={setDemoState}/>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AuthConfigSection — Auth 认证配置 (inline panel)
// ─────────────────────────────────────────────────────────────────────────────

type AuthType = "no-auth"|"bearer"|"basic"|"api-key"|"oauth2"|"custom";

const AUTH_DEMO: { value: AuthType|"oauth2-fail"; label: string }[] = [
  { value: "no-auth",    label: "No Auth" },
  { value: "bearer",     label: "Bearer Token" },
  { value: "basic",      label: "Basic Auth" },
  { value: "api-key",    label: "API Key" },
  { value: "oauth2",     label: "OAuth 2.0" },
  { value: "oauth2-fail",label: "OAuth 失败" },
  { value: "custom",     label: "自定义认证" },
];

const AUTH_TYPES: { key: AuthType; label: string }[] = [
  { key: "no-auth", label: "No Auth" },
  { key: "bearer",  label: "Bearer Token" },
  { key: "basic",   label: "Basic Auth" },
  { key: "api-key", label: "API Key" },
  { key: "oauth2",  label: "OAuth 2.0" },
  { key: "custom",  label: "自定义认证" },
];

export function AuthConfigSection() {
  const [authType, setAuthType] = useState<AuthType>("bearer");
  const [bearerToken, setBearerToken]         = useState("{{access_token}}");
  const [showBearer, setShowBearer]           = useState(false);
  const [basicUser, setBasicUser]             = useState("admin@company.com");
  const [basicPass, setBasicPass]             = useState("Str0ng!Pass#2026");
  const [showPass, setShowPass]               = useState(false);
  const [apiKeyName, setApiKeyName]           = useState("X-API-Key");
  const [apiKeyValue, setApiKeyValue]         = useState("{{API_SECRET_KEY}}");
  const [apiKeyLocation, setApiKeyLocation]   = useState<"header"|"query">("header");
  const [showApiKey, setShowApiKey]           = useState(false);
  const [oauthGrantType, setOauthGrantType]   = useState("client_credentials");
  const [tokenUrl, setTokenUrl]               = useState("https://auth.company.com/oauth/token");
  const [clientId, setClientId]               = useState("client_id_here");
  const [clientSecret, setClientSecret]       = useState("{{OAUTH_CLIENT_SECRET}}");
  const [oauthScope, setOauthScope]           = useState("read:orders write:orders");
  const [showSecret, setShowSecret]           = useState(false);
  const [oauthToken, setOauthToken]           = useState("");
  const [customHeaders, setCustomHeaders]     = useState([{ key: "X-Signature", value: "{{generated_signature}}" }]);

  // Switch demo state
  const [demoAuth, setDemoAuth] = useState<AuthType|"oauth2-fail">("bearer");
  const oauthFailed = demoAuth === "oauth2-fail";
  const effectiveType: AuthType = oauthFailed ? "oauth2" : (demoAuth as AuthType);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
      {/* Type selector */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, background: T.bg, borderRadius: 8, padding: 3, width: "fit-content" }}>
        {AUTH_TYPES.map(t => (
          <button key={t.key} onClick={() => setDemoAuth(t.key)}
            style={{ padding: "4px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: effectiveType === t.key ? "#fff" : "transparent", color: effectiveType === t.key ? T.primary : T.t3, boxShadow: effectiveType === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* No Auth */}
      {effectiveType === "no-auth" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 40, gap: 10, color: T.t4 }}>
          <Shield size={36} style={{ opacity: 0.3 }}/>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.t2 }}>不使用认证</div>
          <div style={{ fontSize: 12, color: T.t4, textAlign: "center", lineHeight: 1.8 }}>当前接口请求不携带任何认证信息。<br/>如需认证，请在上方切换认证方式。</div>
        </div>
      )}

      {/* Bearer Token */}
      {effectiveType === "bearer" && (
        <div style={{ maxWidth: 520 }}>
          <AlertBanner type="info">Bearer Token 将作为 <code style={{ fontFamily: "monospace", fontSize: 11 }}>Authorization: Bearer &lt;token&gt;</code> 添加到请求 Header 中。</AlertBanner>
          <FLabel required>Token</FLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", border: `1.5px solid ${T.border}`, borderRadius: 7, overflow: "hidden" }}>
              <input type={showBearer ? "text" : "password"} value={bearerToken} onChange={e => setBearerToken(e.target.value)}
                placeholder="输入 Token 或使用变量 {{token}}"
                style={{ flex: 1, border: "none", outline: "none", padding: "8px 12px", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", color: T.t1 }}/>
              <button onClick={() => setShowBearer(v => !v)} style={{ padding: "0 10px", background: "none", border: "none", cursor: "pointer", color: T.t3 }}>{showBearer ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
            </div>
            <button style={{ padding: "0 12px", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", color: T.t2, cursor: "pointer", fontSize: 12 }}>测试</button>
          </div>
          <div style={{ fontSize: 12, color: T.t4, lineHeight: 1.8 }}>
            支持直接输入明文 Token，或使用 <code style={{ fontFamily: "monospace", fontSize: 11, color: T.primary }}>{"{{变量名}}"}</code> 引用环境变量，推荐使用变量以避免敏感信息泄漏。
          </div>
        </div>
      )}

      {/* Basic Auth */}
      {effectiveType === "basic" && (
        <div style={{ maxWidth: 520 }}>
          <AlertBanner type="info">Basic Auth 将用户名和密码通过 Base64 编码后作为 <code style={{ fontFamily: "monospace", fontSize: 11 }}>Authorization: Basic &lt;base64&gt;</code> 发送。</AlertBanner>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <FLabel required>用户名</FLabel>
              <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${T.border}`, borderRadius: 7, overflow: "hidden" }}>
                <User size={13} style={{ color: T.t4, marginLeft: 10, flexShrink: 0 }}/>
                <input value={basicUser} onChange={e => setBasicUser(e.target.value)} placeholder="username 或 {{变量}}"
                  style={{ flex: 1, border: "none", outline: "none", padding: "8px 10px", fontSize: 13, color: T.t1 }}/>
              </div>
            </div>
            <div>
              <FLabel required>密码</FLabel>
              <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${T.border}`, borderRadius: 7, overflow: "hidden" }}>
                <Key size={13} style={{ color: T.t4, marginLeft: 10, flexShrink: 0 }}/>
                <input type={showPass ? "text" : "password"} value={basicPass} onChange={e => setBasicPass(e.target.value)} placeholder="password 或 {{变量}}"
                  style={{ flex: 1, border: "none", outline: "none", padding: "8px 10px", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", color: T.t1 }}/>
                <button onClick={() => setShowPass(v => !v)} style={{ padding: "0 10px", background: "none", border: "none", cursor: "pointer", color: T.t3 }}>{showPass ? <EyeOff size={13}/> : <Eye size={13}/>}</button>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, background: T.bg }}>
            <div style={{ fontSize: 11, color: T.t3, marginBottom: 4 }}>Base64 预览</div>
            <code style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: T.t2 }}>
              Authorization: Basic {btoa(`${basicUser}:${showPass ? basicPass : "•••••"}`) }
            </code>
          </div>
        </div>
      )}

      {/* API Key */}
      {effectiveType === "api-key" && (
        <div style={{ maxWidth: 520 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <FLabel required>Header / 参数名</FLabel>
              <input value={apiKeyName} onChange={e => setApiKeyName(e.target.value)} placeholder="X-API-Key"
                style={{ width: "100%", boxSizing: "border-box", height: 36, padding: "0 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none" }}/>
            </div>
            <div>
              <FLabel required>注入位置</FLabel>
              <div style={{ display: "flex", gap: 2, background: T.bg, borderRadius: 6, padding: 2 }}>
                {(["header", "query"] as const).map(loc => (
                  <button key={loc} onClick={() => setApiKeyLocation(loc)}
                    style={{ flex: 1, padding: "5px 0", borderRadius: 5, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", background: apiKeyLocation === loc ? "#fff" : "transparent", color: apiKeyLocation === loc ? T.primary : T.t3, boxShadow: apiKeyLocation === loc ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
                    {loc === "header" ? "Header" : "Query Param"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <FLabel required>API Key 值</FLabel>
          <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${T.border}`, borderRadius: 7, overflow: "hidden", marginBottom: 8 }}>
            <input type={showApiKey ? "text" : "password"} value={apiKeyValue} onChange={e => setApiKeyValue(e.target.value)}
              placeholder="输入 Key 或使用 {{变量名}}"
              style={{ flex: 1, border: "none", outline: "none", padding: "8px 12px", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", color: T.t1 }}/>
            <button onClick={() => setShowApiKey(v => !v)} style={{ padding: "0 10px", background: "none", border: "none", cursor: "pointer", color: T.t3 }}>{showApiKey ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
          </div>
          <div style={{ fontSize: 12, color: T.t4 }}>
            将在发送时以 <code style={{ fontFamily: "monospace", fontSize: 11, color: T.primary }}>{apiKeyLocation === "header" ? `${apiKeyName}: <value>` : `?${apiKeyName}=<value>`}</code> 的方式注入请求。
          </div>
        </div>
      )}

      {/* OAuth 2.0 */}
      {effectiveType === "oauth2" && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <select value={oauthGrantType} onChange={e => setOauthGrantType(e.target.value)}
              style={{ flex: 1, height: 36, padding: "0 10px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none" }}>
              <option value="client_credentials">Client Credentials</option>
              <option value="authorization_code">Authorization Code</option>
              <option value="password">Resource Owner Password</option>
              <option value="implicit">Implicit</option>
            </select>
            <button style={{ padding: "0 16px", border: `1px solid ${T.primary}`, borderRadius: 7, background: `${T.primary}0D`, color: T.primary, fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <Zap size={13}/>获取新 Token
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <FLabel required>Token URL</FLabel>
              <input value={tokenUrl} onChange={e => setTokenUrl(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", height: 36, padding: "0 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", color: T.t1, outline: "none" }}/>
            </div>
            <div>
              <FLabel required>Client ID</FLabel>
              <input value={clientId} onChange={e => setClientId(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", height: 36, padding: "0 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none" }}/>
            </div>
            <div>
              <FLabel required>Client Secret</FLabel>
              <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${T.border}`, borderRadius: 7, overflow: "hidden" }}>
                <input type={showSecret ? "text" : "password"} value={clientSecret} onChange={e => setClientSecret(e.target.value)}
                  style={{ flex: 1, border: "none", outline: "none", padding: "8px 12px", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", color: T.t1 }}/>
                <button onClick={() => setShowSecret(v => !v)} style={{ padding: "0 10px", background: "none", border: "none", cursor: "pointer", color: T.t3 }}>{showSecret ? <EyeOff size={13}/> : <Eye size={13}/>}</button>
              </div>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <FLabel>Scope</FLabel>
              <input value={oauthScope} onChange={e => setOauthScope(e.target.value)} placeholder="read:orders write:orders"
                style={{ width: "100%", boxSizing: "border-box", height: 36, padding: "0 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none" }}/>
            </div>
          </div>
          {oauthFailed ? (
            <div style={{ marginTop: 16, padding: "12px 14px", border: `1.5px solid ${T.danger}30`, borderRadius: 8, background: "#FFF5F5" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <XCircle size={14} style={{ color: T.danger, flexShrink: 0 }}/>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.danger }}>Token 获取失败</span>
              </div>
              <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.7, marginBottom: 8 }}>
                <strong>401 Unauthorized</strong> — Client Secret 无效或已过期。<br/>
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: T.danger }}>{"{"}"error": "invalid_client", "error_description": "Bad client credentials"{"}"}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ fontSize: 12, padding: "5px 12px", border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", color: T.t2, cursor: "pointer" }}>检查配置</button>
                <button style={{ fontSize: 12, padding: "5px 12px", border: `1px solid ${T.primary}`, borderRadius: 6, background: `${T.primary}0D`, color: T.primary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><RefreshCw size={11}/>重新获取</button>
              </div>
            </div>
          ) : oauthToken ? (
            <div style={{ marginTop: 16, padding: "10px 14px", border: `1px solid ${T.success}30`, borderRadius: 8, background: "#E8FFEA" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <CheckCircle size={12} style={{ color: T.success }}/>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.success }}>Token 已获取</span>
              </div>
              <code style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: T.t2, wordBreak: "break-all" }}>{oauthToken}</code>
            </div>
          ) : (
            <div style={{ marginTop: 16, padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: 8, background: T.bg, fontSize: 12, color: T.t4, display: "flex", alignItems: "center", gap: 6 }}>
              <Info size={13}/>点击"获取新 Token"以完成 OAuth 2.0 授权流程并自动填充 Token
            </div>
          )}
        </div>
      )}

      {/* Custom Auth */}
      {effectiveType === "custom" && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, marginBottom: 8 }}>自定义 Header 注入</div>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
                  {["Header 名称","值 / 变量",""].map((h,i) => <th key={i} style={{ padding: "7px 10px", textAlign: "left", fontSize: 11, fontWeight: 600, color: T.t3 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {customHeaders.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i < customHeaders.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <td style={{ padding: "6px 10px" }}>
                      <input value={row.key} onChange={e => setCustomHeaders(h => h.map((r,j) => j===i ? {...r,key:e.target.value} : r))}
                        style={{ width: "100%", border: "none", outline: "none", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: T.t2 }}/>
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <input value={row.value} onChange={e => setCustomHeaders(h => h.map((r,j) => j===i ? {...r,value:e.target.value} : r))}
                        style={{ width: "100%", border: "none", outline: "none", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: T.primary }}/>
                    </td>
                    <td style={{ padding: "6px 8px", width: 28 }}>
                      <button onClick={() => setCustomHeaders(h => h.filter((_,j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: T.danger, lineHeight: 0, padding: 2 }}><Trash2 size={12}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setCustomHeaders(h => [...h, { key: "", value: "" }])}
              style={{ display: "flex", alignItems: "center", gap: 5, width: "100%", padding: "7px 12px", border: "none", background: "transparent", fontSize: 12, color: T.t3, cursor: "pointer" }}>
              <Plus size={12}/>添加 Header
            </button>
          </div>
          <div style={{ fontSize: 12, color: T.t4, lineHeight: 1.8 }}>
            支持直接输入明文值，或通过 <code style={{ fontFamily: "monospace", fontSize: 11, color: T.primary }}>{"{{变量名}}"}</code> 引用环境变量 / 工作区变量。
          </div>
        </div>
      )}

      <DemoBar states={AUTH_DEMO} current={demoAuth} onChange={setDemoAuth}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. UnsavedConfirmDialog — 未保存修改确认弹窗
// ─────────────────────────────────────────────────────────────────────────────

export function UnsavedConfirmDialog({ onClose, onDiscard }: { onClose: () => void; onDiscard: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 500 }}/>
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 501, background: "#fff", borderRadius: 10, width: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.16)", padding: "24px 24px 20px" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: `${T.warning}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AlertTriangle size={17} color={T.warning}/>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.t1, marginBottom: 6 }}>存在未保存的修改</div>
            <div style={{ fontSize: 13, color: T.t2, lineHeight: 1.65 }}>
              当前接口有尚未保存的内容，包括：
              <ul style={{ margin: "6px 0 0 16px", padding: 0, color: T.t2 }}>
                <li>请求参数已修改</li>
                <li>断言规则已新增</li>
              </ul>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "7px 16px", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", fontSize: 13, color: T.t2, cursor: "pointer" }}>继续编辑</button>
          <button onClick={() => { onDiscard(); onClose(); }}
            style={{ padding: "7px 18px", border: "none", borderRadius: 7, background: T.warning, color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <AlertTriangle size={12}/>放弃修改
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. RequestSendingOverlay — 请求发送状态遮罩
//    (Used for sending / timeout / cancel / SSL error states)
// ─────────────────────────────────────────────────────────────────────────────

type SendState = "sending"|"cancel"|"timeout"|"network-error"|"ssl-error"|"body-too-large";

const SEND_DEMO: { value: SendState; label: string }[] = [
  { value: "sending",        label: "发送中" },
  { value: "cancel",         label: "已取消" },
  { value: "timeout",        label: "请求超时" },
  { value: "network-error",  label: "网络错误" },
  { value: "ssl-error",      label: "SSL 错误" },
  { value: "body-too-large", label: "响应体过大" },
];

export function RequestSendStatePanel({ state, onCancel, onDismiss }: {
  state: SendState;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const isSending = state === "sending";
  const isCancel  = state === "cancel";
  const isTimeout = state === "timeout";
  const isNetwork = state === "network-error";
  const isSSL     = state === "ssl-error";
  const isBig     = state === "body-too-large";
  const isError   = !isSending;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 32 }}>
      {isSending && (
        <>
          <Loader2 size={32} style={{ color: T.primary, animation: "spin 1s linear infinite" }}/>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.t1 }}>正在发送请求…</div>
          <div style={{ fontSize: 12, color: T.t4 }}>POST /api/v1/orders</div>
          <button onClick={onCancel} style={{ marginTop: 4, padding: "6px 18px", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", fontSize: 13, color: T.t2, cursor: "pointer" }}>取消请求</button>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </>
      )}
      {isCancel && (
        <>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={22} style={{ color: T.t3 }}/></div>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.t1 }}>请求已取消</div>
          <div style={{ fontSize: 12, color: T.t4 }}>用户手动取消了本次请求</div>
          <button onClick={onDismiss} style={{ marginTop: 4, padding: "6px 18px", border: `1px solid ${T.primary}`, borderRadius: 7, background: `${T.primary}0D`, color: T.primary, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>重新发送</button>
        </>
      )}
      {isTimeout && (
        <>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FFF3E8", display: "flex", alignItems: "center", justifyContent: "center" }}><AlertTriangle size={22} style={{ color: T.warning }}/></div>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.t1 }}>请求超时</div>
          <div style={{ fontSize: 12, color: T.t3, textAlign: "center", lineHeight: 1.8 }}>超出设定的超时时间 30,000 ms<br/>请检查服务端是否正常响应，或调整 Settings 中的超时配置</div>
          <button onClick={onDismiss} style={{ marginTop: 4, padding: "6px 18px", border: `1px solid ${T.primary}`, borderRadius: 7, background: `${T.primary}0D`, color: T.primary, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>重试</button>
        </>
      )}
      {isNetwork && (
        <>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FFE8E8", display: "flex", alignItems: "center", justifyContent: "center" }}><XCircle size={22} style={{ color: T.danger }}/></div>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.t1 }}>网络连接失败</div>
          <div style={{ fontSize: 12, color: T.t3, textAlign: "center", lineHeight: 1.8 }}>ERR_NAME_NOT_RESOLVED<br/>请检查网络连接或服务地址是否正确</div>
          <button onClick={onDismiss} style={{ marginTop: 4, padding: "6px 18px", border: `1px solid ${T.primary}`, borderRadius: 7, background: `${T.primary}0D`, color: T.primary, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>重试</button>
        </>
      )}
      {isSSL && (
        <>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FFE8E8", display: "flex", alignItems: "center", justifyContent: "center" }}><Shield size={22} style={{ color: T.danger }}/></div>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.t1 }}>SSL 证书错误</div>
          <div style={{ fontSize: 12, color: T.t3, textAlign: "center", lineHeight: 1.8 }}>CERT_COMMON_NAME_INVALID<br/>证书域名不匹配，或证书已过期</div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={onDismiss} style={{ padding: "6px 16px", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", color: T.t2, fontSize: 13, cursor: "pointer" }}>取消</button>
            <button style={{ padding: "6px 16px", border: `1px solid ${T.danger}`, borderRadius: 7, background: "#fff", color: T.danger, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>忽略并继续</button>
          </div>
        </>
      )}
      {isBig && (
        <>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#FFF3E8", display: "flex", alignItems: "center", justifyContent: "center" }}><AlertTriangle size={22} style={{ color: T.warning }}/></div>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.t1 }}>响应体过大</div>
          <div style={{ fontSize: 12, color: T.t3, textAlign: "center", lineHeight: 1.8 }}>响应体大小 24.8 MB，超出 10 MB 预览限制<br/>仅显示前 10,000 行，建议下载完整文件</div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button style={{ padding: "6px 16px", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", color: T.t2, fontSize: 13, cursor: "pointer" }}>仅查看前 10K 行</button>
            <button style={{ padding: "6px 16px", border: `1px solid ${T.primary}`, borderRadius: 7, background: `${T.primary}0D`, color: T.primary, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>下载完整响应</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. SettingsPanel — Settings 配置面板 (inline)
// ─────────────────────────────────────────────────────────────────────────────

type SettingSource = "default"|"interface"|"env";
const SOURCE_LABEL: Record<SettingSource, string> = { default: "平台默认", interface: "接口自定义", env: "环境覆盖" };
const SOURCE_COLOR: Record<SettingSource, string> = { default: T.t4, interface: T.primary, env: T.warning };

interface SettingRow { label: string; desc: string; type: "number"|"toggle"|"select"; value: any; unit?: string; source: SettingSource; options?: string[]; }

const DEFAULT_SETTINGS: SettingRow[] = [
  { label: "请求超时时间",    desc: "单次请求最长等待时间",           type: "number",  value: 30000,    unit: "ms",   source: "interface" },
  { label: "跟随重定向",      desc: "自动跟随 301 / 302 重定向",     type: "toggle",  value: true,                   source: "default"   },
  { label: "SSL 证书校验",    desc: "验证服务端 SSL/TLS 证书合法性", type: "toggle",  value: false,                  source: "env"       },
  { label: "Cookie 自动管理", desc: "保存并在后续请求中携带 Cookie", type: "toggle",  value: true,                   source: "default"   },
  { label: "响应体大小限制",  desc: "超出限制后仅展示前段内容",       type: "number",  value: 10,       unit: "MB",   source: "default"   },
  { label: "自动编码",        desc: "URL 特殊字符自动 percent 编码", type: "toggle",  value: true,                   source: "default"   },
  { label: "最大重试次数",    desc: "请求失败后的自动重试次数",       type: "number",  value: 0,        unit: "次",   source: "interface" },
  { label: "请求日志级别",    desc: "记录到控制台的日志详细程度",     type: "select",  value: "INFO",                 source: "default", options: ["DEBUG","INFO","WARN","ERROR"] },
];

export function SettingsPanel() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const updateSetting = (i: number, value: any) => {
    setSettings(s => s.map((r, j) => j === i ? { ...r, value, source: "interface" } : r));
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
      <div style={{ marginBottom: 14, fontSize: 12, color: T.t3, display: "flex", gap: 12 }}>
        {(["default","interface","env"] as SettingSource[]).map(s => (
          <span key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: SOURCE_COLOR[s], display: "inline-block" }}/>
            {SOURCE_LABEL[s]}
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {settings.map((row, i) => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: 8, marginBottom: 6, background: "#fff" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{row.label}</span>
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: `${SOURCE_COLOR[row.source]}12`, color: SOURCE_COLOR[row.source], fontWeight: 600 }}>{SOURCE_LABEL[row.source]}</span>
              </div>
              <div style={{ fontSize: 11, color: T.t4, marginTop: 2 }}>{row.desc}</div>
            </div>
            {row.type === "toggle" && <SmToggle on={!!row.value} onChange={v => updateSetting(i, v)}/>}
            {row.type === "number" && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input type="number" value={row.value} onChange={e => updateSetting(i, Number(e.target.value))}
                  style={{ width: 72, padding: "4px 8px", border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: 12, color: T.t1, outline: "none", textAlign: "right" }}/>
                {row.unit && <span style={{ fontSize: 12, color: T.t4, width: 22 }}>{row.unit}</span>}
              </div>
            )}
            {row.type === "select" && (
              <select value={row.value} onChange={e => updateSetting(i, e.target.value)}
                style={{ height: 30, padding: "0 8px", border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: 12, color: T.t1, outline: "none" }}>
                {row.options?.map(o => <option key={o}>{o}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 14px", border: `1px solid ${T.border}`, borderRadius: 8, background: T.bg }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: T.t1, marginBottom: 6 }}>代理配置</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <input placeholder="http://proxy.company.com:8080" style={{ height: 32, padding: "0 10px", border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: 12, color: T.t1, outline: "none" }}/>
          <SmToggle on={false} onChange={() => {}}/>
        </div>
        <div style={{ fontSize: 11, color: T.t4, marginTop: 5 }}>仅对当前接口生效，不影响其他接口和全局配置</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. BinaryBodyPanel — Binary 文件上传请求体
// ─────────────────────────────────────────────────────────────────────────────

type BinaryState = "empty"|"selected"|"uploading"|"done";
const BINARY_DEMO: { value: BinaryState; label: string }[] = [
  { value: "empty",     label: "未上传" },
  { value: "selected",  label: "已选择" },
  { value: "uploading", label: "上传中" },
  { value: "done",      label: "完成" },
];

export function BinaryBodyPanel() {
  const [demoState, setDemoState] = useState<BinaryState>("empty");
  const fileRef = useRef<HTMLInputElement>(null);

  const isEmpty    = demoState === "empty";
  const isSelected = demoState === "selected";
  const isUploading = demoState === "uploading";
  const isDone     = demoState === "done";

  const fileName = "export-orders-2026-07-31.csv";
  const fileSize = "2.34 MB";
  const mimeType = "text/csv";

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", position: "relative" }}>
      <div style={{ fontSize: 12, color: T.t3, marginBottom: 14 }}>
        Binary 类型将把整个文件作为请求体发送，适用于文件上传、图片、PDF 等场景。
        Content-Type 将自动设置为文件的 MIME 类型。
      </div>

      {isEmpty && (
        <div
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${T.border}`, borderRadius: 10, padding: "48px 24px", textAlign: "center", cursor: "pointer", background: T.bg, transition: "border-color .15s" }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = T.primary)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}
        >
          <Upload size={28} style={{ color: T.t4, margin: "0 auto 10px" }}/>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.t2, marginBottom: 4 }}>点击选择文件，或拖拽至此</div>
          <div style={{ fontSize: 12, color: T.t4 }}>支持任意格式，单文件最大 100 MB</div>
          <input ref={fileRef} type="file" style={{ display: "none" }} onChange={() => setDemoState("selected")}/>
        </div>
      )}

      {(isSelected || isUploading || isDone) && (
        <div style={{ border: `1.5px solid ${isUploading ? T.primary : isDone ? T.success : T.border}`, borderRadius: 10, padding: "14px 16px", background: isDone ? "#F0FFF4" : "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: isDone ? `${T.success}14` : `${T.primary}0D`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FileText size={20} style={{ color: isDone ? T.success : T.primary }}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileName}</div>
              <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>{fileSize} · {mimeType}</div>
            </div>
            {!isUploading && (
              <button onClick={() => setDemoState("empty")} style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, lineHeight: 0, padding: 4, borderRadius: 5 }}><X size={14}/></button>
            )}
          </div>

          {isUploading && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.t3, marginBottom: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Loader2 size={11} style={{ color: T.primary, animation: "spin 1s linear infinite" }}/>正在准备上传…</span>
                <span>67%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: T.border, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "67%", borderRadius: 2, background: T.primary, transition: "width .3s" }}/>
              </div>
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {isDone && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle size={12} style={{ color: T.success }}/>
              <span style={{ fontSize: 12, color: T.success, fontWeight: 500 }}>文件已就绪，发送时将以二进制流写入请求体</span>
            </div>
          )}
        </div>
      )}

      {isSelected && (
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button onClick={() => fileRef.current?.click()} style={{ fontSize: 12, padding: "6px 14px", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", color: T.t2, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><RefreshCw size={12}/>重新选择</button>
          <button onClick={() => setDemoState("uploading")} style={{ fontSize: 12, padding: "6px 16px", border: "none", borderRadius: 7, background: T.primary, color: "#fff", cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}><Upload size={12}/>确认使用此文件</button>
          <input ref={fileRef} type="file" style={{ display: "none" }}/>
        </div>
      )}

      <div style={{ marginTop: 16, padding: "10px 14px", border: `1px solid ${T.border}`, borderRadius: 8, background: T.bg }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.t3, marginBottom: 6 }}>发送配置</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
          <div>
            <div style={{ color: T.t4, marginBottom: 3 }}>Content-Type</div>
            <input defaultValue="application/octet-stream" style={{ width: "100%", boxSizing: "border-box", height: 30, padding: "0 8px", border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: 12, color: T.t1, outline: "none" }}/>
          </div>
          <div>
            <div style={{ color: T.t4, marginBottom: 3 }}>Transfer-Encoding</div>
            <select style={{ width: "100%", height: 30, padding: "0 8px", border: `1.5px solid ${T.border}`, borderRadius: 6, fontSize: 12, color: T.t1, outline: "none" }}>
              <option>chunked</option><option>identity</option>
            </select>
          </div>
        </div>
      </div>

      <DemoBar states={BINARY_DEMO} current={demoState} onChange={setDemoState}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. JsonSchemaPanel — JSON Schema 编辑器 + 根据 Schema 生成请求体
// ─────────────────────────────────────────────────────────────────────────────

type SchemaState = "empty"|"editing"|"generating"|"generated"|"error";
const SCHEMA_DEMO: { value: SchemaState; label: string }[] = [
  { value: "empty",      label: "空" },
  { value: "editing",    label: "编辑中" },
  { value: "generating", label: "AI 生成中" },
  { value: "generated",  label: "已生成" },
  { value: "error",      label: "Schema 错误" },
];

const SAMPLE_SCHEMA = `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["page", "pageSize"],
  "properties": {
    "page": {
      "type": "integer",
      "minimum": 1,
      "description": "当前页码"
    },
    "pageSize": {
      "type": "integer",
      "enum": [10, 20, 50, 100],
      "description": "每页条数"
    },
    "status": {
      "type": "string",
      "enum": ["active", "inactive", "pending"],
      "description": "筛选状态"
    },
    "keyword": {
      "type": "string",
      "maxLength": 100,
      "description": "搜索关键词"
    }
  }
}`;

const GENERATED_BODY = `{
  "page": 1,
  "pageSize": 20,
  "status": "active",
  "keyword": "example keyword"
}`;

export function JsonSchemaPanel() {
  const [demoState, setDemoState] = useState<SchemaState>("editing");
  const [schema, setSchema] = useState(SAMPLE_SCHEMA);
  const [activeTab, setActiveTab] = useState<"schema"|"generated">("schema");

  const isEmpty     = demoState === "empty";
  const isEditing   = demoState === "editing";
  const isGenerating = demoState === "generating";
  const isGenerated = demoState === "generated";
  const isError     = demoState === "error";

  const errorLine = 6;
  const errorMsg = `第 ${errorLine} 行：缺少闭合括号 "}"`;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: `1px solid ${T.border}`, flexShrink: 0, background: "#FAFAFA" }}>
        <div style={{ display: "flex", gap: 1, background: T.border, borderRadius: 6, padding: 1 }}>
          {(["schema","generated"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ padding: "3px 12px", borderRadius: 5, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", background: activeTab === tab ? "#fff" : "transparent", color: activeTab === tab ? T.t1 : T.t3 }}>
              {tab === "schema" ? "Schema 定义" : "生成的请求体"}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}/>
        {isError && (
          <span style={{ fontSize: 11, color: T.danger, display: "flex", alignItems: "center", gap: 4 }}>
            <AlertCircle size={11}/>{errorMsg}
          </span>
        )}
        <button style={{ fontSize: 11, padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: 6, background: "#fff", color: T.t2, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
          <Upload size={11}/>导入 Schema
        </button>
        <button
          onClick={() => { setDemoState("generating"); setTimeout(() => { setDemoState("generated"); setActiveTab("generated"); }, 1400); }}
          style={{ fontSize: 11, padding: "4px 12px", border: "none", borderRadius: 6, background: isGenerating ? T.t4 : T.purple, color: "#fff", cursor: isGenerating ? "default" : "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
          {isGenerating
            ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }}/>AI 生成中…</>
            : <><Sparkles size={11}/>根据 Schema 生成请求体</>}
        </button>
      </div>

      {/* Editor area */}
      {activeTab === "schema" && (
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {isEmpty ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: T.t4 }}>
              <Code2 size={32} style={{ opacity: 0.3 }}/>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.t2 }}>暂无 Schema 定义</div>
              <div style={{ fontSize: 12, color: T.t4, textAlign: "center", lineHeight: 1.7 }}>
                在此定义接口请求体和响应体的 JSON Schema，<br/>支持数据校验、智能生成示例请求。
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => { setSchema(SAMPLE_SCHEMA); setDemoState("editing"); }} style={{ fontSize: 12, padding: "6px 14px", border: `1px solid ${T.primary}`, borderRadius: 7, background: `${T.primary}0D`, color: T.primary, cursor: "pointer" }}>从模板开始</button>
                <button style={{ fontSize: 12, padding: "6px 14px", border: `1px solid ${T.border}`, borderRadius: 7, background: "#fff", color: T.t2, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}><Upload size={11}/>导入 OpenAPI / Swagger</button>
              </div>
            </div>
          ) : (
            <div style={{ height: "100%", position: "relative" }}>
              <textarea
                value={schema}
                onChange={e => setSchema(e.target.value)}
                spellCheck={false}
                style={{
                  width: "100%", height: "100%", boxSizing: "border-box",
                  padding: "16px 16px", border: "none", outline: "none", resize: "none",
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 12, lineHeight: 1.7,
                  color: isError ? T.t1 : T.t1, background: isError ? "#FFFBFB" : "#fff",
                }}
              />
              {isError && (
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 16px", background: "#FFE8E8", borderTop: `1.5px solid ${T.danger}40`, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.danger }}>
                  <AlertCircle size={13}/>{errorMsg} — 请修正后重试
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "generated" && (
        <div style={{ flex: 1, overflow: "auto", padding: 16, background: "#FAFBFF" }}>
          {isGenerated ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <CheckCircle size={13} style={{ color: T.success }}/>
                <span style={{ fontSize: 12, fontWeight: 500, color: T.success }}>已根据 Schema 生成请求体示例</span>
                <div style={{ flex: 1 }}/>
                <button style={{ fontSize: 11, padding: "3px 10px", border: `1px solid ${T.border}`, borderRadius: 5, background: "#fff", color: T.t2, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}><Copy size={10}/>复制</button>
                <button style={{ fontSize: 11, padding: "3px 10px", border: `1px solid ${T.primary}`, borderRadius: 5, background: `${T.primary}0D`, color: T.primary, cursor: "pointer" }}>填入 Body</button>
              </div>
              <pre style={{ margin: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: 12, lineHeight: 1.7, color: T.t1 }}>{GENERATED_BODY}</pre>
            </>
          ) : (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: T.t4 }}>
              <Sparkles size={28} style={{ opacity: 0.3 }}/>
              <div style={{ fontSize: 13, color: T.t3 }}>点击「根据 Schema 生成请求体」后，示例将在此展示</div>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <DemoBar states={SCHEMA_DEMO} current={demoState} onChange={setDemoState}/>
    </div>
  );
}
