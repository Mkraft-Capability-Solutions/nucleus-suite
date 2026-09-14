# Skill: Add a New Voice Command

## When to Use
When adding a new command to Nucleus Talk (voice navigation system).

## Step-by-Step

### Step 1: Add Pattern to voiceCommandEngine.ts

File: `src/utils/voiceCommandEngine.ts`

```ts
// In parseVoiceCommand() — add a new pattern match
if (/\b(go to|open|show)\b.*\b(your_feature)\b/i.test(normalised)) {
  return {
    type: 'TAB',
    target: 'your_tab_id',
    domain: 'your_domain',
    speechText: 'Opening your feature now.',
  };
}
```

Match position matters — put more specific patterns BEFORE general ones.

### Step 2: Handle the Result in VoiceNavigator.js

File: `src/components/VoiceNavigator.js`

In the `executeCommand()` function, handle your new result:

```js
// For TAB navigation — already handled generically
if (result.type === 'TAB') {
  speakAloud(result.speechText);
  onTabChange?.(result.target, result.domain);
  return;
}

// For MODAL — dispatch a custom event
if (result.type === 'MODAL' && result.target === 'your_modal') {
  speakAloud(result.speechText);
  window.dispatchEvent(new CustomEvent('nucleus:your_modal_event'));
  return;
}
```

### Step 3: Add a Command Chip

In `VoiceNavigator.js`, add to the `exampleCommands` array:
```js
{ label: 'Your Feature Name', command: 'Open Your Feature' }
```

### Step 4: Add to AIPanel Preloaded Actions (if applicable)

In `src/components/Clerio/AIPanel.js`, in the preloaded actions array:
```js
{ label: 'Your Feature', action: 'Your Feature', icon: YourIcon }
```

### Step 5: Handle Custom Event (if needed)

If your command requires a new CustomEvent, add the listener in the appropriate view:
```js
// In the relevant view component's useEffect
useEffect(() => {
  const handler = () => {
    // do something
  };
  window.addEventListener('nucleus:your_event', handler);
  return () => window.removeEventListener('nucleus:your_event', handler);
}, []);
```

### Step 6: Write a Test

File: `tests/voice-navigator.test.ts`

```ts
describe('Your Feature Command', () => {
  it('recognizes "Open Your Feature"', () => {
    const result = parseVoiceCommand('Open Your Feature');
    expect(result.type).toBe('TAB');
    expect(result.target).toBe('your_tab_id');
  });
  
  it('recognizes alternate phrasing', () => {
    const result = parseVoiceCommand('go to your feature');
    expect(result.type).toBe('TAB');
  });
});
```

### Step 7: Verify

```bash
npx vitest run tests/voice-navigator.test.ts  # all 15+ tests pass
npm run typecheck                              # 0 errors
```

Open the app, click the mic button, say the command, verify:
- [ ] Live transcript shows the spoken text
- [ ] 1 second pause triggers the action
- [ ] Voice speaks the confirmation text
- [ ] The correct view/modal opens
