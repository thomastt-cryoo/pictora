import { useEffect } from 'react';
import { useStore } from '../state/store';
import { Icon } from './ui/Icon';

export function useHistoryShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('textarea, select, input:not([type=range],[type=checkbox],[type=color])'))) return;
      const key = event.key.toLowerCase();
      const undo = key === 'z' && !event.shiftKey;
      const redo = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.shiftKey);
      if (!undo && !redo) return;
      const state = useStore.getState();
      if (!(undo ? state.history.past.length : state.history.future.length)) return;
      event.preventDefault();
      if (undo) state.undo(); else state.redo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

export function HistoryButtons() {
  const canUndo = useStore((state) => state.history.past.length > 0);
  const canRedo = useStore((state) => state.history.future.length > 0);
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);

  return <div className="history-buttons" role="group" aria-label="Edit history">
    <button type="button" className="icon-button" aria-label="Undo" aria-keyshortcuts="Control+Z Meta+Z" title="Undo (Ctrl/⌘+Z)" disabled={!canUndo} onClick={undo}>
      <Icon name="undo" size={16} /><span>Undo</span>
    </button>
    <button type="button" className="icon-button" aria-label="Redo" aria-keyshortcuts="Control+Y Control+Shift+Z Meta+Shift+Z" title="Redo (Ctrl+Y or ⌘+Shift+Z)" disabled={!canRedo} onClick={redo}>
      <Icon name="redo" size={16} /><span>Redo</span>
    </button>
  </div>;
}
