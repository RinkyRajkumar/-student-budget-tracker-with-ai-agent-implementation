import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-8 text-ink">
          <section className="card max-w-lg p-6">
            <h1 className="text-xl font-bold tracking-normal">The dashboard could not load</h1>
            <p className="mt-2 text-sm text-slate-400">
              Clear this site&apos;s local data or refresh after the dev server restarts.
            </p>
            <pre className="mt-4 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-white">
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
