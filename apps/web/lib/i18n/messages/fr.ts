import type { Messages } from '../types'

export const fr: Messages = {
  nav: {
    dashboard: 'Tableau de bord',
    passkeys: 'Passkeys',
    signIn: 'Connexion',
  },
  shell: {
    tagline: 'votre studio numérique',
  },
  dashboard: {
    welcome: 'Bon retour',
    subtitle: 'Votre studio IA personnel — modules, agents et outils qui évoluent avec vous.',
    modules: 'Modules',
  },
  brief: {
    title: 'Brief du jour',
    description:
      'Votre newsletter personnelle ici. Articles, événements, livres et pratique linguistique selon vos intérêts.',
    tags: ['Recherche HCI', 'Art contemporain', 'Allemand B1', 'Recherche emploi'],
    pendingInbox: '{count} pack(s) en attente.',
    deadlines: 'Échéances',
    followUps: 'Relances',
    noReminders: 'Aucun rappel pour le moment.',
    openJobAgent: 'Job Agent →',
  },
  theme: {
    label: 'Thème',
    midnightGarden: 'Jardin de minuit',
    softDawn: 'Aube douce',
  },
  modules: {
    transcription: {
      name: 'Transcription',
      description: 'Transformez réunions et notes vocales en texte, résumés et actions.',
    },
    'doc-editor': {
      name: 'Éditeur de docs',
      description: 'Peaufinez thèse, articles et longs documents avec l’IA.',
    },
    'job-agent': {
      name: 'Agent emploi',
      description: 'Adaptez CV, rédigez lettres de motivation et suivez vos candidatures.',
    },
    calendar: {
      name: 'Calendrier',
      description: 'Synchronisez agendas, rappels et planifiez avec l’IA.',
    },
    'voice-assistant': {
      name: 'Assistant vocal',
      description: 'Parlez à votre toolkit — notes rapides, commandes et briefings.',
    },
    newsletter: {
      name: 'Newsletter quotidienne',
      description: 'Un digest personnel d’actualités, articles et sélections pour vos intérêts.',
    },
    'culture-tracker': {
      name: 'Suivi culturel',
      description: 'Suivez livres, expositions, concerts et événements en ville.',
    },
    'language-tutor': {
      name: 'Prof de langue',
      description: 'Votre prof IA — dialogue, grammaire et répétition espacée.',
    },
  },
  categories: {
    productivity: 'productivité',
    learning: 'apprentissage',
    creative: 'créatif',
    life: 'vie',
  },
  common: {
    soon: 'Bientôt',
    beta: 'Bêta',
    backToDashboard: '← Retour au tableau de bord',
    loading: 'Chargement…',
    delete: 'Supprimer',
    dashboard: 'Tableau de bord',
  },
  modulePage: {
    statusTitle: 'Statut : Bientôt disponible',
    statusDescription:
      'Ce module est enregistré dans l’architecture du toolkit. L’implémentation commence dans la prochaine phase.',
    launch: 'Lancer le module',
  },
  notFound: {
    title: 'Module introuvable',
    description: 'Ce module n’existe pas encore dans votre toolkit.',
  },
  assistant: {
    title: 'Assistant vocal',
    description: 'Bientôt — parlez à votre toolkit, prenez des notes et recevez des briefings.',
    ariaLabel: 'Ouvrir l’assistant vocal',
  },
  login: {
    title: 'Connexion',
    subtitle: 'Connectez-vous avec Touch ID, Face ID ou Windows Hello via passkey.',
    passkeyButton: 'Continuer avec passkey',
    passkeyWaiting: 'En attente…',
    touchIdButton: 'Touch ID',
    touchIdWaiting: 'Touch ID…',
    touchIdExplain: 'Utilisez Safari sur localhost:3000.',
    devSetup: 'Dev: connexion sans Touch ID',
    hint: 'Utilisez Safari ou Chrome. Le navigateur Cursor ne prend pas en charge les passkeys.',
    platformHint: 'Touch ID : enregistrez le passkey dans Safari sur ce Mac (pas via QR).',
    errors: {
      passkeyDisabled: 'Les passkeys ne sont pas activés dans le Dashboard Supabase.',
      passkeyNotFound: 'Aucun passkey sur cet appareil. Utilisez un appareil enregistré.',
    },
  },
  passkeys: {
    title: 'Paramètres passkey',
    subtitle: 'Ajoutez un passkey pour vous connecter par empreinte / Face ID.',
    empty: 'Aucun passkey. Ajoutez-en un ci-dessous.',
    add: 'Ajouter un passkey',
    adding: 'Enregistrement…',
    saved: 'Passkey enregistré',
    signOut: 'Déconnexion',
    defaultName: 'Passkey',
  },
  transcription: {
    dropzone: 'Déposez un fichier audio ici',
    formats: 'MP3, WAV, M4A, WebM — max 25 Mo',
    upload: 'Choisir un fichier audio',
    transcribing: 'Transcription…',
    history: 'Historique',
    empty: 'Aucune transcription.',
    summary: 'Résumé',
    transcript: 'Transcription',
    copy: 'Copier',
    selectOrUpload: 'Importez un audio ou choisissez une transcription passée.',
    warnings: {
      tableMissing:
        'Transcription créée mais non enregistrée — exécutez packages/storage/sql/transcriptions.sql dans Supabase.',
    },
    errors: {
      loadFailed: 'Impossible de charger les transcriptions.',
      uploadFailed: 'Échec de la transcription.',
      noAnthropicKey: 'Ajoutez ANTHROPIC_API_KEY dans apps/web/.env.local.',
      noDeepgramKey:
        'L’audio nécessite DEEPGRAM_API_KEY (Claude ne lit pas l’audio). Ou collez le texte.',
    },
    paste: {
      tab: 'Coller le texte',
      placeholder: 'Collez vos notes ou la transcription…',
      titlePlaceholder: 'Notes de réunion',
      submit: 'Résumer avec Claude',
      summarizing: 'Claude résume…',
    },
  },
  jobAgent: {
    subtitle: 'Préparation nocturne, validation matinale.',
    company: 'Entreprise',
    role: 'Poste',
    jobDescription: 'Collez l’offre…',
    cvProfile: 'Collez votre CV…',
    generate: 'Générer avec Claude',
    generating: 'Claude rédige…',
    coverLetter: 'Lettre',
    cvTips: 'CV adapté',
    copy: 'Copier',
    tabs: { guide: 'Guide', inbox: 'Boîte', new: 'Ajouter', profile: 'Profil', preferences: 'Préférences', watchlist: 'Watchlist', analytics: 'Analytics', outreach: 'Outreach', history: 'Historique' },
    inbox: { title: 'En attente', empty: 'Rien.', fit: 'Match', approve: 'Approuver', skip: 'Ignorer', markSubmitted: 'Soumis', saveEdits: 'Sauver', notes: 'Notes', deadline: 'Date limite', followUp: 'Relance', emailDraft: 'Email', emailGenerate: 'Générer email', emailGenerating: '…', exportPdf: 'PDF', exportPrint: 'Imprimer', exportMd: 'MD', exportAutofill: 'JSON', exportIcs: 'Calendrier', exportIcsDeadline: 'Échéance', exportIcsFollowup: 'Relance', gigGuard: 'Gig: manuel seulement.' },
    discovery: { hint: 'Scan Indeed, Remotive, WWR.', runNow: 'Chercher', running: '…' },
    autofill: { run: 'Remplir formulaire', running: '…', success: 'Vérifiez et envoyez.', daemonRequired: 'pnpm autofill:daemon', noUrl: 'Pas d’URL', blocked: 'Gig: manuel.' },
    new: { hint: 'Collez ou scrapez URL.', jobUrl: 'URL', scrape: 'Scraper', scraping: '…', variant: 'Variante', deadline: 'Date limite', remote: 'Remote', hybrid: 'Hybride', onsite: 'Sur site', ft: 'CDI', contract: 'Contrat', freelance: 'Freelance', gig: 'Gig', submit: 'Générer' },
    profile: { upload: 'Documents', uploadHint: 'CV et lettres.', paste: 'Coller…', addDoc: 'Ajouter', deleteDoc: 'Supprimer', build: 'Profil', building: '…', master: 'Profil maître', variants: 'Variantes', variant: 'Variante', empty: 'Ajoutez des documents.' },
    preferences: { hint: 'Filtres.', domains: 'Domaines', remoteRequired: 'Remote requis', minFit: 'Fit min', exclude: 'Bloquer', keywords: 'Mots-clés', rss: 'RSS', nightly: 'Nuit active', runNightly: 'Lancer nuit', nightlyRunning: '…', save: 'Enregistrer' },
    watchlist: { hint: 'Sources URL/RSS.', kind: 'Type', url: 'URL', rss: 'RSS', keyword: 'Mot-clé', label: 'Label', add: 'Ajouter', empty: 'Vide.' },
    analytics: { title: 'Entonnoir', total: 'Total', submitted: 'Soumis', interviews: 'Entretiens', offers: 'Offres', pending: 'Attente', avgFit: 'Fit moy.', conversion: 'Conversion', deadlines: 'Échéances', followUps: 'Relances', empty: 'Pas de données.' },
    history: { empty: 'Vide.', funnel: 'Étape', funnelStages: { applied: 'Soumis', screening: 'Screening', interview: 'Entretien', offer: 'Offre', rejected: 'Refus' } },
    outreach: { title: 'Outreach', hint: 'Après soumission, l’agent trouve les contacts et rédige l’email.', tabHint: 'Brouillons à approuver.', empty: 'Aucun outreach.', goHistory: 'Historique', recipients: 'Destinataires', subject: 'Objet', body: 'Corps', discovering: 'Recherche…', connectGmail: 'Connecter Gmail', reconnectGmail: 'Reconnecter', gmailDisconnected: 'Connectez Gmail.', sendingFrom: 'Envoi depuis', rediscover: 'Relancer', saveDraft: 'Sauver', approveSend: 'Approuver et envoyer', sending: 'Envoi…', sent: 'envoyé', sentSuccess: 'Envoyé.', startOutreach: 'Démarrer', errors: { gmailRequired: 'Gmail requis.', sendFailed: 'Échec envoi.', discoverFailed: 'Échec découverte.' }, gmailConnected: 'Gmail connecté.', gmailConnectFailed: 'Échec Gmail', gmailEnvBackend: 'Gmail serveur (.env).', gmailRedirectHint: 'Redirect URI Google:' },
    guide: { title: 'Guide', subtitle: 'Setup steps.', copy: 'Copier', refresh: 'Actualiser', done: 'OK', pending: '…', progress: { db: 'DB', profile: 'Profil', gmail: 'Gmail' }, dailyTitle: 'Boucle', dailyBody: 'Nuit → inbox → autofill → outreach.', steps: { sql: { title: '1. SQL', body: 'Supabase SQL Editor.', files: 'job_agent_v2/v3/v4_outreach.sql' }, profile: { title: '2. Profil', body: 'CV + lettres.', action: 'Profil' }, prefs: { title: '3. Préfs', body: 'Optionnel.', action: 'Préférences' }, discovery: { title: '4. Jobs', body: 'Scan auto.', cron: '02:00 UTC' }, inbox: { title: '5. Inbox', body: 'Approuver.', pending: 'En attente', action: 'Inbox' }, gmail: { title: '6. Gmail', body: 'Outreach.', envOk: 'OK', action: 'Préférences', tokenLink: 'Token' }, autofill: { title: '7. Autofill', body: 'Mac local.', running: 'OK', stopped: 'Arrêté' }, deploy: { title: '8. Vercel', body: 'GitHub + Vercel.', s1: 'GitHub', s2: 'apps/web', s3: 'Env vars', s4: 'APP_URL', gitInit: 'git init…', envHint: 'Env:', envList: 'SUPABASE|ANTHROPIC|GMAIL|CRON', cronNote: 'Pro recommandé.' } } },
    warnings: { tableMissing: 'Non enregistré.', v2Missing: 'job_agent_v2.sql', v3Missing: 'job_agent_v3.sql', v4Missing: 'job_agent_v4_outreach.sql' },
    errors: { loadFailed: 'Erreur.', generateFailed: 'Échec.' },
  },
}
