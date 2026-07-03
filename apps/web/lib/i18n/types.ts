export type Locale = 'en' | 'tr' | 'fr' | 'es' | 'ar'

export const LOCALES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'en' },
  { code: 'tr', label: 'tr' },
  { code: 'fr', label: 'fr' },
  { code: 'es', label: 'es' },
  { code: 'ar', label: 'ar' },
]

export const RTL_LOCALES: Locale[] = ['ar']

export type Messages = {
  nav: {
    dashboard: string
    passkeys: string
    signIn: string
  }
  shell: {
    tagline: string
  }
  dashboard: {
    welcome: string
    subtitle: string
    modules: string
  }
  brief: {
    title: string
    description: string
    tags: string[]
    pendingInbox: string
    deadlines: string
    followUps: string
    noReminders: string
    openJobAgent: string
    todayCalendar: string
    weekAhead: string
    openCalendar: string
    openNewsletter: string
    newsletterReady: string
    generateNewsletter: string
    noEventsToday: string
  }
  theme: {
    label: string
    midnightGarden: string
    softDawn: string
  }
  modules: Record<
    string,
    {
      name: string
      description: string
    }
  >
  categories: Record<string, string>
  common: {
    soon: string
    beta: string
    backToDashboard: string
    loading: string
    delete: string
    dashboard: string
  }
  modulePage: {
    statusTitle: string
    statusDescription: string
    launch: string
  }
  notFound: {
    title: string
    description: string
  }
  assistant: {
    title: string
    description: string
    ariaLabel: string
    openFull: string
    placeholder: string
    send: string
    sending: string
    mic: string
    listening: string
    speakReplies: string
    thinking: string
  }
  login: {
    title: string
    subtitle: string
    passkeyButton: string
    passkeyWaiting: string
    touchIdButton: string
    touchIdWaiting: string
    touchIdExplain: string
    devSetup: string
    hint: string
    platformHint: string
    productionHint: string
    touchIdConfirm: string
    touchIdConfirmHint: string
    passkeyOptional: string
    passkeyDomainWarning: string
    emailSend: string
    emailSending: string
    emailSent: string
    emailHint: string
    googleSignIn: string
    googleSigningIn: string
    googleHint: string
    orDivider: string
    errors: {
      passkeyDisabled: string
      passkeyNotFound: string
      emailNotAllowed: string
      emailFailed: string
      emailNotConfigured: string
      emailRateLimit: string
      googleNotEnabled: string
    }
  }
  passkeys: {
    title: string
    subtitle: string
    empty: string
    add: string
    adding: string
    saved: string
    signOut: string
    defaultName: string
    deleteQrHint: string
    relinkHint: string
  }
  transcription: {
    dropzone: string
    formats: string
    upload: string
    transcribing: string
    history: string
    empty: string
    summary: string
    transcript: string
    copy: string
    selectOrUpload: string
    warnings: {
      tableMissing: string
    }
    errors: {
      loadFailed: string
      uploadFailed: string
      noAnthropicKey: string
      noDeepgramKey: string
    }
    paste: {
      tab: string
      placeholder: string
      titlePlaceholder: string
      submit: string
      summarizing: string
    }
  }
  jobAgent: {
    subtitle: string
    company: string
    role: string
    jobDescription: string
    cvProfile: string
    generate: string
    generating: string
    coverLetter: string
    cvTips: string
    copy: string
    tabs: {
      guide: string
      inbox: string
      new: string
      profile: string
      preferences: string
      watchlist: string
      analytics: string
      outreach: string
      history: string
    }
    inbox: {
      title: string
      empty: string
      fit: string
      approve: string
      skip: string
      markSubmitted: string
      saveEdits: string
      notes: string
      deadline: string
      followUp: string
      emailDraft: string
      emailGenerate: string
      emailGenerating: string
    exportPdf: string
    exportPrint: string
    exportMd: string
    exportAutofill: string
    exportIcs: string
    exportIcsDeadline: string
    exportIcsFollowup: string
    gigGuard: string
    }
    discovery: {
      hint: string
      runNow: string
      running: string
    }
    autofill: {
      run: string
      running: string
      success: string
      daemonRequired: string
      noUrl: string
      blocked: string
    }
    new: {
      hint: string
      jobUrl: string
      scrape: string
      scraping: string
      variant: string
      deadline: string
      remote: string
      hybrid: string
      onsite: string
      ft: string
      contract: string
      freelance: string
      gig: string
      submit: string
    }
    profile: {
      upload: string
      uploadHint: string
      paste: string
      addDoc: string
      deleteDoc: string
      build: string
      building: string
      master: string
      variants: string
      variant: string
      empty: string
    }
    preferences: {
      hint: string
      domains: string
      remoteRequired: string
      minFit: string
      exclude: string
      excludeRoles: string
      avoidSenior: string
      requireDomain: string
      experienceLevel: string
      experienceYears: string
      targetCompanies: string
      keywords: string
      rss: string
      nightly: string
      runNightly: string
      nightlyRunning: string
      save: string
    }
    watchlist: {
      hint: string
      kind: string
      url: string
      rss: string
      careers: string
      keyword: string
      label: string
      add: string
      empty: string
    }
    analytics: {
      title: string
      total: string
      submitted: string
      interviews: string
      offers: string
      pending: string
      avgFit: string
      conversion: string
      deadlines: string
      followUps: string
      empty: string
    }
    history: {
      empty: string
      funnel: string
      funnelStages: {
        applied: string
        screening: string
        interview: string
        offer: string
        rejected: string
      }
    }
    outreach: {
      title: string
      hint: string
      tabHint: string
      empty: string
      goHistory: string
      recipients: string
      subject: string
      body: string
      discovering: string
      connectGmail: string
      reconnectGmail: string
      gmailDisconnected: string
      sendingFrom: string
      rediscover: string
      saveDraft: string
      approveSend: string
      sending: string
      sent: string
      sentSuccess: string
      startOutreach: string
      errors: {
        gmailRequired: string
        sendFailed: string
        discoverFailed: string
      }
      gmailConnected: string
      gmailConnectFailed: string
      gmailEnvBackend: string
      gmailRedirectHint: string
    }
    guide: {
      title: string
      subtitle: string
      copy: string
      refresh: string
      done: string
      pending: string
      progress: {
        database: string
        profile: string
        gmail: string
        autofill: string
        inbox: string
      }
      dailyTitle: string
      dailyBody: string
      steps: {
        database: {
          title: string
          body: string
          supabaseHint: string
          fileV2: string
          fileV3: string
          fileV4: string
        }
        profile: { title: string; body: string; action: string }
        prefs: { title: string; body: string; action: string }
        discovery: { title: string; body: string; nightlyNote: string }
        inbox: { title: string; body: string; pending: string; action: string }
        autofill: {
          title: string
          body: string
          onceLabel: string
          onceHint: string
          sessionLabel: string
          running: string
          stopped: string
        }
        gmail: {
          title: string
          body: string
          action: string
          envDone: string
          connected: string
          pending: string
        }
        outreach: { title: string; body: string; action: string }
      }
    }
    warnings: { tableMissing: string; v2Missing: string; v3Missing: string; v4Missing: string }
    errors: { loadFailed: string; generateFailed: string }
  }
  calendar: {
    title: string
    subtitle: string
    upcoming: string
    empty: string
    addEvent: string
    eventTitle: string
    startsAt: string
    allDay: string
    allDayLabel: string
    save: string
    syncJobAgent: string
    syncing: string
    fromJobAgent: string
    fromGoogle: string
    fromMicrosoft: string
    connectionsTitle: string
    connectGoogle: string
    connectAnotherGoogle: string
    connectMicrosoft: string
    connectAnotherMicrosoft: string
    syncExternal: string
    disconnect: string
    connectedAs: string
    notConnected: string
    todosTitle: string
    addTodo: string
    todoPlaceholder: string
    done: string
    todoDate: string
    warnings: { tableMissing: string; v2Missing: string; v3Missing: string }
    errors: {
      googleNotConfigured: string
      microsoftNotConfigured: string
      syncFailed: string
    }
  }
  newsletter: {
    title: string
    subtitle: string
    interestsTitle: string
    interestsHint: string
    newsFeedsTitle: string
    newsFeedsHint: string
    saveInterests: string
    generateToday: string
    generating: string
    empty: string
    history: string
    aiNote: string
    noHeadlines: string
    noEvents: string
    noTodos: string
    readArticle: string
    sections: {
      headlines: string
      events: string
      todos: string
      job: string
    }
    warnings: { tableMissing: string; v2Missing: string }
    errors: { generateFailed: string }
  }
  voiceAssistant: {
    title: string
    subtitle: string
    empty: string
    placeholder: string
    send: string
    sending: string
    mic: string
    listening: string
    speakReplies: string
    clear: string
    thinking: string
    quickPrompts: string[]
    warnings: { tableMissing: string }
    errors: { sendFailed: string; noMic: string }
  }
}
