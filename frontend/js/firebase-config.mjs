// Preserve a supplied team config; Hosting supplies its own config when absent.
export async function loadFirebaseConfig(fetcher = globalThis.fetch, moduleUrl = import.meta.url) {
  const configUrl = new URL('./firebaseConfig.json', moduleUrl);
  let response = await fetcher(configUrl);
  if (response.ok) {
    try {
      const config = await response.json();
      if (config && typeof config.apiKey === 'string' && typeof config.projectId === 'string') {
        return config;
      }
    } catch {
      // Hosting's SPA rewrite can return index.html with HTTP 200 here.
    }
  } else if (response.status !== 404) {
    throw new Error('Could not load the Firebase config (' + response.status + ').');
  }
  response = await fetcher(new URL('/__/firebase/init.json', moduleUrl));
  if (!response.ok) {
    throw new Error('Could not load the Firebase config (' + response.status + '). '
      + 'Provide js/firebaseConfig.json or serve the app through Firebase Hosting.');
  }
  const config = await response.json();
  if (!config || typeof config.apiKey !== 'string' || typeof config.projectId !== 'string') {
    throw new Error('Could not load a valid Firebase config.');
  }
  return config;
}
