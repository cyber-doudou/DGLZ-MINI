# 大怪路子微信小游戏

基于"大怪路子"玩法的微信小游戏，继承原版完整游戏规则和 AI 算法。

## 项目结构

```
wechat-miniprogram/
├── game.js                      # 游戏入口 (Canvas渲染)
├── game.json                    # 游戏配置
├── utils/
│   ├── game/
│   │   ├── types.js            # 类型定义
│   │   ├── constants.js        # 游戏常量
│   │   ├── DaGuaiLuZiRule.js  # 规则引擎
│   │   └── GameEngine.js      # 游戏状态管理
│   └── ai/
│       ├── AIService.js              # AI 服务接口
│       ├── StrategicPlanner.js        # AI 决策引擎
│       ├── HandAnalyzer.js           # 手牌分析
│       ├── PhaseDetector.js          # 阶段检测
│       ├── CardProbabilityEngine.js   # 概率计算
│       ├── GameMemory.js             # 记忆系统
│       ├── CardTypeTracker.js        # 出牌追踪
│       ├── PrePlayAnalyzer.js        # 出牌前分析
│       └── EndgameCalculator.js      # 残局计算
└── pages/                      # 页面文件 (已停用，保留备用)
```

## 已实现功能

- ✅ 完整游戏规则引擎（单张、对子、三张、顺子、同花、俘虏、四带一、同花顺、炸弹）
- ✅ 完整 AI 系统（StrategicPlanner 决策引擎 + 7 个子模块）
- ✅ 回合管理和游戏流程
- ✅ 纯 Canvas 渲染（无需 WXML/WXSS）
- ✅ 单机 AI 对战模式

## 待开发功能

- [ ] 进贡/还贡流程
- [ ] 多人 WebSocket 对战
- [ ] 好友房间系统
- [ ] 排行榜系统
- [ ] UI 界面美化

## 运行方式

1. 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开项目文件夹 `wechat-miniprogram`
3. AppID 已配置: `wx7f2e2eb8d1370021`
4. 点击"真机调试"或"模拟器"预览

## 测试状态

- ✅ 100局自对战胜率: 55%/45%（公平）
- ✅ Node.js 完整流程测试通过
- ✅ AI 决策模块测试通过
- ✅ 微信开发者工具预览构建成功 (130.2 KB)

## 本地测试

### 1. Node.js 游戏逻辑测试

在微信开发者工具中预览前，可以先用 Node.js 测试游戏逻辑：

```bash
# 运行游戏逻辑测试
node test-game.js
```

### 2. 微信开发者工具预览

通过脚本打开微信开发者工具并预览项目：

```bash
# 运行预览脚本
node preview-game.js
```

这会自动：
1. 检查项目文件完整性
2. 调用微信开发者工具 CLI
3. 显示开发者工具进程状态

**注意**: CLI 命令会启动微信开发者工具 GUI，预览结果需要在开发者工具中查看。

### 预期输出 (test-game.js)

```
==================================================
大怪路子游戏逻辑测试
==================================================

[1] 测试游戏引擎初始化...
  ✓ 游戏引擎创建成功

[2] 测试开始游戏...
  ✓ 游戏开始，我的ID: player-0
  ✓ 初始手牌: 27 张

[3] 测试 AI 决策...
  player-1: 27张牌 -> FullHouse (5张)
  ...

[4] 测试完整游戏流程...
  ✓ 游戏结束! 共 XXX 回合
  ✓ 获胜队伍: 队伍X

[5] 测试再来一局...
  ✓ 新游戏开始，手牌: 27 张

所有测试通过!
```

## 常见问题排查

### MiniProgramError: Cannot read properties of undefined (reading 'getSystemNanoTime')

这是微信小游戏 SDK 在开发者工具中初始化时机问题。游戏代码已使用默认值作为降级方案。如果仍有问题：

1. 确保微信开发者工具是最新版本
2. 清除开发者工具缓存：设置 -> 基础设置 -> 清除缓存 -> 清除全部
3. 重新打开项目

### 游戏卡住不动

1. 打开调试器的 Console 面板
2. 查看是否有错误日志
3. 运行 `node test-game.js` 验证游戏逻辑是否正常

## CLI 命令

```bash
# 打开项目 (需要先安装微信开发者工具 CLI)
cli.bat open --project "D:/Site/DGLZ/wechat-miniprogram"

# 预览
cli.bat preview --project "D:/Site/DGLZ/wechat-miniprogram"

# 上传
cli.bat upload --project "D:/Site/DGLZ/wechat-miniprogram" --appid wx7f2e2eb8d1370021
```

> **注意**: CLI 命令需要微信开发者工具支持。部分版本需要开启 CLI 调用功能：设置 -> 安全设置 -> 开启服务端口

## 游戏规则

- 3 副牌共 162 张
- 6 名玩家分两组对战
- 取得进贡权利、出完牌获胜

### 牌型大小

```
炸弹 > 同花顺 > 四带一 > 俘虏 > 同花 > 顺子
```

### 特殊规则

- 大怪单独出可重置牌权
- 炸弹可压任何五张牌型
- 级牌在当局作为最大牌

## 技术栈

- 微信小游戏 (Canvas 渲染)
- JavaScript ES6+
- 原生游戏引擎

## 参考资料

- [微信小游戏官方文档](https://developers.weixin.qq.com/minigame/dev/)
- 原版游戏仓库：DGLZ/
