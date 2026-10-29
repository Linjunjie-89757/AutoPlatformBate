import React, { useState } from "react";
import { Timer, CheckCircle, Clock, AlertCircle, RefreshCw, Eye, Trash2, Search } from "lucide-react";

const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  border:"#E5E6EB",
  bg:"#F4F6FA",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};

type TaskStatus = "completed"|"generating"|"reviewing"|"failed"|"pending";

interface Task {
  id: string; title: string; status: TaskStatus;
  generated: number; reviewed: number; adopted: number;
  model: string; createdAt: string; operator: string;
}

const STATUS_META: Record<TaskStatus,{label:string;color:string;bg:string;icon:React.ReactNode}> = {
  completed:  {label:"已完成", color:T.success, bg:"#E8F8EF", icon:<CheckCircle size={12}/>},
  generating: {label:"生成中", color:T.primary, bg:"#E8F3FF", icon:<RefreshCw size={12}/>},
  reviewing:  {label:"评审中", color:T.warning, bg:"#FFF3E8", icon:<Clock size={12}/>},
  failed:     {label:"失败",   color:T.danger,  bg:"#FFF0F0", icon:<AlertCircle size={12}/>},
  pending:    {label:"待执行", color:T.t3,      bg:"#F4F6FA", icon:<Clock size={12}/>},
};

const MOCK_TASKS: Task[] = [
  {id:"task-001",title:"用户中心核心流程 AI 用例生成",status:"completed",generated:24,reviewed:20,adopted:18,model:"claude-sonnet-5",createdAt:"2026-10-12 09:15:32",operator:"张程远"},
  {id:"task-002",title:"订单支付全链路边界用例",status:"reviewing",generated:31,reviewed:12,adopted:10,model:"claude-sonnet-5",createdAt:"2026-10-12 10:44:01",operator:"李雷"},
  {id:"task-003",title:"商品搜索异常场景补全",status:"generating",generated:8,reviewed:0,adopted:0,model:"claude-haiku-4-5-20251001",createdAt:"2026-10-12 11:02:17",operator:"王芳"},
  {id:"task-004",title:"权限模块回归用例增补",status:"completed",generated:15,reviewed:15,adopted:13,model:"claude-sonnet-5",createdAt:"2026-10-11 16:30:05",operator:"张程远"},
  {id:"task-005",title:"结算中心高并发场景",status:"failed",generated:0,reviewed:0,adopted:0,model:"claude-opus-5-5",createdAt:"2026-10-11 14:22:49",operator:"赵敏"},
  {id:"task-006",title:"登录注册多端兼容用例",status:"completed",generated:19,reviewed:19,adopted:16,model:"claude-sonnet-5",createdAt:"2026-10-10 18:05:33",operator:"李雷"},
];

export function TaskModule() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all"|TaskStatus>("all");

  const filtered = MOCK_TASKS.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });

  const stats = [
    {label:"任务总数",   value:MOCK_TASKS.length,                                                     color:T.t1},
    {label:"已完成",     value:MOCK_TASKS.filter(t=>t.status==="completed").length,                   color:T.success},
    {label:"进行中",     value:MOCK_TASKS.filter(t=>["generating","reviewing"].includes(t.status)).length, color:T.primary},
    {label:"失败",       value:MOCK_TASKS.filter(t=>t.status==="failed").length,                       color:T.danger},
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F4F6FA]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b" style={{borderColor:T.border}}>
        <div className="flex items-center gap-3 mb-1">
          <Timer size={18} style={{color:T.primary}}/>
          <h1 className="text-[16px] font-bold" style={{color:T.t1}}>任务中心</h1>
        </div>
        <p className="text-[12px]" style={{color:T.t3}}>查看所有 AI 用例生成任务的状态、结果和采纳情况</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          {stats.map(s=>(
            <div key={s.label} className="bg-white rounded-xl px-5 py-4 border" style={{borderColor:T.border}}>
              <p className="text-[28px] font-bold" style={{color:s.color}}>{s.value}</p>
              <p className="text-[12px] mt-1" style={{color:T.t3}}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索任务标题或 ID"
              className="h-8 pl-8 pr-3 border rounded-lg text-[12px] outline-none bg-white"
              style={{borderColor:T.border,color:T.t1,width:240}}/>
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{color:T.t3}}/>
          </div>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value as typeof filterStatus)}
            className="h-8 px-3 border rounded-lg text-[12px] outline-none bg-white"
            style={{borderColor:T.border,color:T.t1,width:110}}>
            <option value="all">全部状态</option>
            <option value="completed">已完成</option>
            <option value="generating">生成中</option>
            <option value="reviewing">评审中</option>
            <option value="failed">失败</option>
            <option value="pending">待执行</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden" style={{borderColor:T.border}}>
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{backgroundColor:T.bg,borderBottom:`1px solid ${T.border}`}}>
                {["任务 ID","任务标题","状态","生成数","已评审","已采纳","模型","创建时间","操作人","操作"].map((h,i)=>(
                  <th key={h} className={`px-4 py-2.5 text-left font-medium ${i===9?"text-right":""}`} style={{color:T.t3}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((task,i)=>{
                const sm = STATUS_META[task.status];
                return (
                  <tr key={task.id} className="hover:bg-blue-50/30 transition-colors"
                    style={{borderBottom:`1px solid ${T.border}`,backgroundColor:i%2===0?"#fff":"#FAFBFE"}}>
                    <td className="px-4 py-3 font-mono text-[11px]" style={{color:T.t3}}>{task.id}</td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="font-medium" style={{color:T.t1}}>{task.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                        style={{backgroundColor:sm.bg,color:sm.color}}>
                        {sm.icon}{sm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold" style={{color:T.t1}}>{task.generated||"—"}</span>
                    </td>
                    <td className="px-4 py-3 text-center" style={{color:T.t1}}>{task.reviewed||"—"}</td>
                    <td className="px-4 py-3 text-center">
                      <span style={{color:task.adopted>0?T.success:T.t4}}>{task.adopted||"—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="font-mono text-[11px]" style={{color:T.t3}}>{task.model}</code>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]" style={{color:T.t3}}>{task.createdAt}</td>
                    <td className="px-4 py-3" style={{color:T.t2}}>{task.operator}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100">
                        <button title="查看详情" className="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-50" style={{color:T.t3}}>
                          <Eye size={13}/>
                        </button>
                        <button title="删除" className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50" style={{color:T.t3}}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0&&(
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-[12px]" style={{color:T.t3}}>
                    暂无符合条件的任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
