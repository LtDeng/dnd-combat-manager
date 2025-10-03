import React, { useMemo, useState, useEffect } from 'react'

const d = (sides: number) => Math.floor(Math.random() * sides) + 1
const modFromScore = (score: number | null | undefined) =>
  typeof score === 'number' ? Math.floor((score - 10) / 2) : 0

// --- CONFIG ---
// If the D&D Beyond API blocks your GitHub Pages origin with CORS,
// set PROXY_ORIGIN to a small proxy you control (e.g. a Cloudflare Worker)
// and leave it empty to call DDB directly during local dev.
// See the files "worker/cors-proxy.ts" and "worker/wrangler.toml" below.
// Prefer env var; fall back to your Cloudflare Worker on GitHub Pages, or direct calls in local dev.
const DEFAULT_PROXY = 'https://ddb-charactersheet.morris-cadenas.workers.dev'
// Use ImportMetaEnv type to satisfy TS
const PROXY_ORIGIN: string =
  (import.meta as any).env?.VITE_PROXY_ORIGIN ??
  (typeof window !== 'undefined' && location.hostname.endsWith('github.io') ? DEFAULT_PROXY : '')

const ddbCharacterUrl = (id: string) =>
  `https://character-service.dndbeyond.com/character/v5/character/${encodeURIComponent(id)}?includeCustomItems=true`

const apiUrl = (rawUrl: string) => PROXY_ORIGIN ? `${PROXY_ORIGIN}/fetch?url=${encodeURIComponent(rawUrl)}` : rawUrl

type Character = {
  id: string
  name: string
  dex: number | null
  dexMod: number
  source: 'ddb'
}

type Monster = {
  id: string
  name: string
  maxHp: number
  hp: number
  ac: number | null
  dexMod: number
  source: 'monster'
}

type Combatant = (Character | Monster) & { initiative: number | null; note?: string }

const LS_KEY = 'dnd_combat_manager_state_v1'
const saveState = (data: any) => { try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch {} }
const loadState = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch { return null } }

export default function App() {
  const [combatants, setCombatants] = useState<Combatant[]>(() => loadState()?.combatants || [])
  const [round, setRound] = useState<number>(() => loadState()?.round || 1)
  const [turnIndex, setTurnIndex] = useState<number>(() => loadState()?.turnIndex || 0)
  const [loadingDDB, setLoadingDDB] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { saveState({ combatants, round, turnIndex }) }, [combatants, round, turnIndex])

  const ordered = useMemo(() => {
    const withIdx = combatants.map((c, i) => ({ ...c, _idx: i }))
    return [...withIdx].sort((a, b) => (b.initiative ?? -999) - (a.initiative ?? -999))
  }, [combatants])

  const [ddbId, setDdbId] = useState('')
  const fetchCharacter = async (idStr: string) => {
    const id = idStr.trim()
    if (!id) return
    setError(null)
    setLoadingDDB(true)
    try {
      const res = await fetch(apiUrl(ddbCharacterUrl(id)))
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`)
      const data = await res.json()
      const ddb = data?.data
      if (!ddb) throw new Error('Character data missing')
      const name: string = ddb?.name || `Character ${id}`
      const dexStat = Array.isArray(ddb?.stats)
        ? ddb.stats.find((s: any) => s?.id === 2 || s?.abilityId === 2)
        : null
      const dexScore: number | null = typeof dexStat?.value === 'number' ? dexStat.value : (typeof dexStat?.score === 'number' ? dexStat.score : null)
      const dexMod = modFromScore(dexScore)

      const newChar: Combatant = { id, name, dex: dexScore, dexMod, source: 'ddb', initiative: null }
      setCombatants((prev) => [...prev, newChar])
      setDdbId('')
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch character')
    } finally {
      setLoadingDDB(false)
    }
  }

  const [mName, setMName] = useState('')
  const [mHP, setMHP] = useState<number>(20)
  const [mAC, setMAC] = useState<number | ''>(13)
  const [mDexMod, setMDexMod] = useState<number>(0)

  const addMonster = () => {
    if (!mName.trim()) return
    const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const mon: Combatant = {
      id,
      name: mName.trim(),
      maxHp: mHP,
      hp: mHP,
      ac: mAC === '' ? null : Number(mAC),
      dexMod: mDexMod,
      source: 'monster',
      initiative: null,
    } as Monster & { initiative: number | null }
    setCombatants((prev) => [...prev, mon])
    setMName(''); setMHP(20); setMAC(13); setMDexMod(0)
  }

  const setInitiative = (id: string, value: number | null) => {
    setCombatants((prev) => prev.map((c) => (c.id === id ? { ...c, initiative: value } : c)))
  }

  const rollInitiative = (id: string) => {
    setCombatants((prev) => prev.map((c) => {
      if (c.id !== id) return c
      const total = d(20) + (c.dexMod ?? 0)
      return { ...c, initiative: total }
    }))
  }

  const rollAllMonsters = () => {
    setCombatants((prev) => prev.map((c) => {
      if (c.source === 'monster') {
        return { ...c, initiative: d(20) + (c.dexMod ?? 0) }
      }
      return c
    }))
  }

  const sortByInitiative = () => {
    const firstIdx = ordered.findIndex((c) => c.initiative !== null)
    setTurnIndex(Math.max(0, firstIdx))
  }

  const nextTurn = () => {
    const count = ordered.length
    if (count === 0) return
    let next = (turnIndex + 1) % count
    let guard = 0
    while (ordered[next]?.initiative == null && guard < count) {
      next = (next + 1) % count
      guard++
    }
    if (next <= turnIndex) setRound((r) => r + 1)
    setTurnIndex(next)
  }

  const prevTurn = () => {
    const count = ordered.length
    if (count === 0) return
    let prev = (turnIndex - 1 + count) % count
    let guard = 0
    while (ordered[prev]?.initiative == null && guard < count) {
      prev = (prev - 1 + count) % count
      guard++
    }
    if (prev > turnIndex) setRound((r) => Math.max(1, r - 1))
    setTurnIndex(prev)
  }

  const damage = (id: string, amt: number) => {
    setCombatants((prev) => prev.map((c) => {
      if (c.id !== id) return c
      if ((c as any).hp == null) return c
      const hp = Math.max(0, Math.min((c as any).maxHp, (c as any).hp - amt))
      return { ...c, hp } as any
    }))
  }
  const heal = (id: string, amt: number) => {
    setCombatants((prev) => prev.map((c) => {
      if (c.id !== id) return c
      if ((c as any).hp == null) return c
      const hp = Math.max(0, Math.min((c as any).maxHp, (c as any).hp + amt))
      return { ...c, hp } as any
    }))
  }

  const removeC = (id: string) => {
    setCombatants((prev) => prev.filter((c) => c.id !== id))
    setTurnIndex(0)
  }

  const currentId = ordered[turnIndex]?.id

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-5xl mx-auto grid gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">D&D Combat Manager</h1>
          <div className="text-sm text-slate-600">Round <span className="font-semibold">{round}</span></div>
        </header>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow p-4 md:p-5">
            <h2 className="font-semibold text-lg mb-3">Add Character (D&D Beyond)</h2>
            <div className="flex gap-2">
              <input className="flex-1 rounded-xl border border-slate-300 px-3 py-2" placeholder="Enter D&D Beyond Character ID" value={ddbId} onChange={(e) => setDdbId(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') fetchCharacter(ddbId) }} />
              <button className="rounded-xl px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50" onClick={() => fetchCharacter(ddbId)} disabled={loadingDDB}>{loadingDDB ? 'Adding…' : 'Add'}</button>
            </div>
            <p className="text-xs text-slate-500 mt-2">Example ID: 43889142</p>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>

          <div className="bg-white rounded-2xl shadow p-4 md:p-5">
            <h2 className="font-semibold text-lg mb-3">Add Monster (Manual)</h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <input className="col-span-2 rounded-xl border border-slate-300 px-3 py-2" placeholder="Name" value={mName} onChange={(e) => setMName(e.target.value)} />
              <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Max HP" type="number" value={mHP} onChange={(e) => setMHP(parseInt(e.target.value || '0'))} />
              <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="AC" type="number" value={mAC} onChange={(e) => setMAC(e.target.value === '' ? '' : parseInt(e.target.value))} />
              <input className="rounded-xl border border-slate-300 px-3 py-2" placeholder="Dex Mod" type="number" value={mDexMod} onChange={(e) => setMDexMod(parseInt(e.target.value || '0'))} />
              <button className="rounded-xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700" onClick={addMonster}>Add Monster</button>
            </div>
            <p className="text-xs text-slate-500 mt-2">Dex Mod affects initiative rolls (d20 + Dex Mod).</p>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <button className="rounded-xl px-3 py-2 bg-slate-800 text-white hover:bg-slate-900" onClick={rollAllMonsters}>Roll All Monsters</button>
            <button className="rounded-xl px-3 py-2 bg-slate-200 hover:bg-slate-300" onClick={sortByInitiative}>Sort & Jump to Top</button>
            <div className="ml-auto flex gap-2">
              <button className="rounded-xl px-3 py-2 bg-sky-600 text-white hover:bg-sky-700" onClick={prevTurn}>Prev Turn</button>
              <button className="rounded-xl px-3 py-2 bg-sky-600 text-white hover:bg-sky-700" onClick={nextTurn}>Next Turn</button>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow">
          <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-lg">Initiative Order</h2>
            <span className="text-xs text-slate-500">Click a number to edit; use 🎲 to roll</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {ordered.map((c, idx) => {
              const isTurn = c.id === currentId
              const isMonster = c.source === 'monster'
              const hasHP = isMonster && (c as any).hp != null
              return (
                <li key={c.id} className={`p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 ${isTurn ? 'bg-indigo-50' : ''}`}>
                  <div className="flex items-center gap-3 w-full md:w-1/3">
                    <div className="w-8 text-right font-semibold">{c.initiative ?? '-'}</div>
                    <div className="flex-1">
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-slate-500">
                        {c.source === 'ddb' ? (
                          <span>DEX: {c.dex ?? '—'} (mod {c.dexMod >= 0 ? '+' : ''}{c.dexMod})</span>
                        ) : (
                          <span>AC: {(c as any).ac ?? '—'} · Dex Mod: {c.dexMod >= 0 ? '+' : ''}{c.dexMod}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:ml-auto">
                    <button className="rounded-lg px-2 py-1 bg-slate-200 hover:bg-slate-300" title="Roll initiative (d20 + Dex Mod)" onClick={() => rollInitiative(c.id)}>🎲</button>
                    <input className="w-20 rounded-lg border border-slate-300 px-2 py-1" type="number" placeholder="Set" value={c.initiative ?? ''} onChange={(e) => setInitiative(c.id, e.target.value === '' ? null : parseInt(e.target.value))} />
                    {hasHP && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">HP {(c as any).hp}/{(c as any).maxHp}</span>
                        <button className="rounded-lg px-2 py-1 bg-rose-600 text-white hover:bg-rose-700" onClick={() => damage(c.id, 1)}>-1</button>
                        <button className="rounded-lg px-2 py-1 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => heal(c.id, 1)}>+1</button>
                      </div>
                    )}
                    <button className="rounded-lg px-2 py-1 bg-white border border-slate-300 hover:bg-slate-50" onClick={() => removeC(c.id)}>Remove</button>
                  </div>
                </li>
              )
            })}
            {ordered.length === 0 && (
              <li className="p-6 text-slate-500 text-sm">No combatants yet. Add characters or monsters above.</li>
            )}
          </ul>
        </section>

        <section className="text-xs text-slate-500">
          <ul className="list-disc ml-5 space-y-1">
            <li>If you see a CORS error on GitHub Pages, set up the Cloudflare Worker proxy below and define <code>VITE_PROXY_ORIGIN</code> in <code>.env</code>.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}