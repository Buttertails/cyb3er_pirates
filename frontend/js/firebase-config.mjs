// Preserve a supplied team config; Hosting supplies its own config when absent.
export async function loadFirebaseConfig(fetcher = globalThis.fetch, moduleUrl = import.meta.url) {
  const configUrl = new URL('./firebaseConfig.json', moduleUrl);
  let response = await fetcher(configUrl);
  if (response.status === 404) {
    response = await fetcher(new URL('/__/firebase/init.json', moduleUrl));
  }
  if (!response.ok) {
    throw new Error('Could not load the Firebase config (' + response.status + '). '
      + 'Provide js/firebaseConfig.json or serve the app through Firebase Hosting.');
  }
  return response.json();
}
