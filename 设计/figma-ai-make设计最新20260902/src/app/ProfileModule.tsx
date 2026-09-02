import React, { useState, useRef } from "react";
import {
  User, KeyRound, SlidersHorizontal, Bell, Palette,
  Camera, CheckCircle, AlertTriangle, Eye, EyeOff,
  ChevronRight, Save, ArrowLeft, Shield, Monitor, Moon, Sun,
} from "lucide-react";

const T = {
  primary: "#165DFF", success: "#00B42A", warning: "#FF7D00",
  danger: "#F53F3F", purple: "#7816FF",
  bg: "#F4F6FA", border: "#E5E6EB",
  t1: "#1D2129", t2: "#4E5969", t3: "#86909C", t4: "#C9CDD4",
};

type Tab = "profile" | "security" | "preferences" | "notifications" | "appearance";

const TABS: { key: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { key: "profile",       label: "个人资料",   icon: User,             desc: "头像、昵称、基本信息" },
  { key: "security",      label: "安全设置",   icon: Shield,           desc: "密码、登录设备" },
  { key: "preferences",   label: "操作偏好",   icon: SlidersHorizontal, desc: "默认工作区、语言等" },
  { key: "notifications", label: "通知偏好",   icon: Bell,             desc: "任务通知、声音" },
  { key: "appearance",    label: "主题外观",   icon: Palette,          desc: "亮色、暗色、跟随系统" },
];

const MODULES = [
  { key: "overview",   label: "工作台" },
  { key: "cases-list", label: "用例管理" },
  { key: "cases-ai-gen", label: "AI 用例生成" },
  { key: "bugs",       label: "缺陷管理" },
  { key: "api",        label: "接口自动化" },
  { key: "webui",      label: "Web UI 自动化" },
  { key: "tasks",      label: "任务管理" },
  { key: "reports",    label: "报表中心" },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "14px 24px", borderBottom: `1px solid ${T.border}` }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: T.t1 }}>{title}</span>
      </div>
      <div style={{ padding: "20px 24px" }}>{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 20 }}>
      <div style={{ width: 120, flexShrink: 0, paddingTop: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.t2 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: T.t4, marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", disabled }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: "100%", boxSizing: "border-box", padding: "8px 12px",
        border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1,
        outline: "none", background: disabled ? T.bg : "#fff",
        color: disabled ? T.t3 : T.t1,
      }}
      onFocus={e => { if (!disabled) e.target.style.borderColor = T.primary; }}
      onBlur={e => { e.target.style.borderColor = T.border; }}
    />
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
      <div onClick={() => onChange(!value)} style={{
        width: 36, height: 20, borderRadius: 10,
        background: value ? T.primary : T.t4,
        position: "relative", transition: "background .2s", flexShrink: 0, cursor: "pointer",
      }}>
        <div style={{
          position: "absolute", top: 2, left: value ? 18 : 2,
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
      {label && <span style={{ fontSize: 13, color: T.t2 }}>{label}</span>}
    </label>
  );
}

// ─── Tab: Profile ─────────────────────────────────────────────────────────────
function ProfileTab({ onSave }: { onSave: () => void }) {
  const [name, setName] = useState("张程远");
  const [displayName, setDisplayName] = useState("张程远");
  const [bio, setBio] = useState("");
  const [avatarColor, setAvatarColor] = useState(T.primary);
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarImg, setAvatarImg] = useState<string | null>(null);

  const COLORS = ["#165DFF", "#7816FF", "#00B42A", "#FF7D00", "#F53F3F", "#0FC6C2", "#1D2129"];

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setAvatarImg(ev.target?.result as string);
    reader.readAsDataURL(f);
  };

  return (
    <>
      <SectionCard title="头像">
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {avatarImg ? (
              <img src={avatarImg} alt="avatar" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, color: "#fff" }}>
                {name.slice(0, 1)}
              </div>
            )}
            <button onClick={() => fileRef.current?.click()}
              style={{ position: "absolute", right: -4, bottom: -4, width: 26, height: 26, borderRadius: "50%", background: "#fff", border: `2px solid ${T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Camera size={12} color={T.t2} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
          </div>
          <div>
            <div style={{ fontSize: 13, color: T.t2, marginBottom: 10 }}>背景颜色</div>
            <div style={{ display: "flex", gap: 8 }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => { setAvatarColor(c); setAvatarImg(null); }}
                  style={{ width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer", border: avatarColor === c && !avatarImg ? `3px solid #fff` : "3px solid transparent", boxShadow: avatarColor === c && !avatarImg ? `0 0 0 2px ${c}` : "none", transition: "all .15s" }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: T.t4, marginTop: 8 }}>支持上传 JPG / PNG，最大 2MB</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="基本信息">
        <Field label="真实姓名">
          <Input value={name} onChange={setName} placeholder="请输入姓名" />
        </Field>
        <Field label="昵称 / 显示名" hint="页面中展示的名称">
          <Input value={displayName} onChange={setDisplayName} placeholder="请输入显示名称" />
        </Field>
        <Field label="邮箱" hint="用于接收通知">
          <Input value="zhangchengyuan@autotest.com" disabled />
        </Field>
        <Field label="角色">
          <Input value="超级管理员" disabled />
        </Field>
        <Field label="个人简介">
          <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="介绍一下自己..." rows={3}
            style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none", resize: "vertical", fontFamily: "inherit" }}
            onFocus={e => e.target.style.borderColor = T.primary}
            onBlur={e => e.target.style.borderColor = T.border} />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onSave} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", background: T.primary, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            <Save size={13} />保存资料
          </button>
        </div>
      </SectionCard>
    </>
  );
}

// ─── Tab: Security ────────────────────────────────────────────────────────────
function SecurityTab({ onSave }: { onSave: () => void }) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = newPwd.length === 0 ? 0 : newPwd.length < 6 ? 1 : newPwd.length < 10 ? 2 : /[A-Z]/.test(newPwd) && /[0-9]/.test(newPwd) && /[^a-zA-Z0-9]/.test(newPwd) ? 4 : 3;
  const strengthLabel = ["", "太弱", "较弱", "中等", "强"][strength];
  const strengthColor = ["", T.danger, T.warning, T.warning, T.success][strength];

  const pwdMatch = confirmPwd && newPwd === confirmPwd;
  const canSave = oldPwd && newPwd.length >= 8 && pwdMatch;

  const DEVICES = [
    { name: "Chrome · macOS", ip: "192.168.1.12", time: "当前会话", current: true },
    { name: "Safari · iPhone 15", ip: "192.168.1.88", time: "2小时前", current: false },
    { name: "Chrome · Windows", ip: "10.0.0.23", time: "昨天 14:32", current: false },
  ];

  function PwdInput({ value, onChange, show, onToggle, placeholder }: { value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string }) {
    return (
      <div style={{ position: "relative" }}>
        <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: "100%", boxSizing: "border-box", padding: "8px 38px 8px 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none" }}
          onFocus={e => e.target.style.borderColor = T.primary}
          onBlur={e => e.target.style.borderColor = T.border} />
        <button onClick={onToggle} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.t3, lineHeight: 0 }}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    );
  }

  return (
    <>
      <SectionCard title="修改密码">
        <Field label="当前密码">
          <PwdInput value={oldPwd} onChange={setOldPwd} show={showOld} onToggle={() => setShowOld(v => !v)} placeholder="请输入当前密码" />
        </Field>
        <Field label="新密码" hint="至少 8 位">
          <PwdInput value={newPwd} onChange={setNewPwd} show={showNew} onToggle={() => setShowNew(v => !v)} placeholder="请输入新密码" />
          {newPwd && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength ? strengthColor : T.border, transition: "background .2s" }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: strengthColor }}>{strengthLabel}</span>
            </div>
          )}
        </Field>
        <Field label="确认新密码">
          <PwdInput value={confirmPwd} onChange={setConfirmPwd} show={showConfirm} onToggle={() => setShowConfirm(v => !v)} placeholder="再次输入新密码" />
          {confirmPwd && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
              {pwdMatch
                ? <><CheckCircle size={12} color={T.success} /><span style={{ fontSize: 11, color: T.success }}>密码一致</span></>
                : <><AlertTriangle size={12} color={T.danger} /><span style={{ fontSize: 11, color: T.danger }}>密码不一致</span></>}
            </div>
          )}
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={canSave ? onSave : undefined} disabled={!canSave}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", background: canSave ? T.primary : T.t4, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: canSave ? "pointer" : "not-allowed" }}>
            <KeyRound size={13} />更新密码
          </button>
        </div>
      </SectionCard>

      <SectionCard title="登录设备">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {DEVICES.map(d => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 8, background: d.current ? `${T.primary}06` : T.bg, border: `1px solid ${d.current ? T.primary + "30" : T.border}` }}>
              <Monitor size={18} color={d.current ? T.primary : T.t3} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>IP: {d.ip} · {d.time}</div>
              </div>
              {d.current
                ? <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: `${T.success}15`, color: T.success, fontWeight: 500 }}>当前</span>
                : <button style={{ fontSize: 12, color: T.danger, background: "none", border: `1px solid ${T.danger}40`, borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}>下线</button>}
            </div>
          ))}
        </div>
      </SectionCard>
    </>
  );
}

// ─── Tab: Preferences ─────────────────────────────────────────────────────────
function PreferencesTab({ onSave }: { onSave: () => void }) {
  const [defaultModule, setDefaultModule] = useState("overview");
  const [language, setLanguage] = useState("zh");
  const [sidebarRemember, setSidebarRemember] = useState(true);
  const [confirmBeforeDelete, setConfirmBeforeDelete] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [pageSize, setPageSize] = useState("20");

  return (
    <SectionCard title="操作偏好">
      <Field label="默认工作区" hint="登录后首先进入的模块">
        <select value={defaultModule} onChange={e => setDefaultModule(e.target.value)}
          style={{ width: "100%", padding: "8px 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none", background: "#fff", cursor: "pointer" }}>
          {MODULES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </Field>
      <Field label="界面语言">
        <select value={language} onChange={e => setLanguage(e.target.value)}
          style={{ width: "100%", padding: "8px 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none", background: "#fff", cursor: "pointer" }}>
          <option value="zh">简体中文</option>
          <option value="zh-tw">繁體中文</option>
          <option value="en">English</option>
        </select>
      </Field>
      <Field label="列表分页数量">
        <select value={pageSize} onChange={e => setPageSize(e.target.value)}
          style={{ width: "100%", padding: "8px 12px", border: `1.5px solid ${T.border}`, borderRadius: 7, fontSize: 13, color: T.t1, outline: "none", background: "#fff", cursor: "pointer" }}>
          {["10", "20", "50", "100"].map(n => <option key={n} value={n}>每页 {n} 条</option>)}
        </select>
      </Field>
      <Field label="记住侧边栏状态">
        <Toggle value={sidebarRemember} onChange={setSidebarRemember} label="刷新后保留折叠 / 展开状态" />
      </Field>
      <Field label="删除前二次确认">
        <Toggle value={confirmBeforeDelete} onChange={setConfirmBeforeDelete} label="删除操作弹出确认提示" />
      </Field>
      <Field label="自动保存草稿">
        <Toggle value={autoSave} onChange={setAutoSave} label="编辑内容定期自动保存" />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={onSave} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", background: T.primary, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          <Save size={13} />保存偏好
        </button>
      </div>
    </SectionCard>
  );
}

// ─── Tab: Notifications ───────────────────────────────────────────────────────
function NotificationsTab({ onSave }: { onSave: () => void }) {
  const [taskDone, setTaskDone] = useState(true);
  const [taskFail, setTaskFail] = useState(true);
  const [aiDone, setAiDone] = useState(true);
  const [sound, setSound] = useState(false);
  const [desktopPush, setDesktopPush] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);

  const items: [string, string, boolean, (v: boolean) => void][] = [
    ["任务执行完成", "自动化任务运行结束时通知", taskDone, setTaskDone],
    ["任务执行失败", "任务异常或失败时立即通知", taskFail, setTaskFail],
    ["AI 用例生成完成", "AI 生成任务完成时通知", aiDone, setAiDone],
    ["桌面推送通知", "在浏览器外时发送系统通知", desktopPush, setDesktopPush],
    ["邮件摘要（每日）", "每天汇总发送当日任务报告", emailDigest, setEmailDigest],
    ["通知声音", "收到通知时播放提示音", sound, setSound],
  ];

  return (
    <SectionCard title="通知偏好">
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {items.map(([label, desc, value, onChange], i) => (
          <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: i < items.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{label}</div>
              <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>{desc}</div>
            </div>
            <Toggle value={value} onChange={onChange} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onSave} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", background: T.primary, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          <Save size={13} />保存设置
        </button>
      </div>
    </SectionCard>
  );
}

// ─── Tab: Appearance ──────────────────────────────────────────────────────────
function AppearanceTab({ onSave }: { onSave: () => void }) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [density, setDensity] = useState<"compact" | "normal" | "relaxed">("normal");
  const [fontSize, setFontSize] = useState("14");

  const themes: { key: "light" | "dark" | "system"; label: string; icon: React.ElementType; desc: string }[] = [
    { key: "light",  label: "亮色",     icon: Sun,     desc: "明亮清爽的默认主题" },
    { key: "dark",   label: "暗色",     icon: Moon,    desc: "深色背景，减少眼部疲劳" },
    { key: "system", label: "跟随系统", icon: Monitor, desc: "自动匹配操作系统设置" },
  ];

  const densities: { key: "compact" | "normal" | "relaxed"; label: string; desc: string }[] = [
    { key: "compact",  label: "紧凑",   desc: "更多信息，适合大屏" },
    { key: "normal",   label: "标准",   desc: "默认间距，均衡体验" },
    { key: "relaxed",  label: "宽松",   desc: "更大间距，阅读舒适" },
  ];

  return (
    <SectionCard title="主题外观">
      <Field label="主题模式">
        <div style={{ display: "flex", gap: 10 }}>
          {themes.map(t => {
            const Icon = t.icon;
            const active = theme === t.key;
            return (
              <div key={t.key} onClick={() => setTheme(t.key)}
                style={{ flex: 1, padding: "14px 12px", borderRadius: 9, cursor: "pointer", border: `2px solid ${active ? T.primary : T.border}`, background: active ? `${T.primary}06` : "#fff", transition: "all .15s", textAlign: "center" }}>
                <Icon size={20} color={active ? T.primary : T.t3} style={{ margin: "0 auto 6px" }} />
                <div style={{ fontSize: 13, fontWeight: 500, color: active ? T.primary : T.t1 }}>{t.label}</div>
                <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>{t.desc}</div>
              </div>
            );
          })}
        </div>
      </Field>
      <Field label="信息密度">
        <div style={{ display: "flex", gap: 8 }}>
          {densities.map(d => {
            const active = density === d.key;
            return (
              <div key={d.key} onClick={() => setDensity(d.key)}
                style={{ flex: 1, padding: "10px 12px", borderRadius: 7, cursor: "pointer", border: `2px solid ${active ? T.primary : T.border}`, background: active ? `${T.primary}06` : "#fff", transition: "all .15s" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: active ? T.primary : T.t1 }}>{d.label}</div>
                <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>{d.desc}</div>
              </div>
            );
          })}
        </div>
      </Field>
      <Field label="字号" hint="界面基础字体大小">
        <div style={{ display: "flex", gap: 8 }}>
          {["12", "13", "14", "15", "16"].map(s => {
            const active = fontSize === s;
            return (
              <button key={s} onClick={() => setFontSize(s)}
                style={{ padding: "6px 14px", borderRadius: 6, border: `1.5px solid ${active ? T.primary : T.border}`, background: active ? `${T.primary}06` : "#fff", color: active ? T.primary : T.t2, fontSize: 13, cursor: "pointer", transition: "all .15s" }}>
                {s}px
              </button>
            );
          })}
        </div>
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={onSave} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", background: T.primary, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          <Save size={13} />应用外观
        </button>
      </div>
    </SectionCard>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function ProfileModule({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const ActiveIcon = TABS.find(t => t.key === activeTab)?.icon ?? User;

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", background: T.bg }}>
      {/* Sidebar */}
      <div style={{ width: 220, flexShrink: 0, background: "#fff", borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${T.border}` }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: T.t3, fontSize: 12, padding: 0, marginBottom: 12 }}>
            <ArrowLeft size={13} />返回
          </button>
          {/* Mini profile card */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>张</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>张程远</div>
              <div style={{ fontSize: 11, color: T.t3 }}>超级管理员</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: active ? `${T.primary}0E` : "transparent", border: "none", cursor: "pointer", textAlign: "left", borderLeft: `3px solid ${active ? T.primary : "transparent"}`, transition: "all .15s" }}>
                <Icon size={15} color={active ? T.primary : T.t3} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? T.primary : T.t2 }}>{tab.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <ActiveIcon size={18} color={T.primary} />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.t1 }}>
                {TABS.find(t => t.key === activeTab)?.label}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: T.t3 }}>{TABS.find(t => t.key === activeTab)?.desc}</p>
          </div>

          {activeTab === "profile"       && <ProfileTab       onSave={() => showToast("个人资料已保存")} />}
          {activeTab === "security"      && <SecurityTab      onSave={() => showToast("密码已更新")} />}
          {activeTab === "preferences"   && <PreferencesTab   onSave={() => showToast("偏好设置已保存")} />}
          {activeTab === "notifications" && <NotificationsTab onSave={() => showToast("通知设置已保存")} />}
          {activeTab === "appearance"    && <AppearanceTab    onSave={() => showToast("外观设置已应用")} />}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 8, background: "#1D2129", color: "#fff", fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", pointerEvents: "none" }}>
          <CheckCircle size={14} color={T.success} />{toast}
        </div>
      )}
    </div>
  );
}
