import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { useStore } from './store';
import { GameScreen } from './screens/Game';
import { About, Archives, ModeSelect, SettingsScreen, Setup, Title } from './screens/Menus';
import { Friends, Lobby, savedName } from './screens/Friends';
import { ConnectionBanner, Thinking } from './components/Online';
import { joinRoom, ROOM_SERVER, savedToken } from './room';
import { CODE_RE } from '../../server/src/protocol';

/** A share link (/?room=ABCD) opens the join screen with the code filled in, or rejoins a seat this browser holds. */
function openShareLink(): void {
  if (!ROOM_SERVER) return;
  let code: string | null = null;
  try {
    code = new URL(window.location.href).searchParams.get('room')?.toUpperCase() ?? null;
  } catch {
    return;
  }
  if (!code || !CODE_RE.test(code)) return;
  const name = savedName();
  if (savedToken(code) && name) {
    joinRoom(code, name);
    useStore.setState({ screen: 'lobby' });
  } else useStore.setState({ friendsFor: { tab: 'join', code }, screen: 'friends' });
}

export function App() {
  const screen = useStore((s) => s.screen);
  const settings = useStore((s) => s.settings);
  useEffect(openShareLink, []);
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-size', settings.textSize);
  }, [settings.theme, settings.textSize]);
  return (
    <MotionConfig reducedMotion={settings.reducedMotion ? 'always' : 'user'}>
      {screen === 'title' && <Title />}
      {screen === 'mode' && <ModeSelect />}
      {screen === 'setup' && <Setup />}
      {screen === 'game' && <GameScreen />}
      {screen === 'archives' && <Archives />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'about' && <About />}
      {screen === 'friends' && <Friends />}
      {screen === 'lobby' && <Lobby />}
      <ConnectionBanner />
      {screen === 'game' && <Thinking />}
    </MotionConfig>
  );
}
