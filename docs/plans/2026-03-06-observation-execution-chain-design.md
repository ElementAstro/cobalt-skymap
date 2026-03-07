# 观测计划执行闭环设计（方案 B）

## 背景与问题

- 现有 `components/starmap/planning/session-planner.tsx` 已具备排程、保存计划、模板、导入导出等能力。
- 现有 `components/starmap/planning/observation-log.tsx` 已具备观测会话与观测记录能力。
- 当前链路断点在于：`Session Planner` 产出的计划仍是“静态快照”，`Observation Log` 里的“从计划器生成草稿”只是把最近计划重新导回计划器，而不是真正进入执行态。
- 结果是 `计划 → 执行 → 记录 → 复盘 → 导出` 没有统一的数据主线，导致状态同步、进度展示与结果归档都不完整。

## 设计目标

- 打通主链：`目标清单 → 生成计划 → 开始执行 → 逐目标记录 → 结束执行 → 导出/归档`
- 复用现有 `Session Planner` 与 `Observation Log`，不新建独立大页面。
- 保持现有 `savedPlans`、`templates`、手工观测会话向后兼容。
- 在桌面端以 Tauri 后端作为执行阶段真源，前端 Zustand 只做缓存与恢复。

## 设计边界

- 本轮只补齐单晚观测执行闭环，不做跨晚自动拆分。
- 不做赤道仪/相机自动联机执行，不改变现有 mount 控制职责。
- 不新增复杂向导式页面，优先增强 `components/starmap/planning/session-planner.tsx` 和 `components/starmap/planning/observation-log.tsx`。
- 不重写现有 `lib/astronomy/plan-exporter.ts`，执行结果导出采用独立导出器。

## 方案选择

已评估三类方案：

1. 最小补丁：仅让观测日志直接从计划创建会话。
2. 执行态中台：在静态计划之上增加统一执行实体，由计划器和观测日志共用。
3. 全新流程向导：新增单独“今晚观测流程”页面。

本次采用方案 2：

- 保留 `SavedSessionPlan` 作为静态计划快照。
- 新增“执行会话”作为运行时实体，承接计划执行、目标状态、观测记录与结果导出。
- 执行阶段真源放入 `ObservationSession` 扩展字段，避免出现多份后端真源。

## 领域模型设计

### 1. 静态计划

继续沿用：

- `lib/stores/session-plan-store.ts` 中的 `SavedSessionPlan`
- `types/starmap/session-planner-v2.ts` 中的 `SessionDraftV2`

职责：

- 存储排程结果
- 保留约束条件与备注
- 支持模板复用、导入导出

### 2. 执行会话

在 `types/starmap/session-planner-v2.ts` 新增：

- `SessionExecutionStatus = 'draft' | 'ready' | 'active' | 'completed' | 'archived' | 'cancelled'`
- `ExecutionTargetStatus = 'planned' | 'in_progress' | 'completed' | 'skipped' | 'failed'`
- `PlannedSessionExecution`
- `PlannedSessionExecutionTarget`
- `ExecutionSummary`

建议字段：

- `id`
- `sourcePlanId`
- `sourcePlanName`
- `status`
- `planDate`
- `locationId`
- `locationName`
- `notes`
- `weatherSnapshot`
- `startedAt`
- `endedAt`
- `summary`
- `targets`

### 3. 执行目标

每个目标保留排程时间和执行结果：

- `id`
- `targetId`
- `targetName`
- `scheduledStart`
- `scheduledEnd`
- `scheduledDurationMinutes`
- `order`
- `status`
- `actualStart`
- `actualEnd`
- `observationIds`
- `resultNotes`
- `skipReason`
- `completionSummary`
- `unplanned`

### 4. 观测记录关联

在 `lib/tauri/types.ts` 与 `src-tauri/src/data/observation_log.rs` 的 `Observation` 上增加：

- `execution_target_id?: string`

在 `ObservationSession` 上增加可选执行字段：

- `source_plan_id?: string`
- `source_plan_name?: string`
- `execution_status?: string`
- `execution_targets?: ExecutionTarget[]`
- `weather_snapshot?: SessionWeatherSnapshot`
- `execution_summary?: ExecutionSummary`

## 状态流设计

### 1. 计划阶段

- 用户在 `Session Planner` 中生成排程。
- 点击“保存计划”时，仅创建 `SavedSessionPlan`。
- 此时仍处于静态计划阶段，不影响观测日志。

### 2. 开始执行

- 用户在 `Session Planner` 中点击“开始执行”。
- 前端从当前展示计划生成执行 payload。
- 调用新的 Tauri 命令创建 planned session。
- 返回的 `ObservationSession` 成为执行阶段真源。
- 前端 `useSessionPlanStore` 同步缓存 `executions` 与 `activeExecutionId`。

### 3. 执行过程

- `Observation Log` 优先展示激活中的执行会话。
- 目标支持：
  - 开始
  - 完成
  - 跳过
  - 添加观测
  - 查看关联观测
- 新增观测记录时，如果带有 `execution_target_id`，后端同步更新对应目标的 `observation_ids` 与状态。

### 4. 完成与归档

- 当所有目标都进入 `completed | skipped | failed` 时，允许“结束执行”。
- 结束执行后生成 `execution_summary`。
- 归档后保留只读查看和导出能力。

## UI 与交互设计

### 1. `Session Planner`

增强 `components/starmap/planning/session-planner.tsx`：

- 保留 `保存计划`
- 新增 `开始执行`
- 若存在未结束执行会话，显示 `继续执行`
- 顶部增加执行状态条：
  - 未开始
  - 执行中
  - 已完成
  - 已归档
- 时间线块增加执行状态视觉标记
- 已开始执行后，仅允许修改未开始目标

### 2. `Observation Log`

增强 `components/starmap/planning/observation-log.tsx`：

- 原“从计划器生成草稿”入口替换为：
  - `从计划开始执行`
  - `继续执行中的计划`
- 若存在激活执行会话，默认展示该会话的执行工作区
- 在会话详情中增加两个标签页：
  - `计划目标`
  - `观测记录`
- 允许添加计划外目标，标记为 `unplanned`

### 3. 国际化

补充 `i18n/messages/en.json` 与 `i18n/messages/zh.json`：

- 开始执行 / 继续执行 / 结束执行 / 归档
- 目标状态标签
- 跳过原因
- 执行结果导出

## 持久化与同步设计

### 1. 前端缓存

在 `lib/stores/session-plan-store.ts` 增加：

- `executions`
- `activeExecutionId`
- `createExecutionFromPlan`
- `setActiveExecution`
- `syncExecutionFromObservationSession`
- `updateExecutionTarget`
- `attachObservationToExecutionTarget`
- `completeExecution`
- `archiveExecution`

并通过 `persist` 的 `version` + `migrate` 保持兼容。

### 2. 后端真源

执行阶段统一使用扩展后的 `ObservationSession`：

- 手工观测会话：执行字段为空
- 计划执行会话：执行字段完整

这样可复用现有：

- `create_session`
- `update_session`
- `add_observation`
- `delete_observation`
- `end_session`

同时新增更贴近业务的 `create_planned_session`，避免前端先创建空会话再二次写入。

### 3. 导出复用

- 计划导出：继续使用 `lib/astronomy/plan-exporter.ts`
- 执行结果导出：新增 `lib/astronomy/execution-exporter.ts`
- 文件保存仍复用 `lib/tauri/api.ts` 的 `sessionIo.exportSessionPlan` 和 `src-tauri/src/data/session_io.rs` 的 `export_session_plan`

## 兼容与迁移策略

- `SavedSessionPlan`、`SessionTemplate` 结构保持可读。
- 历史 `ObservationSession` 未包含执行字段时，默认视为手工会话。
- Rust 侧新增字段全部可选，保证旧 JSON 反序列化不失败。
- Zustand 迁移仅初始化新字段，不尝试批量回填历史执行态。

## 测试设计

### 前端

- `lib/stores/__tests__/session-plan-store.test.ts`
  - 创建执行会话
  - 关联 observation
  - 完成与归档
- `components/starmap/planning/__tests__/session-planner.test.tsx`
  - 开始执行按钮
  - 继续执行状态
  - 状态条与按钮可用性
- `components/starmap/planning/__tests__/observation-log.test.tsx`
  - 执行工作区渲染
  - 目标状态流转
  - observation 挂接
- `lib/astronomy/__tests__/execution-exporter.test.ts`
  - markdown/json/csv 输出

### Tauri / Rust

- `lib/tauri/__tests__/api.test.ts`
  - `createPlannedSession`
  - `addObservation` 执行目标关联参数
- `src-tauri/src/data/observation_log.rs`
  - 新字段序列化/反序列化
  - 旧数据兼容
  - observation 回挂目标

## 验收标准

- 可以从一个已保存计划显式创建执行会话。
- `Observation Log` 能展示执行中的计划目标，而不是只回灌草稿。
- 为目标添加观测后，目标状态与关联记录立即同步。
- 可以结束并归档执行会话。
- 可以导出实际执行结果。
- 旧手工观测会话、旧保存计划、旧模板保持可用。

## 风险与控制

- 最大风险：前端缓存与后端真源双写不一致。
  - 控制：以 `ObservationSession` 为执行阶段真源，前端只做覆盖式同步。
- 次要风险：UI 增量过多导致组件进一步膨胀。
  - 控制：优先在现有组件内抽出小型 helper，不新建大流程页面。
- 次要风险：旧数据兼容回归。
  - 控制：Rust 与 Zustand 各自补兼容测试。

## 落地建议

- 先补模型与 store，再补 Tauri 真源与 API。
- 然后接入 `Session Planner` 的开始执行动作。
- 最后改造 `Observation Log` 作为执行工作区，并补执行结果导出。

## 说明

- 本文档已按设计批准状态落盘。
- 未执行 `git commit`，因为仓库工作说明要求除非用户明确要求，否则不要提交版本库变更。
