// === 数据库和变量初始化 ===

const Database = require("better-sqlite3");
const db = new Database('database.db');
const { v4: uuidv4 } = require('uuid');
const Room = require("../core/Room");

// 内存存储：存储所有活跃房间实例
let rooms = {};
let userRoomMap = {};
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE, -- 9位数字账号
    username TEXT UNIQUE,
    password_hash TEXT, -- 存储密码
    role TEXT DEFAULT 'guest',
    profile TEXT DEFAULT '这个访客很懒，什么都没写。',
    current_avatar TEXT DEFAULT 'default',
    unlocked_avatars TEXT DEFAULT '["default"]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expired_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id INTEGER,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const adminExists = db.prepare("SELECT id FROM users WHERE uuid = ?").get("1");
if (!adminExists) {
  const foreverDate = "2099-12-31T23:59:59.000Z";
  db.prepare(`
    INSERT INTO users (
      uuid,
      username,
      password_hash,
      role,
      profile,
      current_avatar,
      unlocked_avatars,
      expired_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "1",                     // UUID
    "萤草",                   // 昵称
    "admin",                  // 密码
    "admin",                  // 角色
    "天境列车首席管理员。",      // 简介
    "YingCao",                // 默认头像
    JSON.stringify(["default", "YingCao"]), // 可选头像列表
    foreverDate                               // expired_at
  );
  console.log("[Database] 管理员账户 '萤草' 初始化烧录成功");
}

// == 自动清理过期账户逻辑 ==

// 自动清理：这是一个后台静默任务
// 使用位置：服务器启动时，以及每隔24小时触发。
function cleanupExpiredUsers() {
  try {
    // 1. 先删除过期用户的 Session
    db.prepare(`
      DELETE FROM sessions
      WHERE user_id IN (SELECT id FROM users WHERE expired_at IS NOT NULL AND expired_at < CURRENT_TIMESTAMP)
    `).run();
    // 2. 删除不活跃超过 30 天的 Session (保持数据库整洁)
    db.prepare(`
      DELETE FROM sessions 
      WHERE last_active < datetime('now', '-30 days')
    `).run();
    // 3. 删除过期用户
    const info = db.prepare(`
      DELETE FROM users
      WHERE expired_at IS NOT NULL AND expired_at < CURRENT_TIMESTAMP
    `).run();
    if (info.changes > 0) {
      console.log(`[Database] 自动清理完成，清除了 ${info.changes} 个过期账户`);
    }
  } catch (err) {
    console.error("[Database] 清理过期账户失败:", err);
  }
}
// 启动时立即清理一次
cleanupExpiredUsers();
// 每隔 24 小时执行一次清理
setInterval(cleanupExpiredUsers, 24 * 60 * 60 * 1000);

// 辅助函数：生成不重复的9位数字ID
function generateShortId() {
  while (true) {
    const id = Math.floor(100000000 + Math.random() * 900000000).toString();
    const exists = db.prepare("SELECT id FROM users WHERE uuid = ?").get(id);
    if (!exists) return id;
  }
}

// 辅助函数：生成简易随机密码
function generateRandomPwd() {
  return Math.random().toString(36).slice(-6); // 6位随机字符
}

let globalState = {
  onlineUsers: {} // 存储格式：{ socketId: { username: '...', avatar: '...' } }
};

// 辅助函数：广播最新在线列表
function broadcastOnlineList(io) {
  // 1. 获取所有原始的 socket 连接数据
  const rawList = Object.values(globalState.onlineUsers);

  // 2. 使用 Map 按 uuid 进行去重
  // Map 的特性是 key 唯一，后加入的相同 uuid 会覆盖前者，从而实现去重
  const uniqueUserMap = new Map();

  rawList.forEach(user => {
    // 只有已登录（拥有 uuid）的用户才参与去重，访客如果没有 uuid 可以根据需求处理
    if (user.uuid) {
      uniqueUserMap.set(user.uuid, user);
    } else if (user.socketId) {
      // 如果是完全没登录的临时访客，可以按 socketId 保留（或者根据你的逻辑隐藏）
      uniqueUserMap.set(user.socketId, user);
    }
  });

  // 3. 将 Map 转回数组
  const uniqueList = Array.from(uniqueUserMap.values());

  // 4. 发送去重后的结果
  io.emit("update-online-list", {
    count: uniqueList.length, // 现在的人数是去重后的“真实人数”
    users: uniqueList
  });
}

// 辅助函数：校验身份合法性（单开校验核心）
function checkAuth(socket, sessionId, uuid) {
  const user = db.prepare(`
    SELECT users.* FROM sessions
    JOIN users ON sessions.user_id = users.id 
    WHERE sessions.session_id = ? AND users.uuid = ?
  `).get(sessionId, uuid);

  if (!user) {
    socket.emit("op-feedback", { type: 'error', message: '登录已失效或身份不匹配，请不要同时出示两个车票喵' });
    socket.emit("force-logout"); // 通知前端强制回到登录页
    return null;
  }
  return user;
}

module.exports = function(io) {
  io.on("connection", (socket) => {
    // 初始标记为访客
    globalState.onlineUsers[socket.id] = {
      username: "未登录访客",
      avatar: "default",
      isGuest: true
    };
    broadcastOnlineList(io);
  /**
   * socket.on("auth-request", ...)
   * 性质：核心入口接口
   * 触发逻辑：前端 App.js 或登录组件挂载时，尝试读取本地 localStorage 的 sessionId 发起请求。
   * 处理流程：
   * 1. Session 校验：如果带了 sessionId，去数据库查有没有对应的 user。
   * 2. 凭证登录：如果没有 Session，看有没有传账号密码（loginData）。
   * 3. 游客创建：如果前两者都没有，且 createNewGuest 为 true，则新建一个临时号。
   * 关键点：
   * - 登录成功会触发 socket.join(`room-${rId}`)，让用户回到之前的 Socket 房间频道。
   * - 接口对齐：前端监听 "auth-success"（跳转首页）或 "op-feedback"（报错）。
   */

    socket.on("auth-request", ({ sessionId, createNewGuest, loginData }) => {
      let user = null;

      // 1. Session 自动登录
      if (sessionId) {
        user = db.prepare(`
          SELECT users.*, sessions.session_id FROM sessions
          JOIN users ON sessions.user_id = users.id WHERE sessions.session_id = ?
        `).get(sessionId);
       
        if (user && (!user.expired_at || new Date(user.expired_at) > new Date())) {
          db.prepare("UPDATE sessions SET last_active = CURRENT_TIMESTAMP WHERE session_id = ?").run(sessionId);
        } else { user = null; }
      }

      // 2. 凭证登录 (UUID + Password)
      if (!user && loginData) {
        const foundUser = db.prepare("SELECT * FROM users WHERE uuid = ? AND password_hash = ?").get(loginData.uuid, loginData.password);
       
        if (foundUser) {
          // 验证是否过期
          const isExpired = foundUser.expired_at && new Date(foundUser.expired_at) < new Date();
          if (isExpired) {
            return socket.emit("op-feedback", { type: 'error', message: '该临时账户已到期销毁' });
          }
         
          user = foundUser;
          const newSessionId = uuidv4();
          db.prepare("INSERT INTO sessions (session_id, user_id) VALUES (?, ?)").run(newSessionId, user.id);
          user.session_id = newSessionId;
          const currentRoomId = userRoomMap[user.uuid];
          if (currentRoomId) {
            socket.currentRoomId = currentRoomId; // 自动绑定
            socket.emit("rejoin-suggestion", { roomId: currentRoomId });
          }
        } else {
          return socket.emit("op-feedback", { type: 'error', message: 'UUID 或密码错误' });
        }
      }

      // 3. 创建临时账户
      if (!user && createNewGuest) {
        const uuid = generateShortId();
        const pwd = generateRandomPwd();
        const tempName = `Guest_${Math.floor(Math.random() * 8999 + 1000)}`;
        const expireDate = new Date();
        expireDate.setHours(expireDate.getHours() + 72);

        const info = db.prepare("INSERT INTO users (uuid, password_hash, username, role, expired_at) VALUES (?, ?, ?, 'guest', ?)").run(uuid, pwd, tempName, expireDate.toISOString());
        const newSessionId = uuidv4();
        db.prepare("INSERT INTO sessions (session_id, user_id) VALUES (?, ?)").run(newSessionId, info.lastInsertRowid);
       
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
        user.session_id = newSessionId;
        // 特殊：创建成功返回明文密码供前端显示
        socket.emit("new-account-created", { uuid: user.uuid, password: pwd });
      }

      if (user) {
        const rId = userRoomMap[user.uuid];
        if (rId) {
            socket.currentRoomId = rId; // 将房间号绑定到当前 socket 实例
            socket.join(`room-${rId}`);
        }
        socket.emit("auth-success", {
          uuid: user.uuid,
          username: user.username,
          role: user.role,
          sessionId: user.session_id,
          profile: user.profile,
          currentAvatar: user.current_avatar,
          unlockedAvatars: JSON.parse(user.unlocked_avatars),
          expiredAt: user.expired_at,
          myRoomId: rId || null 
        });
        globalState.onlineUsers[socket.id] = {
          socketId: socket.id, // 必须存这个，作为兜底 key
          uuid: user.uuid,     // 必须存这个，作为去重 key
          username: user.username,
          avatar: user.current_avatar,
          isGuest: false
        };
        broadcastOnlineList(io);
        socket.emit("op-feedback", { type: 'success', message: '登录成功' });
      } else {
        socket.emit("auth-none");
      }
    });
    socket.on("logout", (sessionId) => {
      if (sessionId) {
        db.prepare("DELETE FROM sessions WHERE session_id = ?").run(sessionId);
        // ✅ 新增：恢复为访客身份
        globalState.onlineUsers[socket.id] = { username: "未登录访客", avatar: "default", isGuest: true };
        broadcastOnlineList(io);
        socket.emit("logout-confirm");
        socket.emit("op-feedback", { type: 'success', message: '已安全退出' });
      }
    });
    // --- 3. 资料编辑接口 (支持简介和昵称) ---
    socket.on("update-profile", ({ sessionId, uuid, field, value }) => {
      const session = db.prepare("SELECT user_id FROM sessions WHERE session_id = ?").get(sessionId);
      if (!session) return socket.emit("op-feedback", { type: 'error', message: '未授权' });
      const user = checkAuth(socket, sessionId, uuid);
      if (!user) return; // 已在 checkAuth 内部处理反馈

      if (field === "profile") {
        if (value.length > 400) return socket.emit("op-feedback", { type: 'error', message: '简介字数超限' });
        db.prepare("UPDATE users SET profile = ? WHERE id = ?").run(value, session.user_id);
        socket.emit("update-success", { field: "profile", value: value });
      }

      if (field === "username") {
        const trimmedName = value.trim();
        if (trimmedName.length < 2 || trimmedName.length > 20) return socket.emit("op-feedback", { type: 'error', message: '昵称长度需在2-20字之间' });
        try {
          db.prepare("UPDATE users SET username = ? WHERE id = ?").run(trimmedName, session.user_id);
          socket.emit("update-success", { field: "username", value: trimmedName });
          globalState.onlineUsers[socket.id].username = trimmedName; // ✅ 更新在线昵称
          broadcastOnlineList(io);
        } catch (e) {
          socket.emit("op-feedback", { type: 'error', message: '该昵称已被占用' });
        }
      }
      if (field === "currentAvatar") {
        // 先检查该用户是否拥有这个头像（安全校验）
        const userRow = db.prepare("SELECT unlocked_avatars FROM users WHERE id = ?").get(session.user_id);
        const unlocked = JSON.parse(userRow.unlocked_avatars);
       
        if (!unlocked.includes(value)) {
          return socket.emit("op-feedback", { type: 'error', message: '尚未获得该头像' });
        }

        db.prepare("UPDATE users SET current_avatar = ? WHERE id = ?").run(value, session.user_id);
        socket.emit("update-success", { field: "currentAvatar", value: value });
        globalState.onlineUsers[socket.id].avatar = value; // ✅ 更新在线头像
        broadcastOnlineList(io);
      }
    });
    // --- 4. 房间系统接口 ---
   
    // 统一房间动作处理器
    socket.on("room-action", ({ sessionId, uuid, action, roomId, data }) => {
      const user_temp = db.prepare(`
        SELECT users.* FROM sessions
        JOIN users ON sessions.user_id = users.id WHERE sessions.session_id = ?
      `).get(sessionId);
      if (!user_temp) return socket.emit("op-feedback", { type: 'error', message: '请先登录' });
      const user = checkAuth(socket, sessionId, uuid);
      if (!user) return;
      // 特殊动作：创建房间 (因为此时房间还没生成，无法从 rooms[roomId] 调用)
      if (action === "create") {
        if (userRoomMap[user.uuid]) {
          return socket.emit("room-conflict", { currentRoomId: userRoomMap[user.uuid] });
        }
        const newId = Math.floor(1000 + Math.random() * 9000).toString();
        const newRoom = new Room(newId, data.ruleId, user);
        rooms[newId] = newRoom;
        userRoomMap[user.uuid] = newId;
        socket.currentRoomId = newId; // 挂载到 socket 用于断线处理
        socket.join(`room-${newId}`);
        socket.emit("room-created", newRoom.serialize());
        io.emit("update-room-list", Object.values(rooms).map(r => r.serialize()));
        return;
      }

      // 其他动作：join, changeSeat, toggleReady, leave 等
      const room = rooms[roomId];
      if (!room) return socket.emit("op-feedback", { type: 'error', message: '站台已关闭' });

      // 加入房间前的冲突检查
      if (action === "addPlayer" && userRoomMap[user.uuid] && userRoomMap[user.uuid] !== roomId) {
        return socket.emit("room-conflict", { currentRoomId: userRoomMap[user.uuid] });
      }

      // 封装 Context 供 Room.js 使用
      const result = room.dispatch(action, { ...data, user, uuid: user.uuid });

      if (result.success) {
        if (action === "addPlayer") {
          userRoomMap[user.uuid] = roomId;
          socket.currentRoomId = roomId;
          socket.join(`room-${roomId}`);
        }
        if (action === "removePlayer") {
          delete userRoomMap[user.uuid];
          socket.leave(`room-${roomId}`);
          if (result.isEmpty) { /* 处理房间销毁逻辑... */ }
        }
        // 同步状态给所有人
        io.to(`room-${roomId}`).emit("room-info-update", room.serialize());
        io.emit("update-room-list", Object.values(rooms).map(r => r.serialize()));
      } else if (result.msg) {
        socket.emit("op-feedback", { type: 'error', message: result.msg });
      }
    });

    // 获取当前所有房间
    socket.on("get-rooms", () => {
      socket.emit("update-room-list", {
        rooms: Object.values(rooms).map(r => r.serialize()),
        // 告诉当前请求者他所在的房间，用于前端高亮
        myRoomId: socket.currentRoomId
      });
    });

    socket.on("disconnect", () => {
      const roomId = socket.currentRoomId;
      if (roomId && rooms[roomId]) {
        const room = rooms[roomId];
        const socketsInRoom = io.sockets.adapter.rooms.get(`room-${roomId}`);
        
        // 如果房间内没有活跃连接了，启动回收定时器
        if (!socketsInRoom || socketsInRoom.size === 0) {
          room.startDestructionTimer((id) => {
            // --- 核心修复：清理 userRoomMap 中的成员绑定 ---
            // 在销毁房间实例前，先找到这个房间里的所有人
            if (rooms[id] && rooms[id].seats) {
              rooms[id].seats.forEach(seat => {
                if (seat && seat.uuid) {
                  console.log(`[Room ${id}] 回收清理：移除用户 ${seat.uuid} 的房间绑定`);
                  delete userRoomMap[seat.uuid];
                }
              });
            }

            // 销毁房间实例
            delete rooms[id];
            
            // 全局广播列表更新
            io.emit("update-room-list", Object.values(rooms).map(r => r.serialize()));
            console.log(`[Room ${id}] 已由于无人认领被回收，相关成员绑定已清除`);
          });
        }
      }

      delete globalState.onlineUsers[socket.id];
      broadcastOnlineList(io);
    });
  });
};