export default function SpendlyLogo({ size = "md", stacked = false }) {
  const dimensions = size === "lg" ? "h-20" : size === "sm" ? "h-10" : "h-14";
  const textSize = size === "lg" ? "text-5xl" : size === "sm" ? "text-2xl" : "text-3xl";

  return (
    <div className={`flex items-center ${stacked ? "justify-start" : ""} gap-3`}>
      <svg className={`${dimensions} w-auto shrink-0 drop-shadow-[0_0_18px_rgba(139,92,246,0.34)]`} viewBox="0 0 122 92" fill="none" aria-hidden="true">
        <rect x="18" y="28" width="78" height="50" rx="12" fill="url(#walletBody)" stroke="#2a174f" strokeWidth="3" />
        <path d="M28 33l61-16c7-2 13 2 15 9l9 35H41L28 33z" fill="#a7d8b8" stroke="#2a174f" strokeWidth="3" />
        <path d="M40 36l49-13c3-.8 6 1 7 4l6 23H45L40 36z" fill="#bfe8c7" opacity=".85" />
        <path d="M55 40h22M55 47h15M62 36v19" stroke="#5b9b7b" strokeWidth="4" strokeLinecap="round" />
        <rect x="70" y="48" width="44" height="25" rx="12.5" fill="url(#walletFlap)" stroke="#2a174f" strokeWidth="3" />
        <circle cx="86" cy="60.5" r="6.5" fill="#c4a6ff" />
        <rect x="31" y="18" width="13" height="22" rx="4" fill="#7c3aed" stroke="#2a174f" strokeWidth="2" />
        <rect x="48" y="14" width="13" height="26" rx="4" fill="#8b5cf6" stroke="#2a174f" strokeWidth="2" />
        <rect x="65" y="9" width="13" height="31" rx="4" fill="#7c3aed" stroke="#2a174f" strokeWidth="2" />
        <rect x="82" y="3" width="13" height="37" rx="4" fill="#6d28d9" stroke="#2a174f" strokeWidth="2" />
        <path d="M103 2l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8z" fill="#c084fc" stroke="#2a174f" strokeWidth="2" />
        <defs>
          <linearGradient id="walletBody" x1="18" x2="96" y1="25" y2="82" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a78bfa" />
            <stop offset=".55" stopColor="#7c3aed" />
            <stop offset="1" stopColor="#4c1d95" />
          </linearGradient>
          <linearGradient id="walletFlap" x1="70" x2="114" y1="48" y2="73" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a78bfa" />
            <stop offset="1" stopColor="#6d28d9" />
          </linearGradient>
        </defs>
      </svg>
      <span className={`${textSize} font-black tracking-normal text-white drop-shadow-[0_2px_0_rgba(15,23,42,0.65)]`}>
        Spendly
      </span>
    </div>
  );
}
