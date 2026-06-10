'use client'
import { useState, useEffect } from 'react'
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

const SLOTS_BASE = ['19:00','19:10','19:20','19:30','19:40','19:50','20:00','20:10','20:20','20:30','20:40','20:50','21:00','21:10','21:20','21:30']
const SLOTS_MIDI = ['12:00','12:10','12:20','12:30','12:40','12:50','13:00','13:10','13:20','13:30','13:40','13:50']

export default function CommanderPage() {
  const { t } = useLang()
  const [step, setStep] = useState<'menu'|'panier'|'infos'|'confirmation'>('menu')
  const [categories, setCategories] = useState<Categorie[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [catActive, setCatActive] = useState('')
  const [panier, setPanier] = useState<LignePanier[]>([])
  const [nom, setNom] = useState('')
  const [tel, setTel] = useState('')
  const [dateRetrait, setDateRetrait] = useState('')
  const [heureRetrait, setHeureRetrait] = useState('')
  const [notes, setNotes] = useState('')
  const [slotsDispos, setSlotsDispos] = useState<{slot:string,count:number,max:number}[]>([])
  const [loading, setLoading] = useState(false)
  const [numCmd, setNumCmd] = useState<number|null>(null)
  const [showCommentaire, setShowCommentaire] = useState<string|null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('categories').select('*').eq('actif', true).order('ordre'),
      supabase.from('articles').select('*').eq('disponible', true).order('ordre'),
    ]).then(([c, a]) => {
      if (c.data) { setCategories(c.data); setCatActive(c.data[0]?.id || '') }
      if (a.data) setArticles(a.data)
    })
    // Default date = today
    setDateRetrait(new Date().toISOString().split('T')[0])
  }, [])

  useEffect(() => {
    if (!dateRetrait) return
    loadSlots(dateRetrait)
  }, [dateRetrait])

  const loadSlots = async (date: string) => {
    const d = new Date(date + 'T12:00:00')
    const day = d.getDay()
    let baseSlots = SLOTS_BASE
    if ([3,4,5,6].includes(day)) baseSlots = [...SLOTS_MIDI, ...SLOTS_BASE]
    if (day === 1) { setSlotsDispos([]); return }

    const { data } = await supabase.from('lignes_commande')
      .select('commande_id, quantite, commandes!inner(date_retrait, heure_retrait, statut)')
      .eq('commandes.date_retrait', date)
      .neq('commandes.statut', 'annulee')

    // Compte pizzas par tranche de 10min
    const counts: Record<string, number> = {}
    if (data) {
      data.forEach((l: any) => {
        const h = l.commandes?.heure_retrait?.slice(0,5) || ''
        if (!counts[h]) counts[h] = 0
        counts[h] += l.quantite
      })
    }

    setSlotsDispos(baseSlots.map(s => ({ slot: s, count: counts[s] || 0, max: 8 })))
  }

  const artsByCat = articles.filter(a => a.categorie_id === catActive)
  const nbPanier = panier.reduce((s, l) => s + l.quantite, 0)
  const total = panier.reduce((s, l) => {
    const prix = l.taille === 'pala' ? (l.article.prix_pala || l.article.prix) : (l.article.prix_reduction || l.article.prix)
    return s + prix * l.quantite
  }, 0)

  const addToPanier = (article: Article, taille: 'normal'|'pala' = 'normal') => {
    const id = `${article.id}-${taille}-${Date.now()}`
    setPanier(p => [...p, { article, quantite: 1, taille, commentaire: '', id }])
  }

  const updateQty = (id: string, delta: number) => {
    setPanier(p => p.map(l => l.id === id ? { ...l, quantite: l.quantite + delta } : l).filter(l => l.quantite > 0))
  }

  const updateCommentaire = (id: string, val: string) => {
    setPanier(p => p.map(l => l.id === id ? { ...l, commentaire: val } : l))
  }

  const getPizzasForSlot = (slot: string) => {
    const found = slotsDispos.find(s => s.slot === slot)
    return found ? found.count : 0
  }

  const canBook = (slot: string) => {
    const pizzasInPanier = panier.filter(l => {
      const cat = categories.find(c => c.id === l.article.categorie_id)
      return cat?.nom === 'Pizzas'
    }).reduce((s, l) => s + l.quantite, 0)
    const current = getPizzasForSlot(slot)
    return current + pizzasInPanier <= 8
  }

  const submitCommande = async () => {
    setErr('')
    if (!nom.trim()) { setErr('Veuillez entrer votre nom'); return }
    if (!tel.trim()) { setErr('Le téléphone est obligatoire'); return }
    if (!heureRetrait) { setErr('Choisissez une heure de retrait'); return }
    if (panier.length === 0) { setErr('Votre panier est vide'); return }

    setLoading(true)
    const { data: cmd, error } = await supabase.from('commandes').insert({
      nom, telephone: tel,
      heure_retrait: heureRetrait,
      date_retrait: dateRetrait,
      statut: 'en_attente',
      notes: notes || null,
      total,
    }).select().single()

    if (error || !cmd) { setErr('Erreur. Appelez le 06 68 36 62 98'); setLoading(false); return }

    await supabase.from('lignes_commande').insert(
      panier.map(l => ({
        commande_id: cmd.id,
        article_id: l.article.id,
        article_nom: l.article.nom,
        quantite: l.quantite,
        taille: l.taille,
        prix_unitaire: l.taille === 'pala' ? (l.article.prix_pala || l.article.prix) : (l.article.prix_reduction || l.article.prix),
        commentaire: l.commentaire || null,
      }))
    )

    setNumCmd(cmd.numero_commande)
    setStep('confirmation')
    setLoading(false)
  }

  if (step === 'confirmation') return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 36, marginBottom: 12 }}>{t('emporter_succes')}</h1>
        <div style={{ background: 'var(--r)', color: 'white', borderRadius: 4, padding: '8px 24px', display: 'inline-block', fontFamily: "'Playfair Display',serif", fontSize: 28, marginBottom: 20 }}>
          N° {numCmd}
        </div>
        <p style={{ fontSize: 15, color: 'var(--textm)', lineHeight: 1.8, marginBottom: 12 }}>
          {nom}, votre commande est bien reçue.<br/>
          Retrait prévu à <strong>{heureRetrait}</strong>.
        </p>
        <p style={{ fontSize: 13, color: 'var(--textl)', marginBottom: 28 }}>
          En cas de besoin, n'hésitez pas à nous appeler au{' '}
          <a href="tel:0668366298" style={{ color: 'var(--r)' }}>06 68 36 62 98</a>
        </p>
        <Link href="/" className="bp" style={{ textDecoration: 'none', display: 'inline-block' }}>← Retour à l'accueil</Link>
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

      {step === 'menu' && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, marginBottom: 8 }}>{t('emporter_titre')}</h1>
          <p style={{ fontSize: 14, color: 'var(--textl)', marginBottom: 28 }}>Choisissez vos articles, puis indiquez l'heure de retrait</p>

          {/* Catégories */}
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

          {/* Articles */}
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
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button onClick={() => setStep('menu')} className="bo" style={{ flex: 1 }}>← Ajouter des articles</button>
            <button onClick={() => setStep('infos')} className="bp" style={{ flex: 2 }}>Continuer →</button>
          </div>
        </div>
      )}

      {step === 'infos' && (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <button onClick={() => setStep('panier')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--textl)' }}>←</button>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28 }}>Vos <em style={{ color: 'var(--r)' }}>informations</em></h1>
          </div>

          <div style={{ background: 'white', borderRadius: 8, padding: 32, border: '1px solid rgba(196,30,58,0.08)', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="rf-label">{t('emporter_nom')} *</label>
              <input className="rf-input" value={nom} onChange={e => setNom(e.target.value)} placeholder={t('emporter_nom')} />
            </div>
            <div>
              <label className="rf-label">{t('emporter_tel')} *</label>
              <input className="rf-input" value={tel} onChange={e => setTel(e.target.value)} placeholder={t('emporter_tel')} type="tel" />
            </div>
            <div>
              <label className="rf-label">Date de retrait *</label>
              <input className="rf-input" value={dateRetrait} onChange={e => setDateRetrait(e.target.value)} type="date" min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="rf-label">{t('emporter_heure')} *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {slotsDispos.length === 0 && <div style={{ fontSize: 13, color: 'var(--textl)', fontStyle: 'italic' }}>Fermé ce jour-là</div>}
                {slotsDispos.map(s => {
                  const ok = canBook(s.slot)
                  const full = s.count >= 8
                  return (
                    <button key={s.slot} disabled={full || !ok} onClick={() => setHeureRetrait(s.slot)} className={`slot ${heureRetrait === s.slot ? 'sel' : ''} ${full || !ok ? 'full' : ''}`}
                      title={full ? 'Complet' : !ok ? 'Insuffisant pour votre commande' : ''}>
                      {s.slot}
                      {s.count > 0 && <span style={{ fontSize: 9, opacity: 0.7, marginLeft: 4 }}>({8-s.count} dispo)</span>}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="rf-label">Notes (optionnel)</label>
              <textarea className="rf-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Sonnez à la porte rouge..." />
            </div>
            <p style={{ fontSize: 12, color: 'var(--textl)', lineHeight: 1.6, textAlign: 'center' }}>
              En cas de besoin, n'hésitez pas à nous appeler au <a href="tel:0668366298" style={{ color: 'var(--r)' }}>06 68 36 62 98</a>
            </p>
            {err && <div style={{ color: 'var(--r)', fontSize: 13, textAlign: 'center' }}>{err}</div>}
            <button className="btn-submit btn-submit-g" onClick={submitCommande} disabled={loading}>
              {loading ? t('chargement') : `✓ ${t('emporter_btn')}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
