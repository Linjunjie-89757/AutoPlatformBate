import { useState, useEffect } from "react";
import { TaskModule } from "./TaskModule";
import { SettingsModule } from "./SettingsModule";
import { WebUIModule, ReportRecord, ReportListPage, ReportDetailPage, ShareReportPage } from "./WebUIModule";
import { LoginPage } from "./LoginPage";
import { AiPoolModule } from "./AiPoolModule";
import { NotifModule } from "./NotifModule";
import { RunnerModule } from "./RunnerModule";
import { OverviewModule } from "./OverviewModule";
import {
  Database, Globe, Hash, Bell, Server, Bot, Search, Plus, Edit2, Trash2,
  Eye, TestTube, Lock, Check, Clock,
  CheckCircle, XCircle, FlaskConical, LogOut, ChevronDown, FileText, Zap,
  Monitor, Bug, Shield, Link2, LayoutDashboard, Settings, LayoutGrid,
  ChevronRight, Activity, ArrowUpRight, Folder, FolderOpen,
  Play, Save, Upload, X, GripVertical, Sparkles, RefreshCw,
  Code2, Smartphone, ChevronLeft, Layers, ThumbsUp, ThumbsDown, Power, Send, AlertTriangle,
  MousePointer, Type, Timer, Camera, Variable, Globe2, Copy, ArrowUp, ArrowDown,
  ClipboardList, Share2, Download, ExternalLink, Minus, Filter,
  Video, Pause, Square, SkipForward, RotateCcw, PlusCircle,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

// ─── Palette ──────────────────────────────────────────────────────────────────

const T = {
  primary:"#165DFF", success:"#00B42A", warning:"#FF7D00",
  danger:"#F53F3F",  purple:"#7816FF",  cyan:"#0FC6C2",
  slate:"#4E5969",   bg:"#F4F6FA",      border:"#E5E6EB",
  t1:"#1D2129", t2:"#4E5969", t3:"#86909C", t4:"#C9CDD4",
};

// ─── Types ────────────────────────────────────────────────────────────────────

// Flat nav key — module prefix determines content
type ActiveNav =
  | "overview"
  | "config" | "config-db" | "config-env" | "config-param" | "config-notif" | "config-runner" | "config-ai"
  | "cases-list" | "cases-ai-gen" | "cases-records" | "cases-ai-cfg"
  | "bugs" | "api" | "webui" | "app" | "tasks" | "reports" | "settings";

type ModalType  = "db"|"ai"|"notif"|"env"|"param"|"runner"|"case"|null;
type NotifSub   = "channels"|"rules"|"history";
type ApiPage    = "workbench"|"scenarios"|"suites"|"reports";
type HttpMethod = "GET"|"POST"|"PUT"|"DELETE"|"PATCH";
type Priority   = "P0"|"P1"|"P2"|"P3"|"P4";
type CaseStatus = "confirmed"|"pending"|"discarded";
type ExecStatus = "passed"|"failed"|"blocked"|"not-run";
type AiTaskStatus = "completed"|"reviewing"|"generating"|"failed";
type AdoptStatus  = "adopted"|"discarded"|"pending";

interface TestCase { id:string; title:string; directory:string; type:string; priority:Priority; status:CaseStatus; execStatus:ExecStatus; defects:number; creator:string; updatedAt:string; source:"manual"|"ai"; steps:string[]; expected:string; precondition:string; }
interface AiTask { id:string; requirement:string; directory:string; project:string; status:AiTaskStatus; generated:number; reviewed:number; adopted:number; model:string; reviewModel:string; createdAt:string; operator:string; }
interface AiGenCase { id:string; title:string; priority:Priority; type:string; angle:string; reason:string; requirementBasis:string; risk:string; reviewStatus:"approved"|"rejected"|"pending"; reviewReason:string; suggestion:string; adoptStatus:AdoptStatus; steps:string[]; expected:string; }
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
  {id:"Case-00-04",title:"正常提交问题描述且内容超过一定限制后提交按钮灰化",directory:"功能测试/订单中心",type:"功能",priority:"P1",status:"confirmed",execStatus:"not-run",defects:0,creator:"张程远",updatedAt:"2026-01-15 17:21",source:"manual",steps:["进入订单提交页","输入超过1000字的描述","点击提交按钮"],expected:"提交按钮变为灰色不可点击状态",precondition:"已登录系统，已有订单草稿"},
  {id:"Case-01-40",title:"订单中心-下单流程-正常用户完整下单",directory:"功能测试/订单中心",type:"功能",priority:"P0",status:"confirmed",execStatus:"passed",defects:0,creator:"李明",updatedAt:"2026-01-14 10:30",source:"manual",steps:["用户登录","选择商品","填写收货信息","完成支付"],expected:"订单状态变为已付款，库存减少",precondition:"测试账号余额充足，商品库存大于0"},
  {id:"Case-02-13",title:"空白列表页面的空态展示是否正确",directory:"功能测试/用户中心",type:"功能",priority:"P2",status:"confirmed",execStatus:"not-run",defects:0,creator:"王芳",updatedAt:"2026-01-13 14:50",source:"ai",steps:["登录系统","清空用户列表","访问用户列表页"],expected:"展示空态图和提示文字",precondition:"管理员账号"},
  {id:"Case-03-25",title:"获客中心-产品新增-必填字段校验",directory:"功能测试/获客中心",type:"功能",priority:"P1",status:"confirmed",execStatus:"failed",defects:2,creator:"张程远",updatedAt:"2026-01-12 09:15",source:"manual",steps:["打开新增产品表单","不填任何字段","点击保存"],expected:"各必填字段显示红色错误提示",precondition:"测试环境正常"},
  {id:"Case-04-07",title:"系统并发用户数达到上限时的处理",directory:"功能测试/风控中心",type:"性能",priority:"P0",status:"pending",execStatus:"not-run",defects:0,creator:"陈伟",updatedAt:"2026-01-11 16:40",source:"ai",steps:["模拟1000并发用户","同时访问系统","观察系统响应"],expected:"超出上限时返回503，已有用户不受影响",precondition:"性能测试环境就绪"},
  {id:"Case-05-31",title:"风控规则-黑名单命中-实时拦截",directory:"功能测试/风控中心",type:"功能",priority:"P1",status:"confirmed",execStatus:"passed",defects:0,creator:"李明",updatedAt:"2026-01-10 11:20",source:"manual",steps:["将用户加入黑名单","该用户尝试下单","检查拦截结果"],expected:"下单请求被实时拦截，返回拦截提示",precondition:"黑名单功能已开启"},
  {id:"Case-06-18",title:"订单退款流程-超时申请不允许退款",directory:"功能测试/订单中心",type:"功能",priority:"P1",status:"confirmed",execStatus:"not-run",defects:0,creator:"王芳",updatedAt:"2026-01-09 15:30",source:"manual",steps:["选择超出退款时间的订单","点击申请退款"],expected:"系统提示退款申请已过期，操作不可进行",precondition:"有一笔超出退款期限的已完成订单"},
  {id:"Case-07-44",title:"用户登录-错误密码超次数锁定",directory:"功能测试/用户中心",type:"安全",priority:"P0",status:"confirmed",execStatus:"passed",defects:0,creator:"陈伟",updatedAt:"2026-01-08 13:10",source:"manual",steps:["连续输入错误密码5次","第6次尝试登录"],expected:"账号被锁定15分钟，显示锁定提示",precondition:"测试账号正常状态"},
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
  {id:"G001",title:"正常用户完整下单流程-标准支付路径",priority:"P0",type:"功能",angle:"主流程",reason:"需求文档第3节描述了完整的下单支付主流程，此为核心业务路径，必须覆盖。",requirementBasis:"PRD §3.1 用户下单流程",risk:"未覆盖会导致核心业务流程无测试保障",reviewStatus:"approved",reviewReason:"该用例覆盖了需求中的完整主流程，步骤清晰，预期结果明确，采纳价值高。",suggestion:"可补充不同支付方式（微信、支付宝、银行卡）的子场景。",adoptStatus:"pending",steps:["用户登录系统","选择商品并加入购物车","确认订单信息","选择支付方式完成支付","确认订单状态变为已付款"],expected:"订单创建成功，库存减少，用户收到下单成功通知"},
  {id:"G002",title:"商品库存不足时下单提示",priority:"P1",type:"异常",angle:"边界条件",reason:"库存为0时继续下单是典型的边界场景，需要验证系统的库存扣减和并发控制。",requirementBasis:"PRD §3.2 库存管理规则",risk:"如不测试可能导致超卖问题",reviewStatus:"approved",reviewReason:"边界值场景覆盖充分，风险分析准确，建议采纳。",suggestion:"建议补充并发抢购时库存竞争条件的用例。",adoptStatus:"pending",steps:["选择库存为0的商品","尝试加入购物车","点击立即购买"],expected:"系统提示商品已售罄，无法加入购物车"},
  {id:"G003",title:"超大金额订单的支付限额拦截",priority:"P1",type:"安全",angle:"安全边界",reason:"支付金额超出单笔限额时需要触发风控拦截，这是重要的安全测试点。",requirementBasis:"PRD §5.1 支付风控规则",risk:"未测试可能导致超额支付漏洞",reviewStatus:"rejected",reviewReason:"该用例的步骤描述不够具体，缺少明确的金额阈值，且与实际系统的风控规则可能不符，建议修改后重新提交。",suggestion:"需要明确单笔支付限额的具体数值，并确认风控规则的触发条件。",adoptStatus:"discarded",steps:["构造金额超过10万的订单","尝试提交订单并支付"],expected:"系统触发风控，提示超出支付限额"},
  {id:"G004",title:"订单取消后库存自动回滚",priority:"P1",type:"功能",angle:"数据一致性",reason:"用户取消订单后系统必须自动归还库存，确保数据一致性，是核心业务规则。",requirementBasis:"PRD §3.4 订单取消规则",risk:"库存不回滚会导致数据不一致",reviewStatus:"pending",reviewReason:"",suggestion:"",adoptStatus:"pending",steps:["用户提交订单后记录库存数量","用户申请取消订单","系统确认取消","检查库存数量"],expected:"库存自动回滚到取消前的数量，差值精确"},
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
      {key:"config-param",   label:"参数配置"},
      {key:"config-notif",   label:"通知配置"},
      {key:"config-runner",  label:"Runner 配置"},
      {key:"config-ai",      label:"AI 连接配置"},
    ]},
  { key:"cases",    label:"用例中心",      icon:FileText,        color:T.success,
    children:[
      {key:"cases-list",    label:"用例管理"},
      {key:"cases-ai-gen",  label:"AI 用例生成"},
      {key:"cases-records", label:"AI 生成记录"},
      {key:"cases-ai-cfg",  label:"AI 配置"},
    ]},
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

// ─── Case Directory Tree ─────────────────────────────────────────────────────

function CaseTree({selectedDir,onSelect}:{selectedDir:string;onSelect:(d:string)=>void}){
  const [expanded,setExpanded]=useState<Record<string,boolean>>({"f1":true,"f1-1":true});
  const tree=[{id:"root",label:"X-MAN",count:235,children:[
    {id:"f1",label:"功能测试",count:178,children:[
      {id:"f1-1",label:"用户中心",count:34,children:[]},
      {id:"f1-2",label:"订单中心",count:67,children:[]},
      {id:"f1-3",label:"获客中心",count:45,children:[]},
      {id:"f1-4",label:"风控中心",count:32,children:[]},
    ]},
    {id:"f2",label:"接口测试",count:41,children:[]},
    {id:"f3",label:"性能测试",count:12,children:[]},
    {id:"f4",label:"安全测试",count:4,children:[]},
  ]}];

  const renderNode=(node:any,depth=0)=>(
    <div key={node.id}>
      <button onClick={()=>{onSelect(node.id);if(node.children?.length)setExpanded(e=>({...e,[node.id]:!e[node.id]}));}}
        className="w-full flex items-center gap-1.5 py-1.5 rounded-md transition-colors text-left"
        style={{paddingLeft:12+depth*16,backgroundColor:selectedDir===node.id?`${T.success}12`:""}}
        onMouseEnter={e=>selectedDir!==node.id&&(e.currentTarget.style.backgroundColor="#F4F6FA")}
        onMouseLeave={e=>selectedDir!==node.id&&(e.currentTarget.style.backgroundColor="")}>
        {node.children?.length>0
          ? expanded[node.id]
            ? <ChevronDown size={12} style={{color:T.t3,flexShrink:0}}/>
            : <ChevronRight size={12} style={{color:T.t3,flexShrink:0}}/>
          : <span className="w-3 flex-shrink-0"/>}
        {node.children?.length>0
          ? expanded[node.id] ? <FolderOpen size={13} style={{color:T.warning,flexShrink:0}}/> : <Folder size={13} style={{color:T.warning,flexShrink:0}}/>
          : <Folder size={13} style={{color:T.t4,flexShrink:0}}/>}
        <span className="flex-1 text-[12px] truncate" style={{color:selectedDir===node.id?T.success:T.t1,fontWeight:selectedDir===node.id?500:400}}>{node.label}</span>
        <span className="text-[11px] mr-2" style={{color:T.t4}}>{node.count}</span>
      </button>
      {node.children?.length>0&&expanded[node.id]&&node.children.map((c:any)=>renderNode(c,depth+1))}
    </div>
  );

  return(
    <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:240,backgroundColor:"#fff",borderRight:`1px solid ${T.border}`}}>
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <PBtn icon={Plus} onClick={()=>{}} small>新增目录</PBtn>
      </div>
      <div className="px-3 pb-2 flex-shrink-0"><Inp placeholder="搜索目录" prefix={<Search size={12}/>} width="100%"/></div>
      <div className="px-2 pb-2 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
        <div className="flex items-center justify-between px-1 py-1">
          <span className="text-[11px] font-medium" style={{color:T.t3}}>目录树</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {tree.map(n=>renderNode(n))}
      </div>
    </div>
  );
}

// ─── Case List Page ───────────────────────────────────────────────────────────

function CaseListPage({onViewCase}:{onViewCase:(c:TestCase)=>void}){
  const[selectedDir,setSelectedDir]=useState("root");
  const[selected,setSelected]=useState<string[]>([]);
  const[cases]=useState<TestCase[]>(CASES);
  const toggleSelect=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const allSelected=selected.length===cases.length;

  return(
    <div className="flex flex-1 overflow-hidden">
      <CaseTree selectedDir={selectedDir} onSelect={setSelectedDir}/>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-center gap-2 mb-4">
            <Inp placeholder="搜索用例标题或 ID" prefix={<Search size={13}/>} width={220}/>
            <Sel width={100}><option>全部优先级</option><option>P0</option><option>P1</option><option>P2</option></Sel>
            <Sel width={110}><option>全部状态</option><option>已确认</option><option>待确认</option><option>已废弃</option></Sel>
            <Sel width={110}><option>全部执行状态</option><option>通过</option><option>失败</option><option>未执行</option></Sel>
            <Sel width={100}><option>全部来源</option><option>人工</option><option>AI生成</option></Sel>
            <div className="flex-1"/>
            {selected.length>0&&(
              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-[12px]" style={{color:T.t3}}>已选 {selected.length} 条</span>
                <PBtn variant="ghost" icon={Layers} onClick={()=>{}}>批量移动</PBtn>
                <PBtn variant="ghost" icon={Trash2} onClick={()=>{}} color={T.danger}>批量删除</PBtn>
              </div>
            )}
            <PBtn icon={Upload} onClick={()=>{}} variant="ghost">导入</PBtn>
            <PBtn icon={Plus} onClick={()=>{}}>新增用例</PBtn>
          </div>

          <ETable total={cases.length} cols={[
            {label:"",width:"3.5%"},{label:"用例 ID",width:"10%"},{label:"用例标题",width:"28%"},
            {label:"所属目录",width:"13%"},{label:"优先级",width:"6%"},{label:"状态",width:"8%"},
            {label:"执行状态",width:"8%"},{label:"来源",width:"6%"},{label:"关联缺陷",width:"6%"},
            {label:"操作",width:"11.5%",align:"right"},
          ]}>
            {cases.map(c=>{
              const cs=CASE_STATUS_STYLE[c.status];const es=EXEC_STATUS_STYLE[c.execStatus];
              const ps=PRIORITY_STYLE[c.priority];
              return(
                <TR key={c.id} active={selected.includes(c.id)}>
                  <TD><input type="checkbox" checked={selected.includes(c.id)} onChange={()=>toggleSelect(c.id)} onClick={e=>e.stopPropagation()} className="w-3.5 h-3.5" style={{accentColor:T.primary}}/></TD>
                  <TD><button onClick={()=>onViewCase(c)} className="font-mono text-[12px] hover:underline" style={{color:T.primary}}>{c.id}</button></TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium truncate max-w-[200px]" style={{color:T.t1}}>{c.title}</span>
                      {c.source==="ai"&&<span className="px-1.5 py-px rounded text-[9px] font-bold flex-shrink-0" style={{backgroundColor:"#F5E8FF",color:T.purple}}>AI</span>}
                    </div>
                  </TD>
                  <TD muted><span className="truncate block max-w-[120px]">{c.directory}</span></TD>
                  <TD><span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:ps.bg,color:ps.color}}>{c.priority}</span></TD>
                  <TD><span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{backgroundColor:cs.bg,color:cs.color}}>{cs.label}</span></TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 text-[12px]">
                      <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:es.dot}}/>
                      <span style={{color:es.color}}>{es.label}</span>
                    </span>
                  </TD>
                  <TD><span className="text-[11px] px-1.5 py-0.5 rounded" style={{backgroundColor:c.source==="ai"?"#F5E8FF":"#F2F3F5",color:c.source==="ai"?T.purple:T.t3}}>{c.source==="ai"?"AI生成":"人工"}</span></TD>
                  <TD align="center"><span style={{color:c.defects>0?T.danger:T.t4,fontWeight:c.defects>0?600:400}}>{c.defects||"—"}</span></TD>
                  <TD align="right">
                    <div className="flex items-center justify-end">
                      <IBtn icon={Eye} label="查看详情" onClick={()=>onViewCase(c)}/>
                      <IBtn icon={Edit2} label="编辑" onClick={()=>{}}/>
                      <IBtn icon={Play} label="执行" onClick={()=>{}}/>
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

// ─── Case Detail Drawer ───────────────────────────────────────────────────────

function CaseDrawer({case_:c,onClose}:{case_:TestCase|null;onClose:()=>void}){
  const[drawerTab,setDrawerTab]=useState("details");
  if(!c)return null;
  const cs=CASE_STATUS_STYLE[c.status];const ps=PRIORITY_STYLE[c.priority];const es=EXEC_STATUS_STYLE[c.execStatus];
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
              <span className="inline-flex items-center gap-1 text-[12px]"><span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:es.dot}}/><span style={{color:es.color}}>{es.label}</span></span>
            </div>
            <h2 className="text-[15px] font-semibold leading-snug" style={{color:T.t1}}>{c.title}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <PBtn icon={Edit2} onClick={()=>{}} variant="ghost">编辑</PBtn>
            <PBtn icon={Play} onClick={()=>{}}>执行用例</PBtn>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[18px]" style={{color:T.t4}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>×</button>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex flex-shrink-0 px-6" style={{borderBottom:`1px solid ${T.border}`}}>
          {["details","execHistory","defects"].map(tab=>{const labels={details:"用例详情",execHistory:"执行记录",defects:`关联缺陷（${c.defects}）`};return <button key={tab} onClick={()=>setDrawerTab(tab)} className="h-10 px-4 text-[13px] font-medium border-b-2 transition-colors" style={{borderBottomColor:drawerTab===tab?T.primary:"transparent",color:drawerTab===tab?T.primary:T.t3}}>{labels[tab as keyof typeof labels]}</button>;})}
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
          {drawerTab==="execHistory"&&(
            <div className="px-6 py-5">
              <p className="text-[13px]" style={{color:T.t3}}>暂无执行记录，点击「执行用例」开始第一次执行。</p>
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

function AiGenPage({onShowProgress}:{onShowProgress:()=>void}){
  const[desc,setDesc]=useState("");
  const[outputMode,setOutputMode]=useState<"stream"|"complete">("stream");

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
              <div className="relative">
                <input placeholder="请选择模块路径，选中后会自动拼接需求标题" className="w-full h-9 px-3 pr-9 border rounded-lg text-[13px] outline-none transition-all" style={{borderColor:T.border,color:T.t1}}/>
                <Folder size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{color:T.t4}}/>
              </div>
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

function AiRecordDetail({task,onBack}:{task:AiTask;onBack:()=>void}){
  const[cases,setCases]=useState<AiGenCase[]>(AI_GEN_CASES);
  const adopt=(id:string,status:AdoptStatus)=>setCases(cs=>cs.map(c=>c.id===id?{...c,adoptStatus:status}:c));
  const ts=AI_TASK_STATUS[task.status];

  return(
    <div className="flex-1 overflow-y-auto p-6">
      {/* Breadcrumb & header */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] transition-colors" style={{color:T.t3}} onMouseEnter={e=>e.currentTarget.style.color=T.primary} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
          <ChevronLeft size={14}/> AI 生成记录
        </button>
        <ChevronRight size={13} style={{color:T.t4}}/>
        <span className="text-[13px] font-medium" style={{color:T.t1}}>任务详情</span>
      </div>

      {/* Task info card */}
      <div className="bg-white rounded-xl p-5 mb-5" style={{border:`1px solid ${T.border}`}}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <code className="text-[11px] px-2 py-0.5 rounded font-mono" style={{backgroundColor:"#F2F3F5",color:T.t2}}>{task.id}</code>
              <span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{backgroundColor:ts.bg,color:ts.color}}>{ts.label}</span>
            </div>
            <h2 className="text-[16px] font-semibold" style={{color:T.t1}}>{task.requirement}</h2>
          </div>
          <div className="flex gap-2">
            <PBtn icon={RefreshCw} onClick={()=>{}} variant="ghost">重新生成</PBtn>
          </div>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-5 gap-4">
          {[
            {label:"生成总数",value:task.generated,color:T.t1},
            {label:"已评审",value:task.reviewed,color:T.primary},
            {label:"评审通过",value:Math.floor(task.reviewed*0.85),color:T.success},
            {label:"已采纳",value:task.adopted,color:T.success},
            {label:"已废弃",value:cases.filter(c=>c.adoptStatus==="discarded").length,color:T.t3},
          ].map(s=>(
            <div key={s.label} className="text-center px-3 py-2 rounded-lg" style={{backgroundColor:"#F7F8FA"}}>
              <p className="text-[22px] font-bold" style={{color:s.color}}>{s.value}</p>
              <p className="text-[11px] mt-0.5" style={{color:T.t3}}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Process timeline */}
      <div className="bg-white rounded-xl p-5 mb-5" style={{border:`1px solid ${T.border}`}}>
        <p className="text-[13px] font-semibold mb-4" style={{color:T.t1}}>生成时间线</p>
        <div className="flex items-center">
          {["任务创建","AI 生成","AI 评审","完成"].map((s,i,arr)=>(
            <div key={s} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{backgroundColor:T.success}}><Check size={13} color="#fff"/></div>
                <span className="text-[11px] mt-1.5" style={{color:T.success}}>{s}</span>
              </div>
              {i<arr.length-1&&<div className="flex-1 h-0.5 mx-2" style={{backgroundColor:T.success}}/>}
            </div>
          ))}
        </div>
      </div>

      {/* Generated cases */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[14px] font-semibold" style={{color:T.t1}}>生成结果 <span className="font-normal" style={{color:T.t3}}>({cases.length} 条)</span></h3>
        <div className="flex items-center gap-2">
          <Sel width={110}><option>全部状态</option><option>待处理</option><option>已采纳</option><option>已废弃</option></Sel>
          <button onClick={()=>setCases(cs=>cs.map(c=>({...c,adoptStatus:"adopted"})))} className="h-8 px-3 rounded-lg text-[13px] font-medium transition-colors" style={{backgroundColor:`${T.success}12`,color:T.success}}>全部采纳</button>
        </div>
      </div>

      {/* Case cards */}
      <div className="grid grid-cols-2 gap-4">
        {cases.map(c=>{
          const ps=PRIORITY_STYLE[c.priority];
          const reviewColor={approved:T.success,rejected:T.danger,pending:T.warning}[c.reviewStatus];
          const reviewBg={approved:"#E8FFEA",rejected:"#FFE8E8",pending:"#FFF3E8"}[c.reviewStatus];
          const reviewLabel={approved:"评审通过",rejected:"评审未通过",pending:"待评审"}[c.reviewStatus];
          return(
            <div key={c.id} className="bg-white rounded-xl overflow-hidden transition-all" style={{border:`1.5px solid ${c.adoptStatus==="adopted"?T.success:c.adoptStatus==="discarded"?"#F2F3F5":T.border}`,opacity:c.adoptStatus==="discarded"?0.55:1}}>
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3" style={{borderBottom:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{backgroundColor:`${T.primary}15`,color:T.primary}}>测试生成</span>
                  <code className="text-[11px] font-mono" style={{color:T.t3}}>gpt-4o</code>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium" style={{backgroundColor:reviewBg,color:reviewColor}}>{reviewLabel}</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:ps.bg,color:ps.color}}>{c.priority}</span>
                </div>
              </div>
              {/* Case content */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{backgroundColor:`${T.cyan}15`,color:T.cyan}}>{c.angle}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{backgroundColor:"#F2F3F5",color:T.t2}}>{c.type}</span>
                </div>
                <h4 className="text-[13px] font-semibold mb-3" style={{color:T.t1}}>{c.title}</h4>
                <div className="space-y-1.5 mb-3">
                  {c.steps.map((s,i)=><div key={i} className="flex items-start gap-2 text-[12px]" style={{color:T.t2}}><span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5" style={{backgroundColor:`${T.primary}15`,color:T.primary}}>{i+1}</span>{s}</div>)}
                </div>
                <div className="px-3 py-2 rounded-lg text-[12px]" style={{backgroundColor:"#F6FFED",color:T.t1}}>{c.expected}</div>
              </div>
              {/* Review section */}
              {c.reviewStatus!=="pending"&&(
                <div className="px-4 py-3" style={{borderTop:`1px solid ${T.border}`,backgroundColor:`${reviewColor}05`}}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{backgroundColor:`${T.purple}15`,color:T.purple}}>AI 评审</span>
                    <code className="text-[11px] font-mono" style={{color:T.t3}}>claude-3-5-sonnet</code>
                  </div>
                  <p className="text-[12px] mb-2 leading-relaxed" style={{color:T.t2}}>{c.reviewReason}</p>
                  {c.suggestion&&<p className="text-[11px] px-3 py-2 rounded-lg" style={{backgroundColor:"#FFF3E8",color:T.warning}}>💡 {c.suggestion}</p>}
                </div>
              )}
              {/* Actions */}
              <div className="flex items-center gap-2 px-4 py-3" style={{borderTop:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
                {c.adoptStatus==="pending"?(
                  <>
                    <button onClick={()=>adopt(c.id,"adopted")} className="flex-1 h-8 rounded-lg text-[12px] font-semibold text-white flex items-center justify-center gap-1.5 transition-colors" style={{backgroundColor:T.success}}><ThumbsUp size={12}/>采纳</button>
                    <button onClick={()=>adopt(c.id,"adopted")} className="h-8 px-3 rounded-lg border text-[12px] font-medium transition-colors" style={{borderColor:T.border,color:T.t2}}>编辑后采纳</button>
                    <button onClick={()=>adopt(c.id,"discarded")} className="h-8 px-3 rounded-lg text-[12px] font-medium transition-colors" style={{color:T.danger}}><ThumbsDown size={12}/></button>
                  </>
                ):c.adoptStatus==="adopted"?(
                  <div className="flex-1 flex items-center gap-2">
                    <CheckCircle size={14} style={{color:T.success}}/><span className="text-[12px] font-medium" style={{color:T.success}}>已采纳</span>
                    <button onClick={()=>adopt(c.id,"pending")} className="ml-auto text-[12px]" style={{color:T.t3}}>撤销</button>
                  </div>
                ):(
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-[12px]" style={{color:T.t3}}>已废弃</span>
                    <button onClick={()=>adopt(c.id,"pending")} className="ml-auto text-[12px]" style={{color:T.primary}}>恢复</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Cases Module container ───────────────────────────────────────────────────

const CASES_TABS=[
  {nav:"cases-list"    as ActiveNav, label:"用例管理"},
  {nav:"cases-ai-gen"  as ActiveNav, label:"AI 用例生成"},
  {nav:"cases-records" as ActiveNav, label:"AI 生成记录"},
  {nav:"cases-ai-cfg"  as ActiveNav, label:"AI 配置"},
];

function CasesModule({nav,onNavigate}:{nav:ActiveNav;onNavigate:(k:ActiveNav)=>void}){
  const[caseDrawer,setCaseDrawer]=useState<TestCase|null>(null);
  const[showProgress,setShowProgress]=useState(false);
  const[showResult,setShowResult]=useState(false);
  const[detailTask,setDetailTask]=useState<AiTask|null>(null);

  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Horizontal tab bar */}
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
      {nav==="cases-list"&&<CaseListPage onViewCase={setCaseDrawer}/>}
      {nav==="cases-ai-gen"&&<AiGenPage onShowProgress={()=>setShowProgress(true)}/>}
      {nav==="cases-records"&&!detailTask&&<AiRecordsPage onViewDetail={t=>{setDetailTask(t);}}/>}
      {nav==="cases-records"&&detailTask&&<AiRecordDetail task={detailTask} onBack={()=>setDetailTask(null)}/>}
      {nav==="cases-ai-cfg"&&(
        <div className="flex-1 overflow-y-auto p-6">
          <PageHead title="AI 配置" desc="配置用于生成和评审测试用例的 AI 模型"/>
          <div className="grid grid-cols-2 gap-4 mb-5">
            {[{label:"生成模型",model:"GPT-4o",provider:"OpenAI",color:T.success,icon:Zap},{label:"评审模型",model:"Claude 3.5 Sonnet",provider:"Anthropic",color:T.primary,icon:CheckCircle}].map(({label,model,provider,color,icon:Icon})=>(
              <div key={label} className="rounded-xl px-5 py-4 flex items-center gap-4 bg-white" style={{border:`2px solid ${color}30`}}>
                <IcoSquare color={color} bg={`${color}15`} size={44}><Icon size={22}/></IcoSquare>
                <div className="flex-1"><p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{color}}>{label}</p><p className="text-[14px] font-semibold" style={{color:T.t1}}>{model}<code className="text-[11px] ml-2 font-mono" style={{color:T.t3}}>{provider}</code></p></div>
                <PBtn onClick={()=>{}} variant="ghost" icon={Settings}><span className="text-[12px]">配置</span></PBtn>
              </div>
            ))}
          </div>
          <div className="text-[13px]" style={{color:T.t3}}>更多 AI 连接配置请前往「配置中心 › AI 连接配置」进行管理。</div>
        </div>
      )}

      {caseDrawer&&<CaseDrawer case_={caseDrawer} onClose={()=>setCaseDrawer(null)}/>}
      <AiGenProgress open={showProgress} onClose={()=>setShowProgress(false)} onComplete={()=>{setShowProgress(false);setShowResult(true);}}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUGS MODULE
// ═══════════════════════════════════════════════════════════════════════════════

type BugStatus   = "new"|"assigned"|"in-progress"|"pending-verify"|"closed"|"rejected";
type BugSeverity = "critical"|"major"|"minor"|"trivial";

interface Bug {
  id:string; title:string; status:BugStatus; severity:BugSeverity; priority:Priority;
  assignee:string; creator:string; module:string; relatedCase:string|null;
  createdAt:string; updatedAt:string; description:string; steps:string[];
  expected:string; actual:string; tags:string[];
}
interface BugHistoryItem { id:number; from:BugStatus|null; to:BugStatus; operator:string; note:string; time:string; }
interface BugComment { id:number; author:string; content:string; createdAt:string; }

const BUG_STATUS_CFG:Record<BugStatus,{label:string;bg:string;color:string}> = {
  "new":            {label:"新建",   bg:"#E8F3FF",color:"#165DFF"},
  "assigned":       {label:"已指派", bg:"#F5E8FF",color:"#7816FF"},
  "in-progress":    {label:"处理中", bg:"#FFF3E8",color:"#FF7D00"},
  "pending-verify": {label:"待验证", bg:"#FFFBE8",color:"#C89B00"},
  "closed":         {label:"已关闭", bg:"#E8FFEA",color:"#00B42A"},
  "rejected":       {label:"已驳回", bg:"#FFE8E8",color:"#F53F3F"},
};
const BUG_SEVERITY_CFG:Record<BugSeverity,{label:string;bg:string;color:string}> = {
  "critical":{label:"致命",bg:"#F53F3F",color:"#fff"},
  "major":   {label:"严重",bg:"#FF7D00",color:"#fff"},
  "minor":   {label:"一般",bg:"#FAAD14",color:"#fff"},
  "trivial": {label:"轻微",bg:"#86909C",color:"#fff"},
};
const STATUS_NEXT:Record<BugStatus,{to:BugStatus;label:string;color:string}[]> = {
  "new":            [{to:"assigned",       label:"指派处理",  color:"#7816FF"}],
  "assigned":       [{to:"in-progress",    label:"开始处理",  color:T.warning},{to:"closed",label:"直接关闭",color:T.success}],
  "in-progress":    [{to:"pending-verify", label:"提交验证",  color:"#C89B00"},{to:"closed",label:"直接关闭",color:T.success}],
  "pending-verify": [{to:"closed",         label:"验证通过",  color:T.success},{to:"rejected",label:"验证驳回",color:T.danger}],
  "closed":         [{to:"assigned",       label:"重新打开",  color:"#7816FF"}],
  "rejected":       [{to:"assigned",       label:"重新指派",  color:"#7816FF"},{to:"in-progress",label:"重新处理",color:T.warning}],
};

const BUGS_DATA:Bug[] = [
  {id:"BUG-001",title:"用户登录后首页数据不刷新，需要手动 reload",status:"in-progress",severity:"major",priority:"P1",assignee:"李明",creator:"张程远",module:"用户中心",relatedCase:"Case-07-44",createdAt:"2026-07-01 10:20",updatedAt:"2026-07-03 14:30",description:"用户登录成功后跳转至首页，首页的统计数据不会自动更新，仍然显示上一次访问的缓存数据，直到手动刷新页面才恢复正常。该问题在 Chrome 110+ 版本稳定复现。",steps:["打开平台登录页","输入正确的账号和密码","点击登录按钮，系统跳转至首页","观察首页各模块的统计数据是否刷新"],expected:"首页数据应在登录成功后自动刷新，显示最新统计信息",actual:"首页仍然显示旧的缓存数据，需要手动 Ctrl+Shift+R 强制刷新",tags:["首页","缓存"]},
  {id:"BUG-002",title:"订单导出 Excel 时金额字段小数点丢失",status:"pending-verify",severity:"major",priority:"P1",assignee:"王芳",creator:"张程远",module:"订单中心",relatedCase:"Case-01-40",createdAt:"2026-07-01 14:35",updatedAt:"2026-07-04 09:10",description:"导出订单列表时，金额字段（如 299.50）在 Excel 中显示为整数（299），小数部分被截断，影响财务对账准确性。",steps:["进入订单管理页","筛选有小数金额的订单","点击导出 Excel","打开导出文件查看金额列"],expected:"导出金额保留两位小数，如 299.50",actual:"金额显示为 299，小数丢失",tags:["导出","Excel","金额"]},
  {id:"BUG-003",title:"批量删除操作无确认弹窗直接执行，存在误操作风险",status:"assigned",severity:"critical",priority:"P0",assignee:"陈伟",creator:"李明",module:"获客中心",relatedCase:null,createdAt:"2026-07-02 09:15",updatedAt:"2026-07-02 11:30",description:"在产品管理页，选中多条记录后点击批量删除，系统没有弹出确认对话框直接执行删除操作，存在严重误操作风险。",steps:["进入获客中心-产品管理","选中多条产品记录","点击批量删除按钮","观察系统行为"],expected:"应弹出确认对话框，用户二次确认后才执行删除",actual:"系统直接执行删除，无任何确认提示",tags:["批量操作","UX","风险"]},
  {id:"BUG-004",title:"搜索框输入特殊字符 % 导致 500 错误",status:"closed",severity:"critical",priority:"P0",assignee:"李明",creator:"王芳",module:"用户中心",relatedCase:"Case-03-25",createdAt:"2026-06-28 16:40",updatedAt:"2026-07-01 10:00",description:"在用户搜索框中输入 % 等 SQL 特殊字符后，接口返回 500 Internal Server Error，页面出现空白，存在 SQL 注入风险。",steps:["进入用户管理页","在搜索框输入 %","点击搜索"],expected:"正确处理特殊字符，返回空列表或提示无结果",actual:"接口返回 500 错误，页面白屏",tags:["安全","SQL注入"]},
  {id:"BUG-005",title:"风控规则编辑页在 Firefox 下布局错乱",status:"new",severity:"minor",priority:"P2",assignee:"",creator:"陈伟",module:"风控中心",relatedCase:null,createdAt:"2026-07-03 11:20",updatedAt:"2026-07-03 11:20",description:"风控规则编辑页的表单在 Firefox 124 版本下输入框和标签错位，部分按钮被遮挡。Chrome 和 Safari 不受影响。",steps:["使用 Firefox 124 打开平台","进入风控中心-规则管理","打开任意规则编辑页","观察布局"],expected:"各浏览器布局一致，操作正常",actual:"Firefox 下表单布局错乱",tags:["兼容性","Firefox"]},
  {id:"BUG-006",title:"报告下载链接过期后无任何提示信息",status:"rejected",severity:"minor",priority:"P3",assignee:"张程远",creator:"王芳",module:"报告",relatedCase:null,createdAt:"2026-07-02 15:00",updatedAt:"2026-07-03 09:00",description:"测试报告下载链接有效期 24 小时，过期后点击下载失败且无任何提示，用户不知道需要重新生成。",steps:["生成一份测试报告","等待 24 小时","进入报告列表","点击下载按钮"],expected:"过期后提示链接已失效，并提供重新生成入口",actual:"下载失败，没有任何提示",tags:["报告","下载","体验"]},
  {id:"BUG-007",title:"接口用例批量执行时进度条不实时更新",status:"in-progress",severity:"major",priority:"P1",assignee:"王芳",creator:"陈伟",module:"接口自动化",relatedCase:"Case-05-31",createdAt:"2026-07-03 09:30",updatedAt:"2026-07-04 10:15",description:"对包含 20+ 个用例的套件执行批量运行时，进度条一直保持 0%，所有用例执行完成后才一次性跳到 100%。",steps:["进入执行套件页","选择 20+ 用例的套件","点击运行","观察进度条变化"],expected:"进度条随用例执行逐步更新",actual:"进度条一直 0%，执行完成才跳至 100%",tags:["套件","进度条","实时反馈"]},
  {id:"BUG-008",title:"iOS 16 下表单底部按钮被虚拟键盘遮挡",status:"new",severity:"trivial",priority:"P3",assignee:"",creator:"李明",module:"Web UI 自动化",relatedCase:null,createdAt:"2026-07-04 14:00",updatedAt:"2026-07-04 14:00",description:"在 iOS 16 的 Safari 下，点击输入框弹出虚拟键盘后，底部操作按钮被遮挡，需要滚动才能点击。",steps:["iPhone iOS 16，打开平台","进入包含底部按钮的表单","点击输入框弹出键盘","尝试点击底部按钮"],expected:"底部按钮始终可见或自动上移",actual:"按钮被键盘遮挡",tags:["移动端","iOS"]},
];

const BUG_HISTORY_DATA:BugHistoryItem[] = [
  {id:1,from:null,to:"new",operator:"张程远",note:"发现并记录该缺陷，在 Chrome 110 稳定复现",time:"2026-07-01 10:20"},
  {id:2,from:"new",to:"assigned",operator:"张程远",note:"指派给李明处理，影响用户登录体验，需优先跟进",time:"2026-07-01 10:35"},
  {id:3,from:"assigned",to:"in-progress",operator:"李明",note:"开始排查，已定位到 store 初始化逻辑缺失 reset，正在修复",time:"2026-07-02 10:00"},
];
const BUG_COMMENTS_DATA:BugComment[] = [
  {id:1,author:"李明",content:"已定位到问题，是前端页面初始化时没有触发 store 的 reset 操作导致的。正在修复中。",createdAt:"2026-07-02 10:15"},
  {id:2,author:"张程远",content:"这个问题之前在 staging 也出现过，建议顺带检查一下其他需要重置状态的页面，避免遗漏。",createdAt:"2026-07-02 11:30"},
  {id:3,author:"李明",content:"已检查了其他 5 个页面，只有登录跳转首页这里有问题。预计今天下班前提交修复。",createdAt:"2026-07-02 16:45"},
];
const BUGS_TREND_DATA = [
  {day:"6/5",新增:8,关闭:5},{day:"6/10",新增:12,关闭:9},{day:"6/15",新增:6,关闭:11},
  {day:"6/20",新增:15,关闭:8},{day:"6/25",新增:9,关闭:13},{day:"6/30",新增:11,关闭:7},{day:"7/5",新增:8,关闭:11},
];
const BUGS_MODULE_DIST = [
  {name:"订单中心",count:24},{name:"用户中心",count:18},{name:"获客中心",count:15},
  {name:"风控中心",count:11},{name:"接口自动化",count:8},{name:"报告",count:6},
];
const BUGS_STATUS_DIST = [
  {name:"已关闭",value:28,color:"#00B42A"},{name:"处理中",value:15,color:"#FF7D00"},
  {name:"新建",value:12,color:"#165DFF"},{name:"待验证",value:9,color:"#FAAD14"},
  {name:"已指派",value:8,color:"#7816FF"},{name:"已驳回",value:4,color:"#F53F3F"},
];

// ─── Bug atom components ──────────────────────────────────────────────────────

function BugStatusTag({status}:{status:BugStatus}) {
  const c=BUG_STATUS_CFG[status];
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium" style={{backgroundColor:c.bg,color:c.color}}>{c.label}</span>;
}
function SeverityTag({severity}:{severity:BugSeverity}) {
  const c=BUG_SEVERITY_CFG[severity];
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:c.bg,color:c.color}}>{c.label}</span>;
}

// ─── Bug Detail Drawer ────────────────────────────────────────────────────────

function BugDetailDrawer({bug,onClose,onTransition,onEdit}:{bug:Bug;onClose:()=>void;onTransition:(b:Bug)=>void;onEdit:(b:Bug)=>void}) {
  const[tab,setTab]=useState<"detail"|"history"|"comments">("detail");
  const[comment,setComment]=useState("");
  const ps=PRIORITY_STYLE[bug.priority];
  const nexts=STATUS_NEXT[bug.status];

  return(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0" style={{backgroundColor:"rgba(29,33,41,0.4)"}} onClick={onClose}/>
      <div className="relative flex flex-col overflow-hidden" style={{width:720,backgroundColor:"#fff",boxShadow:"-4px 0 24px rgba(0,0,0,0.12)"}}>
        {/* Severity color strip at top */}
        <div className="h-1 flex-shrink-0" style={{backgroundColor:BUG_SEVERITY_CFG[bug.severity].bg!=="transparent"?BUG_SEVERITY_CFG[bug.severity].bg:T.danger}}/>

        {/* Header */}
        <div className="px-6 pt-4 pb-4 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-2">
                <code className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{backgroundColor:"#F2F3F5",color:T.t2}}>{bug.id}</code>
                <SeverityTag severity={bug.severity}/>
                <BugStatusTag status={bug.status}/>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:ps.bg,color:ps.color}}>{bug.priority}</span>
                {bug.tags.map(t=><span key={t} className="px-1.5 py-0.5 rounded text-[10px]" style={{backgroundColor:"#F2F3F5",color:T.t3}}>{t}</span>)}
              </div>
              <h2 className="text-[16px] font-semibold leading-snug" style={{color:T.t1}}>{bug.title}</h2>
              <p className="text-[12px] mt-1.5 flex items-center gap-3 flex-wrap" style={{color:T.t3}}>
                <span>{bug.module}</span>
                <span>创建人：{bug.creator}</span>
                <span>{bug.createdAt}</span>
                {bug.assignee&&<span>负责人：<span style={{color:T.t1,fontWeight:500}}>{bug.assignee}</span></span>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <PBtn icon={Edit2} onClick={()=>onEdit(bug)} variant="ghost">编辑</PBtn>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[18px]" style={{color:T.t4}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>×</button>
            </div>
          </div>
          {/* Quick transition buttons */}
          {nexts.length>0&&(
            <div className="flex items-center gap-2 mt-3 pt-3" style={{borderTop:`1px solid ${T.border}`}}>
              <span className="text-[11px] font-medium" style={{color:T.t3}}>流转至：</span>
              {nexts.map(n=>(
                <button key={n.to} onClick={()=>onTransition(bug)}
                  className="h-7 px-3 rounded-lg text-[12px] font-medium border transition-all"
                  style={{borderColor:`${n.color}40`,color:n.color,backgroundColor:`${n.color}0C`}}
                  onMouseEnter={e=>e.currentTarget.style.backgroundColor=`${n.color}18`}
                  onMouseLeave={e=>e.currentTarget.style.backgroundColor=`${n.color}0C`}>
                  {n.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 px-6" style={{borderBottom:`1px solid ${T.border}`}}>
          {(["detail","history","comments"] as const).map(t=>{
            const labels={detail:"缺陷详情",history:`流转记录（${BUG_HISTORY_DATA.length}）`,comments:`评论（${BUG_COMMENTS_DATA.length}）`};
            return(
              <button key={t} onClick={()=>setTab(t)}
                className="h-10 px-4 text-[13px] font-medium border-b-2 transition-colors"
                style={{borderBottomColor:tab===t?T.danger:"transparent",color:tab===t?T.danger:T.t3}}>
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Body — overflow-hidden so comments tab can have sticky input */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* ── Detail ── */}
          {tab==="detail"&&(
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Info grid */}
              <div className="grid grid-cols-3 gap-x-6 gap-y-3 pb-5" style={{borderBottom:`1px solid ${T.border}`}}>
                {[{l:"所属模块",v:bug.module},{l:"负责人",v:bug.assignee||"—"},{l:"创建人",v:bug.creator},{l:"创建时间",v:bug.createdAt},{l:"最后更新",v:bug.updatedAt},{l:"关联用例",v:bug.relatedCase||"—"}].map((f,i)=>(
                  <div key={i}>
                    <p className="text-[11px] font-medium mb-0.5" style={{color:T.t3}}>{f.l}</p>
                    <p className="text-[13px]" style={{color:T.t1}}>{f.v}</p>
                  </div>
                ))}
              </div>
              {/* Description */}
              <div>
                <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>问题描述</p>
                <div className="text-[13px] leading-relaxed px-4 py-3 rounded-xl" style={{backgroundColor:"#F7F8FA",color:T.t1}}>{bug.description}</div>
              </div>
              {/* Steps */}
              <div>
                <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>复现步骤</p>
                <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
                  {bug.steps.map((s,i)=>(
                    <div key={i} className="flex items-start gap-3 px-4 py-2.5 border-b last:border-b-0" style={{borderColor:T.border}}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5" style={{backgroundColor:`${T.danger}15`,color:T.danger}}>{i+1}</span>
                      <span className="text-[13px]" style={{color:T.t1}}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Expected vs Actual */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>预期结果</p>
                  <div className="text-[13px] leading-relaxed px-4 py-3 rounded-xl" style={{backgroundColor:"#F6FFED",border:`1px solid #B7EB8F`,color:T.t1}}>{bug.expected}</div>
                </div>
                <div>
                  <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>实际结果</p>
                  <div className="text-[13px] leading-relaxed px-4 py-3 rounded-xl" style={{backgroundColor:"#FFF0F0",border:`1px solid #FFA39E`,color:T.t1}}>{bug.actual}</div>
                </div>
              </div>
              {/* Attachments */}
              <div>
                <p className="text-[12px] font-semibold mb-2" style={{color:T.t2}}>附件 / 截图</p>
                <div className="flex items-center justify-center py-8 rounded-xl border-2 border-dashed" style={{borderColor:T.border}}>
                  <p className="text-[12px]" style={{color:T.t4}}>暂无附件</p>
                </div>
              </div>
            </div>
          )}

          {/* ── History ── */}
          {tab==="history"&&(
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-0">
                {BUG_HISTORY_DATA.map((h,i)=>{
                  const tc=BUG_STATUS_CFG[h.to];
                  return(
                    <div key={h.id} className="flex gap-4">
                      <div className="flex flex-col items-center" style={{width:36}}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] flex-shrink-0" style={{backgroundColor:tc.bg,border:`2px solid ${tc.color}`}}>
                          <span style={{color:tc.color}}>{i===0?"🐞":"→"}</span>
                        </div>
                        {i<BUG_HISTORY_DATA.length-1&&<div className="w-0.5 flex-1 my-1" style={{backgroundColor:T.border,minHeight:28}}/>}
                      </div>
                      <div className="flex-1 pb-5">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                          <span className="text-[13px] font-medium" style={{color:T.t1}}>{h.operator}</span>
                          {h.from&&<><span className="text-[12px]" style={{color:T.t3}}>将状态从</span><BugStatusTag status={h.from}/></>}
                          <span className="text-[12px]" style={{color:T.t3}}>{h.from?"改为":"创建了缺陷"}</span>
                          <BugStatusTag status={h.to}/>
                        </div>
                        <p className="text-[12px] mb-1" style={{color:T.t2}}>{h.note}</p>
                        <p className="text-[11px]" style={{color:T.t4}}>{h.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Comments ── */}
          {tab==="comments"&&(
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {BUG_COMMENTS_DATA.map(c=>(
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0" style={{backgroundColor:T.primary}}>{c.author[0]}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-medium" style={{color:T.t1}}>{c.author}</span>
                        <span className="text-[11px]" style={{color:T.t4}}>{c.createdAt}</span>
                      </div>
                      <div className="text-[13px] leading-relaxed px-4 py-3 rounded-xl" style={{backgroundColor:"#F7F8FA",color:T.t1}}>{c.content}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex-shrink-0 px-6 py-4" style={{borderTop:`1px solid ${T.border}`}}>
                <textarea value={comment} onChange={e=>setComment(e.target.value)}
                  placeholder="添加评论，可以 @提及成员..."
                  className="w-full px-3 py-2.5 border rounded-xl text-[13px] outline-none resize-none transition-all" rows={3}
                  style={{borderColor:T.border,color:T.t1}}
                  onFocus={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.primary}18`;}}
                  onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
                <div className="flex justify-end mt-2">
                  <PBtn icon={Send} onClick={()=>setComment("")}>提交评论</PBtn>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Status Transition Modal ──────────────────────────────────────────────────

function StatusTransitionModal({open,bug,onClose}:{open:boolean;bug:Bug|null;onClose:()=>void}) {
  const[targetStatus,setTargetStatus]=useState<BugStatus|null>(null);
  const[handler,setHandler]=useState("");
  const[note,setNote]=useState("");
  useEffect(()=>{if(open){setTargetStatus(null);setHandler("");setNote("");}}, [open]);

  if(!open||!bug)return null;
  const nexts=STATUS_NEXT[bug.status];
  const tc=targetStatus?BUG_STATUS_CFG[targetStatus]:null;

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{backgroundColor:"rgba(29,33,41,0.55)"}} onClick={onClose}/>
      <div className="relative bg-white rounded-2xl w-[480px] overflow-hidden" style={{boxShadow:"0 24px 64px rgba(0,0,0,0.2)"}}>
        <div className="h-1" style={{backgroundColor:T.danger}}/>
        <div className="px-6 py-5" style={{borderBottom:`1px solid ${T.border}`}}>
          <h3 className="text-[15px] font-semibold" style={{color:T.t1}}>状态流转</h3>
          <p className="text-[12px] mt-0.5 truncate" style={{color:T.t3}}>{bug.id} · {bug.title}</p>
        </div>
        <div className="px-6 py-5 space-y-5">
          {/* Current status */}
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[11px] font-medium mb-1.5" style={{color:T.t3}}>当前状态</p>
              <BugStatusTag status={bug.status}/>
            </div>
            {targetStatus&&<><span className="text-[18px]" style={{color:T.t4}}>→</span><div><p className="text-[11px] font-medium mb-1.5" style={{color:T.t3}}>目标状态</p><BugStatusTag status={targetStatus}/></div></>}
          </div>
          {/* Target options */}
          <div>
            <p className="text-[12px] font-medium mb-2" style={{color:T.t2}}>流转至</p>
            <div className="flex flex-wrap gap-2">
              {nexts.map(n=>(
                <button key={n.to} onClick={()=>setTargetStatus(n.to)}
                  className="h-8 px-4 rounded-xl text-[13px] font-medium border-2 transition-all"
                  style={{borderColor:targetStatus===n.to?n.color:`${n.color}35`,color:n.color,backgroundColor:targetStatus===n.to?`${n.color}12`:"transparent"}}>
                  {n.label}
                </button>
              ))}
            </div>
          </div>
          {/* Handler — shown for states that need assignee */}
          {targetStatus&&["assigned","in-progress"].includes(targetStatus)&&(
            <div>
              <p className="text-[12px] font-medium mb-1.5" style={{color:T.t2}}>指派给</p>
              <select value={handler} onChange={e=>setHandler(e.target.value)} className="w-full h-9 px-2.5 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}>
                <option value="">请选择处理人</option>
                {["李明","王芳","陈伟","张程远"].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
          )}
          {/* Note */}
          <div>
            <p className="text-[12px] font-medium mb-1.5" style={{color:T.t2}}>处理说明 <span style={{color:T.t4,fontWeight:400}}>(可选)</span></p>
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="填写本次流转的处理说明..." rows={3}
              className="w-full px-3 py-2.5 border rounded-xl text-[13px] outline-none resize-none" style={{borderColor:T.border,color:T.t1}}
              onFocus={e=>{e.currentTarget.style.borderColor=T.danger;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.danger}18`;}}
              onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn onClick={onClose} color={tc?.color||T.danger}>确认流转</PBtn>
        </div>
      </div>
    </div>
  );
}

// ─── New / Edit Bug Modal ─────────────────────────────────────────────────────

function NewBugModal({open,bug,onClose}:{open:boolean;bug:Bug|null;onClose:()=>void}) {
  if(!open)return null;
  const isEdit=!!bug;
  const fInp=(placeholder:string,defaultVal?:string,mono?:boolean)=>(
    <input defaultValue={defaultVal} placeholder={placeholder} className={`w-full h-9 px-3 border rounded-lg text-[13px] outline-none transition-all ${mono?"font-mono text-[12px]":""}`} style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.currentTarget.style.borderColor=T.danger;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.danger}18`;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
  );
  const fTa=(placeholder:string,rows:number,defaultVal?:string)=>(
    <textarea defaultValue={defaultVal} placeholder={placeholder} rows={rows} className="w-full px-3 py-2.5 border rounded-lg text-[13px] outline-none resize-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.currentTarget.style.borderColor=T.danger;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.danger}18`;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}/>
  );
  const fSel=(options:string[],placeholder?:string)=>(
    <select className="w-full h-9 px-2.5 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}}>
      {placeholder&&<option value="">{placeholder}</option>}
      {options.map(o=><option key={o}>{o}</option>)}
    </select>
  );
  const fLabel=(label:string,required?:boolean)=>(
    <label className="text-[12px] font-medium block mb-1.5" style={{color:T.t2}}>{required&&<span style={{color:T.danger}}>* </span>}{label}</label>
  );

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0" style={{backgroundColor:"rgba(29,33,41,0.55)"}} onClick={onClose}/>
      <div className="relative bg-white rounded-2xl w-[640px] max-h-[90vh] flex flex-col overflow-hidden" style={{boxShadow:"0 24px 64px rgba(0,0,0,0.2)"}}>
        <div className="h-1 flex-shrink-0" style={{backgroundColor:T.danger}}/>
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`}}>
          <span className="text-[15px] font-semibold" style={{color:T.t1}}>{isEdit?"编辑缺陷":"新增缺陷"}</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-[18px]" style={{color:T.t4}} onMouseEnter={e=>e.currentTarget.style.backgroundColor=T.bg} onMouseLeave={e=>e.currentTarget.style.backgroundColor="transparent"}>×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>{fLabel("缺陷标题",true)}{fInp("简洁描述问题，例如：登录页输入正确密码后提示密码错误",bug?.title)}</div>
          <div className="grid grid-cols-2 gap-4">
            <div>{fLabel("严重程度",true)}{fSel(["致命","严重","一般","轻微"])}</div>
            <div>{fLabel("优先级",true)}{fSel(["P0","P1","P2","P3","P4"])}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>{fLabel("所属模块",true)}{fSel(["用户中心","订单中心","获客中心","风控中心","接口自动化","报告"])}</div>
            <div>{fLabel("指派给")}{fSel(["李明","王芳","陈伟","张程远"],"暂不指派")}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>{fLabel("来源类型")}{fSel(["手动发现","用例执行","AI 检测","代码审查"])}</div>
            <div>{fLabel("关联用例")}{fInp("输入用例 ID，如 Case-07-44",bug?.relatedCase||undefined)}</div>
          </div>
          <div>{fLabel("问题描述")}{fTa("详细描述问题现象、影响范围、触发条件...",3,bug?.description)}</div>
          <div>{fLabel("复现步骤")}{fTa("1. 打开页面\n2. 执行操作\n3. 观察结果",4,bug?.steps.join("\n"))}</div>
          <div className="grid grid-cols-2 gap-4">
            <div>{fLabel("预期结果")}{fTa("描述期望的正确结果",2,bug?.expected)}</div>
            <div>{fLabel("实际结果")}{fTa("描述实际发生的错误结果",2,bug?.actual)}</div>
          </div>
          <div>
            {fLabel("附件 / 截图")}
            <div className="flex flex-col items-center justify-center py-6 rounded-xl border-2 border-dashed" style={{borderColor:T.border}} onMouseEnter={e=>e.currentTarget.style.borderColor=T.danger} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
              <Upload size={22} className="mb-2" style={{color:T.t4}}/>
              <p className="text-[12px]" style={{color:T.t3}}>点击或拖拽文件到此处上传</p>
              <p className="text-[11px] mt-0.5" style={{color:T.t4}}>支持 PNG、JPG、GIF、MP4，最大 20MB</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{borderTop:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
          <PBtn variant="ghost" onClick={onClose}>取消</PBtn>
          <PBtn onClick={onClose} color={T.danger}>{isEdit?"保存修改":"提交缺陷"}</PBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Bug List ─────────────────────────────────────────────────────────────────

function BugList() {
  const[bugs]=useState<Bug[]>(BUGS_DATA);
  const[selected,setSelected]=useState<string[]>([]);
  const[drawer,setDrawer]=useState<Bug|null>(null);
  const[editModal,setEditModal]=useState<Bug|null>(null);
  const[newModal,setNewModal]=useState(false);
  const[transitionModal,setTransitionModal]=useState<Bug|null>(null);
  const toggleSel=(id:string)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);

  const miniStats=[
    {label:"缺陷总数",value:bugs.length,color:T.t1},
    {label:"待处理",value:bugs.filter(b=>["new","assigned"].includes(b.status)).length,color:T.warning},
    {label:"高优先级",value:bugs.filter(b=>["P0","P1"].includes(b.priority)).length,color:T.danger},
    {label:"待验证",value:bugs.filter(b=>b.status==="pending-verify").length,color:"#C89B00"},
  ];

  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Mini stat strip */}
      <div className="flex items-center gap-0 px-6 flex-shrink-0 bg-white" style={{height:48,borderBottom:`1px solid ${T.border}`}}>
        {miniStats.map((s,i)=>(
          <div key={s.label} className="flex items-center gap-2 mr-5">
            <span className="text-[24px] font-bold" style={{color:s.color}}>{s.value}</span>
            <span className="text-[12px]" style={{color:T.t3}}>{s.label}</span>
            {i<miniStats.length-1&&<div className="w-px h-4 ml-5" style={{backgroundColor:T.border}}/>}
          </div>
        ))}
        <div className="flex-1"/>
        <PBtn icon={Plus} onClick={()=>setNewModal(true)} color={T.danger}>新增缺陷</PBtn>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-2.5 flex-shrink-0" style={{borderBottom:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
        <Inp placeholder="搜索缺陷标题或 ID" prefix={<Search size={13}/>} width={220}/>
        <Sel width={100}><option>全部状态</option>{(Object.keys(BUG_STATUS_CFG) as BugStatus[]).map(k=><option key={k}>{BUG_STATUS_CFG[k].label}</option>)}</Sel>
        <Sel width={110}><option>全部严重程度</option>{(Object.keys(BUG_SEVERITY_CFG) as BugSeverity[]).map(k=><option key={k}>{BUG_SEVERITY_CFG[k].label}</option>)}</Sel>
        <Sel width={100}><option>全部优先级</option>{(["P0","P1","P2","P3","P4"] as Priority[]).map(p=><option key={p}>{p}</option>)}</Sel>
        <Sel width={110}><option>全部模块</option>{["用户中心","订单中心","获客中心","风控中心","接口自动化"].map(m=><option key={m}>{m}</option>)}</Sel>
        <Sel width={100}><option>全部负责人</option>{["李明","王芳","陈伟","张程远"].map(p=><option key={p}>{p}</option>)}</Sel>
        <div className="flex-1"/>
        {selected.length>0&&(
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-[12px]" style={{color:T.t3}}>已选 {selected.length}</span>
            <PBtn variant="ghost" icon={Eye}>批量指派</PBtn>
            <PBtn variant="ghost" icon={CheckCircle}>批量关闭</PBtn>
            <PBtn variant="ghost" icon={Trash2} color={T.danger}>删除</PBtn>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <ETable total={bugs.length} cols={[
          {label:"",width:"3%"},{label:"缺陷 ID",width:"9%"},{label:"缺陷标题",width:"25%"},
          {label:"严重程度",width:"8%"},{label:"优先级",width:"7%"},{label:"状态",width:"8%"},
          {label:"负责人",width:"7%"},{label:"所属模块",width:"9%"},{label:"更新时间",width:"12%"},
          {label:"操作",width:"12%",align:"right"},
        ]}>
          {bugs.length===0?(
            <tr><td colSpan={10} className="py-16 text-center">
              <div className="flex flex-col items-center gap-2">
                <Bug size={32} style={{color:T.t4}}/><p className="text-[13px]" style={{color:T.t3}}>暂无缺陷记录</p>
                <PBtn icon={Plus} onClick={()=>setNewModal(true)} color={T.danger} small>新增缺陷</PBtn>
              </div>
            </td></tr>
          ):bugs.map(b=>{
            const ps=PRIORITY_STYLE[b.priority];
            return(
              <TR key={b.id} onClick={()=>setDrawer(b)}>
                <TD><input type="checkbox" checked={selected.includes(b.id)} onChange={()=>toggleSel(b.id)} onClick={e=>e.stopPropagation()} className="w-3.5 h-3.5" style={{accentColor:T.danger}}/></TD>
                <TD><button onClick={e=>{e.stopPropagation();setDrawer(b);}} className="font-mono text-[12px] hover:underline" style={{color:T.danger}}>{b.id}</button></TD>
                <TD>
                  <div>
                    <p className="font-medium truncate max-w-[200px]" style={{color:T.t1}}>{b.title}</p>
                    {b.tags.length>0&&<div className="flex gap-1 mt-0.5">{b.tags.slice(0,2).map(t=><span key={t} className="px-1.5 py-px rounded text-[10px]" style={{backgroundColor:"#F2F3F5",color:T.t3}}>{t}</span>)}</div>}
                  </div>
                </TD>
                <TD><SeverityTag severity={b.severity}/></TD>
                <TD><span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:ps.bg,color:ps.color}}>{b.priority}</span></TD>
                <TD><BugStatusTag status={b.status}/></TD>
                <TD muted>{b.assignee||"—"}</TD>
                <TD muted><span className="truncate block max-w-[80px]">{b.module}</span></TD>
                <TD mono muted>{b.updatedAt}</TD>
                <TD align="right">
                  <div className="flex items-center justify-end">
                    <IBtn icon={Eye} label="详情" onClick={()=>setDrawer(b)}/>
                    <IBtn icon={RefreshCw} label="状态流转" onClick={()=>setTransitionModal(b)}/>
                    <IBtn icon={Edit2} label="编辑" onClick={()=>setEditModal(b)}/>
                    <IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/>
                  </div>
                </TD>
              </TR>
            );
          })}
        </ETable>
      </div>

      {drawer&&<BugDetailDrawer bug={drawer} onClose={()=>setDrawer(null)} onTransition={b=>setTransitionModal(b)} onEdit={b=>setEditModal(b)}/>}
      <NewBugModal open={newModal||!!editModal} bug={editModal} onClose={()=>{setNewModal(false);setEditModal(null);}}/>
      <StatusTransitionModal open={!!transitionModal} bug={transitionModal} onClose={()=>setTransitionModal(null)}/>
    </div>
  );
}

// ─── Bug Stats ────────────────────────────────────────────────────────────────

function BugStats() {
  return(
    <div className="flex-1 overflow-y-auto p-6">
      <PageHead title="缺陷统计" desc="汇总当前项目的缺陷分布、严重程度和趋势，快速识别质量风险"/>
      {/* KPI */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          {label:"缺陷总数",value:"76",sub:"本月新增 23 条",color:T.t1,bg:"#F2F3F5",icon:Bug},
          {label:"待处理",value:"28",sub:"新建 + 已指派",color:T.warning,bg:"#FFF3E8",icon:AlertTriangle},
          {label:"高优先级",value:"15",sub:"P0 + P1 缺陷",color:T.danger,bg:"#FFE8E8",icon:Zap},
          {label:"待验证",value:"9",sub:"开发已修复",color:"#C89B00",bg:"#FFFBE8",icon:CheckCircle},
        ].map(s=>{const Icon=s.icon;return(
          <div key={s.label} className="rounded-xl p-4 bg-white flex items-center gap-3" style={{border:`1px solid ${T.border}`}}>
            <IcoSquare color={s.color} bg={s.bg} size={44}><Icon size={20}/></IcoSquare>
            <div><p className="text-[24px] font-bold leading-none" style={{color:s.color}}>{s.value}</p><p className="text-[12px] font-medium mt-1" style={{color:T.t1}}>{s.label}</p><p className="text-[11px] mt-0.5" style={{color:T.t3}}>{s.sub}</p></div>
          </div>
        );})}
      </div>

      {/* Row: status donut + severity bars */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-xl p-5" style={{border:`1px solid ${T.border}`}}>
          <p className="text-[14px] font-semibold mb-3" style={{color:T.t1}}>状态分布</p>
          <div style={{overflowX:"auto"}}>
            <PieChart width={400} height={200}>
              <Pie data={BUGS_STATUS_DIST} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                {BUGS_STATUS_DIST.map((e,i)=><Cell key={`bsd-${i}`} fill={e.color}/>)}
              </Pie>
              <Tooltip contentStyle={{borderRadius:8,border:`1px solid ${T.border}`,fontSize:12}}/>
              <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:12}}/>
            </PieChart>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5" style={{border:`1px solid ${T.border}`}}>
          <p className="text-[14px] font-semibold mb-4" style={{color:T.t1}}>严重程度分布</p>
          <div className="space-y-4 mt-2">
            {[{label:"致命",count:6,color:"#F53F3F"},{label:"严重",count:22,color:"#FF7D00"},{label:"一般",count:35,color:"#FAAD14"},{label:"轻微",count:13,color:"#86909C"}].map(s=>(
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1"><span className="text-[12px] font-medium" style={{color:T.t2}}>{s.label}</span><span className="text-[12px] font-bold" style={{color:s.color}}>{s.count}</span></div>
                <div className="h-2 rounded-full" style={{backgroundColor:"#F2F3F5"}}><div className="h-2 rounded-full" style={{backgroundColor:s.color,width:`${(s.count/76)*100}%`}}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module distribution */}
      <div className="bg-white rounded-xl p-5 mb-5" style={{border:`1px solid ${T.border}`}}>
        <p className="text-[14px] font-semibold mb-4" style={{color:T.t1}}>模块缺陷分布</p>
        <div style={{overflowX:"auto"}}>
          <BarChart width={600} height={200} data={BUGS_MODULE_DIST} layout="vertical" margin={{top:0,right:30,left:60,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F5" horizontal={false}/>
            <XAxis type="number" tick={{fontSize:12,fill:T.t3}} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="name" tick={{fontSize:12,fill:T.t2}} axisLine={false} tickLine={false} width={60}/>
            <Tooltip contentStyle={{borderRadius:8,border:`1px solid ${T.border}`,fontSize:12}}/>
            <Bar dataKey="count" fill={T.danger} radius={[0,4,4,0]} name="缺陷数"/>
          </BarChart>
        </div>
      </div>

      {/* Trend */}
      <div className="bg-white rounded-xl p-5" style={{border:`1px solid ${T.border}`}}>
        <p className="text-[14px] font-semibold mb-4" style={{color:T.t1}}>新增 vs 关闭趋势</p>
        <div style={{overflowX:"auto"}}>
          <AreaChart width={600} height={200} data={BUGS_TREND_DATA} margin={{top:5,right:10,left:-20,bottom:0}}>
            <defs>
              <linearGradient key="gBNew" id="gBNew" x1="0" y1="0" x2="0" y2="1"><stop key="s1" offset="5%" stopColor={T.danger} stopOpacity={0.12}/><stop key="s2" offset="95%" stopColor={T.danger} stopOpacity={0}/></linearGradient>
              <linearGradient key="gBClose" id="gBClose" x1="0" y1="0" x2="0" y2="1"><stop key="s1" offset="5%" stopColor={T.success} stopOpacity={0.12}/><stop key="s2" offset="95%" stopColor={T.success} stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F2F3F5" vertical={false}/>
            <XAxis dataKey="day" tick={{fontSize:12,fill:T.t3}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:12,fill:T.t3}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{borderRadius:10,border:`1px solid ${T.border}`,fontSize:13}}/>
            <Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:12,paddingTop:12}}/>
            <Area key="new" type="monotone" dataKey="新增" stroke={T.danger} strokeWidth={2.5} fill="url(#gBNew)" dot={false}/>
            <Area key="close" type="monotone" dataKey="关闭" stroke={T.success} strokeWidth={2.5} fill="url(#gBClose)" dot={false}/>
          </AreaChart>
        </div>
      </div>
    </div>
  );
}

// ─── BugsModule container ─────────────────────────────────────────────────────

function BugsModule() {
  const[view,setView]=useState<"list"|"stats">("list");
  return(
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center flex-shrink-0 px-5 bg-white" style={{borderBottom:`1px solid ${T.border}`,height:44}}>
        {[{key:"list",label:"缺陷列表"},{key:"stats",label:"统计视图"}].map(t=>(
          <button key={t.key} onClick={()=>setView(t.key as any)}
            className="h-full px-4 text-[13px] font-medium border-b-2 transition-colors"
            style={{borderBottomColor:view===t.key?T.danger:"transparent",color:view===t.key?T.danger:T.t3}}>
            {t.label}
          </button>
        ))}
      </div>
      {view==="list"&&<BugList/>}
      {view==="stats"&&<BugStats/>}
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
  {nav:"config-param"   as ActiveNav, label:"参数配置"},
  {nav:"config-notif"   as ActiveNav, label:"通知配置"},
  {nav:"config-runner"  as ActiveNav, label:"Runner 配置"},
  {nav:"config-ai"      as ActiveNav, label:"AI 连接配置"},
];

function ConfigModule({nav,onNavigate}:{nav:ActiveNav;onNavigate:(k:ActiveNav)=>void}){
  const tabMap:Record<ActiveNav,string>={config:"overview","config-db":"db","config-env":"env","config-param":"param","config-notif":"notif","config-runner":"runner","config-ai":"ai"} as any;
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
            <div style={{overflowX:"auto"}}><AreaChart width={600} height={200} data={TREND_DATA} margin={{top:5,right:10,left:-20,bottom:0}}><defs><linearGradient key="gS" id="gS" x1="0" y1="0" x2="0" y2="1"><stop key="s1" offset="5%" stopColor={T.primary} stopOpacity={0.12}/><stop key="s2" offset="95%" stopColor={T.primary} stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#F2F3F5" vertical={false}/><XAxis dataKey="day" tick={{fontSize:12,fill:T.t3}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:12,fill:T.t3}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{borderRadius:10,border:`1px solid ${T.border}`,fontSize:13}}/><Legend iconType="circle" iconSize={7} wrapperStyle={{fontSize:12,paddingTop:12}}/><Area key="success" type="monotone" dataKey="成功" stroke={T.primary} strokeWidth={2.5} fill="url(#gS)" dot={false}/><Area key="failure" type="monotone" dataKey="失败" stroke={T.danger} strokeWidth={2} fill="transparent" dot={false}/></AreaChart></div>
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

      {tab==="env"&&(
        <>
          <PageHead title="环境配置" desc="维护测试运行环境地址"/>
          <FilterBar onAdd={()=>{}} addLabel="新增环境"><Inp placeholder="搜索环境名称" prefix={<Search size={13}/>} width={200}/></FilterBar>
          <ETable total={ENV_DATA.length} cols={[{label:"环境名称",width:"14%"},{label:"标识符",width:"10%"},{label:"基础地址",width:"30%"},{label:"说明",width:"20%"},{label:"状态",width:"8%"},{label:"更新时间",width:"10%"},{label:"操作",width:"8%",align:"right"}]}>
            {ENV_DATA.map(r=><TR key={r.id}><TD><div className="flex items-center gap-2.5"><IcoSquare color={T.success} bg="#E8FFEA" size={30}><Globe size={14}/></IcoSquare><span className="font-medium">{r.name}</span></div></TD><TD mono><code className="px-2 py-0.5 rounded text-[11px]" style={{backgroundColor:"#F2F3F5",color:T.t2}}>{r.identifier}</code></TD><TD mono muted><span className="block truncate">{r.baseUrl}</span></TD><TD muted>{r.description}</TD><TD><StatusDot status={r.status}/></TD><TD muted>{r.updatedAt}</TD><TD align="right"><div className="flex items-center justify-end"><IBtn icon={Edit2} label="编辑" onClick={()=>{}}/><IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/></div></TD></TR>)}
          </ETable>
        </>
      )}

      {tab==="notif"&&<NotifModule/>}
      {tab==="runner"&&<RunnerModule/>}
      {tab==="param"&&(
        <div className="flex items-center justify-center h-64"><div className="text-center"><Settings size={32} style={{color:T.t4}} className="mx-auto mb-3"/><p className="text-[14px]" style={{color:T.t3}}>参数配置</p><p className="text-[12px] mt-1" style={{color:T.t4}}>配置页面加载中...</p></div></div>
      )}
      {tab==="ai"&&<AiPoolModule/>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// API MODULE
// ═══════════════════════════════════════════════════════════════════════════════

function ApiLeftPanel({selectedId,onSelect}:{selectedId?:string;onSelect:(id:string,item?:ApiEndpoint)=>void}){
  const[folders,setFolders]=useState<ApiFolder[]>(API_FOLDERS);
  const toggleFolder=(id:string)=>setFolders(fs=>fs.map(f=>f.id===id?{...f,expanded:!f.expanded}:f));
  return(
    <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{width:250,backgroundColor:"#fff",borderRight:`1px solid ${T.border}`}}>
      <div className="px-3 pt-3 pb-2 flex-shrink-0 flex gap-2">
        <PBtn icon={Plus} onClick={()=>{}} small>新建请求</PBtn>
        <PBtn icon={Upload} onClick={()=>{}} variant="ghost"><span className="text-[12px]">导入</span></PBtn>
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
  const[openTabs,setOpenTabs]=useState([{id:"new",label:"新建请求",method:"GET" as HttpMethod}]);
  const[activeTab,setActiveTab]=useState("new");
  const configTabs=["Params","Auth","Headers","Body","前置处理","后置处理","断言","提取器","设置"];
  const responseTabs=["响应体","Headers","Cookies","断言结果"];
  const handleSelect=(_id:string,item?:ApiEndpoint)=>{if(!item)return;setSelectedEndpoint(item);setMethod(item.method);setUrl(item.path);setHasSent(false);if(!openTabs.find(t=>t.id===item.id))setOpenTabs(tabs=>[...tabs,{id:item.id,label:item.name,method:item.method}]);setActiveTab(item.id);};
  return(
    <div className="flex flex-1 overflow-hidden">
      <ApiLeftPanel selectedId={selectedEndpoint?.id} onSelect={handleSelect}/>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Open tabs */}
        <div className="flex items-center flex-shrink-0" style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`,height:40}}>
          {openTabs.map(t=>(
            <div key={t.id} onClick={()=>setActiveTab(t.id)} className="flex items-center gap-2 px-3 h-full border-r cursor-pointer text-[12px]" style={{borderColor:T.border,borderBottom:activeTab===t.id?`2px solid ${T.warning}`:undefined,backgroundColor:activeTab===t.id?"#fff":"transparent",color:activeTab===t.id?T.t1:T.t3}}>
              <MethodBadge method={t.method}/><span>{t.label}</span>
              {t.id!=="new"&&<button onClick={e=>{e.stopPropagation();setOpenTabs(tabs=>tabs.filter(x=>x.id!==t.id));setActiveTab("new");}} className="w-4 h-4 flex items-center justify-center rounded hover:bg-gray-200" style={{color:T.t4}}><X size={10}/></button>}
            </div>
          ))}
          <button className="px-3 h-full text-[16px]" style={{color:T.t4}} onMouseEnter={e=>e.currentTarget.style.color=T.t1} onMouseLeave={e=>e.currentTarget.style.color=T.t4}>+</button>
        </div>
        {/* URL bar */}
        <div className="flex items-center gap-2 px-4 flex-shrink-0" style={{height:56,backgroundColor:"#fff",borderBottom:`1px solid ${T.border}`}}>
          <select value={method} onChange={e=>setMethod(e.target.value as HttpMethod)} className="h-9 px-2.5 rounded-lg border text-[12px] font-bold outline-none" style={{borderColor:METHOD_BG[method],backgroundColor:METHOD_BG[method],color:METHOD_COLOR[method],width:90}}>
            {(["GET","POST","PUT","DELETE","PATCH"] as HttpMethod[]).map(m=><option key={m}>{m}</option>)}
          </select>
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="请输入包含 http/https 的完整 URL 或接口路径" className="flex-1 h-9 px-3 border rounded-lg text-[13px] outline-none" style={{borderColor:T.border,color:T.t1}} onFocus={e=>{e.currentTarget.style.borderColor=T.primary;}} onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}/>
          <button className="h-8 px-3 rounded-lg border text-[12px] font-medium" style={{borderColor:T.border,color:T.t2}}>Curl</button>
          <select className="h-8 px-2.5 border rounded-lg text-[12px] outline-none" style={{borderColor:T.border,color:T.t2,width:110}}><option>测试环境</option><option>预发布环境</option></select>
          <PBtn icon={Play} onClick={()=>setHasSent(true)}>发送</PBtn>
          <PBtn icon={Save} onClick={()=>{}} variant="ghost">保存</PBtn>
          <button onClick={onOpenAiDrawer} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[12px] font-medium" style={{borderColor:`${T.purple}30`,color:T.purple,backgroundColor:"#F5E8FF"}}><Sparkles size={13}/>AI 生成</button>
        </div>
        {/* Config tabs */}
        <div className="flex items-center flex-shrink-0 px-4" style={{backgroundColor:"#fff",borderBottom:`1px solid ${T.border}`,height:40}}>
          {configTabs.map(tab=><button key={tab} onClick={()=>setRequestTab(tab)} className="h-full px-3 text-[13px] font-medium border-b-2 transition-colors" style={{borderBottomColor:requestTab===tab?T.warning:"transparent",color:requestTab===tab?T.warning:T.t2}}>{tab}</button>)}
        </div>
        {/* Config content */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-white">
          {requestTab==="Params"&&<div className="p-4"><div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}><table className="w-full text-[13px]"><thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>{["","参数名","参数值","说明"].map((h,i)=><th key={i} className="px-3 py-2 text-left text-[11px] font-semibold" style={{color:T.t3,width:i===0?"32px":undefined}}>{h}</th>)}</tr></thead><tbody>{[{key:"page",val:"1"},{key:"pageSize",val:"20"},{key:"status",val:""}].map((r,i)=><tr key={i} className="border-b" style={{borderColor:T.border}}><td className="px-3 py-2"><input type="checkbox" defaultChecked className="w-3.5 h-3.5" style={{accentColor:T.primary}}/></td><td className="px-3 py-2"><input defaultValue={r.key} className="w-full outline-none text-[13px] font-mono" style={{color:T.primary}}/></td><td className="px-3 py-2"><input defaultValue={r.val} className="w-full outline-none text-[13px]" style={{color:T.t1}}/></td><td className="px-3 py-2"><input className="w-full outline-none text-[13px]" style={{color:T.t3}}/></td></tr>)}</tbody></table><button className="flex items-center gap-1.5 w-full px-3 py-2 text-[12px]" style={{color:T.t3}}><Plus size={12}/>添加参数</button></div></div>}
          {requestTab==="Body"&&<div className="p-4"><div className="flex gap-1 mb-3">{["none","form-data","x-www-form-urlencoded","json","xml","raw"].map(t=><button key={t} onClick={()=>setBodyType(t)} className="px-3 py-1.5 rounded text-[12px] font-medium border" style={{backgroundColor:bodyType===t?`${T.primary}12`:"transparent",color:bodyType===t?T.primary:T.t3,borderColor:bodyType===t?`${T.primary}30`:"transparent"}}>{t}</button>)}</div>{bodyType==="json"?<div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}><div className="flex items-center gap-2 px-3 py-2" style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}><Code2 size={12} style={{color:T.t3}}/><span className="text-[11px]" style={{color:T.t3}}>JSON</span></div><textarea defaultValue={'{\n  "page": 1,\n  "pageSize": 20\n}'} className="w-full outline-none resize-none text-[12px] p-4" rows={8} style={{fontFamily:"'JetBrains Mono',monospace",color:"#1D2129"}}/></div>:<div className="flex items-center justify-center py-12" style={{color:T.t4}}><p className="text-[13px]">请求没有 Body</p></div>}</div>}
          {requestTab==="断言"&&<div className="p-4"><div className="rounded-lg overflow-hidden" style={{border:`1px solid ${T.border}`}}><table className="w-full text-[13px]"><thead><tr style={{backgroundColor:"#FAFAFA",borderBottom:`1px solid ${T.border}`}}>{["类型","路径","规则","期望值","实际值","状态","操作"].map(h=><th key={h} className="px-3 py-2 text-left text-[11px] font-semibold" style={{color:T.t3}}>{h}</th>)}</tr></thead><tbody>{ASSERT_ROWS.map((r,i)=><tr key={i} className="border-b" style={{borderColor:T.border}}><td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded text-[10px]" style={{backgroundColor:"#EEF0FA",color:"#4E5AC8"}}>JSONPath</span></td><td className="px-3 py-2 font-mono text-[12px]" style={{color:T.primary}}>{r.path}</td><td className="px-3 py-2" style={{color:T.t2}}>{r.op}</td><td className="px-3 py-2 font-mono text-[12px]" style={{color:T.t1}}>{r.expected}</td><td className="px-3 py-2 font-mono text-[12px]" style={{color:T.t3}}>{hasSent?r.actual:"—"}</td><td className="px-3 py-2">{hasSent?<StatusDot status={r.result} label={r.result==="pass"?"通过":"失败"}/>:<span className="text-[11px]" style={{color:T.t4}}>未运行</span>}</td><td className="px-3 py-2"><div className="flex gap-1"><IBtn icon={Edit2} label="编辑" onClick={()=>{}}/><IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/></div></td></tr>)}</tbody></table><button className="flex items-center gap-1.5 w-full px-3 py-2 text-[12px]" style={{color:T.t3}}><Plus size={12}/>添加断言</button></div></div>}
          {!["Params","Body","断言"].includes(requestTab)&&<div className="flex items-center justify-center py-12" style={{color:T.t4}}><p className="text-[13px]">暂无配置</p></div>}
        </div>
        {/* Response */}
        <div className="flex-shrink-0 flex flex-col overflow-hidden" style={{height:280,borderTop:`2px solid ${T.border}`,backgroundColor:"#fff"}}>
          <div className="flex items-center flex-shrink-0 px-4 gap-4" style={{height:40,borderBottom:`1px solid ${T.border}`,backgroundColor:"#FAFAFA"}}>
            <span className="text-[13px] font-semibold" style={{color:T.t1}}>响应内容</span>
            {hasSent&&<><span className="px-2 py-0.5 rounded text-[12px] font-bold" style={{backgroundColor:"#E8FFEA",color:T.success}}>200 OK</span><span className="text-[12px]" style={{color:T.t3}}>123 ms</span><span className="text-[12px]" style={{color:T.t3}}>1.84 KB</span></>}
            <div className="flex-1"/>
            <div className="flex">{responseTabs.map(tab=><button key={tab} onClick={()=>setResponseTab(tab)} className="h-8 px-3 text-[12px] font-medium border-b-2" style={{borderBottomColor:responseTab===tab?T.primary:"transparent",color:responseTab===tab?T.primary:T.t3}}>{tab}</button>)}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!hasSent?<div className="flex flex-col items-center justify-center h-full" style={{color:T.t4}}><Play size={28} className="mb-2"/><p className="text-[13px]">点击「发送」获取响应内容</p></div>:<pre className="text-[12px] leading-relaxed" style={{fontFamily:"'JetBrains Mono',monospace",color:T.t1}}>{MOCK_RESPONSE_JSON}</pre>}
          </div>
        </div>
      </div>
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
        {page==="scenarios"&&(
          <div className="flex-1 overflow-y-auto p-5">
            <PageHead title="接口场景" desc="多接口串联编排，支持数据驱动和场景级断言"/>
            <FilterBar onAdd={()=>{}} addLabel="新建场景"><Inp placeholder="搜索场景名称" prefix={<Search size={13}/>} width={200}/></FilterBar>
            <ETable total={SCENARIOS.length} cols={[{label:"ID",width:"8%"},{label:"场景名称",width:"30%"},{label:"优先级",width:"7%"},{label:"状态",width:"8%"},{label:"最近结果",width:"8%"},{label:"所属模块",width:"14%"},{label:"操作",width:"25%",align:"right"}]}>
              {SCENARIOS.map(s=><TR key={s.id}><TD muted>{s.id}</TD><TD><span className="font-medium" style={{color:T.primary}}>{s.name}</span></TD><TD><span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:"#FFF3E8",color:T.warning}}>{s.priority}</span></TD><TD><StatusDot status={s.status} label="进行中"/></TD><TD>{s.lastResult?<StatusDot status={s.lastResult} label={s.lastResult==="pass"?"通过":"失败"}/>:<span className="text-[12px]" style={{color:T.t4}}>未运行</span>}</TD><TD muted>{s.module}</TD><TD align="right"><div className="flex items-center justify-end"><IBtn icon={Edit2} label="编辑" onClick={()=>{}}/><IBtn icon={Play} label="运行" onClick={()=>{}}/><IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/></div></TD></TR>)}
            </ETable>
          </div>
        )}
        {page==="suites"&&(
          <div className="flex-1 overflow-y-auto p-5">
            <PageHead title="执行套件" desc="组合场景和接口用例，配置执行策略"/>
            <FilterBar onAdd={()=>{}} addLabel="新建套件"><Inp placeholder="搜索套件名称" prefix={<Search size={13}/>} width={200}/></FilterBar>
            <ETable total={SUITES.length} cols={[{label:"套件名称",width:"35%"},{label:"优先级",width:"8%"},{label:"所属模块",width:"12%"},{label:"最近结果",width:"10%"},{label:"最近运行",width:"16%"},{label:"操作",width:"19%",align:"right"}]}>
              {SUITES.map(s=><TR key={s.id}><TD><div><p className="font-semibold" style={{color:T.t1}}>{s.name}</p><p className="text-[11px] mt-0.5" style={{color:T.t3}}>{s.desc}</p></div></TD><TD><span className="px-2 py-0.5 rounded text-[11px] font-bold" style={{backgroundColor:"#FFF3E8",color:T.warning}}>{s.priority}</span></TD><TD muted>{s.module}</TD><TD>{s.lastResult?<StatusDot status={s.lastResult} label={s.lastResult==="pass"?"通过":"失败"}/>:<span className="text-[12px]" style={{color:T.t4}}>未运行</span>}</TD><TD mono muted>{s.lastRun}</TD><TD align="right"><div className="flex items-center justify-end"><IBtn icon={Eye} label="查看" onClick={()=>{}}/><IBtn icon={Play} label="运行" onClick={()=>{}}/><IBtn icon={Trash2} label="删除" danger onClick={()=>{}}/></div></TD></TR>)}
            </ETable>
          </div>
        )}
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
  {key:"bugs",      nav:"bugs"       as ActiveNav, icon:Bug,             color:T.danger,   label:"缺陷管理"},
  {key:"api",       nav:"api"        as ActiveNav, icon:Link2,           color:T.warning,  label:"接口自动化"},
  {key:"webui",     nav:"webui"      as ActiveNav, icon:Monitor,         color:T.cyan,     label:"Web UI 自动化"},
  {key:"app",       nav:"app"        as ActiveNav, icon:Smartphone,      color:T.purple,   label:"APP 自动化"},
  {key:"tasks",     nav:"tasks"      as ActiveNav, icon:Timer,           color:"#F59E0B",  label:"任务中心"},
  {key:"reports",   nav:"reports"    as ActiveNav, icon:ClipboardList,   color:"#7816FF",  label:"报告中心"},
  {key:"settings",  nav:"settings"   as ActiveNav, icon:Shield,          color:T.slate,    label:"系统设置"},
] as const;

function PrimaryNav({active,onChange,onLogout}:{active:ActiveNav;onChange:(k:ActiveNav)=>void;onLogout?:()=>void}){
  const activeModule=active.split("-")[0];

  return(
    <div className="flex-shrink-0 flex flex-col items-center py-3 gap-1 select-none bg-white"
      style={{width:56,borderRight:`1px solid ${T.border}`}}>

      {/* Logo mark — no text */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 flex-shrink-0"
        style={{background:`linear-gradient(135deg,${T.primary},#4F8EFF)`}}>
        <FlaskConical size={16} color="#fff"/>
      </div>

      {/* Module icon buttons */}
      {PRIMARY_MODULES.map(({key,nav,icon:Icon,color,label},i)=>{
        const isActive=activeModule===key;
        return(
          <div key={key} className="w-full flex flex-col items-center">
            {/* Divider before reports+settings */}
            {i===8&&<div className="w-8 h-px mb-1" style={{backgroundColor:T.border}}/>}
            <button
              title={label}
              onClick={()=>onChange(nav)}
              className="group relative w-10 h-10 flex items-center justify-center rounded-xl transition-all"
              style={{backgroundColor:isActive?color:"transparent"}}
              onMouseEnter={e=>{if(!isActive)e.currentTarget.style.backgroundColor=`${color}18`;}}
              onMouseLeave={e=>{if(!isActive)e.currentTarget.style.backgroundColor="transparent";}}>
              <Icon size={18} color={isActive?"#fff":color}/>
              {/* Tooltip */}
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

      {/* User avatar — click to logout */}
      <button title="张程远 · 点击退出登录" onClick={onLogout}
        className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
        style={{backgroundColor:T.primary}}>张</button>
    </div>
  );
}

function TopBar({active}:{active:ActiveNav}){
  // Resolve breadcrumb labels from module definitions
  const mod=PRIMARY_MODULES.find(m=>active.startsWith(m.key));
  const subLabel=NAV_DEFS.reduce<string|null>((acc,d)=>{
    if(acc)return acc;
    if(isGroup(d)){const c=d.children.find(ch=>ch.key===active);return c?c.label:null;}
    return null;
  },null);
  return(
    <div className="h-12 flex-shrink-0 flex items-center justify-between px-5 bg-white"
      style={{borderBottom:`1px solid ${T.border}`}}>
      {/* Breadcrumb — no AutoTest prefix */}
      <div className="flex items-center gap-1.5 text-[13px]">
        <span className="font-medium" style={{color:subLabel?T.t2:T.t1}}>{mod?.label}</span>
        {subLabel&&(
          <>
            <ChevronRight size={13} style={{color:T.t4}}/>
            <span className="font-medium" style={{color:T.t1}}>{subLabel}</span>
          </>
        )}
      </div>
      {/* Right actions */}
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-2 h-7 px-3 rounded-lg border text-[12px] transition-colors"
          style={{borderColor:T.border,color:T.t3}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.color=T.primary;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.t3;}}>
          <Search size={12}/>快速查找
          <kbd className="px-1 py-px text-[10px] rounded ml-1"
            style={{backgroundColor:"#F2F3F5",color:T.t3,border:`1px solid ${T.border}`}}>⌘K</kbd>
        </button>
        <div className="h-5 w-px" style={{backgroundColor:T.border}}/>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white"
            style={{backgroundColor:T.primary}}>张</div>
          <span className="text-[13px]" style={{color:T.t1}}>张程远</span>
          <ChevronDown size={12} style={{color:T.t4}}/>
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

export default function App() {
  const[loggedIn,setLoggedIn]=useState(false);
  const[active,setActive]=useState<ActiveNav>("cases-list");
  const module=active.split("-")[0];

  if(!loggedIn) return <LoginPage onLogin={()=>setLoggedIn(true)}/>;

  return(
    <div className="h-screen flex overflow-hidden" style={{fontFamily:"'Inter','PingFang SC','Microsoft YaHei',sans-serif",fontSize:14,backgroundColor:T.bg}}>
      {/* Icon-only primary nav, white background */}
      <PrimaryNav active={active} onChange={setActive} onLogout={()=>setLoggedIn(false)}/>

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar active={active}/>

        {/* Module content — each module owns its own sub-tab bar */}
        {module==="config"&&<ConfigModule nav={active} onNavigate={setActive}/>}
        {module==="cases"&&<CasesModule  nav={active} onNavigate={setActive}/>}
        {active==="api"&&<ApiModule/>}
        {active==="bugs"&&<BugsModule/>}
        {active==="webui"&&<WebUIModule/>}
        {active==="tasks"&&<TaskModule/>}
        {active==="reports"&&<ReportModule/>}
        {active==="settings"&&<SettingsModule/>}
        {active==="overview"&&<OverviewModule onNavigate={setActive as (k:string)=>void}/>}
        {active==="app"&&<Placeholder nav={active}/>}
      </div>
    </div>
  );
}
