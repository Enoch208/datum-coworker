import { Route, Routes } from "react-router";
import { AppShell } from "./components/chrome/app-shell";
import { CampaignPage } from "./routes/campaign-page";
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
            <Routes>
              <Route path="/campaigns/:campaignId" element={<CampaignPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  );
}
