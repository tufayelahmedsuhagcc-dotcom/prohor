import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "./styles.css";
import App, { ErrorBoundary } from "./App";
import { Provider } from "./lib/context";
import { applyTheme, getTheme } from "./lib/theme";

// index.html applies this before first paint; this is the belt to that braces
// for the case where the inline script was blocked by a browser setting.
applyTheme(getTheme());
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <Provider>
      <App />
    </Provider>
  </ErrorBoundary>,
);
