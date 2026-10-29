import React from "react";

const T = { border:"#E5E6EB", t3:"#86909C", t1:"#1D2129", bg:"#F4F6FA" };

function PlaceholderDrawer({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.35)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:12, padding:"32px 40px", minWidth:320, textAlign:"center" }}
        onClick={e => e.stopPropagation()}>
        <p style={{ fontSize:14, fontWeight:600, color:T.t1, marginBottom:8 }}>{title}</p>
        <p style={{ fontSize:12, color:T.t3, marginBottom:20 }}>该组件开发中</p>
        <button onClick={onClose} style={{ padding:"6px 20px", border:`1px solid ${T.border}`, borderRadius:6, fontSize:13, cursor:"pointer", background:"#fff", color:T.t3 }}>关闭</button>
      </div>
    </div>
  );
}

export function ElementEditorDrawer({ onClose, onImpact }: { onClose: () => void; onImpact?: () => void }) {
  return <PlaceholderDrawer title="元素编辑器" onClose={onClose} />;
}

export function LocatorVerifyDialog({ onClose }: { onClose: () => void }) {
  return <PlaceholderDrawer title="定位器验证" onClose={onClose} />;
}

export function ElementDetailDrawer({ onClose, onViewRefs, onQualityAnalysis, onEdit, onDelete }: {
  onClose: () => void; onViewRefs?: () => void; onQualityAnalysis?: () => void;
  onEdit?: () => void; onDelete?: () => void;
}) {
  return <PlaceholderDrawer title="元素详情" onClose={onClose} />;
}

export function ElementReferenceDrawer({ onClose }: { onClose: () => void }) {
  return <PlaceholderDrawer title="元素引用" onClose={onClose} />;
}

export function ImpactAnalysisDialog({ onClose }: { onClose: () => void }) {
  return <PlaceholderDrawer title="影响分析" onClose={onClose} />;
}

export function QualityAnalysisDrawer({ onClose }: { onClose: () => void }) {
  return <PlaceholderDrawer title="质量分析" onClose={onClose} />;
}
