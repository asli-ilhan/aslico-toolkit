export type BookLanguage = 'en' | 'tr' | 'fr' | 'es' | 'ar'
export type BookCategory =
  | 'business'
  | 'psychology'
  | 'development'
  | 'maritime'
  | 'philosophy'
  | 'fiction'

export interface CanonBook {
  title: string
  author: string
  language: BookLanguage
  category: BookCategory
  why: string
}

export const DEFAULT_BOOK_TOPICS: BookCategory[] = [
  'business',
  'psychology',
  'development',
  'maritime',
  'philosophy',
]

export const DEFAULT_LANGUAGES: BookLanguage[] = ['en', 'tr', 'fr', 'es', 'ar']

/** Curated must-read essentials — expand over time. */
export const CANON_BOOKS: CanonBook[] = [
  // English — business
  { title: 'Zero to One', author: 'Peter Thiel', language: 'en', category: 'business', why: 'Contrarian startup thinking' },
  { title: 'Good to Great', author: 'Jim Collins', language: 'en', category: 'business', why: 'What separates enduring companies' },
  { title: 'The Lean Startup', author: 'Eric Ries', language: 'en', category: 'business', why: 'Build-measure-learn for products' },
  { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', language: 'en', category: 'psychology', why: 'Decision-making foundations' },
  { title: 'Influence', author: 'Robert Cialdini', language: 'en', category: 'psychology', why: 'Persuasion and human behaviour' },
  { title: 'Deep Work', author: 'Cal Newport', language: 'en', category: 'development', why: 'Focus in a distracted world' },
  { title: 'Atomic Habits', author: 'James Clear', language: 'en', category: 'development', why: 'Systems over goals' },
  { title: 'The Pragmatic Programmer', author: 'Hunt & Thomas', language: 'en', category: 'development', why: 'Craft of software engineering' },
  { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', language: 'en', category: 'development', why: 'Data systems for ML engineers' },
  { title: 'Introduction to Naval Architecture', author: 'Eric Tupper', language: 'en', category: 'maritime', why: 'Ship design fundamentals' },
  { title: 'Ship Stability for Masters and Mates', author: 'Bryan Barrass', language: 'en', category: 'maritime', why: 'Vessel stability essentials' },
  { title: 'The Ocean of Life', author: 'Callum Roberts', language: 'en', category: 'maritime', why: 'Ocean systems and maritime context' },
  { title: 'Meditations', author: 'Marcus Aurelius', language: 'en', category: 'philosophy', why: 'Stoic practice for daily life' },
  { title: 'The Republic', author: 'Plato', language: 'en', category: 'philosophy', why: 'Justice, society, and ideas' },
  { title: '1984', author: 'George Orwell', language: 'en', category: 'fiction', why: 'Power, language, and surveillance' },
  // Turkish
  { title: 'İnsanın Anlam Arayışı', author: 'Viktor Frankl', language: 'tr', category: 'psychology', why: 'Anlam ve dayanıklılık' },
  { title: 'Suç ve Ceza', author: 'Dostoyevski', language: 'tr', category: 'fiction', why: 'Psikoloji ve ahlak klasiği' },
  { title: 'Simyacı', author: 'Paulo Coelho', language: 'tr', category: 'development', why: 'Kişisel yolculuk ve cesaret' },
  { title: 'İkigai', author: 'García & Miralles', language: 'tr', category: 'development', why: 'Uzun ve anlamlı bir yaşam' },
  { title: 'Sapiens', author: 'Yuval Noah Harari', language: 'tr', category: 'philosophy', why: 'İnsanlık tarihi ve gelecek' },
  { title: 'Denizcilik Ekonomisi', author: 'Martin Stopford', language: 'tr', category: 'maritime', why: 'Gemi piyasaları ve ticaret' },
  // French
  { title: 'Le Petit Prince', author: 'Saint-Exupéry', language: 'fr', category: 'fiction', why: 'Classique — perspective et humanité' },
  { title: 'L\'Étranger', author: 'Albert Camus', language: 'fr', category: 'fiction', why: 'Absurde et conscience' },
  { title: 'Les Misérables', author: 'Victor Hugo', language: 'fr', category: 'fiction', why: 'Justice sociale et rédemption' },
  { title: 'Introduction à la psychanalyse', author: 'Sigmund Freud', language: 'fr', category: 'psychology', why: 'Fondations de la psyché' },
  { title: 'De la richesse des nations', author: 'Adam Smith', language: 'fr', category: 'business', why: 'Économie classique' },
  // Spanish
  { title: 'Cien años de soledad', author: 'Gabriel García Márquez', language: 'es', category: 'fiction', why: 'Realismo mágico esencial' },
  { title: 'El arte de la guerra', author: 'Sun Tzu', language: 'es', category: 'business', why: 'Estrategia aplicable a la vida' },
  { title: 'El poder del ahora', author: 'Eckhart Tolle', language: 'es', category: 'development', why: 'Presencia y claridad mental' },
  { title: 'Inteligencia emocional', author: 'Daniel Goleman', language: 'es', category: 'psychology', why: 'EQ en trabajo y relaciones' },
  // Arabic (often read in translation — canonical titles)
  { title: 'ألف ليلة وليلة', author: 'مجهول', language: 'ar', category: 'fiction', why: 'كلاسيكية السرد العربي' },
  { title: 'في الشعر الجاهلي', author: 'طه حسين', language: 'ar', category: 'philosophy', why: 'نقد وثقافة عربية' },
  { title: 'العادات الذرية', author: 'جيمس كلير', language: 'ar', category: 'development', why: 'بناء العادات — ترجمة شائعة' },
  { title: 'رجال في البحر', author: 'إرنست همنغواي', language: 'ar', category: 'maritime', why: 'البحر والصمود' },
]

export function booksForTopics(
  topics: BookCategory[],
  languages: BookLanguage[],
  limitPerLang = 8,
): CanonBook[] {
  const out: CanonBook[] = []
  for (const lang of languages) {
    const pool = CANON_BOOKS.filter(
      (b) => b.language === lang && topics.includes(b.category),
    )
    out.push(...pool.slice(0, limitPerLang))
  }
  return out
}
