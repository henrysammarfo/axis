# AXIS — UXmaxx finale (3 minutes)

> **You are a finalist.** Practice **Tue 18 Aug 2026, 16:00 BST**. Finale **Fri 21 Aug 2026, 16:00 BST** (Particle team; time may move).  
> Join practice: [Encode practice pitch](https://www.encodeclub.com/programmes/uxmaxx-hackathon/events/practice-pitch-for-finalists?openLogin=true)  
> Rules from Giles: **3 minutes**, one presenter (Henry), slides **or** live demo.  
> Live: https://axis-mainnet.vercel.app · Proof: `/proof` after Google · API: https://axis-api-beta.vercel.app/health

You are pitching **to Particle**. Lead with Google → same address → EIP-7702 Type-4 → SRA deposit → **zero signing** after login. Do not say “we don’t use Particle.” The live path is Magic EOA upgraded in place (Type-4) + ZeroDev SRA/session — that is the Particle Magic 7702 story.

---

## Before practice (tonight)

1. Confirm https://axis-api-beta.vercel.app/health returns `"status":"ok"`.
2. Incognito → https://axis-mainnet.vercel.app/onboard → Google.
3. Open `/proof`. Screenshot green: address, Type-4 hash, SRA.
4. If the Magic account has ≥ $10 USDC on Arbitrum, tap **Apply best route** once so the dashboard has a real position + Arbiscan link. If not, use the screenshot + the sponsored UserOp: `0x96c27132fd04085aaf0443521f105b921083fa8f1a35d06039cfe3ed86fcc3d4`.
5. Have this tab order ready: landing → onboard/Google → `/proof` → dashboard.
6. Backup: if live login fails, share screen on the screenshots and keep talking. Do **not** debug on stage.

Local time: BST is UTC+1. 16:00 BST = 15:00 UTC. Convert before you join.

---

## 3-minute script (speak this)

**0:00–0:20 · Hook**  
“DeFi yield is real. Normal people still can’t use it — MetaMask, gas, bridges, sign every trade. AXIS is what it looks like when that’s gone. Google login. Deposit USDC. One tap. AXIS invests on Arbitrum. After login, you never sign a transaction again.”

**0:20–0:50 · Live: Google (or screenshot)**  
Click Continue with Google.  
“No seed phrase. Magic embeds the wallet. This is a real EOA — the same address you’ll see after we upgrade it.”

**0:50–1:25 · `/proof` — Particle + ZeroDev**  
Open `/proof`. Point at the three checks.  
“Same address, upgraded in place with EIP-7702 Type-4 — that’s the Universal Account path, no migration. Here’s the Type-4 hash on Arbiscan. Here’s the ZeroDev Smart Routing Address: send USDC from Base, Optimism, or Ethereum; it settles on Arbitrum. I never bridge myself.”

**1:25–2:20 · One tap, no popup**  
Dashboard. If funded: tap **Apply best route**. Watch for **no wallet popup**.  
“Risk and goal are a deterministic matrix — AI explains, it does not pick the allocation. A CallPolicy-bounded session key executes Aave, and with consent Uniswap LP and GMX, gaslessly. Funds can only settle back to the owner. Even if our agent key leaked, it cannot send money to an attacker.”

If the tap isn’t funded: show the position screenshot / Arbiscan / sponsored UserOp and say the same lines.

**2:20–2:45 · Why this stack**  
“Particle makes the account invisible. ZeroDev makes deposits and gas invisible. Magic makes login invisible. Arbitrum is the settlement layer the user never has to name.”

**2:45–3:00 · Close**  
“AXIS is live on mainnet. Set. Forget. Earn. I’m Henry — happy to walk `/proof` in questions.”

Stop talking. Smile. Let them ask.

---

## If they ask (keep answers short)

| Question | Answer |
|----------|--------|
| Is this Particle UA? | Same Google EOA, EIP-7702 Type-4 in place, SRA for deposits. Judge proof shows address + Type-4 + SRA. |
| Who holds the keys? | User owns the account. Session key is policy-bounded on-chain. We never custody funds. |
| Does AI move money? | No. Deterministic router. AI is narration only. |
| What’s live? | Arbitrum One. Gas sponsorship mined. Min $10 USDC. |
| Unhackable? | No. Defense in depth. Residual: protocol risk, sponsor gas griefing, GMX market risk is opt-in. |

---

## Practice session (tomorrow)

- Join 5 minutes early. Camera on. Share the browser, not the IDE.
- Run the 3-minute script **once against a timer**. Cut if you overrun — the close matters more than GMX.
- One person talks. Do not alt-tab into Cursor.
- After practice: note what Encode flagged (timing, audio, demo vs slides) and lock that for Friday.

## Friday finale

Same script. Prefer live demo if `/health` is ok that morning; otherwise screenshots + this script. Reply to Giles only if you cannot attend Friday.
