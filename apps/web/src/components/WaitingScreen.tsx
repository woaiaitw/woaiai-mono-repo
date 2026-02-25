export function WaitingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="inline-block w-12 h-12 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-xl text-gray-400">Waiting for host...</p>
        <p className="text-sm text-gray-500">
          The broadcast will begin when a host joins
        </p>
      </div>
    </div>
  );
}
