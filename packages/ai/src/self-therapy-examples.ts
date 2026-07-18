/**
 * Few-shot example transcripts for Self Therapy script generation.
 * Replace / extend with real hypnotherapist transcripts when available.
 */

export interface TherapyScriptExample {
  id: string
  title: string
  topic: string
  induction: string
  deepening: string
  suggestions: string
}

export const THERAPY_SCRIPT_EXAMPLES: TherapyScriptExample[] = [
  {
    id: 'sleep-calm-tr',
    title: 'Uykuya hazırlık — sakinlik',
    topic: 'uyku öncesi kaygı azaltma',
    induction: `Gözlerini yavaşça kapatıyorsun… Nefesin burnundan içeri süzülüyor, ağzından uzun ve yumuşakça çıkıyor.
Her nefeste omuzların biraz daha düşüyor. Yataktaki çarşafın dokusu, yastığın serinliği… bedenin güvenli bir yerde olduğunu hatırlıyor.
Şimdi yalnızca sesimi ve nefesini duyuyorsun. Dışarıdaki düşünceler uzaklaşabilir; sen burada, şimdi, dinleniyorsun.`,
    deepening: `Her saydığım sayıyla biraz daha derin bir dinginlik… On. Dokuz. Sekiz… bedenin ağırlaşıyor, zihnin yavaşlıyor.
Yedi… altı… beş… sanki yumuşak bir ışık seni sarıyor. Dört… üç… iki… bir.
Burası senin frekansın: yavaş, güvenli, derin. Her hücre dinlenmeye izin veriyor.`,
    suggestions: `Bu gece bedenin kendini iyileştirmeyi biliyor. Kaygı bir bulut gibi geçebilir; sen bulut değilsin, gökyüzüsün.
Yarın için gereken her şey yarın gelecek. Şimdi yalnızca uykunun seni taşımasına izin veriyorsun.
Güvendesin. Rahatsın. Derin ve onarıcı bir uykuya dalıyorsun…`,
  },
  {
    id: 'confidence-tr',
    title: 'Özgüven — yumuşak telkin',
    topic: 'özgüven güçlendirme',
    induction: `Rahat bir pozisyonda oturuyor veya uzanıyorsun. Omurganın uzunluğunu hissediyorsun.
Nefes… içeri sakinlik, dışarı gerilim. Ellerin yumuşuyor, çenen gevşiyor.
İçeride bir alan açılıyor — yargı yok, sadece farkındalık.`,
    deepening: `Şimdi bir merdivenden iniyorsun… her basamak daha dingin. On… dokuz… sekiz…
Zihnin frekansı değişiyor: acele yok, savunu yok. Sadece netlik.
Beş… dört… üç… iki… bir. Derin, sakin bir açıklık.`,
    suggestions: `Sen yeterlisin. Yaptığın işte öğrenmeye, büyümeye ve kendi hızında ilerlemeye hakkın var.
Başkalarının bakışı seni tanımlamaz. İçindeki sakin güç, yumuşak ama kararlı.
Bu telkinler seninle kalır — uyanınca da, gündüz de, ihtiyaç duyduğunda.`,
  },
]
