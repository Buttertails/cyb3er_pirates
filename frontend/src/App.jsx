import { useEffect, useState } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { Header, LightPurpleBackground, OrangeBackground, PurpleBackground } from './components.jsx';
import { SignInPage, SignupPage } from './pages/AccountPages.jsx';
import { ChatPage } from './pages/ChatPage.jsx';
import { SummaryPage } from './pages/ResultsPages.jsx';
import { ProfilePage } from './pages/ProfilePages.jsx';
import { LEGACY_CHAT_PATHS, ROUTES } from './lib/storage.js';

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
        <Route path={ROUTES.signup} element={<SignupPage key={displayedLocation.search} />} />
        {/* Keyed by the query so "Update info" restarts an open chat. */}
        <Route path={ROUTES.chat} element={<ChatPage key={displayedLocation.search} />} />
        {LEGACY_CHAT_PATHS.map((path) => (
          <Route key={path} path={path} element={<Navigate to={ROUTES.chat} replace />} />
        ))}
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
      <LightPurpleBackground />
      <OrangeBackground />
      <PurpleBackground />
      <Header />
      <AnimatedRoutes />
    </>
  );
}
