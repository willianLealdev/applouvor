import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/lib/auth";
import Dashboard from "@/pages/dashboard";
import Songs from "@/pages/songs";
import Services from "@/pages/services";
import Repertoire from "@/pages/repertoire";
import Members from "@/pages/members";
import Login from "@/pages/login";
import ChangePassword from "@/pages/change-password";
import ResetPassword from "@/pages/reset-password";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function Router() {
  const { user } = useAuth();
  const canAccessSongs = user?.role === "admin" || user?.role === "lider";
  const canAccessMembers = user?.role === "admin" || user?.role === "lider";

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      {canAccessSongs && <Route path="/songs" component={Songs} />}
      <Route path="/services" component={Services} />
      <Route path="/services/:id" component={Services} />
      <Route path="/repertoire/:id" component={Repertoire} />
      {canAccessMembers && <Route path="/members" component={Members} />}
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/reset-password" component={ResetPassword} />
        <Route component={Login} />
      </Switch>
    );
  }

  if (user.mustChangePassword) {
    return <ChangePassword />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
