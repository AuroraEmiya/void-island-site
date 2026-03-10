import RoomClientPage from "./RoomClient";

// 这是一个服务端组件，它只负责接住 URL 里的 roomId
export default async function Page({ params }) {
  const { roomId } = params;

  // 直接渲染客户端组件，不需要在服务端读 cookie
  // 所有的 sessionId 校验都在 RoomClientPage 的 useEffect 里通过 localStorage 完成
  return <RoomClientPage roomId={roomId} />;
}