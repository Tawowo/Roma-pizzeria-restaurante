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
  statut: 'libre' | 'occupee' | 'prete' | 'reservee' | StatutCmd
  commande?: CommandeActive
}

interface CommandeActive {
  id: string
  numero: string
  type: TypeCmd
  statut: StatutCmd
  total: number
  created_at: string
  table_numero?: number
  zone?: Zone
  nom_client?: string
  lignes?: LigneCmd[]
}

interface LigneCmd {
  id: string
  article_nom: string
  quantite: number
  taille?: string
  commentaire?: string
  statut?: LigneStatut
  prix_unitaire: number
  ajout_apres?: boolean
  created_at?: string
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

  // Modal nouvelle commande
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

  // Modal detail table occupée
  const [modalDetail, setModalDetail] = useState<CommandeActive | null>(null)
  // Modal encaissement
  const [modalEncaiss, setModalEncaiss] = useState<CommandeActive | null>(null)
  const [modePaiement, setModePaiement] = useState<ModePaiement>('cb')
  const [montantRecu, setMontantRecu] = useState('')

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

      const { data: tablesDB } = await supabase
        .from('tables_restaurant')
        .select('*')
        .eq('actif', true)
        .order('numero')

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
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
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
    setExistingCmdId(null)
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

  const envoyerEnCuisine = async () => {
    if (!nomClient.trim()) { setErrNom('Le nom est obligatoire'); return }
    if (panier.length === 0) return

    // Articles à envoyer maintenant (tous si aucune sélection spécifique)
    const indicesEnvoi = panierEnvoiSelectionne.size === 0
      ? panier.map((_, i) => i)
      : Array.from(panierEnvoiSelectionne)
    const panierEnvoi = panier.filter((_, i) => indicesEnvoi.includes(i))
    const panierAttente = panier.filter((_, i) => !indicesEnvoi.includes(i))

    if (panierEnvoi.length === 0) return

    setSaving(true)
    try {
      const total = calcTotal(panier, reduction)

      // Adding articles to existing commande
      if (existingCmdId) {
        await supabase.from('lignes_commande').insert(
          panierEnvoi.map(p => ({
            commande_id: existingCmdId,
            article_id: p.article.id,
            article_nom: p.article.nom,
            quantite: p.quantite,
            taille: p.taille || null,
            commentaire: p.commentaire || null,
            prix_unitaire: p.article.prix,
            statut: 'envoye_cuisine',
            ajout_apres: true
          }))
        )
        if (panierAttente.length > 0) {
          await supabase.from('lignes_commande').insert(
            panierAttente.map(p => ({
              commande_id: existingCmdId,
              article_id: p.article.id,
              article_nom: p.article.nom,
              quantite: p.quantite,
              taille: p.taille || null,
              commentaire: p.commentaire || null,
              prix_unitaire: p.article.prix,
              statut: 'en_attente',
              ajout_apres: true
            }))
          )
        }
        setModalTable(null)
        setExistingCmdId(null)
        setPanierEnvoiSelectionne(new Set())
        fetchTout()
        setSaving(false)
        return
      }

      const { data: cmd } = await supabase.from('commandes').insert([{
        type: 'sur_place',
        statut: 'en_preparation',
        nom_client: nomClient.trim(),
        telephone: telClient,
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
      }]).select().single()

      if (cmd) {
        const CATS_PAS_CUISINE = ['boissons', 'vins', 'vins blancs', 'vins rouges', 'vins rosés', 'pétillants', 'apéritifs', 'digestifs', 'boisson', 'vin', 'bières', 'softs', 'eaux']
        const makeLigne = (p: PanierItem, statut: string, ajout_apres: boolean) => {
          const cat = categories.find(c => c.id === p.article.categorie_id)
          const nomCat = cat?.nom?.toLowerCase() ?? ''
          const pourCuisine = !CATS_PAS_CUISINE.some(c => nomCat.includes(c))
          return {
            commande_id: cmd.id,
            article_id: p.article.id,
            article_nom: p.article.nom,
            quantite: p.quantite,
            taille: p.taille || null,
            commentaire: p.commentaire || null,
            prix_unitaire: p.article.prix,
            categorie_nom: cat?.nom || null,
            pour_cuisine: pourCuisine,
            statut,
            ajout_apres,
          }
        }
        if (panierEnvoi.length > 0) {
          await supabase.from('lignes_commande').insert(panierEnvoi.map(p => makeLigne(p, 'envoye_cuisine', false)))
        }
        if (panierAttente.length > 0) {
          await supabase.from('lignes_commande').insert(panierAttente.map(p => makeLigne(p, 'en_attente', true)))
        }
        // ✅ Mettre la table en occupée
        if (modalTable?.num) {
          await supabase
            .from('tables_restaurant')
            .update({ statut: 'occupee', commande_id: cmd.id })
            .eq('numero', modalTable.num)
            .eq('zone', modalTable.zone)
        }
      }

      setModalTable(null)
      setPanierEnvoiSelectionne(new Set())
      await fetchTout()
    } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  const sauvegarder = async () => {
    if (!nomClient.trim()) { setErrNom('Le nom est obligatoire'); return }
    if (panier.length === 0) return
    setSaving(true)
    try {
      const total = calcTotal(panier, reduction)
      const { data: cmd } = await supabase.from('commandes').insert([{
        type: 'sur_place', statut: 'en_attente', nom_client: nomClient.trim(), telephone: telClient,
        table_numero: modalTable?.num, zone: modalTable?.zone, couverts, total, client_id: clientFidele?.id || null,
      }]).select().single()
      if (cmd) {
        const CATS_PAS_CUISINE = ['boissons', 'vins', 'vins blancs', 'vins rouges', 'vins rosés', 'pétillants', 'apéritifs', 'digestifs', 'boisson', 'vin', 'bières', 'softs', 'eaux']
        await supabase.from('lignes_commande').insert(
          panier.map(p => {
            const cat = categories.find(c => c.id === p.article.categorie_id)
            const nomCat = cat?.nom?.toLowerCase() ?? ''
            return { commande_id: cmd.id, article_id: p.article.id, article_nom: p.article.nom, quantite: p.quantite, taille: p.taille || null, commentaire: p.commentaire || null, prix_unitaire: p.article.prix, categorie_nom: cat?.nom || null, pour_cuisine: !CATS_PAS_CUISINE.some(c => nomCat.includes(c)), statut: 'en_attente' }
          })
        )
        if (modalTable?.num) {
          await supabase
            .from('tables_restaurant')
            .update({ statut: 'occupee', commande_id: cmd.id })
            .eq('numero', modalTable.num)
            .eq('zone', modalTable.zone)
        }
      }
      setModalTable(null)
      await fetchTout()
    } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  const validerPaiement = async () => {
    if (!modalEncaiss) return
    setSaving(true)
    try {
      await supabase.from('commandes').update({ statut: 'payee', mode_paiement: modePaiement }).eq('id', modalEncaiss.id)
      // Libérer la table
      if (modalEncaiss.table_numero) {
        await supabase
          .from('tables_restaurant')
          .update({ statut: 'libre', commande_id: null })
          .eq('numero', modalEncaiss.table_numero)
      }
      if (clientFidele && modalEncaiss.total > 0) {
        const pts = Math.floor(modalEncaiss.total)
        await supabase.from('mouvements_fidelite').insert([{ client_id: clientFidele.id, points: pts, motif: `Commande #${modalEncaiss.numero}` }])
        await supabase.from('clients').update({ points: clientFidele.points + pts }).eq('id', clientFidele.id)
      }
      setModalEncaiss(null)
      fetchTout()
    } catch (err) { console.error(err) } finally { setSaving(false) }
  }

  const ajouterArticlesTable = (cmd: CommandeActive) => {
    const t = tables.find(tbl => tbl.num === cmd.table_numero)
    if (!t) return
    setModalDetail(null)
    setModalTable(t)
    setEtape(2)
    setNomClient(cmd.nom_client ?? '')
    setTelClient('')
    setCouverts(2)
    setClientFidele(null)
    setPanier([])
    setReduction({ pct: '', montant: '', codePromo: '', codePromoValeur: 0, codePromoMsg: '', bonFidelite: '', bonFideliteValeur: 0, bonFideliteMsg: '', offrir: false, offrirMotif: '' })
    setPanierEnvoiSelectionne(new Set())
    // Store the existing commande id to add lines to it
    setExistingCmdId(cmd.id)
  }

  const tablesByZone = tables.filter(t => t.zone === zone)
  const commandesEmporter = commandes.filter(c => c.type === 'a_emporter' && !['payee', 'annulee'].includes(c.statut))

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

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A1A1A] mb-6">Commandes</h1>

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

          {/* Grille tables */}
          <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-3 mb-8">
            {tablesByZone.map(t => (
              <div
                key={t.num}
                onClick={() => {
                  if (t.statut === 'libre') ouvrirModalNvCmd(t)
                  else if (t.commande) { setModalDetail(t.commande); setModePaiement('cb'); setMontantRecu('') }
                }}
                className={`rounded-xl p-4 flex flex-col items-center gap-1 border-2 transition-all ${tableCardClass(t.statut)}`}
              >
                <div className={`text-2xl font-bold ${t.statut === 'libre' ? 'text-green-700' : (t.statut === 'prete') ? 'text-orange-700' : 'text-red-700'}`}>T{t.num}</div>
                <div className={`text-xs font-medium ${t.statut === 'libre' ? 'text-green-600' : (t.statut === 'prete') ? 'text-orange-600' : 'text-red-600'}`}>
                  {t.statut === 'libre' ? '🟢 Libre' : t.statut === 'prete' ? '🟠 À encaisser' : t.statut === 'reservee' ? '🔵 Réservée' : '🔴 Occupée'}
                </div>
                {t.commande?.nom_client && <div className="text-xs text-gray-500 truncate w-full text-center">{t.commande.nom_client}</div>}
              </div>
            ))}
          </div>

          {/* Liste commandes sur place */}
          <div className="space-y-2">
            {commandes.filter(c => c.type === 'sur_place' && !['payee', 'annulee'].includes(c.statut)).map(cmd => (
              <CommandeRow key={cmd.id} cmd={cmd} onEncaisser={() => { setModalEncaiss(cmd); setModePaiement('cb'); setMontantRecu('') }} onUpdate={fetchTout} />
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {commandesEmporter.length === 0 ? <div className="text-[#555]">Aucune commande à emporter.</div> :
            commandesEmporter.map(cmd => (
              <CommandeRow key={cmd.id} cmd={cmd} onEncaisser={() => { setModalEncaiss(cmd); setModePaiement('cb'); setMontantRecu('') }} onUpdate={fetchTout} />
            ))}
        </div>
      )}

      {/* ===== MODAL NOUVELLE COMMANDE ===== */}
      {modalTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E0D5C5]">
              <h2 className="text-lg font-bold">Nouvelle commande — Table {modalTable.num}</h2>
              <div className="flex gap-2">
                {([1, 2, 3] as const).map(n => (
                  <span key={n} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${etape === n ? 'bg-[#B71C1C] text-white' : etape > n ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{n}</span>
                ))}
              </div>
              <button onClick={() => setModalTable(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

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
                    {/* Catégories */}
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
                      <button onClick={() => setEtape(1)} className="flex-1 border border-[#E0D5C5] text-[#555] py-2 rounded-lg text-sm">← Retour</button>
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
                    <div className="text-sm font-medium text-[#555]">Table {modalTable.num} · {couverts} couverts</div>
                    <div className="text-sm font-medium">{nomClient}</div>
                    {panier.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1">
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input type="checkbox"
                            checked={panierEnvoiSelectionne.has(i) || panierEnvoiSelectionne.size === 0}
                            onChange={(e) => {
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
                            className="rounded"
                          />
                          <span className="text-xs text-[#555]">Envoyer maintenant</span>
                          <span>{item.quantite}× {item.article.nom} {item.taille && `(${item.taille})`}</span>
                        </label>
                        <span className="font-medium">{(item.article.prix * item.quantite).toFixed(2)} €</span>
                      </div>
                    ))}
                    <div className="border-t border-[#E0D5C5] pt-2 mt-2">
                      {(parseFloat(reduction.pct) > 0 || parseFloat(reduction.montant) > 0 || reduction.codePromoValeur > 0 || reduction.bonFideliteValeur > 0) && (
                        <div className="text-xs text-green-700">Réductions appliquées</div>
                      )}
                      <div className="font-bold text-[#B71C1C] text-lg">Total TTC : {totalFinal.toFixed(2)} €</div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEtape(2)} className="flex-1 border border-[#E0D5C5] text-[#555] py-2 rounded-lg text-sm">← Retour</button>
                    <button onClick={sauvegarder} disabled={saving} className="flex-1 border border-[#1B5E20] text-[#1B5E20] py-2 rounded-lg text-sm font-medium">
                      💾 Sauvegarder
                    </button>
                  </div>
                  <button onClick={envoyerEnCuisine} disabled={saving}
                    className="w-full bg-[#B71C1C] hover:bg-[#C62828] text-white py-3 rounded-lg font-medium disabled:opacity-50">
                    {saving ? 'Envoi...' : `📤 Envoyer ${panierEnvoiSelectionne.size === 0 ? panier.length : panierEnvoiSelectionne.size} article(s) en cuisine`}
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
              <h2 className="text-lg font-bold">Table {modalDetail.table_numero} — {modalDetail.nom_client}</h2>
              <button onClick={() => setModalDetail(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Articles envoyés en cuisine */}
              {(modalDetail.lignes ?? []).filter(l => !l.statut || l.statut === 'envoye_cuisine' || l.statut === 'pret').length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-2">En cuisine / Prêts</h4>
                  <div className="space-y-1">
                    {(modalDetail.lignes ?? []).filter(l => !l.statut || l.statut === 'envoye_cuisine' || l.statut === 'pret').map(l => (
                      <div key={l.id} className="flex justify-between text-sm py-1 border-b border-[#F0EBE0]">
                        <span className={l.statut === 'pret' ? 'line-through text-gray-400' : ''}>
                          {l.quantite}× {l.article_nom}{l.taille ? ` (${l.taille})` : ''}
                          {l.commentaire && <span className="text-xs text-[#555] ml-1">— {l.commentaire}</span>}
                        </span>
                        <span className="ml-2">
                          {l.statut === 'pret' && <span className="text-green-600 text-xs font-medium">✓ Prêt</span>}
                          <span className="text-[#555] ml-2">{(l.prix_unitaire * l.quantite).toFixed(2)} €</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Articles en attente (pas encore envoyés) */}
              {(modalDetail.lignes ?? []).filter(l => l.statut === 'en_attente').length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-2">En attente d&apos;envoi</h4>
                  <div className="space-y-1">
                    {(modalDetail.lignes ?? []).filter(l => l.statut === 'en_attente').map(l => (
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
                {(modalDetail.statut === 'prete' || modalDetail.statut === 'en_preparation') && (
                  <button
                    onClick={() => { setModalEncaiss(modalDetail); setModalDetail(null); setModePaiement('cb'); setMontantRecu('') }}
                    className="flex-1 bg-[#B71C1C] hover:bg-[#C62828] text-white py-2 rounded-lg text-sm font-medium min-w-[140px]">
                    💳 Encaisser
                  </button>
                )}
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
              <h2 className="text-lg font-bold">Encaissement #{modalEncaiss.numero}</h2>
              <button onClick={() => setModalEncaiss(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-[#F0EBE0] rounded-xl p-4">
                {modalEncaiss.nom_client && <div className="font-medium mb-1">{modalEncaiss.nom_client}</div>}
                {modalEncaiss.lignes?.map(l => (
                  <div key={l.id} className="flex justify-between text-sm">
                    <span>{l.quantite}× {l.article_nom}</span>
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

              {clientFidele && (
                <div className="text-sm text-[#D4A843]">
                  Points gagnés : +{Math.floor(modalEncaiss.total ?? 0)} points
                </div>
              )}

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

function CommandeRow({ cmd, onEncaisser, onUpdate }: { cmd: CommandeActive; onEncaisser: () => void; onUpdate: () => void }) {
  const s = STATUT_LABELS[cmd.statut] ?? STATUT_LABELS.en_attente
  const updateStatut = async (statut: StatutCmd) => {
    try { await supabase.from('commandes').update({ statut }).eq('id', cmd.id); onUpdate() } catch { /* skip */ }
  }
  const NEXT_STATUT: Partial<Record<StatutCmd, { statut: StatutCmd; label: string }>> = {
    en_attente: { statut: 'en_preparation', label: '→ En cuisine' },
    en_preparation: { statut: 'prete', label: '→ Prête' },
  }
  const next = NEXT_STATUT[cmd.statut]
  return (
    <div className="w-full rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white border border-[#E0D5C5] shadow-sm">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <div className="text-xl font-bold text-[#D4A843]">#{cmd.numero}</div>
        {cmd.nom_client && <div className="text-sm font-medium text-[#1A1A1A]">{cmd.nom_client}</div>}
        {cmd.table_numero && <div className="text-sm text-[#555]">Table {cmd.table_numero}</div>}
        <div className="text-sm text-[#555]">{new Date(cmd.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.tw}`}>{s.label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="font-medium text-[#1A1A1A]">{cmd.total?.toFixed(2)} €</div>
        {next && (
          <button onClick={() => updateStatut(next.statut)}
            className="px-3 py-1 rounded text-xs font-medium bg-[#1B5E20]/10 text-[#1B5E20] border border-[#1B5E20]/20">
            {next.label}
          </button>
        )}
        {(cmd.statut === 'prete' || cmd.statut === 'en_preparation') && (
          <button onClick={onEncaisser}
            className="px-3 py-1 rounded text-xs font-medium bg-[#B71C1C] text-white">
            💳 Encaisser
          </button>
        )}
      </div>
    </div>
  )
}
