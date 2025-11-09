export async function onRequest() {
  return new Response(JSON.stringify([{ id: 'test', guest: 'Test User' }]), {
    headers: { 'Content-Type': 'application/json' },
  });
}
