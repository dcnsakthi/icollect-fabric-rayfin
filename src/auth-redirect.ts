import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

// MSAL v5 waits on a BroadcastChannel message from this page. Without this call
// the opener hangs until its timeout with no error shown to the user.
broadcastResponseToMainFrame().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  document.body.textContent = `Sign-in could not be completed: ${message}`;
});
