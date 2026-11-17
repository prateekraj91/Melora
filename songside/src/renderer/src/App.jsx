import { useSyncExternalStore } from 'react'
import Overlay from './components/Overlay'
import Fullscreen from './fullscreen/Fullscreen'

// Hash routing: one renderer bundle serves every window. The fullscreen window
// loads '#/fullscreen'; anything else is the v1 overlay.
function subscribeHash(cb) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const getHash = () => window.location.hash

function App() {
  const hash = useSyncExternalStore(subscribeHash, getHash)
  if (hash === '#/fullscreen') return <Fullscreen />
  return <Overlay />
}

export default App
