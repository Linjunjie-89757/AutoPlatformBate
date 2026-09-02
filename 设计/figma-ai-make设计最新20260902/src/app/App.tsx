import React, { useState, useEffect } from "react";
import { SceneManagement, SuiteManagement } from "./ApiSceneModule";
import { SceneExtrasShowcase } from "./ApiSceneExtras";
import { TaskModule } from "./TaskModule";
import { SettingsModule } from "./SettingsModule";
import { WebUIModule, ReportRecord, ReportListPage, ReportDetailPage, ShareReportPage } from "./WebUIModule";
import { WebUIPhase2Showcase } from "./WebUIExtras2";
import { BugsModule } from "./BugsModule";
import { TestManagementModule } from "./TestManagementModule";
import { LoginPage } from "./LoginPage";
import { AiPoolModule } from "./AiPoolModule";
import { NotifModule } from "./NotifModule";
import { RunnerModule } from "./RunnerModule";
import { OverviewModule } from "./OverviewModule";
import { EnvConfigPage } from "./EnvConfigModule";
import { MockServicePage } from "./MockConfigModule";
import { VarConfigPage } from "./VarConfigModule";
import { AICaseGenPage } from "./AICaseModule";
import { ProfileModule } from "./ProfileModule";
import { PlatformAdminModule } from "./PlatformAdminModule";
import { ApiCaseTab } from "./ApiCaseTab";
import { ApiAiCaseWorkbench } from "./ApiAiCaseWorkbench";
import { ApiAiGenerationDrawer } from "./ApiAiGenerationDrawer";
import { SaveApiDialog, ImportApiDialog, EnvDetailDrawer, AuthConfigSection, UnsavedConfirmDialog, SettingsPanel, RequestSendStatePanel, BinaryBodyPanel, JsonSchemaPanel } from "./ApiWorkbenchExtras";
import {
  Database, Globe, Hash, Bell, Server, Bot, Search, Plus, Edit2, Trash2,
  Eye, TestTube, Lock, Check, Clock,
  CheckCircle, XCircle, FlaskConical, LogOut, ChevronDown, FileText, Zap,
  Monitor, Bug, Shield, Link2, LayoutDashboard, Settings, LayoutGrid,
  ChevronRight, Activity, ArrowUpRight, Folder, FolderOpen,
  Play, Save, Upload, X, GripVertical, Sparkles, RefreshCw,
  Code2, Smartphone, ChevronLeft, Layers, ThumbsUp, ThumbsDown, Power, Send, AlertTriangle,
  MousePointer, Type, Timer, Camera, Variable, Globe2, Copy, ArrowUp, ArrowDown,
  ClipboardList, ClipboardCheck, Share2, Download, ExternalLink, Minus, Filter,
  Video, Pause, Square, SkipForward, RotateCcw, PlusCircle,
  User, KeyRound, SlidersHorizontal, Bell as BellIcon, Palette, LogIn, ShieldAlert,
  Sun, Moon, HelpCircle, BookOpen, Keyboard, MessageSquare,
  MoreHorizontal, FolderPlus, Pencil, AlertCircle,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

// ─── Palette ──────────────────────────────────────────────────────────────────

const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  cyan:"#0FC6C2",
  slate:"#4E5969",   bg:"#F4F6FA",      border:"#E5E6EB",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};

// Dark-mode shell palette
const DK = {
  bg:"#0F1117", surface:"#1A1D27", surface2:"#22263A",
  border:"rgba(255,255,255,0.08)", t1:"#E8EAED", t2:"#A0AABE", t3:"#636B8A", t4:"#3A4060",
};

// Sample notification data
const NOTIFS = [
  { id:"n1", type:"bug",    read:false, title:"新 P0 缺陷待处理",   desc:"登录接口 500 错误 — 分配给你",       time:"5分钟前",  color:"#F53F3F" },
  { id:"n2", type:"ai",     read:false, title:"AI 用例已生成",      desc:"「支付流程」模块生成 28 条用例待审",  time:"23分钟前", color:"#7816FF" },
  { id:"n3", type:"plan",   read:false, title:"测试计划截止提醒",   desc:"「V3.2.0 回归」今日截止",            time:"1小时前",  color:"#FF7D00" },
  { id:"n4", type:"pass",   read:true,  title:"构建执行完成",       desc:"夜间回归 · 通过率 93.6%",            time:"昨天",     color:"#00B42A" },
  { id:"n5", type:"member", read:true,  title:"成员加入工作区",     desc:"李明 已加入「X-MAN」工作区",          time:"昨天",     color:"#165DFF" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

// Flat nav key — module prefix determines content
type ActiveNav =
  | "overview"
  | "config" | "config-db" | "config-env" | "config-param" | "config-notif" | "config-runner" | "config-ai"
  | "profile"
  | "cases-list" | "cases-ai-gen" | "cases-records" | "cases-ai-cfg"
  | "bugs" | "testmgmt" | "api" | "webui" | "app" | "tasks" | "reports" | "settings"
  | "config-mock" | "platform-admin";

type ModalType  = "db"|"ai"|"notif"|"env"|"param"|"runner"|"case"|null;
type NotifSub   = "channels"|"rules"|"history";
type ApiPage    = "workbench"|"scenarios"|"suites"|"reports";
type HttpMethod = "GET"|"POST"|"PUT"|"DELETE"|"PATCH";
type Priority   = "P0"|"P1"|"P2"|"P3"|"P4";
type CaseStatus = "confirmed"|"pending"|"discarded";
type ExecStatus = "passed"|"failed"|"blocked"|"not-run";
type ReviewStatus = "pending"|"reviewing"|"passed"|"rejected";
type AiTaskStatus = "completed"|"reviewing"|"generating"|"failed";
type AdoptStatus  = "adopted"|"discarded"|"pending"|"adopting"|"adopt_failed";

interface TestCase { id:string; title:string; directory:string; type:string; priority:Priority; status:CaseStatus; execStatus:ExecStatus; defects:number; creator:string; updatedAt:string; source:"manual"|"ai"; steps:string[]; expected:string; precondition:string; reviewStatus:ReviewStatus; reviewer?:string; reviewedAt?:string; reviewComment?:string; }
interface AiTask { id:string; requirement:string; directory:string; project:string; status:AiTaskStatus; generated:number; reviewed:number; adopted:number; model:string; reviewModel:string; createdAt:string; operator:string; }
type AiReviewStatus = "approved"|"rejected"|"change_suggested"|"confirm_required"|"pending";
interface CaseContent { title:string; steps:string[]; expected:string; precondition:string; }
interface AiGenCase { id:string; priority:Priority; type:string; angle:string; reason:string; requirementBasis:string; risk:string; reviewStatus:AiReviewStatus; reviewReason:string; suggestion:string; adoptStatus:AdoptStatus; adoptFailReason?:string; isSupplemented?:boolean; originalCase:CaseContent; suggestedCase?:CaseContent; }
interface DbRecord { id:number; name:string; type:string; jdbc:string; username:string; status:"enabled"|"disabled"; createdAt:string; lastTestResult:"success"|"failed"|null; lastTestAt:string; }
interface AiRecord { id:number; name:string; provider:string; model:string; apiUrl:string; apiKeySet:boolean; supportsImage:boolean; status:"enabled"|"disabled"; isGenerateModel:boolean; isReviewModel:boolean; updatedAt:string; }
interface EnvRecord { id:number; name:string; identifier:string; baseUrl:string; status:"enabled"|"disabled"; description:string; updatedAt:string; }
interface ParamRecord { id:number; name:string; value:string; type:string; scope:string; sensitive:boolean; status:"enabled"|"disabled"; updatedAt:string; }
interface RunnerRecord { id:number; name:string; host:string; status:"online"|"offline"; lastHeartbeat:string; currentTask:string|null; capabilities:string[]; version:string; }
interface NotifChannel { id:number; name:string; type:string; webhook:string; status:"enabled"|"disabled"; lastSendAt:string; lastSendResult:"success"|"failed"|null; }
interface NotifRule { id:number; name:string; event:string; channel:string; status:"enabled"|"disabled"; createdAt:string; }
interface NotifHistory { id:number; channel:string; event:string; result:"success"|"failed"; sentAt:string; message:string; }
interface ApiEndpoint { id:string; name:string; method:HttpMethod; path:string; }
interface ApiFolder { id:string; name:string; count:number; expanded:boolean; items:ApiEndpoint[]; }
interface Scenario { id:number; name:string; priority:"P0"|"P1"|"P2"; status:"enabled"|"disabled"; lastResult:"pass"|"fail"|null; module:string; env:string; tags:string[]; }
interface ScenarioStep { id:number; enabled:boolean; type:"api"|"scene"|"action"; typeName:string; method?:HttpMethod; name:string; }
interface Suite { id:number; name:string; desc:string; priority:"P1"|"P2"; module:string; lastResult:"pass"|"fail"|null; lastRun:string; updatedAt:string; }
interface SuiteStep { id:number; name:string; }

// ─── Mock data ────────────────────────────────────────────────────────────────

const CASES: TestCase[] = [
  {id:"Case-00-04",title:"正常提交问题描述且内容超过一定限制后提交按钮灰化",directory:"功能测试/订单中心",type:"功能",priority:"P1",status:"confirmed",execStatus:"not-run",defects:0,creator:"张程远",updatedAt:"2026-01-15 17:21",source:"manual",steps:["进入订单提交页","输入超过1000字的描述","点击提交按钮"],expected:"提交按钮变为灰色不可点击状态",precondition:"已登录系统，已有订单草稿",reviewStatus:"passed",reviewer:"李明",reviewedAt:"2026-01-16 10:30",reviewComment:"用例步骤清晰，预期结果明确，通过。"},
  {id:"Case-01-40",title:"订单中心-下单流程-正常用户完整下单",directory:"功能测试/订单中心",type:"功能",priority:"P0",status:"confirmed",execStatus:"passed",defects:0,creator:"李明",updatedAt:"2026-01-14 10:30",source:"manual",steps:["用户登录","选择商品","填写收货信息","完成支付"],expected:"订单状态变为已付款，库存减少",precondition:"测试账号余额充足，商品库存大于0",reviewStatus:"passed",reviewer:"王芳",reviewedAt:"2026-01-14 15:00"},
  {id:"Case-02-13",title:"空白列表页面的空态展示是否正确",directory:"功能测试/用户中心",type:"功能",priority:"P2",status:"confirmed",execStatus:"not-run",defects:0,creator:"王芳",updatedAt:"2026-01-13 14:50",source:"ai",steps:["登录系统","清空用户列表","访问用户列表页"],expected:"展示空态图和提示文字",precondition:"管理员账号",reviewStatus:"reviewing"},
  {id:"Case-03-25",title:"获客中心-产品新增-必填字段校验",directory:"功能测试/获客中心",type:"功能",priority:"P1",status:"confirmed",execStatus:"failed",defects:2,creator:"张程远",updatedAt:"2026-01-12 09:15",source:"manual",steps:["打开新增产品表单","不填任何字段","点击保存"],expected:"各必填字段显示红色错误提示",precondition:"测试环境正常",reviewStatus:"rejected",reviewer:"陈伟",reviewedAt:"2026-01-12 16:20",reviewComment:"缺少边界值场景：单个字段为空、全部为空需分别覆盖，步骤 3 预期结果描述不够具体，建议补充后重新提交。"},
  {id:"Case-04-07",title:"系统并发用户数达到上限时的处理",directory:"功能测试/风控中心",type:"性能",priority:"P0",status:"pending",execStatus:"not-run",defects:0,creator:"陈伟",updatedAt:"2026-01-11 16:40",source:"ai",steps:["模拟1000并发用户","同时访问系统","观察系统响应"],expected:"超出上限时返回503，已有用户不受影响",precondition:"性能测试环境就绪",reviewStatus:"pending"},
  {id:"Case-05-31",title:"风控规则-黑名单命中-实时拦截",directory:"功能测试/风控中心",type:"功能",priority:"P1",status:"confirmed",execStatus:"passed",defects:0,creator:"李明",updatedAt:"2026-01-10 11:20",source:"manual",steps:["将用户加入黑名单","该用户尝试下单","检查拦截结果"],expected:"下单请求被实时拦截，返回拦截提示",precondition:"黑名单功能已开启",reviewStatus:"passed",reviewer:"王芳",reviewedAt:"2026-01-10 17:00"},
  {id:"Case-06-18",title:"订单退款流程-超时申请不允许退款",directory:"功能测试/订单中心",type:"功能",priority:"P1",status:"confirmed",execStatus:"not-run",defects:0,creator:"王芳",updatedAt:"2026-01-09 15:30",source:"manual",steps:["选择超出退款时间的订单","点击申请退款"],expected:"系统提示退款申请已过期，操作不可进行",precondition:"有一笔超出退款期限的已完成订单",reviewStatus:"reviewing"},
  {id:"Case-07-44",title:"用户登录-错误密码超次数锁定",directory:"功能测试/用户中心",type:"安全",priority:"P0",status:"confirmed",execStatus:"passed",defects:0,creator:"陈伟",updatedAt:"2026-01-08 13:10",source:"manual",steps:["连续输入错误密码5次","第6次尝试登录"],expected:"账号被锁定15分钟，显示锁定提示",precondition:"测试账号正常状态",reviewStatus:"passed",reviewer:"张程远",reviewedAt:"2026-01-08 18:00"},
];

const AI_TASKS: AiTask[] = [
  {id:"TSK_4G14M7T3O0",requirement:"订单中心-下单主流程验证新增加新增加中...",directory:"X-MAN",project:"X-MAN",status:"completed",generated:36,reviewed:36,adopted:28,model:"gpt-4o",reviewModel:"claude-3-5-sonnet",createdAt:"2026-05-15 15:21",operator:"张程远"},
  {id:"TSK_M7T3O04G14",requirement:"用户中心-注册登录功能",directory:"X-MAN",project:"X-MAN",status:"completed",generated:14,reviewed:14,adopted:11,model:"gpt-4o",reviewModel:"claude-3-5-sonnet",createdAt:"2026-05-15 11:05",operator:"张程远"},
  {id:"TSK_NACM74U2L0",requirement:"获客中心-产品管理CRUD流程",directory:"X-MAN",project:"X-MAN",status:"completed",generated:14,reviewed:14,adopted:13,model:"gpt-4o",reviewModel:"claude-3-5-sonnet",createdAt:"2026-05-14 14:37",operator:"李明"},
  {id:"TSK_A7FHNBC233",requirement:"风控中心-黑白名单管理闭环",directory:"X-MAN",project:"X-MAN",status:"completed",generated:8,reviewed:8,adopted:7,model:"gpt-4o",reviewModel:"claude-3-5-sonnet",createdAt:"2026-05-14 10:22",operator:"李明"},
  {id:"TSK_T3O04G14M7",requirement:"订单-退款超时校验流程",directory:"X-MAN",project:"X-MAN",status:"reviewing",generated:12,reviewed:6,adopted:0,model:"gpt-4o",reviewModel:"claude-3-5-sonnet",createdAt:"2026-05-13 17:10",operator:"王芳"},
  {id:"TSK_AB8B2C3D4E",requirement:"系统并发压测方案",directory:"X-MAN",project:"X-MAN",status:"failed",generated:0,reviewed:0,adopted:0,model:"gpt-4o",reviewModel:"claude-3-5-sonnet",createdAt:"2026-05-13 09:05",operator:"陈伟"},
];

const AI_GEN_CASES: AiGenCase[] = [
  {
    id:"G001", priority:"P0", type:"功能", angle:"主流程",
    reason:"需求文档第3节描述了完整的下单支付主流程，此为核心业务路径，必须覆盖。",
    requirementBasis:"PRD §3.1 用户下单流程", risk:"未覆盖会导致核心业务流程无测试保障",
    reviewStatus:"approved",
    reviewReason:"该用例覆盖了需求中的完整主流程，步骤清晰，预期结果明确，采纳价值高。",
    suggestion:"可补充不同支付方式（微信、支付宝、银行卡）的子场景。",
    adoptStatus:"pending",
    originalCase:{
      title:"正常用户完整下单流程-标准支付路径",
      precondition:"测试账号余额充足，商品库存大于0",
      steps:["用户登录系统","选择商品并加入购物车","确认订单信息","选择支付方式完成支付","确认订单状态变为已付款"],
      expected:"订单创建成功，库存减少，用户收到下单成功通知"
    },
  },
  {
    id:"G002", priority:"P1", type:"异常", angle:"边界条件",
    reason:"库存为0时继续下单是典型的边界场景，需要验证系统的库存扣减和并发控制。",
    requirementBasis:"PRD §3.2 库存管理规则", risk:"如不测试可能导致超卖问题",
    reviewStatus:"change_suggested",
    reviewReason:"原用例步骤缺少并发场景覆盖，且预期结果描述过于简单，建议按以下优化版本修改后采纳。",
    suggestion:"建议补充并发抢购时库存竞争条件的覆盖，并明确提示文案的精确描述。",
    adoptStatus:"pending",
    originalCase:{
      title:"商品库存不足时下单提示",
      precondition:"测试账号正常登录",
      steps:["选择库存为0的商品","尝试加入购物车","点击立即购买"],
      expected:"系统提示商品已售罄，无法加入购物车"
    },
    suggestedCase:{
      title:"商品库存不足时下单全链路提示验证",
      precondition:"测试账号正常登录，目标商品库存已设为0",
      steps:["选择库存为0的商品进入详情页","验证详情页库存状态展示","尝试点击加入购物车按钮","尝试点击立即购买按钮","验证购物车及结算页面的库存校验提示"],
      expected:"详情页显示库存不足标识；加入购物车和立即购买均被禁用或给出明确提示；结算时再次校验并阻止下单，提示文案与PRD §3.2规定一致"
    },
  },
  {
    id:"G003", priority:"P1", type:"安全", angle:"安全边界",
    reason:"支付金额超出单笔限额时需要触发风控拦截，这是重要的安全测试点。",
    requirementBasis:"PRD §5.1 支付风控规则", risk:"未测试可能导致超额支付漏洞",
    reviewStatus:"rejected",
    reviewReason:"该用例的步骤描述不够具体，缺少明确的金额阈值，且与实际系统的风控规则可能不符，建议修改后重新提交。",
    suggestion:"需要明确单笔支付限额的具体数值（如¥50,000），并确认风控规则的触发条件及拦截提示文案。",
    adoptStatus:"discarded",
    originalCase:{
      title:"超大金额订单的支付限额拦截",
      precondition:"测试环境风控规则已开启",
      steps:["构造金额超过10万的订单","尝试提交订单并支付"],
      expected:"系统触发风控，提示超出支付限额"
    },
  },
  {
    id:"G004", priority:"P2", type:"功能", angle:"数据一致性",
    reason:"需求文档中订单取消的库存回滚逻辑描述不够明确，需确认回滚时机和精度要求。",
    requirementBasis:"PRD §3.4 订单取消规则", risk:"需求不明确可能导致实现与预期不一致",
    reviewStatus:"confirm_required",
    reviewReason:"PRD §3.4 中未明确说明取消订单后库存回滚的触发时机（是立即回滚还是等待超时），以及库存回滚失败时的处理机制，建议与产品确认后再采纳此用例。",
    suggestion:"请确认：①库存回滚是同步还是异步？②回滚失败是否有重试机制？确认后可直接采纳。",
    adoptStatus:"pending",
    originalCase:{
      title:"订单取消后库存自动回滚",
      precondition:"有一笔已提交但未发货的订单，初始库存已记录",
      steps:["用户提交订单后记录库存数量","用户申请取消订单","系统确认取消","检查库存数量变化"],
      expected:"库存自动回滚到取消前的数量，差值精确"
    },
  },
  {
    id:"G005", priority:"P1", type:"功能", angle:"异常场景",
    reason:"AI评审过程中发现需求对支付超时场景缺乏覆盖，主动补充此用例。",
    requirementBasis:"PRD §3.3 支付超时处理", risk:"超时场景未覆盖可能导致订单状态异常",
    reviewStatus:"approved",
    reviewReason:"该补充用例填补了支付超时场景的覆盖缺口，逻辑完整，建议直接采纳。",
    suggestion:"可进一步补充不同支付渠道的超时时长差异验证。",
    adoptStatus:"pending",
    isSupplemented:true,
    originalCase:{
      title:"支付超时后订单自动取消验证",
      precondition:"测试账号已下单但未完成支付，系统支付超时配置为15分钟",
      steps:["用户提交订单进入支付页面","等待超过15分钟不进行支付操作","检查订单状态","检查库存是否已回滚","验证用户收到的超时通知"],
      expected:"订单状态自动变为已取消，库存回滚，用户收到超时取消通知"
    },
  },
];

const DB_DATA: DbRecord[] = [
  {id:1,name:"prod-mysql-main",type:"MySQL",jdbc:"jdbc:mysql://prod-db.internal:3306/testdb",username:"testuser",status:"enabled",createdAt:"2025-03-15",lastTestResult:"success",lastTestAt:"2025-05-20 14:30"},
  {id:2,name:"test-postgres-qa",type:"PostgreSQL",jdbc:"jdbc:postgresql://test-db:5432/qa_main",username:"qa_user",status:"enabled",createdAt:"2025-04-22",lastTestResult:"success",lastTestAt:"2025-05-20 09:15"},
  {id:3,name:"staging-oracle",type:"Oracle",jdbc:"jdbc:oracle:thin:@staging-db:1521:orcl",username:"staging_user",status:"disabled",createdAt:"2025-01-10",lastTestResult:"failed",lastTestAt:"2025-05-18 16:45"},
  {id:4,name:"dw-clickhouse",type:"ClickHouse",jdbc:"jdbc:clickhouse://dw.internal:8123/analytics",username:"readonly",status:"enabled",createdAt:"2025-02-01",lastTestResult:"success",lastTestAt:"2025-05-19 11:00"},
];
const AI_CONN_DATA: AiRecord[] = [
  {id:1,name:"GPT-4o 生成模型",provider:"OpenAI",model:"gpt-4o",apiUrl:"https://api.openai.com/v1",apiKeySet:true,supportsImage:true,status:"enabled",isGenerateModel:true,isReviewModel:false,updatedAt:"2025-05-10"},
  {id:2,name:"Claude 3.5 评审模型",provider:"Anthropic",model:"claude-3-5-sonnet-20241022",apiUrl:"https://api.anthropic.com",apiKeySet:true,supportsImage:true,status:"enabled",isGenerateModel:false,isReviewModel:true,updatedAt:"2025-05-15"},
  {id:3,name:"通义千问-Max",provider:"阿里云百炼",model:"qwen-max",apiUrl:"https://dashscope.aliyuncs.com/compatible-mode/v1",apiKeySet:false,supportsImage:false,status:"disabled",isGenerateModel:false,isReviewModel:false,updatedAt:"2025-04-20"},
];
const ENV_DATA: EnvRecord[] = [
  {id:1,name:"生产环境",identifier:"prod",baseUrl:"https://api.company.com",status:"enabled",description:"生产主站接口，只读",updatedAt:"2025-05-01"},
  {id:2,name:"测试环境",identifier:"test",baseUrl:"https://test-api.company.com",status:"enabled",description:"QA 日常测试，最常用",updatedAt:"2025-05-18"},
  {id:3,name:"预发布环境",identifier:"staging",baseUrl:"https://staging-api.company.com",status:"enabled",description:"上线前回归验证",updatedAt:"2025-05-05"},
  {id:4,name:"开发环境",identifier:"dev",baseUrl:"http://dev-api.internal:8080",status:"disabled",description:"开发联调，不稳定",updatedAt:"2025-04-28"},
];
const PARAM_DATA: ParamRecord[] = [
  {id:1,name:"DEFAULT_TIMEOUT",value:"30000",type:"Integer",scope:"全局",sensitive:false,status:"enabled",updatedAt:"2025-05-10"},
  {id:2,name:"API_SECRET_KEY",value:"sk-••••••••••••",type:"String",scope:"全局",sensitive:true,status:"enabled",updatedAt:"2025-05-15"},
  {id:3,name:"RETRY_COUNT",value:"3",type:"Integer",scope:"接口自动化",sensitive:false,status:"enabled",updatedAt:"2025-04-20"},
];
const RUNNER_DATA: RunnerRecord[] = [
  {id:1,name:"runner-prod-01",host:"10.0.1.101",status:"online",lastHeartbeat:"5 秒前",currentTask:"任务 #1432 · 订单接口回归",capabilities:["接口","Web UI"],version:"2.4.1"},
  {id:2,name:"runner-prod-02",host:"10.0.1.102",status:"online",lastHeartbeat:"12 秒前",currentTask:null,capabilities:["接口"],version:"2.4.1"},
  {id:3,name:"runner-test-01",host:"10.0.2.201",status:"offline",lastHeartbeat:"2 小时前",currentTask:null,capabilities:["接口"],version:"2.3.8"},
];
const NOTIF_CHANNELS: NotifChannel[] = [
  {id:1,name:"QA 团队机器人",type:"企业微信",webhook:"https://qyapi.weixin.qq.com/...",status:"enabled",lastSendAt:"2025-05-20 14:30",lastSendResult:"success"},
  {id:2,name:"故障告警机器人",type:"钉钉",webhook:"https://oapi.dingtalk.com/...",status:"enabled",lastSendAt:"2025-05-20 10:15",lastSendResult:"success"},
  {id:3,name:"邮件通知",type:"邮件",webhook:"smtp://mail.company.com:465",status:"disabled",lastSendAt:"2025-05-15 09:00",lastSendResult:"failed"},
];
const NOTIF_RULES: NotifRule[] = [
  {id:1,name:"用例执行失败告警",event:"用例执行失败",channel:"故障告警机器人",status:"enabled",createdAt:"2025-01-01"},
  {id:2,name:"每日测试报告",event:"定时报告",channel:"QA 团队机器人",status:"enabled",createdAt:"2025-01-15"},
  {id:3,name:"新增缺陷通知",event:"缺陷创建",channel:"QA 团队机器人",status:"disabled",createdAt:"2025-02-20"},
];
const NOTIF_HISTORY: NotifHistory[] = [
  {id:1,channel:"故障告警机器人",event:"用例执行失败",result:"success",sentAt:"2025-05-20 14:30:12",message:"用例「用户登录-异常密码」执行失败，任务 #1428"},
  {id:2,channel:"QA 团队机器人",event:"定时报告",result:"success",sentAt:"2025-05-20 09:00:05",message:"今日报告：执行 236 条，通过 221 条，失败 15 条"},
  {id:3,channel:"邮件通知",event:"缺陷创建",result:"failed",sentAt:"2025-05-19 17:45:33",message:"SMTP 连接超时"},
];
const TREND_DATA = [{day:"5/14",成功:12,失败:2},{day:"5/15",成功:18,失败:1},{day:"5/16",成功:15,失败:3},{day:"5/17",成功:22,失败:0},{day:"5/18",成功:19,失败:4},{day:"5/19",成功:25,失败:1},{day:"5/20",成功:21,失败:2}];
const API_FOLDERS: ApiFolder[] = [
  {id:"f1",name:"订单中心管理端",count:204,expanded:true,items:[{id:"e1",name:"获取订单列表",method:"GET",path:"/api/v1/orders"},{id:"e2",name:"创建订单",method:"POST",path:"/api/v1/orders"},{id:"e3",name:"更新订单状态",method:"PUT",path:"/api/v1/orders/{id}/status"}]},
  {id:"f2",name:"用户中心",count:67,expanded:false,items:[{id:"e5",name:"获取用户信息",method:"GET",path:"/api/v1/users/{id}"},{id:"e6",name:"用户注册",method:"POST",path:"/api/v1/users/register"}]},
  {id:"f3",name:"获客中心",count:65,expanded:false,items:[{id:"e8",name:"获取产品列表",method:"GET",path:"/api/v1/products"},{id:"e9",name:"新增产品",method:"POST",path:"/api/v1/products"}]},
];
const SCENARIOS = [{id:100078,name:"产品管理-新增编辑停用删除闭环",priority:"P1" as const,status:"enabled" as const,lastResult:"pass" as const,module:"获客中心",env:"测试环境",tags:["CRUD闭环","Codex生成"]},{id:100077,name:"白名单管理-新增编辑解除编辑停用删除闭环",priority:"P1" as const,status:"enabled" as const,lastResult:"pass" as const,module:"获客中心",env:"测试环境",tags:["CRUD闭环"]},{id:100076,name:"黑名单管理-新增编辑解除编辑停用删除闭环",priority:"P1" as const,status:"enabled" as const,lastResult:"fail" as const,module:"获客中心",env:"预发布",tags:[]},{id:100074,name:"页面管理-新增编辑停用删除闭环",priority:"P1" as const,status:"enabled" as const,lastResult:"pass" as const,module:"获客中心",env:"测试环境",tags:["CRUD闭环"]}];
const SCENARIO_STEPS = [{id:1,enabled:true,type:"scene" as const,typeName:"引用场景",name:"登录"},{id:2,enabled:true,type:"action" as const,typeName:"新卡片行",name:"生成本次测试数据"},{id:3,enabled:true,type:"api" as const,typeName:"复制 API",method:"POST" as const,name:"POST 新增产品"},{id:4,enabled:true,type:"api" as const,typeName:"复制 API",method:"POST" as const,name:"POST 查询并提取ID"},{id:5,enabled:true,type:"api" as const,typeName:"复制 API",method:"PUT" as const,name:"PUT 编辑产品"},{id:6,enabled:true,type:"api" as const,typeName:"复制 API",method:"DELETE" as const,name:"DELETE 删除产品"}];
const SUITES: Suite[] = [{id:1,name:"风控中心-回归套件",desc:"覆盖风控中心已确认的只读查询场景。",priority:"P1",module:"风控中心",lastResult:"pass",lastRun:"2026-07-03 13:38",updatedAt:"2026-07-03 17:25"},{id:2,name:"获客中心-回归套件",desc:"覆盖获客中心已确认的只读查询场景。",priority:"P1",module:"获客中心",lastResult:"fail",lastRun:"2026-07-03 17:00",updatedAt:"2026-07-03 17:00"},{id:3,name:"订单中心-回归套件",desc:"覆盖订单中心菜单查询与低风险新增编辑闭环场景。",priority:"P1",module:"订单中心",lastResult:"fail",lastRun:"2026-07-03 13:25",updatedAt:"2026-07-03 13:38"}];
const SUITE_STEPS = [{id:1,name:"账号信息"},{id:2,name:"直播报备"},{id:3,name:"直播监控"},{id:4,name:"风控统计"},{id:5,name:"订单统计"},{id:6,name:"投诉复盘"}];
const MOCK_RESPONSE_JSON = `{\n  "code": 0,\n  "message": "success",\n  "data": {\n    "list": [\n      {"id": 1001, "orderId": "ORD-001", "amount": 299.00, "status": "completed"},\n      {"id": 1002, "orderId": "ORD-002", "amount": 156.50, "status": "pending"}\n    ],\n    "total": 48, "page": 1, "pageSize": 20\n  }\n}`;
const ASSERT_ROWS = [{path:"$.code",op:"等于",expected:"0",result:"pass",actual:"0"},{path:"$.message",op:"等于",expected:"success",result:"pass",actual:"success"},{path:"$.data.total",op:"大于等于",expected:"1",result:"pass",actual:"48"}];

// ─── Priority / Status helpers ────────────────────────────────────────────────

const PRIORITY_STYLE: Record<Priority,{bg:string;color:string}> = {
  P0:{bg:"#F53F3F",color:"#fff"},P1:{bg:"#FF7D00",color:"#fff"},
  P2:{bg:"#FAAD14",color:"#fff"},P3:{bg:"#165DFF",color:"#fff"},P4:{bg:"#C9CDD4",color:"#4E5969"},
};

const CASE_STATUS_STYLE: Record<CaseStatus,{bg:string;color:string;label:string}> = {
  confirmed:{bg:"#E8FFEA",color:"#00B42A",label:"已确认"},
  pending:  {bg:"#FFF3E8",color:"#FF7D00",label:"待确认"},
  discarded:{bg:"#F2F3F5",color:"#86909C",label:"已废弃"},
};

const REVIEW_STATUS_STYLE: Record<ReviewStatus,{bg:string;color:string;label:string;dot:string}> = {
  pending:  {bg:"#F2F3F5",  color:"#86909C",label:"待评审",dot:"#C9CDD4"},
  reviewing:{bg:"#E8F3FF",  color:"#165DFF",label:"评审中",dot:"#165DFF"},
  passed:   {bg:"#E8FFEA",  color:"#00B42A", label:"已通过",dot:"#00B42A"},
  rejected: {bg:"#FFE8E8",  color:"#F53F3F", label:"已驳回",dot:"#F53F3F"},
};

const EXEC_STATUS_STYLE: Record<ExecStatus,{dot:string;label:string;color:string}> = {
  passed:  {dot:"#00B42A",label:"通过",  color:"#00B42A"},
  failed:  {dot:"#F53F3F",label:"失败",  color:"#F53F3F"},
  blocked: {dot:"#FF7D00",label:"阻塞",  color:"#FF7D00"},
  "not-run":{dot:"#C9CDD4",label:"未执行",color:"#86909C"},
};

const AI_TASK_STATUS: Record<AiTaskStatus,{bg:string;color:string;label:string}> = {
  completed:  {bg:"#E8FFEA",color:"#00B42A",label:"已完成"},
  reviewing:  {bg:"#E8F3FF",color:"#165DFF",label:"评审中"},
  generating: {bg:"#FFF3E8",color:"#FF7D00",label:"生成中"},
  failed:     {bg:"#FFE8E8",color:"#F53F3F",label:"失败"},
};

const METHOD_COLOR: Record<HttpMethod,string> = {GET:"#00B42A",POST:"#FF7D00",PUT:"#165DFF",DELETE:"#F53F3F",PATCH:"#7816FF"};
const METHOD_BG:    Record<HttpMethod,string> = {GET:"#E8FFEA",POST:"#FFF3E8",PUT:"#E8F3FF",DELETE:"#FFE8E8",PATCH:"#F5E8FF"};

// ─── Sidebar navigation structure ────────────────────────────────────────────

interface NavLeaf { key: ActiveNav; label: string; }
interface NavGroup { key: string; label: string; icon: React.ElementType; color: string; children: NavLeaf[]; }
interface NavItem { key: ActiveNav; label: string; icon: React.ElementType; color: string; }
type NavDef = NavItem | NavGroup;

const isGroup = (n: NavDef): n is NavGroup => "children" in n;

const NAV_DEFS: NavDef[] = [
  { key:"overview", label:"工作台",        icon:LayoutDashboard, color:T.primary },
  { key:"config",   label:"配置中心",      icon:Settings,        color:"#4E5AC8",
    children:[
      {key:"config",         label:"配置总览"},
      {key:"config-db",      label:"数据库配置"},
      {key:"config-env",     label:"环境配置"},
      {key:"config-param",   label:"变量配置"},
      {key:"config-notif",   label:"通知配置"},
      {key:"config-runner",  label:"Runner 配置"},
      {key:"config-ai",      label:"AI 连接配置"},
      {key:"config-mock",    label:"Mock 服务"},
    ]},
  { key:"cases",    label:"用例中心",      icon:FileText,        color:T.success,
    children:[
      {key:"cases-list",    label:"用例管理"},
      {key:"cases-ai-gen",  label:"AI 用例生成"},
      {key:"cases-records", label:"AI 生成记录"},
      {key:"cases-ai-cfg",  label:"AI 配置"},
    ]},
  { key:"testmgmt", label:"测试管理",      icon:FlaskConical,   color:"#0EA5E9" },
  { key:"bugs",     label:"缺陷管理",      icon:Bug,             color:T.danger },
  { key:"api",      label:"接口自动化",    icon:Link2,           color:T.warning },
  { key:"webui",    label:"Web UI 自动化", icon:Monitor,         color:T.cyan },
  { key:"app",      label:"APP 自动化",    icon:Smartphone,      color:T.purple },
  { key:"settings", label:"系统设置",      icon:Shield,          color:T.slate },
];

// ─── Primitive UI atoms ───────────────────────────────────────────────────────

function IcoSquare({color,bg,size=32,children}:{color:string;bg:string;size?:number;children:React.ReactNode}){return <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{width:size,height:size,backgroundColor:bg}}><span style={{color,display:"flex"}}>{children}</span></div>;}

function StatusDot({status,label}:{status:string;label?:string}){
  const M:Record<string,{dot:string;text:string;tc:string}>={enabled:{dot:T.success,text:"已启用",tc:T.t2},disabled:{dot:T.t4,text:"已停用",tc:T.t3},online:{dot:T.success,text:"在线",tc:T.t2},offline:{dot:T.t4,text:"离线",tc:T.t3},success:{dot:T.success,text:"成功",tc:T.t2},failed:{dot:T.danger,text:"失败",tc:T.danger},pass:{dot:T.success,text:"通过",tc:T.success},fail:{dot:T.danger,text:"失败",tc:T.danger},running:{dot:T.primary,text:"运行中",tc:T.primary},configured:{dot:T.success,text:"已配置",tc:T.t2},unconfigured:{dot:T.t4,text:"未配置",tc:T.danger}};
  const c=M[status]??M.disabled;
  return <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{backgroundColor:c.dot}}/><span className="text-[12px]" style={{color:c.tc}}>{label??c.text}</span></span>;
}

function PBtn({children,onClick,icon:Icon,small,color=T.primary,variant="primary"}:{children?:React.ReactNode;onClick?:()=>void;icon?:React.ElementType;small?:boolean;color?:string;variant?:"primary"|"ghost"}){
  if(variant==="ghost") return <button onClick={onClick} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] font-medium bg-white transition-colors" style={{borderColor:T.border,color:T.t2}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.color=T.primary;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.t2;}}>{Icon&&<Icon size={13}/>}{children}</button>;
  return <button onClick={onClick} className="inline-flex items-center gap-1.5 font-medium rounded-lg transition-all active:scale-[0.98]" style={{backgroundColor:color,color:"#fff",height:small?28:32,padding:small?"0 10px":"0 14px",fontSize:small?12:13}} onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.1)"} onMouseLeave={e=>e.currentTarget.style.filter=""}>{Icon&&<Icon size={small?12:13}/>}{children}</button>;
}

function IBtn({icon:Icon,label,danger,onClick}:{icon:React.ElementType;label:string;danger?:boolean;onClick?:()=>void}){return <button title={label} onClick={e=>{e.stopPropagation();onClick?.();}} className="w-7 h-7 flex items-center justify-center rounded-md transition-colors" style={{color:T.t4}} onMouseEnter={e=>{e.currentTarget.style.color=danger?T.danger:T.t1;e.currentTarget.style.backgroundColor=danger?"#FFF0F0":"#F2F3F5";}} onMouseLeave={e=>{e.currentTarget.style.color=T.t4;e.currentTarget.style.backgroundColor="transparent";}}><Icon size={13}/></button>;}

function Inp({placeholder,type="text",prefix,mono,width,value,onChange}:{placeholder?:string;type?:string;prefix?:React.ReactNode;mono?:boolean;width?:string|number;value?:string;onChange?:(v:string)=>void}){return <div className="relative flex items-center" style={{width}}>{prefix&&<span className="absolute left-2.5 pointer-events-none" style={{color:T.t3}}>{prefix}</span>}<input type={type} placeholder={placeholder} value={value} onChange={e=>onChange?.(e.target.value)} className={`h-8 border rounded-lg bg-white text-[13px] outline-none transition-all w-full ${prefix?"pl-8 pr-3":"px-3"} ${mono?"font-mono text-[12px]":""}`} style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.primary}18`;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/></div>;}

function Sel({children,width=130}:{children:React.ReactNode;width?:number}){return <select className="h-8 px-2.5 border rounded-lg bg-white text-[13px] outline-none" style={{borderColor:T.border,color:T.t1,width}}>{children}</select>;}

function Toggle({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}){return <button onClick={()=>onChange(!on)} className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0" style={{backgroundColor:on?T.primary:"#C9CDD4"}}><span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all" style={{left:on?"calc(100% - 14px)":"2px"}}/></button>;}

function MethodBadge({method}:{method:HttpMethod}){return <span className="inline-block px-1.5 py-px rounded text-[10px] font-bold text-center" style={{minWidth:44,backgroundColor:METHOD_BG[method],color:METHOD_COLOR[method]}}>{method}</span>;}

// ─── Table atoms ─────────────────────────────────────────────────────────────

interface Col{label:string;width?:string;align?:"left"|"right"|"center"}
function ETable({cols,children,total}:{cols:Col[];children:React.ReactNode;total?:number}){const[page,setPage]=useState(1);const pages=total?Math.max(1,Math.ceil(total/10)):1;return <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}><table className="w-full border-collapse"><thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>{cols.map((c,i)=><th key={i} style={{width:c.width,textAlign:c.align??"left",color:T.t3}} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide">{c.label}</th>)}</tr></thead><tbody>{children}</tbody></table>{total!==undefined&&<div className="flex items-center justify-between px-4 py-2.5" style={{borderTop:`1px solid ${T.border}`}}><span className="text-[12px]" style={{color:T.t3}}>共 {total} 条</span><div className="flex items-center gap-1">{Array.from({length:pages}).map((_,i)=><button key={i} onClick={()=>setPage(i+1)} className="w-7 h-7 rounded-md text-[12px] font-medium" style={{backgroundColor:page===i+1?T.primary:"transparent",color:page===i+1?"#fff":T.t2,border:`1px solid ${page===i+1?T.primary:T.border}`}}>{i+1}</button>)}</div></div>}</div>;}
function TR({children,active,onClick}:{children:React.ReactNode;active?:boolean;onClick?:()=>void}){return <tr onClick={onClick} className="border-b last:border-b-0 transition-colors" style={{borderColor:T.border,height:46,backgroundColor:active?`${T.primary}08`:"",cursor:onClick?"pointer":"default"}} onMouseEnter={e=>!active&&(e.currentTarget.style.backgroundColor="#FAFBFF")} onMouseLeave={e=>!active&&(e.currentTarget.style.backgroundColor="")}>{children}</tr>;}
function TD({children,align="left",mono,muted}:{children?:React.ReactNode;align?:"left"|"right"|"center";mono?:boolean;muted?:boolean}){return <td className={`px-4 py-2 text-[13px] ${mono?"font-mono text-[12px]":""}`} style={{textAlign:align,color:muted?T.t3:T.t1}}>{children}</td>;}

function FilterBar({children,onAdd,addLabel,extra}:{children?:React.ReactNode;onAdd:()=>void;addLabel:string;extra?:React.ReactNode}){return <div className="flex items-center gap-2 mb-4">{children}<div className="flex-1"/>{extra}{extra&&" "}<PBtn icon={Plus} onClick={onAdd}>{addLabel}</PBtn></div>;}
function PageHead({title,desc}:{title:string;desc:string}){return <div className="mb-5"><h2 className="text-[16px] font-semibold" style={{color:T.t1}}>{title}</h2><p className="text-[12px] mt-0.5" style={{color:T.t3}}>{desc}</p></div>;}

// ═══════════════════════════════════════════════════════════════════════════════
// CASES MODULE
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Case Import / Export Dialog ─────────────────────────────────────────────

type ImportStep="idle"|"selected"|"parsing"|"success"|"partial"|"failed";

function CaseImportExportDialog({selectedCount,onClose}:{selectedCount:number;onClose:()=>void}){
  const [tab,setTab]=useState<"import"|"export">("import");
  const [step,setStep]=useState<ImportStep>("idle");
  const [dragging,setDragging]=useState(false);
  const [file,setFile]=useState<{name:string;size:string}|null>(null);
  const [dupHandle,setDupHandle]=useState<"skip"|"overwrite"|"rename">("skip");
  const [exportScope,setExportScope]=useState<"all"|"dir"|"selected">("all");
  const [exportFmt,setExportFmt]=useState<"xlsx"|"csv"|"xmind">("xlsx");
  const [exporting,setExporting]=useState(false);
  const [exportErr,setExportErr]=useState(false);

  const FAILED_ROWS=[
    {row:4,  name:"用户登录-正常流程",   reason:"必填字段「优先级」为空"},
    {row:7,  name:"订单提交-边界值",     reason:"所属目录「风控中心/限额」不存在"},
    {row:12, name:"支付回调验证",        reason:"用例类型值无效：「压测」"},
    {row:19, name:"优惠券核销-过期",     reason:"用例标题超过 200 字符限制"},
    {row:24, name:"账户余额查询",        reason:"「执行步骤」格式错误，缺少预期结果"},
    {row:31, name:"密码重置流程",        reason:"重复用例，已跳过（策略：跳过同名）"},
    {row:38, name:"商品详情页渲染",      reason:"「预期结果」字段不能为空"},
  ];
  const RESULT={total:128,success:121,failed:7,skipped:4};

  const pickFile=(f:File)=>{
    const kb=f.size/1024;
    setFile({name:f.name,size:kb>1024?(kb/1024).toFixed(1)+"MB":kb.toFixed(0)+"KB"});
    setStep("selected");
    setDragging(false);
  };

  const handleImport=()=>{
    setStep("parsing");
    setTimeout(()=>setStep("partial"),2200);
  };

  const handleExport=()=>{
    setExporting(true);
    setExportErr(false);
    setTimeout(()=>{setExporting(false);},1800);
  };

  const reset=()=>{setStep("idle");setFile(null);};

  const PathBlock=(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",
      background:"#F7F8FA",borderRadius:8,border:`1px solid ${T.border}`,marginBottom:16}}>
      <Folder size={14} style={{color:T.warning,flexShrink:0}}/>
      <span style={{fontSize:12,color:T.t2}}>
        <span style={{fontWeight:600,color:T.t1}}>导入目录：</span>X-MAN / 功能测试 / 用户中心
      </span>
      <button style={{marginLeft:"auto",fontSize:11,color:T.primary,background:"none",border:"none",cursor:"pointer",flexShrink:0}}>更改</button>
    </div>
  );

  const renderImport=()=>{
    if(step==="idle"||step==="selected"){
      return(
        <>
          {PathBlock}
          {/* Drop zone */}
          <div
            onDragOver={e=>{e.preventDefault();setDragging(true);}}
            onDragLeave={()=>setDragging(false)}
            onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)pickFile(f);}}
            onClick={()=>{
              if(step!=="selected"){
                pickFile(new File([""],"测试用例模板_2024.xlsx",{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
              }
            }}
            style={{border:`2px dashed ${dragging?T.primary:step==="selected"?T.success:T.border}`,
              borderRadius:12,cursor:"pointer",marginBottom:16,
              background:dragging?`${T.primary}06`:step==="selected"?`${T.success}06`:"#FAFBFC",
              padding:step==="selected"?"14px 18px":"28px 20px",textAlign:"center"}}>
            {step==="selected"&&file?(
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:40,height:40,borderRadius:8,background:`${T.success}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <FileText size={18} style={{color:T.success}}/>
                </div>
                <div style={{flex:1,textAlign:"left"}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.t1}}>{file.name}</div>
                  <div style={{fontSize:11,color:T.t3,marginTop:2}}>{file.size} · Excel 文件</div>
                </div>
                <button onClick={e=>{e.stopPropagation();reset();}}
                  style={{width:24,height:24,borderRadius:"50%",background:`${T.danger}12`,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <X size={11} style={{color:T.danger}}/>
                </button>
              </div>
            ):(
              <>
                <div style={{width:48,height:48,borderRadius:12,background:dragging?`${T.primary}12`:"#EEF0F5",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
                  <Upload size={22} style={{color:dragging?T.primary:T.t3}}/>
                </div>
                <div style={{fontSize:13,fontWeight:600,color:dragging?T.primary:T.t1,marginBottom:4}}>
                  {dragging?"松开鼠标即可上传":"拖拽文件到此处，或点击选择文件"}
                </div>
                <div style={{fontSize:12,color:T.t3}}>支持 .xlsx / .xls 格式，文件大小不超过 10MB</div>
              </>
            )}
          </div>

          {/* Duplicate handling */}
          <div style={{background:"#F7F8FA",borderRadius:10,border:`1px solid ${T.border}`,padding:"14px 16px"}}>
            <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:10}}>同名用例处理方式</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {([
                ["skip",    "跳过",   "保留现有用例，不导入同名用例"],
                ["overwrite","覆盖",  "用导入数据替换现有同名用例"],
                ["rename",  "重命名", "自动在标题后加序号，如：登录测试 (2)"],
              ] as [string,string,string][]).map(([val,label,desc])=>(
                <label key={val} onClick={()=>setDupHandle(val as "skip"|"overwrite"|"rename")}
                  style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",
                    padding:"9px 12px",borderRadius:8,
                    background:dupHandle===val?"#fff":"transparent",
                    border:`1px solid ${dupHandle===val?T.primary:T.border}`}}>
                  <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${dupHandle===val?T.primary:T.border}`,
                    display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1,
                    background:dupHandle===val?T.primary:"#fff"}}>
                    {dupHandle===val&&<div style={{width:6,height:6,borderRadius:"50%",background:"#fff"}}/>}
                  </div>
                  <div>
                    <div style={{fontSize:13,fontWeight:dupHandle===val?600:400,color:dupHandle===val?T.primary:T.t1}}>{label}</div>
                    <div style={{fontSize:11,color:T.t3,marginTop:2}}>{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{marginTop:10,display:"flex",alignItems:"center",gap:4}}>
            <Download size={12} style={{color:T.primary}}/>
            <button style={{fontSize:12,color:T.primary,background:"none",border:"none",cursor:"pointer",padding:0}}>下载导入模板</button>
          </div>
        </>
      );
    }

    if(step==="parsing"){
      return(
        <>
          {PathBlock}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"48px 20px",gap:16}}>
            <div style={{width:60,height:60,borderRadius:"50%",background:`${T.primary}12`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <RefreshCw size={26} style={{color:T.primary}} className="animate-spin"/>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:15,fontWeight:600,color:T.t1,marginBottom:4}}>正在解析文件...</div>
              <div style={{fontSize:12,color:T.t3}}>{file?.name}</div>
            </div>
            <div style={{width:280,height:4,borderRadius:4,background:"#EAECF0",overflow:"hidden"}}>
              <div className="animate-pulse" style={{height:"100%",borderRadius:4,background:T.primary,width:"65%"}}/>
            </div>
            <div style={{fontSize:12,color:T.t3}}>正在校验字段格式与目录映射...</div>
          </div>
        </>
      );
    }

    if(step==="success"){
      return(
        <>
          <div style={{textAlign:"center",padding:"32px 20px 20px"}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:`${T.success}12`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
              <CheckCircle size={30} style={{color:T.success}}/>
            </div>
            <div style={{fontSize:16,fontWeight:700,color:T.t1,marginBottom:6}}>全部导入成功</div>
            <div style={{fontSize:13,color:T.t3,marginBottom:20}}>共 128 条用例已成功导入到「用户中心」目录</div>
            <div style={{display:"inline-flex",gap:0,borderRadius:10,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              {[
                {label:"成功导入",value:128,color:T.success},
                {label:"跳过",value:0,color:T.t3},
                {label:"失败",value:0,color:T.t3},
              ].map((s,i)=>(
                <div key={s.label} style={{padding:"14px 28px",textAlign:"center",borderLeft:i>0?`1px solid ${T.border}`:undefined}}>
                  <div style={{fontSize:22,fontWeight:700,color:s.color}}>{s.value}</div>
                  <div style={{fontSize:11,color:T.t3,marginTop:2}}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      );
    }

    if(step==="partial"){
      return(
        <>
          {/* Banner */}
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
            background:`${T.warning}0C`,border:`1px solid ${T.warning}35`,borderRadius:10,marginBottom:14}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:`${T.warning}15`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <AlertTriangle size={17} style={{color:T.warning}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:T.t1}}>部分导入成功</div>
              <div style={{fontSize:12,color:T.t2,marginTop:1}}>
                共 {RESULT.total} 条 · 成功 <span style={{color:T.success,fontWeight:600}}>{RESULT.success}</span> · 跳过 <span style={{color:T.t3,fontWeight:600}}>{RESULT.skipped}</span> · 失败 <span style={{color:T.danger,fontWeight:600}}>{RESULT.failed}</span>
              </div>
            </div>
            <button style={{fontSize:12,color:T.primary,background:"none",border:`1px solid ${T.primary}40`,borderRadius:6,padding:"5px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
              <Download size={11}/>下载明细
            </button>
          </div>

          {/* Stats */}
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {[
              {label:"成功导入",value:RESULT.success,color:T.success,bg:`${T.success}0E`},
              {label:"跳过（重名）",value:RESULT.skipped,color:T.t3,bg:"#F0F1F5"},
              {label:"导入失败",value:RESULT.failed,color:T.danger,bg:`${T.danger}0E`},
            ].map(s=>(
              <div key={s.label} style={{flex:1,padding:"11px 12px",background:s.bg,borderRadius:8,textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:700,color:s.color}}>{s.value}</div>
                <div style={{fontSize:11,color:T.t3,marginTop:2}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Failed table */}
          <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"9px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:6,background:"#FAFBFC"}}>
              <AlertTriangle size={12} style={{color:T.danger}}/>
              <span style={{fontSize:12,fontWeight:600,color:T.t1}}>失败明细</span>
              <span style={{fontSize:11,color:T.t4,marginLeft:2}}>共 {FAILED_ROWS.length} 条</span>
            </div>
            <div style={{maxHeight:190,overflowY:"auto"}}>
              {FAILED_ROWS.map((r,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:0,
                  padding:"8px 14px",borderBottom:i<FAILED_ROWS.length-1?`1px solid ${T.border}`:undefined,
                  background:i%2===0?"#fff":"#FAFBFC"}}>
                  <span style={{fontSize:11,color:T.t4,width:52,flexShrink:0}}>第 {r.row} 行</span>
                  <span style={{fontSize:12,color:T.t1,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginRight:12}}>{r.name}</span>
                  <span style={{fontSize:11,color:T.danger,flexShrink:0,maxWidth:220,textAlign:"right"}}>{r.reason}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      );
    }

    if(step==="failed"){
      return(
        <>
          {PathBlock}
          <div style={{textAlign:"center",padding:"36px 20px 20px"}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:`${T.danger}10`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
              <X size={28} style={{color:T.danger}}/>
            </div>
            <div style={{fontSize:15,fontWeight:700,color:T.t1,marginBottom:6}}>解析失败</div>
            <div style={{fontSize:13,color:T.t3,marginBottom:20}}>文件格式错误或数据无法解析，请检查文件后重试</div>
            <div style={{padding:"12px 16px",background:`${T.danger}07`,border:`1px solid ${T.danger}20`,
              borderRadius:8,fontSize:12,color:T.danger,textAlign:"left",maxWidth:400,margin:"0 auto"}}>
              错误信息：Sheet1 第 2 行「用例标题」列缺失，无法识别文件结构。请使用标准模板导入。
            </div>
          </div>
        </>
      );
    }
    return null;
  };

  const renderExport=()=>(
    <>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",
        background:"#F7F8FA",borderRadius:8,border:`1px solid ${T.border}`,marginBottom:18}}>
        <Folder size={14} style={{color:T.warning,flexShrink:0}}/>
        <span style={{fontSize:12,color:T.t2}}>
          <span style={{fontWeight:600,color:T.t1}}>当前目录：</span>X-MAN / 功能测试 / 用户中心
        </span>
      </div>

      <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:10}}>导出范围</div>
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        {([
          ["all","全部用例",235,false],
          ["dir","当前目录",34,false],
          ["selected","已选用例",selectedCount,selectedCount===0],
        ] as [string,string,number,boolean][]).map(([val,label,cnt,disabled])=>{
          const active=exportScope===val;
          return(
            <button key={val} disabled={disabled}
              onClick={()=>!disabled&&setExportScope(val as "all"|"dir"|"selected")}
              style={{flex:1,padding:"16px 12px",borderRadius:10,textAlign:"center",
                border:`1.5px solid ${active?T.primary:disabled?T.border:T.border}`,
                background:active?`${T.primary}08`:disabled?"#F7F8FA":"#fff",
                cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1}}>
              <div style={{fontSize:22,fontWeight:700,color:active?T.primary:disabled?T.t4:T.t1,marginBottom:4}}>{cnt}</div>
              <div style={{fontSize:12,fontWeight:500,color:active?T.primary:disabled?T.t4:T.t2}}>{label}</div>
              {disabled&&<div style={{fontSize:10,color:T.t4,marginTop:3}}>请先勾选用例</div>}
            </button>
          );
        })}
      </div>

      <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:10}}>导出格式</div>
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        {([
          ["xlsx","Excel (.xlsx)","表格格式，可直接编辑与再导入"],
          ["csv", "CSV (.csv)",  "轻量文本，适合数据清洗与处理"],
          ["xmind","XMind (.xmind)","思维导图，适合用例结构梳理"],
        ] as [string,string,string][]).map(([val,label,desc])=>{
          const active=exportFmt===val;
          return(
            <button key={val} onClick={()=>setExportFmt(val as "xlsx"|"csv"|"xmind")}
              style={{flex:1,padding:"12px 14px",borderRadius:10,textAlign:"left",
                border:`1.5px solid ${active?T.primary:T.border}`,
                background:active?`${T.primary}08`:"#fff",cursor:"pointer"}}>
              <div style={{fontSize:13,fontWeight:600,color:active?T.primary:T.t1,marginBottom:3}}>{label}</div>
              <div style={{fontSize:11,color:T.t3,lineHeight:1.5}}>{desc}</div>
            </button>
          );
        })}
      </div>

      {exportErr&&(
        <div style={{padding:"10px 14px",background:`${T.danger}07`,border:`1px solid ${T.danger}25`,
          borderRadius:8,fontSize:12,color:T.danger,display:"flex",alignItems:"center",gap:8}}>
          <AlertTriangle size={13} style={{flexShrink:0}}/>
          导出失败，服务器响应超时，请稍后重试
        </div>
      )}
    </>
  );

  const renderFooter=()=>{
    if(tab==="import"){
      if(step==="idle")   return <><PBtn variant="ghost" onClick={onClose}>取消</PBtn></>;
      if(step==="selected")return <><PBtn variant="ghost" onClick={reset}>重新选择</PBtn><PBtn icon={Upload} onClick={handleImport}>开始导入</PBtn></>;
      if(step==="parsing") return <><button style={{height:32,padding:"0 14px",borderRadius:8,border:`1px solid ${T.border}`,background:"#fff",fontSize:13,color:T.t3,cursor:"not-allowed",display:"flex",alignItems:"center",gap:6}}>
        <RefreshCw size={13} className="animate-spin"/>解析中...
      </button></>;
      if(step==="success") return <><PBtn variant="ghost" onClick={reset}>继续导入</PBtn><PBtn onClick={onClose}>完成</PBtn></>;
      if(step==="partial") return <><PBtn variant="ghost" onClick={reset}>重新导入</PBtn><PBtn onClick={onClose}>完成</PBtn></>;
      if(step==="failed")  return <><PBtn variant="ghost" onClick={onClose}>取消</PBtn><PBtn icon={RefreshCw} onClick={reset}>重新上传</PBtn></>;
    }
    return(
      <>
        <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
        <PBtn icon={exporting?RefreshCw:Download} color={exportErr?T.danger:T.primary} onClick={handleExport}>
          {exporting?"导出中...":exportErr?"重新导出":"导出"}
        </PBtn>
      </>
    );
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:60,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(29,33,41,0.5)"}} onClick={onClose}/>
      <div style={{position:"relative",background:"#fff",borderRadius:14,width:640,
        maxHeight:"88vh",display:"flex",flexDirection:"column",
        boxShadow:"0 20px 60px rgba(0,0,0,0.2)",overflow:"hidden"}}>

        {/* Header */}
        <div style={{padding:"18px 24px 0",flexShrink:0,borderBottom:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div style={{fontSize:16,fontWeight:700,color:T.t1}}>导入 / 导出用例</div>
            <button onClick={onClose} style={{width:28,height:28,borderRadius:6,border:`1px solid ${T.border}`,
              background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:T.t3}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#F4F6FA";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#fff";}}>
              <X size={14}/>
            </button>
          </div>
          {/* Tabs */}
          <div style={{display:"flex"}}>
            {(["import","export"] as const).map(t=>(
              <button key={t} onClick={()=>{setTab(t);reset();setExportErr(false);}}
                style={{padding:"8px 20px",fontSize:13,fontWeight:tab===t?600:400,
                  color:tab===t?T.primary:T.t3,background:"none",border:"none",cursor:"pointer",
                  borderBottom:`2px solid ${tab===t?T.primary:"transparent"}`,marginBottom:-1}}>
                {t==="import"?"导入用例":"导出用例"}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
          {tab==="import"?renderImport():renderExport()}
        </div>

        {/* Footer */}
        <div style={{borderTop:`1px solid ${T.border}`,padding:"14px 24px",
          display:"flex",justifyContent:"flex-end",gap:8,flexShrink:0,background:"#fff"}}>
          {renderFooter()}
        </div>
      </div>
    </div>
  );
}

// ─── Case Directory Tree ─────────────────────────────────────────────────────

type CaseNodeType = "folder"|"requirement";
type CaseTreeNode={id:string;label:string;count:number;type:CaseNodeType;children:CaseTreeNode[]};
type DirModalState=
  |{mode:"add";parentId:string;siblingNames:string[];nodeType:CaseNodeType}
  |{mode:"rename";nodeId:string;currentLabel:string;siblingNames:string[];nodeType:CaseNodeType};

function DirNameModal({state,onClose,onConfirm}:{state:DirModalState;onClose:()=>void;onConfirm:(name:string)=>void}){
  const isAdd=state.mode==="add";
  const isReq=state.nodeType==="requirement";
  const initVal=isAdd?"":( state.mode==="rename"?state.currentLabel:"");
  const [val,setVal]=useState(initVal);
  const [err,setErr]=useState<string|null>(null);
  const [touched,setTouched]=useState(false);
  const maxLen=isReq?30:20;
  const accent=isReq?T.purple:T.primary;

  const validate=(v:string):string|null=>{
    const t=v.trim();
    if(!t)return isReq?"需求名称不能为空":"目录名称不能为空";
    const lower=t.toLowerCase();
    const isDup=state.siblingNames.some(n=>{
      if(n.toLowerCase()!==lower)return false;
      if(state.mode==="rename")return lower!==state.currentLabel.toLowerCase();
      return true;
    });
    if(isDup)return isReq?"同级下已存在相同需求名称":"同级目录下已存在相同名称";
    return null;
  };

  const handleChange=(v:string)=>{setVal(v);if(touched)setErr(validate(v));};
  const handleConfirm=()=>{setTouched(true);const e=validate(val);if(e){setErr(e);return;}onConfirm(val.trim());};
  const title=isAdd?(isReq?"添加需求":"添加子目录"):(isReq?"重命名需求":"重命名目录");
  const IconComp=isAdd?(isReq?ClipboardList:FolderPlus):(isReq?ClipboardList:Pencil);

  return(
    <div style={{position:"fixed",inset:0,zIndex:60,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(29,33,41,0.5)"}} onClick={onClose}/>
      <div style={{position:"relative",background:"#fff",borderRadius:12,width:420,overflow:"hidden",boxShadow:"0 16px 48px rgba(0,0,0,0.18)"}}>
        <div style={{height:3,background:accent}}/>
        <div style={{padding:"20px 24px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:`${accent}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <IconComp size={15} style={{color:accent}}/>
            </div>
            <div style={{fontSize:15,fontWeight:600,color:T.t1}}>{title}</div>
          </div>
          <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:6}}>
            {isReq?"需求名称":"目录名称"}<span style={{color:T.danger,marginLeft:2}}>*</span>
          </div>
          <input autoFocus value={val}
            onChange={e=>handleChange(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")handleConfirm();if(e.key==="Escape")onClose();}}
            placeholder={isReq?"请输入需求名称，最多 30 个字符":"请输入目录名称，最多 20 个字符"}
            maxLength={maxLen}
            style={{width:"100%",height:36,padding:"0 12px",border:`1.5px solid ${err?T.danger:T.border}`,borderRadius:8,
              fontSize:13,color:T.t1,outline:"none",boxSizing:"border-box",background:err?"#FFF8F8":"#fff"}}
            onFocus={e=>{if(!err)(e.currentTarget as HTMLInputElement).style.borderColor=accent;}}
            onBlur={e=>{if(!err)(e.currentTarget as HTMLInputElement).style.borderColor=T.border;}}
          />
          <div style={{display:"flex",justifyContent:"space-between",marginTop:5,minHeight:18}}>
            <span style={{fontSize:12,color:T.danger}}>{err||""}</span>
            <span style={{fontSize:11,color:T.t4}}>{val.length}/{maxLen}</span>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,padding:"12px 24px",borderTop:`1px solid ${T.border}`}}>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn color={accent} onClick={handleConfirm}>确认</PBtn>
        </div>
      </div>
    </div>
  );
}

function MoveModal({nodeLabel,treeData,currentId,onClose,onMove}:{
  nodeLabel:string;treeData:CaseTreeNode[];currentId:string;onClose:()=>void;onMove:(targetId:string)=>void;
}){
  const [destId,setDestId]=useState<string|null>(null);
  const [exp,setExp]=useState<Record<string,boolean>>({"root":true,"f1":true});

  const isDescendant=(nodes:CaseTreeNode[],ancestorId:string,targetId:string):boolean=>{
    for(const n of nodes){
      if(n.id===ancestorId){
        const check=(cs:CaseTreeNode[]):boolean=>cs.some(c=>c.id===targetId||check(c.children));
        return check(n.children);
      }
      if(isDescendant(n.children,ancestorId,targetId))return true;
    }
    return false;
  };

  const renderFolder=(node:CaseTreeNode,depth=0):React.ReactNode=>{
    if(node.type==="requirement")return null;
    const isCurrentNode=node.id===currentId;
    const isInSubtree=isDescendant(treeData,currentId,node.id);
    const disabled=isCurrentNode||isInSubtree;
    const subFolders=node.children.filter(c=>c.type==="folder");
    const isSelected=destId===node.id;
    return(
      <div key={node.id}>
        <button onClick={()=>{if(!disabled){setDestId(node.id);if(subFolders.length>0)setExp(e=>({...e,[node.id]:!e[node.id]}));}}}
          style={{width:"100%",display:"flex",alignItems:"center",gap:6,padding:"5px 8px",paddingLeft:8+depth*14,
            borderRadius:6,border:"none",cursor:disabled?"not-allowed":"pointer",
            background:isSelected?`${T.primary}10`:"transparent",opacity:disabled?.35:1}}
          onMouseEnter={e=>{if(!disabled&&!isSelected)(e.currentTarget as HTMLElement).style.background="#F4F6FA";}}
          onMouseLeave={e=>{if(!isSelected)(e.currentTarget as HTMLElement).style.background=isSelected?`${T.primary}10`:"transparent";}}>
          {subFolders.length>0
            ?exp[node.id]?<ChevronDown size={11} style={{color:T.t3,flexShrink:0}}/>:<ChevronRight size={11} style={{color:T.t3,flexShrink:0}}/>
            :<span style={{width:11,display:"inline-block",flexShrink:0}}/>}
          {exp[node.id]&&subFolders.length>0
            ?<FolderOpen size={12} style={{color:T.warning,flexShrink:0}}/>
            :<Folder size={12} style={{color:isSelected?T.warning:T.t4,flexShrink:0}}/>}
          <span style={{fontSize:12,flex:1,textAlign:"left",color:isSelected?T.primary:disabled?T.t4:T.t1,fontWeight:isSelected?500:400}}>{node.label}</span>
          {isSelected&&<Check size={11} style={{color:T.primary,flexShrink:0}}/>}
        </button>
        {subFolders.length>0&&exp[node.id]&&subFolders.map(c=>renderFolder(c,depth+1))}
      </div>
    );
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:60,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(29,33,41,0.5)"}} onClick={onClose}/>
      <div style={{position:"relative",background:"#fff",borderRadius:12,width:340,overflow:"hidden",boxShadow:"0 16px 48px rgba(0,0,0,0.18)"}}>
        <div style={{height:3,background:T.primary}}/>
        <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{fontSize:15,fontWeight:600,color:T.t1,marginBottom:3}}>移动到</div>
          <div style={{fontSize:12,color:T.t3}}>为「{nodeLabel}」选择新的目录位置</div>
        </div>
        <div style={{maxHeight:260,overflowY:"auto",padding:"6px 10px"}}>
          {treeData.map(n=>renderFolder(n,0))}
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,padding:"12px 20px",borderTop:`1px solid ${T.border}`}}>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn disabled={!destId} onClick={()=>destId&&onMove(destId)}>移动到此处</PBtn>
        </div>
      </div>
    </div>
  );
}

function CaseTree({selectedDir,onSelect}:{selectedDir:string;onSelect:(d:string)=>void}){
  const [expanded,setExpanded]=useState<Record<string,boolean>>({"root":true,"f1":true,"f1-1":true});
  const [treeData,setTreeData]=useState<CaseTreeNode[]>([{id:"root",label:"X-MAN",count:235,type:"folder",children:[
    {id:"f1",label:"功能测试",count:178,type:"folder",children:[
      {id:"f1-1",label:"用户中心",count:34,type:"folder",children:[
        {id:"req-1",label:"用户注册与登录",count:12,type:"requirement",children:[]},
        {id:"req-2",label:"个人信息管理",count:8,type:"requirement",children:[]},
        {id:"req-3",label:"账号安全设置",count:14,type:"requirement",children:[]},
      ]},
      {id:"f1-2",label:"订单中心",count:67,type:"folder",children:[
        {id:"req-4",label:"订单创建流程",count:20,type:"requirement",children:[]},
        {id:"req-5",label:"订单状态流转",count:15,type:"requirement",children:[]},
      ]},
      {id:"f1-3",label:"获客中心",count:45,type:"folder",children:[]},
      {id:"f1-4",label:"风控中心",count:32,type:"folder",children:[]},
    ]},
    {id:"f2",label:"接口测试",count:41,type:"folder",children:[]},
    {id:"f3",label:"性能测试",count:12,type:"folder",children:[]},
    {id:"f4",label:"安全测试",count:4,type:"folder",children:[]},
  ]}]);
  const [menuNode,setMenuNode]=useState<{id:string;label:string;count:number;type:CaseNodeType;pos:{x:number;y:number}}|null>(null);
  const [dirModal,setDirModal]=useState<DirModalState|null>(null);
  const [deleteTarget,setDeleteTarget]=useState<{id:string;label:string;count:number;type:CaseNodeType}|null>(null);
  const [moveTarget,setMoveTarget]=useState<{id:string;label:string;type:CaseNodeType}|null>(null);

  const getChildNames=(nodes:CaseTreeNode[],id:string):string[]|null=>{
    for(const n of nodes){
      if(n.id===id)return n.children.map(c=>c.label);
      const r=getChildNames(n.children,id);
      if(r!==null)return r;
    }
    return null;
  };

  const getSiblingNames=(nodes:CaseTreeNode[],id:string):string[]|null=>{
    for(const n of nodes){
      if(n.children.some(c=>c.id===id))return n.children.filter(c=>c.id!==id).map(c=>c.label);
      const r=getSiblingNames(n.children,id);
      if(r!==null)return r;
    }
    return null;
  };

  const findNode=(nodes:CaseTreeNode[],id:string):CaseTreeNode|null=>{
    for(const n of nodes){if(n.id===id)return n;const r=findNode(n.children,id);if(r)return r;}
    return null;
  };

  const removeNode=(nodes:CaseTreeNode[],id:string):[CaseTreeNode[],CaseTreeNode|null]=>{
    let removed:CaseTreeNode|null=null;
    const rm=(arr:CaseTreeNode[]):CaseTreeNode[]=>{
      const filtered=arr.filter(n=>{if(n.id===id){removed=n;return false;}return true;});
      return filtered.map(n=>({...n,children:rm(n.children)}));
    };
    return [rm(nodes),removed];
  };

  const openAddModal=(parentId:string,nodeType:CaseNodeType)=>{
    setDirModal({mode:"add",parentId,siblingNames:getChildNames(treeData,parentId)??[],nodeType});
    setMenuNode(null);
  };

  const openRenameModal=(node:{id:string;label:string;type:CaseNodeType})=>{
    setDirModal({mode:"rename",nodeId:node.id,currentLabel:node.label,siblingNames:getSiblingNames(treeData,node.id)??[],nodeType:node.type});
    setMenuNode(null);
  };

  const handleDirConfirm=(name:string)=>{
    if(!dirModal)return;
    if(dirModal.mode==="add"){
      const newId=`${dirModal.nodeType==="requirement"?"req":"dir"}-${Date.now()}`;
      const add=(nodes:CaseTreeNode[]):CaseTreeNode[]=>nodes.map(n=>
        n.id===dirModal.parentId
          ?{...n,children:[...n.children,{id:newId,label:name,count:0,type:dirModal.nodeType,children:[]}]}
          :{...n,children:add(n.children)});
      setTreeData(prev=>add(prev));
      setExpanded(e=>({...e,[dirModal.parentId]:true}));
    }else{
      const upd=(nodes:CaseTreeNode[]):CaseTreeNode[]=>nodes.map(n=>
        n.id===dirModal.nodeId?{...n,label:name}:{...n,children:upd(n.children)});
      setTreeData(prev=>upd(prev));
    }
    setDirModal(null);
  };

  const handleMove=(targetId:string)=>{
    if(!moveTarget)return;
    const [newTree,moved]=removeNode(treeData,moveTarget.id);
    if(!moved){setMoveTarget(null);return;}
    const insert=(nodes:CaseTreeNode[]):CaseTreeNode[]=>nodes.map(n=>
      n.id===targetId?{...n,children:[...n.children,moved]}:{...n,children:insert(n.children)});
    setTreeData(insert(newTree));
    setExpanded(e=>({...e,[targetId]:true}));
    setMoveTarget(null);
    if(selectedDir===moveTarget.id)onSelect(targetId);
  };

  const deleteNode=(id:string)=>{
    const [newTree]=removeNode(treeData,id);
    setTreeData(newTree);
    setDeleteTarget(null);
    if(selectedDir===id)onSelect("root");
  };

  const openMenu=(node:CaseTreeNode,e:React.MouseEvent)=>{
    e.stopPropagation();
    const rect=(e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuNode({id:node.id,label:node.label,count:node.count,type:node.type,pos:{x:rect.left,y:rect.bottom+4}});
  };

  const renderNode=(node:CaseTreeNode,depth=0):React.ReactNode=>{
    const isSelected=selectedDir===node.id;
    const isReq=node.type==="requirement";
    const hasChildren=node.children.length>0;
    const selBg=isReq?`${T.purple}10`:`${T.success}12`;
    const selColor=isReq?T.purple:T.success;
    return(
      <div key={node.id} className="group relative">
        <button
          onClick={()=>{onSelect(node.id);if(hasChildren&&!isReq)setExpanded(e=>({...e,[node.id]:!e[node.id]}));}}
          className="w-full flex items-center gap-1.5 py-1.5 rounded-md text-left"
          style={{paddingLeft:12+depth*16,backgroundColor:isSelected?selBg:""}}
          onMouseEnter={e=>{if(!isSelected)e.currentTarget.style.backgroundColor="#F4F6FA";}}
          onMouseLeave={e=>{if(!isSelected)e.currentTarget.style.backgroundColor="";}}>
          {/* chevron or spacer */}
          {!isReq&&hasChildren
            ?expanded[node.id]
              ?<ChevronDown size={12} style={{color:T.t3,flexShrink:0}}/>
              :<ChevronRight size={12} style={{color:T.t3,flexShrink:0}}/>
            :<span style={{width:12,display:"inline-block",flexShrink:0}}/>}
          {/* icon */}
          {isReq
            ?<ClipboardList size={12} style={{color:T.purple,flexShrink:0,opacity:isSelected?1:.65}}/>
            :hasChildren
              ?expanded[node.id]?<FolderOpen size={13} style={{color:T.warning,flexShrink:0}}/>:<Folder size={13} style={{color:T.warning,flexShrink:0}}/>
              :<Folder size={13} style={{color:T.warning,flexShrink:0}}/>}
          <span className="flex-1 text-[12px] truncate" style={{color:isSelected?selColor:T.t1,fontWeight:isSelected?500:400}}>{node.label}</span>
          <span className="group-hover:opacity-0 text-[11px] mr-2" style={{color:T.t4,flexShrink:0,transition:"opacity 0.1s"}}>{node.count}</span>
        </button>
        <button
          className="absolute opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
          style={{right:6,top:"50%",transform:"translateY(-50%)",width:20,height:20,borderRadius:4,
            display:"flex",alignItems:"center",justifyContent:"center",
            background:"transparent",border:"none",cursor:"pointer",color:T.t3,zIndex:1}}
          onClick={e=>openMenu(node,e)}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=T.border;}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
          <MoreHorizontal size={12}/>
        </button>
        {!isReq&&hasChildren&&expanded[node.id]&&node.children.map(c=>renderNode(c,depth+1))}
      </div>
    );
  };

  const menuItemsFor=(node:{id:string;label:string;count:number;type:CaseNodeType})=>{
    const isReq=node.type==="requirement";
    if(isReq)return[
      {icon:Pencil,    label:"重命名",  danger:false, action:()=>openRenameModal(node)},
      {icon:ArrowUp,   label:"移动",    danger:false, action:()=>{setMoveTarget({id:node.id,label:node.label,type:node.type});setMenuNode(null);}},
      {icon:Trash2,    label:"删除需求",danger:true,  action:()=>{setDeleteTarget({id:node.id,label:node.label,count:node.count,type:node.type});setMenuNode(null);}},
    ];
    return[
      {icon:FolderPlus,label:"添加子目录",danger:false,action:()=>openAddModal(node.id,"folder")},
      {icon:ClipboardList,label:"添加需求",danger:false,action:()=>openAddModal(node.id,"requirement")},
      {icon:Pencil,    label:"重命名",    danger:false,action:()=>openRenameModal(node)},
      {icon:ArrowUp,   label:"移动",      danger:false,action:()=>{setMoveTarget({id:node.id,label:node.label,type:node.type});setMenuNode(null);}},
      {icon:Trash2,    label:"删除目录",  danger:true, action:()=>{setDeleteTarget({id:node.id,label:node.label,count:node.count,type:node.type});setMenuNode(null);}},
    ];
  };

  const isReqDel=deleteTarget?.type==="requirement";

  return(
    <>
      {dirModal&&<DirNameModal state={dirModal} onClose={()=>setDirModal(null)} onConfirm={handleDirConfirm}/>}
      {moveTarget&&<MoveModal nodeLabel={moveTarget.label} treeData={treeData} currentId={moveTarget.id} onClose={()=>setMoveTarget(null)} onMove={handleMove}/>}
      {menuNode&&<div style={{position:"fixed",inset:0,zIndex:49}} onClick={()=>setMenuNode(null)}/>}
      {menuNode&&(
        <div style={{position:"fixed",left:menuNode.pos.x,top:menuNode.pos.y,zIndex:50,background:"#fff",
          borderRadius:8,boxShadow:"0 6px 24px rgba(0,0,0,0.13)",border:`1px solid ${T.border}`,
          padding:"4px 0",minWidth:152}}>
          {menuItemsFor(menuNode).map((item,i,arr)=>{
            const isDivider=i>0&&item.danger&&!arr[i-1].danger;
            return(
              <React.Fragment key={i}>
                {isDivider&&<div style={{height:1,margin:"4px 0",background:T.border}}/>}
                <button onClick={item.action}
                  style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 12px",
                    background:"none",border:"none",cursor:"pointer",fontSize:13,
                    color:item.danger?T.danger:T.t1,textAlign:"left"}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=item.danger?`${T.danger}08`:"#F4F6FA";}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="none";}}>
                  <item.icon size={13} style={{flexShrink:0}}/>{item.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
      {deleteTarget&&(
        <div style={{position:"fixed",inset:0,zIndex:60,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{position:"absolute",inset:0,background:"rgba(29,33,41,0.5)"}} onClick={()=>setDeleteTarget(null)}/>
          <div style={{position:"relative",background:"#fff",borderRadius:12,width:380,overflow:"hidden",boxShadow:"0 16px 48px rgba(0,0,0,0.18)"}}>
            <div style={{height:3,background:T.danger}}/>
            <div style={{padding:"20px 24px"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:4}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:`${T.danger}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <Trash2 size={15} style={{color:T.danger}}/>
                </div>
                <div>
                  <div style={{fontSize:15,fontWeight:600,color:T.t1,marginBottom:6}}>删除{isReqDel?"需求":"目录"}</div>
                  <div style={{fontSize:13,color:T.t2,lineHeight:1.7}}>
                    确认删除「{deleteTarget.label}」{isReqDel?"需求":"目录"}？
                    {deleteTarget.count>0&&<><br/><span style={{color:T.danger}}>该{isReqDel?"需求":"目录"}下共 {deleteTarget.count} 条用例将被移出。</span></>}
                  </div>
                </div>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,padding:"12px 24px",borderTop:`1px solid ${T.border}`}}>
              <PBtn variant="ghost" onClick={()=>setDeleteTarget(null)}>取消</PBtn>
              <PBtn color={T.danger} onClick={()=>deleteNode(deleteTarget.id)}>确认删除</PBtn>
            </div>
          </div>
        </div>
      )}
      <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:240,backgroundColor:"#fff",borderRight:`1px solid ${T.border}`}}>
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <PBtn icon={Plus} onClick={()=>openAddModal("root","folder")} small>新增目录</PBtn>
        </div>
        <div className="px-3 pb-2 flex-shrink-0"><Inp placeholder="搜索目录" prefix={<Search size={12}/>} width="100%"/></div>
        <div className="px-2 pb-2 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div className="flex items-center gap-3 px-1 py-1">
            <span className="text-[11px] font-medium" style={{color:T.t3}}>目录树</span>
            <div className="flex items-center gap-2 ml-auto">
              <span className="flex items-center gap-1 text-[10px]" style={{color:T.t3}}><Folder size={10} style={{color:T.warning}}/>目录</span>
              <span className="flex items-center gap-1 text-[10px]" style={{color:T.t3}}><ClipboardList size={10} style={{color:T.purple}}/>需求</span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {treeData.map(n=>renderNode(n))}
        </div>
      </div>
    </>
  );
}

// ─── Case Review Drawer ───────────────────────────────────────────────────────

type ReviewHistoryEntry = {date:string;reviewer:string;action:"passed"|"rejected";comment?:string};

function CaseReviewDrawer({
  case_:initCase, allCases, onClose, onUpdate,
}:{
  case_:TestCase; allCases:TestCase[]; onClose:()=>void; onUpdate:(id:string,status:ReviewStatus,comment:string,reviewer:string)=>void;
}){
  const [currentId,setCurrentId]=useState(initCase.id);
  const [comment,setComment]=useState("");
  const [commentErr,setCommentErr]=useState(false);
  const [autoNext,setAutoNext]=useState(true);

  const c=allCases.find(x=>x.id===currentId)||initCase;
  const rs=REVIEW_STATUS_STYLE[c.reviewStatus];
  const ps=PRIORITY_STYLE[c.priority];

  const canAct=c.reviewStatus==="reviewing"||c.reviewStatus==="pending";
  const isRejected=c.reviewStatus==="rejected";
  const isPassed=c.reviewStatus==="passed";

  const reviewable=allCases.filter(x=>x.reviewStatus!=="passed");
  const idx=reviewable.findIndex(x=>x.id===currentId);
  const prev=idx>0?reviewable[idx-1]:null;
  const next=idx>=0&&idx<reviewable.length-1?reviewable[idx+1]:null;

  const goTo=(target:TestCase)=>{setCurrentId(target.id);setComment("");setCommentErr(false);};

  const mockHistory:ReviewHistoryEntry[]=[
    ...(c.reviewedAt&&c.reviewer
      ?[{date:c.reviewedAt,reviewer:c.reviewer,action:(c.reviewStatus==="passed"?"passed":"rejected") as "passed"|"rejected",comment:c.reviewComment}]
      :[]),
  ];

  const doPass=()=>{
    onUpdate(c.id,"passed",comment,"张程远");
    setComment("");
    if(autoNext&&next){goTo(next);}
  };

  const doReject=()=>{
    if(!comment.trim()){setCommentErr(true);return;}
    onUpdate(c.id,"rejected",comment,"张程远");
    setComment("");
    if(autoNext&&next){goTo(next);}
  };

  const doUndoAndPass=()=>{
    onUpdate(c.id,"passed","","张程远");
    if(autoNext&&next){goTo(next);}
  };

  const doReReview=()=>{
    setComment("");
    onUpdate(c.id,"reviewing","","");
  };

  return(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0" style={{backgroundColor:"rgba(29,33,41,0.35)"}} onClick={onClose}/>
      <div className="relative flex flex-col overflow-hidden" style={{width:600,backgroundColor:"#fff",boxShadow:"-4px 0 28px rgba(0,0,0,0.13)"}}>

        {/* ── Header ── */}
        <div style={{flexShrink:0,padding:"16px 20px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"flex-start",gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
              <code style={{fontSize:11,color:T.t3,fontFamily:"monospace"}}>{c.id}</code>
              <span style={{fontSize:11,padding:"1px 7px",borderRadius:3,background:rs.bg,color:rs.color,fontWeight:600}}>{rs.label}</span>
              <span style={{fontSize:11,padding:"1px 6px",borderRadius:3,background:ps.bg,color:ps.color,fontWeight:700}}>{c.priority}</span>
              <span style={{fontSize:11,color:T.t3}}>{c.type}</span>
            </div>
            <div style={{fontSize:15,fontWeight:600,color:T.t1,lineHeight:1.4,marginBottom:4}}>{c.title}</div>
            <div style={{fontSize:12,color:T.t3,display:"flex",gap:8}}>
              <span>{c.directory}</span><span>·</span>
              <span>创建人：{c.creator}</span><span>·</span>
              <span>{c.updatedAt}</span>
            </div>
          </div>
          <button onClick={onClose} style={{flexShrink:0,width:28,height:28,border:"none",background:"transparent",cursor:"pointer",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:T.t3}}
            onMouseEnter={e=>{e.currentTarget.style.background=T.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
            <X size={15}/>
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:20}}>

          {/* Precondition */}
          <div>
            <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:3,height:12,borderRadius:2,background:T.success}}/>前置条件
            </div>
            <div style={{fontSize:13,color:T.t1,lineHeight:1.7,background:T.bg,borderRadius:8,padding:"10px 14px"}}>{c.precondition}</div>
          </div>

          {/* Steps */}
          <div>
            <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:3,height:12,borderRadius:2,background:T.primary}}/>测试步骤
            </div>
            <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
              {c.steps.map((step,i)=>(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 16px",borderBottom:i<c.steps.length-1?`1px solid ${T.border}`:"none",background:i%2===0?"#fff":"#FAFBFE"}}>
                  <span style={{width:20,height:20,borderRadius:"50%",background:`${T.primary}15`,color:T.primary,fontSize:11,fontWeight:700,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",marginTop:1}}>{i+1}</span>
                  <span style={{fontSize:13,color:T.t1,lineHeight:1.6,flex:1}}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expected result */}
          <div>
            <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:3,height:12,borderRadius:2,background:T.success}}/>预期结果
            </div>
            <div style={{fontSize:13,color:T.t1,lineHeight:1.7,background:"#F6FFED",border:`1px solid #B7EB8F`,borderRadius:8,padding:"10px 14px"}}>{c.expected}</div>
          </div>

          {/* Review history — original timeline style */}
          {mockHistory.length>0&&(
            <div>
              <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:12}}>评审记录</div>
              {mockHistory.map((h,i)=>(
                <div key={i} style={{display:"flex",gap:12,marginBottom:i<mockHistory.length-1?12:0}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:h.action==="passed"?`${T.success}15`:`${T.danger}12`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {h.action==="passed"?<CheckCircle size={13} style={{color:T.success}}/>:<XCircle size={13} style={{color:T.danger}}/>}
                  </div>
                  <div style={{flex:1,paddingBottom:i<mockHistory.length-1?12:0,borderBottom:i<mockHistory.length-1?`1px solid ${T.border}`:"none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                      <span style={{fontSize:12,fontWeight:600,color:T.t1}}>{h.reviewer}</span>
                      <span style={{fontSize:11,padding:"1px 6px",borderRadius:3,background:h.action==="passed"?`${T.success}12`:`${T.danger}10`,color:h.action==="passed"?T.success:T.danger,fontWeight:500}}>
                        {h.action==="passed"?"评审通过":"评审驳回"}
                      </span>
                      <span style={{fontSize:11,color:T.t4}}>{h.date}</span>
                    </div>
                    {h.comment&&<p style={{fontSize:12,color:T.t2,lineHeight:1.6,margin:0}}>{h.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Fixed footer ── */}
        <div style={{flexShrink:0,borderTop:`1px solid ${T.border}`,background:"#fff"}}>

          {/* 审核意见 — always visible when canAct, above action row */}
          {canAct&&(
            <div style={{padding:"14px 20px",borderBottom:`1px solid ${T.border}`,background:"#F7F8FA"}}>
              <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:7}}>
                审核意见
                {commentErr&&<span style={{fontWeight:400,color:T.danger,marginLeft:6}}>（驳回必填）</span>}
              </div>
              <textarea value={comment} onChange={e=>{setComment(e.target.value);setCommentErr(false);}}
                rows={3} placeholder="填写审核意见，驳回时必填…"
                style={{width:"100%",border:`1px solid ${commentErr?T.danger:T.border}`,borderRadius:7,padding:"8px 10px",fontSize:13,color:T.t1,outline:"none",resize:"none",boxSizing:"border-box",lineHeight:1.6,background:"#fff",transition:"border-color 0.15s"}}
                onFocus={e=>{e.currentTarget.style.borderColor=commentErr?T.danger:`${T.primary}80`;}}
                onBlur={e=>{e.currentTarget.style.borderColor=commentErr?T.danger:T.border;}}/>
            </div>
          )}

          {/* Nav + action row */}
          <div style={{padding:"10px 20px",display:"flex",alignItems:"center",gap:8}}>

            {/* Prev / counter / Next + toggle — only for queue cases */}
            {!isPassed&&(<>
              <button disabled={!prev} onClick={()=>prev&&goTo(prev)}
                style={{display:"flex",alignItems:"center",gap:4,height:30,padding:"0 10px",borderRadius:7,border:`1px solid ${prev?T.border:"transparent"}`,background:prev?"#fff":"transparent",cursor:prev?"pointer":"default",fontSize:12,color:prev?T.t2:T.t4,opacity:prev?1:0.4}}>
                <ChevronLeft size={13}/>上一条
              </button>
              <div style={{fontSize:12,color:T.t3,fontWeight:500,minWidth:36,textAlign:"center"}}>
                {idx+1}&thinsp;/&thinsp;{reviewable.length}
              </div>
              <button disabled={!next} onClick={()=>next&&goTo(next)}
                style={{display:"flex",alignItems:"center",gap:4,height:30,padding:"0 10px",borderRadius:7,border:`1px solid ${next?T.border:"transparent"}`,background:next?"#fff":"transparent",cursor:next?"pointer":"default",fontSize:12,color:next?T.t2:T.t4,opacity:next?1:0.4}}>
                下一条<ChevronRight size={13}/>
              </button>
              <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:4}}>
                <button onClick={()=>setAutoNext(v=>!v)}
                  style={{position:"relative",width:30,height:17,borderRadius:9,background:autoNext?T.success:"#C9CDD4",border:"none",cursor:"pointer",padding:0,flexShrink:0}}>
                  <span style={{position:"absolute",top:1.5,left:autoNext?14:1.5,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.15s",boxShadow:"0 1px 3px rgba(0,0,0,0.18)"}}/>
                </button>
                <span style={{fontSize:12,color:autoNext?T.success:T.t3,fontWeight:autoNext?500:400,whiteSpace:"nowrap"}}>自动跳转</span>
              </div>
            </>)}

            <div style={{flex:1}}/>

            {/* Action area */}
            {canAct&&(<>
              <button onClick={doReject}
                style={{height:32,padding:"0 16px",borderRadius:8,border:`1px solid ${T.danger}40`,background:`${T.danger}05`,color:T.danger,fontSize:13,fontWeight:600,cursor:"pointer"}}
                onMouseEnter={e=>{e.currentTarget.style.background=`${T.danger}10`;}} onMouseLeave={e=>{e.currentTarget.style.background=`${T.danger}05`;}}>
                驳回
              </button>
              <button onClick={doPass}
                style={{height:34,padding:"0 24px",borderRadius:8,border:"none",background:T.success,color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}
                onMouseEnter={e=>{e.currentTarget.style.opacity="0.88";}} onMouseLeave={e=>{e.currentTarget.style.opacity="1";}}>
                <CheckCircle size={14}/>通过
              </button>
            </>)}

            {isRejected&&(<>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <XCircle size={15} style={{color:T.danger}}/>
                <span style={{fontSize:13,color:T.danger,fontWeight:600}}>已驳回</span>
              </div>
              <button onClick={doUndoAndPass}
                style={{height:32,padding:"0 14px",borderRadius:8,border:`1px solid ${T.border}`,background:"#fff",color:T.t2,fontSize:12,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}
                onMouseEnter={e=>{e.currentTarget.style.background=T.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="#fff";}}>
                <CheckCircle size={12}/>撤销并通过
              </button>
            </>)}

            {isPassed&&(<>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <CheckCircle size={15} style={{color:T.success}}/>
                <span style={{fontSize:13,color:T.success,fontWeight:600}}>已通过</span>
              </div>
              <button onClick={doReReview}
                style={{height:32,padding:"0 14px",borderRadius:8,border:`1px solid ${T.border}`,background:"#fff",color:T.t2,fontSize:12,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}
                onMouseEnter={e=>{e.currentTarget.style.background=T.bg;}} onMouseLeave={e=>{e.currentTarget.style.background="#fff";}}>
                <RotateCcw size={12}/>发起重新评审
              </button>
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Case List Page ───────────────────────────────────────────────────────────

function CaseListPage({onViewCase,onReviewCase,onNewCase,cases=CASES}:{onViewCase:(c:TestCase)=>void;onReviewCase:(c:TestCase)=>void;onNewCase?:()=>void;cases?:TestCase[]}){
  const[selectedDir,setSelectedDir]=useState("root");
  const[selected,setSelected]=useState<string[]>([]);
  const[reviewF,setReviewF]=useState<ReviewStatus|"all">("all");
  const[showImportExport,setShowImportExport]=useState(false);
  const toggleSelect=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);

  const filtered=cases.filter(c=>reviewF==="all"||c.reviewStatus===reviewF);

  const reviewCounts:{[k in ReviewStatus]:number}={
    pending:  cases.filter(c=>c.reviewStatus==="pending").length,
    reviewing:cases.filter(c=>c.reviewStatus==="reviewing").length,
    passed:   cases.filter(c=>c.reviewStatus==="passed").length,
    rejected: cases.filter(c=>c.reviewStatus==="rejected").length,
  };

  return(
    <div className="flex flex-1 overflow-hidden">
      {showImportExport&&<CaseImportExportDialog selectedCount={selected.length} onClose={()=>setShowImportExport(false)}/>}
      <CaseTree selectedDir={selectedDir} onSelect={setSelectedDir}/>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5">
          {/* Filter bar */}
          <div className="flex items-center gap-2 mb-4">
            <Inp placeholder="搜索用例标题或 ID" prefix={<Search size={13}/>} width={220}/>
            <Sel width={100}><option>全部优先级</option><option>P0</option><option>P1</option><option>P2</option></Sel>
            <Sel width={110}><option>全部状态</option><option>已确认</option><option>待确认</option><option>已废弃</option></Sel>
            <Sel width={100}><option>全部来源</option><option>人工</option><option>AI生成</option></Sel>
            <div className="flex-1"/>
            {selected.length>0&&(
              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-[12px]" style={{color:T.t3}}>已选 {selected.length} 条</span>
                <PBtn variant="ghost" icon={Layers} onClick={()=>{}}>批量移动</PBtn>
                <PBtn variant="ghost" icon={Trash2} onClick={()=>{}} color={T.danger}>批量删除</PBtn>
              </div>
            )}
            <PBtn icon={Upload} onClick={()=>setShowImportExport(true)} variant="ghost">导入 / 导出</PBtn>
            <PBtn icon={Plus} onClick={()=>onNewCase?.()}>新增用例</PBtn>
          </div>
          {/* Review status filter chips */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[12px]" style={{color:T.t3}}>评审状态：</span>
            {([["all","全部",cases.length]] as [ReviewStatus|"all",string,number][]).concat(
              (["pending","reviewing","passed","rejected"] as ReviewStatus[]).map(k=>[k,REVIEW_STATUS_STYLE[k].label,reviewCounts[k]])
            ).map(([k,label,cnt])=>{
              const active=reviewF===k;
              const st=k!=="all"?REVIEW_STATUS_STYLE[k as ReviewStatus]:null;
              return(
                <button key={String(k)} onClick={()=>setReviewF(k as ReviewStatus|"all")}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                  style={{border:`1px solid ${active?(st?st.color:T.primary):T.border}`,
                    background:active?(st?`${st.color}12`:`${T.primary}10`):"#fff",
                    color:active?(st?st.color:T.primary):T.t3,cursor:"pointer"}}>
                  {st&&<span style={{width:6,height:6,borderRadius:"50%",background:st.dot,flexShrink:0,display:"inline-block"}}/>}
                  {label}
                  <span style={{fontSize:11,fontWeight:700,opacity:0.8}}>{cnt}</span>
                </button>
              );
            })}
          </div>

          <ETable total={filtered.length} cols={[
            {label:"",width:"3%"},{label:"用例 ID",width:"10%"},{label:"用例标题",width:"27%"},
            {label:"所属目录",width:"12%"},{label:"优先级",width:"6%"},{label:"状态",width:"7%"},
            {label:"来源",width:"6%"},{label:"评审状态",width:"13%"},
            {label:"关联缺陷",width:"6%"},{label:"操作",width:"10%",align:"right"},
          ]}>
            {filtered.map(c=>{
              const cs=CASE_STATUS_STYLE[c.status];
              const ps=PRIORITY_STYLE[c.priority];
              const rs=REVIEW_STATUS_STYLE[c.reviewStatus];
              const canReview=c.reviewStatus==="pending"||c.reviewStatus==="reviewing"||c.reviewStatus==="rejected";
              const canReReview2=c.reviewStatus==="passed";
              return(
                <TR key={c.id} active={selected.includes(c.id)}>
                  <TD><input type="checkbox" checked={selected.includes(c.id)} onChange={()=>toggleSelect(c.id)} onClick={e=>e.stopPropagation()} className="w-3.5 h-3.5" style={{accentColor:T.primary}}/></TD>
                  <TD><button onClick={()=>onViewCase(c)} className="font-mono text-[12px] hover:underline" style={{color:T.primary}}>{c.id}</button></TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate max-w-[170px]" style={{color:T.t1}}>{c.title}</span>
                      {c.source==="ai"&&<span className="px-1.5 py-px rounded text-[9px] font-bold flex-shrink-0" style={{backgroundColor:"#F5E8FF",color:T.purple}}>AI</span>}
                    </div>
                  </TD>
                  <TD muted><span className="truncate block max-w-[110px]">{c.directory}</span></TD>
                  <TD><span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:ps.bg,color:ps.color}}>{c.priority}</span></TD>
                  <TD><span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{backgroundColor:cs.bg,color:cs.color}}>{cs.label}</span></TD>
                  <TD><span className="text-[11px] px-1.5 py-0.5 rounded" style={{backgroundColor:c.source==="ai"?"#F5E8FF":"#F2F3F5",color:c.source==="ai"?T.purple:T.t3}}>{c.source==="ai"?"AI生成":"人工"}</span></TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <span style={{width:6,height:6,borderRadius:"50%",background:rs.dot,flexShrink:0,display:"inline-block"}}/>
                      <span className="text-[12px]" style={{color:rs.color,fontWeight:500}}>{rs.label}</span>
                      {c.reviewer&&<span className="text-[11px]" style={{color:T.t4}}>· {c.reviewer}</span>}
                    </div>
                  </TD>
                  <TD align="center"><span style={{color:c.defects>0?T.danger:T.t4,fontWeight:c.defects>0?600:400}}>{c.defects||"—"}</span></TD>
                  <TD align="right">
                    <div className="flex items-center justify-end">
                      <IBtn icon={Eye} label="查看详情" onClick={()=>onViewCase(c)}/>
                      {canReview&&<IBtn icon={ClipboardCheck} label="评审" onClick={()=>onReviewCase(c)}/>}
                      {canReReview2&&<IBtn icon={RotateCcw} label="重新评审" onClick={()=>onReviewCase(c)}/>}
                      <IBtn icon={Edit2} label="编辑" onClick={()=>{}}/>
                      <IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </ETable>
        </div>
      </div>
    </div>
  );
}

// ─── New Case Drawer ──────────────────────────────────────────────────────────

interface NewCaseForm {
  title:string; directory:string; type:string; priority:Priority|"";
  status:CaseStatus; precondition:string; steps:string[]; expected:string;
}

function NewCaseDrawer({onClose,onSave}:{onClose:()=>void;onSave:(c:TestCase)=>void}){
  const [form,setForm]=useState<NewCaseForm>({
    title:"",directory:"功能测试/用户中心",type:"功能",priority:"",
    status:"confirmed",precondition:"",steps:[""],expected:"",
  });
  const [errors,setErrors]=useState<Partial<Record<keyof NewCaseForm|"steps_empty",string>>>({});
  const [saving,setSaving]=useState(false);

  const set=(k:keyof NewCaseForm,v:string)=>{
    setForm(f=>({...f,[k]:v}));
    if(errors[k])setErrors(e=>({...e,[k]:undefined}));
  };

  const setStep=(i:number,v:string)=>{
    setForm(f=>{const s=[...f.steps];s[i]=v;return{...f,steps:s};});
    if(errors.steps_empty)setErrors(e=>({...e,steps_empty:undefined}));
  };
  const addStep=()=>setForm(f=>({...f,steps:[...f.steps,""]}));
  const removeStep=(i:number)=>setForm(f=>({...f,steps:f.steps.filter((_,idx)=>idx!==i)}));

  const validate=()=>{
    const e:typeof errors={};
    if(!form.title.trim())         e.title="用例标题不能为空";
    if(!form.priority)             e.priority="请选择优先级";
    if(!form.steps.some(s=>s.trim()))e.steps_empty="至少填写一条测试步骤";
    if(!form.expected.trim())      e.expected="预期结果不能为空";
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const handleSave=()=>{
    if(!validate())return;
    setSaving(true);
    const now=new Date().toISOString().slice(0,16).replace("T"," ");
    const newCase:TestCase={
      id:`Case-${Date.now().toString().slice(-6)}`,
      title:form.title.trim(),
      directory:form.directory,
      type:form.type,
      priority:form.priority as Priority,
      status:form.status,
      execStatus:"not-run",
      defects:0,
      creator:"张程远",
      updatedAt:now,
      source:"manual",
      steps:form.steps.filter(s=>s.trim()),
      expected:form.expected.trim(),
      precondition:form.precondition.trim(),
      reviewStatus:"pending",
    };
    setTimeout(()=>{setSaving(false);onSave(newCase);onClose();},300);
  };

  const fieldStyle=(hasErr?:boolean)=>({
    width:"100%",height:34,padding:"0 12px",fontSize:13,color:T.t1,outline:"none",
    border:`1.5px solid ${hasErr?T.danger:T.border}`,borderRadius:8,
    background:hasErr?"#FFF8F8":"#fff",boxSizing:"border-box",
  });

  const SLabel=({label,required}:{label:string;required?:boolean})=>(
    <div style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:6}}>
      {required&&<span style={{color:T.danger,marginRight:2}}>*</span>}{label}
    </div>
  );
  const ErrMsg=({k}:{k:keyof NewCaseForm|"steps_empty"})=>
    errors[k]?<div style={{fontSize:11,color:T.danger,marginTop:4}}>{errors[k]}</div>:null;

  const Section=({title,children}:{title:string;children:React.ReactNode})=>(
    <div style={{background:"#fff",borderRadius:10,border:`1px solid ${T.border}`,padding:"16px 20px",marginBottom:12}}>
      <div style={{fontSize:13,fontWeight:700,color:T.t1,marginBottom:14,paddingBottom:10,borderBottom:`1px solid ${T.border}`}}>{title}</div>
      {children}
    </div>
  );

  return(
    <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",justifyContent:"flex-end"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(29,33,41,0.45)"}} onClick={onClose}/>
      <div style={{position:"relative",width:680,background:T.bg,display:"flex",flexDirection:"column",
        height:"100%",boxShadow:"-8px 0 40px rgba(0,0,0,0.14)",overflow:"hidden"}}>

        {/* Header */}
        <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,
          padding:"0 24px",display:"flex",alignItems:"center",height:52,gap:10}}>
          <div style={{fontSize:15,fontWeight:700,color:T.t1}}>新增用例</div>
          <div style={{flex:1}}/>
          <span style={{fontSize:11,color:T.t4}}>当前项目：X-MAN · 测试平台</span>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:6,border:`1px solid ${T.border}`,
            background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:T.t3}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#F4F6FA";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#fff";}}>
            <X size={14}/>
          </button>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>

          {/* 基本信息 */}
          <Section title="基本信息">
            {/* Title */}
            <div style={{marginBottom:14}}>
              <SLabel label="用例标题" required/>
              <div style={{position:"relative"}}>
                <input value={form.title} onChange={e=>set("title",e.target.value.slice(0,200))}
                  placeholder="简洁描述测试点，如：用户正常登录后跳转首页"
                  style={fieldStyle(!!errors.title)}
                  onFocus={e=>{if(!errors.title)(e.currentTarget as HTMLInputElement).style.borderColor=T.primary;}}
                  onBlur={e=>{if(!errors.title)(e.currentTarget as HTMLInputElement).style.borderColor=T.border;}}
                />
                <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,
                  color:form.title.length>160?T.warning:T.t4}}>{form.title.length}/200</span>
              </div>
              <ErrMsg k="title"/>
            </div>

            {/* Row: directory + type */}
            <div style={{display:"flex",gap:12,marginBottom:14}}>
              <div style={{flex:1}}>
                <SLabel label="所属目录"/>
                <select value={form.directory} onChange={e=>set("directory",e.target.value)}
                  style={fieldStyle()}>
                  <option>功能测试/用户中心</option>
                  <option>功能测试/订单中心</option>
                  <option>功能测试/获客中心</option>
                  <option>功能测试/风控中心</option>
                  <option>接口测试</option>
                  <option>性能测试</option>
                  <option>安全测试</option>
                </select>
              </div>
              <div style={{flex:1}}>
                <SLabel label="用例类型"/>
                <select value={form.type} onChange={e=>set("type",e.target.value)}
                  style={fieldStyle()}>
                  {["功能","接口","性能","安全","UI","兼容性","回归"].map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Row: priority + status */}
            <div style={{display:"flex",gap:12}}>
              <div style={{flex:1}}>
                <SLabel label="优先级" required/>
                <div style={{display:"flex",gap:6}}>
                  {(["P0","P1","P2","P3"] as Priority[]).map(p=>{
                    const ps=PRIORITY_STYLE[p];
                    const active=form.priority===p;
                    return(
                      <button key={p} onClick={()=>{set("priority",p);}}
                        style={{flex:1,height:34,borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",
                          border:`1.5px solid ${active?ps.bg:T.border}`,
                          background:active?ps.bg:"#fff",
                          color:active?ps.color:T.t3}}>
                        {p}
                      </button>
                    );
                  })}
                </div>
                <ErrMsg k="priority"/>
              </div>
              <div style={{flex:1}}>
                <SLabel label="用例状态"/>
                <select value={form.status} onChange={e=>set("status",e.target.value as CaseStatus)}
                  style={fieldStyle()}>
                  <option value="confirmed">已确认</option>
                  <option value="pending">待确认</option>
                </select>
              </div>
            </div>
          </Section>

          {/* 测试内容 */}
          <Section title="测试内容">
            {/* Precondition */}
            <div style={{marginBottom:14}}>
              <SLabel label="前置条件"/>
              <textarea value={form.precondition} onChange={e=>set("precondition",e.target.value)}
                rows={2} placeholder="执行用例前需满足的环境或数据条件，如：已登录管理员账号"
                style={{width:"100%",padding:"8px 12px",fontSize:13,color:T.t1,outline:"none",resize:"vertical",
                  border:`1.5px solid ${T.border}`,borderRadius:8,background:"#fff",lineHeight:1.6,
                  boxSizing:"border-box"}}
                onFocus={e=>{(e.currentTarget as HTMLTextAreaElement).style.borderColor=T.primary;}}
                onBlur={e=>{(e.currentTarget as HTMLTextAreaElement).style.borderColor=T.border;}}
              />
            </div>

            {/* Steps */}
            <div style={{marginBottom:14}}>
              <SLabel label="测试步骤" required/>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {form.steps.map((step,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:T.primary,
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <span style={{fontSize:11,fontWeight:700,color:"#fff"}}>{i+1}</span>
                    </div>
                    <input value={step} onChange={e=>setStep(i,e.target.value)}
                      placeholder={`步骤 ${i+1}：描述操作动作`}
                      style={{...fieldStyle(!!errors.steps_empty&&!step.trim()&&form.steps.filter(s=>s.trim()).length===0),flex:1}}
                      onFocus={e=>{(e.currentTarget as HTMLInputElement).style.borderColor=T.primary;}}
                      onBlur={e=>{(e.currentTarget as HTMLInputElement).style.borderColor=errors.steps_empty&&!form.steps.some(s=>s.trim())?T.danger:T.border;}}
                    />
                    {form.steps.length>1&&(
                      <button onClick={()=>removeStep(i)}
                        style={{width:28,height:28,borderRadius:6,border:`1px solid ${T.border}`,
                          background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                          color:T.t4,flexShrink:0}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color=T.danger;(e.currentTarget as HTMLElement).style.borderColor=T.danger;}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color=T.t4;(e.currentTarget as HTMLElement).style.borderColor=T.border;}}>
                        <X size={12}/>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <ErrMsg k="steps_empty"/>
              <button onClick={addStep}
                style={{marginTop:8,display:"flex",alignItems:"center",gap:4,fontSize:12,color:T.primary,
                  background:"none",border:"none",cursor:"pointer",padding:"4px 0"}}>
                <Plus size={13}/> 添加步骤
              </button>
            </div>

            {/* Expected */}
            <div>
              <SLabel label="预期结果" required/>
              <textarea value={form.expected} onChange={e=>set("expected",e.target.value)}
                rows={3} placeholder="描述执行以上步骤后系统应有的正确响应或状态"
                style={{width:"100%",padding:"8px 12px",fontSize:13,color:T.t1,outline:"none",resize:"vertical",
                  border:`1.5px solid ${errors.expected?T.danger:T.border}`,borderRadius:8,
                  background:errors.expected?"#FFF8F8":"#fff",lineHeight:1.6,
                  boxSizing:"border-box"}}
                onFocus={e=>{if(!errors.expected)(e.currentTarget as HTMLTextAreaElement).style.borderColor=T.primary;}}
                onBlur={e=>{if(!errors.expected)(e.currentTarget as HTMLTextAreaElement).style.borderColor=T.border;}}
              />
              <ErrMsg k="expected"/>
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div style={{borderTop:`1px solid ${T.border}`,padding:"12px 24px",display:"flex",
          alignItems:"center",gap:8,background:"#fff",flexShrink:0}}>
          <div style={{flex:1,fontSize:12,color:T.t3}}>
            {Object.keys(errors).length>0&&<span style={{color:T.danger}}>请检查标红字段后再保存</span>}
          </div>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn icon={saving?RefreshCw:Plus} onClick={handleSave}>
            {saving?"保存中...":"保存用例"}
          </PBtn>
        </div>

      </div>
    </div>
  );
}

// ─── Case Detail Drawer ───────────────────────────────────────────────────────

function CaseDrawer({case_:c,onClose}:{case_:TestCase|null;onClose:()=>void}){
  const[drawerTab,setDrawerTab]=useState("details");
  if(!c)return null;
  const cs=CASE_STATUS_STYLE[c.status];const ps=PRIORITY_STYLE[c.priority];
  return(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0" style={{backgroundColor:"rgba(29,33,41,0.4)"}} onClick={onClose}/>
      <div className="relative flex flex-col overflow-hidden" style={{width:680,backgroundColor:"#fff",boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2 mb-1">
              <code className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{backgroundColor:"#F2F3F5",color:T.t2}}>{c.id}</code>
              <span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{backgroundColor:cs.bg,color:cs.color}}>{cs.label}</span>
            </div>
            <h2 className="text-[15px] font-semibold leading-snug" style={{color:T.t1}}>{c.title}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PBtn icon={Edit2} onClick={()=>{}} variant="ghost">编辑</PBtn>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[18px]" style={{color:T.t4}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>×</button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex flex-shrink-0 px-6" style={{borderBottom:`1px solid ${T.border}`}}>
          {(["details","defects"] as const).map(tab=>{const labels={details:"用例详情",defects:"关联缺陷（"+c.defects+"）"};return <button key={tab} onClick={()=>setDrawerTab(tab)} className="h-10 px-4 text-[13px] font-medium border-b-2 transition-colors" style={{borderBottomColor:drawerTab===tab?T.primary:"transparent",color:drawerTab===tab?T.primary:T.t3}}>{labels[tab]}</button>;})}
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {drawerTab==="details"&&(
            <div className="px-6 py-5">
              {/* Basic info grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6 pb-5" style={{borderBottom:`1px solid ${T.border}`}}>
                {[
                  {l:"所属目录",v:c.directory},{l:"用例类型",v:c.type},
                  {l:"优先级",v:<span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:ps.bg,color:ps.color}}>{c.priority}</span>},
                  {l:"来源",v:<span className="text-[12px]" style={{color:c.source==="ai"?T.purple:T.t2}}>{c.source==="ai"?"AI 生成":"人工创建"}</span>},
                  {l:"创建人",v:c.creator},{l:"更新时间",v:c.updatedAt},
                ].map((f,i)=>(
                  <div key={i}>
                    <p className="text-[11px] font-medium mb-1" style={{color:T.t3}}>{f.l}</p>
                    <div className="text-[13px]" style={{color:T.t1}}>{typeof f.v==="string"?f.v:f.v}</div>
                  </div>
                ))}
              </div>
              {/* Precondition */}
              <div className="mb-5">
                <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>前置条件</p>
                <div className="text-[13px] px-3 py-2.5 rounded-lg" style={{backgroundColor:"#F7F8FA",color:T.t1}}>{c.precondition}</div>
              </div>
              {/* Steps */}
              <div className="mb-5">
                <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>测试步骤</p>
                <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}>
                  {c.steps.map((step,i)=>(
                    <div key={i} className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0" style={{borderColor:T.border}}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5" style={{backgroundColor:`${T.primary}15`,color:T.primary}}>{i+1}</span>
                      <span className="text-[13px] flex-1" style={{color:T.t1}}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Expected */}
              <div>
                <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>预期结果</p>
                <div className="text-[13px] px-4 py-3 rounded-lg" style={{backgroundColor:"#F6FFED",border:`1px solid #B7EB8F`,color:T.t1}}>{c.expected}</div>
              </div>
            </div>
          )}
          {drawerTab==="defects"&&(
            <div className="px-6 py-5">
              {c.defects===0
                ? <p className="text-[13px]" style={{color:T.t3}}>暂无关联缺陷</p>
                : <p className="text-[13px]" style={{color:T.t3}}>共关联 {c.defects} 个缺陷</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI Generation Page ───────────────────────────────────────────────────────

// Shared tree snapshot for path picker (mirrors CaseTree initial data)
const CASE_TREE_MOCK:CaseTreeNode[]=[{id:"root",label:"X-MAN",count:235,type:"folder",children:[
  {id:"f1",label:"功能测试",count:178,type:"folder",children:[
    {id:"f1-1",label:"用户中心",count:34,type:"folder",children:[
      {id:"req-1",label:"用户注册与登录",count:12,type:"requirement",children:[]},
      {id:"req-2",label:"个人信息管理",count:8,type:"requirement",children:[]},
      {id:"req-3",label:"账号安全设置",count:14,type:"requirement",children:[]},
    ]},
    {id:"f1-2",label:"订单中心",count:67,type:"folder",children:[
      {id:"req-4",label:"订单创建流程",count:20,type:"requirement",children:[]},
      {id:"req-5",label:"订单状态流转",count:15,type:"requirement",children:[]},
    ]},
    {id:"f1-3",label:"获客中心",count:45,type:"folder",children:[]},
    {id:"f1-4",label:"风控中心",count:32,type:"folder",children:[]},
  ]},
  {id:"f2",label:"接口测试",count:41,type:"folder",children:[]},
  {id:"f3",label:"性能测试",count:12,type:"folder",children:[]},
  {id:"f4",label:"安全测试",count:4,type:"folder",children:[]},
]}];

function getNodePath(nodes:CaseTreeNode[],targetId:string,acc:string[]=[]):string[]|null{
  for(const n of nodes){
    const cur=[...acc,n.label];
    if(n.id===targetId)return cur;
    const r=getNodePath(n.children,targetId,cur);
    if(r)return r;
  }
  return null;
}

function CasePathPicker({onClose,onSelect}:{onClose:()=>void;onSelect:(id:string,path:string)=>void}){
  const[selected,setSelected]=useState<string|null>(null);
  const[exp,setExp]=useState<Record<string,boolean>>({"root":true,"f1":true,"f1-1":true});
  const breadcrumb=selected?getNodePath(CASE_TREE_MOCK,selected)??[]:[];

  const renderNode=(node:CaseTreeNode,depth=0):React.ReactNode=>{
    const isReq=node.type==="requirement";
    const hasChildren=node.children.length>0;
    const isSel=selected===node.id;
    const selColor=isReq?T.purple:T.primary;
    return(
      <div key={node.id}>
        <button
          onClick={()=>{setSelected(node.id);if(hasChildren&&!isReq)setExp(e=>({...e,[node.id]:!e[node.id]}));}}
          style={{width:"100%",display:"flex",alignItems:"center",gap:6,padding:"5px 8px",
            paddingLeft:8+depth*14,borderRadius:6,border:"none",cursor:"pointer",
            background:isSel?`${selColor}10`:"transparent"}}
          onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.background="#F4F6FA";}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=isSel?`${selColor}10`:"transparent";}}>
          {!isReq&&hasChildren
            ?exp[node.id]?<ChevronDown size={11} style={{color:T.t3,flexShrink:0}}/>:<ChevronRight size={11} style={{color:T.t3,flexShrink:0}}/>
            :<span style={{width:11,display:"inline-block",flexShrink:0}}/>}
          {isReq
            ?<ClipboardList size={12} style={{color:T.purple,flexShrink:0,opacity:isSel?1:.6}}/>
            :hasChildren
              ?exp[node.id]?<FolderOpen size={12} style={{color:T.warning,flexShrink:0}}/>:<Folder size={12} style={{color:T.warning,flexShrink:0}}/>
              :<Folder size={12} style={{color:T.warning,flexShrink:0}}/>}
          <span style={{fontSize:12,flex:1,textAlign:"left",
            color:isSel?selColor:T.t1,fontWeight:isSel?500:400}}>{node.label}</span>
          {isSel&&<Check size={11} style={{color:selColor,flexShrink:0}}/>}
        </button>
        {!isReq&&hasChildren&&exp[node.id]&&node.children.map(c=>renderNode(c,depth+1))}
      </div>
    );
  };

  return(
    <div style={{position:"fixed",inset:0,zIndex:60,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(29,33,41,0.5)"}} onClick={onClose}/>
      <div style={{position:"relative",background:"#fff",borderRadius:12,width:380,overflow:"hidden",boxShadow:"0 16px 48px rgba(0,0,0,0.18)"}}>
        <div style={{height:3,background:T.primary}}/>
        <div style={{padding:"16px 20px 12px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{fontSize:15,fontWeight:600,color:T.t1,marginBottom:3}}>选择保存路径</div>
          <div style={{fontSize:12,color:T.t3}}>选择目录或需求，生成的用例将保存到该位置</div>
        </div>
        <div style={{maxHeight:300,overflowY:"auto",padding:"6px 10px"}}>
          {CASE_TREE_MOCK.map(n=>renderNode(n,0))}
        </div>
        {breadcrumb.length>0&&(
          <div style={{padding:"8px 16px",borderTop:`1px solid ${T.border}`,background:"#FAFAFA"}}>
            <div style={{fontSize:11,color:T.t3,marginBottom:4}}>已选路径</div>
            <div style={{fontSize:12,color:T.t2,display:"flex",flexWrap:"wrap",alignItems:"center",gap:3}}>
              {breadcrumb.map((seg,i)=>(
                <React.Fragment key={i}>
                  {i>0&&<ChevronRight size={10} style={{color:T.t4,flexShrink:0}}/>}
                  <span style={{color:i===breadcrumb.length-1?T.primary:T.t2,fontWeight:i===breadcrumb.length-1?500:400}}>{seg}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,padding:"12px 20px",borderTop:`1px solid ${T.border}`}}>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn disabled={!selected} onClick={()=>{if(selected){const p=getNodePath(CASE_TREE_MOCK,selected);onSelect(selected,p?.join(" / ")??"");}}}>确认选择</PBtn>
        </div>
      </div>
    </div>
  );
}

function AiGenPage({onShowProgress}:{onShowProgress:()=>void}){
  const[desc,setDesc]=useState("");
  const[outputMode,setOutputMode]=useState<"stream"|"complete">("stream");
  const[savePath,setSavePath]=useState("");
  const[showPathPicker,setShowPathPicker]=useState(false);

  return(
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-5">
        <h2 className="text-[17px] font-semibold" style={{color:T.t1}}>AI 用例生成</h2>
        <p className="text-[13px] mt-1" style={{color:T.t3}}>基于需求文档或手动输入，自动生成并 AI 评审测试用例草稿</p>
      </div>

      {/* Main input area */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Left: Manual input */}
        <div className="rounded-xl bg-white p-5" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">🚀</span>
            <p className="text-[14px] font-semibold" style={{color:T.t1}}>手动输入需求描述</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-0.5 text-[12px] font-medium mb-1.5" style={{color:T.t2}}><span style={{color:T.danger}}>*</span>需求标题</label>
              <input placeholder="请输入需求标题，例如：用户登录功能需求" className="w-full h-9 px-3 border rounded-lg text-[13px] outline-none transition-all" style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.primary}18`;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
            </div>
            <div>
              <label className="flex items-center gap-0.5 text-[12px] font-medium mb-1.5" style={{color:T.t2}}><span style={{color:T.danger}}>*</span>用例保存路径</label>
              <button onClick={()=>setShowPathPicker(true)}
                className="relative w-full flex items-center gap-2 h-9 px-3 pr-9 border rounded-lg text-[13px] text-left transition-all"
                style={{borderColor:savePath?T.primary:T.border,background:"#fff",
                  boxShadow:savePath?`0 0 0 2px ${T.primary}15`:"none"}}>
                {savePath
                  ?<span className="flex-1 truncate flex items-center gap-1.5" style={{color:T.t1}}>
                      {savePath.split(" / ").map((seg,i,arr)=>(
                        <React.Fragment key={i}>
                          {i>0&&<ChevronRight size={10} style={{color:T.t4,flexShrink:0}}/>}
                          <span style={{color:i===arr.length-1?T.primary:T.t3,fontWeight:i===arr.length-1?500:400,flexShrink:i===arr.length-1?0:1,whiteSpace:"nowrap"}}>{seg}</span>
                        </React.Fragment>
                      ))}
                    </span>
                  :<span className="flex-1 truncate" style={{color:T.t4}}>请选择目录或需求路径</span>}
                <Folder size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:savePath?T.primary:T.t4}}/>
              </button>
              {savePath&&<button onClick={()=>setSavePath("")} className="mt-1 text-[11px]" style={{color:T.t3}}>清除</button>}
              {showPathPicker&&<CasePathPicker onClose={()=>setShowPathPicker(false)} onSelect={(_id,path)=>{setSavePath(path);setShowPathPicker(false);}}/>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-0.5 text-[12px] font-medium" style={{color:T.t2}}><span style={{color:T.danger}}>*</span>需求描述</label>
                <span className="text-[11px]" style={{color:T.t4}}>{desc.length}/5000</span>
              </div>
              <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="请详细描述您的需求，包括功能描述、使用场景、业务流程等" rows={8} className="w-full px-3 py-2.5 border rounded-lg text-[13px] outline-none resize-none transition-all" style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.primary}18`;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={onShowProgress}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-all"
              style={{background:desc?`linear-gradient(135deg,${T.success},#00d4ff)`:"#C9CDD4"}}
              disabled={!desc}>
              <Sparkles size={15}/>生成测试用例
            </button>
            <button className="h-10 px-4 rounded-xl border text-[13px] font-medium flex items-center gap-2 transition-colors" style={{borderColor:T.border,color:T.t2}}>
              <Eye size={14}/>查看生成流程
            </button>
          </div>
        </div>

        {/* Right: Upload doc */}
        <div className="rounded-xl bg-white p-5" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">📤</span>
            <p className="text-[14px] font-semibold" style={{color:T.t1}}>上传需求文档</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors" style={{height:260,borderColor:T.border}}
            onDragOver={e=>e.preventDefault()}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.primary}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
            <div className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center" style={{backgroundColor:"#F2F3F5"}}>
              <FileText size={24} style={{color:T.t4}}/>
            </div>
            <p className="text-[13px] font-medium mb-1" style={{color:T.t2}}>拖拽文件到此处或点击选择文件</p>
            <p className="text-[12px] mb-4" style={{color:T.t4}}>支持 PDF、Word、TXT、Markdown 格式</p>
            <PBtn icon={Upload} onClick={()=>{}} variant="ghost">选择文件</PBtn>
          </div>
          <p className="text-[11px] mt-3 text-center" style={{color:T.t4}}>上传文档后将自动提取需求内容，与手动输入内容合并使用</p>
        </div>
      </div>

      {/* Output mode */}
      <div className="rounded-xl bg-white p-5" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">⚙️</span>
          <p className="text-[14px] font-semibold" style={{color:T.t1}}>输出模式设置</p>
        </div>
        <p className="text-[12px] mb-4" style={{color:T.t3}}>先选择本次任务的输出方式。</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            {key:"stream",emoji:"⚡",title:"实时流式输出",desc:"优先展示任务执行进度和阶段状态。适合需要实时观察生成过程、希望尽快看到部分结果的场景。每条用例生成后立即展示。"},
            {key:"complete",emoji:"📋",title:"完整输出",desc:"等待生成和评审全部完成后统一返回结果。适合需要批量处理、追求结果完整性的场景。所有用例评审完成后一次性展示。"},
          ].map(o=>(
            <button key={o.key} onClick={()=>setOutputMode(o.key as any)}
              className="text-left rounded-xl p-4 border-2 transition-all"
              style={{borderColor:outputMode===o.key?T.primary:T.border,backgroundColor:outputMode===o.key?`${T.primary}05`:"#fff"}}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{o.emoji}</span>
                <p className="text-[13px] font-semibold" style={{color:outputMode===o.key?T.primary:T.t1}}>{o.title}</p>
                {outputMode===o.key&&<div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center" style={{backgroundColor:T.primary}}><Check size={10} color="#fff"/></div>}
              </div>
              <p className="text-[12px] leading-relaxed" style={{color:T.t3}}>{o.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── AI Generation Progress Modal ─────────────────────────────────────────────

function AiGenProgress({open,onClose,onComplete}:{open:boolean;onClose:()=>void;onComplete:()=>void}){
  const[step,setStep]=useState(0);
  const steps=[
    {label:"任务创建",desc:"已创建生成任务，准备启动 AI 生成流程"},
    {label:"生成中",desc:"GPT-4o 正在根据需求描述生成测试用例..."},
    {label:"AI 评审中",desc:"Claude 3.5 Sonnet 正在对生成结果进行质量评审..."},
    {label:"已完成",desc:"生成和评审完成，共生成 12 条用例，通过评审 10 条"},
  ];

  useEffect(()=>{
    if(!open){setStep(0);return;}
    const t1=setTimeout(()=>setStep(1),800);
    const t2=setTimeout(()=>setStep(2),2200);
    const t3=setTimeout(()=>setStep(3),3800);
    return ()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  },[open]);

  if(!open)return null;
  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{backgroundColor:"rgba(29,33,41,0.55)"}} onClick={onClose}/>
      <div className="relative bg-white rounded-2xl w-[520px] overflow-hidden" style={{boxShadow:"0 24px 64px rgba(0,0,0,0.2)"}}>
        <div className="h-1" style={{background:`linear-gradient(90deg,${T.success},${T.primary})`,width:`${(step/3)*100}%`,transition:"width 0.5s ease"}}/>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[15px] font-semibold" style={{color:T.t1}}>AI 正在生成测试用例</p>
              <p className="text-[12px] mt-0.5" style={{color:T.t3}}>需求：用户登录功能需求</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[18px]" style={{color:T.t4}}>×</button>
          </div>
          {/* Steps */}
          <div className="space-y-3 mb-5">
            {steps.map((s,i)=>(
              <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-lg transition-all" style={{backgroundColor:i===step?`${T.primary}08`:i<step?"#F6FFED":"#F7F8FA"}}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{backgroundColor:i<step?T.success:i===step?T.primary:"#E5E6EB"}}>
                  {i<step ? <Check size={12} color="#fff"/> : i===step&&step<3 ? <RefreshCw size={11} color="#fff" className="animate-spin"/> : <span className="text-[11px] font-bold" style={{color:i>step?T.t4:"#fff"}}>{i+1}</span>}
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium" style={{color:i<=step?T.t1:T.t3}}>{s.label}</p>
                  {i===step&&<p className="text-[12px] mt-0.5" style={{color:T.t3}}>{s.desc}</p>}
                  {i<step&&<p className="text-[12px] mt-0.5" style={{color:T.success}}>✓ 已完成</p>}
                </div>
              </div>
            ))}
          </div>
          {/* Model info */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg mb-5" style={{backgroundColor:"#F7F8FA"}}>
            <Bot size={14} style={{color:T.t3}}/>
            <div className="flex-1 text-[12px]" style={{color:T.t3}}>
              生成模型：<span style={{color:T.t1}}>GPT-4o</span>　评审模型：<span style={{color:T.t1}}>Claude 3.5 Sonnet</span>
            </div>
          </div>
          <div className="flex gap-3">
            {step===3
              ? <button onClick={()=>{onClose();onComplete();}} className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white" style={{backgroundColor:T.success}}>查看生成结果</button>
              : <button className="flex-1 h-10 rounded-xl text-[13px] font-medium border" style={{borderColor:T.border,color:T.t2}} onClick={onClose}>后台运行，稍后查看</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI Records Page ──────────────────────────────────────────────────────────

function AiRecordsPage({onViewDetail}:{onViewDetail:(t:AiTask)=>void}){
  const[tasks]=useState<AiTask[]>(AI_TASKS);
  const stats=[{label:"任务总数",value:tasks.length,color:T.t1},{label:"已完成",value:tasks.filter(t=>t.status==="completed").length,color:T.success},{label:"进行中",value:tasks.filter(t=>["reviewing","generating"].includes(t.status)).length,color:T.primary},{label:"失败",value:tasks.filter(t=>t.status==="failed").length,color:T.danger}];

  return(
    <div className="flex-1 overflow-y-auto p-6">
      <PageHead title="AI 生成记录" desc="查看所有 AI 用例生成任务的状态、结果和采纳情况"/>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {stats.map(s=>(
          <div key={s.label} className="bg-white rounded-xl px-5 py-4" style={{border:`1px solid ${T.border}`}}>
            <p className="text-[30px] font-bold" style={{color:s.color}}>{s.value}</p>
            <p className="text-[12px] mt-1" style={{color:T.t3}}>{s.label}</p>
          </div>
        ))}
      </div>
      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <Inp placeholder="搜索需求标题或任务 ID" prefix={<Search size={13}/>} width={240}/>
        <Sel width={110}><option>全部状态</option><option>已完成</option><option>进行中</option><option>失败</option></Sel>
        <Sel width={140}><option>全部操作人</option><option>张程远</option><option>李明</option><option>王芳</option></Sel>
      </div>
      {/* Table */}
      <ETable total={tasks.length} cols={[
        {label:"任务 ID",width:"14%"},{label:"对应需求",width:"22%"},
        {label:"状态",width:"8%"},{label:"生成数量",width:"7%"},
        {label:"已评审",width:"7%"},{label:"已采纳",width:"7%"},
        {label:"生成模型",width:"10%"},{label:"生成时间",width:"13%"},
        {label:"操作人",width:"7%"},{label:"操作",width:"5%",align:"right"},
      ]}>
        {tasks.map(t=>{
          const ts=AI_TASK_STATUS[t.status];
          return(
            <TR key={t.id} onClick={()=>onViewDetail(t)}>
              <TD mono><span className="text-[11px]" style={{color:T.t3}}>{t.id}</span></TD>
              <TD><span className="font-medium truncate block max-w-[160px]" style={{color:T.primary}}>{t.requirement}</span></TD>
              <TD><span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{backgroundColor:ts.bg,color:ts.color}}>{ts.label}</span></TD>
              <TD align="center"><span className="font-semibold" style={{color:T.t1}}>{t.generated||"—"}</span></TD>
              <TD align="center"><span style={{color:T.t1}}>{t.reviewed||"—"}</span></TD>
              <TD align="center"><span style={{color:t.adopted>0?T.success:T.t4}}>{t.adopted||"—"}</span></TD>
              <TD muted><code className="font-mono text-[11px]">{t.model}</code></TD>
              <TD mono muted>{t.createdAt}</TD>
              <TD muted>{t.operator}</TD>
              <TD align="right">
                <div className="flex items-center justify-end">
                  <IBtn icon={Eye} label="查看详情" onClick={()=>onViewDetail(t)}/>
                  <IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/>
                </div>
              </TD>
            </TR>
          );
        })}
      </ETable>
    </div>
  );
}

// ─── AI Record Detail + Generated Cases ──────────────────────────────────────

function RecordCaseDrawer({c,cases,idx,onClose,onAdopt,onSave,onNav}:{
  c:AiGenCase; cases:AiGenCase[]; idx:number;
  onClose:()=>void; onAdopt:(id:string,s:AdoptStatus)=>void;
  onSave:(id:string,patch:Partial<AiGenCase>)=>void;
  onNav:(dir:-1|1)=>void;
}){
  const[appliedSuggestion,setAppliedSuggestion]=useState<boolean|null>(null);
  const[editMode,setEditMode]=useState(false);
  const[editData,setEditData]=useState<CaseContent>(c.originalCase??{title:"",precondition:"",steps:[""],expected:""});

  useEffect(()=>{ setAppliedSuggestion(null); setEditMode(false); setEditData(c.originalCase??{title:"",precondition:"",steps:[""],expected:""}); },[c.id]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(editMode) return;
      if(e.key==="ArrowLeft")onNav(-1);
      else if(e.key==="ArrowRight")onNav(1);
      else if(e.key==="Escape")onClose();
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[onNav,onClose,editMode]);

  const ps=PRIORITY_STYLE[c.priority];

  const RS_STYLE:Record<AiReviewStatus,{label:string;color:string;bg:string}> = {
    approved:        {label:"评审通过",   color:T.success, bg:`${T.success}12`},
    rejected:        {label:"评审未通过", color:T.danger,  bg:`${T.danger}10`},
    change_suggested:{label:"建议优化",   color:T.warning, bg:`${T.warning}12`},
    confirm_required:{label:"待确认",     color:"#886500", bg:"#FFFBE8"},
    pending:         {label:"待评审",     color:T.t3,      bg:"#F2F3F5"},
  };
  const rs=RS_STYLE[c.reviewStatus];

  const setStep=(i:number,v:string)=>setEditData(d=>{const s=[...d.steps];s[i]=v;return{...d,steps:s};});
  const addStep=()=>setEditData(d=>({...d,steps:[...d.steps,""]}));
  const removeStep=(i:number)=>setEditData(d=>({...d,steps:d.steps.filter((_,idx2)=>idx2!==i)}));

  const handleSave=()=>{
    const cleaned={...editData,title:editData.title.trim(),precondition:editData.precondition.trim(),steps:editData.steps.map(s=>s.trim()).filter(s=>s),expected:editData.expected.trim()};
    if(!cleaned.title||!cleaned.steps.length||!cleaned.expected) return;
    onSave(c.id,{originalCase:cleaned});
    setEditMode(false);
  };

  // 用例内容区（无外框，样式与用例管理查看抽屉一致）
  const CaseBlock=({cc,label,accentColor,tag}:{cc:CaseContent;label:string;accentColor:string;tag?:string})=>(
    <div>
      {/* tag 徽标（建议优化"已应用"时展示） */}
      {tag&&(
        <div style={{marginBottom:14}}>
          <span style={{fontSize:11,padding:"2px 8px",borderRadius:3,background:`${accentColor}18`,color:accentColor,fontWeight:600}}>{tag}</span>
        </div>
      )}
      {/* 前置条件 */}
      <div style={{marginBottom:20}}>
        <p style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:8}}>前置条件</p>
        <div style={{fontSize:13,padding:"10px 14px",borderRadius:8,backgroundColor:"#F7F8FA",color:T.t1,lineHeight:1.7}}>{cc.precondition||"无"}</div>
      </div>
      {/* 测试步骤 */}
      <div style={{marginBottom:20}}>
        <p style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:8}}>测试步骤</p>
        <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden"}}>
          {cc.steps.map((step,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 16px",borderBottom:i<cc.steps.length-1?`1px solid ${T.border}`:"none"}}>
              <span style={{width:20,height:20,borderRadius:"50%",backgroundColor:`${T.primary}15`,color:T.primary,fontSize:11,fontWeight:700,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",marginTop:1}}>{i+1}</span>
              <span style={{fontSize:13,color:T.t1,lineHeight:1.6,flex:1}}>{step}</span>
            </div>
          ))}
        </div>
      </div>
      {/* 预期结果 */}
      <div>
        <p style={{fontSize:12,fontWeight:600,color:T.t2,marginBottom:8}}>预期结果</p>
        <div style={{fontSize:13,padding:"10px 16px",borderRadius:8,backgroundColor:"#F6FFED",border:`1px solid #B7EB8F`,color:T.t1,lineHeight:1.7}}>{cc.expected}</div>
      </div>
    </div>
  );

  // 编辑表单
  const iStyle:React.CSSProperties={width:"100%",fontSize:13,padding:"7px 10px",border:`1px solid ${T.border}`,borderRadius:6,outline:"none",color:T.t1,background:"#fff",boxSizing:"border-box"};
  const EditForm=(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div>
        <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:5}}>用例标题</div>
        <input value={editData.title} onChange={e=>setEditData(d=>({...d,title:e.target.value}))}
          style={iStyle} placeholder="请输入用例标题"
          onFocus={e=>{e.currentTarget.style.borderColor=T.primary;}}
          onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
      </div>
      <div>
        <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:5}}>前置条件</div>
        <textarea value={editData.precondition} onChange={e=>setEditData(d=>({...d,precondition:e.target.value}))}
          rows={2} style={{...iStyle,resize:"vertical",lineHeight:1.6}} placeholder="前置条件（选填）"
          onFocus={e=>{e.currentTarget.style.borderColor=T.primary;}}
          onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
      </div>
      <div>
        <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:5,display:"flex",alignItems:"center",gap:6}}>
          测试步骤
          <button onClick={addStep} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:3,fontSize:11,color:T.primary,background:"none",border:"none",cursor:"pointer",padding:0}}>
            <PlusCircle size={12}/>添加步骤
          </button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {editData.steps.map((step,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,fontWeight:700,color:T.t4,minWidth:18,textAlign:"center"}}>{i+1}</span>
              <input value={step} onChange={e=>setStep(i,e.target.value)}
                style={{...iStyle,flex:1}} placeholder={`步骤 ${i+1}`}
                onFocus={e=>{e.currentTarget.style.borderColor=T.primary;}}
                onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
              {editData.steps.length>1&&(
                <button onClick={()=>removeStep(i)} style={{background:"none",border:"none",cursor:"pointer",color:T.t4,lineHeight:0,padding:2,flexShrink:0}}
                  onMouseEnter={e=>{e.currentTarget.style.color=T.danger;}}
                  onMouseLeave={e=>{e.currentTarget.style.color=T.t4;}}>
                  <X size={13}/>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:5}}>预期结果</div>
        <textarea value={editData.expected} onChange={e=>setEditData(d=>({...d,expected:e.target.value}))}
          rows={3} style={{...iStyle,resize:"vertical",lineHeight:1.6}} placeholder="描述预期的测试结果"
          onFocus={e=>{e.currentTarget.style.borderColor=T.primary;}}
          onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
      </div>
    </div>
  );

  const isChangeSuggested=c.reviewStatus==="change_suggested";
  const isConfirmRequired=c.reviewStatus==="confirm_required";

  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex"}}>
      <div style={{flex:1,background:"rgba(29,33,41,.4)"}} onClick={onClose}/>
      <div style={{width:680,background:"#fff",display:"flex",flexDirection:"column",boxShadow:"-4px 0 24px rgba(0,0,0,.12)"}}>

        {/* Header */}
        <div style={{padding:"16px 24px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"flex-start",gap:12}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
              <span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:3,background:ps.bg,color:ps.color}}>{c.priority}</span>
              <span style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:3,background:`${T.cyan}15`,color:T.cyan}}>{c.angle}</span>
              <span style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:3,background:rs.bg,color:rs.color}}>{rs.label}</span>
              {c.isSupplemented&&<span style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:3,background:`${T.purple}12`,color:T.purple}}>AI 补充</span>}
            </div>
            <div style={{fontSize:15,fontWeight:600,color:T.t1,lineHeight:1.4}}>
              {editMode
                ? editData.title||"（编辑中）"
                : (isChangeSuggested&&appliedSuggestion===true&&c.suggestedCase?.title)
                  ? c.suggestedCase.title
                  : c.originalCase?.title}
            </div>
            <div style={{fontSize:12,color:T.t3,marginTop:4}}>{c.type} · {c.requirementBasis}</div>
          </div>
          <div style={{display:"flex",gap:4,flexShrink:0}}>
            {!editMode&&(
              <button onClick={()=>{
                const base=(isChangeSuggested&&appliedSuggestion===true&&c.suggestedCase)
                  ?c.suggestedCase
                  :(c.originalCase??{title:"",precondition:"",steps:[""],expected:""});
                setEditData(base);setEditMode(true);
              }} title="编辑用例"
                style={{background:"none",border:`1px solid ${T.border}`,cursor:"pointer",color:T.t2,lineHeight:0,padding:"5px 7px",borderRadius:6,display:"flex",alignItems:"center",gap:4,fontSize:12}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.color=T.primary;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.t2;}}>
                <Edit2 size={13}/>编辑
              </button>
            )}
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:4,borderRadius:6}}><X size={18}/></button>
          </div>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:"auto",padding:"20px 24px 28px"}}>

          {/* ── 编辑模式 ── */}
          {editMode&&EditForm}

          {/* ── 只读模式：用例 → AI 评审结论 ── */}
          {!editMode&&(
            <>
              {/* 当前用例卡 — change_suggested 已应用时展示优化版 */}
              {(()=>{
                const isApplied=isChangeSuggested&&appliedSuggestion===true&&c.suggestedCase!=null;
                const displayCase=isApplied?c.suggestedCase!:c.originalCase;
                return(
                  <CaseBlock
                    cc={displayCase}
                    label={isApplied?"AI 优化版本":"AI 生成用例"}
                    accentColor={isApplied?T.warning:T.t3}
                    tag={isApplied?"已应用":undefined}
                  />
                );
              })()}

              {/* AI 评审结论 */}
              <div style={{marginTop:24,padding:"12px 14px",background:rs.bg,border:`1px solid ${rs.color}30`,borderRadius:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                  <Bot size={13} color={T.purple}/>
                  <span style={{fontSize:11,fontWeight:700,color:T.purple}}>AI 评审结论</span>
                  <span style={{marginLeft:"auto",fontSize:11,fontWeight:600,padding:"1px 6px",borderRadius:3,background:`${rs.color}20`,color:rs.color}}>{rs.label}</span>
                </div>
                <p style={{fontSize:13,color:T.t2,lineHeight:1.7,margin:"0 0 8px"}}>{c.reviewReason}</p>

                {/* 建议优化：根据 appliedSuggestion 显示不同的优化交互区 */}
                {isChangeSuggested&&c.suggestedCase&&(
                  appliedSuggestion===null?(
                    /* 未决定：展示优化版内容 + 应用/保留按钮 */
                    <>
                      {c.suggestion&&(
                        <div style={{marginBottom:10,padding:"7px 10px",background:"#FFFBF0",border:`1px solid ${T.warning}30`,borderRadius:5,fontSize:12,color:T.t2,lineHeight:1.6}}>
                          <span style={{fontWeight:600,color:T.warning}}>优化说明：</span>{c.suggestion}
                        </div>
                      )}
                      <div style={{border:`1px solid ${T.warning}40`,borderRadius:5,overflow:"hidden",marginBottom:10}}>
                        <div style={{padding:"5px 10px",background:`${T.warning}15`,borderBottom:`1px solid ${T.warning}30`,display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:11,fontWeight:600,color:T.warning}}>AI 优化建议版本</span>
                          <span style={{fontSize:10,padding:"1px 5px",borderRadius:3,background:`${T.warning}20`,color:T.warning,fontWeight:600}}>推荐</span>
                        </div>
                        <div style={{padding:"10px 12px"}}>
                          <div style={{fontSize:12,fontWeight:600,color:T.t1,marginBottom:6}}>{c.suggestedCase.title}</div>
                          <div style={{marginBottom:6}}>
                            {c.suggestedCase.steps.map((s,i)=>(
                              <div key={i} style={{display:"flex",gap:6,padding:"2px 0",fontSize:12,color:T.t2}}>
                                <span style={{fontSize:11,fontWeight:700,color:T.t4,minWidth:14,flexShrink:0}}>{i+1}</span>
                                <span style={{lineHeight:1.5}}>{s}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{fontSize:12,color:T.success,padding:"4px 8px",background:`${T.success}10`,borderRadius:4,lineHeight:1.5}}>
                            <span style={{fontWeight:600}}>预期：</span>{c.suggestedCase.expected}
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setAppliedSuggestion(true)}
                          style={{flex:1,padding:"7px 0",border:`1px solid ${T.warning}`,borderRadius:5,background:T.warning,cursor:"pointer",fontSize:12,color:"#fff",fontWeight:500,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                          <Check size={12}/>应用优化版
                        </button>
                        <button onClick={()=>setAppliedSuggestion(false)}
                          style={{flex:1,padding:"7px 0",border:`1px solid ${T.border}`,borderRadius:5,background:"none",cursor:"pointer",fontSize:12,color:T.t2,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                          保留原版
                        </button>
                      </div>
                    </>
                  ):appliedSuggestion===true?(
                    /* 已应用优化版 */
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:`${T.warning}10`,border:`1px solid ${T.warning}35`,borderRadius:5,marginTop:4}}>
                      <CheckCircle size={13} color={T.warning}/>
                      <span style={{fontSize:12,color:T.warning,fontWeight:500,flex:1}}>已应用 AI 优化版本</span>
                      <button onClick={()=>setAppliedSuggestion(null)}
                        style={{fontSize:11,color:T.t3,background:"none",border:`1px solid ${T.border}`,cursor:"pointer",padding:"2px 8px",borderRadius:4,lineHeight:"18px"}}
                        onMouseEnter={e=>{e.currentTarget.style.color=T.t1;e.currentTarget.style.borderColor=T.t3;}}
                        onMouseLeave={e=>{e.currentTarget.style.color=T.t3;e.currentTarget.style.borderColor=T.border;}}>
                        撤销
                      </button>
                    </div>
                  ):(
                    /* 已保留原版 */
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:T.bg,border:`1px solid ${T.border}`,borderRadius:5,marginTop:4}}>
                      <Check size={13} color={T.t3}/>
                      <span style={{fontSize:12,color:T.t3,flex:1}}>已保留原始版本</span>
                      <button onClick={()=>setAppliedSuggestion(null)}
                        style={{fontSize:11,color:T.t3,background:"none",border:`1px solid ${T.border}`,cursor:"pointer",padding:"2px 8px",borderRadius:4,lineHeight:"18px"}}
                        onMouseEnter={e=>{e.currentTarget.style.color=T.t1;e.currentTarget.style.borderColor=T.t3;}}
                        onMouseLeave={e=>{e.currentTarget.style.color=T.t3;e.currentTarget.style.borderColor=T.border;}}>
                        重新选择
                      </button>
                    </div>
                  )
                )}

                {/* 非建议优化 — 建议/确认要点 */}
                {!isChangeSuggested&&c.suggestion&&(
                  <div style={{padding:"8px 10px",background:isConfirmRequired?"#fff":"#FFFBF0",border:`1px solid ${isConfirmRequired?"#E6C30040":T.warning+"30"}`,borderRadius:5,fontSize:12,color:T.t2,lineHeight:1.6,marginTop:4}}>
                    <span style={{fontWeight:600,color:isConfirmRequired?"#886500":T.warning}}>{isConfirmRequired?"确认要点：":"建议："}</span>{c.suggestion}
                  </div>
                )}
              </div>

              {c.risk&&(
                <div style={{marginTop:12,padding:"10px 14px",background:`${T.warning}08`,border:`1px solid ${T.warning}30`,borderRadius:6,fontSize:12,color:T.t2}}>
                  <span style={{fontWeight:600,color:T.warning}}>风险提示：</span>{c.risk}
                </div>
              )}

              {c.isSupplemented&&(
                <div style={{marginTop:12,padding:"8px 12px",background:`${T.purple}08`,border:`1px solid ${T.purple}25`,borderRadius:5,fontSize:12,color:T.purple,display:"flex",gap:8,alignItems:"flex-start"}}>
                  <Sparkles size={13} style={{flexShrink:0,marginTop:2}}/>
                  <span>此用例由 AI 在评审过程中发现覆盖缺口后自动补充生成，非原始生成用例，请确认是否符合实际业务场景后再采纳。</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{borderTop:`1px solid ${T.border}`}}>
          {/* Prev / Next — 编辑模式下隐藏 */}
          {!editMode&&(
          <div style={{padding:"8px 24px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>onNav(-1)} disabled={idx===0} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",border:`1px solid ${T.border}`,borderRadius:6,background:"none",cursor:idx===0?"not-allowed":"pointer",fontSize:12,color:idx===0?T.t4:T.t2,opacity:idx===0?.5:1}}>
              <ChevronRight size={13} style={{transform:"rotate(180deg)"}}/>上一条
            </button>
            <span style={{flex:1,textAlign:"center",fontSize:12,color:T.t3}}>{idx+1} / {cases.length}</span>
            <button onClick={()=>onNav(1)} disabled={idx===cases.length-1} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",border:`1px solid ${T.border}`,borderRadius:6,background:"none",cursor:idx===cases.length-1?"not-allowed":"pointer",fontSize:12,color:idx===cases.length-1?T.t4:T.t2,opacity:idx===cases.length-1?.5:1}}>
              下一条<ChevronRight size={13}/>
            </button>
          </div>
          )}

          {/* Action area — 编辑模式：保存/取消；正常模式：采纳操作 */}
          <div style={{padding:"12px 20px",display:"flex",gap:8,alignItems:"center"}}>
            {editMode?(
              <>
                <button onClick={()=>{setEditMode(false);setEditData(c.originalCase??{title:"",precondition:"",steps:[""],expected:"",});}}
                  style={{padding:"7px 16px",border:`1px solid ${T.border}`,borderRadius:6,background:"none",cursor:"pointer",fontSize:13,color:T.t2}}>
                  取消
                </button>
                <div style={{flex:1}}/>
                <button onClick={handleSave}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"7px 18px",border:`1px solid ${T.primary}`,borderRadius:6,background:T.primary,cursor:"pointer",fontSize:13,color:"#fff",fontWeight:500}}>
                  <Save size={13}/>保存修改
                </button>
              </>
            ):c.adoptStatus==="adopting"?(
              <span style={{fontSize:13,color:T.primary,display:"flex",alignItems:"center",gap:8}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2.5" strokeLinecap="round" style={{animation:"spin 1s linear infinite"}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                正在写入用例库...
              </span>
            ):c.adoptStatus==="adopt_failed"?(
              <>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:T.danger,marginBottom:3}}><AlertCircle size={13}/>采纳失败</div>
                  {c.adoptFailReason&&<div style={{fontSize:11,color:T.t3}}>{c.adoptFailReason}</div>}
                </div>
                <button onClick={()=>onAdopt(c.id,"discarded")} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",border:`1px solid ${T.border}`,borderRadius:6,background:"none",cursor:"pointer",fontSize:12,color:T.t2}}><ThumbsDown size={12}/>放弃</button>
                <button onClick={()=>onAdopt(c.id,"adopted")} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 16px",border:`1px solid ${T.warning}`,borderRadius:6,background:"none",cursor:"pointer",fontSize:12,color:T.warning,fontWeight:500}}><RefreshCw size={12}/>重试采纳</button>
              </>
            ):c.adoptStatus==="adopted"?(
              <>
                <span style={{fontSize:13,color:T.success,display:"flex",alignItems:"center",gap:6}}><CheckCircle size={14}/>已采纳</span>
                <div style={{flex:1}}/>
                <button onClick={()=>onAdopt(c.id,"pending")} style={{padding:"5px 12px",border:`1px solid ${T.border}`,borderRadius:6,background:"none",cursor:"pointer",fontSize:12,color:T.t2}}>撤销采纳</button>
              </>
            ):c.adoptStatus==="discarded"?(
              <>
                <span style={{fontSize:13,color:T.t3,display:"flex",alignItems:"center",gap:6}}><XCircle size={14}/>已放弃</span>
                <div style={{flex:1}}/>
                <button onClick={()=>onAdopt(c.id,"pending")} style={{padding:"5px 12px",border:`1px solid ${T.border}`,borderRadius:6,background:"none",cursor:"pointer",fontSize:12,color:T.t2}}>恢复待处理</button>
                <button onClick={()=>onAdopt(c.id,"adopted")} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",border:`1px solid ${T.success}`,borderRadius:6,background:T.success,cursor:"pointer",fontSize:12,color:"#fff"}}><ThumbsUp size={12}/>重新采纳</button>
              </>
            ):(
              /* pending — 根据评审状态显示不同操作 */
              <>
                <button onClick={()=>onAdopt(c.id,"discarded")} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",border:`1px solid ${T.danger}30`,borderRadius:6,background:"none",cursor:"pointer",fontSize:12,color:T.danger}}><ThumbsDown size={12}/>放弃此条</button>
                <div style={{flex:1}}/>
                {isChangeSuggested?(
                  <button onClick={()=>onAdopt(c.id,"adopted")}
                    style={{display:"flex",alignItems:"center",gap:5,padding:"7px 18px",border:`1px solid ${T.success}`,borderRadius:6,background:T.success,cursor:"pointer",fontSize:13,color:"#fff",fontWeight:500}}>
                    <ThumbsUp size={13}/>采纳用例
                  </button>
                ):isConfirmRequired?(
                  /* 待确认：两个按钮 */
                  <button onClick={()=>onAdopt(c.id,"adopted")} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 18px",border:`1px solid ${T.success}`,borderRadius:6,background:T.success,cursor:"pointer",fontSize:13,color:"#fff",fontWeight:500}}>
                    <ThumbsUp size={13}/>确认并采纳
                  </button>
                ):(
                  <button onClick={()=>onAdopt(c.id,"adopted")} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 18px",border:`1px solid ${T.success}`,borderRadius:6,background:T.success,cursor:"pointer",fontSize:13,color:"#fff",fontWeight:500}}>
                    <ThumbsUp size={13}/>采纳用例
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface BatchResult { success:number; failed:{id:string;title:string;reason:string}[]; }

function BatchConfirmModal({count,directory,onConfirm,onCancel}:{count:number;directory:string;onConfirm:()=>void;onCancel:()=>void}){
  return(
    <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(29,33,41,.45)"}}>
      <div style={{background:"#fff",borderRadius:10,padding:"28px 28px 24px",width:420,boxShadow:"0 12px 48px rgba(0,0,0,.18)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:"#E8F0FF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <ThumbsUp size={18} color={T.primary}/>
          </div>
          <div style={{fontSize:16,fontWeight:600,color:T.t1}}>确认批量采纳</div>
        </div>
        <div style={{fontSize:13,color:T.t2,lineHeight:1.8,marginBottom:8}}>
          即将采纳 <span style={{fontWeight:700,color:T.t1}}>{count}</span> 条待处理用例，写入用例库后不可批量撤销。
        </div>
        <div style={{fontSize:12,color:T.t3,background:"#F7F8FA",borderRadius:6,padding:"8px 12px",marginBottom:20,display:"flex",alignItems:"center",gap:6}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          保存路径：{directory}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onCancel} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:6,background:"none",cursor:"pointer",fontSize:13,color:T.t2}}>取消</button>
          <button onClick={onConfirm} style={{padding:"7px 20px",border:`1px solid ${T.primary}`,borderRadius:6,background:T.primary,cursor:"pointer",fontSize:13,color:"#fff",fontWeight:500}}>确认采纳</button>
        </div>
      </div>
    </div>
  );
}

function BatchResultModal({result,onClose,onRetry}:{result:BatchResult;onClose:()=>void;onRetry:(ids:string[])=>void}){
  const allOk=result.failed.length===0;
  return(
    <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(29,33,41,.45)"}}>
      <div style={{background:"#fff",borderRadius:10,padding:"28px 28px 24px",width:460,maxHeight:"70vh",display:"flex",flexDirection:"column",boxShadow:"0 12px 48px rgba(0,0,0,.18)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div style={{width:36,height:36,borderRadius:8,background:allOk?"#E8FFEA":"#FFF3E8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {allOk?<CheckCircle size={18} color={T.success}/>:<AlertCircle size={18} color={T.warning}/>}
          </div>
          <div style={{fontSize:16,fontWeight:600,color:T.t1}}>采纳完成</div>
        </div>
        <div style={{display:"flex",gap:16,marginBottom:result.failed.length>0?16:0}}>
          <div style={{flex:1,background:"#E8FFEA",borderRadius:8,padding:"12px 16px",textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:700,color:T.success}}>{result.success}</div>
            <div style={{fontSize:11,color:T.success,marginTop:2}}>成功写入</div>
          </div>
          {result.failed.length>0&&(
            <div style={{flex:1,background:"#FFF3E8",borderRadius:8,padding:"12px 16px",textAlign:"center"}}>
              <div style={{fontSize:24,fontWeight:700,color:T.warning}}>{result.failed.length}</div>
              <div style={{fontSize:11,color:T.warning,marginTop:2}}>写入失败</div>
            </div>
          )}
        </div>
        {result.failed.length>0&&(
          <div style={{flex:1,overflowY:"auto",marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>失败详情</div>
            {result.failed.map(f=>(
              <div key={f.id} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 10px",borderRadius:6,background:"#FFF7F7",marginBottom:6,border:`1px solid ${T.danger}20`}}>
                <XCircle size={13} color={T.danger} style={{flexShrink:0,marginTop:2}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,color:T.t1,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.title}</div>
                  <div style={{fontSize:11,color:T.t3}}>{f.reason}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"7px 18px",border:`1px solid ${T.border}`,borderRadius:6,background:"none",cursor:"pointer",fontSize:13,color:T.t2}}>关闭</button>
          {result.failed.length>0&&(
            <button onClick={()=>onRetry(result.failed.map(f=>f.id))} style={{padding:"7px 18px",border:`1px solid ${T.warning}`,borderRadius:6,background:"none",cursor:"pointer",fontSize:13,color:T.warning,display:"flex",alignItems:"center",gap:5}}>
              <RefreshCw size={12}/>重试失败项
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AiRecordDetail({task,onBack}:{task:AiTask;onBack:()=>void}){
  const[cases,setCases]=useState<AiGenCase[]>(AI_GEN_CASES);
  const[selected,setSelected]=useState<Set<string>>(new Set());
  const[filterTab,setFilterTab]=useState("all");
  const[searchQ,setSearchQ]=useState("");
  const[expandedId,setExpandedId]=useState<string|null>(null);
  const[drawerCase,setDrawerCase]=useState<AiGenCase|null>(null);
  const[batchConfirmIds,setBatchConfirmIds]=useState<string[]|null>(null);
  const[batchResult,setBatchResult]=useState<BatchResult|null>(null);
  const[batchProgress,setBatchProgress]=useState<{done:number;total:number}|null>(null);

  // Async single adoption: pending → adopting → adopted | adopt_failed
  const adopt=(id:string,status:AdoptStatus)=>{
    if(status==="adopted"){
      setCases(cs=>cs.map(c=>c.id===id?{...c,adoptStatus:"adopting",adoptFailReason:undefined}:c));
      setTimeout(()=>{
        setCases(cs=>cs.map(c=>c.id===id?{...c,adoptStatus:"adopted"}:c));
      },1300);
    } else {
      setCases(cs=>cs.map(c=>c.id===id?{...c,adoptStatus:status,adoptFailReason:undefined}:c));
    }
  };

  const retryAdopt=(id:string)=>adopt(id,"adopted");

  const saveCase=(id:string,patch:Partial<AiGenCase>)=>setCases(cs=>cs.map(c=>c.id===id?{...c,...patch}:c));

  // Batch adoption: runs cases one by one with simulated async, 1 failure if 4+ cases
  const runBatch=(ids:string[])=>{
    const failIdx=ids.length>=4?2:-1;
    const succeeded:{id:string}[]=[];
    const failed:{id:string;title:string;reason:string}[]=[];
    // capture titles before async starts so the closure always has them
    const titleMap=new Map(cases.map(c=>[c.id,c.originalCase?.title??c.id]));

    setCases(cs=>cs.map(c=>ids.includes(c.id)?{...c,adoptStatus:"adopting"}:c));
    setBatchProgress({done:0,total:ids.length});

    const process=(i:number)=>{
      if(i>=ids.length){
        setBatchProgress(null);
        setSelected(new Set());
        setBatchResult({success:succeeded.length,failed});
        return;
      }
      const id=ids[i];
      const willFail=i===failIdx;
      setTimeout(()=>{
        setCases(cs=>cs.map(c=>{
          if(c.id!==id) return c;
          if(willFail){
            failed.push({id,title:titleMap.get(id)??id,reason:"写入用例库失败：目标路径无写入权限"});
            return{...c,adoptStatus:"adopt_failed",adoptFailReason:"写入用例库失败：目标路径无写入权限"};
          }
          succeeded.push({id});
          return{...c,adoptStatus:"adopted"};
        }));
        setBatchProgress({done:i+1,total:ids.length});
        process(i+1);
      },350);
    };
    process(0);
  };

  const openBatchConfirm=()=>{
    const targetIds=selected.size>0
      ? Array.from(selected).filter(id=>cases.find(c=>c.id===id)?.adoptStatus==="pending")
      : cases.filter(c=>c.adoptStatus==="pending").map(c=>c.id);
    if(targetIds.length===0) return;
    setBatchConfirmIds(targetIds);
  };

  const retryBatch=(ids:string[])=>{
    setBatchResult(null);
    runBatch(ids);
  };

  const ts=AI_TASK_STATUS[task.status];
  const adoptedCount=cases.filter(c=>c.adoptStatus==="adopted").length;
  const discardedCount=cases.filter(c=>c.adoptStatus==="discarded").length;
  const pendingCount=cases.filter(c=>c.adoptStatus==="pending").length;
  const adoptingCount=cases.filter(c=>c.adoptStatus==="adopting").length;
  const failedCount=cases.filter(c=>c.adoptStatus==="adopt_failed").length;
  const passedCount=cases.filter(c=>c.reviewStatus==="approved").length;

  const TABS=[
    {key:"all",label:"全部",count:cases.length},
    {key:"pending",label:"待采纳",count:pendingCount},
    {key:"adopting",label:"采纳中",count:adoptingCount},
    {key:"adopted",label:"已采纳",count:adoptedCount},
    {key:"discarded",label:"已放弃",count:discardedCount},
    {key:"adopt_failed",label:"采纳失败",count:failedCount},
  ];

  const filtered=cases.filter(c=>{
    const title=c.originalCase?.title??"";
    const mq=!searchQ||title.toLowerCase().includes(searchQ.toLowerCase())||c.type.includes(searchQ);
    const ms=filterTab==="all"||c.adoptStatus===filterTab;
    return mq&&ms;
  });

  const drawerIdx=drawerCase?filtered.findIndex(c=>c.id===drawerCase.id):-1;
  const navDrawer=(dir:-1|1)=>{
    const ni=drawerIdx+dir;
    if(ni>=0&&ni<filtered.length) setDrawerCase(filtered[ni]);
  };

  const reviewColor=(s:AiReviewStatus)=>({approved:T.success,rejected:T.danger,change_suggested:T.warning,confirm_required:"#886500",pending:T.t3}[s]);
  const reviewBg=(s:AiReviewStatus)=>({approved:`${T.success}12`,rejected:`${T.danger}10`,change_suggested:`${T.warning}12`,confirm_required:"#FFFBE8",pending:"#F2F3F5"}[s]);
  const reviewLabel=(s:AiReviewStatus)=>({approved:"评审通过",rejected:"评审未通过",change_suggested:"建议优化",confirm_required:"待确认",pending:"待评审"}[s]);

  return(
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Compact task header bar ── */}
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,padding:"0 24px",flexShrink:0}}>
        {/* Breadcrumb */}
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"10px 0 0",fontSize:12}}>
          <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:4,color:T.t3,background:"none",border:"none",cursor:"pointer",padding:0}} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
            <ChevronLeft size={13}/>AI 生成记录
          </button>
          <ChevronRight size={12} color={T.t4}/>
          <span style={{color:T.t2}}>任务详情</span>
        </div>

        {/* Task summary row */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",flexWrap:"wrap"}}>
          <code style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:"#F2F3F5",color:T.t3,fontFamily:"monospace"}}>{task.id}</code>
          <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,background:ts.bg,color:ts.color}}>{ts.label}</span>
          <span style={{fontSize:15,fontWeight:600,color:T.t1,flex:1}}>{task.requirement}</span>
          <span style={{fontSize:12,color:T.t3}}>{task.createdAt} · {task.operator}</span>
          <button onClick={()=>{}} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",border:`1px solid ${T.border}`,borderRadius:6,background:"none",cursor:"pointer",fontSize:12,color:T.t2}}>
            <RefreshCw size={12}/>重新生成
          </button>
        </div>

        {/* Stats strip */}
        <div style={{display:"flex",gap:0,borderTop:`1px solid ${T.border}`}}>
          {[
            {label:"生成总数",value:task.generated,color:T.t1},
            {label:"评审通过",value:passedCount,color:T.success},
            {label:"待采纳",value:pendingCount,color:T.warning},
            {label:"已采纳",value:adoptedCount,color:T.primary},
            {label:"已放弃",value:discardedCount,color:T.t3},
            {label:"采纳失败",value:failedCount,color:failedCount>0?T.danger:T.t4},
            {label:"生成模型",value:task.model,color:T.t2,mono:true},
          ].map((s)=>(
            <div key={s.label} style={{padding:"10px 18px",borderRight:`1px solid ${T.border}`,minWidth:0}}>
              <div style={{fontSize:(s as {mono?:boolean}).mono?12:18,fontWeight:(s as {mono?:boolean}).mono?400:700,color:s.color,lineHeight:1,fontFamily:(s as {mono?:boolean}).mono?"monospace":undefined,whiteSpace:"nowrap"}}>{s.value}</div>
              <div style={{fontSize:11,color:T.t4,marginTop:3,whiteSpace:"nowrap"}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        {/* Filter tabs */}
        <div style={{display:"flex",alignItems:"center",gap:0,padding:"0 24px",borderBottom:`1px solid ${T.border}`}}>
          {TABS.map(tab=>{
            const active=filterTab===tab.key;
            const isFailTab=tab.key==="adopt_failed";
            return(
              <button key={tab.key} onClick={()=>setFilterTab(tab.key)}
                style={{display:"flex",alignItems:"center",gap:5,padding:"9px 14px",border:"none",borderBottom:active?`2px solid ${isFailTab?T.danger:T.primary}`:"2px solid transparent",background:"none",cursor:"pointer",fontSize:13,color:active?(isFailTab?T.danger:T.primary):T.t3,fontWeight:active?600:400,marginBottom:-1,whiteSpace:"nowrap"}}>
                {tab.label}
                {tab.count>0&&<span style={{fontSize:11,padding:"1px 5px",borderRadius:8,background:active?(isFailTab?`${T.danger}15`:`${T.primary}15`):"#F2F3F5",color:active?(isFailTab?T.danger:T.primary):T.t3,fontWeight:600}}>{tab.count}</span>}
              </button>
            );
          })}
          <div style={{flex:1}}/>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="搜索用例名称..."
            style={{padding:"5px 12px",border:`1px solid ${T.border}`,borderRadius:6,fontSize:12,width:180,outline:"none",color:T.t1,margin:"4px 0"}}
            onFocus={e=>e.target.style.borderColor=T.primary} onBlur={e=>e.target.style.borderColor=T.border}
          />
        </div>
        {/* Selection row */}
        <div style={{padding:"8px 24px",display:"flex",alignItems:"center",gap:10}}>
          <input type="checkbox"
            checked={selected.size===filtered.length&&filtered.length>0}
            onChange={()=>selected.size===filtered.length?setSelected(new Set()):setSelected(new Set(filtered.map(c=>c.id)))}
            style={{cursor:"pointer",width:14,height:14}}
          />
          {batchProgress
            ? <span style={{fontSize:12,color:T.primary,display:"flex",alignItems:"center",gap:6}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                正在采纳 {batchProgress.done} / {batchProgress.total}...
              </span>
            : selected.size>0
              ? <span style={{fontSize:12,color:T.t2}}>已选 {selected.size} 条</span>
              : <span style={{fontSize:12,color:T.t4}}>{filtered.length} 条</span>
          }
          <div style={{flex:1}}/>
          {!batchProgress&&(
            selected.size>0
              ? <button onClick={openBatchConfirm} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",border:`1px solid ${T.success}`,borderRadius:6,background:T.success,cursor:"pointer",fontSize:12,color:"#fff",fontWeight:500}}>
                  <ThumbsUp size={11}/>批量采纳 ({selected.size})
                </button>
              : <button onClick={openBatchConfirm} disabled={pendingCount===0} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 14px",border:`1px solid ${pendingCount===0?T.border:T.border}`,borderRadius:6,background:"none",cursor:pendingCount===0?"not-allowed":"pointer",fontSize:12,color:pendingCount===0?T.t4:T.t2,opacity:pendingCount===0?.5:1}}>
                  <ThumbsUp size={11}/>全部采纳 ({pendingCount})
                </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{flex:1,overflowY:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead style={{position:"sticky",top:0,zIndex:1}}>
            <tr style={{background:"#F7F8FA",borderBottom:`1px solid ${T.border}`}}>
              <th style={{width:40,padding:"10px 16px"}}></th>
              <th style={{padding:"10px 16px",textAlign:"left",fontSize:11,fontWeight:600,color:T.t3,textTransform:"uppercase",letterSpacing:".5px"}}>用例名称</th>
              <th style={{padding:"10px 8px",textAlign:"center",fontSize:11,fontWeight:600,color:T.t3,whiteSpace:"nowrap"}}>类型</th>
              <th style={{padding:"10px 8px",textAlign:"center",fontSize:11,fontWeight:600,color:T.t3}}>优先级</th>
              <th style={{padding:"10px 8px",textAlign:"center",fontSize:11,fontWeight:600,color:T.t3}}>评审结果</th>
              <th style={{padding:"10px 8px",textAlign:"center",fontSize:11,fontWeight:600,color:T.t3}}>采纳状态</th>
              <th style={{padding:"10px 16px",textAlign:"center",fontSize:11,fontWeight:600,color:T.t3}}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c=>{
              const ps=PRIORITY_STYLE[c.priority];
              const isAdopting=c.adoptStatus==="adopting";
              const isFailed=c.adoptStatus==="adopt_failed";
              return(
                <React.Fragment key={c.id}>
                  <tr style={{borderBottom:`1px solid ${T.border}`,background:isFailed?`${T.danger}04`:selected.has(c.id)?`${T.primary}06`:"#fff",opacity:isAdopting?.7:1}}
                    onMouseEnter={e=>{if(!selected.has(c.id)&&!isFailed)e.currentTarget.style.background="#FAFBFF";}}
                    onMouseLeave={e=>{if(!selected.has(c.id))e.currentTarget.style.background=isFailed?`${T.danger}04`:"#fff";}}>
                    <td style={{padding:"12px 16px",textAlign:"center"}}>
                      <input type="checkbox" checked={selected.has(c.id)} disabled={isAdopting}
                        onChange={()=>setSelected(s=>{const n=new Set(s);n.has(c.id)?n.delete(c.id):n.add(c.id);return n;})}
                        style={{cursor:isAdopting?"not-allowed":"pointer",width:14,height:14}}
                      />
                    </td>
                    <td style={{padding:"12px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                        <button onClick={()=>setExpandedId(expandedId===c.id?null:c.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.t3,lineHeight:0,padding:0}}>
                          {expandedId===c.id?<ChevronDown size={14}/>:<ChevronRight size={14}/>}
                        </button>
                        <span style={{fontSize:13,fontWeight:500,color:T.t1}}>{c.originalCase?.title}</span>
                        {c.isSupplemented&&<span style={{fontSize:10,fontWeight:600,padding:"1px 5px",borderRadius:3,background:`${T.purple}12`,color:T.purple,flexShrink:0}}>AI补充</span>}
                      </div>
                      <div style={{fontSize:11,color:T.t3,paddingLeft:20}}>{c.angle} · {c.requirementBasis}</div>
                      {isFailed&&c.adoptFailReason&&(
                        <div style={{fontSize:11,color:T.danger,paddingLeft:20,marginTop:3,display:"flex",alignItems:"center",gap:4}}>
                          <AlertCircle size={11}/>{c.adoptFailReason}
                        </div>
                      )}
                    </td>
                    <td style={{padding:"12px 8px",textAlign:"center"}}>
                      <span style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:3,background:`${T.primary}15`,color:T.primary}}>{c.type}</span>
                    </td>
                    <td style={{padding:"12px 8px",textAlign:"center"}}>
                      <span style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:3,background:ps.bg,color:ps.color}}>{c.priority}</span>
                    </td>
                    <td style={{padding:"12px 8px",textAlign:"center"}}>
                      <span style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:3,background:reviewBg(c.reviewStatus),color:reviewColor(c.reviewStatus)}}>{reviewLabel(c.reviewStatus)}</span>
                    </td>
                    <td style={{padding:"12px 8px",textAlign:"center"}}>
                      {isAdopting&&(
                        <span style={{fontSize:11,color:T.primary,display:"inline-flex",alignItems:"center",gap:4}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2.5" strokeLinecap="round" style={{animation:"spin 1s linear infinite"}}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                          采纳中
                        </span>
                      )}
                      {isFailed&&<span style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:3,background:"#FFE8E8",color:T.danger}}>采纳失败</span>}
                      {c.adoptStatus==="adopted"&&<span style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:3,background:"#E8F0FF",color:T.primary}}>已采纳</span>}
                      {c.adoptStatus==="discarded"&&<span style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:3,background:"#F7F8FA",color:T.t3}}>已放弃</span>}
                      {c.adoptStatus==="pending"&&<span style={{fontSize:11,color:T.t4}}>待采纳</span>}
                    </td>
                    <td style={{padding:"12px 16px",textAlign:"center"}}>
                      <div style={{display:"flex",gap:4,justifyContent:"center",alignItems:"center"}}>
                        <button onClick={()=>setDrawerCase(c)} title="查看详情" style={{background:"none",border:"none",cursor:"pointer",color:T.t3,padding:4,lineHeight:0}}><Eye size={14}/></button>
                        {isAdopting&&<span style={{fontSize:11,color:T.t4}}>处理中</span>}
                        {isFailed&&(
                          <>
                            <button onClick={()=>retryAdopt(c.id)} title="重试" style={{display:"flex",alignItems:"center",gap:3,padding:"3px 8px",border:`1px solid ${T.warning}`,borderRadius:4,background:"none",cursor:"pointer",fontSize:11,color:T.warning}}>
                              <RefreshCw size={11}/>重试
                            </button>
                            <button onClick={()=>adopt(c.id,"discarded")} title="放弃" style={{background:"none",border:"none",cursor:"pointer",color:T.t4,padding:4,lineHeight:0}}><ThumbsDown size={13}/></button>
                          </>
                        )}
                        {c.adoptStatus==="pending"&&(
                          <>
                            <button onClick={()=>adopt(c.id,"adopted")} title="采纳" style={{background:"none",border:"none",cursor:"pointer",color:T.success,padding:4,lineHeight:0}}><ThumbsUp size={14}/></button>
                            <button onClick={()=>adopt(c.id,"discarded")} title="放弃" style={{background:"none",border:"none",cursor:"pointer",color:T.t4,padding:4,lineHeight:0}}><ThumbsDown size={14}/></button>
                          </>
                        )}
                        {(c.adoptStatus==="adopted"||c.adoptStatus==="discarded")&&(
                          <button onClick={()=>adopt(c.id,"pending")} title="撤销" style={{background:"none",border:"none",cursor:"pointer",color:T.t4,padding:4,lineHeight:0,fontSize:11}}>撤销</button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expandedId===c.id&&(
                    <tr style={{background:`${T.primary}03`,borderBottom:`1px solid ${T.border}`}}>
                      <td/>
                      <td colSpan={6} style={{padding:"12px 24px 16px"}}>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                          <div>
                            <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:6}}>测试步骤</div>
                            {(c.originalCase?.steps??[]).map((s,i)=><div key={i} style={{fontSize:12,color:T.t2,lineHeight:1.7}}>{i+1}. {s}</div>)}
                          </div>
                          <div>
                            <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:6}}>预期结果</div>
                            <div style={{fontSize:12,color:T.t2,lineHeight:1.6,marginBottom:10}}>{c.originalCase?.expected}</div>
                            {c.reviewStatus!=="pending"&&c.reviewReason&&(
                              <div style={{padding:"8px 10px",background:reviewBg(c.reviewStatus),borderRadius:5,fontSize:12,color:T.t2}}>
                                <span style={{fontWeight:600,color:reviewColor(c.reviewStatus)}}>评审：</span>{c.reviewReason}
                              </div>
                            )}
                            {c.suggestion&&(
                              <div style={{marginTop:6,padding:"8px 10px",background:"#FFFBF0",borderRadius:5,fontSize:12,color:T.warning}}>💡 {c.suggestion}</div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length===0&&(
          <div style={{padding:"60px 0",textAlign:"center"}}>
            <Search size={32} color={T.t4} style={{margin:"0 auto 10px"}}/>
            <div style={{fontSize:14,color:T.t3}}>没有匹配的用例</div>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawerCase&&(
        <RecordCaseDrawer
          c={cases.find(x=>x.id===drawerCase.id)??drawerCase}
          cases={filtered}
          idx={drawerIdx>=0?drawerIdx:0}
          onClose={()=>setDrawerCase(null)}
          onAdopt={(id,s)=>{adopt(id,s);}}
          onSave={(id,patch)=>{saveCase(id,patch);}}
          onNav={navDrawer}
        />
      )}

      {/* Batch confirm modal */}
      {batchConfirmIds&&(
        <BatchConfirmModal
          count={batchConfirmIds.length}
          directory={`${task.project} / ${task.directory}`}
          onCancel={()=>setBatchConfirmIds(null)}
          onConfirm={()=>{const ids=batchConfirmIds;setBatchConfirmIds(null);runBatch(ids);}}
        />
      )}

      {/* Batch result modal */}
      {batchResult&&(
        <BatchResultModal
          result={batchResult}
          onClose={()=>setBatchResult(null)}
          onRetry={ids=>{setBatchResult(null);retryBatch(ids);}}
        />
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Cases Module container ───────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// CASE EXEC WORKSTATION
// ═══════════════════════════════════════════════════════════════════════════════

// Defect types for the workstation
interface WDefect { id:string; no:string; title:string; priority:Priority; status:"new"|"in-progress"|"resolved"|"closed"; assignee:string; updatedAt:string; }
const W_LINKED: WDefect[] = [
  {id:"d01",no:"BUG-2024-0089",title:"测试失败：提示文案与需求文档描述不符",priority:"P1",status:"new",assignee:"陈伟",updatedAt:"2026-01-11 09:20"},
  {id:"d02",no:"BUG-2024-0092",title:"执行失败后密码框内容被意外清空",priority:"P2",status:"in-progress",assignee:"赵雷",updatedAt:"2026-01-11 16:45"},
];
const W_CANDIDATES: WDefect[] = [
  {id:"d03",no:"BUG-2024-0094",title:"登录页提示文案与注册页不一致",priority:"P2",status:"new",assignee:"陈伟",updatedAt:"2026-01-11 11:00"},
  {id:"d04",no:"BUG-2024-0081",title:"短信冷却计数器最后 1 秒精度偏差",priority:"P3",status:"new",assignee:"张程远",updatedAt:"2026-01-10 14:00"},
];
const WDEFECT_STATUS:{[k:string]:{label:string;bg:string;color:string}}={
  "new":{label:"新建",bg:"#FFE8E8",color:T.danger},
  "in-progress":{label:"处理中",bg:"#E8F3FF",color:T.primary},
  "resolved":{label:"已修复",bg:"#E8FFEA",color:T.success},
  "closed":{label:"已关闭",bg:"#F2F3F5",color:T.t3},
};

function ExecQueue({cases,activeId,onSelect}:{cases:TestCase[];activeId:string;onSelect:(id:string)=>void}){
  const[search,setSearch]=useState("");
  const filtered=cases.filter(c=>!search||c.title.toLowerCase().includes(search.toLowerCase())||c.id.toLowerCase().includes(search.toLowerCase()));
  const idx=cases.findIndex(c=>c.id===activeId);
  const counts={passed:cases.filter(c=>c.execStatus==="passed").length,failed:cases.filter(c=>c.execStatus==="failed").length,blocked:cases.filter(c=>c.execStatus==="blocked").length};
  return(
    <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:248,borderRight:`1px solid ${T.border}`,backgroundColor:"#fff"}}>
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{color:T.t4}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索编号或标题…"
            className="w-full h-7 pl-7 pr-2 border rounded-md text-[12px] outline-none"
            style={{borderColor:T.border,color:T.t1,backgroundColor:"#FAFAFA"}}/>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map(c=>{
          const active=c.id===activeId; const es=EXEC_STATUS_STYLE[c.execStatus];
          return(
            <button key={c.id} onClick={()=>onSelect(c.id)} className="w-full text-left flex flex-col px-3 py-2.5"
              style={{borderLeft:`2px solid ${active?T.primary:"transparent"}`,background:active?"#EBF3FF":"transparent",borderBottom:`1px solid ${T.border}`}}>
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[11px] font-mono flex-shrink-0" style={{color:active?T.primary:T.t4}}>{c.id}</span>
                <span className="inline-flex items-center gap-1 text-[11px] flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:es.dot}}/>
                  <span style={{color:es.color}}>{es.label}</span>
                </span>
              </div>
              <span className="text-[12px] leading-4 line-clamp-2" style={{color:active?T.primary:T.t1,fontWeight:active?500:400}}>{c.title}</span>
            </button>
          );
        })}
      </div>
      <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between" style={{borderTop:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
        <div className="flex gap-2.5 text-[11px]">
          <span style={{color:T.success}}>{counts.passed} 通过</span>
          <span style={{color:T.danger}}>{counts.failed} 失败</span>
          <span style={{color:T.warning}}>{counts.blocked} 阻塞</span>
        </div>
        <span className="text-[12px] font-mono font-semibold" style={{color:T.t2}}>{idx+1}<span style={{color:T.t4}}>/{cases.length}</span></span>
      </div>
    </div>
  );
}

function ExecDrawer({title,open,onClose,width=520,children,footer}:{title:string;open:boolean;onClose:()=>void;width?:number;children:React.ReactNode;footer?:React.ReactNode}){
  if(!open)return null;
  return(
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1" onClick={onClose} style={{background:"rgba(29,33,41,0.4)"}}/>
      <div className="flex flex-col" style={{width,background:"#fff",boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        <div className="flex items-center justify-between px-5 flex-shrink-0" style={{height:52,borderBottom:`1px solid ${T.border}`}}>
          <span className="text-[15px] font-semibold" style={{color:T.t1}}>{title}</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg" style={{color:T.t4}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}><X size={16}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer&&<div className="flex-shrink-0 px-5 py-3" style={{borderTop:`1px solid ${T.border}`,background:"#FAFAFA"}}>{footer}</div>}
      </div>
    </div>
  );
}

function CaseExecWorkstation({initCase,allCases,onBack}:{initCase:TestCase;allCases:TestCase[];onBack:()=>void}){
  const[queue,setQueue]=useState<TestCase[]>(allCases);
  const[activeId,setActiveId]=useState(initCase.id);
  const[tab,setTab]=useState<"info"|"detail"|"defects"|"history">("detail");
  const[actual,setActual]=useState("");
  const[remark,setRemark]=useState("");
  const[autoNext,setAutoNext]=useState(false);
  const[linked,setLinked]=useState<WDefect[]>(W_LINKED);
  const[showLink,setShowLink]=useState(false);
  const[showCreate,setShowCreate]=useState(false);
  const[toast,setToast]=useState<string|null>(null);

  const activeCase=queue.find(c=>c.id===activeId)??queue[0];
  const idx=queue.findIndex(c=>c.id===activeId);
  const ps=PRIORITY_STYLE[activeCase.priority];const cs=CASE_STATUS_STYLE[activeCase.status];const es=EXEC_STATUS_STYLE[activeCase.execStatus];

  const showMsg=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(null),2200);};
  const markCase=(status:ExecStatus)=>{
    setQueue(q=>q.map(c=>c.id===activeId?{...c,execStatus:status}:c));
    const labels:Record<ExecStatus,string>={passed:"通过",failed:"失败",blocked:"阻塞","not-run":"未执行"};
    showMsg(`已标记为${labels[status]}`);
    if(autoNext&&idx<queue.length-1)setTimeout(()=>setActiveId(queue[idx+1].id),600);
  };

  const tabs=[
    {key:"info" as const,label:"基本信息"},
    {key:"detail" as const,label:"详情"},
    {key:"defects" as const,label:linked.length>0?`关联缺陷 (${linked.length})`:"关联缺陷"},
    {key:"history" as const,label:"执行历史"},
  ];

  return(
    <div className="flex-1 flex flex-col overflow-hidden" style={{background:T.bg}}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 flex-shrink-0 bg-white" style={{height:52,borderBottom:`1px solid ${T.border}`}}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] transition-colors flex-shrink-0"
          style={{color:T.t3,background:"none",border:"none",cursor:"pointer",padding:0}}
          onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
          <ArrowLeft size={14}/>用例管理
        </button>
        <span className="w-px h-4 flex-shrink-0" style={{background:T.border}}/>
        <span className="inline-flex items-center gap-1.5 text-[12px] flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full" style={{background:es.dot}}/>
          <span style={{color:es.color}}>{es.label}</span>
        </span>
        <span className="text-[12px] font-mono flex-shrink-0" style={{color:T.t4}}>{activeCase.id}</span>
        <span className="text-[14px] font-semibold flex-1 min-w-0 truncate" style={{color:T.t1}}>{activeCase.title}</span>
        <PBtn icon={Edit2} variant="ghost" onClick={()=>{}}>编辑用例</PBtn>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <ExecQueue cases={queue} activeId={activeId} onSelect={id=>{setActiveId(id);setActual("");setRemark("");setTab("detail");}}/>

        {/* Main panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Tab bar */}
          <div className="flex flex-shrink-0 px-5" style={{borderBottom:`1px solid ${T.border}`,height:44}}>
            {tabs.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)}
                className="h-full px-4 text-[13px] font-medium border-b-2 transition-colors"
                style={{borderBottomColor:tab===t.key?T.primary:"transparent",color:tab===t.key?T.primary:T.t3}}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── 基本信息 */}
            {tab==="info"&&(
              <div className="p-6">
                <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
                  {[
                    ["所属目录",activeCase.directory],["用例类型",activeCase.type],
                    ["优先级",<span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{background:ps.bg,color:ps.color}}>{activeCase.priority}</span>],
                    ["状态",<span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{background:cs.bg,color:cs.color}}>{cs.label}</span>],
                    ["来源",activeCase.source==="ai"?"AI 生成":"人工创建"],
                    ["创建人",activeCase.creator],["更新时间",activeCase.updatedAt],
                  ].map(([label,value],i,arr)=>(
                    <div key={i} className="grid" style={{gridTemplateColumns:"120px 1fr",borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none"}}>
                      <div className="px-4 py-2.5 text-[12px] font-medium" style={{background:"#FAFAFA",color:T.t3,borderRight:`1px solid ${T.border}`}}>{label}</div>
                      <div className="px-4 py-2.5 text-[13px]" style={{color:T.t1}}>{value as React.ReactNode}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 详情 */}
            {tab==="detail"&&(
              <div className="p-6 flex flex-col gap-5">
                <div>
                  <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>前置条件</p>
                  <div className="px-3 py-2.5 rounded-lg text-[13px] leading-relaxed" style={{background:"#F7F8FA",color:T.t1,border:`1px solid ${T.border}`}}>{activeCase.precondition}</div>
                </div>
                <div>
                  <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>测试步骤</p>
                  <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
                    <div className="grid text-[11px] font-semibold uppercase tracking-wide" style={{gridTemplateColumns:"44px 1fr 1fr",background:"#FAFAFA",borderBottom:`1px solid ${T.border}`,color:T.t3}}>
                      <div className="px-3 py-2 text-center" style={{borderRight:`1px solid ${T.border}`}}>#</div>
                      <div className="px-4 py-2" style={{borderRight:`1px solid ${T.border}`}}>操作步骤</div>
                      <div className="px-4 py-2">期望结果</div>
                    </div>
                    {activeCase.steps.map((step,i)=>(
                      <div key={i} className="grid" style={{gridTemplateColumns:"44px 1fr 1fr",borderBottom:i<activeCase.steps.length-1?`1px solid ${T.border}`:"none",background:i%2===0?"#fff":"#FAFAFA"}}>
                        <div className="px-3 py-2.5 text-center text-[12px] font-mono font-bold" style={{color:T.t4,borderRight:`1px solid ${T.border}`}}>{i+1}</div>
                        <div className="px-4 py-2.5 text-[13px] leading-5" style={{color:T.t1,borderRight:`1px solid ${T.border}`}}>{step}</div>
                        <div className="px-4 py-2.5 text-[13px] leading-5" style={{color:T.t2}}>{i===activeCase.steps.length-1?activeCase.expected:"正常响应，无报错"}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>预期结果</p>
                  <div className="px-3 py-2.5 rounded-lg text-[13px] leading-relaxed" style={{background:"#F5FFFB",color:T.t1,border:`1px solid ${T.success}40`}}>{activeCase.expected}</div>
                </div>
                <div>
                  <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>实际结果 <span style={{color:T.t4,fontWeight:400}}>(必填，标记时保存)</span></p>
                  <textarea value={actual} onChange={e=>setActual(e.target.value)} placeholder="请填写本次执行的实际结果…" rows={4}
                    className="w-full px-3 py-2.5 border rounded-lg text-[13px] leading-relaxed outline-none resize-y"
                    style={{borderColor:T.border,color:T.t1,fontFamily:"inherit"}}
                    onFocus={e=>{e.target.style.borderColor=T.primary;e.target.style.boxShadow=`0 0 0 2px ${T.primary}18`;}}
                    onBlur={e=>{e.target.style.borderColor=T.border;e.target.style.boxShadow="none";}}/>
                </div>
                <div>
                  <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>执行备注 <span style={{color:T.t4,fontWeight:400}}>(选填)</span></p>
                  <textarea value={remark} onChange={e=>setRemark(e.target.value)} placeholder="补充说明…" rows={2}
                    className="w-full px-3 py-2.5 border rounded-lg text-[13px] outline-none resize-y"
                    style={{borderColor:T.border,color:T.t1,fontFamily:"inherit"}}
                    onFocus={e=>{e.target.style.borderColor=T.primary;e.target.style.boxShadow=`0 0 0 2px ${T.primary}18`;}}
                    onBlur={e=>{e.target.style.borderColor=T.border;e.target.style.boxShadow="none";}}/>
                </div>
                <div>
                  <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>执行证据</p>
                  <div className="rounded-lg flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    style={{border:`2px dashed ${T.border}`,padding:"22px 16px",background:"#FAFAFA"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.background=`${T.primary}08`;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background="#FAFAFA";}}>
                    <Upload size={20} style={{color:T.t4}}/>
                    <p className="text-[13px]" style={{color:T.t2,margin:0}}>点击上传，或将文件拖拽至此处</p>
                    <p className="text-[11px]" style={{color:T.t4,margin:0}}>支持图片 / 文档，截图可直接粘贴（Ctrl+V）</p>
                  </div>
                </div>
                <div style={{height:8}}/>
              </div>
            )}

            {/* ── 关联缺陷 */}
            {tab==="defects"&&(
              <div className="p-6">
                <div className="flex justify-end gap-2 mb-4">
                  <PBtn variant="ghost" icon={Link2} onClick={()=>setShowLink(true)}>关联已有缺陷</PBtn>
                  <PBtn icon={Plus} onClick={()=>setShowCreate(true)}>新建缺陷</PBtn>
                </div>
                {linked.length===0
                  ?<div className="flex flex-col items-center justify-center gap-2 py-16" style={{color:T.t4}}>
                    <Bug size={36}/><p className="text-[13px]" style={{color:T.t3,margin:0}}>暂无关联缺陷</p>
                  </div>
                  :<ETable cols={[{label:"缺陷编号",width:"16%"},{label:"缺陷标题"},{label:"优先级",width:"7%"},{label:"状态",width:"10%"},{label:"负责人",width:"9%"},{label:"更新时间",width:"15%"},{label:"操作",width:"8%",align:"right"}]}>
                    {linked.map((d,i)=>{const ds=WDEFECT_STATUS[d.status]??WDEFECT_STATUS.closed;const dp=PRIORITY_STYLE[d.priority];return(
                      <TR key={d.id}>
                        <TD mono><span style={{color:T.primary}}>{d.no}</span></TD>
                        <TD>{d.title}</TD>
                        <TD><span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{background:dp.bg,color:dp.color}}>{d.priority}</span></TD>
                        <TD><span className="px-2 py-0.5 rounded text-[11px]" style={{background:ds.bg,color:ds.color}}>{ds.label}</span></TD>
                        <TD muted>{d.assignee}</TD>
                        <TD mono muted>{d.updatedAt}</TD>
                        <TD align="right"><button onClick={()=>setLinked(l=>l.filter(x=>x.id!==d.id))} className="text-[12px]" style={{color:T.danger,background:"none",border:"none",cursor:"pointer"}}>取消</button></TD>
                      </TR>
                    );})}
                  </ETable>
                }
              </div>
            )}

            {/* ── 执行历史 */}
            {tab==="history"&&(
              <div className="p-6">
                {activeCase.execStatus==="not-run"
                  ?<div className="flex flex-col items-center justify-center gap-2 py-16" style={{color:T.t4}}>
                    <Clock size={36}/><p className="text-[13px]" style={{color:T.t3,margin:0}}>该用例尚未执行，暂无历史记录</p>
                  </div>
                  :<div className="flex flex-col gap-3">
                    {[
                      {status:"passed" as ExecStatus,time:"2026-01-14 10:30",user:"李明",actual:"系统行为符合预期，所有断言通过",remark:""},
                      {status:"failed" as ExecStatus,time:"2026-01-13 15:20",user:"王芳",actual:"步骤 3 中系统返回了未预期的错误提示，与需求描述不符",remark:"已提交 BUG-2024-0089，等待修复"},
                    ].filter(r=>r.status===activeCase.execStatus||true).map((r,i)=>{
                      const re=EXEC_STATUS_STYLE[r.status];
                      return(
                        <div key={i} className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
                          <div className="flex items-center gap-3 px-4 py-2.5" style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>
                            <span className="inline-flex items-center gap-1.5 text-[12px]"><span className="w-1.5 h-1.5 rounded-full" style={{background:re.dot}}/><span style={{color:re.color}}>{re.label}</span></span>
                            <span className="text-[12px] font-mono" style={{color:T.t3}}>{r.time}</span>
                            <span className="text-[12px]" style={{color:T.t2}}>执行人：{r.user}</span>
                          </div>
                          <div className="px-4 py-3 flex flex-col gap-2">
                            {r.actual&&<div><p className="text-[11px] font-semibold mb-1" style={{color:T.t4}}>实际结果</p><p className="text-[13px]" style={{color:T.t1}}>{r.actual}</p></div>}
                            {r.remark&&<div><p className="text-[11px] font-semibold mb-1" style={{color:T.t4}}>备注</p><p className="text-[13px]" style={{color:T.t2}}>{r.remark}</p></div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                }
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-3 px-5 flex-shrink-0 bg-white" style={{height:56,borderTop:`1px solid ${T.border}`}}>
            <button onClick={()=>idx>0&&setActiveId(queue[idx-1].id)} disabled={idx===0}
              className="flex items-center gap-1 px-3 h-8 border rounded-lg text-[13px] transition-colors"
              style={{borderColor:T.border,color:idx===0?T.t4:T.t2,background:"#fff",cursor:idx===0?"not-allowed":"pointer"}}>
              <ChevronLeft size={14}/>上一条
            </button>
            <span className="text-[13px] font-mono" style={{color:T.t3,minWidth:36,textAlign:"center"}}>
              <strong style={{color:T.t1}}>{idx+1}</strong>/{queue.length}
            </span>
            <button onClick={()=>idx<queue.length-1&&setActiveId(queue[idx+1].id)} disabled={idx===queue.length-1}
              className="flex items-center gap-1 px-3 h-8 border rounded-lg text-[13px] transition-colors"
              style={{borderColor:T.border,color:idx===queue.length-1?T.t4:T.t2,background:"#fff",cursor:idx===queue.length-1?"not-allowed":"pointer"}}>
              下一条<ChevronRight size={14}/>
            </button>
            <span className="w-px h-5" style={{background:T.border}}/>
            <div className="flex items-center gap-2">
              <Toggle on={autoNext} onChange={setAutoNext}/>
              <span className="text-[12px]" style={{color:T.t3}}>自动下一条</span>
            </div>
            <div className="flex-1"/>
            <PBtn variant="ghost" icon={Bug} onClick={()=>setShowCreate(true)}>添加缺陷</PBtn>
            <span className="w-px h-5" style={{background:T.border}}/>
            <button onClick={()=>markCase("blocked")} className="px-4 h-8 rounded-lg text-[13px] font-medium border transition-colors"
              style={{background:"#FFF3E8",borderColor:"#FFD595",color:T.warning,cursor:"pointer"}}>标记阻塞</button>
            <button onClick={()=>markCase("failed")} className="px-4 h-8 rounded-lg text-[13px] font-medium border transition-colors"
              style={{background:"#FFE8E8",borderColor:"#FBBBBB",color:T.danger,cursor:"pointer"}}>标记失败</button>
            <button onClick={()=>markCase("passed")} className="flex items-center gap-1.5 px-5 h-8 rounded-lg text-[13px] font-semibold text-white border-none"
              style={{background:T.success,cursor:"pointer"}}>
              <Check size={14}/>标记通过
            </button>
          </div>
        </div>
      </div>

      {/* Link defect drawer */}
      <ExecDrawer title="关联缺陷" open={showLink} onClose={()=>setShowLink(false)}
        footer={<div className="flex justify-end gap-2"><PBtn variant="ghost" onClick={()=>setShowLink(false)}>取消</PBtn><PBtn onClick={()=>{setLinked(l=>[...l,...W_CANDIDATES.filter(d=>!l.find(x=>x.id===d.id))]);setShowLink(false);showMsg(`已关联 ${W_CANDIDATES.length} 个缺陷`);}}>确认关联</PBtn></div>}>
        <div className="flex flex-col gap-3">
          {W_CANDIDATES.filter(d=>!linked.find(x=>x.id===d.id)).map(d=>{const dp=PRIORITY_STYLE[d.priority];const ds=WDEFECT_STATUS[d.status];return(
            <label key={d.id} className="flex gap-3 p-3 rounded-lg cursor-pointer border" style={{borderColor:T.border}}>
              <input type="checkbox" className="mt-0.5 flex-shrink-0" style={{accentColor:T.primary}}/>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[11px] font-mono" style={{color:T.t4}}>{d.no}</span>
                  <span className="px-1.5 py-px rounded text-[11px] font-bold" style={{background:dp.bg,color:dp.color}}>{d.priority}</span>
                  <span className="px-1.5 py-px rounded text-[11px]" style={{background:ds.bg,color:ds.color}}>{ds.label}</span>
                </div>
                <p className="text-[13px] mb-0.5" style={{color:T.t1}}>{d.title}</p>
                <p className="text-[11px]" style={{color:T.t3}}>负责人：{d.assignee} · {d.updatedAt}</p>
              </div>
            </label>
          );})}
          {W_CANDIDATES.filter(d=>!linked.find(x=>x.id===d.id)).length===0&&<p className="text-center py-8 text-[13px]" style={{color:T.t4}}>暂无可关联的缺陷</p>}
        </div>
      </ExecDrawer>

      {/* Create defect drawer */}
      <ExecDrawer title="新建缺陷" open={showCreate} onClose={()=>setShowCreate(false)} width={580}
        footer={<div className="flex justify-end gap-2"><PBtn variant="ghost" onClick={()=>setShowCreate(false)}>取消</PBtn><PBtn onClick={()=>{setShowCreate(false);showMsg("缺陷已创建并关联");}}>提交</PBtn></div>}>
        <div className="flex flex-col gap-4">
          <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>缺陷标题 <span style={{color:T.danger}}>*</span></label>
            <Inp placeholder="缺陷标题" value={`[${activeCase.id}] ${activeCase.title}`} width="100%"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>优先级</label>
              <Sel width={220}><option>P0</option><option>P1</option><option>P2</option><option>P3</option></Sel></div>
            <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>严重程度</label>
              <Sel width={220}><option>致命</option><option>严重</option><option>一般</option><option>提示</option></Sel></div>
          </div>
          <div><label className="block text-[12px] font-medium mb-1.5" style={{color:T.t2}}>缺陷描述</label>
            <textarea rows={8} defaultValue={`**用例**：${activeCase.id}\n**前置条件**\n${activeCase.precondition}\n\n**步骤**\n${activeCase.steps.join("\n")}\n\n**预期结果**\n${activeCase.expected}\n\n**实际结果**\n（请补充）`}
              className="w-full px-3 py-2.5 border rounded-lg text-[12px] font-mono leading-relaxed outline-none resize-y"
              style={{borderColor:T.border,color:T.t1}}/></div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{background:"#F7F8FA",border:`1px solid ${T.border}`}}>
            <Link2 size={13} style={{color:T.t4,flexShrink:0}}/>
            <span className="text-[12px]" style={{color:T.t3}}>关联用例：</span>
            <span className="text-[12px] font-mono" style={{color:T.primary}}>{activeCase.id}</span>
            <span className="text-[13px] truncate" style={{color:T.t1}}>{activeCase.title}</span>
          </div>
        </div>
      </ExecDrawer>

      {/* Toast */}
      {toast&&<div className="fixed bottom-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg text-[13px] font-medium text-white shadow-lg" style={{background:T.t1,zIndex:9999}}>{toast}</div>}
    </div>
  );
}

const CASES_TABS=[
  {nav:"cases-list"    as ActiveNav, label:"用例管理"},
  {nav:"cases-ai-gen"  as ActiveNav, label:"AI 用例生成"},
  {nav:"cases-records" as ActiveNav, label:"AI 生成记录"},
  {nav:"cases-ai-cfg"  as ActiveNav, label:"AI 配置"},
];

const DEFAULT_GEN_PROMPT=`你是一名专业的软件测试工程师。请根据以下需求描述，生成结构化的测试用例。

【需求标题】
{requirement_title}

【需求描述】
{requirement_desc}

【生成要求】
- 覆盖正向流程、边界条件和异常场景
- 每条用例包含：用例名称、前置条件、测试步骤（每步清晰可执行）、预期结果
- 优先级按业务重要性标注（P0-P3）
- 生成数量：{expected_count} 条
- 语言：{language}`;

const DEFAULT_REVIEW_PROMPT=`你是一名资深测试负责人，负责对 AI 生成的测试用例进行质量评审。

请对以下测试用例逐条评审，给出：
1. 是否通过（通过 / 建议优化）
2. 评分（0-100）
3. 具体改进建议（如有）
4. 潜在风险提示（如有）

评审标准：
- 步骤是否清晰可执行
- 预期结果是否明确可验证
- 是否存在冗余或重复
- 是否覆盖了核心业务场景`;

function AiCaseConfigPage({onNavigate}:{onNavigate:(k:ActiveNav)=>void}){
  const availableConns=AI_CONN_DATA.filter(c=>c.status==="enabled"&&c.apiKeySet);
  const allConns=AI_CONN_DATA;

  const[genModelId,setGenModelId]=useState<number>(1);
  const[reviewModelId,setReviewModelId]=useState<number>(2);
  const[promptTab,setPromptTab]=useState<"gen"|"review">("gen");
  const[useDefaultGenPrompt,setUseDefaultGenPrompt]=useState(true);
  const[useDefaultReviewPrompt,setUseDefaultReviewPrompt]=useState(true);
  const[genPrompt,setGenPrompt]=useState(DEFAULT_GEN_PROMPT);
  const[reviewPrompt,setReviewPrompt]=useState(DEFAULT_REVIEW_PROMPT);
  const[expectedCount,setExpectedCount]=useState(12);
  const[language,setLanguage]=useState<"zh"|"en">("zh");
  const[caseTypes,setCaseTypes]=useState({func:true,boundary:true,exception:true,security:true,perf:false});
  const[saved,setSaved]=useState(false);
  const[toast,setToast]=useState<string|null>(null);

  const showToast=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(null),2500);};

  const genConn=allConns.find(c=>c.id===genModelId);
  const reviewConn=allConns.find(c=>c.id===reviewModelId);
  const configOk=genConn&&reviewConn&&genConn.status==="enabled"&&reviewConn.status==="enabled"&&genConn.apiKeySet&&reviewConn.apiKeySet;

  const handleSave=()=>{setSaved(true);showToast("AI 配置已保存");};

  const s=(v:boolean):React.CSSProperties=>({
    display:"inline-flex",alignItems:"center",justifyContent:"center",
    width:16,height:16,borderRadius:4,border:`2px solid ${v?T.primary:T.border}`,
    background:v?T.primary:"#fff",cursor:"pointer",flexShrink:0,
  });

  const ConnCard=({conn,selected,onSelect}:{conn:AiRecord;selected:boolean;onSelect:()=>void})=>{
    const ok=conn.status==="enabled"&&conn.apiKeySet;
    return(
      <div onClick={ok?onSelect:undefined} style={{
        padding:"14px 16px",borderRadius:8,cursor:ok?"pointer":"not-allowed",
        border:`2px solid ${selected?T.primary:T.border}`,
        background:selected?`${T.primary}06`:"#fff",
        opacity:ok?1:.5,transition:"all .15s",marginBottom:8,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:8,background:selected?`${T.primary}15`:"#F7F8FA",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Sparkles size={16} color={selected?T.primary:T.t4}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
              <span style={{fontSize:13,fontWeight:600,color:T.t1}}>{conn.name}</span>
              {selected&&<span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:3,background:T.primary,color:"#fff"}}>已选</span>}
            </div>
            <div style={{fontSize:11,color:T.t3,fontFamily:"monospace"}}>{conn.model}<span style={{fontFamily:"inherit",marginLeft:8,color:T.t4}}>· {conn.provider}</span></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            {conn.supportsImage&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:"#E8F0FF",color:T.primary}}>图片识别</span>}
            {!ok&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:"#FFF0F0",color:T.danger}}>{!conn.apiKeySet?"缺少 API Key":"已禁用"}</span>}
            {ok&&!selected&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:3,background:"#E8FFE8",color:T.success}}>可用</span>}
          </div>
        </div>
      </div>
    );
  };

  const GEN_VARS=["{requirement_title}","{requirement_desc}","{expected_count}","{language}","{save_path}"];
  const REVIEW_VARS=["{case_title}","{case_steps}","{case_expected}","{case_type}","{case_priority}"];

  const textarea:React.CSSProperties={width:"100%",boxSizing:"border-box",padding:"12px 14px",border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.t1,lineHeight:1.8,fontFamily:"'Courier New', monospace",outline:"none",resize:"vertical",minHeight:220,background:"#FAFBFF"};

  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

      {/* ── Status bar ── */}
      <div style={{padding:"12px 24px",background:"#fff",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",alignItems:"center",gap:16}}>
        <div style={{flex:1}}>
          {configOk?(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <CheckCircle size={14} color={T.success}/>
              <span style={{fontSize:13,color:T.t1}}>当前配置完整，可正常生成用例</span>
              <span style={{fontSize:12,color:T.t3,marginLeft:4}}>生成：<b style={{color:T.t2}}>{genConn?.name}</b> · 评审：<b style={{color:T.t2}}>{reviewConn?.name}</b></span>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <AlertTriangle size={14} color={T.warning}/>
              <span style={{fontSize:13,color:T.warning}}>配置不完整，部分连接不可用</span>
            </div>
          )}
        </div>
        <button onClick={()=>onNavigate("config-ai")} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",border:`1px solid ${T.border}`,borderRadius:6,background:"none",cursor:"pointer",fontSize:12,color:T.t2}}>
          <ExternalLink size={12}/>管理 AI 连接池
        </button>
        <button onClick={handleSave} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 18px",border:`1px solid ${T.primary}`,borderRadius:6,background:T.primary,cursor:"pointer",fontSize:13,color:"#fff",fontWeight:500}}>
          <Save size={13}/>{saved?"已保存":"保存配置"}
        </button>
      </div>

      {/* ── Main scrollable body ── */}
      <div style={{flex:1,overflowY:"auto",padding:24}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex",flexDirection:"column",gap:20}}>

          {/* ─ Section 1: 模型选择 ─ */}
          <div style={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"14px 22px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8}}>
              <Zap size={15} color={T.primary}/>
              <span style={{fontSize:14,fontWeight:600,color:T.t1}}>模型选择</span>
              <span style={{fontSize:12,color:T.t3,marginLeft:4}}>从 AI 连接池中选择用于生成和评审的模型</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>

              {/* Gen model */}
              <div style={{padding:"20px 24px",borderRight:`1px solid ${T.border}`}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:T.success,flexShrink:0}}/>
                  <span style={{fontSize:12,fontWeight:700,color:T.t2,textTransform:"uppercase",letterSpacing:".5px"}}>生成模型</span>
                  <span style={{fontSize:11,color:T.t4,marginLeft:2}}>负责根据需求生成用例</span>
                </div>
                <select value={genModelId} onChange={e=>{setGenModelId(Number(e.target.value));setSaved(false);}} style={{
                  width:"100%",padding:"9px 12px",border:`1.5px solid ${T.border}`,borderRadius:7,
                  fontSize:13,color:T.t1,background:"#fff",outline:"none",cursor:"pointer",appearance:"auto",
                }}>
                  {allConns.map(conn=>{
                    const ok=conn.status==="enabled"&&conn.apiKeySet;
                    return <option key={conn.id} value={conn.id} disabled={!ok}>{conn.name} — {conn.model}{!ok?" (不可用)":""}</option>;
                  })}
                </select>
                {(() => {
                  const c=allConns.find(x=>x.id===genModelId);
                  if(!c) return null;
                  const ok=c.status==="enabled"&&c.apiKeySet;
                  return(
                    <div style={{marginTop:10,padding:"10px 12px",borderRadius:7,background:ok?`${T.success}08`:"#FFF5F5",border:`1px solid ${ok?T.success+"30":T.danger+"30"}`,display:"flex",alignItems:"center",gap:8}}>
                      {ok?<CheckCircle size={13} color={T.success}/>:<AlertTriangle size={13} color={T.danger}/>}
                      <div>
                        <div style={{fontSize:12,fontWeight:500,color:ok?T.success:T.danger}}>{ok?"连接正常":"连接不可用"}</div>
                        <div style={{fontSize:11,color:T.t3,marginTop:1}}>{c.provider} · {c.model}{c.supportsImage?" · 支持图片识别":""}</div>
                      </div>
                    </div>
                  );
                })()}
                {allConns.length===0&&(
                  <div style={{marginTop:10,fontSize:12,color:T.t3}}>暂无可用连接，请先在 AI 连接池中配置</div>
                )}
              </div>

              {/* Review model */}
              <div style={{padding:"20px 24px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:T.purple,flexShrink:0}}/>
                  <span style={{fontSize:12,fontWeight:700,color:T.t2,textTransform:"uppercase",letterSpacing:".5px"}}>评审模型</span>
                  <span style={{fontSize:11,color:T.t4,marginLeft:2}}>负责对生成用例进行质量评审</span>
                </div>
                <select value={reviewModelId} onChange={e=>{setReviewModelId(Number(e.target.value));setSaved(false);}} style={{
                  width:"100%",padding:"9px 12px",border:`1.5px solid ${T.border}`,borderRadius:7,
                  fontSize:13,color:T.t1,background:"#fff",outline:"none",cursor:"pointer",appearance:"auto",
                }}>
                  {allConns.map(conn=>{
                    const ok=conn.status==="enabled"&&conn.apiKeySet;
                    return <option key={conn.id} value={conn.id} disabled={!ok}>{conn.name} — {conn.model}{!ok?" (不可用)":""}</option>;
                  })}
                </select>
                {(() => {
                  const c=allConns.find(x=>x.id===reviewModelId);
                  if(!c) return null;
                  const ok=c.status==="enabled"&&c.apiKeySet;
                  return(
                    <div style={{marginTop:10,padding:"10px 12px",borderRadius:7,background:ok?`${T.success}08`:"#FFF5F5",border:`1px solid ${ok?T.success+"30":T.danger+"30"}`,display:"flex",alignItems:"center",gap:8}}>
                      {ok?<CheckCircle size={13} color={T.success}/>:<AlertTriangle size={13} color={T.danger}/>}
                      <div>
                        <div style={{fontSize:12,fontWeight:500,color:ok?T.success:T.danger}}>{ok?"连接正常":"连接不可用"}</div>
                        <div style={{fontSize:11,color:T.t3,marginTop:1}}>{c.provider} · {c.model}{c.supportsImage?" · 支持图片识别":""}</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            {genModelId===reviewModelId&&(
              <div style={{padding:"10px 22px",borderTop:`1px solid ${T.border}`,background:"#FFFBF0",display:"flex",alignItems:"center",gap:6}}>
                <AlertTriangle size={13} color={T.warning}/>
                <span style={{fontSize:12,color:T.warning}}>生成模型和评审模型相同，可能影响评审客观性，建议使用不同模型</span>
              </div>
            )}
          </div>

          {/* ─ Section 2: 提示词配置 ─ */}
          <div style={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"14px 22px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8}}>
              <FileText size={15} color={T.primary}/>
              <span style={{fontSize:14,fontWeight:600,color:T.t1}}>提示词配置</span>
              <span style={{fontSize:12,color:T.t3,marginLeft:4}}>自定义 AI 的系统提示词以控制生成风格和质量</span>
            </div>

            {/* Prompt tabs */}
            <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,background:"#FAFAFA"}}>
              {([["gen","生成提示词","负责生成阶段"],["review","评审提示词","负责评审阶段"]] as const).map(([k,label,sub])=>(
                <button key={k} onClick={()=>setPromptTab(k)} style={{padding:"12px 22px",border:"none",borderBottom:`2px solid ${promptTab===k?T.primary:"transparent"}`,background:"none",cursor:"pointer",fontSize:13,fontWeight:promptTab===k?600:400,color:promptTab===k?T.primary:T.t3,display:"flex",alignItems:"center",gap:6,transition:"all .15s"}}>
                  {label}
                  <span style={{fontSize:11,color:promptTab===k?T.primary:T.t4}}>{sub}</span>
                </button>
              ))}
            </div>

            <div style={{padding:"18px 22px"}}>
              {promptTab==="gen"?(
                <>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                    <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",userSelect:"none"}}>
                      <div style={s(useDefaultGenPrompt)} onClick={()=>{setUseDefaultGenPrompt(v=>{if(!v)setGenPrompt(DEFAULT_GEN_PROMPT);return!v;});}}>
                        {useDefaultGenPrompt&&<Check size={10} color="#fff"/>}
                      </div>
                      <span style={{fontSize:13,color:T.t2}}>使用默认提示词</span>
                    </label>
                    {!useDefaultGenPrompt&&<button onClick={()=>{setGenPrompt(DEFAULT_GEN_PROMPT);}} style={{fontSize:12,color:T.primary,background:"none",border:"none",cursor:"pointer",padding:0}}>重置为默认</button>}
                  </div>
                  <textarea value={genPrompt} onChange={e=>{setGenPrompt(e.target.value);setUseDefaultGenPrompt(false);setSaved(false);}} style={{...textarea,opacity:useDefaultGenPrompt?.7:1}} readOnly={useDefaultGenPrompt}/>
                  <div style={{marginTop:10,padding:"10px 14px",background:"#F7F8FA",borderRadius:6}}>
                    <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>可用变量</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {GEN_VARS.map(v=>(
                        <code key={v} style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:"#fff",border:`1px solid ${T.border}`,color:T.primary,cursor:"pointer"}} onClick={()=>{if(!useDefaultGenPrompt){setGenPrompt(p=>p+v);}}}>{v}</code>
                      ))}
                    </div>
                  </div>
                </>
              ):(
                <>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                    <label style={{display:"flex",alignItems:"center",gap:7,cursor:"pointer",userSelect:"none"}}>
                      <div style={s(useDefaultReviewPrompt)} onClick={()=>{setUseDefaultReviewPrompt(v=>{if(!v)setReviewPrompt(DEFAULT_REVIEW_PROMPT);return!v;});}}>
                        {useDefaultReviewPrompt&&<Check size={10} color="#fff"/>}
                      </div>
                      <span style={{fontSize:13,color:T.t2}}>使用默认提示词</span>
                    </label>
                    {!useDefaultReviewPrompt&&<button onClick={()=>{setReviewPrompt(DEFAULT_REVIEW_PROMPT);}} style={{fontSize:12,color:T.primary,background:"none",border:"none",cursor:"pointer",padding:0}}>重置为默认</button>}
                  </div>
                  <textarea value={reviewPrompt} onChange={e=>{setReviewPrompt(e.target.value);setUseDefaultReviewPrompt(false);setSaved(false);}} style={{...textarea,opacity:useDefaultReviewPrompt?.7:1}} readOnly={useDefaultReviewPrompt}/>
                  <div style={{marginTop:10,padding:"10px 14px",background:"#F7F8FA",borderRadius:6}}>
                    <div style={{fontSize:11,fontWeight:600,color:T.t3,marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>可用变量</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {REVIEW_VARS.map(v=>(
                        <code key={v} style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:"#fff",border:`1px solid ${T.border}`,color:T.purple,cursor:"pointer"}} onClick={()=>{if(!useDefaultReviewPrompt){setReviewPrompt(p=>p+v);}}}>{v}</code>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ─ Section 3: 生成参数 ─ */}
          <div style={{background:"#fff",border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
            <div style={{padding:"14px 22px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8}}>
              <Settings size={15} color={T.primary}/>
              <span style={{fontSize:14,fontWeight:600,color:T.t1}}>生成参数</span>
              <span style={{fontSize:12,color:T.t3,marginLeft:4}}>控制用例生成的数量、类型和语言</span>
            </div>
            <div style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:20}}>

              {/* Expected count */}
              <div style={{display:"flex",alignItems:"center",gap:20}}>
                <span style={{fontSize:13,color:T.t2,width:120,flexShrink:0}}>预期生成数量</span>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <input type="range" min={5} max={50} value={expectedCount} onChange={e=>{setExpectedCount(+e.target.value);setSaved(false);}} style={{width:180,cursor:"pointer"}}/>
                  <div style={{display:"flex",alignItems:"center",border:`1px solid ${T.border}`,borderRadius:6,overflow:"hidden"}}>
                    <button onClick={()=>setExpectedCount(v=>Math.max(5,v-1))} style={{width:28,height:32,border:"none",background:"#F7F8FA",cursor:"pointer",fontSize:16,color:T.t2}}>−</button>
                    <span style={{width:40,textAlign:"center",fontSize:14,fontWeight:600,color:T.t1}}>{expectedCount}</span>
                    <button onClick={()=>setExpectedCount(v=>Math.min(50,v+1))} style={{width:28,height:32,border:"none",background:"#F7F8FA",cursor:"pointer",fontSize:16,color:T.t2}}>+</button>
                  </div>
                  <span style={{fontSize:12,color:T.t3}}>条（5 - 50）</span>
                </div>
              </div>

              {/* Case types */}
              <div style={{display:"flex",alignItems:"flex-start",gap:20}}>
                <span style={{fontSize:13,color:T.t2,width:120,flexShrink:0,paddingTop:2}}>覆盖用例类型</span>
                <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
                  {([
                    ["func","功能测试","核心业务流程验证"],
                    ["boundary","边界测试","边界值与极限场景"],
                    ["exception","异常测试","错误处理与容错"],
                    ["security","安全测试","权限与安全校验"],
                    ["perf","性能测试","响应时间与并发"],
                  ] as const).map(([k,label,desc])=>(
                    <div key={k} onClick={()=>{setCaseTypes(t=>({...t,[k]:!t[k]}));setSaved(false);}} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",border:`1.5px solid ${caseTypes[k]?T.primary:T.border}`,borderRadius:8,cursor:"pointer",background:caseTypes[k]?`${T.primary}06`:"#fff",transition:"all .15s"}}>
                      <div style={s(caseTypes[k])}>{caseTypes[k]&&<Check size={10} color="#fff"/>}</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:500,color:caseTypes[k]?T.primary:T.t1}}>{label}</div>
                        <div style={{fontSize:11,color:T.t4}}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div style={{display:"flex",alignItems:"center",gap:20}}>
                <span style={{fontSize:13,color:T.t2,width:120,flexShrink:0}}>用例语言</span>
                <div style={{display:"flex",gap:10}}>
                  {([["zh","中文","适合国内项目"],["en","English","适合国际化项目"]] as const).map(([k,label,desc])=>(
                    <div key={k} onClick={()=>{setLanguage(k);setSaved(false);}} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",border:`1.5px solid ${language===k?T.primary:T.border}`,borderRadius:8,cursor:"pointer",background:language===k?`${T.primary}06`:"#fff",transition:"all .15s"}}>
                      <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${language===k?T.primary:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {language===k&&<div style={{width:7,height:7,borderRadius:"50%",background:T.primary}}/>}
                      </div>
                      <div>
                        <div style={{fontSize:13,fontWeight:500,color:language===k?T.primary:T.t1}}>{label}</div>
                        <div style={{fontSize:11,color:T.t4}}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom save */}
          <div style={{display:"flex",justifyContent:"flex-end",paddingBottom:8}}>
            <button onClick={handleSave} style={{display:"flex",alignItems:"center",gap:6,padding:"9px 24px",border:`1px solid ${T.primary}`,borderRadius:7,background:T.primary,cursor:"pointer",fontSize:14,color:"#fff",fontWeight:500}}>
              <Save size={14}/>{saved?"✓ 配置已保存":"保存配置"}
            </button>
          </div>

        </div>
      </div>

      {toast&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:T.success,color:"#fff",padding:"10px 20px",borderRadius:7,fontSize:13,fontWeight:500,boxShadow:"0 4px 16px rgba(0,0,0,.15)",zIndex:9999}}>{toast}</div>}
    </div>
  );
}

function CasesModule({nav,onNavigate}:{nav:ActiveNav;onNavigate:(k:ActiveNav)=>void}){
  const[cases,setCases]=useState<TestCase[]>(CASES);
  const[caseDrawer,setCaseDrawer]=useState<TestCase|null>(null);
  const[reviewCase,setReviewCase]=useState<TestCase|null>(null);
  const[showNewCase,setShowNewCase]=useState(false);
  const[showProgress,setShowProgress]=useState(false);
  const[showResult,setShowResult]=useState(false);
  const[detailTask,setDetailTask]=useState<AiTask|null>(null);

  const handleAddCase=(c:TestCase)=>setCases(prev=>[c,...prev]);

  const handleReviewUpdate=(id:string,status:ReviewStatus,comment:string,reviewer:string)=>{
    setCases(prev=>prev.map(c=>c.id===id?{
      ...c,
      reviewStatus:status,
      ...(status==="reviewing"
        ?{reviewer:undefined,reviewedAt:undefined,reviewComment:undefined}
        :{reviewer,reviewedAt:new Date().toISOString().slice(0,16).replace("T"," "),reviewComment:comment||undefined}
      )
    }:c));
  };

  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center flex-shrink-0 px-5 bg-white"
        style={{borderBottom:`1px solid ${T.border}`,height:44}}>
        {CASES_TABS.map(t=>(
          <button key={t.nav} onClick={()=>{onNavigate(t.nav);setDetailTask(null);}}
            className="h-full px-4 text-[13px] font-medium border-b-2 transition-colors"
            style={{borderBottomColor:nav===t.nav?T.success:"transparent",color:nav===t.nav?T.success:T.t3}}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 flex overflow-hidden">
      {nav==="cases-list"&&<CaseListPage
        cases={cases}
        onViewCase={c=>setCaseDrawer(cases.find(x=>x.id===c.id)||c)}
        onReviewCase={c=>setReviewCase(cases.find(x=>x.id===c.id)||c)}
        onNewCase={()=>setShowNewCase(true)}/>}
      {nav==="cases-ai-gen"&&<AICaseGenPage onNavigate={onNavigate}/>}
      {nav==="cases-records"&&!detailTask&&<AiRecordsPage onViewDetail={t=>{setDetailTask(t);}}/>}
      {nav==="cases-records"&&detailTask&&<AiRecordDetail task={detailTask} onBack={()=>setDetailTask(null)}/>}
      {nav==="cases-ai-cfg"&&<AiCaseConfigPage onNavigate={onNavigate}/>}

      {showNewCase&&<NewCaseDrawer onClose={()=>setShowNewCase(false)} onSave={handleAddCase}/>}
      {caseDrawer&&<CaseDrawer case_={caseDrawer} onClose={()=>setCaseDrawer(null)}/>}
      {reviewCase&&<CaseReviewDrawer case_={reviewCase} allCases={cases} onClose={()=>setReviewCase(null)} onUpdate={handleReviewUpdate}/>}
      <AiGenProgress open={showProgress} onClose={()=>setShowProgress(false)} onComplete={()=>{setShowProgress(false);setShowResult(true);}}/>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// CONFIG MODULE (now without secondary sidebar)
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG_TABS=[
  {nav:"config"         as ActiveNav, label:"配置总览"},
  {nav:"config-db"      as ActiveNav, label:"数据库配置"},
  {nav:"config-env"     as ActiveNav, label:"环境配置"},
  {nav:"config-param"   as ActiveNav, label:"变量配置"},
  {nav:"config-notif"   as ActiveNav, label:"通知配置"},
  {nav:"config-runner"  as ActiveNav, label:"Runner 配置"},
  {nav:"config-ai"      as ActiveNav, label:"AI 连接配置"},
  {nav:"config-mock"    as ActiveNav, label:"Mock 服务"},
];

function ConfigModule({nav,onNavigate}:{nav:ActiveNav;onNavigate:(k:ActiveNav)=>void}){
  const tabMap:Record<ActiveNav,string>={config:"overview","config-db":"db","config-env":"env","config-param":"param","config-notif":"notif","config-runner":"runner","config-ai":"ai","config-mock":"mock"} as any;
  const tab=tabMap[nav]??"overview";

  const DB_TYPE:Record<string,{color:string;bg:string}>={MySQL:{color:"#0E42D2",bg:"#E8F3FF"},PostgreSQL:{color:"#551DB0",bg:"#F0EEFF"},Oracle:{color:"#B85C00",bg:"#FFF3E8"},ClickHouse:{color:"#876800",bg:"#FFFBE8"}};

  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Horizontal tab bar */}
      <div className="flex items-center flex-shrink-0 px-5 bg-white"
        style={{borderBottom:`1px solid ${T.border}`,height:44}}>
        {CONFIG_TABS.map(t=>(
          <button key={t.nav} onClick={()=>onNavigate(t.nav)}
            className="h-full px-4 text-[13px] font-medium border-b-2 transition-colors"
            style={{borderBottomColor:nav===t.nav?"#4E5AC8":"transparent",color:nav===t.nav?"#4E5AC8":T.t3}}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
      {tab==="overview"&&(
        <div>
          <div className="mb-6"><h2 className="text-[18px] font-semibold" style={{color:T.t1}}>配置中心</h2><p className="text-[13px] mt-1" style={{color:T.t3}}>管理数据库连接、测试环境、执行节点、AI 服务等平台基础配置</p></div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              {label:"数据库连接",value:"5",detail:"4 启用 · 1 停用",icon:Database,color:T.primary,bg:"#E8F3FF"},
              {label:"测试环境",value:"4",detail:"3 启用 · 1 停用",icon:Globe,color:T.success,bg:"#E8FFEA"},
              {label:"Runner 节点",value:"3/4",detail:"3 个在线运行",icon:Server,color:T.cyan,bg:"#E8FFFB"},
              {label:"AI 连接",value:"2/4",detail:"2 个 Key 已配置",icon:Bot,color:"#4E5AC8",bg:"#EEF0FA"},
              {label:"通知渠道",value:"4",detail:"3 个已启用",icon:Bell,color:T.purple,bg:"#F5E8FF"},
              {label:"全局参数",value:"4",detail:"3 个已启用",icon:Hash,color:T.warning,bg:"#FFF3E8"},
            ].map(c=>{const Icon=c.icon;return <div key={c.label} className="rounded-xl p-5 bg-white flex items-start gap-4" style={{border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}><IcoSquare color={c.color} bg={c.bg} size={44}><Icon size={22}/></IcoSquare><div><p className="text-[12px]" style={{color:T.t3}}>{c.label}</p><p className="text-[26px] font-bold mt-1" style={{color:c.color}}>{c.value}</p><p className="text-[12px]" style={{color:T.t3}}>{c.detail}</p></div></div>;})}
          </div>
          <div className="rounded-xl bg-white p-5" style={{border:`1px solid ${T.border}`}}>
            <p className="text-[15px] font-semibold mb-4" style={{color:T.t1}}>连接测试趋势</p>
            <div style={{overflowX:"auto"}}><AreaChart width={600} height={200} data={TREND_DATA} margin={{top:5,right:10,left:-20,bottom:0}}><defs><linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.primary} stopOpacity={0.12}/><stop offset="95%" stopColor={T.primary} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#F2F3F5" vertical={false}/><XAxis dataKey="day" tick={{fontSize:12,fill:T.t3}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:12,fill:T.t3}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{borderRadius:10,border:`1px solid ${T.border}`,fontSize:13}}/><Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:12,paddingTop:12}}/><Area key="success" type="monotone" dataKey="成功" stroke={T.primary} strokeWidth={2.5} fill="url(#gS)" dot={false}/><Area key="failure" type="monotone" dataKey="失败" stroke={T.danger} strokeWidth={2} fill="transparent" dot={false}/></AreaChart></div>
          </div>
        </div>
      )}

      {tab==="db"&&(
        <>
          <PageHead title="数据库配置" desc="管理测试用例使用的数据库连接"/>
          <FilterBar onAdd={()=>{}} addLabel="新增连接"><Inp placeholder="搜索连接名称" prefix={<Search size={13}/>} width={200}/></FilterBar>
          <ETable total={DB_DATA.length} cols={[{label:"连接名称",width:"22%"},{label:"类型",width:"10%"},{label:"JDBC 地址",width:"30%"},{label:"用户名",width:"10%"},{label:"状态",width:"8%"},{label:"最近测试",width:"12%"},{label:"操作",width:"8%",align:"right"}]}>
            {DB_DATA.map(r=>{const dt=DB_TYPE[r.type]??{color:T.t2,bg:"#F2F3F5"};return <TR key={r.id}><TD><div className="flex items-center gap-2.5"><IcoSquare color={dt.color} bg={dt.bg} size={30}><Database size={14}/></IcoSquare><span className="font-medium">{r.name}</span></div></TD><TD><span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{backgroundColor:dt.bg,color:dt.color}}>{r.type}</span></TD><TD mono muted><span className="block truncate max-w-[230px]">{r.jdbc}</span></TD><TD muted>{r.username}</TD><TD><StatusDot status={r.status}/></TD><TD>{r.lastTestResult?<StatusDot status={r.lastTestResult} label={r.lastTestResult==="success"?"连接成功":"连接失败"}/>:<span className="text-[12px]" style={{color:T.t4}}>未测试</span>}</TD><TD align="right"><div className="flex items-center justify-end"><IBtn icon={TestTube} label="测试" onClick={()=>{}}/><IBtn icon={Edit2} label="编辑" onClick={()=>{}}/><IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/></div></TD></TR>;})}
          </ETable>
        </>
      )}

      {tab==="env"&&<EnvConfigPage/>}

      {tab==="notif"&&<NotifModule/>}
      {tab==="runner"&&<RunnerModule/>}
      {tab==="param"&&<VarConfigPage/>}
      {tab==="ai"&&<AiPoolModule/>}
      {tab==="mock"&&<MockServicePage/>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// API MODULE — PreScript / PostScript / Assert Tab components
// ═══════════════════════════════════════════════════════════════════════════════


// ─── Shared atoms ─────────────────────────────────────────────────────────────

function SmToggle({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}){
  return(
    <button onClick={e=>{e.stopPropagation();onChange(!on);}} className="flex-shrink-0 relative w-8 h-4 rounded-full transition-colors" style={{backgroundColor:on?T.primary:"#C9CDD4"}}>
      <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform" style={{transform:on?"translateX(16px)":"translateX(0)"}}/>
    </button>
  );
}

function SmCodeEditor({value,onChange,rows=10}:{value:string;onChange:(v:string)=>void;rows?:number}){
  return(
    <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#1E1E2E"}}>
      <div className="flex items-center gap-2 px-3 py-1.5" style={{background:"#16162A",borderBottom:"1px solid #2D2D3F"}}>
        <Code2 size={11} style={{color:"#7C7C9A"}}/><span className="text-[11px]" style={{color:"#7C7C9A"}}>JavaScript</span>
        <div className="flex-1"/>
        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{background:"#2D2D3F",color:"#7C7C9A"}}>setVar / getVar / request / response / log / fail</span>
      </div>
      <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} className="w-full outline-none resize-none p-3 text-[12px] leading-relaxed"
        style={{fontFamily:"'JetBrains Mono',monospace",color:"#CDD6F4",background:"#1E1E2E",caretColor:"#CBA6F7"}} spellCheck={false}/>
    </div>
  );
}

function SmSqlEditor({value,onChange,rows=8}:{value:string;onChange:(v:string)=>void;rows?:number}){
  return(
    <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`,background:"#1A2035"}}>
      <div className="flex items-center gap-2 px-3 py-1.5" style={{background:"#141B2D",borderBottom:"1px solid #243050"}}>
        <Database size={11} style={{color:"#7C9ABF"}}/><span className="text-[11px]" style={{color:"#7C9ABF"}}>SQL</span>
      </div>
      <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} className="w-full outline-none resize-none p-3 text-[12px] leading-relaxed"
        style={{fontFamily:"'JetBrains Mono',monospace",color:"#A8D8FF",background:"#1A2035",caretColor:"#7EB8F7"}} spellCheck={false}/>
    </div>
  );
}

const ALL_CONDITIONS=["等于","不等于","包含","不包含","为空","不为空","开头是","结尾是","正则匹配","大于","大于等于","小于","小于等于","长度等于","长度大于","长度小于","不校验"];

// ─── Processor list panel (shared by Pre and Post) ────────────────────────────

type ProcType="script"|"sql"|"wait"|"extract";
interface Proc{
  id:string;name:string;type:ProcType;enabled:boolean;desc:string;
  script:string;
  dbId:string;timeout:number;sql:string;columnVars:{id:string;varName:string;col:string}[];resultVar:string;
  waitMs:number;
  extractItems:ExItem[];
}
interface ExItem{
  id:string;enabled:boolean;varName:string;desc:string;varType:"temp"|"env";
  method:"jsonpath"|"xpath"|"regex";scope:"body"|"header"|"req-header"|"status"|"msg"|"url";
  expr:string;matchRule:"random"|"index"|"all";matchIndex:number;regexGroup:"full"|"group1";xpathFmt:"xml"|"html";
}

const PROC_TYPE_CFG:Record<ProcType,{label:string;color:string;bg:string}>={
  script: {label:"脚本",  color:"#7816FF",bg:"#F5E8FF"},
  sql:    {label:"SQL",   color:"#0E42D2",bg:"#E8F3FF"},
  wait:   {label:"等待",  color:"#876800",bg:"#FFFBE8"},
  extract:{label:"提取",  color:T.success, bg:"#E8FFEA"},
};

function mkProc(type:ProcType,idx:number):Proc{
  const names:Record<ProcType,string>={script:"脚本处理器",sql:"SQL处理器",wait:"等待处理器",extract:"提取处理器"};
  const scripts:Record<ProcType,string>={
    script:"const timestamp = Date.now()\nsetVar('timestamp', timestamp)\nrequest.headers['X-Timestamp'] = timestamp\nlog('前置处理完成')",
    sql:"",wait:"",extract:"",
  };
  const sqls:Record<ProcType,string>={sql:"select id, token from test_user where username = 'admin'",script:"",wait:"",extract:""};
  return{
    id:"p"+Date.now()+idx,name:names[type]+" "+(idx+1),type,enabled:true,desc:"",
    script:scripts[type],dbId:"db1",timeout:5000,sql:sqls[type],columnVars:[{id:"cv1",varName:"userId",col:"id"},{id:"cv2",varName:"token",col:"token"}],resultVar:"",
    waitMs:1000,extractItems:[],
  };
}

function mkExItem():ExItem{
  return{id:"ex"+Date.now(),enabled:true,varName:"",desc:"",varType:"temp",method:"jsonpath",scope:"body",expr:"",matchRule:"random",matchIndex:0,regexGroup:"full",xpathFmt:"xml"};
}

const MOCK_DBS=[{id:"db1",name:"测试数据库 (MySQL)"},{id:"db2",name:"预发布 (PostgreSQL)"}];

function ProcListItem({p,selected,onSelect,onToggle,onMoveUp,onMoveDown,onCopy,onDel,isFirst,isLast}:{
  p:Proc;selected:boolean;onSelect:()=>void;onToggle:(v:boolean)=>void;
  onMoveUp:()=>void;onMoveDown:()=>void;onCopy:()=>void;onDel:()=>void;
  isFirst:boolean;isLast:boolean;
}){
  const cfg=PROC_TYPE_CFG[p.type];
  return(
    <div onClick={onSelect} className="flex items-center gap-2 px-2 py-2 cursor-pointer rounded-lg mx-1 mb-0.5 group transition-colors"
      style={{background:selected?"#EEF3FF":"transparent",border:selected?`1px solid ${T.primary}20`:"1px solid transparent"}}>
      <SmToggle on={p.enabled} onChange={onToggle}/>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{background:cfg.bg,color:cfg.color}}>{cfg.label}</span>
          <span className="text-[12px] font-medium truncate" style={{color:selected?T.primary:T.t1}}>{p.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e=>{e.stopPropagation();onMoveUp();}} disabled={isFirst} title="上移" className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100" style={{color:isFirst?T.t4:T.t2}}><ArrowUp size={10}/></button>
        <button onClick={e=>{e.stopPropagation();onMoveDown();}} disabled={isLast} title="下移" className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100" style={{color:isLast?T.t4:T.t2}}><ArrowDown size={10}/></button>
        <button onClick={e=>{e.stopPropagation();onCopy();}} title="复制" className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100" style={{color:T.t2}}><Copy size={10}/></button>
        <button onClick={e=>{e.stopPropagation();onDel();}} title="删除" className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50" style={{color:T.danger}}><Trash2 size={10}/></button>
      </div>
    </div>
  );
}

function ScriptDetail({p,onChange}:{p:Proc;onChange:(patch:Partial<Proc>)=>void}){
  return(
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>处理器名称</label>
          <input value={p.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={p.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-[11px] font-semibold" style={{color:T.t3}}>脚本内容</label>
          <div className="flex-1"/>
          <button onClick={()=>onChange({script:""})} className="h-6 px-2 rounded border text-[11px]" style={{borderColor:T.border,color:T.t3}}>清空</button>
          <button className="h-6 px-2 rounded border text-[11px]" style={{borderColor:T.border,color:T.t3}}>格式化</button>
        </div>
        <SmCodeEditor value={p.script} onChange={v=>onChange({script:v})} rows={10}/>
      </div>
      <div className="rounded-lg p-3 flex-shrink-0" style={{background:"#F8F9FC",border:`1px solid ${T.border}`}}>
        <p className="text-[11px] font-semibold mb-2" style={{color:T.t2}}>可用脚本 API</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[["setVar(name,val)","设置变量"],["getVar(name)","读取变量"],["removeVar(name)","删除变量"],["log(msg)","输出日志"],["fail(msg)","主动失败"],["request","请求上下文"],["response","响应上下文（后置）"]].map(([api,desc])=>(
            <div key={api} className="flex items-baseline gap-1.5">
              <code className="text-[11px] font-mono" style={{color:"#7816FF"}}>{api}</code>
              <span className="text-[10px]" style={{color:T.t3}}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>说明</label>
        <input value={p.desc} onChange={e=>onChange({desc:e.target.value})} placeholder="选填，添加处理器说明" className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
    </div>
  );
}

function SqlDetail({p,onChange}:{p:Proc;onChange:(patch:Partial<Proc>)=>void}){
  const addCol=()=>onChange({columnVars:[...p.columnVars,{id:"cv"+Date.now(),varName:"",col:""}]});
  const delCol=(id:string)=>onChange({columnVars:p.columnVars.filter(c=>c.id!==id)});
  const updCol=(id:string,k:"varName"|"col",v:string)=>onChange({columnVars:p.columnVars.map(c=>c.id===id?{...c,[k]:v}:c)});
  return(
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>处理器名称</label>
          <input value={p.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={p.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
      </div>
      <div className="flex gap-3 flex-shrink-0">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>数据库连接</label>
          <select value={p.dbId} onChange={e=>onChange({dbId:e.target.value})} className="w-full h-8 px-2.5 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}}>
            {MOCK_DBS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div style={{width:160}}><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>查询超时 (ms)</label>
          <input type="number" value={p.timeout} onChange={e=>onChange({timeout:+e.target.value})} min={100} max={60000} className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}}/>
        </div>
      </div>
      <div><label className="block text-[11px] font-semibold mb-1.5" style={{color:T.t3}}>SQL 语句</label><SmSqlEditor value={p.sql} onChange={v=>onChange({sql:v})} rows={6}/></div>
      <div>
        <div className="flex items-center gap-2 mb-2"><label className="text-[11px] font-semibold" style={{color:T.t3}}>按列提取变量</label><div className="flex-1"/><button onClick={addCol} className="h-6 px-2 rounded border text-[11px] flex items-center gap-1" style={{borderColor:T.border,color:T.primary}}><Plus size={10}/>添加列</button></div>
        <div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}>
          <table className="w-full text-[12px]">
            <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>{["变量名","列名",""].map(h=><th key={h} className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3}}>{h}</th>)}</tr></thead>
            <tbody>{p.columnVars.map(c=>(
              <tr key={c.id} className="border-b" style={{borderColor:T.border}}>
                <td className="px-3 py-1.5"><input value={c.varName} onChange={e=>updCol(c.id,"varName",e.target.value)} className="w-full outline-none text-[12px] font-mono" style={{color:T.primary}} placeholder="变量名"/></td>
                <td className="px-3 py-1.5"><input value={c.col} onChange={e=>updCol(c.id,"col",e.target.value)} className="w-full outline-none text-[12px] font-mono" style={{color:T.t1}} placeholder="列名"/></td>
                <td className="px-3 py-1.5 text-right"><button onClick={()=>delCol(c.id)}><Trash2 size={11} style={{color:T.danger}}/></button></td>
              </tr>
            ))}</tbody>
          </table>
          {p.columnVars.length===0&&<div className="px-3 py-3 text-center text-[11px]" style={{color:T.t4}}>暂无提取列</div>}
        </div>
      </div>
      <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>完整结果变量（选填）</label>
        <input value={p.resultVar} onChange={e=>onChange({resultVar:e.target.value})} placeholder="将查询结果数组存入该变量" className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none font-mono" style={{borderColor:T.border,color:T.primary}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
    </div>
  );
}

function WaitDetail({p,onChange}:{p:Proc;onChange:(patch:Partial<Proc>)=>void}){
  return(
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>处理器名称</label>
          <input value={p.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={p.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
      </div>
      <div style={{maxWidth:300}}>
        <label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>等待时长 (ms)</label>
        <div className="flex items-center gap-2">
          <input type="number" value={p.waitMs} onChange={e=>onChange({waitMs:Math.min(600000,Math.max(1,+e.target.value))})} min={1} max={600000} className="flex-1 h-9 px-3 border rounded-lg text-[14px] font-semibold outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
          <span className="text-[12px]" style={{color:T.t3}}>ms</span>
        </div>
        <p className="text-[11px] mt-1" style={{color:T.t3}}>范围：1 — 600,000 ms（最长 10 分钟）</p>
      </div>
      <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>说明</label>
        <input value={p.desc} onChange={e=>onChange({desc:e.target.value})} placeholder="选填，添加等待说明" className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
      <div className="rounded-xl p-3 flex-shrink-0" style={{background:"#FFFBE8",border:`1px solid #876800 30`}}>
        <p className="text-[11px]" style={{color:"#876800"}}>等待处理器会暂停当前请求执行流，适用于需要轮询或延迟的场景。等待时间过长会影响测试执行效率。</p>
      </div>
    </div>
  );
}

function ExItemRow({item,onUpdate,onCopy,onDel,hasSent}:{item:ExItem;onUpdate:(p:Partial<ExItem>)=>void;onCopy:()=>void;onDel:()=>void;hasSent:boolean}){
  const[showAdv,setShowAdv]=useState(false);
  const scopeOpts:Record<string,string>={body:"响应体",header:"响应头","req-header":"请求头",status:"状态码",msg:"响应消息",url:"URL"};
  return(
    <div className="rounded-xl overflow-hidden mb-2" style={{border:`1px solid ${T.border}`,background:item.enabled?"#fff":"#FAFAFA"}}>
      <div className="flex items-center gap-2 px-3 py-2" style={{borderBottom:`1px solid ${T.border}`,background:"#FAFAFA"}}>
        <SmToggle on={item.enabled} onChange={v=>onUpdate({enabled:v})}/>
        <input value={item.varName} onChange={e=>onUpdate({varName:e.target.value})} placeholder="变量名" className="font-mono text-[12px] outline-none px-1.5 py-0.5 rounded border" style={{borderColor:T.border,color:T.primary,width:140}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        <select value={item.varType} onChange={e=>onUpdate({varType:e.target.value as any})} className="h-6 px-1.5 border rounded text-[11px] outline-none" style={{borderColor:T.border,color:T.t2}}>
          <option value="temp">临时变量</option><option value="env">环境变量</option>
        </select>
        <div className="flex-1"/>
        <button onClick={()=>setShowAdv(v=>!v)} className="h-6 px-2 rounded border text-[10px]" style={{borderColor:T.border,color:T.t3}}>更多设置</button>
        <button onClick={onCopy} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100" style={{color:T.t2}}><Copy size={11}/></button>
        <button onClick={onDel} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50" style={{color:T.danger}}><Trash2 size={11}/></button>
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex rounded overflow-hidden flex-shrink-0" style={{border:`1px solid ${T.border}`}}>
          {(["jsonpath","xpath","regex"] as const).map(m=>(
            <button key={m} onClick={()=>onUpdate({method:m})} className="px-2.5 h-7 text-[11px] font-medium transition-colors" style={{background:item.method===m?T.primary:"transparent",color:item.method===m?"#fff":T.t3}}>
              {m==="jsonpath"?"JSONPath":m==="xpath"?"XPath":"Regex"}
            </button>
          ))}
        </div>
        {item.method==="regex"&&(
          <select value={item.scope} onChange={e=>onUpdate({scope:e.target.value as any})} className="h-7 px-2 border rounded text-[11px] outline-none flex-shrink-0" style={{borderColor:T.border,color:T.t2}}>
            {Object.entries(scopeOpts).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <input value={item.expr} onChange={e=>onUpdate({expr:e.target.value})} placeholder={item.method==="jsonpath"?"$.data.token":item.method==="xpath"?"/response/data/token":'"token":"([^"]+)"'} className="flex-1 h-7 px-2.5 border rounded text-[12px] font-mono outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        <button disabled={!hasSent} className="h-7 px-2.5 rounded border text-[11px] flex items-center gap-1 flex-shrink-0" style={{borderColor:hasSent?T.primary+"50":T.border,color:hasSent?T.primary:T.t4,background:hasSent?"#EEF6FF":"transparent",cursor:hasSent?"pointer":"not-allowed"}}>
          <Zap size={10}/>快速提取
        </button>
      </div>
      {showAdv&&(
        <div className="px-3 py-2.5 flex items-center gap-4" style={{borderTop:`1px solid ${T.border}`,background:"#F8F9FC"}}>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{color:T.t3}}>结果匹配</span>
            <select value={item.matchRule} onChange={e=>onUpdate({matchRule:e.target.value as any})} className="h-6 px-1.5 border rounded text-[11px] outline-none" style={{borderColor:T.border,color:T.t2}}>
              <option value="random">随机</option><option value="index">指定序号</option><option value="all">全部</option>
            </select>
            {item.matchRule==="index"&&<input type="number" value={item.matchIndex} onChange={e=>onUpdate({matchIndex:+e.target.value})} className="w-14 h-6 px-1.5 border rounded text-[11px] outline-none" style={{borderColor:T.border,color:T.t1}} min={0}/>}
          </div>
          {item.method==="regex"&&<div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{color:T.t3}}>匹配规则</span>
            <select value={item.regexGroup} onChange={e=>onUpdate({regexGroup:e.target.value as any})} className="h-6 px-1.5 border rounded text-[11px] outline-none" style={{borderColor:T.border,color:T.t2}}>
              <option value="full">整段匹配</option><option value="group1">分组 1</option>
            </select>
          </div>}
          {item.method==="xpath"&&<div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{color:T.t3}}>内容格式</span>
            <select value={item.xpathFmt} onChange={e=>onUpdate({xpathFmt:e.target.value as any})} className="h-6 px-1.5 border rounded text-[11px] outline-none" style={{borderColor:T.border,color:T.t2}}>
              <option value="xml">XML</option><option value="html">HTML</option>
            </select>
          </div>}
          <input value={item.desc} onChange={e=>onUpdate({desc:e.target.value})} placeholder="变量描述（选填）" className="flex-1 h-6 px-2 border rounded text-[11px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
      )}
    </div>
  );
}

function ExtractDetail({p,onChange,hasSent}:{p:Proc;onChange:(patch:Partial<Proc>)=>void;hasSent:boolean}){
  const items=p.extractItems;
  const add=()=>onChange({extractItems:[...items,mkExItem()]});
  const upd=(id:string,patch:Partial<ExItem>)=>onChange({extractItems:items.map(i=>i.id===id?{...i,...patch}:i)});
  const cp=(id:string)=>{const src=items.find(i=>i.id===id);if(src)onChange({extractItems:[...items,{...src,id:"ex"+Date.now()}]});};
  const del=(id:string)=>onChange({extractItems:items.filter(i=>i.id!==id)});
  return(
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>处理器名称</label>
          <input value={p.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={p.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
        <div className="pt-5">
          <button onClick={add} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium" style={{background:T.primary,color:"#fff"}}><Plus size={12}/>添加提取项</button>
        </div>
      </div>
      {items.length===0?(
        <div className="flex-1 flex flex-col items-center justify-center" style={{color:T.t4}}>
          <Layers size={28} className="mb-2"/>
          <p className="text-[13px] mb-1">暂无提取项</p>
          <p className="text-[12px]">点击「添加提取项」从响应中提取变量</p>
        </div>
      ):(
        <div className="flex-1 overflow-y-auto">
          {items.map(item=><ExItemRow key={item.id} item={item} onUpdate={p=>upd(item.id,p)} onCopy={()=>cp(item.id)} onDel={()=>del(item.id)} hasSent={hasSent}/>)}
        </div>
      )}
    </div>
  );
}

function ProcessorPanel({procs,setProcs,allowExtract,hasSent}:{procs:Proc[];setProcs:(ps:Proc[])=>void;allowExtract:boolean;hasSent:boolean}){
  const[selId,setSelId]=useState<string|null>(null);
  const[showAdd,setShowAdd]=useState(false);
  const selProc=procs.find(p=>p.id===selId)||null;
  const upd=(id:string,patch:Partial<Proc>)=>setProcs(procs.map(p=>p.id===id?{...p,...patch}:p));
  const addProc=(type:ProcType)=>{
    const np=mkProc(type,procs.length);
    setProcs([...procs,np]);setSelId(np.id);setShowAdd(false);
  };
  const delProc=(id:string)=>{setProcs(procs.filter(p=>p.id!==id));if(selId===id)setSelId(null);};
  const moveUp=(id:string)=>{const i=procs.findIndex(p=>p.id===id);if(i>0){const a=[...procs];[a[i-1],a[i]]=[a[i],a[i-1]];setProcs(a);}};
  const moveDown=(id:string)=>{const i=procs.findIndex(p=>p.id===id);if(i<procs.length-1){const a=[...procs];[a[i],a[i+1]]=[a[i+1],a[i]];setProcs(a);}};
  const copyProc=(id:string)=>{const src=procs.find(p=>p.id===id);if(src){const np={...src,id:"p"+Date.now(),name:src.name+" 副本"};setProcs([...procs,np]);setSelId(np.id);}};
  const types:ProcType[]=allowExtract?["script","sql","wait","extract"]:["script","sql","wait"];

  return(
    <div className="flex flex-1 overflow-hidden">
      {/* Left list */}
      <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:240,borderRight:`1px solid ${T.border}`,background:"#FAFAFA"}}>
        <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div className="relative">
            <button onClick={()=>setShowAdd(v=>!v)} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-medium" style={{background:T.primary,color:"#fff"}}>
              <Plus size={12}/>添加处理器<ChevronDown size={10}/>
            </button>
            {showAdd&&(
              <div className="absolute top-full left-0 mt-1 rounded-lg shadow-lg py-1 z-10 w-40" style={{background:"#fff",border:`1px solid ${T.border}`}}>
                {types.map(t=>{const cfg=PROC_TYPE_CFG[t];return(
                  <button key={t} onClick={()=>addProc(t)} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-gray-50 text-left">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{background:cfg.bg,color:cfg.color}}>{cfg.label}</span>{cfg.label}处理器
                  </button>
                );})}
              </div>
            )}
          </div>
          <span className="text-[11px]" style={{color:T.t4}}>{procs.length} 项</span>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {procs.length===0?(
            <div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}>
              <p className="text-[12px]">暂无处理器</p>
              <p className="text-[11px] mt-0.5">点击「添加处理器」开始</p>
            </div>
          ):(
            procs.map((p,i)=>(
              <ProcListItem key={p.id} p={p} selected={selId===p.id}
                onSelect={()=>setSelId(p.id)} onToggle={v=>upd(p.id,{enabled:v})}
                onMoveUp={()=>moveUp(p.id)} onMoveDown={()=>moveDown(p.id)}
                onCopy={()=>copyProc(p.id)} onDel={()=>delProc(p.id)}
                isFirst={i===0} isLast={i===procs.length-1}/>
            ))
          )}
        </div>
      </div>
      {/* Right detail */}
      <div className="flex-1 overflow-hidden bg-white">
        {!selProc?(
          <div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}>
            <Layers size={32} className="mb-2.5"/>
            <p className="text-[13px]">请选择一个处理器进行编辑</p>
          </div>
        ):selProc.type==="script"?<ScriptDetail p={selProc} onChange={p=>upd(selProc.id,p)}/>
          :selProc.type==="sql"?<SqlDetail p={selProc} onChange={p=>upd(selProc.id,p)}/>
          :selProc.type==="wait"?<WaitDetail p={selProc} onChange={p=>upd(selProc.id,p)}/>
          :<ExtractDetail p={selProc} onChange={p=>upd(selProc.id,p)} hasSent={hasSent}/>
        }
      </div>
    </div>
  );
}

// ─── Pre / Post Tab wrappers ──────────────────────────────────────────────────

function PreScriptTab({hasSent}:{hasSent:boolean}){
  const[procs,setProcs]=useState<Proc[]>([
    {...mkProc("script",0),name:"生成签名",script:"const timestamp = Date.now()\nsetVar('timestamp', timestamp)\nrequest.headers['X-Timestamp'] = timestamp\n\nconst token = getVar('access_token')\nif(!token) fail('access_token 未设置')\nrequest.headers['Authorization'] = 'Bearer ' + token\nlog('前置处理完成')"},
  ]);
  return <ProcessorPanel procs={procs} setProcs={setProcs} allowExtract={false} hasSent={hasSent}/>;
}

function PostScriptTab({hasSent}:{hasSent:boolean}){
  const[procs,setProcs]=useState<Proc[]>([
    {...mkProc("extract",0),name:"提取 token",extractItems:[
      {id:"ex1",enabled:true,varName:"access_token",desc:"登录 token",varType:"temp",method:"jsonpath",scope:"body",expr:"$.data.token",matchRule:"random",matchIndex:0,regexGroup:"full",xpathFmt:"xml"},
      {id:"ex2",enabled:true,varName:"userId",desc:"用户 ID",varType:"temp",method:"jsonpath",scope:"body",expr:"$.data.userId",matchRule:"random",matchIndex:0,regexGroup:"full",xpathFmt:"xml"},
    ]},
  ]);
  return <ProcessorPanel procs={procs} setProcs={setProcs} allowExtract={true} hasSent={hasSent}/>;
}

// ─── Assert Tab ───────────────────────────────────────────────────────────────

type AssertKind="status"|"resp-header"|"resp-body"|"resp-time"|"variable"|"script";
interface Assert2{
  id:string;name:string;kind:AssertKind;enabled:boolean;desc:string;
  statusOp:string;statusExpected:number;
  headerRows:{id:string;header:string;op:string;expected:string;current:string}[];
  bodySubType:"jsonpath"|"xpath"|"regex";
  bodyRows:{id:string;expr:string;op:string;expected:string;current:string}[];
  timeOp:string;timeMs:number;lastTimeMs:number|null;
  varRows:{id:string;varName:string;op:string;expected:string;current:string}[];
  script:string;
}
const ASSERT_KIND_CFG:Record<AssertKind,{label:string;color:string;bg:string}>={
  "status":     {label:"状态码", color:"#0E42D2",bg:"#E8F3FF"},
  "resp-header":{label:"响应头", color:"#876800",bg:"#FFFBE8"},
  "resp-body":  {label:"响应体", color:"#4E5AC8",bg:"#EEF0FA"},
  "resp-time":  {label:"响应时间",color:T.success, bg:"#E8FFEA"},
  "variable":   {label:"变量",   color:"#6B7280",bg:"#F2F3F5"},
  "script":     {label:"脚本",   color:"#7816FF",bg:"#F5E8FF"},
};

function mkAssert(kind:AssertKind,idx:number):Assert2{
  const names:Record<AssertKind,string>={status:"状态码断言","resp-header":"响应头断言","resp-body":"响应体断言","resp-time":"响应时间断言",variable:"变量断言",script:"脚本断言"};
  return{
    id:"as"+Date.now()+idx,name:names[kind]+" "+(idx+1),kind,enabled:true,desc:"",
    statusOp:"等于",statusExpected:200,
    headerRows:[{id:"h1",header:"Content-Type",op:"包含",expected:"application/json",current:""}],
    bodySubType:"jsonpath",bodyRows:[{id:"b1",expr:"$.code",op:"等于",expected:"0",current:""}],
    timeOp:"小于等于",timeMs:1000,lastTimeMs:null,
    varRows:[{id:"v1",varName:"access_token",op:"不为空",expected:"",current:""}],
    script:'if (response.statusCode !== 200) {\n  fail("状态码不是 200")\n}\nlog("断言通过")',
  };
}

function AssertListItem({a,selected,onSelect,onToggle,onMoveUp,onMoveDown,onCopy,onDel,isFirst,isLast}:{
  a:Assert2;selected:boolean;onSelect:()=>void;onToggle:(v:boolean)=>void;
  onMoveUp:()=>void;onMoveDown:()=>void;onCopy:()=>void;onDel:()=>void;
  isFirst:boolean;isLast:boolean;
}){
  const cfg=ASSERT_KIND_CFG[a.kind];
  return(
    <div onClick={onSelect} className="flex items-center gap-2 px-2 py-2 cursor-pointer rounded-lg mx-1 mb-0.5 group transition-colors"
      style={{background:selected?"#EEF3FF":"transparent",border:selected?`1px solid ${T.primary}20`:"1px solid transparent"}}>
      <SmToggle on={a.enabled} onChange={onToggle}/>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{background:cfg.bg,color:cfg.color}}>{cfg.label}</span>
          <span className="text-[12px] font-medium truncate" style={{color:selected?T.primary:T.t1}}>{a.name}</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e=>{e.stopPropagation();onMoveUp();}} disabled={isFirst} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100" style={{color:isFirst?T.t4:T.t2}}><ArrowUp size={10}/></button>
        <button onClick={e=>{e.stopPropagation();onMoveDown();}} disabled={isLast} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100" style={{color:isLast?T.t4:T.t2}}><ArrowDown size={10}/></button>
        <button onClick={e=>{e.stopPropagation();onCopy();}} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100" style={{color:T.t2}}><Copy size={10}/></button>
        <button onClick={e=>{e.stopPropagation();onDel();}} className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50" style={{color:T.danger}}><Trash2 size={10}/></button>
      </div>
    </div>
  );
}

function StatusAssertDetail({a,onChange,hasSent}:{a:Assert2;onChange:(p:Partial<Assert2>)=>void;hasSent:boolean}){
  return(
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>断言名称</label><input value={a.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/></div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={a.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
      </div>
      <div className="flex items-end gap-3">
        <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>比较条件</label>
          <select value={a.statusOp} onChange={e=>onChange({statusOp:e.target.value})} className="h-8 px-2.5 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t2,width:120}}>
            {["等于","不等于","大于","大于等于","小于","小于等于"].map(op=><option key={op}>{op}</option>)}
          </select>
        </div>
        <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>期望状态码</label>
          <input type="number" value={a.statusExpected} onChange={e=>onChange({statusExpected:+e.target.value})} className="h-8 px-3 border rounded-lg text-[13px] font-semibold outline-none" style={{borderColor:T.border,color:T.t1,width:100}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <button className="h-8 px-3 rounded-lg border text-[12px]" style={{borderColor:T.border,color:T.t2}}>测试表达式</button>
      </div>
      {hasSent&&<div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{background:"#E8FFEA",border:`1px solid ${T.success}30`}}><CheckCircle size={13} style={{color:T.success}}/><span className="text-[12px]" style={{color:T.success}}>最近响应状态码：<span className="font-mono font-bold">200</span></span></div>}
    </div>
  );
}

function HeaderAssertDetail({a,onChange,hasSent}:{a:Assert2;onChange:(p:Partial<Assert2>)=>void;hasSent:boolean}){
  const rows=a.headerRows;
  const addRow=()=>onChange({headerRows:[...rows,{id:"h"+Date.now(),header:"",op:"等于",expected:"",current:""}]});
  const updRow=(id:string,k:string,v:string)=>onChange({headerRows:rows.map(r=>r.id===id?{...r,[k]:v}:r)});
  const delRow=(id:string)=>onChange({headerRows:rows.filter(r=>r.id!==id)});
  return(
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>断言名称</label><input value={a.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/></div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={a.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
        <div className="pt-5"><button onClick={addRow} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] font-medium" style={{background:T.primary,color:"#fff"}}><Plus size={12}/>添加项</button></div>
      </div>
      <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
        <table className="w-full text-[12px]">
          <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>{["Header 名称","比较条件","期望值",hasSent?"当前值":"",""].map((h,i)=><th key={i} className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3}}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(r=>(
            <tr key={r.id} className="border-b" style={{borderColor:T.border}}>
              <td className="px-3 py-1.5"><input value={r.header} onChange={e=>updRow(r.id,"header",e.target.value)} className="outline-none text-[12px] font-mono w-full" style={{color:T.t1}} placeholder="Content-Type"/></td>
              <td className="px-3 py-1.5"><select value={r.op} onChange={e=>updRow(r.id,"op",e.target.value)} className="outline-none text-[12px] rounded border px-1 py-0.5" style={{borderColor:T.border,color:T.t2}}>{["等于","不等于","包含","不为空","为空"].map(op=><option key={op}>{op}</option>)}</select></td>
              <td className="px-3 py-1.5"><input value={r.expected} onChange={e=>updRow(r.id,"expected",e.target.value)} className="outline-none text-[12px] font-mono w-full" style={{color:T.t1}} placeholder="期望值"/></td>
              {hasSent&&<td className="px-3 py-1.5"><span className="text-[11px] font-mono" style={{color:T.t3}}>{r.current||"—"}</span></td>}
              <td className="px-3 py-1.5 text-right"><button onClick={()=>delRow(r.id)}><Trash2 size={11} style={{color:T.danger}}/></button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function BodyAssertDetail({a,onChange,hasSent}:{a:Assert2;onChange:(p:Partial<Assert2>)=>void;hasSent:boolean}){
  const rows=a.bodyRows;
  const addRow=()=>onChange({bodyRows:[...rows,{id:"b"+Date.now(),expr:"",op:"等于",expected:"",current:""}]});
  const updRow=(id:string,k:string,v:string)=>onChange({bodyRows:rows.map(r=>r.id===id?{...r,[k]:v}:r)});
  const delRow=(id:string)=>onChange({bodyRows:rows.filter(r=>r.id!==id)});
  const ph=a.bodySubType==="jsonpath"?"$.data.token":a.bodySubType==="xpath"?"/response/data/token":'"success":true';
  return(
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>断言名称</label><input value={a.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/></div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={a.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
        <div className="pt-5"><button onClick={addRow} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] font-medium" style={{background:T.primary,color:"#fff"}}><Plus size={12}/>添加项</button></div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold" style={{color:T.t3}}>断言类型</span>
        <div className="flex rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}>
          {(["jsonpath","xpath","regex"] as const).map(m=>(
            <button key={m} onClick={()=>onChange({bodySubType:m})} className="px-3 h-7 text-[12px] font-medium transition-colors" style={{background:a.bodySubType===m?T.primary:"transparent",color:a.bodySubType===m?"#fff":T.t3}}>
              {m==="jsonpath"?"JSONPath":m==="xpath"?"XPath":"Regex"}
            </button>
          ))}
        </div>
        <button disabled={!hasSent} className="h-7 px-2.5 rounded border text-[11px] flex items-center gap-1" style={{borderColor:hasSent?T.primary+"50":T.border,color:hasSent?T.primary:T.t4,cursor:hasSent?"pointer":"not-allowed"}}>
          <Zap size={10}/>快速提取
        </button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
        <table className="w-full text-[12px]">
          <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>{["表达式","比较条件","期望值",hasSent?"当前值":"","操作"].map((h,i)=><th key={i} className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3}}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(r=>(
            <tr key={r.id} className="border-b" style={{borderColor:T.border}}>
              <td className="px-3 py-1.5"><input value={r.expr} onChange={e=>updRow(r.id,"expr",e.target.value)} className="outline-none text-[12px] font-mono" style={{color:T.primary,width:150}} placeholder={ph}/></td>
              <td className="px-3 py-1.5"><select value={r.op} onChange={e=>updRow(r.id,"op",e.target.value)} className="outline-none text-[12px] rounded border px-1 py-0.5" style={{borderColor:T.border,color:T.t2}}>{ALL_CONDITIONS.map(op=><option key={op}>{op}</option>)}</select></td>
              <td className="px-3 py-1.5"><input value={r.expected} onChange={e=>updRow(r.id,"expected",e.target.value)} className="outline-none text-[12px] font-mono" style={{color:T.t1,width:100}} placeholder="期望值"/></td>
              {hasSent&&<td className="px-3 py-1.5"><span className="text-[11px] font-mono" style={{color:T.t3}}>{r.current||"—"}</span></td>}
              <td className="px-3 py-1.5">
                <div className="flex gap-1">
                  <button title="测试" className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100" style={{color:T.t2}}><Zap size={10}/></button>
                  <button onClick={()=>delRow(r.id)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50" style={{color:T.danger}}><Trash2 size={10}/></button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function TimeAssertDetail({a,onChange,hasSent}:{a:Assert2;onChange:(p:Partial<Assert2>)=>void;hasSent:boolean}){
  return(
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>断言名称</label><input value={a.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/></div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={a.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
      </div>
      <div className="flex items-end gap-3">
        <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>比较条件</label>
          <select value={a.timeOp} onChange={e=>onChange({timeOp:e.target.value})} className="h-8 px-2.5 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t2,width:130}}>
            {["小于","小于等于","大于","大于等于","等于"].map(op=><option key={op}>{op}</option>)}
          </select>
        </div>
        <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>阈值 (ms)</label>
          <input type="number" value={a.timeMs} onChange={e=>onChange({timeMs:+e.target.value})} className="h-8 px-3 border rounded-lg text-[13px] font-semibold outline-none" style={{borderColor:T.border,color:T.t1,width:120}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
        </div>
        <span className="text-[12px] pb-1.5" style={{color:T.t3}}>ms</span>
      </div>
      {hasSent&&<div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{background:"#E8FFEA",border:`1px solid ${T.success}30`}}>
        <Clock size={13} style={{color:T.success}}/><span className="text-[12px]" style={{color:T.success}}>最近耗时：<span className="font-mono font-bold">123 ms</span></span>
      </div>}
    </div>
  );
}

function VarAssertDetail({a,onChange,hasSent}:{a:Assert2;onChange:(p:Partial<Assert2>)=>void;hasSent:boolean}){
  const rows=a.varRows;
  const addRow=()=>onChange({varRows:[...rows,{id:"v"+Date.now(),varName:"",op:"不为空",expected:"",current:""}]});
  const updRow=(id:string,k:string,v:string)=>onChange({varRows:rows.map(r=>r.id===id?{...r,[k]:v}:r)});
  const delRow=(id:string)=>onChange({varRows:rows.filter(r=>r.id!==id)});
  return(
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>断言名称</label><input value={a.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/></div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={a.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
        <div className="pt-5"><button onClick={addRow} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] font-medium" style={{background:T.primary,color:"#fff"}}><Plus size={12}/>添加项</button></div>
      </div>
      <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
        <table className="w-full text-[12px]">
          <thead><tr style={{background:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>{["变量名","比较条件","期望值",hasSent?"当前值":"",""].map((h,i)=><th key={i} className="px-3 py-1.5 text-left text-[10px] font-semibold" style={{color:T.t3}}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(r=>(
            <tr key={r.id} className="border-b" style={{borderColor:T.border}}>
              <td className="px-3 py-1.5"><input value={r.varName} onChange={e=>updRow(r.id,"varName",e.target.value)} className="outline-none text-[12px] font-mono" style={{color:T.primary,width:130}} placeholder="变量名"/></td>
              <td className="px-3 py-1.5"><select value={r.op} onChange={e=>updRow(r.id,"op",e.target.value)} className="outline-none text-[12px] rounded border px-1 py-0.5" style={{borderColor:T.border,color:T.t2}}>{ALL_CONDITIONS.map(op=><option key={op}>{op}</option>)}</select></td>
              <td className="px-3 py-1.5"><input value={r.expected} onChange={e=>updRow(r.id,"expected",e.target.value)} className="outline-none text-[12px] font-mono" style={{color:T.t1,width:100}} placeholder="期望值"/></td>
              {hasSent&&<td className="px-3 py-1.5"><span className="text-[11px] font-mono" style={{color:T.t3}}>{r.current||"—"}</span></td>}
              <td className="px-3 py-1.5 text-right"><button onClick={()=>delRow(r.id)}><Trash2 size={11} style={{color:T.danger}}/></button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function ScriptAssertDetail({a,onChange}:{a:Assert2;onChange:(p:Partial<Assert2>)=>void}){
  return(
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1"><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>断言名称</label><input value={a.name} onChange={e=>onChange({name:e.target.value})} className="w-full h-8 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/></div>
        <div className="flex items-center gap-2 pt-5"><SmToggle on={a.enabled} onChange={v=>onChange({enabled:v})}/><span className="text-[12px]" style={{color:T.t2}}>启用</span></div>
      </div>
      <SmCodeEditor value={a.script} onChange={v=>onChange({script:v})} rows={10}/>
      <div><label className="block text-[11px] font-semibold mb-1" style={{color:T.t3}}>说明</label>
        <input value={a.desc} onChange={e=>onChange({desc:e.target.value})} placeholder="选填" className="w-full h-8 px-3 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>e.currentTarget.style.borderColor=T.primary} onBlur={e=>e.currentTarget.style.borderColor=T.border}/>
      </div>
    </div>
  );
}

function AssertTab({hasSent}:{hasSent:boolean}){
  const[asserts,setAsserts]=useState<Assert2[]>([
    {...mkAssert("status",0),name:"状态码 200"},
    {...mkAssert("resp-body",1),name:"响应体断言"},
  ]);
  const[selId,setSelId]=useState<string|null>("as"+asserts[0]?.id.slice(2)||null);
  const[showAdd,setShowAdd]=useState(false);
  const selA=asserts.find(a=>a.id===selId)||null;
  const upd=(id:string,p:Partial<Assert2>)=>setAsserts(as=>as.map(a=>a.id===id?{...a,...p}:a));
  const addA=(kind:AssertKind)=>{const na=mkAssert(kind,asserts.length);setAsserts(as=>[...as,na]);setSelId(na.id);setShowAdd(false);};
  const delA=(id:string)=>{setAsserts(as=>as.filter(a=>a.id!==id));if(selId===id)setSelId(null);};
  const moveUp=(id:string)=>{const i=asserts.findIndex(a=>a.id===id);if(i>0){const ar=[...asserts];[ar[i-1],ar[i]]=[ar[i],ar[i-1]];setAsserts(ar);}};
  const moveDown=(id:string)=>{const i=asserts.findIndex(a=>a.id===id);if(i<asserts.length-1){const ar=[...asserts];[ar[i],ar[i+1]]=[ar[i+1],ar[i]];setAsserts(ar);}};
  const copyA=(id:string)=>{const src=asserts.find(a=>a.id===id);if(src){const na={...src,id:"as"+Date.now(),name:src.name+" 副本"};setAsserts(as=>[...as,na]);setSelId(na.id);}};

  const kinds:AssertKind[]=["status","resp-header","resp-body","resp-time","variable","script"];

  return(
    <div className="flex flex-1 overflow-hidden">
      {/* Left list */}
      <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:240,borderRight:`1px solid ${T.border}`,background:"#FAFAFA"}}>
        <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div className="relative">
            <button onClick={()=>setShowAdd(v=>!v)} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[12px] font-medium" style={{background:T.primary,color:"#fff"}}>
              <Plus size={12}/>添加断言<ChevronDown size={10}/>
            </button>
            {showAdd&&(
              <div className="absolute top-full left-0 mt-1 rounded-lg shadow-lg py-1 z-10 w-40" style={{background:"#fff",border:`1px solid ${T.border}`}}>
                {kinds.map(k=>{const cfg=ASSERT_KIND_CFG[k];return(
                  <button key={k} onClick={()=>addA(k)} className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-gray-50 text-left">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{background:cfg.bg,color:cfg.color}}>{cfg.label}</span>{cfg.label}
                  </button>
                );})}
              </div>
            )}
          </div>
          <button disabled={!hasSent} title="从响应快速生成断言" className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border text-[11px]" style={{borderColor:hasSent?T.primary+"50":T.border,color:hasSent?T.primary:T.t4,cursor:hasSent?"pointer":"not-allowed"}}>
            <Zap size={10}/>快速生成
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {asserts.length===0?(
            <div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}>
              <p className="text-[12px]">暂无断言</p>
              <p className="text-[11px] mt-0.5">点击「添加断言」开始</p>
            </div>
          ):(
            asserts.map((a,i)=>(
              <AssertListItem key={a.id} a={a} selected={selId===a.id}
                onSelect={()=>setSelId(a.id)} onToggle={v=>upd(a.id,{enabled:v})}
                onMoveUp={()=>moveUp(a.id)} onMoveDown={()=>moveDown(a.id)}
                onCopy={()=>copyA(a.id)} onDel={()=>delA(a.id)}
                isFirst={i===0} isLast={i===asserts.length-1}/>
            ))
          )}
        </div>
      </div>
      {/* Right detail */}
      <div className="flex-1 overflow-y-auto bg-white">
        {!selA?(
          <div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}>
            <Shield size={32} className="mb-2.5"/>
            <p className="text-[13px]">请选择一个断言进行编辑</p>
          </div>
        ):selA.kind==="status"?<StatusAssertDetail a={selA} onChange={p=>upd(selA.id,p)} hasSent={hasSent}/>
          :selA.kind==="resp-header"?<HeaderAssertDetail a={selA} onChange={p=>upd(selA.id,p)} hasSent={hasSent}/>
          :selA.kind==="resp-body"?<BodyAssertDetail a={selA} onChange={p=>upd(selA.id,p)} hasSent={hasSent}/>
          :selA.kind==="resp-time"?<TimeAssertDetail a={selA} onChange={p=>upd(selA.id,p)} hasSent={hasSent}/>
          :selA.kind==="variable"?<VarAssertDetail a={selA} onChange={p=>upd(selA.id,p)} hasSent={hasSent}/>
          :<ScriptAssertDetail a={selA} onChange={p=>upd(selA.id,p)}/>
        }
      </div>
    </div>
  );
}


function ApiLeftPanel({selectedId,onSelect,onImport}:{selectedId?:string;onSelect:(id:string,item?:ApiEndpoint)=>void;onImport?:()=>void}){
  const[folders,setFolders]=useState<ApiFolder[]>(API_FOLDERS);
  const toggleFolder=(id:string)=>setFolders(fs=>fs.map(f=>f.id===id?{...f,expanded:!f.expanded}:f));
  return(
    <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:250,backgroundColor:"#fff",borderRight:`1px solid ${T.border}`}}>
      <div className="px-3 pt-3 pb-2 flex-shrink-0 flex gap-2">
        <PBtn icon={Plus} onClick={()=>{}} small>新建请求</PBtn>
        <PBtn icon={Upload} onClick={()=>onImport?.()} variant="ghost"><span className="text-[12px]">导入</span></PBtn>
      </div>
      <div className="px-3 pb-2 flex-shrink-0"><Inp placeholder="搜索请求" prefix={<Search size={12}/>} width="100%"/></div>
      <div className="px-2 py-1 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}><p className="px-2 py-1 text-[12px] font-medium" style={{color:T.t3}}>请求目录</p></div>
      <div className="flex-1 overflow-y-auto py-1">
        <div className="px-3 py-1.5 flex items-center gap-1.5 text-[13px] font-semibold" style={{color:T.t1}}><FolderOpen size={13} style={{color:T.warning}}/><span>X-MAN</span><span className="ml-auto text-[11px]" style={{color:T.t3}}>1165</span></div>
        {folders.map(f=>(
          <div key={f.id}>
            <button onClick={()=>toggleFolder(f.id)} className="w-full flex items-center gap-1.5 px-4 py-1.5 text-[13px] text-left transition-colors" style={{color:T.t1}} onMouseEnter={e=>e.currentTarget.style.backgroundColor="#F4F6FA"} onMouseLeave={e=>e.currentTarget.style.backgroundColor=""}>
              {f.expanded?<ChevronDown size={11} style={{color:T.t3}}/>:<ChevronRight size={11} style={{color:T.t3}}/>}
              <Folder size={12} style={{color:T.warning,flexShrink:0}}/>
              <span className="flex-1 truncate">{f.name}</span><span className="text-[11px]" style={{color:T.t4}}>{f.count}</span>
            </button>
            {f.expanded&&f.items.map(item=>(
              <button key={item.id} onClick={()=>onSelect(item.id,item)} className="w-full flex items-center gap-2 py-1.5 pl-8 pr-3 text-[12px] text-left transition-colors" style={{backgroundColor:selectedId===item.id?"#FFF3E8":""}} onMouseEnter={e=>selectedId!==item.id&&(e.currentTarget.style.backgroundColor="#F4F6FA")} onMouseLeave={e=>selectedId!==item.id&&(e.currentTarget.style.backgroundColor="")}>
                <MethodBadge method={item.method}/><span className="truncate flex-1" style={{color:T.t2}}>{item.name}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ApiWorkbench({onOpenAiDrawer}:{onOpenAiDrawer:()=>void}){
  const[selectedEndpoint,setSelectedEndpoint]=useState<ApiEndpoint|null>(null);
  const[requestTab,setRequestTab]=useState("Params");
  const[bodyType,setBodyType]=useState("json");
  const[responseTab,setResponseTab]=useState("响应体");
  const[hasSent,setHasSent]=useState(false);
  const[url,setUrl]=useState("");
  const[method,setMethod]=useState<HttpMethod>("GET");
  const[showLocalAiDrawer,setShowLocalAiDrawer]=useState(false);
  const[openTabs,setOpenTabs]=useState<{id:string;label:string;method:HttpMethod;tabType?:"ai-workbench";aiMeta?:{epMethod:string;epPath:string;endpointName:string}}[]>([{id:"new",label:"新建请求",method:"GET"}]);
  const[activeTab,setActiveTab]=useState("new");
  // ── Overlay modals ─────────────────────────────────────────────────────────
  const[showSaveDialog,setShowSaveDialog]=useState(false);
  const[showImportDialog,setShowImportDialog]=useState(false);
  const[showEnvDrawer,setShowEnvDrawer]=useState(false);
  const[showUnsavedConfirm,setShowUnsavedConfirm]=useState(false);
  const[sendState,setSendState]=useState<"idle"|"sending"|"cancel"|"timeout"|"network-error"|"ssl-error"|"body-too-large">("idle");
  const configTabs=["Params","Auth","Headers","Body","前置处理","后置处理","断言","提取器","设置","用例","定义"];
  const responseTabs=["响应体","Headers","Cookies","断言结果"];
  const isSaved=activeTab!=="new"&&selectedEndpoint!==null&&!openTabs.find(t=>t.id===activeTab&&t.tabType==="ai-workbench");
  const activeTabData=openTabs.find(t=>t.id===activeTab);
  const isAiWorkbenchTab=activeTabData?.tabType==="ai-workbench";
  const handleSelect=(_id:string,item?:ApiEndpoint)=>{if(!item)return;setSelectedEndpoint(item);setMethod(item.method);setUrl(item.path);setHasSent(false);if(!openTabs.find(t=>t.id===item.id))setOpenTabs(tabs=>[...tabs,{id:item.id,label:item.name,method:item.method}]);setActiveTab(item.id);};
  const openAiWorkbenchTab=(endpointName:string,epMethod:string,epPath:string)=>{
    const tabId=`ai-wb-${Date.now()}`;
    setOpenTabs(tabs=>[...tabs,{id:tabId,label:`AI 用例 · ${endpointName}`,method:epMethod as HttpMethod,tabType:"ai-workbench" as const,aiMeta:{epMethod,epPath,endpointName}}]);
    setActiveTab(tabId);
  };
  return(
    <div className="flex flex-1 overflow-hidden">
      <ApiLeftPanel selectedId={selectedEndpoint?.id} onSelect={handleSelect} onImport={()=>setShowImportDialog(true)}/>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Open tabs */}
        <div className="flex items-center flex-shrink-0" style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`,height:40}}>
          {openTabs.map(t=>(
            <div key={t.id} onClick={()=>setActiveTab(t.id)} className="flex items-center gap-2 px-3 h-full border-r cursor-pointer text-[12px]" style={{borderColor:T.border,borderBottom:activeTab===t.id?`2px solid ${t.tabType==="ai-workbench"?"#7816FF":T.warning}`:undefined,backgroundColor:activeTab===t.id?"#fff":"transparent",color:activeTab===t.id?T.t1:T.t3}}>
              {t.tabType==="ai-workbench"?<span style={{fontSize:10,padding:"1px 4px",borderRadius:3,background:"#F5E8FF",color:"#7816FF",fontWeight:700}}>AI</span>:<MethodBadge method={t.method}/>}
              <span style={{maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.label}</span>
              {t.id!=="new"&&<button onClick={e=>{e.stopPropagation();setOpenTabs(tabs=>tabs.filter(x=>x.id!==t.id));setActiveTab("new");}} className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200" style={{color:T.t4}}><X size={10}/></button>}
            </div>
          ))}
          <button className="px-3 h-full text-[16px]" style={{color:T.t4}} onMouseEnter={e=>e.currentTarget.style.color=T.t1} onMouseLeave={e=>e.currentTarget.style.color=T.t4}>+</button>
        </div>
        {/* AI Workbench full content */}
        {isAiWorkbenchTab && activeTabData?.aiMeta && (
          <ApiAiCaseWorkbench
            method={activeTabData.aiMeta.epMethod}
            path={activeTabData.aiMeta.epPath}
            endpointName={activeTabData.aiMeta.endpointName}
            onClose={()=>{setOpenTabs(tabs=>tabs.filter(x=>x.id!==activeTab));setActiveTab("new");}}
          />
        )}
        {/* URL bar */}
        <div className="flex items-center gap-2 px-4 flex-shrink-0" style={{display:isAiWorkbenchTab?"none":"flex",height:56,backgroundColor:"#fff",borderBottom:`1px solid ${T.border}`}}>
          <select value={method} onChange={e=>setMethod(e.target.value as HttpMethod)} className="h-9 px-2.5 rounded-lg border text-[12px] font-bold outline-none" style={{borderColor:METHOD_BG[method],backgroundColor:METHOD_BG[method],color:METHOD_COLOR[method],width:90}}>
            {(["GET","POST","PUT","DELETE","PATCH"] as HttpMethod[]).map(m=><option key={m}>{m}</option>)}
          </select>
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="请输入包含 http/https 的完整 URL 或接口路径" className="flex-1 h-9 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.currentTarget.style.borderColor=T.primary;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
          <button onClick={()=>setShowImportDialog(true)} className="h-8 px-3 rounded-lg border text-[12px] font-medium flex items-center gap-1.5" style={{borderColor:T.border,color:T.t2}}><Upload size={12}/>导入</button>
          <button onClick={()=>setShowEnvDrawer(true)} className="h-8 px-2.5 border rounded-lg text-[12px] outline-none flex items-center gap-1.5" style={{borderColor:T.border,color:T.t2,minWidth:110}}><Globe size={12}/>测试环境</button>
          <PBtn icon={Play} onClick={()=>{setSendState("sending");setTimeout(()=>{setSendState("idle");setHasSent(true);},1200);}}>发送</PBtn>
          <PBtn icon={Save} onClick={()=>setShowSaveDialog(true)} variant="ghost">保存</PBtn>
          <button onClick={()=>setShowLocalAiDrawer(true)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[12px] font-medium" style={{borderColor:`${T.purple}30`,color:T.purple,backgroundColor:"#F5E8FF"}} title="AI 生成接口用例"><Sparkles size={13}/>AI 生成</button>
        </div>
        {/* Config tabs */}
        <div className="flex items-center flex-shrink-0 px-4" style={{display:isAiWorkbenchTab?"none":"flex",backgroundColor:"#fff",borderBottom:`1px solid ${T.border}`,height:40}}>
          {configTabs.map(tab=><button key={tab} onClick={()=>setRequestTab(tab)} className="h-full px-3 text-[13px] font-medium border-b-2 transition-colors" style={{borderBottomColor:requestTab===tab?T.warning:"transparent",color:requestTab===tab?T.warning:T.t2}}>{tab}</button>)}
        </div>
        {/* Config content */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-white" style={{display:isAiWorkbenchTab?"none":"flex",flexDirection:"column"}}>
          {requestTab==="Params"&&<div className="p-4"><div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}><table className="w-full text-[13px]"><thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>{["","参数名","参数值","说明"].map((h,i)=><th key={i} className="px-3 py-2 text-left text-[11px] font-semibold" style={{color:T.t3,width:i===0?"32px":undefined}}>{h}</th>)}</tr></thead><tbody>{[{key:"page",val:"1"},{key:"pageSize",val:"20"},{key:"status",val:""}].map((r,i)=><tr key={i} className="border-b" style={{borderColor:T.border}}><td className="px-3 py-2"><input type="checkbox" defaultChecked className="w-3.5 h-3.5" style={{accentColor:T.primary}}/></td><td className="px-3 py-2"><input defaultValue={r.key} className="w-full outline-none text-[13px] font-mono" style={{color:T.primary}}/></td><td className="px-3 py-2"><input defaultValue={r.val} className="w-full outline-none text-[13px]" style={{color:T.t1}}/></td><td className="px-3 py-2"><input className="w-full outline-none text-[13px]" style={{color:T.t3}}/></td></tr>)}</tbody></table><button className="flex items-center gap-1.5 w-full px-3 py-2 text-[12px]" style={{color:T.t3}}><Plus size={12}/>添加参数</button></div></div>}
          {requestTab==="Body"&&<div className="p-4" style={{flex:bodyType==="binary"?1:undefined,display:"flex",flexDirection:"column"}}>
            <div className="flex gap-1 mb-3">{["none","form-data","x-www-form-urlencoded","json","xml","raw","binary"].map(t=><button key={t} onClick={()=>setBodyType(t)} className="px-3 py-1.5 rounded text-[12px] font-medium border" style={{backgroundColor:bodyType===t?`${T.primary}12`:"transparent",color:bodyType===t?T.primary:T.t3,borderColor:bodyType===t?`${T.primary}30`:"transparent"}}>{t}</button>)}</div>
            {bodyType==="json"&&<div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}><div className="flex items-center gap-2 px-3 py-2" style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}><Code2 size={12} style={{color:T.t3}}/><span className="text-[11px]" style={{color:T.t3}}>JSON</span></div><textarea defaultValue={'{\n  "page": 1,\n  "pageSize": 20\n}'} className="w-full outline-none resize-none text-[12px] p-4" rows={8} style={{fontFamily:"'JetBrains Mono',monospace",color:"#1D2129"}}/></div>}
            {bodyType==="binary"&&<BinaryBodyPanel/>}
            {!["json","binary"].includes(bodyType)&&<div className="flex items-center justify-center py-12" style={{color:T.t4}}><p className="text-[13px]">请求没有 Body</p></div>}
          </div>}
          {requestTab==="前置处理"&&<PreScriptTab hasSent={hasSent}/>}
          {requestTab==="后置处理"&&<PostScriptTab hasSent={hasSent}/>}
          {requestTab==="Auth"&&<AuthConfigSection/>}
          {requestTab==="设置"&&<SettingsPanel/>}
          {requestTab==="断言"&&<AssertTab hasSent={hasSent}/>}
          {requestTab==="用例"&&<ApiCaseTab isSaved={isSaved} method={method} path={url||selectedEndpoint?.path||"/api/endpoint"} endpointName={selectedEndpoint?.name||"新建请求"} envSelected={true}/>}
          {requestTab==="定义"&&<JsonSchemaPanel/>}
          {!["Params","Auth","Body","前置处理","后置处理","断言","用例","定义","設置","设置"].includes(requestTab)&&<div className="flex items-center justify-center py-12" style={{color:T.t4}}><p className="text-[13px]">暂无配置</p></div>}
        </div>
        {/* Response — hidden on 用例/定义 tabs and AI workbench tab */}
        <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{height:isAiWorkbenchTab||["用例","定义"].includes(requestTab)?0:280,borderTop:isAiWorkbenchTab||["用例","定义"].includes(requestTab)?`none`:`2px solid ${T.border}`,backgroundColor:"#fff",transition:"height .2s",overflow:"hidden"}}>
          <div className="flex items-center flex-shrink-0 px-4 gap-4" style={{height:40,borderBottom:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
            <span className="text-[13px] font-semibold" style={{color:T.t1}}>响应内容</span>
            {hasSent&&<><span className="px-2 py-0.5 rounded text-[12px] font-bold" style={{backgroundColor:"#E8FFEA",color:T.success}}>200 OK</span><span className="text-[12px]" style={{color:T.t3}}>123 ms</span><span className="text-[12px]" style={{color:T.t3}}>1.84 KB</span></>}
            <div className="flex-1"/>
            <div className="flex">{responseTabs.map(tab=><button key={tab} onClick={()=>setResponseTab(tab)} className="h-8 px-3 text-[12px] font-medium border-b-2" style={{borderBottomColor:responseTab===tab?T.primary:"transparent",color:responseTab===tab?T.primary:T.t3}}>{tab}</button>)}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-4" style={{display:"flex",flexDirection:"column"}}>
            {sendState!=="idle"
              ?<RequestSendStatePanel state={sendState} onCancel={()=>setSendState("cancel")} onDismiss={()=>setSendState("idle")}/>
              :!hasSent
                ?<div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}><Play size={28} className="mb-2"/><p className="text-[13px]">点击「发送」获取响应内容</p></div>
                :<pre className="text-[12px] leading-relaxed" style={{fontFamily:"'JetBrains Mono',monospace",color:T.t1}}>{MOCK_RESPONSE_JSON}</pre>
            }
          </div>
        </div>
      </div>
      {showLocalAiDrawer && (
        <ApiAiGenerationDrawer
          method={method} path={url||selectedEndpoint?.path||"/api/endpoint"}
          endpointName={selectedEndpoint?.name||"新建请求"}
          onClose={()=>setShowLocalAiDrawer(false)}
          onGenerate={()=>{
            setShowLocalAiDrawer(false);
            openAiWorkbenchTab(
              selectedEndpoint?.name||"新建请求",
              method,
              url||selectedEndpoint?.path||"/api/endpoint"
            );
          }}
        />
      )}
      {showSaveDialog&&<SaveApiDialog onClose={()=>setShowSaveDialog(false)}/>}
      {showImportDialog&&<ImportApiDialog onClose={()=>setShowImportDialog(false)}/>}
      {showEnvDrawer&&<EnvDetailDrawer onClose={()=>setShowEnvDrawer(false)}/>}
      {showUnsavedConfirm&&<UnsavedConfirmDialog onClose={()=>setShowUnsavedConfirm(false)} onDiscard={()=>setShowUnsavedConfirm(false)}/>}
    </div>
  );
}

function ApiModule(){
  const[page,setPage]=useState<ApiPage>("workbench");
  const[showAiDrawer,setShowAiDrawer]=useState(false);
  const pages=[{key:"workbench" as ApiPage,label:"接口管理"},{key:"scenarios" as ApiPage,label:"接口场景"},{key:"suites" as ApiPage,label:"执行套件"},{key:"reports" as ApiPage,label:"报告"}];
  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center flex-shrink-0 px-5" style={{backgroundColor:"#fff",borderBottom:`1px solid ${T.border}`,height:44}}>
        {pages.map(p=><button key={p.key} onClick={()=>setPage(p.key)} className="h-full px-5 text-[13px] font-medium border-b-2 transition-colors" style={{borderBottomColor:page===p.key?T.warning:"transparent",color:page===p.key?T.t1:T.t3}}>{p.label}</button>)}
        <div className="flex-1"/><select className="h-7 px-2.5 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t2}}><option>X-MAN</option></select>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {page==="workbench"&&<ApiWorkbench onOpenAiDrawer={()=>setShowAiDrawer(true)}/>}
        {page==="scenarios"&&<SceneExtrasShowcase/>}
        {page==="suites"&&<SuiteManagement/>}
        {page==="reports"&&(
          <div className="flex-1 overflow-y-auto p-5">
            <PageHead title="运行报告" desc="查看所有执行报告，快速定位失败原因"/>
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[{label:"总执行次数",value:"302",color:T.primary},{label:"通过次数",value:"261",color:T.success},{label:"失败次数",value:"41",color:T.danger},{label:"通过率",value:"86%",color:"#4E5AC8"}].map(s=><div key={s.label} className="rounded-xl p-4 bg-white" style={{border:`1px solid ${T.border}`}}><p className="text-[11px]" style={{color:T.t3}}>{s.label}</p><p className="text-[24px] font-bold mt-1" style={{color:s.color}}>{s.value}</p></div>)}
            </div>
            <div className="flex items-center justify-center py-16" style={{color:T.t3}}><p className="text-[13px]">选择套件或场景后执行，报告将在此展示</p></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SIDEBAR + LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// WEB UI AUTOMATION MODULE

function ReportModule() {
  const [sub, setSub]                       = useState<"list"|"detail"|"share">("list");
  const [selectedReport, setSelectedReport] = useState<ReportRecord|null>(null);

  const handleView = (r:ReportRecord) => { setSelectedReport(r); setSub("detail"); };
  const handleShare = ()               => setSub("share");

  if (sub==="share") {
    return <ShareReportPage onBack={()=>setSub("list")}/>;
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar (list only — detail has its own breadcrumb) */}
      {sub==="list" && (
        <div className="flex items-center flex-shrink-0 px-5 bg-white" style={{ borderBottom:`1px solid ${T.border}`, height:44 }}>
          {(["list","share"] as const).map(k=>{
            const labels = { list:"报告列表", share:"分享报告" };
            const color  = "#7816FF";
            return (
              <button key={k} onClick={()=>setSub(k)}
                className="h-full px-4 text-[13px] font-medium border-b-2 transition-colors"
                style={{ borderBottomColor: sub===k ? color : "transparent", color: sub===k ? color : T.t3 }}>
                {labels[k]}
              </button>
            );
          })}
        </div>
      )}
      {sub==="list"   && <ReportListPage onView={handleView} onShare={r=>{ setSelectedReport(r); handleShare(); }}/>}
      {sub==="detail" && selectedReport && <ReportDetailPage report={selectedReport} onBack={()=>setSub("list")} onShare={handleShare}/>}
    </div>
  );
}

// Primary nav module definitions (flat — one button per top-level module)
const PRIMARY_MODULES = [
  {key:"overview",  nav:"overview"   as ActiveNav, icon:LayoutDashboard, color:T.primary,  label:"工作台"},
  {key:"config",    nav:"config"     as ActiveNav, icon:Settings,        color:"#4E5AC8",  label:"配置中心"},
  {key:"cases",     nav:"cases-list" as ActiveNav, icon:FileText,        color:T.success,  label:"用例中心"},
  {key:"testmgmt",  nav:"testmgmt"   as ActiveNav, icon:FlaskConical,   color:"#0EA5E9",  label:"测试管理"},
  {key:"bugs",      nav:"bugs"       as ActiveNav, icon:Bug,             color:T.danger,   label:"缺陷管理"},
  {key:"api",       nav:"api"        as ActiveNav, icon:Link2,           color:T.warning,  label:"接口自动化"},
  {key:"webui",     nav:"webui"      as ActiveNav, icon:Monitor,         color:T.cyan,     label:"Web UI 自动化"},
  {key:"app",       nav:"app"        as ActiveNav, icon:Smartphone,      color:T.purple,   label:"APP 自动化"},
  {key:"tasks",     nav:"tasks"      as ActiveNav, icon:Timer,           color:"#F59E0B",  label:"任务中心"},
  {key:"reports",   nav:"reports"    as ActiveNav, icon:ClipboardList,   color:"#7816FF",  label:"报告中心"},
  {key:"settings",  nav:"settings"      as ActiveNav, icon:Shield,          color:T.slate,    label:"系统设置"},
  {key:"platform-admin", nav:"platform-admin" as ActiveNav, icon:ShieldAlert, color:"#DB2777", label:"平台管理"},
] as const;

function PrimaryNav({active,onChange,onLogout,isDark}:{active:ActiveNav;onChange:(k:ActiveNav)=>void;onLogout?:()=>void;isDark:boolean}){
  const navBg   = isDark ? DK.surface  : "#fff";
  const divClr  = isDark ? DK.border   : T.border;
  return(
    <div className="flex-shrink-0 flex flex-col items-center py-3 gap-1 select-none"
      style={{width:56,background:navBg,borderRight:`1px solid ${divClr}`,transition:"background 0.25s"}}>

      {/* System logo */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-1 flex-shrink-0"
        style={{background:"linear-gradient(135deg,#165DFF 0%,#4F8EFF 100%)",
          boxShadow:"0 2px 10px rgba(22,93,255,0.4)"}}>
        <div style={{width:22,height:22}}><SystemLogo/></div>
      </div>

      {/* Module icon buttons */}
      {PRIMARY_MODULES.map(({key,nav,icon:Icon,color,label},i)=>{
        const isActive=active===key||active.startsWith(key+"-");
        return(
          <div key={key} className="w-full flex flex-col items-center">
            {i===8&&<div className="w-8 h-px mb-1" style={{backgroundColor:divClr}}/>}
            <button
              title={label}
              onClick={()=>onChange(nav)}
              className="group relative w-10 h-10 flex items-center justify-center rounded-xl transition-all"
              style={{backgroundColor:isActive?color:"transparent"}}
              onMouseEnter={e=>{if(!isActive)e.currentTarget.style.backgroundColor=isDark?`${color}28`:`${color}18`;}}
              onMouseLeave={e=>{if(!isActive)e.currentTarget.style.backgroundColor="transparent";}}>
              <Icon size={18} color={isActive?"#fff":color}/>
              <span className="absolute left-[52px] whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[12px] text-white font-medium
                opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                style={{backgroundColor:"#1D2129",boxShadow:"0 4px 12px rgba(0,0,0,0.18)"}}>
                {label}
              </span>
            </button>
          </div>
        );
      })}

      <div className="flex-1"/>

      <button title="张程远 · 点击退出登录" onClick={onLogout}
        className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
        style={{backgroundColor:T.primary}}>张</button>
    </div>
  );
}

const HELP_ITEMS = [
  { icon:BookOpen,      label:"使用文档",   desc:"平台功能说明与操作指南" },
  { icon:Keyboard,      label:"快捷键参考", desc:"全部键盘快捷键一览" },
  { icon:MessageSquare, label:"提交反馈",   desc:"报告问题或提出改进建议" },
];

function TopBarIconBtn({ children, badge, isActive, isDark, barBg, txtPri, txtMut, onClick }:{
  children:React.ReactNode; badge?:number; isActive?:boolean;
  isDark:boolean; barBg:string; txtPri:string; txtMut:string; onClick?:()=>void;
}) {
  return (
    <button onClick={onClick} style={{
      position:"relative", width:32, height:32, borderRadius:8, display:"flex",
      alignItems:"center", justifyContent:"center", cursor:"pointer",
      background: isActive ? (isDark?"rgba(255,255,255,0.1)":"#F0F3F8") : "transparent",
      border:"none", color: isActive ? txtPri : txtMut, transition:"all 0.15s",
    }}
    onMouseEnter={e=>{ e.currentTarget.style.background=isDark?"rgba(255,255,255,0.08)":T.bg; e.currentTarget.style.color=txtPri; }}
    onMouseLeave={e=>{ e.currentTarget.style.background=isActive?(isDark?"rgba(255,255,255,0.1)":"#F0F3F8"):"transparent"; e.currentTarget.style.color=isActive?txtPri:txtMut; }}>
      {children}
      {badge!=null && badge>0 && (
        <span style={{
          position:"absolute", top:4, right:4, minWidth:14, height:14, borderRadius:7,
          background:T.danger, color:"#fff", fontSize:9, fontWeight:800,
          display:"flex", alignItems:"center", justifyContent:"center", padding:"0 3px",
          border:`2px solid ${barBg}`,
        }}>{badge>9?"9+":badge}</span>
      )}
    </button>
  );
}

function TopBar({active,onNavigate,onLogout,isDark,onToggleDark}:{
  active:ActiveNav;onNavigate:(k:ActiveNav)=>void;onLogout:()=>void;isDark:boolean;onToggleDark:()=>void;
}){
  const mod=PRIMARY_MODULES.find(m=>active.startsWith(m.key));
  const subLabel=NAV_DEFS.reduce<string|null>((acc,d)=>{
    if(acc)return acc;
    if(isGroup(d)){const c=d.children.find(ch=>ch.key===active);return c?c.label:null;}
    return null;
  },null);

  const [menuOpen,  setMenuOpen]  = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen,  setHelpOpen]  = useState(false);
  const [notifs,    setNotifs]    = useState(NOTIFS);

  const menuRef  = React.useRef<HTMLDivElement>(null);
  const notifRef = React.useRef<HTMLDivElement>(null);
  const helpRef  = React.useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const handler=(e:MouseEvent)=>{
      if(menuRef.current  && !menuRef.current.contains(e.target as Node))  setMenuOpen(false);
      if(notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if(helpRef.current  && !helpRef.current.contains(e.target as Node))  setHelpOpen(false);
    };
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[]);

  const unread = notifs.filter(n=>!n.read).length;

  // Theme-aware colors
  const barBg    = isDark ? DK.surface  : "#fff";
  const barBord  = isDark ? DK.border   : T.border;
  const txtPri   = isDark ? DK.t1       : T.t1;
  const txtSec   = isDark ? DK.t2       : T.t2;
  const txtMut   = isDark ? DK.t3       : T.t3;
  const popBg    = isDark ? DK.surface2 : "#fff";
  const popShadow= isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.13)";
  const hoverBg  = isDark ? "rgba(255,255,255,0.06)" : T.bg;

  const menuItems:[React.ElementType,string,()=>void][]=[
    [User,"个人资料",()=>{onNavigate("profile");setMenuOpen(false);}],
    [KeyRound,"修改密码",()=>{onNavigate("profile");setMenuOpen(false);}],
    [SlidersHorizontal,"操作偏好",()=>{onNavigate("profile");setMenuOpen(false);}],
  ];

  return(
    <div className="h-12 flex-shrink-0 flex items-center justify-between px-5"
      style={{background:barBg,borderBottom:`1px solid ${barBord}`,transition:"background 0.25s, border-color 0.25s"}}>

      {/* Left: breadcrumb */}
      <div className="flex items-center gap-1.5 text-[13px]">
        <span className="font-medium" style={{color:subLabel?txtSec:txtPri}}>{mod?.label}</span>
        {subLabel&&(<>
          <ChevronRight size={13} style={{color:isDark?DK.t4:T.t4}}/>
          <span className="font-medium" style={{color:txtPri}}>{subLabel}</span>
        </>)}
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-1">

        {/* Theme toggle */}
        <TopBarIconBtn isDark={isDark} barBg={barBg} txtPri={txtPri} txtMut={txtMut} onClick={onToggleDark}>
          {isDark ? <Sun size={15}/> : <Moon size={15}/>}
        </TopBarIconBtn>

        {/* Help */}
        <div className="relative" ref={helpRef}>
          <TopBarIconBtn isActive={helpOpen} isDark={isDark} barBg={barBg} txtPri={txtPri} txtMut={txtMut} onClick={()=>{setHelpOpen(o=>!o);setNotifOpen(false);setMenuOpen(false);}}>
            <HelpCircle size={15}/>
          </TopBarIconBtn>
          {helpOpen&&(
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 rounded-xl overflow-hidden"
              style={{width:240,background:popBg,boxShadow:popShadow,border:`1px solid ${barBord}`}}>
              <div style={{padding:"12px 16px 10px",borderBottom:`1px solid ${barBord}`}}>
                <div style={{fontSize:12,fontWeight:700,color:txtPri}}>帮助中心</div>
              </div>
              <div style={{padding:"6px 0"}}>
                {HELP_ITEMS.map(({icon:HIcon,label,desc})=>(
                  <button key={label} style={{
                    width:"100%",display:"flex",alignItems:"center",gap:12,
                    padding:"10px 16px",border:"none",background:"transparent",
                    cursor:"pointer",textAlign:"left",
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background=hoverBg}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{width:32,height:32,borderRadius:8,background:isDark?"rgba(22,93,255,0.18)":"#EBF0FF",
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <HIcon size={14} style={{color:T.primary}}/>
                    </div>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:txtPri}}>{label}</div>
                      <div style={{fontSize:11,color:txtMut,marginTop:1}}>{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div style={{padding:"10px 16px",borderTop:`1px solid ${barBord}`}}>
                <div style={{fontSize:11,color:txtMut,textAlign:"center"}}>X-MAN 测试平台 v2.4.1</div>
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <TopBarIconBtn badge={unread} isActive={notifOpen} isDark={isDark} barBg={barBg} txtPri={txtPri} txtMut={txtMut} onClick={()=>{setNotifOpen(o=>!o);setHelpOpen(false);setMenuOpen(false);}}>
            <Bell size={15}/>
          </TopBarIconBtn>
          {notifOpen&&(
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 rounded-xl overflow-hidden"
              style={{width:320,background:popBg,boxShadow:popShadow,border:`1px solid ${barBord}`}}>
              {/* Header */}
              <div style={{padding:"12px 16px 10px",borderBottom:`1px solid ${barBord}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:13,fontWeight:700,color:txtPri}}>通知</span>
                  {unread>0&&<span style={{fontSize:10,padding:"1px 7px",borderRadius:10,background:T.danger,color:"#fff",fontWeight:700}}>{unread} 条未读</span>}
                </div>
                {unread>0&&(
                  <button onClick={()=>setNotifs(n=>n.map(x=>({...x,read:true})))}
                    style={{fontSize:11,color:T.primary,background:"none",border:"none",cursor:"pointer",padding:0}}>
                    全部已读
                  </button>
                )}
              </div>
              {/* List */}
              <div style={{maxHeight:320,overflowY:"auto"}}>
                {notifs.map((n,i)=>(
                  <div key={n.id} style={{
                    display:"flex",alignItems:"flex-start",gap:10,padding:"12px 16px",
                    borderBottom:i<notifs.length-1?`1px solid ${barBord}`:"none",
                    background:n.read?"transparent":(isDark?"rgba(22,93,255,0.06)":"#FAFBFF"),
                    cursor:"pointer",transition:"background 0.1s",
                  }}
                  onMouseEnter={e=>e.currentTarget.style.background=hoverBg}
                  onMouseLeave={e=>e.currentTarget.style.background=n.read?"transparent":(isDark?"rgba(22,93,255,0.06)":"#FAFBFF")}
                  onClick={()=>setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,read:true}:x))}>
                    <div style={{
                      width:34,height:34,borderRadius:10,flexShrink:0,marginTop:1,
                      background:`${n.color}18`,display:"flex",alignItems:"center",justifyContent:"center",
                    }}>
                      <Bell size={14} style={{color:n.color}}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:4}}>
                        <span style={{fontSize:12,fontWeight:n.read?500:700,color:txtPri,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</span>
                        <span style={{fontSize:10,color:txtMut,flexShrink:0}}>{n.time}</span>
                      </div>
                      <div style={{fontSize:11,color:txtSec,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.desc}</div>
                    </div>
                    {!n.read&&<div style={{width:6,height:6,borderRadius:"50%",background:T.primary,flexShrink:0,marginTop:6}}/>}
                  </div>
                ))}
              </div>
              {/* Footer */}
              <div style={{padding:"10px 16px",borderTop:`1px solid ${barBord}`,textAlign:"center"}}>
                <button onClick={()=>{onNavigate("settings");setNotifOpen(false);}} style={{fontSize:12,color:T.primary,background:"none",border:"none",cursor:"pointer"}}>
                  查看全部通知 →
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{width:1,height:20,background:barBord,margin:"0 4px"}}/>

        {/* User dropdown */}
        <div className="relative" ref={menuRef}>
          <button onClick={()=>{setMenuOpen(o=>!o);setNotifOpen(false);setHelpOpen(false);}}
            className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors"
            style={{background:menuOpen?(isDark?"rgba(255,255,255,0.1)":`${T.primary}0D`):"transparent",border:"none",cursor:"pointer"}}
            onMouseEnter={e=>{if(!menuOpen)e.currentTarget.style.background=isDark?"rgba(255,255,255,0.06)":`${T.primary}08`;}}
            onMouseLeave={e=>{if(!menuOpen)e.currentTarget.style.background="transparent";}}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
              style={{backgroundColor:T.primary}}>张</div>
            <span className="text-[13px] font-medium" style={{color:txtPri}}>张程远</span>
            <ChevronDown size={12} style={{color:txtMut,transform:menuOpen?"rotate(180deg)":"none",transition:"transform .15s"}}/>
          </button>
          {menuOpen&&(
            <div className="absolute right-0 top-[calc(100%+6px)] z-50 rounded-xl overflow-hidden"
              style={{width:200,background:popBg,boxShadow:popShadow,border:`1px solid ${barBord}`}}>
              <div className="px-4 py-3" style={{borderBottom:`1px solid ${barBord}`,background:isDark?"rgba(22,93,255,0.1)":`${T.primary}06`}}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-bold text-white flex-shrink-0"
                    style={{backgroundColor:T.primary}}>张</div>
                  <div>
                    <div className="text-[13px] font-semibold" style={{color:txtPri}}>张程远</div>
                    <div className="text-[11px]" style={{color:txtMut}}>超级管理员</div>
                  </div>
                </div>
              </div>
              <div className="py-1">
                {menuItems.map(([Ic,lbl,action])=>(
                  <button key={lbl} onClick={action}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors text-left"
                    style={{color:txtSec,background:"transparent",border:"none",cursor:"pointer"}}
                    onMouseEnter={e=>{e.currentTarget.style.background=hoverBg;e.currentTarget.style.color=txtPri;}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color=txtSec;}}>
                    <Ic size={14}/>{lbl}
                  </button>
                ))}
              </div>
              <div style={{borderTop:`1px solid ${barBord}`}} className="py-1">
                <button onClick={()=>{setMenuOpen(false);onLogout();}}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors text-left"
                  style={{color:T.danger,background:"transparent",border:"none",cursor:"pointer"}}
                  onMouseEnter={e=>{e.currentTarget.style.background=`${T.danger}0A`;}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                  <LogOut size={14}/>退出登录
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Placeholder({nav}:{nav:ActiveNav}){
  const icons:Partial<Record<ActiveNav,React.ElementType>>={overview:LayoutDashboard,bugs:Bug,webui:Monitor,app:Smartphone,settings:Shield};
  const labels:Partial<Record<ActiveNav,string>>={overview:"工作台",bugs:"缺陷管理",webui:"Web UI 自动化",app:"APP 自动化",settings:"系统设置"};
  const Icon=icons[nav]??Settings;const label=labels[nav]??"页面";
  return(<div className="flex-1 flex items-center justify-center"><div className="text-center"><div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{backgroundColor:"#F2F3F5"}}><Icon size={30} style={{color:T.t4}}/></div><p className="text-[15px] font-medium" style={{color:T.t2}}>{label}</p><p className="text-[13px] mt-1" style={{color:T.t3}}>该模块正在开发中，敬请期待</p></div></div>);
}

// ─── App Root ─────────────────────────────────────────────────────────────────

// ─── System logo (fixed) ─────────────────────────────────────────────────────
const SystemLogo = () => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="5.5" r="3" fill="white"/>
    <circle cx="7" cy="23" r="3" fill="white"/>
    <circle cx="25" cy="23" r="3" fill="white"/>
    <line x1="14.1" y1="8.1" x2="9" y2="20.3" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="17.9" y1="8.1" x2="23" y2="20.3" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <line x1="10" y1="23" x2="22" y2="23" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

export default function App() {
  const[loggedIn,setLoggedIn]=useState(false);
  const[active,setActive]=useState<ActiveNav>("cases-list");
  const[isDark,setIsDark]=useState(false);
  const module=active.split("-")[0];

  if(!loggedIn) return <LoginPage onLogin={()=>setLoggedIn(true)}/>;

  return(
    <div className="h-screen flex overflow-hidden" style={{
      fontFamily:"'Inter','PingFang SC','Microsoft YaHei',sans-serif",fontSize:14,
      backgroundColor:isDark?DK.bg:T.bg,transition:"background-color 0.25s",
    }}>
      <PrimaryNav active={active} onChange={setActive} onLogout={()=>setLoggedIn(false)} isDark={isDark}/>

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar active={active} onNavigate={setActive} onLogout={()=>setLoggedIn(false)} isDark={isDark} onToggleDark={()=>setIsDark(d=>!d)}/>

        {/* Module content — each module owns its own sub-tab bar */}
        {module==="config"&&<ConfigModule nav={active} onNavigate={setActive}/>}
        {module==="cases"&&<CasesModule  nav={active} onNavigate={setActive}/>}
        {active==="api"&&<ApiModule/>}
        {active==="testmgmt"&&<TestManagementModule/>}
        {active==="bugs"&&<BugsModule/>}
        {active==="webui"&&<WebUIPhase2Showcase/>}
        {active==="tasks"&&<TaskModule/>}
        {active==="reports"&&<ReportModule/>}
        {active==="settings"&&<SettingsModule/>}
        {active==="overview"&&<OverviewModule onNavigate={setActive as (k:string)=>void}/>}
        {active==="platform-admin"&&<PlatformAdminModule/>}
        {active==="app"&&<Placeholder nav={active}/>}
        {active==="profile"&&<ProfileModule onBack={()=>setActive("overview")}/>}
      </div>
    </div>
  );
}
