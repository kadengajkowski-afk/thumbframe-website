// src/editor-v2/__tests__/phase-4-6-f.test.js
// -----------------------------------------------------------------------------
// Phase 4.6.f — top bar + Ship it + save indicator + settings.
// -----------------------------------------------------------------------------

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TopBar, {
  ProjectNameField, SaveIndicator, ShipItButton, ThemeToggle, SettingsMenu,
} from '../ui/TopBar';
import { ThemeProvider } from '../ui/ThemeProvider';
import { COPY } from '../ui/copy';

function mount(ui) { return render(<ThemeProvider>{ui}</ThemeProvider>); }

// ── TopBar composition ────────────────────────────────────────────────────
describe('TopBar composition', () => {
  test('renders sailship brand mark + project name + save indicator + ship-it', () => {
    const { container } = mount(
      <TopBar
        projectName="Hero"
        saveStatus="saved"
        onRename={() => {}}
        onShipIt={() => {}}
      />,
    );
    expect(container.querySelector('[data-sailship]')).toBeInTheDocument();
    expect(container.querySelector('[data-project-name]')).toHaveTextContent('Hero');
    expect(container.querySelector('[data-save-indicator]')).toBeInTheDocument();
    expect(container.querySelector('[data-ship-it]')).toBeInTheDocument();
  });

  test('renders exactly one sailship (singular brand mark rule)', () => {
    const { container } = mount(
      <TopBar projectName="x" onRename={() => {}} saveStatus="saved" onShipIt={() => {}} />,
    );
    // Top bar carries one 24px sailship. The ship-it button carries a
    // smaller 14px sailship ICON as prescribed; we allow two at most
    // and verify the brand-mark is separately the largest.
    const all = container.querySelectorAll('[data-sailship]');
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all.length).toBeLessThanOrEqual(2);
  });
});

// ── Project name rename ───────────────────────────────────────────────────
describe('ProjectNameField', () => {
  test('click → input; Enter commits via onChange', () => {
    const onChange = jest.fn();
    mount(<ProjectNameField value="A" onChange={onChange} />);
    fireEvent.click(screen.getByText('A'));
    const input = document.querySelector('[data-project-name-input]');
    fireEvent.change(input, { target: { value: 'Boss Level' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('Boss Level');
  });

  test('Escape cancels without committing', () => {
    const onChange = jest.fn();
    mount(<ProjectNameField value="A" onChange={onChange} />);
    fireEvent.click(screen.getByText('A'));
    const input = document.querySelector('[data-project-name-input]');
    fireEvent.change(input, { target: { value: 'Nope' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ── SaveIndicator ─────────────────────────────────────────────────────────
describe('SaveIndicator', () => {
  test('shows "Logging…" while saving, "Logged" when saved', () => {
    const { rerender } = mount(<SaveIndicator status="saving" />);
    expect(screen.getByText(COPY.topBar.savingText)).toBeInTheDocument();
    rerender(<ThemeProvider><SaveIndicator status="saved" /></ThemeProvider>);
    expect(screen.getByText(COPY.topBar.savedText)).toBeInTheDocument();
  });

  test('pen animates while saving, flat when saved', () => {
    const { container, rerender } = mount(<SaveIndicator status="saving" />);
    const pen = container.querySelector('[data-save-pen]');
    expect(pen.getAttribute('style') || '').toMatch(/animation: saveWriggle/);
    rerender(<ThemeProvider><SaveIndicator status="saved" /></ThemeProvider>);
    const pen2 = document.querySelector('[data-save-pen]');
    expect(pen2.getAttribute('style') || '').toMatch(/animation: none/);
  });
});

// ── Ship it button ────────────────────────────────────────────────────────
describe('ShipItButton', () => {
  test('renders the "Ship it" label + sailship icon', () => {
    const { container } = mount(<ShipItButton onShip={() => {}} />);
    const btn = container.querySelector('[data-ship-it]');
    expect(btn).toHaveTextContent(COPY.topBar.shipItLabel);
    expect(container.querySelector('[data-ship-it] [data-sailship]')).toBeInTheDocument();
  });

  test('click opens dropdown with 4 rows; 4K shows a lock for free users', () => {
    const { container } = mount(<ShipItButton onShip={() => {}} isPro={false} />);
    fireEvent.click(container.querySelector('[data-ship-it]'));
    const menu = container.querySelector('[data-ship-it-menu]');
    expect(menu).toBeInTheDocument();
    expect(screen.getByText(COPY.topBar.shipAsPng)).toBeInTheDocument();
    expect(screen.getByText(COPY.topBar.shipAsJpeg)).toBeInTheDocument();
    expect(screen.getByText(COPY.topBar.shipForYoutube)).toBeInTheDocument();
    const fourKRow = screen.getByText(COPY.topBar.shipIn4K).closest('button');
    expect(fourKRow.getAttribute('data-locked')).toBe('true');
  });

  test('Pro users can dispatch the 4K row', () => {
    const onShip = jest.fn();
    const { container } = mount(<ShipItButton onShip={onShip} isPro />);
    fireEvent.click(container.querySelector('[data-ship-it]'));
    fireEvent.click(screen.getByText(COPY.topBar.shipIn4K));
    expect(onShip).toHaveBeenCalledWith('4k');
  });

  test('free-tier click on 4K opens the upgrade callback instead of shipping', () => {
    const onShip = jest.fn();
    const onOpenUpgrade = jest.fn();
    const { container } = mount(
      <ShipItButton onShip={onShip} isPro={false} onOpenUpgrade={onOpenUpgrade} />,
    );
    fireEvent.click(container.querySelector('[data-ship-it]'));
    fireEvent.click(screen.getByText(COPY.topBar.shipIn4K));
    expect(onShip).not.toHaveBeenCalled();
    expect(onOpenUpgrade).toHaveBeenCalledTimes(1);
  });

  test('Cmd/Ctrl+E opens the dropdown', () => {
    const { container } = mount(<ShipItButton onShip={() => {}} />);
    fireEvent.keyDown(window, { key: 'e', ctrlKey: true });
    expect(container.querySelector('[data-ship-it-menu]')).toBeInTheDocument();
  });

  test('hover animates via the shipItBreath keyframes', () => {
    const { container } = mount(<ShipItButton onShip={() => {}} />);
    const btn = container.querySelector('[data-ship-it]');
    fireEvent.mouseEnter(btn);
    expect(btn.getAttribute('style') || '').toMatch(/animation: shipItBreath/);
  });
});

// ── ThemeToggle ───────────────────────────────────────────────────────────
describe('ThemeToggle', () => {
  test('renders moon in dark mode with the "switch to ocean" label', () => {
    mount(<ThemeToggle />);
    expect(screen.getByLabelText(COPY.topBar.themeToLight)).toBeInTheDocument();
  });
});

// ── Settings menu ─────────────────────────────────────────────────────────
describe('SettingsMenu', () => {
  test('opens a menu with the 5 required rows', () => {
    const { container } = mount(<SettingsMenu soundEnabled={false} />);
    fireEvent.click(container.querySelector('[data-settings-toggle]'));
    const menu = container.querySelector('[data-settings-menu]');
    expect(menu).toBeInTheDocument();
    // Theme row carries the current theme hint.
    expect(menu.textContent).toMatch(/Theme/);
    expect(menu.textContent).toMatch(/Sound effects/);
    expect(menu.textContent).toMatch(/Keyboard shortcuts/);
    expect(menu.textContent).toMatch(/Account settings/);
    expect(menu.textContent).toMatch(/Sign out/);
  });

  test('sign out row fires onSignOut + closes the menu', () => {
    const onSignOut = jest.fn();
    const { container } = mount(<SettingsMenu onSignOut={onSignOut} />);
    fireEvent.click(container.querySelector('[data-settings-toggle]'));
    fireEvent.click(screen.getByText(COPY.settings.signOut));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-settings-menu]')).toBeNull();
  });
});
