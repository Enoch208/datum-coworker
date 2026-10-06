import { Route, Routes } from "react-router";
import { AppShell } from "./components/chrome/app-shell";
import { RunnerShell } from "./components/runner/runner-shell";
import { CampaignPage } from "./routes/campaign-page";
import { LandingPage } from "./routes/landing-page";
import { NewCampaignPage } from "./routes/new-campaign-page";
import { NotFoundPage } from "./routes/not-found-page";
import { RunnerInboxPage } from "./routes/runner-inbox-page";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/r/:token" element={<RunnerShell />}>
        <Route index element={<RunnerInboxPage />} />
      </Route>
      <Route
        path="*"
        element={
          <AppShell>
            <Routes>
              <Route path="/campaigns/new" element={<NewCampaignPage />} />
              <Route path="/campaigns/:campaignId" element={<CampaignPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  );
}
