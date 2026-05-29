import SpendlyLogo from "./SpendlyLogo.jsx";

export default function SpendlyAppLoader({ show, message = "Preparing your dashboard..." }) {
  if (!show) return null;

  return (
    <div className="spendly-app-loader" role="status" aria-live="polite" aria-label={message}>
      <div className="spendly-app-loader-glow spendly-app-loader-glow-one" aria-hidden="true" />
      <div className="spendly-app-loader-glow spendly-app-loader-glow-two" aria-hidden="true" />
      <div className="spendly-loader-content">
        <div className="spendly-loader-logo" aria-label="Spendly logo">
          <SpendlyLogo size="lg" />
        </div>
        <p className="spendly-loader-message">{message}</p>
        <div className="spendly-loader-progress" aria-hidden="true" />
      </div>
    </div>
  );
}
