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
  Play, Sparkles, Bot, Edit2,
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
// 3-A. EnvRunConfigModal — 环境管理弹窗
// ─────────────────────────────────────────────────────────────────────────────

const ENV_MODAL_LIST = [
  { id:"test",    name:"测试环境",   identifier:"test",    color:T.success, bg:"#E8FFEA", desc:"QA 日常测试",    disabled:false },
  { id:"staging", name:"预发布环境", identifier:"staging", color:T.warning, bg:"#FFF3E8", desc:"上线前回归验证", disabled:false },
  { id:"prod",    name:"生产环境",   identifier:"prod",    color:T.danger,  bg:"#FFE8E8", desc:"只读，谨慎操作", disabled:false },
  { id:"dev",     name:"开发环境",   identifier:"dev",     color:T.t4,      bg:T.bg,      desc:"不稳定，已停用", disabled:true  },
];

const SVC_MODAL_LIST = [
  {
    id:"gateway", name:"API 网关",  desc:"统一入口路由",
    urls:{ test:"https://api-test.company.com", staging:"https://api-staging.company.com", prod:"https://api.company.com",   dev:"https://api-dev.company.com"   },
    on:{ test:true,  staging:true,  prod:true,  dev:true  },
  },
  {
    id:"user",    name:"用户服务",  desc:"账号认证与权限",
    urls:{ test:"https://user-test.company.com", staging:"https://user-stg.company.com",  prod:"https://user.company.com",  dev:"https://user-dev.company.com"  },
    on:{ test:true,  staging:true,  prod:true,  dev:true  },
  },
  {
    id:"order",   name:"订单服务",  desc:"订单生命周期管理",
    urls:{ test:"https://order-test.company.com",staging:"https://order-stg.company.com", prod:"https://order.company.com", dev:"https://order-dev.company.com" },
    on:{ test:true,  staging:true,  prod:true,  dev:false },
  },
  {
    id:"risk",    name:"风控服务",  desc:"实时风险评估",
    urls:{ test:"https://risk-test.company.com", staging:"https://risk-stg.company.com",  prod:"https://risk.company.com",  dev:""                              },
    on:{ test:true,  staging:true,  prod:true,  dev:false },
  },
];

type VarGroupKey = "env"|"global"|"builtin";
const VAR_MODAL_DATA: Record<VarGroupKey, {name:string; value:string; desc:string; sensitive:boolean}[]> = {
  env: [
    { name:"BASE_URL",       value:"https://test-api.company.com", desc:"环境接口基础地址",    sensitive:false },
    { name:"access_token",   value:"eyJhbGciOiJSUzI1NiIs...",      desc:"当前用户访问令牌",    sensitive:true  },
    { name:"DB_HOST",        value:"mysql-test.company.com",       desc:"测试数据库主机",      sensitive:false },
    { name:"ENV_TAG",        value:"test-qa",                      desc:"环境标识标签",        sensitive:false },
  ],
  global: [
    { name:"DEFAULT_TIMEOUT",  value:"30000",       desc:"全局请求超时（毫秒）",  sensitive:false },
    { name:"BASE_RETRY_COUNT", value:"3",           desc:"请求失败重试次数",      sensitive:false },
    { name:"WS_API_SECRET",    value:"sk-••••••••", desc:"工作区 API 密钥",      sensitive:true  },
    { name:"LOG_LEVEL",        value:"INFO",        desc:"全局日志级别",          sensitive:false },
  ],
  builtin: [
    { name:"__ENV_ID__",      value:"2",             desc:"当前环境 ID",         sensitive:false },
    { name:"__ENV_NAME__",    value:"测试环境",       desc:"当前环境名称",         sensitive:false },
    { name:"__TIMESTAMP__",   value:"1748419200000", desc:"当前时间戳（毫秒）",   sensitive:false },
    { name:"__RANDOM_UUID__", value:"<动态生成>",    desc:"每次请求生成新 UUID", sensitive:false },
    { name:"__RANDOM_INT__",  value:"<动态生成>",    desc:"每次请求随机整数",     sensitive:false },
  ],
};

// ENV_VAR_ROWS: variable table data per environment
const ENV_VAR_ROWS: Record<string, {name:string; remote:string; local:string; sensitive:boolean}[]> = {
  test: [
    { name:"secretToken", remote:"eyJhbGciOiJSUzI1NiIs...", local:"",                       sensitive:true  },
    { name:"DB_HOST",     remote:"mysql-test.company.com",  local:"localhost:3306",          sensitive:false },
    { name:"BASE_URL",    remote:"https://api-test.company.com", local:"",                   sensitive:false },
    { name:"ENV_TAG",     remote:"test-qa",                 local:"",                        sensitive:false },
  ],
  staging: [
    { name:"secretToken", remote:"eyJhbGciOiJSUzI1NiIs...", local:"",                       sensitive:true  },
    { name:"BASE_URL",    remote:"https://api-staging.company.com", local:"",               sensitive:false },
  ],
  prod: [
    { name:"secretToken", remote:"eyJhbGciOiJSUzI1NiIs...", local:"",                       sensitive:true  },
    { name:"BASE_URL",    remote:"https://api.company.com",  local:"",                       sensitive:false },
  ],
  dev: [
    { name:"BASE_URL",    remote:"https://api-dev.company.com", local:"http://localhost:8080", sensitive:false },
  ],
};

export function EnvRunConfigModal({ activeEnv: initEnv = "", onClose }: { activeEnv?: string; onEnvChange?: (env: string) => void; onClose: () => void }) {
  const [activeId, setActiveId] = useState(
    () => ENV_MODAL_LIST.find(e => e.name === initEnv)?.id ?? "test"
  );
  const [leftNav, setLeftNav] = useState<"globalVar"|"globalParam"|null>(null);
  const [editingUrl, setEditingUrl] = useState<{svcId:string; value:string}|null>(null);
  const [svcUrls, setSvcUrls] = useState<Record<string,Record<string,string>>>(() => {
    const r: Record<string,Record<string,string>> = {};
    SVC_MODAL_LIST.forEach(s => { r[s.id] = {...s.urls}; });
    return r;
  });
  const [envVarRows, setEnvVarRows] = useState<Record<string,{name:string;remote:string;local:string;sensitive:boolean}[]>>(ENV_VAR_ROWS);
  const [showSecret, setShowSecret] = useState<Set<string>>(new Set());
  const [addingVar, setAddingVar] = useState(false);
  const [newVar, setNewVar] = useState({name:"",remote:"",local:""});
  const [saved, setSaved] = useState(false);

  const activeEnvCfg = leftNav ? null : ENV_MODAL_LIST.find(e => e.id === activeId);

  const commitUrl = (svcId: string, val: string) => {
    setSvcUrls(prev => ({ ...prev, [svcId]: { ...prev[svcId], [activeId]: val } }));
    setEditingUrl(null);
  };

  const toggleSecret = (name: string) => {
    const s = new Set(showSecret);
    s.has(name) ? s.delete(name) : s.add(name);
    setShowSecret(s);
  };

  const handleSave = (andClose: boolean) => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    if(andClose) onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.3)", zIndex:500 }}/>
      <div style={{ position:"fixed", inset:0, zIndex:501, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
        <div style={{
          pointerEvents:"all", width:900, maxWidth:"calc(100vw - 40px)",
          height:"min(640px,90vh)", background:"#fff", borderRadius:12,
          boxShadow:"0 16px 56px rgba(0,0,0,0.16)", display:"flex", flexDirection:"column", overflow:"hidden",
        }}>

          {/* Header */}
          <div style={{ padding:"0 20px", height:52, borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <span style={{ fontSize:15, fontWeight:700, color:T.t1, flex:1 }}>环境管理</span>
            {saved && <span style={{ fontSize:12, color:T.success, display:"flex", alignItems:"center", gap:4 }}><CheckCircle size={13}/>已保存</span>}
            <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:T.t3, padding:4, borderRadius:5, lineHeight:0, display:"flex" }}>
              <X size={16}/>
            </button>
          </div>

          {/* Body */}
          <div style={{ flex:1, display:"flex", overflow:"hidden", minHeight:0 }}>

            {/* Left Nav */}
            <div style={{ width:200, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", flexShrink:0, background:"#FAFBFC" }}>
              <div style={{ padding:"12px 14px 4px", fontSize:10, fontWeight:700, color:T.t4, letterSpacing:"0.07em", textTransform:"uppercase" }}>全局</div>
              {([ ["globalVar","全局变量"], ["globalParam","全局参数"] ] as const).map(([key,label]) => (
                <button key={key} onClick={() => setLeftNav(key)} style={{
                  width:"100%", padding:"7px 14px", display:"flex", alignItems:"center",
                  border:"none", textAlign:"left", cursor:"pointer",
                  background:leftNav===key?"#EEF4FF":"transparent",
                  color:leftNav===key?T.primary:T.t2, fontSize:13,
                  borderLeft:`3px solid ${leftNav===key?T.primary:"transparent"}`,
                }}
                onMouseEnter={e => { if(leftNav!==key) e.currentTarget.style.background=T.bg; }}
                onMouseLeave={e => { e.currentTarget.style.background=leftNav===key?"#EEF4FF":"transparent"; }}>
                  {label}
                </button>
              ))}

              <div style={{ padding:"12px 14px 4px", fontSize:10, fontWeight:700, color:T.t4, letterSpacing:"0.07em", textTransform:"uppercase", marginTop:4 }}>环境</div>
              <div style={{ flex:1, overflowY:"auto" }}>
                {ENV_MODAL_LIST.map(env => {
                  const isAct = leftNav===null && activeId===env.id;
                  return (
                    <button key={env.id} onClick={() => { setLeftNav(null); !env.disabled && setActiveId(env.id); }} style={{
                      width:"100%", padding:"7px 14px", display:"flex", alignItems:"center", gap:8,
                      border:"none", borderLeft:`3px solid ${isAct?T.primary:"transparent"}`,
                      background:isAct?"#EEF4FF":"transparent",
                      cursor:env.disabled?"not-allowed":"pointer", textAlign:"left",
                      opacity:env.disabled?0.45:1,
                    }}
                    onMouseEnter={e => { if(!env.disabled && !isAct) e.currentTarget.style.background=T.bg; }}
                    onMouseLeave={e => { e.currentTarget.style.background=isAct?"#EEF4FF":"transparent"; }}>
                      <span style={{ width:8, height:8, borderRadius:"50%", background:env.color, flexShrink:0 }}/>
                      <span style={{ fontSize:13, color:isAct?T.primary:T.t1, fontWeight:isAct?600:400, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {env.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ padding:"8px 10px", borderTop:`1px solid ${T.border}`, flexShrink:0 }}>
                <button style={{
                  width:"100%", padding:"6px 10px", display:"flex", alignItems:"center", gap:6,
                  border:`1px dashed ${T.border}`, borderRadius:6, background:"transparent", cursor:"pointer", color:T.t3, fontSize:12,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=T.primary; e.currentTarget.style.color=T.primary; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.t3; }}>
                  <Plus size={12}/>新建环境
                </button>
              </div>
            </div>

            {/* Right Content */}
            {leftNav ? (
              <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8, color:T.t4 }}>
                <Database size={36} style={{ opacity:0.25 }}/>
                <div style={{ fontSize:13, color:T.t2 }}>{leftNav==="globalVar"?"全局变量":"全局参数"}</div>
                <div style={{ fontSize:12, color:T.t4 }}>在变量配置模块中统一管理</div>
              </div>
            ) : activeEnvCfg ? (
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                {/* Env header bar */}
                <div style={{ padding:"14px 20px 0", flexShrink:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                    <span style={{ width:10, height:10, borderRadius:"50%", background:activeEnvCfg.color, flexShrink:0, display:"inline-block" }}/>
                    <span style={{ fontSize:16, fontWeight:700, color:T.t1 }}>{activeEnvCfg.name}</span>
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:4, background:activeEnvCfg.bg, color:activeEnvCfg.color, fontWeight:600 }}>{activeEnvCfg.identifier}</span>
                    <div style={{ flex:1 }}/>
                    <span style={{ fontSize:12, color:T.t3 }}>{activeEnvCfg.desc}</span>
                  </div>
                  <div style={{ height:1, background:T.border }}/>
                </div>

                <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>

                  {/* 前置 URL section */}
                  <div style={{ display:"flex", alignItems:"center", marginBottom:10 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:T.t1, flex:1 }}>前置 URL</span>
                    <button style={{ fontSize:12, color:T.primary, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                      <Plus size={12}/>添加服务
                    </button>
                  </div>
                  <div style={{ border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden", marginBottom:20 }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                      <thead>
                        <tr style={{ background:"#FAFAFA", borderBottom:`1px solid ${T.border}` }}>
                          <th style={{ padding:"8px 14px", textAlign:"left", fontSize:11, fontWeight:600, color:T.t3, width:140 }}>服务</th>
                          <th style={{ padding:"8px 14px", textAlign:"left", fontSize:11, fontWeight:600, color:T.t3 }}>前置 URL</th>
                          <th style={{ padding:"8px 14px", width:40 }}/>
                        </tr>
                      </thead>
                      <tbody>
                        {SVC_MODAL_LIST.map((svc, i) => {
                          const isLast = i===SVC_MODAL_LIST.length-1;
                          const urlVal = svcUrls[svc.id]?.[activeId] ?? "";
                          const isEditing = editingUrl?.svcId===svc.id;
                          return (
                            <tr key={svc.id} style={{ borderBottom:isLast?"none":`1px solid ${T.border}` }}>
                              <td style={{ padding:"9px 14px" }}>
                                <div style={{ fontWeight:500, color:T.t1 }}>{svc.name}</div>
                                {i===0 && <span style={{ fontSize:10, padding:"1px 5px", borderRadius:3, background:`${T.primary}10`, color:T.primary, fontWeight:600 }}>默认</span>}
                              </td>
                              <td style={{ padding:"9px 14px" }}>
                                {isEditing ? (
                                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                    <input autoFocus value={editingUrl.value}
                                      onChange={e => setEditingUrl({ svcId:svc.id, value:e.target.value })}
                                      onBlur={() => commitUrl(svc.id, editingUrl.value)}
                                      onKeyDown={e => { if(e.key==="Enter") commitUrl(svc.id, editingUrl.value); if(e.key==="Escape") setEditingUrl(null); }}
                                      style={{ flex:1, height:28, padding:"0 8px", border:`1.5px solid ${T.primary}`, borderRadius:5, fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:T.t1, outline:"none" }}
                                    />
                                    <button onClick={() => commitUrl(svc.id, editingUrl.value)} style={{ padding:"3px 8px", background:T.primary, color:"#fff", border:"none", borderRadius:4, fontSize:11, fontWeight:600, cursor:"pointer" }}>确定</button>
                                  </div>
                                ) : (
                                  <div onClick={() => setEditingUrl({ svcId:svc.id, value:urlVal })} title="点击编辑"
                                    style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", padding:"2px 5px", borderRadius:4, minHeight:26 }}
                                    onMouseEnter={e => e.currentTarget.style.background=T.bg}
                                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                                    {urlVal
                                      ? <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:T.t2 }}>{urlVal}</span>
                                      : <span style={{ fontSize:12, color:T.t4, fontStyle:"italic" }}>点击添加</span>
                                    }
                                    <Edit2 size={11} style={{ color:T.t4, opacity:0.5, flexShrink:0, marginLeft:2 }}/>
                                  </div>
                                )}
                              </td>
                              <td style={{ padding:"9px 14px" }}>
                                <button title="复制" onClick={() => urlVal && navigator.clipboard?.writeText(urlVal)}
                                  style={{ width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center", border:"none", background:"transparent", cursor:"pointer", color:T.t4, borderRadius:4 }}
                                  onMouseEnter={e => { e.currentTarget.style.color=T.t2; e.currentTarget.style.background=T.bg; }}
                                  onMouseLeave={e => { e.currentTarget.style.color=T.t4; e.currentTarget.style.background="transparent"; }}>
                                  <Copy size={11}/>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 环境变量 section */}
                  <div style={{ display:"flex", alignItems:"center", marginBottom:10 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:T.t1, flex:1 }}>环境变量</span>
                    <button onClick={() => setAddingVar(true)} style={{ fontSize:12, color:T.primary, background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                      <Plus size={12}/>添加变量
                    </button>
                  </div>
                  <div style={{ border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                      <thead>
                        <tr style={{ background:"#FAFAFA", borderBottom:`1px solid ${T.border}` }}>
                          <th style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:T.t3, width:160 }}>变量名</th>
                          <th style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:T.t3 }}>远程值</th>
                          <th style={{ padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:600, color:T.t3, width:180 }}>本地值</th>
                          <th style={{ padding:"8px 12px", width:56 }}/>
                        </tr>
                      </thead>
                      <tbody>
                        {(envVarRows[activeId]||[]).map((v, i) => {
                          const rows = envVarRows[activeId]||[];
                          const isLast = i===rows.length-1 && !addingVar;
                          const masked = v.sensitive && !showSecret.has(v.name);
                          return (
                            <tr key={v.name} style={{ borderBottom:isLast?"none":`1px solid ${T.border}` }}>
                              <td style={{ padding:"8px 12px", fontFamily:"'JetBrains Mono',monospace", fontWeight:500, color:T.t1 }}>
                                {v.name}{v.sensitive && <Lock size={9} style={{ marginLeft:4, color:T.warning, verticalAlign:"middle" }}/>}
                              </td>
                              <td style={{ padding:"8px 12px", fontFamily:"'JetBrains Mono',monospace", color:masked?T.t4:T.t2, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {masked ? "•".repeat(16) : v.remote}
                              </td>
                              <td style={{ padding:"8px 12px", fontFamily:"'JetBrains Mono',monospace", color:T.t3 }}>
                                {v.local || <span style={{ color:T.t4, fontStyle:"italic", fontFamily:"inherit" }}>使用远程值</span>}
                              </td>
                              <td style={{ padding:"8px 12px" }}>
                                <div style={{ display:"flex", gap:2 }}>
                                  {v.sensitive && (
                                    <button onClick={() => toggleSecret(v.name)} style={{ width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", border:"none", background:"transparent", cursor:"pointer", color:T.t4, borderRadius:3 }}
                                      onMouseEnter={e => e.currentTarget.style.color=T.t2} onMouseLeave={e => e.currentTarget.style.color=T.t4}>
                                      {masked ? <Eye size={12}/> : <EyeOff size={12}/>}
                                    </button>
                                  )}
                                  <button onClick={() => setEnvVarRows(prev => ({ ...prev, [activeId]: (prev[activeId]||[]).filter((_,idx)=>idx!==i) }))}
                                    style={{ width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", border:"none", background:"transparent", cursor:"pointer", color:T.t4, borderRadius:3 }}
                                    onMouseEnter={e => { e.currentTarget.style.color=T.danger; e.currentTarget.style.background="#FFF0F0"; }}
                                    onMouseLeave={e => { e.currentTarget.style.color=T.t4; e.currentTarget.style.background="transparent"; }}>
                                    <Trash2 size={11}/>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {addingVar && (
                          <tr style={{ background:`${T.primary}04` }}>
                            <td style={{ padding:"6px 12px" }}>
                              <input autoFocus value={newVar.name} onChange={e=>setNewVar(p=>({...p,name:e.target.value}))} placeholder="变量名" style={{ width:"100%", boxSizing:"border-box", height:28, padding:"0 6px", border:`1.5px solid ${T.primary}`, borderRadius:4, fontSize:12, fontFamily:"'JetBrains Mono',monospace", outline:"none" }}/>
                            </td>
                            <td style={{ padding:"6px 12px" }}>
                              <input value={newVar.remote} onChange={e=>setNewVar(p=>({...p,remote:e.target.value}))} placeholder="远程值" style={{ width:"100%", boxSizing:"border-box", height:28, padding:"0 6px", border:`1.5px solid ${T.border}`, borderRadius:4, fontSize:12, fontFamily:"'JetBrains Mono',monospace", outline:"none" }}/>
                            </td>
                            <td style={{ padding:"6px 12px" }}>
                              <input value={newVar.local} onChange={e=>setNewVar(p=>({...p,local:e.target.value}))} placeholder="本地覆盖值（可选）" style={{ width:"100%", boxSizing:"border-box", height:28, padding:"0 6px", border:`1.5px solid ${T.border}`, borderRadius:4, fontSize:12, fontFamily:"'JetBrains Mono',monospace", outline:"none" }}/>
                            </td>
                            <td style={{ padding:"6px 12px" }}>
                              <div style={{ display:"flex", gap:4 }}>
                                <button onClick={() => {
                                  if(!newVar.name.trim()) return;
                                  setEnvVarRows(prev => ({ ...prev, [activeId]: [...(prev[activeId]||[]), {name:newVar.name.trim(), remote:newVar.remote, local:newVar.local, sensitive:false}] }));
                                  setNewVar({name:"",remote:"",local:""}); setAddingVar(false);
                                }} style={{ padding:"3px 8px", background:T.primary, color:"#fff", border:"none", borderRadius:4, fontSize:11, fontWeight:600, cursor:"pointer" }}>确定</button>
                                <button onClick={() => { setAddingVar(false); setNewVar({name:"",remote:"",local:""}); }} style={{ padding:"3px 6px", background:"transparent", color:T.t3, border:"none", cursor:"pointer", borderRadius:4 }}><X size={13}/></button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {!addingVar && (envVarRows[activeId]||[]).length===0 && (
                          <tr><td colSpan={4} style={{ padding:20, textAlign:"center", color:T.t4, fontSize:12 }}>暂无变量，点击"添加变量"创建</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div style={{ padding:"10px 20px", borderTop:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"flex-end", gap:8, flexShrink:0 }}>
            <button onClick={onClose} style={{ padding:"6px 14px", border:`1px solid ${T.border}`, borderRadius:7, background:"#fff", fontSize:13, color:T.t2, cursor:"pointer" }}>
              取消
            </button>
            <button onClick={() => handleSave(true)}
              style={{ padding:"6px 16px", border:`1px solid ${T.border}`, borderRadius:7, background:"#fff", fontSize:13, color:T.t1, fontWeight:500, cursor:"pointer" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=T.primary; e.currentTarget.style.color=T.primary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=T.border; e.currentTarget.style.color=T.t1; }}>
              保存并关闭
            </button>
            <button onClick={() => handleSave(false)}
              style={{ padding:"6px 20px", border:"none", borderRadius:7, background:T.primary, color:"#fff", fontSize:13, fontWeight:600, cursor:"pointer" }}
              onMouseEnter={e => e.currentTarget.style.filter="brightness(1.08)"} onMouseLeave={e => e.currentTarget.style.filter=""}>
              保存
            </button>
          </div>
        </div>
      </div>
    </>
  );
}


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

export function EnvDetailDrawer({ activeEnv: initEnv = "", onEnvChange, onClose }: { activeEnv?: string; onEnvChange?: (env: string) => void; onClose: () => void }) {
  const [demoState, setDemoState] = useState<EnvDrawerState>(initEnv ? "loaded" : "no-env");
  const [showSecret, setShowSecret] = useState<Set<string>>(new Set());
  const [activeEnv, setActiveEnv] = useState(initEnv);
  const [search, setSearch] = useState("");

  const handleEnvChange = (env: string) => {
    setActiveEnv(env);
    onEnvChange?.(env);
    setDemoState(env ? "loaded" : "no-env");
  };

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
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <select value={activeEnv} onChange={e => handleEnvChange(e.target.value)}
                style={{ width: "100%", height: 36, padding: "0 32px 0 10px", border: `1.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: activeEnv ? T.t1 : T.t4, outline: "none", background: "#fff", appearance: "none", cursor: "pointer" }}>
                <option value="">— 不使用环境 —</option>
                <option value="测试环境">测试环境</option>
                <option value="预发布环境">预发布环境</option>
                <option value="生产环境">生产环境</option>
                <option value="开发环境" disabled>开发环境（已停用）</option>
              </select>
              <ChevronDown size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: T.t4, pointerEvents: "none" }}/>
            </div>
            <button title="刷新变量" style={{ width: 34, height: 36, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", cursor: "pointer", color: T.t2, flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.primary} onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
              <RefreshCw size={13}/>
            </button>
            <button title="前往环境管理" style={{ width: 34, height: 36, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.border}`, borderRadius: 8, background: "#fff", cursor: "pointer", color: T.t2, flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.primary} onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
              <ExternalLink size={13}/>
            </button>
          </div>
          {/* Demo state switcher */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {ENV_DEMO.map(d => (
              <button key={d.value} onClick={() => setDemoState(d.value)}
                style={{ padding: "3px 9px", borderRadius: 5, fontSize: 11, fontWeight: 500, cursor: "pointer", border: `1px solid ${demoState === d.value ? T.primary : T.border}`, background: demoState === d.value ? `${T.primary}10` : "#fff", color: demoState === d.value ? T.primary : T.t3 }}>
                {d.label}
              </button>
            ))}
          </div>
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

type AuthType = "no-auth"|"bearer"|"basic"|"api-key"|"digest";

const AUTH_TYPES: { key: AuthType; label: string }[] = [
  { key: "no-auth", label: "No Auth" },
  { key: "bearer",  label: "Bearer Token" },
  { key: "basic",   label: "Basic Auth" },
  { key: "api-key", label: "API Key" },
  { key: "digest",  label: "Digest Auth" },
];

export function AuthConfigSection() {
  const [authType, setAuthType]               = useState<AuthType>("bearer");
  const [bearerToken, setBearerToken]         = useState("{{access_token}}");
  const [showBearer, setShowBearer]           = useState(false);
  const [basicUser, setBasicUser]             = useState("admin@company.com");
  const [basicPass, setBasicPass]             = useState("Str0ng!Pass#2026");
  const [showPass, setShowPass]               = useState(false);
  const [apiKeyName, setApiKeyName]           = useState("X-API-Key");
  const [apiKeyValue, setApiKeyValue]         = useState("{{API_SECRET_KEY}}");
  const [apiKeyLocation, setApiKeyLocation]   = useState<"header"|"query">("header");
  const [showApiKey, setShowApiKey]           = useState(false);
  const [digestUser, setDigestUser]           = useState("{{digest_username}}");
  const [digestPass, setDigestPass]           = useState("{{digest_password}}");
  const [showDigestPass, setShowDigestPass]   = useState(false);

  const inputCls: React.CSSProperties = { flex: 1, border: "none", outline: "none", padding: "8px 12px", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", color: T.t1 };
  const fieldBox: React.CSSProperties = { display: "flex", alignItems: "center", border: `1.5px solid ${T.border}`, borderRadius: 7, overflow: "hidden" };
  const eyeBtn: React.CSSProperties  = { padding: "0 10px", background: "none", border: "none", cursor: "pointer", color: T.t3 };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
      {/* Type selector */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, background: T.bg, borderRadius: 8, padding: 3, width: "fit-content" }}>
        {AUTH_TYPES.map(t => (
          <button key={t.key} onClick={() => setAuthType(t.key)}
            style={{ padding: "4px 14px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: authType === t.key ? "#fff" : "transparent",
              color: authType === t.key ? T.primary : T.t3,
              boxShadow: authType === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* No Auth */}
      {authType === "no-auth" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 40, gap: 10 }}>
          <Shield size={36} style={{ opacity: 0.2, color: T.t3 }}/>
          <div style={{ fontSize: 14, fontWeight: 500, color: T.t2 }}>不启用认证助手</div>
          <div style={{ fontSize: 12, color: T.t4, textAlign: "center", lineHeight: 1.8, maxWidth: 340 }}>
            不通过 Auth 自动添加认证信息。<br/>
            你仍可在 Headers 或 Params 中手动配置，<br/>
            已填写的 Header 不会因此被移除。
          </div>
        </div>
      )}

      {/* Bearer Token */}
      {authType === "bearer" && (
        <div style={{ maxWidth: 520 }}>
          <AlertBanner type="info">
            只需填写 Token 值，无需加 <code style={{ fontFamily: "monospace", fontSize: 11 }}>Bearer </code> 前缀，发送时自动拼接为 <code style={{ fontFamily: "monospace", fontSize: 11 }}>Authorization: Bearer &lt;token&gt;</code>。
          </AlertBanner>
          <FLabel required>Token</FLabel>
          <div style={{ ...fieldBox, marginBottom: 12 }}>
            <input type={showBearer ? "text" : "password"} value={bearerToken} onChange={e => setBearerToken(e.target.value)}
              placeholder="输入 Token 或使用 {{变量名}}"
              style={inputCls}/>
            <button onClick={() => setShowBearer(v => !v)} style={eyeBtn}>{showBearer ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
          </div>
          <div style={{ fontSize: 12, color: T.t4, lineHeight: 1.9 }}>
            支持直接输入明文 Token，或使用 <code style={{ fontFamily: "monospace", fontSize: 11, color: T.primary }}>{"{{变量名}}"}</code> 引用环境变量、变量集或场景前序步骤的提取值。<br/>
            <span style={{ color: T.t3 }}>编辑时未找到的变量将显示原始占位符，执行时自动解析，不代表配置有误。</span>
          </div>
        </div>
      )}

      {/* Basic Auth */}
      {authType === "basic" && (
        <div style={{ maxWidth: 520 }}>
          <AlertBanner type="info">
            Basic Auth 将用户名和密码 Base64 编码后作为 <code style={{ fontFamily: "monospace", fontSize: 11 }}>Authorization: Basic &lt;base64&gt;</code> 发送。Base64 可被还原，请勿在不安全信道使用。
          </AlertBanner>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <FLabel required>用户名</FLabel>
              <div style={fieldBox}>
                <User size={13} style={{ color: T.t4, marginLeft: 10, flexShrink: 0 }}/>
                <input value={basicUser} onChange={e => setBasicUser(e.target.value)} placeholder="username 或 {{变量}}"
                  style={{ ...inputCls, fontFamily: "inherit" }}/>
              </div>
            </div>
            <div>
              <FLabel required>密码</FLabel>
              <div style={fieldBox}>
                <Key size={13} style={{ color: T.t4, marginLeft: 10, flexShrink: 0 }}/>
                <input type={showPass ? "text" : "password"} value={basicPass} onChange={e => setBasicPass(e.target.value)} placeholder="password 或 {{变量}}"
                  style={inputCls}/>
                <button onClick={() => setShowPass(v => !v)} style={eyeBtn}>{showPass ? <EyeOff size={13}/> : <Eye size={13}/>}</button>
              </div>
            </div>
          </div>
          <div style={{ padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 7, background: T.bg }}>
            <div style={{ fontSize: 11, color: T.t3, marginBottom: 4 }}>发送预览（脱敏）</div>
            <code style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: T.t2 }}>
              Authorization: Basic ******
            </code>
          </div>
        </div>
      )}

      {/* API Key */}
      {authType === "api-key" && (
        <div style={{ maxWidth: 520 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <FLabel required>Header / 参数名</FLabel>
              <input value={apiKeyName} onChange={e => setApiKeyName(e.target.value)} placeholder="X-API-Key"
                style={{ width: "100%", boxSizing: "border-box" as const, height: 36, padding: "0 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none" }}/>
            </div>
            <div>
              <FLabel required>注入位置</FLabel>
              <div style={{ display: "flex", gap: 2, background: T.bg, borderRadius: 6, padding: 2 }}>
                {(["header", "query"] as const).map(loc => (
                  <button key={loc} onClick={() => setApiKeyLocation(loc)}
                    style={{ flex: 1, padding: "5px 0", borderRadius: 5, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      background: apiKeyLocation === loc ? "#fff" : "transparent",
                      color: apiKeyLocation === loc ? T.primary : T.t3,
                      boxShadow: apiKeyLocation === loc ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
                    {loc === "header" ? "Header" : "Query Param"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <FLabel required>API Key 值</FLabel>
          <div style={{ ...fieldBox, marginBottom: 10 }}>
            <input type={showApiKey ? "text" : "password"} value={apiKeyValue} onChange={e => setApiKeyValue(e.target.value)}
              placeholder="输入 Key 或使用 {{变量名}}"
              style={inputCls}/>
            <button onClick={() => setShowApiKey(v => !v)} style={eyeBtn}>{showApiKey ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
          </div>
          <div style={{ fontSize: 12, color: T.t4, marginBottom: 8 }}>
            将以 <code style={{ fontFamily: "monospace", fontSize: 11, color: T.primary }}>{apiKeyLocation === "header" ? `${apiKeyName}: <value>` : `?${apiKeyName}=<value>`}</code> 的方式注入请求。
          </div>
          {apiKeyLocation === "query" && (
            <AlertBanner type="warn">
              Query 方式会将密钥暴露在 URL、访问日志和请求报告中，存在泄露风险。优先使用 Header，除非被测接口明确要求 Query 传参。
            </AlertBanner>
          )}
          <AlertBanner type="info">
            若 Headers 或 Params 中已存在同名字段 <code style={{ fontFamily: "monospace", fontSize: 11 }}>{apiKeyName}</code>，发送时将以此处配置为准，不会同时发送两份。
          </AlertBanner>
        </div>
      )}

      {/* Digest Auth */}
      {authType === "digest" && (
        <div style={{ maxWidth: 520 }}>
          <AlertBanner type="info">
            Digest Auth 通过质询-响应机制发送凭据，密码不会以明文传输。发送时客户端自动处理 nonce 握手。
          </AlertBanner>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <FLabel required>用户名</FLabel>
              <div style={fieldBox}>
                <User size={13} style={{ color: T.t4, marginLeft: 10, flexShrink: 0 }}/>
                <input value={digestUser} onChange={e => setDigestUser(e.target.value)} placeholder="username 或 {{变量}}"
                  style={{ ...inputCls, fontFamily: "inherit" }}/>
              </div>
            </div>
            <div>
              <FLabel required>密码</FLabel>
              <div style={fieldBox}>
                <Key size={13} style={{ color: T.t4, marginLeft: 10, flexShrink: 0 }}/>
                <input type={showDigestPass ? "text" : "password"} value={digestPass} onChange={e => setDigestPass(e.target.value)} placeholder="password 或 {{变量}}"
                  style={inputCls}/>
                <button onClick={() => setShowDigestPass(v => !v)} style={eyeBtn}>{showDigestPass ? <EyeOff size={13}/> : <Eye size={13}/>}</button>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: T.t4, lineHeight: 1.8 }}>
            支持使用 <code style={{ fontFamily: "monospace", fontSize: 11, color: T.primary }}>{"{{变量名}}"}</code> 引用环境变量或提取值。Runner 执行时自动完成质询握手，无需手动处理 nonce。
          </div>
        </div>
      )}
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
// 7. SettingsPanel — 接口请求设置面板
// ─────────────────────────────────────────────────────────────────────────────

const CONN_DEFAULT  = 30000;
const RESP_DEFAULT  = 60000;
const REDIR_DEFAULT = true;
const MIN_TIMEOUT   = 1000;
const STEP          = 1000;

type DisabledReason = "loading"|"saving"|"no-permission"|null;

// Compact stepper input: [−] [value] [+]
function TimeoutStepper({
  label, value, onChange, disabled, error,
}: {
  label: string; value: number; onChange: (v: number) => void;
  disabled?: boolean; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw]         = useState(String(value));

  const prevValue = useRef(value);
  if (prevValue.current !== value && !focused) {
    prevValue.current = value;
    setRaw(String(value));
  }

  const borderColor = error ? T.danger : focused ? T.primary : T.border;

  const commit = (str: string) => {
    const n = parseInt(str, 10);
    if (!isNaN(n) && n >= MIN_TIMEOUT) { onChange(n); }
    else if (!isNaN(n) && n < MIN_TIMEOUT) { onChange(MIN_TIMEOUT); setRaw(String(MIN_TIMEOUT)); }
  };

  const doStep = (delta: number) => {
    const next = Math.max(MIN_TIMEOUT, value + delta);
    setRaw(String(next));
    onChange(next);
  };

  const stepBtn: React.CSSProperties = {
    width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
    background: disabled ? T.bg : "#fff", border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? T.t4 : T.t3, flexShrink: 0, borderRadius: 0,
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: disabled ? T.t4 : T.t2, marginBottom: 5 }}>{label}</div>
      <div style={{
        display: "inline-flex", alignItems: "center",
        border: `1px solid ${borderColor}`, borderRadius: 6,
        background: disabled ? T.bg : "#fff",
        overflow: "hidden", transition: "border-color .15s", height: 28,
      }}>
        <button
          style={stepBtn} disabled={disabled}
          onMouseEnter={e => { if (!disabled) { e.currentTarget.style.color = T.primary; e.currentTarget.style.background = `${T.primary}0A`; } }}
          onMouseLeave={e => { e.currentTarget.style.color = disabled ? T.t4 : T.t3; e.currentTarget.style.background = disabled ? T.bg : "#fff"; }}
          onClick={() => doStep(-STEP)}
        >
          <svg width="8" height="2" viewBox="0 0 8 2" fill="currentColor"><rect width="8" height="2" rx="1"/></svg>
        </button>
        <div style={{ width: 1, height: 16, background: T.border, flexShrink: 0 }}/>
        <input
          type="text" inputMode="numeric"
          value={focused ? raw : String(value)}
          disabled={disabled}
          onFocus={() => { setFocused(true); setRaw(String(value)); }}
          onBlur={() => { setFocused(false); commit(raw); }}
          onChange={e => setRaw(e.target.value)}
          style={{
            width: 64, border: "none", outline: "none", textAlign: "center",
            fontSize: 12, color: disabled ? T.t4 : T.t1, background: "transparent",
            padding: "0 4px", height: "100%",
          }}
        />
        <div style={{ width: 1, height: 16, background: T.border, flexShrink: 0 }}/>
        <button
          style={stepBtn} disabled={disabled}
          onMouseEnter={e => { if (!disabled) { e.currentTarget.style.color = T.primary; e.currentTarget.style.background = `${T.primary}0A`; } }}
          onMouseLeave={e => { e.currentTarget.style.color = disabled ? T.t4 : T.t3; e.currentTarget.style.background = disabled ? T.bg : "#fff"; }}
          onClick={() => doStep(+STEP)}
        >
          <Plus size={9}/>
        </button>
      </div>
      {error && (
        <div style={{ fontSize: 11, color: T.danger, marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}>
          <AlertCircle size={9}/>{error}
        </div>
      )}
    </div>
  );
}

// Demo bar for cycling disabled/loading states
type SettingsDemoMode = "normal"|"loading"|"saving"|"no-permission";
const SETTINGS_DEMO_MODES: { value: SettingsDemoMode; label: string }[] = [
  { value: "normal",        label: "正常" },
  { value: "loading",       label: "加载中" },
  { value: "saving",        label: "保存中" },
  { value: "no-permission", label: "无权限" },
];

export function SettingsPanel() {
  const [demo,        setDemo]        = useState<SettingsDemoMode>("normal");
  const [connTimeout, setConnTimeout] = useState(CONN_DEFAULT);
  const [respTimeout, setRespTimeout] = useState(RESP_DEFAULT);
  const [redirect,    setRedirect]    = useState(REDIR_DEFAULT);
  const [connError,   setConnError]   = useState<string|undefined>();
  const [respError,   setRespError]   = useState<string|undefined>();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const disabled = demo !== "normal";

  const validateConn = (v: number) => v < MIN_TIMEOUT ? `最小值 ${MIN_TIMEOUT} ms` : undefined;
  const validateResp = (v: number) => v < MIN_TIMEOUT ? `最小值 ${MIN_TIMEOUT} ms` : undefined;

  const handleConnChange = (v: number) => { setConnTimeout(v); setConnError(validateConn(v)); };
  const handleRespChange = (v: number) => { setRespTimeout(v); setRespError(validateResp(v)); };

  const handleReset = () => setShowResetConfirm(true);
  const handleConfirmReset = () => {
    setConnTimeout(CONN_DEFAULT); setConnError(undefined);
    setRespTimeout(RESP_DEFAULT); setRespError(undefined);
    setRedirect(REDIR_DEFAULT);
    setShowResetConfirm(false);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* demo bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 16px", borderBottom: `1px solid ${T.border}`, background: T.bg, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: T.t4, marginRight: 2 }}>状态预览</span>
        {SETTINGS_DEMO_MODES.map(m => (
          <button key={m.value} onClick={() => setDemo(m.value)}
            style={{ height: 20, padding: "0 8px", borderRadius: 4,
              border: `1px solid ${demo === m.value ? T.primary : T.border}`,
              background: demo === m.value ? `${T.primary}0F` : "#fff",
              color: demo === m.value ? T.primary : T.t3, fontSize: 11, cursor: "pointer" }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

        {/* loading skeleton */}
        {demo === "loading" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ height: 12, width: 72, borderRadius: 4, background: T.border }}/>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ height: 28, width: 120, borderRadius: 6, background: T.border }}/>
              <div style={{ height: 28, width: 120, borderRadius: 6, background: T.border }}/>
            </div>
            <div style={{ height: 12, width: 48, borderRadius: 4, background: T.border, marginTop: 8 }}/>
            <div style={{ height: 16, width: 110, borderRadius: 4, background: T.border }}/>
          </div>
        ) : (
          <>
            {/* no-permission notice */}
            {demo === "no-permission" && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 10px",
                border: `1px solid ${T.warning}50`, borderRadius: 6,
                background: `${T.warning}08`, marginBottom: 14 }}>
                <Lock size={12} style={{ color: T.warning, flexShrink: 0 }}/>
                <span style={{ fontSize: 12, color: T.t2 }}>你没有编辑此接口的权限，以下配置为只读</span>
              </div>
            )}

            {/* ── 超时 ── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: T.t3, marginBottom: 10 }}>超时（ms）</div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <TimeoutStepper label="连接超时" value={connTimeout} onChange={handleConnChange} disabled={disabled} error={connError}/>
                <TimeoutStepper label="响应超时" value={respTimeout} onChange={handleRespChange} disabled={disabled} error={respError}/>
              </div>
            </div>

            {/* ── 重定向 ── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: T.t3, marginBottom: 10 }}>重定向</div>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
              }}>
                <input
                  type="checkbox"
                  checked={redirect}
                  disabled={disabled}
                  onChange={e => !disabled && setRedirect(e.target.checked)}
                  style={{ width: 14, height: 14, cursor: disabled ? "not-allowed" : "pointer", accentColor: T.primary }}
                />
                <span style={{ fontSize: 13, color: T.t1 }}>自动跟随重定向</span>
                <span style={{ fontSize: 11, color: T.t4 }}>（301 / 302 / 307 / 308）</span>
              </label>
            </div>

            {/* ── 恢复默认 ── */}
            {!showResetConfirm ? (
              <button
                onClick={handleReset} disabled={disabled}
                style={{ fontSize: 12, color: disabled ? T.t4 : T.t3, background: "none", border: "none",
                  cursor: disabled ? "not-allowed" : "pointer", padding: 0 }}
                onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = T.primary; }}
                onMouseLeave={e => { if (!disabled) e.currentTarget.style.color = T.t3; }}
              >
                恢复默认值
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: T.t2 }}>确认恢复默认值？</span>
                <button onClick={() => setShowResetConfirm(false)}
                  style={{ fontSize: 12, color: T.t3, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  取消
                </button>
                <button onClick={handleConfirmReset}
                  style={{ fontSize: 12, color: T.danger, background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 500 }}>
                  确认
                </button>
              </div>
            )}
          </>
        )}
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
// 9. JsonSchemaPanel — API 接口定义 (定义 tab)
// ─────────────────────────────────────────────────────────────────────────────

type DefField = {
  name: string;
  type: string;
  required: boolean;
  desc: string;
  path?: string;
  parentId?: string;
  id?: string;
  isObject?: boolean;
};

const REQ_FIELDS: DefField[] = [
  { name:"encryptParam",   type:"string",           required:false, desc:"加密请求" },
  { name:"timestamp",      type:"integer (int64)",   required:false, desc:"请求时间戳" },
  { name:"unifiedUserId",  type:"integer (int64)",   required:false, desc:"客户ID" },
  { name:"unifiedId",      type:"integer (int64)",   required:false, desc:"好人好股ID" },
  { name:"uid",            type:"string",            required:false, desc:"可能是客户ID，也可能是好人好股ID。" },
  { name:"couponOrderId",  type:"string",            required:true,  desc:"优惠券订单流水号" },
];

const RES_FIELDS_200: DefField[] = [
  { name:"code",          type:"integer (int32)", required:false, desc:"编码 0表示成功，其他值表示失败" },
  { name:"msg",           type:"string",          required:false, desc:"消息内容" },
  { name:"data",          type:"object",          required:false, desc:"响应数据",   id:"data", isObject:true },
  { name:"couponOrderId", type:"string",          required:false, desc:"优惠券订单ID",   path:"data.couponOrderId", parentId:"data" },
  { name:"couponName",    type:"string",          required:false, desc:"优惠券名称",     path:"data.couponName",    parentId:"data" },
  { name:"thirdPayId",    type:"string",          required:false, desc:"第三方交易单号", path:"data.thirdPayId",    parentId:"data" },
  { name:"price",         type:"number",          required:false, desc:"优惠券金额",     path:"data.price",         parentId:"data" },
  { name:"payTime",       type:"string (date-time)", required:false, desc:"支付成功时间",   path:"data.payTime",       parentId:"data" },
  { name:"createTime",    type:"string (date-time)", required:false, desc:"订单创建时间",   path:"data.createTime",    parentId:"data" },
  { name:"serverTime",    type:"string (date-time)", required:false, desc:"服务时间",       path:"data.serverTime",    parentId:"data" },
  { name:"traceId",       type:"string",          required:false, desc:"请求追踪ID-便于线上调试", path:"data.traceId",   parentId:"data" },
];

const RES_FIELDS_400: DefField[] = [
  { name:"code",    type:"integer (int32)", required:false, desc:"错误码，如 400001 参数缺失" },
  { name:"message", type:"string",          required:false, desc:"错误说明" },
];

const RES_FIELDS_401: DefField[] = [
  { name:"code",    type:"integer (int32)", required:false, desc:"401 未授权" },
  { name:"message", type:"string",          required:false, desc:"请重新登录" },
];

const RES_FIELDS_500: DefField[] = [
  { name:"code",    type:"integer (int32)", required:false, desc:"服务端错误码" },
  { name:"message", type:"string",          required:false, desc:"错误信息" },
  { name:"traceId", type:"string",          required:false, desc:"用于排查问题的 trace ID" },
];

const RES_MAP: Record<string, DefField[]> = {
  "200": RES_FIELDS_200,
  "400": RES_FIELDS_400,
  "401": RES_FIELDS_401,
  "500": RES_FIELDS_500,
};

function typeColor(type: string): string {
  if (type.startsWith("string"))  return "#165DFF";
  if (type.startsWith("integer") || type.startsWith("number")) return "#00B42A";
  if (type === "object")          return "#7816FF";
  if (type === "boolean")         return "#0FC6C2";
  if (type.startsWith("array"))   return "#FF7D00";
  return "#4E5969";
}

const COL_WIDTHS = { name:320, type:160, req:70, desc:1, example:140 };

function DefTableHeader() {
  return (
    <div style={{
      display:"flex", alignItems:"center",
      padding:"0 16px",
      background:T.bg,
      borderBottom:`1px solid ${T.border}`,
      height:36, flexShrink:0,
    }}>
      <div style={{width:COL_WIDTHS.name, fontSize:12, color:T.t3, fontWeight:500, flexShrink:0}}>参数名</div>
      <div style={{width:COL_WIDTHS.type, fontSize:12, color:T.t3, fontWeight:500, flexShrink:0}}>类型</div>
      <div style={{width:COL_WIDTHS.req,  fontSize:12, color:T.t3, fontWeight:500, flexShrink:0}}>必填</div>
      <div style={{flex:1,               fontSize:12, color:T.t3, fontWeight:500}}>说明</div>
      <div style={{width:COL_WIDTHS.example, fontSize:12, color:T.t3, fontWeight:500, textAlign:"right", flexShrink:0}}>示例/规则</div>
    </div>
  );
}

function DefTableRow({ field, depth=0, expanded, onToggle }: {
  field: DefField; depth?: number; expanded?: boolean; onToggle?: ()=>void;
}) {
  const indent = depth * 20;
  const isExpandable = field.isObject;
  return (
    <div style={{
      display:"flex", alignItems:"flex-start",
      padding:"9px 16px",
      borderBottom:"1px solid #F2F3F5",
      background:"#fff",
      transition:"background 0.1s",
    }}
    onMouseEnter={e=>(e.currentTarget.style.background=T.bg)}
    onMouseLeave={e=>(e.currentTarget.style.background="#fff")}
    >
      {/* Name */}
      <div style={{width:COL_WIDTHS.name, flexShrink:0, paddingLeft:indent, display:"flex", alignItems:"center", gap:5, minWidth:0}}>
        {isExpandable&&(
          <button onClick={onToggle} style={{
            border:"none", background:"none", padding:0, cursor:"pointer",
            color:T.t3, display:"flex", alignItems:"center", flexShrink:0,
            transition:"transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}>
            <ChevronRight size={13}/>
          </button>
        )}
        {!isExpandable && depth > 0 && (
          <span style={{width:13, flexShrink:0}}/>
        )}
        <span style={{
          fontSize:13, color:T.primary, fontFamily:"'JetBrains Mono',monospace",
          fontWeight:600, whiteSpace:"nowrap",
        }}>{field.name}</span>
        {field.path&&(
          <span style={{
            fontSize:11, color:T.t4, fontFamily:"'JetBrains Mono',monospace",
            whiteSpace:"nowrap", marginLeft:2,
          }}>{field.path}</span>
        )}
      </div>
      {/* Type */}
      <div style={{width:COL_WIDTHS.type, flexShrink:0}}>
        <span style={{
          fontSize:12, color:typeColor(field.type),
          fontFamily:"'JetBrains Mono',monospace", fontWeight:600,
        }}>{field.type}</span>
      </div>
      {/* Required */}
      <div style={{width:COL_WIDTHS.req, flexShrink:0}}>
        {field.required
          ? <span style={{fontSize:12, color:T.warning, fontWeight:600}}>必需</span>
          : <span style={{fontSize:12, color:T.t4}}>可选</span>
        }
      </div>
      {/* Desc */}
      <div style={{flex:1, fontSize:12, color:T.t2, lineHeight:1.6, paddingRight:12}}>
        {field.desc || "-"}
      </div>
      {/* Example */}
      <div style={{width:COL_WIDTHS.example, flexShrink:0, textAlign:"right"}}>
        <span style={{fontSize:12, color:T.t4}}>-</span>
      </div>
    </div>
  );
}

function ViewToggle({ value, onChange }: { value:"schema"|"json"; onChange:(v:"schema"|"json")=>void }) {
  return (
    <div style={{display:"flex", alignItems:"center", gap:12}}>
      {(["schema","json"] as const).map(v=>(
        <button key={v} onClick={()=>onChange(v)} style={{
          border:"none", background:"none", padding:0, cursor:"pointer",
          fontSize:12, fontWeight: value===v ? 600 : 400,
          color: value===v ? T.warning : T.t3,
        }}>
          {v==="schema"?"Schema":"JSON"}
        </button>
      ))}
    </div>
  );
}

export function JsonSchemaPanel() {
  const [reqView,   setReqView]   = useState<"schema"|"json">("schema");
  const [resView,   setResView]   = useState<"schema"|"json">("schema");
  const [activeCode, setActiveCode] = useState<"200"|"400"|"401"|"500">("200");
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set(["data"]));

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const resFields = RES_MAP[activeCode] ?? [];

  const visibleResFields = resFields.filter(f =>
    !f.parentId || expanded.has(f.parentId)
  );

  const STATUS_CODES = ["200","400","401","500"] as const;
  const STATUS_COLOR: Record<string,string> = { "200":T.warning, "400":T.danger, "401":T.danger, "500":T.danger };

  // JSON view body strings
  const REQ_JSON = `{
  "encryptParam": "string",
  "timestamp": 0,
  "unifiedUserId": 0,
  "unifiedId": 0,
  "uid": "string",
  "couponOrderId": "string"
}`;

  const RES_JSON_200 = `{
  "code": 0,
  "msg": "string",
  "data": {
    "couponOrderId": "string",
    "couponName": "string",
    "thirdPayId": "string",
    "price": 0,
    "payTime": "2024-01-01T00:00:00Z",
    "createTime": "2024-01-01T00:00:00Z",
    "serverTime": "2024-01-01T00:00:00Z",
    "traceId": "string"
  }
}`;

  return (
    <div style={{flex:1, overflow:"auto", background:"#fff", position:"relative"}}>

      {/* ── API overview ──────────────────────────────── */}
      <div style={{padding:"16px 20px 14px", borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <span style={{
            fontSize:12, fontWeight:700, padding:"2px 8px", borderRadius:5,
            background:"#FF7D0020", color:T.warning, letterSpacing:0.5,
          }}>POST</span>
          <span style={{fontSize:15, fontWeight:600, color:T.t1}}>订单详情</span>
          <div style={{flex:1}}/>
          <span style={{
            fontSize:12, color:T.t3, fontFamily:"'JetBrains Mono',monospace",
          }}>/c/coupon/order/detail</span>
        </div>
        <div style={{fontSize:12, color:T.t4, marginTop:7, lineHeight:1.6}}>暂无接口描述</div>
      </div>

      {/* ── 请求参数 ──────────────────────────────────── */}
      <div style={{padding:"0 20px"}}>
        <div style={{
          display:"flex", alignItems:"center",
          padding:"12px 0 8px",
        }}>
          <span style={{fontSize:14, fontWeight:600, color:T.t1}}>请求参数</span>
        </div>

        {/* Body 参数 subsection */}
        <div style={{marginTop:6}}>
          <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
            {/* Section title row — inside the card */}
            <div style={{display:"flex",alignItems:"center",height:36,padding:"0 16px",borderBottom:`1px solid ${T.border}`,background:"#fff"}}>
              <span style={{fontSize:13,fontWeight:600,color:T.t2,flex:1}}>Body 参数</span>
              <ViewToggle value={reqView} onChange={setReqView}/>
            </div>
            {reqView==="schema" ? (
              <>
                <DefTableHeader/>
                {REQ_FIELDS.map((f,i)=>(
                  <DefTableRow key={i} field={f}/>
                ))}
              </>
            ) : (
              <pre style={{
                margin:0, padding:"14px 16px",
                fontFamily:"'JetBrains Mono',monospace",
                fontSize:12, lineHeight:1.8, color:T.t1,
                background:"#FAFBFF",
              }}>{REQ_JSON}</pre>
            )}
          </div>
        </div>
      </div>

      {/* ── 返回响应 ──────────────────────────────────── */}
      <div style={{padding:"0 20px", marginTop:24, paddingBottom:40}}>
        <div style={{
          display:"flex", alignItems:"center",
          padding:"12px 0 8px",
        }}>
          <span style={{fontSize:14, fontWeight:600, color:T.t1, flex:1}}>返回响应</span>
          {/* Status code tabs */}
          <div style={{display:"flex", gap:4}}>
            {STATUS_CODES.map(code=>{
              const active = code===activeCode;
              const col = STATUS_COLOR[code];
              return (
                <button key={code} onClick={()=>setActiveCode(code)} style={{
                  padding:"3px 12px", border:"none", borderRadius:5,
                  background: active ? col : T.bg,
                  color: active ? "#fff" : T.t3,
                  fontSize:13, fontWeight: active ? 700 : 400,
                  cursor:"pointer", transition:"all 0.15s",
                }}>
                  {code}
                </button>
              );
            })}
          </div>
        </div>

        {/* 响应 Body subsection */}
        <div style={{marginTop:6}}>
          <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
            {/* Section title row — inside the card */}
            <div style={{display:"flex",alignItems:"center",height:36,padding:"0 16px",borderBottom:`1px solid ${T.border}`,background:"#fff"}}>
              <span style={{fontSize:13,fontWeight:600,color:T.t2,flex:1}}>响应 Body</span>
              <ViewToggle value={resView} onChange={setResView}/>
            </div>
            {resView==="schema" ? (
              <>
                <DefTableHeader/>
                {visibleResFields.map((f,i)=>{
                  const depth = f.parentId ? 1 : 0;
                  const isExp = f.id ? expanded.has(f.id) : false;
                  return (
                    <DefTableRow
                      key={i}
                      field={f}
                      depth={depth}
                      expanded={isExp}
                      onToggle={f.id ? ()=>toggleExpand(f.id!) : undefined}
                    />
                  );
                })}
              </>
            ) : (
              <pre style={{
                margin:0, padding:"14px 16px",
                fontFamily:"'JetBrains Mono',monospace",
                fontSize:12, lineHeight:1.8, color:T.t1,
                background:"#FAFBFF",
              }}>{activeCode==="200"?RES_JSON_200:`{
  "code": ${activeCode},
  "message": "Error description"
}`}</pre>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
