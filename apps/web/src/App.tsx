import { Route, Routes } from "react-router";
import { AppShell } from "./components/chrome/app-shell";
import { RunnerShell } from "./components/runner/runner-shell";
import { CampaignPage } from "./routes/campaign-page";
import { LandingPage } from "./routes/landing-page";
import { NewCampaignPage } from "./routes/new-campaign-page";
import { NotFoundPage } from "./routes/not-found-page";
import { ReceiptPage } from "./routes/receipt-page";
import { RunnerInboxPage } from "./routes/runner-inbox-page";
import { RunnerTaskPage } from "./routes/runner-task-page";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/campaigns/:campaignId/receipt" element={<ReceiptPage />} />
      <Route path="/r/:token" element={<RunnerShell />}>
        <Route index element={<RunnerInboxPage />} />
        <Route path="tasks/:taskId" element={<RunnerTaskPage />} />
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
