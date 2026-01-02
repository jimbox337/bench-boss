export default function BenchBossLogo({ size = 200 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <circle cx="100" cy="100" r="95" fill="#1e40af" />
      <circle cx="100" cy="100" r="85" fill="#1e293b" />

      {/* Hockey stick */}
      <g transform="translate(50, 60)">
        {/* Stick shaft */}
        <rect
          x="40"
          y="0"
          width="8"
          height="70"
          rx="4"
          fill="#94a3b8"
          transform="rotate(-15 44 0)"
        />
        {/* Stick blade */}
        <path
          d="M 30 75 Q 35 80 45 80 L 65 80 Q 70 80 70 85 L 70 90 Q 70 95 65 95 L 30 95 Q 25 95 25 90 Z"
          fill="#94a3b8"
        />
      </g>

      {/* Whistle */}
      <g transform="translate(100, 50)">
        <circle cx="0" cy="0" r="12" fill="#fbbf24" />
        <circle cx="0" cy="0" r="8" fill="#92400e" />
        <circle cx="-3" cy="-2" r="2" fill="#fbbf24" />
        <rect x="-2" y="10" width="4" height="15" rx="2" fill="#fbbf24" />
      </g>

      {/* Clipboard */}
      <g transform="translate(85, 120)">
        {/* Clipboard base */}
        <rect x="0" y="0" width="35" height="45" rx="3" fill="#475569" />
        <rect x="3" y="3" width="29" height="39" rx="2" fill="#f1f5f9" />

        {/* Clip */}
        <rect x="12" y="-3" width="11" height="6" rx="3" fill="#64748b" />

        {/* Lines on clipboard */}
        <line x1="8" y1="12" x2="27" y2="12" stroke="#94a3b8" strokeWidth="1.5" />
        <line x1="8" y1="18" x2="27" y2="18" stroke="#94a3b8" strokeWidth="1.5" />
        <line x1="8" y1="24" x2="27" y2="24" stroke="#94a3b8" strokeWidth="1.5" />
        <line x1="8" y1="30" x2="20" y2="30" stroke="#94a3b8" strokeWidth="1.5" />
      </g>

      {/* Text "BB" */}
      <text
        x="100"
        y="180"
        fontSize="36"
        fontWeight="bold"
        fill="#3b82f6"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        BB
      </text>
    </svg>
  );
}
