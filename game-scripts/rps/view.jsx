import React from 'react';

export default function RPSView({ gameState, players, myUuid, onAction }) {
  if (!gameState || !gameState.losers) return <div className="text-white">加载战场中...</div>;
  const isLoser = gameState.losers.includes(myUuid);
  const myChoice = gameState.playerChoices[myUuid];
  const winnerId = gameState.winner || (gameState.finalResults?.winner);
  const winnerData = players.find(p => p && p.uuid === winnerId);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-900/20 rounded-[2rem]">
      {/* 1. 圆桌区域 */}
      <div className="relative w-64 h-64 rounded-full border-4 border-dashed border-white/10 flex items-center justify-center">
        <div className="text-white/20 font-black tracking-tighter text-2xl uppercase">Aether Table</div>
        
        {/* 动态渲染座位上的玩家 */}
        {players.map((p, i) => {
          if (!p) return null;
          const angle = (i * 360) / players.length;
          const choice = gameState.playerChoices[p.uuid];
          const isAlive = !gameState.losers.includes(p.uuid);

          return (
            <div 
              key={p.uuid}
              /* 修改点 1: 添加 absolute left-1/2 top-1/2 确保起点在圆心 */
              /* 修改点 2: transform 逻辑开头必须加上 -50%, -50% 的位移修正 */
              className="absolute left-1/2 top-1/2 transition-all duration-500"
              style={{ 
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-160px) rotate(-${angle}deg)` 
              }}
            >
            {!winnerId && 
            <div className={`flex flex-col items-center group transition-all duration-300 ${!isAlive ? 'opacity-30 grayscale scale-90' : 'scale-110'}`}>
              <div className={`
                w-16 h-16 rounded-2xl p-0.5 shadow-lg relative transition-all
                ${choice ? (isAlive ? "bg-emerald-400" : "bg-slate-400") : "bg-blue-400"}
              `}>
                <div className="w-full h-full rounded-[0.85rem] overflow-hidden bg-white/90 relative">
                  <img 
                    src={`/avatar/${p.avatar}.png`} 
                    className={`w-full h-full object-cover ${choice === 'WAITING' ? 'blur-[1px] opacity-80' : ''}`} 
                  />
                </div>
              </div>
              
              {/* 状态泡泡与名称 */}
              <div className="flex flex-col items-center -mt-1 z-10">
                <span className="text-[11px] font-black text-white bg-slate-800/80 px-2 py-0.5 rounded-full backdrop-blur-md mb-1 border border-white/10">
                  {p.username}
                </span>
                <div className={`px-2 py-0.5 rounded-md text-[12px] font-black uppercase tracking-tighter shadow-sm
                  ${choice === 'WAITING' ? "bg-emerald-500 text-white animate-pulse" : "bg-white/80 text-blue-800"}
                `}>
                  {choice === 'WAITING' ? "已完成选择" : (choice === 'rock' ? '✊ 石头' : choice === 'paper' ? '✋ 布' : choice === 'scissor' ? '✌️ 剪刀' : "思考中...")}
                </div>
              </div>
            </div>}
          </div>
          );
        })}
      </div>

      {/* 2. 右侧操作面板 */}
      {!winnerId && <div className="absolute right-8 top-1/2 -translate-y-1/2 w-48 flex flex-col gap-4">
        {isLoser ? (
          <div className="p-4 bg-gray-500/80 border border-red-500/50 rounded-2xl text-red-300 text-s font-black text-center">
            您已落败，请等待其他玩家决出胜者
          </div>
        ) : gameState.phase === 'REVEAL' ? (
          <div className="p-4 bg-gray-500/80 border border-blue-500/50 rounded-2xl text-blue-300 text-s font-black text-center animate-pulse">
            揭晓结果中...
          </div>
        ) : myChoice ? (
          <div className="p-4 bg-gray-500/80 border border-white/10 rounded-2xl text-slate-400 text-s font-black text-center">
            请等待其他玩家选择完毕
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <span className="text-[16px] text-blue-400 bg-gray-600 font-bold text-center uppercase tracking-widest mb-1">请选择你的操作</span>
            {['rock', 'paper', 'scissors'].map(type => (
              <button
                key={type}
                onClick={() => onAction('cast', { choice: type })}
                className="py-3 bg-black hover:bg-blue-500 rounded-xl text-white text-xs font-black transition-all border border-white/5 active:scale-95 capitalize"
              >
                {type === 'rock' ? '✊ 石头' : type === 'paper' ? '✋ 布' : '✌️ 剪刀'}
              </button>
            ))}
          </div>
        )}
      </div>}

      {winnerId && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 animate-in zoom-in fade-in duration-500">
          <div className="bg-gradient-to-r from-transparent via-amber-500/90 to-transparent w-full py-8 mb-4 shadow-[0_0_50px_rgba(245,158,11,0.3)]">
            <h1 className="text-white text-6xl font-black text-center italic tracking-tighter uppercase drop-shadow-2xl">
              CONGRATULATIONS
            </h1>
          </div>
          <div className="flex flex-col items-center gap-4 bg-slate-800/60 p-6 rounded-[2.5rem] border border-amber-400/50 backdrop-blur-xl shadow-2xl">
             <div className="w-24 h-24 rounded-3xl border-4 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)] overflow-hidden">
                <img src={`/avatar/${winnerData?.avatar}.png`} className="w-full h-full object-cover" />
             </div>
             <div className="text-center">
                <p className="text-amber-400 text-sm font-bold tracking-widest uppercase">本轮游戏的胜者是：</p>
                <p className="text-white text-4xl font-black">{winnerData?.username || "神秘玩家"}</p>
             </div>
             <div className="text-white/40 text-[10px] font-mono mt-2 animate-pulse">10秒后返回等待界面...</div>
          </div>
        </div>
      )}

      {/* 底部结果提示 */}
      {!winnerId && gameState.lastRoundResult && (
        <div className="absolute bottom-8 px-6 py-2 bg-black/40 backdrop-blur-md rounded-full text-white text-[14px] font-bold border border-white/10">
          系统播报: {gameState.lastRoundResult}
        </div>
      )}
    </div>
  );
}