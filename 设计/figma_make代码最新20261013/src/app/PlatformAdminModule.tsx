import React from "react";
import { ShieldCheck } from "lucide-react";
const T = { primary:"#165DFF", border:"#E5E6EB", t1:"#1D2129", t3:"#86909C" };
export function PlatformAdminModule() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F4F6FA]">
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b" style={{borderColor:T.border}}>
        <div className="flex items-center gap-3 mb-1"><ShieldCheck size={18} style={{color:T.primary}}/><h1 className="text-[16px] font-bold" style={{color:T.t1}}>平台管理</h1></div>
        <p className="text-[12px]" style={{color:T.t3}}>租户管理、成员权限与平台级配置</p>
      </div>
      <div className="flex-1 flex items-center justify-center"><p className="text-[13px]" style={{color:T.t3}}>平台管理模块（开发中）</p></div>
    </div>
  );
}
