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
      this.addPlayer(hostUser, 0);

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

    addPlayer(input) {
      // 1. 统一标识符
      const user = input.user ? input.user : input; // 兼容直接传 User 对象或 { user: User } 的情况
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
    removePlayer(uuid) {
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
      this.readyStatus[uuid] = !this.readyStatus[uuid];
      return this.readyStatus[uuid];
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