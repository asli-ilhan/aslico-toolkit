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
    languageLessonToday: string
    languageRestDay: string
    cultureScoutReady: string
    openLanguageTutor: string
    openCultureTracker: string
    openTravelScout: string
    openFundingScout: string
    fundingPendingInbox: string
    todayTodos: string
    upcomingTrip: string
    fundingDeadlines: string
    yourInterests: string
    generating: string
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
      fileTooLarge: string
      storageMissing: string
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
    exportPdfLetter: string
    exportPdfCv: string
    exportPdfBundle: string
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
      stop: string
      stopped: string
      summary: string
      scanFailed: string
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
      importSeed: string
      importing: string
      importDone: string
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
      scheduleTitle: string
      scheduleBody: string
      stopTitle: string
      stopBody: string
      runsTitle: string
      runsEmpty: string
      runsRow: string
      runSummary: string
      lowResultsHint: string
      softRelevanceHint: string
      scanDepth: string
      scanDepthNormal: string
      scanDepthDeep: string
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
  cultureTracker: {
    title: string
    subtitle: string
    settingsTitle: string
    homeCities: string
    interests: string
    spotifyArtists: string
    favoriteAuthors: string
    bookTopics: string
    languages: string
    saveSettings: string
    runScout: string
    scouting: string
    calendarHint: string
    booksTitle: string
    yourBooks: string
    empty: string
    noEvents: string
    addBook: string
    bookTitle: string
    bookAuthor: string
    bookStatus: string
    statuses: Record<string, string>
    removeBook: string
    warnings: { tableMissing: string }
    errors: { scoutFailed: string }
  }
  travelScout: {
    title: string
    subtitle: string
    planTrip: string
    destinationPlaceholder: string
    scoutTrip: string
    randomPick: string
    scouting: string
    calendarHint: string
    vibesTitle: string
    vibes: Record<string, string>
    avoidMass: string
    interestsPlaceholder: string
    saveSettings: string
    insiderTips: string
    empty: string
    history: string
    upcomingPlans: string
    warnings: { tableMissing: string }
    errors: { scoutFailed: string }
  }
  languageTutor: {
    title: string
    subtitle: string
    day: string
    streak: string
    restDay: string
    restDayHint: string
    tabs: Record<string, string>
    words: string
    reading: string
    speaking: string
    writing: string
    youtube: string
    immersion: string
    quiz: string
    dialogues: string
    readingQuestions: string
    submitPractice: string
    speakingPlaceholder: string
    writingPlaceholder: string
    grading: string
    grammarBlocked: string
    repeatUnit: string
    rotation: string
    filmsTitle: string
    booksTitle: string
    cultureBooks: string
    srsAgain: string
    srsHard: string
    srsGood: string
    srsEasy: string
    mic: string
    grammarGate: string
    grammarPassed: string
    grammarPending: string
    generateLesson: string
    regenerateLesson: string
    legacyLessonHint: string
    deleteLesson: string
    generating: string
    noLesson: string
    markDone: string
    modes: Record<string, string>
    chatPlaceholder: string
    send: string
    showAnswer: string
    hard: string
    easy: string
    noCards: string
    genReport: string
    topErrors: string
    settings: string
    programStart: string
    saveSettings: string
    nativeLanguage: string
    sundayBreak: string
    goalDays: string
    dailyPlan: string
    dailyPlanProgress: string
    phaseTeach: string
    phasePractice: string
    phaseCheck: string
    phaseMissions: string
    teachingGoals: string
    keyPatterns: string
    commonMistakes: string
    drills: string
    revealDrillAnswer: string
    missionVideo: string
    missionCoach: string
    missionFlashcards: string
    missionImmersion: string
    openMission: string
    finishTeach: string
    finishPractice: string
    checkRequired: string
    quizPassHint: string
    estimatedMinutes: string
    warnings: { tableMissing: string }
    errors: { lessonFailed: string; grammarBlocked: string; submitFailed: string }
  }
  fundingScout: {
    subtitle: string
    scanTitle: string
    scanHint: string
    scanDepth: string
    scanDepthNormal: string
    scanDepthDeep: string
    requireFullFunding: string
    startScan: string
    stopScan: string
    scanning: string
    stopped: string
    scanSummary: string
    saveSettings: string
    inbox: string
    inboxEmpty: string
    fit: string
    openLink: string
    motivation: string
    researchSummary: string
    projectOutline: string
    approve: string
    markSubmitted: string
    skip: string
    profileHint: string
    deadline: string
    noDeadline: string
    deadlineCalendarHint: string
    eligibilityTitle: string
    eligibilityHint: string
    phdStartMonth: string
    homeUniversity: string
    homeCountry: string
    partnerCountries: string
    supervisionModel: string
    partnershipNotes: string
    partnershipNotesPlaceholder: string
    strictEligibility: string
    eligible: string
    eligibilityReason: string
    confidence: string
    confidenceVerified: string
    confidenceUnverified: string
    applicantType: string
    applicantTypeStudent: string
    applicantTypePiLed: string
    verifyNotes: string
    disqualifiers: string
    supervisionModels: Record<string, string>
    warnings: { tableMissing: string; eligibilityMigration: string; scanFailed: string }
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
  scoutSkipped: {
    title: string
    hint: string
    empty: string
    fit: string
    openLink: string
    generatePack: string
    dismiss: string
    filterLabel: string
    filterAll: string
    categories: Record<string, string>
    warnings: { tableMissing: string; saveFailed: string }
  }
  scoutFeedback: {
    title: string
    hint: string
    placeholder: string
    submit: string
    dismissWithout: string
    cancel: string
  }
  selfTherapy: {
    title: string
    disclaimer: string
    topicLabel: string
    topicPlaceholder: string
    notesLabel: string
    notesPlaceholder: string
    durationLabel: string
    durations: { short: string; medium: string; long: string }
    generate: string
    generating: string
    speak: string
    speaking: string
    play: string
    pause: string
    sleepMode: string
    sleepHint: string
    fadeTimer: string
    fadeOff: string
    minutes: string
    history: string
    empty: string
    sections: { induction: string; deepening: string; suggestions: string }
    status: { draft: string; ready: string; speaking: string; failed: string }
    warnings: { tableMissing: string; storageMissing: string; incompleteScript: string }
    errors: {
      loadFailed: string
      generateFailed: string
      speakFailed: string
      noElevenLabsKey: string
      paidVoiceRequired: string
      elevenLabsQuota: string
      localTtsUnavailable: string
      audioPlayFailed: string
      speakingHint: string
      storageMissing: string
      tableRequired: string
    }
  }
}
