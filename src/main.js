// Application entry: connection status and the independently maintained page tree.
import './connection-status.js';
import './app/mount.js';
import { y as toast } from './vendor/recovered-runtime.js';
import { listenNativeNotifications } from './platform/native-notifications.js';

listenNativeNotifications(message => toast.info(message, {
  position: 'bottom-right',
  autoClose: 3000,
  closeOnClick: true
})).then(unlisten => {
  window.addEventListener('pagehide', unlisten, { once: true });
}).catch(error => console.error('Failed to listen for desktop notifications:', error));
