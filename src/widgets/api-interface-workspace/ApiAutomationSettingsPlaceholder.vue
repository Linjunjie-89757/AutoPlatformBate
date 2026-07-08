<template>
  <div class="api-automation-settings-workspace">
    <section class="api-automation-settings-card">
      <div>
        <strong>接口自动化设置</strong>
        <p>这里后续承载请求超时、重试、代理、SSL、通知和本地调试等全局配置。</p>
      </div>
      <el-tag type="info" effect="plain">规划中</el-tag>
    </section>
    <section class="api-automation-settings-grid">
      <div class="api-automation-settings-item">
        <strong>请求超时与重试</strong>
        <span>全局请求超时时间、失败重试次数、重试间隔。</span>
      </div>
      <div class="api-automation-settings-item">
        <strong>网络代理与 SSL</strong>
        <span>全局代理、证书校验策略和测试环境访问配置。</span>
      </div>
      <div class="api-automation-settings-item">
        <strong>通知设置</strong>
        <span>套件运行完成、失败告警、报告推送等通知规则。</span>
      </div>
      <div class="api-automation-settings-item">
        <strong>本地调试</strong>
        <span>维护本地 Runner 状态、任务心跳和调试范围；服务端执行使用后端默认配置。</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.api-automation-settings-workspace {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: 0;
  flex: 1;
  padding: 16px;
  background: #f8fafc;
}

.api-automation-settings-card,
.api-automation-settings-item {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.api-automation-settings-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
}

.api-automation-settings-card strong,
.api-automation-settings-item strong {
  color: var(--app-text-primary);
  font-size: 15px;
}

.api-automation-settings-card p {
  margin: 6px 0 0;
  color: var(--app-text-muted);
  font-size: 13px;
}

.api-automation-settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.api-automation-settings-item {
  display: grid;
  gap: 6px;
  min-height: 96px;
  padding: 14px;
}

.api-automation-settings-item span {
  color: var(--app-text-muted);
  font-size: 13px;
  line-height: 20px;
}
</style>
