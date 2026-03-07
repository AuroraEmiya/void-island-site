const Database = require("better-sqlite3");
const db = new Database('database.db');
const { v4: uuidv4 } = require('uuid');

// 1. 初始化增强版用户表 - 增加 uuid_login, password_plain 字段
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid_login TEXT UNIQUE, -- 9位数字账号
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

// 辅助函数：生成不重复的9位数字ID
function generateShortId() {
  while (true) {
    const id = Math.floor(100000000 + Math.random() * 900000000).toString();
    const exists = db.prepare("SELECT id FROM users WHERE uuid_login = ?").get(id);
    if (!exists) return id;
  }
}

// 辅助函数：生成简易随机密码
function generateRandomPwd() {
  return Math.random().toString(36).slice(-6); // 6位随机字符
}

let globalState = {
  switches: { light1: false, light2: false },
  onlineCount: 0
};

module.exports = function(io) {
  io.on("connection", (socket) => {
    globalState.onlineCount++;
    io.emit("update-online-count", globalState.onlineCount);

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
        user = db.prepare("SELECT * FROM users WHERE uuid_login = ? AND password_hash = ?").get(loginData.uuid, loginData.password);
        if (user) {
          const newSessionId = uuidv4();
          db.prepare("INSERT INTO sessions (session_id, user_id) VALUES (?, ?)").run(newSessionId, user.id);
          user.session_id = newSessionId;
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

        const info = db.prepare("INSERT INTO users (uuid_login, password_hash, username, role, expired_at) VALUES (?, ?, ?, 'guest', ?)").run(uuid, pwd, tempName, expireDate.toISOString());
        const newSessionId = uuidv4();
        db.prepare("INSERT INTO sessions (session_id, user_id) VALUES (?, ?)").run(newSessionId, info.lastInsertRowid);
        
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
        user.session_id = newSessionId;
        // 特殊：创建成功返回明文密码供前端显示
        socket.emit("new-account-created", { uuid: user.uuid_login, password: pwd });
      }

      if (user) {
        socket.emit("auth-success", {
          uuid: user.uuid_login,
          username: user.username,
          role: user.role,
          sessionId: user.session_id,
          profile: user.profile,
          currentAvatar: user.current_avatar,
          expiredAt: user.expired_at
        });
        socket.emit("op-feedback", { type: 'success', message: '登录成功' });
      } else {
        socket.emit("auth-none");
      }
    });

    socket.on("logout", (sessionId) => {
      if (sessionId) {
        db.prepare("DELETE FROM sessions WHERE session_id = ?").run(sessionId);
        socket.emit("logout-confirm");
        socket.emit("op-feedback", { type: 'success', message: '已安全退出' });
      }
    });
    // --- 3. 资料编辑接口 (支持简介和昵称) ---
    socket.on("update-profile", ({ sessionId, field, value }) => {
      const session = db.prepare("SELECT user_id FROM sessions WHERE session_id = ?").get(sessionId);
      if (!session) return socket.emit("op-feedback", { type: 'error', message: '未授权' });

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
        } catch (e) {
          socket.emit("op-feedback", { type: 'error', message: '该昵称已被占用' });
        }
      }
    });
    // 状态测试逻辑保持不变...
    socket.emit("init-state", globalState.switches);
    socket.on("toggle-switch", (id) => {
      if (globalState.switches.hasOwnProperty(id)) {
        globalState.switches[id] = !globalState.switches[id];
        io.emit("state-changed", globalState.switches);
      }
    });

    socket.on("disconnect", () => {
      globalState.onlineCount--;
      io.emit("update-online-count", globalState.onlineCount);
    });
  });
};