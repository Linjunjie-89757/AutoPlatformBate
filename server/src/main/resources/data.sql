MERGE INTO tb_sys_workspace KEY(id) VALUES
(1, 'account-open', '开户工作空间', '开户链路相关测试资产', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'trade-core', '交易工作空间', '交易核心流程', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'risk-control', '风控工作空间', '风控校验和拦截', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tb_sys_user (
    id, username, display_name, role_code, password, status, created_at, updated_at
) KEY(id) VALUES
(1, 'zhangli', '张莉', 'PLATFORM_ADMIN', '{noop}123456', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 'chennan', '陈楠', 'MEMBER', '{noop}123456', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 'liping', '李萍', 'MEMBER', '{noop}123456', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 'zhaofeng', '赵峰', 'MEMBER', '{noop}123456', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 'wangxin', '王欣', 'VIEWER', '{noop}123456', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tb_sys_workspace_member KEY(id) VALUES
(1, 1, 1, 'ADMIN', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 1, 2, 'MEMBER', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(3, 1, 3, 'MEMBER', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(4, 2, 1, 'ADMIN', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5, 2, 4, 'MEMBER', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(6, 3, 1, 'ADMIN', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(7, 3, 5, 'VIEWER', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tb_case_info (
    id, workspace_id, case_no, title, case_type, priority, source_type,
    owner_id, precondition, steps, expected_result, created_at, updated_at
) KEY(id) VALUES
(128, 1, 'CASE-00128', '开户成功主流程', 'FUNCTION', 'P0', 'AI_GENERATED', 2, '客户信息完整', '提交开户申请', '开户成功', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(129, 1, 'CASE-00129', '开户字段边界长度校验', 'BOUNDARY', 'P1', 'AI_GENERATED', 3, '验证码已发送', '输入超长字段', '提示字段长度校验失败', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(130, 2, 'CASE-00130', '短信验证码失效处理', 'EXCEPTION', 'P0', 'MANUAL', 4, '验证码过期', '提交验证码', '提示验证码失效', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(131, 3, 'CASE-00131', '多浏览器登录兼容回归', 'REGRESSION', 'P2', 'IMPORTED', 5, 'Chrome/Edge 可用', '执行登录回归', '兼容通过', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tb_exec_task KEY(id) VALUES
(201, 2, 'api-trade-settlement', 'API', 'SUCCESS', 'UAT 环境下单与结算回归', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(202, 2, 'web-regression-payment', 'WEB', 'FAILED', 'Chrome Headless 支付回归', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(203, 3, 'app-login-and-transfer', 'APP', 'FAILED', 'iPhone 14 登录与转账冒烟', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tb_exec_report KEY(id) VALUES
(301, 2, 201, 'api-trade-settlement-report', 'SUCCESS', '鉴权和结算断言全部通过', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(302, 2, 202, 'web-regression-payment-report', 'FAILED', '支付按钮等待超时', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(303, 3, 203, 'app-login-and-transfer-report', 'FAILED', '登录后首页元素未出现', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tb_bug_info KEY(id) VALUES
(1001, 2, 'BUG-20260502-001', '支付页面提交按钮偶现不可点击', 'Playwright 回归时支付页按钮在弹层后不可点击，导致流程中断。', 'P1', 'HIGH', 'IN_PROGRESS', 'REPORT', 4, 1, 130, 302, 202, '["支付","Web","回归"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(1002, 1, 'BUG-20260502-002', '开户验证码边界校验提示不一致', '边界用例中验证码过期和验证码错误返回的前端提示文案不一致。', 'P2', 'MEDIUM', 'TODO', 'CASE', 3, 1, 129, NULL, NULL, '["开户","边界"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tb_bug_flow_record KEY(id) VALUES
(5001, 1001, 'TODO', 'ASSIGNED', 1, '指派给赵峰跟进', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(5002, 1001, 'ASSIGNED', 'IN_PROGRESS', 4, '已复现并开始修复', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tb_bug_comment KEY(id) VALUES
(8001, 1001, '弹层关闭后即可恢复，怀疑遮罩层状态没有清理。', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(8002, 1001, '已补充截图，等前端同学确认。', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tb_env_config KEY(id) VALUES
(1, 1, 'API', '开户-UAT', 'https://uat-account.example.com', '{"auth":"token"}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 2, 'WEB', '交易-WEB-UAT', 'https://uat-trade.example.com', '{"browser":"chrome"}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

MERGE INTO tb_param_set KEY(id) VALUES
(1, 1, 'TOKEN', '开户-UAT-Token', '{"token":"demo-token"}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(2, 2, 'HEADER', '交易公共Header', '{"X-App":"trade-web"}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
