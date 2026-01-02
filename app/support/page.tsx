'use client';

export default function SupportPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-slate-100 mb-6">Support & Help</h2>

      <div className="space-y-6">
        {/* Getting Started */}
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6">
          <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Getting Started
          </h3>
          <div className="space-y-3 text-slate-300">
            <div>
              <strong className="text-slate-200">1. Connect Your League</strong>
              <p className="text-sm text-slate-400 ml-4 mt-1">
                Go to Settings and connect your ESPN Fantasy Hockey league, or build a custom team manually.
              </p>
            </div>
            <div>
              <strong className="text-slate-200">2. Import Your Team</strong>
              <p className="text-sm text-slate-400 ml-4 mt-1">
                After connecting ESPN, select your team from the dropdown to automatically import your roster.
              </p>
            </div>
            <div>
              <strong className="text-slate-200">3. Optimize Your Lineup</strong>
              <p className="text-sm text-slate-400 ml-4 mt-1">
                Use the Lineup Optimizer to get the best possible lineup based on projections and matchups.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6">
          <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Frequently Asked Questions
          </h3>
          <div className="space-y-4">
            <div>
              <strong className="text-slate-200">How do I connect my ESPN league?</strong>
              <p className="text-sm text-slate-400 mt-1">
                Navigate to League Settings, enter your League ID (found in your ESPN league URL), and for private leagues, provide your espn_s2 and SWID cookies.
              </p>
            </div>
            <div>
              <strong className="text-slate-200">Can I manage multiple teams?</strong>
              <p className="text-sm text-slate-400 mt-1">
                Yes! Click on your profile picture and use "Add New Team" to connect additional leagues or create custom teams.
              </p>
            </div>
            <div>
              <strong className="text-slate-200">How often are player stats updated?</strong>
              <p className="text-sm text-slate-400 mt-1">
                Player stats are synced from the official NHL API and updated in real-time as games are played.
              </p>
            </div>
            <div>
              <strong className="text-slate-200">What scoring formats are supported?</strong>
              <p className="text-sm text-slate-400 mt-1">
                Bench Boss supports both Head-to-Head Points and Head-to-Head Categories leagues. You can customize your scoring settings in League Settings.
              </p>
            </div>
          </div>
        </div>

        {/* Documentation Links */}
        <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700 p-6">
          <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Documentation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <a
              href="/ESPN-INTEGRATION.md"
              target="_blank"
              className="flex items-center gap-2 px-4 py-3 bg-slate-750 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
              <span className="text-slate-200">ESPN Integration Guide</span>
            </a>
            <a
              href="/AUTHENTICATION.md"
              target="_blank"
              className="flex items-center gap-2 px-4 py-3 bg-slate-750 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-slate-200">Authentication Setup</span>
            </a>
          </div>
        </div>

        {/* Contact Support */}
        <div className="bg-gradient-to-br from-blue-900/30 to-slate-800 rounded-xl shadow-sm border border-blue-700/50 p-6">
          <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Need More Help?
          </h3>
          <p className="text-slate-300 mb-4">
            Can't find what you're looking for? Reach out to our support team and we'll help you out.
          </p>
          <div className="flex gap-3">
            <a
              href="mailto:support@benchboss.pro"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Email Support
            </a>
            <a
              href="https://github.com/yourusername/bench-boss/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              Report an Issue
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
