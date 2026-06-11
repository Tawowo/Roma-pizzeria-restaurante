'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type StatutCmd = 'en_attente' | 'en_preparation' | 'prete' | 'payee' | 'annulee'
type LigneStatut = 'en_attente' | 'envoye_cuisine' | 'pret' | 'servi'
type TypeCmd = 'sur_place' | 'a_emporter'
type Zone = 'rdc' | 'etage' | 'terrasse'
type Taille = '33cm' | 'Pala' | 'Calzone' | ''
type ModePaiement = 'especes' | 'cb' | 'cheque'

interface TableResto {
  id: string; numero: number; zone: Zone; capacite: number; actif: boolean; statut?: string; commande_id?: string
}
interface TableVirtuelle {
  num: number; zone: Zone; statut: 'libre' | 'occupee' | 'prete' | 'reservee' | StatutCmd; commande?: CommandeActive
}
interface CommandeActive {
  id: string; numero: string; type: TypeCmd; statut: StatutCmd; total: number; created_at: string
  table_numero?: number; zone?: Zone; nom_client?: string; telephone?: string
  couverts?: number; heure_retrait?: string; lignes?: LigneCmd[]
}
interface LigneCmd {
  id: string; article_id?: string; article_nom: string; quantite: number; taille?: string
  commentaire?: string; statut?: LigneStatut; prix_unitaire: number; ajout_apres?: boolean; created_at?: string
}
interface Article { id: string; nom: string; prix: number; categorie_id: string }
interface Categorie { id: string; nom: string }
interface ClientFidele { id: string; nom: string; points: number; telephone: string }
interface PanierItem { article: Article; quantite: number; taille: Taille; commentaire: string }
interface ReductionState {
  pct: string; montant: string; codePromo: string; codePromoValeur: number; codePromoMsg: string
  bonFidelite: string; bonFideliteValeur: number; bonFideliteMsg: string; offrir: boolean; offrirMotif: string
}

const ZONES: { key: Zone; label: string; icon: string }[] = [
  { key: 'rdc', label: 'RDC', icon: '🏠' },
  { key: 'etage', label: 'Étage', icon: '🏛' },
  { key: 'terrasse', label: 'Terrasse', icon: '🌿' },
]

const STATUT_LABELS: Record<StatutCmd, { label: string; tw: string }> = {
  en_attente: { label: 'Brouillon', tw: 'bg-gray-100 text-gray-600' },
  en_preparation: { label: 'En cuisine', tw: 'bg-blue-100 text-blue-800' },
  prete: { label: 'Prête', tw: 'bg-orange-100 text-orange-800' },
  payee: { label: 'Encaissée', tw: 'bg-gray-100 text-gray-500' },
  annulee: { label: 'Annulée', tw: 'bg-red-100 text-red-800' },
}

const CATS_PAS_CUISINE = ['boissons', 'vins', 'vins blancs', 'vins rouges', 'vins rosés', 'pétillants', 'apéritifs', 'digestifs', 'boisson', 'vin', 'bières', 'softs', 'eaux']

function estPourCuisine(p: PanierItem, categories: Categorie[]): boolean {
  const cat = categories.find(c => c.id === p.article.categorie_id)
  const nomCat = cat?.nom?.toLowerCase() ?? ''
  return !CATS_PAS_CUISINE.some(c => nomCat.includes(c))
}

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

const HORAIRES_RETRAIT: string[] = (() => {
  const slots: string[] = []
  const ranges = [[12, 0, 14, 30], [19, 0, 22, 30]] as [number,number,number,number][]
  for (const [hStart, mStart, hEnd, mEnd] of ranges) {
    let h = hStart, m = mStart
    while (h < hEnd || (h === hEnd && m <= mEnd)) {
      slots.push(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`)
      m += 15
      if (m >= 60) { m = 0; h++ }
    }
  }
  return slots
})()

const REDUCTION_VIDE: ReductionState = {
  pct: '', montant: '', codePromo: '', codePromoValeur: 0, codePromoMsg: '',
  bonFidelite: '', bonFideliteValeur: 0, bonFideliteMsg: '', offrir: false, offrirMotif: ''
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

  // Modal nouvelle commande (sur_place)
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
  const [reduction, setReduction] = useState<ReductionState>(REDUCTION_VIDE)
  const [saving, setSaving] = useState(false)
  const [errNom, setErrNom] = useState('')
  const [errSave, setErrSave] = useState('')
  const [panierEnvoiSelectionne, setPanierEnvoiSelectionne] = useState<Set<number>>(new Set())
  const [existingCmdId, setExistingCmdId] = useState<string | null>(null)

  // Modal table occupée — affiche TOUTES les commandes de la table
  const [modalDetailTableNum, setModalDetailTableNum] = useState<number | null>(null)
  const [annulationConfirmId, setAnnulationConfirmId] = useState<string | null>(null)

  // Modal encaissement
  const [modalEncaiss, setModalEncaiss] = useState<CommandeActive | null>(null)
  const [modePaiement, setModePaiement] = useState<ModePaiement>('cb')
  const [montantRecu, setMontantRecu] = useState('')

  // Modal à emporter
  const [modalEmporter, setModalEmporter] = useState(false)
  const [heureRetrait, setHeureRetrait] = useState(HORAIRES_RETRAIT[0] ?? '')

  const fetchTout = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: cmdData } = await supabase
        .from('commandes')
        .select('*, lignes_commande(*)')
        .gte('created_at', today + 'T00:00:00')
        .order('created_at', { ascending: false })
      const cmds: CommandeActive[] = (cmdData ?? []) as CommandeActive[]
      setCommandes(cmds)

      const { data: tablesDB } = await supabase.from('tables_restaurant').select('*').eq('actif', true).order('numero')
      console.log('tables DB:', tablesDB)

      if (tablesDB && tablesDB.length > 0) {
        const tv: TableVirtuelle[] = (tablesDB as TableResto[]).map(t => {
          const cmdActive = cmds.find(c => c.id === t.commande_id)
            ?? cmds.find(c => c.type === 'sur_place' && c.table_numero === t.numero && !['payee', 'annulee'].includes(c.statut))
          const statut = (t.statut ?? (cmdActive ? 'occupee' : 'libre')) as TableVirtuelle['statut']
          return { num: t.numero, zone: t.zone, statut: cmdActive ? statut : 'libre', commande: cmdActive }
        })
        setTables(tv)
      } else {
        const staticTables: TableVirtuelle[] = Array.from({ length: 12 }, (_, i) => {
          const num = i + 1
          const z: Zone = num <= 4 ? 'rdc' : num <= 8 ? 'etage' : 'terrasse'
          const cmdActive = cmds.find(c => c.type === 'sur_place' && c.table_numero === num && !['payee', 'annulee'].includes(c.statut))
          return { num, zone: z, statut: cmdActive ? 'occupee' : 'libre', commande: cmdActive }
        })
        setTables(staticTables)
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const s = getSession()
    if (!s) { router.replace('/login'); return }
    if (s.role === 'roberto') { router.replace('/cuisine'); return }
    fetchTout()
    loadArticles()
  }, [router, fetchTout])

  useEffect(() => {
    const ch = supabase.channel('commandes-rt2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, fetchTout)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchTout])

  const loadArticles = async () => {
    try {
      const [{ data: arts }, { data: cats }] = await Promise.all([
        supabase.from('articles').select('*').eq('disponible', true).order('nom'),
        supabase.from('categories').select('*').order('ordre'),
      ])
      setArticles((arts ?? []) as Article[])
      setCategories((cats ?? []) as Categorie[])
      if (cats && cats.length > 0) setCatActive(cats[0].id)
    } catch { /* skip */ }
  }

  const checkClientFidele = async () => {
    if (!telClient.trim()) return
    try {
      const { data } = await supabase.from('clients').select('id, nom, points, telephone').eq('telephone', telClient.trim()).single()
      if (data) setClientFidele(data as ClientFidele)
    } catch { setClientFidele(null) }
  }

  const resetModal = () => {
    setNomClient(''); setTelClient(''); setCouverts(2); setClientFidele(null)
    setPanier([]); setReduction(REDUCTION_VIDE); setErrNom(''); setErrSave('')
    setPanierEnvoiSelectionne(new Set()); setExistingCmdId(null)
  }

  const ouvrirModalNvCmd = (t: TableVirtuelle) => {
    resetModal(); setModalTable(t); setEtape(1)
  }

  const allerEtape3 = () => {
    if (panier.length === 0) return
    const sel = new Set<number>()
    panier.forEach((p, i) => { if (estPourCuisine(p, categories)) sel.add(i) })
    setPanierEnvoiSelectionne(sel)
    setEtape(3)
  }

  const ajouterAuPanier = (art: Article) => {
    setPanier(prev => {
      const isCatPizza = categories.find(c => c.id === art.categorie_id)?.nom?.toLowerCase().includes('pizza')
      const tailleDef: Taille = isCatPizza ? '33cm' : ''
      const idx = prev.findIndex(p => p.article.id === art.id && p.taille === tailleDef)
      if (idx >= 0) {
        const nv = [...prev]; nv[idx] = { ...nv[idx], quantite: nv[idx].quantite + 1 }; return nv
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

  const upsertTable = async (num: number, cmdId: string, zone?: Zone) => {
    const z: Zone = zone ?? (num <= 4 ? 'rdc' : num <= 8 ? 'etage' : 'terrasse')
    const { error: upsErr } = await supabase.from('tables_restaurant').upsert(
      { numero: num, zone: z, capacite: 4, actif: true, statut: 'occupee', commande_id: cmdId },
      { onConflict: 'numero,zone' }
    )
    console.log('[upsertTable] table', num, 'upsert error:', upsErr)
  }

  const makeLigneInsert = (p: PanierItem, cmdId: string, statut: string, ajout_apres: boolean) => {
    const cat = categories.find(c => c.id === p.article.categorie_id)
    return {
      commande_id: cmdId, article_id: p.article.id, article_nom: p.article.nom,
      quantite: p.quantite, taille: p.taille || null, commentaire: p.commentaire || null,
      prix_unitaire: p.article.prix, categorie_nom: cat?.nom || null,
      pour_cuisine: estPourCuisine(p, categories), statut, ajout_apres,
    }
  }

  const envoyerEnCuisine = async () => {
    if (!nomClient.trim()) { setErrNom('Le nom est obligatoire'); return }
    if (panier.length === 0) return
    const panierEnvoi = panier.filter((_, i) => panierEnvoiSelectionne.has(i))
    const panierAttente = panier.filter((_, i) => !panierEnvoiSelectionne.has(i))
    if (panierEnvoi.length === 0) { setErrSave('Sélectionnez au moins un article à envoyer en cuisine'); return }
    setSaving(true); setErrSave('')
    try {
      if (existingCmdId) {
        if (panierEnvoi.length > 0) {
          const { error: e1 } = await supabase.from('lignes_commande').insert(panierEnvoi.map(p => makeLigneInsert(p, existingCmdId, 'envoye_cuisine', true)))
          if (e1) throw new Error(`Ajout lignes: ${e1.message}`)
        }
        if (panierAttente.length > 0) {
          const { error: e2 } = await supabase.from('lignes_commande').insert(panierAttente.map(p => makeLigneInsert(p, existingCmdId, 'en_attente', true)))
          if (e2) throw new Error(`Ajout lignes attente: ${e2.message}`)
        }
        await supabase.from('commandes').update({ statut: 'en_preparation' }).eq('id', existingCmdId).eq('statut', 'en_attente')
        setModalTable(null); setExistingCmdId(null); await fetchTout(); setSaving(false); return
      }

      const total = calcTotal(panier, reduction)
      const { data: cmd, error: errCmd } = await supabase.from('commandes').insert([{
        type: 'sur_place', statut: 'en_preparation', nom_client: nomClient.trim(),
        telephone: telClient || null, table_numero: modalTable?.num ?? null,
        zone: modalTable?.zone ?? null, couverts, total,
        reduction_pct: parseFloat(reduction.pct) || 0, reduction_montant: parseFloat(reduction.montant) || 0,
        code_promo: reduction.codePromo || null, offert: reduction.offrir,
        offert_motif: reduction.offrirMotif || null, client_id: clientFidele?.id || null,
      }]).select().single()
      if (errCmd) throw new Error(`Création commande: ${errCmd.message}`)
      if (!cmd) throw new Error('Commande non créée (réponse vide)')

      if (panierEnvoi.length > 0) {
        const { error: el1 } = await supabase.from('lignes_commande').insert(panierEnvoi.map(p => makeLigneInsert(p, cmd.id, 'envoye_cuisine', false)))
        if (el1) throw new Error(`Insertion lignes cuisine: ${el1.message}`)
      }
      if (panierAttente.length > 0) {
        const { error: el2 } = await supabase.from('lignes_commande').insert(panierAttente.map(p => makeLigneInsert(p, cmd.id, 'en_attente', false)))
        if (el2) throw new Error(`Insertion lignes attente: ${el2.message}`)
      }
      if (modalTable?.num) await upsertTable(modalTable.num, cmd.id, modalTable.zone)
      setModalTable(null); await fetchTout()
    } catch (err) {
      console.error('envoyerEnCuisine error:', err)
      setErrSave(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  const sauvegarder = async () => {
    if (!nomClient.trim()) { setErrNom('Le nom est obligatoire'); return }
    if (panier.length === 0) return
    setSaving(true); setErrSave('')
    try {
      const total = calcTotal(panier, reduction)
      const { data: cmd, error: errCmd } = await supabase.from('commandes').insert([{
        type: 'sur_place', statut: 'en_attente', nom_client: nomClient.trim(),
        telephone: telClient || null, table_numero: modalTable?.num ?? null,
        zone: modalTable?.zone ?? null, couverts, total, client_id: clientFidele?.id || null,
      }]).select().single()
      if (errCmd) throw new Error(`Création commande: ${errCmd.message}`)
      if (!cmd) throw new Error('Commande non créée (réponse vide)')

      const { error: elErr } = await supabase.from('lignes_commande').insert(panier.map(p => makeLigneInsert(p, cmd.id, 'en_attente', false)))
      if (elErr) throw new Error(`Insertion lignes: ${elErr.message}`)
      if (modalTable?.num) await upsertTable(modalTable.num, cmd.id, modalTable.zone)
      setModalTable(null); await fetchTout()
    } catch (err) {
      console.error('sauvegarder error:', err)
      setErrSave(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  const envoyerEmporter = async () => {
    if (!nomClient.trim()) { setErrNom('Le nom est obligatoire'); return }
    if (panier.length === 0) { setErrSave('Panier vide'); return }
    if (!heureRetrait) { setErrSave('Choisissez une heure de retrait'); return }
    setSaving(true); setErrSave('')
    try {
      const total = calcTotal(panier, reduction)
      const { data: cmd, error: errCmd } = await supabase.from('commandes').insert([{
        type: 'a_emporter', statut: 'en_preparation', nom_client: nomClient.trim(),
        telephone: telClient || null, heure_retrait: heureRetrait, total,
        client_id: clientFidele?.id || null,
      }]).select().single()
      if (errCmd) throw new Error(`Création commande: ${errCmd.message}`)
      if (!cmd) throw new Error('Commande non créée')

      const lignes = panier.map(p => makeLigneInsert(p, cmd.id, estPourCuisine(p, categories) ? 'envoye_cuisine' : 'en_attente', false))
      const { error: elErr } = await supabase.from('lignes_commande').insert(lignes)
      if (elErr) throw new Error(`Insertion lignes: ${elErr.message}`)
      setModalEmporter(false); resetModal(); await fetchTout()
    } catch (err) {
      console.error('envoyerEmporter error:', err)
      setErrSave(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  const validerPaiement = async () => {
    if (!modalEncaiss) return
    setSaving(true)
    try {
      await supabase.from('commandes').update({ statut: 'payee', mode_paiement: modePaiement }).eq('id', modalEncaiss.id)
      if (modalEncaiss.table_numero) {
        await supabase.from('tables_restaurant').update({ statut: 'libre', commande_id: null }).eq('numero', modalEncaiss.table_numero)
      }
      if (clientFidele && modalEncaiss.total > 0) {
        const pts = Math.floor(modalEncaiss.total)
        await supabase.from('mouvements_fidelite').insert([{ client_id: clientFidele.id, points: pts, motif: `Commande #${modalEncaiss.numero}` }])
        await supabase.from('clients').update({ points: clientFidele.points + pts }).eq('id', clientFidele.id)
      }
      setModalEncaiss(null); fetchTout()
    } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  const ajouterArticlesTable = (cmd: CommandeActive) => {
    const t = tables.find(tbl => tbl.num === cmd.table_numero)
    if (!t) return
    setModalDetailTableNum(null); resetModal()
    setModalTable(t); setEtape(2); setNomClient(cmd.nom_client ?? '')
    setExistingCmdId(cmd.id)
  }

  const modifierCommande = (cmd: CommandeActive) => {
    console.log('modifier:', cmd.id, cmd.type)
    if (cmd.type === 'a_emporter') {
      resetModal()
      setNomClient(cmd.nom_client ?? ''); setTelClient(cmd.telephone ?? '')
      setHeureRetrait(cmd.heure_retrait ?? HORAIRES_RETRAIT[0] ?? '')
      const panierFromLines: PanierItem[] = (cmd.lignes ?? []).map(l => {
        const art = articles.find(a => a.id === l.article_id) ?? { id: l.article_id ?? '', nom: l.article_nom, prix: l.prix_unitaire, categorie_id: '' }
        return { article: art, quantite: l.quantite, taille: (l.taille ?? '') as Taille, commentaire: l.commentaire ?? '' }
      })
      setPanier(panierFromLines); setExistingCmdId(cmd.id); setModalEmporter(true)
      return
    }
    const t = tables.find(tbl => tbl.num === cmd.table_numero)
    if (!t) return
    setModalDetailTableNum(null); resetModal()
    const panierFromLines: PanierItem[] = (cmd.lignes ?? []).map(l => {
      const art = articles.find(a => a.id === l.article_id) ?? { id: l.article_id ?? '', nom: l.article_nom, prix: l.prix_unitaire, categorie_id: '' }
      return { article: art, quantite: l.quantite, taille: (l.taille ?? '') as Taille, commentaire: l.commentaire ?? '' }
    })
    setModalTable(t); setEtape(2); setNomClient(cmd.nom_client ?? '')
    setPanier(panierFromLines); setExistingCmdId(cmd.id)
  }

  const annulerCommande = async (cmd: CommandeActive) => {
    try {
      await supabase.from('commandes').update({ statut: 'annulee' }).eq('id', cmd.id)
      if (cmd.table_numero) {
        await supabase.from('tables_restaurant').update({ statut: 'libre', commande_id: null }).eq('numero', cmd.table_numero)
      }
      setModalDetailTableNum(null); setAnnulationConfirmId(null); await fetchTout()
    } catch (err) { console.error('annulerCommande error:', err) }
  }

  const tablesByZone = tables.filter(t => t.zone === zone)
  const commandesEmporter = commandes.filter(c => c.type === 'a_emporter' && !['payee', 'annulee'].includes(c.statut))
  const modalDetailCmds = modalDetailTableNum !== null
    ? commandes.filter(c => c.type === 'sur_place' && c.table_numero === modalDetailTableNum && !['payee', 'annulee'].includes(c.statut))
    : []

  const tableCardClass = (statut: string) => {
    if (statut === 'libre') return 'bg-green-50 border-green-400 hover:bg-green-100 cursor-pointer'
    if (statut === 'prete') return 'bg-orange-50 border-orange-400 cursor-pointer'
    if (statut === 'reservee') return 'bg-blue-50 border-blue-400 cursor-pointer'
    return 'bg-red-50 border-red-400 cursor-pointer'
  }

  const articlesFiltres = articles.filter(a =>
    (catActive ? a.categorie_id === catActive : true) &&
    (recherche ? a.nom.toLowerCase().includes(recherche.toLowerCase()) : true)
  )

  const sousTotal = panier.reduce((s, p) => s + p.article.prix * p.quantite, 0)
  const totalFinal = calcTotal(panier, reduction)

  // Shared article selection UI (step 2 / emporter)
  const ArticleSelectionUI = () => (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="flex-1">
        <input value={recherche} onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher un article..."
          className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none" />
        {categories.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => setCatActive('')}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${!catActive ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-[#555] border-[#E0D5C5]'}`}>
              Tout
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setCatActive(c.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${catActive === c.id ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-[#555] border-[#E0D5C5]'}`}>
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
        <div className="border-t border-[#E0D5C5] pt-3 space-y-2">
          <h5 className="text-xs font-semibold text-[#555] uppercase tracking-wider">Réductions</h5>
          <div className="flex gap-2">
            <input value={reduction.pct} onChange={e => setReduction(r => ({ ...r, pct: e.target.value }))}
              placeholder="% réduction" type="number" min="0" max="100" className="w-1/2 text-xs border border-[#E0D5C5] rounded px-2 py-1" />
            <input value={reduction.montant} onChange={e => setReduction(r => ({ ...r, montant: e.target.value }))}
              placeholder="€ réduction" type="number" min="0" className="w-1/2 text-xs border border-[#E0D5C5] rounded px-2 py-1" />
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
      </div>
    </div>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">Commandes</h1>

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
          <div className="flex gap-2 mb-5">
            {ZONES.map(z => (
              <button key={z.key} onClick={() => setZone(z.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-all ${zone === z.key ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-[#555] border-[#E0D5C5]'}`}>
                {z.icon} {z.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-3 mb-8">
            {tablesByZone.map(t => (
              <div key={t.num}
                onClick={() => {
                  if (t.statut === 'libre') ouvrirModalNvCmd(t)
                  else { setModalDetailTableNum(t.num); setModePaiement('cb'); setMontantRecu('') }
                }}
                className={`rounded-xl p-4 flex flex-col items-center gap-1 border-2 transition-all ${tableCardClass(t.statut)}`}>
                <div className={`text-2xl font-bold ${t.statut === 'libre' ? 'text-green-700' : t.statut === 'prete' ? 'text-orange-700' : 'text-red-700'}`}>T{t.num}</div>
                <div className={`text-xs font-medium ${t.statut === 'libre' ? 'text-green-600' : t.statut === 'prete' ? 'text-orange-600' : 'text-red-600'}`}>
                  {t.statut === 'libre' ? '🟢 Libre' : t.statut === 'prete' ? '🟠 À encaisser' : t.statut === 'reservee' ? '🔵 Réservée' : '🔴 Occupée'}
                </div>
                {t.commande?.nom_client && <div className="text-xs text-gray-500 truncate w-full text-center">{t.commande.nom_client}</div>}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {commandes.filter(c => c.type === 'sur_place' && !['payee', 'annulee'].includes(c.statut)).map(cmd => (
              <CommandeRow key={cmd.id} cmd={cmd}
                onEncaisser={() => { setModalEncaiss(cmd); setModePaiement('cb'); setMontantRecu('') }}
                onUpdate={fetchTout}
                onModifier={() => modifierCommande(cmd)} />
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end mb-3">
            <button onClick={() => { resetModal(); setModalEmporter(true) }}
              className="bg-[#B71C1C] hover:bg-[#C62828] text-white px-5 py-2 rounded-lg text-sm font-medium">
              + Nouvelle commande à emporter
            </button>
          </div>
          {commandesEmporter.length === 0 ? <div className="text-[#555]">Aucune commande à emporter.</div> :
            commandesEmporter.map(cmd => (
              <CommandeRow key={cmd.id} cmd={cmd}
                onEncaisser={() => { setModalEncaiss(cmd); setModePaiement('cb'); setMontantRecu('') }}
                onUpdate={fetchTout}
                onModifier={() => modifierCommande(cmd)} />
            ))}
        </div>
      )}

      {/* ===== MODAL NOUVELLE COMMANDE SUR PLACE ===== */}
      {modalTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0D5C5]">
              <h2 className="text-lg font-bold">{existingCmdId ? `Ajouter articles — Table ${modalTable.num}` : `Nouvelle commande — Table ${modalTable.num}`}</h2>
              <div className="flex gap-2">
                {!existingCmdId && ([1, 2, 3] as const).map(n => (
                  <span key={n} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${etape === n ? 'bg-[#B71C1C] text-white' : etape > n ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{n}</span>
                ))}
              </div>
              <button onClick={() => setModalTable(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            <div className="p-6">
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
                    <input value={telClient} onChange={e => setTelClient(e.target.value)} onBlur={checkClientFidele}
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

              {etape === 2 && (
                <div>
                  <ArticleSelectionUI />
                  <div className="flex gap-2 mt-4 max-w-72 ml-auto">
                    {!existingCmdId && <button onClick={() => setEtape(1)} className="flex-1 border border-[#E0D5C5] text-[#555] py-2 rounded-lg text-sm">← Retour</button>}
                    {existingCmdId ? (
                      <button onClick={envoyerEnCuisine} disabled={saving || panier.length === 0}
                        className="flex-1 bg-[#B71C1C] hover:bg-[#C62828] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40">
                        {saving ? 'Envoi...' : '📤 Envoyer en cuisine'}
                      </button>
                    ) : (
                      <button onClick={allerEtape3} disabled={panier.length === 0} className="flex-1 bg-[#1B5E20] text-white py-2 rounded-lg text-sm font-medium disabled:opacity-40">Suivant →</button>
                    )}
                  </div>
                  {errSave && <p className="text-red-600 text-sm mt-3">{errSave}</p>}
                </div>
              )}

              {etape === 3 && (
                <div className="max-w-md space-y-4">
                  <h3 className="font-semibold text-[#1A1A1A]">Validation — Choix cuisine</h3>
                  <div className="bg-[#F0EBE0] rounded-xl p-4 space-y-1">
                    <div className="text-sm font-medium text-[#555]">Table {modalTable.num} · {couverts} couverts</div>
                    <div className="text-sm font-medium">{nomClient}</div>
                    {panier.map((item, i) => {
                      const pourCuisine = estPourCuisine(item, categories)
                      const checked = panierEnvoiSelectionne.has(i)
                      return (
                        <div key={i} className={`flex items-center justify-between text-sm py-1 ${!pourCuisine ? 'opacity-50' : ''}`}>
                          <label className={`flex items-center gap-2 flex-1 ${pourCuisine ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                            <input type="checkbox" checked={checked} disabled={!pourCuisine}
                              onChange={e => {
                                setPanierEnvoiSelectionne(prev => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(i); else next.delete(i)
                                  return next
                                })
                              }} className="rounded" />
                            <span className="text-xs text-[#555]">{pourCuisine ? 'Envoyer en cuisine' : 'Boisson/vin'}</span>
                            <span>{item.quantite}× {item.article.nom} {item.taille && `(${item.taille})`}</span>
                          </label>
                          <span className="font-medium">{(item.article.prix * item.quantite).toFixed(2)} €</span>
                        </div>
                      )
                    })}
                    <div className="border-t border-[#E0D5C5] pt-2 mt-2">
                      <div className="font-bold text-[#B71C1C] text-lg">Total TTC : {totalFinal.toFixed(2)} €</div>
                    </div>
                  </div>
                  {errSave && (
                    <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-sm text-red-700">
                      <strong>Erreur :</strong> {errSave}
                      <div className="text-xs mt-1 text-red-500">⚠️ Des colonnes sont peut-être manquantes dans Supabase. Lancez les migrations SQL.</div>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setEtape(2)} className="flex-1 border border-[#E0D5C5] text-[#555] py-2 rounded-lg text-sm">← Retour</button>
                    <button onClick={sauvegarder} disabled={saving} className="flex-1 border border-[#1B5E20] text-[#1B5E20] py-2 rounded-lg text-sm font-medium">💾 Sauvegarder</button>
                  </div>
                  <button onClick={envoyerEnCuisine} disabled={saving}
                    className="w-full bg-[#B71C1C] hover:bg-[#C62828] text-white py-3 rounded-lg font-medium disabled:opacity-50">
                    {saving ? 'Envoi...' : `📤 Envoyer ${panierEnvoiSelectionne.size} article(s) en cuisine`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL TABLE OCCUPÉE — TOUTES LES COMMANDES ===== */}
      {modalDetailTableNum !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0D5C5]">
              <h2 className="text-lg font-bold">Table {modalDetailTableNum}</h2>
              <button onClick={() => { setModalDetailTableNum(null); setAnnulationConfirmId(null) }} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-6">
              {modalDetailCmds.length === 0 ? (
                <div className="text-[#555] text-sm">Aucune commande active sur cette table.</div>
              ) : modalDetailCmds.map(cmd => (
                <div key={cmd.id} className="border border-[#E0D5C5] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[#1A1A1A]">{cmd.nom_client}</span>
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${STATUT_LABELS[cmd.statut].tw}`}>{STATUT_LABELS[cmd.statut].label}</span>
                    </div>
                    <span className="text-sm font-bold text-[#B71C1C]">{cmd.total?.toFixed(2)} €</span>
                  </div>

                  {(cmd.lignes ?? []).filter(l => !l.statut || l.statut === 'envoye_cuisine' || l.statut === 'pret').length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-1">En cuisine / Prêts</div>
                      {(cmd.lignes ?? []).filter(l => !l.statut || l.statut === 'envoye_cuisine' || l.statut === 'pret').map(l => (
                        <div key={l.id} className="flex justify-between text-sm py-0.5">
                          <span className={l.statut === 'pret' ? 'line-through text-gray-400' : ''}>
                            {l.quantite}× {l.article_nom}{l.taille ? ` (${l.taille})` : ''}
                            {l.commentaire && <span className="text-xs text-[#555] ml-1">— {l.commentaire}</span>}
                          </span>
                          <span className="text-[#555] ml-2">{(l.prix_unitaire * l.quantite).toFixed(2)} €</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(cmd.lignes ?? []).filter(l => l.statut === 'en_attente').length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-1">En attente d&apos;envoi</div>
                      {(cmd.lignes ?? []).filter(l => l.statut === 'en_attente').map(l => (
                        <div key={l.id} className="flex justify-between text-sm py-0.5">
                          <span className="text-yellow-700">{l.quantite}× {l.article_nom}{l.taille ? ` (${l.taille})` : ''}</span>
                          <span className="text-[#555]">{(l.prix_unitaire * l.quantite).toFixed(2)} €</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {annulationConfirmId === cmd.id ? (
                    <div className="bg-red-50 border border-red-300 rounded-xl p-3 space-y-2">
                      <p className="text-sm font-semibold text-red-700">Confirmer l&apos;annulation ?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setAnnulationConfirmId(null)} className="flex-1 border border-[#E0D5C5] text-[#555] py-1.5 rounded-lg text-xs">Non</button>
                        <button onClick={() => annulerCommande(cmd)} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1.5 rounded-lg text-xs font-bold">Oui, annuler</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => ajouterArticlesTable(cmd)}
                        className="flex-1 bg-[#1B5E20] hover:bg-[#2E7D32] text-white py-2 rounded-lg text-xs font-medium min-w-[120px]">
                        + Ajouter
                      </button>
                      {!['payee', 'annulee'].includes(cmd.statut) && (
                        <button onClick={() => { setModalEncaiss(cmd); setModalDetailTableNum(null); setModePaiement('cb'); setMontantRecu('') }}
                          className="flex-1 bg-[#B71C1C] hover:bg-[#C62828] text-white py-2 rounded-lg text-xs font-medium min-w-[120px]">
                          💳 Encaisser
                        </button>
                      )}
                      <button onClick={() => setAnnulationConfirmId(cmd.id)}
                        className="w-full border border-red-400 text-red-600 hover:bg-red-50 py-1.5 rounded-lg text-xs font-medium">
                        🗑️ Annuler
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL COMMANDE À EMPORTER ===== */}
      {modalEmporter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0D5C5]">
              <h2 className="text-lg font-bold">🥡 Nouvelle commande à emporter</h2>
              <button onClick={() => { setModalEmporter(false); resetModal() }} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-[#555] mb-1">Nom / Prénom *</label>
                  <input value={nomClient} onChange={e => { setNomClient(e.target.value); setErrNom('') }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B5E20] ${errNom ? 'border-red-400' : 'border-[#E0D5C5]'}`}
                    placeholder="Ex: Dupont Jean" />
                  {errNom && <p className="text-red-600 text-xs mt-1">{errNom}</p>}
                </div>
                <div>
                  <label className="block text-sm text-[#555] mb-1">Téléphone</label>
                  <input value={telClient} onChange={e => setTelClient(e.target.value)} onBlur={checkClientFidele}
                    className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm focus:outline-none"
                    placeholder="06 XX XX XX XX" />
                </div>
                <div>
                  <label className="block text-sm text-[#555] mb-1">Heure de retrait *</label>
                  <select value={heureRetrait} onChange={e => setHeureRetrait(e.target.value)}
                    className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                    {HORAIRES_RETRAIT.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              {clientFidele && (
                <div className="text-sm text-green-700 bg-green-50 rounded px-3 py-1">
                  ✓ Bonjour <strong>{clientFidele.nom}</strong> — Client fidèle ({clientFidele.points} points)
                </div>
              )}
              <ArticleSelectionUI />
              {errSave && (
                <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-sm text-red-700">
                  <strong>Erreur :</strong> {errSave}
                </div>
              )}
              <button onClick={envoyerEmporter} disabled={saving || panier.length === 0}
                className="w-full bg-[#B71C1C] hover:bg-[#C62828] text-white py-3 rounded-lg font-bold disabled:opacity-50">
                {saving ? 'Envoi...' : `📤 Envoyer en cuisine — Retrait ${heureRetrait}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL ENCAISSEMENT ===== */}
      {modalEncaiss && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0D5C5]">
              <h2 className="text-lg font-bold">Encaissement #{modalEncaiss.numero}</h2>
              <button onClick={() => setModalEncaiss(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-[#F0EBE0] rounded-xl p-4">
                {modalEncaiss.nom_client && <div className="font-medium mb-1">{modalEncaiss.nom_client}</div>}
                {modalEncaiss.heure_retrait && <div className="text-sm text-[#555] mb-1">🕐 Retrait : {modalEncaiss.heure_retrait}</div>}
                {modalEncaiss.lignes?.map(l => (
                  <div key={l.id} className="flex justify-between text-sm">
                    <span>{l.quantite}× {l.article_nom}</span>
                    <span>{(l.prix_unitaire * l.quantite).toFixed(2)} €</span>
                  </div>
                ))}
                <div className="border-t border-[#E0D5C5] pt-2 mt-2 font-bold text-[#B71C1C]">Total : {modalEncaiss.total?.toFixed(2)} €</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#555] mb-2">Mode de paiement</label>
                <div className="flex gap-2">
                  {(['especes', 'cb', 'cheque'] as ModePaiement[]).map(m => (
                    <button key={m} onClick={() => setModePaiement(m)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${modePaiement === m ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-[#555] border-[#E0D5C5]'}`}>
                      {m === 'cb' ? 'CB' : m === 'especes' ? 'Espèces' : 'Chèque'}
                    </button>
                  ))}
                </div>
              </div>
              {modePaiement === 'especes' && (
                <div>
                  <label className="block text-sm text-[#555] mb-1">Montant reçu</label>
                  <input type="number" min="0" value={montantRecu} onChange={e => setMontantRecu(e.target.value)}
                    className="w-full border border-[#E0D5C5] rounded-lg px-3 py-2 text-sm" />
                  {parseFloat(montantRecu) >= (modalEncaiss.total ?? 0) && (
                    <div className="mt-1 text-green-700 font-bold text-sm">
                      Monnaie à rendre : {(parseFloat(montantRecu) - (modalEncaiss.total ?? 0)).toFixed(2)} €
                    </div>
                  )}
                </div>
              )}
              {clientFidele && <div className="text-sm text-[#D4A843]">Points gagnés : +{Math.floor(modalEncaiss.total ?? 0)} points</div>}
              <button onClick={validerPaiement} disabled={saving}
                className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white py-3 rounded-xl font-bold text-lg disabled:opacity-50">
                ✅ Valider le paiement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CommandeRow({ cmd, onEncaisser, onUpdate, onModifier }: {
  cmd: CommandeActive; onEncaisser: () => void; onUpdate: () => void; onModifier: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [suppConfirm, setSuppConfirm] = useState(false)
  const s = STATUT_LABELS[cmd.statut] ?? STATUT_LABELS.en_attente

  const updateStatut = async (statut: StatutCmd) => {
    try { await supabase.from('commandes').update({ statut }).eq('id', cmd.id); onUpdate() } catch { /* skip */ }
  }

  const supprimer = async () => {
    console.log('supprimer:', cmd.id)
    try {
      await supabase.from('lignes_commande').delete().eq('commande_id', cmd.id)
      await supabase.from('commandes').delete().eq('id', cmd.id)
      if (cmd.table_numero) {
        await supabase.from('tables_restaurant').update({ statut: 'libre', commande_id: null }).eq('numero', cmd.table_numero)
      }
      setSuppConfirm(false); setMenuOpen(false); onUpdate()
    } catch (err) { console.error('supprimer error:', err) }
  }

  const NEXT_STATUT: Partial<Record<StatutCmd, { statut: StatutCmd; label: string }>> = {
    en_attente: { statut: 'en_preparation', label: '→ En cuisine' },
    en_preparation: { statut: 'prete', label: '→ Prête' },
  }
  const next = NEXT_STATUT[cmd.statut]

  return (
    <div className="relative w-full rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white border border-[#E0D5C5] shadow-sm">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <div className="text-xl font-bold text-[#D4A843]">#{cmd.numero}</div>
        {cmd.nom_client && <div className="text-sm font-medium text-[#1A1A1A]">{cmd.nom_client}</div>}
        {cmd.table_numero && <div className="text-sm text-[#555]">Table {cmd.table_numero}</div>}
        {cmd.heure_retrait && <div className="text-sm text-[#555]">🕐 {cmd.heure_retrait}</div>}
        <div className="text-sm text-[#555]">{new Date(cmd.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.tw}`}>{s.label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="font-medium text-[#1A1A1A]">{cmd.total?.toFixed(2)} €</div>
        {next && (
          <button onClick={() => updateStatut(next.statut)}
            className="px-3 py-1 rounded text-xs font-medium bg-[#1B5E20]/10 text-[#1B5E20] border border-[#1B5E20]/20">
            {next.label}
          </button>
        )}
        {!['payee', 'annulee'].includes(cmd.statut) && (
          <button onClick={onEncaisser} className="px-3 py-1 rounded text-xs font-medium bg-[#B71C1C] text-white">
            💳 Encaisser
          </button>
        )}
        {/* ⋮ Menu */}
        <div className="relative">
          <button onClick={() => { setMenuOpen(m => !m); setSuppConfirm(false) }}
            className="px-2 py-1 rounded text-xs font-bold text-[#555] border border-[#E0D5C5] hover:bg-[#F0EBE0]">⋮</button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 bg-white border border-[#E0D5C5] rounded-xl shadow-lg min-w-[160px] overflow-hidden">
              <button onClick={() => { setMenuOpen(false); onModifier() }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-[#F0EBE0] text-[#1A1A1A]">
                ✏️ Modifier
              </button>
              {!suppConfirm ? (
                <button onClick={() => setSuppConfirm(true)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600">
                  🗑️ Supprimer
                </button>
              ) : (
                <div className="px-4 py-2 space-y-2">
                  <p className="text-xs text-red-700 font-semibold">Confirmer la suppression ?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setSuppConfirm(false)} className="flex-1 text-xs border border-[#E0D5C5] rounded py-1">Non</button>
                    <button onClick={supprimer} className="flex-1 text-xs bg-red-600 text-white rounded py-1 font-bold">Oui</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
