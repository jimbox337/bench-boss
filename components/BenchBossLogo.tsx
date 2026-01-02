export default function BenchBossLogo({ size = 400 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 0.6}
      viewBox="0 0 500 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Gradient for stick */}
        <linearGradient id="stickGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        {/* Gradient for blade */}
        <linearGradient id="bladeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
      </defs>

      {/* Hockey Stick Shaft */}
      <g>
        {/* Main shaft */}
        <path
          d="M 80 20 L 100 180"
          stroke="url(#stickGradient)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        {/* Grip tape effect */}
        <rect x="74" y="30" width="12" height="6" fill="#1e293b" rx="1" />
        <rect x="74" y="42" width="12" height="6" fill="#1e293b" rx="1" />
        <rect x="74" y="54" width="12" height="6" fill="#1e293b" rx="1" />
      </g>

      {/* Extended Hockey Blade with text */}
      <g>
        {/* Blade base */}
        <path
          d="M 100 180 L 120 190 L 450 190 Q 470 190 470 210 L 470 240 Q 470 260 450 260 L 120 260 L 100 250 Z"
          fill="url(#bladeGradient)"
          stroke="#1e40af"
          strokeWidth="2"
        />

        {/* Blade edge (darker bottom) */}
        <path
          d="M 120 260 L 450 260 Q 470 260 470 250 L 470 245 Q 470 255 450 255 L 120 255 Z"
          fill="#1e3a8a"
          opacity="0.5"
        />

        {/* BENCH BOSS text on blade */}
        <text
          x="285"
          y="235"
          fontSize="48"
          fontWeight="900"
          fill="#ffffff"
          textAnchor="middle"
          fontFamily="Impact, 'Arial Black', sans-serif"
          letterSpacing="3"
        >
          BENCH BOSS
        </text>

        {/* Text shadow/outline effect */}
        <text
          x="285"
          y="235"
          fontSize="48"
          fontWeight="900"
          fill="none"
          stroke="#0f172a"
          strokeWidth="1"
          textAnchor="middle"
          fontFamily="Impact, 'Arial Black', sans-serif"
          letterSpacing="3"
        >
          BENCH BOSS
        </text>
      </g>

      {/* Puck icon above stick */}
      <g transform="translate(60, 10)">
        <ellipse cx="20" cy="10" rx="20" ry="8" fill="#1e293b" />
        <ellipse cx="20" cy="8" rx="20" ry="8" fill="#334155" />
        <ellipse cx="20" cy="8" rx="16" ry="6" fill="#1e293b" />
      </g>
    </svg>
  );
}
