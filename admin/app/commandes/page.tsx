'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type StatutCmd = 'brouillon' | 'en_cours' | 'en_preparation' | 'pret_encaisser' | 'encaissee' | 'annulee'
type LigneStatut = 'en_attente' | 'envoye_cuisine' | 'pret' | 'servi'
type TypeCmd = 'sur_place' | 'a_emporter'
type Zone = 'rdc' | 'etage' | 'terrasse'
type Taille = '33cm' | 'Pala' | 'Calzone' | ''
type ModePaiement = 'especes' | 'cb' | 'cheque'

interface TableResto {
  id: string
  numero: number
  zone: Zone
  capacite: number
  actif: boolean
  statut?: string
  commande_id?: string
}

interface TableVirtuelle {
  num: number
  zone: Zone
  statut: 'libre' | 'occupee' | 'pret_encaisser' | 'reservee'
  commande?: CommandeActive
}

interface CommandeActive {
  id: string
  numero_commande?: number
  type: TypeCmd
  statut: StatutCmd
  total: number
  created_at: string
  table_numero?: number
  zone?: Zone
  nom_client?: string
  couverts?: number
  lignes_commande?: LigneCmd[]
}

interface LigneCmd {
  id: string
  article_id?: string
  article_nom: string
  quantite: number
  taille?: string
  commentaire?: string
  statut?: LigneStatut
  prix_unitaire: number
  ajout_apres?: boolean
  created_at?: string
  pour_cuisine?: boolean
  categorie_nom?: string
}

interface Article {
  id: string
  nom: string
  prix: number
  categorie_id: string
}

interface Categorie {
  id: string
  nom: string
}

interface ClientFidele {
  id: string
  nom: string
  points: number
  telephone: string
}

interface PanierItem {
  article: Article
  quantite: number
  taille: Taille
  commentaire: string
}

interface ReductionState {
  pct: string
  montant: string
  codePromo: string
  codePromoValeur: number
  codePromoMsg: string
  bonFidelite: string
  bonFideliteValeur: number
  bonFideliteMsg: string
  offrir: boolean
  offrirMotif: string
}

// ─── Utilitaires créneaux (partagés avec la vitrine) ────────────────────────
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
const EMP_SLOTS_MIDI = genSlots(12, 0, 14, 30)
const EMP_SLOTS_SOIR = genSlots(19, 0, 22, 0)
function getEmpSlots(dow: number): { midi: string[], soir: string[] } {
  if (dow === 1) return { midi: [], soir: [] }
  if (dow === 0 || dow === 2) return { midi: [], soir: EMP_SLOTS_SOIR }
  return { midi: EMP_SLOTS_MIDI, soir: EMP_SLOTS_SOIR }
}
function computeEmpDate(): { date: string, label: string, midi: string[], soir: string[] } {
  const now = new Date()
  const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  for (let i = 0; i < 8; i++) {
    const d = new Date(now); d.setDate(d.getDate() + i)
    const dow = d.getDay()
    const { midi, soir } = getEmpSlots(dow)
    const nowMin = now.getHours() * 60 + now.getMinutes() + 30
    const fp = (s: string[]) => i > 0 ? s : s.filter(x => { const [h, m] = x.split(':').map(Number); return h * 60 + m > nowMin })
    const mD = fp(midi), sD = fp(soir)
    if (mD.length === 0 && sD.length === 0) continue
    const dateStr = d.toISOString().split('T')[0]
    const label = i === 0 ? `Aujourd'hui — ${JOURS[dow]}` : i === 1 ? `Demain — ${JOURS[dow]}` : JOURS[dow]
    return { date: dateStr, label, midi: mD, soir: sD }
  }
  return { date: new Date().toISOString().split('T')[0], label: '', midi: [], soir: [] }
}
// ────────────────────────────────────────────────────────────────────────────

const ZONES: { key: Zone; label: string; icon: string }[] = [
  { key: 'rdc', label: 'RDC', icon: '🏠' },
  { key: 'etage', label: 'Étage', icon: '🏛' },
  { key: 'terrasse', label: 'Terrasse', icon: '🌿' },
]

const STATUT_LABELS: Record<StatutCmd, { label: string; tw: string }> = {
  brouillon: { label: 'Brouillon', tw: 'bg-gray-100 text-gray-600' },
  en_cours: { label: 'En cuisine', tw: 'bg-blue-100 text-blue-800' },
  en_preparation: { label: 'En cuisine', tw: 'bg-blue-100 text-blue-800' },
  pret_encaisser: { label: 'Prête', tw: 'bg-orange-100 text-orange-800' },
  encaissee: { label: 'Encaissée', tw: 'bg-gray-100 text-gray-500' },
  annulee: { label: 'Annulée', tw: 'bg-red-100 text-red-800' },
}

const STATUTS_ACTIFS: StatutCmd[] = ['brouillon', 'en_cours', 'en_preparation', 'pret_encaisser']

const CATS_PAS_CUISINE = [
  'boissons', 'vins', 'vins blancs', 'vins rouges', 'vins rosés',
  'pétillants', 'apéritifs', 'digestifs', 'boisson', 'vin',
  'bières', 'softs', 'eaux'
]

function calcTotal(panier: PanierItem[], red: ReductionState): number {
  const sous = panier.reduce((s, p) => s + p.article.prix * p.quantite, 0)
  if (red.offrir) return 0
  let total = sous
  total -= red.codePromoValeur
  total -= red.bonFideliteValeur
  const pct = parseFloat(red.pct) || 0
  const mont = parseFloat(red.montant) || 0
  total -= total * (pct / 100)
  total -= mont
  return Math.max(0, total)
}

// Met à jour ou crée la ligne dans tables_restaurant
async function upsertTable(num: number, zone: Zone, statut: string, commande_id: string | null) {
  const { data: updated, error: updErr } = await supabase
    .from('tables_restaurant')
    .update({ statut, commande_id })
    .eq('numero', num)
    .eq('zone', zone)
    .select('id')

  if (updErr) {
    console.error('[upsertTable] update error:', updErr)
    throw new Error(`Impossible de mettre à jour la table ${num} (${zone}) : ${updErr.message}`)
  }

  if (!updated || updated.length === 0) {
    const { error: insErr } = await supabase
      .from('tables_restaurant')
      .insert({ numero: num, zone, statut, commande_id, actif: true, capacite: 4 })
    if (insErr) {
      console.error('[upsertTable] insert error:', insErr)
      throw new Error(`Impossible de créer la table ${num} (${zone}) : ${insErr.message}`)
    }
  }
}

export default function CommandesPage() {
  const router = useRouter()
  const session = typeof window !== 'undefined' ? ((): import('@/lib/auth').AdminSession | null => {
    try { const s = sessionStorage.getItem('roma_admin'); return s ? JSON.parse(s) : null } catch { return null }
  })() : null

  const [onglet, setOnglet] = useState<TypeCmd>('sur_place')
  const [zone, setZone] = useState<Zone>('rdc')
  const [tables, setTables] = useState<TableVirtuelle[]>([])
  const [commandes, setCommandes] = useState<CommandeActive[]>([])
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  // Modal nouvelle commande / ajout articles
  const [modalTable, setModalTable] = useState<TableVirtuelle | null>(null)
  const [etape, setEtape] = useState<1 | 2 | 3>(1)
  const [nomClient, setNomClient] = useState('')
  const [telClient, setTelClient] = useState('')
  const [couverts, setCouverts] = useState(2)
  const [clientFidele, setClientFidele] = useState<ClientFidele | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<Categorie[]>([])
  const [catActive, setCatActive] = useState('')
  const [recherche, setRecherche] = useState('')
  const [panier, setPanier] = useState<PanierItem[]>([])
  const [reduction, setReduction] = useState<ReductionState>({
    pct: '', montant: '', codePromo: '', codePromoValeur: 0, codePromoMsg: '',
    bonFidelite: '', bonFideliteValeur: 0, bonFideliteMsg: '', offrir: false, offrirMotif: ''
  })
  const [saving, setSaving] = useState(false)
  const [errNom, setErrNom] = useState('')
  const [panierEnvoiSelectionne, setPanierEnvoiSelectionne] = useState<Set<number>>(new Set())
  const [existingCmdId, setExistingCmdId] = useState<string | null>(null)
  const existingCmdIdRef = useRef<string | null>(null) // ref pour éviter les stale closures

  // Modal detail table occupée
  const [modalDetail, setModalDetail] = useState<CommandeActive | null>(null)
  // Modal encaissement
  const [modalEncaiss, setModalEncaiss] = useState<CommandeActive | null>(null)
  const [modePaiement, setModePaiement] = useState<ModePaiement>('cb')
  const [montantRecu, setMontantRecu] = useState('')
  // Confirmation suppression
  const [confirmDelete, setConfirmDelete] = useState<CommandeActive | null>(null)
  // Filtre date pour l'historique
  const [dateFiltre, setDateFiltre] = useState(() => new Date().toISOString().split('T')[0])

  // Modal nouvelle commande à emporter
  const [modalNvEmporter, setModalNvEmporter] = useState(false)
  const [empNom, setEmpNom] = useState('')
  const [empTel, setEmpTel] = useState('')
  const [empDate, setEmpDate] = useState('')
  const [empLabelJour, setEmpLabelJour] = useState('')
  const [empHeure, setEmpHeure] = useState('')
  const [empSlotsMidi, setEmpSlotsMidi] = useState<string[]>([])
  const [empSlotsSoir, setEmpSlotsSoir] = useState<string[]>([])
  const [empPanier, setEmpPanier] = useState<PanierItem[]>([])
  const [empCatActive, setEmpCatActive] = useState('')
  const [empErr, setEmpErr] = useState<string | null>(null)
  const [empSaving, setEmpSaving] = useState(false)

  const fetchTout = useCallback(async (dateCible?: string) => {
    const jour = dateCible ?? dateFiltre ?? new Date().toISOString().split('T')[0]
    try {
      const { data: cmdData, error: cmdErr } = await supabase
        .from('commandes')
        .select('*, lignes_commande(*)')
        .gte('created_at', jour + 'T00:00:00')
        .lte('created_at', jour + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (cmdErr) {
        console.error('[fetchTout] commandes error:', cmdErr)
        setErreur(`Erreur chargement commandes : ${cmdErr.message}`)
        return
      }

      const cmds: CommandeActive[] = (cmdData ?? []) as CommandeActive[]
      setCommandes(cmds)

      const { data: tablesDB, error: tabErr } = await supabase
        .from('tables_restaurant')
        .select('*')
        .eq('actif', true)
        .order('numero')

      if (tabErr) console.error('[fetchTout] tables error:', tabErr)

      // Dériver le statut depuis les commandes actives (plus fiable que la colonne DB)
      const buildStatut = (cmdActive: CommandeActive | undefined): TableVirtuelle['statut'] => {
        if (!cmdActive) return 'libre'
        if (cmdActive.statut === 'pret_encaisser') return 'pret_encaisser'
        return 'occupee'
      }

      if (tablesDB && tablesDB.length > 0) {
        const tv: TableVirtuelle[] = (tablesDB as TableResto[]).map(t => {
          const cmdActive = cmds.find(c => c.id === t.commande_id)
            ?? cmds.find(c =>
              c.type === 'sur_place' &&
              c.table_numero === t.numero &&
              (STATUTS_ACTIFS as string[]).includes(c.statut)
            )
          return { num: t.numero, zone: t.zone, statut: buildStatut(cmdActive), commande: cmdActive }
        })
        setTables(tv)
      } else {
        const staticTables: TableVirtuelle[] = Array.from({ length: 12 }, (_, i) => {
          const num = i + 1
          const z: Zone = num <= 4 ? 'rdc' : num <= 8 ? 'etage' : 'terrasse'
          const cmdActive = cmds.find(c =>
            c.type === 'sur_place' &&
            c.table_numero === num &&
            (STATUTS_ACTIFS as string[]).includes(c.statut)
          )
          return { num, zone: z, statut: buildStatut(cmdActive), commande: cmdActive }
        })
        setTables(staticTables)
      }
    } catch (err) {
      console.error('[fetchTout] unexpected:', err)
      setErreur('Erreur inattendue lors du chargement. Vérifiez la console.')
    } finally {
      setLoading(false)
    }
  }, [dateFiltre])

  useEffect(() => {
    const s = getSession()
    if (!s) { router.replace('/login'); return }
    if (s.role === 'roberto') { router.replace('/cuisine'); return }
    fetchTout()
    loadArticles()
  }, [router, fetchTout])

  useEffect(() => {
    const ch = supabase.channel('commandes-rt3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, () => { fetchTout() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lignes_commande' }, () => { fetchTout() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchTout])

  const loadArticles = async () => {
    try {
      const [{ data: arts, error: artErr }, { data: cats, error: catErr }] = await Promise.all([
        supabase.from('articles').select('*').eq('disponible', true).order('nom'),
        supabase.from('categories').select('*').order('ordre'),
      ])
      if (artErr) console.error('[loadArticles] articles error:', artErr)
      if (catErr) console.error('[loadArticles] categories error:', catErr)
      setArticles((arts ?? []) as Article[])
      setCategories((cats ?? []) as Categorie[])
      if (cats && cats.length > 0) setCatActive(cats[0].id)
    } catch (err) {
      console.error('[loadArticles] unexpected:', err)
    }
  }

  const checkClientFidele = async () => {
    if (!telClient.trim()) return
    try {
      const { data } = await supabase.from('clients').select('id, nom, points, telephone').eq('telephone', telClient.trim()).single()
      if (data) setClientFidele(data as ClientFidele)
    } catch { setClientFidele(null) }
  }

  const ouvrirModalNvCmd = (t: TableVirtuelle) => {
    setModalTable(t)
    setEtape(1)
    setNomClient('')
    setTelClient('')
    setCouverts(2)
    setClientFidele(null)
    setPanier([])
    setReduction({ pct: '', montant: '', codePromo: '', codePromoValeur: 0, codePromoMsg: '', bonFidelite: '', bonFideliteValeur: 0, bonFideliteMsg: '', offrir: false, offrirMotif: '' })
    setErrNom('')
    setPanierEnvoiSelectionne(new Set())
    existingCmdIdRef.current = null
    setExistingCmdId(null)
    setErreur(null)
  }

  const ajouterAuPanier = (art: Article) => {
    setPanier(prev => {
      const isCatPizza = categories.find(c => c.id === art.categorie_id)?.nom?.toLowerCase().includes('pizza')
      const tailleDef: Taille = isCatPizza ? '33cm' : ''
      const idx = prev.findIndex(p => p.article.id === art.id && p.taille === tailleDef)
      if (idx >= 0) {
        const nv = [...prev]
        nv[idx] = { ...nv[idx], quantite: nv[idx].quantite + 1 }
        return nv
      }
      return [...prev, { article: art, quantite: 1, taille: tailleDef, commentaire: '' }]
    })
  }

  const appliquerCodePromo = async () => {
    if (!reduction.codePromo.trim()) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase.from('codes_promo').select('*').eq('code', reduction.codePromo.trim()).eq('actif', true).single()
      if (!data) { setReduction(r => ({ ...r, codePromoMsg: 'Code invalide ou inactif', codePromoValeur: 0 })); return }
      if (data.date_expiration && data.date_expiration < today) { setReduction(r => ({ ...r, codePromoMsg: 'Code expiré', codePromoValeur: 0 })); return }
      const sousTotal = panier.reduce((s, p) => s + p.article.prix * p.quantite, 0)
      const valeur = data.type === 'pct' ? sousTotal * (data.valeur / 100) : data.valeur
      setReduction(r => ({ ...r, codePromoValeur: valeur, codePromoMsg: `Code appliqué : -${valeur.toFixed(2)} €` }))
    } catch { setReduction(r => ({ ...r, codePromoMsg: 'Code invalide', codePromoValeur: 0 })) }
  }

  const appliquerBonFidelite = async () => {
    if (!reduction.bonFidelite.trim()) return
    try {
      const { data } = await supabase.from('bons_fidelite').select('*').eq('code', reduction.bonFidelite.trim()).eq('statut', 'actif').single()
      if (!data) { setReduction(r => ({ ...r, bonFideliteMsg: 'Bon invalide ou déjà utilisé', bonFideliteValeur: 0 })); return }
      setReduction(r => ({ ...r, bonFideliteValeur: data.valeur, bonFideliteMsg: `Bon appliqué : -${data.valeur.toFixed(2)} €` }))
    } catch { setReduction(r => ({ ...r, bonFideliteMsg: 'Bon invalide', bonFideliteValeur: 0 })) }
  }

  const makeLigne = (p: PanierItem, statut: string, ajout_apres: boolean, commande_id: string) => {
    const cat = categories.find(c => c.id === p.article.categorie_id)
    const nomCat = (cat?.nom ?? '').toLowerCase()
    const pour_cuisine = !CATS_PAS_CUISINE.some(c => nomCat.includes(c))
    return {
      commande_id,
      article_id: p.article.id,
      article_nom: p.article.nom,
      quantite: p.quantite,
      taille: p.taille || null,
      prix_unitaire: p.article.prix,
      statut,
      ajout_apres,
      pour_cuisine,
      categorie_nom: cat?.nom ?? null,
    }
  }

  const envoyerEnCuisine = async () => {
    if (!nomClient.trim()) { setErrNom('Le nom est obligatoire'); return }
    if (panier.length === 0) return

    const indicesEnvoi = panierEnvoiSelectionne.size === 0
      ? panier.map((_, i) => i)
      : Array.from(panierEnvoiSelectionne)
    const panierEnvoi = panier.filter((_, i) => indicesEnvoi.includes(i))
    const panierAttente = panier.filter((_, i) => !indicesEnvoi.includes(i))

    if (panierEnvoi.length === 0) return

    setSaving(true)
    setErreur(null)

    // Lire depuis le ref pour garantir la valeur courante (évite les stale closures)
    const cmdId = existingCmdIdRef.current

    try {
      // ─── CAS : ajout à une commande existante ───────────────────────────────
      if (cmdId) {
        console.log('[ajout] commande existante:', cmdId, 'nb nouveaux articles:', panierEnvoi.length)
        // Insérer UNIQUEMENT les nouveaux articles avec ajout_apres=true
        const { error: insEnvErr } = await supabase.from('lignes_commande').insert(
          panierEnvoi.map(p => makeLigne(p, 'envoye_cuisine', true, cmdId))
        )
        if (insEnvErr) throw new Error(`Erreur insertion lignes (ajout) : ${insEnvErr.message}`)

        if (panierAttente.length > 0) {
          const { error: insAttErr } = await supabase.from('lignes_commande').insert(
            panierAttente.map(p => makeLigne(p, 'en_attente', true, cmdId))
          )
          if (insAttErr) throw new Error(`Erreur insertion lignes attente : ${insAttErr.message}`)
        }

        // Remettre la commande en_preparation pour que Roberto voie les nouveaux articles
        const { error: resetErr } = await supabase
          .from('commandes')
          .update({ statut: 'en_preparation' })
          .eq('id', cmdId)
          .in('statut', ['en_preparation', 'pret_encaisser', 'en_cours'])
        if (resetErr) console.error('[ajout] reset statut error:', resetErr)

        existingCmdIdRef.current = null
        setExistingCmdId(null)
        setModalTable(null)
        setPanier([])
        setPanierEnvoiSelectionne(new Set())
        await fetchTout()
        return
      }

      // ─── CAS : nouvelle commande ─────────────────────────────────────────────
      const total = calcTotal(panier, reduction)

      const { data: cmd, error: cmdErr } = await supabase
        .from('commandes')
        .insert([{
          type: 'sur_place',
          statut: 'en_preparation',
          nom_client: nomClient.trim(),
          telephone: telClient || null,
          table_numero: modalTable?.num,
          zone: modalTable?.zone,
          couverts,
          total,
          reduction_pct: parseFloat(reduction.pct) || 0,
          reduction_montant: parseFloat(reduction.montant) || 0,
          code_promo: reduction.codePromo || null,
          offert: reduction.offrir,
          offert_motif: reduction.offrirMotif || null,
          client_id: clientFidele?.id || null,
        }])
        .select()
        .single()

      if (cmdErr || !cmd) {
        const msg = cmdErr?.message ?? 'Erreur inconnue'
        console.error('[envoyerEnCuisine] insert commande error:', cmdErr)
        throw new Error(`Impossible de créer la commande : ${msg}`)
      }

      console.log('[envoyerEnCuisine] commande créée:', cmd.id, 'statut: en_preparation')

      // Insérer les lignes cuisine
      const { error: lignesEnvErr } = await supabase
        .from('lignes_commande')
        .insert(panierEnvoi.map(p => makeLigne(p, 'envoye_cuisine', false, cmd.id)))
      if (lignesEnvErr) throw new Error(`Erreur insertion articles cuisine : ${lignesEnvErr.message}`)

      // Insérer les lignes en attente
      if (panierAttente.length > 0) {
        const { error: lignesAttErr } = await supabase
          .from('lignes_commande')
          .insert(panierAttente.map(p => makeLigne(p, 'en_attente', true, cmd.id)))
        if (lignesAttErr) throw new Error(`Erreur insertion articles attente : ${lignesAttErr.message}`)
      }

      // Mettre à jour (ou créer) la table
      if (modalTable?.num) {
        await upsertTable(modalTable.num, modalTable.zone, 'occupee', cmd.id)
      }

      setModalTable(null)
      setPanier([])
      setPanierEnvoiSelectionne(new Set())
      await fetchTout()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[envoyerEnCuisine] ERROR:', msg)
      setErreur(msg)
    } finally {
      setSaving(false)
    }
  }

  const validerPaiement = async () => {
    if (!modalEncaiss) return
    setSaving(true)
    setErreur(null)
    try {
      const { error: payErr } = await supabase
        .from('commandes')
        .update({ statut: 'encaissee', mode_paiement: modePaiement })
        .eq('id', modalEncaiss.id)
      if (payErr) throw new Error(`Erreur encaissement : ${payErr.message}`)

      // Libérer la table (avec filtre zone pour éviter collisions)
      if (modalEncaiss.table_numero) {
        let q = supabase
          .from('tables_restaurant')
          .update({ statut: 'libre', commande_id: null })
          .eq('numero', modalEncaiss.table_numero)
        if (modalEncaiss.zone) q = q.eq('zone', modalEncaiss.zone)
        const { error: tabErr } = await q
        if (tabErr) console.error('[validerPaiement] table release error:', tabErr)
      }

      // Points fidélité
      if (clientFidele && (modalEncaiss.total ?? 0) > 0) {
        const pts = Math.floor(modalEncaiss.total ?? 0)
        await supabase.from('mouvements_fidelite').insert([{
          client_id: clientFidele.id,
          points: pts,
          motif: `Commande #${modalEncaiss.numero_commande}`
        }])
        await supabase.from('clients').update({ points: clientFidele.points + pts }).eq('id', clientFidele.id)
      }

      setModalEncaiss(null)
      await fetchTout()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[validerPaiement] ERROR:', msg)
      setErreur(msg)
    } finally {
      setSaving(false)
    }
  }

  const annulerCommande = async (cmd: CommandeActive) => {
    setSaving(true)
    setErreur(null)
    try {
      const { error: annErr } = await supabase
        .from('commandes')
        .update({ statut: 'annulee' })
        .eq('id', cmd.id)
      if (annErr) throw new Error(`Erreur annulation : ${annErr.message}`)

      if (cmd.table_numero) {
        let q = supabase
          .from('tables_restaurant')
          .update({ statut: 'libre', commande_id: null })
          .eq('numero', cmd.table_numero)
        if (cmd.zone) q = q.eq('zone', cmd.zone)
        await q
      }
      setModalDetail(null)
      await fetchTout()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[annulerCommande] ERROR:', msg)
      setErreur(msg)
    } finally {
      setSaving(false)
    }
  }

  const supprimerCommande = async (cmd: CommandeActive) => {
    console.log('suppression déclenchée pour:', cmd.id)
    setSaving(true)
    setErreur(null)
    try {
      // 1. Libérer la table EN PREMIER (avant delete, pour éviter FK violation si commande_id est une FK)
      if (cmd.table_numero) {
        let q = supabase
          .from('tables_restaurant')
          .update({ statut: 'libre', commande_id: null })
          .eq('numero', cmd.table_numero)
        if (cmd.zone) q = q.eq('zone', cmd.zone)
        const { error: tabErr } = await q
        if (tabErr) console.error('[supprimerCommande] table release error:', tabErr)
        else console.log('[supprimerCommande] table libérée')
      }

      // 2. Supprimer les lignes
      const { error: delLigErr } = await supabase
        .from('lignes_commande')
        .delete()
        .eq('commande_id', cmd.id)
      if (delLigErr) throw new Error(`Erreur suppression articles : ${delLigErr.message}`)
      console.log('[supprimerCommande] lignes supprimées')

      // 3. Supprimer la commande
      const { error: delCmdErr } = await supabase
        .from('commandes')
        .delete()
        .eq('id', cmd.id)
      if (delCmdErr) throw new Error(`Erreur suppression commande : ${delCmdErr.message}`)
      console.log('[supprimerCommande] commande supprimée')

      setConfirmDelete(null)
      setModalDetail(null)
      await fetchTout()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[supprimerCommande] ERROR:', msg)
      setErreur(msg)
    } finally {
      setSaving(false)
    }
  }

  const ajouterArticlesTable = (cmd: CommandeActive) => {
    const t = tables.find(tbl => tbl.num === cmd.table_numero) ?? {
      num: cmd.table_numero ?? 0,
      zone: cmd.zone ?? 'rdc',
      statut: 'occupee' as const,
      commande: cmd
    }
    setModalDetail(null)
    setModalTable(t)
    setEtape(2)
    setNomClient(cmd.nom_client ?? '')
    setTelClient('')
    setCouverts(cmd.couverts ?? 2)
    setClientFidele(null)
    setPanier([])
    setReduction({ pct: '', montant: '', codePromo: '', codePromoValeur: 0, codePromoMsg: '', bonFidelite: '', bonFideliteValeur: 0, bonFideliteMsg: '', offrir: false, offrirMotif: '' })
    setPanierEnvoiSelectionne(new Set())
    existingCmdIdRef.current = cmd.id
    setExistingCmdId(cmd.id)
    setErreur(null)
  }

  const ouvrirModalEmporter = () => {
    const { date, label, midi, soir } = computeEmpDate()
    setEmpDate(date)
    setEmpLabelJour(label)
    setEmpSlotsMidi(midi)
    setEmpSlotsSoir(soir)
    setEmpNom('')
    setEmpTel('')
    setEmpHeure('')
    setEmpPanier([])
    setEmpCatActive(categories[0]?.id ?? '')
    setEmpErr(null)
    setModalNvEmporter(true)
  }

  const validerEmporter = async () => {
    setEmpErr(null)
    if (!empNom.trim()) { setEmpErr('Le nom est obligatoire'); return }
    if (!empTel.trim()) { setEmpErr('Le téléphone est obligatoire'); return }
    if (!empHeure) { setEmpErr('Choisissez une heure de retrait'); return }
    if (empPanier.length === 0) { setEmpErr('Ajoutez au moins un article'); return }
    setEmpSaving(true)
    try {
      const total = empPanier.reduce((s, p) => s + p.article.prix * p.quantite, 0)
      const { data: cmd, error: cmdErr } = await supabase.from('commandes').insert({
        nom_client: empNom.trim(),
        telephone: empTel.trim(),
        heure_retrait: empHeure,
        date_retrait: empDate,
        type: 'a_emporter',
        statut: 'en_preparation',
        total,
      }).select().single()
      if (cmdErr || !cmd) throw new Error(cmdErr?.message ?? 'Erreur création commande')

      const lignes = empPanier.map(p => ({
        commande_id: cmd.id,
        article_id: p.article.id,
        article_nom: p.article.nom,
        quantite: p.quantite,
        prix_unitaire: p.article.prix,
        taille: p.taille || null,
      }))
      const { error: ligErr } = await supabase.from('lignes_commande').insert(lignes)
      if (ligErr) throw new Error(`Erreur insertion articles : ${ligErr.message}`)

      setModalNvEmporter(false)
      await fetchTout()
    } catch (err) {
      setEmpErr(err instanceof Error ? err.message : String(err))
    } finally {
      setEmpSaving(false)
    }
  }

  const tablesByZone = tables.filter(t => t.zone === zone)
  const commandesEmporter = commandes.filter(c =>
    c.type === 'a_emporter' && !['encaissee', 'annulee'].includes(c.statut)
  )

  const tableCardClass = (statut: string) => {
    if (statut === 'libre') return 'bg-green-50 border-green-400 hover:bg-green-100 cursor-pointer'
    if (statut === 'pret_encaisser') return 'bg-orange-50 border-orange-400 cursor-pointer'
    if (statut === 'reservee') return 'bg-blue-50 border-blue-400 cursor-pointer'
    return 'bg-red-50 border-red-400 cursor-pointer'
  }

  const articlesFiltres = articles.filter(a =>
    (catActive ? a.categorie_id === catActive : true) &&
    (recherche ? a.nom.toLowerCase().includes(recherche.toLowerCase()) : true)
  )

  const sousTotal = panier.reduce((s, p) => s + p.article.prix * p.quantite, 0)
  const totalFinal = calcTotal(panier, reduction)

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">Commandes</h1>

      {/* Message d'erreur global visible */}
      {erreur && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm flex items-start gap-2">
          <span className="text-lg">⚠️</span>
          <div className="flex-1">{erreur}</div>
          <button onClick={() => setErreur(null)} className="text-red-400 hover:text-red-700 font-bold text-lg leading-none">✕</button>
        </div>
      )}

      {/* Onglets principaux */}
      <div className="flex gap-2 mb-6">
        {([['sur_place', '🍽 Sur place'], ['a_emporter', '🥡 À emporter']] as [TypeCmd, string][]).map(([val, label]) => (
          <button key={val} onClick={() => setOnglet(val)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all border ${onglet === val ? 'bg-[#B71C1C] text-white border-[#B71C1C]' : 'bg-white text-[#555] border-[#E0D5C5] hover:bg-[#F0EBE0]'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-[#555]">Chargement...</div> : onglet === 'sur_place' ? (
        <>
          {/* Sous-onglets zones */}
          <div className="flex gap-2 mb-5">
            {ZONES.map(z => (
              <button key={z.key} onClick={() => setZone(z.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${zone === z.key ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-[#555] border-[#E0D5C5]'}`}>
                {z.icon} {z.label}
              </button>
            ))}
          </div>

          {/* Tables : liste sur mobile, grille sur sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-4 xl:grid-cols-6 gap-3 mb-8">
            {tablesByZone.map(t => (
              <div
                key={t.num}
                onClick={() => {
                  if (t.statut === 'libre') ouvrirModalNvCmd(t)
                  else if (t.commande) { setModalDetail(t.commande); setModePaiement('cb'); setMontantRecu('') }
                }}
                className={`rounded-xl p-4 border-2 transition-all min-h-[48px] ${tableCardClass(t.statut)}`}
                style={{ display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <div className={`text-xl font-bold shrink-0 sm:text-2xl ${t.statut === 'libre' ? 'text-green-700' : (t.statut === 'pret_encaisser') ? 'text-orange-700' : 'text-red-700'}`}>T{t.num}</div>
                <div className="flex flex-col sm:items-center gap-0.5 flex-1">
                  <div className={`text-xs font-medium ${t.statut === 'libre' ? 'text-green-600' : (t.statut === 'pret_encaisser') ? 'text-orange-600' : 'text-red-600'}`}>
                    {t.statut === 'libre' ? '🟢 Libre' : t.statut === 'pret_encaisser' ? '🟠 À encaisser' : t.statut === 'reservee' ? '🔵 Réservée' : '🔴 Occupée'}
                  </div>
                  {t.commande?.nom_client && <div className="text-xs text-gray-500 truncate">{t.commande.nom_client}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Sélecteur de date — historique */}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-[#555] font-medium">Jour :</label>
            <input
              type="date"
              value={dateFiltre}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => {
                setDateFiltre(e.target.value)
                fetchTout(e.target.value)
              }}
              className="border border-[#E0D5C5] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]"
            />
            {dateFiltre !== new Date().toISOString().split('T')[0] && (
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0]
                  setDateFiltre(today)
                  fetchTout(today)
                }}
                className="text-xs text-[#B71C1C] underline"
              >
                ← Revenir à aujourd&apos;hui
              </button>
            )}
          </div>

          {/* Liste commandes sur place */}
          <div className="space-y-2">
            {commandes
              .filter(c => c.type === 'sur_place')
              .map(cmd => (
                <CommandeRow
                  key={cmd.id}
                  cmd={cmd}
                  onEncaisser={() => { setModalEncaiss(cmd); setModePaiement('cb'); setMontantRecu('') }}
                  onSupprimer={() => setConfirmDelete(cmd)}
                  onUpdate={fetchTout}
                />
              ))}
            {commandes.filter(c => c.type === 'sur_place').length === 0 && (
              <div className="text-[#555] text-sm py-4">Aucune commande ce jour-là.</div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {/* Bouton nouvelle commande à emporter */}
          <div className="mb-4">
            <button
              onClick={ouvrirModalEmporter}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-[#1B5E20] text-white hover:bg-[#2E7D32] transition-all">
              + Nouvelle commande à emporter
            </button>
          </div>
          {/* Sélecteur de date — historique */}
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-[#555] font-medium">Jour :</label>
            <input
              type="date"
              value={dateFiltre}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => {
                setDateFiltre(e.target.value)
                fetchTout(e.target.value)
              }}
              className="border border-[#E0D5C5] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]"
            />
            {dateFiltre !== new Date().toISOString().split('T')[0] && (
              <button
                onClick={() => {
                  const today = new Date().toISOString().split('T')[0]
                  setDateFiltre(today)
                  fetchTout(today)
                }}
                className="text-xs text-[#B71C1C] underline"
              >
                ← Revenir à aujourd&apos;hui
              </button>
            )}
          </div>
          {commandesEmporter.length === 0
            ? <div className="text-[#555] text-sm py-4">Aucune commande à emporter ce jour-là.</div>
            : commandesEmporter.map(cmd => (
              <CommandeRow
                key={cmd.id}
                cmd={cmd}
                onEncaisser={() => { setModalEncaiss(cmd); setModePaiement('cb'); setMontantRecu('') }}
                onSupprimer={() => setConfirmDelete(cmd)}
                onUpdate={fetchTout}
              />
            ))}
        </div>
      )}

      {/* ===== MODAL NOUVELLE COMMANDE / AJOUT ===== */}
      {modalTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0D5C5]">
              <h2 className="text-lg font-bold">
                {existingCmdId ? `Ajout articles — Table ${modalTable.num}` : `Nouvelle commande — Table ${modalTable.num}`}
              </h2>
              <div className="flex gap-2">
                {([1, 2, 3] as const).map(n => (
                  <span key={n} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${etape === n ? 'bg-[#B71C1C] text-white' : etape > n ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{n}</span>
                ))}
              </div>
              <button onClick={() => setModalTable(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            {/* Erreur dans le modal */}
            {erreur && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm">
                ⚠️ {erreur}
              </div>
            )}

            <div className="p-6">
              {/* Étape 1 */}
              {etape === 1 && (
                <div className="max-w-md space-y-4">
                  <h3 className="font-semibold text-[#1A1A1A]">Client</h3>
                  <div>
                    <label className="block text-sm text-[#555] mb-1">Nom / Prénom *</label>
                    <input value={nomClient} onChange={e => { setNomClient(e.target.value); setErrNom('') }}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20] ${errNom ? 'border-red-400' : 'border-[#E0D5C5]'}`}
                      placeholder="Ex: Dupont Jean" />
                    {errNom && <p className="text-red-600 text-xs mt-1">{errNom}</p>}
                  </div>
                  <div>
                    <label className="block text-sm text-[#555] mb-1">Téléphone</label>
                    <input value={telClient} onChange={e => setTelClient(e.target.value)}
                      onBlur={checkClientFidele}
                      className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]"
                      placeholder="06 XX XX XX XX" />
                    {clientFidele && (
                      <div className="mt-1 text-sm text-green-700 bg-green-50 rounded px-3 py-1">
                        ✓ Bonjour <strong>{clientFidele.nom}</strong> — Client fidèle ({clientFidele.points} points)
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-[#555] mb-1">Couverts</label>
                    <input type="number" min={1} max={20} value={couverts} onChange={e => setCouverts(Number(e.target.value))}
                      className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  </div>
                  <button onClick={() => { if (!nomClient.trim()) { setErrNom('Le nom est obligatoire'); return } setEtape(2) }}
                    className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white py-2 rounded-lg font-medium">
                    Suivant →
                  </button>
                </div>
              )}

              {/* Étape 2 */}
              {etape === 2 && (
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Articles */}
                  <div className="flex-1">
                    <input value={recherche} onChange={e => setRecherche(e.target.value)}
                      placeholder="Rechercher un article..."
                      className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none" />
                    {categories.length > 0 && (
                      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 snap-x snap-mandatory">
                        <button onClick={() => setCatActive('')}
                          className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap snap-start min-h-[36px] ${!catActive ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-[#555] border-[#E0D5C5]'}`}>
                          Tout
                        </button>
                        {categories.map(c => (
                          <button key={c.id} onClick={() => setCatActive(c.id)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap snap-start min-h-[36px] ${catActive === c.id ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-[#555] border-[#E0D5C5]'}`}>
                            {c.nom}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {articlesFiltres.map(art => (
                        <button key={art.id} onClick={() => ajouterAuPanier(art)}
                          className="bg-white border border-[#E0D5C5] rounded-lg p-3 text-left hover:border-[#1B5E20] hover:shadow-sm transition-all">
                          <div className="text-sm font-medium text-[#1A1A1A]">{art.nom}</div>
                          <div className="text-xs text-[#B71C1C] font-bold mt-1">{art.prix.toFixed(2)} €</div>
                        </button>
                      ))}
                      {articlesFiltres.length === 0 && <div className="text-[#555] text-sm col-span-3">Aucun article</div>}
                    </div>
                  </div>

                  {/* Panier */}
                  <div className="w-full lg:w-72 shrink-0">
                    <h4 className="font-semibold text-[#1A1A1A] mb-3">Panier</h4>
                    {panier.length === 0 ? <div className="text-[#555] text-sm">Panier vide</div> : (
                      <div className="space-y-3 mb-4">
                        {panier.map((item, idx) => (
                          <div key={idx} className="bg-[#F0EBE0] rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{item.article.nom}</span>
                              <button onClick={() => setPanier(p => p.filter((_, i) => i !== idx))} className="text-red-500 text-xs">✕</button>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <button onClick={() => setPanier(p => p.map((x, i) => i === idx ? { ...x, quantite: Math.max(1, x.quantite - 1) } : x))} className="w-6 h-6 rounded bg-white border border-[#E0D5C5] text-sm flex items-center justify-center">-</button>
                              <span className="text-sm font-bold">{item.quantite}</span>
                              <button onClick={() => setPanier(p => p.map((x, i) => i === idx ? { ...x, quantite: x.quantite + 1 } : x))} className="w-6 h-6 rounded bg-white border border-[#E0D5C5] text-sm flex items-center justify-center">+</button>
                              <select value={item.taille} onChange={e => setPanier(p => p.map((x, i) => i === idx ? { ...x, taille: e.target.value as Taille } : x))}
                                className="text-xs border border-[#E0D5C5] rounded px-1 py-0.5 bg-white">
                                <option value="">Taille</option>
                                <option value="33cm">33cm</option>
                                <option value="Pala">Pala</option>
                                <option value="Calzone">Calzone</option>
                              </select>
                            </div>
                            <input value={item.commentaire} onChange={e => setPanier(p => p.map((x, i) => i === idx ? { ...x, commentaire: e.target.value } : x))}
                              placeholder="Commentaire..." className="w-full text-xs border border-[#E0D5C5] rounded px-2 py-1" />
                            <div className="text-xs text-right text-[#B71C1C] font-bold mt-1">{(item.article.prix * item.quantite).toFixed(2)} €</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Réductions */}
                    <div className="border-t border-[#E0D5C5] pt-3 space-y-2">
                      <h5 className="text-xs font-semibold text-[#555] uppercase tracking-wider">Réductions</h5>
                      <div className="flex gap-2">
                        <input value={reduction.pct} onChange={e => setReduction(r => ({ ...r, pct: e.target.value }))}
                          placeholder="% réduction" type="number" min="0" max="100"
                          className="w-1/2 text-xs border border-[#E0D5C5] rounded px-2 py-1" />
                        <input value={reduction.montant} onChange={e => setReduction(r => ({ ...r, montant: e.target.value }))}
                          placeholder="€ réduction" type="number" min="0"
                          className="w-1/2 text-xs border border-[#E0D5C5] rounded px-2 py-1" />
                      </div>
                      <div className="flex gap-1">
                        <input value={reduction.codePromo} onChange={e => setReduction(r => ({ ...r, codePromo: e.target.value }))}
                          placeholder="Code promo" className="flex-1 text-xs border border-[#E0D5C5] rounded px-2 py-1" />
                        <button onClick={appliquerCodePromo} className="text-xs bg-[#1B5E20] text-white px-2 py-1 rounded">OK</button>
                      </div>
                      {reduction.codePromoMsg && <p className="text-xs text-green-700">{reduction.codePromoMsg}</p>}
                      <div className="flex gap-1">
                        <input value={reduction.bonFidelite} onChange={e => setReduction(r => ({ ...r, bonFidelite: e.target.value }))}
                          placeholder="Bon fidélité" className="flex-1 text-xs border border-[#E0D5C5] rounded px-2 py-1" />
                        <button onClick={appliquerBonFidelite} className="text-xs bg-[#D4A843] text-white px-2 py-1 rounded">OK</button>
                      </div>
                      {reduction.bonFideliteMsg && <p className="text-xs text-[#D4A843]">{reduction.bonFideliteMsg}</p>}
                      {session?.role === 'monica' && (
                        <label className="flex items-center gap-2 text-xs">
                          <input type="checkbox" checked={reduction.offrir} onChange={e => setReduction(r => ({ ...r, offrir: e.target.checked }))} />
                          Offrir la commande
                          {reduction.offrir && (
                            <input value={reduction.offrirMotif} onChange={e => setReduction(r => ({ ...r, offrirMotif: e.target.value }))}
                              placeholder="Motif *" className="flex-1 border border-[#E0D5C5] rounded px-2 py-0.5" required />
                          )}
                        </label>
                      )}
                      <div className="text-xs text-[#555]">Sous-total : {sousTotal.toFixed(2)} €</div>
                      <div className="font-bold text-[#B71C1C]">Total : {totalFinal.toFixed(2)} €</div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      {!existingCmdId && (
                        <button onClick={() => setEtape(1)} className="flex-1 border border-[#E0D5C5] text-[#555] py-2 rounded-lg text-sm">← Retour</button>
                      )}
                      <button onClick={() => setEtape(3)} disabled={panier.length === 0} className="flex-1 bg-[#1B5E20] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40">Suivant →</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Étape 3 */}
              {etape === 3 && (
                <div className="max-w-md space-y-4">
                  <h3 className="font-semibold text-[#1A1A1A]">Validation</h3>
                  <div className="bg-[#F0EBE0] rounded-xl p-4 space-y-1">
                    <div className="text-sm font-medium text-[#555]">Table {modalTable.num} · {couverts} couvert{couverts > 1 ? 's' : ''}</div>
                    <div className="text-sm font-medium">{nomClient}</div>
                    {panier.map((item, i) => {
                      const cat = categories.find(c => c.id === item.article.categorie_id)
                      const nomCat = cat?.nom?.toLowerCase() ?? ''
                      const pourCuisine = !CATS_PAS_CUISINE.some(c => nomCat.includes(c))
                      return (
                        <div key={i} className="flex items-center justify-between text-sm py-1">
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input type="checkbox"
                              checked={panierEnvoiSelectionne.size === 0 || panierEnvoiSelectionne.has(i)}
                              onChange={e => {
                                setPanierEnvoiSelectionne(prev => {
                                  const next = new Set(prev)
                                  if (next.size === 0) {
                                    panier.forEach((_, j) => { if (j !== i) next.add(j) })
                                  } else {
                                    if (e.target.checked) next.add(i)
                                    else next.delete(i)
                                  }
                                  return next
                                })
                              }}
                              disabled={!pourCuisine}
                              className="rounded"
                            />
                            <span className="text-xs text-[#555]">
                              {pourCuisine ? 'Envoyer en cuisine' : '🥤 Boisson/Vin'}
                            </span>
                            <span>{item.quantite}× {item.article.nom} {item.taille && `(${item.taille})`}</span>
                          </label>
                          <span className="font-medium">{(item.article.prix * item.quantite).toFixed(2)} €</span>
                        </div>
                      )
                    })}
                    <div className="border-t border-[#E0D5C5] pt-2 mt-2">
                      {(parseFloat(reduction.pct) > 0 || parseFloat(reduction.montant) > 0 || reduction.codePromoValeur > 0 || reduction.bonFideliteValeur > 0) && (
                        <div className="text-xs text-green-700">Réductions appliquées</div>
                      )}
                      <div className="font-bold text-[#B71C1C] text-lg">Total TTC : {totalFinal.toFixed(2)} €</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEtape(2)} className="flex-1 border border-[#E0D5C5] text-[#555] py-2 rounded-lg text-sm">← Retour</button>
                  </div>
                  <button onClick={envoyerEnCuisine} disabled={saving}
                    className="w-full bg-[#B71C1C] hover:bg-[#C62828] text-white py-3 rounded-lg font-medium disabled:opacity-50">
                    {saving ? 'Envoi en cours...' : `📤 Envoyer ${panierEnvoiSelectionne.size === 0 ? panier.length : panierEnvoiSelectionne.size} article(s) en cuisine`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL TABLE OCCUPÉE ===== */}
      {modalDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0D5C5]">
              <div>
                <h2 className="text-lg font-bold">Table {modalDetail.table_numero} — {modalDetail.nom_client}</h2>
                {modalDetail.couverts && (
                  <p className="text-xs text-[#555] mt-0.5">{modalDetail.couverts} couvert{modalDetail.couverts > 1 ? 's' : ''}</p>
                )}
              </div>
              <button onClick={() => setModalDetail(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Articles en cuisine / prêts */}
              {(modalDetail.lignes_commande ?? []).filter(l => !l.statut || l.statut === 'envoye_cuisine' || l.statut === 'pret').length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-2">En cuisine / Prêts</h4>
                  <div className="space-y-1">
                    {(modalDetail.lignes_commande ?? [])
                      .filter(l => !l.statut || l.statut === 'envoye_cuisine' || l.statut === 'pret')
                      .map(l => (
                        <div key={l.id} className="flex justify-between text-sm py-1 border-b border-[#F0EBE0]">
                          <span className={l.statut === 'pret' ? 'line-through text-gray-400' : ''}>
                            {l.quantite}× {l.article_nom}{l.taille ? ` (${l.taille})` : ''}
                            {l.ajout_apres && <span className="ml-1 text-xs bg-yellow-200 text-yellow-800 px-1 rounded">AJOUT</span>}
                            {l.commentaire && <span className="text-xs text-[#555] ml-1">— {l.commentaire}</span>}
                          </span>
                          <span className="ml-2 flex items-center gap-1">
                            {l.statut === 'pret' && <span className="text-green-600 text-xs font-medium">✓ Prêt</span>}
                            <span className="text-[#555]">{(l.prix_unitaire * l.quantite).toFixed(2)} €</span>
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {/* Articles en attente */}
              {(modalDetail.lignes_commande ?? []).filter(l => l.statut === 'en_attente').length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-2">En attente d&apos;envoi</h4>
                  <div className="space-y-1">
                    {(modalDetail.lignes_commande ?? []).filter(l => l.statut === 'en_attente').map(l => (
                      <div key={l.id} className="flex justify-between text-sm py-1 border-b border-[#F0EBE0]">
                        <span className="text-yellow-700">{l.quantite}× {l.article_nom}{l.taille ? ` (${l.taille})` : ''}</span>
                        <span className="text-[#555]">{(l.prix_unitaire * l.quantite).toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t border-[#E0D5C5] pt-3 font-bold text-[#B71C1C]">
                Total : {modalDetail.total?.toFixed(2)} €
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => ajouterArticlesTable(modalDetail)}
                  className="flex-1 bg-[#1B5E20] hover:bg-[#2E7D32] text-white py-2 rounded-lg text-sm font-medium min-w-[140px]">
                  + Ajouter des articles
                </button>
                {(STATUTS_ACTIFS as string[]).includes(modalDetail.statut) && (
                  <button
                    onClick={() => { setModalEncaiss(modalDetail); setModalDetail(null); setModePaiement('cb'); setMontantRecu('') }}
                    className="flex-1 bg-[#B71C1C] hover:bg-[#C62828] text-white py-2 rounded-lg text-sm font-medium min-w-[140px]">
                    💳 Encaisser
                  </button>
                )}
              </div>
              <div className="flex gap-3 flex-wrap border-t border-[#F0EBE0] pt-3">
                <button
                  onClick={() => annulerCommande(modalDetail)}
                  disabled={saving}
                  className="flex-1 border border-orange-300 text-orange-700 py-2 rounded-lg text-sm font-medium min-w-[140px] hover:bg-orange-50 disabled:opacity-50">
                  ✗ Annuler la commande
                </button>
                <button
                  onClick={() => { setConfirmDelete(modalDetail); setModalDetail(null) }}
                  className="flex-1 border border-red-300 text-red-700 py-2 rounded-lg text-sm font-medium min-w-[140px] hover:bg-red-50">
                  🗑 Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL ENCAISSEMENT ===== */}
      {modalEncaiss && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0D5C5]">
              <h2 className="text-lg font-bold">Encaissement #{modalEncaiss.numero_commande}</h2>
              <button onClick={() => setModalEncaiss(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {erreur && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm">⚠️ {erreur}</div>
              )}
              <div className="bg-[#F0EBE0] rounded-xl p-4">
                {modalEncaiss.nom_client && <div className="font-medium mb-1">{modalEncaiss.nom_client}</div>}
                {modalEncaiss.couverts && (
                  <div className="text-xs text-[#555] mb-2">{modalEncaiss.couverts} couvert{modalEncaiss.couverts > 1 ? 's' : ''}</div>
                )}
                {(modalEncaiss.lignes_commande ?? []).map(l => (
                  <div key={l.id} className="flex justify-between text-sm">
                    <span>{l.quantite}× {l.article_nom}{l.taille ? ` (${l.taille})` : ''}</span>
                    <span>{(l.prix_unitaire * l.quantite).toFixed(2)} €</span>
                  </div>
                ))}
                <div className="border-t border-[#E0D5C5] pt-2 mt-2 font-bold text-[#B71C1C]">
                  Total : {modalEncaiss.total?.toFixed(2)} €
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#555] mb-2">Mode de paiement</label>
                <div className="flex gap-2">
                  {(['especes', 'cb', 'cheque'] as ModePaiement[]).map(m => (
                    <button key={m} onClick={() => setModePaiement(m)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border capitalize transition-all ${modePaiement === m ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-[#555] border-[#E0D5C5]'}`}>
                      {m === 'cb' ? 'CB' : m === 'especes' ? 'Espèces' : 'Chèque'}
                    </button>
                  ))}
                </div>
              </div>

              {modePaiement === 'especes' && (
                <div>
                  <label className="block text-sm text-[#555] mb-1">Montant reçu (€)</label>
                  <input type="number" min="0" step="0.01" value={montantRecu} onChange={e => setMontantRecu(e.target.value)}
                    className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm" />
                  {parseFloat(montantRecu) >= (modalEncaiss.total ?? 0) && (
                    <div className="mt-2 text-green-700 font-bold text-sm bg-green-50 rounded p-2">
                      Monnaie à rendre : {(parseFloat(montantRecu) - (modalEncaiss.total ?? 0)).toFixed(2)} €
                    </div>
                  )}
                </div>
              )}

              {clientFidele && (
                <div className="text-sm text-[#D4A843] bg-yellow-50 rounded p-2">
                  ⭐ Points gagnés : +{Math.floor(modalEncaiss.total ?? 0)} points
                </div>
              )}

              <button onClick={validerPaiement} disabled={saving}
                className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white py-3 rounded-xl font-bold text-lg disabled:opacity-50">
                {saving ? 'Validation...' : '✅ Valider le paiement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL CONFIRMATION SUPPRESSION ===== */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-bold text-red-700">⚠️ Supprimer la commande ?</h2>
            {erreur && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm">⚠️ {erreur}</div>
            )}
            <p className="text-sm text-[#555]">
              Commande de <strong>{confirmDelete.nom_client}</strong>
              {confirmDelete.table_numero ? ` — Table ${confirmDelete.table_numero}` : ''}<br />
              Cette action est irréversible. Tous les articles seront supprimés.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-[#E0D5C5] text-[#555] py-2 rounded-lg text-sm">
                Annuler
              </button>
              <button onClick={() => supprimerCommande(confirmDelete)} disabled={saving}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Suppression...' : '🗑 Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL NOUVELLE COMMANDE À EMPORTER ===== */}
      {modalNvEmporter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0D5C5]">
              <h2 className="text-lg font-bold">📦 Nouvelle commande à emporter</h2>
              <button onClick={() => setModalNvEmporter(false)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            {empErr && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-300 text-red-700 text-sm">⚠️ {empErr}</div>
            )}
            <div className="p-6 flex flex-col gap-5">
              {/* Infos client */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#555] mb-1">Nom du client *</label>
                  <input value={empNom} onChange={e => setEmpNom(e.target.value)}
                    className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]"
                    placeholder="Nom Prénom" />
                </div>
                <div>
                  <label className="block text-sm text-[#555] mb-1">Téléphone *</label>
                  <input value={empTel} onChange={e => setEmpTel(e.target.value)} type="tel"
                    className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20]"
                    placeholder="06 XX XX XX XX" />
                </div>
              </div>

              {/* Créneaux */}
              <div>
                <label className="block text-sm text-[#555] mb-2">Heure de retrait * — <span className="font-medium text-[#B71C1C]">{empLabelJour}</span></label>
                {empSlotsMidi.length === 0 && empSlotsSoir.length === 0 ? (
                  <div className="text-sm text-[#555] italic">Aucun créneau disponible aujourd&apos;hui</div>
                ) : (
                  <div className="space-y-3">
                    {empSlotsMidi.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-2">🌞 Midi</div>
                        <div className="flex flex-wrap gap-2">
                          {empSlotsMidi.map(s => (
                            <button key={s} onClick={() => setEmpHeure(s)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${empHeure === s ? 'bg-[#B71C1C] text-white border-[#B71C1C]' : 'bg-white text-[#333] border-[#E0D5C5] hover:border-[#B71C1C]'}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {empSlotsSoir.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-2">🌙 Soir</div>
                        <div className="flex flex-wrap gap-2">
                          {empSlotsSoir.map(s => (
                            <button key={s} onClick={() => setEmpHeure(s)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${empHeure === s ? 'bg-[#B71C1C] text-white border-[#B71C1C]' : 'bg-white text-[#333] border-[#E0D5C5] hover:border-[#B71C1C]'}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Articles + Panier */}
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Grille articles */}
                <div className="flex-1">
                  <label className="block text-sm text-[#555] mb-2">Articles</label>
                  <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                    {categories.map(c => (
                      <button key={c.id} onClick={() => setEmpCatActive(c.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${empCatActive === c.id ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-[#555] border-[#E0D5C5]'}`}>
                        {c.nom}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {articles.filter(a => a.categorie_id === empCatActive).map(art => (
                      <button key={art.id}
                        onClick={() => setEmpPanier(prev => {
                          const idx = prev.findIndex(p => p.article.id === art.id)
                          if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], quantite: n[idx].quantite + 1 }; return n }
                          return [...prev, { article: art, quantite: 1, taille: '', commentaire: '' }]
                        })}
                        className="bg-white border border-[#E0D5C5] rounded-lg p-2 text-left hover:border-[#1B5E20] hover:shadow-sm transition-all">
                        <div className="text-xs font-medium text-[#1A1A1A]">{art.nom}</div>
                        <div className="text-xs text-[#B71C1C] font-bold mt-0.5">{art.prix.toFixed(2)} €</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Panier */}
                <div className="w-full lg:w-64 shrink-0">
                  <h4 className="font-semibold text-sm text-[#1A1A1A] mb-2">Panier</h4>
                  {empPanier.length === 0 ? (
                    <div className="text-[#555] text-sm">Aucun article</div>
                  ) : (
                    <div className="space-y-2">
                      {empPanier.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 bg-[#F0EBE0] rounded-lg px-3 py-2">
                          <span className="text-xs font-medium flex-1">{item.article.nom}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEmpPanier(p => p.map((x, i) => i === idx ? { ...x, quantite: Math.max(1, x.quantite - 1) } : x))} className="w-5 h-5 rounded bg-white border border-[#E0D5C5] text-xs flex items-center justify-center">-</button>
                            <span className="text-xs font-bold w-4 text-center">{item.quantite}</span>
                            <button onClick={() => setEmpPanier(p => p.map((x, i) => i === idx ? { ...x, quantite: x.quantite + 1 } : x))} className="w-5 h-5 rounded bg-white border border-[#E0D5C5] text-xs flex items-center justify-center">+</button>
                          </div>
                          <button onClick={() => setEmpPanier(p => p.filter((_, i) => i !== idx))} className="text-red-500 text-xs ml-1">✕</button>
                        </div>
                      ))}
                      <div className="font-bold text-[#B71C1C] text-sm pt-2 border-t border-[#E0D5C5]">
                        Total : {empPanier.reduce((s, p) => s + p.article.prix * p.quantite, 0).toFixed(2)} €
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bouton valider */}
              <button onClick={validerEmporter} disabled={empSaving}
                className="w-full bg-[#B71C1C] hover:bg-[#C62828] text-white py-3 rounded-lg font-medium disabled:opacity-50">
                {empSaving ? 'Envoi...' : '📤 Envoyer en cuisine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CommandeRow({
  cmd,
  onEncaisser,
  onSupprimer,
  onUpdate,
}: {
  cmd: CommandeActive
  onEncaisser: () => void
  onSupprimer: () => void
  onUpdate: () => void
}) {
  const s = STATUT_LABELS[cmd.statut] ?? STATUT_LABELS.brouillon
  const [updatingStatut, setUpdatingStatut] = useState(false)
  const [errLocal, setErrLocal] = useState<string | null>(null)

  const updateStatut = async (statut: StatutCmd) => {
    setUpdatingStatut(true)
    setErrLocal(null)
    try {
      const { error } = await supabase.from('commandes').update({ statut: statut }).eq('id', cmd.id)
      if (error) throw new Error(error.message)
      onUpdate()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrLocal(`Erreur mise à jour : ${msg}`)
    } finally {
      setUpdatingStatut(false)
    }
  }

  const NEXT_STATUT: Partial<Record<StatutCmd, { statut: StatutCmd; label: string }>> = {
    brouillon: { statut: 'en_preparation', label: '→ En cuisine' },
    en_cours: { statut: 'pret_encaisser', label: '→ Prête' },
    en_preparation: { statut: 'pret_encaisser', label: '→ Prête' },
  }
  const next = NEXT_STATUT[cmd.statut]

  return (
    <div className="w-full rounded-xl p-4 flex flex-col gap-2 bg-white border border-[#E0D5C5] shadow-sm">
      {errLocal && (
        <div className="text-red-600 text-xs bg-red-50 px-2 py-1 rounded">{errLocal}</div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="text-xl font-bold text-[#D4A843]">#{cmd.numero_commande}</div>
          {cmd.nom_client && <div className="text-sm font-medium text-[#1A1A1A]">{cmd.nom_client}</div>}
          {cmd.table_numero && <div className="text-sm text-[#555]">Table {cmd.table_numero}</div>}
          {cmd.couverts && <div className="text-sm text-[#555]">{cmd.couverts} cvts</div>}
          <div className="text-sm text-[#555]">{new Date(cmd.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.tw}`}>{s.label}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-medium text-[#1A1A1A]">{cmd.total?.toFixed(2)} €</div>
          {next && (
            <button
              onClick={() => updateStatut(next.statut)}
              disabled={updatingStatut}
              className="px-3 py-1 rounded text-xs font-medium bg-[#1B5E20]/10 text-[#1B5E20] border border-[#1B5E20]/20 disabled:opacity-50">
              {next.label}
            </button>
          )}
          {(STATUTS_ACTIFS as string[]).includes(cmd.statut) && (
            <button onClick={onEncaisser}
              className="px-3 py-1 rounded text-xs font-medium bg-[#B71C1C] text-white">
              💳 Encaisser
            </button>
          )}
          <button
            onClick={onSupprimer}
            className="px-3 py-1 rounded text-xs font-medium border border-red-300 text-red-600 hover:bg-red-50">
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}
