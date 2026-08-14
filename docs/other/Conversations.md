看到 docs/US-MARKET-PLAN.md 了 —— 转美国市场这件事对下面的设计有直接影响，尤其是 marriage license 那种「按州而异、有等待期、会失效」的知识，它恰好是最该走 tool call 而不是塞进 prompt 的东西。

一、这算 agent 吗？
部分算，而且我建议你别让它全算。

现在业界比较能站得住的定义是：模型在一个循环里自主决定下一步动作、调用工具、看到结果再决定继续还是收工。按这个标准：

「进入某一关 → 助手决定问哪几个问题 → 判断信息够了 → 调工具把任务写进数据库」——这是真 agentic，因为"该问什么"和"何时算问够了"是模型在运行时决定的，不是你写死的分支。
「13 关的存在、时间线排期、解锁提醒、进度计算」——这些不该是 agentic。它们是确定性逻辑，交给模型只会变慢、变贵、变得不可复现。
所以准确的说法是：Bliss 是一个以确定性工作流为骨架、在少数几个决策点上嵌入 agentic 循环的系统。 对外你完全可以叫它 AI 助手 / agent；对内你要清楚只有两三个地方真的在跑循环。这个边界画得越清楚，产品越稳。

还有一个判断：不要做 multi-agent。 备婚的所有决定都共享同一份上下文（这对 couple 的预算、风格、家庭情况、已经排除的选项）。多 agent 的主要代价就是上下文分裂，而你这里上下文恰好是最宝贵的资产。一个 agent + 一组好工具 + 一份好记忆，比五个专家 agent 强得多。

二、系统全貌

┌─────────────────────────────────────────────────────────┐
│  确定性层（不是 agent，普通代码）                          │
│  · Timeline Engine     排期、逆推 deadline、软预警         │
│  · Progress Engine     进度、通关判定、里程碑触发           │
│  · Template Resolver   按标签从候选池筛任务                 │
│  · Legal Rules         州级婚姻登记规则查表                 │
└─────────────────────────────────────────────────────────┘
                          ▲ tools
┌─────────────────────────────────────────────────────────┐
│  Agentic 层（一个 agent，两种运行模式）                    │
│                                                          │
│  模式 A · Scoping Loop（进入某关时）                       │
│    目标：把这一关界定成一份具体清单                         │
│    终止条件：调用了 commit_tasks，或用户说"先这样"          │
│                                                          │
│  模式 B · Companion Loop（随时对话）                       │
│    目标：回答问题、改计划、接住情绪                         │
│    终止条件：没有待办工具调用                               │
└─────────────────────────────────────────────────────────┘
                          ▲ context
┌─────────────────────────────────────────────────────────┐
│  Memory 层（三层，全部结构化）                             │
│  · Profile    这对 couple 是谁（稳定事实）                 │
│  · Decisions  他们决定过什么（append-only 日志）            │
│  · Moments    值得回看的瞬间（叙事产物）                    │
└─────────────────────────────────────────────────────────┘
三、Tools（这是设计的核心，比 prompt 重要）
工具设计有一条原则：读的工具可以宽，写的工具必须窄。 让模型能随便查，但写入必须走窄接口、带校验、可回滚。


// ─── 读 ───────────────────────────────────────────────
get_wedding_context()
  → { date, daysLeft, guestCount, budget, city, state,
      hasPlanner, cultures[], profile, activeModules[] }

get_module(moduleSlug)
  → { title, scenario, scopingQuestions[], taskPool[] }
      // taskPool 每条带 appliesWhen 标签

get_decisions(moduleSlug?)
  → Decision[]   // 他们已经定过的事，防止重复提问

get_timeline_pressure(moduleSlug)
  → { recommendedStartBy, slackDays, risk: 'ok'|'tight'|'late' }

lookup_marriage_license(state, county?)
  → { waitingPeriodHours, validityDays, officiantRules, docsNeeded[] }
      // 查表，不是模型知识。写错这个会让人婚姻无效。

// ─── 写（每个都要用户可见的确认）─────────────────────────
propose_tasks(moduleSlug, tasks[], rationale)
  → { proposalId }        // 只是提案，不落库

commit_tasks(proposalId, edits?)
  → { created: Task[] }   // 用户点确认后才走这一步

record_decision({ moduleSlug, question, choice, reason, confidence })
  → { decisionId }        // memory 的写入口

update_profile(patch, evidence)
  → { profile }           // 只允许改白名单字段

adjust_timeline(moduleSlug, { estimatedDays?, deadline? }, reason)
propose_tasks 和 commit_tasks 分开是刻意的：模型永远不能直接改用户的清单。 它只能提案，用户点一下才生效。这一个设计决定能消掉 80% 的"AI 乱改我的东西"投诉，而且它同时给了你埋 moment 的时机（用户确认的那一刻，就是一个决策发生了）。

四、Memory 三层
别一上来做向量检索。备婚的记忆是结构化的、量很小的、需要精确的——一对 couple 整个流程可能就 100-200 个决策点，全部塞进 context 都塞得下。向量检索解决的是"太多记不住"，你现在的问题不是这个。

Layer 1 · Profile（稳定事实，覆盖写）


{
  styleKeywords: ['garden', 'minimal', 'candlelit'],
  budgetPosture: 'value-conscious',        // 省钱优先 or 效果优先
  decisionStyle: 'needs-options',          // 有主见 / 要建议 / 要被推着走
  cultures: ['Chinese', 'American'],       // 影响双仪式、敬茶等
  familyDynamics: '男方父母深度参与预算',
  hardConstraints: ['户外必须有雨备', '不要动物'],
  ruledOut: [{ item: '目的地婚礼', reason: '奶奶无法长途飞行' }]
}
ruledOut 是被低估的一项。助手最掉分的时刻就是第三次推荐一个用户已经否掉的东西。

Layer 2 · Decisions（append-only，永不修改）


{
  id, weddingId, moduleSlug,
  question: 'Rent or buy the dress?',
  choice: 'buy-custom',
  reason: '想留下来给女儿',        // ← 这句是产品的灵魂
  decidedBy: userId, decidedAt,
  supersedes: decisionId | null,   // 改主意时指向旧的，不删
  photoIds: [], cost: null
}
改主意不覆盖，用 supersedes 串起来。因为"我们本来想租，后来决定买，因为想留给女儿"比结论本身更值得记住——这正是你说的 moments。

Layer 3 · Moments（叙事产物，可以异步生成）

由后台任务从 decisions + photos + 时间数据合成，不需要在对话里实时做。触发点：通关、里程碑、倒计时节点。这层是唯一适合让模型自由生成文字的地方，因为它不影响正确性。

五、Context 组装（决定质量的地方）
每次调模型，装配顺序是固定的：


[System]        角色、语气、绝不能做的事
[Profile]       约 300 tokens，全量注入
[Decisions]     本模块全部 + 其他模块的关键决策，约 500 tokens
[Module Spec]   scenario + scopingQuestions + taskPool，约 800 tokens
[Timeline]      当前压力状态，约 100 tokens
[History]       本次对话最近 10 轮
全部加起来 2-3k tokens，稳定、便宜、可缓存。Profile 和 Module Spec 是稳定前缀，放前面走 prompt caching，能省掉大部分成本。

六、Scoping Loop 的状态机

enter(module)
   │
   ├─ 已 scoped？ → 直接展示清单，进 Companion 模式
   │
   └─ 未 scoped：
      1. 展示 scenario（静态文案，不用模型，秒开）
      2. agent 读 profile + decisions + timeline
      3. agent 从 scopingQuestions 里挑 2-3 个还没答案的，二选一形式抛出
         ├─ 用户选 → 每个选择 record_decision
         └─ 用户点"我不确定，你帮我定" → agent 依 profile 取默认值，
            记 confidence: 'assumed'（后面可以回头确认）
      4. agent 调 propose_tasks，从 taskPool 按标签筛 + 必要时补充
      5. 用户看到清单，可增删改 → commit_tasks
      6. 进 Companion 模式
第 3 步有两个细节值得强调：

"你帮我定"必须是一等公民，不是兜底。焦虑的人最需要它。记成 assumed 而不是 decided，助手后面可以自然地回来问一句"当时我先按 X 帮你们定了，还合适吗？"——这比一开始就逼人做决定体验好得多。
scenario 用静态文案、不过模型。用户点进一关时立刻有东西看，模型在后台想问题。这决定了产品"快"还是"卡"。
七、Guardrails（我认为最关键的四条）
任务不许自由发明，只许从池子里挑 + 裁剪。 例外要显式标记 source: 'ai' 并给出理由。婚礼是一次性、高代价的事，模型编一条错任务的代价远大于漏一条。
法律 / 时限类信息一律走工具查表，不许模型回答。 lookup_marriage_license 必须是查表。等待期算错三天，婚礼就办不了。
写操作全部 propose → confirm 两段。 模型不能单方面改用户的清单、日期、预算。
同输入同输出。 相同 profile + 相同选择应该得到相同清单。做法是让筛选走确定性的 appliesWhen 标签匹配，模型只负责"挑哪些标签"，不负责"生成哪些任务"。
八、怎么验证它有没有做对（eval）
这套设计的好处是可测。建几条 golden path：

场景	期望
12 个月 + 租婚纱 + 无策划师	清单不含"量体修改""最终取纱"；含"提前试穿磨合"
6 个月 + 定制婚纱	时间线预警 risk: 'late'，助手主动提出改租或改款
华裔 + 美国场地	出现敬茶/双仪式任务，且 marriage license 走州规则
已 ruledOut 目的地婚礼	后续任何模块都不再出现目的地相关任务
全程点"你帮我定"	仍能产出完整可执行清单，全部标 assumed
最后一条是最重要的测试。如果一个字都不肯打的用户也能拿到一份好清单，这个产品才真的成立。

九、MCP 放在哪
现在别做。MCP 的价值在接外部真实数据，而你目前的瓶颈不在数据，在机制。等机制跑通了，MCP 的自然位置是：

场地 / 供应商目录（The Knot、Zola 之类）
Google Calendar 双向同步
邮箱里的供应商合同与报价（读取、自动填进 task 的费用字段）
这些都属于"把 app 之外的世界接进来"，做完会很强，但都建立在"清单和记忆已经准确"的前提上。

十、落地顺序建议
扩 quest-templates.ts：给一关（我建议 Attire）加上 scenario + scopingQuestions + 带 appliesWhen 标签的 taskPool
建 decisions + profile 两张表，先不接模型，手动塞数据也能跑
实现 Template Resolver（纯函数，纯确定性）——这一步做完，不用 AI 就已经能按选择生成差异化清单了
才接 agent，让它负责"问哪些问题"和"挑哪些标签"
Moments 生成放最后，它是收获，不是地基
第 3 步之后你就能亲手体验"选租赁 vs 选定制"两份清单的差别，而那时候一行 AI 代码都还没写。我觉得这是验证这套设计最便宜的方式。

要不要我按这个顺序，先把 Attire 这一关的 scopingQuestions + 带标签 taskPool + Template Resolver 写出来跑给你看？纯确定性、不接模型、半小时能看到结果。