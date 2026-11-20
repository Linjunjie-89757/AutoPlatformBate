/**
 * ApiComponents.tsx
 *
 * Reusable UI primitives for the 接口管理 workbench.
 * All components follow the confirmed visual language:
 *  - Border: #E5E6EB  Radius: 7-8px  Shadow: 0 8px 40px rgba(0,0,0,.14)
 *  - Palette T (imported from App via re-export here)
 *  - Font: Inter / PingFang SC, mono: JetBrains Mono
 *  - Form labels 13px/500, inputs 13px/400, error 11px danger
 *  - Primary buttons: solid blue; ghost: white+border; danger: red
 */

import React, { useState, useRef } from "react";
import {
  X, AlertTriangle, Info, CheckCircle, XCircle, Eye, EyeOff,
  Loader2, Lock, AlertCircle, ChevronDown,
} from "lucide-react";

// ─── Shared token re-export ────────────────────────────────────────────────────

export const T = {
  primary: "#165DFF", success: "#00B42A", warning: "#FF7D00",
  danger: "#F53F3F", purple: "#7816FF",
  bg: "#F4F6FA", border: "#E5E6EB",
  t1: "#1D2129", t2: "#4E5969", t3: "#86909C", t4: "#C9CDD4",
};

// ─── WbToggle ─────────────────────────────────────────────────────────────────

export function WbToggle({ on, onChange, disabled }: {
  on: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div onClick={() => !disabled && onChange(!on)}
      style={{ width: 32, height: 18, borderRadius: 9, background: disabled ? T.t4 : on ? T.primary : T.t4, position: "relative", cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0, transition: "background .15s" }}>
      <div style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }}/>
    </div>
  );
}

// ─── WbBanner ─────────────────────────────────────────────────────────────────

const BANNER = {
  info:    { bg: "#E8F3FF", border: `${T.primary}30`,  color: T.primary,  Icon: Info          },
  warn:    { bg: "#FFF3E8", border: `${T.warning}30`,  color: T.warning,  Icon: AlertTriangle  },
  error:   { bg: "#FFF2F2", border: `${T.danger}30`,   color: T.danger,   Icon: XCircle        },
  success: { bg: "#E8FFEA", border: `${T.success}30`,  color: T.success,  Icon: CheckCircle    },
};

export function WbBanner({ type, children, className }: {
  type: keyof typeof BANNER; children: React.ReactNode; className?: string;
}) {
  const c = BANNER[type];
  return (
    <div style={{ display: "flex", gap: 8, padding: "10px 13px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, marginBottom: 16, fontSize: 12, color: c.color, lineHeight: 1.65 }}>
      <c.Icon size={14} style={{ flexShrink: 0, marginTop: 1 }}/>
      <div>{children}</div>
    </div>
  );
}

// ─── WbField ──────────────────────────────────────────────────────────────────

export function WbField({ label, required, error, helpText, children, mb = 16 }: {
  label?: string; required?: boolean; error?: string; helpText?: string;
  children: React.ReactNode; mb?: number;
}) {
  return (
    <div style={{ marginBottom: mb }}>
      {label && (
        <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, marginBottom: 6 }}>
          {required && <span style={{ color: T.danger, marginRight: 2 }}>*</span>}{label}
        </div>
      )}
      {children}
      {error && (
        <div style={{ fontSize: 11, color: T.danger, marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
          <AlertCircle size={10}/>{error}
        </div>
      )}
      {!error && helpText && <div style={{ fontSize: 11, color: T.t4, marginTop: 4 }}>{helpText}</div>}
    </div>
  );
}

// ─── WbInput ──────────────────────────────────────────────────────────────────

export function WbInput({ value, onChange, placeholder, error, disabled, type, mono, prefix, suffix, style: extraStyle }: {
  value?: string; onChange?: (v: string) => void; placeholder?: string;
  error?: boolean; disabled?: boolean; type?: string; mono?: boolean;
  prefix?: React.ReactNode; suffix?: React.ReactNode; style?: React.CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = disabled ? T.t4 : error ? T.danger : focused ? T.primary : T.border;
  return (
    <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${borderColor}`, borderRadius: 7, background: disabled ? T.bg : "#fff", overflow: "hidden", transition: "border-color .15s", ...extraStyle }}>
      {prefix && <div style={{ padding: "0 10px", color: T.t4, display: "flex", alignItems: "center", flexShrink: 0 }}>{prefix}</div>}
      <input type={type || "text"} value={value ?? ""} onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ flex: 1, border: "none", outline: "none", padding: "8px 12px", fontSize: 13, color: disabled ? T.t3 : T.t1, background: "transparent", fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit" }}/>
      {suffix && <div style={{ padding: "0 10px", color: T.t3, display: "flex", alignItems: "center", flexShrink: 0 }}>{suffix}</div>}
    </div>
  );
}

// ─── WbSensitive ──────────────────────────────────────────────────────────────

export function WbSensitive({ value, placeholder = "•".repeat(16) }: {
  value: string; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", border: `1.5px solid ${T.border}`, borderRadius: 7, background: "#fff", overflow: "hidden" }}>
      <input type={show ? "text" : "password"} readOnly value={value}
        style={{ flex: 1, border: "none", outline: "none", padding: "8px 12px", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", color: T.t1, background: "transparent" }}/>
      <button onClick={() => setShow(v => !v)} style={{ padding: "0 10px", background: "none", border: "none", cursor: "pointer", color: T.t3, lineHeight: 0 }}>
        {show ? <EyeOff size={14}/> : <Eye size={14}/>}
      </button>
    </div>
  );
}

// ─── WbBtn ────────────────────────────────────────────────────────────────────

export function WbBtn({ children, onClick, variant = "primary", disabled, icon: Icon, loading, size: sz = "md" }: {
  children?: React.ReactNode; onClick?: () => void;
  variant?: "primary"|"ghost"|"danger"|"success"|"warning";
  disabled?: boolean; icon?: React.ElementType; loading?: boolean; size?: "sm"|"md"|"lg";
}) {
  const bg    = { primary: T.primary, ghost: "#fff", danger: T.danger, success: T.success, warning: T.warning };
  const fg    = { primary: "#fff",    ghost: T.t2,   danger: "#fff",   success: "#fff",    warning: "#fff"    };
  const bd    = { primary: T.primary, ghost: T.border,danger: T.danger, success: T.success, warning: T.warning };
  const pad   = sz === "sm" ? "5px 12px" : sz === "lg" ? "9px 24px" : "7px 18px";
  const fsize = sz === "lg" ? 14 : 13;
  const isDisabled = disabled || loading;
  return (
    <button onClick={onClick} disabled={isDisabled}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: pad, border: `1px solid ${isDisabled ? T.t4 : bd[variant]}`, borderRadius: 7, background: isDisabled ? (variant === "ghost" ? "#fff" : T.t4) : bg[variant], color: isDisabled ? (variant === "ghost" ? T.t4 : "#fff") : fg[variant], fontSize: fsize, fontWeight: 500, cursor: isDisabled ? "not-allowed" : "pointer", flexShrink: 0, transition: "background .1s" }}>
      {loading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }}/> : Icon && <Icon size={13}/>}
      {children}
    </button>
  );
}

// ─── WbModal ──────────────────────────────────────────────────────────────────

export function WbModal({ title, icon: Icon, onClose, children, footer, width = 560, noPad }: {
  title: string; icon?: React.ElementType; onClose?: () => void;
  children: React.ReactNode; footer?: React.ReactNode; width?: number; noPad?: boolean;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 400 }}/>
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 401, background: "#fff", borderRadius: 10, width, boxShadow: "0 8px 40px rgba(0,0,0,0.14)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          {Icon && <Icon size={15} style={{ color: T.primary }}/>}
          <span style={{ fontSize: 15, fontWeight: 700, color: T.t1, flex: 1 }}>{title}</span>
          {onClose && <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, padding: 4, borderRadius: 5, lineHeight: 0 }}><X size={16}/></button>}
        </div>
        {/* Body */}
        <div style={{ padding: noPad ? 0 : "20px 24px", overflowY: "auto", flex: 1 }}>
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
            {footer}
          </div>
        )}
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  );
}

// ─── WbDrawer ─────────────────────────────────────────────────────────────────

export function WbDrawer({ title, subtitle, icon: Icon, onClose, children, footer, width = 520 }: {
  title: string; subtitle?: string; icon?: React.ElementType; onClose?: () => void;
  children: React.ReactNode; footer?: React.ReactNode; width?: number;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.12)", zIndex: 400 }}/>
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width, zIndex: 401, background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.11)", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {Icon && <Icon size={15} style={{ color: T.primary }}/>}
            <span style={{ fontSize: 15, fontWeight: 700, color: T.t1, flex: 1 }}>{title}</span>
            {onClose && <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.t3, padding: 4, borderRadius: 5, lineHeight: 0 }}><X size={16}/></button>}
          </div>
          {subtitle && <div style={{ fontSize: 12, color: T.t3, marginTop: 3 }}>{subtitle}</div>}
        </div>
        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div style={{ padding: "10px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

// ─── WbConfirm ────────────────────────────────────────────────────────────────

export function WbConfirm({ title, message, confirmLabel = "确认", cancelLabel = "取消", variant = "danger", onConfirm, onCancel }: {
  title: string; message: React.ReactNode;
  confirmLabel?: string; cancelLabel?: string;
  variant?: "danger"|"warning"|"primary";
  onConfirm: () => void; onCancel: () => void;
}) {
  const iconColor = variant === "danger" ? T.danger : variant === "warning" ? T.warning : T.primary;
  const bgColor   = variant === "danger" ? "#FFE8E8" : variant === "warning" ? "#FFF3E8" : "#E8F3FF";
  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 500 }}/>
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 501, background: "#fff", borderRadius: 10, width: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.16)", padding: "24px 24px 20px" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AlertTriangle size={17} color={iconColor}/>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.t1, marginBottom: 6 }}>{title}</div>
            <div style={{ fontSize: 13, color: T.t2, lineHeight: 1.65 }}>{message}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <WbBtn onClick={onCancel} variant="ghost">{cancelLabel}</WbBtn>
          <WbBtn onClick={onConfirm} variant={variant === "warning" ? "primary" : variant}>{confirmLabel}</WbBtn>
        </div>
      </div>
    </>
  );
}

// ─── WbEmpty ──────────────────────────────────────────────────────────────────

export function WbEmpty({ icon: Icon, title, desc, action }: {
  icon: React.ElementType; title: string; desc?: string; action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 10, textAlign: "center" }}>
      <Icon size={40} style={{ color: T.t4, opacity: 0.4 }}/>
      <div style={{ fontSize: 14, fontWeight: 500, color: T.t2 }}>{title}</div>
      {desc && <div style={{ fontSize: 12, color: T.t4, lineHeight: 1.8 }}>{desc}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

// ─── WbStatusBadge ────────────────────────────────────────────────────────────

export function WbStatusBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: bg, color, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block" }}/>
      {label}
    </span>
  );
}

// ─── WbSourceBadge ────────────────────────────────────────────────────────────

export function WbSourceBadge({ source }: { source: "default"|"interface"|"env" }) {
  const cfg = {
    default:   { label: "平台默认", color: T.t4,      bg: T.bg           },
    interface: { label: "接口自定义", color: T.primary, bg: `${T.primary}12` },
    env:       { label: "环境覆盖", color: T.warning,  bg: `${T.warning}12` },
  }[source];
  return <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 3, background: cfg.bg, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>;
}

// ─── WbDemoBar ────────────────────────────────────────────────────────────────

export function WbDemoBar<S extends string>({ states, current, onChange, label = "Design Preview" }: {
  states: { value: S; label: string }[];
  current: S;
  onChange: (v: S) => void;
  label?: string;
}) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, padding: "6px 16px", background: "#fff", borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, color: T.t4, fontWeight: 700, marginRight: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      {states.map(s => (
        <button key={s.value} onClick={() => onChange(s.value)}
          style={{ fontSize: 11, padding: "2px 9px", borderRadius: 5, border: `1px solid ${current === s.value ? T.primary : T.border}`, background: current === s.value ? `${T.primary}0D` : "transparent", color: current === s.value ? T.primary : T.t3, cursor: "pointer", fontWeight: current === s.value ? 600 : 400 }}>
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ─── WbSendStatePanel ─────────────────────────────────────────────────────────
// Shown in the response area when a request is in-flight or errored.

export type SendState = "idle"|"sending"|"cancel"|"timeout"|"network-error"|"ssl-error"|"body-too-large";

export function WbSendStatePanel({ state, onCancel, onRetry, onDismiss }: {
  state: SendState; onCancel?: () => void; onRetry?: () => void; onDismiss?: () => void;
}) {
  if (state === "idle") return null;

  const cfg: Record<Exclude<SendState,"idle">, {
    iconBg: string; iconColor: string; Icon: React.ElementType;
    title: string; desc?: string; spin?: boolean; danger?: boolean;
  }> = {
    sending:       { iconBg: `${T.primary}12`, iconColor: T.primary, Icon: Loader2,      title: "正在发送请求…",                                      spin: true },
    cancel:        { iconBg: T.bg,              iconColor: T.t3,      Icon: X,            title: "请求已取消",      desc: "用户手动取消了本次请求"                },
    timeout:       { iconBg: "#FFF3E8",         iconColor: T.warning, Icon: AlertTriangle,title: "请求超时",        desc: `超出超时时间 30,000 ms，请检查服务端响应或调整 Settings 中的超时设置` },
    "network-error":{ iconBg:"#FFE8E8",         iconColor: T.danger,  Icon: XCircle,      title: "网络连接失败",    desc: "ERR_NAME_NOT_RESOLVED — 请检查网络连接或服务地址是否正确",  danger: true },
    "ssl-error":   { iconBg: "#FFE8E8",         iconColor: T.danger,  Icon: Lock,         title: "SSL 证书错误",    desc: "CERT_COMMON_NAME_INVALID — 证书域名不匹配或证书已过期",     danger: true },
    "body-too-large":{ iconBg:"#FFF3E8",        iconColor: T.warning, Icon: AlertTriangle,title: "响应体过大",      desc: "响应体 24.8 MB，超出 10 MB 预览限制，仅展示前 10,000 行" },
  };

  const c = cfg[state as Exclude<SendState,"idle">];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: c.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <c.Icon size={24} style={{ color: c.iconColor, animation: c.spin ? "spin 1s linear infinite" : undefined }}/>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.t1 }}>{c.title}</div>
      {c.desc && <div style={{ fontSize: 12, color: T.t3, textAlign: "center", lineHeight: 1.8, maxWidth: 340 }}>{c.desc}</div>}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {state === "sending" && <WbBtn onClick={onCancel} variant="ghost">取消请求</WbBtn>}
        {state === "cancel"  && <WbBtn onClick={onRetry} variant="primary" icon={Loader2 as React.ElementType}>重新发送</WbBtn>}
        {(state === "timeout" || state === "network-error") && (
          <>
            <WbBtn onClick={onDismiss} variant="ghost">取消</WbBtn>
            <WbBtn onClick={onRetry} variant="primary">重试</WbBtn>
          </>
        )}
        {state === "ssl-error" && (
          <>
            <WbBtn onClick={onDismiss} variant="ghost">取消</WbBtn>
            <WbBtn onClick={onRetry} variant="danger">忽略证书错误并继续</WbBtn>
          </>
        )}
        {state === "body-too-large" && (
          <>
            <WbBtn onClick={onDismiss} variant="ghost">仅查看前 10K 行</WbBtn>
            <WbBtn onClick={onDismiss} variant="primary">下载完整响应</WbBtn>
          </>
        )}
      </div>
    </div>
  );
}
