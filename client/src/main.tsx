import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import HomePage from "./pages/HomePage";
import AuthPage from "./pages/AuthPage";
import { Loader2 } from "lucide-react";
import * as React from "react";

const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const MyEventsPage = React.lazy(() => import('./pages/MyEventsPage'));
const EventHistoryPage = React.lazy(() => import('./pages/EventHistoryPage'));

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/admin">
        {() => (
          <React.Suspense fallback={<div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <AdminPage />
          </React.Suspense>
        )}
      </Route>
      <Route path="/my-events">
        {() => (
          <React.Suspense fallback={<div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <MyEventsPage />
          </React.Suspense>
        )}
      </Route>
      <Route path="/events/:eventId/history">
        {() => (
          <React.Suspense fallback={<div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
            <EventHistoryPage />
          </React.Suspense>
        )}
      </Route>
      <Route>404 Page Not Found</Route>
    </Switch>
  );
}

function App() {
  return React.createElement(QueryClientProvider, { client: queryClient }, [
    React.createElement(Router),
    React.createElement(Toaster)
  ]);
}

const container = document.getElementById("root");
if (!container) throw new Error('Failed to find the root element');

const root = createRoot(container);
root.render(
  React.createElement(StrictMode, null,
    React.createElement(App)
  )
);