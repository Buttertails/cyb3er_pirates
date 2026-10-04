import { useEffect, useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { Header } from './components.jsx';
import {
  CategoryPage,
  LocationPage,
  OfficePage,
  ProcedurePage,
  TimingPage,
} from './pages/IntakePages.jsx';
import { SignInPage, SignupPage } from './pages/AccountPages.jsx';
import { ConfirmPage, ResultsPage, SummaryPage } from './pages/ResultsPages.jsx';
import { LocationCheckPage, ProceduresPage, ProfilePage } from './pages/ProfilePages.jsx';
import { ROUTES } from './lib/storage.js';

const EXIT_DURATION = 160;

function AnimatedRoutes() {
  const location = useLocation();
  const [displayedLocation, setDisplayedLocation] = useState(location);
  const [phase, setPhase] = useState('enter');
  const requestedKey = `${location.pathname}${location.search}`;
  const displayedKey = `${displayedLocation.pathname}${displayedLocation.search}`;

  useEffect(() => {
    if (requestedKey === displayedKey) return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setDisplayedLocation(location);
      setPhase('enter');
      return undefined;
    }
    setPhase('exit');
    const timer = window.setTimeout(() => {
      setDisplayedLocation(location);
      setPhase('enter');
      window.scrollTo({ top: 0 });
    }, EXIT_DURATION);
    return () => window.clearTimeout(timer);
  }, [requestedKey, displayedKey, location]);

  return (
    <div className={`route-stage page-${phase}`} aria-busy={phase === 'exit'}>
      <Routes location={displayedLocation}>
        <Route path="/" element={<SignInPage />} />
        <Route path={ROUTES.signIn} element={<SignInPage />} />
        <Route path={ROUTES.signup} element={<SignupPage />} />
        <Route path={ROUTES.location} element={<LocationPage />} />
        <Route path={ROUTES.office} element={<OfficePage />} />
        <Route path={ROUTES.category} element={<CategoryPage />} />
        <Route path={ROUTES.procedure} element={<ProcedurePage />} />
        <Route path={ROUTES.timing} element={<TimingPage />} />
        <Route path={ROUTES.confirm} element={<ConfirmPage />} />
        <Route path={ROUTES.results} element={<ResultsPage />} />
        <Route path={ROUTES.procedures} element={<ProceduresPage />} />
        <Route path={ROUTES.locationCheck} element={<LocationCheckPage />} />
        <Route path={ROUTES.profile} element={<ProfilePage />} />
        <Route path={ROUTES.summary} element={<SummaryPage />} />
        <Route path="*" element={<Navigate to={ROUTES.signIn} replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <AnimatedRoutes />
    </>
  );
}
