import React, { useState, useRef } from "react";
import {
  Plus, Search, ChevronLeft, ChevronRight, Edit2, Copy, Play,
  Trash2, Ban, Check, X, AlertTriangle, CheckCircle, XCircle,
  Download, MoreHorizontal, Activity, Folder, FolderOpen,
  ClipboardList, FileText, Eye, User, Save, Filter,
  ExternalLink, Upload, ChevronDown, Link2,
  Archive, RefreshCw, Zap, ArrowRight, Bug, FileCheck, CheckSquare,
  ShieldCheck, ShieldAlert,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";

// ─── Palette ──────────────────────────────────────────────────────────────────
const T = {
  primary:"#0EA5E9", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  cyan:"#0FC6C2",
  teal:"#0D7A5F",    bg:"#F4F6FA",      border:"#E5E6EB",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};
const TM = "#0EA5E9";

// ─── Types ────────────────────────────────────────────────────────────────────
type PlanPurpose  = "version"|"temp";
type PlanType     = "smoke"|"functional"|"regression"|"release"|"mixed";
type PlanStatus   = "draft"|"pending"|"running"|"blocked"|"completed"|"cancelled";
type VersionType  = "iteration"|"release"|"patch"|"hotfix";
type VersionStatus= "planning"|"developing"|"testing"|"pending-release"|"released"|"archived";
type ExecStatus   = "pending"|"passed"|"failed"|"blocked"|"skipped";
type BugSev       = "critical"|"major"|"minor"|"trivial";
type BugSta       = "open"|"fixing"|"fixed"|"closed"|"rejected";

interface TestPlan {
  id:string; no:string; name:string; purpose:PlanPurpose; type:PlanType; status:PlanStatus;
  versionId:string|null; versionName:string|null;
  owner:string; members:string[]; startDate:string; endDate:string;
  scope:number; executed:number; passed:number; failed:number; blockedCases:number;
  p0Bugs:number; p1Bugs:number; updatedAt:string; goal:string;
}
interface Version {
  id:string; no:string; name:string; type:VersionType; status:VersionStatus;
  owner:string; startDate:string; testDate:string; releaseDate:string;
  planCount:number; scope:number; executed:number; passed:number;
  p0Bugs:number; p1Bugs:number; updatedAt:string; goal:string;
}
interface PlanCase {
  id:string; no:string; title:string; module:string;
  priority:"P0"|"P1"|"P2"|"P3"; status:ExecStatus;
  assignee:string; execTime:string; notes:string;
}
interface BugItem {
  id:string; no:string; title:string; severity:BugSev; priority:"P0"|"P1"|"P2"|"P3";
  status:BugSta; assignee:string; foundAt:string; linkedCase:string; planId:string;
}
interface LogEntry {
  id:string; actor:string; action:string; detail:string; time:string;
  type:"create"|"status"|"edit"|"mark"|"comment"|"system";
}
type ReqPriority = "P0"|"P1"|"P2"|"P3";
type ReqStatus   = "uncovered"|"partial"|"covered"|"passed";
type ReqSource   = "manual"|"jira"|"tapd"|"excel";
interface Req {
  id:string; title:string; versionId:string;
  priority:ReqPriority; status:ReqStatus; source:ReqSource; sourceRef?:string;
  reviewStatus:"pending"|"reviewing"|"passed"|"rejected";
  caseTotal:number; caseCovered:number; casePassed:number;
  assignee:string; desc:string; createdAt:string;
  linkedCases?:{
    id:string;no:string;title:string;status:ExecStatus;assignee:string;
    reviewStatus:"pending"|"reviewing"|"passed"|"rejected";reviewNote?:string;
  }[];
  linkedBugs?:{id:string;no:string;title:string;severity:BugSev;status:BugSta}[];
}

// ─── Configs ──────────────────────────────────────────────────────────────────
const REQ_STATUS_CFG:Record<ReqStatus,{label:string;bg:string;color:string}> = {
  uncovered:{label:"未覆盖",  bg:"#F2F3F5",color:"#86909C"},
  partial:  {label:"部分覆盖",bg:"#FFF3E8",color:"#FF7D00"},
  covered:  {label:"已覆盖",  bg:"#E0F5FE",color:"#0EA5E9"},
  passed:   {label:"测试通过",bg:"#E8FFEA",color:"#00B42A"},
};
const REQ_SOURCE_CFG:Record<ReqSource,{label:string;color:string;bg:string}> = {
  manual:{label:"手动", color:"#86909C",bg:"#F2F3F5"},
  jira:  {label:"Jira", color:"#0052CC",bg:"#DEEBFF"},
  tapd:  {label:"禅道", color:"#2563EB",bg:"#EFF6FF"},
  excel: {label:"Excel",color:"#217346",bg:"#ECFDF5"},
};
const REQ_REVIEW_CFG:Record<"pending"|"reviewing"|"passed"|"rejected",{label:string;color:string;bg:string}> = {
  pending:  {label:"待评审",color:"#86909C",bg:"#F2F3F5"},
  reviewing:{label:"评审中",color:"#FF7D00",bg:"#FFF3E8"},
  passed:   {label:"已通过",color:"#00B42A",bg:"#E8FFEA"},
  rejected: {label:"已驳回",color:"#F53F3F",bg:"#FFECEC"},
};
const PRIORITY_CFG:Record<ReqPriority,{color:string;bg:string}> = {
  P0:{color:"#F53F3F",bg:"#FFECEC"},
  P1:{color:"#FF7D00",bg:"#FFF3E8"},
  P2:{color:"#0EA5E9",bg:"#E0F5FE"},
  P3:{color:"#86909C",bg:"#F2F3F5"},
};
const PLAN_STATUS_CFG:Record<PlanStatus,{label:string;bg:string;color:string}> = {
  draft:    {label:"草稿",   bg:"#F2F3F5",color:T.t3},
  pending:  {label:"待开始", bg:"#E8F3FF",color:T.primary},
  running:  {label:"进行中", bg:"#FFF3E8",color:T.warning},
  blocked:  {label:"已阻塞", bg:"#FFE8E8",color:T.danger},
  completed:{label:"已完成", bg:"#E8FFEA",color:T.success},
  cancelled:{label:"已取消", bg:"#F2F3F5",color:T.t3},
};
const PLAN_TYPE_CFG:Record<PlanType,{label:string;color:string}> = {
  smoke:      {label:"冒烟测试", color:"#7816FF"},
  functional: {label:"功能测试", color:T.primary},
  regression: {label:"回归测试", color:TM},
  release:    {label:"发布验证", color:T.warning},
  mixed:      {label:"混合测试", color:T.t2},
};
const VERSION_STATUS_CFG:Record<VersionStatus,{label:string;bg:string;color:string}> = {
  planning:         {label:"规划中", bg:"#F2F3F5", color:T.t3},
  developing:       {label:"开发中", bg:"#E8F3FF", color:T.primary},
  testing:          {label:"测试中", bg:"#FFF3E8", color:T.warning},
  "pending-release":{label:"待发布", bg:"#F5E8FF", color:"#7816FF"},
  released:         {label:"已发布", bg:"#E8FFEA", color:T.success},
  archived:         {label:"已归档", bg:"#F2F3F5", color:T.t3},
};
const VERSION_TYPE_CFG:Record<VersionType,{label:string}> = {
  iteration:{label:"迭代版本"}, release:{label:"正式版本"},
  patch:{label:"补丁版本"},     hotfix:{label:"紧急修复"},
};
const EXEC_STATUS_CFG:Record<ExecStatus,{label:string;color:string;bg:string}> = {
  pending:{label:"未执行", color:T.t3,     bg:"#F2F3F5"},
  passed: {label:"通过",   color:T.success, bg:`${T.success}15`},
  failed: {label:"失败",   color:T.danger,  bg:`${T.danger}12`},
  blocked:{label:"阻塞",   color:T.warning, bg:`${T.warning}15`},
  skipped:{label:"跳过",   color:T.t4,      bg:"#F2F3F5"},
};
const BUG_SEV_CFG:Record<BugSev,{label:string;color:string}> = {
  critical:{label:"致命", color:T.danger},
  major:   {label:"严重", color:T.warning},
  minor:   {label:"一般", color:"#FAAD14"},
  trivial: {label:"轻微", color:T.t3},
};
const BUG_STA_CFG:Record<BugSta,{label:string;bg:string;color:string}> = {
  open:    {label:"待处理", bg:"#FFE8E8", color:T.danger},
  fixing:  {label:"处理中", bg:"#FFF3E8", color:T.warning},
  fixed:   {label:"已修复", bg:"#E8F3FF", color:T.primary},
  closed:  {label:"已关闭", bg:"#E8FFEA", color:T.success},
  rejected:{label:"已拒绝", bg:"#F2F3F5", color:T.t3},
};
const PLAN_STATUS_ACTIONS:Record<PlanStatus,string[]> = {
  draft:    ["edit","start","copy","delete"],
  pending:  ["view","edit","start","copy","cancel"],
  running:  ["view","edit","complete","copy","cancel"],
  blocked:  ["view","edit","copy","cancel"],
  completed:["view","copy"],
  cancelled:["view","copy","delete"],
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_VERSIONS:Version[] = [
  {id:"V1",no:"VER-001",name:"v2.4.0",type:"iteration",status:"testing",owner:"李明",startDate:"2026-06-15",testDate:"2026-07-01",releaseDate:"2026-07-15",planCount:2,scope:80,executed:62,passed:58,p0Bugs:0,p1Bugs:2,updatedAt:"2026-07-07 14:30",goal:"完成用户中心重构和订单模块优化，覆盖全量回归"},
  {id:"V2",no:"VER-002",name:"v2.3.5",type:"patch",status:"pending-release",owner:"王芳",startDate:"2026-06-20",testDate:"2026-06-28",releaseDate:"2026-07-08",planCount:2,scope:48,executed:48,passed:46,p0Bugs:0,p1Bugs:0,updatedAt:"2026-07-05 09:15",goal:"修复线上反馈的3个高优缺陷"},
  {id:"V3",no:"VER-003",name:"v2.5.0",type:"iteration",status:"developing",owner:"陈伟",startDate:"2026-07-08",testDate:"2026-07-28",releaseDate:"2026-08-15",planCount:0,scope:0,executed:0,passed:0,p0Bugs:0,p1Bugs:0,updatedAt:"2026-07-08 10:00",goal:"引入风控中心 2.0 模块，重构任务调度引擎"},
  {id:"V4",no:"VER-004",name:"v2.3.0",type:"release",status:"released",owner:"李明",startDate:"2026-05-20",testDate:"2026-06-01",releaseDate:"2026-06-20",planCount:3,scope:98,executed:98,passed:95,p0Bugs:0,p1Bugs:0,updatedAt:"2026-06-20 17:00",goal:""},
  {id:"V5",no:"VER-005",name:"v2.2.1",type:"hotfix",status:"archived",owner:"张程远",startDate:"2026-05-01",testDate:"2026-05-03",releaseDate:"2026-05-05",planCount:1,scope:12,executed:12,passed:12,p0Bugs:0,p1Bugs:0,updatedAt:"2026-05-05 18:00",goal:""},
];
const MOCK_PLANS:TestPlan[] = [
  {id:"P1",no:"TP-001",name:"v2.4.0 全量回归测试",purpose:"version",type:"regression",status:"running",versionId:"V1",versionName:"v2.4.0",owner:"李明",members:["李明","王芳","陈伟"],startDate:"2026-07-01",endDate:"2026-07-12",scope:80,executed:62,passed:58,failed:4,blockedCases:2,p0Bugs:0,p1Bugs:2,updatedAt:"2026-07-07 16:22",goal:"覆盖用户中心、订单中心全量功能回归"},
  {id:"P2",no:"TP-002",name:"v2.4.0 冒烟验证",purpose:"version",type:"smoke",status:"completed",versionId:"V1",versionName:"v2.4.0",owner:"陈伟",members:["陈伟"],startDate:"2026-07-01",endDate:"2026-07-01",scope:12,executed:12,passed:12,failed:0,blockedCases:0,p0Bugs:0,p1Bugs:0,updatedAt:"2026-07-01 17:00",goal:"提测冒烟验证通过"},
  {id:"P3",no:"TP-003",name:"v2.3.5 补丁回归",purpose:"version",type:"regression",status:"completed",versionId:"V2",versionName:"v2.3.5",owner:"王芳",members:["王芳","李明"],startDate:"2026-06-28",endDate:"2026-07-04",scope:48,executed:48,passed:46,failed:2,blockedCases:0,p0Bugs:0,p1Bugs:0,updatedAt:"2026-07-04 18:00",goal:"验证3个P0缺陷修复正确性"},
  {id:"P4",no:"TP-004",name:"v2.3.5 发布验证",purpose:"version",type:"release",status:"pending",versionId:"V2",versionName:"v2.3.5",owner:"张程远",members:["张程远","李明"],startDate:"2026-07-08",endDate:"2026-07-08",scope:20,executed:0,passed:0,failed:0,blockedCases:0,p0Bugs:0,p1Bugs:0,updatedAt:"2026-07-05 10:00",goal:"发布前核心路径验证"},
  {id:"P5",no:"TP-005",name:"风控规则引擎专项",purpose:"temp",type:"functional",status:"running",versionId:null,versionName:null,owner:"陈伟",members:["陈伟","王芳"],startDate:"2026-07-03",endDate:"2026-07-09",scope:28,executed:18,passed:15,failed:3,blockedCases:1,p0Bugs:1,p1Bugs:0,updatedAt:"2026-07-07 10:15",goal:"风控规则引擎核心逻辑专项验证"},
  {id:"P6",no:"TP-006",name:"订单中心全流程验证",purpose:"temp",type:"functional",status:"draft",versionId:null,versionName:null,owner:"李明",members:["李明"],startDate:"2026-07-10",endDate:"2026-07-14",scope:0,executed:0,passed:0,failed:0,blockedCases:0,p0Bugs:0,p1Bugs:0,updatedAt:"2026-07-08 09:00",goal:""},
];
const INIT_PLAN_CASES:PlanCase[] = [
  {id:"pc1",no:"TC-001",title:"用户登录核心流程",module:"用户中心",priority:"P0",status:"passed",assignee:"李明",execTime:"07-07 10:20",notes:""},
  {id:"pc2",no:"TC-002",title:"账号注册完整流程",module:"用户中心",priority:"P1",status:"passed",assignee:"王芳",execTime:"07-07 10:45",notes:""},
  {id:"pc3",no:"TC-003",title:"密码找回验证码流程",module:"用户中心",priority:"P1",status:"failed",assignee:"李明",execTime:"07-07 11:00",notes:"验证码有效期判断有误，已过期仍可使用"},
  {id:"pc4",no:"TC-004",title:"账号封禁后登录提示",module:"用户中心",priority:"P2",status:"passed",assignee:"王芳",execTime:"07-06 14:30",notes:""},
  {id:"pc5",no:"TC-005",title:"订单创建-支付-完成闭环",module:"订单中心",priority:"P0",status:"passed",assignee:"陈伟",execTime:"07-07 09:10",notes:""},
  {id:"pc6",no:"TC-006",title:"订单批量取消操作",module:"订单中心",priority:"P1",status:"blocked",assignee:"陈伟",execTime:"07-07 09:40",notes:"接口超时，等待开发修复"},
  {id:"pc7",no:"TC-007",title:"商品超卖边界值验证",module:"订单中心",priority:"P1",status:"failed",assignee:"李明",execTime:"07-06 16:00",notes:"并发场景下库存扣减异常"},
  {id:"pc8",no:"TC-008",title:"优惠券叠加规则验证",module:"订单中心",priority:"P2",status:"passed",assignee:"王芳",execTime:"07-06 15:00",notes:""},
  {id:"pc9",no:"TC-009",title:"会员等级升降级逻辑",module:"用户中心",priority:"P2",status:"pending",assignee:"李明",execTime:"—",notes:""},
  {id:"pc10",no:"TC-010",title:"购物车跨店铺结算",module:"订单中心",priority:"P1",status:"pending",assignee:"王芳",execTime:"—",notes:""},
  {id:"pc11",no:"TC-011",title:"退款流程全流程验证",module:"订单中心",priority:"P1",status:"pending",assignee:"陈伟",execTime:"—",notes:""},
  {id:"pc12",no:"TC-012",title:"商品搜索过滤条件",module:"获客中心",priority:"P2",status:"pending",assignee:"—",execTime:"—",notes:""},
];
const MOCK_BUGS:BugItem[] = [
  {id:"b1",no:"BUG-142",title:"密码找回验证码有效期判断错误，已过期仍可使用",severity:"major",priority:"P1",status:"fixing",assignee:"张程远",foundAt:"07-07 11:05",linkedCase:"TC-003",planId:"P1"},
  {id:"b2",no:"BUG-143",title:"商品超卖场景下库存扣减并发问题",severity:"major",priority:"P1",status:"open",assignee:"陈伟",foundAt:"07-06 16:10",linkedCase:"TC-007",planId:"P1"},
  {id:"b3",no:"BUG-138",title:"订单批量取消接口超时，前端无错误提示",severity:"minor",priority:"P2",status:"fixing",assignee:"王芳",foundAt:"07-07 09:45",linkedCase:"TC-006",planId:"P1"},
  {id:"b4",no:"BUG-139",title:"会员等级降级后权益未即时刷新",severity:"minor",priority:"P2",status:"fixed",assignee:"张程远",foundAt:"07-06 14:00",linkedCase:"TC-009",planId:"P1"},
];
const MOCK_PLAN_LOG:LogEntry[] = [
  {id:"l1",actor:"李明",action:"标记用例通过",detail:"TC-001「用户登录核心流程」→ 通过",time:"07-07 10:20",type:"mark"},
  {id:"l2",actor:"李明",action:"标记用例失败",detail:"TC-003「密码找回验证码流程」→ 失败，备注：验证码有效期判断有误",time:"07-07 11:00",type:"mark"},
  {id:"l3",actor:"陈伟",action:"标记用例阻塞",detail:"TC-006「订单批量取消操作」→ 阻塞，等待开发修复",time:"07-07 09:40",type:"mark"},
  {id:"l4",actor:"王芳",action:"新建缺陷关联",detail:"BUG-143 关联至 TC-007",time:"07-06 16:10",type:"comment"},
  {id:"l5",actor:"李明",action:"调整用例分配",detail:"TC-009 分配给「李明」",time:"07-06 19:00",type:"edit"},
  {id:"l6",actor:"系统",action:"计划状态变更",detail:"草稿 → 进行中",time:"07-01 09:00",type:"status"},
  {id:"l7",actor:"李明",action:"创建测试计划",detail:"新建「v2.4.0 全量回归测试」",time:"06-28 17:00",type:"create"},
];
const MOCK_VERSION_LOG:LogEntry[] = [
  {id:"vl1",actor:"李明",action:"提交质量准出",detail:"已申请准出审核，等待确认",time:"07-07 18:00",type:"status"},
  {id:"vl2",actor:"系统",action:"计划状态变更",detail:"「v2.4.0 冒烟验证」→ 已完成",time:"07-01 17:00",type:"status"},
  {id:"vl3",actor:"陈伟",action:"关联测试计划",detail:"「v2.4.0 全量回归测试」已关联至本版本",time:"07-01 09:00",type:"edit"},
  {id:"vl4",actor:"王芳",action:"更新提测日期",detail:"计划提测 → 2026-07-01",time:"06-29 11:00",type:"edit"},
  {id:"vl5",actor:"系统",action:"版本状态变更",detail:"开发中 → 测试中",time:"06-30 09:00",type:"status"},
  {id:"vl6",actor:"陈伟",action:"创建版本",detail:"新建版本「v2.4.0」迭代版本",time:"06-15 10:00",type:"create"},
];
const MOCK_REQS:Req[] = [
  {id:"R1",title:"用户登录体验优化",versionId:"V1",priority:"P1",status:"passed",reviewStatus:"reviewing",source:"jira",sourceRef:"PROJ-240",caseTotal:3,caseCovered:3,casePassed:2,assignee:"李明",desc:"优化登录页面体验，支持手机号+验证码快捷登录，增加账号安全检测提示，历史登录设备管理。",createdAt:"2026-06-15",
    linkedCases:[
      {id:"c1",no:"TC-001",title:"用户登录核心流程",status:"passed",assignee:"李明",reviewStatus:"passed"},
      {id:"c2",no:"TC-002",title:"账号注册完整流程",status:"passed",assignee:"王芳",reviewStatus:"passed"},
      {id:"c3",no:"TC-003",title:"密码找回验证码流程",status:"failed",assignee:"李明",reviewStatus:"rejected",reviewNote:"步骤 4 缺少验证码过期的异常场景，需补充后重新提交"},
    ],
    linkedBugs:[{id:"b1",no:"BUG-142",title:"密码找回验证码有效期判断错误，已过期仍可使用",severity:"major",status:"fixing"}]},
  {id:"R2",title:"订单批量操作功能",versionId:"V1",priority:"P0",status:"partial",reviewStatus:"reviewing",source:"jira",sourceRef:"PROJ-238",caseTotal:4,caseCovered:3,casePassed:1,assignee:"陈伟",desc:"支持订单批量取消、批量导出，实现商品超卖保护逻辑，优化库存锁定与扣减机制，提升高并发下系统可靠性。",createdAt:"2026-06-15",
    linkedCases:[
      {id:"c4",no:"TC-007",title:"订单创建-支付-完成闭环",status:"passed",assignee:"陈伟",reviewStatus:"passed"},
      {id:"c5",no:"TC-008",title:"订单批量取消操作",status:"blocked",assignee:"陈伟",reviewStatus:"reviewing"},
      {id:"c6",no:"TC-009",title:"商品超卖边界值验证",status:"failed",assignee:"李明",reviewStatus:"reviewing"},
    ],
    linkedBugs:[{id:"b2",no:"BUG-143",title:"商品超卖场景下库存扣减并发问题",severity:"major",status:"open"},{id:"b3",no:"BUG-138",title:"订单批量取消接口超时，前端无错误提示",severity:"minor",status:"fixing"}]},
  {id:"R3",title:"购物车跨店铺结算",versionId:"V1",priority:"P1",status:"covered",reviewStatus:"passed",source:"manual",caseTotal:2,caseCovered:2,casePassed:0,assignee:"王芳",desc:"支持跨店铺购物车合并结算，优惠券按店铺分组计算，运费合并策略，提升用户结算体验。",createdAt:"2026-06-18",
    linkedCases:[
      {id:"c7",no:"TC-010",title:"优惠券叠加规则验证",status:"passed",assignee:"王芳",reviewStatus:"passed"},
      {id:"c8",no:"TC-012",title:"购物车跨店铺结算",status:"pending",assignee:"王芳",reviewStatus:"passed"},
    ],
    linkedBugs:[]},
  {id:"R4",title:"会员等级权益优化",versionId:"V1",priority:"P2",status:"partial",reviewStatus:"pending",source:"tapd",sourceRef:"TAPD-1892",caseTotal:2,caseCovered:1,casePassed:0,assignee:"李明",desc:"优化会员等级升降级逻辑，权益变更实时生效，增加降级原因通知，会员积分有效期提醒。",createdAt:"2026-06-20",
    linkedCases:[
      {id:"c9",no:"TC-013",title:"会员等级升降级逻辑",status:"pending",assignee:"李明",reviewStatus:"pending"},
    ],
    linkedBugs:[{id:"b4",no:"BUG-139",title:"会员等级降级后权益未即时刷新",severity:"minor",status:"fixed"}]},
  {id:"R5",title:"验证码有效期安全修复",versionId:"V2",priority:"P0",status:"passed",reviewStatus:"passed",source:"jira",sourceRef:"BUG-142",caseTotal:1,caseCovered:1,casePassed:1,assignee:"张程远",desc:"修复密码找回验证码有效期判断逻辑，确保已过期验证码无法使用，防止账号被盗风险。",createdAt:"2026-06-20",
    linkedCases:[{id:"c10",no:"TC-003",title:"密码找回验证码流程",status:"passed",assignee:"李明",reviewStatus:"passed"}],
    linkedBugs:[]},
  {id:"R6",title:"接口超时优化修复",versionId:"V2",priority:"P0",status:"passed",reviewStatus:"passed",source:"jira",sourceRef:"BUG-138",caseTotal:1,caseCovered:1,casePassed:1,assignee:"王芳",desc:"优化订单批量操作接口性能，增加前端超时提示，服务端接口超时时间调整，完善异常重试机制。",createdAt:"2026-06-21",
    linkedCases:[{id:"c11",no:"TC-008",title:"订单批量取消操作",status:"passed",assignee:"陈伟",reviewStatus:"passed"}],
    linkedBugs:[]},
  {id:"R7",title:"风控中心2.0引擎重构",versionId:"V3",priority:"P0",status:"uncovered",reviewStatus:"pending",source:"manual",caseTotal:0,caseCovered:0,casePassed:0,assignee:"陈伟",desc:"重构风控规则引擎，支持动态规则配置，引入机器学习风险评分，规则命中延迟从100ms降至20ms，增强可解释性。",createdAt:"2026-07-08",linkedCases:[],linkedBugs:[]},
  {id:"R8",title:"任务调度引擎重构",versionId:"V3",priority:"P1",status:"uncovered",reviewStatus:"pending",source:"manual",caseTotal:0,caseCovered:0,casePassed:0,assignee:"陈伟",desc:"重构任务调度系统，支持DAG任务依赖关系，分布式锁优化，任务执行历史持久化与可视化监控。",createdAt:"2026-07-08",linkedCases:[],linkedBugs:[]},
  {id:"R9",title:"活动运营平台升级",versionId:"V3",priority:"P1",status:"uncovered",reviewStatus:"pending",source:"tapd",sourceRef:"TAPD-2055",caseTotal:0,caseCovered:0,casePassed:0,assignee:"王芳",desc:"活动报名支持多规格SKU选择，活动数据大盘实时更新，优惠力度分析报表，秒杀活动库存分片管理。",createdAt:"2026-07-09",linkedCases:[],linkedBugs:[]},
];
const EXEC_TREND = [
  {date:"07/01",通过:8,失败:2,阻塞:1},{date:"07/02",通过:12,失败:3,阻塞:0},
  {date:"07/03",通过:10,失败:4,阻塞:2},{date:"07/04",通过:15,失败:2,阻塞:1},
  {date:"07/05",通过:13,失败:3,阻塞:0},{date:"07/06",通过:18,失败:1,阻塞:1},
  {date:"07/07",通过:14,失败:3,阻塞:2},
];
const LOG_COLOR:Record<string,{color:string;bg:string}> = {
  create: {color:TM,   bg:`${TM}15`},
  status: {color:T.primary,bg:`${T.primary}12`},
  edit:   {color:T.t3, bg:"#F2F3F5"},
  mark:   {color:T.warning,bg:`${T.warning}15`},
  comment:{color:T.purple,bg:`${T.purple}12`},
  system: {color:T.t4, bg:"#F2F3F5"},
};

// ─── Case library (for picker) ────────────────────────────────────────────────
interface DirNode { id:string; label:string; count:number; children?:DirNode[]; }

const CASE_DIR_TREE:DirNode[] = [{
  id:"root", label:"X-MAN", count:18, children:[
    {id:"user", label:"用户中心", count:7, children:[
      {id:"user-account",  label:"账号管理", count:4},
      {id:"user-security", label:"安全设置", count:2},
      {id:"user-member",   label:"会员管理", count:1},
    ]},
    {id:"order", label:"订单中心管理端", count:7, children:[
      {id:"order-core",   label:"订单核心", count:3},
      {id:"order-promo",  label:"营销计算", count:1},
      {id:"order-return", label:"售后流程", count:3},
    ]},
    {id:"growth", label:"获客中心", count:3, children:[
      {id:"growth-search", label:"搜索推荐", count:2},
      {id:"growth-event",  label:"活动运营", count:1},
    ]},
    {id:"risk", label:"风控中心", count:2, children:[
      {id:"risk-rule",  label:"规则引擎",   count:1},
      {id:"risk-block", label:"黑名单管理", count:1},
    ]},
  ],
}];

function collectDirIds(node:DirNode):string[]{
  const ids=[node.id];
  if(node.children)node.children.forEach(c=>ids.push(...collectDirIds(c)));
  return ids;
}
function findDirNode(node:DirNode,id:string):DirNode|null{
  if(node.id===id)return node;
  if(node.children)for(const c of node.children){const f=findDirNode(c,id);if(f)return f;}
  return null;
}

const CASE_LIB = [
  {id:"cl1", no:"TC-001",title:"用户登录核心流程",       dir:"user-account",  module:"用户中心", priority:"P0"},
  {id:"cl2", no:"TC-002",title:"账号注册完整流程",       dir:"user-account",  module:"用户中心", priority:"P1"},
  {id:"cl3", no:"TC-003",title:"密码找回验证码流程",     dir:"user-account",  module:"用户中心", priority:"P1"},
  {id:"cl4", no:"TC-004",title:"账号封禁后登录提示",     dir:"user-account",  module:"用户中心", priority:"P2"},
  {id:"cl5", no:"TC-005",title:"三方账号绑定解绑",       dir:"user-security", module:"用户中心", priority:"P2"},
  {id:"cl6", no:"TC-006",title:"账号安全设置完整流程",   dir:"user-security", module:"用户中心", priority:"P2"},
  {id:"cl7", no:"TC-007",title:"订单创建-支付-完成闭环", dir:"order-core",    module:"订单中心", priority:"P0"},
  {id:"cl8", no:"TC-008",title:"订单批量取消操作",       dir:"order-core",    module:"订单中心", priority:"P1"},
  {id:"cl9", no:"TC-009",title:"商品超卖边界值验证",     dir:"order-core",    module:"订单中心", priority:"P1"},
  {id:"cl10",no:"TC-010",title:"优惠券叠加规则验证",     dir:"order-promo",   module:"订单中心", priority:"P2"},
  {id:"cl11",no:"TC-011",title:"退款流程全流程验证",     dir:"order-return",  module:"订单中心", priority:"P1"},
  {id:"cl12",no:"TC-012",title:"购物车跨店铺结算",       dir:"order-return",  module:"订单中心", priority:"P1"},
  {id:"cl13",no:"TC-013",title:"会员等级升降级逻辑",     dir:"user-member",   module:"用户中心", priority:"P2"},
  {id:"cl14",no:"TC-014",title:"商品搜索过滤条件",       dir:"growth-search", module:"获客中心", priority:"P2"},
  {id:"cl15",no:"TC-015",title:"首页推荐位展示逻辑",     dir:"growth-search", module:"获客中心", priority:"P2"},
  {id:"cl16",no:"TC-016",title:"活动报名全流程",         dir:"growth-event",  module:"获客中心", priority:"P1"},
  {id:"cl17",no:"TC-017",title:"风控规则命中场景",       dir:"risk-rule",     module:"风控中心", priority:"P0"},
  {id:"cl18",no:"TC-018",title:"黑名单拦截验证",         dir:"risk-block",    module:"风控中心", priority:"P1"},
];

const CASE_STEPS: Record<string,{precondition:string;steps:{action:string;expected:string}[]}> = {
  "TC-001":{
    precondition:"用户已完成注册，当前处于未登录状态，网络环境正常",
    steps:[
      {action:"打开登录页面，选择「手机号 + 密码」登录方式",expected:"页面正常加载，输入框可交互，无报错"},
      {action:"输入已注册的正确手机号",expected:"手机号格式验证通过，不显示错误提示"},
      {action:"输入正确密码，点击「登录」按钮",expected:"按钮出现加载态，3s 内跳转至首页"},
      {action:"观察首页右上角用户信息区域",expected:"显示用户头像与昵称，确认登录态生效"},
      {action:"刷新页面后再次检查登录态",expected:"登录状态保持，不重复弹出登录框"},
    ]
  },
  "TC-002":{
    precondition:"手机号未注册过账号，短信验证码服务正常",
    steps:[
      {action:"点击登录页「立即注册」链接",expected:"跳转至注册页，展示手机号输入框"},
      {action:"输入未注册的手机号，点击「获取验证码」",expected:"60s 倒计时启动，短信正常下发"},
      {action:"输入正确的 6 位验证码",expected:"验证码验证通过，进入填写昵称步骤"},
      {action:"填写昵称并设置密码，点击「完成注册」",expected:"注册成功提示，自动登录并跳转首页"},
    ]
  },
  "TC-003":{
    precondition:"用户已有注册账号，可正常接收短信",
    steps:[
      {action:"点击登录页「忘记密码」",expected:"进入找回密码页面"},
      {action:"输入已注册手机号，获取验证码",expected:"短信正常下发，60s 内有效"},
      {action:"输入验证码，进入重置密码步骤",expected:"验证码校验通过，展示新密码输入框"},
      {action:"输入新密码（满足复杂度要求）并确认",expected:"密码重置成功提示"},
      {action:"使用新密码登录",expected:"登录成功，旧密码不再可用"},
    ]
  },
  "TC-007":{
    precondition:"用户已登录，购物车内有至少一件在售商品，支付账户余额充足",
    steps:[
      {action:"进入购物车，勾选目标商品，点击「结算」",expected:"跳转至结算页，商品信息、价格正确"},
      {action:"确认收货地址和配送方式，点击「提交订单」",expected:"订单创建成功，跳转支付页，展示待支付金额"},
      {action:"选择余额支付，输入支付密码确认",expected:"支付成功页面出现，展示订单号"},
      {action:"进入「我的订单」查看该订单",expected:"订单状态为「待发货」，金额与页面一致"},
    ]
  },
  "TC-008":{
    precondition:"用户已登录，「我的订单」中有 3 条以上「待付款」状态订单",
    steps:[
      {action:"进入订单列表，切换至「待付款」tab",expected:"订单列表正常展示"},
      {action:"点击列表顶部「批量操作」，勾选 3 条订单",expected:"选中状态高亮，底部浮出批量操作栏"},
      {action:"点击「批量取消」",expected:"弹出确认弹窗，提示即将取消 3 条订单"},
      {action:"点击确认取消",expected:"3 条订单均变为「已取消」，库存对应释放"},
    ]
  },
};
const getSteps=(no:string)=>CASE_STEPS[no]??{
  precondition:"系统处于正常运行状态，测试数据已就绪",
  steps:[
    {action:"按照用例标题描述的场景准备初始状态",expected:"初始状态符合前置条件"},
    {action:"执行主流程操作",expected:"系统按预期响应，功能正常"},
    {action:"验证返回结果和数据一致性",expected:"结果与需求描述一致，无异常"},
  ]
};

// ─── Shared Atoms ─────────────────────────────────────────────────────────────
function PBtn({children,onClick,icon:Icon,small,color=T.primary,variant="primary",disabled}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;variant?:"primary"|"ghost";disabled?:boolean}){
  const ghost=variant==="ghost";
  return(
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 font-medium rounded-lg transition-all ${small?"h-7 px-2.5 text-[12px]":"h-8 px-3 text-[13px]"}`}
      style={{backgroundColor:ghost?"transparent":disabled?T.t4:color,color:ghost?T.t2:"#fff",border:`1px solid ${ghost?T.border:"transparent"}`,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.6:1}}
      onMouseEnter={e=>{if(!disabled&&ghost){e.currentTarget.style.backgroundColor=T.bg;e.currentTarget.style.color=T.t1;}}}
      onMouseLeave={e=>{if(!disabled&&ghost){e.currentTarget.style.backgroundColor="transparent";e.currentTarget.style.color=T.t2;}}}>
      {Icon&&<Icon size={small?11:13}/>}{children}
    </button>
  );
}
function IBtn({icon:Icon,label,danger,onClick}:{icon:React.ElementType;label:string;danger?:boolean;onClick?:()=>void}){
  return(
    <button title={label} onClick={e=>{e.stopPropagation();onClick?.();}}
      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{color:T.t4}}
      onMouseEnter={e=>{e.currentTarget.style.color=danger?T.danger:T.t1;e.currentTarget.style.backgroundColor=danger?"#FFF0F0":"#F2F3F5";}}
      onMouseLeave={e=>{e.currentTarget.style.color=T.t4;e.currentTarget.style.backgroundColor="transparent";}}>
      <Icon size={13}/>
    </button>
  );
}
function StatusBadge({label,bg,color}:{label:string;bg:string;color:string}){
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium" style={{backgroundColor:bg,color}}>{label}</span>;
}
function MiniStat({value,label,color=T.t1}:{value:string|number;label:string;color?:string}){
  return(
    <div className="flex items-center gap-3 px-5">
      <div>
        <div className="text-[22px] font-bold leading-none" style={{color}}>{value}</div>
        <div className="text-[12px] mt-1" style={{color:T.t3}}>{label}</div>
      </div>
    </div>
  );
}
function ProgressBar({value,total,color=TM,height=6}:{value:number;total:number;color?:string;height?:number}){
  const pct=total>0?Math.round((value/total)*100):0;
  return(
    <div className="flex items-center gap-2">
      <div style={{flex:1,height,backgroundColor:"#F2F3F5",borderRadius:height}}>
        <div style={{width:`${pct}%`,height,backgroundColor:color,borderRadius:height,transition:"width 0.3s"}}/>
      </div>
      <span className="text-[11px] font-medium" style={{color:T.t2,minWidth:28,textAlign:"right"}}>{pct}%</span>
    </div>
  );
}
function LogTimeline({entries}:{entries:LogEntry[]}){
  return(
    <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px"}}>
      {entries.length===0&&<div style={{textAlign:"center",padding:32,fontSize:13,color:T.t4}}>暂无操作记录</div>}
      {entries.map((e,i)=>(
        <div key={e.id} style={{display:"flex",gap:14,paddingBottom:i<entries.length-1?18:0}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:LOG_COLOR[e.type]?.bg||"#F2F3F5",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:13,fontWeight:700,color:LOG_COLOR[e.type]?.color||T.t3}}>{e.actor.slice(0,1)}</span>
            </div>
            {i<entries.length-1&&<div style={{width:1,flex:1,background:T.border,minHeight:18,marginTop:4}}/>}
          </div>
          <div style={{flex:1,paddingTop:5}}>
            <div style={{display:"flex",alignItems:"baseline",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:13,fontWeight:600,color:T.t1}}>{e.actor}</span>
              <span style={{fontSize:12,color:T.t2}}>{e.action}</span>
              <span style={{fontSize:11,color:T.t4,marginLeft:"auto",whiteSpace:"nowrap"}}>{e.time}</span>
            </div>
            <div style={{fontSize:12,color:T.t3,marginTop:4}}>{e.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Action Menu ──────────────────────────────────────────────────────────────
function ActionMenu({status,onView,onEdit,onStart,onComplete,onCopy,onCancel,onDelete}:{status:PlanStatus;onView?:()=>void;onEdit?:()=>void;onStart?:()=>void;onComplete?:()=>void;onCopy?:()=>void;onCancel?:()=>void;onDelete?:()=>void}){
  const [open,setOpen]=useState(false);
  const actions=PLAN_STATUS_ACTIONS[status];
  const items:{key:string;label:string;icon:React.ElementType;danger?:boolean;fn?:()=>void}[]=[
    {key:"view",    label:"查看详情", icon:Eye,         fn:onView},
    {key:"edit",    label:"编辑",     icon:Edit2,       fn:onEdit},
    {key:"start",   label:"开始测试", icon:Play,        fn:onStart},
    {key:"complete",label:"完成计划", icon:CheckCircle, fn:onComplete},
    {key:"copy",    label:"复制计划", icon:Copy,        fn:onCopy},
    {key:"cancel",  label:"取消计划", icon:Ban,         danger:true, fn:onCancel},
    {key:"delete",  label:"删除草稿", icon:Trash2,      danger:true, fn:onDelete},
  ].filter(m=>actions.includes(m.key));
  return(
    <div className="relative" onClick={e=>e.stopPropagation()}>
      <button onClick={()=>setOpen(v=>!v)} className="w-7 h-7 flex items-center justify-center rounded-md" style={{color:T.t4}}
        onMouseEnter={e=>{e.currentTarget.style.color=T.t1;e.currentTarget.style.backgroundColor="#F2F3F5";}}
        onMouseLeave={e=>{e.currentTarget.style.color=T.t4;e.currentTarget.style.backgroundColor="transparent";}}>
        <MoreHorizontal size={14}/>
      </button>
      {open&&(
        <>
          <div className="fixed inset-0 z-40" onClick={()=>setOpen(false)}/>
          <div className="absolute right-0 top-8 z-50 bg-white rounded-xl py-1 min-w-[128px]" style={{boxShadow:"0 8px 24px rgba(0,0,0,0.12)",border:`1px solid ${T.border}`}}>
            {items.map(m=>(
              <button key={m.key} onClick={()=>{setOpen(false);m.fn?.();}}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left"
                style={{color:m.danger?T.danger:T.t2}}
                onMouseEnter={e=>e.currentTarget.style.backgroundColor=m.danger?"#FFF5F5":T.bg}
                onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>
                <m.icon size={12}/>{m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

function Spinner({size=16,color=TM}:{size?:number;color?:string}){
  return(
    <span style={{display:"inline-block",width:size,height:size,border:`2px solid ${color}40`,borderTopColor:color,borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>
  );
}

function ErrorBanner({msg,onRetry}:{msg:string;onRetry?:()=>void}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,background:`${T.danger}08`,border:`1px solid ${T.danger}30`,marginBottom:16}}>
      <AlertTriangle size={14} style={{color:T.danger,flexShrink:0}}/>
      <span style={{fontSize:12,color:T.danger,flex:1}}>{msg}</span>
      {onRetry&&<button onClick={onRetry} style={{fontSize:12,color:TM,border:"none",background:"none",cursor:"pointer",fontWeight:500,flexShrink:0}}>重试</button>}
    </div>
  );
}

function ModalShell({title,subtitle,width=480,onClose,children,footer}:{
  title:string;subtitle?:string;width?:number;onClose?:()=>void;
  children:React.ReactNode;footer:React.ReactNode;
}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(29,33,41,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width,background:"#fff",borderRadius:16,boxShadow:"0 20px 60px rgba(0,0,0,0.18)",display:"flex",flexDirection:"column",maxHeight:"90vh",overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:56,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:T.t1}}>{title}</div>
            {subtitle&&<div style={{fontSize:11,color:T.t3,marginTop:1}}>{subtitle}</div>}
          </div>
          {onClose&&<button onClick={onClose} style={{width:28,height:28,border:"none",background:"transparent",cursor:"pointer",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:T.t3}}><X size={15}/></button>}
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"24px",minHeight:0}}>{children}</div>
        <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",justifyContent:"flex-end",gap:8}}>{footer}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// P0-A: PLAN ACTION MODAL
// Unified confirm/form modal for: start | complete | block | resume | cancel | delete
// ═══════════════════════════════════════════════════════════════════════════════
type PlanActionType="start"|"complete"|"block"|"resume"|"cancel"|"delete";
type ModalPhase="form"|"loading"|"error";

const PLAN_ACTION_CFG:{[K in PlanActionType]:{
  title:string;icon:React.ElementType;confirmLabel:string;confirmColor:string;
  danger?:boolean;needsReason?:boolean;reasonLabel?:string;desc:string;
}}={
  start:   {title:"开始测试",icon:Play,confirmLabel:"开始测试",confirmColor:TM,desc:"计划将从「未开始」切换为「进行中」，执行人员可开始提交执行结果。"},
  complete:{title:"完成计划",icon:CheckCircle,confirmLabel:"确认完成",confirmColor:T.success,desc:"完成后计划进入「已完成」状态，不可继续执行用例。请确认所有关键指标已满足。"},
  block:   {title:"标记阻塞",icon:AlertTriangle,confirmLabel:"确认阻塞",confirmColor:T.warning,needsReason:true,reasonLabel:"阻塞原因",desc:"计划将切换为「已阻塞」，请填写阻塞原因以便团队跟进处理。"},
  resume:  {title:"恢复计划",icon:RefreshCw,confirmLabel:"恢复计划",confirmColor:TM,desc:"计划将从「已阻塞」恢复为「进行中」，执行人员可继续提交结果。"},
  cancel:  {title:"取消计划",icon:Ban,confirmLabel:"确认取消",confirmColor:T.danger,danger:true,needsReason:true,reasonLabel:"取消原因",desc:"取消后计划进入「已取消」状态，相关数据将保留但不可编辑。"},
  delete:  {title:"删除草稿",icon:Trash2,confirmLabel:"确认删除",confirmColor:T.danger,danger:true,desc:"此操作不可撤回。草稿将被永久删除，关联的用例配置也会同步清除。"},
};

function PlanActionModal({action,planName,onClose,onDone}:{
  action:PlanActionType;planName:string;onClose:()=>void;onDone?:()=>void;
}){
  const cfg=PLAN_ACTION_CFG[action];
  const Icon=cfg.icon;
  const [phase,setPhase]=useState<ModalPhase>("form");
  const [reason,setReason]=useState("");
  const [reasonErr,setReasonErr]=useState(false);
  const [forceNote,setForceNote]=useState("");
  const [showForce,setShowForce]=useState(false);
  const qualityPassed=QUALITY_CHECKS.filter(q=>q.pass).length;
  const qualityOk=qualityPassed===QUALITY_CHECKS.length;

  const handleConfirm=()=>{
    if(cfg.needsReason&&!reason.trim()){setReasonErr(true);return;}
    if(action==="complete"&&!qualityOk&&!showForce){setShowForce(true);return;}
    if(action==="complete"&&showForce&&!forceNote.trim())return;
    setPhase("loading");
    setTimeout(()=>{onDone?.();onClose();},1400);
  };

  const accentColor=cfg.danger?T.danger:TM;
  return(
    <ModalShell title={cfg.title} subtitle={planName} width={action==="complete"?520:440}
      onClose={phase==="loading"?undefined:onClose}
      footer={phase==="error"?(
        <>
          <PBtn variant="ghost" onClick={onClose}>关闭</PBtn>
          <PBtn color={TM} icon={RefreshCw} onClick={()=>setPhase("form")}>重新提交</PBtn>
        </>
      ):(
        <>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <button onClick={handleConfirm} disabled={phase==="loading"||(action==="complete"&&showForce&&!forceNote.trim())}
            style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",
              background:cfg.confirmColor,color:"#fff",display:"flex",alignItems:"center",gap:6,
              opacity:(phase==="loading"||(action==="complete"&&showForce&&!forceNote.trim()))?0.6:1}}>
            {phase==="loading"?<><Spinner size={13} color="#fff"/>处理中…</>:<><Icon size={13}/>{cfg.confirmLabel}</>}
          </button>
        </>
      )}
    >
      {phase==="error"&&<ErrorBanner msg="操作失败，服务器返回错误，请稍后重试。" onRetry={()=>setPhase("form")}/>}

      {/* Icon + desc */}
      <div style={{display:"flex",gap:14,marginBottom:16}}>
        <div style={{width:40,height:40,borderRadius:10,background:`${accentColor}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Icon size={18} style={{color:accentColor}}/>
        </div>
        <div style={{flex:1,fontSize:13,color:T.t1,lineHeight:1.7,paddingTop:4}}>{cfg.desc}</div>
      </div>

      {/* complete: quality checklist */}
      {action==="complete"&&(
        <div style={{borderRadius:10,border:`1px solid ${T.border}`,overflow:"hidden",marginBottom:showForce?16:0}}>
          <div style={{padding:"9px 14px",background:"#FAFBFE",borderBottom:`1px solid ${T.border}`,fontSize:12,fontWeight:600,color:T.t2,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>质量检查</span>
            <span style={{color:qualityOk?T.success:T.warning}}>{qualityPassed}/{QUALITY_CHECKS.length} 项达标</span>
          </div>
          {QUALITY_CHECKS.map((q,i)=>(
            <div key={q.label} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderBottom:i<QUALITY_CHECKS.length-1?`1px solid ${T.border}`:"none",background:q.pass?`${T.success}04`:`${T.danger}04`}}>
              {q.pass?<CheckCircle size={13} style={{color:T.success}}/>:<XCircle size={13} style={{color:T.danger}}/>}
              <span style={{flex:1,fontSize:12,color:T.t1}}>{q.label}</span>
              <span style={{fontSize:11,color:T.t3,marginRight:8}}>目标 {q.target}</span>
              <span style={{fontSize:12,fontWeight:600,color:q.pass?T.success:T.danger}}>{q.current}</span>
            </div>
          ))}
        </div>
      )}

      {/* complete: force note */}
      {action==="complete"&&showForce&&(
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:8,background:`${T.warning}10`,border:`1px solid ${T.warning}30`,marginBottom:12}}>
            <AlertTriangle size={13} style={{color:T.warning,flexShrink:0}}/>
            <span style={{fontSize:12,color:T.warning}}>存在 {QUALITY_CHECKS.length-qualityPassed} 项未达标，强制完成需填写原因。</span>
          </div>
          <label style={{display:"block",fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>强制完成原因 <span style={{color:T.danger}}>*</span></label>
          <textarea value={forceNote} onChange={e=>setForceNote(e.target.value)} rows={3} placeholder="请填写强制完成的业务原因…"
            style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"8px 10px",fontSize:13,color:T.t1,outline:"none",resize:"none",boxSizing:"border-box"}}/>
        </div>
      )}

      {/* block/cancel: reason */}
      {cfg.needsReason&&(
        <div>
          <label style={{display:"block",fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>{cfg.reasonLabel} <span style={{color:T.danger}}>*</span></label>
          <textarea value={reason} onChange={e=>{setReason(e.target.value);setReasonErr(false);}} rows={3} placeholder={`请填写${cfg.reasonLabel}…`}
            style={{width:"100%",border:`1.5px solid ${reasonErr?T.danger:T.border}`,borderRadius:8,padding:"8px 10px",fontSize:13,color:T.t1,outline:"none",resize:"none",boxSizing:"border-box"}}/>
          {reasonErr&&<div style={{fontSize:11,color:T.danger,marginTop:4}}>此项为必填</div>}
        </div>
      )}
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// P0-B: VERSION STATUS TRANSITION MODAL
// ═══════════════════════════════════════════════════════════════════════════════
type VersionActionType="start-dev"|"start-test"|"mark-release"|"release"|"archive";

const VERSION_ACTION_CFG:{[K in VersionActionType]:{
  title:string;icon:React.ElementType;confirmLabel:string;confirmColor:string;
  fromLabel:string;toLabel:string;desc:string;danger?:boolean;
}}={
  "start-dev":   {title:"开始开发",icon:Play,confirmLabel:"开始开发",confirmColor:TM,fromLabel:"规划中",toLabel:"开发中",desc:"版本将进入开发阶段，研发人员可开始认领任务。"},
  "start-test":  {title:"开始测试",icon:Play,confirmLabel:"开始测试",confirmColor:TM,fromLabel:"开发中",toLabel:"测试中",desc:"版本切换为「测试中」，测试团队可创建并执行测试计划。"},
  "mark-release":{title:"标记待发布",icon:CheckSquare,confirmLabel:"标记待发布",confirmColor:"#7816FF",fromLabel:"测试中",toLabel:"待发布",desc:"版本将进入待发布队列，等待发布负责人最终确认。"},
  "release":     {title:"发布版本",icon:Zap,confirmLabel:"确认发布",confirmColor:T.success,fromLabel:"待发布",toLabel:"已发布",desc:"版本将正式标记为已发布，请确认所有准出条件已满足，生产环境已准备就绪。"},
  "archive":     {title:"归档版本",icon:Archive,confirmLabel:"确认归档",confirmColor:T.t3,fromLabel:"已发布",toLabel:"已归档",danger:true,desc:"归档后不可再添加测试计划或修改状态，相关数据将长期保留。"},
};

function VersionStatusModal({action,versionName,onClose,onDone}:{
  action:VersionActionType;versionName:string;onClose:()=>void;onDone?:()=>void;
}){
  const cfg=VERSION_ACTION_CFG[action];
  const Icon=cfg.icon;
  const [phase,setPhase]=useState<ModalPhase>("form");
  const accentColor=cfg.danger?T.t3:cfg.confirmColor;

  const handleConfirm=()=>{
    setPhase("loading");
    setTimeout(()=>{onDone?.();onClose();},1200);
  };

  return(
    <ModalShell title={cfg.title} subtitle={versionName} width={440}
      onClose={phase==="loading"?undefined:onClose}
      footer={phase==="error"?(
        <>
          <PBtn variant="ghost" onClick={onClose}>关闭</PBtn>
          <PBtn color={TM} icon={RefreshCw} onClick={()=>setPhase("form")}>重新提交</PBtn>
        </>
      ):(
        <>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <button onClick={handleConfirm} disabled={phase==="loading"}
            style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",
              background:cfg.confirmColor,color:"#fff",display:"flex",alignItems:"center",gap:6,opacity:phase==="loading"?0.65:1}}>
            {phase==="loading"?<><Spinner size={13} color="#fff"/>处理中…</>:<><Icon size={13}/>{cfg.confirmLabel}</>}
          </button>
        </>
      )}
    >
      {phase==="error"&&<ErrorBanner msg="状态更新失败，请稍后重试。" onRetry={()=>setPhase("form")}/>}
      <div style={{display:"flex",gap:14,marginBottom:20}}>
        <div style={{width:44,height:44,borderRadius:12,background:`${accentColor}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Icon size={20} style={{color:accentColor}}/>
        </div>
        <div style={{flex:1,fontSize:13,color:T.t1,lineHeight:1.7,paddingTop:4}}>{cfg.desc}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderRadius:8,background:"#F7F8FA",border:`1px solid ${T.border}`}}>
        <span style={{fontSize:12,color:T.t2,padding:"3px 10px",borderRadius:6,background:"#fff",border:`1px solid ${T.border}`}}>{cfg.fromLabel}</span>
        <ArrowRight size={14} style={{color:T.t3}}/>
        <span style={{fontSize:12,fontWeight:600,color:cfg.confirmColor,padding:"3px 10px",borderRadius:6,background:`${cfg.confirmColor}12`}}>{cfg.toLabel}</span>
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RELEASE CONFIRM MODAL
// ═══════════════════════════════════════════════════════════════════════════════
type ReleaseCheck={label:string;target:string;current:string;pass:boolean};
function ReleaseConfirmModal({versionName,checks,onClose,onDone}:{
  versionName:string;checks:ReleaseCheck[];onClose:()=>void;onDone?:()=>void;
}){
  const passed=checks.filter(c=>c.pass).length;
  const allPass=passed===checks.length;
  const [confirmed,setConfirmed]=useState(false);
  const [forceReason,setForceReason]=useState("");
  const [forceErr,setForceErr]=useState(false);
  const [phase,setPhase]=useState<ModalPhase>("form");

  const handleRelease=()=>{
    if(!allPass&&!forceReason.trim()){setForceErr(true);return;}
    setPhase("loading");
    setTimeout(()=>{onDone?.();onClose();},1300);
  };

  return(
    <ModalShell title={allPass?"确认发布":"申请强制发布"} subtitle={versionName} width={560}
      onClose={phase==="loading"?undefined:onClose}
      footer={(
        <>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <button onClick={handleRelease}
            disabled={phase==="loading"||(allPass&&!confirmed)}
            style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",
              display:"flex",alignItems:"center",gap:6,
              background:allPass?T.success:T.warning,color:"#fff",
              opacity:(phase==="loading"||(allPass&&!confirmed))?0.45:1}}>
            {phase==="loading"?<><Spinner size={13} color="#fff"/>发布中…</>
              :allPass?<><CheckCircle size={13}/>确认发布</>:<><Zap size={13}/>申请强制发布</>}
          </button>
        </>
      )}
    >
      {/* Status banner */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:10,
        border:`1.5px solid ${allPass?`${T.success}50`:`${T.warning}50`}`,
        background:allPass?`${T.success}06`:`${T.warning}08`,marginBottom:16}}>
        {allPass
          ?<ShieldCheck size={20} style={{color:T.success,flexShrink:0}}/>
          :<ShieldAlert size={20} style={{color:T.warning,flexShrink:0}}/>}
        <div>
          <div style={{fontSize:14,fontWeight:700,color:allPass?T.success:T.warning}}>
            {allPass?"所有准出指标均已达标，可正常发布":"存在未达标指标，发布须填写原因并留存记录"}
          </div>
          <div style={{fontSize:12,color:T.t3,marginTop:2}}>{passed}/{checks.length} 项达标</div>
        </div>
      </div>
      {/* Checklist grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:16}}>
        {checks.map(c=>(
          <div key={c.label} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:9,
            border:`1px solid ${c.pass?`${T.success}25`:`${T.danger}30`}`,
            background:c.pass?`${T.success}05`:`${T.danger}05`}}>
            {c.pass
              ?<CheckCircle size={14} style={{color:T.success,flexShrink:0}}/>
              :<XCircle size={14} style={{color:T.danger,flexShrink:0}}/>}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:500,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.label}</div>
              <div style={{fontSize:11,color:T.t3}}>目标 {c.target} · 当前 <span style={{fontWeight:600,color:c.pass?T.success:T.danger}}>{c.current}</span></div>
            </div>
          </div>
        ))}
      </div>
      {/* Force reason (when not all pass) */}
      {!allPass&&(
        <div style={{marginBottom:16}}>
          <div style={{padding:"10px 14px",borderRadius:8,background:`${T.warning}08`,border:`1px solid ${T.warning}30`,
            display:"flex",gap:8,marginBottom:12,fontSize:12,color:T.warning}}>
            <AlertTriangle size={13} style={{flexShrink:0,marginTop:1}}/>
            <span>强制发布需填写业务原因，并由项目负责人审核确认后生效。操作将被完整记录。</span>
          </div>
          <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>强制发布原因 <span style={{color:T.danger}}>*</span></div>
          <textarea value={forceReason} onChange={e=>{setForceReason(e.target.value);setForceErr(false);}}
            rows={3} placeholder="请说明业务紧急度、风险评估及已采取的缓解措施…"
            style={{width:"100%",border:`1.5px solid ${forceErr?T.danger:T.border}`,borderRadius:8,
              padding:"8px 10px",fontSize:13,color:T.t1,outline:"none",resize:"none",
              boxSizing:"border-box" as const,lineHeight:1.6}}/>
          {forceErr&&<div style={{fontSize:11,color:T.danger,marginTop:4}}>此项为必填</div>}
        </div>
      )}
      {/* Confirm checkbox (when all pass) */}
      {allPass&&(
        <label style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px 14px",borderRadius:9,
          border:`1px solid ${confirmed?`${T.success}40`:T.border}`,background:confirmed?`${T.success}04`:"#FAFBFF",
          cursor:"pointer",userSelect:"none" as const}}>
          <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}
            style={{marginTop:2,accentColor:T.success,width:15,height:15,flexShrink:0,cursor:"pointer"}}/>
          <span style={{fontSize:13,color:T.t2,lineHeight:1.6}}>
            本人已审阅全部质量指标，确认版本 <strong style={{color:T.t1}}>{versionName}</strong> 符合发布要求，同意正式发布上线。
          </span>
        </label>
      )}
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// P0-C: NEW BUG IN PLAN MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function NewBugInPlanModal({caseNo,caseTitle,onClose}:{
  caseNo?:string;caseTitle?:string;onClose:()=>void;
}){
  type Pri="P0"|"P1"|"P2"|"P3";type Sev="critical"|"major"|"minor"|"trivial";
  const PRI_COLOR:Record<Pri,string>={P0:T.danger,P1:"#FF7D00",P2:T.primary,P3:T.t3};
  const SEV_OPTS:[Sev,string][]=[["critical","致命"],["major","严重"],["minor","一般"],["trivial","轻微"]];
  const initTitle=caseNo&&caseTitle?`【${caseNo}】${caseTitle}`:"";
  const initDesc=caseNo&&caseTitle
    ?`用例标题：${caseTitle}\n\n前置条件：\n（请填写）\n\n测试步骤：\n（请填写）\n\n预期结果：\n（请填写）\n\n实际结果：\n（请填写实际观察到的现象）`:"";
  const [title,setTitle]=useState(initTitle);
  const [desc,setDesc]=useState(initDesc);
  const [pri,setPri]=useState<Pri>("P1");
  const [sev,setSev]=useState<Sev>("major");
  const [assignee,setAssignee]=useState("");
  const [tagInput,setTagInput]=useState("");
  const [tags,setTags]=useState<string[]>([]);
  const [phase,setPhase]=useState<ModalPhase>("form");
  const [titleErr,setTitleErr]=useState(false);
  const fi:React.CSSProperties={width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:8,fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box",background:"#fff"};
  const FL=({label,req}:{label:string;req?:boolean})=>(
    <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>{label}{req&&<span style={{color:T.danger,marginLeft:2}}>*</span>}</div>
  );
  const handleSubmit=(continueCreate?:boolean)=>{
    if(!title.trim()){setTitleErr(true);return;}
    setPhase("loading");
    setTimeout(()=>{if(continueCreate){setTitle("");setDesc("");setPhase("form");}else{onClose();}},1200);
  };
  const addTag=(v:string)=>{const t=v.trim();if(t&&!tags.includes(t))setTags(q=>[...q,t]);setTagInput("");};
  return(
    <div style={{position:"fixed",inset:0,zIndex:1100,display:"flex"}}>
      <div style={{flex:1,background:"rgba(0,0,0,0.35)"}} onClick={phase==="loading"?undefined:onClose}/>
      <div style={{width:860,background:"#fff",display:"flex",flexDirection:"column",boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        {/* header */}
        <div style={{height:56,display:"flex",alignItems:"center",padding:"0 24px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:600,color:T.t1}}>创建缺陷</span>
          <div style={{flex:1}}/>
          <button onClick={phase==="loading"?undefined:onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,display:"flex",alignItems:"center",padding:4}}>
            <X size={18}/>
          </button>
        </div>
        {/* body: left + right */}
        <div style={{flex:1,overflowY:"auto",display:"flex",minHeight:0}}>
          {/* left main */}
          <div style={{flex:1,padding:24,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",gap:20,minWidth:0}}>
            {/* 缺陷标题 */}
            <div>
              <FL label="缺陷标题" req/>
              <input value={title} onChange={e=>{setTitle(e.target.value.slice(0,120));setTitleErr(false);}}
                placeholder="简要描述缺陷现象"
                style={{...fi,borderColor:titleErr?T.danger:T.border}}
                onFocus={e=>e.currentTarget.style.borderColor=titleErr?T.danger:TM}
                onBlur={e=>e.currentTarget.style.borderColor=titleErr?T.danger:T.border}/>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                {titleErr?<span style={{fontSize:11,color:T.danger}}>标题为必填项</span>:<span/>}
                <span style={{fontSize:11,color:T.t4}}>{title.length} / 120</span>
              </div>
            </div>
            {/* 缺陷描述 */}
            <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:220}}>
              <FL label="缺陷描述" req/>
              <div style={{flex:1,border:`1.5px solid ${T.border}`,borderRadius:8,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                {/* fake toolbar */}
                <div style={{borderBottom:`1px solid ${T.border}`,padding:"5px 10px",display:"flex",alignItems:"center",gap:2,background:"#FAFAFA",flexShrink:0}}>
                  {[["正文"],["默认"]].map(([l],i)=>(
                    <button key={i} style={{height:24,padding:"0 8px",border:`1px solid ${T.border}`,borderRadius:4,fontSize:11,color:T.t2,background:"#fff",cursor:"pointer",marginRight:4}}>{l} ∨</button>
                  ))}
                  <span style={{width:1,height:14,background:T.border,margin:"0 4px"}}/>
                  {(["B","I","U","S"] as string[]).map((s,i)=>(
                    <button key={i} style={{width:24,height:24,border:"none",borderRadius:4,fontSize:12,
                      fontWeight:s==="B"?"bold":"normal",fontStyle:s==="I"?"italic":"normal",
                      textDecoration:s==="U"?"underline":s==="S"?"line-through":"none",
                      color:T.t2,background:"none",cursor:"pointer"}}>{s}</button>
                  ))}
                  <span style={{width:1,height:14,background:T.border,margin:"0 4px"}}/>
                  {["≔","⊞","⊟","⊠","⊡","⊢","⊤"].map((s,i)=>(
                    <button key={i} style={{width:24,height:24,border:"none",borderRadius:4,fontSize:13,color:T.t3,background:"none",cursor:"pointer"}}>{s}</button>
                  ))}
                </div>
                <textarea value={desc} onChange={e=>setDesc(e.target.value)}
                  style={{flex:1,border:"none",outline:"none",padding:"12px 14px",fontSize:13,color:T.t1,lineHeight:1.8,resize:"none",fontFamily:"inherit",background:"#fff",minHeight:180}}/>
              </div>
            </div>
            {/* 附件/截图 */}
            <div>
              <FL label="附件 / 截图"/>
              <div style={{border:`2px dashed ${T.border}`,borderRadius:8,padding:"28px 0",textAlign:"center",background:"#FAFAFA",cursor:"pointer"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=TM;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=T.border;}}>
                <Upload size={22} style={{color:T.t4,margin:"0 auto 8px",display:"block"}}/>
                <p style={{fontSize:13,color:T.t2,margin:"0 0 4px"}}>点击上传，或将文件拖拽至此处</p>
                <p style={{fontSize:11,color:T.t4,margin:0}}>支持图片 / 文档，截图可直接粘贴 (Ctrl+V)，单文件不超过 20 MB</p>
              </div>
            </div>
          </div>
          {/* right sidebar */}
          <div style={{width:232,flexShrink:0,padding:"24px 20px",display:"flex",flexDirection:"column",gap:20}}>
            {/* 优先级 */}
            <div>
              <FL label="优先级" req/>
              <div style={{display:"flex",gap:6}}>
                {(["P0","P1","P2","P3"] as Pri[]).map(p=>{
                  const c=PRI_COLOR[p];const sel=pri===p;
                  return <button key={p} onClick={()=>setPri(p)}
                    style={{flex:1,height:30,borderRadius:6,fontSize:12,fontWeight:sel?700:400,
                      border:`1.5px solid ${sel?c:T.border}`,background:sel?`${c}12`:"#fff",color:sel?c:T.t3,cursor:"pointer"}}>
                    {p}</button>;
                })}
              </div>
            </div>
            {/* 严重级别 */}
            <div>
              <FL label="严重级别" req/>
              <select value={sev} onChange={e=>setSev(e.target.value as Sev)}
                style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:8,fontSize:13,color:T.t1,outline:"none",background:"#fff",cursor:"pointer",boxSizing:"border-box"}}>
                {SEV_OPTS.map(([k,l])=><option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            {/* 处理人 */}
            <div>
              <FL label="处理人" req/>
              <select value={assignee} onChange={e=>setAssignee(e.target.value)}
                style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:8,fontSize:13,color:assignee?T.t1:T.t4,outline:"none",background:"#fff",cursor:"pointer",boxSizing:"border-box"}}>
                <option value="">请选择处理人</option>
                {["李明","王芳","陈伟","张程远"].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            {/* 标签 */}
            <div>
              <FL label="标签"/>
              <input value={tagInput} onChange={e=>setTagInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();addTag(tagInput);}}}
                placeholder="输入内容后回车可直接添加标签"
                style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:8,fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box",background:"#fff"}}
                onFocus={e=>e.currentTarget.style.borderColor=TM} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
              {tags.length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
                  {tags.map(t=>(
                    <span key={t} style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:11,padding:"2px 8px",borderRadius:10,background:`${TM}12`,color:TM}}>
                      {t}
                      <button onClick={()=>setTags(q=>q.filter(x=>x!==t))}
                        style={{background:"none",border:"none",cursor:"pointer",color:TM,padding:0,display:"flex",lineHeight:1}}>
                        <X size={10}/>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* footer */}
        <div style={{height:56,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"0 24px",gap:10,flexShrink:0}}>
          <PBtn variant="ghost" onClick={phase==="loading"?undefined:onClose}>取消</PBtn>
          <button onClick={()=>handleSubmit(true)} disabled={phase==="loading"}
            style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:500,border:`1.5px solid ${T.border}`,background:"#fff",color:T.t2,cursor:"pointer",opacity:phase==="loading"?0.6:1}}>
            保存并继续创建
          </button>
          <button onClick={()=>handleSubmit(false)} disabled={phase==="loading"}
            style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:600,border:"none",background:TM,color:"#fff",cursor:phase==="loading"?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6,opacity:phase==="loading"?0.65:1}}>
            {phase==="loading"?<><Spinner size={13} color="#fff"/>创建中…</>:"创建"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// P1-A: DELETE CONFIRM MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function DeleteConfirmModal({itemName,itemType,hasLinked,linkedDesc,onClose,onDone}:{
  itemName:string;itemType:string;hasLinked?:boolean;linkedDesc?:string;onClose:()=>void;onDone?:()=>void;
}){
  const [phase,setPhase]=useState<ModalPhase>("form");
  const [confirm,setConfirm]=useState("");
  const canDelete=!hasLinked||confirm===itemName;

  const handleDelete=()=>{
    setPhase("loading");
    setTimeout(()=>{onDone?.();onClose();},1200);
  };

  return(
    <ModalShell title={`删除${itemType}`} width={440} onClose={phase==="loading"?undefined:onClose}
      footer={phase==="error"?(
        <>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn color={T.danger} icon={RefreshCw} onClick={()=>setPhase("form")}>重试</PBtn>
        </>
      ):(
        <>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <button onClick={handleDelete} disabled={!canDelete||phase==="loading"}
            style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:canDelete?"pointer":"not-allowed",border:"none",
              background:T.danger,color:"#fff",display:"flex",alignItems:"center",gap:6,opacity:!canDelete||phase==="loading"?0.5:1}}>
            {phase==="loading"?<><Spinner size={13} color="#fff"/>删除中…</>:<><Trash2 size={13}/>确认删除</>}
          </button>
        </>
      )}
    >
      {phase==="error"&&<ErrorBanner msg="删除失败，请稍后重试。" onRetry={()=>setPhase("form")}/>}
      <div style={{display:"flex",gap:12,marginBottom:hasLinked?16:0}}>
        <div style={{width:40,height:40,borderRadius:10,background:`${T.danger}10`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Trash2 size={18} style={{color:T.danger}}/>
        </div>
        <div style={{flex:1,paddingTop:4}}>
          <div style={{fontSize:13,color:T.t1,lineHeight:1.6}}>即将删除 <b>「{itemName}」</b>，此操作不可撤回。</div>
          {!hasLinked&&<div style={{fontSize:12,color:T.t3,marginTop:2}}>相关数据将被永久移除。</div>}
        </div>
      </div>
      {hasLinked&&(
        <>
          <div style={{padding:"10px 14px",borderRadius:8,background:`${T.danger}08`,border:`1px solid ${T.danger}25`,marginBottom:14,fontSize:12}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontWeight:600,color:T.danger,marginBottom:4}}>
              <AlertTriangle size={12}/>存在关联数据，请谨慎操作
            </div>
            <div style={{color:T.t2}}>{linkedDesc||"该条目存在关联数据，删除后关联关系将一并移除。"}</div>
          </div>
          <div>
            <div style={{fontSize:12,color:T.t2,marginBottom:6}}>
              输入 <code style={{fontFamily:"monospace",color:T.danger,background:`${T.danger}10`,padding:"1px 6px",borderRadius:4}}>{itemName}</code> 以确认删除
            </div>
            <input value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder={itemName}
              style={{width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${confirm===itemName?T.danger:T.border}`,borderRadius:8,fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box"}}/>
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// P1-B: UNLINK CASE MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function UnlinkCaseModal({caseIds,caseTitle,onClose,onDone}:{
  caseIds:string[];caseTitle?:string;onClose:()=>void;onDone?:()=>void;
}){
  const [phase,setPhase]=useState<ModalPhase>("form");
  const isBatch=caseIds.length>1;
  const handleUnlink=()=>{
    setPhase("loading");
    setTimeout(()=>{onDone?.();onClose();},1000);
  };
  return(
    <ModalShell title={isBatch?"批量解除关联":"解除关联用例"} width={420} onClose={phase==="loading"?undefined:onClose}
      footer={phase==="error"?(
        <>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn color={T.warning} icon={RefreshCw} onClick={()=>setPhase("form")}>重试</PBtn>
        </>
      ):(
        <>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <button onClick={handleUnlink} disabled={phase==="loading"}
            style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",
              background:T.warning,color:"#fff",display:"flex",alignItems:"center",gap:6,opacity:phase==="loading"?0.65:1}}>
            {phase==="loading"?<><Spinner size={13} color="#fff"/>解除中…</>:<><X size={13}/>确认解除</>}
          </button>
        </>
      )}
    >
      {phase==="error"&&<ErrorBanner msg="解除失败，请稍后重试。" onRetry={()=>setPhase("form")}/>}
      <div style={{display:"flex",gap:12}}>
        <div style={{width:40,height:40,borderRadius:10,background:`${T.warning}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Link2 size={18} style={{color:T.warning}}/>
        </div>
        <div style={{flex:1,paddingTop:4}}>
          {isBatch
            ?<div style={{fontSize:13,color:T.t1,lineHeight:1.6}}>即将解除 <b style={{color:T.warning}}>{caseIds.length} 条</b>用例与当前需求的关联，用例本身不会被删除。</div>
            :<div style={{fontSize:13,color:T.t1,lineHeight:1.6}}>即将解除用例 <b>「{caseTitle||caseIds[0]}」</b> 与当前需求的关联，用例本身不会被删除。</div>
          }
          <div style={{fontSize:12,color:T.t3,marginTop:4}}>解除后可重新从用例库关联。</div>
        </div>
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// P1-C: REPORT SIGN MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function ReportSignModal({owner,planName,onClose,onSigned}:{
  owner:string;planName:string;onClose:()=>void;onSigned:()=>void;
}){
  const [note,setNote]=useState("");
  const [phase,setPhase]=useState<ModalPhase>("form");
  const handleSign=()=>{
    setPhase("loading");
    setTimeout(()=>{onSigned();onClose();},1200);
  };
  return(
    <ModalShell title="确认签署报告" subtitle={planName} width={460} onClose={phase==="loading"?undefined:onClose}
      footer={phase==="error"?(
        <>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn color={TM} icon={RefreshCw} onClick={()=>setPhase("form")}>重新提交</PBtn>
        </>
      ):(
        <>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <button onClick={handleSign} disabled={phase==="loading"}
            style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",
              background:TM,color:"#fff",display:"flex",alignItems:"center",gap:6,opacity:phase==="loading"?0.65:1}}>
            {phase==="loading"?<><Spinner size={13} color="#fff"/>签署中…</>:<><FileCheck size={13}/>确认签署</>}
          </button>
        </>
      )}
    >
      {phase==="error"&&<ErrorBanner msg="签署失败，请稍后重试。" onRetry={()=>setPhase("form")}/>}
      <div style={{padding:"12px 16px",borderRadius:8,background:"#FAFBFE",border:`1px solid ${T.border}`,marginBottom:16,fontSize:12,color:T.t2,lineHeight:1.7}}>
        <div style={{fontWeight:600,color:T.t1,marginBottom:4}}>负责人：{owner}</div>
        我确认已完整阅读本次测试报告，所有质量数据已核实，同意以此报告作为版本发布依据。
      </div>
      <div>
        <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>补充说明（选填）</div>
        <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} placeholder="可在此补充说明或标注遗留风险…"
          style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"8px 10px",fontSize:13,color:T.t1,outline:"none",resize:"none",boxSizing:"border-box"}}/>
      </div>
    </ModalShell>
  );
}

function ReportUnsignModal({owner,onClose,onUnsigned}:{owner:string;onClose:()=>void;onUnsigned:()=>void;}){
  const [reason,setReason]=useState("");
  const [reasonErr,setReasonErr]=useState(false);
  const [phase,setPhase]=useState<ModalPhase>("form");
  const handleUnsign=()=>{
    if(!reason.trim()){setReasonErr(true);return;}
    setPhase("loading");
    setTimeout(()=>{onUnsigned();onClose();},1100);
  };
  return(
    <ModalShell title="撤回签署" width={440} onClose={phase==="loading"?undefined:onClose}
      footer={phase==="error"?(
        <>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn color={T.warning} icon={RefreshCw} onClick={()=>setPhase("form")}>重试</PBtn>
        </>
      ):(
        <>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <button onClick={handleUnsign} disabled={phase==="loading"}
            style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",
              background:T.warning,color:"#fff",display:"flex",alignItems:"center",gap:6,opacity:phase==="loading"?0.65:1}}>
            {phase==="loading"?<><Spinner size={13} color="#fff"/>撤回中…</>:"确认撤回"}
          </button>
        </>
      )}
    >
      {phase==="error"&&<ErrorBanner msg="撤回失败，请稍后重试。" onRetry={()=>setPhase("form")}/>}
      <div style={{fontSize:13,color:T.t2,marginBottom:16,lineHeight:1.6}}>{owner} 已于本次报告签署，撤回后签署状态将被清除，可重新签署。</div>
      <div>
        <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>撤回原因 <span style={{color:T.danger}}>*</span></div>
        <textarea value={reason} onChange={e=>{setReason(e.target.value);setReasonErr(false);}} rows={3} placeholder="请说明撤回签署的原因…"
          style={{width:"100%",border:`1.5px solid ${reasonErr?T.danger:T.border}`,borderRadius:8,padding:"8px 10px",fontSize:13,color:T.t1,outline:"none",resize:"none",boxSizing:"border-box"}}/>
        {reasonErr&&<div style={{fontSize:11,color:T.danger,marginTop:4}}>此项为必填</div>}
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// P1-D: QUALITY GATE MODAL (version-level)
// ═══════════════════════════════════════════════════════════════════════════════
function QualityGateModal({versionName,checks,onClose,onForce,onBack}:{
  versionName:string;
  checks:{label:string;target:string;current:string;pass:boolean}[];
  onClose:()=>void;onForce?:()=>void;onBack?:()=>void;
}){
  const passed=checks.filter(c=>c.pass).length;
  const allPass=passed===checks.length;
  const [phase,setPhase]=useState<ModalPhase>("form");
  const [showForceModal,setShowForceModal]=useState(false);
  const [forceNote,setForceNote]=useState("");
  const [forceNoteErr,setForceNoteErr]=useState(false);

  if(showForceModal){
    const handleForceSubmit=()=>{
      if(!forceNote.trim()){setForceNoteErr(true);return;}
      setPhase("loading");
      setTimeout(()=>{onForce?.();onClose();},1300);
    };
    return(
      <ModalShell title="强制推进" subtitle={versionName} width={440} onClose={phase==="loading"?undefined:()=>setShowForceModal(false)}
        footer={phase==="error"?(
          <>
            <PBtn variant="ghost" onClick={()=>setShowForceModal(false)}>取消</PBtn>
            <PBtn color={T.warning} icon={RefreshCw} onClick={()=>setPhase("form")}>重试</PBtn>
          </>
        ):(
          <>
            <PBtn variant="ghost" onClick={()=>setShowForceModal(false)}>返回</PBtn>
            <button onClick={handleForceSubmit} disabled={phase==="loading"}
              style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",
                background:T.warning,color:"#fff",display:"flex",alignItems:"center",gap:6,opacity:phase==="loading"?0.65:1}}>
              {phase==="loading"?<><Spinner size={13} color="#fff"/>提交中…</>:<><Zap size={13}/>确认强制推进</>}
            </button>
          </>
        )}
      >
        {phase==="error"&&<ErrorBanner msg="提交失败，请稍后重试。" onRetry={()=>setPhase("form")}/>}
        <div style={{padding:"10px 14px",borderRadius:8,background:`${T.warning}10`,border:`1px solid ${T.warning}30`,marginBottom:16,fontSize:12,color:T.warning,display:"flex",gap:8}}>
          <AlertTriangle size={13} style={{flexShrink:0,marginTop:1}}/>
          <span>当前 {checks.length-passed} 项准出指标未达标，强制推进需经负责人确认并留存记录。</span>
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>强制推进原因 <span style={{color:T.danger}}>*</span></div>
          <textarea value={forceNote} onChange={e=>{setForceNote(e.target.value);setForceNoteErr(false);}} rows={4} placeholder="请详细说明强制推进的业务原因和风险评估…"
            style={{width:"100%",border:`1.5px solid ${forceNoteErr?T.danger:T.border}`,borderRadius:8,padding:"8px 10px",fontSize:13,color:T.t1,outline:"none",resize:"none",boxSizing:"border-box"}}/>
          {forceNoteErr&&<div style={{fontSize:11,color:T.danger,marginTop:4}}>此项为必填</div>}
        </div>
      </ModalShell>
    );
  }

  return(
    <ModalShell title="质量准出检查" subtitle={versionName} width={540} onClose={onClose}
      footer={(
        <>
          {onBack&&<PBtn variant="ghost" onClick={onBack}>返回处理</PBtn>}
          <div style={{flex:1}}/>
          {!allPass&&onForce&&<PBtn color={T.warning} onClick={()=>setShowForceModal(true)}>强制推进</PBtn>}
          {allPass&&<button onClick={onClose}
            style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",background:T.success,color:"#fff",display:"flex",alignItems:"center",gap:6}}>
            <CheckCircle size={13}/>确认准出
          </button>}
        </>
      )}
    >
      {/* Status banner */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:10,
        border:`1.5px solid ${allPass?`${T.success}50`:`${T.warning}50`}`,
        background:allPass?`${T.success}06`:`${T.warning}08`,marginBottom:16}}>
        {allPass?<CheckCircle size={18} style={{color:T.success}}/>:<AlertTriangle size={18} style={{color:T.warning}}/>}
        <div>
          <div style={{fontSize:14,fontWeight:700,color:allPass?T.success:T.warning}}>
            {allPass?"所有准出项已通过":"部分准出项未通过"}
          </div>
          <div style={{fontSize:12,color:T.t3,marginTop:1}}>{passed}/{checks.length} 项达标</div>
        </div>
      </div>
      {/* Checklist */}
      <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
        {checks.map((c,i)=>(
          <div key={c.label} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",
            borderBottom:i<checks.length-1?`1px solid ${T.border}`:"none",
            background:c.pass?`${T.success}04`:`${T.danger}04`}}>
            {c.pass?<CheckCircle size={14} style={{color:T.success,flexShrink:0}}/>:<XCircle size={14} style={{color:T.danger,flexShrink:0}}/>}
            <span style={{flex:1,fontSize:13,fontWeight:500,color:T.t1}}>{c.label}</span>
            <span style={{fontSize:11,color:T.t3}}>目标 {c.target}</span>
            <span style={{fontSize:13,fontWeight:700,color:c.pass?T.success:T.danger,minWidth:48,textAlign:"right"}}>{c.current}</span>
            <span style={{fontSize:11,color:c.pass?T.success:T.danger,minWidth:40,textAlign:"right"}}>{c.pass?"✓ 达标":"✗ 未达标"}</span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2-A: COPY PLAN MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function CopyPlanModal({planName,onClose}:{planName:string;onClose:()=>void;}){
  const [name,setName]=useState("副本 — "+planName);
  const [versionId,setVersionId]=useState("V1");
  const [copyOpts,setCopyOpts]=useState({reqs:true,reqCases:true,manualCases:true,quality:false});
  const [nameErr,setNameErr]=useState(false);
  const [phase,setPhase]=useState<ModalPhase>("form");
  const toggle=(k:keyof typeof copyOpts)=>setCopyOpts(p=>({...p,[k]:!p[k]}));
  const handleCopy=()=>{
    if(!name.trim()){setNameErr(true);return;}
    setPhase("loading");
    setTimeout(()=>{onClose();},1500);
  };
  const fi:React.CSSProperties={width:"100%",height:34,padding:"0 10px",border:`1.5px solid ${T.border}`,borderRadius:8,fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box",background:"#fff"};
  const Opt=({k,label,desc}:{k:keyof typeof copyOpts;label:string;desc:string})=>(
    <label style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",padding:"10px 12px",borderRadius:8,border:`1.5px solid ${copyOpts[k]?TM:T.border}`,background:copyOpts[k]?`${TM}06`:"#fff"}}>
      <input type="checkbox" checked={copyOpts[k]} onChange={()=>toggle(k)} style={{marginTop:2,accentColor:TM}}/>
      <div>
        <div style={{fontSize:13,fontWeight:500,color:T.t1}}>{label}</div>
        <div style={{fontSize:11,color:T.t3,marginTop:2}}>{desc}</div>
      </div>
    </label>
  );
  return(
    <ModalShell title="复制测试计划" subtitle={planName} width={520} onClose={phase==="loading"?undefined:onClose}
      footer={phase==="error"?(
        <>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn color={TM} icon={RefreshCw} onClick={()=>setPhase("form")}>重新提交</PBtn>
        </>
      ):(
        <>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <button onClick={handleCopy} disabled={phase==="loading"}
            style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",
              background:TM,color:"#fff",display:"flex",alignItems:"center",gap:6,opacity:phase==="loading"?0.65:1}}>
            {phase==="loading"?<><Spinner size={13} color="#fff"/>复制中…</>:<><Copy size={13}/>确认复制</>}
          </button>
        </>
      )}
    >
      {phase==="error"&&<ErrorBanner msg="复制失败，请稍后重试。" onRetry={()=>setPhase("form")}/>}
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>副本名称 <span style={{color:T.danger}}>*</span></div>
          <input style={{...fi,borderColor:nameErr?T.danger:T.border}} value={name}
            onChange={e=>{setName(e.target.value);setNameErr(false);}} placeholder="请输入副本名称"/>
          {nameErr&&<div style={{fontSize:11,color:T.danger,marginTop:3}}>名称为必填项</div>}
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>目标版本</div>
          <select style={fi} value={versionId} onChange={e=>setVersionId(e.target.value)}>
            {MOCK_VERSIONS.filter(v=>v.status!=="archived").map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:8}}>复制内容</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Opt k="reqs" label="复制需求范围" desc="将原计划关联的需求一并复制到副本"/>
            <Opt k="reqCases" label="复制需求带入的用例" desc="需求自动关联的用例将同步复制"/>
            <Opt k="manualCases" label="复制手动添加的用例" desc="手动补充的用例将同步复制"/>
            <Opt k="quality" label="复制质量标准" desc="将原计划的质量门槛配置复制到副本"/>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2-B: EXCEL IMPORT FULL FLOW (replaces ImportReqModal)
// ═══════════════════════════════════════════════════════════════════════════════
type ImportStep="config"|"uploading"|"parsing"|"result";
type ImportResult="success"|"partial"|"fail"|"duplicate";

function ImportReqModalV2({onClose}:{onClose:()=>void;}){
  const [step,setStep]=useState<ImportStep>("config");
  const [versionId,setVersionId]=useState("V1");
  const [fileName,setFileName]=useState("");
  const [result,setResult]=useState<ImportResult>("partial");
  const fileRef=useRef<HTMLInputElement>(null);

  const FAIL_ROWS=[
    {row:3,title:"用户登录需求",reason:"需求标题重复"},
    {row:7,title:"",reason:"需求标题不能为空"},
    {row:12,title:"订单超时处理",reason:"优先级字段值无效"},
  ];

  const handleFileSelect=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0];
    if(!f)return;
    if(!f.name.endsWith(".xlsx")&&!f.name.endsWith(".xls")){
      alert("仅支持 .xlsx / .xls 格式");return;
    }
    setFileName(f.name);
    setStep("uploading");
    setTimeout(()=>setStep("parsing"),1200);
    setTimeout(()=>setStep("result"),2600);
  };

  const fi:React.CSSProperties={width:"100%",height:34,padding:"0 10px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box",background:"#fff"};

  if(step==="config"){
    return(
      <ModalShell title="导入需求" subtitle="Excel 文件" width={520} onClose={onClose}
        footer={<><PBtn variant="ghost" onClick={onClose}>取消</PBtn><PBtn color={TM} icon={Upload} onClick={()=>fileRef.current?.click()}>选择文件</PBtn></>}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={handleFileSelect}/>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <div style={{fontSize:12,fontWeight:500,color:T.t2,marginBottom:6}}>默认关联版本</div>
            <select style={fi} value={versionId} onChange={e=>setVersionId(e.target.value)}>
              {MOCK_VERSIONS.filter(v=>v.status!=="archived").map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div onClick={()=>fileRef.current?.click()}
            style={{border:`2px dashed ${T.border}`,borderRadius:12,padding:"32px 20px",textAlign:"center",cursor:"pointer",background:"#FAFBFE"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=TM}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <Upload size={28} style={{color:T.t4,marginBottom:10}}/>
            <div style={{fontSize:13,fontWeight:500,color:T.t2}}>点击或拖拽文件至此处</div>
            <div style={{fontSize:11,color:T.t4,marginTop:4}}>支持 .xlsx / .xls 格式，文件不超过 10MB</div>
          </div>
          <div style={{padding:"10px 14px",borderRadius:8,background:"#F7F8FA",border:`1px solid ${T.border}`,fontSize:11,color:T.t3}}>
            请按模板格式填写，必填字段：需求标题、优先级。
            <button style={{color:TM,border:"none",background:"none",cursor:"pointer",fontSize:11,marginLeft:6}}>下载模板</button>
          </div>
        </div>
      </ModalShell>
    );
  }

  if(step==="uploading"||step==="parsing"){
    const isUploading=step==="uploading";
    return(
      <ModalShell title="导入需求" width={420} footer={<PBtn variant="ghost" onClick={onClose} color={T.t3}>取消</PBtn>}>
        <div style={{textAlign:"center",padding:"24px 0"}}>
          <Spinner size={36} color={TM}/>
          <div style={{fontSize:14,fontWeight:600,color:T.t1,marginTop:16}}>{isUploading?"正在上传文件…":"正在解析内容…"}</div>
          <div style={{fontSize:12,color:T.t3,marginTop:6}}>{isUploading?fileName:"识别字段、校验数据格式"}</div>
          {!isUploading&&(
            <div style={{marginTop:20,height:4,borderRadius:4,background:T.border,overflow:"hidden",maxWidth:240,margin:"20px auto 0"}}>
              <div style={{height:"100%",background:TM,borderRadius:4,width:"60%",transition:"width 0.5s"}}/>
            </div>
          )}
        </div>
      </ModalShell>
    );
  }

  // result
  const RESULT_CFG:{[k in ImportResult]:{icon:React.ElementType;color:string;title:string;desc:string}}={
    success:{icon:CheckCircle,color:T.success,title:"导入成功",desc:"全部 15 条需求已成功导入。"},
    partial:{icon:AlertTriangle,color:T.warning,title:"部分导入成功",desc:"18 条中 15 条成功，3 条失败，请查看失败详情。"},
    fail:   {icon:XCircle,color:T.danger,title:"导入失败",desc:"文件内容存在格式问题，请修正后重新上传。"},
    duplicate:{icon:AlertTriangle,color:T.warning,title:"存在重复数据",desc:"检测到 4 条与已有需求重复，已自动跳过。"},
  };
  const rc=RESULT_CFG[result];
  const RIcon=rc.icon;

  return(
    <ModalShell title="导入结果" width={560} onClose={onClose}
      footer={(
        <>
          <PBtn variant="ghost" onClick={onClose}>关闭</PBtn>
          {result==="partial"&&<PBtn variant="ghost" icon={Download} onClick={()=>{}}>下载失败数据</PBtn>}
          {(result==="partial"||result==="fail")&&<PBtn color={TM} icon={Upload} onClick={()=>{setStep("config");setFileName("");}}>重新导入</PBtn>}
          {(result==="success"||result==="partial")&&<PBtn color={TM} onClick={onClose}>查看已导入需求</PBtn>}
        </>
      )}
    >
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:10,border:`1.5px solid ${rc.color}40`,background:`${rc.color}06`,marginBottom:20}}>
        <RIcon size={22} style={{color:rc.color,flexShrink:0}}/>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:rc.color}}>{rc.title}</div>
          <div style={{fontSize:12,color:T.t3,marginTop:2}}>{rc.desc}</div>
        </div>
      </div>
      {result==="partial"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
            {[{label:"成功",value:15,color:T.success},{label:"重复跳过",value:0,color:T.t3},{label:"失败",value:3,color:T.danger}].map(s=>(
              <div key={s.label} style={{padding:"12px",borderRadius:8,border:`1px solid ${T.border}`,textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:700,color:s.color}}>{s.value}</div>
                <div style={{fontSize:11,color:T.t3,marginTop:2}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:8}}>失败详情</div>
          <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"60px 1fr 1fr",background:"#F7F8FA",padding:"7px 12px",fontSize:11,fontWeight:600,color:T.t3}}>
              <span>行号</span><span>需求标题</span><span>失败原因</span>
            </div>
            {FAIL_ROWS.map((r,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"60px 1fr 1fr",padding:"8px 12px",borderTop:`1px solid ${T.border}`,fontSize:12}}>
                <span style={{color:T.t3}}>第 {r.row} 行</span>
                <span style={{color:r.title?T.t1:T.t4}}>{r.title||"（空）"}</span>
                <span style={{color:T.danger}}>{r.reason}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// P2-C: COMMON STATES
// ═══════════════════════════════════════════════════════════════════════════════
function SkeletonBlock({w="100%",h=16,radius=6}:{w?:string|number;h?:number;radius?:number}){
  return <div style={{width:w,height:h,borderRadius:radius,background:"linear-gradient(90deg,#F2F3F5 25%,#E8E9EF 50%,#F2F3F5 75%)",backgroundSize:"400% 100%",animation:"shimmer 1.4s ease infinite"}}/>;
}

function SkeletonTableRows({rows=5,cols=5}:{rows?:number;cols?:number}){
  return(
    <>
      {Array.from({length:rows}).map((_,i)=>(
        <tr key={i}>
          {Array.from({length:cols}).map((_,j)=>(
            <td key={j} style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`}}>
              <SkeletonBlock w={j===1?"80%":j===cols-1?"60%":"70%"} h={13}/>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyState({title,desc,action}:{title:string;desc?:string;action?:React.ReactNode}){
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 20px",textAlign:"center"}}>
      <div style={{width:64,height:64,borderRadius:16,background:"#F2F3F5",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
        <ClipboardList size={28} style={{color:T.t4}}/>
      </div>
      <div style={{fontSize:14,fontWeight:600,color:T.t2,marginBottom:6}}>{title}</div>
      {desc&&<div style={{fontSize:12,color:T.t3,marginBottom:16,maxWidth:280}}>{desc}</div>}
      {action&&action}
    </div>
  );
}

function SearchEmptyState({query}:{query:string}){
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"48px 20px",textAlign:"center"}}>
      <div style={{width:56,height:56,borderRadius:14,background:"#F2F3F5",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14}}>
        <Search size={24} style={{color:T.t4}}/>
      </div>
      <div style={{fontSize:14,fontWeight:600,color:T.t2,marginBottom:4}}>未找到相关结果</div>
      <div style={{fontSize:12,color:T.t3}}>「{query}」没有匹配的内容，请尝试其他关键词</div>
    </div>
  );
}

function ApiErrorState({onRetry,msg}:{onRetry?:()=>void;msg?:string}){
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"56px 20px",textAlign:"center"}}>
      <div style={{width:56,height:56,borderRadius:14,background:`${T.danger}10`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14}}>
        <AlertTriangle size={24} style={{color:T.danger}}/>
      </div>
      <div style={{fontSize:14,fontWeight:600,color:T.t1,marginBottom:4}}>{msg||"加载失败"}</div>
      <div style={{fontSize:12,color:T.t3,marginBottom:16}}>网络异常或服务暂时不可用，请稍后重试</div>
      {onRetry&&<button onClick={onRetry}
        style={{height:32,padding:"0 16px",borderRadius:8,fontSize:13,fontWeight:500,border:`1px solid ${TM}`,background:"#fff",color:TM,cursor:"pointer"}}>
        重新加载
      </button>}
    </div>
  );
}

function NoPermissionState({type="view"}:{type?:"view"|"edit"}){
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"56px 20px",textAlign:"center"}}>
      <div style={{width:56,height:56,borderRadius:14,background:`${T.warning}12`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14}}>
        <User size={24} style={{color:T.warning}}/>
      </div>
      <div style={{fontSize:14,fontWeight:600,color:T.t1,marginBottom:4}}>
        {type==="view"?"无查看权限":"无编辑权限"}
      </div>
      <div style={{fontSize:12,color:T.t3}}>
        {type==="view"?"您没有权限查看此内容，请联系管理员申请访问权限。":"您只有只读权限，如需修改请联系负责人。"}
      </div>
    </div>
  );
}

function LeaveConfirmModal({onStay,onLeave}:{onStay:()=>void;onLeave:()=>void;}){
  return(
    <ModalShell title="有未保存的内容" width={400} footer={(
      <>
        <PBtn variant="ghost" onClick={onStay}>继续编辑</PBtn>
        <button onClick={onLeave}
          style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",background:T.danger,color:"#fff"}}>
          放弃并离开
        </button>
      </>
    )}>
      <div style={{display:"flex",gap:12}}>
        <div style={{width:40,height:40,borderRadius:10,background:`${T.warning}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <AlertTriangle size={18} style={{color:T.warning}}/>
        </div>
        <div style={{flex:1,fontSize:13,color:T.t1,lineHeight:1.7,paddingTop:4}}>
          当前表单有未保存的修改，离开后内容将丢失。是否放弃修改并离开？
        </div>
      </div>
    </ModalShell>
  );
}

function DataConflictModal({onRefresh,onClose}:{onRefresh:()=>void;onClose:()=>void;}){
  return(
    <ModalShell title="数据冲突" width={420} onClose={onClose} footer={(
      <>
        <PBtn variant="ghost" onClick={onClose}>关闭</PBtn>
        <PBtn color={TM} icon={RefreshCw} onClick={onRefresh}>刷新数据</PBtn>
      </>
    )}>
      <div style={{display:"flex",gap:12}}>
        <div style={{width:40,height:40,borderRadius:10,background:`${T.danger}10`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <AlertTriangle size={18} style={{color:T.danger}}/>
        </div>
        <div style={{flex:1,paddingTop:4}}>
          <div style={{fontSize:13,color:T.t1,lineHeight:1.6}}>该数据已被其他用户修改，当前页面数据已过期。</div>
          <div style={{fontSize:12,color:T.t3,marginTop:4}}>请刷新后查看最新内容，再重新提交您的修改。</div>
        </div>
      </div>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN EXECUTION WORKSTATION
// ═══════════════════════════════════════════════════════════════════════════════
const EXEC_STATUS_CFG_EX:{[k in ExecStatus]:{label:string;color:string;bg:string;dot:string}}={
  passed: {label:"通过", color:T.success, bg:"#E8FFF0", dot:T.success},
  failed: {label:"失败", color:T.danger,  bg:"#FFE8E8", dot:T.danger},
  blocked:{label:"阻塞", color:T.warning, bg:"#FFF3E8", dot:T.warning},
  pending:{label:"未执行",color:T.t3,    bg:"#F2F3F5", dot:T.t4},
};

// ── Case Edit Drawer ──────────────────────────────────────────────────────────
function CaseEditDrawer({case_,onClose}:{case_:PlanCase;onClose:()=>void}){
  const detail=getSteps(case_.no);
  const [title,setTitle]=useState(case_.title);
  const [module,setModule]=useState(case_.module);
  const [priority,setPriority]=useState(case_.priority);
  const [precondition,setPrecondition]=useState(detail.precondition);
  const [steps,setSteps]=useState(detail.steps.map(s=>s.action).join("\n"));
  const [expected,setExpected]=useState(detail.steps[detail.steps.length-1]?.expected||"");
  const iStyle:React.CSSProperties={width:"100%",padding:"8px 10px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
  const lStyle:React.CSSProperties={display:"block",fontSize:12,fontWeight:600,color:T.t2,marginBottom:6};
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex"}}>
      <div style={{flex:1,background:"rgba(0,0,0,0.35)"}} onClick={onClose}/>
      <div style={{width:560,background:"#fff",display:"flex",flexDirection:"column",boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        {/* Header */}
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:T.t1}}>编辑用例</div>
            <div style={{fontSize:11,color:T.t3,marginTop:2,fontFamily:"monospace"}}>{case_.no}</div>
          </div>
          <button onClick={onClose} style={{width:28,height:28,border:"none",background:"transparent",cursor:"pointer",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:T.t3}}>
            <X size={15}/>
          </button>
        </div>
        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"20px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div>
              <label style={lStyle}>用例名称 <span style={{color:T.danger}}>*</span></label>
              <input style={iStyle} value={title} onChange={e=>setTitle(e.target.value)}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <div>
                <label style={lStyle}>所属模块</label>
                <input style={iStyle} value={module} onChange={e=>setModule(e.target.value)}/>
              </div>
              <div>
                <label style={lStyle}>优先级</label>
                <div style={{display:"flex",gap:6}}>
                  {(["P0","P1","P2","P3"] as const).map(p=>{
                    const c=p==="P0"?T.danger:p==="P1"?T.warning:p==="P2"?T.primary:T.t3;
                    const active=priority===p;
                    return(
                      <button key={p} onClick={()=>setPriority(p)}
                        style={{flex:1,height:32,borderRadius:6,border:`1.5px solid ${active?c:T.border}`,background:active?`${c}15`:"#fff",color:active?c:T.t2,fontWeight:active?700:400,fontSize:12,cursor:"pointer"}}>
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div>
              <label style={lStyle}>前置条件</label>
              <textarea style={{...iStyle,height:72,resize:"vertical"}} value={precondition} onChange={e=>setPrecondition(e.target.value)}/>
            </div>
            <div>
              <label style={lStyle}>测试步骤 <span style={{fontSize:11,color:T.t4,fontWeight:400}}>(每行一步)</span></label>
              <textarea style={{...iStyle,height:120,resize:"vertical"}} value={steps} onChange={e=>setSteps(e.target.value)}/>
            </div>
            <div>
              <label style={lStyle}>预期结果</label>
              <textarea style={{...iStyle,height:72,resize:"vertical"}} value={expected} onChange={e=>setExpected(e.target.value)}/>
            </div>
          </div>
        </div>
        {/* Footer */}
        <div style={{padding:"14px 20px",borderTop:`1px solid ${T.border}`,display:"flex",justifyContent:"flex-end",gap:10,flexShrink:0}}>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn color={TM} onClick={onClose}>保存修改</PBtn>
        </div>
      </div>
    </div>
  );
}

// ── Exec workstation ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// LINK BUG MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function LinkBugModal({excludeIds,onClose,onLink}:{
  excludeIds:string[];onClose:()=>void;onLink:(bugs:BugItem[])=>void;
}){
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<string[]>([]);
  const [phase,setPhase]=useState<"idle"|"loading">("idle");
  const available=MOCK_BUGS.filter(b=>
    !excludeIds.includes(b.id)&&
    (!search||(b.no.toLowerCase().includes(search.toLowerCase())||b.title.toLowerCase().includes(search.toLowerCase())))
  );
  const allSelected=available.length>0&&selected.length===available.length;
  const toggleAll=()=>{if(allSelected)setSelected([]);else setSelected(available.map(b=>b.id));};
  const handleLink=()=>{
    if(!selected.length)return;
    setPhase("loading");
    setTimeout(()=>{onLink(MOCK_BUGS.filter(b=>selected.includes(b.id)));},800);
  };
  const TH=({children}:{children:React.ReactNode})=>(
    <th style={{padding:"10px 12px",fontSize:12,fontWeight:500,color:T.t3,textAlign:"left" as const,whiteSpace:"nowrap" as const}}>{children}</th>
  );
  return(
    <div style={{position:"fixed",inset:0,zIndex:1100}}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.45)"}} onClick={phase==="loading"?undefined:onClose}/>
      <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:920,maxHeight:"78vh",
        background:"#fff",borderRadius:12,boxShadow:"0 8px 40px rgba(0,0,0,0.16)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* header */}
        <div style={{height:56,display:"flex",alignItems:"center",padding:"0 24px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:600,color:T.t1}}>关联缺陷</span>
          <div style={{flex:1}}/>
          <div style={{position:"relative",marginRight:12}}>
            <Search size={13} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:T.t4,pointerEvents:"none"}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="通过缺陷编号 / 缺陷名称搜索"
              style={{height:32,paddingLeft:28,paddingRight:10,border:`1.5px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.t1,outline:"none",width:240,boxSizing:"border-box" as const}}
              onFocus={e=>e.currentTarget.style.borderColor=TM} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
          </div>
          <button onClick={phase==="loading"?undefined:onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,display:"flex",alignItems:"center",padding:4}}>
            <X size={18}/>
          </button>
        </div>
        {/* table */}
        <div style={{flex:1,overflowY:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${T.border}`,background:"#FAFAFA",position:"sticky" as const,top:0}}>
                <th style={{width:44,padding:"10px 0 10px 16px",textAlign:"center" as const}}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{cursor:"pointer"}}/>
                </th>
                <TH>缺陷编号</TH><TH>缺陷名称</TH><TH>状态</TH><TH>优先级</TH><TH>严重程度</TH><TH>处理人</TH><TH>创建人</TH><TH>创建时间</TH>
              </tr>
            </thead>
            <tbody>
              {available.map(b=>{
                const bs=BUG_STA_CFG[b.status];
                const sev=BUG_SEV_CFG[b.severity];
                const bpc=b.priority==="P0"?T.danger:b.priority==="P1"?"#FF7D00":b.priority==="P2"?T.primary:T.t3;
                const isSel=selected.includes(b.id);
                return(
                  <tr key={b.id} style={{borderBottom:`1px solid ${T.border}`,background:isSel?`${TM}06`:"#fff",cursor:"pointer"}}
                    onClick={()=>setSelected(q=>isSel?q.filter(x=>x!==b.id):[...q,b.id])}>
                    <td style={{padding:"10px 0 10px 16px",textAlign:"center" as const}} onClick={e=>e.stopPropagation()}>
                      <input type="checkbox" checked={isSel} onChange={()=>setSelected(q=>isSel?q.filter(x=>x!==b.id):[...q,b.id])} style={{cursor:"pointer"}}/>
                    </td>
                    <td style={{padding:"10px 12px"}}><code style={{fontSize:11,color:TM,fontFamily:"monospace"}}>{b.no}</code></td>
                    <td style={{padding:"10px 12px",maxWidth:280}}><span style={{fontSize:13,color:T.t1,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.title}</span></td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:bs.bg,color:bs.color,whiteSpace:"nowrap"}}>{bs.label}</span></td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:11,fontWeight:700,padding:"2px 6px",borderRadius:4,background:`${bpc}15`,color:bpc}}>{b.priority}</span></td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:12,color:sev.color,fontWeight:500}}>{sev.label}</span></td>
                    <td style={{padding:"10px 12px",fontSize:12,color:T.t2,whiteSpace:"nowrap"}}>{b.assignee}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:T.t2,whiteSpace:"nowrap"}}>张程远</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:T.t3,whiteSpace:"nowrap",fontFamily:"monospace"}}>{b.foundAt}</td>
                  </tr>
                );
              })}
              {available.length===0&&(
                <tr><td colSpan={9} style={{padding:"52px 0",textAlign:"center" as const,fontSize:13,color:T.t3}}>
                  {search?"无匹配缺陷":"暂无可关联的缺陷"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {/* footer */}
        <div style={{height:56,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"0 24px",gap:10,flexShrink:0}}>
          {selected.length>0&&<span style={{fontSize:13,color:T.t3,flex:1}}>已选 <b style={{color:T.t1}}>{selected.length}</b> 条</span>}
          <PBtn variant="ghost" onClick={phase==="loading"?undefined:onClose}>取消</PBtn>
          <button onClick={handleLink} disabled={!selected.length||phase==="loading"}
            style={{height:34,padding:"0 18px",borderRadius:8,fontSize:13,fontWeight:600,border:"none",
              background:selected.length?TM:T.border,color:selected.length?"#fff":T.t4,
              cursor:selected.length&&phase==="idle"?"pointer":"not-allowed",
              display:"flex",alignItems:"center",gap:6,opacity:phase==="loading"?0.65:1}}>
            {phase==="loading"?<><Spinner size={13} color="#fff"/>关联中…</>:"确认关联"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanExecWorkstation({plan,initCaseId,allCases,onBack}:{
  plan:TestPlan;initCaseId?:string;allCases:PlanCase[];onBack:()=>void;
}){
  const firstPending=allCases.find(c=>c.status==="pending")?.id??allCases[0]?.id;
  const [cases,setCases]=useState<PlanCase[]>(allCases);
  const [activeId,setActiveId]=useState(initCaseId??firstPending);
  const [tab,setTab]=useState<"detail"|"defects"|"history">("detail");
  const [actual,setActual]=useState("");
  const [remark,setRemark]=useState("");
  const [autoNext,setAutoNext]=useState(false);
  const [listFilter,setListFilter]=useState<"all"|ExecStatus>("all");
  const [listSearch,setListSearch]=useState("");
  const [showEdit,setShowEdit]=useState(false);
  const [showLinkBug,setShowLinkBug]=useState(false);
  const [showNewBug,setShowNewBug]=useState(false);
  const [linkedBugsExtra,setLinkedBugsExtra]=useState<Record<string,BugItem[]>>({});
  const [toast,setToast]=useState<string|null>(null);

  const active=cases.find(c=>c.id===activeId)??cases[0];
  const idx=cases.findIndex(c=>c.id===activeId);
  const detail=active?getSteps(active.no):null;
  const ec=active?EXEC_STATUS_CFG_EX[active.status]:null;
  const activeBugs:BugItem[]=[
    ...MOCK_BUGS.filter(b=>active&&b.linkedCase===active.no),
    ...(active?linkedBugsExtra[active.no]??[]:[] as BugItem[]),
  ];
  const activeBugIds=activeBugs.map(b=>b.id);
  const handleLinkBugs=(bugs:BugItem[])=>{
    if(!active)return;
    setLinkedBugsExtra(prev=>{
      const existing=prev[active.no]??[];
      const toAdd=bugs.filter(b=>!existing.some(e=>e.id===b.id)&&!MOCK_BUGS.some(m=>m.linkedCase===active.no&&m.id===b.id));
      return {...prev,[active.no]:[...existing,...toAdd]};
    });
    setShowLinkBug(false);
    showMsg(`已关联 ${bugs.length} 条缺陷`);
  };
  const handleUnlinkBug=(bugId:string)=>{
    if(!active)return;
    setLinkedBugsExtra(prev=>({...prev,[active.no]:(prev[active.no]??[]).filter(b=>b.id!==bugId)}));
  };
  const pcColor=active?.priority==="P0"?T.danger:active?.priority==="P1"?T.warning:active?.priority==="P2"?T.primary:T.t3;

  const filteredList=cases.filter(c=>{
    if(listFilter!=="all"&&c.status!==listFilter)return false;
    if(listSearch&&!c.title.includes(listSearch)&&!c.no.includes(listSearch))return false;
    return true;
  });

  const passedN=cases.filter(c=>c.status==="passed").length;
  const failedN=cases.filter(c=>c.status==="failed").length;
  const blockedN=cases.filter(c=>c.status==="blocked").length;

  const showMsg=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(null),2000);};

  const markCase=(status:ExecStatus)=>{
    if(!active)return;
    const now=new Date();
    const t=`${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    setCases(q=>q.map(c=>c.id===activeId?{...c,status,execTime:t,notes:actual||c.notes}:c));
    const labels:Record<ExecStatus,string>={passed:"通过",failed:"失败",blocked:"阻塞",pending:"未执行"};
    showMsg(`已标记为${labels[status]}`);
    setActual("");
    if(autoNext&&idx<cases.length-1){setTimeout(()=>{setActiveId(cases[idx+1].id);setTab("detail");},500);}
  };

  const handleSelect=(id:string)=>{setActiveId(id);setActual("");setRemark("");setTab("detail");};

  const TABS=[
    {key:"detail" as const,  label:"详情"},
    {key:"defects" as const, label:`关联缺陷 (${activeBugs.length})`},
    {key:"history" as const, label:"执行历史"},
  ];

  const SectionLabel=({label}:{label:string})=>(
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
      <span style={{width:3,height:14,borderRadius:2,background:TM,flexShrink:0,display:"inline-block"}}/>
      <span style={{fontSize:13,fontWeight:600,color:T.t1}}>{label}</span>
    </div>
  );

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg}}>
      {/* ── Top: breadcrumb bar (full width) ──────────────────────────── */}
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,height:52,display:"flex",alignItems:"center",padding:"0 20px",gap:10}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:T.t3,background:"none",border:"none",cursor:"pointer",padding:0,flexShrink:0}}
          onMouseEnter={e=>e.currentTarget.style.color=TM} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
          <ChevronLeft size={13}/>测试计划
        </button>
        {/* vertical divider */}
        <span style={{width:1,height:16,background:T.border,flexShrink:0}}/>
        {/* active case status + no + title */}
        {ec&&active&&(
          <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,padding:"2px 8px",borderRadius:10,background:ec.bg,color:ec.color,fontWeight:500,flexShrink:0}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:ec.dot,display:"inline-block"}}/>
            {ec.label}
          </span>
        )}
        {active&&<code style={{fontSize:11,color:T.t4,fontFamily:"monospace",flexShrink:0}}>{active.no}</code>}
        {active&&<span style={{fontSize:14,fontWeight:600,color:T.t1,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{active.title}</span>}
        <PBtn variant="ghost" icon={Edit2} onClick={()=>setShowEdit(true)}>编辑用例</PBtn>
      </div>

      {/* ── Body: left queue + right detail ───────────────────────────── */}
      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
      {/* ── Left: case queue ──────────────────────────────────────────── */}
      <div style={{width:260,flexShrink:0,background:"#fff",borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Search */}
        <div style={{padding:"10px 12px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{position:"relative",display:"flex",alignItems:"center"}}>
            <Search size={12} style={{position:"absolute",left:8,color:T.t4,pointerEvents:"none"}}/>
            <input value={listSearch} onChange={e=>setListSearch(e.target.value)} placeholder="搜索编号或标题…"
              style={{width:"100%",height:28,paddingLeft:26,paddingRight:8,border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none",boxSizing:"border-box"}}
              onFocus={e=>{e.currentTarget.style.borderColor=TM;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
          </div>
        </div>
        {/* Filter chips */}
        <div style={{padding:"8px 12px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:4,flexShrink:0}}>
          {(["all","pending","passed","failed","blocked"] as ("all"|ExecStatus)[]).map(s=>{
            const cnt=s==="all"?cases.length:cases.filter(c=>c.status===s).length;
            const active2=listFilter===s;
            const col=s==="all"?TM:EXEC_STATUS_CFG_EX[s].color;
            return(
              <button key={s} onClick={()=>setListFilter(s)}
                style={{padding:"3px 8px",borderRadius:10,fontSize:11,cursor:"pointer",border:`1px solid ${active2?col:T.border}`,background:active2?`${col}12`:"transparent",color:active2?col:T.t3,fontWeight:active2?600:400,whiteSpace:"nowrap"}}>
                {s==="all"?"全部":EXEC_STATUS_CFG_EX[s].label}&nbsp;{cnt>0?cnt:""}
              </button>
            );
          })}
        </div>
        {/* Case list */}
        <div style={{flex:1,overflowY:"auto"}}>
          {filteredList.map(c=>{
            const ce=EXEC_STATUS_CFG_EX[c.status];
            const isActive=c.id===activeId;
            return(
              <div key={c.id} onClick={()=>handleSelect(c.id)}
                style={{padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${T.border}`,borderLeft:`3px solid ${isActive?TM:"transparent"}`,background:isActive?`${TM}06`:"#fff",transition:"background 0.12s"}}
                onMouseEnter={e=>{if(!isActive)e.currentTarget.style.background=T.bg;}}
                onMouseLeave={e=>{if(!isActive)e.currentTarget.style.background="#fff";}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:11,color:isActive?TM:T.t3,fontFamily:"monospace",fontWeight:500}}>{c.no}</span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:11,padding:"1px 6px",borderRadius:10,background:ce.bg,color:ce.color,fontWeight:500}}>
                    <span style={{width:5,height:5,borderRadius:"50%",background:ce.dot,display:"inline-block"}}/>
                    {ce.label}
                  </span>
                </div>
                <div style={{fontSize:12,color:isActive?TM:T.t1,fontWeight:isActive?600:400,lineHeight:1.4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{c.title}</div>
              </div>
            );
          })}
          {filteredList.length===0&&<div style={{padding:"32px 12px",textAlign:"center",fontSize:12,color:T.t4}}>无匹配用例</div>}
        </div>
        {/* Bottom stats */}
        <div style={{padding:"8px 14px",borderTop:`1px solid ${T.border}`,flexShrink:0,background:"#FAFAFA",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:11,color:T.t3}}>
            <span style={{color:T.success,fontWeight:600}}>{passedN}</span> 通过&nbsp;&nbsp;
            <span style={{color:T.danger,fontWeight:600}}>{failedN}</span> 失败&nbsp;&nbsp;
            <span style={{color:T.warning,fontWeight:600}}>{blockedN}</span> 阻塞
          </span>
          <span style={{fontSize:11,color:T.t3,fontFamily:"monospace"}}>
            <strong style={{color:T.t1}}>{idx+1}</strong>/{cases.length}
          </span>
        </div>
      </div>

      {/* ── Right: main panel ─────────────────────────────────────────── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Tabs */}
        <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",padding:"0 20px",height:44}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              style={{height:"100%",padding:"0 16px",fontSize:13,fontWeight:tab===t.key?600:400,border:"none",borderBottom:`2px solid ${tab===t.key?TM:"transparent"}`,background:"transparent",color:tab===t.key?TM:T.t3,cursor:"pointer",transition:"color 0.12s",whiteSpace:"nowrap"}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{flex:1,overflowY:"auto",padding:20}}>

          {/* ── 详情 */}
          {tab==="detail"&&detail&&active&&(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* 4-column card grid */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                {/* 前置条件 */}
                <div style={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 16px",minHeight:200}}>
                  <SectionLabel label="前置条件"/>
                  <p style={{fontSize:13,color:T.t2,lineHeight:1.7,margin:0}}>{detail.precondition}</p>
                </div>
                {/* 测试步骤 */}
                <div style={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 16px",minHeight:200}}>
                  <SectionLabel label="测试步骤"/>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {detail.steps.map((s,i)=>(
                      <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                        <span style={{width:18,height:18,borderRadius:"50%",background:`${TM}15`,color:TM,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{i+1}</span>
                        <span style={{fontSize:12,color:T.t1,lineHeight:1.6}}>{s.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* 预期结果 */}
                <div style={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 16px",minHeight:200}}>
                  <SectionLabel label="预期结果"/>
                  <p style={{fontSize:13,color:T.t2,lineHeight:1.7,margin:0}}>{detail.steps[detail.steps.length-1]?.expected||"—"}</p>
                </div>
                {/* 实际结果 (editable) */}
                <div style={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 16px",minHeight:200,display:"flex",flexDirection:"column"}}>
                  <SectionLabel label="实际结果"/>
                  <textarea value={actual} onChange={e=>setActual(e.target.value)}
                    placeholder="请填写本次执行的实际结果…"
                    style={{flex:1,minHeight:140,padding:"8px 10px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,color:T.t1,outline:"none",resize:"none",fontFamily:"inherit",lineHeight:1.6,boxSizing:"border-box"}}
                    onFocus={e=>{e.currentTarget.style.borderColor=TM;e.currentTarget.style.boxShadow=`0 0 0 2px ${TM}18`;}}
                    onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
                </div>
              </div>

              {/* 执行备注 */}
              <div style={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 16px"}}>
                <SectionLabel label="执行备注"/>
                {active.notes
                  ?<p style={{fontSize:13,color:T.t2,lineHeight:1.7,margin:0}}>{active.notes}</p>
                  :<textarea value={remark} onChange={e=>setRemark(e.target.value)} placeholder="补充执行说明（选填）…" rows={3}
                    style={{width:"100%",padding:"8px 10px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,color:T.t1,outline:"none",resize:"none",fontFamily:"inherit",lineHeight:1.6,boxSizing:"border-box"}}
                    onFocus={e=>{e.currentTarget.style.borderColor=TM;e.currentTarget.style.boxShadow=`0 0 0 2px ${TM}18`;}}
                    onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
                }
              </div>

              {/* 执行证据 */}
              <div style={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,padding:"14px 16px"}}>
                <SectionLabel label="执行证据"/>
                <div style={{borderRadius:8,border:`1.5px dashed ${T.border}`,padding:"28px 16px",background:"#FAFAFA",display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=TM;e.currentTarget.style.background=`${TM}06`;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background="#FAFAFA";}}>
                  <Upload size={20} style={{color:T.t4}}/>
                  <p style={{fontSize:13,color:T.t2,margin:0}}>点击上传，或将文件拖拽至此处</p>
                  <p style={{fontSize:11,color:T.t4,margin:0}}>支持图片 / 文档，截图可直接粘贴（Ctrl+V），单文件不超过 20 MB</p>
                </div>
              </div>
              <div style={{height:4}}/>
            </div>
          )}

          {/* ── 关联缺陷 */}
          {tab==="defects"&&(
            <div>
              <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:16}}>
                <PBtn variant="ghost" icon={Link2} onClick={()=>setShowLinkBug(true)}>关联已有缺陷</PBtn>
                <PBtn icon={Plus} onClick={()=>setShowNewBug(true)}>新建缺陷</PBtn>
              </div>
              {activeBugs.length>0?(
                <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",background:"#fff"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                        {["缺陷编号","缺陷标题","优先级","严重级别","状态","负责人","更新时间","操作"].map(h=>(
                          <th key={h} style={{padding:"10px 12px",fontSize:12,fontWeight:500,color:T.t3,textAlign:"left" as const,whiteSpace:"nowrap" as const}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeBugs.map((bug,i)=>{
                        const bs=BUG_STA_CFG[bug.status];
                        const sev=BUG_SEV_CFG[bug.severity];
                        const bpc=bug.priority==="P0"?T.danger:bug.priority==="P1"?"#FF7D00":bug.priority==="P2"?T.primary:T.t3;
                        const isFromMock=MOCK_BUGS.some(m=>m.linkedCase===active?.no&&m.id===bug.id);
                        return(
                          <tr key={bug.id} style={{borderBottom:i<activeBugs.length-1?`1px solid ${T.border}`:"none"}}>
                            <td style={{padding:"10px 12px"}}><code style={{fontSize:11,color:TM,fontFamily:"monospace"}}>{bug.no}</code></td>
                            <td style={{padding:"10px 12px",maxWidth:320}}><span style={{fontSize:13,color:T.t1,display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{bug.title}</span></td>
                            <td style={{padding:"10px 12px"}}><span style={{fontSize:11,fontWeight:700,padding:"2px 6px",borderRadius:4,background:`${bpc}15`,color:bpc}}>{bug.priority}</span></td>
                            <td style={{padding:"10px 12px"}}><span style={{fontSize:12,color:sev.color,fontWeight:500}}>{sev.label}</span></td>
                            <td style={{padding:"10px 12px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:bs.bg,color:bs.color,whiteSpace:"nowrap" as const}}>{bs.label}</span></td>
                            <td style={{padding:"10px 12px",fontSize:12,color:T.t2,whiteSpace:"nowrap" as const}}>{bug.assignee}</td>
                            <td style={{padding:"10px 12px",fontSize:12,color:T.t3,fontFamily:"monospace",whiteSpace:"nowrap" as const}}>{bug.foundAt}</td>
                            <td style={{padding:"10px 12px",whiteSpace:"nowrap" as const}}>
                              <button style={{fontSize:12,color:TM,background:"none",border:"none",cursor:"pointer",padding:"2px 4px"}}>查看</button>
                              <button onClick={isFromMock?undefined:()=>handleUnlinkBug(bug.id)}
                                style={{fontSize:12,color:T.danger,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",marginLeft:6}}>
                                取消关联
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"64px 0"}}>
                  <Bug size={36} style={{color:T.t4}}/>
                  <p style={{fontSize:13,color:T.t3,margin:0}}>暂无关联缺陷</p>
                </div>
              )}
            </div>
          )}

          {/* ── 执行历史 */}
          {tab==="history"&&(
            <div>
              {active?.status==="pending"?(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"64px 0"}}>
                  <FileCheck size={36} style={{color:T.t4}}/>
                  <p style={{fontSize:13,color:T.t3,margin:0}}>该用例尚未执行，暂无历史记录</p>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[{status:active?.status??"pending",time:active?.execTime??"—",user:active?.assignee??"—",actual:active?.notes||"已完成执行",remark:""}].map((r,i)=>{
                    const re=EXEC_STATUS_CFG_EX[r.status as ExecStatus];
                    return(
                      <div key={i} style={{borderRadius:10,border:`1px solid ${T.border}`,overflow:"hidden",background:"#fff"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                          <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:12}}>
                            <span style={{width:6,height:6,borderRadius:"50%",background:re.dot,display:"inline-block"}}/>
                            <span style={{color:re.color,fontWeight:500}}>{re.label}</span>
                          </span>
                          <span style={{fontSize:12,color:T.t3,fontFamily:"monospace"}}>{r.time}</span>
                          <span style={{fontSize:12,color:T.t2}}>执行人：{r.user}</span>
                        </div>
                        <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
                          {r.actual&&<div><p style={{fontSize:11,fontWeight:600,color:T.t4,margin:"0 0 4px"}}>实际结果</p><p style={{fontSize:13,color:T.t1,margin:0}}>{r.actual}</p></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom action bar ────────────────────────────────────────── */}
        <div style={{background:"#fff",borderTop:`1px solid ${T.border}`,flexShrink:0,height:56,display:"flex",alignItems:"center",padding:"0 20px",gap:10}}>
          {/* Prev / counter / Next */}
          <button onClick={()=>idx>0&&handleSelect(cases[idx-1].id)} disabled={idx===0}
            style={{display:"flex",alignItems:"center",gap:4,padding:"0 12px",height:32,borderRadius:8,border:`1px solid ${T.border}`,background:"#fff",color:idx===0?T.t4:T.t2,cursor:idx===0?"not-allowed":"pointer",fontSize:13}}>
            <ChevronLeft size={13}/>上一条
          </button>
          <span style={{fontSize:13,fontFamily:"monospace",color:T.t3,minWidth:40,textAlign:"center"}}>
            <strong style={{color:T.t1}}>{idx+1}</strong>/{cases.length}
          </span>
          <button onClick={()=>idx<cases.length-1&&handleSelect(cases[idx+1].id)} disabled={idx===cases.length-1}
            style={{display:"flex",alignItems:"center",gap:4,padding:"0 12px",height:32,borderRadius:8,border:`1px solid ${T.border}`,background:"#fff",color:idx===cases.length-1?T.t4:T.t2,cursor:idx===cases.length-1?"not-allowed":"pointer",fontSize:13}}>
            下一条<ChevronRight size={13}/>
          </button>
          <span style={{width:1,height:20,background:T.border,flexShrink:0}}/>
          {/* Auto next toggle */}
          <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
            <div onClick={()=>setAutoNext(v=>!v)}
              style={{width:32,height:18,borderRadius:9,background:autoNext?TM:T.t4,cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
              <span style={{position:"absolute",top:2,left:autoNext?14:2,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
            </div>
            <span style={{fontSize:12,color:T.t3}}>自动下一条</span>
          </label>
          <div style={{flex:1}}/>
          {/* Add defect */}
          <button style={{display:"flex",alignItems:"center",gap:5,padding:"0 14px",height:32,borderRadius:8,border:`1px solid ${T.border}`,background:"#fff",color:T.t2,fontSize:13,cursor:"pointer"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=T.danger;e.currentTarget.style.color=T.danger;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.t2;}}>
            <span style={{fontSize:14}}>☆</span> 添加缺陷
          </button>
          <span style={{width:1,height:20,background:T.border,flexShrink:0}}/>
          {/* Mark buttons */}
          <button onClick={()=>markCase("blocked")}
            style={{padding:"0 14px",height:32,borderRadius:8,border:`1px solid #FFD595`,background:"#FFF3E8",color:T.warning,fontSize:13,fontWeight:500,cursor:"pointer"}}>
            标记阻塞
          </button>
          <button onClick={()=>markCase("failed")}
            style={{padding:"0 14px",height:32,borderRadius:8,border:`1px solid #FBBBBB`,background:"#FFE8E8",color:T.danger,fontSize:13,fontWeight:500,cursor:"pointer"}}>
            标记失败
          </button>
          <button onClick={()=>markCase("passed")}
            style={{display:"flex",alignItems:"center",gap:5,padding:"0 18px",height:32,borderRadius:8,border:"none",background:T.success,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            <Check size={14}/>标记通过
          </button>
        </div>
      </div>

      </div>{/* end body row */}

      {/* Edit drawer */}
      {showEdit&&active&&<CaseEditDrawer case_={active} onClose={()=>setShowEdit(false)}/>}

      {/* Link bug modal */}
      {showLinkBug&&<LinkBugModal excludeIds={activeBugIds} onClose={()=>setShowLinkBug(false)} onLink={handleLinkBugs}/>}

      {/* New bug drawer */}
      {showNewBug&&active&&<NewBugInPlanModal caseNo={active.no} caseTitle={active.title} onClose={()=>setShowNewBug(false)}/>}

      {/* Toast */}
      {toast&&<div style={{position:"fixed",bottom:72,left:"50%",transform:"translateX(-50%)",padding:"8px 18px",borderRadius:8,fontSize:13,fontWeight:500,color:"#fff",background:T.t1,zIndex:9999,pointerEvents:"none",boxShadow:"0 4px 12px rgba(0,0,0,0.2)"}}>{toast}</div>}
    </div>
  );
}

// ─── Case Picker Modal ────────────────────────────────────────────────────────
function CasePickerModal({selected,onClose,onConfirm,versionId}:{selected:string[];onClose:()=>void;onConfirm:(ids:string[])=>void;versionId?:string}){
  const [selDir,setSelDir]=useState("root");
  const [search,setSearch]=useState("");
  const [checked,setChecked]=useState<Set<string>>(new Set(selected));
  const [expanded,setExpanded]=useState<Set<string>>(new Set(["root"]));
  const [filterReq,setFilterReq]=useState("all");

  const toggle=(id:string)=>{const n=new Set(checked);n.has(id)?n.delete(id):n.add(id);setChecked(n);};
  const toggleExpand=(id:string,e:React.MouseEvent)=>{e.stopPropagation();const n=new Set(expanded);n.has(id)?n.delete(id):n.add(id);setExpanded(n);};

  const subtreeNode=findDirNode(CASE_DIR_TREE[0],selDir);
  const subtreeDirIds=subtreeNode?collectDirIds(subtreeNode):[selDir];

  const reqsForFilter=versionId?MOCK_REQS.filter(r=>r.versionId===versionId):MOCK_REQS;
  const reqFilteredNos=filterReq==="all"?null:new Set(reqsForFilter.find(r=>r.id===filterReq)?.linkedCases?.map(c=>c.no)??[]);

  const filtered=CASE_LIB.filter(c=>{
    if(!subtreeDirIds.includes(c.dir))return false;
    if(search&&!c.title.includes(search)&&!c.no.includes(search))return false;
    if(reqFilteredNos&&!reqFilteredNos.has(c.no))return false;
    return true;
  });
  const allChk=filtered.length>0&&filtered.every(c=>checked.has(c.id));

  // Recursive tree node
  const TreeNode=({node,depth=0}:{node:DirNode;depth?:number})=>{
    const isExp=expanded.has(node.id);
    const isSel=selDir===node.id;
    const hasKids=!!node.children?.length;
    const selInDir=CASE_LIB.filter(c=>collectDirIds(node).includes(c.dir)&&checked.has(c.id)).length;
    return(
      <div>
        <div onClick={()=>{setSelDir(node.id);if(hasKids&&!isExp)setExpanded(p=>{const n=new Set(p);n.add(node.id);return n;});}}
          style={{display:"flex",alignItems:"center",paddingLeft:6+depth*14,paddingRight:8,height:30,borderRadius:6,cursor:"pointer",marginBottom:1,
            background:isSel?`${TM}12`:"transparent",transition:"background 0.1s"}}
          onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="#EFF0F5";}}
          onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
          {/* Expand toggle */}
          {hasKids
            ?<button onClick={e=>toggleExpand(node.id,e)} style={{background:"none",border:"none",cursor:"pointer",padding:0,lineHeight:0,marginRight:2,flexShrink:0}}>
                <ChevronRight size={11} style={{color:isSel?TM:T.t4,transform:isExp?"rotate(90deg)":"rotate(0deg)",transition:"transform 0.15s",display:"block"}}/>
              </button>
            :<span style={{width:13,flexShrink:0}}/>}
          {/* Folder icon */}
          <span style={{marginRight:5,lineHeight:0,flexShrink:0}}>
            {isExp&&hasKids
              ?<FolderOpen size={13} style={{color:"#FF7D00"}}/>
              :<Folder size={13} style={{color:depth===0?"#7816FF":depth===1?"#FF7D00":"#FAAD14"}}/>}
          </span>
          {/* Label */}
          <span style={{fontSize:12,color:isSel?TM:T.t1,fontWeight:isSel?600:400,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{node.label}</span>
          {/* Count */}
          <span style={{fontSize:10,flexShrink:0,marginLeft:6}}>
            {selInDir>0&&<span style={{color:TM,fontWeight:700}}>{selInDir}/</span>}
            <span style={{color:isSel?TM:T.t4}}>{node.count}</span>
          </span>
        </div>
        {isExp&&hasKids&&(
          <div>{node.children!.map(c=><TreeNode key={c.id} node={c} depth={depth+1}/>)}</div>
        )}
      </div>
    );
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(29,33,41,0.5)"}}/>
      <div style={{position:"relative",background:"#fff",borderRadius:14,width:840,height:580,display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.2)",overflow:"hidden"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",padding:"0 20px",height:52,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div style={{width:4,height:18,borderRadius:2,background:TM,marginRight:10}}/>
          <span style={{fontSize:15,fontWeight:700,color:T.t1}}>选择测试用例</span>
          <div style={{flex:1}}/>
          {checked.size>0&&<span style={{fontSize:12,color:TM,fontWeight:600,marginRight:12}}>已选 {checked.size} 个</span>}
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0}}><X size={16}/></button>
        </div>
        <div style={{flex:1,display:"flex",minHeight:0}}>
          {/* Directory tree panel */}
          <div style={{width:196,flexShrink:0,borderRight:`1px solid ${T.border}`,overflowY:"auto",background:"#FAFBFE",padding:"8px 6px"}}>
            <div style={{fontSize:10,fontWeight:700,color:T.t4,padding:"4px 8px 8px",letterSpacing:"0.06em",textTransform:"uppercase"}}>请求目录</div>
            {CASE_DIR_TREE.map(n=><TreeNode key={n.id} node={n} depth={0}/>)}
          </div>
          {/* Right: search + table */}
          <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",alignItems:"center",gap:8}}>
              <div style={{position:"relative",flex:1}}>
                <Search size={13} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.t4,pointerEvents:"none"}}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索用例名称或编号…"
                  style={{width:"100%",height:32,paddingLeft:30,paddingRight:10,border:`1px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none",boxSizing:"border-box"}}
                  onFocus={e=>e.currentTarget.style.borderColor=TM} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
              </div>
              {reqsForFilter.length>0&&(
                <select value={filterReq} onChange={e=>{setFilterReq(e.target.value);setSelDir("root");}}
                  style={{height:32,padding:"0 8px",border:`1px solid ${filterReq!=="all"?TM:T.border}`,borderRadius:7,fontSize:12,color:filterReq!=="all"?TM:T.t2,background:filterReq!=="all"?`${TM}08`:"#fff",outline:"none",maxWidth:200,cursor:"pointer"}}>
                  <option value="all">按需求筛选</option>
                  {reqsForFilter.map(r=><option key={r.id} value={r.id}>{r.id} · {r.title}</option>)}
                </select>
              )}
            </div>
            {/* Breadcrumb path */}
            <div style={{padding:"5px 14px",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",alignItems:"center",gap:5,background:"#FAFBFE",minHeight:28}}>
              <Folder size={11} style={{color:"#FF7D00",flexShrink:0}}/>
              <span style={{fontSize:11,color:T.t2}}>{subtreeNode?.label||"全部"}</span>
              <span style={{fontSize:11,color:T.t4}}>({filtered.length} 条)</span>
            </div>
            <div style={{flex:1,overflowY:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                    <th style={{width:36,padding:"8px 0 8px 14px",textAlign:"center"}}>
                      <input type="checkbox" checked={allChk}
                        onChange={()=>{const n=new Set(checked);allChk?filtered.forEach(c=>n.delete(c.id)):filtered.forEach(c=>n.add(c.id));setChecked(n);}}
                        style={{accentColor:TM,cursor:"pointer"}}/>
                    </th>
                    {["编号","用例名称","所属目录","优先级"].map(h=>(
                      <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.t3}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c,i)=>{
                    const isChk=checked.has(c.id);
                    const pc=c.priority==="P0"?T.danger:c.priority==="P1"?T.warning:T.primary;
                    const dirNode=findDirNode(CASE_DIR_TREE[0],c.dir);
                    return(
                      <tr key={c.id} onClick={()=>toggle(c.id)}
                        style={{borderBottom:i<filtered.length-1?`1px solid ${T.border}`:"none",background:isChk?`${TM}06`:"#fff",cursor:"pointer"}}
                        onMouseEnter={e=>{if(!isChk)e.currentTarget.style.background="#FAFBFF";}}
                        onMouseLeave={e=>{e.currentTarget.style.background=isChk?`${TM}06`:"#fff";}}>
                        <td style={{padding:"8px 0 8px 14px",textAlign:"center"}}>
                          <input type="checkbox" checked={isChk} onChange={()=>toggle(c.id)} onClick={e=>e.stopPropagation()} style={{accentColor:TM,cursor:"pointer"}}/>
                        </td>
                        <td style={{padding:"8px 12px"}}><code style={{fontSize:11,color:T.t3,fontFamily:"monospace"}}>{c.no}</code></td>
                        <td style={{padding:"8px 12px"}}><span style={{fontSize:13,color:T.t1}}>{c.title}</span></td>
                        <td style={{padding:"8px 12px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:4}}>
                            <Folder size={10} style={{color:"#FAAD14",flexShrink:0}}/>
                            <span style={{fontSize:11,color:T.t3}}>{dirNode?.label||c.module}</span>
                          </div>
                        </td>
                        <td style={{padding:"8px 12px"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:`${pc}15`,color:pc}}>{c.priority}</span></td>
                      </tr>
                    );
                  })}
                  {filtered.length===0&&(
                    <tr><td colSpan={5} style={{padding:"48px",textAlign:"center",color:T.t4,fontSize:12}}>该目录下暂无用例</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {/* Footer */}
        <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"10px 16px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{flex:1,fontSize:12,color:T.t3}}>已选 <span style={{color:TM,fontWeight:700}}>{checked.size}</span> 个用例</span>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn color={TM} disabled={checked.size===0} onClick={()=>onConfirm([...checked])}>确认添加</PBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Mark Result Modal ────────────────────────────────────────────────────────
function MarkResultModal({planCase,onClose,onConfirm}:{planCase:PlanCase;onClose:()=>void;onConfirm:(status:ExecStatus,notes:string)=>void}){
  const [status,setStatus]=useState<ExecStatus|null>(planCase.status==="pending"?null:planCase.status);
  const [notes,setNotes]=useState(planCase.notes);
  const OPTS:[ExecStatus,string,string,React.ReactNode][]=[
    ["passed","通过",T.success,<Check size={15} key="p"/>],
    ["failed","失败",T.danger,<X size={15} key="f"/>],
    ["blocked","阻塞",T.warning,<AlertTriangle size={13} key="b"/>],
    ["skipped","跳过",T.t3,<ChevronRight size={15} key="s"/>],
  ];
  return(
    <div style={{position:"fixed",inset:0,zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(29,33,41,0.45)"}}/>
      <div style={{position:"relative",background:"#fff",borderRadius:14,width:440,boxShadow:"0 20px 60px rgba(0,0,0,0.18)"}}>
        <div style={{display:"flex",alignItems:"center",padding:"0 18px",height:52,borderBottom:`1px solid ${T.border}`}}>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:700,color:T.t1}}>标记执行结果</div>
            <div style={{fontSize:11,color:T.t3,marginTop:1}}>{planCase.no} · {planCase.title}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0}}><X size={15}/></button>
        </div>
        <div style={{padding:"20px 18px",display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:10}}>执行结果 *</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {OPTS.map(([s,l,c,ic])=>(
                <button key={s} onClick={()=>setStatus(s)}
                  style={{padding:"12px 8px",borderRadius:10,border:`2px solid ${status===s?c:T.border}`,background:status===s?`${c}12`:"#FAFBFE",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,transition:"all 0.12s"}}>
                  <div style={{width:30,height:30,borderRadius:"50%",background:status===s?c:`${T.t4}25`,display:"flex",alignItems:"center",justifyContent:"center",transition:"background 0.12s"}}>
                    <span style={{color:status===s?"#fff":T.t4,display:"flex"}}>{ic}</span>
                  </div>
                  <span style={{fontSize:12,fontWeight:600,color:status===s?c:T.t3}}>{l}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:8}}>备注（选填）</div>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="填写失败原因、阻塞说明或备注…" rows={3}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:13,color:T.t1,outline:"none",resize:"none",boxSizing:"border-box"}}
              onFocus={e=>e.currentTarget.style.borderColor=TM} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,padding:"12px 18px",borderTop:`1px solid ${T.border}`}}>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn color={!status?T.t4:status==="passed"?T.success:status==="failed"?T.danger:status==="blocked"?T.warning:T.t3}
            disabled={!status} onClick={()=>status&&onConfirm(status,notes)}>
            确认标记
          </PBtn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW TEST PLAN — 3-step wizard
// ═══════════════════════════════════════════════════════════════════════════════
function NewTestPlanPage({onBack,defaultVersionId}:{onBack:()=>void;defaultVersionId?:string}){
  const [step,setStep]=useState(0);
  const [purpose,setPurpose]=useState<PlanPurpose>("version");
  const [planName,setPlanName]=useState("");
  const [versionId,setVersionId]=useState(defaultVersionId||"");
  const [planType,setPlanType]=useState<PlanType>("regression");
  const [owner,setOwner]=useState("");
  const [startDate,setStartDate]=useState("");
  const [endDate,setEndDate]=useState("");
  const [goal,setGoal]=useState("");
  const [selectedCases,setSelectedCases]=useState<string[]>([]);
  const [showPicker,setShowPicker]=useState(false);
  // Version-plan req-driven selection
  const [selectedReqIds,setSelectedReqIds]=useState<string[]>([]);
  const [excludedCaseNos,setExcludedCaseNos]=useState<string[]>([]);
  const [manualCaseIds,setManualCaseIds]=useState<string[]>([]);
  const [showManualPicker,setShowManualPicker]=useState(false);
  const [minExecRate,setMinExecRate]=useState("90");
  const [minPassRate,setMinPassRate]=useState("85");
  const [allowP0,setAllowP0]=useState(false);
  const [maxP1,setMaxP1]=useState("3");
  const [autoReport,setAutoReport]=useState(true);
  const [needConfirm,setNeedConfirm]=useState(true);

  const STEPS=["基本信息","测试范围","质量标准"];
  const fi={height:34,width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"0 12px",fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box" as const};
  const fs={...fi,background:"#fff"};
  const SLabel=({label,req}:{label:string;req?:boolean})=>(
    <label style={{display:"block",fontSize:12,fontWeight:600,color:T.t2,marginBottom:6}}>{label}{req&&<span style={{color:T.danger,marginLeft:2}}>*</span>}</label>
  );
  const onFI=(e:React.FocusEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>e.currentTarget.style.borderColor=TM;
  const onBI=(e:React.FocusEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>e.currentTarget.style.borderColor=T.border;

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg}}>
      {/* Header */}
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,padding:"0 24px",display:"flex",alignItems:"center",height:52,gap:12}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:5,fontSize:13,color:T.t3,background:"none",border:"none",cursor:"pointer",padding:"4px 8px",borderRadius:6}}
          onMouseEnter={e=>e.currentTarget.style.color=TM} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
          <ChevronLeft size={14}/>返回测试计划
        </button>
        <div style={{width:1,height:14,background:T.border}}/>
        <span style={{fontSize:15,fontWeight:700,color:T.t1}}>新建测试计划</span>
        <div style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"center",gap:0}}>
          {STEPS.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:20,background:i===step?`${TM}12`:i<step?"#F0FFF8":"transparent"}}>
                <div style={{width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,background:i<=step?TM:"#E5E6EB",color:i<=step?"#fff":T.t3,flexShrink:0}}>
                  {i<step?<Check size={11}/>:i+1}
                </div>
                <span style={{fontSize:12,fontWeight:i===step?600:400,color:i===step?TM:i<step?TM:T.t3}}>{s}</span>
              </div>
              {i<STEPS.length-1&&<div style={{width:24,height:1,background:i<step?TM:T.border}}/>}
            </div>
          ))}
        </div>
        <div style={{flex:1}}/>
        <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:T.t4,lineHeight:0}}><X size={16}/></button>
      </div>

      {/* Body */}
      <div style={{flex:1,overflowY:"auto",padding:"28px 0",minHeight:0}}>
        <div style={{maxWidth:800,margin:"0 auto",padding:"0 24px",display:"flex",flexDirection:"column",gap:20}}>

          {step===0&&(
            <>
              {/* Purpose */}
              <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px"}}>
                <div style={{fontSize:13,fontWeight:600,color:T.t2,marginBottom:14}}>计划用途 *</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {([["version","版本测试","关联版本，参与版本进度和质量准出","#0D7A5F"],
                     ["temp","临时测试","不强制关联版本，专项或探索性测试","#7816FF"]] as const).map(([val,title,desc,color])=>(
                    <button key={val} onClick={()=>setPurpose(val)}
                      style={{padding:"16px",borderRadius:10,border:`2px solid ${purpose===val?color:T.border}`,background:purpose===val?`${color}08`:"#FAFBFE",cursor:"pointer",textAlign:"left",transition:"all 0.12s"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${purpose===val?color:T.t4}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {purpose===val&&<div style={{width:8,height:8,borderRadius:"50%",background:color}}/>}
                        </div>
                        <span style={{fontSize:14,fontWeight:600,color:purpose===val?color:T.t1}}>{title}</span>
                      </div>
                      <p style={{fontSize:12,color:T.t3,marginLeft:26}}>{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              {/* Basic fields */}
              <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px",display:"flex",flexDirection:"column",gap:16}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <div><SLabel label="计划名称" req/>
                    <input value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="例：v2.4.0 全量回归测试" style={fi} onFocus={onFI} onBlur={onBI}/>
                  </div>
                  <div><SLabel label="计划编号"/>
                    <div style={{...fi,display:"flex",alignItems:"center",color:T.t4,background:"#FAFBFE"}}>自动生成（TP-00{MOCK_PLANS.length+1}）</div>
                  </div>
                  <div><SLabel label={purpose==="version"?"关联版本":"关联版本"} req={purpose==="version"}/>
                    <select value={versionId} onChange={e=>setVersionId(e.target.value)} style={fs} onFocus={onFI} onBlur={onBI}>
                      <option value="">请选择版本</option>
                      {MOCK_VERSIONS.filter(v=>v.status!=="archived").map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                    {purpose==="temp"&&<div style={{fontSize:11,color:T.t4,marginTop:4}}>临时测试可后续绑定版本</div>}
                  </div>
                  <div><SLabel label="测试类型" req/>
                    <select value={planType} onChange={e=>setPlanType(e.target.value as PlanType)} style={fs} onFocus={onFI} onBlur={onBI}>
                      {(Object.entries(PLAN_TYPE_CFG) as [PlanType,{label:string}][]).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div><SLabel label="负责人" req/>
                    <select value={owner} onChange={e=>setOwner(e.target.value)} style={fs} onFocus={onFI} onBlur={onBI}>
                      <option value="">请选择负责人</option>
                      {["李明","王芳","陈伟","张程远"].map(p=><option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div><SLabel label="参与成员"/>
                    <select style={fs}><option>请选择（可多选）</option>{["李明","王芳","陈伟","张程远"].map(p=><option key={p}>{p}</option>)}</select>
                  </div>
                  <div><SLabel label="开始日期" req/>
                    <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={fi} onFocus={onFI} onBlur={onBI}/>
                  </div>
                  <div><SLabel label="结束日期" req/>
                    <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} style={fi} onFocus={onFI} onBlur={onBI}/>
                  </div>
                </div>
                <div><SLabel label="测试目标"/>
                  <textarea value={goal} onChange={e=>setGoal(e.target.value)} placeholder="描述本次测试的目标和验收标准…" rows={3}
                    style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:13,color:T.t1,outline:"none",resize:"none",boxSizing:"border-box"}}
                    onFocus={onFI} onBlur={onBI}/>
                </div>
              </div>
            </>
          )}

          {step===1&&(()=>{
            // Version plan: req-driven selection
            if(purpose==="version"&&versionId){
              const vReqs=MOCK_REQS.filter(r=>r.versionId===versionId);
              // Auto cases from selected reqs (approved cases only)
              const autoCaseNos=new Set<string>();
              selectedReqIds.forEach(rid=>{
                const rq=vReqs.find(r=>r.id===rid);
                (rq?.linkedCases||[]).filter(c=>c.reviewStatus==="passed").forEach(c=>autoCaseNos.add(c.no));
              });
              const autoCases=CASE_LIB.filter(c=>autoCaseNos.has(c.no)&&!excludedCaseNos.includes(c.no));
              const manualCases=CASE_LIB.filter(c=>manualCaseIds.includes(c.id));
              const totalCount=autoCases.length+manualCases.length;

              return(
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {showManualPicker&&(
                    <CasePickerModal
                      selected={manualCaseIds} versionId={versionId}
                      onClose={()=>setShowManualPicker(false)}
                      onConfirm={ids=>{setManualCaseIds(ids);setShowManualPicker(false);}}/>
                  )}
                  {/* Step 1: Select requirements */}
                  <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:T.t1}}>第一步：选择测试需求</div>
                        <div style={{fontSize:12,color:T.t3,marginTop:2}}>系统将自动带入所选需求下已通过评审的测试用例</div>
                      </div>
                      {vReqs.length>0&&(
                        <button onClick={()=>setSelectedReqIds(selectedReqIds.length===vReqs.length?[]:vReqs.map(r=>r.id))}
                          style={{fontSize:12,color:TM,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>
                          {selectedReqIds.length===vReqs.length?"取消全选":"全选"}
                        </button>
                      )}
                    </div>
                    {vReqs.length===0?(
                      <div style={{padding:"32px",textAlign:"center",color:T.t4,fontSize:13,border:`1.5px dashed ${T.border}`,borderRadius:10}}>该版本暂无需求，请先在需求管理中添加</div>
                    ):(
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {vReqs.map(r=>{
                          const rc=REQ_REVIEW_CFG[r.reviewStatus];
                          const pc2=PRIORITY_CFG[r.priority];
                          const passedCases=(r.linkedCases||[]).filter(c=>c.reviewStatus==="passed");
                          const isChk=selectedReqIds.includes(r.id);
                          return(
                            <div key={r.id} onClick={()=>setSelectedReqIds(p=>isChk?p.filter(x=>x!==r.id):[...p,r.id])}
                              style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,border:`1.5px solid ${isChk?TM:T.border}`,background:isChk?`${TM}06`:"#FAFBFE",cursor:"pointer",transition:"all 0.12s"}}>
                              <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${isChk?TM:T.t4}`,background:isChk?TM:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                {isChk&&<Check size={11} style={{color:"#fff"}}/>}
                              </div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                                  <code style={{fontSize:11,color:T.t3,fontFamily:"monospace"}}>{r.id}</code>
                                  <span style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:rc.bg,color:rc.color,fontWeight:600}}>{rc.label}</span>
                                  <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:3,background:pc2.bg,color:pc2.color}}>{r.priority}</span>
                                </div>
                                <div style={{fontSize:13,fontWeight:500,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</div>
                              </div>
                              <div style={{flexShrink:0,textAlign:"right"}}>
                                {r.reviewStatus==="passed"||passedCases.length>0?(
                                  <div style={{fontSize:11,color:T.success,fontWeight:600}}>{passedCases.length} 个已通过用例</div>
                                ):(
                                  <div style={{fontSize:11,color:T.t4}}>无已通过用例</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Step 2: Auto-brought cases */}
                  {selectedReqIds.length>0&&(
                    <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                        <div>
                          <div style={{fontSize:14,fontWeight:600,color:T.t1}}>第二步：确认已带入用例</div>
                          <div style={{fontSize:12,color:T.t3,marginTop:2}}>系统已自动带入已通过评审的用例，可排除不需要的用例</div>
                        </div>
                        <div style={{padding:"4px 12px",borderRadius:20,background:`${TM}10`,fontSize:12,color:TM,fontWeight:700}}>
                          {autoCaseNos.size} 个需求带入，已排除 {autoCaseNos.size-autoCases.length} 个
                        </div>
                      </div>
                      {autoCaseNos.size===0?(
                        <div style={{padding:"24px",textAlign:"center",color:T.t4,fontSize:13,border:`1.5px dashed ${T.border}`,borderRadius:10}}>
                          所选需求暂无已通过评审的用例
                        </div>
                      ):(
                        <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
                          <table style={{width:"100%",borderCollapse:"collapse"}}>
                            <thead>
                              <tr style={{background:"#F7F8FA",borderBottom:`1px solid ${T.border}`}}>
                                {["编号","用例名称","所属模块","优先级","来源",""].map((h,i)=>(
                                  <th key={i} style={{padding:"7px 12px",textAlign:"left",fontSize:11,fontWeight:600,color:T.t3}}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from(autoCaseNos).map(no=>{
                                const cl=CASE_LIB.find(c=>c.no===no);
                                if(!cl)return null;
                                const isExcluded=excludedCaseNos.includes(no);
                                const pc2=cl.priority==="P0"?T.danger:cl.priority==="P1"?T.warning:T.primary;
                                return(
                                  <tr key={no} style={{borderBottom:`1px solid ${T.border}`,opacity:isExcluded?0.4:1,background:isExcluded?"#FFF8F8":"#fff"}}>
                                    <td style={{padding:"8px 12px"}}><code style={{fontSize:11,color:T.t3,fontFamily:"monospace"}}>{cl.no}</code></td>
                                    <td style={{padding:"8px 12px",fontSize:13,color:T.t1,maxWidth:180}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{cl.title}</span></td>
                                    <td style={{padding:"8px 12px",fontSize:11,color:T.t3}}>{cl.module}</td>
                                    <td style={{padding:"8px 12px"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:`${pc2}15`,color:pc2}}>{cl.priority}</span></td>
                                    <td style={{padding:"8px 12px"}}><span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:`${TM}10`,color:TM,fontWeight:600}}>需求带入</span></td>
                                    <td style={{padding:"8px 12px"}}>
                                      <button onClick={()=>setExcludedCaseNos(p=>isExcluded?p.filter(x=>x!==no):[...p,no])}
                                        style={{fontSize:11,padding:"3px 8px",borderRadius:6,border:`1px solid ${isExcluded?T.success:T.danger}`,background:"transparent",color:isExcluded?T.success:T.danger,cursor:"pointer",fontWeight:500}}>
                                        {isExcluded?"恢复":"排除"}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3: Supplement from library */}
                  <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:T.t1}}>第三步：手动补充用例（可选）</div>
                        <div style={{fontSize:12,color:T.t3,marginTop:2}}>从用例库中额外添加需求未覆盖的用例，标记为「手动补充」</div>
                      </div>
                      <PBtn small variant="ghost" icon={Plus} onClick={()=>setShowManualPicker(true)}>从用例库添加</PBtn>
                    </div>
                    {manualCases.length===0?(
                      <div style={{padding:"20px",textAlign:"center",color:T.t4,fontSize:12,border:`1.5px dashed ${T.border}`,borderRadius:10}}>暂无手动补充的用例</div>
                    ):(
                      <div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {manualCases.map(c=>{
                          const pc2=c.priority==="P0"?T.danger:c.priority==="P1"?T.warning:T.primary;
                          return(
                            <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:"#FAFBFE"}}>
                              <code style={{fontSize:11,color:T.t3,fontFamily:"monospace"}}>{c.no}</code>
                              <span style={{flex:1,fontSize:13,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</span>
                              <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:`${pc2}15`,color:pc2}}>{c.priority}</span>
                              <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"#FFF3E8",color:"#FF7D00",fontWeight:600}}>手动补充</span>
                              <IBtn icon={X} label="移除" onClick={()=>setManualCaseIds(p=>p.filter(id=>id!==c.id))}/>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  {(totalCount>0||selectedReqIds.length>0)&&(
                    <div style={{background:`${TM}08`,borderRadius:10,border:`1px solid ${TM}30`,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                      <CheckCircle size={16} style={{color:TM,flexShrink:0}}/>
                      <div style={{fontSize:13,color:T.t1}}>
                        已选 <strong style={{color:TM}}>{selectedReqIds.length}</strong> 个需求，
                        本次计划共纳入 <strong style={{color:TM}}>{totalCount}</strong> 个用例
                        （{autoCases.length} 个需求带入，{manualCases.length} 个手动补充）
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // Temp plan: direct case picker
            return(
              <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:T.t1}}>测试用例范围</div>
                    <div style={{fontSize:12,color:T.t3,marginTop:2}}>从用例库中选择需要纳入本次计划的功能测试用例</div>
                  </div>
                  <PBtn color={TM} icon={Plus} onClick={()=>setShowPicker(true)}>
                    {selectedCases.length>0?"管理用例":"选择用例"}
                  </PBtn>
                </div>
                {selectedCases.length===0?(
                  <div style={{padding:"48px",textAlign:"center",border:`1.5px dashed ${T.border}`,borderRadius:10,background:"#FAFBFE"}}>
                    <FileText size={36} style={{color:T.t4,margin:"0 auto 10px"}}/>
                    <div style={{fontSize:13,color:T.t3}}>尚未选择任何测试用例</div>
                    <div style={{fontSize:12,color:T.t4,marginTop:4}}>点击右上角「选择用例」从用例库中添加</div>
                  </div>
                ):(
                  <>
                    <div style={{display:"flex",gap:8,marginBottom:12}}>
                      <div style={{padding:"6px 14px",borderRadius:8,background:`${TM}10`,border:`1px solid ${TM}30`,fontSize:12,color:TM,fontWeight:600}}>已选用例：{selectedCases.length} 个</div>
                    </div>
                    <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
                      <table style={{width:"100%",borderCollapse:"collapse"}}>
                        <thead>
                          <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                            {["编号","用例名称","所属模块","优先级",""].map((h,i)=>(
                              <th key={i} style={{padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.t3}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {CASE_LIB.filter(c=>selectedCases.includes(c.id)).map((c,i,arr)=>{
                            const pc2=c.priority==="P0"?T.danger:c.priority==="P1"?T.warning:T.primary;
                            return(
                              <tr key={c.id} style={{borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none"}}>
                                <td style={{padding:"8px 12px"}}><code style={{fontSize:11,color:T.t3,fontFamily:"monospace"}}>{c.no}</code></td>
                                <td style={{padding:"8px 12px"}}><span style={{fontSize:13,color:T.t1}}>{c.title}</span></td>
                                <td style={{padding:"8px 12px"}}><span style={{fontSize:11,color:T.t3}}>{c.module}</span></td>
                                <td style={{padding:"8px 12px"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:`${pc2}15`,color:pc2}}>{c.priority}</span></td>
                                <td style={{padding:"8px 12px"}}><IBtn icon={X} label="移除" onClick={()=>setSelectedCases(p=>p.filter(id=>id!==c.id))}/></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {step===2&&(
            <>
              <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px",display:"flex",flexDirection:"column",gap:14}}>
                <div style={{fontSize:13,fontWeight:600,color:T.t2}}>执行完成率与通过率</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <div><SLabel label="最低用例执行率（%）"/>
                    <input type="number" value={minExecRate} onChange={e=>setMinExecRate(e.target.value)} min={0} max={100} style={fi} onFocus={onFI} onBlur={onBI}/>
                  </div>
                  <div><SLabel label="最低用例通过率（%）"/>
                    <input type="number" value={minPassRate} onChange={e=>setMinPassRate(e.target.value)} min={0} max={100} style={fi} onFocus={onFI} onBlur={onBI}/>
                  </div>
                </div>
              </div>
              <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px",display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontSize:13,fontWeight:600,color:T.t2}}>缺陷限制</div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderRadius:8,border:`1px solid ${T.border}`,background:"#FAFBFE"}}>
                  <div>
                    <div style={{fontSize:13,color:T.t1}}>允许存在 P0 缺陷</div>
                    {!allowP0&&<div style={{fontSize:11,color:T.danger,marginTop:2}}>推荐：否</div>}
                  </div>
                  <button onClick={()=>setAllowP0(v=>!v)} style={{width:36,height:20,borderRadius:10,background:allowP0?T.danger:"#C9CDD4",border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                    <span style={{position:"absolute",top:2,left:allowP0?"calc(100% - 18px)":"2px",width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                  </button>
                </div>
                <div><SLabel label="允许存在的最大 P1 缺陷数"/>
                  <input type="number" value={maxP1} onChange={e=>setMaxP1(e.target.value)} min={0} style={fi} onFocus={onFI} onBlur={onBI}/>
                </div>
              </div>
              <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px",display:"flex",flexDirection:"column",gap:12}}>
                <div style={{fontSize:13,fontWeight:600,color:T.t2}}>完成设置</div>
                {[{label:"完成后自动生成汇总报告",val:autoReport,set:setAutoReport},{label:"完成前需负责人确认",val:needConfirm,set:setNeedConfirm}].map(({label,val,set})=>(
                  <div key={label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderRadius:8,border:`1px solid ${T.border}`,background:"#FAFBFE"}}>
                    <span style={{fontSize:13,color:T.t1}}>{label}</span>
                    <button onClick={()=>set(v=>!v)} style={{width:36,height:20,borderRadius:10,background:val?TM:"#C9CDD4",border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                      <span style={{position:"absolute",top:2,left:val?"calc(100% - 18px)":"2px",width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{flexShrink:0,background:"#fff",borderTop:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",alignItems:"center",gap:8}}>
        {step>0&&<PBtn variant="ghost" icon={ChevronLeft} onClick={()=>setStep(s=>s-1)}>上一步</PBtn>}
        <div style={{flex:1}}/>
        <PBtn variant="ghost" icon={Save} onClick={onBack}>保存草稿</PBtn>
        {step<STEPS.length-1
          ?<PBtn color={TM} onClick={()=>setStep(s=>s+1)}>下一步<ChevronRight size={13}/></PBtn>
          :<PBtn color={TM} icon={Check} onClick={onBack}>保存并开始</PBtn>}
      </div>

      {showPicker&&<CasePickerModal selected={selectedCases} versionId={versionId||undefined} onClose={()=>setShowPicker(false)} onConfirm={ids=>{setSelectedCases(ids);setShowPicker(false);}}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST PLAN LIST
// ═══════════════════════════════════════════════════════════════════════════════
function TestPlanList({onView,onNew,onExec}:{onView:(p:TestPlan)=>void;onNew:()=>void;onExec?:(p:TestPlan)=>void}){
  const [purposeTab,setPurposeTab]=useState<"all"|"version"|"temp">("all");
  const [search,setSearch]=useState("");
  const [planAction,setPlanAction]=useState<{action:PlanActionType;plan:TestPlan}|null>(null);
  const [copyTarget,setCopyTarget]=useState<TestPlan|null>(null);
  const plans=MOCK_PLANS.filter(p=>{
    if(purposeTab==="version"&&p.purpose!=="version")return false;
    if(purposeTab==="temp"&&p.purpose!=="temp")return false;
    if(search&&!p.name.includes(search)&&!p.no.includes(search))return false;
    return true;
  });
  const stats={
    pending:MOCK_PLANS.filter(p=>p.status==="pending").length,
    running:MOCK_PLANS.filter(p=>p.status==="running").length,
    blocked:MOCK_PLANS.filter(p=>p.status==="blocked").length,
    avgPass:Math.round(MOCK_PLANS.filter(p=>p.executed>0).reduce((s,p)=>s+(p.passed/p.executed)*100,0)/Math.max(1,MOCK_PLANS.filter(p=>p.executed>0).length)),
  };
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,height:52,display:"flex",alignItems:"center",paddingLeft:8,flexShrink:0}}>
        <MiniStat value={stats.pending} label="待开始" color={T.primary}/>
        <div style={{width:1,height:32,background:T.border,margin:"0 4px"}}/>
        <MiniStat value={stats.running} label="进行中" color={T.warning}/>
        <div style={{width:1,height:32,background:T.border,margin:"0 4px"}}/>
        <MiniStat value={stats.blocked} label="已阻塞" color={T.danger}/>
        <div style={{width:1,height:32,background:T.border,margin:"0 4px"}}/>
        <MiniStat value={`${stats.avgPass}%`} label="本期平均通过率" color={TM}/>
        <div style={{flex:1}}/>
        <div style={{paddingRight:20}}><PBtn color={TM} icon={Plus} onClick={onNew}>新建测试计划</PBtn></div>
      </div>
      <div style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`,padding:"10px 20px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        <div style={{display:"flex",gap:0,background:"#F2F3F5",borderRadius:8,padding:2}}>
          {([["all","全部"],["version","版本计划"],["temp","临时计划"]] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setPurposeTab(k)}
              style={{padding:"4px 12px",borderRadius:6,fontSize:12,fontWeight:purposeTab===k?600:400,cursor:"pointer",border:"none",background:purposeTab===k?"#fff":"transparent",color:purposeTab===k?TM:T.t3,boxShadow:purposeTab===k?"0 1px 3px rgba(0,0,0,0.08)":"none",transition:"all 0.15s"}}>
              {l}
            </button>
          ))}
        </div>
        <div style={{position:"relative",width:220}}>
          <Search size={13} style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:T.t4,pointerEvents:"none"}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索计划名称或编号"
            style={{width:"100%",height:32,paddingLeft:28,paddingRight:10,border:`1px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none",background:"#fff",boxSizing:"border-box"}}
            onFocus={e=>e.currentTarget.style.borderColor=TM} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <select className="h-8 px-2.5 border rounded-lg text-[12px] outline-none bg-white" style={{borderColor:T.border,color:T.t1,width:100}}>
          <option>全部版本</option>{MOCK_VERSIONS.map(v=><option key={v.id}>{v.name}</option>)}
        </select>
        <select className="h-8 px-2.5 border rounded-lg text-[12px] outline-none bg-white" style={{borderColor:T.border,color:T.t1,width:90}}>
          <option>全部状态</option>{Object.entries(PLAN_STATUS_CFG).map(([k,v])=><option key={k}>{v.label}</option>)}
        </select>
        <select className="h-8 px-2.5 border rounded-lg text-[12px] outline-none bg-white" style={{borderColor:T.border,color:T.t1,width:100}}>
          <option>全部负责人</option>{["李明","王芳","陈伟","张程远"].map(p=><option key={p}>{p}</option>)}
        </select>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",minHeight:0}}>
        <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                {["计划名称","编号","关联版本","类型","负责人","计划周期","用例数","执行进度","通过率","P0/P1","状态","更新","操作"].map(h=>(
                  <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.t3,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plans.map((p,idx)=>{
                const sc=PLAN_STATUS_CFG[p.status];const tc=PLAN_TYPE_CFG[p.type];
                const passRate=p.executed>0?Math.round((p.passed/p.executed)*100):0;
                const execRate=p.scope>0?Math.round((p.executed/p.scope)*100):0;
                return(
                  <tr key={p.id} onClick={()=>onView(p)}
                    style={{borderBottom:idx<plans.length-1?`1px solid ${T.border}`:"none",cursor:"pointer"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#FAFBFF"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={{padding:"10px 12px",maxWidth:200}}>
                      <div style={{fontWeight:600,fontSize:13,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                      {p.purpose==="temp"&&<span style={{fontSize:10,color:T.t4}}>临时计划</span>}
                    </td>
                    <td style={{padding:"10px 12px"}}><code style={{fontSize:11,color:T.t3,fontFamily:"monospace"}}>{p.no}</code></td>
                    <td style={{padding:"10px 12px"}}>
                      {p.versionName?<span style={{fontSize:12,padding:"2px 8px",borderRadius:12,background:`${TM}12`,color:TM,fontWeight:500}}>{p.versionName}</span>:<span style={{fontSize:11,color:T.t4}}>—</span>}
                    </td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:11,color:tc.color,fontWeight:500}}>{tc.label}</span></td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:12,color:T.t2}}>{p.owner}</span></td>
                    <td style={{padding:"10px 12px"}}>
                      <div style={{fontSize:11,color:T.t3,whiteSpace:"nowrap"}}>{p.startDate}</div>
                      <div style={{fontSize:11,color:T.t3,whiteSpace:"nowrap"}}>→ {p.endDate}</div>
                    </td>
                    <td style={{padding:"10px 12px",textAlign:"center"}}><span style={{fontSize:13,fontWeight:600,color:T.t1}}>{p.scope}</span></td>
                    <td style={{padding:"10px 12px",minWidth:110}}>
                      <ProgressBar value={p.executed} total={p.scope} color={TM}/>
                      <div style={{fontSize:10,color:T.t3,marginTop:2}}>{p.executed}/{p.scope} · {execRate}%</div>
                    </td>
                    <td style={{padding:"10px 12px",textAlign:"center"}}>
                      <span style={{fontSize:13,fontWeight:700,color:passRate>=85?TM:passRate>=70?T.warning:T.danger}}>{p.executed>0?`${passRate}%`:"—"}</span>
                    </td>
                    <td style={{padding:"10px 12px",textAlign:"center"}}>
                      {(p.p0Bugs+p.p1Bugs)>0
                        ?<span style={{fontSize:12,fontWeight:700,color:p.p0Bugs>0?T.danger:T.warning}}>{p.p0Bugs>0?`P0·${p.p0Bugs} `:""}{p.p1Bugs>0?`P1·${p.p1Bugs}`:""}</span>
                        :<span style={{fontSize:12,color:T.t4}}>—</span>}
                    </td>
                    <td style={{padding:"10px 12px"}}><StatusBadge {...sc}/></td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:11,color:T.t3,whiteSpace:"nowrap"}}>{p.updatedAt.slice(0,10)}</span></td>
                     <td style={{padding:"10px 12px"}} onClick={e=>e.stopPropagation()}>
                       <div style={{display:"flex",alignItems:"center",gap:6}}>
                         {(p.status==="running"||p.status==="blocked")&&(<PBtn small color={TM} icon={Play} onClick={()=>onExec?.(p)}>执行</PBtn>)}
                         <ActionMenu status={p.status} onView={()=>onView(p)} onEdit={()=>{}}
                           onStart={()=>setPlanAction({action:"start",plan:p})}
                           onComplete={()=>setPlanAction({action:"complete",plan:p})}
                           onCopy={()=>setCopyTarget(p)}
                           onCancel={()=>setPlanAction({action:"cancel",plan:p})}
                           onDelete={()=>setPlanAction({action:"delete",plan:p})}/>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderTop:`1px solid ${T.border}`}}>
            <span style={{fontSize:12,color:T.t3}}>共 {plans.length} 条</span>
            <button style={{width:28,height:28,borderRadius:6,fontSize:12,fontWeight:600,border:`1px solid ${TM}`,background:TM,color:"#fff",cursor:"pointer"}}>1</button>
          </div>
        </div>
      </div>
      {planAction&&<PlanActionModal action={planAction.action} planName={planAction.plan.name} onClose={()=>setPlanAction(null)}/>}
      {copyTarget&&<CopyPlanModal planName={copyTarget.name} onClose={()=>setCopyTarget(null)}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST PLAN DETAIL
// ═══════════════════════════════════════════════════════════════════════════════
const QUALITY_CHECKS=[
  {label:"用例执行率",target:"≥ 90%",current:"77.5%",pass:false},
  {label:"用例通过率",target:"≥ 85%",current:"93.5%",pass:true},
  {label:"P0 缺陷",target:"0 个",current:"0 个",pass:true},
  {label:"P1 缺陷",target:"≤ 3 个",current:"2 个",pass:true},
  {label:"报告签署",target:"已签署",current:"未签署",pass:false},
];

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN CASE VIEW DRAWER
// ═══════════════════════════════════════════════════════════════════════════════
function PlanCaseViewDrawer({case_,onClose}:{case_:PlanCase;onClose:()=>void}){
  const detail=getSteps(case_.no);
  const ec=EXEC_STATUS_CFG_EX[case_.status];
  const pc=case_.priority==="P0"?T.danger:case_.priority==="P1"?T.warning:case_.priority==="P2"?T.primary:T.t3;
  const SL=({label}:{label:string})=>(
    <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
      <div style={{width:3,height:12,borderRadius:2,background:TM,flexShrink:0}}/>
      {label}
    </div>
  );
  return(
    <div style={{position:"fixed",top:0,right:0,bottom:0,width:480,background:"#fff",boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",zIndex:300,display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"flex-start",gap:10,flexShrink:0}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
            <code style={{fontSize:11,color:T.t3,fontFamily:"monospace",flexShrink:0}}>{case_.no}</code>
            <span style={{display:"inline-flex",alignItems:"center",gap:3,fontSize:11,padding:"1px 7px",borderRadius:10,background:ec.bg,color:ec.color,fontWeight:500,flexShrink:0}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:ec.dot,display:"inline-block"}}/>
              {ec.label}
            </span>
            <span style={{fontSize:11,fontWeight:700,padding:"1px 6px",borderRadius:4,background:`${pc}15`,color:pc,flexShrink:0}}>{case_.priority}</span>
            <span style={{fontSize:11,color:T.t3,flexShrink:0}}>{case_.module}</span>
          </div>
          <div style={{fontSize:15,fontWeight:600,color:T.t1,lineHeight:1.4}}>{case_.title}</div>
        </div>
        <button onClick={onClose} style={{flexShrink:0,width:28,height:28,border:"none",background:"transparent",cursor:"pointer",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:T.t3}}
          onMouseEnter={e=>{e.currentTarget.style.background=T.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
          <X size={15}/>
        </button>
      </div>
      {/* Exec info strip */}
      {case_.status!=="pending"&&(
        <div style={{padding:"10px 20px",borderBottom:`1px solid ${T.border}`,background:"#FAFAFA",display:"flex",gap:20,flexWrap:"wrap",flexShrink:0}}>
          <span style={{fontSize:12,color:T.t3}}>执行人：<b style={{color:T.t2,fontWeight:500}}>{case_.assignee}</b></span>
          <span style={{fontSize:12,color:T.t3}}>执行时间：<b style={{color:T.t2,fontWeight:500,fontFamily:"monospace"}}>{case_.execTime}</b></span>
          {case_.notes&&<span style={{fontSize:12,color:T.t3}}>备注：<b style={{color:T.t2,fontWeight:400}}>{case_.notes}</b></span>}
        </div>
      )}
      {/* Body */}
      <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:20}}>
        <div>
          <SL label="前置条件"/>
          <div style={{fontSize:13,color:T.t2,lineHeight:1.7,background:T.bg,borderRadius:8,padding:"10px 14px"}}>{detail.precondition}</div>
        </div>
        <div>
          <SL label="测试步骤"/>
          <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr",background:"#F7F8FA",borderBottom:`1px solid ${T.border}`}}>
              {["#","操作步骤","预期结果"].map(h=>(
                <div key={h} style={{padding:"8px 12px",fontSize:11,fontWeight:600,color:T.t3}}>{h}</div>
              ))}
            </div>
            {detail.steps.map((s,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr",borderBottom:i<detail.steps.length-1?`1px solid ${T.border}`:"none",background:i%2===0?"#fff":"#FAFBFE"}}>
                <div style={{padding:"10px 12px",fontSize:12,color:T.t4,fontWeight:600,borderRight:`1px solid ${T.border}`}}>{i+1}</div>
                <div style={{padding:"10px 12px",fontSize:13,color:T.t1,lineHeight:1.6,borderRight:`1px solid ${T.border}`}}>{s.action}</div>
                <div style={{padding:"10px 12px",fontSize:13,color:T.t2,lineHeight:1.6}}>{s.expected}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TestPlanDetail({plan,onBack,fromVersion,onExecCase}:{plan:TestPlan;onBack:()=>void;fromVersion?:Version;onExecCase?:(caseId:string)=>void}){
  const [tab,setTab]=useState<"overview"|"cases"|"bugs"|"report"|"log">("overview");
  const [cases,setCases]=useState<PlanCase[]>(INIT_PLAN_CASES);
  const [markTarget,setMarkTarget]=useState<PlanCase|null>(null);
  const [showPicker,setShowPicker]=useState(false);
  const [caseStatusF,setCaseStatusF]=useState<"all"|ExecStatus>("all");
  const [caseQ,setCaseQ]=useState("");
  const [caseAssignee,setCaseAssignee]=useState("all");
  const [bugsStatus,setBugsStatus]=useState<"all"|BugSta>("all");
  const [logTypeF,setLogTypeF]=useState("all");
  const [reportSigned,setReportSigned]=useState(false);
  const [planAction,setPlanAction]=useState<PlanActionType|null>(null);
  const [newBugCase,setNewBugCase]=useState<PlanCase|null>(null);
  const [showNewBug,setShowNewBug]=useState(false);
  const [showSignModal,setShowSignModal]=useState(false);
  const [showUnsignModal,setShowUnsignModal]=useState(false);
  const [viewCaseId,setViewCaseId]=useState<string|null>(null);
  const [unlinkTarget,setUnlinkTarget]=useState<PlanCase|null>(null);

  const passRate=plan.executed>0?Math.round((plan.passed/plan.executed)*100):0;
  const execRate=plan.scope>0?Math.round((plan.executed/plan.scope)*100):0;
  const daysLeft=Math.ceil((new Date(plan.endDate).getTime()-Date.now())/(1000*60*60*24));
  const planQualityChecks=[
    {label:"用例执行率", target:"≥ 90%",  current:`${execRate}%`,                      pass: execRate>=90},
    {label:"用例通过率", target:"≥ 85%",  current: plan.executed>0?`${passRate}%`:"—", pass: passRate>=85},
    {label:"P0 缺陷",   target:"0 个",    current:`${plan.p0Bugs} 个`,                 pass: plan.p0Bugs===0},
    {label:"P1 缺陷",   target:"≤ 3 个",  current:`${plan.p1Bugs} 个`,                 pass: plan.p1Bugs<=3},
    {label:"报告签署",  target:"已签署",  current: reportSigned?"已签署":"未签署",      pass: reportSigned},
  ];
  const qualityPassed=planQualityChecks.filter(q=>q.pass).length;
  const sc=PLAN_STATUS_CFG[plan.status];

  const TABS=[
    {key:"overview",label:"计划概览"},{key:"cases",label:`测试用例（${cases.length}）`},
    {key:"bugs",label:`缺陷（${plan.p0Bugs+plan.p1Bugs}）`},
    {key:"report",label:"测试报告"},{key:"log",label:"操作记录"},
  ];

  const filteredCases=cases.filter(c=>{
    if(caseStatusF!=="all"&&c.status!==caseStatusF)return false;
    if(caseAssignee!=="all"&&c.assignee!==caseAssignee)return false;
    if(caseQ&&!c.title.includes(caseQ)&&!c.no.includes(caseQ))return false;
    return true;
  });

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg}}>
      {/* Top bar */}
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,padding:"0 20px",display:"flex",alignItems:"center",gap:10,height:52}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:T.t3,background:"none",border:"none",cursor:"pointer"}}
          onMouseEnter={e=>e.currentTarget.style.color=TM} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
          <ChevronLeft size={14}/>{fromVersion?fromVersion.name:"测试计划"}
        </button>
        <ChevronRight size={12} style={{color:T.t4}}/>
        <span style={{fontSize:13,fontWeight:500,color:T.t1}}>{plan.name}</span>
        <StatusBadge {...sc}/>
        <div style={{flex:1}}/>
        <span style={{fontSize:11,color:T.t3}}>负责人：{plan.owner}</span>
        <span style={{fontSize:11,color:T.t3}}>周期：{plan.startDate} — {plan.endDate}</span>
        <IBtn icon={Edit2} label="编辑" onClick={()=>{}}/>
        {plan.status==="pending"&&<PBtn color={TM} icon={Play} small onClick={()=>setPlanAction("start")}>开始测试</PBtn>}
        {plan.status==="running"&&<PBtn color={T.warning} icon={AlertTriangle} small onClick={()=>setPlanAction("block")}>标记阻塞</PBtn>}
        {plan.status==="blocked"&&<PBtn color={TM} icon={RefreshCw} small onClick={()=>setPlanAction("resume")}>恢复计划</PBtn>}
        {["running","blocked"].includes(plan.status)&&<PBtn color={T.success} icon={CheckCircle} small onClick={()=>setPlanAction("complete")}>完成计划</PBtn>}
      </div>
      {/* KPI strip */}
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",alignItems:"center",padding:"0 20px",height:72}}>
        {[
          {label:"测试用例",value:cases.length,unit:"项",color:T.t1},
          {label:"已执行",value:cases.filter(c=>c.status!=="pending").length,unit:"项",color:T.primary},
          {label:"用例通过率",value:plan.executed>0?`${passRate}%`:"—",unit:"",color:passRate>=85?TM:T.warning},
          {label:"执行进度",value:`${execRate}%`,unit:"",color:TM},
          {label:"P0/P1 缺陷",value:plan.p0Bugs+plan.p1Bugs,unit:"个",color:(plan.p0Bugs+plan.p1Bugs)>0?T.danger:T.t3},
          {label:"剩余时间",value:daysLeft>0?daysLeft:"已逾期",unit:daysLeft>0?"天":"",color:daysLeft<=0?T.danger:daysLeft<=3?T.warning:T.t1},
        ].map((s,i)=>(
          <React.Fragment key={s.label}>
            {i>0&&<div style={{width:1,height:36,background:T.border,margin:"0 20px"}}/>}
            <div>
              <div style={{fontSize:22,fontWeight:700,color:s.color,lineHeight:1}}>{s.value}<span style={{fontSize:12,fontWeight:400,marginLeft:2,color:T.t3}}>{s.unit}</span></div>
              <div style={{fontSize:11,color:T.t3,marginTop:4}}>{s.label}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
      {/* Tabs */}
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",padding:"0 20px"}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key as any)}
            style={{height:40,padding:"0 16px",fontSize:13,fontWeight:tab===t.key?600:400,border:"none",borderBottom:`2px solid ${tab===t.key?TM:"transparent"}`,background:"transparent",color:tab===t.key?TM:T.t3,cursor:"pointer",transition:"all 0.15s"}}>
            {t.label}
          </button>
        ))}
      </div>
      {/* Tab content */}
      <div style={{flex:1,overflowY:"auto",padding:"20px",minHeight:0}}>
        {tab==="overview"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,maxWidth:1200}}>
            {/* Progress ring */}
            <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px"}}>
              <div style={{fontSize:14,fontWeight:600,color:T.t1,marginBottom:16}}>整体执行进度</div>
              <div style={{display:"flex",alignItems:"center",gap:24}}>
                <div style={{position:"relative",width:100,height:100,flexShrink:0}}>
                  <svg viewBox="0 0 36 36" style={{width:"100%",height:"100%",transform:"rotate(-90deg)"}}>
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F2F3F5" strokeWidth="3"/>
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke={TM} strokeWidth="3"
                      strokeDasharray={`${execRate} ${100-execRate}`} strokeLinecap="round"/>
                  </svg>
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:18,fontWeight:700,color:TM}}>{execRate}%</span>
                    <span style={{fontSize:10,color:T.t3}}>执行率</span>
                  </div>
                </div>
                <div style={{flex:1}}>
                  {[
                    {label:"已通过",value:plan.passed,color:T.success},
                    {label:"失败",value:plan.failed,color:T.danger},
                    {label:"阻塞",value:plan.blockedCases,color:T.warning},
                    {label:"未执行",value:plan.scope-plan.executed,color:T.t4},
                  ].map(s=>(
                    <div key={s.label} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                      <span style={{fontSize:12,color:T.t2,flex:1}}>{s.label}</span>
                      <span style={{fontSize:13,fontWeight:600,color:s.color}}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Trend */}
            <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px"}}>
              <div style={{fontSize:14,fontWeight:600,color:T.t1,marginBottom:16}}>每日执行趋势</div>
              <AreaChart width={360} height={180} data={EXEC_TREND} margin={{top:5,right:5,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F5" vertical={false}/>
                <XAxis dataKey="date" tick={{fontSize:10,fill:T.t3}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:10,fill:T.t3}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{borderRadius:8,border:`1px solid ${T.border}`,fontSize:12}}/>
                <Area type="monotone" dataKey="通过" stroke={TM} strokeWidth={2} fill={`${TM}20`} dot={false}/>
                <Area type="monotone" dataKey="失败" stroke={T.danger} strokeWidth={2} fill={`${T.danger}18`} dot={false}/>
              </AreaChart>
            </div>
            {/* Quality gate */}
            <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px",gridColumn:"1/-1"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <div style={{fontSize:14,fontWeight:600,color:T.t1}}>质量标准完成情况</div>
                <span style={{fontSize:12,padding:"3px 10px",borderRadius:12,background:qualityPassed===planQualityChecks.length?`${T.success}15`:`${T.warning}15`,color:qualityPassed===planQualityChecks.length?T.success:T.warning,fontWeight:600}}>
                  {qualityPassed===planQualityChecks.length?"全部达标":`${qualityPassed}/${planQualityChecks.length} 达标`}
                </span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
                {planQualityChecks.map(q=>(
                  <div key={q.label} style={{padding:"14px",borderRadius:10,border:`1px solid ${q.pass?`${T.success}30`:`${T.danger}30`}`,background:q.pass?`${T.success}06`:`${T.danger}06`}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                      {q.pass?<CheckCircle size={14} style={{color:T.success}}/>:<XCircle size={14} style={{color:T.danger}}/>}
                      <span style={{fontSize:12,fontWeight:500,color:T.t1}}>{q.label}</span>
                    </div>
                    <div style={{fontSize:11,color:T.t3}}>目标：{q.target}</div>
                    <div style={{fontSize:13,fontWeight:700,color:q.pass?T.success:T.danger,marginTop:4}}>{q.current}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab==="cases"&&(
          <div>
            {/* Toolbar */}
            <div style={{background:"#fff",borderRadius:10,border:`1px solid ${T.border}`,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              {(["all","pending","passed","failed","blocked"] as ("all"|ExecStatus)[]).map(s=>{
                const cnt=s==="all"?cases.length:cases.filter(c=>c.status===s).length;
                const c=s==="all"?TM:EXEC_STATUS_CFG[s].color;
                return(
                  <button key={s} onClick={()=>setCaseStatusF(s)}
                    style={{padding:"4px 12px",borderRadius:16,fontSize:12,cursor:"pointer",border:`1px solid ${caseStatusF===s?c:T.border}`,background:caseStatusF===s?`${c}12`:"transparent",color:caseStatusF===s?c:T.t3,fontWeight:caseStatusF===s?600:400}}>
                    {s==="all"?"全部":EXEC_STATUS_CFG[s].label}&nbsp;{cnt}
                  </button>
                );
              })}
              <div style={{flex:1}}/>
              <select value={caseAssignee} onChange={e=>setCaseAssignee(e.target.value)}
                style={{height:30,padding:"0 8px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t2,outline:"none",background:"#fff"}}>
                <option value="all">全部执行人</option>
                {["李明","王芳","陈伟","—"].map(p=><option key={p} value={p}>{p}</option>)}
              </select>
              <div style={{position:"relative"}}>
                <Search size={12} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:T.t4,pointerEvents:"none"}}/>
                <input value={caseQ} onChange={e=>setCaseQ(e.target.value)} placeholder="搜索用例…"
                  style={{height:30,paddingLeft:26,paddingRight:10,border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t1,outline:"none",width:150}}
                  onFocus={e=>e.currentTarget.style.borderColor=TM} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
              </div>
              <PBtn color={TM} icon={Plus} small onClick={()=>setShowPicker(true)}>添加用例</PBtn>
            </div>
            {/* Stats row */}
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              {([["全部",cases.length,T.t1],["通过",cases.filter(c=>c.status==="passed").length,T.success],["失败",cases.filter(c=>c.status==="failed").length,T.danger],["阻塞",cases.filter(c=>c.status==="blocked").length,T.warning],["未执行",cases.filter(c=>c.status==="pending").length,T.t3]] as [string,number,string][]).map(([l,v,c])=>(
                <div key={l} style={{flex:1,background:"#fff",borderRadius:8,padding:"10px 14px",border:`1px solid ${T.border}`,textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                  <div style={{fontSize:11,color:T.t3,marginTop:4}}>{l}</div>
                </div>
              ))}
            </div>
            {/* Table */}
            <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                    {["编号","用例名称","模块","优先级","执行人","执行结果","执行时间","备注","操作"].map(h=>(
                      <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.t3,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.map((c,i)=>{
                    const ec=EXEC_STATUS_CFG[c.status];
                    const pc=c.priority==="P0"?T.danger:c.priority==="P1"?T.warning:c.priority==="P2"?T.primary:T.t3;
                    return(
                      <tr key={c.id} style={{borderBottom:i<filteredCases.length-1?`1px solid ${T.border}`:"none"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#FAFBFF"}
                        onMouseLeave={e=>e.currentTarget.style.background=""}>
                        <td style={{padding:"9px 12px"}}><code style={{fontSize:11,color:T.t3,fontFamily:"monospace"}}>{c.no}</code></td>
                        <td style={{padding:"9px 12px",maxWidth:220}}><span style={{fontSize:13,color:T.t1}}>{c.title}</span></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:11,color:T.t3}}>{c.module}</span></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:`${pc}15`,color:pc}}>{c.priority}</span></td>
                        <td style={{padding:"9px 12px"}}>
                          <select value={c.assignee} onChange={e=>setCases(p=>p.map(x=>x.id===c.id?{...x,assignee:e.target.value}:x))}
                            style={{height:26,padding:"0 6px",border:`1px solid ${T.border}`,borderRadius:5,fontSize:11,color:T.t2,outline:"none",background:"#fff",cursor:"pointer"}}
                            onClick={e=>e.stopPropagation()}>
                            <option value="—">未分配</option>
                            {["李明","王芳","陈伟","张程远"].map(p=><option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td style={{padding:"9px 12px"}}>
                          <span style={{fontSize:11,padding:"2px 10px",borderRadius:12,background:ec.bg,color:ec.color,fontWeight:500,cursor:"pointer"}}
                            onClick={e=>{e.stopPropagation();setMarkTarget(c);}}>
                            {ec.label}
                          </span>
                        </td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:11,color:T.t3,whiteSpace:"nowrap"}}>{c.execTime}</span></td>
                        <td style={{padding:"9px 12px",maxWidth:160}}><span style={{fontSize:11,color:T.t3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{c.notes||"—"}</span></td>
                        <td style={{padding:"9px 12px"}} onClick={e=>e.stopPropagation()}>
                          <div style={{display:"flex",alignItems:"center",gap:2}}>
                            <IBtn icon={Eye} label="查看" onClick={()=>setViewCaseId(c.id)}/>
                            {(plan.status==="running"||plan.status==="blocked")&&(
                              <IBtn icon={Play} label="执行" onClick={()=>onExecCase?.(c.id)}/>
                            )}
                            <IBtn icon={Trash2} label="取消关联" danger onClick={()=>setUnlinkTarget(c)}/>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCases.length===0&&(
                    <tr><td colSpan={9} style={{padding:"48px",textAlign:"center",color:T.t4,fontSize:13}}>暂无符合条件的用例</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==="bugs"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",gap:6}}>
                {(["all","open","fixing","fixed","closed","rejected"] as ("all"|BugSta)[]).map(s=>{
                  const cnt=s==="all"?MOCK_BUGS.length:MOCK_BUGS.filter(b=>b.status===s).length;
                  const c=s==="all"?T.t2:BUG_STA_CFG[s].color;
                  return(
                    <button key={s} onClick={()=>setBugsStatus(s)}
                      style={{padding:"4px 12px",borderRadius:16,fontSize:12,cursor:"pointer",border:`1px solid ${bugsStatus===s?c:T.border}`,background:bugsStatus===s?`${c}15`:"transparent",color:bugsStatus===s?c:T.t3,fontWeight:bugsStatus===s?600:400}}>
                      {s==="all"?"全部":BUG_STA_CFG[s].label}&nbsp;{cnt}
                    </button>
                  );
                })}
              </div>
              <PBtn color={T.danger} icon={Plus} small onClick={()=>{setNewBugCase(null);setShowNewBug(true);}}>新建缺陷</PBtn>
            </div>
            <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                    {["缺陷编号","标题","严重程度","优先级","状态","负责人","关联用例","发现时间"].map(h=>(
                      <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.t3,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_BUGS.filter(b=>bugsStatus==="all"||b.status===bugsStatus).map((b,i,arr)=>{
                    const sev=BUG_SEV_CFG[b.severity];const sta=BUG_STA_CFG[b.status];
                    const pc=b.priority==="P0"?T.danger:b.priority==="P1"?T.warning:T.primary;
                    return(
                      <tr key={b.id} style={{borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#FAFBFF"}
                        onMouseLeave={e=>e.currentTarget.style.background=""}>
                        <td style={{padding:"9px 12px"}}><code style={{fontSize:11,fontFamily:"monospace",color:T.t3}}>{b.no}</code></td>
                        <td style={{padding:"9px 12px",maxWidth:280}}><span style={{fontSize:13,color:T.t1}}>{b.title}</span></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:12,border:`1.5px solid ${sev.color}30`,color:sev.color,background:`${sev.color}10`}}>{sev.label}</span></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:`${pc}15`,color:pc}}>{b.priority}</span></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:sta.bg,color:sta.color,fontWeight:500}}>{sta.label}</span></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:12,color:T.t2}}>{b.assignee}</span></td>
                        <td style={{padding:"9px 12px"}}><code style={{fontSize:11,color:TM,fontFamily:"monospace"}}>{b.linkedCase}</code></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:11,color:T.t3,whiteSpace:"nowrap"}}>{b.foundAt}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==="report"&&(
          <div style={{maxWidth:900}}>
            <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"24px"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
                <div>
                  <div style={{fontSize:18,fontWeight:700,color:T.t1,marginBottom:4}}>{plan.name}</div>
                  <div style={{fontSize:12,color:T.t3}}>报告生成时间：2026-07-07 16:30 &nbsp;|&nbsp; 负责人：{plan.owner}</div>
                </div>
                <PBtn variant="ghost" icon={Download} onClick={()=>{}}>导出 PDF</PBtn>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
                {([
                  {label:"测试用例",value:cases.length,unit:"项",color:T.t1},
                  {label:"已执行",value:cases.filter(c=>c.status!=="pending").length,unit:"项",color:T.primary},
                  {label:"用例通过率",value:plan.executed>0?`${passRate}%`:"—",unit:"",color:passRate>=85?TM:T.warning},
                  {label:"发现缺陷",value:MOCK_BUGS.length,unit:"个",color:T.danger},
                ]).map(s=>(
                  <div key={s.label} style={{padding:"16px",borderRadius:10,border:`1px solid ${T.border}`,background:"#FAFBFE",textAlign:"center"}}>
                    <div style={{fontSize:24,fontWeight:700,color:s.color,lineHeight:1}}>{s.value}<span style={{fontSize:12,color:T.t3,fontWeight:400,marginLeft:2}}>{s.unit}</span></div>
                    <div style={{fontSize:12,color:T.t3,marginTop:6}}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{borderRadius:10,border:`1.5px solid ${passRate>=85?`${T.success}50`:`${T.warning}50`}`,background:passRate>=85?`${T.success}06`:`${T.warning}08`,padding:"16px 20px",marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  {passRate>=85?<CheckCircle size={16} style={{color:T.success}}/>:<AlertTriangle size={16} style={{color:T.warning}}/>}
                  <span style={{fontSize:14,fontWeight:700,color:passRate>=85?T.success:T.warning}}>
                    {passRate>=85?"测试通过，可进入下一环节":"测试未完全通过，请关注遗留问题"}
                  </span>
                </div>
                <div style={{fontSize:12,color:T.t2,marginLeft:24}}>
                  用例通过率 {passRate}%（目标 ≥85%），P1 缺陷 {plan.p1Bugs} 个（目标 ≤3），P0 缺陷 {plan.p0Bugs} 个（目标 0）。
                  {plan.p1Bugs<=3&&plan.p0Bugs===0?"核心质量指标全部达标。":"请在发布前确认剩余缺陷处理情况。"}
                </div>
              </div>
              <div style={{borderTop:`1px solid ${T.border}`,paddingTop:16}}>
                <div style={{fontSize:13,fontWeight:600,color:T.t2,marginBottom:12}}>负责人签字确认</div>
                {!reportSigned?(
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{flex:1,padding:"12px 16px",borderRadius:8,border:`1.5px dashed ${T.border}`,background:"#FAFBFE",fontSize:12,color:T.t3}}>{plan.owner} 尚未确认本次测试报告</div>
                    <PBtn color={TM} icon={Check} onClick={()=>setShowSignModal(true)}>确认并签字</PBtn>
                  </div>
                ):(
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:8,border:`1.5px solid ${T.success}40`,background:`${T.success}06`}}>
                    <CheckCircle size={16} style={{color:T.success}}/>
                    <span style={{fontSize:13,color:T.success,fontWeight:600}}>{plan.owner} 已于 2026-07-07 16:30 确认签字</span>
                    <div style={{flex:1}}/>
                    <button onClick={()=>setShowUnsignModal(true)} style={{fontSize:11,color:T.t4,border:"none",background:"none",cursor:"pointer"}}>撤回</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab==="log"&&(
          <div style={{maxWidth:800}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <span style={{fontSize:13,fontWeight:600,color:T.t2}}>全部操作记录</span>
              <select value={logTypeF} onChange={e=>setLogTypeF(e.target.value)}
                style={{height:30,padding:"0 8px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t2,outline:"none",background:"#fff"}}>
                <option value="all">全部类型</option>
                {([["mark","执行标记"],["status","状态变更"],["edit","内容修改"],["comment","缺陷关联"],["create","创建"]] as const).map(([v,l])=>(
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <LogTimeline entries={MOCK_PLAN_LOG.filter(e=>logTypeF==="all"||e.type===logTypeF)}/>
          </div>
        )}
      </div>

      {markTarget&&(
        <MarkResultModal planCase={markTarget} onClose={()=>setMarkTarget(null)}
          onConfirm={(status,notes)=>{
            const now=new Date();
            const ts=`${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
            setCases(p=>p.map(c=>c.id===markTarget.id?{...c,status,notes,execTime:ts}:c));
            setMarkTarget(null);
          }}/>
      )}
      {showPicker&&(
        <CasePickerModal selected={cases.map(c=>c.no)} versionId={plan.versionId||undefined} onClose={()=>setShowPicker(false)}
          onConfirm={ids=>{
            const existing=new Set(cases.map(c=>c.no));
            const toAdd=CASE_LIB.filter(cl=>ids.includes(cl.id)&&!existing.has(cl.no));
            setCases(p=>[...p,...toAdd.map(cl=>({id:`pc-${cl.id}`,no:cl.no,title:cl.title,module:cl.module,priority:cl.priority as "P0"|"P1"|"P2"|"P3",status:"pending" as ExecStatus,assignee:"—",execTime:"—",notes:""}))]);
            setShowPicker(false);
          }}/>
      )}
      {planAction&&<PlanActionModal action={planAction} planName={plan.name} onClose={()=>setPlanAction(null)}/>}
      {(showNewBug||newBugCase)&&(
        <NewBugInPlanModal
          caseNo={newBugCase?.no}
          caseTitle={newBugCase?.title}
          onClose={()=>{setShowNewBug(false);setNewBugCase(null);}}/>
      )}
      {showSignModal&&<ReportSignModal owner={plan.owner} planName={plan.name} onClose={()=>setShowSignModal(false)} onSigned={()=>setReportSigned(true)}/>}
      {showUnsignModal&&<ReportUnsignModal owner={plan.owner} onClose={()=>setShowUnsignModal(false)} onUnsigned={()=>setReportSigned(false)}/>}
      {viewCaseId&&(()=>{const vc=cases.find(c=>c.id===viewCaseId);return vc?<PlanCaseViewDrawer case_={vc} onClose={()=>setViewCaseId(null)}/>:null;})()}
      {unlinkTarget&&(
        <UnlinkCaseModal caseIds={[unlinkTarget.id]} caseTitle={unlinkTarget.title}
          onClose={()=>setUnlinkTarget(null)}
          onDone={()=>{setCases(p=>p.filter(c=>c.id!==unlinkTarget.id));setUnlinkTarget(null);}}/>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW VERSION DRAWER
// ═══════════════════════════════════════════════════════════════════════════════
function NewVersionDrawer({onClose,editVersion}:{onClose:()=>void;editVersion?:Version}){
  const isEdit=!!editVersion;
  const [name,setName]=useState(editVersion?.name||"");
  const [type,setType]=useState<VersionType>(editVersion?.type||"iteration");
  const [status,setStatus]=useState<VersionStatus>(editVersion?.status||"planning");
  const [owner,setOwner]=useState(editVersion?.owner||"");
  const [startDate,setStartDate]=useState(editVersion?.startDate||"");
  const [testDate,setTestDate]=useState(editVersion?.testDate||"");
  const [releaseDate,setReleaseDate]=useState(editVersion?.releaseDate||"");
  const [goal,setGoal]=useState(editVersion?.goal||"");
  const fi={height:34,width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"0 12px",fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box" as const,background:"#fff"};
  const SL=({label,req}:{label:string;req?:boolean})=><label style={{display:"block",fontSize:12,fontWeight:600,color:T.t2,marginBottom:6}}>{label}{req&&<span style={{color:T.danger,marginLeft:2}}>*</span>}</label>;
  const onF=(e:React.FocusEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>e.currentTarget.style.borderColor=TM;
  const onB=(e:React.FocusEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>)=>e.currentTarget.style.borderColor=T.border;
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",justifyContent:"flex-end"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(29,33,41,0.4)"}}/>
      <div style={{position:"relative",background:"#fff",width:520,display:"flex",flexDirection:"column",boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",height:52,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:T.t1}}>{isEdit?"编辑版本":"新建版本"}</div>
            <div style={{fontSize:11,color:T.t3,marginTop:1}}>{isEdit?"修改版本基本信息":"在当前工作区创建一个新版本"}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0}}><X size={16}/></button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"20px",minHeight:0,display:"flex",flexDirection:"column",gap:14}}>
          <div><SL label="版本名称" req/><input value={name} onChange={e=>setName(e.target.value)} placeholder="例：v2.5.0" style={fi} onFocus={onF} onBlur={onB}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><SL label="版本类型" req/>
              <select value={type} onChange={e=>setType(e.target.value as VersionType)} style={fi} onFocus={onF} onBlur={onB}>
                {(Object.entries(VERSION_TYPE_CFG) as [VersionType,{label:string}][]).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><SL label="负责人" req/>
              <select value={owner} onChange={e=>setOwner(e.target.value)} style={fi} onFocus={onF} onBlur={onB}>
                <option value="">请选择负责人</option>
                {["李明","王芳","陈伟","张程远"].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          {isEdit&&(
            <div><SL label="当前状态"/>
              <select value={status} onChange={e=>setStatus(e.target.value as VersionStatus)} style={fi} onFocus={onF} onBlur={onB}>
                {(Object.entries(VERSION_STATUS_CFG) as [VersionStatus,{label:string}][]).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          )}
          <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14}}>
            <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:12}}>时间节点</div>
            {[{label:"开始日期",val:startDate,set:setStartDate},{label:"计划提测日期",val:testDate,set:setTestDate},{label:"计划发布日期",val:releaseDate,set:setReleaseDate}].map(({label,val,set})=>(
              <div key={label} style={{marginBottom:12}}><SL label={label}/>
                <input type="date" value={val} onChange={e=>set(e.target.value)} style={fi} onFocus={onF} onBlur={onB}/>
              </div>
            ))}
          </div>
          <div><SL label="版本目标"/>
            <textarea value={goal} onChange={e=>setGoal(e.target.value)} placeholder="描述本版本的核心目标和验收标准…" rows={4}
              style={{width:"100%",border:`1.5px solid ${T.border}`,borderRadius:8,padding:"10px 12px",fontSize:13,color:T.t1,outline:"none",resize:"none",boxSizing:"border-box"}}
              onFocus={onF} onBlur={onB}/>
          </div>
        </div>
        <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,padding:"12px 20px",display:"flex",justifyContent:"flex-end",gap:8}}>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn color={TM} disabled={!name.trim()||!owner} onClick={onClose}>{isEdit?"保存修改":"创建版本"}</PBtn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION LIST
// ═══════════════════════════════════════════════════════════════════════════════
function VersionList({onView}:{onView:(v:Version)=>void}){
  const [search,setSearch]=useState("");
  const [showNewDrawer,setShowNewDrawer]=useState(false);
  const [editVersion,setEditVersion]=useState<Version|null>(null);
  const versions=MOCK_VERSIONS.filter(v=>!search||(v.name.includes(search)||v.no.includes(search)));
  const stats={
    testing:MOCK_VERSIONS.filter(v=>v.status==="testing").length,
    pendingRelease:MOCK_VERSIONS.filter(v=>v.status==="pending-release").length,
    p0Blocked:MOCK_VERSIONS.filter(v=>v.p0Bugs>0).length,
    releasedCount:MOCK_VERSIONS.filter(v=>v.status==="released").length,
  };
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,height:52,display:"flex",alignItems:"center",paddingLeft:8,flexShrink:0}}>
        <MiniStat value={stats.testing} label="测试中" color={T.warning}/>
        <div style={{width:1,height:32,background:T.border,margin:"0 4px"}}/>
        <MiniStat value={stats.pendingRelease} label="待发布" color="#7816FF"/>
        <div style={{width:1,height:32,background:T.border,margin:"0 4px"}}/>
        <MiniStat value={stats.p0Blocked} label="P0 阻塞" color={stats.p0Blocked>0?T.danger:T.t3}/>
        <div style={{width:1,height:32,background:T.border,margin:"0 4px"}}/>
        <MiniStat value={stats.releasedCount} label="本月已发布" color={TM}/>
        <div style={{flex:1}}/>
        <div style={{paddingRight:20}}><PBtn color={TM} icon={Plus} onClick={()=>setShowNewDrawer(true)}>新建版本</PBtn></div>
      </div>
      <div style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`,padding:"10px 20px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        <div style={{position:"relative",width:240}}>
          <Search size={13} style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:T.t4,pointerEvents:"none"}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索版本名称或编号"
            style={{width:"100%",height:32,paddingLeft:28,paddingRight:10,border:`1px solid ${T.border}`,borderRadius:7,fontSize:12,color:T.t1,outline:"none",background:"#fff",boxSizing:"border-box"}}
            onFocus={e=>e.currentTarget.style.borderColor=TM} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <select className="h-8 px-2.5 border rounded-lg text-[12px] outline-none bg-white" style={{borderColor:T.border,color:T.t1,width:100}}>
          <option>全部类型</option>{Object.entries(VERSION_TYPE_CFG).map(([k,v])=><option key={k}>{v.label}</option>)}
        </select>
        <select className="h-8 px-2.5 border rounded-lg text-[12px] outline-none bg-white" style={{borderColor:T.border,color:T.t1,width:100}}>
          <option>全部状态</option>{Object.entries(VERSION_STATUS_CFG).map(([k,v])=><option key={k}>{v.label}</option>)}
        </select>
        <select className="h-8 px-2.5 border rounded-lg text-[12px] outline-none bg-white" style={{borderColor:T.border,color:T.t1,width:100}}>
          <option>全部负责人</option>{["李明","王芳","陈伟","张程远"].map(p=><option key={p}>{p}</option>)}
        </select>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",minHeight:0}}>
        <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                {["版本名称","编号","类型","负责人","状态","开始日期","提测日期","计划发布","计划数","测试进度","通过率","P0/P1","准出","操作"].map(h=>(
                  <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.t3,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {versions.map((v,idx)=>{
                const sc=VERSION_STATUS_CFG[v.status];const tc=VERSION_TYPE_CFG[v.type];
                const passRate=v.executed>0?Math.round((v.passed/v.executed)*100):0;
                const execRate=v.scope>0?Math.round((v.executed/v.scope)*100):0;
                const gateOk=v.p0Bugs===0&&v.p1Bugs<=3&&passRate>=85&&execRate>=90;
                const gateLabel=v.status==="released"?"已发布":v.scope===0?"—":gateOk?"可发布":"存在风险";
                const gateColor=v.status==="released"?TM:v.scope===0?T.t4:gateOk?T.success:T.danger;
                return(
                  <tr key={v.id} onClick={()=>onView(v)}
                    style={{borderBottom:idx<versions.length-1?`1px solid ${T.border}`:"none",cursor:"pointer"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#FAFBFF"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <td style={{padding:"10px 12px"}}>
                      <div style={{fontWeight:600,fontSize:13,color:T.t1}}>{v.name}</div>
                      {v.goal&&<div style={{fontSize:11,color:T.t4,marginTop:1}}>{v.goal.slice(0,18)}…</div>}
                    </td>
                    <td style={{padding:"10px 12px"}}><code style={{fontSize:11,color:T.t3,fontFamily:"monospace"}}>{v.no}</code></td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:11,color:T.t2}}>{tc.label}</span></td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:12,color:T.t2}}>{v.owner}</span></td>
                    <td style={{padding:"10px 12px"}}><StatusBadge {...sc}/></td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:11,color:T.t3}}>{v.startDate}</span></td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:11,color:T.t3}}>{v.testDate}</span></td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:11,color:T.t3}}>{v.releaseDate}</span></td>
                    <td style={{padding:"10px 12px",textAlign:"center"}}><span style={{fontSize:13,fontWeight:600,color:T.t1}}>{v.planCount}</span></td>
                    <td style={{padding:"10px 12px",minWidth:110}}>
                      {v.scope>0?<><ProgressBar value={v.executed} total={v.scope} color={TM}/><div style={{fontSize:10,color:T.t3,marginTop:2}}>{v.executed}/{v.scope} · {execRate}%</div></>:<span style={{fontSize:11,color:T.t4}}>暂无</span>}
                    </td>
                    <td style={{padding:"10px 12px",textAlign:"center"}}>
                      {v.executed>0?<span style={{fontSize:13,fontWeight:700,color:passRate>=85?TM:T.warning}}>{passRate}%</span>:<span style={{fontSize:11,color:T.t4}}>—</span>}
                    </td>
                    <td style={{padding:"10px 12px",textAlign:"center"}}>
                      {(v.p0Bugs+v.p1Bugs)>0?<span style={{fontSize:12,fontWeight:700,color:v.p0Bugs>0?T.danger:T.warning}}>{v.p0Bugs>0?`P0·${v.p0Bugs} `:""}{v.p1Bugs>0?`P1·${v.p1Bugs}`:""}</span>:<span style={{fontSize:12,color:T.t4}}>—</span>}
                    </td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:11,fontWeight:600,color:gateColor}}>{gateLabel}</span></td>
                    <td style={{padding:"10px 12px"}} onClick={e=>e.stopPropagation()}>
                      <div style={{display:"flex",gap:2}}>
                        <IBtn icon={Eye} label="查看" onClick={()=>onView(v)}/>
                        {v.status!=="archived"&&<IBtn icon={Edit2} label="编辑" onClick={()=>setEditVersion(v)}/>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",borderTop:`1px solid ${T.border}`}}>
            <span style={{fontSize:12,color:T.t3}}>共 {versions.length} 条</span>
            <button style={{width:28,height:28,borderRadius:6,fontSize:12,fontWeight:600,border:`1px solid ${TM}`,background:TM,color:"#fff",cursor:"pointer"}}>1</button>
          </div>
        </div>
      </div>
      {(showNewDrawer||editVersion)&&<NewVersionDrawer editVersion={editVersion||undefined} onClose={()=>{setShowNewDrawer(false);setEditVersion(null);}}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERSION DETAIL
// ═══════════════════════════════════════════════════════════════════════════════
function VersionDetail({version,onBack,onNewPlan,onViewPlan,onViewReqs}:{version:Version;onBack:()=>void;onNewPlan:()=>void;onViewPlan:(p:TestPlan)=>void;onViewReqs?:(versionId:string)=>void}){
  const [tab,setTab]=useState<"overview"|"reqs"|"plans"|"bugs"|"report"|"log">("overview");
  const [vBugsStatus,setVBugsStatus]=useState<"all"|BugSta>("all");
  const [vLogTypeF,setVLogTypeF]=useState("all");
  const [versionAction,setVersionAction]=useState<VersionActionType|null>(null);
  const [showGateModal,setShowGateModal]=useState(false);
  const [showDeleteModal,setShowDeleteModal]=useState(false);

  const sc=VERSION_STATUS_CFG[version.status];
  const passRate=version.executed>0?Math.round((version.passed/version.executed)*100):0;
  const execRate=version.scope>0?Math.round((version.executed/version.scope)*100):0;
  const daysToRelease=Math.ceil((new Date(version.releaseDate).getTime()-Date.now())/(1000*60*60*24));
  const versionPlans=MOCK_PLANS.filter(p=>p.versionId===version.id);
  const versionReqs=MOCK_REQS.filter(r=>r.versionId===version.id);
  const reqCovered=versionReqs.filter(r=>r.status==="covered"||r.status==="passed").length;
  const reqPassed=versionReqs.filter(r=>r.status==="passed").length;
  const reqCoverRate=versionReqs.length>0?Math.round((reqCovered/versionReqs.length)*100):0;

  const TABS=[
    {key:"overview",label:"概览"},
    {key:"reqs",label:`需求（${versionReqs.length}）`},
    {key:"plans",label:`测试计划（${versionPlans.length}）`},
    {key:"bugs",label:`缺陷汇总（${version.p0Bugs+version.p1Bugs}）`},
    {key:"report",label:"测试报告"},{key:"log",label:"操作记录"},
  ];

  const VERSION_PLAN_DIST=Object.entries(PLAN_STATUS_CFG).map(([k,v])=>({
    name:v.label,value:versionPlans.filter(p=>p.status===k).length,color:v.color,
  })).filter(d=>d.value>0);

  return(<>
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg}}>
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,padding:"0 20px",display:"flex",alignItems:"center",gap:10,height:52}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:T.t3,background:"none",border:"none",cursor:"pointer"}}
          onMouseEnter={e=>e.currentTarget.style.color=TM} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
          <ChevronLeft size={14}/>版本管理
        </button>
        <ChevronRight size={12} style={{color:T.t4}}/>
        <span style={{fontSize:13,fontWeight:500,color:T.t1}}>{version.name}</span>
        <code style={{fontSize:11,color:T.t3,fontFamily:"monospace"}}>{version.no}</code>
        <StatusBadge {...sc}/>
        <div style={{flex:1}}/>
        <span style={{fontSize:11,color:T.t3}}>负责人：{version.owner}</span>
        {daysToRelease>0&&version.status!=="released"&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:daysToRelease<=7?`${T.danger}12`:`${TM}12`,color:daysToRelease<=7?T.danger:TM,fontWeight:500}}>距发布 {daysToRelease} 天</span>}
        <IBtn icon={Edit2} label="编辑" onClick={()=>{}}/>
        {version.status!=="archived"&&onViewReqs&&<PBtn variant="ghost" icon={Plus} small onClick={()=>onViewReqs(version.id)}>添加需求</PBtn>}
        {version.status!=="archived"&&<PBtn color={TM} icon={Plus} small onClick={onNewPlan}>新建测试计划</PBtn>}
        {version.status==="planning"&&<PBtn color={TM} icon={Play} small onClick={()=>setVersionAction("start-dev")}>开始开发</PBtn>}
        {version.status==="developing"&&<PBtn color={TM} icon={Play} small onClick={()=>setVersionAction("start-test")}>开始测试</PBtn>}
        {version.status==="testing"&&<PBtn color="#7816FF" small onClick={()=>setVersionAction("mark-release")}>标记待发布</PBtn>}
        {version.status==="pending-release"&&<PBtn color={T.success} icon={CheckCircle} small onClick={()=>setVersionAction("release")}>确认发布</PBtn>}
        {version.status==="released"&&<PBtn color={T.t3} icon={Archive} small onClick={()=>setVersionAction("archive")}>归档</PBtn>}
      </div>
      {/* KPI */}
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",alignItems:"center",padding:"0 20px",height:72}}>
        {[
          {label:"测试计划",value:version.planCount,unit:"个",color:T.t1},
          {label:"版本需求",value:versionReqs.length,unit:"项",color:T.purple},
          {label:"需求覆盖率",value:versionReqs.length>0?`${reqCoverRate}%`:"—",unit:"",color:reqCoverRate===100?T.success:reqCoverRate>0?T.warning:T.t3},
          {label:"测试用例",value:version.scope,unit:"项",color:T.primary},
          {label:"已执行",value:version.executed,unit:"项",color:TM},
          {label:"用例通过率",value:version.executed>0?`${passRate}%`:"—",unit:"",color:passRate>=85?TM:T.warning},
          {label:"P0/P1 缺陷",value:version.p0Bugs+version.p1Bugs,unit:"个",color:(version.p0Bugs+version.p1Bugs)>0?T.danger:T.t3},
        ].map((s,i)=>(
          <React.Fragment key={s.label}>
            {i>0&&<div style={{width:1,height:36,background:T.border,margin:"0 24px"}}/>}
            <div>
              <div style={{fontSize:22,fontWeight:700,color:s.color,lineHeight:1}}>{s.value}<span style={{fontSize:12,fontWeight:400,marginLeft:2,color:T.t3}}>{s.unit}</span></div>
              <div style={{fontSize:11,color:T.t3,marginTop:4}}>{s.label}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
      {/* Tabs */}
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",padding:"0 20px"}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key as any)}
            style={{height:40,padding:"0 14px",fontSize:13,fontWeight:tab===t.key?600:400,border:"none",borderBottom:`2px solid ${tab===t.key?TM:"transparent"}`,background:"transparent",color:tab===t.key?TM:T.t3,cursor:"pointer",transition:"all 0.15s"}}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px",minHeight:0}}>
        {tab==="overview"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,maxWidth:1200}}>
            <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px"}}>
              <div style={{fontSize:14,fontWeight:600,color:T.t1,marginBottom:16}}>版本信息</div>
              {[{l:"版本目标",v:version.goal||"—"},{l:"开始日期",v:version.startDate},{l:"计划提测",v:version.testDate},{l:"计划发布",v:version.releaseDate}].map(({l,v})=>(
                <div key={l} style={{display:"flex",gap:12,marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${T.border}`}}>
                  <span style={{fontSize:12,color:T.t3,minWidth:72,flexShrink:0}}>{l}</span>
                  <span style={{fontSize:13,color:T.t1}}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px"}}>
              <div style={{fontSize:14,fontWeight:600,color:T.t1,marginBottom:16}}>测试计划状态</div>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                {VERSION_PLAN_DIST.length>0?(
                  <PieChart width={140} height={140}>
                    <Pie data={VERSION_PLAN_DIST} cx="50%" cy="50%" innerRadius={38} outerRadius={60} dataKey="value" paddingAngle={3}>
                      {VERSION_PLAN_DIST.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius:8,fontSize:12}}/>
                  </PieChart>
                ):(
                  <div style={{width:140,height:140,display:"flex",alignItems:"center",justifyContent:"center",background:"#F2F3F5",borderRadius:"50%",fontSize:12,color:T.t4}}>暂无计划</div>
                )}
                <div style={{flex:1}}>
                  {VERSION_PLAN_DIST.map(d=>(
                    <div key={d.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:d.color,flexShrink:0}}/>
                      <span style={{fontSize:12,color:T.t2,flex:1}}>{d.name}</span>
                      <span style={{fontSize:13,fontWeight:600,color:d.color}}>{d.value}</span>
                    </div>
                  ))}
                  {versionPlans.length===0&&<div style={{fontSize:12,color:T.t4}}>该版本尚无测试计划</div>}
                </div>
              </div>
            </div>
            {/* Quality Gate Card */}
            {(()=>{
              const plansDone=versionPlans.filter(p=>p.status==="completed").length;
              const plansTotal=versionPlans.length;
              const plansSignedCount=versionPlans.length; // mock: all completed plans assumed signed
              const completedPlans=versionPlans.filter(p=>p.status==="completed");
              const signedPlans=completedPlans.length; // simplified mock
              const gateChecks=[
                {label:"计划完成情况", target:`${plansTotal} 个全部完成`, current:`${plansDone}/${plansTotal} 已完成`, pass: plansDone===plansTotal&&plansTotal>0},
                {label:"报告签署",      target:"全部已签署",              current: signedPlans>0&&plansDone>0?`${signedPlans}/${plansDone} 已签署`:"未签署", pass: signedPlans===plansDone&&plansDone>0},
                {label:"需求覆盖率",    target:"100%",                   current: versionReqs.length>0?`${reqCoverRate}%`:"—",  pass: reqCoverRate===100&&versionReqs.length>0},
                {label:"用例执行率",    target:"≥ 90%",                  current: version.scope>0?`${execRate}%`:"—",           pass: execRate>=90},
                {label:"用例通过率",    target:"≥ 85%",                  current: version.executed>0?`${passRate}%`:"—",        pass: passRate>=85},
                {label:"P0 缺陷",      target:"0 个",                   current:`${version.p0Bugs} 个`,                        pass: version.p0Bugs===0},
                {label:"P1 缺陷",      target:"≤ 3 个",                 current:`${version.p1Bugs} 个`,                        pass: version.p1Bugs<=3},
              ];
              const gatePassed=gateChecks.filter(q=>q.pass).length;
              const allPass=gatePassed===gateChecks.length;
              return(
                <div style={{gridColumn:"1/-1",background:"#fff",borderRadius:12,border:`1.5px solid ${allPass?`${T.success}40`:`${T.warning}40`}`,padding:"20px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:32,height:32,borderRadius:8,background:allPass?`${T.success}12`:`${T.warning}12`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {allPass?<ShieldCheck size={16} style={{color:T.success}}/>:<ShieldAlert size={16} style={{color:T.warning}}/>}
                      </div>
                      <div>
                        <div style={{fontSize:14,fontWeight:600,color:T.t1}}>质量准出概览</div>
                        <div style={{fontSize:11,color:T.t3,marginTop:1}}>汇总各测试计划质量数据，作为版本发布的准入参考</div>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:12,padding:"4px 12px",borderRadius:12,fontWeight:600,
                        background:allPass?`${T.success}15`:`${T.warning}15`,
                        color:allPass?T.success:T.warning}}>
                        {allPass?"全部达标":`${gatePassed}/${gateChecks.length} 项达标`}
                      </span>
                      {(version.status==="pending-release"||version.status==="testing")&&(
                        <button onClick={()=>setVersionAction("release")}
                          style={{fontSize:12,padding:"5px 14px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,
                            background:allPass?T.success:`${T.warning}20`,color:allPass?"#fff":T.warning}}>
                          {allPass?"确认发布":"强制发布"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10}}>
                    {gateChecks.map(q=>(
                      <div key={q.label} style={{padding:"12px 14px",borderRadius:10,border:`1px solid ${q.pass?`${T.success}25`:`${T.danger}25`}`,background:q.pass?`${T.success}05`:`${T.danger}05`}}>
                        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:7}}>
                          {q.pass?<CheckCircle size={13} style={{color:T.success}}/>:<XCircle size={13} style={{color:T.danger}}/>}
                          <span style={{fontSize:11,fontWeight:500,color:T.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q.label}</span>
                        </div>
                        <div style={{fontSize:10,color:T.t4,marginBottom:3}}>目标：{q.target}</div>
                        <div style={{fontSize:14,fontWeight:700,color:q.pass?T.success:T.danger}}>{q.current}</div>
                      </div>
                    ))}
                  </div>
                  {!allPass&&(
                    <div style={{marginTop:14,padding:"10px 14px",borderRadius:8,background:`${T.warning}08`,border:`1px solid ${T.warning}25`,display:"flex",alignItems:"center",gap:8}}>
                      <AlertTriangle size={14} style={{color:T.warning,flexShrink:0}}/>
                      <span style={{fontSize:12,color:T.warning}}>存在 {gateChecks.length-gatePassed} 项未达标，发布时需填写强制发布原因并由项目负责人确认。</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {tab==="reqs"&&(
          <div>
            {/* Stats + actions header */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{display:"flex",gap:6}}>
                {([
                  {label:"全部",value:versionReqs.length,color:T.t1},
                  {label:"未覆盖",value:versionReqs.filter(r=>r.status==="uncovered").length,color:"#86909C"},
                  {label:"部分覆盖",value:versionReqs.filter(r=>r.status==="partial").length,color:T.warning},
                  {label:"已覆盖",value:versionReqs.filter(r=>r.status==="covered").length,color:TM},
                  {label:"测试通过",value:reqPassed,color:T.success},
                ] as const).map(s=>(
                  <div key={s.label} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:16,background:"#fff",border:`1px solid ${T.border}`,fontSize:12,color:T.t2}}>
                    <span style={{fontWeight:700,color:s.color,fontSize:13}}>{s.value}</span>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
              <div style={{flex:1}}/>
              {onViewReqs&&(
                <button onClick={()=>onViewReqs(version.id)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:"#fff",cursor:"pointer",fontSize:12,color:TM}}>
                  <ExternalLink size={12}/> 在需求管理中查看全部
                </button>
              )}
              <PBtn color={TM} icon={Plus} small onClick={()=>{}}>添加需求</PBtn>
            </div>
            {/* Requirements table */}
            <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              {versionReqs.length===0?(
                <div style={{padding:"48px",textAlign:"center",color:T.t4,fontSize:13}}>
                  <div style={{marginBottom:12}}>该版本下暂无需求</div>
                  {onViewReqs&&<button onClick={()=>onViewReqs(version.id)} style={{color:TM,background:"none",border:`1px solid ${TM}`,borderRadius:8,padding:"6px 16px",cursor:"pointer",fontSize:13}}>前往添加需求</button>}
                </div>
              ):(
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                      {["需求ID","标题","优先级","来源","用例覆盖","状态","负责人","操作"].map(h=>(
                        <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.t3,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {versionReqs.map((r,idx)=>{
                      const sc2=REQ_STATUS_CFG[r.status];
                      const pc2=PRIORITY_CFG[r.priority];
                      const srcc2=REQ_SOURCE_CFG[r.source];
                      const coverPct=r.caseTotal>0?Math.round((r.caseCovered/r.caseTotal)*100):0;
                      return(
                        <tr key={r.id} style={{borderBottom:idx<versionReqs.length-1?`1px solid ${T.border}`:"none"}}
                          onMouseEnter={e=>e.currentTarget.style.background="#FAFBFF"}
                          onMouseLeave={e=>e.currentTarget.style.background=""}>
                          <td style={{padding:"10px 12px",fontFamily:"monospace",fontSize:11,color:T.t3,whiteSpace:"nowrap"}}>{r.id}</td>
                          <td style={{padding:"10px 12px",maxWidth:220}}>
                            <div style={{fontWeight:500,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</div>
                            {r.sourceRef&&<div style={{fontSize:11,color:T.t4,marginTop:1,fontFamily:"monospace"}}>{r.sourceRef}</div>}
                          </td>
                          <td style={{padding:"10px 12px"}}>
                            <span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:4,background:pc2.bg,color:pc2.color}}>{r.priority}</span>
                          </td>
                          <td style={{padding:"10px 12px"}}>
                            <span style={{fontSize:11,padding:"2px 7px",borderRadius:4,background:srcc2.bg,color:srcc2.color,fontWeight:500}}>{srcc2.label}</span>
                          </td>
                          <td style={{padding:"10px 12px",minWidth:120}}>
                            {r.caseTotal>0?(
                              <div>
                                <div style={{fontSize:11,color:T.t3,marginBottom:3}}>{r.caseCovered}/{r.caseTotal} 用例 · {coverPct}%</div>
                                <ProgressBar value={r.caseCovered} total={r.caseTotal} height={4}/>
                              </div>
                            ):<span style={{fontSize:12,color:T.t4}}>尚未关联</span>}
                          </td>
                          <td style={{padding:"10px 12px"}}>
                            <StatusBadge label={sc2.label} bg={sc2.bg} color={sc2.color}/>
                          </td>
                          <td style={{padding:"10px 12px",fontSize:12,color:T.t2,whiteSpace:"nowrap"}}>{r.assignee||"—"}</td>
                          <td style={{padding:"10px 12px"}}>
                            <div style={{display:"flex",gap:2}}>
                              <IBtn icon={Eye} label="查看需求详情"/>
                              <IBtn icon={Link2} label="关联用例"/>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab==="plans"&&(
          <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:13,fontWeight:600,color:T.t1}}>该版本下的测试计划</span>
              <PBtn color={TM} icon={Plus} small onClick={onNewPlan}>新建计划</PBtn>
            </div>
            {versionPlans.length===0?(
              <div style={{padding:"48px",textAlign:"center",color:T.t4,fontSize:13}}>该版本下暂无测试计划，点击右上角新建</div>
            ):(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                    {["计划名称","类型","负责人","周期","用例数","执行进度","通过率","P0/P1","状态","操作"].map(h=>(
                      <th key={h} style={{padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.t3}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {versionPlans.map((p,idx)=>{
                    const ps=PLAN_STATUS_CFG[p.status];const pt=PLAN_TYPE_CFG[p.type];
                    const pr=p.executed>0?Math.round((p.passed/p.executed)*100):0;
                    return(
                      <tr key={p.id} onClick={()=>onViewPlan(p)}
                        style={{borderBottom:idx<versionPlans.length-1?`1px solid ${T.border}`:"none",cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#FAFBFF"}
                        onMouseLeave={e=>e.currentTarget.style.background=""}>
                        <td style={{padding:"10px 12px"}}><span style={{fontSize:13,fontWeight:500,color:T.t1}}>{p.name}</span></td>
                        <td style={{padding:"10px 12px"}}><span style={{fontSize:11,color:pt.color,fontWeight:500}}>{pt.label}</span></td>
                        <td style={{padding:"10px 12px"}}><span style={{fontSize:12,color:T.t2}}>{p.owner}</span></td>
                        <td style={{padding:"10px 12px"}}><span style={{fontSize:11,color:T.t3,whiteSpace:"nowrap"}}>{p.startDate}—{p.endDate}</span></td>
                        <td style={{padding:"10px 12px",textAlign:"center"}}><span style={{fontSize:13,fontWeight:600,color:T.t1}}>{p.scope}</span></td>
                        <td style={{padding:"10px 12px",minWidth:110}}><ProgressBar value={p.executed} total={p.scope} color={TM}/></td>
                        <td style={{padding:"10px 12px",textAlign:"center"}}><span style={{fontSize:12,fontWeight:700,color:pr>=85?TM:T.warning}}>{p.executed>0?`${pr}%`:"—"}</span></td>
                        <td style={{padding:"10px 12px",textAlign:"center"}}>{(p.p0Bugs+p.p1Bugs)>0?<span style={{fontSize:11,fontWeight:700,color:p.p0Bugs>0?T.danger:T.warning}}>{p.p0Bugs+p.p1Bugs}</span>:<span style={{color:T.t4}}>—</span>}</td>
                        <td style={{padding:"10px 12px"}}><StatusBadge {...ps}/></td>
                        <td style={{padding:"10px 12px"}}><IBtn icon={Eye} label="查看" onClick={()=>onViewPlan(p)}/></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab==="bugs"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",gap:6}}>
                {(["all","open","fixing","fixed","closed","rejected"] as ("all"|BugSta)[]).map(s=>{
                  const cnt=s==="all"?MOCK_BUGS.length:MOCK_BUGS.filter(b=>b.status===s).length;
                  const c=s==="all"?T.t2:BUG_STA_CFG[s].color;
                  return(
                    <button key={s} onClick={()=>setVBugsStatus(s)}
                      style={{padding:"4px 12px",borderRadius:16,fontSize:12,cursor:"pointer",border:`1px solid ${vBugsStatus===s?c:T.border}`,background:vBugsStatus===s?`${c}15`:"transparent",color:vBugsStatus===s?c:T.t3,fontWeight:vBugsStatus===s?600:400}}>
                      {s==="all"?"全部":BUG_STA_CFG[s].label}&nbsp;{cnt}
                    </button>
                  );
                })}
              </div>
              <PBtn color={T.danger} icon={Plus} small>新建缺陷</PBtn>
            </div>
            <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                    {["缺陷编号","标题","严重程度","优先级","状态","负责人","所属计划","发现时间"].map(h=>(
                      <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:T.t3,whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_BUGS.filter(b=>vBugsStatus==="all"||b.status===vBugsStatus).map((b,i,arr)=>{
                    const sev=BUG_SEV_CFG[b.severity];const sta=BUG_STA_CFG[b.status];
                    const pc=b.priority==="P0"?T.danger:b.priority==="P1"?T.warning:T.primary;
                    const planName=MOCK_PLANS.find(p=>p.id===b.planId)?.name||"—";
                    return(
                      <tr key={b.id} style={{borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none"}}
                        onMouseEnter={e=>e.currentTarget.style.background="#FAFBFF"}
                        onMouseLeave={e=>e.currentTarget.style.background=""}>
                        <td style={{padding:"9px 12px"}}><code style={{fontSize:11,fontFamily:"monospace",color:T.t3}}>{b.no}</code></td>
                        <td style={{padding:"9px 12px",maxWidth:260}}><span style={{fontSize:13,color:T.t1}}>{b.title}</span></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:12,border:`1.5px solid ${sev.color}30`,color:sev.color,background:`${sev.color}10`}}>{sev.label}</span></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:`${pc}15`,color:pc}}>{b.priority}</span></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:sta.bg,color:sta.color,fontWeight:500}}>{sta.label}</span></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:12,color:T.t2}}>{b.assignee}</span></td>
                        <td style={{padding:"9px 12px",maxWidth:140}}><span style={{fontSize:11,color:T.t3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{planName}</span></td>
                        <td style={{padding:"9px 12px"}}><span style={{fontSize:11,color:T.t3,whiteSpace:"nowrap"}}>{b.foundAt}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab==="report"&&(
          <div style={{maxWidth:1000}}>
            <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"24px",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
                <div>
                  <div style={{fontSize:18,fontWeight:700,color:T.t1,marginBottom:4}}>{version.name} 版本测试汇总报告</div>
                  <div style={{fontSize:12,color:T.t3}}>汇总 {versionPlans.length} 个测试计划 · 负责人：{version.owner} · 生成：2026-07-07 18:00</div>
                </div>
                <PBtn variant="ghost" icon={Download} onClick={()=>{}}>导出报告</PBtn>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:20}}>
                {([
                  {l:"测试计划",v:versionPlans.length,u:"个",c:T.t1},
                  {l:"测试用例",v:version.scope,u:"项",c:T.primary},
                  {l:"已执行",v:version.executed,u:"项",c:TM},
                  {l:"用例通过率",v:version.executed>0?`${passRate}%`:"—",u:"",c:passRate>=85?TM:T.warning},
                  {l:"发现缺陷",v:MOCK_BUGS.length,u:"个",c:T.danger},
                ]).map(s=>(
                  <div key={s.l} style={{padding:"14px",borderRadius:10,border:`1px solid ${T.border}`,background:"#FAFBFE",textAlign:"center"}}>
                    <div style={{fontSize:22,fontWeight:700,color:s.c,lineHeight:1}}>{s.v}<span style={{fontSize:12,color:T.t3,fontWeight:400,marginLeft:2}}>{s.u}</span></div>
                    <div style={{fontSize:11,color:T.t3,marginTop:6}}>{s.l}</div>
                  </div>
                ))}
              </div>
              {versionPlans.filter(p=>p.executed>0).length>0&&(
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.t2,marginBottom:10}}>各计划通过率对比</div>
                  <BarChart width={760} height={180}
                    data={versionPlans.filter(p=>p.executed>0).map(p=>({
                      name:p.name.length>8?p.name.slice(0,8)+"…":p.name,
                      通过率:Math.round((p.passed/p.executed)*100),
                      执行率:Math.round((p.executed/p.scope)*100),
                    }))} margin={{top:5,right:5,left:-15,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F5" vertical={false}/>
                    <XAxis dataKey="name" tick={{fontSize:10,fill:T.t3}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:T.t3}} axisLine={false} tickLine={false} domain={[0,100]}/>
                    <Tooltip contentStyle={{borderRadius:8,border:`1px solid ${T.border}`,fontSize:12}}/>
                    <Legend wrapperStyle={{fontSize:11}}/>
                    <Bar dataKey="通过率" fill={TM} radius={[3,3,0,0]} barSize={20}/>
                    <Bar dataKey="执行率" fill={`${T.primary}70`} radius={[3,3,0,0]} barSize={20}/>
                  </BarChart>
                </div>
              )}
            </div>
          </div>
        )}

        {tab==="log"&&(
          <div style={{maxWidth:800}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <span style={{fontSize:13,fontWeight:600,color:T.t2}}>版本操作记录</span>
              <select value={vLogTypeF} onChange={e=>setVLogTypeF(e.target.value)}
                style={{height:30,padding:"0 8px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,color:T.t2,outline:"none",background:"#fff"}}>
                <option value="all">全部类型</option>
                {([["status","状态变更"],["edit","内容修改"],["create","创建"]] as const).map(([v,l])=>(
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <LogTimeline entries={MOCK_VERSION_LOG.filter(e=>vLogTypeF==="all"||e.type===vLogTypeF)}/>
          </div>
        )}
      </div>
    </div>

    {versionAction&&versionAction!=="release"&&<VersionStatusModal action={versionAction} versionName={version.name} onClose={()=>setVersionAction(null)} onDone={()=>setVersionAction(null)}/>}
    {versionAction==="release"&&<ReleaseConfirmModal versionName={version.name} checks={[
      {label:"计划完成情况", target:`${versionPlans.length} 个全部完成`, current:`${versionPlans.filter(p=>p.status==="completed").length}/${versionPlans.length} 已完成`, pass: versionPlans.length>0&&versionPlans.every(p=>p.status==="completed")},
      {label:"需求覆盖率",   target:"100%",   current: versionReqs.length>0?`${reqCoverRate}%`:"—",   pass: reqCoverRate===100&&versionReqs.length>0},
      {label:"用例执行率",   target:"≥ 90%",  current: version.scope>0?`${execRate}%`:"—",            pass: execRate>=90},
      {label:"用例通过率",   target:"≥ 85%",  current: version.executed>0?`${passRate}%`:"—",         pass: passRate>=85},
      {label:"P0 缺陷",     target:"0 个",   current:`${version.p0Bugs} 个`,                          pass: version.p0Bugs===0},
      {label:"P1 缺陷",     target:"≤ 3 个", current:`${version.p1Bugs} 个`,                          pass: version.p1Bugs<=3},
    ]} onClose={()=>setVersionAction(null)} onDone={()=>setVersionAction(null)}/>}
    {showGateModal&&<QualityGateModal versionName={version.name} checks={[
      {label:"用例执行率", target:"≥ 90%", current: version.scope>0?`${execRate}%`:"—",    pass: execRate>=90},
      {label:"用例通过率", target:"≥ 85%", current: version.executed>0?`${passRate}%`:"—", pass: passRate>=85},
      {label:"P0 缺陷",   target:"0 个",  current:`${version.p0Bugs} 个`,                  pass: version.p0Bugs===0},
      {label:"P1 缺陷",   target:"≤ 3 个",current:`${version.p1Bugs} 个`,                  pass: version.p1Bugs<=3},
    ]} onClose={()=>setShowGateModal(false)} onForce={()=>setShowGateModal(false)} onBack={()=>setShowGateModal(false)}/>}
    {showDeleteModal&&<DeleteConfirmModal itemName={version.name} itemType="版本" hasLinked linkedDesc={`${versionPlans.length} 个测试计划、${versionReqs.length} 条关联需求`} onClose={()=>setShowDeleteModal(false)} onDone={()=>setShowDeleteModal(false)}/>}
  </>);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIREMENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

type LinkedCase = {id:string;no:string;title:string;status:ExecStatus;assignee:string;reviewStatus:"pending"|"reviewing"|"passed"|"rejected";reviewNote?:string};
type CaseReviewState = {status:"pending"|"reviewing"|"passed"|"rejected";note?:string};

function CaseReviewDrawer({
  caseItem, allCases, reviewState, onClose, onPass, onReject, onNavigate
}:{
  caseItem:LinkedCase;
  allCases:LinkedCase[];
  reviewState:CaseReviewState;
  onClose:()=>void;
  onPass:()=>void;
  onReject:(note:string)=>void;
  onNavigate:(id:string)=>void;
}){
  const [showRejectInput,setShowRejectInput]=useState(false);
  const [rejectNote,setRejectNote]=useState(reviewState.note||"");

  const idx=allCases.findIndex(c=>c.id===caseItem.id);
  const total=allCases.length;
  const prevCase=idx>0?allCases[idx-1]:null;
  const nextCase=idx<total-1?allCases[idx+1]:null;

  const libCase=CASE_LIB.find(c=>c.no===caseItem.no);
  const detail=getSteps(caseItem.no);
  const rvc=REQ_REVIEW_CFG[reviewState.status];
  const pc=libCase?PRIORITY_CFG[libCase.priority as ReqPriority]:null;

  const canAct=reviewState.status==="reviewing";

  const handleNavigate=(c:LinkedCase)=>{
    setShowRejectInput(false);
    setRejectNote("");
    onNavigate(c.id);
  };

  return(
    <div style={{position:"fixed",top:0,right:0,bottom:0,width:480,background:"#fff",boxShadow:"-4px 0 24px rgba(0,0,0,0.12)",zIndex:300,display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"flex-start",gap:10,flexShrink:0}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
            <code style={{fontSize:11,color:T.t3,fontFamily:"monospace",flexShrink:0}}>{caseItem.no}</code>
            <span style={{fontSize:11,padding:"1px 7px",borderRadius:3,background:rvc.bg,color:rvc.color,fontWeight:600,flexShrink:0}}>{rvc.label}</span>
            {pc&&<span style={{fontSize:11,padding:"1px 6px",borderRadius:3,background:pc.bg,color:pc.color,fontWeight:700,flexShrink:0}}>{libCase?.priority}</span>}
            {libCase&&<span style={{fontSize:11,color:T.t3,flexShrink:0}}>{libCase.module}</span>}
          </div>
          <div style={{fontSize:15,fontWeight:600,color:T.t1,lineHeight:1.4}}>{caseItem.title}</div>
        </div>
        <button onClick={onClose} style={{flexShrink:0,width:28,height:28,border:"none",background:"transparent",cursor:"pointer",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:T.t3}}
          onMouseEnter={e=>{e.currentTarget.style.background=T.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
          <X size={15}/>
        </button>
      </div>

      {/* Body — scrollable */}
      <div style={{flex:1,overflowY:"auto",padding:"20px"}}>
        {/* Precondition */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:3,height:12,borderRadius:2,background:TM}}/>前置条件
          </div>
          <div style={{fontSize:13,color:T.t2,lineHeight:1.7,background:T.bg,borderRadius:8,padding:"10px 14px"}}>{detail.precondition}</div>
        </div>

        {/* Steps */}
        <div>
          <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:3,height:12,borderRadius:2,background:TM}}/>测试步骤
          </div>
          <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr",background:"#F7F8FA",borderBottom:`1px solid ${T.border}`}}>
              {["#","操作步骤","预期结果"].map(h=>(
                <div key={h} style={{padding:"8px 12px",fontSize:11,fontWeight:600,color:T.t3}}>{h}</div>
              ))}
            </div>
            {detail.steps.map((s,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"32px 1fr 1fr",borderBottom:i<detail.steps.length-1?`1px solid ${T.border}`:"none",background:i%2===0?"#fff":"#FAFBFE"}}>
                <div style={{padding:"10px 12px",fontSize:12,color:T.t4,fontWeight:600,borderRight:`1px solid ${T.border}`}}>{i+1}</div>
                <div style={{padding:"10px 12px",fontSize:13,color:T.t1,lineHeight:1.6,borderRight:`1px solid ${T.border}`}}>{s.action}</div>
                <div style={{padding:"10px 12px",fontSize:13,color:T.t2,lineHeight:1.6}}>{s.expected}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Rejection note (read-only if already rejected) */}
        {reviewState.status==="rejected"&&reviewState.note&&!showRejectInput&&(
          <div style={{marginTop:16,borderRadius:8,border:`1px solid ${T.danger}30`,background:`${T.danger}05`,padding:"10px 14px",display:"flex",gap:8}}>
            <XCircle size={13} style={{color:T.danger,flexShrink:0,marginTop:1}}/>
            <span style={{fontSize:12,color:T.danger,lineHeight:1.6}}>{reviewState.note}</span>
          </div>
        )}

        {/* Reject input area */}
        {showRejectInput&&(
          <div style={{marginTop:16,border:`1px solid ${T.danger}30`,borderRadius:10,padding:"14px",background:`${T.danger}03`}}>
            <div style={{fontSize:12,fontWeight:600,color:T.danger,marginBottom:8}}>驳回原因</div>
            <textarea value={rejectNote} onChange={e=>setRejectNote(e.target.value)} rows={3}
              placeholder="请说明驳回原因，帮助用例作者修改…"
              autoFocus
              style={{width:"100%",border:`1px solid ${T.danger}40`,borderRadius:8,padding:"8px 10px",fontSize:12,color:T.t1,outline:"none",resize:"none",boxSizing:"border-box",background:"#fff"}}/>
            <div style={{display:"flex",gap:8,marginTop:10,justifyContent:"flex-end"}}>
              <PBtn variant="ghost" small onClick={()=>{setShowRejectInput(false);setRejectNote(reviewState.note||"");}}>取消</PBtn>
              <PBtn small color={T.danger} onClick={()=>{onReject(rejectNote||"已驳回，请修改后重新提交");setShowRejectInput(false);}}>确认驳回</PBtn>
            </div>
          </div>
        )}
      </div>

      {/* Footer — fixed actions */}
      <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,background:"#fff"}}>
        {/* Nav row */}
        <div style={{display:"flex",alignItems:"center",padding:"10px 20px",borderBottom:`1px solid ${T.border}`,gap:8}}>
          <button onClick={()=>prevCase&&handleNavigate(prevCase)} disabled={!prevCase}
            style={{display:"flex",alignItems:"center",gap:4,height:30,padding:"0 12px",borderRadius:8,border:`1px solid ${T.border}`,background:"#fff",cursor:prevCase?"pointer":"not-allowed",fontSize:12,color:prevCase?T.t2:T.t4,opacity:prevCase?1:0.4}}>
            <ChevronLeft size={13}/>上一条
          </button>
          <div style={{flex:1,textAlign:"center",fontSize:12,color:T.t3,fontWeight:500}}>
            {idx+1} / {total}
          </div>
          <button onClick={()=>nextCase&&handleNavigate(nextCase)} disabled={!nextCase}
            style={{display:"flex",alignItems:"center",gap:4,height:30,padding:"0 12px",borderRadius:8,border:`1px solid ${T.border}`,background:"#fff",cursor:nextCase?"pointer":"not-allowed",fontSize:12,color:nextCase?T.t2:T.t4,opacity:nextCase?1:0.4}}>
            下一条<ChevronRight size={13}/>
          </button>
        </div>
        {/* Action row */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 20px"}}>
          {reviewState.status==="passed"?(
            <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
              <CheckCircle size={15} style={{color:T.success}}/>
              <span style={{fontSize:13,color:T.success,fontWeight:600}}>已通过评审</span>
            </div>
          ):reviewState.status==="rejected"?(
            <>
              <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
                <XCircle size={15} style={{color:T.danger}}/>
                <span style={{fontSize:13,color:T.danger,fontWeight:600}}>已驳回</span>
              </div>
              <PBtn variant="ghost" small onClick={()=>{setShowRejectInput(false);onPass();}}>撤回并通过</PBtn>
            </>
          ):(
            <>
              <div style={{fontSize:12,color:T.t3,flex:1}}>
                {canAct?"请审阅上方步骤后操作":"用例尚未进入评审流程"}
              </div>
              <button onClick={()=>{setShowRejectInput(true);}} disabled={!canAct}
                style={{height:32,padding:"0 16px",borderRadius:8,border:`1px solid ${canAct?T.danger:T.border}`,background:canAct?`${T.danger}08`:"#F7F8FA",color:canAct?T.danger:T.t4,fontSize:13,fontWeight:600,cursor:canAct?"pointer":"not-allowed",opacity:canAct?1:0.5}}>
                驳回
              </button>
              <button onClick={onPass} disabled={!canAct}
                style={{height:32,padding:"0 20px",borderRadius:8,border:"none",background:canAct?T.success:"#C9CDD4",color:"#fff",fontSize:13,fontWeight:600,cursor:canAct?"pointer":"not-allowed",opacity:canAct?1:0.5}}>
                通过
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReqDetail({req,onBack}:{req:Req;onBack:()=>void}){
  type DTab = "cases"|"info"|"bugs";
  const [dtab,setDtab]=useState<DTab>("cases");
  const [showCasePicker,setShowCasePicker]=useState(false);
  const [linkedCases,setLinkedCases]=useState(req.linkedCases||[]);

  const passedCount=linkedCases.filter(c=>c.reviewStatus==="passed").length;
  const reviewingCount=linkedCases.filter(c=>c.reviewStatus==="reviewing").length;
  const rejectedCount=linkedCases.filter(c=>c.reviewStatus==="rejected").length;
  const ver=MOCK_VERSIONS.find(v=>v.id===req.versionId);
  const sc=REQ_STATUS_CFG[req.status];
  const pc=PRIORITY_CFG[req.priority];
  const srcc=REQ_SOURCE_CFG[req.source];
  const rrc=REQ_REVIEW_CFG[req.reviewStatus];
  const rrPlans=MOCK_PLANS.filter(p=>p.versionId===req.versionId);
  const BUG_STA_CFG:Record<BugSta,{label:string;color:string}>={
    open:{label:"待处理",color:T.danger},fixing:{label:"修复中",color:T.warning},
    fixed:{label:"已修复",color:T.success},closed:{label:"已关闭",color:T.t3},rejected:{label:"已拒绝",color:T.t3},
  };
  const BUG_SEV_CFG:Record<BugSev,{label:string;color:string;bg:string}>={
    critical:{label:"致命",color:"#F53F3F",bg:"#FFECEC"},major:{label:"严重",color:"#FF7D00",bg:"#FFF3E8"},
    minor:{label:"一般",color:"#0EA5E9",bg:"#E0F5FE"},trivial:{label:"轻微",color:"#86909C",bg:"#F2F3F5"},
  };

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:T.bg}}>
      {showCasePicker&&(
        <CasePickerModal selected={linkedCases.map(c=>c.id)} versionId={req.versionId}
          onClose={()=>setShowCasePicker(false)}
          onConfirm={ids=>{
            const toAdd=CASE_LIB.filter(cl=>ids.includes(cl.id)&&!linkedCases.some(lc=>lc.no===cl.no));
            const newCases=toAdd.map(cl=>({id:cl.id,no:cl.no,title:cl.title,status:"pending" as ExecStatus,assignee:"—",reviewStatus:"pending" as const}));
            setLinkedCases(p=>[...p,...newCases]);
            setShowCasePicker(false);
          }}/>
      )}

      {/* ── Page header ── */}
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,padding:"0 20px",height:52,display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:5,fontSize:13,color:T.t3,background:"none",border:"none",cursor:"pointer",padding:"4px 8px",borderRadius:6}}
          onMouseEnter={e=>e.currentTarget.style.color=TM} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
          <ChevronLeft size={14}/>需求管理
        </button>
        <div style={{width:1,height:14,background:T.border}}/>
        <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
          <code style={{fontSize:12,color:T.t3,fontFamily:"monospace",flexShrink:0}}>{req.id}</code>
          <span style={{fontSize:15,fontWeight:700,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{req.title}</span>
          <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:rrc.bg,color:rrc.color,fontWeight:600,flexShrink:0}}>{rrc.label}</span>
          <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:pc.bg,color:pc.color,fontWeight:700,flexShrink:0}}>{req.priority}</span>
          {ver&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:T.bg,color:T.t2,flexShrink:0}}>{ver.name}</span>}
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          <PBtn variant="ghost" icon={Edit2} small>编辑</PBtn>
        </div>
      </div>

      {/* ── Tab bar ── */}
      {(()=>{
        const bugCount=req.linkedBugs&&req.linkedBugs.length>0?req.linkedBugs.length:0;
        const DTABS:[DTab,string][]=[
          ["cases", linkedCases.length>0 ? "关联用例 ("+linkedCases.length+")" : "关联用例"],
          ["info","基本信息"],
          ["bugs", bugCount>0 ? "追溯缺陷 ("+bugCount+")" : "追溯缺陷"],
        ];
        return(
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",padding:"0 20px"}}>
        {DTABS.map(([k,l])=>(
          <button key={k} onClick={()=>setDtab(k)}
            style={{height:40,padding:"0 16px",fontSize:13,fontWeight:dtab===k?600:400,border:"none",borderBottom:`2px solid ${dtab===k?TM:"transparent"}`,background:"transparent",color:dtab===k?TM:T.t3,cursor:"pointer",whiteSpace:"nowrap"}}>
            {l}
          </button>
        ))}
      </div>
        );
      })()}

      {/* ── Body ── */}
      <div style={{flex:1,overflowY:"auto",padding:"20px",minHeight:0}}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>

          {/* ── 关联用例 ── */}
          {dtab==="cases"&&(
            <>
              {/* Coverage summary card (read-only) */}
              <div style={{background:"#fff",borderRadius:12,border:`1px solid ${passedCount===linkedCases.length&&linkedCases.length>0?`${T.success}40`:T.border}`,padding:"16px 20px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:linkedCases.length>0?10:0}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:T.t1}}>
                      {linkedCases.length===0?"尚未关联任何用例":passedCount===linkedCases.length?"关联用例已全部通过评审 ✓":`用例评审状态：${passedCount} / ${linkedCases.length} 已通过`}
                    </div>
                    {linkedCases.length>0&&(
                      <div style={{display:"flex",gap:14,marginTop:4}}>
                        {[{v:passedCount,l:"已通过",c:T.success},{v:reviewingCount,l:"评审中",c:TM},{v:rejectedCount,l:"已驳回",c:T.danger},{v:linkedCases.length-passedCount-reviewingCount-rejectedCount,l:"待评审",c:T.t4}]
                          .filter(s=>s.v>0).map(s=>(
                          <span key={s.l} style={{fontSize:12,color:s.c,fontWeight:600}}>{s.v} {s.l}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <PBtn variant="ghost" icon={Plus} onClick={()=>setShowCasePicker(true)}>从用例库关联</PBtn>
                </div>
                {linkedCases.length>0&&(
                  <ProgressBar value={passedCount} total={linkedCases.length} color={T.success}/>
                )}
              </div>

              {/* Case list — display only, no review actions */}
              {linkedCases.length===0?(
                <div style={{background:"#fff",borderRadius:12,border:`1.5px dashed ${T.border}`,padding:"48px 24px",textAlign:"center"}}>
                  <FileText size={36} style={{color:T.t4,margin:"0 auto 10px"}}/>
                  <div style={{fontSize:13,color:T.t3}}>暂未关联任何测试用例</div>
                  <div style={{fontSize:12,color:T.t4,marginTop:4}}>点击上方「从用例库关联」添加</div>
                </div>
              ):(
                <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,overflow:"hidden"}}>
                  {linkedCases.map((c,i)=>{
                    const rvc=REQ_REVIEW_CFG[c.reviewStatus];
                    const libCase=CASE_LIB.find(cl=>cl.no===c.no);
                    const pc2=libCase?PRIORITY_CFG[libCase.priority as ReqPriority]:null;
                    const dotColor=c.reviewStatus==="passed"?T.success:c.reviewStatus==="rejected"?T.danger:c.reviewStatus==="reviewing"?TM:T.t4;
                    return(
                      <div key={c.id} style={{borderBottom:i<linkedCases.length-1?`1px solid ${T.border}`:"none",background:c.reviewStatus==="rejected"?`${T.danger}03`:"#fff"}}>
                        <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:6,height:6,borderRadius:"50%",flexShrink:0,background:dotColor}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                              <code style={{fontSize:11,color:T.t3,fontFamily:"monospace"}}>{c.no}</code>
                              <span style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:rvc.bg,color:rvc.color,fontWeight:600}}>{rvc.label}</span>
                              {pc2&&<span style={{fontSize:10,padding:"1px 5px",borderRadius:3,background:pc2.bg,color:pc2.color,fontWeight:700}}>{libCase?.priority}</span>}
                              {libCase&&<span style={{fontSize:11,color:T.t4}}>{libCase.module}</span>}
                            </div>
                            <div style={{fontSize:13,color:T.t1,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.title}</div>
                          </div>
                          <IBtn icon={Trash2} label="解除关联" danger onClick={()=>setLinkedCases(p=>p.filter(lc=>lc.id!==c.id))}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── 基本信息 ── */}
          {dtab==="info"&&(
            <div style={{maxWidth:880,display:"flex",flexDirection:"column",gap:16}}>
              {/* 基本属性 */}
              <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px"}}>
                <div style={{fontSize:14,fontWeight:600,color:T.t1,marginBottom:14}}>基本属性</div>
                <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
                  {[
                    {l:"所属版本",v:ver?.name||"—"},
                    {l:"优先级",v:<span style={{fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:4,background:pc.bg,color:pc.color}}>{req.priority}</span>},
                    {l:"评审状态",v:<span style={{fontSize:12,padding:"2px 8px",borderRadius:4,background:rrc.bg,color:rrc.color,fontWeight:600}}>{rrc.label}</span>},
                    {l:"覆盖状态",v:<span style={{fontSize:12,padding:"2px 8px",borderRadius:4,background:sc.bg,color:sc.color}}>{sc.label}</span>},
                    {l:"来源",v:<span style={{fontSize:12,padding:"2px 8px",borderRadius:4,background:srcc.bg,color:srcc.color}}>{srcc.label}{req.sourceRef?" · "+req.sourceRef:""}</span>},
                    {l:"负责人",v:req.assignee||"—"},
                    {l:"创建日期",v:req.createdAt},
                  ].map(({l,v},i,arr)=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:0,padding:"12px 18px",borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none"}}>
                      <div style={{width:120,fontSize:13,color:T.t3,flexShrink:0}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:500,color:T.t1}}>{v}</div>
                    </div>
                  ))}
                </div>
                {req.sourceRef&&(
                  <button style={{marginTop:12,display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:8,border:`1px solid ${T.border}`,background:T.bg,cursor:"pointer",fontSize:12,color:TM}}>
                    <ExternalLink size={12}/>{req.source==="jira"?"在 Jira 中查看":req.source==="tapd"?"在禅道中查看":"查看来源"} · {req.sourceRef}
                  </button>
                )}
              </div>
              {/* 需求描述 */}
              <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px"}}>
                <div style={{fontSize:14,fontWeight:600,color:T.t1,marginBottom:12}}>需求描述</div>
                <div style={{fontSize:13,color:T.t2,lineHeight:1.8}}>{req.desc||"暂无描述"}</div>
              </div>
              {/* 关联测试计划 */}
              {rrPlans.length>0&&(
                <div style={{background:"#fff",borderRadius:12,border:`1px solid ${T.border}`,padding:"20px"}}>
                  <div style={{fontSize:14,fontWeight:600,color:T.t1,marginBottom:14}}>关联测试计划</div>
                  <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
                    {rrPlans.map((p,i)=>{
                      const ps=PLAN_STATUS_CFG[p.status];
                      return(
                        <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 18px",borderBottom:i<rrPlans.length-1?`1px solid ${T.border}`:"none"}}>
                          <ClipboardList size={14} style={{color:T.t3,flexShrink:0}}/>
                          <span style={{fontSize:13,color:T.t1,flex:1}}>{p.name}</span>
                          <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:ps.bg,color:ps.color,fontWeight:500}}>{ps.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 追溯缺陷 ── */}
          {dtab==="bugs"&&(
            (!req.linkedBugs||req.linkedBugs.length===0)?(
              <div style={{background:"#fff",borderRadius:12,border:`1.5px dashed ${T.border}`,padding:"48px 24px",textAlign:"center"}}>
                <div style={{fontSize:13,color:T.t3}}>暂无关联缺陷</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {req.linkedBugs.map(b=>{
                  const ss=BUG_SEV_CFG[b.severity]; const bs=BUG_STA_CFG[b.status];
                  return(
                    <div key={b.id} style={{background:"#fff",borderRadius:10,border:`1px solid ${T.border}`,padding:"12px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                        <span style={{fontSize:12,color:T.t3,fontFamily:"monospace"}}>{b.no}</span>
                        <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:ss.bg,color:ss.color,fontWeight:600}}>{ss.label}</span>
                        <span style={{fontSize:12,marginLeft:"auto",color:bs.color,fontWeight:500}}>{bs.label}</span>
                      </div>
                      <div style={{fontSize:14,color:T.t1,fontWeight:500}}>{b.title}</div>
                    </div>
                  );
                })}
              </div>
            )
          )}

        </div>
      </div>
    </div>
  );
}

function NewReqModal({onClose,editReq}:{onClose:()=>void;editReq?:Req|null}){
  const isEdit=!!editReq;
  const [title,setTitle]=useState(editReq?.title||"");
  const [versionId,setVersionId]=useState(editReq?.versionId||"V1");
  const [priority,setPriority]=useState<ReqPriority>((editReq?.priority as ReqPriority)||"P1");
  const [assignee,setAssignee]=useState(editReq?.assignee||"");
  const [desc,setDesc]=useState("");
  const [extRef,setExtRef]=useState(editReq?.sourceRef||"");
  const inputStyle:React.CSSProperties={width:"100%",height:34,padding:"0 10px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box"};
  const labelStyle:React.CSSProperties={display:"block",fontSize:12,color:T.t2,marginBottom:5,fontWeight:500};
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:520,background:"#fff",borderRadius:16,padding:"28px 32px",boxShadow:"0 20px 48px rgba(0,0,0,0.18)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:700,color:T.t1}}>{isEdit?"编辑需求":"新建需求"}</div>
          <button onClick={onClose} style={{width:28,height:28,border:"none",background:"transparent",cursor:"pointer",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:T.t3}}>
            <X size={16}/>
          </button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={labelStyle}>需求标题 <span style={{color:T.danger}}>*</span></label>
            <input style={inputStyle} value={title} onChange={e=>setTitle(e.target.value)} placeholder="请输入需求标题"/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div>
              <label style={labelStyle}>所属版本</label>
              <select style={{...inputStyle}} value={versionId} onChange={e=>setVersionId(e.target.value)}>
                {MOCK_VERSIONS.filter(v=>v.status!=="archived").map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>负责人</label>
              <input style={inputStyle} value={assignee} onChange={e=>setAssignee(e.target.value)} placeholder="请输入负责人姓名"/>
            </div>
          </div>
          <div>
            <label style={labelStyle}>优先级</label>
            <div style={{display:"flex",gap:8}}>
              {(["P0","P1","P2","P3"] as ReqPriority[]).map(p=>{
                const pc=PRIORITY_CFG[p]; const active=priority===p;
                return(
                  <button key={p} onClick={()=>setPriority(p)}
                    style={{height:32,padding:"0 14px",borderRadius:8,border:`1.5px solid ${active?pc.color:T.border}`,background:active?pc.bg:"#fff",color:active?pc.color:T.t2,fontWeight:active?700:400,fontSize:13,cursor:"pointer"}}>
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={labelStyle}>外部需求链接（可选）</label>
            <input style={inputStyle} value={extRef} onChange={e=>setExtRef(e.target.value)} placeholder="如 Jira Issue ID / 禅道需求链接"/>
          </div>
          <div>
            <label style={labelStyle}>需求描述</label>
            <textarea style={{...inputStyle,height:88,padding:"8px 10px",resize:"none"}} value={desc} onChange={e=>setDesc(e.target.value)} placeholder="请输入需求详细描述..."/>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20}}>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn disabled={!title.trim()} onClick={onClose}>{isEdit?"保存修改":"创建需求"}</PBtn>
        </div>
      </div>
    </div>
  );
}

function ImportReqModal({onClose}:{onClose:()=>void}){
  const [src,setSrc]=useState<"jira"|"tapd"|"excel">("jira");
  const [step,setStep]=useState<"config"|"preview">("config");
  const [jiraUrl,setJiraUrl]=useState("");
  const [jiraToken,setJiraToken]=useState("");
  const [jiraProject,setJiraProject]=useState("");
  const [tapdUrl,setTapdUrl]=useState("");
  const [tapdUser,setTapdUser]=useState("");
  const [tapdPass,setTapdPass]=useState("");
  const [tapdProject,setTapdProject]=useState("");
  const [fileName,setFileName]=useState("");
  const fileRef=useRef<HTMLInputElement>(null);
  const inputStyle:React.CSSProperties={width:"100%",height:34,padding:"0 10px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box"};
  const labelStyle:React.CSSProperties={display:"block",fontSize:12,color:T.t2,marginBottom:5,fontWeight:500};
  const PREVIEW_REQS=[
    {id:"PROJ-251",title:"搜索结果排序优化",priority:"P1",type:"功能需求"},
    {id:"PROJ-252",title:"首页 Banner 点击率统计",priority:"P2",type:"数据需求"},
    {id:"PROJ-253",title:"购物车价格实时刷新",priority:"P1",type:"功能需求"},
    {id:"PROJ-254",title:"退款超时自动审批",priority:"P0",type:"功能需求"},
  ];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:560,background:"#fff",borderRadius:16,padding:"28px 32px",boxShadow:"0 20px 48px rgba(0,0,0,0.18)",maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexShrink:0}}>
          <div style={{fontSize:16,fontWeight:700,color:T.t1}}>导入需求</div>
          <button onClick={onClose} style={{width:28,height:28,border:"none",background:"transparent",cursor:"pointer",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:T.t3}}>
            <X size={16}/>
          </button>
        </div>
        {/* Source tabs */}
        <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.border}`,marginBottom:20,flexShrink:0}}>
          {([["jira","Jira"],["tapd","禅道 / TAPD"],["excel","Excel"]] as const).map(([k,l])=>(
            <button key={k} onClick={()=>{setSrc(k);setStep("config");}}
              style={{height:36,padding:"0 16px",fontSize:13,fontWeight:src===k?600:400,border:"none",borderBottom:`2px solid ${src===k?TM:"transparent"}`,background:"transparent",color:src===k?TM:T.t3,cursor:"pointer"}}>
              {l}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflow:"auto"}}>
          {step==="config"&&src==="jira"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={labelStyle}>Jira 服务地址</label><input style={inputStyle} value={jiraUrl} onChange={e=>setJiraUrl(e.target.value)} placeholder="https://your-domain.atlassian.net"/></div>
              <div><label style={labelStyle}>API Token</label><input style={{...inputStyle,fontFamily:"monospace"}} type="password" value={jiraToken} onChange={e=>setJiraToken(e.target.value)} placeholder="请输入 Jira API Token"/></div>
              <div><label style={labelStyle}>项目标识</label><input style={inputStyle} value={jiraProject} onChange={e=>setJiraProject(e.target.value)} placeholder="如 PROJ、MOBILE"/></div>
              <div style={{background:"#FFFBE6",border:"1px solid #FFD666",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#7D6608"}}>
                仅导入状态为「待处理」或「进行中」的需求；关联 Sprint 和 Assignee 信息将自动填充。
              </div>
            </div>
          )}
          {step==="config"&&src==="tapd"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div><label style={labelStyle}>禅道 / TAPD 地址</label><input style={inputStyle} value={tapdUrl} onChange={e=>setTapdUrl(e.target.value)} placeholder="https://your-tapd.zentao.net"/></div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div><label style={labelStyle}>用户名</label><input style={inputStyle} value={tapdUser} onChange={e=>setTapdUser(e.target.value)} placeholder="登录账号"/></div>
                <div><label style={labelStyle}>密码</label><input style={inputStyle} type="password" value={tapdPass} onChange={e=>setTapdPass(e.target.value)} placeholder="登录密码"/></div>
              </div>
              <div><label style={labelStyle}>项目名称</label><input style={inputStyle} value={tapdProject} onChange={e=>setTapdProject(e.target.value)} placeholder="请输入项目名称"/></div>
            </div>
          )}
          {step==="config"&&src==="excel"&&(
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{border:`2px dashed ${T.border}`,borderRadius:12,padding:"32px 24px",textAlign:"center",cursor:"pointer",background:T.bg}}
                onClick={()=>fileRef.current?.click()}
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)setFileName(f.name);}}>
                <Upload size={28} style={{color:T.t4,margin:"0 auto 10px"}}/>
                <div style={{fontSize:14,color:T.t1,fontWeight:500,marginBottom:4}}>{fileName||"点击或拖拽文件至此处"}</div>
                <div style={{fontSize:12,color:T.t3}}>支持 .xlsx · .xls · 文件大小不超过 10MB</div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)setFileName(f.name);}}/>
              </div>
              <button style={{display:"flex",alignItems:"center",gap:6,width:"fit-content",padding:"6px 12px",border:`1px solid ${T.border}`,borderRadius:8,background:"#fff",cursor:"pointer",fontSize:12,color:TM}}>
                <Download size={13}/> 下载导入模板
              </button>
              <div style={{background:"#FFFBE6",border:"1px solid #FFD666",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#7D6608"}}>
                模板必填列：需求标题、优先级（P0-P3）、负责人；版本和描述为选填列。
              </div>
            </div>
          )}
          {step==="preview"&&(
            <div>
              <div style={{fontSize:13,color:T.t2,marginBottom:12}}>已获取 <span style={{fontWeight:600,color:TM}}>{PREVIEW_REQS.length}</span> 条需求，请确认后导入：</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{background:T.bg}}>
                    {["需求编号","标题","优先级","类型"].map(h=>(
                      <th key={h} style={{padding:"8px 10px",textAlign:"left",color:T.t3,fontWeight:500,borderBottom:`1px solid ${T.border}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PREVIEW_REQS.map(r=>{
                    const pc2=PRIORITY_CFG[r.priority as ReqPriority];
                    return(
                      <tr key={r.id} style={{borderBottom:`1px solid ${T.border}`}}>
                        <td style={{padding:"8px 10px",color:T.t3,fontFamily:"monospace"}}>{r.id}</td>
                        <td style={{padding:"8px 10px",color:T.t1}}>{r.title}</td>
                        <td style={{padding:"8px 10px"}}><span style={{fontSize:11,padding:"2px 7px",borderRadius:4,background:pc2.bg,color:pc2.color,fontWeight:600}}>{r.priority}</span></td>
                        <td style={{padding:"8px 10px",color:T.t2}}>{r.type}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20,flexShrink:0,borderTop:`1px solid ${T.border}`,paddingTop:16}}>
          {step==="preview"?(
            <>
              <PBtn variant="ghost" onClick={()=>setStep("config")}>上一步</PBtn>
              <PBtn onClick={onClose}>确认导入 ({PREVIEW_REQS.length})</PBtn>
            </>
          ):(
            <>
              <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
              {src==="excel"?(
                <PBtn disabled={!fileName} onClick={onClose}>开始导入</PBtn>
              ):(
                <PBtn onClick={()=>setStep("preview")}>获取预览</PBtn>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReqList({fromVersionId,onView}:{fromVersionId?:string;onView:(r:Req)=>void}){
  const [reqs]=useState<Req[]>(MOCK_REQS);
  const [showNew,setShowNew]=useState(false);
  const [editReq,setEditReq]=useState<Req|null>(null);
  const [deleteReq,setDeleteReq]=useState<Req|null>(null);
  const [showImport,setShowImport]=useState(false);
  const [showImportDrop,setShowImportDrop]=useState(false);
  const [filterVersion,setFilterVersion]=useState(fromVersionId||"all");
  const [filterStatus,setFilterStatus]=useState("all");
  const [filterPriority,setFilterPriority]=useState("all");
  const [search,setSearch]=useState("");
  const fromVersion=fromVersionId?MOCK_VERSIONS.find(v=>v.id===fromVersionId):null;

  const filtered=reqs.filter(r=>{
    if(filterVersion!=="all"&&r.versionId!==filterVersion) return false;
    if(filterStatus!=="all"&&r.status!==filterStatus) return false;
    if(filterPriority!=="all"&&r.priority!==filterPriority) return false;
    if(search&&!r.title.includes(search)&&!r.id.includes(search)) return false;
    return true;
  });

  const counts={
    total:reqs.length,
    uncovered:reqs.filter(r=>r.status==="uncovered").length,
    partial:reqs.filter(r=>r.status==="partial").length,
    covered:reqs.filter(r=>r.status==="covered").length,
    passed:reqs.filter(r=>r.status==="passed").length,
  };

  const selStyle:React.CSSProperties={height:30,padding:"0 10px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.t2,outline:"none",background:"#fff",cursor:"pointer"};

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {showNew&&<NewReqModal onClose={()=>setShowNew(false)}/>}
      {editReq&&<NewReqModal editReq={editReq} onClose={()=>setEditReq(null)}/>}
      {showImport&&<ImportReqModalV2 onClose={()=>setShowImport(false)}/>}
      {deleteReq&&<DeleteConfirmModal itemName={deleteReq.title} itemType="需求" hasLinked={deleteReq.caseTotal>0} linkedDesc={deleteReq.caseTotal>0?`${deleteReq.caseTotal} 个关联用例`:undefined} onClose={()=>setDeleteReq(null)} onDone={()=>setDeleteReq(null)}/>}
        {/* Version context banner */}
        {fromVersion&&(
          <div style={{background:`${TM}0A`,borderBottom:`1px solid ${TM}30`,padding:"8px 20px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <ChevronLeft size={13} style={{color:TM}}/>
            <span style={{fontSize:12,color:TM,fontWeight:500}}>当前范围：版本</span>
            <span style={{fontSize:12,fontWeight:700,color:TM}}>{fromVersion.name}</span>
            <span style={{fontSize:11,color:T.t3,marginLeft:4}}>· 共 {reqs.filter(r=>r.versionId===fromVersion.id).length} 个版本需求</span>
            <div style={{flex:1}}/>
            <button onClick={()=>setFilterVersion("all")} style={{fontSize:11,color:T.t3,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>查看全部版本</button>
          </div>
        )}
        {/* Stats bar */}
        <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,padding:"10px 20px",display:"flex",gap:6,flexShrink:0}}>
          {([
            {label:"全部",value:counts.total,color:T.t1},
            {label:"未覆盖",value:counts.uncovered,color:"#86909C"},
            {label:"部分覆盖",value:counts.partial,color:T.warning},
            {label:"已覆盖",value:counts.covered,color:TM},
            {label:"测试通过",value:counts.passed,color:T.success},
          ] as const).map(s=>(
            <div key={s.label} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 12px",borderRadius:20,background:T.bg,fontSize:12,color:T.t2}}>
              <span style={{fontWeight:700,color:s.color,fontSize:14}}>{s.value}</span>
              <span>{s.label}</span>
            </div>
          ))}
          <div style={{flex:1}}/>
          <div style={{fontSize:12,color:T.t3,display:"flex",alignItems:"center"}}>
            覆盖率 <span style={{fontWeight:700,color:TM,marginLeft:4}}>{counts.total>0?Math.round(((counts.covered+counts.passed)/counts.total)*100):0}%</span>
          </div>
        </div>
        {/* Filter + Actions */}
        <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,padding:"8px 20px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <div style={{position:"relative",display:"flex",alignItems:"center"}}>
            <Search size={13} style={{position:"absolute",left:8,color:T.t4}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索需求 ID / 标题"
              style={{height:30,width:200,paddingLeft:26,paddingRight:8,border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.t1,outline:"none"}}/>
          </div>
          <select style={selStyle} value={filterVersion} onChange={e=>setFilterVersion(e.target.value)}>
            <option value="all">全部版本</option>
            {MOCK_VERSIONS.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <select style={selStyle} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option value="all">全部状态</option>
            {(Object.entries(REQ_STATUS_CFG) as [ReqStatus,{label:string}][]).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <select style={selStyle} value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}>
            <option value="all">全部优先级</option>
            {(["P0","P1","P2","P3"] as ReqPriority[]).map(p=><option key={p} value={p}>{p}</option>)}
          </select>
          <div style={{flex:1}}/>
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowImportDrop(d=>!d)}
              style={{display:"flex",alignItems:"center",gap:5,height:30,padding:"0 12px",border:`1px solid ${T.border}`,borderRadius:8,background:"#fff",cursor:"pointer",fontSize:12,color:T.t2}}>
              <Upload size={12}/> 导入 <ChevronDown size={11}/>
            </button>
            {showImportDrop&&(
              <div style={{position:"absolute",top:34,right:0,background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,boxShadow:"0 6px 18px rgba(0,0,0,0.1)",zIndex:200,minWidth:130,overflow:"hidden"}}>
                {([["jira","从 Jira 导入"],["tapd","从禅道导入"],["excel","Excel 导入"]] as const).map(([,l])=>(
                  <button key={l} onClick={()=>{setShowImportDrop(false);setShowImport(true);}}
                    style={{display:"block",width:"100%",padding:"9px 14px",border:"none",background:"transparent",cursor:"pointer",textAlign:"left",fontSize:13,color:T.t1}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.bg}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
          <PBtn icon={Plus} onClick={()=>setShowNew(true)}>新建需求</PBtn>
        </div>
        {/* Table */}
        <div style={{flex:1,overflow:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead style={{position:"sticky",top:0,zIndex:10}}>
              <tr style={{background:"#F7F8FA",borderBottom:`1px solid ${T.border}`}}>
                {["需求ID","标题","版本","优先级","来源","用例覆盖","评审","状态","负责人","操作"].map(h=>(
                  <th key={h} style={{padding:"9px 14px",textAlign:"left",fontSize:12,color:T.t3,fontWeight:500,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0&&(
                <tr><td colSpan={10} style={{padding:"48px 0",textAlign:"center",color:T.t4,fontSize:13}}>暂无符合条件的需求</td></tr>
              )}
              {filtered.map(r=>{
                const sc2=REQ_STATUS_CFG[r.status];
                const pc2=PRIORITY_CFG[r.priority];
                const srcc2=REQ_SOURCE_CFG[r.source];
                const ver=MOCK_VERSIONS.find(v=>v.id===r.versionId);
                const coverPct=r.caseTotal>0?Math.round((r.caseCovered/r.caseTotal)*100):0;
                return(
                  <tr key={r.id} onClick={()=>onView(r)}
                    style={{borderBottom:`1px solid ${T.border}`,cursor:"pointer",background:"#fff",transition:"background 0.15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background=T.bg;}}
                    onMouseLeave={e=>{e.currentTarget.style.background="#fff";}}>
                    <td style={{padding:"11px 14px",fontFamily:"monospace",fontSize:12,color:T.t3,whiteSpace:"nowrap"}}>{r.id}</td>
                    <td style={{padding:"11px 14px",maxWidth:220}}>
                      <div style={{fontWeight:500,color:T.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</div>
                      {r.sourceRef&&<div style={{fontSize:11,color:T.t4,marginTop:2,fontFamily:"monospace"}}>{r.sourceRef}</div>}
                    </td>
                    <td style={{padding:"11px 14px",whiteSpace:"nowrap"}}>
                      <span style={{fontSize:12,padding:"2px 8px",borderRadius:6,background:T.bg,color:T.t2}}>{ver?.name||"—"}</span>
                    </td>
                    <td style={{padding:"11px 14px"}}>
                      <span style={{fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:4,background:pc2.bg,color:pc2.color}}>{r.priority}</span>
                    </td>
                    <td style={{padding:"11px 14px"}}>
                      <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:srcc2.bg,color:srcc2.color,fontWeight:500}}>{srcc2.label}</span>
                    </td>
                    <td style={{padding:"11px 14px",minWidth:120}}>
                      {r.caseTotal>0?(
                        <div>
                          <div style={{fontSize:11,color:T.t3,marginBottom:4}}>{r.caseCovered}/{r.caseTotal} 用例 · {coverPct}%</div>
                          <ProgressBar value={r.caseCovered} total={r.caseTotal} height={4}/>
                        </div>
                      ):(
                        <span style={{fontSize:12,color:T.t4}}>尚未关联</span>
                      )}
                    </td>
                    <td style={{padding:"11px 14px"}}>
                      {(()=>{const rc=REQ_REVIEW_CFG[r.reviewStatus];return <StatusBadge label={rc.label} bg={rc.bg} color={rc.color}/>;})()}
                    </td>
                    <td style={{padding:"11px 14px"}}>
                      <StatusBadge label={sc2.label} bg={sc2.bg} color={sc2.color}/>
                    </td>
                    <td style={{padding:"11px 14px",fontSize:12,color:T.t2,whiteSpace:"nowrap"}}>{r.assignee||"—"}</td>
                    <td style={{padding:"11px 14px"}} onClick={e=>e.stopPropagation()}>
                      <div style={{display:"flex",gap:2}}>
                        <IBtn icon={Eye} label="查看详情" onClick={()=>onView(r)}/>
                        <IBtn icon={Link2} label="关联用例"/>
                        <IBtn icon={Edit2} label="编辑" onClick={()=>setEditReq(r)}/>
                        <IBtn icon={Trash2} label="删除" danger onClick={()=>setDeleteReq(r)}/>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN MODULE
// ═══════════════════════════════════════════════════════════════════════════════
type TMView = "list"|"new-plan"|"plan-detail"|"plan-exec"|"version-detail"|"req-detail";

function TmStyles(){
  return(
    <style>{`
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    `}</style>
  );
}

export function TestManagementModule(){
  const [tab,setTab]=useState<"versions"|"reqs"|"plans">("versions");
  const [view,setView]=useState<TMView>("list");
  const [selectedPlan,setSelectedPlan]=useState<TestPlan|null>(null);
  const [selectedVersion,setSelectedVersion]=useState<Version|null>(null);
  const [selectedReq,setSelectedReq]=useState<Req|null>(null);
  const [newPlanFromVersion,setNewPlanFromVersion]=useState<Version|null>(null);
  const [reqsFromVersionId,setReqsFromVersionId]=useState<string|undefined>(undefined);
  const [execInitCaseId,setExecInitCaseId]=useState<string|undefined>(undefined);

  const handleViewReqs=(versionId:string)=>{
    setReqsFromVersionId(versionId);
    setTab("reqs");
    setView("list");
    setSelectedVersion(null);
  };

  const handleExecPlan=(plan:TestPlan,initCaseId?:string)=>{
    setSelectedPlan(plan);
    setExecInitCaseId(initCaseId);
    setView("plan-exec");
  };

  if(view==="new-plan"){
    return <NewTestPlanPage onBack={()=>{setView("list");setNewPlanFromVersion(null);}} defaultVersionId={newPlanFromVersion?.id}/>;
  }
  if(view==="plan-exec"&&selectedPlan){
    return(
      <PlanExecWorkstation
        plan={selectedPlan}
        initCaseId={execInitCaseId}
        allCases={INIT_PLAN_CASES}
        onBack={()=>{setView("plan-detail");setExecInitCaseId(undefined);}}/>
    );
  }
  if(view==="plan-detail"&&selectedPlan){
    const fromVer=selectedPlan.versionId?MOCK_VERSIONS.find(v=>v.id===selectedPlan.versionId):undefined;
    return(
      <TestPlanDetail plan={selectedPlan} fromVersion={fromVer}
        onExecCase={(caseId)=>handleExecPlan(selectedPlan,caseId)}
        onBack={()=>{
          if(selectedVersion&&fromVer?.id===selectedVersion.id){setView("version-detail");}
          else{setView("list");setSelectedPlan(null);}
        }}/>
    );
  }
  if(view==="version-detail"&&selectedVersion){
    return(
      <VersionDetail version={selectedVersion}
        onBack={()=>{setView("list");setSelectedVersion(null);}}
        onNewPlan={()=>{setNewPlanFromVersion(selectedVersion);setView("new-plan");}}
        onViewPlan={p=>{setSelectedPlan(p);setView("plan-detail");}}
        onViewReqs={handleViewReqs}/>
    );
  }
  if(view==="req-detail"&&selectedReq){
    return(
      <ReqDetail req={selectedReq}
        onBack={()=>{setView("list");setSelectedReq(null);}}/>
    );
  }

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <TmStyles/>
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",alignItems:"center",padding:"0 20px",height:44}}>
        {([["versions","版本管理"],["reqs","需求管理"],["plans","测试计划"]] as const).map(([k,l])=>(
          <button key={k} onClick={()=>{setTab(k);setView("list");if(k!=="reqs")setReqsFromVersionId(undefined);}}
            style={{height:"100%",padding:"0 16px",fontSize:13,fontWeight:tab===k?600:400,border:"none",borderBottom:`2px solid ${tab===k?TM:"transparent"}`,background:"transparent",color:tab===k?TM:T.t3,cursor:"pointer"}}>
            {l}
          </button>
        ))}
      </div>
      {tab==="versions"&&(
        <VersionList onView={v=>{setSelectedVersion(v);setView("version-detail");}}/>
      )}
      {tab==="reqs"&&(
        <ReqList fromVersionId={reqsFromVersionId}
          onView={r=>{setSelectedReq(r);setView("req-detail");}}/>
      )}
      {tab==="plans"&&(
        <TestPlanList
          onView={p=>{setSelectedPlan(p);setView("plan-detail");}}
          onNew={()=>{setNewPlanFromVersion(null);setView("new-plan");}}
          onExec={p=>handleExecPlan(p)}/>
      )}
    </div>
  );
}
