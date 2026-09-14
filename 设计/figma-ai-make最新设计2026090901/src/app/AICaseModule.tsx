import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText, Upload, FolderOpen, CheckCircle, XCircle, AlertTriangle,
  Sparkles, Clock, RefreshCw, ChevronRight, ChevronDown, X, Check,
  Eye, ArrowRight, Zap, Activity, Search, Filter, Info,
  StopCircle, BookOpen, AlertCircle, Loader2, RotateCcw,
  ThumbsUp, ThumbsDown, ChevronUp, Play, ArrowUpRight,
} from "lucide-react";

const T = {
  primary: "#165DFF", success: "#00B42A", warning: "#FF7D00",
  danger: "#F53F3F", purple: "#7816FF", cyan: "#0FC6C2",
  slate: "#4E5969", bg: "#F2F3F5", border: "#E5E6EB",
  t1: "#1D2129", t2: "#4E5969", t3: "#86909C", t4: "#C9CDD4",
};

type PageState = "idle" | "generating" | "results" | "failed";
type InputMode = "manual" | "upload";
type OutputMode = "stream" | "complete";
type UploadState = "empty" | "uploading" | "parsing" | "done" | "error";

interface AiCase {
  id: string; name: string; module: string;
  type: "功能测试" | "边界测试" | "异常测试" | "性能测试" | "安全测试";
  priority: "P0" | "P1" | "P2" | "P3";
  precondition: string; steps: string[]; expected: string;
  tags: string[]; reviewScore: number; reviewSuggestion: string;
  reviewPassed: boolean; adopted: boolean; discarded: boolean;
}

interface RecentTask {
  id: string; reqTitle: string; source: InputMode;
  status: "running" | "done" | "failed";
  genCount: number; adoptCount: number; updatedAt: string;
}

const RECENT_TASKS: RecentTask[] = [
  { id: "rt1", reqTitle: "用户登录与认证流程", source: "manual", status: "running", genCount: 8, adoptCount: 0, updatedAt: "进行中" },
  { id: "rt2", reqTitle: "订单创建完整业务流", source: "upload", status: "done", genCount: 14, adoptCount: 11, updatedAt: "2026-07-31 16:45" },
  { id: "rt3", reqTitle: "支付失败重试机制", source: "manual", status: "failed", genCount: 0, adoptCount: 0, updatedAt: "2026-07-30 10:20" },
];

const MOCK_AI_CASES: AiCase[] = [
  { id: "ac1", name: "正常用户名密码登录成功", module: "登录", type: "功能测试", priority: "P0", precondition: "用户已注册，账号处于正常状态", steps: ["打开登录页面", "输入正确用户名和密码", "点击登录按钮", "等待跳转"], expected: "成功跳转至首页，显示用户昵称", tags: ["登录", "核心流程"], reviewScore: 92, reviewSuggestion: "建议补充断言：验证 token 有效期", reviewPassed: true, adopted: false, discarded: false },
  { id: "ac2", name: "密码错误提示与账号锁定", module: "登录", type: "异常测试", priority: "P1", precondition: "用户账号存在且未被锁定", steps: ["连续输入错误密码 5 次", "观察提示信息", "第 6 次输入"], expected: "显示锁定提示，发送邮件通知", tags: ["登录", "安全"], reviewScore: 88, reviewSuggestion: "", reviewPassed: true, adopted: false, discarded: false },
  { id: "ac3", name: "空用户名提交校验", module: "登录", type: "边界测试", priority: "P2", precondition: "无", steps: ["打开登录页", "不填用户名，填写密码", "点击登录"], expected: "用户名输入框显示「请输入用户名」提示，不发起请求", tags: ["表单校验"], reviewScore: 76, reviewSuggestion: "建议同时测试用户名含空格场景", reviewPassed: true, adopted: false, discarded: false },
  { id: "ac4", name: "记住密码功能", module: "登录", type: "功能测试", priority: "P2", precondition: "浏览器支持 Cookie", steps: ["勾选「记住密码」", "完成登录", "关闭浏览器重新打开"], expected: "用户名和密码自动填入，可直接点击登录", tags: ["记住密码"], reviewScore: 65, reviewSuggestion: "安全风险：建议评估密码加密存储是否合规", reviewPassed: false, adopted: false, discarded: false },
  { id: "ac5", name: "第三方 OAuth 登录", module: "登录", type: "功能测试", priority: "P1", precondition: "已在设置中绑定第三方账号", steps: ["点击「使用微信登录」", "完成微信授权", "返回应用"], expected: "自动创建/关联账号并跳转首页", tags: ["OAuth", "第三方"], reviewScore: 89, reviewSuggestion: "", reviewPassed: true, adopted: false, discarded: false },
  { id: "ac6", name: "Token 过期强制退出", module: "会话", type: "安全测试", priority: "P0", precondition: "用户已登录", steps: ["修改系统时间超出 token 有效期", "执行任意需登录的操作"], expected: "系统自动跳回登录页，提示登录已过期", tags: ["会话", "安全"], reviewScore: 91, reviewSuggestion: "", reviewPassed: true, adopted: false, discarded: false },
  { id: "ac7", name: "并发登录限制", module: "会话", type: "安全测试", priority: "P1", precondition: "已配置单设备登录限制", steps: ["在设备 A 登录", "在设备 B 用同一账号登录", "返回设备 A 操作"], expected: "设备 A 提示账号已在其他设备登录并退出", tags: ["并发", "安全"], reviewScore: 83, reviewSuggestion: "", reviewPassed: true, adopted: false, discarded: false },
  { id: "ac8", name: "超长用户名输入边界", module: "登录", type: "边界测试", priority: "P3", precondition: "无", steps: ["在用户名框输入 256 个字符", "点击登录"], expected: "前端拦截，提示用户名不超过 50 个字符", tags: ["边界", "表单"], reviewScore: 72, reviewSuggestion: "", reviewPassed: true, adopted: false, discarded: false },
  { id: "ac9", name: "图形验证码刷新", module: "登录", type: "功能测试", priority: "P2", precondition: "系统已启用验证码", steps: ["打开登录页", "点击验证码图片"], expected: "验证码刷新，旧验证码不可用", tags: ["验证码"], reviewScore: 78, reviewSuggestion: "", reviewPassed: true, adopted: false, discarded: false },
  { id: "ac10", name: "短信验证码登录", module: "登录", type: "功能测试", priority: "P1", precondition: "用户手机号已绑定", steps: ["选择短信登录", "输入手机号", "点击发送验证码", "输入验证码", "登录"], expected: "验证码 5 分钟内有效，成功登录", tags: ["短信", "验证码"], reviewScore: 87, reviewSuggestion: "", reviewPassed: true, adopted: false, discarded: false },
  { id: "ac11", name: "登录后直接访问受限页面", module: "权限", type: "功能测试", priority: "P1", precondition: "用户无管理员权限", steps: ["登录普通账号", "直接访问 /admin"], expected: "显示 403 提示页，不泄露管理页内容", tags: ["权限", "安全"], reviewScore: 94, reviewSuggestion: "", reviewPassed: true, adopted: false, discarded: false },
  { id: "ac12", name: "退出登录清除会话", module: "会话", type: "功能测试", priority: "P0", precondition: "用户已登录", steps: ["点击头像 → 退出登录", "浏览器返回上一页"], expected: "跳回登录页，不能访问已登录页面", tags: ["退出", "会话"], reviewScore: 90, reviewSuggestion: "", reviewPassed: true, adopted: false, discarded: false },
];

const GEN_LOG_EVENTS = [
  { time: "10:23:01", type: "info" as const, msg: "开始解析需求文本（1,247 字）" },
  { time: "10:23:03", type: "success" as const, msg: "需求解析完成，识别到 8 个核心测试点" },
  { time: "10:23:03", type: "info" as const, msg: "GPT-4o 开始生成测试用例..." },
  { time: "10:23:08", type: "success" as const, msg: "生成用例 #1：正常用户名密码登录成功" },
  { time: "10:23:10", type: "success" as const, msg: "生成用例 #2：密码错误提示与账号锁定" },
  { time: "10:23:12", type: "success" as const, msg: "生成用例 #3：空用户名提交校验" },
  { time: "10:23:14", type: "warn" as const, msg: "用例 #4：记住密码功能（评审评分偏低，建议人工复查）" },
  { time: "10:23:17", type: "success" as const, msg: "共生成 12 条用例，进入 AI 评审阶段" },
  { time: "10:23:18", type: "info" as const, msg: "Claude 3.5 Sonnet 开始评审..." },
  { time: "10:23:22", type: "success" as const, msg: "评审完成：通过 10 条，建议优化 2 条" },
  { time: "10:23:23", type: "success" as const, msg: "结果已保存至「登录与认证 / 正向流程」" },
];

const FOLDER_TREE = [
  { id: "f1", label: "登录与认证", children: [{ id: "f1-1", label: "正向流程" }, { id: "f1-2", label: "异常流程" }, { id: "f1-3", label: "安全场景" }] },
  { id: "f2", label: "订单中心", children: [{ id: "f2-1", label: "订单创建" }, { id: "f2-2", label: "订单取消" }] },
  { id: "f3", label: "支付流程", children: [] },
  { id: "f4", label: "用户中心", children: [] },
];

// ─── Toast ────────────────────────────────────────────────────────────────────
type ToastItem = { id: string; msg: string; type: "success" | "error" | "warn" };
function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const add = useCallback((msg: string, type: ToastItem["type"] = "success") => {
    const id = Math.random().toString(36).slice(2);
    setItems(p => [...p, { id, msg, type }]);
    setTimeout(() => setItems(p => p.filter(x => x.id !== id)), 3000);
  }, []);
  return { items, add };
}
function ToastList({ items }: { items: ToastItem[] }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map(it => (
        <div key={it.id} style={{
          background: it.type === "success" ? T.success : it.type === "error" ? T.danger : T.warning,
          color: "#fff", padding: "10px 16px", borderRadius: 6, fontSize: 13,
          boxShadow: "0 4px 16px rgba(0,0,0,.15)", maxWidth: 360,
        }}>{it.msg}</div>
      ))}
    </div>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant = "primary", size = "md", disabled, full }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: "primary" | "ghost" | "danger-ghost" | "success";
  size?: "sm" | "md"; disabled?: boolean; full?: boolean;
}) {
  const pad = size === "sm" ? "5px 12px" : "8px 20px";
  const fs = size === "sm" ? 12 : 13;
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: T.primary, color: "#fff", border: `1px solid ${T.primary}` },
    ghost: { background: "transparent", color: T.primary, border: `1px solid ${T.border}` },
    "danger-ghost": { background: "transparent", color: T.danger, border: `1px solid ${T.danger}30` },
    success: { background: T.success, color: "#fff", border: `1px solid ${T.success}` },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      ...styles[variant], padding: pad, fontSize: fs, fontWeight: 500, borderRadius: 6,
      display: "inline-flex", alignItems: "center", gap: 5, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1, width: full ? "100%" : undefined, justifyContent: full ? "center" : undefined,
      transition: "opacity .15s",
    }}>{children}</button>
  );
}

function Chip({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, padding: "2px 7px", borderRadius: 3 }}>{label}</span>;
}

function PriorityTag({ p }: { p: string }) {
  const cfg: Record<string, [string, string]> = {
    P0: [T.danger, "#FFF0F0"], P1: [T.warning, "#FFF7E6"],
    P2: [T.primary, "#E8F0FF"], P3: [T.t3, T.bg],
  };
  const [color, bg] = cfg[p] ?? [T.t3, T.bg];
  return <Chip label={p} color={color} bg={bg} />;
}

function TypeTag({ t }: { t: string }) {
  const cfg: Record<string, [string, string]> = {
    "功能测试": [T.primary, "#E8F0FF"],
    "边界测试": [T.cyan, "#E6FAFA"],
    "异常测试": [T.warning, "#FFF7E6"],
    "安全测试": [T.purple, "#F0E8FF"],
    "性能测试": [T.success, "#E8FFE8"],
  };
  const [color, bg] = cfg[t] ?? [T.t3, T.bg];
  return <Chip label={t} color={color} bg={bg} />;
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(29,33,41,.5)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#fff", borderRadius: 10, boxShadow: "0 20px 60px rgba(0,0,0,.2)", maxHeight: "90vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

function SavePathModal({ onClose, onConfirm, reqTitle }: { onClose: () => void; onConfirm: (p: string) => void; reqTitle: string }) {
  const [expanded, setExpanded] = useState<string[]>(["f1"]);
  const [selected, setSelected] = useState<string | null>(null);
  const [autoDir, setAutoDir] = useState(true);

  const toggle = (id: string) => setExpanded(e => e.includes(id) ? e.filter(x => x !== id) : [...e, id]);
  const selectedLabel = FOLDER_TREE.flatMap(f => [f, ...f.children]).find(n => n.id === selected)?.label ?? "";

  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ width: 480 }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>选择保存路径</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, lineHeight: 1 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "16px 24px" }}>
          <div style={{ fontSize: 12, color: T.t3, marginBottom: 12 }}>当前工作区：X-MAN</div>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, maxHeight: 260, overflowY: "auto" }}>
            {FOLDER_TREE.map(folder => (
              <div key={folder.id}>
                <div onClick={() => { toggle(folder.id); setSelected(folder.id); }}
                  style={{ padding: "9px 14px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: selected === folder.id ? `${T.primary}10` : "#fff", borderBottom: `1px solid ${T.border}` }}>
                  {folder.children.length > 0
                    ? (expanded.includes(folder.id) ? <ChevronDown size={13} color={T.t3} /> : <ChevronRight size={13} color={T.t3} />)
                    : <span style={{ width: 13 }} />}
                  <FolderOpen size={14} color={selected === folder.id ? T.primary : T.warning} />
                  <span style={{ fontSize: 13, color: selected === folder.id ? T.primary : T.t1 }}>{folder.label}</span>
                </div>
                {expanded.includes(folder.id) && folder.children.map(child => (
                  <div key={child.id} onClick={() => setSelected(child.id)}
                    style={{ padding: "8px 14px 8px 38px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: selected === child.id ? `${T.primary}10` : "#fff", borderBottom: `1px solid ${T.border}` }}>
                    <FileText size={13} color={selected === child.id ? T.primary : T.t3} />
                    <span style={{ fontSize: 13, color: selected === child.id ? T.primary : T.t2 }}>{child.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {selected && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: `${T.primary}08`, borderRadius: 6, border: `1px solid ${T.primary}30` }}>
              <div style={{ fontSize: 11, color: T.t3, marginBottom: 2 }}>保存路径预览</div>
              <div style={{ fontSize: 12, color: T.t1 }}>{selectedLabel}{autoDir && reqTitle ? ` / ${reqTitle.slice(0, 20)}` : ""}</div>
            </div>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={autoDir} onChange={e => setAutoDir(e.target.checked)} />
            <span style={{ fontSize: 12, color: T.t2 }}>根据需求标题自动创建子目录</span>
          </label>
        </div>
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
          <Btn onClick={() => selected ? onConfirm(selectedLabel + (autoDir && reqTitle ? ` / ${reqTitle.slice(0, 20)}` : "")) : undefined} disabled={!selected}>确认选择</Btn>
        </div>
      </div>
    </ModalOverlay>
  );
}

function ConfirmGenModal({ onClose, onConfirm, reqTitle, inputMode, savePath, outputMode }: {
  onClose: () => void; onConfirm: () => void; reqTitle: string;
  inputMode: InputMode; savePath: string; outputMode: OutputMode;
}) {
  const rows = [
    ["需求来源", inputMode === "manual" ? "手动输入" : "上传文档"],
    ["需求标题", reqTitle || "（未填写）"],
    ["保存路径", savePath || "（未选择）"],
    ["生成模型", "GPT-4o"],
    ["评审模型", "Claude 3.5 Sonnet"],
    ["输出模式", outputMode === "stream" ? "⚡ 实时流式" : "📋 完整输出"],
  ];
  return (
    <ModalOverlay onClose={onClose}>
      <div style={{ width: 440 }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <Sparkles size={16} color={T.primary} />
          <span style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>确认生成配置</span>
        </div>
        <div style={{ padding: "16px 24px" }}>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
            {rows.map(([k, v], i) => (
              <div key={k} style={{ display: "flex", borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : undefined }}>
                <div style={{ width: 90, padding: "10px 14px", background: T.bg, fontSize: 12, color: T.t3, flexShrink: 0 }}>{k}</div>
                <div style={{ flex: 1, padding: "10px 14px", fontSize: 13, color: T.t1 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", background: "#FFFBF0", border: `1px solid ${T.warning}40`, borderRadius: 6, fontSize: 12, color: T.t2 }}>
            <AlertTriangle size={12} color={T.warning} style={{ display: "inline", marginRight: 6 }} />
            生成过程不可中断建议，完成前请保持页面打开或选择后台执行
          </div>
        </div>
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
          <Btn onClick={onConfirm}><Sparkles size={13} />开始生成</Btn>
        </div>
      </div>
    </ModalOverlay>
  );
}

function CaseDetailDrawer({ c, onClose, onAdopt, onDiscard, onPrev, onNext, onSave, index, total }: {
  c: AiCase; onClose: () => void; onAdopt: () => void; onDiscard: () => void;
  onSave: (updated: Partial<AiCase>) => void;
  onPrev: () => void; onNext: () => void; index: number; total: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: c.name, precondition: c.precondition, stepsText: c.steps.join("\n"), expected: c.expected, tagsText: c.tags.join(", ") });

  // reset draft & editing when case changes
  useEffect(() => {
    setEditing(false);
    setDraft({ name: c.name, precondition: c.precondition, stepsText: c.steps.join("\n"), expected: c.expected, tagsText: c.tags.join(", ") });
  }, [c.id]);

  // keyboard nav (disabled when editing to avoid conflicts)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPrev, onNext, onClose, editing]);

  const handleSave = () => {
    onSave({
      name: draft.name.trim() || c.name,
      precondition: draft.precondition,
      steps: draft.stepsText.split("\n").map(s => s.trim()).filter(Boolean),
      expected: draft.expected,
      tags: draft.tagsText.split(",").map(t => t.trim()).filter(Boolean),
    });
    setEditing(false);
  };

  const fieldStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13, color: T.t1, lineHeight: 1.7, fontFamily: "inherit", outline: "none", resize: "vertical", background: "#fff" };
  const readStyle: React.CSSProperties = { fontSize: 13, color: T.t1, lineHeight: 1.7, whiteSpace: "pre-line", background: T.bg, padding: "10px 14px", borderRadius: 6 };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(29,33,41,.4)" }} onClick={editing ? undefined : onClose} />
      <div style={{ width: 540, background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,.12)" }}>

        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <PriorityTag p={c.priority} />
              <TypeTag t={c.type} />
              {c.reviewPassed
                ? <Chip label="评审通过" color={T.success} bg="#E8FFE8" />
                : <Chip label="建议优化" color={T.warning} bg="#FFF7E6" />}
              {editing && <Chip label="编辑中" color={T.primary} bg="#E8F0FF" />}
            </div>
            {editing ? (
              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                style={{ ...fieldStyle, fontSize: 15, fontWeight: 600, padding: "6px 10px" }}
                onFocus={e => e.target.style.borderColor = T.primary}
                onBlur={e => e.target.style.borderColor = T.border}
              />
            ) : (
              <div style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>{c.name}</div>
            )}
            <div style={{ fontSize: 12, color: T.t3, marginTop: 4 }}>模块：{c.module} · 评分：{c.reviewScore}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {!editing && (
              <button onClick={() => setEditing(true)} title="编辑用例" style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                border: `1px solid ${T.border}`, borderRadius: 6, background: "none",
                cursor: "pointer", fontSize: 12, color: T.t2,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                编辑
              </button>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, lineHeight: 0, padding: 4 }}><X size={18} /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {/* Precondition */}
          <div style={{ marginBottom: 20 }}>
            <div style={labelStyle}>前置条件</div>
            {editing ? (
              <textarea value={draft.precondition} rows={2} onChange={e => setDraft(d => ({ ...d, precondition: e.target.value }))} style={fieldStyle}
                onFocus={e => e.target.style.borderColor = T.primary} onBlur={e => e.target.style.borderColor = T.border} />
            ) : (
              <div style={readStyle}>{c.precondition}</div>
            )}
          </div>

          {/* Steps */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 6 }}>
              测试步骤
              {editing && <span style={{ fontSize: 10, color: T.t4, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>每行一步</span>}
            </div>
            {editing ? (
              <textarea value={draft.stepsText} rows={Math.max(4, draft.stepsText.split("\n").length + 1)}
                onChange={e => setDraft(d => ({ ...d, stepsText: e.target.value }))} style={fieldStyle}
                onFocus={e => e.target.style.borderColor = T.primary} onBlur={e => e.target.style.borderColor = T.border} />
            ) : (
              <div style={readStyle}>{c.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}</div>
            )}
          </div>

          {/* Expected */}
          <div style={{ marginBottom: 20 }}>
            <div style={labelStyle}>预期结果</div>
            {editing ? (
              <textarea value={draft.expected} rows={3} onChange={e => setDraft(d => ({ ...d, expected: e.target.value }))} style={fieldStyle}
                onFocus={e => e.target.style.borderColor = T.primary} onBlur={e => e.target.style.borderColor = T.border} />
            ) : (
              <div style={readStyle}>{c.expected}</div>
            )}
          </div>

          {/* AI review suggestion — always read-only */}
          {c.reviewSuggestion && (
            <div style={{ padding: "12px 14px", background: "#FFFBF0", border: `1px solid ${T.warning}40`, borderRadius: 6, marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.warning, marginBottom: 4 }}>AI 评审建议</div>
              <div style={{ fontSize: 13, color: T.t2 }}>{c.reviewSuggestion}</div>
            </div>
          )}

          {/* Tags */}
          <div>
            <div style={labelStyle}>标签</div>
            {editing ? (
              <input value={draft.tagsText} onChange={e => setDraft(d => ({ ...d, tagsText: e.target.value }))}
                placeholder="用逗号分隔，如：登录, 安全" style={{ ...fieldStyle, resize: undefined }}
                onFocus={e => e.target.style.borderColor = T.primary} onBlur={e => e.target.style.borderColor = T.border} />
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {c.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 11, color: T.t3, background: T.bg, padding: "3px 8px", borderRadius: 4, border: `1px solid ${T.border}` }}>#{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          {/* Prev / Next — hidden while editing */}
          {!editing && (
            <div style={{ padding: "10px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={onPrev} disabled={index === 0} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", border: `1px solid ${T.border}`,
                borderRadius: 6, background: "none", cursor: index === 0 ? "not-allowed" : "pointer",
                fontSize: 12, color: index === 0 ? T.t4 : T.t2, opacity: index === 0 ? 0.5 : 1,
              }}>
                <ChevronRight size={13} style={{ transform: "rotate(180deg)" }} />上一条
              </button>
              <span style={{ flex: 1, textAlign: "center", fontSize: 12, color: T.t3 }}>{index + 1} / {total}</span>
              <button onClick={onNext} disabled={index === total - 1} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", border: `1px solid ${T.border}`,
                borderRadius: 6, background: "none", cursor: index === total - 1 ? "not-allowed" : "pointer",
                fontSize: 12, color: index === total - 1 ? T.t4 : T.t2, opacity: index === total - 1 ? 0.5 : 1,
              }}>
                下一条<ChevronRight size={13} />
              </button>
            </div>
          )}

          {/* Actions */}
          <div style={{ padding: "14px 24px", display: "flex", gap: 8, alignItems: "center" }}>
            {editing ? (
              <>
                <Btn variant="ghost" onClick={() => { setEditing(false); setDraft({ name: c.name, precondition: c.precondition, stepsText: c.steps.join("\n"), expected: c.expected, tagsText: c.tags.join(", ") }); }}>取消</Btn>
                <div style={{ flex: 1 }} />
                <Btn onClick={handleSave}>保存修改</Btn>
              </>
            ) : (
              <>
                {!c.discarded && !c.adopted && (
                  <>
                    <Btn variant="danger-ghost" size="sm" onClick={onDiscard}><ThumbsDown size={12} />放弃此条</Btn>
                    <div style={{ flex: 1 }} />
                    <Btn variant="success" onClick={onAdopt}><ThumbsUp size={13} />采纳用例</Btn>
                  </>
                )}
                {c.adopted && (
                  <>
                    <span style={{ fontSize: 13, color: T.success, display: "flex", alignItems: "center", gap: 6 }}><CheckCircle size={14} />已采纳</span>
                    <div style={{ flex: 1 }} />
                    <Btn variant="danger-ghost" size="sm" onClick={onDiscard}><ThumbsDown size={12} />改为放弃</Btn>
                  </>
                )}
                {c.discarded && (
                  <>
                    <span style={{ fontSize: 13, color: T.t3, display: "flex", alignItems: "center", gap: 6 }}><XCircle size={14} />已放弃</span>
                    <div style={{ flex: 1 }} />
                    <Btn variant="success" onClick={onAdopt}><ThumbsUp size={13} />改为采纳</Btn>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AICaseGenPage({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const { items: toastItems, add: addToast } = useToast();

  const [pageState, setPageState] = useState<PageState>("idle");
  const [inputMode, setInputMode] = useState<InputMode>("manual");
  const [outputMode, setOutputMode] = useState<OutputMode>("stream");
  const [reqTitle, setReqTitle] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [savePath, setSavePath] = useState("");
  const [demoConfigErr, setDemoConfigErr] = useState(false);

  // Upload state
  const [uploadState, setUploadState] = useState<UploadState>("empty");
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);

  // Generation state
  const [genCount, setGenCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [showLog, setShowLog] = useState<typeof GEN_LOG_EVENTS>([]);
  const [cases, setCases] = useState<AiCase[]>(MOCK_AI_CASES.map(c => ({ ...c })));

  // Results state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [drawerCase, setDrawerCase] = useState<AiCase | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Modals
  const [showSavePath, setShowSavePath] = useState(false);
  const [showConfirmGen, setShowConfirmGen] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  const GEN_STEPS = ["解析需求", "提取测试点", "生成用例", "AI 评审", "保存结果"];

  // ── Generation simulation ──────────────────────────────────────────────────
  useEffect(() => {
    if (pageState !== "generating") return;
    setGenCount(0); setReviewCount(0); setCurrentStep(0); setElapsed(0); setShowLog([]);

    intervalRef.current = window.setInterval(() => setElapsed(e => e + 1), 1000);

    const addLog = (idx: number) => setShowLog(p => [...p, GEN_LOG_EVENTS[idx]]);

    const t0 = setTimeout(() => { addLog(0); }, 400);
    const t1 = setTimeout(() => { addLog(1); setCurrentStep(1); }, 1800);
    const t2 = setTimeout(() => { addLog(2); setCurrentStep(2); }, 2400);

    let gc = 0;
    const genInterval = window.setInterval(() => {
      gc++;
      if (gc <= GEN_LOG_EVENTS.length - 5) addLog(2 + gc);
      setGenCount(Math.min(gc * 2, 12));
      if (gc >= 3) setCurrentStep(3);
      if (gc >= 6) clearInterval(genInterval);
    }, 600);

    const t3 = setTimeout(() => {
      addLog(8); setCurrentStep(4);
      let rc = 0;
      const revInterval = window.setInterval(() => {
        rc += 2; setReviewCount(Math.min(rc, 12));
        if (rc >= 12) {
          clearInterval(revInterval);
          addLog(9); addLog(10);
          setTimeout(() => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setPageState("results");
          }, 600);
        }
      }, 300);
    }, 6000);

    return () => {
      clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      clearInterval(genInterval);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pageState]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [showLog]);

  const startGeneration = () => {
    setShowConfirmGen(false);
    setPageState("generating");
  };

  const canGenerate = reqTitle.trim().length > 0 && savePath && !demoConfigErr;

  // ── Upload simulation ──────────────────────────────────────────────────────
  const simulateUpload = () => {
    setUploadState("uploading"); setUploadPct(0);
    const iv = window.setInterval(() => {
      setUploadPct(p => {
        if (p >= 100) { clearInterval(iv); setUploadState("parsing"); return 100; }
        return p + 20;
      });
    }, 200);
    setTimeout(() => { setUploadState("done"); setUploadedFile({ name: "需求规格说明书.docx", size: "2.4 MB" }); }, 2800);
  };

  // ── Results helpers ────────────────────────────────────────────────────────
  const filteredCases = cases.filter(c => {
    const matchQ = !searchQ || c.name.includes(searchQ) || c.module.includes(searchQ);
    const matchT = filterType === "all" || c.type === filterType;
    return matchQ && matchT;
  });
  const adoptedCount = cases.filter(c => c.adopted).length;
  const discardedCount = cases.filter(c => c.discarded).length;
  const passedCount = cases.filter(c => c.reviewPassed).length;

  const adoptCase = (id: string) => setCases(p => p.map(c => c.id === id ? { ...c, adopted: true, discarded: false } : c));
  const discardCase = (id: string) => setCases(p => p.map(c => c.id === id ? { ...c, discarded: true, adopted: false } : c));
  const adoptAll = () => {
    const ids = new Set(selected.size > 0 ? [...selected] : filteredCases.map(c => c.id));
    setCases(p => p.map(c => ids.has(c.id) ? { ...c, adopted: true, discarded: false } : c));
    setSelected(new Set());
    addToast(`已采纳 ${ids.size} 条用例`);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // IDLE VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  const renderIdle = () => (
    <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

      {/* ── Left: Recent tasks sidebar ── */}
      <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", background: "#fff" }}>
        <div style={{ padding: "16px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: ".5px" }}>最近生成任务</span>
          <button onClick={() => onNavigate?.("cases-records")} style={{ fontSize: 11, color: T.primary, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
            全部记录 <ArrowRight size={11} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {RECENT_TASKS.map((task, i) => (
            <div key={task.id} style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = T.bg}
              onMouseLeave={e => e.currentTarget.style.background = ""}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                {task.status === "running" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.success, flexShrink: 0, animation: "pulse 1.5s infinite" }} />}
                {task.status === "done" && <CheckCircle size={12} color={T.success} />}
                {task.status === "failed" && <XCircle size={12} color={T.danger} />}
                <span style={{ fontSize: 13, color: T.t1, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.reqTitle}</span>
              </div>
              <div style={{ fontSize: 11, color: T.t3, marginBottom: 6 }}>
                {task.source === "upload" ? "📎 上传文档" : "✏️ 手动输入"} · {task.updatedAt}
              </div>
              {task.status !== "failed" && (
                <div style={{ fontSize: 11, color: T.t3, display: "flex", gap: 10 }}>
                  <span>生成 {task.genCount} 条</span>
                  {task.status === "done" && <span style={{ color: T.success }}>采纳 {task.adoptCount} 条</span>}
                </div>
              )}
              {task.status === "failed" && <span style={{ fontSize: 11, color: T.danger }}>生成失败</span>}
              <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                {task.status === "running" && (
                  <Btn size="sm" onClick={() => {
                    setReqTitle(task.reqTitle);
                    setSavePath("登录与认证 / 正向流程");
                    setPageState("generating");
                  }}>恢复查看</Btn>
                )}
                {task.status === "done" && (
                  <Btn size="sm" variant="ghost" onClick={() => {
                    setReqTitle(task.reqTitle);
                    setSavePath("登录与认证 / 正向流程");
                    setCases(MOCK_AI_CASES.map(c => ({ ...c })));
                    setSelected(new Set());
                    setSearchQ("");
                    setFilterType("all");
                    setPageState("results");
                  }}>查看结果</Btn>
                )}
                {task.status === "failed" && (
                  <Btn size="sm" variant="danger-ghost" onClick={() => addToast("正在重试...")}><RotateCcw size={11} />重试</Btn>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Quick guide */}
        <div style={{ padding: "14px 18px", borderTop: `1px solid ${T.border}`, background: `${T.primary}06` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.primary, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
            <BookOpen size={12} />如何开始
          </div>
          {["在右侧填写需求标题和描述", "选择用例保存路径", "点击「开始生成」"].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, alignItems: "flex-start" }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: T.primary, color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: T.t2 }}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Input form ── */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: 32 }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>

          {/* Form header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Sparkles size={18} color={T.primary} />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.t1 }}>AI 用例生成</h2>
              {/* Demo error toggle */}
              <button onClick={() => setDemoConfigErr(e => !e)} style={{ marginLeft: "auto", fontSize: 11, color: T.t4, background: "none", border: "none", cursor: "pointer" }}>
                [演示:{demoConfigErr ? "配置异常" : "配置正常"}]
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: T.t3 }}>输入需求描述，AI 自动生成结构化测试用例并完成双模型评审</p>
          </div>

          {/* Input mode toggle */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "inline-flex", background: T.bg, borderRadius: 7, padding: 3 }}>
              {([["manual", "✏️  手动输入"], ["upload", "📎  上传文档"]] as [InputMode, string][]).map(([m, label]) => (
                <button key={m} onClick={() => setInputMode(m)} style={{
                  padding: "6px 18px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
                  background: inputMode === m ? "#fff" : "transparent",
                  color: inputMode === m ? T.t1 : T.t3,
                  boxShadow: inputMode === m ? "0 1px 4px rgba(0,0,0,.1)" : "none",
                  transition: "all .15s",
                }}>{label}</button>
              ))}
            </div>
          </div>

          {/* Manual input form */}
          {inputMode === "manual" && (
            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
              {/* Title */}
              <div style={{ padding: "20px 24px 0" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.t2, display: "block", marginBottom: 6 }}>
                  需求标题 <span style={{ color: T.danger }}>*</span>
                </label>
                <input value={reqTitle} onChange={e => setReqTitle(e.target.value)}
                  placeholder="简要描述这批用例的需求主题，如：用户登录与认证流程"
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "9px 12px",
                    border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 14, color: T.t1,
                    outline: "none", background: "#fff",
                  }}
                  onFocus={e => e.target.style.borderColor = T.primary}
                  onBlur={e => e.target.style.borderColor = T.border}
                />
              </div>

              {/* Description */}
              <div style={{ padding: "18px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.t2 }}>
                    需求描述 <span style={{ color: T.danger }}>*</span>
                  </label>
                  <span style={{ fontSize: 11, color: reqDesc.length > 2800 ? T.danger : T.t4 }}>{reqDesc.length} / 3000</span>
                </div>
                <textarea value={reqDesc} onChange={e => setReqDesc(e.target.value)}
                  placeholder={"详细说明功能逻辑、使用场景、用户角色、业务规则、异常处理和验收标准\n\n示例（可描述以下内容）：\n• 正常流程与步骤\n• 边界条件与异常场景\n• 角色权限与数据范围\n• 验收标准"}
                  maxLength={3000}
                  style={{
                    width: "100%", boxSizing: "border-box", padding: "10px 12px", minHeight: 200,
                    border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13, color: T.t1,
                    lineHeight: 1.7, resize: "vertical", fontFamily: "inherit", outline: "none",
                  }}
                  onFocus={e => e.target.style.borderColor = T.primary}
                  onBlur={e => e.target.style.borderColor = T.border}
                />
              </div>
            </div>
          )}

          {/* Upload form */}
          {inputMode === "upload" && (
            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 10, padding: 24 }}>
              {uploadState === "empty" && (
                <div onClick={simulateUpload} style={{
                  border: `2px dashed ${T.border}`, borderRadius: 8, padding: "48px 24px",
                  textAlign: "center", cursor: "pointer", transition: "border-color .15s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = T.primary)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}>
                  <Upload size={32} color={T.t4} style={{ margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 14, fontWeight: 500, color: T.t1, marginBottom: 4 }}>拖拽文件到此处或点击上传</div>
                  <div style={{ fontSize: 12, color: T.t3 }}>支持 PDF、DOC、DOCX、TXT、Markdown · 最大 20MB</div>
                </div>
              )}
              {uploadState === "uploading" && (
                <div style={{ padding: "24px 0" }}>
                  <div style={{ fontSize: 13, color: T.t1, marginBottom: 8 }}>正在上传...</div>
                  <div style={{ height: 6, background: T.bg, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${uploadPct}%`, background: T.primary, borderRadius: 3, transition: "width .2s" }} />
                  </div>
                  <div style={{ fontSize: 11, color: T.t3, marginTop: 6 }}>{uploadPct}%</div>
                </div>
              )}
              {uploadState === "parsing" && (
                <div style={{ padding: "24px 0", display: "flex", alignItems: "center", gap: 10 }}>
                  <Loader2 size={16} color={T.primary} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 13, color: T.t2 }}>正在解析文档内容...</span>
                </div>
              )}
              {uploadState === "done" && uploadedFile && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: `${T.success}08`, border: `1px solid ${T.success}30`, borderRadius: 6, marginBottom: 16 }}>
                    <CheckCircle size={16} color={T.success} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: T.t1, fontWeight: 500 }}>{uploadedFile.name}</div>
                      <div style={{ fontSize: 11, color: T.t3 }}>{uploadedFile.size} · 解析成功，识别到 1,247 字</div>
                    </div>
                    <button onClick={() => { setUploadState("empty"); setUploadedFile(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: T.t3 }}><X size={14} /></button>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: T.t2, display: "block", marginBottom: 6 }}>需求标题 <span style={{ color: T.danger }}>*</span></label>
                    <input value={reqTitle} onChange={e => setReqTitle(e.target.value)}
                      placeholder="从文档提取或手动填写需求标题"
                      style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13, color: T.t1, outline: "none" }}
                      onFocus={e => e.target.style.borderColor = T.primary}
                      onBlur={e => e.target.style.borderColor = T.border}
                    />
                  </div>
                </div>
              )}
              {uploadState === "error" && (
                <div style={{ padding: "24px 0", textAlign: "center" }}>
                  <XCircle size={32} color={T.danger} style={{ margin: "0 auto 10px" }} />
                  <div style={{ fontSize: 13, color: T.t1, marginBottom: 8 }}>文件解析失败</div>
                  <Btn size="sm" variant="ghost" onClick={() => setUploadState("empty")}><RotateCcw size={12} />重新上传</Btn>
                </div>
              )}
            </div>
          )}

          {/* Config section */}
          <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 10, marginTop: 16, overflow: "hidden" }}>
            <div style={{ padding: "14px 24px", borderBottom: `1px solid ${T.border}`, fontSize: 12, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: ".5px" }}>
              生成配置
            </div>

            {/* Save path */}
            <div style={{ padding: "14px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 12, color: T.t2, width: 80, flexShrink: 0 }}>保存路径 <span style={{ color: T.danger }}>*</span></span>
              <button onClick={() => setShowSavePath(true)} style={{
                flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                border: `1px solid ${savePath ? T.primary + "60" : T.border}`, borderRadius: 6,
                background: savePath ? `${T.primary}06` : T.bg, cursor: "pointer", textAlign: "left",
              }}>
                <FolderOpen size={14} color={savePath ? T.primary : T.t4} />
                <span style={{ fontSize: 13, color: savePath ? T.t1 : T.t4, flex: 1 }}>{savePath || "点击选择保存目录..."}</span>
                {savePath && <CheckCircle size={13} color={T.success} />}
              </button>
            </div>

            {/* AI config */}
            <div style={{ padding: "14px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 12, color: T.t2, width: 80, flexShrink: 0 }}>AI 配置</span>
              {demoConfigErr ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#FFF0F0", border: `1px solid ${T.danger}30`, borderRadius: 6 }}>
                  <AlertTriangle size={14} color={T.danger} />
                  <span style={{ fontSize: 12, color: T.danger, flex: 1 }}>评审模型未配置，请先完成 AI 配置</span>
                  <button onClick={() => onNavigate?.("cases-ai-cfg")} style={{ fontSize: 11, color: T.danger, background: "none", border: `1px solid ${T.danger}40`, borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}>前往配置 →</button>
                </div>
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: `${T.success}08`, border: `1px solid ${T.success}30`, borderRadius: 6 }}>
                  <CheckCircle size={14} color={T.success} />
                  <span style={{ fontSize: 12, color: T.t2 }}>生成：GPT-4o · 评审：Claude 3.5 Sonnet · 支持图片识别</span>
                  <button onClick={() => onNavigate?.("cases-ai-cfg")} style={{ marginLeft: "auto", fontSize: 11, color: T.primary, background: "none", border: "none", cursor: "pointer" }}>AI 配置 →</button>
                </div>
              )}
            </div>

            {/* Output mode */}
            <div style={{ padding: "14px 24px", display: "flex", alignItems: "flex-start", gap: 16 }}>
              <span style={{ fontSize: 12, color: T.t2, width: 80, flexShrink: 0, paddingTop: 2 }}>输出模式</span>
              <div style={{ display: "flex", gap: 10, flex: 1 }}>
                {([
                  ["stream", "⚡ 实时流式", "逐步展示生成过程，适合观察"],
                  ["complete", "📋 完整输出", "全部完成后统一展示，适合批量"],
                ] as [OutputMode, string, string][]).map(([k, label, desc]) => (
                  <div key={k} onClick={() => setOutputMode(k)} style={{
                    flex: 1, padding: "10px 14px", borderRadius: 6, cursor: "pointer",
                    border: `2px solid ${outputMode === k ? T.primary : T.border}`,
                    background: outputMode === k ? `${T.primary}08` : "#fff",
                    transition: "all .15s",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: outputMode === k ? T.primary : T.t1, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 11, color: T.t3 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: T.t3 }}>
              {!reqTitle.trim() && "请填写需求标题"}
              {reqTitle.trim() && !savePath && "请选择保存路径"}
              {reqTitle.trim() && savePath && demoConfigErr && "请完成 AI 配置"}
            </span>
            <Btn disabled={!canGenerate} onClick={() => setShowConfirmGen(true)}>
              <Sparkles size={14} />开始生成
            </Btn>
          </div>

        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // GENERATING VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  const renderGenerating = () => {
    const pct = Math.round(((genCount + reviewCount) / 24) * 100);
    return (
      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

        {/* Left: progress + log */}
        <div style={{ flex: "3 1 0px", minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Progress header */}
          <div style={{ padding: "20px 28px", background: "#fff", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.success, animation: "pulse 1.5s infinite", flexShrink: 0 }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: T.t1, flex: 1 }}>生成任务进行中</span>
              <span style={{ fontSize: 12, color: T.t3 }}>耗时 {elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m${elapsed % 60}s`}</span>
              <Btn size="sm" variant="ghost" onClick={() => addToast("已切换至后台执行", "warn")}>后台继续</Btn>
              <Btn size="sm" variant="danger-ghost" onClick={() => setShowCancelConfirm(true)}><StopCircle size={11} />取消</Btn>
            </div>

            {/* Step bar */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
              {GEN_STEPS.map((step, i) => (
                <React.Fragment key={step}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      background: i < currentStep ? T.success : i === currentStep ? T.primary : T.bg,
                      border: `2px solid ${i < currentStep ? T.success : i === currentStep ? T.primary : T.border}`,
                      color: i <= currentStep ? "#fff" : T.t4, fontSize: 11, transition: "all .3s",
                    }}>
                      {i < currentStep ? <Check size={12} /> : i === currentStep ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : i + 1}
                    </div>
                    <span style={{ fontSize: 10, color: i === currentStep ? T.primary : i < currentStep ? T.success : T.t4, whiteSpace: "nowrap" }}>{step}</span>
                  </div>
                  {i < GEN_STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 2, margin: "0 4px", marginBottom: 14, background: i < currentStep ? T.success : T.border, transition: "background .3s" }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: T.t1, lineHeight: 1 }}>{genCount}</span>
                <span style={{ fontSize: 12, color: T.t3 }}>/ 12 已生成</span>
              </div>
              <div style={{ width: 1, height: 20, background: T.border }} />
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: T.t1, lineHeight: 1 }}>{reviewCount}</span>
                <span style={{ fontSize: 12, color: T.t3 }}>/ 12 已评审</span>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, width: 200 }}>
                <div style={{ flex: 1, height: 6, background: T.bg, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: T.primary, borderRadius: 3, transition: "width .4s" }} />
                </div>
                <span style={{ fontSize: 12, color: T.t3, flexShrink: 0 }}>{pct}%</span>
              </div>
            </div>
          </div>

          {/* Event log */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "10px 28px 6px", flexShrink: 0, fontSize: 11, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: ".5px" }}>生成日志</div>
            <div ref={logRef} style={{ flex: 1, overflowY: "auto", padding: "0 28px 20px", fontFamily: "monospace", fontSize: 12 }}>
              {showLog.map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "5px 0", alignItems: "flex-start", borderBottom: `1px solid ${T.border}40` }}>
                  <span style={{ color: T.t4, whiteSpace: "nowrap", fontSize: 11 }}>{ev.time}</span>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginTop: 4, background: ev.type === "success" ? T.success : ev.type === "warn" ? T.warning : T.primary }} />
                  <span style={{ color: ev.type === "warn" ? T.warning : ev.type === "success" ? T.success : T.t2, lineHeight: 1.5 }}>{ev.msg}</span>
                </div>
              ))}
              {showLog.length === 0 && <div style={{ color: T.t4, padding: "20px 0" }}>等待任务启动...</div>}
            </div>
          </div>
        </div>

        {/* Right: task summary + streaming preview */}
        <div style={{ flex: "2 1 0px", minWidth: 0, borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff" }}>
          {/* Task info */}
          <div style={{ padding: "20px 22px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 12 }}>本次任务信息</div>
            {[
              ["需求标题", reqTitle || "用户登录与认证流程"],
              ["来源", inputMode === "manual" ? "手动输入" : "上传文档"],
              ["保存路径", savePath || "登录与认证 / 正向流程"],
              ["生成模型", "GPT-4o"],
              ["评审模型", "Claude 3.5 Sonnet"],
              ["输出模式", outputMode === "stream" ? "⚡ 实时流式" : "📋 完整输出"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: T.t3, width: 72, flexShrink: 0, paddingTop: 1 }}>{k}</span>
                <span style={{ fontSize: 12, color: T.t1 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Streaming preview */}
          {outputMode === "stream" && genCount > 0 && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "10px 22px 6px", flexShrink: 0, fontSize: 11, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: ".5px" }}>
                实时预览（{genCount} 条）
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0 22px 16px" }}>
                {MOCK_AI_CASES.slice(0, genCount).map(c => (
                  <div key={c.id} style={{ padding: "9px 0", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                    <PriorityTag p={c.priority} />
                    <span style={{ fontSize: 12, color: T.t1, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outputMode === "complete" && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: T.t3 }}>
              <Loader2 size={28} color={T.t4} style={{ animation: "spin 1.5s linear infinite" }} />
              <div style={{ fontSize: 13, color: T.t2 }}>完整输出模式</div>
              <div style={{ fontSize: 12, color: T.t3 }}>生成和评审完成后统一展示</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ padding: "10px 22px", borderTop: `1px solid ${T.border}`, flexShrink: 0, background: "#FFFDF5" }}>
            <span style={{ fontSize: 11, color: T.t3 }}>关闭页面后任务将在后台继续执行</span>
          </div>
        </div>

        {/* Cancel confirm */}
        {showCancelConfirm && (
          <ModalOverlay onClose={() => setShowCancelConfirm(false)}>
            <div style={{ width: 380, padding: 28 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <AlertTriangle size={20} color={T.danger} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.t1, marginBottom: 6 }}>确认取消生成任务？</div>
                  <div style={{ fontSize: 13, color: T.t2 }}>取消后已生成的 {genCount} 条用例将不会保存，此操作不可恢复。</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Btn variant="ghost" onClick={() => setShowCancelConfirm(false)}>继续等待</Btn>
                <Btn variant="danger-ghost" onClick={() => { setPageState("idle"); setShowCancelConfirm(false); addToast("生成任务已取消", "warn"); }}>确认取消</Btn>
              </div>
            </div>
          </ModalOverlay>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RESULTS VIEW
  // ─────────────────────────────────────────────────────────────────────────────
  const renderResults = () => (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Stats bar */}
      <div style={{ padding: "14px 24px", background: "#fff", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Btn size="sm" variant="ghost" onClick={() => setPageState("idle")}><ArrowRight size={12} style={{ transform: "rotate(180deg)" }} />重新生成</Btn>
          <div style={{ width: 1, height: 18, background: T.border }} />
          {[
            { label: "共生成", value: cases.length, color: T.t1 },
            { label: "评审通过", value: passedCount, color: T.success },
            { label: "已采纳", value: adoptedCount, color: T.primary },
            { label: "已放弃", value: discardedCount, color: T.t3 },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</span>
              <span style={{ fontSize: 12, color: T.t3 }}>{s.label}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={() => onNavigate?.("cases-records")} style={{ fontSize: 12, color: T.primary, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <ArrowUpRight size={12} />查看完整任务记录
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ padding: "10px 24px", background: "#fff", borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox"
          checked={selected.size === filteredCases.length && filteredCases.length > 0}
          onChange={() => selected.size === filteredCases.length ? setSelected(new Set()) : setSelected(new Set(filteredCases.map(c => c.id)))}
          style={{ cursor: "pointer", width: 15, height: 15 }}
        />
        {selected.size > 0 && (
          <span style={{ fontSize: 12, color: T.t2 }}>已选 {selected.size} 条</span>
        )}
        <div style={{ flex: 1 }} />
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="搜索用例名称或模块..."
          style={{ padding: "6px 12px", border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, width: 220, outline: "none", color: T.t1 }}
          onFocus={e => e.target.style.borderColor = T.primary}
          onBlur={e => e.target.style.borderColor = T.border}
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ padding: "6px 10px", border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, color: T.t1, outline: "none", cursor: "pointer" }}>
          <option value="all">全部类型</option>
          <option value="功能测试">功能测试</option>
          <option value="边界测试">边界测试</option>
          <option value="异常测试">异常测试</option>
          <option value="安全测试">安全测试</option>
        </select>
        {selected.size > 0 && (
          <Btn size="sm" variant="success" onClick={adoptAll}><ThumbsUp size={11} />批量采纳 ({selected.size})</Btn>
        )}
        {selected.size === 0 && (
          <Btn size="sm" onClick={adoptAll}><ThumbsUp size={11} />全部采纳</Btn>
        )}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr style={{ background: T.bg, borderBottom: `1px solid ${T.border}` }}>
              <th style={{ width: 40, padding: "10px 16px", textAlign: "center" }}></th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: ".5px" }}>用例名称</th>
              <th style={{ padding: "10px 8px", textAlign: "center", fontSize: 11, fontWeight: 600, color: T.t3, whiteSpace: "nowrap" }}>类型</th>
              <th style={{ padding: "10px 8px", textAlign: "center", fontSize: 11, fontWeight: 600, color: T.t3 }}>优先级</th>
              <th style={{ padding: "10px 8px", textAlign: "center", fontSize: 11, fontWeight: 600, color: T.t3 }}>评分</th>
              <th style={{ padding: "10px 8px", textAlign: "center", fontSize: 11, fontWeight: 600, color: T.t3 }}>评审结果</th>
              <th style={{ padding: "10px 8px", textAlign: "center", fontSize: 11, fontWeight: 600, color: T.t3 }}>状态</th>
              <th style={{ padding: "10px 16px", textAlign: "center", fontSize: 11, fontWeight: 600, color: T.t3 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredCases.map(c => (
              <React.Fragment key={c.id}>
                <tr style={{ borderBottom: `1px solid ${T.border}`, background: selected.has(c.id) ? `${T.primary}08` : "#fff" }}
                  onMouseEnter={e => { if (!selected.has(c.id)) e.currentTarget.style.background = T.bg; }}
                  onMouseLeave={e => { if (!selected.has(c.id)) e.currentTarget.style.background = "#fff"; }}>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <input type="checkbox" checked={selected.has(c.id)}
                      onChange={() => setSelected(s => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                      style={{ cursor: "pointer", width: 14, height: 14 }}
                    />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <button onClick={() => setExpandedCase(expandedCase === c.id ? null : c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, lineHeight: 0 }}>
                        {expandedCase === c.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{c.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.t3, paddingLeft: 20 }}>模块：{c.module}</div>
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "center" }}><TypeTag t={c.type} /></td>
                  <td style={{ padding: "12px 8px", textAlign: "center" }}><PriorityTag p={c.priority} /></td>
                  <td style={{ padding: "12px 8px", textAlign: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: c.reviewScore >= 80 ? T.success : c.reviewScore >= 65 ? T.warning : T.danger }}>{c.reviewScore}</span>
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "center" }}>
                    {c.reviewPassed
                      ? <Chip label="通过" color={T.success} bg="#E8FFE8" />
                      : <Chip label="待优化" color={T.warning} bg="#FFF7E6" />}
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "center" }}>
                    {c.adopted && <Chip label="已采纳" color={T.primary} bg="#E8F0FF" />}
                    {c.discarded && <Chip label="已放弃" color={T.t3} bg={T.bg} />}
                    {!c.adopted && !c.discarded && <span style={{ fontSize: 11, color: T.t4 }}>待处理</span>}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button onClick={() => setDrawerCase(c)} title="查看详情" style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, lineHeight: 0, padding: 4 }}>
                        <Eye size={14} />
                      </button>
                      {!c.adopted && !c.discarded && (
                        <>
                          <button onClick={() => { adoptCase(c.id); addToast(`已采纳：${c.name}`); }} title="采纳" style={{ background: "none", border: "none", cursor: "pointer", color: T.success, lineHeight: 0, padding: 4 }}>
                            <ThumbsUp size={14} />
                          </button>
                          <button onClick={() => { discardCase(c.id); addToast(`已放弃：${c.name}`, "warn"); }} title="放弃" style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0, padding: 4 }}>
                            <ThumbsDown size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expanded row */}
                {expandedCase === c.id && (
                  <tr style={{ background: `${T.primary}04`, borderBottom: `1px solid ${T.border}` }}>
                    <td />
                    <td colSpan={7} style={{ padding: "12px 24px 16px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: T.t3, marginBottom: 6 }}>前置条件</div>
                          <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.6 }}>{c.precondition}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: T.t3, marginTop: 12, marginBottom: 6 }}>预期结果</div>
                          <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.6 }}>{c.expected}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: T.t3, marginBottom: 6 }}>测试步骤</div>
                          {c.steps.map((s, i) => (
                            <div key={i} style={{ fontSize: 12, color: T.t2, lineHeight: 1.7 }}>{i + 1}. {s}</div>
                          ))}
                          {c.reviewSuggestion && (
                            <div style={{ marginTop: 10, padding: "8px 10px", background: "#FFFBF0", borderRadius: 5, border: `1px solid ${T.warning}30`, fontSize: 12, color: T.t2 }}>
                              <span style={{ fontWeight: 600, color: T.warning }}>评审建议：</span>{c.reviewSuggestion}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {filteredCases.length === 0 && (
          <div style={{ padding: "60px 0", textAlign: "center", color: T.t3 }}>
            <Search size={32} color={T.t4} style={{ margin: "0 auto 10px" }} />
            <div style={{ fontSize: 14 }}>没有匹配的用例</div>
          </div>
        )}
      </div>
    </div>
  );

  // ─── FAILED VIEW ──────────────────────────────────────────────────────────────
  const renderFailed = () => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FFF0F0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <XCircle size={28} color={T.danger} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: T.t1, marginBottom: 6 }}>生成失败</div>
        <div style={{ fontSize: 13, color: T.t3 }}>AI 服务连接超时，请检查网络或稍后重试</div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={() => setPageState("idle")}>修改需求</Btn>
        <Btn onClick={() => setPageState("generating")}><RotateCcw size={13} />重试</Btn>
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: T.bg }}>
      {pageState === "idle" && renderIdle()}
      {pageState === "generating" && renderGenerating()}
      {pageState === "results" && renderResults()}
      {pageState === "failed" && renderFailed()}

      {showSavePath && (
        <SavePathModal onClose={() => setShowSavePath(false)} onConfirm={(p) => { setSavePath(p); setShowSavePath(false); addToast("保存路径已设置"); }} reqTitle={reqTitle} />
      )}
      {showConfirmGen && (
        <ConfirmGenModal onClose={() => setShowConfirmGen(false)} onConfirm={startGeneration} reqTitle={reqTitle} inputMode={inputMode} savePath={savePath} outputMode={outputMode} />
      )}
      {drawerCase && (() => {
        const drawerIdx = filteredCases.findIndex(c => c.id === drawerCase.id);
        const safeIdx = drawerIdx >= 0 ? drawerIdx : 0;
        return (
          <CaseDetailDrawer
            c={cases.find(c => c.id === drawerCase.id) ?? drawerCase}
            index={safeIdx}
            total={filteredCases.length}
            onClose={() => setDrawerCase(null)}
            onPrev={() => { if (safeIdx > 0) setDrawerCase(filteredCases[safeIdx - 1]); }}
            onNext={() => { if (safeIdx < filteredCases.length - 1) setDrawerCase(filteredCases[safeIdx + 1]); }}
            onSave={(updated) => {
              setCases(p => p.map(c => c.id === drawerCase.id ? { ...c, ...updated } : c));
              setDrawerCase(prev => prev ? { ...prev, ...updated } : prev);
              addToast("用例已保存");
            }}
            onAdopt={() => {
              adoptCase(drawerCase.id);
              addToast(`已采纳：${drawerCase.name}`);
            }}
            onDiscard={() => {
              discardCase(drawerCase.id);
              addToast(`已放弃：${drawerCase.name}`, "warn");
            }}
          />
        );
      })()}

      <ToastList items={toastItems} />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
