'use client';

import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="text-6xl mb-4">🏒</div>
          <h1 className="text-6xl font-bold text-white mb-4">
            Bench Boss
          </h1>
          <p className="text-2xl text-blue-200 mb-8">
            Your Ultimate Fantasy Hockey Assistant
          </p>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Optimize your lineup, analyze trades, find waiver wire gems, and dominate your league with real-time NHL data and advanced analytics.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 text-center">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="text-xl font-bold text-white mb-2">Lineup Optimizer</h3>
            <p className="text-slate-300 text-sm">
              Automatically set your best lineup based on projections and matchups
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 text-center">
            <div className="text-4xl mb-3">🔄</div>
            <h3 className="text-xl font-bold text-white mb-2">Trade Analyzer</h3>
            <p className="text-slate-300 text-sm">
              Evaluate trades instantly with data-driven insights
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 text-center">
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="text-xl font-bold text-white mb-2">Waiver Targets</h3>
            <p className="text-slate-300 text-sm">
              Discover hidden gems before your competition
            </p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={() => router.push('/login')}
            className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-lg transition-all shadow-lg hover:shadow-xl"
          >
            Get Started
          </button>
          <button
            onClick={() => router.push('/login')}
            className="w-full sm:w-auto px-8 py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg rounded-lg transition-all border border-slate-600"
          >
            Sign In
          </button>
        </div>

        {/* Features List */}
        <div className="mt-16 bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">What You Get</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <span className="text-green-400 text-xl">✓</span>
              <span className="text-slate-200">Real-time NHL player data and stats</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-green-400 text-xl">✓</span>
              <span className="text-slate-200">Weekly projections and rankings</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-green-400 text-xl">✓</span>
              <span className="text-slate-200">Start/Sit recommendations</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-green-400 text-xl">✓</span>
              <span className="text-slate-200">Player comparison tools</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-green-400 text-xl">✓</span>
              <span className="text-slate-200">League settings customization</span>
            </div>
            <div className="flex items-start space-x-3">
              <span className="text-green-400 text-xl">✓</span>
              <span className="text-slate-200">Advanced analytics dashboard</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
