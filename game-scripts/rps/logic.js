const BaseGame = require('../BaseGame');

class RPSLogic  extends BaseGame {
  // 初始化全量状态
  setup() {
    return {
      phase: 'PLAYING', // PLAYING, REVEAL
      playerChoices: {}, // { uuid: 'rock' | 'paper' | 'scissors' }
      losers: [],        // 已落败的玩家 UUID 列表
      lastRoundResult: null, // 上一轮描述
    };
  }

    // 核心：过滤状态（处理“不同人看不同内容”）
    filter(fullState, targetUuid) {
        // 1. 深度克隆，防止修改原始 state
        const view = JSON.parse(JSON.stringify(fullState));
        
        // 2. 兜底：确保基础字段永远存在，防止前端 includes 报错
        view.losers = view.losers || [];
        view.playerChoices = view.playerChoices || {};
        view.phase = view.phase || 'PLAYING';

        // 3. 脱敏逻辑
        if (view.phase === 'PLAYING') {
        Object.keys(view.playerChoices).forEach(uuid => {
            if (uuid !== targetUuid) {
            // 关键点：如果对方选了，显示 'WAITING' 字符串；没选则为 null
            // 这样前端渲染时，choice 变量就有值了，能触发“已准备”状态
            view.playerChoices[uuid] = view.playerChoices[uuid] ? 'WAITING' : null;
            }
        });
        }
    
    return view;
  }

  // 处理操作
  onAction(state, { action, data, uuid }) {
    if (state.losers.includes(uuid)) return state; // 落败者无法操作

    if (action === 'cast' && state.phase === 'PLAYING') {
      state.playerChoices[uuid] = data.choice;

      // 检查当前还活着的玩家是否都选好了
      const alivePlayers = this.room.seats
        .filter(s => s !== null && !state.losers.includes(s.uuid));
      
      const allReady = alivePlayers.every(p => state.playerChoices[p.uuid]);

      if (allReady) {
        state.phase = 'REVEAL';
        // 这里的逻辑可以外挂 Python 处理状态推理
        this.calculateRound(state, alivePlayers);
      }
    }
    return state;
  }

  calculateRound(state, alivePlayers) {
    const choices = alivePlayers.map(p => state.playerChoices[p.uuid]);
    const uniqueChoices = [...new Set(choices)];

    // 只有两种手势时才产生胜负
    if (uniqueChoices.length === 2) {
      const winnerType = this.getWinnerType(uniqueChoices[0], uniqueChoices[1]);
      alivePlayers.forEach(p => {
        if (state.playerChoices[p.uuid] !== winnerType) {
          state.losers.push(p.uuid);
        }
      });
      state.lastRoundResult = "分出胜负，落败者离场";
    } else {
      state.lastRoundResult = "平局或产生制衡，本轮重开";
    }

    // 检查是否只剩最后一人
    const remaining = alivePlayers.filter(p => !state.losers.includes(p.uuid));
    
    setTimeout(() => {
      if (remaining.length === 1) {
        // 游戏结束指令：调用 Room 的接口
        this.room.endGame({ winner: remaining[0].uuid });
      } else {
        // 重置下一轮
        state.phase = 'PLAYING';
        state.playerChoices = {};
        state.lastRoundResult = "新的一轮开始了";
        this.room.broadcastState(); // 强制同步
      }
    }, 5000);
  }

  getWinnerType(a, b) {
    const rules = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
    return rules[a] === b ? a : b;
  }
}

module.exports = RPSLogic;