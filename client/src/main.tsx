import * as React from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";
import { Loader2 } from "lucide-react";

const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const MyEventsPage = React.lazy(() => import('./pages/MyEventsPage'));

const App: React.FC = () => {
  return (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/admin">
            <React.Suspense fallback={<div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              <AdminPage />
            </React.Suspense>
          </Route>
          <Route path="/my-events">
            <React.Suspense fallback={<div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
              <MyEventsPage />
            </React.Suspense>
          </Route>
          <Route>404 Page Not Found</Route>
        </Switch>
        <Toaster />
      </QueryClientProvider>
    </React.StrictMode>
  );
};

let root: ReturnType<typeof createRoot> | null = null;

function render() {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Failed to find the root element");
  }

  if (!root) {
    root = createRoot(rootElement);
  }

  root.render(<App />);
}

render();

if (import.meta.hot) {
  import.meta.hot.accept();
}
