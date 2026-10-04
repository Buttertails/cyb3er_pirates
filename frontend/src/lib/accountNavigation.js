export function signInRouteDecision(authEmail, savedEmail) {
  if (authEmail && authEmail === savedEmail) return 'resume';
  if (authEmail) return 'hydrate';
  return savedEmail ? 'clear' : 'signin';
}
