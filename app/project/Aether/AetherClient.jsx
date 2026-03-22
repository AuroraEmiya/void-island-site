"use client";

import { useState, useEffect, useCallback } from "react";
import io from "socket.io-client";
import ReturnMenus from "@/components/ReturnMenus";
import { useTheme } from "@/lib/theme";
// 假设你通过 Context 或 Props 获取主题，这里预留变量
// 如果你的项目使用特定的 class 如 .dark，本代码已做自动适配

export default function AetherClient({}) {
  const [socket, setSocket] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [rooms, setRooms] = useState([]); // 房间列表
  const [myRoomId, setMyRoomId] = useState(null); // 记录用户当前所在的房间
  const { isDarkMode } = useTheme();
  // 用户状态
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [profileInput, setProfileInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  // UI 交互
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ uuid: "", password: "" });
  const [newAccountInfo, setNewAccountInfo] = useState(null);
  const [toast, setToast] = useState(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false); // 控制头像弹窗

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const calculateTimeLeft = useCallback((expiry) => {
    if (!expiry) return "";
    const diff = new Date(expiry) - new Date();
    if (diff <= 0) return "已到期";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `剩余 ${h}小时 ${m}分`;
  }, []);

  useEffect(() => {
    const socketInstance = io({
      transports: ["websocket"], 
      upgrade: false,             // 禁用协议升级，一步到位
      reconnectionAttempts: 5,    // 限制重连次数，防止无限刷屏
    });
    setSocket(socketInstance);
    const savedSessionId = localStorage.getItem("AETHER_SESSION_ID");

    socketInstance.on("connect", () => {
      if (savedSessionId) socketInstance.emit("auth-request", { sessionId: savedSessionId });
      else setAuthChecked(true);
      
      socketInstance.emit("get-rooms");
      console.log("Socket connected: Rooms requested");
    });

    socketInstance.on("auth-none", () => {
      // 如果原本本地存了 SessionId 但现在后端说 auth-none，说明 Session 失效或账号过期
      localStorage.removeItem("AETHER_SESSION_ID");
      setUser(null);
      setAuthChecked(true);
    });

    socketInstance.on("auth-success", (data) => {
      setUser(data);
      setProfileInput(data.profile || "");
      setNameInput(data.username || "");
      localStorage.setItem("AETHER_SESSION_ID", data.sessionId);
      setAuthChecked(true);
      setShowLoginModal(false);
      setTimeLeft(calculateTimeLeft(data.expiredAt));
    });
    
    socketInstance.on("auth-none", () => { setUser(null); setAuthChecked(true); });
    socketInstance.on("op-feedback", (fb) => showToast(fb.message, fb.type));
    socketInstance.on("new-account-created", (info) => setNewAccountInfo(info));
      socketInstance.on("update-success", ({ field, value }) => {let fieldLabel = "";
        if (field === "username") {
          fieldLabel = "昵称";
        } else if (field === "profile") {
          fieldLabel = "个人资料";
        } else if (field === "currentAvatar") {
          fieldLabel = "头像";
        } else {
          fieldLabel = field;
        }

      showToast(`${fieldLabel}修改成功`);
      if (field === "profile") {
        setUser(prev => ({ ...prev, profile: value }));
        setProfileInput(value);
        setIsEditing(false);
      }
      if (field === "username") {
        setUser(prev => ({ ...prev, username: value }));
        setNameInput(value);
        setIsEditingName(false);
      }
      if (field === "currentAvatar") {
        setUser(prev => ({ ...prev, currentAvatar: value }));
        showToast("头像更换成功");
        setShowAvatarModal(false);
      }
    });
    socketInstance.on("logout-confirm", () => { localStorage.removeItem("AETHER_SESSION_ID"); setUser(null); });
    socketInstance.on("update-online-list", (data) => {
      setOnlineCount(data.count);
      setOnlineUsers(data.users);
    });
    socketInstance.on("update-room-list", (data) => {
      // 兼容处理：如果是数组则直接设置，如果是对象则解析
      if (Array.isArray(data)) {
        setRooms(data);
      } else {
        setRooms(data.rooms || []);
        setMyRoomId(data.myRoomId);
      }
    });

    // 处理重连建议
    socketInstance.on("rejoin-suggestion", ({ roomId }) => {
      if (confirm(`检测到你已在房间 ${roomId} 中，是否立即返回？`)) {
        window.location.href = `/project/Aether/room/${roomId}`;
      }
    });

    // 处理房间冲突（想进 A 房间但已在 B 房间）
    socketInstance.on("room-conflict", ({ currentRoomId }) => {
      if (confirm(`你已在房间 ${currentRoomId} 中。请先退出该房间再加入新房间，是否跳转至原房间？`)) {
        window.location.href = `/project/Aether/room/${currentRoomId}`;
      }
    });
    socketInstance.on("room-created", (room) => {
      window.location.href = `/project/Aether/room/${room.roomId}`;
    });
    // 初始化时请求一次房间列表
    return () => socketInstance.disconnect();
  }, [calculateTimeLeft]);

  useEffect(() => {
    if (!user?.expiredAt) return;
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft(user.expiredAt)), 60000);
    return () => clearInterval(timer);
  }, [user, calculateTimeLeft]);

  const handleKeyDown = (e, action) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); action(); }
  };

  // 当权限检查未完成或 Socket 未连接时显示
  if (!authChecked) {
    return (
      <main className={`fixed inset-0 z-[200] flex flex-col items-center justify-center transition-colors duration-1000 ${
        isDarkMode ? "bg-[#0f172a]" : "bg-[#f0f9ff]"
      }`}>
        {/* 背景装饰：流动的光影 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] animate-pulse-slow" />
        </div>

        <div className="relative flex flex-col items-center">
          {/* 动态加载环 */}
          <div className="relative w-24 h-24 mb-10">
            <div className={`absolute inset-0 rounded-full border-2 border-t-transparent animate-spin ${
              isDarkMode ? 'border-blue-400/30 border-t-blue-400' : 'border-blue-200 border-t-blue-600'
            }`} />
            <div className={`absolute inset-4 rounded-full border-2 border-b-transparent animate-spin-reverse opacity-50 ${
              isDarkMode ? 'border-purple-400/30 border-t-purple-400' : 'border-purple-200 border-t-purple-600'
            }`} />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🌙</div>
          </div>

          {/* 提示文案 */}
          <div className="text-center space-y-3">
            <h2 className={`text-xl font-bold tracking-[0.2em] transition-colors ${
              isDarkMode ? 'text-blue-100' : 'text-blue-900'
            }`}>
              正在接入虹月台
            </h2>
            <div className="flex flex-col items-center space-y-1">
              <p className={`text-[11px] uppercase tracking-widest opacity-60 font-medium ${
                isDarkMode ? 'text-blue-300' : 'text-blue-600'
              }`}>
                Current system is loading slowly
              </p>
              <p className={`text-[10px] opacity-40 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                当前系统加载较慢，可能需要等待数秒
              </p>
            </div>
          </div>
        </div>

        {/* 底部装饰：版本与权限 */}
        <div className="absolute bottom-12 text-[9px] font-mono tracking-widest opacity-20 uppercase">
          Aether Rail System • Initializing Core
        </div>
      </main>
    );
  }

  return (
    <main className={`relative min-h-screen w-full flex flex-col md:flex-row transition-colors duration-700 ${isDarkMode ? "text-slate-100" : "text-slate-800"} font-sans overflow-x-hidden`}>
     
      {/* 1. 适配最右上角的返回按钮 */}
      <div className="fixed top-0 right-0 z-[100]">
        <ReturnMenus />
      </div>

      {/* 2. 动态背景层 */}
      <div className={`fixed inset-0 z-[-2] transition-colors duration-1000 ${
        isDarkMode
        ? "bg-gradient-to-b from-[#0f172a] via-[#1e1b4b] to-[#020617]"
        : "bg-gradient-to-b from-[#b3e5fc] via-[#e1f5fe] to-[#ffffff]"
      }`} />
     
      {/* 3. 日夜变换的装饰物 (云朵/星空) */}
      <div className="fixed inset-0 z-[-1] opacity-60 pointer-events-none">
        <div className={`cloud cloud-1 ${isDarkMode ? 'star-style' : ''}`} />
        <div className={`cloud cloud-2 ${isDarkMode ? 'star-style' : ''}`} />
        <div className={`cloud cloud-3 ${isDarkMode ? 'star-style' : ''}`} />
      </div>

    {/* 4. 操作反馈 Toast */}
    {toast && (
      <div 
        className={`
          fixed top-10 z-[110] px-8 py-3 rounded-full 
          backdrop-blur-xl shadow-2xl border 
          transition-all animate-bounce-in
          /* 核心修改：不使用 -translate-x-1/2 */
          left-1/2 
          -ml-[fit-content] /* 占位符，实际逻辑如下 */
          ${toast.type === 'error' 
            ? 'bg-red-500/90 border-red-400 text-white' 
            : (isDarkMode ? 'bg-blue-500/80 border-blue-400 text-white' : 'bg-white/80 border-blue-200 text-blue-600')
          }
        `}
        style={{
          width: 'max-content',
          transformOrigin: 'center center', // 确保动画从中心弹起
          left: '50%',
          transform: 'translateX(-50%)', // 如果动画里没写死 translate，这里依然可以用
        }}
      >
        {toast.message}
      </div>
    )}

      {/* 5. 凭证弹窗与登录弹窗 (此处逻辑同上，CSS 适配夜间) */}
      {newAccountInfo && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-white'} rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl border animate-fade-in`}>
            <h3 className={`text-2xl font-bold mb-2 text-center ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>🎉 账户已创建</h3>
            <div className={`space-y-3 text-[13px] leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              <p>您的临时账户已经创建成功！同一个主机再次访问该页面时将会<strong>自动登录</strong>。</p>
              <p>该账户将于<span className={isDarkMode ? 'text-blue-300' : 'text-blue-600'}>72小时后自动销毁</span>。若计划多主机登录或防止丢失，请务必记下以下凭证，刷新后将无法再次查看。</p>
              <p className="opacity-80">感谢您参与<strong>虹月台</strong>的测试，祝您在天境列车系统中玩得愉快！🚀</p>
              <p className="opacity-80">注：目前的账户均为临时账户，<span className={isDarkMode ? 'text-blue-300' : 'text-blue-600'}>网站更新时将会自动清除所有账户</span>，后续版本将会上线永久账户和更多玩法。</p>
            </div>
            <div className="space-y-4 my-8">
              {[ {label: 'UUID (账号)', val: newAccountInfo.uuid}, {label: 'PASSWORD (密码)', val: newAccountInfo.password} ].map((item, i) => (
                <div key={i} className={`${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'} p-4 rounded-2xl cursor-pointer active:scale-95 transition-transform`} onClick={() => {navigator.clipboard.writeText(item.val); showToast("已复制")}}>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{item.label}</p>
                  <p className="text-2xl font-mono font-bold">{item.val}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setNewAccountInfo(null)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg transition-colors">记下了，进入天境列车</button>
          </div>
        </div>
      )}

      {showLoginModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className={`${isDarkMode ? 'bg-slate-800' : 'bg-white/90'} rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl animate-fade-in`}>
            <h3 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>凭证登录</h3>
            <input placeholder="UUID" className={`w-full p-4 rounded-2xl border mb-4 outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 focus:border-purple-500' : 'bg-white border-slate-200 focus:border-purple-400'}`} onChange={e => setLoginForm({...loginForm, uuid: e.target.value})} />
            <input type="password" placeholder="密码" className={`w-full p-4 rounded-2xl border mb-6 outline-none transition-all ${isDarkMode ? 'bg-slate-900 border-slate-700 focus:border-purple-500' : 'bg-white border-slate-200 focus:border-purple-400'}`} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
            <div className="flex gap-4">
              <button onClick={() => setShowLoginModal(false)} className="flex-1 py-4 text-slate-500 font-bold">取消</button>
              <button onClick={() => socket.emit("auth-request", { loginData: loginForm })} className="flex-[2] py-4 bg-purple-600 text-white font-bold rounded-2xl shadow-lg">登录</button>
            </div>
          </div>
        </div>
      )}

      {showAvatarModal && user && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-white'} rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border animate-fade-in`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>选择头像</h3>
              <button onClick={() => setShowAvatarModal(false)} className="text-slate-500 hover:text-red-500 transition-colors">关闭</button>
            </div>
           
            <div className="grid grid-cols-4 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {user.unlockedAvatars.map((av) => (
                <div
                  key={av}
                  onClick={() => socket.emit("update-profile", {
                    sessionId: localStorage.getItem("AETHER_SESSION_ID"),
                    uuid: user?.uuid,
                    field: "currentAvatar",
                    value: av
                  })}
                  className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-110 active:scale-95 border-2 ${
                    user.currentAvatar === av
                      ? 'border-blue-500 ring-4 ring-blue-500/20'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={`/avatar/${av}.png`} alt="avatar-option" className="w-full h-full object-cover" />
                  {user.currentAvatar === av && (
                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center text-white text-xs font-bold">使用中</div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-6 text-[10px] text-slate-500 text-center opacity-60 tracking-widest uppercase">
              未来将会投放若干限定头像，可通过活动解锁
            </p>
          </div>
        </div>
      )}
{/* 6. 侧边栏 (Sidebar) */}
<aside className={`z-20 w-full md:w-80 md:min-h-screen border-b md:border-b-0 md:border-r p-6 flex flex-col shadow-2xl transition-all duration-700 ${
        isDarkMode ? "bg-slate-900/40 border-slate-800" : "bg-white/30 border-white/50 backdrop-blur-xl"
      }`}>
        <div className="h-12 md:hidden"></div>

        {user ? (
          <div className="flex flex-col h-full animate-fade-in">
            {/* 用户头像与信息区 */}
            <div className="flex items-center space-x-4 mb-8">
              <div 
                onClick={() => setShowAvatarModal(true)}
                className="w-16 h-16 rounded-full border-2 border-white shadow-xl animate-pulse-slow overflow-hidden flex-shrink-0 cursor-pointer hover:ring-4 hover:ring-blue-400/50 transition-all group relative"
              >
                <img src={`/avatar/${user.currentAvatar}.png`} alt="avatar" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] text-white font-bold">更换</div>
              </div>

              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <input
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onBlur={() => {
                      if (nameInput === user.username) {
                        setIsEditingName(false);
                      } else {
                        socket.emit("update-profile", { sessionId: localStorage.getItem("AETHER_SESSION_ID"),  uuid: user?.uuid, field: "username", value: nameInput });
                      }
                    }}
                    onKeyDown={e => handleKeyDown(e, () => socket.emit("update-profile", { sessionId: localStorage.getItem("AETHER_SESSION_ID"), uuid: user?.uuid, field: "username", value: nameInput }))}
                    className={`w-full bg-transparent border-b-2 font-bold text-lg outline-none ${isDarkMode ? 'border-blue-500 text-white' : 'border-blue-400 text-blue-900'}`} autoFocus
                  />
                ) : (
                  <div className="flex items-center group">
                    <h3 className={`font-bold text-lg truncate ${isDarkMode ? 'text-white' : 'text-blue-900'}`}>{user.username}</h3>
                    
                    {/* 编辑图标 */}
                    <button onClick={() => { setNameInput(user.username); setIsEditingName(true); }} className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <img src="/edit_icon.png" className={`w-3 h-3 ${isDarkMode ? 'invert' : ''}`} alt="edit" />
                    </button>

                    {/* 退出登录图标 (新增) */}
                    <button 
                      onClick={() => socket.emit("logout", localStorage.getItem("AETHER_SESSION_ID"))} 
                      className="ml-auto p-1 hover:bg-red-500/20 rounded-lg transition-all active:scale-90 group/logout"
                      title="退出登录"
                    >
                      <img 
                        src="/logout_icon.png" 
                        className={`w-4 h-4 transition-all group-hover/logout:brightness-125 ${isDarkMode ? 'invert' : ''}`} 
                        alt="logout" 
                      />
                    </button>
                  </div>
                )}
                <p className="text-[10px] font-mono text-slate-500 mt-1">ID: {user.uuid}</p>
              </div>
            </div>

            {/* 账户时长 */}
            <div className={`mb-6 p-4 rounded-2xl border transition-colors ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white/40 border-white/50'}`}>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">账户剩余时长</p>
              <p className={`text-sm font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>{user.role === 'admin' ? "🛡️ 永久特权" : `⏳ ${timeLeft}`}</p>
            </div>

            {/* 个人介绍区 */}
            <div className="flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">个人资料</p>
                <button onClick={() => isEditing ? (profileInput === user.profile ? setIsEditing(false) : socket.emit("update-profile", { sessionId: localStorage.getItem("AETHER_SESSION_ID"), uuid: user?.uuid, field: "profile", value: profileInput })) : setIsEditing(true)}>
                  <img src="/edit_icon.png" className={`w-4 h-4 transition-all ${isEditing ? 'rotate-90 opacity-100' : 'opacity-50'} ${isDarkMode ? 'invert' : ''}`} />
                </button>
              </div>
              <div className={`border rounded-2xl p-4 min-h-[100px] transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-white/40 border-white/60'}`}>
                {isEditing ? (
                  <textarea
                    value={profileInput}
                    onChange={e => setProfileInput(e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 text-xs h-20 resize-none outline-none"
                    maxLength={400}
                    autoFocus
                  />
                ) : (
                  <p className={`text-xs leading-relaxed ${user.profile ? "" : "text-slate-500 italic"}`}>
                    {user.profile || "暂无个人介绍"}
                  </p>
                )}
              </div>
            </div>

            {/* 在线成员 (关键修改：增加 pb-100 避让播放器) */}
            <div className="mt-6 flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  列车乘员数 ({onlineCount})
                </p>
              </div>
              
              <div className={`flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 pb-[100px] ${
                isDarkMode ? 'mask-gradient-dark' : 'mask-gradient-light'
              }`}>
                {onlineUsers.map((u, i) => (
                  <div key={i} className={`flex items-center space-x-3 p-2 rounded-xl transition-all ${
                    isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-white/60'
                  }`}>
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
                      <img src={`/avatar/${u.avatar}.png`} alt="av" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${
                        u.isGuest ? 'opacity-50 italic' : (isDarkMode ? 'text-blue-300' : 'text-blue-600')
                      }`}>
                        {u.username}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center py-10h-fullanimate-fade-in">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-8 border transition-colors shadow-inner text-4xl ${
              isDarkMode ? 'bg-slate-800 border-slate-700 opacity-50' : 'bg-white/40 border-white/50 opacity-30'
            }`}>👤</div>
            <h3 className={`font-bold text-xl mb-10 tracking-tight ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>天境列车访客模式</h3>
            <div className="space-y-4 w-full">
              <button onClick={() => socket.emit("auth-request", { createNewGuest: true })} className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold shadow-xl hover:scale-[1.02] active:scale-95 transition-all">获取临时车票</button>
              <button onClick={() => setShowLoginModal(true)} className={`w-full py-4 rounded-2xl font-bold shadow-xl hover:scale-[1.02] active:scale-95 transition-all ${
                isDarkMode ? 'bg-purple-900/60 text-purple-300 border border-purple-800' : 'bg-purple-600 text-white'
              }`}>出示已有车票</button>
            </div>
          {/* 新增：在线成员（访客状态下） */}
          <div className="mt-10 flex-1 flex flex-col min-h-0 overflow-hidden w-full">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                列车乘员数 ({onlineCount})
              </p>
            </div>
            <div className={`flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 pb-[100px] ${
              isDarkMode ? 'mask-gradient-dark' : 'mask-gradient-light'
            }`}>
              {onlineUsers.map((u, i) => (
                <div key={i} className={`flex items-center space-x-3 p-2 rounded-xl transition-all ${
                  isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-white/60'
                }`}>
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 flex-shrink-0">
                    <img src={`/avatar/${u.avatar}.png`} alt="av" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${
                      u.isGuest ? 'opacity-50 italic' : (isDarkMode ? 'text-blue-300' : 'text-blue-600')
                    }`}>
                      {u.username}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
         
        )}
      </aside>

{/* 7. 主内容区 (Room System) */}
<section className="flex-1 relative p-6 md:p-12 flex flex-col h-screen overflow-hidden">
        <div className="h-12 md:hidden"></div>
        {/* 将内边距从 p-12 稍微收缩到 p-10，腾出垂直空间 */}
        <div className={`flex-1 rounded-[3.5rem] border shadow-inner flex flex-col items-center justify-start text-center p-6 md:p-10 transition-all duration-700 overflow-hidden ${
          isDarkMode ? 'bg-slate-900/20 border-slate-800' : 'bg-white/20 border-white/40 backdrop-blur-sm'
        }`}>
          
          {/* 标题：mb 从 4 降到 2，缩小垂直占用 */}
          <h2 className={`text-5xl md:text-7xl font-black mb-2 uppercase tracking-tighter opacity-10 transition-colors shrink-0 ${isDarkMode ? 'text-white' : 'text-blue-900'}`}>
            虹月台站台列表
          </h2>
          
          {/* 房间网格布局容器 */}
          <div className="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar px-6 pb-12">
            
            <div className="h-8 w-full block shrink-0"></div>

            {/* 关键修改：gap 从 8 降到 4，确保垂直紧凑度 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rooms.map((room) => {
                const isMyRoom = myRoomId === room.roomId;
                return (
                  <div
                    key={room.roomId}
                    onClick={() => {
                      if (isMyRoom) {
                        window.location.href = `/project/Aether/room/${room.roomId}`;
                        return;
                      }
                      socket.emit("room-action", {
                        sessionId: localStorage.getItem("AETHER_SESSION_ID"),
                        uuid: user?.uuid,
                        action: "addPlayer",
                        roomId: room.roomId,
                        data: {}
                      });
                    }}
                    /* 核心调整：高度设为 h-48，内边距 p-6，确保 3 行能一屏装下 */
                    className={`group relative p-6 rounded-[2.5rem] border transition-all cursor-pointer hover:scale-[1.01] active:scale-95 h-48 flex flex-col justify-between ${
                      isMyRoom
                        ? (isDarkMode
                            ? 'ring-4 ring-blue-500/50 border-blue-400 bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                            : 'ring-4 ring-blue-400/30 border-blue-300 bg-blue-100/60 shadow-[0_0_15px_rgba(59,130,246,0.15)]')
                        : (isDarkMode
                            ? 'bg-blue-500/10 border-blue-400/20 hover:bg-blue-500/20 shadow-md'
                            : 'bg-blue-100/40 border-white/60 hover:bg-blue-100/60 shadow-md')
                    } backdrop-blur-md`}
                  >
                    {isMyRoom && (
                      <div className="absolute -top-3 -right-1 bg-blue-600 text-white text-[10px] px-3 py-0.5 rounded-full font-bold shadow-lg animate-bounce z-10">
                        当前所在
                      </div>
                    )}

                    <div className="flex justify-between items-start">
                      <div className="text-left">
                        <h3 className={`text-xl font-bold ${isDarkMode ? 'text-blue-300' : 'text-blue-900'}`}>
                          #{room.roomId} 站台
                        </h3>
                        <p className="text-[15px] opacity-60 uppercase tracking-widest mt-0.5">
                          Rule: {room.meta?.name || ("未知规则")}
                        </p>
                      </div>
                      <span className={`px-3 py-0.5 rounded-full text-[9px] font-bold ${
                        room.status === 'WAITING' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      }`}>
                        {room.status === 'WAITING' ? '等待中' : '进行中'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-3">
                        {room.seats.map((seat, i) => (
                          <div key={i} className={`w-9 h-9 rounded-full border-2 ${isDarkMode ? 'border-slate-800' : 'border-white'} overflow-hidden bg-slate-700/30 flex items-center justify-center text-[9px]`}>
                            {seat ? <img src={`/avatar/${seat.avatar}.png`} className="w-full h-full object-cover" alt="avatar" /> : "·"}
                          </div>
                        ))}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono font-bold opacity-60">
                          {room.seats.filter(s => s !== null).length} / {room.seats.length}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 创建房间按钮：同步高度为 h-48 */}
              <div
                onClick={() => {
                  if(!user) return showToast("请先获取车票", "error");
                  socket.emit("room-action", {
                    sessionId: localStorage.getItem("AETHER_SESSION_ID"),
                    uuid: user?.uuid,
                    action: "create",
                    data: { ruleId: 'rps' }
                  });
                }}
                className={`flex flex-col items-center justify-center p-6 rounded-[2.5rem] border-2 border-dashed transition-all cursor-pointer hover:border-solid h-48 ${
                  isDarkMode
                  ? 'border-blue-400/20 hover:bg-blue-500/10 text-blue-400/40 hover:text-blue-400'
                  : 'border-blue-200 hover:bg-white/40 text-blue-300 hover:text-blue-500'
                }`}
              >
                <div className="text-4xl mb-2">+</div>
                <span className="text-xs font-bold uppercase tracking-widest">开启新站台</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .animate-pulse-slow { animation: pulse 4s infinite ease-in-out; }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 15px rgba(255,255,255,0.2); } 50% { box-shadow: 0 0 40px rgba(59,130,246,0.6); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .animate-bounce-in { animation: bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        @keyframes bounceIn { from { opacity: 0; transform: translate(-50%, -40px); } to { opacity: 1; transform: translate(-50%, 0); } }
        
        .cloud { position: absolute; background: #fff; border-radius: 100px; filter: blur(30px); transition: all 1s ease; }
        .cloud.star-style { background: #60a5fa; filter: blur(50px); opacity: 0.3; border-radius: 50%; }
        
        .cloud-1 { width: 300px; height: 100px; top: 15%; left: -300px; animation: drift 30s linear infinite; }
        .cloud-2 { width: 400px; height: 150px; top: 50%; left: -400px; animation: drift 45s linear infinite 5s; }
        .cloud-3 { width: 250px; height: 80px; top: 80%; left: -250px; animation: drift 25s linear infinite 10s; }
        
        @keyframes drift { from { transform: translateX(-10vw); } to { transform: translateX(110vw); } }
        
        .cloud::before, .cloud::after { content: ''; position: absolute; background: inherit; border-radius: inherit; }
        .cloud::before { width: 150px; height: 150px; top: -70px; left: 50px; }
        .cloud::after { width: 200px; height: 200px; top: -100px; left: 120px; }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-reverse { animation: spin-reverse 1.5s linear infinite; }
        /* 4. 新增滚动条样式与边缘淡出 */
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: ${isDarkMode ? '#334155' : '#cbd5e1'}; 
          border-radius: 10px; 
        }
        
        .mask-gradient-dark {
          mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
        }
        .mask-gradient-light {
          mask-image: linear-gradient(to bottom, black 80%, transparent 100%);
        }
      `}</style>
    </main>
  );
}