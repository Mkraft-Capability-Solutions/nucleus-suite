# Rule: Voice Navigation System (Nucleus Talk)

## Scope
All code in `VoiceNavigator.js`, `voiceCommandEngine.ts`, `AnimatedNucleusLogo.js`, and any code that calls `speakAloud()` or dispatches `nucleus:voice_*` events.

## Critical: Browser Audio Constraint

**`speakAloud()` MUST be called synchronously within the user's click event handler.**

```js
// ✅ Correct — inside onClick handler
<button onClick={() => {
  speakAloud(greetingText);  // ← must be here, in the synchronous call stack
  window.dispatchEvent(new CustomEvent('nucleus:voice_navigation', ...));
}}>

// ❌ Wrong — inside useEffect, setTimeout, or async function
useEffect(() => {
  speakAloud(greetingText);  // ← will silently fail in Chrome and Safari
}, [isOpen]);
```

This is because Chrome and Safari require speech synthesis to originate from a user gesture (click, keypress). Any async defer breaks the autoplay policy.

## Voice Command Engine

All command parsing lives in `src/utils/voiceCommandEngine.ts`.

```ts
// Command types
type VoiceCommandResult = {
  type: 'ACTION' | 'CONSOLE' | 'TAB' | 'MODAL' | 'UNKNOWN';
  action?: 'PUNCH_IN' | 'PUNCH_OUT' | 'APPLY_LEAVE';
  target?: string;     // console ID, tab ID, or modal name
  domain?: string;     // navigation catalog domain
  speechText: string;  // what is spoken aloud after the command
}
```

**To add a new command:**
1. Add a pattern match in `parseVoiceCommand()` in `voiceCommandEngine.ts`
2. Add a corresponding test in `tests/voice-navigator.test.ts`
3. Handle the result type in `executeCommand()` in `VoiceNavigator.js`
4. Add a chip to `exampleCommands` array in `VoiceNavigator.js`
5. Add the chip to `AIPanel.js` preloaded actions if appropriate

## Animated Nucleus Logo

The logo is a pure SVG/CSS component — `src/components/AnimatedNucleusLogo.js`. **Do not replace it with a PNG or image.** It responds to `isListening` and `isSpeaking` props.

```jsx
// ✅ Correct
<AnimatedNucleusLogo size={96} isListening={isListening} isSpeaking={isSpeaking} onClick={toggleListening} />

// ❌ Wrong
<img src="/images/logo.png" />
```

CSS states use **compound class selectors**:
```css
.circleLogoWrapper.listening { ... }   /* ✅ Correct */
.listening .circleLogoWrapper { ... }  /* ❌ Wrong — applies to child, not self */
```

## Custom Events — Voice Action Dispatch

| Event | Fired By | Consumed By |
|:---|:---|:---|
| `nucleus:voice_navigation` | `TopNav.js` (mic click) | `VoiceNavigator.js` (opens modal) |
| `nucleus:trigger_punch` | `VoiceNavigator.js`, `AIPanel.js` | `MainWorkspace.js` → `punchIn()/punchOut()` |
| `nucleus:open_leave_apply` | `VoiceNavigator.js`, `AIPanel.js` | `LeaveView.js` → opens dialog |
| `nucleus:open_bulk_upload` | `VoiceNavigator.js` | `MainWorkspace.js` |
| `nucleus:open_ctc_exception` | `VoiceNavigator.js` | `MainWorkspace.js` |
| `nucleus:open_modules` | `VoiceNavigator.js` | `MainWorkspace.js` → `DualPaneNav` |

## Speech Synthesis Error Handling

The `onerror` handler in `speakAloud()` silently discards `canceled` and `interrupted` events — these are normal browser lifecycle events, not real errors. **Do not log them or show error UI for these.**

```ts
utterance.onerror = (e) => {
  if (e.error === 'canceled' || e.error === 'interrupted') return; // ← correct
  console.debug('SpeechSynthesis notice:', e.error);
};
```

## 1-Second Silence Auto-Execution

When speech recognition detects a non-final result, a 1000ms silence timer is started. If the user pauses for 1 second, the current transcript is automatically executed as a command. The timer resets on every new speech result.

**Do not reduce below 1000ms** — shorter timers cause premature execution mid-sentence.

## Testing

Voice command parsing tests are in `tests/voice-navigator.test.ts` (15 tests).  
Run after any change to `voiceCommandEngine.ts`:

```bash
npx vitest run tests/voice-navigator.test.ts
```
