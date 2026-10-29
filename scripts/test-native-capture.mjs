// Run production Foundation-only definitions with Swift, without an Xcode target.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const source = readFileSync(new URL('../ios/App/App/QuickLogIntent.swift', import.meta.url), 'utf8');
function declaration(marker, text = source) {
  const start = text.indexOf(marker);
  if (start < 0) throw new Error(`Missing production declaration: ${marker}`);
  const opening = text.indexOf('{', start);
  let depth = 1;
  let end = opening + 1;
  while (depth && end < text.length) {
    if (text[end] === '{') depth++;
    if (text[end] === '}') depth--;
    end++;
  }
  if (depth) throw new Error(`Unbalanced declaration: ${marker}`);
  return text.slice(start, end);
}
const payload = declaration('public struct DraftPayload: Codable');
const safeID = declaration('public static func validID(');
const ownerValidation = declaration('public static func validOwnerSnapshot(');
const pluginSource = readFileSync(new URL('../ios/App/App/AccrualInboxPlugin.swift', import.meta.url), 'utf8');
const discardPolicy = declaration('public enum GuestCaptureDiscardPolicy', pluginSource);
const tests = readFileSync(new URL('./native-capture-tests.swift', import.meta.url), 'utf8');
const temporary = mkdtempSync(join(tmpdir(), 'accrual-native-capture-'));
try {
  const script = join(temporary, 'capture-tests.swift');
  writeFileSync(script, `import Foundation\n${payload}\n${discardPolicy}\nenum DraftInbox {\n${safeID}\n${ownerValidation}\n}\n${tests}`);
  const result = spawnSync('swift', [script], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
