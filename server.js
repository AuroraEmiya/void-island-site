const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const express = require("express");
const socketHandler = require("./server/state/socketHandler"); // 引入逻辑模块

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);
  const io = new Server(httpServer);

  // --- 核心变化：将 io 实例传给逻辑处理器 ---
  socketHandler(io);

  // 路由接管
  server.all(/^(?!\/api).*$/, (req, res) => {
    const parsedUrl = parse(req.url, true);
    return handle(req, res, parsedUrl);
  });

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Aether Core 运行成功: http://localhost:${PORT}`);
  });
});