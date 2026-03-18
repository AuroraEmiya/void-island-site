"use client";

import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";
import { 
  Play, CheckCircle, Crown, Settings, 
  BookOpen, LogOut, Loader2, UserMinus, ChevronDown, Users
} from "lucide-react";

export default function RoomClientPage({ roomId }) {
  const router = useRouter();
  const socketRef = useRef(null);
  const [roomData, setRoomData] = useState(null);
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("CONNECTING");

  useEffect(() => {
    const savedSessionId = localStorage.getItem("AETHER_SESSION_ID");
    if (!savedSessionId) { router.push("/project/Aether"); return; }

    const socket = io({ transports: ["websocket"], upgrade: false, reconnectionAttempts: 5 });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("auth-request", { sessionId: savedSessionId }));
    socket.on("auth-success", (userData) => {
      setUser(userData);
      socket.emit("room-action", { sessionId: savedSessionId, uuid: userData.uuid, action: "addPlayer", roomId });
    });
    socket.on("room-info-update", (data) => { setRoomData(data); setStatus("READY"); });
    socket.on("room-closed", () => router.push("/project/Aether"));
    
    socket.on("op-feedback", ({ type, message }) => {
      console.log(`[Server Feedback] ${type}: ${message}`);
      if (type === 'error') alert(message); // 或者用更优雅的 toast
    });

    return () => socket.disconnect();
  }, [roomId, router]);

  const dispatch = (action, data = {}) => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit("room-action", {
      sessionId: localStorage.getItem("AETHER_SESSION_ID"),
      uuid: user.uuid, action, roomId, data
    });
  };

  if (status !== "READY" || !roomData) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#f0f4f8] text-blue-400 font-mono text-xs">
        <Loader2 className="animate-spin mr-2" size={14} /> INITIALIZING STATION...
      </div>
    );
  }

  const isHost = user?.uuid === roomData.hostId;
  const myReadyStatus = roomData.readyStatus[user?.uuid];
  const playerCount = roomData.seats.filter(s => s !== null).length;

  return (
    <div className="h-screen w-full bg-gradient-to-tr from-[#e0eafc] to-[#cfdef3] text-slate-600 flex flex-col font-sans overflow-hidden">
      
      {/* 1. 顶部管理横幅 */}
      <section className="h-[30%] min-h-[220px] w-full p-6 flex flex-col relative z-30">
        <div className="max-w-6xl mx-auto w-full h-full bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] shadow-[0_10px_40px_rgba(148,163,184,0.1)] p-6 flex gap-8 relative overflow-hidden">
          
          {/* 左侧：房间基础信息 */}
          <div className="flex-[1.5] flex flex-col justify-between border-r border-blue-200/50 pr-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500"><Settings size={18}/></div>
                <input 
                  type="text" 
                  defaultValue={`#${roomData.roomId} 站台`}
                  disabled={!isHost}
                  className="bg-transparent text-xl font-black focus:outline-none placeholder:text-blue-300 w-full text-slate-700"
                  onBlur={(e) => isHost && dispatch("updateConfig", { config: { roomName: e.target.value } })}
                />
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest leading-tight">当前状态</span>
                  <span className={`text-xs font-black ${roomData.status === "WAITING" ? "text-blue-500" : "text-indigo-600"}`}>
                    {roomData.status === "WAITING" ? "等待中" : "已开始游戏"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest leading-tight">乘客人数</span>
                  <div className="flex items-center gap-1 h-[20px]">
                    <Users size={12} className="text-blue-400"/>
                    {isHost ? (
                      /* 房主模式：显示下拉选择框以调整上限 */
                      <div className="relative flex items-center group">
                        <select 
                          className="appearance-none bg-blue-400/5 border border-transparent hover:border-blue-300/50 rounded px-1 pr-4 text-xs font-black text-slate-700 focus:outline-none cursor-pointer transition-all"
                          value={roomData.seats.length}
                          onChange={(e) => dispatch("updateConfig", { config: { maxSeats: parseInt(e.target.value) } })}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(num => (
                            <option key={num} value={num} disabled={num < playerCount}>{num} 人</option>
                          ))}
                        </select>
                        <ChevronDown size={8} className="absolute right-0.5 pointer-events-none text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ) : (
                      /* 乘客模式：仅显示静态文本 */
                      <span className="text-xs font-black text-slate-700">{playerCount} / {roomData.seats.length}</span>
                    )}
                  </div>
                </div>
                {/* 1. 父容器增加 items-center，确保子元素（标题和选择框）中轴线对齐 */}
                <div className="flex flex-col items-center">
                  
                  {/* 2. 标题增加 text-center */}
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest leading-tight text-center">
                    游戏规则选择
                  </span>
                  
                  {/* 3. 移除多余的嵌套 div，保持结构清晰 */}
                  <div className="relative flex items-center">
                    <select 
                      disabled={!isHost}
                      className={`
                        appearance-none 
                        /* 高度调节：h-[20px] | 宽度定死：w-[78px] */
                        h-[20px] w-[120px]
                        bg-blue-400/10 backdrop-blur-md 
                        border border-blue-300/50 
                        /* 稍微调整 padding 为箭头留出空间 */
                        pl-2 pr-5 rounded-md text-[11px] font-black 
                        focus:outline-none text-slate-900 cursor-pointer 
                        transition-all hover:bg-blue-400/20 hover:border-blue-400/60
                        leading-none
                      `}
                      value={roomData.ruleId}
                      onChange={(e) => dispatch("updateConfig", { config: { ruleId: e.target.value } })}
                    >
                      <option value="rps" className="text-slate-900 bg-white">石头剪刀布</option>
                      <option value="mahjong" className="text-slate-900 bg-white">麻将</option>
                    </select>
                    
                    {/* 下拉小箭头 */}
                    {!isHost || (
                      <div className="absolute right-1.5 pointer-events-none text-blue-500/60">
                        <ChevronDown size={10} strokeWidth={4} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => {
                if (isHost) {
                  // 房主：直接解散房间
                  dispatch("closeRoom");
                } else {
                  // 乘客：永久离开
                  dispatch("removePlayer");
                }
                // 动作发出后，由于后端会触发 room-closed 或 update-room-list，
                // 我们在 useEffect 里的监听会自动把用户导向首页。
              }}
              className={`w-fit flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-[10px] font-black ${
                "bg-red-100/50 text-red-400 hover:bg-red-500 hover:text-white" 
              }`}
            >
              <LogOut size={12} /> 
              {isHost ? "关闭站台" : "离开站台"}
            </button>
          </div>

          {/* 右侧：规则主体区 */}
          <div className="flex-[4] h-full flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 mb-3 text-blue-600/60 font-bold text-[10px] uppercase tracking-widest">
              <BookOpen size={14} className="text-blue-400"/> 
              游戏规则说明
            </div>
            
            {/* 滚动条容器优化：增加 overflow-hidden 的父级并设置 padding 确保尖角不溢出圆角 */}
            <div className="flex-1 bg-blue-900/5 rounded-[1.8rem] border border-blue-200/20 shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 p-5 overflow-y-auto aether-scrollbar">
                <div className="text-xs leading-relaxed text-slate-500 font-medium">
                  <p className="mb-3 text-slate-600 text-sm font-black flex items-center gap-2">
                     <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                     {roomData.ruleId === 'rps' ? "Aether-RPS v1.0" : "Aether-Mahjong v2.4"}
                  </p>
                  {roomData.ruleId === 'rps' ? (
                    <ul className="space-y-2 opacity-80">
                      <li className="flex gap-2"><span>•</span><span>标准零和博弈机制：石头胜剪刀，剪刀胜布，布胜石头。</span></li>
                      <li className="flex gap-2"><span>•</span><span>多轮并行逻辑：系统自动识别所有玩家手势并实时结算。</span></li>
                      <li className="flex gap-2"><span>•</span><span>超时惩罚：若在规定时间内未出拳，将判定为自动弃权。</span></li>
                      <li className="mt-2 p-3 bg-white/40 rounded-xl border border-blue-100 text-[10px]">
                        * Aether 提示：在多人对局中，系统将根据各玩家之间的胜负链条自动构建结算矩阵。
                      </li>
                    </ul>
                  ) : (
                    <ul className="space-y-2 opacity-80">
                      <li className="flex gap-2"><span>•</span><span>全流程立直麻将逻辑：包含吃、碰、杠、听及自摸判断。</span></li>
                      <li className="flex gap-2"><span>•</span><span>136张标准牌池，支持实时番数计算与符数结算。</span></li>
                      <li className="flex gap-2"><span>•</span><span>振听规则严格校验，确保对局公平性与竞技深度。</span></li>
                      <li className="mt-2 p-3 bg-white/40 rounded-xl border border-blue-100 text-[10px]">
                        * Aether 提示：请确保网络连接稳定，麻将协议对时延同步要求较高。
                      </li>
                    </ul>
                  )}
                  <div className="h-20"></div>
                  <p className="border-t border-blue-200/20 pt-4 italic text-[10px] text-blue-400">
                    底部协议结束标志：EOF_AETHER_STATION
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 中心区域 & 3. 底部操作保持 */}
      <main className="flex-1 w-full max-w-6xl mx-auto flex items-center px-6 gap-2">
        <div className="flex-1 flex items-center justify-center relative scale-[0.75] origin-center">
          <div className="relative w-[260px] h-[260px]">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white to-blue-50 shadow-[15px_15px_40px_rgba(148,163,184,0.15)] flex items-center justify-center border border-white">
              <div className="w-[85%] h-[85%] rounded-full border border-blue-100 shadow-inner bg-white/20 flex items-center justify-center">
                <span className="text-xl font-black opacity-[0.05] tracking-[0.3em] text-blue-900">AETHER</span>
              </div>
            </div>

            {roomData.seats.map((seat, i) => {
              const angle = i * (360 / roomData.seats.length);
              const radius = 190;
              return (
                <div key={i} className="absolute left-1/2 top-1/2" style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px) rotate(-${angle}deg)` }}>
                  <div className="flex flex-col items-center group">
                    <span className="text-[14px] font-black text-blue-300 mb-1">{i+1}</span>
                    <div 
                      onClick={() => !seat && dispatch("changeSeat", { newSeatIndex: i })}
                      className={`w-20 h-20 rounded-2xl p-0.5 transition-all cursor-pointer shadow-lg relative ${
                        seat ? (roomData.readyStatus[seat.uuid] ? "bg-emerald-400" : "bg-blue-400") : "bg-white/50 border-2 border-dashed border-blue-200"
                      }`}
                    >
                      <div className="w-full h-full rounded-[0.85rem] overflow-hidden bg-white/80">
                        {seat ? (
                          <>
                            <img src={`/avatar/${seat.avatar}.png`} className={`w-full h-full object-cover ${roomData.readyStatus[seat.uuid] ? 'opacity-30 blur-[1px]' : ''}`} />
                            {seat.uuid === roomData.hostId && (
                              <div className="absolute -top-2 -left-2 bg-amber-400 p-1 rounded-lg shadow-sm">
                                <Crown size={12} className="text-white" fill="currentColor"/>
                              </div>
                            )}
                          </>
                        ) : (
                        <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                          <div className="opacity-10 text-blue-300 group-hover:opacity-0 transition-opacity">
                            <Users size={24}/>
                          </div>
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                            <span className="text-[10px] font-black text-blue-500 tracking-tighter">MOVE</span>
                            <ChevronDown size={14} className="text-blue-500 -mt-1 animate-bounce" />
                          </div>
                        </div> 
                        )}
                      </div>
                    </div>
                    <span className="text-[14px] font-bold mt-2 text-slate-500 bg-white/30 px-2 rounded-full backdrop-blur-sm truncate max-w-[120px]">
                      {seat?.username || "EMPTY"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-[340px] flex flex-col gap-2 origin-right">
          {roomData.seats.map((seat, i) => (
            <div key={i} className={`group relative p-3 rounded-2xl border transition-all duration-300 flex items-center gap-4 cursor-pointer backdrop-blur-md 
              ${
                seat 
                  ? seat.uuid === roomData.hostId 
                    ? "bg-amber-50/80 border-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.1)]" // 房主金色外观
                    : "bg-white/50 border-white shadow-sm" 
                  : "bg-white/10 border-dashed border-blue-200 opacity-60"
              }`}>
              <div className="relative z-10">
              <div className={`w-10 h-10 rounded-xl overflow-hidden border-2 ${
                seat?.uuid === roomData.hostId 
                  ? 'border-amber-400' 
                  : roomData.readyStatus[seat?.uuid] ? 'border-emerald-400' : 'border-white'
              }`}>
                  {seat && <img src={`/avatar/${seat.avatar}.png`} className={`w-full h-full object-cover ${roomData.readyStatus[seat.uuid] ? 'opacity-40' : ''}`} />}
                </div>
                {seat && seat.uuid !== roomData.hostId && roomData.readyStatus[seat.uuid] && (
                  <CheckCircle className="absolute inset-0 m-auto text-emerald-500" size={20}/>
                )}
              </div>
              <div className="flex-1 z-10">

                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-black italic text-slate-700">{seat?.username || "待加入"}</span>
                  
                  {seat && (
                    seat.uuid === roomData.hostId ? (
                      /* 房主标签：使用更温暖的琥珀色，增加间距 */
                      <span className="text-[12px] px-2 py-0.5 bg-amber-400 text-white rounded-md font-black flex items-center gap-1 shadow-sm tracking-wider">
                        <Crown size={10} fill="currentColor" className="mb-0.5"/> 房主
                      </span>
                    ) : roomData.readyStatus[seat.uuid] ? (
                      /* 已准备标签：翡翠绿，搭配白色文字 */
                      <span className="text-[12px] px-2 py-0.5 bg-emerald-500 text-white rounded-md font-black shadow-sm tracking-wider">
                        已准备
                      </span>
                    ) : (
                      /* 未准备标签：低调的灰蓝色，文字稍微加深一点对比度 */
                      <span className="text-[12px] px-2 py-0.5 bg-slate-200 text-slate-500 rounded-md font-black tracking-wider">
                        未准备
                      </span>
                    )
                  )}
                </div>

                <div className="text-[14px] font-mono text-blue-500 tracking-tighter italic">ID: {seat?.uuid.slice(0,8) || "--------"}</div>
              </div>
              {isHost && seat && seat.uuid !== user.uuid && (
                <button onClick={(e) => {e.stopPropagation(); dispatch("kickPlayer", { targetUuid: seat.uuid });}} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-fulltransition-colors">
                  <UserMinus size={22}/>
                </button>
              )}
            </div>
          ))}
        </div>
      </main>

      <footer className="h-24 flex justify-center items-center pb-6">
        {isHost ? (
          <button onClick={() => dispatch("startGame")} className="px-16 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-2xl font-black text-lg shadow-[0_10px_25px_rgba(59,130,246,0.3)] transition-all active:scale-95 flex items-center gap-3 tracking-[0.1em]">
            <Play fill="white" size={18}/> 游戏开始
          </button>
        ) : (
          <button onClick={() => dispatch("toggleReady")} className={`px-16 py-3.5 rounded-2xl font-black text-lg transition-all active:scale-95 shadow-md border-2 ${myReadyStatus ? "bg-white/80 border-blue-100 text-blue-300 backdrop-blur-md" : "bg-white border-blue-400 text-blue-500"}`}>
            {myReadyStatus ? "取消准备" : "准备就绪"}
          </button>
        )}
      </footer>

      <style jsx global>{`
        .aether-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .aether-scrollbar::-webkit-scrollbar-track {
          background: transparent;
          margin: 10px 0;
        }
        .aether-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.2);
          border-radius: 10px;
        }
        .aether-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.4);
        }
        .aether-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(59, 130, 246, 0.2) transparent;
        }
      `}</style>
    </div>
  );
}