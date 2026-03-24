---
title: 🎮 虹月台 · 游戏模块开发 API 规范（v1.0试运行）
---

## 1. 概述

本规范定义了“虹月台”平台中游戏模块的开发标准。
开发者通过实现 **配置文件 + 逻辑模块 + 视图组件**，即可将游戏接入平台运行。

---

## 2. 目录结构

每个游戏必须位于：

```text
/game-scripts/[ruleId]/
```

目录结构如下：

```text
config.json     // 游戏元信息（必需）
logic.js        // 后端逻辑（必需）
view.jsx        // 前端视图（必需）
```

---

## 3. 运行模型

---

### 3.1 生命周期

```text
WAITING → PLAYING → FINISHED → WAITING
```

| 状态       | 描述         |
| -------- | ---------- |
| WAITING  | 等待玩家进入与准备  |
| PLAYING  | 游戏进行中      |
| FINISHED | 游戏结束（展示结果，10秒后自动返回WAITING） |

---

### 3.2 状态更新流程

房间初始化时遵循以下流程：
```text
服务端读取文件并实例化 logic 类（new LogicClass(room)）
→ 服务端调用logic.setup()
→ 服务端将logic.setup()返回结果存入gameState变量中。
```

每一次玩家操作遵循以下流程：

```text
前端提供 onAction触发按钮
→ 客户端调用 onAction(action, data)
→ 服务端接收
→ 调用 logic.onAction(state, context)
→ 更新 gameState并返回给room
→ room 同步触发 （logic异步触发） broadcastState() 
→ 调用 logic.filter(state, uuid)
→ 下发给对应玩家
→ 前端重新渲染
```

---

## 4. config.json 规范

---

### 4.1 必填字段

```json
{
  "id": "string",          
  "name": "string",        
  "version": "string",     
  "minPlayers": number,    
  "maxPlayers": number,    
  "description": "string"  
}
```

---

### 4.2 约束

* `id` 必须与目录名一致
* `minPlayers <= maxPlayers`
* `maxPlayers` 不得超过房间最大座位数

---

## 5. gameState 规范

---

### 5.1 基本定义

`gameState` 是整个游戏的唯一状态源。

`gameState` 在以下情况下为 null：

- 游戏未开始（WAITING）或在setup以前
- 游戏结束后10秒清理完成

---

### 5.2 强制约束

- 必须为 Plain Object（可 JSON 序列化）
- 不可以包含函数 / class / undefined
- 仅由 setup / onAction 修改


---

### 5.3 参考基础结构

```js
{
  phase: <游戏状态>,
  turn: number,
  players: {
    [uuid]: {
      // 玩家数据
    }
  }
}
```

---

## 6. logic.js 规范

---

### 6.1 导出要求

```js
const BaseGame = require('../BaseGame');

module.exports = class GameLogic extends BaseGame {}
```

- 必须继承 BaseGame
- 必须实现：
  - setup()
  - onAction()
- filter() 为可选
- 该类的构造函数自动存入this.room，关于this.room的调用详见6.6章节。

---

## 6.2 setup()

```js
setup() => gameState
```

---

### 约束

```md
- 必须返回完整初始状态
- 必须同步执行（不可 async）
```

---

## 6.3 onAction(state, context)

```js
onAction(state, {
  action: string,
  data: any,
  uuid: string
}) => state
```

---

### 执行规则

```md
- state 为当前游戏状态（引用）
- 允许直接修改 state
- 返回值规则：
  - 若返回对象 → 使用返回值覆盖 state （建议）
  - 若返回 undefined → 使用已被修改的 state
```

---

### 必须实现

```md
- 权限校验（uuid 是否可执行 action）
- action 分发
- 状态更新
- 胜负判断（必要时调用 endGame）
```

---

### 示例

```js
onAction(state, { action, data, uuid }) {
  if (action === 'move') {
    if (state.currentPlayer !== uuid) return;

    state.position[uuid] += data.step;

    if (state.position[uuid] >= 10) {
      this.room.endGame({ winner: uuid });
    }
  }

  return state;
}
```

---

## 6.4 异步规则

---

### ❗默认行为

```md
- onAction 为同步执行
- 不存在并发调用
```

---

### ❗如果使用异步

必须手动触发广播：

```js
setTimeout(() => {
  state.phase = 'NEXT';
  this.room.broadcastState();
}, 2000);
```

---

## 6.5 filter(fullState, targetUuid)

```js
filter(fullState, targetUuid) => clientState
```

---

### 约束

- 应当返回新对象（即深拷贝副本，推荐）
- 禁止修改 fullState
- 允许直接返回 fullState（仅当确认不会修改时）


---

### 示例

```js
filter(state, uuid) {
  const cloned = JSON.parse(JSON.stringify(state));

  for (const id in cloned.players) {
    if (id !== uuid) {
      cloned.players[id].hand = null;
    }
  }

  return cloned;
}
```

---

### 默认行为

```md
- 若未实现 filter，则系统会直接下发完整 state
- ⚠️ 仅适用于非对抗类游戏
- ⚠️ 对抗类游戏（如卡牌、身份、策略）必须实现 filter，否则会造成信息泄露
```

---


## 6.6 可调用 API（Room 接口）

---

### 📌 可访问属性（只读）

开发者可以在 `logic.js` 中通过 `this.room` 访问以下字段：

```js
this.room.roomId       // 房间ID
this.room.ruleId       // 当前游戏规则ID
this.room.meta         // 游戏配置（config.json内容）
this.room.hostId       // 房主 uuid
this.room.status       // WAITING | PLAYING | FINISHED

this.room.seats        // 座位数组（核心）
this.room.readyStatus  // 准备状态 map

this.room.gameState    // 当前全量状态（⚠️只读）
```

---

### 📌 seats 数据结构

```js
[
  {
    uuid: string,
    username: string,
    avatar: string,
    role: string,
    joinedAt: number
  } | null
]
```

---

### ⚠️ seats 使用约束

```md
- seats 为“玩家座位列表”
- 顺序代表座位顺序
- 可能包含 null（空位）
- 不保证连续
```

---

### 📌 常用访问示例

```js
// 所有在场玩家
const players = this.room.seats.filter(s => s !== null);

// 获取玩家 uuid 列表
const ids = players.map(p => p.uuid);

// 判断是否房主
const isHost = uuid === this.room.hostId;
```

---

### 🎮 可调用方法

---

#### 1️⃣ 结束游戏

```js
this.room.endGame(results)
```

---

#### 行为

```md
- 房间状态 → FINISHED
- 自动写入 state.finalResults
- 自动广播
- 10秒后清理 gameState 并回到 WAITING
```

---

#### 2️⃣ 主动广播状态

```js
this.room.broadcastState()
```

---

##### 触发时机

仅在以下情况需要手动调用：

```md
- setTimeout / Promise / async 回调中修改 state
- 需要中间态即时同步（例如 REVEAL 阶段）
```

---

#### ⚠️ 自动广播机制（重要）

```md
- onAction 执行结束后 → 系统自动广播
- 无需手动调用 broadcastState
```

---

### 🚫 禁止行为（强约束）

```md
禁止直接修改以下字段：

- this.room.seats
- this.room.readyStatus
- this.room.status
- this.room.gameState
- this.room.gameInstance

原因：
这些字段属于房间控制层，修改会破坏系统一致性
```

---

### ⚠️ 高级说明（允许但需谨慎）

```md
可以读取但不建议依赖：

- this.room.meta（读取游戏元信息，即同目录meta.json）
- this.room.readyStatus
```

---

## 7. view.jsx 规范

---

### 7.1 组件定义

该组件会被前端抓取并自动用于浏览器渲染，其返回值为渲染内容。

```js
export default function GameView(props) {}
```

---

### 7.2 Props 定义

```js
{
  gameState: Object | null,
  players: Array<Player | null>,
  myUuid: string,
  onAction: (action: string, data?: any) => void
}
```

- players 为“座位数组”，长度固定
- 数组元素可能为 null（表示空位）
- 数组顺序代表座位顺序（不可打乱）

---

### 7.3 players 结构

```js
{
  uuid: string,
  username: string,
  avatar: string
}
```

**访问头像使用`/avatar/player.avatar.png`**

---

### 7.4 必须实现

```md
- 必须处理 gameState 为 null 的情况
- 仅通过 Props 渲染（禁止本地状态作为数据源）
- 必须使用 onAction 与后端交互
```

---

### 示例

```jsx
export default function GameView({ gameState, myUuid, onAction }) {
  if (!gameState) return null;

  return (
    <div>
      <h1>{gameState.count}</h1>
      <button onClick={() => onAction('inc', {})}>
        +1
      </button>
    </div>
  );
}
```

---

## 8. Action 规范

---

### 8.1 定义

```md
- action 为字符串
- 由前端发起，与 logic.onAction 对应
```

---

### 8.2 示例

```js
onAction('attack', { target: 'uuid123' })
```

---

## 9. 游戏结束机制

---

### 9.1 触发

```js
this.room.endGame(results)
```

---

### 9.2 行为

```text
状态 → FINISHED
广播最终状态（包含 finalResults）

注意：
- FINISHED 阶段仍会下发 gameState，此阶段view的渲染功能仍然生效。
- 前端可通过 state.finalResults 判断结果

10秒后：
  清空 gameState
  状态 → WAITING
```

---

### 9.3 结果数据

```js
state.finalResults = results
```


**自动触发，前端可以通过查询state.finalResults是否为空判断游戏是否结束**

---

## 10. 实现示例

参见`game-scripts\rps`