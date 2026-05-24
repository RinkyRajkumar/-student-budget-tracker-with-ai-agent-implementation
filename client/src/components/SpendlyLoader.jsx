import SpendlyLogo from "./SpendlyLogo.jsx";

export default function SpendlyLoader({ show, message = "Preparing your dashboard..." }) {
  if (!show) return null;

  return (
    <div className="spendly-loader-overlay" role="status" aria-live="polite" aria-label={message}>
      <div className="spendly-loader-orb spendly-loader-orb-one" aria-hidden="true" />
      <div className="spendly-loader-orb spendly-loader-orb-two" aria-hidden="true" />
      <div className="spendly-loader-card">
        <div className="spendly-loader-logo" aria-label="Spendly logo">
          <SpendlyLogo size="lg" />
        </div>
        <p className="spendly-loader-text">{message}</p>
        <div className="spendly-loader-progress" aria-hidden="true" />
      </div>
    </div>
  );
}
