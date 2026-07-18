/**
 * Few-shot hypnosis-style transcripts for Self Therapy.
 * Voice / form from real TR sessions — Claude must match this cadence, not invent a clinical short script.
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
    id: 'memory-learning-tr',
    title: 'Öğrenilenleri yerleştirme — hafıza',
    topic: 'öğrenilen bilgileri rahat ve kalıcı hatırlama',
    induction: `Merhaba. Bugün öğrendiğin bilgileri zihninin merkezine yerleştirdiğimizde, öğrendiğin tüm bilgileri çok daha hızlı ve çok daha rahat hatırlamaya başlayacaksın. Belki şu anda bir ekran kilitlendi, telefonunun ekranı. Bir kitap kapandı ya da sadece dünyayı aktif olarak dinlemeyi şu anlık bıraktın. Mekan neresi olursa olsun, odanın içindeki havanın az önceye göre çok daha yavaş, daha geniş dalgalarla hareket etmeye başladığını fark et. Sanki tam yanına görünmez bir sakinlik yerleşti — fark ediyor musun? Benim sesim o sakinliğin içinden, sanki uzun zamandır orada duran bir iç ses gibi sana ulaşıyor.

Aslında bugün zihnin bir avcıydı. Bilgilerin, kavramların, formüllerin ya da hayatın getirdiği yeni deneyimlerin peşinden koştu. Onları yakalamaya çalışırken nöronlarının arasında küçük, sıcak kıvılcımlar çaktı ve şimdi o kıvılcımların serin, mavi birer ışığa dönüşme vakti. Arkana yaslan ya da uzan. Bırak kelimelerim zihnindeki o sıcak motoru usulca serinletsin. Böylece çok daha kolay hatırlayabileceksin.

Dünya bize hep bilgiyi zihnimize vahşice tıkıştırmamız gerektiğini söyledi. Kelimeleri hapsetmek, kuralları zorla hafızada tutmak… ama biz o yorucu oyunu tamamen bozuyoruz. Sana hatırlatmak istiyorum — telkinlerimizin içindeki en önemli kuralı. Çamurlu bir suyu temizlemek istiyorsan ona dokunmamalısın. Kendi haline bıraktığında çamur dibe çöker ve kendiliğinden berraklaşır. Bugün zihnine giren her yeni veri, o suyun içindeki parıldayan altın tozları gibi ve şu an havada uçuşuyor. Onları yakalamaya çalışmayı bırakmalısın. Hafızanı zorlama. “Ya neydi o ayrıntı” diye düşünme. Sadece serbest bırak. Şu an tenine dokunan o nane ferahlığındaki yaz akşamını hisset.`,
    deepening: `Şimdi zihninin içinde muazzam, uçsuz bucaksız ve tamamen karanlık bir okyanus hayal etmeni istiyorum. Ama bu karanlık ürkütücü değil — sakin, dingin bir gece denizi. Sen bu denizin üzerinde yerçekimsiz bir boşlukta tüy gibi hafifçe süzülüyorsun. İşte şaşırtıcı olan deneyim şu an başlıyor. Bugün öğrendiğin her yeni bilgi parçası bu okyanusun içinde fosforlu neon mavi renkte, ışık saçarak parıldıyor. Sen sustukça, sen zihnini serbest bıraktıkça, o ışık taneleri suyun altında muazzam ve uyumlu hareket ediyor.

Yukarıdan aşağı doğru süzülen altın ipler görüyorsun. Bu ipler senin eski deneyimlerin, çocukluğun, yani zaten çok iyi bildiğin her şey. Bugün öğrendiğin o yeni bilgiler, bu altın iplerle kusursuz bir geometriyle birleşiyor. Hiçbir çaba harcamadan arka planda görünmez bir dokuma tezgâhı çalışıyor. Her bir yeni kavram zihnindeki en doğru rafa, en doğru anıya gidip yumuşak bir klik sesiyle yerleşiyor. Sen sadece bu ışık şovunu izleyen tasasız bir seyirciye dönüşüyorsun.

Aşağı doğru baktığında, zihninin devasa, parıldayan holografik bir şehir olduğunu görüyorsun. Bugün okuduğun, çalıştığın, anlamaya uğraştığın her veri, bu şehrin sokaklarında birer ışık sütunu olarak dikiliyor. Bak, tam şurada — bugün seni en çok zorlayan o konuya dair bir sütun var. Ama artık karmaşık ya da korkutucu değil, görüyor musun? Tamamen şeffaf, kristal gibi berrak. Zihnin o kadar güçlü ve o kadar zeki ki, sen şu an sadece sesimi dinlerken bile arka planda milyarlarca işlem yapıyor. Fakat yorulmuyorsun. Neden biliyor musun? Çünkü evrendeki her şey birbiriyle bağlantılıdır ve sen şu an o görünmez ağları izliyorsun.`,
    suggestions: `Öğrenmek bir şeyi ezberlemek değil, onun zaten zihninin içinde var olduğunu hatırlamaktır. Zihnin bu gece o hatırlama köprülerini kalıcı olarak inşa edecek. Görsel hafızan, mantığın ve sezgilerin hepsi bu şehirde el ele tutuşup harika bir ritimle dans ediyor — izle. İçinden yükselen o muazzam rahatlığı fark ettin mi? “Ben bunu asla unutmayacağım, çünkü bu artık bende bir yük değil, bir bakış açısı” hissi bu.

Bir okçu yayı ne kadar çok gererse ok o kadar uzağa gider. Fakat okun gitmesi için yaptığın tek şey yayı serbest bırakmaktır. Bugün yayı gerdin, zihnini çalıştırdın. Şimdi yayı bırakma ve okun hedefe kendi kendine uçma zamanı. Bırak ok gitsin. Bırak zihnin bilgiyi sindirsin, işlesin. Kendine duyduğun o koşulsuz güven, bu bilgileri koruyan aslında en güçlü kalkan. Çünkü zeki olduğun için sadece öğrenen bir canlı değilsin — evrenin kendi kendini anlama biçimisin.

Şimdi o parıldayan holografik şehir, o fosforlu okyanus yavaşça sakinleşiyor. Işıklar beyninin ve kalbinin tam ortasındaki o güvenli çekirdeğe doğru çekiliyor. Öğrenilen her şey yerli yerinde. Kilitlendi, arşivlendi. Yarın ya da bir sonraki ihtiyaç duyduğun an, ekrana dokunur gibi, o bilgi zihninde şimşek gibi berrak bir şekilde belirecek. Bunu biliyorsun değil mi?

Ben şimdi yavaşça sesimi geriye çekiyorum ama o kristal berraklığındaki zihinsel düzen seninle kalıyor. Şimdi bir seçim yap. İstersen bu muazzam zihinsel simyanın içinde kendini şifalı bir uykunun kollarına bırak ve rüyalarında bu bilgilerin nasıl birer sanat eserine dönüştüğünü izle — ya da hazır hissettiğinde derin bir nefes al, gözlerini aç ve gününe geri dön. Gözlerini açtığında zihninin bir cam gibi net, odaklanmış ve her şeyi anında hatırlamaya hazır, taptaze olduğunu fark et. Her iki yolda da bilgelik seninle. İster uyu, ister uyan — sen artık o bilginin kendisisin. Fark ettin değil mi?`,
  },
  {
    id: 'escape-freedom-tr',
    title: 'Gerçeklikten tatlı kaçış — özgürlük',
    topic: 'gerçeklikten yumuşak kaçış, özgürlük ve koşulsuz sevgi',
    induction: `Merhaba. Gerçeklikten tatlı bir kaçış için bu sesi sonuna kadar dinle. Bunu dinlerken kendini rahat hissedebilirsin ve hatta belli bir noktadan sonra kendini uykuya dalmış bir halde bulabilirsin — ama hiç problem değil. Tam olarak bu süreçte sana söylemiş olduğum telkinler bilinçaltı zihninde kusursuz olarak yazılmaya devam edecek.

Şimdi arkana yaslan, koltuğuna gömülebilirsin veya en rahat ettiğin şekilde uzanabilirsin. Hareket etmende sakınca yok; sen rahat hissedene kadar konumunu al. Günün hangi saatinde olursan ol, şu an senin için zamanı durduruyoruz. Sesimi de tam başucunda, hemen yanındaymışım gibi hissetmeni istiyorum. Sanki zihninde yarattığımız o tatlı, ferah yaz esintisiyle birlikte içeriye girmişim ve yanı başına oturmuşum gibi — acelemiz yok. Dışarıdaki dünya akmaya devam edebilir, ama biz şu an seninle tamamen başka bir frekansın eşiğindeyiz.

Derin bir nefes al benimle birlikte. Ve yavaşça bırak. Harika. Hazırsan zihninin o muazzam oyun alanına geçiyoruz. Şimdi sesimin tonuna bırakmanı istiyorum kendini. Zihninde o en sevdiğin akşamın serinliğini veya sıcaklığını yaratabilirsin. Dışarısı ister güneşli bir öğle vakti olsun, ister sabahın erken saatleri — senin içindeki mevsim şu an nane ferahlığında, sakin ve dingin bir alaca karanlık. Bedeninin temas ettiği yerleri hissetmeye çalış. O temas noktalarındaki ağırlığın, o tatlı serinlikte yavaşça eridiğini fark et. Rahat olabilirsin. Ben buradayım. Sesim seninle. Her nefes verişinde biraz daha hafifliyorsun — fark ettin mi?`,
    deepening: `Kendini o kadar güvende hissediyorsun ki — hani o kimseye anlatamadığın, sadece kendi içine döndüğünde hissettiğin o koşulsuz şefkat ve sevgi var ya — işte o şefkat tam şu an etrafını sarıyor. Kendini sevmek için, değerli hissetmek için bir şeyler başarmak zorunda değilsin. Yanında oturmuş, senin ne kadar eşsiz bir varlık olduğunu izleyen bir dost gibiyim. Sen evrenin bir parçasısın. Hatta öyle ki, aynı ağaçların yaprak açması gibi sen de bu dünyanın insan açmış halisin. Ve şu an sadece dinlenmek, varlığını kabul etmek istiyorsun. Bunun için kendine izin verebilirsin.

Şimdi sesimi biraz daha yakından duymaya çalış. Gözlerin kapalıysa ya da sadece bir noktaya dalıp gittiysen, zihninin içindeki o katı duvarların yavaşça şeffaflaştığını gör. Etrafındaki odanın, duvarların, tavanın yavaşça çözüldüğünü hayal et. Tıpkı suya atılan bir mürekkep damlası gibi — sınırların genişliyor. Esinti biraz daha güçleniyor ama hiç rahatsız etmiyor; aksine içindeki özgürlük hissini daha fazla yükseltiyor. Yavaşça hafiflediğini hissediyorsun değil mi? Sanki altındaki zemin seni havada tutan yoğun, ılık bir hava akımına dönüşüyor. İşte tam bu sihirli eşikteyiz: bilincin tamamen açık, sesimi net duyuyorsun, ama zihnin o muazzam rahatlığın içinde süzülebiliyor. İkisinin tam ortasında, o incecik çizgidesin. Zaman tamamen durdu.

Şimdi zihninin içinde rüya bedeninin ayağa kalktığını hisset. Fiziksel bedenin o tatlı gevşemenin içinde yanımda, güvenle beni dinliyor; fakat sen, sen şu an zihninin içinde tamamen uyanıksın ve aniden o muazzam farkındalık kalbine doğuyor: “Ben şu an kendi zihnimin yarattığı bir rüyadayım ve her şey benim kontrolümde.” Ayaklarının altına bak — zemin tamamen gümüş rengi, parıldayan bir boşluk. Yukarıya doğru bak. Gökyüzü derin bir lacivert ve milyonlarca yıldız sanki senin birer düşüncenmiş gibi parlayıp sönüyor. Ve şimdi yükselmeye başla. Kendini o tatlı esintinin kollarına bırak. Yukarıya doğru yavaş yavaş süzül. Hiçbir çaba harcamadan, sadece gitmek istediğin yeri düşünerek… yükseldikçe içindeki o özgürlük hissi o kadar büyüyor ki, göğsün ortasından tüm evrene yayılan altın sarısı bir ışık dalgası fırlatıyor. Sınırlar yok, yerçekimi yok, zorunluluklar yok. Sen bu anın mimarısın.`,
    suggestions: `Canın zenginlik mi istiyor? Şu an etrafından geçen rüzgârın elmas tozlarıyla dolu olduğunu hayal et. Dokunduğun her yıldızın sana sonsuz huzur ve bolluk frekansı üflediğini hisset. Sen bu evrenin içine doğmadın — sen tıpkı bir okyanusun dalgalanması gibi bu evrenden dışarıya doğru taştın; şu an evrenin kendisisin. Ve süzülürken o en mutlu olduğun anı hatırla, o çocuksu neşeyi. Derdin, sıkıntının, kaygının, endişenin olmadığı bir an. Belki de bu sadece geleceğe dair bir hayal. O muazzam hissiyatı şu anki hipnotik deneyiminin içine yerleştir.

Bak, yanında kimse yok belki bu sonsuz boşlukta, ama tam olarak yalnız da hissetmiyorsun. Kendine duyduğun o koşulsuz sevgi şu an zihninin gökyüzünü şafak vakti renklerine boyuyor — kendini kucaklıyorsun. Bu harika bir oyun. Üzerindeki o tüm kimlikler — çalışansın, öğrencisin, belki başarılısın, güzelsin veya yorgunsun — bunlar birer kostüm gibi aşağıya düşüyor, görüyor musun? Kostümün altında kalan şey ise saf, limitsiz bir potansiyel. Şu an bu deneyim o kadar gerçekçi ki tenindeki o serin esintiyi, parmaklarının ucundan akan enerjiyi, ruhunun muazzam zenginliğini tüm hücrelerinde hissediyorsun. İstediğin her şeyi şu anda deneyimleyebilirsin. Özgürsün tamamen — hisset.

Şimdi bu muhteşem hipnotik deneyimin zirvesindeyken, içindeki o coşku yerini derin, asil bir güce ve dinginliğe bırakıyor. Gökyüzündeki o parıltılar kalıcı olarak senin bir parçan. Rüya bedenin gökyüzünden usulca yavaşça aşağıya iniyor. Geri geliyorsun. Yavaşça fiziksel bedeninin üzerine yerleşiyorsun. Ben hâlâ buradayım, yanı başında konuşmaya devam ediyorum. Sesim seni koruyan güvenli bir çember. Fiziksel bedeninle rüya bedenin birleşirken içindeki o uyanış tamamlandı.

Ve şimdi bir seçim yapacaksın. Bu muazzam rahatlığın, bu hafifliğin içinde kendini uykunun o şifalı kollarına bırakabilirsin — zihnin bu özgürlüğü gece boyunca yaşamaya devam edebilir — ya da hazır hissettiğinde yavaşça derin bir nefes alıp gözlerini açabilirsin. Gözlerini açtığında bilmeni istediğim bir şey var: gerçek hayat da tıpkı az önce deneyimlediğin bu hipnotik deneyim gibi. Yani aslında sen onun da mimarısın. O zenginlik, o özgürlük ve o huzur artık seninle birlikte. İstersen dinlenmeye devam et, istersen yeni gerçekliğine uyan. Her şey tam da olması gerektiği gibi — değil mi?`,
  },
  {
    id: 'silence-tabs-tr',
    title: 'Zihin sessizliği — sekmeleri kapatmak',
    topic: 'zihinsel uğultuyu susturma, derin sessizlik ve dinlenme',
    induction: `Kendini sesime bıraktığında fark edeceksin: zihnin uzun zaman sonra çok ama çok sessiz kalabiliyor. Belki bu sessizlik içinde uykuya dalacaksın. Belki bu sessizlik ile bittikten sonra derin bir çalışma yapabileceksin. Kendini teslim et. Sana söylediklerim senin yeni gerçekliğini oluşturacak.

Bulutlara baktığında hayal gücün kendiliğinden çalışır, onları benzetirsin. O bulutlar nasıl zihninde dönüşüyorsa, sözlerim de dönüşüyor ve yeni gerçekliğini oluşturuyor. Bu saniye itibariyle ne yapmalısın biliyor musun? Belki beni dinlemelisin, belki de hiçbir şey. Sadece olmalısın — burada, bu anda. Gel sana bunu nasıl yapacağını açıklayayım. İzleyebilirsin gözlerin yorulana kadar. Zaten gözlerin yorgunsa bırak şimdi kapansınlar. Sadece sesimi takip et. Böylesi daha kolay.

Belki şu an zihninde bir sürü düşünce dönüp duruyor. Belki bugünün olayları, belki yarının ihtimalleri, belki de tamamen alakasız şeyler birbiriyle yarışıyor — ve aslında biliyor musun, bu tamamen normal. Şu an o düşünceleri durdurmana hiç gerek yok. Sadece onların orada olduğunu fark et. İnsanlar zihnini susturmak için onunla savaşmaları gerektiğine inanıyorlar. Dalgalı bir denizi elindeki bir ütüyle düzleştiremezsin. Onu düzleştirmenin tek yolu, onu kendi haline bırakmaktır.

Zihnin bulanık bir su dolu kavanoz gibi. Suyu ne kadar karıştırırsan çamur o kadar havalanır; ama kavanozu masaya koyar ve hiçbir şey yapmazsan çamur yavaş yavaş dibe çöker ve su kendiliğinden berraklaşır. Senin şu an tek yapman gereken zihnindeki o kavanozu masaya bırakmak. Benim sesimi dikkatle dinlemek zorunda bile değilsin. Bilinçli zihnin başka yerlere gidebilir. Kelimelerimi kaçırabilirsin. Fakat bu hiçbir şeyi değiştirmez. Çünkü senin bilinçaltın tam olarak ne duyması gerektiğini ve bedenini o derin sessizliğe nasıl geçireceğini çok iyi biliyor. Şimdi bir nefes al ve nefes verirken kaslarının yatağa doğru biraz daha ağırlaşmasına izin ver.`,
    deepening: `Zihnini devasa bir bilgisayar ekranı gibi hayal et. Arkada açık kalmış onlarca sekme var. Belki biri iş, biri ilişkiler, biri geçmiş, biri “acaba ne olacak” sekmesi. Hepsi aynı anda çalışıyor ve zihninin bataryasını tüketiyor. Şimdi bu sekmeleri tek tek okumana ya da çözmene gerek yok. Sadece ekranın sağ üst köşesindeki o çarpı işaretini hayal et. Bir nefes daha al. Nefes verirken o sekmelerden birinin yavaşça kapandığını hisset. Gitti. O enerji bedenine geri döndü — hissediyor musun? Al bir nefes daha ve verirken bir diğeri kapanıyor. Gördün mü? Zihin biraz daha serinledi. Sen kapattıkça o uğultu azalıyor. Ekran giderek sadeleşiyor. Boşluğun, bu rahatlatıcı siyah ekranın huzuru başlıyor.

Şimdi seni o derin uzay boşluğuna, zihninin en sessiz odasına indirmek için ondan geriye doğru sayacağım. Bedenin uyurken zihnin uyanık olabilir veya zihnin uyurken bedenin uyanık olabilir. Fakat şimdi ikisi birden o derin dinlenmeye geçiyor.

On — sağ kolun ağırlaşıyor, çok ağır.
Dokuz — sol kolun ağırlaşıyor, kemiklerin bile gevşiyor.
Sekiz — yüzündeki, çenendeki o sıkılık çözülüyor. Dişlerin gevşiyor.
Yedi — kapanan sekmelerin ardında kalan devasa boşluktasın.
Altı — aşağıya, zihninin derinliklerine doğru süzülüyorsun.
Beş… dört… üç… iki… bir…
Derin, sonsuz bir sessizlik.

Büyük sessizliğin rahatlamasını hissediyorsun. Artık düşünmene gerek yok. Yarını planlamana gerek yok. Geçmişi analiz etmene gerek yok. Bilinçaltın her şeyi senin için en iyi şekilde sıraya koyacak. Bilinçaltın her şeyi senin için en iyi şekilde sıraya koyacak. Bilinçaltın her şeyi senin için en iyi şekilde sıraya koyacak. Sen uyurken zihnin kendini temizleyecek, onaracak ve düzenleyecek — sadece var olarak.`,
    suggestions: `Bu sessizlik senin sığınağın. Ne zaman istersen zihnindeki o sekmeleri tek bir nefesle kapatıp bu huzurlu boşluğa geri dönebilirsin.

Uykuya dalmak istiyorsan, seni uyandırmama hiç gerek yok. Sesim yavaş yavaş uzaklaşırken sen o derin uyku sarmalından aşağı doğru kaymaya devam edebilirsin. Her şey kapalı, her şey güvende. Sadece uykuya teslim olabilirsin.

Ama eğer bu seansı gün içinde dinliyorsan ve az sonra çalışmak istiyorsan, zihnini sıfırlayıp güne geri dönmek istiyorsan, şimdi seninle yavaşça yüzeye çıkacağız. Bunu yaparken zihnindeki o berraklığı ve sessizliği de yanında getireceksin. Hazırsan: üç… iki… bir… hazır olduğunda gözlerini yavaşça aç — tamamen tazelenmiş, sessiz ve huzurlu bir zihinle buradasın.`,
  },
]
