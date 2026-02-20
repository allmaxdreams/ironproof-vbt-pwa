import { Activity, Bluetooth, Settings, History, AlertTriangle, Play, Square } from 'lucide-react';
import { useBluetooth } from './hooks/useBluetooth';

function App() {
  const {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    velocity,
    peakVelocity,
    resetPeak
  } = useBluetooth();

  // Traffic Light Logic
  // Assuming a theoretical "Best Read" or target velocity is 1.0 m/s for this set.
  // In a real scenario, this would be highest velocity of the CURRENT set.
  // For MVP, we will compare current 'peakVelocity' vs recent drop
  const bestSetVelocity = 1.0;
  let velocityDropPercent = 0;

  if (peakVelocity > 0 && bestSetVelocity > 0) {
    // Just as an example: if peak is 0.8 and best was 1.0, drop is 20%
    velocityDropPercent = Math.max(0, ((bestSetVelocity - peakVelocity) / bestSetVelocity) * 100);
  }

  let statusColor = 'bg-slate-800 border-slate-700';
  let statusText = 'Tracking...';

  if (velocityDropPercent < 5) {
    statusColor = 'bg-emerald-900/30 border-emerald-500/50';
    statusText = 'Stable';
  } else if (velocityDropPercent < 15) {
    statusColor = 'bg-yellow-900/30 border-yellow-500/50';
    statusText = 'Fatigue Building';
  } else if (velocityDropPercent >= 20) {
    statusColor = 'bg-red-900/30 border-red-500/50';
    statusText = 'Stop Set!';

    // Trigger Haptic Feedback (Guardrail limits calls to vibrating)
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="px-4 py-4 bg-slate-800 shadow-xl flex items-center justify-between sticky top-0 z-10 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-lg shadow-lg">
            <Activity className="text-slate-900 drop-shadow-sm" size={20} strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-100 to-cyan-100">
            IronProof
          </h1>
        </div>
        <button
          onClick={isConnected ? disconnect : connect}
          className={`p-2 rounded-full transition-all shadow-md ${isConnected
              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
            }`}
        >
          {isConnecting ? (
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Bluetooth size={20} />
          )}
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 flex flex-col gap-4">

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-xl flex items-center gap-3 text-sm">
            <AlertTriangle size={18} className="text-red-400" />
            {error}
          </div>
        )}

        {!isConnected ? (
          <section className="bg-slate-800 rounded-3xl p-8 border border-slate-700/50 shadow-2xl flex flex-col items-center justify-center flex-1 text-center bg-gradient-to-b from-slate-800 to-slate-800/80">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
              <Bluetooth size={40} className="text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Connect Sensor</h2>
            <p className="text-slate-400 mb-8 max-w-[250px] leading-relaxed">Pair your WT9011DCL via Web Bluetooth to track real-time velocity</p>
            <button
              onClick={connect}
              disabled={isConnecting}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold py-3.5 px-8 rounded-2xl shadow-lg shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50 ring-1 ring-white/20"
            >
              Start Connection
            </button>
          </section>
        ) : (
          <>
            {/* Realtime Dashboard */}
            <section className={`rounded-3xl p-6 border shadow-2xl transition-colors duration-500 ${statusColor}`}>
              <div className="flex justify-between items-center mb-6">
                <span className="text-sm font-semibold text-slate-300 uppercase tracking-widest bg-slate-900/50 px-3 py-1 rounded-full backdrop-blur-sm">
                  Live View
                </span>
                <span className="text-xs font-bold px-2 py-1 rounded bg-slate-900/50">{statusText}</span>
              </div>

              <div className="flex flex-col items-center justify-center py-4">
                <div className="text-7xl font-black tabular-nums tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400 drop-shadow-md">
                  {Math.abs(velocity).toFixed(2)}
                </div>
                <div className="text-sm text-slate-400 font-medium uppercase tracking-widest mt-2">m/s</div>
              </div>
            </section>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-3xl p-5 border border-slate-700 shadow-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Peak V.</span>
                <div className="text-3xl font-bold tabular-nums flex items-baseline gap-1">
                  {peakVelocity.toFixed(2)} <span className="text-xs font-normal text-slate-500">m/s</span>
                </div>
              </div>
              <div className="bg-slate-800 rounded-3xl p-5 border border-slate-700 shadow-xl">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">V. Drop</span>
                <div className="text-3xl font-bold tabular-nums flex items-baseline gap-1 text-slate-300">
                  {velocityDropPercent.toFixed(1)} <span className="text-xs font-normal text-slate-500">%</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-4 mt-auto">
              <button
                onClick={resetPeak}
                className="flex-1 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 font-medium py-4 px-6 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Square size={18} />
                End Set
              </button>
              <button className="flex-2 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-emerald-950 font-bold py-4 px-6 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all active:scale-95 flex items-center justify-center gap-2 backdrop-blur-sm mt-0 border border-emerald-300/50">
                <Play size={18} className="fill-emerald-950" />
                Start Set
              </button>
            </div>
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-slate-800/90 backdrop-blur-md border-t border-slate-700/50 p-2 safe-area-pb z-20">
        <ul className="flex justify-around items-center px-2">
          <li>
            <button className="flex flex-col items-center p-2 text-cyan-400 bg-cyan-400/10 rounded-2xl w-16 transition-colors">
              <Activity size={22} className="mb-1" />
              <span className="text-[10px] font-bold tracking-wide">Flow</span>
            </button>
          </li>
          <li>
            <button className="flex flex-col items-center p-2 text-slate-500 hover:text-slate-300 transition-colors">
              <History size={22} className="mb-1" />
              <span className="text-[10px] font-medium tracking-wide">Log</span>
            </button>
          </li>
          <li>
            <button className="flex flex-col items-center p-2 text-slate-500 hover:text-slate-300 transition-colors">
              <Settings size={22} className="mb-1" />
              <span className="text-[10px] font-medium tracking-wide">Setup</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}

export default App
