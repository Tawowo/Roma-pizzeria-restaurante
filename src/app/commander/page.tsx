'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase, Article, Categorie } from '@/lib/supabase'
import { useLang } from '@/lib/LanguageContext'

type LignePanier = {
  article: Article
  quantite: number
  taille: 'normal' | 'pala'
  commentaire: string
  id: string
}

type ClientFidele = {
  id: string
  nom: string
  points_fidelite: number
  nb_visites: number
}

const CATS_PAS_CUISINE = [
  'boissons', 'vins', 'vins blancs', 'vins rouges', 'vins rosés',
  'pétillants', 'apéritifs', 'digestifs', 'boisson', 'vin',
  'bières', 'softs', 'eaux'
]

const NIVEAUX_FIDELITE = [
  { min: 0, max: 5, label: 'Bronze', icon: '🥉', color: '#8D6E63', bg: '#EFEBE9' },
  { min: 6, max: 15, label: 'Argent', icon: '🥈', color: '#757575', bg: '#F0F0F0' },
  { min: 16, max: Infinity, label: 'Or', icon: '🏆', color: '#1B5E20', bg: '#E8F5E9' },
]

const RECOMPENSES_VITRINE = [
  { points: 8, label: 'Boisson offerte', icon: '🥤' },
  { points: 16, label: 'Salade offerte', icon: '🥗' },
  { points: 22, label: 'Dessert offert', icon: '🍮' },
  { points: 32, label: 'Pizza Margherita offerte', icon: '🍕' },
]

function getNiveau(visites: number) {
  return NIVEAUX_FIDELITE.find(n => visites >= n.min && visites <= n.max) ?? NIVEAUX_FIDELITE[0]
}

function genSlots(fromH: number, fromM: number, toH: number, toM: number): string[] {
  const slots: string[] = []
  let h = fromH, m = fromM
  while (h * 60 + m <= toH * 60 + toM) {
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    m += 5
    if (m >= 60) { m -= 60; h++ }
  }
  return slots
}

const ALL_MIDI = genSlots(12, 0, 14, 30)
const ALL_SOIR = genSlots(19, 0, 22, 0)

function getSlotsForDOW(dow: number): { midi: string[], soir: string[] } {
  if (dow === 1) return { midi: [], soir: [] }
  if (dow === 0 || dow === 2) return { midi: [], soir: ALL_SOIR }
  return { midi: ALL_MIDI, soir: ALL_SOIR }
}

const JOURS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export default function CommanderPage() {
  const { t } = useLang()
  const [step, setStep] = useState<'menu' | 'panier' | 'infos' | 'confirmation'>('menu')
  const [categories, setCategories] = useState<Categorie[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [catActive, setCatActive] = useState('')
  const [panier, setPanier] = useState<LignePanier[]>([])
  const [nom, setNom] = useState('')
  const [tel, setTel] = useState('')
  const [dateRetrait, setDateRetrait] = useState('')
  const [labelJour, setLabelJour] = useState('')
  const [heureRetrait, setHeureRetrait] = useState('')
  const [notes, setNotes] = useState('')
  const [slotsMidi, setSlotsMidi] = useState<string[]>([])
  const [slotsSoir, setSlotsSoir] = useState<string[]>([])
  const [slotsCapacite, setSlotsCapacite] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [numCmd, setNumCmd] = useState<number | null>(null)
  const [showCommentaire, setShowCommentaire] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [ferme, setFerme] = useState(false)

  // Fidélité
  const [clientFidele, setClientFidele] = useState<ClientFidele | null>(null)
  const [clientTrouve, setClientTrouve] = useState<boolean | null>(null)
  const [verifErr, setVerifErr] = useState<string | null>(null)
  const [prenomNvClient, setPrenomNvClient] = useState('')
  const [pointsGagnes, setPointsGagnes] = useState(0)
  const [totalPointsApres, setTotalPointsApres] = useState(0)

  const loadSlotsCapacite = useCallback(async (date: string) => {
    try {
      const { data } = await supabase
        .from('commandes')
        .select('heure_retrait')
        .eq('date_retrait', date)
        .neq('statut', 'annulee')
      const counts: Record<string, number> = {}
      if (data) {
        data.forEach((c: { heure_retrait?: string }) => {
          const h = (c.heure_retrait || '').slice(0, 5)
          if (h) counts[h] = (counts[h] || 0) + 1
        })
      }
      setSlotsCapacite(counts)
    } catch { /* ignore */ }
  }, [])

  const computeDate = useCallback(() => {
    const now = new Date()
    for (let i = 0; i < 8; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      const dow = d.getDay()
      const { midi, soir } = getSlotsForDOW(dow)
      if (dow === 1) continue

      const nowMin = now.getHours() * 60 + now.getMinutes() + 30
      const filterPast = (slots: string[]) => i > 0 ? slots : slots.filter(s => {
        const [sh, sm] = s.split(':').map(Number)
        return sh * 60 + sm > nowMin
      })

      const midiDispo = filterPast(midi)
      const soirDispo = filterPast(soir)
      if (midiDispo.length === 0 && soirDispo.length === 0) continue

      const dateStr = d.toISOString().split('T')[0]
      setDateRetrait(dateStr)
      setSlotsMidi(midiDispo)
      setSlotsSoir(soirDispo)
      setFerme(false)

      let label = ''
      if (i === 0) label = `Aujourd'hui — ${JOURS_FR[dow]}`
      else if (i === 1) label = `Demain — ${JOURS_FR[dow]}`
      else label = `${JOURS_FR[dow]} ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
      setLabelJour(label)
      loadSlotsCapacite(dateStr)
      return
    }
    setFerme(true)
  }, [loadSlotsCapacite])

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').eq('actif', true).order('ordre'),
      supabase.from('articles').select('*').eq('disponible', true).order('ordre'),
    ]).then(([c, a]) => {
      if (c.data) { setCategories(c.data); setCatActive(c.data[0]?.id || '') }
      if (a.data) setArticles(a.data)
    })
    computeDate()
  }, [computeDate])

  const rechercherClient = useCallback(async (telVal: string) => {
    console.log('vérifier appelé:', telVal)
    setVerifErr(null)
    const clean = telVal.replace(/\s/g, '')
    if (clean.length < 8) {
      console.log('vérifier: numéro trop court (<8 chiffres), abandon')
      setClientFidele(null); setClientTrouve(null); return
    }
    try {
      console.log('vérifier: requête Supabase clients WHERE telephone =', telVal.trim())
      const { data, error } = await supabase
        .from('clients')
        .select('id, nom, points_fidelite, nb_visites')
        .eq('telephone', telVal.trim())
        .single()
      console.log('vérifier résultat Supabase:', { data, error })
      if (data) {
        setClientFidele(data as ClientFidele)
        setClientTrouve(true)
      } else {
        if (error && error.code !== 'PGRST116') {
          const msg = `Erreur Supabase [${error.code}] : ${error.message}`
          console.error('vérifier erreur Supabase (inattendue):', msg)
          setVerifErr(msg)
        }
        setClientFidele(null)
        setClientTrouve(error?.code === 'PGRST116' ? false : null)
      }
    } catch (caughtErr) {
      const msg = caughtErr instanceof Error ? caughtErr.message : String(caughtErr)
      console.error('vérifier exception:', msg)
      setVerifErr(`Erreur réseau : ${msg}`)
      setClientFidele(null)
      setClientTrouve(null)
    }
  }, [])

  const artsByCat = articles.filter(a => a.categorie_id === catActive)
  const nbPanier = panier.reduce((s, l) => s + l.quantite, 0)
  const total = panier.reduce((s, l) => {
    const prix = l.taille === 'pala' ? (l.article.prix_pala || l.article.prix) : (l.article.prix_reduction || l.article.prix)
    return s + prix * l.quantite
  }, 0)

  const addToPanier = (article: Article, taille: 'normal' | 'pala' = 'normal') => {
    const id = `${article.id}-${taille}-${Date.now()}`
    setPanier(p => [...p, { article, quantite: 1, taille, commentaire: '', id }])
  }

  const updateQty = (id: string, delta: number) => {
    setPanier(p => p.map(l => l.id === id ? { ...l, quantite: l.quantite + delta } : l).filter(l => l.quantite > 0))
  }

  const updateCommentaire = (id: string, val: string) => {
    setPanier(p => p.map(l => l.id === id ? { ...l, commentaire: val } : l))
  }

  const isSlotFull = (slot: string) => (slotsCapacite[slot] || 0) >= 8

  const submitCommande = async () => {
    setErr('')
    if (!nom.trim()) { setErr('Veuillez entrer votre nom'); return }
    if (!tel.trim()) { setErr('Le téléphone est obligatoire'); return }
    if (!heureRetrait) { setErr('Choisissez une heure de retrait'); return }
    if (panier.length === 0) { setErr('Votre panier est vide'); return }

    setLoading(true)
    const cmdPayload = {
      nom_client: nom,
      telephone: tel,
      heure_retrait: heureRetrait,
      date_retrait: dateRetrait,
      type: 'a_emporter',
      statut: 'en_preparation',
      notes: notes || null,
      total,
    }
    console.log('[vitrine] INSERT commande payload:', cmdPayload)
    const { data: cmd, error } = await supabase.from('commandes').insert(cmdPayload).select().single()
    console.log('insert commande résultat:', cmd, error)

    if (error || !cmd) {
      console.error('[vitrine] commande insert ERREUR:', error?.code, error?.message, error?.details)
      setErr(`Erreur création commande : ${error?.message ?? 'inconnue'}. Appelez le 06 68 36 62 98`)
      setLoading(false)
      return
    }
    console.log('[vitrine] commande créée OK — id:', cmd.id, 'statut:', cmd.statut, 'numéro:', cmd.numero_commande)

    const lignes = panier.map(l => {
      const cat = categories.find(c => c.id === l.article.categorie_id)
      const nomCat = cat?.nom?.toLowerCase() ?? ''
      const pour_cuisine = !CATS_PAS_CUISINE.some(c => nomCat.includes(c))
      return {
        commande_id: cmd.id,
        article_id: l.article.id,
        article_nom: l.article.nom,
        quantite: l.quantite,
        taille: l.taille === 'pala' ? 'Pala' : '33cm',
        prix_unitaire: l.taille === 'pala' ? (l.article.prix_pala || l.article.prix) : (l.article.prix_reduction || l.article.prix),
        commentaire: l.commentaire || null,
        statut: 'envoye_cuisine',
        pour_cuisine,
        categorie_nom: cat?.nom || null,
      }
    })
    console.log('[vitrine] INSERT lignes_commande payload:', lignes)
    const { data: ligData, error: ligErr } = await supabase.from('lignes_commande').insert(lignes).select()
    console.log('insert lignes résultat:', ligData, ligErr)
    if (ligErr) {
      console.error('[vitrine] lignes insert ERREUR:', ligErr.code, ligErr.message, ligErr.details)
      setErr(`Erreur insertion articles : ${ligErr.message}. Appelez le 06 68 36 62 98`)
      setLoading(false)
      return
    }
    console.log('[vitrine] lignes insérées OK (', ligData?.length, 'lignes) — commande visible en cuisine')

    // ── Points fidélité (non bloquant) ─────────────────────────
    try {
      const { data: param } = await supabase
        .from('parametres').select('valeur').eq('cle', 'points_par_euro').single()
      const ptsParEuro = parseFloat(param?.valeur ?? '1') || 1
      const pts = Math.floor(total * ptsParEuro)

      let clientId: string | null = clientFidele?.id ?? null
      let newTotal = (clientFidele?.points_fidelite ?? 0) + pts

      if (clientFidele) {
        await supabase.from('clients').update({
          points_fidelite: newTotal,
          nb_visites: (clientFidele.nb_visites ?? 0) + 1,
        }).eq('id', clientFidele.id)
        console.log('[vitrine] client fidèle mis à jour:', clientFidele.id, '+', pts, 'pts')
      } else if (clientTrouve === false && prenomNvClient.trim()) {
        newTotal = pts
        const nomComplet = (prenomNvClient.trim() + ' ' + nom.trim()).trim()
        const { data: nvCli } = await supabase.from('clients').insert({
          nom: nomComplet,
          telephone: tel.trim(),
          points_fidelite: pts,
          nb_visites: 1,
        }).select('id, points_fidelite').single()
        if (nvCli) {
          clientId = nvCli.id
          newTotal = nvCli.points_fidelite ?? pts
          console.log('[vitrine] nouveau client créé:', nvCli.id)
        }
      }

      if (clientId && pts > 0) {
        await supabase.from('mouvements_fidelite').insert({
          client_id: clientId,
          points: pts,
          motif: `Commande à emporter #${cmd.numero_commande}`,
        })
        await supabase.from('commandes').update({ points_gagnes: pts }).eq('id', cmd.id)
      }

      if (pts > 0) { setPointsGagnes(pts); setTotalPointsApres(newTotal) }
    } catch (fidelErr) {
      console.error('[vitrine] fidelité error (non bloquant):', fidelErr)
    }

    setNumCmd(cmd.numero_commande)
    setStep('confirmation')
    setLoading(false)
  }

  const renderSlotBtn = (slot: string) => {
    const full = isSlotFull(slot)
    const selected = heureRetrait === slot
    return (
      <button
        key={slot}
        disabled={full}
        onClick={() => setHeureRetrait(slot)}
        style={{
          padding: '7px 11px', borderRadius: 6, fontSize: 13,
          fontWeight: selected ? 700 : 400, fontFamily: 'Jost, sans-serif',
          cursor: full ? 'not-allowed' : 'pointer',
          border: `2px solid ${selected ? '#B71C1C' : full ? '#ddd' : 'rgba(196,30,58,0.25)'}`,
          background: selected ? '#B71C1C' : full ? '#f5f5f5' : 'white',
          color: selected ? 'white' : full ? '#bbb' : '#333',
          transition: 'all 0.15s', minWidth: 64,
        }}
        title={full ? 'Créneau complet' : ''}
      >
        {slot}
      </button>
    )
  }

  // ── Page confirmation ──────────────────────────────────────────
  if (step === 'confirmation') return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, marginBottom: 12 }}>{t('emporter_succes')}</h1>
        <div style={{ background: 'var(--r)', color: 'white', borderRadius: 4, padding: '8px 24px', display: 'inline-block', fontFamily: "'Playfair Display',serif", fontSize: 28, marginBottom: 20 }}>
          N° {numCmd}
        </div>
        <p style={{ fontSize: 15, color: 'var(--textm)', lineHeight: 1.8, marginBottom: 16 }}>
          {nom}, votre commande est bien reçue.<br />
          Retrait prévu à <strong>{heureRetrait}</strong><br />
          <span style={{ fontSize: 13, color: 'var(--textl)' }}>{labelJour}</span>
        </p>

        {pointsGagnes > 0 && (
          <div style={{ background: 'rgba(27,94,32,0.07)', border: '1px solid rgba(27,94,32,0.2)', borderRadius: 8, padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>⭐</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, color: '#1B5E20', fontWeight: 700, marginBottom: 4 }}>
              +{pointsGagnes} points gagnés !
            </div>
            <div style={{ fontSize: 13, color: '#555' }}>
              Total fidélité : <strong>{totalPointsApres} points</strong>
            </div>
            <Link href="/compte" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, color: '#B71C1C', textDecoration: 'underline' }}>
              Voir mon compte fidélité →
            </Link>
          </div>
        )}

        <p style={{ fontSize: 13, color: 'var(--textl)', marginBottom: 28 }}>
          En cas de besoin, n&apos;hésitez pas à nous appeler au{' '}
          <a href="tel:0668366298" style={{ color: 'var(--r)' }}>06 68 36 62 98</a>
        </p>
        <Link href="/" className="bp" style={{ textDecoration: 'none', display: 'inline-block' }}>← Retour à l&apos;accueil</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {/* Header */}
      <header style={{ background: 'var(--dark)', color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'white' }}>Roma <em style={{ color: 'var(--gold2)' }}>Pizzeria</em></div>
        </Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{t('emporter_titre')}</span>
          {nbPanier > 0 && (
            <button onClick={() => setStep('panier')} className="bp" style={{ padding: '8px 16px', fontSize: 12 }}>
              🛍 {nbPanier} — {total.toFixed(2)} €
            </button>
          )}
        </div>
      </header>

      {/* ÉTAPE : menu */}
      {step === 'menu' && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 8 }}>{t('emporter_titre')}</h1>
          <p style={{ fontSize: 14, color: 'var(--textl)', marginBottom: 28 }}>Choisissez vos articles, puis indiquez l&apos;heure de retrait</p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setCatActive(cat.id)} style={{
                padding: '8px 18px', borderRadius: 100, fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase',
                cursor: 'pointer', border: '1.5px solid', fontFamily: 'Jost,sans-serif', transition: 'all 0.2s',
                borderColor: catActive === cat.id ? 'var(--r)' : 'rgba(196,30,58,0.2)',
                background: catActive === cat.id ? 'var(--r)' : 'white',
                color: catActive === cat.id ? 'white' : 'var(--textl)',
              }}>{cat.nom}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {artsByCat.map(a => (
              <div key={a.id} style={{ background: 'white', borderRadius: 6, padding: '16px 20px', border: '1px solid rgba(196,30,58,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, marginBottom: 4 }}>{a.nom}</div>
                  {a.description && <div style={{ fontSize: 12, color: 'var(--textl)', lineHeight: 1.6 }}>{a.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700, color: a.prix_reduction ? 'var(--g)' : 'var(--r)' }}>
                      {(a.prix_reduction || a.prix).toFixed(2)} €
                    </div>
                    {a.prix_pala && <div style={{ fontSize: 11, color: 'var(--textl)' }}>Pala: {a.prix_pala.toFixed(2)} €</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button onClick={() => addToPanier(a, 'normal')} className="bp" style={{ padding: '8px 14px', fontSize: 11 }}>+ {a.prix_pala ? '33cm' : 'Ajouter'}</button>
                    {a.prix_pala && <button onClick={() => addToPanier(a, 'pala')} style={{ padding: '8px 14px', fontSize: 11, background: 'var(--g)', color: 'white', border: 'none', borderRadius: 2, cursor: 'pointer', fontFamily: 'Jost,sans-serif', fontWeight: 600, letterSpacing: 1 }}>+ Pala</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {nbPanier > 0 && (
            <div style={{ position: 'sticky', bottom: 20, marginTop: 24 }}>
              <button onClick={() => setStep('panier')} className="bp" style={{ width: '100%', padding: 18, fontSize: 14 }}>
                Voir mon panier ({nbPanier} article{nbPanier > 1 ? 's' : ''}) — {total.toFixed(2)} €
              </button>
            </div>
          )}
        </div>
      )}

      {/* ÉTAPE : panier */}
      {step === 'panier' && (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <button onClick={() => setStep('menu')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--textl)' }}>←</button>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28 }}>Mon <em style={{ color: 'var(--r)' }}>panier</em></h1>
          </div>

          {panier.map(ligne => (
            <div key={ligne.id} style={{ background: 'white', borderRadius: 6, padding: '16px 20px', border: '1px solid rgba(196,30,58,0.08)', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{ligne.article.nom}</div>
                  <div style={{ fontSize: 12, color: 'var(--textl)' }}>{ligne.taille === 'pala' ? 'Format Pala (60×40cm)' : 'Format 33cm'}</div>
                  {ligne.commentaire && <div style={{ fontSize: 12, color: 'var(--g)', marginTop: 4 }}>💬 {ligne.commentaire}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => updateQty(ligne.id, -1)} className="qty-btn">−</button>
                  <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{ligne.quantite}</span>
                  <button onClick={() => updateQty(ligne.id, 1)} className="qty-btn">+</button>
                  <div style={{ minWidth: 60, textAlign: 'right', fontWeight: 700, color: 'var(--r)' }}>
                    {((ligne.taille === 'pala' ? (ligne.article.prix_pala || ligne.article.prix) : (ligne.article.prix_reduction || ligne.article.prix)) * ligne.quantite).toFixed(2)} €
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {showCommentaire === ligne.id ? (
                  <input autoFocus value={ligne.commentaire} onChange={e => updateCommentaire(ligne.id, e.target.value)}
                    placeholder="Ex: sans champignons, bien cuit..."
                    style={{ flex: 1, padding: '8px 12px', border: '1px solid rgba(196,30,58,0.2)', borderRadius: 4, fontSize: 12, fontFamily: 'Jost,sans-serif' }}
                    onBlur={() => setShowCommentaire(null)} />
                ) : (
                  <button onClick={() => setShowCommentaire(ligne.id)} style={{ fontSize: 11, color: 'var(--textl)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    {ligne.commentaire ? '✏️ Modifier le commentaire' : '+ Ajouter un commentaire'}
                  </button>
                )}
              </div>
            </div>
          ))}

          <div style={{ background: 'white', borderRadius: 6, padding: '20px', border: '1px solid rgba(196,30,58,0.08)', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700 }}>
              <span>Total</span><span style={{ color: 'var(--r)' }}>{total.toFixed(2)} €</span>
            </div>
            <div style={{ fontSize: 12, color: '#1B5E20', marginTop: 6 }}>
              ⭐ Vous gagnerez environ {Math.floor(total)} points fidélité
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button onClick={() => setStep('menu')} className="bo" style={{ flex: 1 }}>← Ajouter des articles</button>
            <button onClick={() => setStep('infos')} className="bp" style={{ flex: 2 }}>Continuer →</button>
          </div>
        </div>
      )}

      {/* ÉTAPE : infos + créneaux */}
      {step === 'infos' && (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <button onClick={() => setStep('panier')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--textl)' }}>←</button>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28 }}>Vos <em style={{ color: 'var(--r)' }}>informations</em></h1>
          </div>

          <div style={{ background: 'white', borderRadius: 8, padding: 32, border: '1px solid rgba(196,30,58,0.08)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Nom */}
            <div>
              <label className="rf-label">{t('emporter_nom')} *</label>
              <input className="rf-input" value={nom} onChange={e => setNom(e.target.value)} placeholder="Votre nom" />
            </div>

            {/* Téléphone + fidélité */}
            <div>
              <label className="rf-label">{t('emporter_tel')} * <span style={{ fontSize: 11, color: '#1B5E20', fontWeight: 400 }}>— compte fidélité</span></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="rf-input"
                  value={tel}
                  onChange={e => { setTel(e.target.value); setClientTrouve(null); setClientFidele(null); setVerifErr(null) }}
                  onBlur={() => rechercherClient(tel)}
                  placeholder="06 XX XX XX XX"
                  type="tel"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => rechercherClient(tel)}
                  style={{ padding: '10px 14px', background: '#1B5E20', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontFamily: 'Jost,sans-serif', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  Vérifier
                </button>
              </div>

              {/* Erreur vérification */}
              {verifErr && (
                <div style={{ marginTop: 8, padding: '10px 14px', background: '#FFEBEE', border: '1px solid #EF9A9A', borderRadius: 6, fontSize: 12, color: '#B71C1C', fontWeight: 500 }}>
                  ⚠️ {verifErr}
                </div>
              )}

              {/* Client fidèle trouvé */}
              {clientTrouve === true && clientFidele && (() => {
                const niv = getNiveau(clientFidele.nb_visites ?? 0)
                const prochaineRecomp = RECOMPENSES_VITRINE.find(r => r.points > clientFidele.points_fidelite)
                return (
                  <div style={{ marginTop: 10, padding: '14px 16px', background: niv.bg, border: `1px solid ${niv.color}40`, borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: niv.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {niv.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: niv.color }}>Bonjour {clientFidele.nom.split(' ')[0]} !</div>
                        <div style={{ fontSize: 12, color: '#555' }}>Membre {niv.label} · {clientFidele.nb_visites ?? 0} visite{(clientFidele.nb_visites ?? 0) > 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: niv.color }}>{clientFidele.points_fidelite}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>points</div>
                      </div>
                    </div>
                    {prochaineRecomp && (
                      <div style={{ fontSize: 12, color: '#555' }}>
                        Prochaine récompense : {prochaineRecomp.icon} {prochaineRecomp.label} dans{' '}
                        <strong>{prochaineRecomp.points - clientFidele.points_fidelite} pts</strong>
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#1B5E20', marginTop: 4, fontWeight: 600 }}>
                      +{Math.floor(total)} points avec cette commande
                    </div>
                  </div>
                )
              })()}

              {/* Client non trouvé — proposer création */}
              {clientTrouve === false && (
                <div style={{ marginTop: 10, padding: '14px 16px', background: '#FFF8E1', border: '1px solid #F9A825', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#795548', marginBottom: 8 }}>
                    🎁 Nouveau ? Créez votre compte fidélité !
                  </div>
                  <div style={{ fontSize: 12, color: '#795548', marginBottom: 10 }}>
                    Gagnez {Math.floor(total)} points dès cette commande — 1 point = 1 euro dépensé
                  </div>
                  <label style={{ display: 'block', fontSize: 12, color: '#555', marginBottom: 4 }}>Votre prénom (pour créer le compte)</label>
                  <input
                    value={prenomNvClient}
                    onChange={e => setPrenomNvClient(e.target.value)}
                    placeholder="Ex: Sophie"
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #F9A825', borderRadius: 6, fontSize: 13, fontFamily: 'Jost,sans-serif', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Laissez vide pour commander sans créer de compte</div>
                </div>
              )}
            </div>

            {/* Créneaux de retrait */}
            <div>
              <label className="rf-label">Heure de retrait *</label>

              {ferme ? (
                <div style={{ padding: '12px 16px', background: '#FFF3CD', borderRadius: 6, border: '1px solid #FFEEBA', fontSize: 14, color: '#856404' }}>
                  🔒 Aucun créneau disponible en ce moment. Appelez-nous au{' '}
                  <a href="tel:0668366298" style={{ color: '#B71C1C' }}>06 68 36 62 98</a>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 14, padding: '8px 12px', background: 'rgba(183,28,28,0.06)', borderRadius: 6, fontSize: 13, color: '#B71C1C', fontWeight: 600 }}>
                    📅 {labelJour}
                  </div>

                  {slotsMidi.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--textl)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>🌞 Midi</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {slotsMidi.map(s => renderSlotBtn(s))}
                      </div>
                    </div>
                  )}

                  {slotsSoir.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--textl)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>🌙 Soir</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {slotsSoir.map(s => renderSlotBtn(s))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="rf-label">Notes (optionnel)</label>
              <textarea className="rf-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Sonnez à la porte rouge..." />
            </div>

            <p style={{ fontSize: 12, color: 'var(--textl)', lineHeight: 1.6, textAlign: 'center' }}>
              En cas de besoin, appelez-nous au <a href="tel:0668366298" style={{ color: 'var(--r)' }}>06 68 36 62 98</a>
            </p>

            {err && <div style={{ color: 'var(--r)', fontSize: 13, textAlign: 'center', fontWeight: 500 }}>{err}</div>}

            <button className="btn-submit btn-submit-g" onClick={submitCommande} disabled={loading || ferme}>
              {loading ? t('chargement') : `✓ ${t('emporter_btn')}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
