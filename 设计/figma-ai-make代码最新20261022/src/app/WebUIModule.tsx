import React from "react";
import { Monitor } from "lucide-react";
const T = { primary:"#165DFF", border:"#E5E6EB", bg:"#F4F6FA", t1:"#1D2129", t2:"#4E5969", t3:"#86909C" };
export interface ReportRecord { id:string; name:string; createdAt:string; status:string; }
export function WebUIModule() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F4F6FA]">
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b" style={{borderColor:T.border}}>
        <div className="flex items-center gap-3 mb-1"><Monitor size={18} style={{color:T.primary}}/><h1 className="text-[16px] font-bold" style={{color:T.t1}}>Web UI 自动化</h1></div>
        <p className="text-[12px]" style={{color:T.t3}}>浏览器端自动化测试用例管理与执行</p>
      </div>
      <div className="flex-1 flex items-center justify-center"><p className="text-[13px]" style={{color:T.t3}}>Web UI 模块（开发中）</p></div>
    </div>
  );
}
export function ReportListPage({onView,onShare}:{onView:(r:ReportRecord)=>void;onShare:(r:ReportRecord)=>void}) {
  return <div className="flex-1 flex items-center justify-center"><p className="text-[13px]" style={{color:T.t3}}>报告列表（开发中）</p></div>;
}
export function ReportDetailPage({report,onBack,onShare}:{report:ReportRecord;onBack:()=>void;onShare:()=>void}) {
  return <div className="flex-1 flex items-center justify-center"><p className="text-[13px]" style={{color:T.t3}}>报告详情（开发中）</p></div>;
}
export function ShareReportPage({onBack}:{onBack:()=>void}) {
  return <div className="flex-1 flex items-center justify-center"><p className="text-[13px]" style={{color:T.t3}}>分享报告（开发中）</p></div>;
}
