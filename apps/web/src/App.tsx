import { Route, Routes } from "react-router";
import { AppShell } from "./components/chrome/app-shell";
import { LandingPage } from "./routes/landing-page";
import { NotFoundPage } from "./routes/not-found-page";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="*"
        element={
          <AppShell>
            <NotFoundPage />
          </AppShell>
        }
      />
    </Routes>
  );
}
