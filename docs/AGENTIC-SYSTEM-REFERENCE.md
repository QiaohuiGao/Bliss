# 工业级 Agentic System 参考图与术语辨析

**用途：** 理清 harness / loop / ephemeral run / 三种 memory / trace / eval release 这些词各自
指什么、住在系统的哪一层、以及在 Bliss 里对应什么。

**怎么看这个文件：** VSCode 里按 `Cmd+Shift+V` 打开 Markdown 预览，Mermaid 图会渲染出来。
若图不显示，装扩展 `Markdown Preview Mermaid Support`，或把代码块贴到 https://mermaid.live 。

---

## 图 1 · 静态分层架构（这些词各住哪一层）

```mermaid
graph TB
    subgraph L0["① 入口层 Surface"]
        UI["产品 UI<br/>聊天 / 按钮 / 表单"]
        TRIG["非人类触发<br/>Cron / Webhook / 队列"]
    end

    subgraph L1["② HARNESS 运行时（全是确定性代码，不是模型）"]
        ORCH["Orchestrator 编排器<br/>派哪个 agent、串行还是并行"]
        CTX["Context Assembler 上下文组装器<br/>system + memory + tools + history"]
        LOOP["Agent Loop 循环控制器<br/>停止条件 / 步数上限 / 成本上限"]
        DISP["Tool Dispatcher 工具分发器<br/>参数校验、并行执行、错误归一化"]
        GUARD["Guardrails 护栏<br/>权限、沙箱、注入检测、HITL 确认"]
        DUR["Durable State 持久执行<br/>checkpoint / 崩溃恢复 / 可重放"]
    end

    subgraph L2["③ 模型层"]
        ROUTER["Model Router<br/>大小模型分工、降级、重试"]
        LLM["LLM 推理<br/>系统里唯一的非确定性部分"]
    end

    subgraph L3["④ 能力层 Tools"]
        RTOOL["读工具<br/>查询、检索、外部 API"]
        WTOOL["写工具<br/>改数据库、发消息、下单"]
        MCPX["MCP Servers<br/>把外部系统统一成工具"]
        SANDBOX["代码执行沙箱"]
    end

    subgraph L4["⑤ 记忆层 Memory"]
        WM["Working 工作记忆<br/>= 当前 context window"]
        SEM["Semantic 语义记忆<br/>事实与知识"]
        EPI["Episodic 情节记忆<br/>发生过的具体事件"]
        PROC["Procedural 程序记忆<br/>做事的方法"]
    end

    subgraph L5["⑥ 可观测层 LLM Ops"]
        TRACE["Traces 与 Spans<br/>每次 run 的因果树"]
        METRIC["Metrics<br/>成本 / 延迟 / 成功率 / 工具错误率"]
        FEED["用户反馈<br/>点赞、改写、放弃"]
    end

    subgraph L6["⑦ 改进层 Eval and Release"]
        DATASET["Eval Datasets<br/>从真实 trace 里挑出来的样本"]
        EVALR["Eval Runner<br/>断言 / LLM-as-judge / 人工"]
        GATE["Release Gate<br/>不过线不许上"]
        DEPLOY["Canary 与 Rollback"]
        REG["Artifact Registry<br/>prompt / tool / 模型版本"]
    end

    UI --> ORCH
    TRIG --> ORCH
    ORCH --> LOOP
    LOOP --> CTX
    CTX --> ROUTER
    ROUTER --> LLM
    LLM -->|"想调工具"| DISP
    DISP --> GUARD
    GUARD --> RTOOL
    GUARD --> WTOOL
    GUARD --> MCPX
    GUARD --> SANDBOX
    RTOOL -->|"结果回灌"| LOOP
    WTOOL -->|"结果回灌"| LOOP
    LOOP --> DUR

    CTX <--> WM
    CTX <--> SEM
    CTX <--> EPI
    CTX <--> PROC

    LOOP -.-> TRACE
    DISP -.-> TRACE
    LLM -.-> TRACE
    TRACE --> METRIC
    UI -.-> FEED

    TRACE --> DATASET
    FEED --> DATASET
    DATASET --> EVALR
    EVALR --> GATE
    GATE --> DEPLOY
    DEPLOY --> REG
    REG -.->|"下一版 prompt 与工具定义"| CTX
```

**读这张图的一句话总结：** 模型只住在 ②→③ 之间那一小格里。所谓"做 agent"，
九成工作量在 harness、memory、ops、eval 这四层，都是普通工程。

---

## 图 2 · 一次 Ephemeral Agent Run 的生命周期（动态视角）

`ephemeral`（短暂的）指的就是这张图：**一次 run 被创建、干活、还回结果、然后销毁**，
除了它显式写进 memory 的东西，什么都不留下。

```mermaid
sequenceDiagram
    autonumber
    participant U as 触发方
    participant H as Harness
    participant M as Memory
    participant L as LLM
    participant T as Tools
    participant O as Ops

    U->>H: 给一个目标 + 边界（预算 / 步数 / 权限）
    H->>O: 开一条 trace，run_id 生成
    H->>M: 读 semantic + episodic + procedural
    M-->>H: 组装进 working memory

    rect rgb(245, 245, 250)
    note over H,T: ▼ Agent Loop —— 循环体，这才是 "loop" 的所指
    loop 直到满足停止条件
        H->>L: 一次推理请求（span: llm_call）
        L-->>H: 文本 或 工具调用请求
        alt 请求调工具
            H->>H: 校验参数、查权限、必要时要用户确认
            H->>T: 执行（span: tool_call，可并行）
            T-->>H: 结果 或 归一化后的错误
            H->>H: 结果追加进 working memory
            H->>O: 记 span
        else 无工具调用
            H->>H: 判定为收工
        end
    end
    end

    H->>M: 把该留下的写回（这一步决定了什么能"跨 run 存活"）
    H->>O: 关 trace，落成本 / 延迟 / 结果
    H-->>U: 交付结果
    note over H: run 销毁，working memory 蒸发
```

**停止条件（stop condition）必须写死，这是 agent 和"死循环烧钱"的唯一区别：**

| 类型 | 例子 |
|---|---|
| 自然收工 | 模型这一轮不再调工具 |
| 终止工具 | 调用了 `submit_answer` / `commit_tasks` |
| 预算耗尽 | max_steps、max_tokens、max_cost、wall-clock |
| 外部中断 | 用户打断、上游取消 |
| 护栏拦截 | 触发不可恢复的权限或安全错误 |

**Ephemeral 对比 Persistent：**

| | Ephemeral Run | Persistent / Long-lived Agent |
|---|---|---|
| 生命周期 | 一个任务，几秒到几分钟 | 跨天、跨会话常驻 |
| 上下文 | 全新，干净，隔离 | 累积，会漂移、会污染 |
| 可并行 | 天然可以，互不干扰 | 难 |
| 可重放 | 容易（输入确定） | 难 |
| 状态怎么活 | **只靠写进 Memory 层** | 靠自己的进程内状态 |
| 工业界现状 | 主流做法 | 少数场景 |

> 工业界现在几乎都选 ephemeral：**把"持续性"交给 Memory 层，而不是交给一个长命进程。**
> 这样 agent 可以随时崩、随时重启、随时横向扩，而记忆不丢。

---

## 图 3 · 三种 Memory 的区别（这组词最容易混）

这套分类借自认知心理学，2020 年代被搬进 agent 领域。关键分辨问题：
**这条信息是"是什么"、"发生过什么"、还是"怎么做"？**

```mermaid
graph LR
    subgraph WORKING["WORKING MEMORY 工作记忆"]
        W1["就是当前 context window<br/>run 结束即消失<br/>容量硬上限<br/>← 'context engineering' 全在管这一层"]
    end

    subgraph LONG["LONG-TERM MEMORY 长期记忆（跨 run 存活）"]
        subgraph SEMANTIC["SEMANTIC 语义记忆 — 是什么"]
            S1["去时间的事实与知识<br/>可覆盖、可修正"]
            S2["存储：结构化表 / KV / 向量库 / 知识图"]
            S3["Bliss: profile 表<br/>预算 40k、花园风、已排除目的地婚礼<br/>WA 州登记等待期 3 天"]
        end

        subgraph EPISODIC["EPISODIC 情节记忆 — 发生过什么"]
            E1["带时间与情境的具体经历<br/>append-only，永不覆盖"]
            E2["存储：事件日志 / 对话轨迹 / trajectory 库"]
            E3["Bliss: decisions 表<br/>'8月3日聊婚纱，选了定制，因为想留给女儿'<br/>← 你说的 moments 就住这里"]
        end

        subgraph PROCEDURAL["PROCEDURAL 程序记忆 — 怎么做"]
            P1["技能、流程、习得的做事方式<br/>改动频率最低"]
            P2["存储：prompt 模板 / 工具定义 / skill 文件 / 微调权重"]
            P3["Bliss: quest-templates 候选池<br/>scopingQuestions 提问策略<br/>'先问二选一再给清单' 这条流程本身"]
        end
    end

    SEMANTIC -->|"检索注入"| WORKING
    EPISODIC -->|"检索注入"| WORKING
    PROCEDURAL -->|"编译进 system prompt 与工具表"| WORKING
    WORKING -->|"run 结束时提炼写回"| SEMANTIC
    WORKING -->|"append 事件"| EPISODIC
    WORKING -.->|"很慢：靠 eval 与人工<br/>不要让 agent 自己随便改"| PROCEDURAL
```

**一句话辨析：**

- **Semantic** = 百科条目。「他们预算 4 万美元」
- **Episodic** = 日记条目。「8 月 3 日我们聊到预算，她说超 4 万会吵架」
- **Procedural** = 操作手册。「聊预算时先问弹性，再报数字」

**最容易踩的坑：** 把三种都丢进一个向量库然后 `similarity_search`。
它们的读写模式根本不同 —— semantic 要**准确**、episodic 要**完整有序**、procedural 要**版本可控**。
向量检索只适合"量大到装不下"的那部分，通常只有 episodic 的历史长尾需要。

**还有一条：procedural memory 的写入必须慢。** 让 agent 自己修改自己的做事方法，
听起来很酷，实际是最快的质量崩塌路径。它应该走图 4 那条 eval 流水线，而不是运行时自己改。

---

## 图 4 · LLM Ops 与 Eval Release 闭环（怎么持续变好而不变坏）

```mermaid
graph TB
    PROD["生产环境流量"]

    subgraph OBS["观测 Observability"]
        T["Trace 一次 run 的完整因果树<br/>root span = run<br/>child spans = llm_call / tool_call / retrieval"]
        LOGS["Logs 非结构化文本"]
        MET["Metrics 成本 延迟 步数 工具错误率 收工率"]
        FB["Feedback 点赞 改写 放弃 人工标注"]
    end

    subgraph CURATE["数据集策管 Dataset Curation"]
        MINE["从 trace 里挖：失败的、慢的、贵的、被用户改写的"]
        GOLD["Golden Set 人工确认过的期望输出"]
        VER["数据集版本化<br/>数据集本身也是要 review 的资产"]
    end

    subgraph EV["评测 Eval"]
        E1["确定性断言<br/>结构对不对、必含字段、禁止内容"]
        E2["LLM-as-judge<br/>语气、有用性、是否幻觉"]
        E3["Trajectory Eval<br/>不只看答案，看工具调用序列对不对"]
        E4["人工评审<br/>抽样，判高风险场景"]
        E5["回归对比<br/>与当前 baseline 逐条 diff"]
    end

    subgraph REL["发布 Release"]
        GATE{"Release Gate<br/>阈值 + 无回归 + 成本没超"}
        CAN["Canary 1% → 10% → 100%<br/>盯守护指标"]
        RB["自动 Rollback"]
        REGI["Artifact Registry<br/>prompt v、tool schema v、model v、dataset v"]
    end

    PROD --> T
    PROD --> LOGS
    PROD --> MET
    PROD --> FB
    T --> MINE
    FB --> MINE
    MINE --> GOLD
    GOLD --> VER
    VER --> E1 & E2 & E3 & E4
    E1 & E2 & E3 & E4 --> E5
    E5 --> GATE
    GATE -->|"通过"| CAN
    GATE -->|"不通过"| MINE
    CAN -->|"守护指标恶化"| RB
    CAN -->|"稳定"| REGI
    REGI --> PROD
    RB --> PROD
```

**这里几个词的精确区别：**

| 词 | 是什么 | 不是什么 |
|---|---|---|
| **Log** | 一行文本，「发生了 X」 | 没有因果结构 |
| **Span** | 一个带起止时间、输入输出、成本的操作单元 | 不是一整次 run |
| **Trace** | 一次 run 里所有 span 组成的树 | 不是聚合数字 |
| **Metric** | 聚合数字，用来报警 | 不能用来 debug 单个 case |
| **Eval** | 离线、可复现、跑在固定数据集上、有分数 | 不是"我手动试了几句感觉不错" |
| **Eval Release** | 把 eval 当 CI 门禁：不过线不许发 | 不是发完再看效果 |

**Trace 是 eval 的原料，这是整个闭环的关键连接。** 没有 trace 就没有真实失败样本，
没有失败样本 eval 就只能测你想得到的情况 —— 而 agent 出事的地方永远是你想不到的那些。

---

## 术语总表（含 Bliss 对应物）

| 术语 | 一句话定义 | 住在哪层 | Bliss 里是什么 |
|---|---|---|---|
| **Harness** | 模型外面那一整套确定性运行时：组装上下文、跑循环、分发工具、管权限与预算 | ② | Fastify 里的 agent 服务；Claude Code 本身就是一个 harness |
| **Agent Loop** | 组装 → 推理 → 调工具 → 回灌 → 再推理，直到满足停止条件 | ② | Scoping Loop（问 2-3 个问题后 commit）与 Companion Loop |
| **Ephemeral Agent Run** | 一次有界执行，用完即弃，状态只靠写进 memory 存活 | ②③ | 用户点进「婚纱」触发的那一次 scoping run |
| **Working Memory** | 当前 context window 本身 | ⑤ | 那 2-3k tokens 的组装结果 |
| **Semantic Memory** | 去时间的事实 | ⑤ | `profile` 表、`ruledOut`、州级登记规则表 |
| **Episodic Memory** | 带时间的具体经历 | ⑤ | `decisions` 表（append-only，用 `supersedes` 串改主意） |
| **Procedural Memory** | 做事的方法 | ⑤ | `quest-templates.ts` 候选池、提问策略、system prompt |
| **Context Engineering** | 在有限窗口里放对东西的工程 | ② | 固定装配顺序 + 稳定前缀走 prompt caching |
| **Tool / Function Calling** | 模型请求执行一个有 schema 的操作 | ③④ | `propose_tasks`、`record_decision`、`lookup_marriage_license` |
| **MCP** | 把外部系统统一暴露成工具的协议 | ④ | 未来接 Google Calendar、供应商目录、合同邮箱 |
| **Guardrails** | 运行时的硬约束 | ② | 写操作必须 propose → 用户确认；法律信息必须查表 |
| **HITL** | 关键动作前要人确认 | ② | `commit_tasks` 必须用户点一下 |
| **Durable Execution** | 可 checkpoint、可崩溃恢复、可重放 | ② | 一次 scoping 中断后能接着走 |
| **Trace / Span** | 一次 run 的因果树 / 树上一个节点 | ⑥ | 每次 scoping run 一条 trace |
| **Eval** | 离线、可复现、有分数的批量测试 | ⑦ | golden path：12 个月 + 租婚纱 → 清单不含「量体修改」 |
| **Trajectory Eval** | 评的是工具调用序列，不只是最终文本 | ⑦ | 是否先 `get_decisions` 再提问（防重复提问） |
| **LLM-as-judge** | 用模型给模型的输出打分 | ⑦ | 语气是否「温柔不催促」 |
| **Release Gate** | eval 不过线不许发 | ⑦ | prompt 改动进 CI |
| **Canary** | 小流量试发 + 守护指标 + 自动回滚 | ⑦ | 新 prompt 先给 5% 用户 |
| **Artifact Registry** | prompt / 工具 schema / 模型 / 数据集全部版本化 | ⑦ | 每份清单记下生成它的 prompt 版本 |

---

## 成熟度分级（判断自己该在哪一级）

| 级 | 特征 | 需要的东西 |
|---|---|---|
| **L0 单次调用** | 一次 prompt 一次回答，无工具 | 就一个 API key |
| **L1 工作流** | 你写死的步骤，每步调一次模型 | + prompt 版本管理 |
| **L2 工具型 Agent** | 模型自己决定调哪个工具，有 loop 和停止条件 | + harness、tool schema、护栏、trace |
| **L3 有记忆的 Agent** | 跨会话记得用户，semantic/episodic 分开存 | + memory 层、检索、写回策略 |
| **L4 可持续演进** | trace → dataset → eval → gate → canary 闭环跑通 | + eval 基建、registry、回滚 |

**我对 Bliss 的判断：目标是 L3，现在是 L0。**

而且 L3 的前置不是 L2，是**先把 L1 做到极好** —— 也就是我上一条说的 Template Resolver：
纯确定性、不接模型、按标签筛任务。先证明「选租赁 vs 选定制得到两份明显不同的好清单」这件事
本身有价值，再让模型接管"问哪些问题"。

L4 的 eval 基建看着像大厂配置，但对你有一条现在就该做的：
**从第一天起就把每次生成的 (输入 profile, 选择, 输出清单) 三元组存下来。**
这就是你未来的 eval 数据集，成本几乎为零，但事后补不回来。

---

## 常见误解速查

| 误解 | 实际 |
|---|---|
| 「agent = 会调工具的 LLM」 | agent = LLM + harness + loop + 停止条件 + 记忆。少了 harness 只是 function calling |
| 「memory = 向量数据库」 | 向量库只是 semantic/episodic 的一种存储实现。小规模下结构化表更准、更便宜、更好 debug |
| 「多个 agent 比一个强」 | 多 agent 主要代价是上下文分裂。除非任务真能独立并行，否则一个 agent + 好工具更强 |
| 「eval 就是写测试」 | eval 输出是分布与分数，不是通过/失败。要有 baseline 对比和阈值，不是断言等号 |
| 「先上线，看用户反馈再改」 | 没有 trace，用户反馈无法定位到哪一步出错。observability 要先于上线 |
| 「让 agent 自己学习进化」 | 让它自己改 procedural memory 是最快的质量崩塌路径。演进要走 eval 流水线 |
| 「agent 要常驻才有记忆」 | 恰恰相反：ephemeral run + 外置 memory 才是工业主流，能崩、能重启、能扩容 |

---

## 参考坐标（对应关系，方便你查资料时定位）

| 这份文档里的层 | 业界常见工具 |
|---|---|
| Harness | Claude Agent SDK、LangGraph、Temporal（durable）、自研 |
| Tools / MCP | Model Context Protocol |
| Memory | Postgres + pgvector、Redis、Zep、Mem0、LangMem |
| Trace | LangSmith、Braintrust、Langfuse、W&B Weave、Arize Phoenix、OpenTelemetry GenAI semconv |
| Eval / Release | Braintrust、LangSmith Evals、Promptfoo、自建 CI 门禁 |
