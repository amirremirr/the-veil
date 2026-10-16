import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { useStore } from './store';
import { GameScreen } from './screens/Game';
import { About, Archives, ModeSelect, SettingsScreen, Setup, Title } from './screens/Menus';

export function App() {
  const screen = useStore((s) => s.screen);
  const settings = useStore((s) => s.settings);
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
    </MotionConfig>
  );
}
