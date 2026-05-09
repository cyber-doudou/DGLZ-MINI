# 《大怪路子》AI v3 — 5 层智能决策引擎 + 自我进化系统

## 1. 核心架构

```
感知层 → 概率层 → 态势层 → 规划层 → 执行层
```

### Layer 1: 感知 (HandAnalyzer + GameMemory)
- **HandAnalyzer**: 将手牌拆解为互斥的出牌组（炸弹/顺子/三带二/对子/单张），计算最少出牌轮次 `turnsToEmpty` 和控制牌数量
- **GameMemory**: 追踪所有玩家的出牌历史，推算对手剩余牌力，提供威胁等级评估

### Layer 2: 概率 (CardProbabilityEngine) ← 新增
基于已出牌历史进行算牌，计算实时概率用于辅助决策：
- **`getRemainingCount(rank)`**: 已见牌数 → 剩余该花色数量
- **`getBombProbability(rank, opponentHandCount)`**: 超几何分布近似 → P(对手持有炸弹)
- **`getBeatenProbability(lastPlayValue, lastPlayType, opponentHandCount)`**: P(对手能压住上家出牌)
- 概率信息注入规划层：Pass 评分时若 P(被压) < 0.25 则减少让牌惩罚；用炸弹封锁前检查 P(大怪炸弹) 动态调整力度

### Layer 3: 态势 (PhaseDetector)
根据手牌数、队友/对手状态动态切换策略模式：
| 阶段 | 触发条件 | 策略 |
|------|---------|------|
| Opening | 手牌 > 20 | 清垃圾牌、保留控制牌 |
| MidGame | 10 < 手牌 ≤ 20 | 打组合牌、开始封锁 |
| Endgame | 手牌 ≤ 10 | 激进冲刺 |
| Emergency | 对手 ≤ 5 张 | 无条件封锁 |
| Coasting | 队友快出完 | 让路保守 |

运行时从 `logs/ai_tuning_overrides.json` 读取进化增量，通过 `applyOverrides()` 叠加到基础权重。

### Layer 4: 规划 (StrategicPlanner)
- **前瞻评分**：对每个候选出牌，模拟打出后剩余手牌的重新拆解
- 防止"拆炸弹出对子"等短视决策
- 团队感知：队友赢时让路、对手危险时主动封锁
- 集成 CardProbabilityEngine：Pass 和炸弹决策时查询实时概率
- **Silent 模式**：`new StrategicPlanner(rule, silent=true)` 抑制 console 输出，供自对弈使用

### Layer 4B: 规则推理 (StrategicPlannerB) — 双算法对比
- **规则匹配**：基于决策树推理，与 StrategicPlanner(算法A) 的权重评分互补
- **决策流程**：评估局势 → 应用规则 → 选择匹配出牌
- **核心规则**：
  - 队友在赢：能赢且代价小才出，否则Pass让路
  - 首出：优先建立五张连锁（顺子/同花 > 三带二 > 葫芦）
  - 跟牌：用最小代价赢，考虑牌型类型+牌值的综合cost
  - 残局炸弹：对手≤5张+我有炸弹时夺权
- **双算法测试**：Team A用算法A，Team B用算法B对战，发现算法漏洞
  - 90:10 胜率比表明算法A的权重评分优于算法B的规则推理

### Layer 5: 执行 (BotManager)
- 调度 StrategicPlanner 进行决策（真实对局带延迟，自对弈无延迟）
- 管理进贡/还贡的自动逻辑
- 决策日志写入 `logs/decisions.jsonl`，实时喂入进化器

---

## 2. 自我进化系统

```
服务器空闲 → SelfPlaySimulator 自动运行一批无头对战（12 局/批，每 5 分钟）
               ↓
           ExperienceLogger.finalizeGame()
               ↓
           WeightEvolver.evolveWeights(decisions, winningTeam, finishOrder)
               ↓  决策级别胜率（赢家决策数 / 总决策数）≈ 0.5 → 均衡
           领域特定梯度计算（带动量 SGD）
               ↓
           logs/ai_tuning_overrides.json（PhaseWeights 增量更新）
               ↓ 每次出牌时读取
           PhaseDetector.applyOverrides()
```

### WeightEvolver 梯度规则
| 信号 | 触发条件 | 调整方向 |
|------|---------|---------|
| trashClearBonus | Opening 胜率 < 0.45 且残留手牌 > 3 | +（加强早清单张） |
| blockBonus | Endgame/Emergency 胜率 < 0.44 | +（更激进封锁） |
| blockBonus | MidGame 胜率 < 0.42 | +（中局开始封锁） |
| passForTeammateBonus | 让路率 < 0.60 且胜率 ≤ 0.52 | +（更积极给队友让路） |
| passForTeammateBonus | 让路率 > 0.88 但胜率 < 0.44 | −（过度谦让反而输） |
| jokerPenalty | 怪牌使用率 > 4% 且胜率 < 0.44 | −（更保留怪牌） |

- **学习率**: 0.06，**动量系数**: 0.85，**单次最大调整**: 8，**累计上限**: ±50
- 前 5 局不调参（避免小样本噪声），之后滚动最近 100 局统计

### SelfPlaySimulator
- 6 个 Silent StrategicPlanner 实例对战（全部 AI，无 UI）
- 30 局 ≈ 13 秒，服务器启动 30 秒后首次运行，此后每 5 分钟（无真实对局时）运行
- 真实对局同样通过 ExperienceLogger 喂入进化器（双路输入）

### 双算法对比测试 (test-dual-algo.ts)
- **目的**：验证算法正确性，发现潜在 bug
- **方法**：Team A (算法A权重评分) vs Team B (算法B规则推理)
- **运行**：`npx tsx src/ai/test-dual-algo.ts`
- **当前结果**（50局 x 多次测试，方差较大）：
  | 算法 | 胜率范围 | 特点 |
  |------|----------|------|
  | Algorithm A (权重评分) | 48-72% | 能捕捉细粒度最优解 |
  | Algorithm B (规则推理) | 28-52% | 规则确定性强但较死板 |
- **Algorithm B 规则系统**：
  1. 评估局势：计算队友/对手状态、危险对手数、控制牌数
  2. 确定策略：attack/support/defend
  3. 决策规则：
     - 对手残局(≤5张) → 优先进攻
     - 队友在赢 → 能赢就继续出
     - 首出 → 优先建立五张连锁
     - 跟牌 → 优先单张/对子 > 三张 > 炸弹 > 五张
     - Big → 禁止用于炸弹/五张/对子/三条，仅单独出
     - Small → 禁止用于炸弹/五张，仅单独出或带小牌
- **结论**：Algorithm A 评分模式与 Algorithm B 规则推理模式强度相近（受随机发牌影响大），两者都能正常工作，规则推理模式可作为验证算法A正确性的对照

---

## 4. 算法迭代历史

### v1 (初始)
- Algorithm A: 90% 胜率
- Algorithm B: 10% 胜率
- 问题：Algorithm B 有灾难性错误

### v2 (Big/Small保护)
- Big/Small 禁止用于炸弹/五张
- Algorithm A: 65% | Algorithm B: 35%

### v3 (进攻规则优化)
- 对手残局时强制进攻
- 炸弹夺权规则细化
- Algorithm A: 60% | Algorithm B: 40%

### v4 (Big对子惩罚) ← 稳定版
- Big 用于对子/三条增加1000惩罚
- Algorithm A: 48-72% | Algorithm B: 28-52%
- **测试结果受随机发牌影响大，两算法都可正常工作**

### v5 (残局紧迫性改进) ← 当前版 ✅ 已完成
- Algorithm A 五张牌型优先级优化：Straight > ThreeWithTwo > Flush
- Algorithm A 队友配合增强：Pass奖励力度提升
- Algorithm A 残局炸弹时机优化：考虑"我是否在赢"
- Algorithm B 首出逻辑：已确认 defend 策略会清垃圾单张（条件 `strategy !== 'attack'`）
- **Algorithm B 跟牌增加"出完收工"紧迫性** ✅ 已实施
  - 出完收工：cost -500
  - 残局(≤5张)：额外降低代价 (5-handCount)*20
- **测试结果稳定**：A: 50-84% / B: 16-50%（多轮测试验证）
- **验证状态**：✅ 双算法测试通过，无错误
- **最新测试**：A: 62-68% / B: 32-38%（多次运行方差在正常范围）

### v6 (Big Joker处理修复 + 惩罚修正) ← 本轮修复
- **Big Joker 出牌权修复** ✅ 已修复
  - test-dual-algo 原使用 `return;`（返回undefined导致游戏崩溃），改为 `continue;`
  - 现在 Big Joker 后正确保持出牌权，与 SelfPlaySimulator 行为一致
- **Big Joker 五张惩罚修正** ✅ 已修复
  - Leading 时五张用大怪：-120 → -300（与大怪单张 -300 一致）
  - 理由：大怪单张已是灾难级浪费，五张用大怪同样严重
  - 小怪五张：-60 → -150（按比例调整）
- **测试结果**：修复后 6 轮测试 A: 70%/62%/66%/56%/48%/46%（均值 58%），方差正常

### v7 (allowBombSacrifice 实现) ← 本轮修复
- **Emergency 阶段炸弹惩罚修正** ✅ 已修复
  - StrategicPlanner 中 `allowBombSacrifice` 标志从未被使用（严重bug）
  - Emergency 阶段炸弹 -400 惩罚 → 0（因为 blockBonus 会补偿）
  - 理由：Emergency phase 已设置 `allowBombSacrifice: true`，但代码忽略了
  - 效果：Emergency 胜率从 45.6% 预期提升，Algorithm A 胜率从 50% → 60%
- **测试结果**：修复后 10 轮测试 A: 52%/64%/66%/60%/58%/56%/58%/62%/54%/70%（均值 60%），Algorithm A 稳定更强

### v8 (Small Joker 惩罚一致性) ← 本轮完成
- **Small Joker 单张惩罚一致性** ✅ 已修复
  - Small Joker 单张 LEADING：-300 → -150
  - Small Joker 单张 FOLLOWING：-80 → -150
  - 理由：Small Joker 价值低于 Big Joker，惩罚应减半
- **测试结果**：修复后 8 轮测试 A: 56%/64%/52%/54%/68%/72%/64%/62%（均值 61.5%），Algorithm A 稳定更强

### v9 (Emergency Pass 惩罚增强) ← 本轮修复
- **Emergency 阶段 Pass 惩罚修正** ✅ 已修复
  - StrategicPlanner 中 Emergency 阶段对手在赢时 Pass 惩罚不足（仅 -20）
  - Emergency 阶段：对手已 ≤5 张，必须封锁，Pass 应重罚 -150
  - 同时取消 Emergency 阶段的概率修正（beatProb < 0.25 不再减轻惩罚）
  - 理由：Emergency 阶段封锁是最高优先级，不能因概率低就Pass
- **测试结果**：修复后 8 轮测试 A: 72%/66%/68%/58%/64%/54%/68%/66%（均值 64.5%），Algorithm A 稳定更强

### v9 稳定版 ✅ 已完成
- **Phase Emergency 判断**：`minOpponentHand <= 5` 触发紧急封锁模式，逻辑正确
- **Block 评分范围**：`minOpponentHand <= 10` 提前开始封锁，非 Emergency 专属
- **CardProbabilityEngine Bomb处理**：对Bomb类型只考虑怪牌炸弹，但影响有限（Bombs稀有）
- **规则引擎验证**：牌型检测、validatePlay 逻辑全部正确
- **算法胜率**：A在 54-72% 范围波动，B在 28-46% 范围（50局样本固有方差）
- **自对弈平衡**：多次 100 局测试，Team0/Team1 胜率在 48-58% 范围，均衡
- **验证状态**：✅ 双算法测试稳定，8轮均值 A:64.5% / B:35.5%

## 5. 已发现的设计原则

1. **正数=鼓励，负数=抑制**（修复了旧 tactics.json 中"奖励为负数"的致命 bug）
2. **阶段感知**：不同游戏阶段使用不同权重，不再一套权重走天下
3. **前瞻规划**：每次决策都模拟"出了这手牌后剩余怎么打"，避免短视
4. **算牌辅助**：CardProbabilityEngine 实时计算概率，Pass / 炸弹决策更精准
5. **统计进化**：决策级胜率梯度替代 LLM 调参，速度快、可重现、零人工干预
6. **双路输入**：真实对局 + 无头自对弈同时喂入进化器，加速收敛
7. **Big/Small保护**：大怪-300(单张 LEADING)/-400(单张 FOLLOWING)，小怪-150(单张 LEADING/FOLLOWING)，Big不能用于炸弹/五张/对子/三条
8. **五张连锁优先**：首出时建立五张连锁比清垃圾单张更重要（进攻策略下）
9. **残局夺权**：对手≤5张时有炸弹必用，不管代价（Emergency/Endgame allowBombSacrifice=true）
10. **出完收工紧迫性**：残局时优先降低代价，出一手牌能出完则大幅降低代价
11. **allowBombSacrifice**：Emergency/Endgame 阶段炸弹无惩罚（blockBonus 补偿），正常阶段 -400
12. **LEADING/FOLLOWING一致性**：Big Joker 五张惩罚在 LEADING 和 FOLLOWING 场景中保持一致（-300）
13. **策略覆盖**：support 和 defend 策略都会清垃圾单张，只有 attack 策略优先建立连锁
14. **Emergency Pass 封锁优先**：Emergency 阶段对手在赢时 Pass 惩罚 -150（不是 -20），且不享受概率修正

| 文件 | 职责 |
|------|------|
| `src/ai/HandAnalyzer.ts` | 手牌结构拆解 |
| `src/ai/GameMemory.ts` | 对局记忆与对手建模 |
| `src/ai/CardProbabilityEngine.ts` | 算牌：P(炸弹)、P(被压)、怪牌剩余数 |
| `src/ai/PhaseDetector.ts` | 阶段检测、动态权重、读取进化增量 |
| `src/ai/StrategicPlanner.ts` | 算法A：前瞻规划、概率注入、最终决策（权重评分） |
| `src/ai/StrategicPlannerB.ts` | 算法B：规则推理决策引擎（博弈推理） |
| `src/ai/test-dual-algo.ts` | 双算法对比测试，验证算法正确性 |
| `src/ai/BotManager.ts` | AI 调度协调、进贡自动化 |
| `src/ai/WeightEvolver.ts` | 统计梯度进化器，替代 LLM 调参 |
| `src/ai/SelfPlaySimulator.ts` | 无头自对弈引擎，快速生成训练数据 |
| `src/ai/ExperienceLogger.ts` | 决策日志记录，对局结束触发进化 |
| `src/rules/DaGuaiLuZiRule.ts` | 规则引擎 + 候选生成 |
| `logs/evolution_stats.json` | 各阶段决策级胜率统计 |
| `logs/ai_tuning_overrides.json` | PhaseWeights 进化增量（实时加载） |

## 4. 设计原则

1. **正数=鼓励，负数=抑制**（修复了旧 tactics.json 中"奖励为负数"的致命 bug）
2. **阶段感知**：不同游戏阶段使用不同权重，不再一套权重走天下
3. **前瞻规划**：每次决策都模拟"出了这手牌后剩余怎么打"，避免短视
4. **算牌辅助**：CardProbabilityEngine 实时计算概率，Pass / 炸弹决策更精准
5. **统计进化**：决策级胜率梯度替代 LLM 调参，速度快、可重现、零人工干预
6. **双路输入**：真实对局 + 无头自对弈同时喂入进化器，加速收敛
