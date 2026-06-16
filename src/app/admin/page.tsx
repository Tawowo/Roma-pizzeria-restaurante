'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase, Article, Categorie, PlatDuJour, Formule, Reservation, Commande, LigneCommande } from '@/lib/supabase'

type Profile = 'monica' | 'andrei' | 'roberto'
type Tab = 'dashboard'|'reservations'|'commandes'|'menu'|'plats'|'formules'|'finances'|'parametres'|'cuisine'

const PROFILE_TABS: Record<Profile, Tab[]> = {
  monica: ['dashboard','reservations','commandes','menu','plats','formules','finances','parametres'],
  andrei: ['reservations','commandes','menu','plats','formules'],
  roberto: ['cuisine'],
}
const PROFILE_LABELS: Record<Profile, string> = {
  monica: '🌟 Monica — Gérance',
  andrei: '🍽 Andrei — Service',
  roberto: '🔥 Roberto — Cuisine',
}
const PASSWORDS: Record<Profile, string> = {
  monica: 'roma2024', andrei: 'andrei123', roberto: 'cuisine456',
}

export default function AdminPage() {
  const [auth, setAuth] = useState(false)
  const [profile, setProfile] = useState<Profile>('monica')
  const [pwd, setPwd] = useState('')
  const [pwdErr, setPwdErr] = useState(false)
  const [tab, setTab] = useState<Tab>('dashboard')

  // Data
  const [categories, setCategories] = useState<Categorie[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [plats, setPlats] = useState<PlatDuJour[]>([])
  const [formules, setFormules] = useState<Formule[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [commandes, setCommandes] = useState<(Commande & { lignes: LigneCommande[] })[]>([])
  const [catFilter, setCatFilter] = useState('')

  // Forms
  const [newPlatNom, setNewPlatNom] = useState(''); const [newPlatDesc, setNewPlatDesc] = useState(''); const [newPlatPrix, setNewPlatPrix] = useState('')
  const [newFormNom, setNewFormNom] = useState(''); const [newFormDesc, setNewFormDesc] = useState(''); const [newFormPrix, setNewFormPrix] = useState(''); const [newFormContenu, setNewFormContenu] = useState('')
  const [newCatNom, setNewCatNom] = useState('')
  const [newArtNom, setNewArtNom] = useState(''); const [newArtDesc, setNewArtDesc] = useState(''); const [newArtPrix, setNewArtPrix] = useState(''); const [newArtPala, setNewArtPala] = useState(''); const [newArtCat, setNewArtCat] = useState('')
  const [editArt, setEditArt] = useState<Article | null>(null)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [cmdNom, setCmdNom] = useState(''); const [cmdTel, setCmdTel] = useState(''); const [cmdHeure, setCmdHeure] = useState(''); const [cmdNote, setCmdNote] = useState('')
  const [cmdLignes, setCmdLignes] = useState<{ article: Article; quantite: number; taille: string; commentaire: string }[]>([])
  const [msgClient, setMsgClient] = useState<{tel:string,msg:string}|null>(null)
  const [editResa, setEditResa] = useState<Reservation|null>(null)

  const load = useCallback(async () => {
    const [c, a, p, f, r, cmd] = await Promise.all([
      supabase.from('categories').select('*').order('ordre'),
      supabase.from('articles').select('*').order('ordre'),
      supabase.from('plats_du_jour').select('*').order('created_at', { ascending: false }),
      supabase.from('formules').select('*').order('ordre'),
      supabase.from('reservations').select('*').gte('date_reservation', filterDate).order('date_reservation').order('heure_reservation'),
      supabase.from('commandes').select('*, lignes:lignes_commande(*)').gte('date_retrait', filterDate).order('created_at', { ascending: false }),
    ])
    if (c.data) { setCategories(c.data); if (!catFilter && c.data[0]) setCatFilter(c.data[0].id) }
    if (a.data) setArticles(a.data)
    if (p.data) setPlats(p.data)
    if (f.data) setFormules(f.data)
    if (r.data) setReservations(r.data)
    if (cmd.data) setCommandes(cmd.data as any)
  }, [filterDate, catFilter])

  useEffect(() => { if (auth) load() }, [auth, tab, filterDate, load])

  // Realtime
  useEffect(() => {
    if (!auth) return
    const channel = supabase.channel('admin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [auth, load])

  const login = async () => {
    // Check from DB
    const { data } = await supabase.from('parametres').select('valeur').eq('cle', `mdp_${profile}`).single()
    const dbPwd = data?.valeur || PASSWORDS[profile]
    if (pwd === dbPwd) { setAuth(true); setTab(PROFILE_TABS[profile][0]); setPwdErr(false) }
    else { setPwdErr(true) }
  }

  // Article CRUD
  const saveArticle = async () => {
    if (editArt) {
      await supabase.from('articles').update({ nom: editArt.nom, description: editArt.description, prix: editArt.prix, prix_pala: editArt.prix_pala, prix_reduction: editArt.prix_reduction }).eq('id', editArt.id)
      setEditArt(null)
    } else {
      if (!newArtNom || !newArtPrix || !newArtCat) return
      await supabase.from('articles').insert({ nom: newArtNom, description: newArtDesc, prix: parseFloat(newArtPrix), prix_pala: newArtPala ? parseFloat(newArtPala) : null, categorie_id: newArtCat, disponible: true })
      setNewArtNom(''); setNewArtDesc(''); setNewArtPrix(''); setNewArtPala(''); setNewArtCat('')
    }
    load()
  }
  const deleteArticle = async (id: string) => { if (confirm('Supprimer cet article ?')) { await supabase.from('articles').delete().eq('id', id); load() } }
  const toggleArt = async (id: string, val: boolean) => { await supabase.from('articles').update({ disponible: !val }).eq('id', id); load() }
  const setPromo = async (id: string, prix: string) => { await supabase.from('articles').update({ prix_reduction: prix ? parseFloat(prix) : null }).eq('id', id); load() }

  // Catégorie CRUD
  const addCat = async () => { if (!newCatNom) return; await supabase.from('categories').insert({ nom: newCatNom, ordre: categories.length + 1, actif: true }); setNewCatNom(''); load() }
  const deleteCat = async (id: string) => { if (confirm('Supprimer cette catégorie et tous ses articles ?')) { await supabase.from('categories').delete().eq('id', id); load() } }
  const toggleCat = async (id: string, val: boolean) => { await supabase.from('categories').update({ actif: !val }).eq('id', id); load() }

  // Plat du jour
  const addPlat = async () => {
    if (!newPlatNom) return
    await supabase.from('plats_du_jour').insert({ nom: newPlatNom, description: newPlatDesc || null, prix: newPlatPrix ? parseFloat(newPlatPrix) : null, actif: true })
    setNewPlatNom(''); setNewPlatDesc(''); setNewPlatPrix(''); load()
  }
  const togglePlat = async (id: string, val: boolean) => { await supabase.from('plats_du_jour').update({ actif: !val }).eq('id', id); load() }
  const deletePlat = async (id: string) => { if (confirm('Supprimer ce plat ?')) { await supabase.from('plats_du_jour').delete().eq('id', id); load() } }

  // Formules
  const addFormule = async () => {
    if (!newFormNom || !newFormPrix) return
    await supabase.from('formules').insert({ nom: newFormNom, description: newFormDesc || null, contenu: newFormContenu || null, prix: parseFloat(newFormPrix), actif: true })
    setNewFormNom(''); setNewFormDesc(''); setNewFormPrix(''); setNewFormContenu(''); load()
  }
  const deleteFormule = async (id: string) => { if (confirm('Supprimer cette formule ?')) { await supabase.from('formules').delete().eq('id', id); load() } }
  const toggleFormule = async (id: string, val: boolean) => { await supabase.from('formules').update({ actif: !val }).eq('id', id); load() }

  // Réservations
  const updateResa = async (id: string, fields: Partial<Reservation>) => { await supabase.from('reservations').update(fields).eq('id', id); load() }
  const deleteResa = async (id: string) => { if (confirm('Supprimer cette réservation ?')) { await supabase.from('reservations').delete().eq('id', id); load() } }

  // Commandes admin (Andrei)
  const addLigneCmd = (article: Article) => {
    setCmdLignes(l => [...l, { article, quantite: 1, taille: 'normal', commentaire: '' }])
  }
  const updateLigne = (i: number, field: string, val: any) => {
    setCmdLignes(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: val } : ln))
  }
  const removeLigne = (i: number) => { setCmdLignes(l => l.filter((_, idx) => idx !== i)) }
  const submitCmdAdmin = async () => {
    if (!cmdNom || !cmdTel || !cmdHeure || cmdLignes.length === 0) return
    const total = cmdLignes.reduce((s, l) => s + (l.taille === 'pala' ? (l.article.prix_pala || l.article.prix) : l.article.prix) * l.quantite, 0)
    const { data: cmd } = await supabase.from('commandes').insert({ 'Nom': cmdNom, 'Téléphone': cmdTel, heure_retrait: cmdHeure, date_retrait: filterDate, 'Statut': 'en_attente', notes: cmdNote || null, total }).select().single()
    if (!cmd) return
    await supabase.from('lignes_commande').insert(cmdLignes.map(l => ({ commande_id: cmd.id, article_id: l.article.id, article_nom: l.article.nom, quantite: l.quantite, taille: l.taille, prix_unitaire: l.taille === 'pala' ? (l.article.prix_pala || l.article.prix) : l.article.prix, commentaire: l.commentaire || null })))
    setCmdNom(''); setCmdTel(''); setCmdHeure(''); setCmdNote(''); setCmdLignes([])
    load()
  }
  const updateCmdStatut = async (id: string, statut: string) => { await supabase.from('commandes').update({ 'Statut': statut }).eq('id', id); load() }
  const deleteCmd = async (id: string) => { if (confirm('Annuler cette commande ?')) { await supabase.from('commandes').update({ 'Statut': 'annulee' }).eq('id', id); load() } }

  if (!auth) return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 8, padding: '44px 40px', width: 'min(400px,90vw)', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, color: 'var(--r)', fontStyle: 'italic', marginBottom: 6 }}>Roma</div>
        <div style={{ fontSize: 9, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--textl)', marginBottom: 28 }}>Espace Administration</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {(['monica','andrei','roberto'] as Profile[]).map(p => (
            <div key={p} onClick={() => setProfile(p)} style={{ padding: '14px 18px', border: `2px solid ${profile === p ? 'var(--r)' : 'rgba(196,30,58,0.15)'}`, borderRadius: 6, cursor: 'pointer', textAlign: 'left', background: profile === p ? 'rgba(196,30,58,0.04)' : 'white', transition: 'all 0.2s' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--dark)' }}>{PROFILE_LABELS[p]}</div>
              <div style={{ fontSize: 11, color: 'var(--textl)', marginTop: 2 }}>
                {p === 'monica' ? 'Accès complet' : p === 'andrei' ? 'Réservations & commandes' : 'Écran cuisine'}
              </div>
            </div>
          ))}
        </div>
        {pwdErr && <div style={{ color: 'var(--r)', fontSize: 12, marginBottom: 8 }}>Mot de passe incorrect</div>}
        <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="Mot de passe" className="rf-input" style={{ marginBottom: 12 }} />
        <button onClick={login} className="btn-submit">Connexion</button>
        <Link href="/" style={{ display: 'block', marginTop: 16, fontSize: 12, color: 'var(--textl)', textDecoration: 'none' }}>← Retour au site</Link>
      </div>
    </div>
  )

  const AP = {
    nav: (
      <div style={{ background: 'var(--dark2)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'white', fontStyle: 'italic' }}>Roma Admin</div>
        <div style={{ fontSize: 11, color: 'var(--gold2)', letterSpacing: 2, textTransform: 'uppercase' }}>{PROFILE_LABELS[profile]}</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 11 }}>← Site</Link>
          <button onClick={() => setAuth(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)', padding: '6px 14px', borderRadius: 2, cursor: 'pointer', fontSize: 11, fontFamily: 'Jost,sans-serif' }}>Déconnexion</button>
        </div>
      </div>
    ),
    tabs: (
      <div style={{ background: 'rgba(0,0,0,0.2)', display: 'flex', overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 24px' }}>
        {PROFILE_TABS[profile].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: 'none', border: 'none', color: tab === t ? 'var(--gold2)' : 'rgba(255,255,255,0.4)', padding: '14px 18px', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Jost,sans-serif', borderBottom: `2px solid ${tab === t ? 'var(--gold2)' : 'transparent'}`, marginBottom: -1, whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
            {t === 'dashboard' ? '📊 Tableau de bord' : t === 'reservations' ? '📅 Réservations' : t === 'commandes' ? '🛍 Commandes' : t === 'menu' ? '🍕 Menu' : t === 'plats' ? '⭐ Plats du jour' : t === 'formules' ? '🎁 Formules' : t === 'finances' ? '💶 Finances' : t === 'parametres' ? '⚙️ Paramètres' : '🔥 Cuisine'}
          </button>
        ))}
      </div>
    ),
    card: (children: React.ReactNode, style?: any) => (
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 24, ...style }}>{children}</div>
    ),
  }

  const renderTab = () => {
    if (tab === 'dashboard') return (
      <div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'white', marginBottom: 20 }}>Vue d'ensemble</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { n: reservations.filter(r => r.statut === 'en_attente').length, l: 'Réservations en attente', c: 'var(--gold2)' },
            { n: commandes.filter(c => c.statut === 'en_attente').length, l: 'Commandes en attente', c: 'var(--r)' },
            { n: commandes.filter(c => ['en_attente','en_preparation'].includes(c.statut)).reduce((s, c) => s + c.total, 0).toFixed(2) + ' €', l: 'CA en cours', c: 'var(--g3)' },
            { n: plats.filter(p => p.actif).length, l: 'Plats du jour actifs', c: 'white' },
          ].map((stat, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 20, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, color: stat.c }}>{stat.n}</div>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{stat.l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {AP.card(<>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Dernières réservations</div>
            {reservations.slice(0, 4).map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                <span style={{ color: 'white' }}>{r.nom}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{r.heure_reservation?.slice(0,5)} · {r.nombre_couverts}p</span>
              </div>
            ))}
          </>)}
          {AP.card(<>
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Dernières commandes</div>
            {commandes.slice(0, 4).map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                <span style={{ color: 'white' }}>#{c.numero_commande} {c.nom}</span>
                <span style={{ color: c.statut === 'en_attente' ? 'var(--gold2)' : 'var(--g3)' }}>{c.statut}</span>
              </div>
            ))}
          </>)}
        </div>
      </div>
    )

    if (tab === 'reservations') return (
      <div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'white', marginBottom: 16 }}>Réservations</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="ap-input" style={{ width: 180 }} />
          <button onClick={() => setFilterDate(new Date().toISOString().split('T')[0])} className="btn-y">Aujourd'hui</button>
        </div>

        {/* Ajouter réservation manuelle */}
        {AP.card(<>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Ajouter une réservation</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input className="ap-input" placeholder="Nom *" value="" onChange={() => {}} />
            <input className="ap-input" placeholder="Téléphone *" type="tel" />
            <input className="ap-input" type="date" defaultValue={filterDate} />
            <input className="ap-input" placeholder="Heure (19:30)" />
            <input className="ap-input" placeholder="Nb personnes" type="number" min={1} />
            <select className="ap-select"><option>Indifférent</option><option>RDC</option><option>Étage</option><option>Terrasse</option></select>
          </div>
          <textarea className="ap-textarea" placeholder="Notes..." style={{ marginTop: 10 }} />
          <button className="btn-g" style={{ width: '100%', padding: 12, marginTop: 8 }}>Ajouter la réservation</button>
        </>)}

        {/* Liste */}
        <div style={{ marginTop: 20 }}>
          {reservations.length === 0 && <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 40, fontStyle: 'italic' }}>Aucune réservation</div>}
          {reservations.map(r => (
            <div key={r.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '16px 20px', marginBottom: 10 }}>
              {editResa?.id === r.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <input className="ap-input" value={editResa.nom} onChange={e => setEditResa({ ...editResa, nom: e.target.value })} />
                    <input className="ap-input" value={editResa.telephone} onChange={e => setEditResa({ ...editResa, telephone: e.target.value })} />
                    <input className="ap-input" type="date" value={editResa.date_reservation} onChange={e => setEditResa({ ...editResa, date_reservation: e.target.value })} />
                    <input className="ap-input" value={editResa.heure_reservation} onChange={e => setEditResa({ ...editResa, heure_reservation: e.target.value })} />
                    <input className="ap-input" type="number" value={editResa.nombre_couverts} onChange={e => setEditResa({ ...editResa, nombre_couverts: Number(e.target.value) })} />
                  </div>
                  <textarea className="ap-textarea" value={editResa.notes || ''} onChange={e => setEditResa({ ...editResa, notes: e.target.value })} placeholder="Notes..." />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-g" onClick={() => { updateResa(r.id, editResa); setEditResa(null) }}>Sauvegarder</button>
                    <button className="btn-y" onClick={() => setEditResa(null)}>Annuler</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'white' }}>{r.nom}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                      {r.date_reservation} à {r.heure_reservation?.slice(0,5)} · {r.nombre_couverts} pers. · {r.zone}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>📞 {r.telephone}</div>
                    {r.notes && <div style={{ fontSize: 12, color: 'var(--gold2)', marginTop: 4 }}>📝 {r.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 100, fontWeight: 600, background: r.statut === 'confirmee' ? 'rgba(45,122,58,0.2)' : 'rgba(212,168,67,0.15)', color: r.statut === 'confirmee' ? 'var(--g3)' : 'var(--gold2)' }}>{r.statut}</span>
                    <button className="btn-g" style={{ padding: '5px 12px' }} onClick={() => updateResa(r.id, { statut: 'confirmee' })}>✓ Confirmer</button>
                    <button className="btn-y" style={{ padding: '5px 12px' }} onClick={() => setEditResa(r)}>✏ Modifier</button>
                    <button className="btn-y" style={{ padding: '5px 12px' }} onClick={() => setMsgClient({ tel: r.telephone, msg: `Bonjour ${r.nom}, votre réservation le ${r.date_reservation} à ${r.heure_reservation?.slice(0,5)} est confirmée. Roma Pizzeria 06 68 36 62 98` })}>📱 SMS</button>
                    <button className="btn-r" style={{ padding: '5px 12px' }} onClick={() => deleteResa(r.id)}>✕</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )

    if (tab === 'commandes') return (
      <div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'white', marginBottom: 16 }}>Commandes à emporter</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="ap-input" style={{ width: 180 }} />
          <button onClick={() => setFilterDate(new Date().toISOString().split('T')[0])} className="btn-y">Aujourd'hui</button>
        </div>

        {/* Nouvelle commande Andrei */}
        {AP.card(<>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Nouvelle commande</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <input className="ap-input" placeholder="Nom client *" value={cmdNom} onChange={e => setCmdNom(e.target.value)} />
            <input className="ap-input" placeholder="Téléphone *" value={cmdTel} onChange={e => setCmdTel(e.target.value)} type="tel" />
            <input className="ap-input" placeholder="Heure retrait (19:30)" value={cmdHeure} onChange={e => setCmdHeure(e.target.value)} />
          </div>

          {/* Sélection articles */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Ajouter des articles :</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setCatFilter(cat.id)} style={{ padding: '4px 12px', borderRadius: 100, fontSize: 10, background: catFilter === cat.id ? 'var(--r)' : 'rgba(255,255,255,0.07)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Jost,sans-serif' }}>{cat.nom}</button>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {articles.filter(a => a.categorie_id === catFilter && a.disponible).map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: 4 }}>
                  <div>
                    <span style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{a.nom}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 8 }}>{a.prix.toFixed(2)} €{a.prix_pala ? ` / Pala ${a.prix_pala.toFixed(2)} €` : ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => addLigneCmd(a)} className="btn-g" style={{ padding: '4px 12px', fontSize: 11 }}>+ 33cm</button>
                    {a.prix_pala && <button onClick={() => { addLigneCmd(a); setCmdLignes(l => l.map((ln, i) => i === l.length - 1 ? { ...ln, taille: 'pala' } : ln)) }} className="btn-y" style={{ padding: '4px 12px', fontSize: 11 }}>+ Pala</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Lignes panier admin */}
          {cmdLignes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Commande :</div>
              {cmdLignes.map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'white', fontSize: 13 }}>{l.quantite}× {l.article.nom}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>{l.taille === 'pala' ? 'Pala' : '33cm'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => updateLigne(i, 'quantite', Math.max(1, l.quantite - 1))} className="btn-r" style={{ padding: '2px 8px', fontSize: 14 }}>−</button>
                    <span style={{ color: 'white', minWidth: 20, textAlign: 'center' }}>{l.quantite}</span>
                    <button onClick={() => updateLigne(i, 'quantite', l.quantite + 1)} className="btn-g" style={{ padding: '2px 8px', fontSize: 14 }}>+</button>
                    <input value={l.commentaire} onChange={e => updateLigne(i, 'commentaire', e.target.value)} placeholder="Commentaire..." style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '4px 8px', color: 'white', fontSize: 11, fontFamily: 'Jost,sans-serif', width: 140 }} />
                    <button onClick={() => removeLigne(i)} className="btn-r" style={{ padding: '2px 8px' }}>✕</button>
                  </div>
                </div>
              ))}
              <div style={{ color: 'var(--gold2)', fontSize: 14, fontWeight: 700, marginTop: 8 }}>
                Total : {cmdLignes.reduce((s, l) => s + (l.taille === 'pala' ? (l.article.prix_pala || l.article.prix) : l.article.prix) * l.quantite, 0).toFixed(2)} €
              </div>
            </div>
          )}

          <textarea className="ap-textarea" placeholder="Notes générales..." value={cmdNote} onChange={e => setCmdNote(e.target.value)} />
          <button className="btn-g" style={{ width: '100%', padding: 12, marginTop: 8 }} onClick={submitCmdAdmin} disabled={cmdLignes.length === 0}>Enregistrer la commande</button>
        </>)}

        {/* Liste commandes */}
        <div style={{ marginTop: 24 }}>
          {commandes.map(c => (
            <div key={c.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${c.statut === 'prete' ? 'var(--g3)' : c.statut === 'en_attente' ? 'var(--gold2)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 6, padding: '16px 20px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: 'var(--gold2)' }}>#{c.numero_commande}</span>
                    <span style={{ fontWeight: 600, color: 'white' }}>{c.nom}</span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: c.statut === 'prete' ? 'rgba(45,122,58,0.2)' : c.statut === 'en_attente' ? 'rgba(212,168,67,0.15)' : 'rgba(255,255,255,0.07)', color: c.statut === 'prete' ? 'var(--g3)' : c.statut === 'en_attente' ? 'var(--gold2)' : 'white' }}>{c.statut}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>📞 {c.telephone} · ⏰ {c.heure_retrait?.slice(0,5)} · 💶 {c.total.toFixed(2)} €</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                    {c.lignes?.map((l, i) => <span key={i}>{l.quantite}× {l.article_nom}{l.taille === 'pala' ? ' (Pala)' : ''}{l.commentaire ? ` [${l.commentaire}]` : ''}{i < (c.lignes?.length || 0) - 1 ? ' · ' : ''}</span>)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {c.statut === 'en_attente' && <button className="btn-y" style={{ padding: '5px 12px' }} onClick={() => updateCmdStatut(c.id, 'en_preparation')}>▶ Démarrer</button>}
                  {c.statut === 'en_preparation' && <button className="btn-g" style={{ padding: '5px 12px' }} onClick={() => updateCmdStatut(c.id, 'prete')}>✓ Prête</button>}
                  {c.statut === 'prete' && <button className="btn-g" style={{ padding: '5px 12px' }} onClick={() => updateCmdStatut(c.id, 'servie')}>✓ Récupérée</button>}
                  <button className="btn-y" style={{ padding: '5px 12px' }} onClick={() => setMsgClient({ tel: c.telephone, msg: `Bonjour ${c.nom}, votre commande N°${c.numero_commande} est prête ! Roma Pizzeria 06 68 36 62 98` })}>📱 SMS</button>
                  <button className="btn-r" style={{ padding: '5px 12px' }} onClick={() => deleteCmd(c.id)}>✕ Annuler</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )

    if (tab === 'cuisine') return (
      <div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'white', marginBottom: 20 }}>Écran Cuisine</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {commandes.filter(c => ['en_attente','en_preparation'].includes(c.statut)).map(c => (
            <div key={c.id} style={{ background: 'rgba(255,255,255,0.05)', border: `2px solid ${c.statut === 'en_preparation' ? 'var(--g3)' : 'var(--gold2)'}`, borderRadius: 8, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: 'var(--gold2)' }}>#{c.numero_commande}</span>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>⏰ {c.heure_retrait?.slice(0,5)} · {c.nom}</div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{Math.floor((Date.now() - new Date(c.created_at).getTime()) / 60000)}min</div>
              </div>
              {c.lignes?.map((l, i) => (
                <div key={i} style={{ fontSize: 14, color: 'white', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ color: 'var(--r)', fontWeight: 700 }}>{l.quantite}×</span> {l.article_nom} {l.taille === 'pala' ? '(Pala)' : ''}
                  {l.commentaire && <div style={{ fontSize: 12, color: 'var(--gold2)', marginTop: 2 }}>⚠ {l.commentaire}</div>}
                </div>
              ))}
              {c.notes && <div style={{ fontSize: 12, color: 'var(--gold2)', marginTop: 8, fontStyle: 'italic' }}>📝 {c.notes}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {c.statut === 'en_attente' && <button className="btn-y" style={{ flex: 1, padding: 10 }} onClick={() => updateCmdStatut(c.id, 'en_preparation')}>▶ Démarrer</button>}
                {c.statut === 'en_preparation' && <button className="btn-g" style={{ flex: 1, padding: 10 }} onClick={() => updateCmdStatut(c.id, 'prete')}>✓ Prête !</button>}
              </div>
            </div>
          ))}
          {commandes.filter(c => ['en_attente','en_preparation'].includes(c.statut)).length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 60, fontStyle: 'italic' }}>Aucune commande en cours</div>
          )}
        </div>
      </div>
    )

    if (tab === 'menu') return (
      <div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'white', marginBottom: 20 }}>Gestion du menu</h2>

        {/* Catégories */}
        {AP.card(<>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Catégories</div>
          {categories.map(cat => (
            <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: 'white', fontSize: 14, fontWeight: 500 }}>{cat.nom}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="tgl on" style={{ background: cat.actif ? 'var(--g)' : undefined }} onClick={() => toggleCat(cat.id, cat.actif)} />
                <button className="btn-r" style={{ padding: '4px 10px' }} onClick={() => deleteCat(cat.id)}>✕</button>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <input className="ap-input" style={{ flex: 1, margin: 0 }} placeholder="Nouvelle catégorie" value={newCatNom} onChange={e => setNewCatNom(e.target.value)} />
            <button className="btn-g" onClick={addCat}>Ajouter</button>
          </div>
        </>, { marginBottom: 20 })}

        {/* Filtre catégorie */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setCatFilter(cat.id)} style={{ padding: '6px 16px', borderRadius: 100, fontSize: 11, background: catFilter === cat.id ? 'var(--r)' : 'rgba(255,255,255,0.07)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'Jost,sans-serif' }}>{cat.nom}</button>
          ))}
        </div>

        {/* Articles de la catégorie */}
        {articles.filter(a => a.categorie_id === catFilter).map(a => (
          <div key={a.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '14px 18px', marginBottom: 8 }}>
            {editArt?.id === a.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8 }}>
                  <input className="ap-input" style={{ margin: 0 }} value={editArt.nom} onChange={e => setEditArt({ ...editArt, nom: e.target.value })} placeholder="Nom" />
                  <input className="ap-input" style={{ margin: 0 }} value={editArt.prix} onChange={e => setEditArt({ ...editArt, prix: parseFloat(e.target.value) || 0 })} type="number" step="0.5" placeholder="Prix" />
                  <input className="ap-input" style={{ margin: 0 }} value={editArt.prix_pala || ''} onChange={e => setEditArt({ ...editArt, prix_pala: parseFloat(e.target.value) || undefined })} type="number" step="0.5" placeholder="Prix Pala" />
                  <input className="ap-input" style={{ margin: 0 }} value={editArt.prix_reduction || ''} onChange={e => setEditArt({ ...editArt, prix_reduction: parseFloat(e.target.value) || undefined })} type="number" step="0.5" placeholder="Prix promo" />
                </div>
                <input className="ap-input" style={{ margin: 0 }} value={editArt.description || ''} onChange={e => setEditArt({ ...editArt, description: e.target.value })} placeholder="Description" />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-g" onClick={saveArticle}>Sauvegarder</button>
                  <button className="btn-y" onClick={() => setEditArt(null)}>Annuler</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'white', fontSize: 14 }}>{a.nom}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    {a.prix.toFixed(2)} €{a.prix_pala ? ` / Pala ${a.prix_pala.toFixed(2)} €` : ''}
                    {a.prix_reduction && <span style={{ color: 'var(--g3)', marginLeft: 8 }}>→ Promo {a.prix_reduction.toFixed(2)} €</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div className={`tgl ${a.disponible ? 'on' : ''}`} onClick={() => toggleArt(a.id, a.disponible)} />
                  <button className="btn-y" style={{ padding: '4px 10px' }} onClick={() => setEditArt(a)}>✏</button>
                  <button className="btn-r" style={{ padding: '4px 10px' }} onClick={() => deleteArticle(a.id)}>✕</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Nouvel article */}
        {AP.card(<>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Ajouter un article</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            <input className="ap-input" placeholder="Nom *" value={newArtNom} onChange={e => setNewArtNom(e.target.value)} />
            <input className="ap-input" placeholder="Prix *" type="number" step="0.5" value={newArtPrix} onChange={e => setNewArtPrix(e.target.value)} />
            <input className="ap-input" placeholder="Prix Pala" type="number" step="0.5" value={newArtPala} onChange={e => setNewArtPala(e.target.value)} />
          </div>
          <input className="ap-input" placeholder="Description" value={newArtDesc} onChange={e => setNewArtDesc(e.target.value)} />
          <select className="ap-select" value={newArtCat} onChange={e => setNewArtCat(e.target.value)}>
            <option value="">Choisir une catégorie *</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <button className="btn-g" style={{ width: '100%', padding: 12 }} onClick={saveArticle}>Ajouter l'article</button>
        </>, { marginTop: 20 })}
      </div>
    )

    if (tab === 'plats') return (
      <div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'white', marginBottom: 20 }}>Plats du jour</h2>
        {AP.card(<>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Ajouter un plat du jour</div>
          <input className="ap-input" placeholder="Nom du plat *" value={newPlatNom} onChange={e => setNewPlatNom(e.target.value)} />
          <input className="ap-input" placeholder="Description (optionnel)" value={newPlatDesc} onChange={e => setNewPlatDesc(e.target.value)} />
          <input className="ap-input" placeholder="Prix (ex: 12.50)" type="number" step="0.5" value={newPlatPrix} onChange={e => setNewPlatPrix(e.target.value)} />
          <button className="btn-g" style={{ width: '100%', padding: 12 }} onClick={addPlat}>Publier ce plat</button>
        </>, { marginBottom: 20 })}
        <div>
          {plats.map(p => (
            <div key={p.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '16px 20px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, opacity: p.actif ? 1 : 0.5 }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: p.actif ? 'var(--gold2)' : 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>{p.nom}</div>
                {p.description && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{p.description}</div>}
                {p.prix && <div style={{ fontSize: 14, color: 'var(--g3)', fontWeight: 700, marginTop: 2 }}>{p.prix.toFixed(2)} €</div>}
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{p.date_debut}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {p.actif ? <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 100, background: 'rgba(45,122,58,0.2)', color: 'var(--g3)' }}>Actif</span> : <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 100, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>Inactif</span>}
                <div className={`tgl ${p.actif ? 'on' : ''}`} onClick={() => togglePlat(p.id, p.actif)} />
                <button className="btn-r" style={{ padding: '5px 12px' }} onClick={() => deletePlat(p.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )

    if (tab === 'formules') return (
      <div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'white', marginBottom: 20 }}>Formules</h2>
        {AP.card(<>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Créer une formule</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input className="ap-input" placeholder="Nom de la formule *" value={newFormNom} onChange={e => setNewFormNom(e.target.value)} />
            <input className="ap-input" placeholder="Prix *" type="number" step="0.5" value={newFormPrix} onChange={e => setNewFormPrix(e.target.value)} />
          </div>
          <input className="ap-input" placeholder="Description courte" value={newFormDesc} onChange={e => setNewFormDesc(e.target.value)} />
          <textarea className="ap-textarea" placeholder="Contenu détaillé (ex: Pizza + dessert + boisson, économisez 3€...)" value={newFormContenu} onChange={e => setNewFormContenu(e.target.value)} />
          <button className="btn-g" style={{ width: '100%', padding: 12 }} onClick={addFormule}>Créer la formule</button>
        </>, { marginBottom: 20 })}
        {formules.map(f => (
          <div key={f.id} style={{ background: 'rgba(255,255,255,0.04)', border: `2px solid ${f.actif ? 'var(--g)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 6, padding: '18px 22px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, opacity: f.actif ? 1 : 0.5 }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: 'var(--gold2)' }}>{f.nom}</div>
              {f.description && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{f.description}</div>}
              {f.contenu && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 1.6 }}>{f.contenu}</div>}
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: 'var(--g3)', fontWeight: 700, marginTop: 8 }}>{f.prix.toFixed(2)} €</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <div className={`tgl ${f.actif ? 'on' : ''}`} onClick={() => toggleFormule(f.id, f.actif)} />
              <button className="btn-r" style={{ padding: '5px 12px' }} onClick={() => deleteFormule(f.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    )

    if (tab === 'finances') return (
      <div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'white', marginBottom: 20 }}>Finances</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { n: commandes.filter(c => c.statut !== 'annulee').reduce((s, c) => s + c.total, 0).toFixed(2) + ' €', l: 'CA total période', c: 'var(--g3)' },
            { n: commandes.filter(c => c.statut !== 'annulee').length, l: 'Commandes', c: 'var(--gold2)' },
            { n: commandes.filter(c => c.statut === 'annulee').length, l: 'Annulations', c: 'var(--r)' },
            { n: commandes.filter(c => c.statut !== 'annulee').length > 0 ? (commandes.filter(c => c.statut !== 'annulee').reduce((s, c) => s + c.total, 0) / commandes.filter(c => c.statut !== 'annulee').length).toFixed(2) + ' €' : '0 €', l: 'Ticket moyen', c: 'white' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 20, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, color: s.c }}>{s.n}</div>
              <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>{s.l}</div>
            </div>
          ))}
        </div>
        {AP.card(<>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Filtrer par période</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="date" className="ap-input" style={{ flex: 1 }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            <button className="btn-y" onClick={() => setFilterDate(new Date().toISOString().split('T')[0])}>Aujourd'hui</button>
          </div>
          <div style={{ marginTop: 16 }}>
            {commandes.filter(c => c.statut !== 'annulee').map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>#{c.numero_commande} {c.nom} · {c.heure_retrait?.slice(0,5)}</span>
                <span style={{ color: 'var(--g3)', fontWeight: 700 }}>{c.total.toFixed(2)} €</span>
              </div>
            ))}
          </div>
        </>)}
      </div>
    )

    if (tab === 'parametres') return (
      <div>
        <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: 'white', marginBottom: 20 }}>Paramètres</h2>
        {AP.card(<>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Mots de passe admin</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[{key: 'mdp_monica', label: '🌟 Monica — Gérance'}, {key: 'mdp_andrei', label: '🍽 Andrei — Service'}, {key: 'mdp_roberto', label: '🔥 Roberto — Cuisine'}].map(p => (
              <div key={p.key} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', minWidth: 180, fontSize: 13 }}>{p.label}</span>
                <input type="password" className="ap-input" style={{ flex: 1, margin: 0 }} placeholder="Nouveau mot de passe" onBlur={async e => { if (e.target.value) await supabase.from('parametres').update({ valeur: e.target.value }).eq('cle', p.key) }} />
              </div>
            ))}
          </div>
        </>, { marginBottom: 20 })}
        {AP.card(<>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>Limite pizzas / 10 min</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="number" className="ap-input" style={{ width: 100, margin: 0 }} defaultValue={8} min={1} max={20} onBlur={async e => { await supabase.from('parametres').update({ valeur: e.target.value }).eq('cle', 'max_pizzas_10min') }} />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, alignSelf: 'center' }}>pizzas maximum par créneau de 10 minutes</span>
          </div>
        </>)}
      </div>
    )

    return null
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', color: 'white' }}>
      {AP.nav}
      {AP.tabs}
      <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto' }}>{renderTab()}</div>

      {/* SMS Modal */}
      {msgClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 8, padding: 32, maxWidth: 480, width: '100%' }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, marginBottom: 16 }}>Message client</div>
            <div style={{ fontSize: 13, color: 'var(--textl)', marginBottom: 12 }}>📞 {msgClient.tel}</div>
            <textarea value={msgClient.msg} onChange={e => setMsgClient({ ...msgClient, msg: e.target.value })} style={{ width: '100%', padding: 14, border: '1.5px solid rgba(196,30,58,0.2)', borderRadius: 4, fontSize: 14, fontFamily: 'Jost,sans-serif', minHeight: 100, resize: 'vertical', marginBottom: 16 }} />
            <p style={{ fontSize: 12, color: 'var(--textl)', marginBottom: 16, lineHeight: 1.6 }}>Copiez ce message et envoyez-le par SMS ou WhatsApp au client. Vous pouvez aussi appeler directement le <a href={`tel:${msgClient.tel}`} style={{ color: 'var(--r)' }}>{msgClient.tel}</a></p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => { navigator.clipboard.writeText(msgClient.msg); alert('Copié !') }} className="btn-submit" style={{ flex: 1 }}>📋 Copier le message</button>
              <a href={`sms:${msgClient.tel}?body=${encodeURIComponent(msgClient.msg)}`} className="btn-submit btn-submit-g" style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📱 Ouvrir SMS</a>
              <button onClick={() => setMsgClient(null)} style={{ padding: '0 16px', background: 'none', border: '1px solid rgba(196,30,58,0.2)', borderRadius: 4, cursor: 'pointer', color: 'var(--textl)' }}>✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
