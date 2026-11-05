import { Suspense, lazy, useEffect } from 'react';
import { RouterProvider, useRoute } from './router/index.tsx';
import { StoreProvider, useStore } from './store/index.tsx';
import { LangContext, useT } from './i18n/index.tsx';
import { LiveProvider } from './components/Live.tsx';
import { Layout } from './components/Layout.tsx';
import { StartPage } from './pages/Start.tsx';
import { SurveyPage } from './pages/Survey.tsx';
import { ResultsPage } from './pages/Results.tsx';
import { RoadmapPage } from './pages/Roadmap.tsx';
import { AssistantDrawer } from './components/Assistant.tsx';
import { Tour } from './components/Tour.tsx';

const CalculatorPage = lazy(() => import('./pages/Calculator.tsx').then((m) => ({ default: m.CalculatorPage })));
const AdminRouter = lazy(() => import('./pages/admin/AdminRouter.tsx').then((m) => ({ default: m.AdminRouter })));
const InvestorsPage = lazy(() => import('./pages/Investors.tsx').then((m) => ({ default: m.InvestorsPage })));
const PolicyPage = lazy(() => import('./pages/Policy.tsx').then((m) => ({ default: m.PolicyPage })));
const EvaluatorsPage = lazy(() => import('./pages/Evaluators.tsx').then((m) => ({ default: m.EvaluatorsPage })));
const AccessibilityPage = lazy(() => import('./pages/Accessibility.tsx').then((m) => ({ default: m.AccessibilityPage })));
const AccountPage = lazy(() => import('./pages/Account.tsx').then((m) => ({ default: m.AccountPage })));

function Pages() {
  const { path } = useRoute();
  const t = useT();
  useEffect(() => {
    // move focus to main on route change for screen-reader and keyboard users
    const main = document.getElementById('main');
    if (main && document.activeElement !== document.body) main.focus({ preventScroll: false });
    window.scrollTo(0, 0);
  }, [path]);
  let page: React.ReactNode;
  if (path === '/') page = <StartPage />;
  else if (path.startsWith('/assess')) page = <SurveyPage />;
  else if (path.startsWith('/results')) page = <ResultsPage />;
  else if (path.startsWith('/roadmap')) page = <RoadmapPage />;
  else if (path.startsWith('/calculator')) page = <CalculatorPage />;
  else if (path.startsWith('/admin')) page = <AdminRouter />;
  else if (path.startsWith('/investors')) page = <InvestorsPage />;
  else if (path.startsWith('/policy')) page = <PolicyPage />;
  else if (path.startsWith('/evaluators')) page = <EvaluatorsPage />;
  else if (path.startsWith('/accessibility')) page = <AccessibilityPage />;
  else if (path.startsWith('/account')) page = <AccountPage />;
  else page = <NotFound />;
  return <Suspense fallback={<p role="status">{t.common.loading}</p>}>{page}</Suspense>;
}

function NotFound() {
  return (
    <div>
      <h1>Page not found</h1>
      <p><a href="#/">Back to start</a></p>
    </div>
  );
}

function Shell() {
  const { state } = useStore();
  useEffect(() => {
    document.title = `Nutrition Data Hub — concept`;
  }, []);
  return (
    <LangContext.Provider value={state.lang}>
      <LiveProvider>
        <Layout>
          <Pages />
        </Layout>
        <AssistantDrawer />
        <Tour />
      </LiveProvider>
    </LangContext.Provider>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <RouterProvider>
        <Shell />
      </RouterProvider>
    </StoreProvider>
  );
}
