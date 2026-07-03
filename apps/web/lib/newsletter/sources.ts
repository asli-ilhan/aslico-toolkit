export type NewsTopicId =
  | 'work'
  | 'politics'
  | 'history'
  | 'finance'
  | 'tech'
  | 'culture'
  | 'tennis'
  | 'f1'
  | 'lifestyle'

export interface NewsFeedSource {
  url: string
  label: string
  topic: NewsTopicId
}

export interface NewsTopic {
  id: NewsTopicId
  labelEn: string
  labelTr: string
  googleQueries: string[]
  feeds: NewsFeedSource[]
  perTopicCap: number
}


/** Default interests when user has not configured any. */
export const DEFAULT_INTERESTS = [
  'global politics',
  'world history',
  'financial markets',
  'artificial intelligence machine learning',
  'maritime industry',
  'shipbuilding ocean engineering',
  'vessel performance modelling',
  'maritime data science',
  'digital twin shipping',
  'predictive maintenance maritime',
  'tennis',
  'Formula 1',
  'contemporary art',
]

/** Maritime / shipbuilding / AI-ML research queries. */
export const DEFAULT_WORK_QUERIES = [
  'shipbuilding engineering',
  'ocean engineering research',
  'maritime digital twin',
  'ship performance modelling',
  'vessel performance AI',
  'maritime data analytics',
  'AIS vessel tracking ML',
  'physics-informed neural networks shipping',
  'predictive maintenance ships',
  'maritime machine learning',
]

export const NEWS_TOPICS: NewsTopic[] = [
  {
    id: 'work',
    labelEn: 'Work & research',
    labelTr: 'İş & araştırma',
    googleQueries: DEFAULT_WORK_QUERIES,
    feeds: [
      { url: 'https://www.lloydslist.com/rss', label: "Lloyd's List", topic: 'work' },
      { url: 'https://splash247.com/feed/', label: 'Splash247', topic: 'work' },
      { url: 'https://www.offshore-energy.biz/feed/', label: 'Offshore Energy', topic: 'work' },
      { url: 'https://www.maritime-executive.com/rss', label: 'Maritime Executive', topic: 'work' },
      { url: 'https://gcaptain.com/feed/', label: 'gCaptain', topic: 'work' },
      { url: 'https://www.ship-technology.com/feed/', label: 'Ship Technology', topic: 'work' },
    ],
    perTopicCap: 6,
  },
  {
    id: 'politics',
    labelEn: 'Global politics',
    labelTr: 'Küresel siyaset',
    googleQueries: ['geopolitics', 'international relations', 'Middle East politics', 'EU politics'],
    feeds: [
      { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', label: 'BBC World', topic: 'politics' },
      { url: 'https://www.theguardian.com/world/rss', label: 'Guardian World', topic: 'politics' },
      { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', label: 'NYT World', topic: 'politics' },
      { url: 'https://www.aljazeera.com/xml/rss/all.xml', label: 'Al Jazeera', topic: 'politics' },
      { url: 'https://www.france24.com/en/rss', label: 'France 24', topic: 'politics' },
    ],
    perTopicCap: 5,
  },
  {
    id: 'history',
    labelEn: 'History',
    labelTr: 'Tarih',
    googleQueries: ['world history', 'archaeology discovery', 'historical research'],
    feeds: [
      { url: 'https://www.smithsonianmag.com/rss/latest_articles/', label: 'Smithsonian', topic: 'history' },
      { url: 'https://www.historytoday.com/rss.xml', label: 'History Today', topic: 'history' },
      { url: 'https://www.theguardian.com/science/archaeology/rss', label: 'Guardian Archaeology', topic: 'history' },
    ],
    perTopicCap: 4,
  },
  {
    id: 'finance',
    labelEn: 'Finance & markets',
    labelTr: 'Finans & piyasalar',
    googleQueries: ['financial markets', 'central bank policy', 'global economy'],
    feeds: [
      { url: 'https://feeds.bloomberg.com/markets/news.rss', label: 'Bloomberg Markets', topic: 'finance' },
      { url: 'https://www.ft.com/world?format=rss', label: 'Financial Times', topic: 'finance' },
      { url: 'https://www.economist.com/finance-and-economics/rss.xml', label: 'The Economist', topic: 'finance' },
      { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', label: 'WSJ Markets', topic: 'finance' },
    ],
    perTopicCap: 5,
  },
  {
    id: 'tech',
    labelEn: 'Technology',
    labelTr: 'Teknoloji',
    googleQueries: ['artificial intelligence', 'machine learning', 'startup technology', 'semiconductor industry'],
    feeds: [
      { url: 'https://techcrunch.com/feed/', label: 'TechCrunch', topic: 'tech' },
      { url: 'https://feeds.arstechnica.com/arstechnica/index', label: 'Ars Technica', topic: 'tech' },
      { url: 'https://www.theverge.com/rss/index.xml', label: 'The Verge', topic: 'tech' },
      { url: 'https://www.wired.com/feed/rss', label: 'Wired', topic: 'tech' },
      { url: 'https://venturebeat.com/feed/', label: 'VentureBeat', topic: 'tech' },
    ],
    perTopicCap: 5,
  },
  {
    id: 'culture',
    labelEn: 'Culture & ideas',
    labelTr: 'Kültür & fikir',
    googleQueries: ['contemporary art', 'museum exhibition', 'literary culture', 'philosophy'],
    feeds: [
      { url: 'https://www.theguardian.com/culture/rss', label: 'Guardian Culture', topic: 'culture' },
      { url: 'https://www.dezeen.com/feed/', label: 'Dezeen', topic: 'culture' },
      { url: 'https://www.artnews.com/feed/', label: 'ARTnews', topic: 'culture' },
      { url: 'https://www.newyorker.com/feed/culture', label: 'New Yorker Culture', topic: 'culture' },
      { url: 'https://lithub.com/feed/', label: 'LitHub', topic: 'culture' },
    ],
    perTopicCap: 5,
  },
  {
    id: 'tennis',
    labelEn: 'Tennis',
    labelTr: 'Tenis',
    googleQueries: ['ATP tennis', 'WTA tennis', 'Grand Slam tennis', 'tennis tournament'],
    feeds: [
      { url: 'https://www.espn.com/espn/rss/tennis/news', label: 'ESPN Tennis', topic: 'tennis' },
      { url: 'https://www.theguardian.com/sport/tennis/rss', label: 'Guardian Tennis', topic: 'tennis' },
      { url: 'https://www.bbc.com/sport/tennis/rss.xml', label: 'BBC Tennis', topic: 'tennis' },
    ],
    perTopicCap: 4,
  },
  {
    id: 'f1',
    labelEn: 'Formula 1',
    labelTr: 'Formula 1',
    googleQueries: ['Formula 1', 'F1 racing', 'Grand Prix F1'],
    feeds: [
      { url: 'https://www.motorsport.com/rss/f1/news/', label: 'Motorsport.com F1', topic: 'f1' },
      { url: 'https://www.autosport.com/rss/feed/f1', label: 'Autosport F1', topic: 'f1' },
      { url: 'https://www.bbc.com/sport/formula1/rss.xml', label: 'BBC F1', topic: 'f1' },
    ],
    perTopicCap: 4,
  },
  {
    id: 'lifestyle',
    labelEn: 'Lifestyle (light)',
    labelTr: 'Lifestyle (hafif)',
    googleQueries: ['travel culture', 'fine dining'],
    feeds: [
      { url: 'https://www.monocle.com/rss/', label: 'Monocle', topic: 'lifestyle' },
      { url: 'https://www.ft.com/life-arts?format=rss', label: 'FT Life & Arts', topic: 'lifestyle' },
    ],
    perTopicCap: 2,
  },
]

export function topicLabel(topicId: NewsTopicId, locale: string): string {
  const topic = NEWS_TOPICS.find((t) => t.id === topicId)
  if (!topic) return topicId
  return locale === 'tr' ? topic.labelTr : topic.labelEn
}

export function allBuiltinFeedUrls(): string[] {
  const urls = new Set<string>()
  for (const topic of NEWS_TOPICS) {
    for (const feed of topic.feeds) urls.add(feed.url)
  }
  return [...urls]
}
