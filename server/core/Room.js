class Room {
    constructor(roomId, ruleId, hostUser) {
      this.roomId = roomId;
      this.ruleId = ruleId; // 游戏规则标识，如 'rps'
      this.hostId = hostUser.uuid; // 房主 ID
      this.status = 'WAITING'; // WAITING, GAMING, FINISHED
     
      // 座位信息：固定 4 个位置（兼容日麻），存储格式 [UserObj, UserObj, ...]
      // 没人的位置为 null
      this.seats = [null, null, null, null];
     
      // 玩家准备状态 { uuid: boolean }
      this.readyStatus = {};
     
      // 游戏逻辑实例 (开始后注入)
      this.gameInstance = null;
     
      // 自动将房主加入 0 号位
      this.addPlayer({ user: hostUser });

      this.destructionTimer = null;
    }
 
    // 开启销毁倒计时
    startDestructionTimer(callback) {
        if (this.destructionTimer) return;
        console.log(`[Room ${this.roomId}] 房间已空，5分钟后自动清理...`);
        this.destructionTimer = setTimeout(() => {
        callback(this.roomId);
        }, 5 * 60 * 1000); // 5分钟
    }

    checkHost(uuid) {
      return this.hostId === uuid;
    }

    // 停止销毁倒计时
    stopDestructionTimer() {
        if (this.destructionTimer) {
        console.log(`[Room ${this.roomId}] 玩家回归，取消清理。`);
        clearTimeout(this.destructionTimer);
        this.destructionTimer = null;
        }
    }

    // 通用分发器：根据函数名调用内部方法
    dispatch(action, data) {
        if (typeof this[action] === 'function') {
        return this[action](data);
        }
        return { success: false, msg: `未知操作: ${action}` };
    }

    addPlayer({ user }) {
      // 1. 统一标识符
      const requestUuid = user.uuid;

      // 2. 幂等性校验（解决同账号多开/刷新重连）
      // 只要 this.seats[0] 里的 uuid 还是账号A，账号A重连进来时会匹配到这里
      const existingIndex = this.seats.findIndex(s => s && s.uuid === requestUuid);
      if (existingIndex !== -1) {
        return { 
          success: true, 
          seatIndex: existingIndex, 
          msg: "欢迎回来" 
        };
      }

      // 3. 寻找真正的物理空位 (null)
      // 这里保证了账号B不会坐到账号A的位置上，因为 A 还没被“清理”
      const firstEmptyIndex = this.seats.findIndex(s => s === null);

      // 4. 满员检查
      if (firstEmptyIndex === -1) {
        return { success: false, msg: "列车满员，请等待下一班" };
      }

      // 5. 坐下
      this.seats[firstEmptyIndex] = {
        uuid: requestUuid,
        username: user.username,
        avatar: user.current_avatar,
        role: user.role,
        joinedAt: Date.now() 
      };

      // 6. 状态同步
      this.readyStatus[requestUuid] = false;

      return { 
        success: true, 
        seatIndex: firstEmptyIndex 
      };
    }
    // 换座逻辑
    changeSeat({ uuid, newSeatIndex }) {
        if (this.seats[newSeatIndex] !== null) return { success: false, msg: "目标位置非空" };
        const oldIndex = this.seats.findIndex(s => s && s.uuid === uuid);
        if (oldIndex === -1) return { success: false, msg: "未在房间内找到该用户" };
       
        this.seats[newSeatIndex] = this.seats[oldIndex];
        this.seats[oldIndex] = null;
        return { success: true };
    }

    // 离开玩家
    removePlayer({ uuid }) {
        const index = this.seats.findIndex(s => s && s.uuid === uuid);
        if (index !== -1) {
        this.seats[index] = null;
        delete this.readyStatus[uuid];
        return { success: true, isEmpty: this.seats.every(s => s === null) };
        }
        return { success: false };
    }

    // 准备/取消准备
    toggleReady({ uuid }) {
      // 1. 房主不需要准备逻辑（对应我们选定的方案 3）
      if (uuid === this.hostId) {
        return { success: false, msg: "列车长无需准备，请直接发车" };
      }
    
      // 2. 正常切换准备状态
      this.readyStatus[uuid] = !this.readyStatus[uuid];
      
      // 3. 返回 success 告知 action 处理器进行广播
      return { 
        success: true, 
        isReady: this.readyStatus[uuid] 
      };
    }
 
// 修改房间配置（名、游戏、人数上限等）
updateConfig({ uuid, config }) {
  if (!this.checkHost(uuid)) return { success: false, msg: "只有列车长有权调整配置" };
  if (this.status !== 'WAITING') return { success: false, msg: "列车已发车，无法调整配置" };
  
  if (config.ruleId) this.ruleId = config.ruleId;
  if (config.maxSeats) {
      // 调整座位数组大小，需确保缩减时不把正在坐着的人踢了
      const currentPlayers = this.seats.filter(s => s !== null).length;
      if (config.maxSeats < currentPlayers) return { success: false, msg: "当前乘客多于目标座位数" };
      
      const newSeats = new Array(config.maxSeats).fill(null);
      let pIndex = 0;
      this.seats.forEach(s => {
          if (s) newSeats[pIndex++] = s;
      });
      this.seats = newSeats;
  }
  return { success: true };
}

  // 踢出玩家
  kickPlayer({ uuid, targetUuid }) {
    if (!this.checkHost(uuid)) return { success: false, msg: "只有列车长能赶人走" };
    if (targetUuid === this.hostId) return { success: false, msg: "不能踢出你自己" };
    return this.removePlayer({ uuid: targetUuid });
  }

  // 转让房主
  transferHost({ uuid, targetUuid }) {
    if (!this.checkHost(uuid)) return { success: false, msg: "只有现任列车长可以转让权限" };
    const isPresent = this.seats.some(s => s && s.uuid === targetUuid);
    if (!isPresent) return { success: false, msg: "目标玩家不在车厢内" };
    
    this.hostId = targetUuid;
    return { success: true };
  }

  // 强制关闭房间
  closeRoom({ uuid }) {
    if (!this.checkHost(uuid)) return { success: false, msg: "无权关闭" };
    this.stopDestructionTimer(); // 既然都要删了，把定时器也关掉
    this.seats = this.seats.map(() => null); // 清空所有人
    return { success: true, isEmpty: true, msg: "房间已解散" };
  }

  // 开始游戏
  startGame({ uuid }) {
    return { success: false, msg: "游戏逻辑还没写好，敬请期待！" };
    if (!this.checkHost(uuid)) return { success: false, msg: "只有列车长可以发车" };
    
    const playerIds = this.seats.filter(s => s !== null).map(s => s.uuid);

    // 检查是否全员准备
    const allReady = playerIds.every(id => id === this.hostId || this.readyStatus[id]);
    if (!allReady) return { success: false, msg: "仍有乘客未准备就绪" };

    this.status = 'GAMING';
    // 之后在这里 new 具体的游戏逻辑类
    // this.gameInstance = new (getGameClass(this.ruleId))(this);
    
    return { success: true };
  }

  // 结束游戏
  endGame() {
    this.status = 'FINISHED';
    // 延迟一段时间自动切回 WAITING 供再开一局，或者保持 FINISHED 等待房主重置
    return { success: true };
  }

    // 序列化房间信息（发给前端用）
    serialize() {
      return {
        roomId: this.roomId,
        ruleId: this.ruleId,
        hostId: this.hostId,
        status: this.status,
        seats: this.seats,
        readyStatus: this.readyStatus
      };
    }
  }
 
  module.exports = Room;