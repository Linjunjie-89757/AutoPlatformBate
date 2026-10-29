import React from "react";
import { LayoutDashboard } from "lucide-react";
const T = { primary:"#165DFF", border:"#E5E6EB", t1:"#1D2129", t3:"#86909C" };
export function OverviewModule() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F4F6FA]">
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b" style={{borderColor:T.border}}>
        <div className="flex items-center gap-3 mb-1"><LayoutDashboard size={18} style={{color:T.primary}}/><h1 className="text-[16px] font-bold" style={{color:T.t1}}>项目总览</h1></div>
        <p className="text-[12px]" style={{color:T.t3}}>项目质量概况、测试进度与趋势分析</p>
      </div>
      <div className="flex-1 flex items-center justify-center"><p className="text-[13px]" style={{color:T.t3}}>总览模块（开发中）</p></div>
    </div>
  );
}
